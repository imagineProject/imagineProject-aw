// Copyright (c) 2023 Siemens

/**
 * @module js/Awp0WorkflowAssignmentUtils
 */
import viewModelObjSvc from 'js/viewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import iconSvc from 'js/iconService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import narrowModeService from 'js/aw.narrowMode.service';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import messagingSvc from 'js/messagingService';
import localeSvc from 'js/localeService';

var exports = {};
var _UNSTAFFED_UID = 'unstaffedUID';
var _multiUserTasks = [ 'EPMReviewTask', 'EPMRouteTask', 'EPMAcknowledgeTask', 'EPMReviewTaskTemplate',
    'EPMRouteTaskTemplate', 'EPMAcknowledgeTaskTemplate' ];

/**
  * Create the key role objects that need to be dispalyed on UI based on input array.
  *
  * @param {String} internalName  Internal name info for key role object
  * @param {String} dispalyName  Dispaly name info for key role object
  *
  * @returns {Object} Key role object that need to be used further
  */
export let createKeyRoleObject = function( internalName, dispalyName ) {
    if( !internalName || !dispalyName ) {
        return null;
    }

    var vmObject = viewModelObjSvc.constructViewModelObjectFromModelObject( null, '' );
    vmObject.type = 'KeyRole';
    vmObject.uid = internalName;
    // If icon present then use that icon else use default icon
    vmObject.typeIconURL = iconSvc.getTypeIconURL( 'Person48' );
    var propInternalValue = internalName;
    var propDisplayName = dispalyName;
    vmObject.cellHeader1 = propDisplayName;

    var vmProp = uwPropertySvc.createViewModelProperty( 'keyRole', 'keyRole',
        'STRING', propInternalValue, [ propDisplayName ] );
    vmProp.dbValues = [ propInternalValue ];
    vmProp.uiValues = [ propDisplayName ];
    vmObject.props.keyRole = vmProp;
    return vmObject;
};

/**
  * This method will get the object for assignment data need to be shown.
  *
  * @param {Object} selection the selection object
  *
  * @returns {Object} Valid object to show the task assignment
  */
export let getValidObjectForTaskAssignment = function( selection ) {
    var validObject = null;
    if( !selection ) {
        return validObject;
    }
    // Check if input object is of type Signoff, EPM task or EPM task template then use it as valid object for task assignment.
    if( selection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 || selection.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1
         || selection.modelType.typeHierarchyArray.indexOf( 'EPMTaskTemplate' ) > -1
         || selection.modelType.typeHierarchyArray.indexOf( 'Job' ) > -1 ) {
        validObject = selection;
    }
    // If selected object is of type item revision or nay other workspace object then get hte task information
    // thorugh the latest workflow and use that to get the assignment info
    if( selection.props.fnd0MyWorkflowTasks && selection.props.fnd0MyWorkflowTasks.dbValues &&
         selection.props.fnd0MyWorkflowTasks.dbValues.length > 0 ) {
        validObject = soa_kernel_clientDataModel.getObject( selection.props.fnd0MyWorkflowTasks.dbValues[ 0 ] );
    } else if( selection.props.fnd0AllWorkflows && selection.props.fnd0AllWorkflows.dbValues &&
         selection.props.fnd0AllWorkflows.dbValues.length > 0 ) {
        validObject = soa_kernel_clientDataModel.getObject( selection.props.fnd0AllWorkflows.dbValues[ 0 ] );
    }
    return validObject;
};


/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
  * Check if task state is completed or not and based on that return true or false.
  *
  * @param {Object} taskObject Task Object that need to be checked
  *
  * @returns {boolean} True/False based on task state
  */
export let isTaskCompleted = function( taskObject ) {
    var isCompleted = false;
    if( !isOfType( taskObject, 'EPMTask' ) ) {
        return isCompleted;
    }

    // Check the task state is completed based on task state is 8 then it's completed
    if( taskObject && taskObject.props && taskObject.props.state && taskObject.props.state.dbValues ) {
        var taskState = taskObject.props.state.dbValues[ 0 ];
        if( taskState === '8' ) {
            isCompleted =  true;
        }
    }
    return isCompleted;
};

/**
  * Check if task can be modified or not and based on that erturn true or false.
  *
  * @param {Object} taskObject Task obejct for assignment need to be done
  * @param {Object} taskAssignmentCtx Assignmetn context object
  *
  * @returns {boolean} True/False
  */
export let isTaskAssignmentNonModified = function( taskObject, taskAssignmentCtx  ) {
    var isNonModified = false;
    if( !isOfType( taskObject, 'EPMTask' ) ) {
        return isNonModified;
    }
    isNonModified = exports.isTaskCompleted( taskObject );
    if( isNonModified ) {
        return isNonModified;
    }
    if( taskAssignmentCtx && taskAssignmentCtx.isPrivilegedToAssign && taskAssignmentCtx.isPrivilegedToAssign === 'false' ) {
        isNonModified = true;
    }
    if( taskObject && taskObject.props && taskObject.props.awp0AddReviewerByMeBehavior && taskObject.props.awp0AddReviewerByMeBehavior.dbValues[0] === '1' ) {
        isNonModified = false;
    }
    return isNonModified;
};

/**
  * Return the value that we are in narrow mode or not.
  *
  * @returns {boolean} True or false
  */
export let isNarrowMode = function() {
    var isNarrowMode = narrowModeService.isNarrowMode();
    // This check is mainly needed for hosted mode for submit to workflow. If we launch then
    // workflow panel from NX then it should consider it as narrow mode and shows the small panel
    // This is fox for two PR 9897922 and 9858309
    if( !isNarrowMode && appCtxSvc.ctx && appCtxSvc.ctx.workflow_process_candidates
         && appCtxSvc.ctx.workflow_process_candidates.IsEmbeddedComponent ) {
        isNarrowMode = appCtxSvc.ctx.workflow_process_candidates.IsEmbeddedComponent;
    }
    return isNarrowMode;
};

