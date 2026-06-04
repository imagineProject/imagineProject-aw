// Copyright (c) 2022 Siemens

/**
 * Impact Analysis Service
 * @module js/Pma1ImpactAnalysisService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awIconSvc from 'js/awIconService';
import AwStateService from 'js/awStateService';
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';
import CadBomOccurrenceAlignmentService from 'js/CadBomOccurrenceAlignmentService';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaConstants from 'js/cbaConstants';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cdmSvc from 'soa/kernel/clientDataModel';
import vmcs from 'js/viewModelObjectService';
import aceNavigationService from 'js/aceNavigationService';
import occmgmtUtils from 'js/occmgmtUtils';
import dmSvc from 'soa/dataManagementService';
import uwPropertyService from 'js/uwPropertyService';
import cbaFindAlignedService from 'js/cbaFindAlignedService';
import soaService from 'soa/kernel/soaService';
import LocationNavigationService from 'js/locationNavigation.service';
import cbaRedLineService from 'js/cbaRedLineService';
import cbaSelectionService from 'js/cbaSelectionService';
import cbaOpenInViewPanelService from 'js/cbaOpenInViewPanelService';
import eventBus from 'js/eventBus';
import CBAImpactAnalysisService from 'js/CBAImpactAnalysisService';
import cbaFocusService from 'js/cbaFocusService';

// List of tiles which will be hidden in Guided Update panel.
const hiddenSummaryTiles = [ 'k_pma0_action_realign', 'k_pma0_action_unalign', 'k_pma0_action_context' ];
Object.freeze( hiddenSummaryTiles );

/**
    * This method redirects the user from the Notification message to the appropriate subLocation location based on eventtype_id.
    * @param {Object} notificationObject the Notification clicked on
    */
export const openBOMNotification = function( notificationObject ) {
    let eventTypeId;
    if( notificationObject.eventObj ) {
        eventTypeId = notificationObject.eventObj.props.eventtype_id.dbValues[ 0 ];
    }

    if( eventTypeId === 'Pma1BOMGenerationSuccess' || eventTypeId === 'Pma1BOMUpdateSuccess' ) {
        CadBomOccAlignmentCheckService.openCBANotification( notificationObject );
    } else {
        redirectToShowObject( notificationObject );
    }
};

/**
    * Opens the notification object on notification message click in xrt show object sublocation
    * @param {Object} notificationObject the Notification clicked on
    */
const redirectToShowObject = function( notificationObject ) {
    if( notificationObject && notificationObject.object.uid ) {
        const showObject = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
        var toParams = {};
        var options = {};

        toParams.uid = notificationObject.object.uid;
        options.inherit = false;

        AwStateService.instance.go( showObject, toParams, options );
    }
};

const createViewModelObject = function( itemId, uid, name, type ) {
    const typeHierarchy = [ type ];
    const imageUrl = awIconSvc.getTypeIconFileUrlForTypeHierarchy( typeHierarchy );
    return {
        uid: uid,
        cellHeader1: name,
        cellHeader2: itemId,
        type: type,
        cellProperties: {
            Revision : {
                key : 'Revision',
                value : 'A'
            }
        },
        typeIconURL : imageUrl
    };
};

/**
 *  Get View Model Object list from Model Object list
 *
 * @param { object } modelObjects Model Object List
 * @returns { Array } View Model Object list
 */
const _getVMOs = function( modelObjects ) {
    const vmos = [];
    if( modelObjects ) {
        modelObjects.forEach( modelObject => {
            vmos.push( vmcs.constructViewModelObjectFromModelObject( modelObject, 'edit', null, null, false ) );
        } );
    }
    return vmos;
};

/**
 * Get source View Model Object list
 *
 * @param {Object} updateEntry - SOA input update entry
 * @returns { Array } View Model Object list
 */
const _getSourceVMOs = function( updateEntry ) {
    if( updateEntry ) {
        if( updateEntry.modifiedSourceRevs ) {
            return _getVMOs( updateEntry.modifiedSourceRevs );
        }
        return _getVMOs( [ updateEntry.modifiedSourceRev ] );
    }
    return [];
};

/**
 *  Get target View Model Object from Model Object
 *
 * @param { object } alignedTargetRev Model Object
 * @param { boolean } isSourceDesign true if Source is Design
 * @param { object } i18n i18n object
 * @returns { object } View Model Object
 */
const _getTargetVMO = function( alignedTargetRev, isSourceDesign, i18n, overriddenPart ) {
    let trgVmo;
    if( alignedTargetRev && cdmSvc.isValidObjectUid( alignedTargetRev.uid ) ) {
        trgVmo = vmcs.constructViewModelObjectFromModelObject( alignedTargetRev, 'edit', null, null, false );
    } else{
        if( isSourceDesign ) {
            const partId = overriddenPart || i18n.NewPartID;
            const partName = i18n.NewPart;

            trgVmo = createViewModelObject( partId, 'AAAAAAAAAAAAAA', partName, 'Part Revision' );
        } else {
            trgVmo = createViewModelObject( i18n.NewDesignID, 'AAAAAAAAAAAAAA', i18n.NewDesign, 'Design Revision' );
        }
    }
    return trgVmo;
};

/**
 * Get target View Model Object list
 *
 * @param {*} updateEntry - SOA input update entry
 * @param { boolean } isSourceDesign true if Source is Design
 * @param {*} i18n i18n object
 * @returns { Array } View Model Object list
 */
const _getTargetVMOs = function( updateEntry, isSourceDesign, i18n ) {
    if ( !updateEntry ) { return []; }

    let trgVmos = [];
    //Check if the part number is overridden
    //If propertyInfo is having information about associated part number, then it is overridden
    let overriddenPart = null;
    if ( updateEntry?.propertyInfo?.length ) {
        for( let index = 0; index < updateEntry.propertyInfo.length; index++ ) {
            //Note : When design is replaced with another design which is holding as assigned part Id,then we get propertyInfo for object_item_id
            //If propertyInfo is having object_item_id and update action is replace, then alignedTargetRevs should be null
            if( updateEntry.propertyInfo[index]?.propInternalName === 'object_item_id' ) {
                if( updateEntry.possibleUpdateActions[0].internalValue === 'k_pma0_action_replace' ) {
                    updateEntry.alignedTargetRevs = null;
                    updateEntry.alignedTargetRev = null;
                }

                overriddenPart  = updateEntry.propertyInfo[index].currentDBValue;
                break;
            }
        }
    }
    const alignedTargetRevs = updateEntry.alignedTargetRevs || [ updateEntry.alignedTargetRev ];
    alignedTargetRevs.forEach( alignedTargetRev => {
        trgVmos.push( _getTargetVMO( alignedTargetRev, isSourceDesign, i18n, overriddenPart ) );
    } );
    return trgVmos;
};

/**
 * Get property info object to send to tile
 *
 * @param { object } propertyInfo propertyCahnegInfo object from server response
 * @param { boolean } isTarget true if property info needed for target side of tile
 * @returns { object } Property info object
 */
const _getUIPropertyInfo = function( propertyInfo, isTarget ) {
    let uiPropertyInfo = propertyInfo ? {} : null;

    if( uiPropertyInfo ) {
        uiPropertyInfo.propInternalName = propertyInfo.propInternalName;
        uiPropertyInfo.propDisplayName = propertyInfo.propDisplayName;
        uiPropertyInfo.currentDBValue = propertyInfo.currentDBValue;
        uiPropertyInfo.currentUIValue = propertyInfo.currentUIValue;
        if( isTarget ) {
            uiPropertyInfo.oldDBValue = propertyInfo.oldDBValue;
            uiPropertyInfo.oldUIValue = propertyInfo.oldUIValue;
        }
    }
    return uiPropertyInfo;
};

