// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TemplateHandlersTab
 */
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import viewModelObjectService from 'js/viewModelObjectService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import policySvc from 'soa/kernel/propertyPolicyService';
import iconSvc from 'js/iconService';
import clientDataModel from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import _localeSvc from 'js/localeService';
import uwPropertySvc from 'js/uwPropertyService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';

/**
   * Define public API
   */
var exports = {};
var resource = '/i18n/WorkflowDesignerMessages';
var localTextBundle = _localeSvc.getLoadedText( resource );

var _propPolicy = null;
var handlerInfoMap = {};

/**
   * Create the VM node that need to be shown in tree as node.
   *
   * @param {Object} data Data view model object
   * @param {Object} obj object to be created
   * @param {childNdx} childNdx Index
   * @param {levelNdx} levelNdx index
   * @return {ViewModelTreeNode} View Model Tree Node
   */
function createVMNodeUsingObjectInfo( data, parentNode, object, childNdx, levelNdx, i18n ) {
    // Check if input object is null then no need to create node from here and return.
    if( !object && !object.type ) {
        return null;
    }
    var displayName;
    var objUid = object.uid;
    var objType = object.type;
    // Check if object props is not null and object string proeprty populated then
    // get the dispaly name from property
    if( object.props && object.props.object_string && object.props.object_string.uiValues ) {
        displayName = object.props.object_string.uiValues[ 0 ];
    }
    var viewModelObj = null;
    var iconURL = null;
    // Check if uid present
    if( object.uid ) {
        viewModelObj = viewModelObjectService.constructViewModelObjectFromModelObject( object, 'EDIT' );
        //iconURL = iconSvc.getTypeIconURL( objType );
    } else {
        // Create the action nodes as these are dummy objects and set some required
        // properties and dispaly name to be shown.
        objType = 'Action';
        viewModelObj = tcViewModelObjectService.createViewModelObjectById( object.actionName );
        viewModelObj.uid = object.actionName;
        viewModelObj.actionType = object.actionType;
        displayName = localTextBundle[ object.actionName ];
        viewModelObj.type = objType;
        //Creating dummy 'Argumnets' view model prop to remove the skeleton grey line for Action Types
        var dummyArgumentProp = uwPropertySvc.createViewModelProperty( 'arguments', i18n.arguments, 'STRING', '', '' );
        viewModelObj.props = {
            arguments:dummyArgumentProp
        };
        iconURL = iconSvc.getTypeIconFileUrl( 'typeAction48.svg' );
    }

    // Check if view model object is null then no need to process futher and return from here
    if( !viewModelObj ) {
        return null;
    }

    var hasChildren = true;

    //Check if action object has no children then set hasChildren to false so no expand icon will be shown
    if( object.actionEmpty ) {
        hasChildren = false;
    } else if( viewModelObj.modelType && viewModelObj.modelType.typeHierarchyArray.indexOf( 'EPMHandler' ) > -1 ) {
        // Check if viewModelObj is of type EPMHandler then set hasChildren to false so no expand icon will be shown
        hasChildren = false;
        iconURL = iconSvc.getTypeIconURL( 'typeActionHandler48.svg' );
    } else if( viewModelObj.modelType && viewModelObj.modelType.typeHierarchyArray.indexOf( 'EPMBusinessRule' ) > -1 ) {
        // Check if viewModelObj is of type EPMBusinessRule then set dispaly name correctly based on rule quorum
        var quorumProp = null;
        iconURL = iconSvc.getTypeIconURL( 'typeRuleHandler48.svg' );
        if( viewModelObj.props.rule_quorum && viewModelObj.props.rule_quorum.dbValues ) {
            quorumProp = viewModelObj.props.rule_quorum.dbValues[ 0 ];
        }
        var ruleHandlerLength = 0;
        if( viewModelObj.props.rule_handlers && viewModelObj.props.rule_handlers.dbValues ) {
            ruleHandlerLength = viewModelObj.props.rule_handlers.dbValues.length;
        }

        // Parse the quorum string value to int value to populate the correct label
        var quorumIntValue = 0;
        if( quorumProp ) {
            quorumIntValue = parseInt( quorumProp );
        }

        // Check if rule handler length > 1 and quorumIntValue equal to ruleHandlerLength then set the and rule label
        // Check if rule handler length > 1 and quorumIntValue equal to 1 then set the or rule label
        // Else set the default rule label
        if( ruleHandlerLength > 1 && quorumIntValue === ruleHandlerLength ) {
            displayName = localTextBundle.orRuleLabel;
        } else if( ruleHandlerLength > 1 && quorumIntValue === 1 ) {
            displayName = localTextBundle.andRuleLabel;
        } else {
            displayName = localTextBundle.quorumRuleLabel;
        }
    }

    // Create the tree node and set that ti has child nodes or not based on certail validation
    var vmNode = awTableTreeSvc.createViewModelTreeNode( objUid, objType, displayName, levelNdx, childNdx, iconURL );
    vmNode.id = viewModelObj.uid;
    vmNode.uid = viewModelObj.uid;
    vmNode.isLeaf = !hasChildren;
    vmNode.isExpanded = false;
    vmNode = _.extend( vmNode, viewModelObj );
    return vmNode;
}

