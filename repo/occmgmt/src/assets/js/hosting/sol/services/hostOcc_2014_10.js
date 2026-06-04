// Copyright (c) 2022 Siemens

/**
 * @module js/hosting/sol/services/hostOcc_2014_10
 * @namespace hostOcc_2014_10
 */
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import csidConverterSvc from 'js/aceCsidsToObjectsConverterService';
import objectToCSIDGeneratorSvc from 'js/aceObjectToCSIDGeneratorService';
import occmgmtUtils from 'js/occmgmtUtils';
import hostBaseRefSvc from 'js/hosting/hostBaseRefService';
import hostBaseSelSvc from 'js/hosting/hostBaseSelService';
import hostConfigSvc from 'js/hosting/hostConfigService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import dms from 'soa/dataManagementService';
import prefSvc from 'soa/preferenceService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import hostConfigKeys from 'js/hosting/hostConst_ConfigKeys';
import cadBomOccurrenceAlignmentSvc from 'js/CadBomOccurrenceAlignmentService';

/**
 * {Number} The time (in MS since unix epoch) that the most recent selection event from the host.
 */
var _selectionTimeLast = 0;

/**
 * {Boolean} TRUE if a missing 'maxObj' warning has already been reported.
 */
var _maxObjMissingReported = false;

/**
 * Walk the parent heirarchy of the given {IModelObject} to determine its clone stable ID path.
 *
 * @param {IModelObject} modelObject - ...
 *
 * @returns {StringArray} Array of parent UIDs.
 */
var _getCloneStableIDPath = function( modelObject ) {
    if( cmm.isInstanceOf( OccConstants.AWB_0_OCCURRENCE_OBJECT, modelObject.modelType ) ) {
        return [];
    }

    var pathString = objectToCSIDGeneratorSvc.getCloneStableIdChain( modelObject );

    return pathString.split( '/' );
};

/**
 * Trim collection of ID (if necessary)
 *
 * @param {StringArray} csidChainsOfElementsToFocusOn - List of CSIDs
 * @param {Integer} maxObj - Maximum number that is permissible for processing
 *
 * @return {StringArray} Sublist of the list sent in with not more than permissible number of elements
 */
var _getCSIDsToProcessBasedOnPermissibleSize = function( csidChainsOfElementsToFocusOn, maxObj ) {
    var trimmedListOfCSIDsToBeProcessed = csidChainsOfElementsToFocusOn;

    if( csidChainsOfElementsToFocusOn.length > maxObj ) {
        trimmedListOfCSIDsToBeProcessed = _.slice( csidChainsOfElementsToFocusOn, 0, maxObj );

        localeSvc.getTextPromise( 'OccurrenceManagementMessages' ).then( function( textBundle ) {
            if( textBundle.maximumNumberOfSelectionsToProcessExceeded ) {
                msgSvc.showError( msgSvc.applyMessageParamsForDND( textBundle.maximumNumberOfSelectionsToProcessExceeded,
                    [ maxObj ] ) );
            }
        } );
    }

    return trimmedListOfCSIDsToBeProcessed;
};

/**
 * Process the SOA response to extract and locate the selected client-side objects and publish
 * 'hosting.changeSelection' with them.
 *
 * @param {Object} response - Response object from 'doPerformSearchForProvidedCSIDChains'.
 */
var _getConvertCSIDsToElementsInAceCallback = function( response ) {
    if( !_.isEmpty( response.elementsInfo ) ) {
        let selectedElements = [];
        let visibleElements = [];
        let currentSelections = appCtxSvc.getCtx( 'mselected' );

        _.forEach( response.elementsInfo, function( elementInfo ) {
            visibleElements.push( elementInfo.visibleElement );

            let existInCurrentSelection = false;

            if( elementInfo.element ) {
                //Check if object exist in the current selection or not.
                _.forEach( currentSelections, function( selection ) {
                    if( _.isEqual( selection.uid, elementInfo.element.uid ) ) {
                        existInCurrentSelection = true;
                    }
                } );
                //Add new selection at the end of the array and existing selection at the start.
                //This is needed to correctly pass the not yet selected object as an focusElement for the getOccurrence SOA
                if( existInCurrentSelection ) {
                    selectedElements.unshift( elementInfo.element );
                } else {
                    selectedElements.push( elementInfo.element );
                }
            }
        } );

        // NOTE: In hosts where AppSession is opened, we can be in a situation where a user in host application selects the Product with in the AppSession.
        // In this case the selection sync query from host will not contain any CSID, as the product in AppSession acts as a root node and does not have a
        // CSID associated with that. In such a case it is safe to fall selection back to rootElement in the AW client.
        if( selectedElements.length === 1 && selectedElements[0].uid === 'AAAAAAAAAAAAAA' ) {
            selectedElements[0] = appCtxSvc.getCtx( 'aceActiveContext.context.rootElement' );
        }

        eventBus.publish( 'hosting.changeSelection', {
            operation: 'replace',
            objectsToSelect: selectedElements,
            objectsToHighlight: visibleElements,
            viewkey: appCtxSvc.ctx.aceActiveContext.key
        } );
    }
};

