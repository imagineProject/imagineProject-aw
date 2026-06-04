// Copyright (c) 2023 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/changeMgmtUtils
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import lovService from 'js/lovService';
import messagingService from 'js/messagingService';
import uwPropertyService from 'js/uwPropertyService';
import cmm from 'soa/kernel/clientMetaModel';
import hostFeedbackSvc from 'js/hosting/sol/services/hostFeedback_2015_03';
import objectRefSvc from 'js/hosting/hostObjectRefService';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import eventBus from 'js/eventBus';
import logger from 'js/logger';
import soaSvc from 'soa/kernel/soaService';
import adapterService from 'js/adapterService';
import dmSvc from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import editHandlerService from 'js/editHandlerService';
import addObjectUtils from 'js/addObjectUtils';
import Cm1ChangeCommandService from 'js/Cm1ChangeCommandService';
import dateTimeSvc from 'js/dateTimeService';
import xrtUtilities from 'js/xrtUtilities';
import { isViewModelTreeNode } from 'js/treeDataProviderRequestResponseHelper';
import viewModelObjectService from 'js/viewModelObjectService';
import soaService from 'soa/kernel/soaService';

var exports = {};

/**
   * flag used to turn on trace level logging
   */
var _debug_logIssuesActivity = browserUtils.getWindowLocationAttributes().logIssuesActivity !== undefined;

/**
   * Get Revise Inputs for reviseObjects SOA
   *
   * @param selectedItems Selected items to be revised
   * @return A list of revise inputs with the deep copy data
   */
export let getReviseInputsJs = async ( selectedItems ) => {
    let reviseInputsMap = new Map();

    let childParentDictionary = {};
    let parentIds = [];
    let underlyingObjects = [];

    // In case selected items are from BOM Assembly, we need to get the parents and underlying objects.
    if ( selectedItems.length > 0 &&  selectedItems[0].modelType.typeHierarchyArray.includes( 'Awb0Element' ) ) {
        _.forEach( selectedItems, ( selectedItem ) => {
            if( selectedItem.props?.awb0UnderlyingObject?.dbValues[ 0 ] !== null &&
                selectedItem.props?.awb0Parent?.dbValues[ 0 ] !== null ) {
                let bomParentId = selectedItem.props.awb0Parent.dbValues[ 0 ];
                let bomParentObj = cdm.getObject( bomParentId );
                let parentId = bomParentObj.props.awb0UnderlyingObject.dbValues[ 0 ];

                parentIds.push( parentId );
                childParentDictionary[ selectedItem.props.awb0UnderlyingObject.dbValues[ 0 ] ] = parentId;
                underlyingObjects.push( cdm.getObject( selectedItem.props.awb0UnderlyingObject.dbValues[ 0 ] ) );
            }
        } );
    } else {
        underlyingObjects = selectedItems;
    }

    // Query for Parent Ids Authoring Changes
    if( parentIds.length > 0 ) {
        let propertiesToLoad = [ 'cm0AuthoringChangeRevision' ];
        await dmSvc.getProperties( parentIds, propertiesToLoad );
    }

    let topLevelItem = appCtxSvc.ctx.pselected;
    if ( topLevelItem.modelType.typeHierarchyArray.includes( 'Awb0Element' )) {
        topLevelItem = cdm.getObject( topLevelItem.props.awb0UnderlyingObject.dbValues[ 0 ] );
    }

    _.forEach( underlyingObjects, ( item ) => {
        let reviseInputs = {};
        if( item.type === 'Awp0XRTObjectSetRow') {
            item = cdm.getObject( item.props.awp0Secondary.dbValue );
        }

        if ( item.modelType.typeHierarchyArray.indexOf( 'ItemRevision' ) > -1 ) {
            reviseInputs.item_revision_id = [ '' ];
        }

        if( item.props && item.props.object_desc && item.props.object_desc.dbValue ) {
            reviseInputs.object_desc = [ item.props.object_desc.dbValue ];
        }

        reviseInputs.fnd0ContextProvider = [ topLevelItem.uid ];

        let reviseInput = {};
        reviseInput.targetObject = item;
        reviseInput.reviseInputs = reviseInputs;
        reviseInputsMap.set( item.uid, reviseInput );
    } );

    return await self.setReviseInDeepCopyData( underlyingObjects, reviseInputsMap );
};

/**
 * Set deep copy data in revise inputs
 *
 * @param impactedItems The impacted items
 * @param reviseInputsMap Map of impacted items to their reviseIn
 * @return A list of revise inputs with the deep copy datas
 */
self.setReviseInDeepCopyData = async ( impactedItems, reviseInputsMap ) => {
    let deepCopyDataInputs = [];
    for( let i = 0; i < impactedItems.length; i++ ) {
        let dcd = {
            operation: 'Revise',
            businessObject: impactedItems[ i ]
        };
        deepCopyDataInputs.push( dcd );
    }

    let inputData = {
        deepCopyDataInput: deepCopyDataInputs
    };

    let deepCopyInfoMap = [];
    let response = await soaSvc.post( 'Core-2014-10-DataManagement', 'getDeepCopyData', inputData );

    if( response !== undefined ) {
        deepCopyInfoMap = response.deepCopyInfoMap;
        for( let i = 0; i < impactedItems.length; i++ ) {
            for( let b in deepCopyInfoMap[ 0 ] ) {
                if( deepCopyInfoMap[ 0 ][ b ].uid === impactedItems[ i ].uid ) {
                    let reviseIn = reviseInputsMap.get( deepCopyInfoMap[ 0 ][ b ].uid );
                    reviseIn.deepCopyDatas = self.convertDeepCopyData( deepCopyInfoMap[ 1 ][ b ] );
                    break;
                }
            }
        }
    }
    return Array.from( reviseInputsMap.values() );
};

/**
   * Convert Deep Copy Data from client to server format
   *
   * @param deepCopyData property name
   * @return A list of deep copy datas
   */
