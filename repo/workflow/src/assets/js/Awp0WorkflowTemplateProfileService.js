// Copyright (c) 2022 Siemens

/**
 * This implements the template signoff profile functionalities.
 *
 * @module js/Awp0WorkflowTemplateProfileService
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import Awp0WorkflowDesignerUtils from 'js/Awp0WorkflowDesignerUtils';
import _ from 'lodash';
import awp0TasksUtils from 'js/Awp0TasksUtils';

var exports = {};

/**
 * Populate the value and update the widget value with respective value.
 *
 * @param {Object} modelObject Selected Model object
 * @param {String} propName Property name whose value needs to be fetched
 * @param {Object} propDispObject Property widget where value needs to be populated
 * @param {boolean} isBoolean True/False, True will only be for boolean property
 * @param {boolean} isEditable True/False, True when value needs to be in edit or not
 * @param {String} defaultDispValue Default property value
 */
var _populatePropValue = function( modelObject, propName, propDispObject, isBoolean, isEditable, defaultDispValue ) {
    var dbValue = '';
    var uiValue = '';
    if( modelObject && propName && modelObject.props[ propName ] ) {
        var propObject = modelObject.props[ propName ];
        if( propObject && propObject.dbValues && propObject.dbValues[ 0 ] ) {
            dbValue = propObject.dbValues[ 0 ];

            if( isBoolean ) {
                dbValue = dbValue === '1';
            }
        }

        if( propObject && propObject.uiValues && propObject.uiValues[ 0 ] ) {
            uiValue = propObject.uiValues[ 0 ];
        }
        // Check if default display value is not null that means we are trying to populate
        // group and role UI widgets so get the actual modle object based on DB value and set it
        // on the proerpty object.
        if( defaultDispValue ) {
            dbValue = clientDataModel.getObject( dbValue );
        }
        // Check if dbValue is not valid then set the dbValue to * as default value and set the
        // UI value as input default display value
        if( !dbValue ) {
            dbValue = '*';
        }
        if( dbValue === '*' && defaultDispValue ) {
            uiValue = defaultDispValue;
        }
    }
    propDispObject.dbValue = dbValue;
    propDispObject.uiValue = uiValue;
    propDispObject.isEditable = isEditable;
    propDispObject.isEnabled = isEditable;
    propDispObject.parentUid = modelObject.uid;
    propDispObject.propInternalName = propName;
};

/**
 * Populate the panel context info from ctx panel context object and store it in local data object.
 *
 * @param {Object} panelContext Panel context object
 * @param {Object} workflowDgmEditCtx Object that will contain all templates list who are in edit modes.
 * @param {Object} rootTaskTemplateObject Root task template object
 * @returns {Object} Updated context info along with panel data that is needed.
 *
 */
export let populatePanelContextData = function( panelContext, workflowDgmEditCtx, rootTaskTemplateObject ) {
    // Get the tempalte is in edit mode or not and based on that populate the panel.
    var isPanelEditable = Awp0WorkflowDesignerUtils.isTemplateEditMode( rootTaskTemplateObject, workflowDgmEditCtx );
    var panelData = {};
    if( panelContext ) {
        panelData = _.clone( panelContext );
        if( !panelData.profileObject ) {
            panelData.profileObject = panelData.selectedObjects[0];
        }
    }
    // Set this flag so that it can be used in panel so other child component will
    // not be loaded until this flag set to true.
    panelData.isDataInit = true;
    return {
        isPanelEditable : isPanelEditable,
        panelData: panelData
    };
};

/**
 * Populate the profile UI with all values present on profile obejct.
 * @param {Object} data view model Object
 * @param {Object} profileObject Selected profile object from UI.
 * @param {Object} isPanelEditable boolean value to indicate template is in edit mode or not.
 *
 * @returns {Object} Updated UI props that need to be shown on UI.
 */