/**
  * Register the context information that need to be saved for opening user
  * picker panel. Right now this is being used for task assignemnt panel.
  *
  * @param {String} selectionMode Selection mode string
  * @param {Object} additionalSearchCriteria Additional search criteria for user picker panel
  * @param {Object} profileObject Profile object selcted from UI
  * @param {boolean} isHideAddButtonOnUserPanel True or false to indicate that add button need to be shown
  *        on user picker panel or not.
  */
export let registerUserPanelContext = function( selectionMode, additionalSearchCriteria, profileObject, isHideAddButtonOnUserPanel ) {
    var workflowCtx = appCtxSvc.getCtx( 'workflow' );
    if( !additionalSearchCriteria ) {
        additionalSearchCriteria = {};
    }
    if( workflowCtx ) {
        workflowCtx.additionalSearchCriteria = additionalSearchCriteria;
        workflowCtx.selectionModelMode = selectionMode;
        workflowCtx.profileObject = profileObject;
        workflowCtx.loadProjectData = true;
        workflowCtx.isHideAddButtonOnUserPanel = isHideAddButtonOnUserPanel;
    } else {
        var context = {
            selectionModelMode: selectionMode,
            additionalSearchCriteria: additionalSearchCriteria,
            profileObject: profileObject,
            isHideAddButtonOnUserPanel : isHideAddButtonOnUserPanel,
            loadProjectData : true
        };
        appCtxSvc.registerCtx( 'workflow', context );
    }
};

/**
  * Get the applied filters in sequence for category project_list and
  * then get the applied project id.
  *

  * @param {Object} baseActiveFiltersStructure Applied filters object

  * @returns {Array} Applied project filter array
  */
