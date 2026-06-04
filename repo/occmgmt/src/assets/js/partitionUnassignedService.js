// Copyright (c) 2022 Siemens

/**
 * A service that manages the unassigned command specific service.<br>.
 *
 * @module js/partitionUnassignedService
 */
import _ from 'lodash';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import aceTreeLoadResultBuilderService from 'js/aceTreeLoadResultBuilderService';
import aceGetService from 'js/aceGetService';
import aceRemoveElementService from 'js/aceRemoveElementService';
import aceStructureEditService from 'js/aceStructureEditService';
import aceDataNavigatorService from 'js/aceDataNavigatorService';
import AwStateService from 'js/awStateService';
import discoveryFilterService from 'js/discoveryFilterService';

var exports = {};
var _addElementListener = null;
var _removeElementListener = null;
var _aceActiveContextChangedListener = null;
var _destroyUnassignedServiceListener = null;
var _TRUE = [ 'true' ];
var _FALSE = [ 'false' ];
var _RESTORE = [ 'restore' ];
let partitionI18nResource = 'OccmgmtPartitionMessages';
let partitionUnassignedReqPrefPoint = null;
let partitionExitUnassignedReqPrefPoint = null;
const UNASSIGNED_VIEW_KEY = 'occmgmtContext2';

//Once Split start supporting filters we should remove code between comment UNASSIGNED_FILTERING

//UNASSIGNED_FILTERING
var _exitUnassignedView = false;
//END->UNASSIGNED_FILTERING

let reloadVisContentOfUnassignedView = function( eventData, action ) {
    var unassignedViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
    let occContext2 = appCtxSvc.getCtx( unassignedViewKey );
    if( occContext2?.supportedFeatures?.Awb0UnassignedFeature ) {
        // Determine the operation based on the action
        let operation = action === 'assigned' ? 'removeElement' : 'addElement';
        let removedObjects = [];
        if( action === 'assigned' )  {
            // Get the UIDs of the removed elements
            let removedElementUIDs = eventData.addElementResponse.deleted ? eventData.addElementResponse.deleted : eventData.addElementResponse.ServiceData.deleted;
            _.forEach( removedElementUIDs, function( removedElementUID ) {
                var removedObject = appCtxSvc.ctx.mselected.filter( function( selected ) {
                    return selected.uid === removedElementUID;
                } );
                removedObjects.push.apply( removedObjects, removedObject );
            } );
        }

        // fire an event for vis to react.
        eventBus.publish( 'partitionMemberUpdatedEvent', {
            removedObjects: removedObjects,
            viewToReact: unassignedViewKey,
            operationName: operation,
            willPCIChangePostRemoveAction: false
        } );
    }
};

export let initializeUnassignedService = function() {
    appCtxSvc.registerCtx( 'unassignedView', { mode: true } );
    _exitUnassignedView = false;
    // Use Case:
    // When user assigned member to the partition on left side in unassigned view.
    // The 3D view of the right side should be updated.
    if( !_addElementListener ) {
        _addElementListener = eventBus.subscribe( 'addElement.elementsAdded', function( eventData ) {
            //In case of adding partitions, we do not require vis reload.
            if( eventData?.addElementResponse?.newElementInfos[0]?.newElements[0]?.occurrence?.type !== 'Fgf0PartitionElement' ) {
                reloadVisContentOfUnassignedView( eventData, 'assigned' );
            }
        } );
    }

    //Use Case:
    //When user does the unassigned member operation in the left view.
    //Then in order to show the correct content we need to inform to Vis to update the Vis.
    if( !_removeElementListener ) {
        _removeElementListener = eventBus.subscribe( 'ace.elementsRemoved', function( eventData ) {
            //In case of adding partitions, we do not require vis reload.
            if( eventData?.removedObjects[0]?.type !== 'Fgf0PartitionElement' ) {
                reloadVisContentOfUnassignedView( eventData, 'unassigned' );
            }
        } );
    }

    //Use Case:
    //When active context is right view but user launches filter panel in left view or vice versa,
    // we need to update the context key cache with the new active context.
    if ( !_aceActiveContextChangedListener ) {
        _aceActiveContextChangedListener = eventBus.subscribe( 'aceActiveContextChanged', function( ) {
            var activeContextKey = appCtxSvc.ctx.aceActiveContext.key;
            discoveryFilterService.setContextKey( activeContextKey );
        } );
    }

    //When user goes to home page we will have to destroy the unassigned view parameter to avoid the impact on other use cases.
    if( !_destroyUnassignedServiceListener ) {
        _destroyUnassignedServiceListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
            if ( eventData.name === 'splitView' && eventData.value === undefined && appCtxSvc.ctx.occmgmtContext2 !== undefined ) {
                if (  _removeElementListener  && appCtxSvc.ctx.unassignedView !== undefined && appCtxSvc.ctx.unassignedView.mode ) {
                    destroyUnassignedService();
                }
            }
        } );
    }
    exports.registerHandlerPreGetOccPartitionUnassignedExtPoints();
};