/**
   * Create all actions for specific selected task template object and return those nodes.
   *
   * @param {Object} data Data view model object
   * @param {Object} parentNode Parent node for children need to be populated
   * @param {Array} modelObjects Model objects for nodes need to be created
   * @param {Array} vmNodes VM nodes created for input model objects
   * @param {Array} nodesToExpanded Nodes that have children needs to be exapnded by default
   *
   */
var _createNodesforObjects = function( data, parentNode, modelObjects, vmNodes, nodesToExpanded, isRuleHandler, i18n ) {
    if( parentNode && modelObjects && modelObjects.length > 0 ) {
        var levelNdx = parentNode.levelNdx + 1;
        for( var ndx = 0; ndx < modelObjects.length; ndx++ ) {
            // Create the node for model object
            var vmNode = createVMNodeUsingObjectInfo( data, parentNode, modelObjects[ ndx ], ndx, levelNdx, i18n );
            if( vmNode ) {
                //need actionName for move up and down and actiontype for paste operation
                if( isRuleHandler ) {
                    vmNode.BRObjectNodeUid = parentNode.id;
                    vmNode.actionName = parentNode.id;
                }
                if( parentNode.id ) {
                    vmNode.actionType = parentNode.actionType;
                    vmNode.actionName = parentNode.id;
                }
                vmNodes.push( vmNode );
                // Check if VM node is not leaf level node means it has some children and nodesToExpanded
                // is defiend then add to nodesToExpanded so that it can be expanded by default
                if( !vmNode.isLeaf && nodesToExpanded ) {
                    nodesToExpanded.push( vmNode );
                }
            }
        }
    }
};

/**
   * Create all actions for specific selected task template object and return those nodes.
   *
   * @param {Object} data Data view model object
   * @param {Object} parentNode Parent node for children need to be populated
   * @param {Object} handlerInfo Map that contains info based on nodes need to be created
   * @param {Array} nodesToExpanded Nodes that have children needs to be exapnded by default
   * @return {ObjectArray} Child nodes array that will be shown on UI
   */
