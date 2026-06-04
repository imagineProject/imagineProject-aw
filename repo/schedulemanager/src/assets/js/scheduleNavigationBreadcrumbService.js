// Copyright (c) 2024 Siemens

/**
 *
 * @module js/scheduleNavigationBreadcrumbService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import AwStateService from 'js/awStateService';
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import selectionService from 'js/selection.service';
import viewModeService from 'js/viewMode.service';
import viewModelObjectService from 'js/viewModelObjectService';
import { getEvaluatedId } from 'js/uwUtilService';                                                           
import { isTreeMode } from 'js/objectNavigationService';
import { syncURLWithNewParams } from 'js/selectionSyncUtils';
import { updateParentHierarchyInURL } from 'js/objectNavigationTreeService';

var exports = {};

/**
 * Helper function to get context and set selection
 * @param {Object} searchContext - searchContext
 * @param {Object} changedParams - changed state params
 * @param {Object} selectionModel - selectionModel
 * @return {Promise} Promise
 */
const getSearchContext = ( searchContext = {}, changedParams, selectionModel ) => {
    searchContext.criteria = searchContext.criteria || {};
    searchContext.criteria.objectSet = 'contents.WorkspaceObject';
    searchContext.criteria.parentUid = changedParams.uid;
    searchContext.criteria.returnTargetObjs = 'true';

    const currentSelection = selectionModel.getSelection();
    const hasChangedCUid = changedParams.c_uid && currentSelection.length > 0 && currentSelection[0] !== changedParams.c_uid;
    if ( hasChangedCUid ) {
        const newSelection = changedParams.c_uid.split( ',' )[0];
        selectionModel.setSelection( newSelection );
    } else if ( !changedParams.c_uid && currentSelection.length <= 1 ) {
        // If c_uid is undefined and no multi-selection clear the selection
        selectionModel.setSelection( [] );
    }

    return Promise.resolve( searchContext );
};

/**
 * Helper function to create base crumb
 * @param {Object} baseSelection - base selection or opened object
 * @param {Object} objNavState - objNavState
 * @param {Boolean} selectedCrumb true if its the last crumb
 * @return {Object} aw crumb
 */
const createBaseCrumb = async( baseSelection, objNavState, selectedCrumb ) => {
    return {
        clicked: false,
        displayName: baseSelection.props.object_string.dbValues[0],
        index: 0,
        onCrumbClick: ( crumb ) => onCrumbSelection( crumb, objNavState ),
        scopedUid: baseSelection.uid,
        selectedCrumb: selectedCrumb,
        showArrow: true,
        primaryCrumb: true
    };
};

/**
 * Helper function to create intermediate crumb
 * @param {Object} intermediateObj - intermediate object
 * @param {Object} objNavState - objNavState
 * @param {Object} intermediateAltIds - alternate Ids
 * @return {Object} aw crumb
 */
const createIntermediateCrumb = async( intermediateObj, objNavState, intermediateAltIds ) => {
    return {
        clicked: false,
        displayName: intermediateObj.props.object_string.dbValues[0],
        index: 1,
        onCrumbClick: ( crumb ) => onCrumbSelection( crumb, objNavState ),
        scopedAlternateId: intermediateAltIds,
        scopedUid: intermediateObj.uid,
        selectedCrumb: false,
        showArrow: true
    };
};

/**
 * Helper function to create last crumb
 * @param {Object} selectedObjects - selected objects
 * @param {Object} index - index
 * @param {Object} alternateIds - alternate Ids
 * @param {Object} objNavState - objNavState
 * @return {Object} aw crumb
 */
const createLastCrumb = async( selectedObjects, index, alternateIds, objNavState ) => {
    if( selectedObjects.length > 1 ) {
        let nSelectedLabel = await localeService.getLocalizedText( 'UIMessages', 'Selected' );
        return {
            clicked: false,
            displayName: selectedObjects.length + ' ' + nSelectedLabel,
            index: index,
            selectedCrumb: true,
            showArrow: false
        };
    }
    return {
        clicked: false,
        displayName: selectedObjects[0].props.object_string.dbValues[0],
        index: index,
        onCrumbClick: ( crumb ) => onCrumbSelection( crumb, objNavState ),
        scopedAlternateId: alternateIds,
        scopedUid: selectedObjects[0].uid,
        selectedCrumb: true,
        showArrow: true
    };
};

