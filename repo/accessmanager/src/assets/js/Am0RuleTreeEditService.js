// Copyright (c) 2022 Siemens

/**
 * @module js/Am0RuleTreeEditService
 */
import editHandlerService from 'js/editHandlerService';
import dataSourceService from 'js/dataSourceService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import editHandlerFactory from 'js/editHandlerFactory';
import eventBus from 'js/eventBus';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import localeSvc from 'js/localeService';

var saveHandler = {};

var editHandlerContextConstant = 'ACCESS_EDIT_CONTEXT';

var _localTextBundle = localeSvc.getLoadedText( 'AccessmgmtConstants' );
/**
 * execute the start edit command handler
 * create new dataSource with atomic data, acl table dataprovider && declViewModel
 * create new Edit handler with custom context
 * @param {*} declViewModel - View model data of TreeOverviewViewModel
 */
export let execute = function( declViewModel ) {
    var declViewModelNew = {
        ...declViewModel.data,
        ...declViewModel.atomicDataRef.namedAclState,
        ...declViewModel.atomicDataRef.xrtState
    };

    var editHandler = editHandlerFactory.createEditHandler( dataSourceService
        .createNewDataSource( {
            declViewModel: declViewModelNew
        } ) );

    // Add new method to identify editing context
    editHandler.getEditHandlerContext = function() {
        return editHandlerContextConstant;
    };

    if( editHandler ) {
        editHandlerService.setEditHandler( editHandler, editHandlerContextConstant );
        editHandlerService.setActiveEditHandlerContext( editHandlerContextConstant );
        editHandler.startEdit();
    }
};


/**
 * Get save handler.
 *
 * @return Save Handler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * This function is called when table cell is selected from tree.
 * Update AM node SWA View after edit leave confirmation.
 * This function is initializing atomic data xrtVMP properties with selected node props
 * @param {*} subPanelContext
 * @param {*} data
 */
export let bindProperties = function( subPanelContext, fields ) {
    var xrtState = { ...fields.xrtState };
    let newXrtState = { ...xrtState.getValue() };
    if( subPanelContext.selection.length === 0 ) {
        return;
    }
    newXrtState.xrtVMO = tcViewModelObjectSvc.createViewModelObjectById( subPanelContext.selection[0].uid );

    newXrtState.xrtVMO.props = { ...subPanelContext.selection[0].props };
    newXrtState.xrtVMO.props.rule_name = { ...subPanelContext.selection[0].props.rule_name };
    newXrtState.xrtVMO.props.rule_name.isRequired = true;
    newXrtState.xrtVMO.props.rule_name.emptyLOVEntry = false;

    newXrtState.xrtVMO.props.rule_arg_textbox = { ...subPanelContext.selection[0].props.rule_arg };
    newXrtState.xrtVMO.props.rule_arg_lov = { ...subPanelContext.selection[0].props.rule_arg };
    newXrtState.xrtVMO.props.rule_arg_lov_required = { ...subPanelContext.selection[0].props.rule_arg };
    newXrtState.xrtVMO.props.rule_arg_lov_required.isRequired = true;
    newXrtState.xrtVMO.props.rule_arg_lov_required.emptyLOVEntry = false;
    newXrtState.xrtVMO.props.rule_arg_lov.isSelectOnly = false;

    xrtState.update( newXrtState );
};

/**
 * This function is called when click on summary(edit) button
 * This function mark properties editable and update the xrtState
 * @param {*} fields
  */
export let setRulePropsEditable = function( fields ) {
    var xrtState = { ...fields.xrtState };
    let newXrtState = { ...xrtState.getValue() };

    newXrtState.xrtVMO.props.rule_name.isEditable = true;
    newXrtState.xrtVMO.props.rule_name.isEnabled = true;
    newXrtState.xrtVMO.props.rule_name.dataProvider = 'conditionProvider';
    newXrtState.xrtVMO.props.rule_name.hasLov = true;

    newXrtState.xrtVMO.props.rule_arg_textbox.isEditable = true;
    newXrtState.xrtVMO.props.rule_arg_textbox.isEnabled = true;
    newXrtState.xrtVMO.props.rule_arg_textbox.renderingHint = 'textbox';
    newXrtState.xrtVMO.props.rule_arg_textbox.maxLength = 128;

    newXrtState.xrtVMO.props.rule_arg_lov.isEditable = true;
    newXrtState.xrtVMO.props.rule_arg_lov.isEnabled = true;
    newXrtState.xrtVMO.props.rule_arg_lov.dataProvider = 'dataProviderConditionArgs';
    newXrtState.xrtVMO.props.rule_arg_lov.hasLov = true;

    newXrtState.xrtVMO.props.rule_arg_lov_required.isEditable = true;
    newXrtState.xrtVMO.props.rule_arg_lov_required.isEnabled = true;
    newXrtState.xrtVMO.props.rule_arg_lov_required.dataProvider = 'dataProviderConditionArgs';
    newXrtState.xrtVMO.props.rule_arg_lov_required.hasLov = true;

    xrtState.update( newXrtState );
};

