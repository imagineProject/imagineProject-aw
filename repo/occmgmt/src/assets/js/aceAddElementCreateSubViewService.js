// Copyright (c) 2021 Siemens
// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
define
 */

/**
 * @module js/aceAddElementCreateSubViewService
 */
import AwWidget from 'viewmodel/AwWidgetViewModel';
import AwXrt from 'viewmodel/AwXrtViewModel';
import _ from 'lodash';
import { VisibleWhen } from 'js/hocCollection';
var exports = {};
const AwWidgetVisibleWhen = VisibleWhen( AwWidget );
const AwXrtVisibleWhen = VisibleWhen( AwXrt );

/**
 * @internal
 */

export const addElementCreateSubViewRenderFunction = ( props ) => {
    const {
        fields,
        addElementState,
        addPanelState,
        xrtState
    } = props;

    const xrtType = 'CREATE';
    const objectType = addElementState.occurrenceTypeName;

    var currentVal = addElementState.areNumberOfElementsInRange;
    var numberOfElementsValueInRange =  _.isUndefined( fields.numberOfElements.error );
    var hasValueChanged = currentVal !== numberOfElementsValueInRange;

    if( hasValueChanged ) {
        var newAddElementState = { ...addElementState.value };
        newAddElementState.areNumberOfElementsInRange = numberOfElementsValueInRange;
        addElementState.update( newAddElementState );
    }

    var isNewTabSelected = _.isEqual( addPanelState.value.selectedTab.view, 'NewTabPageSub' );
    var isAwb0ElementSelected = addPanelState.value.sourceObjects !== null && addPanelState.value.sourceObjects.length > 0 && addPanelState.value.sourceObjects[0].modelType && addPanelState.value.sourceObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1;
    var subPanelXrtApplicable = _.isEqual( isAwb0ElementSelected, false ) || isNewTabSelected;

    return (
        <div>
            <AwWidgetVisibleWhen visibleWhen={( objectType === 'PSOccurrence' )}{...fields.numberOfElements}></AwWidgetVisibleWhen>
            <AwXrtVisibleWhen visibleWhen={( subPanelXrtApplicable )} type={xrtType} objectType={objectType} xrtState={fields.xrtState}></AwXrtVisibleWhen>
        </div>
    );
};
export default exports = {
    addElementCreateSubViewRenderFunction
};
