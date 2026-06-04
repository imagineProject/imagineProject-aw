// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * Defines ViewerProgressIndicator which provides utility to initialize viewer progress indicator.S
 *
 * @module js/viewerProgressIndicator
 */

import localeSvc from 'js/localeService';
import AwTimeoutService from 'js/awTimeoutService';
import viewerContextService from 'js/viewerContext.service';



const SHOW_VIEWER_EMM_PROGRESS = 'showViewerEmmProgress';
const SHOW_VIEWER_PROGRESS = 'showViewerProgress';
const SHOW_VIEWER_LOADBAR = 'viewerLoadbarVisible';
const VIEWER_LOADBAR_PERCENTAGE = 'viewerLoadbarPercentage';
const VIEWER_LOADBAR_MESSAGE = 'viewerLoadbarMessage';
const VIEWER_STOP_BUTTON_VISIBLE = 'viewerStopButtonVisible';

class ViewerProgressIndicator {
    /**
     * ViewerProgressIndicator constructor
     * @constructor
     * @param {Object} viewerView viewer view
     * @param {ViewerContextData} viewerContextData viewer context data
     */
    constructor( viewerView, viewerContextData ) {
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.stopButtonCallback = null;
        this.emmProgressStart = null;
        this.createEmmListener();
    }

    /**
     * Create emm listener
     */
    createEmmListener() {
        if( this.viewerView && this.viewerContextData ) {
            this.listener = {
                emmSeriesStart: function() {
                    if( !this.emmProgressStart ) {
                        //Adding 2 seconds delay before we actually show emm progress indicator to
                        //avoid showing it too frequently.
                        this.emmProgressStart = AwTimeoutService.instance( () => {
                            this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_EMM_PROGRESS, true );
                        }, 2000 );
                    }
                }.bind( this ),
                emmSeriesEnd: function() {
                    if( this.emmProgressStart ) {
                        AwTimeoutService.instance.cancel( this.emmProgressStart );
                        this.emmProgressStart = null;
                    }
                    this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_EMM_PROGRESS, false );
                }.bind( this ),
                renderStart: function() {
                    this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_PROGRESS, true );
                    if(viewerContextService.isServerless()){
                        this.viewerContextData.getViewerAtomicDataSubject().notify( this.viewerContextData.AUTO_SAVE_VIS_BOOKMARK, 'save');
                    }
                }.bind( this ),
                renderEnd: function() {
                    this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_PROGRESS, false );
                    if(viewerContextService.isServerless()){
                        this.viewerContextData.getViewerAtomicDataSubject().notify( this.viewerContextData.AUTO_SAVE_VIS_BOOKMARK, 'save' );
                    }
                }.bind( this ),
                loadStart: function( event ) {
                    this.handleLoadbarStart( event );
                }.bind( this ),
                loadPercentUpdate: function( event ) {
                    this.handleLoadbarUpdate( event );
                }.bind( this ),
                loadEnd: function( event ) {
                    this.handleLoadbarEnd( event );
                }.bind( this )
            };
            this.viewerView.listenerMgr.addBusyListener( this.listener );
        }
    }

    /**
     * Remove emm listener
     */
    removeEmmListener() {
        if( this.viewerView ) {
            this.viewerView.listenerMgr.removeBusyListener( this.listener );
        }
    }

    handleLoadbarStart( event ) {
        if ( this.emmProgressStop ) {
            AwTimeoutService.instance.cancel( this.emmProgressStop );
            this.emmProgressStop = null;
        }

        this.viewerContextData.updateViewerAtomicData( VIEWER_LOADBAR_PERCENTAGE, -1 );
        this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_LOADBAR, true );
        if( event ) {
            if( event.message && event.message[ 0 ] ) {
                this.updateLoadbarMessage( event.message );
            }

            if( event?.percentage >= 0 && event.percentage <= 100 ) {
                this.viewerContextData.updateViewerAtomicData( VIEWER_LOADBAR_PERCENTAGE, Math.trunc( event.percentage ) );
            }

            if( event.stopCallback ) {
                this.stopButtonCallback = event.stopCallback;
                this.viewerContextData.updateViewerAtomicData( VIEWER_STOP_BUTTON_VISIBLE, true );
            } else {
                this.viewerContextData.updateViewerAtomicData( VIEWER_STOP_BUTTON_VISIBLE, false );
            }
        }
    }

    handleLoadbarUpdate( event ) {
        if( event ) {
            if( event?.percentage >= 0 && event.percentage <= 100 ) {
                this.viewerContextData.updateViewerAtomicData( VIEWER_LOADBAR_PERCENTAGE, Math.trunc( event.percentage ) );
            }
            if( event.message && event.message[ 0 ] ) {
                this.updateLoadbarMessage( event.message );
            }
        }
    }

    handleLoadbarEnd( event ) {
        // If the process was stopped, we want the loadbar dialog to disappear instantly.
        // If the process completed normally, we want to wait one second so the user can
        // see the percentage reach 100% and the loadbar to fill up completely.
        let timeout = 500;
        if( event && event.wasStopped ) {
            timeout = 0;
        } else {
            if( event.message && event.message[ 0 ] ) {
                this.updateLoadbarMessage( event.message );
            }

            // only update percentage if it was previously set
            let percentage = this.viewerContextData.getValueOnViewerAtomicData( VIEWER_LOADBAR_PERCENTAGE );
            if ( percentage >= 0 && percentage < 100 ) {
                this.viewerContextData.updateViewerAtomicData( VIEWER_LOADBAR_PERCENTAGE, 100 );
            }
        }
        this.emmProgressStop = AwTimeoutService.instance( function() {
            this.viewerContextData.updateViewerAtomicData( SHOW_VIEWER_LOADBAR, false );
            this.viewerContextData.updateViewerAtomicData( VIEWER_STOP_BUTTON_VISIBLE, false );
        }.bind( this ), timeout );
    }

    updateLoadbarMessage( messageArr ) {
        localeSvc.getTextPromise( 'StructureViewerMessages' ).then( function( i18n ) {
            if( i18n[ messageArr[ 0 ] ] ) {
                let message = i18n[ messageArr[ 0 ] ];
                for( let i = 1; i < messageArr.length; i++ ) {
                    message = message.replace( '{' + ( i - 1 ) + '}', messageArr[ i ] );
                }
                this.viewerContextData.updateViewerAtomicData( VIEWER_LOADBAR_MESSAGE, message );
            }
        }.bind( this ) );
    }

    stopButtonPressed() {
        if( this.stopButtonCallback ) {
            this.stopButtonCallback.call();
            this.updateLoadbarMessage( [ 'StoppingProcess' ] );
        }
    }
}

export default ViewerProgressIndicator;
