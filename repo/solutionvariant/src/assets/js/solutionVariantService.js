// Copyright (c) 2022 Siemens

/**
 * @module js/solutionVariantService
 */
import aceExpandBelowService from 'js/aceExpandBelowService';
import aceStructureConfigurationService from 'js/aceStructureConfigurationService';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import localeService from 'js/localeService';
import LocationNavigationService from 'js/locationNavigation.service';
import occmgmtBackingObjProviderSvc from 'js/aceBackingObjectProviderService';
import acePropertyPolicyService from 'js/acePropertyPolicyService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';
import _prefSvc from 'soa/preferenceService';


/**
  * ***********************************************************<BR>
  * Define external API<BR>
  * ***********************************************************<BR>
  */
var exports = {};

/**
  * Get state params
  * This should handle selected as well as refresh URL case
  * @returns {Object} returns object having url UID information
  */
let getStateParams = function( selectedObject ) {
    let toParams = {};
    let stateParams = AwStateService.instance.params;
    toParams.pci_uid = stateParams.pci_uid;

    if ( selectedObject && !_.isUndefined( selectedObject.props ) && !_.isUndefined( selectedObject.props.awb0Archetype ) ) {
        //This means Solution Variant button is clicked inside ACE ( no URL refresh)
        toParams.t_uid = stateParams.uid; //current root becomes product for SV Preview
        toParams.uid = selectedObject.props.awb0Archetype.dbValues[0]; //current selection's ItemRev becomes new root for SV Preview
    } else {
        //URL refresh case
        toParams.uid = stateParams.uid;
        toParams.t_uid = stateParams.t_uid;
    }
    return toParams;
};

/**
  * This method maintains appCtx with commands that need to hidden inside SV Preview UI
  */
let updateHiddenCommandContext = function() {
    let hiddenCommands = {};
    hiddenCommands.Arm0ImportExcel = true;
    hiddenCommands.Arm0Export = true;
    hiddenCommands.Arm0ExportImport = true;
    appCtxSvc.updatePartialCtx( 'hiddenCommands', hiddenCommands );
};

let createBOMLineVariantRuleInput = function( bomLineUid ) {
    return {
        bomLine: {
            uid: bomLineUid
        },
        validate: true,
        saveVariantRule: true,
        checkCompleteness: true
    };
};

