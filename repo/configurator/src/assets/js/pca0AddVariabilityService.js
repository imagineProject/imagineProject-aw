// Copyright (c) 2022 Siemens

/**
 * @module js/pca0AddVariabilityService
 */
import appCtxSvc from 'js/appCtxService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import cdm from 'soa/kernel/clientDataModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import dialogService from 'js/dialogService';
import eventBus from 'js/eventBus';
import iconSvc from 'js/iconService';
import localeService from 'js/localeService';
import messagingService from 'js/messagingService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0GridCommonUtils from 'js/pca0GridCommonUtils';
import pca0ConfiguratorExplorerCommonUtils from 'js/pca0ConfiguratorExplorerCommonUtils';
import pca0Constants from 'js/Pca0Constants';
import viewModelObjectSvc from 'js/viewModelObjectService';

import _ from 'lodash';
const localeTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );

/**
 * Validates if newly added value satisfies applied filter and removes duplicates from newlyAdded
 * @param {Array} newlyAdded - Newly added objects
 * @param {Array} gridVmo - Array of VMO present in grid
 * @param {Object} activeFilter - applied filter
 * @returns {void}
 */
let _updateUserIfNewlyAddedFeatureViolatesFilterCriteria = ( newlyAdded, gridVmo, activeFilter ) => {
    let msgShown = false;
    // We might have filters on other columns, but we only care about 'object_string'
    const objectStringFilter = activeFilter && activeFilter.find( obj => obj.columnName === 'object_string' );
    if( objectStringFilter && objectStringFilter.operation.length > 1 ) {
        let vmoLength = newlyAdded.length;
        while( vmoLength ) {
            const vmo = newlyAdded[ vmoLength - 1 ];
            if( gridVmo[ vmo.uid ] ) {
                newlyAdded.splice( vmoLength - 1, 1 );
            } else if( !msgShown && !pca0CommonUtils.isFilterCriteriaSatisfied( vmo.displayName, objectStringFilter.values[0], objectStringFilter.operation ) ) {
                messagingService.showError( localeTextBundle.violatesFilterCriteriaMsg );
                msgShown = true;
            }
            vmoLength--;
        }
    }
};

/**
 * Close the add variability panel.
 * @param {Boolean} isPanelPinned true if Panel is pinned: dialog must be closed when not pinned
 * @param {String} popupId popupId of Dialog
 */
let _closeAddVariabilityPanel = function( isPanelPinned, popupId ) {
    if( !isPanelPinned ) {
        dialogService.closeDialog( 'INFO_PANEL_CONTEXT', popupId );
    }
};

/**
 * Generate Property Map for the ViewModel TreeNode
 * @param {ViewModelTreeNode} vmTreeNode - the treeNode to attach the map to
 * @param {Array} treeDataProviderColumns  List of column definitions for the dataProvider [constraintsRule and Property columns]
 * @param {Object} selectionMap - To create property with selection column
 * @param {String} parentTree - Subject/Condition
 * @param {Object} splitColumnsMap - Map of Split Columns
 * @return {Object} propertyMap - map of ViewModelProperty objects for the treeNode
 */
let _generatePropertyMap = function( vmTreeNode, treeDataProviderColumns, selectionMap, parentTree, splitColumnsMap ) {
    let propertyMap = {
        object_string: {
            uiValue: vmTreeNode.displayName,
            dbValue: [ 5 ]
        }
    };
    let isSubjectGrid = parentTree.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID );

    // PropertyMap must contain a key for all columns contained in treeDataProvider (Property and Constraints Columns)
    treeDataProviderColumns.forEach( columnDef => {
        if( columnDef.isColumnFromCots ) {
            const propertyDisplayValue = _.get( vmTreeNode, `props[${columnDef.propertyName}].uiValue` );
            if ( propertyDisplayValue ) {
                propertyMap[ columnDef.propertyName ] = {
                    uiValue: vmTreeNode.props[ columnDef.propertyName ].uiValue,
                    dbValue: [ 5 ]
                };
            }
        } else if( columnDef.isPropertyColumn ) {
            propertyMap[ columnDef.propertyName ] = {
                uiValue: '', // modelObject.props[ newColumnUid ].dbValues[ 0 ],
                dbValue: [ 5 ] // String type, as per object_string
            };
        } else {
            // Get value from selectionMap
            let alternateID = parentTree + ':' + vmTreeNode.parentUID + ':' + vmTreeNode.nodeUid;
            let propValue = !_.isUndefined( selectionMap[ columnDef.propertyName ][ alternateID ] ) ?
                selectionMap[ columnDef.propertyName ][ alternateID ].selectionState : 0;
            let props = {};
            propertyMap[ columnDef.propertyName ] = pca0CommonUtils.getViewModelProperty( columnDef.propertyName, vmTreeNode.nodeUid, propValue, props );

            // Handle special case for split sections
            Object.values( splitColumnsMap ).forEach( splitColumns => {
                splitColumns.forEach( splitColumn => {
                    if( splitColumn.uid === columnDef.propertyName ) {
                        let isSplitSubjectColumn = splitColumn.isSplitSubject;
                        // Handle special case for expressions copied from Split Action
                        // these cells are not editable
                        props.isSplitCellEditDisabled = isSplitSubjectColumn && !isSubjectGrid ||
                            !isSplitSubjectColumn && isSubjectGrid;
                    }
                } );
            } );
        }
    } );

    propertyMap[ pca0Constants.GRID_CONSTANTS.SOURCE_TYPE ] = pca0CommonUtils.getViewModelProperty( pca0Constants.GRID_CONSTANTS.SOURCE_TYPE,
        vmTreeNode.parentUID, vmTreeNode.type );

    return propertyMap;
};

