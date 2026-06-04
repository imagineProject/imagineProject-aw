// Copyright (c) 2022 Siemens

/**
 * Helper class for graphical renderer for Schedule Manager
 *
 * @module propRenderTemplates/Saw1GraphicalRendererHelper
 */
import { getBaseUrlPath } from 'app';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxService from 'js/appCtxService';
import smConstants from 'js/ScheduleManagerConstants';
import schNavigationDepCacheService from 'js/ScheduleNavigationDependencyCacheService';
import scheduleNavigationTreeRowService from 'js/scheduleNavigationTreeRowService';

let getModelObjectFromVMO = ( vmo, column ) => {
    let uid = vmo.uid;
    // Compare tab contains UID of the object/Awp0XRTObjectSetRow as column
    if( !uid && vmo.props && vmo.props.transposedColumnProperty ) {
        uid = column;
    }

    let modelObject = cdm.getObject( uid );
    if (modelObject)
    {
         // Object Set contains the Awp0XRTObjectSetRow objects.
        if( modelObject.modelType && modelObject.modelType.typeHierarchyArray.indexOf( 'Awp0XRTObjectSetRow' ) >= 0 && modelObject.props.awp0Target ) {
            modelObject = cdm.getObject( modelObject.props.awp0Target.dbValues[ 0 ] );
        }
        return modelObject;
    }
};

let addIndicator = ( childElement, dbValue, uiValue, constantMap ) => {
    if( constantMap && constantMap[ dbValue ] ) {
        let imageElement = document.createElement( 'img' );
        imageElement.className = 'aw-visual-indicator';
        let imagePath = getBaseUrlPath() + '/image/';
        imageElement.title = uiValue;
        imagePath += constantMap[ dbValue ];
        imageElement.src = imagePath;
        imageElement.alt = uiValue;
        childElement.appendChild( imageElement );
    }
};

/*
 * @param { Object } vmo - ViewModelObject for which status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which state will be rendered
 * @param { String } column - The column in which the property is rendered.
 */
export let renderStateFlags = function( vmo, containerElem, column ) {
    let childElement = document.createElement( 'div' );

    let modelObject = getModelObjectFromVMO( vmo, column );
    if( modelObject && cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) && vmo.props && vmo.props[column] && vmo.props[column].dbValue ) {
        addIndicator( childElement, vmo.props[column].dbValue, vmo.props[column].uiValue, smConstants.SCHEDULE_TASK_RENDERER_STATE_ICON_MAP );
    }
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += vmo && vmo.props && vmo.props[column] && vmo.props[column].uiValue ? vmo.props[column].uiValue : ' ';
    containerElem.appendChild( childElement );
};

/*
 * @param { Object } vmo - ViewModelObject for which status is being rendered
 * @param { Object } containerElem - The container DOM Element inside which status will be rendered
 * @param { String } column - The column in which the property is rendered.
 */
export let renderStatusFlags = function( vmo, containerElem, column ) {
    let childElement = document.createElement( 'div' );

    let modelObject = getModelObjectFromVMO( vmo, column );
    if( modelObject && ( cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType ) || cmm.isInstanceOf( 'Fnd0ProxyTask', modelObject.modelType ) ) && vmo.props && vmo.props[column] && vmo.props[column].dbValue ) {
        addIndicator( childElement, vmo.props[column].dbValue, vmo.props[column].uiValue, smConstants.SCHEDULE_TASK_RENDERER_STATUS_ICON_MAP );
    }
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += vmo && vmo.props && vmo.props[column] && vmo.props[column].uiValue ? vmo.props[column].uiValue : ' ';
    containerElem.appendChild( childElement );
};

/*
 * @param { Object } vmo - ViewModelObject for which state is being rendered
 * @param { Object } containerElem - The container DOM Element inside which release status will be rendered
 */
export let renderRowNumbers = function( vmo, containerElem ) {
    if( appCtxService.ctx && appCtxService.ctx.scheduleNavigationCtx && appCtxService.ctx.scheduleNavigationCtx.treeNodeUids && appCtxService.ctx.scheduleNavigationCtx.treeNodeUids.length > 0 ) {
        var cacheTreeNode = appCtxService.ctx.scheduleNavigationCtx.treeNodeUids;
        var index = cacheTreeNode.indexOf( vmo.uid );
        var rowNumber = index + 1;
        let taskDepDispValue = rowNumber.toString();
        let childElement = document.createElement( 'div' );
        childElement.className = 'aw-splm-tableCellText';
        childElement.innerHTML += taskDepDispValue;
        containerElem.appendChild( childElement );
    }
};

/**
 * Adds a renderer to the dependency cell
 * @param {Object} dependenciesInfo Dependency Information
 * @param {Object} vmo View Model Object
 * @param {String} column Name of the property rendered as column
 * @param {Object} containerElem Cell element to add the renderer
 */
let renderDependencyValue = ( dependenciesInfo, vmo, column, containerElem ) => {
    let currentValue = '';
    if ( dependenciesInfo && Array.isArray( dependenciesInfo.displayValues ) ) {
        currentValue = dependenciesInfo.displayValues.join( ',' );
    }

    let newValue = _.get( vmo, [ 'props', column, 'dbValue' ], null );
    if ( newValue !== null && currentValue !== newValue ) {
        if ( vmo.props[ column ].displayValues[ 0 ] !== vmo.props[ column ].prevDisplayValues[ 0 ] ) {
            currentValue = scheduleNavigationTreeRowService.saveDependencyEdits( vmo, column, currentValue, newValue );
        }
    }
    let childElement = document.createElement( 'div' );
    childElement.className = 'aw-splm-tableCellText';
    childElement.innerHTML += currentValue ? currentValue : ' ';
    containerElem.appendChild( childElement );
};

/*
 * @param { Object } vmo - ViewModelObject for which predecessor is being rendered
 * @param { Object } containerElem - The container DOM Element inside which predecessor will be rendered
 * @param { Object } column - Name of the property rendered as column
 */
export let renderPredecessors = function ( vmo, containerElem, column ) {
    let dependenciesInfo = schNavigationDepCacheService.getTaskPredDependencies( vmo.uid );
    renderDependencyValue( dependenciesInfo, vmo, column, containerElem );
};

/*
 * @param { Object } vmo - ViewModelObject for which successor is being rendered
 * @param { Object } containerElem - The container DOM Element inside which successor will be rendered
 * @param { Object } column - Name of the property rendered as column
 */
export let renderSuccessors = function ( vmo, containerElem, column ) {
    let dependenciesInfo = schNavigationDepCacheService.getTaskSuccDependencies( vmo.uid );
    renderDependencyValue( dependenciesInfo, vmo, column, containerElem );
};

export default {
    renderStateFlags,
    renderStatusFlags,
    renderRowNumbers,
    renderSuccessors,
    renderPredecessors
};
