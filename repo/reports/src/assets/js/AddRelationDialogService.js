// Copyright (c) 2023 Siemens
import appCtxService from 'js/appCtxService';
import AwPanel from 'viewmodel/AwPanelViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwLabel from 'viewmodel/AwLabelViewModel';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import _ from 'lodash';
import confgItemRepSrvc from 'js/configureItemReportService';
import popupService from 'js/popupService';
import { ExistWhen, EnableWhen } from 'js/hocCollection';
import reportsCommonService from 'js/reportsCommonService';
import AwGuidanceMessage from 'viewmodel/AwGuidanceMessageViewModel';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import Rb0SegmentTree from 'viewmodel/Rb0SegmentTreeViewModel';
import awSearchService from 'js/awSearchService';
import filterPanelUtils from 'js/filterPanelUtils';
import aw_searchFilter from 'js/aw.searchFilter.service';
import AwReportTableService from 'js/AwReportTableService';
import addObjectUtils from 'js/addObjectUtils';
import searchCommonUtils from 'js/searchCommonUtils';

const AwCommandPanelSectionExistWhen = ExistWhen( AwCommandPanelSection );
const AwButtonEnableWhen = EnableWhen( AwButton );

const recursiveCondn = ( condnName, currTree, checkUid )=>{
    if( condnName === 'find' ) {
        return currTree?.value === checkUid;
    }
    return currTree?.children.length === 0;
};

/**
 * function for find In Tree
 * @param {*} tree the tree to search in
 * @param {*} nodeUid the UID of the node to find
 * @param {*} index the index of the node
 * @param {*} condnName the name of the condition
 * @returns {*} Index of the node
 */
const findInTree = ( tree, nodeUid, index, condnName ) =>{
    const flag = recursiveCondn( condnName, tree, nodeUid );
    if( flag ) {
        return { index:index, tree:tree };
    } else if( tree?.children ) {
        // FUTURE: This is for multiple childs, for tracing child number will need one more parameter like index
        // for( let i = 0; i < tree.children.length; i++ ) {
        //     return findInTree( tree.children[ i ], nodeUid, index );
        // }
        return findInTree( tree.children[0], nodeUid, index + 1, condnName );
    }
    return null;
};

const evaluateTreeAndTableHeight = ( popupHeight ) => {
    const fullHeight = '100%';
    if( popupHeight ) {
        return { treeHeight: 0.19 * popupHeight, tableHeight: 0.3761 * popupHeight };
    }
    return { treeHeight: fullHeight, tableHeight: fullHeight };
};

export const setStyles = ( elementRefList, popupHeight ) => {
    const { treeHeight, tableHeight } = evaluateTreeAndTableHeight( popupHeight );
    if( elementRefList.get( 'addRelationDialogTreeStyle' ).current ) {
        elementRefList.get( 'addRelationDialogTreeStyle' ).current.style.height = treeHeight;
        elementRefList.get( 'addRelationDialogTreeStyle' ).current.style.overflow = 'auto';
    }
    if( elementRefList.get( 'addRelationDialogTableStyle' ).current ) {
        elementRefList.get( 'addRelationDialogTableStyle' ).current.style.height = tableHeight;
    }
};

/**
 * render function for relation table popup
 * @param {*} props context for render function
 * @returns {JSX.Element} react component
 */
export const addRelationPoupupRenderFunction = ( props ) => {
    const { viewModel, actions, fields, subPanelContext, messages, elementRefList } = props;
    const { i18n, data, conditions } = viewModel;
    return (
        <AwPanel className='h-12'>
            <AwPanelBody>
                <AwCommandPanelSectionExistWhen existWhen={subPanelContext.reportsState.getValue().segmentTree?.length && subPanelContext.reportsState.getValue().segmentTree[0].children?.length > 0} caption={i18n.relations} collapsed='false' anchor='rb0_removeSegmentCommands' alignment='HORIZONTAL' context={{ selectedNode:fields.selectedNode, ...subPanelContext }}>
                    {
                        subPanelContext.searchState.getValue().selectedFiltersString?.length > 0 && subPanelContext.reportsState.getValue().reportParameters?.totalFound === 0 && <AwGuidanceMessage message={messages.conflictRelationMsg} closable='true' bannerStyle='true' showIcon='true' icon='indicatorError16' showType='false'></AwGuidanceMessage>
                    }
                    <div className={'sw-flex-row aw-reports-segmentTree'} ref={elementRefList.get( 'addRelationDialogTreeStyle' )}>
                        <Rb0SegmentTree subPanelContext={subPanelContext} segmentTree={subPanelContext.reportsState.getValue().segmentTree} />
                    </div>
                </AwCommandPanelSectionExistWhen>
                <AwPanelSection caption={i18n.chooseRelation} collapsed='false'>
                    {
                        conditions.noRelationsAvailable &&
                        <AwGuidanceMessage message={messages.noRelationsFoundMsg} closable='true' bannerStyle='true' showIcon='true' showType='false'></AwGuidanceMessage>
                    }
                    {
                        data.falseMultipleSelectionMsg &&
                        <AwGuidanceMessage message={messages.falseMultipleSelectionMsg} closable='false' bannerStyle='false' showIcon='true' showType='false'></AwGuidanceMessage>
                    }
                    <AwLabel className='aw-reports-chooseRelationLabel' {...fields.chooseRelation}></AwLabel>
                    <div className={'sw-flex-row'} ref={elementRefList.get( 'addRelationDialogTableStyle' )}>
                        <AwSplmTable { ...viewModel.grids.relationTableGridView} gridid={'relationTableGridView'} showContextMenu={true}/>
                    </div>
                </AwPanelSection>
            </AwPanelBody>
            <AwPanelFooter>
                <AwButtonEnableWhen action={actions.saveRelationAndClose} size='auto' enableWhen={data.enableSaveButton}>
                    <AwI18n>{subPanelContext.reportsState.editRelationCommand === 'true' ? i18n.saveReport : i18n.addReport}</AwI18n>
                </AwButtonEnableWhen>
            </AwPanelFooter>
        </AwPanel>
    );
};

