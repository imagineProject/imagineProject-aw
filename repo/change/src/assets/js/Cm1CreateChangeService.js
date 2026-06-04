// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Cm1CreateChangeService
 */
import AwPromiseService from 'js/awPromiseService';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
import dmSvc from 'soa/dataManagementService';
import appCtxSvc from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
const _localTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import _, { each } from 'lodash';
import browserUtils from 'js/browserUtils';
import messageSvc from 'js/messagingService';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import cmUtils from 'js/changeMgmtUtils';
import AwStateService from 'js/awStateService';
import navigationSvc from 'js/navigationService';
import tcDefPasteHandler from 'js/tcDefaultPasteHandler';

var exports = {};
//To Do: Need to remove parentData dependency in future
var parentData = {};

var _reviseEventListener = null;
var _pasteConcurrentChangeEventListener = null;

/**
 * flag used to turn on trace level logging
 */
var _debug_logIssuesActivity = browserUtils.getWindowLocationAttributes().logIssuesActivity !== undefined;

/**
 * return Data
 *
 */
export let getData = function() {
    return parentData;
};

/**
 * Select default type if provider has only change type to show in Create Change Panel
 * @param {dataProvider} getCreatableChangeTypesProvider
 */
export let setDefaultSelectedType = function( getCreatableChangeTypesProvider ) {
    getCreatableChangeTypesProvider.changeObjectsSelection( 0, 0, true );
};


/**
 * Store data member for main create change panel which will be used to updated attachement list
 * @param {Object} declViewModel - The create change panel's view model object
 * @returns {Object} showCopyOptions value
 * @param {Object} derivedFromObjects - selected object to derive
 */
let _loadCreateChangeTabData = function( declViewModel, derivedFromObjects ) {
    // Initialize some data
    if( declViewModel.attachments === null || declViewModel.attachments === undefined ) {
        console.log( 'UnExpected NULL attachement found.' );
    }

    // Initialize getAttachments dataProvider
    if( declViewModel.attachments !== undefined && declViewModel.attachments !== null ) {
        declViewModel.dataProviders.getAttachments.update( declViewModel.attachments,
            declViewModel.attachments.length );
    }

    // Check Create Change Panel is for Derive Object or not
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;

    let newShowCopyOptionsData = _.clone( declViewModel.showCopyOptions );

    //Show Copy Option Or not
    if( isDerive ) {
        var selectedChangeObjects = derivedFromObjects;
        if( selectedChangeObjects && selectedChangeObjects.length === 1 ) {
            newShowCopyOptionsData.dbValue = true;
            cmUtils.populateImplementsSection( selectedChangeObjects, declViewModel );
        }
    }

    //store create change panel data to a variable.
    parentData = declViewModel;

    return {
        showCopyOptions: newShowCopyOptionsData
    };
};

/**
 * Return create input for create change operation.
 *
 * @param {Object} data - The panel's view model object
 * @param {Boolean} isSubmit - Is created object need to be submitted to Workflow
 * @param {Object} editHandler - Edit handler
 * @param {Object} participantInfo- Participant related information
 * @param {Object} derivedFromObjects - selected object to derive
 */
export let getCreateInput = function( data, isSubmit, editHandler, participantInfo, derivedFromObjects ) {
    var deferred = AwPromiseService.instance.defer();

    var soaInput = {};
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
    if( !isDerive ) {
        soaInput = _getInputForCreateOperation( data, isSubmit, editHandler, participantInfo );
        deferred.resolve( soaInput );
    } else {
        soaInput = _getInputForDeriveOperationNewSOA( data, isSubmit, editHandler, derivedFromObjects );
        deferred.resolve( soaInput );
    }

    return deferred.promise;
};

/**
 * Returns SOA Inputs for Create/Create Submit Change objects
 * @param {Data} data
 * @param {Boolean} isSubmit
 * @param {Object} editHandler
 * @param {Object} participantInfo- Participant related information
 * @returns {Promise} For resolved state returns Soa Input
 */
const _getInputForCreateOperation = function( data, isSubmit, editHandler, participantInfo ) {
    let newData = _.clone( data );

    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};
    var allObjectUid = [];
    var selectedChangeObjects = appCtxSvc.ctx.mselected;
    if( selectedChangeObjects ) {
        selectedChangeObjects = cmUtils.getAdaptedObjectsForSelectedObjects( selectedChangeObjects );
        for( var i = 0; i < selectedChangeObjects.length; ++i ) {
            allObjectUid.push( selectedChangeObjects[ i ].uid );
        }
    }

    // Reset workflow data else Pin panel will always take last value from data.
    // create input workflow data structure for new SOA.
    newData.workflowData = {
        templateName: '',
        submitToWorkflow: isSubmit,
        additionalWorkflowData: {}
    };

    cmUtils.populateDataToBePopulated( parentData, newData );

    //add cm0InContextObjects property
    //cm0InContextObjects property was added to the create input of ChangeItemRevision in Tc12.2
    //It contains the in context objects for the change being created
    //These objects are created in the change item revision default relation folder
    //add additional vmo to data.additionalVMProps
    let additionalVMProps = {};
    additionalVMProps.revision__cm0InContextObjects = {};
    additionalVMProps.revision__cm0InContextObjects.propertyName = 'revision__cm0InContextObjects';
    additionalVMProps.revision__cm0InContextObjects.dbValue = [];
    if( selectedChangeObjects ) {
        for( var k = 0; k < selectedChangeObjects.length; k++ ) {
            if( cmm.isInstanceOf( 'BOMLine',
                selectedChangeObjects[ k ].modelType ) ) {
                additionalVMProps.revision__cm0InContextObjects.dbValue.push( selectedChangeObjects[ k ].props.bl_revision.dbValues );
            } else{
                additionalVMProps.revision__cm0InContextObjects.dbValue.push( selectedChangeObjects[ k ].uid );
            }
        }
    }

    additionalVMProps.revision__cm0InContextObjects.valueUpdated = true;
    additionalVMProps.revision__cm0InContextObjects.isArray = true;

    //selectedResponsibleUser property work for Plant Problem Report.
    //It will get pushed in compound create input i.e. 'participants' property on pdm1ProblemItemRevision BO.
    if( newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects && newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects.length > 0 ) {
        additionalVMProps.revision__participants = {};
        additionalVMProps.revision__participants.propertyName = 'revision__participants';
        additionalVMProps.revision__participants.dbValue = [];
        additionalVMProps.revision__participants.dbValue.push( newData.dataProviders.getAssignedResponsibleUser.viewModelCollection.loadedVMObjects[ 0 ].uid );
        additionalVMProps.revision__participants.valueUpdated = true;
        additionalVMProps.revision__participants.isArray = true;
    }

    //qa0FindingGuideline "Audit Finding Guideline" (used in Qa0QualityAudit template)
    if( newData.qa0FindingGuideline && newData.qa0FindingGuideline.dbValue !== '' ) {
        additionalVMProps.qa0FindingGuideline = {};
        additionalVMProps.qa0FindingGuideline.dbValue = [];
        additionalVMProps.qa0FindingGuideline.dbValue.push( newData.qa0FindingGuideline.dbValue );
        additionalVMProps.qa0FindingGuideline.valueUpdated = true;
        additionalVMProps.qa0FindingGuideline.isArray = false;
    }

    newData.additionalVMProps = additionalVMProps;

    //since without objCreateInfo, we need set creationType
    newData.creationType = newData.selectedType.dbValue;
    var returnedinput = cmUtils.getCreateInputFromDerivePanel( newData, 'CREATE', editHandler, participantInfo );

    //This will create change object in selected folder. In case of Change Incontext or Derive It will create change object in changes tab
    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
        returnedinput[ 0 ].pasteProp = 'contents';
        var targetObject = {
            uid: appCtxSvc.ctx.selected.uid,
            type: 'Folder'
        };
        returnedinput[ 0 ].targetObject = targetObject;
    }

    soaInput = returnedinput;

    deferred.resolve( soaInput );
    return deferred.promise;
};


/**
 * This method is used to get the DeriveInput from getDeepCopyData SOA
 * @param {Object} selectedChangeObject the object to get deepcopydata
 * @param {Boolean} isSubmit
 * @param {Object} editHandler
 * @param {Object} derivedFromObjects - selected object to derive
 * @returns {Object} DeepCopy Rules
 */
