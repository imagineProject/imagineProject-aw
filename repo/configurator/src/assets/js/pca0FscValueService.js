// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

/**
 * Helper service for pca0valueView
 *
 * @module js/pca0FscValueService
 */


import appCtxSvc from 'js/appCtxService';
import AwCellCommandBar from 'viewmodel/AwCellCommandBarViewModel';
import AwDate from 'viewmodel/AwDateViewModel';
import AwDefaultCell from 'viewmodel/AwDefaultCellViewModel';
import AwDialog from 'viewmodel/AwDialogViewModel';
import AwIcon from 'viewmodel/AwIconViewModel';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import AwTimeoutService from 'js/awTimeoutService';
import AwVisualIndicator from 'viewmodel/AwVisualIndicatorViewModel';
import configuratorUtils from 'js/configuratorUtils';
import dateTimeService from 'js/dateTimeService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import pca0Constants from 'js/Pca0Constants';
import pcaSelectionService from 'js/Pca0FscSelectionService';
import Pca0FscValueIcon from 'viewmodel/Pca0FscValueIconViewModel';
import _ from 'lodash';
import { getField } from 'js/utils';

let exports = {};
let timeout = null;
let clickCount = 0;

const $timeout = AwTimeoutService.instance;
const valueToIndicatorsPath = 'optValue.indicators';
const ValidationCriteriaForIntFamily = /^(<|>|<=|>=)?(\s?)(-?\s?\d+)(\s?)(&?)(\s?)(<|<=|>|>=)?(\s?)(-?\s?\d*?)$/;
const ValidationCriteriaForDoubleFamily = /^(<|>|<=|>=)?(\s?)(-?\s?\d+)(\.?\d*?)(\s?)(&?)(\s?)(<|<=|>|>=)?(\s?)(-?\s?\d*?)(\.?\d*?)$/;

/**
 * Helps to prepare class as per feature type violation
 * @param {Object} props required properties of component.
 * @param {string} featureWidthClass CSS class string.
 * @returns {string} of style class
 */
const _getFeatureViolationStyleClasses = ( featureData, featureWidthClass ) => {
    //note: this is only needed for the test locators
    let valueClasses = 'aw-cfg-value aw-cfg-optionValueCellRow' + featureWidthClass;
    let violationClass;
    if( featureData.violationsInfo && featureData.violationsInfo.violationSeverity ) {
        let violationSeverity = featureData.violationsInfo.violationSeverity;
        if( violationSeverity === 'error' ) {
            violationClass = 'aw-cfg-violationErrorImage';
        } else if( violationSeverity === 'warning' ) {
            violationClass = 'aw-cfg-violationWarningImage';
        } else if( violationSeverity === 'info' ) {
            violationClass = 'aw-cfg-violationInfoImage';
        }
        valueClasses = valueClasses + ' ' + violationClass;
    }
    return valueClasses;
};

/**
 * Helps to get freeForm style class
 * @param {*} props props of component
 * @returns {string} of style class
 */
const _getFreeFormClasses = ( featureData ) => {
    const freeFormIconClass = featureData.isDateRangeExpr && !featureData.isFreeFormFeature ? 'aw-cfg-fscSelectedImageThumbnail' :
        'aw-cfg-fscSelectedImageThumbnail aw-cfg-FreeFormIcon sw-aria-border';

    if( featureData.dbValue === '' || featureData.type === 'DATE' && !featureData.uiValue ) {
        return freeFormIconClass + ' aw-cfg-disableSelection';
    }
    return freeFormIconClass;
};

/**
 * Freeform tab index
 * @param {Object} props component data
 * @returns {number} index
 */
const _getFreeFormTabIndex = ( featureData ) => {
    //free form should not be clickable if disabled (empty)
    let tabIndex = '0';

    if( featureData.dbValue === '' || featureData.type === 'DATE' && !featureData.uiValue ) {
        tabIndex = '-1';
    }
    return tabIndex;
};

/**
 * Helps to get system selection indicator
 * @param {Object} featureData - props of componnent
 * @returns {HTMLElement} element to represent selection indicator
 */
const _getSystemSelectionIndicator = ( featureData ) => {
    //this is only for the free form the rest in encapsulated in the indicators of the default cell
    switch ( featureData.selectionState ) {
        case 9:
        case 10:
            return <AwIcon iconId='indicatorSystemSelection'></AwIcon>;
        case 5:
        case 6:
            return <AwIcon iconId='indicatorDefaultSelection'>   </AwIcon>;
        default:
            return<></>;
    }
};

/**
 * Helps to get system text indicator
 * @param {Integer} selectionState - selection state
 * @returns {String} - system text indicator
 */
const _getSystemTextIndicator = ( selectionState ) => {
    let systemTextIndicator = '';
    if ( selectionState === 9 || selectionState === 10 ) {
        systemTextIndicator = configuratorUtils.getCustomConfigurationLocaleTextBundle().systemSelectionTitle;
    } else if ( selectionState === 5 || selectionState === 6 ) {
        systemTextIndicator = configuratorUtils.getCustomConfigurationLocaleTextBundle().defaultSelectionTitle;
    }
    return systemTextIndicator;
};

