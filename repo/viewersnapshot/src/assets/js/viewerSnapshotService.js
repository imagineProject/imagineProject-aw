// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerSnapshotService
 */
import viewerPerformanceService from 'js/viewerPerformance.service';
import AwPromiseService from 'js/awPromiseService';
import messagingService from 'js/messagingService';
import vmoSvc from 'js/viewModelObjectService';
import _ from 'lodash';
import logger from 'js/logger';
import $ from 'jquery';
import _cdmSvc from 'soa/kernel/clientDataModel';
import AwTimeoutService from 'js/awTimeoutService';
import appCtxSvc from 'js/appCtxService';
import viewerCtxSvc from 'js/viewerContext.service';

var exports = {};

let snapshotPanelDataCtx = null;

/**
 * Snapshot panel revealed
 * @param {Object} snapshotPanelData snapshot atomic data
 * @param {String} failedToFetchSnapshotsString localized string
 * @returns {Object} vmo for product snapshot gallery
 */
export let snapshotPanelRevealed = function( snapshotPanelData, failedToFetchSnapshotsString, subPanelContext ) {
    let currentVMO = {};
    if( subPanelContext ) {
        if( subPanelContext.context.occContext ) {
            currentVMO = vmoSvc.constructViewModelObjectFromModelObject( subPanelContext.context.occContext.topElement, 'Search' );
        }
        snapshotPanelDataCtx = snapshotPanelData;
        let viewerContextData = subPanelContext.viewerContextData ? subPanelContext.viewerContextData : null;
        if( viewerContextData ) {
            viewerContextData.updateViewerAtomicData( 'activeCaptureGalleryTab', 'InputSnapshot' );
            _fetchSnapshotData( viewerContextData, snapshotPanelData, failedToFetchSnapshotsString );
        }
        if( !currentVMO.hasThumbnail ) {
            currentVMO.thumbnailURL = currentVMO.typeIconURL;
        }
        return {
            vmoForSnapshotGallery: currentVMO
        };
    }
    return {
        vmoForSnapshotGallery: currentVMO
    };
};

/**
 *  Gets all snapshots
 *
 * @param {String} searchCriteria search criteria
 * @param {Object} snapshotPanelData snapshot panel Data
 * @returns {Object} object that contains count and array of snapshots
 */
export let getAllSnapshotData = function( searchCriteria, snapshotPanelData ) {
    let snapshotList = snapshotPanelData.getValue().snapshots;
    if( searchCriteria && !_.isNull( searchCriteria.searchString ) && !_.isUndefined( searchCriteria.searchString ) && !_.isEmpty( searchCriteria.searchString ) ) {
        var filterString = searchCriteria.searchString;
        var filteredList = [];
        for( var i = 0; i < snapshotList.length; i++ ) {
            var objectFiltered = false;
            var objectName = snapshotList[ i ].cellHeader1;
            if( _.includes( objectName.toUpperCase(), filterString.toUpperCase() ) ) {
                objectFiltered = true;
            }
            if( objectFiltered ) {
                filteredList.push( snapshotList[ i ] );
            }
        }
        return {
            allSnapshots: [ ...filteredList ],
            totalFound: filteredList.length
        };
    }
    return {
        allSnapshots: [ ...snapshotList ],
        totalFound: snapshotList.length
    };
};

/**
 * Creates snapshots and fires notifictaion
 *
 * @param  {Object} data view model
 * @param  {Object} commandContext command context
 */
export let createSnapshotAndNotify = function( data, commandContext ) {
    if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
        viewerPerformanceService.setViewerPerformanceMode( true );
        viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.CaptureSessionSnapshot );
    }
    commandContext.viewerContextData.getSnapshotManager().createSnapshot()
        .then( function( rawSnapshot ) {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.stopViewerPerformanceDataCapture( 'Session snapshot created :' );
                viewerPerformanceService.setViewerPerformanceMode( false );
            }
            _createSnapshotModelFromRawSnapshot( rawSnapshot )
                .then( function( snapshotModel ) {
                    let snapshotPanelData = commandContext.snapshotPanelData ? commandContext.snapshotPanelData : snapshotPanelDataCtx;
                    if( snapshotPanelData ) {
                        let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
                        if( snapshotPanelDataValue && snapshotPanelDataValue.snapshots ) {
                            snapshotPanelDataValue.snapshots.unshift( snapshotModel );
                            snapshotPanelDataValue.rawSnapshotList.unshift( rawSnapshot );
                            snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
                            snapshotPanelData.update( snapshotPanelDataValue );
                        }
                    }
                    var msg = data.i18n.captureSnapshotSuccess.replace( '{0}', snapshotModel.cellHeader1 );
                    messagingService.showInfo( msg );
                } );
        }, function( reason ) {
            var msg = data.i18n.snapshotCreationFailed.replace( '{0}', reason );
            messagingService.showError( msg );
            logger.error( 'ViewerSnapshotService: Snapshot creation failed: ' + reason );
        } );
};

