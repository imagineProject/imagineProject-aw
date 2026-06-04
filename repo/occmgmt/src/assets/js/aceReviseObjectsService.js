// Copyright (c) 2022 Siemens

/**
 * @module js/aceReviseObjectsService
 */
import appCtxService from 'js/appCtxService';
import cdmService from 'soa/kernel/clientDataModel';
import dataManagementService from 'soa/dataManagementService';
import adapterSvc from 'js/adapterService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import aceNavigationService from 'js/aceNavigationService';
import AwStateService from 'js/awStateService';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import occmgmtUtils from 'js/occmgmtUtils';

var exports = {};

var openRevisedObject = function( revisedElement, page, pageId ) {
    if( appCtxService.ctx.splitView ) {
        var params = {
            rootQueryParamKey: revisedElement.uid,
            pageIdQueryParamKey: pageId
        };
        aceNavigationService.navigateWithGivenParams( appCtxService.ctx.aceActiveContext.context.urlParams, params );
    } else {
        var toParams = {
            uid: revisedElement.uid,
            page: page,
            pageId: pageId
        };

        AwStateService.instance.go( '.', toParams, {
            inherit: false
        } );
    }
};

var refreshGivenView = function( viewKey ) {
    appCtxService.updatePartialCtx( viewKey + '.startFreshNavigation', true );
    appCtxService.updatePartialCtx( viewKey + '.requestPref.addUpdatedFocusOccurrence', true );
    eventBus.publish( 'acePwa.reset', { viewToReset: viewKey, silentReload: true } );
};
/*
 * This method performs post action for Revise Operation
 */

export let performPostReviseAction = function( revisedObject, page, pageId, commandContext ) {
    adapterSvc.getAdaptedObjects( [ appCtxService.ctx.selected ] ).then( function( adaptedObjs ) {
        var selectedAdoptedObject = cdmService.getObject( adaptedObjs[ 0 ].uid );
        var openedProduct = cdmService.getObject( commandContext.subPanelContext.occContext.productContextInfo.props.awb0Product.dbValues[ 0 ] );
        var revisedElement = cdmService.getObject( revisedObject.uid );
        var propsToLoad = [ 'item_id' ];
        var uids = [ openedProduct.uid, revisedElement.uid, selectedAdoptedObject.uid ];

        dataManagementService.getProperties( uids, propsToLoad ).then( function() {
            if( openedProduct.props.item_id.dbValues[ '0' ] === revisedElement.props.item_id.dbValues[ '0' ] ) {
                if( !appCtxService.ctx.aceActiveContext.context.isOpenedUnderAContext ) {
                    openRevisedObject( revisedElement, page, pageId );
                }
            } else {
                if( selectedAdoptedObject.props.item_id.dbValues[ '0' ] !== revisedElement.props.item_id.dbValues[ '0' ] ) {
                    openRevisedObject( revisedElement, page, pageId );
                } else if( appCtxService.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                    refreshGivenView( appCtxService.ctx.aceActiveContext.key );

                    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();

                    if( inactiveView && occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveView, appCtxService.ctx.selected ).length > 0 &&
                        !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
                        refreshGivenView( inactiveView );
                    }
                } else {
                    openRevisedObject( revisedElement, page, pageId );
                }
            }
        } );
    } );
};

export let getReviseInputs = function( mselected ) {
    var deferred = AwPromiseService.instance.defer();
    var reviseInputsArray = [];
    var reviseInputsMap = new Map();
    var impactedItems = mselected;
    for ( var i = 0; i < impactedItems.length; i++ ) {
        var reviseInputs = {};
        if ( impactedItems[i].modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            reviseInputs.item_revision_id = [ '' ];
        }
        var pSelected = appCtxService.ctx.pselected;
        if( pSelected.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            reviseInputs.fnd0ContextProvider = [ pSelected.props.awb0UnderlyingObject.dbValues[ 0 ] ];
        } else{
            reviseInputs.fnd0ContextProvider = [ appCtxService.ctx.pselected.uid ];
        }
        var reviseInput = {};
        reviseInput.targetObject = impactedItems[i];
        reviseInput.reviseInputs = reviseInputs;
        reviseInputsArray.push( reviseInput );
        reviseInputsMap.set( impactedItems[i].uid, reviseInput );
    }

    var promise = self.setReviseInDeepCopyData( impactedItems, reviseInputsMap );
    if ( promise ) {
        promise.then( function( response ) {
            deferred.resolve( response );
        } );
    }
    return deferred.promise;
};

/**
   * Set deep copy data in revise inputs
   *
   * @param impactedItems The impacted items
   * @param reviseInputsMap Map of impacted items to their reviseIn
   * @return A list of revise inputs with the deep copy datas
   */
self.setReviseInDeepCopyData = function( impactedItems, reviseInputsMap ) {
    var deferred = AwPromiseService.instance.defer();
    var deepCopyDataInputs = [];
    for ( var i = 0; i < impactedItems.length; i++ ) {
        var dcd = {
            operation: 'Revise',
            businessObject: impactedItems[i]
        };
        deepCopyDataInputs.push( dcd );
    }

    var inputData = {
        deepCopyDataInput: deepCopyDataInputs
    };

    var deepCopyInfoMap = [];
    var promise = soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData );
    if ( promise ) {
        promise.then( function( response ) {
            if ( response !== undefined ) {
                deepCopyInfoMap = response.deepCopyInfoMap;
                for ( var i = 0; i < impactedItems.length; i++ ) {
                    for ( var b in deepCopyInfoMap[0] ) {
                        if ( deepCopyInfoMap[0][b].uid === impactedItems[i].uid ) {
                            var reviseIn = reviseInputsMap.get( deepCopyInfoMap[0][b].uid );
                            reviseIn.deepCopyDatas = self.convertDeepCopyData( deepCopyInfoMap[1][b] );
                            break;
                        }
                    }
                }
            }
            deferred.resolve( Array.from( reviseInputsMap.values() ) );
        } );
    }
    return deferred.promise;
};

