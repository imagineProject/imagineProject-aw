// Copyright (c) 2022 Siemens

/**
 * @module js/Awv0GeometricAnalysisMovePartsService
 */
import _ from 'lodash';
import viewerSelectedBomlineInfoProvider from 'js/viewerSelectedBomlineInfoProvider';


var exports = {};

export let toggleMovePartsSubCommandToolbar = function( commandId, viewerContextData ) {
    if( viewerContextData.toggleSubCommandsToolbar( commandId ) ) {
        closeToolAndInfoCommand( viewerContextData );
    } else {
        viewerContextData.getMotionManager().closeMovePartsToolbar();
    }
};

/**
 * Close any other command panel that was open before move parts command
 * @param {Object} viewerContextData viewerContextData
 */
export let closeToolAndInfoCommand = function( viewerContextData ) {
    //close dialog here
    viewerContextData.closeActiveDialog();
};

/**
 * Call Free Drag to set/unset it based on the toggle
 * @param {Object} viewerContextData viewer context data
 */
export let enableOrDisableFreeDrag = function( viewerContextData ) {
    viewerContextData.getMotionManager().setFreeDrag();
};

/**
 * Call Manipulator to set/unset it based on the toggle
 * @param {Object} viewerContextData viewer context data
 */
export let enableOrDisableManipulator = function( viewerContextData ) {
    viewerContextData.getMotionManager().setManipulator();
};

/**
 * Call Manipulator to set/unset it based on the toggle
 * @param {Object} viewerContextData viewer context data
 */
export let enableOrDisableFeatureAlign = function( viewerContextData ) {
    viewerContextData.getMotionManager().setFeatureAlignment();
};

/**
 * Call reset all to reset all parts repositioning
 * @param {Object} viewerContextData viewer context data
 */
export let resetAllRepositioning = function( viewerContextData ) {
    viewerContextData.getMotionManager().resetAll();
};

export let savePartRepositioning = function( viewerContextData, selectedCsids, selectedModelObjects, i18n ) {
    let viewerOccObject = [];
    for( let idx = 0; idx < selectedCsids.length; idx++ ) {
        viewerOccObject.push( viewerContextData.getViewerCtxSvc().createViewerOccurance( selectedCsids[ idx ], viewerContextData ) );
    }
    viewerSelectedBomlineInfoProvider.getBomlineObjectFromProviderFn( viewerContextData, selectedModelObjects, selectedCsids )
        .then( function( bomlines ) {
            viewerContextData.getMotionManager().savePosition( viewerOccObject, i18n, bomlines );
        } );
};


export let partsSelectMovePartsValueChanged = function( viewerContextData, isFreeDragEnabled ) {
    if( isFreeDragEnabled ) {
        return;
    }
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMotionManager().getMovePartsSubToolBarCommandState();

    if( !subToolBarCommandState.partsFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = true;
        subToolBarCommandState.surfaceFilterSelected = false;
        subToolBarCommandState.vertexFilterSelected = false;
        subToolBarCommandState.edgeFilterSelected = false;
        subToolBarCommandState.pointFilterSelected = false;
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_PARTS );
    } else {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.surfaceFilterSelected = true;
        subToolBarCommandState.vertexFilterSelected = true;
        subToolBarCommandState.edgeFilterSelected = true;
        subToolBarCommandState.pointFilterSelected = true;
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_SURFACE );
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_EDGE );
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_VERTEX );
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_POINT );
    }
    viewerContextData.getMotionManager().setSelectedMovePartsPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets surface as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let surfaceSelectMovePartsValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMotionManager().getMovePartsSubToolBarCommandState();
    if( !subToolBarCommandState.surfaceFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.surfaceFilterSelected = true;
        selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMotionManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_SURFACE );
    } else {
        if( !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.edgeFilterSelected &&
            !subToolBarCommandState.pointFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.surfaceFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_SURFACE );
        } else {
            selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMotionManager().PICK_FILTERS.PICK_SURFACE;
            } );
            subToolBarCommandState.surfaceFilterSelected = false;
        }
    }
    viewerContextData.getMotionManager().setSelectedMovePartsPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets edge as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let edgeSelectMovePartsValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMotionManager().getMovePartsSubToolBarCommandState();
    if( !subToolBarCommandState.edgeFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.edgeFilterSelected = true;
        selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMotionManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_EDGE );
    } else {
        if( !subToolBarCommandState.vertexFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.pointFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.edgeFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_EDGE );
        } else {
            selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMotionManager().PICK_FILTERS.PICK_EDGE;
            } );
            subToolBarCommandState.edgeFilterSelected = false;
        }
    }
    viewerContextData.getMotionManager().setSelectedMovePartsPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets vertex as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let vertexSelectMovePartsValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMotionManager().getMovePartsSubToolBarCommandState();
    if( !subToolBarCommandState.vertexFilterSelected ) {
        subToolBarCommandState.partsFilterSelected = false;
        subToolBarCommandState.vertexFilterSelected = true;
        selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMotionManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_VERTEX );
    } else {
        if( !subToolBarCommandState.edgeFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.pointFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.vertexFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_VERTEX );
        } else {
            selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMotionManager().PICK_FILTERS.PICK_VERTEX;
            } );
            subToolBarCommandState.vertexFilterSelected = false;
        }
    }
    viewerContextData.getMotionManager().setSelectedMovePartsPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Sets point as a picking filter
 *
 * @param {Object} viewerContextData Viewer context
 */
