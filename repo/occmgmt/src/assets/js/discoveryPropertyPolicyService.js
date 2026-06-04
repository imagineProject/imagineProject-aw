// Copyright (c) 2022 Siemens

/**
 * Service to register and unregister additional property policies in ACE for types supported by Structure Discovery.
 *
 * @module js/discoveryPropertyPolicyService
 */

import propPolicySvc from 'soa/kernel/propertyPolicyService';

let exports = {};
let worksetPolicyId;
let indexedPolicyId;
let packedPropertyPolicyId;

/**
  * Register property policy
  */
export let registerPropertyPolicy = function() {
    // Tc14.3 - In case of Workset Revision concurrency logic written on AW SErver expect AW client to provide workset last saved time in SOA input.
    // Hence we are adding workset revision lsd in property policy.
    let worksetLsdProperty = {
        types: [ {
            name: 'Fnd0WorksetRevision',
            properties: [ {
                name: 'lsd'
            } ]
        } ]
    };
    worksetPolicyId = propPolicySvc.register( worksetLsdProperty );

    let discoveryIndexProperty = {
        types: [ {
            name: 'ItemRevision',
            properties: [ {
                name: 'awb0IsDiscoveryIndexed'
            },
            {
                name: 'awb0DiscoveryIndexTime'
            },
            {
                name: 'awb0DiscoveryIndexedSource'
            } ]
        } ]
    };
    indexedPolicyId = propPolicySvc.register( discoveryIndexProperty );
    
    let isPackedProperty = {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [ {
                name: 'awb0IsPacked'
            } ]
        } ]
    };
    packedPropertyPolicyId = propPolicySvc.register( isPackedProperty );
};    

/**
  * Un-Register property policy
  */
export let unRegisterPropertyPolicy = function() {
    if( worksetPolicyId ) {
        propPolicySvc.unregister( worksetPolicyId );
        worksetPolicyId = null;
    }
    if( indexedPolicyId ) {
        propPolicySvc.unregister( indexedPolicyId );
        indexedPolicyId = null;
    }
    if( packedPropertyPolicyId ) {
        propPolicySvc.unregister( packedPropertyPolicyId );
        packedPropertyPolicyId = null;
    }
};

/**
  * Occurrence Management Service Manager
  */

export default exports = {
    registerPropertyPolicy,
    unRegisterPropertyPolicy
};

