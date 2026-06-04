// Copyright (c) 2025 Siemens
/* global JSCom */

/**
 * This leaf structure service provider
 *
 * @module js/viewerLeafStructureManagerProvider
 */
import _ from 'lodash';
import assert from 'assert';
import logger from 'js/logger';
import viewerSelMgrProvider from 'js/viewerSelectionManagerProvider';
import { VIEWER_INVISIBLE_CSID_TOKEN, VIEWER_INVISIBLE_EXCEPTION_CSID_TOKEN } from 'js/viewerVisibilityManagerProvider';
import eventBus from 'js/eventBus';
import viewerPreferenceService from 'js/viewerPreference.service';
import iconSvc from 'js/iconService';
import '@swf/ClientViewer';

const GEOANALYSIS_LEAF_STRUCT_TARGET_MO = 'targetmo';
const GEOANALYSIS_LEAF_STRUCT_IS_TARGET_INVISIBLE = 'isTargetInVisible';
const GEOANALYSIS_LEAF_STRUCT_TARGET_CSID = 'targetCSID';
const GEOANALYSIS_LEAF_STRUCT_TREE_DATA = 'leafStructureData';
const GEOANALYSIS_HAS_LEAF_STRUCT_DATA = 'hasLeafStructdata';
const GEOANALYSIS_LEAF_STRUCT_SELECTION_DATA = 'leafStructSelectionData';
const GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA = 'leafStructCurrentSelectionData';
const ROOT_CSID = '';

/**
 * Provides an instance of viewer leaf structure manager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 *
 * @return {ViewerLeafStructureManager} Returns viewer pmi manager
 */
export let getLeafStructureManager = function( viewerView, viewerContextData ) {
    return new ViewerLeafStructureManager( viewerView, viewerContextData );
};

