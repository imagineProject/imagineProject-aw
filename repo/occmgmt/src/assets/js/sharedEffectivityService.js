// Copyright (c) 2022 Siemens

/**
 * @module js/sharedEffectivityService
 */
import AwFilterService from 'js/awFilterService';
import appCtxSvc from 'js/appCtxService';
import tcVmoService from 'js/tcViewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import dataManagementSvc from 'soa/dataManagementService';
import aceEffectivityService from 'js/aceEffectivityService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import _expressionEffectivityService from 'js/expressionEffectivityService';
import soaSvc from 'soa/kernel/soaService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';
import eventBus from 'js/eventBus';

var exports = {};

//set end item
var setEndItem = function( itemOrRevision, data, subPanelContext ) {
    itemOrRevision = itemOrRevision || {};
    if( itemOrRevision && itemOrRevision.modelType && itemOrRevision.modelType.typeHierarchyArray && itemOrRevision.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        itemOrRevision = cdm.getObject( itemOrRevision.props.awb0UnderlyingObject.dbValues[0] );
    }
    var item = itemOrRevision.props && itemOrRevision.props.items_tag ? cdm.getObject( itemOrRevision.props.items_tag.dbValues[0] ) : itemOrRevision;


    if( !_.isUndefined( item.uid ) ) {
        dataManagementSvc.getProperties( [ item.uid ], [ 'object_string' ] ).then( function() {
            var dbValue = item.props.object_string.dbValues[ 0 ];
            let sharedData = subPanelContext.sharedData;
            let sharedDataValue = { ...sharedData.getValue() };
            sharedDataValue.endItemVal.endItem = {
                type: item.type || '',
                uid : item.uid
            };
            sharedDataValue.endItemVal.dbValue = dbValue;
            sharedDataValue.endItemVal.uiValue = dbValue;
            sharedData.update( { ...sharedDataValue } );
            if( data && data.endItemVal ) {
                let endItemValue = _.cloneDeep( data.endItemVal );
                endItemValue.dbValue = dbValue;
                endItemValue.uiValue = dbValue;
                data.dispatch( { path: 'data.endItemVal', value: endItemValue } );
            }
            eventBus.publish( 'navigateAfterEndItemRevLoaded' );
        } );
    }
};

//set end item for date
var setEndItemForDate = function( itemOrRevision, data, subPanelContext ) {
    itemOrRevision = itemOrRevision || {};
    if( itemOrRevision && itemOrRevision.modelType && itemOrRevision.modelType.typeHierarchyArray && itemOrRevision.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
        itemOrRevision = cdm.getObject( itemOrRevision.props.awb0UnderlyingObject.dbValues[0] );
    }
    var item = itemOrRevision.props && itemOrRevision.props.items_tag ? cdm.getObject( itemOrRevision.props.items_tag.dbValues[0] ) : itemOrRevision;


    if( !_.isUndefined( item.uid ) ) {
        dataManagementSvc.getProperties( [ item.uid ], [ 'object_string' ] ).then( function() {
            var dbValue = item.props.object_string.dbValues[ 0 ];
            let sharedData = subPanelContext.sharedData;
            let sharedDataValue = { ...sharedData.getValue() };

            sharedDataValue.endItemValForDate.endItem = {
                type: item.type || '',
                uid : item.uid
            };
            sharedDataValue.endItemValForDate.dbValue = dbValue;
            sharedDataValue.endItemValForDate.uiValue = dbValue;
            sharedData.update( { ...sharedDataValue } );
            if( data && data.endItemValForDate ) {
                let endItemValueForDate = _.cloneDeep( data.endItemValForDate );
                endItemValueForDate.dbValue = dbValue;
                endItemValueForDate.uiValue = dbValue;
                data.dispatch( { path: 'data.endItemValueForDate', value: endItemValueForDate } );
            }
            eventBus.publish( 'navigateAfterEndItemRevLoaded' );
        } );
    }
};

/* Loads EndItem with the top level context as default*/
export let loadTopLevelAsEndItem = function( data, subPanelContext ) {
    var topItemRevision = cdm.getObject( subPanelContext.occContext.productContextInfo.props.awb0Product.dbValues[ 0 ] );
    var topEndItem = cdm.getObject( topItemRevision.props.items_tag.dbValues[ 0 ] );
    setEndItem( topEndItem, data, subPanelContext );
};

//end item panel
var getElementFromPallete = function( eventData ) {
    var selectedObject = null;
    if( eventData.selectedObjects.length !== 0 ) {
        selectedObject = eventData.selectedObjects[0];
    }
    return selectedObject;
};

