// Copyright(c) 2022 Siemens

/**
 * @module js/Csi1PropagateOrRollupService
 */
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import parsingUtils from 'js/parsingUtils';
import localeSvc from 'js/localeService';
import appCtxSvc from 'js/appCtxService';
import localStrg from 'js/localStorage';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

//Method goes through items that were propagated/rolled up, figures out what sections they belonged to, and generates strings for the message to use
//Example results in English might be "Problem, Impacted" & "Reference" which plug into a message.
//An example message in English would read "Problem, Impacted and Reference contents were propagated from( Change ) to( Schedule )."
export let countRelations = function( eventData, created, modelObjects, i18nProblem, i18nImpacted, i18nSolution, i18nReference ) {
    //when countRelations is triggered from drag drop operation,created and modelObjects are undefined,
    //that is why, adding this if block, so that we get correct values for those 2 parameters.
    if( !created && !modelObjects ) {
        created = eventData.created;
        modelObjects = eventData.modelObjects;
    }
    var hasProblem = false;
    var hasImpacted = false;
    var hasSolution = false;
    var hasReferences = false;
    //count determines whether the message is for no relations, one relation or multiple relations
    var count = 0;

    for( var index in created ) {
        var creation = modelObjects[ created[ index ] ];
        //What's important is whether or not the relationship type is present, so only the first of each type increments the count.
        if( cmm.isInstanceOf( 'CMHasProblemItem', creation.modelType ) && !hasProblem ) {
            hasProblem = true;
            count++;
        }
        if( cmm.isInstanceOf( 'CMHasImpactedItem', creation.modelType ) && !hasImpacted ) {
            hasImpacted = true;
            count++;
        }
        if( cmm.isInstanceOf( 'CMHasSolutionItem', creation.modelType ) && !hasSolution ) {
            hasSolution = true;
            count++;
        }
        if( cmm.isInstanceOf( 'CMReferences', creation.modelType ) && !hasReferences ) {
            hasReferences = true;
            count++;
        }
    }
    //this returns all the relevant data to the json file. "one" and "two" plug into messages, "one" going before the "and" and "two" going after.
    //count is used to determine the message which is used.
    var contentStrings = {
        one: '',
        two: '',
        count: count
    };
    if( count < 1 ) {
        return contentStrings;
    }
    //The categories are listed in the same order every time.
    var stringBuild = [];
    if( hasProblem ) {
        stringBuild.push( i18nProblem );
    }
    if( hasImpacted ) {
        stringBuild.push( i18nImpacted );
    }
    if( hasSolution ) {
        stringBuild.push( i18nSolution );
    }
    if( hasReferences ) {
        stringBuild.push( i18nReference );
    }
    //If there's only 1 relation then only one string needs to be returned
    if( count === 1 ) {
        contentStrings.one = stringBuild[ 0 ];
        return contentStrings;
    }

    //Otherwise the last string is put into "two" and "one" lists the previous relations separated by commas.
    for( var indexB in stringBuild ) {
        if( indexB === String( count - 1 ) ) {
            contentStrings.two = stringBuild[ indexB ];
        } else if( indexB === String( count - 2 ) ) {
            contentStrings.one += stringBuild[ indexB ];
        } else {
            contentStrings.one += stringBuild[ indexB ];
            contentStrings.one += ', ';
        }
    }
    return contentStrings;
};

/**
 * Its a function to process response from performSearchViewModel SOA and create
 * view model property for relation column of the table
 * @param response : response from performSearchViewModel SOA call
 *
 * @returns : results to load into the table
 */
export let processRelatedObjects = function( response ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }

    //we are parsing searchResultsJSON to generate view model objects of awp0ObjectSetRowObjects
    let awp0ObjectSetRowObjects = [];
    let relatedObjects = [];
    if( response.searchResultsJSON ) {
        let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( let x = 0; x < searchResults.objects.length; ++x ) {
                let uid = searchResults.objects[ x ].uid;
                let obj = response.ServiceData.modelObjects[ uid ];
                if( obj ) {
                    var vmo = viewModelObjectSvc.createViewModelObject( uid );
                    awp0ObjectSetRowObjects.push( vmo );
                }
            }
        }
    }

    //we are getting the workspace object related to change object or related to schedule task object, and creating view model property
    //for - relation type display name, relation type name, disposition and adding it to related workspace object.
    for( let x = 0; x < awp0ObjectSetRowObjects.length; ++x ) {
        let relatedObjUID = awp0ObjectSetRowObjects[x].props.awp0Secondary.dbValue;
        let relatedObj = response.ServiceData.modelObjects[ relatedObjUID ];
        let ctx = appCtxSvc.getCtx();
        if( relatedObj ) {
            let relatedObjVMO = viewModelObjectSvc.createViewModelObject( relatedObjUID );
            let relationTypeDispNameProp = uwPropertySvc.createViewModelProperty( awp0ObjectSetRowObjects[x].props.awp0RelationTypeDisplayName.propertyName,
                awp0ObjectSetRowObjects[x].props.awp0RelationTypeDisplayName.propertyDisplayName,
                'STRING', awp0ObjectSetRowObjects[x].props.awp0RelationTypeName.dbValue, [ awp0ObjectSetRowObjects[x].props.awp0RelationTypeDisplayName.uiValue ] );

            let cmDispositionProp = uwPropertySvc.createViewModelProperty( 'CMDisposition',
                ctx.state.params.dispositionPropDisplayName, 'STRING', '', [ ctx.state.params.disposition ] );

            relatedObjVMO.props.awp0RelationTypeDisplayName = relationTypeDispNameProp;
            relatedObjVMO.props.CMDisposition = cmDispositionProp;
            relatedObjVMO.alternateID = getUniqueId( relatedObjVMO );
            relatedObjects.push( relatedObjVMO );
        }
    }
    let loadResult = tableDPReqRespHelper.createTableLoadResult( relatedObjects.length );
    loadResult.searchResults = relatedObjects;
    loadResult.searchIndex = -1;
    loadResult.totalFound = relatedObjects.length;

    return {
        loadResult : loadResult
    };
};

