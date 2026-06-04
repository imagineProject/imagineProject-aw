

// Copyright (c) 2023 Siemens

/**
 *
 * @module js/Cm1ChangeSummaryService
 */

import $ from 'jquery';
import { getBaseUrlPath } from 'app';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import _ from 'lodash';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import preferenceService from 'soa/preferenceService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import localeSvc from 'js/localeService';
import LocationNavigationService from 'js/locationNavigation.service';
import compareSvc from 'js/structureCompareService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import tcDataMgmtService from 'js/tcDataManagementService';
import awCompare from 'js/awCompare.service';
import eventBus from 'js/eventBus';
import cmUtils from 'js/changeMgmtUtils';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import iconSvc from 'js/iconService';
import htmlUtil from 'js/htmlUtils';
import tableSvc from 'js/splmTablePublishedService';
import occmgmtUtils from 'js/occmgmtUtils';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';
import awIconSvc from 'js/awIconService';

//Cached reference to AngularJS & AW services.
var exports = {};
var supportedSOA = {};
var isPreviousRowBottomBorder = false;
var isSupersedure = false;

/**
  * Call getChangeSummaryData to render change summary table
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {Boolean} isGenealogy - Boolean value has the geneology status.
  * @param {subPanelContext} subPanelContext - The context object holds the selection related data
  * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
  */
export let getChangeSummaryData = function( treeLoadInput, dataProvider, isGenealogy, subPanelContext, isMergeCandidate ) {
    //Deferred response
    var deferred = AwPromiseService.instance.defer();

    //Reset the isPreviousRowBottomBorder to false at the begining of the change summary call
    isPreviousRowBottomBorder = false;
    //Check the validity of the parameters

    //get tree nodes via SOA
    return generateChangeSummaryTableData( treeLoadInput, dataProvider, isGenealogy, subPanelContext, isMergeCandidate );
};

/**
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {Boolean} isGenealogy - Boolean value has the geneology status.
  * @param {subPanelContext} subPanelContext - The context object holds the selection related data
  * @param {DeferredResolution} deferred - Resolved with a resulting TreeLoadResult object.
  */
function generateChangeSummaryTableData( treeLoadInput, dataProvider, isGenealogy, subPanelContext, isMergeCandidate ) {
    //Call SOA getChangeSummaryData
    return getChangeSummaryDataSOA( treeLoadInput, dataProvider, isGenealogy, subPanelContext ).then(
        function( dataForChangeSummaryTable ) {
            //Process SOA Response
            var treeLoadResult = processGetChangeSummaryDataResponse( dataForChangeSummaryTable,
                treeLoadInput, dataProvider, null, null, null, isMergeCandidate );

            // Return output to render change summary table
            return {
                treeLoadResult: treeLoadResult,
                columnConfig:dataProvider.columnConfig,
                columns:dataProvider.columnConfig.columns
            };
        } );
}
/**
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {Boolean} isGenealogy - Boolean value has the geneology status.
  * @param {subPanelContext} subPanelContext - The context object holds the selection related data
  * @return {dataForChangeSummaryTable} Data Required to render change summary table like vmo, columns
  */
function getChangeSummaryDataSOA( treeLoadInput, dataProvider, isGenealogy, subPanelContext ) {
    // getChangeSummaryData requires following input
    // 1. changeNoticeRevision - Selected ChangeNoticeRevision
    // 2. selectedRow - Selected Object from Change Summary table( In case of expanding parent )
    // 3. isOddRowSelected - Flag to indicate whether selected row is rendered as odd background color or even background color.
    //                       Based on this background color flag for child row is calculated on server.
    // 4. startIndex - StartIndex for next page. Change Summary table pagination at first level.
    // 5. pageSize - Number of objects should be returned per SOA call. Change Summary Table only support pagination at first level.
    // Get the SOA input data
    var inputData = getChangeSummaryInputData( appCtxSvc.ctx, treeLoadInput, dataProvider, isGenealogy, subPanelContext );

    // Set Input
    var soaInput = {
        changeSummaryInput: inputData
    };

    var policy = {
        types: [ {
            name: 'WorkspaceObject',
            properties: [ {
                name: 'object_string'
            }
            ]
        } ]
    };

    //Register Policy
    var policyId = propPolicySvc.register( policy );

    // Get the service name based on tc server release
    if ( !supportedSOA.serviceName ) {
        supportedSOA = cmUtils.getSupportedChangeSummarySOA();
    }

    // Call SOA to get the data
    return soaSvc.post( supportedSOA.serviceName, supportedSOA.operationName, soaInput ).then(
        function( response ) {
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            var dataObjects = response.dataObjects;
            var vmos = [];
            dataObjects.forEach( function( dataObject ) {
                //Create a view model object
                if( dataObject ) {
                    createViewModelObjectFromSOADataObject( dataObject, vmos );
                }
            } );

            // Return viewmodelobject, total number of vmo, end index of page and column information
            return {
                searchResults: vmos,
                totalFound: response.totalFound, // This can be different than total numner of vmo. Total numnber is nummber of solutions loaded. But vmos an contain some of the impacted to display strikthrough
                endIndex: response.endIndex,
                currentColumnConfig: response.currentColumnConfig,
                defaultColumnConfig: response.defaultColumnConfig
            };
        } );
}

/**
  * Check if input object is of type input type. If yes then
  * return true else return false.
  *
  * @param {Object} obj Object to be match
  * @param {String} type Object type to match
  *
  * @return {boolean} True/False
  */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};


/**
  * @param {ChangeSummaryTableDataObject} dataObject - DataObject from SOA
  * @param {ViewModelObject} vmos - Array of all View Model Objects
 * @param {Boolean} isProductBOM - If primaryObject is of type PartUsage, isProductBOM is set to true for its sibilings
  * @return {ViewModelObject} ViewModelObject.
  */
function createViewModelObjectFromSOADataObject( dataObject, vmos, isProductBOM = false ) {
    //Process each dataObject ( ChangeSummaryTableDataObject ) received in response and create a ViewModelObject.
    var vmo = null;

    if( dataObject.primaryObject && dataObject.primaryObject.uid && dataObject.primaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
        vmo = viewModelObjectService.createViewModelObject( dataObject.primaryObject.uid );
    } else {
        if( dataObject.secondaryObject ) {
            vmo = viewModelObjectService.createViewModelObject( dataObject.secondaryObject.uid );
        }
    }

    //for remove use case in usage bom merge, we are getting the uid of part usage rev from additional data of soa response.
    //below code checks whether solutionItemRev is null or undefined and whether length is more than 0(making use of optional chaining),
    //and assigns value to vmo.solItemRevuid
    if( dataObject.additionalData?.arrSolutionItemRev  && dataObject.additionalData.arrSolutionItemRev.length > 0 ) {
        vmo.solItemRevuid = dataObject.additionalData.arrSolutionItemRev[0];
    }

    //Added validation for null or undefined to fix coverity issue
    if ( vmo !== undefined && vmo !== null ) {
        //set Primary and secondary objects for compare.
        vmo.primaryObjectUid = dataObject.primaryObject.uid;
        vmo.secondaryObjectUid = dataObject.secondaryObject.uid;

        //Current vmo row has odd row color
        vmo.isOdd = cmUtils.getAdditionalDataValue( dataObject, 'isOddRow', true );

        //is current vmo row has children
        vmo.hasChildren = cmUtils.getAdditionalDataValue( dataObject, 'hasChildren', true );

        //is compare button required for the row
        vmo.isCompareRow = cmUtils.getAdditionalDataValue( dataObject, 'isCompareRow', true );

        vmo.isAbsOccInContextParent = cmUtils.getAdditionalDataValue( dataObject, 'isAbsOccInContextParent', true );

        //Added to provide supersedure functionality
        vmo.bomEditUid = cmUtils.getAdditionalDataValue( dataObject, 'bomEditId', false );
        vmo.bomEditParentBVR = cmUtils.getAdditionalDataValue( dataObject, 'bomEditParentBVR', false );
        vmo.bomEditSupersedure = cmUtils.getAdditionalDataValue( dataObject, 'bomEditSupersedure', false );
        vmo.bomEditType = cmUtils.getAdditionalDataValue( dataObject, 'bomEditType', false );
        vmo.supersedure_begin = cmUtils.getAdditionalDataValue( dataObject, 'Supersedure_Begin', false );
        vmo.supersedure_end = cmUtils.getAdditionalDataValue( dataObject, 'Supersedure_End', false );

        // Get the supporting secondary object and if not null then set to VMO
        var supportingSecondaryVMO = null;
        if( dataObject.supportingSecondaryObject && dataObject.supportingSecondaryObject.uid && dataObject.supportingSecondaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
            supportingSecondaryVMO = viewModelObjectService.createViewModelObject( dataObject.supportingSecondaryObject.uid );
        }
        vmo.supportingSecondaryVMO = supportingSecondaryVMO;

        //set supporting primary object
        var supportingPrimaryVMO = null;
        if( dataObject.supportingPrimaryObject && dataObject.supportingPrimaryObject.uid && dataObject.supportingPrimaryObject.uid !== 'AAAAAAAAAAAAAA' ) {
            supportingPrimaryVMO = viewModelObjectService.createViewModelObject( dataObject.supportingPrimaryObject.uid );
        }
        vmo.supportingPrimaryVMO = supportingPrimaryVMO;

        // Process each properties (  ChangeSummaryTableObjectProperty ) for a ChangeSummaryTableDataObject
        dataObject.objectProperties.forEach( function( dataProperty ) {
            // Current value
            var propValue = '';
            var propValueArray = [];
            if( dataProperty.currentUIValue ) {
                propValue = dataProperty.currentUIValue.toString();
                propValueArray = dataProperty.currentUIValue;
            }

            var propDbValueArray = [];
            if( dataProperty.currentDBValue ) {
                propDbValueArray = dataProperty.currentDBValue;
            }

            // old value - used to display strikethrough
            var propOldValue = '';
            var propOldValueArray = [];
            if( dataProperty.oldUIValue ) {
                propOldValue = dataProperty.oldUIValue.toString();
                propOldValueArray = dataProperty.oldUIValue;
            }

            var propOldDbValueArray = [];
            if( dataProperty.oldDBValue ) {
                propOldDbValueArray = dataProperty.oldDBValue;
            }

            //Create a ViewModelProperty
            var dispValue = [];
            const propDisplayName = dataProperty.propDisplayName ? dataProperty.propDisplayName : dataProperty.propInternalName;
            var propVM = uwPropertyService.createViewModelProperty( dataProperty.propInternalName,
                propDisplayName, 'String', '', dispValue );
            if( dataProperty.currentDBValue ) {
                propVM.dbValue = dataProperty.currentDBValue;
            }
            propVM.uiValue = propValue;
            propVM.uiValues = propValueArray;
            delete propVM.displayValue;
            delete propVM.displayValues;

            propVM.currentValue = propValue;
            localeSvc.getLocalizedText( 'ChangeMessages', 'Cm1ReplaceRemoveGroupLocale' ).then( function( result ) {
                if( propVM.currentValue === result ) {
                    propVM.currentDbValue = 'Added New to Replace';
                }
            } );

            propVM.currentValues = propValueArray;

            if( propValue !== propOldValue ) {
                propVM.oldValue = propOldValue;
                propVM.oldValues = propOldValueArray;
            }

            propVM.dbValues = ( function() {
                var dbValues = [];
                for( var i = 0; i < propDbValueArray.length; i++ ) {
                    dbValues.push( propDbValueArray[ i ] );
                }
                return dbValues;
            } )();
            propVM.currentDbValueArray = propDbValueArray;
            propVM.oldDbValueArray = propOldDbValueArray;

            propVM.inputStyle = '';

            // If dataProperty.oldDBValue and dataProperty.currentDBValue is populated with values, consider it as Reference type of property.
            // Currently we are populating dataProperty.oldDBValue and dataProperty.currentDBValue only for Reference type property.
            // The property type needs to be returned from server insted of relying on dbValues. When we write new SOA version this needs to be handled.
            propVM.type = 'STRING';
            if( dataProperty.currentDBValue || dataProperty.oldDBValue ) {
                propVM.type = 'OBJECT';
            }

            //Add a style for Remove Cell
            if( dataProperty.propInternalName === 'action' ) {
                if( propDbValueArray[0] === 'Remove' || propDbValueArray[0] === 'Replace' ) {
                    propVM.isChangeCell = true;
                    propVM.internalActionName = propDbValueArray[0];
                }
                propVM.type = 'STRING';
            }

            //Calculate Tooltip property values
            calculateToolTipValues( dataProperty, propVM );

            vmo.props[ dataProperty.propInternalName ] = propVM;

            if( dataProperty.propInternalName === 'm_mergeStatus' ) {
                //Create a ViewModelProperty
                var mergeDispValue = [];
                var mergePropVM = uwPropertyService.createViewModelProperty( 'mergeStatus',
                    'mergeStatus', 'String', '', mergeDispValue );
                mergePropVM.displayValues = dataProperty.currentUIValue;
                mergePropVM.dbValues = dataProperty.currentDBValue;
                mergePropVM.commonDisplayValues = propVM.commonDisplayValues;
                mergePropVM.commonInternalValues = propVM.commonInternalValues;
                //Create a ViewModelProperty
                vmo.props.mergeStatus = mergePropVM;
            }
        } );

        let iconURL = awIconSvc.getTypeIconFileUrl( vmo );
        if( !_.isEmpty( iconURL ) ) {
            vmo.typeIconURL = iconURL;
        }

        //Changing type icon for Part Usage
        if(  supportingPrimaryVMO && supportingPrimaryVMO.modelType.typeHierarchyArray.indexOf( 'Fnd0AbstractOccRevision' ) > -1
        ||  supportingSecondaryVMO && supportingSecondaryVMO.modelType.typeHierarchyArray.indexOf( 'Fnd0AbstractOccRevision' ) > -1
        || isProductBOM ) {
            let typeIconVmo = null;
            vmo.typeIconURL = iconSvc.getTypeIconURL( 'Fnd0AbstractOccRevision' );

            if( supportingPrimaryVMO && supportingPrimaryVMO.modelType.typeHierarchyArray.indexOf( 'Fnd0AbstractOccRevision' ) > -1 ) {
                typeIconVmo = supportingPrimaryVMO;
            } else {
                typeIconVmo = supportingSecondaryVMO;
            }
            if ( typeIconVmo ) {
                typeIconVmo.props = vmo.props;
                let iconURL = awIconSvc.getTypeIconFileUrl( typeIconVmo );
                if( !_.isEmpty( iconURL ) ) {
                    vmo.typeIconURL = iconURL;
                }
            }

            // Setting isProductBOM to true for sibling objects, this is required for replace use case where
            // supportingPrimaryObject or supportingSecondaryObject is not present.
            isProductBOM = true;
        }

        vmos.push( vmo );

        //Process sibling data object
        vmo.siblingDataObjects = [];
        var siblingDataObjects = dataObject.siblingDataObjects;
        siblingDataObjects.forEach( function( siblingDataObject ) {
            var siblingVmo = createViewModelObjectFromSOADataObject( siblingDataObject, vmos, isProductBOM );
            vmo.siblingDataObjects.push( siblingVmo );
        } );
    }

    return vmo;
}

