// Copyright (c) 2022 Siemens

/**
 * @module js/aceIconService
 */
import awIconSvc from 'js/awIconService';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';

var _defaultTypeForIcon = 'Awb0Element';

function _getIconFromThumbnailImageTicketProp( props ) {
    var iconURL = null;

    if( props && props.awp0ThumbnailImageTicket ) {
        var ticket = props.awp0ThumbnailImageTicket.dbValues[ 0 ];

        if( ticket.length > 0 ) {
            iconURL = browserUtils.getBaseURL() + 'fms/fmsdownload/' + fmsUtils.getFilenameFromTicket( ticket ) +
                '?ticket=' + ticket;
        }
    }

    return iconURL;
}

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * This method gets URL for type icon of the given occurrenceInfo object or the model object.
 *
 * @param occInfoOrModelObject Either an occurrenceInfo object or a model object
 * @param occType Type of the underlying object
 */
export let getTypeIconURL = function( occInfoOrModelObject, occType ) {
    return occType ? awIconSvc.getTypeIconURL( occType ) : awIconSvc.getTypeIconURL( _defaultTypeForIcon );
};

/**
 * Return the Icon URL for the TreeNode First look for a thumbnail URL then fallback to type icon
 *
 * @param {ViewModelTreeNode} View Model Tree Node
 * @param origIconUrl Icon url existing on the node. This is returned if we don't find one based on thumbnailimage
 *            property or type icon file.
 * @return {String} Tree Node icon URL
 */
export let getIconURL = function( treeNode, origIconUrl ) {
    var iconURL = null;

    var props = treeNode.props;
    iconURL = _getIconFromThumbnailImageTicketProp( props );

    if( !iconURL && ( typeof origIconUrl === 'undefined' || origIconUrl === '' ) ) {
        iconURL = awIconSvc.getTypeIconFileUrl( treeNode );
    }

    if( iconURL ) {
        return iconURL;
    }

    return origIconUrl;
};

export default exports = {
    getTypeIconURL,
    getIconURL
};
