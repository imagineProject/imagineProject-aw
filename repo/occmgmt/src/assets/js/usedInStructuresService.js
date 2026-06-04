// Copyright (c) 2022 Siemens

/**
 * @module js/usedInStructuresService
 */
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import iconSvc from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import localeService from 'js/localeService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';

let exports = {};
const clientScopeURI = 'awb0Structure';
let resource = '/i18n/UsedInStructure.json';
let localeTextBundle = localeService.getLoadedText( resource );
let IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

export let setViewConfig = function( subPanelContext, data, topLevel ) {
    let gridId = '';
    let contextKey = 'occmgmtContext'; // TODO - remove this initilaization to make it generic. every sublocation must pass context key.
    let configureStructure;
    if( subPanelContext && subPanelContext.context ) {
        contextKey = subPanelContext.context.contextKey;
    }
    if( subPanelContext && subPanelContext.context && subPanelContext.context.customEditContext === 'rightXRTEditContext' ) {
        gridId = topLevel ? 'usedInStructuresTopLevelGrid2' : 'usedInStructuresGrid2';
        configureStructure = topLevel ? data.configureStructureTopLevel2 : data.configureStructure2;
    } else {
        gridId = topLevel ? 'usedInStructuresTopLevelGrid' : 'usedInStructuresGrid';
        configureStructure = topLevel ? data.configureStructureTopLevel : data.configureStructure;
    }
    return {
        gridId: gridId,
        contextKey: contextKey,
        configureStructureView: configureStructure
    };
};
export let loadNextWhereUsedTree = function( treeLoadInput, subPanelContext, configureParent, level ) {
    let deferred = AwPromiseService.instance.defer();

    let reverseTreeSelectionUid = getReverseTreeSelectionUid( subPanelContext, treeLoadInput.parentNode );
    treeLoadInput.displayMode = 'Tree';
    let reverseeTreeNode = new IModelObject( reverseTreeSelectionUid, 'ItemRevision' );

    if( !treeLoadInput.parentNode.cursorInfo ) {
        treeLoadInput.parentNode.cursorInfo = {};
    }

    //Prepare SOA input
    let soaInput = {
        whereUsedInput: {
            inputObject: reverseeTreeNode,
            additionalInfo: {
                configureParentAndChild: [ configureParent === true ? 'true' : 'false' ],
                level: [ level ]
            },
            cursorInfo: treeLoadInput.parentNode.cursorInfo,
            pageSize: 100,
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: clientScopeURI,
                columnsToExclude: [],
                hostingClientName: '',
                operationType: ''
            }
        }
    };

    buildTreeTableStructure( treeLoadInput, soaInput, deferred );
    return deferred.promise;
};

function getReverseTreeSelectionUid( subPanelContext, parentNode ) {
    let reverseTreeSelectionUid;

    let isRootNode = parentNode.levelNdx === -1;
    if( !isRootNode ) {
        reverseTreeSelectionUid = parentNode.uid;
    } else {
        let currentSelection = subPanelContext.selected;
        if( currentSelection ) {
            if( currentSelection.props && currentSelection.props.awb0UnderlyingObject ) {
                //For default selection in case of selection received from server we are getting runtime object as selection
                reverseTreeSelectionUid = currentSelection.props.awb0UnderlyingObject.dbValues[ 0 ];
            } else {
                //For selection change or any other case (ACE / Home Folder) selection is Item revision.
                reverseTreeSelectionUid = subPanelContext.selected.uid;
            }
        }
    }

    return reverseTreeSelectionUid;
}

/**
* Get used in structures data for the selected element.

* @param {treeLoadInput} treeLoadInput Tree Load Input
* @param {object} uwDataProvider data provider
*
* @return {Promise} Resolved with an object containing the results of the operation.
*/
export let loadWhereUsedTree = function( treeLoadInput, subPanelContext, configureParent, level ) {
    let deferred = AwPromiseService.instance.defer();

    let reverseTreeSelectionUid = getReverseTreeSelectionUid( subPanelContext, treeLoadInput.parentNode );
    let reverseeTreeNode = new IModelObject( reverseTreeSelectionUid, 'ItemRevision' );
    treeLoadInput.displayMode = 'Tree';

    //Prepare SOA input
    let soaInput = {
        whereUsedInput: {
            inputObject: reverseeTreeNode,
            additionalInfo: {
                configureParentAndChild: [ configureParent === true ? 'true' : 'false' ],
                level: [ level ]
            },
            cursorInfo: treeLoadInput.parentNode.cursorInfo,
            pageSize: 100,
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: clientScopeURI,
                columnsToExclude: [],
                hostingClientName: '',
                operationType: ''
            }
        }
    };

    buildTreeTableStructure( treeLoadInput, soaInput, deferred );
    return deferred.promise;
};

