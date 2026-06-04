// Copyright (c) 2023 Siemens

/* global */

/**
 * @module js/pca0DragAndDropService
 */

import appCtxSvc from 'js/appCtxService';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import cdm from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import _ from 'lodash';

const _localeTextBundle = localeService.getLoadedText( 'ConfiguratorExplorerMessages' );
const _btnClass = 'btn btn-notify';
const _typeHierarchyArray = 'modelType.typeHierarchyArray';
const _clientScopeURI = 'sublocation.clientScopeURI';
const _unassignedGroup = pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID;
const _confContext = pca0Constants.CFG_OBJECT_TYPES.CONF_CONTEXT;

/**
  * This function de-Highlights all the rows from the table
  */
const _deHighlightElements = () => {
    const allHighlightedTargets = document.body.querySelectorAll( '.aw-theme-dropframe.aw-widgets-dropframe' );
    if( allHighlightedTargets ) {
        _.forEach( allHighlightedTargets, function( target ) {
            eventBus.publish( 'dragDropEvent.highlight', {
                isHighlightFlag: false,
                targetElement: target
            } );
        } );
    }
};

/**
  * This function Highlights the targeted element.
  * @param {Object} dragAndDropParams - Drag and drop parameters.
  * @param {Boolean} highlightTable - True if the whole table needs to be highlighted.
  * @returns {Object} - Highlight effect
  */
const _highlightElement = ( dragAndDropParams, highlightTable ) => {
    _deHighlightElements();
    const elementToBeHighlighted = highlightTable ? document.getElementById( 'variabilityExplorerGrid' ) : dragAndDropParams.targetElement;
    dragAndDropParams.callbackAPIs.highlightTarget( {
        isHighlightFlag: true,
        targetElement: elementToBeHighlighted
    } );
    return {
        preventDefault: true,
        dropEffect: 'copy'
    };
};

/**
  * This function will show a confirmation message with Cancel and Continue buttons after the family drop action.
  * @param {Object} sourceObjects - Family which is being moved
  * @param {Object} targetObject - Group to which the family is being moved
  * @param {Object} sourceParentObject - Current group of the family
  */
let _confirmationOnFamilyMoveAction = function( sourceObjects, targetObject, sourceParentObject ) {
    let msg = _localeTextBundle.moveFamilyConfirmation;
    const cancelString = _localeTextBundle.cancel;
    const proceedString = _localeTextBundle.continue;
    const buttons = [ {
        addClass: _btnClass,
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            _deHighlightElements();
        }
    },
    {
        addClass: _btnClass,
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            _deHighlightElements();
            _moveFamilies( sourceObjects, targetObject, sourceParentObject, 'dragAndDropFamily' );
        }
    }
    ];
    if ( sourceObjects.length === 1 ) {
        messagingService.showWarning( msg.replace( '{0}', sourceObjects[ 0 ].displayName ).replace( '{1}', sourceParentObject.displayName ).replace( '{2}', targetObject.displayName ), buttons );
    } else {
        msg = _localeTextBundle.moveMultipleFamiliesConfirmation;
        messagingService.showWarning( msg.replace( '{0}', sourceObjects.length ).replace( '{1}', sourceParentObject.displayName ).replace( '{2}', targetObject.displayName ), buttons );
    }
};

/**
  * This function will show a confirmation message with Cancel and Continue buttons after dropping variability objects on other context.
  * @param {Object} sourceObjects - Variability objects which are being moved.
  * @param {Object} targetObject - Context to which the family is being moved.
  */
let _confirmAllocationAction = function( sourceObjects, targetObject ) {
    const msg = _localeTextBundle.bulkAllocateConfirmation;
    const cancelString = _localeTextBundle.cancel;
    const proceedString = _localeTextBundle.continue;
    const buttons = [ {
        addClass: _btnClass,
        text: cancelString,
        onClick: function( $noty ) {
            $noty.close();
            _deHighlightElements();
        }
    },
    {
        addClass: _btnClass,
        text: proceedString,
        onClick: function( $noty ) {
            $noty.close();
            _deHighlightElements();
            eventBus.publish( 'Pca0VariabilityExplorerTree.pca0AllocateAcrossTabs', {
                sourceObjects : sourceObjects,
                runInBackground: false
            } );
        }
    } ];
    messagingService.showWarning( msg.replace( '{0}', sourceObjects.length ).replace( '{1}', targetObject.cellHeader1 ), buttons );
};

