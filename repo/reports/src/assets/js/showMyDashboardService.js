// Copyright (c) 2022 Siemens

/**
 * JS Service defined to handle Show My Dashboard related method execution only.
 *
 * @module js/showMyDashboardService
 */
import appCtxService from 'js/appCtxService';
import $ from 'jquery';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import soaService from 'soa/kernel/soaService';
import reportsCommSrvc from 'js/reportsCommonService';
import modelPropertySvc from 'js/modelPropertyService';
import viewModelService from 'js/viewModelObjectService';
import soa_kernel_propertyPolicyService from 'soa/kernel/propertyPolicyService';
import cdm from 'soa/kernel/clientDataModel';
import iconSvc from 'js/iconService';
import awPromiseService from 'js/awPromiseService';
import dmSvc from 'soa/dataManagementService';
import shareTemplateService from 'js/ShareTemplateService';
import localeService from 'js/localeService';
import { updateAtomicDataValue } from 'js/addObjectUtils';

var exports = {};
var _reportsList = [];
var _pageSize = 8;
var _totalLoaded = -1;
var _previous = 'previous';
var _next = 'next';
var _add = 'add';
var _reset = 'reset';
const sourceObjectStr = '"sourceObjUid":"';
const activeWorkspaceStr = 'Active Workspace';
const reportDashboardReset = 'reportDashboard.reset';

export let getReportDefinitionSOAInput = function( subPanelContext, dashboardTemplateList, reportIdInput = 'reportDefinitionId' ) {
    let repIdList = [];
    var preference = appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report;
    var preference_Name = reportsCommSrvc.getReportDashboardPrefName();
    if( subPanelContext && subPanelContext.preferenceName && appCtxService.ctx.preferences[ subPanelContext.preferenceName ] !== undefined ) {
        preference_Name = subPanelContext.preferenceName;
        preference = appCtxService.ctx.preferences[ preference_Name ];
    }
    if( 'preferences' in appCtxService.ctx && preference_Name in appCtxService.ctx.preferences ) {
        repIdList.push.apply( repIdList, preference );
    }

    // preparing rdList with selected tab object
    if( dashboardTemplateList ) {
        // set empty list
        repIdList = [];
        dashboardTemplateList.forEach( tabRep => {
            repIdList.push( tabRep );
        } );
    }

    // scenario for no report configured
    if( repIdList.length === 1 && repIdList[0].length === 0 ) {
        repIdList = [];
    }

    var soaInput = [];
    if( repIdList.length > 0 ) {
        repIdList.forEach( idVal => {
            var val = JSON.parse( idVal.substring( idVal.indexOf( ':' ) + 1, idVal.length ) );
            var inputStr = {};
            inputStr[reportIdInput] = val.ID;
            if( reportIdInput === 'reportID' ) {
                inputStr.reportUID = '';
                inputStr.reportSource = '';
            }
            soaInput.push( inputStr );
        } );
    } else{
        var inputStr = {};
        inputStr[reportIdInput] = 'RANDOME###$$$$';
        inputStr.reportUID = '';
        inputStr.reportSource = '';
        soaInput.push( inputStr );
    }
    reportsCommSrvc.setupReportPersistCtx( preference_Name );
    return soaInput;
};

export let getReportDefinitionValList = async function( response, searchData ) {
    const nwSearchData = searchData.getValue();
    let dashboardTemplateList;
    if( nwSearchData.dashboardTabObject ) {
        dashboardTemplateList = nwSearchData.dashboardTabObject.props.rb0DashboardTemplatesList.dbValues;
    }
    return getReportDefinitions( response, searchData, dashboardTemplateList ).then( function( { reportdefinitions } ) {
        _reportsList = [];
        _.forEach( reportdefinitions, ( rDef ) => {
            // Check if rDef is not null or undefined before accessing its properties
            if ( rDef && rDef.props && rDef.props.rd_type && rDef.props.rd_type.dbValues && rDef.props.rd_type.dbValues[0] !== '1' ) {
                let vmo = cdm.getObject( rDef.reportUid );
                _reportsList.push( vmo );
            }
        } );
        if( searchData ) {
            const newSearchData = searchData.getValue();
            newSearchData.totalFound = _reportsList.length;
            searchData.update( newSearchData );
        }
        return {
            reportdefinitions: _reportsList
        };
    } );
};

export let setupDashboardReportViewer = function( data ) {
    data.urlFrameSize = getFrameSize();
    $( 'aw-secondary-workarea' ).find( '.aw-jswidget-tabBar' ).addClass( 'aw-viewerjs-hideContent' );
};

var getFrameSize = function() {
    var areas = document.getElementsByTagName( 'aw-secondary-workarea' );
    var totalHeight = 0; // Default value
    var totalWidth = 0;  // Default value

    if( areas.length > 0 ) {
        totalHeight = areas[ 0 ].clientHeight - 23;
        totalWidth = areas[ 0 ].clientWidth - 20;
    }

    return {
        height: totalHeight,
        width: totalWidth
    };
};

//Get index of report in preference  list
export let getPreferenceIndex = function( prefvalList, rd_id ) {
    for ( var j = 0; j < prefvalList.length; j++ ) {
        if ( prefvalList[j].startsWith( rd_id ) ) {
            return j;
        }
    }
    return -1;
};

//Get preference values according to prefernce name provided
let getReportsListFromPreference = ( preferenceName )=> {
    var prefValList; var  currentPrefName;
    if( preferenceName ) {
        prefValList = appCtxService.ctx.preferences[ preferenceName ];
        currentPrefName = preferenceName;
    } else {
        prefValList = appCtxService.ctx.preferences.REPORT_AW_MyDashboard_TC_Report;
        currentPrefName = reportsCommSrvc.getReportDashboardPrefName();
    }
    return { currentPrefValList: prefValList, preference_Name: currentPrefName };
};

//Preparing inputdata for soa of updating preferences values
let inputDataForPreferenceUpdateSoa = ( currentPrefValList, preference_Name )=> {
    var setLocation = [];
    setLocation.push( {
        location: {
            object: '',
            location: 'User'
        },
        preferenceInputs: {
            preferenceName: preference_Name,
            values: currentPrefValList.length === 0 ? null : currentPrefValList
        }
    } );
    return setLocation;
};

//Calling SOA to update prefernce value
let callSoaForPreferenceUpdate = ( preference_Name, currentPrefValList, crntMyDashboardCtxList, state, selectedReportDef, index, operation, showAddToDashboardCommand )=> {
    var inputData = {
        setPreferenceIn: inputDataForPreferenceUpdateSoa( currentPrefValList, preference_Name )
    };
    return soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'setPreferencesAtLocations', inputData ).then(
        function( ) {
            if( showAddToDashboardCommand !== null ) {
                appCtxService.updatePartialCtx( 'showAddToDashboardCommand', showAddToDashboardCommand );
            }
            appCtxService.updatePartialCtx( 'preferences.' + preference_Name, currentPrefValList.length === 0 ? null : currentPrefValList );
            crntMyDashboardCtxList && appCtxService.updatePartialCtx( reportsCommSrvc.getCtxMyDashboardList(), crntMyDashboardCtxList );
            if( state && selectedReportDef ) {
                var newSearchState = state.getValue();
                newSearchState.reportDashboard = { reportDef: selectedReportDef, operation: operation, tileIndex: index };
                state.update( newSearchState );
            }else if( selectedReportDef ) {
                eventBus.publish( 'reportDashboard.update', { reportDef: selectedReportDef, operation: operation, tileIndex: index } );
            }
        } );
};

