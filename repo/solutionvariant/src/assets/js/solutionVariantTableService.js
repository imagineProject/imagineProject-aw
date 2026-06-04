// Copyright (c) 2023 Siemens

/**
 * @module js/solutionVariantTableService
 */
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import occmgmtBackingObjProviderSvc from 'js/aceBackingObjectProviderService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';
import soaSvc from 'soa/kernel/soaService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import dataManagementSvc from 'soa/dataManagementService';

/**
  * ***********************************************************<BR>
  * Define external API<BR>
  * ***********************************************************<BR>
  */
var exports = {};

export let CreateMultilevelSolutionVariants = function( selectedObjects, rootElement, pwaSelection, runInBackground ) {
    let deferred = AwPromiseService.instance.defer();
    let UseModuleLevelConfiguration  = '0';
    if ( rootElement !== pwaSelection ) {
        UseModuleLevelConfiguration = '1';
    }
    getBOMLineUids( [ pwaSelection ] ).then( function( bomLineUid ) {
        let inputData = createMultiLevelBulkSVCreateInput( bomLineUid, selectedObjects, UseModuleLevelConfiguration, runInBackground );
        soaSvc.postUnchecked( 'StructureManagement-2023-06-SolutionVariantManagement', 'createMultilevelMultiVRSolVariant', inputData ).then(
            function( response ) {
                return deferred.resolve( response );
            } );
    } );
    return deferred.promise;
};

/**
  * @constructor
  */
var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

export let createMultiLevelBulkSVCreateInput = function( bomLineUid, selectedObjects, UseModuleLevelConfiguration, runInBackground ) {
    let _configPreferences = {
        StopOnError: '0',
        DryRun: '0',
        NumberOfLinesToProcess: '0',
        allLevel: '1',
        runInBackground: '0',
        UseModuleLevelConfiguration: UseModuleLevelConfiguration
    };

    if ( runInBackground ) {
        _configPreferences.runInBackground = '1';
    }
    let variantRules = [];
    for ( var i = 0; i < selectedObjects.length; i++ ) {
        variantRules.push( new IModelObject( uwPropertySvc.getSourceObjectUid( selectedObjects[i].props['REF(smc0SVVarRule, VariantRule).object_string'] ), 'unknownType' )  );
    }
    return {
        createMultilevelSVInputList: [ {
            createSVItemInput: {
                genericBOMLine: {
                    uid: bomLineUid
                },
                createSVItemInfo: {
                    svCategoryType: 2,
                    createSVItemDesc: {
                        boName: ''
                    }
                }
            },
            mappedSVBOMLineUID: '',
            bomLineLevel: 0
        } ],
        createMultilevelSVConfigParam: {
            pcaVariantRules: variantRules,
            configPreferences: _configPreferences
        }
    };
};

let updateBOMLineVariantRuleInput = function( bomLineUid, selectedObjects, currProductContextInfo, runInBackground ) {
    let _configPreferences = {
        StopOnError: 'False',
        runInBackground: 'False',
        multilevel: 'True'
    };
    if ( runInBackground ) {
        _configPreferences.runInBackground = 'True';
    }
    let currentRevRule = currProductContextInfo.props.awb0CurrentRevRule.dbValues[0];

    var updateSVItemInputList = [ {

        genericBOMLine: {
            uid: bomLineUid
        }
    } ];
    updateSVItemInputList[0].reuseSVItemRevList = [];
    for ( var i = 0; i < selectedObjects.length; i++ ) {
        updateSVItemInputList[0].reuseSVItemRevList.push( new IModelObject( selectedObjects[i].svUID, 'unknownType' )  );
    }
    return {
        updateSVItemInputList,
        revRuleToUseInUpdate: {
            uid: currentRevRule
        },
        configPreferences: _configPreferences
    };
};

export let updateReuseSolutionVariants = function( selectedObjects, occMgmtContext, runInBackground ) {
    let deferred = AwPromiseService.instance.defer();
    let viewModelObjects = occMgmtContext.pwaSelection[0];
    getBOMLineUids( [ viewModelObjects ] ).then( function( bomLineUid ) {
        let inputData = updateBOMLineVariantRuleInput( bomLineUid, selectedObjects, occMgmtContext.productContextInfo, runInBackground );
        soaSvc.postUnchecked( 'StructureManagement-2023-06-SolutionVariantManagement', 'updateMultilevelReuseSolVariants', inputData ).then(
            function( response ) {
                if ( !response.ServiceData.partialErrors ) {
                    //refresh table
                }
                return deferred.resolve( response );
            } );
    } );
    return deferred.promise;
};

