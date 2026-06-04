// Copyright (c) 2022 Siemens

/**
 * File for common configurator utils.
 *
 * @module js/pca0CommonUtils
 */
import addObjectUtils from 'js/addObjectUtils';
import appCtxService from 'js/appCtxService';
import assert from 'assert';
import awPromiseService from 'js/awPromiseService';
import configuratorUtils from 'js/configuratorUtils';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dmService from 'soa/dataManagementService';
import editHandlerService from 'js/editHandlerService';
import eventBus from 'js/eventBus';
import { getBaseUrlPath } from 'app';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import notyService from 'js/NotyModule';
import pca0CommonConstants from 'js/pca0CommonConstants';
import pca0Constants from 'js/Pca0Constants';
import pca0EnumeratedFeatureService from 'js/pca0EnumeratedFeatureService';
import Pca0FilterCriteriaSettingsService from 'js/Pca0FilterCriteriaSettingsService';
import pca0PropertyPolicyService from 'js/pca0PropertyPolicyService';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
const _localeTextBundleOfConfiguratorMessages = localeService.getLoadedText( 'ConfiguratorMessages' );

const FSC_SAVE_COMMAND = 'save';
const FSC_SAVEAS_COMMAND = 'saveAs';

/**
 * Updates the properties on the configContext for the revision rule.
 *
 * @param {String} contextKey To get context information from global CTX
 * @param {Object} configContext - The configContext object.
 * @param {Object} updatedPerspective - The updated perspective object.
 * @param {string} revisionRuleToSet - The PERSISTENT revision rule.
 */
let _updatePropertiesOnCtxForRevRule = ( contextKey, configContext, updatedPerspective, revisionRuleToSet ) => {
    let appliedRevisionRule = updatedPerspective.props.cfg0RevisionRule;
    // This is required to fetch variant rules as SOA takes only revision rule name
    const revisionRuleData = updatedPerspective.props.cfg0RevisionRule.uiValues;
    _.set( configContext, 'configPerspective.revisionRuleDBName', revisionRuleData[0] );
    // Update Revision Rule on configContext
    _.set( configContext, 'appliedSettings.configSettings.props.pca0RevisionRule', appliedRevisionRule );
    // Update latest selected revision Rule to prevent SOA call in case same object is getting selected
    _.set( configContext, 'lastSelectedRevisionRuleUid', revisionRuleToSet );

    // update context
    appCtxService.updateCtx( contextKey, configContext );
};

/**
 * Handles the effectivity change.
 * @param {String} contextKey To get context information from global CTX
 * @param {Object} configContext - The configuration context.
 * @param {Object} updatedPerspective - The updated perspective.
 * @param {boolean} isDateEffectivity - Indicates if the effectivity is based on date.
 */
let _handleEffectivityChange = ( contextKey, configContext, updatedPerspective, isDateEffectivity ) => {
    // Update Effectivity on configContext
    let appliedEffectivity = updatedPerspective.props.cfg0RuleSetEffectivity;
    configContext.appliedSettings.configSettings.props.pca0Effectivity = appliedEffectivity;

    if ( isDateEffectivity ) {
        // Variability Explorer -
        // In Advance reuse dialog box if the picker view is open, going back to search panel.
        // In inline authoring mode if revision rule is changed we are resetting the context value.
        exports.resetAdvancedReuseAndInlineAuthoringMode( configContext );
    }
    // update context
    appCtxService.updateCtx( contextKey, configContext );

    // Re-initialize effectivity
    configuratorUtils.initializeCache( contextKey );
    Pca0FilterCriteriaSettingsService.initializeEffectivity( contextKey );
};

/**
 * Single column validation (header custom menu)
 * @param {Object} validatedColumn - Column that was validated
 * @param {Object} validationSoaResponse - Validation SOA response
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} variabilityProps - VM atomic data <variabilityProps>
 * @param {Object} localeTextBundle - locale i18n text bundle for 'ConfiguratorMessages'
 * @param {String} currentView - tells us in which view we are. This is needed to give appropriate message popup
 */
let _postProcessColumnValidation = ( validatedColumn, validationSoaResponse, validationProps, variabilityProps, localeTextBundle, currentView ) => {
    let validatedColumnUID = validatedColumn.field;
    let viewModelObject = variabilityProps.soaResponse.viewModelObjectMap[validatedColumnUID];
    let displayValue = !_.isUndefined( viewModelObject ) && !_.isUndefined( viewModelObject.displayName ) ? viewModelObject.displayName : validatedColumn.displayName;

    // if isSplitColumn, use originalColumnName for display purposes
    if ( validatedColumn.isSplitColumn ) {
        let origViewModelObject = variabilityProps.soaResponse.viewModelObjectMap[validatedColumn.originalColumnName];
        displayValue = !_.isUndefined( origViewModelObject ) && !_.isUndefined( origViewModelObject.displayName ) ? origViewModelObject.displayName : validatedColumn.displayName;
    }

    let columnValidationOutput = validationSoaResponse[validatedColumnUID];
    if ( columnValidationOutput.criteriaStatus ) {
        if ( currentView === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
            messagingService.showInfo( localeTextBundle.validationSuccessful.replace( '{0}', displayValue ) );
        } else if ( currentView === veConstants.GRID_CONSTANTS.CONSTRAINTS ) {
            messagingService.showInfo( localeTextBundle.constraintValidationSuccessful.replace( '{0}', displayValue ) );
        }
    } else {
        let displayMessage = '';
        let valueToViolations = columnValidationOutput.valueToViolations;
        if ( !_.isUndefined( valueToViolations ) && valueToViolations.hasOwnProperty( validatedColumnUID ) ) {
            let messages = valueToViolations[validatedColumnUID].messages;
            for ( let ix = 0; ix < messages.length; ix++ ) {
                if ( displayMessage !== '' ) {
                    displayMessage += '\n\n';
                }
                displayMessage += `${ix + 1}) ${messages[ix]}`;
            }
        }

        // Update validation map for column being validated only
        // Keep unmodified violation messages for other columns
        validationProps.columnToValidationMap[validatedColumnUID] = displayMessage;

        messagingService.showError( localeTextBundle.validationForExpressionFailed.replace( '{0}', displayValue ) );
    }
};

/**
 * Initial Validation (toolbar)
 * @param {Object} validationSoaResponse - Validation SOA response
 * @param {Object} validationProps - Validation Properties container
 * @param {Object} variabilityProps - VM atomic data <variabilityProps>
 * @param {Object} localeTextBundle - locale i18n text bundle for 'ConfiguratorMessages'
 * @param {String} currentView - tells us in which view we are. This is needed to give appropriate message popup
 * @param {Object} validationFlags - flag for validation states
 */
let _postProcessInitialValidation = ( validationSoaResponse, validationProps, variabilityProps, localeTextBundle, currentView, validationFlags ) => {
    let atleastOneFailed = false;

    // Clean columnValidationMap: reset column validation tooltips
    let columnToValidationMap = {};

    let originalColumnUID;
    for ( let columnUID in validationSoaResponse ) {
        let column = validationSoaResponse[columnUID];
        if ( column.criteriaStatus === false ) {
            originalColumnUID = exports.getOriginalColumnKeyFromSplitColumnKey( columnUID );
            let viewModelObject = variabilityProps.soaResponse.viewModelObjectMap[originalColumnUID];

            let displayValue = !_.isUndefined( viewModelObject ) && !_.isUndefined( viewModelObject.displayName ) ?
                viewModelObject.displayName : _getColumnDisplayName( variabilityProps.columnProperties, columnUID );
            let displayMessage = localeTextBundle.initialValidationForExpressionFailed.replace( '{0}', displayValue );
            columnToValidationMap[columnUID] = displayMessage;

            if ( !atleastOneFailed ) {
                atleastOneFailed = true;
            }
        }
    }

    // Update entire validation Map
    validationProps.columnToValidationMap = columnToValidationMap;

    if ( atleastOneFailed ) {
        messagingService.showError( localeTextBundle.multiValidationTooltip );
    } else {
        if ( currentView === pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION ) {
            messagingService.showInfo( localeTextBundle.multiValidationSuccessful );
        } else if( currentView === veConstants.GRID_CONSTANTS.CONSTRAINTS ) {
            if( validationFlags ) {
                messagingService.showInfo( localeTextBundle.multiConstraintsValidationSuccessful + ' (' + localeTextBundle.validateArithmeticConstraint + ')' );
            } else{
                messagingService.showInfo( localeTextBundle.multiConstraintsValidationSuccessful );
            }
        }
    }
};

/**
 * Returns the display name of a column based on its UID.
 * @param {Array} columnProperties - An array of objects representing the properties of each column.
 * @param {String} columnUID - The unique identifier of the column for which to retrieve the display name.
 * @returns {String} The display name of the column, or the column UID if no display name is found in the column properties.
 */
let _getColumnDisplayName = ( columnProperties, columnUID ) => {
    // If columnProperties is empty, return columnUID
    if ( _.isEmpty( columnProperties ) ) {
        return columnUID;
    }
    // Loop through each column property
    for ( const columnProperty of columnProperties ) {
        if ( columnProperty.propertyUid === columnUID ) {
            return columnProperty.propertyDisplayName;
        }
    }
    // If no matching property is found, return columnUID
    return columnUID;
};

/**
 * Format Display Name property for Free Form - Date type VMO
 * @param {Object} viewModelObject - View Model Object
 */
let _formatFreeFormDateDisplayName = function( viewModelObject ) {
    let displayName = viewModelObject.displayName;
    const result = displayName.split( ' ' );
    if ( result.length > 1 ) {
        const fromOp = result[0];
        const fromDate = result[1];
        const toOp = result[3];
        const toDate = result[4];
        const fromDateStr = exports.getFormattedDateFromUTC( fromDate );
        displayName = fromOp + ' ' + fromDateStr;
        if ( result[3] && result[4] ) {
            const toDateStr = exports.getFormattedDateFromUTC( toDate );
            displayName += ' & ' + toOp + ' ' + toDateStr;
        }
    } else {
        displayName = exports.getFormattedDateFromUTC( displayName );
    }
    viewModelObject.displayName = displayName;
};


let exports = {};

/**
 * Handle Start Edit Mode for the given context
 * @param {String} contextKey editing context
 * @param {Boolean} skipCtxUpdate - true if 'isVariantTableEditing' must not be set on global Ctx.
 */
export let handleEditModeStart = ( contextKey ) => {
    // Set IS_VARIANT_TREE_IN_EDIT_MODE
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, true );

    // edit button should not be visible in PWA as we are entering in edit mode
    // in SWA by clicking on any of the cell in SWA grid
    exports.setVisibilityOfEditCommandInPWA( false /*visibility*/ );

    // Notify Edit mode is now active.
    // This will allow subscribers to take care of synchronizing own editHandler states
    eventBus.publish( 'Pca0VariabilityTree.editModeActivated', { editingContext: contextKey } );
};

/**
 * Reset editHandler state and global Ctx flags for variantTable editing
 * This API is needed when cancelEdits is called:
 * - by the user when pressing save/cancel commands
 * - by CFX leaveConfirmation when 'full/bulk' editHandler is forcefully stopped
 * ----- (this can happen when PWA selection changes or when user wants to direc edit PWA)
 */
export let resetEditModeStatus = () => {
    appCtxService.updateCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
    exports.setVisibilityOfEditCommandInPWA( true /* visibility */ );
};

/**
 * Displays a notification with two action buttons ( either to proceed or to abort ) and resolves a promise when either is clicked.
 * @param {Function} onProceedCallback - Callback function to execute when the "Continue" button is clicked
 * @param {Function} onAbortCallback - Callback function to execute when the "Cancel" button is clicked
 * @param {String} proceedLabel - The label for the proceed action
 * @param {String} abortLabel - The label for the abort action
 * @param {String} notificationMessage - The message to display in the notification
 * @returns {Object} promise Object
 */
export let displayNotificationMessage = ( onProceedCallback, onAbortCallback, proceedLabel, abortLabel, notificationMessage ) => {
    // If a popup is already active, just return the existing promise
    if ( !self._deferredPopup ) {
        self._deferredPopup = awPromiseService.instance.defer();
        let buttonArray = [];

        let createButton = function( label, callback ) {
            return {
                addClass: 'btn btn-notify',
                text: label,
                onClick: callback
            };
        };

        buttonArray.push( createButton( abortLabel, function( $noty ) {
            $noty.close();
            if ( onAbortCallback ) {
                onAbortCallback();
            }
            self._deferredPopup.resolve();
            self._deferredPopup = null;
        } ) );

        buttonArray.push( createButton( proceedLabel, function( $noty ) {
            $noty.close();
            if ( onProceedCallback ) {
                onProceedCallback();
            }
            self._deferredPopup.resolve();
            self._deferredPopup = null;
        } ) );

        notyService.showWarning( notificationMessage, buttonArray );
        return self._deferredPopup.promise;
    }
    return self._deferredPopup.promise;
};

