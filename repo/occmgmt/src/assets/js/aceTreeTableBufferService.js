
//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@
/*global
 define
 */

/**
 * @module js/aceTreeTableBufferService
 */

import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';


/**
  * ***********************************************************<BR>
  * Define external API<BR>
  * ***********************************************************<BR>
  */
var exports = {};

var _getBufferPageSize = function() {
    var bufferPageSize = 400; // default page size
    if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_BufferPropLoadPageSize ) && appCtxSvc.ctx.preferences.AWB_BufferPropLoadPageSize.length > 0  ) {
        bufferPageSize = parseInt( appCtxSvc.ctx.preferences.AWB_BufferPropLoadPageSize[0] );
    }
    return bufferPageSize;
};

export var getInitialPropertyLoadPageSize = function() {
    var initialPropLoadPageSize = 100; // default page size

    if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize ) && appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize.length > 0  ) {
        initialPropLoadPageSize = parseInt( appCtxSvc.ctx.preferences.AWB_InitialPropLoadPageSize[0] );
    }
    return initialPropLoadPageSize;
};

var _isScrolledPagePropertyLoadIsInProgress = function( vmc, scrollPosition ) {
    for( var inx = scrollPosition.firstIndex; inx <= scrollPosition.lastIndex; ++inx ) {
        var vmo = vmc.getViewModelObject( inx );
        if( !_.isUndefined( vmo ) && ( _.isUndefined( vmo.props ) || vmo.props.length === 0 ) ) {
            return true;
        }
    }
    return false;
};

var _getEmptyVmosBasedOnPosition = function( vmNodes, startPos, lastPos, maxPageSize, bufferPageWidth ) {
    var totalNoOfPages = parseInt( vmNodes.length / maxPageSize ) + 1;
    var pageOfStartIndex =   parseInt( startPos / maxPageSize ) - bufferPageWidth  > 0  ? parseInt( startPos / maxPageSize ) - bufferPageWidth : 0;
    var pageOfEndIndex =   parseInt( lastPos / maxPageSize ) + bufferPageWidth  < totalNoOfPages  ? parseInt( lastPos / maxPageSize ) + bufferPageWidth : totalNoOfPages;
    var page =  {
        startIndex : -1,
        endIndex : -1,
        emptyVmos : []
    };

    page.startIndex = pageOfStartIndex * maxPageSize;
    page.endIndex = ( pageOfEndIndex + 1 ) * maxPageSize;
    for( var inx = page.startIndex; inx < page.endIndex; ++inx ) {
        var vmo = vmNodes[ inx ];
        if( !_.isUndefined( vmo ) && _.isUndefined( vmo.props ) && page.emptyVmos.length < maxPageSize ) {
            page.emptyVmos.push( vmo );
        }
    }
    return page;
};

var _bufferProperties = function( gridId, emptyVmos ) {
    if( !_.isUndefined( gridId ) && !_.isUndefined( emptyVmos ) && emptyVmos.length > 0  ) {
        eventBus.publish( gridId + '.plTable.loadProps', {
            VMOs: emptyVmos
        } );
    }
};

var _getNextNodeForExpandBelow = function( loadedVMObjects ) {
    var vmoForExpandBelow;
    _.forEach( loadedVMObjects, function( vmo ) {
        if( _.isUndefined( vmoForExpandBelow ) && !_.isUndefined( vmo ) && vmo.isInExpandBelowMode
             && ( _.isUndefined( vmo.children ) && !vmo.isExpanded ) ) {
            vmoForExpandBelow = vmo;
            return false;
        }
    } );
    return vmoForExpandBelow;
};

var _bufferExpandBelowPage = function( vmoForExpandBelow, dataProviderName, scrollPosition, vmc, subPanelContext ) {
    var vmoIdx = vmc.findViewModelObjectById( vmoForExpandBelow.uid );
    let loadedVmos = vmc.getLoadedViewModelObjects();
    if( !_.isNull( scrollPosition ) && !_.isUndefined( scrollPosition ) &&  scrollPosition.firstIndex > vmoIdx  ||  scrollPosition.lastIndex < vmoIdx  ) {
        let expansionCriteria =  {
            expandBelow: true,
            loadTreeHierarchyThreshold: 500,
            scopeForExpandBelow: loadedVmos[0].uid
        };
        if( !_.isUndefined( appCtxSvc.ctx.preferences ) && !_.isUndefined( appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize  )
        && appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize.length > 0  ) {
            expansionCriteria.loadTreeHierarchyThreshold = appCtxSvc.ctx.preferences.AWB_ExpandBelowResponsePageSize[0];
        }

        occmgmtUtils.updateValueOnCtxOrState( 'transientRequestPref', expansionCriteria, subPanelContext.occContext );
        eventBus.publish( dataProviderName + '.expandTreeNode', {
            parentNode:{
                id:vmoForExpandBelow.id
            }
        } );
        scrollPosition.currentExpandBelowBufferVmo = vmoForExpandBelow;
    }
};

