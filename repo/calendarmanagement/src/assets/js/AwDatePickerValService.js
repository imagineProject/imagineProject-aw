import Flatpickr from 'js/flatpickerWrapper';
import dateTimeSvc from 'js/dateTimeService';
import _ from 'lodash';
import { getValClass } from 'js/componentUtils';

export const awCalendarValRenderFunction = ( props ) => {
    const {
        updatedEvents,
        datePickerInfo,
        ...prop
    } = props;
    if( !prop.value ) {
        return '';
    }
    const inputClass = getValClass( prop );
    const isDisabledClassDefined = prop && inputClass && /disabled/.test( inputClass );
    const isEnabled = !isDisabledClassDefined && prop.fielddata.isEnabled;
    const VALID_DATESTRING_LENGTH = 10;
    let dateVal = null;
    let dateForm = null;

    if( _.isArray( prop.value ) ) {
        prop.fielddata.displayValsModel.every( dateTimeEntry => {
            if( dateTimeEntry.isInEditMode ) {
                dateVal = dateTimeSvc.formatDate( dateTimeEntry.displayValue );
                dateForm = dateTimeSvc.getDateFormat( dateTimeEntry.displayValue );
                return false;
            }
            return true;
        } );
        if( !dateVal ) {
            dateVal = dateTimeSvc.formatDate( prop.value[ prop.value.length - 1 ] );
            dateForm = dateTimeSvc.getDateFormat( prop.value[ prop.value.length - 1 ] );
        }
    } else {
        dateVal = dateTimeSvc.formatDate( prop.value );
        dateForm = dateTimeSvc.getDateFormat( prop.value );
    }

    const { quickNav } = props;
    const monthSelType = quickNav === 'false' ? 'static' : 'dropdown';
    let placeholder = dateTimeSvc.getDateFormatPlaceholder();
    let otherProps = { ...prop, placeholder };

    const onChange = event => prop.onChange( { target: { value: event[ 0 ] } } );

    const dayCreate = function( dObj, dStr, fp, dayElem )  {
        var date = dayElem.dateObj;
        date.setHours( 12, 0, 0 );
        let defaultFlag = false;
        let newEventFlag = -1;
        let existingEventFlag = -1;
        let inheritedFlag = -1;

        if( props.selectedCalendarData ) {
            let dayIdx = date.getDay();

            if( updatedEvents[date] && updatedEvents[date].type !== 'wdd' ) {
                newEventFlag = 0;
            }
            if( props.datePickerInfo && !_.isEmpty( datePickerInfo.inheritedBucket ) ) {
                inheritedFlag = _.findIndex( datePickerInfo.inheritedBucket, function( exceptionDate ) {
                    return exceptionDate.getDate() === dayElem.dateObj.getDate();
                } );
            }
            if( props.datePickerInfo && !_.isEmpty( datePickerInfo.exceptionBucket ) ) {
                existingEventFlag = _.findIndex( datePickerInfo.exceptionBucket, function( exceptionDate ) {
                    return exceptionDate.getDate() === dayElem.dateObj.getDate();
                } );
            }
            if( updatedEvents[date] && updatedEvents[date].type === 'wdd' && ( inheritedFlag > -1 || existingEventFlag > -1 ) ) {
                inheritedFlag = -1;
                existingEventFlag = -1;
            }
            if ( props.nonWorkingDays && props.nonWorkingDays.length > 0 ) {
                defaultFlag = props.nonWorkingDays.indexOf( date.getDay() ) > -1;
            } else if( props.selectedCalendarData[ dayIdx ].ranges.length === 0 ) {
                defaultFlag = true;
            } else if( props.selectedCalendarData[ dayIdx ].ranges[ 0 ].range_start === props.selectedCalendarData[ dayIdx ].ranges[ 0 ].range_end ) {
                defaultFlag = true;
            }
            if(  newEventFlag > -1 || existingEventFlag > -1 ) {
                dayElem.className += ' aw-calendarManagement-exception';
            } else if( inheritedFlag > -1 ) {
                dayElem.className += ' aw-calendarManagement-inheritedException';
            }else if( defaultFlag === true ) {
                dayElem.className += ' aw-calendarManagement-nonWorking';
            }
        }
    };
    const handleKeyUp = ( event ) => {
        if( event.currentTarget ) {
            const dateInput = event.currentTarget.value;
            const fp = event.currentTarget._flatpickr;
            if( dateInput.length > VALID_DATESTRING_LENGTH ) {
                fp.setDate( fp.parseDate( dateInput ) );
            } else { fp.jumpToDate( fp.parseDate( dateInput ) ); }
        }
    };

    const onBlur = ( event ) => {
        if( event.currentTarget && !_.isUndefined( event.currentTarget.value ) && dateVal !== event.currentTarget.value ) {
            const fp = event.currentTarget._flatpickr;
            if( fp ) {
                fp.setDate( event.currentTarget.value, true );
            }
        }
    };

    const monthChange = function( dObj, dStr, fp, dayElem ) {
        if( props.datePickerInfo && fp && props.datePickerInfo.currentMonth !== fp.currentMonth + 1 ) {
            var monthChanged = 'month';
            updateDatePicker( datePickerInfo, fp, monthChanged );
        }
    };

    const yearChange = ( dObj, dStr, fp, dayElem ) => {
        if( props.datePickerInfo && fp && props.datePickerInfo.currentYear !== fp.currentYear ) {
            var yearChanged = 'year';
            updateDatePicker( datePickerInfo, fp, yearChanged );
        }
    };

    const focusOnDateWidget = ( ...args ) => {
        _.defer( () => {
            args[ 2 ].input.focus();
        } );
    };

    const addQuickNavClass = function() {
        let yearContainer = this.calendarContainer;
        if( quickNav && quickNav === 'false' ) {
            yearContainer.classList.add( 'flatpickr-disable-quickNav' );
        }
        this.toggle();
    };

    const getConfig = () => {
        return {
            dateFormat: dateForm,
            defaultDate: dateVal,
            allowInput: isEnabled,
            monthSelectorType: monthSelType,
            closeOnSelect: false,
            inline:true,
            static:true,
            shorthandCurrentMonth:false,
            onReady: addQuickNavClass,
            onOpen: focusOnDateWidget
        };
    };
    return (
        <div>
            <div className='aw-calendar sw-date-container'>
                <Flatpickr
                    {...otherProps}
                    autocomplete='off'
                    className={inputClass}
                    value={dateVal}
                    options={getConfig()}
                    onKeyUp={handleKeyUp}
                    onChange ={onChange}
                    onDayCreate= {dayCreate}
                    onMonthChange={monthChange}
                    onYearChange={yearChange}
                    onBlur={onBlur}
                    disabled = {!isEnabled}/>
            </div>
            <div><br></br></div>
            <div>
                <div className='sw-row' style={{ marginBottom: '7px' }}>
                    <div className='sw-column w-6'>
                        <div className='sw-row'>
                            <span className='aw-datePicker-nonworking aw-calendarManagement-nonWorking'></span>
                            <div className='aw-datePicker-div'>{props.i18n.nonWorking}</div>
                        </div>
                    </div>
                    <div className='sw-column w-6'>
                        <div className='sw-row'>
                            <span className='aw-datePicker-inheritedException aw-calendarManagement-inheritedException'></span>
                            <div className='aw-datePicker-div'>{props.i18n.inheritedException}</div>
                        </div>
                    </div>
                </div>
                <div className='sw-row'>
                    <div className='sw-column w-6'>
                        <div className='sw-row'>
                            <span className='aw-datePicker-selectedDay aw-calendarManagement-selectedDay'></span>
                            <div className='aw-datePicker-div'>{props.i18n.selectedDay}</div>
                        </div>
                    </div>
                    <div className='sw-column w-6'>
                        <div className='sw-row'>
                            <span className='aw-datePicker-Exception aw-calendarManagement-exception'></span>
                            <div className='aw-datePicker-div'>{props.i18n.exception}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const updateDatePicker = ( datePickerInfo, fp, changed ) => {
    let fromDate = new Date( fp.currentYear, fp.currentMonth, 1 ); // first day of month
    let toDate = new Date( fp.currentYear, fp.currentMonth + 1, 1 ); // last day of month
    let fromDateToString = dateTimeSvc.formatUTC( fromDate );
    let toDateToString = dateTimeSvc.formatUTC( toDate );

    //update the atomic data
    const newDatePickerInfo = { ...datePickerInfo.getValue() };
    changed === 'month' ? newDatePickerInfo.currentMonth = fp.currentMonth + 1  : newDatePickerInfo.currentYear = fp.currentYear; //avoding two SOA calls
    newDatePickerInfo.fromDate = fromDateToString;
    newDatePickerInfo.toDate = toDateToString;
    datePickerInfo.update( newDatePickerInfo );
};
