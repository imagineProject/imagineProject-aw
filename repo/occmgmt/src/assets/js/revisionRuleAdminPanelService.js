// Copyright (c) 2022 Siemens

/**
 * @module js/revisionRuleAdminPanelService
 */
import appCtxSvc from 'js/appCtxService';
import AwFilterService from 'js/awFilterService';
import localeSvc from 'js/localeService';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revRuleConfigService from 'js/aceRevisionRuleConfigurationService';
import occmgmtUtils from 'js/occmgmtUtils';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import messagingSvc from 'js/messagingService';
import popupSvc from 'js/popupService';
import dialogService from 'js/dialogService';
import dateTimeService from 'js/dateTimeService';
import uwPropertyService from 'js/uwPropertyService';
import showRevRuleClausePropertiesService from 'js/showRevRuleClausePropertiesService';

var _localeTextBundle = null;

const months = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];

var jitterFreePropLoad = 'aceActiveContext.context.transientRequestPref.jitterFreePropLoad';

function _convertDate( dateInEpochFormat ) {
    return AwFilterService.instance( 'date' )( dateInEpochFormat, 'yyyy-MM-dd' ) + 'T' +
        AwFilterService.instance( 'date' )( dateInEpochFormat, 'HH:mm:ssZ' );
}

function getSRUidFromRevRuleUid( revRuleUid ) {
    var srUID;
    if( clientDataModelSvc.isValidObjectUid( revRuleUid ) ) {
        var obj = clientDataModelSvc.getObject( revRuleUid );
        if( obj ) {
            srUID = obj.serializedRevRule;
        }
    }
    return srUID;
}

function omitUnwantedProperties( clauses, propertiesToOmit ) {
    var outClauses = [];
    if( clauses ) {
        clauses.forEach( function( clause ) {
            var outClause = _.omit( clause, propertiesToOmit );
            outClauses.push( outClause );
        } );
    }
    return outClauses;
}

/**
 * Update Revision rule admin context
 *
 * @param {String} entriesInfo - Path to the context
 *
 */
function processRevisionRuleInfo( entriesInfo, productContextInfo ) {
    entriesInfo.forEach( function( entry ) {
        if( entry.entryType === 3 ) {
            var utcDateString = entry.revRuleEntryKeyToValue.date;
            if( utcDateString ) {
                // Date - Convert UTC to client locale
                var date = new Date( utcDateString );
                var timeEnabled = productContextInfo && productContextInfo.props.awb0EffDate && productContextInfo.props.awb0EffDate.propertyDescriptor.constantsMap.timeEnabled;
                var isTimeEnabled = timeEnabled && timeEnabled === '1';
                var dateInTime = date.getTime();
                var dateTimeFormat = isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();
                var DateUIValue = dateTimeService.formatNonStandardDate( dateInTime, dateTimeFormat );
                var currentEffectiveDate = uwPropertyService.createViewModelProperty( DateUIValue,
                    DateUIValue, 'STRING', DateUIValue, '' );
                currentEffectiveDate.uiValue = AwFilterService.instance( 'date' )( DateUIValue, dateTimeFormat );
                entry.revRuleEntryKeyToValue.date = currentEffectiveDate.uiValue;

                if( entry.revRuleEntryKeyToValue.today !== 'true' ) {
                    var entryText = _localeTextBundle.date + '( ' + entry.revRuleEntryKeyToValue.date + ' )';
                    entry.displayText = entryText;
                }
            }
        }
        if( entry.entryType === 15 ) {
            entry.displayText = processRevisionRuleInfoForConfigBaseline( entry, productContextInfo );
        }
    } );
}

/**
 * Update Revision rule admin context
 *
 * @param {String} entriesInfo - Path to the context
 *
 */
function processRevisionRuleInfoForConfigBaseline( entry, productContextInfo ) {
    var utcDateStringForBaseline = entry.revRuleEntryKeyToValue.baseline_last_modify_date;
    var timeEnabled = productContextInfo && productContextInfo.props.awb0EffDate && productContextInfo.props.awb0EffDate.propertyDescriptor.constantsMap.timeEnabled;
    var isTimeEnabled = timeEnabled && timeEnabled === '1';
    var displayText;
    if( utcDateStringForBaseline ) {
        // Date - Convert UTC to client locale
        var dateForBaseline = new Date( utcDateStringForBaseline );
        var utcDateStringForBaselineInTime = dateForBaseline.getTime();
        var dateTimeFormat = isTimeEnabled ? dateTimeService.getSessionDateTimeFormat() : dateTimeService.getSessionDateFormat();
        var DateUIValue = dateTimeService.formatNonStandardDate( utcDateStringForBaselineInTime, dateTimeFormat );
        var clientLocaleDateForBaseline = uwPropertyService.createViewModelProperty( DateUIValue,
            DateUIValue, 'STRING', DateUIValue, '' );
        clientLocaleDateForBaseline.uiValue = AwFilterService.instance( 'date' )( DateUIValue, dateTimeFormat );
        entry.revRuleEntryKeyToValue.baseline_last_modify_date = clientLocaleDateForBaseline.uiValue;
    }
    if( entry.revRuleEntryKeyToValue.baseline_last_modify_date !== '' ) {
        var configBaselineClause = _localeTextBundle.hasConfigBaselineType;
        var configBaselineValues = entry.revRuleEntryKeyToValue;
        var ctx = revisionRuleAdminCtx.getCtx();
        if ( ctx.RevisionRuleAdmin.configBaselineList ) {
            for ( var i = 0; i < ctx.RevisionRuleAdmin.configBaselineList.length; i++ ) {
                if ( ctx.RevisionRuleAdmin.configBaselineList[i].propInternalValue === configBaselineValues.baseline_type ) {
                    var configBaselineDisplayValue = ctx.RevisionRuleAdmin.configBaselineList[i].propDisplayValue;
                }
            }
        }
        var configBaselineStateDisplay = showRevRuleClausePropertiesService.showConfigBaselineStateDisplay( configBaselineValues.baseline_state );
        if( configBaselineDisplayValue !== '' && configBaselineDisplayValue !== undefined  &&  configBaselineStateDisplay !== '' && configBaselineStateDisplay !== undefined && configBaselineValues.baseline_last_modify_date !== '' && configBaselineValues.baseline_last_modify_date !== undefined ) {
            displayText = configBaselineClause + '( ' + configBaselineDisplayValue + ', ' + configBaselineStateDisplay + ', ' + configBaselineValues.baseline_last_modify_date + ' )';
        } else if( configBaselineDisplayValue !== '' && configBaselineDisplayValue !== undefined &&  configBaselineValues.baseline_last_modify_date !== '' && configBaselineValues.baseline_last_modify_date !== undefined ) {
            displayText = configBaselineClause + '( ' + configBaselineDisplayValue + ', ' + configBaselineValues.baseline_last_modify_date + ' )';
        }
    }
    if ( entry.revRuleEntryKeyToValue.today === 'true' ) {
        var configBaselineClausePropertyInitiatedEvent = 'RevisionRuleAdminEventClause.configBaselineClausePropertyValueInitialized';
        displayText = entry.displayText;
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'todayForLMD', true );
        eventBus.publish( configBaselineClausePropertyInitiatedEvent );
    }
    return displayText;
}