/**
 * Helps to get violation indication
 * @param {Object} featureData - Feature component props
 * @returns {Component} component to render
 */
const _getViolationIndicator = ( featureData ) => {
    //this is only for the free form the rest in encapsulated in the indicators of the default cell
    switch ( featureData?.violationsInfo?.violationSeverity ) {
        case 'warning':
            return <AwIcon iconId='indicatorWarning'></AwIcon>;
        case 'info':
            return <AwIcon iconId='indicatorInfo'></AwIcon>;
        case 'error':
            return <AwIcon iconId='indicatorError'></AwIcon>;
        default:
            return <></>;
    }
};

/**
 * Helper to get the date string formatted
 * @param {Object} dateToFormat - date
 * @returns {String} - formated date
 */
var getFormattedDateString = function( dateToFormat ) {
    return dateToFormat.getFullYear().toString() + '-' + ( dateToFormat.getMonth() + 1 ).toString().padStart( 2, '0' ) + '-' + dateToFormat.getDate().toString().padStart( 2,
        '0' ) + 'T00:00:00Z';
};

/**
 * Evaluates the new selection state based on variant mode (Guided/Manual)
 * @param {Object} props - The props
 * @param {Boolean} isGuidedMode - Is Guided Mode or not
 * @returns {Integer} - state
 */
const evaluateNextSelectionState = ( props, isGuidedMode ) =>{
    let state = -1;
    //for the current mode you cannot rely on the freshness of the state from the prop, so take it from the data
    const tempState = props.value.selectionState;
    //If the current state is 2 and the feature allows 1, then move to 1(user positive)
    if( tempState === 2 && props.value.allowedSelectionStates.includes( 1 ) ) {
        return 1;
    }

    //Take the index of current selection state
    let index = props.value.allowedSelectionStates.indexOf( tempState );
    if( isGuidedMode ) {
        //In guided mode we get new allowedSelectionStates on every click
        index = 0;
    } else {
        //Calculate the index of new state
        //Move one state at a time
        if ( tempState === 5 || tempState === 9 ) {
            state = 0; // Move to empty state if its default positive or system positive
        } else if( tempState === 6 || tempState === 10 ) {
            state = 1; //move to user positive if its default negative or system negative
        } else {
            index = ( index + 1 ) % props.value.allowedSelectionStates.length;
        }
    }
    if ( state === -1 ) {
        //Take the new state from allowed selection states
        state = props.value.allowedSelectionStates[ index ];
        //If the new state is 2, then move to the next state
        if( state === 2 ) {
            state = props.value.allowedSelectionStates[ ( index + 1 ) % props.value.allowedSelectionStates.length ];
        }
    }
    return state;
};

/**
 * Handles the select and the states based on the nr of clicks
 * @param {Object} featureVMOData - The feature data object for declarative way.
 * @param {Object} props - The props
 * @param {Boolean} isSingleClick - Single Click
 * @param {Integer} setAsSelected - selection state
 * @param {String} optStrToRemove - optional string to remove in case of free form family
 * @returns {Object} - featureVMOData
 */
const select = ( featureVMOData, props, isSingleClick, setAsSelected = undefined, optStrToRemove ) => {
    const isGuidedMode = _.get( props, 'family.familyCmdContext.guidedMode' );
    const state = setAsSelected ? setAsSelected : Number( evaluateNextSelectionState( props, isGuidedMode ) );
    const optValueStr = featureVMOData.optValueStr; // uid of the feature
    let updatedVal = { ...featureVMOData };

    //In case of free form family the feature needs to have vmo created for tile display in summary section
    if( featureVMOData.isFreeFormFeature ) {
        const displayValue = featureVMOData.uiValue;
        const vmo = {
            uid: '_freeFormFeature_',
            cellHeader1: displayValue,
            typeIconURL: iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE ),
            indicators: []
        };
        if( featureVMOData.type === 'DATE' ) {
            var isRange = typeof featureVMOData.dbValue === 'string' && featureVMOData.dbValue.search( />=|<|>|<=/ ) >= 0;
            if( isRange ) {
                updatedVal.uiValue = featureVMOData.uiValue;
                updatedVal.error = ''; //clear the date error as we are using it as string, is already validated
                updatedVal.optValue = featureVMOData.optValue;
            } else {
                vmo.cellHeader1 = featureVMOData.uiValue;
                updatedVal.dateApi = featureVMOData.dateApi;
                updatedVal.dbValue = featureVMOData.dbValue;
                updatedVal.uiValue = dateTimeService.formatDate( featureVMOData.uiValue );
            }

            if( typeof displayValue === 'string' && displayValue.search( />=|<|>|<=/ ) >= 0 ) {
                updatedVal.isDateRangeExpr = true;
            }
        }
        updatedVal.optValueStr = optValueStr;
        updatedVal.optValue = vmo;
        updatedVal.state = state;
        // explicitly set the selection data to the vmo
        props.family.values[ props.value.featureIndex ] = { ...updatedVal };
    }
    updatedVal.selectionState = state;
    // In guided mode dont change the selection state of the feature immediately, wait for server response.
    featureVMOData.selectionState = isGuidedMode ? featureVMOData.selectionState : state;
    let perspectiveUid = '';
    if( props.valueaction === 'selectPackageOption' ) {
        const context = appCtxSvc.getCtx( props.variantcontext );
        perspectiveUid = context.configPerspective.uid;
    } else {
        perspectiveUid = props.configuid ? props.configuid : props.family.familyCmdContext.configPerspectiveUid;
    }

    const selectionData = {
        variantcontext: props.variantcontext,
        valueaction: props.valueaction,
        value: updatedVal,
        family: props.family,
        state: state,
        perspectiveUid: perspectiveUid,
        path: { famIndex: props.family.famIndex, index: props.value.featureIndex }
    };

    pcaSelectionService.setSelection( selectionData, null, optStrToRemove );
    return featureVMOData;
};

