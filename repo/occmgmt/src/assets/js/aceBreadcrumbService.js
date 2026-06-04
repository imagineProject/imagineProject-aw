// Copyright (c) 2022 Siemens

/**
 * @module js/aceBreadcrumbService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import acePartialSelectionService from 'js/acePartialSelectionService';

var exports = {};

export let _onSelectCrumb = function( occContext, crumb ) {
    exports.onSelectBreadcrumb( crumb, occContext );
};

export let getSelectionForBreadcrumb = function( selections, baseSelection ) {
    var selectedObjects = [];
    if( selections && selections.length > 0 ) {
        selectedObjects = selections;
    } else if( baseSelection ) {
        selectedObjects = [ baseSelection ];
    }

    return selectedObjects.map( ( selection ) => {
        return cdm.getObject( selection.uid );
    } );
};

/**
 * insertCrumbsFromModelObject
 *
 * @param {IModelObject} modelObject - model object
 * @param {Object} breadCrumbProvider - bread crumb provider
 * @param {Object} occContext - occContext
 * @return {Object} bread crumb provider
 */
export let insertCrumbsFromModelObject = function( modelObject, breadCrumbProvider, occContext ) {
    if( modelObject && modelObject.props && modelObject.props.object_string && breadCrumbProvider ) {
        var props = modelObject.props;
        var crumb = {
            displayName: props.object_string.uiValues[ 0 ],
            showArrow: props.awb0NumberOfChildren ? props.awb0NumberOfChildren.dbValues[ 0 ] > 0 : true,
            selectedCrumb: false,
            scopedUid: modelObject.uid,
            clicked: false,
            occContext: occContext,
            onCrumbClick: ( crumb ) => _onSelectCrumb( occContext, crumb )
        };

        breadCrumbProvider.crumbs.splice( 0, 0, crumb );

        var parentUid = occmgmtUtils.getParentUid( modelObject );
        if( parentUid ) {
            var parentModelObj = cdm.getObject( parentUid );

            if( parentModelObj ) {
                return exports.insertCrumbsFromModelObject( parentModelObj, breadCrumbProvider, occContext );
            }
        } else {
            // When the root object is not type of Awb0Element
            if( modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) === -1 ) {
                var openedObject = cdm.getObject( occContext.currentState.uid );
                // And the root object is not the opened object
                if( openedObject !== modelObject ) {
                    // Add the opened object as the first node of the breadcrumb
                    var crumbOpenedObject = {
                        displayName: openedObject.props.object_string.uiValues[ 0 ],
                        showArrow: true,
                        selectedCrumb: false,
                        scopedUid: openedObject.uid,
                        clicked: false,
                        occContext: occContext,
                        onCrumbClick: ( crumb ) => _onSelectCrumb( occContext, crumb )
                    };

                    breadCrumbProvider.crumbs.splice( 0, 0, crumbOpenedObject );
                }
            }
        }
    }

    return breadCrumbProvider;
};

/**
 * Create and insert crumbs in case of multi-selection
 * only two crumbs will be shown in breadcrumb
 * first crumb is topElement - indicates common parent of all
 * second crumb is N selected where, N is number of objects selected in PWA
 *
 * @param {Object} selectedObjects - selected objects
 * @param {Object} breadCrumbProvider - bread crumb provider
 * @param {Object} occContext - occContext
 * @return {Object} bread crumb provider
 */
let insertCrumbsForMultiSelection = function( selectedObjects, breadCrumbProvider, occContext ) {
    let selectedLabel = localeService.getLoadedText( 'UIMessages' ).Selected;
    let nSelectedCrumb = {
        displayName: selectedObjects.length + ' ' + selectedLabel,
        selectedCrumb: true,
        clicked: false
    };
    breadCrumbProvider.crumbs.splice( 0, 0, nSelectedCrumb );

    let commonParentCrumb = {
        displayName: occContext.topElement.props.object_string.uiValues[ 0 ],
        showArrow: occContext.topElement.props.awb0NumberOfChildren ? occContext.topElement.props.awb0NumberOfChildren.dbValues[ 0 ] > 0 : true,
        selectedCrumb: false,
        scopedUid: occContext.topElement.uid,
        clicked: false,
        occContext: occContext,
        onCrumbClick: ( crumb ) => _onSelectCrumb( occContext, crumb )
    };
    breadCrumbProvider.crumbs.splice( 0, 0, commonParentCrumb );

    return breadCrumbProvider;
};

/**
 * @param {Object} selectedCrumb - selected crumb object
 * @param {String} occContext - occContext
 */