/**
 * Check if any of the revision rule, unit effectivity, date effectivity or end item is changed from header and we need to refresh the Revsion rule panel accordingly
 *  @return {Boolean} revRulePanleToBeRefreshed
 *
 */
function isRevisionRulePanelToBeRefreshed( occContext, previousPCIUid ) {
    var revRulePanleToBeRefreshed = false;

    //check if productContextChangedEvent is published because of the change in revision rule, unit effectivity, date effectivity or end item
    if( previousPCIUid ) {
        var productContextInGetOccInputUid = previousPCIUid;
        if( !clientDataModelSvc.isValidObjectUid( productContextInGetOccInputUid ) ) {
            //ideally this check should not be present . However even though there is no change in the PCI in atomic data, observer associated with that is getting activated.
            //So adding this check to safeguard
            return revRulePanleToBeRefreshed;
        }
        var productContextInGetOccInput = clientDataModelSvc.getObject( productContextInGetOccInputUid );
        var currentProductContext = occContext.productContextInfo;

        var revRuleInGetOccInput = '';
        var currentRevRule = '';
        if( _.get( productContextInGetOccInput, 'props.awb0CurrentRevRule.dbValues' ) && _.get( productContextInGetOccInput, 'props.awb0CurrentRevRule.dbValues' ).length === 1 ) {
            revRuleInGetOccInput = _.get( productContextInGetOccInput, 'props.awb0CurrentRevRule.dbValues' )[ 0 ];
        }
        if( _.get( currentProductContext, 'props.awb0CurrentRevRule.dbValues' ) && _.get( currentProductContext, 'props.awb0CurrentRevRule.dbValues' ).length === 1 ) {
            currentRevRule = _.get( currentProductContext, 'props.awb0CurrentRevRule.dbValues' )[ 0 ];
        }

        var effecDateInGetOccInput = '';
        var currentEffecDate = '';
        if( _.get( productContextInGetOccInput, 'props.awb0EffDate.dbValues' ) && _.get( productContextInGetOccInput, 'props.awb0EffDate.dbValues' ).length === 1 ) {
            effecDateInGetOccInput = _.get( productContextInGetOccInput, 'props.awb0EffDate.dbValues' )[ 0 ];
        }
        if( _.get( currentProductContext, 'props.awb0EffDate.dbValues' ) && _.get( currentProductContext, 'props.awb0EffDate.dbValues' ).length === 1 ) {
            currentEffecDate = _.get( currentProductContext, 'props.awb0EffDate.dbValues' )[ 0 ];
        }

        var unitInGetOccInput = '';
        var currentUnit = '';
        if( _.get( productContextInGetOccInput, 'props.awb0EffUnitNo.dbValues' ) && _.get( productContextInGetOccInput, 'props.awb0EffUnitNo.dbValues' ).length === 1 ) {
            unitInGetOccInput = _.get( productContextInGetOccInput, 'props.awb0EffUnitNo.dbValues' )[ 0 ];
        }
        if( _.get( currentProductContext, 'props.awb0EffUnitNo.dbValues' ) && _.get( currentProductContext, 'props.awb0EffUnitNo.dbValues' ).length === 1 ) {
            currentUnit = _.get( currentProductContext, 'props.awb0EffUnitNo.dbValues' )[ 0 ];
        }

        var endItemInGetOccInput = '';
        var currentEndItem = '';
        if( _.get( productContextInGetOccInput, 'props.awb0EffEndItem.dbValues' ) && _.get( productContextInGetOccInput, 'props.awb0EffEndItem.dbValues' ).length === 1 ) {
            endItemInGetOccInput = _.get( productContextInGetOccInput, 'props.awb0EffEndItem.dbValues' )[ 0 ];
        }
        if( _.get( currentProductContext, 'props.awb0EffEndItem.dbValues' ) && _.get( currentProductContext, 'props.awb0EffEndItem.dbValues' ).length === 1 ) {
            currentEndItem = _.get( currentProductContext, 'props.awb0EffEndItem.dbValues' )[ 0 ];
        }

        //compare revision rule , date effectivity, unit effectivity and end item from old ProductContextInfo (get from GetOccInput) and new ProductContextInfo (after getOcc call)
        if( revRuleInGetOccInput !== currentRevRule || effecDateInGetOccInput !== currentEffecDate || unitInGetOccInput !== currentUnit || endItemInGetOccInput !== currentEndItem ) {
            revRulePanleToBeRefreshed = true;
        }
    }
    return revRulePanleToBeRefreshed;
}

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * cancel modification done in rev rule and reset the panel to original
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {State Object} nestedNavigationState - state maintain while navigating across panel
 *  @param {DataProvider} dataProvider - dataProvider
 */

