// Copyright (c) 2024 Siemens

/**
 * aceTreeTableExtService
 *
 *  Extension and registration service for ACE applications using occmgmtTree component
 *  Applications using occmgmtTree component need to implement the interface BaseTreeTableDataProvider - aceBaseTreeTableDataProvider.js
 *  @module js/aceTreeTableExtService
 *
 */

import DefaultTreeTableDataProvider from 'js/aceDefaultTreeTableDataProvider';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';

var exports = {};

var treeDataProviders = {};

/**
 * Register TreeTableDataProvider based on provider and viewContext
 */
export let registerProvider = ( provider, occContext ) => {
    if( _.isUndefined( treeDataProviders[ provider.viewContext ] ) ) {
        treeDataProviders[ provider.viewContext ] = provider;
        let occContextValue = { ...occContext };
        var value = {
            currentState: {
                view : provider.getViewContext()
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContextValue, true );

        return treeDataProviders[ provider.viewContext ];
    }
};

/**
 * Un-Register TreeTableDataProvider based on provider and viewContext
 */
export let unRegisterProvider = ( provider, occContext ) => {
    let occContextValue = { ...occContext };
    var value = {
        currentState: {
            view : 'ACE'
        }
    };

    occmgmtUtils.updateValueOnCtxOrState( '', value, occContextValue, true );
    delete treeDataProviders[ provider.viewContext ];
};

/**
 * Un-Register TreeTableDataProvider based on provider and viewContext
 */
export let getTreeDataProviderFromViewContext = ( viewContext ) => {
    return treeDataProviders[ viewContext ];
};

export let getTreeDataProviders = () => {
    return treeDataProviders;
};

/**
 * Un-Register TreeTableDataProvider
 */
export let unRegisterTreeDataProviders = function() {
    return treeDataProviders = {};
};

/**
 * Register DefaultTreeTableDataProvider
 */
export let registerDefaultTreeTableDataProvider = function( occContext, viewContext ) {
    registerProvider( new DefaultTreeTableDataProvider( viewContext ), occContext );
};

/**
 * Un-Register DefaultTreeTableDataProvider based on viewContext
 */
export let unRegisterDefaultTreeTableDataProvider = ( viewContext ) => {
    delete treeDataProviders[ viewContext ];
};

export default exports = {
    getTreeDataProviders,
    getTreeDataProviderFromViewContext,
    registerProvider,
    registerDefaultTreeTableDataProvider,
    unRegisterProvider,
    unRegisterTreeDataProviders,
    unRegisterDefaultTreeTableDataProvider
};
