// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/cbaTaskbarCommandService
 */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import cbaConstants from 'js/cbaConstants';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';


/**
 * Check if the value is present in given preference
 * @param {string} preferenceName Name of preference in which value to check
 * @param {string} value value to check in preference
 * @returns {boolean} true if value is present in preference else false.
 */
let _checkValueInPreference = ( preferenceName, value ) => {
    let preferenceValues = appCtxSvc.getCtx( 'preferences.' + preferenceName );
    return Boolean( preferenceValues && preferenceValues.includes( value ) );
};

/**
 * Get property object for context
 * @param {*} context OccContext object
 * @returns {Object} - Property object
 */
let _getPropObjFromContext = ( context ) => {
    let propObj = {
        openedElement: context?.openedElement,
        pwaSelection: context?.pwaSelection,
        topElement: context?.topElement,
        viewKey: context?.viewKey,
        vmc: context?.vmc,
        isRowSelected: null,
        isTopSelected: false,
        isTopDefaultSelected: false,
        areMultipleSelected: false,
        isSingleVisibleSelected: false,
        isPartRequired: null,
        isDesignRequired: null,
        isPartOrDesignRequired: null,
        isVISelected: null,
        isSelectionSVProductOcc: null,
        isUnconfiguredSelected: null,
        isSelectionProductOcc:null,
        isSomePartRequired:null
    };

    let currIdx = _.findIndex( context?.pwaSelection, context?.topElement );
    let isTopSelectedIn = currIdx !== -1;
    propObj.isRowSelected = context?.isRowSelected ? Boolean( context?.isRowSelected ) : !isTopSelectedIn && context?.pwaSelection?.length > 0;
    if ( context?.pwaSelection && Array.isArray( context?.pwaSelection ) && context?.topElement ) {
        let currIdx = _.findIndex( context.pwaSelection, context.topElement );
        let isTopSelectedIn = currIdx !== -1;
        propObj.isRowSelected = context.isRowSelected ? Boolean( context.isRowSelected ) : !isTopSelectedIn && context.pwaSelection.length > 0;

        //Top selected
        propObj.isTopSelected = context.pwaSelection.some( selectedModelObject => {
            return context.isRowSelected && context.topElement.uid === selectedModelObject.uid;
        } );

        //Top default selected
        propObj.isTopDefaultSelected = context.pwaSelection.some( selectedModelObject => {
            return !context.isRowSelected && context.topElement.uid === selectedModelObject.uid;
        } );

        // Are Multiple Selected (Consider single packed line as multiple lines)
        propObj.areMultipleSelected = context.pwaSelection.length > 1;
        if ( !propObj.areMultipleSelected ) {
            propObj.areMultipleSelected = context.pwaSelection.some( selectedModelObject => {
                return selectedModelObject.props.awb0IsPacked && selectedModelObject.props.awb0IsPacked.dbValues[0] === '1';
            } );
        }

        // Is Single Visible Selected (Packed line is also consider as single line)
        propObj.isSingleVisibleSelected = context.pwaSelection.length === 1;

        // Is Part required
        propObj.isPartRequired = context.pwaSelection.every( selectedModelObject => {
            return selectedModelObject.props.pma1IsPartRequired && ( selectedModelObject.props.pma1IsPartRequired.dbValues[0] === '1' || selectedModelObject.props.pma1IsPartRequired.dbValues[0] === 'true' );
        } );

        // Is Design required
        propObj.isDesignRequired = context.pwaSelection.every( selectedModelObject => {
            return selectedModelObject.props.pma1IsDesignRequired && ( selectedModelObject.props.pma1IsDesignRequired.dbValues[0] === '1' || selectedModelObject.props.pma1IsDesignRequired.dbValues[0] === 'true' );
        } );

        propObj.isPartOrDesignRequired = propObj.isPartRequired || propObj.isDesignRequired;

        let underlyingObjectType = propObj.isSingleVisibleSelected && context.pwaSelection[0].props.awb0UnderlyingObjectType;
        propObj.isSelectionProductOcc = underlyingObjectType ? _checkValueInPreference( 'FND0_PRODUCTEBOMREVISION_TYPES', underlyingObjectType.dbValues[0] ) : false;

        // Is VI
        propObj.isVISelected = context.pwaSelection.every( selectedModelObject => {
            return selectedModelObject.props.awb0IsVi && selectedModelObject.props.awb0IsVi.dbValues[0] === '1';
        } );

        if ( propObj.isVISelected && propObj.isSelectionProductOcc ) {
            propObj.isSelectionSVProductOcc = true;
        }

        // Is Unconfigured selected
        propObj.isUnconfiguredSelected = context.pwaSelection.some( selectedModelObject => {
            return selectedModelObject.props?.awb0Archetype?.dbValues[0] === null;
        } );

        // Is Part required true on some of the selected lines
        propObj.isSomePartRequired = context.pwaSelection.some( selectedModelObject => {
            return selectedModelObject.props.pma1IsPartRequired && selectedModelObject.props.pma1IsPartRequired.dbValues[0] === '1';
        } );
    }
    return propObj;
};

