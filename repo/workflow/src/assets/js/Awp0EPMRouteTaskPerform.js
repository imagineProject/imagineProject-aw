// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0EPMRouteTaskPerform
 */
import viewModelObjSvc from 'js/viewModelObjectService';
import Awp0PerformTask from 'js/Awp0PerformTask';
import iconSvc from 'js/iconService';
import Awp0TasksUtils from 'js/Awp0TasksUtils';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import AwStateService from 'js/awStateService';
import _ from 'lodash';

var exports = {};

/**
 * Navigate to the input panel id if not null and in null case we need to navigate to default
 * panel id.
 *
 * @param {String} panelId - Panel id where we need to navigate to that panel.
 *
 * @returns {String} Navigatied panel id which will be activeView.
 */
export let getActiveView = function( panelId ) {
    var viewId = 'Awp0EPMRouteTaskPerformSecondary';
    if( panelId ) {
        viewId = panelId;
    }
    return viewId;
};


export let getComments = function( data ) {
    return Awp0PerformTask.getComments( data );
};

/**
 * Populate the required signoff obejct that needs to be shown when profile doesn't exist on the SST task object
 * and no adhoc signoff added in the list then it should show the dummy required cell as signoff needs to be
 * added to complete the task.
 *
 * @param {object} data - the data Object
 * @param {object} signoffProfiles - the signoff profile array that will contain signoff profile and profile
 *            signoffs
 * @param {object} signoffs - the signoff array that will contain adhoc signoffs
 *
 * @returns {Array} Adhoc signoff array
 */
var populateRequiredSignoffObject = function( data, signoffProfiles, signoffs ) {
    var adhocSignoffs = signoffs;
    if( data && signoffProfiles && signoffs && signoffProfiles.length <= 0 && signoffs <= 0 ) {
        var modelObject = viewModelObjSvc.constructViewModelObjectFromModelObject( null, '' );
        var iconURL = iconSvc.getTypeIconFileUrl( 'typePersonGray48.svg' );
        modelObject.typeIconURL = iconURL;
        modelObject.requiredDispValue = data.i18n.requiredLabel;
        modelObject.cellHeader1 = data.i18n.requiredLabel;
        adhocSignoffs.push( modelObject );
    }
    return adhocSignoffs;
};

/**
 * Populate the review signoff profile, profile signoff and adhco signoff data and add it to respective data
 * provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Profile signoff objects in reviewers section
 *
 */
var populateReviewProfilesAndSignoffData = function( data ) {
    var signoffObjects = [];

    var profileJSONString = data.reviewProfiles;
    var profileSignoffString = data.profileSignoffs;
    signoffObjects = Awp0TasksUtils.getProfiles( profileJSONString, data );
    var profileSignoffs = awp0InboxUtils.getSignoffObjects( profileSignoffString, data );
    if( profileSignoffs && !_.isEmpty( profileSignoffs ) ) {
        Array.prototype.push.apply( signoffObjects, profileSignoffs );
    }

    data.dataProviders.reviewProfileSignoffProvider.update( signoffObjects, signoffObjects.length );
    return signoffObjects;
};

/**
 * Populate the review adhoc signoff data and add it to respective data provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Profile adhoc signoff objects
 */
var populateReviewAdhocSignoffData = function( data ) {
    var signoffObjects = [];

    var adhocSignoffString = data.adhocSignoffs;
    signoffObjects = awp0InboxUtils.getSignoffObjects( adhocSignoffString, data );
    data.dataProviders.reviewAdhocSignoffProvider.update( signoffObjects, signoffObjects.length );
    return signoffObjects;
};

/**
 * Populate the acknowledge adhoc signoff data and add it to respective data provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Profile acknowledge signoff objects
 */
var populateAcknowledgeSignoffData = function( data ) {
    var acknowledgeSignoffs = [];
    var acknowledgeSignoffString = data.acknowledgeAdhocSignoffs;
    acknowledgeSignoffs = awp0InboxUtils.getSignoffObjects( acknowledgeSignoffString, data );


    data.dataProviders.acknowledgeSignoffProvider.update( acknowledgeSignoffs, acknowledgeSignoffs.length );
    return acknowledgeSignoffs;
};

/**
 * Populate the notify adhoc signoff data and add it to respective data provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Profile notify signoff objects
 */
var populateNotifySignoffData = function( data ) {
    var notifySignoffs = [];
    var notifySignoffString = data.notifyAdhocSignoffs;
    notifySignoffs = awp0InboxUtils.getSignoffObjects( notifySignoffString, data );

    data.dataProviders.notifySignoffProvider.update( notifySignoffs, notifySignoffs.length );
    return notifySignoffs;
};

/**
 * Populate the signoff profile, profile signoff and adhco signoff data and add it to respective data provider
 *
 * @param {object} data - the data Object
 *
 * @returns {Object} Object with all signoff
 *
 */
