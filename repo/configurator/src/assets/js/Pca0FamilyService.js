// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0FamilyService
 *
 * @module js/Pca0FamilyService
 */

// COMPONENT IMPORTS
import AwIcon from 'viewmodel/AwIconViewModel';
import AwIconButton from 'viewmodel/AwIconButtonViewModel';

//LIB IMPORTS
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import _ from 'lodash';

let exports = {};

const localeTextBundle = localeService.getLoadedText( 'FullScreenConfigurationMessages' );

/**
 * Get allowed range component
 * @param {String} allowedRange - allowed range text
 * @returns {HTMLElement} To render allowed range
 */
const _allowedRangeComponent = ( allowedRange ) => {
    const allowedRangeText = localeTextBundle.allowedRange;
    return  <div className='aw-cfg-rangeInfo aw-cfg-fscFamilyText'>
        <span className='aw-widgets-propertyLabel'>{allowedRangeText} </span>
        <span>{allowedRange}</span>
    </div>;
};

/**
 * Helps to get family level selections
 * @param {Object} family - Family level object
 * @param {Object} fields - Holds component details
 * @param {Boolean} isAnySelected - If select any feature
 * @param {Boolean} isNoneSelected - If select no features
 * @returns {HTMLAllCollection} Component list
 */
const familyPresentor = ( family, fields, isAnySelected, isNoneSelected ) => {
    let selectAnyComponent = null;
    let selectNoneComponent = null;
    let addFeatureComponent = null;
    let unconfiguredComponent = null;
    const isBooleanFamily = family.familyType === 'Boolean';
    const isOptionalFamily = family.cfg0IsDiscretionary;
    const { selectAny, selectNone, addFeature, unconfiguredFamily } = fields;
    const allowedFamilySelection = family.allowedSelectionStates === 2;
    const selectedComponentClass = 'aw-state-selected';
    selectAny.fielddata.tooltip = localeTextBundle.selectAny;
    selectAny.fielddata.uiValue = localeTextBundle.selectAny;
    selectAny.fielddata.uiValues = [ localeTextBundle.selectAny ];
    selectNone.fielddata.tooltip = localeTextBundle.selectNone;
    selectNone.fielddata.uiValue = localeTextBundle.selectNone;
    selectNone.fielddata.uiValues = [ localeTextBundle.selectNone ];
    addFeature.fielddata.tooltip = localeTextBundle.addFeature;
    addFeature.fielddata.uiValue = localeTextBundle.addFeature;
    addFeature.fielddata.uiValues = [ localeTextBundle.addFeature ];
    unconfiguredFamily.fielddata.tooltip = localeTextBundle.isUnconfigured;
    unconfiguredFamily.fielddata.uiValue = localeTextBundle.isUnconfigured;
    unconfiguredFamily.fielddata.uiValues = [ localeTextBundle.isUnconfigured ];

    if ( !family.familyCmdContext.guidedMode && !isBooleanFamily && isOptionalFamily && family.singleSelect ) {
        selectAnyComponent = <AwIconButton id='Pca0FamilySelectionForAny' command={selectAny} className={ isAnySelected ? selectedComponentClass : ''}></AwIconButton>;
        selectNoneComponent = <AwIconButton id='Pca0FamilySelectionForNone' command={selectNone} className={ isNoneSelected ? selectedComponentClass : ''}></AwIconButton>;
    }
    if ( allowedFamilySelection && _.isNull( selectNoneComponent ) ) {
        selectNoneComponent = <AwIconButton id='Pca0FamilySelectionForNone' command={selectNone} className={ isNoneSelected ? selectedComponentClass : ''}></AwIconButton>;
    }
    if ( !family.familyCmdContext.guidedMode && ( family.isFreeForm || family.familyType === 'Integer' || family.familyType === 'Floating Point' || family.familyType === 'Date' ) ) {
        addFeatureComponent = <AwIconButton id='Pca0AddFreeFormRange' command={addFeature}></AwIconButton>;
    }
    if ( family.isUnconfigured ) {
        unconfiguredComponent = <AwIconButton id='Pca0IsFamilyUnConfigured' command={unconfiguredFamily}></AwIconButton>;
    }
    return { selectAnyComponent, selectNoneComponent, addFeatureComponent, unconfiguredComponent };
};

/**
 * Get family system indicators
 *
 * @param {Object} family - Family object
 * @returns {Object} - Returns family system indicators
 */
const getFamilySystemIndicators = ( family ) => {
    let requiredFamilyIndicator = !family.complete ? <div className='aw-cfg-requiredFamilyIndicator'>*</div> : null;
    const isAnySelected = family.selectionState === 1 || family.selectionState === 5 || family.selectionState === 9;
    const isNoneSelected = family.selectionState === 2 || family.selectionState === 6 || family.selectionState === 10;
    const defaultSelectedFamily = family.selectionState === 5 || family.selectionState === 6;
    const systemSelectedFamily = family.selectionState === 9 || family.selectionState === 10;
    const defaultFamilySelectionIcon = <AwIcon iconId='indicatorDefaultSelection' className='aw-cfg-familyIndicatorIcon'></AwIcon>;
    const systemFamilySelectionIcon = <AwIcon iconId='indicatorSystemSelection' className='aw-cfg-familyIndicatorIcon'></AwIcon>;
    return { requiredFamilyIndicator, isAnySelected, isNoneSelected, defaultSelectedFamily, systemFamilySelectionIcon, defaultFamilySelectionIcon, systemSelectedFamily };
};