/**
  * @param {ChangeSummaryTableDataObject} dataProperty -property from SOA
  * @param {ViewModelProperty} propVM - View Model Property
  */
function calculateToolTipValues( dataProperty, propVM ) {
    // If dbValue is not present than consider uiValues as dbValues.

    var currentUIValuesToProcess = dataProperty.currentUIValue;
    var oldUIValuesToProcess = dataProperty.oldUIValue;

    var currentDBValuesToProcess = [];
    if( dataProperty.currentDBValue ) {
        currentDBValuesToProcess = dataProperty.currentDBValue;
    } else {
        currentDBValuesToProcess = dataProperty.currentUIValue;
    }

    var oldDBValuesToProcess = [];
    if( dataProperty.oldDBValue ) {
        oldDBValuesToProcess = dataProperty.oldDBValue;
    } else {
        oldDBValuesToProcess = dataProperty.oldUIValue;
    }

    var addedDisplayValues = [];
    var addedInternalValues = [];

    var removedDisplayValues = [];
    var removedInternalValues = [];

    var commonDisplayValues = [];
    var commonInternalValues = [];

    var isArrayProperty = false; // If any of one of the property contain more than one value consider it as array property.
    if( currentDBValuesToProcess !== undefined && currentDBValuesToProcess.length > 1 || oldDBValuesToProcess !== undefined && oldDBValuesToProcess.length > 1 ) {
        isArrayProperty = true;
    }

    if( !isArrayProperty ) {
        // For non-array property value add current value to commonValues and old values to removed values.
        if( currentDBValuesToProcess !== undefined ) {
            commonDisplayValues.push( currentUIValuesToProcess[ 0 ] );
            commonInternalValues.push( currentDBValuesToProcess[ 0 ] );
        }

        if( oldDBValuesToProcess !== undefined ) {
            if( currentDBValuesToProcess === undefined || oldDBValuesToProcess[ 0 ] !== currentDBValuesToProcess[ 0 ] ) { // Extra check if current value and old value are same don't show old value.
                removedDisplayValues.push( oldUIValuesToProcess[ 0 ] );
                removedInternalValues.push( oldDBValuesToProcess[ 0 ] );
            }
        }
    } else {
        // For array property values
        // If old value doesn't contain current value consider it as added value
        // If current value doesn't contain old value consider it as removed value
        // Else it is common values.
        if( currentDBValuesToProcess !== undefined ) {
            for( var i in currentDBValuesToProcess ) {
                if( oldDBValuesToProcess !== undefined && !oldDBValuesToProcess.includes( currentDBValuesToProcess[ i ] ) ) {
                    addedDisplayValues.push( currentUIValuesToProcess[ i ] );
                    addedInternalValues.push( currentDBValuesToProcess[ i ] );
                } else {
                    commonDisplayValues.push( currentUIValuesToProcess[ i ] );
                    commonInternalValues.push( currentDBValuesToProcess[ i ] );
                }
            }
        }

        if( oldDBValuesToProcess !== undefined ) {
            for( i in oldDBValuesToProcess ) {
                if( currentDBValuesToProcess === undefined || !currentDBValuesToProcess.includes( oldDBValuesToProcess[ i ] ) ) {
                    removedDisplayValues.push( oldUIValuesToProcess[ i ] );
                    removedInternalValues.push( oldDBValuesToProcess[ i ] );
                } else {
                    if( !commonInternalValues.includes( oldDBValuesToProcess[ i ] ) ) {
                        commonDisplayValues.push( oldUIValuesToProcess[ i ] );
                        commonInternalValues.push( oldDBValuesToProcess[ i ] );
                    }
                }
            }
        }
    }

    // set comparision set on view model property.
    propVM.isArray = isArrayProperty;
    propVM.addedDisplayValues = addedDisplayValues;
    propVM.addedInternalValues = addedInternalValues;

    propVM.removedDisplayValues = removedDisplayValues;
    propVM.removedInternalValues = removedInternalValues;

    propVM.commonDisplayValues = commonDisplayValues;
    propVM.commonInternalValues = commonInternalValues;
}

/**
  * @param {response} dataForChangeSummaryTable - Required to render change summary table like vmo, columns
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {Object} subPanelContext - subPanelContext.
  * @param {Object} rootObject - state to update root object name .
  * @return {TreeLoadResult} A new TreeLoadResult object containing result/status information.
  */
