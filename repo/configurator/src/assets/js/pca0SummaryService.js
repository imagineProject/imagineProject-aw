// Copyright (c) 2022 Siemens

/**
 * @module js/pca0SummaryService
 */
import appCtxSvc from 'js/appCtxService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import colorDecoratorService from 'js/colorDecoratorService';
import eventBus from 'js/eventBus';
import { getBaseUrlPath } from 'app';
import iconSvc from 'js/iconService';
import pca0Constants from 'js/Pca0Constants';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

// MutationObserver is a Web API provided by modern browsers for detecting changes in the DOM.
// With this API one can listen to newly added or removed nodes,
// attribute changes or changes in the text content of text nodes
var lastSelectedFeature = null;

/**
 * Sort based on products group, product lines and summary models
 * @param {Object} selection selection to be queried for sort sequence
 * @return {Integer} Sort sequence
 */
function _getSortSequence( selection ) {
    var typeHierarchy = _.get( selection, 'vmo.modelType.typeHierarchyArray', null );

    if( typeHierarchy !== null && typeHierarchy.includes( 'Cfg0AbsProductLine' ) ) {
        return -2;
    }
    if( typeHierarchy !== null && typeHierarchy.includes( 'Cfg0AbsSummaryModel' ) ) {
        return -1;
    }
    return 0;
}

/**
 * Get icon URL for unconfigured object
 * @returns {String} icon URL
 */
var _getUnconfiguredIconURL = function() {
    return iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_UNCONFIGURE_OBJ );
};

/**
 * Function to create tooltip information for non-gridable expressions if applicable.
 * @returns {Object} An object containing tooltip details, a flag indicating if the tooltip should be shown, and the URL of the warning icon.
 */
let _createExpressionNonGridableTooltipInfoIfApplicable = () => {
    // Get the FSC context.
    let fscContext = appCtxSvc.getCtx( 'fscContext' );

    // If the FSC context and its selected expressions exist, create tooltip information.
    if( fscContext && fscContext.selectedExpressions ) {
        // Define the URL of the warning icon.
        let attentionIconUrl = getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_ATTENTION;

        // Initialize a flag to not show the non-gridable expression tooltip.
        let showExpressionNonGridableTooltip = false;

        // Get the non-gridable expression list.
        const nonGridableExpressionsList = pca0CommonUtils.getNonGridableExpressionList( fscContext.selectedExpressions );

        // If a non-gridable expression exists, create tooltip details.
        if( !_.isEmpty( nonGridableExpressionsList )  ) {
            // Define the details of the non-gridable expression tooltip.
            let expressionNonGridableTooltipDetails = {
                legendType: 'NonGridableExpressionTooltip',
                legendItems: [],
                infoIconUrl : getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_INFO,
                isExpressionNonGridable: true
            };

            // Set the flag to show the non-gridable expression tooltip.
            showExpressionNonGridableTooltip = true;

            // Get the formula of the first non-gridable expression.
            const formula = _.get( fscContext.selectedExpressions[nonGridableExpressionsList[0]], '[0].formula' );

            // Create a view model property for the formula.
            let vmProp = uwPropertyService.createViewModelProperty(
                'fnd0formula', // propertyName
                'Formula', // propertyDisplayName
                'STRING', // dataType
                formula, // dbValue
                [ formula ] // displayValuesIn
            );

            // Set the field data for the view model property.
            vmProp.fielddata = {
                propertyDisplayName: 'Formula', // propertyName
                uiValue: formula
            };

            // Add the view model property to the legend items of the tooltip details.
            expressionNonGridableTooltipDetails.legendItems.push( vmProp );

            // Return the tooltip details, the flag, and the warning icon URL.
            return {
                expressionNonGridableTooltipDetails,
                showExpressionNonGridableTooltip,
                attentionIconUrl
            };
        }
    }

    // If the FSC context or its selected expressions do not exist, return an empty object.
    return {};
};

