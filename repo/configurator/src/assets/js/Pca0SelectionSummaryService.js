// Copyright (c) 2024 Siemens

/**
 * @module js/Pca0SelectionSummaryService
 **/

import appCtxSvc from 'js/appCtxService';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/pca0ExpressionGridService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import modelPropSvc from 'js/modelPropertyService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import { getBaseUrlPath } from 'app';

var exports = {};

const userSelection = pca0Constants.SELECTION_TYPES.USER_SELECTION;
const defaultSelection = pca0Constants.SELECTION_TYPES.DEFAULT_SELECTION;
const systemSelection = pca0Constants.SELECTION_TYPES.SYSTEM_SELECTION;
const summarySelectionTypes = pca0Constants.SUMMARY_SELECTION_TYPES;
const localeTextBundle = localeService.getLoadedText( 'FullScreenConfigurationMessages' );
const localeCommonUtilsTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
const localeConfiguratorTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );

/**
 * Function to add selection type for current interation object
 * @param {Int} selectionState - selection state of current iteration object
 * @param {Boolean} isUnconfigured - isUnconfigured flag for current iteration object
 * @returns {String} featureSelectionState depending on selectionState
 */
let _addSelectionTypeData = ( selectionState, isUnconfigured ) => {
    let selectionTypeData = {};
    let imageBasePath = getBaseUrlPath() + '/image/';
    if( userSelection.includes( selectionState ) ) {
        selectionTypeData.type = summarySelectionTypes.USER;
        if( userSelection[0] === selectionState ) {
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_INCLUDE_CHECKBOX;
        } else {
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_EXCLUDE_CHECKBOX;
        }
    }
    if( defaultSelection.includes( selectionState ) ) {
        selectionTypeData.type = summarySelectionTypes.DEFAULT;
        if( defaultSelection[0] === selectionState ) {
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_INCLUDE_CHECKBOX;
        } else{
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_EXCLUDE_CHECKBOX;
        }
    }
    if( systemSelection.includes( selectionState ) ) {
        selectionTypeData.type = summarySelectionTypes.SYSTEM;
        if( systemSelection[0] === selectionState ) {
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_INCLUDE_CHECKBOX;
        } else{
            selectionTypeData.selectionTypeIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_EXCLUDE_CHECKBOX;
        }
    }

    if( isUnconfigured ) {
        selectionTypeData.unconfiguredIcon = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_CONFIGURED_OUT;
    }

    return selectionTypeData;
};

/**
 * Function to check current item is belong to selected state/filter or not
 * @param {String} selectedType - selection state of current iteration object
 * @param {Int} selectionState - selection state of current iteration object
 * @returns {Boolean} isValidTypeForItem depending on selectionState
 */
let _checkSelectionTypeForCurrent = ( selectedType, selectionState ) => {
    let isValidTypeForItem = false;
    if( selectedType === summarySelectionTypes.USER ) {
        isValidTypeForItem = userSelection.includes( selectionState );
    } else if ( selectedType === summarySelectionTypes.SYSTEM ) {
        isValidTypeForItem = systemSelection.includes( selectionState );
    } else if ( selectedType === summarySelectionTypes.DEFAULT ) {
        isValidTypeForItem = defaultSelection.includes( selectionState );
    } else if ( selectedType === summarySelectionTypes.ALL ) {
        isValidTypeForItem = true;
    }
    return isValidTypeForItem;
};

/**
* This function is responsible for handling filtering and sorting of the data.
*
* @param {ObjectArray} columnFilter column filters
* @param {ObjectArray} allSelection response from GET call
*
* @return {ObjectArray}  filtered result
*/
let _applyColumnFilter = ( columnFilter, allSelection ) => {
    return allSelection.filter( function( selected ) {
        return pca0CommonUtils.isFilterCriteriaSatisfied( selected.props[ columnFilter.columnName ].uiValue, columnFilter.values[ 0 ], columnFilter.operation );
    } );
};

/**
* This function is responsible for handling filtering and sorting of the data.
*
* @param {ObjectArray} allSelection response from GET call
* @param {ObjectArray} columnFilters column filters
* @param {Object} sortCriteria Sort criteria
*
* @return {ObjectArray}  paginated filtered result
*/
let _applySortAndFilterRowsInternal = ( allSelection, columnFilters, sortCriteria ) => {
    if( columnFilters && columnFilters.length > 0 ) {
        // Apply filtering on selection
        _.forEach( columnFilters, function( columnFilter ) {
            allSelection = _applyColumnFilter( columnFilter, allSelection );
        } );
    }
    // Apply sorting on filtered data
    if( sortCriteria && sortCriteria.length > 0 ) {
        const [ criteria ] = sortCriteria;
        const sortDirection = criteria.sortDirection;
        const sortColName = criteria.fieldName;
        if( sortDirection === 'ASC' ) {
            allSelection.sort( function( a, b ) {
                if( a.props[ sortColName ].value <= b.props[ sortColName ].value ) {
                    return -1;
                }
                return 1;
            } );
        } else if( sortDirection === 'DESC' ) {
            allSelection.sort( function( a, b ) {
                if( a.props[ sortColName ].value >= b.props[ sortColName ].value ) {
                    return -1;
                }
                return 1;
            } );
        }
    }
    return allSelection;
};