/**
 * Retrieves the expanded source path from the given report state and search results.
 *
 * @param {*} reportsState - The current state of the reports.
 * @param {*} searchResults - The results of the search operation.
 * @returns {*} The expanded source path.
 */
export const getExpandSourcePath = ( reportsState, searchResults )=>{
    const nwReportsState = reportsState.getValue();
    let sourceObjectsList = [];
    let isSourceSegment = 'false';
    if( nwReportsState.segmentTree?.length && nwReportsState.segmentTree[0].children.length > 0 && searchResults?.objects ) {
        const arrUids = [];
        _.forEach( searchResults.objects, ( object )=>{
            arrUids.push( object.uid );
        } );
        sourceObjectsList = arrUids;
    } else {
        sourceObjectsList = [ nwReportsState.rootClassSampleObject[0].uid ];
        isSourceSegment = 'true';
    }
    var traversePath = {
        relationsPath:[ {
            searchMethod: reportsCommonService.getExpandSourceRelatedName(),
            sourceObjectsList: sourceObjectsList,
            additionalTraversalCriteria:{ isSourceSegment: isSourceSegment },
            objectType: reportsCommonService.getRelatedObjectsDataName()
        } ]
    };
    return JSON.stringify( traversePath );
};

/**
 * Processes the output in a specific way.
 *
 * @param {*} response - The input to process.
 * @param {*} structureCount - The count of the structure.
 * @returns {*} The processed output.
 */
export const processOutput = function( response, structureCount ) {
    var modelObjects = [];
    _.forEach( response.ServiceData.plain, ( uid )=>{
        if( response.ServiceData.modelObjects[uid] && response.ServiceData.modelObjects[uid].props.rb0RelationTypeInternalName.dbValues[0] === 'BOM' ) {
            //structure modelObject
            response.ServiceData.modelObjects[uid].props.rb0RelatedObjectsCount.dbValues[0] = structureCount;
            response.ServiceData.modelObjects[uid].props.rb0RelatedObjectsCount.uiValues[0] = structureCount;
        }
        modelObjects.push( response.ServiceData.modelObjects[uid] );
    } );
    return modelObjects;
};

/**
 * Adds a new child node to a given tree structure.
 *
 * @param {*} tree - The tree to which the node should be added.
 * @param {*} pushNode - The node to add to the tree.
 * @returns {*} The updated tree with the new child node.
 */
const pushChildNode = ( tree, pushNode ) =>{
    if( tree.children.length === 0 ) {
        tree.children.push( pushNode );
    } else if( tree.children ) {
        // FUTURE: This is for multiple childs, for tracing child number will need one more parameter like index
        // for( let i = 0; i < tree.children.length; i++ ) {
        //     return pushChildNode( tree.children[ i ], pushNode );
        // }
        return pushChildNode( tree.children[0], pushNode );
    }
    return tree;
};

/**
 * Saves the relation.
 * @param {Array} relations - The relations to be saved.
 * @param {*} reportsState - The state of the reports.
 * @param {*} selectedNode - The state of the selected node.
 * @returns {Array} The updated segment tree.
 */