/**
 * reset used in structures data.
 * @param {data} data  Used In Structures Data
 */
export let resetUsedInStructuresData = function() {
    let revisionRuleLabelValue = appCtxSvc.getCtx( 'userSession.props.awp0RevRule.uiValue' );
    return {
        revisionRuleLabelValue: revisionRuleLabelValue
    };
};

const createSubstituteProp = ( treeNode, usedAsSubstitute ) => {
    /**
     * Create view model property.
     */
    treeNode.props.usedAsSubstitute = uwPropertySvc.createViewModelProperty( 'usedAsSubstitute', '', 'BOOLEAN', usedAsSubstitute, usedAsSubstitute );

    /**
     * Set properties into view model.
     */
    treeNode.props.usedAsSubstitute.dbValues = [ usedAsSubstitute ];
    treeNode.props.usedAsSubstitute.uiValues = [ usedAsSubstitute ];
    treeNode.props.usedAsSubstitute.uiValue = usedAsSubstitute;

    uwPropertySvc.setIsPropertyModifiable( treeNode.props.usedAsSubstitute, false );
};

/**
 * calls SOA
 * @param {Object} treeLoadInput Tree Load Input
 * @param {Object} soaInput inputData Input for SOA
 * @param {object} uwDataProvider data provider
 * @param {Object} deferred deferred input
 */
function buildTreeTableStructure( treeLoadInput, soaInput, deferred ) {
    //call SOA
    soaSvc.postUnchecked( 'Internal-Structure-2025-06-WhereUsed', 'getWhereUsedInfo2', soaInput ).then(
        function( response ) {
            let enableExportToExcelCmd = true;
            if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
                aceGetOccsResponseService.processPartialErrors( response );
                if( response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ].code === 252122 ) {
                    enableExportToExcelCmd = false;
                }
            }
            // if retrieving first level than set columns for table
            let retrievingFirstLevel = treeLoadInput.parentNode.levelNdx === -1;
            let columnConfig = {};
            var ctx = appCtxSvc.getCtx();
            if(retrievingFirstLevel && soaInput.whereUsedInput?.additionalInfo?.level?.[0]==="IMMEDIATE_PARENTS" && ctx.preferences?.PSEnableOccToOccSubstituteGroups?.[0] === 'true'){
                columnConfig = initColumsForUsedInStructuresTableWithSubstitute( response.columnConfigOutput );
            }else if( retrievingFirstLevel ) {
                columnConfig = initColumsForUsedInStructuresTable( response.columnConfigOutput );
            }

            let modelObjects = [];
            if( response.childToParentMap ) {
                for( let indx = 0; indx < response.childToParentMap[ 0 ].length; indx++ ) {
                    for( let jndx = 0; jndx < response.childToParentMap[ 1 ][ indx ].length; jndx++ ) {
                        let obj = response.childToParentMap[ 1 ][ indx ][ jndx ];
                        let modelObject = obj.resultObject;
                        modelObject.props.hasParent = obj.hasParent;
                        createSubstituteProp( modelObject, obj.occDataInfo );
                        modelObjects.push( modelObject );
                    }
                }
            }

            if( response.cursorInfo ) {
                treeLoadInput.parentNode.cursorObject = response.cursorInfo[ soaInput.whereUsedInput.inputObject.uid ];
                treeLoadInput.parentNode.cursorInfo = response.cursorInfo;
            }

            // prepare view model tree nodes for table
            let treeLoadResult = createViewModelTreeNode( treeLoadInput, modelObjects );

            /**
             * LCS-755828 - Unconfigure Result is coming after toggle On ( Configure Mode)
             * Here cursorInfo is exist thats causes loadedVMObjects not gettingcleared out and we could see old result as it is.
             * after this check, it is showing expected result.
             */
            if( modelObjects.length > 0 ) {
                treeLoadResult.parentNode.cursorObject = treeLoadInput.parentNode.cursorObject;
            } else {
                treeLoadResult.parentNode.cursorObject = undefined;
            }
            treeLoadResult.columnConfig = columnConfig;

            //resolve deferred result
            deferred.resolve( {
                treeLoadResult: treeLoadResult,
                clientScopeURI: clientScopeURI,
                objectSetUri: clientScopeURI,
                enableExportToExcelCmd: enableExportToExcelCmd
            } );
        } );
}

/**
 * @param {TreeLoadInput} treeLoadInput - Parameters for the operation.
 * @param {modelObjects} modelObjects input view model objects
 * @return {object} response
 */
