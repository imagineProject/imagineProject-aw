/* eslint-disable class-methods-use-this */
/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * propertyCallProvider
 *
 * Responsible for providing a sequence of getTableViewModelProperty calls
 * to be invoked during a tree load user action. Interacts with tree context
 * to choose best ordering/parameterisation of the calls.
 *
 * Called only by invoker.
 *
 * @module js/invoker/propertyCallProvider
 */

import appCtxSvc from 'js/appCtxService';
import backgroundSoaSvc from 'js/invoker/backgroundSoaService';
import soaSvc from 'soa/kernel/soaService';
import propertyLoader from 'js/invoker/propertyLoader';
import propertyCallTimer from 'js/invoker/propertyCallTimer';
import eventBus from 'js/eventBus';
import invoker from 'js/invoker/invoker';
import occmgmtIconSvc from 'js/aceIconService';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import occurrencesLoader from 'js/invoker/occurrencesLoader';
import parsingUtils from 'js/parsingUtils';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import expandRequests from 'js/invoker/expandRequests';
import _ from 'lodash';

let _getInitialPropSearchRange = function( vmc, uwDataProvider, num ) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    let startIndex = 0;
    let endIndex = loadedVMObjects.length - 1;

    // Find an optimal window of 2x page size around current window position
    var _firstIndex = uwDataProvider.scrollPosition.firstIndex;
    var _lastIndex = uwDataProvider.scrollPosition.lastIndex;
    var pageSize = _lastIndex - _firstIndex;
    startIndex = _firstIndex;
    endIndex = Math.max( _firstIndex + pageSize, num );
    let startTrim = 0;
    let endTrim = 0;
    let maxIndex = loadedVMObjects.length - 1;
    if( startIndex < 0 ) {
        startTrim = -startIndex;
        startIndex = 0;
    }
    if( endIndex > maxIndex ) {
        endTrim = maxIndex - endIndex;
        endIndex = maxIndex;
    }
    startIndex = Math.max( startIndex - endTrim, 0 );
    endIndex = Math.min( endIndex + startTrim, maxIndex );
    return [ startIndex, endIndex ];
};

let getMissingVMTN = function( loadedVMObjects, startIndex, endIndex, increment, num, excludedNodes ) {
    let missingVMTN = [];
    for( let i = startIndex; i <= endIndex; i += increment ) {
        let vmtn = loadedVMObjects[ i ];
        if( vmtn && ( !vmtn.props || Object.keys( vmtn.props ).length === 0 || vmtn?.fetchRemainingProps ) && !excludedNodes.has( vmtn ) ) {
            missingVMTN.push( vmtn );
            if( missingVMTN.length >= num ) {
                break;
            }
        }
    }
    return missingVMTN;
};

let _getObjsWithMissingProps = function( vmc, uwDataProvider, num, excludedNodes ) {
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    let startIndex = 0;
    let maxIndex = loadedVMObjects.length - 1;
    let endIndex = maxIndex;
    if( uwDataProvider && uwDataProvider.scrollPosition ) {
        [ startIndex, endIndex ] = _getInitialPropSearchRange( vmc, uwDataProvider, num );
    }
    let missingVMTN = getMissingVMTN( loadedVMObjects, startIndex, endIndex, +1, num, excludedNodes );
    let extra = num - missingVMTN.length;
    if( extra > 0 ) {
        while( ( endIndex < maxIndex + num || startIndex >= 0 ) && missingVMTN.length < num ) {
            startIndex = Math.max( 0, startIndex );
            endIndex = Math.min( maxIndex + num, endIndex );
            let extraVMTN = getMissingVMTN( loadedVMObjects, startIndex, endIndex, +1, extra, excludedNodes );
            missingVMTN.push( ...extraVMTN );
            startIndex -= num;
            endIndex += num;
            extra -= missingVMTN.length;
        }
    }

    return missingVMTN;
};

let _getTVMPSoaInput = function( missingVMTN, optType, clientScopeURI, columnsToExclude, typesToInclude ) {
    let uids = [];
    for( let vmtn of missingVMTN ) {
        uids.push( vmtn.uid );
    }
    return {
        input: {
            objectUids: uids,
            columnConfigInput: {
                clientName: 'AWClient',
                hostingClientName: '',
                clientScopeURI: clientScopeURI,
                operationType: optType ? optType : 'Union',
                columnsToExclude: columnsToExclude
            },
            requestPreference: {
                typesToInclude: typesToInclude ? typesToInclude : []
            }
        }
    };
};

