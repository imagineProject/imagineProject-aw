// Copyright (c) 2022 Siemens

/**
 * @module js/scheduleNavigationTreeRowService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import messagingService from 'js/messagingService';
import schNavigationDepCacheService from 'js/ScheduleNavigationDependencyCacheService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import smConstants from 'js/ScheduleManagerConstants';
import AwPromiseService from 'js/awPromiseService';
import cmm from 'soa/kernel/clientMetaModel';

var exports = {};

let scheduleTaskProcessed = [];

let newDependenciesWithDisplayValues = [];

export let subscribeEvents = () => {
    let eventSubscriptions = [];

    // Handle the nodes being loaded
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTreeDataProvider.treeNodesLoaded', eventData => {
        regenerateTreeNodeUidsCache( eventData.treeLoadInput.scheduleSummaryNode );
        regenerateDependencyIds();
        refreshRowNumbers();
    } ) );

    // Handle the nodes after Expand All
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.expandAll', eventData => {
        if( eventData.dataProvider ) {
            let vmCollection = eventData.dataProvider.viewModelCollection;
            regenerateTreeNodeUidsCache( vmCollection.loadedVMObjects[0] );
            refreshRowNumbers();
        }
    } ) );

    // Handle the nodes after Collapse command or Show/Hide Children
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.plTable.toggleTreeNode', node => {
        if ( !node.isExpanded ) {
            let treeNodeUids = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids;
            regenerateCollapsedTreeNodesCache( treeNodeUids, node );
        } else {
            let smGanttCtx = appCtxSvc.ctx.smGanttCtx;
            let vmCollection = smGanttCtx.treeDataProvider.viewModelCollection;
            regenerateTreeNodeUidsCache( vmCollection.loadedVMObjects[0] );
        }
        refreshRowNumbers();
    } ) );

    // Handle new nodes being added
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesAdded', eventData => {
        if( eventData.dataProvider ) {
            let vmCollection = eventData.dataProvider.viewModelCollection;
            regenerateTreeNodeUidsCache( vmCollection.loadedVMObjects[0] );
            refreshRowNumbers();
            refreshDependenciesDisplayValues( eventData.dataProvider );
        }
    } ) );

    // Handle the nodes being removed
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.nodesRemoved', eventData => {
        if( eventData.dataProvider ) {
            let vmCollection = eventData.dataProvider.viewModelCollection;
            regenerateTreeNodeUidsCache( vmCollection.loadedVMObjects[0] );
            refreshRowNumbers();
            refreshDependenciesDisplayValues( eventData.dataProvider );
        }
    } ) );

    // Handle the dependencies being loaded
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesLoaded', eventData => {
        regenerateDependencyIds();
        refreshDependencyProps( eventData.loadedDependencies );
    } ) );

    // Handle the dependencies being added
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesAdded', eventData => {
        processCreatedDependency( eventData.dependenciesInfo );
        refreshDependenciesDisplayValues( eventData.dataProvider );
        refreshDependencyProps( eventData.dependenciesInfo );
    } ) );

    // Handle the dependencies being removed
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.dependenciesDeleted', eventData => {
        processDeletedDependency( eventData.dependenciesInfo );
        refreshDependenciesDisplayValues( eventData.dataProvider );
        refreshDependencyProps( eventData.dependenciesInfo );
    } ) );

    // Handle the reordering of tasks.
    eventSubscriptions.push( eventBus.subscribe( 'scheduleNavigationTree.tasksReordered', eventData => {
        if( eventData.operation === 'reorder' && eventData.dataProvider ) {
            let vmCollection = eventData.dataProvider.viewModelCollection;
            regenerateTreeNodeUidsCache( vmCollection.loadedVMObjects[0] );
            refreshRowNumbers();
            refreshDependenciesDisplayValues( eventData.dataProvider );
        }
    } ) );

    return eventSubscriptions;
};

let regenerateCollapsedTreeNodesCache = ( treeNodeUids, node ) => {
    getCollapsedTreeNodesUids( treeNodeUids, node );
    appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids = treeNodeUids;
};

let getCollapsedTreeNodesUids = ( treeNodeUids, node ) => {
    if ( node.children ) {
        node.children.forEach( ( childNode ) => {
            // Remove childNode.uid from treeNodeUids if present since the parent is collapsed
            const index = treeNodeUids.indexOf( childNode.uid );
            if ( index !== -1 ) {
                treeNodeUids.splice( index, 1 );
            }
            // Recursively call for childNode
            getCollapsedTreeNodesUids( treeNodeUids, childNode );
        } );
    }
};

let refreshRowNumbers = () => {
    let propsUpdatedEventData = {};
    let treeNodeUids = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids;
    treeNodeUids && treeNodeUids.forEach( nodeUid => propsUpdatedEventData[ nodeUid ] = [ 'saw1RowNumberInGantt' ] );
    if ( Object.keys( propsUpdatedEventData ).length > 0 ) {
        eventBus.publish( 'viewModelObject.propsUpdated', propsUpdatedEventData );
    }
};

let refreshDependencyProps = ( dependencyInfos ) => {
    let propsUpdatedEventData = {};
    dependencyInfos && dependencyInfos.forEach( depInfo => {
        if ( cdm.containsObject( depInfo.primaryUid ) ) {
            propsUpdatedEventData[ depInfo.primaryUid ] = [ 'saw1Predecessors', 'saw1Successors' ];
        }
        if ( cdm.containsObject( depInfo.secondaryUid ) ) {
            propsUpdatedEventData[ depInfo.secondaryUid ] = [ 'saw1Predecessors', 'saw1Successors' ];
        }
    } );
    if ( Object.keys( propsUpdatedEventData ).length > 0 ) {
        eventBus.publish( 'viewModelObject.propsUpdated', propsUpdatedEventData );
    }
};

let regenerateTreeNodeUidsCache = ( rootNode ) => {
    let treeNodeUids = [];
    getChildrenDFS( rootNode, treeNodeUids );
    appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids = treeNodeUids;
};

let getChildrenDFS = ( parentNode, treeNodeUids ) => {
    if( !parentNode ) {
        return;
    }
    treeNodeUids.push( parentNode.uid );
    let childNodes = parentNode.children;

    // If the node is collapsed, read from __expandState
    if( !childNodes && parentNode.__expandState && parentNode.__expandState.children ) {
        childNodes = parentNode.__expandState.children;
    }

    if( childNodes && parentNode.isExpanded ) {
        childNodes.forEach( childNode => getChildrenDFS( childNode, treeNodeUids ) );
    }
};

/** This function validates display string of dependency
 * @param {string} depStr - Dependency string to validate
 */
