// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowBreadcrumbPanel
 */
import AwPromiseService from 'js/awPromiseService';
import awp0InboxUtils from 'js/Awp0InboxUtils';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import dmSvc from 'soa/dataManagementService';
import editHandlerService from 'js/editHandlerService';
import messagingService from 'js/messagingService';
import localeSvc from 'js/localeService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import workflowUtils from 'js/Awp0WorkflowUtils';
import policySvc from 'soa/kernel/propertyPolicyService';
import soaService from 'soa/kernel/soaService';
import logger from 'js/logger';


var exports = {};
var _performProps = null;

/**
 * Get the parent process info from input task object and then update the process breadcrumb.
 *
 * @param {Object} activeTask the selected task
 * @param {Object} breadCrumbProvider the breadcrumb provider
 * @returns {Object} update breadcrumb provider
 */
let _updateProcessBreadcrumbInfo = function( activeTask, breadCrumbProvider ) {
    if( !activeTask || !activeTask.props || !activeTask.props.parent_process || !activeTask.props.parent_process.dbValues ) {
        return;
    }
    const processUId = activeTask.props.parent_process.dbValues[ 0 ];
    const parentProcess = soa_kernel_clientDataModel.getObject( processUId );

    let breadcrumbList = breadCrumbProvider.crumbs;

    // Creating crumb
    const processBreadCrumb = {
        clicked: false,
        displayName: parentProcess.props.object_string.uiValues[ 0 ],
        selectedCrumb: true,
        showArrow: false,
        processObject : parentProcess
    };

    breadcrumbList.push( processBreadCrumb );
    breadCrumbProvider.crumbs = breadcrumbList;
    return breadCrumbProvider;
};

/**
 * Get selected object and create breadcrumbs with selected object and parent process of active task.
 *
 * @param {Object} selectedObject the selected task
 * @returns {Object} breadcrumb provider
 */
let _insertCrumbsFromModelObject = function( selectedObject ) {
    let breadCrumbProvider = {};
    breadCrumbProvider.crumbs = [];

    const validModelObject = soa_kernel_clientDataModel.getObject( selectedObject.uid );

    // Creating crumb of selected object
    if( validModelObject && validModelObject.props && validModelObject.props.object_string && breadCrumbProvider ) {
        const props = validModelObject.props;
        const crumb = {
            displayName: props.object_string.uiValues[ 0 ],
            showArrow: true,
            primaryCrumb: true,
            selectedCrumb: false,
            scopedUid: validModelObject.uid,
            clicked: false,
            onCrumbClick: () => exports.onSelectCrumb( selectedObject )
        };

        breadCrumbProvider.crumbs.push( crumb );

        // Getting active task of selected object
        const activeTask = awp0InboxUtils.getActiveTaskFromWSOObject( validModelObject );

        // Updating breadcrumb
        if( activeTask && activeTask.props && activeTask.props.parent_process && activeTask.props.parent_process.dbValues ) {
            breadCrumbProvider = _updateProcessBreadcrumbInfo( activeTask, breadCrumbProvider );
        } else if( activeTask ) {
            dmSvc.getProperties( [ activeTask.uid ], [ 'parent_process' ] ).then( function() {
                breadCrumbProvider = _updateProcessBreadcrumbInfo( activeTask, breadCrumbProvider );
            } );
        }
    }

    return breadCrumbProvider;
};


/**
 * Build breadcrumb with selected object and parent process of active task
 *
 * @param {Object} selectedObject the selection object
 * @param {Object} xrtState XRT state context object
 * @returns {Object} Breadcrumb data provider
 */
export let buildNavigateBreadcrumb = function( selectedObject, xrtState ) {
    // Check if no object is selected then no need to process further and return from here
    if( !selectedObject ) {
        return;
    }

    // Check if selection is not valid type then no need to process further and return from here
    if( !awp0InboxUtils.isValidEPMTaskType( selectedObject ) ) {
        return;
    }

    // Get Breadcrumb of selected object
    const breadCrumbProvider = _insertCrumbsFromModelObject( selectedObject );

    if( breadCrumbProvider && breadCrumbProvider.crumbs && breadCrumbProvider.crumbs.length > 0 ) {
        const processCrumb = breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ];
        if( processCrumb ) {
            breadCrumbProvider.crumbs[ breadCrumbProvider.crumbs.length - 1 ].selectedCrumb = true;
            // Check if process object on crumb i snot null then update the XRT state as well and
            // as part of that update perfom task panel will be shown correctly
            if( processCrumb.processObject && processCrumb.processObject.uid ) {
                // Update the input selected process on XRT state
                workflowUtils.updateCustomContextXRTState( xrtState, processCrumb.processObject, true );
            }
        }

        breadCrumbProvider.crumbs[ 0 ].primaryCrumb = true;
    }

    return breadCrumbProvider;
};

