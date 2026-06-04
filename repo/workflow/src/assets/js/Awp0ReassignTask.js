// Copyright (c) 2023 Siemens

/**
 * @module js/Awp0ReassignTask
 */
import cdmSvc from 'soa/kernel/clientDataModel';
import Awp0TasksUtils from 'js/Awp0TasksUtils';
import _ from 'lodash';

/**
 * Define public API
 */
var exports = {};

/**
 * get the supporting object for reassign action. It can be a resource pool or user
 *
 * @param {Object} object the selected task Object
 * @param {Array} userObjects Selected user from UI for task will be reassigend
 *
 * @returns {Object} Supporting object UID
 *
 */
function getSupportingObject( object, userObjects ) {
    var supportingObject;
    var gmUID;
    //send groupmember for signoff.  for all other task types, send user
    if( userObjects !== null && userObjects.length > 0 ) {
        if( userObjects[ 0 ].type === 'GroupMember' && object.type !== 'Signoff' ) {
            if( userObjects[ 0 ].props.user !== null ) {
                gmUID = userObjects[ 0 ].props.user.dbValues[ 0 ];
                if( gmUID !== null ) {
                    supportingObject = cdmSvc.getObject( gmUID );
                }
            }
        } else {
            if( userObjects[0].uniqueUid ) {
                userObjects[0].uid = userObjects[0].uniqueUid;
            }
            gmUID = userObjects[ 0 ].uid;
            supportingObject = cdmSvc.getObject( gmUID );
        }
    }

    return supportingObject;
}

/**
 * Get the property name and value map that needs to be saved when user do reassign action.
 * To set
 *
 * @param {Array} userObjects Selected user from UI for task will be reassigend
 * @param {String} comment Comments proeprty string entered from UI
 *
 * @returns {Object} Property name and values object that need to be saved
 */
var _getPropertyNameValues = function( userObjects, comment ) {
    var propertyNameValues = {};
    // Check if comment proeprty value is not null then only add it
    // to property name value. It will end when user enter comment as empty string
    // or any value
    if( comment ) {
        propertyNameValues.comments = [ comment ];
    }
    // Check if release is Tc 13.1 or more then we need to check for project as well
    // and if selcted group member or resource pool comes from project then we need to
    // set it to map as well.
    var projectReassignObject = _.filter( userObjects, function( selObject ) {
        return selObject.projectObject;
    } );

    if( projectReassignObject && projectReassignObject[ 0 ] && projectReassignObject[ 0 ].projectObject && projectReassignObject[ 0 ].projectObject.uid ) {
        propertyNameValues.fnd0AssigneeOrigin = [ projectReassignObject[ 0 ].projectObject.uid ];
    } else if( userObjects && userObjects[ 0 ] && userObjects[ 0 ].modelType
            && userObjects[ 0 ].modelType.typeHierarchyArray.indexOf( 'ResourcePool' ) > -1 ) {
        if( userObjects[0].uniqueUid ) {
            userObjects[0].uid = userObjects[0].uniqueUid;
        }
        // Check if selected object is not null and it's a resource pool object then we need to set
        // assignee origin as resource pool so pass it from here.
        propertyNameValues.fnd0AssigneeOrigin = [ userObjects[ 0 ].uid ];
    }

    return propertyNameValues;
};

/**
 * Get the input data object that will be used in SOA to reassign the tasks
 *
 * @param {Array} selectedTasks - The selected task objects from UI that will be reassigend
 * @param {Array} userObjects Selected user from UI for task will be reassigend
 * @param {String} comment Comments proeprty string entered from UI
 *
 * @return {Object} Input data object
 */
export let getInputData = function( selectedTasks, userObjects, comment, subPanelContext ) {
    var reassignInput = [];

    if ( !selectedTasks || _.isEmpty( selectedTasks ) ) {
        //get the selection from the subPanelContext
        var selectedVMO = subPanelContext?.vmo;
        //Needed for #Awp0ReplaceReviewerCtx case where the selection is from the subPanelContext
        if( _.isEmpty(selectedVMO) ){
            selectedVMO = subPanelContext?.selected[0];
        }
        selectedTasks = [];
        selectedTasks.push( selectedVMO );
    }

    if( selectedTasks && !_.isEmpty( selectedTasks ) ) {
        _.forEach( selectedTasks, function( taskObject ) {
            // This needed for Replace reviewers from Reviewers tab. This will come into context when Replace command is clicked
            if( selectedTasks && selectedTasks.length > 0 && selectedTasks[0].type === 'Awp0XRTObjectSetRow' ) {
                taskObject = cdmSvc.getObject( selectedTasks[0].props.awp0Secondary.dbValues[ 0 ] );
            }
            var supportingObject = getSupportingObject( taskObject, userObjects );
            var propertyNameValues = _getPropertyNameValues( userObjects, comment );
            var reassignInputInt = {

                actionableObject: {
                    uid: taskObject.uid,
                    type: taskObject.type
                },
                action: 'SOA_EPM_assign_action',
                password: '',
                supportingValue: '',
                supportingObject: supportingObject,
                propertyNameValues: propertyNameValues
            };

            reassignInput.push( reassignInputInt );
        } );
    }

    return reassignInput;
};