var validateChars = function( depStr ) {
    return /^[0-9,F,S,D,H,P,G,\-,+,.,,]+$/i.test( depStr );
};

/**
 * This function prepares the input for delete dependencies
 * @param {Array} depIdsToRemove - Dependencies displayValues to remove
 * @param {Object} depInfo - Object containing dependecy ids and uids info
 * @param {VMO} scheduleVMO - Schedule Object
 * @return {Structure} depDeleteInput - Input data to deleteDependecy
 */
var processDepDeletes = function( depIdsToRemove, depInfo, scheduleVMO ) {
    var deleteDeps = [];
    depIdsToRemove && depIdsToRemove.forEach( depId => {
        if ( depId && depId !== '' ) {
            //Get Uid from DBValue property.
            let depIndex = depInfo.displayValues.indexOf( depId );

            if ( depIndex !== -1 ) {
                let depObject = cdm.getObject( depInfo.dependencyUids[ depIndex ] );
                if ( depObject ) {
                    deleteDeps.push( depObject );
                }
            }
        }
    } );

    let depDeleteInput = {};
    if( deleteDeps.length > 0 ) {
        depDeleteInput = {
            schedule: scheduleVMO,
            dependencyDeletes: deleteDeps
        };
    }
    return depDeleteInput;
};

/**  This function prepares the input for add dependencies
 * @param {Array} depToAdd - Dependencies displayValues to add
 * @param {string} propertyName - Property name
 * @param {Object} selectedTask - Schedule Task
 * @param {VMO} scheduleVMO - Schedule Object
 * @return {Structure} inputData - Input data to CreateDependecy
 */
