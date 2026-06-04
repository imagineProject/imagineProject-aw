// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TemplateAssignment
 */
import AwPromiseService from 'js/awPromiseService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import clientDataModel from 'soa/kernel/clientDataModel';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import iconSvc from 'js/iconService';
import policySvc from 'soa/kernel/propertyPolicyService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import commandPanelService from 'js/commandPanel.service';
import appCtxSvc from 'js/appCtxService';
import palMgmtSvc from 'js/Awp0PalMgmtService';
import assignmentEditSvc from 'js/Awp0WorkflowAssignmentEditService';
import editHandlerService from 'js/editHandlerService';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import awTableStateService from 'js/awTableStateService';

var exports = {};

/**
 * Cached static default AwTableColumnInfo.
 */
var _treeTableColumnInfos = null;

/**
 * @param {Object} tableColumns Table columns array
 * @return {AwTableColumnInfoArray} Array of column information objects set with specific information.
 */
function _buildTreeTableColumnInfos( tableColumns, data ) {
    var columnInfos = [];

    _.forEach( tableColumns, function( attrObj ) {
        var propName = attrObj.name;
        var propDisplayName = attrObj.displayName;
        var width = attrObj.width;
        var minWidth = attrObj.minWidth;

        var columnInfo = awColumnSvc.createColumnInfo();
        /**
         * Set values for common properties
         */
        columnInfo.name = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.isFilteringEnabled = attrObj.isFilteringEnabled;
        if( data.isStartEditEnabled ) {
            columnInfo.isFilteringEnabled = false;
        }
        columnInfo.isTreeNavigation = attrObj.isTreeNavigation;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;
        columnInfo.maxWidth = 800;
        if( attrObj.cellTemplate ) {
            columnInfo.cellTemplate = attrObj.cellTemplate;
        }

        /**
         * Set values for un-common properties
         */
        columnInfo.typeName = attrObj.typeName;
        columnInfo.enablePinning = true;
        columnInfo.enableSorting = true;
        columnInfo.modifiable = false;
        columnInfos.push( columnInfo );
    } );
    return columnInfos;
}

/**
 * @param {Object} tableColumns Table columns array
 * @return {AwTableColumnInfoArray} An array of columns related to the row data created by this service.
 */
function _getTreeTableColumnInfos( tableColumns, data ) {
    _treeTableColumnInfos = _buildTreeTableColumnInfos( tableColumns, data );
    return _treeTableColumnInfos;
}

/**
 * Get the information of all profile, reviewersDataProvider and signOffs.
 *
 * @param {object} data - data Object
 * @param {Array} tableColumns - Columns array
 * @param {boolean} isFilterEnabled - true if column filters need the table load
 * @return {Object} - Column info object
 */
export let loadTreeTableColumns = function( data, tableColumns, isFilterEnabled ) {
    if( isFilterEnabled ) {
        // Clear the expanded state before loading table
        awTableStateService.clearAllStates( data, 'taskTreeTable' );
    }
    var columnConfig = {
        columns: _getTreeTableColumnInfos( tableColumns, data )
    };
    return {
        columnConfig: columnConfig
    };
};

/**
 * Check if input object is of type input type. If yes then
 * return true else return false.
 *
 * @param {Obejct} obj Object to be match
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
 * Create the property obejct with db value based on column name whose
 * value needs to be populated.
 *
 * @param {object} palDataMap PAL data map object that holds all information
 * @param {Object} obj Object where values are stored and values will
 *  be populated based on these values
 * @param {String} columnName Column name string
 * @return {Object} Property obejct with valid dbValue and dispaly values
 */
