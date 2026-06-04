// Copyright (c) 2023 Siemens

/**
 * @module js/scheduleNavigationTreeCellRenderingService
 */

import _ from 'lodash';
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import tableSvc from 'js/splmTablePublishedService';

let exports;

/**
 * This method will return true if logged in user is what if reviewer else false.
 * @param {*} scheduleObject - Schedule Object
 * @param {*} userUid - Logged in user uid
 * @returns true / false based on what if reviewer of logged in user
 */
let isWhatIfReviewer = ( scheduleObject, userUid ) => {
    let scheduleNavigationCtx = appCtxSvc.getCtx( 'scheduleNavigationCtx' );
    if( !scheduleNavigationCtx ) {
        return false;
    }

    if( !scheduleNavigationCtx.scheduleUidToReviewerMap ) {
        scheduleNavigationCtx.scheduleUidToReviewerMap = {};
    }

    if( !( scheduleObject.uid in scheduleNavigationCtx.scheduleUidToReviewerMap ) ) {
        scheduleNavigationCtx.scheduleUidToReviewerMap[scheduleObject.uid] = false;
        _.get( scheduleObject, 'props.saw1ScheduleMembers.dbValues', [] ).forEach( ( memberUid ) => {
            let memberObj = cdm.getObject( memberUid );
            if( memberObj.props.resource_tag.dbValues[0] === userUid && parseInt( memberObj.props.fnd0SecondaryPriv.dbValues[0] ) === 1 ) {
                scheduleNavigationCtx.scheduleUidToReviewerMap[scheduleObject.uid] = true;
                return true;
            }
        } );
    }
    return scheduleNavigationCtx.scheduleUidToReviewerMap[scheduleObject.uid];
};

/**
 * This method is used for creating customize cell commands of tree navigation column
 *
 * @param {Object} column - column Definition
 * @param {Object} vmo - View model object
 * @param {DOMElement} tableElem - table DOMElement as context
 * @returns {DOMElement} cellContent - tree cell command Element
 */
export let createTreeCellCommandElement = ( column, vmo, tableElem ) => {
    let scheduleObject;
    let cellContent = tableSvc.createTreeCellCommandElement( column, vmo, tableElem );
    let modelObject = cdm.getObject( vmo.uid );
    let userContext = appCtxSvc.getCtx( 'user' );
    let isScheduleTask = cmm.isInstanceOf( 'ScheduleTask', modelObject.modelType );
    let isProxyTask = cmm.isInstanceOf( 'Fnd0ProxyTask', modelObject.modelType );
    // cell customization applied only for objects of which type either ScheduleTask or Fnd0ProxyTask
    if( isScheduleTask ) {
        scheduleObject = cdm.getObject( modelObject.props.schedule_tag.dbValues[ 0 ] );
    } else if( isProxyTask ) {
        scheduleObject = cdm.getObject( modelObject.props.fnd0schedule_tag.dbValues[ 0 ] );
    }

    let scheduleObjExist = scheduleObject && scheduleObject.props;
    if(scheduleObjExist){
        let isScheduleLocked = !_.isEmpty( scheduleObject.props.fnd0Schmgt_Lock.dbValues[ 0 ] );
        if( scheduleObjExist &&  isScheduleLocked && ( scheduleObject.props.fnd0Schmgt_Lock.dbValues[ 0 ] === userContext.uid || isWhatIfReviewer( scheduleObject, userContext.uid ) ) ) {
            let cellText = cellContent.getElementsByClassName( 'aw-splm-tableCellText' )[ 0 ];
            if( isNewTaskCreatedInWhatIfMode( modelObject ) && cellText ) {
                cellText.classList.add( 'aw-schedulemanager-taskAddedInWhatIfMode' );
            } else if( isTaskModifiedInWhatIfMode( modelObject ) && cellText ) {
                cellText.classList.add( 'aw-schedulemanager-taskModifiedInWhatIfMode' );
            }
        }
    }
    return cellContent;
};

/**
 * This method is used to update the whatIf properties after promoting changes
 * NOTE: This function is to load the 'fnd0Schmgt_Lock' of subschedules, as they are not loaded during Promote/Cancel changes
 * operation. This is fixed in TC13.2 and the below function can be removed when the minimum platform version is TC13.2.
 */
export let updateWhatIfProperties = () => {
    eventBus.publish( 'scheduleNavigationTree.plTable.clientRefresh' );
};

/**
 * Check if new task created in what If mode
 *
 * @param {Object} modelObject the model object
 * @return {Boolean} true or false
 */
let isNewTaskCreatedInWhatIfMode = function( modelObject ) {
    return modelObject && modelObject.props && modelObject.props.fnd0WhatIfMode && modelObject.props.fnd0WhatIfMode.dbValues[ 0 ] ===
        '1';
};

/**
 * Check if properties of existing task updated in what If mode
 *
 * @param {Object} modelObject the model object
 * @return {Boolean} true or false
 */
let isTaskModifiedInWhatIfMode = function( modelObject ) {
    return modelObject && modelObject.props && modelObject.props.fnd0WhatIfData && modelObject.props.fnd0WhatIfData.dbValues.length > 0;
};

exports = {
    createTreeCellCommandElement,
    updateWhatIfProperties
};

export default exports;
