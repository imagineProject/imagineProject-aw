// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomOccAlignmentCheckUtil
 */
import appCtxSvc from 'js/appCtxService';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import occmgmtUtils from 'js/occmgmtUtils';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import cbaConstants from 'js/cbaConstants';
import _ from 'lodash';
import cbaObjectTypeService from 'js/cbaObjectTypeService';

export const CBA_SRC_CONTEXT = 'CBASrcContext';
export const CBA_TRG_CONTEXT = 'CBATrgContext';
const validGesturesForConfigChange = Object.freeze( [ 'EFFECTIVITY_TOGGLE_CHANGE', 'VARIANT_TOGGLE_CHANGE', 'SUPPRESSED_TOGGLE_CHANGE' ] );

/**
  * Get executed alignment check info for the context
  *
  * @param {*} contextKey - Source or Target Context key for which last alignment check info to fetch
  * @returns {Object} - Alignment Check info object
  */
export const getExecutedAlignmentCheckInfo = function( contextKey ) {
    return appCtxSvc.getCtx( 'cbaContext.alignmentCheckContext.alignmentCheckInfo.' + contextKey );
};

/**
 * Filter visibe uids which are already having alignment status
 * @param {String} contextKey Context name for source or target
 * @param {List} visibleUids List of uids
 * @param {List} skipStatusCodes List of statuc code which dont need to filter
 * @returns {List} visibleUids List of filtered uids
 */
const filterVisibleUidsFromCache = function( contextKey, visibleUids, skipStatusCodes ) {
    let contextObj = getExecutedAlignmentCheckInfo( contextKey );
    if( contextObj ) {
        let diffObj = contextObj.differences;
        let cachedUids = Object.keys( diffObj );
        return visibleUids.filter( visibleUid => {
            let skipNodeCondition = false;
            if( skipStatusCodes && diffObj[ visibleUid ] ) {
                skipNodeCondition = skipStatusCodes.indexOf( diffObj[ visibleUid ].status ) !== -1;
            }

            if( cachedUids.indexOf( visibleUid ) === -1 || skipNodeCondition ) {
                return true;
            }
            return false;
        } );
    }
    return visibleUids;
};

/**
 * Check if given node is a top node
 *
 * @param {object} node to check
 *
 * @returns {object} node if given node is top node else null
 */
export const getTopNode = function( node ) {
    let result = null;
    if( node.levelNdx === 0 && !node.parentUid ) {
        result = node;
    }
    return result;
};

/**
  * Returns list of uids
  *
  * @param {Array} vmoList - List of ViewModelObject for which uids to return
  * @returns {Array} - List of uids
  */
export const getUidsFromVMOs = function( vmoList ) {
    let uids = [];
    if( vmoList ) {
        _.forEach( vmoList, function( value ) {
            uids.push( value.uid );
        } );
    }
    return uids;
};

/**
 * Filter visible uids which are already having alignment status
 *
 * @param {object} alignmentCheckInfo - alignmentCheckInfo Alignment Check Info object
 * @param {string} contextKey - context key
 * @param {List} skipStatusCodes List of status code which need not to filter
 * @returns {object} set of visible uids on which alignment check needs to performed
 */
