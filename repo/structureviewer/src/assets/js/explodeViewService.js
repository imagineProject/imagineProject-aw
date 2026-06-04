// Copyright (c) 2022 Siemens

/**
 * @module js/explodeViewService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import viewerContextService from 'js/viewerContext.service';
import eventBus from 'js/eventBus';

var exports = {};

/**
 * Activates explode view mode
 *
 * @param {Object} viewerContextData Viewer context data
 */
export let toggleExplodeSubCommandsToolbar = function( viewerContextData ) {
    let isExplodeViewActive = viewerContextData.getValueOnViewerAtomicData( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE );
    if( isExplodeViewActive ) {
        viewerContextData.getMotionManager().disableExplodeView();
    } else {
        closeToolAndInfoCommand( viewerContextData );
        viewerContextData.closeSubCommandsToolbar();
        viewerContextData.getMotionManager().startExplodeViewMode();
        viewerContextData.getViewerAtomicDataSubject().notify( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE );
        viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_IS_EXPLODE_VIEW_VISIBLE, true );
    }
};

/**
 * Close any other command panel that was open before explode command
 */
export let closeToolAndInfoCommand = function( viewerContextData ) {
    viewerContextData.closeActiveDialog();
};

/**
 * Reset Explode slider to initial value
 */
export let resetExplodeSlider = function( explodeSliderProp ) {
    var _explodeSliderProp = _.clone( explodeSliderProp );
    _explodeSliderProp.dbValue[ 0 ].sliderOption.value = 0;
    return _explodeSliderProp;
};

/**
 * Handle exploder view slider create event
 *
 * @function explodeSliderCreate
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Number} explodeSliderProp - new slider property value
 */
export let explodeSliderCreate = function( viewerContextData, explodeSliderProp ) {
    var _explodeSliderProp = _.clone( explodeSliderProp );
    // send the slider property to the motion manager so it can use it to set the slider percentage
    viewerContextData.getMotionManager().setExplodeSliderProperty( _explodeSliderProp );
};

/**
 * Handle exploder view slider change event
 *
 * @function explodeSliderValChange
 *
 * @param {Object} viewerContextData this contains Viewer Context Data
 * @param {Number} sliderValue - new slider value
 */
export let explodeSliderValChange = function( viewerContextData, sliderValue ) {
    viewerContextData.getMotionManager().setExplodeViewPercent( sliderValue );
};

/**
 * Closes sub command toolbar and disables explode view
 * @param {Object} viewerContextData viewer context
 */
export let closeExplodeViewSubCommandToolbar = function( viewerContextData ) {
    viewerContextData.getMotionManager().disableExplodeView();
};

export default exports = {
    toggleExplodeSubCommandsToolbar,
    resetExplodeSlider,
    explodeSliderValChange,
    explodeSliderCreate,
    closeExplodeViewSubCommandToolbar
};
