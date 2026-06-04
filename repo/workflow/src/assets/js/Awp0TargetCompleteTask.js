// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0TargetCompleteTask
 */
import awp0PerformTaskSvc from 'js/Awp0PerformTask';
import cdmService from 'soa/kernel/clientDataModel';
import adapterSvc from 'js/adapterService';
import dmSvc from 'soa/dataManagementService';
import _ from 'lodash';
import listBoxService from 'js/listBoxService';
import viewModelObjectService from 'js/viewModelObjectService';

/**
 * Define public API
 */
var exports = {};

/**
 * Populate the peform panel in secondary work area based on validation like task can be performed by me or not
 * @param {Object} data - the data Object
 * @param {Object} selection - the current selection object
 * @returns {Object} details of task whose perform view has to show
 */
export let populateSecondaryPanel = function( data, selection ) {
    if( selection !== null ) {
        // Get the correct adapter object. When user open item revision in content tab and goes to workflow tab
        // then also we need to show this table in workflow page. So to address this we need to get adapted object.
        return adapterSvc.getAdaptedObjects( [ selection ] ).then( function( adaptedObjs ) {
            var modelObject = null;
            if( adaptedObjs && adaptedObjs.length > 0  && adaptedObjs[0] ) {
                selection = adaptedObjs[0];
                if( selection.props.fnd0MyWorkflowTasks && selection.props.fnd0MyWorkflowTasks.dbValues &&
                    selection.props.fnd0MyWorkflowTasks.dbValues.length > 0 ) {
                    modelObject = cdmService.getObject( selection.props.fnd0MyWorkflowTasks.dbValues[ 0 ] );
                }
                if( modelObject ) {
                    return awp0PerformTaskSvc.loadObjectProperties( data, modelObject ).then( function( { isTaskPerformable, taskToPerform, activePerformTaskPanelId } ) {
                        return {
                            isTaskPerformable : isTaskPerformable,
                            taskToPerform: taskToPerform,
                            activePerformTaskPanelId: activePerformTaskPanelId
                        };
                    } );
                }
            }
        } );
    }
};

/**
 * Populate the peform panel in secondary work area based on validation like task can be performed by me or not
 * @param {Object} selectedJob - the current selected job from LOV.
 * @param {Object} data - the data Object
 * @param {Object} selectedItem - the current selection object whose overview tab we are seeing
 * @returns {Object} details of task perform view
 */
export let updateTaskPanel = function( selectedJob, data, selectedItem ) {
    if( selectedJob ) {
        var isLoadPropertiesNeed = false;
        var modelObjects = [];
        if( selectedItem && selectedItem.uid ) {
            selectedItem = cdmService.getObject( selectedItem.uid );
        }
        if ( selectedItem && selectedItem.props && selectedItem.props.fnd0MyWorkflowTasks ) {
            for( var i = 0; i < selectedItem.props.fnd0MyWorkflowTasks.dbValues.length; ++i ) {
                var modelObject = cdmService.getObject( selectedItem.props.fnd0MyWorkflowTasks.dbValues[ i ] );
                if( modelObject.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
                    modelObject = cdmService.getObject( modelObject.props.fnd0ParentTask.dbValues[ 0 ] );
                }

                //Get performance panel when you select job from breadcrumb
                if( modelObject && modelObject.props.parent_process && modelObject.props.parent_process.dbValues &&
                    modelObject.props.parent_process.dbValues[ 0 ] && ( modelObject.props.parent_process.dbValues[ 0 ] === selectedJob ||
                    modelObject.props.parent_process.dbValues[ 0 ] === selectedJob.uid ) ) {
                    isLoadPropertiesNeed = false;
                    return awp0PerformTaskSvc.loadObjectProperties( data, modelObject ).then( function( { isTaskPerformable, taskToPerform, activePerformTaskPanelId } ) {
                        return {
                            isTaskPerformable : isTaskPerformable,
                            taskToPerform: taskToPerform,
                            activePerformTaskPanelId: activePerformTaskPanelId
                        };
                    } );
                } else if( modelObject && !modelObject.props.parent_process ) {
                    isLoadPropertiesNeed = true;
                    // Above check is needed if properties needs to be loaded so that we can find out which job need
                    // to be shown here
                    modelObjects.push( modelObject );
                    break;
                }
            }
        }
        // Check if model objects are not empty and property load need to be done
        // then we need to make getProperties call first and then match the
        // task parent process to selected process from breadcrumb then load the panel
        // for that task
        if( modelObjects && modelObjects.length > 0 && isLoadPropertiesNeed ) {
            return dmSvc.getPropertiesUnchecked( modelObjects, [ 'parent_process' ] ).then( function() {
                isLoadPropertiesNeed = false;
                var validTaskObject = _.find( modelObjects, function( taskObject ) {
                    return taskObject.props.parent_process && taskObject.props.parent_process.dbValues
                    && ( taskObject.props.parent_process.dbValues[ 0 ] === selectedJob ||
                        taskObject.props.parent_process.dbValues[ 0 ] === selectedJob.uid );
                } );
                if( validTaskObject ) {
                    isLoadPropertiesNeed = false;
                    return awp0PerformTaskSvc.loadObjectProperties( data, validTaskObject ).then( function( { isTaskPerformable, taskToPerform, activePerformTaskPanelId } ) {
                        return {
                            isTaskPerformable : isTaskPerformable,
                            taskToPerform: taskToPerform,
                            activePerformTaskPanelId: activePerformTaskPanelId
                        };
                    } );
                }
            } );
        }

        //When user selects completed process in breadcrumb and want to update panel to shown nothing
        return {
            isTaskPerformable : false
        };
    }
};

