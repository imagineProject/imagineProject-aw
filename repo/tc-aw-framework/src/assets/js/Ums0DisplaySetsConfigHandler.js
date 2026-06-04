// Copyright (c) 2022 Siemens

/**
 * @module js/Ums0DisplaySetsConfigHandler
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import workspaceService from 'js/workspaceService';

var exports = {};

export let processDisplaySetsData = function( response, unitDisplaySetData ) {
    var value = { ...unitDisplaySetData.value };
    var allDisplayUnits = response && response.displaySets ? response.displaySets : [];
    let displayUnits = [];
    for( var i = 0; i < allDisplayUnits.length; i++ ) {
        var obj = {
            propDisplayValue: allDisplayUnits[i].displayName,
            dispValue: allDisplayUnits[i].displayName,
            propInternalValue: allDisplayUnits[i].internalName
        };
        displayUnits.push( obj );
    }
    value.displaySetsData = displayUnits;
    value.preferredDisplaySet = response.preferredDisplaySet;
    unitDisplaySetData.update( value );
};

export let setDefaultDisplaySetSelected = function( unitDisplaySetData, displaySet ) {
    if( unitDisplaySetData ) {
        var clonedDisplaySet = _.cloneDeep( displaySet );
        var preferredDisplaySet = unitDisplaySetData.preferredDisplaySet;
        for( var i = 0; i < unitDisplaySetData.displaySetsData.length; i++ ) {
            var internalName = unitDisplaySetData.displaySetsData[i].propInternalValue;
            if( internalName === preferredDisplaySet ) {
                clonedDisplaySet.dbValue = internalName;
                clonedDisplaySet.dbValues = [ internalName ];
                clonedDisplaySet.uiValue = unitDisplaySetData.displaySetsData[i].propDisplayValue;
                clonedDisplaySet.uiValues = [ unitDisplaySetData.displaySetsData[i].propDisplayValue ];
                return clonedDisplaySet;
            }
        }
    }
};

export let reloadLocations = function( displaySet ) {
    var awSession = localStrg.get( 'awSession' );
    if( awSession ) {
        try {
            awSession = JSON.parse( awSession );
            awSession.unitSystem = displaySet;
            awSession = JSON.stringify( awSession );
            localStrg.publish( 'awSession', awSession );
        } catch ( err ) {
            //
        }
    }
    workspaceService.reloadPage();
};

export default exports = {
    processDisplaySetsData,
    setDefaultDisplaySetSelected,
    reloadLocations
};