var _populateTaskHandlerActionNodes = function( data, parentNode, handlerInfo, nodesToExpanded, i18n ) {
    var vmNodes = [];
    // Check if input handlerInfo or parent node is not valid then return emptry array from here
    if( !handlerInfo || !parentNode ) {
        return vmNodes;
    }
    var actionArray = [ 'assign_action', 'start_action', 'perform_action', 'complete_action', 'skip_action', 'suspend_action',
        'resume_action', 'abort_action', 'undo_action'
    ];

    var levelNdx = parentNode.levelNdx + 1;
    // Get all action array that need to be shown for parent tempalte node
    //var actionInfoArray = handlerInfo[ parentNode.id ];

    // Check if action array is not null and empty then only iterate to create all action nodes
    if( handlerInfo ) {
        for( var childNdx = 0; childNdx < actionArray.length; childNdx++ ) {
            var object = actionArray[ childNdx ];
            var actionObject = handlerInfo[ object ];
            // Create the node for specific action
            var vmNode = createVMNodeUsingObjectInfo( data, parentNode, actionObject, childNdx, levelNdx, i18n );
            if( vmNode ) {
                vmNodes.push( vmNode );
                // Check if VM node is not leaf level node means it has some children and nodesToExpanded
                // is defiend then add to nodesToExpanded so that it can be expanded by default
                if( !vmNode.isLeaf && nodesToExpanded ) {
                    nodesToExpanded.push( vmNode );
                }
            }
        }
    }
    return vmNodes;
};

/**
   * Create all business rule handlers and action handlers for specific action object and return those nodes.
   *
   * @param {Object} data Data view model object
   * @param {Object} parentNode Parent node for children need to be populated
   * @param {Object} handlerInfo Map that contains info based on nodes need to be created
   * @param {Array} nodesToExpanded Nodes that have children needs to be exapnded by default
   * @return {ObjectArray} Child nodes array that will be shown on UI
   */
var _populateBRuleAndActionHandlers = function( data, parentNode, handlerInfo, nodesToExpanded, i18n ) {
    var vmNodes = [];
    // Check if input handlerInfo or parent node is not valid then return emptry array from here
    if( !handlerInfo || !parentNode ) {
        return vmNodes;
    }

    // Get the object infor for specific action from map and based on that info create the node
    // for business rule and action handlers
    var object = handlerInfo[ parentNode.id ];

    // Get the business rule objects and if not null then only create those rule nodes
    var ruleBusinessObjects = object.ruleHandlers;
    if( ruleBusinessObjects && ruleBusinessObjects.length > 0 ) {
        _createNodesforObjects( data, parentNode, ruleBusinessObjects, vmNodes, nodesToExpanded, false, i18n );
    }
    // Get the action handler objects and if not null then only create those rule nodes
    var actionHandlers = object.actionHandlers;
    if( actionHandlers && actionHandlers.length > 0 ) {
        _createNodesforObjects( data, parentNode, actionHandlers, vmNodes, nodesToExpanded, false, i18n );
    }
    return vmNodes;
};

/**
   * Create all rule handlers for specific business rule object and return those nodes.
   *
   * @param {Object} data Data view model object
   * @param {Object} parentNode Parent node for children need to be populated
   * @param {Object} handlerInfo Map that contains info based on nodes need to be created
   * @return {ObjectArray} Child nodes array that will be shown on UI
   */
var _populateRuleHandlers = function( data, parentNode, handlerInfo, nodesToExpand, i18n ) {
    var vmNodes = [];
    // Check if input handlerInfo or parent node is not valid then return emptry array from here
    if( !handlerInfo || !parentNode ) {
        return vmNodes;
    }

    // Get all rule handlers for business rule object based on input parent node and if valid
    // then only create rule nodes
    var ruleHandlersArray = handlerInfo[ parentNode.id ];
    if( !ruleHandlersArray || ruleHandlersArray.length <= 0 ) {
        return vmNodes;
    }
    // Create all rule handler nodes
    _createNodesforObjects( data, parentNode, ruleHandlersArray, vmNodes,  nodesToExpand, true, i18n );
    return vmNodes;
};

/**
   * Get the children based on parent and populate the child nodes and return
   * from here so those child nodes will be shown on tree.
   *
   * @param {Object} data Data view model object
   * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from.
   * @param {Array} nodesToExpanded Nodes that have children needs to be exapnded by default
   *
   * @return {ObjectArray} Child nodes array that will be shown on UI
   */
