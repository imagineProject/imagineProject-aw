// @<COPYRIGHT>@
// ===========================================================================
// Copyright 2023.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ===========================================================================
// @<COPYRIGHT>@

/* global
 */

/**
 * A service that has util functions for Project Folder code.
 *
 * @module js/projectFolderUtils
 */


import AwPromiseService from 'js/awPromiseService';
import searchFolderCommonService from 'js/searchFolderCommonService';
import clientDataModel from 'soa/kernel/clientDataModel';
import { DerivedStateResult } from 'js/derivedContextService';
import searchFilterService from 'js/aw.searchFilter.service';
import soaService from 'soa/kernel/soaService';
import searchFolderService from 'js/searchFolderService';
import searchStateHelperService from 'js/searchStateHelperService';
import fileStreamingUtils from 'js/fileStreamingUtils';
import awDragAndDropUtils from 'js/awDragAndDropUtils';
import searchConstants from 'js/searchConstants';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import assignRemoveToProjectFolderService from 'js/assignRemoveToProjectFolderService';

export let getObject = ( soaResponse, typeName ) => {
    let modelObjects = soaResponse.modelObjects;
    let object;
    for( const [ key, value ] of Object.entries( modelObjects ) ) {
        if( value.type === typeName ) {
            object = value;
        }
    }
    return object;
};

export let setSearchFolderObjectinState = ( soaResponse, searchFolder ) => {
    let newSearchFolder = { ...searchFolder.getValue() };
    let modelObjects = soaResponse.modelObjects;
    let searchFolderObject;
    for( const [ key, value ] of Object.entries( modelObjects ) ) {
        if( value.type === 'Awp0SearchFolder' ) {
            searchFolderObject = value;
        }
    }
    newSearchFolder.searchFolderObject = searchFolderObject;
    newSearchFolder.awp0SearchType = searchFolderObject && searchFolderObject.props && searchFolderObject.props.awp0SearchType
        ? searchFolderObject.props.awp0SearchType.dbValues[ 0 ] : '0';
    newSearchFolder.clientScopeURI = 'Awp0MyProjectFolders';
    newSearchFolder.columnConfigId = 'projectFoldersColConfig';
    if( newSearchFolder.awp0SearchType && ( newSearchFolder.awp0SearchType === '1' || newSearchFolder.awp0SearchType === '3' ) ) {
        newSearchFolder.clientScopeURI = 'Awp0SearchResults';
        newSearchFolder.columnConfigId = 'searchResultsColConfig';
        newSearchFolder.provider = 'Awp0FullTextSearchProvider';
    } else if ( newSearchFolder.awp0SearchType && ( newSearchFolder.awp0SearchType === '2' || newSearchFolder.awp0SearchType === '4' ) ) {
        newSearchFolder.clientScopeURI = 'Awp0AdvancedSearch';
        newSearchFolder.columnConfigId = 'advancedSearchResultsColConfig';
        newSearchFolder.provider = 'Awp0SavedQuerySearchProvider';
    }
    searchFolder.update( newSearchFolder );
    return true;
};

export let getSearchCriteriaAndFilters = ( searchFolderObject, searchFolderCriteriaVMP, searchFolderFiltersVMP ) => {
    let awp0SearchType = searchFolderObject.props.awp0SearchType.dbValues[ 0 ];
    let awp0Rule = searchFolderObject.props.awp0Rule;
    let uiValues = awp0Rule.uiValues;
    let searchFolderCriteria = _.cloneDeep( searchFolderCriteriaVMP );
    let searchFolderFilters = _.cloneDeep( searchFolderFiltersVMP );
    if(  awp0SearchType === '1' || awp0SearchType === '3' ) {
        let criteria = uiValues[ 0 ];
        searchFolderCriteria.uiValue = criteria.substring( criteria.indexOf( ':' ) + 1, criteria.length );
    } else if( awp0SearchType === '2' || awp0SearchType === '4' ) {
        searchFolderCriteria.uiValue = uiValues[ 0 ];
    }
    if ( awp0SearchType === '2' || awp0SearchType === '4' ) {
        let uiValue1 = searchFolderCommonService.processAttributes( uiValues );
        searchFolderFilters.uiValue = uiValue1 ? _.join( uiValue1, '\n' ) : '';
    } else{
        let uiValue2 = _.slice( uiValues, 1, uiValues.length );
        searchFolderFilters.uiValue = uiValue2 ? _.join( uiValue2, '\n' ) : '';
    }
    return {
        searchFolderCriteria: searchFolderCriteria,
        searchFolderFilters: searchFolderFilters
    };
};

