
// Copyright 2024 Siemens Product Lifecycle Management Software Inc.
/* global */

/**
 *
 * @module js/AwSavedQueryCriteriaTableService
 */

import soaService from 'soa/kernel/soaService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import uwPropertyService from 'js/uwPropertyService';
import localeSvc from 'js/localeService';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

export let loadTableData = function( response ) {
    let clauses = response.definitions[ 0 ].clauses;

    if( clauses.length === 1 && clauses[ 0 ].attributeName === 'timestamp' ) {
        return [];
    }

    return clauses.map( function( clause ) {
        let newObjectUid = Math.random().toString( 36 ).substr( 2, 10 );
        let newClauseObject = tcViewModelObjectSvc.createViewModelObjectById( newObjectUid );
        newClauseObject.modelType = 'Clause';
        newClauseObject.propertyType = clause.attributeType - 2000;

        let logicalOperatorProp = uwPropertyService.createViewModelProperty( 'LogicalOperator', 'LogicalOperator', 'STRING', clause.logicalOperator, [ clause.logicalOperator ] );
        uwPropertyService.setIsPropertyModifiable( logicalOperatorProp, false );
        uwPropertyService.setHasLov( logicalOperatorProp, true );

        let attributeProp = uwPropertyService.createViewModelProperty( 'Attribute', 'Attribute', 'STRING', clause.attributeName, [ clause.attributeName ] );
        uwPropertyService.setIsPropertyModifiable( attributeProp, false );

        let userEntryKeyProp = uwPropertyService.createViewModelProperty( 'UserEntryKey', 'UserEntryKey', 'STRING', clause.entryL10NKey, [ clause.entryL10NKey ] );
        uwPropertyService.setIsPropertyModifiable( userEntryKeyProp, false );

        let userEntryNameProp = uwPropertyService.createViewModelProperty( 'UserEntryName', 'UserEntryName', 'STRING', clause.entryNameDisplay, [ clause.entryNameDisplay ] );
        uwPropertyService.setIsPropertyModifiable( userEntryNameProp, false );

        let operatorProp = uwPropertyService.createViewModelProperty( 'Operator', 'Operator', 'STRING', clause.mathOperator, [ clause.mathOperator ] );
        uwPropertyService.setIsPropertyModifiable( operatorProp, false );
        uwPropertyService.setHasLov( operatorProp, true );

        let defaultValueProp = {};
        if( newClauseObject.propertyType === 1 ) {
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'CHAR', clause.defaultDisplayValue, [ clause.defaultDisplayValue ] );
            defaultValueProp.maxLength = 1;
        } else if( newClauseObject.propertyType === 2 ) {
            let dateString = dateTimeService.formatDateTime( parseInt( clause.defaultDisplayValue ), 10 );
            dateString = dateString.replace( ' - ', ' ' );
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'DATE', parseInt( clause.defaultDisplayValue, 10 ), [ dateString ] );
        } else if( newClauseObject.propertyType === 3 ) {
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'DOUBLE', clause.defaultDisplayValue, [ clause.defaultDisplayValue ] );
        } else if( newClauseObject.propertyType === 5 ) {
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'INTEGER', clause.defaultDisplayValue, [ clause.defaultDisplayValue ] );
        } else if( newClauseObject.propertyType === 6 ) {
            let searchMessages = localeSvc.getLoadedText( 'SearchMessages' );
            let trueFalseText = '';
            if( clause.defaultDisplayValue.toLowerCase() === 'true' || clause.defaultDisplayValue === '1' ) {
                trueFalseText = searchMessages.trueText;
            } else if( clause.defaultDisplayValue.toLowerCase() === 'false' || clause.defaultDisplayValue === '0' ) {
                trueFalseText = searchMessages.falseText;
            }
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'STRING', clause.defaultDisplayValue, [ trueFalseText ] );
        } else {
            defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'STRING', clause.defaultDisplayValue, [ clause.defaultDisplayValue ] );
        }
        uwPropertyService.setIsPropertyModifiable( defaultValueProp, false );

        newClauseObject.props.LogicalOperator = logicalOperatorProp;
        newClauseObject.props.Attribute = attributeProp;
        newClauseObject.props.UserEntryKey = userEntryKeyProp;
        newClauseObject.props.UserEntryName = userEntryNameProp;
        newClauseObject.props.Operator = operatorProp;
        newClauseObject.props.DefaultValue = defaultValueProp;

        return newClauseObject;
    } );
};

