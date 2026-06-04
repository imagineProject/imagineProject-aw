// Copyright (c) 2022 Siemens

/**
 * @module js/Am0AddRuleCommandService
 */

import uwPropertySvc from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';

const Has_Class = 'Has Class';
const Has_Application = 'Has Application';

/**
 * This function creates List model Object from array of strings
 * @param {*} response - getAMConditionNames soa output
 * @returns ListModelObjects for condition
 */
export let getConditionNames = function( response ) {
    return listBoxService.createListModelObjectsFromStrings( response.conditionNames );
};

/**
 * This function creates List model Object from array of strings
 * @param {*} response - getAMConditionArgs soa output
 * @returns ListModelObjects for ruleValue
 */
export let getConditionArgs = function( response ) {
    var conditionArgs = [];
    if( response.conditionArgs && response.conditionArgs.length > 0 ) {
        conditionArgs = listBoxService.createListModelObjectsFromStrings( response.conditionArgs );
    }
    return conditionArgs;
};

/**
 * This function creates List model Object and after that setting uid as propInternalValue for objectAclName
 * @param {*} response
 * @returns listModelObject for objectAclName
 */
export let loadObjectACLNames = function( response ) {
    var aclList = listBoxService.createListModelObjects( response.acls, 'aclName' );
    for( var i = 0; i < aclList.length; i++ ) {
        aclList[ i ].propInternalValue = response.acls[ i ].acl.uid;
    }
    return aclList;
};

/**
 * Soa input needs empty string if search string is null
 * This function checks if search string in empty in lov then it returns empty string otherwise return typed search string
 * @param {*} searchStr
 * @returns
 */
export let getSearchString = function( searchStr ) {
    var filterString = '';
    if ( searchStr !== null && searchStr !== undefined ) {
        filterString = searchStr;
    }
    return filterString;
};

/**
 * Reset ruleValue in Add Rule panel.
 * This function should invoke before setSelectedCondition function to get prev_rule_name
 * @return {Object} ViewModelProperty for ruleValue.
 */
export let resetRuleValue = function( response, i18n, rule_name, prev_rule_name, ruleValue ) {
    if( rule_name !== prev_rule_name ) {
        var ruleValueVmProp = uwPropertySvc.createViewModelProperty( 'rule_arg', i18n.value, 'STRING', '', '' );
        ruleValueVmProp.isEditable = true;
        // Rule value is required if condition is 'Has Class' or 'Has Application'
        ruleValueVmProp.isRequired = getRuleValueLovRequired(  rule_name );
        /*
        scenario- when we get value arg empty from soa on selection of condition field.
        in that case value field is textbox which is Max - 128 char allowed
        */
        if( !response.conditionArgs && response.totalFound === 0 ) {
            uwPropertySvc.setHasLov( ruleValueVmProp, false );
            uwPropertySvc.setRenderingHint( ruleValueVmProp, 'textbox' );
            ruleValueVmProp.maxLength = 128;
        } else {
            uwPropertySvc.setHasLov( ruleValueVmProp, true );
            ruleValueVmProp.dataProvider = 'dataProviderConditionArgs';
            // Rule value should not be typable for condition 'Has Class' and 'Has Application'
            ruleValueVmProp.isSelectOnly = getRuleValueLovRequired( rule_name );
        }

        return ruleValueVmProp;
    }
    return ruleValue;
};

/**
 * Reset boolean true if condition is 'Has Class' or 'Has Application'.
 * @param {String} rule_name - Condition
 * @return {Boolean} .
 */
export let getRuleValueLovRequired = function( rule_name ) {
    if( rule_name === Has_Class || rule_name === Has_Application ) {
        return true;
    }
    return false;
};

/**
 * This method is called when condition is changed in edit mode.
 * This method sets an empty value for rule argument.
 * @param {*} fields
*/
export let clearArgValue = function( fields ) {
    var xrtState = { ...fields.xrtState };
    let newXrtState = { ...fields.xrtState.getValue() };

    newXrtState.xrtVMO.props.rule_arg_textbox.dbValue = '';
    newXrtState.xrtVMO.props.rule_arg_textbox.uiValue = '';

    newXrtState.xrtVMO.props.rule_arg_lov.dbValue = '';
    newXrtState.xrtVMO.props.rule_arg_lov.uiValue = '';
    newXrtState.xrtVMO.props.rule_arg_lov.dbOriginalValue = '';
    //There was issue when the rule arg field is reset on condition change & we select same value again for rule arg lov.
    //dbOriginalValue is need to set to fix the lov issue.

    newXrtState.xrtVMO.props.rule_arg_lov_required.dbValue = '';
    newXrtState.xrtVMO.props.rule_arg_lov_required.uiValue = '';
    newXrtState.xrtVMO.props.rule_arg_lov_required.dbOriginalValue = '';

    xrtState.update( newXrtState );
};

/**
 * This is setting selectedCondition variable which is used to restrict calling soa if same condition name is selected from lov
 * @param {*} condition
 * @returns dbValue
 */
export let setSelectedCondition = function( response, condition ) {
    return condition.dbValue;
};

/**
 * This function is used to check if rule arg field is textbox/lov
 * This function should invoke before setSelectedCondition function to get prev_rule_name
 * @param {Object} response
 * @param {*} rule_name
 * @param {*} prevselectedCondition
 * @returns
 */
export let isRuleArgLov = function( response, xrtVMO ) {
    // function is invoked when the condition change , value lov is filtered or value lov is changed
    // On rule_name/condition change - respones.totalFound will decide whether the lov widget needs to be rendered or textbox widget.
    var filterString = getRuleArgSearchString( xrtVMO.props.rule_name.dbValue, xrtVMO.props.rule_arg_lov.filterString, xrtVMO.props.rule_arg_lov_required.filterString );
    if( !filterString ) {
        if( response.totalFound > 0 ) {
            return true;
        }
        return false;
    }
    // On rule_arg/value changed or filtered - the function should always return true since it is lov.
    // rule_arg_textbox - this function will not be invoked
    // rule_arg_lov - return true;
    // rule_arg_lov_required -return true;

    return true;
};

/**
 * This function is used to get filtered string of rule arg
 * This function decide which filter string (rule_arg_lov / rule_arg_log_required) should pass to getAMConditionArgs SOA
 * @param {*} rule_name
 * @param {*} ruleArgStr
 * @param {*} ruleArgRequiredStr
 * @returns
 */
export let getRuleArgSearchString = function( rule_name, ruleArgStr, ruleArgRequiredStr ) {
    //ruleArgStr - lov filter string of rule_arg_lov field
    //ruleArgRequiredStr - lov filter string of rule_arg_lov_required field
    var isRuleArgRequired = getRuleValueLovRequired( rule_name );
    if( isRuleArgRequired ) {
        return getSearchString( ruleArgRequiredStr );
    }
    return getSearchString( ruleArgStr );
};

const exports = {
    getConditionNames,
    getConditionArgs,
    loadObjectACLNames,
    getSearchString,
    resetRuleValue,
    setSelectedCondition,
    clearArgValue,
    getRuleValueLovRequired,
    isRuleArgLov,
    getRuleArgSearchString
};
export default exports;
