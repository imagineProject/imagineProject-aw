// Copyright (c) 2024 Siemens

/**
 * native construct to hold the server version information related to the AW server release.
 *
 * @module js/dynamicParticipantTypeCellRenderer
 * @requires app
 */
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';
import htmlUtil from 'js/htmlUtils';

var exports = {};


/**
 * Generates task assignment column icon render based on assignment
 * @param { Object } vmo - ViewModelObject for which release status is being rendered
 * @param { Object } tableElem - The container DOM Element inside which assignment will be rendered
 * @param { Object } column - Column for renderer need to be used
 * @param { Object } rowElem - The row element object
 */
export let dynamicParticipantTypeColRendererFn = function( vmo, tableElem, column, rowElem ) {
    var cellDBValue = _.get( vmo, 'props.fnd0Participant.dbValues' );
    let cellParticipantTypeName = _.get( vmo, 'props.fnd0ParticipantType' );

    if( cellParticipantTypeName && cellParticipantTypeName.dbValues && cellParticipantTypeName.dbValues[0] !== '' && _.isNull( cellDBValue[0] ) ) {
        var gridCellText = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
        gridCellText.textContent = cellParticipantTypeName.uiValues[0] ? cellParticipantTypeName.uiValues[0] : '';
        gridCellText.title = cellParticipantTypeName.uiValues[0] ? cellParticipantTypeName.uiValues[0] : '';
        tableElem.classList.add( tableSvc.CLASS_TABLE_CELL_TOP_DYNAMIC );
        gridCellText.classList.add( tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT_DYNAMIC );
        gridCellText.classList.add( 'aw-workflow-reqParticipantType' );
        tableElem.appendChild( gridCellText );
    } else {
        var gridCellText = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
        gridCellText.textContent = cellParticipantTypeName.uiValues[0];
        gridCellText.title = cellParticipantTypeName.uiValues[0];
        tableElem.classList.add( tableSvc.CLASS_TABLE_CELL_TOP_DYNAMIC );
        gridCellText.classList.add( tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT_DYNAMIC );
        tableElem.appendChild( gridCellText );
    }
};

export default exports = {
    dynamicParticipantTypeColRendererFn
};
