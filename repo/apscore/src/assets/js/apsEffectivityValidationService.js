// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * Service for managing unit and date effectivity validations.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 *
 * @module js/apsEffectivityValidationService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import dateTimeSvc from 'js/dateTimeService';
import localeSvc from 'js/localeService';
import preferenceService from 'soa/preferenceService';
import uwDirectiveDateTimeSvc from 'js/uwDirectiveDateTimeService';
import AwBaseService from 'js/awBaseService';
import _ from 'lodash';

export default class ApsEffectivityValidationService extends AwBaseService {
    constructor() {
        super();

        /**
         * References to services.
         */

        /**
         * Indicates the effectivity mode for Unit Range<br>
         * true: effectivity is in From-To mode<br>
         * false: effectivity is in In-Out mode.
         */
        this._isFromToModeUnitRange = null;

        /**
         * Indicates the effectivity mode for Date Range<br>
         * true: effectivity is in From-To mode<br>
         * false: effectivity is in In-Out mode.
         */
        this._isFromToModeDateRange = null;
        /**
         * Valid min start unit value.
         */
        this.UNIT_MIN_VAL = 0;

        /**
         * UP display string.
         */
        this.UP = 'UP';

        /**
         * SO display string.
         */
        this.SO = 'SO';

        /**
         * End-Date Option String
         */
        this.DATE = 'Date';

        /**
         * Value of SO for unit effectivity. Value is 1 less than the value of UP. Input required to boolean solve APIs
         */
        this.SO_UNIT_VAL = '2147483646';

        /**
         * Value of UP for unit effectivity. Maximum value that a int can hold in 32 bit system. Input required to
         * boolean solve APIs
         */
        this.UP_UNIT_VAL = '2147483647';

        /**
         * "SO" (Stock Out) value for date effectivity with time format which is used to represent the time/date just
         * before end of time by TC server. The client reads this date as "SO" displays the string "SO" for the upper
         * end of range effectivity in a given configuration.
         */
        this.EFFECTIVITY_SO_DATE_WITH_TIME = '9999-12-26T00:00:00';

        /**
         * "UP" value for date effectivity with time format which is used to represent the date/time of end of time by
         * TC server. The client reads this date as "UP" and displays the string "UP" for the upper end of date range
         * effectivity in a given configuration.
         */
        this.EFFECTIVITY_UP_DATE_WITH_TIME = '9999-12-30T00:00:00';

        /**
         * "UP" value for date effectivity which is used to represent the date/time of end of time by TC server. The
         * client reads this date as "UP" and displays the string "UP" for the upper end of date range effectivity in a
         * given configuration.
         */
        this.EFFECTIVITY_UP_DATE = '9999-12-30';

        /**
         * "SO" (Stock Out) value for date effectivity which is used to represent the time/date just before end of time
         * by server. The client reads this date as "SO" and displays the string "SO" for the upper end of date range
         * effectivity in a given configuration.
         */
        this.EFFECTIVITY_SO_DATE = '9999-12-26';

        /**
         * Date before the "UP" date representation of the end of time by TC server. The client reads this date as "UP"
         * displays the string "UP" for the upper end of range effectivity in a given configuration. The day before is
         * used to account for time difference between time zones and accurate representation of "UP" value in date
         * range effectivity.
         */
        this.EFFECTIVITY_DATE_DECEMBER_29 = '9999-12-29';

        /**
         * Date before the "SO" (Stock Out) date representation of the time/date just before end of time by TC server.
         * The client reads this date as "SO" displays the string "SO" for the upper end of range effectivity in a given
         * configuration. The day before is used to account for time difference between time zones and accurate
         * representation of "SO" value in date range effectivity.
         */
        this.EFFECTIVITY_DATE_DECEMBER_25 = '9999-12-25';

        /**
         * String representation of NULLDATE for Tc Server
         */
        this.NULLDATE_WITH_TIME = '0001-01-01T00:00:00';

        /**
         * String representation of NULLDATE for Tc Server
         */
        this.NULLDATE = '0001-01-01';

        //Get the preference value Unit range effectivity and store it
        preferenceService.getLogicalValue( 'TC_Fnd0Booleansolve_EffectivityIntegerRangeFromTo' ).then( ( result ) => {
            if ( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                this._isFromToModeUnitRange = true;
            } else {
                this._isFromToModeUnitRange = false;
            }
        } );

        //Get the preference value Date range effectivity and store it
        preferenceService.getLogicalValue( 'TC_Fnd0Booleansolve_EffectivityDateRangeFromTo' ).then(
            ( result ) => {
                if ( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                    this._isFromToModeDateRange = true;
                } else {
                    this._isFromToModeDateRange = false;
                }
            } );
    }

