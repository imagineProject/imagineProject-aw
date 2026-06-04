// Copyright (c) 2024 Siemens

/**
 * @module js/personalizationToggleService
 */

import browserUtils from 'js/browserUtils';

export const togglePersonalization = toggleButtonStatus => {
    if( !toggleButtonStatus.dbValue ) {
        browserUtils.removeUrlAttribute( 'personalization' );
    }else{
        browserUtils.updateBrowserUrlAttribute( 'personalization', true );
    }

    return !toggleButtonStatus.dbValue;
};