/** Helper function to update the isPropertyModifiable property of the properties
 * @param {ViewModelTreeNode} vmTreeNode - the treeNode
 * @param {Array} treeDataProviderColumns  List of constraints
 * */
let _updateIsPropertyModifiableProp = ( vmTreeNode, treeDataProviderColumns ) => {
    treeDataProviderColumns.forEach( columnDef => {
        // For all the constraints loaded in the grid, for the VMOs which are families and are not optional
        if( !columnDef.isPropertyColumn && !columnDef.isColumnFromCots
            && vmTreeNode.isFamily && ( !vmTreeNode.isOptional || !vmTreeNode.isSingleSelect )
        ) {
            vmTreeNode.props[ columnDef.propertyName ].isPropertyModifiable = false;
            vmTreeNode.props[ columnDef.propertyName ].isModifiable = false;
            vmTreeNode.props[ columnDef.propertyName ].isEditable = false;
        }
    } );
};

/**
 * Helper function to
 * 1 - remove the deselected node uid's from user selection array
 * 2 - decide if selection must be explicitly updated (e.g. via setSelection on selectionModel)
 * if Family is deselected:
 *  - all its children are removed explicitly (if not pre-selected) from user selection
 *  - explicit update of selection is required.
 * if only feature is deselected, then only that feature is removed from user selection and no explicit selection update is required.
 * @param {Array} userSelectionInPickAndChooseGrid - Collection of alternatedID's selected by the user in different TAB.
 * @param {Object} deselectedVMO - VMO of the deselected object.
 * @param {Array} selectedNodesInCurrentTab - Collection of VMO's selected in different TAB.
 * @param {Array} selectedFamiliesUids - Collection of selected families UID
 * @returns {Array} removeSelections - [] array to remove selections.
 */
let _removeSelectionInData = ( userSelectionInPickAndChooseGrid, deselectedVMO, selectedNodesInCurrentTab, selectedFamiliesUids ) => {
    let removeSelections = [];
    let removeFamilySelection = true;
    if( deselectedVMO.isFamily ) {
        for( let index = 0; deselectedVMO.children && index < deselectedVMO.children.length; index++ ) {
            // LCS-1106242: Do not clear selection on child nodes if pre-selected
            const childVMO = deselectedVMO.children[ index ];
            if( !childVMO.isPreselected ) {
                const userSelectionIndex = userSelectionInPickAndChooseGrid.indexOf( childVMO.alternateID );
                const userIndexForUid = userSelectionInPickAndChooseGrid.indexOf( childVMO.uid );
                if( userSelectionIndex > -1 ) {
                    userSelectionInPickAndChooseGrid.splice( userSelectionIndex, 1 );
                }
                if ( userIndexForUid > -1 ) {   // Remove UID from user selection
                    userSelectionInPickAndChooseGrid.splice( userIndexForUid, 1 );
                }

                const nodeIndex = selectedNodesInCurrentTab.findIndex( node => node.alternateID === childVMO.alternateID );
                if ( nodeIndex > -1 ) {
                    const [ node ] = selectedNodesInCurrentTab.splice( nodeIndex, 1 );
                    if( node ) { removeSelections.push( { ...node } ); }
                }
            } else {
                removeFamilySelection = false;
            }
        }
        if( removeFamilySelection ) {
            // Remove selection from Family if all child selection is removed
            const familyIndex = selectedNodesInCurrentTab.findIndex( node => node.alternateID === deselectedVMO.alternateID );
            if( familyIndex > -1 ) {
                const consumerFamilyIndex = selectedFamiliesUids.indexOf( deselectedVMO.uid );
                selectedNodesInCurrentTab.splice( familyIndex, 1 );
                consumerFamilyIndex > -1 ? selectedFamiliesUids.splice( consumerFamilyIndex, 1 ) : '';
            }

            const userSelectionIndex = userSelectionInPickAndChooseGrid.indexOf( deselectedVMO.alternateID );
            if( userSelectionIndex > -1 ) {
                if ( deselectedVMO.isFamily && !deselectedVMO.isExpanded ) {
                    userSelectionInPickAndChooseGrid.filter( alternateID => !alternateID.includes( deselectedVMO.alternateID + ':' ) );
                }
                userSelectionInPickAndChooseGrid.splice( userSelectionIndex, 1 );
            }
            if ( userSelectionInPickAndChooseGrid.indexOf( deselectedVMO.uid ) > -1 ) {
                userSelectionInPickAndChooseGrid.splice( userSelectionInPickAndChooseGrid.indexOf( deselectedVMO.uid ), 1 );
            }
        }
    } else {
        const userSelectionIndex = userSelectionInPickAndChooseGrid.indexOf( deselectedVMO.alternateID );
        if( userSelectionIndex > -1 ) {
            userSelectionInPickAndChooseGrid.splice( userSelectionIndex, 1 );
        }
        const nodeIndex = selectedNodesInCurrentTab.findIndex( node => node.alternateID === deselectedVMO.alternateID );
        if( nodeIndex > -1 ) {
            selectedNodesInCurrentTab.splice( nodeIndex, 1 );
        }
    }
    return removeSelections;
};

