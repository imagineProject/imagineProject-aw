// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TaskTable
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
import _ from 'lodash';
import uwPropertySvc from 'js/uwPropertyService';
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import tcDataMgmtSvc from 'js/tcDataManagementService';


/**
  * A list of what should be exported.
  */
var exports = {};

/**
  * Cached static default AwTableColumnInfo.
  */
var _treeTableColumnInfos = null;

var _taskAssignPropPolicy = null;

/**
  * @param {object} tableColumns narrow mode active or not
  *
  * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
  */
function _getTreeTableColumnInfos( tableColumns ) {
    _treeTableColumnInfos = _buildTreeTableColumnInfos( tableColumns );
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
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

var hasNextLevelTask = function( obj ) {
    if( isOfType( obj, 'EPMDoTask' ) || isOfType( obj, 'EPMReviewTask' ) || isOfType( obj, 'EPMAcknowledgeTask' ) ||
         isOfType( obj, 'EPMRouteTask' ) || isOfType( obj, 'EPMConditionTask' ) ||
         isOfType( obj, 'EPMDoTaskTemplate' ) || isOfType( obj, 'EPMReviewTaskTemplate' ) ||
         isOfType( obj, 'EPMAcknowledgeTaskTemplate' ) || isOfType( obj, 'EPMRouteTaskTemplate' ) ||
         isOfType( obj, 'EPMConditionTask' ) || isOfType( obj, 'EPMAddStatusTask' ) || isOfType( obj, 'EPMOrTask' ) || isOfType( obj, 'EPMValidateTask' ) || isOfType( obj, 'EPMNotifyTask' ) ||
         isOfType( obj, 'EPMConditionTaskTemplate' ) || isOfType( obj, 'EPMAddStatusTaskTemplate' ) || isOfType( obj, 'EPMOrTaskTemplate' ) || isOfType( obj, 'EPMValidateTaskTemplate' ) || isOfType( obj, 'EPMNotifyTaskTemplate' ) ) {
        return false;
    }
    return true;
};

var isRouteReviewAcknowledge = function( selected ) {
    if( isOfType( selected, 'EPMReviewTask' ) || isOfType( selected, 'EPMAcknowledgeTask' ) || isOfType( selected, 'EPMRouteTask' ) ||
         isOfType( selected, 'EPMReviewTaskTemplate' ) || isOfType( selected, 'EPMAcknowledgeTaskTemplate' ) || isOfType( selected, 'EPMRouteTaskTemplate' ) ) {
        return true;
    }
    return false;
};

/**
  * @param {Object} obj - object sent by server
  * @param {childNdx} childNdx Index
  * @param {levelNdx} levelNdx index
  * @return {ViewModelTreeNode} View Model Tree Node
  */
function createVMNodeUsingObjectInfo( obj, childNdx, levelNdx ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    if( obj.props && obj.props.object_string ) {
        displayName = obj.props.object_string.uiValues[ 0 ];
    }

    // get Icon for node
    var iconURL = iconSvc.getTypeIconURL( objType );
    var taskUid = objUid;

    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    var hasChildren = hasNextLevelTask( obj );
    vmNode.isLeaf = !hasChildren;
    vmNode.taskUid = taskUid;
    vmNode.isExpanded = false;
    vmNode._childObj = obj;
    vmNode = _populateColumns( _treeTableColumnInfos, true, vmNode );

    return vmNode;
}

/**
  * This will process the tasks Template based on response of SOA
  * @param {object} treeLoadInput - tree load inuput of tree
  * @param {Object} tasksTemplateObjects - tasks template objects send by SOA
  * @param {boolean} startReached - flag indicates if start has reached for tree
  * @param {boolean} endReached - flag indicates if end has reached for tree
  *
  * @returns {object} treeLoadResult - tree Load result
  */
function processTasksTemplate( treeLoadInput, tasksTemplateObjects, startReached, endReached ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    //let taskAssignmentObject = _.clone( taskAssignmentDataObject );
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    // Populate the assignment data for all task template object and then iterate over to show the rows in table
    //taskAssignmentObject = wrkflwAssignmentSvc.populateAssignmentTableRowData( taskAssignmentObject, tasksTemplateObjects );
    for( var childNdx = 0; childNdx < tasksTemplateObjects.length; childNdx++ ) {
        var object = tasksTemplateObjects[ childNdx ];
        var vmObject = vmcs.constructViewModelObjectFromModelObject( object, 'EDIT' );
        // Check if task is multi user task then we need to create first row as empty row with only
        // task name and for other task types assignment info will come into single
        //if( _multiUserTasks.indexOf( vmObject.type ) > -1 ) {
        var assignmentObject = {
            taskAssignment: '',
            assignmentOrigin: ''
        };
        var vmNode = createVMNodeUsingObjectInfo( vmObject, 0, levelNdx );
        vmNode.sequence = childNdx + 1;
        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }
    const tableResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
    // Third Paramter is for a simple page for tree
    return {
        treeLoadResult: tableResult

    };
}


/**
  * Create the columns that need to be shown in the table.
  *
  * @param {Object} data - Data view model object
  *
  * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
  */
function _buildTreeTableColumnInfos( tableColumns ) {
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
        columnInfo.enableFiltering = true;
        columnInfo.isTreeNavigation = attrObj.isTreeNavigation;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;
        columnInfo.maxWidth = 800;
        columnInfo.modifiable = false;
        if( attrObj.cellTemplate ) {
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
  *
  * @param {Object} columnInfo - The column info including name and other attributes
  * @param {Object} vmNode - View model tree node object
  * @param {Object} taskAssignment - Task assignemnt object need to show in assignee column
  * @param {Object} taskOrigin - Task origin need to show in origin column
  *
  * @return {vmProp} view model properties for the object
  */
function _createViewModelProperty( columnInfo, vmNode ) {
    var vmProp = null;

    var propDBValue = '';
    var propUIValue = '';
    var valueUpdated = false;

    vmProp = uwPropertySvc.createViewModelProperty( columnInfo.name, columnInfo.displayName, columnInfo.typeName, propDBValue, [ propUIValue ] );
    vmProp.valueUpdated = valueUpdated;
    uwPropertySvc.setIsPropertyModifiable( vmProp, false );
    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };

    if( ( columnInfo.isTableCommand || columnInfo.isTreeNavigation ) && vmNode.type && ( isOfType( vmNode, 'EPMTask' ) || isOfType( vmNode, 'EPMTaskTemplate' ) ) ) {
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
  *
  * @returns {Array} VMO node objects
  */
function _populateColumns( columnInfos, isLoadAllEnabled, vmNode ) {
    var child = vmNode._childObj;
    var localVMONode = _.clone( vmNode );
    if( isLoadAllEnabled && child ) {
        if( !localVMONode.props ) {
            localVMONode.props = [];
        }
        //Load all the information into a new view model to the corresponding node property
        _.forEach( columnInfos, function( columnInfo ) {
            localVMONode.props[ columnInfo.name ] = _createViewModelProperty( columnInfo, localVMONode );
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
export let loadTreeTableColumns = function( data, tableColumns, tablePanelModeColumns, isPanelMode ) {
    // Clear the expanded state before loading table
    awTableStateService.clearAllStates( data, 'taskTreeTable' );

    // Get the correct columns that we need to show for table.
    var assignemntTableColumns = isPanelMode ? tablePanelModeColumns : tableColumns;

    return {
        columnConfig: {
            columns: _getTreeTableColumnInfos( assignemntTableColumns )
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
    if( policy ) {
        _taskAssignPropPolicy = policySvc.register( policy );
    }
};

/**
  *
  * UnRegister the property polciy that need to be removed from policy when user go out from
  * assignment tab for assign all task.
  */
export let unRegisterPropPolicy = function() {
    if( _taskAssignPropPolicy !== null ) {
        policySvc.unregister( _taskAssignPropPolicy );
        _taskAssignPropPolicy = null;
    }
};

/**
  * Call SOA to get the content that need to be shown on table.
  *
  * @param {Object} treeLoadInput Tree load input structure.
  * @param {Object} selectedObject selected object for table need to be loaded.
  * @param {Object} assignmentData Assignment data where task assignment related info stored.
  * @param {Object} assignmentStateContext Context object where info will be updated.
  * @returns {Object} Tree load result along with valid object info for table is being rendered.
  */
var _callSOABuildTreeTableInfo = function(  treeLoadInput, selectedObject, assignmentData, assignmentStateContext, data ) {
    var nodeUIDToQuery = treeLoadInput.parentNode.uid;
    if( nodeUIDToQuery === 'top' ) {
        nodeUIDToQuery = selectedObject.uid;
    }

    var soaInput = {
        searchInput: {
            maxToLoad: -1,
            maxToReturn:-1,
            providerName: 'Awp0TaskSearchProvider',
            searchCriteria: {
                parentTaskTemplateUID: nodeUIDToQuery
            },
            columnFilters:data.columnProviders.treeTasksColumnProvider.columnFilters,
            startIndex: treeLoadInput.startChildNdx
        },
        inflateProperties: false
    };
    return tcDataMgmtSvc.basePerformSearchViewModel( soaInput ).then( function( response ) {
        // Check if response is invalid then return from here
        var tasksTemplateObjects = [];
        if( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if( searchResults ) {
                // Iterate for all search result objects and populate the template objects
                // that will be shown in tree
                _.forEach( searchResults.objects, function( searchObject ) {
                    var object = clientDataModel.getObject( searchObject.uid );
                    if( object ) {
                        tasksTemplateObjects.push( object );
                    }
                } );
            }
        }
        var endReachedVar = response.totalLoaded + treeLoadInput.startChildNdx === response.totalFound;

        var startReachedVar = true;
        var tempCursorObject = {
            endReached: endReachedVar,
            startReached: true
        };
        // Check if response object contains the cursor object then use that cursor object
        if( response && response.cursor ) {
            tempCursorObject = response.cursor;
        }

        // Get the assignment data that need to be shown in table
        var assignmentTableResult = processTasksTemplate( treeLoadInput, tasksTemplateObjects, startReachedVar, endReachedVar );
        // Get the template object from input selection.
        assignmentTableResult.treeLoadResult.parentNode.cursorObject = tempCursorObject;
        return {
            treeLoadResult: assignmentTableResult.treeLoadResult,
            validTaskObject: selectedObject,
            taskTemplateObject: selectedObject,
            requiredPropertiesLoaded: true
        };
    } );
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
    return AwPromiseService.instance.resolve( _callSOABuildTreeTableInfo( treeLoadInput, selectedObject, undefined, assignmentStateContext, data ) );
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
    if( !selectedObject || !selectedObject.uid ) {
        renderObject = subPanelContext.selected;
    }
    return {
        treeOperationMode: treeOperationMode,
        renderObject: renderObject,
        isDataInit: true
    };
};


export let moveTask = function( context, order ) {
    var vmc = context.treeTasksTemplateDataProvider.viewModelCollection;
    var loadedVMOs;
    var selectedObj = context.treeTasksTemplateDataProvider.getSelectedObjects();
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    var index = _.findIndex( loadedVMOs, function( object ) {
        return object.uid === selectedObj[0].uid;
    } );
    var indexOfTarget = _.findIndex( loadedVMOs, function( object ) {
        return object.levelNdx === selectedObj[0].levelNdx && object.sequence === selectedObj[0].sequence + order;
    } );
    if( index > -1 && indexOfTarget > -1 ) {
        var inputData = [];
        var uids = [];
        var cloneLoadedVMObjects = _.clone( loadedVMOs );
        cloneLoadedVMObjects.splice( index, 1 );
        cloneLoadedVMObjects.splice( indexOfTarget, 0, selectedObj[0] );
        for( var i in cloneLoadedVMObjects ) {
            if( cloneLoadedVMObjects[i]._childObj.props.parent_task_template.dbValue === selectedObj[0]._childObj.props.parent_task_template.dbValue ) {
                uids.push( cloneLoadedVMObjects[i].uid );
            }
        }
        var additionalDataMap = { update_sibling_task_order: uids };

        var object = {
            templateToUpdate: context.selected.uid,
            additionalData: additionalDataMap
        };
        inputData.push( object );
        var soaInput = {
            input: inputData
        };

        // Check if SOA input is not null and not empty then only make SOA call
        if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
            soaSvc.postUnchecked( 'Workflow-2019-06-Workflow', 'createOrUpdateTemplate',  soaInput ).then( function( response ) {
                eventBus.publish( 'workflowTreetable.reset', selectedObj[0] );
            } );
        }
    }
};
export let selectObjectAfterMove = function( objToSelect, dataProvider ) {
    dataProvider.selectionModel.setSelection( objToSelect );
};


export default exports = {
    loadTreeTableColumns,
    registerPropPolicy,
    unRegisterPropPolicy,
    loadTreeTableData,
    initTableRenderOptions,
    moveTask,
    selectObjectAfterMove
};

