// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@


/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1BaselineCellCommandsHandler
 */

import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

var exports = {};


/**
 * Navigate to specified panel
 *
 * @param {object} vmo - ViewModelObject of Baseline
 * @param {object} destPanelId - Destination panel id
 * @param {string} title - Title of panel
 * @param {boolean} goBackSupport - Go back panel support
 */
export let navigateEditPanel = function( vmo, destPanelId, title ) {
    if ( vmo && vmo.uid ) {
        if ( !appCtxService.ctx.baselineUid ) {
            appCtxService.registerCtx( 'baselineUid', '' );
        }
        appCtxService.ctx.baselineUid = vmo.uid;
        var context = {
            destPanelId: destPanelId,
            title: title,
            recreatePanel: true,
            supportGoBack: true
        };
        eventBus.publish( 'awPanel.navigate', context );
    }
};

/**
 * Post delete baseline action
 * Check if deleting active baseline, if so, refresh schedule object to get
 * which baseline has become the new active baseline
 *
 * @param {object} vmo - ViewModelObject of Baseline
 * @param {object} data - Data of ViewModelObject
 */
export let postDeleteBaselineAction = function( vmo ) {
    var sch_tag = appCtxService.ctx.selected.uid;
    var schedule = cdm.getObject( sch_tag );
    if ( schedule.props.activeschbaseline_tag.dbValues[ 0 ] === vmo.uid ) {
        var objects = [ schedule ];
        soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: objects
        } ).then( function() {
            eventBus.publish( 'Saw1BaselinesSchedule.updateProvidersForDelete' );
        } );
    }
    //update the Gantt view after removing the baseline
    let selectedBaselines = appCtxService.ctx.scheduleNavigationCtx.selectedBaselines;
    var idx = _.findIndex( selectedBaselines, ( obj ) => obj.uid === vmo.uid );
    if( idx > -1 ) {
        selectedBaselines.splice( idx, 1 );
        eventBus.publish( 'updateBaselineToView', selectedBaselines );
    }
};

/**
 * Update data providers
 *
 * @param {object} vmo - ViewModelObject of Baseline
 */
export let updateDataProviders = function( vmo ) {
    if ( vmo && vmo.uid ) {
        eventBus.publish( 'Saw1BaselinesSchedule.updateProvidersForActive' );
    }
};

/**
* Reset cell properties of Baseline object
*
* @param {object} data - Data of ViewModelObject
* @param {object} baselineObject - Baseline object
*/
var resetCellPropertiesOfBaseline = function( data, baselineObject ) {
    if ( baselineObject ) {
        var props = [];
        var cellHeader1 = baselineObject.props.object_string.uiValues[ 0 ];

        var baselineName = data.i18n.baselineName;
        props.push( baselineName + ' \\:' + cellHeader1 );

        var cellHeader2 = '';

        var activeBaseline = data.i18n.saw1ActiveBaseline;
        props.push( activeBaseline + ' \\: ' + cellHeader2 );

        var cellHeader3 = baselineObject.props.creation_date.uiValues[ 0 ];

        var creationDate = data.i18n.creationDate;
        props.push( creationDate + ' \\:' + cellHeader3 );

        var cellHeader4 = baselineObject.props.owning_user.uiValues[ 0 ];

        var owningUser = data.i18n.owningUser;
        props.push( owningUser + ' \\:' + cellHeader4 );

        if ( props ) {
            baselineObject.props.awp0CellProperties.dbValue = props;
            baselineObject.props.awp0CellProperties.dbValues = props;
            baselineObject.props.awp0CellProperties.displayValsModel = props;
            baselineObject.props.awp0CellProperties.displayValues = props;
            baselineObject.props.awp0CellProperties.prevDisplayValues = props;
            baselineObject.props.awp0CellProperties.uiValue = props;
            baselineObject.props.awp0CellProperties.uiValues = props;
            baselineObject.props.awp0CellProperties.value = props;
            baselineObject.props.awp0CellProperties.values = props;
        }
        var dbValue = baselineObject.props.awp0CellProperties.dbValue;
        baselineObject.cellProperties = {};
        for ( var ii = 0; ii < dbValue.length; ii++ ) {
            var keyValue = dbValue[ ii ].split( '\\:' );
            var value = keyValue[ 1 ] || '';
            if ( ii === 0 ) {
                baselineObject.cellHeader1 = value;
            } else if ( ii === 1 ) {
                baselineObject.cellHeader2 = value;
            } else if ( value ) {
                var key = keyValue[ 0 ];
                baselineObject.cellProperties[ key ] = {
                    key: key,
                    value: value
                };
            }
        }
    }
};

