// Copyright 2019 Siemens Product Lifecycle Management Software Inc.

/**
 * Logic for Shape Search
 * @module js/Awp0ShapeSearchService
 */

import appCtxService from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import preferenceService from 'soa/preferenceService';
import _ from 'lodash';
import searchFilterService from 'js/aw.searchFilter.service';
import searchCommonUtils from 'js/searchCommonUtils';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import awSearchLocationFilterPanelService from 'js/awSearchLocationFilterPanelService';
import tableSvc from 'js/splmTablePublishedService';
import cdm from 'soa/kernel/clientDataModel';
import _localeSvc from 'js/localeService';
/**
 * @private
 */
const URL_PARAMETER_PREFIX = 'UrlParameter_';

/**
 * @private
 */
const XRT_PAGE_ID = 'ActiveXrtPageId';

/**
 * Update the state with a single ShapeSearch preference name/value pair
 *
 * @function applyShapeSearchFilter
 *
 * @param {String} prefName - preference name
 * @param {String} value - preference value
 */
export let applyShapeSearchFilter = function( prefName, value ) {
    AwpOShapeSearchService.applyShapeSearchFilterPairs( [ prefName ], [ value ] );
};

/**
 * Update the state with an array of ShapeSearch prefence name/value pairs
 *
 * @function applyShapeSearchFilter
 * @param {ObjectArray} prefNameValuePairArray - preference name value pair
 */
export let applyShapeSearchFilters = function( prefNameValuePairArray ) {
    var prefNames = [];
    var values = [];
    prefNameValuePairArray.map( function( prefNameValuePair ) {
        prefNames.push( prefNameValuePair.prefName );
        values.push( prefNameValuePair.value );
    } );
    AwpOShapeSearchService.applyShapeSearchFilterPairs( prefNames, values );
};

/**
 * Update the state with new ShapeSearch value filters
 *
 * @function applyShapeSearchFilterPairs
 *
 * @param {StringArray} prefNames - preference name
 * @param {StringArray} values - preference value
 */
export let applyShapeSearchFilterPairs = function( prefNames, values ) {
    var params = AwStateService.instance.params;
    var filterParam = params.filter;
    var filters = filterParam.split( '~' );
    var foundFilter = false;
    for( var index = 0; index < prefNames.length; index++ ) {
        var prefName = prefNames[ index ];
        var value = values[ index ];
        for( var i in filters ) {
            var filter = filters[ i ];
            var filterSplit = filter.split( '=' );
            if( filterSplit[ 0 ] === prefName ) {
                foundFilter = true;
                filters[ i ] = prefName + '=' + value;
            }
        }

        if( !foundFilter ) {
            filters.push( prefName + '=' + value );
        }
    }

    var newFilters = '';
    for( let j = 0; j < filters.length; j++ ) {
        if( filters[ j ] !== '' ) {
            newFilters += filters[ j ];
            if( j !== filters.length - 1 ) {
                newFilters += '~';
            }
        }
    }
    AwStateService.instance.go( '.', {
        filter: newFilters
    } );
};

/**
 * Handle slider change event
 *
 * @function handleSS1ShapeSliderChangeEvent
 *
 * @param {Number} sliderValue - new slider value
 * @param {Object} shapeSliderProp - slider property
 * @param {Object} sizeSliderProp - slider property
 */
export let handleSS1ShapeSliderChangeEvent = _.debounce( function( sliderValue, shapeSliderProp, sizeSliderProp ) {
    AwpOShapeSearchService.handleSS1ShapeSliderChangeEvent2( sliderValue, shapeSliderProp, sizeSliderProp );
}, 1000 );

/**
 * Handle slider change event
 *
 * @function handleSS1ShapeSliderChangeEvent2
 *
 * @param {Number} sliderValue - new slider value
 * @param {Object} shapeSliderProp - slider property
 * @param {Object} sizeSliderProp - slider property
 * @returns {Object} updated slider property
 */