/**
  * This function will get called when user clicks on continue on the confirmation msg of family move.
  * It will decide which event to call based on operation and target object type
  * @param {Object} sourceObjects - Source objects for drop operation
  * @param {Object} targetObject - Target object for drop operation
  * @param {Object} sourceParentObject - Parent of the source object
  * @param {Object} operationType - Drag operation type
  */
let _moveFamilies = async( sourceObjects, targetObject, sourceParentObject, operationType ) => {
    // When moving family to unassigned family group we just need to remove the family with the parent group
    const sourceObjUids = sourceObjects.map( sourceObj => sourceObj.uid );
    await dmSvc.getProperties( sourceObjUids, [ 'wso_thread' ] );
    const sourceObjectThreads = [];
    for ( const uid of sourceObjUids ) {
        const ecnVMO = cdm.getObject( uid );
        if ( ecnVMO ) {
            const wsoThread = ecnVMO.props.wso_thread;
            sourceObjectThreads.push( {
                uid: wsoThread.dbValues[0],
                type: wsoThread.propertyDescriptor.constantsMap.ReferencedTypeName
            } );
        }
    }

    if ( targetObject.type === _unassignedGroup ) {
        eventBus.publish( 'Pca0VariabilityExplorerTree.removeChildren', {
            sourceObjects : sourceObjectThreads,
            targetObject : sourceParentObject,
            removeOperationType: operationType,
            sourceObjectBOs: sourceObjects
        } );
    } else {
        eventBus.publish( 'Pca0VariabilityExplorerTree.addChildren', {
            sourceObjects : sourceObjectThreads,
            targetObject : targetObject,
            sourceParentObject : sourceParentObject,
            addOperationType: operationType,
            sourceObjectBOs: sourceObjects
        } );
    }
};

/**
 * This function will decide whether the target objects is allowed to drag.
  * @param {Object} targetObjects - Target objects for drop operation
  * @returns {Boolean} - True if the target drag is allowed.
  */
const _isDragAllowed = ( targetObjects ) => {
    const firstTargetObject = targetObjects[0];
    const firstTargetTypeHierarchy = _.get( firstTargetObject, _typeHierarchyArray, [] );

    // Check for Features tab
    let isDragAllowed = appCtxSvc.getCtx( _clientScopeURI ) === veConstants.CLIENT_SCOPE_URI.FEATURES
        && ( targetObjects.length > 1
            || targetObjects.length === 1
                && !firstTargetTypeHierarchy.includes( _confContext )
                && firstTargetObject.type !== _unassignedGroup );

    // Check for Models tab
    if ( !isDragAllowed ) {
        for ( const targetObject of targetObjects ) {
            const targetTypeHierarchy = _.get( targetObject, _typeHierarchyArray, [] );
            if ( !targetTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL ) ) {
                return false;
            }
        }
        return true;
    }

    return isDragAllowed;
};

/**
 * This function will decide whether the family move is allowed or not.
  * @param {Object} sourceObjects - Source objects for drop operation
  * @param {Object} targetObject - Target object for drop operation
  * @param {Object} targetTypeHierarchy - Type hierarchy of the target object
  * @returns {Boolean} - True if the family move is allowed.
  */
const _isFamilyDropAllowed = ( sourceObjects, targetObject, targetTypeHierarchy ) => {
    const validFamilyTypesToMove = [
        pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY,
        pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY
    ];

    const areAllFamilies = sourceObjects.every( sourceObject => {
        return pca0CommonUtils.doesObjectContainType( sourceObject, validFamilyTypesToMove );
    } );
    const allFamiliesAreOfSameGroup = sourceObjects.every( sourceObject => sourceObject.parentUID === sourceObjects[0].parentUID );
    const isGroupTarget = targetObject.type === _unassignedGroup
        || targetTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP );
    const droppingOnDifferentGroup = sourceObjects[0].parentUID !== targetObject.nodeUid;

    return areAllFamilies && allFamiliesAreOfSameGroup && isGroupTarget && droppingOnDifferentGroup;
};

/**
 * This function will decide whether the feature drop is allowed or not.
  * @param {Object} sourceTypeHierarchy - Type hierarchy of the source object
  * @param {Object} targetTypeHierarchy - Type hierarchy of the target object
  * @param {Object} clientScopeURI - Client scope URI
  * @returns {Boolean} - True if the feature drop is allowed.
  */