self.convertDeepCopyData = function( deepCopyData ) {
    var deepCopyDataList = [];
    for( var i = 0; i < deepCopyData.length; i++ ) {
        var newDeepCopyData = {};
        newDeepCopyData.attachedObject = deepCopyData[ i ].attachedObject;
        newDeepCopyData.copyAction = deepCopyData[ i ].propertyValuesMap.copyAction[ 0 ];
        newDeepCopyData.propertyName = deepCopyData[ i ].propertyValuesMap.propertyName[ 0 ];
        newDeepCopyData.propertyType = deepCopyData[ i ].propertyValuesMap.propertyType[ 0 ];

        var value = false;
        var tempStrValue = deepCopyData[ i ].propertyValuesMap.copy_relations[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.copyRelations = value;

        value = false;
        tempStrValue = deepCopyData[ i ].propertyValuesMap.isTargetPrimary[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isTargetPrimary = value;

        value = false;
        tempStrValue = deepCopyData[ i ].propertyValuesMap.isRequired[ 0 ];
        if( tempStrValue === '1' ) {
            value = true;
        }
        newDeepCopyData.isRequired = value;

        newDeepCopyData.operationInputTypeName = deepCopyData[ i ].operationInputTypeName;

        var operationInputs = {};
        operationInputs = deepCopyData[ i ].operationInputs;
        newDeepCopyData.operationInputs = operationInputs;

        var aNewChildDeepCopyData = [];
        if( deepCopyData[ i ].childDeepCopyData && deepCopyData[ i ].childDeepCopyData.length > 0 ) {
            aNewChildDeepCopyData = self.convertDeepCopyData( deepCopyData[ i ].childDeepCopyData );
        }
        newDeepCopyData.childDeepCopyData = aNewChildDeepCopyData;
        deepCopyDataList.push( newDeepCopyData );
    }

    return deepCopyDataList;
};

/**
 * Get Input object for new createAndSubmitChangeObject SOA
 * @param {String} boName  Business object type name for object to be created.
 * @param {Object} propertyNameValues Map with key as property name and value as property values.
 * @param {Object} compoundCreateChange Compound object which needs to be created with current object
 * @param {String} panelType CREATE based on which input object will be returned.
 * @returns {Object} Input object
 */
const _getCreateInputObjectForNewSOA = function( boName, propertyNameValues, compoundCreateChange, panelType ) {
    if ( panelType === 'CREATE' ) {
        return {
            boName: boName,
            changeRelatedProps: propertyNameValues,
            compoundCreateChange: compoundCreateChange
        };
    }
};


/**
 * Get Input object for creating change object SOA
 * @param {String} boName  Business object type name for object to be created.
 * @param {Object} propertyNameValues Map with key as property name and value as property values.
 * @param {Object} compoundCreateChange Compound object which needs to be created with current object
 * @param {String} panelType CREATE or DERIVE based on which input object will be returned.
 * @returns {Object} Input object
 */
export let getCreateInputObject = function( boName, propertyNameValues, compoundDeriveInput, panelType ) {
    // If panelType is CREATE, get input object for creating change object SOA.
    // Else, return input object for derive change object SOA.
    if ( panelType === 'CREATE' ) {
        // get input object for new createAndSubmitChangeObjects SOA.
        return _getCreateInputObjectForNewSOA( boName, propertyNameValues, compoundDeriveInput, panelType );
    }
    return {
        boName: boName,
        propertyNameValues: propertyNameValues,
        compoundDeriveInput: compoundDeriveInput
    };
};

/**
 * Update parentCreateInput object with updated compoundCreateInput or compoundCreateChange property value.
 * @param {String} panelType CREATE, based on which input object will be updated
 * @param {String} propName Name of the property
 * @param {Object} childCreateInput Child Input object which needs to be added as value for key provided as property name.
 * @param {Object} parentCreateInput Parent Input object for which compoundCreateInput or compoundCreateChange property needs to be updated.
 * @returns {Object} Updated parentCreateInput object
 */
const _updateCompoundCreateValue = function( panelType, propName, childCreateInput, parentCreateInput ) {
    let newParentCreateInput = _.clone( parentCreateInput );
    if ( panelType === 'CREATE' ) {
        // update compoundCreateChange property of parentCreateInput object.
        if ( !newParentCreateInput.compoundCreateChange.hasOwnProperty( propName ) ) {
            newParentCreateInput.compoundCreateChange[propName] = [];
        }
        newParentCreateInput.compoundCreateChange[propName].push( childCreateInput );
    }
    return newParentCreateInput;
};

/**
   * Private method to create input for create item
   *
   * @param fullPropertyName property name
   * @param count current count
   * @param propertyNameTokens property name tokens
   * @param createInputMap create input map
   * @param operationInputViewModelObject view model object
   * @return {String} full property name
   */
export let addChildInputToParentMap = function( fullPropertyName, propName, parentTypeName, createInputMap, panelType ) {
    var childFullPropertyName = fullPropertyName;
    if ( childFullPropertyName.length > 0 ) {
        childFullPropertyName += '__' + propName; //$NON-NLS-1$
    } else {
        childFullPropertyName += propName;
    }

    // Check if the child create input is already created
    var childCreateInput = _.get( createInputMap, childFullPropertyName );
    if ( !childCreateInput && parentTypeName ) {
        var parentType = cmm.getType( parentTypeName );
        if ( parentType ) {
            // Get the parent create input
            var parentCreateInput = _.get( createInputMap, fullPropertyName );
            if ( parentCreateInput ) {
                // Create the child create input
                // Add the child create input to parent create input
                childCreateInput = exports.getCreateInputObject( parentType.owningType, {}, {}, panelType );
                if ( panelType === 'CREATE' ) {
                    // Update compoundCreateInput or compoundCreateChange property of parentCreateInput.
                    parentCreateInput = _updateCompoundCreateValue( panelType, propName, childCreateInput, parentCreateInput );
                } else {
                    if ( !parentCreateInput.compoundDeriveInput.hasOwnProperty( propName ) ) {
                        parentCreateInput.compoundDeriveInput[propName] = [];
                    }
                    parentCreateInput.compoundDeriveInput[propName].push( childCreateInput );
                }
                createInputMap[childFullPropertyName] = childCreateInput;
            }
        }
    }
    return childFullPropertyName;
};


export let addChildInputToParentMapForCustomPanel = function( fullPropertyName, count, propertyNameTokens, createInputMap, vmProp, panelType ) {
    var propName = propertyNameTokens[count];
    var childFullPropertyName = fullPropertyName;
    if ( count > 0 ) {
        childFullPropertyName += '__' + propName; //$NON-NLS-1$
    } else {
        childFullPropertyName += propName;
    }

    // Check if the child create input is already created
    var childCreateInput = _.get( createInputMap, childFullPropertyName );
    if ( !childCreateInput && vmProp && vmProp.intermediateCompoundObjects ) {
        var compoundObject = _.get( vmProp.intermediateCompoundObjects, childFullPropertyName );
        if ( compoundObject ) {
            // Get the parent create input
            var parentCreateInput = _.get( createInputMap, fullPropertyName );
            if ( parentCreateInput ) {
                // Create the child create input
                // Add the child create input to parent create input
                childCreateInput = exports.getCreateInputObject( compoundObject.modelType.owningType, {}, {}, panelType );
                if ( panelType === 'CREATE' ) {
                    // Update compoundCreateInput or compoundCreateChange property of parentCreateInput
                    parentCreateInput = _updateCompoundCreateValue( panelType, propName, childCreateInput, parentCreateInput );
                } else {
                    if ( !parentCreateInput.compoundDeriveInput.hasOwnProperty( propName ) ) {
                        parentCreateInput.compoundDeriveInput[propName] = [];
                    }
                    parentCreateInput.compoundDeriveInput[propName].push( childCreateInput );
                }
                createInputMap[childFullPropertyName] = childCreateInput;
            }
        }
    }
    return childFullPropertyName;
};


export let processPropertyForCreateInput = function( propName, vmProp, createInputMap, panelType ) {
    if ( vmProp ) {
        var valueStrings = uwPropertyService.getValueStrings( vmProp );
        if ( valueStrings && valueStrings.length > 0 ) {
            var fullPropertyName = '';
            var propertyNameTokens = propName.split( '.' );
            for ( var i = 0; i < propertyNameTokens.length; i++ ) {
                var propertyName = '';
                var parentTypeName = null;
                if ( propertyNameTokens[i].startsWith( 'REF' ) ) {
                    var index = propertyNameTokens[i].indexOf( ',' );
                    propertyName = propertyNameTokens[i].substring( 4, index ).trim();
                    parentTypeName = propertyNameTokens[i].substring( index + 1, propertyNameTokens[i].length - 1 ).trim();
                } else {
                    propertyName = propertyNameTokens[i];
                }

                if ( i < propertyNameTokens.length - 1 ) {
                    // Handle child create inputs
                    fullPropertyName = exports.addChildInputToParentMap( fullPropertyName, propertyName, parentTypeName,
                        createInputMap, panelType );
                } else {
                    // Handle property
                    var createInput = createInputMap[fullPropertyName];
                    if ( createInput ) {
                        var propertyNameValues = {};

                        // If minimum TC platform version is 142, get propertyNameValues form changeRelatedProps property of createInput.
                        // Else, get propertyNameValues from propertyNameValues property of createInput.
                        // Below changes are required as we are supporting two different input structure for platform version above TC142 and below.
                        if ( panelType === 'CREATE' ) {
                            propertyNameValues = createInput.changeRelatedProps;
                        } else {
                            propertyNameValues = createInput.propertyNameValues;
                        }
                        _.set( propertyNameValues, propertyName, valueStrings );
                    }
                }
            }
        }
    }
};

export let processPropertyForCustomPanelInput = function( propName, vmProp, createInputMap, panelType ) {
    if ( vmProp ) {
        var valueStrings = uwPropertyService.getValueStrings( vmProp );
        if ( valueStrings && valueStrings.length > 0 ) {
            var propertyNameTokens = propName.split( '__' );
            var fullPropertyName = '';
            for ( var i = 0; i < propertyNameTokens.length; i++ ) {
                if ( i < propertyNameTokens.length - 1 ) {
                    // Handle child create inputs
                    fullPropertyName = exports.addChildInputToParentMapForCustomPanel( fullPropertyName, i, propertyNameTokens,
                        createInputMap, vmProp, panelType );
                } else {
                    // Handle property
                    var createInput = createInputMap[fullPropertyName];
                    if ( createInput ) {
                        var propertyNameValues = {};

                        // If minimum TC platform version is 142, get propertyNameValues form changeRelatedProps property of createInput.
                        // Else, get propertyNameValues from propertyNameValues property of createInput.
                        // Below changes are required as we are supporting two different input structure for platform version above TC142 and below.
                        if ( panelType === 'CREATE' ) {
                            propertyNameValues = createInput.changeRelatedProps;
                        } else {
                            propertyNameValues = createInput.propertyNameValues;
                        }
                        _.set( propertyNameValues, propertyNameTokens[i], valueStrings );
                    }
                }
            }
        }
    }
};

/**
 * Create input structure for new createAndSubmitChangeObjects SOA introduced in TC14.2
 *
 * @param {Object} createInputMap - Contains createData information of createAndSubmitChangeObjects SOA.
 * @param {Object} data - View Model data object.
 * @param {Object} workflowData - Workflow related information.
 * @param {Object} participantInfo - Participant related information.
 * @returns
 */
const _getCreateInputDataForCreateAndSubmitSOA = function( createInputMap, data, workflowData, participantInfo ) {
    // Set as Active Change.
    const setActive = Boolean( data.setActiveChange.dbValue );

    let participantData = [];

    const participantSectionObjects = participantInfo?.participantSectionObjects;

    if( participantSectionObjects && !_.isEmpty( participantSectionObjects ) ) {
        // Create Participant data that can be passed to new SOA.
        const updatedParticipantsInfo = participantSectionObjects.filter( participantDetails => {
            return participantDetails.modelObjects.length > 0;
        } );

        participantData = updatedParticipantsInfo.map( participantDetails => {
            const assigneeList = participantDetails.modelObjects.map( assigneeDetails => {
                // Right now we are using uniqueUid as workaroud for duplicate resource pool cases when duplicate
                // resource pools added to one aw-list component then because of uid check in component, there
                // is one issue to render it correctly. So to handle it we update the uid with some random number
                // to make it unique and then added uniqueUid to contain the original UID for resource pool.
                return {
                    type: assigneeDetails.type,
                    uid: assigneeDetails.uniqueUid ? assigneeDetails.uniqueUid : assigneeDetails.uid
                };
            } );
            return {
                internalName: participantDetails.internalName,
                allowMultipleAssignee: participantDetails.selectionModelMode !== 'single',
                assigneeList: assigneeList,
                additionalParticipantData: {}
            };
        } );
    }

    return {
        clientId: 'CreateObject',
        createData: _.get( createInputMap, '' ),
        targetObject: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        },
        relatedData: data.dataToBeRelated,
        pasteProp: '',
        workflowData: workflowData,
        setActive: setActive,
        changeParticipantData: participantData
    };
};


/**
   * Get input data for object creation.
   *
   * @param {Object} data - the view model data object
   * @return {Object} create input
   */
export let getCreateInputFromDerivePanel = function( data, panelType, editHandler, participantInfo ) {
    var createInputMap = {};
    createInputMap[''] = exports.getCreateInputObject( data.creationType, {}, {}, panelType );

    // Clone workflowData before updating.
    const newWorkflowData = _.clone( data.workflowData );

    let objectTypeIn = data.creationType ? '_' + data.creationType : '';
    if ( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if ( dataSource ) {
            let allEditableProperties = dataSource.getAllEditableProperties();
            _.forEach( allEditableProperties, function( vmProp ) {
                // Get workflow template information from Input Panel.
                if ( vmProp.propertyName.includes( 'awp0ProcessTemplates' ) ) {
                    let value = uwPropertyService.getValueStrings( vmProp );
                    if( value && value.length > 0 ) {
                        newWorkflowData.templateName = value[0];
                    }
                } else if ( vmProp && ( vmProp.isAutoAssignable || uwPropertyService.isModified( vmProp ) ) ) {
                    exports.processPropertyForCreateInput( vmProp.propertyName, vmProp, createInputMap, panelType );
                }
            } );
        }

        var _fileInputForms = data.fileInputForms;
        if ( !_fileInputForms ) {
            _fileInputForms = [];
        }

        if ( dataSource.getDeclViewModel().customPanelInfo ) {
            _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                // copy custom panel's fileInputForms
                var customFileInputForms = customPanelVMData.fileInputForms;
                if ( customFileInputForms ) {
                    _fileInputForms = _fileInputForms.concat( customFileInputForms );
                }

                // copy custom panel's properties
                var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                _.forEach( oriVMData, function( propVal, propName ) {
                    if ( _.has( customPanelVMData, propName ) ) {
                        var vmProp = customPanelVMData[propName];
                        if ( propName.includes( '__' ) ) {
                            exports.processPropertyForCustomPanelInput( propName, vmProp, createInputMap, panelType );
                        } else {
                            exports.processPropertyForCreateInput( propName, vmProp, createInputMap, panelType );
                        }
                    }
                } );
            } );
        }

        if ( data.additionalVMProps ) {
            _.forEach( data.additionalVMProps, function( vmProp, propName ) {
                if ( propName.includes( '__' ) ) {
                    exports.processPropertyForCustomPanelInput( propName, vmProp, createInputMap, panelType );
                } else {
                    exports.processPropertyForCreateInput( propName, vmProp, createInputMap, panelType );
                }
            } );
        }
    }

    // If minimum TC platform version is 142, create input structure for new SOA i.e. createAndSubmitChangeObjects.
    // Else, return input structure for old SOA.
    let soaCreateInput = {};
    if( panelType === 'CREATE' ) {
        soaCreateInput = _getCreateInputDataForCreateAndSubmitSOA( createInputMap, data, newWorkflowData, participantInfo );
    } else {
        soaCreateInput = {
            clientId: 'CreateObject',
            createData: _.get( createInputMap, '' ),
            targetObject: {
                uid: 'AAAAAAAAAAAAAA',
                type: 'unknownType'
            },
            dataToBeRelated: data.dataToBeRelated,
            pasteProp: '',
            workflowData: newWorkflowData
        };
    }

    return [ soaCreateInput ];
};