export let clearSelections = function( selectionData ) {
    let newSelectionData = { ...selectionData.getValue() };
    newSelectionData.selected = [];
    selectionData.update( newSelectionData );
};

export let updateContextWithInitialVMOs = function( searchState, initialVMOs ) {
    let newSearchstate = searchState ? { ...searchState.getValue() } : {};
    let initialVMOsCopy = _.cloneDeep( initialVMOs );
    newSearchstate.initialClauseVMOs = initialVMOsCopy;
    searchState.update( newSearchstate );
};

export let deleteClause = function( selectedClauses, dataProvider ) {
    let hasEmptyLogicalOperator = selectedClauses.some( clause => clause.props.LogicalOperator.dbValue === '' );

    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        loadedVMOs = loadedVMOs.filter( function( vmo ) {
            return !selectedClauses.some( selectedVMO => selectedVMO.uid === vmo.uid );
        } );

        if( hasEmptyLogicalOperator && loadedVMOs.length > 0 ) {
            uwPropertyService.setValue( loadedVMOs[ 0 ].props.LogicalOperator, '' );
            uwPropertyService.setDisplayValue( loadedVMOs[ 0 ].props.LogicalOperator, '' );
            uwPropertyService.setIsPropertyModifiable( loadedVMOs[ 0 ].props.LogicalOperator, false );
        }

        if( vmc ) {
            vmc.setViewModelObjects( loadedVMOs );
        }
    }

    dataProvider.selectionModel.setSelection( [] );
};

export let reloadInitialVMOs = function( initialVMOs, dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    if( vmc ) {
        let initialVMOsCopy = _.cloneDeep( initialVMOs );
        vmc.setViewModelObjects( initialVMOsCopy );
    }
};

export let setEditModeOnVMOs = function( dataProvider, isEditable ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        loadedVMOs.forEach( function( vmo ) {
            let logicalOperatorProp = vmo.props.LogicalOperator;
            let userEntryKeyProp = vmo.props.UserEntryKey;
            let operatorProp = vmo.props.Operator;
            let defaultValueProp = vmo.props.DefaultValue;

            if( logicalOperatorProp.dbValue === '' ) {
                uwPropertyService.setIsPropertyModifiable( logicalOperatorProp, false );
            } else {
                uwPropertyService.setIsPropertyModifiable( logicalOperatorProp, isEditable );
            }

            if( operatorProp.dbValue.toLowerCase() === 'is_null' || operatorProp.dbValue.toLowerCase() === 'is_not_null' ) {
                uwPropertyService.setIsPropertyModifiable( defaultValueProp, false );
                uwPropertyService.setIsPropertyModifiable( userEntryKeyProp, false );
            } else {
                uwPropertyService.setIsPropertyModifiable( defaultValueProp, isEditable );
                uwPropertyService.setIsPropertyModifiable( userEntryKeyProp, isEditable );
            }

            uwPropertyService.setIsPropertyModifiable( operatorProp, isEditable );
        } );
    }
};

export let saveCriteriaTableEdits = function( searchState, dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    let newSearchState = { ...searchState.getValue() };
    newSearchState.initialClauseVMOs = loadedVMOs;
    searchState.update( newSearchState );

    if( loadedVMOs ) {
        let currentClauses = getClausesForSave( loadedVMOs );
        eventBus.publish( 'ImanQueryOverviewClausesUpdated', { clauses: currentClauses } );
    }
};

export let updateEditModeValue = function( newEditMode ) {
    return newEditMode;
};