var _getPropertyObject = function( palDataMap, obj, columnName ) {
    var propObject = {
        dbValue: '',
        dbValues: [],
        dispValues: []
    };
    var object = palDataMap[ obj.uid ];
    if( !object ) {
        return propObject;
    }
    var valueObjects = null;
    if( columnName === 'fnd0Assignee' ) {
        valueObjects = object.fnd0Assignee;
    } else if( columnName === 'fnd0Assigner' ) {
        valueObjects = object.fnd0Assigner;
    } else if( columnName === 'awp0Reviewers' ) {
        valueObjects = object.awp0Reviewers;
    } else if( columnName === 'awp0Acknowledgers' ) {
        valueObjects = object.awp0Acknowledgers;
    } else if( columnName === 'awp0Notifyees' ) {
        valueObjects = object.awp0Notifyees;
    }

    if( valueObjects ) {
        var count = 0;
        _.forEach( valueObjects, function( value ) {
            if( value && value.uid ) {
                if( count === 0 ) {
                    propObject.dbValue = value.uid;
                } else {
                    propObject.dbValue = propObject.dbValue + ',' + value.uid;
                }
                propObject.dbValues.push( value.uid );
                propObject.dispValues.push( value.props.object_string.uiValues[ 0 ] );
                count++;
            }
        } );
    }
    return propObject;
};

/**
 * Create view model object property to show the correct values on assignment tree
 * @param {object} palDataMap PAL data map object that holds all information
 * @param {Object} obj Object where values are stored and values will
 *  be populated based on these values
 * @param {Object} columnInfo Column info obejct that will contain column name and display name
 *
 * @returns {Object} View model property object
 */
var _createProperty = function( palDataMap, obj, columnInfo ) {
    var propObject = _getPropertyObject( palDataMap, obj, columnInfo.name );
    var uwPropObject = uwPropertySvc.createViewModelProperty( columnInfo.name, columnInfo.displayName,
        columnInfo.typeName, propObject.dbValue, propObject.dispValues );
    uwPropObject.dbValues = propObject.dbValues;
    uwPropObject.parentUid = obj.uid;
    uwPropObject.isArray = true;
    uwPropertySvc.setIsPropertyModifiable( uwPropObject, false );
    return uwPropObject;
};


/**
 * Check if input task templete is any of EPMDoTaskTemplate, EPMReviewTaskTemplate,
 * EPMAcknowledgeTaskTemplate, EPMRouteTaskTemplate, EPMConditionTaskTemplate then
 * return false else return true.
 *
 * @param {Object} obj EPMTask template object.
 * @return {boolean} True/False
 */
var hasNextLevelTask = function( obj ) {
    if( isOfType( obj, 'EPMDoTaskTemplate' ) || isOfType( obj, 'EPMReviewTaskTemplate' ) || isOfType( obj, 'EPMAcknowledgeTaskTemplate' ) || isOfType( obj, 'EPMRouteTaskTemplate' ) || isOfType( obj, 'EPMConditionTaskTemplate' ) ) {
        return false;
    }
    return true;
};

/**
 * @param {object} palDataMap PAL data map object that holds all information
 * @param {Object} obj object to be created
 * @param {childNdx} childNdx Index
 * @param {levelNdx} levelNdx index
 * @return {ViewModelTreeNode} View Model Tree Node
 */
function createVMNodeUsingObjectInfo( palDataMap, obj, childNdx, levelNdx, isFilteringApplied ) {
    var displayName;
    var objUid = obj.uid;
    var objType = obj.type;
    if( obj.props && obj.props.object_string ) {
        displayName = obj.props.object_string.uiValues[ 0 ];
    }

    var viewModelObj = viewModelObjectSvc.constructViewModelObjectFromModelObject( obj, 'EDIT' );

    // get Icon for node
    var iconURL = iconSvc.getTypeIconURL( objType );

    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );

    var hasChildren = hasNextLevelTask( obj );
    vmNode.isLeaf = !hasChildren;
    if( isFilteringApplied ) {
        vmNode.isLeaf = true;
    }
    vmNode.isExpanded = false;

    _.forEach( _treeTableColumnInfos, function( columnInfo ) {
        if( !columnInfo.isTreeNavigation ) {
            var propObject = _createProperty( palDataMap, viewModelObj, columnInfo );
            viewModelObj.props[ columnInfo.name ] = propObject;
        }
    } );

    vmNode = _.extend( vmNode, viewModelObj );
    return vmNode;
}

