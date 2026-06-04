// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0NewWorkflowProcessCommandHandler
 */
import TypeDisplayNameService from 'js/typeDisplayName.service';
import messagingService from 'js/messagingService';
import commandPanelService from 'js/commandPanel.service';
import appCtx from 'js/appCtxService';
import adapterSvc from 'js/adapterService';
import cdm from 'soa/kernel/clientDataModel';
import notyService from 'js/NotyModule';
import _ from 'lodash';
import workflowAssinmentUtilSvc from 'js/Awp0WorkflowAssignmentUtils';

var exports = {};

/**
 * Checks if the object is checked out and returns true if it is a checked out and false otherwise.
 * @param {object} object - the object to check
 * @return {boolean} true if checked out false otherwise
 */
var isCheckedOut = function( object ) {
    var propCheckedOut = object.props.checked_out_user;
    return typeof propCheckedOut !== typeof undefined && propCheckedOut.dbValues && propCheckedOut.dbValues.length > 0 && propCheckedOut.dbValues[ 0 ] && propCheckedOut.dbValues[ 0 ] !== '';
};

/**
 * Checks if the object is applicable to show the submit to workflow command.
 * @param {object} object - Selected object
 * @param {object} data - The data of the context.
 * @return {boolean} true if checked out false otherwise
 */
var isSupported = function( object, data ) {
    var isSupported = true;
    var isSupportedStringValue = null;
    for( var idx in data.applicableTypes ) {
        if( data.applicableTypes[ idx ].key.typeName === object.type ) {
            isSupportedStringValue = data.applicableTypes[ idx ].value;
            break;
        }
    }
    if( isSupportedStringValue && String( isSupportedStringValue ).toLowerCase() === 'false' ) {
        isSupported = false;
    }
    return isSupported;
};

/**
 * This will set the register context depends on the selections.
 * @param {objectArray} selections - the selection
 *
 * @return {Array} Valid object array
 */
var setModelObject = function( selections ) {
    return adapterSvc.getAdaptedObjects( selections ).then( function( adaptedObjs ) {
        var catArrayJso = [];
        // Remove the duplicates if present in adaptedObjs list. Fix for defect # LCS-218095
        var finalAdaptedList = _.uniqWith( adaptedObjs, function( objA, objB ) {
            return objA.uid === objB.uid;
        } );
        catArrayJso.push( finalAdaptedList );
        var jso = {
            workFlowObjects: catArrayJso[ 0 ]
        };

        if( typeof selections !== typeof undefined && selections.length > 0 ) {
            appCtx.registerCtx( 'workflow_process_candidates', jso );
        } else {
            appCtx.unRegisterCtx( 'workflow_process_candidates' );
        }
        return catArrayJso[ 0 ];
    } );
};
/**
 * This will check for the case for warning message and open the panel based on the action.
 * @param {objectsArray} selections - selected object list.
 * @param {object} data - data of the context object.
 * @param {object} ctx - context object.
 * @param {Object} commandContext - the command context
 */
export let populateErrorMessage = function( selections, data, ctx, commandContext ) {
    var popUpMessage = '';
    var nonSubmittables = [];
    var finalMessage;

    // Check if selection is empty then open the panel for create process with no target and then
    // return from here
    if( !selections || selections.length <= 0 ) {
        _openSubmitWorkflowPanel( true, 'Awp0CreateWorkflowProcess', commandContext, [] );
        return;
    }

    if( !( ctx.activeToolsAndInfoCommand && ctx.activeToolsAndInfoCommand.commandId === 'Awp0NewWorkflowProcess' ) ) {
        selections.forEach( function( modelObject ) {
            var iModelObject = cdm.getObject( modelObject.uid );

            if( !isSupported( iModelObject, data ) ) {
                // Here in non submittable list i am adding modelObject instead iModelObject as modelObject
                // will be ViewModelObejct and iModelObject will be ModelObejct and when we set the valid selection
                // on context it will find out the difference correctly. So doing this difference
                nonSubmittables.push( modelObject );
                var nonApplicableObj = TypeDisplayNameService.instance.getDisplayName( iModelObject );
                popUpMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.objNotItemRevision, [ '{{nonApplicableObj}}' ], { nonApplicableObj: nonApplicableObj } ) ).concat( '</br>' );
            } else {
                if( isCheckedOut( iModelObject ) ) {
                    nonSubmittables.push( modelObject );
                    var checkedOutObject = TypeDisplayNameService.instance.getDisplayName( iModelObject );
                    popUpMessage = popUpMessage.concat( messagingService.applyMessageParams( data.i18n.checkedOutError, [ '{{checkedOutObject}}' ], { checkedOutObject: checkedOutObject } ) ).concat( '</br>' );
                }
            }
        } );
        if( popUpMessage.length > 0 ) {
            var cannotBeSubmiitedCount = selections.length - nonSubmittables.length;
            var totalSelectedObj = selections.length;

            var message = messagingService.applyMessageParams( data.i18n.someSubmittableObjects, [ '{{cannotBeSubmiitedCount}}', '{{totalSelectedObj}}' ], {
                cannotBeSubmiitedCount: cannotBeSubmiitedCount,
                totalSelectedObj: totalSelectedObj
            } );
            finalMessage = message.concat( '</br>' ).concat( popUpMessage );
        }

        if( nonSubmittables.length === 0 ) {
            setModelObject( selections ).then( function( selectedObjects ) {
                _openSubmitWorkflowPanel( true, 'Awp0NewWorkflowProcess', commandContext, selectedObjects );
            } );
        } else {
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: data.i18n.CancelText,
                onClick: function( $noty ) {
                    $noty.close();
                }
            },
            {
                addClass: 'btn btn-notify',
                text: data.i18n.Proceed,
                onClick: function( $noty ) {
                    $noty.close();
                    let targetObjects = _.difference( selections, nonSubmittables );
                    setModelObject( targetObjects ).then( function( selectedObjects ) {
                        _openSubmitWorkflowPanel( true, 'Awp0NewWorkflowProcess', commandContext, selectedObjects );
                    } );
                }
            }
            ];
            notyService.showWarning( finalMessage, buttons );
        }
    } else {
        _openSubmitWorkflowPanel( false, 'Awp0NewWorkflowProcess', commandContext, selections );
    }
};

