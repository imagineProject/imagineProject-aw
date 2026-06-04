// Copyright (c) 2022 Siemens

/**
 * ObjectSet service is used to calculate the height of objectSet based on max row count. This service is only
 * applicable for XRT objectSet.
 * <P>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/xrtObjectSetService
 */
import _ from 'lodash';
import appCtxService from 'js/appCtxService';
import awConfiguredSvc from 'js/awConfiguredRevService';
import clientDataModel from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import { getAdaptedObjectsSync } from 'js/adapterService';
import pasteSvc from 'js/pasteService';
import eventBus from 'js/eventBus';
import messagingSvc from 'js/messagingService';
import localeService from 'js/localeService';

let exports = {};
const OBJSET_MIN_HEIGHT = 75;
const OBJSET_BUFFER_HEIGHT = 75;
const OBJSET_DEFAULT_HEIGHT = 500;
const OBJECT_SET_VIEWMODE_CONTEXT = 'objectSetViewModeContext';
const PSEUDO_FOLDER = 'PseudoFolder';
const CDM_RELATED_MODIFIED = 'cdm.relatedModified';

/**
 * Get row data count
 *
 * @private
 *
 * @param {Object} objSetData - objectSet data
 * @param {String} activeDisplay - the current display mode
 * @param {Object[]} columns - the columns
 * @param {Number} totalLoaded - the total loaded vmos
 * @return {Number} - row data count
 */
const _getRowDataCount = function( objSetData, activeDisplay, columns, totalLoaded ) {
    let count = 0;
    if( activeDisplay && activeDisplay.value === 'compareDisplay' ) {
        count = columns.length + 1;
    } else {
        count = totalLoaded;
    }
    return count;
};

/**
 * Set max rows as 7 and half by default when 'maxRowCount' is not provided as part of XRT
 *
 * @private
 *
 * @return {Number} - max number of rows
 */
const _getMaxRows = function() {
    return 15;
};

/**
 * @private
 * @param {Object} activeDisplay - the current display mode
 * @return {Number} - returns calculated row height.
 */
const _getHeight = ( activeDisplay ) => {
    // Table Display -- Compact: 25px per row, Comfy: 33px per row
    let height = appCtxService.getCtx( 'layout' ) === 'compact' ? 25 : 33;
    if( activeDisplay?.value === 'listDisplay' ) {
        // each cell height for list display is 70px
        height = 70;
    } else if( activeDisplay?.value === 'thumbnailDisplay' ) {
        // each cell height for list display is 215px
        height = 215;
    }

    return height;
};

/**
 * @private
 *
 * @param {Number} dataCount - the data count
 * @param {Number} maxRowCount - maximum row count visible.
 * @param {Object} activeDisplay - the current display mode
 *
 * @return {Number} - returns calculated array height based of max row count.
 */
const _getCollectionHeight = function( dataCount, maxRowCount, activeDisplay ) {
    let arrayHeight = 0;
    let rowsShown = 0;

    // if the actual # of rows exceeds the max, size based on the max
    if( dataCount >= maxRowCount ) {
        rowsShown = maxRowCount;
    } else {
        // size based on the actual data + 1
        rowsShown = dataCount + 1;
    }

    /**
     * Replicating same logic as GWT. Estimating 33px per row. Depends on other styling though. mainly depends on
     * icon being 22 by 22. 22 for header + 8 for padding = 30 + part of next line (12) = 42 <br>
     */
    arrayHeight = rowsShown * _getHeight( activeDisplay ) + 42;

    // this is needed for default objectSet height
    if( rowsShown === 1 && arrayHeight === 0 ) {
        arrayHeight = 50;
    }

    return arrayHeight;
};

/**
 * Calculate object set height
 *
 * @param {String} display - display mode
 * @param {Object} objSetData - Object Set Data
 * @param {Object} columns - Object Set columns
 * @param {Number} totalLoaded - Total Loaded.
 * @param {Object} objectSetRef - The Object Set reference
 * @return {Number} - returns calculated objectSet height based of max row count.
 */
