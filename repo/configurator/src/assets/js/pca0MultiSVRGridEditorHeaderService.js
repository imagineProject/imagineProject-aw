// Copyright (c) 2024 Siemens

/**
 * @module js/pca0MultiSVRGridEditorHeaderService
 */

import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import { getBaseUrlPath } from 'app';
import configuratorUtils from 'js/configuratorUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0RendererService from 'js/pca0RendererService';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};


/**
 * Util to highlight the background color of grid header cell
 * maria: todo move to common
 * @param {Object} vmVariabilityProps - atomic data <variabilityProps>
 */
export let colorifyMultiSVRHeaderCells = ( vmVariabilityProps ) => {
    let variabilityProps = vmVariabilityProps.value ? { ...vmVariabilityProps.getValue() } : { ...vmVariabilityProps.getAtomicData() };
    let headersToColor = [ ...variabilityProps.dirtyElements, ...variabilityProps.newVariants ];
    headersToColor.forEach( dirtyCol => {
        let col = variabilityProps.columnProperties.find( column => column.propertyName === dirtyCol );
        if( col ) {
            pca0RendererService.colorifyHeaderCell(
                col.propertyDisplayName, // titleName
                veConstants.MULTI_SVR_GRID_HEADER_CELL_NOTIFY, // color className
                veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID // grid id
            );
        }
    } );
};

/**
 * Clear column headers color for all columns
 * @param {Object} variabilityPropsData variabilityPropsData
 */
export let unColorifyMultiSVRHeaderCells = function( variabilityPropsData ) {
    variabilityPropsData.columnProperties.forEach( column => {
        //newVariants will always stay colored until saved
        if ( !variabilityPropsData.newVariants.includes( column.propertyName ) ) {
            pca0RendererService.unColorifyHeaderCell(
                column.propertyDisplayName, // titleName
                pca0Constants.AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY, // blue color className,
                veConstants.GRID_CONSTANTS.MULTIPLE_SVR_GRID_ID // grid id
            );
        }
    } );
};

/**
 * This method show the violationInfo in the header
 * @param {Object} eventData - The eventData with completeness status needed to be set in summary view
 * @param {Object} column - column, the SVR
 * @returns {Object} completenessStatus - id and i18n string
 * */
export let showViolationInfo = ( eventData, column  ) => {
    var severity = 'error';
    let tooltipIconUrl = '';
    if ( column !== eventData.currentSVRUid ) {
        return {
            violationLabel: '',
            violationMessages: [],
            severity: '',
            tooltipInfo: { tooltipIconUrl: '' }
        };
    }
    var violationMessages = [];
    if ( eventData && eventData.summaryViolationsInfo !== undefined ) {
        //error - the highest severity wins
        if ( _.get( eventData.summaryViolationsInfo, 'error.length' ) > 0 ) {
            severity = 'error';
        } else if ( _.get( eventData.summaryViolationsInfo, 'warning.length' ) > 0 ) {
            severity = 'warning';
        } else {
            severity = 'info';
        }
        let arrayOfViolations = [ ...eventData.summaryViolationsInfo[pca0Constants.ERROR_SEVERITIES.ERROR], ...eventData.summaryViolationsInfo[pca0Constants.ERROR_SEVERITIES.WARNING] ];
        arrayOfViolations = [ ...arrayOfViolations, ...eventData.summaryViolationsInfo[pca0Constants.ERROR_SEVERITIES.INFO] ];

        _.forEach( arrayOfViolations, function( violation ) {
            let violationMessage = violation.violationMessage;
            if ( violation.moduleHierarchyPath ) {
                let newViolationMessage = configuratorUtils.buildViolationMessageWithModuleHierarchyPath( violation.moduleHierarchyPath, violationMessage );
                violationMessage = newViolationMessage;
            }
            violationMessages.push( { message: violationMessage, icon: violation.violationSeverity } );
        } );
    }
    let violationLabel = '';
    if ( eventData ) {
        //only show the NoViolations if there was a validate/expand action, otherwise the defualt is ''
        violationLabel = configuratorUtils.getCustomConfigurationLocaleTextBundle().noViolations;
        if ( eventData.CompletenessStatus !== undefined ) {
            let localeBundle = configuratorUtils.getFscLocaleTextBundle();
            switch ( eventData.CompletenessStatus.completenessStatusId ) {
                case 'InValid':
                    violationLabel = localeBundle.invalidStatus;
                    break;
                case 'ValidAndInComplete':
                    violationLabel = localeBundle.validAndInCompleteStatus;
                    break;
                case 'ValidAndComplete':
                    violationLabel = localeBundle.validAndCompleteStatus;
                    break;
                default:
                    break;
            }
        }
    }
    return {
        violationLabel: violationLabel,
        violationMessages: violationMessages,
        severity: severity,
        tooltipInfo: { tooltipIconUrl: tooltipIconUrl }
    };
};

/**
 * This method updates the completeness status in header
 * @param {Object} eventData - The eventData with completeness status needed to be set in summary view
 * @param {Object} column - column, the SVR
 * @returns {Object} completenessStatus - id and i18n string
 * */
export let updateCompletenessStatus = ( eventData, column ) => {
    let tooltipIconUrl = '';
    let completenessStatus = '';
    let completenessStatusLabel = '';
    let localeBundle = configuratorUtils.getFscLocaleTextBundle();
    if ( eventData && eventData.CompletenessStatus !== undefined && column === eventData.currentSVRUid ) {
        completenessStatus = eventData.CompletenessStatus.completenessStatusId;
    }
    switch ( completenessStatus ) {
        case 'InValid':
            tooltipIconUrl = getBaseUrlPath() + '/image/indicatorInvalidConfiguration16.svg';
            completenessStatusLabel = localeBundle.invalidStatus;
            break;
        case 'ValidAndInComplete':
            tooltipIconUrl = getBaseUrlPath() + '/image/indicatorValidButIncompleteConfiguration16.svg';
            completenessStatusLabel = localeBundle.validAndInCompleteStatus; //unfortunetely they all over the place in terms of notation, cannot use the key
            break;
        case 'ValidAndComplete':
            tooltipIconUrl = getBaseUrlPath() + '/image/indicatorValidConfiguration16.svg';
            completenessStatusLabel = localeBundle.validAndCompleteStatus;
            break;
        default:
            break;
    }
    return {
        completenessStatus: {
            completenessStatusId: completenessStatus
        },
        tooltipInfo: {
            tooltipIconUrl: tooltipIconUrl,
            tooltipIconText: completenessStatusLabel
        }
    };
};


export default exports = {
    colorifyMultiSVRHeaderCells,
    unColorifyMultiSVRHeaderCells,
    showViolationInfo,
    updateCompletenessStatus
};