export let handleSS1ShapeSliderChangeEvent2 = function( sliderValue, shapeSliderProp, sizeSliderProp ) {
    if( typeof sliderValue !== 'undefined' && !isNaN( sliderValue ) && preferenceService ) {
        // update the preference an trigger the location to perform a search
        var sliderArray = [ sliderValue.toString() ];
        var existingPrefValues = preferenceService.getLoadedPrefs();
        var shapeSearchSizePrefValues = existingPrefValues.SS1_DASS_shape_default;

        if( sliderValue.toString() !== shapeSearchSizePrefValues[ 0 ] ) {
            preferenceService.setStringValue( 'SS1_DASS_shape_default', sliderArray ).then(
                function() {
                    if( sliderValue === 1 ) {
                        var SS1PartShapeFilter = {
                            prefName: 'SS1partShapeFilter',
                            value: sliderValue.toString()
                        };
                        var SS1ShapeBeginFilter = {
                            prefName: 'SS1shapeBeginFilter',
                            value: existingPrefValues.SS1_DASS_size_default_min
                        };
                        var SS1ShapeEndFilter = {
                            prefName: 'SS1shapeEndFilter',
                            value: existingPrefValues.SS1_DASS_size_default_max
                        };
                        var prefNameValuePairArray = [ SS1PartShapeFilter, SS1ShapeBeginFilter,
                            SS1ShapeEndFilter
                        ];
                        AwpOShapeSearchService.applyShapeSearchFilters( prefNameValuePairArray );
                    } else {
                        AwpOShapeSearchService.applyShapeSearchFilter( 'SS1partShapeFilter', sliderValue.toString() );
                    }
                } );
        }
    }

    return shapeSliderProp;
};

/**
 * Handle slider change event
 *
 * @function handleSS1SizeSliderChangeEvent
 *
 * @param {Number} sliderValue - new slider value
 * @param {Object} floorSliderProp - slider property
 */
export let handleSS1SizeSliderChangeEvent = _.debounce( function( sliderValue, floorSliderProp ) {
    AwpOShapeSearchService.handleSS1SizeSliderChangeEvent2( sliderValue, floorSliderProp );
}, 1000 );

/**
 * Handle slider change event
 *
 * @function handleSS1SizeSliderChangeEvent2
 *
 * @param {Number} sliderValue - new slider value
 * @param {Object} floorSliderProp - slider property
 * @returns {Object} updated slider property
 */
export let handleSS1SizeSliderChangeEvent2 = function( sliderValue, floorSliderProp ) {
    if( typeof sliderValue !== 'undefined' && !isNaN( sliderValue[ 0 ] ) && !isNaN( sliderValue[ 1 ] ) && preferenceService ) {
        // update the preference an trigger the location to perform a search
        var existingPrefValues = preferenceService.getLoadedPrefs();
        var ShapeSearchShapeMinPrefValues = existingPrefValues.SS1_DASS_size_default_min;
        var ShapeSearchShapeMaxPrefValues = existingPrefValues.SS1_DASS_size_default_max;
        var sliderArray;
        if( ShapeSearchShapeMinPrefValues[ 0 ] !== sliderValue[ 0 ].toString() ) {
            sliderArray = [ sliderValue[ 0 ].toString() ];
            preferenceService.setStringValue( 'SS1_DASS_size_default_min', sliderArray ).then( function() {
                AwpOShapeSearchService.applyShapeSearchFilter( 'SS1shapeBeginFilter', sliderValue[ 0 ].toString() );
            } );
        }
        if( ShapeSearchShapeMaxPrefValues[ 0 ] !== sliderValue[ 1 ].toString() ) {
            sliderArray = [ sliderValue[ 1 ].toString() ];
            preferenceService.setStringValue( 'SS1_DASS_size_default_max', sliderArray ).then( function() {
                AwpOShapeSearchService.applyShapeSearchFilter( 'SS1shapeEndFilter', sliderValue[ 1 ].toString() );
            } );
        }
    }
    return floorSliderProp;
};

/**
 * getSS1ShapeValue
 *
 * @function getSS1ShapeValue

 *
 * @return {Number} SS1ShapeValue
 */
export let getSS1ShapeValue = function( filterMap ) {
    if( typeof filterMap.SS1partShapeFilter !== 'undefined' ) {
        return parseInt( filterMap.SS1partShapeFilter[ 0 ].stringValue );
    }

    var existingPrefValues = preferenceService.getLoadedPrefs();
    return parseInt( existingPrefValues.SS1_DASS_shape_default[ 0 ] );
};

