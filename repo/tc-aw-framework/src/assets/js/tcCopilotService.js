// Copyright (c) 2023 Siemens

/**
 * @module js/tcCopilotService
 */

export const changeChatBoxVisibility = async( selectedKBCount, selectedListValue ) => {
    if ( selectedListValue?.value === 'TeamcenterDocs' && selectedKBCount !== undefined ) {
        return selectedKBCount >= 1 || selectedKBCount === '';
    }
    return true;
};