//TODO Refactor
export let removeSelectedDashboardReport = function( selectedReportDef, preferenceName, state ) {
    var { currentPrefValList, preference_Name } = getReportsListFromPreference( preferenceName );
    var chkPrefValue = selectedReportDef.props.rd_type.dbValues[ 0 ] === '1' ? selectedReportDef.props.rd_id.dbValues[ 0 ] + selectedReportDef.props.rd_sourceObject.dbValue : selectedReportDef.props.rd_id.dbValues[ 0 ];
    var index = getPreferenceIndex( currentPrefValList, chkPrefValue );
    currentPrefValList.splice( index, 1 );
    var crntList = appCtxService.getCtx( reportsCommSrvc.getCtxMyDashboardList() );
    crntList?.splice( index, 1 );
    return callSoaForPreferenceUpdate( preference_Name, currentPrefValList, crntList, state, selectedReportDef, index, null, true );
};

//TODO Refactor
export let addSelectedReportToDashboard = function( selectedReportDef, preferenceName, sourceUid, state, reportJson ) {
    var { currentPrefValList, preference_Name } = getReportsListFromPreference( preferenceName );

    // Check for null/empty preference list
    if( currentPrefValList === null || currentPrefValList.length === 1 && currentPrefValList[0].length === 0 ) {
        currentPrefValList = [];
    }

    // Handle selectedReportDef being null safely
    var reportIdVal = null;
    if ( selectedReportDef !== null ) {
        reportIdVal = selectedReportDef.props.rd_id.dbValues[0];
    }

    // Proceed only if selectedReportDef is not null
    if ( selectedReportDef !== null ) {
        const rdSource = selectedReportDef?.props?.rd_source?.dbValues[0];

        if ( rdSource === activeWorkspaceStr && !sourceUid ) {
            currentPrefValList[currentPrefValList.length] = reportIdVal + ':{"ID":"' + reportIdVal + '"}';
        } else if ( rdSource === activeWorkspaceStr && sourceUid ) {
            var prefKey = reportIdVal + sourceUid;
            currentPrefValList[ currentPrefValList.length ] = prefKey + ':{"ID":"' + reportIdVal + '",' + sourceObjectStr + sourceUid + '"}';
            // update id value for persist CTX..
            reportIdVal = prefKey;
        } else if ( rdSource === 'TcRA' ) {
            currentPrefValList[currentPrefValList.length] = reportJson;
        }
    }

    // Check if crntList exists, proceed accordingly
    var crntList = appCtxService.getCtx( reportsCommSrvc.getCtxMyDashboardList() );
    crntList && crntList.push( reportIdVal );

    // Handle null state check before calling constructTileObject
    const modelObject = state !== null ? constructTileObject( state?.getValue(), selectedReportDef, sourceUid ) : null;

    // Final function call
    return callSoaForPreferenceUpdate( preference_Name, currentPrefValList, crntList, state, modelObject, null, _add, false );
};

let swappingOfReports = ( momentTo, currentPrefValList, index ) => {
    if( momentTo === _previous ) {
        let element = currentPrefValList[index - 1];
        currentPrefValList[index - 1] = currentPrefValList[index];
        currentPrefValList[index] = element;
    } else {
        let element = currentPrefValList[index + 1];
        currentPrefValList[index + 1] = currentPrefValList[index];
        currentPrefValList[index] = element;
    }
    return currentPrefValList;
};

export let reportDashboardMove = ( selectedReport, preferenceName, searchState, momentTo )=> {
    var { currentPrefValList, preference_Name } = getReportsListFromPreference( preferenceName );
    var chkPrefValue = selectedReport.props.rd_type.dbValues[ 0 ] === '1' ? selectedReport.props.rd_id.dbValues[ 0 ] + selectedReport.props.rd_sourceObject.dbValue : selectedReport.props
        .rd_id.dbValues[ 0 ];
    var index = getPreferenceIndex( currentPrefValList, chkPrefValue );
    currentPrefValList = swappingOfReports( momentTo, currentPrefValList, index );
    var crntList = appCtxService.getCtx( reportsCommSrvc.getCtxMyDashboardList() );
    crntList = swappingOfReports( momentTo, crntList, index );
    return callSoaForPreferenceUpdate( preference_Name, currentPrefValList, crntList, searchState, selectedReport, index, momentTo, null );
};

//################# MY DASHBOARD TILE VIEW METHODS ####################
/**
 *  fsd
 * @param {*} startIndex -
 * @returns {*} cursorObject
 */
var getCursorObject = function( startIndex ) {
    var totalFound = _reportsList.length;
    var mEndIndex = null;
    var mEndReached = null;

    if( startIndex === 0 ) {
        if( totalFound === _pageSize ) {
            mEndIndex = _pageSize;
            mEndReached = true;
        }
        if( totalFound > _pageSize ) {
            mEndIndex = _pageSize;
            mEndReached = false;
        } else {
            mEndIndex = totalFound;
            mEndReached = true;
        }
    } else {
        if( _pageSize + startIndex > totalFound ) {
            mEndIndex = totalFound;
            mEndReached = true;
        } else {
            mEndIndex = _pageSize + startIndex;
            mEndReached = false;
        }
    }
    return {
        endIndex: mEndIndex,
        endReached: mEndReached,
        startIndex: startIndex,
        startReached: true
    };
};

/**
 *  fsd
 * @param {*} startIndex -
 * @returns {*} rederingFlg
 */
var getRenderingFlg = function( startIndex ) {
    let renderingFlg = null;
    if( _pageSize + startIndex >= _reportsList.length ) {
        renderingFlg = false;
    } else {
        renderingFlg = true;
    }
    return renderingFlg;
};

