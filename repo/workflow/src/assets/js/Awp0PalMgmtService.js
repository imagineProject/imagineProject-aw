// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0PalMgmtService
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import clientDataModel from 'soa/kernel/clientDataModel';
import viewModelObjectSvc from 'js/viewModelObjectService';
import messagingService from 'js/messagingService';
import dmSvc from 'soa/dataManagementService';
import policySvc from 'soa/kernel/propertyPolicyService';
import _ from 'lodash';

var exports = {};

/**
 * Get the input obejct property and return the internal value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 *
 * @returns {Array} Property internal values array
 */
var _getPropValue = function( modelObject, propName ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
        var values = modelObject.props[ propName ].dbValues;
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Check if input object is of type input type. If yes then
 * return true else return false.
 *
 * @param {Object} obj Object to be match
 * @param {String} type Object type to match
 *
 * @return {boolean} True/False
 */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Get the valid task template object as if user made the changes to template after creating PAL
 * then there are multiple GRM relation created and previous root task template is obselete and
 * latest GRM will be in online state.
 * @param {Object} selectedPalObject Selected pal object
 * @param {Array} relationshipObjects All GRM relation objects associated with selected PAL
 *
 * @returns {Object} Correct valid task template object whose stage is not obsolete
 */
var _getValidTaskTemplateObject = function( selectedPalObject, relationshipObjects ) {
    if( !relationshipObjects || relationshipObjects.length <= 0 ) {
        return null;
    }
    // Get the task templates from PAL object and if not null then use the 0th
    // index task template and get the process template from it.
    var taskTemplate = _getPropValue( selectedPalObject, 'task_templates' );
    if( taskTemplate ) {
        taskTemplate = clientDataModel.getObject( taskTemplate );
    }
    var processTemplate = null;
    if( taskTemplate ) {
        var processTemplateUid = _getPropValue( taskTemplate, 'process_template' );
        if( processTemplateUid ) {
            processTemplate = clientDataModel.getObject( processTemplateUid );
        }
    }

    // Check if process template is still null then get the process template based on
    // stage of process template.
    if( !processTemplate ) {
        for( var idx = 0; idx < relationshipObjects.length; idx++ ) {
            var relationshipObject = relationshipObjects[idx];
            if( relationshipObject && relationshipObject.otherSideObject ) {
                var templateObject = clientDataModel.getObject( relationshipObject.otherSideObject.uid );
                if( templateObject && templateObject.props.stage && templateObject.props.stage.dbValues && templateObject.props.stage.dbValues[ 0 ] !== '0' ) {
                    processTemplate = templateObject;
                }
            }
        }
    }

    // Check if process template is null then use the 0th index process template
    if( !processTemplate && relationshipObjects[ 0 ] ) {
        processTemplate = relationshipObjects[ 0 ].otherSideObject;
    }
    return processTemplate;
};

export let getValidTemplateObject = function( selectedPal, relationshipObjects ) {
    return _getValidTaskTemplateObject( selectedPal, relationshipObjects );
};

/**
 * Call SOA to get the process template attached to input PAL object. The process template
 * object will be used to populate the assignment tab for selected PAL.
 *
 * @param {Object} selectedPalObject Selected pal object
 * @return {Object} Process template object
 */
export let getProcessTemplateFromPal = function( selectedPalObject ) {
    var deferred = AwPromiseService.instance.defer();
    var inputData = {
        secondaryObjects: [ {
            uid: selectedPalObject.uid,
            type: 'EPMAssignmentList'
        } ],
        pref: {
            expItemRev: false,
            returnRelations: true,
            info: [ {
                relationTypeName: 'EPM_resource_attachments',
                otherSideObjectTypes: ''
            } ]
        }
    };
    var policy = {
        types: [ {
            name: 'EPMTaskTemplate',
            properties: [ {
                name: 'stage'
            },
            {
                name: 'process_template'
            }
            ]
        } ]
    };
    policySvc.register( policy );

    soaSvc.post( 'Core-2007-09-DataManagement', 'expandGRMRelationsForSecondary', inputData ).then(
        function( response ) {
            if( policy ) {
                policySvc.unregister( policy );
            }
            // Get the process template from relationship
            var processTemplateObject = _getValidTaskTemplateObject( selectedPalObject,  response.output[ 0 ].relationshipData[ 0 ].relationshipObjects );
            deferred.resolve( processTemplateObject );
        } );
    return deferred.promise;
};

/**
 * Check if input object is of type input type. If yes then
 * return true else return false.
 *
 * @param {Object} obj Object to be match
 * @param {String} type Object type to match
 *
 * @return {boolean} True/False
 */
var isOfType = function( obj, type ) {
    if( obj && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Get the model object list from input Uids.
 *
 * @param {Array} objectUids Object Uids array
 * @return {Array} Object array based on input Uids
 */
var _getObjects = function( objectUids ) {
    var objectArray = [];
    _.forEach( objectUids, function( uid ) {
        var object = clientDataModel.getObject( uid );
        if( object ) {
            objectArray.push( object );
        } else {
            objectArray.push( null );
        }
    } );
    return objectArray;
};

/**
 * Get the user assigee or assigner value from group member.
 *
 * @param {Object} viewModelObj View Model object
 *
 * @returns {Object} User view model object
 */
var _getAssigneeValue = function( viewModelObj ) {
    var groupMember = viewModelObj;
    if( viewModelObj.props.user && viewModelObj.props.user.dbValues ) {
        var userObject = clientDataModel.getObject( viewModelObj.props.user.dbValues[ 0 ] );
        if( userObject ) {
            viewModelObj = viewModelObjectSvc.constructViewModelObjectFromModelObject( userObject, 'EDIT' );
        }
    }
    viewModelObj.groupMember = groupMember;
    return viewModelObj;
};

/**
 * Populate all resources information from PAl object and stote that information
 * on map object and return so that that information can be used later.
 *
 * @param {Object} selectedPalObject Selected PAL object from UI.
 * @return {Object} Pal data map that will contain PAL information for invividual template
 */
export let populatePalStructure = function( selectedPalObject ) {
    var palDataMap = new Object();
    var palObject = clientDataModel.getObject( selectedPalObject.uid );
    var taskTemplates = palObject.props.task_templates.dbValues;
    var resources = palObject.props.resources.dbValues;

    if( resources && resources.length > 0 ) {
        for( var idx = 0; idx < resources.length; idx++ ) {
            var resourceObject = clientDataModel.getObject( resources[ idx ] );
            var templateUid = taskTemplates[ idx ];
            var templateObject = clientDataModel.getObject( templateUid );

            var profiles = resourceObject.props.profiles.dbValues;
            var assignedResources = resourceObject.props.resources.dbValues;
            var actions = resourceObject.props.actions.dbValues;
            var profileObjects = _getObjects( profiles );
            var assignedResourcesObjects = _getObjects( assignedResources );
            var reviewQuorum = -100;

            if( resourceObject.props.rev_quorum && resourceObject.props.rev_quorum.dbValues &&
                resourceObject.props.rev_quorum.dbValues[ 0 ] ) {
                reviewQuorum = _.parseInt( resourceObject.props.rev_quorum.dbValues[ 0 ] );
            }

            var ackQuorum = -100;
            if( resourceObject.props.ack_quorum && resourceObject.props.ack_quorum.dbValues &&
                resourceObject.props.ack_quorum.dbValues[ 0 ] ) {
                ackQuorum = _.parseInt( resourceObject.props.ack_quorum.dbValues[ 0 ] );
            }

            // Check if actions is not empty then parse the action values
            // to int values as it will be needed as int while update.
            if( actions && actions.length > 0 ) {
                actions = _.map( actions, _.parseInt );
            }

            var fnd0Assignee = [];
            var fnd0Assigner = [];
            var awp0Reviewers = [];
            var awp0Acknowledgers = [];
            var awp0Notifyees = [];

            // Get all assigned resource objects attached on PAL and then process
            // further to get the information for specific resource.
            if( assignedResourcesObjects && assignedResourcesObjects.length > 0 ) {
                for( var xyz = 0; xyz < assignedResourcesObjects.length; xyz++ ) {
                    var actionIdx = actions[ xyz ];
                    var profileObj = profileObjects[ xyz ];
                    var resourceObj = assignedResourcesObjects[ xyz ];
                    var viewModelObj = viewModelObjectSvc.constructViewModelObjectFromModelObject( resourceObj, 'EDIT' );

                    // If action index is 0 then we need to put information either in assignee or assigner
                    if( actionIdx === 0 ) {
                        viewModelObj = _getAssigneeValue( viewModelObj );
                        // Check if template is of type review, acknowledge or route then we need to populate assigner
                        // else we need info in assignee
                        if( isOfType( templateObject, 'EPMReviewTaskTemplate' ) || isOfType( templateObject, 'EPMAcknowledgeTaskTemplate' ) || isOfType( templateObject, 'EPMRouteTaskTemplate' ) ) {
                            fnd0Assigner.push( viewModelObj );
                        } else {
                            fnd0Assignee.push( viewModelObj );
                        }
                    } else if( actionIdx === 1 || actionIdx === 4 ) { // If action index is 1 then we need to put information in reviewers and 4 when review is required
                        viewModelObj.profile = profileObj;
                        awp0Reviewers.push( viewModelObj );
                    } else if( actionIdx === 2 || actionIdx === 5 ) { // If action index is 2 then we need to put information in acknowledgers and 4 when acknowledge is required
                        viewModelObj.profile = profileObj;
                        awp0Acknowledgers.push( viewModelObj );
                    } else if( actionIdx === 3 ) { // If action index is 3 then we need to put information in notifyees
                        viewModelObj.profile = profileObj;
                        awp0Notifyees.push( viewModelObj );
                    }
                }
            }

            // Create the object with all information and then store that
            // information on map
            var object = {
                templateObject: templateObject,
                resourceObject: resourceObject,
                profiles: profileObjects,
                assignedResourcesObjects: assignedResourcesObjects,
                actions: actions,
                fnd0Assignee: fnd0Assignee,
                fnd0Assigner: fnd0Assigner,
                awp0Reviewers: awp0Reviewers,
                awp0Acknowledgers: awp0Acknowledgers,
                awp0Notifyees: awp0Notifyees,
                rev_quorum: reviewQuorum,
                ack_quorum: ackQuorum
            };
            palDataMap[ templateObject.uid ] = object;
        }
    }
    return palDataMap;
};

/**
 * Update the input model object, action and profile list array based on input action for input
 * model objects.
 *
 * @param {Array} modelObjects Model obejct array that need to be added to valid object array
 * @param {int} actionType Action type that need to be add on action array
 * @param {Array} validResourceList valid resources array
 * @param {Array} actionList Action String array
 * @param {Array} profileList Profile obejct list array
 */
var _updateActionAndProfilePalData = function( modelObjects, actionType, validResourceList, actionList, profileList ) {
    if( !modelObjects || modelObjects.length <= 0 ) {
        return;
    }

    _.forEach( modelObjects, function( modelObject ) {
        var profileObject = null;
        if( modelObject.profile ) {
            profileObject = modelObject.profile;
        }

        // Check if action type is 0 and user is tring to assign user where group member present
        // then use group member instead user
        if( actionType === 0 && modelObject.assigneeGroupMember ) {
            modelObject = modelObject.assigneeGroupMember;
        }

        // Right now we are using it as workaroud for duplicate resource pool cases when duplicate
        // resource pools added to one aw-list component then because of uid check in component, there
        // is one issue to render it correctly. So to handle it we update the uid with some random number
        // to make it unique and then added uniqueUid to contain the original UID for resource pool.
        if( isOfType( modelObject, 'ResourcePool' ) && modelObject.uniqueUid ) {
            modelObject.uid = _.clone( modelObject.uniqueUid );
            delete modelObject.uniqueUid;
        }

        validResourceList.push( modelObject );
        actionList.push( actionType );
        profileList.push( profileObject );
    } );
};

/**
 * Update the PAL data map based on template assignment changes. This will create default
 * info in pal data map for input template object.
 *
 * @param {Object} palDataMap Pal data map that need to be updated
 * @param {Object} selTemplate Selected EPM Task template object for information need to be updated
 * @return {Object} Updated Pal data map that will contain PAL information for invividual template
 */
export let updatePalWithDefaultInfo = function( palDataMap, selTemplate ) {
    // Check if input pal data map is null or template is null then no need to process further
    if( !palDataMap || !selTemplate ) {
        return;
    }

    // Get the template context information from input map based on input template. If information
    // is not present then new template context information will be created.
    var templateContextData = palDataMap[ selTemplate.uid ];
    var isTemplatePresentOnPal = false;
    if( !templateContextData ) {
        isTemplatePresentOnPal = true;
        templateContextData = {
            templateObject: selTemplate,
            resourceObject: [],
            profiles: [],
            assignedResourcesObjects: [],
            actions: [],
            fnd0Assignee: [],
            fnd0Assigner: [],
            awp0Reviewers: [],
            awp0Acknowledgers: [],
            awp0Notifyees: [],
            rev_quorum: -100,
            ack_quorum: -100
        };
    }

    // If template is not present in map then add it here
    if( isTemplatePresentOnPal ) {
        palDataMap[ selTemplate.uid ] = templateContextData;
    }
    return palDataMap;
};

/**
 * Update the PAL data map based on template assignment changes. If information is already
 * present in map then that will be updated else new template information will be added
 * to the map.
 *
 * @param {Object} data Data object
 * @param {Object} palDataMap Pal data map that need to be updated
 * @param {Object} selTemplate Selected EPM Task template object for information need to be updated
 * @return {Object} Updated Pal data map that will contain PAL information for invividual template
 */
export let updatePalStructure = function( data, palDataMap, selTemplate ) {
    // Check if input pal data map is null or template is null then no need to process further
    if( !palDataMap || !selTemplate ) {
        return;
    }

    // Get the template context information from input map based on input template. If information
    // is not present then new template context information will be created.
    var templateContextData = palDataMap[ selTemplate.uid ];
    var isTemplatePresentOnPal = false;
    if( !templateContextData ) {
        isTemplatePresentOnPal = true;
        templateContextData = {
            templateObject: selTemplate,
            resourceObject: [],
            profiles: [],
            assignedResourcesObjects: [],
            actions: [],
            fnd0Assignee: [],
            fnd0Assigner: [],
            awp0Reviewers: [],
            awp0Acknowledgers: [],
            awp0Notifyees: [],
            rev_quorum: -100,
            ack_quorum: -100
        };
    }

    // Check if template is review, Acknowledge or route then populate assigner else assignee
    if( isOfType( selTemplate, 'EPMReviewTaskTemplate' ) || isOfType( selTemplate, 'EPMAcknowledgeTaskTemplate' ) || isOfType( selTemplate, 'EPMRouteTaskTemplate' ) ) {
        templateContextData.fnd0Assigner = data.dataProviders.assignerDataProvider.viewModelCollection.loadedVMObjects;
    } else {
        templateContextData.fnd0Assignee = data.dataProviders.assignerDataProvider.viewModelCollection.loadedVMObjects;
    }

    var actionList = [];
    var profileList = [];
    var validResourceList = [];
    var modelObjects = data.dataProviders.assignerDataProvider.viewModelCollection.loadedVMObjects;

    // Update the map with assignee/assigner information
    _updateActionAndProfilePalData( modelObjects, 0, validResourceList, actionList, profileList );

    // Get the reviewers and additional reviewers from data provider and then add these
    // informations to reviewers or acknowledgers based on template
    var reviewers = data.dataProviders.reviewersDataProvider.viewModelCollection.loadedVMObjects;
    var filterReviewers = [];
    if( reviewers && reviewers.length > 0 ) {
        _.forEach( reviewers, function( reviewer ) {
            if( !isOfType( reviewer, 'EPMSignoffProfile' ) ) {
                filterReviewers.push( reviewer );
            }
        } );
    }

    var additionalReviewers = data.dataProviders.adhocReviewersDataProvider.viewModelCollection.loadedVMObjects;
    Array.prototype.push.apply( filterReviewers, additionalReviewers );

    // This is needed for showing the acknowledgers in reviewers section for acknowledge taks template
    if( isOfType( selTemplate, 'EPMAcknowledgeTaskTemplate' ) ) {
        templateContextData.awp0Acknowledgers = filterReviewers;
        _updateActionAndProfilePalData( filterReviewers, 2, validResourceList, actionList, profileList );
    } else {
        templateContextData.awp0Reviewers = filterReviewers;
        _updateActionAndProfilePalData( filterReviewers, 1, validResourceList, actionList, profileList );
    }

    // If template is route task template then addiitonaly populate acknowledgers and notifees
    if( isOfType( selTemplate, 'EPMRouteTaskTemplate' ) ) {
        templateContextData.awp0Acknowledgers = data.dataProviders.acknowledgersDataProvider.viewModelCollection.loadedVMObjects;
        _updateActionAndProfilePalData( templateContextData.awp0Acknowledgers, 2, validResourceList, actionList, profileList );

        templateContextData.awp0Notifyees = data.dataProviders.notifyeesDataProvider.viewModelCollection.loadedVMObjects;
        _updateActionAndProfilePalData( templateContextData.awp0Notifyees, 3, validResourceList, actionList, profileList );
    }

    templateContextData.actions = actionList;
    templateContextData.profiles = profileList;
    templateContextData.assignedResourcesObjects = validResourceList;

    // If template is not present in map then add it here
    if( isTemplatePresentOnPal ) {
        palDataMap[ selTemplate.uid ] = templateContextData;
    }
    return palDataMap;
};

/**
 * Check if input tempalte uid not present in ecisting tempalte list and action lsit for that
 * tempalte is empty that means it null info so return false else return true.
 *
 * @param {Array} existingTaskTemplates Existing template array
 * @param {Object} object Contains tempalte info that need to be saved on PAL
 * @return {boolean} isValid True/False
 */
var _isValidTemplateInfo = function( existingTaskTemplates, object ) {
    var isValid = true;
    if( existingTaskTemplates && _.indexOf( existingTaskTemplates, object.templateObject.uid ) === -1 && object.actions.length <= 0 ) {
        isValid = false;
    }
    return isValid;
};

/**
 * Create the update PAL SOA input strucutre from input objects.
 *
 * @param {Object} palDataMap Map that will contain pal information
 * @param {Object} processTemplateObject Process template for which PAL is associated
 * @param {Object} selectedPalObject PAL obejct
 * @param {Object} palDataStructure Structure that will contain all information that needed for
 *                 pal name, pal desc and shared value
 * @return {Object} createOrUpdatePALIn SOA input structure array
 */
export let updatePalInputStructure = function( palDataMap, processTemplateObject, selectedPalObject, palDataStructure ) {
    var createOrUpdatePALIn = [];
    var resourceLists = [];
    var existingTaskTemplates = null;
    if( selectedPalObject.props.task_templates && selectedPalObject.props.task_templates.dbValues ) {
        existingTaskTemplates = selectedPalObject.props.task_templates.dbValues;
    }

    _.forEach( palDataMap, function( object ) {
        var resourceObejct = {
            taskTemplate: object.templateObject,
            profiles: object.profiles,
            actions: object.actions,
            templateResources: object.assignedResourcesObjects,
            revQuorum: object.rev_quorum,
            ackQuorum: object.ack_quorum
        };

        // Check if template info is not present already on PAL and action list is empty
        // then don't add this tempalte info as this is empty and not needed to be saved on server
        if( _isValidTemplateInfo( existingTaskTemplates, object ) ) {
            resourceLists.push( resourceObejct );
        }
    } );
    var palDesc = palDataStructure.palDesc;
    if( !_.isArray( palDesc ) ) {
        palDesc = [ palDesc ];
    }
    if( palDesc && !palDesc[ 0 ] ) {
        palDesc = [];
    }

    var additionalData = {
        palToUpdate: [ selectedPalObject.uid ]
    };

    if( !_.isUndefined( palDataStructure.isShared ) ) {
        additionalData.isShared = [ palDataStructure.isShared.toString() ];
    }

    var object = {
        clientID: 'updatePALClient',
        palName: palDataStructure.palName,
        workflowTemplate: processTemplateObject.uid,
        palDescription: palDesc,
        resourceLists: resourceLists,
        additionalData: additionalData
    };
    createOrUpdatePALIn.push( object );
    return createOrUpdatePALIn;
};

/**
 * Get the error message string from SOA response that will be displayed to user
 * @param {Object} response - The SOA response object
 *
 * @return {Object} Error message string
 */
var _getErrorMessage = function( response ) {
    var err = null;
    var message = '';

    // Check if input response is not null and contains partial errors then only
    // create the error object
    if( response && ( response.ServiceData.partialErrors || response.ServiceData.PartialErrors ) ) {
        err = soaSvc.createError( response.ServiceData );
    }

    // Check if error object is not null and has partial errors then iterate for each error code
    // and filter out the errors which we don't want to display to user
    if( err && err.cause && err.cause.partialErrors ) {
        _.forEach( err.cause.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                for( var idx = 0; idx < partErr.errorValues.length; idx++ ) {
                    var errVal = partErr.errorValues[ idx ];

                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '</br>' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                }
            }
        } );
    }

    return message;
};

/**
 * Save the template assignmetn by calling SOA. It will create the SOA input structure
 * and then call SOA to update the assignments.
 *
 * @param {Object} palDataMap Map that will contain pal information
 * @param {Object} processTemplateObject Process template for which PAL is associated
 * @param {Object} selectedPalObject PAL obejct
 * @param {Object} palDataStructure Structure that will contain all information that needed for
 *                 pal name, pal desc and shared value
 * @return {Promise} deferred Deffered object to return the results
 */
export let saveTemplateAssignments = function( palDataMap, processTemplateObject, selectedPalObject, palDataStructure ) {
    var soaInput = exports.updatePalInputStructure( palDataMap, processTemplateObject, selectedPalObject, palDataStructure );

    var inputData = {
        input: soaInput
    };
    var deferred = AwPromiseService.instance.defer();
    soaSvc.postUnchecked( 'Workflow-2019-06-Workflow', 'createOrUpdatePAL', inputData ).then( function( response ) {
        var message = _getErrorMessage( response );

        if( message && message.length > 0 ) {
            messagingService.showError( message );
        }
        deferred.resolve();
    },
    function( error ) {
        messagingService.showError( error.message );
        deferred.reject( error );
    } );
    return deferred.promise;
};

/**
 * Create the create PAL SOA input strucutre from input data object.
 *
 * @param {Object} data Data object
 * @return {Object} createOrUpdatePALIn SOA input structure array
 */
export let createPalInputStructure = function( data ) {
    var createOrUpdatePALIn = [];
    // Check if input data is null then return empty array
    if( !data ) {
        return createOrUpdatePALIn;
    }

    var additionalData = {
        isShared: [ data.isSharedOption.dbValue.toString() ]
    };

    // Check if PAL is selected from UI then new pal will be created based on existing pal so
    // pass that information in additional data else pass flag to create new empty pal
    if( data.assignments && data.assignments.length > 0 && data.processAssignment.dbValue !== 'None'
    && data.processAssignment.dbValue.uid ) {
        additionalData.palToCopy = [ data.processAssignment.dbValue.uid ];
    }

    // Get the pal description and if it is null then send
    // empty value array while creation.
    var palDesc = data.palDescription.dbValue;
    if( _.isArray( palDesc ) && palDesc[0] ) {
        palDesc = palDesc[0];
    }
    // Additional check if pal description is still invalid then use empty string. This is just safety check
    if( !palDesc ) {
        palDesc = '';
    }

    var object = {
        clientID: 'awClient',
        palName: data.palName.dbValue,
        workflowTemplate: data.workflowTemplates.dbValue.uid,
        palDescription: [ palDesc ],
        resourceLists: [],
        additionalData: additionalData
    };
    createOrUpdatePALIn.push( object );
    return createOrUpdatePALIn;
};

/**
 * Check if logged in user is group admin or DBA then based on that
 * return true or false.
 * @param {Object} subPanelContext context object
 * @return {deferred} - deferred object that will be true/false value
 */
export let isGroupAdminOrSysAdmin = function( subPanelContext ) {
    if( !subPanelContext.session.current_user_session.properties.fnd0groupmember || !subPanelContext.session.current_user_session.properties.fnd0groupmember.dbValue ) {
        return false;
    }
    var deferred = AwPromiseService.instance.defer();
    var groupMember = subPanelContext.session.current_user_session.properties.fnd0groupmember.dbValue;
    var groupName = subPanelContext.session.current_user_session.properties.group_name.dbValue;
    var uidsToLoad = [ groupMember ];

    // Get the ga property on group member
    dmSvc.getProperties( uidsToLoad, [ 'ga' ] ).then( function() {
        var groupMemberObject = clientDataModel.getObject( groupMember );
        var isGroupAdmin = false;
        // Check if group member obejct is not null and ga property is not 0.
        if( groupMemberObject && groupMemberObject.props.ga && groupMemberObject.props.ga.dbValues ) {
            isGroupAdmin = parseInt( groupMemberObject.props.ga.dbValues[ 0 ] ) !== 0;
        }

        if( isGroupAdmin || groupName === 'dba' ) {
            isGroupAdmin = true;
        }
        deferred.resolve( isGroupAdmin );
    } );
    return deferred.promise;
};

/**
 * Check if input proeprty old value and new value is not same
 * then only put the proeprty in edit mode else ignore and return from here.
 *
 * @param {Object} prop Property that need to be modified
 * @param {Array} newValues New values that will be set
 */
var _updateProperty = function( prop, newValues ) {
    var dbValues = [];
    var uiValues = [ '' ];
    var uiValue = '';
    var dbValue = '';
    if( newValues && newValues.length > 0 ) {
        uiValues = [];
        for( var idx = 0; idx < newValues.length; idx++ ) {
            var object = newValues[ idx ];
            if( object ) {
                if( idx === 0 ) {
                    dbValue = object.uid;
                } else {
                    dbValue = dbValue + ',' + object.uid;
                }

                dbValues.push( object.uid );
                uiValues.push( object.props.object_string.uiValue );
                if( idx === 0 ) {
                    uiValue = object.props.object_string.uiValue;
                } else {
                    uiValue = uiValue + ',' + object.props.object_string.uiValue;
                }
            }
        }
    }

    // Check if prop old value and new value both are same or not.
    var isEqual = _.isEqual( JSON.stringify( prop.dbValue ), JSON.stringify( dbValue ) );

    // If both are equal then return from here otherwise update property value
    if( isEqual ) {
        return;
    }

    prop.dbValues = dbValues;
    prop.dbValue = dbValues;
    prop.uiValues = uiValues;
    prop.uiValue = uiValue;
    prop.displayValues = uiValues;
    prop.value = dbValues;
    prop.values = dbValues;
    prop.valueUpdated = true;
    prop.isEditable = true;
};

/**
 * Update task template node in assignment tree based on changes done from UI.
 *
 * @param {Array} selectedObjects Selected tree node array that need to be updated
 * @param {Object} workflowPalData PAL data context object that holds all PAL assignemnt info
 */
export let updateTemplateAssignmentNode = function( selectedObjects, workflowPalData ) {
    if( !selectedObjects || selectedObjects.length <= 0 ) {
        return;
    }
    var selTreeNode = selectedObjects[ 0 ];
    var palDataMap = workflowPalData.palDataMap;

    // Get the present assignment info from PAL data map and then update the respecitve properties
    var templateContext = palDataMap[ selTreeNode.uid ];

    // Get the template context info from PAL map and check if proeprty is modified or not
    // and based on the values put the specific cells in edit mode.
    if( templateContext ) {
        _updateProperty( selTreeNode.props.fnd0Assignee, templateContext.fnd0Assignee );
        _updateProperty( selTreeNode.props.fnd0Assigner, templateContext.fnd0Assigner );

        _updateProperty( selTreeNode.props.awp0Reviewers, templateContext.awp0Reviewers );

        _updateProperty( selTreeNode.props.awp0Acknowledgers, templateContext.awp0Acknowledgers );
        _updateProperty( selTreeNode.props.awp0Notifyees, templateContext.awp0Notifyees );
    }
};

/**
 * Get the valid PAL object based on different cases like PAL object is selected in assignment list location
 * or PAL object is opened. This will be used to get correct PAL object so we can do RHW actions on correct
 * PAL object.
 *
 * @param {Object} pSelected Parent selection object if any
 * @param {Object} openedObject Opened object if user opened PAL object
 * @param {Object} selectedObject Selected object that will be PAL object or any selection in assignment table
 * @returns {Object} Valid PAL object that will be used for respective action
 */
export let getValidPALObject = function( pSelected, openedObject, selectedObject ) {
    let validObject = null;
    // Check if opened object is not null and is of type EPMAssignmentList then that means
    // we have opened PAL object so use that object directly.
    if( openedObject && isOfType( openedObject, 'EPMAssignmentList' ) ) {
        validObject = openedObject;
        return validObject;
    }
    // Check if parent selection is not null and is of type EPMAssignmentList then that means
    // we have PAL object selected as parent seelction and some task template in assignment table
    // so use that parnet selection object directly.
    if( pSelected && isOfType( pSelected, 'EPMAssignmentList' ) ) {
        validObject = pSelected;
        return validObject;
    }
    // Check if parent selection is null and selectedObject is of type EPMAssignmentList then that means
    // we have PAL object selected as seelction  so use that selection object directly.
    if( selectedObject && !pSelected && isOfType( selectedObject, 'EPMAssignmentList' ) ) {
        validObject = selectedObject;
    }
    return validObject;
};

/**
 * Populate the subPanel context object from panelContext value present on appctx
 * object and return the subPanelContext object.
 *
 * @param {Object} panelContext Panel context information being used on app context
 * @param {Object} addUserPanelState User panel state object
 * @returns {Object} Returns the user panel data by reading the values from panelCOntext
 *                  and returns.
 */
export let populatePanelContextData = function( panelContext, addUserPanelState ) {
    var panelData = {};
    if( panelContext ) {
        panelData = _.clone( panelContext );
    }
    const userPanelState = { ...addUserPanelState };

    // Check if input workflow pal state object is not null and contains the current user uid then add that to user panel
    // state object so that based on that project info can be loaded
    if( panelData.workflowPalState && panelData.workflowPalState.value && panelData.workflowPalState.value.currentUserUid && !_.isEmpty( panelData.workflowPalState.value.currentUserUid )
    && userPanelState && userPanelState.criteria ) {
        userPanelState.criteria.selectedObject = panelData.workflowPalState.value.currentUserUid;
    }

    return {
        panelData : panelData,
        isDataInit : true,
        userPanelState : userPanelState
    };
};

export default exports = {
    getProcessTemplateFromPal,
    getValidTemplateObject,
    populatePalStructure,
    updatePalWithDefaultInfo,
    updatePalStructure,
    updatePalInputStructure,
    saveTemplateAssignments,
    createPalInputStructure,
    isGroupAdminOrSysAdmin,
    updateTemplateAssignmentNode,
    getValidPALObject,
    populatePanelContextData
};

