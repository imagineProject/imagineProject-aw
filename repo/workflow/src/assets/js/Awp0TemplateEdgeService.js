// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TemplateEdgeService
 */
import AwPromiseService from 'js/awPromiseService';
import workflowUtils from 'js/Awp0WorkflowDesignerUtils';
import listBoxSvc from 'js/listBoxService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import editService from 'js/Awp0WorkflowAssignmentEditService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import clientDataModel from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

/**
  * Creates an edit handler for the view model object.
  * @param {Object} data Data view model object
  *
  */
export let addEditHandler = function( ctx, data, subPanelContext ) {
    var saveEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        exports.updateHandlerEdge( ctx, data, subPanelContext );
        deferred.resolve( {} );
        return deferred.promise;
    };

    var cancelEditFunc = function() {
        // function that returns a promise.
        var deferred = AwPromiseService.instance.defer();
        if( data && data.vmo ) {
            data.vmo.clearEditiableStates( true );
        }
        deferred.resolve( {} );
        return deferred.promise;
    };
    // Pass true as last argument to enable auto save
    editService.createEditHandlerContext( data, null, saveEditFunc, cancelEditFunc, 'EDGE_PROPERTIES_EDIT', null, true );
};

export let updateEdgeDataInPropertiesTab = function( ctx, incontextData, subPanelContext ) {
    if( subPanelContext.workflowDgmState.selectedEdges && subPanelContext.workflowDgmState.selectedEdges.length > 0 ) {
        const data = { ...incontextData };
        data.vmo = null;
        data.conditionTaskRadioButton.dbValue = '';
        data.conditionTaskRadioButton.uiValue = '';
        data.validateTaskRadioButton.dbValue = '';
        data.validateTaskRadioButton.uiValue = '';
        data.sourceNode.dbValue = subPanelContext.workflowDgmState.selectedEdges[ 0 ].sourceNode.modelObject.props.object_name.dbValues[ 0 ];
        data.sourceNode.uiValue = subPanelContext.workflowDgmState.selectedEdges[ 0 ].sourceNode.modelObject.props.object_name.dbValues[ 0 ];
        data.targetNode.dbValue = subPanelContext.workflowDgmState.selectedEdges[ 0 ].targetNode.modelObject.props.object_name.dbValues[ 0 ];
        data.targetNode.uiValue = subPanelContext.workflowDgmState.selectedEdges[ 0 ].targetNode.modelObject.props.object_name.dbValues[ 0 ];
        exports.getCurrentCustomPathForEdge( ctx, data, subPanelContext );
        var isPanelEditable = workflowUtils.isTemplateEditMode( ctx.xrtSummaryContextObject, ctx );
        var vmoObject = tcViewModelObjectSvc.createViewModelObjectById( 'AAAAAAAA' );
        data.customPathsMultiselect.isEditable = true;
        data.customPathsMultiselect.isModifiable = true;
        data.conditionTaskRadioButton.isEditable = true;
        vmoObject.props = {
            conditionTaskRadioButton: data.conditionTaskRadioButton,
            customPathsMultiselect: data.customPathsMultiselect,
            validateTaskRadioButton: data.validateTaskRadioButton
        };
        data.vmo = vmoObject;
        if( isPanelEditable ) {
            exports.addEditHandler( ctx, data, subPanelContext );
        }
        return {
            conditionTaskRadioButton: data.conditionTaskRadioButton,
            validateTaskRadioButton:data.validateTaskRadioButton,
            sourceNode:data.sourceNode,
            targetNode:data.targetNode,
            customPathsMultiselect:data.customPathsMultiselect,
            vmo:vmoObject,
            customPathlist:data.customPathlist
        };
    }
};
export let onChangeConditionTaskRadioButton = function( data, ctx ) {
    let tempData = { ...data };
    if( tempData.conditionTaskRadioButton.dbValue === true ) {
        tempData.customPathlist = null;
        tempData.customPathlist = listBoxSvc.createListModelObjectsFromStrings( [ 'true' ] );
        tempData.customPathsMultiselect.dbValue = [ 'true' ];
        tempData.customPathsMultiselect.uiValue = 'true';
    }
    if( tempData.conditionTaskRadioButton.dbValue === false ) {
        tempData.customPathlist = null;
        tempData.customPathlist = listBoxSvc.createListModelObjectsFromStrings( [ 'false' ] );
        tempData.customPathsMultiselect.dbValue = [ 'false' ];
        tempData.customPathsMultiselect.uiValue = 'false';
    }

    tempData.customPathsMultiselect.displayValues = [ ...tempData.customPathsMultiselect.dbValue ];
    return {
        customPathsMultiselect:tempData.customPathsMultiselect,
        customPathlist:tempData.customPathlist
    };
};
export let onChangeValidateTaskRadioButton = function( data, ctx, subPanelContext ) {
    if( data.validateTaskRadioButton.dbValue === 'ANY' ) {
        data.customPathlist = null;
        data.customPathlist = listBoxSvc.createListModelObjectsFromStrings( [ 'ANY' ] );
        data.customPathsMultiselect.dbValue = [ 'ANY' ];
        data.customPathsMultiselect.uiValue = 'ANY';
        ctx.validateRadioButtonClicked = true;
    }
    if( data.validateTaskRadioButton.dbValue === 'error' && ctx.validateRadioButtonClicked ) {
        exports.getCurrentCustomPathForEdge( ctx, data, subPanelContext );
    }
    data.customPathsMultiselect.displayValues = [ ...data.customPathsMultiselect.dbValue ];
    return {
        customPathsMultiselect:{ ...data.customPathsMultiselect },
        customPathlist:data.customPathlist
    };
};
export let addTocustomPaths = function( tempData, ctx ) {
    let data = { ...tempData };
    if( data.customPathText.uiValue !== '' ) {
        var customPath = listBoxSvc.createListModelObjectsFromStrings( [ data.customPathText.uiValue ] );
        if( !data.customPathlist ) {
            data.customPathlist = customPath;
        } else {
            data.customPathlist.push( customPath[ 0 ] );
        }
        if( data.customPathsMultiselect.uiValue === '' ) {
            data.customPathsMultiselect.uiValue = data.customPathText.uiValue;
        } else {
            data.customPathsMultiselect.uiValue = data.customPathsMultiselect.uiValue + ',' + data.customPathText.uiValue;
        }
        data.customPathsMultiselect.dbValue.push( data.customPathText.uiValue );
        data.customPathsMultiselect.valueUpdated = true;
        data.customPathText.uiValue = '';
        data.customPathText.dbValue = '';
    }
    if( data.errorCodeText.uiValue !== '' ) {
        var errorPath = listBoxSvc.createListModelObjectsFromStrings( [ data.errorCodeText.uiValue ] );
        if( !data.customPathlist ) {
            data.customPathlist = errorPath;
        } else {
            data.customPathlist.push( errorPath[ 0 ] );
        }
        if( data.customPathsMultiselect.uiValue === '' ) {
            data.customPathsMultiselect.uiValue = data.errorCodeText.uiValue;
        } else {
            data.customPathsMultiselect.uiValue = data.customPathsMultiselect.uiValue + ',' + data.errorCodeText.uiValue;
        }
        data.customPathsMultiselect.dbValue.push( data.errorCodeText.uiValue );
        data.customPathsMultiselect.valueUpdated = true;
        data.errorCodeText.uiValue = '';
        data.errorCodeText.dbValue = '';
    }

    // avoid states mutation
    // always use new object
    data.customPathsMultiselect.displayValues = [ ...data.customPathsMultiselect.dbValue ];
    return {
        customPathsMultiselect: { ...data.customPathsMultiselect, dbValue: _.cloneDeep( data.customPathsMultiselect.dbValue ) },
        customPathlist:data.customPathlist,
        errorCodeText:data.errorCodeText,
        customPathText:data.customPathText
    };
};
export let getCurrentCustomPathForEdge = function( ctx, data, subPanelContext ) {
    var selectedEdges = subPanelContext.workflowDgmState.selectedEdges;
    if( selectedEdges && selectedEdges.length > 0 ) {
        if( selectedEdges[ 0 ].sourceNode.modelObject.type === 'EPMConditionTaskTemplate' || selectedEdges[ 0 ].sourceNode.modelObject.type === 'EPMValidateTaskTemplate' ) {
            if( !selectedEdges[ 0 ].getLabel() ) {
                return;
            }
            var argumentValue = selectedEdges[ 0 ].getLabel().getText();
            if( argumentValue === '' ) {
                return;
            }
            var argumentValueList = argumentValue.split( ',' );
            data.customPathlist = listBoxSvc.createListModelObjectsFromStrings( argumentValueList );
            data.customPathsMultiselect.dbValue = argumentValueList;
            data.customPathsMultiselect.displayValues = [ ...data.customPathsMultiselect.dbValue ];
            data.customPathsMultiselect.uiValue = argumentValue;
            data.results.uiValue = argumentValue;
            data.results.dbValue = argumentValue;
            if( argumentValue === 'true' ) {
                data.conditionTaskRadioButton.dbValue = 'true';
                data.conditionTaskRadioButton.uiValue = 'true';
            }
            if( argumentValue === 'false' ) {
                data.conditionTaskRadioButton.dbValue = 'false';
                data.conditionTaskRadioButton.uiValue = 'false';
            }
            if( argumentValue === 'ANY' && data.validateTaskRadioButton.dbValue !== 'error' ) {
                data.validateTaskRadioButton.dbValue = 'ANY';
                data.validateTaskRadioButton.uiValue = 'ANY';
            }
            if( argumentValue === 'ANY' && data.validateTaskRadioButton.dbValue === 'error' ) {
                data.validateTaskRadioButton.dbValue = 'error';
                data.validateTaskRadioButton.uiValue = 'error';
                ctx.validateRadioButtonClicked = false;
                data.customPathlist = null;
                data.customPathsMultiselect.dbValue = [];
                data.customPathsMultiselect.uiValue = '';
            }
            if( argumentValue !== 'ANY' && selectedEdges[ 0 ].sourceNode.modelObject.type === 'EPMValidateTaskTemplate' ) {
                data.validateTaskRadioButton.dbValue = 'error';
                data.validateTaskRadioButton.uiValue = 'error';
                ctx.validateRadioButtonClicked = false;
            }
            eventBus.publish( 'getEdgeProperties' );
        }
    }
};

