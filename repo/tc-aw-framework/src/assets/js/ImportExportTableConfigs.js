// Copyright (c) 2024 Siemens

/**
 * Module for the ImportExportTableConfigs
 *
 * @module js/ImportExportTableConfigs
 */
import dateTimeService from 'js/dateTimeService';

const DATE_FORMAT = 'yyyy-MM-dd_HH-mm-ss';

/**
 * Returns the export options required for exportTableConfigurations SOA.
 * @param {Object} data - viewModel data
 * @param {Object} props - props
 * @returns {Object} Returns the export options.
 */
let getExportOptions = function( data, props ) {
    let exportOptions = {};
    let selectedScope = data?.atomicData?.scopeState?.columnConfigScope?.columnConfigScopeObject?.dbValue;
    let selectedListItem = data?.atomicData?.scopeState?.selectedListItem?.dbValue;
    if( selectedScope === 'Group' && selectedListItem ) {
        exportOptions.scope = 'group';
        exportOptions.scopeName = selectedListItem;
    } else if( selectedScope === 'Role' && selectedListItem ) {
        exportOptions.scope = 'role';
        exportOptions.scopeName = selectedListItem;
    } else if( selectedScope === 'Workspace' && selectedListItem ) {
        exportOptions.scope = 'workspace';
        exportOptions.scopeName = selectedListItem;
    }
    if( data?.exportSelectedAsDefault?.dbValue === 'Export Selected' && props?.subPanelContext?.selectionData?.selected?.length  === 1 ) {
        let selected = props.subPanelContext.selectionData.selected[0];
        let typeDisplayName = selected?.props?.typeDisplayName?.dbValue;
        if( selected?.type !== 'Fnd0ClientScope' && typeDisplayName !== 'Site' &&  typeDisplayName !== 'Group' && typeDisplayName !== 'Role' && typeDisplayName !== 'Workspace' ) {
        /** Client sends tableConfigId in multiple formats.
        Format 1: T3gZEKGS5CMrBA::Site::gYkZEKur5CMrBA - The first uid is client scope uid. For site, uid will not be sent. The last uid is column config uid which is named or unnamed.
        Format 2: T3gZEKGS5CMrBA::AOoZUisG5CMrBA::gYkZEKur5CMrBA  - First uid is client scope uid. Second one is scope uid which can be group, role like that.
        Last one is column config uid which is named or unnamed.
        Format 3: If there is only one uid without :: as delimitor, then it is just client scope uid.
        */
            exportOptions.tableConfigId = selected?.uid;
        }
    }
    return exportOptions;
};

/**
 * Returns the import options required for importTableConfigurations SOA.
 * @param {Object} data - viewModel data
 * @returns {Object} Returns the import options.
 */
let getImportOptions = function( data ) {
    let importOptions = {};
    let selectedScope = data?.atomicData?.scopeState?.columnConfigScope?.columnConfigScopeObject?.dbValue;
    let selectedListItem = data?.atomicData?.scopeState?.selectedListItem?.dbValue;
    if( selectedScope === 'Group' && selectedListItem ) {
        importOptions.scope = 'group';
        importOptions.scopeName = selectedListItem;
    } else if( selectedScope === 'Role' && selectedListItem ) {
        importOptions.scope = 'role';
        importOptions.scopeName = selectedListItem;
    } else if( selectedScope === 'Workspace' && selectedListItem ) {
        importOptions.scope = 'workspace';
        importOptions.scopeName = selectedListItem;
    }
    if( data?.importAction?.dbValue ) {
        importOptions.action = data.importAction.dbValue.toLowerCase();
    }
    return importOptions;
};

/**
 * Prepares the filename for use by fmsTicket returned.
 * @param {Object} response - SOA response.
 * @param {Object} data - viewModel data
 * @param {Object} props - props
 * @returns {string} Returns the export file name.
 */
