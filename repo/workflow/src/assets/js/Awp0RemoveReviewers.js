// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0RemoveReviewers
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import policySvc from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import Awp0WorkflowAssignmentService from 'js/Awp0WorkflowAssignmentService';
import Awp0WorkflowAssignmentPanelService from 'js/Awp0WorkflowAssignmentPanelService';

let exports = {};
let resultMessageArr = [];

/**
 * Get getWorkflowTaskViewModel inputs
 * @param {Object} xrtState
 * 
 * @returns {Object} selectedTask
 * 
 */
export let getWorkflowTaskViewModelInputs = function (xrtState) {
    let vmo = {};
    let selectedTask = {};
    if (xrtState && xrtState.xrtVMO && ( xrtState.xrtVMO.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 || xrtState.xrtVMO.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1)) {
        vmo = xrtState.xrtVMO;
        if (vmo && vmo.props && vmo.props.fnd0ParentTask) {
            let taskUid = vmo.props.fnd0ParentTask.value;
            selectedTask = cdm.getObject(taskUid);
        } else if (vmo && vmo.type && vmo.type === 'EPMPerformSignoffTask') {
            selectedTask = vmo;
        } else if (vmo && vmo.modelType && vmo.modelType.typeHierarchyArray && vmo.modelType.typeHierarchyArray.indexOf('EPMTask') > -1 ) {
            selectedTask = vmo;
        }
    } else if ( xrtState && xrtState.workflowViewerContext ){
        if( xrtState.workflowViewerContext.rootTaskObject ) {
            selectedTask = xrtState.workflowViewerContext.rootTaskObject;
        }
    } else { 
        let { selectionData } = xrtState;
        if( selectionData && selectionData.selected[0] && selectionData.selected[0].props && selectionData.selected[0].props.fnd0ParentTask ) {
            selectedTask = cdm.getObject( selectionData.selected[0].props.fnd0ParentTask.value );
        } else{ 
            selectedTask = selectionData.selected[0];
        }
    }
    return selectedTask;
};

/**

 * method to add the verdicts for privileged users to context
 * 
 * @param {Object} data - view model data
 * @param {Object} subPanelContext - subPanelContext from the page
 * @param {Boolean} isWorkflowTabNonInboxLocation - true/False based on if user is in workflow tab non inbox location 
 */
export let updateVerdictToCtx = function (data, subPanelContext, isWorkflowTabNonInboxLocation) {
    if( (subPanelContext.showObjectContext && subPanelContext.xrtState) || isWorkflowTabNonInboxLocation ) {
        appCtxService.registerCtx('assignAllConditionVerdict', data.assignAllConditionVerdict === "true" ? true : false );
        appCtxService.registerCtx('removePrivilegeConditionVerdict', data.removePrivilegeConditionVerdict );
    } else {
        let xrtContext = {};
        let panelContext = {...subPanelContext};
        if( panelContext.xrtContext ) {
            xrtContext = panelContext.xrtContext;
        } else {
            xrtContext = panelContext;
        }
        xrtContext.assignAllConditionVerdict = data?.assignAllConditionVerdict  === "true";
        xrtContext.removePrivilegeConditionVerdict = data?.removePrivilegeConditionVerdict;
        if( xrtContext.isManageGroupCmd ) {
            subPanelContext && subPanelContext.update( xrtContext );
        } else {
            panelContext.xrtContext && panelContext.xrtContext.update( xrtContext );
        }
    }
};

export let unRegisterVerdicts = function (ctx) {
    if (ctx) {
        appCtxService.unRegisterCtx('preferenceVerdict');
        appCtxService.unRegisterCtx('conditionVerdict');
    }
};

/**
 * 
 * Function to generate message string for the non removable signoffs
 * @param {Object} resultObj
 * @param {Object} textBundle
 * 
 * @returns {String} messageString - message string containing all removables and their respective reasons
 */
