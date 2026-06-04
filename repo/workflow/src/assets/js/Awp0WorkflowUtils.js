// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowUtils
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import iconSvc from 'js/iconService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import cdm from 'soa/kernel/clientDataModel';


/**
 * Define public API
 */
var exports = {};
var requiredPanelContextKeys = [ 'searchCriteria', 'selectionData', 'selectedObject', 'participantType', 'searchState', 'vmo', 'isParticipantTable', 'selParticipantObject', 'profileObject', 'signoffAction', 'originType', 'selectionModel', 'selectionModelMode' ];


/**
 * Create the input stricture that will be pass to server to get the
 * group member from user obejct.
 *
 * @param {data} searchCriteria - The search criteria that will hold group and role info to be used
 * @param {Array} selection - The selection object array
 *
 * @return {Object} - userInput object that holds the correct values .
 */
var getInputData = function( searchCriteria, selection ) {
    var userInput = {};
    var input = {};

    // Check if selection is not null and 0th index object is also not null
    // then only add it to the view model
    if( selection && selection.length > 0 ) {
        var userId = selection[ 0 ].props.user_id.dbValues[ 0 ];
        var groupName;
        var roleName;
        var groupObj = cdm.getObject( selection[ 0 ].props.default_group.dbValues[0] );
        if( searchCriteria ) {
            if( searchCriteria.group && searchCriteria.role ) {
                groupName = searchCriteria.group;
                roleName = searchCriteria.role;
            } else if( !searchCriteria.group && searchCriteria.role ) {
                groupName = '*';
                roleName = searchCriteria.role;
            } else if( searchCriteria.group && !searchCriteria.role ) {
                groupName = searchCriteria.group;
                roleName = '*';
            } else if( groupObj && groupObj.props && groupObj.props.name ) {
                groupName = groupObj.props.name.dbValues[0];
            } else {
                groupName = selection[ 0 ].props.default_group.uiValue;
            }
        } else if( groupObj && groupObj.props && groupObj.props.name ) {
            groupName = groupObj.props.name.dbValues[0];
        } else {
            groupName = selection[ 0 ].props.default_group.uiValue;
        }

        // Check if object is selected then only create the input structure
        if( selection[ 0 ].selected ) {
            input = {
                userID: userId,
                userName: userId,
                groupName: groupName,
                roleName: roleName,
                includeInactive: false,
                includeSubGroups: true
            };
        }
    }
    userInput.input = input;
    return userInput;
};

/**
 * Get the valid selected obejct from input selected objects. If input selection
 * has user obejct then it will get group memebr from user otherwise directly return input.
 *
 * @param {Object} searchCriteria - Search criteria string
 * @param {Array} selection - The selection object array
 *
 * @return {Object} - userInput object that holds the correct values .
 */
export let getValidObjectsToAdd = function( searchCriteria, selection ) {
    var deferred = AwPromiseService.instance.defer();
    if( selection[ 0 ] && selection[ 0 ].type && selection[ 0 ].type === 'User' ) {
        var input = getInputData( searchCriteria, selection );
        var policyId = policySvc.register( {
            types: [ {
                name: 'User',
                properties: [ {
                    name: 'user_id',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                } ]
            },
            {
                name: 'GroupMember',
                properties: [ {
                    name: 'default_role'
                }, {
                    name: 'user'
                }, {
                    name: 'group'
                }, {
                    name: 'role'
                } ]
            }
            ]
        } );
        soaService.postUnchecked( 'Internal-Administration-2012-10-OrganizationManagement',
            'getOrganizationGroupMembers', input ).then(
            function( response ) {
                if( policyId ) {
                    policySvc.unregister( policyId );
                }
                var gmObject = null;
                if( response && response.groupElementMap && response.groupElementMap[ 1 ][ '0' ] ) {
                    //check for default_role property on returned groupmembers
                    var groupMembers = response.groupElementMap[ 1 ][ '0' ].members;
                    var foundDefaultRole = false;

                    for( var i = 0; i < groupMembers.length; i++ ) {
                        var propValue = groupMembers[ i ].members[ 0 ].props.default_role;
                        if( propValue.dbValues[ 0 ] === '1' ) {
                            gmObject = groupMembers[ i ].members[ 0 ];
                            foundDefaultRole = true;
                            break;
                        }
                    }
                    if( !foundDefaultRole ) {
                        gmObject = response.groupElementMap[ 1 ][ '0' ].members[ '0' ].members[ '0' ];
                    }
                }

                // If valid group member is not found then return empty array from here
                if( !gmObject ) {
                    return deferred.resolve( [] );
                }

                // Add cellHeaders to GM
                var gmVMObject = viewModelObjectService.createViewModelObject( gmObject );
                gmVMObject.selected = true;
                gmVMObject.cellHeader1 = selection[ 0 ].cellHeader1;
                var groupMemberObjects = [];
                groupMemberObjects.push( gmVMObject );
                return deferred.resolve( groupMemberObjects );
            } );
    } else {
        deferred.resolve( selection );
    }
    return deferred.promise;
};