/**
 * Triggers navigation based on the context provided.
 * If the selected family is in the current scope, then just focus on the selected family.
 * If the selected family is not in the current scope, switch to desired group.
 *
 * @param {Object} context - Fsc context.
 */
let _triggerNavigation = ( context ) => {
    // If Navigation Family is in current scope, do UI adjustments
    if ( Array.isArray( context.navigateTo.groupUid ) ? context.navigateTo.groupUid.includes( context.currentScope ) : context.navigateTo.groupUid === context.currentScope ) {
        context.navigateTo.groupUid = context.currentScope;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
        eventBus.publish( 'Pca0Features.focusToFamily' );
    } else {
        eventBus.publish( 'Pca0Scopes.scopeSelectionUpdate', { scopeUid: context.navigateTo.groupUid, loadScopeData: true, crossProbingSelectionSummary: true } );
    }
};

/**
* This function is responsible for handling filtering and sorting of the data.
*
* @param {ObjectArray} allSelection all selections
* @param {ObjectArray} columnFilters column filters
* @param {Object} sortCriteria Sort criteria
* @param {String} selectedType user or all selections possible
* @param {Boolean} isStale flag for staleness
* @return {ObjectArray}  filtered selections
*/
export let applySortAndFilterRows = ( allSelection, columnFilters, sortCriteria, selectedType, isStale ) => {
    let listBySelectedType = allSelection;
    //the passed in list can contain all the selections but if we are going for the user selection only, filter those first
    //the extracting function will deliver all the selected expressions found, regardless of the selectedType in the list

    //The requirement is to show only user data after there was an expand and we are in All followed by a new user selection,
    //but this is an aberation from the paradigm, because we are not reverting to what the rest of the system is saying as we do for guided mode,
    //So in order to not do all that, we'll add the knowledge here of the manualMode + stale
    //and if the allSelection is before the expand it will just work, if it's after expand we'll just filter it out
    if ( isStale && selectedType === summarySelectionTypes.ALL ) {
        selectedType = summarySelectionTypes.USER;
    }

    if( selectedType !== 'Incomplete Families' ) {
        listBySelectedType = allSelection.filter( sel => _checkSelectionTypeForCurrent( selectedType, sel.selectionState ) );
    }

    // This is the case when we already have incomplete families after that we try to crossprobe and do some selections
    if( isStale && selectedType === 'Incomplete Families' ) {
        return allSelection;
    }
    return  _applySortAndFilterRowsInternal( listBySelectedType, columnFilters, sortCriteria );
};

/**
* The function populates the initial columns to be updated on the treeDataProvder
* column config of selection summary table
*
* @return {Object} Object containing initial columns for the selection summary table.
*/
export let loadColumnsForSelectionsSummary = () => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let currentProductHierarchyDepth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );
    var awColumnInfos = [
        {
            name: 'selectionIcon',
            displayName: '',
            enableSorting: false,
            enableColumnHiding: false,
            isFilteringEnabled: false,
            minWidth: 50,
            width: 50
        },
        {
            name: 'typeOfSelection',
            displayName: localeTextBundle.typeOfSelection,
            enableColumnHiding: false,
            minWidth: 100,
            width: 120
        },
        {
            name: 'family',
            displayName: localeCommonUtilsTextBundle.familyUpperCase,
            enableColumnHiding: false,
            minWidth: 100,
            width: 150
        },
        {
            name: 'feature',
            displayName: localeTextBundle.feature,
            enableColumnHiding: false,
            minWidth: 100,
            width: 150
        },
        {
            name: 'group',
            displayName: localeCommonUtilsTextBundle.group,
            enableColumnHiding: false,
            minWidth: 100,
            width: 150
        }
    ];
    if( currentProductHierarchyDepth && currentProductHierarchyDepth[0] !== '1' ) {
        awColumnInfos.push(
            {
                name: 'module',
                displayName: localeTextBundle.module,
                enableColumnHiding: false,
                minWidth: 100,
                width: 300
            } );
    }
    return {
        columns: awColumnInfos
    };
};

/**
* This function clears the InvalidFamilies from the ctx response so the selection summary dialog does not
* show stale info in manual mode
*/
export let clearInvalidFamiliesFromContext = () => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( _.get( fscContext, 'responseInfo.incompleteFamiliesInfo' ) ) {
        fscContext.responseInfo.incompleteFamiliesInfo = undefined;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }
};


