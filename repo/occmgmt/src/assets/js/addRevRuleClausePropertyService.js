// Copyright (c) 2022 Siemens

/**
 * @module js/addRevRuleClausePropertyService
 */
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revisionRuleAdminPanelService from 'js/revisionRuleAdminPanelService';
import revRuleClauseDisplayTextService from 'js/revRuleClauseDisplayTextService';
import cdmSvc from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import configBaselinesClauseService from 'js/configurationBaselinesClauseService';

var _user = 'User';
var _group = 'Group';
var _status = 'Status';
var _anyStatus = 'Any';
var _release_event = 'Fnd0ReleaseEvent';
var ADDCLAUSE_PREFIX = 'addClause_';
var _localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
var policyId;

function getSelectedClauseIndex( subPanelContext ) {
    return subPanelContext.dataProviders.getRevisionRuleInfoProvider.getSelectedIndexes()[0];
}

export let getSelectedClause = function( subPanelContext ) {
    let clauses = subPanelContext.dataProviders.getRevisionRuleInfoProvider.viewModelCollection.getLoadedViewModelObjects();
    return clauses[getSelectedClauseIndex( subPanelContext )];
};

/**
 * check for repeated clauses after modification
 *
 * @param {Object} data - data
 * @param {String} clauseToBeUpdated - clause to update
 * @param {String} displayText - display text for new clause
 *
 */
function checkSimilarClauseInRevRule( nestedNavigationState, clauseToBeUpdated, displayText ) {
    let similarClauseFound = false;
    let clauses = nestedNavigationState && nestedNavigationState.clauses;
    if ( clauses ) {
        for ( let inx = 0; inx < clauses.length; inx++ ) {
            let clauseFound = _.isEqual( clauses[inx].displayText, displayText );
            if ( clauseFound && !nestedNavigationState.exactlySameClauseWarning ) {
                //give warning to user incase after modification clauses become exactly same
                nestedNavigationState.exactlySameClauseWarning = true;
                clauseToBeUpdated.isRepeated = true;
                similarClauseFound = true;
                break;
            }
        }
    }
    if ( !similarClauseFound && clauseToBeUpdated.isRepeated ) {
        //clause is no longer repeated
        clauseToBeUpdated.isRepeated = false;

        //make warning invisible
        if ( nestedNavigationState.exactlySameClauseWarning ) {
            nestedNavigationState.exactlySameClauseWarning = false;
        }
    }
}

/**
 * Create clause property for new added clause
 *
 * @param {Object} data - data
 * @param {String} clauseToBeUpdated - clause to update
 * @param {String} displayText - display text for new clause
 *
 */
export let modifyClauseProperty = function( data, clauseToBeUpdated, displayText ) {
    //TODO recheck why subPanelContext can not use directly instead of using from data
    let subPanelContext = data.subPanelContext;//&& data.subPanelContext.activeView === 'RevisionRuleAdminPanel' ? data.subPanelContext : data;

    let newNestedNavigationState = _.cloneDeep( subPanelContext.nestedNavigationState );

    // check if similar clause with same property already exist to give user warning.
    if ( clauseToBeUpdated.entryType !== 3 && clauseToBeUpdated.entryType !== 4 && clauseToBeUpdated.entryType !== 8 && clauseToBeUpdated.entryType !== 13
        && clauseToBeUpdated.entryType !== 14 ) {
        checkSimilarClauseInRevRule( newNestedNavigationState, clauseToBeUpdated, displayText );
    }

    clauseToBeUpdated.displayText = displayText;
    clauseToBeUpdated.modified = true;

    let index =  newNestedNavigationState.selectedClauseIndex;
    // getSelectedClauseIndex( subPanelContext );
    newNestedNavigationState.clauses[index] = clauseToBeUpdated;
    if ( newNestedNavigationState.currentlySelectedClause.dbValue === 2 || newNestedNavigationState.currentlySelectedClause.dbValue === 8
        || newNestedNavigationState.currentlySelectedClause.dbValue === 16 ) {
        return newNestedNavigationState;
    }
    subPanelContext.nestedNavigationState.update( newNestedNavigationState );
    //TODO - recheck - event should be publish to update the text only after state is updated
    eventBus.publish( 'RevisionRuleAdminPanel.tagRevisionRuleAsModified' );
    //subPanelContext.dataProviders.getRevisionRuleInfoProvider.update( data.subPanelContext.clauses, data.subPanelContext.clauses.length );
};

/**
 * Create clause property for new added clause
 *
 * @param {Object} clauseToBeCreated - clause to create
 * @param {String} displayText - display text for new clause
 *
 */
export let createClausePropertyForAddClause = function( clauseToBeCreated, displayText ) {
    clauseToBeCreated.displayText = displayText;
    clauseToBeCreated.groupEntryInfo = {
        listOfSubEntries: []
    };
};

function canUpdateUnitClauseProperty( nestedNavigationState ) {
    return nestedNavigationState.currentlySelectedClause.dbValue ===  4;
}

function canUpdateDateClauseProperty( nestedNavigationState ) {
    return nestedNavigationState.currentlySelectedClause.dbValue === 3;
}
/**
 * Update Working clause text
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 *
 */
function updateWorkingClauseText( data ) {
    var clauseToBeUpdated = getSelectedClause( data.subPanelContext );
    exports.getUpdatedWorkingClause( data, clauseToBeUpdated, false );
}

/**
 * Get clause property type based on clause selected from RevisionRule Panel or AddClause panel
 *
 * @param {String} clauseType - clause property type
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @return {String} clauseType - clause property type based on clause selected from RevisionRule panel or AddClause panel
 *
 */
export let getClausePropertiesType = function( clauseType, data ) {
    var subPanelContext = data.subPanelContext;
    var isSelectedFromAddPanel = false;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }
    if ( isSelectedFromAddPanel ) {
        clauseType = ADDCLAUSE_PREFIX + clauseType;
    }
    return clauseType;
};

