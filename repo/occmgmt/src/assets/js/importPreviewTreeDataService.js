//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 */

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/importPreviewTreeDataService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertySvc from 'js/uwPropertyService';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import importCellRenderingService from 'js/importCellRenderingService';
import appCtxSvc from 'js/appCtxService';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import importPreviewTreeRespProcessingService from 'js/importPreviewTreeRespProcessingService';
import importPreviewSetActionOnLine from 'js/importPreviewSetActionOnLine';
import localeService from 'js/localeService';
import navigationSvc from 'js/navigationService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';

var exports = {};

var _nodeToPropsArray = [];
/**
 * Internal column names sent by server in vmo's property map to assist client in
 * creating tree from flat list of nodes.
 */
let internalColumnNames = [ 'ParentInx', 'Index', 'Level', 'HasChildren' ];

const useExistingValueInternalName = 'importPreview_use_existing_value';

/**
 * Processes server response and populates column config and create nodes for splm tree widget
 * Additionally, updates the tab names for each sheet in multi-sheet structures on the preview page.
 *
 * @param {*} dataProvider
 * @param {*} treeLoadInput
 * @param {*} declViewModel
 */
let processSOAResponse = function( dataProvider, treeLoadInput, declViewModel, sharedData, importBOMContext ) {
    return function( response ) {
        let createdNodes = [];
        //Update Columns
        importPreviewTreeRespProcessingService.populateTreeNodes( response.nodeInfos,
            _nodeToPropsArray, createdNodes );

        importPreviewTreeRespProcessingService.populateTreeColumns( response.columnConfig, dataProvider, internalColumnNames );

        // Third Paramter is for a simple vs ??? tree
        let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput,
            createdNodes, true, true, response.cursor.endReached );

        if( declViewModel && declViewModel.dataProviders ) {
            let vmc = occmgmtUtils.getCurrentTreeDataProvider( declViewModel.dataProviders ).viewModelCollection;
            appCtxSvc.updatePartialCtx( 'aceActiveContext.context.vmc', vmc );
        }

        // Update the response data to sharedData tabs name
        if( importBOMContext.isFileUpdated || sharedData.value.topLineNameList && sharedData.value.topLineNameList.length === 0 ) {
            let topLineNameList = response.sheetIndexNameInfos.map( ( sheetIndexNameInfo ) => ( {
                name: sheetIndexNameInfo.sheetTopLineObjName,
                tabKey: sheetIndexNameInfo.sheetIndex
            } ) );

            if ( topLineNameList.length > 0 ) {
                const updatedSharedData = { topLineNameList };
                if ( sharedData.update ) {
                    sharedData.update( updatedSharedData );
                }
            }
        }

        dataProvider.topTreeNode.cursorObject = response.cursor;
        return {
            parentNode: treeLoadResult.parentNode,
            childNodes: treeLoadResult.childNodes,
            totalChildCount: treeLoadResult.totalChildCount,
            startChildNdx: 0,
            treeLoadResult: treeLoadResult
        };
    };
};

/**
 * Generates the input object for preview SOA based.
 * This function updates the shared data if the file has been updated and prepares the necessary input data for further processing.
 *
 * @param {Object} treeLoadInput - The input object containing cursor and other relevant data for processing.
 * @param {Object} importBOMContext - Context object containing information about file updates and mapping data.
 * @param {Object} sharedData - Shared data object containing top line name list and update method.
 * @returns {Object} - An object with 'inputData' property, containing:
 *   - 'transientFileWriteTicket': A ticket for file write operations, retrieved from `importBOMContext`.
 *   - 'sheetIndex': The index of the sheet to be processed, determined from 'sharedData' or default to 0.
 *   - 'isAllSheetsInfoRequired': A boolean indicating if all sheets' information is required, based on file update status.
 *   - 'propInfos': An array of property information (currently empty). Hijacked to pass excel file type
 *   - 'sheetTypePropInfos': Mapping information for all the sheet types from `importBOMContext`.
 *   - 'cursor': The cursor from `treeLoadInput`, or the `treeLoadInput` object itself if no cursor is present.
 */