var _getChildren = function( data, treeLoadInput, nodesToExpanded, i18n, handlerInfoMap ) {
    // This is the "root" node of the tree or the node that was selected for expansion
    var parentNode = treeLoadInput.parentNode;
    var childNodes = [];
    if( !parentNode ) {
        return childNodes;
    }

    if( parentNode.levelNdx === -1 ) {
        // If parent node index is 0 that means all actions need to be populated
        childNodes = _populateTaskHandlerActionNodes( data, parentNode, handlerInfoMap, nodesToExpanded, i18n );
    } else if( parentNode.levelNdx === 0 && parentNode.type === 'Action' ) {
        // If parent node index is 1 and parent node type is action then populate all BRobjects and action handlers
        childNodes = _populateBRuleAndActionHandlers( data, parentNode, handlerInfoMap, nodesToExpanded, i18n );
    } else if( parentNode.modelType && parentNode.modelType.typeHierarchyArray.indexOf( 'EPMBusinessRule' ) > -1 ) {
        // If parent node type is BR rule object then all rule handler needs to be populated
        childNodes = _populateRuleHandlers( data, parentNode, handlerInfoMap, nodesToExpanded, i18n );
    }
    return childNodes;
};

/**
   * Get the action value based on action type
   * @param {String} actionType Action type string value
   * @return {int} Action type int value based on action type
   */
var _getActionTypeValue = function( actionType ) {
    var action = -1;
    switch ( actionType ) {
        case 'assign_action':
            action = 1;
            break;
        case 'start_action':
            action = 2;
            break;
        case 'perform_action':
            action = 100;
            break;
        case 'complete_action':
            action = 4;
            break;
        case 'skip_action':
            action = 5;
            break;
        case 'suspend_action':
            action = 6;
            break;
        case 'resume_action':
            action = 7;
            break;
        case 'abort_action':
            action = 9;
            break;
        case 'undo_action':
            action = 8;
            break;
        default:
            action = -1;
            break;
    }
    return action;
};

/**
   * Get the action handlers from input property object. If input handler name
   * is not null then add those specific handlers only.
   * @param {Object} propObject handler proeprty object
   * @param {String} actionHandlerName Action ahndler name
   *
   * @return {ObjectArray} -  Action handlers array
   */
var _getPropValues = function( propObject, actionHandlerName ) {
    var propValues = [];
    if( propObject && propObject.dbValues && propObject.dbValues.length > 0 ) {
        _.forEach( propObject.dbValues, function( dbValue ) {
            var object = clientDataModel.getObject( dbValue );
            if( object ) {
                if( !actionHandlerName ) {
                    propValues.push( object );
                } else if( actionHandlerName && object.props.object_string.dbValues &&
                      object.props.object_string.dbValues[ 0 ] === actionHandlerName ) {
                    propValues.push( object );
                }
            }
        } );
    }
    return propValues;
};

/**
   * Based on input proeprty object check for values and return the business rule object
   * along with its rule handlers.
   *
   * @param {Object} propObject Property object whose value needs to be fetched
   * @return {Array} Array that will info for all rules along with rule handlers.
   */
var _getRuleHandlers = function( propObject ) {
    var propValues = [];
    // Check if input proeprty object is not null and dbvalues are not empty then
    // only get the BusinessRule object and then gets its rule handlers
    if( propObject && propObject.dbValues && propObject.dbValues.length > 0 ) {
        _.forEach( propObject.dbValues, function( dbValue ) {
            var bRuleObject = clientDataModel.getObject( dbValue );
            var childObjects = [];
            // Check if BRule object is not null and rule handlers present then gets those rule handlers
            if( bRuleObject && bRuleObject.props.rule_handlers && bRuleObject.props.rule_handlers.dbValues ) {
                _.forEach( bRuleObject.props.rule_handlers.dbValues, function( childDbValue ) {
                    var childObject = clientDataModel.getObject( childDbValue );
                    if( childObject ) {
                        childObjects.push( childObject );
                    }
                } );
                var ruleObject = {
                    object: bRuleObject,
                    childObjects: childObjects
                };
                // Push it to array that will be used to dispaly the nodes in tree later
                propValues.push( ruleObject );
            }
        } );
    }
    return propValues;
};