var _getSelectedProjectFilters = function( baseActiveFiltersStructure ) {
    var selectedProjectIds = [];

    // Check if applied filter structure is null or activeFilterMap is null then
    // we need to return empty array from here and no need to process further.


    if( !baseActiveFiltersStructure || !baseActiveFiltersStructure.activeFilterMap ) {
        return selectedProjectIds;
    }


    // Get the active filters map and get all project ids in sequence and return
    // that project id array.
    var activeFilterMap = baseActiveFiltersStructure.activeFilterMap;
    for( const [ categoryKey, categoryValue ] of Object.entries( activeFilterMap ) ) {
        if( _.endsWith( categoryKey, '.project_list' ) ) {
            let immutableFilterMapValues = categoryValue.map( a => a.stringValue );
            selectedProjectIds = immutableFilterMapValues;
        }
    }

    return selectedProjectIds;
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
  * Based on inout selected users along with assignment data and then
  * populate the valid users that need to be added.
  * @param {Array} selection Selected users array
  * @param {Object} assignmentData Assignment data object that contains the map
  * for selected users with corresponding project or get the default group memeber
  * associated with user object.
  * @returns {Array} Valid selected users array
  */
var _getValidSelectionObjects = function( selection, assignmentData ) {
    var currentSelections = [];
    _.forEach( selection, function( selObject ) {
        var projectObject = null;
        var assignObject = selObject;
        // Check if assignment data object is not null then based on input
        // user, check if project mapping present then get that project object
        // and then will be set on user object so it can be used for assignee origin.
        if( assignmentData ) {
            var projectUidObjects = assignmentData[selObject.uid ];
            if( projectUidObjects && projectUidObjects[ 0 ] ) {
                projectObject = soa_kernel_clientDataModel.getObject( projectUidObjects[ 0 ] );
            }
        }

        // Check if input user object is of type user then we need to get
        // default group member and then use that group member.
        if( isOfType( assignObject, 'User' ) ) {
            var userId = _getPropValue( assignObject, 'user_id' );
            var groupMemberUidObjects = assignmentData[ userId ];
            if( groupMemberUidObjects && groupMemberUidObjects[ 0 ] ) {
                assignObject = soa_kernel_clientDataModel.getObject( groupMemberUidObjects[ 0 ] );
            }
        }
        var vmObject = null;
        // Create the view model object from valid assign object( User, GroupMember,ResourcePool)
        if( assignObject && assignObject.uid ) {
            vmObject = viewModelObjSvc.createViewModelObject( assignObject.uid );
        }


        if( vmObject ) {
            // If object object is not null then we set it on view model object.
            if( projectObject ) {
                vmObject.projectObject = projectObject;
            }
            // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
            // resource pools added to one aw-list component then because of uid check in component, there
            // is one issue to render it correctly. So to handle it we update the uid with some random number
            // to make it unique and then added uniqueUid to contain the original UID for resource pool.
            if( isOfType( vmObject, 'ResourcePool' ) ) {
                vmObject.uniqueUid = vmObject.uid;
                vmObject.uid += Math.random();
            }

            currentSelections.push( vmObject );
        }
    } );
    return currentSelections;
};

/**
  * Get the valid selected obejct from input selected objects. If input selection
  * has user obejct then it will get group memebr from user otherwise directly return input.
  *
  * @param {data} searchCriteria - The qualified data of the viewModel
  * @param {Array} selection - The selection object array
  * @param {Object} baseActiveFiltersStructure Base active filter structures that will hold applied active filters info.
  *
  * @return {Object} - userInput object that holds the correct values .
  */
export let getValidObjectsToAdd = function( searchCriteria, selection, baseActiveFiltersStructure ) {
    var deferred = AwPromiseService.instance.defer();
    var selectedProjectIds = _getSelectedProjectFilters( baseActiveFiltersStructure );
    var additionalData = {
        User: [],
        GroupMember: [],
        ResourcePool: [],
        project_ids: [],
        profile_group_name:[],
        profile_role_name:[]
    };
    // Check for all user objects and then check for individual
    // object type and then add to specific list
    if( selection && !_.isEmpty( selection ) ) {
        _.forEach( selection, function( selObject ) {
            if( isOfType( selObject, 'User' ) ) {
                additionalData.User.push( selObject.uid );
            } else if( isOfType( selObject, 'GroupMember' ) ) {
                additionalData.GroupMember.push( selObject.uid );
            } else if( isOfType( selObject, 'ResourcePool' ) ) {
                additionalData.ResourcePool.push( selObject.uid );
            }
        } );
    }
    // Check if project filter is selected or not.
    if( selectedProjectIds && !_.isEmpty( selectedProjectIds ) ) {
        additionalData.project_ids =  selectedProjectIds;
    }
    var isSOACallNeeded = true;
    if ( searchCriteria.group ) {
        additionalData.profile_group_name.push( searchCriteria.group );
    }
    if ( searchCriteria.role ) {
        additionalData.profile_role_name.push( searchCriteria.role );
    }

    // Check if user object is not selected from people picker panel and project
    // filter is not applied then only we don't need to call SOA else SOA needs
    // to be called to get the correct corresponding project or default group member.
    if( _.isEmpty( additionalData.User ) && _.isEmpty( additionalData.project_ids ) ) {
        isSOACallNeeded = false;
    }

    // If SOA call is need then only we need to make SOA call else directly return
    // the input selection as it is.
    if( isSOACallNeeded ) {
        var soaInput = {
            inData: [ {
                operationMode: 100,
                clientId: 'getAssignmentData',
                additionalData: additionalData
            } ]
        };
        soaService.postUnchecked( 'Internal-Workflowaw-2020-12-Workflow', 'getWorkflowTaskAssignments', soaInput ).then( function( response ) {
            // Check if in response additional data is present then use that to get the correct project
            // or default group member for user object.
            if( response && response.output && response.output[ 0 ] && response.output[ 0 ].additionalData ) {
                var assignmentsData = response.output[ 0 ].additionalData;
                return deferred.resolve( _getValidSelectionObjects( selection, assignmentsData ) );
            }
            return deferred.resolve( _getValidSelectionObjects( [], null ) );
        } );
    } else {
        deferred.resolve( _getValidSelectionObjects( selection, null ) );
    }
    return deferred.promise;
};

/**
  * Get the assignment type string based on input target object. This is only called for drag and drop on table.
  *
  * @param {Object} targetObject Target obejct for assignemnt type need to fetch
  * @param {Object} taskInfoObject Task info object context object that
  * @returns {String} assignment type string
  */
export let getAssignmentTypeBasedOnTarget = function( targetObject, taskInfoObject ) {
    var assignmentType = 'assignee';

    // Check if input object is not EPMTask or EPMTaskTemplate then use the input object assignment type directly
    if( targetObject && !isOfType( targetObject, 'EPMTask' ) && !isOfType( targetObject, 'EPMTaskTemplate' )  && targetObject.assignmentType ) {
        return targetObject.assignmentType;
    }
    // Check if target is invalid or child object is not present then use assignee as assignment type. This is only for safety
    // and actually shoul dnot happen.
    if( !targetObject || !targetObject._childObj ) {
        return assignmentType;
    }

    var taskObject = targetObject._childObj;
    // Check if assignment object is not null on target object and it contains internal name as well
    // that means it's DP case so return the DP name from here. Task is single user task only then only we need to
    // return it else consider as adhoc singoff.
    if( _multiUserTasks.indexOf( taskObject.type ) <= -1  && targetObject.assignmentObject && targetObject.assignmentObject.internalName ) {
        return targetObject.assignmentObject.internalName;
    }

    if( isOfType( taskObject, 'EPMReviewTask' ) || isOfType( taskObject, 'EPMReviewTaskTemplate' )
     || isOfType( taskObject, 'EPMRouteTask' ) || isOfType( taskObject, 'EPMRouteTaskTemplate' ) ) {
        assignmentType = 'reviewers';

        // In case of reviewers assignment type check if taskInfoObject present and it has profile
        // as well then in that case we need to add drop assignment as additional reviewers and
        // then taskInfoObject will only be present when user is dropping on same task for info
        // is shown in category panel else this will be null and not used
        if( taskInfoObject && taskInfoObject.props && taskInfoObject.props.reviewers &&
             taskInfoObject.props.reviewers.isProfileExist ) {
            assignmentType = 'additionalReviewers';
        }
    }
    if( isOfType( taskObject, 'EPMAcknowledgeTask' ) || isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        assignmentType = 'acknowledgers';
    }
    return assignmentType;
};

/**
  * Get the error message string from SOA response that will be displayed to user
  * @param {Object} response - The SOA response object
  *
  * @return {Object} Error message string
  */
export let getErrorMessage = function( response ) {
    var err = null;
    var message = ''; // Check if input response is not null and contains partial errors then only
    // create the error object

    if( response && ( response.ServiceData.partialErrors || response.ServiceData.PartialErrors ) ) {
        err = soaService.createError( response.ServiceData );
    } // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user

    if( err && err.cause && err.cause.partialErrors ) {
        _.forEach( err.cause.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                for( var idx = 0; idx < partErr.errorValues.length; idx++ ) {
                    var errVal = partErr.errorValues[ idx ];

                    if( errVal.code ) {
                        // Ignore the duplicate error and related error to that
                        if( errVal.code === 35010 ) {
                            break;
                        } else {
                            if( message && message.length > 0 ) {
                                message += '\n' + errVal.message;
                            } else {
                                message += errVal.message;
                            }
                        }
                    }
                }
            }
        } );
    }

    return message;
};

/**
  * Create the empty structure for a property that need to be used to render task category panel.
  *
  * @param {String} propName Property name string.
  * @param {String} selectionModelMode Selection mode for that property
  * @returns {Object} Object that will return property name and selction mode and existing objects
  *         so that it can be used to render task specific category panel.
  */
var _createEmptyPropObject = function( propName, selectionModelMode ) {
    return {
        propName: propName,
        modelObjects : [],
        selectionModelMode : selectionModelMode
    };
};

