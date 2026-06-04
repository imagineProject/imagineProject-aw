// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/acePwaCommandBarService
 * @internal
 */
import PwaCommandBarViewModel from 'viewmodel/PwaCommandBarViewModel';
var exports = {};
export const acePwaCommandBarRenderFunction = ( props ) => {
    const {
        viewModel
    } = props;
    let { subPanelContext } = viewModel;

    if ( subPanelContext.occContext.pwaInitialized ) {
        return (
            <PwaCommandBarViewModel mselected={subPanelContext.occContext.pwaSelection} pselected={subPanelContext.baseSelection} subPanelContext={subPanelContext}>
            </PwaCommandBarViewModel>
        );
    }
};

export default exports = {
    acePwaCommandBarRenderFunction
};