/**
 * getSS1SizeMinValue
 *
 * @function getSS1SizeMinValue

 *
 * @return {Number} SS1SizeMinValue
 */
export let getSS1SizeMinValue = function( filterMap ) {
    if( typeof filterMap.SS1shapeBeginFilter !== 'undefined' ) {
        return parseInt( filterMap.SS1shapeBeginFilter[ 0 ].stringValue );
    }

    var existingPrefValues = preferenceService.getLoadedPrefs();
    return parseInt( existingPrefValues.SS1_DASS_size_default_min[ 0 ] );
};

/**
 * getSS1SizeMaxValue
 *
 * @function getSS1SizeMaxValue

 *
 * @return {Number} SS1SizeMaxValue
 */
export let getSS1SizeMaxValue = function( filterMap ) {
    if( typeof filterMap.SS1shapeEndFilter !== 'undefined' ) {
        return parseInt( filterMap.SS1shapeEndFilter[ 0 ].stringValue );
    }

    var existingPrefValues = preferenceService.getLoadedPrefs();
    return parseInt( existingPrefValues.SS1_DASS_size_default_max[ 0 ] );
};

/**
 * getSS1SizeLowerLimit
 *
 * @function getSS1SizeLowerLimit

 *
 * @return {Number} SS1SizeLowerLimit
 */
export let getSS1SizeLowerLimit = function() {
    var existingPrefValues = preferenceService.getLoadedPrefs();
    return parseInt( existingPrefValues.SS1_DASS_size_lower_limit[ 0 ] );
};

/**
 * getSS1SizeUpperLimit
 *
 * @function getSS1SizeUpperLimit

 *
 * @return {Number} SS1SizeUpperLimit
 */
export let getSS1SizeUpperLimit = function() {
    var existingPrefValues = preferenceService.getLoadedPrefs();
    return parseInt( existingPrefValues.SS1_DASS_size_upper_limit[ 0 ] );
};

/**
 * getSS1SizeArrayValues
 *
 * @function getSS1SizeArrayValues

 *
 * @return {Object} SS1SizeArrayValues
 */
export let getSS1SizeArrayValues = function( filterMap ) {
    return [ AwpOShapeSearchService.getSS1SizeMinValue( filterMap ), AwpOShapeSearchService.getSS1SizeMaxValue( filterMap ) ];
};

/**
 * setSliderValues
 *
 * @function setSliderValues

 * @param {Object} data viewModel
 */
export let setSliderValues = ( subPanelContext, sliderProp1, sliderProp2 ) => {
    let filterMap = subPanelContext.searchState.searchFilterMap;
    let sliderProp1Updated = _.cloneDeep( sliderProp1 );
    let sliderProp2Updated = _.cloneDeep( sliderProp2 );
    sliderProp1Updated.dbValue[ 0 ].sliderOption.value = AwpOShapeSearchService.getSS1ShapeValue( filterMap );
    sliderProp2Updated.dbValue[ 0 ].sliderOption.values = [ AwpOShapeSearchService.getSS1SizeMinValue( filterMap ),
        AwpOShapeSearchService.getSS1SizeMaxValue( filterMap )
    ];
    return {
        sliderProp1: sliderProp1Updated,
        sliderProp2: sliderProp2Updated
    };
};

/**
 * updateFilterMapForShapeSearch
 *
 * @function updateFilterMapForShapeSearch
 *
 * @param {Object}prop - prop
 */
export let updateFilterMapForShapeSearch = function( prop ) {
    delete prop.searchStringInContent;
    var existingPrefValues = preferenceService.getLoadedPrefs();
    var ShapeSearchSizePrefValues = existingPrefValues.SS1_DASS_shape_default;
    var ShapeSearchShapeMinPrefValues = existingPrefValues.SS1_DASS_size_default_min;
    var ShapeSearchShapeMaxPrefValues = existingPrefValues.SS1_DASS_size_default_max;

    delete prop.ShapeSearchProvider;
    if( prop[ 'Geolus Criteria' ] ) {
        delete prop[ 'Geolus Criteria' ];
    } else if( prop[ 'Geolus XML Criteria' ] ) {
        delete prop[ 'Geolus XML Criteria' ];
    }

    if( typeof prop.SS1partShapeFilter === 'undefined' ) {
        prop.SS1partShapeFilter = AwpOShapeSearchService.populateShapeSearchFilter( ShapeSearchSizePrefValues[ 0 ] );
    }

    if( typeof prop.SS1shapeBeginFilter === 'undefined' ) {
        prop.SS1shapeBeginFilter = AwpOShapeSearchService.populateShapeSearchFilter( ShapeSearchShapeMinPrefValues[ 0 ] );
    }

    if( typeof prop.SS1shapeEndFilter === 'undefined' ) {
        prop.SS1shapeEndFilter = AwpOShapeSearchService.populateShapeSearchFilter( ShapeSearchShapeMaxPrefValues[ 0 ] );
    }
    return prop;
};

