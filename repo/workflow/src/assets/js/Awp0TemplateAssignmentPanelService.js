// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TemplateAssignmentPanelService
 */
import awp0TasksUtils from 'js/Awp0TasksUtils';
import viewModelService from 'js/viewModelObjectService';
import msgSvc from 'js/messagingService';
import palMgmtSvc from 'js/Awp0PalMgmtService';
import _ from 'lodash';
import localeService from 'js/localeService';

var exports = {};

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
    if( obj && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
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
    if( isOfType( selection, 'GroupMember' ) && selection.uid ) {
        if( selection.props.user && selection.props.user.dbValues && selection.props.user.dbValues[ 0 ] ) {
            // Get the user object from group member
            var userObject = viewModelService.createViewModelObject( selection.props.user.dbValues[ 0 ] );
            if( userObject ) {
                userObject.selected = false;
                userObject.assigneeGroupMember = selection;
                assignerUsers.push( userObject );
            }
        }
    } else {
        // If selection is not null then only set selected to false and add to data provider
        if( selection && selection.uid ) {
            selection.selected = false;
            assignerUsers.push( selection );
        }
    }
    dataProvider.update( assignerUsers, assignerUsers.length );
};

/**
 * This method check if both input objects are resource pool object then only it will return
 * true else it will return false.
 * @param {Object} objectA First input object
 * @param {Object} objectB Second input object
 *
 * @returns {boolean} True/False
 */