/**
 * Create a client side VMO for Unconfigured selection in summary
 * @param {String} displayName display name for unconfigured vmo
 * @return {Object} unconfigured VMO
 */
var _createUnconfiguredClientSideVMO = function( displayName ) {
    var iconName = pca0Constants.CFG_INDICATOR_ICONS.SVG_UNCONFIGURE_OBJ;
    return {
        modelType: {
            // needed to set icon by controller aw-image-cell.controller from aw-option-value-cell
            constantsMap: {
                IconFileName: iconName
            }
        },
        objectID: displayName,
        uid: '_unconfiguredFeature_',
        name: displayName,
        cellHeader1: displayName,
        cellHeader2: displayName,
        typeIconURL: _getUnconfiguredIconURL(),
        indicators: [],
        getId: function() {
            return this.uid;
        }
    };
};

var exports = {};

//ToDo to be revisited: disable for now as it doesn't work properly and also does not play nice with jest/unit testing.
// Initialize the MutationObserver
// track added nodes in the Summary User Selection looking for last selected feature
// export let callbackMutations = function( mutations ) {
//     mutations.forEach( function( mutation ) {
//         if( mutation.addedNodes.length !== 0 && lastSelectedFeature && lastSelectedFeature !== '' ) {
//             for( var idxNode = 0; idxNode < mutation.addedNodes.length; idxNode++ ) {
//                 if(mutation.addedNodes[ idxNode ].parentElement.className === "aw-cfg-fscSummaryUserSelectionsList"){
//                     $( mutation.addedNodes[ idxNode ] )[ 0 ].scrollIntoView();
//                                  exports.mutationObserver.disconnect();
//                                  break;
//                 }
//                 // if( mutation.addedNodes[ idxNode ].className === 'aw-widgets-cellListCellTitle' ) {
//                 //     if( mutation.addedNodes[ idxNode ].getAttribute( 'cellTitleid' ) === 'CellTitle' ) {
//                 //         if( mutation.addedNodes[ idxNode ].title === lastSelectedFeature ) {
//                 //             $( mutation.addedNodes[ idxNode ] )[ 0 ].scrollIntoView();
//                 //             exports.mutationObserver.disconnect();
//                 //             break;
//                 //         }
//                 //     }
//                 // }
//             }
//         }
//     } );
// };
// export let mutationObserver = new MutationObserver( callbackMutations );


/**
 * Toggle expand/collapse for User Selections section
 * @param {Object} data VM data
 * @return {Boolean} true if section is expanded
 */
export let toggleUserSelectionsSectionExpansion = function( data ) {
    return !data.userSelectionsSectionExpand;
};

/**
 * This method takes care of the state set/resets for own props and parent's
 * @param {String} summarystate - the prop to update passed from parent
 * */
export let initSummaryState = function( summarystate ) {
    // update the state of the parent and avoid having to use global context and events
    if( summarystate && summarystate.update ) {
        let newSummaryState = { ...summarystate.value };
        if( summarystate.getValue ) {
            newSummaryState = { ...summarystate.getValue() }; //assure it's fresh
        }

        //reset the isCompletenessStatusChipEnabled
        newSummaryState.isCompletenessStatusChipEnabled = false;
        newSummaryState.completenessStatus = '';
        newSummaryState.violationSeverity = '';
        if ( !_.isEqual( newSummaryState, summarystate.getValue() ) ) {
            summarystate.update( newSummaryState );
        }
    }
    return true;
};

/**
 * This method updates the completeness status in summary view
 * @param {Object} eventData - The eventData with completeness status needed to be set in summary view
 * @param {Object} summarystate - The summarystate atomic data
 * */