/**
  * gets local text bundle
  * @returns {Object} text bundle
  */
var _getLocalTextBundle = function() {
    var resource = '/i18n/WorkflowCommandPanelsMessages.json';
    return localeSvc.getLoadedText( resource );
};

/**
  * Create and returns empty task assignment data that hold all assignment information.
  *
  * @returns {Object} Assignemnt data object that hold all assignment information
  */
var _createEmptyTaskDataStructure = function() {
    return {
        internalName : null,
        selectionMode: 'single',
        isRequired : false,
        taskAssignment : null,
        assignmentOrigin: null,
        assignmentType : null,
        signoffProfile : null
    };
};

/**
  * Populate the profile objects which are not fully staffed and need to be shown.
  *
  * @param {String} taskUid Task UID string
  * @param {Array} taskProfiles Task profile array
  * @param {Array} modelObjects Existing objects that can be profile reviewers .
  * @param {String} propName Property name string.
  * @returns {Object} Object that will hold profiles which are not fully staffed.
  */
var _populateUnstaffedProfileRows = function( taskUid, taskProfiles, modelObjects, propName ) {
    if( !taskProfiles || taskProfiles.length <= 0 ) {
        return modelObjects;
    }
    var taskObject = soa_kernel_clientDataModel.getObject( taskUid );
    var isValidPropToProcess = false;

    if(  ( isOfType( taskObject, 'EPMReviewTask' ) || isOfType( taskObject, 'EPMRouteTask' )
     || isOfType( taskObject, 'EPMReviewTaskTemplate' ) || isOfType( taskObject, 'EPMRouteTaskTemplate' ) ) && propName === 'reviewers'
     || ( isOfType( taskObject, 'EPMAcknowledgeTask' ) || isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) ) && propName === 'acknowledgers' ) {
        isValidPropToProcess = true;
    }

    if( !isValidPropToProcess ) {
        return modelObjects;
    }

    var profileObjects = _.cloneDeep( taskProfiles );
    _.forEach( modelObjects, function( modelObject ) {
        var profileObject = _.find( profileObjects, function( profile ) {
            return modelObject.signoffProfile && modelObject.signoffProfile.uid === profile.uid;
        } );
        // Check if VMO is not null then only get the required number of reviewers
        // and then reduce the count.
        if( profileObject ) {
            var noRequiredReviewers = 0;
            var splitArray = [];
            if( profileObject.requiredReviewers ) {
                splitArray = profileObject.requiredReviewers.split( ' ' );
                if( splitArray && splitArray[ 0 ] && splitArray[ 1 ] ) {
                    noRequiredReviewers = parseInt( splitArray[ 0 ] );
                }
            }

            noRequiredReviewers--;
            if( noRequiredReviewers < 0 ) {
                return null;
            }
            profileObject.requiredReviewers = noRequiredReviewers + ' ' + splitArray[ 1 ];
        }
    } );
    var rowObjects = [];
    var localeTextBundle = _getLocalTextBundle();

    _.forEach( profileObjects, function( profileVMO ) {
        //var displayValue = localeTextBundle.unAssingedFrom;
        // Check if VMO is not null then only get the required number of reviewers
        // and then reduce the count.
        if( profileVMO ) {
            var noRequiredReviewers = 0;
            if( profileVMO.requiredReviewers ) {
                noRequiredReviewers = parseInt( profileVMO.requiredReviewers.split( ' ' ) );
            }
            if( noRequiredReviewers > 0 ) {
                var modelObject = viewModelObjSvc.constructViewModelObjectFromModelObject( null, '' );
                modelObject.uid = 'unstaffedUID';
                var displayValue = profileVMO.groupRoleName + '/' + noRequiredReviewers;
                displayValue = messagingSvc.applyMessageParamsWithoutContext( localeTextBundle.unAssingedFrom, [ displayValue ] );
                modelObject.props = {
                    object_string : {
                        uiValues : [ displayValue ]
                    }
                };
                if( modelObject ) {
                    var profileAssignmentObject = _createEmptyTaskDataStructure();
                    profileAssignmentObject.taskAssignment = modelObject;
                    profileAssignmentObject.assignmentOrigin = null;
                    profileAssignmentObject.assignmentType = propName;
                    profileAssignmentObject.signoffProfile = profileVMO;
                    profileAssignmentObject.isRequired = true;
                    profileAssignmentObject.isProfileAssignment = true;
                    rowObjects.push( profileAssignmentObject );
                }
            }
        }
    } );
    Array.prototype.push.apply( rowObjects, modelObjects );
    return rowObjects;
};

/**
  * Merge the proeprty that has normal assignment and PAL assignment and merge it to
  * input main proerpty value.
  *
  * @param {Object} prop Property object that need to be populated
  * @param {Object} palProp Proeprty obejct that contains nformation coming from PAL
  * @param {String} propName Property name
  *
  */
var _mergePropData = function(  prop, palProp, propName ) {
    if( palProp && propName === 'assignee' && palProp.modelObjects && palProp.modelObjects.length > 0 ) {
        prop.modelObjects = palProp.modelObjects;
    } else if( palProp && propName !== 'assignee'  && palProp.modelObjects ) {
        Array.prototype.push.apply( prop.modelObjects, palProp.modelObjects );
    }
};

/**
  * Get task specific DP data and populate the table
  * @param {Object} prop Property object that need to be populated
  * @param {String} propName Property name
  * @param {Object} participantInfoMap Participant info map object that contians all DP's data
  */