/**
* This function is responsible for creating columns for incomplete families.
*
* @return {Object} containing initial columns for the incomplete families grid
*/
export let loadColumnsForIncompleteFamilies = ( ) => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let currentProductHierarchyDepth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );
    let awColumnInfos = [
        {
            /*
                1. This property is used to display the incomplete variation point ( family/feature ) in the VCV selection summary table.
                2. For multi-select family features, each feature is considered a variation point.
                3. In overlay mode, we may get multi-select features as a incomplete families.
                4. Hence we are using a generic name 'variationPoint' to indicate incomplete family/feature.
                5. Sample incomplete family VMO:
                   {
                       alternateID: "[moduleUID]:groupUID:familyUID:variationPointUID",
                       props: {
                           variationPoint: { name: "variationPoint", uid: "variationPointUid01", type: "STRING", value: "variationPointDisplayName", uiValue: "variationPointDisplayName" },
                           family: { name: "family", uid: "famUid01", type: "STRING", value: "FamDisplayName", uiValue: "FamDisplayName" },
                           group: { name: "group", uid: "groupUid01", type: "STRING", value: "groupDisplayName", uiValue: "groupDisplayName" },
                           module: { name: "module", uid: "moduleUid01", type: "STRING", value: "moduleDisplayName", uiValue: "moduleDisplayName" }
                       }
                   }
                6. The alternateID is used to uniquely identify the incomplete family/feature in the VCV.
                7. If variationPoint is multiselect feature then alternateID will be in the format of "[moduleUID]:groupUID:familyUID:variationPointUID" ( variationPointUID -> feature UID )
                8. If variationPoint is family then alternateID will be in the format of "[moduleUID]:groupUID:variationPointUID" ( variationPointUID -> family UID )
            */

            name: 'variationPoint',
            displayName: localeCommonUtilsTextBundle.familyUpperCase,
            width: 200,
            enableColumnHiding: false
        },
        {
            name: 'group',
            displayName: localeCommonUtilsTextBundle.group,
            enableColumnHiding: false,
            width: 200
        }
    ];
    if( currentProductHierarchyDepth && currentProductHierarchyDepth[0] !== '1' ) {
        awColumnInfos.push(
            {
                name: 'module',
                displayName: localeTextBundle.module,
                enableColumnHiding: false,
                minWidth: 100,
                width: 300
            } );
    }
    return {
        columns: awColumnInfos
    };
};

/**
* This function sets the typeOfSelectionList selection to 'User'
* @param {Array} values - values of the list
* @param {Object} typeOfSelectionList - the vmo selected in the text box
* @return {Object} the changed vmo selected in the text box so it can reflect on the UI
*/
export let switchToUserSelections = ( values, typeOfSelectionList ) => {
    let newTypeOfSelectionList = { ...typeOfSelectionList };
    return pca0CommonUtils.updateSelectionList( newTypeOfSelectionList, values.dbValues[0] );
};

/**
 * This function is called to empty all the selection summary data and responseInfo, when clearAll command is executed.
 *
 * @returns {Object} An object returning emptied data.
 */
export let clearTableData = () => {
    return {
        selectionSummaryTableData: {
            allSelectionsVMOs: [],
            incompleteFamiliesVMOs: [],
            filteredSelectionsVMOs: [],
            filteredIncompleteFamiliesVMOs: []
        },
        isStale: true
    };
};

/**
* This function returns the dirty flag for selection summary dialog.
* @param {Object} fscState - fscState
* @return {Boolean} isStale value
*/
export let initDirtyFlag = ( fscState ) => {
    const fscStateValue = fscState.getValue();
    // Determine staleness based on different conditions
    let isStale = false;
    if ( fscStateValue.completenessStatus ) {
        // When completenessStatus chip is present, staleness is decided based on isCompletenessStatusChipEnabled property
        isStale = !fscStateValue.isCompletenessStatusChipEnabled;
    } else {
        // When completenessStatus chip is not present(in the case of loaded svr and resetView),Staleness determined by variantRuleDirty flag
        isStale = fscStateValue.variantRuleDirty;
    }
    return isStale;
};

/**
 * Displays the selection count based on the provided selection type and data.
 *
 * @param {Array} selectionTypeList - List of selection types.
 * @param {Object} legendDetails - Details of the legend to be modified.
 * @param {string} selectionType - Type of selection ('Incomplete Families', 'User', 'All').
 * @param {Array} filteredSelectionsVMOs - Filtered data for the selection summary table.
 * @param {Array} filteredIncompleteFamiliesVMOs - Filtered data for the incomplete families table.
 * @returns {Object} Modified legend details with updated selection count information.
 */
