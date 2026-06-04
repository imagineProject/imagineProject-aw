// Copyright (c) 2023 Siemens
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import soaService from 'soa/kernel/soaService';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import AwSplmTable from 'viewmodel/AwSplmTableViewModel';
import vmoSvc from 'js/viewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import { initDataProviderRef } from 'js/xrtUtilities';
import tableSvc from 'js/splmTablePublishedService';
import _ from 'lodash';


import treeDPReqRespHelper from 'js/treeDataProviderRequestResponseHelper';

let exports = {};

let _isSimplePage = true;
let _startReached = true;
let _endReached = true;
let _newTopNode = null;

const inlineEditingSupportedProperties = [ 'object_name', 'object_desc', 'item_id', 'item_revision_id' ];

/**
 * Component to render Copy Options
 *
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awCopyOptionsRenderFunction = ( props ) => {
    const { type, xrtData, viewModel } = props;
    const { grids, i18n, dataProviders, data } = viewModel;

    if( !xrtData ) {
        return null;
    }

    if( type === 'SAVEAS' ) {
        return(
            <AwCommandPanelSection caption={i18n.advancedCopyOptions} collapsed='true' anchor={'aw_copyOptions'} context={ { dataProvider: dataProviders.copyOptionsDataProvider, type, namingRules: data.namingRules } }>
                <AwSplmTable {...grids.copyOptionsSaveAsTable} useTree={true}>
                </AwSplmTable>
            </AwCommandPanelSection>
        );
    }
    return(
        <AwCommandPanelSection caption={i18n.advancedCopyOptions} collapsed='true' anchor={'aw_copyOptions'} context={ { dataProvider: dataProviders.copyOptionsDataProvider, type, namingRules: data.namingRules } }>
            <AwSplmTable {...grids.copyOptionsReviseTable} useTree={true}>
            </AwSplmTable>
        </AwCommandPanelSection>
    );
};

const getChildrenForUnexpandedChildVmNodes = ( vmNode, newVmNodeChildren, i18n, type, namingRules ) => {
    vmNode.children = [];
    for( const idx in newVmNodeChildren ) {
        const childDeepCopyData = newVmNodeChildren[ idx ];
        const attachedObj = cdm.getObject( childDeepCopyData.attachedObject.uid );
        const childVmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
        const childVmNode = exports.convertDeepCopyDataToVmTreeNode( childDeepCopyData, vmNode, childVmo, idx, i18n, type, namingRules );
        if( childDeepCopyData.childDeepCopyData && !childVmNode.children ) {
            getChildrenForUnexpandedChildVmNodes( childVmNode, childDeepCopyData.childDeepCopyData, i18n, type, namingRules );
        }
        vmNode.children.push( childVmNode );
    }
};

/**
 * Fetch copy options and create tree node vmos
 *
 * @param {Object} xrtData - decl xrtData
 * @param {Object} dataProvider - data provider
 * @param {Object} columnProviders - decl column providers
 * @param {Object} i18n - viewmodel i18n
 * @param {Object} treeLoadInput - tree load input
 * @param {Object} xrtState - Xrt state atomic data
 * @param {String} type - XRT type (Saveas or Revise)
 * @returns {Object} - data provider data
 */