/**
 * Helper function to get selection hierarchy
 * @param {Object} object - selected object
 * @return {Object} selection hierarchy and alternate Ids for selected object
 */
const getSelectionHierarchy = async( object ) => {
    let parentObj = object;
    let alternateIds = object.uid;
    while ( parentObj && parentObj.props.fnd0ParentTask && parentObj.props.fnd0ParentTask.dbValues && parentObj.props.fnd0ParentTask.dbValues[0] ) {
        alternateIds += ',' + parentObj.props.fnd0ParentTask.dbValues[0];
        parentObj = cdm.getObject( parentObj.props.fnd0ParentTask.dbValues[0] );
    }

    let selectionHierarchy = alternateIds.split( ',' );
    return {
        selectionHierarchy: selectionHierarchy.reverse(),
        alternateIds: alternateIds
    };
};

/**
 * This method is used to build array of aw crumbs
 * @param {Array} selectedObjects - array of selected objects
 * @param {Object} baseSelection - base selection or opened object
 * @param {Object} objNavState - objNavState
 * @returns {Array} array of crumbs
 * */
export let createCrumbs = async function( selectedObjects = [], baseSelection, objNavState ) {
    let crumbs = [];
    if ( selectedObjects.length === 0 ) {
        let baseCrumb = await createBaseCrumb( baseSelection, objNavState, true );
        crumbs.push( baseCrumb );
    } else if ( selectedObjects.length === 1 ) {
        let baseCrumb = await createBaseCrumb( baseSelection, objNavState, false );
        crumbs.push( baseCrumb );

        // Start iterating through parent tasks if any
        let selectionHierarchy = ( await getSelectionHierarchy( selectedObjects[0] ) ).selectionHierarchy;
        let alternateIds = ( await getSelectionHierarchy( selectedObjects[0] ) ).alternateIds;

        for( let idx = 0; idx < selectionHierarchy.length - 1; idx++ ) {
            let intermediateAltIds = selectionHierarchy[idx];
            let intermediateObj = cdm.getObject( selectionHierarchy[idx] );

            while ( intermediateObj && intermediateObj.props.fnd0ParentTask && intermediateObj.props.fnd0ParentTask.dbValues && intermediateObj.props.fnd0ParentTask.dbValues[0] ) {
                intermediateAltIds += ',' + intermediateObj.props.fnd0ParentTask.dbValues[0];
                intermediateObj = cdm.getObject( intermediateObj.props.fnd0ParentTask.dbValues[0] );
            }

            /* eslint-disable no-await-in-loop */
            if( selectionHierarchy[idx] !== baseSelection.uid && selectionHierarchy[idx] !== baseSelection.props.fnd0SummaryTask.dbValues[0] && selectionHierarchy[idx] !== selectedObjects[0].uid ) {
                let intermediateCrumb = await createIntermediateCrumb( cdm.getObject( selectionHierarchy[idx] ), objNavState, intermediateAltIds );
                crumbs.push( intermediateCrumb );
            }
        }

        let lastCrumb = await createLastCrumb( selectedObjects, selectionHierarchy.length - 1, alternateIds, objNavState );
        crumbs.push( lastCrumb );
    } else {
        let baseCrumb = await createBaseCrumb( baseSelection, objNavState, false );
        crumbs.push( baseCrumb );

        let isIntermediateCrumbNeeded = false;
        let firstObjectWithParentNodeUid = selectedObjects.find( obj => obj.parentNodeUid );
        if ( firstObjectWithParentNodeUid ) {
            var firstParentNodeUid = firstObjectWithParentNodeUid.parentNodeUid;
            isIntermediateCrumbNeeded = !selectedObjects.some( obj => obj.parentNodeUid && obj.parentNodeUid !== firstParentNodeUid ) && firstParentNodeUid !== baseSelection.uid;
        }

        if ( isIntermediateCrumbNeeded ) {
            // Start iterating through parent tasks if any
            let selectionHierarchy = ( await getSelectionHierarchy( cdm.getObject( firstParentNodeUid ) ) ).selectionHierarchy;

            for( let idx = 0; idx < selectionHierarchy.length; idx++ ) {
                let intermediateAltIds = selectionHierarchy[idx];
                let intermediateObj = cdm.getObject( selectionHierarchy[idx] );

                while ( intermediateObj && intermediateObj.props.fnd0ParentTask && intermediateObj.props.fnd0ParentTask.dbValues && intermediateObj.props.fnd0ParentTask.dbValues[0] ) {
                    intermediateAltIds += ',' + intermediateObj.props.fnd0ParentTask.dbValues[0];
                    intermediateObj = cdm.getObject( intermediateObj.props.fnd0ParentTask.dbValues[0] );
                }

                /* eslint-disable no-await-in-loop */
                if( selectionHierarchy[idx] !== baseSelection.uid && selectionHierarchy[idx] !== baseSelection.props.fnd0SummaryTask.dbValues[0] ) {
                    let intermediateCrumb = await createIntermediateCrumb( cdm.getObject( selectionHierarchy[idx] ), objNavState, intermediateAltIds );
                    crumbs.push( intermediateCrumb );
                }
            }

            let nSelectedCrumb = await createLastCrumb( selectedObjects, selectionHierarchy.length - 1 );
            crumbs.push( nSelectedCrumb );
        } else {
            let nSelectedCrumb = await createLastCrumb( selectedObjects, 1 );
            crumbs.push( nSelectedCrumb );
        }
    }

    return crumbs;
};

