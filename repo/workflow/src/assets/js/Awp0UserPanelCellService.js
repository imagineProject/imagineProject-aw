// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0UserPanelCellService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import awIconService from 'js/awIconService';

/**
 * Define public API
 */
var exports = {};

/**
 * Get display name of Any text from i10n.
 *
 * @return {Object} - the localized text for Any
 */
var _getAnyValueDisplayName = function() {
    var workflowLocalTextBundle = localeService.getLoadedText( '/i18n/WorkflowCommandPanelsMessages' );
    return workflowLocalTextBundle.any;
};

/**
 * Get the model object that need to be render so that correct icon will be shown
 *
 * @param {Object} objectToRender: modelObject
 * @return {Object} modelObject
 */
var _getModelObject = function( objectToRender ) {
    var modelObject = objectToRender;
    if( modelObject && modelObject.props && modelObject.props.user ) {
        modelObject = cdm.getObject( modelObject.props.user.dbValues[ 0 ] );
    }
    return modelObject;
};

/**
 * Get the input object property and return the internal value.
 *
 * @param {Object} viewModelObject View model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue True/False based on display value need to be fetched or not
 * @returns {String} Property display value
 */
var _getPropValue = function( viewModelObject, propName, isDispValue ) {
    var propValue = null;
    if( viewModelObject && viewModelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = viewModelObject.props[ propName ].uiValues;
        } else {
            values = viewModelObject.props[ propName ].dbValues;
        }

        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Update the type icon and thumbnail image based on the current model object.
 *
 * @method _updateIconThumbnailDetails
 *
 * @param {viewModelObject} viewModelObject input view model object
 *
 * @return {Object} localViewModelObj
 */
var _updateIconThumbnailDetails = function( viewModelObject ) {
    var localViewModelObj = viewModelObject;

    var modelObject = _getModelObject( localViewModelObj );
    if( modelObject ) {
        if( modelObject.type && modelObject.type !== 'KeyRole' ) {
            modelObject.typeIconURL = awIconService.getTypeIconFileUrl( modelObject );
        }

        var thumbnailURL = awIconService.getThumbnailFileUrl( modelObject );
        if( thumbnailURL ) {
            modelObject.thumbnailURL = thumbnailURL;
            modelObject.hasThumbnail = true;
        }
    }

    localViewModelObj.typeIconURL = modelObject.typeIconURL;
    localViewModelObj.thumbnailURL = modelObject.thumbnailURL;
    localViewModelObj.hasThumbnail = modelObject.hasThumbnail;

    return localViewModelObj;
};

/**
 *
 * This method handles view model object having 'GroupMember' type.
 *
 * @param {Object} groupMemberViewModelObj: groupMemberViewModelObj
 *
 * @returns {Object} locGroupMemberViewModelObj
 */
let _processGroupMemberModelObject = function( groupMemberViewModelObj ) {
    var locGroupMemberViewModelObj = groupMemberViewModelObj;

    if( locGroupMemberViewModelObj ) {
        var userDispNameStr = _getPropValue( locGroupMemberViewModelObj, 'user', true );
        if( userDispNameStr && userDispNameStr.length > 0 ) {
            locGroupMemberViewModelObj.cellHeader1 = userDispNameStr;
        }

        var groupDispNameStr = _getPropValue( locGroupMemberViewModelObj, 'group', true );
        var roleDispNameStr = _getPropValue( locGroupMemberViewModelObj, 'role', true );
        if(  groupDispNameStr && groupDispNameStr.length > 0  &&
            ( roleDispNameStr && roleDispNameStr.length > 0 ) ) {
            locGroupMemberViewModelObj.cellHeader2 = groupDispNameStr + '/' + roleDispNameStr;
        }

        locGroupMemberViewModelObj = _updateIconThumbnailDetails( locGroupMemberViewModelObj );
    }
    return locGroupMemberViewModelObj;
};

/**
 *
 * This method handles view model object having 'User' type.
 *
 * @param {Object} userViewModelObj: userViewModelObj
 *
 * @return {Object} locUserViewModelObj
 */
let _processUserModelObject = function( userViewModelObj ) {
    var locUserViewModelObj = userViewModelObj;

    if( locUserViewModelObj ) {
        var userDispNameStr = _getPropValue( locUserViewModelObj, 'user_name', true );
        if( userDispNameStr && userDispNameStr.length > 0 ) {
            locUserViewModelObj.cellHeader1 = userDispNameStr;
        }

        locUserViewModelObj = _updateIconThumbnailDetails( locUserViewModelObj );
    }
    return locUserViewModelObj;
};

/**
 *
 * This method handles view model object having 'KeyRole' type.
 *
 * @param {Object} keyRoleViewModelObj: keyRoleViewModelObj
 *
 * @return {Object} locKeyRoleViewModelObj
 */
let _processKeyRoleModelObject = function( keyRoleViewModelObj ) {
    var locKeyRoleViewModelObj = keyRoleViewModelObj;
    if( locKeyRoleViewModelObj ) {
        locKeyRoleViewModelObj = _updateIconThumbnailDetails( locKeyRoleViewModelObj );
    }

    return locKeyRoleViewModelObj;
};

/**
 *
 * This method handles view model object having 'ResourcePool' type.
 *
 * @param {Object} resPoolViewModelObject Resource pool object
 *
 * @return {Object} locResPoolViewModelObject
 */
let _processResourcePoolModelObject = function( resPoolViewModelObject ) {
    var locResPoolViewModelObject = resPoolViewModelObject;

    if( locResPoolViewModelObject ) {
        var resourcePoolDispNameStr = _getPropValue( locResPoolViewModelObject, 'object_string', true );
        if( resourcePoolDispNameStr && resourcePoolDispNameStr.length > 0 ) {
            var groupName = '';
            var roleName = '';

            var keyValue = resourcePoolDispNameStr.split( '/' );

            if( keyValue && keyValue.length > 1 ) {
                var anyStringTitle = _getAnyValueDisplayName();

                // If key value at 0th or 1st index is equal to * then replace it with ANY string
                if( keyValue[ 0 ] ) {
                    if( keyValue[ 0 ] === '*' ) {
                        keyValue[ 0 ] = anyStringTitle;
                    }
                    groupName = keyValue[ 0 ];
                }

                if( keyValue[ 1 ] ) {
                    if( keyValue[ 1 ] === '*' ) {
                        keyValue[ 1 ] = anyStringTitle;
                    }
                    roleName = keyValue[ 1 ];
                }
            }
            // Set the groupName and roleName local property on resource pool object as this is being used
            // some places where we are showing this info like assignment tab on workflow designer. Fixed
            // for defect # LCS-496904
            locResPoolViewModelObject.groupName = groupName;
            locResPoolViewModelObject.cellHeader1 = groupName;
            locResPoolViewModelObject.roleName = roleName;
            locResPoolViewModelObject.cellHeader2 = roleName;
        }

        locResPoolViewModelObject = _updateIconThumbnailDetails( locResPoolViewModelObject );
    }
    return locResPoolViewModelObject;
};

/**
 *
 * Method functionality:
 * 1. This method populates view model object which is used to render user panel cell.
 * 2. It uses information from "sourceObject", prepares view model object based on it.
 * 3. This method contains custom handling for 'GroupMember', 'User', 'KeyRole' and 'ResourcePool' types.
 * 4. For any other type except above 4 types, it fetches the view model object,
 *    updates icon and thumbnail information if "user" property is available.
 * 5. These modified view model objects are displayed on user panel AWC UI.
 *
 * @param {Object} sourceObject: sourceObject
 *
 * @returns {Object} userPanelCellViewModelObj
 *
 */
export let populateUserPanelCellData = function( sourceObject ) {
    var userPanelCellObject = sourceObject;
    var userPanelCellViewModelObj = {};
    if( userPanelCellObject && userPanelCellObject.type ) {
        if( userPanelCellObject.type === 'GroupMember' ) {
            userPanelCellViewModelObj = _processGroupMemberModelObject( userPanelCellObject );
        } else if( userPanelCellObject.type === 'User' ) {
            userPanelCellViewModelObj = _processUserModelObject( userPanelCellObject );
        } else if( userPanelCellObject.type === 'KeyRole' ) {
            userPanelCellViewModelObj = _processKeyRoleModelObject( userPanelCellObject );
        } else if( userPanelCellObject.type === 'ResourcePool' ) {
            userPanelCellViewModelObj = _processResourcePoolModelObject( userPanelCellObject );
        } else {
            userPanelCellViewModelObj = _updateIconThumbnailDetails( userPanelCellObject );
        }
    }

    return userPanelCellViewModelObj;
};

export default exports = {
    populateUserPanelCellData
};
