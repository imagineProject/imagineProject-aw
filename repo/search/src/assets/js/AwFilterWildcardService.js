// Copyright (c) 2025 Siemens

/**
 * This service is used for wilcard support in filter panel
 *
 * @module js/AwFilterWildcardService
 *
 */
import _ from 'lodash';

export let getWildcardList = function( operation, props, i18n ) {
    let wildcardOperators = props.wildcardOperators;
    let responseInput = [];
    _.forEach( wildcardOperators, function( wildcardOperator ) {
        let operatorEntry = {
            propDisplayValue: i18n[wildcardOperator.valueOf() + 'Operation'],
            propInternalValue: wildcardOperator,
            selected: false,
            category: props.categoryInternalName // Used to ensure correct category is updated on operator change
        };
        responseInput.push( operatorEntry );
    } );

    let operationValue = _.cloneDeep( operation );
    operationValue.dbValue = props.wildcardOperators[0];
    operationValue.uiValue = i18n[props.wildcardOperators[0].valueOf() + 'Operation'];
    props.updateWildcardOnMountCallBack( props.wildcardOperators[0] );
    return { response:responseInput, totalFound:responseInput.length, operation: operationValue };
};

export let wildcardSelectionChanged = function( props, eventData ) {
    if( props.currentWildcardSelection ) {
        // This event will be called for every expanded category, so we need to make sure the correct category is updated
        if( eventData && eventData.property && props.categoryInternalName === eventData.property.category ) {
            props.currentWildcardSelection( eventData.property.propInternalValue );
        }
    }
};

const AwFilterWildcardService = {
    getWildcardList,
    wildcardSelectionChanged
};

export default AwFilterWildcardService;
