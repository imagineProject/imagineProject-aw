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
 * @module js/aceExpandOptionsService
 * @internal
 */
import _ from 'lodash';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import { AwServerVisibilityPopupCommandBar } from 'js/AwServerVisibilityCommandBarService';
import AwPopup2 from 'viewmodel/AwPopup2ViewModel';

var exports = {};

export const awb0ExpandOptionsRenderFunction = ( props ) => {
    const {
        viewModel,
        actions,
        fields
    } = props;

    let { subPanelContext } = viewModel;
    const anchorValue = 'Awb0ExpandGroup';
    const keyPressed = function( event, actions ) {
        if( event.key === 'Enter' ) {
            event.preventDefault();
            actions.performExpandToLevel();
        }
    };

    return (
        <div className='aw-occmgmt-expand-popup'>
            <AwPopup2>
                <AwServerVisibilityPopupCommandBar
                    anchor={anchorValue}
                    context={subPanelContext.context}
                    mselected={subPanelContext.context.occContext.pwaSelection}
                    pselected={subPanelContext.context.baseSelection}>
                </AwServerVisibilityPopupCommandBar>
                <AwWidget className='aw-occmgmt-expandToLevelInput' onKeyDown={( event ) => keyPressed( event, actions )} {...fields.expansionLevel}></AwWidget>
            </AwPopup2>
        </div>
    );
};

export const initializeExpandOptionsInfo = ( props, expandNLevel ) => {
    const occContext = props.subPanelContext.context.occContext;
    const pwaSelection = occContext.pwaSelection;
    var isSingleObjectWithChildrenSelected = pwaSelection.length === 1 && pwaSelection[ 0 ].props.awb0NumberOfChildren && pwaSelection[ 0 ].props.awb0NumberOfChildren.dbValues > 0;
    var isExpandBelowSupported = occContext.supportedFeatures.Awb0ExpandBelowFeature === true;

    expandNLevel.isEnabled = isSingleObjectWithChildrenSelected && isExpandBelowSupported;
    return _.cloneDeep( expandNLevel );
};

export default exports = {
    initializeExpandOptionsInfo,
    awb0ExpandOptionsRenderFunction
};