export const initCopyOptions = async( xrtData, dataProvider, columnProviders, i18n, treeLoadInput, xrtState, type ) => {
    let _actionDeepCopyRenderer = {
        action: function( column, vmo, tableElem ) {
            let actionValue = vmo.props.action.dbValue;
            compareAndUpdateOldValueAndNewValue( vmo, actionValue );
            let cellContent = tableSvc.createElement( column, vmo, tableElem );
            if( vmo.props.action.isEditable ) {
                let actionValue = vmo.props.action.dbValue;
                let cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
                if( cellText && actionValue === 'NoCopy' && column.field !== 'action' ) {
                    cellContent.classList.add( 'aw-grid-markup-deleted' );
                }
            }
            return cellContent;
        },

        condition: function( ) {
            return true;
        }
    };

    for( const column of dataProvider.cols ) {
        column.cellRenderers.unshift( _actionDeepCopyRenderer );
    }

    let parentNode = treeLoadInput.parentNode;
    let vmNodes = [];
    const excludedVmNodes = [];
    const nextLevelChildVmNodes = {};
    const deepCopyData = {
        propertyValuesMap: {
            copyAction: [  type === 'SAVEAS' ? 'CopyAsObject' : 'ReviseObject' ],
            propertyName: [ '' ],
            propertyType: [ 'Relation' ],
            isRequired: [ '1' ]
        },
        childDeepCopyData: xrtData.data.deepCopyDatas.dbValue
    };
    const mo = cdm.getObject( xrtData.data._selectedObject.uid );
    const vmo = vmoSvc.constructViewModelObjectFromModelObject( mo );
    const vmNode = exports.convertDeepCopyDataToVmTreeNode( deepCopyData, parentNode, vmo, 0, i18n, type );

    if ( vmNode ) {
        if( vmNode.exclude  ) {
            excludedVmNodes.push( vmNode );
        } else {
            vmNodes.push( vmNode );
        }
    }

    const rootNode = vmNodes[0];
    updateParentNode( vmNodes[0], true );

    let namingRuleTypesToLoad = [];
    let namingRules = {};

    const deepCopyDatas = await getChildDeepCopyData( vmNodes[0], type );
    if( deepCopyDatas && deepCopyDatas.length > 0 ) {
        namingRuleTypesToLoad = deepCopyDatas.map( deepCopyData => getNonRevisionType( deepCopyData.attachedObject.type ) );
        namingRules = await exports.getNamingRulesForTypes( namingRuleTypesToLoad, type );
        for( const idx in deepCopyDatas ) {
            const deepCopyData = deepCopyDatas[ idx ];
            const attachedObj = cdm.getObject( deepCopyData.attachedObject.uid );
            const vmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
            const vmNode = exports.convertDeepCopyDataToVmTreeNode( deepCopyData, vmNodes[0], vmo, idx, i18n, type, namingRules );
            if( deepCopyData.childDeepCopyData.length > 0 && ( !vmNode.children || vmNode.children.length === 0 ) ) {
                const unexpandedChildVmNodes = [];
                for( const idx in deepCopyData.childDeepCopyData ) {
                    const childDeepCopyData = deepCopyData.childDeepCopyData[ idx ];
                    const attachedObj = cdm.getObject( childDeepCopyData.attachedObject.uid );
                    const childVmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
                    const childVmNode = exports.convertDeepCopyDataToVmTreeNode( childDeepCopyData, vmNode, childVmo, idx, i18n, type, namingRules );
                    if( childDeepCopyData.childDeepCopyData && !childVmNode.children ) {
                        getChildrenForUnexpandedChildVmNodes( childVmNode, childDeepCopyData.childDeepCopyData, i18n, type, namingRules );
                    }
                    unexpandedChildVmNodes.push( childVmNode );
                }
                nextLevelChildVmNodes[ `${vmNode.uid}` ] = unexpandedChildVmNodes;
            }
            if ( vmNode ) {
                if( vmNode.exclude || vmNode.uid === rootNode.uid ) {
                    excludedVmNodes.push( vmNode );
                } else {
                    vmNodes.push( vmNode );
                }
            }
        }
    }

    // top naming rule
    const topNamingRuleType = getNonRevisionType( vmNodes[0].type );
    if ( namingRuleTypesToLoad.includes( topNamingRuleType ) ) {
        if( vmNodes[0].props.item_id ) {
            const typePropNamingRules = namingRules?.[ `${getNonRevisionType( topNamingRuleType )}` ]?.item_id;
            let idNamingRulesProperty = uwPropertySvc.createViewModelProperty(
                'item_id_naming_rules', 'item_id_naming_rules', 'STRING', typePropNamingRules ? typePropNamingRules.patternStrings : [], typePropNamingRules ? typePropNamingRules.patternStrings : [] );
            vmNodes[0].props.item_id_naming_rules = idNamingRulesProperty;

            //ID Naming rule
            let defaultNamingRule = 'none';
            if( typePropNamingRules ) {
                defaultNamingRule = typePropNamingRules.preferredPattern !== '' ? typePropNamingRules.preferredPattern : typePropNamingRules.patternStrings[ 0 ];
            }
            let idNamingRuleProperty = uwPropertySvc.createViewModelProperty(
                'item_id_naming_rule', 'item_id_naming_rule', 'STRING', defaultNamingRule, [ defaultNamingRule  ] );
            uwPropertySvc.setIsPropertyModifiable( idNamingRuleProperty, true );
            idNamingRuleProperty.editableInViewModel = true;
            idNamingRuleProperty.dataProvider = 'namingRuleDataProvider';
            idNamingRuleProperty.hasLov = true;
            vmNodes[0].props.item_id_naming_rule = idNamingRuleProperty;
        }

        if( vmNodes[0].props.item_revision_id && type === 'REVISE' ) {
            //ID Naming rules read by LOV
            const typePropNamingRules = namingRules?.[ `${getNonRevisionType( topNamingRuleType )}` ]?.item_revision_id;
            let itemRevIdNamingRulesProperty = uwPropertySvc.createViewModelProperty(
                'item_revision_id_naming_rules', 'item_revision_id_naming_rules', 'STRINGARRAY', typePropNamingRules ? typePropNamingRules.patternStrings : [], typePropNamingRules ? typePropNamingRules.patternStrings : [] );
            vmNodes[0].props.item_revision_id_naming_rules = itemRevIdNamingRulesProperty;

            //ID Naming rule
            let itemRevIdNamingRuleProperty = uwPropertySvc.createViewModelProperty(
                'item_revision_id_naming_rule', 'item_revision_id_naming_rule', 'STRING', typePropNamingRules ? typePropNamingRules.preferredPattern : 'none', [ typePropNamingRules ? typePropNamingRules.preferredPattern : 'none'  ] );
            uwPropertySvc.setIsPropertyModifiable( itemRevIdNamingRuleProperty, true );
            itemRevIdNamingRuleProperty.editableInViewModel = true;
            itemRevIdNamingRuleProperty.dataProvider = 'namingRuleDataProvider';
            itemRevIdNamingRuleProperty.hasLov = true;
            vmNodes[0].props.item_revision_id_naming_rule = itemRevIdNamingRuleProperty;
        }
    }


    let newXrtState = { ...xrtState.getValue() };
    const excludedDeepCopies = {};
    excludedDeepCopies[ `${parentNode.uid}` ] = excludedVmNodes;
    newXrtState.excludedDeepCopies = { ...newXrtState.excludedDeepCopies, ...excludedDeepCopies };
    newXrtState.nextLevelChildVmNodes = { ...newXrtState.nextLevelChildVmNodes, ...nextLevelChildVmNodes };
    newXrtState.rootNode = rootNode;

    xrtState.update( newXrtState );

    // Add data provider reference to xrtState
    if( vmNodes.length > 0 ) {
        const dpRef = xrtState.getValue().dpRef;
        if( !dpRef ) {
            return;
        }

        const columnProvider = type === 'SAVEAS' ? columnProviders.copyOptionsSaveAsColumnProvider : columnProviders.copyOptionsReviseColumnProvider;

        initDataProviderRef( dpRef );
        dpRef.current.dataProviders.push( dataProvider.viewModelCollection.getLoadedViewModelObjects );

        dpRef.current.columnProviders[ dataProvider.name ] = {
            getColumnFilters: columnProvider.getColumnFilters,
            getSortCriteria: columnProvider.getSortCriteria,
            getColumns: columnProvider.getColumns
        };
    }

    const treeLoadResult = treeDPReqRespHelper.buildTreeLoadResult( treeLoadInput, vmNodes, _isSimplePage, _startReached, _endReached, _newTopNode );

    return {
        treeLoadResult: treeLoadResult,
        totalFound: vmNodes.length,
        namingRules: Object.keys( namingRules ).length >= 1
    };
};

