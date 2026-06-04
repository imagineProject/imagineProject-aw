// Copyright (c) 2022 Siemens

/**
 * @module js/aceInContextOverrideService
 */
import appCtxService from 'js/appCtxService';
import aceContextStateMgmtService from 'js/aceContextStateMgmtService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import adapterSvc from 'js/adapterService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import uwPropertyService from 'js/uwPropertyService';
import popupService from 'js/popupService';

var _editStartHandlerListener = null;

var exports = {};

/**
 * Subscribe to treeNodesLoadedEvent and apply VMO states correctly.
 */
function _subscribeToTreeNodesLoadedEvent() {
    if( !_editStartHandlerListener ) {
        _editStartHandlerListener = eventBus.subscribe( 'editHandlerStateChange', function( context ) {
            if( !_.isEmpty( appCtxService.ctx.aceActiveContext ) ) {
                let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
                if( currentContext && currentContext.vmc && _.isEqual( currentContext.vmc.name, context.dataSource.name ) ) {
                    var loadedVMOs = currentContext.vmc.getLoadedViewModelObjects();

                    //Set suppressed for in-context edit on all lines
                    for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
                        if( loadedVMOs[ ndx ].isGreyedOutElement || loadedVMOs[ ndx ].isInContextOverrideSet ) {
                            loadedVMOs[ ndx ].setEditableStates( false );
                        }
                    }
                }
            }
        } );
    }
}

/**
 * Unsubscribe to events when In-Context mode is toggled off
 */
export let cleanUpInContextOverrides = function( subPanelContext ) {
    if( _editStartHandlerListener ) {
        eventBus.unsubscribe( _editStartHandlerListener );
        _editStartHandlerListener = null;
    }

    var newState = {};
    newState.incontext_uid = null;
    aceContextStateMgmtService.updateUrlAndContextState( undefined, newState, true, subPanelContext );
};

/**
 *
 */
function populateParentNodesToGreyedOutState( vmo ) {
    let vmoChildren =  vmo.__expandState ? vmo.__expandState.children : vmo.children;
    _.forEach( vmoChildren, function( vmoChild ) {
        vmoChild.isGreyedOutElement = true;
        if( vmoChild.__expandState || vmoChild.children ) {
            populateParentNodesToGreyedOutState( vmoChild );
        }
    } );
}

/**
 * Set Greyed Out State
 * @param {ViewModelObjectArray} vmosToBeGreyedOut : Objects to be set in Greyed Out State
 */
function _setVMOsInGreyedOutState(  loadedVMOs ) {
    for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
        loadedVMOs[ ndx ].isGreyedOutElement = true;
        if( loadedVMOs[ ndx ].__expandState ) {
            populateParentNodesToGreyedOutState( loadedVMOs[ndx] );
        }
        //vmosToBeGreyedOut[ndx].setEditableStates( false ); -- need to validate if we need this
    }
    return loadedVMOs;
}

/**
 * Set Supressed State
 * @param {ViewModelObject} vmoToApplyContextOverrideOn:
 */
function _setInContextOverrideOnProvidedAssembly( vmoToApplyContextOverrideOn, subPanelContext ) {
    var begNdx = -1;
    var nDelete = 0;

    var vmosToBeGreyedOut = _setVMOsInGreyedOutState( subPanelContext.occContext.vmc.getLoadedViewModelObjects() );

    //Set inContextOveride on VMO under action.
    vmoToApplyContextOverrideOn.isInContextOverrideSet = true;

    //Delete isGreyedOutElement property on VMO under action and all its children.
    delete vmoToApplyContextOverrideOn.isGreyedOutElement;

    for( var ndx = 0; ndx < vmosToBeGreyedOut.length; ndx++ ) {
        if( vmosToBeGreyedOut[ ndx ].id === vmoToApplyContextOverrideOn.id ) {
            begNdx = ndx + 1;
            nDelete = 0;
        } else if( begNdx >= 0 ) {
            if( vmosToBeGreyedOut[ ndx ].levelNdx > vmoToApplyContextOverrideOn.levelNdx ) {
                nDelete++;
            } else {
                break;
            }
        }
    }

    //TODO : probable data mutation case
    for( ndx = 0; ndx < nDelete; ndx++ ) {
        delete vmosToBeGreyedOut[ begNdx + ndx ].isGreyedOutElement;
    }
    subPanelContext.occContext.treeDataProvider.update( vmosToBeGreyedOut );

    var newState = {};
    newState.incontext_uid = vmoToApplyContextOverrideOn.id;
    aceContextStateMgmtService.updateUrlAndContextState( undefined, newState, true, subPanelContext );
}

/**
 * Toggle Off In-Context Override
 */
