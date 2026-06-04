// Copyright (c) 2022 Siemens

/**
 * This is the command handler for save edit in mass update module
 *
 * @module js/massUpdateSaveHandler
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import _uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import mgsSvc from 'js/messagingService';
import editHandlerService from 'js/editHandlerService';
import _ from 'lodash';

var exports = {};

var saveHandler = {};

/**
 * Returns the defined save Handler
 * @returns {Object} saveHandler
 */
export let getSaveHandler = function() {
    return saveHandler;
};

/**
 * Call the SOA saveImpactedAssemblies for modified Object in data Source
 *
 * @param {datasource} datasource viewModel of view
 * @returns {promise} promise when all modified Impacted Assemblies get saved
 */
saveHandler.saveEdits = function( datasource ) {
    var deferred = AwPromiseService.instance.defer();
    var saveImpactedAssembliesIns = [];
    var allModifiedObjects = datasource.getAllModifiedPropertiesWithVMO();

    // create the array of the object
    _.forEach( allModifiedObjects, function( modifiedObject ) {
        var vmObject = _.get( modifiedObject, 'viewModelObject' );
        if( vmObject.type === 'Awp0XRTObjectSetRow' ) {
            var targetObj = _.get( vmObject, 'props.awp0Target' );
            if( targetObj.dbValue ) {
                vmObject = cdm.getObject( targetObj.dbValue );
            } else {
                vmObject = _uwPropertyService.getSourceModelObject( targetObj );
            }
            saveImpactedAssembliesIns.push( createSaveImpactedAssembliesInput( modifiedObject, vmObject ) );
        }
    } );

    var soaInput = {
        changeObject: {
            uid: appCtxSvc.ctx.xrtSummaryContextObject.uid,
            type: appCtxSvc.ctx.xrtSummaryContextObject.type
        },
        impactedObjectsInfo: saveImpactedAssembliesIns
    };

    // Call SOA saveImpactedAssemblies to save rows and create markup changes
    soaSvc.postUnchecked( 'Internal-ChangeManagement-2020-01-MassUpdate',
        'saveImpactedAssemblies', soaInput ).then( function( serviceData ) {
        if( serviceData.partialErrors ) {
            processPartialErrors( serviceData );
            var error = null;
            deferred.reject( error );
            editHandlerService.cancelEdits();
        } else {
            deferred.resolve( serviceData );
        }
    } );

    return deferred.promise;
};

/**
 * Returns dirty bit.
 * @returns {Boolean} isDirty bit
 */
saveHandler.isDirty = function( dataSource ) {
    // Get all properties that are modified
    var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
    if( modifiedViewModelProperties && modifiedViewModelProperties.length > 0 ) {
        return true;
    }
    return false;
};

/**
 * Creates Input for  SOA saveImpactedAssemblies with modified Object in data Source
 *
 * @param {List} modifiedObject List of modified Objects
 * @param {viewModelObject} vmObject view Model Object
 * @returns {Object} input for save Impacted Assemblies
 */
var createSaveImpactedAssembliesInput = function( modifiedObject, vmObject ) {
    var muChanges = [];
    var vmProps = _.get( modifiedObject, 'viewModelProps' );
    _.forEach( vmProps, function( prop ) {
        var pName = prop.propertyName;
        var pValue = prop.dbValue.toString();
        var massUpdateChange = {
            propName: pName,
            propValue: pValue

        };
        muChanges.push( massUpdateChange );
    } );
    return {
        impactedObject: { uid:vmObject.uid, type:vmObject.type },
        massUpdateChanges: muChanges
    };
};

/**
 * Process the partial error in SOA response if there are any.
 * @param {serviceData} serviceData service data of saveImpactedAssemblies
 */
var processPartialErrors = function( serviceData ) {
    var msgObj = {
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors ) {
        for( var x = 0; x < serviceData.partialErrors[ 0 ].errorValues.length; x++ ) {
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ x ].message;
            msgObj.msg += '<BR/>';
            msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ x ].level ] );
        }
        mgsSvc.showError( msgObj.msg );
    }
};

/**
 * App Factory for Mass Update SaveHandler
 */

export default exports = {
    getSaveHandler
};