/**
 *
 * @param {String} iconPathArr path of the icon
 * @returns {String} name of the icon
 */
var getIconNameFromPath = function( iconPathArr ) {
    var iconPath = _.split( iconPathArr, '/' );
    var iconName = '';
    if( iconPath.length > 2 && iconPath[ iconPath.length - 1 ] ) {
        iconName = iconPath[ iconPath.length - 1 ];
    }
    return iconName;
};

var getFinishNodeCategory = function( stateValue ) {
    var category = 'EPM_pending';
    switch ( stateValue ) {
        case 2:
        case 4: {
            category = 'EPM_pending';
            break;
        }
        case 8: {
            category = 'EPM_completed';
            break;
        }
        case 16:
        case 128: {
            category = 'EPM_suspended';
            break;
        }
        case 32: {
            category = 'EPM_aborted';
            break;
        }
        case 64: {
            category = 'EPM_failed';
            break;
        }
        default:
            category = 'EPM_unassigned';
    }
    if( stateValue > 128 ) {
        category = 'EPM_suspended';
    }

    return category;
};

/**
 * Get the start or finish node category
 * @param {String} nodeType Node type string
 * @param {int} stateValueProp State int value
 *
 * @returns {String} Node type category
 */
export let getStartFinishNodeCategory = function( nodeType, stateValueProp ) {
    var category = 'EPM_completed';
    var stateValue = parseInt( stateValueProp );
    if( nodeType === 'start' ) {
        if( stateValue === 32 ) {
            category = 'EPM_aborted';
        } else if( stateValue === 2 ) {
            category = 'EPM_pending';
        }
    } else if( nodeType === 'finish' ) {
        category = getFinishNodeCategory( stateValue );
    }
    return category;
};

/**
 * Get the icon string url for input object and return.
 *
 * @param {Object} nodeObject Node object for which icon need to be fetched.
 * @param {Object} taskTypeString Task type string for icon need to be fetched
 *
 * @returns {String} Image Url string for input node object
 */
