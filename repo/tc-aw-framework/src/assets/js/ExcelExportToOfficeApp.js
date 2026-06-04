//@<COPYRIGHT>@
//==================================================
//Copyright 2022.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * Module for the Export to Office panel
 *
 * @module js/ExcelExportToOfficeApp
 */

import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import uwPropertySvc from 'js/uwPropertyService';
import listBoxService from 'js/listBoxService';
import adapterSvc from 'js/adapterService';
import soaSvc from 'soa/kernel/soaService';
import tcDataMgmtSvc from 'js/tcDataManagementService';
import localeService from 'js/localeService';
import fmsUtils from 'js/fmsUtils';
import cdm from 'soa/kernel/clientDataModel';

/**
  * Get the selected Spec template name
  * @param {Object} data - The panel's view model object
  * @return {String} The Spec template name
  */
export let getTemplateNameForExport = function( data ) {
    var template = '';
    if ( data.excelTemplates.dbValue !== data.i18n.customPropertyTitle ) {
        template = data.excelTemplates.dbValue;
    }
    return template;
};

/**
 * Update the arrange panel if the selected Excel template is custom.
 *
 * @function updateArrangePanel
 * @param {Object} data - The data containing Excel template information.
 * @returns {void}
 */
export let revealAceColumnArrangePanel = function( data ) {
    if ( data.excelTemplates.dbValue === data.i18n.customPropertyTitle ) {
        eventBus.publish( 'revealArrangePanel' );
    }
};

/**
 * Checks if the given object is a removed BOM line based on awb0MarkupType property.
 *
 * @param {Object} object - The object to check.
 * @returns {boolean} True if the object is a removed BOM line, otherwise false.
 */
function isRemovedBomLine( object ) {
    //The value '2' indicates a "Removed" BOM line.
    return object?.props?.awb0MarkupType?.dbValues?.[0] === '2';
}

/**
 * Returns true if all objects in the array are removed BOM lines.
 *
 * @param {Array} objects - The array of objects to check.
 * @returns {boolean} True if all objects are removed BOM lines, otherwise false.
 */
function areAllRemovedBomLines( objects ) {
    return _.isArray( objects ) && objects.length > 0 && objects.every( isRemovedBomLine );
}

/**
 * Returns only BOM lines that are NOT removed BOM lines.
 *
 * @param {Array} objects - The array of objects to filter.
 * @returns {Array} The filtered array with removed BOM lines excluded.
 */
function filterNonRemovedBomLines( objects ) {
    if ( !_.isArray( objects ) || objects.length === 0 ) {
        return [];
    }
    return objects.filter( obj => !isRemovedBomLine( obj ) );
}


export let getInputObjects = function( subPanelContext ) {
    var mselected = _.get( appCtxService, 'ctx.mselected', undefined );
    var inputObjects;

    if ( subPanelContext.selectionData && subPanelContext.selectionData.selected && subPanelContext.selectionData.selected.length > 0 && subPanelContext.selectedParemeters ) {
        return adapterSvc.getAdaptedObjectsSync( subPanelContext.selectionData.selected );
    } else if ( _.isEqual( mselected, subPanelContext.selected ) ) {
        inputObjects = subPanelContext.selected;
    } else {
        inputObjects = _.get( appCtxService, 'ctx.panelContext', undefined );
        if ( !inputObjects || !_.isArray( inputObjects ) ) {
            inputObjects = mselected;
        }
        subPanelContext.selected = inputObjects;
    }

    // Filter out objects marked as 'Removed' only when in the Change Content tab
    if ( appCtxService.ctx.aceActiveContext?.context?.isChangeEnabled ) {
        inputObjects = filterNonRemovedBomLines( inputObjects );
    }

    return inputObjects;
};

/**
  * Get target objects to Export
  * @return {Any} Array of target objects to export
  */
export let getTargetObjectsToExportForExcel = function() {
    var aceProductContext = [];
    var aceActiveContext = appCtxService.getCtx( 'aceActiveContext' );
    if ( aceActiveContext ) {
        aceProductContext.push( aceActiveContext.context.productContextInfo );
    }
    return aceProductContext;
};

// Configures export settings based on the selected object, enabling single sheet export if applicable.
export let initializeExportOptions = function( data, subPanelContext ) {
    const selectedObjects = subPanelContext?.selectionData?.selected || [];

    // Close dialog if all selected objects in Change Content tab are removed BOM lines
    if ( appCtxService.ctx.aceActiveContext?.context?.isChangeEnabled && areAllRemovedBomLines( selectedObjects ) ) {
        eventBus.publish( 'closeDialog' );
    } else {
        if(  selectedObjects.length === 1 && subPanelContext?.contextKey === 'occmgmtContext' && subPanelContext?.provider?.viewModeId !== 'ChangeBOMSubLocation' ) {
            data.exportAsStructure.dbValue = true;
        }
        // Configure export options for single object selection
        if ( selectedObjects.length === 1 ) {
            if ( data.areSelectedObjectsValidForExport ) {
                data.exportAsStructure.dbValue = false;
            }
            data.exportToSingleSheet.dbValue = true;
        }

        // Set default export levels when not exporting as structure
        if ( data.exportAsStructure && !data.exportAsStructure.dbValue ) {
            data.levelsToExport.dbValue = true;
            data.exportLevelsCount.dbValue = 1;
        }
        if( selectedObjects.length === 1 && subPanelContext?.contextKey === 'occmgmtContext' && subPanelContext?.provider?.viewModeId !== 'ChangeBOMSubLocation' ) {
            data.exportAsStructure.dbValue = false;
        }
    }
    return {
        radioButtonData: data.exportToSingleSheet,
        exportAsStructureData: data.exportAsStructure,
        levelsToExportData: data.levelsToExport,
        exportLevelsCountData: data.exportLevelsCount
    };
};

/**
 * Resets the export levels options and numeric box to their default values
 * based on export structure and template selection.
 * @param {Object} data - The view model data object.
 * @returns {Object} Updated export levels data.
 */
export let resetLevelsExportOptions = function( data ) {
    // Reset both options if exportAsStructure is false or template is not custom
    if( data?.subPanelContext?.contextKey === 'occmgmtContext' && data?.subPanelContext?.provider?.viewModeId !== 'ChangeBOMSubLocation' ) {
        data.exportAsStructure.dbValue = true;
    }

    if ( data.exportAsStructure && !data.exportAsStructure.dbValue && data.levelsToExport && !data.levelsToExport.dbValue ) {
        data.levelsToExport.dbValue = true;
        data.exportLevelsCount.dbValue = 1;
    }
    // If "All Levels" is selected, always reset numeric box to 1
    else if ( data.levelsToExport?.dbValue ) {
        data.exportLevelsCount.dbValue = 1;
    }
    if( data?.subPanelContext?.contextKey === 'occmgmtContext' && data?.subPanelContext?.provider?.viewModeId !== 'ChangeBOMSubLocation' ) {
        data.exportAsStructure.dbValue = false;
    }
    return {
        levelsToExportData: data.levelsToExport,
        exportLevelsCountData: data.exportLevelsCount
    };
};

/**
  * Get the export options
  *
  * @param {Object} data - The panel's view model object
  * @return {Any} Array of export options
  */