export const calculateObjectsetHeight = function( display, objSetData, columns, totalLoaded, objectSetRef ) {
    let objectSetHeight = 0;

    if( objSetData ) {
        // Below is a temporary fix for D-03820
        // if XRT's maxRowCount attribute is NOT given, then calculate number of objectSets present inside a column
        // and then set the height of the table and list accordingly
        const walkerObjSetElement = objectSetRef?.current;
        const objSetRowCount = _getRowDataCount( objSetData, display, columns, totalLoaded );
        if( objSetData.smartObjSet && walkerObjSetElement ) {
            //TODO - We need a way to get the element and set the actual remaining height.
            //TODO revisitme - Nihar/Brad - Find better way of getting the correct smart objectset height. Hard coded now to prevent issues
            // Set the objSet height to the available space in the window minus the command bar height and the buffer area from the bottom(Example: User Session Bar)
            objectSetHeight = window.innerHeight - OBJSET_BUFFER_HEIGHT - Math.floor( walkerObjSetElement.getBoundingClientRect().top );
            if( objectSetHeight <= OBJSET_MIN_HEIGHT ) {
                // Adjust the minimum height to 500 if it falls below the predefined minimum height
                objectSetHeight = OBJSET_DEFAULT_HEIGHT;
            }
        } else if( !objSetData.maxRowCount ) {
            let maxRows = _getMaxRows(); // getMaxRows defaults to returning 7
            // Setting height of objectSet table widget
            objectSetHeight = _getCollectionHeight( objSetRowCount, maxRows, display );
        } else {
            // if XRT's maxRowCount attribute is given, then set the height of objectSet (common for both table and list).
            // Setting height of objectSet
            objectSetHeight = _getCollectionHeight( objSetRowCount, objSetData.maxRowCount, display );
        }
    }

    return objectSetHeight;
};

/**
 * Parse object set source string into map of object type string to an array of relation type strings
 *
 * @param {String} objectSetSource - Comma separated string of relationType.ObjectType combinations
 * @return {Object} Map of Object to relation type list
 */
export const getModelTypeRelationListMap = function( objectSetSource ) {
    let modelTypeRelationListMap = {};
    let objectSetSourceArray = objectSetSource.split( ',' );
    if( objectSetSourceArray.length > 0 ) {
        _.forEach( objectSetSourceArray, function( typeRelCombo ) {
            let typeRelSplit = typeRelCombo.split( '.' );
            if( typeRelSplit.length === 2 ) {
                let relationType = typeRelSplit[ 0 ].trim();
                let objectType = typeRelSplit[ 1 ].trim();
                if( !_.isArray( modelTypeRelationListMap[ objectType ] ) ) {
                    modelTypeRelationListMap[ objectType ] = [];
                }
                modelTypeRelationListMap[ objectType ].push( relationType );
            } else if( typeRelSplit.length === 1 ) {
                if( !_.isArray( modelTypeRelationListMap[ '' ] ) ) {
                    modelTypeRelationListMap[ '' ] = [];
                }
                modelTypeRelationListMap[ '' ].push( typeRelSplit[ 0 ].trim() );
            }
        } );
    }
    return modelTypeRelationListMap;
};

const getDefaultRelationForSourceObjects = ( sourceObjects, targetType ) => {
    let soaInput = [];

    for( const sourceObject of sourceObjects ) {
        soaInput.push( {
            primaryType: targetType,
            secondaryType: sourceObject.type
        } );
    }
    return soaSvc.postUnchecked( 'Internal-AWS2-2016-12-DataManagement', 'getDefaultRelation', {
        input: soaInput
    } );
};

/**
 * Finds the relationType and any associated source objects valid to that type.
 *
 * @param {Object[]} sourceObjects - source objects used to compare relations
 * @param {Object} modelTypeRelations - valid model type relations
 * @param {String} showConfiguredRevision - flag indicating whether configured revision capability is toggled on
 * @param {String} primaryType - object type of the target/primary object
 * @return {Object} object containing relationType and valid source objects
 */
export const getModelTypeRelationsWithValidSourceObjects = async function( sourceObjects, modelTypeRelations, showConfiguredRevision, primaryType ) {
    let modelTypeRelationObject = {};
    modelTypeRelationObject.relationTypeToSources = {};
    modelTypeRelationObject.validSourceObjects = [];

    if( !sourceObjects || sourceObjects.length === 0 || !modelTypeRelations ) {
        return modelTypeRelationObject;
    }

    if( showConfiguredRevision === 'true' ) {
        const evalObjs = awConfiguredSvc.evaluateObjsConfRevRuleObjectsetPaste( sourceObjects, modelTypeRelations, showConfiguredRevision );
        sourceObjects = Array.from( evalObjs );
    }

    // get default relation for primary-secondary pairs for all source objects from server
    const defaultRelationForSourceObjects = primaryType && await getDefaultRelationForSourceObjects( sourceObjects, primaryType );

    for( let i = 0; i < sourceObjects.length; i++ ) {
        const sourceObject = sourceObjects[i];
        let typeHierarchy = sourceObject.modelType.typeHierarchyArray;

        for( const type of typeHierarchy ) {
            // If any type in the typeHierarchy is present in the modelTypeRelations
            // only then the source object can be pasted on the objectset
            if( modelTypeRelations[ type ] ) {
                let relationType = '';
                const defaultRelation = defaultRelationForSourceObjects?.output[i]?.defaultRelation.name;
                // if modelTypeRelations for the objectset includes the default type
                // then use that relation, else pick the first from the valid type list
                if( defaultRelation && modelTypeRelations[ type ].includes( defaultRelation ) ) {
                    relationType = defaultRelation;
                } else {
                    relationType = modelTypeRelations[ type ][0];
                }

                modelTypeRelationObject.relationTypeToSources[ relationType ] = modelTypeRelationObject.relationTypeToSources[ relationType ] || [];
                modelTypeRelationObject.relationTypeToSources[ relationType ].push( sourceObject );
                modelTypeRelationObject.validSourceObjects.push( sourceObject );
                break;
            }
        }
    }
    return modelTypeRelationObject;
};