export let updateCompletenessStatus = function( eventData, summarystate ) {
    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    let newSubPanelContext = { ...summarystate.value };
    if( summarystate.getValue ) {
        newSubPanelContext = { ...summarystate.getValue() }; //assure it's fresh
    }
    if( _.get( eventData, 'CompletenessStatus.criteriaStatus' ) ) {
        newSubPanelContext.completenessStatus = eventData.CompletenessStatus.criteriaStatus[ 0 ];
    }
    let chipEnabled = newSubPanelContext.isCompletenessStatusChipEnabled;
    // When completeness status is changed we need to enable the chip
    if( !newSubPanelContext.isCompletenessStatusChipEnabled ) {
        chipEnabled = true;
    }
    newSubPanelContext.isCompletenessStatusChipEnabled = chipEnabled;
    if( !_.isEqual( newSubPanelContext, summarystate.getValue() ) ) {
    //reset the violation data if not in manual mode and valid state
        if( !newSubPanelContext.isManualConfiguration && newSubPanelContext.completenessStatus !== 'InValid' ) {
            newSubPanelContext.violationSeverity = '';
            newSubPanelContext.violationMessages = [];
        }
        summarystate.update( newSubPanelContext );
    }
};

/**
 * This method disables the completeness status chip in summary view - called when user makes
 * a selection and the previous expand becomes invalid
 * @param {String} summarystate - the prop to update passed from parent
 * */
export let disableCompletenessStatusChip = function( summarystate ) {
    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    let newSubPanelContext = { ...summarystate.value };
    if( summarystate.getValue ) {
        newSubPanelContext = { ...summarystate.getValue() }; //assure it's fresh
    }
    let chipEnabled = newSubPanelContext.isCompletenessStatusChipEnabled;
    if( chipEnabled ) {
        chipEnabled = false;
        newSubPanelContext.isCompletenessStatusChipEnabled = chipEnabled;
        summarystate.update( newSubPanelContext );
    }
    // delete violations and responseInfo only when we are changing the depth.
    // do not delete when changing the layout or on feature selection
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( fscContext.reassessSelections ) {
        delete fscContext.violations;
        delete fscContext.responseInfo;
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }
};


/**
 * This method populates the 'loadedVariantsList' in view data
 * Updates data provider for the "Variant" summary section
 * If no variant rule is loaded, "Custom Configuration" is displayed
 * @param {Object} summaryState - The summary atomic data state prop
 * @param {Object} loadedSavedVariantsProvider - loaded SVR Provider in order to update selection
 *
 *
 * @returns {Object} Contains loades SVR
 */
export let getLoadedSavedVariants = function( summarystate, loadedSavedVariantsProvider ) {
    var loadedVariantsList = [];
    var fscContext = appCtxSvc.getCtx( 'fscContext' );
    var initialVariantRule;

    if( fscContext && fscContext.initialVariantRule ) {
        //decorator on the object will get lost using spread operator or if simply copy the uid and the cell
        //headers like with the custom config below. The entire object will get replaced with found model object uid and will
        //construct new vmo based on it  but without the decorators.
        initialVariantRule = _.clone( fscContext.initialVariantRule );
    } else {
        // Create VMO
        // Initialize cellHeaderText with "New Variant" for the cell header for VCV in CC,
        // Initialize cellHeaderText with "Custom Configuration" for the cell header for VCV in Consumer Apps
        const fscLocaleBundle = configuratorUtils.getFscLocaleTextBundle();
        const cellHeaderText = _.get( fscContext, 'isVCVOpenedFromConfigurator' ) ? fscLocaleBundle.newVariant : fscLocaleBundle.customConfigurationTitle;
        const svrIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_VARIANT_RULE;
        const imageIconUrl = iconSvc.getTypeIconURL( svrIconName );
        initialVariantRule = {
            uid: '__custom__configuration__',
            cellHeader1: cellHeaderText,
            cellHeader2: cellHeaderText,
            typeIconURL: imageIconUrl
        };
    }
    loadedVariantsList[ 0 ] = initialVariantRule;
    delete loadedVariantsList[ 0 ].selected;

    // Update Indicator
    loadedVariantsList[ 0 ].indicators = [];
    let val = _.get( summarystate, 'value' ) ? summarystate.getValue() : undefined;
    if( val && val.variantRuleDirty ) {
        var indicator = {
            tooltip: configuratorUtils.getFscLocaleTextBundle().unsavedChanges,
            image: 'indicatorUnsaved'
        };
        loadedVariantsList[ 0 ].indicators.push( indicator );
    }

    loadedVariantsList[ 0 ].colorTitle = 'Unique';
    var decoratorStyle = '';
    if( val ) {
        decoratorStyle = exports.getDecoratorsStyle( val.variantRuleDirty );
    }
    loadedVariantsList[ 0 ].cellDecoratorStyle = decoratorStyle;
    loadedVariantsList[ 0 ].gridDecoratorStyle = decoratorStyle;
    colorDecoratorService.setDecoratorStyles( loadedVariantsList[ 0 ] );
    eventBus.publish( 'decoratorsUpdated', loadedVariantsList[ 0 ] );

    //also clean dp of any items it may contain do not rely on the return value, it does not always work, some timing issue
    loadedSavedVariantsProvider.viewModelCollection.clear();
    loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects = [ loadedVariantsList[ 0 ] ];
    loadedSavedVariantsProvider.viewModelCollection.setTotalObjectsFound( 1 );

    return loadedVariantsList;
};

