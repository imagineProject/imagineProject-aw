// Copyright (c) 2021 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/Awp0AssignProjects
 */
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';
import $ from 'jquery';
import projectMgmntUtils from 'js/projectMgmntUtils';

var exports = {};

var _sublocationContext = null;

/**
  * set/update the context object
  *
  * @param {Array} memberProjects - the project list already assigned to the selected objects
  * @param {Array} selObjects - the selected objects
  */
export let getContext = function() {
    _sublocationContext = appCtxSvc.getCtx( 'locationContext' );
};

/**
  * Prepares the SOA input for the projects to assign
  *
  * @param {viewModelObject} data - json object
  *
  * @return {Array} Array of assign projects uid
  *
  *
  */

export let projectsToAssign = function( data ) {
    var assignProjectsuid = _.isUndefined( data.assignedProjectsUid ) ? [] : data.assignedProjectsUid;
    var assignedProjectsSOAInput = [];
    for( var i = 0; i < assignProjectsuid.length; i++ ) {
        var assignedProjects = {};
        assignedProjects.uid = assignProjectsuid[ i ];
        assignedProjects.type = 'TC_Project';
        assignedProjectsSOAInput.push( assignedProjects );
    }
    return assignedProjectsSOAInput;
};

export let getOwningProgramAvailableList = function( response, data ) {
    var owningProgram = {
        owningProject: '',
        list: [],
        isOwningProjectUpdated: false
    };

    var list = [];
    if( response.availableProjectList ) {
        //Get the owning program avialable list
        list = _.clone( response.availableProjectList );
        if( response.projectOutput.assignedProjectsList ) {
            var availableOwningProgramList = data.dataProviders.availableOwningProgram.viewModelCollection.loadedVMObjects;
            //Dont push if it is already added to availableOwningProgram List
            _.forEach( response.projectOutput.assignedProjectsList, function( assignedProject ) {
                var result = _.some( availableOwningProgramList, function( object ) {
                    if( object.uid === assignedProject.uid ) {
                        return true;
                    }
                } );
                if(!result){
                    list.unshift( assignedProject );
                }       
            });
        }
    } else if( response.projectOutput.assignedProjectsList && data.filterBoxOwningProgram.dbValue === '' ) {
            list = _.clone( response.projectOutput.assignedProjectsList );
        }
    
    if( data.filterBoxOwningProgram.dbValue !==''){
        projectMgmntUtils.setFilterText( data.filterBoxOwningProgram.dbValue );
        var arrByID = list.filter( projectMgmntUtils.filterByName );
        list = arrByID;
    }

    var commonOwningProjUid = [ '' ];
    var owningProjectCtx = appCtxSvc.getCtx( 'owningProject' );
    if( owningProjectCtx ) {
        //Usecase - get the owning project while navigating the owning tab or while scrolling or filtering from ctx
        commonOwningProjUid = [ owningProjectCtx.uid ];
        owningProgram.owningProject = owningProjectCtx;
    } else {
        //Get the owning Program uid
        //Display the common owning project in case of multiobject selected
        var selectedTargetObjs = appCtxSvc.getCtx( 'mselected' );
        var selectedOwningProject = selectedTargetObjs[ 0 ];
        if( cmm.isInstanceOf( 'Awb0Element', selectedTargetObjs[ 0 ].modelType ) && selectedTargetObjs[ 0 ].props.awb0UnderlyingObject && selectedTargetObjs[ 0 ].props.awb0UnderlyingObject.dbValues[ 0 ] ) {
            var getUnderlyingUid = selectedOwningProject.props.awb0UnderlyingObject.dbValues[ 0 ];
            selectedOwningProject = cdm.getObject( getUnderlyingUid );
        }

        commonOwningProjUid = selectedOwningProject.props.owning_project ? [ selectedOwningProject.props.owning_project.dbValues[ 0 ] ] : [ '' ];
        if( commonOwningProjUid[ 0 ] ) {
            for( var i = 1; i < selectedTargetObjs.length; i++ ) {
                var owningProj = selectedTargetObjs[ i ].props.owning_project ? selectedTargetObjs[ i ].props.owning_project.dbValues[ 0 ] : '';
                if( commonOwningProjUid[ 0 ] !== owningProj ) {
                    commonOwningProjUid[ 0 ] = '';
                    break;
                }
            }
            owningProgram.owningProject = commonOwningProjUid[ 0 ] !== '' ? viewModelObjectService.createViewModelObject( commonOwningProjUid[ 0 ] ) : '';
        }
        appCtxSvc.registerCtx( 'owningProject', owningProgram.owningProject );
    }    

    //Filter the Owning Project from the available list
    var modelObjects = $.grep( list, function( eachObject ) {
        return $.inArray( eachObject.uid, commonOwningProjUid ) === -1;
    } );
    //update the OwningProgram
    owningProgram.list = _.clone( modelObjects );
    return owningProgram;
};