export let checkIfParentIsProjectTemplate = ( awp0SearchDefinition, searchFolder, ruleTypeValues, projectDataTemplateRuleTypeValues ) => {
    let reportDefintionObject = clientDataModel.getObject( awp0SearchDefinition );
    let updatedTypeValues = _.cloneDeep( ruleTypeValues );
    let params = reportDefintionObject?.props?.rd_parameters?.dbValues;
    let newSearchFolder = searchFolder.getValue();
    if( params && params.includes( 'isProjectDataTemplateType' ) ) {
        newSearchFolder.isParentProjectTemplate = true;
        newSearchFolder.isProjectDataTemplateType = 'true';
        updatedTypeValues = _.cloneDeep( projectDataTemplateRuleTypeValues );
        let indexOfSavedQueryUIDParam = params.indexOf( 'projectDataTemplateSavedQuery' );
        newSearchFolder.savedQuery = {
            value: reportDefintionObject.props.rd_param_values.dbValues[ indexOfSavedQueryUIDParam ],
            name: 'Project Template Query'
        };
        // since the default view is Advanced Search, awp0SearchType needs to be set to saved query provider
        newSearchFolder.awp0SearchType = 'Awp0SavedQuerySearchProvider';
        newSearchFolder.projectDataTemplateSavedQuery = reportDefintionObject.props.rd_param_values.dbValues[ indexOfSavedQueryUIDParam ];
        searchFolder.update( newSearchFolder );
    }
    return {
        isParentProjectTemplate: params && params.includes( 'isProjectDataTemplateType' ),
        ruleTypeValues: updatedTypeValues
    };
};

export let updateSearchStateWithSelectedProject = ( searchState, selectedProjects ) => {
    let newSearchState = { ...searchState.getValue() };
    if( selectedProjects?.length === 0 ) {
        delete newSearchState.activeFilters[ 'WorkspaceObject.project_list' ];
    } else if( selectedProjects?.length === 1 ) {
        let projectFilterStringVal = selectedProjects[0].object.props.project_name.dbValue + ' ( ' + selectedProjects[0].object.props.project_id.dbValue + ' )';
        if( !newSearchState.activeFilters ) {
            newSearchState.activeFilters = {};
        }
        newSearchState.activeFilters[ 'WorkspaceObject.project_list' ] = [ projectFilterStringVal ];
        const selectedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( newSearchState.activeFilters );
        newSearchState.filterString = searchFilterService.buildFilterString( newSearchState.activeFilters );
        newSearchState.activeFilterMap = selectedFiltersInfo.activeFilterMap;
    }

    newSearchState.removeProjectsCategoryFromSearchCategories = true;
    searchState.update( newSearchState );
};

export let getInputForSettingProjectDataTemplate = ( response, isActiveTemplate ) => {
    let boolValue = isActiveTemplate.dbValue.toString();
    return [
        {
            object: response.output[ 0 ].objects[ 0 ],
            vecNameVal: [ {
                name: 'awp0isActiveTemplate',
                values: [ boolValue ]
            } ]
        }
    ];
};