export let processGetChangeSummaryDataResponse = function( dataForChangeSummaryTable, treeLoadInput, dataProvider, subPanelContext, rootObject, ecnObjectStr, isMergeCandidate ) {
    //If TopNode than response should also have column information. So update the column information on data provider.
    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    if( isTopNode ) {
        exports.initColumnsForChangeSummaryTable( dataForChangeSummaryTable.currentColumnConfig, dataProvider, subPanelContext );

        //Set default column configuration on data provider which can be used in reset action
        dataProvider.defaultColumnConfig = dataForChangeSummaryTable.defaultColumnConfig;
        if( isMergeCandidate ) {
            isMergeCandidate.dbValue = false;
        }
    }

    // total number of rows
    let tableRows = null;
    if ( dataProvider.name === 'mergeUsageChangesDataProvider' ) {
        var dataObjects = dataForChangeSummaryTable.dataObjects;
        var searchResults = [];
        if( dataObjects !== undefined ) {
            dataObjects.forEach( function( dataObject ) {
                //Create a view model object
                if( dataObject ) {
                    if ( dataObject.objectProperties ) {
                        dataObject.objectProperties.forEach( function( prop ) {
                            const propInternalName = prop.propInternalName;
                            const columnConfig = dataProvider.defaultColumnConfig.find( x => x.columnInternalName === propInternalName );
                            if ( columnConfig ) {
                                prop.propDisplayName = columnConfig.columndisplayName;
                            }
                        } );
                    }
                    if ( dataObject.siblingDataObjects.length > 0 ) {
                        dataObject.siblingDataObjects.forEach( function( siblingObject ) {
                            if ( siblingObject.objectProperties ) {
                                siblingObject.objectProperties.forEach( function( prop ) {
                                    const propInternalName = prop.propInternalName;
                                    const columnConfig = dataProvider.defaultColumnConfig.find( x => x.columnInternalName === propInternalName );
                                    if ( columnConfig ) {
                                        prop.propDisplayName = columnConfig.columndisplayName;
                                    }
                                } );
                            }
                        } );
                    }
                    createViewModelObjectFromSOADataObject( dataObject, searchResults );
                }
            } );
            tableRows = searchResults;
        }
    } else{
        tableRows = dataForChangeSummaryTable.searchResults;
    }

    //Change Summary table Support pagination only at first level. So determine whether all of data is loaded aat first level or not.
    var endReached = false;
    var totalFound = dataForChangeSummaryTable.totalFound;
    var totalLoaded = dataForChangeSummaryTable.endIndex;
    if( totalLoaded >= totalFound ) {
        endReached = true;
    }

    // Set current end inxed on data provider so subsequent call to get next page of data can retrun data from this index.
    if( isTopNode && dataProvider.name !== 'mergeUsageChangesDataProvider' ) {
        dataProvider.startIndexForNextPage = totalLoaded;
    }

    //Get first column name and set it on row.
    var firstColumnName = dataProvider.columnConfig.columns[ 0 ].name;

    var children = [];
    treeLoadInput.compareCriteria = new Object();
    appCtxSvc.registerCtx( 'prevSelectedObjectType', [] );
    if ( tableRows ) {
        for ( var index = 0; index < tableRows.length; index++ ) {
            let tableRow = null;
            //for usage bom merge use cases, we want to show only the 'part usage revision' on which merge conflict is there, and it's parent node in change summary table.
            //so, below if block is checking that.
            if ( dataProvider.name === 'mergeUsageChangesDataProvider' ) {
                if ( isTopNode ) {
                    let rootUID = appCtxSvc.ctx.state.params.uid;
                    if ( tableRows[index].primaryObjectUid === rootUID ) {
                        tableRow = createTreeNode( tableRows[index], index, treeLoadInput, firstColumnName );
                        let newRootObjName = _.clone( rootObject );
                        newRootObjName.displayName = tableRow.props.ELEMENT.uiValue;
                        rootObject.update( newRootObjName );
                        children.push( tableRow );
                    }
                } else {
                    if ( dataProvider.name === 'mergeUsageChangesDataProvider' ) {
                        let srcUsageRevID = appCtxSvc.ctx.state.params.srcPartUsgRevUID;
                        let targetUsageRevID = appCtxSvc.ctx.state.params.targetPartUsgRevUID;
                        let targetObjPsOccUid = targetUsageRevID && cdm.getObject( targetUsageRevID )?.props.fnd0PsOcc?.dbValues[0];
                        let targetUsageRevUid = targetUsageRevID && cdm.getObject( targetUsageRevID )?.props.parent_bvr?.dbValues[0];

                        var srcObjPsOccUid = srcUsageRevID && cdm.getObject( srcUsageRevID )?.props?.fnd0PsOcc?.dbValues[0];
                        var supportingPrimaryVmoUID = tableRows[index].supportingPrimaryVMO?.uid;
                        var supportingSecondaryVmoUID = tableRows[index].supportingSecondaryVMO?.uid;

                        if ( supportingPrimaryVmoUID && ( supportingPrimaryVmoUID === targetUsageRevID || supportingPrimaryVmoUID === srcUsageRevID
                            || supportingPrimaryVmoUID === srcObjPsOccUid || supportingPrimaryVmoUID === targetObjPsOccUid
                            || supportingPrimaryVmoUID === targetUsageRevUid
                            || isSibling( children, tableRows[index].uid ) )
                            || supportingSecondaryVmoUID && supportingSecondaryVmoUID === targetUsageRevID ) {
                            let isUnique = isUniqueUID( children, tableRows[index].uid );
                            tableRow = createTreeNode( tableRows[index], index, treeLoadInput, firstColumnName );
                            //Check for duplicate object and update the Uid to be used in splm table.
                            if( !isUnique ) {
                                var originalUid = { dbValues: [ tableRow.uid ] };
                                tableRow.props.originalUid = originalUid;
                                tableRow.uid += Math.random();
                                tableRow.cm1IsProxyObj = true;
                            }
                            children.push( tableRow );
                        } else if ( tableRows[index].props.action.dbValue[0] === 'Remove' &&
                            ( tableRows[index].solItemRevuid === targetUsageRevID ||
                                tableRows[index].solItemRevuid === srcUsageRevID ) ) {
                            tableRow = createTreeNode( tableRows[index], index, treeLoadInput, firstColumnName );
                            children.push( tableRow );
                        }
                    }
                }
            } else {
                tableRow = createTreeNode( tableRows[index], index, treeLoadInput, firstColumnName );

                //set incompleteTail on last vmo in this for loop. If not all of solutions are loaded than set incompleteTail to true so subsequent call will get next page of data.
                if ( index === tableRows.length - 1 && !endReached && isTopNode ) {
                    tableRow.incompleteTail = true;
                }
                //Check for duplicate object and update the Uid to be used in splm table.
                let isUnique = isUniqueUID( children, tableRows[index].uid );
                if( !isUnique ) {
                    var originalUid = { dbValues: [ tableRow.uid ] };
                    tableRow.props.originalUid = originalUid;
                    tableRow.uid += Math.random();
                    tableRow.cm1IsProxyObj = true;
                }
                //Add childrent
                children.push( tableRow );
                //Check if merge required is present for showing the warning indicator in merge status header.
                if( isMergeCandidate && !isMergeCandidate.dbValue && tableRow.props?.mergeStatus?.displayValues?.length > 0 ) {
                    for( let idx = 0; idx < tableRow.props.mergeStatus.displayValues.length; idx++ ) {
                        if( !isMergeCandidate.dbValue && tableRow.props.mergeStatus.displayValues[idx] === 'Required' ) {
                            isMergeCandidate.dbValue = true;
                        }
                    }
                }
            }
        }
    }

    // If loading change summary for first time create a ViewModelTreeNode for ECN and set that as root node for Tree
    var newTopNode = undefined;
    var tempCursorObject = {
        startReached: true,
        endReached: endReached
    };
    var rootPathNodes = [];
    if( isTopNode ) {
        let ecnUID = null;
        let ecn = null;
        if ( dataProvider.name === 'mergeUsageChangesDataProvider' ) {
            if( subPanelContext.ecn !== undefined ) {
                ecnUID = subPanelContext.ecn;
                ecn = cdm.getObject( ecnUID );
            }
        } else {
            ecn =  appCtxSvc.ctx.selected;
        }
        if ( ecn ) {
            if( !_.isEmpty( ecn.props.object_string?.dbValues[0] ) && ecnObjectStr ) {
                let newEcnObjectStrObj = ecnObjectStr;
                newEcnObjectStrObj.displayName = ecn.props.object_string.dbValues[0];
                ecnObjectStr.update && ecnObjectStr.update( newEcnObjectStrObj );
            }
            var parentVMO = awTableTreeSvc.createViewModelTreeNode( ecn.uid, ecn.type,
                ecn.modelType.displayName, -1, 0, null );

            if ( treeLoadInput.parentNode.uid !== ecn.uid ) {
                newTopNode = parentVMO;
                newTopNode.cursorObject = tempCursorObject;
            }
            rootPathNodes.push( parentVMO );
        }
    }

    //Next page of data is retrive via variable incompleteTail on a node. So setting end and start as true.
    var endReachedVar = true;
    var startReachedVar = true;

    //Generate Tree Load Result
    var treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, true, startReachedVar,
        endReachedVar, newTopNode );
    treeLoadResult.rootPathNodes = rootPathNodes;

    return treeLoadResult;
};

/**
 * This function is to check vmo with uid is present in provided array of vmo
 * @param {Array} vmoArr - Array of vmo
 * @param {String} uid - UID of the VMobject
 * @return {Boolean} - Returns false if uid is present
 */
function isUniqueUID( vmoArr, uid ) {
    var vmoObjArr = vmoArr;
    for( var index = 0; index < vmoObjArr.length; index++ ) {
        if( vmoObjArr[index].uid === uid ) {
            return false;
        }
    }
    return true;
}

/**
 * This function is to check vmo with uid is a sibling by traversing through sibling objects
 * @param {Array} vmoArr - Array of vmo
 * @param {String} uid - UID of the VMobject
 * @return {Boolean} - Returns true if uid is present in siblings Array
 */
function isSibling( vmoArr, uid ) {
    var vmoObjArr = vmoArr[0] && vmoArr[0].siblingNodes ? vmoArr[0].siblingNodes : [];
    for( var index = 0; index < vmoObjArr.length; index++ ) {
        if( vmoObjArr[index].uid === uid ) {
            return true;
        }
    }
    return false;
}

/**
  * @param {ViewModelObject} vmo - ViewModelObject
  * @param {integer} index - index of object
  * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
  * @param {Integer} firstColumnName - Name of first column in Table
  * @return {TreeViewModelObject} View Model object to display in Tree.
  */