/**
   * Updating occmgmt context isChangeEnabled
   *
   * @param {string} changeToggleState true if change is enabled else false.
   */
export let updateCtxWithShowChangeValue = function( changeToggleState ) {
    let contextKey = appCtxSvc.ctx.aceActiveContext.key;
    appCtxSvc.updatePartialCtx( contextKey + '.isChangeEnabled', changeToggleState === 'true' );
    appCtxSvc.updateCtx( 'isRedLineMode', changeToggleState );
    appCtxSvc.updatePartialCtx( 'showChange', changeToggleState === 'true' );
};

/**
 * Generates a list of change contexts by adding a "No Change Context" entry to the LOV  response.
 *
 * This function interacts with the LOV service to retrieve initial values, adds a "No Change Context" entry,
 * and optionally includes an "Active Change Context" entry based on the current context. It processes the response
 * and applies a filter based on the provided filter value.
 *
 * @param {Object} data - The data object containing context and filter information.
 * @param {Boolean} isInitialCall - false for initializeAction and true for nextAction.
 * @returns {Promise<Array>} - A promise that resolves to an array of filtered LOV values.
 *  If there is an error or the LOV service fails, the promise resolves to an array
 * with at least a "No Change Context" entry.
 */
export let generateChangeContextList = function( data, isInitialCall = false ) {
    var deferedLOV = AwPromiseService.instance.defer();
    //get No active change value for cases where getInitialValues LOV rejects the promise due to error
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );

    //Create an entry for "No Change Context"
    const noChangeContextEntry = {
        propDisplayValue: localTextBundle.noChangeContext,
        propInternalValue: ''
    };

    const selectionUid = appCtxSvc.ctx.selected ? appCtxSvc.ctx.selected.uid : '';
    const xrtSummaryUid = appCtxSvc.ctx.xrtSummaryContextObject ? appCtxSvc.ctx.xrtSummaryContextObject.uid : '';
    var propInternalValueForActiveChange = selectionUid ? selectionUid : xrtSummaryUid;

    // Create the activeChangeContextEntry object
    const activeChangeContextEntry = {
        propDisplayValue: localTextBundle.activeChangeContext,
        propInternalValue: propInternalValueForActiveChange
    };

    const dpToUpdate = data?.dataProviders?.changeContextLinkLOV;
    let loadedObjects = _.cloneDeep( dpToUpdate?.viewModelCollection?.loadedVMObjects );


    let getListOfECNs = function( lovValues, updateDp = false ) {
        if ( data.ctx.mselected.length === 1 ) {
            const selectedChangeObject = appCtxSvc.ctx.selected.props.object_string.dbValue;
            const activeChangeContext = appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext.uiValues[0];
            // Check if selected object is included in response
            const typeIncluded = lovValues.some( element => element.propDisplayValue === selectedChangeObject );
            // Add activeChangeContextEntry if selectedChangeObject is included and differs from activeChangeContext
            if ( typeIncluded && selectedChangeObject !== activeChangeContext ) {
                // Check if activeChangeContextEntry is already in the list to avoid duplicates
                const entryIncluded = lovValues.some( element => element.propDisplayValue === activeChangeContextEntry.propDisplayValue );
                if ( !entryIncluded ) {
                    // If selected change is available in next lov call then update the dp to avoid appending the 'Set Current as active' in between.
                    if( updateDp && loadedObjects !== undefined ) {
                        loadedObjects.unshift( activeChangeContextEntry );
                        let filteredLoadedObjects = loadedObjects.filter( element => filterSearch( data.filterBox.dbValue, element.propDisplayValue ) );
                        if( filteredLoadedObjects.length > 0 ) {
                            dpToUpdate?.update && dpToUpdate?.update( filteredLoadedObjects );
                        }
                    } else {
                        lovValues.unshift( activeChangeContextEntry );
                    }
                }
            }
        }
        return lovValues.filter( element => filterSearch( data.filterBox.dbValue, element.propDisplayValue ) );
    };

    // If moreValuesExist is true fetch more values by getNextLOVValues soa.
    if( data.lovDataInfo?.responseData?.moreValuesExist && !isInitialCall ) {
        var serviceInput = {};
        serviceInput.lovData = data.lovDataInfo?.responseData?.lovData;

        return soaService.postUnchecked( 'Core-2013-05-LOV', 'getNextLOVValues', serviceInput ).then( function( response ) {
            let moreValuesExist = response.moreValuesExist ?? false;

            let vmProp = appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext;
            let lovValues = lovService.createLOVEntries( response, vmProp.type );

            let lovDataInfo = lovService.processLOVEntries( { responseData: response, lovValues: lovValues } );

            let listofEcns = getListOfECNs( lovValues, true );
            return {
                listofEcns: listofEcns,
                lovDataInfo: lovDataInfo,
                moreValuesExist: moreValuesExist
            };
        } );
    }

    // If moreValuesExist is false fetch initial data via getInititalLOVValues soa.
    lovService.getInitialValues( '', deferedLOV, appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext,
        'Create', appCtxSvc.ctx.userSession, null, 100, '', '' );

    /**
     * Process response when LOV 'getInitialValues' has been performed.
     */
    return deferedLOV.promise.then( function( response ) {
        let lovDataInfo = lovService.processLOVEntries( response );
        // Initialize lovValues if not present and add noChangeContextEntry at the top
        response.lovValues = response.lovValues || [];
        response.lovValues.unshift( noChangeContextEntry );

        let moreValuesExist = response.responseData?.moreValuesExist ?? false;

        let listofEcns = getListOfECNs( response.lovValues );

        if( _.isEmpty( listofEcns ) && moreValuesExist ) {
            listofEcns.unshift( noChangeContextEntry );
        }

        return {
            listofEcns: listofEcns,
            lovDataInfo: lovDataInfo,
            moreValuesExist: moreValuesExist
        };
    } ).catch( function( response ) {
        // Ensure response.lovValues is initialized and add noChangeContextEntry in case of an error
        response = response || {};
        response.lovValues = response.lovValues || [];
        response.lovValues.unshift( noChangeContextEntry );
        let listofEcns =  response.lovValues.filter( element => filterSearch( data.filterBox.dbValue, element.propDisplayValue ) );
        return {
            listofEcns: listofEcns
        };
    } ).catch( function( response ) {
        // Handle any remaining errors
        let listofEcns =  handleChangeContextError( response );
        return {
            listofEcns: listofEcns
        };
    } );
};

