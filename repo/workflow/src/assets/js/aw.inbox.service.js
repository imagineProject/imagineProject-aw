// Copyright (c) 2022 Siemens

/**
 * This service is used for handling inbox related functionality
 * <P>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/aw.inbox.service
 */
import clientDataModel from 'soa/kernel/clientDataModel';
import soaSvc from 'soa/kernel/soaService';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import _ from 'lodash';
import policySvc from 'soa/kernel/propertyPolicyService';
import eventBus from 'js/eventBus';
import cdmService from 'soa/kernel/clientDataModel';
import dataManagementService from 'soa/dataManagementService';
import editHandlerSvc from 'js/editHandlerService';
import awSearchService from 'js/awSearchService';
import localeService from 'js/localeService';
import prefService from 'soa/preferenceService';
import viewModeService from 'js/viewMode.service';
import commandPanelService from 'js/commandPanel.service';
import Awp0PerformTask from 'js/Awp0PerformTask';
import ssoAuthenticator from 'js/ssoAuthenticator';

/**
 * Define the base object used to provide all of this module's external API.
 *
 * @private
 */
var exports = {};

/**
 * This method returns the EPMtask object based on input model object. If input model object is signoff object then
 * it will get the fnd0ParentTask from sign-off object and return else if input object is of type EPMTask then
 * return as it is else return null.
 *
 * @param {String} uid of modelObject to be checked
 * @return {Object} The valid EPMTask object. Null otherwise.
 */
export let getValidEPMTaskObject = function( uid ) {
    var validEPMTaskObject = null;

    var mo = clientDataModel.getObject( uid );

    if( mo && mo.modelType && mo.modelType.typeHierarchyArray ) {
        if( _.indexOf( mo.modelType.typeHierarchyArray, 'Signoff' ) > -1 ) {
            if( mo.props.fnd0ParentTask && mo.props.fnd0ParentTask.dbValues &&
                mo.props.fnd0ParentTask.dbValues.length > 0 ) {
                validEPMTaskObject = clientDataModel.getObject( mo.props.fnd0ParentTask.dbValues[ 0 ] );
            }
        } else if( _.indexOf( mo.modelType.typeHierarchyArray, 'EPMTask' ) > -1 ) {
            validEPMTaskObject = mo;
        }
    }

    return validEPMTaskObject;
};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {String} Property internal value string
 */
var _getPropValue = function( modelObject, propName ) {
    if( !modelObject || !modelObject.uid ) {
        return null;
    }
    if( modelObject.props && modelObject.props[ propName ] && modelObject.props[ propName ].dbValues
        && modelObject.props[ propName ].dbValues[ 0 ] ) {
        return modelObject.props[ propName ].dbValues[ 0 ];
    }
    return null;
};

/**
 * This return true if the task passed in has been viewed by me
 *
 * @param {ModelObject} validEPMTaskObject -- Valid EPM task object
 * @return {Boolean} -- return true if the task passed in has been viewed by me
 */
export let checkTaskViewedByMe = function( validEPMTaskObject ) {
    return validEPMTaskObject && validEPMTaskObject.props && validEPMTaskObject.props.viewed_by_me &&
        validEPMTaskObject.props.viewed_by_me.dbValues[ 0 ] === '1';
};

/**
 * getPerformAction3Input
 *
 * @function getPerformAction3Input
 *
 * @param {ModelObject} actionableObject - The new selection
 * @param {ModelObject} supportingObject - The new selection
 * @param {String} action - The new selection
 * @param {boolean} value Viewed by me property value
 *
 * @returns {Object} SOA input structure
 *
 */
var getPerformAction3Input = function( actionableObject, supportingObject, action, value ) {
    var input = {
        input: []
    };

    var element = {
        actionableObject: actionableObject,
        supportingObject: supportingObject,
        action: action,
        propertyNameValues: {}
    };

    element.propertyNameValues.viewed_by_me = [ value ];
    input.input.push( element );

    return input;
};

/**
 * Check if there is any property that is in edit mode using the edit handler
 * and check if their any edit proeprty then updated the LSD for those proeprties
 * only so that it will have latest LSD. This is fix for defect # LCS-458437
 * @param {Object} modelObject Model obejct whose LSD need to check
 */