export let initActiveFolderFulltextStateInProjectCase = ( searchFolder ) => {
    let newSearchFolder = { ...searchFolder.getValue() };
    if( newSearchFolder.autoApplyFilters === undefined ) {
        newSearchFolder.autoApplyFilters = true;
    }
    if( !newSearchFolder.criteria ) {
        newSearchFolder.criteria = {};
    }
    newSearchFolder.criteria.searchString = '*';
    newSearchFolder.provider = 'Awp0FullTextSearchProvider';
    searchFolderService.setBaseCriteriaParameters( newSearchFolder.criteria );
    let updatedSearchContext = searchStateHelperService.constructBaseSearchCriteria( newSearchFolder );
    newSearchFolder = { ...updatedSearchContext, ...newSearchFolder };
    newSearchFolder.criteriaJSONString = JSON.stringify( newSearchFolder.criteria );
    newSearchFolder.removeProjectsCategoryFromSearchCategories = true;
    newSearchFolder.awp0SearchType = 'Awp0FullTextSearchProvider';
    searchFolder.update( newSearchFolder );
};

// xrtState should not be sent to command toolbar, it should be removed from subPanelContext.
export let getProjectFolderContextForToolbar = ( vmDef, props ) => {
    return [ new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [ props.subPanelContext, props.subPanelContext?.searchFolder?.exportPanelContext ],
        compute: () => {
            let subPanelContextCopy = {
                ...props.subPanelContext
            };
            if( subPanelContextCopy?.xrtState ) {
                delete subPanelContextCopy.xrtState;
            }
            return { ...subPanelContextCopy, ...props.subPanelContext?.searchFolder?.exportPanelContext };
        }
    } ) ];
};

/**
* dragDropToProjectFolderWithUid
* @function dragDropToProjectFolderWithUid
* @param {ARRAY}source - External Source
* @param {ViewModelTreeNode}target - Project Folder Target
* @param {Object}pasteContext - context contains source,target,dragDropIntent and relationType.
* @return promise
*/
export let dragDropToProjectFolderWithUid = function( source, target, pasteContext ) {
    let deferred = AwPromiseService.instance.defer();
    // prepare input data to assign project
    let projectUID = '';
    if( target.uid.includes( '..' ) ) { //Could be of type ProjectFolder or ProjectSubFolder
        projectUID = target.uid.split( '..' )[1].split( '+' )[ 0 ];
    } else if( target.alternateID.includes( '..' ) ) { // Could be any workspace object assigned under projectFolder hierarchy
        var projectFolderUid = target.alternateID;
        var targetFolderHier = projectFolderUid.split( ',' );
        _.forEach( targetFolderHier, function( value ) {
            if( value.includes( 'Awp0ProjectFolder' ) ) {
                projectFolderUid = value;
            }
        } );
        //get the ProjectFolder uid from the target folder hierarchy or alternate ID
        projectUID = projectFolderUid.split( '..' )[1].split( '+' )[ 0 ];
    } else{
        deferred.reject( 'Selected target type is not from Project Data Folder Hierarchy' );
    }
    const inputData = {
        assignOrRemoveInput: []
    };
    for( const obj of source ) {
        let assignOrRemoveInputObj = {
            contextInfo: {
                selectedTopLevelObject: obj
            },
            projectsToAssign: [
                {
                    uid: projectUID,
                    type: 'TC_Project'
                }
            ],
            projectsForRemoval: [],
            processAsynchronously: false,
            objectsForAssignment: [ obj ],
            objectsToRemoveFromProjects: []
        };
        inputData.assignOrRemoveInput.push( assignOrRemoveInputObj );
    }
    return assignRemoveToProjectFolderService.assignProjectToFolderFn( source, target, inputData, pasteContext );
};

/**
* getDataTransferSourceTypes
* @function getDataTransferSourceTypes
* @param {String}targetUID - The UID of the IModelObject that will be the dropped onto (i.e. the data
*            'target').
* @param {StringArray} fileTypes - The array with the set of unique file types.
* @return promise
*/
function getDataTransferSourceTypes( targetUID, fileTypes ) {
    let deferred = AwPromiseService.instance.defer();
    let targetObject = clientDataModel.getObject( targetUID );
    let request = {
        parent: targetObject,
        fileExtensions: fileTypes
    };

    soaService.postUnchecked( 'Internal-AWS2-2015-10-DataManagement', 'getDatasetTypesWithDefaultRelation',
        request ).then(
        function( response ) {
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                deferred.reject( response.ServiceData.partialErrors );
            }
            deferred.resolve( response.output );
        },
        function( err ) {
            deferred.reject( err );
        } );
    return deferred.promise;
}

