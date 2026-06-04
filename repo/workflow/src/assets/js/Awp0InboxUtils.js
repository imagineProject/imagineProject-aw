// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0InboxUtils
 */
import cdm from 'soa/kernel/clientDataModel';
import commandsMapSvc from 'js/commandsMapService';
import viewModelObjectService from 'js/viewModelObjectService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import dmSvc from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';

/**
 * Define public API
 */
var exports = {};
var _RESOURCEPOOL_GROUP_DCP = 'REF(resource_pool,ResourcePool).group';
var _RESOURCEPOOL_ROLE_DCP = 'REF(resource_pool,ResourcePool).role';
var _GROUPMEMBER_USER_DCP = 'REF(group_member,GroupMember).user';

/**
 * Get the input structure to add the selected signoffs
 *
 * @param {object} userPanelState User panel state object that contais all info like selected profile or origin.
 * @param {Array} selectedUsers Selected users from UI.
 *
 * @returns {Array} Signoff SOA structure array
 */
export let getsignoffInfo = function( userPanelState, selectedUsers ) {
    var signOffInfos = [];

    // Check if user panel data is not null and it has some selected objects then
    // iterate for all selected objects and check if not user then we can create the
    // signoff info structure and add to the array that will be returned.
    if( selectedUsers && !_.isEmpty( selectedUsers ) ) {
        _.forEach( selectedUsers, function( userObject ) {
            if( userObject && userObject.modelType && userObject.modelType.typeHierarchyArray.indexOf( 'User' ) <= -1 ) {
                if( userObject.type === 'ResourcePool' ) {
                    userObject.uid = userObject.uniqueUid;
                }
                var signOffInfo = {
                    signoffMember: userObject,
                    origin: userPanelState.profileObject,
                    signoffAction: userPanelState.signoffAction,
                    originType: userPanelState.originType
                };
                signOffInfos.push( signOffInfo );
            }
        } );
    }
    return signOffInfos;
};

/**
 * Get the perform signoff task object based on the object for action needs to be performed.
 *
 * @param {object} selection - the selected Object
 * @return {object} taskObject - Perform signoff object
 *
 */
export let getTaskObject = function( selection ) {
    var taskObject = null;

    if( !selection ) {
        return taskObject;
    }
    if( commandsMapSvc
        .isInstanceOf( 'EPMTask', selection.modelType ) ) {
        taskObject = selection;
    } else if( commandsMapSvc.isInstanceOf( 'Signoff', selection.modelType ) && selection.props.fnd0ParentTask &&
        selection.props.fnd0ParentTask.dbValues && selection.props.fnd0ParentTask.dbValues[ 0 ] ) {
        var modelObj = cdm.getObject( selection.props.fnd0ParentTask.dbValues[ 0 ] );
        taskObject = viewModelObjectService.createViewModelObject( modelObj );
    }

    return taskObject;
};

/**
 * get the comments entered on the panel.
 *
 * @param {object} data - the data Object
 *
 */

export let getComments = function( data ) {
    var propertyNameValues = {};
    // Check if comment property value is not null then only add it
    // to property name value. It will end when user enter comment as empty string
    // or any value
    if( data.comments && data.comments.dbValue !== null ) {
        propertyNameValues.comments = [ data.comments.dbValue ];
    }
    return propertyNameValues;
};

/**
 * Get the task to be promoted / demoted / suspended / resumed from input review task. If review task has parent task then it will return route task else
 * @param {Object} reviewTask - Review task object whose promote / demote / suspend / resume task to be find
 */

const getActionCommandTaskForReviewTask = function( reviewTask ) {
    //if review task has a parent, then get its parent route task.
    if( reviewTask && reviewTask.props.parent_task !== null ) {
        const routeTaskUID = reviewTask.props.parent_task.dbValues[ 0 ];
        const routeTask = cdm.getObject( routeTaskUID );

        if( routeTask && routeTask.modelType.typeHierarchyArray.indexOf( ' EPMRouteTask ' ) > -1 ) {
            return routeTask;
        }
        return reviewTask;
    }
};