export let displaySelectionCount = ( selectionTypeList, legendDetails, selectionType, filteredSelectionsVMOs, filteredIncompleteFamiliesVMOs ) => {
    const localeTextBundle = configuratorUtils.getFscLocaleTextBundle();
    let selections = {
        user: [],
        default: [],
        system: []
    };
    let selectionMap = {
        1: selections.user,
        2: selections.user,
        5: selections.default,
        6: selections.default,
        9: selections.system,
        10: selections.system
    };

    let modifiedData = { ...legendDetails };
    modifiedData.legendItems = [];
    modifiedData.legendType = 'SelectionSummarySelectionCountTooltip';

    if( selectionType === 'Incomplete Families' ) {
        let incompleteFamiliesCount =  filteredIncompleteFamiliesVMOs ? filteredIncompleteFamiliesVMOs.length : 0;
        if( incompleteFamiliesCount === 1 ) {
            modifiedData.propertyDisplayName = localeTextBundle.singleIncompleteFamiliesSelectionCount;
            return modifiedData;
        }

        modifiedData.propertyDisplayName = localeTextBundle.incompleteFamiliesSelectionCount.replace( '{0}', incompleteFamiliesCount );
        return modifiedData;
    }

    let totalSelected = filteredSelectionsVMOs.length;

    filteredSelectionsVMOs.forEach( ( selectionVMO ) => {
        selectionMap[selectionVMO.selectionState].push( selectionVMO );
    } );

    if( selectionType === 'User' ) {
        if( selections.user.length === 1 ) {
            modifiedData.propertyDisplayName = localeTextBundle.singleSelectionSummarySelectionCount;
            return modifiedData;
        }

        modifiedData.propertyDisplayName = localeTextBundle.selectionSummarySelectionCount.replace( '{0}', selections.user.length );
        return modifiedData;
    }else if( selectionType === 'All' ) {
        modifiedData.propertyDisplayName = localeTextBundle.selectionSummarySelectionCount.replace( '{0}', totalSelected );

        const selectionTypes = [ 'user', 'system', 'default' ];

        selectionTypes.forEach( ( type, index ) => {
            const prop = {
                displayName: selectionTypeList.dbValue[index].displayName,
                type: 'STRING',
                dbValue: selections[type].length,
                dispValue: selections[type].length,
                labelPosition: 'PROPERTY_LABEL_AT_SIDE'
            };
            let vmProp = modelPropSvc.createViewModelProperty( prop );
            vmProp.fielddata = {
                propertyDisplayName: '',
                uiValue: selections[type].length
            };

            if( type === 'user' ) {
                vmProp.fielddata.propertyDisplayName = localeTextBundle.userSelectionsTitle;
            } else if( type === 'system' ) {
                vmProp.fielddata.propertyDisplayName = localeTextBundle.Pca0SystemSelections;
            } else {
                vmProp.fielddata.propertyDisplayName = localeTextBundle.defaultSelections;
            }

            modifiedData.legendItems.push( vmProp );
        } );

        return modifiedData;
    }
};

/**
 * Updates the type of selection list based on the completeness status and values provided.
 *
 * @param {Object} summaryOpenedFromChip - flag to check if the dialog is opened from the chip
 * @param {Object} values - list of the values : 'User', 'All' and 'Incomplete Families'
 * @param {Object} typeOfSelectionList - the vmo selected in the text box
 * @param {Boolean} svrLoadUnload - flag to check if SVR load/unload is in progress
 * @returns {Object} - Returns the updated type of selection list.
 */
export let setSelectionTypeLovValue = (  summaryOpenedFromChip, values, typeOfSelectionList, svrLoadUnload ) => {
    let newTypeOfSelectionList = { ...typeOfSelectionList };

    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let  completenessStatus = fscContext.criteriaStatus;

    if (  !summaryOpenedFromChip || fscContext.switchingToGuidedMode || svrLoadUnload ) {
        return pca0CommonUtils.updateSelectionList( newTypeOfSelectionList, values.dbValues[0] );
    }

    completenessStatus = fscContext.criteriaStatus;
    let index;
    switch ( completenessStatus ) {
        case 'ValidAndInComplete':
            index = 2;
            break;
        case 'ValidAndComplete':
            index = 1;
            break;
        case 'InValid':
            index = 0;
            break;
        default:
            index = 0;
    }

    return pca0CommonUtils.updateSelectionList( newTypeOfSelectionList, values.dbValues[index] );
};

/**
 * Handles selection change in the selection summary.
 * This function is called when there is any selection or change in selection in the summary table and incomplete families table.
 *
 * @param {Object} eventData - The event data containing the selected objects.
 * @param {Object} fscState - fscState
 */