const addSearchRecipeProps = function( reportDef, recipe, dashboardTemplateList, uniqueId, preferenceName = 'REPORT_AW_MyDashboard_TC_Report' ) {
    const props = [ 'reportChartObjects', 'translatedBaseCriteria', 'translatedFilterQueries', 'reportSearchRecipeExtraInfo' ];
    const modelObject = viewModelService.constructViewModelObjectFromModelObject( null, 'EDIT', null, null, true );
    modelObject.propertyDescriptors = reportDef.propertyDescriptors;
    modelObject.props = reportDef.props;
    modelObject.type = reportDef.type;
    modelObject.modelType = reportDef.modelType;
    props.forEach( propName => {
        //set search receipe as a property value..
        const propAttrHolder = {
            displayName: propName,
            type: 'STRING',
            dbValue: recipe[ propName ]
        };
        const property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        modelObject.props[propName] = property;
    } );
    const reportUid = reportDef.uid;
    modelObject.reportUid = reportUid;
    modelObject.uid = uniqueId + recipe.reportSearchRecipeExtraInfo.reportIndex;
    modelObject.cellHeader1 = modelObject.props.rd_name.uiValues[ 0 ];
    modelObject.cellHeader2 = modelObject.props.rd_description?.uiValues[ 0 ];
    modelObject.typeIconURL = iconSvc.getTypeIconURL( reportDef.type );
    if( reportDef.props.rd_type.dbValues[ 0 ] === '1' ) {
        const repIndex = parseInt( recipe.reportSearchRecipeExtraInfo.reportIndex );
        let rdList = [];
        if( dashboardTemplateList ) {
            rdList = dashboardTemplateList;
        } else if( preferenceName ) {
            rdList = appCtxService.ctx.preferences[ preferenceName ];
        }
        let prefValue = rdList[ repIndex ];
        let prefValJSON = JSON.parse( prefValue.substring( prefValue.indexOf( ':' ) + 1, prefValue.length ) );
        let propAttrHolder = {
            displayName: 'rd_sourceObject',
            type: 'STRING',
            dbValue: prefValJSON.sourceObjUid
        };
        let property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        modelObject.props.rd_sourceObject = property;
        const item = cdm.getObject( prefValJSON.sourceObjUid );
        if( item?.props?.object_string ) {
            modelObject.cellProperties = { rd_sourceObject:{ key: localeService.getLoadedText( 'ReportChartMessages' ).parentSource, value: item.props.object_string.uiValues[0] } };
        } else {
            //if source object is not found then dashboard will not show report on dashboard
            return null;
        }
    }
    return modelObject;
};

var getReportDefinitions = async function( response, searchData, dashboardTemplateList, preferenceName ) {
    let index = 0;
    _reportsList = [];
    let newSearchData = {}; // Ensure newSearchData is always an object

    if( searchData && searchData.getValue ) {
        newSearchData = searchData.getValue();
    }

    let uniqueId = 'unstaffedUI';
    if ( searchData?.dashboardTabObject ) {
        uniqueId = searchData.dashboardTabObject.props.rb0DashboardId.dbValues[0] + '_';
    }

    _.forEach( response.reportSearchRecipeObjects, ( receipe ) => {
        let reportDef;
        if ( receipe.reportObject.reportUid ) {
            reportDef = cdm.getObject( receipe.reportObject.reportUid );
        } else {
            reportDef = response.ServiceData.modelObjects[receipe.reportObject.uid];
        }
        let propAttrHolder = {
            displayName: 'tileIndex',
            type: 'STRING',
            dbValue: index.toString()
        };
        let property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        reportDef.props.tileIndex = property;
        index++;
        const vmo = addSearchRecipeProps( reportDef, receipe, dashboardTemplateList, uniqueId, preferenceName );
        vmo && _reportsList.push( _.cloneDeep( vmo ) );
    } );

    if( searchData && searchData.update ) {
        newSearchData.totalFound = _reportsList.length;
        searchData.update( newSearchData );
    }

    return {
        reportdefinitions: _reportsList
    };
};

export let removeDeletedReportAndUpdate = ( deletedRepList, preferenceName, tabObject )=> {
    if( deletedRepList?.length > 0 && deletedRepList[0] !== 'RANDOME###$$$$' ) {
        let reportList = [];
        if( tabObject ) {
            reportList = tabObject.props.rb0DashboardTemplatesList.dbValues;
        } else if( preferenceName ) {
            reportList = appCtxService.ctx.preferences[ preferenceName ];
        } else {
            reportList = appCtxService.getCtx( reportsCommSrvc.getCtxForReportsPreference() );
        }
        _.forEach( deletedRepList, deleteRep => {
            var index = getPreferenceIndex( reportList, deleteRep );
            reportList.splice( index, 1 );
        } );
        if( tabObject ) {
            return callSoaForUpdatingDashboardList( reportList, tabObject );
        }
        return callSoaForPreferenceUpdate( preferenceName, reportList );
    }
    return null; // Ensure a value is always returned
};

/**
 * Main entry point for Rendering Report Tiles.
 * Performs the SOA call to get required ReportDefinition BO's.
 * For Sub-sequent scroll, next set of RD are returned.
 * @param {number} startIndex - The scroll index value.
 * @param {Object} searchData - The search data object.
 * @param {Object} subPanelContext - The sub panel context object.
 * @param {Object} dashboardTemplateList - The dashboard template list object.
 * @returns {Object} - List of ReportDefinition and cursor object.
 */
export let getReportDefinitionsForTileView = ( startIndex, searchData, subPanelContext, dashboardTemplateList )=> {
    var policyId = soa_kernel_propertyPolicyService.register( {
        types: [ {
            name: 'ReportDefinition',
            properties: [ { name: 'rd_parameters' }, { name: 'rd_param_values' }, { name: 'owning_user' },
                { name: 'rd_name' }, { name: 'rd_type' }, { name: 'rd_class' }, { name: 'rd_source' }, { name: 'rd_id' }  ]
        } ]
    } );

    if( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_PageSize ) {
        _pageSize = parseInt( appCtxService.ctx.preferences.REPORT_AW_MyDashboard_PageSize[0] );
    }

    //Tile config ReportDefinition processing
    if( startIndex === 0 ) {
        ////get SOA input
        let soaInput = getReportDefinitionSOAInput( subPanelContext, dashboardTemplateList, 'reportID' );

        return soaService.postUnchecked( 'Internal-Search-2020-12-SearchFolder', 'getTranslatedReportSearchRecipe', {
            reportDefinitionCriteria: soaInput
        } ).then(
            async function( response ) {
                let repDefList = await getReportDefinitions( response, searchData, dashboardTemplateList, subPanelContext.preferenceName );
                await removeDeletedReportAndUpdate( response.ServiceData.deleted, subPanelContext.preferenceName, searchData?.dashboardTabObject );
                var finalRepList = repDefList.reportdefinitions.slice( 0, _pageSize );
                let showLastUpdateTime = subPanelContext.showLastUpdateTime !== undefined ? subPanelContext.showLastUpdateTime : true;
                appCtxService.updatePartialCtx( 'ReportsContext.SearchParameters', response.commonSearchParameters );
                _totalLoaded = finalRepList.length;
                soa_kernel_propertyPolicyService.unregister( policyId );
                return {
                    reportdefinitions: finalRepList,
                    cursor: getCursorObject( startIndex ),
                    showLastUpdateTm: showLastUpdateTime,
                    totalFound: _reportsList.length,
                    rendering: getRenderingFlg( startIndex )
                };
            } );
    }
    startIndex = _totalLoaded;
    var tempRepList = _reportsList.slice( startIndex, startIndex + _pageSize );
    _totalLoaded += tempRepList.length;
    return {
        reportdefinitions: tempRepList,
        cursor: getCursorObject( startIndex ),
        totalFound: _reportsList.length,
        rendering: getRenderingFlg( startIndex )
    };
};

