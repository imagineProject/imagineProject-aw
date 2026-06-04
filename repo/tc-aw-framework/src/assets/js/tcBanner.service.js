import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import { showBanner } from 'js/AwBannerLifeCycleService';
import clientDataModel from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import Debug from 'debug';
const trace = new Debug( 'Banner' );

let exports = {};
let currentLocale;
let userDetails;

//regEx for 'YYYY-MM-DD HH:MM UTC'
const regExForUTC = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/;
//regEx for 'YYYY-MM-DD HH:MM'
const regExDate = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;


const parseDate = function( dateString ) {
    if( dateString.match( regExForUTC ) ) {
        // given date string of format 'YYYY-MM-DD HH:MM UTC'
        let parts = dateString.split( /[\s-:TZ]/ );
        // JavaScript months are zero-indexed, so subtract 1
        let date = new Date( Date.UTC( parts[0], parts[1] - 1, parts[2], parts[3], parts[4] ) );
        return Number( date.getTime() );
    }
    // given date string of format 'YYYY-MM-DD HH:MM'
    return Number( new Date( dateString ).getTime() );
};

/**
 * Extracts localized texts from raw banner data.
 *
 * @param {Array} rawBanners - An array of banner data strings. Each string is expected to be in the format 'key:value'.
 *                             Keys starting with 'text_' are considered localized texts.By default text is english
 *
 * @returns {Object} An object mapping language initials to localized texts. The keys are language initials extracted from the 'text_' keys in the raw banner data.
 *                   The values are the corresponding localized texts.
 */
const extractLocaleTexts = function( rawBanners ) {
    let localizedTexts = {};
    rawBanners.map( ( banner ) => {
        let splitbanner = banner.split( ':' );
        if ( splitbanner[0].includes( 'text_' ) ) {
            let languageInitials = splitbanner[0].split( 'text_' );
            localizedTexts[languageInitials[1]] = splitbanner[1];
        }
    } );
    return localizedTexts;
};

/**
 * Checks if a given date string is in the format 'YYYY-MM-DD HH:MM'.
 *
 * @param {string} date - The date string to validate. The string should be in the format 'key:YYYY-MM-DD HH:MM'.
 * @returns {boolean} Returns true if the date string is in the correct format, and false otherwise.
 */
const isValidDate = function( date ) {
    return date.match( regExForUTC ) !== null || date.match( regExDate ) !== null;
};

/**
 * Validates an array of raw banner data.
 *
 * @param {Array} rawBanners - An array of strings, where each string is in the format "key:value".
 * @returns {Object} An object containing any validation error messages. If no errors were found, the object will be empty.
 */
const validateRawBanner = function( rawBanners ) {
    let bannerError = {};
    rawBanners.forEach( item => {
        let splitItem = item.split( ':' );
        let key = splitItem[0];
        let value = splitItem.slice( 1 ).join( ':' );
        if ( key === null || key === undefined || key === '' ) {
            bannerError.key = 'key is null, undefined or empty';
        } else {
            if( value && !_.isNull( value ) &&  !_.isEmpty( value ) ) {
                if ( ( key === 'startDate' || key === 'endDate' ) && !isValidDate( value ) ) {
                    bannerError[key] = `${key} is not in proper format`;
                }
                if ( key === 'duration' && isNaN( value ) ) {
                    bannerError[key] = `${key} is not a valid number string`;
                }
            } else {
                if ( key === 'text' &&  value.trim() === '' ) {
                    bannerError[key] = `${key} is not a valid string`;
                }
            }
        }
    } );
    return bannerError;
};