export let handleSelectionChangeForSelectionSummary = ( eventData, fscState ) => {
    const localeTextBundle = configuratorUtils.getFscLocaleTextBundle();
    let context = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );


    if( eventData && eventData.selectedObjects.length > 0 ) {
        // Check for guided mode,
        // if unassigned family is selected in guided mode, show info message
        // if summary family is selected in guided mode, show info message
        if ( !fscState.isManualConfiguration ) {
            // Check for summary families in guided mode
            if(  _.get( eventData, 'selectedObjects[0].props.family.isSummaryFamily' ) === 'true' ) {
                messagingService.showInfo( localeTextBundle.summaryFamiliesInGuidedMode );
                return;
            }

            // Check for unassigned families in guided mode
            if(  eventData.selectedObjects[0].props.group.uid === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID || eventData.selectedObjects[0].groupId === ''  ) {
                messagingService.showInfo( localeTextBundle.unassignedFamiliesInGuidedMode );
                return;
            }
        }

        let currentProductHierarchyDepth = _.get( context, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );
        let currentSelectedModule = context.configurationModuleHierarchy === '' ? '' : context.configurationModuleHierarchy.split( ':' )[0];


        // Check for the current product hierarchy depth and navigate to the selected module
        // If the module of the current selected family/feature is not the same as the module of the previously selected family/feature, navigate to the selected module
        // Otherwise navigate to the desired group and focus on the selected family
        if ( currentProductHierarchyDepth && currentProductHierarchyDepth[0] !== '1' && eventData.selectedObjects[0].props.module.uid !== currentSelectedModule ) {
            context.navigateTo = {
                groupUid: eventData.selectedObjects[0].props.group.uid,
                familyUid: eventData.selectedObjects[0].props.family.uid,
                crossProbingSelectionSummary: true
            };
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );

            eventBus.publish( 'Pca0ConfigurationModuleTree.changeModuleSelectionForSummary', eventData.selectedObjects[0] );
        } else {
        // With product hierarchy depth 1, navigate to the desired group.
            let desiredGroupId = eventData.selectedObjects[0].props.group.uid;

            // Update Navigation information on context
            context.navigateTo = {
                groupUid: desiredGroupId,
                familyUid: eventData.selectedObjects[0].props.family.uid
            };
            appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, context );
            _triggerNavigation( context );
        }
    } else if ( context.navigateTo ) {
        // Load scopes data after module selection is changed
        eventBus.publish( 'Pca0Scopes.scopeSelectionUpdate', { scopeUid: context.navigateTo.groupUid, loadScopeData: true } );
    }
};

/**
 * Helper function to create a property object.
 *
 * @param {string} name - The name of the property.
 * @param {string} type - The type of the property.
 * @param {string} value - The value of the property.
 * @param {string} [uid] - The UID of the property.
 * @param {string} [uiValue] - The UI value of the property.
 * @returns {Object} The property object.
 */
const _createProperty = ( name, type, value, uid = '', uiValue = value ) => ( {
    name,
    type,
    value,
    uiValue,
    uid
} );

/**
 * Helper function to get the module VMO.
 *
 * @param {Object} fscContext - The FSC context.
 * @returns {Object} The module VMO.
 */
const _getModuleVMO = ( fscContext ) => {
    if ( fscContext.configurationModuleHierarchy === '' ) {
        let rootModule = _.get( fscContext, 'currentConfigPerspective.props.cfg0ProductItems.dbValues[0]' );
        return cdm.getObject( rootModule );
    }
    return cdm.getObject( fscContext.configurationModuleHierarchy.split( ':' )[0] );
};

/**
 * Creates a new ViewModelObject (VMO) for the newly selected feature.
 *
 * @param {String} nodeID - The unique identifier of the node (feature or selection).
 * @param {String} featureDisplayName - The display name of the feature.
 * @param {String} familyUID - The unique identifier of the family.
 * @param {String} familyDisplayName - The display name of the family.
 * @param {String} groupUID - The unique identifier of the group.
 * @param {String} groupDisplayName - The display name of the group.
 * @param {Number} selectionState - The selection state (e.g., 1 for positive, 0 for negative).
 * @param {Boolean} isFamilySelection - Flag indicating if the selection is at the family level.
 * @param {Object} displayStringsObj - An object containing localized display strings for selection types.
 * @returns {Object} newSelection - The newly created VMO object representing the selected feature.
 *
 */
let _createNewVMOForSelectionSummary = ( nodeID, featureDisplayName, familyUID, familyDisplayName, groupUID, groupDisplayName,
    selectionState, isFamilySelection, displayStringsObj ) => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    const currentProductHierarchyDepth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );
    const featureVMO = {
        object_name: featureDisplayName,
        nodeUid: nodeID
    };

    if( isFamilySelection ) {
        if( selectionState === 1 ) {
            featureVMO.nodeUid = familyUID + ':' + displayStringsObj.k_variant_optional_family_any_value;
            featureVMO.object_name = displayStringsObj.k_variant_optional_family_any_value;
        } else {
            featureVMO.nodeUid = familyUID + ':' + displayStringsObj.k_variant_optional_family_none_value;
            featureVMO.object_name = displayStringsObj.k_variant_optional_family_none_value;
        }
    }

    const typeOfSelection = selectionState === 1 ? localeConfiguratorTextBundle.userPositive : localeConfiguratorTextBundle.userNegative;
    const newSelection = {
        selectionState: selectionState,
        props: {
            family: _createProperty( 'family', 'STRING', familyDisplayName, familyUID ),
            feature: _createProperty( 'feature', 'STRING', featureVMO.object_name, featureVMO.nodeUid, featureVMO.object_name ),
            typeOfSelection: _createProperty( 'typeOfSelection', 'STRING', typeOfSelection ),
            group: _createProperty( 'group', 'STRING', groupDisplayName, groupUID )
        },
        alternateID : _getAlternateIdForSummaryVMO( nodeID, familyUID, groupUID, currentProductHierarchyDepth, false )
    };

    if ( currentProductHierarchyDepth && currentProductHierarchyDepth[0] !== '1' ) {
        let moduleVMO = _getModuleVMO( fscContext );
        newSelection.props.module = _createProperty( 'module', 'STRING', moduleVMO.props.object_string.dbValues[0], moduleVMO.uid, moduleVMO.props.object_string.uiValues[0] );
    }

    const isUnconfigured = _.get( newSelection, 'props.isUnconfigured.0' );
    newSelection.selectionTypeData = _addSelectionTypeData( newSelection.selectionState, isUnconfigured );
    return newSelection;
};

