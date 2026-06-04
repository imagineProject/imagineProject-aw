// Copyright (c) 2022 Siemens

/**
 * @module js/massUpdateService
 */
import appCtxSvc from 'js/appCtxService';
import editHandlerSvc from 'js/editHandlerService';
import listBoxService from 'js/listBoxService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import _ from 'lodash';

let exports = {};


/**
 * Processes the response of expandGRMRelationsForPrimary and returns list of secondary Objects
 *
 * @param {response}response response of expandGRMRelationsForPrimary
 * @returns {List} availableSecondaryObject return list of secondary objects
 */
let _processSecondaryObject = function( response ) {
    let availableSecondaryObject = [];
    if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
        for( let i in response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
            availableSecondaryObject[ i ] = response.output[ 0 ].relationshipData[ 0 ].relationshipObjects[ i ].otherSideObject;
        }
    }
    return availableSecondaryObject;
};

/**
 * Processes the response of expandGRMRelationsForPrimary and returns list of problem items
 *
 * @param {response}response response of expandGRMRelationsForPrimary
 * @returns {List} problemItemList returned will be shown in the dropdown
 */
export let processProblemItemList = function( response ) {
    let modelObjects = _processSecondaryObject( response );
    modelObjects.sort( ( pitem1, pitem2 )=>{
        let pname1 = pitem1.props.object_string.uiValues[0];
        let pname2 = pitem2.props.object_string.uiValues[0];
        if ( pname1 < pname2 ) {
            return -1;
        }
        if ( pname1 > pname2 ) {
            return 1;
        }
        return 0;
    } );
    let problemItemList = [];
    if( modelObjects && !_.isEmpty( modelObjects ) ) {
        // Create the list model object that will be displayed
        problemItemList = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
    }
    return problemItemList;
};

/**
 * Set selected/attached Problem Item in app context
 *
 * @param { IModelObject } data Item
 */
export let setProblemItem = function( data ) {
    // check if problem item on ctx still exists in the current problem item list
    // if not, then clear the problem item on ctx
    let currentProblemItem = appCtxSvc.getCtx( 'problemItem' );
    let flag = 0;
    if( currentProblemItem ) {
        if( data.problemItemList.length === 0 ) {
            clear();
        } else {
            for ( let i = 0; i < data.problemItemList.length; i++ ) {
                if ( data.problemItemList[i].propInternalValue.uid === currentProblemItem.uid ) {
                    flag = 1;
                    break;
                }
            }
            if( !flag ) {
                clear();
            }
        }
    }
    if( data.dropdownSelection.dbValue === null ) {
        currentProblemItem = appCtxSvc.getCtx( 'problemItem' );
        if( currentProblemItem ) {
            data.dropdownSelection.dbValue = currentProblemItem;
            data.dropdownSelection.uiValue = currentProblemItem.props.object_string.uiValue;
        } else if( data.problemItemList.length > 0 ) {
            data.dropdownSelection.dbValue = data.problemItemList[0].propInternalValue;
            data.dropdownSelection.uiValue = data.problemItemList[0].propDisplayValue;
        }
    }
    let problemItem;
    if ( data.dropdownSelection.dbValue ) {
        problemItem = viewModelObjectSvc.createViewModelObject( data.dropdownSelection.dbValue );
    }
    if( problemItem ) {
        problemItem.props.object_string.propertyLabelDisplay = 'NO_PROPERTY_LABEL';
    }
    if ( currentProblemItem ) {
        appCtxSvc.updateCtx( 'problemItem', problemItem );
    } else if ( problemItem ) {
        appCtxSvc.registerCtx( 'problemItem', problemItem );
    }
};

/**
 * Reset the value of link display value
 *
 * @param {data} data viewModel of view
 * @param { property } resetProp reseting to orignal values of prop
 */
export let clear = function() {
    let currentProblemItem = appCtxSvc.getCtx( 'problemItem' );
    if ( currentProblemItem ) {
        appCtxSvc.updateCtx( 'problemItem', undefined );
    } else {
        appCtxSvc.registerCtx( 'problemItem', undefined );
    }

    editHandlerSvc.cancelEdits();
};

export default exports = {
    processProblemItemList,
    setProblemItem,
    clear
};
