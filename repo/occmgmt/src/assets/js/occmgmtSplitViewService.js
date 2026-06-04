import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import occMgmtServiceManager from 'js/aceServiceManager';
import dataManagementService from 'soa/dataManagementService';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import aceSwaService from 'js/aceSwaService';
import _ from 'lodash';
import Debug from 'debug';
const trace = new Debug( 'selection' );
import logger from 'js/logger';
import typeDisplayNameSvc from 'js/typeDisplayName.service';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import { changeLayout }  from 'js/flexibleViewModeManagementService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import messageSvc from 'js/messagingService';
import aceBackgroundWorkingContextService from 'js/aceBackgroundWorkingContextService';
import cmm from 'soa/kernel/clientMetaModel';
import localeService from 'js/localeService';

export const initializeOccmgmtSplitView = ( viewKeys, hiddenCommands ) => {
    appCtxService.registerCtx( 'aceActiveContext', { key: '', context: '' } );
    appCtxService.registerCtx( 'splitView', { mode: true, viewKeys: viewKeys } );
    appCtxService.registerCtx( 'decoratorToggle', false );
    appCtxService.updatePartialCtx( 'hiddenCommands', hiddenCommands );
    appCtxService.registerCtx( 'locationContext', {
        'ActiveWorkspace:Location': 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation',
        'ActiveWorkspace:SubLocation': 'showObject'
    } );
    if( !_.isUndefined( appCtxService.getCtx( 'refreshViewOnNotificationClick' ) ) ) {
        appCtxService.unRegisterCtx( 'refreshViewOnNotificationClick' );
    }
};

export const synchronizeSplitViewStateWithURL = ( objectsToOpen = [], activeState = [], occContext, occContext2, data, showObjectContext, showObjectContext2 ) => {
    //Get which parameters have changed
    let changedParams = {};
    let openViewLeft = false;
    let openViewRight = false;
    let newOccContext;
    let newOccContext2;
    let newObjCtx = { ...showObjectContext.getValue() };
    let newObjCtx2 = { ...showObjectContext2.getValue() };

    for( var i in AwStateService.instance.params ) {
        if( AwStateService.instance.params[ i ] !== activeState[ i ] ) {
            changedParams[ i ] = AwStateService.instance.params[ i ];
        }
    }

    //If the uid is changed refresh the whole page
    if( changedParams.hasOwnProperty( 'uid' ) ) {
        openViewLeft = true;
        objectsToOpen[ 0 ] = objectsToOpen[ 0 ] || {};
        if( changedParams.uid ) {
            objectsToOpen[ 0 ].uid = AwStateService.instance.params.uid;
            newOccContext = data.declViewModelJson.data.occContext.initialValues;
        } else {
            delete objectsToOpen[ 0 ].uid;
        }
    }

    if( changedParams.hasOwnProperty( 'uid2' ) ) {
        openViewRight = true;
        objectsToOpen[ 1 ] = objectsToOpen[ 1 ] || {};
        if( changedParams.uid2 ) {
            objectsToOpen[ 1 ].uid = AwStateService.instance.params.uid2;
            newOccContext2 = data.declViewModelJson.data.occContext2.initialValues;
        } else {
            delete objectsToOpen[ 1 ].uid;
        }
    }

    // When entering the split view, the expanded nodes will be same for both the views.
    if( appCtxService.ctx.expandedNodes ) {
        let expNodesStableIds = appCtxService.ctx.expandedNodes.map( ( { stableId } ) => stableId );
        newOccContext.transientRequestPref.expandedNodes = expNodesStableIds;
        newOccContext2.transientRequestPref.expandedNodes = expNodesStableIds;
    }

    let savedSessionModeValue = '';
    if( objectsToOpen[ 0 ].uid === objectsToOpen[ 1 ].uid ) {
        savedSessionModeValue = 'ignore';
    } else {
        savedSessionModeValue = 'restore';
    }
    if( newOccContext ) {
        newOccContext.persistentRequestPref = newOccContext.persistentRequestPref || {};
        newOccContext.persistentRequestPref.savedSessionMode = savedSessionModeValue;
    }
    if( newOccContext2 ) {
        newOccContext2.persistentRequestPref = newOccContext2.persistentRequestPref || {};
        newOccContext2.persistentRequestPref.savedSessionMode = savedSessionModeValue;
    }

    if( !_.isUndefined( newOccContext ) ) {
        occContext.update( newOccContext );
    }
    if( !_.isUndefined( newOccContext2 ) ) {
        occContext2.update( newOccContext2 );
    }

    return dataManagementService.loadObjects( [ objectsToOpen[ 0 ].uid, objectsToOpen[ 1 ].uid ] ).then( function( response ) {
        try {
            var vmos = [
                viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( objectsToOpen[ 0 ].uid ), null ),
                viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( objectsToOpen[ 1 ].uid ), null )
            ];
            if( openViewLeft ) {
                newObjCtx.displayName = typeDisplayNameSvc.instance.getDisplayName( vmos[ 0 ] );
                showObjectContext.update( newObjCtx );
            }
            if( openViewRight ) {
                newObjCtx2.displayName = typeDisplayNameSvc.instance.getDisplayName( vmos[ 1 ] );
                showObjectContext2.update( newObjCtx2 );
            }
            return {
                activeState: JSON.parse( JSON.stringify( AwStateService.instance.params ) ),
                objectsToOpen: vmos
            };
        } catch ( e ) {
            logger.error( 'Unable to parse retrieved XRT: ' + response.declarativeUIDefs[ 0 ].viewModel );
        }
        return {};
    } );
};

