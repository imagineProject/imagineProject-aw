// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowAssignmentPanelService
 */
import awp0TasksUtils from 'js/Awp0TasksUtils';
import viewModelService from 'js/viewModelObjectService';
import iconSvc from 'js/iconService';
import msgSvc from 'js/messagingService';
import workflowAssinmentUtilSvc from 'js/Awp0WorkflowAssignmentUtils';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';

/**
   * Define public API
   */
var exports = {};

var _addContextObject = null;
var _panelContext = null;
var _assigeeAssignmentOrigin = null;

var parentData = null;
var _GROUP_PROP_NAME = 'REF(group,Group).object_full_name';
var _ROLE_PROP_NAME = 'REF(role,Role).role_name';
var _UNSTAFFED_UID = 'unstaffedUID';

/**
   *
   * @param {Object} taskObject Task object for assignment panel is opened
   * @param {Object} taskInfoObject task info object which contains task assignment props
   * @param {Object} assignmentStateContext Assignment state context object that contains all tasks assignment info
   * @param {Object} namePropObject Task name property object
   * @param {Object} statusPropObject Status property object
   * @returns {Object} Object that contains updated task name and status property
   */
export let populatePanelData = function( taskObject, taskInfoObject, assignmentStateContext, namePropObject, statusPropObject  ) {
    // Check if task object is null or empty uid then no need to process further
    if( !taskObject || !taskObject.uid ) {
        return {
            nameProp : namePropObject,
            statusProp : statusPropObject,
            selectedOption : null
        };
    }
    // Update the name and status property object
    const nameProp = { ...namePropObject };
    if( taskObject.props && taskObject.props.object_string && taskObject.props.object_string.uiValue ) {
        nameProp.uiValue = taskObject.props.object_string.uiValue;
    }


    const statusProp = { ...statusPropObject };
    if( taskObject.props && taskObject.props.task_state && taskObject.props.task_state.uiValue ) {
        statusProp.uiValue = taskObject.props.task_state.uiValue;
    }

    const localAssignmentState = { ...assignmentStateContext.value };

    // Populate the specific task assignment info and update the context info and then update the respective properties
    if( localAssignmentState ) {
        var taskObjectInfo = workflowAssinmentUtilSvc.populateTaskAssignmentInfo( taskObject, localAssignmentState.taskAssignmentDataObject, {} );
        if( taskObjectInfo ) {
            taskObjectInfo.isPrivilegedToAssign = _.clone( localAssignmentState.isPrivilegedToAssign );
            taskInfoObject.update && taskInfoObject.update( taskObjectInfo );
        }
    }

    return {
        nameProp : nameProp,
        statusProp : statusProp,
        selectedOption : null
    };
};

/**
   * To show the unsave edit message to user when user modified some assignment on panel
   * but change the selection from table and panel is trying to update based on new selection.
   * This method will show the message and based on user action it will show cancelOperation
   * or saveOperation and accourdingly on these action it will process further action.
   *
   * @param {Object} taskObject Task object which has been modifeid
   * @param {Object} data Data view model object
   * @returns {Promise} Promise object
   */
export let showUnsaveEditMessageAction = function( taskObject, data ) {
    var deferred = AwPromiseService.instance.defer();
    var msg = data.i18n.panelModificationWarningMsg.replace( '{0}', taskObject );
    data.confirmDelete = '';
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.discard,
        onClick: function( $noty ) {
            $noty.close();
            deferred.resolve( 'cancelOperation' );
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.modify,
        onClick: function( $noty ) {
            $noty.close();
            deferred.resolve( 'saveOperation' );
        }
    } ];
    msgSvc.showWarning( msg, buttons );
    return deferred.promise;
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
   * Check if input object is not null and if type of Group Member then get the user
   * from group member and add into data provider else directly add to data provider.
   *
   * @param {Object} dataProvider data provider where object need to be added
   * @param {Object} selection Object that need to be added
   */
var _populateAssigneeDataProvider = function( dataProvider, selection ) {
    var assignerUsers = [];
    if( _.isArray( selection ) && selection[ 0 ] ) {
        selection = selection[ 0 ];
    }
    if( selection && selection.taskAssignment && selection.internalName ) {
        dataProvider.update( assignerUsers, assignerUsers.length );
        return;
    }
    var assignmentObject = null;
    if( selection.taskAssignment && selection.taskAssignment.uid !== _UNSTAFFED_UID ) {
        assignmentObject = _.cloneDeep( selection );
        selection = selection.taskAssignment;
    }
    // Check if assignment object is not null and it's persisted origin then we need to store
    // this origin for new assignee assignment as well so we store it here and will be used when
    // we add new assignee then set this there as assignmetn origin
    if( assignmentObject && assignmentObject.isPersistedOrigin ) {
        _assigeeAssignmentOrigin = assignmentObject;
    }

    if( isOfType( selection, 'GroupMember' ) && selection.uid ) {
        if( selection.props.user && selection.props.user.dbValues && selection.props.user.dbValues[ 0 ] ) {
            // Get the user object from group member
            var userObject = viewModelService.createViewModelObject( selection.props.user.dbValues[ 0 ] );
            if( userObject ) {
                userObject.selected = false;
                userObject.assigneeGroupMember = selection;
                if( selection.projectObject ) {
                    userObject.projectObject = selection.projectObject;
                }
                userObject.assignmentObject = assignmentObject;
                assignerUsers.push( userObject );
            }
        }
    } else {
        // If selection is not null then only set selected to false and add to data provider
        if( selection && selection.uid ) {
            selection.selected = false;
            selection.assignmentObject = assignmentObject;
            assignerUsers.push( selection );
        }
    }

    // This is mainly needed when we replace the assignee for one task and that assignee has origin
    // saved already we need to have save origin for new assignee as well.
    if( _assigeeAssignmentOrigin && _assigeeAssignmentOrigin.isPersistedOrigin && assignerUsers[ 0 ] &&
          !assignerUsers[ 0 ].assignmentObject ) {
        assignerUsers[ 0 ].assignmentObject = _assigeeAssignmentOrigin;
    }
    dataProvider.update( assignerUsers, assignerUsers.length );
};


