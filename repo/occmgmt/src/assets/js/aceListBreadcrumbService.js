// Copyright (c) 2022 Siemens

/**
 * @module js/aceListBreadcrumbService
 */
import appCtxSvc from 'js/appCtxService';
import occmgmtGetSvc from 'js/aceGetService';
import ctxStateMgmtService from 'js/aceContextStateMgmtService';
import assert from 'assert';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import cdm from 'soa/kernel/clientDataModel';
import listDPReqRespHelper from 'js/listDataProviderRequestResponseHelper';


var exports = {};

export let navigateToBreadcrumbSelectedObject = function( selection, occContext, { chevronPopup } ) {
    let selectedObjs = selection.map( function( obj ) {
        return cdm.getObject( obj.uid );
    } );

    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', { elementsToSelect: selectedObjs }, occContext );

    if( chevronPopup ) {
        chevronPopup.hide();
    }
};

//TODO: Hemraj - can we obsolete following function?
//When an object is selected in the breadcrumb popup
export let updateUrlOnObjectSelection = function( data, selection, contextKey ) {
    //The popup should be hidden
    data.showPopup = false;
    eventBus.publish( 'awPopupWidget.close' );
    var chevronCtx = appCtxSvc.getCtx( contextKey + 'Chevron' );
    if( chevronCtx && chevronCtx.clicked ) {
        chevronCtx.clicked = false;
    }

    //And it should navigate to the correct location
    if( selection && selection.length > 0 ) {
        if( chevronCtx && chevronCtx.scopedUid ) {
            var newState = {
                c_uid: selection[ 0 ].uid,
                o_uid: chevronCtx.scopedUid
            };
            ctxStateMgmtService.updateContextState( contextKey, newState, true );
        }
    }
};

/**
 * loadData
 *
 * @param {ListLoadInput} listLoadInput -
 * @param {IModelObject} openedObject -
 * @param {OccCursorObject} cursorObject -
 *
 * @return {Promise} Promise resolves with the resulting ListLoadResult object.
 */
export let loadData = function() {
    /**
     * Extract action parameters from the argument to this function.
     */
    assert( arguments.length === 1, 'Invalid argument count' );
    assert( arguments[ 0 ].listLoadInput, 'Missing argument property' );

    let listLoadInput = arguments[ 0 ].listLoadInput;
    let cursorObject = arguments[ 0 ].cursorObject;

    let occContext = arguments[ 0 ].occContext;
    let currentContext = appCtxSvc.ctx[ occContext.viewKey ];
    let soaInput = occmgmtGetSvc.getDefaultSoaInput();
    let contextState = {
        context: currentContext,
        occContext: occContext.getValue()
    };

    /**
     * Check if the listLoadInput does NOT specifiy a cursorObject but the dataProvider does.<BR>
     * If so: Use it.
     */
    if( !listLoadInput.cursorObject && cursorObject ) {
        listLoadInput.cursorObject = cursorObject;
    }

    listLoadInput.loadIDs = {
        uid:occContext.currentState.uid
    };

    listLoadInput.displayMode = 'List';

    return occmgmtGetSvc.getOccurrences( listLoadInput, soaInput, contextState ).then(
        function( response ) {
            var childOccurrences = [];

            _.forEach( response.parentChildrenInfos[ 0 ].childrenInfo, function( childOccInfo ) {
                childOccurrences.push( childOccInfo.occurrence );
            } );

            var totalChildCount = childOccurrences.length;

            if( !response.cursor.endReached ) {
                totalChildCount++;
            }

            var listLoadResult = listDPReqRespHelper.createListLoadResult( response.parentOccurrence,
                childOccurrences, totalChildCount, 0, response.parentOccurrence );

            /** List Specific load result properties */
            listLoadResult.cursorObject = response.cursor;

            return {
                listLoadResult: listLoadResult
            };
        } );
};

export default exports = {
    updateUrlOnObjectSelection,
    loadData,
    navigateToBreadcrumbSelectedObject
};
