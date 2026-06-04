// Copyright (c) 2023 Siemens

/**
 * @module js/Awp0TaskAssignmentTable
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import clientDataModel from 'soa/kernel/clientDataModel';
import policySvc from 'soa/kernel/propertyPolicyService';
import vmcs from 'js/viewModelObjectService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import awTableStateService from 'js/awTableStateService';
import iconSvc from 'js/iconService';
import commandPanelService from 'js/commandPanel.service';
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import listBoxService from 'js/listBoxService';
import _ from 'lodash';
import dataManagementService from 'soa/dataManagementService';
import uwPropertySvc from 'js/uwPropertyService';
import wrkflwAssignmentSvc from 'js/Awp0WorkflowAssignmentService';
import workflowAssinmentUtilSvc from 'js/Awp0WorkflowAssignmentUtils';
import localeSvc from 'js/localeService';

/**
 * A list of what should be exported.
 */
var exports = {};

/**
 * Cached static default AwTableColumnInfo.
 */
var _treeTableColumnInfos = null;

var _taskAssignPropPolicy = null;
var _multiUserTasks = [ 'EPMReviewTask', 'EPMRouteTask', 'EPMAcknowledgeTask', 'EPMReviewTaskTemplate', 'EPMRouteTaskTemplate', 'EPMAcknowledgeTaskTemplate' ];

/**
 * @param {data} data data
 * @param {boolean} isNarrowViewMode narrow mode active or not
 *
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos( tableColumns, isStartEnabled, panelId ) {
    _treeTableColumnInfos = _buildTreeTableColumnInfos( tableColumns, isStartEnabled, panelId );
    return _treeTableColumnInfos;
}

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
    if ( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

var hasNextLevelTask = function( obj ) {
    if ( isOfType( obj, 'EPMDoTask' ) || isOfType( obj, 'EPMReviewTask' ) || isOfType( obj, 'EPMAcknowledgeTask' ) ||
        isOfType( obj, 'EPMRouteTask' ) || isOfType( obj, 'EPMConditionTask' ) ||
        isOfType( obj, 'EPMDoTaskTemplate' ) || isOfType( obj, 'EPMReviewTaskTemplate' ) ||
        isOfType( obj, 'EPMAcknowledgeTaskTemplate' ) || isOfType( obj, 'EPMRouteTaskTemplate' ) ||
        isOfType( obj, 'EPMConditionTaskTemplate' ) ) {
        return false;
    }
    return true;
};

var isRouteReviewAcknowledge = function( selected ) {
    if ( isOfType( selected, 'EPMReviewTask' ) || isOfType( selected, 'EPMAcknowledgeTask' ) || isOfType( selected, 'EPMRouteTask' ) ||
        isOfType( selected, 'EPMReviewTaskTemplate' ) || isOfType( selected, 'EPMAcknowledgeTaskTemplate' ) || isOfType( selected, 'EPMRouteTaskTemplate' ) ) {
        return true;
    }
    return false;
};

/**
 * @param {Object} obj - object sent by server
 * @param {childNdx} childNdx Index
 * @param {levelNdx} levelNdx index
 * @param {Object} assignmentObject Assignment object that coantins all information for each row
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx, assignmentObject, isFilteringApplied ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    var assignmentBO = null;
    if ( obj.props && obj.props.object_string ) {
        displayName = obj.props.object_string.uiValues[0];
        assignmentBO = obj;
    }

    // get Icon for node
    var assignmentType = 'assignee';
    var iconURL = iconSvc.getTypeIconURL( objType );
    var taskUid = objUid;
    if ( childNdx > 0 || isRouteReviewAcknowledge( obj ) &&
        assignmentObject && assignmentObject.taskAssignment && assignmentObject.taskAssignment.uid ) {
        objUid = assignmentObject.taskAssignment.uid;
        objType = assignmentObject.taskAssignment.type;
        displayName = '';
        iconURL = null;
        assignmentType = assignmentObject.assignmentType;
        var viewModelObject = assignmentObject.taskAssignment;
        if ( viewModelObject ) {
            assignmentBO = viewModelObject;
        }
    }

    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    var hasChildren = hasNextLevelTask( obj );
    vmNode.isLeaf = !hasChildren;
    if ( isFilteringApplied ) {
        vmNode.isLeaf = true;
    }
    vmNode.assignmentType = assignmentType;

    if ( assignmentBO ) {
        vmNode = _.extend( vmNode, assignmentBO );
        // Set the type icon and thumbnail URL to empty so that for rows first coumn is empty then
        // we don't need to show any icon in first column
        vmNode.typeIconURL = '';
        vmNode.thumbnailURL = '';
        vmNode.assignmentObject = assignmentObject;
    }

    // Check if vmo node is not of type EPMTask and EPMTaskTemplate then only we are setting
    // alternateId to row because only those rows can be duplicate in the table. if we set the
    // alternateId on all tasks or task template nodes as well then if we expand some container node
    // and add some assignemnt to it's children then it doesn't expand that container nodes at reloading
    // the table. And this is mainly needed for table rows which can be duplicates like differnt type of
    // assignments, profiles.
    if ( !isOfType( vmNode, 'EPMTask' ) && !isOfType( vmNode, 'EPMTaskTemplate' ) ) {
        // set this alternate id so that duplicate assignment will be handled correctly
        vmNode.alternateID = vmNode.uid + ':' + taskUid + ':' + Math.random();
    }
    vmNode.taskUid = taskUid;
    vmNode.isExpanded = false;
    vmNode._childObj = obj;
    var assignmentOrigin = assignmentObject.assignmentOrigin;
    var taskAssignment = assignmentObject.taskAssignment;
    var signoffProfile = assignmentObject.signoffProfile;

    // Below isRequired and decision flags are required for populating the Required and decision column in Assignments table
    var isRequired = '';
    if( assignmentObject.isRequired ) {
        isRequired = assignmentObject.isRequired;
    }
    var decision = '';
    if( assignmentObject && assignmentObject.isDecisionMade ) {
        decision = assignmentObject.isDecisionMade;
    }
    // This is specific processing for profile node if unstaff then show it on table
    // Need to reevaluate
    if ( assignmentObject.profileDisplayString ) {
        taskAssignment = assignmentObject.profileDisplayString;
        assignmentOrigin = '';
    }
    vmNode = _populateColumns( _treeTableColumnInfos, true, vmNode, taskAssignment, assignmentOrigin, isRequired, decision, signoffProfile );

    return vmNode;
}

/**
 * This will process the tasks Template based on response of SOA
 * @param {object} treeLoadInput - tree load inuput of tree
 * @param {Object} taskAssignmentDataObject - tasks template objects send by SOA
 * @param {boolean} startReached - flag indicates if start has reached for tree
 * @param {boolean} endReached - flag indicates if end has reached for tree
 *
 * @returns {object} treeLoadResult - tree Load result
 */