export const saveRelation = ( relations, reportsState, selectedNode )=> {
    const nwReportState = reportsState.getValue();
    const nwSelectedNode = selectedNode.getValue();
    if( !nwReportState.reportParameters.ReportDefProps?.ReportSegmentParams ) {
        nwReportState.reportParameters.ReportDefProps.ReportSegmentParams = [];
    } else if( nwSelectedNode.node ) {
        let nodeIndex = -1;
        nodeIndex = findInTree( nwReportState.segmentTree[0], nwSelectedNode.node.value, nodeIndex, 'find' ).index;
        nwReportState.reportParameters.ReportDefProps.ReportSegmentParams = nwReportState.reportParameters.ReportDefProps.ReportSegmentParams.slice( 0, nodeIndex + 1 );
        confgItemRepSrvc.updateSegmentTree( nwReportState );
    }
    const tree = { ...nwReportState.segmentTree[0] };
    //deselect all tree
    processDeselect( tree, '' );
    let Destination = '';
    let TreeVal = '';
    _.forEach( relations, ( { props:{ rb0RelatedObjectTypeInternalName, rb0RelatedObjectTypeDisplayName } }, index )=>{
        if( Destination !== 'ALL' && rb0RelatedObjectTypeInternalName.dbValues[0] !== 'ALL' ) {
            Destination = index === 0 ? rb0RelatedObjectTypeInternalName.dbValues[0] : `${Destination},${rb0RelatedObjectTypeInternalName.dbValues[0]}`;
            TreeVal = index === 0 ? rb0RelatedObjectTypeDisplayName.dbValues[0] : `${TreeVal},${rb0RelatedObjectTypeDisplayName.dbValues[0]}`;
        } else if( rb0RelatedObjectTypeInternalName.dbValues[0] === 'ALL' ) {
            Destination = rb0RelatedObjectTypeInternalName.dbValues[0];
            TreeVal = rb0RelatedObjectTypeDisplayName.dbValues[0];
        }
    } );
    if( relations[0].props.rb0RelationTypeInternalName.dbValues[0] !== 'BOM' ) {
        TreeVal = relations[0].props.rb0PropertyOrRelationDisplayName.dbValues[0].split( '(' )[0] + `(${TreeVal})`;
    }
    nwReportState.reportParameters.ReportDefProps.ReportSegmentParams.push( {
        Destination: Destination,
        RelOrRef: relations[0].props.rb0PropertyOrRelationInternalName.dbValues[0],
        RelRefType: relations[0].props.rb0RelationTypeInternalName.dbValues[0],
        TreeVal: TreeVal,
        searchFilterMap: {}
    } );
    const currentSegSize = nwReportState.reportParameters.ReportDefProps.ReportSegmentParams.length;
    //select last node, set selected as true
    let newNode = {
        children: [],
        expanded: true,
        selected: true,
        label: TreeVal,
        value: TreeVal + ( currentSegSize - 1 ),
        uid: currentSegSize - 1
    };
    nwSelectedNode.node = newNode;
    pushChildNode( tree, newNode );
    nwReportState.segmentTree = [ tree ];
    nwReportState.relationsPath = getTraversalPath( nwReportState );
    nwReportState.reportParameters.ReportDefProps.ReportSearchInfo = {
        activeFilterMap: {},
        SearchCriteria: nwReportState.relationsPath
    };
    nwReportState.initRepDisp = true;
    selectedNode.update( nwSelectedNode );
    reportsState.update( nwReportState );
    return [ tree ];
};

/**
 * Constructs a BOM segment payload based on the provided dashboard segment parameters and report state.
 *
 * @param {*} dashboardSegmentParams - The parameters for the dashboard segment.
 * @param {*} nwReportState - The current state of the report.
 * @returns {*} The constructed BOM segment payload.
 */
const constructBomSegPayload = ( dashboardSegmentParams, nwReportState ) => {
    return {
        searchMethod: dashboardSegmentParams.RelRefType,
        objectType: nwReportState.rootClassSampleObject[0].type,
        revisionRule: getCtxPayloadRevRule( nwReportState ),
        searchFilterMap: _.cloneDeep( dashboardSegmentParams.searchFilterMap )
    };
};

/**
 * Gets the context payload revision rule.
 * @param {*} nwReportState - The state of the report.
 * @returns {*} The revision rule.
 */
const getCtxPayloadRevRule = ( nwReportState ) => {
    if ( nwReportState.reportParameters?.ReportDefProps?.ReportSearchInfo ) {
        let existingSearchCriteiraString = nwReportState.reportParameters.ReportDefProps.ReportSearchInfo.SearchCriteria;
        let existingSearchCriteriaJSON = {};
        try {
            existingSearchCriteriaJSON  = JSON.parse( existingSearchCriteiraString );
        } catch( e ) {
            //incorrect data, return default value
            return '';
        }
        const bomSegIndex =  _.findIndex( existingSearchCriteriaJSON.relationsPath, ( relationsPath ) => {
            return relationsPath.searchMethod === 'BOM';
        } );
        if( bomSegIndex >= 0 && appCtxService.ctx.sublocation.historyNameToken !== 'createReportTemplate' ) {
            return existingSearchCriteriaJSON.relationsPath[bomSegIndex].revisionRule;
        }
        return '';
    }
    return appCtxService.ctx.sublocation.historyNameToken !== 'createReportTemplate' ? appCtxService.getCtx( 'userSession' ).props.awp0RevRule.displayValues[0] : '';
};

