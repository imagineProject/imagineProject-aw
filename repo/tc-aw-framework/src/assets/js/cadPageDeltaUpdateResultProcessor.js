// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * This module provides services for processing delta update response
 *
 * @module js/cadPageDeltaUpdateResultProcessor
 */

import _ from 'lodash';
import cadPageRequestsUtils from 'js/cadPageRequestsUtils';

/**
 * Process the Delta update response and return the CadPageDeltaUpdateData object.
 *
 * @param {Object} responseArray - The response object Array
 * @param {Object} topBomLine - The top Bom line
 * @param {Map} uidToCsidChainMap - The map of BOM line UID to CSID.
 * @returns {CadPageDeltaUpdateData} The CadPageDeltaUpdateData object.
 */
export const processDeltaUpdateResponse = ( responseArray, topBomLine, uidToCsidChainMap ) => {
    const response = processResponseArray( responseArray );
    const { deltaBomLineInfoObjects = [], bomLineModelObjectsArray = [], deletedLines = [] } = response;
    const { bomLineMap, bomLineReasonInfoArray } = processDeltaBomLineInfo( deltaBomLineInfoObjects, deletedLines );
    //Add parent and hasChildren info to bomLineMap
    processBomLine( bomLineModelObjectsArray, bomLineMap );
    //Add CSID chain info to bomLineMap
    const newUidToCsidMap = addCsidChainInfoForToBomLines( bomLineMap, bomLineModelObjectsArray, uidToCsidChainMap, topBomLine );
    return {
        deltaUpdateData: new CadPageDeltaUpdateData( bomLineMap, bomLineReasonInfoArray ),
        newUidToCsidMap: newUidToCsidMap
    };
};

/**
 * Consolidate the response array into a single object.
 *
 * @param {Array} responseArray - The response object array.
 * @returns {Object} The consolidated response object.
 */
function processResponseArray( responseArray ) {
    let bomLineModelObjectsArray = [];
    let deltaBomLineInfoObjects = [];
    let deletedLines = [];
    responseArray.forEach( ( response ) => {
        let modelObjectArray = Object.entries( response.ServiceData.modelObjects ).filter( ( [ key, value ] ) => value.type === 'BOMLine' );
        bomLineModelObjectsArray.push( ...modelObjectArray );
        deltaBomLineInfoObjects.push( ...response.deltaInfo[0].bomLineInfo );
        if( response.deltaInfo[0].deletedLinesUidStr ) {
            deletedLines.push( ...response.deltaInfo[0].deletedLinesUidStr );
        }
    } );
    return {
        bomLineModelObjectsArray: bomLineModelObjectsArray,
        deltaBomLineInfoObjects: deltaBomLineInfoObjects,
        deletedLines:deletedLines
    };
}

/**
 * Process the delta info from the response.
 *
 * @param {Array} bomLineInfo - The BOM line info array.
 * @param {Array} deletedLines - The array of deleted lines.
 * @returns {Object} The processed delta info.
 */
function processDeltaBomLineInfo( bomLineInfo, deletedLines ) {
    const bomLineMap = new Map();
    const bomLineInfoArray = [ ...bomLineInfo ];
    bomLineInfoArray.forEach( ( bomLineObject ) => {
        if( bomLineObject.bomLine && bomLineObject.bomLine.uid && bomLineObject.bomLine.type === 'BOMLine' ) {
            bomLineMap.set( bomLineObject.bomLine.uid, {} );
        }
    } );
    deletedLines.forEach( ( deletedLine ) => {
        bomLineMap.set( deletedLine, {} );
        bomLineInfoArray.push( {
            reason: 'Deleted',
            bomLine: {
                uid: deletedLine,
                type: 'BOMLine'
            }
        } );
    } );
    return {
        bomLineMap: bomLineMap,
        bomLineReasonInfoArray: bomLineInfoArray
    };
}

/**
 * Process a BOM line object.
 *
 * @param {Array} modelObjects - The array of BOM line model objects.
 * @param {Map} bomLineMap - The map of BOM line objects.
 * @param {Map} bomLineUidToCsidMap - The map of BOM line UID to CSID.
 */
function processBomLine( modelObjects, bomLineMap ) {
    modelObjects.forEach( ( [ key, value ] ) => {
        let bomline = bomLineMap.get( key );
        if( bomline ) {
            const hasChildren = value.props && value.props.bl_has_children && value.props.bl_has_children.uiValues ? value.props.bl_has_children.uiValues[0] : 'False';
            const parentId =  value.props && value.props.bl_parent && value.props.bl_parent.dbValues ? value.props.bl_parent.dbValues[0] : null;
            bomline.hasChildren = hasChildren === 'True';
            bomline.parentId = parentId;
        }
    } );
}