function processTasksTemplate( treeLoadInput, taskAssignmentDataObject, startReached, endReached, isFilteringApplied ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    let taskAssignmentObject = _.clone( taskAssignmentDataObject );
    var tasksTemplateObjects = taskAssignmentObject.childTaskObjects;
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    // Populate the assignment data for all task template object and then iterate over to show the rows in table
    taskAssignmentObject = wrkflwAssignmentSvc.populateAssignmentTableRowData( taskAssignmentObject, tasksTemplateObjects );
    for ( var childNdx = 0; childNdx < tasksTemplateObjects.length; childNdx++ ) {
        var object = tasksTemplateObjects[childNdx];
        var vmObject = vmcs.constructViewModelObjectFromModelObject( object, 'EDIT' );
        // Check if task is multi user task then we need to create first row as empty row with only
        // task name and for other task types assignment info will come into single
        if ( _multiUserTasks.indexOf( vmObject.type ) > -1 ) {
            var assignmentObject = {
                taskAssignment: '',
                assignmentOrigin: ''
            };
            var vmNode = createVMNodeUsingObjectInfo( vmObject, 0, levelNdx, assignmentObject, isFilteringApplied );
            if ( vmNode ) {
                vmNodes.push( vmNode );
            }
        }

        var nodeNdx = 0;

        var taskInfoObject = taskAssignmentObject.taskInfoMap[object.uid];
        if ( taskInfoObject && taskInfoObject.props ) {
            for ( var key in taskInfoObject.props ) {
                if ( taskInfoObject.props.hasOwnProperty( key ) ) {
                    var value = taskInfoObject.props[key];
                    var taskAssignments = value.modelObjects;
                    for ( nodeNdx = 0; nodeNdx < taskAssignments.length; nodeNdx++ ) {
                        var assignmentObject1 = taskAssignments[nodeNdx];
                        var vmNode1 = createVMNodeUsingObjectInfo( vmObject, nodeNdx, levelNdx, assignmentObject1, isFilteringApplied );
                        if ( vmNode1 ) {
                            vmNodes.push( vmNode1 );
                        }
                    }
                }
            }
        }
    }
    const tableResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
    // Third Paramter is for a simple page for tree
    return {
        treeLoadResult: tableResult,
        taskAssignmentDataObject: taskAssignmentObject

    };
}

/**
 * Create the columns that need to be shown in the table.
 *
 * @param {Object} data - Data view model object
 *
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumnInfos( tableColumns, isStartEnabled, panelId ) {
    var columnInfos = [];

    // Iterate for all table columns and then return created columns
    _.forEach( tableColumns, function( attrObj ) {
        var propName = attrObj.propName;
        var propDisplayName = attrObj.propDisplayName;
        var width = attrObj.width;
        var minWidth = attrObj.minWidth;

        var columnInfo = awColumnSvc.createColumnInfo();
        /**
         * Set values for common properties
         */
        columnInfo.name = propName;
        columnInfo.internalPropName = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.isFilteringEnabled = attrObj.isFilteringEnabled;
        if ( isStartEnabled || panelId && panelId === 'Awp0NewWorkflowProcessSub' ) {
            columnInfo.isFilteringEnabled = false;
        }
        columnInfo.isTreeNavigation = attrObj.isTreeNavigation;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;
        columnInfo.maxWidth = 800;
        columnInfo.modifiable = false;
        if ( attrObj.cellTemplate ) {
            columnInfo.cellTemplate = attrObj.cellTemplate;
        }

        /**
         * Set values for un-common properties
         */
        columnInfo.typeName = attrObj.type;
        columnInfo.enablePinning = true;

        // Disable the sorting on columns as we show the assignments in multi rows as part of PR # PR10108587
        columnInfo.enableSorting = false;

        columnInfos.push( columnInfo );
    } );
    return columnInfos;
}

/**
 * Check if assignment type is assignee and assignement object is group member then
 * get the underlying user from that and use to show on the table.
 * @param {Object} vmNode - View model tree node object
 * @param {Object} taskAssignment - Task assignemnt object need to show in assignee column
 *
 * @returns {Object} Object that need to be shown in assignee column
 */
var _getAssigneeValue = function( vmNode, taskAssignment ) {
    if ( vmNode && vmNode.assignmentType === 'assignee' && isOfType( taskAssignment, 'GroupMember' ) &&
        taskAssignment.props.user && taskAssignment.props.user.dbValues && taskAssignment.props.user.dbValues[0] ) {
        // Get the user object from group member
        return vmcs.createViewModelObject( taskAssignment.props.user.dbValues[0] );
    }
    return taskAssignment;
};

/**
 *
 * @param {Object} columnInfo - The column info including name and other attributes
 * @param {Object} vmNode - View model tree node object
 * @param {Object} taskAssignment - Task assignemnt object need to show in assignee column
 * @param {Object} taskOrigin - Task origin need to show in origin column
 * @param {String} isRequired - Required user need to show in Required Column
 * @param {String} decision - Decision already made user to show on decision column
 * @param {String} signoffProfile - profile object to show in signoff profile column
 *
 * @return {vmProp} view model properties for the object
 */
function _createViewModelProperty( columnInfo, vmNode, taskAssignment, taskOrigin, isRequired, decision, signoffProfile ) {
    var vmProp = null;
    let resource = '/i18n/InboxMessages';
    var propDBValue = '';
    var propUIValue = '';
    var valueUpdated = false;

    if ( columnInfo.name === 'taskAssignment' && _.isObject( taskAssignment ) && taskAssignment.uid ) {
        // Based on assignment type get the value that need to be shown in assignee column.
        var assigneeObject = _getAssigneeValue( vmNode, taskAssignment );
        if ( assigneeObject && assigneeObject.uid ) {
            propDBValue = assigneeObject.uid;
            propUIValue = assigneeObject.props.object_string.uiValues[0];
        }
        if ( taskAssignment.valueUpdated ) {
            valueUpdated = taskAssignment.valueUpdated;
        }
    } else if ( columnInfo.name === 'assignmentOrigin' ) {
        if ( _.isObject( taskOrigin ) && taskOrigin.uid && taskOrigin.props && taskOrigin.props.object_string ) {
            propDBValue = taskOrigin.uid;
            propUIValue = taskOrigin.props.object_string.uiValues[0];
        } else {
            propDBValue = taskOrigin;
            propUIValue = taskOrigin;
        }
    } else if ( columnInfo.name === 'task_state' && vmNode && vmNode.props && vmNode.props.task_state ) {
        propDBValue = vmNode.props.task_state.dbValue;
        propUIValue = vmNode.props.task_state.uiValue;
    } else if ( columnInfo.name === 'isRequired' ) {
        let localTextBundle = localeSvc.getLoadedText( resource );
        if( vmNode && vmNode.modelType && vmNode.modelType.typeHierarchyArray && vmNode.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) < 0 && vmNode.modelType.typeHierarchyArray.indexOf( 'User' ) < 0 ) {
            if( isRequired ) {
                propDBValue = propUIValue = localTextBundle.yes;
            } else {
                propDBValue = propUIValue = localTextBundle.no;
            }
        } else {
            propDBValue = propUIValue = '';
        }
    } else if ( columnInfo.name === 'decision' ) {
        propDBValue = propUIValue = decision;
    } else if ( columnInfo.name === 'signoffProfile' ) {
        if ( _.isObject( signoffProfile ) && signoffProfile.uid && signoffProfile.props && signoffProfile.props.object_string ) {
            propDBValue = signoffProfile.uid;
            propUIValue = signoffProfile.props.object_string.uiValues[0];
        } else {
            propDBValue = signoffProfile;
            propUIValue = signoffProfile;
        }
    }

    vmProp = uwPropertySvc.createViewModelProperty( columnInfo.name, columnInfo.displayName, columnInfo.typeName, propDBValue, [ propUIValue ] );
    vmProp.valueUpdated = valueUpdated;
    uwPropertySvc.setIsPropertyModifiable( vmProp, false );
    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };

    if ( ( columnInfo.isTableCommand || columnInfo.isTreeNavigation ) && vmNode.type && ( isOfType( vmNode, 'EPMTask' ) || isOfType( vmNode, 'EPMTaskTemplate' ) ) ) {
        vmProp.typeIconURL = iconSvc.getTypeIconURL( vmNode.type );
    }
    return vmProp;
}

