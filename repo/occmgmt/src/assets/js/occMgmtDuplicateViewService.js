// Copyright (c) 2022 Siemens

/**
 * @module js/occMgmtDuplicateViewService
 */
import AwStateService from 'js/awStateService';
import dataManagementService from 'soa/dataManagementService';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import appCtxSvc from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import policySvc from 'soa/kernel/propertyPolicyService';
import occMgmtDuplicateCellService from 'js/occMgmtDuplicateCellService';
import acePropertyPolicyService from 'js/acePropertyPolicyService';
import occMgmtStateHandler from 'js/occurrenceManagementStateHandler';
import aceTreeTableDataService from 'js/aceTreeTableDataService';
import aceUpdatePwaDisplayService from 'js/aceUpdatePwaDisplayService';
import aceExpandBelowService from 'js/aceExpandBelowService';
import backgroundWorkingCtxTimer from 'js/aceBackgroundWorkingContextTimerService';
import backgroundWorkingCtxSvc from 'js/aceBackgroundWorkingContextService';
import occMgmtDuplicateActionService from 'js/occMgmtDuplicateActionService';
import localeService from 'js/localeService';
import cdmService from 'soa/kernel/clientDataModel';
import dateEffConfigration from 'js/dateEffectivityConfigurationService';
import preferenceSvc from 'soa/preferenceService';
import soaSvc from 'soa/kernel/soaService';

let exports = {};

/** Policy ID of required loaded objects */
let _policyId = null;

let initialPrefValues = {};

export const initializeOccMgmtDuplicateView = ( subPanelContext ) => {
    let defer = AwPromiseService.instance.defer();
    let contextKey = subPanelContext._duplicateLocation.contextKey;

    let stateParams = AwStateService.instance.params;
    _registerContext( subPanelContext._duplicateLocation, stateParams );
    _registerAceActiveContext( contextKey );
    //ensure the required objects are loaded
    _policyId = registerPolicy();
    let uidsForLoadObject = [ stateParams.uid, stateParams.pci_uid, stateParams.t_uid ];
    dataManagementService.loadObjects( uidsForLoadObject ).then( function() {
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( clientDataModel.getObject( uidsForLoadObject[ 0 ] ), null );
        let taskTitle = '';
        if( vmo.props && vmo.props.object_string ) {
            taskTitle = vmo.props.object_string.uiValues[ 0 ];
        }
        appCtxSvc.updatePartialCtx( 'occmgmtContext.taskTitle', taskTitle );
        defer.resolve( [ vmo ] );
    } );
    initializeOccMgmtServices( contextKey );
    return defer.promise;
};

export const initializeOccContext = ( data ) => {
    let stateParams = AwStateService.instance.params;
    let occContext = data.declViewModelJson?.data?.occContext?.initialValues || {};
    occContext.currentState = {
        uid: stateParams.uid,
        pci_uid: stateParams.pci_uid,
        t_uid: stateParams.t_uid
    };
    let duplicateConfigParams = appCtxSvc.getCtx( 'duplicateConfigParams' );
    if( duplicateConfigParams ) {
        occContext.configContext = {
            r_uid: duplicateConfigParams.currentRevRule || null,
            de: duplicateConfigParams.effDate || null,
            ei_uid: duplicateConfigParams.effEndItem || null,
            ue: duplicateConfigParams.effUnitNo || null,
            eg_uids: duplicateConfigParams.effectivityGroups || [],
            startDate: duplicateConfigParams.startEffDates || null,
            fromUnit: duplicateConfigParams.startEffUnits || null,
            endDate: duplicateConfigParams.endEffDates || null,
            toUnit: duplicateConfigParams.endEffUnits || null,
            var_uid: duplicateConfigParams.variantRule || null,
            packSimilarElements: duplicateConfigParams.packSimilarElements || null
        };
    }
    occContext.cellRenderers = [ occMgmtDuplicateCellService._duplicateEditCellRender, occMgmtDuplicateCellService._duplicateNonEditCellRender ];
    return {
        occContext: occContext || data.atomicDataRef?.occContext?.getAtomicData() || {}
    };
};