/**
 * Call performSearch to get Awb0Element from csid and sent SOA response for processing
 *
 * @param {StringArray} csidChainsOfElementsToFocusOn - csidChains of the selection
 * @param {Number} selectionTime - Time the selection arrived from the host.
 * @param {boolean} [addVisibleElement=true] - A flag indicating whether to include visible elements in the search results.
 */
var _getElementFromCsidForSelection = function( csidChainsOfElementsToFocusOn, selectionTime, addVisibleElement = true ) {
    if( csidChainsOfElementsToFocusOn.length === 1 ) {
        csidConverterSvc.doPerformSearchForProvidedCSIDChains( csidChainsOfElementsToFocusOn, addVisibleElement.toString() ).then(
            function( response ) {
                /**
                 * Check if we are still processing the most recent selection.
                 */
                if( selectionTime === _selectionTimeLast ) {
                    _getConvertCSIDsToElementsInAceCallback( response );
                }
            } );
    } else {
        prefSvc.getStringValue( 'AWC_MaxNumberOfSelectionsToProcess' ).then(
            function( maxObj ) {
                /**
                 * Check if there is no valid value returned.
                 */
                if( !maxObj || maxObj < 0 ) {
                    if( !_maxObjMissingReported ) {
                        _maxObjMissingReported = true;

                        logger.error( 'OccSelectionTypeHandler: processObjects: ' +
                            'Failed to retrieve preference "AWC_MaxNumberOfSelectionsToProcess".' + '\n' +
                            'Using default=' + OccConstants.DEFAULT_MAX_NUMBER_OBJECTS_TO_BE_PROCESSED );
                    }

                    maxObj = OccConstants.DEFAULT_MAX_NUMBER_OBJECTS_TO_BE_PROCESSED;
                }

                var trimmedList = _getCSIDsToProcessBasedOnPermissibleSize(
                    csidChainsOfElementsToFocusOn, maxObj );

                csidConverterSvc.doPerformSearchForProvidedCSIDChains( trimmedList, addVisibleElement.toString() ).then(
                    function( response ) {
                        /**
                         * Check if we are still processing the most recent selection.
                         */
                        if( selectionTime === _selectionTimeLast ) {
                            _getConvertCSIDsToElementsInAceCallback( response );
                        }
                    } );
            },
            function( error ) {
                logger.error( 'OccSelectionTypeHandler: processObjects: ' +
                    'Failed to retrieve preference "AWC_MaxNumberOfSelectionsToProcess".' + '\n' +
                    'Using default=' + OccConstants.DEFAULT_MAX_NUMBER_OBJECTS_TO_BE_PROCESSED + '\n' +
                    'error=' + error );

                //Failed to retrieve preference AWC_MaxNumberOfSelectionsToProcess, then proceed
                //with default value provided.
                var trimmedList = _getCSIDsToProcessBasedOnPermissibleSize(
                    csidChainsOfElementsToFocusOn, OccConstants.DEFAULT_MAX_NUMBER_OBJECTS_TO_BE_PROCESSED );

                csidConverterSvc.doPerformSearchForProvidedCSIDChains( trimmedList, addVisibleElement.toString() ).then(
                    function( response ) {
                        /**
                         * Check if we are still processing the most recent selection.
                         */
                        if( selectionTime === _selectionTimeLast ) {
                            _getConvertCSIDsToElementsInAceCallback( response );
                        }
                    } );
            } );
    }
};

/**
 * Publish update selection event to update selection in hosted AW
 * @param {IModelObject} productObjRef - Product
 * @param {StringArray} encodedObjs - Array of JSON encoded object references.
 * @param {ISelectionObjectParser} parser - API used to convert an object string into {ParsedSelectionObject}
 * @param {Number} selectionTime - Time the selection arrived from the host.
 * @param {Boolean} isAlinedOccExist - Is true then it will look for the aligned part ocurrences
 */