export const filterVisibleUidsHavingAlignmentStatus = function( alignmentCheckInfo, contextKey, skipStatusCodes ) {
    let isAddAllVisibleUids = alignmentCheckInfo.isAddAllVisibleUids;

    let vmoList = contextKey === CBA_SRC_CONTEXT ? alignmentCheckInfo.sourceInfo.VMOs : alignmentCheckInfo.targetInfo.VMOs;
    let topElement = contextKey === CBA_SRC_CONTEXT ? alignmentCheckInfo.srcTopElement : alignmentCheckInfo.trgTopElement;
    topElement = topElement ? topElement : _.find( vmoList, getTopNode );

    // No need to filter skip nodes in background as child misaligned indicators needs to show for skip nodes
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode() ) {
        // Background Mode : Filter out object type with non valid CBA qualifier types e.g. partitions
        vmoList = vmoList.filter( vmo => CadBomOccurrenceAlignmentUtil.getObjectQualifierTypeFromVMO( vmo ) !== null );
    }else {
        // Foreground Mode : Filter out object which are not valid for alignment e.g . partitions,
        // skip nodes (obejcts with isPartRequired = false, isDesignRequired = false, isSkipAlignment = true)
        vmoList = vmoList.filter( vmo => CadBomOccurrenceAlignmentUtil.isValidObjectForAlignment( vmo ) );
    }

    if( _.isEmpty( vmoList ) ) {
        vmoList.push( topElement );
    }

    let visibleUids = getUidsFromVMOs( vmoList );


    if( !isAddAllVisibleUids ) {
        visibleUids = filterVisibleUidsFromCache( contextKey, visibleUids, skipStatusCodes );
        if( _.isEmpty( visibleUids ) ) {
            visibleUids.push( topElement.uid );
        }
    }
    return visibleUids;
};

/**
 *
 * @param {object} cbaContext - cbaContext atomic data
 * @param {Object} value - value of isConfigurationChanged to update
 * @param {Object} optionalConfiguration - value of optional Configuration to update
 * @param {String} userGesture - user gesture of Configuration change
 */
export const configurationChanged = function( cbaContext, value, optionalConfiguration ) {
    let valueToUpdate = {
        isConfigurationChanged : value
    };

    // Fix the issue: LCS-961024 - Inconsistency around Guided panel close issue
    // In Guided Update Page, should close Guided Update Panel when change configuration
    if( optionalConfiguration ) {
        valueToUpdate = { ...valueToUpdate, ...optionalConfiguration };
    }

    occmgmtUtils.updateValueOnCtxOrState( '', valueToUpdate, cbaContext );
};

export const clearDatasetUid = function() {
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_DATASETUID, undefined );
    CadBomAlignmentUtil.updateURLParams( { datasetUid: null } );
};

export const mergeAlingmentCheckCacheObjects = function( targetObject, sourceObject ) {
    for( const key in sourceObject ) {
        if( targetObject[ key ]?.mappingUids ) {
            let sourceMappingUids = sourceObject[ key ].mappingUids;
            sourceMappingUids.forEach( mappingUid => {
                if( !targetObject[ key ].mappingUids.includes( mappingUid ) ) {
                    targetObject[ key ].mappingUids.push( mappingUid );
                }
            } );
        } else{
            targetObject[ key ] = sourceObject[ key ];
        }
    }
    return targetObject;
};

/**
 * Clear all data related to background alignment check
 */
export const clearBackgroundAlignmentCheckData = function() {
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckBackgroundMode() ) {
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO, {} );
        appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_FIND_ALIGNED_INFO, {} );
        exports.clearDatasetUid();
    }
};

/**
 * Check if user gesture is valid for config changes in CBA
 * @param {string} occContextUserGesture - updated user gesture on occContext
 * @param {string} newOccContextUserGesture - updated user gesture on newOccContext( updated by method : updateOccContextStateOnTree)
  *@returns {Boolean} True if user gesture is valid for config changes in CBA else false
 */
export const isValidUserGestureForConfigChange = function( occContextUserGesture, newOccContextUserGesture ) {
    let updatedUserGesture = occContextUserGesture ? occContextUserGesture : newOccContextUserGesture;
    return updatedUserGesture && validGesturesForConfigChange.indexOf( updatedUserGesture ) > -1;
};

/**
 * Populate cached children to alignmentcheck info
 * @param {object} infoObject AlignmentCheckInfo object
 * @param {object} topElement Top tree node
 */