    /**
     * Set the error message.
     *
     * @param {Object} scope - The scope object
     * @param {Function} msgFn - Function to call that will set the error message
     */
    static setErrorText( scope, msgFn ) {
        if ( !scope.errorApi ) {
            scope.errorApi = {};
        }
        scope.errorApi.errorMsg = '...details pending';
        var resource = 'ApsEffectivityMessages';
        var localTextBundle = localeSvc.getLoadedText( resource );
        if ( localTextBundle ) {
            msgFn( localTextBundle );
        } else {
            localeSvc.getTextPromise( resource ).then( msgFn( localTextBundle ) );
        }
    }

    /**
     * Checks if the given start unit effectivity is valid.
     *
     * @param {String} start - value of start unit
     * @param {String} end - value of end unit
     * @param {Object} localTextBundle - text bundle
     *
     * @return {String} - error message if invalid; null otherwise
     */
    checkValidStartUnit( start, end, localTextBundle ) {
        var errorMsg = null;
        var startUnit = Number( start );

        //validate start must be greater than min int
        errorMsg = startUnit < this.UNIT_MIN_VAL ? localTextBundle.INVALID_START_UNIT : errorMsg;

        //validate start must be less than UP if single unit(no range)
        errorMsg = errorMsg === null && startUnit > this.UP_UNIT_VAL ? localTextBundle.INVALID_START_UNIT_OUT_OF_BOUND
            .replace( '{0}', this.UP_UNIT_VAL ) :
            errorMsg;

        //validate start must be less than SO if unit range
        errorMsg = errorMsg === null && end.length > 0 && startUnit >= this.SO_UNIT_VAL ? localTextBundle.INVALID_START_UNIT_OUT_OF_BOUND
            .replace( '{0}', this.SO_UNIT_VAL ) :
            errorMsg;

        return errorMsg;
    }

    /**
     * Checks if the given end unit effectivity is valid.
     *
     * @param {String} start - value of start unit
     * @param {String} end - value of end unit
     * @param {Object} localTextBundle - text bundle
     *
     * @return {String} - error message if invalid; null otherwise
     */
    checkValidEndUnit( start, end, localTextBundle ) {
        var errorMsg = null;

        if ( isFinite( end ) ) {
            var endValue = Number( end );

            //validate end is greater than min int and less than SO
            if ( endValue < this.UNIT_MIN_VAL || endValue >= this.SO_UNIT_VAL ) {
                errorMsg = localTextBundle.END_UNIT_OUT_OF_BOUND.replace( '{0}', this.SO_UNIT_VAL );
            } else if ( start.length > 0 ) {
                //validate end is greater than start based on the from-to mode
                var startValue = Number( start );
                if ( !this._isFromToModeUnitRange && endValue <= startValue ) {
                    errorMsg = localTextBundle.INVALID_INOUT_UNIT;
                } else if ( this._isFromToModeUnitRange && endValue < startValue ) {
                    errorMsg = localTextBundle.INVALID_FROMTO_UNIT;
                }
            }
        }

        return errorMsg;
    }