/*
    Handle selection for Active Change LOV value
*/
export let updateActiveChangeSelection = function( dataprovider, activeobject ) {
    var localTextBundle = localeSvc.getLoadedText( 'CreateChangeMessages' );        // Using Locale service for Local text( "noActiveChangeDisplayValue" )
    let indexOfCurrActive = -1;
    let noActiveChangeIndex = -1;

    dataprovider.viewModelCollection.loadedVMObjects.forEach( function( vmo, index ) {
        if ( vmo.propDisplayValue === activeobject.uiValue ) {                               // Get Active Change index
            indexOfCurrActive = index;
        } else if ( vmo.propDisplayValue === localTextBundle.noActiveChangeDisplayValue ) {  // Get "No Active Change" LOV index through Locale services
            noActiveChangeIndex = index;                                                     // Avoid using any language specific text eg."No Active Change"
        }                                                                                    // Use Locale services in that case
    } );
    if( indexOfCurrActive >= 0 ) {
        dataprovider.changeObjectsSelection( indexOfCurrActive, indexOfCurrActive, true );   // Making Selection For LOV
    } else if ( ( activeobject.value === null || activeobject.value === '' ) &&  noActiveChangeIndex >= 0  ) {
        dataprovider.changeObjectsSelection( noActiveChangeIndex, noActiveChangeIndex, true );
    }
};

let handleChangeContextError = ( response ) => {
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var noChangecontextString = localTextBundle.noChangeContext;

    var noChangeContextEntry = {};
    noChangeContextEntry.propDisplayValue = noChangecontextString;
    noChangeContextEntry.propInternalValue = '';

    var msgObj = {
        msg: '',
        level: 0
    };
    let partialErrors = response.responseData.ServiceData.partialErrors;
    if ( partialErrors.length > 0 ) {
        for ( var x = 0; x < partialErrors[0].errorValues.length; x++ ) {
            if ( partialErrors[0].errorValues[x].code !== 54060 ) {
                msgObj.msg += partialErrors[0].errorValues[x].message;
                msgObj.msg += '<BR/>';
                msgObj.level = _.max( [ msgObj.level, partialErrors[0].errorValues[x].level ] );
            }
        }
    }
    if ( msgObj.msg !== '' ) {
        messagingService.showError( msgObj.msg );
    }
    return [ noChangeContextEntry ];
};

/**
 * Get list of properties from editHandler from create panel context.
 * @param {Object} data - The view model data
 * @param {Object} editHandlerIn - Edit handler object
 * @param {Object} derivedFromObjects - Derived from object.
 * @returns
 */
export let getDerivedFromProperties = function( data, editHandlerIn, derivedFromObjects ) {
    let propToLoad = [];
    let editHandler = editHandlerIn;
    if ( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
    }

    // Get list of properties which are present in CREATE XRT.
    const allEditableProperties = addObjectUtils.getObjCreateEditableProperties( data.selectedType, 'CREATE', null, editHandler );
    _.forEach( allEditableProperties, function( vmProp ) {
        if ( vmProp !== undefined ) {
            propToLoad.push( vmProp.propertyName );
            data[vmProp.propertyName] = vmProp;
        }
    } );

    if ( derivedFromObjects === null || derivedFromObjects.length === 0 || propToLoad === null ) {
        return;
    }

    const selectedChangeRevision = cdm.getObject( derivedFromObjects[0].uid );
    const selectedChange = cdm.getObject( selectedChangeRevision.props.items_tag.dbValues[ 0 ] );

    return {
        selectedChange: selectedChange,
        selectedChangeRevision: selectedChangeRevision,
        propToLoad: propToLoad
    };
};

/**
 * Getting list of property names for input to getProperties SOA.
 * @param {object} propToLoad - List of properties loaded from XRT.
 * @returns {object} - List of real property names.
 */
export let getDerivePropertiesNames = function( propToLoad ) {
    // Getting property name from "REF(revision,ChangeNoticeRevisionCreI).<PropertyName>"
    // before calling getProperties method to load these properties.
    return propToLoad.map( ( property ) => {
        const propertyNameTokens = property.split( '.' );
        return propertyNameTokens.length === 2 && propertyNameTokens[0].startsWith( 'REF' ) ? propertyNameTokens[1] : property;
    } );
};

/**
   * Honours CopyFromOriginal Property Constant
   * while populating create panel properties
   * on Derive Change
   *
   * @param {String} data - The view model data
   * @param {Object} editHandlerIn - Edit handler object
   * @param {Object} selectedChangeRevision - Selected object to derive
   * @param {String} propToLoad - Properties on create panel
   */