function createViewModelTreeNode( treeLoadInput, modelObjects ) {
    let vmNodes = [];
    // This is the "root" node of the tree or the node that was selected for expansion
    let parentNode = treeLoadInput.parentNode;
    let levelNdx = parentNode.levelNdx + 1;
    treeLoadInput.pageSize = modelObjects.length;
    for( let childNdx = 0; childNdx < modelObjects.length; childNdx++ ) {
        let modelObj = modelObjects[ childNdx ];
        let displayName = modelObj.props.object_string.uiValues[ 0 ];
        let iconType = modelObj.type;
        let iconURL = iconSvc.getTypeIconURL( iconType );
        let hasParent = modelObjects[ childNdx ].props.hasParent;

        //Create treeModelObject
        let treeVmNode = awTableTreeSvc.createViewModelTreeNode( modelObj.uid, modelObj.type, displayName, levelNdx, childNdx, iconURL );

        //Generating unique id for each row. We can't reply on uid as we can have same object multiple time in same table.
        let id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNode.id = id;
        treeVmNode.alternateID = id;

        //copy properties from model object to tree model object
        tcVmoService.mergeObjects( treeVmNode, modelObj );

        //set isLeaf on TreeModelObject
        treeVmNode.isLeaf = !hasParent;

        if( treeVmNode ) {
            vmNodes.push( treeVmNode );
        }
    }
    if( treeLoadInput.parentNode.cursorObject ) {
        return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, treeLoadInput.parentNode.cursorObject.endReached, true );
    }
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, null, true );
}

/**
 * Build column information for Used In Structure Table.
 *
 * @param {ColumConfi} columnConfig - Column config returned by SOA
 * @param {UwDataProvider} dataProvider - The data provider for Used In Structure Table
 *
 */
function initColumsForUsedInStructuresTableWithSubstitute( columnConfig ) {
    // Build AW Columns
    let awColumnInfos = [];
    let columnConfigCols = columnConfig.columns;
    for( let index = 0; index < columnConfigCols.length; index++ ) {
        // fix to increase column width for first column
        let pixelWidth = columnConfigCols[ index ].pixelWidth;
        let columnInfo = {
            field: columnConfigCols[ index ].propertyName,
            name: columnConfigCols[ index ].propertyName,
            propertyName: columnConfigCols[ index ].propertyName,
            displayName: columnConfigCols[ index ].displayName,
            typeName: columnConfigCols[ index ].assosiatedTypeName,
            pixelWidth: pixelWidth,
            hiddenFlag: columnConfigCols[ index ].hiddenFlag,
            enableColumnResizing: true,
            enablePinning: false
        };
        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );

        awColumnInfos.push( awColumnInfo );
    }
    // Add substitute column
    let substituteColInfo = {
        field: "usedAsSubstitute",
        name: localeTextBundle.usedAsSubstitute,
        propertyName: "usedAsSubstitute",
        displayName: localeTextBundle.usedAsSubstitute,
        typeName: "WorkspaceObject",
        pixelWidth: 60,
        hiddenFlag: false,
        enableColumnResizing: false,
        enablePinning: false,
        clientColumn: true,
        isClientColumn: true
    };
    let substituteColumnInfo = awColumnSvc.createColumnInfo( substituteColInfo );

    awColumnInfos.push( substituteColumnInfo );

    // Set columnConfig to Data Provider.
    return {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
}

function initColumsForUsedInStructuresTable( columnConfig ) {
    // Build AW Columns
    let awColumnInfos = [];
    let columnConfigCols = columnConfig.columns;
    for( let index = 0; index < columnConfigCols.length; index++ ) {
        // fix to increase column width for first column
        let pixelWidth = columnConfigCols[ index ].pixelWidth;
        let columnInfo = {
            field: columnConfigCols[ index ].propertyName,
            name: columnConfigCols[ index ].propertyName,
            propertyName: columnConfigCols[ index ].propertyName,
            displayName: columnConfigCols[ index ].displayName,
            typeName: columnConfigCols[ index ].assosiatedTypeName,
            pixelWidth: pixelWidth,
            hiddenFlag: columnConfigCols[ index ].hiddenFlag,
            enableColumnResizing: true,
            enablePinning: false
        };
        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );

        awColumnInfos.push( awColumnInfo );
    }

    // Set columnConfig to Data Provider.
    return {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
}

export let updateToggleLabel = async function( toggleValue ) {
    if( toggleValue === true ) {
        return await localeService.getLocalizedTextFromKey( 'OccurrenceManagementConstants.toggleOn' ).then( ( displayName ) => {
            return displayName;
        } );
    }

    return await localeService.getLocalizedTextFromKey( 'OccurrenceManagementConstants.toggleOff' ).then( ( displayName ) => {
        return displayName;
    } );
};
export default exports = {
    loadWhereUsedTree,
    loadNextWhereUsedTree,
    resetUsedInStructuresData,
    updateToggleLabel,
    setViewConfig
};
