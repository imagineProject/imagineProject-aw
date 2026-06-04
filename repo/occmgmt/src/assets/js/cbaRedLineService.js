// Copyright (c) 2023 Siemens

/**
 * Service for CBA redlining
 * @module js/cbaRedLineService
 */
import appCtxSvc from 'js/appCtxService';
import LocationNavigationService from 'js/locationNavigation.service';
import cbaConstants from 'js/cbaConstants';
import occmgmtUtils from 'js/occmgmtUtils';
import cadBomAlignmentUtil from 'js/CadBomAlignmentUtil';

/**
 * Update State params
 * @param {object} redLineToggleState - redLine toggle state to be updated on URL
 * @param {object} cbaContext - cbaContext
 */
export let updateRedLineState = function( redLineToggleState, cbaContext ) {
    let toggleState = cadBomAlignmentUtil.getBooleanValue( redLineToggleState );
    let valueToUpdate = {
        redLineMode:{
            isChangeEnabled: toggleState
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, cbaContext );

    appCtxSvc.updatePartialCtx( 'cadbomalignment.redLineMode.isChangeEnabled', toggleState );
    appCtxSvc.updatePartialCtx( 'cbaContext.redLineMode.isChangeEnabled', toggleState );
    appCtxSvc.updatePartialCtx( 'cbaContext.redLineMode.isModeChanged', true );

    appCtxSvc.updatePartialCtx( 'state.params.isRL_mode', toggleState.toString() );

    let toParams = appCtxSvc.getCtx( 'state.params' );
    let transitionTo = 'CADBOMAlignment';
    LocationNavigationService.instance.go( transitionTo, toParams );
};

/**
   * Updating CBASrcContext and CBATrgContext context isChangeEnabled
   * @param {string} activeContext - active context.
   * @param {string} changeToggleState - true if change is enabled else false.
   */
export let updateCtxWithRedLineMode = function( activeContext, changeToggleState ) {
    appCtxSvc.updatePartialCtx( activeContext + '.isChangeEnabled', changeToggleState === true );
    appCtxSvc.updateCtx( 'isRedLineMode', changeToggleState );
};

/**
 * Update Redlnes toggle state
 * @param {boolean} redLineToggleState - redlines toggle state
 * @returns {boolean} - true if change is enabled else return false.
 */
export let updateRedLineToggleState = function( redLineToggleState ) {
    let toggleState = cadBomAlignmentUtil.getBooleanValue( redLineToggleState );

    if( !toggleState ) {
        let srcContext = appCtxSvc.getCtx( cbaConstants.CBA_SRC_CONTEXT );
        let trgContext = appCtxSvc.getCtx( cbaConstants.CBA_TRG_CONTEXT );

        // Scenario: if create DBOM and EBOM with no ECN, redlining toggle doesn't display in CBA view
        // If revise top node of DBOM/EBOM with ECN, redlining toggle will display in CBA view
        if( srcContext && srcContext.isChangeEnabled ) {
            toggleState = srcContext.isChangeEnabled;
        } else if( trgContext && trgContext.isChangeEnabled ) {
            toggleState = trgContext.isChangeEnabled;
        }
    }
    return toggleState;
};

/**
 * CAD-BOM Redlining Service
 */

const exports = {
    updateRedLineState,
    updateCtxWithRedLineMode,
    updateRedLineToggleState
};
export default exports;