/**
   * Function to populate the handler info for input object
   *
   */
var _populateHandlersInfo = function( selTemplateObject ) {
    var handlerDataMap = new Object();
    var templateObject = clientDataModel.getObject( selTemplateObject.uid );
    var actionArray = [ 'assign_action', 'start_action', 'perform_action', 'complete_action', 'skip_action', 'suspend_action',
        'resume_action', 'abort_action', 'undo_action'
    ];

    handlerDataMap[ selTemplateObject.uid ] = actionArray;

    // Iterate for all action array and then populate the info for each action along with its action and rule handlers
    _.forEach( actionArray, function( action ) {
        var rulePropName = action + '_rules';
        var actionPropName = action + '_handlers';
        var ruleProp = templateObject.props[ rulePropName ];
        var actionProp = templateObject.props[ actionPropName ];
        var ruleHandlerObjects = _getRuleHandlers( ruleProp );
        var ruleBRHandlerObjects = _getPropValues( ruleProp );
        var actionHandlerObjects = _getPropValues( actionProp );
        var isEmpty = true;
        // Check if for specific action rule and action handler present then set isEmpty on action to false
        if(  ruleHandlerObjects && ruleHandlerObjects.length > 0  ||  actionHandlerObjects && actionHandlerObjects.length > 0  ) {
            isEmpty = false;
        }
        var object = {
            actionName: action,
            actionType: _getActionTypeValue( action ),
            ruleHandlers: ruleBRHandlerObjects,
            actionHandlers: actionHandlerObjects,
            actionEmpty: isEmpty
        };

        handlerDataMap[ action ] = object;
        // Check if rule handler objects are not null then only add that info to map
        // where key will be business rule Uid and value will be all rule handlers
        if( ruleHandlerObjects && ruleHandlerObjects.length > 0 ) {
            _.forEach( ruleHandlerObjects, function( ruleHandlerObj ) {
                var ruleHandlers = ruleHandlerObj.childObjects;
                handlerDataMap[ ruleHandlerObj.object.uid ] = ruleHandlers;
            } );
        }
    } );
    return handlerDataMap;
};


/**
   * Defer the event to exapnd the nodes that need expansion by default.
   * @param {Array} nodes Nodes that need to be expanded
   */
export let fireToExpandTreeNode = function( nodes ) {
    if( nodes && nodes.length > 0 ) {
        _.defer( function() {
            // send event that will be handled in this file to check
            // if there are nodes to be expanded. This defer is needed
            // to make sure tree nodes are actually loaded before we attempt
            // to expand them. Fixes a timing issue if not deferred.
            eventBus.publish( 'workflowHandler.expandNodes', {
                nodesToExpand: nodes
            } );
        } );
    }
};

/**
   * Fire tree node expand event if node is not expanded already
   * @param {Array} expandNodes Nodes that need to be expanded
   */
export let expandTreeNodes = function( expandNodes ) {
    _.defer( function() {
        // expandNodes contains nodes we want to expand. We
        // had to make these deferred calls to allow the tree to draw before
        // we asked it to expand a node.
        _.forEach( expandNodes, function( expandNode ) {
            // Check if node is not null and not expanded then only set
            // isExpanded to true and fire the event
            if( expandNode && !expandNode.isExpanded ) {
                expandNode.isExpanded = true;
                eventBus.publish( 'handlersTreeView.plTable.toggleTreeNode', expandNode );
            }
        } );
    } );
};

/**
 * Update the object_name widget values so that it can show selected template name correctly on UI.
 *
 * @param {Object} selected Selected task template object for handler info need to be shown
 * @param {Object} data Data view model object.
 *
 * @returns {Object} Updated object name property object that will be shown on UI
 */
