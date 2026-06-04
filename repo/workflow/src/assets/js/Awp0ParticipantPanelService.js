// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0ParticipantPanelService
 */
import uwPropertySvc from 'js/uwPropertyService';
import awColumnSvc from 'js/awColumnService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import soaSvc from 'soa/kernel/soaService';
import wrkflwSortFilterSvc from 'js/Awp0WorkflowSortFilterService';
import _ from 'lodash';
import tableSvc from 'js/splmTablePublishedService';
import htmlUtil from 'js/htmlUtils';
import tableDPReqRespHelper from 'js/tableDataProviderRequestResponseHelper';

var exports = {};
var PREFIX_NAME_SUFFIX = '_displayable_participant_types';

/**
 * Table Cell Renderer for PL Table for participantValue column
 *
 * @returns {Object} Cell render object
 */
var _cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem ) {
            var cellContent = htmlUtil.createElement( 'div', tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT );
            cellContent.classList.add( tableSvc.CLASS_TABLE_CELL_TOP );
            var cellDispValue = _.get( vmo, 'props.' + column.field + '.uiValue' );

            if( cellDispValue ) {
                cellContent.textContent = cellDispValue;
                cellContent.title = cellDispValue;
            }
            tableElem.classList.add( tableSvc.CLASS_TABLE_CELL_TOP_DYNAMIC );
            cellContent.classList.add( tableSvc.CLASS_WIDGET_TABLE_CELL_TEXT_DYNAMIC );
            cellContent.classList.add( 'aw-workflow-requiredParticipantText' );
            cellContent.classList.add( 'sw-errorText' );
            return cellContent;
        },
        condition: function( column, vmo ) {
            // Check if VMO is not null and contains isRequiredParticipant and column field is participantValue
            // then only return true as we need to show custom renderer for that column
            return vmo && vmo.isRequiredParticipant && column && column.field === 'participantValue';
        }
    };
};

/**
 *
 * @param {Array} columns Table columns array
 * @returns {Array} Column objects
 */
function _getTableColumnInfos( columns ) {
    var columnInfos = [];
    // Get the custom cell renderer
    var renderer = _cellRenderer();
    _.forEach( columns, function( attrObj ) {
        var propName = attrObj.propName;
        var propDisplayName = attrObj.propDisplayName;
        var width = attrObj.width;
        var minWidth = attrObj.minWidth;

        var columnInfo = awColumnSvc.createColumnInfo();
        //Set values for common properties
        columnInfo.name = propName;
        columnInfo.displayName = propDisplayName;
        columnInfo.enableFiltering = true;
        columnInfo.isTreeNavigation = attrObj.isTreeNavigation;
        columnInfo.width = width;
        columnInfo.minWidth = minWidth;
        columnInfo.maxWidth = 800;
        columnInfo.modifiable = false;
        columnInfo.isActionColumn = false;
        // Below two variable need to set to hide the Hide columns menu from table
        // As we use hard coded column so we don't have arrange panel right now. So to overcome
        // the issue setting these variables.
        columnInfo.enableHiding = false;
        columnInfo.enableColumnHiding = false;

        if( attrObj.cellTemplate ) {
            columnInfo.cellTemplate = attrObj.cellTemplate;
        }
        // Check if property name participantValue then we need to add custom renderer for that column
        if( propName === 'participantValue' ) {
            columnInfo.cellRenderers = [ renderer ];
        }

        //Set values for un-common properties
        columnInfo.typeName = attrObj.type;
        columnInfo.enablePinning = true;
        columnInfo.enableSorting = true;

        columnInfos.push( columnInfo );
    } );
    return columnInfos;
}

/**
 * Populate handler arguments column data
 *
 * @param {Array} columns - Column array Object
 * @return {Object} - Column info object
 */