/**
 * This method provides decorators style on Variant cell for loaded SVR
 * Change is according to isDirty status on the context
 * @param {Object} variantRulePanelDirty - dirty flag
 * @return {String} decorator style
 */
export let getDecoratorsStyle = function( variantRulePanelDirty ) {
    if( variantRulePanelDirty ) {
        return 'aw-widgets-showCellDecorator aw-cfg-fscBorder-chartColorModified';
    }
    return 'aw-widgets-showCellDecorator aw-cfg-fscBorder-chartColorUnchanged';
};

/**
 * This API returns initialVariantRule only when selections are undefined
 *
 * @returns {String} initialVariantRule - Returns the currently active variant rule
 */
export let getActiveVariantRules = function() {
    var context = appCtxSvc.getCtx( 'fscContext' );
    if( context.selectedExpressions === undefined ) {
        return [ context.initialVariantRule ];
    }
    return null;
};


export let showViolationInfoInFscSummary = function( eventData, summarystate ) {
    var severity = summarystate.violationSeverity;
    var violationMessages = [];
    if( eventData && eventData.summaryViolationsInfo !== undefined ) {
        //errror  trumps the rest so set it if you find some
        if( eventData.summaryViolationsInfo.some( d => d.props.serverity[ 0 ] === 'error' ) ) {
            severity = 'error';
        } else if( eventData.summaryViolationsInfo.some( d => d.props.serverity[ 0 ] === 'warning' ) ) {
            severity = 'warning';
        } else {
            severity = 'info';
        }

        _.forEach( eventData.summaryViolationsInfo, function( info ) {
            let violationMessage = info.displayName;
            if( info.props.moduleHierarchyPath ) {
                let newViolationMessage = configuratorUtils.buildViolationMessageWithModuleHierarchyPath( info.props.moduleHierarchyPath,  violationMessage );
                violationMessage = newViolationMessage;
            }
            violationMessages.push( { message: violationMessage, icon: info.props.serverity[ 0 ] } );
        } );
    } else if( _.get( eventData, 'violationLabels.violations' ) ) {
        let warningsFound = false;
        let errorsFound = false;
        let violations = _.get( eventData, 'violationLabels.violations' );
        let numOfViolations = violations.length;
        for( let ix = 0; ix < numOfViolations; ix++ ) {
            let violation = violations[ ix ];
            for( let [ key, value ] of Object.entries( violation.nodeMap ) ) {
                if( value && Array.isArray( value ) ) {
                    if( value.some( x => x.props.serverity[ 0 ] === 'error' ) ) {
                        errorsFound = true;
                        violationMessages.push( { message: value[ 0 ].displayName, icon: 'error' } );
                    } else if( value.some( x => x.props.serverity[ 0 ] === 'warning' ) ) {
                        warningsFound = true;
                        violationMessages.push( { message: value[ 0 ].displayName, icon: 'warning' } );
                    } else if( value.some( x => x.props.serverity[ 0 ] === 'info' ) ) {
                        violationMessages.push( { message: value[ 0 ].displayName, icon: 'info' } );
                    }
                }
            }
        }

        // Set the db value of severity
        if( errorsFound ) {
            severity = 'error';
        } else if( warningsFound ) {
            severity = 'warning';
        } else {
            severity = 'info';
        }
    } else {
        severity = '';
    }

    //those states are in the atomic data of the parent because of the layout change that requires the summary panel to reload
    //before doing anything get the fresh state of summary service data, you cannot rely on data transmitted from view model
    let newSubPanelContext = { ...summarystate.getValue() };
    newSubPanelContext.violationSeverity = severity;
    newSubPanelContext.violationMessages = violationMessages;
    if ( !_.isEqual( newSubPanelContext, summarystate.getValue() ) ) {
        summarystate.update( newSubPanelContext );
    }

    let violationLabel = '';
    if( eventData ) {
        //only show the NoViolations if there was a validate/expand action, otherwise the defualt is ''
        violationLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().noViolations;
        if( !_.isEmpty( eventData.validationErrorMessage ) ) {
            violationLabel = eventData.validationErrorMessage;
        }
    }

    return {
        violationLabel: violationLabel,
        violationMessages: violationMessages
    };
};