// Add feature explicitly if family is expanded then selected
let _addFeatureExplicitlyIfFamilyIsExpandedAndSelected = ( userSelectionInPickAndChooseGrid, currentSelectedNodeVMO, selectedNodesInCurrentTab ) => {
    let updateExplicitSelection = false;
    const childrenLength = currentSelectedNodeVMO.children.length;
    for( let childIndex = 0; childIndex < childrenLength; childIndex++ ) {
        const allowChildToBeSelected = currentSelectedNodeVMO.isPreselected && child.isPreselected ? true : !currentSelectedNodeVMO.isPreselected;
        const child = _.get( currentSelectedNodeVMO, `children.${childIndex}` );
        // add all the features of the selected family to user selection if family is not preselected else add all features by default
        if ( allowChildToBeSelected ) {
            userSelectionInPickAndChooseGrid.push( child.alternateID );
            selectedNodesInCurrentTab.push( child );
            updateExplicitSelection = true;
        }
    }
    return updateExplicitSelection;
};
/**
 * Helper function to handle the user selection in Pick and Choose panel.
 * @param {Array} userSelectionInPickAndChooseGrid - Collection of alternatedID's selected by the user in different TAB.
 * @param {Object} currentSelectedNodeVMO - VMO of the selected object.
 * @param {Objects} viewModelObjects - Collection of VMOs from data provider.
 * @param {Object} familiesNotExpanded - Families which are not expanded and SOA call is needed to get their features.
 * @param {String} viewMode - Indicates the mode in which the function is used.
 * @param {Array} selectedNodesInCurrentTab - Collection of VMO's selected in current TAB.
 * @param {Array} selectedFamiliesUid - Collection of selected families UID
 * @returns {Boolean} updateExplicitSelection - true if explicit selection is updated
 */
let _addSelectionInData = ( userSelectionInPickAndChooseGrid, currentSelectedNodeVMO, viewModelObjects, familiesNotExpanded, viewMode, selectedNodesInCurrentTab, selectedFamiliesUid ) => {
    let updateExplicitSelection = false;
    // if current selected node is a present in the tree
    if( currentSelectedNodeVMO ) {
        // We can use isFamily prop instead of checking model hierarchy array
        if (  viewMode !== 'advancedReuse' ) {
            userSelectionInPickAndChooseGrid.push( currentSelectedNodeVMO.alternateID );
            selectedNodesInCurrentTab.push( currentSelectedNodeVMO );
            if( currentSelectedNodeVMO.isFamily && !currentSelectedNodeVMO.isExpanded ) {
                familiesNotExpanded.push( currentSelectedNodeVMO );
            } else if( currentSelectedNodeVMO.isFamily && currentSelectedNodeVMO.isExpanded && !currentSelectedNodeVMO.isFreeForm ) {
                // add the alternateIds of the features in presentSelections. Features are only for non free form family
                updateExplicitSelection = _addFeatureExplicitlyIfFamilyIsExpandedAndSelected( userSelectionInPickAndChooseGrid, currentSelectedNodeVMO, selectedNodesInCurrentTab );
            }
        } else if ( viewMode === 'advancedReuse' && !currentSelectedNodeVMO.isFreeForm ) {
            const familyVMO = currentSelectedNodeVMO.isFeature ? _.find( viewModelObjects, viewModelObject => viewModelObject.uid === currentSelectedNodeVMO.parentUID ) : {};
            if( familyVMO.alternateID && currentSelectedNodeVMO.isFeature ) {
                if( !userSelectionInPickAndChooseGrid.includes( familyVMO.alternateID ) ) {
                    //When user select feature not family, add the family to user selection.
                    userSelectionInPickAndChooseGrid.push( familyVMO.alternateID );
                    selectedNodesInCurrentTab.push( familyVMO );
                    updateExplicitSelection = true;
                }
                userSelectionInPickAndChooseGrid.push( currentSelectedNodeVMO.alternateID );
                selectedNodesInCurrentTab.push( currentSelectedNodeVMO );
            } else if( !userSelectionInPickAndChooseGrid.includes( currentSelectedNodeVMO.alternateID ) ) {
                //When user select group or family.
                //For family, if its expanded check its children and add them to user selection.
                userSelectionInPickAndChooseGrid.push( currentSelectedNodeVMO.alternateID );
                selectedNodesInCurrentTab.push( currentSelectedNodeVMO );
                // add the alternateIds of the features in presentSelections. Features are only for non free form family
                if( currentSelectedNodeVMO.isFamily && currentSelectedNodeVMO.isExpanded && _.get( currentSelectedNodeVMO, 'children.length' ) > 0 ) {
                    updateExplicitSelection = _addFeatureExplicitlyIfFamilyIsExpandedAndSelected( userSelectionInPickAndChooseGrid, currentSelectedNodeVMO, selectedNodesInCurrentTab );
                }
            }
        }
    }
    if( currentSelectedNodeVMO.isFamily && selectedFamiliesUid.includes( currentSelectedNodeVMO.uid )
        && userSelectionInPickAndChooseGrid.includes( currentSelectedNodeVMO.uid ) ) {
        const uidIndex = userSelectionInPickAndChooseGrid.indexOf( currentSelectedNodeVMO.uid );
        uidIndex > -1 ? userSelectionInPickAndChooseGrid.splice( uidIndex, 1 ) : '';
    }
    return updateExplicitSelection;
};

/**
 * Updates variabilityData vmoSelected object and selectedVariabilityChanged flag based on selected vmo states and view mode.
 *
 * @param {Object} variabilityData - The data containing selected models and features.
 * @param {Array} viewModelObjects - The array of all available ViewModelObjects.
 * @param {string} viewMode - The current view mode.
 */