export let getTaskFlowBasedIcon = function( nodeObject, taskTypeString ) {
    var iconFileName = '';
    var taskType = null;
    // Check if node object is not null then get the type from that else use the input type string
    // to get the correct icon
    if( nodeObject ) {
        taskType = nodeObject.type;
    } else if( !nodeObject && taskTypeString ) {
        taskType = taskTypeString;
    }

    var taskTypesArray = [
        { name: 'EPMDoTask', iconFileName: 'typeFlowDoTask48.svg' },
        { name: 'EPMDoTaskTemplate', iconFileName: 'typeFlowDoTask48.svg' },
        { name: 'EPMConditionTask', iconFileName: 'typeFlowConditionTask48.svg' },
        { name: 'EPMConditionTaskTemplate', iconFileName: 'typeFlowConditionTask48.svg' },
        { name: 'EPMRouteTask', iconFileName: 'typeFlowRouteTask48.svg' },
        { name: 'EPMRouteTaskTemplate', iconFileName: 'typeFlowRouteTask48.svg' },
        { name: 'EPMReviewTask', iconFileName: 'typeFlowReviewTask48.svg' },
        { name: 'EPMReviewTaskTemplate', iconFileName: 'typeFlowReviewTask48.svg' },
        { name: 'EPMAcknowledgeTask', iconFileName: 'typeFlowAcknowledgeTask48.svg' },
        { name: 'EPMAcknowledgeTaskTemplate', iconFileName: 'typeFlowAcknowledgeTask48.svg' },
        { name: 'EPMAddStatusTask', iconFileName: 'typeFlowAddStatusTask48.svg' },
        { name: 'EPMAddStatusTaskTemplate', iconFileName: 'typeFlowAddStatusTask48.svg' },
        { name: 'EPMValidateTask', iconFileName: 'typeFlowValidateTask48.svg' },
        { name: 'EPMValidateTaskTemplate', iconFileName: 'typeFlowValidateTask48.svg' },
        { name: 'EPMOrTask', iconFileName: 'typeFlowOrTask48.svg' },
        { name: 'EPMOrTaskTemplate', iconFileName: 'typeFlowOrTask48.svg' },
        { name: 'EPMPerformSignoffTask', iconFileName: 'typeFlowPerformSignOffTask48.svg' },
        { name: 'EPMPerformSignoffTaskTemplate', iconFileName: 'typeFlowPerformSignOffTask48.svg' },
        { name: 'EPMSelectSignoffTask', iconFileName: 'typeFlowSelectSignoffTask48.svg' },
        { name: 'EPMSelectSignoffTaskTemplate', iconFileName: 'typeFlowSelectSignoffTask48.svg' },
        { name: 'EPMNotifyTask', iconFileName: 'typeFlowNotifyTask48.svg' },
        { name: 'EPMNotifyTaskTemplate', iconFileName: 'typeFlowNotifyTask48.svg' },
        { name: 'EPMTask', iconFileName: 'typeFlowTask48.svg' },
        { name: 'EPMTaskTemplate', iconFileName: 'typeFlowTask48.svg' }
    ];

    // Iterate for all task types array and find the correct object based on type match
    // so that correct icon can be used
    var taskTypeObjectMatch = _.find( taskTypesArray, function( type ) {
        return taskType === type.name;
    } );

    if( taskTypeObjectMatch ) {
        iconFileName = taskTypeObjectMatch.iconFileName;
    }

    if( !iconFileName && taskType ) {
        var iconURL = iconSvc.getTypeIconURL( taskType );
        iconFileName = getIconNameFromPath( iconURL );
        // Check if file name is empty then use the default icon
        if( iconFileName === '' ) {
            iconFileName = 'typeFlowTask48.svg';
        }
    }
    // Check if still icon file not exist then use the default task flow icon
    if( iconFileName === '' || !iconFileName || iconFileName.indexOf( 'typeTask48' ) > -1 ) {
        iconFileName = 'typeFlowTask48.svg';
    }
    return iconSvc.getTypeIconFileUrl( iconFileName );
};

/**
 * Get the proeprty value based on limit and return the trim value.
 *
 * @param {int} propLimit Property max limit to trim the value
 * @param {String} propValue Property value that need to be trim
 *
 * @returns {String} Trim prop value that need to be used.
 */
export let getPropTrimValue = function( propLimit, propValue ) {
    if( !propLimit || !propValue ) {
        return;
    }

    /*
     * getting the input size in bytes ( as english have 1 byte char, chinese have 2 byte char, japanese
     * have 3 byte char, etc ).
     * in UTF8 encodings, each character uses between 1 and 4 bytes
     */
    var encodeStr = encodeURIComponent( propValue ).match( /%[89ABab]/g );
    var len = propValue.length + ( encodeStr ? encodeStr.length : 0 );

    /*
     * This is for handling the copy usecase.
     * If user copy the text input, where length( in terms of byte size ) is more than max-length,
     * then we need to trim the extra chars for those language's input
     * so that user can paste only those chars that are specified by max-length.
     */
    if( len > propLimit ) {
        var newInput = '';
        var newInputLength = 0;
        for( var i = 0; i < propValue.length; i++ ) {
            encodeStr = encodeURIComponent( propValue[ i ] ).match( /%[89ABab]/g );
            newInputLength = newInputLength + propValue[ i ].length +
                ( encodeStr ? encodeStr.length : 0 );

            if( newInputLength <= propLimit ) {
                newInput += propValue[ i ];
            } else {
                break;
            }
        }
        return newInput;
    }
    return propValue;
};