export const navigateToSplitView = ( occContext, sublocationState, additionalParams ) => {
    let currentState = occContext.currentState;
    let paramsToNavigate = {
        uid: currentState.uid,
        uid2: currentState.uid,
        c_uid: currentState.c_uid,
        c_uid2: currentState.c_uid,
        h_uid: currentState.h_uid,
        h_uid2: currentState.h_uid,
        pci_uid: currentState.pci_uid,
        pci_uid2: currentState.pci_uid,
        o_uid: currentState.o_uid,
        o_uid2: currentState.o_uid,
        t_uid: currentState.t_uid,
        t_uid2: currentState.t_uid,
        gesture:'dualContextEnter'
    };
    //If Single context location in the Single Pane then spageId or altPwa information not available, so do not pass it.
    //If Single context location in 2 way or 3 way layout then while opening the split set spageId if available, else set altPwa
    if( sublocationState && sublocationState.layoutContext.layoutId !== 'Awp0SinglePaneLayout' ) {
        let spageId = _.isEqual( aceSwaService.isTabSupportedForSplitView( currentState.spageId ), true ) ? currentState.spageId : null;
        let altPwa;
        if( !spageId ) {
            altPwa = _.isEqual( aceSwaService.isTabSupportedForSplitView( currentState.altPwa ), true ) ? currentState.altPwa : null;
            if( !altPwa ) {
                altPwa = _.isEqual( aceSwaService.isTabSupportedForSplitView( currentState.altPwa_2 ), true ) ? currentState.altPwa_2 : null;
            }
        }
        if( spageId ) {
            paramsToNavigate.spageId = spageId;
            paramsToNavigate.spageId2 = spageId;
        }
        if( altPwa ) {
            paramsToNavigate.altPwa = altPwa;
            paramsToNavigate.altPwa2 = altPwa;
        }
    }

    if( additionalParams ) {
        _.forEach( additionalParams, function( value, name ) {
            paramsToNavigate[ name ] = value;
        } );
    }

    let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    AwStateService.instance.go( transitionTo, paramsToNavigate );
};

