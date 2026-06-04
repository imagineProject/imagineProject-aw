// Copyright (c) 2023 Siemens

/**
 *
 * @module js/viewerAssetsManagerProvider
 */

import assert from 'assert';
import '@swf/ClientViewer';
import viewerContextService from 'js/viewerContext.service';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import logger from 'js/logger';
import _ from 'lodash';
/**
  * Provides an instance of viewer assets manager
  *
  * @param {Object} viewerContextData Viewer Context data
  *
  * @return {ViewerAssetsManager} Returns viewer assets manager
  */
let getViewerAssetsManager = function(  viewerContextData ) {
    return new ViewerAssetsManager( viewerContextData );
};

/**
  * Class to hold the viewer assets data
  *
  * @constructor viewerAssetsManagerProvider
  *
  * @param {Object} viewerContextData Viewer Context data
  */
class ViewerAssetsManager {
    /**
      * viewerAssetManager class constructor
      *
      * @constructor ViewerAssetsManager
      *
      * @param {Object} viewerContextData Viewer Context data
      */
    constructor(  viewerContextData ) {
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerContextData = viewerContextData;
        this.viewerAssetsSelectedListeners = [];
        this.multiAssetsSelected = 0;
        this.setupAtomicDataTopics();
    }

    /**
     * setupAtomicDataTopics ViewerAssetManager
     */
    setupAtomicDataTopics() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerContextService.GET_ASSETS_INFO, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.CLEANUP_3D_VIEWER, this );
    }

    /**
     * Add viewer visibility changed listener
     *
     * @param {Object} observerFunction function to be registered
     */
    addViewerAssetsSelectedListeners( observerFunction ) {
        if( typeof observerFunction === 'function' ) {
            this.viewerAssetsSelectedListeners.push( observerFunction );
        }
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data`
     */
    update( topic ) {
        if( topic === viewerContextService.GET_ASSETS_INFO ) {
            this.isAssestsSelected();
        }else if( topic ===  this.viewerContextData.CLEANUP_3D_VIEWER ) {
            this.removeViewerAssetsSelectedListeners();
        }
    }

    /**
     * remove viewer assets listener
     *
     */
    removeViewerAssetsSelectedListeners( ) {
        this.viewerAssetsSelectedListeners = [];
    }

    isAssestsSelected() {
        let assetsPromises = [];
        if( this.viewerAssetsSelectedListeners.length > 0 ) {
            _.forEach( this.viewerAssetsSelectedListeners, function( observer ) {
                if( typeof observer === 'function' ) {
                    assetsPromises.push( observer() );
                }
            } );
            AwPromiseService.instance.all( assetsPromises )
                .then( function( multiAssetsSelectedValues ) {
                    let multiAssetsSelectedCount = multiAssetsSelectedValues.filter( x => x === true ).length;
                    if( multiAssetsSelectedCount >= 2 ) {
                        messagingService.showWarning( this.viewerContextData.getThreeDViewerMsg( 'multipleAssetsDeleteMessage' ), [ {
                            addClass: 'btn btn-notify',
                            text: this.viewerContextData.getThreeDViewerMsg( 'Cancel' ),
                            onClick: ( $noty ) => {
                                $noty.close();
                            }
                        }, {
                            addClass: 'btn btn-notify',
                            text: this.viewerContextData.getThreeDViewerMsg( 'delete' ),
                            onClick: ( $noty ) => {
                                $noty.close();
                                this.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIS_DELETE_FROM_KEYBOARD, this );
                            }
                        } ] );
                    }else if( multiAssetsSelectedCount === 1 ) {
                        this.viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIS_DELETE_FROM_KEYBOARD, this );
                    }
                }.bind( this ), function( error ) {
                    logger.error( 'Multi Assets failed' + error );
                } );
        }
    }
}

export default {
    getViewerAssetsManager
};