export let onSelectBreadcrumb = function( selectedCrumb, occContext ) {
    var elementToSelect = cdm.getObject( selectedCrumb.scopedUid );

    let isNotAwb0Element = elementToSelect.modelType && elementToSelect.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) === -1;
    let isStructure4G = occContext && occContext.supportedFeatures && occContext.supportedFeatures['4GStructureFeature'];


    if( isNotAwb0Element || ( selectedCrumb.scopedUid === occContext.currentState.t_uid && isStructure4G ) ) {
        if( occContext.pwaSelection.length === 1 ) {
            let selectionsToModify = {};
            selectionsToModify.clearExistingSelections = true;
            occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsToModify, occContext );
        } else {
            // In multi-select mode, node selected from breadcrumb gets added to the selection.
            // In session or swc, if user clicks top node from breadcrumb in multi-select mode, nothing happens in UI as there is no node to select in PWA.
            // Hence, we should simply return without updating selectionsToModify.
            return;
        }
    } else {
        acePartialSelectionService.getObjectsToHighlightForGivenObjects( [ elementToSelect ] ).then( function( selectionsInfo ) {
            occmgmtUtils.updateValueOnCtxOrState( 'selectionsToModify', selectionsInfo, occContext );
        } );
    }
};

/**
 * buildNavigateBreadcrumb
 *
 * @param {IModelObject} selectedObjects - selected model objects
 * @param {String} occContext - occContext
 * @param {Object} data the viewModel data object
 * @param {Boolean} selectionCrumbOnly only show selection crumb
 * @return {Object} breadCrumbProvider bread crumb provider
 */
export let buildNavigateBreadcrumb = function( selectedObjects, occContext, data, selectionCrumbOnly ) {
    let breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];

    if( selectionCrumbOnly ) {
        breadCrumbProvider = _insertSelectionCrumbOnly( selectedObjects, breadCrumbProvider, occContext );
    }else{
        if( selectedObjects && selectedObjects.length > 1 ) {
            breadCrumbProvider = insertCrumbsForMultiSelection( selectedObjects, breadCrumbProvider, occContext );
        } else {
            let modelObject = _.last( selectedObjects );
            if( !modelObject || _.isEmpty( modelObject.props ) ) {
                return breadCrumbProvider;
            }
            breadCrumbProvider = exports.insertCrumbsFromModelObject( modelObject, breadCrumbProvider, occContext );
        }
    }
    if( breadCrumbProvider && breadCrumbProvider.crumbs && breadCrumbProvider.crumbs.length > 0 ) {
        breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
        breadCrumbProvider.crumbs[ 0 ].primaryCrumb = true;
    }
    if( !isSameCrumb( data.crumbs, breadCrumbProvider.crumbs ) ) {
        data.dispatch( { path: 'data.crumbs', value: breadCrumbProvider.crumbs } );
    }

    return breadCrumbProvider;
};

let isSameCrumb = ( existingCrumbs, newCrumbs ) => {
    if( _.isUndefined( existingCrumbs ) ) {
        return false;
    }
    const existingCrumbsLength = Object.keys( existingCrumbs ).length;
    const newCrumbsLength = Object.keys( newCrumbs ).length;
    if( existingCrumbsLength !== newCrumbsLength ) {
        return false;
    }

    for( let i = 0; i < existingCrumbsLength; i++ ) {
        let existingCrumb = existingCrumbs[ i ];
        let newCrumb = newCrumbs[ i ];
        if( existingCrumb.scopedUid !== newCrumb.scopedUid || existingCrumb.displayName !== newCrumb.displayName || existingCrumb.selectedCrumb !== newCrumb.selectedCrumb ) {
            return false;
        }
    }
    return true;
};

/**
 * Create and insert only selection crumbs in case of single or multi-selection
 * only selection crumb will be shown in breadcrumb
 *
 * @param {Object} selectedObjects - selected objects
 * @param {Object} breadCrumbProvider - bread crumb provider
 * @param {Object} occContext - occContext
 * @return {Object} bread crumb provider
 */
let _insertSelectionCrumbOnly = function( selectedObjects, breadCrumbProvider, occContext ) {
    let selectionCrumbDisplayName = '';

    if( selectedObjects && selectedObjects.length > 1 ) {
        var selectedLabel = localeService.getLoadedText( 'UIMessages' ).Selected;
        selectionCrumbDisplayName = selectedObjects.length + ' ' + selectedLabel;
    } else {
        var modelObject;
        if( _.isUndefined( selectedObjects ) ) {
            // If selectedObjects is undefined then selection crumb shows opened object i.e ECN
            modelObject = cdm.getObject( occContext.currentState.uid );
        } else{
            modelObject = _.last( selectedObjects );
        }
        selectionCrumbDisplayName = modelObject.props.object_string.uiValues[ 0 ];
    }

    let selectedCrumb = {
        clicked: false,
        displayName: selectionCrumbDisplayName
    };

    breadCrumbProvider.crumbs.splice( 0, 0, selectedCrumb );
    return breadCrumbProvider;
};

export default exports = {
    insertCrumbsFromModelObject,
    onSelectBreadcrumb,
    buildNavigateBreadcrumb,
    getSelectionForBreadcrumb
};
