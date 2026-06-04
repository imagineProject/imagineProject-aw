// Copyright (c) 2022 Siemens

/* *
 * @module js/aceInlineAuthoringUtils
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import aceAddElementService from 'js/aceAddElementService';
import occmgmtVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import addObjectUtils from 'js/addObjectUtils';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import eventBus from 'js/eventBus';
import dataSourceService from 'js/dataSourceService';

/**
 * Initialize the input VMO for all LOV properties
 *
 * @param {Object} inlineVmo View Model Object of editable row
 * @param {Object} parentElement parent element
 * @param {Object} columnPropToCreateInPropMap Mapping of Column Names to CreateInput Property
 */
export const initPropsLovApi = function( inlineVmo, parentElement, columnPropToCreateInPropMap ) {
    _.forEach( Object.keys( columnPropToCreateInPropMap ), function( key ) {
        var viewProp = inlineVmo.props[ key ];
        if( viewProp && viewProp.hasLov ) {
            viewProp.parentUid = parentElement.uid;
        }
    } );
};

/**
 * This function will return filte0 rmap
 * @param {Object} props View Model Property
 * @returns {Object} filtermap criteria
 */
export const getFilterMap = function( props ) {
    var searchableObjectTypes = props.vmo.searchableObjectTypes;

    var filterMap = {
        'WorkspaceObject.object_type': []
    };
    _.forEach( searchableObjectTypes, function( objectType ) {
        var entry = {
            searchFilterType: 'StringFilter',
            stringValue: objectType
        };

        filterMap[ 'WorkspaceObject.object_type' ].push( entry );
    } );
    return filterMap;
};

/**
 * The function will add the keyword vmo to input data.
 *
 * @param {Object} searchResultsResponse - search response
 * @returns {Object} modified data
 */
export const convertSolrSearchResponseToLovEntries = function( searchResultsResponse ) {
    var lovEntries = [];
    if( searchResultsResponse.searchResultsJSON ) {
        var searchResults = parsingUtils.parseJsonString( searchResultsResponse.searchResultsJSON );
        if( searchResults ) {
            for( var x = 0; x < searchResults.objects.length; ++x ) {
                var uid = searchResults.objects[ x ].uid;
                var obj = searchResultsResponse.ServiceData.modelObjects[ uid ];
                var lovEntry = {
                    propInternalValue: obj.uid,
                    propDisplayValue: obj.props.object_name.uiValues[ 0 ],
                    propDisplayDescription: obj.props.object_string.uiValues[ 0 ]
                };
                lovEntries.push( lovEntry );
            }
        }
    }
    return lovEntries;
};

/**
 * The function will return object types that we want filter in solr search
 *
 * @param {Object} parentElement - parent element
 * @returns {Object} modified data
 */
export const getSearchableObjectTypes = function( parentElement ) {
    var deferred = AwPromiseService.instance.defer();

    var soaInput = {
        getInfoForElementIn: {
            parentElement: parentElement,
            fetchAllowedOccRevTypes: false
        }
    };
    return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'getInfoForAddElement4', soaInput ).then(
        function( response ) {
            var _allowedTypesInfo = aceAddElementService.extractAllowedTypesInfoFromResponse( response );
            var typesString = _allowedTypesInfo.searchTypeName;
            var types = typesString.split( ',' );
            deferred.resolve( types );
            return deferred.promise;
        },
        function( error ) {
            deferred.reject( error );
            return deferred.promise;
        } );
};

/**
 * The function will set given object properties on row.
 * @param {Object} dataProvider - data provider
 * @param {Object} row - input row
 * @param {Object} object - object of which properties to be populated
 */