/**
 * Constructs a non-BOM segment payload based on the provided dashboard segment parameters and report state.
 *
 * @param {*} dashboardSegmentParams - The parameters for the dashboard segment.
 * @param {*} nwReportState - The current state of the report.
 * @returns {*} The constructed non-BOM segment payload.
 */
const constructNonBomSegPayload = ( dashboardSegmentParams ) => {
    return {
        objectType: dashboardSegmentParams.Destination,
        relationName: dashboardSegmentParams.RelOrRef,
        searchMethod: dashboardSegmentParams.RelRefType,
        searchFilterMap: _.cloneDeep( dashboardSegmentParams.searchFilterMap )
    };
};

let getTraversePathForSegments = ( segParams, traversalPath, nwReportState )=>{
    segParams.forEach( segmentParam => {
        var segPayload = {};
        if( segmentParam.RelRefType === 'BOM' ) {
            segPayload = constructBomSegPayload( segmentParam, nwReportState );
        } else {
            segPayload = constructNonBomSegPayload( segmentParam );
        }
        traversalPath.relationsPath.push( segPayload );
    } );
    return traversalPath;
};

/**
 * @param {*} nwReportState - This might be response in case if it will called as output function
 * @returns {string} relations path
 */
const getTraversalPath = function( nwReportState  ) {
    var traversePath = { relationsPath: [] };
    if( nwReportState.reportParameters.ReportDefProps?.ReportSegmentParams ) {
        const segmentParams = _.cloneDeep( nwReportState.reportParameters.ReportDefProps.ReportSegmentParams );
        traversePath = getTraversePathForSegments( segmentParams, traversePath, nwReportState );
    }
    return JSON.stringify( traversePath );
};

/**
 * Removes a traverse segment from the report state based on the selected node.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {Object} i18n - The internationalization object for localization.
 * @param {string} popupId - The ID of the popup.
 * @param {boolean} panelPinned - Indicates whether the panel is pinned.
 * @param {Object} selectedNode - The currently selected node.
 * @returns {void}
 */
export let removeTraverseSegment = ( reportsState, i18n, popupId, panelPinned, selectedNode ) => {
    var nwReportsState = reportsState.getValue();
    let nwSelectedNode = selectedNode.getValue();
    var selectedNodeUid = nwSelectedNode.node.value;
    let removeIndex = -1;
    removeIndex = findInTree( nwReportsState.segmentTree[0], selectedNodeUid, removeIndex, 'find' ).index;
    if( removeIndex >= 0 ) {
        nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams = nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams.slice( 0, removeIndex );
        confgItemRepSrvc.updateSegmentTree( nwReportsState );
        delete nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo;
        delete nwReportsState.reportParameters.ReportDefProps.ReportTable1;
        nwReportsState.reportParameters.ReportDefProps.allChartsList = [ {
            ChartTitle: '',
            ChartType: 'column',
            ChartPropName: '',
            ChartPropInternalName: '',
            ChartTypeName: i18n.barChart,
            visible: true
        } ];
        nwReportsState.searchInfo = {};
        nwReportsState.searchIncontextInfo = {};
        if( nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams.length === 0 ) {
            nwReportsState.relationsPath = null;
            selectedNode.update( [] );
        } else {
            nwReportsState.relationsPath = getTraversalPath( nwReportsState );
            nwReportsState.initRepDisp = true;
            nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
                activeFilterMap: {},
                SearchCriteria: nwReportsState.relationsPath
            };
            let newNode = {
                children: [],
                expanded: true,
                selected: true,
                label: nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams[removeIndex - 1].TreeVal,
                value: nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams[removeIndex - 1].TreeVal + ( removeIndex - 1 ),
                uid: removeIndex - 1
            };
            nwSelectedNode.node = newNode;
            selectedNode.update( nwSelectedNode );
        }

        reportsState.update( nwReportsState );
        !panelPinned && popupService.hide( popupId );
    }
    return nwReportsState.segmentTree;
};

/**
 * Deselects all nodes in the report state's segment tree.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {string} selectValue - The value to select.
 * @returns {Array} The updated segment tree with all nodes deselected.
 */
export let deselectAllNodes = ( reportsState, selectValue ) =>{
    let nwReportsState = reportsState.getValue();
    processDeselect( nwReportsState.segmentTree[0], selectValue );
    return _.cloneDeep( nwReportsState.segmentTree );
};

/**
 * Recursively deselects a node and its children in the tree.
 *
 * @param {Object} tree - The tree node to start deselecting from.
 * @param {string} selectValue - The value to select.
 * @returns {void}
 */