/**
 *
 * @param {object} response - response of getDataTransferSourceTypes
 * @param {string}  fileName - file name
 * @return {response} response
 */
export let createDataset = function( response, fileName ) {
    var input = [];
    for ( var i = 0; i < fileName.length; i++ ) {
        let fileNameOnly = fileName[i].split( '.' );
        let fileExt = fileNameOnly[fileNameOnly.length - 1];
        let fileN = fileNameOnly[0];

        //get dataset type based on ext
        var typeObj = response?.find( ( type ) => type.fileExtension === fileExt );
        let dsInfos = typeObj?.datasetTypesWithDefaultRelInfo;
        let dsInfo = dsInfos && dsInfos.length > 0 ? dsInfos[0] : null;
        let rerInfo = dsInfo?.refInfos;
        let dsUid = dsInfo?.datasetType?.uid;
        let dsType = clientDataModel.getObject( dsUid );
        let type = _.get( dsType, 'props.object_string.dbValues' );

        var inputData = {
            clientId: fileN,
            container: {
                uid: clientDataModel.NULL_UID,
                type: 'unknownType'
            },
            datasetFileInfos: [ {
                fileName: fileName[i],
                namedReferenceName: rerInfo && rerInfo.length > 0 && rerInfo[0].referenceName ? rerInfo[0].referenceName : null,
                isText: rerInfo && rerInfo.length > 0 && rerInfo[0].fileFormat === 'TEXT'
            } ],
            relationType: '',
            description: '',
            name: fileName[i],
            type: type[0]
        };
        input.push( inputData );
    }

    return soaService.postUnchecked( 'Core-2010-04-DataManagement', 'createDatasets', { input } ).then(
        function( response ) {
            return response.datasetOutput;
        }
    );
};

/**
 * getChunkedUploadBody - returns the body for getDatasetTicketsForChunkedUpload given the viewModel data obj
 *
 * @param {Object} commitInfos - commitInfos for Chunked Upload
 * @returns {Object} -
 */
const getChunkedUploadBody = function( commitInfos ) {
    return {
        inputs: [ {
            dataset: commitInfos.dataset,
            createNewVersion: false,
            datasetFileInfos: [ {
                clientId: commitInfos.datasetFileTicketInfos[0].datasetFileInfo.clientId,
                fileName: commitInfos.datasetFileTicketInfos[0].datasetFileInfo.fileName,
                namedReferencedName: commitInfos.datasetFileTicketInfos[0].datasetFileInfo.namedReferencedName,
                isText: commitInfos.datasetFileTicketInfos[0].datasetFileInfo.isText,
                allowReplace: commitInfos.datasetFileTicketInfos[0].datasetFileInfo.allowReplace
            } ]
        } ]
    };
};

