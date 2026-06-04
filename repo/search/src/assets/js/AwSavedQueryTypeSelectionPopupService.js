import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import AwTextBox from 'viewmodel/AwTextboxViewModel';
import AwToolbar from 'viewmodel/AwToolbarViewModel';
import AwScrollpanel from 'viewmodel/AwScrollpanelViewModel';
import AwTree from 'viewmodel/AwTreeViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwSavedQueryPropertySelectionSubpanel from 'viewmodel/AwSavedQueryPropertySelectionSubpanelViewModel';
import { EnableWhen, VisibleWhen } from 'js/hocCollection';
import _ from 'lodash';

const AwButtonEnableWhen = EnableWhen( AwButton );
const AwPanelSectionVisibleWhen = VisibleWhen( AwPanelSection );

export const awSavedQueryTypeSelectionPopupRenderFunction = ( props ) => {
    let { viewModel, actions, fields } = props;
    let { data, i18n } = viewModel;
    let { tree, filteredTree, searchBox, selectedType, selectedProperty, isTypeSectionCollapsed, displayMode } = data;

    let treeToDisplay = searchBox.dbValue ? filteredTree : tree;
    let isReferencedBy = props.subPanelContext.isReferencedBy;

    const filterTree = _.debounce( () => {
        actions.filterTypesBySearchBox();
    }, 500 );

    let panelBodyClassName = isReferencedBy ? 'aw-search-addClauseReferencedByBody' : '';
    panelBodyClassName = panelBodyClassName + ( isTypeSectionCollapsed ? ' aw-search-addClauseReferencedByBodyCollapsedType' : '' );

    return (
        <>
            <AwPanelBody className={panelBodyClassName}>
                {
                    !isReferencedBy &&
                    <div className='sw-column'>
                        <AwTextBox {...Object.assign( {}, fields.searchBox, { autoComplete:'off' } )} onSwChange={filterTree}></AwTextBox>
                        <AwToolbar className='aw-search-savedQueryAddClausePanelToolbar' id='aw_addClausePanelTypeToolBar' firstAnchor='aw_addClausePanelTypeToolBar_left' secondAnchor='aw_addClausePanelTypeToolBar_right' orientation='HORIZONTAL' context={{ parentViewModel: viewModel }}></AwToolbar>
                        <AwScrollpanel>
                            {
                                treeToDisplay && treeToDisplay.length > 0 && treeToDisplay[ 0 ].children && treeToDisplay[ 0 ].children.length > 0 &&
                                <AwTree name='typeSelectionTree' tree={treeToDisplay}>
                                    { ( { node } ) => {
                                        if( displayMode && displayMode === 'displayName' ) {
                                            return <span value={node.label}>
                                                <div>{node.label}</div>
                                                </span>;
                                        }
                                        else if( displayMode && displayMode === 'internalName' ) {
                                            return <span value={node.value}>
                                                <div>{node.value}</div>
                                                </span>;
                                        }
                                    } }
                                </AwTree>
                            }
                        </AwScrollpanel>
                    </div>
                }
                {
                    isReferencedBy &&
                    <>
                        <AwPanelSection caption={selectedType ? `${i18n.object_type} (${selectedType.value})` : i18n.object_type} name='typeSection' className='sw-column aw-results-section aw-search-addClausePanelTypeSelectionInput' collapsed={isTypeSectionCollapsed}>
                            <AwTextBox {...Object.assign( {}, fields.searchBox, { autoComplete:'off' } )} onSwChange={filterTree}></AwTextBox>
                            <AwToolbar className='aw-search-savedQueryAddClausePanelToolbar' id='aw_addClausePanelTypeToolBar' firstAnchor='aw_addClausePanelTypeToolBar_left' secondAnchor='aw_addClausePanelTypeToolBar_right' orientation='HORIZONTAL' context={{ parentViewModel: viewModel }}></AwToolbar>
                            <AwScrollpanel className='aw-search-addClauseReferencedByScrollPanel'>
                                {
                                    treeToDisplay && treeToDisplay.length > 0 && treeToDisplay[ 0 ].children && treeToDisplay[ 0 ].children.length > 0 &&
                                    <AwTree name='typeSelectionTree' tree={treeToDisplay}>
                                        { ( { node } ) => {
                                            if( displayMode && displayMode === 'displayName' ) {
                                                return <span value={node.label}>
                                                    <div>{node.label}</div>
                                                    </span>;
                                            }
                                            else if( displayMode && displayMode === 'internalName' ) {
                                                return <span value={node.value}>
                                                    <div>{node.value}</div>
                                                    </span>;
                                            }
                                        } }
                                    </AwTree>
                                }
                            </AwScrollpanel>
                        </AwPanelSection>
                        <AwPanelSectionVisibleWhen visibleWhen={selectedType && isTypeSectionCollapsed} caption={selectedProperty && selectedProperty.name !== selectedType.value ? `${i18n.propertyText} (${selectedProperty.displayName})` : i18n.propertyText} name='propertySection'
                                                   className='sw-column aw-results-section aw-search-addClausePanelTypeSelectionInput' collapsed={false}>
                            <AwSavedQueryPropertySelectionSubpanel subPanelContext={{ selectedType: selectedType, ...props.subPanelContext }}></AwSavedQueryPropertySelectionSubpanel>
                        </AwPanelSectionVisibleWhen>
                    </>
                }
            </AwPanelBody>
            <AwPanelFooter>
                <AwButtonEnableWhen action={actions.confirmSelectTypeBatchJob}
                    enableWhen={( !isReferencedBy && selectedType ) || ( isReferencedBy && selectedProperty && selectedProperty.name !== selectedType.value )}>
                    <AwI18n>
                        {isReferencedBy ? i18n.addCommandTitle : i18n.select}
                    </AwI18n>
                </AwButtonEnableWhen>
            </AwPanelFooter>
        </>
    );
};