/**
 * This will process the tasks Template based on response of SOA
 * @param {object} palDataMap PAL data map object that holds all information
 * @param {object} treeLoadInput - tree load inuput of tree
 * @param {Object[]} tasksTemplateObjects - tasks template objects send by SOA
 * @param {boolean} startReached - flag indicates if start has reached for tree
 * @param {boolean} endReached - flag indicates if end has reached for tree
 * @returns {object} treeLoadResult - tree Load result
 */
function processTasksTemplate( palDataMap, treeLoadInput, tasksTemplateObjects, startReached, endReached, isFilteringApplied ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;

    var levelNdx = parentNode.levelNdx + 1;

    var vmNodes = [];
    // Iterate for all task template objects and create view model node to be shown in tree
    for( var childNdx = 0; childNdx < tasksTemplateObjects.length; childNdx++ ) {
        var object = tasksTemplateObjects[ childNdx ];
        var vmNode = createVMNodeUsingObjectInfo( palDataMap, object, childNdx, levelNdx, isFilteringApplied );

        if( vmNode ) {
            vmNodes.push( vmNode );
        }
    }

    // Third Paramter is for a simple page for tree
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, startReached,
        endReached, null );
}

/**
 * Get the property object based on input property name.
 *
 * @param {Object} palObject Process assignment list object.
 * @param {String} propName Property name to be fetched
 * @returns {Object} Property object
 */
var _getPropObject = function( palObject, propName ) {
    if( palObject && palObject.props[ propName ] ) {
        return palObject.props[ propName ];
    }
    return null;
};

/**
 * Populate the UI property widgets.
 *
 * @param {Object} data Data view model object
 * @param {Object} workflowPALState Workflow PAL state object that holds all information
 * @returns {Object} Updated UI widgets object
 */
var _populateUIPropWidgets = function( data, workflowPALState ) {
    const processTemplateProp = { ...data.processTemplate };
    const palNameProp = { ...data.palName };
    const palDescProp = { ...data.palDesc };
    const isSharedProp = { ...data.isSharedOption };
    var palObject = workflowPALState.selPalVMO;
    var processTemplateObject = workflowPALState.processTemplateObject;
    if( !palObject || !processTemplateObject ) {
        return {
            processTemplateProp : processTemplateProp,
            palName : palNameProp,
            palDesc : palDescProp,
            isSharedOption: isSharedProp
        };
    }

    // Populate the process template props along with other UI widgets liek pal name, pal desc and
    // shared option and return the updated prop object that contains all updated props.
    processTemplateProp.dbValue =  processTemplateObject.uid;
    processTemplateProp.uiValue = processTemplateObject.props.object_string.uiValues[0];

    var namePropObject = _getPropObject( palObject, 'list_name' );
    var isPropEditable = false;
    if( data.isStartEditEnabled !== undefined ) {
        isPropEditable = data.isStartEditEnabled;
    }
    if( namePropObject ) {
        palNameProp.isEditable = isPropEditable;
        palNameProp.isEnabled = isPropEditable;
    }

    var descPropObject = _getPropObject( palObject, 'list_desc' );
    if( descPropObject ) {
        palDescProp.isEditable = isPropEditable;
        palDescProp.isEnabled = isPropEditable;
    }

    var sharedPropObject = _getPropObject( palObject, 'shared' );
    if( sharedPropObject && data.isGroupAdminOrSysAdmin ) {
        isSharedProp.isEditable = isPropEditable;
        isSharedProp.isEnabled = isPropEditable;
    }

    return {
        processTemplateProp : processTemplateProp,
        palName : palNameProp,
        palDesc : palDescProp,
        isSharedOption: isSharedProp
    };
};

/**
 * Call SOA to get the results that needs to be shown in tree
 * @param {Object} data Data view model object
 * @param {Object} workflowPALState Workflow PAL state object that holds all information
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 * @param {Promise} deferred Deffered object to return the results
 */