export const initializeOccMgmtServices = ( contextKey ) => {
    occMgmtStateHandler.initializeOccMgmtStateHandler();
    occMgmtDuplicateActionService.initialize( contextKey );
    aceUpdatePwaDisplayService.initialize( contextKey );
    aceTreeTableDataService.initialize();
    acePropertyPolicyService.registerPropertyPolicy();
    aceExpandBelowService.initialize();
    backgroundWorkingCtxTimer.initialize( contextKey );
    backgroundWorkingCtxSvc.initialize( contextKey );
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

let _registerContext = function( provider, stateParams ) {
    let requestPref = {
        savedSessionMode: 'ignore'
    };
    appCtxSvc.registerCtx( 'requestPref', requestPref );
    appCtxSvc.registerCtx( provider.contextKey, {
        currentState: {
            uid: stateParams.uid,
            pci_uid: stateParams.pci_uid,
            t_uid: stateParams.t_uid
        },
        pwaSelectionModel: {},
        previousState: {},
        requestPref: requestPref,
        readOnlyFeatures: {},
        urlParams: provider.urlParams,
        expansionCriteria: {},
        isRowSelected: false,
        supportedFeatures: [],
        runInBackgroundValue: true,
        transientRequestPref: {},
        persistentRequestPref: {
            showExplodedLines: false
        },
        isDuplicateEnabled:true
    } );
};

/**
 * Register ACE active context
 *
 * @param {string} contextKey - context key
 */
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
        },
        {
            name: 'Awb0Element',
            properties: [ {
                name: 'awb0UnderlyingObjectType'
            } ]
        } ]
    } );
};

export const destroyOccmgmtDuplicateView = ( subPanelContext ) => {
    destroyOccMgmtServices( subPanelContext );
    let prefNames = [ 'PSEShowSuppressedOccsPref', 'PSEShowUnconfigdEffPref', 'PSEShowUnconfigdVarPref' ];
    let prefValues = [ initialPrefValues.PSEShowSuppressedOccsPref, initialPrefValues.PSEShowUnconfigdEffPref, initialPrefValues.PSEShowUnconfigdVarPref ];
    preferenceSvc.setStringValues( prefNames, prefValues );
    appCtxSvc.unRegisterCtx( subPanelContext.contextKey );
    appCtxSvc.unRegisterCtx( 'requestPref' );
    appCtxSvc.unRegisterCtx( 'taskbarfullscreen' );
    appCtxSvc.unRegisterCtx( 'duplicateConfigParams' );
    appCtxSvc.unRegisterCtx( 'aceActiveContext' );
    appCtxSvc.unRegisterCtx( 'isDuplicateViewLoadComplete' );
    // Unregister the required objects policy
    if( _policyId ) {
        policySvc.unregister( _policyId );
    }
};

export const setConfigOnContext = () => {
    let defer = AwPromiseService.instance.defer();
    let currProductContextInfo = appCtxSvc.getCtx( 'occmgmtContext' ).productContextInfo;
    if( currProductContextInfo && currProductContextInfo.props) {
        let currentRevRule = currProductContextInfo.props.awb0CurrentRevRule?.dbValues?.[0] || null;
        let effDate = currProductContextInfo.props.awb0EffDate?.dbValues?.[0] || null;
        let effEndItem = currProductContextInfo.props.awb0EffEndItem?.dbValues?.[0] || null;
        let effUnitNo = currProductContextInfo.props.awb0EffUnitNo?.dbValues?.[0] || null;
        let effectivityGroups = currProductContextInfo.props.awb0EffectivityGroups?.dbValues || [];
        let startEffDates = currProductContextInfo.props.awb0StartEffDates?.dbValues?.[0] || null;
        let startEffUnits = currProductContextInfo.props.awb0StartEffUnits?.dbValues?.[0] || null;
        let endEffDates = currProductContextInfo.props.awb0EndEffDates?.dbValues?.[0] || null;
        let endEffUnits = currProductContextInfo.props.awb0EndEffUnits?.dbValues?.[0] || null;
        let variantRule = currProductContextInfo.props.awb0CurrentVariantRule?.dbValues?.[0] || null;
        let packSimilarElement = currProductContextInfo.props.awb0PackSimilarElements?.dbValues?.[0] || null;

        let _configParams = {
            currentRevRule: currentRevRule,
            effDate: effDate,
            effEndItem: effEndItem,
            effUnitNo: effUnitNo,
            effectivityGroups: effectivityGroups,
            startEffDates: startEffDates,
            startEffUnits: startEffUnits,
            endEffDates: endEffDates,
            endEffUnits: endEffUnits,
            variantRule: variantRule,
            packSimilarElements: packSimilarElement === '1'
        };
        appCtxSvc.updateCtx( 'duplicateConfigParams', _configParams );
    }
    return defer.resolve({});
};