var _GenerateNonRemovablesMessageString = function (resultObj, textBundle) {
    let userId = resultObj?.userId;
    let reason = resultObj?.reason;
    let message = "";
    if( reason === 'profile' ) {
        message = messagingService.applyMessageParams(textBundle?.nonRemovablesProfile, ['{{userId}}'], {
            userId: userId
        });
    } else if ( reason === 'required' ) {
        message = messagingService.applyMessageParams(textBundle.nonRemovablesRequired, ['{{userId}}'], {
            userId: userId
        });
    } else if ( reason === 'decisionMade' ) {
        message = messagingService.applyMessageParams(textBundle.nonRemovablesDecisionMade, ['{{userId}}'], {
            userId: userId
        });
    }
    resultMessageArr.push(message);
};

/**
 * Actual validate function for non removal checks
 * @param {Object} selectedReviewer
 * @param {Object} localTextBundle
 * @param {Boolean} isAssignmentsPanelCase
 * 
 * @returns {Object} - with name of the non removal signoff and reason for it
 */
var _validateCasesForRemoval = function (selectedReviewer, localTextBundle, isAssignmentsPanelCase) {
    let resultObj = {};
    let userId = "";
    let reason = "";
    if (selectedReviewer?.props) {
        if ( (selectedReviewer?.props?.origin?.dbValue)
            || (selectedReviewer?.assignmentObject?.signoffProfile?.uid) ) {
            reason = "profile";
        } else if ((selectedReviewer?.props?.decision?.dbValues?.[0] !== undefined && selectedReviewer?.props?.decision?.dbValues?.[0] !== '0')
            || ((selectedReviewer?.props?.decision === undefined || selectedReviewer?.props?.decision?.dbValues === undefined) && selectedReviewer?.assignmentObject 
            && selectedReviewer?.assignmentObject?.isDecisionMade && selectedReviewer?.assignmentObject?.isDecisionMade !== localTextBundle?.no_decision)) {
                reason = "decisionMade";
        } else if ( ( selectedReviewer?.props?.fnd0DecisionRequired?.dbValues?.[0] !== undefined && selectedReviewer?.props?.fnd0DecisionRequired?.dbValues?.[0] !== 'Optional' ) 
            || ( selectedReviewer?.assignmentObject?.isRequired !== undefined && selectedReviewer?.assignmentObject?.isRequired !== false ) ) {
            reason = "required";
        }
        if (!_.isEmpty( reason )) {
            userId = selectedReviewer?.props?.object_string?.dbValues?.[0];
        }
        if (!_.isEmpty(userId) && !_.isEmpty(reason)) {
            resultObj.userId = userId;
            resultObj.reason = reason;
            if(!_.isEmpty(resultObj) && !_.isEmpty(localTextBundle)){
                _GenerateNonRemovablesMessageString(resultObj, localTextBundle);
            }
        }
    }
    return resultObj;
};

/**
 * Function for validating client side checks for remove reviewers. 
 * This func will do validations for profile, decision made and required users.
 * @param {Array} selectedReviewers
 * @param {Object} context 
 * @param {Object} commandContext
 * @param {Object} subPanelContext 
 * @param {String} requiredString
 */