export let populateCreatePanelPropertiesOnDerive = async function( data, editHandlerIn, selectedChangeRevision, propToLoad ) {
    let editHandler = editHandlerIn;
    if ( !editHandler ) {
        editHandler = editHandlerService.getEditHandler( 'CREATE_PANEL_CONTEXT' );
    }

    const selectedChangeItem = cdm.getObject( selectedChangeRevision.props.items_tag.dbValues[ 0 ] );

    let updatedProps = [];
    const setValuePromises = [];

    for ( let propIndex in propToLoad ) {
        if ( propToLoad[propIndex] === '' || propToLoad[propIndex] === null ) {
            continue;
        }

        let viewModelProp = propToLoad[propIndex];
        let property = propToLoad[propIndex];
        let propertyOnObjType = null;

        const propertyNameTokens = property.split( '.' );

        if ( propertyNameTokens.length === 2 && propertyNameTokens[0].startsWith( 'REF' ) ) {
            const index = propertyNameTokens[ 0 ].indexOf( ',' );
            propertyOnObjType = propertyNameTokens[ 0 ].substring( 4, index ).trim();
            property = propertyNameTokens[1];
        }

        let objectToConsider = selectedChangeRevision;
        if ( _.isUndefined( objectToConsider.props[property] ) ) {
            objectToConsider = selectedChangeItem;
            if ( _.isUndefined( objectToConsider.props[property] ) ) {
                continue;
            }
        }

        let isCopyTrue = isCopyFromOriginal( data, propertyOnObjType, property );

        // hasReadAccess flag has been introduced for ALS. If user has access then only can read the value of a property
        let hasReadAccess = true;
        if( objectToConsider.props[property].hasReadAccess !== undefined && objectToConsider.props[property].hasReadAccess !== null ) {
            hasReadAccess = objectToConsider.props[property].hasReadAccess;
        }

        let typeName = null;
        if ( propertyOnObjType !== null && propertyOnObjType === 'revision' ) {
            typeName = data.selectedType.dbValue + 'Revision';
        } else {
            typeName = data.selectedType.dbValue;
        }

        if ( hasReadAccess && isCopyTrue === true &&
                ( data[viewModelProp].dbValue === null || data[viewModelProp].dbValue === '' || data[ viewModelProp ].dbValue === 0 || data[ viewModelProp ].dbValue.length === 0 || data[ viewModelProp ].dbValues[0] === null
                || data[viewModelProp].type === 'DATE' && data[ viewModelProp ].dateApi.dateValue === '' ) ) {
            setValuePromises.push( setValueOnCreatePanel( data, objectToConsider, property, viewModelProp, updatedProps, typeName ) );
        }
    }

    // Wait for all async operations to complete
    await Promise.all( setValuePromises );

    // Update dataSource
    const dataSource = editHandler.getDataSource();
    dataSource.replaceValuesWithNewValues( updatedProps );
};

/**
   * checks if CopyFromOriginal Property Constant
   * is set to true for the property of Object/related object
   * for the target object to be created
   *
   * @param {object} data - The view model data
   * @param {String} property - property of Object to be created
   * @param {String} propertyOnObjType - relation of object on which property resides
   */
function isCopyFromOriginal( data, propertyOnObjType, property ) {
    var typeName;
    if ( propertyOnObjType !== null && propertyOnObjType === 'revision' ) {
        typeName = data.selectedType.dbValue + 'Revision';
    } else {
        typeName = data.selectedType.dbValue;
    }
    var objCreateModelType = cmm.getType( typeName );
    if ( objCreateModelType === null ) {
        typeName += 'CreI';
        objCreateModelType = cmm.getType( typeName );
    }
    if ( objCreateModelType === null ) {
        return false;
    }
    var propDescriptor = objCreateModelType.propertyDescriptorsMap[property];
    if ( _.isUndefined( propDescriptor ) ) {
        return false;
    }
    var propConstantMap = propDescriptor.constantsMap;
    var isCopyFromOrigin = propConstantMap.copyFromOriginal;
    if ( isCopyFromOrigin !== null && isCopyFromOrigin === '1' ) {
        return true;
    }
    return false;
}

/**
 * Set value on ViewModelProperty object with provided value.
 * @param {object} vmoProp - ViewModelProperty.
 * @param {Date} dateVal - Date object.
 */
let setDateValueForProp = function( vmoProp, dateVal ) {
    vmoProp.dateApi.dateObject = dateVal;
    vmoProp.dateApi.dateValue = dateTimeSvc.formatDate( dateVal );
    vmoProp.dateApi.timeValue = dateTimeSvc.formatTime( dateVal );
};

/**
 * Calls the 'Core-2013-05-LOV' SOA to get initial LOV values.
 * @param {Object} boName - The business object name for the LOV.
 * @param {string} propertyName - The property name for which LOV is required.
 * @returns {Promise<Array>} Promise resolving to an array of LOV values.
 */
const _fetchEligibleLOVValues = function( boName, propertyName ) {
    const inputData = {
        initialData: {
            lovInput: {
                owningObject: null,
                boName: boName,
                operationName: 'Search'
            },
            propertyName: propertyName
        }
    };
    return soaSvc.post( 'Core-2013-05-LOV', 'getInitialLOVValues', inputData )
        .then( function( response ) {
            if ( response && Array.isArray( response.lovValues ) ) {
                return response.lovValues.map( function( lovValue ) {
                    return {
                        lovType: lovValue.propInternalValueTypes.lov_values,
                        propInternalValue: lovValue.propInternalValues.lov_values[0],
                        propDisplayValue: lovValue.propDisplayValues.lov_values[0],
                        propHasValidValues: true,
                        propDisplayDescription: ''
                    };
                } );
            }
            return [];
        } )
        .catch( function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            return [];
        } );
};

/**
 * Checks if the given dbValues or dbValue are present in the LOV values returned by _fetchEligibleLOVValues.
 * @param {string} boName - The business object name for the LOV.
 * @param {string} propertyName - The property name for which LOV is required.
 * @param {Array} dbValues - Array of dbValues to check.
 * @param {string} dbValue - Single dbValue to check.
 * @returns {Promise<boolean>} Promise resolving to true if any dbValue/dbValues are present in LOV, else false.
 */
const _areDbValuesInLOV = async function( boName, propertyName, dbValues, dbValue ) {
    const lovEntries = await _fetchEligibleLOVValues( boName, propertyName );
    const lovInternalValues = lovEntries.map( entry => entry.propInternalValue );

    // Check if any dbValues are present in LOV
    if ( Array.isArray( dbValues ) && dbValues.length > 0 ) {
        for ( let val of dbValues ) {
            if ( !lovInternalValues.includes( val ) ) {
                return false;
            }
        }
    }

    // Check if single dbValue is present in LOV
    if ( dbValue && !lovInternalValues.includes( dbValue ) ) {
        return false;
    }

    return true;
};

/**
   * gets value of property from source object
   * and sets it on the create panel for the object to be created
   *
   * @param {object} data - The view model data
   * @param {object} selectedChange - source change object
   * @param {String} property - property of Object to be created
   * @param {String} viewModelProp - view model property for the object
   * @param {object} updatedProps - List of ViewModelProperty which are updated with default value.
   * @param {String} typeName - Type name of the object to be created.
   */
async function setValueOnCreatePanel( data, selectedChange, property, viewModelProp, updatedProps, typeName ) {
    var propertyVal = null;
    if ( selectedChange !== null && !_.isUndefined( selectedChange.props[property].dbValue ) ) {
        propertyVal = selectedChange.props[property].dbValue;
    } else if ( selectedChange !== null && !_.isUndefined( selectedChange.props[property].dbValues ) && propertyVal === null ) {
        propertyVal = selectedChange.props[property].dbValues[0];
    }
    if ( _.isUndefined( data[viewModelProp] ) || propertyVal === null ) {
        return;
    }

    // Set Date property.
    if( data[viewModelProp].type === 'DATE' ) {
        data[viewModelProp].dbValue = new Date( propertyVal ).getTime();
        setDateValueForProp( data[viewModelProp], new Date( propertyVal ) );
    } else if ( data[viewModelProp].hasLov ) {
        // Check if dbValues or dbValue are present in LOV before setting
        const isPresent = await _areDbValuesInLOV( typeName, property, selectedChange.props[property].dbValues, selectedChange.props[property].dbValue );

        if ( isPresent ) {
            data[ viewModelProp ].dbValues = selectedChange.props[property].dbValues;
            data[ viewModelProp ].dbValue = selectedChange.props[property].dbValues;
            uwPropertyService.updateViewModelProperty( data[ viewModelProp ] );

            if ( selectedChange.props[ property ].uiValues ) {
                uwPropertyService.updateDisplayValues( data[ viewModelProp ], selectedChange.props[property].uiValues );
            }
            data[viewModelProp].valueUpdated = true;
            data[viewModelProp].dirty = false;
            updatedProps.push( data[viewModelProp] );
        }
    } else if ( data[ viewModelProp ].isArray ) {
        data[ viewModelProp ].dbValues = selectedChange.props[property].dbValues;
        data[ viewModelProp ].dbValue = selectedChange.props[property].dbValues;
        uwPropertyService.updateViewModelProperty( data[ viewModelProp ] );
    } else {
        if( data[ viewModelProp ].type === 'BOOLEAN' ) {
            data[ viewModelProp ].dbValue = propertyVal === '1';
        } else {
            data[ viewModelProp ].dbValue = propertyVal;
        }
    }

    if( !_.isUndefined( selectedChange.props[ property ].uiValues ) && !data[viewModelProp].hasLov ) {
        uwPropertyService.updateDisplayValues( data[ viewModelProp ], selectedChange.props[property].uiValues );
    }

    // Set ViewModelProperty updated to true.
    if ( !data[viewModelProp].hasLov ) {
        data[viewModelProp].valueUpdated = true;
        data[viewModelProp].dirty = false;
        updatedProps.push( data[viewModelProp] );
    }
}