var _mergeDPData = function( prop, propName, participantInfoMap ) {
    var suuportedDPTypes = prop.supportedDPTypes;
    if( suuportedDPTypes && suuportedDPTypes.length > 0 ) {
        _.forEach( suuportedDPTypes, function( dpType ) {
            if( participantInfoMap.hasOwnProperty( dpType ) ) {
                var participantObjects = participantInfoMap[ dpType ].assignees;
                if( propName === 'assignee' ) {
                    prop.modelObjects = [];
                }

                _.forEach( participantObjects, function( participantObj ) {
                    var existingParticipant = _.cloneDeep( participantObj );
                    existingParticipant.assignmentType = propName;
                    prop.modelObjects.push( existingParticipant );
                } );
            }
        } );
    }
};

/**
  * This method check if both input objects are resource pool object then only it will return
  * true else it will return false.
  * @param {Object} objectA First input object
  * @param {Object} objectB Second input object
  * @returns {boolean} True/False
  */
var _isDuplicateResourcePoolObjects = function( objectA, objectB ) {
    if( isOfType( objectA, 'ResourcePool' ) && isOfType( objectB, 'ResourcePool' ) ) {
        return true;
    }
    return false;
};

/**
  * Get the unassigned VMO  object that will indicate that respective DP or unassigend profile , that is not assigend yet.
  *
  * @param {String} displayName Display value that need to be object string for unstaff VMO object
  *
  * @returns {Object} Unassiged DP object
  */
var _getUnStaffedVMOObject = function( displayName ) {
    var localeTextBundle = _getLocalTextBundle();
    var modelObject = viewModelObjSvc.constructViewModelObjectFromModelObject( null, '' );
    modelObject.uid = 'unstaffedUID';
    // Check if display name is not valid then show the empty display name
    if( !displayName ) {
        displayName = localeTextBundle.unAssigned;
    }
    modelObject.props = {
        object_string : {
            uiValues : [ displayName ]
        }
    };
    return modelObject;
};

/**
  * Get the task info object based on input UID and get the all assignment info for that object and return.
  * @param {String} taskUid Task UID for info need to be populated
  * @param {Object} taskInfoObject Task info object that will hold info for differnt properties for tas.
  * @param {Object} palInfoMap Map that will hold assignments coming from PAL
  * @param {Object} participantInfoMap Participant assignmetn map
  * @param {boolean} isTableTaskData True/False based on table data need to be populared or not
  * @returns {Object} Updated task info object.
  *
  */
export let getTaskAssignmentData = function( taskUid, taskInfoObject, palInfoMap, participantInfoMap, isTableTaskData ) {
    var taskInfoObject = _.cloneDeep( taskInfoObject );
    if( !taskUid || !taskInfoObject ) {
        return taskInfoObject;
    }

    var taskObject = soa_kernel_clientDataModel.getObject( taskUid );
    var isTaskCompleted = exports.isTaskCompleted( taskObject );
    for( var propName in taskInfoObject.props ) {
        if( taskInfoObject.props.hasOwnProperty( propName ) ) {
            var isPalDataExist = false;
            if( !isTaskCompleted ) {
                for( var palKey in palInfoMap ) {
                    var palProp = null;
                    isPalDataExist = true;
                    var map = palInfoMap[ palKey ];

                    var palTaskInfoObject = map[ taskUid ];

                    if( palTaskInfoObject ) {
                        palProp = _.cloneDeep( palTaskInfoObject.props[ propName ] );
                    }
                    _mergePropData(  taskInfoObject.props[ propName ], palProp, propName );
                }
            }

            if( !isPalDataExist ) {
                _mergePropData( taskInfoObject.props[ propName ], null, propName );
            }

            var modelObjects = taskInfoObject.props[ propName ].modelObjects;
            // Remove the duplicates if present in presetObjects list. If duplicate resource pool
            // present then it should not filter it out.
            if( modelObjects && modelObjects.length > 1 ) {
                modelObjects = _.uniqWith( modelObjects, function( objA, objB ) {
                    return objA.taskAssignment.uid === objB.taskAssignment.uid && !_isDuplicateResourcePoolObjects( objA.taskAssignment, objB.taskAssignment );
                } );
                taskInfoObject.props[ propName ].modelObjects = modelObjects;
            }

            if( propName !== 'assignee' && isTableTaskData ) {
                taskInfoObject.props[ propName ].modelObjects = _populateUnstaffedProfileRows( taskUid, taskInfoObject.taskProfiles, taskInfoObject.props[ propName ].modelObjects, propName );
            }
            _mergeDPData( taskInfoObject.props[ propName ],  propName, participantInfoMap );


            if( propName === 'assignee' && isTableTaskData && taskInfoObject.props.assignee.modelObjects
             && taskInfoObject.props.assignee.modelObjects.length <= 0 && taskObject &&  _multiUserTasks.indexOf( taskObject.type ) <= -1  ) {
                var assigneeVMO = _getUnStaffedVMOObject();
                taskInfoObject.props[ propName ].modelObjects = [ assigneeVMO ];
            }
        }
    }
    return taskInfoObject;
};


/**
  * Populate the DP key roles in input data provider to indicate that this property is using this specifc
  * DP as an assignment.
  *
  * @param {Object} dataProvider Data provider object whe DP key role need to be added
  * @param {Array} supportedDPTypes Supported DP types string array for that specific assignment type
  */
var _populateDPKeyRoles = function( modelObjects, supportedDPTypes, selectionBasedParticipants ) {
    const localModelObjects = _.clone( modelObjects );
    if( !supportedDPTypes || supportedDPTypes.length <= 0 ) {
        return modelObjects;
    }
    var keyRoleDPObjects = [];
    _.forEach( supportedDPTypes, function( dpType ) {
        var taskDPParticipant = _.find( selectionBasedParticipants, {
            internalName: dpType
        } );
        if( taskDPParticipant && taskDPParticipant.displayName ) {
            var keyRole = exports.createKeyRoleObject( dpType, taskDPParticipant.displayName );
            if( keyRole ) {
                keyRole.selectionModelMode = taskDPParticipant.selectionMode;
                keyRole.participant_eligibility = taskDPParticipant.participant_eligibility;
                keyRoleDPObjects.push( keyRole );
            }
        }
    } );
    if( keyRoleDPObjects && keyRoleDPObjects.length > 0 ) {
        Array.prototype.push.apply( localModelObjects, keyRoleDPObjects );
    }
    return localModelObjects;
};