/**
 * This method update chip labels when props loaded event triggeres
 */
export let updateChipsOnPropsLoaded = function() {
    let occMgmtDuplicateResource = 'OccMgmtDuplicateConstants';
    let occMgmtDuplicateBundle = localeService.getLoadedText( occMgmtDuplicateResource );
    let occMgmtResource = 'OccurrenceManagementConstants';
    let occMgmtBundle = localeService.getLoadedText( occMgmtResource );

    let occMgmtContext = appCtxSvc.getCtx( 'occmgmtContext' );
    let currProductContextInfo = occMgmtContext.productContextInfo;
    let occMgmtDuplicateChips = [];

    let dateEffArr = [];
    let unitEffArr = [];
    let effectivityGroups = currProductContextInfo.props.awb0EffectivityGroups;

    if( effectivityGroups ) {
        for( var i = 0; i < effectivityGroups.dbValues.length; i++ ) {
            let cdmObj = cdmService.getObject( currProductContextInfo.props.awb0EffectivityGroups.dbValues[ i ] );
            let effString = cdmObj.props.awp0CellProperties.dbValues[ 1 ];
            if( dateEffConfigration.isDateEffectivity( effString ) ) {
                dateEffArr.push( cdmObj.props.object_name.uiValues[ 0 ] );
            } else {
                unitEffArr.push( cdmObj.props.object_name.uiValues[ 0 ] );
            }
        }
    }

    if( currProductContextInfo && currProductContextInfo.props ) {
        //Revison Rule
        let revRule = currProductContextInfo.props.awb0CurrentRevRule;
        if( revRule.uiValues[ 0 ] ) {
            let revisionChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateRevisionChip;
            let currentRevRule = revRule.uiValues[ 0 ];
            revisionChipLabel = revisionChipLabel.replace( '{0}', currentRevRule );
            occMgmtDuplicateChips.push( getChip( revisionChipLabel ) );
        }
        //Date Effectivity
        let dateChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateDateChip;
        let currentEffDate = occMgmtBundle.occurrenceManagementTodayTitle;
        let effDate = currProductContextInfo.props.awb0EffDate;
        if( dateEffArr.length > 0 ) {
            currentEffDate = dateEffArr[ 0 ];
        } else if( effDate.uiValues[ 0 ] ) {
            currentEffDate = effDate.uiValues[ 0 ];
        }
        dateChipLabel = dateChipLabel.replace( '{0}', currentEffDate );
        occMgmtDuplicateChips.push( getChip( dateChipLabel ) );

        //Unit
        if( occMgmtContext.supportedFeatures.Awb0UnitEffectivityConfigFeature ) {
            let unit = currProductContextInfo.props.awb0EffUnitNo;
            let unitChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateUnitChip;
            if( unitEffArr.length > 0 ) {
                unitChipLabel = unitChipLabel.replace( '{0}', unitEffArr[ 0 ] );
                occMgmtDuplicateChips.push( getChip( unitChipLabel ) );
            } else if( unit.uiValues[ 0 ] ) {
                let currentUnit = unit.uiValues[ 0 ];
                unitChipLabel = unitChipLabel.replace( '{0}', currentUnit );
                occMgmtDuplicateChips.push( getChip( unitChipLabel ) );
            }
        }

        //Variant Rule
        if( occMgmtContext.supportedFeatures.Awb0VariantFeature ) {
            let variant = currProductContextInfo.props.awb0VariantRules;
            if( variant.uiValues[ 0 ] ) {
                let currentVariant = variant.uiValues[ 0 ];
                let variantChipLabel = occMgmtDuplicateBundle.OccMgmtDuplicateVariantChip;
                variantChipLabel = variantChipLabel.replace( '{0}', currentVariant );
                occMgmtDuplicateChips.push( getChip( variantChipLabel ) );
            }
        }

        //Arrangement TODO - We will expose it while doing story LCS-650610
        // let arrangement = currProductContextInfo.props.awb0AppliedArrangement;
        // if( arrangement.uiValues[ 0 ] ) {
        //     let currentArrangement = arrangement.uiValues[ 0 ];
        //     let variantArrangementLabel = occMgmtDuplicateBundle.OccMgmtDuplicateArrangementChip;
        //     variantArrangementLabel = variantArrangementLabel.replace( '{0}', currentArrangement );
        //     occMgmtDuplicateChips.push( getChip( variantArrangementLabel ) );
        // }
    }
    return occMgmtDuplicateChips;
};

