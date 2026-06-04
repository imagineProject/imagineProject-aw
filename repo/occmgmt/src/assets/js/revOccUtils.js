// Copyright (c) 2022 Siemens

/**
 * @module js/revOccUtils
 */
import appCtxService from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import aceTreeTableDataService from 'js/aceTreeTableDataService';

/* This function will return part and usages from selection
 * @return {Object} array of change input
*/
export const getPartAndUsageListFromSelection = function() {
    const changeInput = [];
    const selectedObjects = appCtxService.ctx.mselected;
    _.forEach( selectedObjects, function( selectedObject ) {
        const awb0Archetype = selectedObject.props.awb0Archetype;
        if ( awb0Archetype && awb0Archetype.dbValues.length > 0 && awb0Archetype.dbValues[0] !== null && awb0Archetype.dbValues[0] !== '' ) {
            const partObject = cdmSvc.getObject( awb0Archetype.dbValues[0] );
            changeInput.push( partObject );
        }

        const usg0UsageOccRev = selectedObject.props.usg0UsageOccRev;
        if ( usg0UsageOccRev && usg0UsageOccRev.dbValues.length > 0 && usg0UsageOccRev.dbValues[0] !== null && usg0UsageOccRev.dbValues[0] !== '' ) {
            const puObject = cdmSvc.getObject( usg0UsageOccRev.dbValues[0] );
            changeInput.push( puObject );
        }
    } );
    return changeInput;
};


const revOccPropertyHandler = {
    key: 'revOccProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        _.forEach( overriddenPropertyPolicy.types, function( type ) {
            var properties = [];
            if( type.name === 'Awb0PositionedElement' ) {
                _.forEach( type.properties, function( property ) {
                    if( property.name !== 'usg0UsageOccRev' ) {
                        properties.push( property );
                    }
                } );
                type.properties = properties;
            }
        } );
    },
    condition: ( occContext ) => {
        if( !_.isUndefined( occContext.supportedFeatures ) && occContext.supportedFeatures.Awb0EnableConfigurationPanelFeature &&
        !occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature ) { return true; }
        return false;
    }
};

const activeChangePropHandler = {
    key: 'activeChangeProperty',
    callbackFunction: ( overriddenPropertyPolicy ) => {
        // Check if cm1ActiveChange/cm1ActiveChangeForOccRev are already added to overriddenPropertyPolicy
        // This check is required as aceTreeTableDataService.updateOverriddenPropertyPolicy does not check
        // if the properties already exist in policy and adds them multiple times.
        let activeChangeProps = [];
        if ( overriddenPropertyPolicy.types ) {
            let typeIndex = overriddenPropertyPolicy.types.findIndex( type => type.name === 'Awb0PartElement' );
            if( typeIndex !== -1 && overriddenPropertyPolicy.types[typeIndex].properties ) {
                if ( overriddenPropertyPolicy.types[typeIndex].properties.findIndex( property => property.name === 'cm1ActiveChange' ) === -1 ) {
                    activeChangeProps.push( { name: 'cm1ActiveChange' } );
                }
                if ( overriddenPropertyPolicy.types[typeIndex].properties.findIndex( property => property.name === 'cm1ActiveChangeForOccRev' ) === -1 ) {
                    activeChangeProps.push( { name: 'cm1ActiveChangeForOccRev' } );
                }
            }
        }
        if ( activeChangeProps.length > 0 ) {
            aceTreeTableDataService.updateOverriddenPropertyPolicy( overriddenPropertyPolicy, 'Awb0PartElement', activeChangeProps );
        }
    },
    condition: () => {
        // These properties are not intended to be added in policy for performance environment.
        // Thus they are guarded with EBOM_PREF_INTERNAL preference which does not exist.
        // On performance env, this preference will be defined and thus properties will not be registered.
        return appCtxService.ctx.preferences.EnterpriseBOM_feature_installed &&
            appCtxService.ctx.preferences.EnterpriseBOM_feature_installed.length > 0 &&
            appCtxService.ctx.preferences.EnterpriseBOM_feature_installed[0].toUpperCase() === 'TRUE'  &&
            ( _.isNull( appCtxService.ctx.preferences.EBOM_PREF_INTERNAL ) ||
            _.isUndefined( appCtxService.ctx.preferences.EBOM_PREF_INTERNAL ) ||
            appCtxService.ctx.preferences.EBOM_PREF_INTERNAL.length > 0 &&
            appCtxService.ctx.preferences.EBOM_PREF_INTERNAL[0].toUpperCase() === 'FALSE' );
    }
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenProperties = function( ) {
    aceTreeTableDataService.registerOverriddenPropertyPolicyHandler( revOccPropertyHandler );
    aceTreeTableDataService.registerOverriddenPropertyPolicyHandler( activeChangePropHandler );
};

/* This function will return usages from selection
 * @return {Object} array of change input
*/
export const getUsageListFromSelection = function() {
    const changeInput = [];
    const selectedObjects = appCtxService.ctx.mselected;
    _.forEach( selectedObjects, function( selectedObject ) {
        const usg0UsageOccRev = selectedObject.props.usg0UsageOccRev;
        if ( usg0UsageOccRev && usg0UsageOccRev.dbValues.length > 0 && usg0UsageOccRev.dbValues[0] !== null && usg0UsageOccRev.dbValues[0] !== '' ) {
            const puObject = cdmSvc.getObject( usg0UsageOccRev.dbValues[0] );
            changeInput.push( puObject );
        }
    } );
    return changeInput;
};


const exports = {
    getPartAndUsageListFromSelection,
    registerHandlerForOverriddenProperties,
    getUsageListFromSelection
};

export default exports;