/**
 * Load tree table view model nodes
 *
 * @param {Object} treeLoadInput - tree load input
 * @param {Object} i18n - viewmodel i18n
 * @param {Object} xrtState - Xrt state atomic data
 * @param {String} type - XRT type (Saveas or Revise)
 * @returns {Object} - data provider data
 */
export const loadTreeTableData = async( treeLoadInput, i18n, xrtState, type ) => {
    const parentNode = treeLoadInput.parentNode;
    let vmNodes = [];
    const excludedVmNodes = [];
    const nextLevelChildVmNodes = {};
    const deepCopyDatas = await getChildDeepCopyData( parentNode, type );
    let namingRules = {};
    if( deepCopyDatas && deepCopyDatas.length > 0 ) {
        const namingRuleTypesToLoad = deepCopyDatas.map( deepCopyData => getNonRevisionType( deepCopyData.attachedObject.type ) );
        namingRules = await exports.getNamingRulesForTypes( namingRuleTypesToLoad, type );
        for( const idx in deepCopyDatas ) {
            const deepCopyData = deepCopyDatas[ idx ];
            const attachedObj = cdm.getObject( deepCopyData.attachedObject.uid );
            const vmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
            const vmNode = exports.convertDeepCopyDataToVmTreeNode( deepCopyData, parentNode, vmo, idx, i18n, type, namingRules );
            if( deepCopyData.childDeepCopyData.length > 0 && ( !vmNode.children || vmNode.children.length === 0 ) ) {
                const unexpandedChildVmNodes = [];
                for( const idx in deepCopyData.childDeepCopyData ) {
                    const childDeepCopyData = deepCopyData.childDeepCopyData[ idx ];
                    const attachedObj = cdm.getObject( childDeepCopyData.attachedObject.uid );
                    const childVmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
                    const childVmNode = exports.convertDeepCopyDataToVmTreeNode( childDeepCopyData, vmNode, childVmo, idx, i18n, type, namingRules );
                    if( childDeepCopyData.childDeepCopyData && !childVmNode.children ) {
                        getChildrenForUnexpandedChildVmNodes( childVmNode, childDeepCopyData.childDeepCopyData, i18n, type, namingRules );
                    }
                    unexpandedChildVmNodes.push( childVmNode );
                }
                nextLevelChildVmNodes[ `${vmNode.uid}` ] = unexpandedChildVmNodes;
            }
            if ( vmNode ) {
                if( vmNode.exclude || vmNode.uid === xrtState.rootNode?.uid ) {
                    excludedVmNodes.push( vmNode );
                } else {
                    vmNodes.push( vmNode );
                }
            }
        }
        let newXrtState = { ...xrtState.getValue() };
        const excludedDeepCopies = {};
        excludedDeepCopies[ `${parentNode.uid}` ] = excludedVmNodes;
        newXrtState.excludedDeepCopies = { ...newXrtState.excludedDeepCopies, ...excludedDeepCopies };
        newXrtState.nextLevelChildVmNodes = { ...newXrtState.nextLevelChildVmNodes, ...nextLevelChildVmNodes };

        xrtState.update( newXrtState );
    }

    const treeLoadResult = treeDPReqRespHelper.buildTreeLoadResult( treeLoadInput, vmNodes, _isSimplePage, _startReached, _endReached, _newTopNode );

    return {
        treeLoadResult: treeLoadResult,
        totalFound: vmNodes.length,
        namingRules: Object.keys( namingRules ).length >= 1
    };
};

/**
* @param {ViewModelTreeNode} vmNode - the tree node object for which unique id needs to be evaluated
* @param {ViewModelTreeNode} parentNode - the parent node of vmNode for evaluating unique id
* @param {Integer} idx - a unique index
* @return {String} uidString - returns comma separated uid for every node . uids are made of hierarchy for each node
*/
const getUniqueIdForEachNode = function( vmNode, parentNode, idx ) {
    if( parentNode ) {
        if( idx ) {
            return parentNode.alternateID ? vmNode.uid + ',' + parentNode.alternateID + ',' + idx : vmNode.uid + ',' + parentNode.uid + ',' + idx;
        }
        return parentNode.alternateID ? vmNode.uid + ',' + parentNode.alternateID : vmNode.uid + ',' + parentNode.uid;
    }
    return vmNode.uid;
};

/**
 * Convert Deep Copy Data vmo to ViewModelTreeNode
 *
 * @param {Object} deepCopyData - deepCopyData for current vmo
 * @param {Object} parentNode - parentNode object from treeLoadInput
 * @param {Object} vmo - current vmo to base the vmTreeNode off of
 * @param {Integer} idx - Index of deep copy in tree
 * @param {Object} i18n - viewmodel i18n
 * @param {String} type - XRT type (Saveas or Revise)
 * @param {Object} namingRules - Naming rules for item id objects
 * @returns {ViewModelTreeNode} - ViewModelTreeNode based on deep copy data vmo
 */