var _getDummyModelObject = function( requiredString ) {
    var modelObject = viewModelService.constructViewModelObjectFromModelObject( null, '' );
    var iconURL = iconSvc.getTypeIconFileUrl( 'typePersonGray48.svg' );
    modelObject.typeIconURL = iconURL;
    // Check if input required string is null then get the value from locale service
    if( !requiredString ) {
        requiredString = localeSvc.getLoadedTextFromKey( 'WorkflowCommandPanelsMessages.required' );
    }
    modelObject.requiredDispValue = requiredString;
    return modelObject;
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
   * Validate if users is trying to add group member then that group member should not already
   * present in same or differnet data provider.
   * @param {Array} existingObjects Existing objects that are already present.
   * @param {Array} selectedObjects Objects that need to be added and need validation
   * @param {boolean} isGroupMemberCheck True/False

   * @returns {Array} validObjects array that need to be added
   */
var _validObjectsToAdd = function( existingObjects, selectedObjects, isGroupMemberCheck ) {
    var groupMemberObjects = [];
    if( isGroupMemberCheck ) {
        _.forEach( existingObjects, function( modelObject ) {
            if( isOfType( modelObject, 'GroupMember' ) ) {
                groupMemberObjects.push( modelObject );
            }
        } );
    } else {
        groupMemberObjects = existingObjects;
    }

    var validObjects = [];
    var objectsAlreadyAdded = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        var isObjAlreadyAddedIndex = null;
        isObjAlreadyAddedIndex = _.findKey( groupMemberObjects, {
            uid: selectedObject.uid
        } );
        // In case of DP we don't allow adding duplicate resource pools as resource pools
        // are being added uniqueUid to solve multiple same resource pool should show correctly on panel.
        // So we are comparing the uniqueUid as well that will only be present on ResourcePool case.
        if( typeof isObjAlreadyAddedIndex === typeof undefined ) {
            isObjAlreadyAddedIndex = _.findKey( groupMemberObjects, {
                uniqueUid : selectedObject.uniqueUid
            } );
        }
        if( typeof isObjAlreadyAddedIndex === typeof undefined ) {
            selectedObject.selected = false;
            validObjects.push( selectedObject );
        } else {
            objectsAlreadyAdded.push( selectedObject );
        }
    } );

    if( objectsAlreadyAdded.length > 0 ) {
        // Set the selected objects on data object and it will be used for duplicate validation
        var message = awp0TasksUtils.getDuplicateErrorMessage( objectsAlreadyAdded, selectedObjects );
        msgSvc.showError( message );
    }
    return validObjects;
};

/**
   * Populate the info and open Add signoff panel or in case of when panel need to be in
   * tool and info area update the input context so hat user picker panel will show correct
   * users.
   *
   * @param {Object} commandContext - Command context object that will store selected profile object and object
   * where user is trying to add.
   * @param {Object} subPanelContext Object that need to be updated for info that need to be pass to user
   *                 picker panel.
   * @param {Object} criteria Default criteria object
   */