export let updateUserSelectionsSectionExpansion = function( data ) {
    var productSelections = !_.isUndefined( data.productSelections ) && data.productSelections.hasData ? 1 : 0; // don;t care about actual length
    var userSelections = !_.isUndefined( data.userSelectionsList ) ? data.userSelectionsList.length : 0;
    return productSelections + userSelections > 0;
};


/**
 * This method is just an interim workaround and a backup for now in case we ever run into the duplicate vmo situation
 * because in certain situations that vary, probably timing issues, the view model collection can get a duplicate vmo in the AwList ViewModelCollection.
 * This is a todo for next release as we should not use awList for one object only.
 * It will forcefully remove the second one if that situation ever occurs, otherwise it simply returns the loadedVMObjects
 * @param {Object} loadedSavedVariantsProvider - loadedSavedVariantsProvider
 * @return {Object} loadedVMObjects
 */
export let removeDuplicates = function( loadedSavedVariantsProvider ) {
    let loadedObj = loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects;
    if( loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects &&
        loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects.length > 1 ) {
        loadedSavedVariantsProvider.viewModelCollection.clear();
        loadedSavedVariantsProvider.viewModelCollection.loadedVMObjects = [ loadedObj[ 0 ] ];
        loadedSavedVariantsProvider.viewModelCollection.setTotalObjectsFound( 1 );
    }
    return loadedObj;
};

/**
 * Function to set the loaded variant in a chip.
 * @param {Object} loadedVariantsList - The loaded SVR.
 * @param {Array} variantChip - The variant chip to update the loaded SVR name.
 * @param {Boolean} isExpressionNonGridable - Flag indicating if the expression is non-gridable.
 * @returns {Object} An object containing the updated variant chip and tooltip information if the expression is non-gridable.
 */