export let doShapeSearch = function( targetState, searchCriteria, searchBoxContent ) {
    let shapeSearchFilterMap = AwpOShapeSearchService.updateFilterMapForShapeSearch( {} );
    let shapeSearchSelectedFilterMap = {};
    Object.keys( shapeSearchFilterMap ).forEach( function( key ) {
        shapeSearchSelectedFilterMap[ key ] = [ shapeSearchFilterMap[ key ][ 0 ].stringValue ];
    } );
    AwStateService.instance.go( targetState ? targetState : '.', {
        filter: searchFilterService.buildFilterString( shapeSearchSelectedFilterMap ),
        searchCriteria: searchCriteria,
        secondaryCriteria: '*',
        searchBoxContent: searchBoxContent
    } );
};
/**
 * populateShapeSearchFilter
 *
 * @function populateShapeSearchFilter

 *
 * @param {Object}stringValuePref - string value for shapeSearch filter
 *
 * @return {Object} shape search filter with values populated
 */
export let populateShapeSearchFilter = function( stringValuePref ) {
    return [ {
        searchFilterType: 'StringFilter',
        stringValue: stringValuePref,
        selected: false,
        stringDisplayValue: '',
        startDateValue: '',
        endDateValue: '',
        startNumericValue: 0,
        endNumericValue: 0,
        count: 0,
        startEndRange: ''
    } ];
};

/**
 * Get Search Criteria for shape search
 *
 * @function getSearchCriteriaForShapeSearch
 * @param {Object}prop - prop
 * @param {Object}searchContext - searchContext
 * @return {Object} search criteria
 */
export let getSearchCriteriaForShapeSearch = function( prop, searchContext ) {
    var shapeSearchCtx = appCtxService.getCtx( 'shapeSearch' );
    if( !shapeSearchCtx ) {
        shapeSearchCtx = {};
        appCtxService.registerCtx( 'shapeSearch', shapeSearchCtx );
    }
    var filterPropArray = null;
    var filterPropValue = null;
    if( prop && Object.keys( prop ).length > 0 ) {
        for( var filterVarName in prop ) {
            if( prop.searchStringInContent && prop.searchStringInContent.length > 0 ) {
                //in-content search is on.
                if( prop.searchStringInContent[ 0 ].stringValue === '*' || prop.searchStringInContent[ 0 ] === '*' ) {
                    filterPropValue = {
                        searchString: shapeSearchCtx.geolusCriteria
                    };
                } else {
                    let searchString = shapeSearchCtx.geolusCriteria;
                    if( !searchString ) {
                        searchString = prop[ 'Geolus Criteria' ][ 0 ].stringValue;
                    }
                    if( !searchString ) {
                        searchString = prop[ 'Geolus Criteria' ][ 0 ];
                    }
                    let searchStringInContent = prop.searchStringInContent[ 0 ].stringValue;
                    if( !searchStringInContent ) {
                        searchStringInContent = prop.searchStringInContent[ 0 ];
                    }
                    filterPropValue = {
                        searchString: searchString,
                        searchStringInContent: searchStringInContent
                    };
                }
                return AwpOShapeSearchService.setSavedSearchUidForShapeSearchCriteria( filterPropValue );
            }
            if( filterVarName === 'Geolus Criteria' ) {
                filterPropArray = prop[ filterVarName ];
                if( filterPropArray && filterPropArray.length > 0 ) {
                    if( filterPropArray[ 0 ].stringValue ) {
                        filterPropValue = {
                            searchString: filterPropArray[ 0 ].stringValue
                        };
                        shapeSearchCtx.geolusCriteria = filterPropArray[ 0 ].stringValue;
                    } else {
                        filterPropValue = {
                            searchString: filterPropArray[ 0 ]
                        };
                        shapeSearchCtx.geolusCriteria = filterPropArray[ 0 ];
                    }
                    return AwpOShapeSearchService.setSavedSearchUidForShapeSearchCriteria( filterPropValue );
                }
            } else if( filterVarName === 'Geolus XML Criteria' ) {
                filterPropArray = prop[ filterVarName ];
                if( filterPropArray && filterPropArray.length > 0 ) {
                    let searchString = filterPropArray[ 0 ].stringValue;
                    if( !searchString ) {
                        searchString = filterPropArray[ 0 ];
                    }
                    filterPropValue = {
                        fmsTicketAsSearchString: searchString
                    };
                    shapeSearchCtx.geolusCriteria = searchString;
                    return filterPropValue;
                }
            }
        }
    }
    return undefined;
};