/**
 * Class to hold the viewer leaf structure data
 *
 * @constructor ViewerLeafStructureManager
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class ViewerLeafStructureManager {
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null in PMI' );
        assert( viewerContextData, 'Viewer context data can not be null in PMI' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
        this.leafStructureDataState = null;
        this.jtPropNamesToTreeNodeMap = new Map();
        this.initialize();
        this.leafStructDataToExpandAndFocus = [];
        this.isNavigateSelectionOn = false;
        this.selectionOccArray = [];
    }

    /**
     * Initialize
     */
    initialize() {
        this.leafSelectionHandler = new ViewerLeafStructureSelectionHandler( this.viewerView, this.viewerContextData );
    }

    /**
     * setupAtomicDataTopics when panel is revealed
     */
    setupAtomicDataTopicsOnReveal() {
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( viewerSelMgrProvider.SELECTED_CSID_KEY, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( VIEWER_INVISIBLE_CSID_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( VIEWER_INVISIBLE_EXCEPTION_CSID_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().subscribe( this.viewerContextData.SUBNODE_VISIBILITY_CHANGED, this );
    }

    /**
     * Handle viewer atomic data update
     * @param {String} topic topic
     * @param {Object} data updated data
     */
    update( topic, data ) {
        if( topic === viewerSelMgrProvider.SELECTED_CSID_KEY ) {
            this.subNodeStructure = null;
            this.isNewSelection = true;
            if( Array.isArray( data ) ) {
                let currentTarget = ViewerLeafStructureManager.getSanitizedCSIDString( this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID ) );
                let newTarget = data.length > 0
                    ? ViewerLeafStructureManager.getSanitizedCSIDString( data[data.length - 1] )
                    : '';

                let needUpdate = false;
                const newSelectionKeys = new Set( data.map( item => ViewerLeafStructureManager.getSanitizedCSIDString( item ) ) );
                for ( let i = this.selectionOccArray.length - 1; i >= 0; i-- ) {
                    const occ = this.selectionOccArray[i];
                    const sanitizedCSID = ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr );
                    //remove the occ from selectionOccArray if it is not present in new selection
                    if ( !newSelectionKeys.has( sanitizedCSID ) ) {
                        this.selectionOccArray.splice( i, 1 );
                    } else{
                        needUpdate = true;
                    }
                }

                let handleTargetChange = ( newTarget, needUpdate, isReloadNeeded = false ) => {
                    if( !this.isNavigateSelectionOn ) {
                        this.need3dUpdate = needUpdate;
                        let otherPartOCC = [];
                        //get the selected leaf node occurrences for new target, if it is available
                        for ( let i = 0; i < this.selectionOccArray.length; i++ ) {
                            const occ = this.selectionOccArray[i];
                            if ( ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr ) === newTarget ) {
                                otherPartOCC.push( occ );
                            }
                        }
                        if( otherPartOCC.length > 0 ) {
                            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, otherPartOCC  );
                            this.leafStructDataToExpandAndFocus = otherPartOCC;
                            this.isNavigateSelectionOn = true;
                            if( isReloadNeeded ) {
                                this.updatingLeafCtx = true;
                                eventBus.publish( 'LeafStructDataProvider.reload' );
                            }
                        }
                    }
                };

                if( currentTarget !== newTarget ) {
                    if( this.selectionChangedVia3D ) {
                        this.selectionChangedVia3D = false;
                    }else{
                        this.updatingLeafCtx = true;
                        handleTargetChange( newTarget, needUpdate, false  );
                    }
                    eventBus.publish( 'LeafStructDataProvider.clearAndReload' );
                } else {
                    if( this.selectionChangedVia3D ) {
                        this.selectionChangedVia3D = false;
                    } else {
                        handleTargetChange( newTarget, needUpdate, true );
                    }
                }
            }
        } else if( topic === VIEWER_INVISIBLE_CSID_TOKEN || topic === VIEWER_INVISIBLE_EXCEPTION_CSID_TOKEN || topic === this.viewerContextData.SUBNODE_VISIBILITY_CHANGED ) {
            setTimeout( () => {
                this.regenerateLeafTreeData().then( () => {
                    eventBus.publish( 'LeafStructDataProvider.updatevmos' );
                } );
            }, 500 );
        }
    }

    /**
     * get leaf structure data for selected context
     *
     * @param {object} leafStructureDataState selection model object
     */
    setupLeafStructureDataOnReveal( leafStructureDataState ) {
        this.leafStructureTabOpened = true;
        this.leafStructureDataState = leafStructureDataState;
        this.setupAtomicDataTopicsOnReveal();
        this.updateCtxWithCurrentSelection();
        this.leafSelectionHandler.setupSelectionListener();
    }

    /**
     * update leaf structure data state
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @param {Object} propertyValue value to be set on that path
     */
    updateLeafStructureDataState( propertyPath, propertyValue ) {
        if( this.leafStructureDataState ) {
            const newLeafStructureData = { ...this.leafStructureDataState.getValue() };
            newLeafStructureData[ propertyPath ] = propertyValue;
            this.leafStructureDataState.update( newLeafStructureData );
        }
    }

    /**
     * get value on leaf structure data state
     *
     * @param {Object} propertyPath path of property on atomic data value
     * @returns {Object} value on requested property path
     */
    getValueOnLeafStructureData( propertyPath ) {
        if( this.leafStructureDataState ) {
            return _.get( this.leafStructureDataState.getValue(), propertyPath );
        }
        return null;
    }

    /**
     * Update context with selection changes
     */
    updateCtxWithCurrentSelection() {
        let targetCSID = null;
        let targetMO = null;
        let viewerSelectionCSIDS = this.viewerContextData.getValueOnViewerAtomicData( viewerSelMgrProvider.SELECTED_CSID_KEY );
        if( _.isEmpty( viewerSelectionCSIDS ) ) {
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID, '' );
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TARGET_MO, [ this.viewerContextData.getCurrentViewerProductContext() ] );
        } else {
            let viewerSelectionModels = this.viewerContextData.getSelectionManager().getSelectedModelObjects();
            targetCSID = viewerSelectionCSIDS.slice( -1 )[ 0 ];
            targetMO = viewerSelectionModels.slice( -1 )[ 0 ];
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID, targetCSID );
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TARGET_MO, targetMO );
        }

        // Check if current viewer selection CSIDs are available in selectionOccArray
        if( Array.isArray( viewerSelectionCSIDS ) && viewerSelectionCSIDS.length > 0 ) {
            viewerSelectionCSIDS.forEach( csid => {
                let sanitizedCSID = ViewerLeafStructureManager.getSanitizedCSIDString( csid );
                let found = this.selectionOccArray.some( occ =>
                    ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr ) === sanitizedCSID
                );
                if( !found ) {
                    this.selectionOccArray.push( this.viewerContextData.getViewerCtxSvc().createViewerOccurance( csid, this.viewerContextData ) );
                }
            } );
        }

        var isInVisible = this.isTargetInVisible();
        this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_IS_TARGET_INVISIBLE, isInVisible );
        this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TREE_DATA, null );
    }

    /**
     * Returns target's visiblity
     * @returns {Boolean} boolean indicating if current target is invisible or not
     */
    isTargetInVisible() {
        let leafStructTargetCsid = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID );
        leafStructTargetCsid = leafStructTargetCsid === '/' ? '' : leafStructTargetCsid;
        let visibility = this.viewerContextData.getVisibilityManager().getProductViewerVisibility( leafStructTargetCsid );
        // eslint-disable-next-line sonarjs/prefer-single-boolean-return
        if( visibility === this.viewerContextData.getVisibilityManager().VISIBILITY.PARTIAL ||
            visibility === this.viewerContextData.getVisibilityManager().VISIBILITY.INVISIBLE ) {
            return true;
        }
        return false;
    }

    /**
     * Get leaf node structure
     * @param {Object} parentNode parent node
     * @returns {Promise} Returns leaf structure after loading successfully
     */
    fetchLeafStructureData( parentNode ) {
        this.topNodeProcessing = false;
        if( parentNode?.id === 'leafStructTop' ) {
            this.topNodeProcessing = true;
        }
        this.ignoreSelectionChange = false;

        let selectionData = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA );
        //if there is a selection in a tree, while changing tab, tree data will reload and the previous selection will be removed.
        // This will be consider as selection change.So to avoid that setting a flag to ignore that update
        if( !this.isNewSelection && !this.isNavigateSelectionOn && this.leafStructureTabOpened
            && Array.isArray( selectionData ) && selectionData.length !== 0 ) {
            this.ignoreSelectionChange = true;
            this.leafStructureTabOpened = false;
        }
        if( this.isNavigateSelectionOn && !this.isNewSelection ) {
            let finalRes = {};
            this.subNodeStructure = this.getSubNodeStructure();
            finalRes.data = { ...this.subNodeStructure };
            return finalRes;
        }
        let parentUid = parentNode && parentNode.parentUid ? parentNode.parentUid : 'leafStructTop';
        return this.getLeafNodeStructure( parentNode?.occ ? parentNode.occ : this.getTargetOccurrence(), parentUid );
    }

    /**
     * Get leaf structure for given occurrence
     * @param {JSCom.EMM.Occurrence} occurrence Occurrence for which leaf structure is to be queried
     * @returns {Promise} promise that resolved after success
     */
    getLeafNodeStructure( occurrence, parentUid ) {
        return this.viewerView.productStructureMgr.getOccStructureInfo( occurrence, {
            attributes: [ this.viewerContextData.OccOptions.VISIBILITY, this.viewerContextData.OccOptions.SELECTION, this.viewerContextData.OccOptions.REFSET ],
            depth: 10
        } ).then( productStr => {
            if( this.topNodeProcessing && productStr && !productStr.name ) {
                this.updateLeafStructureDataState( GEOANALYSIS_HAS_LEAF_STRUCT_DATA, false );
            } else {
                this.updateLeafStructureDataState( GEOANALYSIS_HAS_LEAF_STRUCT_DATA, true );
            }
            if( this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TREE_DATA ) === null && !this.isNavigateSelectionOn ) {
                this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, [ this.getTargetOccurrence() ] );
            }
            this.subNodeStructure = {};
            this.generateLeafStructureData( [ productStr ], parentUid );
            let finalRes = {};
            finalRes.data = { ...this.subNodeStructure };
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TREE_DATA, { ...finalRes } );
            return finalRes;
        } );
    }

    generateLeafStructureData( nodeArray, parentUid ) {
        let nodeValues = [];
        _.forEach( nodeArray, node => {
            let nodeVal = {};
            if( node ) {
                nodeVal.displayName = node.name;
                if( node.occ?.type !== viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain && node.occ.theJtPropNames
                    && node.occ.theJtPropNames.length > 0 ) {
                    nodeVal.uid = node.occ.theJtPropNames[ node.occ.theJtPropNames.length - 1 ];
                } else {
                    nodeVal.uid = node.name;
                }
                nodeVal.isLeaf = !Array.isArray( node.children ) || node.children.length <= 0;
                nodeVal.parentUid = parentUid;
                nodeVal.visibility = node.visibility;
                nodeVal.isDisabled = false;
                if( !_.isUndefined( node.refSetVisibility ) && !_.isNull( node.refSetVisibility ) ) {
                    nodeVal.isDisabled = !node.refSetVisibility;
                }
                nodeVal.occ = node.occ;
                nodeVal.leafHandler = this;
                nodeVal.leafNodeVisibilityIconURL = ViewerLeafStructureManager.getLeafTreeNodeVisibilityIconUrl( node.visibility );
                nodeVal.props = {
                    leafStructNodeIcon: {
                        name: 'leafStructNodeIcon',
                        type: 'STRING',
                        value: nodeVal.leafNodeVisibilityIconURL
                    },
                    leafStructColName: {
                        name: 'leafStructColName',
                        type: 'STRING',
                        value: node.name,
                        uiValue: node.name
                    }
                };
                nodeValues.push( nodeVal );
                // if( Array.isArray( node.occ?.theJtPropNames ) && node.occ.theJtPropNames.length > 0 ) {
                //     this.jtPropNamesToTreeNodeMap.set( node.occ.theJtPropNames[ node.occ.theJtPropNames.length - 1 ], nodeVal );
                // }
                this.jtPropNamesToTreeNodeMap.set( nodeVal.uid, nodeVal );
            }
        } );
        this.subNodeStructure[ parentUid ] = nodeValues;
        _.forEach( nodeArray, node => {
            if( Array.isArray( node.children ) && node.children.length > 0 ) {
                let uid;
                if( node.occ?.type !== viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain && node.occ.theJtPropNames
                    && node.occ.theJtPropNames.length > 0 ) {
                    uid = node.occ.theJtPropNames[ node.occ.theJtPropNames.length - 1 ];
                } else {
                    uid = node.name;
                }
                this.generateLeafStructureData( node.children, uid );
            }
        } );
    }

    /**
     * Get leaf tree node visibility state
     * @param {Number} visibility current state of visibility
     * @returns {String} icon url based on visibility state
     */
    static getLeafTreeNodeVisibilityIconUrl( visibility ) {
        if( visibility === 0 ) {
            return iconSvc.getTypeIconFileUrl( 'indicatorHidden16.svg' );
        } else if( visibility === 1 ) {
            return iconSvc.getTypeIconFileUrl( 'indicatorPartiallyShown16.svg' );
        } else if( visibility === 2 ) {
            return iconSvc.getTypeIconFileUrl( 'indicatorShown16.svg' );
        }
        return null;
    }

    regenerateLeafTreeData() {
        return this.viewerView.productStructureMgr.getOccStructureInfo( this.getTargetOccurrence(), {
            attributes: [ this.viewerContextData.OccOptions.VISIBILITY, this.viewerContextData.OccOptions.SELECTION, this.viewerContextData.OccOptions.REFSET ],
            depth: 10
        } ).then( productStr => {
            if( productStr && !productStr.name ) {
                this.updateLeafStructureDataState( GEOANALYSIS_HAS_LEAF_STRUCT_DATA, false );
            } else {
                this.updateLeafStructureDataState( GEOANALYSIS_HAS_LEAF_STRUCT_DATA, true );
            }
            this.subNodeStructure = {};
            this.generateLeafStructureData( [ productStr ], 'leafStructTop' );
            let finalRes = {};
            finalRes.data = { ...this.subNodeStructure };
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_TREE_DATA, { ...finalRes } );
        } );
    }

    /**
     * Perform selection in 3D
     * @param {Object} leafStructDataProvider leaf structure data provider
     */
    updateLeafTreeDataFromCachedMap( leafStructDataProvider ) {
        let viewModelCollection = leafStructDataProvider.getViewModelCollection();
        let modifiedVMOs = [];
        _.forEach(  viewModelCollection.getLoadedViewModelObjects(), vmo => {
            const updatedNode = this.jtPropNamesToTreeNodeMap.get( vmo.id );
            let modifiedVMO = { ...vmo };
            modifiedVMO.visibility = updatedNode.visibility;
            modifiedVMO.isDisabled = updatedNode.isDisabled;
            modifiedVMO.leafNodeVisibilityIconURL = updatedNode.leafNodeVisibilityIconURL;
            modifiedVMOs.push( modifiedVMO );
        } );
        leafStructDataProvider.update( modifiedVMOs );
        this.viewerView.selectionMgr.select( [ ...this.selectionOccArray ] );
    }

    /**
     * Get leaf structure for given occurrence
     * @param {Boolean} isEnable is sub node structure enabled
     * @returns {Promise} promise that resolved after success
     */
    enableSubNode( isEnable ) {
        return this.viewerView.productStructureMgr.enableSubNode( isEnable );
    }

    /**
     * Perform selection in 3D
     * @param {Object} leafStructDataProvider leaf structure data provider
     * @param {Object} eventData event data
     */
    updateLeafNodeSelectionIn3D( leafStructDataProvider, eventData ) {
        if( this.updatingLeafCtx ) {
            this.updatingLeafCtx = false;
            return;
        }
        if( this.isNavigateSelectionOn ) {
            this.isNavigateSelectionOn = false;
            if( eventData.selectedUids.length === 1 ) {
                const gridId = 'leafStructureGrid';
                const viewModelCollection = leafStructDataProvider.getViewModelCollection();
                const rowIdx = viewModelCollection.findViewModelObjectById( eventData.selectedUids[0] );
                const columnIdx = 1;
                // build the element ID and focus on the element
                // Note: rowIdx and columnIdx is 0-based index, but the grid uses 1-based index for rows and columns
                // so we add 2 to rowIdx (1 for header row and 1 for 0-based index) and 1 to columnIdx (0-based index)
                const elementId = `#${gridId}_row${rowIdx + 2}_col${columnIdx}`;
                const focusElement = () => {
                    const element = document.querySelector( elementId );
                    if ( element ) {
                        element.focus();
                        clearInterval( intervalId );
                    }
                };
                const intervalId = setInterval( focusElement, 100 );
                setTimeout( () => clearInterval( intervalId ), 5000 );
            }
        }
        let nodesToBeSelected = [];
        let selectedUids = eventData.selectedUids;
        for ( const nodeVal of this.jtPropNamesToTreeNodeMap.values() ) {
            if( selectedUids.includes( nodeVal.uid ) ) {
                nodesToBeSelected.push( nodeVal.occ );
            }
        }

        let leafStructTargetCsid = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID );
        let sanitizedCSID = ViewerLeafStructureManager.getSanitizedCSIDString( leafStructTargetCsid );

        //removing all the occurrences of target csid from selectionOccArray and updating using event data selection
        for ( let i = this.selectionOccArray.length - 1; i >= 0; i-- ) {
            const occ = this.selectionOccArray[i];
            if ( ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr ) === sanitizedCSID ) {
                this.selectionOccArray.splice( i, 1 );
            }
        }
        for ( const occ of nodesToBeSelected ) {
            this.selectionOccArray.push( occ );
        }
        if( this.ignore3DUpdate ) {
            this.ignore3DUpdate = false;
            return;
        }
        if( this.ignoreSelectionChange ) {
            this.ignoreSelectionChange = false;
            return;
        }

        let selectedNodes = leafStructDataProvider.getSelectedObjects();
        if( Array.isArray( selectedNodes ) && selectedNodes.length > 0 ) {
            if( !Array.isArray( nodesToBeSelected )  ) {
                nodesToBeSelected = [];
            }
            _.forEach( selectedNodes, node => {
                nodesToBeSelected.push( node.occ );
            } );
        }
        if( this.selectionOccArray.length > 0 ) {
            this.viewerView.selectionMgr.select( [ ...this.selectionOccArray ] );
        } else{
            this.viewerView.selectionMgr.select( [] );
        }

        if( Array.isArray( nodesToBeSelected ) && nodesToBeSelected.length > 0 ) {
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, [ ...nodesToBeSelected ] );
        }else {
            this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, [] );
        }
    }

    /**
     * Get CSID occurrence for target object
     * @return {JSCom.EMM.Occurrence} CSID occurrence for target object
     */
    getTargetOccurrence() {
        const occCSID = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID );
        return this.viewerContextData.getViewerCtxSvc().createViewerOccurance( occCSID, this.viewerContextData );
    }

    /**
     * Select nodes in tree
     * @param {Object} dataProvider leaf structure data provider 
     */
    selectInLeafStructTree( dataProvider ) {
        let nodesToBeSelected = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA );
        if( !Array.isArray( nodesToBeSelected ) || nodesToBeSelected.length < 1 ) {
            dataProvider.selectionModel.setSelection( [] );
            this.ignore3DUpdate = false;
            return;
        }
        let occStrs = [];
        let selectRootNode = false;
        _.forEach( nodesToBeSelected, occ => {
            if( Array.isArray( occ.theJtPropNames ) && occ.theJtPropNames.length > 0 ) {
                occStrs.push( occ.theJtPropNames[ occ.theJtPropNames.length - 1 ] );
            }else if( occ.type === viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain ) {
                selectRootNode = true;
            }
        } );
        let viewModelCollection = dataProvider.getViewModelCollection();
        let filteredVMOs = viewModelCollection.getLoadedViewModelObjects().filter( ( vmo ) => {
            let occJtProNameStr = null;
            if( Array.isArray( vmo.occ?.theJtPropNames ) && vmo.occ.theJtPropNames.length > 0 ) {
                occJtProNameStr = vmo.occ.theJtPropNames[ vmo.occ.theJtPropNames.length - 1 ];
            }
            if( selectRootNode && vmo.parentUid === 'leafStructTop' ) {
                return true;
            }
            return occStrs.includes( occJtProNameStr );
        } );

        let selectedVmoUids = [];
        let hasDifferentSelection = false;
        _.forEach( dataProvider.getSelectedObjects(), vmo => {
            selectedVmoUids.push( vmo.uid );
        } );

        _.forEach( filteredVMOs, vmo => {
            if( !selectedVmoUids.includes( vmo.uid ) ) {
                hasDifferentSelection = true;
                return false;
            }
        } );
        if( hasDifferentSelection ) {
            dataProvider.selectionModel.setSelection( filteredVMOs );
        }else{
            this.ignore3DUpdate = false;
        }
    }

    navigateAndSelectInTree( occsArray, csidOccs ) {
        if( !Array.isArray( occsArray ) ) {
            return;
        }
        let leafStructTargetCsid = ViewerLeafStructureManager.getSanitizedCSIDString( this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID ) );
        let otherPartOCC = [];

        let lastSelectedOccStr = null;
        if( occsArray.length > 0 ) {
            lastSelectedOccStr = ViewerLeafStructureManager.getSanitizedCSIDString( occsArray[ occsArray.length - 1 ].theStr );
        }
        let selectedStr = this.selectionOccArray.map( occ => occ.theStr ).filter( ( str, index, arr ) => arr.indexOf( str ) === index );
        let newSelectedStr = occsArray.map( occ => occ.theStr ).filter( ( str, index, arr ) => arr.indexOf( str ) === index );
        let removedElements = selectedStr.filter( str => !newSelectedStr.includes( str ) );

        //remove all the leaf occurrences from selectionOccArray and update using occsArray
        this.selectionOccArray = this.selectionOccArray.filter( occ => occ.type === viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain );
        _.forEach( occsArray, occ => {
            let sanitizedCSID = ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr );
            if( sanitizedCSID !== leafStructTargetCsid ) {
                if( lastSelectedOccStr && sanitizedCSID === lastSelectedOccStr ) {
                    otherPartOCC.push( occ );
                }
            }
            if(  occ.type === viewerPreferenceService.occurrenceTypeList.JtPropNameChain )  {
                this.selectionOccArray.push( occ );
            }
        } );

        if( otherPartOCC.length > 0 || removedElements.length > 0 ) {
            if( otherPartOCC.length > 0 ) {
                let selectionData = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA );
                //to check if selection is changed via 3D or not(not for new selection)
                if( Array.isArray( selectionData ) && selectionData.length === 0 ) {
                    this.selectionChangedVia3D = true;
                }
                this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, otherPartOCC );

                this.leafStructDataToExpandAndFocus = otherPartOCC;
                this.isNavigateSelectionOn = true;
                //if the selected node does't contain model object and the node that we are going to select have model object,
                //it will switch to model object tab, so publishing event to not to switch tab.
                eventBus.publish( 'awTab.selectLeafStructureTab' );
            }
            let allSelectedOCCs = [];
            for ( let i = 0; i < this.selectionOccArray.length; i++ ) {
                let sanitizedCSID = ViewerLeafStructureManager.getSanitizedCSIDString( this.selectionOccArray[i].theStr );
                if( sanitizedCSID !== '' ) {
                    // Remove the element if it already exists
                    const existingIndex = allSelectedOCCs.indexOf( sanitizedCSID );
                    if( existingIndex !== -1 ) {
                        allSelectedOCCs.splice( existingIndex, 1 );
                    }
                    allSelectedOCCs.push( sanitizedCSID );
                }
            }
            this.viewerContextData.getSelectionManager().notifyViewerSelectionChanged( allSelectedOCCs );
            return;
        }

        this.ignore3DUpdate = true;

        //processing non subnodes
        if( Array.isArray( csidOccs ) ) {
            _.forEach( csidOccs, occ => {
                if( ViewerLeafStructureManager.getSanitizedCSIDString( occ.theStr ) === leafStructTargetCsid ) {
                    occsArray.push( occ );
                    return false;
                }
            } );
        }

        this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA, occsArray );
        this.updateLeafStructureDataState( GEOANALYSIS_LEAF_STRUCT_SELECTION_DATA, occsArray );

        // If nothing is selected in 3D, selection will be handled by the update() method to point to the root node.
        if( Array.isArray( occsArray ) && occsArray.length > 0 ) {
            this.leafStructDataToExpandAndFocus = occsArray;
            this.isNavigateSelectionOn = true;
            eventBus.publish( 'LeafStructDataProvider.reloadAndExpand' );
        }
    }

    static getSanitizedCSIDString( csidStr ) {
        if( csidStr?.length > 0 && csidStr.slice( -1 ) === '/' ) {
            return csidStr.slice( 0, -1 );
        }
        return csidStr;
    }

    selectFromNewlyLoadedNodesInLeafStructTree( dataProvider, eventData ) {
        let newlyAddedNodes = eventData.treeLoadResult.childNodes;
        if( !Array.isArray( newlyAddedNodes ) || newlyAddedNodes.length < 1 ) {
            return;
        }
        if( !this.need3dUpdate ) {
            this.ignore3DUpdate = true;
        }else{
            this.need3dUpdate = false;
        }
        if ( Array.isArray( this.leafStructDataToExpandAndFocus ) && this.leafStructDataToExpandAndFocus.length > 0 ) {
            this.leafStructDataToExpandAndFocus = [];
        }
        if( this.isNewSelection ) {
            this.isNewSelection = false;
        }
        this.selectInLeafStructTree( dataProvider );
    }

    toggleLeafNodeVisibility( vmo ) {
        if( !vmo?.occ ) {
            logger.error( 'VMO does not have occurrence' );
            return;
        }
        this.viewerView.visibilityMgr.setVisible( [ vmo.occ ], vmo.visibility === 0, false ).then( ()=>{
            this.regenerateLeafTreeData().then( () => {
                eventBus.publish( 'LeafStructDataProvider.updatevmos' );
            } );
        } );
    }

    /**
     * Create sub node structure from jtPropNamesToTreeNodeMap
     * @returns {Object} Key-value object where keys are parent UIDs and values are arrays of child nodes
     */
    getSubNodeStructure() {
        const subNodeStructure = {};
        for( const [ , node ] of this.jtPropNamesToTreeNodeMap ) {
            const parentUid = node.parentUid;
            if( !subNodeStructure[ parentUid ] ) {
                subNodeStructure[ parentUid ] = [];
            }
            if( parentUid === 'leafStructTop' ) {
                let leafStructTargetCsid = this.getValueOnLeafStructureData( GEOANALYSIS_LEAF_STRUCT_TARGET_CSID );
                // Add the node whose 'occ.theStr' matches the current target to the 'leafStructTop' parent
                if(  node.occ.type === viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain  &&
                    ViewerLeafStructureManager.getSanitizedCSIDString( node.occ.theStr ) === ViewerLeafStructureManager.getSanitizedCSIDString( leafStructTargetCsid ) ) {
                    subNodeStructure[ parentUid ].push( node );
                }
            } else {
                subNodeStructure[ parentUid ].push( node );
            }
        }
        return subNodeStructure;
    }

    /**
     * Sync selection with ace tree
     */
    syncSelectionWithAceTree() {
        this.viewerContextData.updateViewerAtomicData( viewerSelMgrProvider.SYNC_SELECTION_WITH_ACE_TREE );
    }

    /**
     * Unsubscribe atomic data after panel is closed
     */
    cleanUpLeafStructure() {
        this.enableSubNode( false );
        this.selectionOccArray = [];
        this.syncSelectionWithAceTree();
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( viewerSelMgrProvider.SELECTED_CSID_KEY, this );
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( VIEWER_INVISIBLE_CSID_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( VIEWER_INVISIBLE_EXCEPTION_CSID_TOKEN, this );
        this.viewerContextData.getViewerAtomicDataSubject().unsubscribe( this.viewerContextData.SUBNODE_VISIBILITY_CHANGED, this );
        this.leafSelectionHandler.cleanupSelectionListener();
    }
}