/**
 * Update Status clause text
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 *
 */
function updateStatusClauseText( data ) {
    var clauseToBeUpdated = getSelectedClause( data.subPanelContext );
    if ( clauseToBeUpdated.entryType === 1 ) {
        exports.getUpdatedStatusClause( data, clauseToBeUpdated, false );
    }
}
/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * get the Panel title to Add/Replace clause property
 *
 * @param {Object} currentlySelectedClause - currently selected clause
 * @param {String} panelTitle - Title of the panel to be opened (Add/Replace)
 *
 */
export let getClausePropertiesPanelTitle = function( currentlySelectedClause, isAddPanel ) {
    let typeFilter = null;
    let panelTitlePostfixKey = null;
    let panelTitlePrefixKey = isAddPanel ? 'add' : 'replace';

    switch ( currentlySelectedClause.dbValue ) {
        case 2:
            typeFilter = 'Folder';
            panelTitlePostfixKey = 'Folder';
            break;
        case 8:
            typeFilter = 'ItemRevision';
            panelTitlePostfixKey = 'EndItem';
            break;
        case 13:
            typeFilter = 'Fnd0ReleaseEvent';
            panelTitlePostfixKey = 'ReleaseEvent';
            break;
        case 14:
            typeFilter = 'plantLocation';
            panelTitlePostfixKey = 'PlantLocation';
            break;
        case 10:
            typeFilter = 'Fnd0Branch';
            panelTitlePostfixKey = 'Branch';
            break;
        case 15:
            typeFilter = 'configBaseline';
            panelTitlePostfixKey = 'ConfigBaseline';
            break;
        case 16:
            typeFilter = 'Fnd0AbsConfigBaseline';
            panelTitlePostfixKey = 'BaselineObject';
            break;
        default:
            break;
    }

    let panelTitleKey = panelTitlePrefixKey + panelTitlePostfixKey;
    var localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
    var title = localeTextBundle[panelTitleKey];
    return {
        typeFilter:typeFilter,
        title:title
    };
};

/**
 * process the SOA response for "getSubTypeNames" and update the typeNames for which search should be done
 *
 * @param {Object} response - response of the SOA
 * @param {DeclViewModel} data - GetClausePropertyBySearchViewModel
 *
 */
export let processSoaResponseForBOTypes = function( response ) {
    var typeNames = null;
    if ( response.output ) {
        for ( var ii = 0; ii < response.output.length; ii++ ) {
            var displayableBOTypeNames = response.output[ii].subTypeNames;
            typeNames = displayableBOTypeNames[0];

            for ( var jj = 1; jj < displayableBOTypeNames.length; jj++ ) {
                typeNames = typeNames + ';' + displayableBOTypeNames[jj];
            }
        }
    }
    return typeNames;
};

/**
 * get Search Criteria for input to performSearchViewModel SOA
 *
 * @param {DeclViewModel} data - GetClausePropertyBySearchViewModel
 * @param {int} startIndex - current index of the searchFolders dataProvider
 *
 */
export let getSearchCriteria = function( data, startIndex ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var searchCriteria = {};
    searchCriteria.typeOfSearch = 'ADVANCED_SEARCH';
    searchCriteria.utcOffset = '0';

    if ( ctx.search && startIndex > 0 ) {
        searchCriteria.totalObjectsFoundReportedToClient = ctx.search.totalFound.toString();
        searchCriteria.lastEndIndex = ctx.search.lastEndIndex.toString();
    } else {
        searchCriteria.totalObjectsFoundReportedToClient = '0';
        searchCriteria.lastEndIndex = '0';
    }
    searchCriteria.queryName = data.subPanelContext.typeFilter === 'ItemRevision' ? 'Quick' : 'General...';
    if( data.subPanelContext.typeFilter === 'ItemRevision' ) {
        searchCriteria.ItemID = data.searchString.dbValue;
    }
    searchCriteria.Name = data.searchString.dbValue;
    searchCriteria.Type = data.typeNames;

    return searchCriteria;
};

/**
 * update Clause Property in the RevisionRuleAdmin context with the selected one and navigate back to Revision Rule Panel
 *
 *  @param {Object} selection - currently selected clause property
 *
 */