/**
  * Populate the assignee objects for specific task.
  *
  * @param {Object} taskInfoObject Task info object
  * @param {Array} selectionBasedParticipants Selection based supported participants
  * @returns {Array} Assignee objects that need to be shown in assignee section.
  */
var _populateTaskAssigneeInfo = function( taskInfoObject, selectionBasedParticipants ) {
    var assigneeObjects = exports.getDisplayedAssignmentObjects( taskInfoObject.props.assignee.modelObjects );
    var dpAssigneeObjects = _populateDPKeyRoles( [], taskInfoObject.props.assignee.supportedDPTypes, selectionBasedParticipants );
    if( dpAssigneeObjects && !_.isEmpty( dpAssigneeObjects ) ) {
        assigneeObjects = dpAssigneeObjects;
    }
    return assigneeObjects;
};


/**
  * Get the assignment objects that will be displayed in category panel.
  *
  * @param {Array} modelObjects Object array that need to be converted so that it can be shown in
  *        task specific category panel.
  * @returns {Array} Model objects that will be rendered in category panel.
  *
  */
export let getDisplayedAssignmentObjects = function( modelObjects ) {
    var assignmentObjects = [];
    if( modelObjects && modelObjects.length > 0 ) {
        _.forEach( modelObjects, function( modelObject ) {
            var assignmentObject = null;
            if( modelObject && modelObject.taskAssignment && !modelObject.internalName ) {
                assignmentObject = _.cloneDeep( modelObject );
                modelObject = modelObject.taskAssignment;
            }
            // If modelObject is not null then only set selected to false and add to data provider
            if( modelObject && modelObject.uid && modelObject.uid !== _UNSTAFFED_UID  ) {
                modelObject.selected = false;

                // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                if( isOfType( modelObject, 'ResourcePool' ) && !modelObject.uniqueUid ) {
                    modelObject.uniqueUid = _.clone( modelObject.uid );
                    modelObject.uid += Math.random();
                }

                if( _.isUndefined( modelObject.assignmentObject ) || !modelObject.assignmentObject ) {
                    modelObject.assignmentObject = assignmentObject;
                }
                assignmentObjects.push( modelObject );
            }
        } );
    }
    return assignmentObjects;
};

/**
   * Update the profile required reviewers count based on viewer is being added. If profile
   * required reviewers count becomes 0 then return null profile from here so that reviewer can be
   * added to adhoc list.
   *
   * @param {String} profileUid Profile obejct Uid that need to be search in input profile
   * list.
   * @param {Array} profileObjects Profile Objects that need to be added/removed
   * @returns {object} Profile object
   */
var _updateProfileRequiredReviewers = function( profileUid, profileObjects ) {
    // Check if profile obejct array is null or empty then return from here
    if( !profileObjects || profileObjects.length <= 0 ) {
        return null;
    }

    var profileVMO = _.find( profileObjects, function( profile ) {
        return profile.uid === profileUid;
    } );

    // Check if VMO is not null then only get the required number of reviewers
    // and then reduce the count.
    if( profileVMO ) {
        var noRequiredReviewers = 0;
        var splitArray = [];
        if( profileVMO.requiredReviewers ) {
            splitArray = profileVMO.requiredReviewers.split( ' ' );
            if( splitArray && splitArray[ 0 ] && splitArray[ 1 ] ) {
                noRequiredReviewers = parseInt( splitArray[ 0 ] );

                noRequiredReviewers--;
                if( noRequiredReviewers < 0 ) {
                    return null;
                }
                profileVMO.requiredReviewers = noRequiredReviewers + ' ' + splitArray[ 1 ];
                return profileVMO;
            }
        }
    }
    return null;
};

/**
  * Populate profile users and adhoc users and populate to respective data provider
  *
  * @param {Array} profileObjects Profile Objects that need to be added or profile reviewers
  *  need to be added
  * @param {Array} reviewersObjects Objects that need to be added
  *
  * @returns {Object} Profile and adhoc reviewer obejcts
  */
var _populateProfileAndAdhocReviewers = function( profileObjects, reviewersObjects ) {
    var reviewers = [];
    var additionalReviewers = [];
    var isProfileExist = false;

    // Check if profile object is not null and not empty then set the flag
    // to true and get the 0th index profile object and set to one variable.
    if( profileObjects && profileObjects.length > 0 ) {
        isProfileExist = true;
        Array.prototype.push.apply( reviewers, profileObjects );
    }

    _.forEach( reviewersObjects, function( reviewer ) {
        var profileObject = reviewer.signoffProfile;

        if( reviewer && reviewer.taskAssignment && ( !reviewer.internalName && reviewer.taskAssignment.uid !== _UNSTAFFED_UID ) ) {
            var assignmentObject = _.cloneDeep( reviewer );
            var reviewerObject = reviewer.taskAssignment;
            reviewerObject.assignmentObject = assignmentObject;

            // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
            // resource pools added to one aw-list component then because of uid check in component, there
            // is one issue to render it correctly. So to handle it we update the uid with some random number
            // to make it unique and then added uniqueUid to contain the original UID for resource pool.
            if( isOfType( reviewerObject, 'ResourcePool' ) && !reviewerObject.uniqueUid ) {
                reviewerObject.uniqueUid = _.clone( reviewerObject.uid );
                reviewerObject.uid += Math.random();
            }

            // Check if profile object is not null then only update the profile required reviewers count
            if( profileObject ) {
                profileObject = _updateProfileRequiredReviewers( profileObject.uid, profileObjects );
                reviewerObject.signoffProfile = profileObject;
            }

            // Add the data to respective list based on profile existence
            reviewerObject.selected = false;
            if( profileObject || !isProfileExist ) {
                reviewers.push( reviewerObject );
            } else {
                if( !isOfType( reviewerObject, 'EPMSignoffProfile' ) ) {
                    additionalReviewers.push( reviewerObject );
                }
            }
        }
    } );

    return {
        reviewers : reviewers,
        additionalReviewers : additionalReviewers,
        isProfileExist : isProfileExist
    };
};