//author
export let getEffectivityName = function( data ) {
    if( data.isSharedForUnit && data.isSharedForUnit.dbValue ) {
        return data.nameBoxForUnit.dbValue;
    }
    if( data.isShared && data.isShared.dbValue ) {
        return data.nameBox.dbValue;
    }
    return '';
};

//author
export let getDateRangeText = function( data, subPanelContext ) {
    var dateRange = [];
    var endDate = data.endDate.dbValue;
    var startDate = data.startDate.dbValue;

    if( subPanelContext.sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue ) {
        dateRange[ 0 ] = AwFilterService.instance( 'date' )( startDate, 'yyyy-MM-dd' ) + 'T' +
            AwFilterService.instance( 'date' )( startDate, 'HH:mm:ssZ' );

        if( data.endDateOptions.dbValue === 'UP' ) {
            data.endDate.openEndedStatus = 1;
        } else if( data.endDateOptions.dbValue === 'SO' ) {
            data.endDate.openEndedStatus = 2;
        } else {
            dateRange[ 1 ] = AwFilterService.instance( 'date' )( endDate, 'yyyy-MM-dd' ) + 'T' +
                AwFilterService.instance( 'date' )( endDate, 'HH:mm:ssZ' );
            data.endDate.openEndedStatus = 0;
        }
    }
    return dateRange;
};

let setSelectedEndItemAndNavigateToAddEffctivityPanel  = function( endItemRev, data, subPanelContext ) {
    var endItemLoaded = eventBus.subscribe( 'navigateAfterEndItemRevLoaded', function() {
        eventBus.publish( 'navigateAddEffectivityPanel' );
        eventBus.unsubscribe( endItemLoaded );
    } );
    if( subPanelContext.sharedData.dateOrUnitEffectivityTypeRadioButton.dbValue ) {
        setEndItemForDate( endItemRev, data, subPanelContext );
    } else{
        setEndItem( endItemRev, data, subPanelContext );
    }
};

/* Author end item from pallete and navigates to Add Effectivity panel */
export let updateEndItemAndNavigateToNewPanel = function( eventData, subPanelContext, data ) {
    var endItemRev = getElementFromPallete( eventData );
    setSelectedEndItemAndNavigateToAddEffctivityPanel( endItemRev, data, subPanelContext );
};

//Author end item from search panel and navigates to Add Effectivity panel
export let setEndItemAndNavigateToNewPanel = function( data, subPanelContext ) {
    var endItemRev = data.dataProviders.searchEndItems.selectedObjects[ 0 ];
    setSelectedEndItemAndNavigateToAddEffctivityPanel( endItemRev, data, subPanelContext );
};

/**
 * Set the selected release status.
 * * @param {obejct} releaseStatus - the selected status
 */