/**
 * Set the Visibility of Edit command in Primary work area
 * @param {Boolean} visible - true to set the edit command in PWA as visible and false otherwise
 */
export let setVisibilityOfEditCommandInPWA = ( visible ) => {
    // NONE is the context which is used to control the visibility of table/tree table in PWA.
    // We cannot use TABLE_CONTEXT to control the visibility of the edit command as
    // if we set TABLE_CONTEXT['_editing\] to true, this leads to table in edited mode
    // which is not our intension. We just want to hide the edit command without turning
    // the table into edited mode.
    appCtxService.updatePartialCtx( 'NONE[\'_editing\']', !visible );
};

/**
 *  Process the partial error in SOA response if there are any
 * @param {Object} serviceData from SOA response
 */
export let processPartialErrors = ( serviceData ) => {
    var msgObj = {
        name: '',
        msg: '',
        level: 0
    };

    if ( serviceData && serviceData.partialErrors ) {
        for ( var x = 0; x < serviceData.partialErrors.length; x++ ) {
            for ( var y = 0; y < serviceData.partialErrors[x].errorValues.length; y++ ) {
                msgObj.msg += serviceData.partialErrors[x].errorValues[y].message;
                msgObj.msg += '<BR/>';
                msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[x].errorValues[y].level ] );
            }
        }

        if ( msgObj.level <= 1 ) {
            messagingService.showInfo( msgObj.msg );
        } else {
            messagingService.showError( msgObj.msg );
        }
    }
};

/**
 * Return cache status for revision rule data in context
 * @param {String} contextKey context key name
 * @returns {Boolean} true if Revision Rule data is cached
 */
export let getRevRuleCacheStatusForContext = ( contextKey ) => {
    var context = appCtxService.getCtx( contextKey );
    switch ( contextKey ) {
        case pca0Constants.FSC_CONTEXT:
            if ( context.isSearchContext ) {
                return context.isSearchPanelRevRuleDataCached;
            }
            return context.isSettingsPanelRevRuleDataCached;
        default:
            return context.isRevRuleDataCached;
    }
};

/**
 * Get UTC Formatted date with TimeZone
 * @param {Date} dateToFormat - Formal date object to convert
 * @returns {String} return formated date required for TC DB
 */
export let getFormattedDateString = ( dateToFormat ) => {
    const isValidDate = _.isDate( dateToFormat ) && !isNaN( dateToFormat.getTime() );
    return isValidDate ? dateToFormat.getFullYear().toString() + '-' + ( dateToFormat.getMonth() + 1 ).toString().padStart( 2, '0' ) + '-' + dateToFormat.getDate().toString().padStart( 2,
        '0' ) + 'T00:00:00Z' :  '';
};

/**
 * Get date in DD-MMM-YYY format
 * @param {Date} dateToFormat - Formal date object to convert
 * @returns {String} return formated date string as DD-MMM-YYYY
 */
export let getFormattedDateFromUTC = ( dateToFormat ) => {
    let result = '';
    if ( dateToFormat && dateToFormat !== '' ) {
        const dateWithoutTimestamp = dateToFormat.replace( /-/g, '\/' ).replace( /T.+/, '' );
        const utcDate = new Date( dateWithoutTimestamp ).toDateString();
        if ( utcDate ) {
            const splitString = utcDate.split( ' ' );
            if ( splitString[1] && splitString[2] && splitString[3] ) {
                result = splitString[2] + '-' + splitString[1] + '-' + splitString[3];
            }
        }
    }

    return result;
};

/**
 * Verify input date is UTC
 * @param {String} dateString input Date string
 * @returns {Boolean} true if it's UTC date
 */
export let isUTCFormatString = dateString => {
    if ( dateString.match( /T00:00:00[+|-|Z]/ ) ) {
        return true;
    }
    return false;
};

/**
 * Helps to call setProperties SOA which update config perspective with provided revision rule
 * @param {String} contextKey To get context information from global CTX
 * @param {String} revRuleUid To set revision rule on perpesctive
 * @returns {Promise} promise
 */
export let updateRevisionRuleOnPerspective = async( contextKey, revRuleUid ) => {
    let context = appCtxService.getCtx( contextKey );

    let response = await exports.callSetPropertiesSOA( contextKey, context, revRuleUid, undefined, false );

    if ( response ) {
        // Update the persistent revision rule on Session Storage after setProperties SOA is called
        updatePersistentRevRuleMap( context, 'revisionRule', revRuleUid );

        let eventData = {
            appliedRevisionRule: _.get( context, 'appliedSettings.configSettings.props.pca0RevisionRule' ),
            contextKey: contextKey
        };
        // Fire events to reload variant expression data and update link
        eventBus.publish( 'Pca0FilterCriteriaSettings.filterCriteriaUpdated', eventData );
        eventBus.publish( 'Pca0FilterCriteriaSettings.refreshRevisionRuleContent', eventData );
        // Variability Explorer -
        // In Advance reuse dialog box if the picker view is open, going back to search panel.
        // In inline authoring mode if revision rule is changed we are resetting the context value.
        exports.resetAdvancedReuseAndInlineAuthoringMode( context );
    }
};

/**
 * Get event Data from eventMap
 * @param {Object} eventMap Event map associated with the view model
 * @param {String} eventKey Event subject key that got triggered
 * @returns {Object} EventData mapping to the input event key
 */
export let getEventDataFromEventMap = ( eventMap, eventKey ) => {
    let eventData = eventMap[eventKey];
    if ( eventData && eventData[eventKey] ) {
        eventData = eventData[eventKey];
    }
    return eventData;
};

/**
 * This function helps to prepare alternateID for VMO
 * @param {String} parentId uid of parent
 * @param {String} childId uid of child
 * @returns {String} alternateID as 'parentID:child' if parent is defined
 */
export let prepareUniqueId = ( parentId, childId ) => {
    if ( parentId !== childId ) {
        return parentId ? parentId + ':' + childId : childId;
    }
    return parentId;
};

/**
 * Post process SOA response and build revision rules map and list
 * @param {Object} soaResponse Response for getRevRulesForConfiguratorContext SOA
 * @returns {Object} Revision Rules map
 */
export let postProcessGetRevisionRulesFromPlatform = ( soaResponse ) => {
    // Handle partial errors
    if ( soaResponse.partialErrors || soaResponse.ServiceData && soaResponse.ServiceData.partialErrors ) {
        exports.processPartialErrors( soaResponse.ServiceData );
        return {};
    }

    // Clear
    var revisionRuleUIDs = [];
    let revisionRulesMap = {};

    if ( soaResponse && soaResponse.applicableRevisionRules ) {
        revisionRuleUIDs = _.map( soaResponse.applicableRevisionRules, 'uid' );
    }

    // Fetch Model Object for Revision Rules from ServiceData
    for ( var idx = 0; idx < revisionRuleUIDs.length; idx++ ) {
        var revRuleUID = revisionRuleUIDs[idx];
        var revRuleMO = soaResponse.ServiceData.modelObjects[revRuleUID];
        revisionRulesMap[revRuleUID] = revRuleMO;
    }
    return revisionRulesMap;
};

/**
 * Util to Programmatically select item in RevisionRule dropdown - given UID
 * @param {UwDataProvider} dataprovider - The data provider
 * @param {Object} revRuleUID - RevisionRule UID to be selected in dropdown
 * @returns {Boolean} true if item is found in dropdown
 */
export let selectRevisionRuleInDropdown = ( dataprovider, revRuleUID ) => {
    var indexOfCurrentRev = dataprovider.viewModelCollection.loadedVMObjects
        .map( ( x ) => {
            return x.uid;
        } ).indexOf( revRuleUID );
    if ( indexOfCurrentRev >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrentRev,
            indexOfCurrentRev, true );
        return true;
    }
    return false;
};

/**
 * Util to Programmatically select item in RevisionRule dropdown - given String
 * @param {UwDataProvider} dataprovider - The data provider
 * @param {Object} revRuleDbValue - RevisionRule db Value (english)
 * @returns {Boolean} true if item is found in dropdown
 */
export let selectRevisionRuleDbValueInDropdown = ( dataprovider, revRuleDbValue ) => {
    var indexOfCurrentRev = dataprovider.viewModelCollection.loadedVMObjects
        .map( ( x ) => {
            return x.props.object_name.dbValues[0];
        } ).indexOf( revRuleDbValue );
    if ( indexOfCurrentRev >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrentRev,
            indexOfCurrentRev, true );
        return true;
    }
    return false;
};

/**
 * Return Selection Objects for getVariantExpressionData4 SOA Input
 * Handle the scenario when consumer apps have set selections
 * @param {String} contextKey - Context Name to get specific data
 * @param {Object} subPanelContext - panel subcontext
 * @returns {Object} Selected Objects
 */
export let getSelectedObjectsForSOA = ( contextKey, subPanelContext ) => {
    let context = appCtxService.getCtx( contextKey );
    var allowConsumerAppsToLoadData = _.get( context, 'allowConsumerAppsToLoadData' );
    if ( allowConsumerAppsToLoadData ) {
        var selectedObjectsFromConsumerApps = _.get( context, 'selectedObjectsFromConsumerApps' );
        if ( selectedObjectsFromConsumerApps ) {
            return selectedObjectsFromConsumerApps;
        }
    }
    if ( subPanelContext && subPanelContext.selection ) {
        return subPanelContext.selection;
    }

    // if subPanelContext is undefined, return the selectedObject from ctx ( mselected )
    // In constraints, we do not send subPanelContext. Hence, use mselected
    return appCtxService.getCtx( 'mselected' );
};

/**
 * Return Perspective information for getVariantExpressionData4 SOA Input
 * @param { String } contextKey - To get data related to context string
 * @returns {Object} Perspective Object
 */