/**
  * Prepares the SOA input for the objects to assign
  *
  * @param {viewModelObject} data - json object
  *
  * @return {Array} Array of owning object from which the projects needs to be assigned
  *
  *
  */

export let objectToAssign = function( data ) {
    exports.getContext();
    var objectsToAssign = [];
    objectsToAssign = _.clone( data.adaptedObjects );
    return objectsToAssign;
};

/**
  * Prepares the SOA input for the projects to remove
  *
  * @param {viewModelObject} data - json object
  *
  * @return {Array} Array of removed projects uid
  *
  *
  */
export let projectsToRemove = function( data ) {
    var removeProjectsuid = _.isUndefined( data.removeProjectSoaInput ) ? [] : data.removeProjectSoaInput;
    var removeProjectsSOAInput = [];
    for( var i = 0; i < removeProjectsuid.length; i++ ) {
        var removeProject = {};
        removeProject.uid = removeProjectsuid[ i ];
        removeProject.type = 'TC_Project';
        removeProjectsSOAInput.push( removeProject );
    }
    return removeProjectsSOAInput;
};

/**
  * Prepares the SOA input for the objectToRemove
  *
  * @param {viewModelObject} data - json object
  *
  * @return {Array} Array of owning object from which the projects needs to be removed
  *
  *
  */
export let objectToRemove = function( data ) {
    exports.getContext();
    var objectsToRemove = [];
    objectsToRemove = _.clone( data.adaptedObjects );
    return objectsToRemove;
};

/**
  * Prepares the SOA input for getProjectsForAssignOrRemove from the viewModel json
  *
  * @return {Array} Array of memberOfList
  *
  */

export let getAssignedProjects = function( data ) {
    var assignedProjects = [];
    if( !_.isUndefined( data.dataProviders.memberOfProjectList.viewModelCollection.loadedVMObjects ) &&
         data.dataProviders.memberOfProjectList.viewModelCollection.loadedVMObjects.length > 0 ) {
        return data.dataProviders.memberOfProjectList.viewModelCollection.loadedVMObjects;
    }
    return assignedProjects;
};

/**
  * Check the context of the selected object
  *
  * @return {Boolean} True in case of ACE
  *
  */

export let isACEContext = function() {
    exports.getContext();
    if( _sublocationContext[ 'ActiveWorkspace:SubLocation' ] === 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation' ) {
        return true;
    }
    return false;
};

/**
  * Returns the Root Level Object
  *
  * @return {Object} Root Object
  *
  */
export let getRootObject = function() {
    var isACE = exports.isACEContext();
    if( isACE ) {
        var occMgmnt = appCtxSvc.getCtx( 'occmgmtContext' );
        var rootObjUID = occMgmnt.productContextInfo.props.awb0Product.dbValues[ 0 ];

        return {
            uid: rootObjUID,
            type: 'UnknownType'
        };
    }
};

/**
  * Returns the revision rule attached to top level object
  *
  * @return {Object} revision rule
  *
  */
export let getRevisionRule = function() {
    var isACE = exports.isACEContext();
    if( isACE ) {
        var occMgmnt = appCtxSvc.getCtx( 'occmgmtContext' );
        var revRule = occMgmnt.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ];

        return {
            uid: revRule,
            type: 'UnknownType'
        };
    }
};

/**
  * Returns the variant rule attached to top level object
  *
  * @return {Object} variant rule
  *
  */
export let getVariantRule = function() {
    var isACE = exports.isACEContext();
    if( isACE ) {
        var occMgmnt = appCtxSvc.getCtx( 'occmgmtContext' );
        var variantRule = occMgmnt.productContextInfo.props.awb0CurrentVariantRule.dbValues[ 0 ];

        return {
            uid: variantRule,
            type: 'UnknownType'
        };
    }
};

/**
  * set ApplyTo option
  *
  * @param {Object} data - data
  *
  */
export let setTypeOption = function( data ) {
    if( data.applyToRawList && data.applyToRawList.length > 0 ) {
        var revision = data.applyToRawList.filter( function( v ) {
            return v.isDefaultValue === true;
        } );
        data.applyTo.dbValue = Boolean( _.isEqual( revision[ 0 ].internalValue, '1' ) );
    }
};

/**
  * Check the context of the selected object
  *
  * @return {Boolean} True in case of ACE
  *
  */