var _loadTreeData = function( data, workflowPALState, treeLoadInput, deferred ) {
    var nodeUIDToQuery = treeLoadInput.parentNode.uid;
    if( nodeUIDToQuery === 'top' && workflowPALState && workflowPALState.processTemplateObject ) {
        nodeUIDToQuery = workflowPALState.processTemplateObject.uid;
    }

    var isPalSelected = 'false';
    if( workflowPALState && workflowPALState.selPalVMO && workflowPALState.selPalVMO.type && workflowPALState.selPalVMO.type === 'EPMAssignmentList' ) {
        isPalSelected = 'true';
    }

    var soaInput = {
        searchInput: {
            maxToLoad: -1,
            maxToReturn: -1,
            providerName: 'Awp0TaskSearchProvider',
            searchCriteria: {
                parentTaskTemplateUID: nodeUIDToQuery,
                filterInteractiveTemplates: isPalSelected
            },
            columnFilters:data.columnProviders.treeTemplatesColumnProvider.columnFilters,
            startIndex: treeLoadInput.startChildNdx
        },
        inflateProperties: false
    };
    var isFilteringApplied = false;
    if( soaInput.searchInput.columnFilters.length > 0  && soaInput.searchInput.columnFilters[0].columnName ) {
        isFilteringApplied = true;
    }

    tcDataMgmtSvc.basePerformSearchViewModel( soaInput ).then(
        function( response ) {
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

            // Process task templated to show the results
            var treeLoadResult = processTasksTemplate( workflowPALState.palDataMap, treeLoadInput, tasksTemplateObjects, startReachedVar,
                endReachedVar, isFilteringApplied );

            treeLoadResult.parentNode.cursorObject = tempCursorObject;
            treeLoadResult.totalLoaded = response.totalLoaded;
            workflowPALState.isReloadTable = false;

            // Update the props need to be shown with latest values present on server
            var propWidgetContext = _populateUIPropWidgets( data.data, workflowPALState );

            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                workflowPalDataState: workflowPALState,
                processTemplate : propWidgetContext.processTemplateProp,
                palName : propWidgetContext.palName,
                palDesc : propWidgetContext.palDesc,
                isSharedOption: propWidgetContext.isSharedOption,
                isGroupAdminOrSysAdmin : data.isGroupAdminOrSysAdmin
            } );
        },
        function( error ) {
            deferred.reject( error );
        } );
};

/**
 * Check if user has priviledge to modify then only based on validation return true/false.
 * 1. Check if logger in user and pal owing user both are same then return true.
 * 2. Check if selected PAL is shared and PAL owning group and logged in group both are same
 * then return true.
 * 3. Check if logged in group is dba then return true.
 *
 * @param {Object} selected Selected PAL obejct from UI
 * @param {Object} subPanelContext Subpanel context object
 * @return {boolean} True/False
 */
var _isPriviledgedToModify = function( selected, subPanelContext ) {
    var isPriviledge = false;
    var palObject = clientDataModel.getObject( selected.uid );
    var owningUserUid = palObject.props.owning_user.dbValues[ 0 ];
    var owningGroupUid = palObject.props.owning_group.dbValues[ 0 ];
    var sharedPal = palObject.props.shared.dbValues[ 0 ];

    if(  subPanelContext.session.current_user.uid === owningUserUid ||  sharedPal === '1' && owningGroupUid === subPanelContext.session.current_group.uid
    ||  subPanelContext.session.current_user_session.properties.group_name.dbValue === 'dba' ) {
        isPriviledge = true;
    }
    return isPriviledge;
};

/**
  * Get a page of row data for a 'tree' table. This is internal method to get if to load the PAL assignment table
  *
  * @param {Object} data Data view model object
  * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
  *            the result of processing the 'inputData' property of a DeclAction based on data from the current
  *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
  * @param {Object} selected Selected PAL object from UI
  * @param {Object} workflowPalState Workflow PAL assignment state object which holds all info
  * @param {Object} subPanelContext SubPanelContext object
  *
  * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
  *         available.
  */
