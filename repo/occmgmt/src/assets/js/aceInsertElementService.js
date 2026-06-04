// Copyright (c) 2022 Siemens

/**
 * @module js/aceInsertElementService
 */
import appCtxService from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import localeService from 'js/localeService';
import _ from 'lodash';
import addElemService from 'js/aceAddElementService';
import cdm from 'soa/kernel/clientDataModel';
import occStructureEditSvc from 'js/aceStructureEditService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};

/**
 * Get the localized value from a given key.
 * @param {String} key: The key for which the value needs to be extracted.
 * @return {String} localized string for the input key.
 */
function getLocalizedValueFromKey( key ) {
    var resource = 'OccurrenceManagementConstants';
    var localTextBundle = localeService.getLoadedText( resource );
    return localTextBundle[ key ];
}

/**
 * Populate input for addElement.elementsAdded event, to be called for inserted element added under current parent
 * @param {DeclViewModel} insertElementResponse - Insert element response
 */
function populateElementToBeAddedUnderCurrentParent( insertElementResponse ) {
    //populate addElementResponse for old parent -> don't add newElementInfo
    var oldParentElement = cdm.getObject( appCtxService.ctx.aceActiveContext.context.insertLevelInput.currentParentElement );
    var selectedNewElementInfoForOldParent = {};
    var selectedNewElementInfos = [];
    selectedNewElementInfoForOldParent.newElements = [ insertElementResponse.newParent ];
    var parentElemsInResponse = insertElementResponse.childOccurrencesInfo[0];
    var childOccurences = insertElementResponse.childOccurrencesInfo[1];
    var parentIdx = _.findLastIndex( parentElemsInResponse, function( parentElem ) {
        return parentElem.uid === appCtxService.ctx.aceActiveContext.context.insertLevelInput.currentParentElement;
    } );
    selectedNewElementInfoForOldParent.pagedOccurrencesInfo = {
        childOccurrences: childOccurences[parentIdx]
    };

    selectedNewElementInfos.push( selectedNewElementInfoForOldParent );
    var addElementResponseForOldParent =  {
        selectedNewElementInfos: selectedNewElementInfos,
        ServiceData: insertElementResponse.ServiceData
    };
    return { oldParentElement, addElementResponseForOldParent };
}

/**
 * Populate input for addElement.elementsAdded event, to be called for selected elements added under inserted parent
 * @param {DeclViewModel} insertElementResponse - Insert element response
 */
function populateElementsToBeAddedUnderNewParent( insertElementResponse ) {
    //populate addElementResponse for new parents -> also add newElementInfo
    var newParent =  insertElementResponse.newParent;
    var selectedNewElementInfos = [];
    var selectedNewElementInfoForNewParent = {
        newElements:[]
    };
    var parentElemsInResponse = insertElementResponse.childOccurrencesInfo[0];
    var childOccurences = insertElementResponse.childOccurrencesInfo[1];
    var childInx = _.findLastIndex( parentElemsInResponse, function( parentElem ) {
        return parentElem.uid === insertElementResponse.newParent.uid;
    } );
    selectedNewElementInfoForNewParent.pagedOccurrencesInfo = {
        childOccurrences: childOccurences[childInx]
    };

    for( var inx = 0; inx < insertElementResponse.ServiceData.created.length; inx++ ) {
        var childOccInx = _.findLastIndex( childOccurences[childInx], function( childOccurrence ) {
            return childOccurrence.occurrenceId === insertElementResponse.ServiceData.created[inx];
        } );
        if( childOccInx > -1 ) {
            var newElement = cdm.getObject( insertElementResponse.ServiceData.created[inx] );
            selectedNewElementInfoForNewParent.newElements.push( newElement );
        }
    }
    selectedNewElementInfos.push( selectedNewElementInfoForNewParent );
    var addElementResponseForNewParent = {
        selectedNewElementInfos: selectedNewElementInfos,
        newElementInfos: insertElementResponse.newElementInfos,
        ServiceData: insertElementResponse.ServiceData
    };
    return { newParent, addElementResponseForNewParent };
}

/**
 * Populate table data for selectedElements table
 * @return {Object} loadResult - table data
 */