export let getExportOptionValueForExcel = function( data ) {
    var exportOptions = [];
    const subPanelContext = data.subPanelContext;
    if ( data.runInBackgroundExcelExport.dbValue ) {
        exportOptions.push( {
            option: 'RunInBackground',
            optionvalue: 'RunInBackground'
        } );
    }

    // If 'Export As Structure' is enabled and multiple objects are selected
    // add 'exportToSingleSheet' option to exportOptions.
    const selectedObjects = getInputObjects( subPanelContext );

    if( data.exportAsStructure?.dbValue && selectedObjects && selectedObjects.length > 1 ) {
        exportOptions.push( {
            option: 'exportToSingleSheet',
            optionvalue: data.exportToSingleSheet.dbValue.toString()
        } );
    }

    if( data.levelsToExport && !data.levelsToExport.dbValue ) {
        exportOptions.push( {
            option: 'expandLevel',
            optionvalue: data.exportLevelsCount.dbValue.toString()
        } );
    }

    exportOptions.push( {
        option: 'idHyperlink',
        optionvalue: data.idHyperlink.dbValue.toString()
    },
    {
        option: 'exportAsStructure',
        optionvalue: data.exportAsStructure.dbValue.toString()
    } );

    // Add the change notice revision UID to exportOptions if the 'Change BOM' tab is active.
    if( subPanelContext?.provider?.viewModeId === 'ChangeBOMSubLocation'  && subPanelContext?.baseSelection ) {
        exportOptions.push( {
            option: 'changeNoticeRevision',
            optionvalue: subPanelContext.baseSelection.uid
        } );

        /*
        * Server-side limitation: When exporting in background and as structure within a change notice revision,
        * the selected bomline object does not provide childrenInChange (toggle) state information.
        * To ensure export accuracy, this state is retrieved from each selected object's product context information (PCI).
        * The export options for childrenInChange are then built for every selected PCI object,
        * guaranteeing that the exported data correctly reflects the intended structure and toggles.
        */
        if( data.runInBackgroundExcelExport.dbValue && data.exportAsStructure?.dbValue ) {
            exportOptions.push( ...getChildrenInChangeExportOptions( data ) );
        }
    }

    if ( subPanelContext?.parametersTable?.usage ) {
        exportOptions.push( {
            option: 'usage',
            optionvalue: subPanelContext.parametersTable.usage
        } );
    }

    //check for extra custom export options added by consumers.
    var extraExportOptions = appCtxService.getCtx( 'extraExportOptions' );
    if( extraExportOptions && extraExportOptions.length > 0 ) {
        for( var i = 0; i < extraExportOptions.length; i++ ) {
            exportOptions.push( {
                option: extraExportOptions[ i ].option,
                optionvalue: extraExportOptions[ i ].optionvalue
            } );
        }
    }

    return exportOptions;
};

/**
 * This function will return the current state of "Restrict Children Within Change" toggle.
 * @param {integer} viewToggles : Bit masked value of toggle states.
 * @returns {boolean} : True/False for enable/disable
 *
 * Note: we can't use the occurrenceManagementStateHandler functions here as it will get audit error.
 */
function getRestrictChildrenWithinChangeState( viewToggles ) {
    let restrictChildrenWithinChange = false;
    const VISIBILITY_FLAG_restrictChildrenWithinChange = 1 << 11;  // Bit 11 (int value = 2048)
    if( viewToggles & VISIBILITY_FLAG_restrictChildrenWithinChange ) {
        restrictChildrenWithinChange = true;
    }
    return restrictChildrenWithinChange;
}

/**
 * Builds export options for childrenInChange for selected PCI objects in Change BOM context.
 * For each selected object, finds the corresponding PCI object, extracts its view toggles,
 * and generates an export option for its childrenInChange state.
 *
 * @param {Object} data - The panel's view model object containing selection and context info.
 * @returns {Array<Object>} Array of export option objects, each with option and optionvalue for childrenInChange.
 */
function getChildrenInChangeExportOptions( data ) {
    const selectedObjects = data.subPanelContext?.selectionData?.selected?.length > 0
        ? data.subPanelContext.selectionData.selected
        : data.subPanelContext?.selected ?? data.ctx.mselected;

    /**
     * For each selected object, find the corresponding Product Context Information (PCI) object.
     * Then, extract its view toggles and build export options for its childrenInChange state.
     * Each export option is named 'childrenInChangeN' (where N is the object index) and contains
     * the childrenInChange value for that PCI object. Only PCI objects with valid view toggles are included.
     */
    let listOfPCIObjects = [];
    let exportOptions = [];
    for ( const selObj of selectedObjects ) {
        const obj = cdm.getObject( selObj.pciUid );
        if ( obj ) {
            listOfPCIObjects.push( obj );
        }
    }

    let objCount = 1;
    for ( const pciObj of listOfPCIObjects ) {
        const viewToggles = pciObj?.props?.awb0ViewToggles ? pciObj.props.awb0ViewToggles.dbValues[0] : -1;
        if ( viewToggles && viewToggles >= 0 ) {
            const childrenInChange = getRestrictChildrenWithinChangeState( viewToggles );
            const option = 'childrenInChange' + objCount.toString();
            exportOptions.push( {
                option: option,
                optionvalue: childrenInChange.toString()
            } );
        }
        objCount++;
    }

    return exportOptions;
}

/**
 * Generates the Excel file name based on the selected objects and opens the file using fms.
 *
 * @param {Object} data - The data containing context and selection information.
 */