export let updateClauseProperty = function( nestedNavigationState, selection ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    // if ( ctx.panelContext ) {
    //     var isForAddClause = ctx.panelContext.isForAddClause;

    //Recheck the purpose of below code - Amruta --
    //optimize below code have only one variable to hold the context name. append the prefix to the context name based on isForAddClaue
    //In the switch statement append the approprite value to context
    //update the values on ctx in one go after the swtich - context, currentcaluse , etc
    //Recheck if all of this information can be kept on the revRule specific subpanel context instead of ctx
    var folder_type = 'folder';
    var endItem_type = 'end_item';
    var branch_type = 'branch';
    var releaseEvent_type = _release_event;
    var plantLocation_type = 'plantLocation';
    var currentlySelectedClauseProperty = 'currentlySelectedClauseProperty';
    var baselineObject_type = 'baselineObject';

    let currentView = nestedNavigationState.views[nestedNavigationState.views.length - 1 ];
    if( currentView.additionalSubPanelContext ) {
        let isForAddClause = currentView.additionalSubPanelContext.isAddClause;
        let typeFilter = currentView.additionalSubPanelContext.typeFilter;

        if ( isForAddClause ) {
            folder_type = ADDCLAUSE_PREFIX + folder_type;
            endItem_type = ADDCLAUSE_PREFIX + endItem_type;
            branch_type = ADDCLAUSE_PREFIX + branch_type;
            releaseEvent_type = ADDCLAUSE_PREFIX + releaseEvent_type;
            plantLocation_type =  ADDCLAUSE_PREFIX + plantLocation_type;
            currentlySelectedClauseProperty = ADDCLAUSE_PREFIX + currentlySelectedClauseProperty;
            baselineObject_type = ADDCLAUSE_PREFIX + baselineObject_type;
        }
        switch ( typeFilter ) {
            case 'Folder':
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( folder_type, selection );
                break;
            // This code is handling enditem for both item and item revision
            case 'ItemRevision':
                if ( selection.props && selection.props.items_tag ) {
                    var itemOfItemRev = cdmSvc.getObject( selection.props.items_tag.dbValue );
                    if( itemOfItemRev !== undefined ) {
                        let itemVmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( itemOfItemRev );
                        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( endItem_type, itemVmo );
                    }
                } else {
                    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( endItem_type, selection );
                }
                break;
            case 'Fnd0ReleaseEvent':
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( releaseEvent_type, selection );
                break;
            case 'plantLocation':
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( plantLocation_type, selection );
                break;
            case 'Fnd0Branch':
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( branch_type, selection );
                break;
            case 'Fnd0AbsConfigBaseline':
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( baselineObject_type, selection );
                break;
            default:
                break;
        }
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'isAddClausePropertyPanelLoaded', false );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( currentlySelectedClauseProperty, selection );
        if ( !isForAddClause ) {
            //In case of replace End Item or Override use case we should show 'modified' text for the rev rule name. so updating needed property on state
            let updatedNestedNavigationState = _.cloneDeep( nestedNavigationState );
            updatedNestedNavigationState.clauseUpdated = true;
            nestedNavigationState.update( updatedNestedNavigationState );
        }
    }
};


export let updateValueInClauseProperties = function( data, nestedNavigationState ) {
    let currentView = nestedNavigationState.views[nestedNavigationState.views.length - 1 ];
    let isForAddClause = currentView.additionalSubPanelContext.isAddClause;

    if( !isForAddClause ) {
        let clauses = nestedNavigationState.clauses;
        let typeFilter = currentView.additionalSubPanelContext.typeFilter;
        let selectedIndex = nestedNavigationState.selectedClauseIndex;

        let currentlySelectedClause = clauses[selectedIndex];
        var ctx = revisionRuleAdminCtx.getCtx();
        switch ( typeFilter ) {
            case 'Folder':
                exports.getUpdatedOverrideClause( data, currentlySelectedClause, false );
                break;
            case 'ItemRevision':
                exports.getUpdatedEndItemClause( data, currentlySelectedClause, false );
                break;
            case 'Fnd0ReleaseEvent':
                exports.updateReleaseEventClauseText( data );
                break;
            case 'plantLocation':
                exports.updatePlantLocationClauseText( data );
                break;
            case 'Fnd0Branch':
                if ( currentlySelectedClause.revRuleEntryKeyToValue ) {
                    currentlySelectedClause.revRuleEntryKeyToValue.branch = ctx.RevisionRuleAdmin.branch.uid;
                } else {
                    currentlySelectedClause.revRuleEntryKeyToValue = {
                        branch: ctx.RevisionRuleAdmin.branch.uid
                    };
                }
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedClauseProperty', ctx.RevisionRuleAdmin.branch.uid );
                break;
            case 'Fnd0AbsConfigBaseline':
                configBaselinesClauseService.getUpdatedConfigBaselineObjectClause( data, currentlySelectedClause, false );
                break;
            default:
                break;
        }
    }
};

/**
 * Get updated Status clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clauseToBeUpdated - modified/added clause
 * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
 *
 */
export let getUpdatedStatusClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
    var status = 'status';
    var statusConfig = 'statusConfigType';
    if ( isForAddClause ) {
        status = ADDCLAUSE_PREFIX + status;
        statusConfig = ADDCLAUSE_PREFIX + statusConfig;
    }

    clauseToBeUpdated.revRuleEntryKeyToValue = {};
    if ( ctx.RevisionRuleAdmin[status] === _anyStatus ) {
        clauseToBeUpdated.revRuleEntryKeyToValue.status_type = _anyStatus;
    } else if ( ctx.RevisionRuleAdmin[status] ) {
        clauseToBeUpdated.revRuleEntryKeyToValue.status_type = ctx.RevisionRuleAdmin[status].uid;
    }

    if ( ctx.RevisionRuleAdmin[statusConfig] ) {
        clauseToBeUpdated.revRuleEntryKeyToValue.config_type = ctx.RevisionRuleAdmin[statusConfig].configType;
    }

    if ( !isForAddClause ) {
        if ( clauseToBeUpdated.displayText !== displayText ) {
            modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
    } else {
        createClausePropertyForAddClause( clauseToBeUpdated, displayText );
    }
};

/**
 * Get updated Working clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clauseToBeUpdated - modified/added clause
 * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
 *
 */
export let getUpdatedWorkingClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var current_user = undefined;
    var current_group = undefined;
    var user = undefined;
    var group = undefined;
    var user_type = _user;
    var group_type = _group;

    if ( clauseToBeUpdated.entryType === 0 ) {
        if ( isForAddClause ) {
            user_type = ADDCLAUSE_PREFIX + _user;
            group_type = ADDCLAUSE_PREFIX + _group;
        }
        if ( ctx.RevisionRuleAdmin[user_type] && ctx.user ) {
            current_user = ctx.RevisionRuleAdmin[user_type].uid === ctx.user.uid;
        }
        if ( ctx.RevisionRuleAdmin[group_type] && ctx.userSession ) {
            current_group = ctx.RevisionRuleAdmin[group_type].uid === ctx.userSession.props.group.dbValue;
        }
        clauseToBeUpdated.revRuleEntryKeyToValue = {};
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
        if ( !current_user && ctx.RevisionRuleAdmin[user_type] ) {
            user = ctx.RevisionRuleAdmin[user_type].uid;
            clauseToBeUpdated.revRuleEntryKeyToValue.user = user;
        }
        if ( !current_group && ctx.RevisionRuleAdmin[group_type] ) {
            group = ctx.RevisionRuleAdmin[group_type].uid;
            clauseToBeUpdated.revRuleEntryKeyToValue.group = group;
        }

        if ( current_user ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.current_user = 'true';
        }

        if ( current_group ) {
            clauseToBeUpdated.revRuleEntryKeyToValue.current_group = 'true';
        }

        if ( !isForAddClause ) {
            modifyClauseProperty( data, clauseToBeUpdated, displayText );
        } else {
            createClausePropertyForAddClause( clauseToBeUpdated, displayText );
        }
    }
};