/**
 * Parses raw banner data into a structured format.
 *
 * @param {Array} rawBanners - An array of banner data strings. Each string is expected to be in the format 'key:value'.
 *                             The keys can be 'startDate', 'endDate', 'duration', 'closable', or a localized text key.
 *                             The values are the corresponding data for each key.
 *                             eg [ "identifier:Banner_AW_Downtime_Jul28", "text:AW will remain down for 4 hours due to Upgrade",
 *                                  "text_es:AW permanecerá inactivo durante 4 horas debido a una actualización",
                                    "startDate:2024-02-15 17:00", "endDate:2024-03-17 20:00","type:WARNING" ]
]
 *
 * @returns {Array} An array of banner context objects. Each object maps keys to their corresponding data.
 *                  The keys are 'startDate', 'endDate', 'duration', 'closable', and 'text'.
 *                  The 'startDate', 'endDate', and 'duration' values are parsed.
 *                  The 'closable' value is converted to a boolean.
 *                  The 'text' value is the localized text for the current locale, if available.
 *                  eg. [{ "identifier": "Banner_AW_Downtime_Jul28",  "text": "AW will remain down for 4 hours due to Upgrade",
 *                         "text_es": "AW permanecerá inactivo durante 4 horas debido a una actualización",
                          "startDate": 1707996600000,"endDate": 1710685800000, "type": "WARNING"}]
 */
const parseBannerDetails = function( rawBanners ) {
    let bannersArray = [];
    let currentBannerContext = {};
    let awIdentifier;
    rawBanners.forEach( ( banner ) => {
        let bannerFields = banner.split( ':' );
        let fieldName = bannerFields[0];
        let fieldValue = bannerFields.slice( 1 ).join( ':' );
        if ( fieldName === 'startDate' || fieldName === 'endDate' ) {
            fieldValue = parseDate( fieldValue );
        } else if ( fieldName === 'duration' ) {
            fieldValue = parseFloat( fieldValue );
        } else if ( fieldName === 'closable' ) {
            fieldValue = fieldValue === 'true';
        } else if ( fieldName === 'type' ) {
            fieldValue = fieldValue.toUpperCase();
        }
        currentBannerContext[fieldName] = fieldValue;
    } );
    let userGroupAndName =  userDetails?.props?.awp0CellProperties?.dbValues.map( item => {
        let splitItem = item.split( '\\:' );
        return splitItem[ 1 ];
    } );
    if( userGroupAndName.length > 0 ) {  awIdentifier = 'tcBanner_' + userGroupAndName[0] + '_' + '_' + userGroupAndName[2]; }
    currentBannerContext.identifier = currentBannerContext.identifier || awIdentifier;


    let localizedBannerTexts = extractLocaleTexts( rawBanners );
    if ( localizedBannerTexts[currentLocale]  && !_.isEmpty(  localizedBannerTexts[currentLocale] ) ) {
        currentBannerContext.text = localizedBannerTexts[currentLocale];
    }
    bannersArray.push( currentBannerContext );
    return bannersArray;
};

const fetchUserDetails = function() {
    return clientDataModel.getUser();
};

const trimText = function( obj ) {
    for ( let field in obj ) {
        if ( typeof obj[field] === 'string' ) {
            obj[field] = obj[field].trim();
            obj[field] = obj[field].replace( /:\s+/g, ':' );
        }
    }
    return obj;
};

export const init = function() {
    let bulkPreferencesLoadedSubscription = eventBus.subscribe( 'bulkPreferencesLoaded', async function() {
        currentLocale = localeService.getLocale();
        userDetails = fetchUserDetails();
        let preferences = appCtxService.getCtx( 'preferences' );
        let rawBanners = preferences?.AW_Banner;
        if( preferences && rawBanners ) {
            let result = await soaSvc.postUnchecked( 'Administration-2020-12-PreferenceManagement', 'refreshPreferences2', {
                preferenceNames: [ 'AW_Banner' ],
                includePreferenceDescriptions: false
            }, {} );
            if( result && result.response && result.response.length &&
                result.response[ 0 ].values && result.response[ 0 ].values.values ) {
                rawBanners = result.response[ 0 ].values.values;
            }
            rawBanners = trimText( rawBanners );
            let bannerErrors = validateRawBanner( rawBanners );
            trace( 'The banner is not configured correctly. Following errors are encountered', bannerErrors );
            if( Object.keys( bannerErrors ).length === 0 ) {
                let bannerContext = parseBannerDetails( rawBanners );
                showBanner( bannerContext );
            }
        }
        eventBus.unsubscribe( bulkPreferencesLoadedSubscription );
    } );
};

export default exports = {
    init
};