const findDataProviderIndex = ( vmos, rUid ) => {
    let tileIndex = -1;
    _.forEach( vmos, ( vmo, index )=>{
        vmo.uid === rUid ? tileIndex = index : '';
    } );
    return tileIndex;
};

/**
 * Updates the dataprovider after user removes a report from Dashboard
 * Instead of a whole reload of the page, only dataprovider is updated
 * @param {*} dataProviders - dataProviders
 * @param {*} reportDefObj - report DefObj
 * @param {*} operation - operation
 * @param {*} tileIndex - tileIndex
 * @param {*} searchData - to update number of reports on dashboard
 * @returns {void}
 */
export let myDashboardUpdate = function( dataProviders, reportDefObj, operation, tileIndex, searchData ) {
    //TODO client refresh need to handle as this is not refreshing the UI
    if( reportDefObj ) {
        operation !== _add && operation !== _reset ? tileIndex = findDataProviderIndex( dataProviders.viewModelCollection.loadedVMObjects, reportDefObj.uid ) : '';
        if( operation === _add ) {
            dataProviders.viewModelCollection.loadedVMObjects.push( reportDefObj );
            _reportsList.push( reportDefObj );
            dataProviders.update( dataProviders.viewModelCollection.loadedVMObjects, dataProviders.viewModelCollection.loadedVMObjects.length );
        } else if( ( operation === _previous || operation === _next ) && ( tileIndex || tileIndex === 0 ) ) {
            swappingOfReports( operation, dataProviders.viewModelCollection.loadedVMObjects, tileIndex );
            swappingOfReports( operation, _reportsList, tileIndex );
            dataProviders.update( dataProviders.viewModelCollection.loadedVMObjects, dataProviders.viewModelCollection.loadedVMObjects.length );
        } else if( tileIndex || tileIndex === 0 ) {
            dataProviders.viewModelCollection.loadedVMObjects.splice( tileIndex, 1 );
            _reportsList.splice( tileIndex, 1 );
            _reportsList.length === 0 ? dataProviders.resetDataProvider() :
                dataProviders.update( dataProviders.viewModelCollection.loadedVMObjects, dataProviders.viewModelCollection.loadedVMObjects.length );
        } else if( operation === _reset ) {
            dataProviders.update( [], 0 );
            dataProviders.resetDataProvider();
        }
        if( searchData ) {
            const newSearchData = searchData.getValue();
            newSearchData.totalFound = _reportsList.length;
            searchData.update( newSearchData );
        }
        return { totalFound: _reportsList.length };
    }
};

//################# MY DASHBOARD TILE VIEW METHODS END #################

//################# EASILY ADD TO DASHBOARD METHODS #################

export let processSearchResults = ( response, searchString, tabbedDashboardSearchState ) => {
    var searchResults = [];
    var reportDefinitions = JSON.parse( response.searchResultsJSON ).objects.map( function( rDef ) {
        return response.ServiceData.modelObjects[ rDef.uid ];
    } );
    reportDefinitions.forEach( reportdef => {
        var searchResult = {
            propDisplayValue: reportdef.props.rd_name.uiValues[0],
            propDisplayDescription: reportdef.props.rd_description?.uiValues[0],
            propInternalValue: reportdef.uid,
            reportType: reportdef.props.rd_type.dbValues[0],
            reportId: reportdef.props.rd_id.dbValues[0],
            reportdefinition: reportdef
        };
        searchResults.push( searchResult );
    } );
    let reportList;
    if( tabbedDashboardSearchState ) {
        let nwSearchState = tabbedDashboardSearchState.getValue();
        reportList = [];
        if( nwSearchState.dashboardActiveView ) {
            _.forEach( nwSearchState.dashboardReports, ( reportObj ) => {
                let reportKey = reportObj.props.rd_id.dbValues[0];
                if( reportObj.props.rd_sourceObject?.dbValue ) {
                    reportKey += reportObj.props.rd_sourceObject.dbValue;
                }
                reportList.push( reportKey );
            } );
        } else {
            _.forEach( _reportsList, ( reportObj ) => {
                let reportKey = reportObj.props.rd_id.dbValues[0];
                if( reportObj.props.rd_sourceObject?.dbValue ) {
                    reportKey += reportObj.props.rd_sourceObject.dbValue;
                }
                reportList.push( reportKey );
            } );
        }
    } else {
        reportList = appCtxService.getCtx( reportsCommSrvc.getCtxMyDashboardList() );
    }
    searchResults = _.filter( searchResults, function( prop ) {
        let found = false;
        _.forEach( reportList, ( reportId )=> {
            if( reportId.startsWith( prop.reportId ) && prop.reportType !== '1' ) {
                found = true;
            }
        } );
        return !( found ||  searchString && searchString.length > 0 && prop.propDisplayValue.toLowerCase().indexOf( searchString.toLowerCase() ) < 0 );
    } );
    searchResults.sort( ( data1, data2 ) => { return data1.propDisplayValue.localeCompare( data2.propDisplayValue ); } );
    return searchResults;
};

export let addItemSelected = ( state, panelId, selected ) => {
    state.activeView = panelId;
    state.itemSource = selected;
    return state;
};

export let getselectedItemSource = ( repContext ) => {
    return repContext.itemSource;
};

export let updateDataProvider = ( dataProvider, selected, reportsList ) => {
    reportsList.dbValue = selected.propDisplayValue;
    reportsList.uiValue = selected.propDisplayValue;
    dataProvider.selectionModel.setSelection( selected );
    dataProvider.update( [ selected ], 1 );
    return reportsList;
};
let initializeRepSearchState = function( searchState ) {
    //let newSearchState = subPanelContext.searchState ? subPanelContext.searchState.value : { ...searchState.value };
    let newSearchState = { ...searchState.value };
    // this code initializes the searchState for 'Search' Tab
    let searchContext = {
        showChartColorBars: false,
        bulkFilteringPreference: 'AWC_Discovery_Delayed_Filter_Apply',
        bulkFiltering: true,
        criteria: { forceThreshold: 'true' },
        provider: 'Awp0FullTextSearchProvider',
        sortType: 'Priority'
    };
    //let updatedSearchContext = searchStateHelperService.constructBaseSearchCriteria( searchContext );
    newSearchState = { ...searchContext };
    newSearchState.objectsGroupedByProperty = null;
    newSearchState.selectedFiltersString = '';
    newSearchState.activeFilterMap = {};
    newSearchState.sourceSearchFilterMap = {};
    newSearchState.autoApplyFilters = true;
    return newSearchState;
};
export let initializeAndAddActiveFilters = ( searchState, rdClassName ) => {
    appCtxService.updatePartialCtx( 'selected', null );
    var newSearchState = initializeRepSearchState( searchState );
    if( rdClassName ) {
        var activeFilterMap = {
            'WorkspaceObject.object_type': [
                {
                    searchFilterType: 'StringFilter',
                    stringValue: rdClassName
                }
            ]
        };
        newSearchState.sourceSearchFilterMap = activeFilterMap;
        newSearchState.activeFilterMap = activeFilterMap;
        newSearchState.applyPresetTypeFilters = true;
    }
    searchState.update( newSearchState );
};

