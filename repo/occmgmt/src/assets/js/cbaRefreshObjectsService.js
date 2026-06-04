// Copyright (c) 2022 Siemens

/**
 * Service to refresh objects in CBA.
 *
 * @module js/cbaRefreshObjectsService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import adapterSvc from 'js/adapterService';
import cdmSvc from 'soa/kernel/clientDataModel';


/**
 * Get elements to refresh
 * @param {Array} primarySelection - Primary elements to refresh
 * @param {Array} secondarySelection - Secondary elements to refresh in other view if present
 * @returns {Array} - List of elements to refresh
 */
export let getElementsToRefresh = function( primarySelection, secondarySelection ) {
    let elementsToRefresh = primarySelection.slice();
    if( appCtxSvc.ctx.splitView ) {
        let inactiveViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveViewKey && appCtxSvc.ctx[ inactiveViewKey ] && appCtxSvc.ctx[ inactiveViewKey ].vmc && !occmgmtSplitViewUpdateService.isConfigSameInBothViews() ) {
            let affectedElementsInInactiveView = exports.getAffectedElementPresentInView( inactiveViewKey, secondarySelection );
            elementsToRefresh = elementsToRefresh.concat( affectedElementsInInactiveView );
        }
    }
    return elementsToRefresh;
};

/**
 * Get underlying object's UID for given element
 * @param {object} element - Object for which underlying object UID to fetch
 * @returns {string} - underlying object UID
 */
export let getUnderlyingObjectUID = function( element ) {
    let uid;
    if( element.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        uid = _.get( element, 'props.awb0UnderlyingObject.dbValues[0]' );
    } else {
        let adaptedObjs = adapterSvc.getAdaptedObjectsSync( [ element ] );
        uid = adaptedObjs && adaptedObjs[ 0 ] ? adaptedObjs[ 0 ].uid : undefined;
    }
    return uid;
};

/**
 * Check if element is present in view or not
 * @param {string} view - View to check elements
 * @param {object} affectedElements - Elements to check
 * @returns {Array} - Elements present in view
 */
export let getAffectedElementPresentInView = function( view, affectedElements ) {
    let affectedElementsInView = [];
    _.forEach( affectedElements, function( affectedElement ) {
        let underlyingObjUID = exports.getUnderlyingObjectUID( affectedElement );
        let filteredVMO = appCtxSvc.ctx[ view ].vmc.loadedVMObjects.filter( function( vmo ) {
            let underlyingObjectOfVO = exports.getUnderlyingObjectUID( vmo );
            if( !_.isEmpty( underlyingObjectOfVO ) && !_.isEmpty( underlyingObjUID ) && _.isEqual( underlyingObjectOfVO, underlyingObjUID ) ) {
                return true;
            }
            return false;
        } );
        affectedElementsInView = affectedElementsInView.concat( filteredVMO );
    } );
    return affectedElementsInView;
};

let _resetNumberOfChildrenPropertyValue = function( viewModelobject ) {
    if( _.isUndefined( viewModelobject ) ) {
        return;
    }
    let propertyObject = _.get( viewModelobject, 'props.awb0NumberOfChildren' );
    if( _.isUndefined( propertyObject ) ) {
        return;
    }
    propertyObject.dbValue = 0;
    propertyObject.dbValues = [ '0' ];
    propertyObject.uiValue = 0;
    propertyObject.uiValues = [ '0' ];
    propertyObject.uiValue = 0;
    propertyObject.displayValues = [ '0' ];
};

/**
 * This API sets isLeaf property of ViewModelTreeNode to true for the solution variant elements.
 * It disables the solution variant structure expansion in CBA UI.
 * @param {object} vmo - The view model object
 */
export let markSolutionVariantNodesAsLeafNode = function( vmo ) {
    if( vmo && vmo.props && vmo.props.awb0IsVi ) {
        if( vmo.props.awb0IsVi.dbValues[ 0 ] === '1' && !vmo.isLeaf ) {
            _resetNumberOfChildrenPropertyValue( vmo );
            let modelObj = cdmSvc.getObject( vmo.uid );
            _resetNumberOfChildrenPropertyValue( modelObj );
            cdmSvc.cacheObjects( [ modelObj ] );
            vmo.isLeaf = true;
        }
    }
};

const exports = {
    getElementsToRefresh,
    getUnderlyingObjectUID,
    getAffectedElementPresentInView,
    markSolutionVariantNodesAsLeafNode
};

export default exports;