export let getConfigPerspective = ( contextKey ) => {
    let context = appCtxService.getCtx( contextKey );
    if ( context && context.configPerspective ) {
        return {
            uid: context.configPerspective.uid,
            type: 'Cfg0ConfiguratorPerspective'
        };
    }
    return {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
};

/**
 * Create family ExpansionMap
 * Group nodes are not displayed.
 * Display all families and expand only those having variant conditions defined.
 * @param {Array} variabilityNodes - Array variabilityNodes from soaResponse.variabilityTreeData
 * @param {Object} businessObjectToSelectionMap - the selection Map
 * @returns {Object} Families expansion Map
 */
export let getShowFamiliesExpansionMap = ( variabilityNodes, businessObjectToSelectionMap ) => {
    var expansionMap = [];
    var selectionsByFamily = [];

    _.forEach( businessObjectToSelectionMap, ( elemSelections ) => {
        _.forEach( elemSelections, ( selection ) => {
            var familyNode = _.find( selectionsByFamily, { id: selection.family } );
            var nodeUID = selection.nodeUid;
            if ( !nodeUID && _.get( selection, 'props.isFreeFormFamily.0' ) ) {
                nodeUID = selection.family + ':' + selection.valueText;
            }
            if ( !familyNode ) {
                familyNode = {
                    id: selection.family,
                    childNodes: [ { id: nodeUID } ]
                };
                selectionsByFamily.push( familyNode );
            } else {
                familyNode.childNodes.push( { id: nodeUID } );
            }
        } );
    } );

    // Get Root
    let variantTreeData = variabilityNodes;
    let rootElement = variantTreeData.filter( treeNode => treeNode.nodeUid === '' );
    assert( rootElement, 'RootElement is missing in the response' );
    let parentNode = rootElement[0];

    for ( var familyIdx = 0; familyIdx < parentNode.childrenUids.length; familyIdx++ ) {
        var familyUID = parentNode.childrenUids[familyIdx];
        var familyNode = {
            id: familyUID
        };

        // Look for current selections for the family.
        // in case selections are present, add all child Nodes to the tree (i.e., family node will be expanded)
        var selectionsFound = false;
        _.forEach( businessObjectToSelectionMap, ( elemSelections ) => {
            _.forEach( elemSelections, ( selection ) => {
                if ( selection.family === familyUID && _.find( selectionsByFamily, { id: selection.family } ) ) {
                    // Family has selections
                    selectionsFound = true;
                    return false; // this works as break in lodash.
                }
            } );

            if ( selectionsFound ) {
                return false; // this works as break in lodash.
            }
        } );

        if ( selectionsFound ) {
            familyNode.childNodes = [];
            var family_variabilityData = _.find( variabilityNodes, {
                nodeUid: familyUID
            } );
            _.forEach( family_variabilityData.childrenUids, id => {
                familyNode.childNodes.push( { id: id } );
            } );
        }
        expansionMap.push( familyNode );
    }
    return expansionMap;
};

/**
 * Helps to get variabilityNodes from soaResponce
 * @param {Object} soaResponse server response
 * @returns {Object} variabilityNodes
 */
export let getVariabilityNodes = ( soaResponse ) => {
    //  uses variabilityNodes. Hence, the tertiary conditional operator is used below
    if ( !soaResponse ) {
        return undefined; //make sure we are not stopping because of null pointer exception
    }
    return soaResponse.variabilityTreeData;
};

/**
 * Close Command Panel if not pinned
 * @param {Object} subPanelContext  command panel context
 */
export let closeToolsAndInfoPanel = ( subPanelContext ) => {
    if ( subPanelContext && !subPanelContext.panelPinned ) {
        var eventData = {
            source: 'toolAndInfoPanel'
        };
        eventBus.publish( 'complete', eventData );
    }
};

/**
 * Get list of 'Properties Information' nodes as per SOA response
 * @param {Array} variabilityTreeData Variability Nodes
 * @returns {Array} list of 'Properties Information' node UIDs
 */
export let getPropertiesInformationUIDs = ( variabilityTreeData ) => {
    let propUIDs = [];
    let propInfoNode = _.find( variabilityTreeData, { nodeUid: veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID } );
    if ( !_.isUndefined( propInfoNode ) && !_.isUndefined( propInfoNode.childrenUids ) ) {
        propUIDs = [ ...propInfoNode.childrenUids ];
    }
    return propUIDs;
};

/**
 * Post save action: update dirty flag on VMOs for which update is successful.
 * @param {UwDataProvider} treeDataProvider - tree data provider
 * @param {Object} businessObjectToSelectionMap - updated Selection Map
 * @param {Object} unsavedColumns - list of columns that were not saved due to partial errors
 */
export let updateDirtyVMOs = ( treeDataProvider, businessObjectToSelectionMap, unsavedColumns ) => {
    let vmos = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();

    // Filter columns that have been successfully saved.
    // - Filter is taking in input all selectionMap keys (including those that were not Save SOA input)
    // - Filter-out the unsaved columns
    // - Reset dirty flags if applicable
    let allSelectedObjects = Object.keys( businessObjectToSelectionMap );
    let savedObjects = allSelectedObjects.filter( x => !unsavedColumns.includes( x ) );

    for ( let vmoIndex = 0; vmoIndex < vmos.length; vmoIndex++ ) {
        for ( let objIndex = 0; objIndex < savedObjects.length; objIndex++ ) {
            if ( vmos[vmoIndex] && vmos[vmoIndex].props[savedObjects[objIndex]] && vmos[vmoIndex].props[savedObjects[objIndex]].dirty ) {
                vmos[vmoIndex].props[savedObjects[objIndex]].dirty = false;
                vmos[vmoIndex].props[savedObjects[objIndex]].valueUpdated = false;
                vmos[vmoIndex].props[savedObjects[objIndex]].displayValueUpdated = false;
                vmos[vmoIndex].props[savedObjects[objIndex]].originalValue = vmos[vmoIndex].props[savedObjects[objIndex]].dbValue;
            }
        }
    }
    treeDataProvider.update( vmos );
};

/**
 * Process Service Data from Save SOA response
 * Return list of unsaved columns for further processing.
 * @param {Object} serviceData - service Data
 * @returns {Array} list of objects that were not saved due to partial errors.
 */
export let getListOfUnsavedColumns = ( serviceData ) => {
    let unsavedObjects = [];

    if ( serviceData && serviceData.partialErrors ) {
        unsavedObjects = serviceData.partialErrors.map( error => error.uid );
    }

    return unsavedObjects;
};

/**
 * Create ViewModelProperty for ViewModelTreeNode property map
 * calling uwPropertyService.createViewModelProperty (propertyName, propertyDisplayName, dataType, dbValue, displayValuesIn )
 * @param {String} propertyName - the name/id of the property (Column - for VCA: designElement, for VCV: variant rule)
 * @param {String} parentUid - the name/id of the parent VMO
 * @param {String} propertyValue - Value for the property
 * @param {Object} props - additional properties from attached ViewModel object (from SOA response)
 * @return {ViewModelProperty} A new instance of this class.
 */
export let getViewModelProperty = ( propertyName, parentUid, propertyValue, props ) => {
    // Create VM Property and initialize additional properties needed
    let vmProp = uwPropertyService.createViewModelProperty( propertyName, propertyName,
        'STRING', propertyValue, [ propertyValue ] );

    // Initialize properties for the ViewModelProperty that were not created by uwPropertyService.createViewModelProperty
    vmProp.propertyDescriptor = {
        displayName: propertyName
    };
    vmProp.name = propertyName;
    vmProp.value = propertyValue; // re-definition (uwPropertyService.createViewModelProperty creates array)
    vmProp.originalValue = propertyValue;
    vmProp.parentUid = parentUid;
    vmProp.props = props;
    return vmProp;
};

/**
 * Post processing of validateProductConfigurations3 SOA - for successful SOA response
 * @param {Object} validationSoaResponse - Validation SOA response
 * @param {Object} vmVariabilityProps - VM atomic data
 * @param {Object} validationProps - Validation Properties container
 * @param {String} currentView - tells us in which view we are. This is needed to give appropriate message popup
 * @param {Object} validationFlags - flag for validation state
 * @returns {Object} updated Validation Properties container
 */
export let postProcessValidateProductConfigurations = ( validationSoaResponse, vmVariabilityProps, validationProps, currentView, validationFlags ) => {
    let variabilityPropFromAtomicData = vmVariabilityProps.getValue ? vmVariabilityProps.getValue() : vmVariabilityProps.getAtomicData();

    var variabilityProps = { ...variabilityPropFromAtomicData };

    var localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );

    // Initialize Validation Map if needed
    if ( _.isUndefined( validationProps.columnToValidationMap ) ) {
        validationProps.columnToValidationMap = {};
    }

    // Initial vs Column Validation
    if ( !_.isUndefined( validationProps.columnValidation ) ) {
        _postProcessColumnValidation( validationProps.columnValidation, validationSoaResponse, validationProps, variabilityProps, localeTextBundle, currentView );
    } else {
        _postProcessInitialValidation( validationSoaResponse, validationProps, variabilityProps, localeTextBundle, currentView, validationFlags );
    }
    return validationProps;
};

/**
 * Set isLeaf property on view model tree node
 * In case of Variability explorer the column properties are listed in UiConfigCots file and are fetched by "getTableViewModelProperties" SOA
 * This SOA is invoked from framework code ( treeTableDataService.js ) and it assumes node not to have any properties.
 * @param {Object} node - Node from soaResponse/gridData variability Nodes
 * @param {ViewModelTreeNode} vmTreeNode - View Model Tree node created for node
 */
export let setIsLeafProperty = ( node, vmTreeNode ) => {
    // In Variability explorer a node is a Leaf if "isLeaf" property is populated in SOA response
    if ( node.props && node.props.isLeaf && node.props.isLeaf.length > 0 ) {
        vmTreeNode.isLeaf = node.props.isLeaf[0] === 'true';
    }
};

/**
 * Validate if nodeUID is part of 'Properties Information' subset of Constraints Grid Editor
 * @param {String} nodeUid node UID
 * @param {propInfoUIDs} propInfoUIDs additional list of 'Properties Information' nodeUIDs
 * @returns {Boolean} true if node UID is part of 'Properties Information' subset of Constraints Grid Editor
 */
export let isConstraintsEditorPropInfoNodeUid = ( nodeUid, propInfoUIDs ) => {
    let propInfoNodesSubset = [ veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID, 'MultipleVariantsConfig' ];
    if ( !_.isUndefined( propInfoUIDs ) && propInfoUIDs instanceof Array && propInfoUIDs.length !== 0 ) {
        propInfoNodesSubset = [ ...propInfoNodesSubset, ...propInfoUIDs ];
    }
    return propInfoNodesSubset.includes( nodeUid );
};

/**
 * Validate if ViewModelTreeNode is part of 'Properties Information' subset of Constraints Grid Editor
 * @param {ViewModelTreeNode} vmTreeNode input ViewModel Tree Node
 * @returns {Boolean} true if node is part of 'Properties Information' subset of Constraints Grid Editor
 */
export let isConstraintsEditorPropInfoNode = ( vmTreeNode ) => {
    return vmTreeNode.nodeUid === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID ||
        vmTreeNode.parentUID === veConstants.GRID_CONSTANTS.CONSTRAINTS_PROP_INFO_NODE_UID;
};

/**
 * Validate if family is enumerated
 * @param {Object} parentObject - parent object
 * @returns {Boolean} true/false if family is enumerated
 */
export let isEnumeratedFamily = parentObject => {
    if ( parentObject.props && parentObject.props.cfg0ValueDataType ) {
        let valueType = parentObject.props.cfg0ValueDataType[0];
        return [ 'Integer', 'Floating Point', 'Date' ].includes( valueType );
    }
};

/**
 * Validate if object is FreeForm
 * @param {Object} vmo View Model object
 * @returns {Boolean} true if VMO is Free Form
 */
export let isObjectFreeForm = ( vmo ) => {
    return vmo.props && vmo.props.isFreeForm && vmo.props.isFreeForm[0] === 'true';
};

/**
 * Get properties FreeForm/Enumerated for parent object and set properties on node VMO
 * @param {String} parentNodeUid parentNode UID
 * @param {Object} parentObject parent VMO
 * @param {Object} viewModelObject node VMO
 * @returns {Object} container of booleans for parent FreeForm/Enumerated properties
 */
export let validateFreeFormAndEnumeratedParentVMO = ( parentNodeUid, parentObject, viewModelObject ) => {
    let isParentFreeForm = false;
    let isParentEnumerated = false;
    if ( !_.isEmpty( parentNodeUid ) && !exports.isConstraintsEditorPropInfoNodeUid( parentNodeUid ) ) {
        assert( parentObject, 'Parent Node is missing in the response' );

        isParentFreeForm = exports.isObjectFreeForm( parentObject );
        isParentEnumerated = exports.isEnumeratedFamily( parentObject ) && !isParentFreeForm;
        if ( isParentFreeForm && parentObject.props.cfg0ValueDataType && parentObject.props.cfg0ValueDataType[0] === 'Date' && viewModelObject ) {
            _formatFreeFormDateDisplayName( viewModelObject );
        } else if ( isParentEnumerated && viewModelObject ) {
            /**
             * This block is called for enumerated feature to get UI name set in cfg0DisplayNames for respective cfg0Ids
             */
            const ids = parentObject.props.cfg0ChildrenIDs;
            const displayNames = parentObject.props.cfg0ChildrenDisplayNames;
            let serverDisplayName = viewModelObject.displayName;
            viewModelObject.displayName = pca0EnumeratedFeatureService.getDisplayNamesForEnumeratedFeature( serverDisplayName, ids, displayNames );
        }
    }
    return { isParentFreeForm, isParentEnumerated };
};

/**
 * Get the instance of the Locale Resource
 * @param {String} resourceName Name of resource (json file).
 * @return {Object} The instance of locale resource if found, null otherwise.
 */
export let getLocaleTextBundle = resourceName => {
    return localeService.getLoadedText( resourceName ) || null;
};

/**
 * Get the instance of the Locale Resource
 * @param {String} key Name of key.
 * @param {String} resourceName Name of resource (json file).
 * @return {Object} The localized value if found, key otherwise.
 */
export const getLocalizedValue = ( key, resourceName ) => {
    const localeTextBundle = exports.getLocaleTextBundle( resourceName );
    return _.get( localeTextBundle, key, null );
};

/**
 * Get URL for type Icon
 * @param {String} contextKey - the Context Key
 * @param {Object} viewModelObject - View Model Object
 * @param {Object} node - Node from soaResponse variability Nodes
 * @param {Number} levelNdx vmo levelNdx in the tree
 * @param {Boolean} isParentFreeFormOrEnumerated - true if parent is either Free Form or Enumerated
 * @param {Boolean} isPropInfoNode - true if node is a 'Properties Information' node
 * @return {String} icon URL
 */
export let getIconURL = function( contextKey, viewModelObject, node, levelNdx, isParentFreeFormOrEnumerated, isPropInfoNode ) {
    let iconURL = iconSvc.getTypeIconURL( viewModelObject.sourceType );
    if ( _.isUndefined( iconURL ) || _.isNull( iconURL ) ) {
        var isUnconfigured = node.props && node.props.isUnconfigured && node.props.isUnconfigured[0];
        if ( isUnconfigured ) {
            // Keep default icon for unconfigured/unknown objects not included in below statements.
            iconURL = '';
            let objectType = exports.getUnconfiguredTypeForGrid( levelNdx, contextKey );
            if ( !_.isUndefined( objectType ) ) {
                const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
                let imageBasePath = getBaseUrlPath() + '/image/';
                if ( objectType === localeTextBundle.familyLowerCase ) {
                    iconURL = imageBasePath + pca0CommonConstants.UNCONFIGURED_OBJECT_ICONS.UNCONFIGURED_TYPE_FAMILY;
                } else if ( objectType === localeTextBundle.featureLowerCase ) {
                    iconURL = imageBasePath + pca0CommonConstants.UNCONFIGURED_OBJECT_ICONS.UNCONFIGURED_TYPE_FEATURE;
                }
            }
        } else if ( isParentFreeFormOrEnumerated ) {
            // Force "feature" icon for Free Form and Enumerated features
            iconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
        } else if ( isPropInfoNode ) {
            // Force no image for 'Properties Information' nodes
            iconURL = '';
        } else {
            // Display image if source type is not defined and if not free family.
            iconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_MISSING );
        }
    }
    return iconURL;
};

