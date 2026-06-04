// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomAlignmentCheckPropertyRenderer
 */
import CadBomOccAlignmentCheckService from 'js/CadBomOccAlignmentCheckService';
import CadBomAlignmentCheckCellRenderer from 'js/CadBomAlignmentCheckCellRenderer';
import appCtxSvc from 'js/appCtxService';
import cbaConstants from 'js/cbaConstants';
import eventBus from 'js/eventBus';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import cbaFindAlignedService from 'js/cbaFindAlignedService';

const INDICATOR_ALIGNED = 'indicatorAssigned16.svg';
const INDICATOR_NOT_ALIGNED = 'indicatorNonAssigned16.svg';
const INDICATOR_MISSING_PART_DESIGN = 'indicatorMissingInSourceRed16.svg';
const EVENT_FIND_ALIGNED_OBJECT = 'cba.findAlignedObject';
const INDICATOR_DEFAULT = 'indicatorFindAligned16.svg';
const INDICATOR_BROKEN_CHILD = 'indicatorHelp16.svg';
const INDICATOR_CHILDREN_MISALIGNED = 'indicatorContainsInnerMismatches16.svg';
const INDICATOR_REV_AND_CHILDREN_MISALIGNED = 'indicatorBomChildrenRevisionMisaligned16.svg';
const INDICATOR_PCA_AND_CHILDREN_MISALIGNED = 'indicatorBomChildrenPartCADMisaligned16.svg';
const INDICATOR_REVISION_MISALIGNED = 'indicatorMismatch16.svg';
const INDICATOR_OCC_OUTOFSYNC = 'indicatorAlignmentBroken16.svg';

/**
 * Check if mapping UID is available for given object
 *
 * @param {string} context - Source or Target context
 * @param {object} vmo - View Model Object
 * @returns {string} - Indicator object
 */
let _isMappingUIDAvailable = function( context, vmo ) {
    let alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
    let contextAlignmentCheckInfo = alignmentCheckInfo ? alignmentCheckInfo[ context ] : null;
    if( contextAlignmentCheckInfo && contextAlignmentCheckInfo.differences ) {
        let diff = contextAlignmentCheckInfo.differences[ vmo.uid ];
        return diff && diff.mappingUids && diff.mappingUids.length > 0;
    }

    // after align we store indicator status in Find Aligned cache.
    // The Align indicator visible as a feeback of operation should show hand cursor(clickable).
    let mappingUids = cbaFindAlignedService.getIndicatorMappingUids( context, vmo );
    return mappingUids && mappingUids.length > 0;
};

/**
 * Get alignment indicator object for given status
 *
 * @param {number} status - Indicator status
 * @param {object} vmo - View Model Object
 * @param {string} context - Source or Target context
 * @returns {string} - Indicator object
 */
let _getAlignmentIndicator = function( status, vmo, context ) {
    let alignmentIndicatorObject = {};
    switch ( status ) {
        case 0:
            alignmentIndicatorObject.icon = INDICATOR_DEFAULT;
            alignmentIndicatorObject.clickEvent = EVENT_FIND_ALIGNED_OBJECT;
            alignmentIndicatorObject.intent = cbaConstants.INTENT_FIND_ALIGNED;
            break;
        case 1:
        case 3:
        case 2869:
        case 2909:
        case 2980:
        case 2985:
        case 2896:
        case 3000:
        case 3009:
        case 3024:
        case 3037:
            alignmentIndicatorObject.icon = INDICATOR_NOT_ALIGNED;
            break;
        case 4:
        case 5:
        case 7:
        case 273:
        case 284:
        case 357:
        case 359:
        case 360:
        case 377:
        case 397:
        case 485:
        case 488:
            alignmentIndicatorObject.icon = INDICATOR_ALIGNED;
            if( _isMappingUIDAvailable( context, vmo ) ) {
                alignmentIndicatorObject.clickEvent = EVENT_FIND_ALIGNED_OBJECT;
            }
            break;
        case 2:
        case 6:
        case 102:
        case 103:
        case 614:
            alignmentIndicatorObject.icon = INDICATOR_ALIGNED;
            break;
        case -1:
            alignmentIndicatorObject.icon = INDICATOR_ALIGNED;
            alignmentIndicatorObject.clickEvent = EVENT_FIND_ALIGNED_OBJECT;
            break;
        case 2000:
            alignmentIndicatorObject.icon = INDICATOR_BROKEN_CHILD;
            break;
        case 869:
            alignmentIndicatorObject = null;
            break;
        case 4000:
            alignmentIndicatorObject.icon = INDICATOR_OCC_OUTOFSYNC;
            if( _isMappingUIDAvailable( context, vmo ) ) {
                alignmentIndicatorObject.clickEvent = EVENT_FIND_ALIGNED_OBJECT;
            }
            break;
        default:
            alignmentIndicatorObject = null;
    }
    return alignmentIndicatorObject;
};

/**
 * Get alignment advance indicator object for given status
 *
 * @param {number} status - Indicator status
 * @returns {string} - Indicator object
 */