let processDeselect = ( tree, selectValue ) => {
    // Check if the tree object exists and is not null or undefined
    if ( tree ) {
        // If the tree's value matches the selected value, mark it as selected
        if ( tree.value === selectValue ) {
            tree.selected = true;
        } else if ( tree.selected ) {
            // If the tree is selected, remove the selected property
            delete tree.selected;
        }

        // Check if the tree has children and process them
        if ( tree.children ) {
            for ( let i = 0; i < tree.children.length; i++ ) {
                processDeselect( tree.children[i], selectValue );
            }
        }
    }
};


/**
 * selects given node in the report state's segment tree.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {string} selectNodeUid - The value to select.
 * @returns {void} The updated segment tree with node selected.
 */
export const selectSpecificNode = ( reportsState, selectNodeUid ) =>{
    const nwReportsState = reportsState.getValue();
    processSelect( nwReportsState.segmentTree[0], selectNodeUid );
    nwReportsState.segmentTree = [ _.cloneDeep( nwReportsState.segmentTree[0] ) ];
    nwReportsState.refreshTree = true;
    reportsState.update( nwReportsState );
};

/**
 * Recursively deselects a node and its children in the tree.
 *
 * @param {Object} tree - The tree node to start selecting from.
 * @param {string} selectUid - The value to select.
 * @returns {void}
 */
const processSelect = ( tree, selectUid )=>{
    if( tree?.selected ) {
        delete tree.selected;
    }
    if( tree.value === selectUid ) {
        tree.selected = true;
    }
    if( tree?.children ) {
        for( let i = 0; i < tree.children.length; i++ ) {
            processSelect( tree.children[ i ], selectUid );
        }
    }
};


/**
 * Determines the appropriate icon for a given relation type.
 *
 * @param {string} rb0RelationTypeInternalName - The internal name of the relation type.
 * @returns {string} The name of the icon to use for the given relation type.
 */
const getRelationIcon = ( rb0RelationTypeInternalName )=>{
    return rb0RelationTypeInternalName === 'REFBY' || rb0RelationTypeInternalName === 'GRMS2P' ? 'indicatorMoveUpwardDirection' : 'indicatorMoveDownwardDirection';
};

/**
 * Renders the relations icon for a given view model object in the provided container element.
 *
 * @param {Object} vmo - The view model object.
 * @param {Object} containerElem - The container cell.
 * @returns {void}
 */
export const relationsIconRenderer = ( vmo, containerElem ) => {
    const relationsIcon = getRelationIcon( vmo.props?.rb0RelationTypeInternalName?.dbValues[0] );
    const cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-visual-indicator';
    //Need to add title in i18n
    cellImg.title = '';
    const imgSrc = 'assets/image/' + relationsIcon + '16.svg';
    cellImg.src = imgSrc;
    containerElem.appendChild( cellImg );
};

/**
 * Checks if the save operation should be enabled based on the selected objects.
 *
 * @param {Array} selectedObjects - The selected objects.
 * @param {Array} nextRelations - The next set of expected relations.
 * @returns {boolean} True if the save operation should be enabled, false otherwise.
 */
export const checkSaveShouldBeEnabled = ( selectedObjects, nextRelations ) => {
    // If no selected objects are provided, return false for enabling save button
    if( selectedObjects.length === 0 ) {
        return { enableSaveButton: false, falseMultipleSelectionMsg: false };
    }

    // Ensure nextRelations is not null or undefined before checking its length
    if( !nextRelations ) {
        return { enableSaveButton: false, falseMultipleSelectionMsg: false };
    }

    // Check if selectedObjects and nextRelations have the same length
    if( selectedObjects.length === nextRelations.length ) {
        let foundMismatch = false;

        // Loop through selectedObjects and check if there's a mismatch with nextRelations
        for ( const obj of selectedObjects ) {
            if ( nextRelations.findIndex( expectedObj => expectedObj.props.rb0PropertyOrRelationDisplayName.dbValues[0] === obj.props.rb0PropertyOrRelationDisplayName.dbValues[0] ) === -1 ) {
                foundMismatch = true;
                break;
            }
        }

        // If no mismatch found, return response with save button disabled
        if( !foundMismatch ) {
            return { enableSaveButton: false, falseMultipleSelectionMsg: false };
        }
    }

    // Check if selected objects have consistent relation types and properties
    let notMatched = false;
    for ( let i = 1; !notMatched && i < selectedObjects.length; i++ ) {
        if ( selectedObjects[0].props.rb0RelationTypeInternalName.dbValues[0] !== selectedObjects[i].props.rb0RelationTypeInternalName.dbValues[0] ||
            selectedObjects[0].props.rb0PropertyOrRelationInternalName.dbValues[0] !== selectedObjects[i].props.rb0PropertyOrRelationInternalName.dbValues[0] ) {
            notMatched = true;
        }
    }

    // Return the final result: either enable or disable the save button
    return { enableSaveButton: !notMatched, falseMultipleSelectionMsg: selectedObjects.length > 1 && notMatched };
};

/**
 * Updates the relations path in the report state with the active filter from the search state.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {Object} searchState - The current state of the search.
 * @returns {void}
 */