export const populateObjectProps = function( dataProvider, row, object ) {
    row.displayName = row.props.awb0Archetype.uiValue;
    row.props.object_string.uiValue = row.props.awb0Archetype.uiValue;
    row.props.object_string.uiValues[ 0 ] = row.props.awb0Archetype.uiValue;
    if( !object ) {
        eventBus.publish( 'occTreeTable.plTable.clientRefresh' );
        return;
    }

    const viewModelCollection = dataProvider.viewModelCollection.getLoadedViewModelObjects();

    //LCS-297740: Make the property map customizable for auto-population of Usage props on empty row
    const propertyMap = { usg0UsageOccRevName: 'object_name', usg0UsageOccRevDesc: 'object_desc' };
    for( var name in propertyMap ) {
        const rowProp = row.props[ name ];
        const objProp = object.props[ propertyMap[ name ] ];

        if( objProp.dbValues[ 0 ] !== null && rowProp !== undefined &&
            ( rowProp.prevValue && ( rowProp.dbValue === undefined || rowProp.dbValue === '' ) || rowProp.prevValue === rowProp.dbValue ||
                rowProp.prevValue === undefined && ( rowProp.dbValue === undefined || rowProp.dbValue === '' || rowProp.dbValue === null ) ) ) {
            // never set null as previous value
            if( objProp.dbValues[ 0 ] !== null ) {
                row.props[ name ].prevValue = objProp.dbValues[ 0 ];
            }

            uwPropertyService.setValue( row.props[ name ], object.props[ propertyMap[ name ] ].dbValues[ 0 ] );
        }
    }

    //Replace a row after populating values
    const srcIndex = dataProvider.viewModelCollection.findViewModelObjectById( row.uid );
    const replaceingInlinerow = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( row, row.childNdx, row.levelNdx );
    _.merge( replaceingInlinerow, row );
    viewModelCollection.splice( srcIndex, 1 );
    viewModelCollection.splice( srcIndex, 0, replaceingInlinerow );
    dataProvider.update( viewModelCollection );
};

/**
 * This function will return model object which are realy created in database from createAttachAndSubmitObjects response.
 * @param {Object} response - createAttachAndSubmitObjects response
 * @returns {Object} model objects
 */
export const getCreatedObjectsForInline = function( response ) {
    var objects = addObjectUtils.getCreatedObjects( response );
    var newObjects = [];

    _.forEach( objects, function( object ) {
        if( _.includes( response.ServiceData.created, object.uid ) ) {
            newObjects.push( object );
        }
    } );

    return newObjects;
};

/**
 * Creates a data source
 * @param {Object} dataProvidersIn - data providers
 * @return {Object} dataSource instance
 */
export const createDatasource = function( dataProvidersIn ) {
    var declViewModel = {
        dataProviders: dataProvidersIn,
        name:dataProvidersIn.occDataProvider.name,
        editContext:dataProvidersIn.occDataProvider.name
    };
    return dataSourceService.createNewDataSource( {
        declViewModel: declViewModel
    } );
};

/**
 * This API is added to form the message string from the Partial error being thrown from the SOA
 *
 * @param {Object} messages - messages array
 * @param {Object} msgObj - message object
 */
const getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if( msgObj.msg.length > 0 ) {
            msgObj.msg += '<BR/>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

/**
 * This API is added to process the Partial error being thrown from the SOA
 *
 * @param {object} serviceData - the service data Object of SOA
 * @return {object} sreturns message object
 */
export const processPartialErrors = function( serviceData ) {
    const msgObj = {
        msg: '',
        level: 0
    };
    if( serviceData.partialErrors ) {
        _.forEach( serviceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    return msgObj.msg;
};

var _getCreateInputObject = function( boName, propertyNameValues, compoundCreateInput ) {
    return {
        boName: boName,
        propertyNameValues: propertyNameValues,
        compoundCreateInput: compoundCreateInput
    };
};

var _getChildFullPropertyName = function( fullPropertyName, count, propName ) {
    let childFullPropertyName = fullPropertyName;
    if( count > 0 ) {
        childFullPropertyName += '__' + propName; //NON-NLS-1
    } else {
        childFullPropertyName += propName;
    }
    return childFullPropertyName;
};

var _addChildInputToParentMap = function( fullPropertyName, count, propertyNameTokens, createInputMap, vmProp ) {
    const propName = propertyNameTokens[ count ];
    const childFullPropertyName = _getChildFullPropertyName( fullPropertyName, count, propName );

    // Check if the child create input is already created
    let childCreateInput = _.get( createInputMap, childFullPropertyName );
    if( !childCreateInput && vmProp && vmProp.intermediateCompoundObjects ) {
        const compoundObject = _.get( vmProp.intermediateCompoundObjects, childFullPropertyName );
        if( compoundObject ) {
            // Get the parent create input
            var parentCreateInput = _.get( createInputMap, fullPropertyName );
            if( parentCreateInput ) {
                // Create the child create input
                // Add the child create input to parent create input
                childCreateInput = _getCreateInputObject( compoundObject.modelType.owningType, {}, {} );
                if( !parentCreateInput.compoundCreateInput.hasOwnProperty( propName ) ) {
                    parentCreateInput.compoundCreateInput[ propName ] = [];
                }
                parentCreateInput.compoundCreateInput[ propName ].push( childCreateInput );

                createInputMap[ childFullPropertyName ] = childCreateInput;
            }
        }
    }
    return childFullPropertyName;
};

var _processPropertyForCreateInput = function( propName, vmProp, createInputMap ) {
    if( vmProp ) {
        const valueStrings = uwPropertyService.getValueStrings( vmProp );
        if( valueStrings && valueStrings.length > 0 ) {
            let fullPropertyName = '';
            const propertyNameTokens = propName.split( '__' );
            for( let i = 0; i < propertyNameTokens.length; i++ ) {
                var propertyName = propertyNameTokens[ i ];
                if( i < propertyNameTokens.length - 1 ) {
                    // Handle child create inputs
                    fullPropertyName = _addChildInputToParentMap( fullPropertyName, i, propertyNameTokens,
                        createInputMap, vmProp );
                } else {
                    // Handle property
                    const createInput = createInputMap[ fullPropertyName ];
                    if( createInput ) {
                        const propertyNameValues = createInput.propertyNameValues;
                        _.set( propertyNameValues, propertyName, valueStrings );
                    }
                }
            }
        }
    }
};

/**
 * Get input data for object creation.
 *
 * @param {Object} data - the view model data object
 * @param {Object} dataSource - data source
 * @return {Object} create input
 */
export const getCreateInput = function( data, dataSource ) {
    const createInputMap = {};
    const createType = data.objCreateInfo.createType;
    createInputMap[ '' ] = _getCreateInputObject( createType, {}, {} );

    if( dataSource ) {
        _.forEach( data.objCreateInfo.propNamesForCreate, function( propName ) {
            const vmProp = _.get( data, propName );
            if( vmProp && ( vmProp.isAutoAssignable || uwPropertyService.isModified( vmProp ) ) ) {
                _processPropertyForCreateInput( propName, vmProp, createInputMap );
            }
        } );
    }

    return [ {
        clientId: 'CreateObject',
        createData: _.get( createInputMap, '' ),
        dataToBeRelated: {},
        workflowData: [],
        targetObject: null,
        pasteProp: ''
    } ];
};

/**
 * Get property name for inline row authoring in ACE
 * @param {[Object]} occContext - occContext atomic data
 * @returns {string} Property name for inline row authoring
 */
export const getTypePropertyNameForInlineRow = function( occContext ) {
    return occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature ? 'usg0ArchetypeType' : 'awb0UnderlyingObjectType';
};

export const openDialog = ( input ) => {
    const { commandContext } = input;
    const { dialogActionForACEContextMenu } = commandContext;
    const commandId = input.commandId;
    if( dialogActionForACEContextMenu ) {
        let options = {
            view: commandId,
            parent: '.aw-layout-workareaMain',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            push: true,
            subPanelContext: commandContext,
            commandid: commandId,
            commandicon: 'cmdAdd'
        };
        dialogActionForACEContextMenu.show( options );
    }
};

const exports = {
    initPropsLovApi,
    getFilterMap,
    convertSolrSearchResponseToLovEntries,
    populateObjectProps,
    getCreatedObjectsForInline,
    createDatasource,
    processPartialErrors,
    getSearchableObjectTypes,
    getTypePropertyNameForInlineRow,
    getCreateInput,
    openDialog
};

export default exports;