export let updateUserEntryName = function( dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        loadedVMOs.forEach( function( vmo ) {
            if( vmo.props.UserEntryKey.valueUpdated ) {
                let updatedVMOKey = vmo.props.UserEntryKey.dbValue;
                let vmoUserEntryNameProp = vmo.props.UserEntryName;

                let inputData = {
                    info: [ updatedVMOKey ]
                };

                soaService.postUnchecked( 'Core-2008-06-Session', 'getDisplayStrings', inputData )
                    .then( function( response ) {
                        let localizedValue = response.output[ 0 ].value;
                        uwPropertyService.setValue( vmoUserEntryNameProp, localizedValue );
                        uwPropertyService.setDisplayValue( vmoUserEntryNameProp, [ localizedValue ] );
                        eventBus.publish( 'Awp0SavedQueryCriteriaTable.refreshTable' );
                    } );
            }
        } );
    }
};

export let addClauseToTable = function( selectedNode, dataProvider, searchState ) {
    let nodeInfo = selectedNode && selectedNode.name;
    let attributeValue;
    if ( !nodeInfo && searchState.selectedNode && searchState.selectedNode.attributeValue ) {
        attributeValue = searchState.selectedNode.attributeValue;
    } else {
        attributeValue = selectedNode.hierarchyString ? selectedNode.hierarchyString : selectedNode.name;
    }
    let numClauses = dataProvider.viewModelCollection.getLoadedViewModelObjects().length;
    let logicalOperator = numClauses === 0 ? '' : 'AND';

    let newObjectUid = Math.random().toString( 36 ).substr( 2, 10 );
    let newClauseObject = tcViewModelObjectSvc.createViewModelObjectById( newObjectUid );
    newClauseObject.modelType = 'Clause';
    newClauseObject.propertyType = selectedNode.valueType;
    newClauseObject.isReferencedOrRelationProperty = selectedNode.propertyType === 2 || selectedNode.propertyType === 3;

    let logicalOperatorProp = uwPropertyService.createViewModelProperty( 'LogicalOperator', 'LogicalOperator', 'STRING', logicalOperator, [ logicalOperator ] );
    uwPropertyService.setIsPropertyModifiable( logicalOperatorProp, false );
    uwPropertyService.setHasLov( logicalOperatorProp, true );

    let attributeProp = uwPropertyService.createViewModelProperty( 'Attribute', 'Attribute', 'STRING', attributeValue, [ attributeValue ] );
    uwPropertyService.setIsPropertyModifiable( attributeProp, false );

    let userEntryKeyProp = {};
    if( newClauseObject.isReferencedOrRelationProperty ) {
        userEntryKeyProp = uwPropertyService.createViewModelProperty( 'UserEntryKey', 'UserEntryKey', 'STRING', '', [ '' ] );
    } else if( searchState.selectedNode && searchState.selectedNode.displayAsString ) {
        userEntryKeyProp = uwPropertyService.createViewModelProperty( 'UserEntryKey', 'UserEntryKey', 'STRING', searchState.selectedNode?.displayAsString, [ searchState.selectedNode?.displayAsString ] );
    } else {
        userEntryKeyProp = uwPropertyService.createViewModelProperty( 'UserEntryKey', 'UserEntryKey', 'STRING', selectedNode.name, [ selectedNode.name ] );
    }
    uwPropertyService.setIsPropertyModifiable( userEntryKeyProp, false );

    let userEntryNameProp = {};
    if( newClauseObject.isReferencedOrRelationProperty ) {
        userEntryNameProp = uwPropertyService.createViewModelProperty( 'UserEntryName', 'UserEntryName', 'STRING', '', [ '' ] );
    } else if( searchState.selectedNode && searchState.selectedNode.displayAsString ) {
        userEntryNameProp = uwPropertyService.createViewModelProperty( 'UserEntryName', 'UserEntryName', 'STRING',  searchState.selectedNode?.displayAsString, [ searchState.selectedNode?.displayAsString ] );
    } else {
        userEntryNameProp = uwPropertyService.createViewModelProperty( 'UserEntryName', 'UserEntryName', 'STRING', selectedNode.displayName, [ selectedNode.displayName ] );
    }
    uwPropertyService.setIsPropertyModifiable( userEntryNameProp, false );

    let operatorProp = {};
    if( newClauseObject.isReferencedOrRelationProperty ) {
        operatorProp = uwPropertyService.createViewModelProperty( 'Operator', 'Operator', 'STRING', 'IS_NULL', [ 'IS_NULL' ] );
    } else {
        operatorProp = uwPropertyService.createViewModelProperty( 'Operator', 'Operator', 'STRING', '=', [ '=' ] );
    }
    uwPropertyService.setIsPropertyModifiable( operatorProp, false );
    uwPropertyService.setHasLov( operatorProp, true );

    let defaultValueProp = {};
    if( newClauseObject.propertyType === 1 ) {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'CHAR', '', [ '' ] );
        defaultValueProp.maxLength = 1;
    } else if( newClauseObject.propertyType === 2 ) {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'DATE', '', [ '' ] );
    } else if( newClauseObject.propertyType === 3 ) {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'DOUBLE', '', [ '' ] );
    } else if( newClauseObject.propertyType === 5 ) {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'INTEGER', '', [ '' ] );
    } else if( newClauseObject.propertyType === 6 ) {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'STRING', '', [ '' ] );
    } else {
        defaultValueProp = uwPropertyService.createViewModelProperty( 'DefaultValue', 'DefaultValue', 'STRING', '', [ '' ] );
    }
    uwPropertyService.setIsPropertyModifiable( defaultValueProp, false );

    newClauseObject.props.LogicalOperator = logicalOperatorProp;
    newClauseObject.props.Attribute = attributeProp;
    newClauseObject.props.UserEntryKey = userEntryKeyProp;
    newClauseObject.props.UserEntryName = userEntryNameProp;
    newClauseObject.props.Operator = operatorProp;
    newClauseObject.props.DefaultValue = defaultValueProp;

    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if( loadedVMOs ) {
        loadedVMOs.push( newClauseObject );
        dataProvider.update( loadedVMOs );
    }

    let newSearchState = searchState ? { ...searchState.getValue() } : {};
    if( newSearchState.clauses && newSearchState.clauses.length > 0 ) {
        newSearchState.clauses.push( newClauseObject );
    } else {
        newSearchState.clauses = [ newClauseObject ];
    }
    searchState.update( newSearchState );
};