export let checkCasesForRemoveReviewers = function (selectedReviewers, context, commandContext, subPanelContext, requiredString) {
    let validRemovals = [];
    let isAssignmentsTabCase = false;
    let isAssignmentsPanelCase = false;
    let invalidRemovalsMap = new Object();
    let resource = '/i18n/InboxMessages';
    let localTextBundle = localeSvc.getLoadedText(resource);
    let totalSelected = 0;
    let totalRemovables = 0;
    let taskUid = "";
    let selectedTask = {};
    let signoff_quorum = 0;
    let quorumMet = {};
    resultMessageArr = [];
    if (selectedReviewers && selectedReviewers.length > 0) {
        totalSelected = selectedReviewers.length;
    } else if (context && context.selected) {
        selectedReviewers = context.selected;
        totalSelected = selectedReviewers.length;
    }
    if (context && context.parentChildMap) {
        isAssignmentsTabCase = true;
    } else if (context && context.propName && context.taskObject) {
        isAssignmentsPanelCase = true;
    }
    if (selectedReviewers && selectedReviewers[0] && selectedReviewers[0]._childObj && selectedReviewers[0]._childObj.uid) {
        taskUid = selectedReviewers[0]._childObj.uid;
    } else if (isAssignmentsPanelCase) {
        if (context && context.taskObject && context.taskObject.taskUid) {
            taskUid = context.taskObject.taskUid;
        }
    }
    if (taskUid) {
        selectedTask = cdm.getObject(taskUid);
        if (selectedTask && selectedTask.props && selectedTask.props.signoff_quorum && selectedTask.props.signoff_quorum.dbValues && selectedTask.props.signoff_quorum.dbValues[0]) {
            signoff_quorum = parseInt(selectedTask.props.signoff_quorum.dbValues[0]);
        }
    }
    _.forEach(selectedReviewers, function (selectedRev) {
        let checkCases = _validateCasesForRemoval(selectedRev, localTextBundle, isAssignmentsPanelCase);
        if (_.isEmpty(checkCases)) {
            if (isAssignmentsTabCase) {
                if (selectedRev && selectedRev._childObj && selectedRev._childObj.uid === taskUid && selectedRev.assignmentType !== 'assignee') {
                    validRemovals.push(selectedRev);
                }
            } else if (isAssignmentsPanelCase) {
                if (selectedRev && selectedRev.assignmentObject && selectedRev.assignmentObject.assignmentType !== 'assignee') {
                    validRemovals.push(selectedRev);
                } else if (selectedRev && selectedRev.assignmentObject === null) {
                    validRemovals.push(selectedRev);
                }
            } else {
                validRemovals.push(selectedRev);
            }
        } else {
            invalidRemovalsMap[checkCases.userId] = checkCases.reason;
        }
    });
    if (validRemovals.length > 0) {
        totalRemovables = validRemovals.length;
    }
    // if valid removals and one non removals present show the warning message with cancel and proceed button
    if (validRemovals.length > 0 && !_.isEmpty(invalidRemovalsMap)) {
        let message = messagingService.applyMessageParams(localTextBundle.someRemovable, ['{{totalRemovables}}', '{{totalSelected}}'], {
            totalRemovables: totalRemovables,
            totalSelected: totalSelected
        });
        let buttons = [{
            addClass: 'btn btn-notify',
            text: localTextBundle.cancel,
            onClick: function ($noty) {
                resultMessageArr = [];
                $noty.close();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: localTextBundle.proceed,
            onClick: function ($noty) {
                resultMessageArr = [];
                if (!isAssignmentsTabCase && !isAssignmentsPanelCase) {
                    eventBus.publish('callRemoveSignoffsSOA', {
                        validRemovals: validRemovals,
                        commandContext: context
                    });
                } else if (isAssignmentsTabCase) {
                    if (quorumMet.result || signoff_quorum <= 0 ) {
                        Awp0WorkflowAssignmentService.removeTaskAssignmentPST(validRemovals, context);
                    } else {
                        _populateQuorumNotMetMessage(quorumMet.signoffQuorum, quorumMet.removableReviewersCount, localTextBundle, commandContext, quorumMet.removableReviewers);
                    }
                } else if (isAssignmentsPanelCase) {
                    if (quorumMet.result || signoff_quorum <= 0 ) {
                        Awp0WorkflowAssignmentPanelService.removeUsersTaskAssignment(context, validRemovals, subPanelContext, requiredString);
                    } else {
                        _populateQuorumNotMetMessage(quorumMet.signoffQuorum, quorumMet.removableReviewersCount, localTextBundle, commandContext, quorumMet.removableReviewers);
                    }
                }
                $noty.close();
            }
        }];
        if (resultMessageArr.length > 0) {
            message = message + '</br>';
            _.forEach(resultMessageArr, function (resultMessage) {
                message = message.concat(resultMessage).concat('</br>');
            });
        }
        if (isAssignmentsPanelCase || isAssignmentsTabCase) {
            quorumMet = {};
            if( signoff_quorum > 0 ) {
                quorumMet = _checkQuorumCriteria(validRemovals, selectedTask, context);
            }
        }
        notyService.showWarning(message, buttons);
    } else if (validRemovals.length > 0 && _.isEmpty(invalidRemovalsMap)) {
        if (!isAssignmentsTabCase && !isAssignmentsPanelCase) {
            eventBus.publish('callRemoveSignoffsSOA', {
                validRemovals: validRemovals,
                commandContext: context
            });
        } else if (isAssignmentsTabCase) {
            quorumMet = {};
            if( signoff_quorum > 0 ) {
                quorumMet = _checkQuorumCriteria(validRemovals, selectedTask, context);
            }
            if (quorumMet.result || signoff_quorum <= 0) {
                Awp0WorkflowAssignmentService.removeTaskAssignmentPST(validRemovals, context);
            } else {
                _populateQuorumNotMetMessage(quorumMet.signoffQuorum, quorumMet.removableReviewersCount, localTextBundle, commandContext, quorumMet.removableReviewers);
            }
        } else if (isAssignmentsPanelCase) {
            quorumMet = {};
            if( signoff_quorum > 0 ) {
                quorumMet = _checkQuorumCriteria(validRemovals, selectedTask, context);
            }
            if (quorumMet.result || signoff_quorum <= 0) {
                Awp0WorkflowAssignmentPanelService.removeUsersTaskAssignment(context, validRemovals, subPanelContext, requiredString);
            } else {
                _populateQuorumNotMetMessage(quorumMet.signoffQuorum, quorumMet.removableReviewersCount, localTextBundle, commandContext, quorumMet.removableReviewers);
            }
        }
    } else if (!validRemovals.length > 0 && !_.isEmpty(invalidRemovalsMap)) {
        let message = messagingService.applyMessageParams(localTextBundle.noneRemovable);
        let buttons = [{
            addClass: 'btn btn-notify',
            text: localTextBundle.cancel,
            onClick: function ($noty) {
                resultMessageArr = [];
                $noty.close();
            }
        }];
        if (resultMessageArr.length > 0) {
            message = message + '</br>';
            _.forEach(resultMessageArr, function (resultMessage) {
                message = message.concat(resultMessage).concat('</br>');
            });
        }
        notyService.showWarning(message, buttons);
    }
};

/**
 * Get the PST object from the selected object
 * 
 * @param {Object} commandContext - commandContext
 * @param {Array} validRemovalSignoffs
 * @returns {Object} pstObject that will be used to open.
 */
export let getRemoveSignoffsInput = function (commandContext, validRemovalSignoffs) {
    let pstObject = null;
    let signoffObjs = [];
    let vmo = null;
    let selectedObject = null;
    let signoffs = {};
    if (commandContext && commandContext.vmo && commandContext.selectionData && commandContext.selectionData.value && commandContext.selectionData.value.selected[0]) {
        vmo = commandContext.vmo;
        selectedObject = validRemovalSignoffs;
    } else if (commandContext && commandContext.anchor === 'aw_contextMenu2' && commandContext.selected[0]) {
        vmo = commandContext?.openedObject !== undefined ? commandContext.openedObject : commandContext.selected[0];
        selectedObject = validRemovalSignoffs;
    }
    if (!selectedObject || selectedObject.length < 0 || !vmo || !vmo.uid) {
        return pstObject;
    }
    if ((vmo && vmo.modelType && vmo.modelType.typeHierarchyArray && vmo.modelType.typeHierarchyArray.indexOf('Signoff') > -1) || ( vmo?.modelType?.typeHierarchyArray?.indexOf('EPMTask') <= -1 && commandContext.anchor === 'aw_contextMenu2')) {
        if (vmo && vmo.props && vmo.props.fnd0ParentTask && vmo.props.fnd0ParentTask.dbValues.length > 0) {
            pstObject = cdm.getObject(vmo.props.fnd0ParentTask.dbValues[0]);
        } else {
            let signoffObj = cdm.getObject(vmo?.props?.awp0Primary?.dbValues[0]);
            if( signoffObj?.type === 'Signoff') {
                pstObject = cdm.getObject( signoffObj?.props?.fnd0ParentTask?.dbValues[0] );
            } else if ( signoffObj?.type === 'EPMPerformSignoffTask' ){
                pstObject = signoffObj;
            }
        }
    } else if (vmo && vmo.modelType && vmo.modelType.typeHierarchyArray && vmo.modelType.typeHierarchyArray.indexOf('EPMPerformSignoffTask') > -1 ) {
        pstObject = cdm.getObject(vmo.uid);
    } else if (vmo && vmo.modelType && vmo.modelType.typeHierarchyArray && vmo.modelType.typeHierarchyArray.indexOf('EPMTask')) {
        let taskObj = vmo;
        if( taskObj && taskObj.props && taskObj.props.child_tasks && taskObj.props.child_tasks.dbValue ) {
            let childTasks = taskObj.props.child_tasks.dbValue;
            _.forEach( childTasks, function( childTask ){
                let childTaskObj = cdm.getObject( childTask );
                if( childTaskObj && childTaskObj.type && childTaskObj.type === 'EPMPerformSignoffTask') {
                    pstObject = childTaskObj;
                }
            });
        }
    }
    _.forEach(validRemovalSignoffs, function (selected) {
        if (selected && selected.props && selected.props.awp0Secondary && selected.props.awp0Secondary.dbValues.length > 0) {
            let selObj = cdm.getObject(selected.props.awp0Secondary.dbValues[0]);
            signoffObjs.push(selObj);
        }
    });
    signoffs = {
        task: pstObject,
        removeSignoffObjs: signoffObjs
    };
    return signoffs;
};

/**
 * function to call removeSignoffs SOA
 * 
 * @param {Object} commandContext  - command context
 * @param {Array} validRemovalSignoffs - valid removal signoffs from the table
 * @param {Object} ctx - ctx 
 */
export let removeSignoffsAction = function (commandContext, validRemovalSignoffs, ctx) {
    let buttons = []; 
    let resource = '/i18n/InboxMessages';
    let localTextBundle = localeSvc.getLoadedText(resource);
    let input = {
        signoffs: []
    };
    input.signoffs[0] = getRemoveSignoffsInput(commandContext, validRemovalSignoffs);
    soaSvc.postUnchecked('Workflow-2008-06-Workflow', 'removeSignoffs', input).then(
        function (response) {
            if (response !== null) {
                if (response.partialErrors && response.partialErrors[0] && response.partialErrors[0].errorValues && response.partialErrors[0].errorValues[0]) {
                    let errorObj = response.partialErrors[0].errorValues[0];
                    let errormsg = errorObj.message;
                    if (errorObj.code === 33512 || errorObj.code === 33515) {
                        if (input.signoffs[0].removeSignoffObjs.length > 1) {
                            buttons = [{
                                addClass: 'btn btn-notify',
                                text: localTextBundle.cancel,
                                onClick: function ($noty) {
                                    resultMessageArr = [];
                                    $noty.close();
                                }
                            }];
                        } else {
                            buttons = [{
                                addClass: 'btn btn-notify',
                                text: localTextBundle.cancel,
                                onClick: function ($noty) {
                                    resultMessageArr = [];
                                    $noty.close();
                                }
                            },
                            {
                                addClass: 'btn btn-notify',
                                text: localTextBundle.replace,
                                onClick: function ($noty) {
                                    replaceReviewerAction(commandContext);
                                    $noty.close();
                                }
                            }];
                        }
                        notyService.showWarning(errormsg, buttons);
                    }
                    else {
                        notyService.showError(errormsg);
                    }
                }
                else {
                    let isProcessOwnerDeleteCase = false;
                    let removedSignoffs = input.signoffs[0].removeSignoffObjs;
                    if( removedSignoffs.some( signoffs => signoffs.uid === commandContext?.openedObject?.uid ) && commandContext?.openedObject?.type === 'Signoff'){
                        isProcessOwnerDeleteCase = true;
                    }
                    eventBus.publish('primaryWorkarea.reset');
                    if( !isProcessOwnerDeleteCase ) {
                        eventBus.publish('cdm.relatedModified', {
                            refreshLocationFlag: true,
                            relatedModified: [
                                ctx.xrtSummaryContextObject
                            ],
                            createdObjects: response.modelObjects
                        });
                    }
                }
            }
        });
};


/**
 * Function to show the replace panel when replace button is clicked from quorum/singleSignoff noty message
 * 
 * @param {Object} commandContext 
 * 
 */
export let replaceReviewerAction = function (commandContext) {
    let selectedObj = "";
    let signoffObj = "";
    let signoffInput = {};
    //get the signoff object from the selectionData to load the signoff properties
    if (commandContext && commandContext.selectionData && commandContext.selectionData.selected && commandContext.selectionData.selected[0]) {
        selectedObj = commandContext.selectionData.selected[0];
    } else if( commandContext && commandContext.selected && commandContext.selected[0] ) {
        selectedObj = commandContext.selected[0];
    }
    if (selectedObj && selectedObj.props && selectedObj.props.awp0Secondary && selectedObj.props.awp0Secondary.dbValues.length > 0) {
        signoffObj = cdm.getObject(selectedObj.props.awp0Secondary.dbValues[0]);
        if (signoffObj.type && signoffObj.uid) {
            signoffInput.type = signoffObj.type;
            signoffInput.uid = signoffObj.uid;
        }
    }
    let policyId = policySvc.register({
        types: [{
            name: 'EPMSignoffProfile',
            properties: [{
                name: 'number_of_signoffs'
            },
            {
                name: 'allow_subgroups'
            },
            {
                name: 'group',
                modifiers: [{
                    name: 'withProperties',
                    Value: 'true'
                }]
            },
            {
                name: 'role',
                modifiers: [{
                    name: 'withProperties',
                    Value: 'true'
                }]
            }
            ]
        },
        {
            name: 'Role',
            properties: [{
                name: 'role_name'
            }]
        },
        {
            name: 'Group',
            properties: [{
                name: 'object_full_name'
            }]
        },
        {
            name: 'Signoff',
            properties: [{
                name: 'origin',
                modifiers: [{
                    name: 'withProperties',
                    Value: 'true'
                }]
            },
            {
                name: 'fnd0ParentTask'
            }
            ]
        }
        ]
    });
    return dmSvc.getPropertiesUnchecked([signoffInput], ['fnd0ParentTask', 'origin']).then(function (response) {
        if (policyId) {
            policySvc.unregister(policyId);
        }
        let dialogAction = appCtxSvc.getCtx('globalDialog');
        let options = {
            view: 'Awp0ReassignTask',
            placement: 'right',
            parent: '.aw-layout-workareaMain',
            width: 'STANDARD',
            height: 'FULL',
            push: false,
            subPanelContext: commandContext,
            isCloseVisible: false
        };
        dialogAction.show(options);
    });
};

/**
 * This function will check for quorum criteria when removing a reviewers from PST
 * @param {Array} validRemovals
 * @param {Object} selectedTask
 * 
 * @returns {Object} result - true / false based on quorum met or not and signoff_quorum
 */
var _checkQuorumCriteria = function (validRemovals, selectedTask, context) {
    let totalNoOfReviewers = 0;
    let quorumMet = {};
    let removableReviewersCount = validRemovals.length;
    totalNoOfReviewers = _getTotalNoOfReviewersOnTask(selectedTask.uid, context);
    if (selectedTask && selectedTask.props && selectedTask.props.signoff_quorum && selectedTask.props.signoff_quorum.dbValues && selectedTask.props.signoff_quorum.dbValues[0]) {
        let signoffQuorum = parseInt(selectedTask.props.signoff_quorum.dbValues[0]);
        quorumMet.signoffQuorum = signoffQuorum;
        quorumMet.removableReviewersCount = removableReviewersCount;
        quorumMet.removableReviewers = validRemovals;
        let reviewersAfterRemoval = totalNoOfReviewers - removableReviewersCount;
        if (reviewersAfterRemoval < signoffQuorum) {
            quorumMet.result = false;
        } else {
            quorumMet.result = true;
        }
    }
    return quorumMet;
};

/**
 * This function will return the total no of reviewers on a particular task 
 * @param {} taskUid - selectedTask uid
 * @param {Object} context - panel / table context
 * @returns {Number} totalNoOfReviewers
 */
var _getTotalNoOfReviewersOnTask = function (taskUid,context) {
    let totalReviewers = 0;
    let assignmentTypes = [];
    let taskData = {};
    if (context && context.taskAssignmentDataObject && context.taskAssignmentDataObject.taskInfoMap && context.taskAssignmentDataObject.taskInfoMap[taskUid]) {
        taskData = context.taskAssignmentDataObject.taskInfoMap[taskUid];
    } else if (context && context.assignmentState && context.assignmentState.taskAssignmentDataObject && context.assignmentState.taskAssignmentDataObject.taskInfoMap 
        && context.assignmentState.taskAssignmentDataObject.taskInfoMap[taskUid]) {
        if (context.subPanelContext) {
            taskData = context.subPanelContext;
        }
    }
    if (taskData && taskData.props) {
        assignmentTypes = Object.keys(taskData.props);
        _.forEach(assignmentTypes, function (assignmentType) {
            if (taskData && taskData.props && taskData.props[assignmentType] && taskData.props[assignmentType].modelObjects) {
                if (assignmentType !== 'reviewers' && assignmentType !== 'assignee' && assignmentType !== 'assigner') {
                    totalReviewers += taskData.props[assignmentType].modelObjects.length;
                } else if (assignmentType === 'reviewers') {
                    let modelObjs = {};
                    if (taskData.props[assignmentType].profileObjects) {
                        let profileObjects = taskData.props[assignmentType].profileObjects;
                        modelObjs = _.differenceBy(taskData.props[assignmentType].modelObjects, profileObjects, 'uid');
                    } else {
                        modelObjs = taskData.props[assignmentType].modelObjects;
                    }
                    totalReviewers += modelObjs.length;
                }
            }
        });
    }
    return totalReviewers;
};

/**
 * Function to show quorum error message from client when removing reviewers from PST
 * @param {} signoff_quorum - quorum value
 * @param {} removableReviewersCount - no of removable reviewers
 * @param {} localTextBundle - quorum message to be seen on the UI
 * @param {Object} commandContext 
 * @param {Map} removableReviewers
 */
var _populateQuorumNotMetMessage = function (signoff_quorum, removableReviewersCount, localTextBundle, commandContext, removableReviewers) {
    let totalReviewersSelected = 0;
    let message = {};
    let buttons1 = [{
        addClass: 'btn btn-notify',
        text: localTextBundle.cancel,
        onClick: function ($noty) {
            $noty.close();
        }
    }];
    let buttons2 = [{
        addClass: 'btn btn-notify',
        text: localTextBundle.cancel,
        onClick: function ($noty) {
            $noty.close();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: localTextBundle.replace,
        onClick: function ($noty) {
            eventBus.publish('openReplacePanelFromMessage', {
                commandContext: commandContext
            });
            $noty.close();
        }
    }];
    if (removableReviewersCount > 1 || totalReviewersSelected > 1) {
        message = messagingService.applyMessageParams(localTextBundle.assignmentsQuorumNotMet, ['{{signoff_quorum}}'], {
            signoff_quorum: signoff_quorum
        });
        notyService.showWarning(message, buttons1);
    } else {
        let userId = "";
        if( removableReviewers && removableReviewers[0] && removableReviewers[0].props 
            && removableReviewers[0].props.object_string && ( removableReviewers[0].props.object_string.dbValue || removableReviewers[0].props.object_string.dbValues ) ) {
                userId = removableReviewers[0].props.object_string.dbValue ? removableReviewers[0].props.object_string.dbValue : removableReviewers[0].props.object_string.dbValues[0];
            }
        message = messagingService.applyMessageParams(localTextBundle.assignmentsQuorumNotMetSingleCase, ['{{userId}}','{{signoff_quorum}}'], {
            userId : userId,
            signoff_quorum: signoff_quorum
        });
        notyService.showWarning(message, buttons2);
    }
};

export default exports = {
    getWorkflowTaskViewModelInputs,
    updateVerdictToCtx,
    checkCasesForRemoveReviewers,
    replaceReviewerAction,
    getRemoveSignoffsInput,
    removeSignoffsAction
};
