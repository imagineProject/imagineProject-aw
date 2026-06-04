// Copyright (c) 2022 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module propRenderTemplates/workflowTaskAssignmentCellRenderer
 * @requires app
 */
import { getBaseUrlPath } from 'app';
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';
import htmlUtil from 'js/htmlUtils';

var exports = {};

/**
 *
 * @param {Object} vmo VMO object
 *
 * @returns {Object} Icon path string
 */
var _getTaskAssignmentIcon = function( vmo ) {
    let imagePath = getBaseUrlPath() + '/image/';
    let iconName = null;
    if( vmo.assignmentType === 'assignee' ) {
        iconName  = 'typeAssigneeRole48.svg';
    } else if( vmo.assignmentType === 'reviewers' ) {
        iconName =  'typeReviewerRole48.svg';
    } else if( vmo.assignmentType === 'acknowledgers' ) {
        iconName =  'typeAcknowledgerRole48.svg';
    } else if( vmo.assignmentType === 'notifyees' ) {
        iconName =  'typeNotifyeeRole48.svg';
    }
    // Special handling for unstaffed profile row in table
    if( vmo.assignmentObject && vmo.assignmentObject.isProfileAssignment ) {
        iconName =  'typePersonGray48.svg';
    }
    if( iconName ) {
        imagePath += iconName;
    }

    return imagePath;
};

/**
 *
 * @param {Object} modelObject Object for task assignment need to be render
 * @param {String} cellDisplayValue Cell display string that need to be render
 *
 * @returns {Object} Image object
 */
var _getTaskAssignmentIconIndicator = function( modelObject, cellDisplayValue ) {
    if( !modelObject || modelObject.uid === 'unstaffedUID' && modelObject.assignmentObject &&
    ( !modelObject.assignmentObject.signoffProfile || modelObject.assignmentObject.signoffProfile === null ) ) {
        return null;
    }

    var iconURL = _getTaskAssignmentIcon( modelObject );
    var cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-visual-indicator';
    cellImg.title = cellDisplayValue;
    cellImg.src = iconURL;
    cellImg.alt = cellDisplayValue;
    if( modelObject.profileDisplayString ) {
        cellImg.title = modelObject.profileDisplayString;
    }
    return cellImg;
};

/**
 * Generates task assignment column icon render based on assignment
 * @param { Object } vmo - ViewModelObject for which release status is being rendered
 * @param { Object } tableElem - The container DOM Element inside which assignment will be rendered
 * @param { Object } column - Column for renderer need to be used
 * @param { Object } rowElem - The row element object
 */
export let workflowTaskAssignmentRendererFn = function( vmo, tableElem, column, rowElem ) {
    var cellDBValue = _.get( vmo, 'props.' + column + '.dbValues' );
    var cellDispValue = _.get( vmo, 'props.' + column + '.uiValue' );

    if( cellDBValue && cellDBValue[ 0 ] && cellDispValue ) {
        var cellImg = '';
        if( cellDBValue[ 0 ]  !== 'unstaffedUID' ) {
            cellImg = _getTaskAssignmentIconIndicator( vmo.assignmentObject, cellDispValue );
        } else if( cellDBValue[ 0 ]  === 'unstaffedUID' && vmo.assignmentObject && vmo.assignmentObject.signoffProfile ) {
            // If unstaff object is profile object then render the required icon
            cellImg = _getTaskAssignmentIconIndicator( vmo, cellDispValue );
        }
        if( cellImg ) {
            var iconImageDiv = htmlUtil.createElement( 'div', tableSvc.CLASS_GRID_CELL_IMAGE );
            iconImageDiv.appendChild( cellImg );
            tableElem.appendChild( iconImageDiv );
        }

        // Correct the icon and text style for assignee column cell renderer
        var gridCellText = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
        gridCellText.textContent = cellDispValue;
        gridCellText.title = cellDispValue;
        tableElem.classList.add( tableSvc.CLASS_TABLE_CELL_TOP_DYNAMIC );
        gridCellText.classList.add( tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT_DYNAMIC );
        tableElem.appendChild( gridCellText );

        // We need to show only required indicator icon for unstaffed profile row.
        if( cellDBValue[ 0 ]  === 'unstaffedUID' && vmo.assignmentObject && vmo.assignmentObject.isProfileAssignment ) {
            let imagePath = getBaseUrlPath() + '/image/indicatorRequired16.svg';
            var celRequiredImg = document.createElement( 'img' );
            celRequiredImg.className = 'aw-visual-indicator';
            celRequiredImg.title = cellDispValue;
            celRequiredImg.src = imagePath;
            celRequiredImg.alt = cellDispValue;
            if( celRequiredImg ) {
                var requiredImageDiv = htmlUtil.createElement( 'div', tableSvc.CLASS_GRID_CELL_IMAGE );
                requiredImageDiv.appendChild( celRequiredImg );
                tableElem.appendChild( requiredImageDiv );
            }
        }
    }
};

export default exports = {
    workflowTaskAssignmentRendererFn
};