function getSoaInput( treeLoadInput, importBOMContext, sharedData ) {
    let propInfos = [];
    // Use propInfos to send the file type to the server
    let propInfoStruct = {
        propHeader: '',
        realPropName: '',
        realPropDisplayName: '',
        isRequired: false
    };
    propInfoStruct.realPropName = importBOMContext.fileType ? importBOMContext.fileType : 'unknownFileType';
    propInfos.push( propInfoStruct );
    let cursor = treeLoadInput.cursor ? treeLoadInput.cursor : treeLoadInput;
    let sharedDataNameList = sharedData.topLineNameList;
    let isAllSheetsInfoRequired = importBOMContext.isFileUpdated || importBOMContext.fmsTicket === 'COMPREHENSIVE_ERROR_REPORT';
    if( isAllSheetsInfoRequired ) {
        let topLineNameList = [];
        const updatedSharedData = { topLineNameList };
        if ( sharedData.update ) {
            sharedData.update( updatedSharedData );
        }
        sharedDataNameList = [];
    }
    let sheetIndex =  sharedDataNameList?.length > 0  ? sharedDataNameList.find( tab => tab.selectedTab )?.tabKey : getFirstNonEmptySheetIndex( importBOMContext.allSheetsMapInfos );
    return {
        inputData: {
            transientFileWriteTicket: importBOMContext.fmsTicket,
            sheetIndex: sheetIndex,
            isAllSheetsInfoRequired: isAllSheetsInfoRequired,
            propInfos: propInfos,
            sheetTypePropInfos:importBOMContext.allSheetsMapInfos,
            cursor: cursor
        }
    };
}

/**
 * Finds the index of the first non-empty type property sheet from the provided sheet information.
 *
 * @param {Array} sheetsInfo - An array of sheet information objects, each containing a 'sheetIndex' and 'typePropInfos'.
 * @returns {number} - The index of the first sheet with non-empty typePropInfos.
 */
function getFirstNonEmptySheetIndex( sheetsInfo ) {
    for ( const sheetInfo of sheetsInfo ) {
        if ( sheetInfo.typePropInfos && Object.keys( sheetInfo.typePropInfos ).length > 0 ) {
            return sheetInfo.sheetIndex;
        }
    }
    return 0;
}

/**
 * Call Soa and get the data from server
 **/
function getImportPreviewData( soaInput ) {
    let headerStateOverride = {
        unitSystem: 'As Authored'
    };
    return soaSvc.postUnchecked( 'Internal-XlsBom-2024-12-Import', 'getSheetStructureInfoFromExcel',
        soaInput, null, false, headerStateOverride ).then( function( response ) {
        var deferred = AwPromiseService.instance.defer();
        if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
            aceGetOccsResponseService.processPartialErrors( response );
            eventBus.publish( 'importBOM.previewTreeLoadFailure' );
        }
        deferred.resolve( response );
        return deferred.promise;
    }, function( error ) {
        throw soaSvc.createError( error );
    } );
}

/**
 * Create View Model Property
 *
 * @param columnNumber
 * @param columnInfo
 * @param vmNode
 */
let createViewModelProperty = function( columnInfo, vmNode ) {
    let localBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
    let columnName = columnInfo.name;
    let props = _nodeToPropsArray[ vmNode.id ];
    let dbValues = [ props[ columnName ] ];
    // If the dbValue is set to the internal name for "Use Existing Value" text, convert uiValue to localized string
    let uiValues = [ '' ];
    if( dbValues[ 0 ] === useExistingValueInternalName ) {
        uiValues = [ localBundle.aceImportPreviewUseExistingValue ];
    } else {
        uiValues = [ props[ columnName ] ];
    }
    let vmProp = uwPropertySvc.createViewModelProperty( columnName, columnInfo.displayName,
        columnInfo.typeName, dbValues, uiValues );
    vmProp.propertyDescriptor = {
        displayName: columnInfo.displayName
    };
    return vmProp;
};

// Using the action column cell, add the internal name of the action to the VMO for use with preview action command condition statements
let setInitialInternalActionName = function( vmo ) {
    let localBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );
    let internalActionName = '';
    _.forEach( vmo.props, function( prop ) {
        if ( prop.propertyName === 'preview_action' || prop.propertyName === localBundle.actionColumn ) {
            switch( prop.dbValue[0] ) {
                case localBundle.aceImportPreviewNewAction:
                    internalActionName = 'New';
                    break;
                case localBundle.aceImportPreviewReviseContentMenu:
                    internalActionName = 'Revise';
                    break;
                case localBundle.aceImportPreviewOverwriteContentMenu:
                    internalActionName = 'Overwrite';
                    break;
                case localBundle.aceImportPreviewReferenceContentMenu:
                    internalActionName = 'Reference';
                    break;
            }
        }
    } );

    return internalActionName;
};