/**
 * Deletes snapshot
 *
 * @param  {Object} vmo selected snapshot
 * @param  {Object} i18n localized data
 * @param {Object} snapshotPanelData snapshot panel data
 */
export let deleteSnapshot = function( vmo, i18n, snapshotPanelData ) {
    var msg = i18n.snapshotDeleteConfirmationText.replace( '{0}', vmo.cellHeader1 );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: i18n.cancelText,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: i18n.deleteText,
        onClick: function( $noty ) {
            $noty.close();

            vmo.delete()
                .then( function() {
                    let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
                    _.remove( snapshotPanelDataValue.snapshots, function( obj ) {
                        return obj === vmo;
                    } );
                    snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
                    snapshotPanelData.update( snapshotPanelDataValue );
                    messagingService.showInfo( i18n.snapshotDeletedSuccussfully );
                }, function( reason ) {
                    var msg = i18n.snapshotDeleteFailed.replace( '{0}', reason );
                    messagingService.showError( msg );
                    logger.error( 'ViewerSnapshotService: Snapshot delete failed: ' + reason );
                } );
        }
    } ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Apply session snapshot
 * @param {Object} vmo view model object
 * @param {Object} viewerContextData viewer context data
 * @param {Object} i18n localized data
 */
export let applySnapshot = function( vmo, viewerContextData, i18n ) {
    if( vmo ) {
        if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
            viewerPerformanceService.setViewerPerformanceMode( true );
            viewerPerformanceService.startViewerPerformanceDataCapture( viewerPerformanceService.viewerPerformanceParameters.ApplySessionSnapshot );
        }
        vmo.Apply().then( function() {
            if( viewerPerformanceService.isPerformanceMonitoringEnabled() ) {
                viewerPerformanceService.stopViewerPerformanceDataCapture( 'Session snapshot applied: ' );
                viewerPerformanceService.setViewerPerformanceMode( false );
            } else {
                viewerContextData.getViewerAtomicDataSubject().notify( viewerCtxSvc.SESSION_SNAPSHOT_APPLIED );
                logger.info( 'ViewerSnapshotService: Snapshot applied' );
            }
            AwTimeoutService.instance( function() {
                if( viewerContextData.getSectionManager() ) {
                    viewerContextData.getSectionManager().updateSectionCommandState();
                }
            }, 500 );
        }, function( reason ) {
            messagingService.showInfo( i18n.snapshotApplyFailed );
            logger.error( 'ViewerSnapshotService: Snapshot Apply failed: ' + reason );
        } );
    }
};

/**
 * Starts snapshot edit operation
 *
 * @param  {Object} vmo view model object
 * @param {Object} snapshotPanelData atomic data
 */
export let startEditSnapshot = function( vmo, snapshotPanelData ) {
    let updatedsnapshotPanelData = { ...snapshotPanelData.getValue() };
    updatedsnapshotPanelData.activeView = 'SnapshotEditSub';
    updatedsnapshotPanelData.snapshotBeingEdit = vmo;
    snapshotPanelData.update( updatedsnapshotPanelData );
};

/**
 * deletes all snapshots
 * @param {Object} i18n localized data
 * @param {Object} viewerContextData viewer context data
 * @param {Object} snapshotPanelData snapshot panel data
 */
