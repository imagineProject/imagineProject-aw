// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Convert single part response to PVW format
 *
 * @module js/pvwSinglePartConverterService
 */

/**
 * Get CadPageExpandResultForSinglePart instance
 *
 * @param {Object} modelObject input model object
 * @param {Object} imanFileUid ImanFile uid
 * @param {Object} jtFileUrl file url
 * @param {Object} baseURL base URL
 * @returns {Object} returns CadPageExpandResultForSinglePart instance
 */
const getCadPageExpandResultForSinglePartInstance = function( modelObject, imanFileUid, jtFileUrl, baseURL ) {
    const returnResponse = new CadPageExpandResultForSinglePart( modelObject, imanFileUid, jtFileUrl, baseURL );
    returnResponse.parseInputProductStructureResult();
    return returnResponse;
};

class CadPageExpandResultForSinglePart {
    /**
     * CadPageExpandResultForSinglePart constructor
     *
     * @param {Object} modelObject input model object
     * @param {Object} imanFileUid ImanFile uid
     * @param {Object} jtFileUrl file url
     * @param {Object} baseURL base URL
     */
    constructor( modelObject, imanFileUid, jtFileUrl, baseURL ) {
        this.modelObject = modelObject;
        this.imanFileUid = imanFileUid;
        this.jtFileUrl = jtFileUrl;
        this.baseURL = baseURL;
        this.topLineUid = this.modelObject.uid;
        this.isFinalResponseVar = true;
        this.numLinesLoaded = 1;
        this.numLinesRemaining = 0;
        this.occsMap = new Map();
    }

    parseInputProductStructureResult() {
        let parentUid = this.modelObject.uid;
        let occ = {};
        occ.isHidden = false;
        occ.childIds = [];
        occ.parentId = '';
        occ.geomId = this.imanFileUid;
        occ.id = '';
        occ.parentId = null;
        occ.name = 'bomline_root_node';
        occ.hasChildren = false;

        let relXForm = null;
        if( this.modelObject.props && this.modelObject.props.fnd0RelativeTransform &&
            Array.isArray( this.modelObject.props.fnd0RelativeTransform.dbValues ) ) {
            relXForm = this.modelObject.props.fnd0RelativeTransform.dbValues[ 0 ];
        }
        occ.xform = Array( 16 ).fill( 0.0 );
        occ.xform[ 0 ] = occ.xform[ 5 ] = occ.xform[ 10 ] = occ.xform[ 15 ] = 1.0;
        if( relXForm && relXForm.length !== 0 ) {
            const tokenizedString = relXForm.split( ' ' );
            let nVals = tokenizedString[ 0 ];
            if( nVals >= 3 ) {
                occ.xform[ 12 ] = parseFloat( tokenizedString[ 1 ] );
                occ.xform[ 13 ] = parseFloat( tokenizedString[ 2 ] );
                occ.xform[ 14 ] = parseFloat( tokenizedString[ 3 ] );
            }
            if( nVals >= 12 ) {
                occ.xform[ 0 ] = parseFloat( tokenizedString[ 4 ] );
                occ.xform[ 4 ] = parseFloat( tokenizedString[ 5 ] );
                occ.xform[ 8 ] = parseFloat( tokenizedString[ 6 ] );

                occ.xform[ 1 ] = parseFloat( tokenizedString[ 7 ] );
                occ.xform[ 5 ] = parseFloat( tokenizedString[ 8 ] );
                occ.xform[ 9 ] = parseFloat( tokenizedString[ 9 ] );

                occ.xform[ 2 ] = parseFloat( tokenizedString[ 10 ] );
                occ.xform[ 6 ] = parseFloat( tokenizedString[ 11 ] );
                occ.xform[ 10 ] = parseFloat( tokenizedString[ 12 ] );
            }
            if( nVals === 16 ) {
                occ.xform[ 3 ] = parseFloat( tokenizedString[ 13 ] );
                occ.xform[ 7 ] = parseFloat( tokenizedString[ 14 ] );
                occ.xform[ 11 ] = parseFloat( tokenizedString[ 15 ] );
                occ.xform[ 15 ] = parseFloat( tokenizedString[ 16 ] );
            }
        }

        occ.numChildren = 0;
        let hostPath = location.protocol + '//' + location.host + '/';
        let slicePos = hostPath.indexOf( '/', 8 );
        if( slicePos !== -1 ) {
            hostPath = hostPath.slice( 0, slicePos );
        }
        let fileName = '';
        if( ( slicePos = this.jtFileUrl.lastIndexOf( '%5c' ) ) !== -1 ) {
            fileName = this.jtFileUrl.slice( slicePos + 3 );
        }
        occ.uri = this.baseURL + 'fms/fmsdownload/' + fileName + '?ticket=' + this.jtFileUrl;
        this.occsMap.set( parentUid, occ );
    }

    getNodeIds() {
        return Array.from( this.occsMap.keys() );
    }

    getNodeCSIDs( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.id );
        } );
        return returnMap;
    }

    getChildren( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.childIds );
        } );
        return returnMap;
    }

    getTransforms( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.xform );
        } );
        return returnMap;
    }

    getTransformOverrides( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, { xformOverrideLevel: val.xformOverrideLevel, xformOverride: val.xformOverride } );
        } );
        return returnMap;
    }

    getJTFileTickets( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.uri );
        } );
        return returnMap;
    }

    getDisplayNames( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.name );
        } );
        return returnMap;
    }

    getFlags( nodeIds, flag ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val[ flag ] );
        } );
        return returnMap;
    }

    getHasChildren( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.hasChildren );
        } );
        return returnMap;
    }

    getGeometryIDs( nodeIds ) {
        const returnMap = new Map();
        const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
        filteredOccsMap.forEach( ( val, key ) => {
            returnMap.set( key, val.geomId );
        } );
        return returnMap;
    }

    isFinalResponse() {
        return this.isFinalResponseVar;
    }

    getNumLinesLoaded() {
        return this.numLinesLoaded;
    }

    getNumLinesRemaining() {
        return this.numLinesRemaining;
    }

    getFilteredEntriesFromOccsMap( nodeIds ) {
        return new Map(
            Array.from( this.occsMap ).filter( ( [ _key ] ) => {
                return nodeIds.includes( _key );
            } )
        );
    }
}

export default {
    getCadPageExpandResultForSinglePartInstance
};