/**
 * Add CSID chain info for BOM lines.
* @param {Map} bomLineMap - The map of BOM line objects.
* @param {Array} bomLineModelObjectsArray - The array of BOM line model objects.
* @param {Map} bomLineUidToCsidMap - The map of BOM line UID to CSID.
* @param {Object} topBomLine - The top BOM line object.
* @returns {Map} The map of BOM line UID to CSID.
 */
function addCsidChainInfoForToBomLines( bomLineMap, bomLineModelObjectsArray, bomLineUidToCsidMap, topBomLine ) {
    const bomLineModelObjects = Object.fromEntries( bomLineModelObjectsArray );
    const newUidToCsidMap = new Map();
    for ( let [ key, value ] of bomLineMap.entries() ) {
        let csid_path = bomLineUidToCsidMap.get( key );
        if( csid_path ) {
            value.csid = csid_path;
        } else {
            let bomLineModelObject = bomLineModelObjects[key];
            if( bomLineModelObject ) {
                csid_path = cadPageRequestsUtils.computeCsidPath( bomLineModelObject, bomLineModelObjects, topBomLine, bomLineUidToCsidMap );
                if( csid_path && csid_path.length > 0 ) {
                    newUidToCsidMap.set( bomLineModelObject.uid, csid_path );
                    value.csid = csid_path;
                }
            }
            if( !value.csid ) {
                bomLineMap.delete( key );
            }
        }
        if( value.parentId && csid_path.includes( '/' ) ) {
            let csidChainArray = csid_path.split( '/' );
            if( _.isArray( csidChainArray ) && csidChainArray.length > 1 ) {
                csidChainArray.pop();
                value.parentCsid = csidChainArray.length > 1 ? csidChainArray.join( '/' ) : csidChainArray[0];
            }
        }
    }
    return newUidToCsidMap;
}

/**
 * Represents the data for CadPageDeltaUpdate.
 */
export class CadPageDeltaUpdateData {
    /**
     * Create a CadPageDeltaUpdateData object.
     *
     * @param {Map} bomLineMap - The map of BOM line objects.
     * @param {Array} deltaBomLineInfoObjects - The array of BOM line info objects.
     */
    constructor( bomLineMap, deltaBomLineInfoObjects ) {
        this._bomLineMap = bomLineMap;
        this._deltaBomLineInfoObjects = deltaBomLineInfoObjects;
    }

    /**
     * Get the filtered entries from the BOM line map.
     *
     * @param {Array} nodeIds - The array of node IDs.
     * @returns {Map} The filtered entries from the BOM line map.
     */
    _getFilteredEntriesFromBomLineMap( nodeIds ) {
        const nodeIdSet = new Set( nodeIds );
        return new Map(
            Array.from( this._bomLineMap ).filter( ( [ key ] ) => nodeIdSet.has( key ) )
        );
    }

    /**
     *  Get property for nodes
     * @param {Array} nodeIds - The array of node IDs
     * @param {String} property - property name from BOMLine
     * @returns {Map} - The map of node IDs to property values
     */
    _getPropertyForNodes( nodeIds, property ) {
        const returnMap = new Map();
        const filteredBomLineMap = this._getFilteredEntriesFromBomLineMap( nodeIds );
        filteredBomLineMap.forEach( ( value, key )=>{
            returnMap.set( key, value[property] );
        } );
        return returnMap;
    }

    /**
     * Get the node IDs.
     *
     * @returns {Array} The array of node IDs.
     */
    getNodeIds() {
        return Array.from( this._bomLineMap.keys() );
    }

    /**
     * Get the CSIDs for the given node IDs.
     *
     * @param {Array} nodeIds - The array of node IDs.
     * @returns {Map} The map of node IDs to CSIDs.
     */
    getNodeCSIDs( nodeIds ) {
        return nodeIds ? this._getPropertyForNodes( nodeIds, 'csid' ) : new Map();
    }

    /**
     * Get the hasChildren values for the given node IDs.
     *
     * @param {Array} nodeIds - The array of node IDs.
     * @returns {Map} The map of node IDs to hasChildren values.
     */
    getHasChildren( nodeIds ) {
        return nodeIds ? this._getPropertyForNodes( nodeIds, 'hasChildren' ) : new Map();
    }

    /**
     * Get the parent values for the given node IDs.
     * @param {Array} nodeIds - The array of node IDs.
     * @returns {Map} The map of node IDs to parent csid values.
     */
    getParent( nodeIds ) {
        return nodeIds ? this._getPropertyForNodes( nodeIds, 'parentCsid' ) : new Map();
    }

    /**
     * Gets Bom line info Object
     * @returns {Map} The Array of BOM line info objects.
     */
    getBomLineReasonInfoObjects() {
        return this._deltaBomLineInfoObjects;
    }
}

export default {
    processDeltaUpdateResponse
};