var _loadTreeTableDataInternal = function( data, treeLoadInput, selected, workflowPalState, subPanelContext ) {
    var palObject = null;
    // Get the latest model object from input selection and then check if selected object is valid then only
    // process further else return the empty table promise object. This is mainly needed when we have table shown
    // and we delete the PAL. In that case PAL object is delete but we need this code to return the empty table data
    // if dataProvider load tree action gets called.
    if( selected && selected.uid ) {
        palObject = clientDataModel.getObject( selected.uid );
    }
    // If object is invalid then return the epmty table result from here
    if ( !palObject || !palObject.uid ) {
        return new Promise( ( ) =>{
            const treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, [], true, true, true, null );
            return {
                treeLoadResult,
                workflowPalDataState: workflowPalState,
                processTemplate : data.processTemplate,
                palName : data.palName,
                palDesc : data.palDesc,
                isSharedOption: data.isSharedOption,
                isGroupAdminOrSysAdmin : data.isGroupAdminOrSysAdmin
            };
        } );
    }

    var deferred = AwPromiseService.instance.defer();

    var policy = data.dataProviders.treeTasksTemplateDataProvider.policy;
    policySvc.register( policy );

    const localPALState = { ...workflowPalState };
    // Check if processTemplateObject is already present then use that
    // to load tree data else get the process template and load tree data
    if( localPALState && localPALState.palDataMap && localPALState.processTemplateObject && localPALState.processTemplateObject.uid ) {
        var palDataMap = palMgmtSvc.populatePalStructure( selected );
        localPALState.palDataMap = palDataMap;
        var workflowPalCtx = appCtxSvc.getCtx( 'workflowPalData' );
        if( workflowPalCtx && workflowPalCtx.isInEditMode === false ) {
            localPALState.isInEditMode = false;
        }
        _loadTreeData( data, localPALState, treeLoadInput, deferred );
    } else {
        // Get the process template from selected PAL and then call load tree data
        // to load the tree rows
        palMgmtSvc.getProcessTemplateFromPal( selected ).then( function( processTemplate ) {
            var processTemplateObject = processTemplate;
            var palDataMap = palMgmtSvc.populatePalStructure( selected );
            var isPriviledge = _isPriviledgedToModify( selected, subPanelContext );
            var modelObject = clientDataModel.getObject( selected.uid );
            var selPalVMO = viewModelObjectSvc.constructViewModelObjectFromModelObject( modelObject, 'EDIT' );

            localPALState.palDataMap = palDataMap;
            localPALState.processTemplateObject = processTemplateObject;
            localPALState.selPalVMO = selPalVMO;
            localPALState.isPriviledgeToModify = isPriviledge;
            localPALState.isInEditMode = false;
            localPALState.isEditHandlerNeeded = true;


            // Set the current user id on PAL state object as this will be used to get project info while adding users.
            if( subPanelContext.session && subPanelContext.session.current_user && subPanelContext.session.current_user.uid ) {
                localPALState.currentUserUid = subPanelContext.session.current_user.uid;
            }

            // Check if PAL info is loading after create and app context contains newly created PAL uid then
            // by default do start edit for created PAL and then unregister the context
            if( treeLoadInput.parentNode.uid === 'top' && appCtxSvc.ctx && appCtxSvc.ctx.newlyCreatedAssignmentListObjUid ) {
                localPALState.isInEditMode = true;
                localPALState.isEditHandlerNeeded = true;
                appCtxSvc.unRegisterCtx( 'newlyCreatedAssignmentListObjUid' );
            }

            // Update the info on app context service and this will hold info related to only
            // if we have priviledge to modify and we are in edit mode or not.
            var workflowPalCtx = appCtxSvc.getCtx( 'workflowPalData' );
            if( !workflowPalCtx ) {
                workflowPalCtx = {};
            }

            if ( workflowPalCtx.isInEditMode === true ) {
                localPALState.isInEditMode = true;
                localPALState.isEditHandlerNeeded = true;
                // Set the isPriviledgeToModify on context object to have info for PAL info can be modified or not.
                workflowPalCtx.isPriviledgeToModify = localPALState.isPriviledgeToModify;
                appCtxSvc.updateCtx( 'workflowPalData', workflowPalCtx );
            }

            _loadTreeData( data, localPALState, treeLoadInput, deferred );

            workflowPalCtx.isInEditMode = false;
            // Set the isPriviledgeToModify on context object to have info for PAL info can be modified or not.
            workflowPalCtx.isPriviledgeToModify = localPALState.isPriviledgeToModify;
            appCtxSvc.updateCtx( 'workflowPalData', workflowPalCtx );
        } );
    }

    return deferred.promise;
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {Object} data Data view model object
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 * @param {Object} selected Selected PAL object from UI
 * @param {Object} workflowPalState Workflow PAL assignment state object which holds all info
 * @param {Object} subPanelContext SubPanelContext object
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( data, treeLoadInput, selected, workflowPalState, subPanelContext ) {
    // Check if is Group or Sys admin value present on data if not then get the value first and then call
    // the internal method to load the table data else call that method
    if( data.isGroupAdminOrSysAdmin === undefined ) {
        return palMgmtSvc.isGroupAdminOrSysAdmin( subPanelContext ).then( function( isGroupAdminOrSysAdmin ) {
            data.isGroupAdminOrSysAdmin = isGroupAdminOrSysAdmin;
            return _loadTreeTableDataInternal( data, treeLoadInput, selected, workflowPalState, subPanelContext );
        } );
    }
    return _loadTreeTableDataInternal( data, treeLoadInput, selected, workflowPalState, subPanelContext );
};