const convertDeepCopyDataToVmTreeNode = ( deepCopyData, parentNode, vmo, idx, i18n, type, namingRules ) => {
    if( deepCopyData && vmo ) {
        const isEditable = deepCopyData.propertyValuesMap.isRequired[ 0 ] === '0';

        let vmNode = treeDPReqRespHelper.createViewModelTreeNode( vmo.uid, vmo.type, vmo?.props?.object_name?.uiValues[ 0 ], parentNode.levelNdx + 1, 0, vmo.typeIconURL );
        const copyAction = deepCopyData.propertyValuesMap.copyAction;
        let actionProperty = uwPropertySvc.createViewModelProperty(
            'action', 'action', 'STRING', copyAction[ 0 ], getActionDisplayValues( copyAction[ 0 ], i18n ) );
        uwPropertySvc.setIsPropertyModifiable( actionProperty, isEditable );
        actionProperty.editableInViewModel = isEditable;
        actionProperty.dataProvider = 'copyOptionsLOVProvider';
        actionProperty.hasLov = true;

        actionProperty.dbValues = [ 'action' ];
        vmo.props.action = actionProperty;


        const relationId = deepCopyData.propertyValuesMap.propertyName[ 0 ];
        const modelType = cmm.getType( parentNode.type );
        let realtionDisplayName;
        if ( relationId ) {
            if ( modelType && modelType.propertyDescriptorsMap[ relationId ] ) {
                realtionDisplayName = modelType.propertyDescriptorsMap[ relationId ].displayName;
            } else {
                realtionDisplayName = relationId;
            }
        }

        let relationProperty = uwPropertySvc.createViewModelProperty(
            'relation', 'relation', 'STRING', relationId, [ realtionDisplayName ] );
        uwPropertySvc.setIsPropertyModifiable( relationProperty, false );
        vmo.props.relation = relationProperty;
        let sourceProperty = uwPropertySvc.createViewModelProperty( 'object_source', 'object_source', 'STRING', vmo?.props?.object_name?.dbValue, vmo?.props?.object_name?.uiValues );
        uwPropertySvc.setIsPropertyModifiable( sourceProperty, false );
        vmo.props.object_source = sourceProperty;

        let deepCopyChildrenProperty = uwPropertySvc.createViewModelProperty( 'deep_copy', 'deep_copy', 'BOOLEAN', deepCopyData.childDeepCopyData.length !== 0, [ deepCopyData.childDeepCopyData.length !== 0 ] );
        uwPropertySvc.setIsPropertyModifiable( deepCopyChildrenProperty, false );
        vmo.props.deep_copy = deepCopyChildrenProperty;

        let deepCopyIsRequiredProperty = uwPropertySvc.createViewModelProperty( 'deep_copy_is_required', 'deep_copy_is_required', 'BOOLEAN', isEditable, [ isEditable ] );
        uwPropertySvc.setIsPropertyModifiable( deepCopyIsRequiredProperty, false );
        vmo.props.deep_copy_is_required = deepCopyIsRequiredProperty;

        if( deepCopyData.operationInputTypeName ) {
            let deepCopyoperationInputTypeNameProperty = uwPropertySvc.createViewModelProperty( 'deep_copy_operation_input_type_name', 'deep_copy_operation_input_type_name', 'STRING', deepCopyData.operationInputTypeName, [ deepCopyData.operationInputTypeName ] );
            uwPropertySvc.setIsPropertyModifiable( deepCopyoperationInputTypeNameProperty, false );
            vmo.props.deep_copy_operation_input_type_name = deepCopyoperationInputTypeNameProperty;
        }

        if( deepCopyData.propertyValuesMap.copy_relations ) {
            const copyRelations = deepCopyData.propertyValuesMap.copy_relations[ 0 ] === '1';
            let deepCopyCopyRelationsProperty = uwPropertySvc.createViewModelProperty( 'deep_copy_copy_relations', 'deep_copy_copy_relations', 'BOOLEAN', copyRelations, [ copyRelations ] );
            uwPropertySvc.setIsPropertyModifiable( deepCopyCopyRelationsProperty, false );
            vmo.props.deep_copy_copy_relations = deepCopyCopyRelationsProperty;
        }

        if( deepCopyData?.propertyValuesMap?.isTargetPrimary ) {
            const isTargetPrimary = deepCopyData.propertyValuesMap.isTargetPrimary[ 0 ] === '1';
            let deepCopyIsTargetPrimaryProperty = uwPropertySvc.createViewModelProperty( 'deep_copy_is_target_primary', 'deep_copy_is_target_primary', 'BOOLEAN', isTargetPrimary, [ isTargetPrimary ] );
            uwPropertySvc.setIsPropertyModifiable( deepCopyIsTargetPrimaryProperty, false );
            vmo.props.deep_copy_is_target_primary = deepCopyIsTargetPrimaryProperty;
        }

        if( deepCopyData?.propertyValuesMap?.propertyType ) {
            const propertyType = deepCopyData.propertyValuesMap.propertyType[ 0 ];
            let deepCopyPropertyTypeProp = uwPropertySvc.createViewModelProperty( 'deep_copy_property_type', 'deep_copy_property_type', 'STRING', propertyType, [ propertyType ] );
            uwPropertySvc.setIsPropertyModifiable( deepCopyPropertyTypeProp, false );
            vmo.props.deep_copy_property_type = deepCopyPropertyTypeProp;
        }

        let xrtTypeProperty = uwPropertySvc.createViewModelProperty( 'xrt_type', 'xrt_type', 'STRING', type, [ type ] );
        uwPropertySvc.setIsPropertyModifiable( xrtTypeProperty, false );
        vmo.props.xrt_type = xrtTypeProperty;


        // need to reevaluate reference property
        const isReferenceProperty = deepCopyData?.propertyValuesMap?.propertyType[ 0 ] === 'Reference';

        if( vmo.props.object_name ) {
            uwPropertySvc.setIsPropertyModifiable( vmo.props.object_name, isEditable );
        }

        if( vmo.props.object_desc ) {
            uwPropertySvc.setIsPropertyModifiable( vmo.props.object_desc, isEditable );
        }
        if( vmo.props.item_id ) {
            uwPropertySvc.setIsPropertyModifiable( vmo.props.item_id, isEditable );

            const typePropNamingRules = namingRules?.[ `${getNonRevisionType( vmo.type )}` ]?.item_id;
            let idNamingRulesProperty = uwPropertySvc.createViewModelProperty(
                'item_id_naming_rules', 'item_id_naming_rules', 'STRING', typePropNamingRules ? typePropNamingRules.patternStrings : [], typePropNamingRules ? typePropNamingRules.patternStrings : [] );
            vmo.props.item_id_naming_rules = idNamingRulesProperty;

            //ID Naming rule
            let defaultNamingRule = 'none';
            if( typePropNamingRules ) {
                defaultNamingRule = typePropNamingRules.preferredPattern !== '' ? typePropNamingRules.preferredPattern : typePropNamingRules.patternStrings[ 0 ];
            }
            let idNamingRuleProperty = uwPropertySvc.createViewModelProperty(
                'item_id_naming_rule', 'item_id_naming_rule', 'STRING', defaultNamingRule, [ defaultNamingRule  ] );
            uwPropertySvc.setIsPropertyModifiable( idNamingRuleProperty, true );
            idNamingRuleProperty.editableInViewModel = true;
            idNamingRuleProperty.dataProvider = 'namingRuleDataProvider';
            idNamingRuleProperty.hasLov = true;
            vmo.props.item_id_naming_rule = idNamingRuleProperty;
            vmo.props.item_id.pendingString = i18n.pendingString;
        }

        if( vmo.props.item_revision_id && type === 'REVISE' ) {
            uwPropertySvc.setIsPropertyModifiable( vmo.props.item_revision_id, isEditable );

            //ID Naming rules read by LOV
            const typePropNamingRules = namingRules?.[ `${getNonRevisionType( vmo.type )}` ]?.item_revision_id;
            let itemRevIdNamingRulesProperty = uwPropertySvc.createViewModelProperty(
                'item_revision_id_naming_rules', 'item_revision_id_naming_rules', 'STRINGARRAY', typePropNamingRules ? typePropNamingRules.patternStrings : [], typePropNamingRules ? typePropNamingRules.patternStrings : [] );
            vmo.props.item_revision_id_naming_rules = itemRevIdNamingRulesProperty;

            //ID Naming rule
            let itemRevIdNamingRuleProperty = uwPropertySvc.createViewModelProperty(
                'item_revision_id_naming_rule', 'item_revision_id_naming_rule', 'STRING', typePropNamingRules ? typePropNamingRules.preferredPattern : 'none', [ typePropNamingRules ? typePropNamingRules.preferredPattern : 'none'  ] );
            uwPropertySvc.setIsPropertyModifiable( itemRevIdNamingRuleProperty, true );
            itemRevIdNamingRuleProperty.editableInViewModel = true;
            itemRevIdNamingRuleProperty.dataProvider = 'namingRuleDataProvider';
            itemRevIdNamingRuleProperty.hasLov = true;
            vmo.props.item_revision_id_naming_rule = itemRevIdNamingRuleProperty;
        }

        vmNode.props = { ...vmo.props };
        vmNode.uid = vmo.uid;

        vmNode.isLeaf = !( ( copyAction[ 0 ] === 'CopyAsObject' || copyAction[ 0 ] === 'ReviseObject' ) && deepCopyData.childDeepCopyData.length > 0 && !isReferenceProperty );

        vmNode.alternateID = getUniqueIdForEachNode( vmNode, parentNode, idx );
        vmNode.exclude = relationId.includes( 'IMAN_master_form_rev' ) || relationId.includes( 'items_tag' ) || relationId.includes( 'IMAN_based_on' );
        return vmNode;
    }
    return null;
};