/**
 * This function will get the task object that will be promoted / demoted / suspended / resumed
 *
 * @param {object} selection - the current selection object
 * @return {object} - Task to be promoted / demoted / suspended / resumed object
 */
export let getActionableTaskObject = function( selection ) {
    let taskToActionCommand = selection;
    let modelObject = selection;

    if( selection && selection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        //get the perform signoff task
        const pstTaskUID = selection.props.fnd0ParentTask.dbValues[ 0 ];
        if( pstTaskUID ) {
            modelObject = cdm.getObject( pstTaskUID );
        }
    }

    if( modelObject && modelObject.modelType.typeHierarchyArray.indexOf( 'EPMPerformSignoffTask' ) > -1 ) {
        //get the review task
        const reviewTaskUID = modelObject.props.parent_task.dbValues[ 0 ];
        if( reviewTaskUID ) {
            const reviewTask = cdm.getObject( reviewTaskUID );

            // Get the task to be promoted / demoted / suspended / resumed from review task
            taskToActionCommand = getActionCommandTaskForReviewTask( reviewTask );
        }
    }
    return taskToActionCommand;
};

/**
 * Populate the signoff description on the panel.
 * @param {object} dataDesc - the data cloned description property
 * @param {object} selectedObject - the current selection object
 * @returns {object} - Description and propertyDisplayName of perfrom-signoff task
 */
const _populateSignoffInstructions = function( dataDesc, selectedObject ) {
    if( selectedObject && selectedObject.props.fnd0ParentTask && selectedObject.props.fnd0ParentTask.dbValues ) {
        const modelObj = cdm.getObject( selectedObject.props.fnd0ParentTask.dbValues[ 0 ] );
        if( modelObj && modelObj.props.fnd0Instructions ) {
            dataDesc.propertyDisplayName = modelObj.props.fnd0Instructions.propertyDescriptor.displayName;
            return {
                dbValue: modelObj.props.fnd0Instructions.dbValues[ 0 ],
                uiValue: modelObj.props.fnd0Instructions.uiValues[ 0 ]
            };
        }
    }
    return {
        dbValue: selectedObject.props.object_desc.dbValues[ 0 ],
        uiValue: selectedObject.props.object_desc.uiValues[ 0 ]
    };
};

/**
 * Populate the description on the panel.
 *
 * @param {object} dataDesc - the data description property
 * @param {object} selectedObject - the current selection object
 * @return {object} - updated data description property
 */
export let populateDescription = function( dataDesc, selectedObject ) {
    const newDataDesc = _.clone( dataDesc );

    if( selectedObject.modelType && selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        var signoffDescObject = _populateSignoffInstructions( newDataDesc, selectedObject );
        newDataDesc.dbValue = signoffDescObject.dbValue;
        newDataDesc.uiValue = signoffDescObject.uiValue;
    } else{
        if( selectedObject.props.fnd0Instructions ) {
            newDataDesc.dbValue = selectedObject.props.fnd0Instructions.dbValues[ 0 ];
            newDataDesc.uiValue = selectedObject.props.fnd0Instructions.uiValues[ 0 ];
            newDataDesc.propertyDisplayName = selectedObject.props.fnd0Instructions.propertyDescriptor.displayName;
        } else if ( selectedObject.props.object_desc ) {
            newDataDesc.dbValue = selectedObject.props.object_desc.dbValues[ 0 ];
            newDataDesc.uiValue = selectedObject.props.object_desc.uiValues[ 0 ];
        }
    }

    return newDataDesc;
};

/**
 * Populate the workflow description on the panel.
 *
 * @param {object} dataDesc - the data description property
 * @param {object} selectedObject - the current selection object
 * @returns {object} - updated data description property
 */