/**
 * Register the property polciy that need to be registered when user go to
 * PAL assignment table.
 *
 * @param {Object} policy Policy that need to be register
 * @returns {Object} Registered policy ID.
 */
export let registerPropPolicy = function( policy ) {
    if( policy ) {
        return policySvc.register( policy );
    }
    return null;
};

/**
 *
 * UnRegister the property polciy that need to be removed from policy when user go out from
 * PAL assignment table.
 * @param {Object} policy Policy that need to be removed
 *
 * @returns {Object} null as policy has been removed.
 */
export let unRegisterPropPolicy = function( policy ) {
    if( policy ) {
        policySvc.unregister( policy );
    }
    return null;
};

/**
 * Check for open tool and info panel is Awp0TemplateAssignmentPanel or not.
 * @returns {boolean} True/False
 */
var _isAssignmentPanelOpened = function( ) {
    var ctx = appCtxSvc.ctx;
    if( ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0TemplateAssignmentPanel' ) {
        return true;
    }
    return false;
};


/**
 * Handle the task node selection from assignment table
 * @param {Object} selectionData Selected data object to get the current selection.
 * @param {Object} workflowPalState Assignment state object
 * @param {Object} parentSelectionData Parent selection data object that need to be updated with this selection
 */
export let handleTaskNodeSelection = function( selectionData, workflowPalState, parentSelectionData ) {
    var isValidSelection = false;

    // Check if selection data is not null and have some selection then only check if it's valid selection
    // or not and in case of valid selection we need to open task assignment panel
    if( selectionData && selectionData.selected && selectionData.selected.length > 0 ) {
        var selectedObj = selectionData.selected[ 0 ];
        isValidSelection = isOfType( selectedObj, 'EPMTaskTemplate' );
    }

    // Check if input parent selection data is not null then only update it with current selection
    // so that RHW will show correct commands based on current selection.
    if( parentSelectionData && parentSelectionData.value ) {
        var parentSelectionContext = { ...parentSelectionData.value };
        parentSelectionContext.selected = selectionData.selected;
        parentSelectionContext.source = 'assignmentTable';
        parentSelectionData.update && parentSelectionData.update( parentSelectionContext );
    }

    // Check if assignment panel is not opened and selection is valid then only open the task assignment panel
    if( !_isAssignmentPanelOpened() && isValidSelection ) {
        var panelWidth = 'DOUBLEWIDE';
        if( workflowPalState.isNarrowViewMode ) {
            panelWidth = 'STANDARD';
        }
        var panelContext = {
            workflowPalState: workflowPalState
        };
        appCtxSvc.updateCtx( 'workflowPalData', panelContext.workflowPalState );
        commandPanelService.activateCommandPanel( 'Awp0TemplateAssignmentPanel', 'aw_toolsAndInfo', panelContext, false, true, {
            width: panelWidth
        } );
    } else if( _isAssignmentPanelOpened() && !isValidSelection ) {
        // Above check is needed for case when panel is already up but selection is not valid so panel
        // need to be closed now. Now we are replying on parent selection data and when we unselect something
        // from table then parent selection is set as selection into that and because of that panel will not
        // get closed. So to handle that we we are using this way to close the panel for invalid selection case.
        commandPanelService.activateCommandPanel( 'Awp0TemplateAssignmentPanel', 'aw_toolsAndInfo' );
    }
};