export const destroyOccmgmtSplitView = ( viewKeys ) => {
    let subPanelContext = {
        provider: {
            contextKey: viewKeys[ 0 ],
            useAutoBookmark: false
        }
    };
    occMgmtServiceManager.destroyOccMgmtServices( subPanelContext );
    subPanelContext.provider.contextKey = viewKeys[ 1 ];
    occMgmtServiceManager.destroyOccMgmtServices( subPanelContext );
    appCtxService.unRegisterCtx( 'aceActiveContext' );
    appCtxService.unRegisterCtx( 'hiddenCommands' );
    appCtxService.unRegisterCtx( 'splitView' );
    appCtxService.unRegisterCtx( 'locationContext' );
    appCtxService.unRegisterCtx( 'requestPref' );
    if( appCtxService.getCtx( 'compareContext' ) ) {
        appCtxService.unRegisterCtx( 'compareList' );
        appCtxService.unRegisterCtx( 'cellClass' );
        if( !appCtxService.getCtx( 'refreshViewOnNotificationClick' ) ) {
            appCtxService.unRegisterCtx( 'compareContext' );
        }
    }
};

export const handleSelectionChange = ( localSelectionData, pageContext, selectionInfos = [] ) => {
    if( !_.isEmpty( localSelectionData ) ) {
        let activeComponent = localSelectionData.activeComponent;
        if( localSelectionData.selected && localSelectionData.selected.length > 0 ) {
            const activeCompIndex = selectionInfos.findIndex( entry => { return entry.activeComponent === localSelectionData.activeComponent; } );
            if( activeCompIndex !== -1 ) {
                if( localSelectionData.source === 'base' ) {
                    selectionInfos[ activeCompIndex ].activeSelections = [];
                }
                selectionInfos[ activeCompIndex ].activeSelections = localSelectionData.selected;
            } else {
                selectionInfos.push( {
                    activeComponent: localSelectionData.activeComponent,
                    activeSelections: localSelectionData.selected
                } );
            }
        }
        /* When you have two selections in PWA and you deselect the active selection; the selection goes back to baseSelection
         for that view. The below code will activate the inactive selection and turn it blue. The ace acitavte window event should
         also be fired to keep things in sync. OR the event should be completley removed. Commenting this code out as this will be
         Ux behavior change
        if( localSelectionData.source === 'base' ) {
            const inactiveCompIndex = selectionInfos.findIndex( entry => { return entry.activeComponent !== localSelectionData.activeComponent; } );
             if( inactiveCompIndex !== -1 ) {
                 activeComponent = selectionInfos[ inactiveCompIndex ].activeComponent;
             }
         } */
        if( _.get( pageContext, 'primarySublocTabState.value.activeComponent' ) !== activeComponent ) {
            pageContext.primarySublocTabState.update( { ...pageContext.primarySublocTabState, activeComponent } );
        }
        trace( 'OccmgmtSplit selectionData: ', localSelectionData );
    }
    return selectionInfos;
};

export const updatePageContext = ( localSelectionData, pageContext, keyOfActivatedView ) => {
    let appCtx = appCtxService.getCtx();
    if( appCtx.aceActiveContext.key !== keyOfActivatedView ) {
        if( _.get( pageContext, 'primarySublocTabState.value.activeComponent' ) && !_.isEmpty( localSelectionData ) ) {
            const activeComponent = localSelectionData.activeComponent;
            pageContext.primarySublocTabState.update( { ...pageContext.primarySublocTabState, activeComponent } );
        }
    }
};

export const skipAutoBookmarkForSplitView = ( objectsToOpen ) => {
    var requestPref = appCtxService.ctx.requestPref || {};
    if( objectsToOpen[ 0 ].uid === objectsToOpen[ 1 ].uid ) {
        appCtxService.registerCtx( 'skipAutoBookmark', true );
        requestPref.savedSessionMode = 'ignore';
    } else {
        appCtxService.registerCtx( 'skipAutoBookmark', false );
        requestPref.savedSessionMode = 'restore';
    }
    appCtxService.registerCtx( 'requestPref', requestPref );
};

