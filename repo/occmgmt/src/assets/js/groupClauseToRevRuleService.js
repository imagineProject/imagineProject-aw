// Copyright (c) 2024 Siemens

/**
 * @module js/groupClauseToRevRuleService
 */

import _ from 'lodash';
import localeSvc from 'js/localeService';

var GROUP_BY_USAGE_TYPE = 4;

export function groupTypeListSelectionChange( selectedGroupType )
{
    let localTextBundleRevRule = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
    let childItemTypeDisplayName = localTextBundleRevRule.childItemTypeListWithoutUsage;
    if( selectedGroupType === GROUP_BY_USAGE_TYPE ) {
        childItemTypeDisplayName = localTextBundleRevRule.childItemTypeList;
    }
    return childItemTypeDisplayName;
}

/**
 * Get all the "Usage Revision Types / Item Types / or any sub type" to set it into the respective list in Group Panel  
 * 
 */
export function processSubTypeResponse( response )
{
    if( response && response.output ) {
        let sub_types = [];
        _.forEach( response.output[0].displayableSubTypeNames, ( subTypeName, indexOfSubType ) => {
            let createSubType = {};

            createSubType.propInternalValue = response.output[0].subTypeNames[ indexOfSubType ];
            createSubType.propDisplayValue = subTypeName;

            sub_types.push( createSubType );
        } );
        return sub_types;
    }
    return [];
}

function makeGroupClauseUsageOrItemText( keyText, selectedInternalTypes, subTypeAndCreatedTextInput )
{
    let subTypeAndCreatedText = subTypeAndCreatedTextInput;

    subTypeAndCreatedText.selectedUsageAndItemTypes = subTypeAndCreatedText.selectedUsageAndItemTypes.concat( selectedInternalTypes.dbValues );

    subTypeAndCreatedText.createdGroupClauseDisplayText += keyText + ' ( ';
    subTypeAndCreatedText.createdGroupClauseDisplayText += selectedInternalTypes.uiValues.join( ', ' );
    subTypeAndCreatedText.createdGroupClauseDisplayText += ' ) ';

    return subTypeAndCreatedText;
}

export function makeGroupClauseAction( nestedNavigationState, selectedUsageRevisionTypes, selectedItemTypes, groupSelectionType )
{
    let subTypeAndCreatedTextInput = {
        selectedUsageAndItemTypes: [],
        createdGroupClauseDisplayText: ""
    };
    let localTextBundleRevRule = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
    let makeGroupClauseItemText = localTextBundleRevRule.makeGroupClauseItemWithoutUsage;
    if( groupSelectionType === GROUP_BY_USAGE_TYPE ) {
        
        subTypeAndCreatedTextInput = makeGroupClauseUsageOrItemText( localTextBundleRevRule.makeGroupClauseUsage, selectedUsageRevisionTypes, subTypeAndCreatedTextInput );
        makeGroupClauseItemText = localTextBundleRevRule.makeGroupClauseItem;
    }

    subTypeAndCreatedTextInput = makeGroupClauseUsageOrItemText( makeGroupClauseItemText, selectedItemTypes, subTypeAndCreatedTextInput );

    subTypeAndCreatedTextInput.createdGroupClauseDisplayText += '{ ';

    let isGroupClauseIndexFixed = false;
    let indexOfCreatedGroupClause = -1;
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState.getValue() );
    
    // Encapsulate selected elimentary clauses into created group clause
    _.forEach( nestedNavigationState.clauses, ( selectedClause, indexOfSelectedClause ) => {
        
        if( selectedClause.checkboxSelected ) {
            
            if( ! isGroupClauseIndexFixed ) {

                isGroupClauseIndexFixed = true;
                indexOfCreatedGroupClause = indexOfSelectedClause;
                newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].displayText = subTypeAndCreatedTextInput.createdGroupClauseDisplayText;
                if( groupSelectionType === GROUP_BY_USAGE_TYPE ) {

                    newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].entryType = newNestedNavigationState.groupUsageTypeEntryType;
                } else {
                    newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].entryType = newNestedNavigationState.groupItemTypeEntryType;
                }
                newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].groupEntryInfo[ 'groupByTypes' ] = subTypeAndCreatedTextInput.selectedUsageAndItemTypes;
            } else {

                newNestedNavigationState.clauses.splice( indexOfSelectedClause, 1 );
            }

            delete selectedClause.checkboxSelected;
            delete selectedClause.clauseIndex;
            delete selectedClause.selected;
            if( newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].checkboxSelected ) {
                delete newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].checkboxSelected;
            }
            newNestedNavigationState.clauses[ indexOfCreatedGroupClause ].groupEntryInfo.listOfSubEntries.push( selectedClause );
        }
    } );

    // Enable Save As / Modify & Configure as the clause is modified
    newNestedNavigationState.isClauseModifiedByGroupUngroup = true;
    // Navigate back to Revision Rule Admin Panel by removing last (current) view
    newNestedNavigationState.views.splice( -1, 1 );
    //Tag Revision Rule as modified by setting this property
    newNestedNavigationState.clauseUpdated = true;
    nestedNavigationState.update( newNestedNavigationState );
}

