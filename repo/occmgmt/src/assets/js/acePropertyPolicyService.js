// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE
 *
 * @module js/acePropertyPolicyService
 */
import occmgmtUtils from 'js/occmgmtUtils';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import showMarkupServc from 'js/showMarkupService';
import revOccSvc from 'js/revOccUtils';
import ptnConfigSvc from 'js/partitionConfigurationService';
import secondaryComponentSvc from 'js/aceSecondaryComponentService';

let exports = {};
let policyId;

/**
 * Register property policy
 */
export let registerPropertyPolicy = function() {
    let policyIOverrideGetOcc = {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [ {
                name: 'awb0QuantityManaged'
            } ]
        } ]
    };
    policyId = propPolicySvc.register( policyIOverrideGetOcc );
    //TODO: Need to clean up this code once there is a framework to add the dependent js files based on installed modules.
    showMarkupServc.registerHandlerForOverriddenProperties();
    revOccSvc.registerHandlerForOverriddenProperties();
    ptnConfigSvc.registerHandlerForOverriddenProperties();
    secondaryComponentSvc.registerHandlerForOverriddenProperties();
};

/**
 * Un-Register property policy
 */
export let unRegisterPropertyPolicy = function() {
    if( policyId ) {
        propPolicySvc.unregister( policyId );
        policyId = null;
    }
};

/**
 * Remove specified properties for the given Type from the Property Policy
 * @param {Object} overriddenPropertyPolicy The Property Policy Object.
 * @param {String} typeToModify The type name from whose policy properties are to be removed.
 * @param {Set} propertiesToRemove A set of property names to be removed from the Property Policy.
 * @returns {Object} The updated Property Policy Object.
 */
export let removeFromOverriddenPropertyPolicy = function( overriddenPropertyPolicy, typeToModify, propertiesToRemove ) {
    for( let inx = 0; inx < overriddenPropertyPolicy.types.length; inx++ ) {
        let type = overriddenPropertyPolicy.types[inx];
        if( type.name === typeToModify ) {
            // Filter out the properties that are in the propsToRemove set
            type.properties = type.properties.filter( prop => !propertiesToRemove.has( prop.name ) );
        }
    }
    overriddenPropertyPolicy.override = true;

    return overriddenPropertyPolicy;
};

/**
 * Occurrence Management Service Manager
 */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy,
    removeFromOverriddenPropertyPolicy
};
