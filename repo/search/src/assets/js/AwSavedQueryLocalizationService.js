
// Copyright 2024 Siemens Product Lifecycle Management Software Inc.
/* global */

/**
 *
 * @module js/AwSavedQueryLocalizationService
 */

import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';

export let convertGetDisplayStringsResponseToLovEntries = function( response, keyText ) {
    let loacalizationKeyPairs = response.output;
    return loacalizationKeyPairs.map( localizationKeyPair => {
        let entryDescrption = keyText.replace( '{0}', localizationKeyPair.key );
        return {
            propDisplayValue: localizationKeyPair.value,
            propInternalValue: localizationKeyPair.key,
            propDisplayDescription: entryDescrption,
            i18nKey: localizationKeyPair.key
        };
    } );
};

export let getPageOfLocalizationData = ( localizationKeyList, startIndex, pageSize, filterString ) => {
    let endIndex = startIndex + pageSize;

    if( !filterString ) {
        return {
            lovData: localizationKeyList.slice( startIndex, endIndex ),
            totalFound: localizationKeyList.length
        };
    }

    let filteredList = [];
    localizationKeyList.forEach( localizationKey => {
        if( localizationKey.propDisplayValue.toLowerCase().includes( filterString.toLowerCase() ) || localizationKey.i18nKey.toLowerCase().includes( filterString.toLowerCase() ) ) {
            filteredList.push( localizationKey );
        }
    } );

    return {
        lovData: filteredList.slice( startIndex, endIndex ),
        totalFound: filteredList.length
    };
};

export let setUserEntryKey = ( selectedLocalization, vmo ) => {
    let vmoUserEntryKeyProp = vmo.props.UserEntryKey;
    uwPropertyService.setValue( vmoUserEntryKeyProp, selectedLocalization[ 0 ].i18nKey );
    uwPropertyService.setDisplayValue( vmoUserEntryKeyProp, [ selectedLocalization[ 0 ].i18nKey ] );
};

export let updateKeyNamePair = () => {
    eventBus.publish( 'Awp0SavedQueryCriteriaTable.userEntryKeyCellUpdate' );
};

const AwSavedQueryLocalizationService = {
    convertGetDisplayStringsResponseToLovEntries,
    getPageOfLocalizationData,
    setUserEntryKey,
    updateKeyNamePair
};

export default AwSavedQueryLocalizationService;