/**
 * Get updated End Item clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clauseToBeUpdated - modified/added clause
 * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
 *
 */
export let getUpdatedEndItemClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var endItem_type = 'end_item';
    if ( isForAddClause ) {
        endItem_type = ADDCLAUSE_PREFIX + endItem_type;
    }
    var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
    if ( ctx.RevisionRuleAdmin[endItem_type] ) {
        clauseToBeUpdated.revRuleEntryKeyToValue = {
            end_item: ctx.RevisionRuleAdmin[endItem_type].uid
        };
    } else if ( clauseToBeUpdated.revRuleEntryKeyToValue ) {
        clauseToBeUpdated.revRuleEntryKeyToValue = undefined;
    }
    if ( !isForAddClause ) {
        return modifyClauseProperty( data, clauseToBeUpdated, displayText );
    }
    createClausePropertyForAddClause( clauseToBeUpdated, displayText );
};

/**
 * Get updated Override clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clauseToBeUpdated - modified/added clause
 * @param {Boolean} isForAddClause - true if clause is added from AddClause panel
 *
 */
export let getUpdatedOverrideClause = function( data, clauseToBeUpdated, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var folder_type = 'folder';
    if ( isForAddClause ) {
        folder_type = ADDCLAUSE_PREFIX + folder_type;
    }
    var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, isForAddClause );
    if ( ctx.RevisionRuleAdmin[folder_type] ) {
        clauseToBeUpdated.revRuleEntryKeyToValue = {
            folder: ctx.RevisionRuleAdmin[folder_type].uid
        };
    } else if ( clauseToBeUpdated.revRuleEntryKeyToValue ) {
        clauseToBeUpdated.revRuleEntryKeyToValue = undefined;
    }
    if ( !isForAddClause && displayText !== clauseToBeUpdated.displayText ) {
        return modifyClauseProperty( data, clauseToBeUpdated, displayText );
    }
    createClausePropertyForAddClause( clauseToBeUpdated, displayText );
};

//Unit clause
export let updateUnitClauseText = function( data ) {
    //TODO - recheck why data.subPanelContext is used instead of subPanelContext avaialble in property
    if ( canUpdateUnitClauseProperty( data.subPanelContext.nestedNavigationState ) ) {
        var clauseToBeUpdated = getSelectedClause( data.subPanelContext );
        if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 4 ) {
            if ( !data.unit_no.error ) {
                var unitNum = data.unit_no.dbValue.toString();
                if ( clauseToBeUpdated.revRuleEntryKeyToValue.unit_no !== unitNum ) {
                    var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, false );
                    clauseToBeUpdated.revRuleEntryKeyToValue.unit_no = unitNum;
                    modifyClauseProperty( data, clauseToBeUpdated, displayText );
                }
            }
        }
    }
};

//Date clause
export let updateDateClauseText = function( data, dateField, supportedFeatures ) {
    if ( canUpdateDateClauseProperty( data.subPanelContext.nestedNavigationState ) ) {
        var clauseToBeUpdated = getSelectedClause( data.subPanelContext );
        if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 3 ) {
            var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, false, supportedFeatures, dateField );
            var dateString = displayText.substring( displayText.indexOf( '(' ) + 1, displayText.indexOf( ')' ) ).trim();
            if ( dateField.error ) {
                clauseToBeUpdated.revRuleEntryKeyToValue.date = '';
                modifyClauseProperty( data, clauseToBeUpdated, displayText );
            }

            if ( clauseToBeUpdated.revRuleEntryKeyToValue.date !== dateString && !dateField.error && dateString !== 'Today' ) {
                clauseToBeUpdated.revRuleEntryKeyToValue.date = dateString;
                modifyClauseProperty( data, clauseToBeUpdated, displayText );
            }
            if ( !( clauseToBeUpdated.revRuleEntryKeyToValue.today === undefined && !data.today.dbValue ) && clauseToBeUpdated.revRuleEntryKeyToValue.today !== data.today.dbValue.toString() ) {
                clauseToBeUpdated.revRuleEntryKeyToValue.today = data.today.dbValue.toString();
                if ( !data.today.dbValue && data.date.dateApi.dateValue === undefined ) {
                    data.dispatch( { path: 'data.date.dateApi.dateValue', value: '' } );
                }
                modifyClauseProperty( data, clauseToBeUpdated, displayText );
            }
        }
    }
};

//Latest clause
export let updateLatestClauseText = function( data, supportedFeatures ) {
    var clauseToBeUpdated = getSelectedClause( data.subPanelContext );

    var latestConfigType = _.cloneDeep( data.latestConfigType );
    if ( supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
        latestConfigType = _.cloneDeep( data.latestConfigTypeForRevOcc );
    }

    if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 7 ) {
        var latestConfigTypeCopy = {
            configType: latestConfigType.dbValue,
            configDisplay: latestConfigType.uiValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'latestConfigType', latestConfigTypeCopy );
        var selectedVal = latestConfigType.dbValue.toString();
        var displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, clauseToBeUpdated.entryType, false, supportedFeatures );
        clauseToBeUpdated.revRuleEntryKeyToValue.latest = selectedVal;

        if ( clauseToBeUpdated.displayText !== displayText ) {
            modifyClauseProperty( data, clauseToBeUpdated, displayText );
        }
    }
};

