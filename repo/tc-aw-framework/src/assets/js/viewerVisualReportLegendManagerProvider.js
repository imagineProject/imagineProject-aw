// Copyright (c) 2024 Siemens

/**
 * This Visual Report Manager service provider
 *
 * @module js/viewerVisualReportLegendManagerProvider
 */

import assert from 'assert';
import viewerContextService from 'js/viewerContext.service';
import _ from 'lodash';


/**
 * Provides an instance of viewer Visual Report Legend  manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerVisualReportLegendManager} Returns viewer Visual Report Legend manager
 */
export let getViewerVisualReportLegendManager = function(  viewerView, viewerContextData ) {
    return new ViewerVisualReportLegendManager(  viewerView, viewerContextData );
};

/**
 * Class to hold the viewer 3D Markup data
 *
 * @constructor ViewerVisualReportLegendManager
 *
 * @param {Object} viewerCtxNamespace Viewer context name space
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class ViewerVisualReportLegendManager {
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null' );
        assert( viewerContextData, 'Viewer context data can not be null' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;

        this.viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_IS_VISUAL_REPORT_LEGEND_VISIBLE, false );

        // register listener for events from JSCom that will tell us when a view has a
        // visual report so we then display the visual report legend. This will be used when restoring a session or snapshot.
        this.viewerColoringManagerListener = {
            // this listner is called during apply of bookmark, opening of a session
            // , applying of a product view or snapshot
            notifyVisualReportActive: reportActive  => {

                this.viewerContextData.updateViewerAtomicData( viewerContextService.VIEWER_IS_VISUAL_REPORT_LEGEND_VISIBLE, reportActive );

            }
        };

        this.viewerView.coloringMgr.addColoringListener( this.viewerColoringManagerListener );

    }


}

export default {
    getViewerVisualReportLegendManager
};
