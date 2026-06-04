// Copyright 2024 Siemens Product Lifecycle Management Software Inc.
/* global */
/**
 * @module js/AwSavedQueryCriteriaTableDefaultValueService
 */
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import AwDateTimeVal from 'viewmodel/AwDateTimeValViewModel';
import AwDoubleVal from 'viewmodel/AwDoubleValViewModel';
import AwTextboxVal from 'viewmodel/AwTextBoxValViewModel';
import AwIntegerVal from 'viewmodel/AwIntegerValViewModel';

var exports = {};
export const awSavedQueryCriteriaTableDefaultValueRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };

    const passedProps = { ...prop,  fielddata };

    if( props.vmo.propertyType === 1 ) {
        return (
            <AwTextboxVal {...passedProps}></AwTextboxVal>
        );
    }
    else if( props.vmo.propertyType === 2 ) {
        return (
            <AwDateTimeVal {...passedProps}></AwDateTimeVal>
        );
    }
    else if( props.vmo.propertyType === 3 ) {
        return (
            <AwDoubleVal {...passedProps}></AwDoubleVal>
        );
    }
    else if( props.vmo.propertyType === 5 ) {
        return (
            <AwIntegerVal {...passedProps}></AwIntegerVal>
        );
    }
    else if( props.vmo.propertyType === 6 ) {
        passedProps.fielddata.dataProvider = viewModel.dataProviders.booleanProvider;
        passedProps.fielddata.emptyLOVEntry = true;
        passedProps.fielddata.hasLov = true;
        return (
            <AwLovEdit {...passedProps}></AwLovEdit>
        );
    }
    else {
        return (
            <AwTextboxVal {...passedProps} ></AwTextboxVal>
        );
    }
};
exports = {
    awSavedQueryCriteriaTableDefaultValueRenderFunction
};
export default exports;