var _populateObjectNameProp = function( selected, data ) {
    let objectNameProp = { ...data.objectName };
    if( !selected || !selected.uid || !selected.props || !selected.props.object_name ) {
        return objectNameProp;
    }
    // Check if object_name proeprty is loaded correctly then set the widget value and return
    // the update widget.
    if( selected.props.object_name.dbValues &&  selected.props.object_name.uiValues
        && selected.props.object_name.dbValues[ 0 ] &&  selected.props.object_name.uiValues[ 0 ] ) {
        objectNameProp.dbValues = selected.props.object_name.dbValues;
        objectNameProp.dbValue = selected.props.object_name.dbValues[0];
        objectNameProp.uiValues = selected.props.object_name.uiValues;
        objectNameProp.uiValue = selected.props.object_name.uiValues[0];
    } else {
        objectNameProp = selected.props.object_name;
    }
    return objectNameProp;
};

/**
   * Load the required properties before rendering the table and then call SOA to render the table.
   *
    * @param {Object} data Data view model object
   * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
   *            the result of processing the 'inputData' property of a DeclAction based on data from the current
   *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
   * @param {Object} selected Selected  object from UI
   * @param {Array} attributes Attributes array that needs to be fetched
   * @param {object} i18n localization values
   *
   * @returns {Object} TreeLoadResult along with other parameter like valid object that will use to rerender the tree.
   */
var _loadRequiredPropAndBuildTree = function( data, treeLoadInput, selected, attributes, i18n ) {
    var policy = data.dataProviders.handlersDataProvider.policy;
    if( policy ) {
        _propPolicy = policySvc.register( policy );
    }
    var request = {
        objects: [ selected ],
        attributes: attributes
    };
    return soaService.post( 'Core-2006-03-DataManagement', 'getProperties', request ).then( function( soaResponse ) {
        handlerInfoMap = _populateHandlersInfo( selected );
        var endReached = false;
        var tempCursorObject = {
            endReached: true,
            startReached: true
        };
        var nodesToExpanded = [];
        var childNodes = _getChildren( data, treeLoadInput, nodesToExpanded, i18n, handlerInfoMap );
        // Create tree load result for all child nodes
        var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childNodes, false, true, endReached, null );
        treeLoadResult.parentNode.cursorObject = tempCursorObject;
        // Fire the event to expand child node that have children
        //exports.fireToExpandTreeNode( nodesToExpanded );
        const objectNameProp = _populateObjectNameProp( selected, data );

        return {
            treeLoadResult:treeLoadResult,
            objectName: objectNameProp
        };
    },
    function( error ) {
        //deferred.reject( error );
    } );
};
/**
   * Get a page of row data for a 'tree' table.
   *
   * @param {Object} data Data view model object
   * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
   *            the result of processing the 'inputData' property of a DeclAction based on data from the current
   *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
   * @param {Object} selected Selected  object from UI
   * @param {Array} attributes Attributes array that needs to be fetched
   * @param {object} i18n localization values
   * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
   *         available.
   */
export let loadTreeTableData = function( data, treeLoadInput, selected, attributes, i18n ) {
    var parentNode = treeLoadInput.parentNode;
    var isTopNode = parentNode.levelNdx === -1;

    //For the first time when selectionData.selected is not set or if something is selected from any other tab which is not of type EPMTaskTemplate and we directly come to next tab
    if( !selected || !selected.modelType || selected.modelType.typeHierarchyArray.indexOf( 'EPMTaskTemplate' ) === -1 ) {
        if( data.subPanelContext.workflowDgmState.selectedObject ) {
            selected = data.subPanelContext.workflowDgmState.selectedObject;
        }else{
            selected = data.subPanelContext.selected;
        }
    }
    if( isTopNode ) {
        return AwPromiseService.instance.resolve( _loadRequiredPropAndBuildTree( data, treeLoadInput, selected, attributes, i18n ) );
    }
    var childNodes = _getChildren( data, treeLoadInput, null, i18n, handlerInfoMap );
    // Create tree load result for all child nodes
    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, childNodes, false, true, true, null );
    const objectNameProp = _populateObjectNameProp( selected, data );
    return {
        treeLoadResult:treeLoadResult,
        objectName: objectNameProp
    };
};

