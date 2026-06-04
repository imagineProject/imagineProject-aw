// Copyright (c) 2024 Siemens

/**
 * Helper API ( setPropertyOnBomlines ) to set the value of the BOMLine property on the BOMline Object
 * Custom code should use this API to set the value of the BOMLine property on the BOMline Object
 * @module js/aceBomlinePropertyService
 */

import AwPromiseService from 'js/awPromiseService';
import dms from 'soa/dataManagementService';
import messagingService from 'js/messagingService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';

/**
 * Async function to set the value of the BOMLine property on the BOMLine
 * @param {Object} array of bomLines - of type BOMLine
 * @param {String} bomLinePropertyName - property name on the BOMLine
 * @param {Object} array of bomLinePropertyValues - should be 1:1 array with the bomLines
 * @return {Promise} A Promise that will be resolved when the properties are set on the BOMLines
 */
export let setPropertyOnBomlines = function( bomLines, bomLinePropertyName, bomLinePropertyValues ) {
    let deferred = AwPromiseService.instance.defer();
    let input = [];
    for ( let inx = 0; inx < bomLines.length; inx++ ) {
        input[inx] = {
            object: bomLines[inx],
            vecNameVal: [ {
                name: bomLinePropertyName,
                values: [ bomLinePropertyValues[inx] ]
            } ]
        };
    }
    let bomWindows = [];
    let getResponse = dms.getPropertiesUnchecked( bomLines, [ 'bl_window' ] );
    getResponse.then( function( info ) {
        let bomLineObject = info.modelObjects[bomLines[0].uid];
        let blWindowUid = bomLineObject.props.bl_window.dbValues[0];
        bomWindows[0] = {
            uid: blWindowUid,
            type: 'BOMWindow'
        };
        let blWindowObject = {
            bomWindows: bomWindows
        };
        let setResponse = dms.setProperties( input );
        setResponse.then( function() {
            soaSvc.post( 'Cad-2008-06-StructureManagement', 'saveBOMWindows', blWindowObject ).then( function() {
                // Success
                deferred.resolve( bomLines );
            }, function( error ) {
                messagingService.showInfo( error.message );
                deferred.reject( error );
            } );
        }, function( error ) {
            messagingService.showInfo( error.message );
            deferred.reject( error );
        } );
    }, function( error ) {
        messagingService.showInfo( error.message );
        deferred.reject( error );
    } );


    return deferred.promise;
};

/*
* Helper function to get last selection
*/
export let spliceAndGetSelectedObject = function( values ) {
    let selectedArr = [];
    selectedArr.push( _.last( values ) );
    return selectedArr;
};

const exports = {
    setPropertyOnBomlines,
    spliceAndGetSelectedObject
};

export default exports;
