// Copyright (c) 2022 Siemens

/**
 * @module js/tcarrange.service
 */
import tcDataManagementService from 'js/tcDataManagementService';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import localStrg from 'js/localStorage';
import { NULL_UID } from 'soa/kernel/clientDataModel';

let exports = {};

const listDropBetweenHighlightClass = 'listDropBetweenHighlight';
const listDropTopHighlightClass = 'listDropTopHighlight';
const listDropBottomHighlightClass = 'listDropBottomHighlight';
const listDropHighlightClass = 'listDropHighlight';

export let getTypesForArrange = function() {
    let typeNames = [];
    const searchResponseInfo = appCtxSvc.getCtx( 'searchResponseInfo' );
    if( searchResponseInfo?.columnConfig?.typesForArrange?.length > 0 ) {
        for( const typeForArrange of searchResponseInfo.columnConfig.typesForArrange ) {
            typeNames.push( typeForArrange );
        }
    } else if( searchResponseInfo?.searchFilterMap ) {
        typeNames = exports.getTypeNames( searchResponseInfo.searchFilterMap );
    }
    return typeNames;
};

export const getTypesForArrangeAsString = function() {
    const typeNames = exports.getTypesForArrange();
    return typeNames.length === 0 ? '' : typeNames.join( ',' ) + ',';
};

/**
 *
 * @param {String} columnConfigUid - column config uid
 * @returns {Boolean} - True if the given column config uid is the default column config.
 */
export const isDefaultColumnConfig = function( columnConfigUid ) {
    return columnConfigUid && ( columnConfigUid.includes( NULL_UID )
        || columnConfigUid.includes( 'site_' )
        || columnConfigUid.includes( 'group_' )
        || columnConfigUid.includes( 'role_' )
        || columnConfigUid.includes( 'workspace_' ) );
};

/**
 *
 * @param {Object} result - result object that contains the new ColumnConfig object
 * @param {Object} oldColumnConfig - old Column Config that contains 'typesForArrange'
 * @returns {Object} - new Column Config object with typesForArrange patched
 */
export let postResetFunction = function( result, oldColumnConfig ) {
    let colConfig = result && result.columnConfigurations[ 0 ].columnConfigurations[ 0 ];
    colConfig.typesForArrange = oldColumnConfig ? oldColumnConfig.typesForArrange : undefined;
    return colConfig;
};

/**
 * Generates a unique identifier for a column
 *
 * @param {Object} column - The column object
 * @param {string} name - The name of the column
 * @returns {string} The generated unique identifier
 */
export const getColumnUid = function( column, name ) {
    let typeName = column.associatedTypeName || column.typeName || '';
    if ( typeName ) {
        typeName += '.';
    }
    return typeName + name;
};

/**
 * Initialize a column def
 *
 * @param {Object} column - column structure
 * @param {Integer} columnOrder - the column order
 * @param {String} columnDefPropName - the column property name
 * @param {String} columnDefName - the column name
 * @returns {Object} - the initialized columnDef
 */
export const initializeColumnDef = function( column, columnOrder, columnDefPropName, columnDefName ) {
    return {
        columnOrder: columnOrder,
        dbValue: !column.hiddenFlag,
        displayName: column.displayName,
        hiddenFlag: column.hiddenFlag,
        isEditable: true,
        isEnabled: true,
        isFilteringEnabled: column.isFilteringEnabled,
        isTextWrapped: column.isTextWrapped ? column.isTextWrapped : false,
        modifiable: _.isNil( column.options?.modifiable ) ? true : column.options.modifiable !== 'false',
        name: columnDefName || column.name,
        pixelWidth: column.pixelWidth,
        propApi: {},
        propertyDisplayName: column.displayName,
        propertyLabelDisplay: 'PROPERTY_LABEL_AT_RIGHT',
        propertyName: columnDefPropName,
        savedFilters: column.savedFilters || column.filters || [],
        sortDirection: column.sortDirection ? column.sortDirection : '',
        sortPriority: column.sortPriority,
        tooltipDescription: column.displayName,
        type: 'BOOLEAN',
        typeName: column.typeName ? column.typeName : column.associatedTypeName,
        uid: getColumnUid( column, columnDefPropName ),
        visible: !column.hiddenFlag
    };
};

