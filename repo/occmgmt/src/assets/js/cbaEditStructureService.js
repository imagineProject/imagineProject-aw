// Copyright (c) 2022 Siemens

/**
 * @module js/cbaEditStructureService
 */
import appCtxSvc from 'js/appCtxService';
import cdmSvc from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import cbaConstants from 'js/cbaConstants';
import aceStructureEditService from 'js/aceStructureEditService';
import aceViewModelTreeNodeCreateService from 'js/aceViewModelTreeNodeCreateService';

/**
 * Add Node to tree
 * @param {Array} vmc  - View Model collection to update
 * @param {Array} createdObjects  - List of created objects
 */
let addNode = ( vmc, createdObjects ) => {
    for( let index = 0; index < createdObjects.length; index++ ) {
        const createdObj = createdObjects[ index ];

        let parentProperty = _.get( createdObj, 'props.awb0Parent' );
        let parentInfo = { uid: parentProperty.dbValues[ 0 ] };
        const createdNodeInfo = cdmSvc.getObject( createdObj.uid );

        let parentTreeNode = vmc.getViewModelObject( vmc.findViewModelObjectById( parentProperty.dbValues[ 0 ] ) );

        let childNdx = 0;
        let levelNdx = parentTreeNode.levelNdx + 1;

        const occurrenceInfo = aceViewModelTreeNodeCreateService.createVMNodeUsingModelObjectInfo( createdNodeInfo, childNdx, levelNdx );

        occurrenceInfo.occurrenceId = createdNodeInfo.uid;
        occurrenceInfo.underlyingObjectType = _.get( createdNodeInfo, 'props.awb0UnderlyingObjectType.dbValues[0]' );
        occurrenceInfo.numberOfChildren = 0;
        let loadedViewModelObjects = vmc.getLoadedViewModelObjects();
        aceStructureEditService.addChildNode( occurrenceInfo, childNdx, parentInfo, loadedViewModelObjects );

        eventBus.publish( 'cba.ebomNodeAdded', loadedViewModelObjects );
    }
};

/**
 * Update strcuture after alignment changes
 * @param {*} eventData - Alignment/UnAlignment event data
 */
let updateStructureAfterAlignment = function( eventData ) {
    let isEBOMExplodedMode = appCtxSvc.getCtx( cbaConstants.CBA_TRG_CONTEXT + '.productContextInfo.props.awb0ShowExplodedLines.dbValues[0]' ) === '1';

    if( !isEBOMExplodedMode && !eventData.response.created ) {
        return;
    }

    const created = eventData.response.created;
    const deleted = eventData.response.deleted;
    const modelObjects = eventData.response.modelObjects;

    let isObjectsCreated = false;
    let isObjectsDeleted = false;

    let selectionElement;

    if( created && created.length ) {
        const activeContext = appCtxSvc.ctx[ cbaConstants.CBA_TRG_CONTEXT ];
        appCtxSvc.updatePartialCtx( 'aceActiveContext', {
            key: cbaConstants.CBA_TRG_CONTEXT,
            context: activeContext
        } );

        const createdObjects = [];
        _.forEach( created, function( uid ) {
            if( uid in modelObjects ) {
                let modelObject = modelObjects[ uid ];
                if( modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                    // This is temporary fix for defect LCS-1200147
                    // This needs to fix from server. Once server fix this , we will revert this change.
                    const index = activeContext.vmc.findViewModelObjectById( uid );
                    if( index === -1 ) {
                        createdObjects.push( modelObject );
                    }
                }
            }
        } );

        if( createdObjects.length ) {
            isObjectsCreated = true;
            addNode( activeContext.vmc, createdObjects );

            // Update selections
            // If created [] and deleted [1] : UnAlign - Exploded Line Remove : Selection to TOP
            // If created [1] and deleted [1,2] : UnAlign - 2nd Last Exploded Line Remove : Selection to CREATED line
            // If created [] and deleted [] : Align - Align on Summary Line : No selection change
            // If created [1,2] and deleted [1] : Align - 2nd Alignment on Summary Line: Selection to CREATED line

            if( createdObjects.length > 1 ) {
                appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_SELECT_ALIGNED_LINE, true );
            } else if( createdObjects.length === 1 ) {
                selectionElement = createdObjects[ 0 ];
            } else if( deleted && deleted.length > 0 ) {
                selectionElement = activeContext.topElement.uid;
            }
        }
    } else if( deleted && deleted.length ) {
        for( let index = 0; index < deleted.length; index++ ) {
            const uid = deleted[ index ];
            if( uid.search( cbaConstants.SR_UID_PREFIX ) === 0 ) {
                isObjectsDeleted = true;
                const activeContext = appCtxSvc.ctx[ cbaConstants.CBA_TRG_CONTEXT ];
                selectionElement = activeContext.topElement.uid;
                break;
            }
        }
    }
    if( selectionElement ) {
        let selectionUpdateEventData = {
            viewToReact: cbaConstants.CBA_TRG_CONTEXT,
            objectsToSelect: [ selectionElement ]
        };
        eventBus.publish( 'aceElementsSelectionUpdatedEvent', selectionUpdateEventData );
    }
    return isObjectsCreated || isObjectsDeleted;
};

/**
 * CAD-BOM Edit Structure service
 */

const exports = {
    updateStructureAfterAlignment
};
export default exports;
