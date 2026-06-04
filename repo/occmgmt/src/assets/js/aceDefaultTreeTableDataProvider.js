/* eslint-disable class-methods-use-this */

// Copyright (c) 2024 Siemens

/**
 *  aceDefaultTreeTableDataProvider
 *
 *  ACE implementation for BaseTreeTableDataProvider interface
 *  @module js/aceDefaultTreeTableDataProvider
 *
 /**
 * Implementation of DefaultTreeTableDataProvider
 */

import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import BaseTreeTableDataProvider from 'js/aceBaseTreeTableDataProvider';
import _ from 'lodash';

export default class DefaultTreeTableDataProvider extends BaseTreeTableDataProvider {
    constructor( viewContext ) {
        super( viewContext );
    }

    condition( occContext ) {
        return true;
    }

    getViewContext() {
        return 'ACE';
    }

    getClientColumns( columnConfig ) {
        var deferred = AwPromiseService.instance.defer();
        var awColumnInfos = [];
        var firstColumnConfigCol = {
            name: 'object_string',
            displayName: '...',
            typeName: 'Awb0Element',
            width: 400,
            isTreeNavigation: true,
            enableColumnMoving: false,
            enableColumnResizing: false,
            columnOrder: 100
        };
        awColumnInfos.push( firstColumnConfigCol );
        deferred.resolve( awColumnInfos );
        return deferred.promise;
    }

    getProperties( vmTreeNodes, callType ) {
        var deferred = AwPromiseService.instance.defer();
        deferred.resolve(  );
        return deferred.promise;
    }

    async getTreeTableRows( args ) {
        // Call super implementation for default ACE getoccurence SOA call
        return super.getTreeTableRows( args );
    }
}
