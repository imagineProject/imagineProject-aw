// Copyright (c) 2022 Siemens

/**
 * @module js/configurationBaselineService
 */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import AwStateService from 'js/awStateService';
import dataManagementService from 'soa/dataManagementService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _occmgmtBackingObjectProviderService from 'js/aceBackingObjectProviderService';
import policySvc from 'soa/kernel/propertyPolicyService';
import acePropertyPolicyService from 'js/acePropertyPolicyService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import backgroundWorkingCtxTimer from 'js/aceBackgroundWorkingContextTimerService';
import backgroundWorkingCtxSvc from 'js/aceBackgroundWorkingContextService';
import localeService from 'js/localeService';
import cdmService from 'soa/kernel/clientDataModel';
import dateEffConfigration from 'js/dateEffectivityConfigurationService';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import discoveryFilterService from 'js/discoveryFilterService';
import discoverySubscriptionService from 'js/discoverySubscriptionService';
import LocationNavigationService from 'js/locationNavigation.service';
import aceGetService from 'js/aceGetService';
import dateTimeService from 'js/dateTimeService';
import uwPropertyService from 'js/uwPropertyService';
import occmgmtUtils from 'js/occmgmtUtils';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';


var exports = {};
var _eventSubDefs = [];

/** Policy ID of required loaded objects */
let _policyId = null;

/**
  * Set the default properties for object_name.
  *
  * @param {*} occContext The occContext
  * @param {*} data the object
  * @param {*} xrtType Create/saveAs
  * @param {*} editHandler editHandleroccContext
  */
