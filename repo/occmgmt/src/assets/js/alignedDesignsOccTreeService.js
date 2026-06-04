// Copyright (c) 2025 Siemens

/**
 * @module js/alignedDesignsOccTreeService
 */
import AwPromiseService from 'js/awPromiseService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import aceGetOccsResponseService from 'js/aceGetOccsResponseService';
import soaSvc from 'soa/kernel/soaService';
import awColumnSvc from 'js/awColumnService';
import iconSvc from 'js/iconService';
import tcVmoService from 'js/tcViewModelObjectService';
import localeService from 'js/localeService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';
import policySvc from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import cdmSvc from 'soa/kernel/clientDataModel';

const clientScopeURI = 'awb0Structure';

// Register a property policy to ensure required properties are loaded
const itemRevisionPolicy = {
    types: [ {
        name: 'ItemRevision',
        properties: [
            { name: 'object_type' },
            { name: 'owning_user' }
        ]
    } ]
};

const elementPolicy = {
    types: [ {
        name: 'Awb0Element',
        properties: [
            { name: 'awb0UnderlyingObject' },
            { name: 'awb0UnderlyingObjectType' }
        ]
    } ]
};

/**
 * Configures and returns view settings for the aligned designs occurrence tree.
 *
 * @param {Object} subPanelContext - The context object for the subpanel, containing context information.
 * @param {Object} data - The data object containing configuration structures.
 * @returns {Object} An object containing: gridId, contextKey, and configureStructureView.
 */
export const setViewConfig = function( subPanelContext, data ) {
    const contextKey = subPanelContext?.context?.contextKey || 'occmgmtContext';
    const isRightEdit = subPanelContext?.context?.customEditContext === 'rightXRTEditContext';
    return {
        gridId: isRightEdit ? 'alignedDesignsOccTreeGrid2' : 'alignedDesignsOccTreeGrid',
        contextKey,
        configureStructureView: isRightEdit ? data.configureStructure2 : data.configureStructure
    };
};

/**
 * Retrieves the reverse tree selection object(s) based on the given sub-panel context and parent node.
 * - If the parent node is not the root, returns an array with the parent node's UID and type.
 * - If the parent node is the root, attempts to find aligned occurrences using the current selection,
 *   loads their objects, and returns an array of unique aligned selection objects with their UIDs and types.
 *
 * @async
 * @param {Object} subPanelContext - The context object containing selection and occurrence context.
 * @param {Object} parentNode - The parent node object, expected to have `uid`, `type`, and `levelNdx` properties.
 * @returns {Promise<Array<{uid: string, type: string}>>} A promise that resolves to an array of selection objects,
 * each containing a `uid` and `type` property.
 */