export function setListDataWithScrollRender( startIndex, pageSize, listSubTypes, filterString )
{
    pageSize = parseInt( pageSize );

    let searchedSubTypes = listSubTypes;
    if( filterString && filterString.length > 0 )
    {
        searchedSubTypes = listSubTypes.filter( ( subType ) => {
            let regExp = new RegExp( filterString, 'gi' );
            return ( regExp.test( subType.propDisplayValue ) );
        } );
    }

    let loadedListSize = startIndex + pageSize;
    let showSubTypeDetails = {};

    showSubTypeDetails.totalSubTypesFound = searchedSubTypes.length;
    showSubTypeDetails.listSubTypesValues = searchedSubTypes;
    
    if( searchedSubTypes.length > loadedListSize )
    {
        showSubTypeDetails.listSubTypesValues = searchedSubTypes.slice( startIndex, ( startIndex + pageSize ) );
        showSubTypeDetails.totalSubTypesFound = loadedListSize + 1;
    }

    return showSubTypeDetails;
}

export function ungroupGroupClause ( nestedNavigationState, dataProvider )
{
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    let deltaInIndexOfSelectedClause = 0;
    _.forEach( nestedNavigationState.clauses, ( revRuleClause, indexOfSelectedClause ) => {
        
        let computedIndexOfSelectedClause = deltaInIndexOfSelectedClause + indexOfSelectedClause;
        if( revRuleClause.checkboxSelected && ( revRuleClause.entryType === nestedNavigationState.groupUsageTypeEntryType || revRuleClause.entryType === nestedNavigationState.groupItemTypeEntryType ) ) {
            
            deltaInIndexOfSelectedClause += revRuleClause.groupEntryInfo.listOfSubEntries.length - 1;
            newNestedNavigationState.clauses.splice( computedIndexOfSelectedClause, 1, ...(revRuleClause.groupEntryInfo.listOfSubEntries) );

            newNestedNavigationState.currentlySelectedClause = newNestedNavigationState.clauses[ computedIndexOfSelectedClause ];
            newNestedNavigationState.currentlySelectedClause.dbValue = newNestedNavigationState.clauses[ computedIndexOfSelectedClause ].entryType;
            newNestedNavigationState.isClauseModifiedByGroupUngroup = true;
            newNestedNavigationState.clauseUpdated = true;
        }
    } );
    nestedNavigationState.update( newNestedNavigationState );
    dataProvider.update( newNestedNavigationState.clauses, newNestedNavigationState.clauses.length );
}

export function showSelectedClausesInGroupPanel ( nestedNavigationState, data, formProp )
{
    let newSshowSelectedClausesInGroup = { ...data.showSelectedClausesInGroup };
    let selectedClausesTexts = [];
    _.forEach( nestedNavigationState.clauses, ( clause ) => {

        if( clause.checkboxSelected ) {
            selectedClausesTexts.push( clause.displayText );
        }
    } );

    selectedClausesTexts = selectedClausesTexts.join( ', ' );
    newSshowSelectedClausesInGroup.dbValue = selectedClausesTexts;
    newSshowSelectedClausesInGroup.dispValue = selectedClausesTexts;
    formProp.reset( {
        showSelectedClausesInGroup: newSshowSelectedClausesInGroup
    } );
}

export function updateNestedNavigationStateClausesWithCheckboxSelections( nestedNavigationState, clauseCheckBoxState )
{
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    let atleastOneCheckboxSelected = false;
    let isGroupClauseSelected = false;
    _.forEach( clauseCheckBoxState.clauses, ( clauseCheckbox, clauseIndex ) => {

        if( clauseCheckbox.selected.value !== undefined && clauseCheckbox.selected.value !== null) {

            if( clauseCheckbox.selected.value === false ) {

                newNestedNavigationState.clauses[ clauseIndex ][ 'checkboxSelected' ] = false;
            } else {

                atleastOneCheckboxSelected = true;
                
                if( newNestedNavigationState.clauses[ clauseIndex ].entryType === newNestedNavigationState.groupUsageTypeEntryType || 
                    newNestedNavigationState.clauses[ clauseIndex ].entryType === newNestedNavigationState.groupItemTypeEntryType ) {

                    isGroupClauseSelected = true;
                }
                
                newNestedNavigationState.clauses[ clauseIndex ][ 'checkboxSelected' ] = true;
            }
        }
    } );

    if( atleastOneCheckboxSelected ) {

        if( isGroupClauseSelected ) {

            newNestedNavigationState.isGroupCommandEnable = false;
            newNestedNavigationState.isUnGroupCommandEnable = true;
        } else {

            newNestedNavigationState.isGroupCommandEnable = true;
            newNestedNavigationState.isUnGroupCommandEnable = false;
        }
    } else {

        newNestedNavigationState.isGroupCommandEnable = false;
        newNestedNavigationState.isUnGroupCommandEnable = false;        
    }
    nestedNavigationState.update( newNestedNavigationState );
}

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};
export default exports = {

    groupTypeListSelectionChange,
    processSubTypeResponse,
    makeGroupClauseAction,
    setListDataWithScrollRender,
    ungroupGroupClause,
    showSelectedClausesInGroupPanel,
    updateNestedNavigationStateClausesWithCheckboxSelections
};