/**
  * This method handles selection of breadcrumbs
  * @param {Object} crumb - selected crumb
  * @param {Object} objNavState - objNavState
  */
export const onCrumbSelection = function( crumb, objNavState ) {
    const stateSvc = AwStateService.instance;
    const navigationParams = crumb.scopedUid === objNavState.baseSelection.uid ? { uid: crumb.scopedUid, c_uid: null } : { c_uid: crumb.scopedUid };
    const newState = { params: navigationParams };
    appCtxService.updateCtx( 'state', newState );
    stateSvc.go( stateSvc.current.name, navigationParams );
    if( objNavState.pwaSelection.length > 1 ) {
        stateSvc.reload();
    }
};

/**
  * This method is used to update state params according to selection and sync the url with updated params
  * @param {Object} selectedObjects - selected objects
  * @param {String} selectionQueryParamKey - selectionQueryParamKey
  * @param {Object} baseSelection - base selection or opened object
  */
export const getSelectionParamsToSyncInObjectNav = ( selectedObjects, selectionQueryParamKey = 'c_uid', baseSelection ) => {
    let newParams = {};
    let selectedUids = selectedObjects.map( selectionObj => getEvaluatedId( selectionObj ) );
    let currentViewMode = viewModeService.getViewMode();
    // If a single plan object is selected update c_uid
    if( selectedUids.length === 1 ) {
        newParams[ selectionQueryParamKey ] = selectedUids[ 0 ];
    } else if( selectedUids.length === 0 ) {
        // If nothing is selected use base selection
        newParams[ selectionQueryParamKey ] = '';
        newParams = updateParentHierarchyInURL( currentViewMode, baseSelection, newParams );
    } else {
        // Otherwise clear parameter
        newParams[ selectionQueryParamKey ] = null;
        newParams = updateParentHierarchyInURL( currentViewMode, baseSelection, newParams );
    }
    syncURLWithNewParams( newParams );
};