var _isDuplicateResourcePoolObjects = function( objectA, objectB ) {
    if( isOfType( objectA, 'ResourcePool' ) && isOfType( objectB, 'ResourcePool' ) ) {
        return true;
    }
    return false;
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
 * Check if profile exist then all objects inside reviewers data provider should contains latest
 * profile object and it's info so that at add and remove operation time it will be helpful and
 * correct info will be shown on UI.
 *
 * @param {Object} data Data view model object
 * @param {Array} reviewersObjects Objects that need to be shown in reviewers data provider.
 *
 * @returns {Array} Final objects that need to be shown in reviewers data provider.
 */
var _getFinalReviewersData = function( data, reviewersObjects ) {
    // Check if input data or review object is not valid then no need to process
    // further and return from here.
    if( !data || !reviewersObjects || _.isEmpty( reviewersObjects ) ) {
        return reviewersObjects;
    }
    // Check if profile objects is not present for selected task template object then
    // no need to process further and return the input objects as it is.
    if(  !data.profileObjects || _.isEmpty( data.profileObjects )  ) {
        return reviewersObjects;
    }
    // In case profile exist then we need to get the correct object that need to be shown as profile reviewers
    // and accordingly check if profile need to be shown or not.
    // So first we get the correct count on profile objects based on number of signoff property and then based on
    // added reviewers we reduce the profile count and set it on invidual reviewers as well so all profile reviewers
    // will have correct profile info.
    var profileObjects = _populateProfileRequiredReviewersCount( data.profileObjects );

    var isProfilePresent = false;
    // Check if profile object is not null and not empty then set the flag
    // to true and get the 0th index profile object and set to one variable.
    if( profileObjects && profileObjects.length > 0 ) {
        isProfilePresent = true;
    }
    var reviewers = [];
    _.forEach( reviewersObjects, function( reviewer ) {
        var profileObject = reviewer.profile;

        // Check if profile object is not null then only update the profile required reviewers count
        if( profileObject ) {
            profileObject = _updateProfileRequiredReviewers( profileObject.uid, profileObjects );
            reviewer.profile = profileObject;
        }

        // Add the data to respective list based on profile existence
        if( profileObject || !isProfilePresent ) {
            reviewers.push( reviewer );
        }
    } );
    var finalReviewers = [];
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
 * @param {Object} data Data view model object
 * @param {Object} dataProvider data provider where object need to be added
 * @param {Array} modelObjects Objects that need to be added
 * @param {boolean} mergeData True/False.
 */
var _populateOtherDataProvider = function( data, dataProvider, modelObjects, mergeData ) {
    var reviewers = [];
    if( modelObjects && modelObjects.length > 0 ) {
        _.forEach( modelObjects, function( modelObject ) {
            // If modelObject is not null then only set selected to false and add to data provider
            if( modelObject && modelObject.uid ) {
                // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                if( isOfType( modelObject, 'ResourcePool' ) && !modelObject.uniqueUid ) {
                    modelObject.uniqueUid = modelObject.uid;
                    modelObject.uid += Math.random();
                }
                reviewers.push( modelObject );
            }
        } );
    }

    // Check if merge daya is true then get already present element in data provider
    // and add it to new model objects and update data provider
    if( mergeData ) {
        var presetObjects = dataProvider && dataProvider.viewModelCollection.loadedVMObjects;

        Array.prototype.push.apply( presetObjects, modelObjects );

        // Remove the duplicates if present in presetObjects list. If duplicate resource pool
        // present then it should not filter it out.
        reviewers = _.uniqWith( presetObjects, function( objA, objB ) {
            return objA.uid === objB.uid && !_isDuplicateResourcePoolObjects( objA, objB );
        } );

        // Check if data provider name is reviewersDataProvider then only do additional processing
        // to see if profile objects then that should contains correct profile and reviewers info
        if( dataProvider && dataProvider.name === 'reviewersDataProvider' ) {
            reviewers = _getFinalReviewersData( data, reviewers );
        }
    }

    dataProvider && dataProvider.update( reviewers, reviewers.length );
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
    var profileIdx = _.findKey( profileObjects, {
        uid: profileUid
    } );

    if( profileIdx < 0 ) {
        return;
    }

    var profileVMO = profileObjects[ profileIdx ];
    // Check if VMO is not null then only get the required number of reviewers
    // and then reduce the count.
    if( profileVMO ) {
        var noRequiredReviewers = 0;
        if( profileVMO.requiredReviewers ) {
            noRequiredReviewers = parseInt( profileVMO.requiredReviewers.split( ' ' ) );
        }

        noRequiredReviewers--;
        if( noRequiredReviewers < 0 ) {
            return null;
        }

        var localeTextBundle = localeService.getLoadedText( 'WorkflowCommandPanelsMessages' );
        var requiredString = localeTextBundle.required;
        profileVMO.requiredReviewers = noRequiredReviewers + ' ' + requiredString;
        return profileVMO;
    }
    return null;
};

/**
 * Populate profile users and adhoc users and populate to respective data provider
 *
 * @param {Object} data Data view model object
 * @param {Array} profileObjects Profile Objects that need to be added or profile reviewers
 *  need to be added
 * @param {Array} reviewersObjects Objects that need to be added
 * @param {boolean} isAddUsersProfileCase True/False. Only be true when addign profile users from panel
 * @param {boolean} mergeData True/False.
 */
var _populateProfileAndAdhocReviewers = function( data, profileObjects, reviewersObjects, isAddUsersProfileCase, mergeData ) {
    var reviewers = [];
    var additionalReviewers = [];
    var finalReviewers = [];
    var isProfilePresent = false;
    var addProfileObject = null;

    // Check if profile object is not null and not empty then set the flag
    // to true and get the 0th index profile object and set to one variable.
    if( profileObjects && profileObjects.length > 0 ) {
        isProfilePresent = true;
        addProfileObject = profileObjects[ 0 ];
    }

    _.forEach( reviewersObjects, function( reviewer ) {
        var profileObject = reviewer.profile;

        // This flag will only be true when user is trying to add profile users from panel
        if( isAddUsersProfileCase ) {
            profileObject = addProfileObject;
        }

        // Check if profile object is not null then only update the profile required reviewers count
        if( profileObject ) {
            profileObject = _updateProfileRequiredReviewers( profileObject.uid, profileObjects );
            reviewer.profile = profileObject;
        }

        // Add the data to respective list based on profile existence
        if( profileObject || !isProfilePresent ) {
            reviewers.push( reviewer );
        } else {
            if( !isOfType( reviewer, 'EPMSignoffProfile' ) ) {
                additionalReviewers.push( reviewer );
            }
        }
    } );

    // Check if profile is present and then check for required reviewers count
    // on profile obejct if > 0 then only add to list that will be added on data provider
    if( isProfilePresent ) {
        _.forEach( profileObjects, function( profile ) {
            var noRequiredReviewers = parseInt( profile.requiredReviewers.split( ' ' ) );
            if( noRequiredReviewers > 0 ) {
                finalReviewers.push( profile );
            }
        } );
        Array.prototype.push.apply( finalReviewers, reviewers );
        reviewers = finalReviewers;
    }

    // Populate reviewers and additional reviewers on panel
    _populateOtherDataProvider( data, data.dataProviders.reviewersDataProvider, reviewers, mergeData );
    _populateOtherDataProvider( data, data.dataProviders.adhocReviewersDataProvider, additionalReviewers, mergeData );
};

/**
 *
 * Populate the assignment panel data based on selected object
 *
 * @param {Object} data Data view model object
 * @param {Object} templateObject task object for assignment panel need to open
 * @param {Array} profileObjects Profile objects array
 * @param {Object} workflowPalState PAL assignment state context object that contains all tasks assignment info
 */
var _populateProvider = function( data, templateObject, profileObjects, workflowPalState ) {
    var palDataMap = workflowPalState.palDataMap;

    if( !palDataMap[ templateObject.uid ] ) {
        // Get the updated pal structure map with default info as template
        // info not present on pal
        palDataMap = palMgmtSvc.updatePalWithDefaultInfo( palDataMap, templateObject );
    }

    var palData = palDataMap[ templateObject.uid ];
    if( isOfType( templateObject, 'EPMReviewTaskTemplate' ) || isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) || isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
        if( palData.fnd0Assigner ) {
            _populateAssigneeDataProvider( data.dataProviders.assignerDataProvider, palData.fnd0Assigner[ 0 ] );
        }
        // In case of review, acknowledge or route, set the correct quorum value we got from server and update the
        // pal data structure on client and that will be pass to server while saving the PAL.
        if( data.taskTemplateQuorumValue ) {
            var quorumPropName = 'rev_quorum';
            var quorumValue = _.parseInt( data.taskTemplateQuorumValue );
            if( isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) ) {
                quorumPropName = 'ack_quorum';
            }
            palData[ quorumPropName ] = quorumValue;
        }
    } else {
        if( palData.fnd0Assignee ) {
            _populateAssigneeDataProvider( data.dataProviders.assignerDataProvider, palData.fnd0Assignee[ 0 ] );
        }
    }

    var reviewersList = palData.awp0Reviewers;
    var acknowledgersList = palData.awp0Acknowledgers;

    // If selected task template is EPMAcknowledgeTaskTemplate then we show
    // acknoledgers in reviewers and additional reviewers sections and while saving
    // it will save in acknowledgers section
    if( isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) ) {
        reviewersList = palData.awp0Acknowledgers;
        acknowledgersList = [];
    }

    // Populate the reviwers and additional reviewers data provider
    _populateProfileAndAdhocReviewers( data, profileObjects, reviewersList );

    // Populate the acknowledgers to acknowledge data provider
    _populateOtherDataProvider( data, data.dataProviders.acknowledgersDataProvider, acknowledgersList );

    // Populate the notifyees to notify data provider
    _populateOtherDataProvider( data, data.dataProviders.notifyeesDataProvider, palData.awp0Notifyees );
};