/**
 * Save template assignments. Get the required values
 * from app context and then call SOA to update the pal information.
 * @param {Object} data Data view model object
 * @param {Object} workflowPALState Assignment state object
 * @return {deferred} - deferred object
 */
export let saveTemplateAssignments = function( data, workflowPALState ) {
    var processTemplateObject = workflowPALState.processTemplateObject;
    var palDataMap = workflowPALState.palDataMap;
    var selectedPALObject = workflowPALState.selPalVMO;
    var localData = data.getData();
    var palDataStructure = {
        palName: localData.palName.dbValue,
        palDesc: localData.palDesc.dbValue,
        isShared: localData.isSharedOption.dbValue
    };

    // Check if pal data map, process template object and selected PAL is not null
    // then only call pal mgmt service.
    if( palDataMap && processTemplateObject && selectedPALObject ) {
        var deferred = AwPromiseService.instance.defer();
        palMgmtSvc.saveTemplateAssignments( palDataMap, processTemplateObject, selectedPALObject, palDataStructure ).then( function() {
            deferred.resolve();
        } );
        return deferred.promise;
    }
};


/**
 * Register the edit handler when table is loaded
 * @param {Object} data Data view model object
 * @param {Object} workflowPalState Workflow PAL data state object that holds all information.
 */
export let registerEditHandler = function( data, workflowPalState ) {
    var _resetEditContext = function( isRemoveReload ) {
        var workflowPalCtx = appCtxSvc.getCtx( 'workflowPalData' );
        if( workflowPalCtx ) {
            workflowPalCtx.isInEditMode = false;
        }
        appCtxSvc.updateCtx( 'workflowPalData', workflowPalCtx );

        // Check if assignment panel is up then close it.
        if( _isAssignmentPanelOpened() ) {
            commandPanelService.activateCommandPanel( 'Awp0TemplateAssignmentPanel', 'aw_toolsAndInfo' );
        }

        // Set the edit mode on workflow PAL state object to false and reload the table correctly from server
        // data.
        if( isRemoveReload === undefined || !isRemoveReload ) {
            const localState = { ...workflowPalState.value };
            localState.isInEditMode = false;
            localState.palDataMap = null;
            localState.isReloadTable = true;
            workflowPalState.update && workflowPalState.update( localState );
            // Set the isStartEditEnabled on data so that properties can be shown in non-edit mode
            data.dispatch( { path: 'data.isStartEditEnabled', value: false } );
        }
    };

    var startEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        var workflowPalCtx = appCtxSvc.getCtx( 'workflowPalData' );
        if( !workflowPalCtx ) {
            workflowPalCtx = {};
        }
        workflowPalCtx.isInEditMode = true;
        // Set the isPriviledgeToModify on context object to have info for PAL info can be modified or not.
        if( workflowPalState && workflowPalState.value ) {
            workflowPalCtx.isPriviledgeToModify = workflowPalState.value.isPriviledgeToModify;
        }

        // set the app context data correctly so that it can hold edit state correctly
        appCtxSvc.updateCtx( 'workflowPalData', workflowPalCtx );

        // Set the edit mode on workflow PAL state object
        const localState = { ...workflowPalState.value };
        localState.isInEditMode = true;
        workflowPalState.update && workflowPalState.update( localState );

        // Set the isStartEditEnabled on data so that properties can be shown in edit mode
        data.dispatch( { path: 'data.isStartEditEnabled', value: true } );

        deferred.resolve( {} );
        return deferred.promise;
    };

    var saveEditFunc = function( isRemoveReload ) {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        exports.saveTemplateAssignments( data, workflowPalState ).then( function() {
            _resetEditContext( isRemoveReload );
            deferred.resolve( {} );
        } );

        return deferred.promise;
    };

    var cancelEditFunc = function( isRemoveReload ) {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        _resetEditContext( isRemoveReload );
        deferred.resolve( {} );
        return deferred.promise;
    };
    // Check if workflow PAL data present then only set the edit mode
    if( data && workflowPalState ) {
        //create Edit Handler
        assignmentEditSvc.createEditHandlerCustomContext( data, startEditFunc, saveEditFunc, cancelEditFunc, 'TEMPLATE_ROW_EDIT', workflowPalState.isInEditMode, workflowPalState );
    }
};