/**
* commitDataSetFiles
* @function commitDataSetFiles
* @param {object} datatsetResponse - The UID of the IModelObject that will be the dropped onto (i.e. the data
*            'target').
* @param {StringArray} fileTypes - The array with the set of unique file types.
* @return promise
*/
const commitDataSetFiles = async function( datatsetResponse, sourceFiles, target, pasteContext ) {
    return _getDatasetWriteTickets( datatsetResponse ).then( async( response ) => {
        var commitInfoA = response.commitInfo;
        var commInfo = [];
        /* eslint-disable no-await-in-loop */
        for ( var i = 0; i < sourceFiles.length; i++ ) {
            const formData = new FormData();
            formData.append( 'fmsFile', sourceFiles[i], sourceFiles[i].name );
            if ( sourceFiles[i].size > searchConstants.CHUNK_UPLOAD_THRESHOLD ) {
                //get ticket for chuncked upload
                var commInfoCh = commitInfoA.find( ( comInfo ) => comInfo.datasetFileTicketInfos[0].datasetFileInfo.fileName === sourceFiles[i].name );
                const chunkedUploadTicketResponse = await soaService.postUnchecked( 'Internal-Core-2021-06-FileManagement', 'getDatasetTicketsForChunkedUpload', getChunkedUploadBody( commInfoCh ) );
                var fmsTicket = chunkedUploadTicketResponse.commitInfo[0].datasetFileTicketInfos[0].ticket;
                formData.set( 'fmsTicket', fmsTicket );
                commInfo.push( chunkedUploadTicketResponse.commitInfo[0] );
            } else {
                var fmsticket = commitInfoA.find( ( ticket ) => ticket.datasetFileTicketInfos[0].datasetFileInfo.fileName === sourceFiles[i].name );
                formData.append( 'fmsTicket', fmsticket.datasetFileTicketInfos[0].ticket );
                commInfo.push( fmsticket );
            }
            await fileStreamingUtils.uploadFile( formData );
        }
        /* eslint-enable no-await-in-loop */
        const commitInput = [];
        for ( var i = 0; i < commInfo.length; i++ ) {
            const { ticket, datasetFileInfo: { allowReplace, clientId, fileName, isText, namedReferencedName } } = commInfo[i].datasetFileTicketInfos[0];
            const input = {

                createNewVersion: false,
                dataset: commInfo[i].dataset,
                datasetFileTicketInfos: [ {
                    ticket,
                    datasetFileInfo: {
                        allowReplace: false,
                        clientId,
                        fileName,
                        isText,
                        namedReferencedName
                    }
                } ]
            };
            commitInput.push( input );
        }

        return soaService.postUnchecked( 'Core-2006-03-FileManagement', 'commitDatasetFiles', { commitInput } ).then( ( res ) => {
            let sources = [];
            _.forEach( res.updated, ( uid )=>{
                sources.push( res.modelObjects[uid] );
            } );
            return dragDropToProjectFolderWithUid( sources, target, pasteContext );
        } );
    } );
};

/**
 * _getDatasetWriteTickets - returns the dataset write tickets given the dataset output
 *@function commitDataSetFiles
 * @param {Array} datasetOutput - The dataset output
 * @returns {Promise} - The promise that resolves to the dataset write tickets
 */
function _getDatasetWriteTickets( datasetOutput ) {
    let inputs = [];
    for ( var i = 0; i < datasetOutput.length; i++ ) {
        let dataSet = {
            uid: datasetOutput[i].commitInfo[0].dataset.uid,
            type: datasetOutput[i].commitInfo[0].dataset.type
        };
        let isText = datasetOutput[i].commitInfo[0].datasetFileTicketInfos[0].datasetFileInfo.isText;
        let input = {
            createNewVersion: datasetOutput[i].commitInfo[0].datasetFileTicketInfos[0].datasetFileInfo.createNewVersion,
            dataset: dataSet,
            datasetFileInfos: [ {
                allowReplace: datasetOutput[i].commitInfo[0].datasetFileTicketInfos[0].datasetFileInfo.allowReplace,
                fileName: datasetOutput[i].commitInfo[0].datasetFileTicketInfos[0].datasetFileInfo.fileName,
                isText: isText,
                namedReferencedName: datasetOutput[i].commitInfo[0].datasetFileTicketInfos[0].datasetFileInfo.namedReferenceName
            } ]
        };
        inputs.push( input );
    }
    return soaService.postUnchecked( 'Core-2006-03-FileManagement', 'getDatasetWriteTickets', { inputs } );
}

/**
 * dragDropToProjectFolderWithoutUid - returns the dataset write tickets given the dataset output
 *
 * @param {ARRAY}source - External Source
 * @param {ViewModelTreeNode}target - Project Folder Target
 * @param {boolean}isDragDropIntent isDragDropIntent
 * @return promise
 */
