// Copyright (c) 2020 Siemens

/**
 * @module js/taskListArragementsDragDrop
 */

import eventBus from 'js/eventBus';
import _ from 'lodash';
import AwHttpService from 'js/awHttpService';
import localStrg from 'js/localStorage';
import soaSvc from 'soa/kernel/soaService';

let exports = {};

const clearCachedData = () => {
    localStrg.publish( 'taskDraggedListData' );
};

const dehighlightElement = () => {
    var allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

export const dragOverTreeTable = ( props, dragAndDropParams ) => {
    if( props.subPanelContext.workflowDgmEditCtx.editObjectUids && props.subPanelContext.workflowDgmEditCtx.editObjectUids.indexOf( props.subPanelContext.selected.uid ) > -1 ) {
        let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
        if( targetObject ) {
            dragAndDropParams.callbackAPIs.highlightTarget( {
                isHighlightFlag: true,
                targetElement: dragAndDropParams.targetElement
            } );
            return {
                preventDefault: true,
                dropEffect: 'copy'
            };
        }
        dehighlightElement();
        return {
            dropEffect: 'none'
        };
    }
};

export const dropOnTreeTable = ( props, dragAndDropParams ) => {
    if( props.subPanelContext.workflowDgmEditCtx.editObjectUids && props.subPanelContext.workflowDgmEditCtx.editObjectUids.indexOf( props.subPanelContext.selected.uid ) > -1 ) {
        let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
        var vmc = dragAndDropParams.dataProvider.viewModelCollection;
        var loadedVMOs;
        let dragDataJSON = localStrg.get( 'taskDraggedListData' );
        let selectedObj = null;
        if( dragDataJSON && dragDataJSON !== 'undefined' ) {
            selectedObj = JSON.parse( dragDataJSON );
        }
        if( vmc ) {
            loadedVMOs = vmc.getLoadedViewModelObjects();
        }
        if( selectedObj && selectedObj[0].levelNdx === targetObject.levelNdx ) {
            var selectedIndex = _.findIndex( loadedVMOs, function( object ) {
                return object.uid === selectedObj[0].uid;
            } );
            var targetIndex = _.findIndex( loadedVMOs, function( object ) {
                return object.uid === targetObject.uid;
            } );
            var inputData = [];
            var uids = [];
            var cloneLoadedVMObjects = _.clone( loadedVMOs );
            cloneLoadedVMObjects.splice( selectedIndex, 1 );
            cloneLoadedVMObjects.splice( targetIndex, 0, selectedObj[0] );
            for( var i in cloneLoadedVMObjects ) {
                if( cloneLoadedVMObjects[i]._childObj.props.parent_task_template.dbValue === selectedObj[0]._childObj.props.parent_task_template.dbValue ) {
                    uids.push( cloneLoadedVMObjects[i].uid );
                }
            }
            var additionalDataMap = { update_sibling_task_order: uids };

            var object = {
                templateToUpdate: props.subPanelContext.selected.uid,
                additionalData: additionalDataMap
            };
            inputData.push( object );
            var soaInput = {
                input: inputData
            };

            // Check if SOA input is not null and not empty then only make SOA call
            if( soaInput && soaInput.input && soaInput.input.length > 0 ) {
                var promise = soaSvc.post( 'Workflow-2019-06-Workflow', 'createOrUpdateTemplate', soaInput );
            }
            eventBus.publish( 'workflowTreetable.reset' );
            dragAndDropParams.callbackAPIs.highlightTarget( {
                isHighlightFlag: false,
                targetElement: dragAndDropParams.targetElement
            } );
            clearCachedData();
        }
        dehighlightElement();
        return {
            dropEffect: 'none'
        };
    }
};
/**
 *
 * @param {Object} dnDParams dND obejct that will have all info form wher euser start dragging
 */
export let dragUserListStartAction = ( dnDParams ) => {
    localStrg.publish( 'taskDraggedListData', JSON.stringify( dnDParams.targetObjects ) );
};

export default exports = {
    dropOnTreeTable,
    dragOverTreeTable,
    dragUserListStartAction
};

