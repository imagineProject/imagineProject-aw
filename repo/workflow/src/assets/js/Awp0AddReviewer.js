// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0AddReviewer
 */
import awInboxService from 'js/aw.inbox.service';
import appCtxSvc from 'js/appCtxService';
import commandPanelService from 'js/commandPanel.service';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';

/**
 * Define public API
 */
var exports = {};

/**
 * Populate the panel data based on selection and add the additional search criteria so that duplicate reviewer will
 * be avoided.
 *
 * @param {Object} selectedObject Selected object from UI.
 * @param {Object} addUserPanelState user Panel state object that will hold all info related to adding users
 * @param {Object} criteria Criteria object to add additional search criteria that will be pass to server
 * @param {Object} subPanelContext
 *
 * @returns {Object} Updated user panel data with additional search criteria
 */
export let populatePanelData = function( selectedObject, addUserPanelState, criteria, subPanelContext  ) {
    var validEPMTask = null;

    const userPanelState = { ...addUserPanelState };
    userPanelState.criteria = criteria;

    // Check if selected object from UI is not null then get the EPM Task object from that selection
    // and add it to user pabel state so that it can be use later.
    if( selectedObject && selectedObject.uid ) {
        validEPMTask = awInboxService.getValidEPMTaskObject( selectedObject.uid );
        if( validEPMTask && ( validEPMTask.type === 'EPMReviewTask' || validEPMTask.type === 'EPMAcknowledgeTask' ) && subPanelContext && subPanelContext.pageContext 
            && ( subPanelContext.pageContext.primaryActiveTabId === 'tc_xrt_Reviewers' || subPanelContext.pageContext.secondaryActiveTabId === 'tc_xrt_Reviewers')) { 
            let childTasks = validEPMTask?.props?.child_tasks?.dbValues;
            _.forEach( childTasks, function(childTask){
                let childTaskObj = cdm.getObject( childTask );
                if( childTaskObj && childTaskObj.type && childTaskObj.type === 'EPMPerformSignoffTask') {
                    validEPMTask = childTaskObj;
                }
            });
        }
        userPanelState.selectedObject = selectedObject;

        // Add the additional search criteria to criteria and add the epm task object to Awp0AddReviewer key
        // so that on server we can filter out the duplicate group members and show the unique group members
        // which are not already added
        if( validEPMTask && validEPMTask.uid && userPanelState.criteria ) {
            userPanelState.criteria.Awp0AddReviewer = validEPMTask.uid;
        }
    }
    // Set the task object to user panel state
    userPanelState.validEPMTask = validEPMTask;
    return {
        userPanelState : userPanelState,
        isDataInit : true
    };
};

/**
 * This method will update the context that needed for Add reviewer command and open the panel.
 *
 * @param {object} modelObject - the Object for command needs to open
 * @param {Object} commandContext - the command context
 */
var _updateAddReviewerContext = function( modelObject, commandContext ) {
    var context = {
        selectedObject: modelObject,
        loadProjectData: 'true',
        selectionModelMode: 'multiple'
    };

    let { dialogAction } = commandContext;
    if( dialogAction ) {
        let options = {
            view: 'Awp0AddReviewer',
            parent: '.aw-layout-workareaMain',
            placement: 'right',
            width: 'STANDARD',
            height: 'FULL',
            isCloseVisible: false,
            subPanelContext: context
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( 'Awp0AddReviewer', 'aw_toolsAndInfo', context );
    }
};

/**
 * This method will check for fnd0ParentTask proeprty is not null for input model object.
 *
 * @param {object} modelObject - the Object for property need to check
 *
 * @return {boolean} True or false based on property value is loaded or not
 */
var _isParentTaskPropLoaded = function( modelObject ) {
    // Check for input model object is not null and parent task proeprty is loaded then only return true
    // else return false
    if( modelObject && modelObject.props.fnd0ParentTask && modelObject.props.fnd0ParentTask.dbValues ) {
        return true;
    }
    return false;
};

/**
 * Get the valid selection that need to be used to add the signoff and refresh furhter
 *
 * @param {object} parentSelection - the parent selected Object from UI
 * @param {Object} commandContext - the command context
 */
export let setContextVariableForAddReviewer = function( parentSelection, commandContext ) {
    // Check if panel is already up then close the panel and don't process further
    var activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
    if( activeCommand && activeCommand.commandId === 'Awp0AddReviewer' ) {
        commandPanelService.activateCommandPanel( 'Awp0AddReviewer', 'aw_toolsAndInfo' );
        return;
    }

    // Check for selection is of type signoff and check it's parent task property is loaded
    // or not. If property is not loaded then load the property and bring the panel otherwise
    // bring the panel
    if( parentSelection && parentSelection.modelType && parentSelection.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1  &&
        !_isParentTaskPropLoaded() ) {
        dmSvc.getPropertiesUnchecked( [ parentSelection ], [ 'fnd0ParentTask' ] ).then( function() {
            var modelObject = cdm.getObject( parentSelection.uid );
            _updateAddReviewerContext( modelObject, commandContext );
        } );
        return;
    }
    _updateAddReviewerContext( parentSelection, commandContext );
};

/**
 * Get the signoff input array that need to pass on server. Create the signoff info based on
 * input selected users.
 *
 * @param {data} selectedUsers - Selected users that need to be added as reviewers.
 *
 * @returns {Array} Signoff info array
 */
export let getSignoffInfo = function( selectedUsers ) {
    var signOffInfos = [];
    // Check if selected users  is not null and not empty then we need to iterate for
    // each object and create the signoff info SOA structure. Ignore if selected object is
    // of type user.
    if( selectedUsers && !_.isEmpty( selectedUsers ) ) {
        _.forEach( selectedUsers, function( userObject ) {
            // Check if selected obejct is user then no need to create input structure for user
            // object and if not user then create SOA input structure
            if( userObject !== null && userObject.modelType.typeHierarchyArray.indexOf( 'User' ) <= -1 ) {
                if( userObject.type === 'ResourcePool' ) {
                    userObject.uid = userObject.uniqueUid;
                }
                var signOffInfo = {
                    signoffMember: userObject,
                    origin: '',
                    signoffAction: 'SOA_EPM_Review',
                    originType: 'SOA_EPM_ORIGIN_UNDEFINED'
                };
                signOffInfos.push( signOffInfo );
            }
        } );
    }
    return signOffInfos;
};

/**
 * This factory creates a service and returns exports
 *
 * @member Awp0AddReviewer
 */

export default exports = {
    populatePanelData,
    setContextVariableForAddReviewer,
    getSignoffInfo
};
