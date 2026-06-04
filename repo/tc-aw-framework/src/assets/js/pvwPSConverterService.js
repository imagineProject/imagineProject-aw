// @<COPYRIGHT>@
// ==================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Convert PS expand response to PVW format
 *
 * @module js/pvwPSConverterService
 */

/**
 * function to process product structure
 *
 * @param {Object} inputPS input product structure data
 * @param {Object} uidToCsidChainMap Uid to csid chain map
 * @param {Object} baseURL base URL
 * @param {Object} topLineUid top line uid
 * @param {Boolean} isFinalResponse boolean indicating if this is a final response
 * @param {Object} loadedMO loaded model objects
 *
 * @returns {Object} returns CadPageExpandResult instance
 */
export const processProductStructure = ( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining ) => {
    const onconnect = ( event ) => {
        const port = event.ports[ 0 ];
        let cadPageExpandResult = null;
        port.onmessage = ( e ) => {
            let returnResponse = null;
            switch ( e.data[ 0 ] ) {
                case 'INIT':
                    cadPageExpandResult = getCadPageExpandResultInstance( e.data[ 1 ], e.data[ 2 ], e.data[ 3 ], e.data[ 4 ], e.data[ 5 ], e.data[ 6 ], e.data[ 7 ] );
                    cadPageExpandResult.parseInputProductStructureResult();
                    port.postMessage( [ e.data[ 0 ] + 'RESPONSE', true ] );
                    break;
                case 'GETNODEIDS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getNodeIds();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNODECSIDS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getNodeCSIDs( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETCHILDREN':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getChildren( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETTRANSFORMS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getTransforms( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETTRANSFORMOVERRIDES':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getTransformOverrides( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETJTFILETICKETS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getJTFileTickets( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETDISPLAYNAMES':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getDisplayNames( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETFLAGS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getFlags( e.data[ 1 ], e.data[ 2 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETHASCHILDREN':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getHasChildren( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETISFINALRESPONSE':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.isFinalResponse();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNUMLINESLOADED':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getNumLinesLoaded();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNUMLINESREMAINING':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getNumLinesRemaining();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETGEOMETRYIDS':
                    if( cadPageExpandResult ) {
                        returnResponse = cadPageExpandResult.getGeometryIDs( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'CLOSE':
                    close();
            }
        };
    };

    /**
     * Get CadPageExpandResult instance
     *
     * @param {Object} inputPS input product structure data
     * @param {Object} uidToCsidChainMap Uid to csid chain map
     * @param {Object} baseURL base URL
     * @param {Object} topLineUid top line uid
     * @param {Boolean} isFinalResponse boolean indicating if this is a final response
     * @param {Object} loadedMO loaded model objects
     *
     * @returns {Object} returns CadPageExpandResult instance
     */
    const getCadPageExpandResultInstance = function( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining ) {
        return new CadPageExpandResult( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining );
    };

    class CadPageExpandResult {
        /**
         * CadPageExpandResult constructor
         *
         * @param {Object} inputPS input product structure data
         * @param {Object} uidToCsidChainMap Uid to csid chain map
         * @param {Object} baseURL base URL
         * @param {Object} topLineUid top line uid
         * @param {Boolean} isFinalResponse boolean indicating if this is a final response
         * @param {Object} loadedMO loaded model objects
         */
        constructor( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining ) {
            this.inputPS = inputPS;
            this.uidToCsidChainMap = uidToCsidChainMap;
            this.baseURL = baseURL;
            this.topLineUid = topLineUid;
            this.isFinalResponseVar = isFinalResponse;
            this.numLinesLoaded = numLinesLoaded;
            this.numLinesRemaining = numLinesRemaining;
            this.occsMap = new Map();
        }

        parseInputProductStructureResult() {
            this.inputPS.extraObjs.forEach( element => {
                let parentUid = element.parentInfo.bomLine.uid;
                let occ = this.occsMap.get( parentUid );
                if( occ === undefined ) {
                    occ = {};
                    occ.isHidden = false;
                    occ.childIds = [];
                    occ.parentId = '';
                    let csID = this.uidToCsidChainMap.get( parentUid );
                    if( csID ) {
                        occ.id = csID + '/';
                        occ.geomId = csID;
                    }

                    // let's see if this is the root
                    if( this.topLineUid === parentUid ) {
                        //special case for the root
                        occ.geomId = 'bomline_root_node';
                        occ.id = '';
                        occ.parentId = null;
                        occ.name = 'bomline_root_node';
                    }

                    let parentBOMLine = this.inputPS.ServiceData.modelObjects[ parentUid ];
                    if( parentBOMLine !== undefined ) {
                        if( parentBOMLine.props && parentBOMLine.props.bl_line_name ) {
                            occ.name = parentBOMLine.props.bl_line_name.dbValues[ 0 ];
                        }
                        if( parentBOMLine.props && parentBOMLine.props.bl_has_children ) {
                            occ.hasChildren = parentBOMLine.props.bl_has_children.dbValues[ 0 ] === '1';
                        }
                    }

                    let relXForm = null;
                    if( parentBOMLine?.props?.fnd0RelativeTransform?.dbValues?.length > 0 ) {
                        relXForm = parentBOMLine.props.fnd0RelativeTransform.dbValues[ 0 ];
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

                    this.occsMap.set( parentUid, occ );

                    occ.numChildren = element.childrenInfo.length;
                    element.childrenInfo.forEach( child => {
                        this.parseChildNode( child, occ );
                    } );
                }
            } );
        }

        parseChildNode( node, parentOcc ) {
            let uid = node.bomLine.uid;
            let occ = this.occsMap.get( uid );
            if( occ === undefined ) {
                occ = {};
                occ.isHidden = false;
                this.occsMap.set( uid, occ );
                occ.childIds = [];
                let csID = this.inputPS.ServiceData.modelObjects[ uid ].props.bl_clone_stable_occurrence_id.dbValues[ 0 ];
                occ.id = parentOcc.id + csID + '/';
                occ.parentId = parentOcc.id;
                parentOcc.childIds.push( uid );
                occ.name = this.inputPS.ServiceData.modelObjects[ uid ].props.bl_line_name.dbValues[ 0 ];
                occ.hasChildren = this.inputPS.ServiceData.modelObjects[ uid ].props.bl_has_children.dbValues[ 0 ] === '1';
                if( node.relatedObjects.length > 0 && node.relatedObjects[ 0 ].namedRefList.length > 0 && occ.hasChildren === false ) {
                    occ.geomId = node.relatedObjects[ 0 ].namedRefList[ 0 ].referenceObject.uid;
                } else {
                    occ.geomId = csID;
                }
                let relXForm = null;
                if( this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransform ) {
                    relXForm = this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransform.dbValues[ 0 ];
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

                let relXFormOverride = null;
                if( this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransformOverride ) {
                    relXFormOverride = this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransformOverride.dbValues[ 0 ];
                }

                if( relXFormOverride && relXFormOverride.length !== 0 ) {
                    const tokenizedString = relXFormOverride.split( ' ' );
                    occ.xformOverrideLevel = parseInt( tokenizedString[ 0 ] );

                    occ.xformOverride = Array( 16 ).fill( 0.0 );
                    occ.xformOverride[ 0 ] = occ.xformOverride[ 5 ] = occ.xformOverride[ 10 ] = occ.xformOverride[ 15 ] = 1.0;

                    let nVals = tokenizedString[ 1 ];
                    if( nVals >= 3 ) {
                        occ.xformOverride[ 12 ] = parseFloat( tokenizedString[ 2 ] );
                        occ.xformOverride[ 13 ] = parseFloat( tokenizedString[ 3 ] );
                        occ.xformOverride[ 14 ] = parseFloat( tokenizedString[ 4 ] );
                    }
                    if( nVals >= 12 ) {
                        occ.xformOverride[ 0 ] = parseFloat( tokenizedString[ 5 ] );
                        occ.xformOverride[ 4 ] = parseFloat( tokenizedString[ 6 ] );
                        occ.xformOverride[ 8 ] = parseFloat( tokenizedString[ 7 ] );

                        occ.xformOverride[ 1 ] = parseFloat( tokenizedString[ 8 ] );
                        occ.xformOverride[ 5 ] = parseFloat( tokenizedString[ 9 ] );
                        occ.xformOverride[ 9 ] = parseFloat( tokenizedString[ 10 ] );

                        occ.xformOverride[ 2 ] = parseFloat( tokenizedString[ 11 ] );
                        occ.xformOverride[ 6 ] = parseFloat( tokenizedString[ 12 ] );
                        occ.xformOverride[ 10 ] = parseFloat( tokenizedString[ 13 ] );
                    }
                    if( nVals === 16 ) {
                        occ.xformOverride[ 3 ] = parseFloat( tokenizedString[ 14 ] );
                        occ.xformOverride[ 7 ] = parseFloat( tokenizedString[ 15 ] );
                        occ.xformOverride[ 11 ] = parseFloat( tokenizedString[ 16 ] );
                        occ.xformOverride[ 15 ] = parseFloat( tokenizedString[ 17 ] );
                    }
                }

                if( node.relatedObjects.length > 0 ) {
                    let readTicket = node.relatedObjects[ 0 ].namedRefList[ 0 ].fileTicket;
                    let hostPath = location.protocol + '//' + location.host + '/';
                    let slicePos = hostPath.indexOf( '/', 8 );
                    if( slicePos !== -1 ) {
                        hostPath = hostPath.slice( 0, slicePos );
                    }
                    let fileName = '';
                    if( ( slicePos = readTicket.lastIndexOf( '%5c' ) ) !== -1 ) {
                        fileName = readTicket.slice( slicePos + 3 );
                    }
                    occ.uri = this.baseURL + 'fms/fmsdownload/' + fileName + '?ticket=' + readTicket;
                }
                for( let i = 0; i < this.inputPS.extraObjs.length; i++ ) {
                    if( this.inputPS.extraObjs[ i ].parentInfo.bomLine.uid === uid ) {
                        occ.numChildren = this.inputPS.extraObjs[ i ].childrenInfo.length;
                        this.inputPS.extraObjs[ i ].childrenInfo.forEach( child => {
                            this.parseChildNode( child, occ );
                        } );
                    }
                }
            }
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

    // ****** DO NOT MODIFY processProductStructure FUNCTION BELOW THIS LINE. ********
    // WE ARE PARSING THIS FUNCTION TO CREATE WEB WORKER AND IT ONLY SHOULD TAKE THE CODE ABOVE
    if( inputPS && uidToCsidChainMap && baseURL && topLineUid ) {
        const cadPageExpandResult = getCadPageExpandResultInstance( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining );
        cadPageExpandResult.parseInputProductStructureResult();
        return cadPageExpandResult;
    }
    return null;
};

export const getPVWProductStructureWorker = () => {
    let code = processProductStructure.toString();
    code = 'onconnect' + code.substring( code.indexOf( '=', parseInt( code.indexOf( '=' ) + 1 ) ) );
    code = code.substring( code.indexOf( 'onconnect' ), code.lastIndexOf( 'if' ) );
    const blob = new Blob( [ code ], { type: 'text/javascript' } );
    return new SharedWorker( URL.createObjectURL( blob ) );
};

export default {
    processProductStructure,
    getPVWProductStructureWorker
};