/**
 *
 * @param {Array} columnInfos - A List of columnInfo objects that contain information for all the columns
 * @param {boolean} isLoadAllEnabled - A boolean to check whether we should load all the column information
 * @param {Object} vmNode - the current node that is getting loaded
 * @param {Object} taskAssignment - Task assignemnt object need to show in assignee column
 * @param {Object} taskOrigin - Task origin need to show in origin column
 * @param {String} isRequired - Required user need to show in Required column
 * @param {String} decision - Decision already made user to show on decision column
 * @param {String} signoffProfile - profile objects to show in signoff profile column
 *
 * @returns {Array} VMO node objects
 */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode, taskAssignment, taskOrigin, isRequired, decision, signoffProfile ) {
    var child = vmNode._childObj;
    var localVMONode = _.clone( vmNode );
    if ( isLoadAllEnabled && child ) {
        if ( !localVMONode.props ) {
            localVMONode.props = [];
        }
        //Load all the information into a new view model to the corresponding node property
        _.forEach( columnInfos, function( columnInfo ) {
            localVMONode.props[columnInfo.name] = _createViewModelProperty( columnInfo, localVMONode, taskAssignment, taskOrigin, isRequired, decision, signoffProfile );
        } );
    }
    return localVMONode;
}

/**
 * Get the information of all profile, reviewersDataProvider and signOffs.
 *
 * @param {object} data - data Object
 * @param {Array} tableColumns - Columns array
 * @param {Array} tablePanelModeColumns Columns array that need to be shown when table is shown in panel
 * @param {boolean} isPanelMode True/False based on table need to be shown inside panel or not.
 * @return {Object} - Column info object
 */
export let loadTreeTableColumns = function( data, tableColumns, tablePanelModeColumns, isPanelMode, isStartEnabled, panelId ) {
    if ( isStartEnabled ) {
        // Clear the expanded state before loading table
        awTableStateService.clearAllStates( data, 'taskTreeTable' );
    }

    // Get the correct columns that we need to show for table.
    var assignemntTableColumns = isPanelMode ? tablePanelModeColumns : tableColumns;

    return {
        columnConfig: {
            columns: _getTreeTableColumnInfos( assignemntTableColumns, isStartEnabled, panelId )
        }
    };
};

/**
 * Register the property polciy that need to be registered when user go to
 * assignment tab for assign all task.
 *
 * @param {object} policy - Policy object that need to be set
 *
 */
export let registerPropPolicy = function( policy ) {
    if ( policy ) {
        _taskAssignPropPolicy = policySvc.register( policy );
    }
};

/**
 *
 * UnRegister the property polciy that need to be removed from policy when user go out from
 * assignment tab for assign all task.
 */
export let unRegisterPropPolicy = function() {
    if ( _taskAssignPropPolicy !== null ) {
        policySvc.unregister( _taskAssignPropPolicy );
        _taskAssignPropPolicy = null;
    }
};

/**
 * Get the valid object for assignment section need to be shown.
 *
 * @param {Object} modelObject Model object
 *
 * @returns {Object} Valid object for assignment section need to be shown
 */
export let getValidObjectToPropLoad = function( modelObject ) {
    var selectedObject = clientDataModel.getObject( modelObject.uid );
    var validTaskObject = selectedObject;

    // Get the correct adapter object. When user open item revision in content tab and goes to workflow tab
    // then also we need to show this table in workflow page. So to address this we need to get adapted object.
    var adaptedObjects = [];
    adaptedObjects = adapterSvc.getAdaptedObjectsSync( [ selectedObject ] );

    if ( adaptedObjects && adaptedObjects.length > 0 && adaptedObjects[0] ) {
        validTaskObject = workflowAssinmentUtilSvc.getValidObjectForTaskAssignment( adaptedObjects[0] );
    }
    var propsToLoad = [ 'root_task', 'parent_process', 'task_template' ];
    if ( isOfType( validTaskObject, 'EPMTaskTemplate' ) ) {
        propsToLoad = [ 'assignment_lists' ];
    }
    return {
        validTaskObject: validTaskObject,
        propsToLoad: propsToLoad
    };
};

/**
 * Get the template object from input model object and this will be used to show PAL info.
 *
 * @param {Object} modelObject Selected object for template object need to be fetched
 * @returns {Object} Template object from input model object
 */
var _getTemplateObject = function( modelObject ) {
    var rootTaskObject = null;
    if ( modelObject && modelObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        var signOffModelObject = clientDataModel.getObject( modelObject.props.fnd0ParentTask.dbValues[0] );
        if( signOffModelObject?.props?.root_task ) {
            rootTaskObject = clientDataModel.getObject( signOffModelObject.props.root_task.dbValues[0] );
        }
    } else if ( modelObject && modelObject.props?.root_task && ( modelObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
        modelObject.modelType.typeHierarchyArray.indexOf( 'Job' ) > -1 ) ) {
        rootTaskObject = clientDataModel.getObject( modelObject.props.root_task.dbValues[0] );
    } else {
        rootTaskObject = modelObject;
    }
    var validObject = rootTaskObject;
    if ( validObject && isOfType( validObject, 'EPMTask' ) && validObject.props.task_template && validObject.props.task_template.dbValues ) {
        validObject = clientDataModel.getObject( rootTaskObject.props.task_template.dbValues[0] );
    }
    return validObject;
};

/**
 * Get the 0th index selected task/ template UID that will be used to select the same object
 * again after assignment has been done.
 *
 * @param {Object} selectionModel Selection model object that hold the current selection
 * @returns {String} 0th index selected task or task template UID
 */
export let getSelectedTaskUidString = function( selectionModel ) {
    if ( selectionModel ) {
        // Check if selection model is not null and contains valid selection then only
        // return the selected object UID else return null
        var currentSelection = selectionModel.getSelection();
        if ( currentSelection && !_.isEmpty( currentSelection ) && currentSelection[0] ) {
            return currentSelection[0];
        }
    }
    return null;
};

/**
  * Build the tree from cached info.
  *
  * @param {Object} treeLoadInput Tree load input structure.
  * @param {Object} selectedObject selected object for table need to be loaded.
  * @param {Object} assignmentStateContext Context object where info will be updated.
  *
  * @returns {Object} Tree load result along with valid object info for table is being rendered.
  */
