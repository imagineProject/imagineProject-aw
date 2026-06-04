// Copyright (c) 2022 Siemens

/**
 * This service handler the workflow specific popup panel needs.
 * @module js/Awp0WorkflowPopupService
 */
import popupService from 'js/popupService';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import popupUtils from 'js/popupUtils';
import { getEditHandler } from 'js/editHandlerService';
import commandPanelService from 'js/commandPanel.service';
import appCtxSvc from 'js/appCtxService';

var exports = {};
var largePopupRef;
let subscriptions = [];

/**
 * Hide the opened popup panel and remove all event subscriptions as well.
 */
export let hidePopupPanel = function() {
    if( largePopupRef && largePopupRef.options ) {
        largePopupRef.options.disableClose = false;
        popupService.hide( largePopupRef );
        for( const s of subscriptions ) {
            eventBus.unsubscribe( s );
        }
        subscriptions = [];
        largePopupRef = null;
    }
};

/**
 * Open the popup panel based on input parameters.
 *
 * @param {Object} popupParams Popup parameters that will be used to bring up popup panel
 * @param {boolean} calcHeight True or false to make sure popup panel hight need to be calcualted
 *        based on browser resize.
 *
 * @returns {Object} Popup panel object
 */
var _openPopupPanelInternal = function( popupParams, calcHeight ) {
    if( !popupParams.options ) {
        popupParams.options = {};
    }
    // Calculate the popup panel height based on browser size.
    if( calcHeight ) {
        var popupHeight = reCalcPanelHeight();
        popupParams.options.height = popupHeight;
    }
    return popupService.show( popupParams ).then( popupRef => {
        largePopupRef = popupRef;
        subscriptions.push( eventBus.subscribe( 'aw.windowResize', resizePopup ) );
        subscriptions.push( eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', hidePopupPanel ) );
        var sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
            if ( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                setTimeout( function() {
                    exports.hidePopupPanel();
                }, 300 );
            }
        } );
        subscriptions.push( sideNavEventSub );
        resizePopup().then( () => popupRef );
    } );
};

/**
 * Open the popup panel based on input parameters.
 *
 * @param {Object} popupParams Popup parameters that will be used to bring up popup panel
 * @param {boolean} calcHeight True or false to make sure popup panel hight need to be calcualted
 *        based on browser resize.
 *
 * @returns {Object} Popup panel object
 */
export let openPopupPanel = function( popupParams, calcHeight ) {
    var editContext = 'INFO_PANEL_CONTEXT';
    var openedCommandId = null;

    // Get the opened tool and info command id and then additionaly check for if edit context
    // present then first try to see if edit has been done and we need to show unsaved edit message
    // then only close the panel and open the popup panel. Fix for defect # LCS-434502
    if( appCtxSvc.ctx.activeToolsAndInfoCommand && appCtxSvc.ctx.activeToolsAndInfoCommand.commandId ) {
        openedCommandId = appCtxSvc.ctx.activeToolsAndInfoCommand.commandId;
    }
    if( getEditHandler( editContext ) ) {
        return getEditHandler( editContext ).leaveConfirmation( function() {
            if( openedCommandId ) {
                commandPanelService.activateCommandPanel( openedCommandId, 'aw_toolsAndInfo' );
            }
            _openPopupPanelInternal( popupParams, calcHeight );
        } );
    }
    if( openedCommandId ) {
        commandPanelService.activateCommandPanel( openedCommandId, 'aw_toolsAndInfo' );
    }
    _openPopupPanelInternal( popupParams, calcHeight );
};

/**
 * resize popup after window resize
 *
 * @returns {Object} popup height value
 */
function reCalcPanelHeight() {
    var popupHeight = 800;
    // Get the popup panel hright based on aw_toolsAndInfo div present in DOM as normal
    // commands panel will also have the similar height.
    var toolInfoElement = $( '#aw_toolsAndInfo' );
    if( toolInfoElement && toolInfoElement.parent() && toolInfoElement.parent().height() ) {
        popupHeight = toolInfoElement.parent().height();
    }

    // If height is not valid then use hard coded height.
    if( !popupHeight || popupHeight <= 0 ) {
        popupHeight = 800;
    }
    popupHeight += 'px';
    return popupHeight;
}

/**
 * resize popup after window resize
 *
 * @returns {Promise} popup promise
 */
function resizePopup() {
    if( largePopupRef ) {
        var popupHeight = reCalcPanelHeight();
        popupUtils.processOptions( largePopupRef.panelEl, {
            containerHeight: popupHeight
        } );
        // Set the height of panel container as well so that if user do zoom in or out then it should have correct
        // height for container as well. Fix for defect # LCS-463318
        var referenceEl = popupUtils.getElement( popupUtils.extendSelector( '.aw-popup-contentContainer .aw-layout-panelContent' ) );
        if( referenceEl ) {
            // Check if style is not defined then create empty style
            if( !referenceEl.style ) {
                referenceEl.style = {};
            }
            referenceEl.style.height = popupHeight;
        }
        return popupService.update( largePopupRef.panelEl );
    }
}


/**
 * Get the popup panel reference if needed
 *
 * @returns {Object} Popup panel reference
 */
export let getPopupPanelRef = function() {
    return largePopupRef;
};

export default exports = {
    openPopupPanel,
    hidePopupPanel,
    getPopupPanelRef
};