export let dragDropToProjectFolderWithoutUid =  function( source, target, pasteContext ) {
    let deferred = AwPromiseService.instance.defer();
    let projectUID = target?.uid.split( '..' )[1].split( '+' )[ 0 ];
    let type = target?.type;
    let fileNameExt = [];
    let fileNames = [];
    let files = [];
    _.forEach( source, ( file )=>{
        files.push( file );
        fileNames.push( file.name );
        fileNameExt.push( file.name.split( '.' )[1] );
    } );
    return getDataTransferSourceTypes( projectUID, fileNameExt ).then( ( response ) => {
        if( response ) {
            return createDataset( response, fileNames ).then( ( responseObj ) => {
                if ( responseObj ) {
                    return commitDataSetFiles( responseObj, files, target, pasteContext ).then( () => {
                        awDragAndDropUtils._clearCachedData();
                        return { sourceObjects: source, targetObject: target };
                    } );
                }
            } );
        }
        return deferred.promise;
    } );
};

/**
 * dragDropToProjectFolder - returns the dataset write tickets given the dataset output
 *
 * @param {ARRAY}source - External Source
 * @param {ViewModelTreeNode}target - Project Folder Target
 * @param {Boolean}isDragDropIntent - isDragDropIntent
 *  @return promise
 */
export let dragDropToProjectFolder = function( source, target, pasteContext ) {
    //var isDragDropIntent = pasteContext.isDragDropIntent;
    const uidsArray = source.map( item => {
        let availUid;
        Object.entries( item ).forEach( ( [ key, value ] ) => {
            if ( key === 'uid' ) {
                availUid = value;
            }
        } );
        return availUid;
    } ).filter( uid => uid !== undefined );

    if( uidsArray.length > 0 ) {
        return dragDropToProjectFolderWithUid( source, target, pasteContext );
    }
    return dragDropToProjectFolderWithoutUid( source, target, pasteContext );
};

/**
  * removeFromProject
  * @function removeFromProject
  * @param {Object}selectedProject - Selected Project
  * @param {ARRAY}objectsToBeRemovedFromProject - Selected objects from Project Contents
  * @return promise
  */
export const removeFromProject = ( selectedProject, objectsToBeRemovedFromProject ) => {
    let deferred = AwPromiseService.instance.defer();
    let projectUID = selectedProject?.uid.split( '..' )[ 1 ].split( '+' )[ 0 ];
    const inputData = {
        assignOrRemoveInput: []
    };

    for( const obj of objectsToBeRemovedFromProject ) {
        let assignOrRemoveInputObj = {
            contextInfo: {
                selectedTopLevelObject: {
                    type: obj.type,
                    uid: obj.uid
                }
            },
            projectsToAssign: [],
            projectsForRemoval: [ {
                uid: projectUID,
                type: 'TC_Project'
            } ],
            processAsynchronously: false,
            objectsForAssignment: [],
            objectsToRemoveFromProjects: [ {
                type: obj.type,
                uid: obj.uid
            } ]
        };
        inputData.assignOrRemoveInput.push( assignOrRemoveInputObj );
    }
    return assignRemoveToProjectFolderService.removeProjectFromFolderFn( objectsToBeRemovedFromProject, inputData );
};

/**
  * removeObjectsFromProjects
  * @function removeObjectsFromProjects
  * @param {ARRAY}objectsToBeRemovedFromProject - Selected objects from Project Contents
  * @return promise
  */