//Override clause
export let updateOverrideClauseText = function( data ) {
    var clauseToBeUpdated = getSelectedClause( data );
    if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 2 ) {
        var nestedNavigationState = exports.getUpdatedOverrideClause( data, clauseToBeUpdated, false );
        // From here updating subPanelContext.nestedNavigationState to return nestatedNavidationState and
        // calling tagRevisionRuleAsModified function to add modify tag to revision rule
        // When this is updated from modifyClauseProperty function then ClausePropertyReplace command is not working.
        // Hence need to update nestedNavigationState from subPanelContext and call tagRevisionRuleAsModified function from here.
        data.subPanelContext.nestedNavigationState.update( nestedNavigationState );
        var modifiedRevisionRule = revisionRuleAdminPanelService.tagRevisionRuleAsModified( data.revRuleName, data.isClauseModified, nestedNavigationState );
        return { revRuleName:modifiedRevisionRule.revRuleName, isClauseModified:modifiedRevisionRule.isClauseModified };
    }
};

//End Item clause
export let updateEndItemClauseText = function( data ) {
    var clauseToBeUpdated = getSelectedClause( data );
    if ( clauseToBeUpdated && clauseToBeUpdated.entryType === 8 ) {
        var nestedNavigationState = exports.getUpdatedEndItemClause( data, clauseToBeUpdated, false );
        // From here updating subPanelContext.nestedNavigationState to return nestatedNavidationState and
        // calling tagRevisionRuleAsModified function to add modify tag to revision rule
        // When this is updated from modifyClauseProperty function then ClausePropertyReplace command is not working.
        // Hence need to update nestedNavigationState from subPanelContext and call tagRevisionRuleAsModified function from here.
        data.subPanelContext.nestedNavigationState.update( nestedNavigationState );
        var modifiedRevisionRule = revisionRuleAdminPanelService.tagRevisionRuleAsModified( data.revRuleName, data.isClauseModified, nestedNavigationState );
        return { revRuleName:modifiedRevisionRule.revRuleName, isClauseModified:modifiedRevisionRule.isClauseModified };
    }
};

/**
 * remove the selected Clause Property
 *
 * @param {Object} currentlySelectedClause - currently selected clause
 * @param {Object} dataProvider - data provider for displaying the clauses
 *
 */