/**
 * Sets the display mode in command context
 *
 * @param {Object} commandContext - Command context
 * @param {String} displayMode - Display mode
 * @return {Object} Map of Object to relation type list
 */
export const updateObjectSetViewMode = function( currentDisplay, displayMode, objectSetSource ) {
    if ( objectSetSource ) {
        const simplifiedSource = objectSetSource.replace( /[^A-Z0-9]/ig, '_' );
        var objectSetViewModeContext = appCtxService.getCtx( OBJECT_SET_VIEWMODE_CONTEXT );
        if( !objectSetViewModeContext ) {
            objectSetViewModeContext = {};
        }
        objectSetViewModeContext[ simplifiedSource ] = displayMode;
        appCtxService.registerCtx( OBJECT_SET_VIEWMODE_CONTEXT, objectSetViewModeContext );
    }
    currentDisplay.update( { activeDisplay: displayMode } );
};

export const getTargetObjectForPseudoFolder = function( selectedPseudoFolder ) {
    if( !viewModelObjectSvc.isViewModelObject( selectedPseudoFolder ) && selectedPseudoFolder.uid === undefined ) {
        selectedPseudoFolder = selectedPseudoFolder.selected ? selectedPseudoFolder.selected[0] : selectedPseudoFolder.vmo;
    }
    let targetObjectForPseudoFolder = {};
    let pseudoFolderUid = selectedPseudoFolder.uid;
    if( selectedPseudoFolder && selectedPseudoFolder.props ) {
        if( selectedPseudoFolder.props.owning_object ) {
            pseudoFolderUid = selectedPseudoFolder.props.owning_object.dbValue ? selectedPseudoFolder.props.owning_object.dbValue :
                selectedPseudoFolder.props.owning_object.dbValues[ 0 ];
        } else if( selectedPseudoFolder.props.awp0Primary ) {
            pseudoFolderUid = selectedPseudoFolder.props.awp0Primary.dbValue ? selectedPseudoFolder.props.awp0Primary.dbValue :
                selectedPseudoFolder.props.awp0Primary.dbValues[ 0 ];
        }
    }
    if( clientDataModel.isValidObjectUid( pseudoFolderUid ) ) {
        targetObjectForPseudoFolder = viewModelObjectSvc.createViewModelObject( clientDataModel
            .getObject( pseudoFolderUid ) );
    }
    return {
        targetObjectForPseudoFolder: targetObjectForPseudoFolder,
        relationType: selectedPseudoFolder.uid.split( ':' ).pop()
    };
};

export const pasteOnObjectSet = async function( awClipBoardProvider, selectedObj, commandContext ) {
    const sourceObjects = getAdaptedObjectOfSelected( awClipBoardProvider );
    if( commandContext.selectionModel?.selectionData?.selected?.length === 1 &&
        awClipBoardProvider.length > 0 && !( selectedObj && selectedObj.type === 'Awp0Folders' ) ) {
        let selectedObject = commandContext.selectionModel.selectionData.selected[ 0 ];
        let adaptedObjs = getAdaptedObjectOfSelected( selectedObject );
        if( adaptedObjs[0].type !== PSEUDO_FOLDER ) {
            executePasteService( selectedObj, sourceObjects, '', selectedObj, commandContext );
        } else if( adaptedObjs[0].type === PSEUDO_FOLDER ) {
            const selectedPseudoFolders = getAdaptedObjectOfSelected( commandContext.selectionModel.selectionData.selected[0] );
            const targetObjectResponse = getTargetObjectForPseudoFolder( selectedPseudoFolders[0] );
            executePasteService( targetObjectResponse.targetObjectForPseudoFolder, sourceObjects, targetObjectResponse.relationType,
                commandContext.selectionModel.selectionData.selected[0], commandContext );
        }
    } else if( commandContext.selectionModel?.selectionData?.selected === undefined || commandContext.selectionModel?.selectionData?.selected === null ||
        commandContext.selectionModel?.selectionData?.selected.length === 0 ) {
        const adaptedVmoArr = getAdaptedObjectOfSelected( commandContext.vmo );
        if( adaptedVmoArr[0].type === PSEUDO_FOLDER ) {
            const targetObjectResponse = getTargetObjectForPseudoFolder( adaptedVmoArr[0] );
            let impactedObject = clientDataModel.getObject( adaptedVmoArr[0].props.owning_object.dbValues[0] );
            return executePasteService( targetObjectResponse.targetObjectForPseudoFolder, sourceObjects, targetObjectResponse.relationType,
                impactedObject, commandContext );
        }
        const modelTypeRelationObject = await getModelTypeRelationsWithValidSourceObjects( sourceObjects, commandContext.modelTypeRelationListMap,
            commandContext.searchCriteria.showConfiguredRev, adaptedVmoArr[0].type );
        executePasteServiceWithMultipleRelations( adaptedVmoArr, modelTypeRelationObject );
    }
};