function _toggleOffInContextOverrideMode( loadedVMOs ) {
    //TODO : probable data mutation case
    for( var ndx = 0; ndx < loadedVMOs.length; ndx++ ) {
        delete loadedVMOs[ ndx ].isGreyedOutElement;
    }
    eventBus.publish( 'reRenderTableOnClient' );
}

/**
 * Parent Assembly on wich "Set In-Context" is applied
 * @returns {ViewModelObject} on which "Set In-Context" is applied
 */
function _getCurrentContextOverridenVMO( loadedVMOs ) {
    return loadedVMOs.filter( function( vmo ) { return vmo.isInContextOverrideSet; } )[ 0 ];
}

export let initialize = function() {
    _subscribeToTreeNodesLoadedEvent();
};

export let applyInContextOverrideStatesOnNewlyLoadedObjectsInTree = function( subPanelContext, eventData ) {
    var incontext_uid = subPanelContext.occContext.currentState.incontext_uid;

    if( eventData.treeLoadResult && eventData.treeLoadResult.parentNode.isGreyedOutElement ) {
        _setVMOsInGreyedOutState( eventData.treeLoadResult.childNodes );
    }

    if( incontext_uid ) {
        var vmoIdToApplyContextOverrideOn = subPanelContext.occContext.vmc.findViewModelObjectById( incontext_uid );
        if( vmoIdToApplyContextOverrideOn !== -1 ) {
            var loadedVMOs = subPanelContext.occContext.vmc.getLoadedViewModelObjects();
            var vmoToApplyContextOverrideOn = loadedVMOs[ vmoIdToApplyContextOverrideOn ];

            _subscribeToTreeNodesLoadedEvent();
            _setInContextOverrideOnProvidedAssembly( vmoToApplyContextOverrideOn, subPanelContext );
            eventBus.publish( 'overridenContextChanged' );
        }
    }
};

export let getOverridenContextParent = function( inContextElementUid ) {
    var overridenContextParentElem = {
        isNull: true,
        uiValue: '',
        dbValue: ''
    };
    if( inContextElementUid ) {
        var inContextObj = cdm.getObject( inContextElementUid );
        if( inContextObj && inContextObj.props.object_string ) {
            overridenContextParentElem.isNull = false;
            overridenContextParentElem.uiValue = inContextObj.props.object_string.uiValues[ 0 ];
            overridenContextParentElem.dbValue = inContextObj.props.object_string.dbValues[ 0 ];
        }
    }
    return { overridenContextParentElem };
};

export let toggleInContextOverrideOnSelectedParentAssemblyInTreeView = function( commandContext ) {
    let currentVMC = appCtxService.ctx[ commandContext.contextKey ].vmc;
    var vmoIdToApplyContextOverrideOn = currentVMC.findViewModelObjectById( appCtxService.ctx.selected.uid );

    if( vmoIdToApplyContextOverrideOn !== -1 ) {
        var loadedVMOs = currentVMC.getLoadedViewModelObjects();
        var vmoToApplyContextOverrideOn = loadedVMOs[ vmoIdToApplyContextOverrideOn ];

        var currentContextOverridenVMO = _getCurrentContextOverridenVMO( loadedVMOs );

        //TODO : probable data mutation case
        if( currentContextOverridenVMO ) {
            delete currentContextOverridenVMO.isInContextOverrideSet;
        }

        var eventData = { incontext_uid: vmoToApplyContextOverrideOn.id };

        eventBus.publish( 'StartSaveAutoBookmarkEvent', eventData );
        //Set In-Context Override is like toggle. If it is applied on same VMO, it should as as cleanup.
        if( currentContextOverridenVMO && _.isEqual( currentContextOverridenVMO.id, vmoToApplyContextOverrideOn.id ) ) {
            _toggleOffInContextOverrideMode( loadedVMOs );
            exports.cleanUpInContextOverrides( commandContext );
            eventBus.publish( 'overridenContextChanged' );
            return;
        }

        _subscribeToTreeNodesLoadedEvent();
        _setInContextOverrideOnProvidedAssembly( vmoToApplyContextOverrideOn, commandContext );
        eventBus.publish( 'reRenderTableOnClient' );
        eventBus.publish( 'overridenContextChanged' );
    }
};

export let getSecondaryObjects = function() {
    var secondaryObjects = [];
    _.forEach( appCtxService.ctx.mselected, function( obj ) {
        secondaryObjects.push( {
            type: obj.type,
            uid: obj.uid
        } );
    } );
    return secondaryObjects;
};