export let removeClauseProperty = function( currentlySelectedClause, dataProvider, isForAddClause ) {
    var folder_type = 'folder';
    var endItem_type = 'end_item';
    var branch_type = 'branch';
    var releaseEvent_type = _release_event;
    var plantLocation_type = 'plant';
    var currentlySelectedClauseProperty = 'currentlySelectedClauseProperty';
    var configBaseline_type = 'configBaseline';
    var baselineObject_type = 'baselineObject';
    if ( isForAddClause ) {
        folder_type = ADDCLAUSE_PREFIX + folder_type;
        endItem_type = ADDCLAUSE_PREFIX + endItem_type;
        branch_type = ADDCLAUSE_PREFIX + branch_type;
        releaseEvent_type = ADDCLAUSE_PREFIX + releaseEvent_type;
        currentlySelectedClauseProperty = ADDCLAUSE_PREFIX + currentlySelectedClauseProperty;
        baselineObject_type = ADDCLAUSE_PREFIX + baselineObject_type;
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( currentlySelectedClauseProperty, undefined );
    switch ( currentlySelectedClause.dbValue ) {
        case 2:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( folder_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updateOverrideClauseText' );
            }
            break;
        case 8:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( endItem_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updateEndItemClauseText' );
            }
            break;
        case 13:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( releaseEvent_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updateReleaseEventClauseText' );
            }
            break;
        case 14:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( plantLocation_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updatePlantLocationClauseText' );
            }
            break;
        case 10:
            var selectedIndex = dataProvider.getSelectedIndexes()[0];
            var clauses = dataProvider.viewModelCollection.getLoadedViewModelObjects();
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( branch_type, undefined );
            clauses[selectedIndex].revRuleEntryKeyToValue = undefined;
            break;
        case 15:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( configBaseline_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updateConfigBaselineClauseText' );
            }
            break;
        case 16:
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( baselineObject_type, undefined );
            if ( !isForAddClause ) {
                eventBus.publish( 'RevisionRuleAdminPanel.updateConfigBaselineObjectClauseText' );
            }
            break;
        default:
            break;
    }
};

/**
 *  update configuration typr for status clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let updateStatusConfigType = function( data, isUpdatedFromWidget ) {
    if ( !isUpdatedFromWidget || data.eventData && data.eventData.lovValue && data.statusConfigType.dbValue === data.eventData.lovValue.propInternalValue ) {
        var subPanelContext = data.subPanelContext;
        var isSelectedFromAddPanel = undefined;
        if ( subPanelContext ) {
            isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }
        var statusconfig_type = getClausePropertiesType( 'statusConfigType', data );
        var statusConfig = {
            configType: data.statusConfigType.dbValue,
            configDisplay: data.statusConfigType.uiValue
        };
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( statusconfig_type, statusConfig );
        if ( !isSelectedFromAddPanel ) {
            updateStatusClauseText( data );
        }
    }
};

/**
 * Update the user property for working clause with the selected property from the widget
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let usersListSelectionChanged = function( data ) {
    let subPanelContext = data.subPanelContext;
    let isSelectedFromAddPanel;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }
    var object = {};
    var user_type = getClausePropertiesType( _user, data );
    if ( data.user.dbValue !== '' ) {
        object = cdmSvc.getObject( data.user.dbValue );
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( user_type, undefined );
    }
    if ( object.uid ) {
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( object, 'EDIT' );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( user_type, vmo );
    }
    if ( !isSelectedFromAddPanel ) {
        updateWorkingClauseText( data );
    }
};

/**
 * Update the group property for working clause with the selected property from the widget
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let groupsListSelectionChanged = function( data ) {
    let subPanelContext = data.subPanelContext;
    let isSelectedFromAddPanel;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }
    var object = {};
    var group_type = getClausePropertiesType( _group, data );
    if ( data.group.dbValue !== '' ) {
        object = cdmSvc.getObject( data.group.dbValue );
    } else {
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( group_type, undefined );
    }
    if ( object.uid ) {
        let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( object, 'EDIT' );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( group_type, vmo );
    }
    if ( !isSelectedFromAddPanel ) {
        updateWorkingClauseText( data );
    }
};

/**
 * Update the status property for status clause with the selected property from the widget
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let statusListSelectionChanged = function( data ) {
    var islovValueModified = false;
    islovValueModified = data.eventData.lovValue && data.eventData.lovValue.propInternalValue === data.status.dbValue;
    if ( islovValueModified ) {
        var subPanelContext = data.subPanelContext;
        if ( subPanelContext ) {
            var isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
        }
        var object = {};
        var status_type = getClausePropertiesType( 'status', data );
        if ( data.status.dbValue !== _anyStatus ) {
            object = cdmSvc.getObject( data.status.dbValue );
        } else {
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( status_type, _anyStatus );
        }
        if ( object.uid ) {
            var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( object, 'EDIT' );
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( status_type, vmo );
        }
        if ( !isSelectedFromAddPanel ) {
            updateStatusClauseText( data );
        }
    }
};
/**
 * Get the search string value for SOA input to fetch the clause property values
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clausePropertyName - Name of the clause property
 * @return {String} searchString - Search string for SOA input to fetch the clause property values
 *
 */
export let getSearchStringValue = function( data, clausePropertyName ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var searchString = '';

    switch ( clausePropertyName ) {
        case _user:
            var user_type = getClausePropertiesType( _user, data );
            if ( data.user.filterString && !( ctx.RevisionRuleAdmin[user_type] && data.user.filterString === ctx.RevisionRuleAdmin[user_type].props.object_string.dbValue ) ) {
                /*set the searchString to '' to fetch all clause properties value in case of widget initialisation
                (widget textbox will have existing clause property value and with that as searchString value SOA will only return one property and user has to manually search with empty value)*/
                searchString = data.user.filterString;
            }
            break;
        case _group:
            var group_type = getClausePropertiesType( _group, data );
            if ( data.group.filterString && !( ctx.RevisionRuleAdmin[group_type] && data.group.filterString === ctx.RevisionRuleAdmin[group_type].props.object_string.dbValue ) ) {
                /*set the searchString to '' to fetch all clause properties value in case of widget initialisation
                (widget textbox will have existing clause property value and with that as searchString value SOA will only return one property and user has to manually search with empty value)*/
                searchString = data.group.filterString;
            }
            break;
        case _status:
            var status_type = getClausePropertiesType( 'status', data );
            /*set the searchString to '' to fetch all clause properties value in case of widget initialisation
            (widget textbox will have existing clause property value and with that as searchString value SOA will only return one property and user has to manually search with empty value)*/
            if ( data.status.filterString && data.status.filterString !== 'Any' && ctx.RevisionRuleAdmin[status_type] ) {
                if ( ctx.RevisionRuleAdmin[status_type] === 'Any' && data.status.filterString !== 'Any' || ctx.RevisionRuleAdmin[status_type].props && data.status.filterString !== ctx.RevisionRuleAdmin[status_type].props.object_string.dbValue ) {
                    searchString = data.status.filterString;
                }
            }
            break;
        default:
            break;
    }
    return searchString;
};

/**
 * Process SOA response and add the values to the widget dataprovider
 *
 * @param {Object} response - findObjectsByClassAndAttributes2/performSearch SOA response
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clausePropertyName - Name of the clause property
 * @return {StringArray} response value for dataprovider
 *
 */

export let processSearchResults = function( response, data, clausePropertyName ) {
    let lovList = [];
    let result = undefined;
    let moreValuesExist;
    if ( clausePropertyName === _status && response.result ) {
        result = response.result;
        //First value for 'Status' widget will be 'Any'
        var resource = 'RevisionRuleAdminConstants';
        var localeTextBundle = localeSvc.getLoadedText( resource );
        var anyStatus = localeTextBundle.any;
        var property = {
            propDisplayValue: anyStatus,
            propInternalValue: anyStatus,
            object: { uid: anyStatus }

        };
        lovList.push( property );
        moreValuesExist = data.dataProviders.statusListProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
    } else if ( clausePropertyName === _user || clausePropertyName === _group ) {
        if ( response.searchResults ) {
            result = response.searchResults;
            if ( clausePropertyName === _user ) {
                moreValuesExist = data.dataProviders.usersListProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
            } else {
                moreValuesExist = data.dataProviders.groupsListProvider.startIndex + response.totalLoaded < response.totalFound; // for pagination
            }
        }
    }

    if ( result ) {
        for ( var ii = 0; ii < result.length; ii++ ) {
            property = {
                propDisplayValue: result[ii].props.object_string.uiValues[0],
                propInternalValue: result[ii].uid,
                object: result[ii]
            };
            lovList.push( property );
        }
    }

    return { lovList, moreValuesExist };
};

/**
 * Validate the input to the status widget value
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 * @param {Object} selected new selection in Status property
 * @return {Object} valid status
 *
 */
export let validateStatusWidgetValue = function( data, selected ) {
    let validStatus = true;
    if( !selected ) {
        return { valid: validStatus, message: '' };
    }

    let newSelection;
    if( selected.length > 0 ) {
        newSelection = selected[0];
    }
    let ctx = revisionRuleAdminCtx.getCtx();
    let status_type = getClausePropertiesType( 'status', data );
    let status = _.cloneDeep( data.status );
    let statusConfigType = _.cloneDeep( data.statusConfigType );

    // status will be valid if either the widget input text is equal to the user value in ctx
    // or widget inputText is present in the dataprovider

    let indexOfStatus = -1;
    if ( data.dataProviders.statusListProvider.viewModelCollection.loadedVMObjects.length > 0 && newSelection?.propInternalValue !== _anyStatus ) {
        indexOfStatus = data.dataProviders.statusListProvider.viewModelCollection.loadedVMObjects
            .map( function( x ) {
                return x.object.uid;
            } ).indexOf( newSelection?.propInternalValue ?? '' );
    }

    let isStatusChangingToAny = false;
    // When new Status chosen is 'Any' - validStatus has to be false in order for status LOV provider to
    // not load 'Any' object as it is not backed by a persistent object
    // When a valid object is chosen from drop down we should not set validStatus to false
    if ( indexOfStatus < 0 ) {
        if(  newSelection?.propInternalValue === _anyStatus ) {
            validStatus = false;
            if( status.dbValue !== _anyStatus ) {
                isStatusChangingToAny = true;
            }
            status.dbValue = data.i18n.any;
            status.uiValue = data.i18n.any;
        }else if( ctx.RevisionRuleAdmin[status_type] && ctx.RevisionRuleAdmin[status_type].props &&
            newSelection?.propDisplayValue !== ctx.RevisionRuleAdmin[status_type].props.object_string.dbValue ) {
            validStatus = false;
            status.dbValue = ctx.RevisionRuleAdmin[status_type].uid;
            status.uiValue = ctx.RevisionRuleAdmin[status_type].props.object_string.dbValue;
        }
        data.dispatch( { path: 'data.status', value: status } );
    }
    if ( newSelection?.propInternalValue === _anyStatus ) {
        let resource = 'RevisionRuleAdminConstants';
        let localeTextBundle = localeSvc.getLoadedText( resource );
        if ( statusConfigType.dbValue !== '0' ) {
            statusConfigType.dbValue = '0';
            statusConfigType.uiValue = localeTextBundle.releasedDate;
            data.dispatch( { path: 'data.statusConfigType', value: statusConfigType } );
            exports.updateStatusConfigType( data, false );
        }
        if( isStatusChangingToAny ) {
            changeStatusToAny( data );
        }
    }
    return { valid: validStatus, message: '' };
};

let changeStatusToAny = ( data ) =>{
    var subPanelContext = data.subPanelContext;
    let isSelectedFromAddPanel;
    if ( subPanelContext ) {
        isSelectedFromAddPanel = subPanelContext.activeView && subPanelContext.activeView === 'AddClauses';
    }

    var status_type = getClausePropertiesType( 'status', data );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( status_type, _anyStatus );

    if ( !isSelectedFromAddPanel ) {
        updateStatusClauseText( data );
    }
};

/**
 * Update widget selected element in case current_user/current_group checkbox value is changed
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} clausePropertyName - Name of the clause property
 *
 */
export let updateWidgetTextForUserClauseProperty = ( data ) => {
    let currentUser = _.cloneDeep( data.currentUser );
    let user = _.cloneDeep( data.user );
    let userOnCtx = appCtxSvc.getCtx( 'user' );
    //if current_user checkbox is checked then update the widget selected element with the current user value
    //else reset the selected element to empty value
    if ( currentUser && user ) {
        if ( currentUser.dbValue && user.dbValue !== userOnCtx.uid ) {
            user.uiValue = userOnCtx.props.object_string.dbValues[0];
            user.dbValue = userOnCtx.uid;
        } else if ( !currentUser.dbValue && user.dbValue === userOnCtx.uid ) {
            user.uiValue = '';
            user.dbValue = '';
        }
    }
    return user;
};

export let updateWidgetTextForGroupClauseProperty = function( data ) {
    let currentGroup = _.cloneDeep( data.currentGroup );
    let group = _.cloneDeep( data.group );
    let userSessionOnCtx = appCtxSvc.getCtx( 'userSession' );
    //if current_group checkbox is checked then update the widget selected element with the current group value
    //else reset the selected element to empty value
    if ( currentGroup && group ) {
        if ( currentGroup.dbValue && group.dbValue !== userSessionOnCtx.props.group.dbValue ) {
            group.uiValue = userSessionOnCtx.props.group.uiValue;
            group.dbValue = userSessionOnCtx.props.group.dbValue;
        } else if ( !currentGroup.dbValue && group.dbValue === userSessionOnCtx.props.group.dbValue ) {
            group.uiValue = '';
            group.dbValue = '';
        }
    }

    return group;
};

/**
 * Initialize the clause property when any clause is selected from the list of clauses
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */
export let clausePropertyValueInitialized = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var user = _.cloneDeep( data.user );
    var currentUser = _.cloneDeep( data.currentUser );
    if ( ctx.RevisionRuleAdmin.User ) {
        user.uiValue = ctx.RevisionRuleAdmin.User.props.object_string.dbValue;
        user.dbValue = ctx.RevisionRuleAdmin.User.uid;
        currentUser.dbValue = ctx.RevisionRuleAdmin.User.uid === ctx.user.uid;
    } else {
        user.uiValue = '';
        user.dbValue = '';
        currentUser.dbValue = false;
    }
    var group = _.cloneDeep( data.group );
    var currentGroup = _.cloneDeep( data.currentGroup );
    if ( ctx.RevisionRuleAdmin.Group ) {
        group.uiValue = ctx.RevisionRuleAdmin.Group.props.object_string.dbValue;
        group.dbValue = ctx.RevisionRuleAdmin.Group.uid;
        currentGroup.dbValue = ctx.RevisionRuleAdmin.Group.uid === ctx.userSession.props.group.dbValue;
    } else {
        group.uiValue = '';
        group.dbValue = '';
        currentGroup.dbValue = false;
    }
    var statusConfigType = _.cloneDeep( data.statusConfigType );
    if ( ctx.RevisionRuleAdmin.statusConfigType ) {
        statusConfigType.dbValue = ctx.RevisionRuleAdmin.statusConfigType.configType;
        statusConfigType.uiValue = ctx.RevisionRuleAdmin.statusConfigType.configDisplay;
    }
    var status = _.cloneDeep( data.status );
    if ( ctx.RevisionRuleAdmin.status === _anyStatus ) {
        status.uiValue = _localeTextBundle.any;
        status.dbValue = _anyStatus;
    } else if ( ctx.RevisionRuleAdmin.status ) {
        status.uiValue = ctx.RevisionRuleAdmin.status.props.object_string.dbValue;
        status.dbValue = ctx.RevisionRuleAdmin.status.uid;
    } else {
        status.uiValue = '';
        status.dbValue = '';
    }
    var unit_no = _.cloneDeep( data.unit_no );
    if ( ctx.RevisionRuleAdmin.unit_no ) {
        unit_no.uiValue = ctx.RevisionRuleAdmin.unit_no;
        unit_no.dbValue = ctx.RevisionRuleAdmin.unit_no;
    }
    var date = _.cloneDeep( data.date );
    if ( ctx.RevisionRuleAdmin.date ) {
        date.uiValue = ctx.RevisionRuleAdmin.date.uiValue;
        date.dbValue = ctx.RevisionRuleAdmin.date.dbValue;
    }
    var today = _.cloneDeep( data.today );
    if ( ctx.RevisionRuleAdmin.today ) {
        today.dbValue = ctx.RevisionRuleAdmin.today;
    }
    var latestConfigType = _.cloneDeep( data.latestConfigType );
    if ( ctx.RevisionRuleAdmin.latestConfigType ) {
        latestConfigType.uiValue = ctx.RevisionRuleAdmin.latestConfigType.uiValue;
        latestConfigType.dbValue = ctx.RevisionRuleAdmin.latestConfigType.dbValue;
    }

    return { user, group, currentUser, currentGroup, status, statusConfigType, unit_no, date, today, latestConfigType };
};