export let prePopulateConfigBaselineName = function( occContext, data ) {
    let occMgmtConfigurationBaselineResource = 'OccMgmtConfigBaselineMessages';
    let occMgmtConfigurationBaselineBundle = localeService.getLoadedText( occMgmtConfigurationBaselineResource );
    let configBaselineName = occMgmtConfigurationBaselineBundle.createConfigurationBaselinePrefix;
    let configBaselineNameValue = occContext.topElement.props.object_string.dbValues[0];
    configBaselineName = configBaselineName.replace( '{0}', configBaselineNameValue );
    configBaselineName = configBaselineName.replace( /['"]+/g, '' );
    return {
        configBaselineName: configBaselineName
    };
};

export let updateConfigurationBaselineNameField = function( fields, data ) {
    let configurationBaselineName = _.cloneDeep( data.configurationBaselineName );
    let configurationBaselineNameValue  = fields.configurationBaselineName;
    configurationBaselineNameValue.update( configurationBaselineName.dbValue, {}, { markModified : true, runValidation : true } );
};

/**
 * This method is used to get the LOV values for the versioning panel.
 * @param {Object} response the response of the getLov soa
 * @returns {Object} value the LOV value
 */
export let getLOVList = function( response ) {
    return response.lovValues.map( function( obj ) {
        return {
            propDisplayValue: obj.propDisplayValues.lov_values[ 0 ],
            propInternalValue: obj.propInternalValues.lov_values[ 0 ]
        };
    } );
};

/**
  * Function to get the backing object  and
  * assign to the data  membEr topLine.
  * @param {Object} data
  */
export let getBackingObject = function( modelObject, data ) {
    _getBomlineOfTopLine( modelObject ).then( function( response ) {
        data.dispatch( { path: 'data.topLine.dbValue', value:response } );
    } );
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
let _getBomlineOfTopLine = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();
    _occmgmtBackingObjectProviderService.getBackingObjects( [ modelObject ] ).then( function( response ) {
        return deferred.resolve( response[0].uid );
    } );
    return deferred.promise;
};

export let createInputForCreateConfigurationBaselineSOA = ( data ) => {
    var createInputs = [];
    var dataVal = {};

    dataVal = {
        boName : 'Fnd0ConfigurationBaseline',
        stringProps: {
            fnd0ConfigBaselineType: data.configurationBaselineType.dbValue,
            object_desc: data.configurationBaselineDescription.dbValue,
            object_name: data.configurationBaselineName.dbValue
        },
        tagProps: {
            fnd0InputObject: {
                type: data.topLine.type,
                uid: data.topLine.dbValue
            },
            fnd0ValidationRule: {
                uid: data.configBaselineValidationRule.dbValue,
                type: 'STRING'
            }
        }
    };
    if( data.configurationBaselineClose.dbValue ) {
        dataVal.stringProps.fnd0State = 'Closed';
        if ( data.actionOnWorkingContent.dbValue === 2 ) {
            dataVal.stringProps.fnd0ReleaseProcess = '';
        } else {
            dataVal.stringProps.fnd0ReleaseProcess = data.closureWorkflow.dbValue;
        }
        var dataValForIntProps = {
            intProps: {
                fnd0ClosureActionOnWorkingRevs: 0
            }
        };
        Object.assign( dataVal, dataValForIntProps );
        dataVal.intProps.fnd0ClosureActionOnWorkingRevs = data.actionOnWorkingContent.dbValue;
    }

    var input = {
        clientId: 'Fnd0ConfigurationBaseline',
        data: dataVal
    };
    createInputs.push( input );

    return createInputs;
};

export let getPagedValidationRuleList = function( response, data ) {
    var validationRuleList = [];
    var result;
    let moreValuesExist = false;

    if( response.searchResults ) {
        result = response.searchResults;
        moreValuesExist = data.dataProviders.validationRuleDataProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
    }

    var property = {
        propDisplayValue: '',
        propInternalValue: '',
        object: ''
    };
    if( result ) {
        for( var ii = 0; ii < result.length; ii++ ) {
            property = {
                propDisplayValue: result[ ii ].props.name.uiValues[ 0 ],
                propInternalValue: result[ ii ].uid,
                object: result[ ii ]
            };
            validationRuleList.push( property );
        }
    }
    return { validationRuleList, moreValuesExist };
};

export const initializeOccMgmtConfigurationBaselineView = ( data, subPanelContext ) => {
    exports.registerHandlerPreGetOccConfigurationBaselineExtPoints( );
    let defer = AwPromiseService.instance.defer();
    let contextKey = subPanelContext._configurationBaselineLocation.contextKey;

    let stateParams = AwStateService.instance.params;
    _registerContext( subPanelContext._configurationBaselineLocation, stateParams );
    _registerAceActiveContext( contextKey );
    //ensure the required objects are loaded
    _policyId = registerPolicy();
    let uidsForLoadObject = [ stateParams.uid, stateParams.pci_uid, stateParams.t_uid ];
    dataManagementService.loadObjects( uidsForLoadObject ).then( function() {
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdmService.getObject( uidsForLoadObject[ 0 ] ), null );
        let taskTitle = '';
        let lastModifiedConfigurationBaseline = '';
        let productOpenedForConfigurationBaseline = '';
        let mainObject;
        if( vmo.type === 'Fnd0ConfigurationBaseline' ) {
            mainObject = cdmService.getObject( vmo.uid );
        }
        if( vmo.props && vmo.props.object_string ) {
            taskTitle = ' ' + vmo.props.object_string.uiValues[ 0 ] + ' ';
        }
        if( vmo.props && vmo.props.last_mod_date ) {
            let lastModifiedValue = vmo.props.last_mod_date.dbValues[0];
            var date = new Date( lastModifiedValue );
            var dateInTime = date.getTime();

            var dateTimeFormat = dateTimeService.getSessionDateTimeFormat();
            var DateUIValue = dateTimeService.formatNonStandardDate( dateInTime, dateTimeFormat );
            var currentEffectiveDate = uwPropertyService.createViewModelProperty( DateUIValue,
                DateUIValue, 'STRING', DateUIValue, '' );

            lastModifiedConfigurationBaseline = currentEffectiveDate.dbValue;
        }
        if( vmo.props && vmo.props.fnd0Root ) {
            let productNameValue = vmo.props.fnd0Root.uiValues[0].split( ';' );
            productOpenedForConfigurationBaseline = ' ' + productNameValue[1] + ' ';
        }

        let headerTitle = ' |' +  taskTitle + ' | ' + productOpenedForConfigurationBaseline + ' ';

        let modelObjectsToOpen = [];
        modelObjectsToOpen.push( mainObject );
        appCtxSvc.updatePartialCtx( 'modelObjectsToOpen', modelObjectsToOpen );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.lastModifiedConfigurationBaseline', lastModifiedConfigurationBaseline );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.productOpenedForConfigurationBaseline', productOpenedForConfigurationBaseline );
        appCtxSvc.updatePartialCtx( 'occmgmtContext.taskTitle', headerTitle );
        defer.resolve( [ vmo ] );
    } );
    initializeOccMgmtServices( contextKey );
    return defer.promise;
};

