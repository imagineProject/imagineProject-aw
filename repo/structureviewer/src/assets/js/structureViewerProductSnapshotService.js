
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import eventBus from 'js/eventBus';
import popupService from 'js/popupService';
import cdm from 'soa/kernel/clientDataModel';
import logger from 'js/logger';
import appCtxSvc from 'js/appCtxService';

let exports = {};
let loadingProductSnapshot = false;

/**
 * Sets up the snapshot selection
 * @param {Object} snapshotSelection newly selected snapshot
 * @param {Object} currentProductSnapshot current selected snapshot shows on list
 * @returns {Object} updated state
 */
const setupSnapshotSelection = ( snapshotSelection, currentProductSnapshot ) => {
    const _currentProductSnapshot = { ...currentProductSnapshot };
    _currentProductSnapshot.uiValue = snapshotSelection.cellHeader1;
    popupService.hide();
    return {
        currentProductSnapshot: _currentProductSnapshot,
        selectedProductSnapshot: snapshotSelection,
        renderProductSnapshot:true
    };
};

/**
 * Gets the product snapshot viewer context to load product snapshot
 * @param {Object} productSnapshot input product snapshot
 * @returns {Promise} promise which resolves with context
 */
const getProductSnapshotViewerContext = ( productSnapshot )=>{
    var deferred = AwPromiseService.instance.defer();
    if( loadingProductSnapshot ) {
        return deferred.resolve( 'Already loading snapshot' );
    }
    loadingProductSnapshot = true;
    let inputProductSnapshot = productSnapshot;
    let itemRevisionUid = '';
    if( inputProductSnapshot && inputProductSnapshot.props && inputProductSnapshot.props.fnd0Roots ) {
        itemRevisionUid = inputProductSnapshot.props.fnd0Roots.dbValues[ 0 ];
    } else if( inputProductSnapshot && inputProductSnapshot.uid ) {
        const snapshotObject = cdm.getObject( inputProductSnapshot.uid );
        itemRevisionUid = snapshotObject.props.fnd0Roots.dbValues[ 0 ];
    } else {
        var selectedMO = appCtxSvc.getCtx( 'mselected' );
        if( selectedMO && selectedMO.length > 0 && selectedMO[0].type === 'Fnd0Snapshot' ) {
            inputProductSnapshot = selectedMO[0];
            itemRevisionUid = inputProductSnapshot.props.fnd0Roots.dbValues[ 0 ];
        } else {
            loadingProductSnapshot = false;
            return deferred.reject( 'No snapshot selected' );
        }
    }
    const product = {
        uid: itemRevisionUid,
        type: 'ItemRevision'
    };
    const requestPref = {
        expandedNodes: [],
        includePath: [
            'true'
        ],
        loadTreeHierarchyThreshold: [
            '50'
        ],
        displayMode: [
            'Tree'
        ],
        showExplodedLines: [
            'false'
        ],
        savedSessionMode: [
            'reset'
        ],
        calculateFilters: [
            'false'
        ],
        viewType: [
            ''
        ],
        useGlobalRevRule: [
            'false'
        ],
        startFreshNavigation: [
            'true'
        ],
        defaultClientScopeUri: [
            'Awb0OccurrenceManagement'
        ],
        snapshot: [
            inputProductSnapshot.uid
        ],
        userGesture: [
            'APPLY_SNAPSHOT'
        ]
    };
    const cursor = {
        startReached: false,
        endReached: false,
        startIndex: 0,
        endIndex: 0,
        pageSize: 250,
        startOccUid: '',
        endOccUid: '',
        cursorData: []
    };
    const expansionCriteria = {
        expandBelow: false,
        levelNExpand: 0,
        loadTreeHierarchyThreshold: 0,
        scopeForExpandBelow: ''
    };

    const soaInput = {
        inputData: {
            product: product,
            requestPref: requestPref,
            expansionCriteria: expansionCriteria,
            cursor: cursor
        }
    };
    soaSvc.post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', soaInput )
        .then( function( response ) {
            const topElementUid = response.parentOccurrence.occurrenceId;
            let _localContext = {
                context : {
                    occContext:{
                        productContextInfo:response.rootProductContext,
                        viewKey: 'occmgmtContext',
                        topElement:response.ServiceData.modelObjects[topElementUid],
                        rootElement:response.ServiceData.modelObjects[topElementUid],
                        openedElement:response.ServiceData.modelObjects[topElementUid]
                    },
                    contextKey: 'occmgmtContext',
                    isOutsideACE: true
                }
            };
            eventBus.publish( 'viewer.productSnapshotSelectionChanged', { productContextInfo:response.rootProductContext, snapshotUid:inputProductSnapshot.uid } );
            loadingProductSnapshot = false;
            deferred.resolve( {
                productSnapshotViewerContext:_localContext,
                enableStructureViewer: true
            }
            );
        } ).catch( function( error ) {
            logger.error( 'Error in getOccurrences4 ' + error );
            deferred.reject( error );
        }   );
    return deferred.promise;
};


export default exports = {
    setupSnapshotSelection,
    getProductSnapshotViewerContext
};
