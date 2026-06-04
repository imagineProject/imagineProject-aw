// Copyright (c) 2024 Siemens

/**
 * @module js/relationsTreeToggleService
 */

import browserUtils from 'js/browserUtils';

export const toggleRelationsTree = toggleButtonStatus => {
    if( !toggleButtonStatus.dbValue ) {
        browserUtils.removeUrlAttribute( 'relationsTree' );
    }else{
        browserUtils.updateBrowserUrlAttribute( 'relationsTree', true );
    }

    return !toggleButtonStatus.dbValue;
};