function createTreeNode( vmo, index, treeLoadInput, firstColumnName ) {
    var tableRow = vmo;

    // Get Icon URL from vmo
    var iconURL = tableRow.typeIconURL;
    if(  vmo.props.awp0ThumbnailImageTicket && vmo.props.awp0ThumbnailImageTicket.currentValues && vmo.props.awp0ThumbnailImageTicket.currentValues.length > 0 ) {
        const imageTicket =  vmo.props.awp0ThumbnailImageTicket.currentValues.length > 0 ? vmo.props.awp0ThumbnailImageTicket.currentValues[ 0 ] : vmo.props.awp0ThumbnailImageTicket.oldValues[ 0 ];
        if( imageTicket && imageTicket !== '' ) {
            iconURL =  getFileURL( imageTicket );
        }
    }

    // Index of current level. When loading change summary table for first time treeLoadInput.parentNode.levelNdx is -1. So incrementing to 1 will make first level row index as 0.
    // For sub sequent expansion it index will be one more than the parent level.
    var treeLevel = treeLoadInput.parentNode.levelNdx + 1;

    // Create ViewModelTreeNode
    var vmNode = awTableTreeSvc.createViewModelTreeNode( tableRow.uid, tableRow.type, tableRow.props[firstColumnName].currentValue, treeLevel, index,
        iconURL );

    // Add all properties from dataobject vmo to TreeNode vmo
    vmNode.props = tableRow.props;

    if ( vmo.solItemRevuid !== undefined ) {
        vmNode.solItemRev = vmo.solItemRevuid;
    }

    //Is leaf node ?
    vmNode.isLeaf = !tableRow.hasChildren;

    //Is row having background color of odd type
    vmNode.isOdd = tableRow.isOdd;

    vmNode.isAbsOccInContextParent = tableRow.isAbsOccInContextParent;

    //is Peer Row
    vmNode.isPeerRow = false; //tableRow.isPeerRow;

    vmNode.isCompareRow = tableRow.isCompareRow;

    //Support Supersedure functionality
    vmNode.bomEditUid = tableRow.bomEditUid;
    vmNode.bomEditParentBVR = tableRow.bomEditParentBVR;
    vmNode.bomEditSupersedure = tableRow.bomEditSupersedure;
    vmNode.bomEditType = tableRow.bomEditType;
    vmNode.supersedure_begin = tableRow.supersedure_begin;
    vmNode.supersedure_end = tableRow.supersedure_end;


    //Generating unique id for each row. We can't reply on uid as we can have same object multiple time in same table.
    var id = vmNode.id + treeLoadInput.parentNode.id + vmNode.props.action.currentValue + index + treeLoadInput.parentNode.levelNdx;
    vmNode.id = id;

    //setting ModelType on TreeNode.
    vmNode.modelType = tableRow.modelType;

    vmNode.supportingSecondaryObject = tableRow.supportingSecondaryVMO;

    vmNode.supportingPrimaryObject = tableRow.supportingPrimaryVMO;

    // Get the parent node name for current node
    if( treeLoadInput.parentNode && treeLoadInput.parentNode.props && treeLoadInput.parentNode.props.NAME
     && treeLoadInput.parentNode.props.NAME.currentValue ) {
        vmNode.parentNodeName = treeLoadInput.parentNode.props.NAME.currentValue;
        //We want to populate vmNode.parentNodeUid only for usage bom, hence, adding below check
        if ( vmNode.modelType.typeHierarchyArray.indexOf( 'Part Revision' ) > -1 ) {
            vmNode.parentNodeUid = treeLoadInput.parentNode.uid;
        }
    }

    // Check if supportingPrimaryObject is present and is of type AbsOccurrence then we need to show
    // in context icon for properties that are modified
    if( vmNode.supportingPrimaryObject && isOfType( vmNode.supportingPrimaryObject, 'AbsOccurrence' )  && vmNode.parentNodeName ) {
        var parentNodeName = vmNode.parentNodeName;
        localeSvc.getLocalizedText( 'ChangeMessages', 'overridesForContext' ).then( function( result ) {
            var overridesLabel = result.replace( '{0}', parentNodeName );
            vmNode.overrideContext = overridesLabel;

            // Check if props is present on node then we need to override the commonDisplayValues
            // and commonInternalValues as these properties are being used to show the tooltip and
            // in case of in-context change for action column we need to show this as tooltip.
            if(  vmNode.props && vmNode.props.action ) {
                vmNode.props.action.commonDisplayValues = [ overridesLabel ];
                vmNode.props.action.commonInternalValues =  [ overridesLabel ];
            }
        } );
    }

    //Set First column name
    vmNode.firstColumnName = firstColumnName;
    vmNode.compareCandidates = [];

    //Set First column name
    if( vmNode.isCompareRow || vmo.props.action.dbValues[0] === 'Modify' ) {
        vmNode.primaryObjectUid = tableRow.primaryObjectUid;
        vmNode.secondaryObjectUid = tableRow.secondaryObjectUid;
        if ( vmo.props.action.dbValues[0] === 'Modify' ) {
            vmNode.compareCandidates.push( tableRow.secondaryObjectUid );
            vmNode.compareCandidates.push( tableRow.primaryObjectUid );
        }
    }

    //compareCandidates for each sibling Node
    if ( treeLoadInput.compareCriteria[vmNode.uid] !== undefined ) {
        vmNode.compareCandidates = treeLoadInput.compareCriteria[vmNode.uid];
    }
    if ( tableRow.siblingDataObjects.length > 0 ) {
        reOrderCompareReplaceNodes( vmNode, tableRow, treeLoadInput );
    }

    //process sibling data object
    vmNode.siblingNodes = [];
    for( var sb = 0; sb < tableRow.siblingDataObjects.length; sb++ ) {
        var siblingNode = createTreeNode( tableRow.siblingDataObjects[ sb ], sb, treeLoadInput, firstColumnName );
        vmNode.siblingNodes.push( siblingNode );
        treeLoadInput.compareCriteria[siblingNode.uid] = vmNode.compareCandidates;
        treeLoadInput.compareCriteria[siblingNode.uid].primaryAction = 'Replace';
    }

    return vmNode;
}

/**
  * sibling node uid array is ordered based on Removed Nodes are added first in array
  * and Added Nodes are added next for Replace Action
  * @param {*} vmNode  - Replace Action Node
  * @param {*} tableRow
  * @param {*} treeLoadInput
  *
  */
function reOrderCompareReplaceNodes( vmNode, tableRow, treeLoadInput ) {
    tableRow.siblingDataObjects.map( function( sibNode ) {
        if ( sibNode.primaryObjectUid !== undefined && sibNode.primaryObjectUid === 'AAAAAAAAAAAAAA' ) {
            return vmNode.compareCandidates.push( sibNode.uid );
        }
    } );
    vmNode.compareCandidates.push( vmNode.uid );

    tableRow.siblingDataObjects.map( function( sibNode ) {
        if ( sibNode.secondaryObjectUid !== undefined && sibNode.secondaryObjectUid === 'AAAAAAAAAAAAAA' ) {
            return vmNode.compareCandidates.push( sibNode.uid );
        }
    } );
}

/**
  * Initialize columns for Change Summary Table.
  * Actual columns will be retrive when first time "getChangeSummaryData" SOA call is made to retrive data for the table.
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let loadInitialColumns = function( dataProvider ) {
    var awColumnInfos = [];
    // Create an empty columns
    var columnInfo = {
        name: '...',
        displayName: '...',
        typeName: ''
    };

    var awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
    awColumnInfos.push( awColumnInfo );

    // Set columnConfig to Data Provider.
    dataProvider.columnConfig = {
        columns: awColumnInfos
    };
};

/**
  * Generate in-context icon if property value is modified in context
  * @param { Object } vmo - ViewModelObject for which in context is being rendered
  * @param { Object } cellContent - The container DOM Element inside which in context will be rendered
  * @param { Object } imgTitle - Image title to be set on image
  */
var _generateOverrideContextIcon = function( vmo, cellContent, imgTitle ) {
    let imagePath = getBaseUrlPath() + '/image/indicatorOverridden16.svg';
    var celRequiredImg = document.createElement( 'img' );
    celRequiredImg.className = 'aw-visual-indicator';
    celRequiredImg.title = imgTitle;
    celRequiredImg.src = imagePath;
    celRequiredImg.alt = vmo.modelType && vmo.modelType.displayName ? vmo.modelType.displayName : '';
    if( celRequiredImg ) {
        var requiredImageDiv = htmlUtil.createElement( 'div', tableSvc.CLASS_GRID_CELL_IMAGE );
        requiredImageDiv.appendChild( celRequiredImg );
        cellContent.appendChild( requiredImageDiv );
    }
};

/**
  * Generate in-context icon if property value is modified in context
  * @param { Object } vmo - ViewModelObject for which in context is being rendered
  * @param { Object } column - Column for renderer need to be used
  * @param { Object } tableElem - The container DOM Element inside which in context will be rendered
  *
  */
var _populateOverrideContextIcon = function( vmo, column, cellContent ) {
    // Check if VMO object is not null and isAbsOccInContextParent present for this VMO this means
    // some property for it's children node has been overridden in context and we need to show in context icon
    // only for action column.
    if( vmo && column && vmo.isAbsOccInContextParent && column.name === 'action' ) {
        _generateOverrideContextIcon( vmo, cellContent, '' );
    } else if( vmo && column && vmo.overrideContext ) {
        // Check if VMO object is not null and overrideContext present for this VMO this means
        // some property for this node has been overridden in context and we need to show in context icon.
        var uiValue = vmo.props[ column.name ].uiValue;
        var oldValue = vmo.props[ column.name ].oldValue;
        // Check if column name is action or old value and previous value is not matched then we need to render
        // in-context icon
        if( column.name === 'action' ||  oldValue && uiValue !== oldValue  ) {
            _generateOverrideContextIcon( vmo, cellContent, vmo.overrideContext );
        }
    }
};

/**
  * Adds the extended tooltip to PL Table cell
  */
var _addExtendedTooltip = function( cellContent, column, vmo, tableElem, cellTextEl ) {
    var uiValue = vmo?.props?.[ column.name ]?.uiValue;
    var oldValue = vmo?.props?.[ column.name ]?.oldValue;
    if( column.isCompareColumn === true || uiValue === '' && oldValue === undefined ) {
        return cellContent;
    }

    var tooltipDetails = {
        vmo: vmo ? vmo : {},
        prop: vmo?.props?.[ column.field ]
    };

    const subPanelContext = { tooltipDetails };
    let extendedTooltipElement = includeComponent( 'Cm1ChangeSummaryExtendedTooltip', subPanelContext );
    let renderedElement = document.createElement( 'div' );

    let appendExtendedTooltipElement = function( cellContent ) {
        if( column.name === 'action' && cellContent.childNodes.length && renderedElement.lastChild ) {
            renderedElement.lastChild.appendChild( cellContent.childNodes[ 0 ] );
        } else{
            //fix for LCS-825931:f/w made some changes in plainTextCellRenderer() in awSPLMTableCellRendererFactory.js which
            //adds <li class="aw-jswidgets-arrayValueCellListItem aw-splm-tableCellText" title="B">.
            //due to this DOM got changed and in case of red lining in change summary, we were not seeing correct value. so now,
            //we are appending cellContent.childNodes[1] when cellContent.childNodes.length === 2, because cellContent.childNodes[0]
            //contains <li class="aw-jswidgets-arrayValueCellListItem aw-splm-tableCellText" title="B"> which we do not want.
            if ( renderedElement.lastChild ) {
                if( column.isTreeNavigation ) {
                    renderedElement.lastChild.appendChild( cellTextEl );
                } else if ( cellContent.childNodes.length === 1 ) {
                    renderedElement.lastChild.appendChild( cellContent.childNodes[0] );
                } else if ( cellContent.childNodes.length === 2 ) {
                    renderedElement.lastChild.appendChild( cellContent.childNodes[1] );
                }
            }
        }
    };

    let appendExtendedTooltipCallBack = function() {
        setTimeout(  function() { appendExtendedTooltipElement( cellContent ); }, 100 );
    };

    if( renderedElement ) {
        renderComponent( extendedTooltipElement, renderedElement, appendExtendedTooltipCallBack );
    }
    // Populate in-context icon if need to be rendered
    _populateOverrideContextIcon( vmo, column, renderedElement, tableElem );
    if( !column.isTreeNavigation ) {
        renderedElement.className = cellContent.className;
    }
    return renderedElement;
};