/**
 * Generate Random Number
 * @returns {String} generated Random number, in String format
 */
export let getUniqueID = () => {
    return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
        Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
};

/**
 * Get Original Business Object Key given Split Column ID/Key
 * @param {String} splitColumnKey Split Column ID/Key
 * @returns {String} bo ID/Key
 */
export let getOriginalColumnKeyFromSplitColumnKey = splitColumnKey => {
    let indx = splitColumnKey.indexOf( pca0Constants.SPLIT_COLUMN_DELIMITER );
    if ( indx > -1 ) {
        return splitColumnKey.slice( 0, indx );
    }
    return splitColumnKey;
};

/**
 * Get all split columns for the Original column based on column name starting with same UID, adds or not the original column depending on the flag
 * @param {Object} columns - columns
 * @param {String} currentColumnUid - the current column UID
 * @param {Boolean} addOriginalColumn - true to add original column to the list
 * @returns {Array} splitColumns - array of split column names with or without original column
 */
export let getAllSplitColumnsForOriginalColumn = ( columns, currentColumnUid, addOriginalColumn ) => {
    let splitColumns = [];
    if( columns ) {
        splitColumns = columns
            .filter( column => {
                const startsWithUID = column.propertyName.startsWith( currentColumnUid );
                const hasSplitDelimiter = column.propertyName.includes( pca0Constants.SPLIT_COLUMN_DELIMITER );
                const isOriginalColumn = column.propertyName === currentColumnUid;
                // Include original column first if flag is set
                if ( addOriginalColumn && isOriginalColumn ) {
                    return true;
                }
                // Include split columns (start with UID and have delimiter)
                return startsWithUID && hasSplitDelimiter;
            } )
            .map( column => column.propertyName );
    }
    return splitColumns;
};

/**
 * Helps to check criteria with sourceString
 * @param {String} sourceStr - Src string to check with filter
 * @param {String} filter - string to check
 * @param {String} criteria - criteria selected to filter data
 * @param {String} dataType - Data Type of the data
 * @returns {Boolean} - true if matched with criteria else false
 */
export let isFilterCriteriaSatisfied = function( sourceStr, filter, criteria, dataType ) {
    let dataStr = sourceStr.toLowerCase();
    let filterStr = Array.isArray( filter ) ? filter[0].toLowerCase() : filter.toLowerCase();
    switch ( criteria ) {
        case 'contains':
            return dataStr.includes( filterStr );
        case 'notContains':
            return !dataStr.includes( filterStr );
        case 'startsWith':
            return dataStr.startsWith( filterStr );
        case 'endsWith':
            return dataStr.endsWith( filterStr );
        case 'equals':
            return dataStr === filterStr;
        case 'notEquals':
            return dataStr !== filterStr;
        case 'lt':
            return Number( dataStr ) <= Number( filterStr );
        case 'gt':
            return Number( dataStr ) >= Number( filterStr );
        case 'range': {
            if ( !Array.isArray( filter ) || filter.length !== 2 ) {
                return false;
            }
            const [ fromStr, toStr ] = filter;
            let fromValue;
            let toValue;
            let filterValue;

            if ( dataType === 'Date' ) {
                fromValue = new Date( fromStr );
                toValue = new Date( toStr );
                filterValue = new Date( sourceStr );
            } else if ( dataType === 'Integer' ) {
                fromValue = Number( fromStr );
                toValue = Number( toStr );
                filterValue = Number( sourceStr );
            } else {
                return false;
            }
            return filterValue >= fromValue && filterValue <= toValue;
        }
        default:
            return 0;
    }
};

/**
 * For Auto Edit mode only
 * Handle Edit Mode activation synchronization between VariantTable in Configurator and PWA
 * Validate if table can be edited
 * 1) If Table is already in Edit Mode: edits can be performed
 * 2) If Context has no AutoEdit option set: edits cannot be performed
 * 3) If Table in PWA is not editing:
 * - edits can be perfomed AND
 * - Edit Mode is activated:
 * --- for all editors except Matrix mode OR
 * --- for Matrix Grid Editor (Direct Edit), when Autosave is OFF
 * 4) If Table in PWA is editing AND we are in Matrix Grid Editor:
 * --- call LeaveConfirmation to stop edit in PWA (edits cannot be performed until leaveConfirmation resolves)
 * 5) For all other scenarios, edits cannot be performed
 * @param {String} contextKey editing context
 * @param {Boolean} isSnOMatrixGridEditor true if Variant Table is authoring Matrix Rules
 * @param {String} gridId Id of the grid
 * @return {Boolean} Status for allowed (true) vs. disabled (false) edits in Variant Table
 */
export let handleEditModeSync = ( contextKey, isSnOMatrixGridEditor, gridId ) => {
    let isVariantTableEditing = appCtxService.getCtx( pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE );

    // Table is already in Edit Mode: edits can be performed
    if ( isVariantTableEditing ) {
        return true;
    }

    let context = appCtxService.getCtx( contextKey );

    // Context has no AutoEdit option set: edits cannot be performed
    if ( !context.autoEditMode ) {
        return false;
    }

    // NOTE about Matrix Mode DIRECT EDIT:
    // We are in the 'DirectEdit' scenario: edit mode is not started manually (i.e. pressing 'Edit' command)
    // I.E. user has clicked on cell in top grid OR double-clicked on cells in bottom grid
    let isAutoSaveOn = appCtxService.getCtx( 'autoSave.dbValue' );

    // If Table in PWA is not editing:
    // - edits can be performed
    // - Edit Mode is activated:
    // --- for all editors except Matrix mode OR
    // --- for Matrix Grid Editor (Direct Edit), when Autosave is OFF:
    // --- (if we are editing through DirectEdit when Autosave is enabled,we do not need to declare Variant Table in Edit mode)
    let tableContext = appCtxService.getCtx( pca0Constants.TABLE_CONTEXT );
    if ( !tableContext || tableContext._editing === false ) {
        if ( !isSnOMatrixGridEditor || !isAutoSaveOn ) {
            exports.handleEditModeStart( contextKey );
        }
        return true;
    }

    // If table in PWA is Editing and we are attempting to edit in Grid Editor
    // we need to call leaveConfirmation on active handler
    // before proceeding with any edits (edits cannot be performed until leaveConfirmation resolves)
    if ( gridId === veConstants.GRID_CONSTANTS.PCA_GRID || gridId === veConstants.GRID_CONSTANTS.BOTTOM_CONSTRAINTS_GRID ) {
        editHandlerService.leaveConfirmation();
    }
    return false;
};

/**
 * Get unconfigured VMO Type for Grid
 * Based on input contextKey, process if input VMO is of family or feature type.
 * -- VCA scenario: family at levelNdx:0, feature at levelNdx:1
 * -- Constraints Grid Editor scenario: family at levelNdx:1, feature at levelNdx:2
 * No other Contexts or object-levelNdx lebels are evaluated: undefined is returned
 * @param {Number} levelNdx vmo levelNdx in the tree
 * @param {String} contextKey context Key
 * @returns {String} tooltip for the unconfigured input VMO
 */
export let getUnconfiguredTypeForGrid = ( levelNdx, contextKey ) => {
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
    let objectType;
    switch ( contextKey ) {
        case veConstants.CONFIG_CONTEXT_KEY:
            if ( levelNdx === 1 ) {
                objectType = localeTextBundle.familyLowerCase;
            } else if ( levelNdx === 2 ) {
                objectType = localeTextBundle.featureLowerCase;
            } else { return undefined; }
            break;
        case pca0Constants.VCA_CONTEXT:
            if ( levelNdx === 0 ) {
                objectType = localeTextBundle.familyLowerCase;
            } else if ( levelNdx === 1 ) {
                objectType = localeTextBundle.featureLowerCase;
            } else { return undefined; }
            break;
        default:
            return undefined;
    }
    return objectType;
};

/**
 * Get Tooltip for unconfigured VMO indicator for Grid
 * Based on input contextKey, process if input VMO is of family or feature type.
 * Note: we have no hierarchy information (no variabilityData available)
 * -- VCA scenario: family at levelNdx:0, feature at levelNdx:1
 * -- Constraints Grid Editor scenario: family at levelNdx:1, feature at levelNdx:2
 * No other Contexts or object-levelNdx lebels are evaluated: an empty string is returned.
 * @param {Number} levelNdx vmo levelNdx in the tree
 * @param {String} contextKey context Key
 * @returns {String} tooltip for the unconfigured input VMO
 */
export let getUnconfiguredIndicatorTooltipForGrid = ( levelNdx, contextKey ) => {
    let objectType = exports.getUnconfiguredTypeForGrid( levelNdx, contextKey );
    if ( _.isUndefined( objectType ) ) {
        return '';
    }
    const localeTextBundle = localeService.getLoadedText( 'ConfiguratorCommonMessages' );
    switch ( objectType ) {
        case localeTextBundle.familyLowerCase:
            return localeTextBundle.unconfiguredFamilyTooltip;
        case localeTextBundle.featureLowerCase:
            return localeTextBundle.unconfiguredFeatureTooltip;
        default:
            return '';
    }
};

/**
 * Verify if a column contains edits (any non-zero selection) in given selectionMap
 * @param {String} columnUID UID of the column
 * @param {Object} selectionMap selection map to analyze
 * @returns {Boolean} true if column has edits in input map
 */
export let isColumnWithEdits = ( columnUID, selectionMap ) => {
    if ( !columnUID || !selectionMap || _.isEmpty( selectionMap[columnUID] ) ) {
        return false; // no edits were found
    }
    let editsFound = _.filter( Object.values( selectionMap[columnUID] ), selectionObject => {
        return selectionObject.selectionState !== 0;
    } );
    return editsFound.length > 0;
};

/**
 * Validate if input Hierarchy/sourceType array belongs to Family type
 * @param {Array} sourceTypeHierarchy String Array containing object hierarchy
 * @returns {Boolean} true if hierarchy matches family type
 */
export let isFamilyType = sourceTypeHierarchy => {
    return !sourceTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE ) &&
        pca0Constants.CFG_FAMILY_TYPES.some( ( val ) => sourceTypeHierarchy.includes( val ) );
};

/**
 * This method updates the completeness status and the violations on the config modules
 * @param {Object} eventData containing completenessStatus - The completeness status needed to be set
 * @param {Object} treeDataProvider - The treeDataProvider to update
 * */
