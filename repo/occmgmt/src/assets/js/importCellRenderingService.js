//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 define
 */

/**
 *
 * @module js/importCellRenderingService
 */
import _ from 'lodash';
import localeService from 'js/localeService';
import tableSvc from 'js/splmTablePublishedService';

let exports = {};
let localeTextBundle = localeService.getLoadedText( 'OccmgmtImportExportConstants' );

/**
 * API will return the class value as per action column's ui value. If value is new or something we
 * do not support then empty string would be returned.
 * @param {*} actionUIValue UI value for action column.
 */
let getCSSClassForColor = function( actionUIValue ) {
    switch( actionUIValue ) {
        case localeTextBundle.aceImportPreviewNewAction:
            return 'aw-importexport-actionNewColor';
        case localeTextBundle.aceImportPreviewReviseContentMenu:
            return 'aw-importexport-actionReviseColor';
        case localeTextBundle.aceImportPreviewOverwriteContentMenu:
            return 'aw-importexport-actionOverwriteColor';
        case localeTextBundle.aceImportPreviewReferenceContentMenu:
            return 'aw-importexport-actionReferece';
        default :
            return '';
    }
};

/**
 * Set background color for New in Action Column of Preview
 */
let _colorForActionColumnCellRenderer = {
    action: function( column, vmo, tableElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( 'aw-importexport-cellTop' );
        cellContent.childNodes[0].classList.add( 'aw-importexport-tableCellText' );
        let classForActionColor = getCSSClassForColor( vmo.props[column.propertyName].uiValue );
        if( classForActionColor ) {
            cellContent.classList.add( classForActionColor );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        if( ( _.isEqual( column.propertyName, 'preview_action' )
            || _.isEqual( column.propertyName, localeTextBundle.actionColumn ) )
            && vmo.props
            && vmo.props[column.propertyName]
            && vmo.props[column.propertyName].uiValue ) {
            return true;
        }
        return false;
    },
    name: 'colorForActionColumnCellRenderer'
};

/**
 * Set Release Status icon in 'Release Status' Column of Preview
 */
let _importReleaseStatusIcon = {
    action: function( column, vmo, tableElem ) {
        let toolTip = vmo.props[column.propertyName].dbValue[0];
        vmo.props[column.propertyName].uiValue = '';
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( 'aw-importexport-releaseStatusIcon' );
        cellContent.title = toolTip;
        return cellContent;
    },
    condition: function( column, vmo ) {
        let propName = column.propertyName;
        if( ( _.isEqual( column.propertyName, 'preview_releaseStatus' )
            || _.isEqual( column.propertyName, localeTextBundle.releaseStatusColumnName ) )
            && vmo.props
            && vmo.props[propName].dbValue
            && vmo.props[propName].dbValue.length > 0
            && vmo.props[propName].dbValue[0] !== undefined
            && vmo.props[propName].dbValue[0].length > 0 ) {
            return true;
        }
        return false;
    },
    name: 'importReleaseStatusIcon'
};

/**
 * Add warning icon for 'Teamcenter Information' Column
 */
let _warningIconForTcInformation = {
    action: function( column, vmo, tableElem ) {
        let toolTip = vmo.props[column.propertyName].dbValue[0];
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( 'aw-importexport-warningIcon' );
        cellContent.title = toolTip;
        return cellContent;
    },
    condition: function( column, vmo ) {
        let propName = column.propertyName;
        if( ( _.isEqual( column.propertyName, 'preview_teamcenterinfo' )
            || _.isEqual( column.propertyName, localeTextBundle.tcInformationColumn ) )
            && vmo.props
            && vmo.props[propName].dbValue
            && vmo.props[propName].dbValue.length > 0
            && vmo.props[propName].dbValue[0] !== undefined
            && vmo.props[propName].dbValue[0].length > 0 ) {
            return true;
        }
        return false;
    },
    name: 'warningIconForTcInformation'
};

/**
 * Add localized "Use Existing Value" to cells whose value is importPreview_use_existing_value
 */
let _formatForUseExistingValueText = {
    action: function( column, vmo, tableElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem );
        cellContent.classList.add( 'aw-importexport-useExistingValue' );
        return cellContent;
    },
    condition: function( column, vmo ) {
        let propName = column.propertyName;

        if( vmo.props
            && vmo.props[propName].dbValue
            && vmo.props[propName].dbValue.length > 0
            && vmo.props[propName].dbValue[0] !== undefined
            && vmo.props[propName].dbValue[0].length > 0
            && vmo.props[propName].dbValue[0] === 'importPreview_use_existing_value' ) {
            return true;
        }
        return false;
    },
    name: 'formatForUseExistingValueText'
};

export let setCellRendererTemplate = function( columnInfo ) {
    columnInfo.cellRenderers.push( _colorForActionColumnCellRenderer );
    columnInfo.cellRenderers.push( _importReleaseStatusIcon );
    columnInfo.cellRenderers.push( _warningIconForTcInformation );
    columnInfo.cellRenderers.push( _formatForUseExistingValueText );
};

/**
 * Import Preview Tree cell rendering service utility
 * @param {Object} appCtxSvc - appCtxService to use.
 * @returns {Object} - Object.
 */
export default exports = {
    setCellRendererTemplate
};