/**
 * Get the search criteria that is needed to load the filter values for specific column.
 *
 * @param {Object} searchCriteria Search criteria object
 * @param {String} columnField COlumn field name
 *
 * @returns {Object} Search criteria object to load filter values
 */
export let getFilterValuesSearchCriteria = function( searchCriteria, columnField ) {
    var localSearchCriteria = { ...searchCriteria };

    if( columnField ) {
        localSearchCriteria.columnName = columnField;
    } else if( !columnField && localSearchCriteria.hasOwnProperty( 'columnName' ) ) {
        delete localSearchCriteria.columnName;
    }
    return localSearchCriteria;
};

/**
 * Populate the subPanel context object from panelContext value present on appctx
 * object and return the subPanelContext object.
 *
 * @param {Object} panelContext Panel context information being used on app context
 * @returns {Object} Returns the user panel data by reading the values from panelCOntext
 *                  and returns.
 */
export let populatePanelContextData = function( panelContext ) {
    var panelData = {};
    if( panelContext ) {
        panelData = _.clone( panelContext );
    }

    return {
        panelData : panelData,
        isDataInit : true
    };
};

/**
 * Populate the subPanel context object from panelContext value present on appctx
 * object and return the subPanelContext object.
 *
 * @param {Object} panelContext Panel context information being used on app context
 * @param {Object} addUserPanelState User panel state object
 * @param {Object} criteria Default criteria object
 * @returns {Object} Returns the user panel data by reading the values from panelCOntext
 *                  and returns.
 */
export let populatePeopleSearchCriteriaContextData = function( panelContext, addUserPanelState, criteria ) {
    const userPanelState = { ...addUserPanelState };
    userPanelState.criteria = criteria;

    // Check if panel contxt is not null then iterate for all keys and update the user panel state if there
    // is any key present on panel context object.
    if( panelContext ) {
        // Iterate for all entries in additional search criteria and add to main search criteria.
        // There is specifical processing for additionalSearchCriteria needed as we need to add
        // values present in this varible to search criteria only.
        for( var key in panelContext ) {
            if( panelContext.hasOwnProperty( key ) && key !== 'additionalSearchCriteria' && key !== 'update' && key !== 'value' ) {
                if( requiredPanelContextKeys.includes( key ) ) {
                    userPanelState[ key ] = panelContext[ key ];
                }
            }
        }
        var additionalSearchCriteria = null;
        // Check if additionalSearchCriteria present on panel context then get that and use
        // it to add to searchCriteria on the state
        if( panelContext.additionalSearchCriteria ) {
            additionalSearchCriteria = panelContext.additionalSearchCriteria;
        }

        // Check if profile object is not null on profile object then get the additional search criteria
        // from profile object and use that to add on user state object
        if( panelContext.profileObject && panelContext.profileObject.additionalSearchCriteria ) {
            userPanelState.profileObject = panelContext.profileObject;
            additionalSearchCriteria = _.clone( panelContext.profileObject.additionalSearchCriteria );
        }
        // Check if criteria is not null and some criteria present then update the search criteria
        // with all required details.
        if( additionalSearchCriteria && userPanelState.criteria ) {
            // Iterate for all entries in additional search criteria and add to main search criteria
            for( var searchCriteriaKey in additionalSearchCriteria ) {
                if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                    userPanelState.criteria[ searchCriteriaKey ] = _.clone( additionalSearchCriteria[ searchCriteriaKey ] );
                }
            }
        }
    }

    // Set this flag so that it can be used in panel so other child component will
    // not be loaded until this flag set to true.
    userPanelState.isDataInit = true;
    return {
        userPanelState: userPanelState,
        isDataInit: true
    };
};

/**
 * Get the valid users that from input user objects and return the promise.
 *
 * @param {Array} selectedUsers Selected users from UI
 * @param {Object} userPanelState User panel state object
 * @returns {Promise} Valid user objects that will be added
 */
export let getSelectedUsers = function( selectedUsers, userPanelState ) {
    var deferred = AwPromiseService.instance.defer();
    if( userPanelState ) {
        exports.getValidObjectsToAdd( userPanelState.criteria, selectedUsers ).then( function( validObjects ) {
            deferred.resolve( validObjects );
        } );
    } else {
        deferred.resolve( [] );
    }
    return deferred.promise;
};