let _registerContext = function( provider, stateParams ) {
    let requestPref = {
        savedSessionMode: 'ignore'
    };
    appCtxSvc.registerCtx( 'requestPref', requestPref );
    appCtxSvc.registerCtx( provider.contextKey, {
        currentState: {
            uid: stateParams.uid,
            pci_uid: stateParams.pci_uid,
            t_uid: stateParams.t_uid,
            configBaseline_uid: stateParams.configBaseline_uid
        },
        pwaSelectionModel: {},
        previousState: {},
        requestPref: requestPref,
        readOnlyFeatures: {},
        urlParams: provider.urlParams,
        expansionCriteria: {},
        isRowSelected: false,
        supportedFeatures: [],
        columnsToExclude:  provider.columnsToExclude,
        transientRequestPref: {
            startFreshNavigation: true
        },
        persistentRequestPref: {
            showExplodedLines: false
        }
    } );
};

let _registerAceActiveContext = function( contextKey ) {
    appCtxSvc.registerCtx( 'aceActiveContext', {
        key: contextKey,
        context: appCtxSvc.ctx[ contextKey ]
    } );
};

// Register the policy before SOA call
let registerPolicy = function() {
    return policySvc.register( {
        types: [ {
            name: 'Awb0ConditionalElement',
            properties: [ {
                name: 'awb0ArchetypeRevId'
            } ]
        } ]
    } );
};

export const initializeOccMgmtServices = ( contextKey ) => {
    occMgmtStateHandler.initializeOccMgmtStateHandler();
    aceUpdatePwaDisplayService.initialize( contextKey );
    aceTreeTableDataService.initialize();
    acePropertyPolicyService.registerPropertyPolicy();
    aceExpandBelowService.initialize();
    backgroundWorkingCtxTimer.initialize( contextKey );
    backgroundWorkingCtxSvc.initialize( contextKey );
    discoveryFilterService.setContextKey( contextKey );
    discoverySubscriptionService.initialize( contextKey );
};

export const initializeOccContext = ( data ) => {
    let stateParams = AwStateService.instance.params;
    let occContext = data.declViewModelJson.data.occContext.initialValues;
    occContext.currentState = {
        uid: stateParams.uid,
        pci_uid: stateParams.pci_uid,
        t_uid: stateParams.t_uid,
        configBaseline_uid: stateParams.configBaseline_uid
    };
    let configurationBaselineConfigParams = appCtxSvc.getCtx( 'configurationBaselineConfigParams' );
    if( configurationBaselineConfigParams ) {
        occContext.configContext = {
            r_uid: configurationBaselineConfigParams.currentRevRule,
            de: configurationBaselineConfigParams.effDate,
            ei_uid: configurationBaselineConfigParams.effEndItem,
            ue: configurationBaselineConfigParams.effUnitNo,
            eg_uids: configurationBaselineConfigParams.effectivityGroups,
            startDate: configurationBaselineConfigParams.startEffDates,
            fromUnit: configurationBaselineConfigParams.startEffUnits,
            endDate: configurationBaselineConfigParams.endEffDates,
            toUnit: configurationBaselineConfigParams.endEffUnits,
            var_uid: configurationBaselineConfigParams.variantRule,
            packSimilarElements: configurationBaselineConfigParams.packSimilarElements
        };
    }
    return {
        occContext: occContext ? occContext : data.atomicDataRef.occContext.getAtomicData()
    };
};


export const destroyOccmgmtConfigurationBaselineView = ( subPanelContext ) => {
    destroyOccMgmtServices( subPanelContext );
    appCtxSvc.unRegisterCtx( 'requestPref' );
    appCtxSvc.unRegisterCtx( 'taskbarfullscreen' );
    appCtxSvc.unRegisterCtx( 'configurationBaselineConfigParams' );
    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    // Unregister the required objects policy
    if( _policyId ) {
        policySvc.unregister( _policyId );
    }
};