var _buildTreeTableCacheInfo = function( treeLoadInput, selectedObject, assignmentStateContext, columnFilters ) {
    var assignmentTableResult = {
        treeLoadResult: []
    };
    // Check if input assignment state is not null then get the table result based on input data
    // and then update the assignment context info
    if ( assignmentStateContext && assignmentStateContext.value ) {
        const assignmentState = { ...assignmentStateContext.value };

        var taskAssignmentDataObject = _.clone( assignmentState.taskAssignmentDataObject );
        var childTasks = assignmentState.parentChildMap[treeLoadInput.parentNode.uid];
        taskAssignmentDataObject.childTaskObjects = childTasks;
        var isFilteringApplied = false;
        if ( columnFilters.length > 0 && columnFilters[0].columnName ) {
            isFilteringApplied = true;
        }
        assignmentTableResult = _getAssignmentTableData( treeLoadInput, taskAssignmentDataObject, true, true, isFilteringApplied );

        // Get the narrow mode and set it on assignment state.
        var isNarrowViewMode = workflowAssinmentUtilSvc.isNarrowMode();

        assignmentState.isReloadTable = false;
        assignmentState.taskAssignmentDataObject = taskAssignmentDataObject;
        assignmentState.isNarrowViewMode = isNarrowViewMode;
        assignmentStateContext.update && assignmentStateContext.update( assignmentState );
    }
    // Get the template object from input selection.
    var taskTemplateObject = _getTemplateObject( selectedObject );

    return {
        treeLoadResult: assignmentTableResult.treeLoadResult,
        validTaskObject: selectedObject,
        taskTemplateObject: taskTemplateObject,
        requiredPropertiesLoaded: true
    };
};

/**
 * Call SOA to get the content that need to be shown on table.
 *
 * @param {Object} soaInput SOA input structure
 * @param {Object} treeLoadInput Tree load input structure.
 * @param {Object} selectedObject selected object for table need to be loaded.
 * @param {Object} assignmentData Assignment data where task assignment related info stored.
 * @param {Object} assignmentStateContext Context object where info will be updated.
 * @returns {Object} Tree load result along with valid object info for table is being rendered.
 */
var _callSOABuildTreeTableInfo = function( soaInput, treeLoadInput, selectedObject, assignmentData, assignmentStateContext, i18n ) {
    var isFilteringApplied = false;
    if ( soaInput.inData[0].additionalData.columnName && soaInput.inData[0].additionalData.columnName.length > 0 ) {
        isFilteringApplied = true;
    }
    return soaSvc.postUnchecked( 'Internal-Workflowaw-2020-12-Workflow', 'getWorkflowTaskAssignments', soaInput ).then( function( response ) {
        // Check if response is invalid then return from here
        if ( !response || !response.output || !response.output[0] || !response.ServiceData.plain ) {
            const emptyResultTable = _emptyResultTable();
            return {
                treeLoadResult: emptyResultTable,
                validTaskObject: selectedObject,
                requiredPropertiesLoaded: true
            };
        }
        var soaOutData = response.output[0];
        var taskAssignmentDataObject = null;
        if ( assignmentData ) {
            taskAssignmentDataObject = assignmentData.taskAssignmentDataObject;
        }

        // Check if user is loading the children of top node then set taskAssignmentData to null as we are loading
        // tree fresh from server data
        if ( treeLoadInput.parentNode.uid === 'top' ) {
            taskAssignmentDataObject = null;
        }
        var isPrivilegedToAssign = true;
        // Populate the task assignment data and based on that update parent child map as well so that it will be used
        // while relaoding the table
        taskAssignmentDataObject = wrkflwAssignmentSvc.populateTaskAssignmentData( soaOutData, taskAssignmentDataObject, i18n );
        if ( soaOutData.additionalData && soaOutData.additionalData.assignalltask_isUserPrivileged &&
            soaOutData.additionalData.assignalltask_isUserPrivileged[0] ) {
            isPrivilegedToAssign = soaOutData.additionalData.assignalltask_isUserPrivileged[0];
        }
        let isRemovePrivileged = false;
        //check the remove privileged and update it in the assignment State
        if( soaOutData && soaOutData.outData && soaOutData.outData[0] && soaOutData.outData[0].assigmentData && soaOutData.outData[0].assigmentData.reviewers ) {
            if( soaOutData.outData[0].assigmentData.reviewers[0] && soaOutData.outData[0].assigmentData.reviewers[0].additionalData
                && soaOutData.outData[0].assigmentData.reviewers[0].additionalData.isRemovePrivileged ) {
                if ( soaOutData.outData[0].assigmentData.reviewers[0].additionalData.isRemovePrivileged[0] === 'true' ) {
                    isRemovePrivileged = true;
                }
            }
        }
        // Get the assignment data that need to be shown in table
        var assignmentTableResult = _getAssignmentTableData( treeLoadInput, taskAssignmentDataObject, true, true, isFilteringApplied );

        // Update the assignment data info so that this info can be used to re-render the table.
        if ( assignmentStateContext && assignmentStateContext.value ) {
            const localContext = { ...assignmentStateContext.value };

            //Check if parent child map is undefined then set it to empty
            var parentChildMap = {};
            if ( localContext && localContext.parentChildMap ) {
                parentChildMap = localContext.parentChildMap;
            }
            // Get the narrow mode and set it on assignment state.
            var isNarrowViewMode = workflowAssinmentUtilSvc.isNarrowMode();

            parentChildMap[treeLoadInput.parentNode.uid] = taskAssignmentDataObject.childTaskObjects;
            // Here we set the taskAssignmentDataObject as the main one and not return by _getAssignmentTableData
            // as that method will return it based on entries need to show in table but our actual taskAssignmentDataObject
            // is what we get from populateTaskAssignmentData
            localContext.taskAssignmentDataObject = taskAssignmentDataObject;
            localContext.isPrivilegedToAssign = isPrivilegedToAssign;
            localContext.parentChildMap = parentChildMap;
            localContext.isReloadTable = false;
            localContext.isNarrowViewMode = isNarrowViewMode;
            localContext.isRemovePrivileged = isRemovePrivileged;
            assignmentStateContext.update && assignmentStateContext.update( localContext );
        }
        // Get the template object from input selection.
        var taskTemplateObject = _getTemplateObject( selectedObject );
        return {
            treeLoadResult: assignmentTableResult.treeLoadResult,
            validTaskObject: selectedObject,
            taskTemplateObject: taskTemplateObject,
            requiredPropertiesLoaded: true
        };
    } );
};

/**
 * Build the tree structure with tree nodes that need to be shown on table. This method will check if
 * it's table rerendering case then use the cache info from context or call SOA to get the fresh info.
 *
 * @param {Object} treeLoadInput Tree load input object.
 * @param {Object} selectedObject Object for table need to be shown.
 * @param {int} operationMode Operation mode for table need to be rendered like in upcmoning task table it can show only pending tasks.
 * @param {object} targetObjects Target objects that will be used to populate DP's
 * @param {Object} assignmentStateContext Context object that need to be updated with assignment data when table rendered.
 * @param {Object} sortCriteria Sort criteria object
 * @param {Object} columnFilters Column filters object
 *
 * @returns {Object} TreeLoadResult along with other parameter like valid object that will use to rerender the tree.
 */