/**
 * Update data providers
 *
 * @param {object} data - Data of ViewModelObject
 */
export let updateProvidersForDelete = function( data ) {
    var sch_tag = appCtxService.ctx.selected.uid;
    var schedule = cdm.getObject( sch_tag );
    var activeBaselineUid = schedule.props.activeschbaseline_tag.dbValues[ 0 ];
    var baselineObjects = data.dataProviders.getBaselines.viewModelCollection.loadedVMObjects;
    var updateBaselineList = baselineObjects;
    for ( var ii = 0; ii < baselineObjects.length; ii++ ) {
        if ( activeBaselineUid === baselineObjects[ ii ].uid ) {
            //add to active baseline
            resetCellPropertiesOfBaseline( data, baselineObjects[ ii ] );
            var updateActiveBaselineList = [];
            updateActiveBaselineList.push( baselineObjects[ ii ] );
            data.dataProviders.activeBaseline.update( updateActiveBaselineList );

            //remove from baselines
            updateBaselineList.splice( ii, 1 );
            data.dataProviders.getBaselines.update( updateBaselineList );
        }
    }
};


/**
 * Update data providers
 *
 * @param {object} data - Data of ViewModelObject
 */
export let updateProvidersForActive = function( data ) {
    var oldActiveBaseline = data.dataProviders.activeBaseline.viewModelCollection.loadedVMObjects[ 0 ];
    var updateActiveBaselineList = [];
    var sch_tag = appCtxService.ctx.selected.uid;
    var schedule = cdm.getObject( sch_tag );
    var activeBaselineUid = schedule.props.activeschbaseline_tag.dbValues[ 0 ];
    var baseline = cdm.getObject( activeBaselineUid );
    baseline.selected = false;
    resetCellPropertiesOfBaseline( data, baseline );
    updateActiveBaselineList.push( baseline );
    data.dataProviders.activeBaseline.update( updateActiveBaselineList );

    var updateBaselineList = data.dataProviders.getBaselines.viewModelCollection.loadedVMObjects;
    var modelObjects = updateBaselineList;
    for ( var ii = 0; ii < updateBaselineList.length; ii++ ) {
        if ( baseline.uid === updateBaselineList[ii].uid ) {
            modelObjects.splice( ii, 1 );
        }
    }
    resetCellPropertiesOfBaseline( data, oldActiveBaseline );
    modelObjects.push( oldActiveBaseline );
    data.dataProviders.getBaselines.update( modelObjects );
};

/**
 * Populate name and description baseline info to be edited
 *
 * @param {object} objectName, @param {object} objectDesc - Name and desc of ViewModelObject
 */
export let populateDataForBaseline = function( objectName, objectDesc ) {
    let baselineUid = appCtxService.getCtx( 'baselineUid' );
    var baseline = cdm.getObject( baselineUid );
    appCtxService.unRegisterCtx( 'baselineUid' );

    var name = baseline.props.object_name.dbValues[ 0 ];

    if ( objectName ) {
        uwPropertyService.setValue( objectName, name );
        uwPropertyService.setIsRequired( objectName, true );
    }

    var desc = baseline.props.object_desc;
    if ( desc ) {
        var description = desc.dbValues[0];
        if ( objectDesc ) {
            uwPropertyService.setValue( objectDesc, description );
            uwPropertyService.setIsRequired( objectDesc, false );
        }
    }
    return baseline;
};

/**
 * Get Updates Attributes Container
 *
 * @param {object} data - Data of ViewModelObject
 * @return {array} attributes - Updates attributes array
 */
export var getUpdatesAttributesContainer = function( objectName, objectDesc, currentBaseline ) {
    var attributes = [];
    var baselineNameUpdate = objectName.dbValue;
    var originalBaselineName = currentBaseline.props.object_name.dbValues[0];
    if ( baselineNameUpdate !== originalBaselineName ) {
        attributes.push( {
            attrName: 'object_name',
            attrValue: baselineNameUpdate,
            attrType: 1
        } );
    }
    var baselineDescriptionUpdate = objectDesc.dbValue;
    var originalBaselineDescription = currentBaseline.props.object_desc.uiValues[0];
    if( baselineDescriptionUpdate !== originalBaselineDescription ) {
        attributes.push( {
            attrName: 'object_desc',
            attrValue: baselineDescriptionUpdate,
            attrType: 1
        } );
    }
    return attributes;
};

exports = {
    navigateEditPanel,
    postDeleteBaselineAction,
    populateDataForBaseline,
    updateDataProviders,
    updateProvidersForActive,
    updateProvidersForDelete,
    getUpdatesAttributesContainer
};
export default exports;