/**
  * Table Tree Cell Renderer for PL Table
  */
var _treeCellRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        // Check for removed value
        var isRemovedValue = false;
        if( !vmo?.props?.[vmo.firstColumnName]?.currentValue ) {
            if( vmo?.props?.[vmo.firstColumnName]?.oldValue ) {
                vmo.displayName = vmo.props[ vmo.firstColumnName ].oldValue;
                isRemovedValue = true;
            }
        }

        //check for added value
        var nameOfActionColumn = 'action';
        if( vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === 'AddedExisting' ||
            vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === 'Replace_Existing' ) {
            vmo.isAddedValue = true;
        }


        //check for added new value
        if( vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === 'Add' ||
            vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === 'Replace_New' ||
            vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === 'New' ) {
            vmo.isAddedNewValue = true;
        }


        // Check for empty action value
        if( vmo?.props?.[nameOfActionColumn]?.dbValues?.[0] === ' ' ) {
            vmo.isEmptyActionValue = true;
        }

        var cellContent = tableSvc.createElement( column, vmo, tableElem );

        // Add markup class if value is removed
        if( isRemovedValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-jswidgets-oldText' );
            }
        }

        // Add markup class if value is added
        if( vmo?.isAddedValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-change-addedEntry' );
            }
        }

        // Add markup class if value is Added New
        if( vmo?.isAddedNewValue === true ) {
            var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( cellText ) {
                cellText.classList.add( 'aw-change-addedEntry' );
            }
        }

        // Add row and cell coloring if is odd
        if( vmo?.isOdd ) {
            cellContent.classList.add( 'aw-change-changeSummaryTableOddCell' );
            rowElem.classList.add( 'aw-change-changeSummaryTableOddRow' );
        }

        //Start Supersedure group Element Column
        if( vmo?.supersedure_begin && !isPreviousRowBottomBorder ) {
            rowElem.classList.add( 'aw-change-changeSummaryTableTopBorder' );
            isSupersedure = true;
        }

        //Start Supersedure group Element Column
        if( vmo?.supersedure_end ) {
            rowElem.classList.add( 'aw-change-changeSummaryTableBottomBorder' );
            isPreviousRowBottomBorder = true;
        } else if ( vmo?.siblingNodes?.length === 0 ) {
            isPreviousRowBottomBorder = false;
        }

        if( isSupersedure && vmo?.props?.action?.commonInternalValues?.[0] !== 'Replace' &&
            vmo?.props?.action?.commonInternalValues?.[0] !== 'Replace_New' ) {
            isPreviousRowBottomBorder = false;
            isSupersedure = false;
        }

        // Extracting cellText and cellTextContainer elements to add extended tooltip. 
        // If we use whole cellContent in extended tooltip - open cmd tooltip is creating issue.
        // So limiting the extended tooltip within the cellText component.
        var cellTextEl = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
        var cellTextContainer = cellContent.getElementsByClassName( 'aw-jswidgets-tableNonEditContainer' )[ 0 ];

        //  aw-layout-flexRowContainer
        let tooltipEl = _addExtendedTooltip( cellContent, column, vmo, tableElem, cellTextEl );

        cellTextContainer?.replaceChild( tooltipEl, cellTextContainer.lastChild );
        return cellContent;
    },
    condition: function( column, vmo, tableElem, rowElem ) {
        return column.isTreeNavigation === true;
    }
};

/**
  * Table Cell Renderer for PL Table
  */
var _cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            // Add row and cell coloring if is odd
            if( vmo?.isOdd )  {
                cellContent.classList.add( 'aw-change-changeSummaryTableOddCell' );
                rowElem.classList.add( 'aw-change-changeSummaryTableOddRow' );
            }

            //Start Supersedure group Element Cell
            if( vmo?.supersedure_begin && !isPreviousRowBottomBorder ) {
                rowElem.classList.add( 'aw-change-changeSummaryTableTopBorder' );
                isSupersedure = true;
            }

            if( vmo?.supersedure_end )  {
                rowElem.classList.add( 'aw-change-changeSummaryTableBottomBorder' );
                isPreviousRowBottomBorder = true;
            } else if ( vmo?.siblingNodes?.length === 0 ) {
                isPreviousRowBottomBorder = false;
            }

            if( isSupersedure && vmo?.props?.action?.commonInternalValues?.[0] !== 'Replace' && vmo?.props?.action?.commonInternalValues?.[0] !== 'Replace_New' ) {
                isPreviousRowBottomBorder = false;
                isSupersedure = false;
            }

            // Remove row and cell coloring if is action value is empty
            if( vmo?.isEmptyActionValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.remove( 'aw-jswidgets-change' );
                }
            }

            // Add red text class if change cell
            if( vmo?.props?.[ column.name ]?.isChangeCell === true ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-removedEntry' );
                }
            }

            // Add markup class if value is added
            if( vmo?.isAddedValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-addedEntry' );
                }
            }

            // Add markup class if value is added New
            if( vmo?.isAddedNewValue ) {
                var cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-addedEntry' );
                    if( column.field === 'action' && ( vmo?.props?.action?.dbValues?.[0] === 'Add' ||
                     vmo?.props?.action?.dbValues?.[0] === 'Replace_New' ) ) {
                        cellText.innerHTML += '<span class="aw-change-changeSummaryTableDot"></span>';
                    }
                }
            }
            // Add compare button if is compare
            if( column.isCompareColumn && vmo?.isCompareRow ) {
                let compareIconElement = includeComponent( 'Cm1ChangeSummaryCompareIcon', {} );
                let renderedElement = document.createElement( 'div' );

                let appendCompareIconElement = function( cellContent ) {
                    if ( renderedElement ) {
                        localeSvc.getLocalizedText( 'ChangeMessages', 'compareTitle' ).then( function( result ) {
                            renderedElement.title = result;
                        } );
                        renderedElement.onclick = function( event ) {
                            event.preventDefault();
                            event.stopPropagation();
                            var primaryObjectUid = vmo?.primaryObjectUid;
                            var secondaryObjectUid = vmo?.secondaryObjectUid;
                            if( primaryObjectUid !== '' && secondaryObjectUid !== '' ) {
                                var targetObject = cdm.getObject( primaryObjectUid );
                                var sourceObject = cdm.getObject( secondaryObjectUid );

                                var mSelected = [];
                                mSelected.push( sourceObject );
                                mSelected.push( targetObject );

                                appCtxSvc.updatePartialCtx( 'mselected', mSelected );
                                compareSvc.launchContentCompare();
                            }
                        };

                        var iconWrapper = document.createElement( 'div' );
                        iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header';
                        iconWrapper.appendChild( renderedElement );
                        cellContent.appendChild( iconWrapper );
                    }
                };

                let appendCompareIconElementCallBack = function() {
                    setTimeout( function() { appendCompareIconElement( cellContent ); }, 100 );
                };
                if( renderedElement ) {
                    renderComponent( compareIconElement, renderedElement, appendCompareIconElementCallBack );
                }
            }

            const nameOfActionColumn = 'action';
            const dbValue = vmo?.props?.[ nameOfActionColumn ]?.dbValues?.[0];
            if( column.name === nameOfActionColumn && ( dbValue === 'Modify' || dbValue === 'PropertyChange' ) ) {
                const cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText ) {
                    cellText.classList.add( 'aw-change-addedEntry' );
                }
            }

            //Get the required indicator if the column is merge
            if( column.name === 'mergeStatus' && vmo?.props?.mergeStatus?.dbValues ) {
                appCtxSvc.registerCtx( 'isMergeCommandVisible', true );
                var iconWrapper = document.createElement( 'div' );
                if( vmo?.props?.mergeStatus?.dbValues?.length === 1 ) {
                    iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header aw-commands-mergeStatusSingleForChangeSummary';
                } else {
                    iconWrapper.className = 'aw-commands-mergeStatusMultipleValuesForChangeSummary';
                }
                for( let index = 0; index < vmo?.props?.mergeStatus?.dbValues?.length; index++ ) {
                    //Get merge status value and source a5ssembly
                    var mergeStatusValue = vmo?.props?.mergeStatus?.displayValues?.[index];
                    var mergeStatusSourceAssembly = vmo?.props?.mergeStatus?.dbValues?.[index];
                    //Get icon element for mergeStatus
                    setIconElementForMergeStatus( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent );
                }
            }

            return _addExtendedTooltip( cellContent, column, vmo, tableElem );
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return true;
        }
    };
};

/**
  * Build column information for change summary table based on response from SOA getChangeSummaryData
  *
  * @param {ChangeSummaryTableColumnConfig} columnConfig - Column config returned by SOA
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let initColumnsForChangeSummaryTable = function( columnConfig, dataProvider, subPanelContext = null ) {
    // Build AW Columns
    var awColumnInfos = [];
    for( var index = 0; index < columnConfig.length; index++ ) {
        var firstColumn = false;
        var enableColumnMenu = true;

        // For first column we do not show column menu as freeze option is not valid for first column and that's the only menu item we have.
        let renderer = _cellRenderer();
        if( index === 0 ) {
            firstColumn = true;
            enableColumnMenu = false;
            renderer = _treeCellRenderer;
        }

        var columnInfo = {
            name: columnConfig[ index ].columnInternalName,
            propertyName: columnConfig[ index ].columnInternalName,
            displayName: columnConfig[ index ].columndisplayName,
            typeName: columnConfig[ index ].sourceTypeName,
            pixelWidth: columnConfig[ index ].pixelWidth,
            hiddenFlag: columnConfig[ index ].hiddenFlag,
            isCompareColumn: columnConfig[ index ].isCompareColumn,
            enablePinning: false,
            firstColumn: firstColumn,
            enableColumnMenu: enableColumnMenu,
            cellRenderers: [ renderer ]
        };
        var awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        if ( dataProvider.name === 'mergeUsageChangesDataProvider' && subPanelContext !== null ) {
            subPanelContext.columns.forEach( function( col ) {
                if ( col === awColumnInfo.propertyName ) {
                    awColumnInfos.push( awColumnInfo );
                }
            } );
        } else {
            awColumnInfos.push( awColumnInfo );
        }
    }

    // Set columnConfig to Data Provider.
    dataProvider.columnConfig = {
        columns: awColumnInfos
    };
};

/**
  * Handle Update of table data
  *
  *
  * @param {UwDataProvider} summaryTableDataProvider - The data provider for Change Summary Table.
  * @param {eventData } eventData - Event data when object is updated.
  *
  */