/**
 * Creates a new ViewModelObject (VMO) for incomplete families based on the provided family and group information.
 *
 * @param {String} familyUID - The unique identifier of the family.
 * @param {String} familyDisplayName - The display name of the family.
 * @param {String} groupUID - The unique identifier of the group.
 * @param {String} groupDisplayName - The display name of the group.
 * @returns {Object} newFamily - The newly created VMO object representing the incomplete family.
 */
let _createNewVMOForIncompleteFamilies = ( familyUID, familyDisplayName, groupUID, groupDisplayName ) => {
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    const currentProductHierarchyDepth = _.get( fscContext, 'appliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues' );

    const newFamily = {
        props: {
            family: _createProperty( 'family', 'STRING', familyDisplayName, familyUID ),
            group: _createProperty( 'group', 'STRING', groupDisplayName, groupUID )
        },
        alternateID: _getAlternateIdForSummaryVMO( '', familyUID, groupUID, currentProductHierarchyDepth, true )
    };

    if ( currentProductHierarchyDepth && currentProductHierarchyDepth[0] !== '1' ) {
        const moduleVMO = _getModuleVMO( fscContext );
        newFamily.props.module = _createProperty( 'module', 'STRING', moduleVMO.props.object_string.dbValues[0], moduleVMO.uid, moduleVMO.props.object_string.uiValues[0] );
    }
    return newFamily;
};

/**
 * Generates an alternate ID for a selection summary ViewModelObject (VMO).
 *
 * This function constructs an alternate ID based on the product hierarchy depth and the type of VMO.
 * If the product hierarchy depth is greater than 1, the module UID is included in the alternate ID.
 * For incomplete family VMOs, the alternate ID includes the group UID and family UID.
 * For other VMOs, the alternate ID includes the group UID, family UID, and node ID.
 *
 * @param {String} nodeID - The unique identifier of the node (feature or selection).
 * @param {String} familyUID - The unique identifier of the family.
 * @param {String} groupUID - The unique identifier of the group.
 * @param {Array} productHierarchyDepth - The product hierarchy depth array.
 * @param {Boolean} isIncompleteFamilyVMO - Flag indicating if the VMO is for an incomplete family.
 * @returns {String} The generated alternate ID for the VMO.
 *
 */
export let _getAlternateIdForSummaryVMO = ( nodeID, familyUID, groupUID, productHierarchyDepth, isIncompleteFamilyVMO ) => {
    let alternateID = '';

    // Add module UID if product hierarchy depth is not '1'
    if ( productHierarchyDepth && productHierarchyDepth[0] !== '1' ) {
        const moduleVMO = _getModuleVMO( appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT ) );
        alternateID = moduleVMO.uid + ':';
    }

    // Construct the alternate ID based on the type of VMO
    if ( isIncompleteFamilyVMO ) {
        alternateID += groupUID + ':' + familyUID;
    } else {
        alternateID += groupUID + ':' + familyUID + ':' + nodeID;
    }

    return alternateID;
};

/**
 * Parses the VCV3 selection summary response.
 *
 * @param {Object} response - The response from VCV3 SOA.
 * @param {Object} selectionSummaryTableData - The selection summary table data.
 * @returns {Object} An object containing the parsed selection summary and incomplete families VMOs.
 */
export let parseVCVSelectionSummaryResponse = ( response, selectionSummaryTableData ) => {
    let responseInfo = _.get( response, 'responseInfo' );
    let allSelectionsVMOs = [];
    let incompleteFamiliesVMOs = [];
    if( responseInfo ) {
        allSelectionsVMOs = JSON.parse( responseInfo.selectionSummaryResponse[0] ).allSelections;
        incompleteFamiliesVMOs = JSON.parse( responseInfo.selectionSummaryResponse[0] ).incompleteFamilies;
    }

    // Add selection type info ( Type of selection and icon ) to each selection summary VMO
    for ( let vmo in allSelectionsVMOs ) {
        let isUnconfigured = _.get( allSelectionsVMOs[vmo], 'props.isUnconfigured.0' );
        const selectionTypeData = _addSelectionTypeData( allSelectionsVMOs[vmo].selectionState, isUnconfigured );
        allSelectionsVMOs[vmo].selectionTypeData = selectionTypeData;
    }
    selectionSummaryTableData.allSelectionsVMOs = allSelectionsVMOs;
    selectionSummaryTableData.incompleteFamiliesVMOs = incompleteFamiliesVMOs;
    return selectionSummaryTableData;
};