/**
  * This method is used to get updated context after change in state params
  * @param {Object} localSubPanelContext - sublocation data
  * @param {Object} baseSelection - base selection or opened object
  * @param {Object} selectionModel - selectionModel
  * @param {Object} objNavStateAtomicDataRef - atomicDataRef of objNavState
  * @param {Object} objNavStateUpdater - updateAtomicData
  * @returns {Object} updated context after state change
  */
export const getUpdatedSearchContextOnStateChange = async( localSubPanelContext, baseSelection, selectionModel, objNavStateAtomicDataRef, objNavStateUpdater ) => {
    let oldStateContext = null;
    let newStateContext = null;
    let changedParams = AwStateService.instance.params;

    if( localSubPanelContext.searchContext !== null ) {
        oldStateContext = _.cloneDeep( localSubPanelContext.searchContext );
        return getSearchContext( localSubPanelContext.searchContext, changedParams, selectionModel ).then( function( updatedSearchContext ) {
            newStateContext = _.cloneDeep( updatedSearchContext );
            // return the changed search context for objectNav to re-render
            let hasContextChanged = !_.isEqual( oldStateContext, newStateContext );
            if( hasContextChanged ) {
                localSubPanelContext.searchContext = newStateContext;
                localSubPanelContext.baseSelection = !isTreeMode() ? viewModelObjectService.createViewModelObject( newStateContext.criteria.parentUid ) : baseSelection;
                let objNavState = objNavStateAtomicDataRef.getAtomicData();
                let newBaseSelection = localSubPanelContext.baseSelection;
                if( !objNavState.baseSelection || objNavState.baseSelection.uid !== newBaseSelection.uid ) {
                    objNavStateUpdater.objNavState( { ...objNavState, baseSelection: newBaseSelection } );
                    selectionService.updateSelection( [ newBaseSelection ], newBaseSelection );
                }
                return {
                    localSubPanelContext: localSubPanelContext,
                    objNavContextChanged: true,
                    changeInParams: changedParams
                };
            }
            return {
                localSubPanelContext: localSubPanelContext,
                objNavContextChanged: false,
                changeInParams: changedParams
            };
        } );
    }
    return {
        localSubPanelContext: localSubPanelContext,
        objNavContextChanged: false,
        changeInParams: changedParams
    };
};

/**
  * This method is used to handle selection from breadcrumb chevron popup list
  * @param {Object} selectedObj - selected object from chevron popup list
  * @param {Object} chevronPopup - chevronPopup
  */
export let onChevronObjectSelection = function( selectedObj, chevronPopup ) {
    if( selectedObj ) {
        let stateSvc = AwStateService.instance;
        let navigationParams = {
            c_uid : selectedObj.uid
        };
        let newState = {
            params: navigationParams
        };
        appCtxService.updateCtx( 'state', newState );
        stateSvc.go( stateSvc.current.name, navigationParams );
        if( chevronPopup ) {
            chevronPopup.hide();
        }
    }
};

/**
  * This method is used to get parent task uid and top schedule task uid to fetch children after clicking chevron
  * @param {Object} selectedCrumb - crumb whose chevron has been clicked
  * @returns {Object} parentTaskUid and topScheduleUid
  */
export const getSearchCriteriaUids = function( selectedCrumb ) {
    let parentTaskUid = '';
    let topScheduleUid = '';
    let selectionHierarchy = selectedCrumb.scopedAlternateId ? selectedCrumb.scopedAlternateId.split( ',' ) : null;
    if( selectionHierarchy ) {
        selectionHierarchy.reverse();
        topScheduleUid = cdm.getObject( selectionHierarchy[0] ).props.schedule_tag.dbValues[0];
        parentTaskUid = selectedCrumb.scopedUid;
    } else {
        topScheduleUid = selectedCrumb.scopedUid;
    }

    return {
        parentTaskUid: parentTaskUid,
        topScheduleUid: topScheduleUid
    };
};

exports = {
    createCrumbs,
    getSelectionParamsToSyncInObjectNav,
    getUpdatedSearchContextOnStateChange,
    onCrumbSelection,
    onChevronObjectSelection,
    getSearchCriteriaUids
};
export default exports;
