// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Saw1WorkflowTasks
 */
import AwPromiseService from 'js/awPromiseService';
import listBoxService from 'js/listBoxService';
import soaSvc from 'soa/kernel/soaService';
import messagingSvc from 'js/messagingService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import dms from 'soa/dataManagementService';
import smConstants from 'js/ScheduleManagerConstants';
import appCtxService from 'js/appCtxService';
import resourcesService from 'js/ResourcesService';
import cmm from 'soa/kernel/clientMetaModel';
import commandPanelService from 'js/commandPanel.service';

var exports = {};

var checkobjectTypes = function( selected, isFromLauchWF ) {
    for( var i = 0; i < selected.length; i++ ) {
        if( cmm.isInstanceOf( 'Fnd0ProxyTask', selected[ i ].modelType ) ) {
            if( isFromLauchWF ) {
                throw 'launchWorkflowTaskTypeError';
            }
            throw 'workflowTaskTypeError';
        }
    }
};

var workflowValidation = function( ctx, isFromLauchWF ) {
    var selected = ctx.mselected;

    checkobjectTypes( selected, isFromLauchWF );

    for( var index1 = 0; index1 < selected.length; index1++ ) {
        var taskType = selected[ index1 ].props.task_type.dbValues[ 0 ];
        if( taskType !== smConstants.TASK_TYPE.T && taskType !== smConstants.TASK_TYPE.M &&
            taskType !== smConstants.TASK_TYPE.G ) {
            if( isFromLauchWF ) {
                throw 'launchWorkflowTaskTypeError';
            }
            throw 'workflowTaskTypeError';
        }
    }
};

/**
 * Activates workflow panel
 *
 * @param {string} commandId - Id of command
 * @param {string} location - Location of command
 */
