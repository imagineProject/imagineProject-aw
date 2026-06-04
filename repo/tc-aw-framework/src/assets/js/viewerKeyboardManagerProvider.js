// Copyright (c) 2021 Siemens

/**
 * This viewer keyboard Manager Provider
 *
 * @module js/viewerKeyboardManagerProvider
 */

import assert from 'assert';
import '@swf/ClientViewer';
import viewerContextService from 'js/viewerContext.service';
import wcagSvc from 'js/wcagService';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';


/**
  * Provides an instance of viewer keyboard manager
  *
  *  @param {Object} viewerContextData Viewer Context data
  *
  * @return {ViewerKeyboardManager} Returns viewer keyboard manager
  */
let getViewerKeyboardManager = function(   viewerContextData ) {
    return new ViewerKeyboardManager(  viewerContextData );
};

const DELETE_KEY_CODE_VALUE = 'Delete';
const ESCAPE_KEY_CODE_VALUE = 'Escape';

/**
  * Class to hold the viewer keyboard manager
  *
  * @constructor ViewerKeyboardManager
  *
  * @param {Object} viewerContextData Viewer Context data
  */
class ViewerKeyboardManager {
    /**
      * ViewerKeyboardManager class constructor
      *
      * @constructor ViewerKeyboardManager
      *
      * @param {Object} viewerContextData Viewer Context data
      */
    constructor( viewerContextData ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerContextData = viewerContextData;
        this.keyDownHandlerFor3dViewer = null;
        this.escapeKeyFnc = null;
        this.setupAtomicDataTopics();
    }

    /**
     * register keydown event
     */

    initializeKeyDownListener() {
        if( _.isNull( this.keyDownHandlerFor3dViewer ) ) {
            this.keyDownHandlerFor3dViewer = this.handleKeyboardShortcurIn3d.bind( this );
            document.addEventListener( 'keydown', this.keyDownHandlerFor3dViewer, false );
        }
    }
    /**
     * setupAtomicDataTopics ViewerAssetManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_VIEW_MODE_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.CLEANUP_3D_VIEWER, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic ) {
        if( topic ===  this.viewerContextData.CLEANUP_3D_VIEWER ) {
            this.remove3dKeyboardEventListener();
        }else if(  topic === viewerContextService.VIEWER_VIEW_MODE_TOKEN  ) {
            this.initializeKeyDownListener();
        }
    }
    /**
      * Handler for keydown event
      *
      * @param {object} event
      */

    handleKeyboardShortcurIn3d( event ) {
        let keyName = wcagSvc.getKeyName( event );
        let aceActiveContext = appCtxSvc.getCtx( 'aceActiveContext' );
        let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
        let viewerContextNamespace = viewerContextService.getActiveViewerContextNamespaceKey( occmgmtContextKey );
        if( this.viewerContextData.getViewerCtxNamespace() === viewerContextNamespace ) {
            if( keyName === DELETE_KEY_CODE_VALUE && event && event.target && typeof event.target.querySelector === 'function' && ( event.target.querySelector( '#awStructureViewer' ) || event.target.querySelector( '#awthreeDViewer' ) ) ) {
                this.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.GET_ASSETS_INFO, this );
            }else if( keyName === ESCAPE_KEY_CODE_VALUE &&  typeof this.escapeKeyFnc === 'function' ) {
                this.escapeKeyFnc( );
            }
        }
    }
    /**
     * set escape function
     *
     * @param {function} callback  assign function
     */
    setEscapeKeyFunction( callback ) {
        this.escapeKeyFnc = callback;
    }

    /**
     * get escape function name
     * @returns {string} function name/null
     */
    getEscapeKeyFunctionName( ) {
        if( _.isNull( this.escapeKeyFnc ) ) {
            return null;
        }
        return this.escapeKeyFnc.name;
    }

    /**
     * remove 3d keyboard event listener
     */

    remove3dKeyboardEventListener() {
        document.removeEventListener( 'keydown', this.keyDownHandlerFor3dViewer, false );
        this.keyDownHandlerFor3dViewer = null;
    }
}

export default {
    getViewerKeyboardManager
};