var processDepAdds = function( depToAdd, propertyName, selectedTask, scheduleVMO ) {
    var dependencyInfo = [];
    var inputData = {};
    newDependenciesWithDisplayValues = [];
    for( var inx = 0; inx < depToAdd.length; ++inx ) {
        var typeString = '';
        var indexOfTaskStr = '';
        var stringWithTypeAndIndex = '';
        var lagTimeString = '';

        var depToAddString = depToAdd[ inx ];
        if( depToAddString === '' ) {
            continue;
        }

        //Remove white space
        var stringValue = depToAddString.replace( /\s/g, '' );

        // The expected format is TaskIndex[Type][+/-lag].
        // '5','3SS+3','7FS-2',and '4FF'are examples of valid entries.
        var hasPlusDelimeter = stringValue.includes( '+' );
        var hasMinusDelimeter = stringValue.includes( '-' );

        var stringValueArray = [];
        if( hasPlusDelimeter ) {
            stringValueArray = stringValue.split( '+' );
        } else if( hasMinusDelimeter ) {
            stringValueArray = stringValue.split( '-' );
        } else {
            stringValueArray.push( stringValue );
        }

        //If String doesn't have Delimeter, stringValueArray should have one entry.
        if( stringValueArray && stringValueArray.length === 1 ) {
            stringWithTypeAndIndex = stringValueArray[ 0 ].trim(); //remove white space in case
            if( !/^[\.0-9,F,S,P,G]+$/i.test( stringWithTypeAndIndex ) ) {
                throw '';
            }
        }

        //If String has Delimeter, stringValueArray should have two entry.
        if( stringValueArray && stringValueArray.length === 2 ) {
            stringWithTypeAndIndex = stringValueArray[ 0 ].trim(); //remove white space in case
            lagTimeString = stringValueArray[ 1 ].trim(); //remove white space in case
            if( !/^[\.0-9,d,h]+$/i.test( lagTimeString ) ) {
                throw '';
            }
            if( lagTimeString && lagTimeString.indexOf( 'd' ) === -1 && lagTimeString.indexOf( 'h' ) === -1 ) {
                lagTimeString = lagTimeString.concat( 'd' );
            }
        }

        //Find type of dependency from stringWithTypeAndIndex. If it's not present, default is "FS".
        var indexofType = -1;
        indexofType = stringWithTypeAndIndex.indexOf( 'FS' );
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'FF' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'SF' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'SS' );
        }
        if( indexofType === -1 ) {
            indexofType = stringWithTypeAndIndex.indexOf( 'PG' );
        }

        // One of the Dep type is found
        if( indexofType !== -1 ) {
            typeString = stringWithTypeAndIndex.substring( indexofType, indexofType + 2 ); //Two Character from type char index is type of Dependency
            if( indexofType !== 0 ) {
                indexOfTaskStr = stringWithTypeAndIndex.substring( 0, indexofType ); // Start to type char index is Task Index.
            }
        } else { //If it's not present, default is "FS".
            typeString = 'FS';
            indexOfTaskStr = stringWithTypeAndIndex;
        }

        if( !indexOfTaskStr ) {
            throw '';
        }

        //process lagtime
        var inputLagime = processLagTime( lagTimeString, hasPlusDelimeter, hasMinusDelimeter );

        //Get task from view model for an index.
        let indexOfTaskInt = parseInt( indexOfTaskStr );
        var taskUidFromIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids[ indexOfTaskInt - 1 ];
        var taskFromIndex = cdm.getObject( taskUidFromIndex );
        if( !taskFromIndex ) {
            localeSvc.getLocalizedText( 'ScheduleManagerMessages', 'taskNotFoundError' ).then( function( result ) {
                var err = result.replace( '{0}', '\'' + indexOfTaskStr + '\'' );
                messagingService.showError( err );
            } );
        } else {
            // Prepare SOA input.
            var depType = getDependencyTypeFromString( typeString );

            var sourceVMO = '';
            var targetVMO = '';
            if( propertyName === 'saw1Successors' ) {
                sourceVMO = selectedTask;
                targetVMO = taskFromIndex;
            } else {
                sourceVMO = taskFromIndex;
                targetVMO = selectedTask;
            }

            var info = {
                predTask: sourceVMO,
                succTask: targetVMO,
                depType: depType,
                lagTime:inputLagime
            };
            let depInfo = {
                predTask: sourceVMO,
                succTask: targetVMO,
                depString: depToAdd[inx]
            };
            newDependenciesWithDisplayValues.push( depInfo );
            dependencyInfo.push( info );
        }
    }
    if( dependencyInfo.length > 0 ) {
        // Sort the inputs with 'complete'ed predecessors at the end of the list, so that
        // server does not trigger the workflow (if applicable) while processing - if the first
        // input has a 'complete'ed task. This fix can be removed once the server is able to
        // process the inputs in bulk before checking/triggering the workflow (if applicable).
        if ( propertyName === 'saw1Predecessors' ) {
            dependencyInfo.sort( ( depInfo1, depInfo2 ) => {
                let fnd0status1 = _.get( depInfo1.predTask, [ 'props', 'fnd0status', 'dbValues', '0' ], '' );
                let fnd0status2 = _.get( depInfo2.predTask, [ 'props', 'fnd0status', 'dbValues', '0' ], '' );

                return  fnd0status1 === 'complete' && fnd0status2 !== 'complete'  ? 1 :
                    fnd0status1 !== 'complete' && fnd0status2 === 'complete'  ? -1 : 0;
            } );
        }

        inputData = {
            schedule: scheduleVMO,
            newDependencies: dependencyInfo
        };
    }
    return inputData;
};