/**
 * Get family details
 * @param {Object} family - Family object
 * @param {Object} fields - Holds component details
 * @returns {HTMLElement} - Returns View
 */
const getFamilyDetails = ( family, fields ) => {
    const classes = family.isHighlighted ? ' aw-cfg-familyHighlightedForCompletenessCheck' : '';
    let caption = family.meta && family.meta.length > 1 ? family.meta[0] + ',' : family.meta[0];
    if ( _.isEmpty( caption ) || _.isNil( caption ) ) {
        caption = family.familyDisplayName;
    }
    const familyMeta = family.meta.slice( 2 ).join('');
    const isFamilyCollapsed = family.isCollapsed;
    const allowedRangeComponent = family.allowedRange ? _allowedRangeComponent( family.allowedRange ) : null;
    const { requiredFamilyIndicator, isAnySelected, isNoneSelected, defaultSelectedFamily, systemFamilySelectionIcon, defaultFamilySelectionIcon, systemSelectedFamily }
        = getFamilySystemIndicators( family );
    const { selectAnyComponent, selectNoneComponent, addFeatureComponent, unconfiguredComponent }
        = familyPresentor( family, fields, isAnySelected, isNoneSelected );
    return<>
        <details
            className={`sw-section aw-panelSection flex-shrink align-self-stretch afx-content-background aw-cfg-familySection${classes}`}
            caption={caption}
            data-locator={'titlekey-' + caption}
            open={!isFamilyCollapsed}
            onToggle={ ( eventData ) => eventBus.publish( 'Pca0Family.toggleFamily', { isCollapsed: _.get( eventData, 'nativeEvent.newState' ) === 'closed', caption: caption } ) }>
            <summary
                role='button'
                tabIndex={-1} className='aw-cfg-fscDiv sw-column sw-panel-summary aw-layout-collapsiblePanelSectionTitle collapsible'>
                <div className='sw-row sw-sectionTitleContainer'>
                    <div className='sw-sectionTitle' title={caption}>{caption}</div>
                    { familyMeta && <div className='aw-cfg-familyMetaData aw-cfg-fscItalicText'>{familyMeta}</div> }
                    <div>
                        { requiredFamilyIndicator }
                    </div>
                    <div className='aw-cfg-familyMetaData aw-cfg-familyIndicatorIcon'>
                        { defaultSelectedFamily && defaultFamilySelectionIcon }
                        { systemSelectedFamily && systemFamilySelectionIcon }
                    </div>
                    <div className='sw-row aw-cfg-fscSectionActions'>
                        { addFeatureComponent }
                        { family.isUnconfigured && unconfiguredComponent }
                        { isAnySelected && selectAnyComponent }
                        { isNoneSelected && selectNoneComponent }
                        { !isAnySelected && selectAnyComponent }
                        { !isNoneSelected && selectNoneComponent }
                    </div>
                </div>
            </summary>
            {!family.singleSelect && !family.familyCmdContext.guidedMode && <div className='aw-cfg-fscFamilyText aw-cfg-multiSelectMessage'>{localeTextBundle.aw_multi_select_message}</div>}
            { allowedRangeComponent }
        </details>
    </>;
};

/**
 * Function to render family component with details tag
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FamilyRenderFunction = ( props ) => {
    let { family, fields } = props;
    return getFamilyDetails( family, fields );
};

/**
 * Updates selection on family level in text mode.
 * @param {Object} family family details
 * @param {Number} famIndex family index in VMO array
 * @param {String} configuid uid of perspective
 * @param {Boolean} selectAny if user selects on any then true else false
 */
export const updateFamilySelection = ( family, famIndex, configuid, selectAny ) => {
    const familyCmdContext = { family:family, famIndex: famIndex, showEnumeratedRange:  !family.familyCmdContext.guidedMode, configPerspectiveUid: configuid  };
    if ( selectAny ) {
        eventBus.publish( 'Pca0Features.setAnySelectionForFamily', { commandContext: familyCmdContext } );
    } else {
        eventBus.publish( 'Pca0Features.setNoneSelectionForFamily', { commandContext: familyCmdContext } );
    }
};

/**
 * Helps to open range dialog as per user selection in free form or enumerated family in text mode.
 * @param {Object} family selected family details
 * @param {Number} famIndex family index in VMO array
 * @param {String} variantcontext context name like 'fscContext'
 * @param {String} configuid uid of context
 */
export const openRangeDialog = ( family, famIndex, variantcontext, configuid ) => {
    const familyCmdContext = { family:family, famIndex: famIndex, showEnumeratedRange:  !appCtxSvc.getCtx( variantcontext ).guidedMode, configPerspectiveUid: configuid  };
    if ( family.isFreeForm ) {
        eventBus.publish( 'Pca0Features.addInlineFreeFormFeature', { commandContext: familyCmdContext } );
    } else {
        const popupAction = appCtxSvc.getCtx( 'globalDialog' );
        const inputData =  {
            options: {
                global: true,
                view: 'Pca0AddRangeFeaturePanel',
                placement: 'right',
                parent: '.aw-layout-workarea',
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false,
                isPinUnpinEnabled: true,
                subPanelContext: {
                    sourceID: 'fscFreeFormRangeExpPanel',
                    commandContext: familyCmdContext,
                    contextKey: 'fscContext',
                    enumeratedMode: true
                }
            }
        };
        popupAction.show( inputData.options );
    }
};

export default exports = {
    pca0FamilyRenderFunction,
    updateFamilySelection,
    openRangeDialog
};