export let populateProfilePanelData = function( data, profileObject, isPanelEditable ) {
    _populatePropValue( profileObject, 'allow_subgroups', data.allowSubGroupMembers, true, isPanelEditable );
    _populatePropValue( profileObject, 'number_of_signoffs', data.numberOfReviewers, false, isPanelEditable );
    var profileVMOObject = awp0TasksUtils.getSignoffProfileObject( profileObject );
    return{
        allowSubGroupMembers:data.allowSubGroupMembers,
        numberOfReviewers:data.numberOfReviewers,
        profileObjects: [ profileVMOObject ]
    };
};


/**
 * Get the input obejct property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropertyObjectValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Add the input objects to data provider.
 *
 * @param {Object} data Data view model object
 * @param {Array} selectedObjects Selected resource pool objects
 * @param {Object} dataProvider Data provider object that need to be updated
 * @returns {boolean} True/False based on input objects is added to data provider or not.
 */
export let addSelectedProfiles = function( data, selectedObjects, dataProvider ) {
    var isValidToUpdate = false;
    var profileObjects = [];
    // Check if selected objects is valid then only process further
    if( selectedObjects && !_.isEmpty( selectedObjects ) && selectedObjects[0] ) {
        var numberOfReviewers = data.numberOfReviewers.dbValue;
        // Check if number of reviewers value is less then 0 then use default value as 1.
        if( numberOfReviewers < 0 ) {
            numberOfReviewers = 1;
        }
        // Create the profile object that need to be shown on data provider.
        var profileVMOObject = Awp0WorkflowDesignerUtils.createProfileObjectFromRP( selectedObjects[0], numberOfReviewers, data.i18n.required );
        profileObjects.push( profileVMOObject );
        isValidToUpdate = true;
    }
    // Check if profile object array is not null and not empty then update the data provider.
    if( profileObjects && !_.isEmpty( profileObjects ) && isValidToUpdate ) {
        dataProvider.update( profileObjects, profileObjects.length );
    }
    return isValidToUpdate;
};

/**
 * Create profile input structure and set it on data object
 * @param {Object} data Data view model object
 * @param {Object} selectedTemplate Selected template object from UI.
 * @param {Object} newProfileObject New profile object user is trying to add
 *
 * @returns {Array} Create profile SOA input structure
 */
var _createProfileInputStructure = function( data, selectedTemplate, newProfileObject ) {
    // Check if input data is not valid then return null from here and no need to process further
    if( !data || !selectedTemplate || !newProfileObject || !newProfileObject.uid ) {
        return null;
    }
    var input = [];
    // Get the Template Uid that where profile need to be created. If template uid is null then no need to process further
    var templateUid = Awp0WorkflowDesignerUtils.getValidTemplateObjectUid( selectedTemplate, 'EPMSelectSignoffTaskTemplate' );
    var updateAdditionalData = {};
    if( !templateUid ) {
        return null;
    }

    // Get the group and role values and if values are valid then only add it to
    // additional data and add other properties values to additional data
    var groupValue = _getPropertyObjectValue( newProfileObject, 'group', false );
    var roleValue = _getPropertyObjectValue( newProfileObject, 'role', false );

    var numberOfReviewersValue = data.numberOfReviewers.dbValue;
    // Check if number of reviewer is > 0 then only add it to input structure
    if( numberOfReviewersValue > 0 ) {
        updateAdditionalData.template_profiles_num_reviewers = [ numberOfReviewersValue.toString() ];
    }

    updateAdditionalData.template_profiles_allow_sub_groups = [ data.allowSubGroupMembers.dbValue.toString() ];
    updateAdditionalData.template_profile_quorum = [ '-1' ];
    if( groupValue ) {
        updateAdditionalData.template_profile_groups = [ groupValue ];
    } else {
        updateAdditionalData.template_profile_groups = [ '*' ];
    }

    if( roleValue  ) {
        updateAdditionalData.template_profile_roles = [ roleValue ];
    } else {
        updateAdditionalData.template_profile_roles = [ '*' ];
    }

    var createObject = {
        clientID: 'createProfile -' + selectedTemplate.uid,
        templateToUpdate: templateUid,
        additionalData: updateAdditionalData
    };
    input.push( createObject );
    if( input && input.length > 0 ) {
        return input;
    }
};

