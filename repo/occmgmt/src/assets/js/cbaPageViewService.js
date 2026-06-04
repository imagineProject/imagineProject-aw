// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/cbaPageViewService
 */

import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import cbaConstants from 'js/cbaConstants';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';
import cbaConfigurationBaselineService from 'js/cbaConfigurationBaselineService';

/**
 * Clean up CBA specific variable from context
 */
let _unRegisterCbaVariable = function() {
    let doNotClearCBACtxVars = appCtxSvc.getCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS );
    if ( doNotClearCBACtxVars ) {
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DO_NOT_CLEAR_CBA_VARS, false );
        return;
    }

    appCtxSvc.unRegisterCtx( 'modelObjectsToOpen' );
    CadBomOccurrenceAlignmentUtil.unRegisterSplitViewMode();
    appCtxSvc.unRegisterCtx( 'taskUI' );
    appCtxSvc.unRegisterCtx( 'cbaContext' );
    appCtxSvc.unRegisterCtx( 'cadbomalignment' );

    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    appCtxSvc.updateCtx( 'hideRightWall', undefined );
    CadBomOccAlignmentCheckService.unRegisterService();

    appCtxSvc.updatePartialCtx( 'taskbarfullscreen', false );
    appCtxSvc.unRegisterCtx( 'hiddenCommands' );
    cbaConfigurationBaselineService.unRegisterCbaConfigurationBaselineHandler();
};

export const destroyCbaPageView = ( ) => {
    _unRegisterCbaVariable();
};

export const exitAlignmentMode = ( occContext, occContext2 ) => {
    let appCtx = appCtxSvc.getCtx();
    let activeContext = appCtx.aceActiveContext.key === 'CBASrcContext' ? occContext : occContext2;
    appCtxSvc.updatePartialCtx( 'resetTreeExpansionState', true );

    let navigationParams = {
        uid: activeContext.currentState.uid,
        c_uid: activeContext.currentState.c_uid,
        pci_uid: activeContext.currentState.pci_uid,
        o_uid: activeContext.currentState.o_uid,
        t_uid: activeContext.currentState.t_uid,
        spageId: activeContext.currentState.spageId,
        gesture: 'dualContextExit'
    };
    AwStateService.instance.go( 'com_siemens_splm_clientfx_tcui_xrt_showObject', navigationParams );
};

const exports = {
    destroyCbaPageView,
    exitAlignmentMode
};
export default exports;