/**
 * This method is for saveasandreplace panel
 * to make replaceTextBox required .
 * @param {*} fields
 * @param {*} fieldName
 */
export let updateField = function( fields, fieldName ) {
    let fieldToUpdate = fields[ fieldName ];
    if( fields.withTextBox.value && fields.replaceTextBox.value === '' ) {
        fieldToUpdate.update( fields.replaceTextBox.value, { isRequired: true } );
    }
};

let getChip = ( value ) => {
    return {
        chipType: 'STATIC',
        labelDisplayName: value
    };
};

export const cachePreferences = () => {
    let defer = AwPromiseService.instance.defer();
    let prefsToGet = [ 'PSEShowSuppressedOccsPref', 'PSEShowUnconfigdEffPref', 'PSEShowUnconfigdVarPref' ];
    soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: prefsToGet,
        includePreferenceDescriptions: false
    }, {} ).then( ( result ) => {
        initialPrefValues = {};
        if( result && result.response ) {
            result.response.forEach( ( preference ) => {
                initialPrefValues[ preference.definition.name ] = preference.values.values;
            } );
        }
        preferenceSvc.setStringValues( [ 'PSEShowSuppressedOccsPref', 'PSEShowUnconfigdEffPref', 'PSEShowUnconfigdVarPref' ], [
            [ 'false' ],
            [ 'false' ],
            [ 'false' ]
        ] );
        defer.resolve( {} );
    } );
    return defer.promise;
};

/**
 * Gets ObjectSetUri from occContext and returns it to update occDataProvider.
 * @param {object} subPanelContext - subPanelContext
 */
export let updateObjectSetUri = function( subPanelContext ) {
    let objectSetUri = subPanelContext.clientScopeURI;
    // Update the loadedVMOTypesForSoaInput for the getEditablePropsForElement SOA
    if( !occMgmtDuplicateActionService.loadedVMOTypesForSoaInput.has( subPanelContext.baseSelection.type ) ) {
        occMgmtDuplicateActionService.loadedVMOTypesForSoaInput.set( subPanelContext.baseSelection.type, subPanelContext.baseSelection.props.awb0UnderlyingObjectType.dbValues );
    }
    return { objectSetUri };
};

export let checkIfCoordSysTypeSelected = function( dataProvider ) {
    let isCoordSysTypeSelected = false;
    dataProvider.selectedObjects.forEach( selectedElement => {
        if( isCoordSysTypeSelected || selectedElement.props.awb0UnderlyingObjectType.dbValues[ 0 ] === 'Fnd0CoordSystemRevision' ) {
            return isCoordSysTypeSelected = true;
        }
        return false;
    } );
    appCtxSvc.updatePartialCtx( 'occmgmtContext.isCoordSysTypeSelected', isCoordSysTypeSelected );
};

export default exports = {
    initializeOccMgmtDuplicateView,
    initializeOccContext,
    initializeOccMgmtServices,
    destroyOccmgmtDuplicateView,
    setConfigOnContext,
    updateChipsOnPropsLoaded,
    updateField,
    cachePreferences,
    updateObjectSetUri,
    checkIfCoordSysTypeSelected
};
