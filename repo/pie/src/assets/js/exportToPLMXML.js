// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */
/**
 * @module js/exportToPLMXML
 */
import _ from 'lodash';
import _cdmSvc from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import _appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';

'use strict';
var exports = {};

/**
 * Populates PLMMXL file name
 *
 * @return {*} - JSON information containing inputs for getAvailableTransferOptionSets
 **/
function populatePLMXMLName( initFileNameField, ctx ) {
    const extPLMXML = '.zip';

    const returnFileNameField = _.clone( initFileNameField );
    //data.plmxmlFileName.dbValue = '';
    if ( ctx ) {
        for( var j = 0; j < ctx.mselected.length; j++ ) {
            // if the object type is not in the support type list, skip it
            var plmXMLFileName = '';
            var isSupportedType = false;

            isSupportedType =  isObjectCandidateForExport( ctx, ctx.mselected[j] );

            if ( !isSupportedType ) {
                continue;
            }

            if ( isBOMLineSelected() ) {
                var occmgmtContext = ctx.aceActiveContext.context;
                if ( occmgmtContext ) {
                    var topElement = occmgmtContext.topElement;
                    plmXMLFileName = topElement.props.object_string.dbValues[0];
                }
            }else{
                plmXMLFileName = ctx.mselected[j].props.object_string.dbValues[0];
            }

            plmXMLFileName = plmXMLFileName.substring( 0, 128 - extPLMXML.length );
            plmXMLFileName +=  extPLMXML;


            returnFileNameField.dbValue = getValidExportFileName( plmXMLFileName );
            return returnFileNameField;
        }
    }
}

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: ''
    };
};

function getXferModes( response ) {
    var xferModeList = [];

    if ( !_.isUndefined( response.transferModeObjects ) ) {
        var modelObjects = response.transferModeObjects;

        _.forEach( modelObjects, function( modelObj ) {
            var listModel = _getEmptyListModel();
            var prop2DispName = modelObj.props.object_name.uiValues[0];
            listModel.propDisplayValue = prop2DispName;
            listModel.propInternalValue = modelObj;
            listModel.propDisplayDescription = modelObj.props.object_desc.dbValues[0];
            xferModeList.push( listModel );
        } );

        return xferModeList;
    }
}


function getRevRules( response ) {
    var revRuleList = [];
    if ( !_.isUndefined( response.lovValues ) ) {
        _.forEach( response.lovValues, rule => {
            var listModel = _getEmptyListModel();
            listModel.propDisplayValue = rule.propDisplayValues.object_name[ 0 ];
            listModel.propInternalValue = rule.uid;
            revRuleList.push( listModel );
        } );
    }
    return revRuleList;
}

/**
 * Check if object is supported for PLMMXL export
 *
 */
function isObjectCandidateForExport( ctx, selectedObject ) {
    // if the preference not found use the predefined list
    var supportedTypes = ctx.preferences ? ctx.preferences.AWC_PLMXML_export_supported_types : undefined;
    if ( _.isUndefined( supportedTypes ) || supportedTypes.length === 0 ) {
        supportedTypes = [ 'Awb0Element', 'Folder', 'Item', 'ItemRevision', 'Form', 'Dataset', 'CCObject', 'StructureContext', 'TransactionElement', 'FaultCode', 'CfgAttachmentLine', 'AppearanceGroup', 'DC_Admin', 'DCt_GraphicPriority', 'DCt_Language', 'Schedule', 'Cls0HierarchyNode', 'Lbr0Library', 'Lbr0LibraryElement', 'Mdl0SubsetDefinition', 'Ptn0Partition', 'Cpd0DesignElement', 'Cpd0DesignFeature' ];
    }

    var isSupportedType = false;
    _.forEach( supportedTypes, function( oneType ) {
        if ( selectedObject.modelType && selectedObject.modelType.typeHierarchyArray && selectedObject.modelType.typeHierarchyArray.includes( oneType ) ) {
            isSupportedType = true;
        }
    } );

    return isSupportedType;
}