var populateProfilesAndSignoffData = function( data ) {
    var isSignoffPresent = false;

    var reviewSignoffProfileObjects = populateReviewProfilesAndSignoffData( data );
    var reviewAdhocSignoffObjects = populateReviewAdhocSignoffData( data );
    var acknowledgeSignoffObjects = populateAcknowledgeSignoffData( data );
    var notifySignoffObjects = populateNotifySignoffData( data );

    if( !isSignoffPresent ) {
        // Populate the required dummy cell that needs to be shown when there is no profile and no adhoc signoff present
        var adhocSignoffObjects = populateRequiredSignoffObject( data, reviewSignoffProfileObjects,
            reviewAdhocSignoffObjects );

        reviewAdhocSignoffObjects = adhocSignoffObjects;
        data.dataProviders.reviewAdhocSignoffProvider.update( adhocSignoffObjects, adhocSignoffObjects.length );
    }
    return {
        reviewSignoffProfileObjects : reviewSignoffProfileObjects,
        reviewAdhocSignoffObjects : reviewAdhocSignoffObjects,
        acknowledgeSignoffObjects : acknowledgeSignoffObjects,
        notifySignoffObjects : notifySignoffObjects
    };
};

/**
 * Populate the properties on the panel.
 *
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @param {string} state - the Info panel edithandler state
 *
 * @returns {Object} Object with properties needs to be updated on UI
 *
 */
export let populatePanelData = function( data, selection, state ) {
    var selectedObject = selection;
    var nameValue = selectedObject.props.object_string.dbValues[ 0 ];
    const newTaskName = { ...data.taskName };
    newTaskName.dbValue = nameValue;
    newTaskName.uiValue = nameValue;

    const description = awp0InboxUtils.populateDescription( data.description, selectedObject );

    const workflowDescription = awp0InboxUtils.populateJobDescription( data.workflowDescription, selectedObject );

    var commentsValue = selectedObject.props.comments.dbValues[ 0 ];

    if ( data.isTCSSOEnabled && AwStateService.instance.params.reauthorize === 'true' ) {
        var commentsURIString = AwStateService.instance.params.comments;
        if ( commentsURIString ) {
            if ( Array.isArray( commentsURIString ) ) {
                commentsURIString = commentsURIString[ commentsURIString.length - 1 ];
            }
            var decodedComments = decodeURIComponent( commentsURIString );
            commentsValue = decodedComments;
        } else {
            commentsValue = '';
        }
    }

    var passowrdValue = '';

    // Check if comments db value is not null that means there is a value present already
    // either entered by user or present on object then use that value
    if( data.selectedObject && selectedObject && data.selectedObject.uid ===  selectedObject.uid ) {
        commentsValue = data.comments.dbValue;
        passowrdValue = data.password.dbValue;
    }
    if( state === 'saved' ) {
        commentsValue = selectedObject.props.comments.dbValues[ 0 ];
    }

    const commentsProp = { ...data.comments };
    commentsProp.dbValue = commentsValue;
    commentsProp.uiValue = commentsValue;

    const passwordProp = { ...data.password };
    passwordProp.dbValue = passowrdValue;
    passwordProp.uiValue = passowrdValue;


    var secureTaskValue = selectedObject.props.secure_task.dbValues[ 0 ];
    var tempIsSecureTask = false;
    if ( secureTaskValue === '1' ) {
        tempIsSecureTask = true;
    }
    var usingSSO = false;
    if ( data.isTCSSOEnabled && data.isTCSSOEnabled === true ) {
        usingSSO = true;
    }
    const isSecureTask = tempIsSecureTask && !usingSSO;

    var hasFailurePathsValue = selectedObject.props.has_failure_paths.dbValues[ 0 ];
    var tempHasFailurePaths = false;
    if ( hasFailurePathsValue === '1' ) {
        tempHasFailurePaths = true;
    }
    const hasFailurePaths = tempHasFailurePaths;

    const taskErrors = _.clone( data.taskErrors );
    const isWarning = selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValue && selectedObject.props.fnd0TaskExecutionStatus.dbValue === 3 ||
    selectedObject.props.fnd0TaskExecutionStatus && selectedObject.props.fnd0TaskExecutionStatus.dbValues && selectedObject.props.fnd0TaskExecutionStatus.dbValues[0] === '3';
    if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValue ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValue;
    } else if ( selectedObject.props.fnd0TaskExecutionErrors && selectedObject.props.fnd0TaskExecutionErrors.uiValues[0] ) {
        taskErrors.uiValue = selectedObject.props.fnd0TaskExecutionErrors.uiValues[0];
    } else {
        taskErrors.uiValue = '';
    }
    // Populate the signoff profile and respective signoff data and add it to respective providers
    var signoffData = populateProfilesAndSignoffData( data );

    return {
        selectedObject : selectedObject,
        taskName : newTaskName,
        description : description,
        workflowDescription : workflowDescription,
        comments: commentsProp,
        password: passwordProp,
        isSecureTask: isSecureTask,
        hasFailurePaths : hasFailurePaths,
        reviewSignoffProfileObjects : signoffData.reviewSignoffProfileObjects,
        reviewAdhocSignoffs : signoffData.reviewAdhocSignoffs,
        acknowledgeSignoffs: signoffData.acknowledgeSignoffObjects,
        notifySignoffs: signoffData.notifySignoffObjects,
        taskErrors: taskErrors,
        isWarning: isWarning
    };
};


/**
 * Populate the error message based on the SOA response output and filters the partial errors and shows the
 * correct errors only to the user.
 *
 * @param {object} response - the response Object of SOA
 * @return {String} message - Error message to be displayed to user
 */
export let populateErrorMessageOnPerformAction = function( response ) {
    return Awp0PerformTask.populateErrorMessageOnPerformAction( response );
};


export default exports = {
    getActiveView,
    getComments,
    populatePanelData,
    populateErrorMessageOnPerformAction
};