/**
 * Validates the entries into the free-form text box - incorporated change from cp PLM681526
 * @param {Object} props - The view model object
 * @returns {Object} - validationCriteria
 */
const _validateFreeFormTextBox = ( props, newValue ) => {
    let validationCriteria = {};
    // 1. (<|>|<=|>=)? -> Support only these operators and only one at a time. All are optional
    // 2. (\s?) -> Adding a single space is optional.
    // 3. (-?\s?\d+) -> Required any number with optional negative sign and space.
    // 4. (\s?) -> After a number user can add single space which is optional.
    // 5. (&?) -> Support this operator only. It's optional.
    // 6. (\s?) -> After operator user can add single space which is optional.
    // 7. (<|<=|>|>=)? -> Support only these operators and only one at a time. All are optional
    // 8. (\s?)(-?\s?\d*?) -> Support single space with any numbers. All are optional
    if( props.family.familyType === 'Integer' && !ValidationCriteriaForIntFamily.test( newValue ) ) {
        validationCriteria = configuratorUtils.getFscLocaleTextBundle().ValidationErrorMesgForIntFreeForm;
    } else if( props.family.familyType === 'Floating Point' && !ValidationCriteriaForDoubleFamily.test( newValue ) ) {
        validationCriteria = configuratorUtils.getFscLocaleTextBundle().ValidationErrorMesgForDoubleFreeForm;
    } else {
        validationCriteria = null;
    }
    return validationCriteria;
};

/**
 * Helps to get exclude icon image required on hover of cursor
 * @param {Object} props features required data.
 * @returns {String} Icon name.
 */
const _excludeIcon = ( props ) => {
    let selectionImage = '';
    if ( props.value.selectionState !== 2 && props.value.allowedSelectionStates.includes( 2 ) ) {
        selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_EXCLUDE_CHECKBOX;
    }
    return selectionImage;
};

/**
 * Helps to get selection icon for feature selection.
 * @param {Number} selectionState - selection state on feature.
 * @param {Boolean} isGuidedMode True for guided else false.
 * @param {Boolean} isBoolean True for boolean else false.
 * @param {Boolean} isSingleSelect True for single select else false.
 * @returns {String} Represents icon name
 */
const textSelectionIcon = ( selectionState, isGuidedMode, isBoolean, isSingleSelect ) => {
    let selectionImage = '';
    if( selectionState === 5 ) {
        selectionImage = isGuidedMode ? pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_INCLUDE_RADIO : pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_INCLUDE_CHECKBOX;
    } else if( selectionState === 9 ) {
        selectionImage = isGuidedMode ? pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_INCLUDE_RADIO : pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_INCLUDE_CHECKBOX;
    } else if( selectionState === 1 ) {
        selectionImage = isGuidedMode ? pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_INCLUDE_RADIO : pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_INCLUDE_CHECKBOX;
        if( !isSingleSelect || isBoolean ) {
            // Show checkmark for multi-select family in both guided and manual mode
            // Show checkmark for boolean option family in manual mode
            selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_INCLUDE_CHECKBOX;
        }
    } else if ( selectionState === 6 ) {
        selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_EXCLUDE_CHECKBOX;
    } else if( selectionState === 10 ) {
        selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_EXCLUDE_CHECKBOX;
    } else if( selectionState === 2 ) {
        selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_USER_EXCLUDE_CHECKBOX;
    } else if( selectionState === 0 ) {
        selectionImage = isGuidedMode ? pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_BLANK_RADIO : pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_BLANK_CHECKBOX;
        if( !isSingleSelect || isBoolean ) {
            // Show empty checkbox for multi-select family in both guided and manual mode
            // Show empty checkbox for boolean option family in manual mode
            selectionImage = pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_BLANK_CHECKBOX;
        }
    }
    return selectionImage;
};