/**
 * Get parent process of inout tasks and return list model objects
 * @param {Object} modelObjects - the tasks from fnd0MyWorkflowTasks propertyof selected object.
 * @returns {Object} list model objects.
 */
let _populateTaskWorkflowList = function( modelObjects ) {
    var jobObjects = [];
    _.forEach( modelObjects, function( modelObject ) {
        var updatedModelObject = cdmService.getObject( modelObject.uid );
        if( updatedModelObject && updatedModelObject.props && updatedModelObject.props.parent_process
            && updatedModelObject.props.parent_process.dbValues  ) {
            var jobObject = cdmService.getObject( updatedModelObject.props.parent_process.dbValues[ 0 ] );
            if( jobObject ) {
                jobObjects.push( jobObject );
            }
        }
    } );
    jobObjects = listBoxService.createListModelObjects( jobObjects, 'props.object_string' );

    return jobObjects;
};


/**
 * Populate the peform panel in secondary work area based on property 'fnd0MyWorkflowTasks'
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @returns {Object} data objects with populated LOV values and latest Job.
 */
export let populateTargetPanelData = function( data, selection ) {
    if( selection ) {
        var modelObjectTemp = [];
        modelObjectTemp.push( cdmService.getObject( selection.uid ) );

        //Load property 'fnd0MyWorkflowTasks'
        return dmSvc.getPropertiesUnchecked( modelObjectTemp, [ 'fnd0MyWorkflowTasks' ] ).then( function() {
            // If selection is ModelObject/any object other than ViewModelObject, then reload it.
            // ACE/Change Content tab sets the selection as Object not ViewModelObject and this is not refreshed as part of SOA call.
            if( !viewModelObjectService.isViewModelObject( selection ) ) {
                selection = viewModelObjectService.constructViewModelObjectFromModelObject( cdmService.getObject( selection.uid ) );
            }
            return populateTaskToPerformTargetPanel( data, selection );
        } );
    }
};


/**
 * Populate the Task to peform panel in secondary work area
 * @param {object} data - the data Object
 * @param {object} selection - the current selection object
 * @returns {Object} data objects with populated LOV values and latest Job.
 */
let populateTaskToPerformTargetPanel = function( data, selection ) {
    var modelObjects = [];

    // This is mainly needed when user populate the list that time set it to false so that
    // if panel is already visible then it will be hidden first and then correct panel will be loaded

    if( selection && selection.props.fnd0MyWorkflowTasks && selection.props.fnd0MyWorkflowTasks.dbValues &&
                selection.props.fnd0MyWorkflowTasks.dbValues.length > 0 ) {
        _.forEach( selection.props.fnd0MyWorkflowTasks.dbValues, function( dbValue ) {
            var modelObject = cdmService.getObject( dbValue );
            if( modelObject ) {
                modelObjects.push( modelObject );
            }
        } );
    }

    if( modelObjects && modelObjects.length > 0 ) {
        return dmSvc.getPropertiesUnchecked( modelObjects, [ 'parent_process' ] ).then( function() {
            const workflowTasksList = _populateTaskWorkflowList( modelObjects );

            const newDataWorkflowTask = _.clone( data.workflowTask );
            const newDataWorkflowTasksLOV = _.clone( data.workflowTasksLOV );

            // Set current active task as selected process name
            if( workflowTasksList && workflowTasksList.length > 0 ) {
                // For Label
                newDataWorkflowTask.dbValue = workflowTasksList[ 0 ].propInternalValue;
                newDataWorkflowTask.uiValue = workflowTasksList[ 0 ].propDisplayValue;

                // For Lov
                newDataWorkflowTasksLOV.dbValue = workflowTasksList[ 0 ].propInternalValue;
                newDataWorkflowTasksLOV.uiValue = workflowTasksList[ 0 ].propDisplayValue;
            }

            return {
                workflowTask: newDataWorkflowTask,
                workflowTasksList: workflowTasksList,
                workflowTasksLOV: newDataWorkflowTasksLOV
            };
        } );
    }
};

export default exports = {
    populateSecondaryPanel,
    updateTaskPanel,
    populateTargetPanelData
};