let destroyOccMgmtServices = ( subPanelContext ) => {
    let contextKey = subPanelContext.occContext.viewKey;
    occMgmtStateHandler.destroyOccMgmtStateHandler( contextKey );
    aceUpdatePwaDisplayService.destroy( contextKey );
    aceTreeTableDataService.destroy();
    acePropertyPolicyService.unRegisterPropertyPolicy();
    aceExpandBelowService.destroy( contextKey );
    backgroundWorkingCtxTimer.reset();
    backgroundWorkingCtxSvc.reset( subPanelContext );
};

/**
  * This method update chip labels when props loaded event triggeres
  */
export let updateChipsOnPropsLoaded = function( subPanelContext ) {
    let occMgmtConfigurationBaselineResource = 'OccMgmtConfigBaselineConstants';
    let occMgmtConfigurationBaselineBundle = localeService.getLoadedText( occMgmtConfigurationBaselineResource );
    let occMgmtResource = 'OccurrenceManagementConstants';
    let occMgmtBundle = localeService.getLoadedText( occMgmtResource );

    let occMgmtContext = appCtxSvc.getCtx( 'occmgmtContext' );
    let currProductContextInfo = occMgmtContext ? occMgmtContext.productContextInfo : null;
    let occMgmtConfigurationBaselineChips = [];

    let dateEffArr = [];
    let unitEffArr = [];

    if( currProductContextInfo ) {
        let effectivityGroups = currProductContextInfo.props && currProductContextInfo.props.awb0EffectivityGroups;

        for( var i = 0; effectivityGroups && i < effectivityGroups.dbValues.length; i++ ) {
            let cdmObj = cdmService.getObject( currProductContextInfo.props.awb0EffectivityGroups.dbValues[i] );
            let effString = cdmObj.props.awp0CellProperties.dbValues[1];
            if( dateEffConfigration.isDateEffectivity( effString ) ) {
                dateEffArr.push( cdmObj.props.object_name.uiValues[ 0 ] );
            } else {
                unitEffArr.push( cdmObj.props.object_name.uiValues[ 0 ] );
            }
        }

        if( subPanelContext.occContext.baseModelObject && subPanelContext.occContext.baseModelObject.props.fnd0State && subPanelContext.occContext.baseModelObject.props.fnd0State.dbValues[0] === 'Open' ) {
            let inWorkChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineInWorkChip;
            occMgmtConfigurationBaselineChips.push( getChip( inWorkChipLabel ) );
        }

        if( subPanelContext.occContext.baseModelObject && subPanelContext.occContext.baseModelObject.props.fnd0State && subPanelContext.occContext.baseModelObject.props.fnd0State.dbValues[0] === 'Closed' ) {
            let closeChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineCloseChip;
            occMgmtConfigurationBaselineChips.push( getChip( closeChipLabel ) );
        }

        if( currProductContextInfo.props ) {
            //Revison Rule
            let revRule = currProductContextInfo.props.awb0CurrentRevRule;
            if( revRule.uiValues[ 0 ] ) {
                let revisionChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineRevisionChip;
                let currentRevRule = revRule.uiValues[ 0 ];
                revisionChipLabel = revisionChipLabel.replace( '{0}', currentRevRule );
                occMgmtConfigurationBaselineChips.push( getChip( revisionChipLabel ) );
            }

            //Date Effectivity
            let dateChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineDateChip;
            let currentEffDate = occMgmtBundle.occurrenceManagementTodayTitle;
            let effDate = currProductContextInfo.props.awb0EffDate;
            if( dateEffArr.length > 0 ) {
                currentEffDate = dateEffArr[ 0 ];
            } else if( effDate.uiValues[ 0 ] ) {
                currentEffDate = effDate.uiValues[ 0 ];
            }
            dateChipLabel = dateChipLabel.replace( '{0}', currentEffDate );
            occMgmtConfigurationBaselineChips.push( getChip( dateChipLabel ) );

            //Unit
            if( occMgmtContext.supportedFeatures.Awb0UnitEffectivityConfigFeature ) {
                let unit = currProductContextInfo.props.awb0EffUnitNo;
                let unitChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineUnitChip;
                if( unitEffArr.length > 1 ) {
                    unitChipLabel = unitChipLabel.replace( '{0}', occMgmtBundle.multipleGroups );
                    occMgmtConfigurationBaselineChips.push( getChip( unitChipLabel ) );
                } else if( unitEffArr.length > 0 ) {
                    unitChipLabel = unitChipLabel.replace( '{0}', unitEffArr[ 0 ] );
                    occMgmtConfigurationBaselineChips.push( getChip( unitChipLabel ) );
                } else if( unit.uiValues[ 0 ] ) {
                    let currentUnit = unit.uiValues[ 0 ];
                    unitChipLabel = unitChipLabel.replace( '{0}', currentUnit );
                    occMgmtConfigurationBaselineChips.push( getChip( unitChipLabel ) );
                }
            }

            //End Item
            let endItem = currProductContextInfo.props.awb0EffEndItem;
            let topProduct = currProductContextInfo.props.awb0Product;
            if( endItem.uiValues[ 0 ] ) {
                let endItemObj = cdmService.getObject( endItem.dbValues[0] );
                let topProdObj = cdmService.getObject( topProduct.dbValues[0] );
                let effEndItemStr = endItemObj.props.object_string.dbValues[ 0 ];
                let topStr = topProdObj.props.items_tag.uiValues[ 0 ];
                if( effEndItemStr !== topStr ) {
                    let currentEndItem = endItem.uiValues[ 0 ];
                    let endItemChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineEndItemChip;
                    endItemChipLabel = endItemChipLabel.replace( '{0}', currentEndItem );
                    occMgmtConfigurationBaselineChips.push( getChip( endItemChipLabel ) );
                }
            }

            //Variant Rule
            if( occMgmtContext.supportedFeatures.Awb0VariantFeature ) {
                let variant = currProductContextInfo.props.awb0VariantRules;
                if( variant.uiValues[ 0 ] ) {
                    let currentVariant = variant.uiValues[ 0 ];
                    let variantChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineVariantChip;
                    variantChipLabel = variantChipLabel.replace( '{0}', currentVariant );
                    occMgmtConfigurationBaselineChips.push( getChip( variantChipLabel ) );
                }
            }

            //Expansion Rule
            let expansion = currProductContextInfo.props.awb0ClosureRule;
            if( expansion.uiValues[ 0 ] ) {
                let currentExpansion = expansion.uiValues[ 0 ];
                let expansionChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineExpansionChip;
                expansionChipLabel = expansionChipLabel.replace( '{0}', currentExpansion );
                occMgmtConfigurationBaselineChips.push( getChip( expansionChipLabel ) );
            }

            //View Type
            // let viewType = currProductContextInfo.props.awb0ViewType;
            // if( viewType.uiValues[ 0 ] ) {
            //     let currentViewType = viewType.uiValues[ 0 ];
            //     let viewTypeChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselineViewTypeChip;
            //     viewTypeChipLabel = viewTypeChipLabel.replace( '{0}', currentViewType );
            //     occMgmtConfigurationBaselineChips.push( getChip( viewTypeChipLabel ) );
            // }

            //Partition Scheme
            if( occMgmtContext.supportedFeatures.Fgf0OrganizationSchemeFeature ) {
                let partitionScheme = currProductContextInfo.props.fgf0PartitionScheme;
                if( partitionScheme.uiValues[ 0 ] ) {
                    let currentPartitionScheme = partitionScheme.uiValues[ 0 ];
                    let partitionChipLabel = occMgmtConfigurationBaselineBundle.OccMgmtConfigurationBaselinePartitionChip;
                    partitionChipLabel = partitionChipLabel.replace( '{0}', currentPartitionScheme );
                    occMgmtConfigurationBaselineChips.push( getChip( partitionChipLabel ) );
                }
            }
        }
    }

    return occMgmtConfigurationBaselineChips;
};