export let getTypeOption = function( data ) {
    var option = 0;

    if( data.applyToRawList && data.applyToRawList.length > 0 ) {
        var revision = data.applyToRawList.filter( function( v ) {
            return data.applyTo.dbValue === true;
        } );
        if( !_.isEmpty( revision ) ) {
            option = parseInt( revision[ 0 ].internalValue );
        }
    }
    return option;
};

/**
  * Check the context of the selected object
  *
  * @return {Boolean} True in case of ACE
  *
  */

export let getDepth = function( data ) {
    var isACE = exports.isACEContext();
    if( isACE ) {
        if( !data.structure.dbValue ) {
            return data.level.dbValue;
        }
        return -1;
    }
};

/**
  * Create input for the SOA structure in ACE context
  *
  * @return {object} structure for each selected object
  *
  */

var eachObjectInMultiSelectACEInput = function( selectedObject, data ) {
    var eachACEObject = {
        projectsToAssign: exports.projectsToAssign( data ),
        projectsForRemoval: exports.projectsToRemove( data ),
        contextInfo: {
            selectedTopLevelObject: selectedObject,
            variantRule: exports.getVariantRule(),
            revisionRule: exports.getRevisionRule(),
            typeOption: exports.getTypeOption( data ),
            depth: exports.getDepth( data )
        },

        processAsynchronously: false
    };
    var objects = [ selectedObject ];
    if( eachACEObject.projectsToAssign.length > 0 ) {
        eachACEObject.objectsForAssignment = objects;
    }
    if( eachACEObject.projectsForRemoval.length > 0 ) {
        eachACEObject.objectsToRemoveFromProjects = objects;
    }
    return eachACEObject;
};

/**
  * Create input for the SOA structure in ACE context
  *
  * @return {object} structure for root object when no object is selected in ACE context
  *
  */
var rootObjectACEInput = function( selectedObject, data ) {
    return {
        projectsToAssign: exports.projectsToAssign( data ),
        objectsForAssignment: exports.objectToAssign( data ),
        projectsForRemoval: exports.projectsToRemove( data ),
        objectsToRemoveFromProjects: exports.objectToRemove( data ),
        contextInfo: {
            selectedTopLevelObject: exports.getRootObject(),
            variantRule: exports.getVariantRule(),
            revisionRule: exports.getRevisionRule(),
            typeOption: exports.getTypeOption( data ),
            depth: exports.getDepth( data )
        },

        processAsynchronously: false
    };
};

/**
  * Create input for the SOA structure in ACE context
  *
  * @return {object} structure for each selected object in non ACE context
  *
  */
var eachObjectInMultiSelectInput = function( selectedObject, data ) {
    var eachObject = {
        projectsToAssign: exports.projectsToAssign( data ),
        projectsForRemoval: exports.projectsToRemove( data ),
        contextInfo: {
            selectedTopLevelObject: selectedObject,
            variantRule: '',
            revisionRule: '',
            typeOption: exports.getTypeOption( data ),
            depth: ''
        },

        processAsynchronously: false
    };
    //check if the selectedObject type is folder
    if ( selectedObject.type === 'Folder' ) {
        if( data.assignFolders && data.assignFolders.dbValue === true ) {
        // depth = 0 to assign project to folders only
            eachObject.contextInfo.depth = 0;
        } else {
        // depth = -1 to assign project to folders and its content
            eachObject.contextInfo.depth = -1;
        }
    }

    var objects = [ selectedObject ];
    if( eachObject.projectsToAssign.length > 0 ) {
        eachObject.objectsForAssignment = objects;
    }
    if( eachObject.projectsForRemoval.length > 0 ) {
        eachObject.objectsToRemoveFromProjects = objects;
    }
    return eachObject;
};

/**
  * Create input for the SOA
  *
  * @return {Array} Array of Objects
  *
  */
export let assignOrRemoveInput = function( data ) {
    exports.getContext();
    var selectedObjects = _.clone( data.adaptedObjects );
    var isACE = exports.isACEContext();

    var assignOrRemoveInput = [];
    var eachObject = {};
    if( selectedObjects.length > 0 ) {
        for( var i = 0; i < selectedObjects.length; i++ ) {
            if( isACE ) {
                var eachACEObject = {};
                eachACEObject = eachObjectInMultiSelectACEInput( selectedObjects[ i ], data );
                assignOrRemoveInput.push( eachACEObject );
            } else {
                eachObject = eachObjectInMultiSelectInput( selectedObjects[ i ], data );
                assignOrRemoveInput.push( eachObject );
            }
        }
    } else {
        if( isACE ) {
            var selectedObject = rootObjectACEInput( selectedObject, data );
            assignOrRemoveInput.push( selectedObject );
        }
    }
    return assignOrRemoveInput;
};


/**
  * Create input for the SOA
  *
  * @return {Array} Array of Objects
  *
  */