const _getReverseTreeSelectionObj = async function( subPanelContext, parentNode ) {
    const defaultObj = [ { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' } ];

    // Check if the parent node is not the root node
    if ( parentNode.levelNdx !== -1 ) {
        // If not root, just return the parent node's uid and type
        return [ { uid: parentNode.uid, type: parentNode.type } ];
    }

    // Get the current selection from the subPanelContext
    const currentSelection = subPanelContext.selected;
    if ( !currentSelection ) {
        // If nothing is selected, return the default object
        return defaultObj;
    }

    // Prepare input for finding aligned occurrences
    const findAlignedInput = {
        targetContext: { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' },
        occurrences: [ currentSelection ]
    };

    // Get the UIDs of aligned objects
    const alignedObjectsUids = await _getAlignedObjectUids( findAlignedInput );
    if ( !alignedObjectsUids.length ) {
        // If no aligned objects, return the default object
        return defaultObj;
    }
    // Register a property policy to ensure required properties are loaded
    const policyId = policySvc.register( elementPolicy );

    // Load the aligned objects
    await dmSvc.loadObjects( alignedObjectsUids );

    // Retrieve the loaded objects from the client data model
    const alignedDesignObjs = await Promise.all(
        alignedObjectsUids.map( uid => cdmSvc.getObject( uid ) )
    );

    // Unregister the property policy
    if ( policyId ) {
        policySvc.unregister( policyId );
    }

    // Build a list of unique aligned selection objects (by uid)
    const alignedSelectionObjs = [];
    const seenUids = new Set();
    for ( const alignedDesignObj of alignedDesignObjs ) {
        const props = alignedDesignObj?.props;
        if ( props && props.awb0UnderlyingObject && props.awb0UnderlyingObjectType ) {
            // Get the underlying object UID
            const uid = props.awb0UnderlyingObject.dbValues[0];
            // Only add if not already seen (deduplication)
            if ( !seenUids.has( uid ) ) {
                seenUids.add( uid );
                alignedSelectionObjs.push( {
                    uid: uid,
                    type: props.awb0UnderlyingObjectType.dbValues[0]
                } );
            }
        }
    }

    // Return the unique aligned selection objects, or the default if none found
    return alignedSelectionObjs.length ? alignedSelectionObjs : defaultObj;
};

/**
 * Extracts the list of aligned object UIDs (objectsToFind) from a findAlignedOccurrences SOA response.
 * @param {object} findAlignedInput - The input object for the findAlignedOccurrences SOA call.
 * @returns {Array<string>} - Array of aligned object UIDs, or an empty array if none found.
 */
const _getAlignedObjectUids = function( findAlignedInput ) {
    return soaSvc.postUnchecked( 'Internal-EntCba-2021-12-Alignments', 'findAlignedOccurrences', findAlignedInput ).then(
        response => {
            if( response?.ServiceData?.partialErrors ) {
                return aceGetOccsResponseService.processPartialErrors( response );
            }
            if ( response?.output?.length > 0 ) {
                const alignedInfo = response.output[0];
                const alignOccurrences = alignedInfo.alignedOccurrences;
                if ( Array.isArray( alignOccurrences ) ) {
                    return alignOccurrences.map( occ => occ.uid );
                }
            }
            return [];
        } );
};

/**
 * Loads an Aligned Designs Occurrence tree structure, supporting both single and multiple root nodes.
 * Aggregates results from multiple SOA calls and deduplicates top-level nodes by uid.
 *
 * @async
 * @param {Object} treeLoadInput - The input object for loading the tree, including parentNode and displayMode.
 * @param {Object} subPanelContext - The context object for the subpanel, used to determine tree selection.
 * @param {boolean} configureParent - Flag indicating whether to configure parent and child nodes.
 * @param {number|string} level - The tree level to load.
 * @returns {Promise<Object>} A promise that resolves to the merged tree load result object.
 */
export const loadAlignedDesignsOccTree = async function( treeLoadInput, subPanelContext, configureParent, level ) {
    const deferred = AwPromiseService.instance.defer();

    // Get the reverse tree selection objects (could be multiple for aligned objects)
    const reverseeTreeNode = await _getReverseTreeSelectionObj( subPanelContext, treeLoadInput?.parentNode );
    // Create a shallow copy to avoid mutating the original input and prevent race conditions
    const treeLoadInputCopy = { ...treeLoadInput, displayMode: 'Tree' };

    // If multiple root nodes, call SOA for each and aggregate results
    if ( Array.isArray( reverseeTreeNode ) ) {
        const allPromises = reverseeTreeNode.map( node => {
            const soaInput = {
                whereUsedInput: {
                    inputObject: node,
                    additionalInfo: {
                        configureParentAndChild: [ configureParent ? 'true' : 'false' ],
                        level: [ level ]
                    },
                    cursorInfo: treeLoadInputCopy.parentNode.cursorInfo,
                    pageSize: 100,
                    columnConfigInput: {
                        clientName: 'AWClient',
                        clientScopeURI: clientScopeURI,
                        columnsToExclude: [],
                        hostingClientName: '',
                        operationType: ''
                    },
                    revisionRule: {
                        uid: subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0],
                        type: 'RevisionRule'
                    }
                }
            };

            // Wrap _buildTreeTableStructure in a Promise for aggregation
            return new Promise(  resolve  => {
                _buildTreeTableStructure( treeLoadInputCopy, soaInput, { resolve } );
            } );
        } );

        Promise.all( allPromises ).then( results => {
            // Use the first result as the base for merged result
            const mergedTreeLoadResult = _.cloneDeep( results[0] );
            // Prepare to collect unique child nodes by uid
            const uniqueChildNodes = [];
            const seenUids = new Set();

            // Aggregate and deduplicate all child nodes
            for ( const result of results ) {
                const childNodes = result?.treeLoadResult?.childNodes || [];
                for ( const node of childNodes ) {
                    if ( !seenUids.has( node.uid ) ) {
                        seenUids.add( node.uid );
                        uniqueChildNodes.push( node );
                    }
                }
            }

            // Set the deduplicated child nodes and update total count
            mergedTreeLoadResult.treeLoadResult.childNodes = uniqueChildNodes;
            mergedTreeLoadResult.treeLoadResult.totalChildCount = uniqueChildNodes.length;

            deferred.resolve( mergedTreeLoadResult );
        } );
    }
    return deferred.promise;
};

/**
 * Adds a 'usedAsSubstitute' property to the given tree node's props, initializing it as a non-modifiable
 * boolean view model property using the provided value.
 *
 * @param {Object} treeNode - The tree node object to which the property will be added.
 * @param {boolean} usedAsSubstitute - The boolean value indicating if the node is used as a substitute.
 */
const _createSubstituteProp = function( treeNode, usedAsSubstitute ) {
    /**
     * Create view model property.
     */
    treeNode.props.usedAsSubstitute = uwPropertySvc.createViewModelProperty( 'usedAsSubstitute', '', 'BOOLEAN', usedAsSubstitute, usedAsSubstitute );

    /**
     * Set properties into view model.
     */
    treeNode.props.usedAsSubstitute.dbValues = [ usedAsSubstitute ];
    treeNode.props.usedAsSubstitute.uiValues = [ usedAsSubstitute ];
    treeNode.props.usedAsSubstitute.uiValue = usedAsSubstitute;

    uwPropertySvc.setIsPropertyModifiable( treeNode.props.usedAsSubstitute, false );
};

/**
 * Builds the tree table structure by calling the SOA and formatting the response for the table.
 * Handles property policy registration, error processing, column configuration, and node creation.
 *
 * @param {Object} treeLoadInput - Input for the tree load operation.
 * @param {Object} soaInput - Input for the SOA call.
 * @param {Object} deferred - Deferred object to resolve with the result.
 */
const _buildTreeTableStructure = function( treeLoadInput, soaInput, deferred ) {
    // Register a property policy to ensure required properties are loaded
    const policyId = policySvc.register( itemRevisionPolicy );

    // Call the SOA to get where used information
    soaSvc.postUnchecked( 'Internal-Structure-2025-06-WhereUsed', 'getWhereUsedInfo2', soaInput ).then( response => {
        // Unregister the property policy after SOA call
        if ( policyId ) {
            policySvc.unregister( policyId );
        }

        // Determine if we are retrieving the first level (root) of the tree
        const retrievingFirstLevel = treeLoadInput.parentNode.levelNdx === -1;
        const columnConfig = retrievingFirstLevel ? _initColumsForAlignedDesignsOccTable( response.columnConfigOutput ) : {};

        const modelObjects = [];

        // Process the childToParentMap to build model objects for the tree
        if ( response.childToParentMap ) {
            for ( let indx = 0; indx < response.childToParentMap[0].length; indx++ ) {
                if ( retrievingFirstLevel ) {
                    // Only add the top node as the root
                    const modelObject = response.childToParentMap[0][indx];
                    modelObject.props.hasParent = response.childToParentMap[1][indx].length > 0;
                    _createSubstituteProp( modelObject, modelObject.occDataInfo );
                    modelObjects.push( modelObject );
                    break; // Only one root node needed
                }
                // Add parent nodes as children when expanding the top node
                for ( let jndx = 0; jndx < response.childToParentMap[1][indx].length; jndx++ ) {
                    const obj = response.childToParentMap[1][indx][jndx];
                    const modelObject = obj.resultObject;
                    modelObject.props.hasParent = obj.hasParent;
                    _createSubstituteProp( modelObject, obj.occDataInfo );
                    modelObjects.push( modelObject );
                }
            }
        }

        // Update cursor info for paging support
        if ( response.cursorInfo ) {
            treeLoadInput.parentNode.cursorObject = response.cursorInfo[soaInput.whereUsedInput.inputObject.uid];
            treeLoadInput.parentNode.cursorInfo = response.cursorInfo;
        }

        // Prepare view model tree nodes for the table
        const treeLoadResult = _createViewModelTreeNode( treeLoadInput, modelObjects );

        // Ensure cursorObject is set or cleared as needed
        treeLoadResult.parentNode.cursorObject = modelObjects.length > 0 ? treeLoadInput.parentNode.cursorObject : undefined;
        treeLoadResult.columnConfig = columnConfig;

        // Resolve the deferred result with the tree structure and additional info
        deferred.resolve( {
            treeLoadResult: treeLoadResult,
            clientScopeURI: clientScopeURI,
            objectSetUri: clientScopeURI
        } );
    } );
};

/**
 * Creates a list of view model tree nodes from the given model objects and tree load input.
 *
 * @param {Object} treeLoadInput - The input object containing information about the tree loading context, including the parent node and page size.
 * @param {Array<Object>} modelObjects - An array of model objects to be converted into tree nodes.
 * @returns {Object} The result of building the tree load, containing the generated view model tree nodes and related metadata.
 */
const _createViewModelTreeNode = function( treeLoadInput, modelObjects ) {
    const vmNodes = [];
    // This is the "root" node of the tree or the node that was selected for expansion
    const parentNode = treeLoadInput.parentNode;
    const levelNdx = parentNode.levelNdx + 1;
    treeLoadInput.pageSize = modelObjects.length;
    for ( let childNdx = 0; childNdx < modelObjects.length; childNdx++ ) {
        const modelObj = modelObjects[childNdx];
        const displayName = modelObj.props.object_string.uiValues[0];
        const iconType = modelObj.type;
        const iconURL = iconSvc.getTypeIconURL( iconType );
        const hasParent = modelObjects[childNdx].props.hasParent;

        //Create treeModelObject
        const treeVmNode = awTableTreeSvc.createViewModelTreeNode( modelObj.uid, modelObj.type, displayName, levelNdx, childNdx, iconURL );

        //Generating unique id for each row. We can't reply on uid as we can have same object multiple time in same table.
        const id = treeVmNode.id + treeLoadInput.parentNode.id + childNdx + treeLoadInput.parentNode.levelNdx;
        treeVmNode.id = id;
        treeVmNode.alternateID = id;

        //copy properties from model object to tree model object
        tcVmoService.mergeObjects( treeVmNode, modelObj );

        //set isLeaf on TreeModelObject
        treeVmNode.isLeaf = !hasParent;

        if ( treeVmNode ) {
            vmNodes.push( treeVmNode );
        }
    }
    if ( treeLoadInput.parentNode.cursorObject ) {
        return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, treeLoadInput.parentNode.cursorObject.endReached, true );
    }
    return awTableTreeSvc.buildTreeLoadResult( treeLoadInput, vmNodes, true, true, null, true );
};

/**
 * Initializes and formats column information for the Aligned Designs Occurrence Tree table.
 * Converts the provided column configuration into an array of column info objects
 * suitable for use with the AW column service, enabling features like resizing and pinning.
 *
 * @param {Object} columnConfig - The configuration object containing column definitions.
 * @returns {Object} An object containing the columnConfigId and an array of formatted column info objects.
 */
const _initColumsForAlignedDesignsOccTable = function( columnConfig ) {
    // Build AW Columns
    const awColumnInfos = [];
    const columnConfigCols = columnConfig.columns;
    for ( let index = 0; index < columnConfigCols.length; index++ ) {
        const col = columnConfigCols[index];
        // fix to increase column width for first column
        const columnInfo = {
            field: col.propertyName,
            name: col.propertyName,
            propertyName: col.propertyName,
            displayName: col.displayName,
            typeName: col.assosiatedTypeName,
            pixelWidth: col.pixelWidth,
            hiddenFlag: col.hiddenFlag,
            enableColumnResizing: true,
            enablePinning: false
        };
        const awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );

        awColumnInfos.push( awColumnInfo );
    }

    // Set columnConfig to Data Provider.
    return {
        columnConfigId: columnConfig.columnConfigId,
        columns: awColumnInfos
    };
};