export let appendRdSourceAndReturnSelectedReportDef = ( selectedReportDef, sourceObjUid ) => {
    if ( sourceObjUid ) {
        var propAttrHolder = {
            displayName: 'rd_sourceObject',
            type: 'STRING',
            dbValue: sourceObjUid,
            dbValues: [ sourceObjUid ]
        };
        var property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        selectedReportDef.props.rd_sourceObject = property;
    }
    return selectedReportDef;
};

export let getSelectedRepObject = ( selectedReport, createdReportFromAdvQuery ) => {
    if( createdReportFromAdvQuery ) {
        return createdReportFromAdvQuery;
    }
    return reportsCommSrvc.getSelectedRepObject( selectedReport );
};

export let getUIDForSelectObject = ( selectedReport, createdReportFromAdvQuery, reportSourceObjectUid ) => {
    if( createdReportFromAdvQuery ) {
        return undefined;
    }
    return reportsCommSrvc.getUIDForSelectObject( selectedReport, reportSourceObjectUid );
};

export let getReportDefSearchCriteria = () => {
    var traversePath = {
        relationsPath: [ {
            searchMethod: 'REPORT_DEF',
            inputCriteria: [
                {
                    category: '',
                    source: activeWorkspaceStr,
                    contextObjects: []
                }
            ],
            objectType: 'ReportDefinition'
        } ]
    };

    return {
        sourceObject: '',
        relationsPath: JSON.stringify( traversePath ),
        isFilterMapRequired: 'False'
    };
};

//################# EASILY ADD TO DASHBOARD METHODS END #################

export const getReportDashboardTabList = ( response, searchState, selectedTabIndex ) => {
    let tabModels = [];
    let index = 0;
    let nwSearchState = searchState.getValue();
    if( response.totalFound === 0 ) {
        nwSearchState.totalFound = 0;
        nwSearchState.addDashTabs =  true;
        searchState.update( nwSearchState );
    } else if( nwSearchState.addDashTabs ) {
        delete nwSearchState.addDashTabs;
        searchState.update( nwSearchState );
    }
    const dashboardTabObjectUid = nwSearchState.dashboardTabObject?.uid;
    let itemUids = [];
    _.forEach( response.ServiceData.plain, ( uid ) => {
        let modelObject = viewModelService.createViewModelObject( response.ServiceData.modelObjects[uid] );
        let tabKey = modelObject.props.rb0DashboardName.uiValues[0] + index;
        _.forEach( modelObject.props.rb0DashboardTemplatesList?.dbValues, ( prefValue ) => {
            const prefJSON = JSON.parse( prefValue.substring( prefValue.indexOf( ':' ) + 1, prefValue.length ) );
            if( prefJSON.sourceObjUid ) {
                itemUids.push( prefJSON.sourceObjUid );
            }
        } );
        let tab = {
            name: modelObject.props.rb0DashboardName.uiValues[0],
            tabKey: tabKey,
            index: index,
            tabObject: modelObject,
            selectedTab: dashboardTabObjectUid ? modelObject.uid === dashboardTabObjectUid : selectedTabIndex === index
        };
        tabModels.push( tab );
        index++;
    } );
    return dmSvc.loadObjects( itemUids ).then( function( ) {
        return tabModels;
    } );
};

export const getReportdefinitionListFromSelectedTab = ( searchState ) => {
    let nwSearchState = searchState.getValue();
    return nwSearchState.dashboardReports ? nwSearchState.dashboardReports : [];
};

export const updateDashboardTemplateListDataProvider = ( searchState, dataProvider, selectedObjects, operation ) => {
    let vmos = dataProvider.viewModelCollection.loadedVMObjects;
    _.forEach( selectedObjects, ( selectedObject ) => {
        let findIndex = -1;
        _.forEach( vmos, ( vmo, index ) => {
            if( vmo.props.tileIndex.dbValue === selectedObject.props.tileIndex.dbValue ) {
                findIndex = index;
            }
        } );
        if( operation === 'remove' ) {
            // do action
            vmos.splice( findIndex, 1 );
        } else if( operation === 'moveup' ) {
            // do action
            let element = vmos[findIndex];
            vmos[findIndex] = vmos[findIndex - 1];
            vmos[findIndex - 1] = element;
        } else if( operation === 'movedown' ) {
            // do action
            let element = vmos[findIndex];
            vmos[findIndex] = vmos[findIndex + 1];
            vmos[findIndex + 1] = element;
        }
    } );
    dataProvider.update( vmos, vmos.length );
    let nwSearchState = searchState.getValue();
    nwSearchState.dashboardReports = vmos;
    nwSearchState.dashboardReportsAsKeys = getReportListAsKeys( vmos );
    searchState.update( nwSearchState );
};

const constructTileObject = ( nwSearchState, selectedReportDef, itemUid, reportsList )=>{
    let uniqueId = 'unstaffedUI';

    // Safe check for nwSearchState and dashboardTabObject
    if ( nwSearchState?.dashboardTabObject ) {
        uniqueId = nwSearchState.dashboardTabObject.props.rb0DashboardId.dbValues[0] + '_';
    }

    const reportsNumber = reportsList ? reportsList.length : _reportsList.length;

    let modelObject = viewModelService.constructViewModelObjectFromModelObject( null, 'EDIT', null, null, true );

    // Generate unique model object uid
    modelObject.uid = uniqueId + reportsNumber;

    // Check if selectedReportDef is not null or undefined before accessing properties
    if ( selectedReportDef !== null && selectedReportDef !== undefined ) {
        // Safely access props and other attributes from selectedReportDef
        modelObject.props = selectedReportDef.props || {};
        modelObject.type = selectedReportDef.type || '';
        modelObject.modeType = selectedReportDef.modeType || '';

        // Add tileIndex property to selectedReportDef
        let propAttrHolder = {
            displayName: 'tileIndex',
            type: 'STRING',
            dbValue: reportsNumber.toString()
        };
        let property = modelPropertySvc.createViewModelProperty( propAttrHolder );
        modelObject.props.tileIndex = property;

        // Use a fallback if reportUid is missing
        const reportUid = selectedReportDef.reportUid || selectedReportDef.uid || '';
        modelObject.reportUid = reportUid;

        // Handle rd_type property safely
        if ( selectedReportDef.props?.rd_type?.dbValues?.[0] === '1' ) {
            propAttrHolder = {
                displayName: 'rd_sourceObject',
                type: 'STRING',
                dbValue: itemUid
            };
            property = modelPropertySvc.createViewModelProperty( propAttrHolder );
            modelObject.props.rd_sourceObject = property;
        }

        // Safely access rd_name and rd_description
        modelObject.cellHeader1 = modelObject.props.rd_name?.uiValues?.[0] || '';
        modelObject.cellHeader2 = modelObject.props.rd_description?.uiValues?.[0] || '';

        // Safe check for item retrieval and its properties
        const item = cdm.getObject( itemUid );
        if ( item?.props?.object_string ) {
            modelObject.cellProperties = { rd_sourceObject: { key: localeService.getLoadedText( 'ReportChartMessages' ).parentSource, value: item.props.object_string.uiValues[0] } };
        }

        // Safely get the icon URL for the type
        modelObject.typeIconURL = iconSvc.getTypeIconURL( modelObject.type );
    }

    return modelObject;
};