let _updateVmoSelection = ( variabilityData, viewModelObjects, viewMode ) => {
    // This contains models + features ( user selected )
    let vmoSelected = [ ...variabilityData.modelsSelected, ...variabilityData.featureSelected ];

    // For advanced reuse - filter out the VMOs which are preselected
    if( viewMode === 'advancedReuse' ) {
        vmoSelected = _.filter( vmoSelected, ( vmo ) => !vmo.isPreselected );
    }

    let selectedVariabilityChanged = false;
    let familyVMOsNotSelected = [];
    vmoSelected.forEach( vmo=>{
        // Evaluate if variability selected has changed
        if( !vmo.isPreselected ) {
            selectedVariabilityChanged = true;
        }
        // For constraints grid editor we need family vmo in vmoSelected if features/models selected without family.
        // Else while adding variability to constraint grid editor tree, we will not be able to get the family vmo props populated in getVariability soa.
        if( vmo.isFeature && viewMode === 'constraintsGridEditor' ) {
            const familyVMO = _.find( viewModelObjects, viewModelObject => viewModelObject.uid === vmo.parentUID );
            if( familyVMO && !vmoSelected.includes( familyVMO ) && !familyVMOsNotSelected.includes( familyVMO ) ) {
                familyVMOsNotSelected.push( familyVMO );
            }
        }
    } );

    if( familyVMOsNotSelected.length > 0 ) {
        vmoSelected.push( ...familyVMOsNotSelected );
    }
    variabilityData.selectedVariabilityChanged = selectedVariabilityChanged;
    variabilityData.vmoSelected = vmoSelected;
};

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * This function helps to update variability selected in Feature and Model tab of the Pick&Choose panel
 * @param {Object} updatedSelection - selection of VMO's for visible tab
 * @param {Object} variabilitySelected - Collection of VMOs selected in Feature and Model tabs
 * @param {String} tabKey - Have details of active tab features or models
 * @param {String} treeDataProvider - tree Data provider
 * @param {String} viewMode - Indicates the mode in which the function is used.
 * @param {Object}  selectedFamilies - array of uid set by the consumer to show selection on grid editor
 * @return {Array} userSelectionInPickAndChooseGrid - Collection of alternatedID's selected by the user in different TAB.
 */
export let updateVariabilitySelection = ( updatedSelection, variabilitySelected, tabKey, treeDataProvider, viewMode, selectedFamilies ) => {
    const viewModelObjects = treeDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    if( viewModelObjects.length === 0 ) {
        return;
    }
    let variabilityData = variabilitySelected.getValue();
    const viewModelCollection = treeDataProvider.getViewModelCollection();
    const selectionModel = treeDataProvider.selectionModel;
    let selectedFamiliesUid = selectedFamilies ? selectedFamilies.getValue().familiesUid : [];
    // families which are not expanded and SOA call is needed to get their features
    let familiesNotExpanded = [ ...variabilityData.familiesNotExpanded ];
    // present selections
    let presentSelections = selectionModel.getSelection() ? selectionModel.getSelection() : [];
    // last selections before the present selection
    let lastSelections = selectionModel.getLastSelection() ? selectionModel.getLastSelection() : [];
    // Cache user selections of pick and choose panel so that when User applies some filter on Tree
    // and removes the filter, we should see existing selection ticked. Other use case
    // where this is useful is when user makes some selection in features tab --> moves to Models tab --> comes back to Features tab
    let userSelectionInPickAndChooseGrid = [ ...variabilitySelected.getValue().userSelectionsPickAndChooseGrid ];

    let selectedNodesInCurrentTab = [ ...updatedSelection.selected ];
    let updateExplicitSelection = false;
    let removeSelections = [];
    if( presentSelections.length > lastSelections.length ) {
        presentSelections.forEach( ( selection ) => {
            if ( !lastSelections.includes( selection ) ) {
                const vmoIndex = viewModelCollection.findViewModelObjectById( selection );
                const selectedVMO = viewModelObjects[vmoIndex];
                if ( selectedVMO ) {
                    const modelTypeHierarchy = _.get( selectedVMO, 'modelType.typeHierarchyArray', [] );
                    if( modelTypeHierarchy.includes( pca0Constants.CFG_OBJECT_TYPES.CONF_CONTEXT )
                        && selectedVMO?.type === pca0Constants.CFG_OBJECT_TYPES.TYPE_FAMILY_GRP_REVISION ) {
                        updateExplicitSelection = true; // Do not allow selection on context and unassigned.
                    } else {
                        const updateSelection = _addSelectionInData( userSelectionInPickAndChooseGrid, selectedVMO, viewModelObjects, familiesNotExpanded,
                            viewMode, selectedNodesInCurrentTab, selectedFamiliesUid );
                        if ( updateSelection ) {
                            updateExplicitSelection = true;
                        }
                    }
                }
            }
        } );
    } else if( lastSelections.length > presentSelections.length ) {
        lastSelections.forEach( ( selection ) => {
            if ( !presentSelections.includes( selection ) ) {
                const vmoIndex = viewModelCollection.findViewModelObjectById( selection );
                const deselectedVMO = viewModelObjects[vmoIndex];
                if ( deselectedVMO ) {
                    removeSelections = _removeSelectionInData( userSelectionInPickAndChooseGrid, deselectedVMO, selectedNodesInCurrentTab, selectedFamiliesUid );
                    updateExplicitSelection = removeSelections.length > 0;
                }
            }
        } );
    }

    // Remove duplicates from selectedNodesInCurrentTab
    selectedNodesInCurrentTab = selectedNodesInCurrentTab.filter( ( obj, index, self ) =>
        index === self.findIndex( ( t ) =>
            t.alternateID === obj.alternateID
        )
    );
    if( tabKey === 'tc_xrt_Models' ) {
        variabilityData.modelsSelected = selectedNodesInCurrentTab;
    } else {
        variabilityData.featureSelected = selectedNodesInCurrentTab;
    }

    _updateVmoSelection( variabilityData, viewModelObjects, viewMode );


    // This contains non-expanded families of features tab and models tab in pick and choose panel.
    variabilityData.familiesNotExpanded = familiesNotExpanded.filter( ( obj, index, self ) =>
        index === self.findIndex( ( t ) =>
            t.alternateID === obj.alternateID
        )
    );

    // This contains all the selections made by user after opening pick and choose panel from features and models tab.
    variabilityData.userSelectionsPickAndChooseGrid = [ ...new Set( userSelectionInPickAndChooseGrid ) ];

    // Evaluate if variability selected has changed
    let elementsNotPreselected = variabilityData.vmoSelected.filter( vmo => !vmo.isPreselected );
    variabilityData.selectedVariabilityChanged = elementsNotPreselected.length > 0;

    variabilitySelected.update( variabilityData );
    if ( !_.isEmpty( selectedFamiliesUid ) ) {
        let newSelection = selectedFamilies.getValue();
        if ( !_.isEqual( newSelection.familiesUid, selectedFamiliesUid ) ) {
            newSelection.familiesUid = selectedFamiliesUid;
            selectedFamilies.update( newSelection );
        }
    }
    updateExplicitSelection && selectionModel.setSelection( selectedNodesInCurrentTab );
    // returning to update present selection id's on view model data
    // The case where user selects a family and expand it, then de-select and collapse it.
    // setSelectionTree is getting called as tree nodes got updated but view model data was not updated
    return variabilityData.userSelectionsPickAndChooseGrid;
};