export let cancelModification = function( data, nestedNavigationState, dataProvider ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );

    //reset data provider and data.clauses to original using deepclone
    var ctx = revisionRuleAdminCtx.getCtx();

    //update clauses on panel with original clauses
    var orgClauses = _.cloneDeep( ctx.RevisionRuleAdmin.originalClauses );

    if ( nestedNavigationState ) {
        newNestedNavigationState.clauses = orgClauses;
        newNestedNavigationState.selectedClauseIndex = 0;

        //update dataProvider
        dataProvider.update( orgClauses, orgClauses.length );

        //set selection back to 1st in list
        dataProvider.selectionModel.setSelection( orgClauses[ 0 ] );

        //reset revRuleName to previous value
        if( data.revRuleName ) {
            var revRuleName = _.cloneDeep( data.revRuleName );
            revRuleName.uiValue = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_string.dbValues[ 0 ];
        }

        //set same clause warning text visibility false - As doing reset for exactlySameClauseWarning here, no need to trigger the resetExactlySameClauseWarning event in action
        if( newNestedNavigationState.exactlySameClauseWarning ) {
            newNestedNavigationState.exactlySameClauseWarning = false;
        }

        var isClauseModified = _.cloneDeep( data.isClauseModified );
        isClauseModified.dbValue = false;
        nestedNavigationState.update( newNestedNavigationState );
        return { revRuleName, isClauseModified };
    }
};

/**
 * Update selected clause in list on panel -section close event
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 */

export let updateRevisionRuleClauseSelection = function( data ) {
    if( data.eventData && data.dataProviders && data.dataProviders.getRevisionRuleInfoProvider ) {
        let dataProvider = data.dataProviders.getRevisionRuleInfoProvider;
        let clauseText = data.eventData.caption;

        if( clauseText ) {
            let viewModelCollection = dataProvider.getViewModelCollection();
            let loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();

            for( let inx = 0; inx < loadedVMObjs.length; inx++ ) {
                let clauseFound = _.isEqual( loadedVMObjs[ inx ].displayText, clauseText );
                let groupClauseFound = _.isEqual( loadedVMObjs[ inx ].clauseTitle, clauseText );
                let selectionModel = dataProvider.selectionModel;

                if( clauseFound || groupClauseFound ) {
                    if( selectionModel ) {
                        selectionModel.setSelection( loadedVMObjs[ inx ] );
                    }
                    break;
                }
            }
        }
        return true;
    }
};

/**
 * Get Revision rule
 *
 * @return {IModelObject} Revision rule model object
 */
export let getRevisionRule = function() {
    var revRuleUid = null;
    var ctx = revisionRuleAdminCtx.getCtx();
    if( ctx.sublocation.nameToken === 'com.siemens.splm.client.revruleadmin.revRuleAdmin' ) {
        revRuleUid = ctx.mselected[ 0 ].uid;
    } else if( ctx.RevisionRuleAdmin ) {
        var currentRevRule = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule;
        revRuleUid = currentRevRule.uid;
        var srUid;
        if( currentRevRule && currentRevRule.serializedRevRule && currentRevRule.serializedRevRule.length > 0 ) {
            // This is when transient rev rule is updated from rev rule admin panel
            srUid = currentRevRule.serializedRevRule;
        } else {
            // This is when transient rev rule is selected from config header popup
            srUid = getSRUidFromRevRuleUid( revRuleUid );
        }

        if( srUid ) {
            revRuleUid = srUid;
        }
    }
    return revRuleUid;
};

/**
 * Add modify tag to revision rule
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 */
export let tagRevisionRuleAsModified = function( revRuleName, isClauseModified, nestedNavigationState ) {
    var isClauseModified = _.cloneDeep( isClauseModified );
    var revRuleName = _.cloneDeep( revRuleName );

    var localTextBundle = localeSvc.getLoadedText( 'OccurrenceManagementConstants' );
    var modified = localTextBundle.modified;
    if( revRuleName && revRuleName.uiValue.toUpperCase().search( modified.toUpperCase() ) === -1 ) {
        var modifiedrevRuleName = revRuleName.uiValue + ' (' + modified + ')';
        revRuleName.uiValue = modifiedrevRuleName;
    }

    var orgClauses = revisionRuleAdminCtx.getRevRuleAdminCtx( 'originalClauses' );
    var currentClauses = omitUnwantedProperties( nestedNavigationState.clauses, [ '$$hashKey', 'selected', 'modified', 'dbValue', 'clauseLines', 'clauseTitle', 'checkboxSelected', 'clauseIndex' ] );
    var noChangesToClauses = _.isEqual( orgClauses, currentClauses );
    isClauseModified.dbValue = !noChangesToClauses;

    return { revRuleName, isClauseModified };
};
export let initializedNestedNavigationState = function(  nestedNavigationState, prodContextUid ) {
    if( _.isUndefined( nestedNavigationState.currentlySelectedClause ) ) {
        let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
        //Previous PCIUid is required to check if configuration has changed from header.
        //Earlier this information was used from occContext.getOccInput, but getOccInput is very heavy hence storing PCIUid on panel state.
        newNestedNavigationState.previousPCIUid = prodContextUid;
        newNestedNavigationState.exactlySameClauseWarning = false;
        newNestedNavigationState.isClauseModified = false;
        newNestedNavigationState.clauses = [];
        newNestedNavigationState.currentlySelectedClause = {
            dbValue: '999',
            uiValue: '',
            entryType:'999'
        };

        nestedNavigationState.update( newNestedNavigationState );
    }
};
/**
 * Show the revision rule clauses in panel
 *
 * @param {Object} response - getRevisionRule SOA Response
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {nestedNavigationState} - Panel Navigation state which is shared across panels to hold the clauses, currentlySelectedClause, etc
 *
 * @return {Object} entriesInfo - Revision rule clauses details
 */