var _buildTreeTableStructure = function( treeLoadInput, selectedObject, operationMode, targetObjects, assignmentStateContext, sortCriteria, columnFilters, i18n ) {
    var rootTaskObject = null;
    var nodeUIDToQuery;
    if ( treeLoadInput.parentNode.uid === 'top' ) {
        if ( selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
            var signOffModelObject = clientDataModel.getObject( selectedObject.props.fnd0ParentTask.dbValues[0] );
            rootTaskObject = clientDataModel.getObject( signOffModelObject.props.root_task.dbValues[0] );
            nodeUIDToQuery = rootTaskObject.uid;
        } else if ( selectedObject && ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
            selectedObject.modelType.typeHierarchyArray.indexOf( 'Job' ) > -1 ) ) {
            var jobObject = clientDataModel.getObject( selectedObject.uid );
            rootTaskObject = clientDataModel.getObject( jobObject.props.root_task.dbValues[0] );
            nodeUIDToQuery = rootTaskObject.uid;
        } else {
            rootTaskObject = selectedObject;
            nodeUIDToQuery = selectedObject.uid;
        }
    } else {
        nodeUIDToQuery = treeLoadInput.parentNode.uid;
    }
    var queryObject = clientDataModel.getObject( nodeUIDToQuery );
    // This change is needed to always use vailid task object to root task in case of signoff or EPMTask and EPMTaskTemplate
    // in case of EPMTaskTemplate object. This vlaid object will be used to get the PAL info correctly as well.
    if ( !rootTaskObject || !rootTaskObject.uid ) {
        rootTaskObject = queryObject;
        // Check if root task object is not null and is of type EPM task or Job. At this place it will be in all most
        // case as EPMTask only then get the root task object and use that to show the
        if ( rootTaskObject && ( rootTaskObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
            rootTaskObject.modelType.typeHierarchyArray.indexOf( 'Job' ) > -1 ) ) {
            var modelObject = clientDataModel.getObject( rootTaskObject.uid );
            // Get the root task property value and if not null then use that as valid object
            var rootTaskProp = _getPropValue( modelObject, 'root_task' );
            if ( rootTaskProp ) {
                rootTaskObject = clientDataModel.getObject( rootTaskProp );
            }
        }
        // Check if root task object is still null then use the input object directly
        if ( !rootTaskObject ) {
            rootTaskObject = selectedObject;
        }
    }

    // Check if query object is invalid then no need to process further
    if ( !queryObject || !queryObject.uid ) {
        const emptyResultTable = _emptyResultTable();
        return {
            treeLoadResult: emptyResultTable,
            validTaskObject: rootTaskObject,
            requiredPropertiesLoaded: true,
            taskTemplateObject: null
        };
    }
    const assignmentContext = { ...assignmentStateContext.value };
    if ( assignmentContext && assignmentContext.parentChildMap && assignmentContext.parentChildMap[treeLoadInput.parentNode.uid] && assignmentContext.isStartEditEnabled ) {
        return _buildTreeTableCacheInfo( treeLoadInput, rootTaskObject, assignmentStateContext, columnFilters );
    }
    var additionalData = {};
    if ( columnFilters.length > 0 ) {
        additionalData = {
            columnName: [ columnFilters[0].columnName ],
            operation: [ columnFilters[0].operation ],
            values: columnFilters[0].values
        };
    }
    // Check if target object is not null then we need to pass it as additionalData that contains target
    // object to server so that it will get DP data
    if ( targetObjects && targetObjects[0] && targetObjects[0].uid ) {
        additionalData = {
            dp_target_object: [ targetObjects[0].uid ]
        };
        if ( columnFilters.length > 0 ) {
            additionalData = {
                dp_target_object: [ targetObjects[0].uid ],
                columnName: [ columnFilters[0].columnName ],
                operation: [ columnFilters[0].operation ],
                values: columnFilters[0].values
            };
        }
    } else if ( targetObjects && _.isObject( targetObjects ) && targetObjects.uid ) {
        // If target objects is not array and it's type object then we need to use that to
        // populate dp data
        additionalData = {
            dp_target_object: [ targetObjects.uid ]
        };
        if ( columnFilters.length > 0 ) {
            additionalData = {
                dp_target_object: [ targetObjects[0].uid ],
                columnName: [ columnFilters[0].columnName ],
                operation: [ columnFilters[0].operation ],
                values: columnFilters[0].values
            };
        }
    }
    var soaInput = {
        inData: [ {
            taskOrTemplate: queryObject,
            operationMode: operationMode,
            clientId: 'getAssignmentData',
            startIndex: treeLoadInput.startChildNdx,
            maxToLoad: -1,
            additionalData: additionalData
        } ]
    };
    return _callSOABuildTreeTableInfo( soaInput, treeLoadInput, rootTaskObject, assignmentContext, assignmentStateContext, i18n );
};

/**
 * Load the required properties before rendering the table and then call SOA to render the table.
 *
 * @param {Object} treeLoadInput Tree load input object.
 * @param {Object} selectedObject Object for table need to be shown.
 * @param {int} operationMode Operation mode for table need to be rendered like in upcmoning task table it can show only pending tasks.
 * @param {object} targetObjects Target objects that will be used to populate DP's
 * @param {Object} assignmentStateContext Context object that need to be updated with assignment data when table rendered.
 * @param {Object} sortCriteria Sort criteria object
 * @param {Object} columnFilters Column filters object
 *
 * @returns {Object} TreeLoadResult along with other parameter like valid object that will use to rerender the tree.
 */
var _loadRequiredPropAndBuildTree = function( treeLoadInput, selectedObject, operationMode, targetObjects, assignmentStateContext, sortCriteria, columnFilters, i18n ) {
    var validObjectInfo = exports.getValidObjectToPropLoad( selectedObject );
    var validTaskObject = validObjectInfo.validTaskObject;
    // Load the required properties and then call SOA to build tree.
    return dataManagementService.getPropertiesUnchecked( [ validTaskObject ], validObjectInfo.propsToLoad ).then( function() {
        // Get the template object from input selection.
        var modelObject = clientDataModel.getObject( validTaskObject.uid );
        // Get the task template object from valid task or task template object.
        var taskTemplateObject = _getTemplateObject( modelObject );
        var uidsToLoad = [];
        // Check if task tempalte object is not null then only add to list to get the property
        if ( taskTemplateObject && taskTemplateObject.uid ) {
            uidsToLoad.push( taskTemplateObject.uid );
        }
        return dataManagementService.getProperties( uidsToLoad, [ 'assignment_lists' ] ).then( function() {
            validTaskObject = vmcs.constructViewModelObjectFromModelObject( clientDataModel.getObject( validTaskObject.uid ), 'EDIT' );
            return _buildTreeTableStructure( treeLoadInput, validTaskObject, operationMode, targetObjects, assignmentStateContext, sortCriteria, columnFilters, i18n );
        } );
    } );
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
    if ( !modelObject || !modelObject.uid ) {
        return null;
    }
    if ( modelObject.props && modelObject.props[propName] && modelObject.props[propName].dbValues
        && modelObject.props[propName].dbValues[0] ) {
        return modelObject.props[propName].dbValues[0];
    }
    return null;
};

/**
 * Check if input model object is EPM task, Signoff or Job then check if root task is already loaded or not
 * and if property is null then return true else return false.
 * @param {Object} selectedObject Object for property need to be check if already loaded or not
 * @returns {boolean} True/False
 */
var _isRequiredPropLoaded = function( selectedObject ) {
    if ( selectedObject && ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 ||
        selectedObject.modelType.typeHierarchyArray.indexOf( 'Job' ) > -1 ) ) {
        var rootTaskProp = _getPropValue( selectedObject, 'root_task' );
        if ( !rootTaskProp ) {
            return true;
        }
    } else if ( selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
        // If input object is signoff then we need to get the fnd0ParentTask first and then check for
        // root_task property is loaded or not.
        var parentTaskPropValue = _getPropValue( selectedObject, 'fnd0ParentTask' );
        if ( !parentTaskPropValue ) {
            return true;
        }
        var signOffModelObject = clientDataModel.getObject( parentTaskPropValue );
        var rootTaskPropObj = _getPropValue( signOffModelObject, 'root_task' );
        if ( !rootTaskPropObj ) {
            return true;
        }
    }
    return false;
};