let _getAdvanceIndicator = function( status ) {
    let advanceIndicatorObject = {};
    switch ( status ) {
        case 7:
        case 101:
        case 284:
        case 357:
        case 614:
        case 2980:
        case 3037:
            advanceIndicatorObject.icon = INDICATOR_MISSING_PART_DESIGN;
            break;
        case 397:
        case 869:
        case 2869:
            advanceIndicatorObject.icon = INDICATOR_CHILDREN_MISALIGNED;
            break;
        case 488:
        case 2896:
            advanceIndicatorObject.icon = INDICATOR_PCA_AND_CHILDREN_MISALIGNED;
            break;
        case 273:
        case 360:
        case 2985:
        case 3024:
            advanceIndicatorObject.icon = INDICATOR_REVISION_MISALIGNED;
            break;
        case 485:
        case 2909:
            advanceIndicatorObject.icon = INDICATOR_REV_AND_CHILDREN_MISALIGNED;
            break;
        default:
            advanceIndicatorObject = null;
    }
    return advanceIndicatorObject;
};

/**
 * Append icon element to container element
 *
 * @param {string} context - Source or Target context
 * @param {number} status - Indicator status
 * @param {object} isAdvanceIndicator - true if Advance Indicator column
 * @param {object} vmo - View Model Object
 * @param {object} containerElement - Container element
 * @param {string} columnName - Column name
 * @param {object} tooltip - tooltip defination
 */
let _appendIconElementToContainer = function( context, status, isAdvanceIndicator, vmo, containerElement, columnName, tooltip ) {
    let tooltipViewName = tooltip && tooltip.length > 0 ? tooltip[ 0 ] : null;
    let indicatorObject = isAdvanceIndicator ? _getAdvanceIndicator( status ) : _getAlignmentIndicator( status, vmo, context );
    if( indicatorObject ) {
        let iconSource = CadBomOccurrenceAlignmentUtil.getIconSourcePath( indicatorObject.icon );
        let contextObject = {
            vmo: vmo,
            status: status,
            columnName: columnName,
            iconName: indicatorObject.icon
        };

        // This is special case where we will show non clickable align indicator.
        if( status === 357 && !indicatorObject.clickEvent ) {
            tooltipViewName = 'AlignmentSpecialTooltip';
        }

        let callbackApi = null;
        if( indicatorObject.clickEvent ) {
            callbackApi = getCallbackApi( context, vmo, indicatorObject.clickEvent, indicatorObject.intent );
        }
        CadBomAlignmentCheckCellRenderer.getIconCellElement( contextObject, iconSource, containerElement, columnName, tooltipViewName, null, callbackApi, status );
    }
};

/**
 * Check if alignment status of given vmo is null or not
 * @param {Object} vmo the vmo for the cell
 * @returns {boolean} True if given vmo is top node or removed otherwise False
 */
let _isAlignmentStatusNull = function( vmo ) {
    let isTopNode = !( vmo.parentUid || vmo.props?.awb0Parent?.dbValues[0] );
    // Fix: LCS-973677 - Alignment indicator issues for removed and unconfigured lines
    return isTopNode || vmo.isDeleted;
};

/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 */
export let getSrcAlignmentIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let context = CadBomOccAlignmentCheckService.CBA_SRC_CONTEXT;
    //Check if current VMO is top node then alignment status should be null
    //      else check the status code from alignment check cache
    // Fix: LCS-999271 - Alignment indicator is not showing for Packable Part Occ. ON EBOM
    let status = _isAlignmentStatusNull( vmo ) ? null : CadBomOccAlignmentCheckService.getStatus( context, vmo );
    _appendIconElementToContainer( context, status, false, vmo, containerElement, columnName, tooltip );
};

/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 */
export let getSrcAdvanceIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let context = CadBomOccAlignmentCheckService.CBA_SRC_CONTEXT;
    let status = CadBomOccAlignmentCheckService.getStatus( context, vmo );
    _appendIconElementToContainer( context, status, true, vmo, containerElement, columnName, tooltip );
};

/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 */
export let getTrgAlignmentIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let context = CadBomOccAlignmentCheckService.CBA_TRG_CONTEXT;
    //Check if current VMO is top node then alignment status should be null
    //      else check the status code from alignment check cache
    // Fix: LCS-999271 - Alignment indicator is not showing for Packable Part Occ. ON EBOM
    let status = _isAlignmentStatusNull( vmo ) ? null : CadBomOccAlignmentCheckService.getStatus( context, vmo );
    _appendIconElementToContainer( context, status, false, vmo, containerElement, columnName, tooltip );
};

/**
 * Calls methods to get icon image source and icon element. Appends it to the container element. Also triggers events for the click of the icon.
 *
 * @param {Object} vmo the vmo for the cell
 * @param {DOMElement} containerElement containerElement
 * @param {Object} columnName the column associated with the cell
 * @param {String} tooltip tooltip names from prpertyRendererTemplates
 *
 */
export let getTrgAdvanceIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let context = CadBomOccAlignmentCheckService.CBA_TRG_CONTEXT;
    let status = CadBomOccAlignmentCheckService.getStatus( context, vmo );
    _appendIconElementToContainer( context, status, true, vmo, containerElement, columnName, tooltip );
};

/**
 * Get callback api
 *
 * @param {String} contextKey contextKey
 * @param {Object} vmo vmo
 * @param {String} eventName eventName
 * @param {String} intent Intent of click either crossProbe or findAligned
 * @returns {function} function
 */
function getCallbackApi( contextKey, vmo, eventName, intent ) {
    return function( event ) {
        let eventData = {
            vmo: vmo,
            contextName: contextKey,
            event: event
        };
        if( intent ) {
            eventData.intent = intent;
        }
        eventBus.publish( eventName, eventData );
    };
}

const exports = {
    getSrcAlignmentIndicationRenderer,
    getSrcAdvanceIndicationRenderer,
    getTrgAlignmentIndicationRenderer,
    getTrgAdvanceIndicationRenderer
};

export default exports;