/**
 * Get the 'child' deep copy data
 *
 * @param {Object} parentNode - parentNode object from treeLoadInput
 * @param {String} type - operation type (SAVEAS or REVISE)
 *
 * @returns {Array} - array of deepCopyData
 */
const getChildDeepCopyData = async( parentNode, type ) => {
    const deepCopyDataInput =  {
        deepCopyDataInput: {
            operation: type === 'SAVEAS' ? 'SaveAs' : 'Revise',
            targetObject: parentNode,
            deepCopyDatas: [],
            selectedBO: parentNode
        }
    };
    let response = await soaService.post( 'Core-2015-07-DataManagement', 'getDeepCopyData', deepCopyDataInput );
    return response.deepCopyDatas;
};


/**
 * Get naming rules for specific types
 *
 * @param {Array<String>} typesToLoad - Array of applicable types to load naming rules for
 * @param {String} xrtType - operation type (SAVEAS or REVISE)
 * @returns {Object} - type to naming rule(s) map
 */
export const getNamingRulesForTypes = async( typesToLoad, xrtType ) => {
    const typeMap = [];
    for( const type of typesToLoad ) {
        typeMap.push( {
            typeName: type,
            propName: 'item_id'
        } );
        if( xrtType === 'REVISE' ) {
            typeMap.push( {
                typeName: type,
                propName: 'item_revision_id'
            } );
        }
    }
    const input = {
        attachInfos: typeMap
    };
    const response = await soaService.post( 'Core-2023-12-DataManagement', 'getNRPatterns', input );
    const typeRules = {};
    for( const idx in typeMap ) {
        if( response.patterns && response.patterns[ idx ].patternStrings ) {
            if( !typeRules.hasOwnProperty( typeMap[ idx ].typeName ) ) {
                typeRules[ `${typeMap[ idx ].typeName}` ] = {};
            }
            typeRules[ `${typeMap[ idx ].typeName}` ][ `${typeMap[ idx ].propName}` ] = {
                patternStrings: response.patterns[ idx ].patternStrings,
                preferredPattern: response.preferredPattern[ idx ]
            };
        }
    }
    return typeRules;
};