var _getInputForDeriveOperationNewSOA = function( data, isSubmit, editHandler, derivedFromObjects ) {
    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};
    var workflowString = '';
    var isPropagateRelation = true;

    //selected change objects which needs to be derived.
    var selectedChangeObjectsToDerive = derivedFromObjects;
    var selectedChangeObjectsToDeriveUids = [];
    _.forEach( selectedChangeObjectsToDerive, function( vmo ) {
        var sObject = {
            type: vmo.type,
            uid: vmo.uid
        };
        selectedChangeObjectsToDeriveUids.push( sObject );
    } );

    //set cm0DerivedFrom to data so that getCreateInputForDerive method will populate create Input.
    let additionalVMProps = {};
    additionalVMProps.revision__cm0DerivedFrom = {};
    additionalVMProps.revision__cm0DerivedFrom.propertyName = 'revision__cm0DerivedFrom';
    additionalVMProps.revision__cm0DerivedFrom.dbValue = [];
    for( var k = 0; k < selectedChangeObjectsToDerive.length; k++ ) {
        additionalVMProps.revision__cm0DerivedFrom.dbValue.push( selectedChangeObjectsToDerive[ k ].uid );
    }
    additionalVMProps.revision__cm0DerivedFrom.valueUpdated = true;
    additionalVMProps.revision__cm0DerivedFrom.isArray = true;
    data.additionalVMProps = additionalVMProps;

    //since without objCreateInfo, we need set creationType
    data.creationType = data.selectedType.dbValue;

    // Initializing workflow data, this will be used in getCreateInputFromDerivePanel to populate workflowData.
    data.workflowData = {};

    //Get input property from panel.
    var deriveCreateInput = cmUtils.getCreateInputFromDerivePanel( data, null, editHandler  );
    var derivePropertyData;
    if( deriveCreateInput.boName !== undefined ) {
        derivePropertyData = deriveCreateInput;
    } else if( deriveCreateInput.length > 0 ) {
        derivePropertyData = deriveCreateInput[0].createData;

        // Get workflow data from Derive Panel.
        data.workflowData = deriveCreateInput[0].workflowData;
    }

    // Get workflow template information from workflowData.
    if ( data.workflowData && data.workflowData.templateName && data.workflowData.templateName !== '' ) {
        workflowString = data.workflowData.templateName;
    }

    //This is for a PR fix when revision_id was not present on stylesheet. if revision property is not present than also we need to return cm0DerivableFrom
    if( derivePropertyData && derivePropertyData.compoundDeriveInput && !derivePropertyData.compoundDeriveInput.revision ) {
        var typeName = data.selectedType.dbValue + 'Revision';
        var derivedFromObjects = [];
        for( var k = 0; k < selectedChangeObjectsToDerive.length; k++ ) {
            derivedFromObjects.push( selectedChangeObjectsToDerive[ k ].uid );
        }
        var revision = {
            boName: typeName,
            propertyNameValues: {
                cm0DerivedFrom: derivedFromObjects
            }
        };
        derivePropertyData.compoundDeriveInput.revision = [];
        derivePropertyData.compoundDeriveInput.revision[ 0 ] = revision;
    }

    //we only process deepcopy in case of single select Derive from ECR to ECN
    var processDeepCopy = false;
    if( appCtxSvc.ctx.mselected.length === 1 ) {
        processDeepCopy = true;
    }

    var deepCopyDatas = [];
    var deepCopyDataForType = appCtxSvc.ctx.deepCopyData;

    if( appCtxSvc.ctx && appCtxSvc.ctx.deriveRelationsDataProviders && processDeepCopy ) {
        var deriveRelationProviders = appCtxSvc.ctx.deriveRelationsDataProviders;
        if( deriveRelationProviders && deriveRelationProviders.length > 0 ) {
            for( var i = 0; i < deriveRelationProviders.length; i++ ) {
                var deriveRelProvider = deriveRelationProviders[ i ];
                var relName = deriveRelProvider.relationName;

                for( var a in deepCopyDataForType ) {
                    var deepCopyRelation = deepCopyDataForType[ a ].propertyValuesMap.propertyName[ 0 ];
                    if( relName !== deepCopyRelation ) {
                        continue;
                    }

                    var dataProvider = deriveRelProvider.dataProvider;
                    var selectedObjects = dataProvider.selectedObjects;

                    var selectedObjectUids = [];
                    if( selectedObjects && selectedObjects.length > 0 ) {
                        for( var j = 0; j < selectedObjects.length; j++ ) {
                            selectedObjectUids.push( selectedObjects[ j ].uid );
                        }
                    }

                    var deepCopyObjUid = deepCopyDataForType[ a ].attachedObject.uid;
                    var found = selectedObjectUids.includes( deepCopyObjUid );
                    if( !found ) { // we only pass information about object which are not selected. selected object will be processed as per deepcopy rule.
                        //set deepcopy action as NoCopy for non-selected objects
                        deepCopyDataForType[ a ].propertyValuesMap.copyAction[ 0 ] = 'NoCopy';

                        var attachedObjectUid = {
                            type: deepCopyDataForType[ a ].attachedObject.type,
                            uid: deepCopyDataForType[ a ].attachedObject.uid
                        };
                        var deepCopyData = {
                            attachedObject: attachedObjectUid,
                            deepCopyProperties: deepCopyDataForType[ a ].propertyValuesMap,
                            operationInputType: deepCopyDataForType[ a ].operationInputTypeName,
                            childDeepCopyData: deepCopyDataForType[ a ].childDeepCopyData,
                            inputProperties: deepCopyDataForType[ a ].operationInputs
                        };
                        deepCopyDatas.push( deepCopyData );
                    }
                }
            }
        }
    }

    soaInput = {
        selectedObjects: selectedChangeObjectsToDeriveUids,
        derivePropertyData,
        deepCopyDatas,
        submitToWorkflow: isSubmit,
        workflowTemplateName: workflowString,
        propagateRelation: isPropagateRelation
    };

    deferred.resolve( soaInput );

    return deferred.promise;
};

/**
 * Return deriveOptions in input for derive operation of CAPA.
 * @param {Object} data - The panel's view model object
 */
export let getDeriveOptions = function( data ) {
    var selectedSymptomDefect = data.dataProviders.getSymptomDefectProvider.viewModelCollection.loadedVMObjects[ 0 ];
    var copyAction = Boolean( data.subPanelContext.sharedData.selectedObjects && data.subPanelContext.sharedData.selectedObjects.deriveType && data.subPanelContext.sharedData.selectedObjects.deriveType.dbValue === 'Duplicate' ||  appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'C2CapaRevision' ) > -1 );
    var UID = selectedSymptomDefect?.uid;
    var attachedObjectUid = {
        type: selectedSymptomDefect?.type,
        uid: UID
    };

    //For Derive PSP from symptom defect
    if ( appCtxSvc.ctx.mselected[0].modelType.typeHierarchyArray.indexOf( 'CAW0Defect' ) > -1 && appCtxSvc.getCtx( 'pselected' ) !== undefined &&
     appCtxSvc.getCtx( 'pselected' ).modelType &&
     appCtxSvc.getCtx( 'pselected' ).modelType.typeHierarchyArray.indexOf( 'C2IssueRevision' ) > -1  ) {
        copyAction = true;
    }

    return {
        targetObject: attachedObjectUid,
        targetRelation: 'CPA0ProblemDescription',
        targetAsDuplicate: copyAction
    };
};

/**
 * Action handler used by BIOS service for creating IssueReports for hosted AW. Get typename for object type to
 * create from the CreateIssueHostedMode context.
 *
 * @param {Object} data - The panel's view model object
 *
 * @returns {Promise} Resolved when 'data' is set with
 */
export let handleHostedModeIssueTypeCreation = function( data ) {
    var hostedMode = appCtxSvc.getCtx( 'CreateIssueHostedMode' );
    var issueTypeName = 'IssueReport';
    if( _debug_logIssuesActivity ) {
        logger.info( 'hostIssues: ' + 'Entered Cm1CreateChangeService::handleHostedModeIssueTypeCreation' );
    }
    if( hostedMode ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'CreateIssueHostedMode ctx exists.' );
        }
        if( hostedMode.IssueTypeName ) {
            issueTypeName = hostedMode.IssueTypeName;
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'Supplied IssueTypeName = \'' + issueTypeName + '\'' );
            }
        }
    }
    var modelType = cmm.getType( issueTypeName );
    if( modelType ) {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'We were able to obtain modelType for ' + issueTypeName );
            logger.info( 'hostIssues: ' + 'modelType displayName is \'' + modelType.displayName + '\'' );
        }
        data.selectedType.dbValue = issueTypeName;
        data.selectedTypeDisplayName.dbValue = modelType.displayName;
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'About to call uwPropertyService.createViewModelProperty.' );
        }
        var vmProperty = uwPropertyService.createViewModelProperty( issueTypeName, modelType.displayName, 'STRING', '', '' );
        if( !vmProperty ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'createViewModelProperty did not return a vmProperty.' );
            }
        }
        data.displayedType = vmProperty;
        return AwPromiseService.instance.resolve();
    }
    return soaSvc.ensureModelTypesLoaded( [ issueTypeName ] ).then( function() {
        if( _debug_logIssuesActivity ) {
            logger.info( 'hostIssues: ' + 'Had to call ensureModelTypesLoaded and it succeeded.' );
        }
        var modelType = cmm.getType( issueTypeName );
        if( modelType ) {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'We were able to obtain modelType for ' + issueTypeName );
                logger.info( 'hostIssues: ' + 'modelType displayName is \'' + modelType.displayName + '\'' );
            }
            data.selectedType.dbValue = issueTypeName;
            data.selectedTypeDisplayName.dbValue = modelType.displayName;

            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'About to call uwPropertyService.createViewModelProperty.' );
            }
            var vmProperty = uwPropertyService.createViewModelProperty( issueTypeName, modelType.displayName, 'STRING', '', '' );

            if( !vmProperty ) {
                if( _debug_logIssuesActivity ) {
                    logger.info( 'hostIssues: ' + 'createViewModelProperty did not return a vmProperty.' );
                }
            }
            data.displayedType = vmProperty;
        } else {
            if( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'Had to call ensureModelTypesLoaded and it failed.' );
            }
            return AwPromiseService.instance.reject( 'Unknown issueTypeName: ' + issueTypeName );
        }
    } );
};

/**
 * Check if user is trying to create simple change object and based on that return true or false.
 *
 * @param {Object} selectedType Type object that need to be created
 *
 * @returns {boolean} True/False based on simple change object in creation or not.
 */