export let destroyUnassignedService = function() {
    //update the ctx values to correct as unassignView is going to destroy.
    appCtxSvc.unRegisterCtx( 'unassignedView' );
    _exitUnassignedView = true;

    //unsubscribe the subscribed event in the initialize service.
    eventBus.unsubscribe( _removeElementListener );
    eventBus.unsubscribe( _destroyUnassignedServiceListener );

    //take the global vars to their initial state.
    _removeElementListener = null;
    _destroyUnassignedServiceListener = null;
    _aceActiveContextChangedListener = null;
    exports.registerHandlerPreGetOccPartitionUnassignedExitExtPoints();
};


/**
 * This method update chip labels when props loaded event triggeres
 */
export let updateChipsOnPropsLoaded = function() {
    //In case of browser refresh or copy paste url.
    //The subscribed event in hte unassigned mode will get deregister and will have to register it.
    if( appCtxSvc.ctx.unassignedView === undefined ) {
        exports.initializeUnassignedService();
    }

    let partitionI18nResourceBundle = localeService.getLoadedText( partitionI18nResource );
    let separator = ' : ';
    var schemeNameChips = [];
    var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
    //get the productContext info of any view to get the applied partition scheme.
    let currProductContextInfo = appCtxSvc.getCtx( inactiveView ).productContextInfo;

    if( currProductContextInfo && currProductContextInfo.props ) {
        //scheme name
        let currentSchemeName = currProductContextInfo.props.fgf0PartitionScheme.uiValues[0];
        if( currentSchemeName ) {
            let schemeChipLabel = partitionI18nResourceBundle.PartitionScheme;
            schemeChipLabel = schemeChipLabel.concat( separator, currentSchemeName );
            schemeNameChips.push( getChip( schemeChipLabel ) );
        }
    }
    return schemeNameChips;
};

let getChip = ( value ) => {
    return {
        chipType: 'STATIC',
        labelDisplayName: value
    };
};

/**
 * Register the call back function for each and every property which needs to add as a part of overridden property policy.
 */
