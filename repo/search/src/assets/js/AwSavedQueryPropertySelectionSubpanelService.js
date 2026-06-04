import AwTextBox from 'viewmodel/AwTextboxViewModel';
import AwScrollpanel from 'viewmodel/AwScrollpanelViewModel';
import AwTree from 'viewmodel/AwTreeViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import { EnableWhen } from 'js/hocCollection';
import _ from 'lodash';

const AwButtonEnableWhen = EnableWhen( AwButton );

export const awSavedQueryPropertySelectionSubpanelRenderFunction = ( props ) => {
    let { viewModel, actions, fields } = props;
    let { data } = viewModel;
    let { tree, filteredTree, searchBox } = data;

    let treeToDisplay = searchBox.dbValue ? filteredTree : tree;

    const filterTree = _.debounce( () => {
        actions.filterTreeWithSearchBox();
    }, 50 );

    return (
        <>
            <AwTextBox {...Object.assign( {}, fields.searchBox, { autoComplete:'off' } )} onSwChange={filterTree}></AwTextBox>
            <AwScrollpanel className='aw-search-addClauseReferencedByScrollPanel'>
                {
                    treeToDisplay && treeToDisplay.length > 0 && treeToDisplay[ 0 ].children && treeToDisplay[ 0 ].children.length > 0 &&
                    <AwTree name='propertySelectionTree' tree={treeToDisplay}>
                        { ( { node } ) => {
                            let nodeReference = node.constants.find( property => property.name === 'ReferencedTypeName' );
                            return <span value={nodeReference ? node.displayName + '  [' + nodeReference.value + ']' : node.displayName}>
                                <div>{nodeReference ? node.displayName + '  [' + nodeReference.value + ']' : node.displayName}</div>
                                </span>;
                        } }
                    </AwTree>
                }
            </AwScrollpanel>
        </>
    );
};