/**
 * Return the type names from search filter map
 *
 * @param {Object} response - response structure
 * @param {Object} searchFilterMap - Search Filter Map
 *
 * @return {StringArray} The type names array
 */
export const getTypeNames = function( response, searchFilterMap ) {
    const tempSearchFilterMap = searchFilterMap ? searchFilterMap : response;
    let typeNames = [];
    let filters = _.get( tempSearchFilterMap, 'WorkspaceObject.object_type' );
    if( !filters ) {
        filters = _.get( tempSearchFilterMap, 'SAVED_QUERY_RESULT_TYPES' );
    }
    let hasSelectedFilters = false;
    if( _.isArray( filters ) ) {
        for( const searchFilter of filters ) {
            if( searchFilter.selected ) {
                hasSelectedFilters = true;
            }
        }

        for( const searchFilter of filters ) {
            let addType = true;
            if( hasSelectedFilters && !searchFilter.selected ) {
                addType = false;
            }

            if( addType ) {
                const typeName = _.get( searchFilter, 'stringValue' );
                if( typeNames.indexOf( typeName ) < 0 ) {
                    typeNames.push( typeName );
                }
            }
        }
    }

    if( typeNames.length === 0 ) {
        typeNames.push( 'WorkspaceObject' );
    }
    const indexOfNone = typeNames.indexOf( '$NONE' );
    if( indexOfNone > 0 ) {
        typeNames.splice( indexOfNone, 1 );
    }

    return typeNames;
};

/**
 * Toggle operation type
 *
 * @param {viewModelJson} arrangeData - The arrange data
 * @param {Object} dataProviders - The data providers
 */
export const showAll = function( arrangeData, dataProviders ) {
    arrangeData.originalOperationType = arrangeData.originalOperationType || arrangeData.operationType;
    if( arrangeData.operationType === 'intersection' ) {
        arrangeData.operationType = 'union';
    } else {
        arrangeData.operationType = 'intersection';
    }

    // Lightning: Remove Columns: Flag to make sure columns load when toggling show all/show common even when a column is removed after it is toggled
    if ( arrangeData.showAllChanged ) {
        arrangeData.showAllChanged = false;
    } else {
        arrangeData.showAllChanged = true;
    }
    const clientScopeURI = arrangeData.objectSetUri || appCtxSvc.getCtx( 'sublocation.clientScopeURI' );

    if( arrangeData.isExistingColumnConfigLoaded === true && arrangeData.loadedColumnConfig.columnConfigName && !exports.isDefaultColumnConfig( arrangeData.loadedColumnConfig.columnConfigUid ) ) {
        const getNamedInputData = {
            namedColumnConfigInput: {
                clientName: 'AWClient',
                clientScopeUri: clientScopeURI,
                columnConfigId: arrangeData.columnConfigId
            },
            namedColumnConfigCriteria: {
                operationType: arrangeData.operationType,
                typesForArrange: exports.getTypesForArrangeAsString(),
                columnConfigUid: arrangeData.loadedColumnConfig.columnConfigUid
            }
        };
        tcDataManagementService.baseGetNamedColumnConfigs( getNamedInputData ).then( function( response ) {
            const loadedColumnConfig = JSON.parse( response.namedColumnConfigsJSON );
            if( !loadedColumnConfig.columnConfig || !loadedColumnConfig.columnConfig.columns || loadedColumnConfig.columnConfig.columns.length === 0 ) {
                return;
            }

            updateArrangeDataColumnsDefs( arrangeData, loadedColumnConfig.columnConfig.columns, dataProviders );
        } );
        return;
    }

    const inputData = {
        getOrResetUiConfigsIn: [ {
            clientName: 'AWClient',
            businessObjects: appCtxSvc.ctx.mselected ? appCtxSvc.ctx.mselected : [],
            columnConfigQueryInfos: [ {
                clientScopeURI: clientScopeURI,
                columnsToExclude: [],
                operationType: arrangeData.operationType,
                typeNames: exports.getTypesForArrange()
            } ],
            hostingClientName: '',
            resetColumnConfig: false,
            scope: 'LoginUser',
            scopeName: ''
        } ]
    };
    tcDataManagementService.baseGetOrResetUIColumnConfigs( inputData ).then( function( response ) {
        if( response.columnConfigurations && response.columnConfigurations.length > 0 &&
            response.columnConfigurations[ 0 ].columnConfigurations &&
            response.columnConfigurations[ 0 ].columnConfigurations.length > 0 &&
            response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns &&
            response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns.length > 0 ) {
            updateArrangeDataColumnsDefs( arrangeData, response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns, dataProviders );
        }
    } );
};