/**
 * Loads the next level of the Aligned Designs Occurrence tree structure asynchronously.
 *
 * @param {Object} treeLoadInput - The input object containing information about the current tree state and parent node.
 * @param {Object} subPanelContext - The context object for the subpanel, used to determine selection and configuration.
 * @param {boolean} configureParent - Flag indicating whether to configure both parent and child nodes.
 * @param {number} level - The tree level to load.
 * @returns {Promise} A promise that resolves when the tree structure has been built and loaded.
 */
export const loadNextAlignedDesignsOccTree = async function( treeLoadInput, subPanelContext, configureParent, level ) {
    const deferred = AwPromiseService.instance.defer();

    const reverseeTreeNode = await _getReverseTreeSelectionObj( subPanelContext, treeLoadInput.parentNode );
    // Create a shallow copy to avoid mutating the original input and prevent race conditions
    const treeLoadInputCopy = { ...treeLoadInput, displayMode: 'Tree' };

    if ( !treeLoadInput.parentNode.cursorInfo ) {
        treeLoadInput.parentNode.cursorInfo = {};
    }
    //Prepare SOA input
    const soaInput = {
        whereUsedInput: {
            inputObject: reverseeTreeNode[0],
            additionalInfo: {
                configureParentAndChild: [ configureParent ? 'true' : 'false' ],
                level: [ level ]
            },
            cursorInfo: treeLoadInputCopy.parentNode.cursorInfo,
            pageSize: 100,
            columnConfigInput: {
                clientName: 'AWClient',
                clientScopeURI: clientScopeURI,
                columnsToExclude: [],
                hostingClientName: '',
                operationType: ''
            },
            revisionRule: {
                uid: subPanelContext.occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[0],
                type: 'RevisionRule'
            }
        }
    };

    _buildTreeTableStructure( treeLoadInputCopy, soaInput, deferred );
    return deferred.promise;
};

/**
 * Asynchronously retrieves the localized label for a toggle based on its value.
 *
 * @async
 * @param {boolean} toggleValue - The current value of the toggle (true for "on", false for "off").
 * @returns {Promise<string>} A promise that resolves to the localized label for the toggle state.
 */
export const updateToggleLabel = async function( toggleValue ) {
    const key = toggleValue
        ? 'OccurrenceManagementConstants.toggleOn'
        : 'OccurrenceManagementConstants.toggleOff';
    return localeService.getLocalizedTextFromKey( key ).then( displayName => displayName );
};

/**
 * Resets and retrieves the aligned designs occurrence data.
 *
 * Fetches the current revision rule label value from the application context
 * and returns it in an object.
 *
 * @param {Object} revisionRule - The revision rule object (not used in this implementation).
 * @returns {{ revisionRuleLabelValue: string }} An object containing the current revision rule label value.
 */
export const resetAlignedDesignsOccData = function( revisionRule ) {
    return {
        revisionRuleLabelValue: revisionRule.uiValues[0]
    };
};

export default {
    setViewConfig,
    loadAlignedDesignsOccTree,
    loadNextAlignedDesignsOccTree,
    updateToggleLabel,
    resetAlignedDesignsOccData
};