let populateSVInputConfigParams = function( variantRule ) {
    let currProductContextInfo = appCtxSvc.getCtx( 'aceActiveContext.context' ).productContextInfo;
    let currentRevRule = currProductContextInfo.props.awb0CurrentRevRule.dbValues[0];
    let effDate = currProductContextInfo.props.awb0EffDate.dbValues[0];
    let effEndItem = currProductContextInfo.props.awb0EffEndItem.dbValues[0];
    let effUnitNo = currProductContextInfo.props.awb0EffUnitNo.dbValues[0];
    let effectivityGroups = currProductContextInfo.props.awb0EffectivityGroups.dbValues[0];
    let startEffDates = currProductContextInfo.props.awb0StartEffDates.dbValues[0];
    let startEffUnits = currProductContextInfo.props.awb0StartEffUnits.dbValues[0];
    let endEffDates = currProductContextInfo.props.awb0EndEffDates.dbValues[0];
    let endEffUnits = currProductContextInfo.props.awb0EndEffUnits.dbValues[0];

    let _configParams = {
        currentRevRule: currentRevRule,
        variantRule: variantRule,
        effDate: effDate,
        effEndItem: effEndItem,
        effUnitNo: effUnitNo,
        effectivityGroups: effectivityGroups,
        startEffDates: startEffDates,
        startEffUnits: startEffUnits,
        endEffDates: endEffDates,
        endEffUnits: endEffUnits
    };

    appCtxSvc.updateCtx( 'svConfigParams', _configParams );
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
export let getBOMLineUid = function( viewModelObjects ) {
    let deferred = AwPromiseService.instance.defer();
    occmgmtBackingObjProviderSvc.getBackingObjects( [ viewModelObjects ] ).then( function( response ) {
        return deferred.resolve( response[0].uid );
    } );
    return deferred.promise;
};

/**
  * This method performs open action for showObjectCellCommand for ACE
  */
export let openSolutionVariant = function( objToOpen, page, pageId ) {
    let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    let toParams = {};
    toParams.page = page;
    toParams.pageId = pageId;

    let options = {
        inherit: false
    };
    toParams.uid = objToOpen;
    AwStateService.instance.go( transitionTo, toParams, options );
};

export let getMultiLevelSVCreateInput = function( rootUid, dryRunOption ) {
    let variantRuleUid = appCtxSvc.getCtx( 'SVContext' ).productContextInfo.props.awb0CurrentVariantRule.dbValues[0];
    let runInBackground = appCtxSvc.getCtx( 'aceActiveContext.context.runInBackground' );
    let _configPreferences = {
        StopOnError: '0',
        DryRun: dryRunOption,
        NumberOfLinesToProcess: '0',
        allLevel: '1'
    };

    if ( runInBackground ) {
        _configPreferences.runInBackground = '1';
    }

    return {
        createMultilevelSVInputList: [ {
            createSVItemInput: {
                genericBOMLine: {
                    uid: rootUid
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
            pcaVariantRule: {
                uid: variantRuleUid
            },
            configPreferences: _configPreferences
        }
    };
};

export let createMultiLevelSolutionVariantInput = function( runInBackground ) {
    // User selection in ACE will be opened as topElement in SV Preview.
    // This topElement should be sent as input for SV creation.
    if ( !_.isUndefined( runInBackground ) ) {
        appCtxSvc.updatePartialCtx( 'aceActiveContext.context.runInBackground', true );
    }
    appCtxSvc.updatePartialCtx( 'aceActiveContext.context.disabledButtonChk', true );
    let viewModelObjects = appCtxSvc.getCtx( 'SVContext.topElement' );
    getBOMLineUid( viewModelObjects ).then( function( response ) {
        let inputData = getMultiLevelSVCreateInput( response, '0' );
        appCtxSvc.updatePartialCtx( 'aceActiveContext.context.createSVInput', inputData );
        eventBus.publish( 'invokeCreateSVSoa' );
    } );
};

export let postProcessSearchSVResponse = function( eventData, selectedObject ) {
    var ctx = appCtxSvc.getCtx();
    let newAceActiveContext = { ...ctx.aceActiveContext };
    if ( newAceActiveContext.context && !_.isUndefined( newAceActiveContext.context.rootSVExists ) ) {
        delete newAceActiveContext.context.rootSVExists;
    }
    if ( eventData.searchSVItemOutputList && eventData.searchSVItemOutputList.length > 0 ) {
        let responseObj = eventData.searchSVItemOutputList[0];
        let found = false;
        if( responseObj.intialSVItemOutputList.length > 0 ) {
            found = ctx.preferences.SolutionVariantDisableUpdateStatusList.some( r=> responseObj.intialSVItemOutputList[0].svItemRev.props.release_status_list.uiValues.includes( r ) );
        }
        if ( responseObj.intialSVItemOutputList && responseObj.intialSVItemOutputList.length > 0 &&
            ( !ctx.preferences.SolutionVariantDisableUpdateStatusList || !found ) ) {
            newAceActiveContext.context.rootSVItemRev = responseObj.intialSVItemOutputList[0].svItemRev.uid;
            newAceActiveContext.context.rootSVExists = true;
            appCtxSvc.updateCtx( 'aceActiveContext', newAceActiveContext );
        } else {
            exports.launchSolutionVariantPage( selectedObject );
        }
    }
};

export let getSVPreviewHeaderInfo = function( data ) {
    let revisionRule = {};
    aceStructureConfigurationService.populateContextKey( data );
    let currentRevisionRule = appCtxSvc.getCtx( 'aceActiveContext.context' ).productContextInfo.props.awb0CurrentRevRule;
    if ( currentRevisionRule ) {
        revisionRule = uwPropertyService.createViewModelProperty( currentRevisionRule.dbValues[0],
            currentRevisionRule.uiValues[0], 'STRING', currentRevisionRule.dbValues[0], currentRevisionRule.uiValues );
    }
    return revisionRule;
};

/**
  * This method uses state params to transition to SV Preview UI
  */
export let launchSolutionVariantPage = function( selectedObject ) {
    let transitionTo = 'solutionVariantPreview';
    let toParams = getStateParams( selectedObject );
    let options = {
        inherit: false
    };
    AwStateService.instance.go( transitionTo, toParams, options );
};

/**
  * This method initializes Solution Variant context to launch SV Preview UI
  * @returns {Object} returns model object to open as root in SV Preview UI
  */
export let loadModelObjToOpen = function() {
    let defer = AwPromiseService.instance.defer();

    let taskTitle;
    localeService.getLocalizedText( 'SolutionVariantConstants', 'solutionVariantPreviewTaskTitle' ).then( function( result ) {
        taskTitle = result;
    } );

    let stateParams = { ...AwStateService.instance.params };
    let uidsForLoadObject = [ stateParams.uid, stateParams.pci_uid, stateParams.t_uid ];

    dataManagementSvc.loadObjects( uidsForLoadObject ).then( function() {
        let obj = cdm.getObject( uidsForLoadObject[0] );
        let result = {};
        result.modelObjs = [];
        if ( obj ) {
            result.modelObjs.push( obj );
        }

        let selectedObjString;
        if ( obj && obj.modelType && taskTitle ) {
            if ( obj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                taskTitle = taskTitle.replace(
                    '{0}',
                    obj.props.object_string.dbValues[0]
                );
                selectedObjString = obj.props.object_string.dbValues[0];
            } else {
                taskTitle = taskTitle.replace(
                    '{0}',
                    obj.props.object_name.dbValues[0]
                );
                selectedObjString = obj.props.object_name.dbValues[0];
            }
        }

        let variantLabel;
        let productContextInfo = cdm.getObject( uidsForLoadObject[1] );
        if (
            productContextInfo &&
             productContextInfo.props &&
             productContextInfo.props.awb0CurrentVariantRule
        ) {
            variantLabel =
                 productContextInfo.props.awb0CurrentVariantRule.uiValues[0];
        }
        let topElement = cdm.getObject( uidsForLoadObject[2] );
        let topElementUid;
        let topElementObjString;
        if ( topElement && topElement.props ) {
            if (
                topElement.modelType &&
                 topElement.modelType.typeHierarchyArray.indexOf(
                     'ItemRevision'
                 ) > -1
            ) {
                topElementObjString =
                     topElement.props.object_string.dbValues[0];
                topElementUid = topElement.uid;
            } else {
                topElementObjString =
                     topElement.props.awb0Archetype.uiValues[0];
                topElementUid = topElement.props.awb0Archetype.dbValues[0];
            }
        }

        let isProductBeingOpenedAsRoot = false;
        if ( stateParams.uid === topElementUid ) {
            //This means root product is being opened in SV Preview UI
            isProductBeingOpenedAsRoot = true;
        }
        let requestPref = {
            savedSessionMode: 'ignore'
        };

        let _svConfigParams = appCtxSvc.getCtx( 'svConfigParams' );
        let configContext = {};
        if ( _svConfigParams ) {
            configContext = {
                r_uid: _svConfigParams.currentRevRule,
                de: _svConfigParams.effDate,
                ei_uid: _svConfigParams.effEndItem,
                ue: _svConfigParams.effUnitNo,
                eg_uids: _svConfigParams.effectivityGroups,
                startDate: _svConfigParams.startEffDates,
                fromUnit: _svConfigParams.startEffUnits,
                endDate: _svConfigParams.endEffDates,
                toUnit: _svConfigParams.endEffUnits,
                var_uid: _svConfigParams.variantRule
            };
        }

        appCtxSvc.registerCtx( 'SVContext', {
            currentState: {
                uid: stateParams.uid,
                pci_uid: stateParams.pci_uid,
                t_uid: stateParams.t_uid
            },
            requestPref: requestPref,
            configContext: configContext,
            showVariantsInOcc: false,
            startFreshNavigation: true,
            productContextInfo: productContextInfo,
            transientRequestPref: {},
            readOnlyFeatures: {},
            expansionCriteria: {},
            skipAutoBookmark: true,
            taskTitle: taskTitle,
            productTitle: topElementObjString,
            selectedObjString: selectedObjString,
            variantLabel: variantLabel,
            previousState: {},
            pwaSelectionModel: {},
            persistentRequestPref: {
                showExplodedLines: false
            },
            isProductBeingOpenedAsRoot: isProductBeingOpenedAsRoot,
            disabledButtonChk: false
        } );
        defer.resolve( result );
    } );
    return defer.promise;
};

/**
  * Clean up Solution Variant context upon exit from SV Preview UI
  */
export let cleanupSVContext = function() {
    appCtxSvc.unRegisterCtx( 'SVContext' );
    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    appCtxSvc.unRegisterCtx( 'modelObjectsToOpen' );
    appCtxSvc.unRegisterCtx( 'hideRightWall' );
    occMgmtStateHandler.destroyOccMgmtStateHandler();
    aceUpdatePwaDisplayService.destroy();
    aceTreeTableDataService.destroy();
    acePropertyPolicyService.unRegisterPropertyPolicy();
    aceExpandBelowService.destroy();
    delete appCtxSvc.ctx.hiddenCommands;
    delete appCtxSvc.ctx.skipAutoBookmark;
    delete appCtxSvc.ctx.taskbarfullscreen;
};

export let postProcessSVCreateResponse = function( svrResponse ) {
    if ( svrResponse.ServiceData && svrResponse.ServiceData.modelObjects ) {
        let rootItemRev = appCtxSvc.getCtx( 'aceActiveContext.context' ).currentState.uid;
        _.every( svrResponse.ServiceData.modelObjects, function( modelObj ) {
            if ( modelObj && modelObj.props && modelObj.props.Smc0SolutionVariantSource && modelObj.props.Smc0SolutionVariantSource.dbValues[0] === rootItemRev ) {
                // This would be root Solution Variant model object
                appCtxSvc.updatePartialCtx( 'aceActiveContext.context.rootSVItemRev', modelObj.uid );
                return false; //break
            }
            return true; //continue
        } );
        eventBus.publish( 'aceShowObjectForSV' );
    }
};

export let openSourceStructure = function( page, pageId ) {
    let transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
    let toParams = {};
    toParams.page = page;
    toParams.pageId = pageId;

    let options = {
        inherit: false
    };
    let stateParams = AwStateService.instance.params;
    toParams.uid = stateParams.uid;
    toParams.pci_uid = stateParams.pci_uid;

    AwStateService.instance.go( transitionTo, toParams, options );
};

export let initializeSVContext = function( subPanelContext, data ) {
    const contextKey = subPanelContext.contextKey;

    let occContext = data.declViewModelJson.data.occContext.initialValues;

    let _svConfigParams = appCtxSvc.getCtx( 'svConfigParams' );
    if ( _svConfigParams ) {
        occContext.configContext = {
            r_uid: _svConfigParams.currentRevRule,
            de: _svConfigParams.effDate,
            ei_uid: _svConfigParams.effEndItem,
            ue: _svConfigParams.effUnitNo,
            eg_uids: _svConfigParams.effectivityGroups,
            startDate: _svConfigParams.startEffDates,
            fromUnit: _svConfigParams.startEffUnits,
            endDate: _svConfigParams.endEffDates,
            toUnit: _svConfigParams.endEffUnits,
            var_uid: _svConfigParams.variantRule
        };
    }

    updateHiddenCommandContext();
    const SVContext = appCtxSvc.getCtx( 'SVContext' );
    let newSVContext = { ...SVContext };
    newSVContext.urlParams = subPanelContext.urlParams;
    newSVContext.modelObject = newSVContext.topElement;

    appCtxSvc.registerCtx( contextKey, newSVContext );

    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[contextKey]
    } );

    if ( newSVContext.currentState ) {
        occContext.currentState = newSVContext.currentState;
    }

    occMgmtStateHandler.initializeOccMgmtStateHandler();
    aceUpdatePwaDisplayService.initialize( contextKey );
    aceTreeTableDataService.initialize();
    acePropertyPolicyService.registerPropertyPolicy();
    aceExpandBelowService.initialize();

    data.dispatch( { path: 'data.occContext', value: occContext } );
};

export let getSubsetSVR = function( selectedObject ) {
    let deferred = AwPromiseService.instance.defer();
    let viewModelObjects = appCtxSvc.getCtx( 'selected' );
    getBOMLineUid( selectedObject ).then( function( bomLineUid ) {
        let inputData = createBOMLineVariantRuleInput( bomLineUid );
        soaSvc.postUnchecked( 'Internal-StructureManagement-2021-06-SolutionVariantManagement', 'createBOMLineVariantRule', inputData ).then(
            function( response ) {
                if ( response.isValidAndComplete && !response.ServiceData.partialErrors ) {
                    const aceActiveCtx = appCtxSvc.getCtx( 'aceActiveContext' );
                    let newAceActiveContext = { ...aceActiveCtx };
                    newAceActiveContext.context.isValidSVR = true;
                    appCtxSvc.updateCtx( 'aceActiveContext', newAceActiveContext );
                    populateSVInputConfigParams( response.childVariantRule.uid );
                } else {
                    //below will result in showing error message
                    appCtxSvc.updatePartialCtx( 'aceActiveContext.context.isValidSVR', false );
                }
                return deferred.resolve( response );
            } );
    } );
    return deferred.promise;
};

export let openSolutionVariantSuccessNotification = function( notificationObject ) {
    dataManagementSvc.getProperties( [ notificationObject.object.uid ] ).then(
        function() {
            var srcUidToken = notificationObject.object.props.fnd0TargetObject.dbValues[0];
            var toParams = {};
            if ( srcUidToken ) {
                toParams = {
                    uid: srcUidToken,
                    page: 'Content',
                    pageId: 'tc_xrt_Content'
                };
            } else {
                toParams = {
                    uid: notificationObject.object.uid
                };
            }

            let openObjUid = appCtxSvc.getCtx( 'aceActiveContext.context.currentState.uid' );
            let sublocation = appCtxSvc.getCtx( 'sublocation.nameToken' );
            if( openObjUid && toParams.uid === openObjUid && sublocation && sublocation === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
                // If the object we are opening is already opened in ACE then there is no need to navigate again.
                // Instead we can just reset the current ACE tree
                let aceViewKey = appCtxSvc.getCtx( 'aceActiveContext.key' );
                appCtxSvc.updatePartialCtx( aceViewKey + '.transientRequestPref.startFreshNavigation', true );
                let acePwaResetEventData = {
                    viewToReset: aceViewKey,
                    silentReload: true
                };
                eventBus.publish( 'acePwa.reset', acePwaResetEventData );
            } else {
                var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showObject';
                var options = {
                    inherit: false
                };
                LocationNavigationService.instance.go( transitionTo, toParams, options );
            }
        } );
};

export let initTaskbarLinkProperties = function() {
    const productTitle = appCtxSvc.getCtx( 'SVContext.productTitle' );
    const selectedObjString = appCtxSvc.getCtx( 'SVContext.selectedObjString' );

    let rootProduct = uwPropertyService.createViewModelProperty(
        productTitle,
        productTitle,
        'STRING',
        productTitle,
        [ productTitle ]
    );

    let selectedSourceStructure = uwPropertyService.createViewModelProperty(
        selectedObjString,
        selectedObjString,
        'STRING',
        selectedObjString,
        [ selectedObjString ]
    );

    return { rootProduct, selectedSourceStructure };
};

export const getCfgPerspective = ( response ) => {
    if( response.ServiceData ) {
        if( response.searchResultsJSON && response.ServiceData && response.ServiceData.modelObjects ) {
            let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

            if( searchResults && searchResults.objects ) {
                let searchedObjects = searchResults.objects.map( function( searchedObject ) {
                    return response.ServiceData.modelObjects[ searchedObject.uid ];
                } );

                if( searchedObjects.length > 0 ) {
                    return searchedObjects[ 0 ].uid;
                }
            }
        }
    }
    return null;
};

export let getProfileSetting = function() {
    let profileSettings = {
        pca0AllowMultipleSelections: 'true',
        pca0AllowValidationRulesToExpand: 'true',
        pca0ApplyConstraints: 'true',
        pca0ExpansionSeverity: '4',
        pca0ProfileName: 'pca0Overlay',
        pca0ValidationSeverity: '4'
    };

    return JSON.stringify( profileSettings );
};

export let addNewRuleToExistingRulesAndReturn = function( newVariantRuleObject ) {
    let associatedVariantRules = appCtxSvc.getCtx( 'variantConditionContext.selectedObjectsFromConsumerApps' );
    if( associatedVariantRules === undefined ) {
        associatedVariantRules = [];
    }
    let newVariantRuleObjects = [];
    if( newVariantRuleObject !== undefined && newVariantRuleObject !== null ) {
        if( _.isArray( newVariantRuleObject ) ) {
            newVariantRuleObjects = newVariantRuleObject;
        } else {
            newVariantRuleObjects = [ newVariantRuleObject ];
        }
        newVariantRuleObjects = _.map( newVariantRuleObjects, newVariantRuleObject => {
            return cdm.getObject( newVariantRuleObject.uid );
        } );
    }
    return _.union( associatedVariantRules, newVariantRuleObjects );
};

export default exports = {
    launchSolutionVariantPage,
    loadModelObjToOpen,
    getSVPreviewHeaderInfo,
    getBOMLineUid,
    openSolutionVariant,
    getMultiLevelSVCreateInput,
    postProcessSearchSVResponse,
    createMultiLevelSolutionVariantInput,
    postProcessSVCreateResponse,
    cleanupSVContext,
    openSourceStructure,
    initializeSVContext,
    getSubsetSVR,
    openSolutionVariantSuccessNotification,
    initTaskbarLinkProperties,
    getCfgPerspective,
    getProfileSetting,
    addNewRuleToExistingRulesAndReturn
};