export let processClauses = function( response, data, nestedNavigationState ) {
    if( response.revisionRuleInfo.entriesInfo ) { // && nestedNavigationState.clauses && nestedNavigationState.clauses.length === 0) { //Can not add clause.length check here - when user select differen revisionRuleInfo need to recompute the clause...Need to check if NestedNavigationState can be cleared when user moves from the revision rule panel to the configuration panel. so that when again control comes to revision rule panel caluses.legth would be zero
        var ctx = revisionRuleAdminCtx.getCtx();

        //TODO - if originalClause and updatedClaue modified then should not compute the claused again. should add one more flag to maintain the info that there is addition
        let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'isBranchClausePresent', false );

        //set same clause warning text visibility false
        if( nestedNavigationState.exactlySameClauseWarning ) {
            newNestedNavigationState.exactlySameClauseWarning = false;
        }

        var revRuleName;
        var revRuleDesc;

        if ( ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_string.dbValue ) {
            revRuleName = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_string.dbValue;
        } else {
            revRuleName = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_string.dbValues[0];
        }

        if ( ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_desc.dbValue ) {
            revRuleDesc = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_desc.dbValue;
        } else {
            revRuleDesc = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_desc.dbValues[0];
        }

        data.dispatch( { path: 'data.revRuleName.uiValue', value: revRuleName } );
        data.dispatch( { path: 'data.revRuleDesc.uiValue', value: revRuleDesc } );

        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'isNestedEffectivityPresent', response.nestedEffectivity );

        for( var inx = 0; inx < response.revisionRuleInfo.entriesInfo.length; ++inx ) {
            if( response.revisionRuleInfo.entriesInfo[ inx ].entryType === 10 ) {
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'isBranchClausePresent', true );
                break;
            }
        }

        processRevisionRuleInfo( response.revisionRuleInfo.entriesInfo, data.subPanelContext.occContext.productContextInfo );

        var originalClauses = _.cloneDeep( response.revisionRuleInfo.entriesInfo );
        newNestedNavigationState.clauses = originalClauses;

        //Select the first clause after processing the SOA response
        newNestedNavigationState.selectedClauseIndex = 0;
        newNestedNavigationState.isClauseModified = false;
        data.isClauseModified.dbValue = false;
        delete newNestedNavigationState.isClauseModifiedByGroupUngroup;
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'originalClauses', originalClauses );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'computeClauses', false );

        if( _.get( data, 'dataProviders.getRevisionRuleInfoProvider' ) ) {
            data.dataProviders.getRevisionRuleInfoProvider.update( response.revisionRuleInfo.entriesInfo, response.revisionRuleInfo.entriesInfo.length );
        }

        newNestedNavigationState.groupUsageTypeEntryType = 17;
        newNestedNavigationState.groupItemTypeEntryType = 9;

        // //Select first clause as selected - commenting this as seperate action selectClause is doing the clause selection logic
        // let selectionModel = data.dataProviders.getRevisionRuleInfoProvider.selectionModel;
        // let loadedVMObjs = data.dataProviders.getRevisionRuleInfoProvider.getViewModelCollection().getLoadedViewModelObjects();
        // if( loadedVMObjs.length > 0 ) {
        //     selectionModel.setSelection( loadedVMObjs[ 0 ] ); //Recheck if this will result into any race condition
        //     newNestedNavigationState.currentlySelectedClause.dbValue = loadedVMObjs[ 0 ].entryType;
        // }
        nestedNavigationState.update( newNestedNavigationState );
        //return newNestedNavigationState;
    }

    return null;
};

export let getUpdatedRevisionRule = function( response, data, productContextInfo ) {
    if( response && response.revisionRuleInfo && response.ServiceData && !response.ServiceData.partialErrors ) {
        if( response.revisionRuleInfo.entriesInfo ) {
            processRevisionRuleInfo( response.revisionRuleInfo.entriesInfo, productContextInfo );
        }
        var revisionRuleInfo = response.revisionRuleInfo;
        var updatedRevRuleUid = revisionRuleInfo.uid;
        var ctx = revisionRuleAdminCtx.getCtx();
        //Update the clauses section
        var eventData = {
            clauses: revisionRuleInfo.entriesInfo
        };
        eventBus.publish( 'RevisionRulesLoadClauses', eventData );
        var originalClauses = _.cloneDeep( revisionRuleInfo.entriesInfo );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'originalClauses', originalClauses );

        if( response.ServiceData && response.ServiceData.created && response.ServiceData.created.length > 0 ) {
            var transientRevRuleUid = response.ServiceData.created[ 0 ];
            var transientRevRule = response.ServiceData.modelObjects[ transientRevRuleUid ];
            if( transientRevRule ) {
                transientRevRule.serializedRevRule = updatedRevRuleUid;
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedRevisionRule', transientRevRule );
            }
        }
        var revRuleUID = '';
        if( response.ServiceData.created && response.ServiceData.created.length > 0 ) {
            revRuleUID = response.ServiceData.created[ 0 ];
        }
        if( revRuleUID !== productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ] ) {
            //Fire configuration change event
            if( data.subPanelContext && data.subPanelContext.occContext ) {
                var value = {
                    configContext : {
                        r_uid: revRuleUID,
                        useGlobalRevRule: null,
                        var_uids: revRuleConfigService.evaluateVariantRuleUID( data.subPanelContext.occContext ),
                        iro_uid: null,
                        de: null,
                        ue: null,
                        ei_uid: null,
                        rev_sruid: updatedRevRuleUid,
                        startFreshNavigation: true
                    },
                    transientRequestPref : {
                        userGesture : 'REVISION_RULE_CHANGE',
                        jitterFreePropLoad : true
                    }
                };
                occmgmtUtils.updateValueOnCtxOrState( '', value, data.subPanelContext.occContext );
            }
        }
    }
};


export let saveRevRuleIfRequiredAndConfigureProduct = function( subPanelContext ) {
    //Compare current clauses with the original
    var orgClauses = revisionRuleAdminCtx.getRevRuleAdminCtx( 'originalClauses' );
    var currentClauses = omitUnwantedProperties( subPanelContext.nestedNavigationState.clauses, [ '$$hashKey', 'selected', 'modified', 'dbValue', 'clauseLines', 'clauseTitle', 'checkboxSelected', 'clauseIndex' ] );
    var noChangesToClauses = _.isEqual( orgClauses, currentClauses );
    var currentRevRule = revisionRuleAdminCtx.getRevRuleAdminCtx( 'currentlySelectedRevisionRule' );
    var revRuleUid = currentRevRule.uid;
    var awb0CurrentRevRuleUid = '';
    var currentRevRuleVal = subPanelContext.occContext.productContextInfo.props;

    if( currentRevRuleVal && currentRevRuleVal.awb0CurrentRevRule && currentRevRuleVal.awb0CurrentRevRule.dbValues ) {
        awb0CurrentRevRuleUid = subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ];
    }

    if( noChangesToClauses && awb0CurrentRevRuleUid !== revRuleUid ) {
        var srUID = getSRUidFromRevRuleUid( revRuleUid );

        //Only Configure the product
        var value = {
            configContext : {
                r_uid: revRuleUid,
                useGlobalRevRule: null,
                var_uids: revRuleConfigService.evaluateVariantRuleUID( subPanelContext.occContext ),
                iro_uid: null,
                de: null,
                ue: null,
                ei_uid: null,
                rev_sruid: srUID,
                startFreshNavigation: true
            },
            transientRequestPref : {
                userGesture : 'REVISION_RULE_CHANGE',
                jitterFreePropLoad : true
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, subPanelContext.occContext );
    } else if( !noChangesToClauses ) {
        //Save the changes and configure the product
        eventBus.publish( 'RevisionRuleAdminPanel.saveRevRuleAndConfigureProduct' );
    }
};