/**
 * Update CTX with taskbar commands visibility state
 * @param {Object} srcContext Source occContext
 * @param {Object} trgContext target occContext
 */
export const updateContextForTaskbarCmds = ( srcContext, trgContext ) => {
    if ( !srcContext && !trgContext ) {
        return;
    }

    let srcPropObj;
    let trgPropObj;
    if ( srcContext ) {
        srcPropObj = _getPropObjFromContext( srcContext );
    }

    if ( trgContext ) {
        trgPropObj = _getPropObjFromContext( trgContext );
    }

    let areMultipleStructureInCBA = Boolean( srcPropObj && srcPropObj.openedElement && trgPropObj && trgPropObj.openedElement );


    let commands = {
        areMultipleStructuresInCBA: Boolean( areMultipleStructureInCBA ),
        isSingleSelectionInSrc: Boolean( srcPropObj && srcPropObj.isRowSelected ),
        isSingleSelectionInTrg: Boolean( trgPropObj && trgPropObj.isRowSelected )
    };
    let selection = {
        source:srcPropObj ? srcPropObj.pwaSelection : [],
        target:trgPropObj ? trgPropObj.pwaSelection : []
    };
    updateCadbomalignmentOnCtx( 'commands', commands );
    updateCadbomalignmentOnCtx( 'selection', selection );
};

/**
 * Returns taskbar context with updated source and target context values
 * @param {Object} taskBarContext taskbar context
 * @param {Object} updatedData values to be updated on taskBarContext
 */
export const updateTaskBarContext = function( taskBarContext, updatedData ) {
    if ( taskBarContext ) {
        let newValues = Object.assign( taskBarContext, updatedData );
        return taskBarContext.update( newValues );
    }
};

/**
 * Update cadBomAlignment data on ctx
 * @param {string} key key where we need to update the values
 * @param {Object} valueToUpdate Values to be updated on ctx.cadbomalignment
 */
export const updateCadbomalignmentOnCtx = function( key, valueToUpdate ) {
    appCtxSvc.updatePartialCtx( 'cadbomalignment.' + key, valueToUpdate );
};

/**
 * Update context with selection and isRowSelected flag
 * @param { object } occContext occContext to update
 * @param { boolean } isHiddenNodeSelected true if hidden node is selected in tree
 */
const _updateContext = function( occContext, isHiddenNodeSelected ) {
    let contextToUpdate = {};
    if( isHiddenNodeSelected ) {
        contextToUpdate.isRowSelected = true;
    } else{
        // Case if cross probe was performed from 3D and then clicked in 3D grey/blank area.
        // Top node will be system selection and no part is selected in 3D
        contextToUpdate.isRowSelected = false;
        contextToUpdate.pwaSelection = occContext.treeDataProvider.selectionModel.selectionData.selected;
    }
    occmgmtUtils.updateValueOnCtxOrState( '', contextToUpdate, occContext, true );
};

/**
 * handle acePartialSelection event
 * @param {Object} eventData event data
 * @param {Object} srcContext Source occContext
 * @param {Object} trgContext Target occContext
 */
export const handleAcePartialSelection = function( eventData, srcContext, trgContext ) {
    // This will called only when ace partial selection is set/unset
    // On partial selection set isRowSelected = true to make Cleaer Selection Command enable
    if( eventData?.name === 'CBASrcContext.acePartialSelection' || eventData?.name === 'CBATrgContext.acePartialSelection' ) {
        const eventContextName = eventData.name.split( '.' )[0];
        const value = eventData.value;

        const isHiddenNodeSelected = value.partialSelectionInfo.has( value.hiddenNode );
        let contextToUpdate = cbaConstants.CBA_SRC_CONTEXT === eventContextName ? srcContext : trgContext;
        _updateContext( contextToUpdate, isHiddenNodeSelected );
        eventBus.publish( 'cba.refreshTree' );
    }
};

const exports = {
    updateContextForTaskbarCmds,
    updateCadbomalignmentOnCtx,
    updateTaskBarContext,
    handleAcePartialSelection
};

export default exports;