export const exitSplitMode = ( occContext, sublocationState, shouldSaveContextOnExit = false ) => {
    aceTreeTableDataService.retainCurrentExpansionState( occContext.vmc );
    appCtxService.updatePartialCtx( 'resetTreeExpansionState', true );
    occmgmtSplitViewUpdateService.clearLocalStorageForInactiveView();

    let navigationParams = {
        uid: occContext.currentState.uid,
        c_uid: occContext.currentState.c_uid,
        pci_uid: occContext.currentState.pci_uid,
        o_uid: occContext.currentState.o_uid,
        t_uid: occContext.currentState.t_uid,
        h_uid:occContext.currentState.h_uid,
        gesture: 'dualContextExit'
    };

    if( shouldSaveContextOnExit ) {
        let requestPref = {
            productContextInfo: [ occContext.currentState.pci_uid ],
            syncAutoBookmark: [ 'true' ]
        };

        aceBackgroundWorkingContextService.saveUserWorkingContextState( false, null, null, requestPref );
    }

    if( sublocationState && sublocationState.layoutContext.layoutId !== 'Awp0SinglePaneLayout' ) {
        let spageId = occContext.currentState.spageId;
        let altPwa = occContext.currentState.altPwa;
        if( spageId ) {
            navigationParams.spageId = spageId;
        }
        if( altPwa ) {
            navigationParams.altPwa = altPwa;
        }
    }
    AwStateService.instance.go( 'com_siemens_splm_clientfx_tcui_xrt_showObject', navigationParams );
};

export const applySelectedLayout = ( commandContext, layoutToApply ) => {
    let currentActiveView = commandContext.contextKey;

    //how toApply layout to inactive view first and to active view last so that active view will remain active after layout application
    changeLayout( commandContext.leftSublocationState, layoutToApply );
    changeLayout( commandContext.rightSublocationState, layoutToApply );
    aceContextStateMgmtService.updateActiveContext( currentActiveView );
};

export const checkIfOpenInViewIsValid = ( addPanelState, sameObjectOfTypeNotAllowedInBothViews ) => {
    let isOpenInViewValid = true;
    let appCtx = appCtxService.getCtx();
    if( appCtx.splitView.mode && sameObjectOfTypeNotAllowedInBothViews ) {
        let inactiveViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
        let inactiveViewContext = appCtxService.getCtx( inactiveViewKey );

        let isInactiveViewTopInNotAllowedTypes = false;
        // Check if the inactive view top object is of type not allowed in both views
        let inactiveViewTopObject =  clientDataModel.getObject( inactiveViewContext.currentState.t_uid );
        if( inactiveViewTopObject && inactiveViewTopObject.props.awb0UnderlyingObjectType && inactiveViewTopObject.props.awb0UnderlyingObjectType.dbValues &&
            inactiveViewTopObject.props.awb0UnderlyingObjectType.dbValues.length > 0 && inactiveViewTopObject.props.awb0UnderlyingObjectType.dbValues[0] === sameObjectOfTypeNotAllowedInBothViews ) {
            isInactiveViewTopInNotAllowedTypes = true;
        }

        let sourceUid;
        let isSourceInAllowedTypes = false;
        if( addPanelState && addPanelState.sourceObjects && addPanelState.sourceObjects.length > 0 ) {
            sourceUid = addPanelState.sourceObjects[0].uid;
            if( addPanelState.sourceObjects[0].modelType.typeHierarchyArray.indexOf( sameObjectOfTypeNotAllowedInBothViews ) > -1 ) {
                isSourceInAllowedTypes = true;
            }
        }
        if( isInactiveViewTopInNotAllowedTypes && isSourceInAllowedTypes && inactiveViewContext.currentState.uid === sourceUid ) {
            // If the source object is already present in the inactive view, then do not open it again.
            let objectName = addPanelState.sourceObjects[0].props && addPanelState.sourceObjects[0].props.object_name.dbValues[0];
            let modelType = cmm.getType( sameObjectOfTypeNotAllowedInBothViews );
            let objectType = modelType.displayName;

            let resource = localeService.getLoadedText( 'occmgmtSplitViewsConstants' );
            let localizedMessage =  resource.SameObjectOfTypeNotAllowedInBothViews.format( objectName, objectType );
            messageSvc.showWarning( localizedMessage );
            isOpenInViewValid = false;
        } else {
            isOpenInViewValid = true;
        }
    }
    return isOpenInViewValid;
};