var processLagTime = function( lagTimeString, hasPlusDelimeter, hasMinusDelimeter ) {
    var inputLagime = 0;
    if( lagTimeString !== '' && ( hasPlusDelimeter || hasMinusDelimeter ) ) {
        var hasHour = false;
        var hasDay = false;
        var indexOfTimeUnit = 0;
        var indexOfDayUnit = 0;
        indexOfTimeUnit = lagTimeString.indexOf( 'h' );
        indexOfDayUnit = lagTimeString.indexOf( 'd' );
        if( indexOfTimeUnit !== -1 ) {
            hasHour = true;
        }
        if( indexOfDayUnit !== -1 ) {
            hasDay = true;
        }

        //If both are false, default is "d"
        if( !hasDay && !hasHour ) {
            hasDay = true;
        }

        var dayStartIndex = 0;
        var timeStartIndex = 0;
        if( hasDay && indexOfDayUnit > indexOfTimeUnit ) {
            dayStartIndex = indexOfTimeUnit + 1;
        } else if ( indexOfTimeUnit > indexOfDayUnit ) {
            timeStartIndex = indexOfDayUnit + 1;
        }

        var timeString = '';
        var timeInt = 0;
        if( indexOfTimeUnit !== -1 && hasHour ) {
            timeString = lagTimeString.substring( timeStartIndex, indexOfTimeUnit );
            if( !isNaN( timeString ) ) {
                timeInt = parseInt( timeString );
                timeInt *= 60;
                if( timeInt > 0 ) {
                    if( hasMinusDelimeter ) {
                        inputLagime -= timeInt;
                    } else {
                        inputLagime += timeInt;
                    }
                }
            }
        }

        var dayString = '';
        var dayInt = 0;
        if( indexOfDayUnit !== -1 && hasDay ) {
            dayString = lagTimeString.substring( dayStartIndex, indexOfDayUnit );
            if( !isNaN( dayString ) ) {
                dayInt = parseInt( dayString );
                dayInt *= 480;
                if( dayInt > 0 ) {
                    if( hasMinusDelimeter ) {
                        inputLagime -= dayInt;
                    } else {
                        inputLagime += dayInt;
                    }
                }
            }
        }
    }
    return inputLagime;
};

/**  This function return dependency type from string passed
 * @param {string} typeString - Dependecy type in string
 * @return {Int} typeInt - Dependency Type
 */
var getDependencyTypeFromString = function( typeString ) {
    var typeInt = smConstants.DEPENDENCY_TYPE[ typeString ];
    if( typeInt === undefined ) {
        typeInt = -1;
    }
    return typeInt;
};

/**  This function returns the display value of predecessor and successor columns for given task
 * @param {Object} depProp - Dependency Info
 * @param {Uid} taskUid - Task Uid
*/
let getNewDependenciesDisplayValue = function( depProp, taskUid, isProxyDep ) {
    let newDepDisplayValue = '';
    for( let index = 0; newDependenciesWithDisplayValues.length > index; index++ ) {
        let taskDependency = newDependenciesWithDisplayValues[index];
        if( taskDependency.succTask.uid === depProp.primary_object && taskDependency.predTask.uid === depProp.secondary_object || isProxyDep ) {
            let depString = taskDependency.depString;
            var hasPlusDelimeter = depString.includes( '+' );
            var hasMinusDelimeter = depString.includes( '-' );
            var stringValueArray = [];
            let regxStr = [];
            if( hasPlusDelimeter ) {
                stringValueArray = depString.split( '+' );
                regxStr = stringValueArray[0].match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            } else if( hasMinusDelimeter ) {
                stringValueArray = depString.split( '-' );
                regxStr = stringValueArray[0].match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            } else {
                regxStr = depString.match( /[a-zA-Z]+|[0-9]+(?:\.[0-9]+|)/g );
            }

            if( stringValueArray && stringValueArray.length === 2 ) {
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                if( hasPlusDelimeter ) {
                    newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1] + '+' + stringValueArray[1];
                } else if( hasMinusDelimeter ) {
                    newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1] + '-' + stringValueArray[1];
                }
            } else if( stringValueArray && stringValueArray.length === 1 ||  regxStr && regxStr.length === 2 ) {
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                newDepDisplayValue = newDepDisplayNumber.toString() + regxStr[1];
            }else{
                let newDepDisplayNumber = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( taskUid ) + 1;
                newDepDisplayValue = newDepDisplayNumber.toString();
            }
            return newDepDisplayValue;
        }
    }
    return newDepDisplayValue;
};