//release effectivity
export let setReleaseStatusToAppContext = function( data, subPanelContext ) {
    if( data.releaseStatus.dbValue !== '' ) {
        let sharedData = subPanelContext.sharedData;
        let sharedDataValue = { ...sharedData.getValue() };

        var selectedPWAObject = null;
        if( subPanelContext.selectionData && subPanelContext.selectionData.selected ) {
            selectedPWAObject = subPanelContext.selectionData.selected[0];
        } else if( subPanelContext.selection ) {
            selectedPWAObject = subPanelContext.selection[0];
        } else if( subPanelContext.selected ) {
            selectedPWAObject = subPanelContext.selected;
        }
        var releaseStatusProp = selectedPWAObject.props.release_status_list ||
            selectedPWAObject.props.awb0ArchetypeRevRelStatus;

        // populate ui value of selected release status
        var uiValue;
        for( var i = 0; i < releaseStatusProp.dbValues.length; i++ ) {
            if( releaseStatusProp.dbValues[ i ] === data.releaseStatus.dbValue ) {
                uiValue = releaseStatusProp.uiValues[ i ];
                break;
            }
        }

        var releaseStatusObj = cdm.getObject( data.releaseStatus.dbValue );
        sharedDataValue.releaseStatus = releaseStatusObj;
        if ( uiValue !== undefined ) {
            sharedDataValue.releaseStatus.uiValue = uiValue;
        }
        if ( releaseStatusObj !== null ) {
            sharedDataValue.releaseStatus.dbValue = sharedDataValue.releaseStatus.uid;
        }
        sharedData.update( { ...sharedDataValue } );

        eventBus.publish( 'editEffectivityContext.selectedReleaseStatusUpdated' );
    }
};
//release effectivity
export let setReleaseStatusListFromSelectedObjectInPWA = function( data, subPanelContext ) {
    let sharedData = subPanelContext.sharedData;
    if ( sharedData.releaseStatus && sharedData.releaseStatus.dbValue !== null && sharedData.releaseStatus.uiValue !== null ) {
        return {
            releaseStatusList:  sharedData.releaseStatusList,
            releaseStatusUiValue: sharedData.releaseStatus.uiValue,
            releaseStatusDbValue: sharedData.releaseStatus.dbValue
        };
    }
    let sharedDataValue = { ...sharedData.getValue() };
    var selectedPWAObject = null;
    if( subPanelContext.selectionData && subPanelContext.selectionData.selected ) {
        selectedPWAObject = subPanelContext.selectionData.selected[0];
    } else if( subPanelContext.selection ) {
        selectedPWAObject = subPanelContext.selection[0];
    } else if( subPanelContext.selected ) {
        selectedPWAObject = subPanelContext.selected;
    }
    return tcVmoService.getViewModelProperties( [ selectedPWAObject ], [ 'release_status_list', 'awb0ArchetypeRevRelStatus' ] ).then( function() {
        var releaseStatusProp;
        if( selectedPWAObject.props.awb0ArchetypeRevRelStatus ) {
            releaseStatusProp = selectedPWAObject.props.awb0ArchetypeRevRelStatus;
        } else {
            releaseStatusProp = selectedPWAObject.props.release_status_list;
        }

        var releaseStatusList = [];
        var i = 0;
        for( i = 0; i < releaseStatusProp.dbValues.length; i++ ) {
            releaseStatusList.push( {
                propInternalValue: releaseStatusProp.dbValues[ i ],
                propDisplayValue: releaseStatusProp.uiValues[ i ]
            } );
        }

        if( releaseStatusProp.dbValues.length > 0 ) {
            var releaseStatusObj = cdm.getObject( releaseStatusList[ 0 ].propInternalValue );
            sharedDataValue.releaseStatus = releaseStatusObj;
            sharedDataValue.releaseStatusList = releaseStatusList;
            sharedDataValue.releaseStatus.uiValue = releaseStatusList[ 0 ].propDisplayValue;
            sharedDataValue.releaseStatus.dbValue = releaseStatusList[ 0 ].propInternalValue;
            sharedData.update( { ...sharedDataValue } );

            eventBus.publish( 'editEffectivityContext.selectedReleaseStatusUpdated' );

            return {
                releaseStatusList: releaseStatusList,
                releaseStatusUiValue: releaseStatusList[ 0 ].propDisplayValue,
                releaseStatusDbValue: releaseStatusList[ 0 ].propInternalValue
            };
        }
    } );
};

/**
 * Get the release effectivities.
 * * @param {object} data - the data object
 *  @return {Array T} effectivityObjectArray - effectivities array
 * */
export let getEffectivitiesArray = function( data ) {
    var objects = data.modelObjects;
    var effectivityObjectArray = [];
    var i = 0;
    for( var key in data.modelObjects ) {
        var object = objects[ key ];
        if( object.type === 'Effectivity' ) {
            effectivityObjectArray[ i ] = object;
            i++;
        }
    }
    return effectivityObjectArray;
};
//Refresh soa call after authoring of release effectivity
export let updateEffectivities = function( selectedModelObject, subPanelContext ) {
    var objectsToRefresh = [];
    var activeElements = [ selectedModelObject ];

    if( subPanelContext.occContext && subPanelContext.occContext.viewKey ) {
        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveView ) {
            var inactiveElements = occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( inactiveView, selectedModelObject );
            if( inactiveElements ) {
                objectsToRefresh = objectsToRefresh.concat( inactiveElements );
            }
        }
        activeElements = occmgmtSplitViewUpdateService.getAffectedElementsPresentInGivenView( subPanelContext.occContext.viewKey, selectedModelObject );
    }

    if( activeElements ) {
        objectsToRefresh = objectsToRefresh.concat( activeElements );
    }
    if( objectsToRefresh.length ) {
        var policy = {
            types: [ {
                name: 'ItemRevision',
                properties: [ { name: 'effectivity_text' } ]
            } ]
        };
        let actionPolicyId = propertyPolicySvc.register( policy, 'refreshObjects_Policy' );
        soaSvc.post( 'Core-2007-01-DataManagement', 'refreshObjects', {
            objects: objectsToRefresh
        } ).then( ()=>{ propertyPolicySvc.unregister( actionPolicyId ); }, ()=>{ propertyPolicySvc.unregister( actionPolicyId ); } );
    }
};