export let getModifiedRevisionRuleName = function(  inputRevRuleName, inputIsClauseModified, nestedNavigationState  ) {
    let { revRuleName, isClauseModified } = exports.tagRevisionRuleAsModified(  inputRevRuleName, inputIsClauseModified, nestedNavigationState  );
    return revRuleName.uiValue;
};

/**
 * Set RevisionRuleAdmin context for Revision rule panel with clauses
 *
 * @param {ViewModelObject} currentlySelectedRevisionRule - currently selected revision rule
 *
 */
export let setRevisionRuleAdminPanelContext = function( currentlySelectedRevisionRule ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var contextViewKey = 'aceActiveContext.context';
    if( ctx.splitView && ctx.splitView.mode ) {
        contextViewKey = ctx.aceActiveContext.key;
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'contextViewKey', contextViewKey );

    if( currentlySelectedRevisionRule.uid === 'globalRevisionRuleEntry' ) {
        var uid = null;
        if( ctx.userSession.props.awp0RevRule.dbValue.propInternalValue ) {
            uid = ctx.userSession.props.awp0RevRule.dbValue.propInternalValue;
        } else {
            uid = ctx.userSession.props.awp0RevRule.dbValue;
        }
        currentlySelectedRevisionRule = tcViewModelObjectService.createViewModelObjectById( uid );
    }

    var revisionRuleAdmin = appCtxSvc.getCtx( 'RevisionRuleAdmin' );
    revisionRuleAdmin.currentlySelectedRevisionRule = currentlySelectedRevisionRule;
    //Flag to indicate different revision rule is selected to show in RevisionRule Admin panel
    revisionRuleAdmin.computeClauses = true;
    revisionRuleAdmin.revisionRuleAdminPanel = true;
    revisionRuleAdmin.closeHandlerToBeActivated = true;
    appCtxSvc.updatePartialCtx( 'RevisionRuleAdmin', revisionRuleAdmin );
    popupSvc.hide( 'AceRevisionRulePopupContent' );
    // eventBus.publish( 'RevisionRuleAdminPanel.UpdateDataProvider' );//- reheck why this is needed - panel onmount would initilize dataProvider
};

/**
 * Move the clauses up in the list
 *
 * @param {Object} nestedNavigationState - Nested navigation state to update with modified clause sequence
 * @param {Object} dataProvider - data provider for displaying the clauses
 *
 */
export let moveClauseUpInternal = function( nestedNavigationState, dataProvider ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    var selectedIndex = dataProvider.getSelectedIndexes();
    var clauses = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    var clauseToBeMoved = clauses[ selectedIndex[ 0 ] - 1 ];
    clauses[ selectedIndex[ 0 ] - 1 ] = dataProvider.selectedObjects[ 0 ];
    clauses[ selectedIndex[ 0 ] ] = clauseToBeMoved;

    dataProvider.update( clauses, clauses.length );
    newNestedNavigationState.selectedClauseIndex -= 1;
    newNestedNavigationState.clauses = clauses;
    nestedNavigationState.update( newNestedNavigationState );
    //Should we really trigger event or we should call the function , to avoid multiple updates and panel render
    //TODO - Amruta - revisit this event publish code at all the places
    eventBus.publish( 'RevisionRuleAdminPanel.tagRevisionRuleAsModified', null );
};

/**
 * Move the clauses down in the list
 *
 * @param {Object} nestedNavigationState - Nested navigation state to update with modified clause sequence
 * @param {Object} dataProvider - data provider for displaying the clauses
 *
 */
export let moveClauseDownInternal = function( nestedNavigationState, dataProvider ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    var selectedIndex = dataProvider.getSelectedIndexes();
    var clauses = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    var clauseToBeMoved = clauses[ selectedIndex[ 0 ] + 1 ];
    clauses[ selectedIndex[ 0 ] + 1 ] = dataProvider.selectedObjects[ 0 ];
    clauses[ selectedIndex[ 0 ] ] = clauseToBeMoved;

    dataProvider.update( clauses, clauses.length );
    newNestedNavigationState.selectedClauseIndex += 1;
    newNestedNavigationState.clauses = clauses;
    nestedNavigationState.update( newNestedNavigationState );
    //Should we really triger event or we should call the function , to avoid multiple updates and panel render
    //TODO - Amruta - revisit this event publish code at all the places
    eventBus.publish( 'RevisionRuleAdminPanel.tagRevisionRuleAsModified', null );
};


/**
 * Delete the selected clause
 *
 * @param {Object} nestedNavigationState - Nested navigation state to update with modified clause sequence
 * @param {Object} dataProvider - data provider for displaying the clauses
 *
 */
export let deleteClauseInternal = function( nestedNavigationState, dataProvider ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );

    var selectedIndex = dataProvider.getSelectedIndexes();
    var objects = dataProvider.viewModelCollection.getLoadedViewModelObjects();

    var objectToSelectAfterDelete;
    if( objects.length > 1 ) {
        if( selectedIndex[ 0 ] === 0 ) {
            objectToSelectAfterDelete = objects[ selectedIndex[ 0 ] + 1 ];
        } else {
            objectToSelectAfterDelete = objects[ selectedIndex[ 0 ] - 1 ];
        }
    }
    var remainingObjects = _.difference( objects, dataProvider.selectedObjects );
    //set similarClause warning false if the similar clause is deleted
    if( dataProvider.selectedObjects[ 0 ].isRepeated ) {
        if( nestedNavigationState.exactlySameClauseWarning ) {
            newNestedNavigationState.exactlySameClauseWarning = false;
        }
    }

    eventBus.publish( 'RevisionRuleAdminPanel.tagRevisionRuleAsModified', null );
    dataProvider.update( remainingObjects, remainingObjects.length );
    //Select the nearest clause
    if( objectToSelectAfterDelete ) {
        dataProvider.selectionModel.setSelection( objectToSelectAfterDelete );
    }
    newNestedNavigationState.currentlySelectedClause = objectToSelectAfterDelete;
    newNestedNavigationState.clauses = remainingObjects;

    nestedNavigationState.update( newNestedNavigationState );
};