/**
 * Compares the old and new value (comma seperated) and returns the added and deleted dependency numbers
 * @param {String} oldValue Old dependency value
 * @param {String} newValue New dependency value
 * @returns The object containing the added and deleted dependency numbers
 */
export let findChanges = ( oldValue, newValue ) => {
    let oldDepString = oldValue ? oldValue.replace( /\s+/g, '' ) : ''; // Remove spaces
    let newDepString = newValue ? newValue.replace( /\s+/g, '' ) : ''; // Remove spaces

    let depsToRemove = oldDepString.trim().split( ',' ).filter( el => el );
    if ( depsToRemove.length > 0 ) {
        let newValues = newDepString.trim().split( ',' ).filter( el => el );
        depsToRemove = depsToRemove.filter( dep => !newValues.includes( dep ) );
    }

    let depsToAdd = newDepString.trim().split( ',' ).filter( el => el );
    if ( depsToAdd.length > 0 ) {
        let oldValues = oldDepString.trim().split( ',' ).filter( el => el );
        depsToAdd = depsToAdd.filter( dep => !oldValues.includes( dep ) );
    }

    if ( depsToAdd.length > 0 ) {
        let validStr = validateChars( depsToAdd );
        if ( !validStr ) {
            throw '';
        }
    }
    return { adds: depsToAdd, deletes: depsToRemove };
};

/**  This function perform add and delete dependency based on inline editing in schedule Tree table
 * @param {VMO} scheduleTaskVMO - schedule task Object
 * @param {string} propertyName - Property name saw1Predecessor/saw1Successor
 * @param {string} oldValue - Old value of property edited
 * @param {string} newValue - New value of property
 */
export let saveDependencyEdits = function( scheduleTaskVMO, propertyName, oldValue, newValue ) {
    var defer = AwPromiseService.instance.defer( );
    try {
        let index = -1;
        _.forEach( scheduleTaskProcessed, function( dependency ) {
            if( dependency.taskUid === scheduleTaskVMO.id && dependency.displayValues === newValue ) {
                index = 0;
            }
        } );
        if ( index === -1 ) {
            scheduleTaskProcessed.push( { taskUid: scheduleTaskVMO.id, displayValues: newValue } );

            let depInfo = {};
            if ( propertyName === 'saw1Successors' ) {
                depInfo = schNavigationDepCacheService.getTaskSuccDependencies( scheduleTaskVMO.uid );
            } else if ( propertyName === 'saw1Predecessors' ) {
                depInfo = schNavigationDepCacheService.getTaskPredDependencies( scheduleTaskVMO.uid );
            }

            let changes = findChanges( oldValue, newValue );

            let scheduleVMO = appCtxSvc.getCtx( 'pselected' );
            var depDeleteInput = processDepDeletes( changes.deletes, depInfo, scheduleVMO );
            var depAddInput = processDepAdds( changes.adds, propertyName, scheduleTaskVMO, scheduleVMO );

            if( depDeleteInput.dependencyDeletes && depAddInput.newDependencies ) {
                let depAddDeleteData = {
                    depDeleteInput : depDeleteInput,
                    depAddInput : depAddInput
                };
                eventBus.publish( 'InlineDependencyDelete', depAddDeleteData );
                eventBus.subscribe( 'InlineDependencyDeleteSuccess', function() {
                    defer.resolve();
                } );
            } else if( depDeleteInput.dependencyDeletes && !depAddInput.newDependencies ) {
                let depAddDeleteData = {
                    depDeleteInput : depDeleteInput
                };
                eventBus.publish( 'InlineDependencyDelete', depAddDeleteData );
                eventBus.subscribe( 'InlineDependencyDeleteSuccess', function() {
                    defer.resolve();
                } );
            } else if( depAddInput.newDependencies && !depDeleteInput.dependencyDeletes ) {
                eventBus.publish( 'InlineDependencyCreate', depAddInput );
                eventBus.subscribe( 'InlineDependencyCreateSuccess', function() {
                    defer.resolve();
                } );
            }
            return newValue;
        }
    } catch( error ) {
        let msg = 'inlineDepFormatPredError';
        if( propertyName === 'saw1Successors' ) {
            msg = 'inlineDepFormatSuccError';
        }
        localeSvc.getLocalizedText( 'ScheduleManagerMessages', msg ).then( function( result ) {
            var err = result.replace( '{0}', '\'' + newValue + '\'' );
            messagingService.showError( err );
        } );
    }
};
let processCrossScheduleDependency = function( primaryUid, secondaryUid ) {
    let primaryVMO = cdm.getObject( primaryUid );
    let secondaryVMO = cdm.getObject( secondaryUid );
    let isProxyDep = false;
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', primaryVMO.modelType ) && primaryVMO.props.fnd0task_tag ) {
        var homeTaskPropPrimary = primaryVMO.props.fnd0task_tag.dbValues[ 0 ];
        if( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskPropPrimary ) !== -1 ) {
            primaryUid = homeTaskPropPrimary;
            isProxyDep = true;
        }
    }
    if( cmm.isInstanceOf( 'Fnd0ProxyTask', secondaryVMO.modelType )  && secondaryVMO.props.fnd0task_tag ) {
        var homeTaskPropSecondary = secondaryVMO.props.fnd0task_tag.dbValues[ 0 ];
        if( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( homeTaskPropSecondary ) !== -1 ) {
            secondaryUid = homeTaskPropSecondary;
            isProxyDep = true;
        }
    }
    return {
        primaryUid: primaryUid,
        secondaryUid: secondaryUid,
        isProxyDep: isProxyDep
    };
};