export let registerHandlerForOverriddenHeader = function( ) {
    exports.initializeUnassignedService();

    let partitionI18nResourceBundle = localeService.getLoadedText( partitionI18nResource );

    /**
     * A handler for the assigned view. It will be responsible to inject the right prefix label for the dual context header.
     */
    let partitionAssignedHeaderFunction = function( _response, finalOccContextValue ) {
        finalOccContextValue.headerDisplayLabelForApplication = partitionI18nResourceBundle.AssignedDisplayHeaderLabel;
    };

    let partitionAssignedHeaderExt = {
        key : 'partitionAssignedHeader', //unique identifier
        condition: ( soaInput, treeLoadInput, treeLoadOutput ) => {
            if( treeLoadOutput.supportedFeatures.Awb0AssignedFeature ) { return true; }
            return false;
        },
        addOccContextAtomicDataForUpdate: partitionAssignedHeaderFunction
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( partitionAssignedHeaderExt );


    /**
     * A handler for the unassigned view. It will be responsible to inject the right prefix label for the dual context header.
     */
    let partitionUnassignedHeaderFunction = function( _response, finalOccContextValue ) {
        finalOccContextValue.headerDisplayLabelForApplication = partitionI18nResourceBundle.UnassignedDisplayHeaderLabel;
    };

    let partitionUnassignedHeaderExt = {
        key : 'partitionUnassignedHeader', //unique identifier
        condition: ( soaInput, treeLoadInput, treeLoadOutput ) => {
            if( treeLoadOutput.supportedFeatures.Awb0UnassignedFeature ) { return true; }
            return false;
        },
        addOccContextAtomicDataForUpdate: partitionUnassignedHeaderFunction
    };
    aceTreeLoadResultBuilderService.registerOccContextAtomicDataProvider( partitionUnassignedHeaderExt );
};


/**
* Pre getOccurrences SOA extension point registration
*/
const registerHandlerPreGetOccPartitionUnassignedExtPoints = function() {
    let partitionUnassignedReqPrefCondition = function( ) {
        if( appCtxSvc.ctx.splitView && appCtxSvc.ctx.unassignedView !== undefined && appCtxSvc.ctx.unassignedView.mode ) {
            return true;
        }
        return false;
    };
    let partitionUnassignedReqPrefFunction = function( _loadInput, _occContext, _currentContext, _soaInput ) {
        // Check if the context is for 'occmgmtContext2' (Unassigned View)
        if ( _occContext.viewKey === UNASSIGNED_VIEW_KEY ) {
            // Disable adding/viewing secondary components in Unassigned View
            _soaInput.inputData.requestPref.PSEShowSecondaryComponentsPref = _FALSE;

            // Set unassigned mode if no product context info is available
            if ( !_currentContext.productContextInfo ) {
                _soaInput.inputData.requestPref.unassignedMode = _TRUE;
            }

            // Handle navigation preferences for unassigned context
            handleNavigationPreferences( _loadInput, _soaInput );
        } else {
            // Assigned View mode
            _soaInput.inputData.requestPref.assignedMode = _TRUE;

            // Handle navigation preferences for assigned context
            handleNavigationPreferences( _loadInput, _soaInput, true );
        }
    };

    //UNASSIGNED_FILTERING
    /**
     * Helper function to handle navigation preferences based on view type and URL parameters.
     * @param {Object} _loadInput - The input load parameters.
     * @param {Object} _soaInput - The SOA input object.
     * @param {boolean} preserveForDualContext - Flag to preserve startFreshNavigation for dualContextEnter in assigned context.
     */
    function handleNavigationPreferences( _loadInput, _soaInput, preserveForDualContext = false ) {
        let currentUrlParams = { ...AwStateService.instance.params };
        let tempStartFreshNavigation = _FALSE;
        if ( currentUrlParams.gesture !== undefined && currentUrlParams.gesture === 'dualContextEnter' ) {
            //for unassigned view we dont want to reuse the single context window hence do startFreshNavigation
            if ( !preserveForDualContext ) {
                tempStartFreshNavigation = _TRUE;
            }
            //Want to restore filters from single view for both the views
            _soaInput.inputData.requestPref.savedSessionMode = _RESTORE;
        }
        const gesturesWithNewWindow = [ 'EXCLUDED_TOGGLE_CHANGE', 'PACKALL', 'UNPACKALL', 'REFRESH' ];

        if ( _soaInput.inputData.requestPref.userGesture && _soaInput.inputData.requestPref.userGesture !== undefined &&
             gesturesWithNewWindow.includes( _soaInput.inputData.requestPref.userGesture[0] ) ) {
            //When filter toggle is turned ON/OFF, create new window. server will take care of restoring filters from old window.
            tempStartFreshNavigation = _TRUE;
        }
        _soaInput.inputData.requestPref.startFreshNavigation = tempStartFreshNavigation;
    }//END->UNASSIGNED_FILTERING

    partitionUnassignedReqPrefPoint = {
        key : 'partitionUnassignedModeHandler', //unique identifier
        condition: partitionUnassignedReqPrefCondition,
        populateGetOccInput: partitionUnassignedReqPrefFunction
    };
    aceGetService.registerGetOccInputProvider( partitionUnassignedReqPrefPoint );
};

//UNASSIGNED_FILTERING
const registerHandlerPreGetOccPartitionUnassignedExitExtPoints = function() {
    let partitionExitUnassignedReqPrefCondition = function( ) {
        return _exitUnassignedView;
    };

    let partitionUnassignedExitReqPrefFunction = function( _loadInput, _occContext, _currentContext, _soaInput ) {
        let tempStartFreshNavigation = _FALSE;
        //When user exits from unassigned mode with back button, dont reuse window.
        if ( _loadInput.openOrUrlRefreshCase !== undefined && _loadInput.openOrUrlRefreshCase === 'backButton' ) {
            tempStartFreshNavigation = _TRUE;
        }
        _soaInput.inputData.requestPref.startFreshNavigation = tempStartFreshNavigation;
        _exitUnassignedView = false;
    };

    partitionExitUnassignedReqPrefPoint = {
        key : 'partitionExitUnassignedModeHandler', //unique identifier
        condition: partitionExitUnassignedReqPrefCondition,
        populateGetOccInput: partitionUnassignedExitReqPrefFunction
    };
    aceGetService.registerGetOccInputProvider( partitionExitUnassignedReqPrefPoint );
};//END->UNASSIGNED_FILTERING

// Unregister the extension points on leaving the Unassigned Mode
const unregisterHandlerPreGetOccPartitionUnassignedExtPoints = function() {
    aceGetService.unregisterGetOccInputProvider( partitionUnassignedReqPrefPoint );
};

/**
* Constructs the SOA input for unassigning members from the partition
* @param {Object} subPanelContext - The context of the sub panel
* @returns {Object} The SOA input for unassigning members
*/
export let getUnassignMemberSOAInput = function( subPanelContext ) {
    let soaInput = {
        elementsToUnassign: []
    };
    let selectedObjects = subPanelContext.occContext.pwaSelection;
    let inactiveViewKey = occmgmtSplitViewUpdateService.getInactiveViewKey();
    let occContext2 = appCtxSvc.getCtx( inactiveViewKey );

    // Populate the elements array with the selected objects
    for( let index = 0; index < selectedObjects.length; index++ ) {
        let  element = {
            uid: selectedObjects[ index ].uid,
            type: selectedObjects[ index ].type
        };
        soaInput.elementsToUnassign.push( element );
    }

    let productInfo = aceDataNavigatorService.getProductInfoForCurrentSelection( selectedObjects[ 0 ], subPanelContext.occContext );

    soaInput.productContextInfo = {
        uid: productInfo.newPci_uid,
        type: 'Awb0ProductContextInfo'
    },
    // Set the sort criteria based on the inactive view context
    soaInput.sortCriteriaInUnassignedView = {
        propertyName: occContext2.sortCriteria && occContext2.sortCriteria.length > 0 ? occContext2.sortCriteria[0].fieldName : '',
        sortingOrder: occContext2.sortCriteria && occContext2.sortCriteria.length > 0 ? occContext2.sortCriteria[0].sortDirection : ''
    };

    return soaInput;
};

/**
* Processes partial errors for partition unassigned members
* @param {Object} serviceData - serviceData
* @returns {Object} The partial errors for partition unassigned members
*/
export let processPartitionUnassignedMemberPartialErrors = function( response ) {
    return aceRemoveElementService.processPartialErrors( response.ServiceData );
};

/**
* Processes partial errors for partition unassigned members
* @param {Object} response - unassignedMembers SOA response
* @returns {Object} The object containing unassigned elements and response
*/
export let getUnassignedSoaOutput = function( response ) {
    let unassignedElements = aceRemoveElementService.getRemovedElements( response.ServiceData );
    return {
        unassignedElements: unassignedElements,
        response: response
    };
};

/**
* Performs post unassign member action
* @param {Object} response - unassignedMembers SOA response
* @param {Array} unassignedElements - The unassigned elements
* @param {string} operationName - The name of the operation
* @param {Object} occContext - The context of the occurrence
* @returns {Object} The result of the post remove action
*/
export let performPostUnassignMemberAction = function( response, unassignedElements, operationName, occContext  ) {
    // Get the new element information from the response
    let newElementInfos = response.newElementInfos;
    let inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();

    // If the unassigned view context exists, update the view model collection and tree data provider
    if( inactiveView ) {
        let unassignedViewContext = appCtxSvc.getCtx( inactiveView );

        if( unassignedViewContext ) {
            let vmCollection = unassignedViewContext.vmc;
            let treeDataProvider = unassignedViewContext.treeDataProvider;
            aceStructureEditService.addElementsToLoadedVMO( vmCollection, { newElementInfos } );
            let loadedVMOs = vmCollection.getLoadedViewModelObjects();
            treeDataProvider.update( loadedVMOs );
        }
    }

    // Perform the post remove action and return the result
    return aceRemoveElementService.performPostRemoveAction( unassignedElements, operationName, occContext  );
};

export default exports = {
    initializeUnassignedService,
    destroyUnassignedService,
    updateChipsOnPropsLoaded,
    registerHandlerForOverriddenHeader,
    registerHandlerPreGetOccPartitionUnassignedExtPoints,
    unregisterHandlerPreGetOccPartitionUnassignedExtPoints,
    getUnassignMemberSOAInput,
    getUnassignedSoaOutput,
    processPartitionUnassignedMemberPartialErrors,
    performPostUnassignMemberAction,
    registerHandlerPreGetOccPartitionUnassignedExitExtPoints
};