/**
 * Publish Event to deleteClause
 */

/**
 *  Select the clause
 * @param {Object} nestedNavigationState - Nested navigation state to update clause to select information
 * @param {Object} dataprovider - dataprovider showing the list of clauses
 *
 */
export let selectClause = function( dataProvider, nestedNavigationState ) {
    let index = 0;

    if( nestedNavigationState.selectedClauseIndex !== undefined ) {
        index = nestedNavigationState.selectedClauseIndex;
    }
    let selectionModel = dataProvider.selectionModel;
    let loadedVMObjs = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    //coming back from Add Clause to RevisionRuleAdmin panel then dataProvider should be initialize with the clauses in the nestedNavigationState
    if( loadedVMObjs.length === 0 ) {
        dataProvider.update( nestedNavigationState.clauses, nestedNavigationState.clauses.length );
        loadedVMObjs = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    }
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    if( loadedVMObjs.length > 0 ) {
        selectionModel.setSelection( loadedVMObjs[ index ] );
        newNestedNavigationState.currentlySelectedClause.dbValue = loadedVMObjs[ index ].entryType;
    }

    //This is needed to get Rev Rule name updated
    if( nestedNavigationState.clauseUpdated !== undefined && nestedNavigationState.clauseUpdated ) {
        eventBus.publish( 'RevisionRuleAdminPanel.tagRevisionRuleAsModified' );
        delete newNestedNavigationState.clauseUpdated;
    }
    nestedNavigationState.update( newNestedNavigationState );
};

/**
 *  Synchronize the content of dataProvider with the clauses information on nested navigation state
 * @param {Object} nestedNavigationState - Nested navigation state to update clause to select information
 * @param {Object} dataProvider - dataProvider showing the list of clauses and selected clause information
 *
 */
export let syncClausesWithDataProviderData = ( nestedNavigationState, dataProvider, clauseCheckboxState ) => {
    const newNestedNavigationState =  { ...nestedNavigationState.getValue() };

    let viewModelCollection = dataProvider.getViewModelCollection();
    newNestedNavigationState.clauses = viewModelCollection.getLoadedViewModelObjects();

    let newCheckboxState = { ...clauseCheckboxState.getValue() };
    newCheckboxState.clauses = [];

    for( let clauseIndex = 0; clauseIndex < newNestedNavigationState.clauses.length; clauseIndex ++ ) {
        newNestedNavigationState.clauses[ clauseIndex ][ 'clauseIndex' ] = clauseIndex;
        newCheckboxState.clauses.push({selected: false});
    }

    clauseCheckboxState.update(newCheckboxState);
    nestedNavigationState.update( newNestedNavigationState );
};

export let getUpdatedClauses = function( nestedNavigationState ) {
    const newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    newNestedNavigationState.clauses.forEach( function( entry ) {
        if( entry.entryType === 3 && entry.revRuleEntryKeyToValue && entry.revRuleEntryKeyToValue.date && entry.revRuleEntryKeyToValue.date !==
            '' ) {
            // Date - Convert client locale to UTC
            var clientLocaleDateString = entry.revRuleEntryKeyToValue.date;
            if( isNaN( Date.parse( clientLocaleDateString ) ) ) {
                clientLocaleDateString = clientLocaleDateString.replace( /-/g, ' ' );
            }
            var date = new Date( clientLocaleDateString );
            if( date.getFullYear() < 1900 ) {
                date = new Date( 1900, 0, 1 );
            }
            var gmtDate = _convertDate( date.getTime() );
            var gmtDateString = gmtDate.toString();
            entry.revRuleEntryKeyToValue.date = gmtDateString;
        }

        if( entry.entryType === 15 && entry.revRuleEntryKeyToValue && entry.revRuleEntryKeyToValue.baseline_last_modify_date && entry.revRuleEntryKeyToValue.baseline_last_modify_date !== '' ) {
            // Date - Convert client locale to UTC
            var clientLocaleDateString1 = entry.revRuleEntryKeyToValue.baseline_last_modify_date;
            if( isNaN( Date.parse( clientLocaleDateString1 ) ) ) {
                clientLocaleDateString1 = clientLocaleDateString1.replace( /-/g, ' ' );
            }
            var date1 = new Date( clientLocaleDateString1 );
            if( date1.getFullYear() < 1900 ) {
                date1 = new Date( 1900, 0, 1 );
            }
            var gmtDate1 = _convertDate( date1.getTime() );
            var gmtDateString1 = gmtDate1.toString();
            entry.revRuleEntryKeyToValue.baseline_last_modify_date = gmtDateString1;
        }
    } );
    return omitUnwantedProperties( newNestedNavigationState.clauses, [ '$$hashKey', 'selected', 'modified', 'dbValue', 'clauseLines', 'clauseTitle', 'checkboxSelected', 'clauseIndex' ] );
};

/**
 * Update the revision rule in the Revision rule panel if any of the revision rule, unit effectivity, date effectivity or end item is changed from header
 * @param {Object} occContext - atomic data holding information about currently applied configuration
 */
export let updateRevisionRuleInThePanel = function( occContext, previousPCIUid ) {
    let ctx = revisionRuleAdminCtx.getCtx();
    //var isTransientRuleChangedToBaseRevRule = _.get( ctx, 'aceActiveContext.context.supportedFeatures.Awb0TransientRevisionRuleInNonIntropModeFeature' );
    let isTransientRuleChangedToBaseRevRule = occContext.supportedFeatures.Awb0TransientRevisionRuleInNonIntropModeFeature;

    if( isTransientRuleChangedToBaseRevRule ) {
        var displayMessage = _localeTextBundle.transientRuleChangedToBaseRuleMsg;
        messagingSvc.showInfo( displayMessage );
    }
    var revRulePanleToBeRefreshed = isRevisionRulePanelToBeRefreshed( occContext, previousPCIUid );
    if( revRulePanleToBeRefreshed && !ctx.RevisionRuleAdmin.revisionRuleAdminPanel && occContext.productContextInfo.props.awb0CurrentRevRule !== undefined ) {
        var revRuleUid = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.uid;
        var transientRevRule = occContext.productContextInfo.props.awb0CurrentRevRule;

        if( transientRevRule.dbValues !== undefined && transientRevRule.dbValues[ 0 ] !== revRuleUid ) {
            var currentlySelectedRevisionRule = tcViewModelObjectService.createViewModelObjectById( transientRevRule.dbValues );
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedRevisionRule', currentlySelectedRevisionRule );
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'computeClauses', true );
            eventBus.publish( 'RevisionRuleAdminPanel.UpdateDataProvider' );
        }
    }
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'revisionRuleAdminPanel', false );
};