/**  This function process newly created dependencies.
 * @param {Array} createdDependencyInfos - Created Dependencies array
*/
let processCreatedDependency = function( createdDependencyInfos ) {
    _.forEach( createdDependencyInfos, function( obj ) {
        var depProp = cdm.getObject( obj.uid );
        let primaryUid = depProp.props.primary_object.dbValues[0];
        let secondaryUid = depProp.props.secondary_object.dbValues[0];

        let linkInfo = processCrossScheduleDependency( primaryUid, secondaryUid );

        let dependency = {
            primary_object : linkInfo.primaryUid,
            secondary_object : linkInfo.secondaryUid
        };
        // Update Predecessor Dependencies Map for newly created Dep
        let newDepDisplayValue = '';
        newDepDisplayValue = getNewDependenciesDisplayValue( dependency, dependency.primary_object, linkInfo.isProxyDep );

        if( newDepDisplayValue === '' ) {
            newDepDisplayValue = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depProp.props.primary_object.dbValues[0] ) + 1;
        }
        let succDependency = schNavigationDepCacheService.getTaskSuccDependencies( depProp.props.secondary_object.dbValues[0] );

        let deps = [];
        if( succDependency && succDependency.dependencyUids && succDependency.dependencyUids.length > 0 ) {
            deps = succDependency.dependencyUids;
        }
        if( succDependency && succDependency.displayValues && succDependency.displayValues.indexOf( newDepDisplayValue.toString() ) === -1 ) {
            succDependency.displayValues.push( newDepDisplayValue );
        }
        if( deps.indexOf( obj.uid ) === -1 ) {
            deps.push( obj.uid );
        }
        if( succDependency.displayValues ) {
            schNavigationDepCacheService.addToTaskSuccDependencyMap( dependency.secondary_object, deps, succDependency.displayValues );
        } else {
            let succDisplayValue = [];
            succDisplayValue.push( newDepDisplayValue.toString() );
            schNavigationDepCacheService.addToTaskSuccDependencyMap( dependency.secondary_object, deps,  succDisplayValue );
        }

        newDepDisplayValue = '';
        // Update Successor Dependencies Map for newly created Dep
        newDepDisplayValue = getNewDependenciesDisplayValue( dependency, dependency.secondary_object, linkInfo.isProxyDep );
        if( newDepDisplayValue === '' ) {
            newDepDisplayValue = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( dependency.secondary_object ) + 1;
        }
        deps = [];
        let predDependency = schNavigationDepCacheService.getTaskPredDependencies( dependency.primary_object, linkInfo.isProxyDep );
        if( predDependency && predDependency.dependencyUids && predDependency.dependencyUids.length > 0 ) {
            deps = predDependency.dependencyUids;
        }
        if( deps.indexOf( obj.uid ) === -1 ) {
            deps.push( obj.uid );
        }
        if( predDependency && predDependency.displayValues && predDependency.displayValues.indexOf( newDepDisplayValue.toString() ) === -1 ) {
            predDependency.displayValues.push( newDepDisplayValue.toString() );
        }
        if( predDependency.displayValues ) {
            schNavigationDepCacheService.addToTaskPredDependencyMap( dependency.primary_object, deps, predDependency.displayValues );
        } else {
            let predDisplayValue = [];
            predDisplayValue.push( newDepDisplayValue.toString() );
            schNavigationDepCacheService.addToTaskPredDependencyMap( dependency.primary_object, deps, predDisplayValue );
        }
    } );
    newDependenciesWithDisplayValues = [];
};