export let loadParticipantTableColumns = function(  columns ) {
    // Get the column configuration info and return
    return {
        columnInfos: _getTableColumnInfos( columns )
    };
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
    if( obj && obj.modelType && obj.modelType.typeHierarchyArray.indexOf( type ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Get the input object property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props && modelObject.props[ propName ] ) {
        var values = null;
        if( isDispValue ) {
            values = modelObject.props[ propName ].uiValues;
        } else {
            values = modelObject.props[ propName ].dbValues;
        }
        if( values && values[ 0 ] ) {
            propValue = values[ 0 ];
        }
    }
    return propValue;
};

/**
 * Get all supported participant types that need to be shown on the table.
 *
 * @param {Object} selectedObject Selected object from UI.
 * @param {Array} preferences Preferences array
 *
 * @returns {Array} String array that will tell all participant types that need to be shown.
 */
var _populateSupportedParticipantTypes = function( selectedObject, preferences ) {
    if( !selectedObject || !selectedObject.modelType || !selectedObject.modelType.typeHierarchyArray
        || !preferences || _.isEmpty( preferences ) ) {
        return [];
    }

    // Get type hierarchy array to get correct preference value that will tell about
    // all participant types that need to be shown
    var typeHierarchyArray = selectedObject.modelType.typeHierarchyArray;
    for( var idx = 0; idx < typeHierarchyArray.length; idx++ ) {
        var typeName = typeHierarchyArray[ idx ];
        // Build the preference name
        var prefName = typeName + PREFIX_NAME_SUFFIX;

        if( preferences.hasOwnProperty( prefName ) && preferences[ prefName ] ) {
            return preferences[ prefName ];
        }
    }
    return [];
};

/**
 * Get the participant type input for constant need to be loaded.
 *
 * @param {Array} preferences Preferences array values
 * @param {Object} selectedObject Selected object from UI
 *
 * @returns {Array} Constant array for constant values need to be fetched
 */
export let getParticipantConstantLoaded = function( preferences, selectedObject ) {
    var supportedParticipantTypes = _populateSupportedParticipantTypes( selectedObject, preferences );
    var constantTypesPopulated = [];
    if( supportedParticipantTypes && !_.isEmpty( supportedParticipantTypes ) ) {
        _.forEach( supportedParticipantTypes, function( participantType  ) {
            var object = {
                typeName: participantType,
                constantName: 'ParticipantAllowMultipleAssignee'
            };
            constantTypesPopulated.push( object );
        } );
    }
    return constantTypesPopulated;
};

/**
 * Get the participant type constant values that needs to be shown in table.
 *
 * @param {Array} preferences Preferences array values
 * @param {Object} selectedObject Selected object from UI
 *
 * @returns {Array} Constant array for constant values need to be shown in table
 */
export let loadParticipantConstantTypes = function( preferences, selectedObject ) {
    // We are making this call in JS code as if invalid values are defiend in preference
    // then we don't want to show the error instead we want to get the values for correct
    // types and return the correct values and ignore the error if any present on service data.
    // Fix for defect # LCS-545443
    var constantTypesPopulated = getParticipantConstantLoaded( preferences, selectedObject );
    return soaSvc.postUnchecked( 'BusinessModeler-2007-06-Constants', 'getTypeConstantValues', {
        keys: constantTypesPopulated
    } ).then( function( response ) {
        var typeConstantValues = [];
        if( response && response.constantValues && response.constantValues.length > 0 ) {
            typeConstantValues = response.constantValues;
        }
        return typeConstantValues;
    } );
};

/**
 * Populate all supported participant type along with its display names.
 *
 * @param {Object} data Data view model object
 * @param {Object} selectedObject Selected object from UI.
 *
 * @returns {Object} Participant type map that hold internal name along with display name
 */
var _populateParticipantTypeNameMap = function( data, selectedObject ) {
    // If input object is not valid then return empty map.
    if( !selectedObject || !selectedObject.uid || !data ) {
        return {};
    }
    var validTargetObject = cdm.getObject( selectedObject.uid );
    var participantTypes = [];
    // Get the allowable_participant_types property to populate participant type display names
    if( validTargetObject && validTargetObject.props.allowable_participant_types && validTargetObject.props.allowable_participant_types.dbValues ) {
        participantTypes = validTargetObject.props.allowable_participant_types.dbValues;
    }
    var participantTypeMap = new Object();
    // Iterate for all allowable participant types and iterate for populate the map.
    if( participantTypes && participantTypes.length > 0 ) {
        for( var idx = 0; idx < participantTypes.length; idx++ ) {
            var typeName = cmm.extractTypeNameFromUID( participantTypes[ idx ] );
            var uiValue = validTargetObject.props.allowable_participant_types.uiValues[ idx ];

            // Check if type name present in locale file then use that as dispaly value
            if( data.i18n && data.i18n[ typeName ] ) {
                uiValue = data.i18n[ typeName ];
            }
            // If uiValue is still null then use the internal name as display name
            if( !uiValue ) {
                uiValue = typeName;
            }
            participantTypeMap[ typeName ] = uiValue;
        }
    }
    return participantTypeMap;
};

/**
 * Populate all assignable participant type along with its display names.
 *
 * @param {Object} data Data view model object
 * @param {Object} selectedObject Selected object from UI.
 *
 * @returns {Object} Participant type map that hold internal name along with display name that can be assigned
 */
var _populateAssignableParticipantTypeNameMap = function( data, selectedObject ) {
    // If input object is not valid then return empty map.
    if( !selectedObject || !selectedObject.uid || !data ) {
        return {};
    }
    var validTargetObject = cdm.getObject( selectedObject.uid );
    var participantTypes = [];
    // Get the assignable_participant_types property to populate participant type display names
    if( validTargetObject && validTargetObject.props.assignable_participant_types && validTargetObject.props.assignable_participant_types.dbValues ) {
        participantTypes = validTargetObject.props.assignable_participant_types.dbValues;
    }
    var participantTypeMap = new Object();
    // Iterate for all allowable participant types and iterate for populate the map.
    if( participantTypes && participantTypes.length > 0 ) {
        for( var idx = 0; idx < participantTypes.length; idx++ ) {
            var typeName = cmm.extractTypeNameFromUID( participantTypes[ idx ] );
            var uiValue = validTargetObject.props.assignable_participant_types.uiValues[ idx ];

            // Check if type name present in locale file then use that as dispaly value
            if( data.i18n && data.i18n[ typeName ] ) {
                uiValue = data.i18n[ typeName ];
            }
            // If uiValue is still null then use the internal name as display name
            if( !uiValue ) {
                uiValue = typeName;
            }
            participantTypeMap[ typeName ] = uiValue;
        }
    }
    return participantTypeMap;
};


/**
 * Populate the participant info map object
 * @param {Object} selectedObject Selected object for participant info need to be populated
 *
 * @returns {Object} Participant info map object for type and actual participant objects present.
 */
var _populateParticipantDataMap = function( selectedObject ) {
    // If input object is not valid then return empty map.
    if( !selectedObject || !selectedObject.uid ) {
        return {};
    }

    var validTargetObject = cdm.getObject( selectedObject.uid );
    var modelObjects = [];
    // Get all participant objects from input object if present and add to array so that it can be used.
    if( validTargetObject && validTargetObject.props.HasParticipant && validTargetObject.props.HasParticipant.dbValues ) {
        var hasParticipants = validTargetObject.props.HasParticipant.dbValues;

        for( var idx in hasParticipants ) {
            var modelObj = cdm.getObject( hasParticipants[ idx ] );
            modelObjects.push( modelObj );
        }
    }
    var existingParticipantMap = new Object();
    // Iterate for all participant objects and get the assignee and add to the map so that will hold participant type
    // correspond to these exisitng participants.
    _.forEach( modelObjects, function( modelObject ) {
        if( modelObject && modelObject.props && modelObject.props.assignee &&  modelObject.props.assignee.dbValues
            &&  modelObject.props.assignee.dbValues[ 0 ] ) {
            var assigneeUid = modelObject.props.assignee.dbValues[ 0 ];
            var assigneeProp = _.clone( modelObject.props.assignee );
            var assigneeObj = cdm.getObject( assigneeUid );
            // For group member we need to show user on table and for resource pool we will show
            // resource pool string.
            if( isOfType( assigneeObj, 'GroupMember' ) ) {
                assigneeProp = modelObject.props.fnd0AssigneeUser;
                var userDbValue = _getPropValue( modelObject, 'fnd0AssigneeUser' );
                if( !userDbValue ) {
                    userDbValue = assigneeUid;
                }
                assigneeUid = userDbValue;
            } else {
                var resourcepoolDispValue = _getPropValue( modelObject, 'object_string', true );
                assigneeProp.uiValues = [ resourcepoolDispValue ];
            }
            // Create the participant VMO object and add the assigneePropObject on it so that it
            // can be used while displaying it in table
            var participantVMOObject = viewModelObjectSvc.createViewModelObject( modelObject.uid );
            var dpTypeName = modelObject.type;
            var participantList = existingParticipantMap[ dpTypeName ];
            if( !participantList ) {
                participantList = [];
            }
            participantVMOObject.assigneePropObject = assigneeProp;
            if( participantVMOObject && participantList ) {
                participantList.push( participantVMOObject );
                existingParticipantMap[ dpTypeName ] = participantList;
            }
        }
    } );
    return existingParticipantMap;
};

/**
 * Populate the properties on participant object that need to be shown on table
 *
 * @param {Object} data Data view model object
 * @param {String} participantInternalName Participant type internal name
 * @param {String} participantDispName participant type display name
 * @param {Object} participantObject Participant object for properties need to be populated
 *
 * @returns {Object} Update participant object with properties
 */
var _populateRowProps = function( data, participantInternalName, participantDispName, participantObject ) {
    // Get the table columns that need to be shown in table and if null or empty then return from here.
    var tableColumns = data.participantTableColumns;
    if( !tableColumns || _.isEmpty( tableColumns ) ) {
        return participantObject;
    }

    // Clone the input participant object and add the table column properties on the VMO
    // to render it on table correctly
    var tempParticipantObject = _.clone( participantObject );

    // Iterate for all table columns and populate the properties on input VMO object
    // so that it can be shown in table.
    _.forEach( tableColumns, function( tableColumn ) {
        var vmProp = null;
        var dbValue = '';
        var uiValues = [];
        var propName = tableColumn.propName;
        // Check if assigneePropObject is present that means actual participant object exist and it's value need to be shown
        if( propName === 'participantValue' && participantObject.assigneePropObject && participantObject.assigneePropObject.dbValues &&
            participantObject.assigneePropObject.dbValues[ 0 ] && participantObject.assigneePropObject.uiValues ) {
            dbValue = participantObject.assigneePropObject.dbValues[ 0 ];
            uiValues = participantObject.assigneePropObject.uiValues;
        } else if( propName === 'participantName' &&  participantInternalName && participantDispName ) {
            dbValue = participantInternalName;
            uiValues = [ participantDispName ];
        } else if( propName === 'participantValue' && participantObject.isRequiredParticipant ) {
            dbValue = 'required';
            uiValues = [ data.i18n.required ];
        }
        // Create the view model property and add it to input VMO object
        vmProp = uwPropertySvc.createViewModelProperty( propName, tableColumn.propDisplayName, tableColumn.type,
            dbValue, uiValues );
        vmProp.dbValues = [ dbValue ];
        vmProp.uiValues = uiValues;
        participantObject.props[ propName ] = vmProp;
    } );
    return tempParticipantObject;
};

/**
 * Get the selection mode for input participant type and return the selection mode
 *
 * @param {Array} typeConstantValues Type constant values array
 * @param {String} participantType Participant type string for selection mode need to be fetched
 *
 * @returns {String} Selection type string for specific participant type
 */
var _getParticipantTypeConstant = function( typeConstantValues, participantType ) {
    var participantSelectionMode = 'single';
    if( !typeConstantValues || _.isEmpty( typeConstantValues ) || !participantType ) {
        return participantSelectionMode;
    }
    // Get the type constant value for specific participant type
    var typeConstant = _.find( typeConstantValues, function( typeConstant ) {
        return typeConstant.key && typeConstant.key.typeName === participantType;
    } );

    // Check if typeConstant is not null and it contains value then based on value return
    // the selection mode value
    if( typeConstant && typeConstant.value ) {
        if( typeConstant.value === 'false' ) {
            participantSelectionMode = 'single';
        } else if( typeConstant.value === 'true' ) {
            participantSelectionMode = 'multiple';
        }
    }
    return participantSelectionMode;
};

/**
 * Check if input participant is required or not.
 *
 * @param {Object} selectedObject Selected object for participant info need to be populated
 * @param {String} participantType Participant type string that need to be checked
 *
 * @returns {boolean} True/False based on participant type is required or not
 */
var _isRequiredParticipant = function( selectedObject, participantType ) {
    if( !selectedObject || !selectedObject.uid || !participantType ) {
        return false;
    }
    if( selectedObject.props && selectedObject.props.awp0RequiredParticipants
        && selectedObject.props.awp0RequiredParticipants.dbValues ) {
        var index = _.indexOf( selectedObject.props.awp0RequiredParticipants.dbValues, participantType );
        if( index >= 0 ) {
            return true;
        }
    }
    return false;
};

/**
 * Populate all participant VMO objects and return them that need to be shown in table
 * @param {Object} data Data view model object
 * @param {Object} selectedObject Selected object from UI
 * @param {Object} participantMap This hold the information for all participants present on select object
 * @param {Object} participantTypeMap This hold the information for all participant type along with it's display names
 * @param {Object} assignableParticipantTypeMap This hold the information for all participant type along with it's display names that can be assigned
 * @param {Array} supportedParticipantTypes Supported Participant types that selected object can support and need to be displayed
 *
 * @returns {Array} View model objects array that need to be shown on table
 */
var _populateParticipantRows = function( data, selectedObject, participantMap, participantTypeMap, assignableParticipantTypeMap, supportedParticipantTypes ) {
    var vmObjects = [];
    // Check if any required map is empty then return empty array
    if( !participantMap || !participantTypeMap || !supportedParticipantTypes ) {
        return {
            vmObjects : vmObjects,
            participantData : {
                assignableParticipantTypes : [],
                isParticipantTable : true,
                vmo: selectedObject
            }
        };
    }
    var validAssignableParticipantTypes = [];
    // Iterate for all supported types and check if it's valid and present in participantTypeMap
    // then process further either to create emtpy participant object or actual participant object.
    _.forEach( supportedParticipantTypes, function( participantType ) {
        if( participantTypeMap.hasOwnProperty( participantType ) ) {
            var modelObjects = participantMap[ participantType ];

            // Get the participant display name and if null then use the internal name only
            var participantDispName = participantTypeMap[ participantType ];
            if( !participantDispName ) {
                participantDispName = participantType;
            }

            // Get the selection mode based on participant type for single or multiple
            var participantSelectionMode = _getParticipantTypeConstant( data.typeConstantValues, participantType );

            if( !modelObjects || _.isEmpty( modelObjects ) ) {
                // As participant is not assigned then create empty VMO to represent that row in table
                var vmObject = viewModelObjectSvc.constructViewModelObjectFromModelObject( null, '' );
                vmObject.type = participantType;
                vmObject.uid = '';
                vmObject.isRequiredParticipant = _isRequiredParticipant( selectedObject, participantType );

                modelObjects = [];
                modelObjects.push( vmObject );
            }

            // Iterate for all participant objects and populate the required props for needed to show in table
            _.forEach( modelObjects, function( modelObject ) {
                if( participantSelectionMode ) {
                    modelObject.participantSelectionMode = participantSelectionMode;
                }
                // Participant type string on model object
                modelObject.participantType = participantType;
                var updatedObject = _populateRowProps( data, participantType, participantDispName, modelObject );
                vmObjects.push( updatedObject );
            } );

            // Check if assignableParticipantTypeMap is not empty and contains the participant type then check for
            // either participant need to be mutiple assignee or is not assined then only we need to add to array that will
            // be sued further. If participant type is not required but it's empty then also ad it to the list if it can be assigend
            if( assignableParticipantTypeMap && assignableParticipantTypeMap.hasOwnProperty( participantType )  && modelObjects && modelObjects[ 0 ]
                && ( modelObjects[ 0 ].participantSelectionMode === 'multiple' ||  modelObjects[ 0 ].isRequiredParticipant
                ||  !modelObjects[ 0 ].modelType ) ) {
                var assignableObject = {
                    propInternalValue : participantType,
                    propDisplayValue : participantDispName
                };
                validAssignableParticipantTypes.push( assignableObject );
            }
        }
    } );
    // Return the data that need to be used
    return {
        vmObjects : vmObjects,
        participantData : {
            assignableParticipantTypes : validAssignableParticipantTypes,
            isParticipantTable : true,
            vmo: selectedObject
        }
    };
};

/**
 * Populate all participant data that need to be shown for input selected object based on
 * participant types present in preference.
 * @param {Object} response Response object after getProperties SOA call
 * @param {Object} data Data view model object
 * @param {Object} ctx App context object
 * @param {Object} selectedObject Selected object for participant info need to be populated
 * @param {Array} supportedParticipantTypes1 All supported participant types
 *
 * @return {Object} Object that hold info for rows need to be shown
 */
export let populateParticipantData = function( response, data, ctx, selectedObject, supportedParticipantTypes1 ) {
    var vmObjects = [];
    var participantDataObj = null;
    var participantData = null;
    // Check if input response object is not null then populate all participant info and then create
    // the rows that need to be shown in the table.
    if( response ) {
        var supportedParticipantTypes = _populateSupportedParticipantTypes( selectedObject, ctx.preferences );
        var participantTypeMap = _populateParticipantTypeNameMap( data, selectedObject );
        var assignableParticipantTypeMap = _populateAssignableParticipantTypeNameMap( data, selectedObject );
        var existingParticipantMap = _populateParticipantDataMap( selectedObject );
        participantDataObj = _populateParticipantRows( data, selectedObject, existingParticipantMap, participantTypeMap, assignableParticipantTypeMap, supportedParticipantTypes );
        // Check if participant data object is not null then get the view model objects from it for row needs to be shown
        // and other assignable configration and thsi need to be return
        if( participantDataObj ) {
            vmObjects = participantDataObj.vmObjects;
            participantData = participantDataObj.participantData;
        }
    }

    // Apply the filters on the table
    if( data.columnProviders.participantTableColumnProvider.columnFilters &&
        data.columnProviders.participantTableColumnProvider.columnFilters[0] ) {
        vmObjects = wrkflwSortFilterSvc.filterTableData( data.columnProviders.participantTableColumnProvider.columnFilters, vmObjects );
    }

    // Apply the sorting on the table
    if( data.columnProviders.participantTableColumnProvider.sortCriteria &&
        data.columnProviders.participantTableColumnProvider.sortCriteria[ 0 ] ) {
        wrkflwSortFilterSvc.applyTableSort( data.columnProviders.participantTableColumnProvider.sortCriteria, vmObjects );
    }

    // Create the table load result and return
    var loadResult = tableDPReqRespHelper.createTableLoadResult( vmObjects.length );
    loadResult.searchResults = vmObjects;
    loadResult.searchIndex = -1;
    loadResult.totalFound = vmObjects.length;

    return {
        loadResult : loadResult,
        participantData : participantData
    };
};

/**
 * Get the participan table context data and return.
 *
 * @param {Object} contextData Context data
 * @returns {Object} Participant table context data
 */
export let populateContextData = function( contextData ) {
    return { ...contextData };
};

/**
 * Based on all selected objects and check if there is any valid participant object that can be
 * removed.
 * @param {Array} selectedObjects Selected objects array from UI
 * @param {Object} participantData Participant data object.
 * @returns {Object} Updated participant object with all info
 **/
export let evaluateSelections = function( selectedObjects, participantData ) {
    var isRemoveCmdVisible = false;
    if( selectedObjects && !_.isEmpty( selectedObjects ) ) {
        // Iterate for all selected objects and if selected object is of type Participant then
        // just return true from here as one object can be removed
        for( var idx = 0; idx < selectedObjects.length; idx++ ) {
            if( selectedObjects[ idx ] && isOfType( selectedObjects[ idx ], 'Participant' ) ) {
                isRemoveCmdVisible = true;
                break;
            }
        }
    }

    // Update the participant data on local context data and return that so that it will hold
    // correct info about selection and command if need to be visible or not.
    const localParticipantData = { ...participantData };
    localParticipantData.isRemoveCmdVisible = isRemoveCmdVisible;
    localParticipantData.selectedObjects = selectedObjects;
    return localParticipantData;
};

export default exports = {
    loadParticipantTableColumns,
    populateParticipantData,
    evaluateSelections,
    getParticipantConstantLoaded,
    loadParticipantConstantTypes,
    populateContextData
};
