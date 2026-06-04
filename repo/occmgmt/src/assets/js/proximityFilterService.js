// Copyright (c) 2022 Siemens

/**
 * @module js/proximityFilterService
 */
import AwPromiseService from 'js/awPromiseService';
import localeSvc from 'js/localeService';
import prefService from 'soa/preferenceService';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import occmgmtUtils from 'js/occmgmtUtils';
import localeService from 'js/localeService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';
import aceObjectsToPackedOccurrenceCSIDsService from 'js/aceObjectsToPackedOccurrenceCSIDsService';
import acePartialSelectionService from 'js/acePartialSelectionService';
import soa_dataManagementService from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';

var exports = {};

var distanceUnitLabel = null;
var unitOfMeasurement = null;

/**
 * If number of valid targets to be shown on proximity subpanel are more than proximityValidTargetThreshold, list view of valid targets will be shown.
 * Changing this threshold value, would also require change in ProximitySubPanelView.html
 */
const proximityValidTargetThreshold = 5;

/**
 * Build a single string filter that is displayed as a link.
 *
 * @param {object} filterValueObject The object that contains details about the filter values available.
 * @returns {Object} The string filter
 */
export let getFilterValue = function( filterValueObject ) {
    var filterValue = {};
    filterValue.name = filterValueObject.stringDisplayValue;
    filterValue.count = filterValueObject.count;
    filterValue.endDateValue = filterValueObject.endDateValue;
    filterValue.endNumericValue = filterValueObject.endNumericValue;
    filterValue.selected = filterValueObject.selected;
    filterValue.startDateValue = filterValueObject.startDateValue;
    filterValue.startStartEndRange = filterValueObject.startEndRange;
    filterValue.startNumericValue = filterValueObject.startNumericValue;
    filterValue.stringValue = filterValueObject.stringValue;
    filterValue.type = 'StringFilter';
    filterValue.showCount = false;
    if( filterValue.name === '' && filterValue.stringValue === '$NONE' ) {
        filterValue.name = 'Unassigned';
    }
    if( filterValueObject.hasChildren ) {
        filterValue.suffixIconId = 'cmdChild';
        filterValue.showSuffixIcon = true;
    }
    return filterValue;
};

/**
 * Get the valid objects for proximity filter
 *
 * @param {Boolean} isPanelInitializedWithProximityRecipe indicator if panel is already initialized with recipe
 * @param {Object} inputValidTargets view input valid targets
 * @param {Object} inputRecipeValidTargets view input targets from recipe being edited
 * @param {Object} sharedData shared data between parent and proximity view
 * @param {Object} occContext ace atomic data
 * @returns {Object} Valid proximity target objects
 */