/**
 * Get the group and role from the profile associated with the selected signoff.
 *
 * @param {Object} modelObject - The model object for property needs to be populated
 *
 * @returns {Object} Object that will hold profile object and additional search criteria.
 */
var populateAdditionalSearchCriteria = function( modelObject  ) {
    var additionalSearchCriteria = {};
    var profileObj = null;
    // Get the additional search criteria based on origin prooeprty value and if origin present
    // then populate the criteria from origin itself.
    if( modelObject && modelObject.props.origin && modelObject.props.origin.dbValues
        && modelObject.props.origin.dbValues[ 0 ] ) {
        var origin = cdmSvc.getObject( modelObject.props.origin.dbValues[ 0 ] );

        // Get the profile object from origin and get the additional search criteria
        if( origin ) {
            profileObj = Awp0TasksUtils.getSignoffProfileObject( origin );
        }
    }

    // Check if profile object is not null and it contains additional criteria then get that
    // additional criteria from profile object and set the profile object on workflow context
    // and return the additional search criteria.
    if( profileObj && profileObj.additionalSearchCriteria ) {
        additionalSearchCriteria = profileObj.additionalSearchCriteria;
    }

    return {
        profileObject : profileObj,
        additionalSearchCriteria : additionalSearchCriteria
    };
};

/**
 * Populate the panel data based on selection and add the additional search criteria so that duplicate reviewer will
 * be avoided.
 *
 * @param {Array} selectedObjects Selected task objects from UI.
 * @param {Object} addUserPanelState user Panel state object that will hold all info related to adding users
 * @param {Object} criteria Criteria object to add additional search criteria that will be pass to server
 *
 * @returns {Object} User panel data context object that holds additional criteria along with other values.
 */
export let populatePanelData = function( selectedObjects, addUserPanelState, criteria, subPanelContext ) {
    let isXRTselection = false;
    var context = {
        loadProjectData : true,
        additionalSearchCriteria : {}
    };

    if ( !selectedObjects ) {
        var selectedVMO = {};
        //get the selection from the subPanelContext
        if( subPanelContext && subPanelContext.vmo ) {
            selectedVMO = subPanelContext.vmo;
        } else if ( subPanelContext && subPanelContext.selected ) {
            selectedVMO = subPanelContext.selected[0];
        }
        selectedObjects = [];
        selectedObjects.push( selectedVMO );
    }

    const userPanelState = { ...addUserPanelState };
    userPanelState.criteria = criteria;
    //This is needed when we have selection from the objectSet Table and trying to replace the profile user
    if( selectedObjects && selectedObjects.length > 0 && selectedObjects[0].modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) > -1 ) {
        isXRTselection = true;
    }
    // Populate the additional search criterai only in case of one selection and selected object is signoff
    if( selectedObjects && selectedObjects[ 0 ] && selectedObjects.length === 1 && selectedObjects[ 0 ].modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 || isXRTselection) {
        var searchContext = {};
        if( isXRTselection ) {
            searchContext = populateAdditionalSearchCriteria( cdmSvc.getObject( selectedObjects[ 0 ].props.awp0Secondary.dbValues[ 0 ] ) );
        } else {
            searchContext = populateAdditionalSearchCriteria( cdmSvc.getObject( selectedObjects[ 0 ].uid ) );
        }
        if( searchContext.profileObject && searchContext.additionalSearchCriteria ) {
            context.profileObject = searchContext.profileObject;
            var additionalSearchCriteria = _.clone( searchContext.additionalSearchCriteria );
            userPanelState.profileObject = searchContext.profileObject;
            if( userPanelState.criteria ) {
                // Iterate for all entries in additional search criteria and add to main search criteria
                for( var searchCriteriaKey in additionalSearchCriteria ) {
                    if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                        userPanelState.criteria[ searchCriteriaKey ] = _.clone( additionalSearchCriteria[ searchCriteriaKey ] );
                    }
                }
            }
        }
    }

    // Set this on context as child component will start render when this variable value set to true.
    context.isDataInit = true;
    return {
        userPanelState : userPanelState,
        isDataInit : true
    };
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0ReassignTask
 */

export default exports = {
    getInputData,
    populatePanelData
};
