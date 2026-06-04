/* eslint-disable class-methods-use-this */

// Copyright (c) 2024 Siemens

/**
 * aceBaseTreeTableDataProvider
 *
 *  Interface for BaseTreeTableDataProvider
 *  Applications using occmgmtTree component need to implement the interface BaseTreeTableDataProvider
 *  Example usage of BaseTreeTableDataProvider is given below
 *  @module js/aceBaseTreeTableDataProvider
 *
 /**
 * Example usage of BaseTreeTableDataProvider
 */

// export class DefaultTreeTableDataProvider extends BaseTreeTableDataProvider {
//     constructor( viewContext ) {
//         super( viewContext );
//     }

//     condition( occContext ) {
//         ...
//         return true\false;
//     }

//     getViewContext( ) {
//         // Build Conditions - view = 'BC'
//         // Change Manager  -  view = 'CN'
//         return view;
//     }

//     getClientColumns( columnConfig ) {
//         var deferred = AwPromiseService.instance.defer();
//         ...
//         deferred.resolve( clientColumns );
//         return deferred.promise;
//     }

//     getProperties( vmTreeNodes, callType ) {
//         var deferred = AwPromiseService.instance.defer();
//         ...
//         if callType is foreground make foreground SOA call
//         if callType is background make background SOA call
//
//         deferred.resolve();
//         return deferred.promise;
//     }

//     async getTreeTableRows( args ) {
//        return {
//                   treeLoadResult: treeLoadResult
//               };
//    }

// }

import aceTreeTableDataService from 'js/aceTreeTableDataService';

/**
 * Interface for BaseTreeTableDataProvider
 */
export default class BaseTreeTableDataProvider {
    constructor( viewContext ) {
        // Store viewContext for each application
        this.viewContext = viewContext;
    }

    /**
     * Api to get the condition result
     * @param {Boolean} true\false based on the application condition to use the BaseTreeTableDataProvider implementation
     */
    condition( occContext ) {}

    /**
     *  Api to get view context of the view
     *  Build Conditions - view = 'BC'
     *  Change Manager  -  view = 'CN'
     */
    getViewContext() {}

    /**
     * Api to get client columns to be injected
     * @param {columnConfig} columnConfig currently available with the dataprovider
     * @return {Promise} A Promise that will be resolved with the client columns to be injected
     */
    getClientColumns( columnConfig ) {}

    /**
     * Api to fetch properties for client columns
     * @param {Array} vmTreeNodes of Awb0Elements to fetch properties
     * @param {callType} string -foreground\background Applications making a SOA call to fetch properties should use this parameter when calling soaService
     * @return {Promise} A Promise that will be resolved with the properties of the Awb0Elements
     */
    getProperties( vmTreeNodes, callType ) {}

    /**
     * Api to fetch Tree Table Nodes - Default implementation can be overridden by applications using different SOA other than getOccurrence
     * Get a page of row data for a 'tree' table.
     *
     * Note: This method assumes there is a single argument object being passed to it and that this object has the
     * following property(ies) defined in it.
     * {TreeLoadInput} treeLoadInput - An Object with details for this action for what to load. The object is
     * usually the result of processing the 'inputData' property of a DeclAction based on data from the current DeclViewModel.
     * {dataProviderActionType} type of action - initializeAction, nextAction, previousAction, focusAction
     * {loadIDs} - loadIDs
     * {uwDataProvider} - handle of the dataProvider
     * {sortCriteria} - sortCriteria
     * {subPanelContext} - subPanelContext
     * @param {Object} argument
     * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
     *         available.
     */
    async getTreeTableRows( args ) {
        let localArgs = args[ 0 ];
        switch ( localArgs.dataProviderActionType ) {
            case 'initializeAction':
                return await aceTreeTableDataService.loadTreeTableData( localArgs );
            case 'nextAction':
                return await aceTreeTableDataService.loadNextOccurrencesInTreeTable( localArgs );
            case 'previousAction':
                return await aceTreeTableDataService.loadPreviousOccurrencesInTreeTable( localArgs );
            case 'focusAction':
                return await aceTreeTableDataService.loadOccurrencesWithFocusInTreeTable( localArgs );
        }
    }
}