/**
  * Get the assignment objects that will be displayed in particiapnt specific category panel.
  *
  * @param {Array} modelObjects Object array that need to be converted so that it can be shown in
  *        task specific category panel.
  * @returns {Array} Model objects that will be rendered in category panel.
  *
  */
export let getDisplayedParticipantAssignmentObjects = function( modelObjects ) {
    var assignmentObjects = [];
    if( modelObjects && modelObjects.length > 0 ) {
        _.forEach( modelObjects, function( modelObject ) {
            var assignmentObject = null;
            if( modelObject && modelObject.taskAssignment ) {
                assignmentObject = _.cloneDeep( modelObject );
                modelObject = modelObject.taskAssignment;
            }
            // If modelObject is not null then only set selected to false and add to data provider
            if( modelObject && modelObject.uid && modelObject.uid !== _UNSTAFFED_UID  ) {
                modelObject.selected = false;

                // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                if( isOfType( modelObject, 'ResourcePool' ) && !modelObject.uniqueUid ) {
                    modelObject.uniqueUid = _.clone( modelObject.uid );
                    modelObject.uid += Math.random();
                }

                if( _.isUndefined( modelObject.assignmentObject ) || !modelObject.assignmentObject ) {
                    modelObject.assignmentObject = assignmentObject;
                }
                assignmentObjects.push( modelObject );
            }
        } );
    }
    return assignmentObjects;
};


/**
  * Populate the participant map that will hold type along with model objects that can be displayed
  * in participant category.
  * @param {Object} participantMap Participant map
  * @returns {Object} Updated particiapnt map that will hold objects that can be displayed
  *          directly in task category panel.
  */
var _populateParticipantMap = function( participantMap ) {
    var localParticipantMap = { ...participantMap };
    for( var participantType in participantMap ) {
        var participantObject = localParticipantMap[ participantType ];
        var assigneeObjects = exports.getDisplayedParticipantAssignmentObjects( participantObject.assignees );
        participantObject.assignees = assigneeObjects;
    }
    return localParticipantMap;
};

/**
   * Get the object uids array based on input model object array.
   * @param {Array} modelObjects Model objects array
   * @returns {Array} Object Uids array based on input array
   */
var _getObjectsUidList = function( modelObjects ) {
    var objectUids = [];
    if( modelObjects && !_.isEmpty( modelObjects ) ) {
        _.forEach( modelObjects, function( modelObject ) {
            if( modelObject && modelObject.uid ) {
                objectUids.push( modelObject.uid );
            }
        } );
    }
    return objectUids;
};

/**
  *
  * @param {Object} taskObject Selected task object from table.
  * @param {Object} taskAssignmentDataObject Task assignment data object.
  * @param {Object} assignmentData Context object that will be updated to show
  *         task specific assignments.
  * @returns {Object} Updated assignment data context object that will show task category assignments.
  */