export let pointSelectMovePartsValueChanged = function( viewerContextData ) {
    var selectedPickFilters = [];
    let subToolBarCommandState = viewerContextData.getMotionManager().getMovePartsSubToolBarCommandState();
    if( !subToolBarCommandState.pointFilterSelected ) {
        subToolBarCommandState.pointFilterSelected = true;
        subToolBarCommandState.partsFilterSelected = false;
        selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
        if( _.includes( selectedPickFilters, viewerContextData.getMotionManager().PICK_FILTERS.PICK_PARTS ) ) {
            selectedPickFilters.length = 0;
        }
        selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_POINT );
    } else {
        if( !subToolBarCommandState.edgeFilterSelected && !subToolBarCommandState.surfaceFilterSelected &&
            !subToolBarCommandState.vertexFilterSelected ) {
            subToolBarCommandState.partsFilterSelected = false;
            subToolBarCommandState.pointFilterSelected = true;
            selectedPickFilters.push( viewerContextData.getMotionManager().PICK_FILTERS.PICK_POINT );
        } else {
            selectedPickFilters = viewerContextData.getMotionManager().getSelectedMovePartsPickFilters();
            _.remove( selectedPickFilters, function( currentObject ) {
                return currentObject === viewerContextData.getMotionManager().PICK_FILTERS.PICK_POINT;
            } );
            subToolBarCommandState.pointFilterSelected = false;
        }
    }
    viewerContextData.getMotionManager().setSelectedMovePartsPickFilters( selectedPickFilters, subToolBarCommandState );
};

/**
 * Call reset selected to reset all parts that were currently selected
 * @param {Object} viewerContextData viewer context data
 * @param {Object} selectedParts csid of all selected parts
 */
export let resetSelectedPartRepositioning = function( viewerContextData, selectedParts ) {
    let viewerOccObject = [];
    for( var idx = 0; idx < selectedParts.length; idx++ ) {
        viewerOccObject.push( viewerContextData.getViewerCtxSvc().createViewerOccurance( selectedParts[ idx ], viewerContextData ) );
    }
    viewerContextData.getMotionManager().resetSelected( viewerOccObject );
};

export let enableOrDisableFlipMode = function( viewerContextData ) {
    viewerContextData.getMotionManager().setFlip();
};


export default exports = {

    toggleMovePartsSubCommandToolbar,
    closeToolAndInfoCommand,
    enableOrDisableFreeDrag,
    enableOrDisableManipulator,
    resetAllRepositioning,
    resetSelectedPartRepositioning,
    enableOrDisableFeatureAlign,
    partsSelectMovePartsValueChanged,
    pointSelectMovePartsValueChanged,
    vertexSelectMovePartsValueChanged,
    edgeSelectMovePartsValueChanged,
    surfaceSelectMovePartsValueChanged,
    savePartRepositioning,
    enableOrDisableFlipMode

};