/**
 * Get root objects for export
 *
 */

function getRootObjectsForExport( ctx ) {
    var selectedInput = [];

    _appCtxSvc.registerCtx( 'skippedPLMXMLExportObjs', '' );
    _appCtxSvc.registerCtx( 'validObjectForPLMXMLExport', '' );

    var skippedObjectsString = '';

    if ( isBOMLineSelected() ) {
        var occmgmtContext = ctx.aceActiveContext.context;
        if ( occmgmtContext ) {
            var topElement = occmgmtContext.topElement;
            if ( topElement ) {
                var rootObj = {
                    uid: topElement.props.awb0UnderlyingObject.dbValues[0],
                    type: 'unknownType'
                };
            }

            selectedInput.push( rootObj );
        }
    } else {
        const resource = 'pieMessages';
        var errMessage = '';
        var localTextBundle = localeSvc.getLoadedText( resource );

        var isSupportedType = false;
        _.forEach( ctx.mselected, function( selectedItem ) {
            isSupportedType =  isObjectCandidateForExport( ctx, selectedItem );

            if( isSupportedType ) {
                var item = {
                    uid: selectedItem.uid,
                    type: selectedItem.type
                };
                selectedInput.push( item );

                //  validObjects.push(selectedItem.props.object_string.uiValues[0]);
            } else{
                errMessage = localTextBundle.excludePLMXMLExport.replace( '{0}', selectedItem.props && selectedItem.props.object_string ? selectedItem.props.object_string.uiValue : selectedItem.uid );
                errMessage = errMessage.replace( '{1}', selectedItem.type );
                errMessage += '<br>';
                skippedObjectsString += errMessage;
            }
        } );
    }

    _appCtxSvc.registerCtx( 'skippedPLMXMLExportObjs', skippedObjectsString );
    _appCtxSvc.registerCtx( 'validObjectForPLMXMLExport', selectedInput.length );
    return selectedInput;
}

/**
 * Get the revision rule
 *
 */
var getRevisionRule = function( data, ctx ) {
    if ( data.revisionRuleListBox && data.revisionRuleListBox.dbValue  ) {
        return data.revisionRuleListBox.dbValue;
    } else if ( isBOMLineSelected() ) {
        var occmgmtContext = ctx.aceActiveContext.context;
        if ( occmgmtContext ) {
            return occmgmtContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0];
        }
    }
};

var isBOMLineSelected = function() {
    if ( _appCtxSvc.ctx.aceActiveContext && _appCtxSvc.ctx.mselected.length > 0 ) {
        var selectedObj = _appCtxSvc.ctx.mselected[0];
        if ( selectedObj.modelType && selectedObj.modelType.typeHierarchyArray.includes( 'Awb0Element' ) ) {
            return true;
        }
    }
    return false;
};

