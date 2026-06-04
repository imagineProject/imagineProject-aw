// Copyright (c) 2022 Siemens

/**
 * Helper service for Enumerated Features
 *
 * @module js/pca0EnumeratedFeatureService
 */
import commonUtils from 'js/pca0CommonUtils';
import _ from 'lodash';

var exports = {};

/**
  * Get display name for enumerated feature and ranges
  * @param {string} displayNameFromServer Display Name from Server
  * @param {string[]} ids array of cfg0DisplayIds
  * @param {string[]} displayNames array of cfg0DisplayNames
  * @returns {string} featureDisplayName To disply on UI 
  */
export let getDisplayNamesForEnumeratedFeature = function( displayNameFromServer, ids, displayNames ) {
    let featureDisplayName = '';
    if ( displayNameFromServer.includes( ',' ) || _.isUndefined( ids ) || _.isUndefined( displayNames ) || _.isEmpty( ids ) || _.isEmpty( displayNames ) ) {
        /**
          * Retun displayNameFromServer if it contains , as its combination of id and description
          * We only convert those having ids only
          */
        return displayNameFromServer;
    }
    const result = displayNameFromServer.split( ' ' );
    let actualFromDisplayName = '';
    let actualToDisplayName = '';
    /**
      * Following code helps to get display name with respective to ids
      * ids = [ 1, 2, 3]
      * displayNames = [ 'One', 'Two', 'Three']
      * e.g. >= 1 & < 3
      * output : >= One & < Three
      */
    if( result.length > 1 ) {
        /**
          * Range e.g >= 1 & < 3
          */
        const fromOp = result[ 0 ];
        const fromValue = result[ 1 ];
        const toOp = result[ 3 ];
        const toValue = result[ 4 ];
        if ( ids.indexOf( fromValue ) > -1 ) {
            actualFromDisplayName = displayNames[ids.indexOf( fromValue )];
        } else {
            actualFromDisplayName = fromValue;
        }

        if ( ids.indexOf( toValue ) > -1 ) {
            actualToDisplayName = displayNames[ids.indexOf( toValue )];
        } else {
            actualToDisplayName = toValue;
        }

        const fromValueStr = commonUtils.isUTCFormatString( actualFromDisplayName ) ?
            commonUtils.getFormattedDateFromUTC( fromValue ) : actualFromDisplayName;

        featureDisplayName = fromOp + ' ' + fromValueStr;
        if( result[ 3 ] && result[ 4 ] ) {
            const toValueStr = commonUtils.isUTCFormatString( actualToDisplayName ) ?
                commonUtils.getFormattedDateFromUTC( actualToDisplayName ) : actualToDisplayName;
            featureDisplayName += ' & ' + toOp + ' ' + toValueStr;
        }
    } else {
        /**
          * No Range only displayName
          * e.g one
          */
        let actualFromDisplayName = displayNameFromServer;
        if( ids.indexOf( displayNameFromServer ) > -1 ) {
            actualFromDisplayName = displayNames[ids.indexOf( displayNameFromServer )];
        }

        featureDisplayName = commonUtils.isUTCFormatString( actualFromDisplayName ) ?
            commonUtils.getFormattedDateFromUTC( actualFromDisplayName ) : actualFromDisplayName;
    }
    return featureDisplayName;
};

/**
  *  Get server name for enumerated feature and ranges
  * @param {string} uiValue Display Name from UI
  * @param {string[]} ids array of cfg0DisplayIds
  * @param {string[]} displayNames array of cfg0DisplayNames
  * @param {string} familyType represents type of family
  * @returns {string} featureNameRequriedForServer to store value on server 
  */
export let getServerNamesForEnumeratedFeature = function( uiValue, ids, displayNames, familyType ) {
    let featureNameRequriedForServer = uiValue;
    if ( _.isUndefined( ids ) || _.isUndefined( displayNames ) || _.isEmpty( ids ) || _.isEmpty( displayNames ) ) {
        return uiValue;
    }
    const displayValues = uiValue.split( /\s*(>=|<=|>|<|=|&)\s*/ );
    let actualFirstValue = '';
    let actualSecondValue = '';
    /**
      * Replace string with specifiend position with respective to id as server knows ids only
      * if ui range is ">= 0ne & < Three"
      * then output is >= 1 & < 3
      * displayValues[2] = One
      * displayValues[6] = Three
      * ids = [ 1, 2, 3]
      * display = [ 'One', 'Two', 'Three']
      */
    if ( displayValues[2] ) {
        if ( displayNames.indexOf( displayValues[2] ) > -1 ) {
            actualFirstValue = ids[displayNames.indexOf( displayValues[2] )];
        } else if( ids.indexOf( displayValues[2] ) > -1 ) {
            actualFirstValue = displayValues[2];
        } else if ( familyType === 'Date' ) {
            // consider its date which is converted from dd-mm-yyyy to UTC
            actualFirstValue = commonUtils.getFormattedDateString( new Date( displayValues[2] ) );
        } else {
            actualFirstValue = displayValues[2];
        }
        featureNameRequriedForServer = featureNameRequriedForServer.replace( displayValues[2], actualFirstValue );
    }
    if ( displayValues[6] ) {
        if ( displayNames.indexOf( displayValues[6] ) > -1 ) {
            actualSecondValue = ids[displayNames.indexOf( displayValues[6] )];
        } else if( ids.indexOf( displayValues[6] ) > -1 ) {
            actualSecondValue = displayValues[6];
        } else if( familyType === 'Date' ) {
            // consider its date which is converted from dd-mm-yyyy to UTC
            actualSecondValue = commonUtils.getFormattedDateString( new Date( displayValues[6] ) );
        } else {
            actualSecondValue = displayValues[6];
        }
        featureNameRequriedForServer = featureNameRequriedForServer.replace( displayValues[6], actualSecondValue );
    }
    return featureNameRequriedForServer;
};

export default exports = {
    getDisplayNamesForEnumeratedFeature,
    getServerNamesForEnumeratedFeature
};