export let assignOrRemoveOwningProgram = function( data ) {
    exports.getContext();
    var selectedObjects = _.clone( data.adaptedObjects );
    var isACE = exports.isACEContext();

    var assignOrRemoveInput = [];
    var eachObject = {};
    if( selectedObjects.length > 0 ) {
        for( var i = 0; i < selectedObjects.length; i++ ) {
            if( isACE ) {
                var eachACEObject = {};
                if( exports.projectsToAssign( data ).length > 0 ||  exports.projectsToRemove( data ) ) {
                    eachACEObject = {
                        type: selectedObjects[ i ].type,
                        uid :selectedObjects[ i ].uid
                    };
                    assignOrRemoveInput.push( eachACEObject );
                }
            } else {
                if( exports.projectsToAssign( data ).length > 0 ||  exports.projectsToRemove( data ) ) {
                    eachObject = {
                        type: selectedObjects[ i ].type,
                        uid :selectedObjects[ i ].uid
                    };
                    assignOrRemoveInput.push( eachObject );
                }
            }
        }
    } else {
        if( isACE ) {
            var selectedObject = {};
            selectedObject = {
                type:'',
                uid :''
            };
            assignOrRemoveInput.push( selectedObject );
        }
    }
    return assignOrRemoveInput;
};

/**
  * This API is added to form the message string from the Partial error being thrown from the SOA
  */
var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if( msgObj.msg.length > 0 ) {
            msgObj.msg += '<BR/>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

export let processPartialErrors = function( serviceData ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( serviceData.partialErrors ) {
        getMessageString( serviceData.partialErrors[ 0 ].errorValues, msgObj );
    }

    return msgObj.msg;
};

export let getMemberOfList = function( response, data ) {
    var newResponse = _.cloneDeep( response );
    //set ctx for assignedProject
    if( !appCtxSvc.getCtx( 'assignedProjectList' )) {
        var projectList = newResponse.projectOutput?.assignedProjectsList ? newResponse.projectOutput.assignedProjectsList.map(obj => obj.uid) : [];
        appCtxSvc.registerCtx( 'assignedProjectList', projectList );
    }
    if( data.removeProjectsUid.length > 0 && !_.isUndefined( newResponse.projectOutput.assignedProjectsList ) &&
         newResponse.projectOutput.assignedProjectsList.length > 0 ) {
        var filterText = data.filterBox.dbValue.toLowerCase();
        return $.grep( newResponse.projectOutput.assignedProjectsList, function( eachObject ) {
            if( $.inArray( eachObject.uid, data.removeProjectsUid ) === -1 ) {
                return true;
            }
            var project_id = eachObject.props.project_id.dbValues[ 0 ].toLowerCase();
            var project_name = eachObject.props.project_name.dbValues[ 0 ].toLowerCase();

            if( project_id.includes( filterText ) || project_name.includes( filterText ) ) {
                if( _.isUndefined( response.availableProjectList ) ) {
                    newResponse.availableProjectList = [];
                }
                newResponse.availableProjectList.push( eachObject );
                newResponse.totalFound += 1;
                newResponse.totalLoaded += 1;
            }
            return false;
        } );
    }
    return newResponse.projectOutput.assignedProjectsList;
};

/**
 * Check if more projects are about to load through pagination.
 * return true if all projects are not loaded in data provider.
 * return false if all avaliable projects are already loaded in dataprovider.
 * @param {*} response 
 * @param {*} data 
 * @returns true/false
 */
export let getMoreValuesExist = function( response ) {
    let moreValuesExist = false;

    if( response.availableProjectList ) {
        moreValuesExist = response.endIndex < response.totalFound; // for pagination
    }
    return moreValuesExist;
};

/**
 * Get the startIndex for getProjectsForAssignOrRemove soa call 
 * @param {*} startIndex - This function input is the endIndex of availableProjects / availableOwningProgram list which is used as startIndex for next soa call while scrolling
 * @param {*} dataProvider - it is availableProjects / availableOwningProgram dataprovider
 * @returns 
 */
export let getStartIndex = function( startIndex, dataProvider ) {
    //If its loading first time or filtering
    if(dataProvider.startIndex === 0 ){    
        return 0;
    }
    return startIndex;
};

export default exports = {
    getContext,
    projectsToAssign,
    getOwningProgramAvailableList,
    objectToAssign,
    projectsToRemove,
    objectToRemove,
    getAssignedProjects,
    isACEContext,
    getRootObject,
    getRevisionRule,
    getVariantRule,
    setTypeOption,
    getTypeOption,
    getDepth,
    assignOrRemoveInput,
    assignOrRemoveOwningProgram,
    processPartialErrors,
    getMemberOfList,
    getMoreValuesExist,
    getStartIndex
};