    /**
     * Checks if the date range is valid in case of In Out date mode.
     *
     * @param {Object} sDate - the start date
     * @param {Object} eDate - the end date
     * @param {boolean} isAuthoringMode - flag specifying authoring mode
     *
     * @return {boolean} - true if date range is valid; false otherwise
     */
    static isInOutModeDateRangeValid( sDate, eDate, isAuthoringMode ) {
        // Authoring mode - If end date is less than or equal to start date (result <= 0) then populate error
        // Configuration mode - If end date is less than start date (result === -1) then populate error

        var startJsDate = sDate.dateApi.dateObject ? sDate.dateApi.dateObject : uwDirectiveDateTimeSvc.parseDate( sDate.dateApi.dateValue );
        var endJsDate = eDate.dateApi.dateObject ? eDate.dateApi.dateObject : uwDirectiveDateTimeSvc.parseDate( eDate.dateApi.dateValue );

        if ( isAuthoringMode && dateTimeSvc.compare( endJsDate, startJsDate ) <= 0 ||
            !isAuthoringMode && dateTimeSvc.compare( endJsDate, startJsDate ) === -1 ) {
            return false;
        }
        return true;
    }

    /**
     * Checks if the date range is valid in case of From To date mode.
     *
     * @param {Object} sDate - the start date
     * @param {Object} eDate - the end date
     * @param {boolean} isAuthoringMode - flag specifying authoring mode
     *
     * @return {boolean} - true if date range is valid; false otherwise
     */
    static isFromToModeDateRangeValid( sDate, eDate, isAuthoringMode ) {
        var startJsDate = sDate.dateApi.dateObject ? sDate.dateApi.dateObject : uwDirectiveDateTimeSvc.parseDate( sDate.dateApi.dateValue );
        var endJsDate = eDate.dateApi.dateObject ? eDate.dateApi.dateObject : uwDirectiveDateTimeSvc.parseDate( eDate.dateApi.dateValue );

        // Authoring mode - If end date is less than start date (result < 0) then populate error
        // Configuration mode - If end date is less than start date (result === -1) then populate error
        if ( isAuthoringMode && dateTimeSvc.compare( endJsDate, startJsDate ) < 0 ||
            !isAuthoringMode && dateTimeSvc.compare( endJsDate, startJsDate ) === -1 ) {
            return false;
        }
        return true;
    }

    /**
     * Checks if the given unit effectivity range is valid.
     *
     * @param {String} newValue - value to validate
     * @param {Object} localTextBundle - text bundle
     *
     * @return {String} - error message if invalid; null otherwise
     */
    checkValidUnitRangeEffectivity( newValue, localTextBundle ) {
        if ( newValue === '' || newValue === undefined ) {
            return;
        }

        var errorMsg = null;
        var unitEffPattern = /^[0-9]+$|^[0-9]+\.\.$|^\.\.([0-9]+|UP|SO|up|so)$|^[0-9]+\.\.([0-9]+|UP|SO|up|so)$/g;
        var result = newValue.match( unitEffPattern );
        if ( result === null || result.length > 1 ) {
            errorMsg = localTextBundle.INVALID_SYNTAX;
        } else {
            var tokens = result[0].split( '..' );
            var start = tokens.length >= 1 ? tokens[0] : '';
            var end = tokens.length === 2 ? tokens[1] : '';

            //Validate start effectivity
            if ( start.length > 0 ) {
                errorMsg = this.checkValidStartUnit( start, end, localTextBundle );
            }

            //Validate end effectivity
            if ( errorMsg === null && end.length > 0 ) {
                errorMsg = this.checkValidEndUnit( start, end, localTextBundle );
            }
        }

        return errorMsg;
    }

    /**
     * Checks if the given unit effectivity range is valid.
     *
     * @param {Object} sDate - the start date
     * @param {Object} eDate - the end date
     * @param {Object} localTextBundle - text bundle.
     * @param {boolean} isAuthoringMode - flag specifying authoring mode
     *
     * @return {String} - error message if invalid; null otherwise
     */
    checkValidDateRangeEffectivity( sDate, eDate, localTextBundle, isAuthoringMode ) {
        var errorMsg = null;

        // When the authoring panel is launched for the first time, eDate.dateApi.dateValue is undefined.
        // Thus it is important to check if eDate.dateApi.dateValue is valid
        if ( eDate.isEnabled && eDate.dateApi.dateValue && eDate.dateApi.dateValue !== '' ) {
            if ( !this._isFromToModeDateRange && !ApsEffectivityValidationService.isInOutModeDateRangeValid( sDate, eDate, isAuthoringMode ) ) {
                errorMsg = localTextBundle.INVALID_INOUT_DATE;
            } else if ( this._isFromToModeDateRange && !ApsEffectivityValidationService.isFromToModeDateRangeValid( sDate, eDate, isAuthoringMode ) ) {
                errorMsg = localTextBundle.INVALID_FROMTO_DATE;
            }
        }

        return errorMsg;
    }

