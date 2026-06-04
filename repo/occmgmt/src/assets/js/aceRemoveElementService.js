// Copyright (c) 2022 Siemens

/**
 * Creates an array of uids and types for the RemoveElement soa call
 *
 * @module js/aceRemoveElementService
 */
import appCtxSvc from 'js/appCtxService';
import ClipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import TypeDisplayNameService from 'js/typeDisplayName.service';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

export let performPostRemoveAction = function( removedElementUIDs, operationName, occContext ) {
    let removedObjects = [];
    let willPCIChangePostRemoveAction = false;

    if( occContext.elementToPCIMap ) {
        let pciUidsInElementToPCIMap = Object.values( occContext.elementToPCIMap );
        let currentPciPresentInMap = false;

        _.forEach( pciUidsInElementToPCIMap, function( pciUidInMap ) {
            if( _.isEqual( pciUidInMap, occContext.productContextInfo.uid ) ) {
                currentPciPresentInMap = true;
            }
        } );
        willPCIChangePostRemoveAction = currentPciPresentInMap === false;
    }

    _.forEach( removedElementUIDs, function( removedElementUID ) {
        var removedObject = appCtxSvc.ctx.mselected.filter( function( selected ) {
            return selected.uid === removedElementUID;
        } );
        removedObjects.push.apply( removedObjects, removedObject );
    } );

    occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', {
        elementsToDeselect: removedObjects
    }, occContext );

    //Below event is needed for split view
    if( removedObjects.length > 0 ) {
        //publish elements removed from PWA
        eventBus.publish( 'ace.elementsRemoved', {
            removedObjects: removedObjects,
            viewToReact: appCtxSvc.ctx.aceActiveContext.key,
            operationName: operationName,
            willPCIChangePostRemoveAction: willPCIChangePostRemoveAction
        } );
    }
};

export let getRemovedElements = function( serviceData ) {
    var mselected = appCtxSvc.ctx.mselected.map( function( obj ) {
        return obj.uid;
    } );
    if( appCtxSvc.ctx[ appCtxSvc.ctx.aceActiveContext.key ].isMarkupEnabled && serviceData.updated ) {
        var mergedResponse = serviceData.deleted ? serviceData.updated.concat( serviceData.deleted ) : serviceData.updated;
        return _.intersection( mergedResponse, mselected );
    }
    return _.intersection( serviceData.deleted, mselected );
};

export let processPartialErrors = function( serviceData ) {
    var name = [];
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors && appCtxSvc.ctx.mselected.length === 1 ) {
        name.push( appCtxSvc.ctx.mselected[ 0 ].props.awb0UnderlyingObject.uiValues[ 0 ] );
        msgObj.name += name[ 0 ];
        for( var x = 0; x < serviceData.partialErrors[ 0 ].errorValues.length; x++ ) {
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ x ].message;
            msgObj.msg += '<BR/>';
        }
        msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ 0 ].level ] );
    }

    return msgObj;
};

export let getDisplayNamesForRemoveLevel = function( selectedElement ) {
    var displayNames = [];
    displayNames.push( TypeDisplayNameService.instance.getDisplayName( selectedElement ) );
    var parentElem = cdm.getObject( selectedElement.props.awb0Parent.dbValues[ 0 ] );
    displayNames.push( TypeDisplayNameService.instance.getDisplayName( parentElem ) );
    return displayNames;
};

export let performPostRemoveLevelAction = function( removeLevelResponse, operationName, occContext ) {
    var mselected = appCtxSvc.ctx.mselected.map( function( obj ) {
        return obj.uid;
    } );

    var removedElementUIDs = _.intersection( removeLevelResponse.ServiceData.deleted, mselected );
    exports.performPostRemoveAction( removedElementUIDs, operationName, occContext );

    var parentElemsInResponse = removeLevelResponse.childOccurrencesInfo[ 0 ];
    var childOccurences = removeLevelResponse.childOccurrencesInfo[ 1 ];

    for( var inx = 0; inx < parentElemsInResponse.length; ++inx ) {
        var addElementResponse = {};
        var selectedNewElementInfo = {
            newElements: []
        };
        for( var i = 0; i < removeLevelResponse.ServiceData.created.length; ++i ) {
            var childOccInx = _.findLastIndex( childOccurences[ inx ], function( childOccurrence ) {
                return childOccurrence.occurrenceId === removeLevelResponse.ServiceData.created[ i ];
            } );
            if( childOccInx > -1 ) {
                var newElement = cdm.getObject( removeLevelResponse.ServiceData.created[ i ] );
                selectedNewElementInfo.newElements.push( newElement );
            }
        }
        selectedNewElementInfo.pagedOccurrencesInfo = {
            childOccurrences: childOccurences[ inx ]
        };
        addElementResponse = {
            selectedNewElementInfo: selectedNewElementInfo,
            ServiceData: removeLevelResponse.ServiceData

        };
        if( inx === parentElemsInResponse.length - 1 ) {
            addElementResponse.newElementInfos = removeLevelResponse.newElementInfos;
        }
        var eventData = {
            updatedParentElement: parentElemsInResponse[ inx ],
            addElementResponse: addElementResponse,
            viewToReact: occContext.viewKey
        };

        eventBus.publish( 'addElement.elementsAdded', eventData );
        var eventDataForSelection = {
            objectsToSelect: selectedNewElementInfo.newElements,
            viewToReact: occContext.viewKey
        };
        eventBus.publish( 'aceElementsSelectionUpdatedEvent', eventDataForSelection );
    }
};

export let getRemoveElements2Input = function( subPanelContext ) {
    let selectedObjects = subPanelContext.occContext.pwaSelection;
    let input = [];
    for( let index = 0; index < selectedObjects.length; index++ ) {
        let productInfo = aceDataNavigatorService.getProductInfoForCurrentSelection( selectedObjects[ index ], subPanelContext.occContext );
        let removeElement2Input = {
            element: {
                uid: selectedObjects[ index ].uid,
                type: selectedObjects[ index ].type
            },
            productContextInfo: {
                uid: productInfo.newPci_uid,
                type: 'Awb0ProductContextInfo'
            }
        };
        input.push( removeElement2Input );
    }
    return input;
};

/**
 * Remove Element service utility
 */

export default exports = {
    performPostRemoveAction,
    getRemovedElements,
    processPartialErrors,
    performPostRemoveLevelAction,
    getDisplayNamesForRemoveLevel,
    getRemoveElements2Input
};