/**
 * Add selected variability data to SPLM table
 * @param {Object} eventData event data info container
 * @param {UwDataProvider} targetDataProvider  target DataProvider
 * @param {Object} gridData atomic data for the grid
 * @param {Object} vmVariabilityProps atomic Data <variabilityProps>
 */
export let addVariabilityToConstraintTree = ( eventData, targetDataProvider, gridData, vmVariabilityProps ) => {
    // If the Subject/Condition section was empty initially, it would have isLeaf set to true
    // Hence, as we are adding some variability to that section, we should set isLeaf to false for Condition/Subject section.
    let { gridEditorMode, parentNode, selected } = eventData;
    let isSnOMatrixGridEditor = gridEditorMode === veConstants.CFG_OBJECT_TYPES.ABS_MATRIX_RULE;
    let isSubjectGrid = parentNode.uid.includes( veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID );
    if( [
        veConstants.GRID_CONSTANTS.CONSTRAINTS_SUBJECT_NODE_UID,
        veConstants.GRID_CONSTANTS.CONSTRAINTS_CONDITION_NODE_UID
    ].includes( parentNode.alternateID ) && parentNode.isLeaf ) {
        parentNode.isLeaf = false;
    }

    let gridProps = gridData.getValue ? gridData.getValue() : gridData.getAtomicData();
    let variabilityProps = { ...vmVariabilityProps.getValue ? vmVariabilityProps.getValue() : vmVariabilityProps.getAtomicData() };
    let selectionMap = gridProps.businessObjectToSelectionMap;
    let gridVMOs = gridProps.viewModelObjectMap;
    let gridNodes = gridProps.variabilityNodes;

    /*
    Example:
    Consider subject grid containing following:
                Incl Rule1
    Fam1
        Feat1      TICK
        Feat2      TICK
    Consider I select Feat3 of Fam1 from Pick And Choose Panel
    The "selected" variable will contain VMOs of - Feat1, Feat2, Feat3
    "eventData" carries information about:
    - "parentNode": Subject/Condition
    - "selected": All elements selected from Pick&Choose panel (both previous and new selections)
    */

    // Clean VMOs based families expand status
    pca0ConfiguratorExplorerCommonUtils.removeSelectedObjects(
        selected, // all elements selected
        selectionMap, // grid selection map
        true // createAlternateId
    );

    // Validate match for active filters, if applicable
    _updateUserIfNewlyAddedFeatureViolatesFilterCriteria( selected, gridVMOs, variabilityProps.activeFilter );

    // Filter only features and families from the selection
    let sourceFeatureAndFamilyNodesSelectedToAdd = selected.filter( ( obj ) => {
        return obj.isFamily || obj.isFeature;
    } );

    // Convert the user selection to a map
    // Key              Value
    // Parent Node      Array of child Nodes
    // TODO CREATE A UTIL TO BUILD SOURCEMAP AND SHORTEN THIS CODE
    // let {sourceTreeMap, familiesToAdd} = _buildSourceMapFromPickAndChoosePanel();
    let sourceTreeMap = {};
    let sourceFamilyNodeList = [];
    let sourceFeatureNodeList = [];
    _.forEach( sourceFeatureAndFamilyNodesSelectedToAdd, ( node ) => {
        if( node.isFamily ) {
            sourceFamilyNodeList.push( node );
        } else {
            sourceFeatureNodeList.push( node );
        }
    } );

    _.forEach( sourceFamilyNodeList, ( familyNode ) => {
        let thisFamilyFeatureNodes = _.intersection( familyNode.children, sourceFeatureNodeList );
        sourceTreeMap[ familyNode.uid ] = thisFamilyFeatureNodes;
        //Remove the allocated features from the features list
        if( sourceFeatureNodeList.length > 0 ) {
            _.remove( sourceFeatureNodeList, ( feature ) => {
                return _.indexOf( thisFamilyFeatureNodes, feature ) !== -1;
            } );
        }
    } );

    // Pending features if any are the ones which are selected without selecting its parent, i.e family
    if( sourceFeatureNodeList.length > 0 ) {
        _.forEach( sourceFeatureNodeList, ( featureNode ) => {
            let { parentUID } = featureNode;
            if( parentUID in sourceTreeMap ) {
                let featureNodes = sourceTreeMap[ parentUID ];
                featureNodes.push( featureNode );
            } else {
                sourceTreeMap[ parentUID ] = [ featureNode ];
            }
        } );
    }
    // end of UTIL CODE

    let targetVMC = targetDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let columns = targetDataProvider.columnConfig.columns;
    let familyExpectedIndx = targetDataProvider.getViewModelCollection().findViewModelObjectById( parentNode.alternateID ) + 1;

    // Define a list of tree nodes that are created as no yet present in the DataProvider's VMC
    // This list will be used to set VMO properties in editing mode after all nodes have been created
    // Util setSubjectVmoPropsInSnOMatrixGridEditor must be called once new structure is complete
    // If we call it while creating the node, some props like isLeaf or isExpanded are not yet set correctly for families
    // And this could lead to misbehavior especially if Edit mode is active
    let listOfCreatedNodes = [];

    // Iterate over treemap and add to target dataprovider
    _.forEach( Object.keys( sourceTreeMap ).reverse(), familyUid => {
        let featureNodesToAdd = sourceTreeMap[ familyUid ];
        // Check if family exists in target
        let targetFamilyNode = _.find( targetVMC, { alternateID: parentNode.nodeUid + ':' + familyUid } );
        let familyGridVMO = {};
        let familyGridNode = {};
        if( !targetFamilyNode ) {
            // Add family node
            let sourceFamilyNode = _.find( sourceFamilyNodeList, { uid: familyUid } );
            if( !sourceFamilyNode ) {
                // Load Family before proceeding
                sourceFamilyNode = viewModelObjectSvc.constructViewModelObjectFromModelObject( cdm.getObject( familyUid ), 'EDIT' );
                sourceFamilyNode.isFamily = true;
                sourceFamilyNode.displayName = _.get( sourceFamilyNode, 'props.object_name.uiValue' );
                sourceFamilyNode.iconURL = sourceFamilyNode.typeIconURL;
                sourceFamilyNode.isEnumerated = featureNodesToAdd[ 0 ].isParentEnumerated;
                sourceFamilyNode.isFreeForm = featureNodesToAdd[ 0 ].isParentFreeForm;
                sourceFamilyNode.dataType = featureNodesToAdd[ 0 ].isParentEnumerated ? featureNodesToAdd[ 0 ].familyType : undefined;
                if( isSnOMatrixGridEditor && isSubjectGrid && ( sourceFamilyNode.isEnumerated || sourceFamilyNode.isFreeForm ) ) {
                    sourceFamilyNode.isAddRangeNotSupported = true;
                }
            }
            const result = exports.createTreeNode( {
                sourceNode: sourceFamilyNode,
                targetParentNode: parentNode,
                levelIndex: 1,
                childIndex: 1,
                targetVMC: targetVMC,
                isLeafNode: sourceFamilyNode.isLeaf,
                selectionMap: selectionMap,
                parentGridNode: familyGridNode,
                parentTree: parentNode.uid,
                splitColumnsMap: variabilityProps.splitColumnsMap,
                isRangeExpression: false,
                expectedIndexInVMC: familyExpectedIndx,
                treeDataProviderColumns: columns
            } );
            targetFamilyNode = result.targetNode;
            listOfCreatedNodes.push( targetFamilyNode );

            familyGridVMO = result.gridVMO;
            familyGridNode = result.gridNode;
            gridVMOs[ sourceFamilyNode.uid ] = familyGridVMO[ sourceFamilyNode.uid ];
            gridNodes.push( familyGridNode );
            gridVMOs[ parentNode.uid ].childrenUids = [ ...parentNode.childrenUids ];
            gridVMOs[ parentNode.uid ].children = [ ...parentNode.children ];

            // Update hierarchy in the grid
            let parentGridNode = _.find( gridNodes, ( gridNode ) => { return gridNode.nodeUid === parentNode.uid; } );
            if( parentGridNode.childrenUids === undefined ) {
                parentGridNode.childrenUids = [];
            }
            if( parentGridNode.children === undefined ) {
                parentGridNode.children = [];
            }
            parentGridNode.childrenUids = [ ...parentNode.childrenUids ];
            parentGridNode.children = [ ...parentNode.children ];
        }

        let featureExpectedIndx = targetVMC.indexOf( targetFamilyNode ) + 1;

        // Add features if they do no exist in target
        _.forEach( featureNodesToAdd, ( featureNode ) => {
            let familyGridNode = _.find( gridNodes, ( gridNode ) => { return gridNode.nodeUid === familyUid; } );
            let targetFeatureNode = _.find( targetVMC, { alternateID: parentNode.nodeUid + ':' + familyUid + ':' + featureNode.uid } );
            if( !targetFeatureNode ) {
                let createNodeResult = exports.createTreeNode( {
                    sourceNode: featureNode,
                    targetParentNode: targetFamilyNode,
                    levelIndex: 2,
                    childIndex: 1,
                    targetVMC: targetVMC,
                    isLeafNode: true,
                    selectionMap: selectionMap,
                    parentGridNode: familyGridNode,
                    parentTree: parentNode.uid,
                    splitColumnsMap: variabilityProps.splitColumnsMap,
                    isRangeExpression: false,
                    expectedIndexInVMC: featureExpectedIndx,
                    treeDataProviderColumns: columns
                } );
                listOfCreatedNodes.push( createNodeResult.targetNode );

                let gridVMO = createNodeResult.gridVMO;
                let gridNode = createNodeResult.gridNode;
                featureExpectedIndx += 1;
                gridVMOs[ featureNode.uid ] = gridVMO[ featureNode.uid ];
                gridNodes.push( gridNode );

                // Update hierarchy in the grid
                if( familyGridNode.childrenUids === undefined ) {
                    familyGridNode.childrenUids = [];
                }
                if( familyGridNode.children === undefined ) {
                    familyGridNode.children = [];
                }
                familyGridNode.childrenUids = [ ...targetFamilyNode.childrenUids ];
                familyGridNode.children = [ ...targetFamilyNode.children ];
                targetFamilyNode.isLeaf = false; // isLeaf is set to true if family has no children in the tree
            }
        } );
    } );

    // Adjust Tree Node properties for Subject section in Matrix mode if needed
    if( isSnOMatrixGridEditor && isSubjectGrid ) {
        listOfCreatedNodes.forEach( treeNode => {
            // Adjust TreeNodes Props for Subject section when authoring Matrix Rules
            columns.forEach( columnDef => {
                if( !columnDef.isColumnFromCots ) {
                    pca0GridCommonUtils.setSubjectVmoPropsInSnOMatrixGridEditor( treeNode, columnDef );
                }
            } );
        } );
    }

    // <TODO REMOVE> variabilityProps is not being updated any time.
    vmVariabilityProps.setAtomicData ? vmVariabilityProps.setAtomicData( { ...variabilityProps } ) : vmVariabilityProps.update( { ...variabilityProps } );

    gridData.setAtomicData ? gridData.setAtomicData( { ...gridProps } ) : gridData.update( { ...gridProps } );

    // Trigger Summary update
    pca0GridCommonUtils.updateAllNodesSummary( targetDataProvider, selectionMap, gridVMOs, false );

    // Finally update the target data provider
    targetDataProvider.update( targetVMC );
    _closeAddVariabilityPanel( eventData.isPanelPinned, eventData.popupId );
};