/**
  * Update the input target node based on edge updation.
  * @param {Object} ctx App context obejct
  * @param {String} targetUid Target obejct Uid who need to be updated
  */
var _updateEdgeProperties = function( ctx, targetUid, data, subPanelContext ) {
    var targetObject = clientDataModel.getObject( targetUid );
    if( !targetObject ) {
        return;
    }
    var startRuleHandler = workflowUtils.getStartActionRuleHandlers( targetObject.props.start_action_rules );
    // Check for start rule handler is valid and have valid properties
    // then only go further processing
    if( !startRuleHandler || !startRuleHandler[ 0 ] || !startRuleHandler[ 0 ].props
         || !startRuleHandler[ 0 ].props.arguments || !startRuleHandler[ 0 ].props.arguments.dbValues ) {
        return;
    }
    var argumentValues = workflowUtils.parseHandlerArguments( startRuleHandler[ 0 ].props.arguments.dbValues[ 0 ] );
    var additionalDataMap = {};
    var inputData = [];
    _.forOwn( argumentValues, function( argumentValue, argumentName ) {
        if( argumentName === '-decision' ) {
            if( subPanelContext.workflowDgmState && data && data.customPathsMultiselect && ( !ctx.edgePropertiesCtx || !ctx.edgePropertiesCtx.changeFromLabel ) ) {
                if( data.customPathsMultiselect.uiValue === '' && subPanelContext.workflowDgmState.selectedEdges[ 0 ].sourceNode.modelObject.type === 'EPMConditionTaskTemplate' ) {
                    data.customPathsMultiselect.uiValue = 'true';
                    data.customPathsMultiselect.dbValue = [ 'true' ];
                    data.conditionTaskRadioButton.dbValue = 'true';
                    data.conditionTaskRadioButton.uiValue = 'true';
                }
                if( data.customPathsMultiselect.uiValue === '' && subPanelContext.workflowDgmState.selectedEdges[ 0 ].sourceNode.modelObject.type === 'EPMValidateTaskTemplate' ) {
                    data.customPathsMultiselect.uiValue = 'ANY';
                    data.customPathsMultiselect.dbValue = [ 'ANY' ];
                    data.validateTaskRadioButton.dbValue = 'ANY';
                    data.validateTaskRadioButton.uiValue = 'ANY';
                }
                additionalDataMap[ argumentName ] = [ data.vmo.props.customPathsMultiselect.uiValue ];
                data.results.dbValue = [ data.vmo.props.customPathsMultiselect.uiValue ];
                data.results.uiValue = data.vmo.props.customPathsMultiselect.uiValue;

                var edgeItem = null;
                // Edge need to be selected then get the correct edge from source id and check the target node id
                // to match it.
                var sourceNode = ctx.graph.graphModel.nodeMap[ ctx.state.params.source_uid ];
                var outEdges = sourceNode.getEdges( 'OUT' );
                if( outEdges && outEdges.length > 0 ) {
                    for( var idx = 0; idx < outEdges.length; idx++ ) {
                        if( outEdges[ idx ] && outEdges[ idx ].targetNode && outEdges[ idx ].targetNode.nodeId === ctx.state.params.target_uid ) {
                            edgeItem = outEdges[ idx ];
                            break;
                        }
                    }
                }
                if( edgeItem ) {
                    ctx.graph.graphModel.graphControl.graph.setLabel( edgeItem, data.vmo.props.customPathsMultiselect.uiValue );
                }
            }
            // Check if we have changed the edge label then we need to set that
            if( ctx.edgePropertiesCtx && ctx.edgePropertiesCtx.label && ctx.edgePropertiesCtx.label !== '' ) {
                additionalDataMap[ argumentName ] = [ ctx.edgePropertiesCtx.label ];
                ctx.edgePropertiesCtx.label = '';
                ctx.edgePropertiesCtx.changeFromLabel = false;
            }
        } else {
            additionalDataMap[ argumentName ] = [ argumentValue ];
        }
    } );
    var object = {
        clientID: 'updateHandler',
        handlerToUpdate: startRuleHandler[ 0 ].uid,
        additionalData: additionalDataMap,
        taskTemplate: targetObject.uid,
        action: 2
    };
    inputData.push( object );
    var soaInput = {
        input: inputData
    };
    if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
        var allPromises = [];
        var promise = soaSvc.postUnchecked( 'Workflow-2019-06-Workflow', 'createOrUpdateHandler', soaInput ).then( function( response ) {
            allPromises.push( promise );
            AwPromiseService.instance.all( allPromises ).then( function() {
                if( data && data.vmo ) {
                    data.vmo.clearEditiableStates( true );
                    // exports.updateEdgeDataInPropertiesTab( ctx, data, subPanelContext );
                }
                if( ctx.edgePropertiesCtx ) {
                    appCtxSvc.unRegisterCtx( 'edgePropertiesCtx' );
                }
            }, function( error ) {
                if( data && data.vmo ) {
                    data.vmo.clearEditiableStates( true );
                    data.vmo.props.customPathsMultiselect.isEditable = true;
                }
            } );
        } );
    }
};

