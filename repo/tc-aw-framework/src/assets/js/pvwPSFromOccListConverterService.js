// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/**
 * Convert PS from Occurence list response to PVW format
 *
 * @module js/pvwPSFromOccListConverterService
 */

/**
 *  Process product structure from Occurence list
 * @param {Object} inputPS input product structure data
 * @param {Object} uidToCsidChainMap Uid to csid chain map
 * @param {Object} baseURL base URL
 * @param {Object} topLineUid top line uid
 * @param {Boolean} isFinalResponse boolean indicating if this is a final response
 * @param {Object} numLinesLoaded number of lines loaded
 * @param {Object} numLinesRemaining number of lines remaining
 * @returns {Object} returns CadPageExpandResultFromOccList instance
 */
export const processProductStructureFromOccList = ( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining ) => {
    const onconnect = ( event ) => {
        const port = event.ports[ 0 ];
        let cadPageExpandResultFromOccList = null;
        port.onmessage = ( e ) => {
            let returnResponse = null;
            switch ( e.data[ 0 ] ) {
                case 'INIT':
                    cadPageExpandResultFromOccList = getCadPageExpandResultFromOccListInstance( e.data[ 1 ], e.data[ 2 ], e.data[ 3 ], e.data[ 4 ], e.data[ 5 ], e.data[ 6 ], e.data[ 7 ] );
                    cadPageExpandResultFromOccList.parseInputProductStructureFromOccList();
                    port.postMessage( [ e.data[ 0 ] + 'RESPONSE', true ] );
                    break;
                case 'GETNODEIDS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getNodeIds();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNODECSIDS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getNodeCSIDs( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETCHILDREN':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getChildren( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETTRANSFORMS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getTransforms( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETTRANSFORMOVERRIDES':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getTransformOverrides( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETJTFILETICKETS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getJTFileTickets( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETDISPLAYNAMES':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getDisplayNames( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETFLAGS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getFlags( e.data[ 1 ], e.data[ 2 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETHASCHILDREN':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getHasChildren( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETISFINALRESPONSE':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.isFinalResponse();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNUMLINESLOADED':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getNumLinesLoaded();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETNUMLINESREMAINING':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getNumLinesRemaining();
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'GETGEOMETRYIDS':
                    if( cadPageExpandResultFromOccList ) {
                        returnResponse = cadPageExpandResultFromOccList.getGeometryIDs( e.data[ 1 ] );
                        port.postMessage( [ e.data[ 0 ] + 'RESPONSE', returnResponse ] );
                    }
                    break;
                case 'CLOSE':
                    close();
            }
        };
    };

    /**
     * Get CadPageExpandResultFromOccList instance
     *
     * @param {Object} inputPS input product structure data
     * @param {Object} uidToCsidChainMap Uid to csid chain map
     * @param {Object} baseURL base URL
     * @param {Object} topLineUid top line uid
     * @param {Boolean} isFinalResponse boolean indicating if this is a final response
     * @param {Object} numLinesLoaded number of lines loaded
     * @param {Object} numLinesRemaining number of lines remaining
     * @returns {Object} returns CadPageExpandResultFromOccList instance
     *
     */
    const getCadPageExpandResultFromOccListInstance = function( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining ) {
        return new CadPageExpandResultFromOccList( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining );
    };

    class CadPageExpandResultFromOccList {
        /**
         * CadPageExpandResultFromOccList constructor
         *
         * @param {Object} inputPS input product structure data
         * @param {Object} uidToCsidChainMap Uid to csid chain map
         * @param {Object} baseURL base URL
         * @param {Object} topLineUid top line uid
         * @param {Boolean} isFinalResponse boolean indicating if this is a final response
         * @param {Object} numLinesLoaded number of lines loaded
         * @param {Object} numLinesRemaining number of lines remaining
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

        /**
         * Get Occurence
         * @param {String} parentUid parent uid
         * @returns {Object} returns occurence object
         */
        getOccurence( parentUid ) {
            let occ = {};
            occ.isHidden = false;
            occ.childIds = [];
            occ.parentId = '';
            let csID = this.uidToCsidChainMap.get( parentUid );
            if( csID ) {
                occ.id = csID + '/';
                occ.geomId = csID;
            } else if( this.topLineUid !== parentUid ) {
                let parentParentUid = this.inputPS.ServiceData.modelObjects[ parentUid ].props.bl_parent.dbValues[ 0 ];
                let parentCSID;
                if( parentParentUid === this.topLineUid ) {
                    parentCSID = '';
                } else {
                    parentCSID = this.uidToCsidChainMap.get( parentParentUid );
                }

                if( parentCSID !== undefined ) {
                    occ.parentId = parentCSID;
                    csID = this.inputPS.ServiceData.modelObjects[ parentUid ].props.bl_clone_stable_occurrence_id.dbValues[ 0 ];
                    occ.id = parentCSID + csID + '/';
                }
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
            return occ;
        }

        /**
         * Parse input product structure from Occurence list
         */
        parseInputProductStructureFromOccList() {
            if( this.inputPS.output && this.inputPS.output.length > 0 ) {
                this.inputPS.output.forEach( element => {
                    if( element.occurrenceList && element.occurrenceList.length > 0 ) {
                        let parentUid = element.occurrenceList[ 0 ].parent.bomLine.uid;
                        let occ = this.occsMap.get( parentUid );
                        if( occ === undefined ) {
                            occ = this.getOccurence( parentUid );
                            const indexOfrelatedObjectsInfo = element.occurrenceList[ 0 ].parent.indexOfrelatedObjectsInfo;
                            if( indexOfrelatedObjectsInfo && indexOfrelatedObjectsInfo.length > 0 ) {
                                const relatedObjectIndex = element.occurrenceList[ 0 ].parent.indexOfrelatedObjectsInfo[ 0 ];
                                let relatedObject = this.inputPS.relatedObjects[ relatedObjectIndex ];
                                if( relatedObject && relatedObject.namedRefList && relatedObject.namedRefList.length > 0 ) {
                                    if( relatedObject.namedRefList[ 0 ].referenceObject ) {
                                        occ.geomId = relatedObject.namedRefList[ 0 ].referenceObject.uid;
                                    }
                                    let readTicket = relatedObject.namedRefList[ 0 ].fileTicket;
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
                            }
                            this.occsMap.set( parentUid, occ );
                        }

                        for( let i = 0; i < element.occurrenceList.length; i++ ) {
                            for( let j = 0; j < element.occurrenceList[i].occurrenceList.length; j++ ) {
                                let parent = occ;
                                for( let k = 0; k < element.occurrenceList[i].occurrenceList[j].occurrenceChain.length; k++ ) {
                                    if( element.occurrenceList[i].occurrenceList[j].occurrenceChain[k].indexOfrelatedObjectsInfo !== undefined ) {
                                        let index = element.occurrenceList[i].occurrenceList[j].occurrenceChain[k].indexOfrelatedObjectsInfo[ 0 ];
                                        element.occurrenceList[i].occurrenceList[j].occurrenceChain[k].relatedObjects =
                                            [ this.inputPS.relatedObjects[ index ] ];
                                    } else{
                                        element.occurrenceList[i].occurrenceList[j].occurrenceChain[k].relatedObjects = [];
                                    }
                                    this.parseChildNode( element.occurrenceList[i].occurrenceList[j].occurrenceChain[k], parent );
                                    parent = this.occsMap.get( element.occurrenceList[i].occurrenceList[j].occurrenceChain[k].bomLine.uid );
                                }
                            }
                        }
                    }
                } );
            }
        }

        /**
         * Parse child node
         * @param {Object} node node
         * @param {Object} parentOcc parent occurence
         */
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
                let relXForm = this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransform.dbValues[ 0 ];
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

                let relXFormOverride = this.inputPS.ServiceData.modelObjects[ uid ].props.fnd0RelativeTransformOverride.dbValues[ 0 ];

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
                if( this.inputPS.extraObjs !== undefined ) {
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
        }

        /**
         * Get node ids
         * @returns {Array} returns node ids
         */
        getNodeIds() {
            return Array.from( this.occsMap.keys() );
        }

        /**
         * Get node CSIDs
         * @param {Array} nodeIds node ids
         * @returns {Map} returns node CSIDs
         */
        getNodeCSIDs( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.id );
            } );
            return returnMap;
        }

        /**
         * Get children
         * @param {Array} nodeIds node ids
         * @returns {Map} returns children
         */
        getChildren( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.childIds );
            } );
            return returnMap;
        }

        /**
         * Get transforms
         * @param {Array} nodeIds node ids
         * @returns {Map} returns transforms
         */
        getTransforms( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.xform );
            } );
            return returnMap;
        }

        /**
         * Get transform overrides
         * @param {Array} nodeIds node ids
         * @returns {Map} returns transform overrides
         */
        getTransformOverrides( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, { xformOverrideLevel: val.xformOverrideLevel, xformOverride: val.xformOverride } );
            } );
            return returnMap;
        }

        /**
         * Get JT file tickets
         * @param {Array} nodeIds node ids
         * @returns {Map} returns JT file tickets
         */
        getJTFileTickets( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.uri );
            } );
            return returnMap;
        }

        /**
         * Get display names
         * @param {Array} nodeIds node ids
         * @returns {Map} returns display names
         */
        getDisplayNames( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.name );
            } );
            return returnMap;
        }

        /**
         * Get flags
         * @param {Array} nodeIds node ids
         * @param {String} flag flag
         * @returns {Map} returns flags
         */
        getFlags( nodeIds, flag ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val[ flag ] );
            } );
            return returnMap;
        }

        /**
         * Get has children
         * @param {Array} nodeIds node ids
         * @returns {Map} returns has children
         */
        getHasChildren( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.hasChildren );
            } );
            return returnMap;
        }

        /**
         * Get geometry IDs
         * @param {Array} nodeIds node ids
         * @returns {Map} returns geometry IDs
         */
        getGeometryIDs( nodeIds ) {
            const returnMap = new Map();
            const filteredOccsMap = this.getFilteredEntriesFromOccsMap( nodeIds );
            filteredOccsMap.forEach( ( val, key ) => {
                returnMap.set( key, val.geomId );
            } );
            return returnMap;
        }

        /**
         * Is final response
         * @returns {Boolean} returns boolean indicating if this is a final response
         */
        isFinalResponse() {
            return this.isFinalResponseVar;
        }

        /**
         * Get number of lines loaded
         * @returns {Object} returns number of lines loaded
         */
        getNumLinesLoaded() {
            return this.numLinesLoaded;
        }

        /**
         * Get number of lines remaining
         * @returns {Object} returns number of lines remaining
         */
        getNumLinesRemaining() {
            return this.numLinesRemaining;
        }

        /**
         * Get filtered entries from occs map
         * @param {Array} nodeIds node ids
         * @returns {Map} returns filtered entries from occs map
         */
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
        const cadPageExpandResultFromOccList = getCadPageExpandResultFromOccListInstance( inputPS, uidToCsidChainMap, baseURL, topLineUid, isFinalResponse, numLinesLoaded, numLinesRemaining );
        cadPageExpandResultFromOccList.parseInputProductStructureFromOccList();
        return cadPageExpandResultFromOccList;
    }
    return null;
};

/**
 * Get PVW product structure from Occurence list worker
 * @returns {Object} returns shared worker
 */
export const getPVWProductStructureFromOccListWorker = () => {
    let code = processProductStructureFromOccList.toString();
    code = 'onconnect' + code.substring( code.indexOf( '=', parseInt( code.indexOf( '=' ) + 1 ) ) );
    code = code.substring( code.indexOf( 'onconnect' ), code.lastIndexOf( 'if' ) );
    const blob = new Blob( [ code ], { type: 'text/javascript' } );
    return new SharedWorker( URL.createObjectURL( blob ) );
};

export default {
    processProductStructureFromOccList,
    getPVWProductStructureFromOccListWorker
};
