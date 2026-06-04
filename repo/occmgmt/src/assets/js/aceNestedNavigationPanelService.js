// Copyright (c) 2022 Siemens

/**
 * @module js/aceNestedNavigationPanelService
 */
export let navigateToView = ( nestedNavigationState, view )=>{
    let newState = { ...nestedNavigationState.getValue() };
    newState.views = [ ...newState.views, view ];
    nestedNavigationState.update( newState );
};

export let goToPrevPanel = ( nestedNavigationState, numOfBacks, eventData )=>{
    let eventDataValue = '';
    if( eventData ) {
        eventDataValue = eventData;
    }
    numOfBacks = numOfBacks || 1;
    let newState = { ...nestedNavigationState.getValue() };
    let numOfViews = newState.views.length;
    let backInfo;
    if(  numOfViews > 0 ) {
        backInfo = newState.views[numOfViews - numOfBacks].panelId;
        newState.views = newState.views.slice( 0, numOfViews - numOfBacks );
        nestedNavigationState.update( newState );
    }
    return {
        backInfo: backInfo,
        eventDataValue: eventDataValue
    };
};


export let updateSubPanelContextOfView = ( nestedNavigationState, key, value )=>{
    let newState = { ...nestedNavigationState.getValue(), [key]: value };
    nestedNavigationState.update( newState );
};

export let updateTitleOfView = ( nestedNavigationState, panelId, value )=>{
    let currentViews = { ...nestedNavigationState.getValue() };
    let item = currentViews.views.filter( i=>i.panelId === panelId )[0];
    if( item ) {
        item.title = value;
        nestedNavigationState.update( currentViews );
    }
};

export let clearEventData = ( ) => {
    return '';
};

export default {
    navigateToView,
    goToPrevPanel,
    updateSubPanelContextOfView,
    updateTitleOfView,
    clearEventData
};