var _updateEditPropLSD = function( modelObject ) {
    if( !modelObject || !modelObject.uid || !appCtxSvc.ctx.editInProgress ||
         appCtxSvc.ctx.ViewModeContext && appCtxSvc.ctx.ViewModeContext.ViewModeContext !== 'TableView'  ) {
        return;
    }

    var activeEditHandler = editHandlerSvc.getActiveEditHandler();
    var lsd = _getPropValue( modelObject, 'lsd' );

    // Get the LSD for object
    if( modelObject && modelObject.props && modelObject.props.lsd && modelObject.props.lsd.dbValues
        && modelObject.props.lsd.dbValues[0] ) {
        lsd = modelObject.props.lsd.dbValues[0];
    }
    if( activeEditHandler ) {
        // Get the active edit handler and if not null then only get the lsd proerpty for obejct if not loaded
        // already and then get all modified or editable properties and those are not null then modify the LSD.
        dataManagementService.getProperties( [ modelObject.uid ], [ 'lsd' ] ).then( function() {
            var latestObject = cdmService.getObject( modelObject.uid );
            lsd = _getPropValue( latestObject, 'lsd' );
            if( activeEditHandler && lsd ) {
                var dataSource = activeEditHandler ? activeEditHandler.getDataSource() : null;
                if( dataSource ) {
                    var modifyPropVMo = dataSource.getAllModifiedPropertiesWithVMO();
                    var isMatchFound = false;
                    if( modifyPropVMo && modifyPropVMo.length > 0 ) {
                        for( var idx = 0; idx < modifyPropVMo.length; idx++ ) {
                            var vmoObject = modifyPropVMo[idx ];
                            if( vmoObject && latestObject && vmoObject.uid === latestObject.uid && vmoObject.viewModelProps ) {
                                isMatchFound = true;
                                _.forEach( vmoObject.viewModelProps, function( prop ) {
                                    prop.sourceObjectLastSavedDate = lsd;
                                } );
                            }
                        }
                    }
                    // Editing the table properties through start edit and then change the view mode to list
                    // that it shows save/discard message and clicking on that it will save the properties
                    if( !isMatchFound ) {
                        var _modProps = dataSource.getAllEditableProperties();
                        if( _modProps && _modProps.length > 0 ) {
                            _.forEach( _modProps, function( prop ) {
                                prop.sourceObjectLastSavedDate = lsd;
                            } );
                        }
                    }
                }
            }
        } );
    }
};

/**
 *
 * getPerformAction3Input
 *
 * @function getPerformAction3Input
 *
 * @param {Object} mo Model object whose property need to be set
 */
export let setViewedByMeIfNeeded = function( mo ) {
    var validEPMTask = exports.getValidEPMTaskObject( mo.uid );
    var supportingObject = mo.type === 'Signoff' ? mo : null;

    if( validEPMTask && !exports.checkTaskViewedByMe( validEPMTask ) ) {
        var inputData = getPerformAction3Input( validEPMTask, supportingObject, 'SOA_EPM_set_task_prop_action',
            'true' );
        var lsdPolicy = {
            types: [ {
                name: 'EPMTask',
                properties: [
                    {
                        name: 'lsd'
                    }
                ]
            },
            {
                name: 'Signoff',
                properties: [ {
                    name: 'lsd'
                } ]
            }
            ]
        };
        var lsdPolicyObject = policySvc.register( lsdPolicy );
        soaSvc.postUnchecked( 'Workflow-2014-06-Workflow', 'performAction3', inputData ).then(
            function() {
                policySvc.unregister( lsdPolicyObject );
                var object = cdmService.getObject( mo.uid );
                _updateEditPropLSD( object );
                _removeUnreadTaskIndicator( mo );
                eventBus.publish( 'workflow.updateTaskCount' );
            },
            function( error ) {
                policySvc.unregister( lsdPolicyObject );
                var object = cdmService.getObject( mo.uid );
                _removeUnreadTaskIndicator( mo );
                _updateEditPropLSD( object );
            }
        );
    }
};

var _removeUnreadTaskIndicator = function( mo ) {
    if  ( mo.cellDecoratorStyle && mo.cellDecoratorStyle !== '' ) {
        mo.cellDecoratorStyle = '';
    }
    if ( mo.gridDecoratorStyle && mo.gridDecoratorStyle !== '' ) {
        mo.gridDecoratorStyle = '';
    }
};

/**
 *
 * navigate
 *
 * @param {Object} userObject User object that need to open
 * @function navigate
 */
export let navigate = function( userObject ) {
    if( !userObject || !userObject.uid ) {
        return;
    }
    var showObject = 'myTasks';
    var toParams = {};
    var options = {};

    toParams.userId = userObject.uid;
    options.inherit = false;
    AwStateService.instance.go( showObject, toParams, options );
};

/**
 * Fix for the defect where openInbox commmand not working in the people tile
 *
 * @param {Object} commandContext commandContext to get the user object
 *  @function getUserObject
 */