export let sendEventToHost = function( data ) {
    if ( appCtxSvc.getCtx( 'aw_hosting_enabled' ) ) {
        var createIssueFromVisMode = appCtxSvc.getCtx( 'CreateIssueHostedMode' );
        if ( createIssueFromVisMode ) {
            if ( _debug_logIssuesActivity ) {
                logger.info( 'hostIssues: ' + 'in sendEventToHost and CreateIssueHostedMode ctx exists.' );
            }
            eventBus.publish( 'changeObjectCreated', data );
        }

        var curHostedComponentId = appCtxSvc.getCtx( 'aw_hosting_state.currentHostedComponentId' );
        if ( curHostedComponentId === 'com.siemens.splm.client.change.CreateChangeComponent' ) {
            if ( data.createdChangeObject !== null ) {
                var uid = data.createdChangeObject.uid;
                var feedbackMessage = hostFeedbackSvc.createHostFeedbackRequestMsg();
                var objectRef = objectRefSvc.createBasicRefByModelObject( data.createdChangeObject );
                feedbackMessage.setFeedbackTarget( objectRef );
                feedbackMessage.setFeedbackString( 'ECN  Successfully created' );
                var feedbackProxy = hostFeedbackSvc.createHostFeedbackProxy();
                feedbackProxy.fireHostEvent( feedbackMessage );
            }
        }
    }
};

export let getAdaptedObjectsForSelectedObjects = function( selectedObjects ) {
    var adaptedObjects = adapterService.getAdaptedObjectsSync( selectedObjects );
    if ( adaptedObjects !== null ) {
        return adaptedObjects;
    }

    return selectedObjects;
};

/**
   * This method sets the createInput fnd0contextProvider.
   * @param { Boolean } data: viewModel for create/Add panel
   */
export function updateChangeContextProviderForCreate( data ) {
    if ( appCtxSvc.getCtx( 'pselected.changeContextProvider' ) !== undefined ) {
        let changeContextObjectUid = appCtxSvc.getCtx( 'pselected.changeContextProvider' );
        data.revision__fnd0ContextProvider.dbValue = changeContextObjectUid;
        data.revision__fnd0ContextProvider.dbValues = changeContextObjectUid;
    }
}
/**
   * Check the uid in extraAttachementWithRelations,
   * find the secondary object for the UID .Also
   * get the relation name.Pass this information , along with primary
   * derived object to relation info.
   *
   * @param {*} data
   */
export let getVisAttachmentData = function( data ) {
    var visAttachmentInfo = [];
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;

    // FORMAT of extraAttachementWithRelations: QYUIxtYAG:CMHasProblemItem
    // i.e. uid:relationName
    var visExtraAttachs = currentCtx.extraAttachementWithRelations;
    var secondaryObjUids = data.attachmentsUids;
    var derivedChangeObj = cdm.getObject( data.derivedObjectUid );
    for ( var inx = 0; inx < secondaryObjUids.length; inx++ ) {
        if ( visExtraAttachs[secondaryObjUids[inx]] === null ) {
            continue;
        }
        var secondaryObjects = data.attachments;
        // check if secondary object uid is present in extraAttachementWithRelations
        // if yes, find the relation.
        for ( var ijx = 0; ijx < secondaryObjects.length; ijx++ ) {
            if ( secondaryObjects[ijx].uid === secondaryObjUids[inx] ) {
                var visRelation = visExtraAttachs[secondaryObjUids[inx]];
                if ( visRelation !== null ) {
                    var relationInfo = {
                        relationType: visRelation,
                        primaryObject: derivedChangeObj,
                        secondaryObject: secondaryObjects[ijx]
                    };
                    visAttachmentInfo.push( relationInfo );
                    break;
                }
            }
        }
    }
    return visAttachmentInfo;
};
/**
   * Populate Implements Section of Derive Panel
   * @param {*} selectedChangeObjects
   * @param {*} declViewModel
   */
export let populateImplementsSection = function( selectedChangeObjects, declViewModel ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    if ( currentCtx.clientId !== '' ) {
        declViewModel.dataProviders.getImplements.update( selectedChangeObjects,
            selectedChangeObjects.length );
    } else if ( declViewModel.attachments !== undefined && declViewModel.attachments !== null ) {
        declViewModel.dataProviders.getImplements.update( declViewModel.attachments,
            declViewModel.attachments.length );
    }
};
/**
   * Get Initial Change Types for Derive Panel
   * @param {*} initialTypes
   * @param {*} selectedChangeObjects
   */
export let getInitialChangeTypesForDerivePanel = function( initialTypes, selectedChangeObjects ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    // Default to specific Change Type for Derived Panel based on
    // input sent (exactTypeToCreate) from visualization
    if ( currentCtx.exactTypeToCreate !== '' && currentCtx.clientId !== '' ) {
        var allInitialTypes = selectedChangeObjects[0].props.cm0DerivableTypes.dbValues;
        for ( var inx = 0; inx < allInitialTypes.length; inx++ ) {
            var changeType = allInitialTypes[inx].substring( 0, allInitialTypes[inx].indexOf( '/' ) );
            if ( changeType === currentCtx.exactTypeToCreate ) {
                initialTypes.push( allInitialTypes[inx] );
                break;
            }
        }
    } else {
        initialTypes = selectedChangeObjects[0].props.cm0DerivableTypes.dbValues;
        for ( var k = 1; k < selectedChangeObjects.length; k++ ) {
            var derivableTypes = selectedChangeObjects[k].props.cm0DerivableTypes.dbValues;
            var commonTypes = _.intersection( initialTypes, derivableTypes );
            initialTypes = commonTypes;
        }
    }

    return initialTypes;
};

/**
   * populating dataToBeRelated for createRelateAndSubmitObjects SOA call input
   * @param {*} parentData
   * @param {*} data
   */
export let populateDataToBePopulated = function( parentData, data ) {
    var currentCtx = appCtxSvc.ctx.CreateChangePanel;
    // for Visualization use-cases where secondary objects are related with specific relations
    // dataToBeRelated will have relation name & secondaryobject uid
    // e.g. dataToBeRelated= {
    //  rel1:UID1
    //  rel2:UID2 }

    if ( currentCtx !== undefined && currentCtx.extraAttachementWithRelations !== undefined
         && Object.keys( currentCtx.extraAttachementWithRelations ).length !== 0 ) {
        var extraAttachments = currentCtx.extraAttachementWithRelations;
        var parentUids = parentData.attachmentsUids;
        data.dataToBeRelated = {};
        for ( var inx = 0; inx < parentUids.length; inx++ ) {
            var relation = extraAttachments[parentUids[inx]];
            var uids = [];
            if ( data.dataToBeRelated[relation] ) {
                uids = data.dataToBeRelated[relation];
            }

            uids.push( parentUids[inx] );
            data.dataToBeRelated[relation] = uids;
        }
    } else if ( parentData.attachmentsUids ) {
        data.dataToBeRelated = {
            '': parentData.attachmentsUids
        };
    }

    if ( parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects
        && parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects.length > 0 ) {
        const projects = parentData.dataProviders.getAssignedProjectsProvider.viewModelCollection.loadedVMObjects;
        data.dataToBeRelated.projects = projects.map( projObject => projObject.uid );
    }
};

/**
   * Get the supported SOA to get the change summary data based on tc server release.
   *
   * @returns { Object} Object with supported service name and operation name
   */
export let getSupportedChangeSummarySOA = function() {
    return {
        serviceName: 'Internal-CmAws-2021-06-Changes',
        operationName: 'getChangeSummaryData2'
    };
};

/**
   * Get the input key value from additional data and return the correct value accordingly.
   * If AW server is based on tc13x, then to render change summary table we will be calling
   * getChangeSummaryData2 and this SOA returns all values in additionalData object and
   * right now it supports these keys isOddRow,hasChildren,isCompareRow, isAbsOccInContextParent.
   * Key isAbsOccInContextParent is used to render the changes for incontext only. This key will
   * be returned from server when platform version is tc13.2 or more. In olde release this key
   * value will not be returned.
   * If AW server is based on tc12x, then to render change summary table we will be calling
   * getChangeSummaryData and this SOA returns all values in dataObject object and
   * right now it supports these keys isOddRow,hasChildren,isCompareRow.
   *
   *
   * @param {Object} dataObject Data obejct that store all info returned from server
   * @param {String} keyName Key name that need to be fetched from additional data object
   * @param {boolean} isBooleanPropValue True/False based on that proeprty return value will be either
   *                  boolean or string.
   *
   * @param {Object} Object Property return value got from additional data
   */
