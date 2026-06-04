// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/**
 * Defines the markup operation to dispatch highlighting and drawing ops to pdf or image viewer panel
 *
 * @module js/MarkupOperation
 */
import markupData from 'js/MarkupData';
import markupThread from 'js/MarkupThread';
import markupPdf from 'js/MarkupPdf';
import markup2d from 'js/Markup2d';
import markupImage from 'js/MarkupImage';
import markupPlainText from 'js/MarkupPlainText';
import markupHtml from 'js/MarkupHtml';
import markupOnScreen3D from 'js/MarkupOnScreen3d';

'use strict';
//==================================================
// private variables
//==================================================
/** the current operation, either MarkupPdf or MarkupImage */
var operation = null;

//==================================================
// public functions
//==================================================
/**
 * Initializ the module, set the current operation
 *
 * @param {String} viewerType aw-pdf-viewer, aw-image-viewer, aw-text-viewer or null to clear it
 * @param {Object} viewerElement the viewer element
 * @returns {boolean} true if successful
 */
export function init( viewerType, viewerElement ) {
    if( viewerType === 'aw-pdf-viewer' && markupPdf.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markupPdf;
    } else if( viewerType === 'aw-2d-viewer' && markup2d.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markup2d;
    } else if( viewerType === 'aw-image-viewer' && markupImage.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markupImage;
    } else if( viewerType === 'aw-text-viewer' && markupPlainText.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markupPlainText;
    } else if( viewerType === 'aw-html-viewer' && markupHtml.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markupHtml;
    } else if( viewerType === 'aw-onscreen-3d-markup-viewer' && markupOnScreen3D.init( markupData.markups, markupData.users, markupThread, viewerElement ) ) {
        operation = markupOnScreen3D;
    } else {
        operation = null;
    }

    if( operation ) {
        operation.setViewParamChangeCallback && operation.setViewParamChangeCallback( viewParamChangeCallback );
        operation.setPageChangeCallback && operation.setPageChangeCallback( pageChangeCallback );
        return true;
    }

    return false;
}

//==================================================
// private functions
//==================================================
/**
 * View param change callback
 */
function viewParamChangeCallback() {
    operation && operation.showCurrentPage && operation.showCurrentPage();
}

/**
 * Page change callback
 */
function pageChangeCallback() {
    operation && operation.showCurrentPage && operation.showCurrentPage();
}

//==================================================
// exported functions
//==================================================
let exports;
export let setRevealed = function( revealed ) {
    operation && operation.setRevealed && operation.setRevealed( revealed );
};
export let setTool = function( tool, subTool ) {
    operation && operation.setTool && operation.setTool( tool, subTool );
};
export let addResource = function( name, value ) {
    operation && operation.addResource && operation.addResource( name, value );
};
export let getUserSelection = function() {
    return operation && operation.getUserSelection && operation.getUserSelection();
};
export let clearUserSelection = function() {
    operation && operation.clearUserSelection && operation.clearUserSelection();
};
export let show = function( markup, option ) {
    operation && operation.show && operation.show( markup, option );
};
export let showAll = function( option ) {
    operation && operation.showAll && operation.showAll( option );
};
export let showCurrentPage = function() {
    operation && operation.showCurrentPage && operation.showCurrentPage();
};
export let showAsSelected = function( markup, option ) {
    operation && operation.showAsSelected && operation.showAsSelected( markup, option );
};
export let ensureVisible = function( markup ) {
    operation && operation.ensureVisible && operation.ensureVisible( markup );
};
export let getViewParam = function() {
    return operation && operation.getViewParam && operation.getViewParam();
};
export let setViewParam = function( param ) {
    operation && operation.setViewParam && operation.setViewParam( param );
};
export let setViewParamChangeCallback = function( callback ) {
    operation && operation.setViewParamChangeCallback && operation.setViewParamChangeCallback( callback );
};
export let setPageChangeCallback = function( callback ) {
    operation && operation.setPageChangeCallback && operation.setPageChangeCallback( callback );
};
export let setSelectCallback = function( callback ) {
    operation && operation.setSelectCallback && operation.setSelectCallback( callback );
};
export let setSelectionEndCallback = function( callback ) {
    operation && operation.setSelectionEndCallback && operation.setSelectionEndCallback( callback );
};
export let setUnloadCallback = function( callback ) {
    operation && operation.setUnloadCallback && operation.setUnloadCallback( callback );
};
export let setPositionMarkup = function( markup ) {
    operation && operation.setPositionMarkup && operation.setPositionMarkup( markup );
};
export let generateRefImage = function( markupOrList, width, height, callback ) {
    operation && operation.generateRefImage &&
        operation.generateRefImage( markupOrList, width, height, callback );
};
export let setPlayChangeCallback = function( callback ) {
    operation && operation.setPlayChangeCallback && operation.setPlayChangeCallback( callback );
};
export let setCommandCallback = function( callback ) {
    operation && operation.setCommandCallback && operation.setCommandCallback( callback );
};

export default exports = {
    init,
    setRevealed,
    setTool,
    addResource,
    getUserSelection,
    clearUserSelection,
    show,
    showAll,
    showCurrentPage,
    showAsSelected,
    ensureVisible,
    getViewParam,
    setViewParam,
    setViewParamChangeCallback,
    setPageChangeCallback,
    setSelectCallback,
    setSelectionEndCallback,
    setUnloadCallback,
    setPositionMarkup,
    generateRefImage,
    setPlayChangeCallback,
    setCommandCallback
};