/*
* Gets the feature name and description as per the the layout settings
* Usefull when user in same group and playing with with layout settings like switching on/off compact mode
* @param {Object} props - The props object
* @returns {Object} - featureName, featureDescription
* */
const _getFetureNameAndDescription = ( props ) => {
    let featureMetaProps = _.get( props, 'value.meta' );
    let featureName = featureMetaProps && featureMetaProps.length > 1 ? _.get( props, 'value.optValue.cellHeader1' ) + ', ' : _.get( props, 'value.optValue.cellHeader1' );
    let featureDescription = featureMetaProps && featureMetaProps.length > 1 ? featureMetaProps.slice( 2 ).join( '' ) : '';
    return { featureName, featureDescription };
};

/**
 * Gets component for text view having feature name and description as per layout settings
 * When user sets separator then display component as feature name, feature description.
 * When separator is off then feature name feature description with defined width for both component
 * @param {Object} featureWithDescriptionClass css class
 * @param {Object} props feature properties
 * @returns {HTMLElement} feature component with name and description
 */
const _featureAndDescriptionComponent = ( featureWithDescriptionClass, props ) => {
    const { featureName, featureDescription } = _getFetureNameAndDescription( props );
    return (
        <>
            {
                <div className={featureWithDescriptionClass} title={featureName + featureDescription}>
                    <span className='aw-cfg-valueLabel' displayval={featureName} >
                        {featureName}
                    </span>
                    <span className='aw-cfg-fscItalicText'>
                        { featureDescription }
                    </span>
                </div>
            }
        </>
    );
};

/**
 * Updates the selection icons.
 * @param {Object} props - The props object
 * @param {Object} featureData - The feature data
 * @returns {Object} - result
 */
export const updateIcon = ( props, featureData ) => {
    const isGuidedMode = _.get( props, 'family.familyCmdContext.guidedMode' );
    const selectionState = featureData.selectionState ? featureData.selectionState : 0;

    const isBoolean = props.family && props.family.familyType === 'Boolean';
    const isSingleSelect = props.family && props.family.singleSelect;
    return textSelectionIcon( selectionState, isGuidedMode, isBoolean, isSingleSelect );
};

/**
 * Renders text UI for feature component
 * @param {Object} props features props
 * @param {Object} keyPressed enter key action
 * @param {HTMLElement} selectionImgIcon icon/image for selection
 * @param {Boolean} showEnumeratedRange show enum range expression
 * @returns {HTMLElement} text component representing feature
 */
const renderTextFeature = ( props, keyPressed, selectionImgIcon, showEnumeratedRange ) => {
    const { actions, viewModel } = props;
    const { featureData } = viewModel;
    const selectionClass = props.family.isReadOnly ? 'aw-cfg-fscTextIcon aw-cfg-readOnlyFamily' : 'aw-cfg-fscTextIcon';
    const violationMsg = _.get( props, 'value.violationsInfo.violationMessage' ) ? props.value.violationsInfo.violationMessage : '';
    const isUnconfiguredIndicatorTooltip = _.get( props, 'value.isUnconfiguredIndicatorTooltip' ) ? props.value.isUnconfiguredIndicatorTooltip : '';
    const configuredOutIndicator = props.value.optValue.uid === '_unconfiguredFeature_' ? <AwIcon iconId='indicatorConfiguredOut'></AwIcon> : <></>;
    const violationIndicator = _getViolationIndicator( featureData );
    let featureWithDescriptionClass = 'aw-cfg-featureAndDescription';
    const excludeIcon = _excludeIcon( props );
    let violationIndicatorClass = _.get( props, 'value.optValue.indicators', [] ).length > 0 ?
        'aw-cfg-fscTextIcon aw-cfg-violationIndicator aw-cfg-fsc-freeFormIndicatorBar' : 'aw-cfg-fscTextIcon';
    // Keeping code commented as waiting for UX approval for newly added system icons
    // const systemSelectionindicator = _getSystemSelectionIndicator( props );
    let systemTextIndicator = _getSystemTextIndicator( props.value.selectionState );

    return (
        // aw-widgets-cellListItemContainer this class added for atdd support only no other use
        <div className='aw-widgets-cellListItemContainer aw-cfg-textFeatureHeight'>
            <div className={'sw-row'} role='button' tabIndex='0'  onClick={actions.handleValueClick} onKeyDown={keyPressed}>
                <div className={selectionClass} title={systemTextIndicator} >
                    <Pca0FscValueIcon icon={selectionImgIcon}></Pca0FscValueIcon>
                </div>
                { _featureAndDescriptionComponent( featureWithDescriptionClass, props ) }
                { props.value.isEnumeratedRangeExpr  &&
                        <AwCellCommandBar alignment='HORIZONTAL'
                            className='aw-cfg-freeformCommandBar aw-cfg-freeFormCommandBar aw-cfg-enumeratedFeatureCommandBar'
                            anchor='enumeratedFeatureCommandBar'
                            context={{ family:props.family, value:props.value, famIndex: props.family.famIndex,
                                index: props.value.featureIndex, configPerspectiveUid: props.family.familyCmdContext.configPerspectiveUid, showEnumeratedRange:  showEnumeratedRange }} >
                        </AwCellCommandBar>
                }
                {props.value.isPackage && props.variantcontext === 'fscContext' &&
                        <AwCellCommandBar alignment='HORIZONTAL'
                            anchor='aw_fscShowPackage'
                            className='aw-cfg-freeFormCommandBar'
                            context={{ packageFamily:props.family, packageValue:props.value,  configPerspectiveUid: props.family.familyCmdContext.configPerspectiveUid,
                                packageDialogAction: actions.packageDialogAction  }} >
                        </AwCellCommandBar>
                }
                {/* { systemSelectionindicator && <div title={systemTextIndicator} className='aw-cfg-fscTextIcon aw-cfg-showIndicator sw-visual-indicator'> { systemSelectionindicator } </div> } */}
                {
                    <div className='aw-cfg-fscTextIcon aw-cfg-showIndicator sw-visual-indicator aw-cfg-iconToEnd' title={isUnconfiguredIndicatorTooltip}>
                        {configuredOutIndicator}
                    </div>
                }
                {
                    <div className={violationIndicatorClass} title={violationMsg}> { violationIndicator } </div>
                }
                {/* To keep order of indicator and package command and hover negation*/}
                {<div className={selectionClass + ' aw-cfg-fscHidden'}
                    onClick={ ( e ) => { e.stopPropagation(); actions.handleExcludeIconClick();  }} >
                    <Pca0FscValueIcon icon={excludeIcon}></Pca0FscValueIcon>
                </div>
                }
            </div>
        </div>
    );
};

