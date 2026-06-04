// Copyright (c) 2022 Siemens

/**
 * @module js/includeExcludeFilterService
 */
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import aceObjectsToPackedOccurrenceCSIDsService from 'js/aceObjectsToPackedOccurrenceCSIDsService';
import acePartialSelectionService from 'js/acePartialSelectionService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';
import proximityFilterService from 'js/proximityFilterService';
var exports = {};

/**
 * Function to apply selected element recipe
 * create a selected element recipe term
 * @param{Object} occContext ACE atomic data
 * @param{String} operatorType recipe term type
 * @param{Object} customDialogAction panel context
 * @return{Object} recipe term
 */
export let applySelectedElementFilterInRecipe = function( occContext, operatorType, customDialogAction ) {
    var selected = occContext.pwaSelection;
    var productContextInfo = occContext.productContextInfo;
    var selectedObjCloneIds;
    var selectedObjUiValues = [];

    let selectionPathHasPackingOrSummaryLine = false;
    let isPartiallySelected = false;
    _.forEach( selected, function( selectedObject ) {
        // Check if selection is made from PWA
        if( !isPartiallySelected && acePartialSelectionService.isPartiallySelected( selectedObject.uid ) ) {
            isPartiallySelected = true;
        }
        // Check if any of the selection has pack master or summary line in the path
        if( !selectionPathHasPackingOrSummaryLine && aceObjectsToPackedOccurrenceCSIDsService.isPackedOccurrencePresentInParentHierarchy( selectedObject ) ) {
            selectionPathHasPackingOrSummaryLine = true;
        }
    } );

    // When pack master is selected in PWA, we consider all the pack nodes and pack master for select term
    // So when pack master is selected, we get CSIDs for all the packed nodes for the pack master
    // From these CSIDs we get the elements to use in select term
    if( !isPartiallySelected && selectionPathHasPackingOrSummaryLine ) {
        var deferredPacked = AwPromiseService.instance.defer();
        let searchResultUIDs = [];
        let validTargets = [];
        let promise = aceObjectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( productContextInfo, selected );
        promise.then( function( resultData ) {
            csidsToObjSvc.doPerformSearchForProvidedCSIDChains( resultData.csids, 'true', [], 'true' ).then( function( response ) {
                selectedObjCloneIds = resultData.csids;
                if( !_.isEmpty( response.elementsInfo )  ) {
                    _.forEach( response.elementsInfo, function( elementsInfo ) {
                        if( elementsInfo.element ) {
                            searchResultUIDs.push(  elementsInfo.element.uid  );
                        }
                    } );
                }
                validTargets = proximityFilterService.getModelObjectsFromUids( searchResultUIDs );
                for( var i = 0; i < validTargets.length; i++ ) {
                    if( validTargets.length > 0 ) {
                        selectedObjUiValues[ i ] = validTargets[ i ].props.awb0UnderlyingObject.uiValues[ 0 ];
                    }
                }

                var includeWithChildrenPrefValue = appCtxSvc.ctx.preferences.AWS_SelectElement_IncludeChildren;
                var criteriaValueList = selectedObjCloneIds;
                //From Tc2412, when Append(Include) operation is performed, the operatortype for the recipe term would be Filter
                if ( operatorType === 'Include' ) {
                    operatorType = 'Filter';
                }
                if( operatorType === 'Filter' ) {
                    if ( includeWithChildrenPrefValue === undefined || includeWithChildrenPrefValue[0].toUpperCase() === 'TRUE' ) {
                        criteriaValueList[criteriaValueList.length] = 'True';
                    } else {
                        criteriaValueList[criteriaValueList.length] = 'False';
                    }
                }

                var displayString = createTransientSelectedElementDisplayString( selectedObjUiValues );

                var selectedElementCriteria = {
                    criteriaType: 'SelectedElement',
                    criteriaOperatorType: operatorType,
                    criteriaDisplayValue: displayString,
                    criteriaValues: criteriaValueList,
                    subCriteria: []
                };

                // Reset operation after performing include/exclude operation
                if( customDialogAction ) {
                    customDialogAction.update( { context: { operation: '' } } );
                }
                deferredPacked.resolve( selectedElementCriteria );
            } );
        } );
        return deferredPacked.promise;
    }

    selectedObjCloneIds = occmgmtSubsetUtils.getCSIDChainForSelected( selected );

    for( var i = 0; i < selected.length; i++ ) {
        if( selected.length > 0 ) {
            selectedObjUiValues[ i ] = selected[ i ].props.awb0UnderlyingObject.uiValues[ 0 ];
        }
    }
    var includeWithChildrenPrefValue = appCtxSvc.ctx.preferences.AWS_SelectElement_IncludeChildren;
    var criteriaValueList = selectedObjCloneIds;
    //From Tc2412, when Append(Include) operation is performed, the operatortype for the recipe term would be Filter
    if ( operatorType === 'Include' ) {
        operatorType = 'Filter';
    }
    if( operatorType === 'Filter' ) {
        if ( includeWithChildrenPrefValue === undefined || includeWithChildrenPrefValue[0].toUpperCase() === 'TRUE' ) {
            criteriaValueList[criteriaValueList.length] = 'True';
        } else {
            criteriaValueList[criteriaValueList.length] = 'False';
        }
    }

    // Reset operation after performing include/exclude operation
    if( customDialogAction ) {
        customDialogAction.update( { context: { operation: '' } } );
    }
    var displayString = createTransientSelectedElementDisplayString( selectedObjUiValues );
    return {
        criteriaType: 'SelectedElement',
        criteriaOperatorType: operatorType,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaValueList,
        subCriteria: []
    };
};

var createTransientSelectedElementDisplayString = function( selectedObjUiValues ) {
    var selectedString = '';
    if( selectedObjUiValues !== null && selectedObjUiValues.length > 0 ) {
        // Get the filter separator value from the preference AW_FacetValue_Separator
        var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';
        for( var i = 0; i < selectedObjUiValues.length; i++ ) {
            selectedString = selectedString.concat( selectedObjUiValues[ i ] );
            if ( i !== selectedObjUiValues.length - 1 ) {
                selectedString = selectedString.concat( filterSeparator );
            }
        }
        var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
        var selectedElementDisplayString = resource.selectedElementDisplayString + '_$CAT_' + selectedString;
    }
    return selectedElementDisplayString;
};


export default exports = {
    applySelectedElementFilterInRecipe
};