var _isSimpleChangeObjectCreation = function( selectedType ) {
    var isCreateSimpleChange = false;
    if( !selectedType || !selectedType.props || !selectedType.props.type_name ) {
        return isCreateSimpleChange;
    }
    isCreateSimpleChange = selectedType.props.type_name.dbValue === 'Cm0SimpleChange' ||
    selectedType.props.parent_types && selectedType.props.parent_types.dbValues.indexOf( 'TYPE::Cm0SimpleChange::Cm0SimpleChange::ChangeNotice' ) > -1;
    return isCreateSimpleChange;
};

/**
 * When user select type from type selection panel of change we need to navigate to create form. This method
 * will set few variable to hide type selector panel and to show create form.
 *
 * @param {Object} data - The panel's view model object
 */
export let handleTypeSelectionJs = function( data, selectedTypeObject ) {
    let selectedTypeObj = data.dataProviders.getCreatableChangeTypes.selectedObjects;

    if( selectedTypeObj && selectedTypeObj.length > 0 ) {
        selectedTypeObject.update( selectedTypeObj[0] );
    }
};

/**
 * This method will populate form in Create Change panel based on selected type recieved.
 *
 * @param {Object} data - The panel's view model object
 * @param {Object} selectedTypeObject - Selected type for which we need to show create form
 */
export let getTypeSelectedInformation = function( data, selectedTypeObject ) {
    let newBoTypeConst = _.clone( data.boTypeConst );

    let newOpenNewChangeData = _.clone( data.openNewChange );
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.CM_open_change_on_create && appCtxSvc.ctx.preferences.CM_open_change_on_create.length !== 0 ) {
        newOpenNewChangeData.dbValue = appCtxSvc.ctx.preferences.CM_open_change_on_create[0] === 'true';
        newOpenNewChangeData.uiValue = newOpenNewChangeData.dbValue;
    }

    // Set 'Set as Active Change' checkbox based on CM_set_active_change_on_create preference value.
    let newSetActiveChangeData = _.clone( data.setActiveChange );

    // Set dbValue for setActiveChange checkbox, It is required to set dbValue else form validation will fail.
    newSetActiveChangeData.dbValue = false;

    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.CM_set_active_change_on_create && appCtxSvc.ctx.preferences.CM_set_active_change_on_create.length !== 0 ) {
        newSetActiveChangeData.dbValue = appCtxSvc.ctx.preferences.CM_set_active_change_on_create[0] === 'true';
    }

    data.isSimpleChangeObjectCreation = false;

    if( selectedTypeObject ) {
        data.selectedType.dbValue = selectedTypeObject.props.type_name.dbValue;
        data.selectedTypeDisplayName.dbValue = selectedTypeObject.props.object_string.dbValue;
        if( selectedTypeObject.props.parent_types ) {
            data.parent_types.dbValue = selectedTypeObject.props.parent_types.dbValue;
        }
        data.isSimpleChangeObjectCreation = _isSimpleChangeObjectCreation( selectedTypeObject );
        var vmProperty = uwPropertyService.createViewModelProperty( selectedTypeObject.props.object_string.dbValue,
            selectedTypeObject.props.object_string.dbValue, 'STRING', '', '' );

        // Explicitly setting dbValue as the above API returns it "" by default as opposed to the selected value.
        // Git issue 799 (https://gitlab.industrysoftware.automation.siemens.com/Apollo/swf/-/issues/799) is tracking this issue.
        vmProperty.dbValue = data.selectedType.dbValue;
        data.displayedType = vmProperty;
        //Get Type Constant to hide Submit button
        var getTypeConstInput = [];
        getTypeConstInput.push( {
            typeName: data.selectedType.dbValue,
            constantName: 'Awp0EnableSubmitForCreate'
        } );
        // adding to Awp0EnableCreateForCreatePanel : getTypeConstInput LCS-139108
        getTypeConstInput.push( {
            typeName: data.selectedType.dbValue,
            constantName: 'Awp0EnableCreateForCreatePanel'
        } );

        // Get type constant to hide set active checkbox in case of nfc
        getTypeConstInput.push( {
            typeName: data.selectedType.dbValue + 'Revision',
            constantName: 'Cm0CanBeSetAsActiveChange'
        } );

        //Get create input from constants map
        var creIType = cmm.getType( data.selectedType.dbValue );
        var createInputTypeName = data.selectedType.dbValue;
        if( creIType ) {
            createInputTypeName = creIType.constantsMap.CreateInput;
        }

        // adding to Fnd0EnableAssignProjects : getTypeConstInput
        getTypeConstInput.push( {
            typeName: createInputTypeName,
            constantName: 'Fnd0EnableAssignProjects'
        } );


        //For Simple Change, we don't want to show "Dataset" in attachement panel.
        if ( data.isSimpleChangeObjectCreation ) {
            var attachementTypeStringWithComma = '';
            attachementTypeStringWithComma = appCtxSvc.getCtx( 'CreateChangePanel.typesForAttachement' );
            var attachementTypeArray = attachementTypeStringWithComma.split( ',' );
            if ( attachementTypeArray && attachementTypeArray.length > 0 ) {
                const index = attachementTypeArray.indexOf( 'Dataset' );
                if ( index > -1 ) {
                    attachementTypeArray.splice( index, 1 );
                }

                var attachmentTypes = '';
                for ( var j = 0; j < attachementTypeArray.length; j++ ) {
                    attachmentTypes += attachementTypeArray[j];
                    if ( j !== attachementTypeArray.length - 1 ) {
                        attachmentTypes += ',';
                    }
                }

                appCtxSvc.updatePartialCtx( 'CreateChangePanel.typesForAttachement', attachmentTypes );
            }
        }

        newBoTypeConst.isEnableAssignProjects.dbValue = true;
        newBoTypeConst.showSubmitButton.dbValue = true;
        newBoTypeConst.showActiveChangeCheckBox.dbValue = true;

        if ( data.isSimpleChangeObjectCreation ) {
            newBoTypeConst.showCreateButton.dbValue = false;
        } else{
            newBoTypeConst.showCreateButton.dbValue = true;
        }
    } else {
        data.selectedType.dbValue = '';
        data.selectedTypeDisplayName.dbValue = '';
        data.parent_types.dbValue = [];
    }

    return {
        boTypeConst:newBoTypeConst,
        getTypeConstInput:getTypeConstInput,
        selectedType: data.selectedType,
        displayedType: data.displayedType,
        openNewChange: newOpenNewChangeData,
        setActiveChange: newSetActiveChangeData,
        isSimpleChangeObjectCreation: data.isSimpleChangeObjectCreation
    };
};


/**
 * Clear selected type when user click on type link on create form
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let clearSelectedType = function( data ) {
    data.selectedType.dbValue = '';
    data.selectedTypeDisplayName.dbValue = '';
    data.parent_types.dbValue = [];
    return {
        selectedType: data.selectedType,
        selectedTypeDisplayName: data.selectedTypeDisplayName,
        parent_types: data.parent_types
    };
};

/**
 * Initialize variables and methods when create change panle is loaded.
 *
 * @param {Object} data - data
 * @param {Object} derivedFromObjects - selected object to derive
 */
export let initializeCreateChangePanel = function( data, derivedFromObjects ) {
    //reset attachement variables.
    if( !data.attachments ) {
        data.attachments = [];
    } else {
        data.attachments.splice( 0, data.attachments.length );
    }
    if( !data.attachmentsUids ) {
        data.attachmentsUids = [];
    } else {
        data.attachmentsUids.splice( 0, data.attachmentsUids.length );
    }
    //If this is create change in context show selected objects in attachement panel.
    if( appCtxSvc.ctx && appCtxSvc.ctx.CreateChangePanel ) {
        var selectedObjects = appCtxSvc.ctx.CreateChangePanel.selectedObjects;

        // Check Create Change Panel is for Derive Object or not
        var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
        if( isDerive ) {
            selectedObjects = derivedFromObjects;
        }

        if( selectedObjects && selectedObjects.length > 0 ) {
            for( var i = 0; i < selectedObjects.length; i++ ) {
                if( selectedObjects[ i ] !== null && selectedObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Folder' ) <= -1 ) {
                    data.attachments.push( selectedObjects[ i ] );
                    data.attachmentsUids.push( selectedObjects[ i ].uid );
                }
            }
        }
    }

    //Updating getAttachments provider
    let { showCopyOptions: newShowCopyOptionsData } = _loadCreateChangeTabData( data, derivedFromObjects );

    let newAttachment = _.clone( data.attachments );
    let newAttachmentUids = _.clone( data.attachmentsUids );

    return{
        attachments:newAttachment,
        attachmentsUids:newAttachmentUids,
        showCopyOptions: newShowCopyOptionsData
    };
};