export const updateRelationsPathWithFilter = ( reportsState, searchState ) => {
    let nwSearchState = searchState.getValue();
    const nwReportState = reportsState.getValue();
    const  searchFilterMap = aw_searchFilter.buildSearchFiltersFromSearchState( nwSearchState.activeFilters ).activeFilterMap;
    if( nwSearchState.activeFilters && Object.keys( nwSearchState.activeFilters ).length ) {
        nwSearchState.filterString = aw_searchFilter.buildFilterString( nwSearchState.activeFilters );
        searchState.update( nwSearchState );
    }
    // const searchFilterMap = _.cloneDeep( nwSearchState.activeFilterMap );
    const segmentParam = nwReportState.reportParameters.ReportDefProps.ReportSegmentParams;
    segmentParam[nwReportState.reportParameters.ReportDefProps.ReportSegmentParams.length - 1].searchFilterMap = searchFilterMap;
    nwReportState.reportParameters.ReportDefProps.ReportSegmentParams = segmentParam;
    nwReportState.relationsPath = getTraversalPath( nwReportState );
    nwReportState.reportParameters.ReportDefProps.ReportSearchInfo = {
        activeFilterMap: {},
        SearchCriteria: nwReportState.relationsPath
    };
    reportsState.update( nwReportState );
};

/**
 * Retrieves the related objects from the search results and maps them to view model objects.
 *
 * @param {Object} searchResults - The search results.
 * @returns {Array} The related objects mapped to view model objects.
 */
export const getRelatedFilteredObjects = ( searchResults ) => {
    let relatedObjects = [];
    if( searchResults?.objects ) {
        relatedObjects = searchResults.objects.map( function( vmo ) {
            vmo = cdm.getObject( vmo.uid );
            return viewModelObjectService.createViewModelObject( vmo.uid, 'EDIT', null, vmo );
        } );
    }
    return relatedObjects;
};
/**
 * Updates the local reports state with the selected node.
 *
 * @param {Object} localReportsState - The local state of the reports.
 * @param {Object} reportsState - The current state of the reports.
 * @param {Object} selectedNode - The currently selected node.
 * @param {Object} searchState - The current state of the search.
 * @returns {void}
 */
export const updateLocalReportsStateWithSelectedNode = ( localReportsState, reportsState, selectedNode, searchState ) => {
    var selectedNodeUid = selectedNode.value;
    let removeIndex = -1;
    const nwReportsState = { ...reportsState.getValue() };
    const nwSearchState = searchState.getValue();
    removeIndex = findInTree( nwReportsState.segmentTree[0], selectedNodeUid, removeIndex, 'find' ).index;
    const nwLocalReportsState = localReportsState.getValue();
    if( removeIndex >= 0 ) {
        nwLocalReportsState.reportParameters = _.cloneDeep( nwReportsState.reportParameters );
        nwLocalReportsState.relationsPath = nwReportsState.relationsPath;
        nwLocalReportsState.rootClassSampleObject = nwReportsState.rootClassSampleObject;
        let segmentParams = nwLocalReportsState.reportParameters.ReportDefProps.ReportSegmentParams;
        segmentParams = segmentParams.slice( 0, removeIndex + 1 );
        nwLocalReportsState.reportParameters.ReportDefProps.ReportSegmentParams = segmentParams;
        nwSearchState.activeFilterMap = segmentParams[removeIndex].searchFilterMap;
        nwSearchState.searchInProgress = true;
        if( nwSearchState.activeFilterMap && Object.keys( nwSearchState.activeFilterMap ).length > 0 ) {
            const savedFilterMap = aw_searchFilter.convertFilterMapToSavedSearchFilterMap( nwSearchState );
            _.forEach( savedFilterMap, ( filters, index )=>{
                if( !nwSearchState.activeFilters ) {
                    nwSearchState.activeFilters = {};
                }
                nwSearchState.activeFilters[index] = [];
                _.forEach( filters, ( filter, i )=>{
                    if( nwSearchState.activeFilterMap[index][i].searchFilterType === 'StringFilter' && nwSearchState.provider === 'Awp0FullTextSearchProvider' &&
                    nwSearchState.activeFilterMap[index][i].stringDisplayValue !== nwSearchState.activeFilterMap[index][i].stringValue ) {
                        nwSearchState.activeFilters[index].push( nwSearchState.activeFilterMap[index][i].stringDisplayValue +
                            filterPanelUtils.INTERNAL_KEYWORD + filter.stringValue );
                    } else {
                        nwSearchState.activeFilters[index].push( filter.stringValue );
                    }
                } );
            } );
            nwSearchState.filterString = aw_searchFilter.buildFilterString( nwSearchState.activeFilters );
        }
        searchState.update( nwSearchState );
        confgItemRepSrvc.updateSegmentTree( nwLocalReportsState );
        if( nwLocalReportsState.reportParameters.ReportDefProps.ReportSegmentParams.length === 0 ) {
            nwLocalReportsState.relationsPath = null;
        } else {
            nwLocalReportsState.relationsPath = getTraversalPath( nwLocalReportsState );
            nwLocalReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
                activeFilterMap: {},
                SearchCriteria: nwLocalReportsState.relationsPath
            };
        }
    }
    return nwLocalReportsState;
};