export const removeObjectsFromProjects = ( objectsToBeRemovedFromProject ) => {
    let deferred = AwPromiseService.instance.defer();
    const inputData = {
        assignOrRemoveInput: []
    };

    for( const obj of objectsToBeRemovedFromProject ) {
        let alternateID = obj.alternateID;
        // Get the project folder uid using the below format alternateID.
        // w0oZy__Ar6dnhD,SR::N::Awp0ProjectSubFolder..3WlZSe3rr6dnhD+AIiZSOXNr6dnhD,SR::N::Awp0ProjectFolder..3WlZSe3rr6dnhD,QAiZy__Ar6dnhD,A0hZy__Ar6dnhD
        // If the alternateID does not include Awp0ProjectFolder../:Awp0ProjectSubFolder.. then the selected object is not part of a project folder. Do not include that object for the SOA input.
        let projectUID;
        if (alternateID.includes('Awp0ProjectFolder..')) {
            projectUID = alternateID.split('Awp0ProjectFolder..')[1]?.split(',')[0];
        } else if (alternateID.includes('Awp0ProjectSubFolder..')) {
            projectUID = alternateID.split('Awp0ProjectSubFolder..')[1]?.split(',')[0].split('+')[0];
        }
        
        if( projectUID ) {
            let assignOrRemoveInputObj = {
                contextInfo: {
                    selectedTopLevelObject: {
                        type: obj.type,
                        uid: obj.uid
                    }
                },
                projectsToAssign: [],
                projectsForRemoval: [ {
                    uid: projectUID,
                    type: 'TC_Project'
                } ],
                processAsynchronously: false,
                objectsForAssignment: [],
                objectsToRemoveFromProjects: [ {
                    type: obj.type,
                    uid: obj.uid
                } ]
            };
            inputData.assignOrRemoveInput.push( assignOrRemoveInputObj );
        }
    }
              
    // sending hideContextMenu as true to hide context menu opened on right click
    let hideContextMenu = true;
    return assignRemoveToProjectFolderService.removeProjectFromFolderFn( objectsToBeRemovedFromProject, inputData, hideContextMenu );
};


export const refreshDataProvider = ( dataProvider ) => {
    dataProvider?.resetDataProvider();
};

export let getTC_ProjectObjects = ( soaResponse ) =>{
    let newModelObjects = soaResponse.ServiceData.modelObjects;
    let searchResultObject = {};
    for( const [ key, value ] of Object.entries( newModelObjects ) ) {
        if( value.type === 'TC_Project' ) {
            searchResultObject[key] = value;
        }
    }
    return  searchResultObject;
};

/**
 * set the awp0isActiveTemplate property of Awp0ProjectDataTemplate BO as dirty
 * @returns {Boolean} awp0isActiveTemplate property of Awp0ProjectDataTemplate BO as dirty
 */
export let setIsPropDirty = () => {
    return true;
};

/**
 * setup the setProperties input for awp0isActiveTemplate property of Awp0ProjectDataTemplate BO
 * @param {Object} object - Awp0ProjectDataTemplate object
 * @param {Boolean} isActiveTemplate - boolean value of the awp0isActiveTemplate property of Awp0ProjectDataTemplate BO
 * @returns {Array} setProperties SOA input for setting awp0isActiveTemplate property of Awp0ProjectDataTemplate BO
 */
export let getAwp0IsActiveTemplateForSetProperties = ( object, isActiveTemplate ) => {
    let boolValue = isActiveTemplate.toString();
    return [
        {
            object: object,
            vecNameVal: [ {
                name: 'awp0isActiveTemplate',
                values: [ boolValue ]
            } ]
        }
    ];
};

/**
 * Check if the awp0isActiveTemplate property of Awp0ProjectDataTemplate object needs to be shown on the SWA
 * @param {Object} response SOA response
 * @returns {Boolean} true for showing the property, false for not showing the property.
 */
export let checkIfPropNeedsToBeShown = function( response ) {
    if( response && response.visibleCommandsInContext ) {
        const visibleCommandsInContext = response.visibleCommandsInContext;
        for ( let entry of visibleCommandsInContext ) {
            if ( entry.commands.includes( 'Aut0AddProject' ) ) {
                return true;
            }
        }
    }

    return false;
};

/**
 * Check if the awp0isActiveTemplate property of Awp0ProjectDataTemplate object needs to be shown on the SWA
 * @param {Object} projectDataTemplateObject - the Awp0ProjectDataTemplate object returned in the SOA response
 * @param {ViewModelProperty} awp0isActiveTemplate - the viewmodel property for awp0isActiveTemplate
 * @returns {Object} updated viewmodel property for awp0isActiveTemplate, and also returns the initialValue of the awp0isActiveTemplate property
 */