/**
 * This function is called when click on Cancel Edits
 * This function get edit handler of custom context and process Cancel Edit
 */
export let cancelEdits = function() {
    var editHandler = editHandlerService.getActiveEditHandler( editHandlerContextConstant );
    if( editHandler ) {
        editHandler.cancelEdits();
    }
};

/**
 * Save edits for Access Manager
 */
saveHandler.saveEdits = function( dataSource ) {
    var deferred = AwPromiseService.instance.defer();
    var modifiedVMO = dataSource.getAllModifiedPropertiesWithVMO();
    var declData = dataSource.getDeclViewModel();

    var aclEntriesState = declData.eventData.scope.data.atomicDataRef.namedAclState.getAtomicData();
    var xrtState = declData.eventData.scope.data.atomicDataRef.xrtState.getAtomicData();
    var selection = declData.eventData.scope.commandContext.selection[0];
    var isAMPropertiesChanged = false;
    var namedAcl = {};
    if( aclEntriesState.updatedAclEntries.length > 0 || aclEntriesState.updatedAttrEntries.length > 0 ) {
        namedAcl = {
            acl:{
                type:'AM_ACL',
                uid:aclEntriesState.updatedAcl.dbValue
            },
            aceInfo:aclEntriesState.updatedAclEntries,
            attrAceInfo:aclEntriesState.updatedAttrEntries
        };
        isAMPropertiesChanged = true;
    }

    var SOAInputs = [];
    var input = [];

    var ruleInfo = {};
    ruleInfo.amRule = {
        type: selection.type,
        uid: selection.uid
    };
    ruleInfo.stringProps = {};
    ruleInfo.refProps = {};
    ruleInfo.clientId = 'AM';
    var pwaContextVMO = xrtState.xrtVMO;
    for( var i = 0; i < modifiedVMO.length; i++ ) {
        if( modifiedVMO[ i ].viewModelObject.type === 'AM_tree' ) {
            var props = modifiedVMO[ i ].viewModelProps;
            for( var mP = 0; mP < props.length; mP++ ) {
                if( props[ mP ].propertyName === 'rule_name' ) {
                    ruleInfo.stringProps.rule_name = props[ mP ].dbValue;
                    ruleInfo.stringProps.rule_arg = '';
                    isAMPropertiesChanged = true;
                }
                if( props[ mP ].propertyName === 'rule_arg' ) {
                    ruleInfo.stringProps.rule_arg = props[ mP ].dbValue;
                    pwaContextVMO.props.rule_arg = props[ mP ];
                    isAMPropertiesChanged = true;
                }
            }
        }
    }
    //If only acl is updated in the AM summary page.
    if( aclEntriesState.updatedAcl.dbValue !== xrtState.xrtVMO.props.acl.dbValue ) {
        ruleInfo.refProps.acl = {
            type: 'AM_ACL',
            uid: aclEntriesState.updatedAcl.dbValue
        };
        isAMPropertiesChanged = true;
    }
    input = {
        ruleInfo: ruleInfo,
        aclInfo: namedAcl
    };

    SOAInputs.push( {
        input: input
    } );

    if( isAMPropertiesChanged ) {
        soaSvc.postUnchecked( 'Internal-AccessManager-2022-12-AwAccessManager', 'updateAMRuleAndACL2',
            SOAInputs[0] ).then( function( response ) {
            var resource = 'AccessmgmtConstants';
            var localeTextBundle = localeSvc.getLoadedText( resource );
            var xrtStateProps = xrtState.xrtVMO.props;
            var ruleName = xrtStateProps.rule_name.dbValue && xrtStateProps.rule_arg.dbValue !== '' ? xrtStateProps.rule_name.uiValue + ' - ' + xrtStateProps.rule_arg.uiValue : xrtStateProps.rule_name.uiValue;
            if( ruleInfo.stringProps && ruleInfo.stringProps.rule_name && ruleInfo.stringProps.rule_arg === '' ) {
                ruleName = ruleInfo.stringProps.rule_name;
            }
            var errMessage = localeTextBundle.saveEditsErrorMessage.replace( '{0}', ruleName );
            // Check if input response is not null and contains partial errors then only
            // create the error object
            if( response && response.partialErrors ) {
                _.forEach( response.partialErrors, function( partErr ) {
                    if( partErr.errorValues ) {
                        // TO avoid display of duplicate messages returned in server response
                        var messages = _.uniqBy( partErr.errorValues, 'code' );
                        _.forEach( messages, function( errVal ) {
                            if( errMessage.length === 0 ) {
                                errMessage += '</br>' + errVal.message;
                            } else {
                                errMessage += ' ' + errVal.message + '</br>';
                            }
                        } );
                        messagingService.showError( errMessage );
                        deferred.reject( null );
                    }
                } );
            }


            pwaContextVMO.props.acl = aclEntriesState.updatedAcl;//.dbValue ? { ...aclEntriesState.updatedAcl } : modifiedVMO.props.acl;
            if( response.updated ) {
                eventBus.publish( 'treeOverview.updateSelectionData', pwaContextVMO );
                eventBus.publish( 'updateisAMTreeDirtyFlagEvent', { isAMTreeDirty : true } );
            }
            deferred.resolve( response.updated );
        }, function( error ) {
            if( error ) {
                messagingService.showError( error.message );
            }
            error = null;
            deferred.reject( error );
        } );
    }

    return deferred.promise;
};