/**
 * Map copy action type to i18n
 *
 * @param {String} copyAction - Copy action from deepcopy data
 * @param {Object} i18n - viewmodel i18n
 * @returns {String} - localized copy action string
 */
const getActionDisplayValues = ( copyAction, i18n ) => {
    if( copyAction === 'CopyAsObject' ) {
        return [ i18n.saveas ];
    } else if( copyAction === 'NoCopy' || copyAction === 'NoCopyOrRelateToLatest' ) {
        return [ i18n.noCopy ];
    } else if( copyAction === 'CopyAsReference' ) {
        return [ i18n.copyAsReference ];
    } else if( copyAction === 'ReviseObject' || copyAction === 'ReviseAndRelateToLatest' ) {
        return [ i18n.revise ];
    } else if( copyAction === 'RelateToLatestRevision' ) {
        return [ i18n.relateToLatestRevision ];
    }
};

/**
 * Update parentNode structure to support expand/collapse
 *
 * @param {ViewModelTreeNode} parentNode - parent node of which to perform operation
 * @param {Boolean} isExpand - is the node being expanded? (false - collapse)
 */
const updateParentNode = ( parentNode, isExpand ) => {
    if ( parentNode ) {
        parentNode.expanded = isExpand;
        parentNode.isExpanded = isExpand;
        parentNode.isLeaf = !isExpand;
        if( isExpand ) {
            if ( !parentNode.children ) {
                parentNode.children = [];
            }
        } else if ( parentNode.children ) {
            delete parentNode.children;
        }
    }
};

/**
 * Expand or collapse deep copy children based on lovValue
 *
 * @param {Object} dataProvider - data provider
 * @param {String} lovValue - value of changed lovValue
 * @param {Object} xrtState - Xrt state atomic data
 * @param {String} type - operation type (SAVEAS or REVISE)
 * @param {Object} i18n - viewmodel i18n
 */
export const expandCollapseDeepCopyChildren = async( dataProvider, lovValue, xrtState, type, i18n ) => {
    // need to expand on revise and update SOA accordingly
    if( lovValue?.propInternalValue === 'CopyAsObject' ) {
        await expandNextLevelDeepCopy( dataProvider, xrtState, type, 'SAVEAS', i18n );
    } else if( lovValue?.propInternalValue === 'ReviseObject' )  {
        await expandNextLevelDeepCopy( dataProvider, xrtState, type, 'REVISE', i18n );
    } else {
        collapseNextLevelDeepCopy( dataProvider );
    }
};

/**
 * Handle expanding the next level of deep copy branch
 *
 * @param {Object} dataProvider - data provider
 * @param {Object} xrtState - Xrt state atomic data
 * @param {String} xrtType - operation type (SAVEAS or REVISE)
 * @param {String} actionType - action type (SAVEAS or REVISE)
 * @param {Object} i18n - viewmodel i18n
 */
const expandNextLevelDeepCopy = async( dataProvider, xrtState, xrtType, actionType, i18n ) => {
    const loadedVMOs = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    const selectedParentNode = dataProvider.getSelectedObjects();
    const vmoId = dataProvider.viewModelCollection.findViewModelObjectById( selectedParentNode[ 0 ].alternateID );
    const parentNode = loadedVMOs[ vmoId ];

    const parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
        return vmo.alternateID === parentNode.alternateID;
    } );

    // Need to check copy action
    const deepCopyDatas = await getChildDeepCopyData( parentNode, actionType );
    if( deepCopyDatas.length > 0 && parentNode.isLeaf ) {
        updateParentNode( parentNode, true );
        const namingRuleTypesToLoad = deepCopyDatas.map( deepCopyData => getNonRevisionType( deepCopyData.attachedObject.type ) );
        const namingRules = await exports.getNamingRulesForTypes( namingRuleTypesToLoad, xrtType );
        const excludedVmNodes = [];
        for( const idx in deepCopyDatas ) {
            const deepCopyData =  deepCopyDatas[ idx ];
            const attachedObj = cdm.getObject( deepCopyData.attachedObject.uid );
            const vmo = vmoSvc.constructViewModelObjectFromModelObject( attachedObj );
            const vmNode = exports.convertDeepCopyDataToVmTreeNode( deepCopyData, parentNode, vmo, idx, i18n, xrtType, namingRules );
            if( vmNode ) {
                if( vmNode.exclude || vmNode.uid === xrtState.rootNode?.uid ) {
                    excludedVmNodes.push( vmNode );
                } else {
                    parentNode.children.push( vmNode );
                    parentNode.totalChildCount++;
                    loadedVMOs.splice( parentIdx + 1, 0, vmNode );
                }
            }
        }
        let newXrtState = { ...xrtState.getValue() };
        const excludedDeepCopies = {};
        excludedDeepCopies[ `${parentNode.uid}` ] = excludedVmNodes;
        newXrtState.excludedDeepCopies = { ...newXrtState.excludedDeepCopies, ...excludedDeepCopies };

        xrtState.update( newXrtState );
    }

    dataProvider.update( loadedVMOs );
};

/**
 * Handle collapsing current deep copy data branch
 *
 * @param {Object} dataProvider - data provider
 */