/**
 * Initialize a SOA column
 *
 * @param {Object} column - The column to initialize
 * @param {Number} columnOrder - The order of the column
 * @param {boolean} isTextWrapped - Whether the text is wrapped
 */
const initializeSOAColumn = function( column, columnOrder, isTextWrapped ) {
    column.columnOrder = columnOrder;
    column.filterDefinitionKey = '';
    column.filters = [];
    column.hiddenFlag = true;
    column.isFilteringEnabled = true;
    column.isFrozen = false;
    column.isTextWrapped = isTextWrapped;
    column.pixelWidth = 250;
    column.sortPriority = 0;
    column.sortDirection = '';
    column.isCustom = true;
    column.tooltipDescription = '';
    if ( column.associatedTypeDisplayName ) {
        column.tooltipDescription += column.associatedTypeDisplayName + ' : ';
    }
    column.tooltipDescription += column.displayName + ' (' + column.propertyName + ')';
};

/**
 * GH Copilot Generated - start
 *
 * Processes the columns to include for SOA and returns a formatted string.
 *
 * @param {Array} columnsToInclude - The columns to include, uses uid and displayName.
 * @returns {string} A string representation of the columns to include, formatted as 'uid[displayName]::uid[displayName]'.
 *
 * GH Copilot Generated - end
 */
const processColumnsToIncludeForSoa = function( columnsToInclude ) {
    let columnsToIncludeString = '';
    for ( const currentColumn of columnsToInclude ) {
        if ( columnsToIncludeString ) {
            columnsToIncludeString += '::';
        }
        columnsToIncludeString += currentColumn.uid;
        if ( currentColumn.displayName ) {
            columnsToIncludeString += '[' + currentColumn.displayName + ']';
        }
    }
    return columnsToIncludeString;
};

/**
 * GH Copilot Generated - start
 *
 * Creates the input for the baseGetAvailableColumns function.
 *
 * @param {Object} additionalColumnsData - The additional data for the columns.
 * This object should have properties: searchInput, columnConfigUid, columnConfigId,
 * startIndex, maxToReturn, columnsToExclude, objectTypes, providerName, filterString.
 * @returns {Object} An object that represents the input for the baseGetAvailableColumns function.
 *
 * GH Copilot Generated - end
 */
const createGetAvailableColumnsInput = function( additionalColumnsData ) {
    let searchCriteria = additionalColumnsData.searchInput?.searchCriteria || {};
    searchCriteria.columnConfigUid = additionalColumnsData.columnConfigUid;
    searchCriteria.columnConfigId = additionalColumnsData.columnConfigId;
    if( searchCriteria.columnConfigId?.startsWith( 'objSetSrc_' ) ) {
        searchCriteria.columnsToInclude = processColumnsToIncludeForSoa( additionalColumnsData.columnsToInclude );
    }

    return {
        startIndex: additionalColumnsData.startIndex || 0,
        maxToReturn: additionalColumnsData.maxToReturn || 300,
        columnsToExclude: additionalColumnsData.columnsToExclude || [],
        objectTypes: additionalColumnsData.objectTypes || [],
        providerName: additionalColumnsData.searchInput?.providerName || '',
        searchCriteria: searchCriteria,
        filterString: additionalColumnsData.filterString || ''
    };
};

/**
 * GH Copilot Generated - start
 *
 * Fetches additional columns data from the service and initializes them.
 *
 * @param {Object} additionalColumnsData - The additional data for the columns.
 * This object should have properties: lastColumnOrder, isTextWrapped.
 * It can also include other properties needed by createGetAvailableColumnsInput function.
 * @returns {Promise} A promise that resolves to an object containing startIndex, totalFound, and additionalColumns.
 *
 * GH Copilot Generated - end
 */