export let getValidProximityTarget = function( isPanelInitializedWithProximityRecipe, inputValidTargets, inputRecipeValidTargets, sharedData, occContext ) {
    let validTargets = [];
    let areTargetsChanged;
    let elementNotFound;
    let nSelectedText;
    const localTextBundle = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    let propertiesToBeLoaded = [ 'awp0CellProperties', 'awb0ArchetypeRevName' ];
    let deferred = AwPromiseService.instance.defer();

    // Set targets from recipe term when initializing the panel
    if( !isPanelInitializedWithProximityRecipe && sharedData?.recipeTermToAdd && sharedData?.spatialRecipeIndexToUpdate >= 0 ) {
        let criteriaValues = sharedData.recipeTermToAdd.criteriaValues;
        let proximityObjUids = [];
        for( var i = 1; i < criteriaValues.length - 2; i++ ) {
            proximityObjUids.push( criteriaValues[i] );
        }
        // When valid target is not visible in tree, the awp0CellProperties are not loaded for it and so the target is not displayed in edit proximity panel
        // Hence, explicitly passing 'awp0CellProperties' as additional properties to be loaded
        // Get objects from CSIDs
        csidsToObjSvc.doPerformSearchForProvidedCSIDChains( proximityObjUids, 'true', propertiesToBeLoaded, 'true' ).then( function( response ) {
            if( !_.isEmpty( response.elementsInfo )  ) {
                let searchResultUIDs = [];
                _.forEach( response.elementsInfo, function( elementsInfo ) {
                    if( elementsInfo.element ) {
                        searchResultUIDs.push(  elementsInfo.element.uid  );
                    }
                } );
                validTargets = getModelObjectsFromUids( searchResultUIDs );
            } else{
                validTargets = getModelObjectsFromUids( proximityObjUids );
            }

            elementNotFound = getElementNotFoundIndicator( validTargets, proximityObjUids ) && !_.isUndefined( sharedData.recipeTermToAdd );
            areTargetsChanged =  areTargetsChangedFromInputRecipe( inputValidTargets, validTargets );

            if( validTargets.length > proximityValidTargetThreshold ) {
                nSelectedText = validTargets.length + ' ' + localTextBundle.nSelectedLabel;
            }
            deferred.resolve( { validTargets : validTargets, isPanelInitializedWithProximityRecipe: true, isInputChanged: areTargetsChanged, recipeValidTargets: validTargets,
                elementNotFound: elementNotFound, displayNSelectedText: nSelectedText } );
        } );
        return deferred.promise;
    }

    let selectionPathHasPacking = false;
    let isPartiallySelected = false;
    _.forEach( occContext.pwaSelection, function( selectedObject ) {
        /**
         * isPartiallySelected will be only true when, selection is done from 3D viewer, and selected and highligheted objects are different
         */
        if( !isPartiallySelected && acePartialSelectionService.isPartiallySelected( selectedObject.uid ) ) {
            isPartiallySelected = true;
        }
        // Check if any of the selection has pack master in the path
        if( !selectionPathHasPacking && occmgmtSubsetUtils.isPackedOccurrencePresentInParentHierarchy( selectedObject ) ) {
            selectionPathHasPacking = true;
        }
    } );
    if( !isPartiallySelected ) {
        if( selectionPathHasPacking ) {
            // When pack master is selected in PWA, we show all the pack nodes and pack master on proximity subpanel
            // So when pack master is selected, we get CSIDs for all the packed nodes for the pack master
            // From these CSIDs we get the elements to be displayed as valid targets
            // Get CSIDs for all the selected objects
            let promise = aceObjectsToPackedOccurrenceCSIDsService.getCloneStableIDsWithPackedOccurrences( occContext.productContextInfo, occContext.pwaSelection );
            promise.then( function( resultData ) {
                csidsToObjSvc.doPerformSearchForProvidedCSIDChains( resultData.csids, 'true', propertiesToBeLoaded, 'true' ).then( function( response ) {
                    if( !_.isEmpty( response.elementsInfo ) ) {
                        let searchResultUIDs = [];
                        _.forEach( response.elementsInfo, function( elementsInfo ) {
                            if( elementsInfo.element ) {
                                searchResultUIDs.push(  elementsInfo.element.uid  );
                            }
                        } );
                        validTargets = getModelObjectsFromUids( searchResultUIDs );
                        if( validTargets.length > proximityValidTargetThreshold ) {
                            nSelectedText = validTargets.length + ' ' + localTextBundle.nSelectedLabel;
                        }
                        areTargetsChanged =  areTargetsChangedFromInputRecipe( inputRecipeValidTargets, validTargets );
                        // Set false as we are dealing with selections from PWA
                        elementNotFound = false;
                        deferred.resolve( { validTargets : validTargets, isPanelInitializedWithProximityRecipe: isPanelInitializedWithProximityRecipe, isInputChanged: areTargetsChanged,
                            recipeValidTargets: inputRecipeValidTargets, elementNotFound: elementNotFound, displayNSelectedText: nSelectedText } );
                    }
                } );
            } );
            return deferred.promise;
        }
    } else {
        // This else part is for use case, when selection is done from 3D viewer and visibleElement and selectedElement are not same.
        // i.e. selection from 3D viewer and highlighted one in PWA are different.
        var awb0DeUids = occmgmtUtils.getSelectedObjectUids( occContext.pwaSelection );
        soa_dataManagementService.getProperties( awb0DeUids, propertiesToBeLoaded ).then( function() {
            validTargets = getModelObjectsFromUids( awb0DeUids );
            if( validTargets.length > proximityValidTargetThreshold ) {
                nSelectedText = validTargets.length + ' ' + localTextBundle.nSelectedLabel;
            }
            areTargetsChanged =  areTargetsChangedFromInputRecipe( inputRecipeValidTargets, validTargets );
            // Set false as we are dealing with selections done from 3D
            elementNotFound = false;
            deferred.resolve( { validTargets : validTargets, isPanelInitializedWithProximityRecipe: isPanelInitializedWithProximityRecipe, isInputChanged: areTargetsChanged,
                recipeValidTargets: inputRecipeValidTargets, elementNotFound: elementNotFound, displayNSelectedText: nSelectedText } );
        } );
        return deferred.promise;
    }
    // Set targets from PWA selections
    validTargets = occmgmtSubsetUtils.validateSelectionsToBeInSingleProductFromOccContext( true, occContext, true/*isFilterUsecase*/ );
    if( validTargets.length > proximityValidTargetThreshold ) {
        nSelectedText = validTargets.length + ' ' + localTextBundle.nSelectedLabel;
    }
    areTargetsChanged =  areTargetsChangedFromInputRecipe( inputRecipeValidTargets, validTargets );
    // Set false as we are dealing with selections from PWA or 3D
    elementNotFound = false;
    deferred.resolve( { validTargets: validTargets, isPanelInitializedWithProximityRecipe: isPanelInitializedWithProximityRecipe, isInputChanged: areTargetsChanged,
        recipeValidTargets: inputRecipeValidTargets, elementNotFound: elementNotFound, displayNSelectedText: nSelectedText } );
    return deferred.promise;
};