export let addSelectedReportToReportList = ( selectedReportDef, item, searchState ) => {
    let nwSearchState = searchState.getValue();
    let dashboardRpList;
    if( nwSearchState.dashboardReports ) {
        dashboardRpList = nwSearchState.dashboardReports ? _.cloneDeep( nwSearchState.dashboardReports ) : [];
    } else{
        dashboardRpList = _.cloneDeep( _reportsList );
    }
    const modelObject = constructTileObject( nwSearchState, selectedReportDef, item?.uid, dashboardRpList );
    dashboardRpList.push( modelObject );
    nwSearchState.dashboardReports = dashboardRpList;
    nwSearchState.dashboardReportsAsKeys = getReportListAsKeys( dashboardRpList );
    searchState.update( nwSearchState );
};

const updateLocalizedProperties = ( response, tabObject ) => {
    let deferred = awPromiseService.instance.defer();
    var getLocalizedPropertiesInputData = {
        input:{
            info:[ {
                inputObject: {
                    uid: tabObject.uid,
                    type: 'Rb0ReportsDashboard'
                },
                propertyNames: [
                    'rb0DashboardName',
                    'rb0DashboardDescription'
                ]
            } ],
            locales: []
        }
    };
    soaService.post( 'Internal-AWS2-2020-12-DataManagement', 'getLocalizedProperties', getLocalizedPropertiesInputData ).then( function( localizedPropertiesResponse ) {
        var setLocalizedPropertiesInput = {
            input: localizedPropertiesResponse.propertiesInfo
        };
        setLocalizedPropertiesInput.input[0].inputObject.uid = response.output[0].objects[0].uid;
        soaService.post( 'Internal-AWS2-2020-12-DataManagement', 'setLocalizedProperties', setLocalizedPropertiesInput ).then( function( ) {
            deferred.resolve();
        } );
    } );

    return deferred.promise;
};

export const saveReportDashboardAction = ( dashboardId, dashboardName, dashboardDesc, vmos, searchState ) => {
    let nwSearchState = searchState.getValue();
    let tabObject = nwSearchState.dashboardTabObject;
    let deferred = awPromiseService.instance.defer();
    let dashboardList = [];
    _.forEach( vmos, ( vmo ) => {
        // Check if vmo is non-null and non-undefined before accessing its properties
        if ( vmo && vmo.props && vmo.props.rd_id && vmo.props.rd_id.dbValues ) {
            let repId = vmo.props.rd_id.dbValues[0];
            let reportIdVal;

            if( vmo?.props?.rd_source?.dbValues[0] === activeWorkspaceStr && !vmo.props.rd_sourceObject?.dbValue ) {
                reportIdVal = repId + ':{"ID":"' + repId + '"}';
            } else if( vmo?.props?.rd_source?.dbValues[0] === activeWorkspaceStr && vmo.props.rd_sourceObject?.dbValue ) {
                let prefKey = repId + vmo.props.rd_sourceObject.dbValue;
                reportIdVal = prefKey + ':{"ID":"' + repId + '",' + sourceObjectStr + vmo.props.rd_sourceObject.dbValue + '"}';
            } else if( vmo?.props?.rd_source?.dbValues[0] === 'TcRA' ) {
                //TODO: This needs to be handled
            }
            reportIdVal && dashboardList.push( reportIdVal );
        }
    } );
    if( nwSearchState.editingDashboard && tabObject ) {
        //check owner of dashboard
        let canSetProperties = tabObject.props.owning_user.dbValues[0] === appCtxService.ctx.userSession.props.user.dbValues[0];
        //if same setproperties
        if( canSetProperties ) {
            dmSvc.setProperties( [ {
                object: tabObject,
                vecNameVal: [ {
                    name: 'rb0DashboardName',
                    values: [
                        dashboardName
                    ]
                }, {
                    name: 'rb0DashboardDescription',
                    values: [
                        dashboardDesc
                    ]
                }, {
                    name: 'rb0DashboardTemplatesList',
                    values: dashboardList
                } ]
            } ] ).then( ()=>{
                nwSearchState.dashboardTabObject.props.rb0DashboardTemplatesList.dbValues = dashboardList;
                nwSearchState.dashboardTabObject.props.rb0DashboardTemplatesList.uiValues = dashboardList;
                nwSearchState.reportDashboard = { operation: _reset, reportDef: nwSearchState.dashboardTabObject };
                searchState.update( nwSearchState );
                deferred.resolve();
            }, function( SoaResponse ) {
                deferred.reject( SoaResponse );
            } );
        } else {
            let input = [];
            let createInput = {
                boName: 'Rb0ReportsDashboard',
                stringProps: {
                    rb0DashboardName: dashboardName,
                    rb0DashboardLocation: 'Reports',
                    rb0DashboardId: dashboardId,
                    rb0DashboardDescription: dashboardDesc
                },
                tagProps: {
                    rb0SourceDashboard: tabObject
                },
                stringArrayProps: {
                    rb0DashboardTemplatesList: dashboardList
                }
            };
            let inputData = {
                data: createInput
            };

            input.push( inputData );
            dmSvc.createObjects( input ).then( async function( response ) {
                let createobject = response.output[0].objects[0];
                await dmSvc.createRelations( [ {
                    primaryObject: createobject,
                    secondaryObject: {
                        type: 'User',
                        uid: appCtxService.ctx.userSession.props.user.dbValues[0]
                    },
                    relationType: 'Fnd0Applicable_Assignment',
                    clientId: ''
                } ] ).then( function() {
                    updateLocalizedProperties( response, tabObject ).then( function() {
                        nwSearchState.dashboardTabObject = response.ServiceData.modelObjects[ response.output[0].objects[0].uid ];
                        searchState.update( nwSearchState );
                        deferred.resolve();
                        eventBus.publish( reportDashboardReset );
                    }, function( SoaResponse ) {
                        deferred.reject( SoaResponse );
                    } );
                }, function( SoaResponse ) {
                    deferred.reject( SoaResponse );
                } );
            }, function( SoaResponse ) {
                deferred.reject( SoaResponse );
            } );
        }
    } else {
        //createobject
        let input = [];
        let createInput = {
            boName: 'Rb0ReportsDashboard',
            stringProps: {
                rb0DashboardName: dashboardName,
                rb0DashboardLocation: 'Reports',
                rb0DashboardId: dashboardId,
                rb0DashboardDescription: dashboardDesc
            },
            stringArrayProps: {
                rb0DashboardTemplatesList: dashboardList
            }
        };
        let inputData = {
            data: createInput
        };

        input.push( inputData );
        dmSvc.createObjects( input ).then( async function( response ) {
            let createobject = response.output[0].objects[0];
            await dmSvc.createRelations( [ {
                primaryObject: createobject,
                secondaryObject: {
                    type: 'User',
                    uid: appCtxService.ctx.userSession.props.user.dbValues[0]
                },
                relationType: 'Fnd0Applicable_Assignment',
                clientId: ''
            } ] ).then( function() {
                nwSearchState.dashboardTabObject = response.ServiceData.modelObjects[ response.output[0].objects[0].uid ];
                searchState.update( nwSearchState );
                deferred.resolve();
                eventBus.publish( reportDashboardReset );
            }, function( SoaResponse ) {
                deferred.reject( SoaResponse );
            } );
        }, function( SoaResponse ) {
            deferred.reject( SoaResponse );
        } );
    }
    return deferred.promise;
};

