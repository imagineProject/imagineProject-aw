// Copyright (c) 2022 Siemens

/**
 * @module js/solutionVariantTreeDataService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import localeService from 'js/localeService';
import occmgmtTreeTableDataSvc from 'js/aceTreeTableDataService';
import solutionVariantCellRenderingService from 'js/solutionVariantCellRenderingService';
import treeTableDataService from 'js/treeTableDataService';

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};
let localeTextBundle = localeService.getLoadedText( 'SolutionVariantConstants' );

function _resetContextState( contextKey ) {
    appCtxSvc.ctx[ contextKey ].retainTreeExpansionStates = false;
    appCtxSvc.updatePartialCtx( contextKey + '.treeLoadingInProgress', false );
    if( appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad ) {
        aceContextStateMgmtService.syncContextState( contextKey, appCtxSvc.ctx[ contextKey ].transientRequestPref.selectionToUpdatePostTreeLoad );
    }
    appCtxSvc.ctx[ contextKey ].transientRequestPref = {};
    delete appCtxSvc.ctx[ contextKey ].retainTreeExpansionStateInJitterFreeWay;
}

/**
 * Get a object containing callback function.
 * @return {Object} A object containing callback function.
 */
function getDataForUpdateColumnPropsAndNodeIconURLs( subPanelContext ) {
    var updateColumnPropsCallback = {};
    let contextState = {
        occContext: subPanelContext.occContext,
        key: subPanelContext.occContext.viewKey
    };

    updateColumnPropsCallback.callUpdateColumnPropsAndNodeIconURLsFunction = function( propColumns, allChildNodes, contextKey, response, uwDataProvider ) {
        var columnConfigResult = null;
        let clientColumns = uwDataProvider && !_.isEmpty( uwDataProvider.cols ) ? _.filter( uwDataProvider.cols, { clientColumn: true } ) : [];
        propColumns = clientColumns.length > 0 ? _.concat( clientColumns, propColumns ) : propColumns;
        occmgmtTreeTableDataSvc.updateColumnPropsAndNodeIconURLs( propColumns, allChildNodes, contextState );
        solutionVariantCellRenderingService.setSolutionVariantCellTemplate( propColumns );

        let columnsConfig = response.output.columnConfig;
        columnsConfig.columns = _.sortBy( propColumns, function( column ) { return column.columnOrder; } );
        columnsConfig.columns[ 0 ].displayName = localeTextBundle.sourceStructure;
        columnsConfig.columns[ 0 ].sortDirection = '';
        columnConfigResult = columnsConfig;

        _resetContextState( contextKey );
        return columnConfigResult;
    };
    return updateColumnPropsCallback;
}

export let getContextKeyFromParentScope = function( parentScope ) {
    return aceContextStateMgmtService.getContextKeyFromParentScope( parentScope );
};

export let loadTreeTableProperties = function() {
    arguments[0].updateColumnPropsCallback = getDataForUpdateColumnPropsAndNodeIconURLs( arguments[0].subPanelContext );
    return AwPromiseService.instance.resolve( treeTableDataService.loadTreeTableProperties( arguments[ 0 ] ) );
};

export default exports = {
    loadTreeTableProperties,
    getContextKeyFromParentScope
};