export let updateHandlerEdge = function( ctx, data, subPanelContext ) {
    //Fetch target node, source node and start action rule handler present on target node
    if( ctx.state && ctx.state.params && ctx.state.params.target_uid && ctx.state.params.source_uid ) {
        _updateEdgeProperties( ctx, ctx.state.params.target_uid, data, subPanelContext  );
    }
};

/**
  * Register the property policy
  */
var _regiserPropPolicy = function() {
    var policy = {
        types: [ {
            name: 'EPMTaskTemplate',
            properties: [
                {  name: 'start_action_rules', modifiers: [ {  name: 'withProperties', Value: 'true' } ]  },
                {  name: 'template_name'  }, {  name: 'object_string'  }, {  name: 'subtask_template' },
                {  name: 'parent_task_template'  }, {  name: 'successors'  }, {  name: 'predecessors'  },
                {  name: 'stage' },  {  name: 'template_classification' }
            ]
        },
        {
            name: 'EPMAction',
            properties: [ { name: 'rule_handlers',  modifiers: [ { name: 'withProperties', Value: 'true'  } ]
            }
            ]
        },
        {
            name: 'EPMBusinessRule',
            properties: [ {  name: 'rule_handlers', modifiers: [ { name: 'withProperties',  Value: 'true' } ] },
                {  name: 'object_name' }, {   name: 'rule_quorum' },  {  name:'action'  }
            ]
        },
        {
            name: 'EPMBRHandler',
            properties: [ {  name: 'arguments'  }, {  name: 'handler_arguments'  }, {   name: 'object_name' },
                {   name: 'object_string'   },  {   name: 'parent_action_type'  } ]
        } ]
    };

    return policySvc.register( policy );
};