/**
 * set the saved search uid for shape search criteria
 *
 * @function setSavedSearchUidForShapeSearchCriteria
 * @param {Object}filterPropValue - filterPropValue
 * @return {Object} filterPropValue with saved search uid
 */
export let setSavedSearchUidForShapeSearchCriteria = function( filterPropValue ) {
    // var savedSearchContext = appCtxService.getCtx( 'savedSearch' );
    // if( savedSearchContext && savedSearchContext.savedSearchUid ) {
    //     var searchSearchCtx = appCtxService.getCtx( 'searchSearch' );
    //     if( searchSearchCtx && searchSearchCtx.savedSearchUid ) {
    //         filterPropValue.savedSearchUid = searchSearchCtx.savedSearchUid;
    //     } else {
    //         filterPropValue.savedSearchUid = savedSearchContext.savedSearchUid;
    //     }
    // }
    return filterPropValue;
};

export let validateCriteriaAndInitiateSearch = () => {
    const stateParams = AwStateService.instance.params;
    const autoOpenFilterPanel = awSearchLocationFilterPanelService.readAutoOpenFilterPanelPrefValue();
    const shapeSearchCriteria = stateParams.searchCriteria;
    const shapeSearchFilterCriteria = stateParams.filter;
    return shapeSearchCriteria && shapeSearchCriteria.length > 0 &&
        shapeSearchFilterCriteria && shapeSearchFilterCriteria.length > 0 && autoOpenFilterPanel;
};

export let checkForValidCriteria = function( subPanelContext ) {
    return subPanelContext.searchState.criteria.searchString && subPanelContext.searchState.criteria.searchString.length > 0;
};

export const checkShapeVisibilityForPalette = async function( data, addPanelState ) {
    if( data.selectedTab.tabKey === 'palettePage' && addPanelState.sourceObjects && addPanelState.sourceObjects[ 0 ] !== undefined ) {
        return await isShapeSearchCandidate( addPanelState.sourceObjects[ 0 ] );
    }
    return false;
};

/**
 * While user is in Palette tab, check if selected object is a valid shape Search Candidate
 * @param {object} selectedObject Object selected in Palette tab
 * @returns {promise} Returns the promise with valid candidiate for Shape Search
 */
const isShapeSearchCandidate = function( selectedObject ) {
    const deferred = AwPromiseService.instance.defer();

    const input = AwpOShapeSearchService.getVisibleCommandsSoaInput( [ 'SS1ShapeSearch' ], selectedObject );
    soaService.postUnchecked( 'Internal-AWS2-2024-12-UiConfig', 'getVisibleCommands2', input, {} )
        .then( function( response ) {
            if ( response.visibleCommandsInContext )  {
                const visibleCommandsInContext = response.visibleCommandsInContext;
                for ( let entry of visibleCommandsInContext ) {
                    if ( entry.commands && entry.commands.includes( 'SS1ShapeSearch' ) ) {
                        return deferred.resolve( true );
                    }
                }
            }
            deferred.resolve( false );
        } );
    return deferred.promise;
};

/**
 * Get the SOA input
 *
 * @param {List<String>} commandIds Specific IDs to include in the call instead of all commands
 * @param {object} selectedObject selected object
 * @return {Object[]} Array of filtered Objects.
 */