let getChip = ( value ) => {
    return {
        chipType: 'STATIC',
        labelDisplayName: value
    };
};

export let getConfigBaselineTemplateList = function( templateList ) {
    let listModels = [];

    _.forEach( templateList, function( template ) {
        let listModel = {
            propDisplayValue: '',
            propDisplayDescription: '',
            dispValue: '',
            propInternalValue: ''
        };

        if( cmm.containsType( template ) ) {
            let type = cmm.getType( template );

            listModel.propDisplayValue = type.displayName;
            listModel.propInternalValue = type.name;
            listModel.dispValue = type.displayName;
        } else {
            listModel.propDisplayValue = template;
            listModel.propInternalValue = template;
            listModel.dispValue = template;
        }

        listModels.push( listModel );
    } );

    return listModels;
};

export let initialize = function() {
    registerHandlerPostGetOccConfigurationBaselineExtPoints();
    let ctx = appCtxSvc.getCtx();
    if( ctx.preferences.EnableConfigurationBaseline && ctx.preferences.EnableConfigurationBaseline[0] === true || ctx.preferences.EnableConfigurationBaseline && ctx.preferences.EnableConfigurationBaseline[0].toLowerCase() === 'true' ) {
        _eventSubDefs.push( eventBus.subscribe( 'Awp0ShowSaveAs.saveAsComplete', function( eventData ) {
            if( eventData.scope.subPanelContext.selectionData && eventData.scope.subPanelContext.selectionData.selected[0].type === 'Fnd0ConfigurationBaseline' ||
            eventData.scope.subPanelContext.SelectedObjects && eventData.scope.subPanelContext.SelectedObjects[0].type === 'Fnd0ConfigurationBaseline' ||
            eventData.scope.subPanelContext.reviseSaveAsInfo && eventData.scope.subPanelContext.reviseSaveAsInfo.SelectedObjects[0].type === 'Fnd0ConfigurationBaseline' ) {
                appCtxSvc.registerCtx( 'openConfigBaselineInTaskBasedUiAfterRevise', eventData );
            }
        } ) );
    }
};