/**
 * Adds a filter action to the report state based on the selected node and the current search state.
 *
 * @param {Object} searchState - The current state of the search.
 * @param {Object} reportsState - The current state of the reports.
 * @param {Object} selectedNode - The currently selected node.
 * @returns {void} The updates reports state.
 */
export const addFilterAction = ( searchState, reportsState, selectedNode ) => {
    const nwSearchState = searchState.getValue();
    nwSearchState.filterApplied = true;
    nwSearchState.activeFilterMap = aw_searchFilter.buildSearchFiltersFromSearchState( nwSearchState.activeFilters ).activeFilterMap;
    _.forEach( Object.keys( nwSearchState.activeFilterMap ), ( key )=>{
        _.forEach( nwSearchState.activeFilterMap[key], ( filter )=>{
            if( nwSearchState.searchFilterMap[key] && nwSearchState.searchFilterMap[key].length > 0 ) {
                _.forEach( nwSearchState.searchFilterMap[key], ( searchFilter )=>{
                    searchFilter.stringValue === filter.stringValue && ( filter.stringDisplayValue = searchFilter.stringDisplayValue );
                } );
            }
        } );
    } );
    searchState.update( nwSearchState );
    let selectedNodeUid = selectedNode.value;
    let segIndex = -1;
    const nwReportsState = { ...reportsState.getValue() };
    segIndex = findInTree( nwReportsState.segmentTree[0], selectedNodeUid, segIndex, 'find' ).index;
    nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams[segIndex].searchFilterMap = nwSearchState.activeFilterMap;
    confgItemRepSrvc.updateSegmentTree( nwReportsState );
    nwReportsState.relationsPath = getTraversalPath( nwReportsState );
    nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
        activeFilterMap: {},
        SearchCriteria: nwReportsState.relationsPath
    };
    nwReportsState.initRepDisp = true;
    reportsState.update( nwReportsState );
};

/**
 * Processes the output data for filters.
 *
 * @param {Object} data - The data to process.
 * @param {Object} dataCtxNode - The context node for the data.
 * @param {Object} searchData - The search data.
 * @returns {void}
 */
export const processOutputForFilters = ( data, dataCtxNode, searchData, dataProvider ) => {
    awSearchService.processOutput( data, dataCtxNode, searchData );
    data.totalFound === 0 ? dataProvider.update( [], 0 ) : dataProvider.update( getRelatedFilteredObjects( JSON.parse( data.searchResultsJSON ) ), data.totalFound );
};

/**
 * Calls the report get search criteria service.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {boolean} isFilterMapRequired - Flag indicating if filter map is required.
 * @returns {Promise} A promise that resolves with the search criteria.
 */
export const callRepGetSearchCriteria = ( reportsState, isFilterMapRequired ) => {
    return AwReportTableService.callRepGetSearchCriteria( reportsState, isFilterMapRequired );
};

/**
 * Removes segment parameters and updates the tree.
 *
 * @param {Object} reportsState - The current state of the reports.
 * @param {Object} nodeState - The current state of the node.
 * @param {Object} activeState - The active state.
 * @param {Object} activeView - The active view.
 * @returns {void}
 */
export const removeSegParamsAndUpdateTree = ( reportsState, nodeState, activeState, activeView ) => {
    const nwReportsState = reportsState.getValue();
    let nodeIndex = -1;
    nodeIndex = findInTree( nwReportsState.segmentTree[0], nodeState.node.value, nodeIndex, 'find' )?.index;
    if( nodeIndex !== 0 && !nodeIndex ) {
        return;
    }
    nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams = nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams.slice( 0, nodeIndex + 1 );
    confgItemRepSrvc.updateSegmentTree( nwReportsState );
    nwReportsState.relationsPath = getTraversalPath( nwReportsState );
    nwReportsState.reportParameters.ReportDefProps.ReportSearchInfo = {
        activeFilterMap: {},
        SearchCriteria: nwReportsState.relationsPath
    };
    reportsState.update( nwReportsState );
    const nwActiveState = activeState.getValue();
    nwActiveState.activeView = activeView;
    activeState.update( nwActiveState );
};

export const checkConflictMsgVisible = ( response, searchState, forceDeleteFilterApplied )=>{
    let conflictMsgVisible = false;
    const nwSearchState = searchState.getValue();
    if( forceDeleteFilterApplied === 'true' || nwSearchState.filterApplied && response.totalFound === 0 ) {
        conflictMsgVisible = nwSearchState.filterApplied && response.totalFound === 0;
        delete nwSearchState.filterApplied;
        searchState.update( nwSearchState );
    }
    return conflictMsgVisible;
};

