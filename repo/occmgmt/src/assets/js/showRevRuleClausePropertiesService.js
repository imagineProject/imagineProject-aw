// Copyright (c) 2022 Siemens

/**
 * @module js/showRevRuleClausePropertiesService
 */
import AwPromiseService from 'js/awPromiseService';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import dataManagementSvc from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import configurationBaselinesClauseService from 'js/configurationBaselinesClauseService';
import soaService from 'soa/kernel/soaService';

/**
 * Show the unit clause properties
 *
 * @param {Object} selection - User selection
 */
function showUnitProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'unit_no', selection[ 0 ].revRuleEntryKeyToValue.unit_no );
        eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
    }
}

/**
 * Show the date clause properties
 *
 * @param {Object} selection - User selection
 */
function showDateProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var date = uwPropertyService.createViewModelProperty( '', '', 'DATE', '', '' );
        date.uiValue = selection[ 0 ].revRuleEntryKeyToValue.date;
        date.dbValue = selection[ 0 ].revRuleEntryKeyToValue.date;
        if( selection[ 0 ].revRuleEntryKeyToValue.date ) {
            date.dateApi.dateValue = selection[ 0 ].revRuleEntryKeyToValue.date.slice( 0, 11 );
            date.dateApi.timeValue = selection[ 0 ].revRuleEntryKeyToValue.date.slice( 12 );
        } else {
            date.dateApi.dateValue = '';
            date.dateApi.timeValue = '';
        }
        var today = selection[ 0 ].revRuleEntryKeyToValue.today === 'true';
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'date', date );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'today', today );
        eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
    }
}

/**
 * Show the override clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showOverrideProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var folderUid = selection[ 0 ].revRuleEntryKeyToValue.folder;
        if( folderUid ) {
            var uidsToLoad = [ folderUid ];
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                var folder = loadedObjects[ 0 ];
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( folder, 'EDIT' );
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'folder', vmo );
            } );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'folder', undefined );
    }
}

/**
 * Show the EndItem clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showEndItemProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var endItemUid = selection[ 0 ].revRuleEntryKeyToValue.end_item;
        if( endItemUid ) {
            var uidsToLoad = [ endItemUid ];
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                var endItem = loadedObjects[ 0 ];
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( endItem, 'EDIT' );
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'end_item', vmo );
            } );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'end_item', undefined );
    }
}

/**
 * Show the Plant Location clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showPlantLocationProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var plantLocationUid = selection[ 0 ].revRuleEntryKeyToValue.plant_location;
        if( plantLocationUid ) {
            var uidsToLoad = [ plantLocationUid ];
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                var plantLocation = loadedObjects[ 0 ];
                var plantLocationData = {
                    plantLocationuid: plantLocation.uid,
                    plantLocationDisplay: plantLocation.props.object_string.uiValues[0]
                };
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'plantLocation', plantLocationData );
                eventBus.publish( 'RevisionRuleAdminEventClause.plantClausePropertyValueInitialized' );
            } );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'plantLocation', undefined );
            eventBus.publish( 'RevisionRuleAdminEventClause.plantClausePropertyValueInitialized' );
        }
    }
}

/**
 * Show the Configuration Baseline clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showConfigBaselineProperties( selection, data ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var ctx = revisionRuleAdminCtx.getCtx();
        if ( ctx.RevisionRuleAdmin.configBaselineList === undefined) {
            var soaInput = {
                initialData: {
                    propertyName : "fnd0BaselineType",
                    lovInput: {
                        owningObject: {
                            type: "Fnd0HasBaselineTypeEntry"
                        },
                        operationName: "Create",
                        boName: "Fnd0HasBaselineTypeEntry"
                    }
                }
            };
            soaService.postUnchecked( 'Core-2013-05-LOV', 'getInitialLOVValues', soaInput ).then( response =>{
                configurationBaselinesClauseService.processConfigBaselines( response, data );
                showBaselineProperties( selection, data );
            } );
        } else {
            showBaselineProperties( selection, data );
        }
    }
}

/**
 * Show the Configuration Baseline clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showBaselineProperties( selection, data ) {
    var configBaselineClausePropertyInitiatedEvent = 'RevisionRuleAdminEventClause.configBaselineClausePropertyValueInitialized';
    var ctx = revisionRuleAdminCtx.getCtx();
    var configBaselineDisplayValue = '';
    if ( ctx.RevisionRuleAdmin.configBaselineList && ctx.RevisionRuleAdmin.configBaselineList.length > 0 ) {
        for ( var i = 0; i < ctx.RevisionRuleAdmin.configBaselineList.length; i++ ) {
            if ( ctx.RevisionRuleAdmin.configBaselineList[i].propInternalValue === selection[ 0 ].revRuleEntryKeyToValue.baseline_type ) {
                configBaselineDisplayValue = ctx.RevisionRuleAdmin.configBaselineList[i].propDisplayValue;
            }
        }
    }
    var configBaseline = selection[ 0 ].revRuleEntryKeyToValue.baseline_type;
    var configBaselineState = selection[ 0 ].revRuleEntryKeyToValue.baseline_state;
    var configBaselineDate = selection[ 0 ].revRuleEntryKeyToValue.baseline_last_modify_date;
    var todayForLMD = selection[ 0 ].revRuleEntryKeyToValue.today;
    var configBaselineStateDisplayValue = showConfigBaselineStateDisplay( configBaselineState );

    if( configBaseline ) {
        var configBaselineData = {
            configBaselineuid: configBaseline,
            configBaselineDisplay: configBaselineDisplayValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaseline', configBaselineData );
        eventBus.publish( configBaselineClausePropertyInitiatedEvent );
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaseline', undefined );
        eventBus.publish( configBaselineClausePropertyInitiatedEvent );
    }
    var configBaselineStateData = {
        configBaselineStateuid: configBaselineState,
        configBaselineStateDisplay: configBaselineStateDisplayValue
    };
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaselineState', configBaselineStateData );
    eventBus.publish( configBaselineClausePropertyInitiatedEvent );

    if( configBaselineDate ) {
        var configBaselineDateData = {
            configBaselineDateuid: configBaselineDate,
            configBaselineDateDisplay: configBaselineDate
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaselineDate', configBaselineDateData );
        eventBus.publish( configBaselineClausePropertyInitiatedEvent );
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'configBaselineDate', undefined );
        eventBus.publish( configBaselineClausePropertyInitiatedEvent );
    }

    if( todayForLMD === 'true' ) {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'todayForLMD', true );
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'todayForLMD', false );
    }
}

/**
 * Get display value from internal value for configuration baseline clause
 *
 * @param {String} propInternalVal - Internal value of property
 *
 * @return {String} propDisplayVal - Display value of property
 */