export let handleModelObjectUpdated = function( summaryTableDataProvider, eventData ) {
    if( summaryTableDataProvider && eventData ) {
        var viewModelCollection = summaryTableDataProvider.viewModelCollection;
        eventData.updatedObjects.forEach( function( modelObject ) {
            if( modelObject.uid ) {
                var allViewModelObjectsForTable = findAllViewModelObjects( viewModelCollection, modelObject.uid );
                if( allViewModelObjectsForTable.length > 0 ) {
                    allViewModelObjectsForTable.forEach( function( vmoFromTable ) {
                        summaryTableDataProvider.cols.forEach( function( column ) {
                            var columnName = column.name;
                            if( vmoFromTable.props[ columnName ] !== undefined && modelObject.props[ columnName ] !== undefined ) {
                                if( modelObject.props[ columnName ].uiValues !== undefined ) {
                                    if( vmoFromTable.props[ columnName ].currentValue !== '' ) {
                                        vmoFromTable.props[ columnName ].currentValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                        vmoFromTable.props[ columnName ].uiValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                    } else {
                                        vmoFromTable.props[ columnName ].oldValue = modelObject.props[ columnName ].uiValues[ 0 ];
                                    }
                                }
                            }
                        } );
                    } );
                }
            }
        } );
    }
};

/**
  * Returns viewModel objects from dataProvider ViewModelCollection
  *
  * @param {viewModelCollection} viewModelCollection - viewModelcollection of DataProvider.
  * @param {String} idToFind - The ID (or UID) of the ViewModelObject to find.
  * @return {Array} matchedObjects - ViewModelObjects matched for Uid

  */
function findAllViewModelObjects( viewModelCollection, idToFind ) {
    var matchedObjects = [];
    if( viewModelCollection.loadedVMObjects ) {
        for( var ndx = 0; ndx < viewModelCollection.loadedVMObjects.length; ndx++ ) {
            var vmo = viewModelCollection.loadedVMObjects[ ndx ];

            if( vmo.uid && vmo.uid === idToFind ) {
                matchedObjects.push( vmo );
                continue;
            }

            if( vmo.id && vmo.id === idToFind ) {
                matchedObjects.push( vmo );
            }
        }
    }
    return matchedObjects;
}

/**
  * Saved Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {UwDataProvider} newColumns - Modified column information.
  *
  * @return {SearchResult} Search Result - In case of Change Summary Table this will be empty.
  */
export let saveColumnConfig = function( dataProvider, newColumns ) {
    var updatedColumnNames = [];
    var updatedColumnWidth = [];
    newColumns.forEach( function( newColumn ) {
        var isPropHidden = newColumn.hiddenFlag;
        var propName = newColumn.propertyName;
        if( isPropHidden ) {
            updatedColumnNames.push( propName + ',' + 'hidden' );
        } else {
            updatedColumnNames.push( propName + ',' + 'visible' );
        }

        if( newColumn.pixelWidth ) {
            updatedColumnWidth.push( newColumn.pixelWidth.toString() );
        }
    } );

    var prefNamesToUpdate = [ 'ChangeSummaryColumnsShownPref', 'ChangeSummaryColumnsShownWidthPref' ];
    var prefValuesToUpdate = [ updatedColumnNames, updatedColumnWidth ];

    preferenceService.setStringValues( prefNamesToUpdate, prefValuesToUpdate );

    return {
        search: ''
    };
};

/**
  * Reset Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let resetColumnConfig = function( dataProvider ) {
    //Set default columns for Change Summary Table
    exports.initColumnsForChangeSummaryTable( dataProvider.defaultColumnConfig, dataProvider );

    //Set User's preference with default values.
    var updatedColumnNames = [];
    dataProvider.defaultColumnConfig.forEach( function( column ) {
        var propName = column.columnInternalName;
        updatedColumnNames.push( propName + ',' + 'visible' );
    } );

    preferenceService.setStringValue( 'ChangeSummaryColumnsShownPref', updatedColumnNames );
    var columnConfigurations = [ {
        columnConfigurations: [ {
            columns: dataProvider.columnConfig.columns
        } ]
    } ];

    return {
        columnConfigurations: columnConfigurations
    };
};

export let handleSelectionInChangeSummaryTable = function( selectedObjectFromChangeSummary ) {
    var propToLoad = [ 'object_string' ];
    var allObjectUid = [];

    var selectedObjects = getModelObjectsFromUID( selectedObjectFromChangeSummary );
    for( var i = 0; i < selectedObjects.length; i++ ) {
        allObjectUid.push( selectedObjects[ i ].uid );
    }
    var deferred = AwPromiseService.instance.defer();
    dmSvc.getProperties( allObjectUid, propToLoad ).then(
        function() {
            selectedObjects.forEach( function( vmoFromTable ) {
                var vmo = cdm.getObject( vmoFromTable.uid );
                if( vmo !== undefined && vmo.props.hasOwnProperty( 'object_string' ) ) {
                    vmoFromTable.props.object_string = vmo.props.object_string;
                }
            } );
            deferred.resolve( selectedObjects );
            return deferred.promise;
        } );
};

export let setViewerContext = function() {
    var ctx = {
        //vmo: $scope.contextObject,
        commands: {
            fullViewMode: {
                visible: true
            }
        }
    };

    if( appCtxSvc.getCtx( 'fullscreen' ) === true ) {
        ctx.commands.fullViewMode.visible = false;
    }
    appCtxSvc.registerCtx( 'viewerContext', ctx );
};

export let setChangeSummaryTableToolTipWidth = function() {
    //setting width of balloon pop up

    var tooltipElement = $( 'body' ).find( 'aw-include[name=Cm1ChangeSummaryTooltip]' );
    if( tooltipElement && tooltipElement[0] ) {
        var popUpElement = tooltipElement[0].getElementsByClassName( 'aw-layout-include aw-layout-flexbox ng-scope' );

        if( popUpElement && popUpElement.length > 0 ) {
            popUpElement[popUpElement.length - 1].style.maxWidth = '110px';
            popUpElement[popUpElement.length - 1].style.maxHeight = '45px';
            popUpElement[popUpElement.length - 1].style.overflow = 'auto';
        }
    }
};
/**
  * get Model Objects for 'compareCandidates' UID array
  * of selected object in Change Summary.
  * Compare Candidate Objects are list of objects to be compared
  * in Property Compare table
  * @param {*} objects
  */
export let getModelObjectsFromUID = function( objects ) {
    let modelObjects = [];
    if ( objects.length === 1 && objects[0].compareCandidates !== undefined ) {
        objects[0].compareCandidates.map( function( compareNodeUID ) {
            modelObjects.push( cdm.getObject( compareNodeUID ) );
        } );

        return modelObjects;
    }
    return modelObjects;
};
/**
  * Validates if Property Compare table is loading based on
  * exist-when clause in View file (i.e. when table did not existed before)
  * or the table will reload (reload is valid only when table is already existing
  * and view model objects gets updated)
  *
  * This method takes care of reloading column configuration also if object type
  * of selection in Change Summary changes and it is a reload case for table reload.
  *
  * @param {*} data
  * @param {*} selectedObj
  */
export let validatePropertyCompareTableReload = function( data, selectedObj ) {
    //Registering here nextCompareTableCanReload from losing value while generating tree nodes (Tree command).
    //Previously present in processGetChangeSummaryDataResponse due to which nextCompareTableCanReload value reset after tree command in change summary table.
    //refer LCS-719313.
    if( !appCtxSvc.ctx.nextCompareTableCanReload ) {
        appCtxSvc.registerCtx( 'nextCompareTableCanReload', false ); // setting nextCompareTableCanReload to false for first time Compare table load.
    }
    data.isReloadValid.dbValue = appCtxSvc.ctx.nextCompareTableCanReload;

    if ( data.isReloadValid.dbValue === true && selectedObj.length === 1 && ( selectedObj[0].props.action.dbValues[0] === 'Modify' || selectedObj[0].props.action.dbValues[0] === 'Replace_New'
         || selectedObj[0].props.action.dbValues[0] === 'Replace_Existing' || selectedObj[0].compareCandidates !== undefined && selectedObj[0].compareCandidates.primaryAction === 'Replace' ) ) {
        if ( isObjectTypeDifferentForCompare( selectedObj ) ) {
            data.isObjTypeDifferent.dbValue = true;
            eventBus.publish( 'propertyCompareGrid.columnConfiguration.reload' );
        } else {
            data.isObjTypeDifferent.dbValue = false;
            eventBus.publish( 'propertyCompareGrid.plTable.reload' );
        }
    }
    // if invalid condition for Compare, table will not exist and hence else block reload validation is false,
    // for table load to get in only exist-when case
    else {
        appCtxSvc.updatePartialCtx( 'nextCompareTableCanReload', false );
    }
};
/**
  * This method checks the object type of all the comparing
  * modelObjects , to reload Column configuration if object types
  * of objects being compared are different
  * @param {*} currentObject
  */
function isObjectTypeDifferentForCompare( currentObject ) {
    let modelObjects = getModelObjectsFromUID( currentObject );

    let objTypes = [];
    modelObjects.forEach( function( modelObj ) {
        if ( modelObj !== null && ( objTypes.length === 0 || objTypes.indexOf( modelObj.type ) === -1 ) ) {
            objTypes.push( modelObj.type );
        }
    } );

    let prevObjTypes = appCtxSvc.ctx.prevSelectedObjectType;
    if ( prevObjTypes !== undefined && prevObjTypes !== null && objTypes.length !== prevObjTypes.length ) {
        return true;
    }
    for ( var idx in objTypes ) {
        if ( prevObjTypes !== undefined && prevObjTypes !== null && prevObjTypes.indexOf( objTypes[idx] ) === -1 ) {
            return true;
        }
    }
    return false;
}

/**
  * This method makes a SOA call to get column configuration.
  * SOA input includes model objects(and its object type) to be compared ,
  * for which column configuration will be returned.
  * @param {*} serviceName
  * @param {*} operationName
  * @param {*} soaInput
  * @param {*} modelObjects
  * @param {*} columnProvider
  */
export let getPropertyCompareTableColumnConfig = function( soaInput, modelObjects, columnProvider ) {
    let types = [];
    modelObjects.map( function( modelObj ) {
        if ( modelObj !== null && ( types.length === 0 || types.indexOf( modelObj.type ) === -1 ) ) {
            types.push( modelObj.type );
        }
    } );
    columnProvider.types = types;
    var colConfigInput = soaInput.getOrResetUiConfigsIn[0];
    colConfigInput.businessObjects = modelObjects;
    colConfigInput.columnConfigQueryInfos[0].typeNames = types;
    return tcDataMgmtService.baseGetOrResetUIColumnConfigs( soaInput ).then( function( result ) {
        result.types = types;
        //for validating table reload
        appCtxSvc.updatePartialCtx( 'nextCompareTableCanReload', true );
        return result;
    } );
};
/**
  * For the ModelObjects to be compared ,this method creates viewModelObjects
  * and populates it viewModelProperties to be displayed in Property Compare Table
  * @param {*} modelObjects
  * @param {*} columns
  * @param {*} selObj
  */