export let deleteAllSnapshots = function( i18n, viewerContextData, snapshotPanelData ) {
    var msg = i18n.allSnapshotDeleteConfirmationText;
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: i18n.cancelText,
        onClick: function( $noty ) {
            $noty.close();
        }
    }, {
        addClass: 'btn btn-notify',
        text: i18n.deleteText,
        onClick: function( $noty ) {
            $noty.close();
            viewerContextData.getSnapshotManager().deleteAllSnapshots()
                .then( function() {
                    messagingService.showInfo( i18n.allSnapshotDeletedSuccussfully );
                    let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
                    snapshotPanelDataValue.snapshots = [];
                    snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
                    snapshotPanelData.update( snapshotPanelDataValue );
                }, function( reason ) {
                    var msg = i18n.snapshotDeleteFailed.replace( '{0}', reason );
                    messagingService.showError( msg );
                    logger.error( 'ViewerSnapshotService: Snapshots delete opeartion failed: ' + reason );
                } );
        }
    } ];
    messagingService.showWarning( msg, buttons );
};

/**
 * Updates snapshot Name
 *
 * @param  {String} newName new name for snapshot
 * @param  {Object} i18n localized strings
 * @param {Object} snapshotPanelData snapshot panel data
 */
export let renameSnapshotAndNotify = function( newName, i18n, snapshotPanelData ) {
    let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
    snapshotPanelDataValue.snapshotBeingEdit.setName( newName )
        .then( function() {
            updateSnapshot( snapshotPanelData, snapshotPanelDataValue.snapshotBeingEdit );
            messagingService.showInfo( i18n.updatedSnapshotSuccessfully );
        } ).catch( reason => {
            updateSnapshotPanelData( snapshotPanelData, snapshotPanelDataValue );
            messagingService.showInfo( i18n.failedToUpdate );
            logger.error( 'ViewerSnapshotService: Snapshot rename failed: ' + reason );
        } );
};

/**
 * Update snapshot panel data
 * @param {Object} snapshotPanelData snapshot panel data
 * @param {Object} snapshotPanelDataValue snapshot panel data value
 */
let updateSnapshotPanelData = ( snapshotPanelData, snapshotPanelDataValue ) => {
    snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
    snapshotPanelDataValue.activeView = 'SnapshotListSub';
    snapshotPanelData.update( snapshotPanelDataValue );
};

/**
 * Update Snapshot
 * @param {Object} snapshotPanelData snapshot panel data
 * @param {Object} vmo view model object
 */
let updateSnapshot = ( snapshotPanelData, vmo ) => {
    let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
    let snpshotUpdatedIndex = snapshotPanelDataValue.snapshots.findIndex( snapshot=>vmo.id === snapshot.id );
    let rawSnapshotList = [ ...snapshotPanelDataValue.rawSnapshotList ];
    let snapshots = [ ...snapshotPanelDataValue.snapshots ];
    _createSnapshotModelFromRawSnapshot( rawSnapshotList[ snpshotUpdatedIndex ] ).then( ( snapshot ) => {
        snapshots[ snpshotUpdatedIndex ] = snapshot;
        snapshotPanelDataValue.snapshots = snapshots;
        updateSnapshotPanelData( snapshotPanelData, snapshotPanelDataValue );
    } );
};

/**
 * Updates snapshot
 *
 * @param  {Object} vmo view model object
 * @param {Object} i18n localized data
 * @param {Object} snapshotPanelData snapshot panel data
 */
export let updateSnapshotAndNotify = function( vmo, i18n, snapshotPanelData ) {
    vmo.Update().then( () => {
        updateSnapshot( snapshotPanelData, vmo );
    } ).catch( ( reason ) => {
        messagingService.showInfo( i18n.failedToUpdate );
        logger.error( 'ViewerSnapshotService: Snapshot update failed: ' + reason );
    } );
};

/**
 * Clear previous selection
 *  @param {Object}  dataProvider snapshot DataProvider
 */
export let clearPreviousSnapshotSelection = function( dataProvider ) {
    var viewModelObject = dataProvider.selectedObjects;
    if( viewModelObject && viewModelObject.length > 0 && dataProvider.selectionModel ) {
        dataProvider.selectionModel.setSelection( [] );
    }
};

/**
 * Set snapshot view
 *
 * @param {Object} snapshotPanelData snapshot panel data
 * @param {String} snapshotView View to set for snapshot panel
 */
export let setSnapshotView = function( snapshotPanelData, snapshotView ) {
    const snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
    snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
    snapshotPanelDataValue.snapshotView = snapshotView;
    snapshotPanelData.update( snapshotPanelDataValue );
};

/**
 * Creates snapshot model that can be displayed in list
 *
 * @param  {Object} rawSnapshot raw snashot
 * @returns {Object} promise
 */