export let getSOAInputForPLMXMLExport = function( data, ctx, occContext ) {
    var rootObjectsInput = getRootObjectsForExport( ctx );

    var sessionOptionsInput = collectSessionOption( ctx, occContext );

    var revRule = '';
    var revRuleUid = getRevisionRule( data, ctx );
    if( !_.isUndefined( revRuleUid ) ) {
        revRule = revRuleUid;
    }

    var languagesList = getExportLanguageOptions( data.languageList.dbValue );

    var plmXMLFileName = getValidExportFileName( data.plmxmlFileName.dbValue );
    const extPLMXMLZip =  '.zip';


    var n = plmXMLFileName.lastIndexOf( '.zip' );
    if ( n === -1 ) {
        //If zip extension is not specified then trauncate string first then add zip extension
        plmXMLFileName = plmXMLFileName.substring( 0, 128 - extPLMXMLZip.length );
        plmXMLFileName +=  extPLMXMLZip;
    }

    return {
        rootObjects: rootObjectsInput,
        transferMode: { uid: data.transferModeListBox.dbValue.uid, type: 'unknownType' },
        revisionRule: { uid: revRule, type: 'unknownType' },
        languages :languagesList,
        sessionOptions: sessionOptionsInput,
        outputFileName:plmXMLFileName
    };
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var isPartialBOMExport = function( ctx ) {
    var partialExport = false;
    if ( isBOMLineSelected() ) {
        var occmgmtContext = ctx.aceActiveContext.context;
        if ( occmgmtContext ) {
            var topElement = occmgmtContext.topElement;

            //Partial export is supported only for BOM structure
            var underlineObjProp = topElement.props.awb0UnderlyingObject;
            if ( !_.isUndefined( underlineObjProp ) ) {
                var underlyingObj = _cdmSvc.getObject( underlineObjProp.dbValues[0] );
                if ( underlyingObj.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
                    var topElementFound = false;

                    for ( var i = 0; i < ctx.mselected.length; i++ ) {
                        var oneSelected = ctx.mselected[i];
                        if ( oneSelected === topElement ) {
                            topElementFound = true;
                            break;
                        }
                    }
                    if ( !topElementFound ) {
                        partialExport = true;
                    }
                }
            }
        }
    }
    return partialExport;
};

/**
* @param {*} ctx - Current  context
*
* @return {*} occurence thread chains in case of partial BOM export
**/

var collectOccurrenceThreadChains = function( ctx ) {
    var occThreadChains = '';
    for ( var j = 0; j < ctx.mselected.length; ++j ) {
        var curObject = ctx.mselected[j];
        var occThreadChain = '';
        do {
            var occThreadUID = curObject.props.awb0CopyStableId.dbValues[0];
            if ( occThreadChain.length > 0 ) {
                occThreadChain = ':' + occThreadChain;
            }
            occThreadChain = occThreadUID + occThreadChain;
            curObject = _cdmSvc.getObject( curObject.props.awb0Parent.dbValues[0] );
        } while ( curObject.props.awb0Parent.dbValues[0] !== null );

        if ( occThreadChains === '' ) {
            occThreadChains = occThreadChain;
        } else {
            occThreadChains = occThreadChains + '|' + occThreadChain;
        }
    }
    return occThreadChains;
};

/**
 * collectSessionOption
 */
function collectSessionOption( ctx, occContext ) {
    var sessionOptionNamesValues = [];

    const TRUE_VALUE = 'True';
    const FALSE_VALUE = 'False';

    var pdiIOR = { optionName: 'pdiIOR', optionValue: '' };
    sessionOptionNamesValues.push( pdiIOR );

    var soaIOR = { optionName: 'soaIOR', optionValue: '' };
    sessionOptionNamesValues.push( soaIOR );

    var packResult = { optionName: 'packResult', optionValue: TRUE_VALUE };
    sessionOptionNamesValues.push( packResult );

    var PIE_Export_ImanFile_Tickets = { optionName: 'PIE_Export_ImanFile_Tickets', optionValue: FALSE_VALUE };
    sessionOptionNamesValues.push( PIE_Export_ImanFile_Tickets );

    var PIE_Export_PLMD_Tickets = { optionName: 'PIE_Export_PLMD_Tickets', optionValue: FALSE_VALUE };
    sessionOptionNamesValues.push( PIE_Export_PLMD_Tickets );

    var PIE_Export_ImanFile_Download_Path = { optionName: 'PIE_Export_ImanFile_Download_Path', optionValue: '' };
    sessionOptionNamesValues.push( PIE_Export_ImanFile_Download_Path );

    // For ACE, we need to pass the top ItemRevision and RevisoinRule and other configurations
    if ( isBOMLineSelected() ) {
        var occmgmtContext = ctx.aceActiveContext.context;
        if ( occmgmtContext ) {
            var aceVarRules = occmgmtContext.productContextInfo.props.awb0CurrentVariantRules.dbValues;
            if ( aceVarRules.length > 0 ) {
                var varRule = { optionName: 'variantRule', optionValue: aceVarRules[0] };
                sessionOptionNamesValues.push( varRule );
            }
            if ( occContext ) {
                var showUnConfiguredVariants = { optionName: 'showUnConfiguredVariants', optionValue: occContext.displayToggleOptions.PSEShowUnconfigdVarPref ? TRUE_VALUE : FALSE_VALUE };
                sessionOptionNamesValues.push( showUnConfiguredVariants );

                var showUnConfiguredOccEff = { optionName: 'showUnConfiguredOccEff', optionValue: occContext.displayToggleOptions.PSEShowUnconfigdEffPref ? TRUE_VALUE : FALSE_VALUE };
                sessionOptionNamesValues.push( showUnConfiguredOccEff );

                var showSuppressedOcc = { optionName: 'showSuppressedOcc', optionValue:occContext.displayToggleOptions.PSEShowSuppressedOccsPref ? TRUE_VALUE : FALSE_VALUE };
                sessionOptionNamesValues.push( showSuppressedOcc );
            }
            // For partial export, collect the occurrence thread chains
            if ( isPartialBOMExport( ctx ) ) {
                var occThreadChainsString = collectOccurrenceThreadChains( ctx );
                var occThreadChains = { optionName: 'occThreadChains', optionValue: occThreadChainsString };
                sessionOptionNamesValues.push( occThreadChains );
            }
        }
    }

    return sessionOptionNamesValues;
}

function getExportLanguageOptions( selectedLanguages ) {
    var langaugeOptions = [];

    // Check if input is null or empty then return empty array from here
    if( !selectedLanguages || selectedLanguages.length <= 0 ) {
        return langaugeOptions;
    }

    // Iterate for each language selected and populate the language list
    _.forEach( selectedLanguages, function( language ) {
        langaugeOptions.push( language.languageCode );
    } );
    return langaugeOptions;
}

function getValidExportFileName( fileName ) {
    var newFileName = fileName.trim();

    return newFileName.replace( /[/:*?"/\\<>|;]/g, '_' );
}

/**
 * Handles error from SOA
 *
 * @param {object} data the view model data object
 */
export let processPLMXMLPartialErrors = function( serviceData, data, ctx ) {
    var partialFailureMessage = _appCtxSvc.getCtx( 'skippedPLMXMLExportObjs' );
    var validObjectsCount = _appCtxSvc.getCtx( 'validObjectForPLMXMLExport' );

    var numOfInvalidTypeObjs = 0;
    if ( partialFailureMessage && partialFailureMessage.length > 0 ) {
        numOfInvalidTypeObjs = ctx.mselected.length - validObjectsCount;
    }
    var resource = 'pieMessages';
    var errMessage = '';
    var localTextBundle = localeSvc.getLoadedText( resource );

    if ( serviceData.partialErrors ) {
        var messages = '';

        if ( ctx.mselected.length > 1 ) {
            errMessage = localTextBundle.multipleSelectionPLMXMLExportFailedMessage.replace( '{0}', ctx.mselected.length );
            errMessage = errMessage.replace( '{1}', data.plmxmlFileName.dbValue  );
        } else {
            errMessage = localTextBundle.singleSelectionPLMXMLExportFailedMessage.replace( '{0}', ctx.mselected[0].props.object_string.uiValues[0] );
            errMessage = errMessage.replace( '{1}', data.plmxmlFileName.dbValue );
        }

        for ( var index in serviceData.partialErrors ) {
            var partialError = serviceData.partialErrors[index];

            for ( var count in partialError.errorValues ) {
                var errorValue = partialError.errorValues[count];
                if ( errorValue.message.length > 0 ) {
                    messages += '<br>' + errorValue.message;
                }
            }
        }

        errMessage = errMessage.replace( '{2}', messages );

        if( partialFailureMessage && partialFailureMessage.length > 0 ) {
            errMessage += '\n\n';
            errMessage += partialFailureMessage;
        }
        msgSvc.showError( errMessage );
    } else{
        if( numOfInvalidTypeObjs ) {
            messages = localTextBundle.multipleSelectionPLMXMLExportStartedMessage.replace( '{0}', validObjectsCount );
            messages = messages.replace( '{1}', ctx.mselected.length );
            messages = messages.replace( '{2}', data.plmxmlFileName.dbValue );

            messages += '\n';
            messages += partialFailureMessage;

            msgSvc.showError( messages );
        } else {
            if ( ctx.mselected.length > 1 ) {
                messages = localTextBundle.multipleSelectionPLMXMLExportStartedMessage.replace( '{0}', ctx.mselected.length );
                messages = messages.replace( '{1}', ctx.mselected.length );
                messages = messages.replace( '{2}', data.plmxmlFileName.dbValue );
            } else {
                messages = localTextBundle.singleSelectionPLMXMLExportStartedMessage.replace( '{0}', ctx.mselected[0].props.object_string.uiValues[0] );
                messages = messages.replace( '{1}', data.plmxmlFileName.dbValue );
            }

            msgSvc.showInfo( messages );
        }
    }
    _appCtxSvc.unRegisterCtx( 'skippedPLMXMLExportObjs' );
    _appCtxSvc.unRegisterCtx( 'validObjectForPLMXMLExport' );
};

export let getPreferenceValues = function( data ) {
    var transferMode2Langs = new Map();

    var getTMLangsPref = {
        preferenceNames: [ 'PIE_transfermode_languages' ],
        includePreferenceDescriptions: false
    };

    return soaSvc.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', getTMLangsPref ).then( function( response ) {
        //Error Handling
        var err;
        if ( response && response.ServiceData && response.ServiceData.partialErrors ) {
            err = soaSvc.createError( response.ServiceData.partialErrors );
            err.message = '';
            _.forEach( response.ServiceData.partialErrors, function( partialError ) {
                _.forEach( partialError.errorValues, function( object ) {
                    //1700 Represents an error code for the preference not being found. we can ignore this message.
                    if ( object.code === 1700 ) {
                        err.ignoreErrorCode = true;
                    }
                    err.message += '<BR/>';
                    err.message += object.message;
                } );
            } );
        }

        if ( _.isUndefined( err ) ) {
            var prefValues = response.response[0].values.values;
            // Parse the values and cache them in transferMode2Langs map.
            _.forEach( prefValues, function( onePrefVal ) {
                var transferMode = onePrefVal.substring( 0, onePrefVal.search( ':' ) );
                var langs = onePrefVal.substring( onePrefVal.search( ':' ) + 1 );
                transferMode2Langs.set( transferMode, langs );
            } );
        }

        return transferMode2Langs;
    } );
};

export let updateLanguagesSelection = function( data ) {
    var langsDBValues = [];
    var langsDisplay = [];

    if ( !_.isUndefined( data.transferMode2Langs ) && data.transferModeListBox.dbValue !== '' ) {
        var transferMode = data.transferModeListBox.dbValue;
        var langs = data.transferMode2Langs.get( transferMode.props.object_name.dbValues[0] );
        if ( !_.isUndefined( langs ) && langs.length > 0 ) {
            var langsArray = langs.split( ',' );

            _.forEach( langsArray, function( oneLang ) {
                _.forEach( data.languageListValues, function( oneLangVmo ) {
                    if ( oneLangVmo.propInternalValue.languageCode === oneLang ) {
                        langsDBValues.push( oneLangVmo.propInternalValue );
                        langsDisplay.push( oneLangVmo.propDisplayValue );
                    }
                } );
            } );
        }
    }

    return{
        langsDB: langsDBValues,
        langsDisplay: langsDisplay
    };
};

/**
 * Since this module can be loaded as a dependent DUI module we need to return an object indicating which
 * service should be injected to provide the API for this module.
 */
export let moduleServiceNameToInject = 'exportToPLMXML';
export default exports = {
    populatePLMXMLName,
    getXferModes,
    getRevRules,
    getRootObjectsForExport,
    getSOAInputForPLMXMLExport,
    getExportLanguageOptions,
    getValidExportFileName,
    collectSessionOption,
    processPLMXMLPartialErrors,
    isObjectCandidateForExport,
    getPreferenceValues,
    updateLanguagesSelection
};