export let updateCompletenessStatusAndViolations = ( eventData, treeDataProvider ) => {
    // We don't want to show the completeness status icons in module hierarchy grid when switching to guided mode/manual mode
    let context = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
    if ( !_.isUndefined( context.switchingToGuidedMode ) ) {
        return;
    }

    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    let validationStateList;
    // Added a check to resolve the console error that occurs when depth is absent and then applied.
    if ( treeDataProvider.topTreeNode !== null ) {
        validationStateList = _.get( treeDataProvider, 'topTreeNode.children', [] );
    }
    if ( _.get( eventData, 'CompletenessStatus.criteriaStatus.0' ) === 'InValid' && validationStateList ) {
        validationStateList.forEach( vmo => {
            vmo.validationStateIcon = '';
            vmo.configuredOut = false;
        } );
        //mark every node from affected nodes as invalid as well
        if ( eventData.CompletenessStatus.affectedNodes ) {
            eventData.CompletenessStatus.affectedNodes.forEach( invalidChildModule => {
                if ( invalidChildModule !== '' ) {
                    let moduleUid = invalidChildModule.split( ':' ).reverse().join( ':' );
                    let vmo = _.find( validationStateList, { alternateID: moduleUid } );
                    if ( vmo ) {
                        vmo.validationStateIcon = 'indicatorError'; //ModuleInvalid
                    }
                } else {
                    let vmo = validationStateList[0];
                    if ( vmo ) {
                        vmo.validationStateIcon = 'indicatorError'; //ModuleInvalid
                    }
                }
            } );
        }
    } else if ( !_.isUndefined( eventData.CompletenessStatus.criteriaStatus ) && eventData.CompletenessStatus.criteriaStatus[0] === 'ValidAndComplete' && validationStateList ) {
        validationStateList.forEach( vmo => {
            let reversedAlternateID = vmo.alternateID;
            if ( vmo.alternateID.includes( ':' ) ) {
                let alternateIDParts = vmo.alternateID.split( ':' );
                reversedAlternateID = alternateIDParts.reverse().join( ':' );
            }
            // check if the VMO is a module and if it is present in the list of configuredOutModules then mark it as configured out
            if ( eventData.CompletenessStatus.configuredOutModules && eventData.CompletenessStatus.configuredOutModules.includes( reversedAlternateID ) ) {
                vmo.validationStateIcon = 'indicatorConfiguredOut'; //ModuleConfiguredOut
                vmo.configuredOut = true;
            } else {
                vmo.validationStateIcon = 'indicatorStatusComplete'; //ModuleComplete
                vmo.configuredOut = false;
            }
        } );
    } else {
        //this should always be set, if not for depth >3 which is the only case we get here, it may be a server issue
        let incompleteModulesInfoString = eventData.CompletenessStatus.configurationForProductHierarchy ? eventData.CompletenessStatus.configurationForProductHierarchy[0] : '';

        if ( validationStateList && !eventData.shouldResetModules ) {
            validationStateList.forEach( vmo => {
                if ( vmo.configuredOut || vmo.validationStateIcon === 'indicatorError' ) {
                    // clear status if the module was configured out before, As existing configured out module
                    // may no longer be configured out due to a change in user selection.
                    // This reset ensures that configuredOut modules are updated with the new status.
                    vmo.validationStateIcon = '';
                    vmo.configuredOut = false;
                }
            } );
        }

        let incompleteModulesInfo = incompleteModulesInfoString ? JSON.parse( incompleteModulesInfoString ) : null;

        if( incompleteModulesInfo ) {
            const configModulesKeys = Object.keys( incompleteModulesInfo.configurationForProductHierarchy );
            if ( validationStateList && configModulesKeys ) {
                configModulesKeys.map( id => {
                    let altUid = id.split( ':' ).reverse().join( ':' );
                    let vmo = _.find( validationStateList, { alternateID: altUid } );
                    if ( vmo ) {
                        const moduleInfo = incompleteModulesInfo.configurationForProductHierarchy[id];
                        vmo.configuredOut = false;
                        if ( !moduleInfo.isComplete ) {
                        //there is a difference in module being incomplete itself and module being complete but one of the children
                        //is incomplete and only due to that the module has to be marked incomplete
                        //in the server response the difference is if the incompleteModulesInfo.configurationForProductHierarchy[ id ]
                        //has no incompleteFamilies node (but has an incompleteChildModules one)
                            vmo.validationStateIcon = moduleInfo.incompleteFamilies ? 'indicatorNeedsAttention' : 'indicatorPartiallyComplete'; // ModuleIncomplete or ChildModuleIncomplete
                        } else {
                            vmo.validationStateIcon = 'indicatorStatusComplete'; //ModuleComplete
                        }
                    }
                } );
            }
        }

        // iterate through the list of configuredOutModules and mark them as configured out
        if ( _.get( eventData, 'CompletenessStatus.configuredOutModules' ) && validationStateList ) {
            eventData.CompletenessStatus.configuredOutModules.forEach( configuredOutModule => {
                let altUid = configuredOutModule.split( ':' ).reverse().join( ':' );
                let vmo = _.find( validationStateList, { alternateID: altUid } );
                if ( vmo ) {
                    vmo.validationStateIcon = 'indicatorConfiguredOut'; //ModuleConfiguredOut
                    vmo.configuredOut = true;
                }
            } );
        }
    }

    //set the updated vmos on the dp for the currently visible rows
    treeDataProvider.update( viewModelObjects );
};

/**
 * This method clears the completeness status regardless of collapsed status and updates the data provider
 * @param {String} treeDataProvider - The treeDataProvider
 * */
export let clearCompletenessStatusesOnModules = ( treeDataProvider ) => {
    let viewModelCollection = treeDataProvider.getViewModelCollection();
    let viewModelObjects = viewModelCollection.getLoadedViewModelObjects();
    let validationStateList = treeDataProvider.topTreeNode.children;
    let didClear = false;
    //use the complete tree vmos if passed in in order to clear collapsed nodes as well
    if ( validationStateList ) {
        validationStateList.forEach( vmo => {
            if ( vmo.validationStateIcon !== '' ) {
                vmo.validationStateIcon = '';
                didClear = true;
            }
        } );
    }
    //do not update dp unnecessarily (if this is hit in the process of reloading the tree, it can cause issues in framework's code)
    if ( didClear ) {
        treeDataProvider.update( viewModelObjects );
    }
};

/**
 * Init actions for Pca0Legend component
 * @param {Object} subPanelContext sub context passed to Pca0Legend component
 */
export let initLegend = subPanelContext => {
    // For Matrix scenario: set 'legendContent' attribute for legend parent component
    if ( subPanelContext.legendType === 'MatrixLOVLegend' ) {
        let matrixLovLegend = document.getElementById( 'matrixLovLegend' );
        if ( !_.isNull( matrixLovLegend ) ) {
            matrixLovLegend.setAttribute( 'legendContent', subPanelContext.legendContent );
        }
    }
};

/**
 * Get localized strings from server
 */
export let getLocalizedOperatorStrings = async() => {
    const pca0OperatorDisplayStrings = sessionStorage.getItem( pca0Constants.OPERATOR_DISPLAY_STRINGS );
    if ( !pca0OperatorDisplayStrings ) {
        const soaInput = {
            info: [
                'k_variant_op_and',
                'k_variant_op_or',
                'k_variant_op_not',
                'k_variant_op_is_equal',
                'k_variant_op_not_equal',
                'k_variant_op_gt',
                'k_variant_op_lt',
                'k_variant_op_gt_eq',
                'k_variant_op_lt_eq',
                'k_variant_optional_family_any_value',
                'k_variant_optional_family_none_value',
                'k_true',
                'k_false'
            ]
        };
        const response = await soaSvc.postUnchecked( 'Core-2008-06-Session', 'getDisplayStrings', soaInput );
        const displayStringsObj = response.output;
        let pca0OperatorDisplayStrings = {};
        if ( displayStringsObj ) {
            displayStringsObj.forEach( ( element ) => {
                pca0OperatorDisplayStrings[element.key] = element.value;
            } );
        }
        sessionStorage.setItem( pca0Constants.OPERATOR_DISPLAY_STRINGS, JSON.stringify( pca0OperatorDisplayStrings ) );
    }
};

/**
 * Function to get a list of non-gridable expressions from the selected expressions.
 * Non gridable expressions are those which cannot be represented in the grid.
 * For example: Consider the formula on VariantRule : DF1 = F1 & DF1 = F2
 * where DF1 is a single-select family. Consider that the above formula is authored on VariantRule using some platform API
 * ( because today there is no way in AW UI to author formula on VariantRule. Grid is the only way ). The relationship between
 * the features within the single-select family is "OR". There is no way in grid to represent DF1 = F1 & DF1 = F2.
 * Such expressions which cannot be represented in the grid are called non-gridable expression. For such expressions, platform
 * server sends empty grid but with the formula populated.
 * @param {Object} selectedExpressions - The selected expressions to check.
 * @returns {Object} An object containing a flag indicating if a non-gridable expression was found and a list of non-gridable expressions.
 */
export let getNonGridableExpressionList = ( selectedExpressions ) => {
    // Initialize a list to hold the non-gridable expressions.
    const nonGridableExpressionsList = [];

    // Iterate over each selected expression.
    for ( const objectUid in selectedExpressions ) {
        if ( selectedExpressions[objectUid] ) {
            // Get the current expression.
            const [ currentExpression ] = selectedExpressions[objectUid];

            // Check if the formula of the current expression is not empty and either the configExpressionSet of the current expression is empty
            // or the first configExpressionSection of the configExpressionSet of the current expression is empty.
            const formula = _.get( currentExpression, 'formula' );
            const configExpressionSet = _.get( currentExpression, 'configExpressionSet', [] );
            const configExpressionSections = _.get( configExpressionSet, '[0].configExpressionSections', [] );

            if ( formula && ( _.isEmpty( configExpressionSet ) || _.isEmpty( configExpressionSections ) ) ) {
                // If the current expression is non-gridable, add it to the list of non-gridable expressions.
                nonGridableExpressionsList.push( objectUid );
            }
        }
    }

    // Return the flag and the list of non-gridable expressions.
    return nonGridableExpressionsList;
};

/**
 * Function to show notification messages for non-gridable expressions if applicable.
 * @param {Array} nonGridableExpressionsList - List of non-gridable expressions.
 * @param {Object} viewModelObjectMap - Map of view model objects.
 */
let showNotificationMessageForNonGridableExpressionsIfApplicable = ( nonGridableExpressionsList, viewModelObjectMap ) => {
    // Initialize an array to hold the display names of non-gridable expressions.
    let nonGridableExpressionsDisplayName = [];

    // Iterate over each non-gridable expression.
    for ( let nonGridableExpression of nonGridableExpressionsList ) {
        // Get the display name of the current non-gridable expression from the view model object map.
        let displayName = viewModelObjectMap && _.get( viewModelObjectMap[nonGridableExpression], 'displayName' );

        // If the display name exists, push it to the array.
        if ( displayName ) {
            nonGridableExpressionsDisplayName.push( displayName );
        }
    }

    // If the array of display names is not empty, show an info message with the display names.
    if ( !_.isEmpty( nonGridableExpressionsDisplayName ) ) {
        let message = localeTextBundle.nonGridableExpression.replace( '{0}', nonGridableExpressionsDisplayName.join( ', ' ) );
        messagingService.showInfo( message );
    }
    // If the array of display names is empty, show a generic info message.
    else {
        messagingService.showInfo( localeTextBundle.nonGridableExpressionGeneric );
    }
};

/**
 * This function toggles the boolean property received
 * @param {Boolean} booleanProp - boolean received in parameter
 * @return {Boolean} toggled boolean property
 */
export let toggleBooleanProperty = ( booleanProp ) => {
    return !booleanProp;
};

/**
 * This function returns the input value as is.
 * @param {any} value - The value to be returned.
 * @returns {any} The input value.
 */
export let echoInput = value => {
    return value;
};

/**
 * This function scrolls to the specified row in the specified grid.
 * @param {String} gridId - The ID of the grid to scroll.
 * @param {Array} rowUids - The row UIDs to scroll to.
 */
export const scrollToRow = ( gridId, rowUids ) => {
    const scrollEventData = {
        gridId: gridId,
        rowUids: rowUids
    };
    eventBus.publish( 'plTable.scrollToRow', scrollEventData );
};

/**
 * Variability Explorer scenario -
 * In Advance reuse dialog box if the picker view is open, going back to search panel.
 * In inline authoring mode if revision rule is changed we are resetting the context value.
 * @param {Object} context sub context passed to Pca0Legend component
 */
export let resetAdvancedReuseAndInlineAuthoringMode = context => {
    if ( context.advancedReusePickerMode ) {
        eventBus.publish( 'Pca0AdvancedReuse.resetContext' );
    }
    if ( _.get( context, 'inlineAuthoringContext.isInlineAuthoringMode' ) ) {
        eventBus.publish( 'pca0InlineAuthoringHandler.resetInlineDataCache' );
    }
};

/**
 * Updates preference PCA_vcv_layout_settings or values provided by settings panel
 * @param {Object} settingsData - when user comes from settings panel.
 * @returns {Object} layout settings required for text mode.
 */
export const vcvViewSettings = ( settingsData ) => {
    let viewSettings = {
        featureWidth: 'small',
        showFeatureSideBySide: false,
        showCompressedData: false,
        showGroupsAsTab: false
    };
    if ( !settingsData ) {
        const preferences = appCtxService.getCtx( 'preferences' );
        let vcvSettings = _.get( preferences, 'PCA_vcv_layout_settings' );
        for ( const key in vcvSettings ) {
            const prefStrings = vcvSettings[key].split( ':' );
            if ( prefStrings.length === 2 ) {
                if ( prefStrings[1] === 'undefined' || prefStrings[1] === 'false' ) {
                    viewSettings[prefStrings[0]] = false;
                } else {
                    viewSettings[prefStrings[0]] = prefStrings[1] === 'true' ? true : prefStrings[1];
                }
            }
        }
    } else {
        viewSettings = settingsData;
    }
    appCtxService.updatePartialCtx( pca0Constants.FSC_CONTEXT + '.vcvLayoutSettings', viewSettings );
    return viewSettings;
};

/**
 * Get NodeUid as a single point of determination: It returns the original nodeUID for most features but for special features as
 * free form or enumerated range or unconfigured that have it empty it returns the selection.family + ':' + selection.valueText
 * @param {Object} selection as it's parsed form the selected expressions
 * @returns {String} calculated nodeUid to be used internally in the client - TODO use this as a single point of determining the uid rn is spread all over
 */
export let getNodeUidFromSelection = ( selection ) => {
    let newNodeUid = selection.nodeUid;
    let isUnconfigured = _.get( selection, 'props.isUnconfigured' );
    if ( _.isEmpty( newNodeUid ) && ( _.get( selection, 'props.isFreeFormFamily' )
        || isUnconfigured
        || _.get( selection, 'props.isEnumeratedRangeExpressionSelection' ) ) ) {
        //differentiate between unconfigured families and the features, as the family nodeUid is in the form: Namepsace:ExteriorColor for example
        if ( isUnconfigured && _.isEmpty( selection.family ) && !_.isEmpty( selection.familyNamespace ) && !_.isEmpty( selection.familyId ) ) {
            newNodeUid = selection.familyNamespace + ':' + selection.familyId; //family selection for unconfigured
        } else {
            newNodeUid = selection.family + ':' + selection.valueText; // this is the main use case for unconfiuread and all other special ones wihtout a nodeUid
        }
    }
    return newNodeUid;
};