export let getAdditionalDataValue = function( dataObject, keyName, isBooleanPropValue ) {
    if ( dataObject && dataObject.additionalData && dataObject.additionalData[keyName] ) {
        var keyValues = dataObject.additionalData[keyName];
        if ( keyValues && keyValues[0] ) {
            var propValue = keyValues[0];
            var returnPropValue = keyValues[0];
            if ( isBooleanPropValue && propValue ) {
                returnPropValue = propValue.toLowerCase() === 'true';
            }
            return returnPropValue;
        }
    } else if ( dataObject && dataObject.hasOwnProperty( keyName ) ) {
        return dataObject[keyName];
    }
    if ( isBooleanPropValue ) {
        return false;
    }
    return null;
};

/**
 * Get BOMLine out of element
 * @return {parent} element object
 */
export let getBomLine = function( parentUid ) {
    var uid = parentUid.match( 'BOMLine(.*),' );
    if( !uid ) {
        uid = parentUid.match( 'Cm0RemovedLine(.*),' );
    }
    uid = 'SR::N::' + uid[ 0 ].replace( ',,', '' );
    return new IModelObject( uid, 'BOMLine' );
};

var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

export let populateChangeContext = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    var openedItemRevisionUid = appCtxSvc.ctx.aceActiveContext.context.openedElement.props.awb0UnderlyingObject.dbValues[0];
    var openedItemRevision = cdm.getObject( openedItemRevisionUid );
    var ecnForOpenedElementUid = openedItemRevision.props.cm0AuthoringChangeRevision.dbValues[0];

    if ( appCtxSvc.ctx.aceActiveContext.context.supportedFeatures.Awb0RevisibleOccurrenceFeature && appCtxSvc.ctx.aceActiveContext.context.supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
        ecnForOpenedElementUid = '';
        ecnForOpenedElementUid = appCtxSvc.ctx.userSession.props.cm0GlobalChangeContext.dbValue;
    }

    if ( ecnForOpenedElementUid !== null && ecnForOpenedElementUid !== '' ) {
        dmSvc.getProperties( [ ecnForOpenedElementUid ], [ 'object_string' ] ).then( function() {
            var ecnVMO = cdm.getObject( ecnForOpenedElementUid );
            if ( ecnVMO !== null && ecnVMO !== undefined ) {
                data.changeContextValue = {
                    type: 'OBJECT',
                    isNull: false,
                    uiValue: ecnVMO.props.object_string.dbValues[0],
                    dbValue: ecnForOpenedElementUid
                };
                appCtxSvc.ctx.ecnForOpenedElement = ecnVMO;
            }
            deferred.resolve();
        } );
    }

    return deferred.promise;
};
/**
   * Get logical value from string value
   * @param {*} stringValue
   */
export let isPropertyValueTrue = function( stringValue ) {
    return stringValue && stringValue !== '0' &&
         ( String( stringValue ).toLowerCase === 'true' || stringValue === '1' );
};
/**
  * Output function for getTypeConstantValues SOA.
  * OutputData is as a structure of properties
  * corresponding each property to updated business constant values
  * @param {*} response
  * @param {*} data
  */
export let outputForBOTypeConstant = function( response, data ) {
    let newBoTypeConst = _.clone( data.boTypeConst );
    if ( response && response.constantValues && response.constantValues.length > 0 ) {
        for ( var i = 0; i < response.constantValues.length; i++ ) {
            var responseConstantName = response.constantValues[i].key.constantName;
            var responseConstantValue = response.constantValues[i].value;

            if ( responseConstantValue === 'false' ) {
                if ( responseConstantName === 'Awp0EnableSubmitForCreate' ) {
                    newBoTypeConst.showSubmitButton.dbValue = false;
                } else if ( responseConstantName === 'Awp0EnableCreateForCreatePanel' ) {
                    newBoTypeConst.showCreateButton.dbValue = false;
                } else if ( responseConstantName === 'Fnd0EnableAssignProjects' ) {
                    newBoTypeConst.isEnableAssignProjects.dbValue = false;
                } else if ( responseConstantName === 'Cm0CanBeSetAsActiveChange' ) {
                    newBoTypeConst.showActiveChangeCheckBox.dbValue = false;
                }
            }
            // For simple change this button should not be visible.
            if ( data.isSimpleChangeObjectCreation && responseConstantName === 'Awp0EnableCreateForCreatePanel' ) {
                newBoTypeConst.showCreateButton.dbValue = false;
            }
        }
    }
    return newBoTypeConst;
};

/**
  * Returns true if dispName contains filterString
  * @param {String} filterString
  * @param {String} dispName
  * @returns
  */
export let filterSearch = function( filterString, dispName ) {
    let hasWildcardChar = /[%*]/g;
    if( hasWildcardChar.test( filterString ) ) {
        var wildcrdRegex = new RegExp( filterString.replace( /[%*]/ig, '.*' ), 'ig' );
        if( wildcrdRegex.test( dispName ) ) {
            return true;
        }
    } else if( dispName.toLowerCase().indexOf( filterString.toLowerCase() ) > -1 ) {
        return true;
    }
    return false;
};

/**
  * open create change panel with change type
  * @param {String} changeType
  * @param {Object} commandContext
  */

export let openCreateChangeOnTypePanel = function( changeType, commandContext ) {
    let ctx = appCtxSvc.ctx;
    const createChangeData = {
        typeNameToCreate : changeType //changeType
    };
    appCtxSvc.registerCtx( 'appCreateChangePanel', createChangeData );
    Cm1ChangeCommandService.openCreateChangePanel( 'Cm1ShowCreateChange', 'aw_toolsAndInfo', ctx.state.params, commandContext );
};


/**
 * This function is used to create input for createRelations or deleteRelations soa
 * @param {Object} primaryObj : primary object
 * @param {String} relationType : relation type
 * @param {Object} secondaryObj  : secondary object
 */
export let createInputDataForDeleteOrCreateRelations = function( primaryObj, relationType, secondaryObj ) {
    return {
        clientId: 'AWClient',
        primaryObject: primaryObj,
        relationType: relationType,
        secondaryObject: secondaryObj,
        userData: { uid: '', type: '' }
    };
};

/**
 * This function processes the loaded UI Columns from Cm1AffectedItemsUiConfigCots to display the relations correctly in Affected Items Single Table
 * @param {Object} colResp
 * @returns modified columns to display
 */
export let processUIColumns = function( colResp ) {
    let columnArrayIn = colResp.columnConfigurations[0].columnConfigurations[0].columns;
    if( columnArrayIn && columnArrayIn.length > 0 ) {
        return columnArrayIn.map( ( columnIn ) => {
            if( columnIn.propertyName === 'GRMS2PREL(CMRelation,GnChangeNoticeRevision).type_string' ) {
                columnIn.associatedTypeName = '';
                columnIn.dataType = '';
                columnIn.propertyName = 'relation';
            } else if( columnIn.propertyName ===
                'GRMS2PREL(CMSolutionToImpacted,WorkspaceObject).cm0LineageGroupId' ) {
                columnIn.associatedTypeName = '';
                columnIn.dataType = '';
                columnIn.propertyName = 'CMSolutionToImpacted.cm0LineageGroupId';
            }
            return columnIn;
        } );
    }
};

/**
 *
 * @param {ObjectArr} affectedCols - Columns to be displayed in Affected items table.
 * @param {Object} affectedItemsDataProvider - newColumns containing sorting info.
 * @returns newColumns if present or affectedCols.
 */
export let getAffectedItemsCols = function( affectedCols, affectedItemsDataProvider ) {
    if( affectedItemsDataProvider.newColumns ) {
        return affectedItemsDataProvider.newColumns;
    }
    return affectedCols;
};

/**
 * This function generates random column config uri to mimick the behaviour of Object Set table
 * @returns
 */
export let generateColumnConfigURI = function( data ) {
    const uri = `objSetSrc_AffectedItemsSingleTable${Math.random()}`;
    data.clientScopeURI = uri;
    return uri;
};

/**
 * This function processes the relations using preference values to convert it into mapdata
 * @param {Object} relation
 * @param {Object} preferenceName
 * @returns modelTypeRelationListMap
 */
export let getModelTypeRelationListMap = function( relation, preferenceName ) {
    let objectSetSourceArray = [];
    let modelTypeRelationListMap = {};

    //Iterate the relation through preference array
    objectSetSourceArray = preferenceName.filter( name => name.includes( relation ) );

    //Convert the relation array to relation map
    if( objectSetSourceArray && objectSetSourceArray.length > 0 ) {
        _.forEach( objectSetSourceArray, function( typeRelCombo ) {
            let typeRelSplit = typeRelCombo.split( '.' );
            if( typeRelSplit.length === 2 ) {
                let relationType = typeRelSplit[ 0 ].trim();
                let objectType = typeRelSplit[ 1 ].trim();
                if( !_.isArray( modelTypeRelationListMap[ objectType ] ) ) {
                    modelTypeRelationListMap[ objectType ] = [];
                }
                modelTypeRelationListMap[ objectType ].push( relationType );
            }
        } );
    }
    return modelTypeRelationListMap;
};

