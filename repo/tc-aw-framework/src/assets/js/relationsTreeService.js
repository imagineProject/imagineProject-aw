// Copyright (c) 2024 Siemens

/**
 * @module js/relationsTreeService
 */
import xrtUtilities from 'js/xrtUtilities';
import _ from 'lodash';
import Debug from 'debug';
const trace = new Debug( 'selection' );

export const handleSelectionChange = async( localSelectionData, parentSelectionData, parentSelection ) => {
    if ( !_.isEmpty( localSelectionData ) && parentSelectionData ) {
        const { selectedObjects, relationInfo } = await xrtUtilities.getAdaptedSelectionWithRelationInfo( localSelectionData, parentSelection );
        let newSelectionData = { ...localSelectionData };
        newSelectionData.selected = selectedObjects;
        newSelectionData.relationInfo = relationInfo;
        parentSelectionData.update( newSelectionData );
        trace( 'Relations Tree selectionData: ', newSelectionData );
    }
};

export const handleSelectionChangeForContainer = ( localSelectionData, parentSelectionData ) => {
    if ( !_.isEmpty( localSelectionData )  && parentSelectionData ) {
        let newSelectionData = { ...localSelectionData };
        newSelectionData.source = 'intermediary';
        parentSelectionData.update( newSelectionData );
        trace( 'Relations Tree Container selectionData: ', newSelectionData );
    }
};

export const handleFocusChange = ( focusComponent, selectionModel ) => {
    if ( focusComponent === 'intermediary' ) {
        selectionModel.setSelectionModelActivated( true );
    } else if ( selectionModel.getSelection().length > 0 ) {
        selectionModel.setSelectionModelActivated( false );
    }
};


export const handleSublocationFocusChange = ( isSublocationActive, selectionModel ) => {
    if ( isSublocationActive && selectionModel.getSelection().length > 0 ) {
        selectionModel.setSelectionModelActivated( true );
    } else if ( selectionModel.getSelection().length > 0 ) {
        selectionModel.setSelectionModelActivated( false );
    }
};

export const handleInputSelectionChange = ( selectionModel ) =>{
    selectionModel.selectNone();
};