/**
 * This function should return an array of selected objects
 * @param {objects} objects in tree
 * @returns {Array} array of selectedObjects
 */
export const convertToArray = ( objects ) => {
    return _.isArray( objects ) ? objects : [ objects ];
};

/**
 * This function extracts UIDs from an array of objects or an array of strings.
 * If the input is an array of objects, it extracts the 'uid' property from each object.
 * If the input is an array of strings, it assumes the strings are UIDs and returns them as is.
 *
 * @param {Array} objects - An array of objects or an array of UIDs.
 * @returns {Array} An array of UIDs.
 */
export const getUidsFromObjects = ( objects ) => {
    const objectsArray = exports.convertToArray( objects );

    if ( objectsArray.length === 0 ) {
        return [];
    }

    if ( typeof objectsArray[0] === 'object' ) {
        return objectsArray.map( object => object.uid );
    }
    // If the input is an array of strings, we are asuming those as UIDs.
    return objectsArray;
};

/**
 * Updates the provided selection list with the properties from the given dbValue.
 *
 * @param {Object} selectionList - The selection list to update.
 * @param {Object} dbValue - The dbValue to update the selection list with.
 *
 * @returns {Object} The updated selection list.
 */
export let updateSelectionList = ( selectionList, dbValue ) => {
    selectionList.displayName = dbValue.propDisplayValue;
    selectionList.dbValue = dbValue.propInternalValue;
    selectionList.dbValues = [ dbValue.propInternalValue ];
    selectionList.dispValue = dbValue.propDisplayValue;
    selectionList.displayValues = [ dbValue.propDisplayValue ];
    selectionList.uiValue = dbValue.propDisplayValue;
    selectionList.uiValues = [ dbValue.propDisplayValue ];

    return selectionList;
};

/**
 * Return filter string for SOA call
 * If the  Active Display Mode is 'Current' or empty then return 'pca0_show_current'
 * If the Active Display Mode is either 'Features' or 'Families' then return 'pca0_show_all'
 * @param {Object} displayMode -  Grid Editor active Display Mode
 * @returns {String} filter string
 */
export let getGridOptionFilters = ( displayMode ) => {
    if ( displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FEATURES ||  displayMode.activeDisplayMode === pca0Constants.GRID_DISPLAY_MODE.FAMILIES ) {
        return 'pca0_show_all';
    }
    return 'pca0_show_current';
};

/**
 * Copies the content to the OS clipboard
 * @param {String} textToCopy - The text to copy to the clipboard
 * @returns {Boolean} true if the content was copied to the clipboard, false otherwise
 */
export let copyContentToOSClipboard = ( textToCopy ) => {
    // Copy paste of tcClipboardService.copyContentToOSClipboard
    // however that method adds a '\n' after every character resulting
    // in a vertical line of single characters.
    let textArea = document.createElement( 'textarea' );

    // Place in top-left corner of screen regardless of scroll position.
    textArea.style.position = 'fixed';
    textArea.style.top = 0;
    textArea.style.left = 0;

    // Ensure it has a small width and height. Setting to 1px / 1em doesn't work as this gives a negative w/h on
    // some browsers.
    textArea.style.width = '2em';
    textArea.style.height = '2em';

    // We don't need padding, reducing the size if it does flash render.
    textArea.style.padding = 0;

    // Clean up any borders.
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';

    // Avoid flash of white box if rendered for any reason.
    textArea.style.background = 'transparent';

    textArea.value = textToCopy;

    let refEle = document.activeElement;
    refEle.appendChild( textArea );

    textArea.focus();
    textArea.select();

    const verdict = document.execCommand( 'copy', false, null ); //execute copy command

    refEle.removeChild( textArea );

    return verdict;
};

/**
 * Updates the persistent revision rule map with the provided key-value pair.
 *
 * @param {Object} context - The context object.
 * @param {string} key - The key to update in the revision rule map.
 * @param {any} value - The value to update in the revision rule map.
 * @param {string} sessionStorageKey - The key to access the session storage.
 * @returns {void}
 */
export function updatePersistentRevRuleMap( context, key, value ) {
    let configuratorContextUID = _.get( context, 'configPerspective.props.cfg0ProductItems.dbValues[0]' );
    let persistentRevRuleMap = exports.getPersistentRevRuleMapFromSessionStorage();
    if ( persistentRevRuleMap[configuratorContextUID] !== undefined ) {
        persistentRevRuleMap[configuratorContextUID][key] = value;
    } else {
        persistentRevRuleMap[configuratorContextUID] = { [key]: value };
    }
    sessionStorage.setItem( 'Pca0ConfigCtxPersistentRevRuleMap', JSON.stringify( persistentRevRuleMap ) );
}

/**
 * Calls the setProperties SOA to update the properties of a config perspective.
 *
 * @param {String} contextKey To get context information from global CTX
 * @param {Object} configContext - The config context object.
 * @param {string} revisionRuleToSet - The revision rule to set.This is PERSISTENT revision rule.
 * @param {string} effectivityToSet - The effectivity to set.
 * @param {boolean} isDateEffectivity - Indicates if the effectivity is a date effectivity.
 * @returns {Object} returns response if the SOA call is sucessful else returns undefined.
 */
export let callSetPropertiesSOA = async( contextKey, configContext, revisionRuleToSet, effectivityToSet, isDateEffectivity ) => {
    // Register Policy to get Config Perspective with its properties
    let policyId = policySvc.register( pca0CommonConstants.CFG0CONFIGURATORPERSPECTIVE_POLICY );
    let propertiesToSet = [];

    if ( !_.isUndefined( revisionRuleToSet ) ) {
        propertiesToSet.push( {
            name: 'cfg0RevisionRule',
            values: [ revisionRuleToSet ]
        } );
    }

    if ( !_.isUndefined( effectivityToSet ) ) {
        propertiesToSet.push( {
            name: 'cfg0RuleSetEffectivity',
            values: [ effectivityToSet ]
        } );
    }

    let response;
    try {
        response = await dmService.setProperties( [ {
            object: configContext.configPerspective,
            vecNameVal: propertiesToSet
        } ] );
    } catch ( error ) {
        messagingService.showError( error + '<BR/>' );
        return undefined;
    }

    if ( policyId ) {
        policySvc.unregister( policyId );
    }
    // Need to update context and applied settings based on SOA response
    // We don't have for now persistent uid from response. Find the perspective
    let updatedPerspective = _.find( response.ServiceData.modelObjects, {
        type: 'Cfg0ConfiguratorPerspective'
    } );

    if( !_.isUndefined( updatedPerspective ) ) {
        _.set( configContext, 'configPerspective', updatedPerspective );
    }

    if ( !_.isUndefined( revisionRuleToSet ) ) {
        _updatePropertiesOnCtxForRevRule( contextKey, configContext, updatedPerspective, revisionRuleToSet );
    }

    if ( !_.isUndefined( effectivityToSet ) ) {
        _handleEffectivityChange( contextKey, configContext, updatedPerspective, isDateEffectivity );
    }
    return response;
};

/**
 * Updates the editor object with the new editContext and partial errors if any
 * Sets isDirtyFormula to false if the editor is readOnly
 * @param {Object} editorObject Editor properties atomic object e.g. header,editContext
 * @param {String} editContext - editing context
 * @param {Object} ServiceData - Save action soa response servicedata
 */
export const changeFormulaSuggesterEditContext = ( editorObject, editContext, ServiceData ) => {
    let clonedEditorObject = { ...editorObject.getValue ? editorObject.getValue() : editorObject.getAtomicData() };
    clonedEditorObject.editContext = editContext;

    // set isDirtyFormula to false if the editor is readOnly
    if ( editContext === 'readOnly' ) {
        clonedEditorObject.isDirtyFormula = false;
    }
    // If there are partial errors, set them on the editor object to show in the editor
    if ( ServiceData && ServiceData.partialErrors ) {
        clonedEditorObject.errors = ServiceData.partialErrors;
    }
    editorObject.setAtomicData ? editorObject.setAtomicData( clonedEditorObject ) : editorObject.update( clonedEditorObject );
};

/**
 * Retrieves the key of an existing real node that is the same as the current unconfigured one.
 * Currently in the multi svr scenario there are phantom nodes ( in case of a mix of configure-in and out nodes) that for comparision reasons need to be considered
 *
 * @param {Object} businessObjectToSelectionMap - The business object to selection map
 * @param {Object} selection - The current considered unconfigured selection object
 * @param {string} selectionKey - The current considered unconfigured selection key
 * @returns {string} The key of the existing real node that is the same as the current unconfigured one.
 */
export let getExistingNodeKeyWithRealUid = ( businessObjectToSelectionMap, selection, selectionKey ) => {
    let existingNodeKeyWithRealUid = null;
    let famNamespace = _.get( selection, 'familyNamespace' );
    //for unconfigured family
    if ( famNamespace ) {
        _.find( businessObjectToSelectionMap, node => {
            return _.find( node, ( sel, selKey ) => {
                if ( sel.familyId === selection.familyId &&
                    selKey !== selectionKey
                    && sel.familyNamespace !== undefined
                    && sel.familyNamespace === famNamespace ) {
                    existingNodeKeyWithRealUid = selKey;
                    return true;
                }
                return false;
            } );
        } );
    } else {
        //for unconfigured feature
        _.find( businessObjectToSelectionMap, node => {
            return _.find( node, ( sel, selKey ) => {
                if ( sel.valueText === selection.valueText &&
                    sel.family === selection.family &&
                    selKey !== selectionKey ) {
                    existingNodeKeyWithRealUid = selKey;
                    return true;
                }
                return false;
            } );
        } );
    }
    return existingNodeKeyWithRealUid;
};


/**
 * Helper to determine unconfigured node now that multiSvr has an additional approach
 *
 * @param {Object} node - the node to check if it is unconfigured
 * @returns {Boolean} true if the node is unconfigured
 */
export let isTreeNodeUnconfigured = ( node ) => {
    return node.props &&
        node.props.isUnconfigured &&
        Array.isArray( node.props.isUnconfigured ) &&
        node.props.isUnconfigured.every( item => typeof item === 'string' ) &&
        node.props.isUnconfigured[0] !== 'false';
};

/**
 * Helper to determine partially unconfigured node (uses the fake transmitted children in the variability tree data ) and attaches the props
 * of unconfigured to the existing one in case o a mix of both configured in and out). It will return the partially unconfigured props to attach to exising node
 * @param {Object} variabilityTreeData - the variability tree data
 * @param {Object} viewModelObject - the node to check if it is unconfigured
 * @param {Object} parentObject - the parent object of the node
 * @returns {Object} return the partially unconfigured props to attach to exising node
 */
export let getPartiallyUnconfiguredProps = ( variabilityTreeData, viewModelObject, parentObject ) => {
    let foundUnconfiguredFeaturePeerNode = variabilityTreeData.find( ( { nodeUid } ) => nodeUid === parentObject?.sourceUid + ':' + viewModelObject.displayName );
    let isFamily = _.get( viewModelObject, 'props.isFamily.0' ) === 'true';
    let famNamespace = _.get( viewModelObject, 'props.cfg0FamilyNamespace.0' );
    let foundUnconfiguredFamilyPeerNode = famNamespace ? variabilityTreeData.find( ( { nodeUid } ) => nodeUid === famNamespace + ':' + viewModelObject.displayName ) : undefined;
    let foundUnconfigured = isFamily ? foundUnconfiguredFamilyPeerNode : foundUnconfiguredFeaturePeerNode;
    return foundUnconfigured && foundUnconfigured.props.isUnconfigured;
};

/**
 * Clears the update status of cells in the grid data.
 *
 * This function iterates over each column UID and performs the following steps:
 * 1. Retrieves the keys from the `businessObjectToSelectionMap` and `backupOfBusinessObjectToSelectionMap` for the given column UID.
 * 2. Determines the difference between current selection keys and the backup selection keys.
 * 3. For each key in the difference set, finds the corresponding view model object (VMO) and resets its properties.
 *
 * @param {Object} gridData - The data for the grid, containing mappings of business objects to selections.
 * @param {Array<string>} columnUids - An array of UIDs representing the columns to be processed.
 * @param {Array<Object>} vmos - An array of view model objects, each containing properties that may be updated.
 */
export const clearCellsUpdate = ( gridData, columnUids, vmos ) => {
    columnUids.forEach( columnUid => {
        let currentSelectionKeys = Object.keys( gridData.businessObjectToSelectionMap[ columnUid ] );
        let backupSelectionKeys = Object.keys( gridData.backupOfBusinessObjectToSelectionMap[ columnUid ] );
        let diff = _.difference( currentSelectionKeys, backupSelectionKeys );
        diff.forEach( key => {
            let vmo = vmos.find( vmo => vmo.alternateID === key );
            if( vmo ) {
                vmo.props[ columnUid ].dbValue = 0;
                vmo.props[ columnUid ].valueUpdated = false;
            }
        } );
    } );
};

