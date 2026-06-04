//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/plantSolveService
 */
import app from 'app';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import lovService from 'js/lovService';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revRuleClauseDisplayTextService from 'js/revRuleClauseDisplayTextService';
import _ from 'lodash';
import addRevRuleClausePropertyService from  'js/addRevRuleClausePropertyService';


var _plant_location = 'plantLocation';
var ADDCLAUSE_PREFIX = 'addClause_';
var exports = {};

/**
   * Get updated Plant Location clause
   *
   * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
   * @param {Object} clauseToBeUpdated - modified/added clause
   * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
   *
   */

export let getUpdatedPlantLocationClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var plantLocationType = _plant_location;

    if( clauseToBeUpdated.entryType === 14 ) {
        if( isForAddClause ) {
            plantLocationType = ADDCLAUSE_PREFIX + _plant_location;
        }

        clauseToBeUpdated.revRuleEntryKeyToValue = {};
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
        if( ctx.RevisionRuleAdmin[ plantLocationType ] ) {
            clauseToBeUpdated.revRuleEntryKeyToValue = {
                plant_location: ctx.RevisionRuleAdmin[plantLocationType].plantLocationuid
            };
        }

        if( !isForAddClause ) {
            return addRevRuleClausePropertyService.modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
        addRevRuleClausePropertyService.createClausePropertyForAddClause( clauseToBeUpdated, displayText );
    }
};
/**
   * Update event clause text
   *
   * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
   *
   */
export let updatePlantLocationClauseText = function( data ) {
    var clauseToBeUpdated = addRevRuleClausePropertyService.getSelectedClause( data.subPanelContext );
    if( clauseToBeUpdated && clauseToBeUpdated.entryType === 14 ) {
        return exports.getUpdatedPlantLocationClause( data, clauseToBeUpdated, false );
    }
};

/**
   * Update the plant location property with the selected property from the widget
   *
   * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
   *
   */
export let plantLocationListSelectionChanged = function( data ) {
    var islovValueModified = false;

    if( data.plant_location.dbValue !== '' ) {
        islovValueModified = true;
    }
    if( islovValueModified ) {
        var subPanelContext = data.subPanelContext;
        if( subPanelContext ) {
            var isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }

        var plantLocationType = addRevRuleClausePropertyService.getClausePropertiesType( _plant_location, data );
        var plantLocationData = {
            plantLocationuid: data.plant_location.dbValue,
            plantLocationDisplay: data.plant_location.uiValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( plantLocationType, plantLocationData );

        if( !isSelectedFromAddPanel ) {
            updatePlantLocationClauseText( data );
        }
    }
};


function handleSetPlantError( response )  {

    if( response.cause && response.cause.partialErrors.length > 0 ) {
        return [ response.cause.partialErrors ];
    }
    return [];
}
let  generatePlantsList = async function( filterString ) {
    let deferedLOV = AwPromiseService.instance.defer();

    let mbc0Plant = appCtxSvc.getCtx( 'userSession.props.mbc0Plant' );
    let userSession = appCtxSvc.getCtx( 'userSession' );

    lovService.getInitialValues( filterString, deferedLOV, mbc0Plant,
        'Create', userSession, 100, 100, '', '' );

    /**
           * Process response when LOV 'getInitialValues' has been performed.
           */
    return deferedLOV.promise.then( function( response ) {
        if ( response && response.lovValues && response.lovValues.length > 0 ) {
            return response.lovValues;
        }
        return handleSetPlantError( response );
    }, function( response ) {
        return handleSetPlantError( response );
    } );
};
/**
   * Process SOA response and add the plant locations to the widget dataprovider
   * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
   *
   */
export let processPlantLocationSearchResults = async function( data ) {
    var plantLocationList = [];
    let moreValuesExist = _.cloneDeep( data.moreValuesExist );

    plantLocationList = await generatePlantsList( data.plant_location.filterString );

    moreValuesExist = plantLocationList.moreValuesExist; // for pagination

    var ctx = revisionRuleAdminCtx.getCtx();
    var plantLocationType = addRevRuleClausePropertyService.getClausePropertiesType( _plant_location, data );
    if( plantLocationList && data.plant_location.uiValue === '' && ctx.RevisionRuleAdmin[ plantLocationType ] === undefined ) {
        let plant_location = _.cloneDeep( data.plant_location );
        plant_location.dbValue = ctx.userSession.props.mbc0Plant.dbValue;
        plant_location.uiValue = ctx.userSession.props.mbc0Plant.uiValue;

        var plantLocationData = {
            plantLocationuid:  plantLocationList[0].propInternalValue,
            plantLocationDisplay: plantLocationList[0].propDisplayValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( plantLocationType, plantLocationData );

        data.dispatch( { path: 'data.plant_location', value: plant_location } );
    }

    return { plantLocationList, moreValuesExist };
};

/**
   * Validate the input to the event widget value
   *
   * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
   *
   */
export let validatePlantWidgetValue = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var plantlocationType = addRevRuleClausePropertyService.getClausePropertiesType( _plant_location, data );
    let validEvent = true;
    let plant_location = _.cloneDeep( data.plant_location );
    //plant location will be valid if either the widget inputText is equal to the plant location value in ctx
    // or widget inputText is present in the dataprovider
    var indexOfEvent = -1;
    if( data.dataProviders.plantLocationDataProvider.viewModelCollection.loadedVMObjects.length > 0 && plant_location.uiValue !== '' ) {
        indexOfEvent = data.dataProviders.plantLocationDataProvider.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.uid;
            } ).indexOf( plant_location.dbValue );
    }
    if( indexOfEvent < 0 && !( plant_location.uiValue === '' || ctx.RevisionRuleAdmin[ plantlocationType ] && plant_location.uiValue === ctx.RevisionRuleAdmin[ plantlocationType ].plantLocationDisplay ) ) {
        validEvent = false;
        if( ctx.RevisionRuleAdmin[ plantlocationType ] ) {
            plant_location.dbValue = ctx.RevisionRuleAdmin[ plantlocationType ].plantLocationuid;
            plant_location.uiValue = ctx.RevisionRuleAdmin[ plantlocationType ].plantLocationDisplay;
        } else {
            plant_location.dbValue = '';
            plant_location.uiValue = '';
        }
        data.dispatch( { path: 'data.plant_location', value: plant_location } );
    }
    return { valid: validEvent, message: '' };
};

/**
   * Initialize the event clause property when any clause is selected from the list of clauses
   *
   * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
   *
   */
export let locationClausePropertyValueInitialized = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var  plant_location = _.cloneDeep( data.plant_location );
    if( ctx.RevisionRuleAdmin.plantLocation ) {
        plant_location.uiValue = ctx.RevisionRuleAdmin.plantLocation.plantLocationDisplay;
        plant_location.dbValue = ctx.RevisionRuleAdmin.plantLocation.plantLocationuid;
    } else {
        plant_location.uiValue = '';
        plant_location.dbValue = '';
        data.currentEvent.dbValue = false;
    }
    return plant_location;
};


export default exports = {
    processPlantLocationSearchResults,
    locationClausePropertyValueInitialized,
    plantLocationListSelectionChanged,
    updatePlantLocationClauseText,
    getUpdatedPlantLocationClause,
    validatePlantWidgetValue
};


