import AwTextBox from 'viewmodel/AwTextboxViewModel';
import AwToolbar from 'viewmodel/AwToolbarViewModel';
import AwScrollpanel from 'viewmodel/AwScrollpanelViewModel';
import AwTree from 'viewmodel/AwTreeViewModel';
import AwLink from 'viewmodel/AwLinkViewModel';
import AwSavedQueryAddClauseService from 'js/AwSavedQueryAddClauseService';
import uwPropertyService from 'js/uwPropertyService';
import _ from 'lodash';

export const awSavedQueryRelationsClauseRenderFunction = ( props ) => {
    let { viewModel, actions, fields } = props;
    let { data } = viewModel;
    let { tree, filteredTree, displayMode, typeOrAllProperties, searchBox } = data;

    let treeToDisplay = ( searchBox.dbValue || typeOrAllProperties === 'typeProperties' ) ? filteredTree : tree;

    let expandAction = async function( node ) {
        AwSavedQueryAddClauseService.expandAction2( node, viewModel );
    };

    let getLinkForNode = function( node ) {
        let linkDisplayName = '[' + node.textForType + ']';
        let linkProps = {
            fielddata: uwPropertyService.createViewModelProperty( 'TypeSelector', 'TypeSelector', 'STRING', linkDisplayName, [ linkDisplayName ] )
        };

        return <AwLink className='aw-search-addClausePanelPropertyTypeSelectionLink' action={() => {
            actions.handleTreeSelection();
        }} {...linkProps}></AwLink>;
    };

    const filterTree = _.debounce( () => {
        actions.filterTreeWithSearchBox();
    }, 50 );

    return (
        <>
            <div className='sw-column'>
                <AwTextBox {...Object.assign( {}, fields.searchBox, { autoComplete:'off' } )} onSwChange={filterTree}></AwTextBox>
                <AwToolbar className='aw-search-savedQueryAddClausePanelToolbar' id='aw_addClausePanelToolBar' firstAnchor='aw_addClausePanelToolBar_left' secondAnchor='aw_addClausePanelToolBar_right' orientation='HORIZONTAL' context={{ parentViewModel: viewModel, ...props.subPanelContext }}></AwToolbar>
                <AwScrollpanel className='aw-addClause-scrollPanel'>
                    {
                        treeToDisplay && treeToDisplay.length > 0 && treeToDisplay[ 0 ].children && treeToDisplay[ 0 ].children.length > 0 &&
                        <AwTree expandAction={expandAction} name='propertyTree' tree={treeToDisplay} anchor='aw_addClausePanelNodeCommand'>
                            { ( { node } ) => {
                                if( displayMode && displayMode === 'displayName' ) {
                                    return <span className='sw-row aw-search-addClauseTreeNode' value={node.textForType ? node.displayName + ' [' + node.textForType + ']' : node.displayName}>
                                        <div>{node.displayName}</div>
                                        {node.textForType && ( !node.isReferencedProperty || node.isReferenceTypeSubTypeOfWorkspaceObject ) && getLinkForNode( node )}
                                        {node.textForType && ( node.isReferencedProperty && !node.isReferenceTypeSubTypeOfWorkspaceObject ) && <div>{'  [' + node.textForType + ']'}</div>}
                                        </span>;
                                }
                                else if( displayMode && displayMode === 'internalName' ) {
                                    return <span className='sw-row aw-search-addClauseTreeNode' value={node.textForType ? node.name + ' [' + node.textForType + ']' : node.name}>
                                        <div>{node.name}</div>
                                        {node.textForType && ( !node.isReferencedProperty || node.isReferenceTypeSubTypeOfWorkspaceObject ) && getLinkForNode( node )}
                                        {node.textForType && ( node.isReferencedProperty && !node.isReferenceTypeSubTypeOfWorkspaceObject ) && <div>{'  [' + node.textForType + ']'}</div>}
                                        </span>;
                                }
                            } }
                        </AwTree>
                    }
                </AwScrollpanel>
            </div>
        </>
    );
};