export let setLoadedVariantInChip = function( loadedVariantsList, variantChip, isExpressionNonGridable ) {
    // This function is an action of observer of the field 'isExpressionNonGridable', which gets triggered
    // when resetContextAndAtomicData is called. But by that time, loadedVariantsList is not yet updated
    // by summary provider. Hence, this function is called twice, first time with loadedVariantsList as empty array
    // Hence, just return the function if loadedVariantsList is empty.
    if( _.isEmpty( loadedVariantsList ) ) {
        return { newVariantChip: variantChip, nonGridableExpressionTooltipInfo: {} };
    }
    // Define the SVR icon name.
    const svrIconName = pca0Constants.CFG_OBJECT_TYPES.TYPE_VARIANT_RULE;

    // Define the URL of the image icon.
    // If the expression is non-gridable, use the warning icon.
    // Otherwise, use the type icon of the SVR.
    const imageIconUrl = isExpressionNonGridable ? getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_ATTENTION : iconSvc.getTypeIconURL( svrIconName );

    // Create a new variant chip from the existing one.
    let newVariantChip = { ...variantChip };

    // Set the icon ID and label display name of the new variant chip.
    newVariantChip[0].iconId = imageIconUrl;
    newVariantChip[0].labelDisplayName = loadedVariantsList[0] ? loadedVariantsList[0].cellHeader1 : '';

    // Create tooltip information for the new variant chip if the expression is non-gridable.
    const nonGridableExpressionTooltipInfo = isExpressionNonGridable ? _createExpressionNonGridableTooltipInfoIfApplicable() : {};

    // Return the new variant chip and the tooltip information.
    return { newVariantChip, nonGridableExpressionTooltipInfo };
};

/**
 * Toggles the Module Hierarchy tree visibility based on the shouldShow parameter.
 * @param {Object} fscState - The FscState atomic data.
 * @param {Boolean} shouldShow - Flag indicating if the Module Hierarchy tree should be shown.
 */
export let updateModuleHierarchyVisibility = ( fscState, shouldShow ) => {
    let newState = { ...fscState.getValue() };
    if( shouldShow === fscState.showModuleHierarchy ) {
        return;
    }
    newState.showModuleHierarchy = shouldShow;
    fscState.update( newState );
};

/**
 * Shows the breadcrumb based on the current configuration module hierarchy.
 * @param {Object} fscState - The FscState atomic data.
 * @returns {Array} An array of breadcrumbs.
 */
export let showBreadcrumb = ( fscState ) =>{
    if( fscState.showModuleHierarchy ) {
        return [];
    }
    const fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    let rootName = _.get( fscContext, 'currentConfigPerspective.props.cfg0ProductItems.uiValues.0' );
    if ( !rootName ) {
        rootName = '';
    }
    let configurationModulePath = _.get( fscContext, 'configurationModuleHierarchy' );
    const crumbs = [];
    if( !fscState.showModuleHierarchy ) {
        if( configurationModulePath && configurationModulePath.split( ':' ).length > 0 ) {
            const uids = configurationModulePath.split( ':' );
            const hierarchyDepth = uids.length;
            for( let ind = hierarchyDepth - 1; ind >= 0; ind-- ) {
                let vmo = viewModelObjectSvc.createViewModelObject( uids[ind] );
                if( vmo ) {
                    const crumb = {
                        clicked: false,
                        displayName: vmo.props.object_name.uiValue,
                        selectedCrumb: false,
                        showArrow: true
                    };
                    // If the current crumb is the last one in the hierarchy, set the showArrow property to false.
                    if( ind === 0 ) {
                        crumb.showArrow = false;
                        crumb.selectedCrumb = true;
                    }
                    crumbs.push( crumb );
                }
            }
        } else {
            // If the configuration module hierarchy is not available, show the root name as the breadcrumb.
            const crumb = {
                clicked: false,
                displayName: rootName.split( '-' ).slice( -1 )[0],
                selectedCrumb: true,
                showArrow: false,
                primaryCrumb: true
            };
            crumbs.push( crumb );
        }
    }
    return crumbs;
};

export default exports = {
    initSummaryState,
    updateCompletenessStatus,
    disableCompletenessStatusChip,
    getLoadedSavedVariants,
    getDecoratorsStyle,
    getActiveVariantRules,
    showViolationInfoInFscSummary,
    updateUserSelectionsSectionExpansion,
    removeDuplicates,
    setLoadedVariantInChip,
    updateModuleHierarchyVisibility,
    showBreadcrumb
};