export let destroy = function() {
    let ctx = appCtxSvc.getCtx();
    if( ctx.preferences.EnableConfigurationBaseline && ( ctx.preferences.EnableConfigurationBaseline[0] === true || ctx.preferences.EnableConfigurationBaseline[0].toLowerCase() === 'true' ) ) {
        _.forEach( _eventSubDefs, function( subDef ) {
            eventBus.unsubscribe( subDef );
        } );
    }
};

export let updateHeaderDataForConfigBaselinePanel = function( occContext ) {
    return appCtxSvc.ctx.sublocation.clientScopeURI === 'Awb0OccurrenceManagement' ? occContext.rootElement.props.object_string.uiValues[ 0 ] : appCtxSvc.ctx.selected.props.object_string.uiValues[ 0 ];
};

// For the case when we create a baseline for structure where top is also getting revised we need to get the new revised top revision from baseline and then statically expand the new top
// With current code when we close the baseline we have revised the structure including top but when we trigger getOccurrence4 SOA we are still sending the old top revision in focusOccurrenceInput.
// This code sends focusOccurrenceInput and parentElement as null.
export let configBaselineCloseComplete = function( configBaselineUid ) {
    var urlParams = {};
    urlParams.uid = configBaselineUid;
    urlParams.configBaseline_uid = configBaselineUid;
    AwStateService.instance.go( 'com_siemens_splm_client_configbaseline', urlParams, { inherit: false, reload: true } );
};

export let releaseProcessNameInputForCloseBaselineSOA = function( data ) {
    var releaseProcessName;
    if ( data.actionOnWorkingContent.dbValue === 2 ) {
        releaseProcessName = '';
    } else {
        releaseProcessName = data.closureWorkflow.dbValue;
    }
    return  releaseProcessName;
};

/**
* Pre getOccurrences SOA extension point registration
*/
const registerHandlerPreGetOccConfigurationBaselineExtPoints = function( ) {
    let conditionFunction = function( _loadInput, occContext ) {
        if( occContext && occContext.currentState && occContext.currentState.configBaseline_uid !== undefined ) {
            return true;
        }
        return false;
    };
    let inputParamFunc = function( _loadInput, _occContext, _currentContext, soaInput ) {
        soaInput.inputData.requestPref.manageBaseline = [ 'true' ];
    };
    let inputParamExtPoint = {
        key : 'configurationBaselineHandler', //unique identifier
        condition: conditionFunction,
        populateGetOccInput: inputParamFunc
    };
    aceGetService.registerGetOccInputProvider( inputParamExtPoint );
};