/**
 * Populate the assignment panel data based on selected object
 * @param {Object} data Data view model object
 * @param {Object} taskObject task object for assignment panel need to open
 * @param {Object} palStateContext PAL assignment state context object that contains all tasks assignment info
 * @param {Object} namePropObject Task name property object
 * @returns {Object} Object that contains updated task name property
 */
export let populateAssignmentPanelData = function( data, taskObject, palStateContext, namePropObject ) {
    // Check if task object is null or empty uid then no need to process further
    if( !taskObject || !taskObject.uid || !palStateContext || !palStateContext.value ) {
        return {
            nameProp : namePropObject,
            selectedOption : null,
            isTemplateAssignmentInProgress : false,
            profileObjects: []
        };
    }
    // Update the name and status property object
    const nameProp = { ...namePropObject };
    if( taskObject.props && taskObject.props.object_string && taskObject.props.object_string.uiValue ) {
        nameProp.uiValue = taskObject.props.object_string.uiValue;
    }

    // Populate reviewers and additional reviewers on assignment panel
    var profileObjects = [];

    // Get the reviewProfiles and create the profile VMO objects and these VMOs will
    // be used further to render the content in reviewers data provider.
    if( data.reviewProfiles && data.reviewProfiles.length > 0 ) {
        profileObjects = awp0TasksUtils.getProfiles( data.reviewProfiles, data );
    }

    // Check if task object is of not multi user task then set the profile objects to empty array. This will
    // be the case when template has multiple task template like Do Task, Review task and then user select
    // review task first and then select the Do task. At this time profile object should be empty array as
    // we can't have profile on single user tasks.
    if( !isOfType( taskObject, 'EPMReviewTaskTemplate' ) && !isOfType( taskObject, 'EPMAcknowledgeTaskTemplate' ) && !isOfType( taskObject, 'EPMRouteTaskTemplate' ) ) {
        profileObjects = [];
    }

    const palStateObject = { ...palStateContext.value };

    // Populate all differnt sections present on PAL assignment PAL for input task object and info
    // present on PAL state
    _populateProvider( data, taskObject, profileObjects, palStateObject );

    return {
        nameProp : nameProp,
        selectedOption : null,
        isTemplateAssignmentInProgress : false,
        profileObjects : profileObjects
    };
};


