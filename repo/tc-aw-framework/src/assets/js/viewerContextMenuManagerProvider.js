// Copyright (c) 2021 Siemens

/* global JSCom */

/**
 * This Context Menu Manager Provider
 *
 * @module js/viewerContextMenuManagerProvider
 */

import _ from 'lodash';
import assert from 'assert';
import '@swf/ClientViewer';
import viewerContextService from 'js/viewerContext.service';
import appCtxService from 'js/appCtxService';


/**
  * Provides an instance of viewer context menu manager
  *

  * @param {Object} viewerView Viewer view
  * @param {Object} viewerContextData Viewer Context data
  *
  * @return {ViewerContextMenuManager} Returns viewer context menu manager
  */
let getContextMenuManager = function(  viewerView, viewerContextData ) {
    return new ViewerContextMenuManager( viewerView, viewerContextData );
};

/**
  * Class to hold the viewer context menu data
  *
  * @constructor ViewerContextMenuManager
  *
  * @param {Object} viewerView Viewer view
  * @param {Object} viewerContextData Viewer Context data
  */
class ViewerContextMenuManager {
    /**
      * ViewerContextMenuManager class constructor
      *
      * @constructor ViewerContextMenuManager
      *
      * @param {Object} viewerView Viewer view
      * @param {Object} viewerContextData Viewer Context data
      */
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
    }

    /**
      * Notify JSCOM that PVW Component is updated
      *
      * @param {string} contextMenuCommand cmd
      * @param {number}  objectIndex cmdIndex
      */
    notifyContextMenuMgr( contextMenuCommand, objectIndex ) {
        this.viewerView.contextMenuMgr.notifyServer( contextMenuCommand, objectIndex );
    }

    /**
      * Notify JSCOM that PVW Component has updated section
      *
      * @param {string} contextMenuCommand cmd
      * @param {number}  objectIndex cmdIndex
      *  @param {object}  contextMenuPref context Menu Object
      *  @param {number}  objectIndex cmdIndex
      */

    notifyContextMenuMgrForSection( contextMenuCommand, objectIndex, contextMenuPref ) {
        let pvwObject = contextMenuPref.planeSelected ? contextMenuPref.planeSelected : contextMenuPref.planeDeleted;
        this.viewerView.contextMenuMgr.notifyServer( contextMenuCommand, objectIndex ).then( ()=>{
            let dialogToolAndInfo = appCtxService.getCtx( 'activeToolsAndInfoCommand_dialog' );
            if( contextMenuPref.command === 'deleteSectionCmd' && ( _.isUndefined( dialogToolAndInfo ) || dialogToolAndInfo.commandId !== 'Awv0GeometricAnalysisSection' ) ) {
                this.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_SECTION_CMD_FROM_PVW );
            }
            this.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.PVW_SECTION_CONTEXT_MENU, { pvwContextCmd: contextMenuPref.command, pvwObject: pvwObject } );
        } );
    }
}

export default {
    getContextMenuManager
};
