// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0SignoffCellContentService
 */
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';

/**
 * Define public API
 */
var exports = {};

var _RESOURCEPOOL_GROUP_DCP = 'REF(resource_pool,ResourcePool).group';
var _GROUPMEMBER_USER_DCP = 'REF(group_member,GroupMember).user';


/**
 * Get the model object that need to be render so that correct icon will be shown
 *
 * @param {Object} objectToRender Signoff vmo object
 * @return {Object} node
 */
var _getModelObject = function( objectToRender ) {
    var modelObject = objectToRender;
    // Check if input object is of type resource pool then show the resource pool icon
    // and if it's of type user then show the user icon
    if( modelObject ) {
        if( modelObject.props[ _RESOURCEPOOL_GROUP_DCP ] &&
            modelObject.props[ _RESOURCEPOOL_GROUP_DCP ].dbValues &&
            modelObject.props[ _RESOURCEPOOL_GROUP_DCP ].dbValues[ 0 ] ) {
            var resourcePoolObject = cdm.getObject( modelObject.props.resource_pool.dbValues[ 0 ] );
            if( resourcePoolObject ) {
                modelObject = resourcePoolObject;
            }
        } else if( modelObject.props[ _GROUPMEMBER_USER_DCP ] &&
            modelObject.props[ _GROUPMEMBER_USER_DCP ].dbValues &&
            modelObject.props[ _GROUPMEMBER_USER_DCP ].dbValues[ 0 ] ) {
            var groupMemberObject = cdm
                .getObject( modelObject.props[ _GROUPMEMBER_USER_DCP ].dbValues[ 0 ] );
            if( groupMemberObject ) {
                modelObject = groupMemberObject;
            }
        }
    }
    return modelObject;
};

/**
 * Popuate the signoff icon and thumbnail based on if it's group member signoff or
 * resource pool signoff.
 *
 * @param {Object} vmo Singoff VMO object whose icon need to be set
 */
export let populateSignoffData = function( vmo ) {
    var modelObject = _getModelObject( vmo );
    // Create the assignee VMO object and set it on VMO and it will be used for rendering the icon
    // For group memebre, person icon will be rendered and for ersource pool , resource pool icon will be rendered
    if( modelObject && modelObject.uid ) {
        var vmoObject = viewModelObjectService.createViewModelObject( modelObject.uid );
        vmo.assigneeVMO = vmoObject;
    }
};

/**
 * Return the set properties input for signoff decision
 * @param {Object} vmo Singoff VMO object whose properties need to be modified
 *
 * @returns {Array} Object array for signoff along with property and value to be saved
 */
export let setPropertiesInputForSignoffDecision = function( vmo ) {
    var propValue = null;
    if( vmo && vmo.props && vmo.props.fnd0DecisionRequired &&
        vmo.props.fnd0DecisionRequired.dbValues ) {
        var requiredSignoff = vmo.props.fnd0DecisionRequired.dbValues[ 0 ];
        // Check if proeprty value is not null and value is required modifiable already
        // then we need to set it as optional else we need to set as require modifiable
        if( requiredSignoff && requiredSignoff === 'RequiredModifiable' ) {
            propValue = 'Optional';
        } else {
            propValue = 'RequiredModifiable';
        }
    }
    // Check if propValue object is null that means some value is invalid so return empty array from here
    if( !propValue ) {
        return [ {} ];
    }

    return [ {
        object: vmo,
        vecNameVal: [ {
            name: 'fnd0DecisionRequired',
            values: [ propValue ]
        } ]
    } ];
};

/**
 * Update the decision needed property from input VMO object.
 *
 * @param {Object} propObject Decision required property object
 * @param {Obejct} vmo Signoff object for decision property need to be updated
 *
 * @returns {Object} Updated decision needed property object
 */
export let updateDecisionPropObject = function( propObject, vmo ) {
    const decisionProp = { ...propObject };
    if( vmo && vmo.props && vmo.props.fnd0DecisionRequired && vmo.props.fnd0DecisionRequired.dbValue
        && vmo.props.fnd0DecisionRequired.uiValue ) {
        decisionProp.dbValue = vmo.props.fnd0DecisionRequired.dbValue;
        decisionProp.uiValue = vmo.props.fnd0DecisionRequired.uiValue;
    }
    return decisionProp;
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0SignoffCellContentService
 */

export default exports = {
    populateSignoffData,
    setPropertiesInputForSignoffDecision,
    updateDecisionPropObject
};