    /**
     * Checks if the effectivity validator is in authoring mode.
     *
     * @param {String} effectivityValidator - effectivity validator
     *
     * @return {boolean} - true if effectivity validator is in authoring mode; false otherwise
     */
    static isEffectivityValidatorInAuthoringMode( effectivityValidator ) {
        return effectivityValidator.indexOf( 'AUTHOR' ) !== -1 || effectivityValidator.indexOf( 'EDIT' ) !== -1;
    }

    /**
     * Checks if the effectivity validator is for unit effectivity.
     *
     * @param {String} effectivityValidator - effectivity validator
     *
     * @return {boolean} - true if effectivity validator is for unit effectivity; false otherwise
     */
    static isUnitEffectivityValidator( effectivityValidator ) {
        return effectivityValidator.indexOf( 'UNIT' ) !== -1;
    }

    /**
     * Checks if the effectivity validator is for date effectivity.
     *
     * @param {String} effectivityValidator - effectivity validator
     *
     * @return {boolean} - true if effectivity validator is for date effectivity; false otherwise
     */
    static isDateEffectivityValidator( effectivityValidator ) {
        return effectivityValidator.indexOf( 'DATE' ) !== -1;
    }

    /**
     * Handles unit range effectivity validation and issues error on invalid entry.
     * <P>
     * Note: If there is any failure in validation, the details of which will appear as a non-null value on the
     * 'scope.errorApi.errorMsg' property.
     *
     * @param {NgScope} scope - The AngularJS 'scope' containing the property to interact with.
     * @param {NgModelController} ngModelCtrl - The (optional) NgModelController to interact with in case the UI
     *            needs to be updated.
     * @param {String} value - String to test for validity.
     * @param {Object} localTextBundle - Local text bundle.
     * @param {boolean} isAuthoringMode - flag specifying if its authoring mode.
     *
     * @returns {String} Error message in case of validation failure; null otherwise.
     */
    handleAsyncUnitRangeEffectivityValidation( scope, ngModelCtrl, value, localTextBundle,
        isAuthoringMode ) {
        var clean = value;
        var errorMsg = null;

        //remove all spaces from the given string
        clean = clean.replace( /\s+/g, '' );
        if ( ngModelCtrl && value !== clean ) {
            ngModelCtrl.$setViewValue( clean );
            ngModelCtrl.$render();
        }
        errorMsg = this.checkValidUnitRangeEffectivity( clean, localTextBundle );

        if ( isAuthoringMode ) {
            scope.data.isUnitRangeValid = errorMsg === null;
        }

        return errorMsg;
    }

    /**
     * Handles date range effectivity validation and issues error on invalid entry.
     * <P>
     * Note: If there is any failure in validation, the details of which will appear as a non-null value on the
     * 'scope.errorApi.errorMsg' property.
     *
     * @param {NgScope} scope - The AngularJS 'scope' containing the property to interact with.
     * @param {Object} localTextBundle - Local text bundle.
     * @param {boolean} isAuthoringMode - flag specifying if its authoring mode.
     *
     * @returns {String} Error message in case of validation failure; null otherwise.
     */
    handleAsyncDateRangeEffectivityValidation( scope, localTextBundle, isAuthoringMode ) {
        var errorMsg = null;

        var isValidEndDate = this.checkDateValidity( scope.$parent.data.endDate );

        if ( !isValidEndDate ) {
            if ( isAuthoringMode ) {
                scope.data.isDateRangeValid = false;
            } else {
                scope.$parent.data.isInvalidDate.dbValue = true;
            }
        } else {
            errorMsg = this.checkValidDateRangeEffectivity( scope.$parent.data.startDate, scope.$parent.data.endDate,
                localTextBundle, isAuthoringMode );

            if ( isAuthoringMode ) {
                scope.data.isDateRangeValid = errorMsg === null || errorMsg === '';
            } else {
                scope.$parent.data.isInvalidDate.dbValue = errorMsg !== null;
            }
        }

        return errorMsg;
    }

