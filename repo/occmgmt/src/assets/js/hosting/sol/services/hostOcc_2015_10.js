// Copyright (c) 2022 Siemens

/**
 * @module js/hosting/sol/services/hostOcc_2015_10
 * @namespace hostOcc_2015_10
 */
import appCtxSvc from 'js/appCtxService';
import hostBaseRefSvc from 'js/hosting/hostBaseRefService';
import hostBaseSelSvc from 'js/hosting/hostBaseSelService';
import hostConfigSvc from 'js/hosting/hostConfigService';
import hostOcc1 from 'js/hosting/sol/services/hostOcc_2014_10';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';
import hostConfigKeys from 'js/hosting/hostConst_ConfigKeys';

/**
 * Move into handier variable.
 */
var OccConstants = hostOcc1.OccConstants;

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccInteropObjectRefEncoder (2015_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create new instance of an {IInteropObjectTypeFactory} used to encode simple {IModelObject}s into
 * {InteropObjectRef} (2014_10).
 *
 * @constructor
 * @memberof hostOcc_2015_10
 * @extends  hostBaseRefService.BaseInteropObjectRefEncoder
 */
var OccInteropObjectRefEncoder = function() {
    hostOcc1.getOccObjectRefEncoder().call( this );
};

OccInteropObjectRefEncoder.prototype = hostOcc1.extendOccObjectRefEncoder();

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
 * @memberof hostOcc_2015_10.OccInteropObjectRefEncoder
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
            return true;
        }

        return false;
    }

    return false;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccInteropObjectRefEncoder -> OccInteropEncodedObject (2015_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Interface representing an encoded interop object. Encoders can set properties on it and convert it into
 * an interop obect.
 *
 * @constructor
 * @memberof hostOcc_2015_10
 * @extends  hostBaseRefService.BaseInteropEncodedObject
 */
var OccInteropEncodedObject = function() {
    hostOcc1.getEncodedObject().call( this );
};

OccInteropEncodedObject.prototype = hostOcc1.extendEncodedObject();

/**
 * We want to still call the 'super' so setup to override but remember it.
 */
OccInteropEncodedObject.prototype.setSuperProperty = OccInteropEncodedObject.prototype.setProperty;

/**
 * Set property value.
 *
 * @function setProperty
 * @memberof hostOcc_2015_10.OccInteropEncodedObject
 *
 * @param {String} propName - Name of the property to set.
 * @param {Object} propValue - Value to set.
 */
OccInteropEncodedObject.prototype.setProperty = function( propName, propValue ) {
    if( propName === OccConstants.PRODUCT_CONTEXT && cdm.isModelObject( propValue ) ) {
        this._productContextInfo = propValue;
    } else {
        this.setSuperProperty( propName, propValue );
    }
};

/**
 * Get property value.
 *
 * @function getData
 * @memberof hostOcc_2015_10.OccInteropEncodedObject
 *
 * @returns {String} JSON representation of the dataObject.
 */
OccInteropEncodedObject.prototype.getData = function() {
    var product;
    var occObj;
    var productContextInfo;

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

    if( this._productContextInfo ) {
        productContextInfo = hostBaseRefSvc.createBasicObjectRef( '', this._productContextInfo.uid, this._productContextInfo.type );
    } else {
        productContextInfo = hostBaseRefSvc.createBasicObjectRef();
    }

    var propertyArray = [ {
        Key: OccConstants.PRODUCT,
        Value: JSON.stringify( product )
    },
    {
        Key: OccConstants.PRODUCT_CONTEXT_INFO,
        Value: JSON.stringify( productContextInfo )
    },
    {
        Key: OccConstants.AWB_0_ELEMENT,
        Value: JSON.stringify( occObj )
    }
    ];

    var occSelection = exports.createOccNativeSelection();

    occSelection.setProperties( propertyArray );
    occSelection.setCloneStableIdThreadPath( this._cloneStableIdPath );

    return JSON.stringify( occSelection );
};

/**
 * Get property value.
 *
 * @function getType
 * @memberof hostOcc_2015_10.OccInteropEncodedObject
 *
 * @returns {String} The type of encoded ref.
 */
OccInteropEncodedObject.prototype.getType = function() {
    return hostBaseRefSvc.OCCURRENCE2_TYPE;
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccNativeSelection (2015_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Javascript object class representing an occurrence selection in the _2015_10 format (i.e. using
 * 'properties' map).
 *
 * @constructor
 * @memberof hostOcc_2015_10
 *
 * @param {String} jsonData - (Optional) String from the 'host' to use when initializing the object.
 */
var OccNativeSelection = function( jsonData ) {
    if( jsonData ) {
        _.assign( this, JSON.parse( jsonData ) );
    }

    /**
     * Get current value.
     *
     * @return {PairArray} Selection key/value properties.
     */
    this.getProperties = function() {
        return _.get( this, 'Properties', null );
    };

    /**
     * Set the clone stable id path for the OccSelection
     *
     * @param {PairArray} value - Selection key/value properties.
     */
    this.setProperties = function( value ) {
        this.Properties = value;
    };

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
     * @return {InteropObjectRef} gets the Awb0 occurrence object
     */
    this.getOccuranceObject = function() {
        return _.get( this, 'Awb0OccurrenceObj', null );
    };

    /**
     * Set the Awb0 occurrence object for the OccSelection
     *
     * @param {InteropObjectRef} occ - The Awb0 occurrence object
     */
    this.getOccuranceObject = function( occ ) {
        this.Awb0OccurrenceObj = occ;
    };

    /**
     * Get current value.
     *
     * @return {InteropObjectRef} gets the context object containing the occurrence.
     */
    this.getProduct = function() {
        return _.get( this, 'Product', null );
    };

    /**
     * Set the product for the OccSelection
     *
     * @param {InteropObjectRef} product gets the context object containing the occurrence.
     */
    this.setProduct = function( product ) {
        this.Product = product;
    };
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccSelectionParser (2015_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Selection type handler for uid selections
 *
 * @constructor
 * @memberof hostOcc_2015_10
 */
var OccSelectionParser = function() {
    hostBaseSelSvc.getBaseSelectionObjectParser().call( this );
};

OccSelectionParser.prototype = hostBaseSelSvc.extendBaseSelectionObjectParser();

/**
 * See prototype.
 *
 * @function parse
 * @memberof hostOcc_2015_10.OccSelectionParser
 *
 * @param {String} jsonData - see prototype.
 *
 * @returns {ParsedSelectionObject} A new instance populated from given input.
 */
OccSelectionParser.prototype.parse = function( jsonData ) {
    var occSelection = exports.createOccNativeSelection( jsonData );

    return exports.createOccSelectionObject( occSelection );
};

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// OccSelectionParser -> OccSelectionObject (2015_10)
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

/**
 * Create a new instance of this class.
 *
 * @constructor
 *
 * @param {OccNativeSelection} occSelection - Object to base new object on..
 */
var OccSelectionObject = function( occSelection ) {
    hostBaseSelSvc.getParsedSelectionObject().call( this );

    if( occSelection ) {
        /**
         * Check if we have any properties
         * <P>
         * If so: Then this is a _2015_10 version of this message
         * <P>
         * If not: Then this is a _2014_10 version of this message
         * <P>
         * Note: Since there can be only one ISelectionObjectParser registered per a given object type, this
         * parser needs to handle both 'old' and 'new' message contents.
         */
        var self = this;

        var pairs = occSelection.getProperties();

        if( !_.isEmpty( pairs ) ) {
            _.forEach( pairs, function( pair ) {
                var key = pair.Key;
                var propValue = pair.Value;

                /**
                 * Note: It was seen where the Vis host had used a lower case 'P' in the product name. This
                 * 'temp fix' is to get around that until possibly aw4.x.
                 */
                if( key === OccConstants.PRODUCT || key === 'product' ) {
                    self.setValue( OccConstants.PRODUCT, propValue );
                    //
                } else if( key === OccConstants.PRODUCT_CONTEXT_INFO ) {
                    self.setValue( OccConstants.PRODUCT_CONTEXT, propValue );
                    //
                } else if( key === OccConstants.AWB_0_ELEMENT ) {
                    self.setValue( OccConstants.AWB_0_OCCURRENCE_OBJECT, propValue );
                }
            } );
        } else {
            self.setValue( OccConstants.PRODUCT, occSelection.getProduct() );
            self.setValue( OccConstants.AWB_0_OCCURRENCE_OBJECT, occSelection.getOccuranceObject() );
        }

        var csPath = occSelection.getCloneStableIdThreadPath();

        if( !_.isEmpty( csPath ) ) {
            self.setValue( OccConstants.CLONE_STABLE_ID_PATH, csPath );
        }
    }
};

OccSelectionObject.prototype = hostBaseSelSvc.extendParsedSelectionObject();

// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------
// Public Functions
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

var exports = {};

/**
 * Create new {IInteropObjectRefEncoder}.
 *
 * @memberof hostOcc_2015_10
 *
 * @return {OccInteropObjectRefEncoder} New instance.
 */
export let createOccObjectRefEncoder = function() {
    return new OccInteropObjectRefEncoder();
};

/**
 * Create new {OccNativeSelection}.
 *
 * @memberof hostOcc_2015_10
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
 * @memberof hostOcc_2015_10
 *
 * @param {OccNativeSelection} occSelection - Object to base new object on..
 *
 * @return {OccSelectionObject} New instance.
 */
export let createOccSelectionObject = function( occSelection ) {
    return new OccSelectionObject( occSelection );
};

/**
 * Create new {ISelectionObjectParser}.
 *
 * @memberof hostOcc_2015_10
 *
 * @return {OccSelectionParser} New instance.
 */
export let createOccSelectionParser = function() {
    return new OccSelectionParser();
};

/**
 * Create new {OccInteropEncodedObject}.
 *
 * @memberof hostOcc_2015_10
 *
 * @return {OccInteropEncodedObject} New instance.
 */
export let createEncodedObject = function() {
    return new OccInteropEncodedObject();
};

// ---------------------------------------------------------------------------------

/**
 * Register any client-side (CS) services (or other resources) contributed by this module.
 *
 * @memberof hostOcc_2015_10
 */
export let registerHostingModule = function() {
    var hostingState = appCtxSvc.ctx.aw_hosting_state;

    /**
     * We want to share the same handler instance for either type of occurrance. So use one if it is there
     * are create the 1st one now.
     */
    var typeHandlerMap = hostingState.map_selection_type_to_handler;

    if( typeHandlerMap[ hostBaseRefSvc.OCCURRENCE_TYPE ] ) {
        typeHandlerMap[ hostBaseRefSvc.OCCURRENCE2_TYPE ] = typeHandlerMap[ hostBaseRefSvc.OCCURRENCE_TYPE ];
    } else {
        typeHandlerMap[ hostBaseRefSvc.OCCURRENCE2_TYPE ] = hostOcc1.createOccSelectionTypeHandler();
    }

    hostingState.map_ref_type_to_encoder[ hostBaseRefSvc.OCCURRENCE2_TYPE ] = exports.createOccObjectRefEncoder();
    hostingState.map_selection_type_to_parser[ hostBaseRefSvc.OCCURRENCE2_TYPE ] = exports.createOccSelectionParser();
};

export default exports = {
    createOccObjectRefEncoder,
    createOccNativeSelection,
    createOccSelectionObject,
    createOccSelectionParser,
    createEncodedObject,
    registerHostingModule
};
