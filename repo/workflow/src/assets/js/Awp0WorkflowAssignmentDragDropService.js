// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowAssignmentDragDropService
 */
import appCtxSvc from 'js/appCtxService';
import localStrg from 'js/localStorage';
import assignmentPanelSvc from 'js/Awp0WorkflowAssignmentPanelService';
import assignmentSvc from 'js/Awp0WorkflowAssignmentService';
import viewModelService from 'js/viewModelObjectService';
import workflowAssinmentUtilSvc from 'js/Awp0WorkflowAssignmentUtils';
import eventBus from 'js/eventBus';
import awDragAndDropService from 'js/awDragAndDropService';

import _ from 'lodash';

let exports = {};

var _sourceDataProvider = null;
var _baseActiveFiltersStructure = null;


/**
  * Clear the cache after drop option is completed
  */
const clearCachedData = () => {
    localStrg.removeItem( 'userDraggedListData' );
};

/**
  * Delighlight the element once drop action is completed.
  */
const dehighlightElement = ( dragAndDropParams ) => {
    var allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            dragAndDropParams.callbackAPIs.highlightTarget( {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
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
    if( obj && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
  * This function needs to do the matching for profiles task supports and based on source objects that
  * are being drop. This function need to be enhanced.
  *
  * @param {Array} taskProfiles Task profiles array this task supports.
  * @param {Array} sourceObjects Source objects that are being dropped.
  *
  * @returns {boolean} True or false
  */
var _isProfileGroupRoleMatching = function( taskProfiles, sourceObjects ) {
    var isMatching = false;
    var object = sourceObjects[0];
    var groupObject = _.find( taskProfiles, function( profile ) {
        return profile.props.group.dbValue === object.props.group.dbValue;
    } );
    var roleObject = _.find( taskProfiles, function( profile ) {
        return profile.props.role.dbValue === object.props.role.dbValue;
    } );
    if( groupObject && roleObject ) {
        isMatching = true;
    }
    return isMatching;
};

/**
  * Get all objects that need to be dropped
  * @returns {Array} Source objects that are being dropped.
  */
var _getDropObjects = function( ) {
    let dragDataJSON = localStrg.get( 'userDraggedListData' );
    let dragObjects = [];
    let sourceObjects = null;
    if( dragDataJSON && dragDataJSON !== 'undefined' ) {
        sourceObjects = JSON.parse( dragDataJSON );
    }
    // Check if source objects is not null and contains UID list then get the object from UID
    if( sourceObjects ) {
        sourceObjects.forEach( ( sourceObject ) => {
            let object = awDragAndDropService.getTargetObjectByUid(  sourceObject.uid );
            if( object ) {
                dragObjects.push( object );
            }
        } );
    }
    return dragObjects;
};

/**
  * Check if we are in PAL drag and drop case then we need to see if PAL is in edit mode or not
  * @param {Object} props Props context object
  *
  * @returns {boolean} True/False
  */
var isInvalidTargetDropPALCase = function( props ) {
    // Check if user is trying to do PAL assignment then we need to check if PAL can be modifeid
    // or not and based on isPriviledgeToModify value return true or false.
    if( props.workflowPalState && appCtxSvc.ctx && appCtxSvc.ctx.workflowPalData ) {
        return !( props.workflowPalState.value.isPriviledgeToModify && appCtxSvc.ctx.workflowPalData.isInEditMode );
    }
};
/**
  * Validate that objects that are being drop are valid objects for specific target and these objects
  * can be dropped.
  *
  * @param {Object} dragAndDropParams Drag and drop param object that conatin all values related to drag and drop
  * @param {Object} props Props context object
  *
  * @returns {boolean} True or False
  */
var _isInValidTargetToDrop = function( dragAndDropParams, props ) {
    let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
    // If target object is key role that it's invalid. This is mainly for case when we show DP in assignee or
    // column for example and this value can't be replace.
    if( targetObject && targetObject.type === 'KeyRole' ) {
        return true;
    }

    // Check if user is trying to do PAL assignment then we need to check if PAL can be modifeid
    // or not and based on isPriviledgeToModify value return true or false.
    if( props.workflowPalState ) {
        return isInvalidTargetDropPALCase( props );
    }

    var taskInfoObject = null;
    if( props && props.taskInfoObject && props.taskInfoObject.value ) {
        taskInfoObject = { ...props.taskInfoObject.value };
    }

    // Check if user is trying to drop on assingee data provider which is using DP then it's invalid and return true from here
    if( taskInfoObject && dragAndDropParams.dataProvider.name === 'assignerDataProvider' && taskInfoObject.props.assignee.supportedDPTypes
     && taskInfoObject.props.assignee.supportedDPTypes.length > 0 ) {
        return true;
    }
    // Check if target is view model tree node then check the target task state. If completed then it's invalid to drop
    if( targetObject && targetObject._childObj ) {
        var isTargetTaskCompleted = workflowAssinmentUtilSvc.isTaskCompleted( targetObject._childObj );
        if( isTargetTaskCompleted ) {
            return true;
        }
    }

    // Check if target object is task and it's values can't be modified either due to priviledge or task is completed then
    // it will return true from here
    if( taskInfoObject  && taskInfoObject.taskObject ) {
        var isNonModified = workflowAssinmentUtilSvc.isTaskAssignmentNonModified( taskInfoObject.taskObject, props.subPanelContext.assignmentState );
        if( isNonModified || targetObject && targetObject._childObj && targetObject._childObj.uid === taskInfoObject.taskObject.uid ) {
            return isNonModified;
        } else if( targetObject && targetObject._childObj && targetObject._childObj.uid !== taskInfoObject.taskObject.uid ) {
            return workflowAssinmentUtilSvc.isTaskAssignmentNonModified( targetObject._childObj, props.subPanelContext.assignmentState );
        }
    }
    return false;
};

/**
  * Validate that objects that are being drop are valid objects for specific target and these objects
  * can be dropped. Check if target data provider is null or source object is null or invaid object is being drop
  * then return trye from here.
  *
  * @param {Object} dragAndDropParams Drag and drop param object that conatin all values related to drag and drop
  * @param {Object} props Props context object
  *
  * @returns {boolean} True or False
  */
var isInvalidDropObject = function( dragAndDropParams, props ) {
    if( !dragAndDropParams || !dragAndDropParams.dataProvider ) {
        return true;
    }

    let sourceObjects = _getDropObjects();
    if( !sourceObjects || !sourceObjects[ 0 ] ) {
        return true;
    }

    var isInvalidTarget = _isInValidTargetToDrop( dragAndDropParams, props );
    if( isInvalidTarget ) {
        return true;
    }

    // Check if source object being drop is not user or resource pool or group member then it's invalid
    // object and return true from here
    if( !isOfType( sourceObjects[ 0 ], 'User' ) && !isOfType( sourceObjects[ 0 ], 'GroupMember' )
     && !isOfType( sourceObjects[ 0 ], 'ResourcePool' ) ) {
        return true;
    }
    return false;
};

/**
  * If invalid obejct is being drop then it will return drop effect as none else it will
  * return as copy.
  *
  * @param {Object} props Props object
  * @param {Object} dragAndDropParams Drag and drop parameters
  *
  * @returns {Object} Drop effect object
  */
export const dragOverAssignmentAction = ( props, dragAndDropParams ) => {
    dehighlightElement( dragAndDropParams );
    if( isInvalidDropObject( dragAndDropParams, props ) ) {
        return {
            dropEffect: 'none'
        };
    }
    if( dragAndDropParams.dataProvider ) {
        dragAndDropParams.callbackAPIs.highlightTarget( {
            isHighlightFlag: true,
            targetElement: dragAndDropParams.targetElement
        } );
        return {
            dropEffect: 'copy',
            stopPropagation: true,
            preventDefault : true
        };
    }
    return {
        dropEffect: 'none'
    };
};

/**
  * Clear the highlight and cached source data
  * @param {Object} dragAndDropParams Drag and drop parameters
  */
var _clearDropdata = function( dragAndDropParams ) {
    dragAndDropParams.callbackAPIs.highlightTarget( {
        isHighlightFlag: false,
        targetElement: dragAndDropParams.targetElement
    } );
    // If source data provider is not null then select no object once drop action completed
    if( _sourceDataProvider ) {
        _sourceDataProvider.selectNone();
        _sourceDataProvider = null;
    }
    clearCachedData();
};

export let dragOverParticipantAction = ( dragAndDropParams ) => {
    dehighlightElement( dragAndDropParams );
    return {
        dropEffect: 'none',
        stopPropagation: true,
        preventDefault : true
    };
};

/**
  * Do the actual drop action to add the objects on section or assignment table
  * @param {Object} props Props context object
  * @param {Object} dragAndDropParams Drag and drop parameters
  */
export const dropOnAssignmentAction = ( props, dragAndDropParams ) => {
    // These two is really needed as their is one specific issue for firefox where drop object is
    // being opened. Fix for defect # LCS-663809
    dragAndDropParams.event.stopPropagation();
    dragAndDropParams.event.preventDefault();
    let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
    let sourceObjects = _getDropObjects();
    var dataProvider = dragAndDropParams.dataProvider;
    if( !dataProvider ) {
        _clearDropdata( dragAndDropParams );
        return;
    }
    var sourceVMOs = [];
    _.forEach( sourceObjects, function( sourceObject ) {
        var vmoObject = viewModelService.createViewModelObject( sourceObject );
        if( vmoObject ) {
            sourceVMOs.push( vmoObject );
        }
    } );
    // If user is dropping on assignment tree table then update the task assignment directly else if dropping
    // on category panel then update the panel only
    if( dataProvider.name === 'treeTasksTemplateDataProvider' ) {
        assignmentSvc.addTaskAssignmentsOnTable( targetObject, sourceVMOs, props, _baseActiveFiltersStructure );
        _clearDropdata( dragAndDropParams );
        return;
    }
    // Check if user is trying to do PAL assignment then we need to check if PAL can be modified
    // or not and based on isPriviledgeToModify value return true or false.
    if( props.workflowPalState && props.workflowPalState.isPriviledgeToModify && props.addUserPanelState ) {
        // Call this method to get the correct group member based on current context criteria group or role from user if user obejct is
        // being dispalyed on user picker panel then use that to get correct group member and add it to table
        workflowAssinmentUtilSvc.getValidObjectsToAdd( props.addUserPanelState.criteria, sourceVMOs, _baseActiveFiltersStructure ).then( function( validObjects ) {
            const localTaskInfo = { ...props.taskInfoObject.value };
            localTaskInfo.updateDropPropContext = {
                sourceVMOs : validObjects,
                dataProvider : dataProvider
            };
            props.taskInfoObject.update && props.taskInfoObject.update( localTaskInfo );
            _clearDropdata( dragAndDropParams );
        } );
    } else {
        assignmentPanelSvc.addDropUsersOnPanel( sourceVMOs, dataProvider, props, _baseActiveFiltersStructure );
        _clearDropdata( dragAndDropParams );
    }
};

/**
  * Get the project obejct based on selcted tab and selection from project field
  * from UI and return that object.
  *
  * @param {Object} props Props context object
  *
  * @returns {Object} baseActiveFiltersStructure Filter object that contains
  * applied active filters along with active filter map.
  */
var _getActiveProjectFilterStructure = function( props ) {
    var baseActiveFiltersStructure = {};
    // Check if search state is not null then get the active filters and active

    // filter map and then return the filter object.
    if( props && props.subPanelContext && props.subPanelContext.searchState ) {
        baseActiveFiltersStructure = {
            activeFilters: { ...props.subPanelContext.searchState.activeFilters },
            activeFilterMap: { ...props.subPanelContext.searchState.activeFilterMap }
        };
    }
    return baseActiveFiltersStructure;
};

/**
  * Drag start action when panel is trying to drag user we need to get
  * active filters applied on panel and then get the objects user is trying
  * to drag.
  *
  * @param {Object} props Props context object
  * @param {Object} dnDParams Drag and drop parameters
  */
export let dragUserAssignmentAction = ( props, dnDParams ) => {
    if( dnDParams.dataProvider && dnDParams.declViewModel ) {
        _sourceDataProvider = dnDParams.dataProvider;
        // Populate applied filters on people picker panel
        _baseActiveFiltersStructure = _getActiveProjectFilterStructure( props );
    }
    localStrg.publish( 'userDraggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

export default exports = {
    dropOnAssignmentAction,
    dragOverAssignmentAction,
    dragUserAssignmentAction,
    dragOverParticipantAction
};