/**
 * Returns the response information received from the manual mode expand call.
 *
 * @param {Object} eventData - The event data containing the response of VCV3 SOA.
 * @returns {Object} The response information extracted from the event data.
 */
export let populateResponseInfoAfterExpand = ( eventData ) => {
    return eventData;
};

/**
 * Updates the selection summary VMOs after user changes the selection.
 *
 * @param {Object} eventData - The event data containing information about the selection.
 * @param {Object} treeDataProvider - The data provider of selection summary table.
 * @returns {Array} - The updated array of selection summary VMOs.
 */
export let updateSelectionSummaryVMOs = async( eventData, treeDataProvider ) => {
    await pca0CommonUtils.getLocalizedOperatorStrings();
    const displayStringsObj = JSON.parse( sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS ) );

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let allSelectionsVMOs = viewModelCollection.getLoadedViewModelObjects();
    let currentActiveFamMap;

    // Get the configuration expression map so that we can add the vmos for the selected feature
    // NOTE : We are using selected expression because in case of multiselect families, we would not need to take special care of the selected features
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let configExprMap = exprGridSvc.getConfigExpressionMap( fscContext.selectedExpressions );

    if( eventData ) { currentActiveFamMap = configExprMap[eventData.familyUID]; }

    // Removing all the features of the current family from selection summary which are not in selected expression
    if( currentActiveFamMap ) {
        for ( let i = 0; i < allSelectionsVMOs.length; i++ ) {
            const selectionVMO = allSelectionsVMOs[i];
            if ( selectionVMO.props.family.uid === eventData.familyUID ) {
                let shouldRemove = true;

                for ( const feature of currentActiveFamMap ) {
                    let nodeUid = feature.nodeUid;

                    if ( _.get( feature, 'props.isFreeFormFamily[0]' ) === 'true' ) {
                        nodeUid = feature.family + ':' + feature.valueText;
                    }

                    if ( _.get( feature, 'props.isFamilyLevelSelection[0]' ) === 'true' ) {
                        nodeUid = eventData.familyUID + ':' + ( eventData.selectionState === 1 ? displayStringsObj.k_variant_optional_family_any_value :
                            displayStringsObj.k_variant_optional_family_none_value );
                    }

                    // If feature is present in selected expression, do not remove it
                    if ( selectionVMO.props.feature.uid === nodeUid && selectionVMO.selectionState === feature.selectionState ) {
                        shouldRemove = false;
                        break;
                    }
                }

                if ( shouldRemove ) {
                    allSelectionsVMOs.splice( i, 1 );
                    i--; // Adjust index after removal
                }
            }
        }

        // Adding current selected feature to the selection summary
        allSelectionsVMOs.push( _createNewVMOForSelectionSummary( eventData.nodeID, eventData.featureDisplayName, eventData.familyUID, eventData.familyDisplayName,
            eventData.groupUID, eventData.groupDisplayName, eventData.selectionState, eventData.isFamilySelection, displayStringsObj ) );
    } else {
        // Removing all vmos of features belonging to current family (As selected exoression doesnot have any selection for this this family)
        let filteredUserSelectionsArray = allSelectionsVMOs.filter( selection => selection.props.family.uid !== eventData.familyUID );
        allSelectionsVMOs = filteredUserSelectionsArray;
    }

    return allSelectionsVMOs;
};

/**
 * Updates the list of incomplete families ViewModelObjects (VMOs) based on the selection state.
 * When selection from a feature is removed, we need to add the family the incomplete families list.
 * When selection is done on any feature of a family, we need to remove the family from the incomplete families list.
 * @param {Object} eventData - The event data containing selection state and family UID.
 * @param {Object} treeDataProvider - The data provider for the incomplete families table.
 * @returns {Array} The updated list of incomplete families VMOs.
 */