const textValChangeToDebounce = _.debounce( ( actions ) => {
    actions.textValueChanged(  );
}, 800 );
/**
 * Helps to create component required to render freeform feature
 * @param {Object} props component props
 * @param {Function} keyPressed function to handle the key pressed actions
 * @param {HTMLElement} selectionImgIcon HTML element to render selection on freeform element
 * @param {String} isReadOnlyClass CSS class
 * @param {String} outerDivFreeFormCommandBarClass css class
 * @param {Boolean} showEnumeratedRange check to identify enumerated family
 * @returns {HTMLElement} freeform element
 */
const renderFreeForm = ( props, keyPressed, selectionImgIcon, isReadOnlyClass, outerDivFreeFormCommandBarClass, showEnumeratedRange ) => {
    const { fields, textui, actions, viewModel } = props;
    const { featureData } = viewModel;
    const tabIndex = _getFreeFormTabIndex( featureData );
    let timeOutId = '';
    // Handler for input change
    const handleInputChange = ( ) => {
        clearTimeout( timeOutId );
        timeOutId = setTimeout( () => {
            handleFocusChange( );
        }, 1500 );
    };
    const handleFocusChange = ( ) => {   // Handler for focus change
        clearTimeout( timeOutId );
        textValChangeToDebounce( actions );
    };

    const violationIndicator = _getViolationIndicator( featureData );
    const outerDivFreeFormClass = isReadOnlyClass ? 'sw-property-val' + ' ' + isReadOnlyClass : 'sw-property-val';
    const freeFormStyleClass = _getFreeFormClasses( featureData );
    const outerDivFreeFormCheckBoxClass = isReadOnlyClass ? freeFormStyleClass + ' ' + isReadOnlyClass : freeFormStyleClass;
    outerDivFreeFormCommandBarClass = textui ? 'aw-cfg-freeFormCommandBar' : outerDivFreeFormCommandBarClass;
    const excludeIcon = _excludeIcon( props );
    let systemTextIndicator = _getSystemTextIndicator( props.value.selectionState );

    return (
        // FIXME for className={freeFormIconClass}, className='aw-cfg-fscOptionValueCell', visible non interactive elements with
        // click handler must have at least one keyboard listener, Static HTML elements with event handlers require a role
        <div className='aw-widgets-cellListItemContainer aw-cfg-freeFormFeatureHeight'>
            <div className='sw-row'>
                <div className={outerDivFreeFormCheckBoxClass + ' aw-cfg-fscTextIcon'} title={systemTextIndicator} tabIndex={tabIndex} role='button' onKeyDown={ keyPressed }  onClick={actions.handleValueClick}   >
                    <Pca0FscValueIcon icon={selectionImgIcon}></Pca0FscValueIcon>
                </div>
                <div className={ textui ? 'aw-cfg-freeFormSection' : 'aw-cfg-freeFormSection'}>
                    <div className='sw-column aw-default-cell aw-cfg-fscOptionValueCell'>
                        <div className={outerDivFreeFormClass}>
                            {props.family.familyType !== 'Date' &&
                              <AwTextBox {...fields.textValue} className={ !textui && 'aw-cfg-freeFormWidget' }
                                  onSwChange={ handleInputChange}
                                  blurAction={ handleFocusChange }
                                  onClick={ ( e ) => { e.stopPropagation(); }}></AwTextBox>

                            }
                            { props.family.familyType === 'Date' && !props.value.isDateRangeExpr &&
                                  <AwDate  {...Object.assign( {}, fields.dateValue, { autoComplete:'off' } )} className={ !textui && 'aw-cfg-freeFormWidget aw-cfg-freeFormDate' }  ></AwDate>
                            }
                            {
                                props.family.familyType === 'Date' && props.value.isDateRangeExpr &&
                                <AwTextBox {...fields.textValue} className={ !textui && 'aw-cfg-freeFormWidget' }
                                    onSwChange={ handleInputChange}
                                    blurAction={ handleFocusChange }
                                    onClick={ ( e ) => { e.stopPropagation(); }}></AwTextBox>
                            }
                        </div>
                        <AwCellCommandBar alignment='HORIZONTAL' className={_.isNull( outerDivFreeFormCommandBarClass ) ? 'aw-cfg-freeformCommandBar' : outerDivFreeFormCommandBarClass} anchor='freeFormFeatureCommandBar' context={{  family:props.family, value:props.value,  famIndex: props.family.famIndex, index: props.value.featureIndex,  configPerspectiveUid: props.configuid,  showEnumeratedRange:  showEnumeratedRange }} >
                        </AwCellCommandBar>
                        <div className='aw-cfg-fscTextIcon aw-cfg-iconToEnd'>
                            {props.value.violationsInfo !== undefined &&
                            <div className='aw-cfg-fsc-freeFormIndicatorBar' title={props.value.violationsInfo.violationMessage}>
                                {   violationIndicator }
                            </div>}
                        </div>
                    </div>
                    {
                        <div className={'aw-cfg-fscTextIcon aw-cfg-fscHidden aw-cfg-fscExcludeFeatureIcon'}
                            onClick={ ( e ) => { e.stopPropagation(); actions.handleExcludeIconClick();  }} >
                            <Pca0FscValueIcon icon={excludeIcon}></Pca0FscValueIcon>
                        </div>
                    }
                </div>
            </div>
        </div>
    );
};