/**
 * Get input for creatable change type
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let getInputForCreatableChangeType = function( data ) {
    //Get SOA input
    var creatableChangeTypeInput = [];
    if( appCtxSvc.ctx && appCtxSvc.ctx.CreateChangePanel ) {
        var selectedObjects = appCtxSvc.ctx.CreateChangePanel.selectedObjects;
        if( selectedObjects && selectedObjects.length > 0 ) {
            for( var i = 0; i < selectedObjects.length; i++ ) {
                if( selectedObjects[ i ] !== null ) {
                    var input = {
                        baseTypeName: appCtxSvc.ctx.CreateChangePanel.baseType,
                        clientId: '',
                        exclusionTypeNames: [],
                        object: selectedObjects[ i ].uid
                    };
                    creatableChangeTypeInput.push( input );
                }
            }
        } else {
            var input2 = {
                baseTypeName: appCtxSvc.ctx.CreateChangePanel.baseType,
                clientId: '',
                exclusionTypeNames: [],
                object: ''
            };
            creatableChangeTypeInput.push( input2 );
        }
    }
    return creatableChangeTypeInput;
};

export let getInputForAssignAndRemoveObjectsSOA = function( data ) {
    if( data.derivedObjectUid ) {
        let uid = data.derivedObjectUid;
        let requiredObj = cdm.getObject( uid );
        data.createdChangeObject = requiredObj;
    }
    return [ data.createdChangeObject ];
};

/**
 * Process returned type
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let processResponseForTypeNames = function( response, data ) {
    let displayableChangeTypes = [];
    for( let inx = 0; inx < response.output.length; inx++ ) {
        const outputTypesList = response.output[ inx ];
        const allowedChangeTypesList = outputTypesList.allowedChangeTypes;
        if( allowedChangeTypesList && allowedChangeTypesList.length > 0 ) {
            for( let i = 0; i < allowedChangeTypesList.length; i++ ) {
                displayableChangeTypes.push( allowedChangeTypesList[ i ].typeName );
            }
        }
    }
    //get Unique type list from list of types
    displayableChangeTypes = _.uniq( displayableChangeTypes, true );
    return displayableChangeTypes;
};

/**
 * ensure types are present in cache
 *
 * @param {Object} data - The create change panel's view model object
 *
 */
export let ensureChangeTypesLoadedJs = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var returnedTypes = [];
    var displayableChangeTypes;
    if( data.changeTypeNames !== undefined ) {
        displayableChangeTypes = data.changeTypeNames;
    }
    var promise = soaSvc.ensureModelTypesLoaded( displayableChangeTypes );
    if( promise ) {
        promise.then( function() {
            var typeUids = [];
            for( var i = 0; i < displayableChangeTypes.length; i++ ) {
                var modelType = cmm.getType( displayableChangeTypes[ i ] );

                if( cmUtils.filterSearch( data.filterBox.dbValue, modelType.displayName ) ) {
                    returnedTypes.push( modelType );
                    typeUids.push( modelType.uid );
                }
            }
            //ensure the ImanType objects are loaded
            propertyPolicySvc.register( {
                types: [ {
                    name: 'ImanType',
                    properties: [ {
                        name: 'parent_types'
                    }, {
                        name: 'type_name'
                    } ]
                }
                ]
            } );
            dmSvc.loadObjects( typeUids ).then( function() {
                // Updating getCreatableChangeTypes dataProvider
                data.dataProviders.getCreatableChangeTypes.update( returnedTypes, returnedTypes.length );

                var returneddata = {
                    searchResults: returnedTypes,
                    totalFound: returnedTypes.length
                };

                deferred.resolve( returneddata );
            } );
        } );
    }
    return deferred.promise;
};

/**
 * GetCreatable Change Types when performing a create issue from hosted AW
 *
 * @param {Object} data - view model data
 */
export let getCreatableChangeTypesProvided = function() {
    var providedTypeName = '';
    if( appCtxSvc.ctx.CreateIssueHostedMode && appCtxSvc.ctx.CreateIssueHostedMode.IssueTypeName ) {
        providedTypeName = appCtxSvc.ctx.CreateIssueHostedMode.IssueTypeName;
    } else {
        if( appCtxSvc.ctx.CreateChangePanel.exactTypeToCreate && appCtxSvc.ctx.CreateChangePanel.baseTypeForDeriv !== '' ) {
            providedTypeName = appCtxSvc.ctx.CreateChangePanel.exactTypeToCreate;
        } else if( appCtxSvc.ctx.CreateChangePanel.baseType && appCtxSvc.ctx.CreateChangePanel.baseType !== '' ) {
            providedTypeName = appCtxSvc.ctx.CreateChangePanel.baseType;
        }
    }

    var newChangeTypeNames = [];
    newChangeTypeNames.push( providedTypeName );
    return newChangeTypeNames;
};


/**
 * getDeriveData
 *
 * @param {Object} data - view model data
 */
export let getDeriveData = function( response ) {
    var selectedChangeObjectsUid = response.plain;

    let newChangeTypeNames = [];

    var selectedChangeObjects = [];
    for ( let uid of selectedChangeObjectsUid ) {
        var selectedChange = response.modelObjects[uid];
        selectedChangeObjects.push( selectedChange );
    }

    var initialTypes = [];
    var initialTypes = cmUtils.getInitialChangeTypesForDerivePanel( initialTypes, selectedChangeObjects );

    for ( var i in initialTypes ) {
        if ( initialTypes[i] !== '' && initialTypes[i] !== null ) {
            var typeString = initialTypes[i];
            var parsedStr = typeString.split( '/' );
            var actualTypeName = parsedStr[0];
            newChangeTypeNames.push( actualTypeName );
        }
    }
    var selectedChangeObject = selectedChangeObjects[0];
    if ( selectedChangeObject.props.cm0RelationsToPropagate.dbValues ) {
        appCtxSvc.updatePartialCtx( 'relationToPropagate', selectedChangeObject.props.cm0RelationsToPropagate.dbValues );
    }
    // cm0AutoPropagateRelations.dbValue/dbValues has string value- "0"/"1"
    // and is not evaluated correcty based on its logical value
    // fixing for a defect.

    if ( selectedChangeObject.props.cm0AutoPropagateRelations.dbValue ) {
        var isAutoPropagate = selectedChangeObject.props.cm0AutoPropagateRelations.dbValue;
        var autoPropagRel = _.isString( isAutoPropagate ) ? cmUtils.isPropertyValueTrue( isAutoPropagate ) : isAutoPropagate;
        appCtxSvc.updatePartialCtx( 'autoPropagateRel', autoPropagRel );
    } else {
        if ( selectedChangeObject.props.cm0AutoPropagateRelations.dbValues &&
            selectedChangeObject.props.cm0AutoPropagateRelations.dbValues.length > 0 ) {
            var isAutoPropagate = selectedChangeObject.props.cm0AutoPropagateRelations.dbValues[0];
            var autoPropagRel = _.isString( isAutoPropagate ) ? cmUtils.isPropertyValueTrue( isAutoPropagate ) : isAutoPropagate;
            appCtxSvc.updatePartialCtx( 'autoPropagateRel', autoPropagRel );
        }
    }

    return newChangeTypeNames;
};


/**
 *  Update data provider with Responsible User.
 *  @param {Object} selectedObjects - Selected Responsible User
 */
export let updateResponsibleUserDataProvider = function( dataProviderToUpdate, selecedResources ) {
    if( selecedResources && dataProviderToUpdate ) {
        let allResources = [];
        allResources.push( selecedResources[0] );
        //Update data provider.
        dataProviderToUpdate.update( allResources );
    }
};

/**
 *  Remove Responsible User from the dataProvider when user clicked on 'Remove Responsible User' button.
 *  @param {Object} dataProvider - dataProvider
 */
export let removeResponsibleUser = function( dataProvider ) {
    if( dataProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        let allResources = [];
        dataProvider.update( allResources, 0 );
    }
};

/**
 * Remove given attachment from attachment list.
 *
 * @param {String} data - The view model data
 * @param {String} attachment - The attachment to be removed
 */
export let removeAttachementJs = function( selectedAttachement ) {
    if( selectedAttachement && selectedAttachement.length > 0 ) {
        if( parentData.attachments && parentData.attachmentsUids ) {
            for( var i = 0; i < selectedAttachement.length; i++ ) {
                var index = parentData.attachmentsUids.indexOf( selectedAttachement[ i ].uid );
                if( index > -1 ) {
                    parentData.attachments.splice( index, 1 );
                    parentData.attachmentsUids.splice( index, 1 );
                }
            }
        }

        if( parentData.dataProviders && parentData.dataProviders.getAttachments ) {
            parentData.dataProviders.getAttachments.update( parentData.attachments,
                parentData.attachments.length );
        }
    }
};

/**
 * SelectAll/ClearAll currently loaded related objects
 *
 * @param {Object} data - view model data
 * @param {String} selectionMode - Selection Mode
 */
export let selectCells = function( data, selectionMode ) {
    if( selectionMode === 'selectAll' ) {
        data.dataProviders.getPropagateRelationProvider.selectAll();
    } else if( selectionMode === 'selectNone' ) {
        data.dataProviders.getPropagateRelationProvider.selectNone();
    }
};

/**
 * handle selection event in relation list to update count label.
 *
 * @param {Object} data - view model data
 */
export let handleSelectionModel = function( data ) {
    let newCanSelectAll = _.clone( data.canSelectAll );
    let newCanDeselectAll = _.clone( data.canDeselectAll );
    let newCountLabel = _.clone( data.countLabel );
    data.dataProviders.getPropagateRelationProvider.selectionModel
        .evaluateSelectionStatusSummary( data.dataProviders.getPropagateRelationProvider );
    newCanSelectAll.dbValue = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCanExecuteSelectLoaded();
    newCanDeselectAll.dbValue = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCanExecuteDeselect();
    var selectedCount = data.dataProviders.getPropagateRelationProvider.selectionModel
        .getCurrentSelectedCount();
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var countLabel = localTextBundle.countLabel;
    countLabel = countLabel.replace( '{0}', selectedCount );
    countLabel = countLabel.replace( '{1}',
        data.dataProviders.getPropagateRelationProvider.viewModelCollection.totalFound );
    var countDisplayProp = newCountLabel;
    countDisplayProp.propertyDisplayName = countLabel;
    newCountLabel = countDisplayProp;
    return{
        canSelectAll:newCanSelectAll,
        canDeselectAll:newCanDeselectAll,
        countLabel:newCountLabel
    };
};