/**
 * Register properties that needed for perform panel
 */
export let registerPropertyPolicy = function( selectedObjects ) {
    var typeName = 'WorkspaceObject';
    if( selectedObjects && selectedObjects.length > 0 &&  selectedObjects[0].props && selectedObjects[0].props.object_type ) {
        typeName = selectedObjects[0].props.object_type.dbValues[0];
    }

    var policy = {
        types: [ {
            name: typeName,
            properties: [ {
                name: 'object_string'
            },
            {
                name: 'fnd0AllWorkflows',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'fnd0MyWorkflowTasks',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            }
            ]

        },
        {
            name: 'EPMTask',
            properties: [ {
                name: 'parent_process',
                modifiers: [ {
                    name: 'withProperties',
                    Value: 'true'
                } ]
            },
            {
                name: 'object_name'
            } ]
        }
        ]
    };
    _performProps = policySvc.register( policy );
    return _performProps;
};

/**
 * Unregister properties taht were being used for perform panel
 */
export let unregisterPropertyPolicy = function() {
    if( _performProps !== null ) {
        policySvc.unregister( _performProps );
        _performProps = null;
        return _performProps;
    }
};

export let getBreadcrumbProperties = function( object, propertiesToLoad, policy ) {
    if( object && propertiesToLoad && policy ) {
        const input = {
            objects: object,
            attributes: propertiesToLoad
        };
        try {
            soaService.post( 'Core-2006-03-DataManagement', 'getProperties', input );
        } catch ( err ) {
            logger.info( `Failure while loading property for breadCrumbPanel ${err}` );
        }
    }
};


/**
 * load the data to be shown on chevron popup
 *
 * @param {Object} selectedObject Selected object for breadcrumb need to be shown
 * @return {Object} the resultObjects and count of objects
 */
export let loadPopupData = function( selectedObject ) {
    let childWorkflowObjs = [];
    const validModelObject = soa_kernel_clientDataModel.getObject( selectedObject.scopedUid );

    // Getting fnd0AllWorkflows property of selected object.
    let allWorkflowTasksAW = null;
    if( validModelObject.props.fnd0AllWorkflows && validModelObject.props.fnd0AllWorkflows.dbValues ) {
        allWorkflowTasksAW = validModelObject.props.fnd0AllWorkflows.dbValues;
    }

    // For each root task value from fnd0AllWorkflows property, get its parent process.
    let allWorkflowProcessesAW = [];
    if( allWorkflowTasksAW && allWorkflowTasksAW.length > 0 ) {
        _.forEach( allWorkflowTasksAW, function( workflowTask ) {
            const mo = soa_kernel_clientDataModel.getObject( workflowTask );
            if( mo && mo.props && mo.props.parent_process && mo.props.parent_process.dbValues ) {
                const processUId = mo.props.parent_process.dbValues[ 0 ];
                const parentProcess = soa_kernel_clientDataModel.getObject( processUId );
                if( parentProcess ) {
                    allWorkflowProcessesAW.push( parentProcess );
                }
            }
        } );
    }

    // Create popup data with each parent processes
    if( allWorkflowProcessesAW && allWorkflowProcessesAW.length > 0 ) {
        for( let ndx = 0; ndx < allWorkflowProcessesAW.length; ndx++ ) {
            const object = allWorkflowProcessesAW[ ndx ];
            const result = {
                className: object.type,
                type: object.type,
                uid: object.uid
            };
            childWorkflowObjs.push( result );
        }
        return {
            searchResults: childWorkflowObjs,
            totalFound: childWorkflowObjs.length
        };
    }
};

/**
 * This function will check if the user is in start edit mode.
 *
 * @returns {Promise} Promise object
 */
