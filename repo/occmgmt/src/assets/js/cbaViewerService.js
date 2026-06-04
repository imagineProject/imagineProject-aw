// Copyright (c) 2022 Siemens

/**
 * Service defines functionality related to structure viewer.
 * @module js/cbaViewerService
 */
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import cbaConstants from 'js/cbaConstants';
import cadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import eventBus from 'js/eventBus';
import cbaObjectTypeService from './cbaObjectTypeService';


/**
 * Fire event to notify viewer that alignment is updated, so that viewer gets reloaded
 *
 * @param {string} contextKey - Active context key
 * @param {object} primarySelection - Primary selected object in active context
 * @param {Array} secondarySelections - List of secondary selected objects
 */
export let notifyStructureViewers = function( contextKey, primarySelection, secondarySelections, skipDeltaUpdate ) {
    let viewsToReact = [];

    let isSplitMode = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_MODE );

    if( !isSplitMode ) {
        viewsToReact.push( contextKey );
    } else {
        let viewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
        let diffArray = _.difference( viewKeys, [ contextKey ] );
        let inActiveContextKey = diffArray[ 0 ];

        let primaryObjQualifierType = cbaObjectTypeService.getObjectQualifierType( primarySelection );

        let underlyingObjUidsToSearch = [];
        if( cbaConstants.PART === primaryObjQualifierType ) {
            viewsToReact.push( contextKey );

            if( !cadBomOccurrenceAlignmentUtil.isCBAView() ) {
                underlyingObjUidsToSearch.push( _.get( primarySelection, 'props.awb0UnderlyingObject.dbValues[0]' ) );
            }
        } else if( cbaConstants.DESIGN === primaryObjQualifierType ) {
            _.forEach( secondarySelections, function( secondarySelection ) {
                if( secondarySelection.type === cbaConstants.FND_ALIGNED_PART ) {
                    underlyingObjUidsToSearch.push( _.get( secondarySelection, 'props.fnd0UnderlyingObject.dbValues[0]' ) );
                } else {
                    underlyingObjUidsToSearch.push( secondarySelection.uid );
                }
            } );
        }

        let objectsFound = cadBomOccurrenceAlignmentUtil.getLoadedVMO( underlyingObjUidsToSearch, inActiveContextKey );
        if( objectsFound.length > 0 ) {
            viewsToReact.push( inActiveContextKey );
        }
    }

    _.forEach( viewsToReact, ( viewToReact ) => {
        eventBus.publish( 'cba.alignmentUpdated', { viewToReact: viewToReact, skipDeltaUpdate: skipDeltaUpdate } );
    } );
};

const exports = {
    notifyStructureViewers
};

export default exports;