/**
 * Populate the tree based on input and return the results.
 *
 * @param {Object} treeLoadInput Tree load input object.
 * @param {Object} data Data view model object.
 * @param {Object} selectedObject Object for table need to be shown.
 * @param {int} operationMode Operation mode for table need to be rendered like in upcmoning task table it can show only pending tasks.
 * @param {object} targetObjects Target objects that will be used to populate DP's
 * @param {Object} assignmentStateContext Context object that need to be updated with assignment data when table rendered.
 * @param {Object} sortCriteria Sort criteria object
 * @param {Object} columnFilters Column filters object
 *
 * @returns {Object} TreeLoadResult along with other parameter like valid object that will use to rerender the tree.
 */
export let loadTreeTableData = function( treeLoadInput, data, selectedObject, operationMode, targetObjects, assignmentStateContext, sortCriteria, columnFilters ) {
    // Check if requiredPropertiesLoaded is false or root task property is not loaded then we need to load the
    // property then load the property first and then load the table.
    if ( !data.requiredPropertiesLoaded || _isRequiredPropLoaded( selectedObject ) ) {
        return AwPromiseService.instance.resolve( _loadRequiredPropAndBuildTree( treeLoadInput, selectedObject, operationMode, targetObjects,
            assignmentStateContext, sortCriteria, columnFilters, data.i18n ) );
    }

    // Based on input selected object as well get the valid object like in some case if item revision comes as
    // selected object then we need to get the correct valid object and pass to SOA
    var validObjectInfo = exports.getValidObjectToPropLoad( selectedObject );
    var validTaskObject = validObjectInfo.validTaskObject;
    return AwPromiseService.instance.resolve( _buildTreeTableStructure( treeLoadInput, validTaskObject, operationMode, targetObjects,
        assignmentStateContext, sortCriteria, columnFilters ) );
};

/**
 * Init the table grid options based on page or panel case differnt rows need to be shown in the table.
 *
 * @param {Object} data Data view model object
 * @param {Object} subPanelContext Context object that hold basic information
 * @returns {boolean} True when table grid option is set correctly
 */
export let initTableGridOptions = function( data, subPanelContext ) {
    var maxRowsToShow = 7;
    if ( subPanelContext && ( subPanelContext.pageContext && subPanelContext.pageContext.primaryActiveTabId === 'tc_xrt_Workflow' ) ||
        subPanelContext.activeTab && subPanelContext.activeTab.pageId === 'tc_xrt_Workflow' ) {
        maxRowsToShow = 10;
    }

    if ( subPanelContext && ( subPanelContext.pageContext && subPanelContext.pageContext.primaryActiveTabId === 'tc_xrt_Assignments' ||
        subPanelContext.activeTab && subPanelContext.activeTab.pageId === 'tc_xrt_Assignments' ) ) {
        maxRowsToShow = 20;
    }

    // Set the correct number of rows that we need to show in table on grid
    if ( data && data.grids && data.grids.taskTreeTable && maxRowsToShow ) {
        data.grids.taskTreeTable.gridOptions.maxRowsToShow = maxRowsToShow;
    }
    return true;
};

/**
 * Based on input context info return the render object and operation mode that will be use to render
 * the assignment table correctly.
 * @param {Object} subPanelContext Sub panel context object
 * @param {Object} selectedObject Selected object for info need to be shown
 * @param {boolean} renderProcessUid Render process Uid to render in the table
 * @returns {Object} Object that will hold info for what object assignment table need to be shown with operation mode
 */
export let initTableRenderOptions = function( subPanelContext, selectedObject, renderProcessUid ) {
    var treeOperationMode = 1;
    var renderObject = selectedObject;
    // Normally input selected object will not be null but to handle the negative case
    // adding the code to use sebPanelContext selected as render object if null. This is
    // really needed when we open the table for task or signoff object
    if ( !selectedObject || !selectedObject.uid ) {
        renderObject = subPanelContext.selected;
    }
    if ( subPanelContext &&
        ( subPanelContext.pageContext && subPanelContext.pageContext.primaryActiveTabId !== 'tc_xrt_Assignments' &&
            subPanelContext.pageContext.secondaryActiveTabId !== 'tc_xrt_Assignments' ) ||
        subPanelContext.activeTab && subPanelContext.activeTab.pageId !== 'tc_xrt_Assignments' ) {
        treeOperationMode = 2;
        // Check for renderProcessUid is not null and not empty string then we need to use it to render the future
        // task table. This will only have value when user select some process from workflow breadcrumb on workflow page
        if ( renderProcessUid && !_.isEmpty( renderProcessUid ) ) {
            // Get the object for table need to be shown from input renderProcessUid.
            var modelObject = clientDataModel.getObject( renderProcessUid );
            if ( modelObject && modelObject.uid ) {
                renderObject = modelObject;
            }
        }
    }
    return {
        treeOperationMode: treeOperationMode,
        renderObject: renderObject,
        isDataInit: true
    };
};


/**
 * @param {object} treeLoadInput - tree load inuput of tree
 * @param {Object} taskAssignmentDataObject Task assignment data object that hold all assignmetn info for each task
 * @param {boolean} startReached - flag indicates if start has reached for tree
 * @param {boolean} endReached - flag indicates if end has reached for tree
 * @returns {object} treeLoadResult - tree Load result
 */
var _getAssignmentTableData = function( treeLoadInput, taskAssignmentDataObject, startReached, endReached, isFilteringApplied ) {
    if ( !treeLoadInput || !taskAssignmentDataObject ) {
        return;
    }

    var tempCursorObject = {
        endReached: startReached,
        startReached: endReached
    };
    var assignmentTableResult = processTasksTemplate( treeLoadInput, taskAssignmentDataObject, startReached,
        endReached, isFilteringApplied );
    assignmentTableResult.treeLoadResult.parentNode.cursorObject = tempCursorObject;
    return assignmentTableResult;
};

/**
 * @returns {Object} Empty result table object
 */
var _emptyResultTable = function() {
    return {
        treeLoadResult: {
            parentNode: {
                levelNdx: 0
            }
        }
    };
};

/**
 * To handle the selection mechanism only in case of assignment/ upcoming task table in inbox only.
 *
 * @param {String} taskUid Task uid string that need to be pre selected by default
 * @param {Object} preSelectTreeNode Node that need to be selected
 * @param {Object} dataProvider where object need to be pre selected.
 * @param {Object} assignmentState Assignment state object that will come only in assingment table or upcoming task
 *                 table in case of inbox.
 */
var _handleTaskNodeSelectionAssignmentTable = function( taskUid, preSelectTreeNode, dataProvider, assignmentState ) {
    // Check if input tree node is not null and valid that means from loaded children in table we need to select
    // input table. So add to selection and then reset newTaskSelectedUid on state.
    // If input tee node is null or invalid but input taskUId is emptySelection then we need to clear the selection
    // on table and update the state.
    if ( preSelectTreeNode && preSelectTreeNode.uid ) {
        dataProvider.selectionModel.setSelection( preSelectTreeNode );
        if ( taskUid && assignmentState && assignmentState.value ) {
            const assignmentContext = { ...assignmentState.value };
            assignmentContext.newTaskSelectedUid = null;
            assignmentState.update && assignmentState.update( assignmentContext );
        }
    } else if ( !preSelectTreeNode && taskUid === 'emptySelection' && assignmentState && assignmentState.value ) {
        dataProvider.selectionModel.setSelection( [] );
        const assignmentContext = { ...assignmentState.value };
        assignmentContext.newTaskSelectedUid = null;
        assignmentState.update && assignmentState.update( assignmentContext );
    }
};