export let showConfigBaselineStateDisplay = function ( propInternalVal ) {
    var resource = 'RevisionRuleAdminConstants';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    var propDisplayVal = '';
    switch ( propInternalVal ) {
        case '':
            propDisplayVal = localeTextBundle.any;
            break;
        case 'Open':
            propDisplayVal = localeTextBundle.configurationBaselineOpen;
            break;
        case 'Closed':
            propDisplayVal = localeTextBundle.configurationBaselineClose;
            break;
        default:
            break;
    }
    return propDisplayVal;
};

/**
 * Show the Configuration Baseline clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showConfigBaselineObjectProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var baselineUid = selection[ 0 ].revRuleEntryKeyToValue.baseline_object;
        if( baselineUid ) {
            var uidsToLoad = [ baselineUid ];
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                var baselineObject = loadedObjects[ 0 ];
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( baselineObject, 'EDIT' );
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'baselineObject', vmo );
            } );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'baselineObject', undefined );
    }
}

// eslint-disable-next-line require-jsdoc
function showReleaseEventProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var ctx = revisionRuleAdminCtx.getCtx();
        var uidsToLoad = [];
        var eventUid = selection[ 0 ].revRuleEntryKeyToValue.release_event;
        if( eventUid ) {
            uidsToLoad.push( eventUid );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'Fnd0ReleaseEvent', undefined );
        }

        if( uidsToLoad.length > 0 ) {
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                loadedObjects.forEach( function( obj ) {
                    var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( obj, 'EDIT' );
                    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( obj.type, vmo );
                    eventBus.publish( 'RevisionRuleAdminEventClause.eventClausePropertyValueInitialized' );
                } );
            } );
        } else {
            eventBus.publish( 'RevisionRuleAdminEventClause.eventClausePropertyValueInitialized' );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'Fnd0ReleaseEvent', undefined );
        eventBus.publish( 'RevisionRuleAdminEventClause.eventClausePropertyValueInitialized' );
    }
}

/**
 * Show the Branch clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showBranchProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var branchUid = selection[ 0 ].revRuleEntryKeyToValue.branch;
        if( branchUid ) {
            var uidsToLoad = [ branchUid ];
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                var branch = loadedObjects[ 0 ];
                var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( branch, 'EDIT' );
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'branch', vmo );
            } );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'branch', undefined );
    }
}

/**
 * Show the Working clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showWorkingProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var ctx = revisionRuleAdminCtx.getCtx();
        var current_user = selection[ 0 ].revRuleEntryKeyToValue.current_user === 'true';
        var current_group = selection[ 0 ].revRuleEntryKeyToValue.current_group === 'true';
        var uidsToLoad = [];
        var userUid = selection[ 0 ].revRuleEntryKeyToValue.user;
        if( current_user && ctx.user ) {
            userUid = ctx.user.uid;
        }
        if( userUid ) {
            uidsToLoad.push( userUid );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'User', undefined );
        }
        var groupUid = selection[ 0 ].revRuleEntryKeyToValue.group;

        if( current_group && ctx.userSession.props.group ) {
            groupUid = ctx.userSession.props.group.dbValue;
        }
        if( groupUid ) {
            uidsToLoad.push( groupUid );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'Group', undefined );
        }
        if( uidsToLoad.length > 0 ) {
            exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                loadedObjects.forEach( function( obj ) {
                    var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( obj, 'EDIT' );
                    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( obj.type, vmo );
                    eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
                } );
            } );
        } else {
            eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'User', undefined );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'Group', undefined );
        eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
    }
}

/**
 * Show the Latest clause properties
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} selection - User selection
 *
 */
