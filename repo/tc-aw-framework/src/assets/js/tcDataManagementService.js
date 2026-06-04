// Copyright (c) 2025 Siemens

/**
 * @module js/tcDataManagementService
 */

import soaService from 'soa/kernel/soaService';
import _ from 'lodash';
import propertyPolicyService from 'soa/kernel/propertyPolicyService';

const UICONFIG_2025_06 = 'Internal-AWS2-2025-06-UiConfig';

const baseTcSoaCall = async function( serviceName, method, input, policyInput ) {
    let propertyPolicyOverride = null;
    let actionPolicyId = null;
    if ( policyInput ) {
        if ( typeof policyInput === 'string' ) {
            policyInput = JSON.parse( policyInput );
        }
        if( policyInput.override === true ) {
            propertyPolicyOverride = { types: policyInput.types };
        } else {
            actionPolicyId = propertyPolicyService.register( { types: policyInput.types }, method + '_Policy' );
        }
    }

    let response = await soaService.postUnchecked( serviceName, method, input, propertyPolicyOverride );

    if( actionPolicyId ) {
        propertyPolicyService.unregister( actionPolicyId );
    }
    return response;
};

const basePerformSearchViewModel = async function( input, policyInput ) {
    let response = await baseTcSoaCall( 'Internal-AWS2-2025-06-Finder', 'performSearchViewModel6', input, policyInput );
    if( response.columnConfig ) {
        response.columnConfig = processSoaResponseColumnConfigToSwf( response.columnConfig );
    }
    return response;
};

const baseSaveUiColumnConfigs = async function( input ) {
    return baseTcSoaCall( UICONFIG_2025_06, 'saveUIColumnConfigs3', input );
};

const baseGetOrResetUIColumnConfigs = async function( input ) {
    let response = await baseTcSoaCall( UICONFIG_2025_06, 'getOrResetUIColumnConfigs5', input );
    if( response.columnConfigurations?.[0].columnConfigurations?.[0] ) {
        response.columnConfigurations[0].columnConfigurations[0] = processSoaResponseColumnConfigToSwf( response.columnConfigurations[0].columnConfigurations[0] );
    }
    return response;
};

const baseCreateNamedColumnConfig = async function( input ) {
    return baseTcSoaCall( UICONFIG_2025_06, 'createNamedColumnConfig3', input );
};

const baseSaveNamedColumnConfig = async function( input ) {
    return baseTcSoaCall( UICONFIG_2025_06, 'saveNamedColumnConfig3', input );
};

const baseGetTableViewModelProperties = async function( input, policyInput ) {
    let response = await baseTcSoaCall( 'Internal-AWS2-2025-06-DataManagement', 'getTableViewModelProperties3', input, policyInput );
    if( response.output?.columnConfig ) {
        response.output.columnConfig = processSoaResponseColumnConfigToSwf( response.output.columnConfig );
    }
    return response;
};

const baseGetNamedColumnConfigs = async function( input ) {
    let response = await baseTcSoaCall( 'Internal-AWS2-2020-05-UiConfig', 'getNamedColumnConfigs', input );
    if( response?.namedColumnConfigsJSON ) {
        let loadedColumnConfiginfo = JSON.parse( response.namedColumnConfigsJSON );
        if( loadedColumnConfiginfo?.columnConfig ) {
            loadedColumnConfiginfo.columnConfig = processSoaResponseColumnConfigToSwf( loadedColumnConfiginfo.columnConfig );
            response.namedColumnConfigsJSON = JSON.stringify( loadedColumnConfiginfo );
        }
    }
    return response;
};
const baseGetAvailableColumns = async function( input ) {
    return baseTcSoaCall( 'Internal-AWS2-2025-06-Finder', 'getAvailableColumns2', input );
};

const baseGetDeclarativeStyleSheets = async function( input, policyInput ) {
    let response = await baseTcSoaCall( 'Internal-AWS2-2016-12-DataManagement', 'getDeclarativeStyleSheets', input, policyInput );
    return processGetDeclarativeStyleSheetResponseToSwf( response );
};

const convertSoaResponseColumnToSwf = ( column ) => {
    if ( column?.options ) {
        column.modifiable = column.options.modifiable !== 'false';
    }
    return column;
};

const processSoaResponseColumnConfigToSwf = ( soaColumnConfig ) => {
    return {
        ...soaColumnConfig,
        columns: soaColumnConfig?.columns?.map( exports.convertSoaResponseColumnToSwf )
    };
};

/**
 * Converts SOA column configuration to SWF format.
 *
 * @param {Object} response - The response object containing column providers.
 * @param {Array} response.columnProviders - The array of column providers.
 * @param {Object} response.columnProviders[].columnConfig - The column configuration object.
 * @param {Array} response.columnProviders[].columnConfig.columns - The array of columns in the column configuration.
 * @param {Array} response.columnProviders[].columns - The array of columns.
 * @returns {Object} The response object with the column configuration converted to SWF format.
 */
const processGetDeclarativeStyleSheetResponseToSwf = ( response ) => {
    if ( response?.declarativeUIDefs?.length > 0 ) {
        _.forEach( response.declarativeUIDefs, function( currentDeclarativeUI ) {
            let currentViewModel = JSON.parse( currentDeclarativeUI.viewModel );
            if ( currentViewModel?.columnProviders && Object.keys( currentViewModel.columnProviders ).length > 0 ) {
                _.forEach( currentViewModel.columnProviders, function( currentColumnProvider ) {
                    if ( currentColumnProvider.columnConfig?.columns?.length > 0 ) {
                        currentColumnProvider.columnConfig = processSoaResponseColumnConfigToSwf( currentColumnProvider.columnConfig );
                    }
                    if ( currentColumnProvider.columns?.length > 0 ) {
                        let swfColumns = [];
                        _.forEach( currentColumnProvider.columns, function( currentColumn ) {
                            swfColumns.push( convertSoaResponseColumnToSwf( currentColumn ) );
                        } );
                        currentColumnProvider.columns = swfColumns;
                    }
                } );
                currentDeclarativeUI.viewModel = JSON.stringify( currentViewModel );
            }
        } );
    }
    return response;
};

const getSearchInputFromActionInputData = ( inputData = {} ) => {
    return inputData.searchInput || inputData[0]?.searchInput;
};

const exports = {
    basePerformSearchViewModel,
    baseSaveUiColumnConfigs,
    baseGetOrResetUIColumnConfigs,
    baseCreateNamedColumnConfig,
    baseSaveNamedColumnConfig,
    baseGetTableViewModelProperties,
    baseGetNamedColumnConfigs,
    baseGetAvailableColumns,
    baseGetDeclarativeStyleSheets,
    convertSoaResponseColumnToSwf,
    processSoaResponseColumnConfigToSwf,
    processGetDeclarativeStyleSheetResponseToSwf,
    getSearchInputFromActionInputData
};
export default exports;