/**
 * Initialize default values in case of derive operation.
 *
 * @param {Object} data - view model data
 * @param {Object} derivedFromObjects - selected object to derive
 */
export let initializeDefaultValues = function( data, editHandler, derivedFromObjects ) {
    var isDerive = appCtxSvc.ctx.CreateChangePanel.isDerive;
    if( isDerive ) {
        cmUtils.populateCreatePanelPropertiesOnDerive( data, editHandler, derivedFromObjects );
    }
};

/**
 * Open Object in Edit Mode.
 *
 * @param {String} newObjectUid - object to open ( uid or object it self )
 */
export let openNewObjectInEditMode = function( data ) {
    var uidToConsider = '';
    if( data.derivedObjectUid ) {
        uidToConsider = data.derivedObjectUid;
    } else {
        uidToConsider = data.createdChangeObject.uid;
    }
    var vmo = cdm.getObject( uidToConsider );
    var isSelectedObjectSupportInContext = false;
    var isCreatedObjectSupportInContext = false;
    var openInEdit = true;
    var stateSvc = AwStateService.instance;
    if( stateSvc && stateSvc.params ) {
        var params = stateSvc.params;
        if( params.uid ) {
            var openedObjectUid = params.uid;
            var openObjecyVmo = cdm.getObject( openedObjectUid );
            if( openObjecyVmo && cmm.isInstanceOf( 'Cpd0CollaborativeDesign', openObjecyVmo.modelType ) ) {
                isSelectedObjectSupportInContext = true;
            }
        }
    }
    if( isSelectedObjectSupportInContext ) {
        if( cmm.isInstanceOf( 'ChangeNoticeRevision', vmo.modelType ) ||
            cmm.isInstanceOf( 'Fnd0AbstractMarkupSpace', vmo.modelType ) ) {
            isCreatedObjectSupportInContext = true;
        }
        if( isCreatedObjectSupportInContext ) {
            openInEdit = false;
        }
    }
    if( openInEdit ) {
        var navigationParams = {
            uid: vmo.uid,
            edit: true
        };
        var action = {
            actionType: 'Navigate',
            navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
        };

        navigationSvc.navigate( action, navigationParams );
    }
};

/**
 * Validate data for Change Context Provider
 *
 * @param {Object} data - view model data
 */
