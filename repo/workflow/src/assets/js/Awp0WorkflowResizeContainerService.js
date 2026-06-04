import { computeModeFromWidth } from 'js/componentUtils';
import AwInclude from 'viewmodel/AwIncludeViewModel';

var exports = {};

export const renderFunction = ( prop ) => {
    const context = {
        subPanelContext: {
            ...prop.viewModel.subPanelContext,
            ...{ sidenavMode: prop.viewModel.data?.config?.mode || computeModeFromWidth( window.innerWidth ) }
        }
    };
    return <AwInclude name={prop.viewId} {...context}></AwInclude>;
};

export const handleResizeEvent = ( data, dispatch ) => {
    let dataToUpdate = { ...data.config };
    dataToUpdate.mode = computeModeFromWidth( window.innerWidth );
    dispatch( {
        path: 'data.config',
        value: dataToUpdate
    } );
};

export default exports = {
    renderFunction,
    handleResizeEvent
};