export const getAdditionalColumns = async function( additionalColumnsData = {} ) {
    const soaInputData = createGetAvailableColumnsInput( additionalColumnsData );

    return tcDataManagementService.baseGetAvailableColumns( soaInputData ).then( function( response ) {
        let currentColumnOrder = additionalColumnsData.lastColumnOrder + 100;
        for ( let currentColumn of response.availableColumns ) {
            initializeSOAColumn( currentColumn, currentColumnOrder, additionalColumnsData.isTextWrapped );
            currentColumnOrder += 100;
        }

        return {
            startIndex: response.startIndex,
            totalFound: response.totalFound,
            additionalColumns: response.availableColumns
        };
    } );
};

/**
 * GH Copilot Generated - start
 *
 * Removes the highlight from the Displayed Columns drop area.
 *
 * @param {HTMLElement} highlightedElement - The HTML element that is currently highlighted.
 *
 * GH Copilot Generated - end
 */
export const unhighlightDisplayedDropArea = ( highlightedElement ) => {
    if( highlightedElement ) {
        highlightedElement.classList.remove( listDropTopHighlightClass );
        highlightedElement.classList.remove( listDropBottomHighlightClass );
        highlightedElement = null;
    }
};

/**
 * GH Copilot Generated - start
 *
 * Removes the highlight from the Available Columns drop area.
 *
 * @param {HTMLElement} highlightedElement - The HTML element that is currently highlighted.
 *
 * GH Copilot Generated - end
 */
export const unhighlightAvailableDropArea = ( highlightedElement ) => {
    if( highlightedElement ) {
        highlightedElement.classList.remove( listDropHighlightClass );
        highlightedElement = null;
    }
};

/**
 * GH Copilot Generated - start
 *
 * Handles the start of a drag operation, saves the itmes being dragged for use with drop.
 *
 * @param {Object} arrangeData - The data related to the arrangement. This object will be updated with the name of the data provider being dragged and the columns being dragged.
 * @param {Object} dndParams - The parameters related to the drag and drop operation. This object should have a dataProvider property
 * (which should be an object with a name property) and a targetObjects property.
 *
 * GH Copilot Generated - end
 */
export const dragStart = function( arrangeData, dndParams ) {
    arrangeData.draggedDataProviderName = dndParams.dataProvider?.name;
    arrangeData.draggedColumns = dndParams.targetObjects;
};

/**
 * GH Copilot Generated - start
 *
 * Handles the drag over event for the displayed columns.
 *
 * @param {Object} arrangeData - The data related to the arrangement. This object will be updated with the highlighted element.
 * @param {Object} dndParams - The parameters related to the drag and drop operation. This object should have properties: targetObjects, targetElement, and event.
 * @returns {Object} An object that specifies whether to prevent the default action and the effect to be used for the drop operation.
 *
 * GH Copilot Generated - end
 */
export const dragOverDisplayed = function( arrangeData, dndParams ) {
    let targetObject = dndParams.targetObjects ? dndParams.targetObjects[ 0 ] : null;
    if( targetObject ) {
        let sourceObjects = arrangeData.draggedColumns || [];
        if( sourceObjects.length && !( sourceObjects.length === 1 && sourceObjects[ 0 ] === targetObject ) ) {
            let DomRectForTarget = dndParams.targetElement.getBoundingClientRect();
            let rowTopEdge = DomRectForTarget.y;
            let threshold = DomRectForTarget.height / 2;
            let currentTargetCoordinate = dndParams.event.y || dndParams.event.clientY;
            if( currentTargetCoordinate > rowTopEdge && currentTargetCoordinate < rowTopEdge + DomRectForTarget.height ) {
                unhighlightDisplayedDropArea( arrangeData.highlightedElement );
                if( currentTargetCoordinate < rowTopEdge + threshold ) {
                    dndParams.targetElement.classList.add( listDropTopHighlightClass );
                } else if( currentTargetCoordinate > rowTopEdge + threshold ) {
                    dndParams.targetElement.classList.add( listDropBottomHighlightClass );
                }
                arrangeData.highlightedElement = dndParams.targetElement;
            }
            return {
                preventDefault: true,
                dropEffect: 'copy'
            };
        }
    }
    unhighlightDisplayedDropArea( arrangeData.highlightedElement );
    return {
        dropEffect: 'none'
    };
};

/**
 * GH Copilot Generated - start
 *
 * Handles the drag over event for the available columns.
 *
 * @param {Object} arrangeData - The data related to the arrangement. This object will be updated with the highlighted element.
 * @param {Object} dndParams - The parameters related to the drag and drop operation. This object should have properties: targetObjects, targetElement, and event.
 * @returns {Object} An object that specifies whether to prevent the default action and the effect to be used for the drop operation.
 *
 * GH Copilot Generated - end
 */