/**
 * When changes are unsaved then it return true
 * @param {Object} dataSource dataSource.
 * @return {Boolean} any changes present then true, otherwise false
 */
saveHandler.isDirty = function( dataSource ) {
    var modifiedPropCount = dataSource.getAllModifiedProperties().length;
    var data = dataSource.getDeclViewModel();
    var deferred = AwPromiseService.instance.defer();
    var namedACL = data.eventData.scope.data.atomicDataRef.namedAclState.getAtomicData();
    var xrtState = data.eventData.scope.data.atomicDataRef.xrtState.getAtomicData();

    var modifiedVMO = dataSource.getAllModifiedPropertiesWithVMO();
    var errMessage = '';


    for( var i = 0; i < modifiedVMO.length; i++ ) {
        // validation for AM overview properties like Condition and Value
        if( modifiedVMO[ i ].viewModelObject.type === 'AM_tree' ) {
            var selectedCondition = '';
            var props = modifiedVMO[ i ].viewModelProps;
            for( var mP = 0; mP < props.length; mP++ ) {
                // if user selected empty Condition
                if( props[ mP ].propertyName === 'rule_name' ) {
                    selectedCondition = props[ mP ].dbValue;
                    if( props[ mP ].dbValue === '' ) {
                        errMessage = _localTextBundle.conditionValidationMsg;
                    }
                }else{
                    selectedCondition = xrtState.xrtVMO.props.rule_name.dbValue;
                }
                // if user selected empty Rule Value
                if( props[ mP ].propertyName === 'rule_arg' && props[ mP ].dbValue === '' && ( selectedCondition === 'Has Class' || selectedCondition === 'Has Application' ) ) {
                    var message = _localTextBundle.valueValidationMsg;
                    errMessage += errMessage ? '\n' + message : message;
                }
            }
        }
    }

    if( namedACL.errMessage ) {
        errMessage += namedACL.errMessage;
    }
    if( errMessage ) {
        messagingService.showError( errMessage );
        deferred.reject( false );
        return deferred.promise;
    }

    //condition1 - This checks if there are any modified props in table rows/html props.
    return modifiedPropCount > 0 || namedACL && namedACL.updatedAclEntries.length > 0 || namedACL.updatedAttrEntries.length > 0 || namedACL.updatedAcl.dbValue !== xrtState.xrtVMO.props.acl.dbValue;
};

/**
 * Initialize sublocationState with isValidTosave to true
 * @param {*} subPanelContext subPanelContext
 */
export let initializeIsValidTosave = function( subPanelContext ) {
    let state = { ...subPanelContext.context.pageContext.sublocationState.value };
    state.isValidTosave = true;
    subPanelContext.context.pageContext.sublocationState.update( { ...state } );
};

/**
  * this function is called on change for rule name and rule value which is used to update sublocationState varible isValidTosave for disabling save button
  * @param {Object} rule_arg_lov_required dbValue for changed rule value
  * @param {Object} sublocationState sublocationState
  */
export let updateIsValidToSave = function( isRuleValueLovRequired, rule_arg_lov_required, sublocationState ) {
    let state = { ...sublocationState.value };
    if( isRuleValueLovRequired && rule_arg_lov_required.dbValue  === '' ) {
        state.isValidTosave = false;
        sublocationState.update( { ...state } );
    }else{
        state.isValidTosave = true;
        sublocationState.update( { ...state } );
    }
};
const exports = {
    execute,
    getSaveHandler,
    setRulePropsEditable,
    bindProperties,
    cancelEdits,
    initializeIsValidTosave,
    updateIsValidToSave
};
export default exports;