const collapseNextLevelDeepCopy = async( dataProvider ) => {
    const loadedVMOs = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    const selectedParentNode = dataProvider.getSelectedObjects();

    const vmoId = dataProvider.viewModelCollection.findViewModelObjectById( selectedParentNode[ 0 ].alternateID );
    const parentNode = loadedVMOs[ vmoId ];

    recursivelyCollapse( parentNode, loadedVMOs, true );

    dataProvider.update( loadedVMOs );
};

/**
 * Recursively collapse child deep copy nodes until none in current branch are left
 *
 * @param {ViewModelTreeNode} parentNode - current node of which to perform operation
 * @param {Array<Object>} loadedVMOs - loaded viewmodel objects from viewmodelcollection
 * @param {boolean} isTop - determines if node is top of stack
 */
const recursivelyCollapse = ( parentNode, loadedVMOs, isTop ) => {
    const parentIdx = _.findLastIndex( loadedVMOs, function( vmo ) {
        return vmo.alternateID === parentNode.alternateID;
    } );
    if( parentNode.children && parentNode.children.length > 0 &&  !parentNode.isLeaf ) {
        for( const child of parentNode.children ) {
            recursivelyCollapse( child, loadedVMOs, false );
        }
        loadedVMOs.splice( parentIdx + 1, parentNode.children.length );
        updateParentNode( parentNode, false );
    }
    if( !parentNode.children && isTop ) {
        updateParentNode( parentNode, false );
    }
};

/**
 * Start edit for copy options tree table
 *
 * @param {Object} dataProvider - data provider
 * @returns {Array<Object>} - startEditResponse for editable props
 */
export const copyOptionsStartEdit = ( dataProvider ) => {
    // Table is expecting this map based on the dataprovider start edit action
    const startEditResponse = [];
    const vmos = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    const treeTableColumnProps = exports.getTreeTableColumnProps( dataProvider );

    for( const vmo of vmos ) {
        const editableVmo = {
            uid: vmo.uid,
            type: vmo.type,
            props: {}
        };

        const isRequired = vmo.props?.deep_copy_is_required?.dbValue;
        const canEdit = vmo.props?.action?.dbValue === 'CopyAsObject' || vmo.props?.action?.dbValue === 'ReviseObject';

        for( const tableProp of treeTableColumnProps ) {
            if( isRequired ) {
                if( canEdit && ( tableProp === 'object_name' || tableProp === 'object_desc' || tableProp === 'item_id' ||  tableProp === 'item_id_naming_rule' && vmo.props?.item_id_naming_rules?.dbValue.length > 1 || tableProp === 'item_revision_id' ||  tableProp === 'item_revision_id_naming_rule' && vmo.props?.item_revision_id_naming_rules?.dbValue.length > 1  )  ) {
                    editableVmo.props[ `${tableProp}` ] = {
                        propertyName: tableProp,
                        isPropertyModifiable: true
                    };
                } else {
                    editableVmo.props[ `${tableProp}` ] = {
                        propertyName: tableProp,
                        isPropertyModifiable: `${tableProp}` === 'action'
                    };
                }
            } else {
                editableVmo.props[ `${tableProp}` ] = {
                    propertyName: `${tableProp}`,
                    isPropertyModifiable: false
                };
            }
        }
        startEditResponse.push( editableVmo );
    }

    return startEditResponse;
};

/**
 * Get the tree table's column properties
 *
 * @param {Object} dataProvider - decl data provider
 * @returns {Array<String>} column properties
 */
export const getTreeTableColumnProps = ( dataProvider ) => {
    const colProps = [];
    for( const col of dataProvider.cols ) {
        colProps.push( col.name );
    }
    return colProps;
};

/**
 * Save edit for copy options tree table
 */
export const saveEdits = () => {
    //
};

export const syncXRTVMO = ( dataProvider, xrtState ) => {
    if( dataProvider.topTreeNode ) {
        const loadedVMOs = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        const vmoId = dataProvider.viewModelCollection.findViewModelObjectById( dataProvider.topTreeNode.uid );
        const treeNode = loadedVMOs[ vmoId ];
        if( treeNode ) {
            const xrtVMO = xrtState.getValue().xrtVMO;
            treeNode.props.object_name = { ...xrtVMO.props.object_name };
            treeNode.props.object_desc = { ...xrtVMO.props.object_desc };
            dataProvider.update( loadedVMOs );
        }
    }
};

/**
 * Replace item revision with item. Note, there is no good way to find item type from item revision
 * type without looping through all item subtypes and check the Revision type constant of each item type,
 * so follow RAC to do string comparison.
 *
 * @param {String} type Name of the type that may be Revision
 * @returns {String} Name of actual type
 */
const getNonRevisionType = type => {
    if( _.endsWith( type, 'Revision' ) ) {
        const idx = type.indexOf( 'Revision' );
        //trim required to handle "Item Revision" and "ItemRevision"
        return type.substring( 0, idx ).trim();
    }
    return type;
};

/**
 * Set property policy to return needeed IDs
 *
 * @param {String} type - operation type (SAVEAS or REVISE)
 * @returns {String} policy id
 */
export const setPropertyPolicy = ( type ) => {
    if( type === 'REVISE' ) {
        return propPolicySvc.register( {
            types: [ {
                name: 'WorkspaceObject',
                properties: [ {
                    name: 'item_id'
                },
                {
                    name: 'item_revision_id'
                }
                ]
            } ]
        } );
    }
    return propPolicySvc.register( {
        types: [ {
            name: 'WorkspaceObject',
            properties: [ {
                name: 'item_id'
            }
            ]
        } ]
    } );
};