export let loadInsertLevelTableData = function() {
    var rowLength = appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements.length;
    var vmRows = [];
    for( var rowIndx = 0; rowIndx < rowLength; rowIndx++ ) {
        var currentSelection = appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements[rowIndx];
        var dbValue = currentSelection.props.object_string.dbValues[ 0 ];
        var displayValues = [ dbValue ];
        var localizedName = getLocalizedValueFromKey( 'Name' );
        var vmProp = uwPropertyService.createViewModelProperty( 'Name', localizedName, 'OBJECT', dbValue, displayValues );
        var constMap = {
            ReferencedTypeName: 'ItemRevision'
        };
        var propApi = {
            showAddObject: false
        };
        vmProp.propertyDescriptor = {
            displayName: localizedName,
            constantsMap: constMap
        };
        vmProp.propApi = propApi;
        vmProp.isEditable = true;
        vmProp.editableInViewModel = true;
        var vmRow = {};
        vmRow.props = {};
        vmRow.props.Name = vmProp;
        vmRow.editableInViewModel = true;
        vmRow.isModifiable = true;
        vmRow.editableInViewModel = true;
        vmRow.typeIconURL = currentSelection.typeIconURL;
        uwPropertyService.setEditable( vmRow.props.Name, true );
        uwPropertyService.setEditState( vmRow, true );
        vmRows.push( vmRow );
    }
    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmRows.length );
    loadResult.selectedElems = vmRows;
    loadResult.totalSelectedElems = vmRows.length;
    return loadResult;
};

/**
 * Populate allowed types information for selected elements for insert level operation
 * @param {Object} response - getInfoForInsertLevel SOA Response
 */
export let extractAllowedTypesInfoFromResponse = function( response ) {
    if ( response.preferredTypeInfo ) {
        response.preferredExists = true;
    }
    var allowedTypesInfo = addElemService.extractAllowedTypesInfoFromResponse( response );
    if ( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput.allowedTypesInfo', allowedTypesInfo );
    } else {
        var insertLevelInput = {
            allowedTypesInfo: allowedTypesInfo
        };
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', insertLevelInput );
    }
};

/**
 * Populate insert level input information and store in context
 * @return {Object} selectedElements - selected elements to be sent as input to getInfoForInsertLevel SOA
 */
export let populateInsertLevelInputInformation = function( occContext ) {
    var selectedElements = occContext.pwaSelection;

    var insertLevelInput = {};

    insertLevelInput.selectedElements = [];
    _.forEach( selectedElements, function( pwaSelection ) {
        var selectedVMO = viewModelObjectService.createViewModelObject( pwaSelection.uid );
        insertLevelInput.selectedElements.push( selectedVMO );
    } );

    insertLevelInput.currentParentElement = selectedElements[0].props.awb0Parent.dbValues[0];
    appCtxService.ctx.aceActiveContext = appCtxService.ctx.aceActiveContext || {
        context: {}
    };
    appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', insertLevelInput );
    return insertLevelInput.selectedElements;
};

/**
 * Delete insert level input from context once Insert level panel is closed
 */
export let clearInsertLevelInputFromCtx = function() {
    if( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', undefined );
    }
};

/**
 * Populate input for addElement.elementsAdded event
 * @param {DeclViewModel} insertElementResponse - Insert element response
 */
export let elementsInserted = function( insertElementResponse ) {
    if( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        //1. populate addElementResponse for old parent -> don't add newElementInfo
        var addUnderCurrentParent = populateElementToBeAddedUnderCurrentParent( insertElementResponse );

        //2. populate addElementResponse for new parents -> also add newElementInfo
        var addUnderNewParent = populateElementsToBeAddedUnderNewParent( insertElementResponse );
        return { ...addUnderCurrentParent, ...addUnderNewParent };
    }
};

/**
 * Populate input for insertLevel SOA
 * @param {DeclViewModel} data - AceInsertLevelSubPanelViewModel
 * @return {Object} objectToBeInserted - object to be inserted as parent for the selected elements
 */
export let getParentElementToInsertLevel = function( data, createdObject, sourceObjects ) {
    if ( Array.isArray( createdObject ) ) {
        return cdm.getObject( createdObject[ 0 ].props.items_tag.dbValues[ 0 ] );
    } else if ( createdObject ) {
        return cdm.getObject( createdObject.props.items_tag.dbValues[ 0 ] );
    }
    return sourceObjects[0];
};

export let initInsertLevelSubPanel = function( data ) {
    let selectedElementsString = data.i18n.objectsString;
    if( appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements.length > 1 ) {
        selectedElementsString = selectedElementsString.replace( '{0}', appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements.length );
    } else {
        selectedElementsString = appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements[0].props.object_string.uiValues[0];
    }
    return selectedElementsString;
};

/**
 * Insert Element service
 */
export default exports = {
    loadInsertLevelTableData,
    extractAllowedTypesInfoFromResponse,
    populateInsertLevelInputInformation,
    clearInsertLevelInputFromCtx,
    elementsInserted,
    getParentElementToInsertLevel,
    initInsertLevelSubPanel
};
