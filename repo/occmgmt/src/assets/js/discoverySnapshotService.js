// Copyright (c) 2022 Siemens

/**
 * @module js/discoverySnapshotService
 */
import appCtxSvc from 'js/appCtxService';
import viewModeSvc from 'js/viewMode.service';
import navigationSvc from 'js/navigationService';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import ctxStateMgmtService from 'js/aceContextStateMgmtService';
import discoverySubscriptionService from 'js/discoverySubscriptionService';


var exports = {};

export let openProductSnapshotOutsideACE = function( snapshotobj, navigateIn ) {
    let snapshotUid;
    //Change the viewMode
    if( viewModeSvc.getViewMode !== 'TreeSummaryView' ) {
        appCtxSvc.updatePartialCtx( 'preferences.AW_SubLocation_OccurrenceManagementSubLocation_ViewMode', [ 'TreeSummaryView' ] );
    }
    if( !( snapshotobj && snapshotobj.modelType && snapshotobj.modelType.typeHierarchyArray.includes( 'Fnd0Snapshot' ) ) ) {
        if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType.typeHierarchyArray.includes( 'Fnd0Snapshot' ) ) {
            snapshotobj = appCtxSvc.ctx.selected;
            snapshotUid = snapshotobj.uid;
        } else {
            return;
        }
    } else if ( snapshotobj && snapshotobj.uid ) {
        snapshotUid = snapshotobj.uid;
    }

    if( snapshotobj.props.fnd0Roots ) {
        let productToOpen = snapshotobj.props.fnd0Roots.dbValues[ 0 ];
        //Navigate
        let navigationParams = {
            uid: productToOpen,
            pageId: 'tc_xrt_Content',
            snap_uid: snapshotUid
        };
        let action = {
            actionType: 'Navigate',
            navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
        };

        if( navigateIn ) {
            action.navigateIn = navigateIn;
        }
        return navigationSvc.navigate( action, navigationParams );
    }
};

export let openProductSnapshotViaTile = function( snapshotobj ) {
    let objsToLoad = [ snapshotobj.cmdArgs[0] ];
    return dmSvc.loadObjects( objsToLoad )
        .then( function() {
            let snapshotObject = cdm.getObject( snapshotobj.cmdArgs[0] );
            exports.openProductSnapshotOutsideACE( snapshotObject );
        } );
};

export let openProductSnapshotInsideACE = function( snapshotobj, occContext ) {
    if( !snapshotobj || !occContext ) {
        return;
    }
    if( !snapshotobj.props ) {
        snapshotobj = cdm.getObject( snapshotobj.uid );
    }
    if( snapshotobj.props && snapshotobj.props.fnd0Roots ) {
        let productToOpen = snapshotobj.props.fnd0Roots.dbValues[ 0 ];
        let snapshotUid = snapshotobj.props.fnd0Roots.parentUid;
        //Navigate
        let newState = {
            uid: productToOpen,
            pageId: 'tc_xrt_Content',
            snap_uid: snapshotUid
        };
        if( occContext ) {
            ctxStateMgmtService.updateContextState( undefined, newState, true, occContext );
        }
    }
};

export default exports = {
    openProductSnapshotOutsideACE,
    openProductSnapshotViaTile,
    openProductSnapshotInsideACE
};