export let getVariantRulesAndSolVariants = function( sortCriteria, filterInfo, rootElement, selection, spageID ) {
    let deferred = AwPromiseService.instance.defer();
    if ( spageID === 'tc_xrt_SolutionVariants' || spageID === 'tc_xrt_color' ) {
        getBOMLineUids( [ rootElement ] ).then( function( topid ) {
            getBOMLineUids( [ selection ] ).then( function( bomLineUid ) {
                let inputData = getVariantRulesAndSolVariantsInput( bomLineUid, topid, sortCriteria, filterInfo );
                soaSvc.postUnchecked( 'Internal-StructureManagement-2023-06-SolutionVariantManagement', 'getVariantRulesAndSolVariants', inputData ).then(
                    function( response ) {
                        return deferred.resolve( response.outInfo );
                    } );
            } );
        } );
    }
    return deferred.promise;
};

export let getVariantRulesAndSolVariantsInput = function( bomLineUid, topLineUid, sortCriteria, filterInfo ) {
    let sortingInfo = {};
    if ( sortCriteria[0] ) {
        sortingInfo.propName = sortCriteria[0].fieldName;
        sortingInfo.className = 'ItemRevision';
        if ( sortCriteria[0].sortDirection === 'ASC' ) {
            sortingInfo.sortOrder = 'ASCEND';
        } else if ( sortCriteria[0].sortDirection === 'DESC' ) {
            sortingInfo.sortOrder = 'DESCEND';
        }
    }
    let isValidAndComplete = '';
    return {
        input:{
            inputObjects: [ {
                svSearchForBOMLine:{
                    uid: bomLineUid
                },
                variantRuleSourceBOMLine: {
                    uid: topLineUid
                },
                inputVariantRules: []
            } ],
            filterInfo: [ {
                vrValidAndCompleteCheck: isValidAndComplete,
                hasSolutionVariant: '',
                //sending reuse always now as we do not support managed or unmanaged in AW right now
                svSourceCategory : 'Reuse'
            } ],
            sortingInfo: sortingInfo,
            cursor: {
                pageAction: 'NEXT'
            },
            pageSize: 0,
            columnConfigInput: {}
        }
    };
};
export const getVariantRulesFromSOAOutput = ( outInfo ) => {
    let variantRules = [];
    for( let indx = 0; indx < outInfo.length; indx++ ) {
        if ( outInfo[indx].svrToSolutionVariants[ 0 ][ 0 ].uid !== cdm.NULL_UID ) {
            variantRules.push( outInfo[indx].svrToSolutionVariants[ 0 ][ 0 ] );
        }
    }
    return variantRules;
};

export let registerSVCtx = function() {
    appCtxSvc.registerCtx( 'SVContext', {
        runInBackground: '',
        SVTableView: '',
        bomLineUID: '',
        doesSelectionHaveSV: 'none',
        isUpdateStatusList: 'none'
    } );
};