/**
 * Set the update profile input structure on data object that will be used to update
 * the profile object
 * Update profile input structure
 * @param {Object} data Data view model object
 *
 * @returns {Object} Updated properties vector object
 */
var _updateProfileInputStructure = function( data ) {
    var propVector = [];
    if( data.numberOfReviewers && data.numberOfReviewers.valueUpdated ) {
        // Check if number of reviewers is > 0 then only use that to add to vector
        var numberOfReviewersValue = data.numberOfReviewers.dbValue;
        if( numberOfReviewersValue > 0 ) {
            var reviewer = {
                name: 'number_of_signoffs',
                values: [ numberOfReviewersValue.toString() ]
            };
            propVector.push( reviewer );
        }
    }
    // Check if allow sub group proeprty updated then add it to vector with updated value
    if( data.allowSubGroupMembers && data.allowSubGroupMembers.valueUpdated ) {
        var allowSubgroups = {
            name: 'allow_subgroups',
            values: [ data.allowSubGroupMembers.dbValue.toString() ]
        };
        propVector.push( allowSubgroups );
    }
    if( propVector && propVector.length > 0 ) {
        return propVector;
    }
};

/**
 * Compare group and role properties for both profiles and based on that return true or false.
 *
 * @param {Object} previousProfile Previous profile object for panel is opened
 * @param {Object} newProfile New profile object user is trying to add
 * @returns {boolean} True/False to determine profile create case or not.
 */
var _isCreateProfileCase = function( previousProfile, newProfile ) {
    // Check if new profile object is null then profile can't be created to return false from here
    if( !newProfile ) {
        return false;
    }
    var isCreateCase = true;
    // Get the group and role property value for old profile object
    var oldGroupValue = _getPropertyObjectValue( previousProfile, 'group', false );
    var oldRoleValue = _getPropertyObjectValue( previousProfile, 'role', false );

    // Get the group and role property value for new profile object which need to be create
    var groupValue = _getPropertyObjectValue( newProfile, 'group', false );
    var roleValue = _getPropertyObjectValue( newProfile, 'role', false );

    // Check if both properties are same then it's profile update case and not create
    // so return false from here else return true always
    if( oldGroupValue === groupValue && oldRoleValue === roleValue ) {
        isCreateCase = false;
    }
    return isCreateCase;
};

/**
 * Either create the new profile and delete the selected profile or else update the profile. So based
 * on user selected option create the input structure and set it on data object
 * @param {Object} data view model Object
 * @param {Object} selectedTemplate Selected template object from UI.
 * @param {Object} previousProfile Profile object for panel is opened.
 * @param {Object} newProfile Current profile object present on panel.
 *
 * @returns {Object} Create profile SOA input structure along with update one. One will have the value and other
 *                  will be null.
 */
export let getCreateOrUpdateProfileInfo = function( data, selectedTemplate, previousProfile, newProfile ) {
    // Check if user has updated the group or role fields from UI that means we need to delete
    // the existing profile and create new profile.
    let updateProfileInputVector = null;
    let createProfileInputData = null;

    // Check if user has updated the data provider then compare group and role for both objects
    // and if not matches then only go to create else use update case.
    if( data.isValidToUpdate && _isCreateProfileCase( previousProfile, newProfile ) ) {
        createProfileInputData = _createProfileInputStructure( data, selectedTemplate, newProfile );
        return{
            createProfileInputData: createProfileInputData,
            updateProfileInputVector: updateProfileInputVector
        };
    }

    // Update profile SOA input structure.
    updateProfileInputVector = _updateProfileInputStructure( data );
    return{
        createProfileInputData: createProfileInputData,
        updateProfileInputVector: updateProfileInputVector
    };
};

export default exports = {
    populatePanelContextData,
    populateProfilePanelData,
    addSelectedProfiles,
    getCreateOrUpdateProfileInfo
};
