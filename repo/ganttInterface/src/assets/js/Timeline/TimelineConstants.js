// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Timeline/TimelineConstants
 */
var exports = {};

export let TIMELINE_SPLIT_SEARCH_CONTENT_TYPE = {
    eventDeliverables : 'Psi0EventPrgDel',
    eventChanges: 'Pec0EventChangeRelation',
    eventSchedules: 'Psi0EventScheduleRelation',
    eventRisks: 'Psi0EventRiskRelation',
    eventIssues: 'Psi0EventIssueRelation',
    eventOpportunities: 'Psi0EventOppRelation',
    eventCriteria: 'EventCriteria',
    eventChecklists: 'Psi0EventChecklistRelation',
    programDeliverables: 'Psi0PlanPrgDel',
    programChanges: 'Pch0PlanChangeRelation',
    programSchedules: 'Psi0PlanSchedule',
    programRisks: 'Psi0PlanRiskRelation',
    programIssues: 'Psi0PlanIssueRelation',
    programOpportunities: 'Psi0PlanOpportunityRelation'
};

export let TIMELINE_SPLIT_OTHER_SIDE_OBJECTS = {
    eventDeliverables : 'Item',
    eventChanges: 'ChangeNoticeRevision',
    eventSchedules: 'Schedule',
    eventRisks: 'Psi0ProgramRisk',
    eventIssues: 'Psi0ProgramIssue',
    eventOpportunities: 'Psi0ProgramOpp',
    eventCriteria: 'prg0AssociatedCriteria',
    eventChecklists: 'Psi0Checklist',
    programDeliverables: 'Item',
    programChanges: 'ChangeRequestRevision',
    programSchedules: 'Schedule',
    programRisks: 'Psi0ProgramRisk',
    programIssues: 'Psi0ProgramIssue',
    programOpportunities: 'Psi0ProgramOpp'
};

export let TIMELINE_SPLIT_XRT_PAGE_ID = {
    eventDeliverables : 'tc_xrt_Deliverables',
    eventChanges: 'tc_xrt_Changes',
    eventSchedules: 'tc_xrt_eventSchedules',
    eventRisks: 'tc_xrt_Risks',
    eventIssues: 'tc_xrt_Issues',
    eventOpportunities: 'tc_xrt_Opportunities',
    eventCriteria: 'tc_xrt_Criteria',
    eventChecklists: 'tc_xrt_Checklists',
    programDeliverables: 'tc_xrt_Deliverables',
    programChanges: 'tc_xrt_Changes',
    programSchedules: 'tc_xrt_eventSchedules',
    programRisks: 'tc_xrt_Risks',
    programIssues: 'tc_xrt_Issues',
    programOpportunities: 'tc_xrt_Opportunities'
};

export let TIMELINE_SPLIT_OBJECT_NAME_FOR_COL = {
    eventDeliverables : 'Psi0PrgDelRevision',
    eventChanges: 'ChangeNoticeRevision',
    eventSchedules: 'Schedule',
    eventRisks: 'Psi0ProgramRisk',
    eventIssues: 'Psi0ProgramIssue',
    eventOpportunities: 'Psi0ProgramOpp',
    eventCriteria: 'Prg0AbsCriteria',
    eventChecklists: 'Psi0Checklist',
    programDeliverables: 'Psi0PrgDelRevision',
    programChanges: 'ChangeRequestRevision',
    programSchedules: 'Schedule',
    programRisks: 'Psi0ProgramRisk',
    programIssues: 'Psi0ProgramIssue',
    programOpportunities: 'Psi0ProgramOpp'
};

export let TIMELINE_SPLIT_TYPE_FILTER_OBJECT = {
    eventDeliverables : 'Psi0PrgDelRevision,ItemRevision',
    eventChanges: 'ChangeNoticeRevision',
    eventSchedules: 'Schedule',
    eventRisks: 'Psi0ProgramRisk',
    eventIssues: 'Psi0ProgramIssue',
    eventOpportunities: 'Psi0ProgramOpp',
    eventCriteria: 'prg0AssociatedCriteria',
    eventChecklists: 'Psi0Checklist',
    programDeliverables: 'ItemRevision',
    programChanges: 'ChangeRequestRevision',
    programSchedules: 'Schedule',
    programRisks: 'Psi0ProgramRisk',
    programIssues: 'Psi0ProgramIssue',
    programOpportunities: 'Psi0ProgramOpp'
};

export default exports = {
    TIMELINE_SPLIT_SEARCH_CONTENT_TYPE,
    TIMELINE_SPLIT_OTHER_SIDE_OBJECTS,
    TIMELINE_SPLIT_XRT_PAGE_ID,
    TIMELINE_SPLIT_OBJECT_NAME_FOR_COL,
    TIMELINE_SPLIT_TYPE_FILTER_OBJECT
};