/**
 * Open or close the popup panel.
 *
 * @param {boolean} isOpenCase True/False
 * @param {String} panelId Panel id to open
 * @param {Object} commandContext the command context
 * @param {Array} targetObjects Target object array
 * @param {Object} sourceObject Input object to bring up the panel
 */
var _openSubmitWorkflowPanel = function( isOpenCase, panelId, commandContext, targetObjects, sourceObject ) {
    var isNarrowMode = workflowAssinmentUtilSvc.isNarrowMode();
    var panelContext = {
        targetObjects : targetObjects
    };
    if( sourceObject ) {
        panelContext.sourceObject = sourceObject;
    }
    var panelWidth = 'WIDE';
    if( isNarrowMode ) {
        panelWidth = 'STANDARD';
    }
    const { dialogAction } = commandContext;
    if( dialogAction ) {
        if( isOpenCase ) {
            let options = {
                view: panelId,
                parent: '.aw-layout-workareaMain',
                placement: 'right',
                width: panelWidth,
                height: 'FULL',
                push: false,
                isCloseVisible: false,
                isPinUnpinEnabled: false,
                subPanelContext: { ...commandContext, ...panelContext }
            };
            dialogAction.show( options );
        } else {
            dialogAction.hide();
        }
    } else {
        // same call commandPanelService.activateCommandPanel for isOpenCase true or false
        commandPanelService.activateCommandPanel( panelId, 'aw_toolsAndInfo', panelContext, false, true,  { width: panelWidth } );
    }
};

/**
 * This function will get the input for the getTypeConstants SOA.
 * @param {objectArray} selections - the list of selections objects.
 * @param {object} data - The data object.
 *
 * @returns {Array} SOA input array
 */
export let getTheBOType = function( selections, data ) {
    var input = [];
    var constantName = 'Awp0WorkflowSubmittable';
    selections.forEach( function( selected ) {
        var keys = {
            constantName: constantName,
            typeName: selected.type

        };
        input.push( keys );
    } );
    return input;
};

/**
 * Based on selected obejct get all root target attachments and set it on context and bring
 * up the create sub process panel.
 *
 * @param {Object} selectedObject Selected object from UI for sub process need to be created
 * @param {Object} data data
 * @param {Object} ctx Context service
 * @param {Object} commandContext the command context
 */
export let openCreateSubProcessCommandPanel = function( selectedObject, data, ctx, commandContext ) {
    if( !selectedObject ) {
        return;
    }
    var rootTargetObjects = [];
    if( ( selectedObject.modelType.typeHierarchyArray.indexOf( 'EPMTask' ) > -1 || selectedObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) && selectedObject.props.root_target_attachments ) {
        _.forEach( selectedObject.props.root_target_attachments.dbValues, function( rootDBValue ) {
            var modelObject = cdm.getObject( rootDBValue );
            if( modelObject ) {
                rootTargetObjects.push( modelObject );
            }
        } );
    }
    setModelObject( rootTargetObjects ).then( function( selectedObjects ) {
        _openSubmitWorkflowPanel( true, 'Awp0CreateWorkflowSubProcess', commandContext, selectedObjects, selectedObject );
    } );
};

export default exports = {
    populateErrorMessage,
    getTheBOType,
    openCreateSubProcessCommandPanel
};
