// Copyright (c) 2022 Siemens

/**
 * @module js/manageGroupTaskShowObjectService
 */

import _ from 'lodash';
import { AwServerVisibilityPopupCommandBar } from 'js/AwServerVisibilityCommandBarService';
import AwPopup2 from 'viewmodel/AwPopup2ViewModel';

var exports = {};

export const manageGroupForTaskRenderFunction = ( props ) => {
    const {
        viewModel
    } = props;

    let { subPanelContext } = viewModel;
    let { assignAllConditionVerdict } = viewModel;
    let { context } = subPanelContext;

    if( context && subPanelContext ) {
        context.popupApi = subPanelContext.popupApi;
        context.popupOptions = subPanelContext.popupOptions;
        context.assignAllConditionVerdict = assignAllConditionVerdict === 'true';
    }
    const anchorValue = 'Awp0ManageGroup';

    return (
        <div className='aw-layout-popup'>
            <AwPopup2>
                <AwServerVisibilityPopupCommandBar
                    childCommandClickCallback = {props.childCommandClickCallback}
                    anchor={anchorValue}
                    context={context}>
                </AwServerVisibilityPopupCommandBar>
            </AwPopup2>
        </div>
    );
};

export default exports = {
    manageGroupForTaskRenderFunction
};