/**
   * loadTreeProperties
   *
   * @param {object} propertyLoadInput property load inputs
   * @returns {promise} Promise object
   */
function _loadTreeProperties( propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            if( childNode.id !== 'top' ) {
                allChildNodes.push( childNode );
            }
        } );
    } );
    var propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );

    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
}

/**
   * Get a page of row data for a 'tree' table.
   * @returns {promise} promise
   */
export let loadTreeTableProperties = function() {
    var propertyLoadInput = '';
    for( var ndx = 0; ndx < arguments.length; ndx++ ) {
        var arg = arguments[ ndx ];
        if( arg.propertyLoadRequests ) {
            propertyLoadInput = arg;
        }
    }

    /**
       * Load the 'child' nodes for the 'parent' node.
       */
    return _loadTreeProperties( propertyLoadInput );
};

/**
   * Register the property polciy that need to be registered when user go to
   * assignment tab for assign all task.
   *
   * @param {object} dataProvider Data provider object
   */
export let registerPropPolicy = function( dataProvider ) {
    var policy = dataProvider.policy;
    if( policy ) {
        _propPolicy = policySvc.register( policy );
    }
};

/**
   *
   * UnRegister the property polciy that need to be removed from policy when user go out from
   * assignment tab for assign all task.
   */
export let unRegisterPropPolicy = function() {
    if( _propPolicy ) {
        policySvc.unregister( _propPolicy );
        _propPolicy = null;
    }
};

/**
   * Get the index of selected handler to show move up-down command
   * @param {Object} selectedHandler Selected object from handler tree from UI
   * @param {Object} selectedObject template object
   * @param{object} data data
   * @return {object} variables to determine the moveup and down command conditions
   */
export let getIndexOfSelectedHandler = function( selectedHandler, selectedObject, data ) {
    let enableHandlerMoveUp = false;
    let enableHandlerMoveDown = false;
    if( selectedHandler && ( selectedHandler.type === 'EPMHandler' || selectedHandler.type === 'EPMBRHandler' || selectedHandler.type === 'EPMBusinessRule' ) ) {
        var index = _.findKey( data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects, {
            uid: selectedHandler.actionName
        } );
        if( index > -1  && data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[index].children.length > 1 ) {
            var handlerIndex = parseInt( _.findKey( data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[index].children, {
                uid: selectedHandler.uid
            } ) );
            if( handlerIndex < data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[index].children.length - 1 && handlerIndex > 0 ) {
                enableHandlerMoveUp = true;
                enableHandlerMoveDown = true;
            } else if( handlerIndex === 0 ) {
                enableHandlerMoveDown = true;
            } else if( handlerIndex === data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[index].children.length - 1 ) {
                enableHandlerMoveUp = true;
            }
        }
    }
    return{
        enableHandlerMoveUp:enableHandlerMoveUp,
        enableHandlerMoveDown:enableHandlerMoveDown,
        selectedHandler:selectedHandler,
        selectedObject:selectedObject
    };
};
export let setPreSelection = function( ctx, data ) {
    for( var i = 0; i < data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects.length; i++ ) {
        if( data.selectedHandler && data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[i].uid === data.selectedHandler.uid ) {
            return data.dataProviders.handlersDataProvider.viewModelCollection.loadedVMObjects[i];
        }
    }
};
export let updateHandlerTreeTable = function( ctx, operation, handlerToUpdate ) {
    eventBus.publish( 'workflowDesigner.updateHandlerTree' );
};

export default exports = {
    fireToExpandTreeNode,
    expandTreeNodes,
    loadTreeTableData,
    loadTreeTableProperties,
    registerPropPolicy,
    unRegisterPropPolicy,
    setPreSelection,
    getIndexOfSelectedHandler,
    updateHandlerTreeTable
};