export let populateJobDescription = function( dataDesc, selectedObject ) {
    const newDataDesc = _.clone( dataDesc );
    let workflowDescDBValue = '';
    let workflowDescUIValue = '';
    const taskObject = getTaskObject( selectedObject );

    if( taskObject && taskObject.props.parent_process ) {
        const parentJobObject = cdm.getObject( taskObject.props.parent_process.dbValues[ 0 ] );

        if( parentJobObject && parentJobObject.props && parentJobObject.props.object_desc ) {
            workflowDescDBValue = parentJobObject.props.object_desc.dbValues[ 0 ];
            workflowDescUIValue = parentJobObject.props.object_desc.uiValues[ 0 ];
        }
    }

    newDataDesc.dbValue = workflowDescDBValue;
    newDataDesc.uiValue = workflowDescUIValue;

    return newDataDesc;
};

/**
 * Populate the workflow name on the panel.
 *
 * @param {object} dataName - the data Job name property
 * @param {object} selectedObject - the current selection object
 * @returns {object} - updated data property
 */
export let populateJobName = function( dataName, selectedObject ) {
    const newDataName = _.clone( dataName );
    let workflowNameDBValue = '';
    let workflowNameUIValue = '';

    const taskObject = getTaskObject( selectedObject );

    if( taskObject && taskObject.props.parent_process ) {
        workflowNameDBValue = taskObject.props.parent_process.dbValues[ 0 ];
        workflowNameUIValue = taskObject.props.parent_process.uiValues[ 0 ];
    }

    newDataName.dbValue = workflowNameDBValue;
    newDataName.uiValue = workflowNameUIValue;

    return newDataName;
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 *
 * @returns {Object} Object with properties needs to be updated on UI
 */
export let populatePanelData = function( data, selection ) {
    const newDataTaskName = _.clone( data.taskName );

    let selectedObject = selection;

    // Check if input selected object is null then return from here
    if( !selectedObject ) {
        return;
    }

    selectedObject = cdm.getObject( selectedObject.uid );

    // Check if selection is not null and not of type ViewModelObject then create the
    // view model object and use further to get the properties on view model object.
    // In case when user selecting the node from viewer input selection is not view model object.
    if( selectedObject && !viewModelObjectService.isViewModelObject( selectedObject ) ) {
        selectedObject = viewModelObjectService.createViewModelObject( selectedObject );
    }

    let nameDBValue = '';
    let nameUIValue = '';
    if( selection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        nameDBValue = selectedObject.props.object_name.dbValue;
        nameUIValue = selectedObject.props.object_name.uiValues[ 0 ];
    } else {
        nameDBValue = selectedObject.props.object_string.dbValue;
        nameUIValue = selectedObject.props.object_string.uiValues[ 0 ];
    }

    newDataTaskName.dbValue = nameDBValue;
    newDataTaskName.uiValue = nameUIValue;

    // Populate the description
    const newDataDesc = exports.populateDescription( data.description, selection );

    // Get the task to be Suspended/Resume/Demoted/Promoted
    const actionableTask = exports.getActionableTaskObject( selection );

    return {
        taskName: newDataTaskName,
        description: newDataDesc,
        actionableTask: actionableTask
    };
};

/**
 * Check for user selection comes from project selection and if found any then for them create
 * the setProperties SOA input structure.
 *
 * @param {Array} createSignoffUids Created signoff Uid's array
 * @param {Array} selectedObjects Selected user/group member or resource pool object that need to
 *        be added.
 *
 * @returns {Array} Input array that will contain all info for set proeprties SOA call
 */
export let getAssigeeOriginUpdateData = function( createSignoffUids, selectedObjects ) {
    var input = [];
    // Check for if created singoff Uid's or selected objects array i sinvalid then no need to process
    if( !createSignoffUids || createSignoffUids.length <= 0 || !selectedObjects || !selectedObjects.length <= 0 ) {
        var projectSignoffs = _.filter( selectedObjects, function( obejct ) {
            return obejct.projectObject;
        } );
        // Iterate for each signoff uids and check if it has group member or resource pool assignment
        // then we need to get that value and then match it with all selected obejct array and if match
        // found and project info present then sue that project to set fnd0AssigneeOrigin else don't
        // add that info to input array.
        _.forEach( createSignoffUids, function( signoffUid ) {
            var modelObj = cdm.getObject( signoffUid );
            var assigneeUid = null;
            if( modelObj && modelObj.props && modelObj.props.group_member &&
                modelObj.props.group_member.dbValues && modelObj.props.group_member.dbValues[ 0 ] ) {
                assigneeUid = modelObj.props.group_member.dbValues[ 0 ];
            } else if( modelObj && modelObj.props && modelObj.props.resource_pool &&
                modelObj.props.resource_pool.dbValues && modelObj.props.resource_pool.dbValues[ 0 ] ) {
                assigneeUid = modelObj.props.resource_pool.dbValues[ 0 ];
            }

            var assigneeObject = _.find( projectSignoffs, function( selObject ) {
                return selObject.uid === assigneeUid;
            } );
            if( assigneeObject && assigneeObject.projectObject && assigneeObject.projectObject.uid ) {
                var propertyNameValues = {};
                propertyNameValues.fnd0AssigneeOrigin = [ assigneeObject.projectObject.uid ];
                var element = {
                    actionableObject: modelObj,
                    action: 'SOA_EPM_set_task_prop_action',
                    propertyNameValues: propertyNameValues
                };
                input.push( element );
            }
        } );
    }
    return input;
};

/**
 * Based on selected objects, get the root task and return the root task objects that
 * need to be deleted. If input is Signoff then get the fnd0ParentTask on signoff object
 * and then get the parent_process on parent task object.
 *
 * @param {Array} selectedObjects Selected objects that need to be deleted
 *
 * @returns {Array} Get all objects that need to be deleted
 */
export let getTaskObjectsToDelete = function( selectedObjects ) {
    var deferred = AwPromiseService.instance.defer();
    //ensure the required objects are loaded
    var policyId = policySvc.register( {
        types: [ {
            name: 'Signoff',
            properties: [ {
                name: 'fnd0ParentTask',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: 'EPMTask',
            properties: [ {
                name: 'parent_process',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            } ]
        },
        {
            name: 'Job',
            properties: [ {
                name: 'object_string'
            }

            ]
        }
        ]
    } );
    dmSvc.getPropertiesUnchecked( selectedObjects, [ 'fnd0ParentTask', 'parent_process' ] ).then( function( response ) {
        if( policyId ) {
            policySvc.unregister( policyId );
        }
        var deleteObjects = [];
        _.forEach( selectedObjects, function( selObj ) {
            var modelObject = cdm.getObject( selObj.uid );

            // Get the task object, in case of signoff get the fnd0ParentTask object.
            var taskObject = getTaskObject( modelObject );
            var processObject = null;
            // Now on the task object, get the parent process and use that to delete the task.
            if( taskObject && taskObject.props && taskObject.props.parent_process.dbValues &&
                taskObject.props.parent_process.dbValues[ 0 ] ) {
                processObject = cdm.getObject( taskObject.props.parent_process.dbValues[ 0 ] );
                if( processObject && processObject.uid ) {
                    deleteObjects.push( processObject );
                }
            }
        } );
        // Remove the duplicates if present in deleted object list. We are passing unqiue
        // root task object so that if user selected multiple tasks from same workflow then
        // we need to delete all tasks from same workflow and if we return root_task then it
        // will do the same thing and if we pass multiple tasks directly then it will return error
        // because first task selection, will delete the whole process and for second selction it
        // will throw error as object is already deleted.
        var finalDeletedList = _.uniqWith( deleteObjects, function( objA, objB ) {
            return objA.uid === objB.uid;
        } );
        deferred.resolve( finalDeletedList );
    } );
    return deferred.promise;
};

/**
 * Populate the task description and job description property for input model object.
 *
 * @param {Object} selectedObject Selected task object from UI
 * @param {Object} descProp Task description property object.
 * @param {Object} jobDesc Job description property object.
 *
 * @returns {Object} Updated task description and job description property
 */
export let populateTaskPanelProps = function( selectedObject, descProp, jobDesc ) {
    const taskDesciption = exports.populateDescription( descProp, selectedObject );
    const jobDescription = exports.populateJobDescription( jobDesc, selectedObject );
    return {
        taskDesciption: taskDesciption,
        jobDescription: jobDescription
    };
};

/**
 * Return the input panel as this is mainly need to be used for navigate panel cases where
 * user need to navigate to open panel.
 *
 * @param {String} destPanelId New panel that need to be opened.
 * @returns {String} New panel that need to be navigated.
 */
export let performNavigateAction = function( destPanelId ) {
    return destPanelId;
};

/**
 * Get the model object that need to be render so that correct icon will be shown
 *
 * @param {Object} objectToRender Signoff vmo object
 * @return {Object} node
 */
var _getModelObject = function( objectToRender ) {
    var modelObject = null;
    // Check if input object is of type resource pool then show the resource pool icon
    // and if it's of type user then show the user icon
    if( objectToRender ) {
        if( objectToRender.props[ _RESOURCEPOOL_GROUP_DCP ] &&
            objectToRender.props[ _RESOURCEPOOL_GROUP_DCP ].dbValues &&
            objectToRender.props[ _RESOURCEPOOL_GROUP_DCP ].dbValues[ 0 ] ) {
            var resourcePoolObject = cdm.getObject( objectToRender.props.resource_pool.dbValues[ 0 ] );
            if( resourcePoolObject ) {
                modelObject = resourcePoolObject;
            }
        } else if( objectToRender.props[ _GROUPMEMBER_USER_DCP ] &&
            objectToRender.props[ _GROUPMEMBER_USER_DCP ].dbValues &&
            objectToRender.props[ _GROUPMEMBER_USER_DCP ].dbValues[ 0 ] ) {
            var groupMemberObject = cdm.getObject( objectToRender.props[ _GROUPMEMBER_USER_DCP ].dbValues[ 0 ] );
            if( groupMemberObject ) {
                modelObject = groupMemberObject;
            }
        }
    }
    return modelObject;
};

/**
 * Get the created view model object.
 *
 * @param {object} data - the data Object
 * @param {object} serverVMOObject - the VMO object created on server
 *
 * @returns {Object} Signoff object
 */
var getSignoffVMOObject = function( data, serverVMOObject ) {
    var signoffVMOObject = null;
    if( serverVMOObject ) {
        signoffVMOObject = viewModelObjectService.createViewModelObject( serverVMOObject.uid, 'EDIT', null, serverVMOObject );

        if( !signoffVMOObject ) {
            return serverVMOObject;
        }
        signoffVMOObject.isResoucePoolSignoff = false;

        // Check if resource pool property is not null then only set the obejct as resource pool
        if( signoffVMOObject.props.resource_pool && signoffVMOObject.props.resource_pool.dbValues &&
            signoffVMOObject.props.resource_pool.dbValues[ 0 ] ) {
            signoffVMOObject.isResoucePoolSignoff = true;

            if( signoffVMOObject.props[ _RESOURCEPOOL_GROUP_DCP ] &&
                !signoffVMOObject.props[ _RESOURCEPOOL_GROUP_DCP ].dbValue ) {
                signoffVMOObject.props[ _RESOURCEPOOL_GROUP_DCP ].dbValue = data.i18n.any;
                signoffVMOObject.props[ _RESOURCEPOOL_GROUP_DCP ].dbValues = [ data.i18n.any ];
                signoffVMOObject.props[ _RESOURCEPOOL_GROUP_DCP ].uiValues = [ data.i18n.any ];
            }

            if( signoffVMOObject.props[ _RESOURCEPOOL_ROLE_DCP ] &&
                !signoffVMOObject.props[ _RESOURCEPOOL_ROLE_DCP ].dbValue ) {
                signoffVMOObject.props[ _RESOURCEPOOL_ROLE_DCP ].dbValue = data.i18n.any;
                signoffVMOObject.props[ _RESOURCEPOOL_ROLE_DCP ].dbValues = [ data.i18n.any ];
                signoffVMOObject.props[ _RESOURCEPOOL_ROLE_DCP ].uiValues = [ data.i18n.any ];
            }
        }

        if( signoffVMOObject.props.group_member && signoffVMOObject.props.group_member.dbValues &&
            signoffVMOObject.props.group_member.dbValues[ 0 ] ) {
            //presentGroupMemberSignoffList.push( signoffVMOObject.props.group_member.dbValues[ 0 ] );
        }
        if( signoffVMOObject.props.fnd0DecisionRequired &&
            signoffVMOObject.props.fnd0DecisionRequired.dbValues &&
            signoffVMOObject.props.fnd0DecisionRequired.uiValues ) {
            var requiredSignoff = signoffVMOObject.props.fnd0DecisionRequired.dbValues[ 0 ];

            if( requiredSignoff && requiredSignoff === 'RequiredUnmodifiable' ) {
                signoffVMOObject.isRequiredDecisionModifiable = false;
            } else {
                signoffVMOObject.isRequiredDecisionModifiable = true;
            }
            signoffVMOObject.decisionRequired = data.i18n.decisionRequired;
            signoffVMOObject.props.fnd0DecisionRequired.propertyDisplayName = signoffVMOObject.props.fnd0DecisionRequired.uiValues[ 0 ];
        }

        // Get the assignee object from signoff object and that will be used to render the correct icon.
        var signoffAssignee = _getModelObject( signoffVMOObject );

        // Create the assignee VMO object and set it on VMO and it will be used for rendering the icon
        // For group memebre, person icon will be rendered and for ersource pool , resource pool icon will be rendered
        if( signoffAssignee && signoffAssignee.uid ) {
            var assigneeVMO = viewModelObjectService.createViewModelObject( signoffAssignee.uid );
            signoffVMOObject.assigneeVMO = assigneeVMO;
        }
    }
    return signoffVMOObject;
};

/**
 * Parse the input JSOn string to get all signoff that need to be shown on UI.
 *
 * @param {String} signoffJSONString JSON string that contains signoff info
 * @param {Object} data Data view model object
 *
 * @returns {Array} Signoff object array that need to be shown.
 */
export let getSignoffObjects = function( signoffJSONString, data ) {
    var signoffObjects = [];
    if( signoffJSONString && signoffJSONString.length > 0 ) {
        var signoffObjs = JSON.parse( signoffJSONString );

        _.forEach( signoffObjs.objects, function( result ) {
            if( result ) {
                var updatedVMO = getSignoffVMOObject( data, result );

                if( updatedVMO ) {
                    signoffObjects.push( updatedVMO );
                }
            }
        } );
    }
    return signoffObjects;
};

/**
 * Get the input structure to remove the selected signoffs from respective data provider
 *
 * @param {Object} taskObject - the selected task object
 * @param {Object} selectedObjectsToRemove - the current selected objects in data provider
 *
 * @returns {Object} Signoff data that need to be removed as it will pass to SOA directly
 */
export let getRemoveSignoffsInputData = function( taskObject, selectedObjectsToRemove ) {
    var signoffs = [];
    var signoffsDeleted = [];
    // Check if selection is not null and 0th index object is also not null
    // then create the input structure
    if( selectedObjectsToRemove && taskObject && selectedObjectsToRemove.length > 0 ) {
        _.forEach( selectedObjectsToRemove, function( selObject ) {
            // Check if selected object is of type signoff then only add it to remove signoff list
            if( selObject && selObject.modelType &&
                selObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 && selObject.isRequiredDecisionModifiable ) {
                signoffsDeleted.push( selObject );
            }
        } );

        signoffs = [ {
            task: taskObject,
            removeSignoffObjs: signoffsDeleted
        } ];
    }

    return signoffs;
};

/**
 * Populate the info and open Add signoff panel or in case of when panel need to be in
 * tool and info area update the input context so hat user picker panel will show correct
 * users.
 *
 * @param {Object} selectedObject The selected object in case of profile it will be profile else null
 * @param {Object} eventData Event data that will have info like origin type signoff action etc
 * @param {Object} taskToPerform Task object for people picker need to open
 * @param {boolean} isToolAndInfoAreaPanel True or false based on panel is tool and info area or not.
 * @param {Object} addUserPanelState Object that need to be updated for info that need to be pass to user
 *                 picker panel.
 * @param {Object} defaultcriteria Default criteria that need to be set before opening the panel.
 */
export let openAddReviewerUserPanel = function( selectedObject, eventData, taskToPerform, isToolAndInfoAreaPanel, addUserPanelState, defaultcriteria ) {
    var additionalSearchCriteria = null;
    var profileObject = null;
    // Check if selected object cotnains additionalSearchCriteria then use that else it will
    // be null search criteria.
    if( selectedObject && selectedObject.props && selectedObject.additionalSearchCriteria ) {
        additionalSearchCriteria = selectedObject.additionalSearchCriteria;
        profileObject = selectedObject;
    }

    // In case of tool and info area panel we need to update the subPanelContext with all info like
    // selected profile or additional search criteria and navigate to user picker panel and return from
    // here.
    if( isToolAndInfoAreaPanel && addUserPanelState && eventData ) {
        const localContext = { ...addUserPanelState.value };

        localContext.selectionModelMode = 'multiple';
        localContext.profileObject = profileObject;
        localContext.taskToPerform = taskToPerform;
        localContext.originType = eventData.originType;
        localContext.signoffAction = eventData.signoffAction;
        // Reset the selected users to default value as we have oberver on this so it will not have previous
        // action value when we are trying to open people picker panel
        localContext.selectedUsers = null;
        // Check if default criteria is passed then we need to reset the criteria to default value first
        // before navigating to people picker panel. This is mainly needed if user open people picker for profile
        // and then open for adhoc so that time criteria should be set to default
        if( defaultcriteria ) {
            localContext.criteria = defaultcriteria;
        }

        // Check if criteria is not null and additionalSearchCriteria is present then we need to
        // iterate all keys present in additionalSearchCriteria and set it on criteria so that it
        // can be passed to server
        if( localContext.criteria && additionalSearchCriteria ) {
            // Iterate for all entries in additional search criteria and add to main search criteria
            for( var searchCriteriaKey in additionalSearchCriteria ) {
                if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                    localContext.criteria[ searchCriteriaKey ] = _.clone( additionalSearchCriteria[ searchCriteriaKey ] );
                }
            }
        }

        addUserPanelState.update && addUserPanelState.update( localContext );
    }
};

/**
 * Check the selection and if selection is of type signoff then only check if signoff can be removed or not and
 * based on that return true or false.
 *
 * @param {Object} selection the current selection objects
 * @param {String} selectionCriteria to indicate user has selected reviewer or adhoc or acknowledgers or notify
 * @param {Object} signoffSelectionData context info that will be updated based on current selection and this will
 *                 be used to show remove command in correct section.
 *
 * @returns {Object} Signoff selection data object
 */
export let evaluateSelections = function( selection, selectionCriteria, signoffSelectionData ) {
    var isValidSelection = false;
    if( selection && selection.length > 0 ) {
        for( var idx = 0; idx < selection.length; idx++ ) {
            if( selection[ idx ] && selection[ idx ].modelType &&
                selection[ idx ].modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 &&
                selection[ idx ].isRequiredDecisionModifiable ) {
                isValidSelection = true;
                break;
            }
        }
    }
    const selectionData = { ...signoffSelectionData };
    selectionData[ selectionCriteria ] = isValidSelection;
    return selectionData;
};

/**
 * This method will check the object type is of type Signoff or EPMTask then it will return false else it will
 * return true.
 *
 * @param {Object} selection the selection object
 *
 * @returns {boolean} True/False
 */
export let isValidEPMTaskType = function( selection ) {
    if( selection &&
        ( _.indexOf( selection.modelType.typeHierarchyArray, 'Signoff' ) > -1 || _.indexOf(
            selection.modelType.typeHierarchyArray, 'EPMTask' ) > -1 ) ) {
        return false;
    }
    return true;
};

/**
 * This method will get the active task from selected workspace object.
 *
 * @param {Object} selection the selection object
 * @returns {Object} task
 */
export let getActiveTaskFromWSOObject = function( selection ) {
    let activeTask = null;
    if( selection.props.fnd0MyWorkflowTasks && selection.props.fnd0MyWorkflowTasks.dbValues &&
        selection.props.fnd0MyWorkflowTasks.dbValues.length > 0 ) {
        activeTask = cdm.getObject( selection.props.fnd0MyWorkflowTasks.dbValues[ 0 ] );
    } else if( selection.props.fnd0AllWorkflows && selection.props.fnd0AllWorkflows.dbValues &&
        selection.props.fnd0AllWorkflows.dbValues.length > 0 ) {
        activeTask = cdm.getObject( selection.props.fnd0AllWorkflows.dbValues[ 0 ] );
    }

    return activeTask;
};

/**
 * Populate the subPanel context object from panelContext value present on appctx
 * object and return the subPanelContext object.
 *
 * @param {Object} panelContext Panel context information being used on app context
 * @returns {Object} Returns the panel data by reading the values from panelCOntext
 *                  and returns.
 */
export let populatePanelContextData = function( panelContext ) {
    var panelData = {};
    if( panelContext ) {
        panelData = _.clone( panelContext );
    }
    // Set this flag so that it can be used in panel so other child component will
    // not be loaded until this flag set to true.
    panelData.isDataInit = true;
    return panelData;
};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {String} Property internal value string
 */
var _getPropValue = function( modelObject, propName ) {
    if( !modelObject || !modelObject.uid ) {
        return null;
    }
    if( modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues
        && modelObject.props[ propName ].dbValues[ 0 ] ) {
        return modelObject.props[ propName ].dbValues[ 0 ];
    }
    return null;
};

/**
 * Get the awp0User uid from surrogate user assignment object.
 *
 * @param {Object} response Response object
 * @param {Object} vmoObject VMO object from user property need to be fetched
 *
 * @returns {String} awp0User Uid that will be used to open.
 */
export let getAwp0UserObject = function( response, vmoObject ) {
    var awp0SecondaryUid = _getPropValue( vmoObject, 'awp0Secondary' );
    if( awp0SecondaryUid && cdm.isValidObjectUid( awp0SecondaryUid ) ) {
        var awp0UserAssignmentObject = cdm.getObject( awp0SecondaryUid );
        if( awp0UserAssignmentObject ) {
            var awp0UserUid = _getPropValue( awp0UserAssignmentObject, 'awp0User' );
            if( awp0UserUid ) {
                return awp0UserUid;
            }
        }
    }
    return vmoObject.uid;
};

export let updateSelectionData = function( selectionData, selectedValue ) {
    if( selectionData.value && _.isEmpty( selectionData.value.selected ) )  {
        let selectionDataValue = selectionData.getValue();
        var selectedValues = [];
        selectedValues.push( selectedValue );
        selectionDataValue.pselected = selectedValues;
        selectionDataValue.selected = selectedValues;
        selectionData.update( selectionDataValue );
    }
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0InboxUtils
 */

export default exports = {
    getsignoffInfo,
    getTaskObject,
    getComments,
    getActionableTaskObject,
    populateDescription,
    populateJobDescription,
    populateJobName,
    populatePanelData,
    getAssigeeOriginUpdateData,
    getTaskObjectsToDelete,
    populateTaskPanelProps,
    performNavigateAction,
    getSignoffObjects,
    getRemoveSignoffsInputData,
    openAddReviewerUserPanel,
    evaluateSelections,
    getActiveTaskFromWSOObject,
    isValidEPMTaskType,
    populatePanelContextData,
    getAwp0UserObject,
    updateSelectionData
};