/**
 * Unset property policy given the policy ID
 *
 * @param {String} policyId - Specific property policy ID
 */
export const unSetPropertyPolicy = ( policyId ) => {
    propPolicySvc.unregister( policyId );
};

/**
 * Assign the IDs for deep copy table
 * @param {Object} dataProvider - data provider
 */
export const assignIdsForDeepCopy = async function( dataProvider ) {
    const loadedVMOs = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    const inputData = {
        generateNextValuesIn: []
    };
    _.forEach( loadedVMOs, function( vmObject ) {
        const selectedPatternItemId = vmObject?.props?.item_id_naming_rule?.dbValue;
        const selectedPatternItemRevId = vmObject?.props?.item_revision_id_naming_rule?.dbValue;
        if( vmObject?.props?.action?.dbValue === 'CopyAsObject' || vmObject?.props?.action?.dbValue === 'ReviseObject' ) {
            if( selectedPatternItemId && selectedPatternItemId !== 'none' ) {
                let input = {
                    clientId: `${vmObject.uid}_item_id`,
                    businessObjectName: getNonRevisionType( vmObject.type ),
                    operationType: 3,
                    propertyNameWithSelectedPattern: {
                        item_id: selectedPatternItemId
                    },
                    additionalInputParams: {
                        sourceObject: vmObject.uid
                    }
                };
                inputData.generateNextValuesIn.push( input );
            }
            if( selectedPatternItemRevId && selectedPatternItemRevId !== 'none' ) {
                let input = {
                    clientId: `${vmObject.uid}_item_revision_id`,
                    businessObjectName: vmObject.type,
                    operationType: 2,
                    propertyNameWithSelectedPattern: {
                        item_revision_id: selectedPatternItemRevId
                    },
                    additionalInputParams: {
                        sourceObject: vmObject.uid
                    }
                };
                inputData.generateNextValuesIn.push( input );
            }
        }
    } );

    if( inputData.generateNextValuesIn.length > 0  ) {
        const response = await soaService.post( 'Core-2013-05-DataManagement', 'generateNextValues', inputData );
        if( response.generatedValues && response.generatedValues.length > 0 ) {
            const namingRuleMap = response.generatedValues.reduce( ( acc, curr ) => {
                acc[ curr.clientId ] = curr;
                return acc;
            }, {} );
            _.forEach( loadedVMOs, function( vmObject ) {
                if( vmObject.uid ) {
                    if( namingRuleMap[ `${vmObject.uid}_item_id` ]  ) {
                        let updatedItemId = namingRuleMap[ `${vmObject.uid}_item_id` ].generatedValues.item_id;
                        if( updatedItemId ) {
                            uwPropertySvc.setValue( vmObject.props.item_id, [ updatedItemId.nextValue ] );
                            uwPropertySvc.setDisplayValue( vmObject.props.item_id, [ updatedItemId.nextValue ] );
                            uwPropertySvc.updateViewModelProperty( vmObject.props.item_id );
                        }
                    }

                    if( namingRuleMap[ `${vmObject.uid}_item_revision_id` ]  ) {
                        let updatedItemRevId = namingRuleMap[ `${vmObject.uid}_item_revision_id` ].generatedValues.item_revision_id;
                        if( updatedItemRevId ) {
                            uwPropertySvc.setValue( vmObject.props.item_revision_id, [ updatedItemRevId.nextValue ] );
                            uwPropertySvc.setDisplayValue( vmObject.props.item_revision_id, [ updatedItemRevId.nextValue ] );
                            uwPropertySvc.updateViewModelProperty( vmObject.props.item_revision_id );
                        }
                    }
                }
            } );
            dataProvider.update( loadedVMOs );
        }
    }
};

const compareAndUpdateOldValueAndNewValue = function( vmo, actionValue ) {
    for( let propertyName in vmo.props ) {
        let isInlineEditingSuppForProperty = inlineEditingSupportedProperties.indexOf( propertyName ) > -1;
        if( isInlineEditingSuppForProperty ) {
            let vmoProp = vmo.props[ propertyName ];
            if( !_.isUndefined( vmoProp.newValue ) && !_.isEqual( vmoProp.newValue, vmoProp.prevDisplayValues[0] ) && actionValue === 'CopyAsObject' ) {
                uwPropertySvc.setOldValues( vmoProp, vmoProp.prevDisplayValues );
                vmoProp.uiValue = vmoProp.newValue;
            } else if( vmoProp.oldValue && ( _.isEqual( vmoProp.newValue, vmoProp.oldValue ) || actionValue !== 'CopyAsObject' ) ) {
                let oldValue = vmoProp.oldValue;
                vmoProp.oldValue = undefined;
                vmoProp.uiValue = oldValue;
                vmoProp.displayValues[0] = oldValue;
                vmoProp.prevDisplayValues[0] = oldValue;
                vmoProp.newValue = oldValue;
                vmoProp.dbValue = oldValue;
            }
            if( propertyName === 'item_id' && !vmoProp.oldValue && actionValue === 'CopyAsObject' ) {
                uwPropertySvc.setOldValues( vmoProp, vmoProp.prevDisplayValues );
                vmoProp.newValue = vmoProp.pendingString;
                vmoProp.uiValue = vmoProp.pendingString;
            }
        }
    }
};

exports = {
    initCopyOptions,
    loadTreeTableData,
    convertDeepCopyDataToVmTreeNode,
    copyOptionsStartEdit,
    getTreeTableColumnProps,
    saveEdits,
    expandCollapseDeepCopyChildren,
    syncXRTVMO,
    setPropertyPolicy,
    unSetPropertyPolicy,
    assignIdsForDeepCopy,
    getNamingRulesForTypes
};

export default exports;

