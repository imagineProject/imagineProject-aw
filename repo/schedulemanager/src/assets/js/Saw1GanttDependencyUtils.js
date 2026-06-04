// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1GanttDependencyUtils
 */
import cdm from 'soa/kernel/clientDataModel';
import uwPropertySvc from 'js/uwPropertyService';
import smConstants from 'js/ScheduleManagerConstants';
import ganttDataSource from 'js/Saw1SchGanttDataSource';
import appCtxSvc from 'js/appCtxService';
import schNavigationDepCacheService from 'js/ScheduleNavigationDependencyCacheService';

var exports = {};

export let updateTaskSuccDependency = function( updateDep ) {
    var newDispVal = getDependencyDisplayValue( updateDep, true );
    var succDeps = ganttDataSource.instance.getTaskSuccDependencies( updateDep.props.secondary_object.dbValues[0] );
    if( succDeps && succDeps.dependencyUids ) {
        for( let index = 0; index < succDeps.dependencyUids.length; index++ ) {
            const depUid = succDeps.dependencyUids[index];
            if( depUid === updateDep.uid ) {
                succDeps.displayValues[ index ] = newDispVal;
            }
        }
    }
};

export let updateTaskPredDependency = function( updateDep ) {
    var newDispVal = getDependencyDisplayValue( updateDep, false );
    var predDeps = ganttDataSource.instance.getTaskPredDependencies( updateDep.props.primary_object.dbValues[0] );
    if( predDeps && predDeps.dependencyUids ) {
        for( let index = 0; index < predDeps.dependencyUids.length; index++ ) {
            const depUid = predDeps.dependencyUids[index];
            if( depUid === updateDep.uid ) {
                predDeps.displayValues[ index ] = newDispVal;
            }
        }
    }
};

var getDependencyDisplayValue = function( updateDep, isSucc ) {
    let dispVal = '';
    let taskIndex = '';
    let taskUid = '';

    if( isSucc ) {
        taskUid = updateDep.props.primary_object.dbValues[0];
    } else {
        taskUid = updateDep.props.secondary_object.dbValues[0];
    }

    taskIndex = ganttDataSource.instance.getTaskIndex( taskUid );
    if( !taskIndex ) {
        let proxyTask = cdm.getObject( taskUid );
        if( proxyTask && proxyTask.modelType.typeHierarchyArray.indexOf( 'Fnd0ProxyTask' ) > -1 ) {
            taskIndex = ganttDataSource.instance.getTaskIndex( proxyTask.props.fnd0task_tag.dbValues[0] );
        }
    }

    if( taskIndex ) {
        let depType = updateDep.props.saw1DependencyType.dbValues[0];
        let lag = updateDep.props.saw1LagTime.dbValues[0];
        lag = lag.replace( '0d', '' );
        lag = lag.replace( '0h', '' );
        lag = lag.replace( '0', '' );
        if( lag && lag.indexOf( '-' ) < 0 ) {
            lag = '+' + lag;
        }
        dispVal = taskIndex + depType + lag;
    }
    return dispVal;
};

export let getViewModelPropertyForDependencyInfo = function( taskUid, propName ) {
    var propValues = [];
    var depInfo = null;
    if( propName === 'saw1Successors' ) {
        depInfo = ganttDataSource.instance.getTaskSuccDependencies( taskUid );
    }

    if( propName === 'saw1Predecessors' ) {
        depInfo = ganttDataSource.instance.getTaskPredDependencies( taskUid );
    }

    if( depInfo && depInfo.displayValues ) {
        propValues = depInfo.displayValues;
    }

    return uwPropertySvc.createViewModelProperty( propName, propName, 'STRING', propValues, propValues );
};

export let getTaskPredDependencies = function( taskUid ) {
    return ganttDataSource.instance.getTaskPredDependencies( taskUid );
};

export let getTaskSuccDependencies = function( taskUid ) {
    return ganttDataSource.instance.getTaskSuccDependencies( taskUid );
};