export let getInitialValueOfIsActiveTemplateProp = ( projectDataTemplateObject, awp0isActiveTemplate ) => {
    let awp0IsActiveTemplateVal = projectDataTemplateObject?.props?.awp0isActiveTemplate?.dbValues[ 0 ] ?? '0';
    let updatedAwp0IsActiveTemplateProp = _.cloneDeep( awp0isActiveTemplate );
    updatedAwp0IsActiveTemplateProp.dbValue = awp0IsActiveTemplateVal === '1';
    updatedAwp0IsActiveTemplateProp.uiValue = projectDataTemplateObject?.props?.awp0isActiveTemplate?.uiValues?.[ 0 ] ?? 'False';
    return {
        awp0isActiveTemplate: updatedAwp0IsActiveTemplateProp,
        initialValue: updatedAwp0IsActiveTemplateProp.dbValue
    };
};

/**
 * publish event cdm.relatedModified with other params and correctly constructed project uid so that alternateID at objectTreeNavigationservice is generated correctly on which selection is based
 * @param {ViewModelTreeNode} relatedModified - the ViewModelTreeNode
 * @param {boolean} refreshLocationFlag - the refresh location
 * @param  {ModelObject} childObjects -childObjects newly created project
 */
export let expandCollapseRefreshProject = ( relatedModified, refreshLocationFlag, childObjects ) => {
    let projectObject = _.cloneDeep( childObjects );
    let projectPrefix = 'SR::N::Awp0ProjectFolder..';
    projectObject.uid = projectPrefix.concat( childObjects.uid );
    eventBus.publish( 'cdm.relatedModified', {
        refreshLocationFlag: refreshLocationFlag,
        isPinnedFlag: false,
        relatedModified: [ relatedModified ],
        createdObjects: [ projectObject ]
    } );
};

//Get the project information from the selected Folder type within Project data folder.
export let getProjectIDs = () =>{
    let selectedFolder = appCtxSvc.getCtx( 'selected' );
    let projectsArray = [];
    if( selectedFolder.alternateID && selectedFolder.alternateID.includes( 'Awp0ProjectFolder..' ) ) {
        var projectUID = selectedFolder.alternateID?.split( 'Awp0ProjectFolder..' )[ 1 ].split( ',' )[ 0 ];
        projectsArray.push( {
            uid:projectUID,
            type:'TC_Project'
        } );
    }
    return projectsArray;
};

export let updateActiveDisplaySelection = ( selectedDisplayMode, isProjectData = false ) => {
    if( !selectedDisplayMode ) {
        return;
    }
    let sessionStorageItem = isProjectData ? 'projectDataSelectionDisplayMode' : 'projectSelectionDisplayMode';
    sessionStorage.setItem( sessionStorageItem, selectedDisplayMode );
};

export let getProjectContentsDisplayModeFromSession = ( isProjectData = false ) => {
    let sessionStorageItem = isProjectData ? 'projectDataSelectionDisplayMode' : 'projectSelectionDisplayMode';
    let projectDisplayModeFromSession = sessionStorage.getItem( sessionStorageItem );

    if( !projectDisplayModeFromSession ) {
        updateActiveDisplaySelection( 'tableDisplay', isProjectData );
        return {
            currentDisplay: 'tableDisplay',
            currentDisplayField: {
                activeDisplay: 'tableDisplay'
            }
        };
    }

    return {
        currentDisplay: projectDisplayModeFromSession,
        currentDisplayField: {
            activeDisplay: projectDisplayModeFromSession
        }
    };
};

const projectFolderUtils = {
    getInputForSettingProjectDataTemplate,
    getAwp0IsActiveTemplateForSetProperties,
    getObject,
    getInitialValueOfIsActiveTemplateProp,
    getSearchCriteriaAndFilters,
    setSearchFolderObjectinState,
    checkIfParentIsProjectTemplate,
    updateSearchStateWithSelectedProject,
    initActiveFolderFulltextStateInProjectCase,
    getProjectFolderContextForToolbar,
    dragDropToProjectFolder,
    removeFromProject,
    removeObjectsFromProjects,
    refreshDataProvider,
    getTC_ProjectObjects,
    setIsPropDirty,
    checkIfPropNeedsToBeShown,
    expandCollapseRefreshProject,
    getProjectIDs,
    updateActiveDisplaySelection,
    getProjectContentsDisplayModeFromSession
};

export default projectFolderUtils;