/**
 * Pre select the node on asssignment tree based on input context info. This is used when user modify
 * some assignment from panel and then in mobile mode when user comes back to main panel then same task
 * should be selected.
 * @param {Object} data Data view model object
 * @param {Object} dataProvider where object need to be pre selected.
 * @param {Object} subPanelContext Context object where selection info need to be updated
 * @param {String} preSelectTaskUid Task uid string that need to be pre selected by default
 * @param {Object} assignmentState Assignment state object that will come only in assingment table or upcoming task
 *                 table in case of inbox.
 */
export let taskNodeSelection = function( data, dataProvider, subPanelContext, preSelectTaskUid, assignmentState ) {
    // Check if data provider is not null and it has loaded some contents then set the
    // selectionData
    if ( dataProvider && dataProvider.vmCollectionObj && dataProvider.vmCollectionObj.vmCollection ) {
        var loadedVMObjs = dataProvider.vmCollectionObj.vmCollection.loadedVMObjects;
        var preSelectTreeNode = null;
        var taskUid = preSelectTaskUid;

        // Based on input taskUid try to find out the node that need to be preselected
        if ( taskUid ) {
            // Find the node if it present then only select the task node.
            preSelectTreeNode = _.find( loadedVMObjs, {
                uid: taskUid
            } );
        }

        // Get the selection data from context object
        var selectionData = subPanelContext.selectionData.value;

        // Check if previous selection node is not present and node default selection is enabled then
        // by default select te 0th index row and update the data provider accordingly. This will only
        // be used in submit to worklow case.
        if ( !preSelectTreeNode && subPanelContext.preSelection && loadedVMObjs[0] && _.isEmpty( taskUid )
            && !selectionData.selected ) {
            preSelectTreeNode = loadedVMObjs[0];
        }
        // Check if preselected node object is valid then we need to conside two cases -
        // 1. Submit to worklow case - here we show table on top and sections as bottom and
        // updating any section update the table right away so to handle that case we set the
        // preselectTreeNode on selection model and then reset the selectedTaskUid on data
        // using dispatch method.
        // 2. Assignment/upcoming task table for inbox - Here we need to handle two cases.
        // First case will be user select the task and modify the assignment and then click
        // on save button in that case we reset the table and we need to empty the selection
        // on selection Model as well and to handle that case we are using emptySelection string
        // as workaround right now. If we pass selection model to data provider then on reset of
        // data provider selection model doesn't get empty. So this key will handle that case.
        // Second case is user select task and modify the assignment from panel and then before
        // clicking on save button, user change the selection from table and one notification message
        // comes up and from that user click on save button. Here we need to reset the table and select
        // the new selection after reset done and then panel should show new selection info as well.
        if ( preSelectTreeNode && preSelectTreeNode.uid ) {
            dataProvider.selectionModel.setSelection( preSelectTreeNode );
            if ( taskUid && data.dispatch && subPanelContext.preSelection ) {
                data.dispatch( { path: 'data.selectedTaskUid', value: null } );
            }
        }

        // This method will take the selection changes in assignment table for inbox.
        _handleTaskNodeSelectionAssignmentTable( taskUid, preSelectTreeNode, dataProvider, assignmentState );

        // Update the context selection data as well according to selected node
        if ( preSelectTreeNode && preSelectTreeNode.uid ) {
            subPanelContext.selectionData.update( { selected: [ preSelectTreeNode ] } );
        }
    }
};

/**
 * Check for task assignment panel is up or not either tool and info or as popup panel.
 *
 * @returns {boolean} True/False
 */
var _isAssignmentPanelOpened = function() {
    var ctx = appCtxSvc.ctx;
    if ( ctx && ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0TaskAssignmentCommandPanel' ) {
        return true;
    }
    return false;
};


/**
 * Function to copmare two Arrays
 * @param {Array} arr1 first array for comparison
 * @param {Array} arr2 second array for comparison
 *
 * @returns {boolean} are arrays equal
 */
function compareArrays( arr1, arr2 ) {
    if ( !( arr1 && arr2 ) ) {
        return false;
    }
    if ( arr1.length !== arr2.length ) {
        return false;
    }
    for ( var i = arr1.length; i--; ) {
        if ( arr2.indexOf( arr1[i] ) === -1 ) {
            return false;
        }
    }

    return true;
}

/**
 * Handle the task node selection from assignment table
 * @param {Object} selectionData Selected data object to get the current selection.
 *
 * @param {Object} assignmentState Assignment state object
 * @param {Object} parentSelectionData Parent selection data object
 * @param {Object} subPanelContext the subpanel context
 */
export let handleTaskNodeSelection = function( selectionData, assignmentState, parentSelectionData, subPanelContext ) {
    var isValidSelection = false;

    // Check if selection data is not null and have some selection then only check if it's valid selection
    // or not and in case of valid selection we need to open task assignment panel
    if( selectionData && selectionData.selected && selectionData.selected.length > 0 ) {
        var selectedObj = selectionData.selected[ 0 ];
        isValidSelection = isOfType( selectedObj, 'EPMTask' ) || isOfType( selectedObj, 'EPMTaskTemplate' );
    }

    // Update the selection data based on table selection so that RHW command will be shown
    // correctly and respective info command will show correct object details.
    if( parentSelectionData ) {
        const selectionToUpdate = { ...parentSelectionData.value };
        selectionToUpdate.selected = selectionData.selected;
        parentSelectionData.update && parentSelectionData.update( selectionToUpdate );
    }

    // Check if assignment panel is not opened and selection is valid then only open the task assignment panel
    const { dialogAction } = subPanelContext;

    //This has to be worked on in the future to make it fully functional
    // const  dialogAction  = subPanelContext.dialogAction?subPanelContext.dialogAction : subPanelContext?.context?.dialogAction ;

    if( !_isAssignmentPanelOpened() && isValidSelection ) {
        var panelWidth = 'DOUBLEWIDE';
        if( assignmentState.isNarrowViewMode ) {
            panelWidth = 'STANDARD';
        }
        var panelContext = {
            assignmentState: assignmentState
        };
        commandPanelService.activateCommandPanel( 'Awp0TaskAssignmentCommandPanel', 'aw_toolsAndInfo', panelContext, false, true, {
            width: panelWidth
        } );
        //This has to be worked on in the future to make it fully functional
        // if( dialogAction ) {
        //     appCtxSvc.registerCtx( 'panelContext', panelContext );
        //     let options = {
        //         view: 'Awp0TaskAssignmentCommandPanel',
        //         parent: '.aw-layout-workareaMain',
        //         placement: 'right',
        //         width: panelWidth,
        //         height: 'FULL',
        //         push: false,
        //         isCloseVisible: false,
        //         subPanelContext: { ...subPanelContext, ...panelContext }
        //     };
        //     dialogAction.show( options );
        // } else {
    } else if( _isAssignmentPanelOpened() && !isValidSelection ) {
        // Above check is needed for case when panel is already up but selection is not valid so panel
        // need to be closed now. Now we are replying on parent selection data and when we unselect something
        // from table then parent selection is set as selection into that and because of that panel will not
        // get closed. So to handle that we we are using this way to close the panel for invalid selection case.
        if( dialogAction ) {
            dialogAction.hide();
        } else {
            commandPanelService.activateCommandPanel( 'Awp0TaskAssignmentCommandPanel', 'aw_toolsAndInfo' );
        }
    }
};