export let openUserPanel = function( commandContext, subPanelContext, criteria ) {
    var additionalSearchCriteria = null;
    var profileObject = null;
    // Check if selected object cotnains additionalSearchCriteria then use that else it will
    // be null search criteria.
    if( commandContext && commandContext.vmo && commandContext.vmo.props && commandContext.vmo.additionalSearchCriteria ) {
        additionalSearchCriteria = commandContext.vmo.additionalSearchCriteria;
        profileObject = commandContext.vmo;
    }

    // In case of tool and info area panel we need to update the subPanelContext with all info like
    // selected profile or additional search criteria and navigate to user picker panel and return from
    // here.
    if( subPanelContext && commandContext ) {
        const localContext = { ...subPanelContext.value };
        localContext.loadProjectData = true;
        localContext.criteria = { ...criteria };
        var selectionModelMode = commandContext.selectionModelMode;
        var propName = commandContext.propName;
        if( !propName ) {
            propName = 'reviewers';
        }
        localContext.participantType = null;
        // This is mainly needed when we want to open user picker panel to pass
        // participant type only in case of DP addition.
        if( commandContext.isParticipantProp && commandContext.internalName ) {
            propName = commandContext.internalName;
            localContext.participantType = propName;
            localContext.criteria.participantType = propName;
        }
        // If selection mode is not defined then by default use multiple.
        if( !selectionModelMode ) {
            selectionModelMode = 'multiple';
        }

        if( profileObject && additionalSearchCriteria ) {
            localContext.profileObject = profileObject;
            localContext.profileUid = profileObject.uid;
            if( localContext.criteria ) {
                // Iterate for all entries in additional search criteria and add to main search criteria
                for( var searchCriteriaKey in additionalSearchCriteria ) {
                    if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                        localContext.criteria[ searchCriteriaKey ] = _.clone( additionalSearchCriteria[ searchCriteriaKey ] );
                    }
                }
            }
        }

        localContext.selectionModelMode = selectionModelMode;
        localContext.profileObject = profileObject;
        localContext.propName = propName;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**


   * Do unique group member related checks and if user is trying to add profile reviewers and user selected
   * multiple objects then in that case we need to add other users as additional reviewers.
   *
   * @param {String} propName Property name for object need to be added
   * @param {Array} selectedObjects Selected objects that need to be added.
   * @param {Object} profileObject Profile object if user is trying to add profile signoffs
   * @param {Object} subPanelContext Context object that will hold all info.
   * @returns {Object} Updated context along with valid objects that need to be added.
   */
var _addReviewers = function( propName, selectedObjects, profileObject, subPanelContext ) {
    const localContext = { ...subPanelContext };
    var reviewerObjects = _.clone( localContext.props.reviewers.modelObjects );
    var additionalReviewerObjects = _.clone( localContext.props.additionalReviewers.modelObjects );
    var acknowledgersObjects = _.clone( localContext.props.acknowledgers.modelObjects );
    var notifyeesObjects = _.clone( localContext.props.notifyees.modelObjects );
    Array.prototype.push.apply( reviewerObjects, additionalReviewerObjects );
    Array.prototype.push.apply( reviewerObjects, acknowledgersObjects );
    Array.prototype.push.apply( reviewerObjects, notifyeesObjects );

    // Get valid object list based on objects already presnets on respective data provider
    // and if valid objects are not null then only add to respective data provider.
    var validObjects = _validObjectsToAdd( reviewerObjects, selectedObjects, true );
    var isAdditionalReviewerUpdateCase = false;
    // Check if property name is reviewers and profile object present then check if number of required
    // reviewers is same or less as selected obejcts. If more then add to additional reviewers.
    if( propName === 'reviewers' && profileObject ) {
        var profileReviewers = [];

        _.forEach( validObjects, function( reviewer ) {
            if( profileObject ) {
                var profile = profileObject;
                // This is mainly needed to check if profile required reviewers count is matched or not
                // and if matched then add others as additional reviewers.
                var tempProfile = _updateProfileRequiredReviewers( profile.uid, [ profile ] );
                if( !tempProfile ) {
                    reviewer.signoffProfile = null;
                    additionalReviewerObjects.push( reviewer );
                    isAdditionalReviewerUpdateCase = true;
                } else {
                    reviewer.signoffProfile = profile;
                    profileReviewers.push( reviewer );
                }
            } else {
                reviewer.signoffProfile = null;
                additionalReviewerObjects.push( reviewer );
                isAdditionalReviewerUpdateCase = true;
            }
        } );
        // If additional reviewer case then add other objects to additional reviewers list
        if( isAdditionalReviewerUpdateCase ) {
            localContext.props.additionalReviewers.modelObjects = additionalReviewerObjects;
        }
        validObjects = profileReviewers;
    }
    return {
        localContext: localContext,
        validObjects: validObjects,
        isAdditionalReviewerUpdateCase : isAdditionalReviewerUpdateCase
    };
};

/**
   * Add the selected objects to respective participant section and update the context object.
   *
   * @param {String} propName Property name for object need to be added
   * @param {Array} selectedObjects Selected objects that need to be added.
   * @param {Object} subPanelContext Context object that will hold all info.
   */
var _addParticipantObjects = function( propName, selectedObjects, subPanelContext ) {
    let localContext = { ...subPanelContext.value };

    // Find out the participant section object where objects need to be added.
    var participantSectionObject = _.find( localContext.participantSectionObjects, function( participantSection ) {
        return participantSection.internalName === propName;
    } );
    if( participantSectionObject ) {
        // Mainly cloning the existing objects so that if user is adding new object to it
        // then it will update the context object correct and then onUpdate hook can be called
        // correctly and it will render the objects.
        var presentObjects = _.clone( participantSectionObject.modelObjects );

        var validObjects = [];
        if( participantSectionObject.selectionModelMode === 'single' || participantSectionObject.selectionMode === 'single' ) {
            // For single participant type, if there are multi selection then also we will use
            // 0th index selection only.
            if( selectedObjects && selectedObjects[ 0 ] ) {
                validObjects = [ selectedObjects[ 0 ] ];
                // Empty the present object array as we need to show only one user
                presentObjects = [];
            }
        } else {
            // Get valid object list based on objects already presnets on respective data provider
            // and if valid objects are not null then only add to respective data provider.
            validObjects = _validObjectsToAdd( presentObjects, selectedObjects, false );
        }

        // Check if valid objects that need to be added are not null then add to existing
        // list and then update the context to have correct info.
        if( validObjects && !_.isEmpty( validObjects ) ) {
            Array.prototype.push.apply( presentObjects, validObjects );
            participantSectionObject.modelObjects = presentObjects;
            participantSectionObject.updateUids = _getObjectsUidList( presentObjects ).join( ',' );
            // Updating updatedPropertyObject here so that if parent component wants table
            // to render at same time when user is adding the component then this can happen.
            localContext.updatePropContext = {
                propName: propName,
                modelObjects: presentObjects,
                isParticipantProp: true
            };
        }
        // Set the reset seach selection on context that will clear the selection from people picker after add
        // action is done.
        let newResetSearchSelection = localContext.resetSearchSelection ? localContext.resetSearchSelection : 0;
        newResetSearchSelection += 1;
        localContext.resetSearchSelection = newResetSearchSelection;
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
   * Add the selected users based on input property name where user is doing assignemnt.
   *
   * @param {String} propName Property name where selected users need to be added
   * @param {Object} profileObject Profile object in case user is doing profile assignment.
   * @param {Array} selectedObjects New users that needs to be added
   * @param {Object} subPanelContext Context object where object need to be added.
   */
var _addSelectedUsersInternal = function( propName, profileObject, selectedObjects, subPanelContext ) {
    if( !propName || !selectedObjects || !subPanelContext ) {
        return;
    }
    // Get the correct existing objects based on property where user is trying to add then
    // do in case of assignee replace all existing objects otherwise user is trying to add
    // reviewers, acknowldgers or notifyees. So based on that do additional validation like unique
    // users and then update the context object.
    let localContext = { ...subPanelContext.value };
    if( propName !== 'assignee' && ( subPanelContext.taskObject && subPanelContext.taskObject.type === 'EPMAcknowledgeTaskTemplate' || subPanelContext.taskObject && subPanelContext.taskObject.type === 'EPMAcknowledgeTask' ) ) {
        propName = 'reviewers';
    }
    var existingObjects = localContext.props[ propName ].modelObjects;
    var presentModelObjects = _.clone( existingObjects );
    var validObjects = [];
    var isAdditionalReviewerUpdateCase = false;

    // In case of assignee we just replace the existing value with new value as it can be only
    // one single value and for reviewers or other multi values prop we need to do unique check
    // like group member and then only update the property value
    if( propName === 'assignee' ) {
        validObjects = [ selectedObjects[ 0 ] ];
        presentModelObjects = [];
    } else {
        var addReviewerObject = _addReviewers( propName, selectedObjects, profileObject, localContext );
        localContext = addReviewerObject.localContext;
        validObjects = addReviewerObject.validObjects;
        isAdditionalReviewerUpdateCase = addReviewerObject.isAdditionalReviewerUpdateCase;
    }
    // Check if valid objects that need to be added are not null then add to existing
    // list and then update the context to have correct info.
    if( validObjects && !_.isEmpty( validObjects ) ) {
        Array.prototype.push.apply( presentModelObjects, validObjects );
        localContext.props[ propName ].modelObjects = presentModelObjects;
        localContext.props[ propName ].updateUids = _getObjectsUidList( presentModelObjects ).join( ',' );

        // This is special handling for case when user is trying to add profile users and profile nees only 2 objects but user is adding more than 2
        // objects then we need to add those extra users to additiona reviewers. So in that case isAdditionalReviewerUpdateCase falg will be true
        // and if additional reviewrs objects is not null then update the additional reviewers updateUids as well so that it will be updated correctly.
        if( isAdditionalReviewerUpdateCase && localContext.props.additionalReviewers && localContext.props.additionalReviewers.modelObjects ) {
            localContext.props.additionalReviewers.updateUids = _getObjectsUidList( localContext.props.additionalReviewers.modelObjects ).join( ',' );
        }
        // Updating updatedPropertyObject here so that if parent component wants table
        // to render at same time when user is adding the component then this can happen.
        localContext.updatePropContext = {
            propName: propName,
            modelObjects: presentModelObjects
        };
    }
    // Set the reset seach selection on context that will clear the selection from people picker after add
    // action is done.
    let newResetSearchSelection = localContext.resetSearchSelection ? localContext.resetSearchSelection : 0;
    newResetSearchSelection += 1;
    localContext.resetSearchSelection = newResetSearchSelection;
    subPanelContext.update && subPanelContext.update( localContext );
};

/**
   * Add the selected obejct from user picker panel to assignment panel. This action mainly being used
   * in narrow mode where we navigate to user picker panel and then select users and click on Add button.
   *
   * @param {String} propName Property name where selected users need to be added
   * @param {Object} userPanelContext User panel context object that will hold selected users info.
   * @param {Array} selectedObjects Selected objects that need to be added
   * @param {Object} subPanelContext Context object where object need to be added.
   */
export let addSelectedUsers = function( propName, userPanelContext, selectedObjects, subPanelContext ) {
    if( propName && selectedObjects && subPanelContext ) {
        // Check if user is trying to add participant then that info from user context
        // and then add the selected objects to specific participant sections.
        if( userPanelContext && userPanelContext.participantType ) {
            _addParticipantObjects( propName, selectedObjects, subPanelContext );
            return;
        }
        _addSelectedUsersInternal( propName, userPanelContext.profileObject, selectedObjects, subPanelContext );
    }
};

/**
   * When trying to remove profile users then update the profile information and add it to
   * data provider.
   *
   * @param {Array} objectToDisplay Objects that are already present in data provider
   * @param {Array} selectedObjects Objects that need to be removed
   * @param {String} requiredString Required string value
   * @returns {Array} validObjects array that is being used to update data provider
   */
var _removeReviewers = function( objectToDisplay, selectedObjects, requiredString ) {
    var validObjects = [];
    for( var idx = 0; idx < selectedObjects.length; idx++ ) {
        var object = selectedObjects[ idx ];

        var profileObject = object.signoffProfile;
        // Check if profile is null then no need to process further
        if( !profileObject ) {
            continue;
        }

        // Check if profile object is not VMO then create the VMO object first and then
        // increment the count.
        if( !viewModelService.isViewModelObject( profileObject ) ) {
            profileObject = viewModelService.createViewModelObject( profileObject );
            profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + requiredString;
        }

        profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + requiredString;
        var tempIndexOfProfileObject = _.findKey( objectToDisplay, {
            uid: profileObject.uid
        } );

        // If profile index is already prenset data is undefined then
        // only try to get forst group member or resource pool index and
        // add the profile before that.
        if( typeof tempIndexOfProfileObject === typeof undefined ) {
            var indexOfFirstGroupMember = _.findKey( objectToDisplay, {
                type: 'GroupMember'
            } );

            var validIndex = indexOfFirstGroupMember;
            var indexOfFirstResourcePool = _.findKey( objectToDisplay, {
                type: 'ResourcePool'
            } );

            if( indexOfFirstResourcePool > -1 && indexOfFirstResourcePool < indexOfFirstGroupMember ) {
                validIndex = indexOfFirstResourcePool;
            }

            // Add the profile object to already presnet list
            objectToDisplay.splice( validIndex, 0, profileObject );
        } else {
            var profileIndex = _.findIndex( objectToDisplay, function( object ) {
                return object.uid === profileObject.uid;
            } );
            if( profileIndex >= 0 ) {
                // Add the profile object to already presnet list
                objectToDisplay.splice( profileIndex, 1, profileObject );
            }
        }
    }
    // Find the differnece that need to be addded.
    validObjects = _.differenceBy( objectToDisplay, selectedObjects, 'uid' );
    return validObjects;
};

/**
   * For assignee, we show the user in section but before doing the remove operation
   * we need to get corresponding group member object and then remove it.
   *
   * @param {Array} modelObjects Existing objects from remove need to be done.
   * @param {Array} selectedObjects Selected objects that need to be removed.
   *
   * @returns {Array} Remove the valid object array that can be removed
   */
var _removeAssignee = function( modelObjects, selectedObjects ) {
    if( selectedObjects && selectedObjects[ 0 ] && selectedObjects[ 0 ].assigneeGroupMember ) {
        var groupMember = selectedObjects[ 0 ].assigneeGroupMember;
        return _.differenceBy( modelObjects, [ groupMember ], 'uid' );
    }
    return _.differenceBy( modelObjects, selectedObjects, 'uid' );
};

/**
   * Remove the selected objects in specific participant section and update the context object.
   *
   * @param {Object} commandContext Command context where is user trying to remove
   * @param {Object} selectedObjects Selected objects that need to be removed
   * @param {Object} subPanelContext Context object which need to be updated after selected objects gets removed.
   */
var _removeParticipants = function( commandContext, selectedObjects, subPanelContext ) {
    if( !subPanelContext || !commandContext || !subPanelContext.value || !selectedObjects ) {
        return;
    }
    // Get the existing values from context and use it for updation.
    const localContext = { ...subPanelContext.value };

    // Get the participant section object where selected object need to be removed.
    var participantSectionObject = _.find( localContext.participantSectionObjects, function( participantSection ) {
        return participantSection.internalName === commandContext.internalName;
    } );
    // Check if participant section object is not null then we need to filter out the objects that need to be
    // displayed based on selected and then update the context object.
    if( participantSectionObject ) {
        var presentObjects = participantSectionObject.modelObjects;
        var validObjects = _.differenceBy( presentObjects, selectedObjects, 'uid' );
        participantSectionObject.modelObjects = validObjects;
        participantSectionObject.selectedObjects = [];
        participantSectionObject.updateUids = _getObjectsUidList( validObjects ).join( ',' );
        // Right now using below object to update the table context object info so if table need
        // to be updated at same time, it can happen.
        localContext.updatePropContext = {
            propName: commandContext.internalName,
            modelObjects: validObjects,
            isParticipantProp: true
        };
        subPanelContext.update && subPanelContext.update( localContext );
    }
};

/**
   * Remove the selected objects from input data provider and update it. In case of
   * reviewers removal where profile object, profile object will be added to data ptovider.
   *
   * @param {Object} dataProvider Data provider object whose objects need to be removed
   * @param {Array} selectedObjects Objects that need to be removed
   */
export let removeUsersTaskAssignment = function( commandContext, selectedObjects, subPanelContext, requiredString ) {
    if( commandContext && selectedObjects && !_.isEmpty( selectedObjects ) ) {
        var validRemoveObjects = [];

        // Check if reviewer is required then that cannot be removed. So ignore that in case of multiple
        // selections
        _.forEach( selectedObjects, function( selObject ) {
            // This check is needed in case of multiple selection some are required and some are not so we need to ignore those.
            if( selObject.assignmentObject && ( selObject.assignmentObject.isRequired  || selObject.assignmentObject.isRemoveAllowed === 'false' ) ) {
                selObject.selected = false;
            } else {
                validRemoveObjects.push( selObject );
            }
        } );

        // If user is trying to remove the participant then we will handle it seperately.
        if( commandContext.isParticipantProp ) {
            _removeParticipants( commandContext, validRemoveObjects, subPanelContext );
            return;
        }

        // Get the existing values from context and use it for updation.
        const localContext = { ...subPanelContext.value };
        var propName = commandContext.propName;
        var existingObjects = localContext.props[ propName ].modelObjects;
        var validObjects = [];

        // If user is trying to remove object for reviewers then we need to do additional check for
        // if it's profile assignment then we need to update the profile count and that processing
        // will show the correct count for profile after assignment removal.
        if( propName === 'reviewers' ) {
            validObjects = _removeReviewers( existingObjects, validRemoveObjects, requiredString );
        } else if( propName === 'assignee' ) {
            validObjects = _removeAssignee( existingObjects, validRemoveObjects );
        } else {
            validObjects = _.differenceBy( existingObjects, validRemoveObjects, 'uid' );
        }
        localContext.props[ propName ].modelObjects = validObjects;
        localContext.props[ propName ].selectedObjects = [];
        localContext.props[ propName ].updateUids = _getObjectsUidList( validObjects ).join( ',' );
        localContext.updatePropContext = {
            propName: propName,
            modelObjects: validObjects
        };
        subPanelContext.update && subPanelContext.update( localContext );
    }
};


/**
   * Update the assignee data provider based on new object that need to be shown.
   *
   * @param {Object} dataProvider data provider where object need to be added
   * @param {Array} modelObejcts Objects that need to be shown in input data provider.
   *
   */
export let updateAssigneeDataProvider = function( dataProvider, modelObejcts ) {
    _populateAssigneeDataProvider( dataProvider, modelObejcts );
};

/**
   * Based on input profile objects and reviewers we need to check if required reviewers
   * count is matched or not and if matched then we don't shown profile object in section else
   * profile object will be shown.
   *
   * @param {Object} profileObjects Profile objects that need to be shown.
   * @param {Object} reviewerObjects Profile reviewers that will be shown in reviewers section.
   * @param {String} sidenavMode Side nav mode string liek mobile, tablet or desktop.
   * @returns {Object} Final reviewers list that will be displayed in the section.
   */
var _updateProfileReviewersInfo = function( profileObjects, reviewerObjects, sidenavMode ) {
    var reviewers = [];
    var finalReviewers = [];
    var isProfilePresent = false;
    // Check if profile object is not null and not empty then set the flag
    // to true and get the 0th index profile object and set to one variable.
    if( profileObjects && profileObjects.length > 0 ) {
        isProfilePresent = true;
    }

    _.forEach( reviewerObjects, function( reviewer ) {
        var profileObject = reviewer.signoffProfile;
        if( reviewer && reviewer.taskAssignment && ( !reviewer.internalName && reviewer.taskAssignment.uid !== _UNSTAFFED_UID ) ) {
            var assignmentObject = _.cloneDeep( reviewer );
            reviewer = reviewer.taskAssignment;
            reviewer.assignmentObject = assignmentObject;
        }

        // Check if profile object is not null then only update the profile required reviewers count
        if( profileObject ) {
            profileObject = _updateProfileRequiredReviewers( profileObject.uid, profileObjects );
            reviewer.signoffProfile = profileObject;
        }

        // Add the data to respective list based on profile existence
        reviewer.selected = false;
        if( profileObject || !isProfilePresent ) {
            reviewers.push( reviewer );
        }
    } );

    // Check if profile is present and then check for required reviewers count
    // on profile obejct if > 0 then only add to list that will be added on data provider
    if( isProfilePresent ) {
        _.forEach( profileObjects, function( profile ) {
            var noRequiredReviewers = parseInt( profile.requiredReviewers.split( ' ' ) );
            if( noRequiredReviewers > 0 ) {
                // Cloning is mainly needed if profile object is already shown but it's count
                // has been updated due to add or remove operation then it doesnot show up by default.
                // So to handle that case, we are cloning the profile object and then adding to the list
                // so that it can render the profile correctly on UI.
                const localProfileObject = _.clone( profile );
                // This we are setting on profile object itself as we don't want to show + command
                // when user is in desktop or tablet mode.
                localProfileObject.sidenavMode = sidenavMode;
                finalReviewers.push( localProfileObject );
            }
        } );
        Array.prototype.push.apply( finalReviewers, reviewers );
        reviewers = finalReviewers;
    }
    return reviewers;
};

/**
   * Check if input objects is not null then add it to respective data provider directly.
   * If input mergeData value is true then it will add input model objects to existing
   * data present in data provider.
   *
   * @param {Object} dataProvider data provider where object need to be added
   * @param {Array} modelObjects Objects that need to be added
   *
   * @returns {Array} Model objects array
   */
var _populateDataProvider = function( dataProvider, modelObjects ) {
    var reviewers = [];
    if( modelObjects && modelObjects.length > 0 ) {
        _.forEach( modelObjects, function( modelObject ) {
            var assignmentObject = null;
            if( modelObject && modelObject.taskAssignment && !modelObject.internalName ) {
                assignmentObject = _.cloneDeep( modelObject );
                modelObject = modelObject.taskAssignment;
            }
            // If modelObject is not null then only set selected to false and add to data provider
            if( modelObject && modelObject.uid && modelObject.uid !== _UNSTAFFED_UID ) {
                modelObject.selected = false;

                if( _.isUndefined( modelObject.assignmentObject ) || !modelObject.assignmentObject ) {
                    modelObject.assignmentObject = assignmentObject;
                }
                reviewers.push( modelObject );
            }
        } );
    }
    // Update the contents in data provider
    dataProvider.update( reviewers, reviewers.length );
    return reviewers;
};

/**
   * This method mainly needed before populate the profile reviewers, we are resetting the required reviewers
   * count to original value and based on profile reviewers this count can be decremented and then based on that
   * profile object will be shown in section or not.
   * As we need to put sidenavMode also on profile object so that in desktop or table mode we can hide + command,
   * so to handle that we are updating profile object to store sidenavmode and updating the value was showing
   * incorrect profile count. So to handle that case before populating prfoile reviewers, we are setting profile
   * required reviewers count to original value and then based on reviewer, correct value can be set.
   *
   * @param {Array} modelObjects Profile objects that need to be shown in reviewers section.
   *
   * @returns {Array} Profile objects with updated required reviewers count.
   */
var _populateProfileRequiredReviewersCount = function( modelObjects ) {
    if( !modelObjects || _.isEmpty( modelObjects ) ) {
        return modelObjects;
    }
    var localProfileObjects = _.clone( modelObjects );
    _.forEach( localProfileObjects, function( profileObject ) {
        if( isOfType( profileObject, 'EPMSignoffProfile' ) ) {
            var splitArray = [];
            if( profileObject.requiredReviewers ) {
                splitArray = profileObject.requiredReviewers.split( ' ' );
                if( splitArray && splitArray[ 0 ] && splitArray[ 1 ] ) {
                    profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + splitArray[ 1 ];
                }
            }
        }
    } );
    return localProfileObjects;
};

/**
   * Populate the contents in reviewers data provider. Based on profile existence it will calculate
   * required profile reviewers and then show the correct count on profile.
   *
   * @param {Oject} dataProvider Data provider object where reviewers needs to be added
   * @param {Array} modelObjects Objects that needs to be added
   * @param {Object} reviewersProp Reviewers property obejct that hold profile and other information.
   * @param {String} requiredString Required string
   * @param {String} sidenavMode Side nav mode string liek mobile, tablet or desktop.
   * @param {Object} taskInfoObject Task info object that will hold all info
   * @returns {Array} Reviewers that need to be shown in reviewers section
   */
export let updateReviewersDataProvider = function( dataProvider, modelObjects, reviewersProp, requiredString, sidenavMode, taskInfoObject ) {
    var reviewersObjects = _.clone( modelObjects );
    // Check if profile not exist and no reviewers present then we need to show one dummy required reviewer
    // to indicate the this is mandatory. So add the dummy object from this core and return from here.
    if( !reviewersProp.isProfileExist && ( !reviewersObjects || _.isEmpty( reviewersObjects ) ) ) {
        reviewersObjects.push( _getDummyModelObject( requiredString ) );
        dataProvider.update( reviewersObjects, reviewersObjects.length );
        return reviewersObjects;
    } else if( reviewersProp.isProfileExist ) {
        // In case profile exist then we need to get the correct object that need to be shown as profile reviewers
        // and accordingly check if profile need to be shown or not.
        var profileObjects = _populateProfileRequiredReviewersCount( reviewersProp.profileObjects );
        reviewersObjects = _updateProfileReviewersInfo( profileObjects, modelObjects, sidenavMode );
    }
    reviewersObjects = _populateDataProvider( dataProvider, reviewersObjects );
    return reviewersObjects;
};

/**
   * Update the input data provider based on input model objects.
   *
   * @param {Oject} dataProvider Data provider object where reviewers needs to be added
   * @param {Array} modelObjects Objects that needs to be added
   */
export let updateDataProvider = function( dataProvider, modelObjects ) {
    _populateDataProvider( dataProvider, modelObjects );
};


/**
   * Check for participant type pesent on criteria and new participant type are not same then
   * we need to update people picker panel. Other case will be profile select or different profile
   * selection or profile deselect case where we need to return true.
   *
   * @param {Object} presentSearchContext Current people picker panel search state context object
   * @param {String} newProfileUid Profile uid string that user is trying to select. By default it
   *                will be empty string.
   * @param {String} newParticipantType New participant type user is trying to select. By default it
   *                will be empty string.
   * @returns {boolean} True/False based on validation criteria
   */
var _isUserPanelCriteriaUpdateNeeded = function( presentSearchContext, newProfileUid, newParticipantType ) {
    var isUpdateNeeded = false;
    if( !presentSearchContext || !presentSearchContext.criteria ) {
        return isUpdateNeeded;
    }
    // Case 1: Check if previous participant type and new participant type user selected are not same that means
    // we need to update user picker panel based on new participant type then return true
    // Case 2: Check if previous selected prfile and new profile that will be selected is not same then also
    // we need to update user picker panel then return true
    if( !_.isEqual( presentSearchContext.criteria.participantType, newParticipantType )
      || !_.isEqual( presentSearchContext.profileUid, newProfileUid ) ) {
        return true;
    }

    return isUpdateNeeded;
};

/**
   * Update the input user panel context based on selection either profile or particiapnt key role.
   * This action will mainly called when we are in table or desktop mode and panel is widget so that
   * we can add profile users.
   *
   * @param {Array} selectedObjects Selected objects from different sections.
   * @param {Object} userPanelContext Context object where selected object info need to be updated.
   * @param {Object} criteria Criteria object to add additional search criteria that will be pass to server
   *
   */
export let updateProfileReviewerSelection = function( selectedObjects, userPanelContext, criteria ) {
    var profileObject = null;
    var participantType = '';
    var profileUid = '';
    var additionalSearchCriteria = {};
    // Get the profile object from selected object. If found then use it else see if user has selected key role.
    if( selectedObjects && selectedObjects.length > 0 ) {
        profileObject = _.find( selectedObjects, function( selection ) {
            return selection.type === 'EPMSignoffProfile';
        } );
        if( !profileObject ) {
            // Check for profiles based on participant types
            _.find( selectedObjects, function( selection ) {
                // We are checking it selection type is keyRole along with that we are checking
                // if participant_eligibility is set then only we need to set the participant type
                // on people picker state so that it can filter correct results else if it's null
                // then there is no need to update the people picker panel state criteria
                if( selection.type === 'KeyRole' && selection.participant_eligibility ) {
                    participantType = selection.uid;
                }
            } );
        }
    }

    // If profile object is selected then we need to get additional search criteria from profile
    // and then use it to update user picker panel
    if( profileObject ) {
        profileUid = profileObject.uid;
        additionalSearchCriteria = profileObject.additionalSearchCriteria;
    }

    const localContext1 = { ...userPanelContext.value };
    const localContext = _.cloneDeep( localContext1 );

    // Check if search criteria for people picker panel need to be updated or not. It will
    // validate participant type and profile uid and if update needed then it will process
    // further else it will return from here.
    if( !_isUserPanelCriteriaUpdateNeeded( localContext, profileUid, participantType ) ) {
        return;
    }
    //Check if input criteria object is not null then we need to set it with correct default values
    if( criteria ) {
        // Clone the criteria before adding to local context
        const localCriteria = _.cloneDeep( criteria );
        // Iterate for all entries in default criteria and add to main search criteria
        for( var defaultCriteriaKey in localCriteria ) {
            if( localCriteria.hasOwnProperty( defaultCriteriaKey ) ) {
                localContext.criteria[ defaultCriteriaKey ] = _.cloneDeep( localCriteria[ defaultCriteriaKey ] );
            }
        }
    }

    localContext.selectionModelMode = 'multiple';
    localContext.profileObject = profileObject;
    // Check if profile object is not null and additionalSearchCriteria also not null that means
    // we need to add this criteria to search criteria so that people picker can be updated based
    // on this criteria.
    if( profileObject && additionalSearchCriteria ) {
        localContext.profileObject = profileObject;
        if( localContext.criteria ) {
            // Iterate for all entries in additional search criteria and add to main search criteria
            for( var searchCriteriaKey in additionalSearchCriteria ) {
                if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                    localContext.criteria[ searchCriteriaKey ] = _.cloneDeep( additionalSearchCriteria[ searchCriteriaKey ] );
                }
            }
        }
        if( criteria ) {
            // Clone the criteria before adding to local context
            const localCriteria = _.clone( criteria );
            localContext.defaultCriteria = localCriteria;
        }
    } else if( participantType && !_.isEmpty( participantType ) ) {
        localContext.criteria.participantType = participantType;
    }

    localContext.selectionModelMode = 'multiple';

    // Using the profile uid in this case as we need to update user picker panel correctly based on
    // profile selection. If we pass object then observer on user picker panel doesn't work correctly.
    // So using the string as it will work correctly in all cases.
    localContext.profileUid = profileUid;
    localContext.propName = 'reviewers';
    localContext.selectedUsers = [];
    localContext.triggerUpdateSearchCriteria = true;
    userPanelContext.update && userPanelContext.update( localContext );
};

/**
   * This action mainly adds the selected users based on input property like reviewers or acknowledgers. This action
   * right now being used on tablet or desktop mode to support paste command.
   *
   * @param {String} propName Property name where selected users need to be added
   * @param {boolean} isParticipantProp True/False based on user is trying to add normal assignment or DP assignment.
   * @param {Object} commandContext Command context object to get additional information.
   * @param {Array} selectedObjects New users that needs to be added
   * @param {Object} subPanelContext Context object where object need to be added.
   */
export let addSelectedUsersOnPanel = function( propName, isParticipantProp, commandContext, selectedObjects, subPanelContext ) {
    // Check if input property name or selected objects are not valid then no need to process further and return from here.
    if( !propName || !selectedObjects ) {
        return;
    }
    // Check if user is trying to add participant then we need to handle it seperately.
    if( isParticipantProp ) {
        _addParticipantObjects( propName, selectedObjects, subPanelContext );
        return;
    }
    //Check if users is trying to add reviewers and those are profile reviewers then get the profile object first and
    // then use that profile object to do assignment. In this case user first select the profile object from category panel
    // and then select the profile users.
    var profileObject = null;
    if( propName === 'reviewers' && commandContext && commandContext.selectedObjects && isOfType( commandContext.selectedObjects[ 0 ], 'EPMSignoffProfile' ) ) {
        profileObject = commandContext.selectedObjects[ 0 ];
    }
    _addSelectedUsersInternal( propName, profileObject, selectedObjects, subPanelContext );
};

/**
   * This code will be used when user do drag and drop on panel.
   *
   * @param {Array} selectedObjects Selected objects from UI
   * @param {Object} dataProvider Data provider object where objects need to be added
   * @param {Object} props Props object that holds all context info
   * @param {Object} baseActiveFiltersStructure Base active filters curretnly applied
   */
export let addDropUsersOnPanel = function( selectedObjects, dataProvider, props, baseActiveFiltersStructure ) {
    var propName = 'assignee';
    var isParticipantProp = false;
    const addUserPanelState = props.subPanelContext.addUserPanelState;
    const taskInfoObject = props.taskInfoObject;
    var commandContext = {
        selectedObjects: []
    };
    if( !addUserPanelState || !taskInfoObject ) {
        return;
    }
    // Check if props contains participantTypeInfo and user wants to add to participant
    // then get the propName from this context object
    if( props.participantTypeInfo && props.participantTypeInfo.isParticipantProp ) {
        isParticipantProp = true;
        propName = props.participantTypeInfo.internalName;
    }
    // If user wants to add to task assignment data provider then based on data provider
    // get the correct propName that will be updated. In case of reviewers data provider check
    // if profile exist and profile object is selected then only add to reviewers section else
    // add to additionalReviewers section
    if( dataProvider.name === 'assignerDataProvider' ) {
        propName = 'assignee';
    } else if( dataProvider.name === 'acknowledgersDataProvider' ) {
        propName = 'acknowledgers';
    } else if( dataProvider.name === 'notifyeesDataProvider' ) {
        propName = 'notifyees';
    } else if( dataProvider.name === 'reviewersDataProvider' ) {
        propName = 'reviewers';
        var isProfilePresent = taskInfoObject.props.reviewers.isProfileExist;
        if( isProfilePresent && addUserPanelState.profileObject ) {
            commandContext.selectedObjects.push( addUserPanelState.profileObject );
        } else if( isProfilePresent && !addUserPanelState.profileObject ) {
            propName = 'additionalReviewers';
        }
    } else if( dataProvider.name === 'adhocReviewersDataProvider' ) {
        propName = 'additionalReviewers';
    }

    // Call this method to get the correct group member based on current context criteria group or role from user if user obejct is
    // being dispalyed on user picker panel then use that to get correct group member and add it to table
    workflowAssinmentUtilSvc.getValidObjectsToAdd( addUserPanelState.criteria, selectedObjects, baseActiveFiltersStructure ).then( function( validObjects ) {
        exports.addSelectedUsersOnPanel( propName, isParticipantProp, commandContext, validObjects, taskInfoObject );
    } );
};


/**
   * This factory creates a service and returns exports
   *
   * @member Awp0WorkflowAssignmentPanelService
   */

export default exports = {
    openUserPanel,
    removeUsersTaskAssignment,
    addSelectedUsers,
    updateProfileReviewerSelection,
    updateAssigneeDataProvider,
    updateDataProvider,
    updateReviewersDataProvider,
    addSelectedUsersOnPanel,
    addDropUsersOnPanel,
    populatePanelData,
    showUnsaveEditMessageAction
};