/**
 * Helps to render text based feature component
 * @param {Object} props - details of features required to render text component
 * @param {Object} keyPressed - Keypressed action
 * @param {String} selectionImgIcon - Name of icon
 * @param {Boolean} showEnumeratedRange  - True if enumerated feature else false.
 * @param {String} isReadOnlyClass - Css class name for readonly feature
 * @param {String} outerDivFreeFormCommandBarClass - CSS class
 * @param {String} violationStyle - CSS class name for violation styling
 * @param {Object} featureData - feature data
 * @param {Object} itemRef - reference of item
 * @returns {HTMLElement} Render Text component
 */
const renderTextComponent = ( props, keyPressed, selectionImgIcon, showEnumeratedRange, isReadOnlyClass, outerDivFreeFormCommandBarClass, violationStyle, featureData, itemRef ) => {
    const classStyle = props.family.isFreeForm ? violationStyle + ' aw-cfg-fscValueNoThumbnail aw-cfg-textFreeForm' : violationStyle + ' aw-cfg-fscValueNoThumbnail';
    return (
        <div className={classStyle } title={ props.family.isFreeForm ? featureData.dbValue : props.value.optValue.cellHeader1 } ref={itemRef}>
            { props.family.isFreeForm === false && !props.value.isFreeFormFeature && renderTextFeature( props, keyPressed, selectionImgIcon, showEnumeratedRange )}
            { props.family.isFreeForm === true && renderFreeForm( props, keyPressed, selectionImgIcon, isReadOnlyClass, outerDivFreeFormCommandBarClass, showEnumeratedRange )}
            { props.value.isPackage && <AwDialog action={props.actions.packageDialogAction}></AwDialog> }
        </div>
    );
};

/**
 * Sets the selection state for text free form features like ( int, float, string )
 * @param {Object} featureData feature data
 * @param {Object} props props for component
 * @param {Object} textData text component
 * @returns {Object} - newFeatureData, newTextData
 */
export const setSelectionState = ( featureData, props, textData ) => {
    let newFeatureData = _.isEmpty( featureData ) ? props.value : featureData; // this may come before initial render
    const newTextData = textData;
    const oldOptValueStr = featureData.optValueStr;
    newFeatureData.error = _validateFreeFormTextBox( props, textData.dbValue );

    if( !newFeatureData.error && textData.dbValue && newFeatureData.dbValue !== textData.dbValue ) {
        newFeatureData.dbValue = textData.dbValue;
        newFeatureData.dispValue = textData.dbValue;
        newFeatureData.uiValue = textData.dbValue;
        newFeatureData.value = textData.dbValue;
        newFeatureData.optValueStr = props.family.familyStr + ':' + textData.dbValue;
        newFeatureData.selectionState = 1;
        newFeatureData = select( newFeatureData, props, true, 1, oldOptValueStr );
        return { newFeatureData, newTextData };
    }
    newTextData.error = newFeatureData.error;
    return { newFeatureData, newTextData };
};

