

// Copyright (c) 2021 Siemens
/* global */


/**
 * @module js/AwDiscoveryRecipeChipsService
 */

import AwChip from 'viewmodel/AwChipViewModel';
import eventBus from 'js/eventBus';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import _ from 'lodash';

const AwChipHOC = ExtendedTooltip( AwChip );

/**
  * render function for awDiscoveryRecipeChips
  * @param {*} props context for render function interpolation
  * @returns {JSX.Element} react component
  */
export const awDiscoveryRecipeChipsRenderFunction = ( props ) => {
    const { viewModel, actions, elementRefList } = props;
    const { data, i18n } = viewModel;
    let chipCondition = {
        conditions: viewModel.conditions
    };

    const setActiveGroup = ( event, index ) => {
        let updateIndex = false;
        let newSharedData = { ...props.sharedData.getValue() };
        if( event ) {
            event.stopPropagation();
            if( event.target?.classList.contains( 'sw-section' ) || event.target?.classList.contains( 'aw-widgets-chipLabel' ) ) {
                if ( event.key && ( event.key !== 'Enter' && event.key !== ' ' ) ) {
                    return;
                }
                updateIndex = true;
            }
        } else if( index >= 0 ) {
            updateIndex = true;
        }
        if(  updateIndex && newSharedData.activeGroupIndex !== index ) {
            newSharedData.activeGroupIndex = index;
            props.sharedData.update( newSharedData );
        }
    };

    const doNothing = () => {
    };

    const showFilterRecipeChipPanel = () =>{
        let groups = data.displayRecipeGroupChips;
        let orChipModel = { chipType: 'BUTTON',
            selected: false,
            labelDisplayName: i18n.OrGroup };
        let notChipModel = { chipType: 'BUTTON',
            selected: false,
            labelDisplayName: i18n.NotGroup };

        let activeGroupIndex =  props.sharedData.getValue().activeGroupIndex;
        return (
            <div className='aw-search-breadcrumb-chipsPanel '>
                <div className='aw-layout-flexbox aw-widgets-chipListPanel aw-subset-mainRecipeGroup' data-locator='discoveryFilter' ref={elementRefList.get( 'chiplist' )}>
                    { groups &&  Object.keys( groups ).map( ( groupIndex, index ) =>{
                        let subCriteriaRecipeChips = groups[groupIndex];
                        let groupClassName = index === activeGroupIndex ? 'aw-subset-recipeGroup aw-subset-recipeGroupColor' : 'aw-subset-recipeGroup';
                        let chipClassName = index === 0 ? 'aw-subset-recipeChip' : 'aw-subset-nestedRecipeChip';
                        let nestedChipClassName = 'aw-subset-nestedRecipeOrChip';
                        let nestedChipModel = orChipModel;

                        if( props.recipeObject && props.recipeObject.recipeGroup.length > 0 && props.recipeObject.recipeGroup[groupIndex] !== undefined ) {
                            let criteriaOperatorType = props.recipeObject.recipeGroup[groupIndex].criteriaOperatorType;
                            if( criteriaOperatorType === 'Exclude' ) {
                                nestedChipClassName = 'aw-subset-nestedRecipeNotChip';
                                nestedChipModel = notChipModel;
                            }
                        }

                        return (
                            // We have changed the below div to not have tabIndex because the tab index created issue with the scroll
                            // When last group was selected, the scroll was taken to the top
                            // LCS-1104483 - TCBETA_FALL2024:-User redirected to first group in large list of groups if user clicks on a group down below in Filter panel
                            // tabIndex can be used again, when we implement the keyboard tab for recipe area
                            // <div className={'aw-layout-flexbox aw-widgets-chipListPanel' + ' group' + groupIndex} role='button' tabIndex='0' key= {_.uniqueId()}
                            //    onClick={( event ) => { setActiveGroup( event, index ); }}
                            //    onKeyUp={( event ) => { setActiveGroup( event, index ); }}>
                            //
                            // eslint-disable-next-line jsx-a11y/interactive-supports-focus
                            <div className={'aw-layout-flexbox aw-widgets-chipListPanel' + ' group' + groupIndex} role='button' key= {_.uniqueId()}
                                onClick={( event ) => { setActiveGroup( event, index ); }}
                                onKeyUp={( event ) => { setActiveGroup( event, index ); }}>
                                { index > 0 && <AwChip chip={nestedChipModel} className={nestedChipClassName}></AwChip> }
                                <AwPanelSection className={groupClassName} key={_.uniqueId()} >

                                    { subCriteriaRecipeChips && subCriteriaRecipeChips.length > 0 && subCriteriaRecipeChips.map( ( chipModel, subCriteriaIndex ) => {
                                        var recipeTooltip = 'FilterTooltip';
                                        var tooltipContext = { tooltip: chipModel.tooltip };
                                        // Proximity,BoundingBox and BoxZone are all selection based filter types which is not possible in hosted Advanced Filter Component
                                        // hence disable them
                                        if( chipModel.chipFilterType === 'Proximity' || chipModel.chipFilterType === 'BoundingBox' || chipModel.chipFilterType === 'BoxZone' ) {
                                            chipModel.enableWhen = { condition: 'conditions.shouldDisableChips' };
                                        } else {
                                            chipModel.enableWhen = { condition: 'conditions.shouldEnableChips' };
                                        }
                                        if( chipModel.chipFilterType === 'Proximity' ) {
                                            const editProximityRecipe = () => {
                                                //Open the sub panel to set the recipe input
                                                var panelName = chipModel.recipeTerm.criteriaType + 'SubPanel';
                                                var eventData = {
                                                    nextActiveView: panelName,
                                                    recipeOperator: null,
                                                    recipeTerm: chipModel.recipeTerm,
                                                    spatialRecipeIndexToUpdate: chipModel.recipeTermIndex,
                                                    newActiveGroupIndex: chipModel.groupIndex
                                                };
                                                eventBus.publish( 'awb0.updateDiscoverySharedDataForPanelNavigation', eventData );
                                            };

                                            // Construct chips
                                            return (
                                                <AwChipHOC
                                                    chip={chipModel}
                                                    action={editProximityRecipe}
                                                    uiIconAction={actions.removeFilterAction}
                                                    key={subCriteriaIndex}
                                                    chipCondition={chipCondition}
                                                    extendedTooltip={recipeTooltip}
                                                    extendedTooltipOptions={{ placement: 'right' }}
                                                    extendedTooltipContext={tooltipContext}
                                                    className={chipClassName}>

                                                    { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                                        return (
                                                            <AwChip
                                                                chip={chipChildModel}
                                                                action={doNothing()}
                                                                uiIconAction={actions.removeFilterAction}
                                                                key={childIndex}
                                                                chipCondition={chipCondition}>
                                                            </AwChip>
                                                        );
                                                    } )}
                                                </AwChipHOC>
                                            );
                                        }
                                        let selectAction = () => doNothing();

                                        if( chipModel.children && chipModel.children.length > 0 ) {
                                            selectAction = () => setActiveGroup( null, chipModel.groupIndex );
                                        }
                                        if ( chipModel.recipeTerm.criteriaType === 'SelectedElement' && chipModel.recipeTerm.criteriaOperatorType === 'Filter' ) {
                                            tooltipContext.showWithoutChildrenAnd = chipModel.recipeTerm.criteriaValues[chipModel.recipeTerm.criteriaValues.length - 1] === 'False';
                                            return (
                                                <AwChipHOC
                                                    chip={chipModel}
                                                    action={selectAction}
                                                    uiIconAction={actions.removeFilterAction}
                                                    key={subCriteriaIndex}
                                                    chipCondition={chipCondition}
                                                    extendedTooltip={recipeTooltip}
                                                    extendedTooltipOptions={{ placement: 'right' }}
                                                    extendedTooltipContext={tooltipContext}
                                                    className={chipClassName}>
                                                    {chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                                        return (
                                                            <AwChip
                                                                chip={chipChildModel}
                                                                action={doNothing()}
                                                                uiIconAction={actions.removeFilterAction}
                                                                key={childIndex}
                                                                chipCondition={chipCondition}>
                                                            </AwChip>
                                                        );
                                                    } )}
                                                </AwChipHOC>
                                            );
                                        }
                                        return (
                                            <AwChipHOC
                                                chip={chipModel}
                                                action={selectAction}
                                                uiIconAction={actions.removeFilterAction}
                                                key={subCriteriaIndex}
                                                chipCondition={chipCondition}
                                                extendedTooltip={recipeTooltip}
                                                extendedTooltipOptions={{ placement: 'right' }}
                                                extendedTooltipContext={tooltipContext}
                                                className={chipClassName}>

                                                { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                                    return (
                                                        <AwChip
                                                            chip={chipChildModel}
                                                            action={doNothing()}
                                                            uiIconAction={actions.removeFilterAction}
                                                            key={childIndex}
                                                            chipCondition={chipCondition}>
                                                        </AwChip>
                                                    );
                                                } )}
                                            </AwChipHOC>
                                        );
                                    } )}
                                </AwPanelSection>
                            </div> );
                    } )}
                </div>
            </div>
        );
    };


    return (
        <>
            {showFilterRecipeChipPanel()}
        </>
    );
};

const AwDiscoveryRecipeChipsService = {
};

export default AwDiscoveryRecipeChipsService;