/**
 * Add new Range Expression VMO to target Data Provider
 * @param {Object} eventData event data container
 * @param {UwDataProvider} targetDataProvider - Data Provider to be updated with new Range Expression
 * @param {Object} gridData - top/bottom Grid Data
 * @param {Object} vmVariabilityProps - Atomic Data <variabilityProps>
 * @param {Object} viewModelData -viewModelData
 */
export let addRangeExpressionToVariabilityTree = async( eventData, targetDataProvider, gridData, vmVariabilityProps, viewModelData ) => {
    let { parentNode, selected, valueText, isRangeExpression } = eventData;
    const dataObj = {
        data: { ...viewModelData },
        ctx: appCtxSvc.ctx
    };

    if ( !parentNode.isExpanded ) {
        parentNode.isExpanded = true;
        await targetDataProvider.expandObject(  dataObj, parentNode );
    }

    let gridProps = gridData.getValue ? gridData.getValue() : gridData.getAtomicData();
    let variabilityProps = { ...vmVariabilityProps.getValue ? vmVariabilityProps.getValue() : vmVariabilityProps.getAtomicData() };
    let selectionMap = gridProps.businessObjectToSelectionMap;
    let gridVMOs = gridProps.viewModelObjectMap;
    let gridNodes = gridProps.variabilityNodes;
    let sourceObject = selected[ 0 ];
    sourceObject.isParentFreeForm = parentNode.isFreeForm;
    sourceObject.valueText = valueText;
    sourceObject.displayName = isRangeExpression ? valueText : selected[ 0 ].displayName;
    sourceObject.isLeaf = true;
    sourceObject.parentUID = parentNode.nodeUid;
    sourceObject.type = parentNode.familyType ? parentNode.familyType : parentNode.type;
    sourceObject.isParentEnumerated = parentNode.isEnumerated;
    sourceObject.uid = isRangeExpression ? parentNode.nodeUid + ':' + valueText : selected[ 0 ].nodeUid;
    sourceObject.iconURL = iconSvc.getTypeIconURL( pca0Constants.CFG_OBJECT_TYPES.TYPE_LITERAL_FEATURE );
    if( gridVMOs[ sourceObject.uid ] ) {
        messagingService.showError( localeTextBundle.showDuplicateFreeFormValueErrorMessage.replace( '{0}', valueText ) );
        return;
    }
    let targetVMC = targetDataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let columns = targetDataProvider.columnConfig.columns;
    let featureIndx = targetDataProvider.getViewModelCollection().findViewModelObjectById( parentNode.alternateID ) + 1;
    let parentTreeNode = gridNodes.find( node => {
        if( node.nodeUid === parentNode.nodeUid ) {
            return node;
        }
    } );
    let targetFamilyNode = _.find( targetVMC, { alternateID: parentNode.alternateID } );

    // As a feature is added to Enumerated/FreeForm family, it will no longer be a leaf
    targetFamilyNode.isLeaf = false;
    let createNodeResult = exports.createTreeNode( {
        sourceNode: sourceObject,
        targetParentNode: targetFamilyNode,
        levelIndex: 2,
        childIndex: 1,
        targetVMC: targetVMC,
        isLeafNode: true,
        selectionMap: selectionMap,
        parentGridNode: parentTreeNode,
        parentTree: targetFamilyNode.parentUID,
        splitColumnsMap: variabilityProps.splitColumnsMap ? variabilityProps.splitColumnsMap : {},
        isRangeExpression: true,
        expectedIndexInVMC: featureIndx,
        treeDataProviderColumns: columns
    } );
    let gridVMO = createNodeResult.gridVMO;
    let gridNode = createNodeResult.gridNode;
    gridVMOs[ sourceObject.uid ] = gridVMO[ sourceObject.uid ];
    gridNodes.push( gridNode );
    vmVariabilityProps.setAtomicData ? vmVariabilityProps.setAtomicData( { ...variabilityProps } ) : vmVariabilityProps.update( { ...variabilityProps } );
    gridData.setAtomicData ? gridData.setAtomicData( { ...gridProps } ) : gridData.update( { ...gridProps } );

    // Finally update the target data provider
    targetDataProvider.update( targetVMC );
};