export const getVisibleCommandsSoaInput = function( commandIds, selectedObject ) {
    return {
        getVisibleCommands2Input: [ {
            clientScopeURI: appCtxService.getCtx( 'sublocation.clientScopeURI' ) || '',
            selectionInfo: getSelectionInfo( selectedObject ),
            commandContextInfo: getCommandContext(),
            commands: commandIds
        } ]
    };
};

/**
 * Get the selection information for SOA input
 * @param {object} selectedObject selected object
 * @return {Object[]} Array of filtered Objects.
 */
const getSelectionInfo = function( selectedObject ) {
    const selInfo = [];
    selInfo.push( {
        parentSelectionIndex: -1,
        selectedObjects: [ { type: 'unknownType', uid: selectedObject.uid } ]
    } );
    return selInfo;
};

/**
 * Get the selection information for SOA input
 *
 * @return {Object[]} Array of filtered Objects.
 */
const getCommandContext = function() {
    const hostingInfo = [ {
        contextName: 'IsHosted',
        contextValue: appCtxService.getCtx( 'aw_hosting_enabled' ) ? 'true' : 'false'
    }, {
        contextName: 'HostType',
        contextValue: appCtxService.getCtx( 'aw_host_type' ) || ''
    }, {
        contextName: 'commandBarId',
        contextValue: 'commandBarId_1'
    }  ];

    //uid is always included since many teams have used to avoid writing conditions against what is selected vs the opened object
    const urlInfo = ( appCtxService.getCtx( 'commandContextParameters' ) || [] ).concat( [ 'uid' ] ).map( function( param ) {
        if( _.includes( param, XRT_PAGE_ID ) ) {
            return {
                contextName: XRT_PAGE_ID,
                contextValue: _.replace( param, XRT_PAGE_ID + ':', '' )
            };
        }
        return {
            contextName: URL_PARAMETER_PREFIX + param,
            contextValue: appCtxService.getCtx( 'state.processed.' + param ) || ''
        };
    } );

    return hostingInfo.concat( urlInfo );
};

/**
 * Get the command information for SOA input
 *
 * @param {List<String>} commandIds Specific IDs to include in the call instead of all commands
 * @return {Object[]} Command info
 */
const getCommandInfo = function( commandIds ) {
    return _.uniq( commandIds ).sort().map( function( commandId ) {
        return {
            commandCollectionId: '',
            commandId: commandId
        };
    } );
};

const _getTab = ( tabKey, pageId, viewName, tabTitle, priority, isSelected ) => {
    return {
        tabKey,
        pageId,
        view: viewName,
        name: tabTitle,
        recreatePanel: true,
        priority,
        selectedTab: isSelected
    };
};

export let initShapesPanel = function( data ) {
    let tabsModel = [];
    tabsModel.push( _getTab( 'results', 'results', undefined, 'Results', 0 ) );
    //tabsModel.push( _getTab( 'filters', 'filters', undefined, 'Filters', 0 ) );
    return tabsModel;
};

export let updateSearchCriteriaForObjectsReported = function( searchState, searchStateUpdater ) {
    if( searchState.totalLoaded ) {
        const newSearchState = { ...searchState };
        newSearchState.criteria.totalObjectsFoundReportedToClient = searchState.endIndex.toString();
        searchStateUpdater.searchState( newSearchState );
    }
};

export let updateSearchCriteriaSearchString = function( searchState, searchStateUpdater ) {
    if( searchState.criteria ) {
        const newSearchState = { ...searchState };
        newSearchState.criteria.totalObjectsFoundReportedToClient = '0';
        searchStateUpdater.searchState( newSearchState );
    }
};

export let activateShapeSearchAction = ( searchState, subPanelContext, ShapeSearchResultDialogAction ) => {
    let markUpOptions = {
        view: 'SS1ShapeSearchInShapeLocation',
        parent: '.aw-layout-workarea',
        placement: 'left',
        width: 'SMALL',
        height: 'FULL',
        push: true,
        isCloseVisible: false,
        subPanelContext : { ...subPanelContext, searchState:searchState },
        commandid: 'SS1ShapeSearchInShapeLocation',
        commandicon: 'cmdSelectParts'
    };
    return ShapeSearchResultDialogAction.show( markUpOptions ).then( ( { id } )=>{
        let newSearchState = searchState.getValue();
        newSearchState.shapeSearchPopupId = id;
        searchState.update( newSearchState );
    } );
};