/**
 * @param {*} columnInfos
 * @param {*} vmo
 */
function _populateColumns( columnInfos, vmo ) {
    _.forEach( columnInfos, function( columnInfo ) {
        columnInfo.cellRenderers = [];
        if( !columnInfo.isTreeNavigation && !_.isUndefined( _nodeToPropsArray[ vmo.id ] ) ) {
            vmo.props[ columnInfo.name ] = createViewModelProperty( columnInfo, vmo );
        }
        importCellRenderingService.setCellRendererTemplate( columnInfo );
    } );
    vmo.internalActionName = setInitialInternalActionName( vmo );
    importPreviewSetActionOnLine.populateActionColumnForReusedAssembly( vmo );
}

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {TreeLoadInput} treeLoadInput - An Object this action function is invoked from. The object is usually
 *            the result of processing the 'inputData' property of a DeclAction based on data from the current
 *            DeclViewModel on the $scope) . The 'pageSize' properties on this object is used (if defined).
 *
 * <pre>
 * {
 * Extra 'debug' Properties
 *     dbg_isLoadAllEnabled: {Boolean}
 *     dbg_pageDelay: {Number}
 * }
 * </pre>
 *
 * @return {Promise} A Promise that will be resolved with a TreeLoadResult object when the requested data is
 *         available.
 */
export let loadTreeTableData = function( treeLoadInput, dataProvider, subPanelContext, declViewModel, cursor ) {
    /**
     * Check the validity of the parameters
     */
    let deferred = AwPromiseService.instance.defer();

    treeLoadInput.displayMode = 'Tree';
    treeLoadInput.cursor = cursor;
    // deselct the selected row from previous page
    dataProvider.selectNone();
    if( dataProvider.topTreeNode && dataProvider.topTreeNode.cursorObject ) {
        treeLoadInput.cursor = dataProvider.topTreeNode.cursorObject;
    }
    let importBOMContext = appCtxSvc.getCtx( 'ImportBOMContext' );
    if( importBOMContext ) {
        let soaInput = getSoaInput( treeLoadInput, importBOMContext, subPanelContext.sharedData );
        return getImportPreviewData( soaInput ).then(
            processSOAResponse( dataProvider, treeLoadInput, declViewModel, subPanelContext.sharedData, importBOMContext ) );
    }

    // If SOA input is not available it means location is not built correctly, Navigating it to Home.
    let action = { actionType: 'Navigate' };
    action.navigateTo = 'showHome';
    navigationSvc.navigate( action, {} );
};

/**
 * Get a page of row data for a 'tree' table.
 *
 * @param {PropertyLoadRequestArray} propertyLoadRequests - An array of PropertyLoadRequest objects this action
 *            function is invoked from. The object is usually the result of processing the 'inputData' property
 *            of a DeclAction based on data from the current DeclViewModel on the $scope) . The 'pageSize'
 *            properties on this object is used (if defined).
 * @returns {Promise} promise
 *
 */
export let loadTreeTableProperties = function( propertyLoadInput ) {
    if( propertyLoadInput ) {
        let allChildNodes = [];
        _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
            _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
                if( !childNode.props ) {
                    childNode.props = {};
                }
                _populateColumns( propertyLoadRequest.columnInfos, childNode );
                allChildNodes.push( childNode );
            } );
        } );
        let deferred = AwPromiseService.instance.defer();
        let propertyLoadResult = awTableTreeSvc.createPropertyLoadResult( allChildNodes );
        let resolutionObj = {
            propertyLoadResult: propertyLoadResult
        };
        deferred.resolve( resolutionObj );
        return deferred.promise;
    }
    return AwPromiseService.instance.reject( 'Missing PropertyLoadInput parameter' );
};

/**
 * importPreviewTreeDataService factory
 */
export default exports = {
    loadTreeTableData,
    loadTreeTableProperties
};