export let getWorkflowPanel = function( commandId, location, ctx, commandContext ) {
    workflowValidation( ctx, false );
    const { dialogAction } = commandContext;
    if( dialogAction ) {
        let options =  {
            view: commandId,
            parent: '.aw-layout-workarea',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            push: true,
            subPanelContext: commandContext,
            commandid: commandId,
            commandicon: 'cmdSubmitToWorkflow'
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};


/**
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {object} isFromSectionSelected - the current selection object
 */
export let addResourceToDataProvider = function( dataProviderToUpdate, selecedResources ) {
    if( selecedResources && dataProviderToUpdate ) {
        let allResources = [];
        allResources.push( selecedResources[0] );
        //Update data provider.
        dataProviderToUpdate.update( allResources );
    }
};

export let updateTasks = function( schedule, ctx, data ) {
    var noOfSelectedTasks = ctx.mselected.length;
    var updates = [];
    var update;
    var inputData = {};
    var priviledgeUser = '';
    var workflowOwner = ctx.pselected.props.owning_user.dbValues[ 0 ];

    if( data.dataProviders.getAssignedWorkflowOwner.viewModelCollection.loadedVMObjects.length > 0  ) {
        workflowOwner = data.dataProviders.getAssignedWorkflowOwner.viewModelCollection.loadedVMObjects[ 0 ].uid;
    }
    if( data.dataProviders.getAssignedPrivilegedUser.viewModelCollection.loadedVMObjects.length > 0 ) {
        priviledgeUser = data.dataProviders.getAssignedPrivilegedUser.viewModelCollection.loadedVMObjects[ 0 ].uid;
    }
    for( var index = 0; index < noOfSelectedTasks; index++ ) {
        update = {

            object: ctx.mselected[ index ],
            updates: [ {
                attrName: 'saw1WorkflowTemplate',
                attrValue: data.workflowTemplates.dbValue,
                attrType: ''

            }, {
                attrName: 'saw1WorkflowTriggerType',
                attrValue: data.WorkflowTrigger.dbValue,
                attrType: ''

            }, {
                attrName: 'privileged_user',
                attrValue: priviledgeUser,
                attrType: ''

            }, {
                attrName: 'fnd0workflow_owner',
                attrValue: workflowOwner,
                attrType: ''

            } ],
            typedUpdates: []

        };
        updates.push( update );
    }
    inputData.updates = updates;
    inputData.schedule = {
        uid: schedule.uid,
        type: schedule.type
    };
    // Made a SOA call to update tasks
    soaSvc.post( 'ProjectManagement-2012-02-ScheduleManagement', 'updateTasks', inputData ).then( function() {
        // Check if the call is success or failure.
    }, function( error ) {
        var errMessage = messagingSvc.getSOAErrorMessage( error );
        messagingSvc.showError( errMessage );
    } );
};

var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

/**
 * Process List
 *
 * @param {Object} response The soa response
 * @return {ObjectArray} list of UoMs
 */
export let processList = function( response ) {
    var workflowTriggerList = [];
    for( var i = 0; i < response.lovValues.length; i++ ) {
        var listModel = _getEmptyListModel();
        listModel.propDisplayValue = response.lovValues[ i ].propDisplayValues.lov_values[ 0 ];
        listModel.propInternalValue = response.lovValues[ i ].propInternalValues.lov_values[ 0 ];
        workflowTriggerList.push( listModel );
    }
    return workflowTriggerList;
};
/**
 *  Check if Supplier collaboration template is installed &
 * Supplier(CompanyContact) is assigned to the selected tasks
 */
var isExternalSupplierAssigned = function() {
    var ctx = appCtxService.ctx;
    var supplierObject = resourcesService.getResourceObject( ctx, 'CompanyContact' );
    return supplierObject !== undefined && supplierObject.length > 0;
};

/**
 * Get template values from ProgramWorkFlowTemplates
 */
var getExternalTemplates = function() {
    var ctx = appCtxService.ctx;
    return ctx.preferences !== undefined && ctx.preferences.ProgramWorkFlowTemplates !== undefined ? appCtxService.ctx.preferences.ProgramWorkFlowTemplates : '';
};

/**
 * workflow Template List
 *
 * @param {Object} response The soa response
 * @return {ObjectArray} list of UoMs
 */
export let workflowTemplateList = function( response ) {
    var availableWTLists = [];
    var index = 0;

    //If supplier is assigned to task & SC template is installed
    //then only template values from ProgramWorkFlowTemplates should be listed in LOV
    var templateValues = getExternalTemplates();
    if( templateValues && isExternalSupplierAssigned() ) {
        for( var i1 = 0; i1 < response.lovValues.length; i1++ ) {
            if( templateValues.includes( response.lovValues[ i1 ].propDisplayValues.template_name[ 0 ] ) ) {
                availableWTLists[ index++ ] = response.lovValues[ i1 ].propDisplayValues.template_name[ 0 ];
            }
        }
        return listBoxService.createListModelObjectsFromStrings( availableWTLists );
    }

    for( var i = 0; i < response.lovValues.length; i++ ) {
        availableWTLists[ index++ ] = response.lovValues[ i ].propDisplayValues.template_name[ 0 ];
    }
    return listBoxService.createListModelObjectsFromStrings( availableWTLists );
};

/**
 * Populate the panel data based on selection and add the additional search criteria so that duplicate reviewer will
 * be avoided.
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {object} selection - the current selection object
 */
export let populatePanelData = function( data, selection, ctx ) {
    var priviledgeUser = ctx.mselected[ 0 ].props.privileged_user.dbValues[ 0 ];
    var workflowOwner = ctx.mselected[ 0 ].props.fnd0workflow_owner.dbValues[ 0 ];
    if( workflowOwner === '' || workflowOwner === null ) {
        workflowOwner = ctx.pselected.props.owning_user.dbValues[ 0 ];
    }
    dms.getProperties( [ priviledgeUser, workflowOwner ], [ 'object_string', 'group', 'awp0CellProperties' ] ).then( function() {
        var workflowOwnerModelObject = cdm.getObject( workflowOwner );
        data.workflowOwner = [ viewModelObjectService.constructViewModelObjectFromModelObject( workflowOwnerModelObject,
            'EDIT' ) ];
        data.dataProviders.getAssignedWorkflowOwner.viewModelCollection.loadedVMObjects = data.workflowOwner;
        if( priviledgeUser !== '' && priviledgeUser !== null ) {
            var privUserModelObject = cdm.getObject( priviledgeUser );
            data.priviledgeUser = [ viewModelObjectService.constructViewModelObjectFromModelObject( privUserModelObject,
                'EDIT' ) ];
            data.dataProviders.getAssignedPrivilegedUser.viewModelCollection.loadedVMObjects = data.priviledgeUser;
        }
    } );

    var selectedUids = [];

    for( var index = 0; index < ctx.mselected.length; index++ ) {
        selectedUids.push( ctx.mselected[ index ].uid );
    }
    var deferred = AwPromiseService.instance.defer();

    dms.getProperties( selectedUids, [ 'saw1WorkflowTriggerType', 'saw1WorkflowTemplate' ] ).then( function() {
        var selectedTask = cdm.getObject( ctx.mselected[ 0 ].uid );

        var workflowTemplate = selectedTask.props.saw1WorkflowTemplate.dbValues[ 0 ];
        var workflowTrigger = selectedTask.props.saw1WorkflowTriggerType.dbValues[ 0 ];

        data.workflowTemplates.dbValue = workflowTemplate;
        data.workflowTemplates.uiValue = selectedTask.props.saw1WorkflowTemplate.uiValues[ 0 ];
        data.WorkflowTrigger.dbValue = workflowTrigger;
        data.WorkflowTrigger.uiValue = selectedTask.props.saw1WorkflowTriggerType.uiValues[ 0 ];

        for( var tempIndex = 1; tempIndex < ctx.mselected.length; tempIndex++ ) {
            selectedTask = cdm.getObject( ctx.mselected[ tempIndex ].uid );
            if( workflowTemplate !== selectedTask.props.saw1WorkflowTemplate.dbValues[ 0 ] ) {
                data.workflowTemplates.dbValue = '';
                data.workflowTemplates.uiValue = '';
                break;
            }
        }

        for( var triggerIndex = 1; triggerIndex < ctx.mselected.length; triggerIndex++ ) {
            selectedTask = cdm.getObject( ctx.mselected[ triggerIndex ].uid );
            if( workflowTrigger !== selectedTask.props.saw1WorkflowTriggerType.dbValues[ 0 ] ) {
                data.WorkflowTrigger.dbValue = '';
                data.WorkflowTrigger.uiValue = '';
                break;
            }
        }

        deferred.resolve();
    } );
    return deferred.promise;
};

var checkForTemplateUnpublishedSch = function( objects ) {
    for( var i = 0; i < objects.length; i++ ) {
        var scheduleUid = objects[ i ].props.schedule_tag.dbValues[ 0 ];
        var schedule = cdm.getObject( scheduleUid );
        var isTemplate = schedule.props.is_template.dbValues[ 0 ];
        var published = schedule.props.published.dbValues[ 0 ];
        if( isTemplate === '1' || published !== '1' ) {
            throw 'templateUnpublisedSchWFLaunchError';
        }
    }
};

export let isValidToLauchWorkflow = function( ctx ) {
    workflowValidation( ctx, true );
    checkForTemplateUnpublishedSch( ctx.mselected );
};

export default exports = {
    getWorkflowPanel,
    updateTasks,
    processList,
    workflowTemplateList,
    populatePanelData,
    isValidToLauchWorkflow,
    addResourceToDataProvider
};