/**
 * Get Product Item vs Persistent Revision rule & Effectivity Map from SessionStorage
 * We need this map because configCtxPerspectiveMap has PI vs perspective map, but perspective always has transient revision rule.
 * Thus to get persistent revision rule, we need to get it from this map.
 * @returns {Object}  Product Item vs Persistent object Map
 */
export let getPersistentRevRuleMapFromSessionStorage = () => {
    let persistentRevRuleMapJSON = sessionStorage.getItem( 'Pca0ConfigCtxPersistentRevRuleMap' );
    return !_.isNull( persistentRevRuleMapJSON ) && !_.isUndefined( persistentRevRuleMapJSON ) ? JSON.parse( persistentRevRuleMapJSON ) : {};
};

/**
 * Checks if type is one of the group types
 * @param {String} type - The type to check if it is a group type.
 * @param {Object} node - The node to check if it is a group node for both treeLoadInput and vmo.
 * @returns {Boolean} true if node is group node
 */
export const isGroupType = ( type, node ) => {
    const validTypes = [
        'Cfg0FamilyGroup',
        'Cfg0AbsFamilyGroup',
        pca0Constants.PSEUDO_GROUPS_UID.PRODUCTS_GROUP_UID,
        pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID
    ];

    // Check if the type is directly provided and valid
    if ( type ) {
        return validTypes.includes( type );
    }

    // Check if the node has a valid group type or is marked as a group
    if ( node ) {
        const isGroup = _.get( node, 'props.isGroup[0]' ) === 'true' || _.get( node, 'props.isGroup.uiValue' ) === 'true';
        const sourceType = node.sourceType || node.type;
        return validTypes.includes( sourceType ) || isGroup;
    }

    // Default to false if neither type nor node is valid
    return false;
};

/**
 * Checks if the given object contains any of the specified types.
 *
 * @param {Object} object - The object to check.
 * @param {Array} typesToCheck - An array of types to check against the object's type hierarchy.
 * @param {Array} typeHierarchy - Optional. An array representing the type hierarchy to use.
 * @returns {boolean} - Returns `true` if the object contains any of the types in `typesToCheck`, otherwise `false`.
 */
export const doesObjectContainType = ( object, typesToCheck, typeHierarchy ) => {
    const typeHierarchyArray = typeHierarchy || object?.modelType?.typeHierarchyArray || [];
    return typesToCheck.some( type => typeHierarchyArray.includes( type ) );
};

/**
 * Get RequestInfo for Validation as per the configurableObject
 * @param {Object} selections - Selected objects
 * @returns {Object} RequestInfo with RequestType string for Product Configuration Validation
 */
export let getRequestInfoForValidation = ( selections ) => {
    let requestInfo = {
        ignoreSelectedExpressions: [ 'true' ],
        selectedExpressions: []
    };
    let uids = selections.map( item => item.uid );
    _.set( requestInfo, 'configurableObject', uids );
    return requestInfo;
};

/**
 * Get Configurator Perspective instance and Context UID for Filtering
 * Application scenario is Filtering:
 *  - Constraints/Variants in VariabilityExplorer
 *  - Variants in Variant Configuration view
 * @param {Object} variantRuleData - <variantRuleData> atomic data passed by parewnt component (if applicable, VCV scenario)
 * @returns {Object} - info container about Configurator Perspective instance and Context UID
 */
export const getConfigPerspectiveAndContextUid = variantRuleData => {
    let configPerspective;
    let configContextUid;
    if( !_.isUndefined( _.get( appCtxService, 'ctx.' + veConstants.CONFIG_CONTEXT_KEY ) ) ) {
        const configuratorCtx = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY );
        configPerspective = _.get( configuratorCtx, 'configPerspective' );
        configContextUid = _.get( appCtxService, 'ctx.state.processed.uid' );
    } else // --> fscContext
    // if fscContext is the active context
    // variantRuleData is defined when loading Pick&Choose tree in loadSVR panel
    // but may still be undefined when loading a multi-level SVR (populating modules tree)

    if( !_.isUndefined( variantRuleData ) ) {
        configPerspective = configuratorUtils.getFscConfigPerspective( variantRuleData );
        configContextUid = _.get( appCtxService, 'ctx.state.processed.pci_uid' );
    }
    return { configPerspective, configContextUid };
};

/**
 * Get the feature facets from SOA response for features filter category
 * These facets info is then cached into the searchState
 * These feature facet values are shown as check-box list of feature facets
 * @param { Object } response - performSearchViewModel SOA response
 * @param { Object } vmSearchState - <searchState> atomicData
 */
export const cacheFeaturesDataFromSoa = ( response, vmSearchState ) => {
    if( !_.isUndefined( response ) ) {
        let featureFacetValues = [];
        let featuresFilterCategory = {
            internalName: pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME,
            displayName: 'Features',
            defaultFilterValueDisplayCount: 5,
            type: 'StringFilter'
        };
        let featuresAwStringFilterCategory =
        {
            internalName: featuresFilterCategory.internalName,
            defaultFilterValueDisplayCount: featuresFilterCategory.defaultFilterValueDisplayCount,
            type: 'StringFilter',
            filterValues: [],
            hasMoreFacetValues: false,
            isServerSearch: false,
            showFilterText: false,
            filterLimitForCategory: 50
        };
        if( !_.isUndefined( response.searchFilterMap ) ) {
            let soaResponseFilterValues = response.searchFilterMap[ pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME ];
            if( !_.isUndefined( soaResponseFilterValues ) && !_.isEmpty( soaResponseFilterValues ) ) {
                soaResponseFilterValues.forEach( filterValue => {
                    let featureFacetValue = {};
                    featureFacetValue.propDisplayValue = filterValue.stringDisplayValue;
                    featureFacetValue.propInternalValue = filterValue.stringValue;
                    featureFacetValues.push( featureFacetValue );
                } );
            }
        }
        let searchState = { ...vmSearchState.getValue() };
        searchState.featuresFilterCategory = { ...searchState.featuresFilterCategory, ...featuresAwStringFilterCategory };
        const uniqueFeatureFacetValues = _.uniqBy( featureFacetValues, 'propDisplayValue' );
        searchState.featuresFilterCategory.featureFacetValues = uniqueFeatureFacetValues;
        searchState.featuresFilterCategory.isPopulated = true;
        vmSearchState.update( searchState );
    }
};

/**
 * Build "searchCriteria" for performFacetSearch SOA
 * This is to get the feature facets for Features filter category and build list/widget component
 * This SOA is called when:
 *  - Filtering Constraints/Variants in VariabilityExplorer
 *  - Filtering variants in VariantConfiguration view
 * @param {Object} variantRuleData loaded SVR atomic data
 * @returns {Object} Input for the performFacetSearch SOA
 */
export const getPerformFacetSearchInput = variantRuleData => {
    let { configPerspective, configContextUid } = exports.getConfigPerspectiveAndContextUid( variantRuleData );

    return {
        configPerspective: configPerspective.uid,
        Name: '*',
        revisionRule: configPerspective.revisionRuleDBName,
        configuratorContext: configContextUid,
        categoryForFacetSearch: pca0Constants.FILTER_CONSTRAINTS.FEATURES_FILTER_CATEGORY_INTERNAL_NAME
    };
};

/**
 * This method used to initialize the command panel in fsc for Save/SaveAs and set
 * title and button title dynamically, according to command
 * @param {Object} panelTitle - Title of Panel
 * @param {Object} i18nNames - i18n Names of panel title,
 * @param {String} createVariantPreference - the 'VariantRule' or 'VariantCriteria' type
 * @returns {Object} return the name of Panel Title
 */
export let initSaveOrSaveAsPanel = ( panelTitle, i18nNames, createVariantPreference  ) => {
    let type = createVariantPreference;
    //the type can come in 2 ways: via fsc, which extracts the type from the fscContext or via transmitted prop on subPanelContext,
    //the latter is the case for the variants tab
    if( !createVariantPreference ) {
        const fscContext = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
        type = fscContext.createVariantPreference;
    }
    if( _.isEqual( panelTitle, FSC_SAVE_COMMAND ) ) {
        panelTitle = i18nNames.saveCmd;
    } else if( _.isEqual( panelTitle, FSC_SAVEAS_COMMAND ) ) {
        panelTitle = i18nNames.saveAsCmd;
    }
    return { title: panelTitle, type: type };
};

/**
 * This function updates the attachVariantRuleToContent radio button based on the preference mode.
 * @param {Object} attachVariantRuleToContent - 'Attach to' Radio button data.
 * @returns {Object} Updated radio button data.
 */
export let initializeSaveVariantRulePanel = ( attachVariantRuleToContent ) => {
    const prefValue = appCtxService.getCtx( 'preferences' ).PCA_attach_variant_to;

    const attachVariantToValue = _.get( prefValue, '[0]' );
    if( attachVariantToValue && attachVariantToValue.toLowerCase() === 'content' ) {
        attachVariantRuleToContent.dbValue = true;
    }
    return attachVariantRuleToContent;
};

/**
 * This function adds the uid of newly created svr in session storage so that new svr is visible in pwa of new tab.
 * @param {Array} createdSVRUids - uids of newly created svr.
 */
export let addUidsOfNewSVRInSelectedObjectsOfSessionStorage = ( createdSVRUids ) => {
    // Get previously selected object uid's from session storage
    let selectedObjectUidsFromSession = sessionStorage.getItem( veConstants.SELECTED_OBJ_UIDS );
    let newSelectedObjectUids = [];
    if( selectedObjectUidsFromSession ) {
        newSelectedObjectUids = JSON.parse( selectedObjectUidsFromSession );
    }
    newSelectedObjectUids.push( ...createdSVRUids );
    // Set selected object uid's in session storage
    sessionStorage.setItem( veConstants.SELECTED_OBJ_UIDS, JSON.stringify( newSelectedObjectUids ) );
};

/**
 * Get Input required for createRelateAndSubmitObjects SOA
 * @param {Object} data the view model data object
 * @param {String} type the createVariantPreference value
 * @return {String} Create Input - String format.
 */
export let getConfigCreateInput = function( data, type, editHandler ) {
    let createInput = addObjectUtils.getCreateInput( data, null, { props: { type_name: { dbValues: [ type ] } } }, editHandler );
    // Deleting the empty properties from list to enable creation of VC when ALS is enabled on its attributes ( eg description ).
    for( const prop in createInput[ 0 ].createData.propertyNameValues ) {
        if( _.isEmpty( createInput[ 0 ].createData.propertyNameValues[ prop ][ 0 ] ) ) {
            delete createInput[ 0 ].createData.propertyNameValues[ prop ];
        }
    }
    return createInput;
};

/**
 * Get instance of created Variant Rule from SOA response
 * @param {Object} response the SOA response
 * @returns {Object} created Variant Rule.
 */
export let getCreatedVariantRule = function( response ) {
    if( response.ServiceData.created ) {
        var variantRuleUID = response.ServiceData.created[ 0 ];
        return response.ServiceData.modelObjects[ variantRuleUID ];
    }
};

/**
 * GetView Model Object for input created Variant Rule
 * @param {Object} response SOA response
 * @returns {Object} VMO for created Variant Rule.
 */
export let getVariantRuleVMO = function( response ) {
    if( !_.isUndefined( response.ServiceData.created ) ) {
        return viewModelObjectService.createViewModelObject( response.ServiceData.created[ 0 ] );
    }
};

/**
 * We get to know if the expression was expanded by user and no dirtyness after expand has been performed.
 * i.e. user has not loaded some other SVR, not unloaded the SVR, has not made any selection of Feature/ Family,
 * has not made any profile change in settings panel, has not clear selections, etc. after hitting the expand action, then
 * this function will return false, else true.
 * @returns {String} - 'true' if user has expanded the expression else 'false'
 */
export const getExpressionExpandedState = () => {
    let context = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
    if( context && context.expressionExpandedState === true ) {
        // When the expressionExpandedState is true, it means the user has expanded the expression and the
        // expanded expression is send as input to SOA while creating/ saving the Variant Rule.
        // This flag is needed on Cfg platform for the performance enhancement.
        return 'true';
    }
    return 'false';
};

/**
 * Get Payload String from FSC context
 * @returns {Object} PayloadStrings for FSC context
 */
export let getPayloadStrings = function() {
    const context = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
    let payloadStrings;
    if( context ) {
        payloadStrings = context.payloadStrings;
    }
    return payloadStrings;
};