var _markOutlierRenderer = {
    action: function( column, vmo, tableElem ) {
        var preferencesCtx = appCtxService.getCtx( 'preferences' );
        var searchCtx = appCtxService.getCtx( 'search' );
        var cellContent = tableSvc.createElement( column, vmo, tableElem );
        let propertiesToAddArrayString = preferencesCtx.SS1_Mark_Outliers_Properties;

        if( searchCtx && searchCtx.shapeSearchObjectUid && searchCtx.shapeSearchObjectUid !== vmo.uid ) {
            _.forEach( propertiesToAddArrayString, function( propertyToAddString ) {
                let propertyCommaSeparatedArray = propertyToAddString.split( ', ' );
                let propertyValue = propertyCommaSeparatedArray[0];
                // Example: ItemRevision.scp0CalculatedWeight
                let propertyTypeNameArray = propertyValue.split( '.' );

                if( propertyTypeNameArray[1] === column.propertyName && cellContent.children.length > 0 ) {
                // Check for outliers
                // Acquire target
                    let targetedValue = 1;
                    let shapeSearchTargetObj = cdm.getObject( searchCtx.shapeSearchObjectUid );
                    if( shapeSearchTargetObj && shapeSearchTargetObj.props && shapeSearchTargetObj.props[column.propertyName] ) {
                        targetedValue = shapeSearchTargetObj.props[column.propertyName].dbValues[0];
                    }

                    if( vmo && vmo.props && vmo.props[column.propertyName] ) {
                        let outlierLabel = document.createElement( 'span' );
                        // Calculate percentage
                        let currentValue = vmo.props[column.propertyName].dbValues[0];
                        let percentDiffFromTarget = 0;
                        let isNotANumber = false;
                        if( currentValue !== targetedValue ) {
                            // Cannot simply check value is equal to zero due to possibility of float
                            if( !( targetedValue > 0 || targetedValue < 0 ) ) {
                                // Avoid dividing by zero
                                percentDiffFromTarget = _localeSvc.getLoadedText( 'SearchMessages' ).NotApplicable;
                                isNotANumber = true;
                                // Value is an outlier
                                outlierLabel.classList.add( 'aw-search-markOutlierNoCalc' );
                                outlierLabel.classList.add( 'aw-search-markOutlierLabel' );
                            } else {
                                percentDiffFromTarget = Math.round( currentValue / targetedValue * 100 - 100 );
                            }
                        }

                        let lowerOutlierThreshold = propertyCommaSeparatedArray[1];
                        let upperOutlierThreshold = propertyCommaSeparatedArray[2];

                        // Create label text containing percentage
                        let labelText = document.createElement( 'div' );
                        labelText.textContent = percentDiffFromTarget;
                        if( !isNotANumber ) {
                            labelText.textContent += '%';
                        }
                        labelText.classList.add( 'aw-splm-tableCellText' );
                        labelText.classList.add( 'aw-search-markOutlierText' );

                        if ( percentDiffFromTarget < lowerOutlierThreshold || percentDiffFromTarget > upperOutlierThreshold || isNotANumber ) {
                        // Value is an outlier
                            outlierLabel.classList.add( 'aw-search-markOutlierColor' );
                            outlierLabel.classList.add( 'aw-search-markOutlierLabel' );
                        } else {
                        // Value is within range
                            outlierLabel.classList.add( 'aw-search-nonOutlierColor' );
                            outlierLabel.classList.add( 'aw-search-markOutlierLabel' );
                        }
                        outlierLabel.appendChild( labelText );
                        cellContent.children[0].append( outlierLabel );
                    }
                }
            } );
        }

        return cellContent;
    },
    condition: function() {
        var workspaceCtx = appCtxService.getCtx( 'workspace' );
        var preferencesCtx = appCtxService.getCtx( 'preferences' );
        return workspaceCtx && workspaceCtx.workspaceId === 'PricingCompanionWorkspace' &&
        preferencesCtx && preferencesCtx.SS1_Mark_Outliers_Properties;
    },
    name: 'markOutlierRenderer'
};