/**
 * we are using this function to generate alternate IDs, because when there are same objects with different relation in the table,
 * splm table is selects all the objects.
 * @param {Object} vmo : view model object for which alternate ID is to be generated
 * @returns view model object with alternated ID
 */
let getUniqueId = function( vmo ) {
    return vmo.uid + Math.random();
};

/**
    * It is a function to process input for propagateOrRollupRelations SOA.
    *
    * @param data : view model data
    *
    * @returns : relationships array to provide input for SOA
    */
export const propagate = ( data ) => {
    let relationships = [];
    for ( var x = 0; x < data.relatedObjectsTable.selected.length; ++x ) {
        for ( var y = 0; y < data.relatedSchTasksTable.selected.length; ++y ) {
            let changeUID = data.ctx.state.params.uid;
            var changeObject = cdm.getObject( changeUID );

            let primaryUID = data.relatedSchTasksTable.selected[y].uid;
            var primaryType = cdm.getObject( primaryUID );

            let secondaryUID = data.relatedObjectsTable.selected[x].uid;
            var secondaryType = cdm.getObject( secondaryUID );

            //Get relation type
            var relType = data.relatedObjectsTable.selected[x].props.awp0RelationTypeDisplayName.dbValue;

            var relation = {
                parentChange: {
                    uid: changeUID,
                    type: changeObject.type
                },
                relationType: relType,
                primaryObject: {
                    uid: primaryUID,
                    type: primaryType.type
                },
                secondaryObject: {
                    uid: secondaryUID,
                    type: secondaryType.type
                }
            };

            relationships.push( relation );
        }
    }

    return relationships;
};

/**
 * We want to show only specific schedule tasks types in the table, this function processes all schedule
 * tasks and returns tasks that are of type - standard(0), milestone(1), link(5)
 * @param {*} response : response from performSearchViewModel SOA call
 * @returns : results to load into the table
 */
export let processScheduleTasks = function( response ) {
    if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
        return response;
    }

    let awp0ObjectSetRowObjects = [];
    let taskObjects = [];
    let schTasksForTable = [];
    if( response.searchResultsJSON ) {
        let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
        if( searchResults ) {
            for( let x = 0; x < searchResults.objects.length; ++x ) {
                let uid = searchResults.objects[ x ].uid;
                let obj = response.ServiceData.modelObjects[ uid ];
                if( obj ) {
                    var vmo = viewModelObjectSvc.createViewModelObject( uid );
                    awp0ObjectSetRowObjects.push( vmo );
                    var uid1 = awp0ObjectSetRowObjects[x].props.awp0Secondary.dbValue;
                    var taskObj = cdm.getObject( uid1 );
                    taskObjects.push( taskObj );
                }
            }
        }
    }

    for( var x = 0; x < taskObjects.length; ++x ) {
        if( taskObjects[x].props.task_type.dbValues[0] === '0' || taskObjects[x].props.task_type.dbValues[0] === '1'
        || taskObjects[x].props.task_type.dbValues[0] === '5' ) {
            schTasksForTable.push( taskObjects[x] );
        }
    }

    var loadResult = tableDPReqRespHelper.createTableLoadResult( schTasksForTable.length );
    loadResult.searchResults = schTasksForTable;
    loadResult.searchIndex = -1;
    loadResult.totalFound = schTasksForTable.length;

    return {
        loadResult : loadResult
    };
};

/**
 * This function is used to get the selected change and selected schedule
 * @param {*} ctx : Application context
 * @returns selected change and selected schedule
 */