/**
 * Convert selected expression json object to selected expression json string array or returns the passed in selected expressions
 * - the use case in which those are passed in like for the save dialog
* @param {Object} selectedExpressions - selected expression json object
* @param {Object} convertedSelectedExpressions - selected expression json object as a string
* @returns {Array} Array of json string of selected expressions.
*/
export let getConvertedSelectedExpressionJsonObjectToString = function( selectedExpressions, convertedSelectedExpressions ) {
    if( convertedSelectedExpressions ) {
        return convertedSelectedExpressions;
    }
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Get current group/scope from input context
 * @param {String} ctx input context key
 * @returns {String} the currentGroup
 */
export let getCurrentGroup = ( ctx ) => {
    var context = appCtxService.getCtx( ctx );
    if( !context ) {
        return '';
    }
    return context.currentScope ? context.currentScope : '';
};

/**
 * Depending on the use case returns default or the current perspective for fsc or the modulePerspectiveForMultiVariants in case of variants tab
 * @param {Object} variantRuleData - variantRuleData
 * @param {Object} configPerspective - fsc config  perspective
 * @return {Object} configPerspective - config  perspective
 */
export let getSaveVariantConfigPerspective = function( variantRuleData, configPerspective ) {
    if( variantRuleData ) {
        return configuratorUtils.getFscConfigPerspective( variantRuleData );
    }
    return configPerspective;
};

/**
 * Get current Configuration mode
 * @param {String} ctx name of current context
 * @returns {String} current variant mode Guided/Manual
 */
export let getConfigurationMode = function( ctx ) {
    var variantMode = 'guided';
    var context = appCtxService.getCtx( ctx );
    if( !context || context && context.guidedMode === false ) {
        variantMode = 'manual';
    }
    return variantMode;
};

/**
 * Gets the applied profile Settings for Full Screen Configuration if not directProfileSettings provided
 * otehrwise returns the appliedSettings of the directProfileSettings
 * @param {String} ctx input context key
 * @param {Object}directProfileSettings  passed in profile settings
 * @returns {String} Profile Settings information - JSON string
 */
export let getProfileSettings = function( ctx, directProfileSettings ) {
    if( directProfileSettings && directProfileSettings.appliedSettings ) {
        let profileSettings = configuratorUtils.getProfileSettingsAsRequestInput( directProfileSettings.appliedSettings );
        return JSON.stringify( profileSettings );
    }

    return configuratorUtils.getProfileSettingsForFsc( ctx );
};

/**
 * Get the property policy for the given SOA name
 * @param {String} soaName - The SOA name
 * @returns {Object} The property policy
 */
export const getPropertyPolicy = ( soaName ) => {
    return pca0PropertyPolicyService.getPropertyPolicyForInputSOA( soaName );
};

/**
 * Get the active selection for Variant Context
 * @param {String} ctx context name
 * @param {Object} configCtx set by the consumer application
 * @param {Boolean} attachVariantRuleToContent check to attach variant rule to content.
 * @return {Object} selected object(s) in Primary Work Area or configCtx set by the consumer application
 */
export let getSelectionForVariantContext = function( ctx, configCtx, attachVariantRuleToContent ) {
    // If consumer already set the configCtx
    if( configCtx && !attachVariantRuleToContent ) {
        return configCtx;
    }
    // ace structure
    const fscContext = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
    if( !_.isUndefined( fscContext && fscContext.selectedModelObjects ) ) {
        return fscContext.selectedModelObjects[ fscContext.selectedModelObjects.length - 1 ];
    }
    // non ace structure
    const multiSelections = appCtxService.getCtx( 'mselected' );
    if( multiSelections && multiSelections.length > 1 ) {
        // return last selected object in case of multiple selections
        return multiSelections[ multiSelections.length - 1 ];
    }
    if( ctx && ctx === pca0Constants.FSC_CONTEXT && appCtxService.getCtx( ctx ) && appCtxService.getCtx( 'selected' ) !== undefined ) {
        return appCtxService.getCtx( 'selected' );
    }
    return multiSelections[ 0 ];
};

/**
 * Processes variant data for a given view model object (vmo) and populates the variantData array.
 * @param {Object} vmo - The view model object representing a node in the variant tree.
 * @param {Array} variantData - The array to which the processed variant data will be added.
 * @param {Array} columns - The array of column objects.
 * @param {Array} allVmos - The array containing all view model objects.
 * @param {Array} standAloneFeaturesUids - The array containing standalone feature UIDs.
 */
export let processVariantExportData = ( vmo, variantData, columns, allVmos, standAloneFeaturesUids ) => {
    let propsData = [ vmo.displayName ];
    columns.forEach( column => {
        if( vmo.props.hasOwnProperty( column.propertyName ) ) {
            const prop = vmo.props[ column.propertyName ];
            const dbValue = prop.dbValue;
            const uiValue = prop.uiValue;
            const isFamilyLevelSelection = prop.props?.isFamilyLevelSelection;
            const valueUpdated = prop.valueUpdated;
            const isUnconfigured = _.get( prop, 'props.isUnconfigured[0]' ) === 'true';

            // Leaf nodes in vmo will have selections. As per the selection dbValue assigning appropriate text to export data
            if( Number.isInteger( dbValue ) && ( vmo.isLeaf || valueUpdated ) || vmo.isExpanded && isFamilyLevelSelection ) {
                if( isUnconfigured ) {
                    propsData.push( localeTextBundle.indicatorConfiguredOut );
                }
                switch ( dbValue ) {
                    case 1:
                        propsData.push( localeTextBundle.positive );
                        break;
                    case 2:
                        propsData.push( localeTextBundle.negative );
                        break;
                    case 5:
                        propsData.push( _localeTextBundleOfConfiguratorMessages.defaultPositive );
                        break;
                    case 6:
                        propsData.push( _localeTextBundleOfConfiguratorMessages.defaultNegative );
                        break;
                    case 9:
                        propsData.push( _localeTextBundleOfConfiguratorMessages.systemPositive );
                        break;
                    case 10:
                        propsData.push( _localeTextBundleOfConfiguratorMessages.systemNegative );
                        break;
                    default:
                        propsData.push( '' );
                        break;
                }
            } else if( Number.isInteger( uiValue ) ) {
                propsData.push( '' );
            } else {
                propsData.push( uiValue );
            }
        } else {
            // For cots column, if selections are not present in props, then push empty string
            propsData.push( '' );
        }
    } );

    let props = {
        nodeData: propsData
    };
    // If the node is in the standAloneFeaturesUids array, we need to add the parent UID to the props to get the correct parent in the export
    if( standAloneFeaturesUids?.includes( vmo.nodeUid ) ) {
        props.parent = [ vmo.parentUID ];
    }
    // If the node is highlighted, then we need to add the isHighlighted property to the props while exporting
    if( vmo.highlight ) {
        props.isHighlighted = [ 'true' ];
    }

    variantData.push( {
        nodeUid: vmo.nodeUid,
        children: vmo.children && vmo.children.length > 0 ? vmo.childrenUids.filter( uid =>
            allVmos.some( vmo => vmo.nodeUid === uid )
        ) : [],
        props: props
    } );
};

/**
 * Updates the fields with the given value.
 *
 * @param {any} value - The value to update the fields with.
 * @param {Object} field - The field to be updated.
 */
export let updateField = ( value, field ) => {
    field.update( value );
};

/**
 *
 * @param {*} scopeName - The name of the scope.
 * @returns {String} The name of the stats collector if in URL ?configuratorDebugMode flag is added
 * else returns an empty string.
 */
export let getStatsCollectorName = ( scopeName ) => {
    return appCtxService.getCtx( 'state.urlAttributes.configuratorDebugMode' ) !== undefined ? scopeName : '';
};

/**
 * Prepare input for SOA call to reset Properties on Perspective
 * @param {Object} vmVariantRuleData - AtomicData <variantRuleData>
 * @returns {Object} SOA input
 */
export let prepareSOAInputForPerspectiveReset = vmVariantRuleData => {
    const fscContext = appCtxService.getCtx( pca0Constants.FSC_CONTEXT );
    let configSettingsInputData = {
        type: 'Pca0ConfigSetting',
        uid: 'uid_config_setting',
        props: {
            pca0ConfigPerspective: _.get( fscContext, 'defaultAppliedSettings.configSettings.props.pca0ConfigPerspective.dbValues' ),
            // NOTE SOA call expects RevisionRule to be persistentUID
            pca0RevisionRule: _.get( fscContext, 'defaultAppliedSettings.configSettings.props.pca0RevisionRule.uid' ),
            pca0RuleDate: _.get( fscContext, 'defaultAppliedSettings.configSettings.props.pca0RuleDate.dbValues' ),
            pca0Effectivity: _.get( fscContext, 'defaultAppliedSettings.configSettings.props.pca0Effectivity.dbValues' )
        }
    };
    if( !_.isUndefined( fscContext.defaultAppliedSettings.configSettings.props.pca0ProductHierarchyDepth ) ) {
        configSettingsInputData.props.pca0ProductHierarchyDepth = fscContext.defaultAppliedSettings.configSettings.props.pca0ProductHierarchyDepth.dbValues;
    }
    let configSettingsJSON = JSON.stringify( configSettingsInputData );
    let variantRuleData = { ...vmVariantRuleData.getAtomicData() };

    return {
        selectedExpressions: [],
        // Note: using variantRuleData instead of defaultAppliedSettings because we need ModelObject instance
        configPerspective: variantRuleData.defaultConfigPerspective,
        payloadStrings: {},
        activeVariantRules: [],
        scopes: [],
        requestInfo: {
            requestType: [ 'getConfigSettings' ],
            configurationControlMode: [ 'guided' ],
            switchingToGuidedMode: [ '' ],
            configSettings: [ configSettingsJSON ],
            mode: [ 'fetchFilterCriteria' ]
        }
    };
};

export default exports = {
    handleEditModeStart,
    resetEditModeStatus,
    setVisibilityOfEditCommandInPWA,
    processPartialErrors,
    getRevRuleCacheStatusForContext,
    getFormattedDateString,
    getEventDataFromEventMap,
    getFormattedDateFromUTC,
    isUTCFormatString,
    updateRevisionRuleOnPerspective,
    prepareUniqueId,
    postProcessGetRevisionRulesFromPlatform,
    selectRevisionRuleInDropdown,
    selectRevisionRuleDbValueInDropdown,
    getSelectedObjectsForSOA,
    getConfigPerspective,
    getShowFamiliesExpansionMap,
    getVariabilityNodes,
    closeToolsAndInfoPanel,
    getPropertiesInformationUIDs,
    updateDirtyVMOs,
    getListOfUnsavedColumns,
    getViewModelProperty,
    postProcessValidateProductConfigurations,
    setIsLeafProperty,
    isConstraintsEditorPropInfoNodeUid,
    isConstraintsEditorPropInfoNode,
    isEnumeratedFamily,
    isObjectFreeForm,
    validateFreeFormAndEnumeratedParentVMO,
    getLocaleTextBundle,
    getLocalizedValue,
    getIconURL,
    getUniqueID,
    getOriginalColumnKeyFromSplitColumnKey,
    getAllSplitColumnsForOriginalColumn,
    isFilterCriteriaSatisfied,
    handleEditModeSync,
    getUnconfiguredTypeForGrid,
    getUnconfiguredIndicatorTooltipForGrid,
    isColumnWithEdits,
    isFamilyType,
    updateCompletenessStatusAndViolations,
    clearCompletenessStatusesOnModules,
    initLegend,
    getLocalizedOperatorStrings,
    getNonGridableExpressionList,
    showNotificationMessageForNonGridableExpressionsIfApplicable,
    toggleBooleanProperty,
    echoInput,
    scrollToRow,
    resetAdvancedReuseAndInlineAuthoringMode,
    vcvViewSettings,
    convertToArray,
    getUidsFromObjects,
    updateSelectionList,
    getNodeUidFromSelection,
    getGridOptionFilters,
    copyContentToOSClipboard,
    updatePersistentRevRuleMap,
    changeFormulaSuggesterEditContext,
    callSetPropertiesSOA,
    getExistingNodeKeyWithRealUid,
    isTreeNodeUnconfigured,
    getPartiallyUnconfiguredProps,
    clearCellsUpdate,
    getPersistentRevRuleMapFromSessionStorage,
    isGroupType,
    doesObjectContainType,
    getRequestInfoForValidation,
    getConfigPerspectiveAndContextUid,
    cacheFeaturesDataFromSoa,
    getPerformFacetSearchInput,
    initSaveOrSaveAsPanel,
    initializeSaveVariantRulePanel,
    addUidsOfNewSVRInSelectedObjectsOfSessionStorage,
    getConfigCreateInput,
    getCreatedVariantRule,
    getVariantRuleVMO,
    getExpressionExpandedState,
    getPayloadStrings,
    getConvertedSelectedExpressionJsonObjectToString,
    getCurrentGroup,
    getSaveVariantConfigPerspective,
    getConfigurationMode,
    getProfileSettings,
    getPropertyPolicy,
    getSelectionForVariantContext,
    displayNotificationMessage,
    processVariantExportData,
    updateField,
    getStatsCollectorName,
    prepareSOAInputForPerspectiveReset
};
