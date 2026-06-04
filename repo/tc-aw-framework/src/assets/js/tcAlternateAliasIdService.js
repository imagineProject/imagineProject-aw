// Copyright (c) 2022 Siemens

/**
 * @module js/tcAlternateAliasIdService
 */


import cdm from 'soa/kernel/clientDataModel';

var exports = {};

export let processContexts = function( response ) {
    var contexts = [];
    if( response && response.idContextOuts.length > 0 && response.idContextOuts[ 0 ].idContexts ) {
        for( var i = 0; i < response.idContextOuts[ 0 ].idContexts.length; i++ ) {
            contexts.push( _getViewModelObject( response.idContextOuts[ 0 ].idContexts[ i ].props.object_string.uiValues[ 0 ],
                response.idContextOuts[ 0 ].idContexts[ i ].uid ) );
        }
    }
    return contexts;
};

export let processIdentifierTypes = function( response ) {
    var identifierTypes = [];
    if( response && response.identifiersOutput.length > 0 && response.identifiersOutput[ 0 ].identifierTypes ) {
        for( var i = 0; i < response.identifiersOutput[ 0 ].identifierTypes.length; i++ ) {
            var identifierType = response.identifiersOutput[ 0 ].identifierTypes[ i ];
            identifierTypes.push( _getViewModelObject( identifierType.props.object_string.uiValues[ 0 ], identifierType.uid ) );
        }
    }
    return identifierTypes;
};

export let processRevisionList = function( response ) {
    var revisions = [];
    if( response && response.identifiersOutput.length > 0 && response.identifiersOutput[ 0 ].revisions ) {
        for( var i = 0; i < response.identifiersOutput[ 0 ].revisions.length; i++ ) {
            let isRevisionReleased = response.identifiersOutput[ 0 ].revisions[ i ].props.release_status_list &&
                response.identifiersOutput[ 0 ].revisions[ i ].props.release_status_list.dbValues.length > 0;
            revisions.push( _getViewModelObject( response.identifiersOutput[ 0 ].revisions[ i ].props.object_string.uiValues[ 0 ],
                response.identifiersOutput[ 0 ].revisions[ i ].uid, isRevisionReleased ) );
        }
    }
    return revisions;
};

export let findSelectedRev = function( data ) {
    if( data.revision.dbValue && data.revision.dbValues.length > 0 ) {
        return { uid: data.revision.dbValue };
    }
    return data.itemRevIdentifiableObj;
};

export let getMakeDefaultInput = function( openedObject, revisionObjects, selectedRevision ) {
    let mainObjMakeDefault = true;
    let revObjMakeDefault = true;
    //selectedRevision is defined in cae when oepnedObject is item.
    if( revisionObjects && selectedRevision.dbValue !== '' ) {
        //make mainObject makeDefault false if released
        if( openedObject.props.release_status_list.dbValue.length > 0  ) {
            mainObjMakeDefault = false;
        }
        //make revObject makeDefault false if released
        revObjMakeDefault = !( revisionObjects.filter( function( revision ) {
            return revision.propInternalValue === selectedRevision.dbValue;
        } )[0]?.isReleased ?? false );
    } else {
        //selectedRevision will be undefined in cae when oepnedObject is itemRevision
        if( openedObject.props.release_status_list.dbValue.length > 0  ) {
            mainObjMakeDefault = false;
            revObjMakeDefault = false;
        }
    }

    return { mainObjMakeDefault: mainObjMakeDefault, revObjMakeDefault: revObjMakeDefault };
};
export let createContextObjs = function( data ) {
    var contexts = [];
    if( data.contexts && data.contexts.dbValue ) {
        for( var i = 0; i < data.contexts.dbValue.length; i++ ) {
            contexts.push( { uid: data.contexts.dbValue[ i ] } );
        }
    }
    return contexts;
};
/**
 * Creates Empty list model Object .
 *
 * @return [{Object}] listModel
 */
var _getViewModelObject = function( displayName, internalValue, isReleased ) {
    return {
        propDisplayValue: displayName,
        propInternalValue: internalValue,
        propDisplayDescription: '',
        hasChildren: false,
        isReleased: isReleased,
        children: {},
        sel: true
    };
};
/**
 * fetches bo name from selected identifier type.
 * @param {String} selectedIdentifier selected identifier internal value
 * @return {String} boName identifier bo name.
 */
export let findSelectedBO = function( selectedIdentifier ) {
    var boName;
    if( selectedIdentifier && selectedIdentifier.indexOf( '::' ) > 0 ) {
        boName = selectedIdentifier.split( '::' )[ 1 ];
    }
    return boName;
};

/**
 * Gets the created object from createRelateAndSubmitObjects SOA response. Returns ItemRev if the creation type
 * is subtype of Item.
 *
 * @param {Object} response - the response of createRelateAndSubmitObjects SOA call
 * @param {StringArray} validTypesIn - valid types array
 * @return {ObjectArray} Array of created objects
 */
export let getCreatedObject = function( response ) {
    if( response?.created?.length > 0 ) {
        return cdm.getObject( response.created[ 0 ] );
    }
    return null;
};

export default exports = {
    processContexts,
    processIdentifierTypes,
    processRevisionList,
    findSelectedRev,
    findSelectedBO,
    createContextObjs,
    getMakeDefaultInput,
    getCreatedObject
};
