// Copyright (c) 2022 Siemens

/**
 * @module js/aceViewTypesService
 */
import eventBus from 'js/eventBus';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import _ from 'lodash';

var exports = {};

var setViewType = function( eventData ) {
    eventBus.publish( 'awViewType.ValueChanged', eventData );
};

export let initializeViewTypeConfigurationInfo = function( occContext ) {
    return occContext.productContextInfo.props.awb0ViewType;
};

//TODO: Remove explicit seeting of isEditable once we get  default support from FX
export let makePropertyEditable = function( viewType ) {
    var currentViewType = _.clone( viewType );
    if( currentViewType.props.object_name ) { currentViewType.props.object_name.isEditable = true; }
    if( currentViewType.props.object_string ) { currentViewType.props.object_string.isEditable = true; }
    return currentViewType;
};

export let selectViewType = function( data, occContext ) {
    if( data.dataProviders.getViewTypes.viewModelCollection.loadedVMObjects.length > 0 ) {
        //Find index of View Type and select it
        var indexOfCurrentViewType = data.dataProviders.getViewTypes.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.uid;
            } ).indexOf( occContext.productContextInfo.props.awb0ViewType.dbValues[ 0 ] );
        if( indexOfCurrentViewType >= 0 ) {
            data.dataProviders.getViewTypes.changeObjectsSelection( indexOfCurrentViewType,
                indexOfCurrentViewType, true );
        }
    }
};

export let updateViewType = function( eventData, occContext, key ) {
    if( occContext.productContextInfo.props.awb0ViewType.dbValues[ 0 ] && eventData.selectedObjects.length > 0 ) {
        if( occContext.productContextInfo.props.awb0ViewType.dbValues[ 0 ] !== eventData.selectedObjects[ 0 ].uid ) {
            eventData.viewType = eventData.selectedObjects[ 0 ].uid;
            setViewType( {
                selectedObject: eventData.selectedObjects[ 0 ],
                viewKey: key,
                viewType: eventData.viewType
            } );
        }
    } // !!!! FIXME Data Undefined !!!!
    /*else if( eventData.selectedObjects.length === 0 && _.isEmpty( data.viewTypeFilterbox.dbValue ) ) {
        // Handle Current view type selected
        popupService.hide();
    }*/
};

export let updateCurrentViewTypes = function( data, eventData ) {
    if( data && data.currentViewType ) {
        var currentViewType = eventData.selectedObject;
        currentViewType = makePropertyEditable( currentViewType );
        return { currentViewType };
    }
};

export let applyViewType = function( data, subPanelContext ) {
    var value = {
        configContext : {
            vt_uid: data.eventData.viewType,
            r_uid: subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ],
            var_uids: subPanelContext.occContext.productContextInfo.props.awb0VariantRules.dbValues,
            iro_uid: subPanelContext.occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ],
            de: subPanelContext.occContext.productContextInfo.props.awb0EffDate.dbValues[ 0 ],
            ue: subPanelContext.occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ],
            ei_uid: subPanelContext.occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ],
            startDate: subPanelContext.occContext.productContextInfo.props.awb0StartEffDates.dbValues[ 0 ],
            endDate: subPanelContext.occContext.productContextInfo.props.awb0EndEffDates.dbValues[ 0 ],
            fromUnit: subPanelContext.occContext.productContextInfo.props.awb0StartEffUnits.dbValues[ 0 ],
            toUnit: subPanelContext.occContext.productContextInfo.props.awb0EndEffUnits.dbValues[ 0 ],
            eg_uids: subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues,
            startFreshNavigation: true
        },
        transientRequestPref: {
            userGesture: 'VIEW_TYPE_CHANGE',
            jitterFreePropLoad: true
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
    popupService.hide();
};
export default exports = {
    selectViewType,
    updateViewType,
    updateCurrentViewTypes,
    applyViewType,
    initializeViewTypeConfigurationInfo,
    makePropertyEditable
};