let _isFeatureDropAllowed = ( sourceTypeHierarchy, targetTypeHierarchy, clientScopeURI ) => {
    const allowedTargetTypesForFeature = [
        pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_VALUE,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_VALUE
    ];
    const allowedTargetTypesForModel = [
        pca0Constants.CFG_OBJECT_TYPES.TYPE_PRODUCT_MODEL,
        pca0Constants.CFG_OBJECT_TYPES.ABS_PRODUCT_LINE
    ];
    const isAllowedTDropOnFeatureTab = pca0CommonUtils.doesObjectContainType( '', allowedTargetTypesForFeature, targetTypeHierarchy );
    const isAllowedDropOnModelsTab = clientScopeURI === veConstants.CLIENT_SCOPE_URI.PRODUCTS && pca0CommonUtils.doesObjectContainType( '', allowedTargetTypesForModel, targetTypeHierarchy );
    return ( isAllowedTDropOnFeatureTab || isAllowedDropOnModelsTab )
        && sourceTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.TYPE_REVISION );
};

/**
  * This function will compare the source and target context and decide whether it is allocation action or not.
  * @param {Object} dataProvider - Source objects for drop operation
  * @param {Object} sourceObjects - Target object for drop operation
  * @param {Object} clientScopeURI - Client scope URI
  * @returns {Boolean} - True if the action is allocation.
  */
const _isAllocationAction = ( dataProvider, sourceObjects, clientScopeURI ) => {
    // If it is not features tab it can not be allocation action.
    if ( clientScopeURI !== veConstants.CLIENT_SCOPE_URI.FEATURES ) {
        return false;
    }
    const contextNodeOfTargetView = _.get( dataProvider, 'topTreeNode.children', [] )
        .find( node => _.get( node, _typeHierarchyArray, [] ).includes( _confContext ) );
    const contextUidOfSourceView = sourceObjects && sourceObjects[0] && sourceObjects[0].contextUid;
    return contextNodeOfTargetView.nodeUid !== contextUidOfSourceView;
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
  * This function will decide on which object drag start is allowed
  * @param {Object} dragAndDropParams - drag and drop parameters
  */
export const pca0DragStart = ( dragAndDropParams ) => {
    const targetObjects = dragAndDropParams.targetObjects;

    // In inline authoring mode, Drag and drop is not allowed.
    const isInlineAuthoringMode = appCtxSvc.getCtx( 'ConfiguratorCtx.inlineAuthoringContext.isInlineAuthoringMode' );
    if( isInlineAuthoringMode ) {
        dragAndDropParams.event.preventDefault();
        return;
    }

    if ( _isDragAllowed( targetObjects ) ) {
        // Storing the Current context details in the dragged object.
        const contextNode = _.get( dragAndDropParams, 'dataProvider.topTreeNode.children[0]' );
        if ( contextNode ) {
            const contextTypeHierarchy = _.get( contextNode, _typeHierarchyArray, [] );
            if ( contextTypeHierarchy.includes( _confContext ) ) {
                targetObjects[0].contextUid = contextNode.nodeUid;
            }
        }
        awDragAndDropUtils.cacheDraggedData( targetObjects );
    } else {
        dragAndDropParams.event.preventDefault();
    }
};

/**
  * This function will decide which object to be highlighted in the table
  * @param {Object} dragAndDropParams - drag and drop parameters
  * @returns {Object} - highlight effect
  */
export const pca0DragOver = ( dragAndDropParams ) => {
    // In inline authoring mode, Drag and drop is not allowed.
    const isInlineAuthoringMode = appCtxSvc.getCtx( 'ConfiguratorCtx.inlineAuthoringContext.isInlineAuthoringMode' );
    if( isInlineAuthoringMode ) {
        dragAndDropParams.event.preventDefault();
        return {
            dropEffect: 'none'
        };
    }

    const targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
    const sourceObjects = awDragAndDropUtils.getCachedDragData();
    if( targetObject && sourceObjects && dragAndDropParams.dataProvider ) {
        const clientScopeURI = appCtxSvc.getCtx( _clientScopeURI );

        // If the drop is on different context then we are considering it as allocation action.
        if ( _isAllocationAction( dragAndDropParams.dataProvider, sourceObjects, clientScopeURI ) ) {
            return _highlightElement( dragAndDropParams, true );
        }
        // Drop under same context is allowed on the following use cases -
        //  --Family is being moved to group.
        //  --Product model is being added to summary model as Summarized model.
        //  --Features being added to Package/Summary features or Product models as a member.
        // So only these objects will be highlighted while dragging.
        const firstSourceObject = sourceObjects[0];
        const targetTypeHierarchy = _.get( targetObject, _typeHierarchyArray, [] );
        const sourceTypeHierarchy = _.get( firstSourceObject, _typeHierarchyArray, [] );

        const isFamilyMoveAllowed = _isFamilyDropAllowed( sourceObjects, targetObject, targetTypeHierarchy );
        const isProductModelDropAllowed = targetTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_MODEL );
        const isFeatureDropAllowed = _isFeatureDropAllowed( sourceTypeHierarchy, targetTypeHierarchy, clientScopeURI );

        if ( isFamilyMoveAllowed || isProductModelDropAllowed || isFeatureDropAllowed ) {
            return _highlightElement( dragAndDropParams, false );
        }
    }
    _deHighlightElements();
    return {
        dropEffect: 'none'
    };
};