var updateSelection = function( productObjRef, encodedObjs, parser, selectionTime, isAlinedOccExist ) {
    /**
     * Check if the product from the 'host' selection is currently loaded.
     * <P>
     * If so: Continue processing this selection.
     */
    var productModelObj = cdm.getObject( productObjRef.ObjId );

    if( productModelObj ) {
        var loadStartTime2 = selectionTime;

        var csidChainsOfElementsToFocusOn = [];

        _.forEach( encodedObjs, function( encodedObj ) {
            var occSelection = parser.parse( encodedObj );

            /**
             * Note: The 'Host' sends the path BOTTOM-UP. The 'csidConverterSvc' needs it TOP-DOWN.
             * Flip it here.
             * <P>
             * Client->Host TOP-DOWN
             * <P>
             * Host->Client: BOTTOM-UP (Legacy)
             * <P>
             * Host->Client: TOP-DOWN (HostCloneStableIdPathTopDown === true)
             */
            var cloneStableIdPath = occSelection.getValue(
                OccConstants.CLONE_STABLE_ID_PATH );

            var topDownCloneStableIdPath = '';

            if( appCtxSvc.ctx.aw_hosting_config.HostCloneStableIdPathTopDown ) {
                _.forEach( cloneStableIdPath, function( csId ) {
                    if( topDownCloneStableIdPath.length > 0 ) {
                        topDownCloneStableIdPath += '/';
                    }

                    topDownCloneStableIdPath += csId;
                } );
            } else {
                for( var ndx = cloneStableIdPath.length - 1; ndx >= 0; ndx-- ) {
                    var csId = cloneStableIdPath[ ndx ];

                    if( topDownCloneStableIdPath.length > 0 ) {
                        topDownCloneStableIdPath += '/';
                    }

                    topDownCloneStableIdPath += csId;
                }
            }

            csidChainsOfElementsToFocusOn.push( topDownCloneStableIdPath );
        } );

        //If isAlinedOccExist is true then check if alignOcc found from the server,
        //if not then return from here as input product is not the active product also there is not active aligned EBOM Product found
        if( isAlinedOccExist ) {
            var alignedOccResponse = cadBomOccurrenceAlignmentSvc.getAlignedPartOccurrenceCsidChain( csidChainsOfElementsToFocusOn );
            alignedOccResponse.then( function( response ) {
                if( !_.isEmpty( response.alignedOccCsidPaths ) ) {
                    csidChainsOfElementsToFocusOn = response.alignedOccCsidPaths;
                    // LCS-1195396 ->Cross probe is not working from Summarized line from Nx vis to Hosted AW
                    // isAlinedOccExist then addVisibleElement should be false as the Summary or quantity Managed line should be selected
                    _getElementFromCsidForSelection( csidChainsOfElementsToFocusOn, loadStartTime2, false );
                } else {
                    return false;
                }
            } );
        } else {
            _getElementFromCsidForSelection( csidChainsOfElementsToFocusOn, loadStartTime2, true );
        }

        /**
         * Exit the outer 'forEach' since all of the same 'objects' were just processed above. The
         * selection will be complete when their promises are resulved.
         */
        return false;
    }
};

/**
 * Convenience constants.
 */
