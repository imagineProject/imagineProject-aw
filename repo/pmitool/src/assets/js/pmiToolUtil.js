// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pmiToolUtil
 */
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import viewerPmiManager from 'js/viewerPmiManagerProvider';
import modelPropertySvc from 'js/modelPropertyService';
import localeSvc from 'js/localeService';
import _ from 'lodash';

var exports = {};

/**
  * Modify Model View Data
  *
  * @param {Object} data from raw data
  * @returns {Object} parsed ModelView data.
  */
export let parseModelViewData = function( data ) {
    var modelViewEntities = [];
    let mvIndex = 0;
    if( _.isArray( data ) ) {
        _.forEach( data, function( entityValue ) {
            if( _.isArray( entityValue ) && _.size( entityValue ) >= 3 ) {
                var modelViewEntity = {
                    mvIndex: mvIndex++,
                    modelViewId: entityValue[ 0 ],
                    value: entityValue[ 1 ],
                    //type: entityValue[ 1 ],
                    resourceId: entityValue[ 3 ],
                    isGroup: true,
                    //propertyDisplayName: entityValue[ 1 ],
                    label: entityValue[ 1 ],
                    selected: false, //handles aw-tree selection
                    isVisibilityOn: entityValue[ 2 ] === 'true' //handles if the visibility is on once the panel is open
                };

                modelViewEntities.push( modelViewEntity );
            }
        } );
    }

    return modelViewEntities;
};

/**
  * Raw  Pmi entity data which means this data doesn't have widgets
  *
  * @param {Object} data pmi entity raw data
  * @param {Object} pmiRawEntityState pmi entity raw data
  * @returns {Object} raw pmi entity data .
  */

export let parseRawPmiEntityData = function( data, pmiRawEntityState ) {
    let newPmiRawEntityState = { ...pmiRawEntityState.getValue() };
    let rawPMIEntities = [];
    let index = 0;
    if( _.isArray( data ) ) {
        _.forEach( data, function( entityValue ) {
            if( _.isArray( entityValue ) && _.size( entityValue ) > 3 ) {
                var pmiEntity = {
                    index: index++,
                    id:entityValue[0],
                    value: entityValue[ 1 ],
                    type: entityValue[ 2 ],
                    resourceId: entityValue[ 4 ],
                    parentModelView: new Set(),
                    label: entityValue[ 1 ],
                    isVisibilityOn: entityValue[ 3 ] === 'true',
                    selected:entityValue[5],  //handles if the selection is on once the panel is open
                    uniqueId:entityValue[6]
                };
                if( pmiEntity.selected ) {
                    newPmiRawEntityState.previousSelectedPmiEntity.position = pmiEntity.index;
                    newPmiRawEntityState.previousSelectedPmiEntity.child = true;
                }
                rawPMIEntities.push( pmiEntity );
            }
        } );
    }

    newPmiRawEntityState.pmiEntityRawData = rawPMIEntities;
    pmiRawEntityState.update( newPmiRawEntityState );

    return rawPMIEntities;
};

/**
  * Modify Pmi entity data
  *
  * @param {Object} pmiEnityRawData pmi entity raw data
  * @param {Object} entitiesState pmi entity raw data
  * @returns {Object} entitiesState parsed entities data.
  */