export const dragOverAvailable = function( arrangeData, dndParams ) {
    if ( dndParams.targetElement && arrangeData.draggedDataProviderName !== arrangeData.dataProviders.dataProviderAvailableColumnConfigs.name ) {
        let availableColumnsSectionElement = dndParams.targetElement.closest( '.arrangeAvailableColumnsSection' );
        availableColumnsSectionElement = availableColumnsSectionElement || dndParams.targetElement.querySelector( '.arrangeAvailableColumnsSection' );
        if ( availableColumnsSectionElement ) {
            availableColumnsSectionElement.classList.add( listDropHighlightClass );

            arrangeData.highlightedElement = availableColumnsSectionElement;

            return {
                preventDefault: true,
                dropEffect: 'copy'
            };
        }
    }
    unhighlightAvailableDropArea( arrangeData.highlightedElement );
    return {
        dropEffect: 'none'
    };
};

/**
 * GH Copilot Generated - start
 *
 * Checks if the drop is below the target element.
 *
 * @param {HTMLElement} highlightedElement - The HTML element that is currently highlighted.
 * @returns {boolean} Returns true if the drop is below the target element, false otherwise.
 *
 * GH Copilot Generated - end
 */
export const isDropBelowTarget = function( highlightedElement ) {
    return Boolean( highlightedElement?.classList.contains( listDropBottomHighlightClass ) ).valueOf();
};

/**
 * GH Copilot Generated - start
 *
 * Checks if the event is a drag/drop event.
 *
 * @param {Event} event - The event to check.
 * @returns {boolean} Returns true if the event is a drag/drop event, false otherwise.
 *
 * GH Copilot Generated - end
 */
export const isDropEvent = function( event ) {
    return event?.type === 'drop';
};

export default exports = {
    postResetFunction,
    getTypeNames,
    getTypesForArrange,
    getTypesForArrangeAsString,
    showAll,
    getAdditionalColumns,
    getColumnUid,
    initializeColumnDef,
    isDefaultColumnConfig,
    isDropBelowTarget,
    isDropEvent,
    dragStart,
    dragOverDisplayed,
    dragOverAvailable,
    unhighlightDisplayedDropArea,
    unhighlightAvailableDropArea
};

/**
 *
 * @param {*} arrangeData
 * @param {*} loadedColumnConfig
 * @param {*} dataProviders
 */
const updateArrangeDataColumnsDefs = function( arrangeData, columns, dataProviders ) {
    arrangeData.columnDefs = [];
    arrangeData.filteredColumnDefs = [];
    arrangeData.availableColumnDefs = [];
    arrangeData.filteredAvailableColumnDefs = [];
    arrangeData.hiddenAvailableColumnDefs.length = 0;

    for ( let i = 0; i < columns.length; ++i ) {
        const column = columns[i];
        const columnDef = initializeColumnDef( column, column.columnOrder, column.propertyName, column.associatedTypeName + '.' + column.propertyName );

        if ( arrangeData.useStaticFirstCol && i === 0 ) {
            arrangeData.staticColumn = columnDef;
        }

        if ( columnDef.visible ) {
            arrangeData.columnDefs.push( columnDef );
            arrangeData.filteredColumnDefs.push( columnDef );
        } else {
            arrangeData.availableColumnDefs.push( columnDef );
            arrangeData.filteredAvailableColumnDefs.push( columnDef );

            arrangeData.availableColumnDefs = _.sortBy( arrangeData.availableColumnDefs, function( availableColumn ) {
                return availableColumn.displayName;
            } );

            arrangeData.filteredAvailableColumnDefs = _.sortBy( arrangeData.filteredAvailableColumnDefs, function( filteredAvailableColumn ) {
                return filteredAvailableColumn.displayName;
            } );
        }
    }

    arrangeData.hiddenAvailableColumnDefs = arrangeData.availableColumnDefs;
    dataProviders?.dataProviderAvailableColumnConfigs?.update?.( arrangeData.filteredAvailableColumnDefs, arrangeData.filteredAvailableColumnDefs.length );

    eventBus.publish( 'operationTypeChanged' );
    eventBus.publish( 'columnChanged', {
        arrangeData: arrangeData
    } );
};