/**
 * Initialize the clause property when RevisionRuleAdminClauseProperties panel content is loaded
 *
 * @param {DeclViewModel} data - RevisionRuleAdminClausePropertiesViewModel
 *
 */

/**
 * Reset AddClause panel clause properties added in context and reselect the clause in the RevisionRule panel, when AddClause panel is closed
 *
 * @param {Object} dataProvider - dataprovider showing the list of clauses
 *
 */
export let resetAddClauseData = function( dataProvider ) {
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_User', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_Group', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_status', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_statusConfigType', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_end_item', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_Fnd0ReleaseEvent', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_plantLocation', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_folder', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_currentlySelectedClauseProperty', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_configBaseline', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_configBaselineState', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_configBaselineDate', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_todayForLMD', undefined );
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_baselineObject', undefined );
};

/**
 * Extract the type filter information from the nested navigation state
 *
 * @param {Object} nestedNavigationState - Nested navigation state
 *
 */
export let getTypeFilter = function( nestedNavigationState ) {
    let currentView =  nestedNavigationState.views[nestedNavigationState.views.length - 1 ];
    let typeFilter = '';

    if( currentView.additionalSubPanelContext ) {
        typeFilter = currentView.additionalSubPanelContext.typeFilter;
    }

    return typeFilter;
};

