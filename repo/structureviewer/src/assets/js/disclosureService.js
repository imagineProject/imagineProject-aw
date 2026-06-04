// Copyright (c) 2022 Siemens

/**
 * This module holds structure viewer 3D data
 *
 * @module js/disclosureService
 */
import _ from 'lodash';
import logger from 'js/logger';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import soaService from 'soa/kernel/soaService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import localeService from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';

var exports = {};

/**
 * Initialize disclosure view
 * @param {Object} subPanelContext Sub panel context
 */
export let getDisclosureContext = function( subPanelContext ) {
    let modelObject = subPanelContext.modelObject;
    let inputData = {
        primaryObjects: [ modelObject ],
        pref: {
            expItemRev: false,
            returnRelations: true,
            info: [ {
                relationTypeName: 'Fnd0DisclosingObject'
            } ]
        }
    };

    return soaService.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForPrimary', inputData ).then( ( response ) => {
        if( Array.isArray( response.output ) && response.output[ 0 ] &&
            Array.isArray( response.output[ 0 ].relationshipData ) && response.output[ 0 ].relationshipData[ 0 ] &&
            Array.isArray( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) && response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ] ) {
            let disclosureContext = subPanelContext;
            disclosureContext.viewer3DContext = cdm.getObject( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ 0 ].otherSideObject.uid );
            return disclosureContext;
        }
    } ).catch( ( error ) => {
        logger.error( 'failed to load relation : ' + error );
        throw 'Could not find collector structure';
    } );
};

/**
 * Has model view proxies data
 * @param {Object} rootElementUid - Sub panel context
 */
export let hasDisclosedModelViewData = function( rootElementUid ) {
    try {
        if( rootElementUid ) {
            let rootElement = cdm.getObject( rootElementUid );
            if( rootElement ) {
                return dmSvc.getProperties( [ rootElementUid ], [ 'fnd0DisclosedModelViewData' ] ).then( () => {
                    return rootElement.props.fnd0DisclosedModelViewData && Array.isArray( rootElement.props.fnd0DisclosedModelViewData.dbValues ) &&
                        rootElement.props.fnd0DisclosedModelViewData.dbValues.length > 0;
                } );
            } else {
                return AwPromiseService.instance.resolve( false );
            }
        } else {
            return AwPromiseService.instance.resolve( false );
        }
    } catch ( error ) {
        logger.error( 'Error getting disclosed model view data' );
        return AwPromiseService.instance.resolve( false );
    }
};

/**
 * Load model object proxies
 * @param {Object} rootElementUid - Sub panel context
 */
export let loadModelObjectProxies = function() {
    let aceContext = appCtxService.getCtx( 'aceActiveContext' );
    let currentContext = appCtxService.getCtx( aceContext.key );
    let rootElementUid = currentContext.currentState.uid;
    let rootElement = cdm.getObject( rootElementUid );
    let mvpList = [];
    return dmSvc.getProperties( [ rootElementUid ], [ 'fnd0DisclosedModelViewData' ] ).then( () => {
        return dmSvc.getProperties( rootElement.props.fnd0DisclosedModelViewData.dbValues, [ 'fnd0ModelViewPalette', 'fnd0OwningModel', 'fnd0OwningUser', 'fnd0DisclosedModelView' ] ).then(
            () => {
                _.forEach( rootElement.props.fnd0DisclosedModelViewData.dbValues, mvp => {
                    let vmpVMO = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( mvp ), 'Edit' );
                    vmpVMO.cellHeader1 = vmpVMO.props.object_string.dbValues[ 0 ];
                    vmpVMO.cellHeader2 = vmpVMO.props.fnd0ModelViewPalette.uiValues[ 0 ];
                    vmpVMO.cellProperties = [ {
                            key: localeService.getLoadedText( 'StructureViewerMessages' ).OwningModel,
                            value: vmpVMO.props.fnd0OwningModel.displayValues[ 0 ]
                        },
                        {
                            key: localeService.getLoadedText( 'StructureViewerMessages' ).OwningUser,
                            value: vmpVMO.props.fnd0OwningUser.uiValues[ 0 ]
                        }
                    ];
                    mvpList.push( vmpVMO );
                } );
                return {
                    mvResults: mvpList,
                    totalMVFound: mvpList.length
                };
            } );
    } ).catch( ( error ) => {
        logger.error( error );
    } );
};

export default exports = {
    getDisclosureContext,
    loadModelObjectProxies,
    hasDisclosedModelViewData
};
