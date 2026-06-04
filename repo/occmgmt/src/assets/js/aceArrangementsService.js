// Copyright (c) 2022 Siemens

/**
 * @module js/aceArrangementsService
 */
import eventBus from 'js/eventBus';
import uwPropertyService from 'js/uwPropertyService';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';

var exports = {};

var setArrangement = function( eventData ) {
    eventBus.publish( 'awArrangementPanel.arrangementChanged', eventData );
};

export let selectArrangement = function( data, subPanelContext ) {
    if( data.dataProviders.getArrangements.viewModelCollection.loadedVMObjects.length > 0 ) {
        //Find index of Arrangement and select it
        var indexOfCurrentArrangement = data.dataProviders.getArrangements.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.uid;
            } ).indexOf( subPanelContext.occContext.productContextInfo.props.awb0AppliedArrangement.dbValues[ 0 ] );
        if( indexOfCurrentArrangement >= 0 ) {
            data.dataProviders.getArrangements.changeObjectsSelection( indexOfCurrentArrangement,
                indexOfCurrentArrangement, true );
        }
    }
};

export let updateArrangement = function( eventData, subPanelContext ) {
    if( subPanelContext.occContext.productContextInfo.props.awb0AppliedArrangement.dbValues[ 0 ] && eventData.selectedObjects.length > 0 ) {
        if( subPanelContext.occContext.productContextInfo.props.awb0AppliedArrangement.dbValues[ 0 ] !== eventData.selectedObjects[ 0 ].uid ) {
            eventData.arrangement = eventData.selectedObjects[ 0 ].uid;
            setArrangement( {
                selectedObject: eventData.selectedObjects[ 0 ],
                viewKey: subPanelContext.contextKey
            } );
        }
    }// !!!!FIXME Data Undefined !!!!
    /*else if( eventData.selectedObjects.length === 0 && _.isEmpty( data.arrangementFilterbox.dbValue ) ) {
        // Handle Current Arrangement selected

        popupService.hide();
    }*/
};

export let updateCurrentArrangement = function( data, eventData ) {
    if( data && data.currentArrangement ) {
        return eventData.selectedObject.props.object_string;
    }
};

var populateCurrentArrangement = function( occContext ) {
    var currentArrangement = occContext.productContextInfo.props.awb0AppliedArrangement;
    if( currentArrangement ) {
        var currentArrangementVMP = uwPropertyService.createViewModelProperty( currentArrangement.dbValues[ 0 ],
            currentArrangement.uiValues[ 0 ], 'STRING', currentArrangement.dbValues[ 0 ], currentArrangement.uiValues );
        currentArrangementVMP.isEditable = true;
        return currentArrangementVMP;
    }
};

export let initializeArrangementConfigurationInfo = function( subPanelContext ) {
    if( subPanelContext ) {
        if( subPanelContext.occContext && subPanelContext.occContext.productContextInfo ) {
            const currentArrangement = populateCurrentArrangement( subPanelContext.occContext );
            return { currentArrangement };
        }
    }
};

export let applyArrangement = function( data, subPanelContext ) {
    var value = {
        configContext : {
            r_uid: subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ],
            ar_uid: data.eventData.selectedObject.uid,
            eg_uids: subPanelContext.occContext.productContextInfo.props.awb0EffectivityGroups.dbValues,
            de: subPanelContext.occContext.productContextInfo.props.awb0EffDate.dbValues[ 0 ],
            ue: subPanelContext.occContext.productContextInfo.props.awb0EffUnitNo.dbValues[ 0 ],
            ei_uid: subPanelContext.occContext.productContextInfo.props.awb0EffEndItem.dbValues[ 0 ],
            var_uids: subPanelContext.occContext.productContextInfo.props.awb0VariantRules.dbValues,
            iro_uid: subPanelContext.occContext.productContextInfo.props.awb0VariantRuleOwningRev.dbValues[ 0 ],
            startFreshNavigation: true
        },
        transientRequestPref: {
            userGesture: 'ARRANGEMENT_CHANGE',
            jitterFreePropLoad: true
        }
    };
    occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
    //Close popup once state is updated
    popupService.hide();
};

export default exports = {
    selectArrangement,
    updateArrangement,
    updateCurrentArrangement,
    initializeArrangementConfigurationInfo,
    applyArrangement
};