    /**
     * Returns the open ended date value
     *
     * @param {String} end - End unit value.
     *
     * @returns {String} End unit internal value.
     */
    getOpenEndedUnitInternalValue( end ) {
        var endUnitInternalValue = end;

        if ( !isFinite( end ) ) {
            if ( this.UP === end.toUpperCase() ) {
                endUnitInternalValue = this.UP_UNIT_VAL;
            } else if ( this.SO === end.toUpperCase() ) {
                endUnitInternalValue = this.SO_UNIT_VAL;
            }
        }

        return endUnitInternalValue;
    }

    /**
     * Checks if the given date effectivity range is valid.
     *
     * @param {Object} sDate - the start date
     * @param {Object} eDate - the end date
     * @param {boolean} isAuthoringMode - flag specifying authoring mode
     *
     * @return {String} - error message if invalid; null otherwise
     */
    isDateRangeValid( sDate, eDate, isAuthoringMode ) {
        return this._isFromToModeDateRange && ApsEffectivityValidationService.isFromToModeDateRangeValid( sDate, eDate, isAuthoringMode ) ||
            !this._isFromToModeDateRange && ApsEffectivityValidationService.isInOutModeDateRangeValid( sDate, eDate, isAuthoringMode );
    }

    /**
     * Get the new unit effectivity start and end values from the given unit effectivity string.
     *
     * @param {String} effectivityStr - The unit effectivity string in the format n or [n]..[m or UP or SO].
     *
     * @return {Object} - The JSON object with start and end units
     */
    getUnitRangesFromEffectivityString( effectivityStr ) {
        var start = '-1';
        var end = '-1';

        if ( effectivityStr ) {
            var newValue = effectivityStr;
            var tokens = newValue.split( '..' );

            if ( tokens.length >= 1 && tokens[0].length !== 0 ) {
                start = tokens[0];
            }

            if ( tokens.length === 1 ) {
                // If end unit is not specified, we want to set it as start unit
                end = start;
            } else if ( tokens.length === 2 && tokens[1].length !== 0 ) {
                end = tokens[1];
                end = this.getOpenEndedUnitInternalValue( end );
            }
        }

        return {
            startUnit: start,
            endUnit: end
        };
    }

    /**
     * Get the new date effectivity start and end dates as string from the given dates
     *
     * @param {Date} startDate - Selected startDate for date effectivity
     * @param {Date} endDate - Selected endDate for date effectivity
     * @param {String} endEffectivityOption - Selected end date option for end date effectivity
     *
     * @return {Object} - The JSON object with start and end dates as string
     */
    getDateRangesFromEffectivityDates( startDate, endDate, endEffectivityOption ) {
        // Initialize with default values
        var startDateString = dateTimeSvc.formatUTC( dateTimeSvc.getNullDate() );
        var endDateString = dateTimeSvc.formatUTC( dateTimeSvc.getNullDate() );

        //Set to default no value. Without this, the unit is getting set to 0

        var start = '-1';
        var end = '-1';

        // Get start Date String
        startDateString = this.getStringFromDate( startDate.dateApi.dateObject );

        if ( startDateString.length === 0 ) {
            startDateString = this.NULLDATE_WITH_TIME;
        }

        if ( endEffectivityOption === this.UP ) {
            endDateString = this.EFFECTIVITY_UP_DATE_WITH_TIME;
        } else if ( endEffectivityOption === this.SO ) {
            endDateString = this.EFFECTIVITY_SO_DATE_WITH_TIME;
        } else {
            endDateString = this.getStringFromDate( endDate.dateApi.dateObject );

            if ( endDateString.length === 0 ) {
                endDateString = this.NULLDATE_WITH_TIME;
            } else if ( dateTimeSvc.compare( startDate.dateApi.dateObject, endDate.dateApi.dateObject ) === 0 ) {
                // Single Date effectivity, Get next Date
                var endDateAsNextDate = startDate.dateApi.dateObject;
                endDateAsNextDate.setDate( startDate.dateApi.dateObject.getDate() + 1 );
                endDateAsNextDate.setHours( 0 );
                endDateAsNextDate.setMinutes( 0 );
                endDateAsNextDate.setSeconds( 0 );
                endDateString = this.getStringFromDate( endDateAsNextDate );
            }
        }

        return {
            startDate: startDateString,
            endDate: endDateString,
            startUnit: start,
            endUnit: end
        };
    }