/**  This function process deleted dependencies.
 * @param {Array} delDependencyInfos - deleted Dependencies array
*/
let processDeletedDependency = function( delDependencyInfos ) {
    for( let index = 0; index < delDependencyInfos.length; index++ ) {
        let predUid = delDependencyInfos[index].primaryUid;
        let succUid = delDependencyInfos[index].secondaryUid;

        // Update Predecessor Dependencies Map for newly created Dep
        let newPredDisplayValue = [];
        let predDependency = schNavigationDepCacheService.getTaskPredDependencies( predUid );
        let deps = predDependency.dependencyUids;
        let deletedDeps = [];
        if( deps ) {
            for( let index = 0; index < deps.length; index++ ) {
                let depObj = getDependencyObject( deps[index] );
                if( depObj !== undefined ) {
                    let succRowID = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depObj.secondaryUid ) + 1;
                    newPredDisplayValue.push( succRowID.toString() );
                    deletedDeps.push( deps[index] );
                }
            }
            schNavigationDepCacheService.addToTaskPredDependencyMap( predUid, deletedDeps, newPredDisplayValue );
        }


        // Update Successor Dependencies Map for newly created Dep
        let newSuccDisplayValue = [];
        let succDependency = schNavigationDepCacheService.getTaskSuccDependencies( succUid );
        deps = succDependency.dependencyUids;
        deletedDeps = [];
        if( deps ) {
            for( let index = 0; index < deps.length; index++ ) {
                let depObj = getDependencyObject( deps[index] );
                if( depObj !== undefined ) {
                    let succRowID = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( depObj.primaryUid ) + 1;
                    newSuccDisplayValue.push( succRowID.toString() );
                    deletedDeps.push( deps[index] );
                }
            }
            schNavigationDepCacheService.addToTaskSuccDependencyMap( succUid, deletedDeps, newSuccDisplayValue );
        }
    }
};

/**  This function returns dependency VMO from dependency uid.
 * @param {string} dependency - Dependency Uid
 * @returns {VMO} dependenciesInfo[index] - Dependency VMO
*/
let getDependencyObject = function( dependency ) {
    let dependenciesInfo = appCtxSvc.getCtx( 'scheduleNavigationCtx.dependenciesInfo' );
    for( let index = 0; index < dependenciesInfo.length; index++ ) {
        if( dependenciesInfo[index].uid === dependency ) {
            return dependenciesInfo[index];
        }
    }
};

/**  This function updated loaded VMO object of scheduleNavigationTreeDataProvider
 * @param {data} data - Data
 * @param {eventData} eventData - Event Data contain updated objects
*/
export let updateViewModel = function( data, eventData ) {
    _.forEach( eventData, function( value, key ) {
        let index = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( key );
        if( index !== -1 ) {
            if( value.indexOf( 'saw1Predecessors' ) > -1 && appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap ) {
                let taskUidToPredDependencyMap = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap;
                let predDeps = taskUidToPredDependencyMap[key];
                if( predDeps ) {
                    setDependencyDisplayValue( data.dataProviders.scheduleNavigationTreeDataProvider, index, predDeps, 'saw1Predecessors' );
                }
            }
            if( value.indexOf( 'saw1Successors' ) > -1 && appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap ) {
                let taskUidToSuccDependencyMap = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap;
                let succDeps = taskUidToSuccDependencyMap[key];
                if( succDeps ) {
                    setDependencyDisplayValue( data.dataProviders.scheduleNavigationTreeDataProvider, index, succDeps, 'saw1Successors' );
                }
            }
        }
    } );
};