function showLatestProperties( data, selection, supportedFeatures ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var configTypeInternalVal = selection[ 0 ].revRuleEntryKeyToValue.latest;
        var displayVal = getDispValFromIntValForLatestClause( configTypeInternalVal );

        if( supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
            let latestConfigTypeForRevOcc = { ...data.latestConfigTypeForRevOcc, dbValue: configTypeInternalVal, uiValue: displayVal };
            data.dispatch( { path: 'data.latestConfigTypeForRevOcc', value: latestConfigTypeForRevOcc } );
        }
        var latestConfigType = {
            configType: configTypeInternalVal,
            configDisplay: displayVal,
            dbValue: configTypeInternalVal,
            uiValue: displayVal
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'latestConfigType', latestConfigType );
        eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
    }
}

/**
 * Get display value from internal value for latest clause
 *
 * @param {String} propInternalVal - Internal value of property
 *
 * @return {String} propDisplayVal - Display value of property
 */
function getDispValFromIntValForLatestClause( propInternalVal ) {
    var resource = 'RevisionRuleAdminConstants';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    var propDisplayVal = '';

    switch ( propInternalVal ) {
        case '0':
            propDisplayVal = localeTextBundle.creationDate;
            break;
        case '1':
            propDisplayVal = localeTextBundle.alphanumericRevId;
            break;
        case '2':
            propDisplayVal = localeTextBundle.numericRevId;
            break;
        case '3':
            propDisplayVal = localeTextBundle.alphaplusNumberRevId;
            break;
        default:
            break;
    }
    return propDisplayVal;
}

/**
 * Get display value from internal value for status clause
 *
 * @param {String} propInternalVal - Internal value of property
 *
 * @return {String} propDisplayVal - Display value of property
 */
function getDispValFromIntValForStatusClause( propInternalVal ) {
    var resource = 'RevisionRuleAdminConstants';
    var localeTextBundle = localeSvc.getLoadedText( resource );
    var propDisplayVal = '';

    switch ( propInternalVal ) {
        case '0':
            propDisplayVal = localeTextBundle.releasedDate;
            break;
        case '1':
            propDisplayVal = localeTextBundle.effectiveDate;
            break;
        case '2':
            propDisplayVal = localeTextBundle.unit;
            break;
        default:
            break;
    }
    return propDisplayVal;
}

/**
 * Show the Status clause properties
 *
 * @param {Object} selection - User selection
 *
 */