let registerHandlerPostGetOccConfigurationBaselineExtPoints = function() {
    // variable to hold "Open" or "RefreshUrl" cases type. Undefined if neither is true.
    let openOrURLRefresh = undefined;

    // Post getOccurrences response handler registration
    let postGetOccConditionFunc = function( soaInput, treeLoadInput ) {
        openOrURLRefresh = treeLoadInput.openOrUrlRefreshCase;
        return true;
    };
    let postGetOccFunc = function( _response, finalOccContextValue, inputOccContext, treeLoadOutput ) {
        // Set retainTreeExpansionStatesForOpen to false if we are in Configuration Baseline
        // TODO: We need to remove this extra processing once the jitterFreeRefreshAndBackButton feature key gets implemented
        // for configuration baseline objects as well. This work is getting tracked via story:LCS-1112305
        if( !_.isUndefined( openOrURLRefresh ) && openOrURLRefresh === 'open' ) {
            _setDoNotRetainTreeExpansionStateOnOpen( treeLoadOutput );
            openOrURLRefresh = undefined;
        }
    };
    let postGetOccExtPoint = {
        key : 'configBaselinePostGetOccHandler', //unique identifier
        condition: postGetOccConditionFunc,
        addOccContextAtomicDataForUpdate: postGetOccFunc
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( postGetOccExtPoint );
    // End Post getOccurrences response handler registration
};

var _setDoNotRetainTreeExpansionStateOnOpen = ( treeLoadOutput ) => {
    var isJitterFreeBackBtnSupported = occmgmtUtils.isFeatureSupported( treeLoadOutput.productContextInfo, 'Awb0JitterFreeRefreshBackButton' );
    if( !isJitterFreeBackBtnSupported &&
             treeLoadOutput.openedObjectType === 'ConfigBaseline'  ) {
        treeLoadOutput.retainTreeExpansionStatesForOpen = false;
    }
};

export let launchConfigurationBaselineInCompare = function() {
    let toParams = {};
    let _mselected = appCtxSvc.getCtx( 'mselected' );
    let selectedObj = _mselected[ 0 ];
    if( selectedObj.uid !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdmService.getObject( selectedObj.uid );
    }
    let sourceSelectedUid = selectedObj.uid;

    selectedObj = _mselected[ 1 ];
    if( selectedObj.uid !== undefined ) { // We got an Awb0Element as input
        selectedObj = cdmService.getObject( selectedObj.uid );
    }

    let toUpdate = {
        compareContext: {
            autoOpenComparePanel: true,
            isMultiStructureFirstLaunch: true
        },
        resetTreeExpansionState: true,
        requestPref: {
            dataFilterMode: 'compare'
        },
        compareList: {
            sourceSelection: sourceSelectedUid,
            targetSelection: selectedObj.uid
        }
    };

    occmgmtUtils.updateValueOnCtxOrState( '', toUpdate, '' );

    var compareList = appCtxSvc.getCtx( 'compareList' );
    toParams.uid = compareList.sourceSelection;
    toParams.uid2 = compareList.targetSelection;
    toParams.pci_uid = '';
    toParams.pci_uid2 = '';

    var transitionTo = 'com_siemens_splm_clientfx_tcui_xrt_showMultiObject';
    LocationNavigationService.instance.go( transitionTo, toParams, {} );
};

export default exports = {
    prePopulateConfigBaselineName,
    getBackingObject,
    createInputForCreateConfigurationBaselineSOA,
    getPagedValidationRuleList,
    initializeOccMgmtConfigurationBaselineView,
    initializeOccMgmtServices,
    initializeOccContext,
    destroyOccmgmtConfigurationBaselineView,
    updateChipsOnPropsLoaded,
    getConfigBaselineTemplateList,
    initialize,
    destroy,
    getLOVList,
    updateHeaderDataForConfigBaselinePanel,
    updateConfigurationBaselineNameField,
    configBaselineCloseComplete,
    releaseProcessNameInputForCloseBaselineSOA,
    launchConfigurationBaselineInCompare,
    registerHandlerPreGetOccConfigurationBaselineExtPoints,
    registerHandlerPostGetOccConfigurationBaselineExtPoints
};