export let getInContextOverrides = function( vmoHovered, data ) {
    if( vmoHovered && vmoHovered.props.awb0OverriddenProperties && vmoHovered.props.awb0OverrideContexts ) {
        var overrideData = {
            contextValue : []
        };

        //In future, instead of using uiValues, we can optimize code to use dbValue and dbValue give the display name of property using Client meta Model
        var overriddenProps = vmoHovered.props.awb0OverriddenProperties.uiValues;
        var contextsForOverrides = vmoHovered.props.awb0OverrideContexts.dbValues;
        var commaSeparatedPropNames = [];

        //Remove duplicate context values
        const uniqueArray = Array.from( new Set( contextsForOverrides ) );

        //Create comma separated property names against each unique context
        _.forEach( uniqueArray, function( context ) {
            var indexes = [];
            var propertiesForEachContext = [];
            for( var i = 0; i < contextsForOverrides.length; i++ ) {
                if( contextsForOverrides[ i ] === context ) { indexes.push( i ); }
            }
            _.forEach( indexes, function( index ) {
                propertiesForEachContext.push( overriddenProps[ index ] );
            } );
            propertiesForEachContext = propertiesForEachContext.join( ', ' );
            commaSeparatedPropNames.push( propertiesForEachContext );
        } );

        for( var i = 0; i < ( uniqueArray.length > 4 ? 4 : uniqueArray.length ); i++ ) {
            var contextValue = uwPropertyService.createViewModelProperty( data.i18n.contextTitle, data.i18n.contextTitle, 'STRING', data.i18n.contextTitle, [ uniqueArray[ i ] ] );
            var propertyValue = uwPropertyService.createViewModelProperty( data.i18n.properties, data.i18n.properties, 'STRING', data.i18n.properties, [ commaSeparatedPropNames[ i ] ] );

            overrideData.contextValue.push( contextValue );
            overrideData.contextValue.push( propertyValue );
        }

        //  Update tooltip label with number of overridden contexts
        var overridesLabel = data.i18n.overridesLabel;
        overridesLabel = overridesLabel.replace( '{0}', uniqueArray.length );
        overrideData.overrideText = {};
        overrideData.overrideText = uwPropertyService.createViewModelProperty( overridesLabel, overridesLabel, 'STRING', '', [ '' ] );

        //update tooltip link for more data
        if( uniqueArray.length > 4 ) {
            var tooltipText = data.i18n.tooltipLinkText;
            tooltipText = tooltipText.replace( '{0}', uniqueArray.length - 4 );
            overrideData.moreOverrides = {};
            overrideData.moreOverrides = uwPropertyService.createViewModelProperty( tooltipText, tooltipText, 'STRING', tooltipText, [ tooltipText ] );
            overrideData.enableOverrides = {};
            overrideData.enableOverrides.dbValue = true;
        }
        return overrideData;
    }
};

/**
 * Removes property override for the property of vmo hovered
 */
export let removePropertyOverride = function( subPanelContext ) {
    var RemoveInContextOverrides = {};
    RemoveInContextOverrides.removeInContextOverridesInfo = {
        element : {},
        propertyName : ''
    };
    var _hoveredModelObject = subPanelContext.vmoHovered;
    RemoveInContextOverrides.removeInContextOverridesInfo.element = {
        uid: _hoveredModelObject.uid,
        type: _hoveredModelObject.type
    };
    RemoveInContextOverrides.removeInContextOverridesInfo.propertyName = subPanelContext.propHovered;

    return soaSvc.post( 'Internal-ActiveWorkspaceBom-2019-12-OccurrenceManagement', 'removeInContextPropertyOverride', RemoveInContextOverrides ).then(
        function( response ) {
            popupService.hide();
            return response;
        } );
};

export let adaptedRelatedModifiedInput = function() {
    return adapterSvc.getAdaptedObjectsSync( [ appCtxService.ctx.pselected ] );
};

export let removeAttachment = function( commandContext ) {
    if( appCtxService.ctx.aceActiveContext.attachmentContext ) {
        delete appCtxService.ctx.aceActiveContext.attachmentContext;
    }

    if( commandContext && commandContext.dataProvider && commandContext.dataProvider.selectedObjects ) {
        var selectedObjects = commandContext.dataProvider.selectedObjects;
        for( var selectedObject of selectedObjects ) {
            if( selectedObject.props.awb0Context && selectedObject.props.awb0Context.dbValues[ 0 ] !== '' ) {
                appCtxService.updatePartialCtx( 'aceActiveContext.attachmentContext', 'removeOverride' );
                break;
            }
        }
    }
};

export let postRemoveAttachmentCleanupAction = function() {
    //TODO : probable data mutation case
    if( appCtxService.ctx.aceActiveContext.attachmentContext ) {
        delete appCtxService.ctx.aceActiveContext.attachmentContext;
    }
};

export default exports = {
    cleanUpInContextOverrides,
    initialize,
    applyInContextOverrideStatesOnNewlyLoadedObjectsInTree,
    getOverridenContextParent,
    toggleInContextOverrideOnSelectedParentAssemblyInTreeView,
    getSecondaryObjects,
    getInContextOverrides,
    removePropertyOverride,
    adaptedRelatedModifiedInput,
    removeAttachment,
    postRemoveAttachmentCleanupAction
};