function showStatusProperties( selection ) {
    if( selection[ 0 ].revRuleEntryKeyToValue ) {
        var configTypeInternalVal = selection[ 0 ].revRuleEntryKeyToValue.config_type;
        var displayConfigType = getDispValFromIntValForStatusClause( configTypeInternalVal );

        var statusConfigType = {
            configType: configTypeInternalVal,
            configDisplay: displayConfigType
        };

        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'statusConfigType', statusConfigType );
        var isAny = selection[ 0 ].revRuleEntryKeyToValue.status_type === 'Any';
        if( !isAny ) {
            var statusUid = selection[ 0 ].revRuleEntryKeyToValue.status_type;
            if( statusUid ) {
                var uidsToLoad = [ statusUid ];
                exports.loadObjects( uidsToLoad ).then( function( loadedObjects ) {
                    var status = loadedObjects[ 0 ];
                    var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( status, 'EDIT' );
                    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'status', vmo );
                    eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
                } );
            }
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'status', 'Any' );
            eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
        }
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'status', undefined );
        eventBus.publish( 'RevisionRuleAdminClauseProperties.clausePropertyValueInitialized' );
    }
}

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * Load objects for the input UIDs
 *
 * @param {StringArray} uidsToLoad - Array of UIDs to be loaded
 *
 * @return {Object} promise - Promise containing the loaded Objects
 */
export let loadObjects = function( uidsToLoad ) {
    var deferred = AwPromiseService.instance.defer();
    var loadedObjects = [];
    return dataManagementSvc.loadObjects( uidsToLoad ).then( function() {
        _.forEach( uidsToLoad, function( uid ) {
            var oUidObject = cdmSvc.getObject( uid );
            loadedObjects.push( oUidObject );
        } );
        deferred.resolve( loadedObjects );
        return deferred.promise;
    } );
};

/**
 * Show the selected clause properties
 *
 * @param {Object} nestedNavigationState - nestedNavigationState which holds clauses, currently selected clause
 * @param {Object} dataProvider -  dataProvider
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel -- TODO - only for RevisableOccurrence case data needed for updating the latestConfigTypeForRevOcc - recheck if this can be done differently
 *
 */
export let showSelectedClauseDetails = function( nestedNavigationState, dataProvider, data, supportedFeatures ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    let selection = dataProvider.selectedObjects;
    if( newNestedNavigationState && selection && selection.length > 0 ) {
        //syncClausesWithDataProviderData is doing only clause update on shared data using the dataProviderViewModelCollection.
        //Do recheck if clause update really needed when use does the selection change ?

        //        newNestedNavigationState.clauses = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
        newNestedNavigationState.selectedClauseIndex = dataProvider.getSelectedIndexes()[0];
        newNestedNavigationState.currentlySelectedClause.dbValue = selection[ 0 ].entryType;
        newNestedNavigationState.currentlySelectedClause.entryType = selection[ 0 ].entryType;
        if( selection[ 0 ].revRuleEntryKeyToValue ) {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedClauseProperty', selection[ 0 ].revRuleEntryKeyToValue );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedClauseProperty', undefined );
        }
        switch ( newNestedNavigationState.currentlySelectedClause.dbValue ) {
            case 0: // Working
                showWorkingProperties( selection );
                break;
            case 1: // Status
                showStatusProperties( selection );
                break;
            case 2: // Override
                showOverrideProperties( selection );
                break;
            case 3: //date
                showDateProperties( selection );
                break;
            case 4: //Unit No
                showUnitProperties( selection );
                break;
            case 7: //Latest
                showLatestProperties( data, selection, supportedFeatures );
                break;
            case 8: //End Item
                showEndItemProperties( selection );
                break;
            case 10: //Branch
                showBranchProperties( selection );
                break;
            case 13: //Release Event
                showReleaseEventProperties( selection );
                break;
            case 14: //Plant Location
                showPlantLocationProperties( selection );
                break;
            case 15: //Configuration Baseline type
                showConfigBaselineProperties( selection, data );
                break;
            case 16: //Configuration Baseline Object
                showConfigBaselineObjectProperties( selection );
                break;
            default:
                break;
        }
    } else {
        //Clear the details screen
        newNestedNavigationState.currentlySelectedClause.dbValue  = '999';
    }

    //Recheck - how best we can optimize this - even though the value of only currentlySelectedClause is modified and clauses not touched it was triggering the action define for caluse observer.
    nestedNavigationState.update( newNestedNavigationState );
};

export default exports = {
    loadObjects,
    showSelectedClauseDetails,
    showConfigBaselineStateDisplay
};