export let populateTaskAssignmentInfo = function( taskObject, taskAssignmentDataObject, assignmentData ) {
    var assignee = _createEmptyPropObject( 'assignee', 'single' );
    var reviewers = _createEmptyPropObject( 'reviewers', 'multiple' );
    var additionalReviewers = _createEmptyPropObject( 'additionalReviewers', 'multiple' );
    var acknowledgers = _createEmptyPropObject( 'acknowledgers', 'multiple' );
    var notifyees = _createEmptyPropObject( 'notifyees', 'multiple' );

    if( taskObject && taskObject.uid && taskAssignmentDataObject ) {
        var taskAssignmentObject = _.cloneDeep( taskAssignmentDataObject );
        var participantMap = taskAssignmentObject.participantInfoMap;
        var palInfoMap = taskAssignmentObject.palInfoMap;
        var taskInfoMap = taskAssignmentObject.taskInfoMap;
        var taskUid = taskObject.uid;

        var localParticipantMap = _populateParticipantMap( participantMap );

        //var taskObject = clientDataModel.getObject( taskUid );
        // Get the task assignment information
        var taskInfoObject = exports.getTaskAssignmentData( taskUid, taskInfoMap[ taskUid ], palInfoMap, participantMap );
        if( !taskInfoObject ) {
            taskInfoObject = {};
        }

        var selectionBasedParticipants = taskInfoObject.taskDeferredParticipantsTypes;
        // var assigneeObjects = taskInfoObject.props.assignee.modelObjects;
        // assigneeObjects = _populateDPKeyRoles( assigneeObjects, taskInfoObject.props.assignee.supportedDPTypes, selectionBasedParticipants);
        assignee.modelObjects = _populateTaskAssigneeInfo( taskInfoObject, selectionBasedParticipants );
        assignee.updateUids = _getObjectsUidList( assignee.modelObjects );
        assignee.isAssigneeInfoPresent = assignee?.updateUids?.length;

        assignee.supportedDPTypes = taskInfoObject.props.assignee.supportedDPTypes;
        var reviewersList = taskInfoObject.props.reviewers.modelObjects;
        var acknowledgersList = taskInfoObject.props.acknowledgers.modelObjects;

        var reviewProfiles = taskInfoObject.taskProfiles;

        // Get the supported DP types if reviewer is using to show it on reviewers data provider
        // and if task or task template is acknowledge then we need to use DP for acknowledeg task
        // and those will be shown in reviewers section on panel
        var reviewerSupportedDPTypes = taskInfoObject.props.reviewers.supportedDPTypes;
        var reviewerPropName = 'reviewers';
        // If selected task template is EPMAcknowledgeTaskTemplate then we show
        // acknoledgers in reviewers and additional reviewers sections and while saving
        // it will save in acknowledgers section
        if( isOfType( taskObject, 'EPMAcknowledgeTask' ) || isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) ) {
            Array.prototype.push.apply(reviewersList,acknowledgersList);
            reviewerSupportedDPTypes = taskInfoObject.props.acknowledgers.supportedDPTypes;
            taskInfoObject.props.acknowledgers.modelObjects = [];
        }

        var reviewerObject = _populateProfileAndAdhocReviewers( reviewProfiles, reviewersList );
        if( reviewerObject && reviewerObject.isProfileExist ) {
            reviewers.isProfileExist = reviewerObject.isProfileExist;
            reviewers.modelObjects = reviewerObject.reviewers;
            reviewers.profileObjects = reviewProfiles;
            additionalReviewers.modelObjects = _populateDPKeyRoles( reviewerObject.additionalReviewers, reviewerSupportedDPTypes, selectionBasedParticipants );
            additionalReviewers.supportedDPTypes = reviewerSupportedDPTypes;
        } else if( reviewerObject ) {
            var adhocReviewers = _populateDPKeyRoles( reviewerObject.reviewers, reviewerSupportedDPTypes, selectionBasedParticipants );
            reviewers.modelObjects = adhocReviewers;
            reviewers.supportedDPTypes = reviewerSupportedDPTypes;
        }
        reviewers.updateUids = _getObjectsUidList( reviewers.modelObjects );
        additionalReviewers.updateUids = _getObjectsUidList( additionalReviewers.modelObjects );


        var acknowledegReviewers = exports.getDisplayedAssignmentObjects( taskInfoObject.props.acknowledgers.modelObjects );
        var acknowledgeKeyRoles = _populateDPKeyRoles( [],  taskInfoObject.props.acknowledgers.supportedDPTypes, selectionBasedParticipants );
        Array.prototype.push.apply( acknowledegReviewers, acknowledgeKeyRoles );

        acknowledgers.modelObjects = acknowledegReviewers;
        acknowledgers.supportedDPTypes = taskInfoObject.props.acknowledgers.supportedDPTypes;
        acknowledgers.updateUids = _getObjectsUidList( acknowledgers.modelObjects );


        var notifyReviewers = exports.getDisplayedAssignmentObjects( taskInfoObject.props.notifyees.modelObjects );
        var notifyKeyRoles = _populateDPKeyRoles( [],  taskInfoObject.props.notifyees.supportedDPTypes, selectionBasedParticipants );
        Array.prototype.push.apply( notifyReviewers, notifyKeyRoles );

        notifyees.modelObjects = notifyReviewers;
        notifyees.supportedDPTypes = taskInfoObject.props.notifyees.supportedDPTypes;
        notifyees.updateUids = _getObjectsUidList( notifyees.modelObjects );
    }

    if( assignmentData  ) {
        var localContext = { ...assignmentData };
        localContext.props = {};
        localContext.props.assignee = assignee;
        localContext.props.reviewers = reviewers;
        localContext.props.additionalReviewers = additionalReviewers;
        localContext.props.acknowledgers = acknowledgers;
        localContext.props.notifyees = notifyees;
        // Check input task object is null or not contain the valid uid that means there is not
        // selected task object. So set the task object as null in that case
        if( !taskObject || !taskObject.uid ) {
            taskObject = null;
        }
        localContext.taskObject = taskObject;

        // Set this updatedPropertyObject as null initialy as when user do add or remove operation
        // then only it will have some value and parent component can use it.
        //localContext.updatePropContext = null;
        var participantSectionObjects = [];
        // Iterate for all participant object specific task supports and based on that
        // populate one participant object that will store participant internal name,
        // display name along with selection mode and existing objects that participant already have.
        if( selectionBasedParticipants && !_.isEmpty( selectionBasedParticipants ) ) {
            _.forEach( selectionBasedParticipants, function( participant ) {
                var participantObject = {
                    internalName : participant.internalName,
                    displayName : participant.displayName,
                    selectionModelMode : participant.selectionMode,
                    isParticipantProp: true,
                    modelObjects : localParticipantMap[ participant.internalName ].assignees
                };
                participantSectionObjects.push( participantObject );
            } );
        }
        // Add that participant section object array to context object and return
        localContext.participantSectionObjects = participantSectionObjects;
        return localContext;
    }
    return assignmentData;
};

/**
  * Based on selection data, get the selected object from that and then update the
  * task assignment data so that it can be populate on the task category panel.
  *
  * @param {Object} selectionData Selection data object that hold the selection
  * @param {Object} taskAssignmentContext Object that hold tasks assignment information
  * @param {Object} assignmentData Context object that will be updated to show
  *         task specific assignments.
  * @returns {Object} Updated assignment data context object that will show task category assignments.
  */
export let handleTaskAssignmentRowSelection = function( selectionData, taskAssignmentContext, assignmentData ) {
    var taskObject = null;
    if( selectionData && selectionData.selected && selectionData.selected.length > 0  ) {
        var selectedObj = selectionData.selected[0];
        // Get the object that need to be selected
        if( selectedObj && selectedObj._childObj ) {
            taskObject = selectedObj._childObj;
        }
    }
    // Populate the specific task assignment info and return it
    return exports.populateTaskAssignmentInfo( taskObject, taskAssignmentContext, assignmentData );
};

export default exports = {
    createKeyRoleObject,
    getValidObjectForTaskAssignment,
    isTaskCompleted,
    isNarrowMode,
    registerUserPanelContext,
    isTaskAssignmentNonModified,
    getValidObjectsToAdd,
    getAssignmentTypeBasedOnTarget,
    getErrorMessage,
    populateTaskAssignmentInfo,
    getTaskAssignmentData,
    getDisplayedAssignmentObjects,
    getDisplayedParticipantAssignmentObjects,
    handleTaskAssignmentRowSelection
};