/*
 */
export let bufferExtraPages = function( gridId, uwDataProvider, scrollEventData, subPanelContext ) {
    // Scroll position is changed, so buffer extra pages
    // get scroll position from scroll event data
    let scrollPosition = {
        firstIndex : scrollEventData.firstRenderedItem.index,
        lastIndex : scrollEventData.lastRenderedItem.index
    };

    if( _.isUndefined( uwDataProvider ) || _.isUndefined( uwDataProvider.scrollPosition ) || !_.isUndefined( uwDataProvider.scrollPosition.currentPropBufferVmo )
            || !_.isUndefined( uwDataProvider.scrollPosition.currentExpandBelowBufferVmo ) ) {
        return scrollPosition;
    }

    var maxPageSize = _getBufferPageSize();
    if( maxPageSize <= 0 ) { // property load buffering is disabled.
        return scrollPosition;
    }

    // if scroll position has not changed then no action to be done
    if( uwDataProvider.scrollPosition.firstIndex === scrollEventData.firstRenderedItem.index && uwDataProvider.scrollPosition.lastIndex === scrollEventData.lastRenderedItem.index ) {
        return scrollPosition;
    }

    // get VMOs in active view
    var vmc = uwDataProvider.viewModelCollection;
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    // if tree loading or property loading in progress then ignore.
    if( _isScrolledPagePropertyLoadIsInProgress( vmc, scrollPosition ) ) {
        return scrollPosition;
    }

    // identify empty VMOs
    var empyVmoPage;
    var bufferPageWidth = 1;
    do {
        empyVmoPage = _getEmptyVmosBasedOnPosition( loadedVMObjects, scrollPosition.firstIndex, scrollPosition.lastIndex, maxPageSize, bufferPageWidth );
        bufferPageWidth++;         // increase buffer page width to attempt bufferring of broader data around scroll
    } while(  empyVmoPage.emptyVmos.length < maxPageSize  && (  empyVmoPage.endIndex < loadedVMObjects.length  ||  0 !== empyVmoPage.startIndex  ) );

    var emptyVmos = empyVmoPage.emptyVmos;
    if( emptyVmos.length > 0 ) {
        // buffer properties
        let length = emptyVmos.length;
        scrollPosition.currentPropBufferVmo = emptyVmos[ length - 1];
        _bufferProperties( gridId, emptyVmos );
    } else {
        // buffer next expand below page
        var vmoForExpandBelow = _getNextNodeForExpandBelow( loadedVMObjects );
        if( !_.isUndefined( vmoForExpandBelow ) ) {
            _bufferExpandBelowPage( vmoForExpandBelow, uwDataProvider.name, scrollPosition, vmc, subPanelContext );
        }
    }
    return scrollPosition;
};

export let  addExtraBufferToPage = function( input, uwDataProvider, allVMNodes ) {
    var firstPageSize = getInitialPropertyLoadPageSize();
    if( firstPageSize <= 0 || _.isUndefined( input ) || _.isUndefined( uwDataProvider ) ) {
        return;
    }
    // we might have vmNodes array as input or propertyLoadInput as input, extract vmNodes array from input
    var vmNodes;
    if( !_.isUndefined( input.propertyLoadInput ) && !_.isUndefined( input.propertyLoadInput.propertyLoadRequests )
         && !_.isEmpty( input.propertyLoadInput.propertyLoadRequests ) ) {
        vmNodes = input.propertyLoadInput.propertyLoadRequests[0].childNodes;
    } else {
        vmNodes = input.vmNodes;
    }

    if( _.isUndefined( vmNodes ) || _.isEmpty( vmNodes ) || firstPageSize <= vmNodes.length ) {
        return;
    }

    if( _.isUndefined( allVMNodes ) ) {
        var vmc = uwDataProvider.viewModelCollection;
        if( _.isUndefined( vmc ) ) {
            return;
        }
        allVMNodes = vmc.getLoadedViewModelObjects();
    }

    var vmoStartIndex = allVMNodes.indexOf( vmNodes[0] );
    var vmoLastIndex = allVMNodes.indexOf( vmNodes[vmNodes.length - 1] );
    var bufferPageWidth = 1;
    var empyVmoPage = _getEmptyVmosBasedOnPosition( allVMNodes, vmoStartIndex, vmoLastIndex, firstPageSize, bufferPageWidth );

    let vmNodeMap = new Map();
    for( let inx = 0; inx < vmNodes.length; inx++ ) {
        vmNodeMap.set( vmNodes[inx].uid, vmNodes );
    }

    for( let jny = 0; jny < empyVmoPage.emptyVmos.length; jny++ ) {
        if( !vmNodeMap.has( empyVmoPage.emptyVmos[jny].uid ) ) {
            vmNodes.push( empyVmoPage.emptyVmos[jny] );
        }
    }
};

export default exports = {
    addExtraBufferToPage,
    bufferExtraPages,
    getInitialPropertyLoadPageSize
};