let _addToPending = function( requestedVMTNs, pendingSet ) {
    for( let vmtn of requestedVMTNs ) {
        pendingSet.add( vmtn );
    }
};

let _removeFromPending = function( requestedVMTNs, pendingSet ) {
    for( let vmtn of requestedVMTNs ) {
        pendingSet.delete( vmtn );
    }
};

let _updateIconURL = function( requestedVMTNs ) {
    for( let vmtn of requestedVMTNs ) {
        let iconURL = occmgmtIconSvc.getIconURL( vmtn );
        if( iconURL !== undefined && iconURL !== '' ) {
            vmtn.iconURL = iconURL;
        }
    }
};

/**
 * Extracts the view model properties from response and updates the corresponding viewmodelObject
 *
 * @param {ViewModelObject[]} viewModelObjects - view model object to update.
 * @param {Object} response - response
 */
function _processViewModelObjectsFromJsonResponse( viewModelObjects, response ) {
    // update the view model object with the view model properties.
    if( response.viewModelJSON && !response.viewModelPropertiesJsonString ) {
        // remove after SOA is updated
        response.viewModelPropertiesJsonString = response.viewModelJSON;
    }

    if( response && response.viewModelPropertiesJsonString ) {
        var responseObject = parsingUtils.parseJsonString( response.viewModelPropertiesJsonString );
        var objectsInResponse = responseObject.objects;

        viewModelObjects.forEach( ( viewModelObject ) => {
            var objectUpdated = false;
            if( viewModelObject ) {
                if ( viewModelObject?.fetchRemainingProps ) {
                    delete viewModelObject.fetchRemainingProps;
                }
                objectsInResponse.forEach( ( currentObject ) => {
                    if( !objectUpdated && currentObject && currentObject.uid === viewModelObject.uid ) {
                        tcViewModelObjectService.mergeObjects( viewModelObject, currentObject );
                        objectUpdated = true;
                    }
                } );
            }
        } );
    }
}

// eslint-disable-next-line sonarjs/no-unused-collection
var callStats = [];

export default class TreePropertyCallProvider {
    // Construct an TreePropertyCallProvider
    constructor( commandContext, nextInChain, gotFirstProps, backGroundCall ) {
        var currentContext = appCtxSvc.getCtx( commandContext.occContext.viewKey );
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.gotFirstProps = gotFirstProps;

        this.clientScopeURI = commandContext.occContext.productContextInfo.props.awb0ClientScopeUri.dbValues[ 0 ] ? commandContext.occContext.productContextInfo.props.awb0ClientScopeUri.dbValues[ 0 ] :
            commandContext.clientScopeURI;
        this.columnsToExclude = currentContext.columnsToExclude;
        const searchResponseInfo = appCtxSvc.getCtx( 'searchResponseInfo' );
        this.typesToInclude = searchResponseInfo?.columnConfig?.typesForArrange;
        this.gridId = 'occTreeTable';
        this.vmc = commandContext.occContext.vmc;
        this.uwDataProvider = commandContext.dataProvider;
        this.pending = new Set();
        this.occContext = commandContext.occContext;
        this.backGroundCall = backGroundCall;
        //Below code changes has been made to sync clientScopeURI attribute when usecase perform for expansion
        // either via clicking on show children cmd or via RMB
        if( this.uwDataProvider && this.uwDataProvider.objectSetUri ) {
            this.clientScopeURI = this.uwDataProvider.objectSetUri;
        }
    }