/**
 * Returns update date value
 * @param {*} featureData feature data
 * @param {*} props props
 * @param {*} dateComponent date component with uiValue and dbValue
 * @returns {Object} - newFeatureData
 */
export const dateValueChange = ( featureData, props, dateComponent ) => {
    const newDate = dateComponent.dbValue;
    const dateCopy = dateComponent;
    let featureDataCopy = _.isEmpty( featureData ) ? props.value : featureData;
    const oldOptValueStr = props.value.optValueStr;
    const isSameDate = dateComponent.uiValue === props.value.uiValue;

    if( props.value.isFreeFormFeature && props.value.type === 'DATE' && !props.value.error ) {
        if( newDate && !isNaN( dateComponent.dbValue ) && !isSameDate && !featureDataCopy.isDateRangeExpr ) {
            featureDataCopy.dbValue = newDate ? getFormattedDateString( new Date( newDate ) ) : '';
            featureDataCopy.uiValue = dateTimeService.formatDate( newDate );
            featureDataCopy.dateApi = dateCopy.dateApi;
            featureDataCopy.valueDisplayName = dateTimeService.formatDate( newDate );
            featureDataCopy.optValueStr = props.family.familyStr + ':' + featureDataCopy.dbValue;
            featureDataCopy = select( featureDataCopy, props, true, 1, oldOptValueStr );
        } else if( props.value.selectionState === 1 && props.value.dateApi.dateValue === '' ) {
            featureDataCopy = select( featureDataCopy, props, true, 0, oldOptValueStr );
        }
    }
    return featureDataCopy;
};

/**
 * Handles the click on the fsc value element.
 * @param {Object} data - The props object
 * @param {Object} props - The props object
 * @param {Number} selectionState - state to set on feature
 * @returns {Object} - result
 */