//Mouse hover on element effectivity icon
export let limitTotalFoundForTooltip = function( response, data ) {
    /*Update tooltip title*/
    var tooltipLabel = data.i18n.elementEffectivityTooltipTitle;
    var tooltipLink;
    var enableMoreLinkVal;
    var totalFound = response.totalFound || ( response.effectivitiesInfo[0].effectivityExprData && response.effectivitiesInfo[0].effectivityExprData.length > 0
        ? response.effectivitiesInfo[0].effectivityExprData : response.effectivitiesInfo[0].effectivityObjects ).length;
    tooltipLabel = tooltipLabel.replace( '{0}', totalFound );

    /*Enable link and limit total Found to 4*/
    if( totalFound > 4 ) {
        enableMoreLinkVal = true;
        tooltipLink = data.i18n.tooltipLinkText;
        tooltipLink = tooltipLink.replace( '{0}', totalFound - 4 );
        totalFound = 4;
    }
    response.totalFound = totalFound;
    return {
        totalFound: totalFound,
        tooltipLabel: tooltipLabel,
        tooltipLink: tooltipLink,
        enableMoreLinkVal: enableMoreLinkVal
    };
};

//Mouse hover on element effectivity icon
export let getEffectivitiesFromResponse = function( response, maxToLoad ) {
    var modifiedEffectivity = {};
    var allEffectivities = [];
    var effectivities = response.effectivitiesInfo[0].effectivityExprData && response.effectivitiesInfo[0].effectivityExprData.length > 0
        ? _expressionEffectivityService.getEffectivityDataForDisplay( {
            effectivityData : [ {
                effectivity: response.effectivitiesInfo[0].effectivityExprData
            } ]
        } ) : response.effectivitiesInfo[0].effectivityObjects;

    if( effectivities[0].uid ) {
        _.forEach( effectivities, function( effectivity ) {
            var effectivityNameArray = effectivity.props.awp0CellProperties.dbValues[0].split('\\:');
            var effectivityValueArray = effectivity.props.awp0CellProperties.dbValues[1].split('\\:');
            var effectivityEndItemArray = effectivity.props.awp0CellProperties.dbValues[2].split('\\:');
            modifiedEffectivity = {
                effectivityName : effectivityNameArray.length > 0 ? effectivityNameArray[1] : '',
                effectivityValue: effectivityValueArray.length > 0 ? effectivityValueArray[1] : '',
                effectivityEndItemValue: effectivityEndItemArray.length > 0 ? effectivityEndItemArray[1] : ''
            };
            allEffectivities.push( modifiedEffectivity );
        } );
    } else {
        _.forEach( effectivities, function( effectivity ) {
            modifiedEffectivity = {
                effEndDate :  effectivity.effEndDate ? effectivity.effEndDate : '',
                effStartDate :  effectivity.effStartDate ? effectivity.effStartDate : '',
                effEndItem:  effectivity.effEndItem ? effectivity.effEndItem : '',
                effUnitDisplayString: effectivity.effUnitDisplayString ? effectivity.effUnitDisplayString : ''
            };
            allEffectivities.push( modifiedEffectivity );
        } );
    }

    return {
        effectivityObject : effectivities.slice( 0, maxToLoad.dbValue ),
        allEffectivities: allEffectivities
    };
};

//Mouse hover on element effectivity icon
export let getActiveToolsAndInfoCommand = function( ) {
    var ctxObject = appCtxSvc.getCtx();
    var activeToolsAndInfoCommand = ctxObject.activeToolsAndInfoCommand ? ctxObject.activeToolsAndInfoCommand : {};
    return {
        activeToolsAndInfoCommand : activeToolsAndInfoCommand
    };
};

//Returns the multiple element selected message
export let getSelectedElements = function( data, subPanelContext ) {
    let elementSelectedMessage = '';
    if( data && data.elementSelected ) {
        elementSelectedMessage = data.elementSelected;
    }
    let totalFound = subPanelContext.occContext.pwaSelection.length;
    elementSelectedMessage = elementSelectedMessage.replace( '{0}', totalFound );
    return {
        elementSelectedMessage : elementSelectedMessage
    };
};

export default exports = {
    getEffectivitiesFromResponse,
    loadTopLevelAsEndItem,
    updateEndItemAndNavigateToNewPanel,
    getEffectivityName,
    getDateRangeText,
    setEndItemAndNavigateToNewPanel,
    setReleaseStatusToAppContext,
    setReleaseStatusListFromSelectedObjectInPWA,
    getEffectivitiesArray,
    updateEffectivities,
    limitTotalFoundForTooltip,
    getSelectedElements,
    getActiveToolsAndInfoCommand
};