    /**
     * Converts given Date to String
     *
     * @param {Date} date - Date to be converted into String
     *
     * @return {String} - String representation of the Given Date in UTC format
     */
    getStringFromDate( date ) {
        var dateString = dateTimeSvc.formatUTC( date );

        if ( dateString.search( this.EFFECTIVITY_UP_DATE ) !== -1 ||
            dateString.search( this.EFFECTIVITY_DATE_DECEMBER_29 ) !== -1 ) {
            dateString = this.EFFECTIVITY_UP_DATE_WITH_TIME;
        } else if ( dateString.search( this.EFFECTIVITY_SO_DATE ) !== -1 ||
            dateString.search( this.EFFECTIVITY_DATE_DECEMBER_25 ) !== -1 ) {
            dateString = this.EFFECTIVITY_SO_DATE_WITH_TIME;
        }

        return dateString;
    }

    /**
     * Validate range effectivity and issues error on invalid entry.
     * <P>
     * Note: If there is any failure in validation, the details of which will appear as a non-null value on the
     * 'scope.errorApi.errorMsg' property.
     *
     * @param {NgScope} scope - The AngularJS 'scope' containing the property to interact with.
     * @param {String} effectivityValidator - Effectivity Validator string
     * @param {NgModelController} ngModelCtrl - The (optional) NgModelController to interact with in case the UI
     *            needs to be updated.
     * @param {String} value - String to test for validity.
     *
     * @returns {String} Same as given input value with any invalid characters removed.
     */
    checkAsyncRangeEffectivity( scope, effectivityValidator, ngModelCtrl, value ) {
        var deferred = AwPromiseService.instance.defer();

        ApsEffectivityValidationService.setErrorText( scope, ( localTextBundle ) => {
            var clean = value;
            var errorMsg = null;

            var isAuthoringMode = ApsEffectivityValidationService.isEffectivityValidatorInAuthoringMode( effectivityValidator );

            if ( ApsEffectivityValidationService.isUnitEffectivityValidator( effectivityValidator ) && clean !== null && clean !== '' ) {
                errorMsg = this.handleAsyncUnitRangeEffectivityValidation( scope, ngModelCtrl, value, localTextBundle,
                    isAuthoringMode );
            } else if ( ApsEffectivityValidationService.isDateEffectivityValidator( effectivityValidator ) ) {
                errorMsg = this.handleAsyncDateRangeEffectivityValidation( scope, localTextBundle, isAuthoringMode );
            }

            if ( errorMsg !== null ) {
                scope.prop.error = errorMsg;
                scope.errorApi.errorMsg = errorMsg;
                deferred.reject();
            } else {
                // nullify error and since it is a valid number convert it to number
                // watcher function will sync prop.error too, but the async function can happen after
                // gwt's setError function which reverts the errorMsg to the previous error.
                scope.prop.error = null;
                scope.errorApi.errorMsg = null;
                deferred.resolve();
            }
        } );

        return deferred.promise;
    }