export let isEditInProgress = function() {
    var deferred = AwPromiseService.instance.defer();
    var resource = 'InboxMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    editHandlerService.isDirty().then( function( editContext ) {
        if( editContext && editContext.isDirty ) {
            var buttons = [ {
                addClass: 'btn btn-notify',
                text: localTextBundle.save,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.saveEdits().then( function() {
                        deferred.resolve();
                        //In the event of an error saving edits
                    }, function() {
                        deferred.resolve();
                    } );
                }
            },
            {
                addClass: 'btn btn-notify',
                text: localTextBundle.discard,
                onClick: function( $noty ) {
                    $noty.close();
                    editHandlerService.cancelEdits();
                    deferred.resolve();
                }
            }
            ];
            messagingService.showWarning( localTextBundle.navigationConfirmation, buttons );
        } else {
            deferred.resolve();
        }
    } );
    return deferred.promise;
};


/**
 * Update breadcrumb upon pop-up selection change
 *
 * @param {Object} selectedProcess Selected process from breadcrumb
 * @param {Object} selectedObject Selected object
 * @param {Object} crumbs existing crumb array
 * @return {Object} the updated crumbs
 */
export let updateNavigateBreadcrumbData = function( selectedProcess, selectedObject, crumbs, xrtState ) {
    //And it should navigate to the correct location
    if( selectedProcess ) {
        return exports.isEditInProgress().then( function() {
            return updateWorkflowPage( selectedProcess, selectedObject, crumbs, xrtState );
        } );
    }
};

/**
 * This method will update the workflow page.
 *
 * @param {Object} selectedProcess Selected process from breadcrumb
 * @param {Object} selectedObject Selected object,
 * @param {Object} crumbs existing crumb array
 * @param {Object} xrtState XRT state object
 * @return {Object} the updated crumb object
 */
export let updateWorkflowPage = function( selectedProcess, selectedObject, crumbs, xrtState ) {
    const newCrumbs = _.clone( crumbs );

    if( selectedProcess ) {
        const processBreadCrumb = {
            clicked: false,
            displayName: selectedProcess.props.object_string.uiValues[ 0 ],
            selectedCrumb: true,
            showArrow: false
        };

        newCrumbs.splice( 1, 1, processBreadCrumb );

        // Loading property for future use in breadcrumb
        dmSvc.getPropertiesUnchecked( [ selectedObject ], [ 'fnd0MyWorkflowTasks' ] ).then( function() {
            eventBus.publish( 'workflowTaskPanel.update',  { selectedProcess: selectedProcess } );
        } );

        // Update the input selected process on XRT state
        workflowUtils.updateCustomContextXRTState( xrtState, selectedProcess, true );
    }

    return {
        crumbs: newCrumbs
    };
};


/**
 * This method will update breadcrumb and hide the chevron pop-up after selection.
 * @param {Object} selection Selected process,
 * @param {Object} chevronPopup Popup
 */

export let updateBreadcrumb = function( selection, chevronPopup ) {
    // Triggering event to update breadcrumb after selection change
    eventBus.publish( 'workflow.updateBreadcrumbData',  { selection:selection[0] } );

    if( chevronPopup ) {
        chevronPopup.hide();
    }
};

/**
 * This method will update breadcrumb with latest process.
 * @param {Object} selectedObject Selected Object,
 */

export let onSelectCrumb = function( selectedObject ) {
    console.log( selectedObject );
    const activeTask = awp0InboxUtils.getActiveTaskFromWSOObject( selectedObject );

    let defaultProcess = null;

    // Getting latest process on selected object
    if( activeTask && activeTask.props && activeTask.props.parent_process && activeTask.props.parent_process.dbValues ) {
        defaultProcess = activeTask.props.parent_process;
    } else if( activeTask ) {
        dmSvc.getProperties( [ activeTask.uid ], [ 'parent_process' ] ).then( function() {
            defaultProcess = activeTask.props.parent_process;
        } );
    }

    if( defaultProcess ) {
        const processUId = defaultProcess.dbValues[ 0 ];
        const parentProcess = soa_kernel_clientDataModel.getObject( processUId );

        // Triggering event to update breadcrumb with latest process
        eventBus.publish( 'workflow.updateBreadcrumbData',  { selection: parentProcess } );
    }
};

export default exports = {
    buildNavigateBreadcrumb,
    updateWorkflowPage,
    isEditInProgress,
    loadPopupData,
    updateBreadcrumb,
    updateNavigateBreadcrumbData,
    onSelectCrumb,
    registerPropertyPolicy,
    unregisterPropertyPolicy,
    getBreadcrumbProperties
};