export let getChangeContextProvider = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var changeContextToReturn = data.fnd0ContextProvider;
    if( !_reviseEventListener ) {
        _reviseEventListener = eventBus.subscribe( 'reviseObject.assignProjects',
            function( eventData ) {
                if( appCtxSvc.getCtx( 'pselected' ) !== undefined &&
                    appCtxSvc.getCtx( 'pselected' ) !== null &&
                    appCtxSvc.getCtx( 'pselected' ).modelType &&
                    appCtxSvc.getCtx( 'pselected' ).modelType.typeHierarchyArray.indexOf( 'GnChangeNoticeRevision' ) > -1 &&
                    eventData.scope.data.openNewRevision.dbValue === false ) {
                // This will refresh the Change Summary Table after Revise commmand
                    eventBus.publish( 'resetChangeSummaryTable' );
                }
            } );
    }
    if( appCtxSvc.getCtx( 'pselected' ) === null || appCtxSvc.getCtx( 'pselected' ) === undefined ) {
        changeContextToReturn.dbValue = null;
        changeContextToReturn.dbValues[ 0 ] = null;
        data.fnd0ContextProvider = changeContextToReturn;
        deferred.resolve( changeContextToReturn );
    } else if( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) === 'ChangeBom' ) {
        changeContextObject = appCtxSvc.getCtx( 'pselected' );
    } else {
        var selectedObject = appCtxSvc.getCtx( 'selected' );
        var changeContextObject = null;
        // We got an Awb0Element as input
        //if awb0Parent property is NULL, means we are revising top most line. In case of top most line there is no local context which can come from parent.
        if( selectedObject.props.awb0UnderlyingObject !== undefined && selectedObject.props.awb0Parent !== undefined && selectedObject.props.awb0Parent.dbValues[ 0 ] !== null ) {
            //Get parent as local change context
            var parentObjectUid = selectedObject.props.awb0Parent.dbValues[ 0 ];
            var parentObject = cdm.getObject( parentObjectUid );
            if( parentObject && parentObject.props.awb0UnderlyingObject !== undefined ) {
                changeContextObject = cdm.getObject( parentObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
            }
            var allObjectUid = [];
            allObjectUid.push( changeContextObject.uid );
            var propToLoad = [ 'cm0AuthoringChangeRevision' ];
            dmSvc.getProperties( allObjectUid, propToLoad ).then( function() {
                var parentUnderlyingObject = cdm.getObject( parentObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                var ecnUidFromParentPart = parentUnderlyingObject.props.cm0AuthoringChangeRevision.dbValues[ 0 ];
                if( ecnUidFromParentPart === '' || ecnUidFromParentPart === null ) {
                    // If No ECN found pass topmost part as local change context
                    var context = appCtxSvc.ctx.aceActiveContext?.context?.topElement?.props?.awb0UnderlyingObject?.dbValues[0];
                    if( context !== undefined ) {
                        changeContextObject = cdm.getObject( context );
                    }
                }
                if( changeContextObject !== null ) {
                    changeContextToReturn.dbValue = changeContextObject;
                    changeContextToReturn.dbValues = changeContextObject;
                    data.fnd0ContextProvider = changeContextToReturn;
                    deferred.resolve( changeContextToReturn );
                }
            } );
        }
    }
    return deferred.promise;
};

/**
 * Validate data for Change Context Provider
 *
 * @param {Object} data - view model data
 */


export let getChangeContextProviderForCreate = function( data ) {
    if( appCtxSvc.getCtx( 'selected' ) !== undefined && appCtxSvc.getCtx( 'selected' ) !== null ) {
        var isChangeItemRevision = false;
        if( cmm.isInstanceOf( 'ChangeItemRevision', appCtxSvc.getCtx( 'selected' ).modelType ) ) {
            isChangeItemRevision = true;
        }
        if( isChangeItemRevision && appCtxSvc.getCtx( 'selected' ).props.items_tag !== undefined ) {
            data.revision__fnd0ContextProvider.dbValue = appCtxSvc.getCtx( 'selected' ).props.items_tag.dbValues[ 0 ];
            data.revision__fnd0ContextProvider.dbValues = appCtxSvc.getCtx( 'selected' ).props.items_tag.dbValues[ 0 ];
        }
    }
    const allowedCommonCommands = [
        'Awb0AddSiblingElementDeclarative',
        'Awb0ReplaceElement',
        'AceAddSubstituteOccurrences',
        'Awb0AddSubstitutesToOccSubstGroup',
        'Awb0OccurrenceSubstituteGroup',
        'Awb0AddSubstitutes',
        'Awb0AddSubstitutesToGroup'
    ];
    if( appCtxSvc.getCtx( 'pselected' ) !== undefined && appCtxSvc.getCtx( 'pselected' ) !== null ) {
        //Handle creating content inside structure.
        if( appCtxSvc.getCtx( 'pselected' ).props &&
            appCtxSvc.getCtx( 'pselected' ).props.awb0UnderlyingObject !== undefined &&
            appCtxSvc.ctx.sidenavCommandId !== null &&
            (
                appCtxSvc.ctx.sidenavCommandId === 'Awb0AddChildElementDeclarative' ||
                allowedCommonCommands.includes( appCtxSvc.ctx.sidenavCommandId )
            ) ||
            appCtxSvc.ctx.sidenavCommandId === 'Awb0InsertLevel'  ) {
            var selectedObject = appCtxSvc.getCtx( 'selected' );
            var changeContextObjectUid = '';
            if( appCtxSvc.ctx.sidenavCommandId === 'Awb0AddChildElementDeclarative' && selectedObject.props.awb0UnderlyingObject !== undefined && selectedObject.props.awb0UnderlyingObject.dbValues !== undefined ) {
                changeContextObjectUid = selectedObject.props.awb0UnderlyingObject.dbValues[ 0 ];
            }
            if( ( appCtxSvc.ctx.sidenavCommandId === 'Awb0InsertLevel' ||
                allowedCommonCommands.includes( appCtxSvc.ctx.sidenavCommandId ) ) &&
                selectedObject.props.awb0Parent !== undefined && selectedObject.props.awb0Parent.dbValues !== undefined ) {
                var parentObjectUid = selectedObject.props.awb0Parent.dbValues[ 0 ];
                var parentObject = cdm.getObject( parentObjectUid );
                if( parentObject && parentObject.props.awb0UnderlyingObject !== undefined ) {
                    changeContextObjectUid = parentObject.props.awb0UnderlyingObject.dbValues[ 0 ];
                }
            }
            data.revision__fnd0ContextProvider.dbValue = changeContextObjectUid;
            data.revision__fnd0ContextProvider.dbValues = changeContextObjectUid;
        }
        //This will executes when,change is Active and if any Item selected in solution item section,and try to add new item to a solution items.
        else if ( cmm.isInstanceOf( 'GnChangeNoticeRevision', appCtxSvc.getCtx( 'pselected' ).modelType ) && appCtxSvc.getCtx( 'pselected' ).props.items_tag !== undefined ) {
            let changeObjUid;
            if( appCtxSvc.getCtx( 'sublocation.clientScopeURI' ) === 'ChangeBom' ) {
                changeObjUid = appCtxSvc.getCtx( 'pselected' ).uid;
            } else{
                changeObjUid = appCtxSvc.getCtx( 'pselected' ).props.items_tag.dbValues[ 0 ];
            }
            data.revision__fnd0ContextProvider.dbValue = changeObjUid;
            data.revision__fnd0ContextProvider.dbValues = changeObjUid;
        }
    }
};

/**
 * set isCreatePinEvent to true  during create / submit change flow. Create/ Submit change triggers primaryWorkArea.selectionChangeEvent which indeed close the panel
 *  To preventing close panel when panel is pinned isCreatePinEvent set to true and checked before panel close
 *
 */
export let setConditionToPin = function( data, subPanelContext ) {
    if( subPanelContext && subPanelContext.panelPinned ) {
        data.isCreatePinEvent.value = true;
    }
};

/**
 * This function check primaryWorkArea.selectionChangeEvent event occure. If primaryWorkArea.selectionChangeEvent event occure
 * during create/ submit change it will not close the pinned panel else it will call complete to close the panel
 *
 */
export let panelUnpinClose = function( data ) {
    if( appCtxSvc.ctx.CreateChangePanel.selectedObjects !== undefined ) {
        if( data.isCreatePinEvent.value !== true || appCtxSvc.ctx.CreateChangePanel.selectedObjects.length !== appCtxSvc.ctx.mselected.length ) {
            eventBus.publish( 'change.complete' );
        }
    }
    if( data.isCreatePinEvent !== undefined ) {
        data.isCreatePinEvent.value = false;
    }
};

/**
 * Remove SymptomDefect .Called when clicked on the remove cell.
 *
 * @param {data} data - The qualified data of the viewModel
 */
export let removeSymptomDefect = function( data ) {
    var allLoadedObjects = data.dataProviders.getSymptomDefectProvider.viewModelCollection.getLoadedViewModelObjects();
    var remainObjects = _.difference( allLoadedObjects, appCtxSvc.ctx.Caw0RemovedDefect );
    data.dataProviders.getSymptomDefectProvider.update( remainObjects, remainObjects.length );
    appCtxSvc.unRegisterCtx( 'Caw0RemovedDefect' );
};

/**
 * Updating getAttachments provider of Attachments section with newly added object
 *
 * @param {Object} data - Data
 * @param {Object} newAttachments - New attachments which needs to be added
 * @return {Boolean} - returns true if new attachments are successfully added to getAttachments provider
 */
export let updateAttachmentsProvider = function( data, newAttachments ) {
    if( data && data.dataProviders && data.dataProviders.getAttachments && newAttachments && newAttachments.length > 0 ) {
        let allResources = data.dataProviders.getAttachments.viewModelCollection.loadedVMObjects;
        _.forEach( newAttachments, function( vmo ) {
            allResources.push( vmo );
        } );

        // Remove the duplicates if present in presetObjects list.
        allResources = _.uniqWith( allResources, function( objA, objB ) {
            return objA.uid === objB.uid;
        } );

        // Update data provider.
        data.dataProviders.getAttachments.update( allResources );

        // Need to remove this code in future, parentData is used in _getInputForCreateOperation
        if( !parentData.attachments ) {
            parentData.attachments = [];
        }
        if( !parentData.attachmentsUids ) {
            parentData.attachmentsUids = [];
        }
        for( let i = 0; i < allResources.length; i++ ) {
            var indexOfAttachment = parentData.attachmentsUids.indexOf( allResources[ i ].uid );
            if( indexOfAttachment === -1 ) {
                parentData.attachments.push( allResources[ i ] );
                parentData.attachmentsUids.push( allResources[ i ].uid );
            }
        }
    }
    return true;
};

/**
 * Updating Atomic data value.
 * @param {Object} AtomicObj - Atomic object
 * @param {Object} value - new value
 */
export const updateChangeAtomicData = function( AtomicObj, value ) {
    if( AtomicObj && AtomicObj.update ) {
        AtomicObj.update( value );
    }
};

/**
 * This method is used to get selected object to derive.
 * @param {Object} selectedObjects - The selection
 * @returns {Object} - returns selected object to derive
 */
export const getDerivedFromObjectsForDerivePanel = function( selectedObjects ) {
    let selectedChangeObjects = [];
    selectedChangeObjects = selectedObjects.filter( selectedObject => {
        return selectedObject && cmm.isInstanceOf( 'ChangeItemRevision', selectedObject.modelType );
    } );

    if( selectedChangeObjects.length === 0 && appCtxSvc.ctx.pselected ) {
        const selectedChange = cdm.getObject( appCtxSvc.ctx.pselected.uid );
        if( selectedChange && cmm.isInstanceOf( 'ChangeItemRevision', selectedChange.modelType ) ) {
            selectedChangeObjects.push( selectedChange );
        }
    }

    return {
        derivedFromObjects: selectedChangeObjects
    };
};

/**
 * Populate Selected Defect in Defects Section of Derive Panel.
 * @param {Object} selectedObjects
 * @param {Object} symptomDefectProvider
 */
export const updateSymptomDefectProvider = function( selectedObjects, symptomDefectProvider ) {
    let defects = [];
    defects = selectedObjects.filter( selectedObject => {
        return selectedObject && selectedObject.modelType.typeHierarchyArray.indexOf( 'CAW0Defect' ) > -1;
    } );
    symptomDefectProvider.update( defects, defects.length );
};

/**
 * Populate Selected Defect in Defects Section of Derive Panel.
 * @param {Object} selectedObjects
 * @param {Object} symptomDefectProvider
 */
export const registerObjectProcessing = function( subPanelContext ) {
    let newcreateChangeObjectProcessingState = _.clone( subPanelContext.createChangeObjectProcessing );
    newcreateChangeObjectProcessingState.dbValue = true;
    subPanelContext.createChangeObjectProcessing.update( newcreateChangeObjectProcessingState );
};

export const unRegisterObjectProcessing = function( subPanelContext ) {
    let newcreateChangeObjectProcessingState = _.clone( subPanelContext.createChangeObjectProcessing );
    newcreateChangeObjectProcessingState.dbValue = false;
    subPanelContext.createChangeObjectProcessing.update( newcreateChangeObjectProcessingState );
};

/**
  * @param {response} response - SOA response
  * @return { object_string } - object_string
  */
export const getObjectString = function( response, data ) {
    let changeObjectString = '';
    if( data && data.object_name && data.object_name.uiValue ) {
        changeObjectString = data.object_name.uiValue;
    }
    if ( response && response.created ) {
        for ( let i = 0; i < response.created.length; i++ ) {
            let responseObject = cdm.getObject( response.created[i] );
            if ( responseObject.modelType.typeHierarchyArray.indexOf( 'ChangeItemRevision' ) !== -1 ||
                responseObject.modelType.typeHierarchyArray.indexOf( 'ChangeItem' ) !== -1 ) {
                let changeObjectUid = response.created[i];
                if ( changeObjectUid && response.modelObjects && response.modelObjects[changeObjectUid] ) {
                    changeObjectString = response.modelObjects[changeObjectUid].props.object_string.uiValues[0];
                    break;
                }
            }
        }
    }
    return changeObjectString;
};

/**
 *
 * @param {Object} projectState - Project context is used to assign the projects to projects dataprovider.
 * @returns {Object} Promise object
 */
export const updateAssignedProjectsProvider = function( projectState ) {
    let deferred = AwPromiseService.instance.defer();

    const newProjectState = projectState.getValue();
    let selectedProjectListFromPreviousobj = appCtxSvc.ctx.xrtSummaryContextObject?.props?.project_list;

    if( selectedProjectListFromPreviousobj?.dbValues?.length > 0 ) {
        dmSvc.getProperties( selectedProjectListFromPreviousobj?.dbValues, [ 'object_string' ] ).then( function() {
            let selectedProjects = selectedProjectListFromPreviousobj?.dbValues?.map( function( uid ) {
                return cdm.getObject( uid );
            } );
            newProjectState.selectedProjects = selectedProjects;
            newProjectState.triggerAssign = true;
            projectState?.update( newProjectState );
            deferred.resolve();
        } );
    } else {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Processes selected objects and returns an array of objects with 'uid' and 'type'.
 *
 * @param {Object} addPanelState the view model data object
 * @returns {Array<{uid: string, type: string}>} - An array of objects with 'uid' and 'type'.
 */
export let processSecondaryObjectsInput = function( addPanelState, probableImpactedDataProvider, currentECN, deferred ) {
    if( !_pasteConcurrentChangeEventListener ) {
        _pasteConcurrentChangeEventListener = eventBus.subscribe( 'Cm1ConcChangePasteHandler.continuePasteAction', async function( eventData ) {
            if( eventData && eventData.scope && eventData.scope.pasteContext ) {
                try {
                    await tcDefPasteHandler.tcDefaultPasteHandler( eventData.scope.pasteContext.targetObject, eventData.scope.pasteContext.sourceObject, eventData.scope.pasteContext.relationType );
                    eventBus.publish( 'cdm.relatedModified', {
                        refreshLocationFlag: false,
                        relatedModified: [ eventData.scope.pasteContext.targetObject ]
                    } );
                    eventData.scope.deferredToResolve.resolve( true );
                } catch( error ) {
                    let errMessage = messageSvc.getSOAErrorMessage( error );
                    messageSvc.showError( errMessage );
                    eventBus.publish( 'cdm.relatedModified', {
                        refreshLocationFlag: false,
                        relatedModified: [ eventData.scope.pasteContext.targetObject ]
                    } );
                    eventData.scope.deferredToResolve.reject( false );
                }
            }
        } );
    }
    const secObjInputArray = [];
    appCtxSvc.updateCtx( 'Cm1CreateChange.ecnUnderConsideration', currentECN );
    if( probableImpactedDataProvider ) {
        let selectedObjects = [];
        selectedObjects = probableImpactedDataProvider.selectedObjects ? probableImpactedDataProvider.selectedObjects : [];
        selectedObjects.forEach( item => {
            // Check if the 'item' has a valid 'uid'
            if( item?.uid ) {
                secObjInputArray.push( {
                    uid: item.uid,
                    type: item.type
                } );
            }
        } );
        appCtxSvc.updateCtx( 'Cm1CreateChange.secondaryObjectsInput', secObjInputArray );
        return secObjInputArray;
    }
    if( addPanelState ) {
        let sourceObjs = [];
        //take care of 2 scenarios -
        //1. Add panel (sourceObjects) 2. pasteContext (sourceObject)
        sourceObjs = addPanelState.sourceObjects ? addPanelState.sourceObjects : addPanelState.sourceObject ? addPanelState.sourceObject : [];
        if( !_.isEmpty( sourceObjs ) ) {
            sourceObjs.forEach( item => {
                // Check if the 'item' has a valid 'uid'
                if( item?.uid ) {
                    secObjInputArray.push( {
                        uid: item.uid,
                        type: item.type
                    } );
                }
            } );
        }
        appCtxSvc.updateCtx( 'Cm1CreateChange.secondaryObjectsInput', secObjInputArray );
        return secObjInputArray;
    }
    let selectedItems = [];
    let mselected = appCtxSvc.getCtx( 'mselected' );
    if( mselected ) {
        mselected.forEach( item => {
            if ( item.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                selectedItems.push( item.props.awb0UnderlyingObject.dbValues[0] );
            } else {
                selectedItems.push( item.uid );
            }
        } );
    }
    selectedItems.forEach( function( selectedItem ) {
        let item = {
            uid: selectedItem,
            type: ''
        };
        secObjInputArray.push( item );
    } );
    appCtxSvc.updateCtx( 'Cm1CreateChange.secondaryObjectsInput', secObjInputArray );
    return secObjInputArray;
};

/**
 * Returns the list of selected items and their associated ECNs.
 *
 * @param {Object} response API response object
 * @returns {Array<{item: Object, changeNotice: Object}>} - List of selected items with associated ECNs.
 */
export let getListOfItemAndassociatedECNs = function( response ) {
    //make sure existing ecn and impacted items are not considered
    let ecnUnderConsiderationUid = appCtxSvc.getCtx( 'Cm1CreateChange.ecnUnderConsideration' );
    let secObjInputArray = appCtxSvc.getCtx( 'Cm1CreateChange.secondaryObjectsInput' );
    let secInputArr = [];
    _.forEach( secObjInputArray, ( item ) => {
        secInputArr.push( item.uid );
    } );
    let selectedItemsAndChangeNoticeList = [];
    let changeObjs = [];
    let selectedItems = [];
    if( response.concurrChangeObjs.length > 0 ) {
        response.concurrChangeObjs.forEach( item => {
            if ( item && item.impactedItems ) {
                item.impactedItems.forEach( selectedItem => {
                    if ( selectedItem.modelType.typeHierarchyArray.indexOf( 'WorkspaceObject' ) > -1 ) {
                        let changeObject = null;

                        if ( item.changeItem !== null ) {
                            changeObject = item.changeItem;

                            if( changeObject?.uid === ecnUnderConsiderationUid && secInputArr.includes( selectedItem.uid ) ) {
                                //current ecn and impacted items are not considered as concurrent change
                                return;
                            }
                            changeObjs.push( changeObject );

                            // Push the selected item and associated ECN to the list
                            selectedItems.push( selectedItem );
                        }
                    }
                } );
                selectedItemsAndChangeNoticeList.push( {
                    item: selectedItems,
                    changeNotice: changeObjs
                } );
            }
        } );
    }

    let openECNList = getListOfOpenECNs( selectedItemsAndChangeNoticeList );
    if( openECNList?.length > 0 ) {
        appCtxSvc.updateCtx( 'Cm1CreateChange.selectedItemHasConflictingChange', true );
        appCtxSvc.updateCtx( 'Cm1CreateChange.openEcns', openECNList );
    } else {
        appCtxSvc.updateCtx( 'Cm1CreateChange.selectedItemHasConflictingChange', false );
        appCtxSvc.updateCtx( 'Cm1CreateChange.openEcns', [] );
    }
    return openECNList;
};

/**
 * Filters the list of items to only include those with open ECNs.
 *
 * @param {Array<{item: Object, changeNotice: Object}>} selectedItemsAndChangeNoticeList List of items and ECNs
 * @returns {Array<{item: Object, changeNotice: Object}>} - List of items with open ECNs
 */
export let getListOfOpenECNs = function( selectedItemsAndChangeNoticeList ) {
    let openECNs = [];
    if( Array.isArray( selectedItemsAndChangeNoticeList ) && selectedItemsAndChangeNoticeList.length > 0 ) {
        selectedItemsAndChangeNoticeList.forEach( item => {
            let openChangeObjs = [];
            item.changeNotice.forEach( ecn => {
                openChangeObjs.push( ecn );
            } );
            if( openChangeObjs.length > 0 ) {
                openECNs.push(
                    {
                        item: item.item,
                        changeNotice: openChangeObjs
                    }
                );
            }
        } );
    }
    return openECNs;
};

/**
 * Processes warning messages based on the response data, groups items by their associated ECN,
 * and formats them into a message.
 * @param {Object} response - The response object containing output data and relationships.
 * @returns {Array<string>} warningMessage - An array of formatted warning messages, grouped by ECN.
 */
export let processWarningMessages = function( response ) {
    const localTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
    const warningMessage = [];

    if ( !response.concurrChangeObjs || response.concurrChangeObjs.length === 0 ) {
        return warningMessage;
    }

    let secObjInputArray = appCtxSvc.getCtx( 'Cm1CreateChange.secondaryObjectsInput' );
    let secInputArr = [];
    _.forEach( secObjInputArray, ( item ) => {
        secInputArr.push( item.uid );
    } );

    // Group items by ECN
    const groupedEcns = {};
    let ecnUnderConsiderationUid = appCtxSvc.getCtx( 'Cm1CreateChange.ecnUnderConsideration' );
    response.concurrChangeObjs.forEach( item => {
        let changeObject = item.changeItem;
        if ( changeObject !== null ) {
            let changeObj = cdm.getObject( changeObject.uid );
            let linkedECN = changeObj.props?.object_string?.dbValues[0];
            let linkedECNUid = changeObject.uid;

            // Loop through all impacted items, not just the first one
            item.impactedItems.forEach( impactedItem => {
                if( changeObject?.uid === ecnUnderConsiderationUid && secInputArr.includes( impactedItem.uid ) ) {
                //current ecn and impacted items are not considered as concurrent change
                    return;
                }
                let impactedObj = cdm.getObject( impactedItem.uid );

                let impactedItemName = impactedObj?.props?.object_string?.dbValues[0];

                if( linkedECN && linkedECN.length > 0 && impactedItemName ) {
                    if( !groupedEcns[linkedECNUid] ) {
                        groupedEcns[linkedECNUid] = {
                            ecnName: linkedECN,
                            items: []
                        };
                    }
                    groupedEcns[linkedECNUid].items.push( impactedItemName );
                }
            } );
        }
    } );

    // Create warning messages
    const warnMsgTab = '&nbsp;&nbsp;&nbsp;';
    let trailWarnMsgArr = [];
    Object.keys( groupedEcns ).forEach( ecnUid => {
        let ecnObjName = groupedEcns[ecnUid].ecnName;
        let eachEcnIR = [ '<strong>' + ecnObjName + '</strong>' ];
        groupedEcns[ecnUid].items.forEach( item => {
            eachEcnIR.push( warnMsgTab + item );
        } );
        trailWarnMsgArr.push( eachEcnIR.join( '\n' ) );
    } );

    let leadWarnMsg = localTextBundle.showConflictingChangeBaseWarningMsg;

    if( Object.keys( groupedEcns ).length > 0 ) {
        warningMessage.push( leadWarnMsg );
        warningMessage.push( '' );
        warningMessage.push( trailWarnMsgArr.join( '\n' ) );
    }

    let warnMsgStr = warningMessage.join( '\n' );

    if( appCtxSvc.getCtx( 'Cm1CreateChange.selectedItemHasConflictingChange' ) === true ) {
        appCtxSvc.updateCtx( 'Cm1CreateChange.warningMessage', warnMsgStr );
    } else {
        appCtxSvc.updateCtx( 'Cm1CreateChange.warningMessage', '' );
    }

    return warnMsgStr;
};

export const processReviseWarnMessages = function( response ) {
    const warnMsgTab = '&nbsp;&nbsp;&nbsp;&nbsp;';
    const localTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
    const warningMessage = [];
    const groupedEcns = {};

    if ( !response.concurrChangeObjs || response.concurrChangeObjs.length === 0 ) {
        return warningMessage;
    }

    let secObjInputArray = appCtxSvc.getCtx( 'Cm1CreateChange.secondaryObjectsInput' );
    let secInputArr = [];
    _.forEach( secObjInputArray, ( item ) => {
        secInputArr.push( item.uid );
    } );

    //group items by ECN
    response.concurrChangeObjs.forEach( item => {
        let ChangeObject = item.changeItem;
        if ( ChangeObject !== null ) {
            if( Object.keys( groupedEcns ).indexOf( item.changeItem.uid ) === -1 ) {
                groupedEcns[item.changeItem.uid] = [];
            }
            // Process all impacted items, not just the first one
            item.impactedItems?.forEach( impactedItem => {
                const objectString = impactedItem?.props?.object_string?.dbValues[0];
                if ( objectString ) {
                    groupedEcns[item.changeItem.uid].push( objectString );
                }
            } );
        }
    } );

    //create warning message
    const ecnUids = Object.getOwnPropertyNames( groupedEcns );
    let reviseTrailWarnMsgArr = [];
    if( ecnUids.length > 0 ) {
        ecnUids.forEach( ecnUid => {
            let ecnObj = cdm.getObject( ecnUid );
            let ecnObjName = ecnObj.props?.object_string?.dbValues[0];
            let eachEcnIR = [ '<strong>' + ecnObjName + '</strong>' ];
            groupedEcns[ecnUid].forEach( item => {
                eachEcnIR.push( warnMsgTab + item );
            } );
            reviseTrailWarnMsgArr.push( eachEcnIR.join( '\n' ) );
        } );
    }

    let reviseLeadWarnMsg = localTextBundle.activeChangeMultiReviseLeadMsg;
    reviseLeadWarnMsg = reviseLeadWarnMsg.replace( '{0}', appCtxSvc.getCtx( 'mselected' ).length );
    reviseLeadWarnMsg = reviseLeadWarnMsg.replace( '{1}', appCtxSvc.getCtx( 'mselected' ).length );
    if( Object.keys( groupedEcns ).length > 0 ) {
        warningMessage.push( reviseLeadWarnMsg );
        warningMessage.push( '' );
        warningMessage.push( reviseTrailWarnMsgArr.join( '\n' ) );
    }

    let warnMsgStr = warningMessage.join( '\n' );

    if( appCtxSvc.getCtx( 'Cm1CreateChange.selectedItemHasConflictingChange' ) === true ) {
        appCtxSvc.updateCtx( 'Cm1CreateChange.warningMessage', warnMsgStr );
    } else {
        appCtxSvc.updateCtx( 'Cm1CreateChange.warningMessage', '' );
    }

    return warnMsgStr;
};

export const processPrimaryObjectsOutput = function( response ) {
    const secObjInputArray = [];
    response.output.forEach( item => {
        if( item.relationshipData[ 0 ].relationshipObjects ) {
            item.relationshipData[ 0 ].relationshipObjects.forEach( relationObj=>{
                secObjInputArray.push( relationObj.otherSideObject );
            } );
        }
    } );
    return secObjInputArray;
};

/**
 * Handles showing of concurrent change warning messages for paste actions.
 * @param {Object} pasteContext - The response object containing output data and relationships.
 * @param {boolean} shouldResolve - Flag to determine if the promise should resolve. Promise returned by this method resolves only in UI.
 * This is only by jest test as jest requires promise to resolve before completion.
 * @returns {Promise} promise is resolved by UI warning message button. This to ensure actions down the line are processed only after user confirmation.
 */
export let showConcurrentWarningForPasteAction = async( pasteContext, shouldResolve ) => {
    let deferred = AwPromiseService.instance.defer();
    let inputData = {};
    inputData.inputObjs = processSecondaryObjectsInput( pasteContext, false, pasteContext.targetObject.uid, deferred );
    inputData.typeFilters = [ 'GnChangeNoticeRevision' ];
    const expResponse = await soaSvc.postUnchecked( 'ChangeManagement-2025-06-ChangeManagement', 'getConcurrentChanges', inputData );
    getListOfItemAndassociatedECNs( expResponse );
    processWarningMessages( expResponse );
    if( appCtxSvc.getCtx( 'Cm1CreateChange.selectedItemHasConflictingChange' ) !== true ) {
        eventBus.publish( 'Cm1ConcChangePasteHandler.continuePasteAction', {
            scope: {
                pasteContext: {
                    sourceObject: pasteContext.sourceObject,
                    targetObject: pasteContext.targetObject,
                    relationType: pasteContext.relationType
                },
                deferredToResolve: deferred
            }
        } );
    }

    if( appCtxSvc.getCtx( 'Cm1CreateChange.openEcns.length' ) === 1 ) {
        var msg = _localTextBundle.showMultiSelectionChangeWarnEmptyMsg.replace( '{0}', appCtxSvc.getCtx( 'Cm1CreateChange.warningMessage' ) );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _localTextBundle.cancelText,
            onClick: function( $noty ) {
                $noty.close();
                deferred.reject();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: _localTextBundle.addButtonTitle,
            onClick: function( $noty ) {
                $noty.close();
                eventBus.publish( 'Cm1ConcChangePasteHandler.continuePasteAction', {
                    scope: {
                        pasteContext: {
                            sourceObject: pasteContext.sourceObject,
                            targetObject: pasteContext.targetObject,
                            relationType: pasteContext.relationType
                        },
                        deferredToResolve: deferred
                    }
                } );
            }
        } ];
        messageSvc.showWarning( msg, buttons );
        if( shouldResolve ) {
            deferred.resolve( true );
        }
    }
    if( appCtxSvc.getCtx( 'Cm1CreateChange.openEcns.length' ) > 1 ) {
        var msg = _localTextBundle.showMultiSelectionChangeWarnEmptyMsg.replace( '{0}', appCtxSvc.getCtx( 'Cm1CreateChange.warningMessage' ) );
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _localTextBundle.cancelText,
            onClick: function( $noty ) {
                $noty.close();
                deferred.reject();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: _localTextBundle.addButtonTitle,
            onClick: function( $noty ) {
                $noty.close();
                eventBus.publish( 'Cm1ConcChangePasteHandler.continuePasteAction', {
                    scope: {
                        pasteContext: {
                            sourceObject: pasteContext.sourceObject,
                            targetObject: pasteContext.targetObject,
                            relationType: pasteContext.relationType
                        },
                        deferredToResolve: deferred
                    }
                } );
            }
        } ];
        messageSvc.showWarning( msg, buttons );
        if( shouldResolve ) {
            deferred.resolve( true );
        }
    }
    return deferred.promise;
};

/**
 * This function will return the Soa Input object for getConcurrentChanges
 * @param {Object} selectedObjects - Selected objects which are to be added as Impacted items
 * @return {Object} Input objects for getConcurrentChanges service
 */
export let getSoaInputObjectsForGetConcurrentChanges = function( selectedObjects ) {
    let inputObjects = [];
    _.forEach( selectedObjects, function( proxyObject ) {
        if( proxyObject.props && proxyObject.props.cm0RelatedUsageRevs !== undefined && proxyObject.props.cm0RelatedUsageRevs.dbValues.length > 0 ) {
            let cm0RelatedUsageUids = [];
            let cm0RelatedParentUids = [];
            cm0RelatedUsageUids = proxyObject.props.cm0RelatedUsageRevs.dbValues;
            cm0RelatedParentUids = proxyObject.props.cm0RelatedParentRevs.dbValues;
            _.forEach( cm0RelatedUsageUids, function( relatedUsageUid, index ) {
                let usageObject = cdm.getObject( relatedUsageUid );
                inputObjects.push(
                    { uid: usageObject.uid,
                        type: usageObject.type } );
            } );
        } else {
            let itemRevObject = cdm.getObject( proxyObject.props.cm0ProposedImpactedObject.dbValues[0] );
            inputObjects.push(
                { uid: itemRevObject.uid,
                    type: itemRevObject.type } );
        }
    } );

    return inputObjects;
};

export default exports = {
    getData,
    setDefaultSelectedType,
    getCreateInput,
    handleHostedModeIssueTypeCreation,
    handleTypeSelectionJs,
    getTypeSelectedInformation,
    clearSelectedType,
    initializeCreateChangePanel,
    getInputForCreatableChangeType,
    getInputForAssignAndRemoveObjectsSOA,
    processResponseForTypeNames,
    ensureChangeTypesLoadedJs,
    getCreatableChangeTypesProvided,
    getDeriveData,
    updateResponsibleUserDataProvider,
    removeResponsibleUser,
    removeAttachementJs,
    selectCells,
    handleSelectionModel,
    initializeDefaultValues,
    openNewObjectInEditMode,
    getChangeContextProvider,
    getChangeContextProviderForCreate,
    setConditionToPin,
    panelUnpinClose,
    getDeriveOptions,
    removeSymptomDefect,
    updateAttachmentsProvider,
    updateChangeAtomicData,
    getDerivedFromObjectsForDerivePanel,
    updateSymptomDefectProvider,
    registerObjectProcessing,
    unRegisterObjectProcessing,
    getObjectString,
    updateAssignedProjectsProvider,
    processSecondaryObjectsInput,
    getListOfItemAndassociatedECNs,
    getListOfOpenECNs,
    processWarningMessages,
    processReviseWarnMessages,
    processPrimaryObjectsOutput,
    showConcurrentWarningForPasteAction,
    getSoaInputObjectsForGetConcurrentChanges
};