export const prepareInputForDeleteRelations = ( dashboardObject, access ) => {
    return shareTemplateService.prepareInputForDeleteRelations( { selected: dashboardObject }, access );
};

const callSoaForUpdatingDashboardList = ( currentDashboardList, tabObject, searchState, selectedReportDef, operation, index ) => {
    let deferred = awPromiseService.instance.defer();
    //check owner of dashboard
    let canSetProperties = tabObject.props.owning_user.dbValues[0] === appCtxService.ctx.userSession.props.user.dbValues[0];
    if( canSetProperties ) {
        dmSvc.setProperties( [ {
            object: tabObject,
            vecNameVal: [ {
                name: 'rb0DashboardTemplatesList',
                values: currentDashboardList
            } ]
        } ] ).then( function( response ) {
            if( searchState && selectedReportDef && searchState.dashboardTabObject ) {
                let nwSearchState = searchState.getValue();
                nwSearchState.dashboardTabObject.props.rb0DashboardTemplatesList = response.ServiceData.modelObjects[ tabObject.uid ].props.rb0DashboardTemplatesList;
                nwSearchState.reportDashboard = { reportDef: selectedReportDef, operation: operation, tileIndex: index };
                searchState.update( nwSearchState );
            }
            deferred.resolve( response );
        }, function( SoaResponse ) {
            deferred.reject( SoaResponse );
        } );
    } else {
        // get report ID
        soaService.postUnchecked( 'Reports-2007-01-CrfReports', 'generateReportDefintionIds', {
            inputCriteria: [ {
                category: 'SummaryReport',
                clientId: '',
                source: '',
                status: ''
            } ]
        } ).then( function( response ) {
            let newDashboardId = response.reportdefinitionIds[ 0 ].reportDefinitionId;
            let input = [];
            let createInput = {
                boName: 'Rb0ReportsDashboard',
                stringProps: {
                    rb0DashboardName: tabObject.props.rb0DashboardName.dbValues[0],
                    rb0DashboardLocation: 'Reports',
                    rb0DashboardId: newDashboardId,
                    rb0DashboardDescription: tabObject.props.rb0DashboardDescription?.dbValues[0]
                },
                tagProps: {
                    rb0SourceDashboard: tabObject
                },
                stringArrayProps: {
                    rb0DashboardTemplatesList: currentDashboardList
                }
            };
            let inputData = {
                data: createInput
            };

            input.push( inputData );
            dmSvc.createObjects( input ).then( async function( response ) {
                let createobject = response.output[0].objects[0];
                await dmSvc.createRelations( [ {
                    primaryObject: createobject,
                    secondaryObject: {
                        type: 'User',
                        uid: appCtxService.ctx.userSession.props.user.dbValues[0]
                    },
                    relationType: 'Fnd0Applicable_Assignment',
                    clientId: ''
                } ] ).then( function() {
                    updateLocalizedProperties( response, tabObject ).then( function() {
                        if( searchState ) {
                            let nwSearchState = searchState.getValue();
                            nwSearchState.dashboardTabObject = response.ServiceData.modelObjects[ response.ServiceData.created[0] ];
                            searchState.update( nwSearchState );
                            eventBus.publish( reportDashboardReset );
                        }
                        deferred.resolve( response );
                    } );
                }, function( SoaResponse ) {
                    deferred.reject( SoaResponse );
                } );
            }, function( SoaResponse ) {
                deferred.reject( SoaResponse );
            } );
        } );
    }
    return deferred.promise;
};

export const reportTabbedDashboardMove = ( selectedReport, searchState, momentTo ) => {
    let nwSearchState = searchState.getValue();
    let tabObject = nwSearchState.dashboardTabObject;
    let currentDashboardList = tabObject.props.rb0DashboardTemplatesList.dbValues;
    let chkPrefValue = selectedReport.props.rd_type.dbValues[ 0 ] === '1' ? selectedReport.props.rd_id.dbValues[ 0 ] + selectedReport.props.rd_sourceObject.dbValue : selectedReport.props.rd_id.dbValues[ 0 ];
    let index = getPreferenceIndex( currentDashboardList, chkPrefValue );
    currentDashboardList = swappingOfReports( momentTo, currentDashboardList, index );
    return callSoaForUpdatingDashboardList( currentDashboardList, tabObject, searchState, selectedReport, momentTo, index );
};

export const removeSelectedDashboardReportForTabbed = ( selectedReport, tabObject, searchState ) => {
    tabObject = cdm.getObject( tabObject.uid );
    let currentDashboardList = tabObject.props.rb0DashboardTemplatesList.dbValues;
    let chkPrefValue = selectedReport.props.rd_type.dbValues[ 0 ] === '1' ? selectedReport.props.rd_id.dbValues[ 0 ] + selectedReport.props.rd_sourceObject.dbValue : selectedReport.props.rd_id.dbValues[ 0 ];
    let index = getPreferenceIndex( currentDashboardList, chkPrefValue );
    currentDashboardList.splice( index, 1 );
    return callSoaForUpdatingDashboardList( currentDashboardList, tabObject, searchState, selectedReport, null, index );
};

export const addSelectedDashboardReportForTabbed = ( selectedReport, tabObject, selectedItem, searchState, reportJson ) => {
    tabObject = cdm.getObject( tabObject.uid );
    let nwSearchState = searchState?.getValue();
    let currentDashboardList = tabObject.props.rb0DashboardTemplatesList.dbValues;
    let prefKey;

    // Check if selectedReport is not null or undefined before accessing its properties
    if ( selectedReport && selectedReport.props && selectedReport.props.rd_source ) {
        if( selectedReport.props.rd_source.dbValues[0] === activeWorkspaceStr ) {
            prefKey = selectedReport.props.rd_type.dbValues[0] === '1'
                ? selectedReport.props.rd_id.dbValues[0] + selectedItem.uid
                : selectedReport.props.rd_id.dbValues[0];
            prefKey = prefKey + ':{"ID":"' + selectedReport.props.rd_id.dbValues[0] + ( selectedItem && selectedItem.uid ? '",' + sourceObjectStr + selectedItem.uid : '' ) + '"}';
        } else if( selectedReport.props.rd_source.dbValues[0] === 'TcRA' ) {
            prefKey = reportJson;
        }
    }

    currentDashboardList.push( prefKey );
    const modelObject = constructTileObject( nwSearchState, selectedReport, selectedItem?.uid );
    return callSoaForUpdatingDashboardList( currentDashboardList, tabObject, searchState, modelObject, _add, null );
};