/**
 * Get all PAL associated with input template object and set it on context correctly.
 * @param {Object} taskTemplateObject Task template object for which PAL needs to be fetched.
 *
 * @returns {Array} PAL list from input task template object.
 */
export let getAssignmentLists = function( taskTemplateObject ) {
    var processAssignmentListObj = [];
    var palsList = [];
    if ( !taskTemplateObject ) {
        return;
    }
    // Get assignemnt list proeprty from template object and populate it in the list to be shown on UI
    if ( taskTemplateObject.props && taskTemplateObject.props.assignment_lists && taskTemplateObject.props.assignment_lists.dbValues ) {
        _.forEach( taskTemplateObject.props.assignment_lists.dbValues, function( palUid ) {
            processAssignmentListObj.push( clientDataModel.getObject( palUid ) );
        } );

        if ( processAssignmentListObj.length > 0 ) {
            palsList = listBoxService.createListModelObjects( processAssignmentListObj, 'props.object_string' );
            palsList = _.sortBy( palsList, 'propDisplayValue' );
        }
    }
    return palsList;
};

/**
 * Populate the PAL list that need to be shown on UI based on input model object.
 *
 * @param {Object} modelObject Model object for PAL needs to be shown.
 *
 * @returns {Array} PAL list that need to be shown on UI.
 */
export let loadAssigmentList = function( modelObject ) {
    // Get the template object from input selection.
    var validObject = _getTemplateObject( modelObject );
    // Populate the PAL list based input object.
    return exports.getAssignmentLists( validObject );
};

/**
 * Populate the pre selected PAL when user switch between tabs.
 *
 * @param {Object} palProp PAL property object that need to be updated in case user switching between
 *  workflow and assignment tabs.
 * @param {Array} selectedPals Selected PALS that need to be shown pre selected
 * @returns {Object} PAL property object
 */
export let prePopulatePALList = function( palProp, selectedPals ) {
    const palPropObject = { ...palProp };
    var palDispValues = [];
    if ( selectedPals && !_.isEmpty( selectedPals ) ) {
        _.forEach( selectedPals, function( palObject ) {
            if ( palObject && palObject.props && palObject.props.object_string ) {
                var displayName = palObject.props.object_string.uiValues[0];
                if ( displayName ) {
                    palDispValues.push( displayName );
                }
            }
        } );
    }
    // If selected PALs are undefiend then set it to empty array before populate
    // values for PAL property object so it can show empty PAL applied
    if ( !selectedPals ) {
        selectedPals = [];
    }
    palPropObject.dbValue = selectedPals;
    palPropObject.dbValues = selectedPals;
    palPropObject.displayValues = palDispValues;
    palPropObject.uiValue = palDispValues.join();
    return palPropObject;
};

/**
 * returns signoffObject for getProperties SOA call each selection in Task Assignments panel
 *
 * @param {Object} selectionData - selection from the panel
 * @param {boolean} isPanelCase - true if selection is from panel
 *
 * @returns {Object} signoffObj - signoff object to sent as input to getProperties
 */
export let getSignoffObject = function( selectionData, isPanelCase ) {
    let selection = {};
    let signoffObj = [ {
        type: 'signoff',
        uid: 'AAAAAA'
    } ];
    if( isPanelCase && selectionData ) {
        selection = _getSelectionDataForPanel( selectionData );
    } else {
        selection = selectionData;
    }
    if( selection && selection.selected && selection.selected[0].assignmentObject && selection.selected[0].assignmentObject.objectUID ) {
        signoffObj[0].uid = selection.selected[0].assignmentObject.objectUID;
    } else {
        return;
    }
    return signoffObj;
};

/**
 * returns the correct selection from the Task Assignment panel
 *
 * @param {Object} selectionData - selection from the panel
 * @returns {Object} selection - correct selection where property needs to be fetched
 */
var _getSelectionDataForPanel = function( selectionData ) {
    let selection = {};
    let selectionDataModel = [ 'reviewersSelectionData', 'adhocReviewersSelectionData', 'acknowledgersSelectionData', 'notifyeesSelectionData' ];
    for( var i = 0; i < selectionDataModel.length; i++ ) {
        if( selectionData[selectionDataModel[i]].selected ) {
            selection = selectionData[selectionDataModel[i]];
        }
    }
    return selection;
};

export let getExecuteConditionInput = function( data, props, ctx ) {
    let vmo = '';
    let target = '';
    let userSession = {
        type : 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };
    let targetObj = {
        type : 'unknownType',
        uid : 'AAAAAAAAAAAAA'
    };
    let selectedTask = {
        type : 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };
    let selectedSignoff = {
        type : 'unknownType',
        uid: 'AAAAAAAAAAAAAA'
    };
    if( props && props.subPanelContext && props.subPanelContext.xrtState && props.subPanelContext.xrtState.xrtVMO ) {
        vmo = props.subPanelContext.xrtState.xrtVMO;
    }
    if( vmo && vmo.props && vmo.props.root_target_attachments ) {
        target = clientDataModel.getObject( vmo.props.root_target_attachments.value[0] );
    }
    if( data && data.selectionData && data.selectionData.selected[0] && data.selectionData.selected[0].assignmentObject && data.selectionData.selected[0].assignmentObject.objectUID ) {
        selectedSignoff.type = 'signoff';
        selectedSignoff.uid = data.selectionData.selected[0].assignmentObject.objectUID;
    } else if ( data && data.selectionData && data.selectionData.selected && data.selectionData.selected[0] && data.selectionData.selected[0].type !== 'GroupMember' ) {
        selectedTask.type = data.selectionData.selected[0].type;
        selectedTask.uid = data.selectionData.selected[0].uid;
    } else if ( vmo && vmo.type && vmo.uid && vmo.type === 'Signoff' ) {
        if( vmo.props && vmo.props.fnd0ParentTask && vmo.props.fnd0ParentTask.value ) {
            let taskObj = clientDataModel.getObject( vmo.props.fnd0ParentTask.value );
            selectedTask.type = taskObj.type;
            selectedTask.uid = taskObj.uid;
        }
    }
    if( ctx && ctx.userSession && ctx.userSession.uid ) {
        userSession.type  = 'UserSession';
        userSession.uid = ctx.userSession.uid;
    }
    if( target && target.uid && target.type ) {
        targetObj.uid = target.uid;
        targetObj.type = target.type;
    }
    return [ {
        conditionName: 'Fnd0RemoveReviewerPrivilege',
        conditionSignature: [
            userSession,
            selectedTask
        ]
    } ];
};

export default exports = {
    loadTreeTableColumns,
    registerPropPolicy,
    unRegisterPropPolicy,
    loadTreeTableData,
    taskNodeSelection,
    getAssignmentLists,
    getValidObjectToPropLoad,
    loadAssigmentList,
    prePopulatePALList,
    initTableGridOptions,
    initTableRenderOptions,
    handleTaskNodeSelection,
    getSelectedTaskUidString,
    getSignoffObject,
    getExecuteConditionInput
};