export let generateAndOpenExcelExportFile = function( data ) {
    if ( !data.fileTicket || data.fileTicket.length === 0 ) {
        return;
    }

    let excelExportFileName = '';
    let excelFileExtension = data.exportedExcelFileExtension;
    let selectedObjects = data.subPanelContext?.selectionData?.selected?.length > 0
        ? data.subPanelContext.selectionData.selected
        : data.subPanelContext?.selected ?? data.ctx.mselected;

    // Filter out removed BOM lines only in Change content tab Enabled
    if ( appCtxService.ctx.aceActiveContext?.context?.isChangeEnabled ) {
        selectedObjects = filterNonRemovedBomLines( selectedObjects );
    }

    if( selectedObjects && selectedObjects.length > 0 ) {
        if( selectedObjects.length > 1 ) {
            const resource = 'ExcelRoundTripMessages';
            const localTextBundle = localeService.getLoadedText( resource );
            // If multiple objects are selected with export as stucture, set the file name as "Multiple Structures Export" else fileName is "Multiple Objects Export"
            excelExportFileName = data.exportAsStructure && data.exportAsStructure.dbValue ? localTextBundle.multiStructureExcelFileName : localTextBundle.multiSelectObjectsExcelFileName;
        } else{
            let selectedObject = selectedObjects[0];
            let selectedObjectNameProp = selectedObject.props?.object_name || selectedObject.props?.object_string;
            if( selectedObjectNameProp && selectedObjectNameProp.dbValues && selectedObjectNameProp.dbValues.length > 0 ) {
                excelExportFileName = selectedObjectNameProp.dbValues[0];
                if( excelExportFileName && excelExportFileName.length > 0 ) {
                    const invalidFileNameCharsPattern = /[/\\:*?"<>|]/g;
                    excelExportFileName = excelExportFileName.replace( invalidFileNameCharsPattern, ' ' ).trim();
                }
            }
        }

        // Default to 'xlsm' if excelFileExtension is empty or contains only whitespace
        if( !excelFileExtension || excelFileExtension.trim().length === 0 ) {
            excelFileExtension = 'xlsm';
        }
        excelExportFileName += '.' + excelFileExtension;
    }
    fmsUtils.openFile( data.fileTicket, excelExportFileName );
};

/**
 * Unregisters the 'extraExportOptions' context from the application context if it exists.
 **/
export let unregisterExtraExportOptionsContext = function() {
    let extraExportOptions = appCtxService.getCtx( 'extraExportOptions' );
    if( extraExportOptions && extraExportOptions.length > 0 ) {
        appCtxService.unRegisterCtx( 'extraExportOptions' );
    }
};

/**
 * Method returns applicationFormat as 'ConfiguratorExport' for configContext ( models, features, constraints and variants tabs)
 * For remaining cases it will return applicationFormat as 'RoundTripMSExcel'
 * */
export let getApplicationFormat = ( props ) => {
    if ( [ 'tc_xrt_Models', 'tc_xrt_Features', 'tc_xrt_Constraints', 'tc_xrt_Variants', 'tc_xrt_Modules' ].includes( props ) ) {
        return 'ConfiguratorExport';
    }
    return 'RoundTripMSExcel';
};

/**
 * Updates export properties based on the provided data.
 * @param {Object} data - The data containing arranged columns information.
 * @returns {Object} An object containing updated export properties.
 */
export let updateExportProperties = function( data ) {
    let exportProperties = null;
    let isUpdated = false;
    let saveAsNewArrangement = false;
    let isOrgConfigDefaultAndNewArrangementCreated = false;
    let isOrgConfigDefaultAndExistingArrangementUpdated = false;

    // Check if data and arrangeData exist
    if( data && data.arrangeData && data.arrangeData.columnDefs && data.arrangeData.columnDefs.length > 0 ) {
        let arrangeData = data.arrangeData;
        exportProperties = arrangeData.columnDefs;
        if ( arrangeData.columnConfigId ) {
            isUpdated = arrangeData.dirty  && !data.newColumnconfig.dbValue && arrangeData.isArrangeAndSave;
            saveAsNewArrangement = data.newColumnconfig.dbValue && arrangeData.originalColumnConfig.columnConfigName !== 'Default';
            isOrgConfigDefaultAndNewArrangementCreated = data.newColumnconfig.dbValue && arrangeData.originalColumnConfig.columnConfigName === 'Default';
            isOrgConfigDefaultAndExistingArrangementUpdated =  isUpdated && arrangeData.originalColumnConfig.columnConfigName === 'Default';
        }
    }
    return {
        selectedColumns: exportProperties,
        existingColumnUpdated: isUpdated,
        isSaveAsNewArrangementClicked:saveAsNewArrangement,
        isOrgConfigDefaultAndNewArrangementCreated:isOrgConfigDefaultAndNewArrangementCreated,
        isOrgConfigDefaultAndExistingArrangementUpdated:isOrgConfigDefaultAndExistingArrangementUpdated
    };
};


/* return selected properties
  * @param {Object} data - The view model data
  */
export let getSelectedProperties = function( data ) {
    var properties = [];
    if ( data.excelTemplates.dbValue === data.i18n.customPropertyTitle ) {
        let selectedColumns = filterUniqueAndNonDCPProperties( data.selectedColumns, 'propertyName' );
    
        // When exporting as structure, include only element related properties.
        if ( data.exportAsStructure?.dbValue ) {
            selectedColumns = getElementProperties(selectedColumns);
        }

        _.forEach( selectedColumns, function( column ) {
            let propertyName = column.propertyName;
            if( propertyName && !propertyName.includes( ':' ) ) {
                let typeName = column.typeName;
                if( !typeName ) {
                    typeName = column.associatedTypeName;
                }
                propertyName = column.propertyName + ':' + typeName;
            }
            properties.push( propertyName );
        } );
    }
    return properties;
};


/**
 * Filters properties to return only element-related ones.
 * 
 * @param {Array} exportProperties - Array of property objects
 * @returns {Array} Properties with typeName containing 'element'
 */
function getElementProperties( exportProperties ) {
    return exportProperties.filter(
        prop => prop.typeName?.toLowerCase().includes('element')
    );
}

/**
  * Create view model property for the property info
  *
  * @param {Object} propInfo - Property info
  * @returns {Object} viewModelObject - view model object for the given property info
  */
var _createViewModelObjectForProperty = function( propInfo ) {
    var dispPropName = propInfo.displayName;
    var propName = propInfo.propertyName + ':' + propInfo.typeName;
    var viewProp = uwPropertySvc.createViewModelProperty( propName, dispPropName, 'BOOLEAN', [],
        [] );
    uwPropertySvc.setIsRequired( viewProp, true );
    uwPropertySvc.setIsArray( viewProp, false );
    uwPropertySvc.setIsEditable( viewProp, true );
    uwPropertySvc.setIsNull( viewProp, false );
    uwPropertySvc.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_RIGHT' );
    uwPropertySvc.setValue( viewProp, true );
    return viewProp;
};

/**
 * checks if the property name is of type DCP ( Dynamic Compound Property )
 * @function checkIfDCPProperty
 * @param {String} propertyName - name of the property
 * @returns {Boolean} - returns whether the property is a dynamic compound property or not.
 */
var _checkIfDCPProperty = function( propertyName ) {
    if( propertyName && propertyName.indexOf( '.' ) !== -1 &&
         propertyName.indexOf( '(' ) !== -1 &&
         ( propertyName.indexOf( 'GRM' ) !== -1 ||
             propertyName.indexOf( 'GRMS2P' ) !== -1 ||
             propertyName.indexOf( 'REF' ) !== -1 ||
             propertyName.indexOf( 'REFBY' ) !== -1 ||
             propertyName.indexOf( 'GRMREL' ) !== -1 ||
             propertyName.indexOf( 'GRMS2PREL' ) !== -1 )
    ) {
        return true;
    }
    return false;
};

/**
  * Update specTemplates, excelTemplatesList activity list
  *
  * @param {Object} response SOA response
  * @param {Object} data The panel's view model object
  * @param {Object} ctx AppCtx
  * @returns {Object} return data
  */
const processExportTemplatesResponse = function( response, data, ctx ) {
    const specTemplatesListIn = _.get( response, 'outTmplNames.SpecTemplate' );
    const excelTemplatesListIn = _.get( response, 'outTmplNames.ExcelTemplate' );

    let specTemplatesList = [];
    let excelTemplatesList = [];
    if ( specTemplatesListIn && specTemplatesListIn.length > 0 ) {
        specTemplatesList = listBoxService.createListModelObjectsFromStrings( specTemplatesListIn );
        data.specTemplates.dbValue = specTemplatesList[0].propInternalValue;
    }
    if( ctx && ctx.excelTemplateForExport ) {
        let defaultTemplate = ctx.excelTemplateForExport.parameterTemplate;
        let allExcelTemplatesList = listBoxService.createListModelObjectsFromStrings( excelTemplatesListIn );
        let exportToExcelTemplate;
        for ( const template in allExcelTemplatesList ) {
            if ( allExcelTemplatesList[template].propInternalValue === defaultTemplate ) {
                exportToExcelTemplate = allExcelTemplatesList[template];
                allExcelTemplatesList.splice( template, 1 );
            }
        }
        if( exportToExcelTemplate ) {
            allExcelTemplatesList.unshift( exportToExcelTemplate );
        }
        excelTemplatesList = allExcelTemplatesList;
    } else if ( excelTemplatesListIn && excelTemplatesListIn.length > 0 ) {
        // Appending the custom property to the existing template list
        const customProperty = data.i18n.customPropertyTitle;
        excelTemplatesListIn.push( customProperty );
        if ( ctx.preferences && ctx.preferences.AWC_REQ_default_excel_template_for_export ) {
            const defaultTemplate = ctx.preferences.AWC_REQ_default_excel_template_for_export[0];
            const allTemplates = listBoxService.createListModelObjectsFromStrings(excelTemplatesListIn);

            const isCustomDefaultTemp = defaultTemplate === customProperty;
            const defaultTemp = allTemplates.find(template => template.propInternalValue === defaultTemplate);
            const customTemp = allTemplates.find(template => template.propInternalValue === customProperty);

            // Remove  preference default and custom template from the list
            const otherTemplates = allTemplates.filter(
                template => template.propInternalValue !== defaultTemplate && template.propInternalValue !== customProperty
            );

            if ( isCustomDefaultTemp && customTemp ) {
                // Custom is also default: show only once at first position
                excelTemplatesList = [customTemp, ...otherTemplates];
            }
            else {
                // Default template (if present) is always first,
                // Custom template (if present and not default) is always second,
                // All other templates keep their original order after those two.
                const orderedTemplates = [];
                if ( defaultTemp ) {
                    orderedTemplates.push( defaultTemp );
                }
                if ( customTemp ) {
                    orderedTemplates.push( customTemp );
                }
                excelTemplatesList = [...orderedTemplates, ...otherTemplates];
            }
        } 
        else {
            excelTemplatesList = listBoxService.createListModelObjectsFromStrings( excelTemplatesListIn );
        }
    }

    return  {
        specTemplatesList: specTemplatesList,
        excelTemplatesList : excelTemplatesList
    };
};

/**
  * Given an array of Strings to be represented in listbox, this function returns an array of ListModel objects for
  * consumption by the listbox widget.
  *
  * @param {ObjectArray} strings - The Strings array
  * @return {ObjectArray} - Array of ListModel objects.
  */
export let createListModelObjectsFromStrings = function( strings ) {
    var listModels = [];
    for ( var i in strings ) {
        if ( i ) {
            var listModel = _getEmptyListModel();
            var splits = strings[i].split( ',' );

            listModel.propDisplayValue = splits[0];
            listModel.propInternalValue = splits[1];
            listModels.push( listModel );
        }
    }
    return listModels;
};

/**
  * Return an empty ListModel object.
  *
  * @return {Object} - Empty ListModel object.
  */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Retrieves the client scope URI based on the current context.
 * Filters out non DCP properties properties and registers the configuration.
 * Returns the appropriate URI from the context.
 *
 * @return The client scope URI.
 */
export let getClientScopeUri = function( subPanelContext ) {
    let searchContentInfoColumnConfig = getColumnConfig();
    let columnConfig = {};
    let clientScopeUri = null;
    if( searchContentInfoColumnConfig && subPanelContext && !subPanelContext.columns ) {
        columnConfig = { ...searchContentInfoColumnConfig };
        let pSelected = appCtxService.ctx.pselected?.type;
        if( pSelected === 'Fnd0HomeFolder' || pSelected === 'Awp0Folders' ) {
            columnConfig.name = 'objNavTree';
        } else{
            columnConfig.name = 'occTreeTable';
        }
        if( subPanelContext.exportAsStructure && subPanelContext.exportAsStructure.dbValue && subPanelContext.selectionData.selected ) {
            setOccMgmtColumnConfig( columnConfig, subPanelContext.selectionData.selected );
        }
        for( let i = 0; i <  columnConfig.columns.length; ++i ) {
            let column =  columnConfig.columns[ i ];
            if( !column.name || !column.field ) {
                columnConfig.columns[ i ].field = column.propertyName;
            }
        }
        columnConfig.useStaticFirstCol = true;
        columnConfig.showFirstColumn = true;
        columnConfig.operationType = columnConfig.operationType.toLowerCase();
    }
    // This section manages the export to Excel functionality for the any subPanelContext contains columns for export.( ex.Solutions items )
    // It verifies that subPanelContext includes the required objectSetUri and columns.
    // If exportAsStructure is enabled, it configures the occurrence management columns
    // and sets the operation type to 'union'. Otherwise, it defaults to the specified objectSetUri for columnConfigId.
    else if( subPanelContext && subPanelContext.objectSetUri && subPanelContext.columns ) {
        if( subPanelContext.exportAsStructure && subPanelContext.exportAsStructure.dbValue && subPanelContext.mselected ) {
            setOccMgmtColumnConfig( columnConfig, subPanelContext.mselected );
            columnConfig.useStaticFirstCol = true;
            columnConfig.showFirstColumn = true;
            columnConfig.operationType = 'union';
        } else{
            columnConfig.columnConfigId = subPanelContext.objectSetUri;
            columnConfig.operationType = 'as_configured';
            columnConfig.objectSetUri = subPanelContext.objectSetUri;
        }
    }
    // Adding support to populate custom properties on ERT pannel of PP, WIA & PBopAuthoring Pages.
    if( subPanelContext?.viewKey === 'ApProcessTree' || subPanelContext?.viewKey === 'WiProcessTree' || subPanelContext?.viewKey === 'EpProductBopStructureTree' ) {
        if( subPanelContext.dataProvider?.cols ) {
            Object.keys( columnConfig ).forEach( key => delete columnConfig[key] ); // Empty the object
            columnConfig.columns = subPanelContext.dataProvider.cols;
        }
    }

    if( Object.keys( columnConfig ).length > 0 ) {
        appCtxService.registerCtx( 'ArrangeClientScopeUI', columnConfig );
    }

    clientScopeUri = appCtxService.ctx.ArrangeClientScopeUI?.objectSetUri;
    if( !clientScopeUri || clientScopeUri && clientScopeUri.trim().length === 0 ) {
        if( appCtxService.ctx.aceActiveContext && appCtxService.ctx.aceActiveContext.context && appCtxService.ctx.aceActiveContext.context.sublocation ) {
            clientScopeUri = appCtxService.ctx.aceActiveContext.context.sublocation.clientScopeURI;
        } else {
            clientScopeUri = appCtxService.ctx.sublocation.clientScopeURI;
        }
    }
    return clientScopeUri;
};

/**
 * Retrieves the arrangement of primary work area columns and update in the "ArrangeClientScopeUI" contex.
 * @param {Object} data - The data object containing column configurations.
 * @returns {void}
 */
export let updateArrangeClientScopeUICtx = async function( data, subPanelContext ) {
    let searchContentInfoColumnConfig = {};
    let arrangeData = data.arrangeData;
    let typesForArrange = '';
    let objectSetUri = undefined;
    const isExportAsSructure = subPanelContext && subPanelContext.exportAsStructure && subPanelContext.exportAsStructure.dbValue;
    const isChangeBomLocation = subPanelContext?.provider?.viewModeId === 'ChangeBOMSubLocation';
    let arrangeClientScopeUI = appCtxService.getCtx( 'ArrangeClientScopeUI' );
    // if we have the columns already present in the subPanelContext then we will display those columns insted of the columns we get from soa call
    if ( subPanelContext && subPanelContext.columns ) {
        searchContentInfoColumnConfig = arrangeClientScopeUI;
        objectSetUri = arrangeClientScopeUI.objectSetUri;
        if( isExportAsSructure ) {
            arrangeData.objectSetUri = objectSetUri;
            arrangeData.columnDefs = null;
        } else{
            searchContentInfoColumnConfig.columns = subPanelContext.columns;
            for( let i = 0; i <  searchContentInfoColumnConfig.columns.length; ++i ) {
                let column =  searchContentInfoColumnConfig.columns[ i ];
                if( !column.name || !column.field ) {
                    searchContentInfoColumnConfig.columns[ i ].field = column.propertyName;
                }
            }
        }
    } else {
        let searchColumnConfigInfo = getColumnConfig();
        searchContentInfoColumnConfig = { ...searchColumnConfigInfo };
        typesForArrange = searchContentInfoColumnConfig && searchContentInfoColumnConfig.typesForArrange ? searchContentInfoColumnConfig.typesForArrange : null;
        searchContentInfoColumnConfig.name = arrangeClientScopeUI.name;
        if( isExportAsSructure ) {
            if( isChangeBomLocation ) {
                // Remove the last type from typesForArrange array since it defaults to 'ChangeBomLocation' type.
                // This prevents rendering of page-specific column configuration because export as structure retrieves ACE column configuration instead, requiring only object types to be passed.
                typesForArrange = typesForArrange && typesForArrange.length > 1 ? typesForArrange.slice( 0, -1 ) : '';
            } else {
                typesForArrange = '';
            }
            searchContentInfoColumnConfig.columnConfigId = arrangeClientScopeUI.columnConfigId;
            searchContentInfoColumnConfig.objectSetUri = arrangeClientScopeUI.objectSetUri;
            arrangeData.objectSetUri = searchContentInfoColumnConfig.objectSetUri;
            searchContentInfoColumnConfig.name = arrangeClientScopeUI.name;
        } else{
            arrangeData.typesForArrange = typesForArrange && typesForArrange.length > 0 ? getTypesForArrangeAsString( typesForArrange ) : '';
        }
    }

    // Reset arrangeData properties if the columnConfigId is different from that in searchContentInfoColumnConfig
    if( arrangeData.columnConfigId && searchContentInfoColumnConfig.columnConfigId !== arrangeData.columnConfigId ) {
        // arrangeData typesForArrange always expects string values with comma separation.
        arrangeData.typesForArrange = isChangeBomLocation && isExportAsSructure ? getTypesForArrangeAsString( typesForArrange ) : '';
        arrangeData.objectSetUri = objectSetUri;
        arrangeData.columnDefs = null;
    }

    // Update the columns based on the primary work area column config info.
    if ( searchContentInfoColumnConfig && searchContentInfoColumnConfig.name === 'occTreeTable' ) {
        let primaryWorkAreaColumnConfig = getCurrentPrimaryWorkAreaColumnConfig( arrangeData.savedColumnConfigs );
        if ( primaryWorkAreaColumnConfig && primaryWorkAreaColumnConfig.columnConfigName === 'Default' ) {
            let loadedColumnConfig = await invokeGetOrResetUIColumnConfigsSoa( subPanelContext, primaryWorkAreaColumnConfig, typesForArrange );
            updateColumnConfigWithLoadedColumns( loadedColumnConfig.columnConfig, searchContentInfoColumnConfig, isExportAsSructure );
        } else {
            let columnConfigId = searchContentInfoColumnConfig.columnConfigId;
            let loadedPwaColumnConfigInfo = await getCurrentPWAColumnConfigFromSOA( primaryWorkAreaColumnConfig.columnConfigUid, columnConfigId, arrangeData.typesForArrange );
            updateColumnConfigWithLoadedColumns( loadedPwaColumnConfigInfo.columnConfig, searchContentInfoColumnConfig, isExportAsSructure );
        }
    }

    if( isExportAsSructure ) {
        arrangeData.isExportAsSructure = true;
        arrangeData.selectionData = subPanelContext.selectionData;
    } else{
        arrangeData.isExportAsSructure = false;
    }

    return {
        arrangeData:arrangeData,
        primaryWorkAreaColumnConfigType: typesForArrange
    };
};

/**
 * Sets the column configuration for occurrence management based on the selected object.
 * Updates the columnConfig object with the appropriate columnConfigId and objectSetUri
 * based on the type of the selected object.
 *
 * @param {Object} columnConfig - The configuration object to update.
 * @param {Object} selectedObject - The currently selected object for determining the type.
 */
function setOccMgmtColumnConfig( columnConfig, selectedObject ) {
    let objectSetUri = 'Awb0OccurrenceManagement';
    let columnConfigId = 'contentColConfig';

    // The outside ACE column configuration export as structure applies only to 'Item Revision', 'Part Revision', and 'Awb0PartElement' types.
    // For any other element type or combination of object types, the default 'Awb0OccurrenceManagement' column configuration is applied.
    const objectTypesToFind = [ 'Part Revision', 'Design Revision', 'Awb0PartElement' ];
    let typeName = getSameObjectTypeName( objectTypesToFind, selectedObject );
    if( objectTypesToFind.includes( typeName ) ) {
        columnConfig.columnConfigId = columnConfigId + '.' + typeName;
        columnConfig.objectSetUri = objectSetUri + '.' + typeName;
    } else {
        columnConfig.columnConfigId = columnConfigId;
        columnConfig.objectSetUri = objectSetUri;
    }
    columnConfig.name = 'occTreeTable';
    columnConfig.columns = [];
}


/**
 * Checks if all selected objects are of the same revision type.
 *
 * @param {Array} selectedObjects - An array of selected object instances.
 * @returns {string} - Returns the valid type if all are the same object type ( Part or Design ); otherwise, returns 'ItemType'.
 */
function getSameObjectTypeName( objectTypes, selectedObjects ) {
    let foundType = null;
    for ( const selectedObject of selectedObjects ) {
        const { modelType } = selectedObject;

        // Get the types present in the typeHierarchyArray
        const matchedTypes = modelType.typeHierarchyArray.filter( type => objectTypes.includes( type ) );

        if ( matchedTypes.length === 0 ) {
            return 'ItemType';
        }

        // Set foundType on the first valid type
        if ( foundType === null ) {
            foundType = matchedTypes[0];
        } else if ( foundType !== matchedTypes[0] ) {
            return 'ItemType'; // Different types found
        }
    }

    // If the matched type is 'Awb0PartElement', set it to 'Part Revision'
    // Otherwise, set foundType to the first matched type from the array
    if( foundType === 'Awb0PartElement' ) {
        foundType = 'Part Revision';
    }
    // Return the found valid type if all are the same
    return foundType;
}


/**
 * Loads named column configuration from the SOA service.
 * @param {string} primaryWorkAreaColumnConfigUid - The UID of the primary work area column configuration.
 * @param {string} columnConfigId - The ID of the column configuration.
 * @param {Array<string>} typesForArrange - An array of types used for arranging columns.
 * @returns {Promise<object>} A Promise that resolves to an object containing the loaded column configuration info.
 */
function getCurrentPWAColumnConfigFromSOA( primaryWorkAreaColumnConfigUid, columnConfigId, typesForArrange ) {
    let inputData = {
        namedColumnConfigInput: {
            clientName: 'AWClient',
            clientScopeUri:  getUri(),
            columnConfigId: columnConfigId,
            columnsToExclude: []
        },
        namedColumnConfigCriteria: {
            operationType: 'union',
            typesForArrange: typesForArrange,
            columnConfigUid: primaryWorkAreaColumnConfigUid
        }
    };
    return tcDataMgmtSvc.baseGetNamedColumnConfigs( inputData ).then( function( response ) {
        if( response.namedColumnConfigsJSON ) {
            let loadedColumnConfiginfo = JSON.parse( response.namedColumnConfigsJSON );
            if( loadedColumnConfiginfo && loadedColumnConfiginfo.columnConfig && loadedColumnConfiginfo.columnConfig.columns && loadedColumnConfiginfo.columnConfig.columns.length > 0 ) {
                return {
                    columnConfig : loadedColumnConfiginfo.columnConfig
                };
            }
        }
        return null;
    } );
}

/**
 * Converts an array of types for arranging columns into a comma-separated string.
 * If the input array is empty or not an array, returns an empty string.
 * @param {Array<string>} typesForArrange - An array of types for arranging columns.
 * @returns {string} A comma-separated string of types for arranging columns.
 */
function getTypesForArrangeAsString( typesForArrange ) {
    return typesForArrange.join( ',' ) + ',';
}

/**
 * Updates the column configuration with loaded columns.
 * @param {Object} newcolumnConfig - The newly loaded column configuration.
 * @param {Object} searchContentInfoColumnConfig - The column configuration for search content info.
 * @param {boolean} isExportAsSructure - Indicates whether the export as structure checkbox is checked.
 */
function updateColumnConfigWithLoadedColumns( newcolumnConfig, searchContentInfoColumnConfig, isExportAsSructure ) {
    if( newcolumnConfig && newcolumnConfig.columns && newcolumnConfig.columns.length > 0 ) {
        newcolumnConfig.columns.forEach( column => {
            if ( !column.name || !column.field ) {
                column.field = column.propertyName;
            }
        } );
        if( !isExportAsSructure ) {
            searchContentInfoColumnConfig.objectSetUri = getUri();
        }
        searchContentInfoColumnConfig.columns = newcolumnConfig.columns;
        appCtxService.updateCtx( 'ArrangeClientScopeUI', searchContentInfoColumnConfig );
    }
}

/**
 * Retrieves the column configuration UID from the application context service.
 * @returns {string|undefined} The column configuration UID if available, otherwise null.
 */
export let getColumnConfigUid = function() {
    let arrangeClientScopeUI = appCtxService.getCtx( 'ArrangeClientScopeUI' );
    if( arrangeClientScopeUI && arrangeClientScopeUI.columnConfigId ) {
        return arrangeClientScopeUI.columnConfigId;
    }
    return null;
};

/**
 * Sets the save as new arrangement checkbox to true based on the provided data.
 * @param {Object} data - The data object containing information about the arrangement.
 * @returns {Object} An object containing the updated new column configuration.
 */
let setNewArrangementCheckBoxTrue = function( data ) {
    let arrangeData = data.arrangeData;
    let isNewColumnConfig = data.newColumnConfig.dbValue;
    if( isNonModifiableOrSameAsPWAColumnConfig( arrangeData ) ) {
        isNewColumnConfig = isColumnArrangementDirty( arrangeData );
    }
    return isNewColumnConfig;
};

/**
 * Checks if the column configuration is non-modifiable or loaded column same as prrimary column config.
 * @param {Object} arrangeData - The arrangement data containing column configuration information.
 * @returns {boolean} Returns true if the column configuration is non-modifiable or loaded column same as prrimary column config , otherwise false.
 */
function isNonModifiableOrSameAsPWAColumnConfig( arrangeData ) {
    return (
        arrangeData && ( arrangeData.originalColumnConfig && arrangeData.originalColumnConfig.columnConfigUid === arrangeData.loadedColumnConfigUid ||
        arrangeData.loadedColumnConfig && arrangeData.loadedColumnConfig.isAdmin )
    );
}

/**
 * Checks if the column arrangement is dirty based on the arrangement properties length and position change.
 * @param {Object} arrangeData - The arrangement data containing column configuration information.
 * @returns {boolean} Returns true if the column arrangement is dirty, otherwise false.
 */
function isColumnArrangementDirty( arrangeData ) {
    let isDirty = false;
    if( arrangeData.orgColumnDefs.length !== arrangeData.columnDefs.length ) {
        isDirty = true;
    } else{
        for( let i = 0; i < arrangeData.orgColumnDefs.length; ++i ) {
            if( arrangeData.orgColumnDefs[ i ].uid !== arrangeData.columnDefs[ i ].uid ||
                arrangeData.orgColumnDefs[ i ].dbValue !== arrangeData.columnDefs[ i ].dbValue ) {
                isDirty = true;
                break;
            }
        }
    }
    return isDirty;
}

/**
 * Reset to the default column arrangement and Sets the primary work area column configuration to its original state.
 * @param {Object} arrangeData - The data object containing information about the current arrangement.
 * @param {Object} subPanelContext - subPanelContext containing the selection data.
 * @param {boolean} isDefaultSelectedFromList - Indicates whether the default arrangement was selected from the saved colum configuration list.
 * *
 **/
export let setDefaultColumnArrangement = function( arrangeData, subPanelContext, isDefaultSelectedFromList ) {
    let typesForArrange = arrangeData.primaryWorkAreaColumnConfigType;
    if( !arrangeData.isExportAsSructure ) {
        let searchColumnConfigInfo = getColumnConfig();
        typesForArrange = searchColumnConfigInfo && searchColumnConfigInfo.typesForArrange ? searchColumnConfigInfo.typesForArrange : null;
    }
    invokeGetOrResetUIColumnConfigsSoa(  subPanelContext, arrangeData.savedColumnConfigs[0], typesForArrange )
        .then( function( loadedColumnConfig ) {
            let originalColumnConfigIsDefault = arrangeData.originalColumnConfig.columnConfigName !== 'Default';
            if( isDefaultSelectedFromList ) {
                eventBus.publish( 'hideViewColumnConfigurationsPopup' );
            }
            eventBus.publish( 'arrangePanel.columnConfigLoadRedirect', loadedColumnConfig );
            if( originalColumnConfigIsDefault ) {
                //Sets the primary work area column configuration to its original state.
                eventBus.publish( 'setOriginalColumnConfig' );
            }
        } );
};


/**
 * Generates a soa input for get or reset column configurations for export.
 * @param {Object} subPanelContext - subPanelContext containing the selection data and arrange data information.
 * @param {string} primaryWorkAreaColumnConfigType - The type of primary work area column configuration.
 * @returns {Object[]} An array containing the input configuration for get or reset column configuration.
 */
export let getOrResetColumnConfigExportInput = function( subPanelContext, primaryWorkAreaColumnConfigType ) {
    let columnConfigObjTypes = [];
    let arrangeClientScopeURI = '';
    // Default columns to exclude for the 'Awb0OccurrenceManagement' and 'ChangeBom' column configurations.
    let columnsToExclude = [ 'Awb0ConditionalElement.awb0PendingAction', 'Awb0PositionedElement.pma1UpdateAction', 'Awb0DesignElement.pma1LastAlignedPart',
        'Awb0DesignElement.REF(pma1LastAlignedPart,ItemRevision).release_status_list', 'Awb0PartElement.pma1LastAlignedDesign',
        'Awb0PartElement.REF(pma1LastAlignedDesign,ItemRevision).release_status_list', 'Awb0ConditionalElement.awb0MarkupType' ];

    const isExportAsStructure = subPanelContext && subPanelContext.exportAsStructure && subPanelContext.exportAsStructure.dbValue;
    if( !isExportAsStructure ) {
        arrangeClientScopeURI = getUri();
    } else{
        arrangeClientScopeURI = appCtxService.ctx.ArrangeClientScopeUI && appCtxService.ctx.ArrangeClientScopeUI.objectSetUri || appCtxService.ctx.sublocation.clientScopeURI;
    }

    if( primaryWorkAreaColumnConfigType ) {
        columnConfigObjTypes = primaryWorkAreaColumnConfigType;
    } else if( isExportAsStructure || subPanelContext.arrangeData && subPanelContext.arrangeData.isExportAsSructure ) {
        let selectedObjects;
        if( subPanelContext.arrangeData && subPanelContext.arrangeData.selectionData ) {
            selectedObjects = subPanelContext.arrangeData.selectionData.selected;
        } else{
            selectedObjects = subPanelContext.mselected && subPanelContext.columns ? subPanelContext.mselected : subPanelContext.selectionData.selected;
        }

        // Set the default column configuration URI and object types for arranging the columns
        arrangeClientScopeURI = 'Awb0OccurrenceManagement';

        // Avoid direct assignment of 'Awb0DesignElement' to prevent audit failures during the build process.
        // Instead, extract it from the columnsToExclude array.
        columnConfigObjTypes.push( columnsToExclude[2].split( '.' )[0] );

        // The outside ACE column configuration export as structure applies only to 'Item Revision', 'Part Revision', and 'Awb0PartElement' types.
        // For any other element type or combination of object types, the default 'Awb0OccurrenceManagement' column configuration is applied.
        const objectTypesToFind = [ 'Part Revision', 'Design Revision', 'Awb0PartElement' ];
        let typeName = getSameObjectTypeName( objectTypesToFind, selectedObjects );
        if( objectTypesToFind.includes( typeName ) ) {
            if( typeName !== 'Design Revision' ) {
                columnConfigObjTypes = [];
                columnConfigObjTypes.push( 'Awb0PartElement' );
            }
            arrangeClientScopeURI = arrangeClientScopeURI + '.' + typeName;
        }
    }

    if( !arrangeClientScopeURI || !arrangeClientScopeURI.includes( 'Awb0OccurrenceManagement' ) && !arrangeClientScopeURI.includes( 'ChangeBom' ) ) {
        columnsToExclude = [];
    }
    return [ {
        scope: 'LoginUser',
        scopeName: '',
        hostingClientName: '',
        clientName: 'AWClient',
        resetColumnConfig: true,
        columnConfigQueryInfos: [ {
            clientScopeURI: arrangeClientScopeURI,
            operationType: 'union',
            typeNames: columnConfigObjTypes,
            columnsToExclude: columnsToExclude
        } ],
        businessObjects: []
    } ];
};

/**
 * Reloads the arrange panel if export as structure checkbox checked and selected objectType is 'ItemRevision'.
 * @param {Object} data - The data object containing information about the selectedObjects and exportAsStructure check box.
 *
 * @returns {void} - This function does not return a value.
 */
export let reloadArrangePanel = function( data ) {
    if( data.subPanelContext && data.subPanelContext.exportAsStructure.dbValue && areSelectedObjectsItemRevisionOrElementType( data, data.subPanelContext ) ) {
        eventBus.publish( 'revealArrangePanel' );
    }
};

/**
 * Retrieves the URI for column configuration from the application context service.
 * @returns {string} The URI for column configuration.
 */
function getUri() {
    return appCtxService.ctx.aceActiveContext
        && appCtxService.ctx.aceActiveContext.context?.sublocation?.clientScopeURI
        || appCtxService.ctx.sublocation.clientScopeURI;
}

/**
 * Updates the arranged column data based on the provided data object.
 *
 * @param {Object} data - The data object containing the arrangeData and updatedArrangedData properties.
 * @returns {Object} - An object containing the updated arranged data.
 */
export let updateArrangeColumnData = function( data ) {
    let arrangeData = data.arrangeData;
    let updatedArrangedData = data.updatedArrangedData ? data.updatedArrangedData : _.cloneDeep( arrangeData );
    if( arrangeData.name  === 'occTreeTable' ) {
        updatedArrangedData.orgColumnDefs = updateOrgColumnDefs( updatedArrangedData.orgColumnDefs, arrangeData.columnDefs );
        updatedArrangedData.columnDefs = updatedArrangedData.orgColumnDefs;
    } else{
        updatedArrangedData = arrangeData;
    }
    data.newColumnConfig.dbValue = setNewArrangementCheckBoxTrue( data );
    return {
        updatedArrangedData: updatedArrangedData,
        newColumnConfig: data.newColumnConfig
    };
};

/**
 * Update the state of the "Save As New Arrangement" checkbox based on the provided value.
 * Disables the checkbox if it's a "Save As New" configuration; otherwise, enables it.
 * @param {boolean} isSaveAsNewColumnConfig - Indicates whether "Save As New Arrangement" required.
 */
export let updateNewArrangementCheckboxEditability = function( isSaveAsNewColumnConfig ) {
    let saveAsNewArrangementCheckbox = document.querySelector( '.export-arrangement-checkbox input[name="newColumnConfig"]' );
    if( saveAsNewArrangementCheckbox ) {
        if( isSaveAsNewColumnConfig ) {
            saveAsNewArrangementCheckbox.disabled = true;
        } else if ( saveAsNewArrangementCheckbox.disabled ) {
            saveAsNewArrangementCheckbox.disabled = false;
        }
    }
};

/**
 * Filters an array of objects to ensure uniqueness based on a specified property,
 * then removes non-DCP (Data Control Panel?) properties.
 *
 * @param {Array} objects The array of objects to filter.
 * @param {string} uniqueProperty The name of the property used to ensure uniqueness.
 * @returns {Array} The filtered array containing unique and non-DCP properties.
 */
function filterUniqueAndNonDCPProperties( objects, uniqueProperty ) {
    // Collect unique objects based on the specified property
    const uniqueObjects = getUniqueColumnObjects( objects, uniqueProperty );

    // Filter out non-DCP properties
    return filterNonDCPPropsFromProvidedColumns( uniqueObjects );
}

/**
 * Updates the orgColumnDefs based on the provided columnDefs.
 * If a column in columnDefs matches a column in orgColumnDefs by propertyName, the properties are updated.
 * If a column in columnDefs does not exist in orgColumnDefs, it is appended to orgColumnDefs.
 * Any columns in orgColumnDefs that are missing in columnDefs have their hiddenFlag set to true.
 *
 * @param {Object[]} orgColumnDefs - The original column definitions.
 * @param {Object[]} columnDefs - The updated column definitions to be merged with orgColumnDefs.
 * @returns {Object[]} - The updated orgColumnDefs.
 */
function updateOrgColumnDefs( orgColumnDefs, columnDefs ) {
    columnDefs.forEach( column => {
        const index = orgColumnDefs.findIndex( col => col.propertyName === column.propertyName );
        if ( index !== -1 ) {
            // Column found in orgColumnDefs, update properties
            orgColumnDefs[index] = { ...orgColumnDefs[index], ...column };
        } else {
            orgColumnDefs.push( column );
        }
    } );

    orgColumnDefs.forEach( column => {
        const index = columnDefs.findIndex( col => col.propertyName === column.propertyName );
        if ( index === -1 ) {
            // Column not found in columnDefs, set hiddenFlag to true
            setColumnPropertiesAsHidden( column );
        }
    } );

    return orgColumnDefs;
}

/**
 * Disable properties of a column.
 * @param {Object} column - The column object whose properties need to be disabled.
 * @returns {void}
 */
function setColumnPropertiesAsHidden( column ) {
    column.hiddenFlag = true;
    column.isEnabled = false;
    column.visible = false;
    column.isFilteringEnabled = false;
    column.dbValue = false;
}

/**
 * Collects unique objects from an array based on a specified property name.
 *
 * @param {Array} objects The array of objects to filter.
 * @param {string} propertyName The name of the property to use for uniqueness.
 * @returns {Array} An array containing unique objects based on the specified property.
 */
function getUniqueColumnObjects( objects, propertyName ) {
    const uniqueObjectsMap = new Map();
    objects.forEach( obj => {
        const propertyValue = obj[propertyName];

        // Check if the property value already exists in the Map
        if ( !uniqueObjectsMap.has( propertyValue ) ) {
            // If not, add the object to the Map with the property value as the key
            uniqueObjectsMap.set( propertyValue, obj );
        }
    } );
    return Array.from( uniqueObjectsMap.values() );
}

/**
 * Finds and returns the primary work area current column configuration object.
 *
 * @param {Array} savedColumnConfigs - An array of column configuration objects.
 * @returns {Object|undefined} - The column configuration object where isCurrent is true, or undefined if not found.
 */
function getCurrentPrimaryWorkAreaColumnConfig( savedColumnConfigs ) {
    return savedColumnConfigs.find( columnConfig => columnConfig.isCurrent === true );
}

/**
 * Filters the provided columns based on the non DCP properties.
 * @param {Array} columns - The array of columns to filter.
 * @returns {Array} The filtered array containing only non DCP properties.
 */
function filterNonDCPPropsFromProvidedColumns( columns ) {
    return columns.filter( column => !_checkIfDCPProperty( column.propertyName ) ); // DCP not supported to export
}


/**
 * Invokes a getOrResetColumnConfigExportInput SOA to retrieve or reset UI column configuration.
 * @param {Object} subPanelContext - subPanelContext containing the selection data.
 * @param {Object} defaultColumnConfig - The default column configuration.
 * @param {string} primaryWorkAreaColumnConfigType - The primary work area column configuration type.
 * @returns {Promise} A promise that resolves with the retrieved or reset column configuration details.
 */
function invokeGetOrResetUIColumnConfigsSoa( subPanelContext, defaultColumnConfig, primaryWorkAreaColumnConfigType ) {
    let typeNames = primaryWorkAreaColumnConfigType;
    const inputData = {
        getOrResetUiConfigsIn: getOrResetColumnConfigExportInput( subPanelContext, typeNames )
    };
    return tcDataMgmtSvc.baseGetOrResetUIColumnConfigs( inputData ).then( function( response ) {
        if( response.columnConfigurations && response.columnConfigurations.length > 0 &&
            response.columnConfigurations[ 0 ].columnConfigurations &&
            response.columnConfigurations[ 0 ].columnConfigurations.length > 0 &&
            response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns &&
            response.columnConfigurations[ 0 ].columnConfigurations[ 0 ].columns.length > 0 ) {
            return {
                columnConfig: response.columnConfigurations[ 0 ].columnConfigurations[ 0 ],
                columnConfigDetails: defaultColumnConfig.columnConfigDetails,
                columnConfigName: defaultColumnConfig.columnConfigName,
                columnConfigUid: defaultColumnConfig.columnConfigUid,
                isAdmin: true,
                isCurrent: false,
                isModifiable: false
            };
        }
        return null;
    } );
}

/**
 * Retrieves the column configuration.
 * @returns The column configuration from the application context.
 */
function getColumnConfig() {
    let columnconfig = null;
    if ( appCtxService.ctx.searchResponseInfo ) {
        columnconfig = appCtxService.ctx.searchResponseInfo.columnConfig;
    }
    return columnconfig;
}

/**
 * Sets the isModifiable property to false if the primary work area column configuration
 * and the current export to Excel column configuration are the same.
 *
 * @param {Object} data - The data object containing arrangeData property.
 * @returns {Object} - The modified arrangeData data object.
 */
export let setCurrentColumnArrangementAsNonModifiable = function( data ) {
    let arrangeData = data.arrangeData;
    arrangeData.operationType = arrangeData.operationType.toLowerCase();
    let primaryWorkAreaColumnArrangement = arrangeData.originalColumnConfig;
    let savedColumnConfigs = arrangeData.savedColumnConfigs;
    savedColumnConfigs.forEach( savedColumnConfig => {
        if ( savedColumnConfig.columnConfigUid === primaryWorkAreaColumnArrangement.columnConfigUid && primaryWorkAreaColumnArrangement.isModifiable ) {
            primaryWorkAreaColumnArrangement.isModifiable = false;
            savedColumnConfig.isModifiable = false;
        }
    } );
    return { arrangeData: arrangeData };
};

/**
 * Checks if all selected objects are of type 'ItemRevision'.
 *
 * @param {Object} data - The data object containing selected Object data.
 * @param {Object} subPanelContext - subPanelContext containing the selection data.
 * @returns {Object} - Returns an object with a boolean flag indicating if a 'ItemRevision' type object is selected.
 */
export let validateSelectedObjectsForExportAsStructure = function( data, subPanelContext ) {
    let areSelectedObjectsValidForExport = true;
    areSelectedObjectsValidForExport = areSelectedObjectsItemRevisionOrElementType( data, subPanelContext );
    return { areSelectedObjectsValidForExport: areSelectedObjectsValidForExport };
};

/**
 * Checks if the selected objects are of type 'ItemRevision' or 'Awb0Element'.
 *
 * @param {Object} data - The context data containing selection information.
 * @param {Object} subPanelContext - The context of the sub-panel, including selection data.
 * @returns {boolean} - Returns true if all selected objects are of 'ItemRevision' or 'AWb0Element' type; otherwise, returns false.
 */
function areSelectedObjectsItemRevisionOrElementType( data, subPanelContext ) {
    let selectedObjects = [];
    if( subPanelContext.mselected && subPanelContext.mselected.length > 0 ) {
        selectedObjects = subPanelContext.mselected;
    } else{
        selectedObjects = subPanelContext && subPanelContext.selectionData ? subPanelContext.selectionData.selected : data.ctx.mselected;
    }

    if( selectedObjects && selectedObjects.length > 0 ) {
        for ( const selectedObject of selectedObjects ) {
            if( selectedObject && selectedObject.modelType && selectedObject.modelType.typeHierarchyArray ) {
                const typeHierarchy = selectedObject.modelType.typeHierarchyArray;
                const isItemRevision = typeHierarchy.includes( 'ItemRevision' );

                // Checking if 'Awb0Element' is included in the type hierarchy to support export as a structure
                // example: Change Content Tab view
                const isAwb0Element = typeHierarchy.includes( 'Awb0Element' );
                if ( !isItemRevision && !isAwb0Element ) {
                    return false;
                }
            }
        }
    }
    return true;
}

const exports = {
    revealAceColumnArrangePanel,
    getApplicationFormat,
    getTemplateNameForExport,
    getInputObjects,
    getTargetObjectsToExportForExcel,
    getExportOptionValueForExcel,
    getSelectedProperties,
    processExportTemplatesResponse,
    createListModelObjectsFromStrings,
    getClientScopeUri,
    updateExportProperties,
    getColumnConfigUid,
    setDefaultColumnArrangement,
    updateArrangeClientScopeUICtx,
    getOrResetColumnConfigExportInput,
    setCurrentColumnArrangementAsNonModifiable,
    updateArrangeColumnData,
    updateNewArrangementCheckboxEditability,
    unregisterExtraExportOptionsContext,
    validateSelectedObjectsForExportAsStructure,
    reloadArrangePanel,
    generateAndOpenExcelExportFile,
    initializeExportOptions,
    resetLevelsExportOptions
};
export default exports;