/**
 * Set the editable state for all properties.
 *
 * @param {Object} palNameProp PAL name property object
 * @param {Object} palDescProp PAL description property object
 * @param {Object} shareOptionProp Is shared option property object
 * @param {boolean} isGroupAdminOrSysAdmin Is logged in user is group admin or system admin or not.
 * @param {boolean} isEditable True/False to set the edit state of input properties
 * @returns {Object} Updated properties object with edit state.
 */
export let setPropsEditState = function( palNameProp, palDescProp, shareOptionProp, isGroupAdminOrSysAdmin, isEditable ) {
    var isPropEditable = isEditable;
    if( isPropEditable === undefined ) {
        isPropEditable = false;
    }
    // Update the PAL name property edit state
    const palName = { ...palNameProp };
    palName.isEditable = isPropEditable;
    palName.isEnabled = isPropEditable;
    // Update the PAL description property edit state
    const palDesc = { ...palDescProp };
    palDesc.isEditable = isPropEditable;
    palDesc.isEnabled = isPropEditable;

    //  Update the PAL shared property edit state based on logged in user is group admin or system admin
    const shareOption = { ...shareOptionProp };
    if( isGroupAdminOrSysAdmin ) {
        shareOption.isEditable = isPropEditable;
        shareOption.isEnabled = isPropEditable;
    }

    return {
        palName : palName,
        palDesc: palDesc,
        isSharedOption: shareOption
    };
};

/**
 * Cancel the assignment being made from user and refresh the page.
 */
export let cancelTemplateAssignments = function() {
    var editHandler = editHandlerService.getEditHandler( 'TEMPLATE_ROW_EDIT' );
    // Get the edit handler and if not null then cancel all edits
    if( editHandler ) {
        editHandler.cancelEdits();
    }
};

/**
 * Cancel the assignment being made from user and refresh the page.
 */
export let resetTemplateAssignments = function() {
    var editHandler = editHandlerService.getEditHandler( 'TEMPLATE_ROW_EDIT' );
    // Get the edit handler and if not null then cancel all edits
    if( editHandler ) {
        editHandler.resetEdits();
    }
};

export const destoryTemplateAssignment = ( policyId ) => {
    unRegisterPropPolicy( policyId );
    appCtxSvc.unRegisterCtx( 'workflowPalData' );
};

export default exports = {
    loadTreeTableColumns,
    loadTreeTableData,
    registerPropPolicy,
    unRegisterPropPolicy,
    saveTemplateAssignments,
    cancelTemplateAssignments,
    handleTaskNodeSelection,
    setPropsEditState,
    registerEditHandler,
    resetTemplateAssignments,
    destoryTemplateAssignment
};