export let markColumnsWithOutliers = ( propColumns, searchTargetUid ) => {
    let columnsToRender = [];

    // Get list of columns to update from preference
    appCtxService.updatePartialCtx( 'search.shapeSearchObjectUid', searchTargetUid );
    var preferencesCtx = appCtxService.getCtx( 'preferences' );
    let propertiesToAddArrayString = preferencesCtx.SS1_Mark_Outliers_Properties;

    _.forEach( propertiesToAddArrayString, function( propertyToAddString ) {
        let propertyCommaSeparatedArray = propertyToAddString.split( ', ' );
        let propertyValue = propertyCommaSeparatedArray[0];
        // Example: ItemRevision.scp0CalculatedWeight
        let propertyTypeNameArray = propertyValue.split( '.' );
        _.forEach( propColumns, function( propColumn ) {
            // Add column to list so we can mark outliers
            if( propertyTypeNameArray[1] === propColumn.propertyName ) {
                columnsToRender.push( propColumn );
            }
        } );
    } );


    for( var index = 0; index < columnsToRender.length; index++ ) {
        // Add renderer to column
        var column = columnsToRender[ index ];
        column.cellRenderers = [];
        column.cellRenderers.push( _markOutlierRenderer );
    }
};

export const initializeShapeCandidateSearchState = () => {
    let searchContext = {
        showChartColorBars: false,
        forceNoChart: true,
        hideFilterCount: true,
        criteria: {
            searchFromLocation: 'shapeSearch',
            totalObjectsFoundReportedToClient: '0',
            limitedFilterCategoriesEnabled: 'true',
            forceThreshold: 'true',
            searchString: ''
        },
        provider: 'SS1ShapeSearchDataProvider',
        sortType: 'Priority',
        hideResultsCount: true,
        showLoadingText: true,
        autoApplyFilters: true,
        label: {
            source: '/i18n/SearchMessages',
            key: 'resultsText'
        },
        breadcrumbConfig: {
            type: 'search',
            vm: 'AwSearchBreadcrumb'
        }
    };
    let newSearchState = { ...searchContext };
    newSearchState.activeFilterMap = {};
    newSearchState.filterString = '';
    let selectedFiltersInfo = searchCommonUtils.createActiveFiltersFromActiveFilterMap( newSearchState.activeFilterMap );
    newSearchState.filterString = selectedFiltersInfo.filterString;
    newSearchState.activeFilters = selectedFiltersInfo.activeFilters;
    if( newSearchState.criteria ) {
        newSearchState.criteriaJSONString = JSON.stringify( newSearchState.criteria );
    }
    return newSearchState;
};

export const reInitializeSearchState = ( searchState, tabKey ) => {
    if( tabKey === 'searchPage' ) {
        return AwpOShapeSearchService.initializeShapeCandidateSearchState();
    }
    return searchState;
};


const AwpOShapeSearchService = {
    applyShapeSearchFilter,
    applyShapeSearchFilters,
    applyShapeSearchFilterPairs,
    handleSS1ShapeSliderChangeEvent,
    handleSS1ShapeSliderChangeEvent2,
    handleSS1SizeSliderChangeEvent,
    handleSS1SizeSliderChangeEvent2,
    getSS1ShapeValue,
    getSS1SizeMinValue,
    getSS1SizeMaxValue,
    getSS1SizeLowerLimit,
    getSS1SizeUpperLimit,
    getSS1SizeArrayValues,
    setSliderValues,
    updateFilterMapForShapeSearch,
    populateShapeSearchFilter,
    getSearchCriteriaForShapeSearch,
    setSavedSearchUidForShapeSearchCriteria,
    doShapeSearch,
    validateCriteriaAndInitiateSearch,
    checkForValidCriteria,
    checkShapeVisibilityForPalette,
    initShapesPanel,
    updateSearchCriteriaForObjectsReported,
    updateSearchCriteriaSearchString,
    getVisibleCommandsSoaInput,
    activateShapeSearchAction,
    markColumnsWithOutliers,
    initializeShapeCandidateSearchState,
    reInitializeSearchState
};

export default AwpOShapeSearchService;