export let updateDefaultValueEditable = function( dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        let vmoUpdated = false;
        loadedVMOs.forEach( function( vmo ) {
            let operator = vmo.props.Operator.dbValue.toLowerCase();
            let vmoDefaultValueProp = vmo.props.DefaultValue;
            let vmoUserEntryKeyProp = vmo.props.UserEntryKey;
            let vmoUserEntryNameProp = vmo.props.UserEntryName;
            if( ( operator === 'is_null' || operator === 'is_not_null' ) && vmoDefaultValueProp.isPropertyModifiable && vmoUserEntryKeyProp.isPropertyModifiable ) {
                vmoUpdated = true;
                uwPropertyService.setValue( vmoDefaultValueProp, '' );
                uwPropertyService.setDisplayValue( vmoDefaultValueProp, [ '' ] );
                uwPropertyService.setIsPropertyModifiable( vmoDefaultValueProp, false );
                uwPropertyService.setValue( vmoUserEntryKeyProp, '' );
                uwPropertyService.setDisplayValue( vmoUserEntryKeyProp, [ '' ] );
                uwPropertyService.setIsPropertyModifiable( vmoUserEntryKeyProp, false );
                uwPropertyService.setValue( vmoUserEntryNameProp, '' );
                uwPropertyService.setDisplayValue( vmoUserEntryNameProp, [ '' ] );
            } else if(  operator !== 'is_null' && operator !== 'is_not_null'  && !vmoDefaultValueProp.isPropertyModifiable && !vmoUserEntryKeyProp.isPropertyModifiable ) {
                vmoUpdated = true;
                uwPropertyService.setIsPropertyModifiable( vmoDefaultValueProp, true );
                uwPropertyService.setIsPropertyModifiable( vmoUserEntryKeyProp, true );
            }
        } );

        if( vmoUpdated ) {
            eventBus.publish( 'Awp0SavedQueryCriteriaTable.refreshTable' );
        }
    }
};