let getElementNotFoundIndicator = function( validTargets, proximityUids ) {
    if( _.isEmpty( validTargets ) ) {
        return true;
    }
    if( proximityUids && validTargets.length !== proximityUids.length ) {
        // Case: when some targets are filtered out and some filtered in
        return true;
    }
    return false;
};

export let getModelObjectsFromUids = function( objectUids ) {
    let validTargets = [];
    _.forEach( objectUids, function( uid ) {
        var obj = cdm.getObject( uid );

        if( obj ) {
            validTargets.push( obj );
        }
    } );
    return validTargets;
};
/**
 * Function to compare recipe term target objects and pwa selections
 *
 * @param {currentTargets} currentTargets recipe target objects
 * @param {newTargets} newTargets pwa selections
 * @returns {Boolean} true if recipe targets are same as pwa selections, false otherwise
 *
 */
let areTargetsChangedFromInputRecipe = function( currentTargets, newTargets ) {
    let areTargetsChanged = false;
    if( !currentTargets && newTargets || currentTargets && !newTargets  )    {
        return areTargetsChanged;
    }
    if( currentTargets && newTargets ) {
        if( currentTargets.length !== newTargets.length ) {
            return true;
        }
        _.forEach( currentTargets, function( currentTarget ) {
            var matchedTarget = _.find( newTargets, function( newTarget ) {
                if( newTarget.uid === currentTarget.uid ) {
                    return newTarget;
                }
            } );
            if( !matchedTarget ) {
                areTargetsChanged = true;
            }
        } );
    }
    return areTargetsChanged;
};

/**
 * Function to read the Distance unit of measure preference and the get the localized value for it
 *
 * @return {Promise} A promise that get resolved to return distance label
 */
export let getDistanceUnit = function() {
    var deferred = AwPromiseService.instance.defer();
    prefService.getStringValue( 'RDV_user_defined_units_of_measure' ).then( function( preferenceValue ) {
        var distanceLabel = null;
        if( preferenceValue ) {
            var distanceUnit = _.lowerCase( preferenceValue );

            //If Preference value is set to "UNKNOWN" then set the default UOM as "Meters". This is in synch with AW server code
            if( distanceUnit === 'unknown' ) {
                distanceUnit = 'meters';
            }
            unitOfMeasurement =  _.upperFirst( distanceUnit );
            var resource = 'OccurrenceManagementSubsetConstants';
            distanceLabel = localeSvc.getLocalizedText( resource, distanceUnit );
        }
        deferred.resolve( distanceLabel );
    } );
    return deferred.promise;
};

/**
 * Function to apply proximity filter
 *          -update the modified recipe on the appContext
 *          -trigger acePwa.reset event to reload content
 *
 * @param {Number} distanceValue distance value
 * @param {Object[]} validTargets valid targets for proximity
 * @param {Object} sharedData shared data with discovery panel
 * @param {Object} activeViewSharedData shared data to update active view
 * @param {Object} elementNotFound target elements missing
 */