export let labelTextChangeAction = function( eventData, data, subPanelContext ) {
    if( eventData.newValue === eventData.oldValue ) {
        return;
    }

    if( eventData.label && eventData.label.getOwner() ) {
        var owner = eventData.label.getOwner();
        if( owner.category === 'SuccessPath' && owner.sourceNode.modelObject.type === 'EPMConditionTaskTemplate' || owner.category === 'FailPath' && owner.sourceNode.modelObject.type === 'EPMValidateTaskTemplate' ) {
            appCtxSvc.ctx.edgePropertiesCtx = {
                label: eventData.newValue,
                changeFromLabel: true
            };
            if( owner.targetNode && owner.targetNode.modelObject ) {
                var policyId = _regiserPropPolicy();
                dmSvc.getPropertiesUnchecked( [ owner.targetNode.modelObject ], [ 'start_action_rules' ] ).then( function() {
                    if( policyId ) {
                        policySvc.unregister( policyId );
                    }
                    _updateEdgeProperties( appCtxSvc.ctx,  owner.targetNode.modelObject.uid, data, subPanelContext );
                } );
            }
        }
    }
};

export default exports = {
    addEditHandler,
    updateEdgeDataInPropertiesTab,
    onChangeConditionTaskRadioButton,
    onChangeValidateTaskRadioButton,
    addTocustomPaths,
    getCurrentCustomPathForEdge,
    updateHandlerEdge,
    labelTextChangeAction
};