export const getRelationsPathForDashboardTabsLoading = function( dashboardLocations ) {
    return `{"relationsPath":[{"searchMethod":"REPORT_DASHBOARD","dashboardLocations":${JSON.stringify( dashboardLocations )},"objectType":"Rb0ReportsDashboard"}]}`;
};

export const getDashboardChooserList = ( selectedReport, tabObjects ) => {
    let dashboardChooserList = tabObjects ? tabObjects : appCtxService.ctx.dashboardObjects.objects;
    dashboardChooserList = _.uniqBy( dashboardChooserList, 'uid' );
    let arrUids = [];
    _.forEach( dashboardChooserList, ( dashboard ) => {
        arrUids.push( dashboard.uid );
    } );
    let dashboardList = [];
    return dmSvc.getProperties( arrUids, [ 'owning_user', 'rb0DashboardTemplatesList', 'rb0DashboardName' ] ).then( function() {
        //add the dashboard chooser list
        if( appCtxService.ctx.showAddToDashboardCommand || !selectedReport ) {
            _.forEach( dashboardChooserList, ( dashboard ) => {
                let vmo = cdm.getObject( dashboard.uid );
                dashboardList.push( viewModelService.createViewModelObject( vmo.uid, 'EDIT', null, vmo ) );
            } );
        } else if( selectedReport ) {
            _.forEach( dashboardChooserList, ( dashboard ) => {
                dashboard = cdm.getObject( dashboard.uid );
                _.forEach( dashboard.props.rb0DashboardTemplatesList.dbValues, ( report ) => {
                    if( report.startsWith( selectedReport.props.rd_id.dbValues[0] ) ) {
                        dashboardList.push( dashboard );
                    }
                } );
            } );
        }
        return dashboardList;
    } );
};

export const getDashboardChooserListBox = async( selectedReport, selectDashboard ) => {
    const nwSelectDashboard = { ...selectDashboard };
    return exports.getDashboardChooserList().then( function( dashboardVmos ) {
        let dashboardList = [];
        _.forEach( dashboardVmos, ( dashboard ) => {
            dashboardList.push( { propDisplayValue: dashboard.props.rb0DashboardName.dbValues[0], propInternalValue: dashboard.uid } );
        } );
        let reportNameKey;
        if( selectedReport ) {
            let prefKey = selectedReport.props.rd_id.dbValues[0];
            reportNameKey = prefKey + ':{"ID":"' + selectedReport.props.rd_id.dbValues[0] + '"}';
        }
        return reportsCommSrvc.checkDashboardContainsReportdef( dashboardVmos, reportNameKey )
            .then( ( { foundTabObject } ) => {
                if ( foundTabObject ) {
                    nwSelectDashboard.dbValue = foundTabObject.uid;
                    nwSelectDashboard.uiValue = foundTabObject.props.rb0DashboardName.dbValues[0];
                    nwSelectDashboard.value = foundTabObject.uid;
                    appCtxService.updatePartialCtx( 'showAddToDashboardCommand', false );
                } else if ( dashboardList.length > 0 ) {
                    nwSelectDashboard.dbValue = dashboardList[0].propInternalValue;
                    nwSelectDashboard.uiValue = dashboardList[0].propDisplayValue;
                    nwSelectDashboard.value = dashboardList[0].propDisplayValue;
                    appCtxService.updatePartialCtx( 'showAddToDashboardCommand', true );
                }
                return { dashboard: nwSelectDashboard, dashboardList, previousDashboardUid: foundTabObject?.uid };
            } );
    } );
};

export const getReportListAsKeys = ( reportsList ) => {
    let reportKeys = [];
    _.forEach( reportsList, ( report ) => {
        let prefKey = report.props.rd_id.dbValues[0] + ( report.props.rd_sourceObject?.dbValue ? report.props.rd_sourceObject.dbValue : '' );
        let reportNameKey = prefKey + ':{"ID":"' + report.props.rd_id.dbValues[0] + ( report.props.rd_sourceObject?.dbValue ? '",' + '"sourceObjUid":"' + report.props.rd_sourceObject.dbValue : '' ) + '"}';
        reportKeys.push( reportNameKey );
    } );
    return reportKeys;
};

export const getReportsList = () => {
    return _reportsList;
};

export const setReportsList = ( reportsList ) => {
    _reportsList = reportsList;
};

export const destroyDashboardList = ( selectionData, searchState ) => {
    appCtxService.unRegisterCtx( 'selected' );
    appCtxService.updatePartialCtx( 'mselected', [] );
    updateAtomicDataValue( selectionData, { selected: [] } );
    updateAtomicDataValue( searchState, { reportDashboard: {} } );
};

export const getSelectedAdvancedQuery = ( searchState ) => {
    let advancedQueryUid = searchState.savedQuery?.value;
    var selectedAdvancedQueryValue = cdm.getObject( advancedQueryUid );
    var additionalSearchCriteriaValue = { relationsPath: JSON.stringify( { relationsPath:[ { searchMethod: 'ADVANCED_SEARCH', objectType: 'ALL', additionalTraversalCriteria: searchState.advancedSearchCriteria } ] } ) };

    let params = [];
    let paramValues = [];

    params.push( 'AdditionalSearchCriteria' );
    params.push( 'DataProvider' );
    params.push( 'ThumbnailChart' );
    paramValues.push( JSON.stringify( additionalSearchCriteriaValue ) );
    paramValues.push( 'Rb0ReportsDataProvider' );
    paramValues.push( 'ReportTable1' );

    return { selectedAdvancedQuery: selectedAdvancedQueryValue, rd_params: params, rd_param_values: paramValues };
};

exports = {
    getReportDefinitionValList,
    getReportDefinitionSOAInput,
    setupDashboardReportViewer,
    removeSelectedDashboardReport,
    addSelectedReportToDashboard,
    getPreferenceIndex,
    getReportDefinitionsForTileView,
    myDashboardUpdate,
    processSearchResults,
    addItemSelected,
    getselectedItemSource,
    updateDataProvider,
    initializeAndAddActiveFilters,
    appendRdSourceAndReturnSelectedReportDef,
    reportDashboardMove,
    getSelectedRepObject,
    getUIDForSelectObject,
    removeDeletedReportAndUpdate,
    getReportDefSearchCriteria,
    getReportDashboardTabList,
    getReportdefinitionListFromSelectedTab,
    updateDashboardTemplateListDataProvider,
    addSelectedReportToReportList,
    saveReportDashboardAction,
    prepareInputForDeleteRelations,
    reportTabbedDashboardMove,
    removeSelectedDashboardReportForTabbed,
    addSelectedDashboardReportForTabbed,
    getRelationsPathForDashboardTabsLoading,
    getDashboardChooserList,
    getDashboardChooserListBox,
    getReportsList,
    setReportsList,
    getReportListAsKeys,
    destroyDashboardList,
    getSelectedAdvancedQuery
};
export default exports;