// First parameter response is automatically included for SOA actions but not required for this method.
let getExportTableConfigsFileName = function( response, data, props ) {
    let fileName = '';
    let rootNodeType = false;
    let selected = props?.subPanelContext?.selectionData?.selected;
    if( selected?.length  === 1 ) {
        let typeDisplayName = selected[0]?.props?.typeDisplayName?.dbValue;
        if( selected[0]?.type === 'Fnd0ClientScope' || typeDisplayName === 'Site' ||  typeDisplayName === 'Group' || typeDisplayName === 'Role' || typeDisplayName === 'Workspace' ) {
            rootNodeType = true;
        }
    }
    if( data?.exportSelectedAsDefault?.dbValue === 'Export All' || selected?.length === 0 || rootNodeType ) {
        let selectedScope = data?.atomicData?.scopeState?.columnConfigScope?.columnConfigScopeObject?.dbValue;
        if( selectedScope ) {
            fileName += selectedScope + '_';
        }
        let selectedListItem = data?.atomicData?.scopeState?.selectedListItem?.dbValue;
        if( selectedListItem ) {
            fileName += selectedListItem + '_';
        }
    } else if( data?.exportSelectedAsDefault?.dbValue === 'Export Selected' && selected?.length  === 1 ) {
        if( selected[0]?.type !== 'Fnd0ClientScope' && selected[0]?.props?.clientScopeUri?.uiValue ) {
            fileName += selected[0].props.clientScopeUri.uiValue + '_';
        }
        if( selected[0]?.props?.scope?.uiValue ) {
            fileName += selected[0].props.scope.uiValue + '_';
        }
        fileName += selected[0].displayName + '_';
    }
    fileName += dateTimeService.formatNonStandardDate( new Date(), DATE_FORMAT );
    fileName += '.xml';
    return fileName;
};

/**
 * Prepares the filename for use by fmsTicket returned.
 * @param {Object} response - SOA response.
 * @param {Object} commandContext - command context
 * @returns {string} Returns the export file name.
 */
// First parameter response is automatically included for SOA actions but not required for this method.
let getExportTableConfigsContextMenuFileName = function( response, commandContext ) {
    let fileName = '';
    let selected = commandContext?.selected?.[0];
    if( selected?.type !== 'Fnd0ClientScope' && selected?.props?.clientScopeUri?.uiValue ) {
        fileName += selected.props.clientScopeUri.uiValue + '_';
    }
    if( selected?.props?.scope?.uiValue ) {
        fileName += selected.props.scope.uiValue + '_';
    }
    if( selected?.displayName ) {
        fileName += selected.displayName + '_';
    }
    fileName += dateTimeService.formatNonStandardDate( new Date(), DATE_FORMAT );
    fileName += '.xml';
    return fileName;
};

/**
 * Prepares the filename for use by fmsTicket returned.
 * @param {Object} selectionData - selection data
 * @returns {string} The selected object hierarchy name.
 */
let getSelectedObjHierarchyName = function( selectionData ) {
    let selectedObjHeirarchyName = '';
    let selected = selectionData?.selected?.[0];
    if( selected?.type !== 'Fnd0ClientScope' && selected?.props?.clientScopeUri?.uiValue ) {
        selectedObjHeirarchyName += selected.props.clientScopeUri.uiValue + '.';
    }
    if( selected?.props?.scope?.uiValue ) {
        selectedObjHeirarchyName += selected.props.scope.uiValue + '.';
    }
    if( selected?.displayName ) {
        selectedObjHeirarchyName += selected.displayName;
    }
    return selectedObjHeirarchyName;
};

/**
 * Prepares the filename for use by fmsTicket returned.
 * @param {Object} response - SOA response.
 * @param {Object} data - viewModel data
 * @returns {string} Returns the import log file name.
 */
// First parameter response is automatically included for SOA actions but not required for this method.
let getImportTableConfigsLogFilename = function( response, data ) {
    let fileName = 'Import_';
    let selectedScope = data?.atomicData?.scopeState?.columnConfigScope?.columnConfigScopeObject?.dbValue;
    if( selectedScope ) {
        fileName += selectedScope + '_';
    }
    let selectedListItem = data?.atomicData?.scopeState?.selectedListItem?.dbValue;
    if( selectedListItem ) {
        fileName += selectedListItem + '_';
    }
    fileName += dateTimeService.formatNonStandardDate( new Date(), DATE_FORMAT );
    fileName += '.log';
    return fileName;
};

const exports = {
    getExportOptions,
    getImportOptions,
    getExportTableConfigsFileName,
    getExportTableConfigsContextMenuFileName,
    getSelectedObjHierarchyName,
    getImportTableConfigsLogFilename
};
export default exports;