export let handleValueClick = function( data, props, selectionState ) {
    if( 'fscContext' === props.variantcontext && 'selectFeature' === props.valueaction ) {
        eventBus.publish( 'Pca0Configurator.closeDialog' );
    }
    return { ...select( data.featureData, props, true, selectionState ) };
};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FscValueRenderFunction = ( props ) => {
    const { actions, textsettings, textui, viewModel, keyValue, itemRef } = props;
    let { featureData } = viewModel;
    if ( _.isEmpty( featureData ) && props.family.isFreeForm ) {
        return <></>;
    } else if ( _.isEmpty( featureData ) || !textsettings.showCompressedData && _.isUndefined( featureData.optValue.typeIconURL ) ) {
        featureData = props.value;
    }
    const isGuidedMode = _.get( props, 'family.familyCmdContext.guidedMode' );
    const keyPressed = function( event ) {
        if( event.key === 'Enter' ) {
            actions.handleValueClick();
        }
    };
    let featureWidthClass = '';
    if ( textsettings.showFeatureSideBySide && _.get( textsettings, 'featureWidth' ) === 'small' ) {
        featureWidthClass += ' aw-cfg-smallWidth';
    } else if ( textsettings.showFeatureSideBySide && _.get( textsettings, 'featureWidth' ) === 'medium' ) {
        featureWidthClass += ' aw-cfg-mediumWidth';
    } else if ( textsettings.showFeatureSideBySide && _.get( textsettings, 'featureWidth' ) === 'large' ) {
        featureWidthClass += ' aw-cfg-largeWidth';
    } else {
        featureWidthClass += ' aw-cfg-completeWidth';
    }
    const violationStyle = _getFeatureViolationStyleClasses( featureData, featureWidthClass );
    const isReadOnlyClass =  props.family.isReadOnly ? 'aw-cfg-readOnlyFamily' : '';
    const outerDivFreeFormCommandBarClass = isReadOnlyClass ? isReadOnlyClass + ' aw-cfg-freeformCommandBar' : 'aw-cfg-freeformCommandBar';
    const outerDivPackageCommandBarClass = isReadOnlyClass ? 'aw-cfg-packageInfoCommand' + ' ' + isReadOnlyClass : 'aw-cfg-packageInfoCommand';
    const outerDivNonFreeFormCheckBoxClass = isReadOnlyClass ? 'aw-cfg-fscSelectedImageThumbnail' + ' ' + isReadOnlyClass : 'aw-cfg-fscSelectedImageThumbnail';
    const selectionImgIcon = exports.updateIcon( props, featureData );
    let systemTextIndicator = _getSystemTextIndicator( props.value.selectionState );
    const showEnumeratedRange = !isGuidedMode;
    const updateVMO = { ...featureData.optValue };

    const renderNonFreeForm = () => {
        const excludeIcon = _excludeIcon( props );
        return (
            <div className='aw-widgets-cellListItemContainer aw-cfg-nonFreeFormFeatureHeight sw-aria-border' role='button' tabIndex='0'  onClick={actions.handleValueClick} onKeyDown={keyPressed}>
                <div className='aw-cfg-fscValueThumbnail sw-component sw-row' >
                    <div className={outerDivNonFreeFormCheckBoxClass + ' aw-cfg-fscTextIcon'} title={systemTextIndicator} >
                        <Pca0FscValueIcon icon={selectionImgIcon}></Pca0FscValueIcon>
                    </div>
                    <div className='sw-row aw-default-cell aw-cfg-fscOptionValueCell' >
                        <AwDefaultCell vmo={updateVMO} >
                        </AwDefaultCell>
                    </div>
                    { props.value.isEnumeratedRangeExpr &&
                        <AwCellCommandBar
                            alignment='HORIZONTAL'
                            className={outerDivFreeFormCommandBarClass}
                            anchor='enumeratedFeatureCommandBar'
                            context={{  family:props.family, value:featureData, famIndex: props.family.famIndex, index: props.value.index, showEnumeratedRange:  showEnumeratedRange }} >
                        </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'fscContext'   &&
                        <AwCellCommandBar
                            alignment='HORIZONTAL'
                            className={outerDivPackageCommandBarClass}
                            anchor='aw_fscShowPackage'
                            context={{  packageFamily:props.family, packageValue:featureData, configPerspectiveUid: props.family.familyCmdContext.configPerspectiveUid,
                                packageDialogAction: actions.packageDialogAction }} >
                        </AwCellCommandBar>
                    }
                    {props.value.isPackage && props.variantcontext === 'variantConfigContext'   &&
                        <AwCellCommandBar
                            alignment='HORIZONTAL'
                            className={outerDivPackageCommandBarClass}
                            anchor='aw_showPackageWithTile'
                            context={{ packageValue: featureData, packageFamilyUID: props.family.familyStr,
                                singleselectect: props.family.singleSelect, configPerspectiveUid:props.configuid, packageDialogAction: actions.packageDialogAction }} >
                        </AwCellCommandBar>
                    }
                    {<div className={'aw-cfg-fscTextIcon aw-cfg-fscHidden aw-cfg-fscExcludeFeatureIcon'}
                        onClick={ ( e ) => { e.stopPropagation(); actions.handleExcludeIconClick();  }} >
                        <Pca0FscValueIcon icon={excludeIcon}></Pca0FscValueIcon>
                    </div>}
                </div>
            </div>
        );
    };

    if( props.value && props.value.isFiltered ) {
        if( textsettings && textsettings.showCompressedData ) {
            return renderTextComponent( props, keyPressed, selectionImgIcon, showEnumeratedRange, isReadOnlyClass, outerDivFreeFormCommandBarClass, violationStyle, featureData, itemRef );
        }
        return (
            <div className={violationStyle} title={ props.family.isFreeForm ? featureData.dbValue : updateVMO.cellHeader1} key={keyValue}
                id={keyValue}
                ref={itemRef}>
                { props.family.isFreeForm === false && renderNonFreeForm()}
                { props.family.isFreeForm === true && renderFreeForm( props, keyPressed, selectionImgIcon, isReadOnlyClass, outerDivFreeFormCommandBarClass, showEnumeratedRange )}
                { props.value.isPackage && <AwDialog action={props.actions.packageDialogAction}></AwDialog> }
            </div>
        );
    }
};

/**
 * Intializes the feature component data
 * @param {Object} textValueData textComponent data
 * @param {Object} dateValueData dateComponent data
 * @param {Object} props props
 * @returns { Object } - feature data, textValueData, dateValueData
 */
export const initFeatureComponentData = ( textValueData, dateValueData, props ) => {
    const featureData = props.value;
    const textValueCopy = textValueData;
    const dateValueCopy = dateValueData;
    if( props.value.isDateRangeExpr || props.family.familyType !== 'Date' && props.family.isFreeForm ) {
        textValueCopy.value = props.value.isDateRangeExpr ? featureData.dateApi.dateValue : featureData.dbValue;
        textValueData.dbValue = props.value.isDateRangeExpr ? featureData.dateApi.dateValue : featureData.dbValue;
        textValueData.uiValue = props.value.isDateRangeExpr ? featureData.dateApi.dateValue : featureData.dbValue;
        textValueCopy.error = featureData.validationCriteria ? featureData.validationCriteria : undefined;
    } else if( props.family.familyType === 'Date' && props.family.isFreeForm ) {
        dateValueCopy.value = new Date( props.value.uiValue );
        dateValueCopy.error = featureData.validationCriteria ? featureData.validationCriteria : undefined;
        dateValueCopy.dbValue = new Date( props.value.uiValue );
        dateValueCopy.uiValue = featureData.uiValue;
    }
    return { textValue: textValueCopy, dateValue: dateValueCopy, value: featureData };
};

export default exports = {
    updateIcon,
    dateValueChange,
    handleValueClick,
    setSelectionState,
    pca0FscValueRenderFunction,
    initFeatureComponentData
};