export let getPropertyCompareTableVMOs = function( modelObjects, columns ) {
    if ( !columns ) {
        return new Promise( ( resolve ) => {
            resolve( {
                searchResults: [],
                totalFound: 0
            } );
        } );
    }
    // stores object type of selection, to be used if selection change object type is different
    let types = [];
    modelObjects.map( function( modelObj ) {
        if ( modelObj !== null && ( types.length === 0 || types.indexOf( modelObj.type ) === -1 ) ) {
            types.push( modelObj.type );
        }
    } );
    appCtxSvc.updatePartialCtx( 'prevSelectedObjectType', types );
    var propNames = columns.map( function( col ) {
        return col.propertyName || col.propDescriptor.propertyName;
    } );

    var viewModelObjects = modelObjects.map( function( modelObject ) {
        let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( modelObject );
        vmo.displayName = vmo.props.object_string ? vmo.props.object_string.uiValues[0] : vmo.props.object_name ? vmo.props.object_name.uiValues[0] : '';
        return vmo;
    } );

    return tcViewModelObjectService.getViewModelProperties( viewModelObjects, propNames ).then( function( result ) {
        if( result === undefined ) {
            return {
                searchResults: viewModelObjects,
                totalFound: viewModelObjects.length
            };
        }
        if( result && result.objects && result.logicalObjects ) {
            awCompare.putClsData( result.objects, result.logicalObjects );
        }
        return {
            searchResults: result.objects,
            totalFound: result.objects.length
        };
    } );
};
/**
  * arrangeColumn method is different for Change Summary table &
  * for Property Compare table with different inputs
  * Selecting here the appropriate action for arrange column ,based on eventdata
  * @param {*} eventData
  */
export let selectArrangeEventAction = function( eventData ) {
    if ( eventData !== undefined && eventData !== null && eventData.name === 'propertyCompareGrid' ) {
        eventBus.publish( 'doArrangeCompareEvent' );
    } else {
        eventBus.publish( 'doArrangeEvent' );
    }
};

/**
  * This function returns the icon element for merge status
  * @param {*} mergeStatusValue
  * @param {*} mergeStatusSourceAssembly
  * @param {*} tableElem
  */

const _renderMergeIndicator = function( mergeStatusValue, mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeIndicatorComponent ) {
    let renderedElement = document.createElement( 'div' );
    let appendIndicatorMergeElement = function() {
        if ( renderedElement ) {
            var sourceAssemblyUid;
            localeSvc.getLocalizedText( 'ChangeMessages', mergeStatusValue ).then( function( result ) {
                sourceAssemblyUid = mergeStatusSourceAssembly;
                //Source assembly might not be loaded so load it
                var objectsToLoadUid = [ sourceAssemblyUid ];
                var promiseLoadObject = dmSvc.loadObjects( objectsToLoadUid );
                promiseLoadObject.then( function() {
                    var sourceVmo = cdm.getObject( objectsToLoadUid[0] );
                    var sourceAssemblyName = '';
                    if( sourceVmo !== undefined && sourceVmo.props.hasOwnProperty( 'object_string' ) ) {
                        sourceAssemblyName = sourceVmo.props.object_string.dbValues[0];
                    }
                    renderedElement.title = result.replace( '{0}', sourceAssemblyName );
                    renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';
                } ).catch( function( error ) {
                    console.error( 'Error loading objects:', error );
                } );

                var allObjUids = vmo.supportingPrimaryObject
                    ? vmo.supportingPrimaryObject.uid
                    : vmo.supportingSecondaryObject && vmo.supportingSecondaryObject.uid;
                if ( allObjUids ) {
                    dmSvc.getProperties( [ allObjUids ], [ 'fnd0PsOcc', 'parent_bvr' ] );
                }
            } ).catch( function( error ) {
                console.error( 'Error fetching localized text:', error );
            } );
            renderedElement.onclick = function( event ) {
                event.preventDefault();
                event.stopPropagation();
                var sourceUid = sourceAssemblyUid;
                var targetUid;
                //LCS-833590 - in case of multi-level structure, if vmo is not leaf
                //vmo.supportingPrimaryObject.uid is null, hence adding below check.
                if( vmo.parentNodeUid && vmo.isLeaf ) {
                    targetUid = vmo.parentNodeUid;
                    sourceUid = vmo.parentNodeUid;
                } else {
                    targetUid = vmo.primaryObjectUid;
                }

                if( sourceUid !== '' && targetUid !== '' ) {
                    var targetObject = cdm.getObject( targetUid );
                    var sourceObject = cdm.getObject( sourceUid );

                    var sourceTargetObjects = [];
                    sourceTargetObjects.push( sourceObject );
                    sourceTargetObjects.push( targetObject );
                    if( vmo.parentNodeUid && vmo.isLeaf ) {
                        if ( vmo.supportingPrimaryObject !== null ) {
                            sourceTargetObjects.push( cdm.getObject( sourceAssemblyUid ) );
                            sourceTargetObjects.push( cdm.getObject( vmo.supportingPrimaryObject.uid ) );
                        } else{
                            sourceTargetObjects.push( cdm.getObject( sourceAssemblyUid ) );
                        }
                    }
                    appCtxSvc.updatePartialCtx( 'mselected', sourceTargetObjects );
                    var requestPrefValue = {
                        dataFilterMode: 'compare',
                        showChange:  [ 'true' ]
                    };
                    appCtxSvc.updatePartialCtx( 'requestPref', requestPrefValue );

                    //vmo.solItemRev has uid for partUsgRev which we want to show in UI for the case of remove operation in usg bom,
                    //so, only if vmo.solItemRev has uid , pass it to launchMergeSplitView otherwise don't(making use of ternary operation to do that)
                    vmo.solItemRev ? launchMergeSplitView( vmo.solItemRev ) : launchMergeSplitView();
                }
            };
            iconWrapper.appendChild( renderedElement );
            cellContent.appendChild( iconWrapper );
        }
    };

    let appendIndicatorMergeElementCallBack = function() {
        setTimeout( function() { appendIndicatorMergeElement(); }, 100 );
    };

    if( renderedElement ) {
        renderComponent( mergeIndicatorComponent, renderedElement, appendIndicatorMergeElementCallBack );
    }
};

/**
  * This function returns the icon element for merge status
  * @param {*} mergeStatusValue
  * @param {*} mergeStatusSourceAssembly
  * @param {*} tableElem
  */
export let setIconElementForMergeStatus = function( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent ) {
    if( mergeStatusValue === 'Required' ) {
        //If merge status is required, then we need to show source assembly name along with status value.
        let mergeRequiredElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeRequired', {} );
        _renderMergeIndicator( 'mergeRequired', mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeRequiredElement );
    } else if( mergeStatusValue === 'Complete' ) {
        let mergeCompleteElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeComplete', {} );
        _renderMergeIndicator( 'mergeComplete', mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeCompleteElement );
    } else if( mergeStatusValue === 'PartialMerge' ) {
        let mergePartialElement = includeComponent( 'Cm1ChangeSummaryIndicatorPartialMerge', {} );
        _renderMergeIndicator( 'mergePartial', mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergePartialElement );
    }
};

/*
 * Change summary column header renderer
 * Custom Header renderer is required because for merge status column we need to show icon instead of column name
 */
export let changeSummaryTableHeaderRender = function( containerElement, columnField, tooltip, column ) {
    var headerContent = document.createElement( 'div' );
    headerContent.className = 'sw-row';
    // Add column header label

    var labelFilter = document.createElement( 'div' );
    labelFilter.textContent = column.displayName;
    headerContent.appendChild( labelFilter );

    //Check for merge status column and include the Merge warning indicator in header.
    if( column && column.name === 'mergeStatus' ) {
        let indicatorElement = includeComponent( 'Cm1ChangeSummaryIndicatorWarning', { } );
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';

        if( renderedElement ) {
            renderComponent( indicatorElement, renderedElement );
            headerContent.appendChild( renderedElement );
        }
    }
    containerElement.appendChild( headerContent );
};

/*
 * Launch Merge Split View
 */
export let launchMergeSplitView = function( solItemRev = false ) {
    var toParams = {};
    //Store Change Notice Object so that user return back to same Change Notice Object after closing Merge.
    var mergeChangeNoticeObject = appCtxSvc.ctx.xrtSummaryContextObject.uid;
    toParams.ecn_uid = mergeChangeNoticeObject;
    toParams.uid = appCtxSvc.ctx.mselected[0].uid;
    toParams.uid2 = appCtxSvc.ctx.mselected[1].uid;
    if( appCtxSvc.ctx.mselected.length > 2 ) {
        toParams.srcPartUsgRevUID = appCtxSvc.ctx.mselected[2].uid;
        solItemRev ? toParams.targetPartUsgRevUID = solItemRev : toParams.targetPartUsgRevUID = appCtxSvc.ctx.mselected[3].uid;
    }
    toParams.pci_uid = occmgmtUtils.getProductContextForProvidedObject( appCtxSvc.ctx.mselected[ 0 ] );
    toParams.pci_uid2 = occmgmtUtils.getProductContextForProvidedObject( appCtxSvc.ctx.mselected[ 1 ] );
    var transitionTo = 'mergeChanges';
    LocationNavigationService.instance.go( transitionTo, toParams );
};

/*
 * Resetting startIndexForNextPage property
 */
export let resetDataProviderStartIndex = function( dataProvider ) {
    dataProvider.startIndexForNextPage = 0;
};

/**
   * Get the change summary soa input data.
   *
   * @param {Object} ctx App context object
   * @param {TreeLoadInput} treeLoadInput - Input parameter load Tree-Table
   * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
   * @param {Boolean} isGenealogy - Boolean value has the geneology status.
   * @param {subPanelContext} subPanelContext - The context object holds the selection related data
   * @return {Object} Input data to call SOA
   */