/**
    * API to generate summary model which is directly binded to update panel tile
    * @param {Object} updateEntry - SOA input update entry
    * @param {Object} i18n - i18n
    * @param {Object} tileIndex - tile index
    * @return {Object} returns summary model
    */
const getSummaryModel = function( updateEntry, i18n, tileIndex ) {
    // prepare source view model object and instances
    const srcVmos = _getSourceVMOs( updateEntry ); // For SOA : getUpdateActionsSummary2

    let objQualifierType = cbaObjectTypeService.getObjectQualifierType( srcVmos[0] );
    let isDesign = objQualifierType === 'Design';

    let srcInstances = [];
    if( updateEntry?.modifiedSourceOccurrences && updateEntry.modifiedSourceOccurrences.length > 0 ) {
        srcInstances = updateEntry.modifiedSourceOccurrences;
    }
    // prepare target view model object and instances

    const trgVmos  = _getTargetVMOs( updateEntry, isDesign, i18n );
    let trgInstances = [];

    if( updateEntry?.alignedTargetOccurrences && updateEntry.alignedTargetOccurrences.length > 0 ) {
        trgInstances = updateEntry.alignedTargetOccurrences;
    }
    // compute model for update actions
    const updateActionValues = [];
    _.forEach( updateEntry?.possibleUpdateActions, function( action ) {
        updateActionValues.push( {
            propDisplayValue: action.displayValue,
            propInternalValue: action.internalValue
        } );
    } );

    // Get source and target property chnages
    const sourcePropertyInfos = [];
    const targetPropertyInfos = [];
    let nameRevisionInfo;

    if( !_.isEmpty( updateActionValues ) ) {
        // Remove tile element name should be shown as strike out
        if( updateActionValues[ 0 ].propInternalValue === 'k_pma0_action_remove' ) {
            nameRevisionInfo = {};
            if( !_.isEmpty( trgVmos ) ) {
                for( const trgVmo of trgVmos ) {
                    nameRevisionInfo[trgVmo?.uid] = { target : { oldName: trgVmo?.cellHeader1 } };
                }
            }
            if( !_.isEmpty( srcVmos ) ) {
                for( const srcVmo of srcVmos ) {
                    nameRevisionInfo[srcVmo?.uid] = { source : { oldName: srcVmo?.cellHeader1 } };
                }
            }
        }

        if( updateActionValues[ 0 ].propInternalValue === 'k_pma0_action_new' ) {
            nameRevisionInfo = {};
            if( !_.isEmpty( trgVmos ) ) {
                for( const trgVmo of trgVmos ) {
                    nameRevisionInfo[trgVmo?.uid] = { target : { newName: trgVmo?.cellHeader1 } };
                }
            }
            if( !_.isEmpty( srcVmos ) ) {
                for( const srcVmo of srcVmos ) {
                    nameRevisionInfo[srcVmo?.uid] = { source : { newName: srcVmo?.cellHeader1 } };
                }
            }
        }
    }

    if( updateEntry?.propertyInfo ) {
        for( let index = 0; index < updateEntry.propertyInfo.length; index++ ) {
            // Assumption: There will be propertyInfos related to only one property
            // First propertyInfo object will be for target
            // Second onwards all propertyInfo will be for source
            const propertyInfo = updateEntry.propertyInfo[ index ];
            // If propertyinfo has 'name' as property changed then this is case of replaced

            if( index === 0 ) {
                if( propertyInfo.propInternalName === 'object_name' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};

                    let newName = propertyInfo.currentDBValue;
                    if( !propertyInfo.currentDBValue ) {
                        newName = isDesign ? i18n.NewPart : i18n.NewDesign;
                    }
                    for( const trgVmo of trgVmos ) {
                        nameRevisionInfo[trgVmo.uid] = { target : {
                            oldName: propertyInfo.oldDBValue,
                            newName: newName
                        } };
                    }
                    for( const srcVmo of srcVmos ) {
                        nameRevisionInfo[srcVmo.uid] = { source : {
                            oldName: propertyInfo.oldDBValue,
                            newName: propertyInfo.currentDBValue || srcVmo.cellHeader1
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'item_revision_id' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    for( const trgVmo of trgVmos ) {
                        nameRevisionInfo[trgVmo.uid] = { target : {
                            oldRevision: propertyInfo.oldDBValue,
                            newRevision: propertyInfo.currentDBValue
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'object_item_id' ) {
                    targetPropertyInfos.push( null );
                }else if( propertyInfo.propInternalName === 'src_object_name' ) {
                    //LCS-1189029 - Tc2506_REG: Incorrect design name seen on source side in guided update panel.
                    //When design is replaced with another design which is holding an aligned part then we get the new name as aligned part for target
                    //So we need to show the new name as aligned part for target only for source we will show the new name from modifiedSourceRevs
                    let isReplaceTileHavingModifiedSrcRev = updateActionValues[ 0 ]?.propInternalValue === 'k_pma0_action_replace' && updateEntry.modifiedSourceRevs;

                    let modifiedSourceRev = cdmSvc.getObject( updateEntry.modifiedSourceRevs[0].uid );
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    for( const srcVmo of srcVmos ) {
                        nameRevisionInfo[srcVmo.uid] = { source : {
                            oldName: propertyInfo.oldDBValue,
                            newName: isReplaceTileHavingModifiedSrcRev ? modifiedSourceRev.props.object_name.dbValues[0]
                                : propertyInfo.currentDBValue || srcVmo.cellHeader1
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'tgt_object_name' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};

                    let newName = propertyInfo.currentDBValue;
                    if( !propertyInfo.currentDBValue ) {
                        newName = isDesign ? i18n.NewPart : i18n.NewDesign;
                    }
                    for( const trgVmo of trgVmos ) {
                        nameRevisionInfo[trgVmo.uid] = { target : {
                            oldName: propertyInfo.oldDBValue,
                            newName: newName
                        } };
                    }
                }else {
                    targetPropertyInfos.push( _getUIPropertyInfo( propertyInfo, true ) );
                }
            } else {
                // LCS-1174663 - Tc2506_AssignPartNumber: Old Part ID is seen in the replace tile in the guided update panel.
                // Case: When a design is replaced with another design that has an assigned Part ID,
                // the currentDBValue will be empty, so the newName will be used as the display name of the source item.
                // This block is executed when there are multiple entries in propertyInfo,
                // so we need to handle both srcVMo and trVmo.
                if( propertyInfo.propInternalName === 'object_name' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    let isReplaceTileHavingModifiedSrcRev = updateActionValues[ 0 ]?.propInternalValue === 'k_pma0_action_replace' && updateEntry.modifiedSourceRevs;
                    let modifiedSourceRev = cdmSvc.getObject( updateEntry.modifiedSourceRevs[0].uid );
                    for( const srcVmo of srcVmos ) {
                        //LCS-1189029 - Tc2506_REG: Incorrect design name seen on source side in guided update panel.
                        //When design is replaced with another design which is holding an aligned part then we get the new name as aligned part for target
                        //So we need to show the new name as aligned part for target only for source we will show the new name from modifiedSourceRevs
                        nameRevisionInfo[srcVmo.uid] = { source : {
                            oldName: propertyInfo.oldDBValue,
                            newName: isReplaceTileHavingModifiedSrcRev ? modifiedSourceRev.props.object_name.dbValues[0]
                                : propertyInfo.currentDBValue || srcVmo.cellHeader1
                        } };
                    }
                    for( const trgVmo of trgVmos ) {
                        nameRevisionInfo[trgVmo.uid] = { target : {
                            oldName: propertyInfo.oldDBValue,
                            newName: propertyInfo.currentDBValue ? propertyInfo.currentDBValue : trgVmo.cellHeader1
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'item_revision_id' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    for( const srcVmo of srcVmos ) {
                        nameRevisionInfo[srcVmo.uid] = { source : {
                            oldRevision: propertyInfo.oldDBValue,
                            newRevision: propertyInfo.currentDBValue
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'tgt_object_item_rev_id' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    for( const trgVmo of trgVmos ) {
                        const existingEntry = nameRevisionInfo[trgVmo.uid] || {};
                        nameRevisionInfo[trgVmo.uid] = { 
                            ...existingEntry,
                            target : {
                                ...existingEntry.target,
                                oldRevision: propertyInfo.oldDBValue,
                                newRevision: propertyInfo.currentDBValue
                            } 
                        };
                    }
                }else if( propertyInfo.propInternalName === 'object_item_id' ) {
                    sourcePropertyInfos.push( null );
                }else if( propertyInfo.propInternalName === 'src_object_name' ) {
                    //LCS-1189029 - Tc2506_REG: Incorrect design name seen on source side in guided update panel.
                    //When design is replaced with another design which is holding an aligned part then we get the new name as aligned part for target
                    //So we need to show the new name as aligned part for target only for source we will show the new name from modifiedSourceRevs
                    let isReplaceTileHavingModifiedSrcRev = updateActionValues[ 0 ]?.propInternalValue === 'k_pma0_action_replace' && updateEntry?.modifiedSourceRevs;

                    let modifiedSourceRev = cdmSvc.getObject( updateEntry.modifiedSourceRevs[0].uid );
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};
                    for( const srcVmo of srcVmos ) {
                        nameRevisionInfo[srcVmo.uid] = { source : {
                            oldName: propertyInfo.oldDBValue,
                            newName: isReplaceTileHavingModifiedSrcRev ? modifiedSourceRev.props.object_name.dbValues[0]
                                : propertyInfo.currentDBValue || srcVmo.cellHeader1
                        } };
                    }
                }else if( propertyInfo.propInternalName === 'tgt_object_name' ) {
                    nameRevisionInfo = nameRevisionInfo ? nameRevisionInfo : {};

                    let newName = propertyInfo.currentDBValue;
                    if( !propertyInfo.currentDBValue ) {
                        newName = isDesign ? i18n.NewPart : i18n.NewDesign;
                    }
                    for( const trgVmo of trgVmos ) {
                        nameRevisionInfo[trgVmo.uid] = { target : {
                            oldName: propertyInfo.oldDBValue,
                            newName: newName
                        } };
                    }
                }else {
                    sourcePropertyInfos.push( _getUIPropertyInfo( propertyInfo ) );
                }
            }
        }
    }

    let selectedUpdateAction;
    if( updateActionValues.length > 0 ) {
        selectedUpdateAction = {
            displayValue: updateActionValues[0].propDisplayValue,
            tileIndex: tileIndex,
            type: 'STRING',
            isRequired: false,
            isEditable: true,
            isEnabled: true,
            dbValue: updateActionValues[0].propInternalValue,
            vertical: false,
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
        };
    }

    // Generate model and return
    return {
        isActionable : updateActionValues.length > 1 ? 'true' : 'false',
        selectedUpdateAction : selectedUpdateAction,
        updateActionValues : {
            type: 'STRING',
            dbValue: updateActionValues
        },
        srcItem : srcVmos[0],
        srcItems : srcVmos,
        srcInstances : srcInstances,
        trgItem : trgVmos[0],
        trgItems : trgVmos,
        trgInstances : trgInstances,
        sourcePropertyInfos: sourcePropertyInfos,
        targetPropertyInfos: targetPropertyInfos,
        nameRevisionInfo: nameRevisionInfo

    };
};

/**
    * Prepares the list of chips from the update summary model
    * @param {Object} updateSummaries - update summaries
    * @param {Object} selectedUpdateActionRadioProp - selectedUpdateActionRadioProp
    * @param {Object} subPanelContext - subPanelContext
    * @returns {Object} {updateSummaries,chips} - update updateSummaries and chips
    */
export const loadUpdateSummaryChips = function( updateSummaries, selectedUpdateActionRadioProp, subPanelContext ) {
    const newUpdateSummaries = _.cloneDeep( updateSummaries );
    const chips = [];
    _.forEach( newUpdateSummaries, function( updateSummary ) {
        // radio button is clicked
        if( selectedUpdateActionRadioProp && subPanelContext.updateSummary && _.isEqual( subPanelContext.updateSummary, updateSummary ) ) {
            updateSummary.selectedUpdateAction = selectedUpdateActionRadioProp;
        }
        if( !_.isUndefined( updateSummary.selectedUpdateAction ) ) {
            const matchingActionFromList = _.find( updateSummary.updateActionValues.dbValue, function( action ) {
                return action.propInternalValue === updateSummary.selectedUpdateAction.dbValue;
            } );
            updateSummary.selectedUpdateAction.displayValue = matchingActionFromList.propDisplayValue;
            const chipExists = _.find( chips, function( chip ) {
                return chip.labelInternalName === matchingActionFromList.propInternalValue;
            } );
            if( !chipExists ) {
                let isSelected = !subPanelContext?.data?.filteredOutChips?.includes( matchingActionFromList.propInternalValue );
                chips.push( {
                    uid: matchingActionFromList.propInternalValue,
                    chipType: 'SELECTION',
                    labelDisplayName: '1 ' + matchingActionFromList.propDisplayValue,
                    labelInternalName: matchingActionFromList.propInternalValue,
                    selected: isSelected,
                    count : 1
                } );
            } else {
                ++chipExists.count;
                chipExists.labelDisplayName = chipExists.count + ' ' + matchingActionFromList.propDisplayValue;
            }
        }
    } );
    if( subPanelContext && subPanelContext.updateSummaryState ) {
        let newUpdateSummaryState = { ...subPanelContext.updateSummaryState };
        newUpdateSummaryState.updateSummaries = newUpdateSummaries;
        newUpdateSummaryState.chips = chips;
        subPanelContext.updateSummaryState.update( newUpdateSummaryState );
    }
    return { newUpdateSummaries, chips };
};

/**
    * Parse the getUpdateActionsSummary SOA response and prepare summary model
    * @param {Object} data - declarative view model
    *
    * @returns {Object} {updateSummaries,chips,tileFilterOptions,runInBackground}
    */
export const loadUpdateSummaryData = function( data ) {
    let updateSummaries = [];
    let headerSummary = {
        selected: false
    };
    const tileFilterOptions = _.cloneDeep( data.tileFilterOptions );
    const runInBackground = _.cloneDeep( data.runInBackground );
    let chips = [];
    let tileIndex = 0;
    let isHiddenTilesInPanel = false;
    _.forEach( data.response.updateActions, async function( updateAction ) {
        if( !hiddenSummaryTiles.includes( updateAction.possibleUpdateActions?.[ 0 ].internalValue ) ) {
            tileIndex++;
            const summary = getSummaryModel( updateAction, data.i18n, tileIndex );
            if( !_.isUndefined( summary ) ) {
                if( summary.isActionable === 'true' ) {
                    let randomNumber = Math.floor( ( Math.random() + 1 ) * 100000 );
                    updateAction.uniqueNumber = randomNumber;
                    summary.uniqueNumber = randomNumber;

                    tileFilterOptions.isEditable = true;
                    tileFilterOptions.isEnabled = true;
                }
                updateSummaries.push( summary );
            }
        } else {
            if ( updateAction.possibleUpdateActions?.[ 0 ].internalValue === 'k_pma0_action_context' ) {
                headerSummary.src = updateAction.modifiedSourceOccurrences[ 0 ];
                headerSummary.trg = updateAction.alignedTargetOccurrences[ 0 ];

                await dmSvc.getProperties( [ headerSummary.trg.uid ], [ 'object_string' ] ).then( function() {
                    headerSummary.srcContext = headerSummary.src.props.object_string.dbValues[ 0 ];
                    headerSummary.trgContext = headerSummary.trg.props.object_string.dbValues[ 0 ];
                } );
            } else {
                isHiddenTilesInPanel = true;
            }
        }
    } );
    isHiddenTilesInPanel = _.isEmpty( updateSummaries ) ? isHiddenTilesInPanel : false;
    const result = loadUpdateSummaryChips( updateSummaries );
    chips = result.chips;
    updateSummaries = result.newUpdateSummaries;

    if( updateSummaries && updateSummaries.length > 0 ) {
        runInBackground.isEditable = true;
        runInBackground.isEnabled = true;
    }

    return { updateSummaries, chips, tileFilterOptions, runInBackground, headerSummary, isHiddenTilesInPanel };
};

const constructInputObjectFromContext = function( topElement ) {
    let inputObject;
    if( topElement ) {
        inputObject = {
            uid : topElement.uid,
            type : topElement.type
        };
    } else {
        inputObject = {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        };
    }
    return inputObject;
};

/**
    * Sets source and target occurrence for Impact Analysis
    * The CBASrc and CBATrg needs to be swapped if the updates are seeked EBOM to DBOM
    * This is required to be done as in CBA UI, CBASrc = DBOM & CBATrg = EBOM always
    * For the EBOM to DBOM update; srcRootOcc = EBOM_ROOT & trgRootOcc = DBOM_ROOT
    * @param {Object} props - declarative view model
    * @return {Object} {swapRequired,srcViewKey,trgViewKey,sourceRootOcc,targetRootOcc}
    */
export const setSourceAndTargetOccForImpactAnalysis = function( props ) {
    const splitView = appCtxSvc.getCtx( 'splitView' );
    if( splitView && splitView.mode ) {
        const viewKeys = splitView.viewKeys;
        let sourceRootOcc = null;
        let targetRootOcc = null;
        const adaptedSourceTopItem = props.subPanelContext.cbaContext.ImpactAnalysis.sourceTopItem;
        const swapRequired = props.subPanelContext.occContext.topElement.props.awb0UnderlyingObject.dbValues[0] !== adaptedSourceTopItem.uid;
        const index = Number( swapRequired );
        const srcViewKey = viewKeys[index];
        const trgViewKey = viewKeys[1 - index];

        let sourceOccContext = null;
        const selectedIANode = props.subPanelContext.cbaContext.ImpactAnalysis.selectedIANode;
        let sourceRootElement = selectedIANode;

        // inside ACE/CBA:- send selected element
        if( selectedIANode.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            // If launch Guided Update Page from ACE for skip node, the uid of select object should update
            const isGuidedUpdatelaunchedFromACE = CBAImpactAnalysisService.isGuidedUpdatelaunchedFromACE();
            if( isGuidedUpdatelaunchedFromACE && _isSkipNode( selectedIANode ) ) {
                let currentVMC = appCtxSvc.getCtx( srcViewKey )?.vmc;
                let loadedVMOs = currentVMC?.getLoadedViewModelObjects();
                let currentSelectedObj = selectedIANode;

                const vmoIndex = currentVMC?.findViewModelObjectById( sourceRootElement.uid );
                if( vmoIndex === -1 ) {
                    // Launch Guided Update Page from ACE for skip node
                    currentSelectedObj = appCtxSvc.getCtx( srcViewKey )?.pwaSelection[0];

                    // When launch Guided Update Page from ACE for skip node, and open object in ACE, then go back to the Guided Update Page, should update the selected object
                    if ( currentSelectedObj.props.awb0CopyStableId?.dbValues[0] !== selectedIANode.props.awb0CopyStableId?.dbValues[0] ) {
                        const loadVmoIndex = loadedVMOs.findIndex( vmo => {
                            const vmoObj = cdmSvc.getObject( vmo.uid );
                            return vmoObj?.props?.awb0CopyStableId?.dbValues[0] === selectedIANode?.props?.awb0CopyStableId?.dbValues[0];
                        } );

                        if ( loadVmoIndex !== -1 ) {
                            currentSelectedObj = currentVMC?.getViewModelObject( loadVmoIndex );
                            sourceRootElement = currentSelectedObj;
                        }else{
                            // If turn ON/OFF Show Redlines Toggle in the Guided Update page, and open object (not selected IA node) in ACE,
                            // then go back to the Guided Update page, should turn off the Focus Mode toggle, because the table reload after turn ON/OFF Show Redlines Toggle
                            currentSelectedObj = selectedIANode;
                        }
                    }
                } else{
                    // Go back to Guided Update Page from ACE for skip node
                    currentSelectedObj = loadedVMOs[ vmoIndex ];
                }

                sourceRootOcc = constructInputObjectFromContext( currentSelectedObj );
            } else{
                sourceRootOcc = constructInputObjectFromContext( selectedIANode );
            }

            if( swapRequired ) {
                targetRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext.topElement );
                sourceOccContext = props.subPanelContext.occContext2;
            }else{
                targetRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext2.topElement );
                sourceOccContext = props.subPanelContext.occContext;
            }
        }else{
            // Change Summary:- send top element
            if( swapRequired ) {
                sourceRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext2.topElement );
                sourceRootElement = props.subPanelContext.occContext2.topElement;
                targetRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext.topElement );
                sourceOccContext = props.subPanelContext.occContext2;
            }else{
                sourceRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext.topElement );
                sourceRootElement = props.subPanelContext.occContext.topElement;
                targetRootOcc = constructInputObjectFromContext( props.subPanelContext.occContext2.topElement );
                sourceOccContext = props.subPanelContext.occContext;
            }
        }
        props.subPanelContext.swapRequired = swapRequired;
        return { swapRequired, srcViewKey, trgViewKey, sourceRootOcc, sourceRootElement, targetRootOcc, sourceOccContext };
    }
};

/**
 * Checks if the selected object is a skip node.
 *
 * @param {Object} selectedObject - The selected object to check.
 * @returns {boolean} - True if the selected object is a skip node, false otherwise.
 */
const _isSkipNode = function( selectedObject ) {
    const objectQualifierType = CadBomOccurrenceAlignmentUtil.getObjectQualifierTypeFromVMO( selectedObject );

    // Fix the Defect: LCS-1113875 - Guided update panel not showing information when launched from ACE for EBOM Product (specific)
    // If the selected object is of type 'Ebm0PartProductRevision', return false immediately
    if ( objectQualifierType === cbaConstants.PRODUCT_EBOM ) {
        return false;
    }

    // Check if the selected object qualifies for alignment
    return !CadBomOccurrenceAlignmentUtil.isQualifyForAlignment( selectedObject, objectQualifierType );
};

/**
 * Get request model object
 * @param { Array } vmoArray Model Object
 * @returns { Array } List of model Objects
 */
const _getRequestMOdelObject = function( vmoArray ) {
    vmoArray.forEach( vmo => {
        for( const property in vmo ) {
            if( property !== 'type' && property !== 'uid' ) {
                delete vmo[ property ];
            }
        }
    } );
    return vmoArray;
};

/**
* Prepares updateActionData for updateTargetBOM SOA
* @param {Object} updateSummaries - declarative view model
* @return {Object} returns target input
*/
export const prepareUpdateTargetBOMInputOld = function( updateSummaries ) {
    const input = [];
    _.forEach( updateSummaries, function( updateSummary ) {
        if( updateSummary.selectedUpdateAction && updateSummary.selectedUpdateAction.dbValue ) {
            _.forEach( updateSummary.srcInstances, function( occurrence ) {
                const updateActionData = {
                    element: {
                        uid: occurrence.uid,
                        type: occurrence.type
                    },
                    updateAction: updateSummary.selectedUpdateAction.dbValue
                };
                input.push( updateActionData );
            } );
        }
    } );

    return input;
};

/**
* Prepares updateActionData for updateTargetBOM SOA
* @param {Object} updateSummaries - declarative view model
* @param {Object} responseUpdateActions - Update actions list from getUpdateActionsSummary2 SOA response
* @return {Object} returns target input
*/
export const prepareUpdateTargetBOMInput = function( updateSummaries, responseUpdateActions ) {
    let responseUpdateActionsCopy = _.cloneDeep( responseUpdateActions );
    const selectedActionMap = {};
    _.forEach( updateSummaries, function( updateSummary ) {
        if( updateSummary.isActionable === 'true' ) {
            selectedActionMap[ updateSummary.uniqueNumber ] = updateSummary.selectedUpdateAction.dbValue;
        }
    } );

    _.forEach( responseUpdateActionsCopy, function( responseUpdateAction ) {
        if( responseUpdateAction.uniqueNumber ) {
            let selectedUpdateAction = selectedActionMap[ responseUpdateAction.uniqueNumber ];
            delete responseUpdateAction.uniqueNumber;
            if( responseUpdateAction.possibleUpdateActions ) {
                responseUpdateAction.possibleUpdateActions = _.filter( responseUpdateAction.possibleUpdateActions, function( possibleUpdateAction ) {
                    return possibleUpdateAction.internalValue === selectedUpdateAction;
                } );
            }
        }
        if( responseUpdateAction.alignedTargetOccurrences ) {
            responseUpdateAction.alignedTargetOccurrences = _getRequestMOdelObject( responseUpdateAction.alignedTargetOccurrences );
        }

        if( responseUpdateAction.alignedTargetRevs ) {
            responseUpdateAction.alignedTargetRevs = _getRequestMOdelObject( responseUpdateAction.alignedTargetRevs );
        }

        if( responseUpdateAction.modifiedSourceOccurrences ) {
            responseUpdateAction.modifiedSourceOccurrences = _getRequestMOdelObject( responseUpdateAction.modifiedSourceOccurrences );
        }

        if( responseUpdateAction.modifiedSourceRevs ) {
            responseUpdateAction.modifiedSourceRevs = _getRequestMOdelObject( responseUpdateAction.modifiedSourceRevs );
        }
    } );

    return responseUpdateActionsCopy;
};

const updateStateParams = function( urlParamsMap, urlParamsWithValue, toParams ) {
    var paramMapKeys = Object.keys( urlParamsMap );
    var paramWithKeys = Object.keys( urlParamsWithValue );

    for( var i = 0; i < paramMapKeys.length; i++ ) {
        if( paramWithKeys.includes( paramMapKeys[ i ] ) ) {
            _.set( toParams, urlParamsMap[ paramMapKeys[ i ] ], urlParamsWithValue[ paramMapKeys[ i ] ] );
        } else {
            _.set( toParams, urlParamsMap[ paramMapKeys[ i ] ], null );
        }
    }
};

/**

    * This API makes CBA view go out of IA mode.
    * Also it reload the entire CBA view as per new aligned object after the updates
    * @param {Object} srcViewKey - source view key
    * @param {Object} trgViewKey - target view key
    * @param {Object} subPanelContext - subPanelContext
    */
export const disableIAModeAndReloadCBA = function( srcViewKey, trgViewKey, subPanelContext ) {
    let isRedlineMode = appCtxSvc.getCtx( 'state.params.isRL_mode' );
    let isChangeEnabled = cbaRedLineService.updateRedLineToggleState( isRedlineMode );
    const solutionTopItem = subPanelContext.cbaContext.ImpactAnalysis.sourceTopItem;
    CadBomOccurrenceAlignmentService.getAlignedObject( solutionTopItem ).then( function( targetObject ) {
        const toParams = {};
        const srcUrlParams = appCtxSvc.ctx[srcViewKey].urlParams;

        //defect - LCS-1083163 : after guided update performed, source structure should retain expansion state
        let srcCurrentState;
        let trgCurrentState;

        if( srcViewKey === cbaConstants.CBA_SRC_CONTEXT ) {
            srcCurrentState = subPanelContext.occContext.currentState;
            trgCurrentState = subPanelContext.occContext2.currentState;
        }else {
            srcCurrentState = subPanelContext.occContext2.currentState;
            trgCurrentState = subPanelContext.occContext.currentState;
        }

        const srcUrlParamsWithValue = {
            rootQueryParamKey: solutionTopItem.uid,
            productContextQueryParamKey:srcCurrentState.pci_uid,
            selectionQueryParamKey:srcCurrentState.c_uid,
            openStructureQueryParamKey:srcCurrentState.o_uid,
            topElementQueryParamKey:srcCurrentState.t_uid
        };
        const trgUrlParams = CadBomOccurrenceAlignmentUtil.getURLParameters( trgViewKey );
        const trgUrlParamsWithValue = {
            rootQueryParamKey: null
        };
        if( targetObject ) {
            trgUrlParamsWithValue.rootQueryParamKey = targetObject.uid;
            trgUrlParamsWithValue.productContextQueryParamKey = trgCurrentState.pci_uid;
        }
        updateStateParams( srcUrlParams, srcUrlParamsWithValue, toParams );
        updateStateParams( trgUrlParams, trgUrlParamsWithValue, toParams );

        // Should carry forward the Show Alignment Status and Show Redlines toggles status from Guided Update View after perform Guided Update
        toParams.isRL_mode = isChangeEnabled.toString();
        toParams.acStatus = CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode();

        appCtxSvc.unRegisterCtx( 'cbaContext' );
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS, true );
        appCtxSvc.updatePartialCtx( 'cadbomalignment.ImpactAnalysis.isImpactAnalysisMode', false );
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_LAUNCH_CBA_FROM_GUIDED_UPDATE, true );

        let transitionTo = 'CADBOMAlignment';
        const options = {
            inherit: false,
            reload: true
        };

        LocationNavigationService.instance.go( transitionTo, toParams, options );
    } );
};

/**
    * This API is invoked for any selection changed in SrcTreeView and TrgTreeView
    * If the performed selection in SrcTreeView then it verifies that the SrcTreeView selection and currently selected tile's src selection matches
    * If the performed selection in TrgTreeView then it verifies that the TrgTreeView selection and currently selected tile's trg selection matches
    * If the selection doesn't match, the tile selection in panel is cleared off.
    * @param {Object} data - declarative view model
    * @param {Object} viewKey - view key
    */
export const updateSelectionsInSummaryPanel = function( data, viewKey ) {
    const eventData = data?.eventData;
    if( eventData?.dataProvider && data?.updateSummaryState?.selectedTileSummary )  {
        // A tile is selected means, A srcInstance and trgInstance is selected
        // Determine in which tree view (SrcView/TrgView) the selection is performed for which the event is triggered
        // Accordingly fetch the current selection from tile (either srcInstance or trgInstance)
        let currentlySelectedObjectsInTile;
        if( viewKey === data.srcViewKey ) {
            currentlySelectedObjectsInTile = data.updateSummaryState.selectedTileSummary.srcInstances;
        } else {
            currentlySelectedObjectsInTile = data.updateSummaryState.selectedTileSummary.trgInstances;
        }

        // Get the selection in tree view through event
        const pwaSelectedObjects = eventData.dataProvider.getSelectedObjects();

        // selection matching flag - initiated with false
        let pwaSelectionAndTileSelectionMatched = false;

        if( currentlySelectedObjectsInTile ) {
            // Even if there are multiple objects selected in PWA, we don't want to have the tile selected in panel
            // So pwaSelectedObjects should not be more than 1
            if( currentlySelectedObjectsInTile.length > 0 && pwaSelectedObjects.length === 1 ) {
                // Check if tile selection and corresponding tree view's selection matches
                if( currentlySelectedObjectsInTile[0].uid === pwaSelectedObjects[0].uid ) {
                    pwaSelectionAndTileSelectionMatched = true;
                }
            } else if( currentlySelectedObjectsInTile.length === 0 && pwaSelectedObjects.length === 0 ) {
                // if there is no target occurrence selected in tile, then there shouldn't be any selection in target tree view
                // so verify that tile's trg selection and target tree view's selection is empty
                // if yes then also its a match and we should not clear the tile selection
                pwaSelectionAndTileSelectionMatched = true;
            }else if( currentlySelectedObjectsInTile.length > 0 && currentlySelectedObjectsInTile.length === pwaSelectedObjects.length ) {
                // If selected occurrences in tile and selected occurrence in tree are matched then only selectionMatched is true
                let interSectionList = _.intersectionBy( currentlySelectedObjectsInTile, pwaSelectedObjects, 'uid' );
                pwaSelectionAndTileSelectionMatched = interSectionList.length === currentlySelectedObjectsInTile.length;
            }
        }

        const newUpdateSummaryState = { ...data.updateSummaryState };
        if( !pwaSelectionAndTileSelectionMatched ) {
            // clear the selection in panel
            newUpdateSummaryState.selectedTileSummary = undefined;
        }
        if( newUpdateSummaryState.selectedTileSummary ) {
            newUpdateSummaryState.headerSummary.selected = false;
        }
        data.updateSummaryState.update( newUpdateSummaryState );
    }

    if( eventData?.dataProvider && data?.updateSummaryState && !data?.updateSummaryState?.selectedTileSummary )  {
        let currentlySelectedObjectsInTile;
        if( viewKey === data?.srcViewKey ) {
            currentlySelectedObjectsInTile = data.updateSummaryState?.headerSummary?.src;
        } else {
            currentlySelectedObjectsInTile = data.updateSummaryState?.headerSummary?.trg;
        }

        const pwaSelectedObjects = eventData.dataProvider.getSelectedObjects();
        let pwaSelectionAndTileSelectionMatched = false;
        if( currentlySelectedObjectsInTile ) {
            if( pwaSelectedObjects.length === 1 ) {
                if( currentlySelectedObjectsInTile.uid === pwaSelectedObjects[0].uid ) {
                    pwaSelectionAndTileSelectionMatched = true;
                }
            }
        }

        const newUpdateSummaryState = { ...data.updateSummaryState };
        if( !pwaSelectionAndTileSelectionMatched  && newUpdateSummaryState?.headerSummary ) {
            // clear the selection in panel
            newUpdateSummaryState.headerSummary.selected = false;
            data.updateSummaryState.update( newUpdateSummaryState );
        }
    }
};

/**
    * This API is added to form the message string from the Partial error being thrown from the SOA
    *
    * @param {Object} messages - messages array
    * @param {Object} msgObj - message object
    */
const getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if ( msgObj.msg.length > 0 ) {
            msgObj.msg += '<BR/>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
    * This API is added to process the Partial error being thrown from the SOA
    *
    * @param {object} response - the response Object of SOA
    * @return {object} returns message object
    */
export const processPartialErrors = function( response ) {
    const msgObj = {
        msg: '',
        level: 0
    };

    let partialErrors;
    if( response && response.partialErrors ) {
        partialErrors =  response.partialErrors;
    } else if( response && response.ServiceData && response.ServiceData.partialErrors ) {
        partialErrors = response.ServiceData.partialErrors;
    }
    if ( partialErrors ) {
        _.forEach( partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj;
};

export const tileSelected = function( subPanelContext, isCtrlKeyPressed ) {
    const newUpdateSummaryState = { ...subPanelContext.updateSummaryState };
    if( !isCtrlKeyPressed ) {
        newUpdateSummaryState.selectedTileSummary = subPanelContext.updateSummary;
    } else{
        newUpdateSummaryState.selectedTileSummary = undefined;
    }
    subPanelContext.updateSummaryState.update( newUpdateSummaryState );
    eventBus.publish( 'Pma1ImpactAnalysis.tileSelectedInUpdatePanel' );
};

export const selectionToModify = function( objectsToSelect, subPanelContext, viewToReact ) {
    if( objectsToSelect.length === 0 ) {
        cbaSelectionService.updateSelections( objectsToSelect, subPanelContext, viewToReact );
    } else {
        return dmSvc.getProperties( [ objectsToSelect[0].uid ], [ 'object_string', 'awb0BreadcrumbAncestor' ] ).then( function() {
            cbaSelectionService.updateSelections( objectsToSelect, subPanelContext, viewToReact );
        } );
    }
};

export const cleanUp = function( data ) {
    let newUpdateSummaryState = { ...data.updateSummaryState };
    newUpdateSummaryState.updateSummaries = [];
    newUpdateSummaryState.selectedTileSummary = '';
    newUpdateSummaryState.chips = '';
    return newUpdateSummaryState;
};

export const initializeTile = function( data, subPanelContext ) {
    let counter = subPanelContext.tileIndex;

    var vmProperty = uwPropertyService.createViewModelProperty( 'selectedUpdateAction' + counter, 'selectedUpdateAction' + counter, 'STRING', '', '' );
    vmProperty.isRequired = false,
    vmProperty.isEditable = true,
    vmProperty.isEnabled = true,
    vmProperty.name = 'selectedUpdateAction' + counter;
    vmProperty.propertyName = 'selectedUpdateAction' + counter;
    vmProperty.propertyDisplayName = '';
    vmProperty.dbValue = subPanelContext.updateSummary.selectedUpdateAction.dbValue;
    data.dispatch( { path: 'data.' + 'selectedUpdateAction' + counter, value:  [ vmProperty ] } );
    return  [ vmProperty ];
};

export const processUpdateTargetBOMOutput = function( response, subPanelContext ) {
    let srcStructure = subPanelContext.cbaContext.srcStructure;
    let trgStructure = subPanelContext.cbaContext.trgStructure;
    if ( srcStructure && trgStructure ) {
        return response;
    }

    let contextKeyToConstantMap = {
        CBASrcContext: cbaConstants.DESIGN,
        CBATrgContext: cbaConstants.PART
    };
    let openedContext = srcStructure ?  subPanelContext.occContext : subPanelContext.occContext2;
    let contextToOpen = srcStructure ?  subPanelContext.occContext2 : subPanelContext.occContext;

    let contextToOpenViewKey = contextToOpen.viewKey;
    const urlParams = CadBomOccurrenceAlignmentUtil.getURLParameters( contextToOpenViewKey );

    let propToCheck = contextToOpenViewKey === cbaConstants.CBA_SRC_CONTEXT ? cbaConstants.ALIGNMENT_RELATION_DESIGN_DBOM : cbaConstants.ALIGNMENT_RELATION_PART_EBOM;
    let objectQualifierTypeMap = cbaObjectTypeService.getObjectsQualifierType( response.modelObjects );
    let input = objectQualifierTypeMap[ contextKeyToConstantMap[ contextToOpenViewKey ] ];

    let objectToOpen;
    if ( input ) {
        for ( let index = 0; index < input.length; index++ ) {
            const element = input[ index ];
            let property = _.get( input[ index ].props, propToCheck );
            if ( property && property.dbValues[0] === openedContext.topElement.props.awb0UnderlyingObject.dbValues[0] ) {
                objectToOpen = element;
                break;
            }
        }
    }
    if( objectToOpen ) {
        let params = {
            rootQueryParamKey: objectToOpen.uid
        };
        aceNavigationService.navigateWithGivenParams( urlParams, params );
        let valueToUpdate = {
            modelObject: objectToOpen,
            currentState: {
                uid: objectToOpen.uid
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, contextToOpen );
    }
};

export const guidedUpdatepanelPostAction = async( subPanelContext ) => {
    let srcOccContext = subPanelContext.occContext;
    let trgOccContext = subPanelContext.occContext2;

    let sourceAlignedOcc;
    let targetAlignedOcc;
    if( subPanelContext.cbaContext.ImpactAnalysis.selectedIANode.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) < 0 ) {
        if( subPanelContext.swapRequired ) {
            sourceAlignedOcc = subPanelContext.occContext2.topElement;
            targetAlignedOcc = subPanelContext.occContext.topElement;
        }else{
            sourceAlignedOcc = subPanelContext.occContext.topElement;
            targetAlignedOcc = subPanelContext.occContext2.topElement;
        }
        return { sourceAlignedOcc, targetAlignedOcc };
    }

    let validParentObject = [];
    validParentObject =  await getParentObjectForGuidedUpdate( subPanelContext.cbaContext.ImpactAnalysis.selectedIANode, srcOccContext, trgOccContext, subPanelContext.swapRequired  );
    sourceAlignedOcc = subPanelContext.cbaContext.ImpactAnalysis.selectedIANode;
    targetAlignedOcc = validParentObject[1];
    return { sourceAlignedOcc, targetAlignedOcc };
};

const hasAlignedOccuurences = async( selectedObject, occContext ) => {
    let findAlignedInput = {
        targetContext: {
            uid:occContext.topElement.uid,
            type:occContext.topElement.type
        },
        occurrences:  [ selectedObject ]
    };
    let findAlignedResponse = await _invokeFindAlignedOccurrencesSoa( findAlignedInput );
    findAlignedResponse = cbaFindAlignedService.processFindAlignedResponse( findAlignedResponse, occContext.viewKey );
    if( findAlignedResponse ) {
        let alignedObjects = findAlignedResponse.objectsToFind;
        if ( alignedObjects.length > 0 ) {
            await dmSvc.loadObjects( alignedObjects );
            return [  cdmSvc.getObject( alignedObjects[0] ) ];
        }
    }
    return [];
};

export let _invokeFindAlignedOccurrencesSoa = function( findAlignedInput ) {
    return soaService.postUnchecked( 'Internal-EntCba-2021-12-Alignments', 'findAlignedOccurrences', findAlignedInput ).then(
        function( response ) {
            return response;
        } );
};

const getParentObjectForGuidedUpdate = async( selectedObject, srcOccContext, trgOccContext, swapRequired ) => {
    // Single Structure opened
    if( !srcOccContext.topElement || !trgOccContext.topElement ) {
        return  [ selectedObject, undefined ];
    }

    const isSkipNode = _isSkipNode( selectedObject );

    // Fix the Defect: LCS-1113875 - Guided update panel not showing information when launched from ACE for EBOM Product (specific)
    // When launch Guided Update Page from ACE, the uid of selected object should update
    //if src top node
    if( selectedObject?.uid === srcOccContext.topElement.uid
        || selectedObject?.props?.awb0Archetype?.dbValues[0] === srcOccContext.topElement?.props?.awb0Archetype?.dbValues[0] ) {
        return  [ selectedObject, trgOccContext.topElement ];
    }

    //if trg top node
    if( selectedObject?.uid === trgOccContext.topElement.uid
        || selectedObject?.props?.awb0Archetype?.dbValues[0] === trgOccContext.topElement?.props?.awb0Archetype?.dbValues[0]
    ) {
        return  [ selectedObject,  srcOccContext.topElement ];
    }


    let parentObject = cdmSvc.getObject( selectedObject?.props.awb0Parent.dbValues[0] );

    if( isSkipNode ) {
        //get Parent
        let validParentObject =  await getParentObjectForGuidedUpdate(  parentObject, srcOccContext, trgOccContext, swapRequired );
        if( validParentObject ) {
            return validParentObject;
        }
    } else{
        let alignedObjects = swapRequired ?  await hasAlignedOccuurences( selectedObject, srcOccContext ) :  await hasAlignedOccuurences( selectedObject, trgOccContext );
        if( !alignedObjects || alignedObjects.length === 0 ) {
            let validParentObject = await getParentObjectForGuidedUpdate(  parentObject, srcOccContext, trgOccContext, swapRequired );
            if( validParentObject ) {
                return validParentObject;
            }
        }
        return [ selectedObject, alignedObjects[0] ];
    }
};

/**
 * Select objects in the tables according to the selected header tile
 * @param {Object} subPanelContext - subPanelContext
 * @param {Object} updateSummaryState - updateSummaryState
 * @param {Boolean} swapRequired - swapRequired
 */
export const headerTileSelected = function( subPanelContext, updateSummaryState, swapRequired ) {
    // Fix the Defect: LCS-1160692 - Tc2506_GUFocusMode: Selection on either side is not done after performing guided update from contextual menu.
    // When click Guided Update command from RMB, subPanelContext.updateSummaryState should be empty, so should fetch it from data.updateSummaryState
    const currentState = subPanelContext?.updateSummaryState || updateSummaryState;
    if( subPanelContext && currentState?.headerSummary ) {
        const newUpdateSummaryState = { ...currentState };
        newUpdateSummaryState.headerSummary.selected = !currentState.headerSummary.selected;
        currentState.update( newUpdateSummaryState );

        let srcObjectsToSelect = [];
        let trgObjectsToSelect = [];

        if ( newUpdateSummaryState.headerSummary.selected ) {
            if ( subPanelContext.swapRequired || swapRequired ) {
                srcObjectsToSelect = [ newUpdateSummaryState.headerSummary.trg ];
                trgObjectsToSelect = [ newUpdateSummaryState.headerSummary.src ];
            } else {
                srcObjectsToSelect = [ newUpdateSummaryState.headerSummary.src ];
                trgObjectsToSelect = [ newUpdateSummaryState.headerSummary.trg ];
            }
        }

        // Fix the Use Case 2 of the Defect - LCS-1164648
        // Prevents unnecessary reloads of the source tree table when launching Guided Update from ACE for sub-nodes (not at the first level).
        // If launched from ACE, the selected object's UID should be updated.
        // If launched from Change Summary, the selected node will be the top node.
        if (
            CBAImpactAnalysisService.isGuidedUpdatelaunchedFromACE() &&
        newUpdateSummaryState.headerSummary.src?.props?.awb0Archetype?.dbValues?.[0] ===
            subPanelContext.cbaContext?.ImpactAnalysis?.selectedIANode?.props?.awb0Archetype?.dbValues?.[0]
        ) {
            if ( subPanelContext.swapRequired || swapRequired ) {
                exports.selectionToModify( srcObjectsToSelect, subPanelContext, subPanelContext.occContext.viewKey );
            } else {
                exports.selectionToModify( trgObjectsToSelect, subPanelContext, subPanelContext.occContext2.viewKey );
            }
        } else {
            exports.selectionToModify( srcObjectsToSelect, subPanelContext, subPanelContext.occContext.viewKey );

            // Use setTimeout to ensure the second selection modification event is not ignored for large structures
            setTimeout( () => {
                exports.selectionToModify( trgObjectsToSelect, subPanelContext, subPanelContext.occContext2.viewKey );
            }, 500 );
        }
    }
};

/**
 * Open guided update dialog
 *
 * @param {object} dialogAction dialog action
 * @param {object} subPanelContext subpanelcontext
 */
export const openGuidedUpdateDialog = ( dialogAction, subPanelContext ) => {
    if( dialogAction ) {
        let options = {
            view: 'PmaUpdateSummary',
            parent: '.aw-layout-workarea',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            placement:'right',
            push: true,
            isPinUnpinEnabled: false,

            subPanelContext: {
                subPanelContext:subPanelContext.subPanelContext,
                occContext:subPanelContext.occContext,
                occContext2:subPanelContext.occContext2,
                cbaContext:subPanelContext.cbaContext
            }
        };
        dialogAction.show( options );
    }
};

/**
 *  Update selection to filter tiles
 *
 * @param { object } selectedChip  selected chip
 * @param { List } filteredOutChips List of uids of filtered out chips
 * @param { Object } data View Model
 * @returns {List} New list of filtered out chips
 */
export const updateSelection = function( selectedChip, filteredOutChips, data ) {
    let newFilteredOutChips = _.clone( filteredOutChips );
    let uid = selectedChip.uid;
    let existInFilteroutList = newFilteredOutChips.indexOf( uid ) !== -1;
    if( selectedChip.selected ) {
        if( existInFilteroutList ) {
            // Remove from filter out list
            newFilteredOutChips.splice( newFilteredOutChips.indexOf( uid ), 1 );
        }
    }else {
        if( !existInFilteroutList ) {
            newFilteredOutChips.push( uid );
        }
    }
    data.filteredOutChips = newFilteredOutChips;
    return newFilteredOutChips;
};

/**
 * Get change notice revision
 *
 * @param { object } ecnForImpactAnalysis ECN object
 * @returns { object } Change Notice Revision
 */
export const getChangeNoticeRevision = function( ecnForImpactAnalysis ) {
    let inputObject = {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };

    if( ecnForImpactAnalysis ) {
        inputObject.uid = ecnForImpactAnalysis.uid;
        inputObject.type = ecnForImpactAnalysis.type;
    }

    return inputObject;
};

/**
 * Execute Open Panel event in CBA
 * @param {object} cbaContext cbaContext
 */
export let executeCommandOpenPanelInCba = function( cbaContext ) {
    if( cbaContext ) {
        // Close the Open In View panel if opened
        let activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        if ( activeCommand && activeCommand.commandId === 'CbaOpenInViewPanel' ) {
            eventBus.publish( 'CbaOpenInViewPanel.closePanel' );
        }

        let activeContextKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
        // If active view is sorce, then should display target in OpenInView Panel and vice versa
        let contextKey = activeContextKey === cbaConstants.CBA_SRC_CONTEXT ? cbaConstants.CBA_TRG_CONTEXT : cbaConstants.CBA_SRC_CONTEXT;

        let panelContext = {
            cbaContext: cbaContext,
            contextKey: contextKey,
            urlParamsMap: CadBomOccurrenceAlignmentUtil.getURLParameters( contextKey )
        };

        cbaOpenInViewPanelService.populateFilterTypesForOpenInViewPanel( panelContext.contextKey );

        eventBus.publish( 'cba.executeCommandOpenPanel', panelContext );
    }
};

/**
 * Get CBA Page title display name
 * @param {string} objectQualifierType - Object qualifier type
 * @param {string} i18n - i18n
 * @returns {string} cbaPageTitle
 */
export const getCBAPageTitleDisplayName = function( objectQualifierType, i18n ) {
    let cbaPageTitle = i18n.Awb0EntCBAModuleTitle;
    // If not in Guided Update, should display with default CBA title
    if( CBAImpactAnalysisService.isImpactAnalysisMode() ) {
        if( objectQualifierType === cbaConstants.PART || objectQualifierType === cbaConstants.PRODUCT_EBOM ) {
            cbaPageTitle = i18n.Pma1CBATitleForDBOMUpdate;
        }else if( objectQualifierType === cbaConstants.DESIGN ) {
            cbaPageTitle = i18n.Pma1CBATitleForEBOMUpdate;
        }
    }
    return cbaPageTitle;
};

/**
 * Update selected IA node in cbaContext for guided update
 * @param {object} subPanelContext subPanelContext
 * @param {object} commandContext command context
 */
export let updateSelectedNodeOnCbaContext = function( subPanelContext, commandContext ) {
    let valueToUpdate = { ...subPanelContext.cbaContext.value };
    if( valueToUpdate?.ImpactAnalysis?.selectedIANode ) {
        valueToUpdate.ImpactAnalysis.selectedIANode = commandContext.occContext.pwaSelection[ 0 ];

        /**
         * If select object from the EBOM/DBOM side and launch Guided Update Panel,
         * when select object from the DBOM/EBOM side and click Guided Update context menu,
         * then should update the sourceTopItem with the top node of selected object
         */
        valueToUpdate.ImpactAnalysis.sourceTopItem = cdmSvc.getObject( commandContext.occContext.topElement?.props?.awb0UnderlyingObject?.dbValues[0] );

        // Fix the Defect: LCS-1160692 - Tc2506_GUFocusMode: Selection on either side is not done after performing guided update from contextual menu.
        // When click Guided Update command from RMB, should update isGuidedUpdateLaunchFromCba to false, then can update header tile selection in panel
        subPanelContext.cbaContext.isGuidedUpdateLaunchFromCba = false;
        occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, subPanelContext.cbaContext );

        /**
         * If select object from the EBOM/DBOM side and launch Guided Update Panel,
         * when select object from the DBOM/EBOM side and click Guided Update context menu,
         * then should disable the focus mode in previous context
         */
        let contextToDisableFocusMode;
        if( commandContext.occContext.viewKey === cbaConstants.CBA_SRC_CONTEXT ) {
            contextToDisableFocusMode = subPanelContext.occContext2;
        }else if( commandContext.occContext.viewKey === cbaConstants.CBA_TRG_CONTEXT ) {
            contextToDisableFocusMode = subPanelContext.occContext;
        }
        const eventData = { occContexts: [ contextToDisableFocusMode ] };
        eventBus.publish( 'cba.disableFocusMode', eventData );
    }
};

export const setCBAPageTitle = function( objectQualifierType, i18n ) {
    const cbaPageTitle = getCBAPageTitleDisplayName( objectQualifierType, i18n );
    appCtxSvc.updatePartialCtx( 'taskUI.moduleTitle', cbaPageTitle );
};

export const destroyGuideUpdatePanel = function( isImpactAnalysisMode, context, i18n ) {
    if( isImpactAnalysisMode ) {
        CadBomOccurrenceAlignmentService.unSetImpactAnalysisMode( context );

        /*
         * Fix the issue - the title of the page should be updated to the default title
         * after the Guided Update Panel was closed or destroyed,
         * so directly update the isImpactAnalysisMode to false in Global Context
         */
        const objectQualifierType = cbaObjectTypeService.getObjectQualifierType( context.cbaContext.ImpactAnalysis.sourceTopItem, i18n );
        exports.setCBAPageTitle( objectQualifierType, i18n );
    }

    // Fix the Defect: LCS-1164708 - Tc2506_GuidedUpdateFocusMode: Reset view on target side does not bring system out of focus mode.
    // Should exit Focus Mode when the Guided Update panel gets destroyed or closed
    const eventData = { occContexts: [ context.occContext, context.occContext2 ] };
    eventBus.publish( 'cba.disableFocusMode', eventData );

    // Destroy Focus Mode service when the Guided Update Panel is closed or destroyed
    cbaFocusService.destroyService();
};

const exports = {
    openBOMNotification,
    loadUpdateSummaryData,
    loadUpdateSummaryChips,
    setSourceAndTargetOccForImpactAnalysis,
    prepareUpdateTargetBOMInputOld,
    prepareUpdateTargetBOMInput,
    disableIAModeAndReloadCBA,
    updateSelectionsInSummaryPanel,
    processPartialErrors,
    tileSelected,
    selectionToModify,
    cleanUp,
    initializeTile,
    processUpdateTargetBOMOutput,
    guidedUpdatepanelPostAction,
    headerTileSelected,
    openGuidedUpdateDialog,
    updateSelection,
    getChangeNoticeRevision,
    executeCommandOpenPanelInCba,
    getCBAPageTitleDisplayName,
    updateSelectedNodeOnCbaContext,
    setCBAPageTitle,
    destroyGuideUpdatePanel
};

export default exports;