export let closeRevisionRulePanel = function( isClauseModified, popupId ) {
    if( isClauseModified === false ) {
        appCtxSvc.unRegisterCtx( 'RevisionRuleAdmin' );
        dialogService.closeDialog( '', popupId );
    }
};


export let closeSaveAsAndRevisionRulePanel = function( popupId ) {
    appCtxSvc.unRegisterCtx( 'RevisionRuleAdmin' );
    dialogService.closeDialog( '', popupId );
};

export let getClauseModifiedValues = function( isClauseModified, revRuleName, nestedNavigationState ) {
    var orgClauses = revisionRuleAdminCtx.getRevRuleAdminCtx( 'originalClauses' );
    orgClauses = omitUnwantedProperties( orgClauses, [ '$$hashKey', 'selected', 'modified', 'dbValue', 'clauseLines', 'clauseTitle', 'checkboxSelected', 'clauseIndex' ] );
    var currentClauses = omitUnwantedProperties( nestedNavigationState.clauses, [ '$$hashKey', 'selected', 'modified', 'dbValue', 'clauseLines', 'clauseTitle', 'checkboxSelected', 'clauseIndex' ] );
    let isClauseModifiedData = _.cloneDeep( isClauseModified );
    let revRuleNameData = _.cloneDeep( revRuleName );
    if( orgClauses !== undefined ) {
        var noChangesToClauses = _.isEqual( orgClauses, currentClauses );
        isClauseModifiedData.dbValue = !noChangesToClauses;
        if( noChangesToClauses && revRuleNameData ) {
            var ctx = revisionRuleAdminCtx.getCtx();
            revRuleNameData.uiValue = ctx.RevisionRuleAdmin.currentlySelectedRevisionRule.props.object_string.dbValues[ 0 ];
        }
    }
    return { isClauseModifiedData, revRuleNameData };
};

/**
 *  Synchronize the content of isClauseModified with on nested navigation state
 * @param {Object} nestedNavigationState - Nested navigation state to update clause to select information
 * @param {boolean} isClauseModifiedData - Flag indicting if clause is modified or not
 *
 */
export let synchClauseModifiedOnState = function( nestedNavigationState, isClauseModifiedData ) {
    var newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    newNestedNavigationState.isClauseModified = isClauseModifiedData;
    nestedNavigationState.update( newNestedNavigationState );
};

/**
 * Load revisionRules Clauses
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Object} dataProvider - data provider for displaying the clauses
 * @param {Object} nestedNavigationState - Nested navigation state
 * @returns {Object} Return a object containing flag to indicate if clause is modified or not
 */
export let revisionRulesLoadClauses = function( data, dataProvider, nestedNavigationState ) {
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    let clauses = data.eventData.clauses;
    dataProvider.update( clauses, clauses.length );
    var selectionModel = dataProvider.selectionModel;
    var viewModelCollection = dataProvider.getViewModelCollection();
    var loadedVMObjs = viewModelCollection.getLoadedViewModelObjects();
    if( loadedVMObjs.length > 0 ) {
        selectionModel.setSelection( loadedVMObjs[ 0 ] );
    }
    var isClauseModified = _.cloneDeep( data.isClauseModified );
    isClauseModified.dbValue = false;
    newNestedNavigationState.clauses = clauses;
    newNestedNavigationState.isClauseModified = false; //Modified clause is applied so reset the flag
    data.isClauseModified.dbValue = false;
    delete newNestedNavigationState.isClauseModifiedByGroupUngroup;
    newNestedNavigationState.selectedClauseIndex = 0;
    nestedNavigationState.update( newNestedNavigationState );

    eventBus.publish( 'loadRevRuleClausesWithSelectionAndGroup' );

    return { isClauseModified };
};


export let updateCtxAndNestedNavigationStateForNewRevRule = function( response, nestedNavigationState ) {
    if( response && response.revisionRuleInfo && response.ServiceData && !response.ServiceData.partialErrors ) {
        var revisionRuleInfo = response.revisionRuleInfo;
        var ctx = revisionRuleAdminCtx.getCtx();

        var originalClauses = _.cloneDeep( revisionRuleInfo.entriesInfo );
        let newNestedNavigationState = _.cloneDeep( nestedNavigationState );

        newNestedNavigationState.clauses = originalClauses;
        nestedNavigationState.selectedClauseIndex = 0;
        nestedNavigationState.update( newNestedNavigationState );

        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'originalClauses', originalClauses );
        revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'computeClauses', true );

        if( response.ServiceData && response.ServiceData.created && response.ServiceData.created.length > 0 ) {
            var newRevRuleUid = response.ServiceData.created[ 0 ];
            var newRevRule = response.ServiceData.modelObjects[ newRevRuleUid ];
            if( newRevRule ) {
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'currentlySelectedRevisionRule', newRevRule );
            }
        }
    }
};

export let updateIsClauseModifiedOnCondition = ( isClauseModified, nestedNavigationState, clauseCheckboxState ) => {

    let newIsClauseModified = { ...isClauseModified };
    newIsClauseModified.dbValue = nestedNavigationState.isClauseModifiedByGroupUngroup;

    let newNestedNavigationState = nestedNavigationState.getValue();
    let newCheckBoxState = clauseCheckboxState.getValue();

    newCheckBoxState.clauses = [];

    _.forEach( nestedNavigationState.clauses, ( clause, clauseIndex ) => {

        newNestedNavigationState.clauses[ clauseIndex ][ 'clauseIndex' ] = clauseIndex;
        newCheckBoxState.clauses.push({selected: false});
    } );

    newNestedNavigationState.isUnGroupCommandEnable = false;

    clauseCheckboxState.update(newCheckBoxState);
    nestedNavigationState.update( newNestedNavigationState );

    return newIsClauseModified;
};

