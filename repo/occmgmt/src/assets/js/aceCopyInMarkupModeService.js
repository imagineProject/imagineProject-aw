// Copyright (c) 2022 Siemens

/**
 * @module js/aceCopyInMarkupModeService
 */
import ClipboardService from 'js/clipboardService';
import messagingSvc from 'js/messagingService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import tcSelectionUtils from 'js/tcSelectionUtils';

var _localeTextBundle = null;

/**
 * Define public API
 */
var exports = {};

function isMarkupObject( obj ) {
    return obj.modelType.typeHierarchyArray.indexOf( 'Awb0MarkupElement' ) > -1 ||
        '128' === _.get( obj, 'props.awb0MarkupType.dbValues[0]' ) || '144' === _.get( obj, 'props.awb0MarkupType.dbValues[0]' );
}

/**
 *   The copy command delegate for the objects selected in the markup mode
 */
export let execute = function( contextSelectionData, selected ) {
    let selectedObjs = tcSelectionUtils.getSourceObjects( contextSelectionData, selected );
    if( selectedObjs ) {
        var markupObjs = [];
        var nonMarkupObjs = [];
        selectedObjs.forEach( function( obj ) {
            if( isMarkupObject( obj ) ) {
                markupObjs.push( obj );
            } else {
                nonMarkupObjs.push( obj );
            }
        } );

        var numOfSelectedObjs = selectedObjs.length;
        var numOfMarkupObjs = markupObjs.length;
        var numOfNonMarkupObjs = nonMarkupObjs.length;
        var displayMessage;
        if( numOfSelectedObjs === numOfNonMarkupObjs ) {
            //Add all to clipboard
            ClipboardService.instance.setContents( nonMarkupObjs );

            //Display message
            if( numOfSelectedObjs === 1 ) {
                var name = nonMarkupObjs[ 0 ].props.object_string.dbValues[ 0 ];
                displayMessage = _localeTextBundle.copySingleObjectToClipboard.replace( '{0}', name );
            } else {
                displayMessage = _localeTextBundle.copyMultipleObjectsToClipboardSuccess.replace( '{0}', numOfSelectedObjs );
            }
            messagingSvc.showInfo( displayMessage );
        } else if( numOfMarkupObjs > 0 ) { //Mix of markup and non-markup
            if( numOfSelectedObjs !== numOfMarkupObjs ) {
                //Add Non markup objects to clipboard
                ClipboardService.instance.setContents( nonMarkupObjs );
            }

            //Display message
            displayMessage = _localeTextBundle.copyMultipleObjectsToClipboardFailed.replace( '{0}', numOfNonMarkupObjs );
            displayMessage = displayMessage.replace( '{1}', numOfSelectedObjs );
            markupObjs.forEach( function( markupObj ) {
                var name = markupObj.props.object_string.dbValues[ 0 ];
                displayMessage += '<br>' + _localeTextBundle.copyPendingObjectsFailed.replace( '{0}', name );
            } );
            messagingSvc.showInfo( displayMessage );
        }
    }
};

/**
 * This factory creates a service and returns exports
 *
 * @member aceCopyInMarkupModeService
 */

_localeTextBundle = localeSvc.getLoadedText( 'OccurrenceManagementConstants' );
export default exports = {
    execute
};