let updateIncompleteFamiliesVMOs = ( eventData, treeDataProvider ) => {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let incompleteFamiliesVMOs = viewModelCollection.getLoadedViewModelObjects();

    if( eventData.selectionState === 0 ) {
        // Existing selected feature is unselected, we need to add this entry in incomplete families list
        let unSelectedFamVMO = _createNewVMOForIncompleteFamilies( eventData.familyUID, eventData.familyDisplayName, eventData.groupUID, eventData.groupDisplayName );
        incompleteFamiliesVMOs.push( unSelectedFamVMO );
    } else {
        // New feature is selected thus remove the vmo from incomplete families list
        // Removing all instances of the family (Shared across modules as well)
        for ( let incompleteFamilyIdx = 0; incompleteFamilyIdx < incompleteFamiliesVMOs.length; incompleteFamilyIdx++ ) {
            if( incompleteFamiliesVMOs[incompleteFamilyIdx].props.family.uid === eventData.familyUID ) {
                incompleteFamiliesVMOs.splice( incompleteFamilyIdx, 1 );
                incompleteFamilyIdx--;  // Adjust index after removal
            }
        }
    }
    return incompleteFamiliesVMOs;
};

/**
 * Filters out system selections from the summary table data.
 * Empty the incomplete families list after clear system selection command is executed.
 *
 * @param {Array} allSelectionsVMOs - All selection summary VMOs.
 * @returns {Object} An object containing the filtered user selections array and an empty incomplete families.
 */
let removeSystemSelectionsFromSummary = ( allSelectionsVMOs ) => {
    // Remove system selections from the selection summary table data
    if( !allSelectionsVMOs ) { return { allSelectionsVMOs: [], incompleteFamiliesVMOs: [], isStale: true }; }
    let filteredUserSelectionsArray = allSelectionsVMOs.filter( selection => selection.selectionState === 1 || selection.selectionState === 2 );
    return { allSelectionsVMOs: filteredUserSelectionsArray, incompleteFamiliesVMOs: [], isStale: true };
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @param {String} soaName - The name of the SOA
 * @returns {Object} The property policy
 */
export const getPropertyPolicy = ( soaName ) => {
    return pca0CommonUtils.getPropertyPolicy( soaName );
};

/**
 * Depending on the use case returns default or the current perspective
 * @param {Object} variantRuleData - variantRuleData
 * @return {Object} configPerspective - fsc config  perspective
 */
export let getFscConfigPerspective = function( variantRuleData ) {
    return configuratorUtils.getFscConfigPerspective( variantRuleData );
};

/**
* @param {Object} selectedExpressions - selected expression json object
* @returns {Array} Array of json string of selected expressions.
*/
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/** Helps to get configurator context with respect to module
 * @param {String} contextName - Name of context that we need to fetch from global ctx
 * @param {Object} configCtx - Configurator context provided by consumer apps
 * @returns {Object} VariantContext required to call VCV3 SOA
 */
export let getSelectionForVariantContext = ( contextName, configCtx ) => {
    return commonUtils.getSelectionForVariantContext( contextName, configCtx );
};

/**
 * Return Profile Settings information
 * @returns {Object} Profile settings information for FSC.
 */
export let getProfileSettingsForFsc = function() {
    return configuratorUtils.getProfileSettingsForFsc();
};

export let getConfigExpressionsForExpandInGuidedMode = function( response ) {
    return configuratorUtils.getConfigExpressionsForExpandInGuidedMode( response );
};

/**
 * This function helps to update the staleness flag.
 * When selection summary is not loaded, we will use the staleness flag from parent to know weather the configuration is stale or not.
 * Use Case 1 : When summary is not opened and configuration is expanded in manual mode, then we are NOT STALE.
 * Use case 2 : Summary is not opened, configuration is expanded and after that any selection is done, then we are in STALE state.
 * Use case 3 : For guided mode we will always be updated thus returning staleness flag as false.
 *              As this function would get called only for guided mode once summary is loaded
 * @param {Object} response - The response from the SOA
 * @param {boolean} isSelectionSummaryLoaded - Flag implying if selection summary is loaded or not
 * @param {boolean} isStale - Flag from parent telling about the staleness state of the configuration
 * @param {Boolean} svrLoadUnload - flag to check if SVR load/unload is in progress
 * @returns {boolean} - Returns new/latest staleness state for selection summary component.
 */
export let updateStalenessFlag = ( response, isSelectionSummaryLoaded, isStale, svrLoadUnload ) => {
    if( svrLoadUnload ) {
        return true;
    } else if( !isSelectionSummaryLoaded ) {
        return isStale;
    }
    return false;
};

export default exports = {
    applySortAndFilterRows,
    loadColumnsForSelectionsSummary,
    clearInvalidFamiliesFromContext,
    loadColumnsForIncompleteFamilies,
    switchToUserSelections,
    clearTableData,
    initDirtyFlag,
    displaySelectionCount,
    setSelectionTypeLovValue,
    handleSelectionChangeForSelectionSummary,
    parseVCVSelectionSummaryResponse,
    populateResponseInfoAfterExpand,
    updateSelectionSummaryVMOs,
    updateIncompleteFamiliesVMOs,
    removeSystemSelectionsFromSummary,
    getPropertyPolicy,
    getFscConfigPerspective,
    convertSelectedExpressionJsonObjectToString,
    getSelectionForVariantContext,
    getProfileSettingsForFsc,
    getConfigExpressionsForExpandInGuidedMode,
    updateStalenessFlag
};