export let getSelectedChangeAndSchedule = function( ctx ) {
    var resource = 'ChangeContentMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var selectedChange = localTextBundle.selectedChange;
    var selectedSchedule = localTextBundle.selectedSchedule;
    selectedChange = selectedChange.replace( '{0}', ctx.state.params.selectedChange );
    selectedSchedule = selectedSchedule.replace( '{0}', ctx.state.params.selectedSchedule );

    return{
        selectedChange:selectedChange,
        selectedSchedule:selectedSchedule
    };
};

/**
 * Function( dropHandler ), to call propagateOrRollupRelations soa, when we drop object related to change on schedule task.
 * @param {Object} dragAndDropParams : default parameters for DnD
 */
export let dropActionPropagateFn = ( dragAndDropParams ) => {
    const targetObject = dragAndDropParams.targetObjects;
    let dragDataJSON = localStrg.get( 'draggedListData' );
    let sourceObjects = null;

    if ( dragDataJSON && dragDataJSON !== 'undefined' ) {
        sourceObjects = JSON.parse( dragDataJSON );
    }

    let relationships = null;
    if ( sourceObjects !== undefined && sourceObjects !== null ) {
        relationships = createSOAInput( sourceObjects, targetObject );
    }

    if ( relationships && relationships.length > 0 ) {
        let soaInput = {
            relationships: relationships,
            rollup: false
        };

        soaSvc.post( 'Internal-CmSmInterface-2020-01-RelationManagement',
            'propagateOrRollupRelations', soaInput ).then( function( response ) {
            let input = {
                created: response.created,
                modelObjects: response.modelObjects,
                i18nProblem: 'Problem',
                i18nImpacted: 'Impacted',
                i18nSolution: 'Solution',
                i18nReference: 'Reference'
            };
            eventBus.publish( 'csi1propagateRelations.propagated', input );
        } );
    }
    dehighlightElement();
    clearCachedData();
};

/**
 * "dropHandlers" are used to enable and customize the drop operation for a view and
 * the components inside it. If a dropHandler is activated for a certain view, then
 * the same dropHandler becomes applicable to all the components inside the view.
 * This means, we can handle any drop/dragEnter/dragOver operation for any component
 * inside a view at the view level. Not all the components used inside a view have
 * drop configured, when a dropHandler is active for a view.
 * The action associated bind-ed with drag actions is expected to be a synchronous
 * javascript action. we can only associate declarative action type syncFunction with
 * drag actions. At runtime the js function( bind-ed with drag action ) receives a system
 * generated object as the last parameter of the function.
 * For more info  :- http://swf/showcase/#/showcase/Declarative%20Configuration%20Points/dragAndDrop
 * @param {Object} dragAndDropParams : default parameters for DnD
 * @returns
 */
export let dragOverPropagateFn = ( dragAndDropParams ) => {
    if ( dragAndDropParams.dataProvider ) {
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dragAndDropParams.targetElement
        } );

        return {
            dropEffect: 'copy',
            preventDefault: true
        };
    }
    dehighlightElement();
    return {
        dropEffect: 'none'
    };
};

/**
 * Dehighlight the element when drop action is completed
 */
const dehighlightElement = () => {
    let allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if ( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

/**
 * This function is called when we do a drag operation on the table.
 * Here, we are adding the target objects that we get while doing drag to draggedListData.
 * @param {Object} extraParams : extra params
 * @param {Object} dnDParams : default parameters for DnD
 */
export let dragStartPropagateFn = ( extraParams, dnDParams ) => {
    localStrg.publish( 'draggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

/**
 * Clear the cache data.
 */
const clearCachedData = () => {
    localStrg.publish( 'draggedListData' );
};

/**
 * We are using this function to create and return input for propagateOrRollupRelations SOA
 * @param {Array} sourceObjects : contains objects that are dragged from LHS table
 * @param {Object} targetObject : schedule task object on which objects related to change need to be propagated
 * @returns input for propagateOrRollupRelations SOA
 */
let createSOAInput = function( sourceObjects, targetObject ) {
    let ctx = appCtxSvc.getCtx();
    let changeUID = ctx.state.params.uid;
    let changeObject = cdm.getObject( changeUID );
    let relationships = [];
    for ( var x = 0; x < sourceObjects.length; x++ ) {
        let relType = sourceObjects[x].props.awp0RelationTypeDisplayName.dbValue;
        let relation = {
            parentChange: {
                uid: changeUID,
                type: changeObject.type
            },
            relationType: relType,
            primaryObject: {
                uid: targetObject[0].uid,
                type: targetObject[0].type
            },
            secondaryObject: {
                uid: sourceObjects[x].uid,
                type: sourceObjects[x].type
            }
        };
        relationships.push( relation );
    }

    return relationships;
};

export default exports = {
    countRelations,
    processRelatedObjects,
    processScheduleTasks,
    propagate,
    getSelectedChangeAndSchedule,
    dropActionPropagateFn,
    dragOverPropagateFn,
    dragStartPropagateFn
};