export let getClausesForSave = function( clauseVMOs ) {
    return clauseVMOs.map( function( clause ) {
        return {
            attribute: clause.props.Attribute.dbValue,
            defaultValue: clause.props.DefaultValue.dbValue.toString(),
            userEntryKey: clause.props.UserEntryKey.dbValue,
            userEntryDisplay: clause.props.UserEntryName.dbValue,
            logicalOperator: clause.props.LogicalOperator.dbValue,
            mathOperator: clause.props.Operator.dbValue
        };
    } );
};

export let clearCriteriaTable = ( dataProvider ) => {
    dataProvider.viewModelCollection.clear();
    dataProvider.selectionModel.setSelection( [] );
    eventBus.publish( 'Awp0SavedQueryCriteriaTable.refreshTable' );
};

export let updateDefaultValueBoolean = function( dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }
    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        let vmoUpdated = false;
        loadedVMOs.forEach( function( vmo ) {
            if( vmo.propertyType === 6 && vmo.props.DefaultValue.valueUpdated && vmo.props.DefaultValue.value !== vmo.props.DefaultValue.dbValue ) {
                vmo.props.DefaultValue.value = vmo.props.DefaultValue.dbValue;
                vmo.props.DefaultValue.valueUpdated = false;
                vmoUpdated = true;
            }
        } );

        if( vmoUpdated ) {
            eventBus.publish( 'Awp0SavedQueryCriteriaTable.refreshTable' );
        }
    }
};

export let checkQueryClausesForSameDisplayName = ( dataProvider ) => {
    let hasDuplicateDisplayName = false;

    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        let displayNamesSet = new Set();
        hasDuplicateDisplayName = loadedVMOs.some( vmo => {
            if ( vmo.props.UserEntryName.dbValue === '' ) {
                return false;
            }

            if ( displayNamesSet.has( vmo.props.UserEntryName.dbValue ) ) {
                return true;
            }

            displayNamesSet.add( vmo.props.UserEntryName.dbValue );
            return false;
        } );
    }

    return hasDuplicateDisplayName;
};

export let updateSearchStateDataProvider = ( searchState, dataProvider ) => {
    let newSearchState = searchState ? { ...searchState.getValue() } : {};
    newSearchState.queryBuilderCriteriaTableDataProvider = dataProvider;
    searchState.update( newSearchState );
};

export let checkQueryForPeriodInLocalizationKey = ( dataProvider ) => {
    let hasPeriodInLocalizationKey = false;

    let vmc = dataProvider.viewModelCollection;
    let loadedVMOs = null;
    if( vmc ) {
        loadedVMOs = vmc.getLoadedViewModelObjects();
    }

    if( loadedVMOs && loadedVMOs.length !== 0 ) {
        hasPeriodInLocalizationKey = loadedVMOs.some( vmo => {
            return vmo.props.UserEntryKey.dbValue.includes( '.' );
        } );
    }

    return hasPeriodInLocalizationKey;
};

const AwSavedQueryCriteriaTableService = {
    loadTableData,
    clearSelections,
    updateContextWithInitialVMOs,
    deleteClause,
    reloadInitialVMOs,
    setEditModeOnVMOs,
    saveCriteriaTableEdits,
    updateEditModeValue,
    updateUserEntryName,
    addClauseToTable,
    updateDefaultValueEditable,
    getClausesForSave,
    clearCriteriaTable,
    updateDefaultValueBoolean,
    checkQueryClausesForSameDisplayName,
    updateSearchStateDataProvider,
    checkQueryForPeriodInLocalizationKey
};

export default AwSavedQueryCriteriaTableService;