export let cleanupSVContext = function() {
    appCtxSvc.unRegisterCtx( 'SVContext' );
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
export let getBOMLineUids = function( viewModelObjects ) {
    let deferred = AwPromiseService.instance.defer();
    occmgmtBackingObjProviderSvc.getBackingObjects( viewModelObjects ).then( function( response ) {
        appCtxSvc.updatePartialCtx( 'SVContext.bomLineUID', response[0].uid );
        return deferred.resolve( response[0].uid );
    } );
    return deferred.promise;
};

export const updateSVTableSelection = function( dataProvider, vrUID ) {
    const result = dataProvider.viewModelCollection.loadedVMObjects.find( ( { svrUID } ) => svrUID === vrUID );
    dataProvider.selectionModel.setSelection( result );
    return dataProvider;
};

/**
 * Updates the selection data with the provided selection model.
 *
 * @param {Object} selectionData - The selection data to be updated.
 * @param {Object} selectionModel - The selection model to update the selection data.
 * @returns {Object} - The updated selection data.
 */
export let updateSVSelectionData = async function( selectionData, selectionModel ) {
    if( selectionData.selected && selectionData.selected.length === 0 ) {
        return selectionData;
    }
    appCtxSvc.updatePartialCtx( 'SVContext.doesSelectionHaveSV', 'none' );
    appCtxSvc.updatePartialCtx( 'SVContext.isUpdateStatusList', 'none' );
    let SolutionVariantDisableUpdateStatusList = appCtxSvc.getCtx( 'preferences.SolutionVariantDisableUpdateStatusList' );

    //ensure all sv objects are loaded before proceeding
    let objectsToLoad = [];
    if( selectionModel.selectionData.selected && selectionModel.selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {
            let svIR = selectionModel.selectionData.selected[idx].props[ 'REF(smc0SVIR, ItemRevision).object_string'];
            if( !svIR ) {
                // If object_string is not present, then use below path to get the SV ItemRevision UID
                svIR = selectionModel.selectionData.selected[0].props.smc0SVIR;
            }
            selectionData.selected[idx].svUID = uwPropertySvc.getSourceObjectUid( svIR );
            var myobj = cdm.getObject( selectionData.selected[idx].svUID );
            if( myobj === null ) {
                objectsToLoad.push( selectionData.selected[idx].svUID );
            }
        }
    }
    if ( objectsToLoad.length > 0 ) {
        await dataManagementSvc.loadObjects( objectsToLoad );
    }

    if( selectionModel.selectionData.selected && selectionModel.selectionData.selected.length >= 1 ) {
        for( let idx = 0; idx < selectionData.selected.length; idx++ ) {

            //get all release status items to get localized names of status
            let releaseStatusLists = selectionModel.selectionData.selected[idx].props[ 'REF(smc0SVIR, ItemRevision).release_status_list'];
            let releaseStatusObj = {};
            let releaseStatusDBValues = [];
            for( let i = 0; i < releaseStatusLists.dbValues.length; i++ ) {
                releaseStatusObj = cdm.getObject( releaseStatusLists.dbValues[i] );
                releaseStatusDBValues.push( releaseStatusObj.props.object_name.dbValues[0] );
            }
            // Need to set dcp conditions on context for status list and whether there is a solution variant present in current selection
            if( SolutionVariantDisableUpdateStatusList.some( item => releaseStatusDBValues.includes( item)) && appCtxSvc.getCtx( 'SVContext.isUpdateStatusList' ) !== 'false' ) {
                appCtxSvc.updatePartialCtx( 'SVContext.isUpdateStatusList', 'true' );
            } else if ( !SolutionVariantDisableUpdateStatusList.some( item => releaseStatusDBValues.includes( item)) && appCtxSvc.getCtx( 'SVContext.isUpdateStatusList' ) !== 'true' ) {
                appCtxSvc.updatePartialCtx( 'SVContext.isUpdateStatusList', 'false' );
            } else {
                appCtxSvc.updatePartialCtx( 'SVContext.isUpdateStatusList', 'mixed' );
            }
            let svIR = selectionModel.selectionData.selected[idx].props[ 'REF(smc0SVIR, ItemRevision).object_string'];
            if( !svIR ) {
                // If object_string is not present, then use below path to get the SV ItemRevision UID
                svIR = selectionModel.selectionData.selected[0].props.smc0SVIR;
            }
            let svrProp = selectionModel.selectionData.selected[idx].props[ 'REF(smc0SVVarRule, VariantRule).object_string'];
            if( !svrProp ) {
                svrProp = selectionModel.selectionData.selected[idx].props[ 'REF(smc0SVVarRule, VariantRule).object_name'];
                // object_name property constant Modifiable is Write, so server sends isEnabled=true, but we need to disable the cell for editing, so setting isEnabled=false
                svrProp.isEnabled = false;
            }
            selectionData.selected[idx].svrUID = uwPropertySvc.getSourceObjectUid( svrProp );
            selectionData.selected[idx].svUID = uwPropertySvc.getSourceObjectUid( svIR );
            // If we have a solution variant on the line make this the selected VMO of the table
            if( svIR.value !== null ) {
                if( appCtxSvc.getCtx( 'SVContext.doesSelectionHaveSV' ) !== 'false' ) {
                    appCtxSvc.updatePartialCtx( 'SVContext.doesSelectionHaveSV', 'true' );
                }
                let newvmo = tcViewModelObjectSvc.createViewModelObjectById( uwPropertySvc.getSourceObjectUid( svIR ) );
                tcViewModelObjectSvc.mergeObjects( selectionData.selected[idx], newvmo );
            } else if ( svIR.value === null && appCtxSvc.getCtx( 'SVContext.doesSelectionHaveSV' ) !== 'true' ) {
                appCtxSvc.updatePartialCtx( 'SVContext.doesSelectionHaveSV', 'false' );
            } else {
                appCtxSvc.updatePartialCtx( 'SVContext.doesSelectionHaveSV', 'mixed' );
            }
        }
    }
    return selectionData;
};

/**
 * Update xrtContext on Object set
 * Update binding 'triggerReloadKey'(mapped to key element of the object set)
 * to trigger data reload
 * @param {Object} vmObjectSet - contexts/constraints/variants objectSet atomic data
 * @param {Object} xrtContext - xrtContext (used to create searchInputCriteria for performSearchViewModel SOA)
 */
export let refreshObjectSet = ( vmObjectSet, xrtContext ) => {
    let objectSet = { ...vmObjectSet.getAtomicData() };
    objectSet.xrtContext = xrtContext;

    // Update key attribute within for each objectSet component
    // Any value can be used: here we use a random number
    const triggerReloadKey = Math.floor( Math.random() * 100 );
    objectSet.triggerReloadKey = triggerReloadKey;
    vmObjectSet.setAtomicData( objectSet );
};

export default exports = {
    updateReuseSolutionVariants,
    CreateMultilevelSolutionVariants,
    getVariantRulesAndSolVariants,
    getVariantRulesFromSOAOutput,
    registerSVCtx,
    cleanupSVContext,
    updateSVTableSelection,
    updateSVSelectionData,
    getBOMLineUids,
    refreshObjectSet
};