export let getChangeSummaryInputData = function( ctx, treeLoadInput, dataProvider, isGenealogy, subPanelContext ) {
    // getChangeSummaryData requires following input
    // 1. changeNoticeRevision - Selected ChangeNoticeRevision
    // 2. selectedRow - Selected Object from Change Summary table( In case of expanding parent )
    // 3. isOddRowSelected - Flag to indicate whether selected row is rendered as odd background color or even background color.
    //                       Based on this background color flag for child row is calculated on server.
    // 4. startIndex - StartIndex for next page. Change Summary table pagination at first level.
    // 5. pageSize - Number of objects should be returned per SOA call. Change Summary Table only support pagination at first level.
    let changeNoticeRevision = {};
    if( dataProvider.name === 'mergeUsageChangesDataProvider' ) {
        var changeRevObj = [];
        changeNoticeRevision.uid = subPanelContext.ecn;
        changeNoticeRevision.type = 'ChangeNoticeRevision';
        changeRevObj[0] = changeNoticeRevision.uid;
        dmSvc.loadObjects( changeRevObj );
    } else{
        changeNoticeRevision = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    }

    var selectedRow = {}; // Selected row in case of expanding parent
    var isOddRowSelected = false; // if we are displaying change summary table first time ( not-expanding parent, isOddRowSelected is passed as false. )
    var isAbsOccInContextParent = false;
    if ( treeLoadInput.parentNode.levelNdx > -1 ) {
        //If there are duplicate rows with same id(Abs Occ changes + normal changes), then the uid of selected Abs Occ row is not passed correctly
        //To retrieve the correct uid, we need to extract it from originalUid
        if( treeLoadInput.parentNode.props && treeLoadInput.parentNode.props.originalUid && treeLoadInput.parentNode.props.originalUid.dbValues.length > 0 ) {
            selectedRow.uid = treeLoadInput.parentNode.props.originalUid.dbValues[0];
        } else {
            selectedRow.uid = treeLoadInput.parentNode.uid;
        }
        selectedRow.type = treeLoadInput.parentNode.type;
        isOddRowSelected = treeLoadInput.parentNode.isOdd;
        isAbsOccInContextParent = treeLoadInput.parentNode.isAbsOccInContextParent;
    }

    // we can't reply on treeLoadInput.startIndexForNextPage to retrive next page of data. Change Summary table contains group of rows in case of replace.
    // So number of row displayed will be more than number of loaded solutions available in ChangeNoticeRevision.
    // And hence maintaining same variable on data provider which will provide index of net page.
    var isTopNode = treeLoadInput.parentNode.levelNdx === -1;
    var startIndexForNextPage = 0;
    if ( isTopNode && dataProvider.startIndexForNextPage ) {
        startIndexForNextPage = dataProvider.startIndexForNextPage;
    }

    var inputData = {
        changeNoticeRevision: changeNoticeRevision,
        isOddRowSelected: isOddRowSelected,
        startIndex: startIndexForNextPage,
        pageSize: treeLoadInput.pageSize
    };

    if( isGenealogy && isTopNode ) {
        inputData.inputObject = cmUtils.getBomLine( ctx.selected.uid );
    } else {
        inputData.inputObject = selectedRow;
    }

    // Check if this is true then we need to pass AbsOcc in context info to SOA so that
    // server will send info only for incontext changes
    if ( isAbsOccInContextParent ) {
        inputData.additionalData = {
            isAbsOccInContextParent: [ 'true' ]
        };
    }

    // If this is a genalogy operation
    // send need info to the server for first and child levels
    if ( isGenealogy ) {
        if( !isTopNode ) {
            inputData.additionalData = {
                retrieveGenealogy: [ 'true' ],
                retrieveGenealogyChildren: [ 'true' ],
                selectedBomLine: [ cmUtils.getBomLine( ctx.selected.uid ).uid ]
            };
        } else {
            inputData.additionalData = {
                retrieveGenealogy: [ 'true' ]
            };
        }
    }

    //Add the selection information from impacted items table to load change summary table related to the selection.
    //if selection is null, it will return all for change summary table.
    let selected = subPanelContext?.selectionData?.selected;
    let relationInfo = subPanelContext?.selectionData?.relationInfo;
    let newAdditionalData = { ...inputData.additionalData };
    newAdditionalData.impactedObjects = [];
    //validate the selection and relationInfo has same elements and of type CMHasImpactedItems
    for( let index = 0; index < selected?.length && index < relationInfo?.length; index++ ) {
        if( selected[index].uid === relationInfo[index].secondaryObject.uid && relationInfo[index].relationType === 'CMHasImpactedItem' ) {
            newAdditionalData.impactedObjects.push( selected[index].uid );
            inputData.additionalData = newAdditionalData;
        }
    }
    return inputData;
};

/**
 * This function is used to get the merge properties
 * @param {Object} selectionData : has information about the selection made on the table
 * @param {Object} mergeProperties : state to update with merge properties
 */
export let getMergeProperties = function( selectionData, mergeProperties, defaultColumnConfig ) {
    let newMergeProperties = _.clone( mergeProperties );
    if ( selectionData.selected.length > 0 && selectionData.selected[0].supportingPrimaryObject !== null
         || selectionData.selected[0].supportingSecondaryObject !== null ) {
        newMergeProperties = selectionData.selected[0];
        let vmpArray = [];
        //fix for issue #5 in LCS-840781: we will only show properties if it is present in defaultColumnConfig
        if( defaultColumnConfig.length > 0 ) {
            defaultColumnConfig.forEach( function( defColConfigProp ) {
                _.forEach( newMergeProperties.props, function( prop ) {
                    if ( prop.propertyName === defColConfigProp.columnInternalName ) {
                        if ( prop.propertyName !== 'm_mergeStatus' && prop.propertyName !== 'mergeStatus' ) {
                            prop.labelPosition = 'PROPERTY_LABEL_AT_SIDE';
                            prop.fielddata = _.clone( prop );
                            vmpArray.push( prop );
                        }
                    }
                } );
            } );
        }
        newMergeProperties.displayProps = vmpArray;
    }
    mergeProperties.update( newMergeProperties );
};

/**
  * Get the file URL
  *
  * @param {String} fileTicket - The file ticket
  * @return {String} the file URL
  */
function getFileURL( fileTicket ) {
    if( fileTicket ) {
        const FMS_DOWNLOAD = 'fms/fmsdownload/';
        let baseURL = browserUtils.getBaseURL();
        const fileName = fmsUtils.getFilenameFromTicket( fileTicket );
        const fileExtension = getFileExtension( fileName ).toLowerCase();
        if( fileExtension === 'jt' || fileExtension === 'vmb' ) {
            return FMS_DOWNLOAD + '?ticket=' + fileTicket;
        } else if( fileExtension === 'pdf' ) {
            return FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
        }
        return baseURL + FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
    }
}

/**
  * Get file name extension from file name
  *
  * @param {String} fileName file name
  * @return {String} file name extension
  */
function getFileExtension( fileName ) {
    const extIndex = fileName.lastIndexOf( '.' );
    if( extIndex > -1 ) {
        return fileName.substring( extIndex + 1 );
    }
    return null;
}
/**
 * This function will handle the parentSelectionData with change summmary table selection
 * @param {Object} localSelectionData is selected objects in change summary table
 * @param {Object} parentSelectionData is selected objects in impacted table
 * @param {Object} selectedImpactItems is to store selected objects from impacted table
 */
export let updateChangeSummarySelection = function( localSelectionData, parentSelectionData, selectedImpactItems ) {
    //Usecase: Impacted Item and any row in change summary is selected then select other row in change summary (CS) table.
    const relationInfo = parentSelectionData?.relationInfo;
    if( _.isEmpty( relationInfo ) && !_.isEmpty( selectedImpactItems ) ) {
        //if selection changed in CS table.
        if( localSelectionData?.selected?.length > 0 ) {
            parentSelectionData && parentSelectionData.update( {
                selected: localSelectionData.selected
            } );
        } else {
            //if deselection happened in CS table.
            parentSelectionData && parentSelectionData.update( { ...selectedImpactItems } );
        }
    //Usecase: When row is selected in impacted items table then trying to select row in CS table.
    } else if ( !_.isEmpty( relationInfo ) ) {
        localSelectionData.selected.length > 0 && parentSelectionData && parentSelectionData.update( {
            selected: localSelectionData.selected
        } );
        //store the selected impacted item.
        if (  relationInfo && relationInfo.length > 0 && relationInfo[0]?.relationType === 'CMHasImpactedItem' ) {
            return { selectedImpactItems: parentSelectionData };
        }
    } else {
        //Row selected in CS table.
        parentSelectionData && parentSelectionData.update( {
            selected: localSelectionData.selected
        } );
    }
};

/**
 * This function will reset the selectedImpactItem data.
 *  @returns {Object} - returns object with selectedImpactItems as null.
 */
export let resetImpactItemData = function( selectedImpactedItems ) {
    //This method will invoked when there is change in Impacted items table.
    return { selectedImpactItems: selectedImpactedItems?.length > 0 ? selectedImpactedItems : null };
};

/**
 * This function resets the parentSelectionData
 * @param {Object} parentSelectionData is the selection data from object set.
 */
export let resetSelectionData = function( parentSelectionData ) {
    if( parentSelectionData && parentSelectionData.relationInfo && parentSelectionData.relationInfo.length > 0 && parentSelectionData.relationInfo[0].relationType === 'CMHasImpactedItem' ) {
        parentSelectionData?.update( {} );
    }
};

/**
  * This is the primary service for change summary table
  *
  * @param {$q} $q - Service to use.
  * @param {appCtxService} appCtxSvc - Service to use.
  * @param {awColumnService} awColumnSvc - Service to use.
  * @param {awTableService} awTableTreeSvc - Service to use.
  * @param {soa_dataManagementService} dmSvc - Service to use.
  * @param {soa_kernel_clientDataModel} cdm - Service to use.
  * @param {propPolicySvc} propPolicySvc - Service to use.
  * @param {soa_kernel_soaService} soaSvc - Service to use.
  * @param {uwPropertyService} uwPropertyService - Service to use.
  * @param {viewModelObjectService} viewModelObjectService - Service to use.
  *
  * @returns {Cm1ChangeSummaryService} Instance of the service API object.
  */

export default exports = {
    getMergeProperties,
    processGetChangeSummaryDataResponse,
    getChangeSummaryInputData,
    getChangeSummaryData,
    loadInitialColumns,
    initColumnsForChangeSummaryTable,
    handleModelObjectUpdated,
    saveColumnConfig,
    resetColumnConfig,
    handleSelectionInChangeSummaryTable,
    setViewerContext,
    setChangeSummaryTableToolTipWidth,
    getModelObjectsFromUID,
    getPropertyCompareTableColumnConfig,
    getPropertyCompareTableVMOs,
    validatePropertyCompareTableReload,
    selectArrangeEventAction,
    setIconElementForMergeStatus,
    changeSummaryTableHeaderRender,
    launchMergeSplitView,
    resetDataProviderStartIndex,
    updateChangeSummarySelection,
    resetImpactItemData,
    resetSelectionData
};
