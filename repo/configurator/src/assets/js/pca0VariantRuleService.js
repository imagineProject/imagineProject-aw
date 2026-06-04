// Copyright (c) 2022 Siemens

/**
 * @module js/pca0VariantRuleService
 */
import appCtxSvc from 'js/appCtxService';
import colorDecoratorService from 'js/colorDecoratorService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import _ from 'lodash';

/**
 * Filter out only the selected objects in PWA
 * @param {Object} selectedObjects selected/unselected objects in PWA
 * @returns {Array} filteredSelectedObjects
 */
let _filterSelectedObjects = ( selectedObjects )=>{
    if( selectedObjects ) {
        let filteredSelectedObjects = selectedObjects.filter( selectedObject => selectedObject.selected === true );
        return filteredSelectedObjects.length > 0 ? filteredSelectedObjects : undefined;
    }
    return undefined;
};

/**
 * Adds tooltips to cell indicators based on the violation messages of ViewModelObjects (vmos).
 * @param {NodeList} cellIndicators - A NodeList of cell indicator elements that need tooltips.
 * @param {Array} vmos - An array of ViewModelObjects that contain the violation messages.
 */
let _getTooltipForCellIndicators = ( cellIndicators, vmos ) => {
    let vmoIndex = 0;
    cellIndicators.forEach( cellIndicator => {
        if ( cellIndicator.vmo.showDecorator ) {
            while ( vmoIndex < vmos.length ) {
                if ( vmos[vmoIndex].showDecorator ) {
                    let dataDetails = vmos[vmoIndex].violationMessage?.map( ( msg, index ) => `${index + 1}. ${msg}` ).join( '\n' );
                    cellIndicator.setAttribute( 'title', dataDetails );
                    vmoIndex++;
                    break;
                }
                vmoIndex++;
            }
        }
    } );
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * @param {Object} subPanelContext subPanel context
 * @param {Boolean} isVCVOpenedFromConfigurator flag to identify if the FSC is opened from Variants tab
 */
export let updateXrtContextAndPopulateSyncObject = function( subPanelContext, isVCVOpenedFromConfigurator ) {
    // Update XRT context with PWA selection
    pca0ConfiguratorExplorerCommonUtils.updateXrtContext( subPanelContext );

    // Populate selection object with configurator context
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( !_.isEmpty( configuratorCtx ) ) {
        Object.assign( configuratorCtx, {
            variantRuleData: {
                selectedObjects: _filterSelectedObjects( subPanelContext.selection ),
                isVCVOpenedFromConfigurator: isVCVOpenedFromConfigurator
            }
        } );
        appCtxSvc.updateCtx( veConstants.CONFIG_CONTEXT_KEY, configuratorCtx );
    }
};

/**
 * Initialize Component
 */
export let initComponent = function() {
    let configuratorCtx = { ..._.get( appCtxSvc, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) };
    if( configuratorCtx && !_.isUndefined( configuratorCtx.appliedSettings ) ) {
        const revisionRule = _.get( configuratorCtx, 'appliedSettings.configSettings.props.pca0RevisionRule' );
        const revisionRuleData = {
            appliedRevisionRule: revisionRule,
            contextKey: veConstants.CONFIG_CONTEXT_KEY
        };
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', revisionRuleData );
    }
};

/**
 * This function either switches to the Variant Configuration tab or refreshes it.
 * @param {Object} subLocationState - The current state of the sub-location.
 */
export const switchToOrRefreshVariantConfigTab = ( subLocationState ) => {
    // Change view mode to table with summary only if it current view mode is Single Panel
    const currentLayout = subLocationState.layoutContext.layoutId;
    if( currentLayout === 'Awp0SinglePaneLayout' ) {
        pca0ConfiguratorExplorerCommonUtils.changeViewModeInConfiguratorContext( subLocationState, 'Awp0LeftRightLayout' );
    }

    // Clone the subLocationState object to avoid modifying the original object
    const updatedSubLocationState = { ...subLocationState.getValue() };

    // If the current active tab is not the Variant Configuration tab, switch to that tab
    if ( updatedSubLocationState.secondaryActiveTabId !== 'Pca0MultipleVariantsConfiguration' && subLocationState.update ) {
        updatedSubLocationState.secondaryActiveTabId = 'Pca0MultipleVariantsConfiguration';
        subLocationState.update( updatedSubLocationState );

    // If the current active tab is the Variant Configuration tab, reload the tab by publishing a 'reloadConfirmed' event
    } else if ( updatedSubLocationState.secondaryActiveTabId === 'Pca0MultipleVariantsConfiguration' ) {
        // It is empty event data because No Variant Rule is to be currently active.
        eventBus.publish( 'Pca0FullScreenConfiguration.reloadConfirmed', {} );
    }
};

/**
 * Open filter dialog for variants
 * @param {Object} commandContext - Required details for filter dialog
 * @param {string} dialogID - ID of dialog
 */
export const openVariantsFilterDialog = ( commandContext, dialogID ) => {
    const { dialogAction } = commandContext;
    // Check the type category info is already populated or not, if not perform SOA call and cache the category data
    // Use the cached data for subsequent calls
    commandContext = {
        searchState : commandContext.searchState,
        dialogAction : commandContext.dialogAction
    };
    let options = {
        view: dialogID,
        placement: 'left',
        push: true,
        global: true,
        parent: '.aw-layout-workarea',
        width: 'SMALL',
        height: 'FULL',
        subPanelContext: { ...commandContext },
        isCloseVisible: false,
        commandid: 'Pca0FilterVariants',
        commandicon: 'cmdFilterActive'
    };
    dialogAction.show( options );
};
/**
  * This function will add the newly created variant in variants table.
  * Add it on top in primary work area table and append the selection.
  * @param {Object} modelObjects modelObjects containing newly created variant rule
  * @param {Object} dataProvider dataProvider which needs to be updated
  * @param {Number} totalFound total number of constraints found
  * @param {Array} newlyCreatedObjUids newly created object uids
  * @param {Boolean} shouldAppendToSelection flag to identify if the new variant should be appended to selection
  * @returns {Object} updated totalFound and newlyCreatedObjUids
  */
export let addCreatedVariantToPWA = ( modelObjects, dataProvider, totalFound, newlyCreatedObjUids, shouldAppendToSelection ) => {
    const createdVariant = modelObjects.objects[0];
    let variants = [ ...dataProvider.viewModelCollection.loadedVMObjects ];
    // Add the newly created variant on top of the table
    variants.unshift( createdVariant );
    dataProvider.update( variants, totalFound + 1 );
    // Select the newly created variant
    //add the new saved variant to the selection if multiple variants selected ( the new variants samed scenario)
    //or else if nothing was selected or only a single one was selected before, select the new variant - former path
    let selectedVariants = [];
    if( ( !dataProvider.selectedObjects || dataProvider.selectedObjects.length <= 1 ) && !shouldAppendToSelection ) {
        selectedVariants.push( createdVariant.uid );
    } else {
        // If multiple variants were selected, add the new variant to the selection as the first one.
        // this is the use case in multivariants when saveAS is performed on a particular variant.
        selectedVariants = dataProvider.selectedObjects.map( selectedObject => selectedObject.uid );
        selectedVariants.unshift( createdVariant.uid );
    }
    dataProvider.selectionModel.setSelection( selectedVariants );

    // Update the current applied VRs in FSC context.
    // This is required to initialize the editHandler When we create new variant rule from Variants tab.
    // need to initialize the editHandler with the newly created variant rule, so that we leaveHandler gets called whenever SWA is dirty.
    let fscContext = appCtxSvc.getCtx( pca0Constants.FSC_CONTEXT );
    if( fscContext ) {
        fscContext.currentAppliedVRs = [ createdVariant.uid ];
        appCtxSvc.updateCtx( pca0Constants.FSC_CONTEXT, fscContext );
    }

    totalFound += 1;
    newlyCreatedObjUids.push( createdVariant.uid );
    return { totalFound, newlyCreatedObjUids };
};

/**
 * Post processing of validateProductConfigurations SOA - for successful SOA response
 * updates ViewModelObjects with showDecorator flag and shows Invalid configurations
 * @param {Object} validateSoaResponse Validation SOA response
 * @param {Object} dataProvider dataProvider which needs to be updated
 */
export let postProcessValidateProductConfigurations = ( validateSoaResponse, dataProvider ) => {
    let vmos = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let validSelections = true;

    // Update vmos with showDecorator flag and violationMessage
    vmos.forEach( vmo => {
        vmo.showDecorator = false;
        if ( validateSoaResponse[vmo.uid] && validateSoaResponse[vmo.uid].criteriaStatus === false ) {
            vmo.violationMessage = validateSoaResponse[vmo.uid].valueToViolations?.[vmo.uid].messages;
            vmo.showDecorator = true;
            validSelections = false;
        }
    } );
    // Apply decorator styles
    colorDecoratorService.setDecoratorStyles( vmos );
    // Add tooltip to cell indicator after setting decorator styles
    const cellIndicators = document.querySelectorAll( '.aw-splm-tablePinnedRow.ui-grid-row-selected.aw-state-selected' );
    _getTooltipForCellIndicators( cellIndicators, vmos );

    // Show appropriate message based on validation result
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
    if( validSelections ) {
        messagingService.showInfo( localeTextBundle.variantsValidationValidMessage );
    } else{
        messagingService.showWarning( localeTextBundle.variantsValidationInValidMessage );
    }
};

export default exports = {
    updateXrtContextAndPopulateSyncObject,
    initComponent,
    switchToOrRefreshVariantConfigTab,
    openVariantsFilterDialog,
    addCreatedVariantToPWA,
    postProcessValidateProductConfigurations
};