export let parsePmiEntityData = function( pmiEnityRawData, entitiesState ) {
    let pmiEntities = [];
    let newEntitiesState = { ...entitiesState.getValue() };
    let widgetsProperties = {
        checkbox: {
            displayName: '',
            type: 'BOOLEAN',
            dbValue: '',
            dispValue: '',
            labelPosition: 'PROPERTY_LABEL_AT_RIGHT'
        }
    };
    if( _.isArray( pmiEnityRawData ) ) {
        _.forEach( pmiEnityRawData, function( entityValue ) {
            let pmiEntity = {
                index: entityValue.index,
                resourceId: entityValue.resourceId,
                type: entityValue.type,
                label: entityValue.label,
                selected:entityValue.selected,  //handles if the selection is on once the panel is open
                uniqueId:entityValue.uniqueId
            };
            if( _.isUndefined( entityValue.checkbox ) ) {
                widgetsProperties.checkbox.dbValue = entityValue.isVisibilityOn;
                widgetsProperties.checkbox.uiValue = entityValue.isVisibilityOn ? 'True' : 'False';
                pmiEntity.checkbox = modelPropertySvc.createViewModelProperty( widgetsProperties.checkbox );
            } else{
                pmiEntity.checkbox.dbValue = entityValue.isVisibilityOn;
                pmiEntity.checkbox.uiValue = entityValue.isVisibilityOn ? 'True' : 'False';
            }
            if( entityValue.isVisibilityOn ) {
                newEntitiesState.lastCheckedTypeViewModel.push( pmiEntity.index );
            }
            pmiEntities.push( pmiEntity );
        } );
        newEntitiesState.entities = pmiEntities;
    }
    entitiesState.update( newEntitiesState );
    var typeGroupedPmiEntities = _.groupBy( pmiEntities, 'type' );
    var groupKeys = _.keys( typeGroupedPmiEntities );
    var typesViewModelArray = [];
    let index = 0;
    let updatedEntityState = { ...entitiesState.getValue() };
    _.forEach( groupKeys, function( key ) {
        let value = index++;
        var displayEntity = {
            index: value,
            label: key,
            selected: false,
            expanded: updatedEntityState.entities && updatedEntityState.entities.length > 0  && updatedEntityState.entities[value].expanded ?
                updatedEntityState.entities[value].expanded : false,
            children: typeGroupedPmiEntities[ key ]
        };
        let children = _.filter( typeGroupedPmiEntities[ key ], entity => entity.checkbox.dbValue );
        if( _.isUndefined( displayEntity.checkbox ) ) {
            widgetsProperties.checkbox.dbValue = children.length === typeGroupedPmiEntities[ key ].length;
            widgetsProperties.checkbox.uiValue = children.length === typeGroupedPmiEntities[ key ].length ? 'True' : 'False';
            displayEntity.checkbox = modelPropertySvc.createViewModelProperty( widgetsProperties.checkbox );
        } else{
            displayEntity.checkbox = children.length === typeGroupedPmiEntities[ key ].length;
        }
        typesViewModelArray.push( displayEntity );
    } );

    return typesViewModelArray;
};

/**
  * @returns {Boolean} true if is in Ace sublocation.
  */
export let isInAce = function() {
    let sublocationCtx = appCtxSvc.getCtx( 'sublocation' );
    return sublocationCtx.nameToken === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' &&
         ( !sublocationCtx.label || sublocationCtx.label !== 'Disclosure' );
};

/**
  * gets selection display name
  * @return {String} selection display name
  */
export let getSelectionDisplayName = function( viewerContextData ) {
    let pmiToolTargetList = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGET_LIST );
    var selection = pmiToolTargetList[ 0 ];
    var object = viewModelObjectService.constructViewModelObjectFromModelObject( selection );

    return object.cellHeader1;
};

/**
  * gets local text bundle
  * @returns {Object} text bundle
  */
var _getLocalTextBundle = function() {
    var resource = 'PmiToolMessages.json';
    return localeSvc.getLoadedText( resource );
};


/**
  * Updates the display strings in text bundle
  * @returns {Object} object with local texts
  */
export let updateDisplayStrings = function( viewerContextData ) {
    var rb = _getLocalTextBundle();
    var hasNoPmiText = rb.hasNoPmi;
    hasNoPmiText = hasNoPmiText.replace( '{0}', exports.getSelectionDisplayName( viewerContextData ) );

    var notCurrentlyVisibleText = _getLocalTextBundle().notCurrentlyVisible;
    notCurrentlyVisibleText = notCurrentlyVisibleText.replace( '{0}', exports.getSelectionDisplayName( viewerContextData ) );
    return { notCurrentlyVisibleText: notCurrentlyVisibleText,
        hasNoPmiText: hasNoPmiText };
};


/**
  * sets new state for item objects array.
  *
  * @param {Object[]} itemObjectsToProcess which node to process
  * @returns {Object} process elemt property
  */
export let setPmiElementProperty = function( itemObjectsToProcess, viewerContextData ) {
    if( !_.isEmpty( itemObjectsToProcess ) ) {
        let pmiTargetCsids = viewerContextData.getPmiManager().getValueOnPmiToolState( viewerPmiManager.GEOANALYSIS_PMI_TARGETCSIDS );
        let perOccurrence = exports.isInAce() && _.findIndex( pmiTargetCsids, '' ) < 0;
        return viewerContextData.getPmiManager().setPmiElementProperty( perOccurrence,
            _.map( itemObjectsToProcess, 'id' ), _.map( itemObjectsToProcess, 'value' ),
            _.map( itemObjectsToProcess, 'state' ) );
    }
    return 0;
};

export default exports = {
    parseModelViewData,
    parseRawPmiEntityData,
    parsePmiEntityData,
    isInAce,
    updateDisplayStrings,
    setPmiElementProperty,
    getSelectionDisplayName
};