function _createSnapshotModelFromRawSnapshot( rawSnapshot ) {
    let deferred = AwPromiseService.instance.defer();
    if( rawSnapshot ) {
        var snapshotModel = Object.create( rawSnapshot );
        var namePromise = rawSnapshot.getName();
        var thumbnailPromise = rawSnapshot.getThumbnail();
        $.when( thumbnailPromise, namePromise ).then( function( thumbnailURL, name ) {
            snapshotModel.id = rawSnapshot.visObject.resourceID;
            snapshotModel.thumbnailURL = thumbnailURL;
            snapshotModel.hideoverlay = true;
            snapshotModel.hasThumbnail = true;
            snapshotModel.cellHeader1 = name;
            deferred.resolve( snapshotModel );
        }, function( reason ) {
            logger.error( 'ViewerSnapshotService: Snapshot getName/getThumbnail opeation failed: ' + reason );
            deferred.reject( reason );
        } );
    } else {
        deferred.reject();
    }
    return deferred.promise;
}

/**
 * Fetches snapshots from server
 * @param {Object} viewerContextData viewer context data
 * @param {Object} snapshotPanelData snapshot panel data
 * @param {Object} failedToFetchSnapshots localized string
 */
function _fetchSnapshotData( viewerContextData, snapshotPanelData, failedToFetchSnapshots ) {
    viewerContextData.getSnapshotManager().getAllSnapshots()
        .then( function( rawSnapshotList ) {
            let snapshotPanelDataValue = { ...snapshotPanelData.getValue() };
            if( Array.isArray( snapshotPanelDataValue.snapshots ) ) {
                snapshotPanelDataValue.snapshots.length = 0;
            }
            var rawSnapshotListPromises = [];
            for( let index = 0; index < rawSnapshotList.length; index++ ) {
                var deferred = AwPromiseService.instance.defer();
                rawSnapshotListPromises.push( deferred.promise );
                rawSnapshotList.getSnapshot( index ).then( function( rawSnapshot ) {
                    this.resolve( rawSnapshot );
                }.bind( deferred ) );
            }

            AwPromiseService.instance.all( rawSnapshotListPromises ).then( function( rawSnapshotList ) {
                var snapshotModelPromises = [];
                _.forEach( rawSnapshotList, function( rawSnapshot ) {
                    snapshotModelPromises.push( _createSnapshotModelFromRawSnapshot( rawSnapshot ) );
                } );
                snapshotPanelDataValue.rawSnapshotList = rawSnapshotList.reverse();
                AwPromiseService.instance.all( snapshotModelPromises ).then( function( snapshotModelList ) {
                    //Reverse the snapshots lists to show in desc assuming snapshotModelList are always in asc order
                    _.forEach( snapshotModelList.reverse(), function( snapshotModel ) {
                        snapshotPanelDataValue.snapshots.push( snapshotModel );
                    } );
                    snapshotPanelDataValue.updateSnapshotList = !snapshotPanelDataValue.updateSnapshotList;
                    snapshotPanelData.update( snapshotPanelDataValue );
                } );
            } );
        }, function( reason ) {
            var msg = failedToFetchSnapshots.replace( '{0}', reason );
            messagingService.showError( msg );
        } );
}

/**
 * Sets active view as snapshot panel
 * @param {Object} snapshotPanelData snapshot panel data
 * @returns {Object} updated snapshot panel data
 */
const setActiveListPanel = ( snapshotPanelData ) => {
    snapshotPanelData.activeView = 'SnapshotListSub';
    return { ...snapshotPanelData };
};

/**
 * Select snapshot in gallery
 * @param {Object} item snapshot vmo
 * @param {Object} dataProvider card view data provider
 */
let selectSessionSnapshot = ( item, dataProvider ) => {
    dataProvider.selectionModel.setSelection( item );
};

/**
 * Clean up snapshot panel data
 */
let cleanupSnapshotPanelData = () => {
    snapshotPanelDataCtx = null;
};

export default exports = {
    snapshotPanelRevealed,
    getAllSnapshotData,
    createSnapshotAndNotify,
    deleteSnapshot,
    applySnapshot,
    startEditSnapshot,
    deleteAllSnapshots,
    renameSnapshotAndNotify,
    clearPreviousSnapshotSelection,
    setSnapshotView,
    updateSnapshotAndNotify,
    setActiveListPanel,
    selectSessionSnapshot,
    cleanupSnapshotPanelData
};