export let getUserObject = function( commandContext ) {
    var userObject = {};
    if( commandContext.openedObject ) {
        userObject = commandContext.openedObject;
    } else {
        userObject = commandContext.selectionData.value.selected[0];
    }
    return userObject;
};

export let processOutput = ( data, dataCtxNode, searchData ) => {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

export const getSearchCriteriaAndHeaderFromURL = ()=>{
    const getHeaderTitle = function() {
        var property = AwStateService.instance.current.data.headerTitle;
        if( typeof property === 'string' ) {
            return property;
        }
        return localeService.getLocalizedText( property.source, property.key );
    };

    //If the userId parameter is set
    if( AwStateService.instance.params.userId ) {
        //(Try to) load the user
        return dataManagementService.getPropertiesUnchecked( [ {
            uid: AwStateService.instance.params.userId,
            type: ''
        } ], [ 'user_id', 'object_string' ] ) //
            .then( function() {
                return cdmService.getObject( AwStateService.instance.params.userId );
            } ) //
            .then( function( user ) {
                //If user exists
                if( user ) {
                    //Update the header and search context
                    return getHeaderTitle().then( function( baseTitle ) {
                        //Get the current context
                        // var ctx = appCtxService.getCtx( 'location.titles' );

                        let headerTitle = baseTitle + ': ' + user.props.object_string.uiValues[ 0 ];
                        //Update title
                        // ctx.headerTitle = baseTitle + ': ' + user.props.object_string.uiValues[ 0 ];
                        // appCtxService.updateCtx( 'location.titles', ctx );

                        //And update the context
                        let searchCriteria = { userId: user.props.user_id.dbValues[ 0 ] };
                        return {
                            searchCriteria,
                            headerTitle
                        };
                    } );
                }
            } );
    }
};

/**
 * This function will invoke when there is only one selection in Primary Work Area.
 */
let singleSelectionInPrimaryWorkArea = function( selectedObject, isValidViewModel, contentType ) {
    //And the secondary workarea is visible

    /*Mark the task as read.
    This is needed to update the viewed by me and update badge count when user select the tasks
    in table mode or list mode.*/
    setViewedByMeIfNeeded( selectedObject );

    const validEPMTask = getValidEPMTaskObject( selectedObject.uid );
    const currentState = validEPMTask.props.state;
    if( currentState && currentState.dbValues && currentState.dbValues[ 0 ] !== '128' ) {
        //If we are in myTasks sublocation and the active command is not object info
        const activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
        // If user has done start edit then we don't need to bring the complete task panel by default
        // as edit is in progress.
        const isEditInProgress = appCtxSvc.getCtx( 'editInProgress' );
        if( contentType === 'myTasks' && !isEditInProgress &&
            !( activeCommand && activeCommand.commandId === 'Awp0ObjectInfo' ) && isValidViewModel ) {
            //Open the perform task panel
            if( !activeCommand || activeCommand.commandId !== 'Awp0PerformTaskPanel' ) {
                commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
            }
        } else if( contentType === 'myTasks' && !isValidViewModel && activeCommand
        && activeCommand.commandId === 'Awp0PerformTaskPanel' ) {
        // This code check if we are in mytasks location and panel is already up and we are
        // in summary view mode where panel on tool and info area need to be close
            commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
        }
    }
};

/**
 * This function will set the isValidViewModel when viewMode is Summary View or Table Summary View
 */
let isViewModeIsSummaryOrTableSummary = function() {
    let isValidViewModel = false;
    const viewMode = viewModeService.getViewMode();

    if( viewMode && ( viewMode !== 'None' && viewMode !== 'SummaryView' && viewMode !== 'TableSummaryView' ) ) {
        isValidViewModel = true;
    }
    return isValidViewModel;
};

/**
 * This function will check Prefrence and fire the evnts.
 */
export let checkPrefAndFireEvents = function( selected, contentType ) {
    //Get the preference value and based on value show the panel by default or not
    prefService.getLogicalValue( 'WRKFLW_Hide_Perform_Task_Command_ToolAndInfo' ).then( function( result ) {
        let isComamndHidden = false;

        if( result === null || result.length > 0 && result.toUpperCase() === 'TRUE' ) {
            isComamndHidden = true;
        } else {
            isComamndHidden = false;
        }
        let isValidViewModel = true;
        if( isComamndHidden ) {
            isValidViewModel = isViewModeIsSummaryOrTableSummary();
        }
        //If there is a single select in the primary workarea
        if( selected && selected.length === 1 ) {
            singleSelectionInPrimaryWorkArea( selected[0], isValidViewModel, contentType );
        } else if( selected && selected.length === 0 && isValidViewModel ) {
            //'Close' the perform task panel
            //May not be necessary since panel will be automatically closed because command is hidden
            var activeCommand = appCtxSvc.getCtx( 'activeToolsAndInfoCommand' );
            if( activeCommand && activeCommand.commandId === 'Awp0PerformTaskPanel' ) {
                commandPanelService.activateCommandPanel( 'Awp0PerformTaskPanel', 'aw_toolsAndInfo' );
            }
        }
    } );
};

/**
 * This function will show/hide the chart based on selection if the chart is hidden on first load of inbox
 */
export let setChartVisibility = function( selected, searchState ) {
    let newSearchState = { ...searchState.value };
    //If there is a single select in the primary workarea
    if( selected && selected.length === 1 ) {
        newSearchState.selectFirstObjectPreference = 'WRKFLW_preselect_first_task';
        searchState.update( newSearchState );
    } else if( selected && selected.length === 0 ) {
        newSearchState.selectFirstObjectPreference = '';
        newSearchState.forceChart = true;
        newSearchState.isChartVisible = true;
        searchState.update( newSearchState );
    }
};

/**
 * Check the viewed_by_me proeprty for input object and based on that return true or false.
 * If input object is signoff then get this property from parent task and check on that parent task.
 *
 * @param {Object} modelObject Modle object for cell decorator need to be fetched
 * @returns {boolean} True or false based on task is unread or not.
 */
export let isUnreadTask = function( modelObject ) {
    if( !modelObject || !modelObject.uid ) {
        return false;
    }
    // Get the valid EPM task object from input object and then check viewed_by_me on
    // that valid object
    var validEPMTaskObject = exports.getValidEPMTaskObject( modelObject.uid );
    return !checkTaskViewedByMe( validEPMTaskObject );
};

export let checkForSSOReauth = function( data ) {
    //Check for reauth parameter in URL, indicating reauthorization has already occurred. Perform task with retrieved SSO token
    // // var reauth = AwStateService.instance.params.reauthorize;
    var reauth = AwStateService.instance.params.reauthorize;
    //const tokenValue = ssoAuthenticator.getReauthToken();
    if ( reauth && reauth === 'true' ) {
        var supportingObjectUID = AwStateService.instance.params.supportingObjectUID;

        if ( supportingObjectUID && supportingObjectUID !== '' ) {
            var signoffObject = cdmService.getObject( supportingObjectUID );
            loadParentTask( data, signoffObject );
        } else {
            checkForPerformAfterSSOReauthentication( data );
        }
    }
};

export let loadParentTask = function( data, selection ) {
    var objectsToLoad = [];
    objectsToLoad.push( selection );
    dataManagementService.getPropertiesUnchecked( objectsToLoad, [ 'fnd0ParentTask' ] ).then( function() {
        checkForPerformAfterSSOReauthentication( data );
    } );
};


export let checkForPerformAfterSSOReauthentication = function( data ) {
    if( appCtxSvc.ctx && appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] !== 'com.siemens.splm.clientfx.tcui.xrt.showObjectLocation' ) {
    //Check for reauth parameter in URL, indicating reauthorization has already occurred. Perform task with retrieved SSO token
    // if signoff, get the parent PST task
        var actionableObjectUID = AwStateService.instance.params.actionableObjectUID;
        var actionableObjectType = AwStateService.instance.params.actionableObjectType;
        var actionableObject = cdmService.getObject( actionableObjectUID );

        //Only perform for started tasks
        if ( actionableObject && actionableObject.props && actionableObject.props.state && actionableObject.props.state.dbValues[0] !== '4' ) {
            return;
        }
        var action = AwStateService.instance.params.action;
        var supportingValue = AwStateService.instance.params.supportingValue;
        var supportingObjectUID = AwStateService.instance.params.supportingObjectUID;
        var supportingObject = '';
        if ( supportingObjectUID && supportingObjectUID !== '' ) {
            supportingObject = cdmService.getObject( supportingObjectUID );
        }

        //get the token from the URL and set data.password.dbValue value to the token string
        const tokenValue = ssoAuthenticator.getReauthToken();
        //const tokenValue = '22';
        if ( tokenValue && tokenValue !== '' ) {
            data.password = {
                dbValue: tokenValue
            };
        }
        Awp0PerformTask.performTask( data, actionableObject, action, supportingValue, supportingObject );
    }
};

export default exports = {
    getValidEPMTaskObject,
    checkTaskViewedByMe,
    setViewedByMeIfNeeded,
    navigate,
    getUserObject,
    processOutput,
    getSearchCriteriaAndHeaderFromURL,
    checkPrefAndFireEvents,
    setChartVisibility,
    isUnreadTask,
    checkForSSOReauth
};
