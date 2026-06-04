// Copyright (c) 2022 Siemens

/**
 * @module js/aceExpandBelowFetchAllService
 */
import aceExpandBelowService from 'js/aceExpandBelowService';
import appCtxService from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';

let _cxtUpdateListener = null;
var _autoBookmarkSavedEvent = null;
var _nodesCameForExpansion = [];

var exports = {};

let completeExpandBelowFetchAll = function( contextKey ) {
    _autoBookmarkSavedEvent = eventBus.subscribe( 'StartSaveAutoBookmarkEvent', function( context ) {
        let currentContext = appCtxService.getCtx( contextKey );

        let emptyVmos = [];
        if( currentContext ) {
            let loadedVMObjects = currentContext.vmc.getLoadedViewModelObjects();
            let endIndex = loadedVMObjects.length;
            for( var i = 0; i <= endIndex; i++ ) {
                var vmo = loadedVMObjects[ i ];
                if( vmo && !vmo.props ) {
                    emptyVmos.push( vmo );
                }
            }
        }
        if( emptyVmos.length > 200 && soaSvc.getPendingRequestsCount() < 20 ) {
            eventBus.publish( 'occTreeTable.plTable.loadProps', {
                VMOs: emptyVmos
            } );
        }
    }, 5000 );
};

let initializeTimerForFetchAll = function( contextKey ) {
    _cxtUpdateListener = eventBus.subscribe( 'occDataLoadedEvent', function( context ) {
        let currentContext = appCtxService.getCtx( contextKey );
        let emptyVmos = [];
        let loadedVMObjects = currentContext.vmc.getLoadedViewModelObjects();
        let endIndex = loadedVMObjects.length;
        let expandBelowFetchAllStartIndex = currentContext.expandBelowFetchAllStartIndex;

        if( !_.isUndefined( expandBelowFetchAllStartIndex  ) ) {
            //fire expandBelow for nodes in inExpandBelow mode true state...
            appCtxService.updatePartialCtx( contextKey + '.expandBelowFetchAllStartIndex', endIndex );
            var count = 0;
            var foundNodeInExpandBelowMode = false;
            for( var i = 0; i <= endIndex; i++ ) {
                var vmo = loadedVMObjects[ i ];
                if( vmo && vmo.isInExpandBelowMode && _.isEmpty( vmo.children ) && soaSvc.getPendingRequestsCount() < 10 ) {
                    foundNodeInExpandBelowMode = true;
                    count++;
                    if ( _.indexOf( _nodesCameForExpansion, vmo.id ) === -1 ) {
                        _nodesCameForExpansion.push( vmo.id );
                        eventBus.publish( currentContext.vmc.name + '.expandTreeNode', {
                            parentNode: {
                                id: vmo.id
                            }
                        } );
                    }
                    if( count === 20 ) {
                        break;
                    }
                }
            }
        }

        if( currentContext.expandBelowFetchAllStartIndex !== 0 && foundNodeInExpandBelowMode === false  ) {
            //fire expandBelow for nodes in inExpandBelow mode true state...
            for( i = 0; i <= endIndex; i++ ) {
                vmo = loadedVMObjects[ i ];
                if( vmo && !vmo.props ) {
                    emptyVmos.push( vmo );
                }
            }
            if( emptyVmos.length > 200 ) {
                eventBus.publish( 'occTreeTable.plTable.loadProps', {
                    VMOs: emptyVmos
                } );

                completeExpandBelowFetchAll( contextKey );
            }
        }
    } );
};

export let performExpandBelowFetchAll = function( expansionCriteria, commandContext, nodesToMarkCollapsed ) {
    let contextKey = appCtxService.ctx.aceActiveContext.key;
    appCtxService.updatePartialCtx( contextKey + '.expandBelowFetchAllStartIndex', 0 );
    initializeTimerForFetchAll( contextKey );
    aceExpandBelowService.performExpandBelow( expansionCriteria, commandContext, nodesToMarkCollapsed, true );
};

export default exports = {
    performExpandBelowFetchAll
};
