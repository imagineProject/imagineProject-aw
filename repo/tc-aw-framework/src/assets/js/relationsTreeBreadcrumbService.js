// Copyright (c) 2024 Siemens

/**
 * @module js/relationsTreeBreadcrumbService
 */
import cdm from 'soa/kernel/clientDataModel';
import adapterService from 'js/adapterService';

const getShortestHierarchy = ( selectedObjects = [] ) => {
    let selectionHierarchy = selectedObjects.map( obj => obj.alternateID.split( ',' ) );
    let sortedSelectionHierarchy = selectionHierarchy.sort( ( a, b ) => a.length - b.length );
    sortedSelectionHierarchy[0].splice( 0, 1 );
    return sortedSelectionHierarchy[0].join( ',' );
};

const getSelectionHierarchy = ( selectedObjects ) => {
    if ( selectedObjects.length > 1 ) {
        return getShortestHierarchy( selectedObjects );
    }
    return selectedObjects[0].alternateID || '';
};

/**
 * Retrive primary crumb
 *
 * @param {Object} baseSelection - The base selection object.
 * @param {number} selectedObjectsLength - The length of the selected objects array.
 * @return {Object} primary crumb object
 */
const getPrimaryCrumb = function( baseSelection, selectedObjectsLength, isTopNodeSelected ) {
    let displayName = baseSelection?.props?.object_string?.uiValues?.[ 0 ];
    return {
        clicked: false,
        displayName,
        selectedCrumb: selectedObjectsLength === 0 || isTopNodeSelected,
        showArrow: selectedObjectsLength > 0 && !isTopNodeSelected,
        primaryCrumb: true
    };
};

export const buildRelationsBreadcrumb = ( selectedString, selectedObjects = [], baseSelection = {} ) => {
    let provider = { crumbs: [ ] };
    let isTopNodeSelected = selectedObjects.length === 1 && selectedObjects[0].alternateID === baseSelection.uid;

    if( baseSelection.uid ) {
        provider.crumbs.push( getPrimaryCrumb( baseSelection, selectedObjects.length, isTopNodeSelected ) );
    }

    if ( selectedObjects.length === 0 || isTopNodeSelected ) {
        return provider;
    }

    let selectionHierarchy = getSelectionHierarchy( selectedObjects );
    let isMultiSelection = selectedObjects.length > 1;

    if ( selectionHierarchy ) {
        let hierarchy = selectionHierarchy.split( ',' ).reverse();
        provider.crumbs = provider.crumbs.concat( hierarchy.map( ( key, index ) => {
            let obj = adapterService.getAdaptedObjectsSync( [ cdm.getObject( key ) ] )[0];
            let isLeafCrumb = hierarchy.length - 1 === index;
            return {
                clicked: false,
                displayName: obj?.props?.object_string?.uiValues?.[0] || index,
                selectedCrumb: !isMultiSelection && isLeafCrumb,
                showArrow: isMultiSelection || !isLeafCrumb
            };
        } ) );
    }
    if ( isMultiSelection ) {
        let selectionCrumb = {
            clicked: false,
            displayName: selectedObjects.length + ' ' + selectedString,
            selectedCrumb: true,
            showArrow: false
        };
        provider.crumbs.push( selectionCrumb );
    }
    return provider;
};