/**
 * This function returns the value of objectSource in comma separated format, reading from
 * preference CM_affected_items_table_source
 * @returns
 */
export let getObjectSetSource = function() {
    let objectSetSources = appCtxSvc.getCtx( 'preferences.CM_affected_items_table_source' );
    let objectSetString = '';
    objectSetSources && objectSetSources.forEach( ( source ) => objectSetString += source.concat( ',' ) );
    return  objectSetString;
};

/**
 * This function returns array of loaded vmos which are made to editable for impacted items.
 * @param {Object} dataProvider - used to get the loaded vmo which need to edited.
 * @returns {Object} returns array of loadedVmo with edit enabled.
 */
export let affecteditemCellStartEdit = function( dataProvider ) {
    let loadedVMOObjects = dataProvider?.viewModelCollection?.loadedVMObjects || [];
    return loadedVMOObjects.map( function( vmo ) {
        _.forEach( vmo.props, function( prop ) {
            if( vmo?.props?.relation?.dbValues[0] === 'CMHasImpactedItem' &&
                ( prop.propertyName === 'GRMS2PREL(CMHasImpactedItem,GnChangeNoticeRevision).cm0Disposition'
                || prop.propertyName === 'GRMS2PREL(CMHasImpactedItem,GnChangeNoticeRevision).cm0IncorporationStatus'
                || prop.propertyName === 'GRMS2PREL(CMHasImpactedItem,GnChangeNoticeRevision).cm0RequestedChange' ) ) {
                uwPropertyService.setIsEditable( prop, true );
                uwPropertyService.setIsPropertyModifiable( prop, true );
                uwPropertyService.setHasLov( prop, true );
                uwPropertyService.setIsEnabled( prop, true );
            }
        } );
        return vmo;
    } );
};

/**
 * This function used to save the modified property in affected items table.
 * @param {Object} dataProvider - used to get the loaded vmo which need to saved to database.
 */
export let affecteditemCellSaveEdit = function( dataProvider ) {
    const modifiedProperty = dataProvider?.viewModelCollection.getAllModifiedProperties()[0];
    let inputs = [];
    if( modifiedProperty ) {
        let input = null;
        input = dmSvc.getSaveViewModelEditAndSubmitToWorkflowInput( modifiedProperty.viewModelObject );
        dmSvc.pushViewModelProperty( input, modifiedProperty.property );
        inputs.push( input );
    }

    if ( inputs.length > 0 ) {
        dmSvc.saveViewModelEditAndSubmitWorkflow( inputs ).then( function( response ) {
            return response;
        },
        function( error ) {
            var errMessage = messagingService.getSOAErrorMessage( error );
            messagingService.showError( errMessage );
            throw error;
        } );
    }
};

/**
 * This function prepares the context object to be used by Export Panel.
 * @param {Object} dataCtxNode - Viewmodel data is used to get the dataproviders and columnProviders.
 * @param {Object} panelContext - Object which need to be updated and later is used for Export command.
 */
export let updateExportPanelContext = function( dataCtxNode, panelContext ) {
    let parentObject = appCtxSvc.getCtx( 'xrtSummaryContextObject' );
    let newPanelContext = {
        providerName: 'Awp0ObjectSetRowProvider',
        dataProvider: dataCtxNode?.dataProviders?.affectedItemsDataProvider,
        columnFilters: dataCtxNode?.columnProviders?.affectedItemsColumnProvider?.columnFilters,
        searchSortCriteria: dataCtxNode?.columnProviders?.affectedItemsColumnProvider?.sortCriteria,
        searchCriteria: {
            objectSet: getObjectSetSource(),
            parentUid: parentObject?.uid
        }
    };
    panelContext && panelContext.update( newPanelContext );
};

/**
 * Function prepares column config for Singleton Affected items table.
 * @param {Object} response - response from performSearchViewModel.
 * @returns {Object} columnConfig for Affected items table.
 */
export let processColumnConfigResponse = function( response ) {
    //Prepare localized value for Change Relation.
    let localTextBundle = localeSvc.getLoadedText( 'ChangeMessages' );
    let changeRelationTitle = localTextBundle.Cm1ChangeRelationHeaderTitle;

    //Modify the relation display name.
    let columnConfig = response?.columnConfig;
    changeRelationTitle && columnConfig?.columns?.map( function( columnIn ) {
        if( columnIn.propertyName === 'relation' ) {
            columnIn.displayName = changeRelationTitle;
        }
        return columnIn;
    } );
    return  columnConfig;
};

/**
 * This function updates the parent selection data with local selection data from splm table.
 * @param {Object} localSelectionData - local selection data passed into splm table.
 * @param {Object} parentSelectionData - parent selection data from subPanelContext
 * @param {Object} focusComponent - focusComponent which is currently focusing on.
 */
export const handleSelectionChange = ( localSelectionData, parentSelectionData, focusComponent ) => {
    let isActiveComponent = !_.isEmpty( localSelectionData ) && ( localSelectionData.selected.length > 0 || localSelectionData.selected.length === 0 && localSelectionData._modelId === focusComponent );
    if( isActiveComponent ) {
        let baseSelection;
        let relationContext;
        relationContext = xrtUtilities.getRelationInfo( localSelectionData, baseSelection );
        var adaptedObjsPromise = adapterService.getAdaptedObjects( localSelectionData.selected );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            var selectedObjects = [];
            _.forEach( adaptedObjs, function( adaptedObject, index ) {
                if( localSelectionData.selected[index].alternateID ) {
                    adaptedObject.alternateID = localSelectionData.selected[index].alternateID;
                }
                if( adaptedObject ) {
                    if( viewModelObjectService.isViewModelObject( adaptedObject ) ) {
                        selectedObjects.push( adaptedObject );
                    } else if( isViewModelTreeNode( adaptedObject ) ) {
                        selectedObjects.push( adaptedObject );
                    } else {
                        selectedObjects.push( viewModelObjectService
                            .constructViewModelObjectFromModelObject( adaptedObject, 'EDIT' ) );
                    }
                }
            } );

            parentSelectionData && parentSelectionData.update( {
                selected: selectedObjects,
                relationInfo: relationContext,
                _modelId: localSelectionData._modelId,
                id: localSelectionData.id
            } );
        } );
    }
};

/**
 * This method checks the focus component and updates the selection in selection model.
 * @param {Object} localSelectionData - local selection data from splm table.
 * @param {Objectq} focusComponent - focus component which is currently focusing on.
 * @param {Object} selectionModel - selection model passed into the table.
 */
export const handleFocusChange = ( localSelectionData, focusComponent, selectionModel ) => {
    if( focusComponent && localSelectionData._modelId && focusComponent !== 'clear'
        && localSelectionData._modelId !== focusComponent && selectionModel
        && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
    }

    if( focusComponent === 'clear' && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
    }
};

export default exports = {
    createInputDataForDeleteOrCreateRelations,
    getReviseInputsJs,
    getCreateInputObject,
    addChildInputToParentMap,
    processPropertyForCreateInput,
    getCreateInputFromDerivePanel,
    updateCtxWithShowChangeValue,
    generateChangeContextList,
    populateCreatePanelPropertiesOnDerive,
    sendEventToHost,
    getAdaptedObjectsForSelectedObjects,
    updateChangeContextProviderForCreate,
    getVisAttachmentData,
    populateImplementsSection,
    getInitialChangeTypesForDerivePanel,
    populateDataToBePopulated,
    getSupportedChangeSummarySOA,
    populateChangeContext,
    getAdditionalDataValue,
    isPropertyValueTrue,
    processPropertyForCustomPanelInput,
    addChildInputToParentMapForCustomPanel,
    outputForBOTypeConstant,
    filterSearch,
    updateActiveChangeSelection,
    openCreateChangeOnTypePanel,
    getBomLine,
    getDerivedFromProperties,
    getDerivePropertiesNames,
    processUIColumns,
    generateColumnConfigURI,
    getModelTypeRelationListMap,
    getObjectSetSource,
    getAffectedItemsCols,
    affecteditemCellStartEdit,
    affecteditemCellSaveEdit,
    updateExportPanelContext,
    processColumnConfigResponse,
    handleSelectionChange,
    handleFocusChange
};