/**
 * When trying to remove profile users then update the profile information and add it to
 * data provider.
 * @param {Object} data Data view model object
 * @param {Array} objectToDisplay Objects that are already present in data provider
 * @param {Array} selectedObjects Objects that need to be removed
 * @returns {Array} validObjects array that is being used to update data provider
 */
var _removeReviewers = function( data, objectToDisplay, selectedObjects ) {
    var validObjects = [];
    for( var idx = 0; idx < selectedObjects.length; idx++ ) {
        var object = selectedObjects[ idx ];

        var profileObject = object.profile;
        // Check if profile is null then no need to process further
        if( !profileObject ) {
            continue;
        }

        var localeTextBundle = localeService.getLoadedText( 'WorkflowCommandPanelsMessages' );
        var requiredString = localeTextBundle.required;

        // Check if profile object is not VMO then create the VMO object first and then
        // increment the count.
        if( !viewModelService.isViewModelObject( profileObject ) ) {
            profileObject = viewModelService.createViewModelObject( profileObject );
            profileObject.requiredReviewers = profileObject.props.number_of_signoffs.dbValues[ 0 ] + ' ' + requiredString;
        }
        var reviewersNeeded = parseInt( profileObject.requiredReviewers.split( ' ' ) );
        profileObject.requiredReviewers = reviewersNeeded + 1 + ' ' + requiredString;
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

    // Check if data provider name is reviewersDataProvider then we need to handle it differntly
    // so that if profile present then profile should show correct count and all other objects
    // other than profile should contain signle profile object so that add/remove action works ok
    // and it should show correct count.
    validObjects = _getFinalReviewersData( data, validObjects );
    return validObjects;
};


/**
 * Get all group member elements present in current data provider and update the
 * input list only.
 *
 * @param {Object} dataProvider Data provider object whose objects need to be checked
 * @param {Array} addedObjects Objects that need to be added
 * @returns {Array} addedObjects array that contains all group memebrs objects present.
 */
var _presentGroupMembersInDataProvider = function( dataProvider, addedObjects ) {
    var modelObejcts = dataProvider.viewModelCollection.loadedVMObjects;
    if( !modelObejcts || modelObejcts.length <= 0 ) {
        return addedObjects;
    }

    _.forEach( modelObejcts, function( modelObject ) {
        if( isOfType( modelObject, 'GroupMember' ) ) {
            addedObjects.push( modelObject );
        }
    } );
    return addedObjects;
};

/**
 * Populate all present group member objects in all differnet data providers and populate one list
 * @param {Object} data Data view model object
 * @returns {Array} addedObjects array that contains all group memebrs objects present.
 */
var _populateAlreadyAddedGroupMemberObjects = function( data ) {
    var addedObjects = [];
    _presentGroupMembersInDataProvider( data.dataProviders.reviewersDataProvider, addedObjects );
    _presentGroupMembersInDataProvider( data.dataProviders.adhocReviewersDataProvider, addedObjects );
    _presentGroupMembersInDataProvider( data.dataProviders.acknowledgersDataProvider, addedObjects );
    _presentGroupMembersInDataProvider( data.dataProviders.notifyeesDataProvider, addedObjects );
    return addedObjects;
};

/**
 * Validate if users is trying to add group member then that group member should not already
 * present in same or differnet data provider.
 * @param {Object} data Data view model object
 * @param {Array} selectedObjects Objects that need to be added and need validation
 * @returns {Array} validObjects array that need to be added
 */
var _validObjectsToAdd = function( data, selectedObjects ) {
    var alreadyAddedObjects = _populateAlreadyAddedGroupMemberObjects( data );
    var validObjects = [];
    var objectsAlreadyAdded = [];
    _.forEach( selectedObjects, function( selectedObject ) {
        var isObjAlreadyAddedIndex = null;
        isObjAlreadyAddedIndex = _.findKey( alreadyAddedObjects, {
            uid: selectedObject.uid
        } );
        if( typeof isObjAlreadyAddedIndex === typeof undefined ) {
            selectedObject.selected = false;
            validObjects.push( selectedObject );
        } else {
            objectsAlreadyAdded.push( selectedObject );
        }
    } );

    if( objectsAlreadyAdded.length > 0 ) {
        var message = awp0TasksUtils.getDuplicateErrorMessage( objectsAlreadyAdded, selectedObjects );
        msgSvc.showError( message );
    }
    return validObjects;
};
/**
 * Add the input selected users to input data provider object.
 * @param {Object} data Data view model object
 * @param {Array} selectedObjects Selected users that need to be added through drag and drop operation.
 * @param {Object} dataProvider Data provider object where objects will be added.
 * @param {Object} addUserPanelState User panel state object
 * @returns {boolean} isTemplateAssignmentInProgress True/False
 */
var _addSelectedUsersInternal = function( data, selectedObjects, dataProvider, addUserPanelState ) {
// Check if user is trying to add assignee/assigner then get the user
    // from group member object and update data provider.
    var isTemplateAssignmentInProgress = false;
    // Check if isTemplateAssignmentInProgress is already present on data then use that value
    // instead of default value. Fix for defect # LCS-667412
    if( data && data.isTemplateAssignmentInProgress !== undefined ) {
        isTemplateAssignmentInProgress = data.isTemplateAssignmentInProgress;
    }
    if( dataProvider.name === 'assignerDataProvider' ) {
        _populateAssigneeDataProvider( dataProvider, selectedObjects[ 0 ] );
        isTemplateAssignmentInProgress = true;
    } else {
        // Get valid object list based on objects already presnets on respective data provider
        // and if valid objects are not null then only add to respective data provider.
        var validObjects = _validObjectsToAdd( data, selectedObjects );

        if( validObjects && validObjects.length > 0 ) {
            // Check if selected task template contains profile or not and this will be used to consider
            // when user is trying to add reviewers as profile reviewers.
            var isProfileExist = false;
            if( data.profileObjects && !_.isEmpty( data.profileObjects ) && data.profileObjects[ 0 ] ) {
                isProfileExist = true;
            }
            // This is profile user add case
            if( dataProvider.name === 'reviewersDataProvider' && addUserPanelState && addUserPanelState.profileObject && isOfType( addUserPanelState.profileObject, 'EPMSignoffProfile' ) ) {
                _populateProfileAndAdhocReviewers( data, [ addUserPanelState.profileObject ], validObjects, true, true );
            } else {
                // Check if data provider is reviewersDataProvider then check if addUserPanelState contains profile
                // then only we add to add to profile reviewers else we need to get the adhoc data provider and add it to
                // adhoc data provider.
                if( dataProvider.name === 'reviewersDataProvider' && isProfileExist && addUserPanelState && !addUserPanelState.profileObject ) {
                    // Get the adhoc reviewers data provider and add to it
                    dataProvider = _getRespectiveDataProvider( data, 'additionalReviewers' );
                }
                _populateOtherDataProvider( data, dataProvider, validObjects, true );
            }
            isTemplateAssignmentInProgress = true;
        }
    }
    // Clear the selection from people picker panel while adding the users
    if( addUserPanelState && addUserPanelState.value ) {
        const userPanelState = { ... addUserPanelState.value };
        // Set the reset seach selection on context that will clear the selection from people picker after add
        // action is done.
        let newResetSearchSelection = userPanelState.resetSearchSelection ? userPanelState.resetSearchSelection : 0;
        newResetSearchSelection += 1;
        userPanelState.resetSearchSelection = newResetSearchSelection;
        addUserPanelState.update && addUserPanelState.update( userPanelState );
    }
    return isTemplateAssignmentInProgress;
};

/**
 * Add the input selected users to input data provider object.
 * @param {Object} data Data view model object
 * @param {Array} selectedObjects Selected users that need to be added through drag and drop operation.
 * @param {Object} dataProvider Data provider object where objects will be added.
 * @param {Object} addUserPanelState User panel state object
 * @returns {boolean} isTemplateAssignmentInProgress True/False
 */
export let addDropUsersOnPanel = function( data, selectedObjects, dataProvider, addUserPanelState ) {
    return _addSelectedUsersInternal( data, selectedObjects, dataProvider, addUserPanelState );
};

/**
 * Based on input property name find the respective data provider that need to be updated.
 * @param {Object} data Data view model object
 * @param {String} propName Property name to find out data provider object where objects will be added/removed.
 * @returns {Object} Data provider object
 */
var _getRespectiveDataProvider = function( data, propName ) {
    var dataProvider = null;
    if( propName === 'assignee' ) {
        dataProvider = data.dataProviders.assignerDataProvider;
    } else if( propName === 'reviewers' ) {
        dataProvider = data.dataProviders.reviewersDataProvider;
    } else if( propName === 'additionalReviewers' ) {
        dataProvider = data.dataProviders.adhocReviewersDataProvider;
    } else if( propName === 'acknowledgers' ) {
        dataProvider = data.dataProviders.acknowledgersDataProvider;
    } else if( propName === 'notifyees' ) {
        dataProvider = data.dataProviders.notifyeesDataProvider;
    }
    return dataProvider;
};

/**
 * Remove the input selected users to input prop name based data provider object.
 * @param {Object} data Data view model object
 * @param {Array} removeObjects Selected users that need to be removed.
 * @param {String} propName Property name to find out data provider object where objects will be removed.
 *
 * @returns {boolean} isTemplateAssignmentInProgress True/False
 */
export let removeUsersTemplateAssignment = function( data, removeObjects, propName ) {
    var isTemplateAssignmentInProgress = false;
    if( !removeObjects || _.isEmpty( removeObjects ) || !propName ) {
        return isTemplateAssignmentInProgress;
    }
    var dataProvider = _getRespectiveDataProvider( data, propName );
    if( !dataProvider ) {
        return isTemplateAssignmentInProgress;
    }

    // Get the current present objects
    var modelObjects = dataProvider.viewModelCollection.loadedVMObjects;
    var validObjects = [];
    if( dataProvider.name === 'reviewersDataProvider' ) {
        validObjects = _removeReviewers( data, modelObjects, removeObjects );
    } else {
        validObjects = _.difference( modelObjects, removeObjects );
    }
    dataProvider.update( validObjects, validObjects.length );
    isTemplateAssignmentInProgress = true;
    return isTemplateAssignmentInProgress;
};

/**
 * Add the input selected users to input prop name based data provider object.
 * @param {Object} data Data view model object
 * @param {Array} selectedUsers Selected users that need to be added.
 * @param {String} propName Property name to find out data provider object where objects will be added.
 * @param {Object} addUserPanelState User panel state object
 * @returns {boolean} isTemplateAssignmentInProgress True/False
 */
export let addSelectedUsers = function( data, selectedUsers, propName, addUserPanelState ) {
    var isTemplateAssignmentInProgress = false;
    if( !selectedUsers || _.isEmpty( selectedUsers ) || !propName ) {
        return isTemplateAssignmentInProgress;
    }
    var dataProvider = _getRespectiveDataProvider( data, propName );
    if( !dataProvider ) {
        return isTemplateAssignmentInProgress;
    }
    // Add the input selected users to correct data provider.
    return _addSelectedUsersInternal( data, selectedUsers, dataProvider, addUserPanelState );
};

/**
 * Update the pal data map with updated information based on changes done from UI and pubslidh the
 * event to update on assignment tree.
 *
 * @param {Object} data Data view model object
 * @param {Object} palDataMap Pal data map object that need to be updated
 * @param {Object} selTemplate Selected template obejct from UI whose info need to be updated
 * @param {Object} workflowPalState Workflow PAL state object.
 */
export let updateTemplatePalData = function( data, palDataMap, selTemplate, workflowPalState ) {
    // Get the updated pal structure map
    const localPALState = { ...workflowPalState.value };
    localPALState.palDataMap = palDataMap;
    palDataMap = palMgmtSvc.updatePalStructure( data, palDataMap, selTemplate );
    //Update the task assignement node with new assignemnt and refresh the tree node
    // after properties updated.
    palMgmtSvc.updateTemplateAssignmentNode( [ selTemplate ], localPALState );


    localPALState.isRefreshTreeNode = true;
    localPALState.isInEditMode = true;
    localPALState.isEditHandlerNeeded = true;
    workflowPalState.update && workflowPalState.update( localPALState );
};

/**
 * Update the name property and valid task template object for PAL assignment panel is showing.
 *
 * @param {Object} selectionObject selected template object for PAL assignment panel is open
 * @param {Object} name Name property object
 * @returns {Object} Updated name and input task template object
 */
export let populateSelectionContextData = function( selectionObject, name ) {
    const nameProp = { ...name };
    var dispName = '';
    if( selectionObject && selectionObject.displayName ) {
        dispName = selectionObject.displayName;
    }
    nameProp.uiValue = dispName;
    return {
        taskTemplateObject : selectionObject,
        nameProp: nameProp
    };
};

export default exports = {
    populateAssignmentPanelData,
    removeUsersTemplateAssignment,
    addSelectedUsers,
    updateTemplatePalData,
    addDropUsersOnPanel,
    populateSelectionContextData
};