/**
 * If the end item is being selected in revision rule clause panel, update the
 * property policy so that when Item is returned by the server,
 * it has its properties loaded so that those are see in the client.
 *
 * @param {Object} views - Current list of panels that contains the type filter to be used in end item panel.
 *
 */
export let addPolicyForEndItemClause = function( views ) {
    let currentView =  views[views.length - 1 ];
    if( currentView.additionalSubPanelContext ) {
        if( currentView.additionalSubPanelContext.typeFilter === 'ItemRevision' ) {
            let policyItemWithProps = {
                types: [ {
                    name: 'ItemRevision',
                    properties: [ {
                        name: 'items_tag',
                        modifiers: [ {
                            name: 'withProperties',
                            Value: 'true'
                        } ]
                    }
                    ]
                } ]
            };
            policyId = propPolicySvc.register( policyItemWithProps );
        }
    }
};

/**
 * Remove the policy that was added when end item was selected in revision rule clause panel.
 *
 */
export let removePolicyForEndItemClause = function() {
    if( policyId ) {
        propPolicySvc.unregister( policyId );
        policyId = null;
    }
};

export default exports = {
    processSoaResponseForBOTypes,
    getSearchCriteria,
    updateClauseProperty,
    getUpdatedStatusClause,
    getUpdatedWorkingClause,
    getUpdatedEndItemClause,
    getUpdatedOverrideClause,
    updateUnitClauseText,
    updateDateClauseText,
    updateLatestClauseText,
    updateOverrideClauseText,
    updateEndItemClauseText,
    removeClauseProperty,
    updateStatusConfigType,
    usersListSelectionChanged,
    groupsListSelectionChanged,
    statusListSelectionChanged,
    getSearchStringValue,
    processSearchResults,
    validateStatusWidgetValue,
    clausePropertyValueInitialized,
    resetAddClauseData,
    updateWidgetTextForUserClauseProperty,
    updateWidgetTextForGroupClauseProperty,
    modifyClauseProperty,
    createClausePropertyForAddClause,
    getSelectedClause,
    getClausePropertiesType,
    getClausePropertiesPanelTitle,
    updateValueInClauseProperties,
    getTypeFilter,
    addPolicyForEndItemClause,
    removePolicyForEndItemClause
};