export const populateCachedChildrenToAlignmentCheckInfo = function( infoObject, topElement ) {
    if( topElement &&  infoObject?.VMOs?.length === 1 ) {
        const infoVMO = infoObject.VMOs[ 0 ];
        if( topElement.uid === infoVMO.uid && topElement.__expandState ) {
            infoObject.VMOs.push( ...topElement.__expandState.expandedNodes );
        }
    }
};

/**
 * Validate if Alignment check needs to be executed on each level of given nodes
 * @param {object} expandedNode - Cache node
 * @param {object} differences - Alignment Check data for given context
 * @param {boolean} partDesignRequiredProp - Part or Design Required property
 * @param {boolean} isPerformAlignmentCheck - Is alignment check done
 * @returns {boolean} true if alignment check need to be executed else false
 */
const isACApplicableForExpandedNode = function( expandedNode, differences, partDesignRequiredProp, isPerformAlignmentCheck ) {
    for ( const child of expandedNode.children ) {
        if( isPerformAlignmentCheck ) {
            break;
        }

        if( child.isExpanded && child.children?.length > 0 ) {
            isPerformAlignmentCheck = exports.isACApplicableForExpandedNode( child, differences, partDesignRequiredProp, isPerformAlignmentCheck );
        }else if( child.props?.[ partDesignRequiredProp ]?.dbValue && !differences.hasOwnProperty( child.uid ) ) {
            isPerformAlignmentCheck = true;
            break;
        }
    }
    return isPerformAlignmentCheck;
};

/**
  *  Perform alignment check for cached node if caches node don't have alignment data
  * @param {object} expandedNode Tree node which is expanding
  * @param {string} contextName Source or Target context from which node is expanding
  */
export const isAlignmentCheckDoneForAllChildren = function( expandedNode, contextName ) {
    let result = false;
    if( CadBomOccurrenceAlignmentUtil.isAlignmentCheckMode() && expandedNode?.children?.length ) {
        contextName = contextName || appCtxSvc.getCtx( 'aceActiveContext.key' );
        const partDesignRequiredProp = contextName === cbaConstants.CBA_SRC_CONTEXT ? 'pma1IsPartRequired' : 'pma1IsDesignRequired';

        const alignmentCheckInfo = appCtxSvc.getCtx( cbaConstants.CTX_PATH_ALIGNMENT_CHECK_INFO );
        if( alignmentCheckInfo ) {
            const contextAlignmentCheckInfo = alignmentCheckInfo[ contextName ];
            if( contextAlignmentCheckInfo?.differences ) {
                const differences = contextAlignmentCheckInfo.differences;
                result = !exports.isACApplicableForExpandedNode( expandedNode, differences, partDesignRequiredProp, result );
            }
        }
    }
    return result;
};

/**
 * Checks if the given UID corresponds to an EDA part from the given model objects.
 *
 * @param {string} uidToValidate - The UID to validate.
 * @param {Object[]} modelObjects - The array of model objects to check against.
 * @returns {boolean} - Returns true if the UID corresponds to an EDA part, otherwise false.
 */
const isMultiDomainExistsInGivenObjects = function( uidToValidate, modelObjects ) {
    const qualifier = cbaObjectTypeService.getObjectsQualifierType( modelObjects );

    return _.some( modelObjects, function( modelObject ) {
        return modelObject?.uid === uidToValidate && qualifier[cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN]?.includes( modelObject );
    } );
};

/**
 * CAD-BOM Alignment Util
 */

const exports = {
    getExecutedAlignmentCheckInfo,
    filterVisibleUidsFromCache,
    getUidsFromVMOs,
    filterVisibleUidsHavingAlignmentStatus,
    configurationChanged,
    clearDatasetUid,
    mergeAlingmentCheckCacheObjects,
    clearBackgroundAlignmentCheckData,
    isValidUserGestureForConfigChange,
    populateCachedChildrenToAlignmentCheckInfo,
    isACApplicableForExpandedNode,
    isAlignmentCheckDoneForAllChildren,
    isMultiDomainExistsInGivenObjects
};
export default exports;
