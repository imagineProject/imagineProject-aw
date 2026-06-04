// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1ScheduleCalendarService
 */

import cdm from 'soa/kernel/clientDataModel';

var exports = {};

/**
     * This method is used to get primary - schedule and secondary - schedule calendar from response.
     * @param {Object} response - the response of grm relation soa
     * @returns {Object} primary and secondary objects from the response
     */
export let processGRMResponse = function( response ) {
    let scheduleCalendar;
    let schedule = response.output[0].inputObject;
    if( response.output[0].relationshipData[0].relationshipObjects.length > 0 ) {
        scheduleCalendar = response.output[0].relationshipData[0].relationshipObjects[0].otherSideObject;
    }
    return {
        schedule: schedule,
        scheduleCalendar: scheduleCalendar
    };
};

/**
   * Get role of user in schedule
   * @param {Object} scheduleMemberUid - Schedule Member Uid
   * @return {Integer} role of member in schedule
   */
export let getRoleInSchedule = function( scheduleMemberUid ) {
    return cdm.getObject( scheduleMemberUid ).props.member_priv.dbValues[0];
};

exports = {
    processGRMResponse,
    getRoleInSchedule
};

export default exports;