/**
 * Utility method to get the initial selection Uid string.
 *
 * @param {String} selectedUid Initial selection Uid
 * @returns {String} Initial selection Uid string
 */
export const cacheSelection = selectedUid => {
    return selectedUid;
};

/**
 * Utility method to get the initial selection Uid string array along with selection count.
 *
 * @param {Array} selection Initial selection array
 * @returns {Object} Initial selection Uid string array along with selection count.
 */
export let cacheMultiSelection = function( selection ) {
    if( !selection || selection.length <= 0 ) {
        return {
            selectedObjectUids : [],
            selectionCount : 0
        };
    }
    var selectionUids = [];
    _.forEach( selection, function( selObj ) {
        if( selObj && selObj.uid ) {
            selectionUids.push( selObj.uid );
        }
    } );

    return {
        selectedObjectUids : selectionUids,
        selectionCount : selectionUids.length
    };
};

/**
 * Get the selected object from UI either object is opened or selected from PWA.
 * @param {Object} selectedObject Selected object from primary work area
 * @param {Object} openedObject Open object
 * @returns {Object} Selected object from UI.
 */
export let getSelectedValidObject = function( selectedObject, openedObject ) {
    return selectedObject ? selectedObject : openedObject;
};

/**
 * Update the input user panel state based on view mode. If view mode is mobile then we
 * need to set isAddButtonNeeded to true so that we can show add button in narrow mode.
 *
 * @param {String} sideNavMode Side nav mode string
 * @param {Object} addUserPanelState User panel state object
 * @returns {Object} Updated user panel state object.
 */
export let updateSideNavUserPanelState = function( sideNavMode, addUserPanelState ) {
    if( sideNavMode && addUserPanelState ) {
        const userPanelState = { ...addUserPanelState };
        let isAddButtonNeeded = false;
        if( sideNavMode === 'mobile' ) {
            isAddButtonNeeded = true;
        }
        userPanelState.isAddButtonNeeded = isAddButtonNeeded;
        // Reset the propName to empty string when we are chaing the sideNavMode
        userPanelState.propName = '';
        return userPanelState;
    }
    return addUserPanelState;
};

/**
 * Update the selected process on XRT state so that object set table and other components on
 * workflow page can show the correct details.
 *
 * @param {Object} xrtState XRT state where process info need to be updated
 * @param {Object} selectedProcess selected process that need to be updated
 * @param {boolean} isUpdateCase True/False based on this is update case for workflow page or not.
 */
export let updateCustomContextXRTState = function( xrtState, selectedProcess, isUpdateCase ) {
    // Check if input model object is empty then no need to process further and return from here
    if( typeof selectedProcess === typeof undefined || !xrtState ) {
        return;
    }
    // Update the information with selected process on xrtState and this will be used to update the signoff table
    var processObject = selectedProcess;
    if( processObject.uid ) {
        processObject = processObject.uid;
    }
    let newXrtState = { ...xrtState.getValue() };
    // Check if there is already customContext info present then get that and update
    // only selectedProcess attribute on that so that other component can refresh
    var context = { ...newXrtState.customContext };

    // Get the VMO object for XRT being rendered
    var xrtVMOObject = xrtState.xrtVMO;

    context.selectedProcess = processObject;
    newXrtState.customContext = context;
    xrtState.update && xrtState.update( newXrtState );

    // Check if this is update case where based on user interaction we need to update workflow page then we need to use
    // xrtState.xrtVMO object and fire the cdm.relatedModified event with that object so that it can update the signoff table.
    if( isUpdateCase && xrtVMOObject ) {
        eventBus.publish( 'cdm.relatedModified',  {
            relatedModified: [ xrtVMOObject ]
        } );
    }
};

/**
 * Update the people picker search criteria based on selected target object uid to show people based
 * on project.
 *
 * @param {Object} userPanelContext User panel state context object where criteria need to be updated
 * @param {Object} criteriaObject Contains the keys that need to be updated in search criteria
 * @param {Object} signoffProfile Get the group and role from the profile associated with the selected signoff
 * @param {Object} criteria contains the basic criteria needed to list users in people picker
 */