export let getLastSegmentNodeValue = ( segmentTree, activeState, selectedNodeState ) => {
    // Check if activeState and selectedNodeState are not null or undefined before accessing their values
    const nwActiveState = activeState?.getValue();
    const nwSelectedNodeState = selectedNodeState?.getValue();

    // Only proceed if nwActiveState and nwSelectedNodeState are not null or undefined
    if ( nwActiveState?.selectedNode?.value && nwSelectedNodeState ) {
        const node = nwActiveState.selectedNode;
        delete nwActiveState.selectedNode;

        // Update the activeState and selectedNodeState only if they are valid
        if ( nwActiveState ) {
            activeState.update( nwActiveState );
        }

        nwSelectedNodeState.node = node;
        selectedNodeState.update( nwSelectedNodeState );

        return node.value;
    }

    // If the above condition is not met, find the node from the segment tree
    const node = findInTree( segmentTree[0], null, -1, 'last' )?.tree;

    if ( nwSelectedNodeState?.node ) {
        nwSelectedNodeState.node = node;
        selectedNodeState.update( nwSelectedNodeState );
    }

    return node?.value;  // Use optional chaining to avoid issues if node is undefined
};


export let getSearchCriteriaForSelectedNode = ( node, reportsState )=>{
    let traversePath = { relationsPath: [] };
    let nwReportsState = reportsState.getValue();
    let segParams = nwReportsState.reportParameters.ReportDefProps.ReportSegmentParams;
    //findnode index
    let nodeValue;
    if( !node ) {
        nodeValue = getLastSegmentNodeValue( nwReportsState.segmentTree );
    } else {
        nodeValue = node.value;
    }
    let nodeIndex = -1;
    nodeIndex = findInTree( nwReportsState.segmentTree[0], nodeValue, nodeIndex, 'find' ).index;
    //prepare segParams
    segParams = segParams.slice( 0, nodeIndex + 1 );
    traversePath = getTraversePathForSegments( segParams, traversePath, nwReportsState );
    return {
        sourceObject: nwReportsState.rootClassSampleObject[0].uid,
        relationsPath: JSON.stringify( traversePath ),
        isFilterMapRequired: 'false'
    };
};
export let checkIsSoaCallRequired = ( prevSelectedNodeValue, currSelectedNodeValue, isOnMountCall )=>{
    if( isOnMountCall ) {
        return false;
    }
    return prevSelectedNodeValue !== currSelectedNodeValue;
};
export let findNextRelation = ( expectedNodeValue, relations )=>{
    var vmo = [];
    let objTypes = expectedNodeValue.split( '(' )[1].split( ')' )[0].split( ',' );
    let relName = expectedNodeValue.split( '(' )[0];
    let expectedRelations = [];
    _.forEach( objTypes, ( objType )=>{
        expectedRelations.push( relName + '(' + objType + ')' );
    } );
    _.forEach( relations, ( rel ) => {
        if( expectedRelations.findIndex( expectedRel => expectedRel === rel.props.rb0PropertyOrRelationDisplayName.dbValues[0] ) >= 0 ) {
            vmo.push( rel );
        }
    } );
    return vmo;
};

export const cleanup = ( reportsState, activeState ) => {
    const { activeView } = activeState.getValue();
    const segmentTree = deselectAllNodes( reportsState );
    const editRelationCommand = _.toString( segmentTree.length && segmentTree[0].children?.length > 0 );
    const nwReportsState = reportsState.getValue();
    nwReportsState.segmentTree = segmentTree;
    if( activeView !== 'Rb0SegmentFilterPanel' ) {
        nwReportsState.editRelationCommand = editRelationCommand;
    }
    reportsState.update( nwReportsState );
};

export const cleanupSegmentFilterPanel = ( searchState, selectionModel, value ) => {
    searchCommonUtils.resetSearchState( searchState, selectionModel );
    addObjectUtils.updateAtomicDataValue( searchState, value );
};

const AddRelationDialogService = {
    setStyles,
    addRelationPoupupRenderFunction,
    getExpandSourcePath,
    processOutput,
    saveRelation,
    removeTraverseSegment,
    deselectAllNodes,
    selectSpecificNode,
    relationsIconRenderer,
    checkSaveShouldBeEnabled,
    updateRelationsPathWithFilter,
    getRelatedFilteredObjects,
    getLastSegmentNodeValue,
    getSearchCriteriaForSelectedNode,
    updateLocalReportsStateWithSelectedNode,
    addFilterAction,
    processOutputForFilters,
    callRepGetSearchCriteria,
    removeSegParamsAndUpdateTree,
    checkConflictMsgVisible,
    checkIsSoaCallRequired,
    findNextRelation,
    cleanup,
    cleanupSegmentFilterPanel
};
export default AddRelationDialogService;
