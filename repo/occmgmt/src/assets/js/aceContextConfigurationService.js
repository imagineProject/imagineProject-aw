// Copyright (c) 2021 Siemens

/**
 * @module js/aceContextConfigurationService
 */
import cdm from 'soa/kernel/clientDataModel';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

/**
 * get occurrecns from response
 */
export let getProducts = function( data ) {
    return data.parentChildrenInfos[0].childrenInfo.map( function( childInfo ) {
        return cdm.getObject( childInfo.occurrence.uid );
    } );
};

/**
 * @param {Object} objectsToSelect - Object to select
 * @param {String} occContext - occContext
 */
export let focusOnProductSelectedFromPopup = function( objectsToSelect, occContext ) {
    let selectionsToModify = {
        elementsToSelect:[ objectsToSelect ]
    };
    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
};


export let getCurrentContexts = function( occContext ) {
    var context = [];
    if( occContext ) {
        context.push( cdm.getObject( occContext.productContextInfo.props.awb0Product.dbValues[ 0 ] ) );
    }
    return context;
};

/**
 * Function to get the count of products in element to PCI map
 *
 * @param {elementToPCIMap} elementToPCIMap
 * @returns Count of elements in the elementToPCIMap
 */

export let getElementToPCIMapCount = function( elementToPCIMap ) {
    return Object.keys( elementToPCIMap ).length;
};
/**
 * Context Configuration service utility
 */

export default exports = {
    getProducts,
    getCurrentContexts,
    focusOnProductSelectedFromPopup,
    getElementToPCIMapCount
};