export let updateUserPanelSearchStateCriteria = function( userPanelContext, criteriaObject, signoffProfile, criteria ) {
    let newAtomicObj = { ...userPanelContext.value };
    //Check if signoff profile is available
    //Get the group and role from profile associated with selected signoff
    if( signoffProfile && signoffProfile.uid && signoffProfile.additionalSearchCriteria ) {
        newAtomicObj.criteria = signoffProfile.additionalSearchCriteria;
    }
    //Check if object associated with criteria is available and add it
    if( userPanelContext && criteriaObject ) {
        for( const key of Object.keys( criteriaObject ) ) {
            if( criteriaObject[ key ] ) {
                newAtomicObj.criteria[ key ] = criteriaObject[ key ];
            }
        }
    }
    //Basic criteria which is need to list the users is added to criteria
    for( var searchCriteriaKey in criteria ) {
        if( criteria.hasOwnProperty( searchCriteriaKey ) ) {
            newAtomicObj.criteria[ searchCriteriaKey ] = _.clone( criteria[ searchCriteriaKey ] );
        }
    }
    //Update user panel search state criteria
    userPanelContext.update && userPanelContext.update( newAtomicObj );
};

/**
 * This method is specifically for check when cdm.relatedModifeid event got triggered and
 * refreshLocationFlag is set to true. Then do additional check if input object is present
 * in modified object then return true else return false.
 * Based on this decision we can reload the HTML panel like workflow page, future task table etc.
 *
 * @param {Object} eventData Event data object that will contain all related modified objects.
 * @param {Object} selectedObjects Selection objects array that need to be check if updated or not.
 * @returns {boolean} True/False.
 */
export let isRefreshLocationNeeded = function( eventData, selectedObjects ) {
    // Check if eventData is not valid or refreshLocationFlag is set to false or base selection
    // is not valid then no need to process further and return from here.
    if( !eventData || !eventData.refreshLocationFlag || !selectedObjects || _.isEmpty( selectedObjects )  || !selectedObjects[0] ) {
        return false;
    }

    //Remove undefined object from selectedObjects if Any.
    selectedObjects = selectedObjects.filter( function( element ) {
        return element !== undefined;
    } );

    // Check if input selection is present in relatedModified object array.
    let result = eventData.relatedModified.filter(
        object1 => selectedObjects.some(
            object2 => object1.uid === object2.uid )
    );


    let relatedModified = false;
    // Check if refreshLocationFlag is true and match list is not empty then return true
    if( eventData.refreshLocationFlag && result ) {
        relatedModified = true;
    }
    return relatedModified;
};

/**
 * Function to restrict multi selection between section in task assignment panel in assignments tab
 * @param {*} assignerModel 
 * @param {*} reviewersModel 
 * @param {*} adhocModel 
 * @param {*} acknowledgersModel 
 * @param {*} notifyeesModel 
 * @param {Object} data  - respective view model data
 */
export let setActiveSelection = function (assignerModel, reviewersModel, adhocModel, acknowledgersModel, notifyeesModel, data) {
    if (data.eventData && data.eventData.selected.length > 0) {
        const models = [
            { model: assignerModel, active: data.eventData.dataProviderName === "assignerDataProvider" },
            { model: reviewersModel, active: data.eventData.dataProviderName === "reviewersDataProvider" },
            { model: adhocModel, active: data.eventData.dataProviderName === "adhocReviewersDataProvider" },
            { model: acknowledgersModel, active: data.eventData.dataProviderName === "acknowledgersDataProvider" },
            { model: notifyeesModel, active: data.eventData.dataProviderName === "notifyeesDataProvider" }
        ];
        models.forEach(({ model, active }) => {
            if (!active) {
                model.setSelection([]);
            }
        });
    }
};

export default exports = {
    getValidObjectsToAdd,
    getTaskFlowBasedIcon,
    getPropTrimValue,
    getStartFinishNodeCategory,
    getFilterValuesSearchCriteria,
    populatePanelContextData,
    populatePeopleSearchCriteriaContextData,
    getSelectedUsers,
    cacheSelection,
    cacheMultiSelection,
    getSelectedValidObject,
    updateSideNavUserPanelState,
    updateCustomContextXRTState,
    updateUserPanelSearchStateCriteria,
    isRefreshLocationNeeded,
    setActiveSelection
};