/**  This function updated loaded VMO object display value of dependency of scheduleNavigationTreeDataProvider
 * @param {data} data - Data
 * @param {index} index - VMO index
 * @param {VMO} taskDep - Dependency VMO
 * @param {string} dependency - Property Predecessor/Successor
*/
let setDependencyDisplayValue = function( dataProvider, index, taskDep, dependency ) {
    let props = dataProvider.viewModelCollection.loadedVMObjects[index].props;
    if( props && props[ dependency ] ) {
        let taskDepDispValue = '';
        if( taskDep !== undefined && taskDep.displayValues && taskDep.displayValues.length !== 0 ) {
            for( var i = 0; i < taskDep.displayValues.length; ++i ) {
                taskDepDispValue += taskDep.displayValues[ i ];
                if( i !== taskDep.displayValues.length - 1 ) {
                    taskDepDispValue += ',';
                }
            }
        }
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].dbValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].displayValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].prevDisplayValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].uiValues = [ taskDepDispValue ];
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].dbValue = taskDepDispValue;
        dataProvider.viewModelCollection.loadedVMObjects[ index ].props[ dependency ].uiValue = taskDepDispValue;
    }
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

        let linkInfo = processCrossScheduleDependency( predTask, succTask );

        let dependency = {
            primary_object : linkInfo.primaryUid,
            secondary_object : linkInfo.secondaryUid
        };

        if( processedDependencies.indexOf( depUid ) < 0 ) {
            processedDependencies.push( depUid );
            if( !taskToPredMap[ dependency.primary_object ] ) {
                taskToPredMap[ dependency.primary_object ] = [];
            }

            if( !taskToSuccMap[ dependency.secondary_object ] ) {
                taskToSuccMap[ dependency.secondary_object ] = [];
            }

            taskToPredMap[ dependency.primary_object ].push( depUid );
            taskToSuccMap[ dependency.secondary_object ].push( depUid );
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
        let dependencyInfo = [];
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
                if( taskIndex <= 0 ) {
                    var task = cdm.getObject( taskUid );
                    if( cmm.isInstanceOf( 'Fnd0ProxyTask', task.modelType ) && task.props.fnd0task_tag && ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( task.props.fnd0task_tag.dbValues[0] ) !== -1 ) ) {
                        taskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( task.props.fnd0task_tag.dbValues[0] ) + 1;
                    }
                }
                if( taskIndex > 0 ) {
                    var task = cdm.getObject( taskUid );
                    if( cmm.isInstanceOf( 'Fnd0ProxyTask', task.modelType ) && task.props.fnd0task_tag && ( appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( task.props.fnd0task_tag.dbValues[0] ) !== -1 ) ) {
                        taskIndex = appCtxSvc.ctx.scheduleNavigationCtx.treeNodeUids.indexOf( task.props.fnd0task_tag.dbValues[0] ) + 1;
                    }
                    var dependencyValue = taskIndex + depTypeString + depLagString;
                    if( !dependencyInfo.find( ( { displayValue } ) => displayValue === dependencyValue ) ) {
                        dependencyInfo.push( { displayValue: dependencyValue, dbValue: depUid } );
                    }
                }
            }
        } );
        if( dependencyInfo.length > 0 ) {
            dependencyInfo.sort( ( info1, info2 ) => info1.displayValue - info2.displayValue );
            displayValues.push( ...dependencyInfo.map( info => info.displayValue ) );
            dbValues.push( ...dependencyInfo.map( info => info.dbValue ) );
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


/**  This function refesh dependencies display value based on create/delete operation
 * @param {data} data - Data
*/
export let refreshDependenciesDisplayValues = function( dataProvider ) {
    regenerateDependencyIds();
    //let viewModel = viewModelService.getViewModelUsingElement( schNavTreeUtils.getScheduleNavigationTreeTableElement() );
    updateDependencyValues( dataProvider );
};
/**  This function sets value of saw1Predecessor and saw1Successor properties of loaded VMO object of scheduleNavigationTreeDataProvider by getting values
 * from dependencyNumbersCache maps
 * @param {data} data - Data
*/
export let updateDependencyValues = function( dataProvider ) {
    if( dataProvider ) {
        let loadedVMO = dataProvider.viewModelCollection.loadedVMObjects;
        for( let index = 0; index < loadedVMO.length; index++ ) {
            let predValue;
            if( appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache &&
                appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap ) {
                predValue = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToPredDependencyMap[ loadedVMO[index].uid ];
                if( predValue ) {
                    setDependencyDisplayValue( dataProvider, index, predValue, 'saw1Predecessors' );
                }
            }
            let succValue;
            if( appCtxSvc.ctx.scheduleNavigationCtx && appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache &&
                appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap ) {
                succValue = appCtxSvc.ctx.scheduleNavigationCtx.dependencyNumbersCache.taskUidToSuccDependencyMap[ loadedVMO[index].uid ];
                if( succValue ) {
                    setDependencyDisplayValue( dataProvider, index, succValue, 'saw1Successors' );
                }
            }
        }
    }
    scheduleTaskProcessed = [];
};

export default exports = {
    subscribeEvents,
    findChanges,
    saveDependencyEdits,
    refreshDependenciesDisplayValues,
    regenerateDependencyIds,
    updateViewModel,
    updateDependencyValues
};