export let getTaskByIndex = function( taskIndex ) {
    return ganttDataSource.instance.getTaskByIndex( taskIndex );
};

/**
 * This will fetch the Task Data.
 */
export let regenerateDependencyIds = function() {
    let depInfos = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    var processedDependencies = []; //TO avoid duplicate
    schNavigationDepCacheService.registerMaps();
    var taskToPredMap = {};
    var taskToSuccMap = {};
    depInfos.forEach( function( depInfo ) {
        var depUid = depInfo.uid;
        var succTask = depInfo.secondaryUid;
        var predTask = depInfo.primaryUid;

        if( processedDependencies.indexOf( depUid ) < 0 ) {
            processedDependencies.push( depUid );
            if( !taskToPredMap[ predTask ] ) {
                taskToPredMap[ predTask ] = [];
            }

            if( !taskToSuccMap[ succTask ] ) {
                taskToSuccMap[ succTask ] = [];
            }

            taskToPredMap[ predTask ].push( depUid );
            taskToSuccMap[ succTask ].push( depUid );
        }
    } );

    for( let taskUid in taskToPredMap ) {
        var predDisplayValues = [];
        var predDbValues = [];
        var predDep = taskToPredMap[ taskUid ];
        getDependencyMapValues( predDep, predDbValues, predDisplayValues, false );
        if( predDbValues.length > 0 ) {
            schNavigationDepCacheService.addToTaskPredDependencyMap( taskUid, predDbValues, predDisplayValues );
        }
    }

    for( let taskUid in taskToSuccMap ) {
        var succDisplayValues = [];
        var succDbValues = [];
        var succDep = taskToSuccMap[ taskUid ];
        getDependencyMapValues( succDep, succDbValues, succDisplayValues, true );
        if( succDbValues.length > 0 ) {
            schNavigationDepCacheService.addToTaskSuccDependencyMap( taskUid, succDbValues, succDisplayValues );
        }
    }
};

var getDependencyMapValues = function( deps, dbValues, displayValues, isSuccDep ) {
    if( deps ) {
        deps.forEach( function( depUid ) {
            var depVMO = cdm.getObject( depUid );
            if( depVMO && depVMO.props.dependency_type ) {
                var depTypeString = getDependencyType( depVMO.props.dependency_type.dbValues[ 0 ] );
                var depLagString = '';
                var depLagInt = parseInt( depVMO.props.lag_time.dbValues[ 0 ] );
                if( depLagInt !== 0 ) {
                    var operator = '+';
                    depLagInt = depLagInt / 8 / 60;
                    if( depLagInt < 0 ) {
                        operator = '';
                    }
                    depLagString = operator + depLagInt + 'd';
                } else if( depTypeString === 'FS' ) {
                    depTypeString = '';
                }
                var taskUid = -1;
                if( isSuccDep ) {
                    taskUid = depVMO.props.primary_object.dbValues[ 0 ];
                } else {
                    taskUid = depVMO.props.secondary_object.dbValues[ 0 ];
                }

                var taskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                if( taskIndex ) {
                    var displayValue = taskIndex + depTypeString + depLagString;
                    if( displayValues.indexOf( displayValue ) < 0 ) {
                        displayValues.push( displayValue );
                        dbValues.push( depUid );
                    }
                }
            }
        } );
        if( displayValues && displayValues.length > 1 ) {
            displayValues.sort( function( a, b ) { return a - b; } );
        }
    }
};

export let getDependencyType = function( typeInt ) {
    var typeString = smConstants.DEPENDENCY_TYPE_INT[ typeInt ];
    if( typeString ) {
        return typeString;
    }
    return '';
};


export default exports = {
    updateTaskSuccDependency,
    updateTaskPredDependency,
    regenerateDependencyIds,
    getViewModelPropertyForDependencyInfo,
    getTaskSuccDependencies,
    getTaskPredDependencies,
    getTaskByIndex,
    getDependencyType
};
