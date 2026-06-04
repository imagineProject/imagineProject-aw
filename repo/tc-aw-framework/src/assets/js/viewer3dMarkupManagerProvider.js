// Copyright (c) 2021 Siemens

/**
 * This 3D Markup service provider
 *
 * @module js/viewer3dMarkupManagerProvider
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import assert from 'assert';
import viewerContextService from 'js/viewerContext.service';
import _ from 'lodash';
import logger from 'js/logger';
import preferenceService from 'soa/preferenceService';

const AWV03dMarkupPreferences = 'AWV03dMarkupPreferences';

/**
 * Provides an instance of viewer 3D Markup manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {Viewer3DMarkupManager} Returns viewer 3D Markup manager
 */
export let getViewer3DMarkupManager = function(  viewerView, viewerContextData ) {
    return new Viewer3DMarkupManager(  viewerView, viewerContextData );
};

/**
 * Class to hold the viewer 3D Markup data
 *
 * @constructor Viewer3DMarkupManager
 *
 * @param {Object} viewerCtxNamespace Viewer context name space
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class Viewer3DMarkupManager {
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;

        this.shutDown3DToolbarListeners = [];

        this.dbPreferences = [];
        this.propertyPairs = [];
        this.setupAtomicDataTopics();
    }

    /**
     * setupAtomicDataTopics ViewerMeasurementManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.CLEANUP_3D_VIEWER, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_AREA_SELECT, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.PRODUCT_SNAPSHOT_APPLIED, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.SESSION_SNAPSHOT_APPLIED, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIS_DELETE_FROM_KEYBOARD, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_VOLUME_SELECT, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIEWER_VIEW_MODE_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.VIS_SECTION_PLANE_TRANSLATE_MODE, this );
    }

    /**
     * Add 3d markup toolbar close listener
     *
     * @param {Object} observerFunction function to be registered
     */
    add3dMarkupToolbarCloseListener( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            this.shutDown3DToolbarListeners.push( observerFunction );
        }
    }

    /**
     * remove 3d markup toolbar close listener
     *
     * @param {Object} observerFunction function to be removed
     */
    remove3dMarkupToolbarCloseListener( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            var indexToBeRemoved = this.shutDown3DToolbarListeners.indexOf( observerFunction );
            if( indexToBeRemoved > -1 ) {
                this.shutDown3DToolbarListeners.splice( indexToBeRemoved, 1 );
            }
        }
    }

    /**
     * Notify viewer to close 3d markup toolbar
     *
     * @param {Object} viewerContextData Viewer Context data
     * @param {Object} shutDown flag
     */
    notify3dMarkupToolbarCloseEvent( viewerContextData, shutDown ) {
        if( this.shutDown3DToolbarListeners.length > 0 ) {
            _.forEach( this.shutDown3DToolbarListeners, function( observer ) {
                let neededButNotUsed = null;
                observer.call( neededButNotUsed, viewerContextData, shutDown );
            } );
        }
    }

    /**
     * disable3dMarkup shut down 3d markup toolbar
     */
    disable3dMarkup() {
        appCtxSvc.unRegisterCtx( 'viewerContext' );

        this.notify3dMarkupToolbarCloseEvent( this.viewerContextData );

        if( this.viewerContextData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' && !this.viewerContextData.isConnectionClosed() ) {
            try {
                this.setPLMVisMode( window.JSCom.Consts.MarkupMode.SELECT );
            } catch ( ex ) {
                logger.error( 'Viewer3dMarkupManagerProvider: Setting mode to select failed: ' + ex );
            }
        }


        this.viewerContextData.updateViewerAtomicData( 'onScreen3dMarkupContext.tool', null );
        this.viewerContextData.updateViewerAtomicData( 'onScreen3dMarkupContext.subTool', undefined );
        this.viewerContextData.updateViewerAtomicData( 'onScreen3dMarkupContext.display3dMarkupToolbar', false );
    }

    /**
* Utility function to parse the properties from the database into an array
* of keys and an array of values
* @param {String} props viewer context data
* @returns {String} key value pairs of markup properties
*/
    parseProperties(  ) {
        let keysArr = [];
        let valuesArr = [];

        var pair;
        var props = this.dbPreferences;

        for ( var i = 0; i < props.length; i++ ) {
            if ( props[i] !== null && props[i] !== undefined ) {
                pair = props[i].split( '=' );
                if ( pair.length > 1 ) {
                    keysArr.push( pair[0].replace( /\s+/g, '' ).toLowerCase() );
                    valuesArr.push( pair[1].replace( /\s+/g, '' ).toLowerCase() );
                }
            }
        }

        return {
            keys: keysArr,
            values: valuesArr
        };
    }

    /**
     * disable3dMarkup shut down 3d markup toolbar
     */
    notifySnapShotApplied() {
        this.dbPreferences = preferenceService.getLoadedPrefs().AWV03dMarkupPreferences;
        let updatedValues = [];
        if( this.dbPreferences ) {
            this.propertyPairs = this.parseProperties( );
            for ( var i = 0; i < this.propertyPairs.keys.length; i++ ) {
                if ( this.propertyPairs.keys[i] === 'markupmode' ) {
                    this.propertyPairs.values[i] = 'select';
                }
                updatedValues.push( this.propertyPairs.keys[i] + '=' + this.propertyPairs.values[i] );
            }

            preferenceService.setStringValue( AWV03dMarkupPreferences, updatedValues );
        }
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === this.viewerContextData.SUB_COMMANDS_TOOLBAR_ACTIVE_STATUS ) {
            if( data && !data.isActivated ) {
                this.disable3dMarkup();
            } else {
                if( data && data.isActivated && data.commandId !== '3dOnScreenStartMarkup' ) {
                    this.disable3dMarkup();
                }
            }
        } else if( topic ===  this.viewerContextData.CLEANUP_3D_VIEWER ) {
            this.disable3dMarkup();
        } else if( topic ===  viewerContextService.VIEWER_COMMAND_PANEL_LAUNCHED ) {
            this.disable3dMarkup();
        } else if( topic ===  viewerContextService.VIEWER_AREA_SELECT ) {
            this.disable3dMarkup();
        } else if( topic ===  viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE ) {
            this.disable3dMarkup();
        } else if ( topic === this.viewerContextData.PRODUCT_SNAPSHOT_APPLIED || topic === viewerContextService.SESSION_SNAPSHOT_APPLIED ) {
            this.disable3dMarkup();
            this.notifySnapShotApplied();
        } else if ( topic === viewerContextService.VIS_DELETE_FROM_KEYBOARD && this.viewerContextData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' &&  this.viewerView && this.viewerView.viewMarkupMgr ) {
            this.viewerView.viewMarkupMgr.deleteSelectedMarkup();
        } else if ( ( topic === viewerContextService.VIEWER_VOLUME_SELECT || topic === viewerContextService.VIS_SECTION_PLANE_TRANSLATE_MODE ) && data === true ) {
            this.disable3dMarkup();
        }else if(  topic === viewerContextService.VIEWER_VIEW_MODE_TOKEN  ) {
            this.viewerContextData.getViewerAssetsMgr().addViewerAssetsSelectedListeners( this.isMarkupSelected.bind( this ) );
        }
    }
    /**
     * Remove Analysis result
     *
     */
    removeAllToolkitMarkups( ) {
        if( this.viewerContextData.getValueOnViewerAtomicData( 'renderLocation' ) === 'CSR' ) {
            try {
                this.viewerView.viewMarkupMgr.removeAllToolkitMarkups( );
            } catch ( ex ) {
                logger.error( 'Viewer3dMarkupManagerProvider: Removing all markups failed: ' + ex );
            }
        }
    }

    /**
     * Remove all markups EMM
     * @return {deferred_promise} promicse
     */
    removeAllAnnotationLayer() {
        var deferred = AwPromiseService.instance.defer();

        this.viewerView.viewMarkupMgr.removeAllMarkups(  )
            .then( function(  ) {
                deferred.resolve(  );
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }

    /**
     * Add annotations EMM
     * @param {String} jsonData markup in json format
     * @param {int} vpHeight height of window
     * @param {int} vpWidth width of window
     * @return {deferred_promise} promicse
     */
    addAnnotationLayer( jsonData, vpHeight, vpWidth ) {
        var deferred = AwPromiseService.instance.defer();
        this.viewerView.viewMarkupMgr.addMarkup( jsonData, vpHeight, vpWidth )
            .then( function( flatBuffer ) {
                deferred.resolve( flatBuffer );
            } )
            .catch( function( err ) {
                deferred.reject( err );
            } );
        return deferred.promise;
    }


    /**
     *  Set markup mode in PLM Vis toolkit
     * @param {int} mode markup mode
     */
    setPLMVisMode( mode ) {
        this.viewerView.viewMarkupMgr.setMarkupMode( mode );
    }


    /**
     *  Get initialization values for PLM Vis toolkit
     * @return {initialization_structure} toolkit values
     */
    getAfxPVWInitializationValues() {
        return this.viewerView.getAfxPVWInitializationValues( );
    }

    /**
     * clear viewer visibility
     */
    cleanUp() {
        this.disable3dMarkup();
    }
    /**
     *  Get selected markup
     * @return {Array} selected markup
     */
    getSelectedMarkup() {
        return this.viewerView.viewMarkupMgr.getSelectedMarkup();
    }

    /**
     *  Validate whether markup is slected or not
     * @return {Boolean} true/false
     */

    isMarkupSelected() {
        if( this.viewerContextData.getValueOnViewerAtomicData( 'renderLocation' ) !== 'CSR' ) {
            return false;
        }
        let markupSelectedValue = this.getSelectedMarkup();
        return markupSelectedValue.length !== 0;
    }
}

export default {
    getViewer3DMarkupManager
};