    /**
     * Populates existing effectivity into start and end date
     *
     * @param {Object} effectivityInfo : Existing Effectivity
     * @param {Date} startDate : Start Date
     * @param {Date} endDate : End Date
     * @param {String} endDateOptions: End date option
     */
    populateDateRangeEffectivityDates( effectivityInfo ) {
        let outputData = {
            startDate: {},
            endDate: {},
            endDateOptions: {}
        };
        let resource = 'ApsEffectivityMessages';
        let localTextBundle = localeSvc.getLoadedText( resource );

        var sDateStr = effectivityInfo.currentStartEffDates.dbValues[0];
        var eDateStr = effectivityInfo.currentEndEffDates.dbValues[0];

        outputData.startDate.dbValue = new Date( sDateStr ).getTime();
        outputData.startDate.dateObject = dateTimeSvc.getJSDate( outputData.startDate.dbValue );


        if ( eDateStr !== null &&
            ( eDateStr.indexOf( this.EFFECTIVITY_UP_DATE ) !== -1 || eDateStr
                .indexOf( this.EFFECTIVITY_DATE_DECEMBER_29 ) !== -1 ) ) {
            outputData.endDateOptions.dbValue = this.UP;
            outputData.endDateOptions.uiValue = localTextBundle.upText;
        } else if ( eDateStr !== null &&
            ( eDateStr.indexOf( this.EFFECTIVITY_SO_DATE ) !== -1 || eDateStr
                .indexOf( this.EFFECTIVITY_DATE_DECEMBER_25 ) !== -1 ) ) {
            outputData.endDateOptions.dbValue = this.SO;
            outputData.endDateOptions.uiValue = localTextBundle.soText;
        } else {
            outputData.endDateOptions.dbValue = this.DATE;
            outputData.endDateOptions.uiValue = this.DATE;
            outputData.endDate.dbValue = new Date( eDateStr ).getTime();
            outputData.endDate.dateObject = dateTimeSvc.getJSDate( outputData.endDate.dbValue );
            var tempDate = dateTimeSvc.getJSDate( outputData.startDate.dbValue );
            tempDate.setDate( outputData.startDate.dateObject.getDate() + 1 );
            tempDate.setHours( 0 );
            tempDate.setMinutes( 0 );
            tempDate.setSeconds( 0 );
            if ( dateTimeSvc.compare( tempDate, outputData.endDate.dateObject ) === 0 ) {
                outputData.endDate.dbValue = new Date( sDateStr ).getTime();
            }
        }
        return outputData;
    }

    /**
     * Checks validity for given date
     *
     * @param {Date} date : Date
     *
     * @returns {boolean} : Returns true if valid date
     */
    checkDateValidity( date ) {
        var isValidDate = true;
        if ( date.dateApi.dateValue ) {
            try {
                uwDirectiveDateTimeSvc.parseDate( date.dateApi.dateValue );
            } catch ( ex ) {
                isValidDate = false;
            }
        }
        return isValidDate;
    }

    /**
     * Returns true if the current unit effectivity mode is From-To.<br>
     * Returns false if the current unit effectivity mode is In-Out.
     *
     * @returns {boolean} true if the current unit effectivity mode is From-To false otherwise.
     */
    isUnitEffectivityFromToMode() {
        // First time when we open the panel sometime this value is not set, So we are checking again.
        if ( _.isUndefined( this._isFromToModeUnitRange ) || _.isNull( this._isFromToModeUnitRange ) ) {
            const result = appCtxSvc.getCtx( 'preferences.TC_Fnd0Booleansolve_EffectivityIntegerRangeFromTo' );
            if ( result !== null && result.length > 0 && result[0].toUpperCase() === 'TRUE' ) {
                return true;
            }
            return false;
        }
        return this._isFromToModeUnitRange;
    }

    /**
     * Returns true if the current date effectivity mode is From-To.<br>
     * Returns false if the current date effectivity mode is In-Out.
     *
     * @returns {boolean} true if the current date effectivity mode is From-To false otherwise.
     */
    isDateEffectivityFromToMode() {
        // First time when we open the panel sometime this value is not set, So we are checking again.
        if ( _.isUndefined( this._isFromToModeDateRange ) || _.isNull( this._isFromToModeDateRange ) ) {
            const result = appCtxSvc.getCtx( 'preferences.TC_Fnd0Booleansolve_EffectivityDateRangeFromTo' );
            if ( result !== null && result.length > 0 && result[0].toUpperCase() === 'TRUE' ) {
                return true;
            }
            return false;
        }
        return this._isFromToModeDateRange;
    }
}