export let showGroupClauseAppropriatelyOnUI = ( nestedNavigationState, dataProvider, clauseCheckboxState ) => {

    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );

    newNestedNavigationState.isGroupCommandEnable = false;
    newNestedNavigationState.isUnGroupCommandEnable = false;
    let newCheckBoxState = clauseCheckboxState.getValue();
    newCheckBoxState.clauses = [];

    _.forEach( nestedNavigationState.clauses, ( clause, clauseIndex ) => {

        newNestedNavigationState.clauses[ clauseIndex ][ 'clauseIndex' ] = clauseIndex;
        newCheckBoxState.clauses.push({selected: false});

        //Check if any clause is of Group type
        if( clause.entryType === nestedNavigationState.groupUsageTypeEntryType || clause.entryType === nestedNavigationState.groupItemTypeEntryType ) {

            //Index from where elimentary clauses, which grouped under certain category, start in display text
            let elimentaryClauseOpenIndex = clause.displayText.indexOf( '{' );
            //Text containing group clause part
            let groupClauseText = clause.displayText.substring( 0, elimentaryClauseOpenIndex );
            //Text containing elimentary clauses part
            let elimentaryClausesTexts = [];
            _.forEach( clause.groupEntryInfo.listOfSubEntries, ( subEntry, indexOfSubEntry ) => {

                elimentaryClausesTexts.push( subEntry.displayText.trim() );
            } );

            //Find the first opening parenthesis of group clause text
            let indexOfNextOpenParenthesis = groupClauseText.indexOf( '(' );
            /*------------------------------------------------------------------------------------------------
             * This parenthesis balance is used to pick up correct text for displaying the group type entry.
             * Key and their specific values selected for making group clause
             * When parenthesis balance is 0 that means we have traversed whole one part for group clause.
             * When greater than 0, that means one group clause contains multiple parenthesis as text.
             * So it is helpful to ignore parenthesis which are present in values of group clause.
             ------------------------------------------------------------------------------------------------*/
            let parenthesisBalance = ( indexOfNextOpenParenthesis >= 0 ) ? 1 : 0;
            //This array will contain the text for whole group clause formed inside section
            let groupClauseLines = [];

            //This will be the title of the group clause shown in Revision rule admin panel
            newNestedNavigationState.clauses[ clauseIndex ][ 'clauseTitle' ] = groupClauseText.substring( 0, indexOfNextOpenParenthesis ).trim();
            while( parenthesisBalance )
            {
                //This object will contain key value as one line of thet group clause, where key will be type and value will be selected types
                let groupClauseLine = {
                    key: '',
                    value: ''
                };
                let keyText = groupClauseText.substring( 0, indexOfNextOpenParenthesis ).trim();
                let keyTextParts = keyText.split( ' ' );
                keyTextParts.shift();
                groupClauseLine.key = keyTextParts.join( ' ' ).trim();

                //This portion will take out value for group clause ignoring all parenthesis inside selected types text
                groupClauseText = groupClauseText.substring( indexOfNextOpenParenthesis + 1 );
                indexOfNextOpenParenthesis = groupClauseText.indexOf( '(' );
                let indexOfNextCloseParenthesis = groupClauseText.indexOf( ')' );
                parenthesisBalance += ( ( indexOfNextOpenParenthesis >= 0 ) && ( indexOfNextOpenParenthesis < indexOfNextCloseParenthesis ) ) ? 1 : -1;

                while( parenthesisBalance )
                {
                    groupClauseLine.value += groupClauseText.substring( 0, indexOfNextCloseParenthesis + 1 );
                    parenthesisBalance --;
                    groupClauseText = groupClauseText.substring( indexOfNextCloseParenthesis + 1 );
                    indexOfNextOpenParenthesis = groupClauseText.indexOf( '(' );
                    indexOfNextCloseParenthesis = groupClauseText.indexOf( ')' );
                    parenthesisBalance += ( ( indexOfNextOpenParenthesis >= 0 ) && ( indexOfNextOpenParenthesis < indexOfNextCloseParenthesis ) ) ? 1 : -1;
                }
                groupClauseLine.value += groupClauseText.substring( 0, indexOfNextCloseParenthesis );
                groupClauseLine.value = groupClauseLine.value.trim();
                groupClauseLines.push( groupClauseLine );

                //Check if there's more group clauses pending to be processed
                groupClauseText = groupClauseText.substring( indexOfNextCloseParenthesis + 1 );
                indexOfNextOpenParenthesis = groupClauseText.indexOf( '(' );
                parenthesisBalance = ( indexOfNextOpenParenthesis >= 0 ) ? 1 : 0;
            }

            let localTextBundleRevRule = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
            groupClauseLines.push( {
                key: localTextBundleRevRule.makeElimentaryClause,
                value: elimentaryClausesTexts.join( ', ' )
            } );
            newNestedNavigationState.clauses[ clauseIndex ][ 'clauseLines' ] = groupClauseLines;
        }
    } );
    clauseCheckboxState.update(newCheckBoxState);
    nestedNavigationState.update( newNestedNavigationState );
    dataProvider.update( newNestedNavigationState.clauses, newNestedNavigationState.clauses.length );
};

var loadConfiguration = () => {
    _localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
};

loadConfiguration();

export default exports = {
    getRevisionRule,
    tagRevisionRuleAsModified,
    processClauses,
    getUpdatedRevisionRule,
    saveRevRuleIfRequiredAndConfigureProduct,
    getModifiedRevisionRuleName,
    setRevisionRuleAdminPanelContext,
    selectClause,
    getUpdatedClauses,
    closeRevisionRulePanel,
    getClauseModifiedValues,
    updateRevisionRuleClauseSelection,
    updateRevisionRuleInThePanel,
    cancelModification,
    moveClauseUpInternal,
    moveClauseDownInternal,
    deleteClauseInternal,
    revisionRulesLoadClauses,
    syncClausesWithDataProviderData,
    initializedNestedNavigationState,
    synchClauseModifiedOnState,
    updateCtxAndNestedNavigationStateForNewRevRule,
    closeSaveAsAndRevisionRulePanel,
    updateIsClauseModifiedOnCondition,
    showGroupClauseAppropriatelyOnUI
};