/**
   * Convert Deep Copy Data from client to server format
   *
   * @param deepCopyData property name
   * @return A list of deep copy datas
   */
self.convertDeepCopyData = function( deepCopyData ) {
    var deepCopyDataList = [];
    for ( var i = 0; i < deepCopyData.length; i++ ) {
        var newDeepCopyData = {};
        newDeepCopyData.attachedObject = deepCopyData[i].attachedObject;
        newDeepCopyData.copyAction = deepCopyData[i].propertyValuesMap.copyAction[0];
        newDeepCopyData.propertyName = deepCopyData[i].propertyValuesMap.propertyName[0];
        newDeepCopyData.propertyType = deepCopyData[i].propertyValuesMap.propertyType[0];

        var value = false;
        var tempStrValue = deepCopyData[i].propertyValuesMap.copy_relations[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.copyRelations = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isTargetPrimary[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isTargetPrimary = value;

        value = false;
        tempStrValue = deepCopyData[i].propertyValuesMap.isRequired[0];
        if ( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isRequired = value;

        newDeepCopyData.operationInputTypeName = deepCopyData[i].operationInputTypeName;

        var operationInputs = {};
        operationInputs = deepCopyData[i].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        var aNewChildDeepCopyData = [];
        if ( deepCopyData[i].childDeepCopyData && deepCopyData[i].childDeepCopyData.length > 0 ) {
            aNewChildDeepCopyData = self.convertDeepCopyData( deepCopyData[i].childDeepCopyData );
        }
        newDeepCopyData.childDeepCopyData = aNewChildDeepCopyData;
        deepCopyDataList.push( newDeepCopyData );
    }

    return deepCopyDataList;
};

/**
 * Fresh reloads the revised Objects.
 *
 * @param {Object} eventdata eventdata with revised Objects.
 *
 */
export const reloadRevisedObjects = function( eventdata ) {
    var updateContentInputs = [];
    var currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );

    let selectedObjectsMap = new Map();
    for( let j = 0; j < eventdata.selectedObjects.length; j++ ) {
        selectedObjectsMap.set( eventdata.selectedObjects[j].props.awb0UnderlyingObject.dbValues[0], eventdata.selectedObjects[j] );
    }

    for( let i = 0; i < eventdata.revisedObjects.length; i++ ) {
        if( eventdata.revisedObjects[i].objectCopy.uid !== 'AAAAAAAAAAAAAA' ) {
            // Add matching selected object to updateContentInputs
            let selectedObject = selectedObjectsMap.get( eventdata.revisedObjects[i].originalObject.uid );
            if( selectedObject ) {
                let pci = occmgmtUtils.getProductContextInfoForProvidedObject( selectedObject, currentContext );
                let pciObject = cdmService.getObject( pci );

                let updateContentInput = {
                    element: selectedObject,
                    workspaceObject: {
                        uid: eventdata.revisedObjects[ i ].objectCopy.uid,
                        type: eventdata.revisedObjects[ i ].objectCopy.type
                    },
                    productContext: {
                        uid: pciObject.uid,
                        type: pciObject.type
                    }
                };

                updateContentInputs.push( updateContentInput );
            }
        }
    }

    var inputData = {
        input: {
            updateContentInputs: updateContentInputs
        }
    };

    return soaSvc.post( 'Internal-ActiveWorkspaceBom-2024-12-OccurrenceManagement', 'updateContentBasedOnRevision3', inputData ).then(
        function( response ) {
            return response;
        }
    );
};

export let getTotalNumberOfRevisedObjects = function( data ) {
    var totalRevisedObjects = 0;
    for( let i = 0; i < data.reviseTrees.length; i++ ) {
        if( data.reviseTrees[i].objectCopy.uid !== 'AAAAAAAAAAAAAA' ) {
            totalRevisedObjects++;
        }
    }
    return totalRevisedObjects;
};

export let getReviseMultipleErrorMessage = function( data ) {
    var errorMessage = '';
    var prevIndex = 0;

    if( data.ServiceData.partialErrors ) {
        for( var x = 0; x < data.ServiceData.partialErrors.length; x++ ) {
            for( let i = prevIndex; i < data.reviseTrees.length; i++ ) {
                prevIndex++;
                if( data.reviseTrees[i].objectCopy.uid === 'AAAAAAAAAAAAAA' ) {
                    errorMessage += appCtxService.ctx.mselected[ i ].props.awb0UnderlyingObject.uiValues[ 0 ];
                    errorMessage += ' - ';
                    errorMessage += data.ServiceData.partialErrors[x].errorValues[0].message;
                    errorMessage += '<BR/>';

                    break;
                }
            }
        }
    }
    return errorMessage;
};

export default exports = {
    performPostReviseAction,
    getReviseInputs,
    reloadRevisedObjects,
    getTotalNumberOfRevisedObjects,
    getReviseMultipleErrorMessage
};