const executePasteService = function( targetObject, sourceObjects, relationType, selectedObject, commandContext ) {
    pasteSvc.execute( targetObject, sourceObjects, relationType, commandContext ).then( function( response ) {
        showSuccessMessage( sourceObjects, targetObject );
        eventBus.publish( CDM_RELATED_MODIFIED, {
            relatedModified: [ selectedObject ],
            createdObjects: sourceObjects
        } );
    }, function( error ) {
        handlePasteError( error, selectedObject, sourceObjects );
    } );
};

const executePasteServiceWithMultipleRelations = function( adaptedVmoArr, modelTypeRelationObject ) {
    pasteSvc.executeWithMultipleRelations( adaptedVmoArr[0], modelTypeRelationObject.relationTypeToSources ).then( function( response ) {
        eventBus.publish( CDM_RELATED_MODIFIED, {
            relatedModified: adaptedVmoArr,
            createdObjects: modelTypeRelationObject.validSourceObjects
        } );
        showSuccessMessage( modelTypeRelationObject.validSourceObjects, adaptedVmoArr[0] );
    }, function( error ) {
        handlePasteError( error, adaptedVmoArr[0], modelTypeRelationObject.validSourceObjects );
    } );
};

const showSuccessMessage = function( sourceObjects, targetObject ) {
    const localTextBundle = localeService.getLoadedText( 'ZeroCompileCommandMessages' );
    if( sourceObjects.length === 1 ) {
        let pasteSuccessMessage = localTextBundle.pasteSuccessMessage;
        pasteSuccessMessage = pasteSuccessMessage.replace( '{0}', sourceObjects[0].props.object_string.uiValues[0] );
        pasteSuccessMessage = pasteSuccessMessage.replace( '{1}', targetObject.props.object_string.uiValues[0] );
        messagingSvc.showInfo( pasteSuccessMessage );
    } else if( sourceObjects.length > 1 ) {
        let pasteMultipleSuccessMessage = localTextBundle.pasteMultipleSuccessMessage;
        pasteMultipleSuccessMessage = pasteMultipleSuccessMessage.replace( '{0}', sourceObjects.length );
        pasteMultipleSuccessMessage = pasteMultipleSuccessMessage.replace( '{1}', targetObject.props.object_string.uiValues[0] );
        messagingSvc.showInfo( pasteMultipleSuccessMessage );
    }
};

const handlePasteError = function( error, selectedObject, sourceObjects ) {
    let refresh = false;
    if( error?.cause?.partialErrors ) {
        if( error.cause.partialErrors.length < sourceObjects.length ) {
            refresh = true;
        } else {
            for( let partialError of error.cause.partialErrors ) {
                if( partialError.errorValues ) {
                    for( let errorValue of partialError.errorValues ) {
                        if( errorValue.code === 6007 || errorValue.code === 35010 || errorValue.code === 89009 ) {
                            refresh = true;
                        }
                    }
                }
            }
        }
        if( refresh ) {
            eventBus.publish( CDM_RELATED_MODIFIED, {
                relatedModified: [ selectedObject ],
                createdObjects: sourceObjects
            } );
            return;
        }
    }
};

const getAdaptedObjectOfSelected = function( selectedObject ) {
    var objectsToAdapt = _.isArray( selectedObject ) ? selectedObject : [ selectedObject ];
    let adaptedObjArr = getAdaptedObjectsSync( objectsToAdapt );
    if( adaptedObjArr && adaptedObjArr.length > 0 ) {
        return adaptedObjArr;
    }
    return objectsToAdapt;
};

export default exports = {
    calculateObjectsetHeight,
    getModelTypeRelationListMap,
    getModelTypeRelationsWithValidSourceObjects,
    updateObjectSetViewMode,
    getTargetObjectForPseudoFolder,
    pasteOnObjectSet
};