/**
 * Create View Model Tree Node for the Constraint grid
 * @param { Object } constraintTreeNodeParams - object which contains following info to create VMO
 *      sourceNode - source VM Tree Node
 *      targetParentNode - target Parent VM Tree Node
 *      levelIndex - Index with respect to family
 *      childIndex -  Index of child node with respect to its parent
 *      targetVMC - Target ViewModel Collection
 *      isLeafNode - true if node is Leaf
 *      selectionMap - to populate value for column props
 *      parentGridNode - To update parent nodes with its children uids
 *      parentTree - Subject/Condition
 *      splitColumnsMap - Map of Split Columns
 *      isRangeExpression - Is range expression added from range panel
 *      expectedIndexInVMC - Index of feature in loaded nodes in tree
 *      treeDataProviderColumns - List of column definitions for the dataProvider
 * @returns {ViewModelTreeNode} constraint VM Tree node
 */
export let createTreeNode = ( constraintTreeNodeParams ) => {
    /**
     * TODO
     * We need to add a SOA call to load additional properties if PropertyColumns are displayed
     */
    const {
        sourceNode,
        targetParentNode,
        levelIndex,
        childIndex,
        targetVMC,
        isLeafNode,
        selectionMap,
        parentGridNode,
        parentTree,
        splitColumnsMap,
        isRangeExpression,
        expectedIndexInVMC,
        treeDataProviderColumns
    } = constraintTreeNodeParams;
    let targetNode = awTableTreeSvc.createViewModelTreeNode( sourceNode.uid,
        sourceNode.type, sourceNode.displayName, levelIndex, childIndex, sourceNode.iconURL );
    let { uid } = sourceNode;
    let gridVMO = {};
    let gridNode = {
        childrenUids: [],
        isExpanded: !isLeafNode,
        nodeUid: uid,
        props: {
            isLeaf: [ isLeafNode ],
            parentTree: [ parentTree ]
        },
        parent: [ targetParentNode.uid ]
    };

    targetNode.parentUID = targetParentNode.uid;
    if( isLeafNode ) {
        targetNode.alternateID = pca0CommonUtils.prepareUniqueId( targetParentNode.alternateID, sourceNode.uid );
    } else {
        targetNode.alternateID = pca0CommonUtils.prepareUniqueId( targetParentNode.uid, sourceNode.uid );
    }

    targetNode.props = _generatePropertyMap( sourceNode, treeDataProviderColumns, selectionMap, parentTree, splitColumnsMap );

    targetNode.props.isFreeForm = [ sourceNode.isFreeForm ? 'true' : 'false' ];
    targetNode.props.cfg0ValueDataType = [ sourceNode.dataType ];
    gridVMO[ uid ] = {
        displayName: sourceNode.displayName,
        props: targetNode.props,
        sourceType: sourceNode.type,
        sourceUid: sourceNode.uid
    };
    targetNode.nodeUid = sourceNode.uid;
    targetNode.isLeaf = isLeafNode;
    targetNode.isParentEnumerated = sourceNode.isParentEnumerated;
    targetNode.isParentFreeForm = sourceNode.isParentFreeForm;
    targetNode.isFreeForm = sourceNode.isFreeForm;
    targetNode.isEnumerated = sourceNode.isEnumerated;
    targetNode.familyType = sourceNode.dataType;
    targetNode.isRangeExpression = isRangeExpression;
    targetNode.isOptional = sourceNode.isOptional;
    targetNode.isAddRangeNotSupported = sourceNode.isAddRangeNotSupported;
    targetNode.isSingleSelect = sourceNode.isSingleSelect;

    !_.isUndefined( sourceNode.isFeature ) && ( targetNode.isFeature = sourceNode.isFeature );
    !_.isUndefined( sourceNode.isFamily ) && ( targetNode.isFamily = sourceNode.isFamily );

    _updateIsPropertyModifiableProp( targetNode, treeDataProviderColumns );

    targetVMC.splice( expectedIndexInVMC, 0, targetNode );

    if( !targetParentNode.children ) {
        targetParentNode.children = [];
    }
    targetParentNode.children.push( targetNode );
    targetParentNode.isExpanded = true;
    if( !targetParentNode.childrenUids ) {
        targetParentNode.childrenUids = [];
    }
    targetParentNode.childrenUids.push( targetNode.uid );
    parentGridNode.childrenUids = targetParentNode.childrenUids;

    return { targetNode, gridVMO, gridNode };
};

/**
 * Loads the provided tabs in a panel
 * @param {Object} tabModels - default tab models
 * @param {Object} displayProperties - display properties
 * @return {Object} returns tab model
 */
export let loadPanelTabs = function( tabModels, displayProperties ) {
    if( !displayProperties.visibleTabs ) {
        return {
            visibleTabs: tabModels
        };
    }

    let visibleTabKeys = displayProperties.visibleTabs.split( ',' );
    let visibleTabModels = [];
    if( visibleTabKeys && visibleTabKeys.length > 0 ) {
        visibleTabKeys.forEach( visibleTab => {
            var result = tabModels.find( tabModel => {
                return tabModel.tabKey === visibleTab;
            } );
            visibleTabModels.push( result );
        } );
    }
    return {
        visibleTabs: visibleTabModels
    };
};

export default exports = {
    updateVariabilitySelection,
    addVariabilityToConstraintTree,
    addRangeExpressionToVariabilityTree,
    createTreeNode,
    loadPanelTabs
};