/**
  * This function will get the parent object of the source object and decide the drop action
  * @param {Object} dragAndDropParams - drag and drop parameters
  */
export const pca0Drop = ( dragAndDropParams ) => {
    const clientScopeURI = appCtxSvc.getCtx( _clientScopeURI );
    const sourceObjects = awDragAndDropUtils.getCachedDragData();
    let targetObject = dragAndDropParams.targetObjects ? dragAndDropParams.targetObjects[ 0 ] : null;
    const viewModelCollection = dragAndDropParams.dataProvider.getViewModelCollection();

    // In case of dropping on different context we are considering this as allocation action.
    if( _isAllocationAction( dragAndDropParams.dataProvider, sourceObjects, clientScopeURI ) ) {
        targetObject = viewModelCollection.loadedVMObjects[0];
        _confirmAllocationAction( sourceObjects, targetObject );
        return;
    }

    // Getting parent object of the source object.
    const parentNodeIndex = viewModelCollection.findViewModelObjectById( sourceObjects[ 0 ].parentUID );
    const sourceParentObject = viewModelCollection.getViewModelObject( parentNodeIndex );

    // For Family moving use case we are showing user a confirmation message.
    // For other drag and drop use case no confirmation message is there.
    if ( sourceObjects && targetObject ) {
        const validFamilyTypes = [
            pca0Constants.CFG_OBJECT_TYPES.ABS_LITERAL_VALUE_FAMILY,
            pca0Constants.CFG_OBJECT_TYPES.ABS_PACKAGE_OPTION_FAMILY,
            pca0Constants.CFG_OBJECT_TYPES.ABS_SUMMARY_OPTION_FAMILY,
            pca0Constants.CFG_OBJECT_TYPES.ABS_FEATURE_FAMILY
        ];
        const isFamilyIsBeingMoved = pca0CommonUtils.doesObjectContainType( sourceObjects[0], validFamilyTypes );
        if( isFamilyIsBeingMoved && sourceParentObject ) {
            const isSourceParentIsModifiable = _.get( sourceParentObject, 'props.is_modifiable.dbValue' ) === true;
            if( !isSourceParentIsModifiable && sourceParentObject.type !== _unassignedGroup ) {
                const groupDisplayName = sourceParentObject.cellHeader1;
                messagingService.showError( _localeTextBundle.moveFamilyError.replace( '{0}', groupDisplayName ) );
                _deHighlightElements();
                return;
            }
            _confirmationOnFamilyMoveAction( sourceObjects, targetObject, sourceParentObject );
        } else {
            _deHighlightElements();
            eventBus.publish( 'Pca0VariabilityExplorerTree.addChildren', {
                sourceObjects : sourceObjects,
                targetObject : targetObject,
                sourceParentObject : sourceParentObject,
                addOperationType: 'dragAndDropProductModelsOrFeatures'
            } );
        }
    }
    // clears cache data when drop operation is performed which restrict to reuse dragged object for new drag and drop operation
    awDragAndDropUtils._clearCachedData();
};

export default exports = {
    pca0DragStart,
    pca0DragOver,
    pca0Drop
};