export let applyProximityFilterInRecipe = function( distanceValue, validTargets, sharedData, activeViewSharedData, elementNotFound ) {
    var criteriaVal = [ 'SelectedElement' ];

    var targets = [];
    if( ( _.isEmpty( validTargets ) || elementNotFound ) && sharedData && sharedData.recipeTermToAdd && sharedData.recipeTermToAdd.criteriaValues ) {
        // This would be the distance edit case
        // Copy over targets from input  proximity recipe term
        for( var idx = 1; idx < sharedData?.recipeTermToAdd?.criteriaValues.length - 1; idx++ ) {
            criteriaVal.push(  sharedData.recipeTermToAdd.criteriaValues[ idx ] );
        }
    } else {
        targets = occmgmtSubsetUtils.getCSIDChainForSelected( validTargets );

        for( var i = 0; i < targets.length; i++ ) {
            criteriaVal.push( targets[ i ] );
        }
        //Check if true should work and enable.LCS-171974: Use Trueshape with proximity search - Enabled Trueshape by default. Corresponding UI widget will be exposed later based on need.
        criteriaVal.push( 'True' );
    }

    //CriteriaValues is String array
    //It is observed that sometimes viewModelProperty of type Double hold the string value, as a result there was no need to convert it to string.
    //But sometimes it has double value causing JSON parsing error. So convert the proximity double value to String before sending to server.
    criteriaVal.push( distanceValue.toString() );
    //- Set recipe operator based on category logic
    var recipeOperator = 'Filter';
    if ( sharedData && sharedData.recipeTermToAdd ) {
        //This is proximity recipe editing
        recipeOperator = sharedData.recipeTermToAdd.criteriaOperatorType;
    } else if ( sharedData && sharedData.recipeOperator ) {
        recipeOperator = sharedData.recipeOperator;
    }
    var displayString = createTransientProximityDisplayString( distanceValue, validTargets );
    var proximityCriteria = {
        criteriaType: 'Proximity',
        criteriaOperatorType: recipeOperator,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaVal,
        subCriteria: []
    };

    //Checking if this is recipe edit.
    var spatialRecipeIndexToUpdate;
    if( sharedData && sharedData.recipeTermToAdd ) {
        spatialRecipeIndexToUpdate = sharedData.spatialRecipeIndexToUpdate;
    }

    occmgmtSubsetUtils.updateSharedDataWithRecipeBeforeNavigate( activeViewSharedData, sharedData, proximityCriteria, spatialRecipeIndexToUpdate, 'Awb0DiscoveryFilterCommandSubPanel' );
};
/**
 * Function to  get the n-Selected Text
 *@param {String } inputLabel i18nLabel displayNSelected
 *@param {Object[]} validTargets valid targets for proximity
 * @returns{String} formatted Label
 */
export let getNSelectedText = function( inputLabel, validTargets ) {
    return inputLabel.replace( '{0}', validTargets.length );
};

/**
 * Function to toggle the n-Selected link
 * @param {Boolean} value isExpanded flag
 *  @return{Boolean} isExpanded flag
 */
export let toggleExpand = function( value ) {
    return  !value;
};

var createTransientProximityDisplayString = function( distanceValue, validTargets ) {
    var proximityDisplayString = '';
    var uomDisplayString = distanceUnitLabel;
    var filterSeparator = appCtxSvc.ctx.preferences.AW_FacetValue_Separator ? appCtxSvc.ctx.preferences.AW_FacetValue_Separator[ 0 ] : '^';

    if( validTargets !== null && validTargets.length > 0 ) {
        var targetDisplayString = '';
        for( var i = 0; i < validTargets.length; i++ ) {
            if( validTargets[ i ].props && validTargets[ i ].props.awb0UnderlyingObject ) {
                targetDisplayString = targetDisplayString.concat( validTargets[ i ].props.awb0UnderlyingObject.uiValues[ 0 ] );

                if ( i !== validTargets.length - 1 ) {
                    targetDisplayString = targetDisplayString.concat( filterSeparator );
                }
            }
        }

        var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
        proximityDisplayString = resource.proximityDisplayString
            .format( distanceValue, uomDisplayString, targetDisplayString );
    }
    return proximityDisplayString;
};

export let initializeProximityDataFromRecipeTerm = function( sharedData ) {
    let proximityRecipe = sharedData.recipeTermToAdd;
    let criteriaValues = proximityRecipe.criteriaValues;
    return { distanceValue: criteriaValues[criteriaValues.length - 1]  };
};


/**
 * initialize
 */
export let initialize = function() {
    var promise = exports.getDistanceUnit();
    if( promise ) {
        promise.then( function( distanceLabel ) {
            distanceUnitLabel = distanceLabel;
        } );
    }
};
/**
 * Function to  get the distance unit
 *
 *  @return{String} distance unit
 */
export let getDistanceText = function() {
    return unitOfMeasurement;
};

export default exports = {
    getFilterValue,
    getValidProximityTarget,
    getDistanceUnit,
    applyProximityFilterInRecipe,
    getNSelectedText,
    toggleExpand,
    initialize,
    getDistanceText,
    initializeProximityDataFromRecipeTerm,
    getModelObjectsFromUids
};