/**
 * Class to handle the viewer leaf structure data selection
 *
 * @constructor ViewerLeafStructureSelectionHandler
 *
 * @param {Object} viewerView Viewer view
 * @param {Object} viewerContextData Viewer Context data
 */
class ViewerLeafStructureSelectionHandler {
    constructor( viewerView, viewerContextData ) {
        assert( viewerView, 'Viewer view can not be null in PMI' );
        assert( viewerContextData, 'Viewer context data can not be null in PMI' );
        this.viewerView = viewerView;
        this.viewerContextData = viewerContextData;
    }

    setupSelectionListener() {
        this.registeredSelectionListener = this.handleLeafStructureSelection.bind( this );
        this.viewerView.selectionMgr.addSelectionListener( this.registeredSelectionListener );
    }

    handleLeafStructureSelection( occurrences ) {
        if( occurrences ) {
            let occsToSelect = [];
            let csidChainOccs = [];
            _.forEach( occurrences, occurrence => {
                if( viewerPreferenceService.occurrenceTypeList.CloneStableUIDChain !== occurrence.type ) {
                    occsToSelect.push( occurrence );
                }else{
                    csidChainOccs.push( occurrence );
                }
            } );
            if( occsToSelect.length > 0 || occurrences.length === 0 || csidChainOccs.length > 0 ) {
                this.viewerContextData.getViewerLeafStructureMgr().navigateAndSelectInTree( occsToSelect, csidChainOccs );
            }
        }
    }

    cleanupSelectionListener() {
        this.viewerView.selectionMgr.removeSelectionListener( this.registeredSelectionListener );
    }
}

export default {
    GEOANALYSIS_LEAF_STRUCT_TARGET_MO,
    GEOANALYSIS_LEAF_STRUCT_TARGET_CSID,
    GEOANALYSIS_LEAF_STRUCT_IS_TARGET_INVISIBLE,
    GEOANALYSIS_LEAF_STRUCT_TREE_DATA,
    GEOANALYSIS_HAS_LEAF_STRUCT_DATA,
    GEOANALYSIS_LEAF_STRUCT_SELECTION_DATA,
    GEOANALYSIS_LEAF_STRUCT_CURRENT_SELECTION_DATA,
    getLeafStructureManager
};
