// Copyright (c) 2020 Siemens

/**
 * Service to query recent model types and available model types form server
 *
 * @module js/objectTypesService
 */
import prefSvc from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';
import _ from 'lodash';
import logger from 'js/logger';

var exports = {};

var _prefMap = null;

var MRU_MODEL_TYPES_PREFERENCE = 'Create_WORKSPACE_OBJECT_mru_list';

var MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE = 'Create_WorkspaceObject_mru_max';

var DEFAULT_MRU_MAX = 5;

/**
 * Get the most recent used types.
 *
 * @param {Number} maxRecentCountIn - max recent count
 * @return {Promise} promise object
 */
 export let getRecentModelTypes = function( maxRecentCountIn ) {
    return prefSvc.getMultiStringValues( [
        MRU_MODEL_TYPES_PREFERENCE, MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE
    ] ).then( function( prefs ) {
        _prefMap = prefs;

        var maxRecent = maxRecentCountIn;
        if( !maxRecent || !_.isNumber( maxRecent ) ) {
            maxRecent = DEFAULT_MRU_MAX;

            var maxRecentTypeCount = prefs[ MAX_NUMBER_OF_MRU_MODEL_TYPES_PREFERENCE ];
            if( maxRecentTypeCount && maxRecentTypeCount.length > 0 ) {
                try {
                    maxRecent = parseInt( maxRecentTypeCount[ 0 ] );
                } catch ( exception ) {
                    logger.error( 'Invalid Create_WorkspaceObject_mru_max preference value.' );
                }
            }
        }

        var recentUsedTypeNames = prefs[ MRU_MODEL_TYPES_PREFERENCE ];
        if( recentUsedTypeNames && recentUsedTypeNames.length > 0  ) {
            // Check display rule
            var inputData = {
                input: []
            };
            for( var i = 0; i < recentUsedTypeNames.length; i++ ) {
                inputData.input.push( {
                    boTypeName: recentUsedTypeNames[i],
                    exclusionBOTypeNames: [
                    ]
                } );
            }
            return soaSvc.postUnchecked( 'Core-2010-04-DataManagement', 'findDisplayableSubBusinessObjectsWithDisplayNames', inputData ).then( function( response ) {
                var displayableTypes = [];
                response.output.forEach( ( objectWithSubTypes ) => {
                    const subTypesInfo = objectWithSubTypes.displayableBOTypeNames;
                    if( subTypesInfo ) {
                        subTypesInfo.forEach( ( subType ) =>  displayableTypes.push( subType.boName ) );
                    }
                } );
                var recentTypesToLoad = _.uniq( _.intersection( recentUsedTypeNames, displayableTypes ) ).slice( 0, maxRecent );
                return soaSvc.ensureModelTypesLoaded( recentTypesToLoad ).then( function() {
                    return recentTypesToLoad;
                } );
            } );
        }
        return [];
    } );
};

/**
 * Update the recent model types preference
 *
 * @return {Object} the promise object
 */
export let updateRecentModelTypes = function( recentTypeName ) {
    if( !recentTypeName ) {
        return null;
    }

    var existingMruTypeNames = null;
    if( _prefMap ) {
        existingMruTypeNames = _prefMap[ MRU_MODEL_TYPES_PREFERENCE ];
    }

    var mruTypeNames = [];
    mruTypeNames.push( recentTypeName );
    if( existingMruTypeNames ) {
        mruTypeNames = _.union( mruTypeNames, existingMruTypeNames );
    }

    mruTypeNames = _.uniq( mruTypeNames );
    return prefSvc.setStringValue( MRU_MODEL_TYPES_PREFERENCE, mruTypeNames );
};

exports = {
    getRecentModelTypes,
    updateRecentModelTypes
};
export default exports;