var OccConstants = {
    /** awb0Element */
    AWB_0_ELEMENT: 'Awb0Element',
    /** AWB_0_OCCURRENCE_OBJECT (used as key in {OccSelectionObject} props) */
    AWB_0_OCCURRENCE_OBJECT: 'awb0OccurrenceObject',
    /** Clone Stable Path */
    CLONE_STABLE_ID_PATH: 'cloneStableIdPath',
    /** Product Context Info */
    PRODUCT_CONTEXT_INFO: 'ProductContextInfo',
    /** Product Context */
    PRODUCT_CONTEXT: 'productContext',
    /** Product (used as key in {OccSelectionObject} props) */
    PRODUCT: 'product',
    /**
     * The default value defining the number of objects to be processed if we are not able to fetch the
     * AWC_MaxNumberOfSelectionsToProcess preference.
     */
    DEFAULT_MAX_NUMBER_OBJECTS_TO_BE_PROCESSED: 200
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccInteropObjectRefEncoder
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create new instance of an {IInteropObjectTypeFactory} used to encode simple {IModelObject}s into
 * {InteropObjectRef} (2014_10).
 *
 * @constructor
 * @memberof hostOcc_2014_10
 * @extends  hostBaseRefService.BaseInteropObjectRefEncoder
 */
var OccInteropObjectRefEncoder = function() {
    hostBaseRefSvc.getBaseObjectRefEncoder().call( this );
};

OccInteropObjectRefEncoder.prototype = hostBaseRefSvc.extendBaseObjectRefEncoder();

/**
 * Create an empty IInteropEncodedObject (with no properties set).
 *
 * @return {IInteropEncodedObject} Newly created object.
 */
OccInteropObjectRefEncoder.prototype.createEmptyEncodedObject = function() {
    return exports.createEncodedObject();
};

/**
 * Check if this IInteropObjectRefEncoder supports the given object.
 *
 * @function isObjectSupported
 * @memberof hostOcc_2014_10.OccInteropObjectRefEncoder
 *
 * @param {Object} object - Object to check (e.g. An IModelObject).
 *
 * @return {Boolran} true if supported.
 */
OccInteropObjectRefEncoder.prototype.isObjectSupported = function( object ) {
    if( object.modelType && cmm.isInstanceOf( OccConstants.AWB_0_ELEMENT, object.modelType ) ) {
        /**
         * Check if we want to use a later version AND this is an awb0Element.
         */
        if( hostConfigSvc.getOption( hostConfigKeys.USE_2015_10_OCC_SELECTION_OBJECT ) ) {
            return false;
        }

        return true;
    }

    return false;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccInteropObjectRefEncoder -> OccInteropEncodedObject
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Interface representing an encoded interop object. Encoders can set properties on it and convert it into
 * an interop obect.
 *
 * @constructor
 * @memberof hostOcc_2014_10
 * @extends  hostBaseRefService.BaseInteropEncodedObject
 */
var OccInteropEncodedObject = function() {
    hostBaseRefSvc.getBaseEncodedObject().call( this );

    /**
     * {IModelObject} Product
     */
    this._product;

    /**
     * {IModelObject} Awb0 occurrence object
     *
     * @private
     */
    this._occObject;

    /**
     * {IModelObject} Awb0 occurrence object
     *
     * @private
     */
    this._cloneStableIdPath = [];
};

OccInteropEncodedObject.prototype = hostBaseRefSvc.extendBaseEncodedObject();

/**
 * Set property value.
 *
 * @function setProperty
 * @memberof hostOcc_2014_10.OccInteropEncodedObject
 *
 * @param {String} propName - Name of the property to set.
 * @param {Object} propValue - Value to set.
 */
OccInteropEncodedObject.prototype.setProperty = function( propName, propValue ) {
    if( propName === OccConstants.PRODUCT && cdm.isModelObject( propValue ) ) {
        this._product = propValue;
    } else if( propName === OccConstants.AWB_0_OCCURRENCE_OBJECT && cdm.isModelObject( propValue ) ) {
        this._occObject = propValue;
    } else if( propName === OccConstants.CLONE_STABLE_ID_PATH ) {
        if( _.isString( propValue ) ) {
            propValue = propValue.split( '/' );
        }

        if( _.isArray( propValue ) ) {
            var self = this;
            _.forEach( propValue, function( obj ) {
                if( obj && _.isString( obj ) ) {
                    self._cloneStableIdPath.push( obj );
                }
            } );
        }
    }
};

/**
 * Get property value.
 *
 * @function getData
 * @memberof hostOcc_2014_10.OccInteropEncodedObject
 *
 * @returns {String} JSON representation of the dataObject.
 */
OccInteropEncodedObject.prototype.getData = function() {
    return JSON.stringify( this.getDataObject() );
};

/**
 * Get property value.
 *
 * @function getDataObject
 * @memberof hostOcc_2014_10.OccInteropEncodedObject
 *
 * @returns {OccNativeSelection} New instance of a {OccNativeSelection} (version 2014_02) based on this
 * object. encoded ref.
 */
OccInteropEncodedObject.prototype.getDataObject = function() {
    var product = null;
    var occObj = null;

    if( this._product ) {
        product = hostBaseRefSvc.createBasicObjectRef( '', this._product.uid, this._product.type );
    } else {
        product = hostBaseRefSvc.createBasicObjectRef();
    }

    if( this._occObject ) {
        occObj = hostBaseRefSvc.createBasicObjectRef( '', this._occObject.uid, this._occObject.type );
    } else {
        occObj = hostBaseRefSvc.createBasicObjectRef();
    }

    var occSelection = exports.createOccNativeSelection();

    occSelection.setAwbOccurrenceObject( occObj );
    occSelection.setProductObject( product );
    occSelection.setCloneStableIdThreadPath( this._cloneStableIdPath );

    return occSelection;
};

/**
 * Get property value.
 *
 * @function getType
 * @memberof hostOcc_2014_10.OccInteropEncodedObject
 *
 * @returns {String} The type of encoded ref.
 */
OccInteropEncodedObject.prototype.getType = function() {
    return hostBaseRefSvc.OCCURRENCE_TYPE;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccSelectionParser (2014_02)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Selection type handler for uid selections
 *
 * @constructor
 * @memberof hostOcc_2014_10
 */
var OccSelectionParser = function() {
    hostBaseSelSvc.getBaseSelectionObjectParser().call( this );
};

OccSelectionParser.prototype = hostBaseSelSvc.extendBaseSelectionObjectParser();

/**
 * See prototype.
 *
 * @function parse
 * @memberof hostOcc_2014_10.OccSelectionParser
 *
 * @param {String} jsonData - see prototype.
 *
 * @returns {ParsedSelectionObject} A new instance populated from given input.
 */
OccSelectionParser.prototype.parse = function( jsonData ) {
    var occNative = exports.createOccNativeSelection( jsonData );

    return exports.createOccSelectionObject( occNative );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccSelectionParser -> OccSelectionObject (2014_02)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create a new instance of this class.
 *
 * @constructor
 *
 * @param {OccNativeSelection} occSelection - Object to base new object on.
 */
var OccSelectionObject = function( occSelection ) {
    hostBaseSelSvc.getParsedSelectionObject().call( this );

    if( occSelection ) {
        this.setValue( OccConstants.PRODUCT, occSelection.getProductObject() );
        this.setValue( OccConstants.CLONE_STABLE_ID_PATH, occSelection.getCloneStableIdThreadPath() );
        this.setValue( OccConstants.AWB_0_OCCURRENCE_OBJECT, occSelection.getAwbOccurrenceObject() );
    }
};

OccSelectionObject.prototype = hostBaseSelSvc.extendParsedSelectionObject();

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccInteropObjectTypeFactory
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create new instance of an {IInteropObjectTypeFactory} used to encode simple IModelObjects into
 * {InteropObjectRef} (2014_10).
 *
 * @constructor
 * @memberof hostOcc_2014_10
 * @extends  hostBaseRefService.IInteropObjectTypeFactory
 */
var OccInteropObjectTypeFactory = function() {
    hostBaseRefSvc.getBaseObjectTypeFactory().call( this );
};

OccInteropObjectTypeFactory.prototype = hostBaseRefSvc.extendBaseObjectTypeFactory();

/**
 * Given a model object and an encoder generates a list of InteropObjectRef from the model object.
 *
 * @function createInteropObjectRef
 * @memberof hostOcc_2014_10.OccInteropObjectTypeFactory
 *
 * @param {IModelObject} modelObject - Model object to create interop object reference from
 * @param {IInteropObjectRefEncoder} objEncoder - The object ref encoder to use.
 *
 * @return {InteropObjectRefArray} Array of interop object refs.
 */
OccInteropObjectTypeFactory.prototype.createInteropObjectRef = function( modelObject, objEncoder ) {
    var interopObjects = [];
    var occMgmtCtx = appCtxSvc.getCtx( appCtxSvc.ctx.aceActiveContext.key );
    if( occMgmtCtx && occMgmtCtx.productContextInfo && occMgmtCtx.productContextInfo.props ) {
        var encodedObject = objEncoder.createEmptyEncodedObject();
        //check if aligned design csid chain is added in appContext
        //That will be added from AW in case EBOM is selected in AW and hostType is NX as NX would have DBOM opened
        var allignedCsidChainMap = appCtxSvc.getCtx( 'aw_aligned_designs_csid_chains' );
        if( !_.isUndefined( allignedCsidChainMap ) && allignedCsidChainMap.size > 0 && !_.isUndefined( allignedCsidChainMap.get( modelObject.uid ) ) ) {
            var alignedDesignCsidChains = allignedCsidChainMap.get( modelObject.uid );
            alignedDesignCsidChains.forEach( function( alignedDesignCsidChainsItr ) {
                var csidPath = alignedDesignCsidChainsItr.split( '/' );
                var encodedObject = objEncoder.createEmptyEncodedObject();
                encodedObject.setProperty( OccConstants.CLONE_STABLE_ID_PATH, csidPath );
                var product = appCtxSvc.getCtx( 'aw_aligned_designs_product' );

                if( product ) {
                    var productModelObj = cdm.getObject( product.uid );
                    encodedObject.setProperty( OccConstants.PRODUCT, productModelObj );
                }
                encodedObject.setProperty( OccConstants.PRODUCT_CONTEXT, occMgmtCtx.productContextInfo );
                encodedObject.setProperty( OccConstants.AWB_0_OCCURRENCE_OBJECT, modelObject );
                interopObjects.push( encodedObject.toInteropObject() );
            } );
            return interopObjects;
        }

        let pci = occmgmtUtils.getProductContextInfoForProvidedObject( modelObject, occMgmtCtx );
        let productContextInfo = cdm.getObject( pci );
        var productProp = productContextInfo.props.awb0Product;
        if( productProp && productProp.dbValues[ 0 ] ) {
            var cloneStableIdPathList = _getCloneStableIDPath( modelObject );
            if( !_.isEmpty( cloneStableIdPathList ) ) {
                encodedObject.setProperty( OccConstants.CLONE_STABLE_ID_PATH, cloneStableIdPathList );
            }
            var productObj = cdm.getObject( productProp.dbValues[ 0 ] );
            if( productObj ) {
                encodedObject.setProperty( OccConstants.PRODUCT, productObj );
            }
            encodedObject.setProperty( OccConstants.AWB_0_OCCURRENCE_OBJECT, modelObject );
        }

        encodedObject.setProperty( OccConstants.PRODUCT_CONTEXT, productContextInfo );
        interopObjects.push( encodedObject.toInteropObject() );
    }

    return interopObjects;
};
/**
 * Does this factory support the given type of object.
 *
 * @function isObjectSupported
 * @memberof hostOcc_2014_10.OccInteropObjectTypeFactory
 *
 * @param {Object} object - Object to check.
 *
 * @return {Boolean} TRUE if supported.
 */
OccInteropObjectTypeFactory.prototype.isObjectSupported = function( object ) {
    return object.modelType && cmm.isInstanceOf( 'Awb0Element', object.modelType );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccNativeSelection (2014_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Javascript object class representing an occurrence selection in the _2014_10 format (i.e. not using
 * 'properties' map).
 *
 * @constructor
 * @memberof hostOcc_2014_10
 *
 * @param {String} jsonData - (Optional) String from the 'host' to use when initializing the message object.
 */
var OccNativeSelection = function( jsonData ) {
    if( jsonData ) {
        _.assign( this, JSON.parse( jsonData ) );
    }

    /**
     * Get current value.
     *
     * @return {StringArray} The occurrence stable id thread path (or NULL).
     */
    this.getCloneStableIdThreadPath = function() {
        return _.get( this, 'OccStableIdThreadPath', null );
    };

    /**
     * Set the clone stable id path for the OccSelection
     *
     * @param {StringArray} stableIdPath - Occurrence stable id thread path
     */
    this.setCloneStableIdThreadPath = function( stableIdPath ) {
        this.OccStableIdThreadPath = stableIdPath;
    };

    /**
     * Get current value.
     *
     * @return {InteropObjectRef} gets the context object containing the occurrence.
     */
    this.getProductObject = function() {
        return _.get( this, 'Product', null );
    };

    /**
     * Set the product for the OccSelection
     *
     * @param {InteropObjectRef} product gets the context object containing the occurrence.
     */
    this.setProductObject = function( product ) {
        this.Product = product;
    };

    /**
     * Get current value.
     *
     * @return {InteropObjectRef} gets the Awb0 occurrence object
     */
    this.getAwbOccurrenceObject = function() {
        return _.get( this, 'Awb0OccurrenceObj', null );
    };

    /**
     * Set the Awb0 occurrence object for the OccSelection
     *
     * @param {InteropObjectRef} occ - The Awb0 occurrence object
     */
    this.setAwbOccurrenceObject = function( occ ) {
        this.Awb0OccurrenceObj = occ;
    };
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccSelectionTypeHandler
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Selection type handler for uid selections
 *
 * @constructor
 * @memberof hostOcc_2014_10
 * @extends  hostBaseSelService.ISelectionTypeHandler
 */
var OccSelectionTypeHandler = function() {
    hostBaseSelSvc.getBaseSelectionTypeHandler().call( this );
};

OccSelectionTypeHandler.prototype = hostBaseSelSvc.extendBaseSelectionTypeHandler();

/**
 * Handle selection based on given object references.
 *
 * @function processObjects
 * @memberof hostOcc_2014_10.OccSelectionTypeHandler
 *
 * @param {StringArray} encodedObjs - Array of JSON encoded object references.
 *
 * @param {ISelectionObjectParser} parser - API used to convert an object string into
 * {ParsedSelectionObject}
 *
 * @param {Number} selectionTime - Time the selection arrived from the host.
 */
OccSelectionTypeHandler.prototype.processObjects = function( encodedObjs, parser, selectionTime ) {
    /**
     * Only process selections when the occurrence management location is open.
     */
    var occMgmtCtx = appCtxSvc.getCtx( 'occmgmtContext' );

    if( !occMgmtCtx ) {
        return;
    }

    _selectionTimeLast = selectionTime;

    /**
     * Note: The OccSelection can either (Case #1) specify the UID of the occurrence **OR** (Case #2)
     * specify the copy stable id path and product of the occurrence.
     * <P>
     * Find the 1st occurance of either and process the entire list using that specified data type.
     */
    _.forEach( encodedObjs, function( encodedObj ) {
        var selectionObj = parser.parse( encodedObj );

        /**
         * Check for Case #1
         */
        var awb0OccObjRef = selectionObj.getValue( OccConstants.AWB_0_OCCURRENCE_OBJECT );

        if( awb0OccObjRef && awb0OccObjRef.ObjId ) {
            var selectedOccUIDs = [];

            _.forEach( encodedObjs, function( encodedObj ) {
                var selectedObject = parser.parse( encodedObj );

                var awb0OccObjRef = selectedObject.getValue( OccConstants.AWB_0_OCCURRENCE_OBJECT );

                if( awb0OccObjRef && awb0OccObjRef.ObjId ) {
                    selectedOccUIDs.push( awb0OccObjRef.ObjId );
                }
            } );

            var loadStartTime1 = selectionTime;

            dms.loadObjects( selectedOccUIDs ).then( function() {
                var selectedUIDs = [];

                /**
                 * Check if we are still processing the most recent selection.
                 */
                if( loadStartTime1 === _selectionTimeLast ) {
                    _.forEach( selectedOccUIDs, function( selectedOccUID ) {
                        // Check if object is in the client cache.
                        var selectedModelObj = cdm.getObject( selectedOccUID );

                        if( selectedModelObj ) {
                            selectedUIDs.push( selectedModelObj.uid );
                        } else {
                            logger.warn( 'OccSelectionTypeHandler: processObjects: ' + 'Unable to locate selected object' + ' ' + 'selectedOccUID=' + selectedOccUID );
                        }
                    } );

                    /**
                     * Announce any 'simple' selections (as opposed to ones requiring the clone stable path)
                     */
                    eventBus.publish( 'hosting.changeSelection', {
                        operation: 'replace',
                        selected: selectedUIDs
                    } );
                }
            } );

            /**
             * Exit the outer 'forEach' since all of the same 'objects' were just processed above. The
             * selection will be complete when their promises are resulved.
             */
            return false;
        }

        /**
         * Check for Case #2
         */
        var productObjRef = selectionObj.getValue( OccConstants.PRODUCT );
        var openedProduct;

        var topElement = appCtxSvc.getCtx( 'aceActiveContext.context.topElement' );

        //InCase of Workset\Subset scenario, TcVis send the Workset as product
        if( topElement && topElement.props.awb0UnderlyingObject ) {
            openedProduct = appCtxSvc.getCtx( 'aceActiveContext.context.topElement.props.awb0UnderlyingObject.dbValues[0]' );
        }

        //For all other use case give preference to active product from active context
        var activeProduct = appCtxSvc.getCtx( 'aceActiveContext.context.productContextInfo.props.awb0Product.dbValues[0]' );

        //Handle selection synchronization if Product passed in inut is either the opened product or active product in  ACE
        //otherwise ignore the selection synchronization request.

        if( productObjRef && (  productObjRef.ObjId === openedProduct  ||  productObjRef.ObjId === activeProduct  ) ) {
            return updateSelection( productObjRef, encodedObjs, parser, selectionTime, false );
        } else if( appCtxSvc.ctx.aw_host_type === 'NX' ) {
            //This might be a case where DBOM is selected in NX and in hosted AW aligned EBOM is opened
            //Check is added to validate if aligned EBOM exist, if yes then the aligned EBOM will be sent for selection in AW
            return updateSelection( productObjRef, encodedObjs, parser, selectionTime, true );
        }

        logger.warn( 'OccSelectionTypeHandler: processObjects: ' +
            'Missing occurance information' + '\n' + JSON.stringify( selectionObj ) );
    } );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Create new {IInteropObjectRefEncoder}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccInteropObjectRefEncoder} New instance.
 */
export let createOccObjectRefEncoder = function() {
    return new OccInteropObjectRefEncoder();
};

/**
 * Return new prototype based on {OccInteropObjectRefEncoder}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccInteropObjectRefEncoder} A new prototype based on the {OccInteropObjectRefEncoder} class.
 */
export let extendOccObjectRefEncoder = function() {
    return Object.create( OccInteropObjectRefEncoder.prototype );
};

/**
 * Return {OccInteropObjectRefEncoder} class constructor function.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {ClassObject} The {OccInteropObjectRefEncoder} class constructor function.
 */
export let getOccObjectRefEncoder = function() {
    return OccInteropObjectRefEncoder;
};

/**
 * Create new {IInteropObjectTypeFactory}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccInteropObjectTypeFactory} New instance.
 */
export let createOccObjectTypeFactory = function() {
    return new OccInteropObjectTypeFactory();
};

/**
 * Create new {OccNativeSelection}.
 *
 * @memberof hostOcc_2014_10
 *
 * @param {String} jsonData - (Optional) String from the 'host' to use when initializing the object.
 *
 * @return {OccNativeSelection} New instance.
 */
export let createOccNativeSelection = function( jsonData ) {
    return new OccNativeSelection( jsonData );
};

/**
 * Create new {OccSelectionObject}.
 *
 * @memberof hostOcc_2014_10
 *
 * @param {OccNativeSelection} occSelection - (Optional) Object to base new object on.
 *
 * @return {OccSelectionObject} New instance.
 */
export let createOccSelectionObject = function( occSelection ) {
    return new OccSelectionObject( occSelection );
};

/**
 * Create new {ISelectionObjectParser}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccSelectionParser} New instance.
 */
export let createOccSelectionParser = function() {
    return new OccSelectionParser();
};

/**
 * Create new {ISelectionTypeHandler}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccSelectionTypeHandler} New instance.
 */
export let createOccSelectionTypeHandler = function() {
    return new OccSelectionTypeHandler();
};

/**
 * Create new {OccInteropEncodedObject}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccInteropEncodedObject} New instance.
 */
export let createEncodedObject = function() {
    return new OccInteropEncodedObject();
};

/**
 * Return new prototype based on {OccInteropEncodedObject}.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {OccInteropEncodedObject} A new prototype based on the {OccInteropEncodedObject} class.
 */
export let extendEncodedObject = function() {
    return Object.create( OccInteropEncodedObject.prototype );
};

/**
 * Return {OccInteropEncodedObject} class constructor function.
 *
 * @memberof hostOcc_2014_10
 *
 * @return {ClassObject} The {OccInteropEncodedObject} class constructor function.
 */
export let getEncodedObject = function() {
    return OccInteropEncodedObject;
};

/**
 * Convenience constants.
 *
 * @memberof hostOcc_2014_10
 */
export { OccConstants as OccConstants };

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostOcc_2014_10
 */
export let registerHostingModule = function() {
    var hostingState = appCtxSvc.ctx.aw_hosting_state;

    /**
     * We want to share the same handler instance for either type of occurrance. So use one if it is there
     * are create the 1st one now.
     */
    var typeHandlerMap = hostingState.map_selection_type_to_handler;

    if( typeHandlerMap[ hostBaseRefSvc.OCCURRENCE2_TYPE ] ) {
        typeHandlerMap[ hostBaseRefSvc.OCCURRENCE_TYPE ] = typeHandlerMap[ hostBaseRefSvc.OCCURRENCE2_TYPE ];
    } else {
        typeHandlerMap[ hostBaseRefSvc.OCCURRENCE_TYPE ] = exports.createOccSelectionTypeHandler();
    }

    hostingState.map_ref_type_to_factory[ hostBaseRefSvc.OCCURRENCE_TYPE ] = exports.createOccObjectTypeFactory();
    hostingState.map_ref_type_to_encoder[ hostBaseRefSvc.OCCURRENCE_TYPE ] = exports.createOccObjectRefEncoder();
    hostingState.map_selection_type_to_parser[ hostBaseRefSvc.OCCURRENCE_TYPE ] = exports.createOccSelectionParser();
};

export default exports = {
    createOccObjectRefEncoder,
    extendOccObjectRefEncoder,
    getOccObjectRefEncoder,
    createOccObjectTypeFactory,
    createOccNativeSelection,
    createOccSelectionObject,
    createOccSelectionParser,
    createOccSelectionTypeHandler,
    createEncodedObject,
    extendEncodedObject,
    getEncodedObject,
    OccConstants,
    registerHostingModule
};