    getInitialPropLoadPageSize() {
        let initialPropLoadPageSize = 100; // default page size
        if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize ) && appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize.length > 0 ) {
            initialPropLoadPageSize = parseInt( appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize[ 0 ] );
        }
        return initialPropLoadPageSize;
    }

    getObjectsWithoutProps() {
        let numProps = this.count === 0 ? this.getInitialPropLoadPageSize() : propertyCallTimer.getNumberOfLinesToProcess( this.occContext );
        return _getObjsWithMissingProps( this.vmc, this.uwDataProvider, numProps, this.pending );
    }

    invokeNext() {
        // TODO: Chain of responsibility

        let requestVMTNs = this.getObjectsWithoutProps();
        let loadedVMObjects = [];
        let visibleVMObjects = [];
        if( this.count === 0 && this.gotFirstProps && requestVMTNs.length === 0 ) {
            let loadedVMOs = this.vmc.getLoadedViewModelObjects();
            let vmoId = this.vmc.findViewModelObjectById( this.occContext.pwaSelection[ 0 ].uid );
            let topVMO = loadedVMOs[ 0 ];
            occurrencesLoader.collectVisibleVMTNs( topVMO, loadedVMObjects, 0 );
            let selectedVMO = loadedVMOs[ vmoId ];
            occurrencesLoader.collectVisibleVMTNs( selectedVMO, visibleVMObjects, 0 );
            requestVMTNs = visibleVMObjects.length > this.getInitialPropLoadPageSize() ? visibleVMObjects.slice( 0, this.getInitialPropLoadPageSize() ) : visibleVMObjects;
        }

        if( requestVMTNs.length === 0 ) {
            return { calls: 0, finished: true };
        }

        this.count++;
        let callId = 'props_' + this.count;
        console.log( callId + ': TreePropertyCallProvider_invokeNext' );
        let count = this.count;

        let soaService = soaSvc;
        let callType = 'foreground';
        if( this.count > 1 || this.backGroundCall === true ) {
            soaService = backgroundSoaSvc;
            callType = 'background';
        }

        let optType = this.uwDataProvider && this.uwDataProvider.columnConfig && this.uwDataProvider.columnConfig.operationType ? this.uwDataProvider.columnConfig.operationType : 'Union';
        var input = _getTVMPSoaInput( requestVMTNs, optType, this.clientScopeURI, this.columnsToExclude, this.typesToInclude );
        let isRedLineMode = appCtxSvc.getCtx( 'isRedLineMode' );
        if( isRedLineMode === 'true' ) {
            input.input.requestPreference.addAdditionalPropsToServiceData = [ 'awb0MarkupType', 'awb0MarkupPropertyNames', 'awb0MarkupPropertyValues' ];
        }
        soaService.post( 'Internal-AWS2-2025-06-DataManagement', 'getTableViewModelProperties3', input, aceTreeTableDataService.getEffectiveOverriddenPolicy( this.occContext ) )

            .then( function( _response ) {
                if( _response.output?.columnConfig ) {
                    _response.output.columnConfig = tcDataMgmtSvc.processSoaResponseColumnConfigToSwf( _response.output.columnConfig );
                }
                // TODO: Can we also get a server-side duration? That would let us
                // calcuate latency
                let duration = invoker.callFinished( callId );
                let loadPropsTimer = expandRequests.loadTreePropertiesInBackgroundEnabled();
                callStats.push( { count, duration } );

                if( loadPropsTimer === true ) {
                    propertyCallTimer.setPropertyCallTimer( duration, requestVMTNs.length );
                }

                propertyLoader.updateTreeNodePropertiesFromCDM( requestVMTNs );
                if( this.count === 1 && this.gotFirstProps && loadedVMObjects.length > 0 ) {
                    this.vmc.update( loadedVMObjects );
                }
                // Call to process DCP from response Json
                _processViewModelObjectsFromJsonResponse( requestVMTNs, _response.output );
                _updateIconURL( requestVMTNs );
                _removeFromPending( requestVMTNs, this.pending );
                if( this.count === 1 && this.gotFirstProps && loadedVMObjects.length > 0 ) {
                    this.vmc.update( loadedVMObjects );
                }
                eventBus.publish( 'occMgmt.visibilityStateChanged' );
                // Notify table to refresh to reflect new prop values in vmos
                // TODO: Do this all the time? Or only when the new props are visible?
                if( this.count === 1 ) {
                    eventBus.publish( this.gridId + '.plTable.clientRefresh' );
                }
                if( this.nextInChain && this.nextInChain !== null ) {
                    var result = this.nextInChain.invokeNext( requestVMTNs );
                    return { calls: result.calls, finished: false };
                }
            }.bind( this ) );

        // Add set of VMTNs that we've just requested to the pending set to avoid requesting them
        // again if we get another invokation of property fetching before this current one is finished
        _addToPending( requestVMTNs, this.pending );

        // After invoking a call, always return not finished; more objects may
        // later appear to fetch properties for and this will gives us another chance
        var timeEstimate = requestVMTNs.length * 4 + 100; // getTVMP with a few props typically takes 15ms per object + 500ms constant
        return { calls: 1, type: callType, nextAction: 'async', time: timeEstimate, finished: false };
    }
}
