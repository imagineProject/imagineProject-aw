// Copyright (c) 2022 Siemens

/**
 * @module js/Um0CreateUserService
 */
import cdm from 'soa/kernel/clientDataModel';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import eventBus from 'js/eventBus';
import um0AddInAnOrganizationService from 'js/um0AddInAnOrganizationService';

var exports = {};

eventBus.subscribe( 'updateUserProperties', function( eventData ) {
    if( eventData.scope.data.modelPropUser.props.fnd0license_bundles ) {
        eventData.modelPropUser.props.fnd0license_bundles.uiValue = eventData.scope.data.modelPropUser.props.fnd0license_bundles.uiValue;
    }

    if( eventData.scope.data.modelPropUser.props.fnd0LicenseServer ) {
        eventData.modelPropUser.props.fnd0LicenseServer.dbValue = eventData.scope.data.modelPropUser.props.fnd0LicenseServer.dbValue;
    }
} );

export let modifyResponse = function( data ) {
    var name = data.serviceData.plain[ 0 ];
    data.serviceData.modelObjects[ name ].props.fnd0license_bundles.propertyDescriptor.anArray = false;
    return data;
};

/**
 * validateAndCreateObject Method
 *
 * @param {bool} GroupRoleSelectionValue - GroupRoleSelectionValue
 */
export let validateAndCreateObject = function( modeldata ) {
    if( modeldata.modelPropUser.props.volume.dbValue === '' && modeldata.modelPropUser.props.local_volume.dbValue === '' ) {
        eventBus.publish( 'ics.createPersonObject' );
    } else {
        if( modeldata.modelPropUser.props.volume.dbValue !== null &&
        modeldata.modelPropUser.props.local_volume.dbValue !== null ) {
            if( modeldata.modelPropUser.props.volume.dbValue === modeldata.modelPropUser.props.local_volume.dbValue ) {
                var resource = 'UsermanagementCommandPanelMessages';
                var localTextBundle = localeService.getLoadedText( resource );
                if( localTextBundle ) {
                    var _localeMsg = localTextBundle.WarnMsgForVolumeProp.replace( '{0}', modeldata.um0UserName.uiValue );
                    messagingService.showWarning( _localeMsg );
                }
            } else {
                eventBus.publish( 'ics.createPersonObject' );
            }
        } else {
            eventBus.publish( 'ics.createPersonObject' );
        }
    }
};

/**
 * @param {*} data
 * @param {*} subPanelContext
 * @returns
 */
export let setDefaultGroupProp = function( data, subPanelContext ) {
    var newParent = { ...data.modelPropUser.props.default_group };
    var groupObject = cdm.getObject( subPanelContext.searchState.criteria.groupUID );
    newParent.uiValue =  groupObject.props.name ? groupObject.props.name.uiValues[0] : groupObject.props.object_string.uiValues[0];
    return newParent;
};


/**
 * This function is used to store the nodes which will be selected after add.
 * This function sets the newlyCreatedObj ctx using newly added single/multiple node.
 */
export let registerCtxForNewNodes = function( eventData ) {
    um0AddInAnOrganizationService.registerCtxForNewNodes( eventData );
};

/**
 * This function is used to store the nodes which will be selected after add.
 * This function sets the newlyCreatedObj ctx using newly added single/multiple node.
 */
export let unRegisterCtxForNewNodes = function( ) {
    um0AddInAnOrganizationService.unRegisterCtxForNewNodes();
};
/**
 * reset name and user_id field of Um0CreateUserPanel in Organization sublocation
 * reset user_name and user_id field of Um0CreateUserPanel in user sublocation
 * @param {*} data
 * @returns
 */
export let resetAddUserPanelData = function( data ) {
    var name = '';
    if( data.um0UserName ) {
        name = Object.assign( {}, data.um0UserName );
    }

    let user_id = Object.assign( {}, data.um0UserId );
    let os_username = Object.assign( {}, data.modelPropUser.props.os_username );

    name.dbValue = '';
    name.uiValue = '';

    user_id.dbValue = '';
    user_id.uiValue = '';

    os_username.dbValue = '';
    os_username.uiValue = '';

    return {
        name,
        user_id,
        os_username
    };
};


exports = {
    validateAndCreateObject,
    modifyResponse,
    setDefaultGroupProp,
    registerCtxForNewNodes,
    unRegisterCtxForNewNodes,
    resetAddUserPanelData
};
export default exports;
