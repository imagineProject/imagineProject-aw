// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0UserPanelGroupRoleWidgetService
 */
import appCtxSvc from 'js/appCtxService';
import tcDataMgmtService from 'js/tcDataManagementService';
import listBoxService from 'js/listBoxService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';

/**
  * Define public API
  */
var exports = {};

/**
 * Get the input obejct property and return the internal or display value.
 *
 * @param {Object} modelObject Model object whose propeties need to be loaded
 * @param {String} propName Property name that need to be checked
 * @param {boolean} isDispValue Display value need to be get or internal value
 *
 * @returns {Array} Property internal value or display value
 */
var _getPropValue = function( modelObject, propName, isDispValue ) {
    var propValue = null;
    if( modelObject && modelObject.props[ propName ] ) {
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
 * Check for if default value need to be added then return true else return false.
 *
 * @param {Object} subPanelContext SubPanelContext object that have all info that need to be used for validation.
 * @param {String} filterContent Filter content string
 * @param {Object} prop Property object for value is being added
 *
 * @returns {boolean} True/False based on default value need to be added or not.
 */
var _isDefaultLOVValueExist = function( subPanelContext, filterContent, prop ) {
    if( subPanelContext && !subPanelContext.isFnd0ParticipantEligibility ) {
        return true;
    }
    var participantGroupRoleMap = null;
    if( subPanelContext && subPanelContext.participantGroupRoleMap ) {
        participantGroupRoleMap = subPanelContext.participantGroupRoleMap;
    }
    if( !filterContent || !prop ) {
        return false;
    }
    // Check if participantGroupRoleMap is not empty and filterCOntent that will be group or role
    // selected from UI is present in this list and is present in map and value is default then we
    // need to show All Groups or All Roles in respective widgets.
    if( participantGroupRoleMap && !_.isEmpty( participantGroupRoleMap ) ) {
        if( participantGroupRoleMap[ filterContent ] && participantGroupRoleMap[ filterContent ] === 'default' ) {
            return true;
        }

        // Check for in case of sub groups where '.' present in name then split with last value and check if for this
        // we need to show default value or not.
        var splitGroupString = filterContent.split( '.' );
        if( splitGroupString && splitGroupString.length > 0 && splitGroupString[ splitGroupString.length - 1] ) {
            var topGroupname = splitGroupString[ splitGroupString.length - 1];
            if( topGroupname && participantGroupRoleMap[ topGroupname ]  && participantGroupRoleMap[ topGroupname ] === 'default' ) {
                return true;
            }
        }
    }
    return false;
};

/**
 * Based on latest selection from group or role check if previous value is valid for new valid values then
 * return that value as it's still valid for new selection. If that is not valid then get the 0thindex value
 * from new array and return that.
 *
 * @param {Array} selectedLovEntries Previous selected LOV entry array
 * @param {Array} lovEntries Latest group or role LOV values array
 *
 * @returns {Object} LOV entry that need to be pre select.
 */
var _getValidPreSelectLOV = function( selectedLovEntries, lovEntries ) {
    if( ( !selectedLovEntries || !selectedLovEntries[ 0 ] ) && lovEntries && lovEntries[ 0 ] ) {
        return lovEntries[ 0 ];
    }
    var oldSelValue = null;
    if( selectedLovEntries && selectedLovEntries[ 0 ] ) {
        oldSelValue = selectedLovEntries[ 0 ];
    }
    // Check if previous selected value is not null and present if new LOV entries then return
    // that value
    if( oldSelValue && oldSelValue.propInternalValue && lovEntries && lovEntries.length > 0 ) {
        var previousSelUid = oldSelValue.propInternalValue.uid;
        return _.find( lovEntries, function( lovEntry ) {
            return  lovEntry.propInternalValue && previousSelUid === lovEntry.propInternalValue.uid;
        } );
    }
    return null;
};


/**
 * Get the search criteria based on content type and other parameters and return it.
 *
 * @param {String} contentType Content type string that will be group or role
 * @param {Object} subPanelContext SubPanelContext object that will contain additional
 *        search criteria that need to be used to get the content. If case of group LOV
 *        we need to use role and in case of role we need to use group.
 * @param {Object} prop Property object for content need to be loaded.
 * @returns {Object} Search criteria obejct that will be used in SOA to get the proeprty contents.
 *
 */
var _getSearchCriteria = function( contentType, subPanelContext, prop ) {
    var searchCriteria = { resourceProviderContentType: contentType };
    var filterContent = null;
    if( contentType === 'Group' ) {
        //change the contentType to get only the eligible group from the data provider if eligibilty constatnt is true
        if( subPanelContext && subPanelContext.isFnd0ParticipantEligibility ) {
            searchCriteria.resourceProviderContentType = 'ParticipantEligibilityGroup';
        }
        if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
            if( subPanelContext.additionalSearchCriteria.role ) {
                filterContent = subPanelContext.additionalSearchCriteria.role;
                searchCriteria.role = filterContent;
            }
            searchCriteria.participantType = subPanelContext.additionalSearchCriteria.participantType;
        }
    } else if( contentType === 'Role' ) {
        //change the contentType to get only the eligible group from the data provider if eligibilty constatnt is true
        if( subPanelContext && subPanelContext.isFnd0ParticipantEligibility ) {
            searchCriteria.resourceProviderContentType = 'ParticipantEligibilityRole';
        }
        if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
            if( subPanelContext.additionalSearchCriteria.group ) {
                filterContent = subPanelContext.additionalSearchCriteria.group;
                searchCriteria.group = filterContent;
            }
            searchCriteria.participantType = subPanelContext.additionalSearchCriteria.participantType;
        }
    }

    // Check if property object is not null and filter string is present and value is updated
    // then get the filter string and add it to search criteria.
    if( prop && prop.filterString && prop.valueUpdated ) {
        searchCriteria.searchString = prop.filterString;
    }
    return {
        searchCriteria,
        filterContent
    };
};

/**
 * Populate the respective input widget group or role values based on input criteria.
 *
 * @param {String} contentType Content type liek Group or Role that need to be populated
 * @param {Object} subPanelContext SubPanelCOntext obejct that stores all info like selected group or role.
 * @param {Object} prop Property for value needs to be populated
 * @param {int} startIndex Start index value
 * @param {String} defaultString Default string that need to be added like All Groups or All Roles.
 *
 * @returns {Object} Return all property values along with other parameters like end index or more values present
 *           or not.
 */
export let performGroupRoleLOVSearch = function( contentType, subPanelContext, prop, startIndex, defaultString ) {
    const localProp = { ...prop };
    // Get the search criteria that will be pass to server based on content type and subPanelContext
    var searchCriteriaObject = _getSearchCriteria( contentType, subPanelContext, prop );
    if( !searchCriteriaObject ) {
        searchCriteriaObject = {};
    }
    var searchCriteria = searchCriteriaObject.searchCriteria;
    if( !searchCriteria ) {
        searchCriteria = {};
    }

    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0ResourceProvider',
            searchCriteria: searchCriteria,
            cursor: {
                startIndex: startIndex,
                endReached: false,
                startReached: false,
                endIndex: 0
            },
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Alphabetical'
        }
    };

    // Call SOA to get the property values
    return tcDataMgmtService.basePerformSearchViewModel( inputData ).then( function( response ) {
        var lovEntries = [];
        var endIndex = 0;
        var moreValuesExist = false;
        var isDataProviderReloadNeeded = false;
        // Check if response is not null and searchResultsJSON present then we can get the values
        // from response and return the values
        if( response && response.searchResultsJSON ) {
            var modelObjects = [];
            let searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if( searchResults && searchResults.objects ) {
                _.forEach( searchResults.objects, ( object ) => {
                    modelObjects.push( object );
                } );
            }

            // Check if model objects are not null and not empty then we need to check additionaly that
            // do we need to add default value to LOV or not and if need to add then add it 0th index
            // else we need to show the values to list directly.
            if( modelObjects && !_.isEmpty( modelObjects ) ) {
                // Filter content will be applied group name in case of role and role name in case of group
                if( _isDefaultLOVValueExist( subPanelContext, searchCriteriaObject.filterContent, prop ) && startIndex <= 0 ) {
                    lovEntries = listBoxService.createListModelObjectsFromStrings( [ defaultString ] );
                    localProp.isDefaultValueNeeded = true;
                }
                // Create the list model object that will be displayed
                var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
                Array.prototype.push.apply( lovEntries, groups );
            }

            // Check if preSelected on property is true that means for specific participant type participant
            // eligblity constant value is set and this flag will be set to true only when user select the
            // valid value on other property and this call being made to reflect the correct property value
            // for this LOV property as well.
            if( localProp && localProp.preSelected ) {
                localProp.preSelected = false;
                var preSelectLOV = _getValidPreSelectLOV( localProp.selectedLovEntries, lovEntries );
                // Check if previous selected LOV is not valid for new criteria and lov entries are present
                // then use the 0th index lov value to preselect.
                if( !preSelectLOV && lovEntries[ 0 ] ) {
                    preSelectLOV = lovEntries[ 0 ];
                }
                if( preSelectLOV ) {
                    localProp.dbValue = preSelectLOV.propInternalValue;
                    localProp.dbOriginalValue = preSelectLOV.propInternalValue;
                    localProp.uiValue = preSelectLOV.propDisplayValue;
                    localProp.value = preSelectLOV.propDisplayValue;
                    var propValue = '';
                    var propName = null;
                    if( contentType === 'Role' ) {
                        propName = 'role';
                    } else {
                        propName = 'group';
                    }
                    // Based on content type we need get the correct property value and
                    // add it to subPanelContext so that it will show the correct users
                    if( propName === 'role' && preSelectLOV.propInternalValue && preSelectLOV.propInternalValue.uid ) {
                        propValue = _getPropValue( preSelectLOV.propInternalValue, 'role_name', false );
                    } else if( propName === 'group' && preSelectLOV.propInternalValue && preSelectLOV.propInternalValue.uid ) {
                        propValue = _getPropValue( preSelectLOV.propInternalValue, 'object_full_name', false );
                    }
                    // Update the subpanelContext value based on group or role property.
                    if( subPanelContext && subPanelContext.additionalSearchCriteria && propValue !== undefined ) {
                        const newContext = { ... subPanelContext.value };
                        newContext.additionalSearchCriteria[ propName ] = propValue;
                        subPanelContext.update && subPanelContext.update( newContext );
                    }
                    // This variable is set to true and it's mainly used in case of participant eligblity cosntant value
                    // set then when user select some group then resptive value need to be loaded and then we set this parameter
                    // and this will be used to reload the data provider so that it can show correct users.
                    isDataProviderReloadNeeded = true;
                }
            }

            // Populate the end index and more values present or not
            var endIndex = response.cursor.endIndex;
            var moreValuesExist = !response.cursor.endReached;
            if( endIndex > 0 && moreValuesExist ) {
                endIndex += 1;
            }
        }
        return {
            lovEntries : lovEntries,
            endIndex : endIndex,
            moreValuesExist : moreValuesExist,
            propObject: localProp,
            isDataProviderReloadNeeded : isDataProviderReloadNeeded
        };
    } );
};

/**
 * Validate selection for group or role LOV and if it is valid, use the selection to filter user data
 *
 * @param {String} contentType Object type for which properties needs to be populated
 * @param {data} subPanelContext Context data that store role or group valid value based on that
 *        content will be shown in list.
 * @param {Object} propObj Property object where change is happening
 * @param {Object} otherPropObject Other property that need to be updated only in case of multi participant.
 * @param {Object} selected selected object if any, else null.
 * @param {String} suggestion Filter string value if filter string does not match any object.
 * @param {String} defaultValue Default value for group or role LOV.
 *
 * @returns {Object} The object contains selection validity result.
 */
export let validateSelection = function( contentType, subPanelContext, propObj, otherPropObject, selected, suggestion, defaultValue ) {
    var valid = true;
    let isValueUpdated = false;
    var searchContextPropName = null;
    var searchContextPropValue = '';
    const propObject = { ...propObj };
    const otherLOvProp = { ...otherPropObject };

    // Get the property name that need to be modified on context data to reflect content
    if( contentType === 'Group' ) {
        searchContextPropName = 'group';
    } else {
        searchContextPropName = 'role';
    }

    // Check if value is not valid then set the valid to false
    if( suggestion ||  selected.length > 0 && selected[0] && ( selected[0].propInternalValue === ''
        && !selected[0].propInternalValue.uid && selected[ 0 ].propInternalValue !== defaultValue ) ) {
        valid = false;
    } else {
        var selectedLOV = selected[ 0 ];
        // Get the property value that user is selecting from UI so that it can be updated on context data.
        if( contentType === 'Group' && selectedLOV && selectedLOV.propInternalValue && selectedLOV.propInternalValue.uid ) {
            searchContextPropValue = _getPropValue( selectedLOV.propInternalValue, 'object_full_name' );
        } else if( selectedLOV && selectedLOV.propInternalValue && selectedLOV.propInternalValue.uid ) {
            searchContextPropValue = _getPropValue( selectedLOV.propInternalValue, 'role_name' );
        }
    }

    // Check if context has some search criteria already present then we need to get it's old value
    // and compare it with new value and if value is changed then only update the values on context
    // or if both values are same then don't update details on context.
    if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
        var oldValue = subPanelContext.additionalSearchCriteria[ searchContextPropName ];

        if( oldValue !== searchContextPropValue ) {
            const newContext = { ... subPanelContext.value };
            newContext.additionalSearchCriteria[ searchContextPropName ] = searchContextPropValue;
            isValueUpdated = true;
            subPanelContext.update && subPanelContext.update( newContext );
        }

        // Use case - If previous selected value is valid but new value is invalid then
        // in that case if isFnd0ParticipantEligibility is true then we need to empty
        // the property value and if isFnd0ParticipantEligibility is false then also
        // we need to select the 0th index value that will be All Groups or All Roles.

        // If participant eligblity constant value is set and selected value is valid
        // then only set preSelected to other property to true so that it can load the
        // other proeprty value and then it will refresh the user content.
        if( subPanelContext.isFnd0ParticipantEligibility && isValueUpdated && valid ) {
            otherLOvProp.preSelected = true;
        }
    }
    return {
        valid: valid,
        propObject : propObject,
        isValueUpdated : isValueUpdated,
        otherPropObject : otherLOvProp
    };
};

/**
 * Reset the property widget value.
 * @param {Object} propObject Property object that need to be reset.
 * @param {String} defaultValue Default value that need to be set on LOV.
 *
 * @returns {Object} Updated property widget
 */
export let resetLOVProp = function( propObject, defaultValue ) {
    const localPropObject = { ...propObject };
    var propValue = defaultValue;
    if( localPropObject && !localPropObject.isDefaultValueNeeded ) {
        propValue = '';
    }
    localPropObject.dbValue = propValue;
    localPropObject.uiValue = propValue;
    return localPropObject;
};

/**
 * Clear group or role property.
 * @param {Object} data Data view model object
 * @returns {Object} Object to hold group and role property
 */
var _clearAllProperties = function( data ) {
    if( !data ) {
        return;
    }
    let newGroupProp = null;
    let newRoleProp = null;

    // Check if group property is not null then only clone it and set the values to empty
    // like in case of user tab these widgets are present but in case of resource pool tab
    // these widgets will not be present and do the same for role lov as well.
    if( data.allGroups ) {
        newGroupProp = { ...data.allGroups };
        // Check if disabledGroup is not true then we need to reset to default values. This variable
        // will be true like only specific group and role can be added then we don't allow editing group
        // and role values. Same is doing for role widget as well.
        if( !data.disabledGroup ) {
            newGroupProp.dbValue = '';
            newGroupProp.uiValue = '';
            newGroupProp.dbOriginalValue = null;
            newGroupProp.selectedLovEntries = [];
        }
    }

    if( data.allRoles ) {
        newRoleProp = { ...data.allRoles };
        if( !data.disabledRole ) {
            newRoleProp.dbValue = '';
            newRoleProp.uiValue = '';
            newRoleProp.selectedLovEntries = [];
            newRoleProp.dbOriginalValue = null;
        }
    }
    return {
        allGroups : newGroupProp,
        allRoles : newRoleProp
    };
};


/**
 * Clear the widgets and reload the provider.
 *
 * @param {Object} data Data view model object
 * @param {Object} subPanelContext Context object
 *
 * @returns {Object} Updated property object
 */
export let clearAllProperties = function( data, subPanelContext ) {
    var updatedPropObject = _clearAllProperties( data );

    // Reset the values on subPanelContext object as well so that it can show
    // correct results when user press the clear button.
    if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
        const localSubPanelContext = { ...subPanelContext.value };
        if( !localSubPanelContext.profileObject ) {
            // reset the group and role values on context when group and role
            // widget are not disabled.
            if( !data || data && !data.disabledGroup ) {
                localSubPanelContext.additionalSearchCriteria.group = '';
            }
            if( !data || data && !data.disabledRole ) {
                localSubPanelContext.additionalSearchCriteria.role = '';
            }
        }
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
    return updatedPropObject;
};

/**
 * Return the updated show users property value based on preference name WRKFLW_user_panel_content_display.
 * @param {Object} propObject Property object
 * @returns {Object} Updated proeprty object.
 *
 */
var _getShowGroupRoleUserProp = function( propObject ) {
    if( !propObject ) {
        return propObject;
    }

    var propValue = false;
    // Based on preference value we set the proeprty value and return the updated proeprty.
    if( appCtxSvc.ctx.preferences && appCtxSvc.ctx.preferences.WRKFLW_user_panel_content_display && ( appCtxSvc.ctx.preferences.WRKFLW_user_panel_content_display[ 0 ] === '1' ||
        appCtxSvc.ctx.preferences.WRKFLW_user_panel_content_display[ 0 ] === '0' ) ) {
        propValue = true;
    }
    const showUsersProp = { ...propObject };
    showUsersProp.dbValue = propValue;
    return showUsersProp;
};

/**
 * Populate all property values from subPanelContext and return the updated property values.
 *
 * @param {Object} data Data view model object
 * @param {Object} subPanelContext SubPanelContext that hold all info from which proeprty need
 *                 to be populated.
 * @returns {Object} Object that hold updated property along with they will be enabled or not.
 */
export let populateInitialPropData = function( data, subPanelContext ) {
    var disabledGroup = false;
    var disabledRole = false;
    var defaultGroupValue = data.i18n.allGroups;
    var defaultRoleValue = data.i18n.allRoles;
    var displayedGroupName = '';
    var displayedRoleName = '';

    // this check was only for profile case, added fnd0Eligibilty condition
    if( subPanelContext && subPanelContext.additionalSearchCriteria && subPanelContext.additionalSearchCriteria.group && !subPanelContext.isFnd0ParticipantEligibility ) {
        defaultGroupValue = subPanelContext.additionalSearchCriteria.group;
        disabledGroup = true;
        // Set the group value on data to support filtering in LOV. Fix for defect # LCS-223295
        //data.groupName = defaultGroupValue;
        if ( subPanelContext.additionalSearchCriteria.displayedGroup ) {
            displayedGroupName = subPanelContext.additionalSearchCriteria.displayedGroup;
            // Check if displayedGroupName is not null and ends with '++' then we need
            // to sub string and show the actual group name in group LOV.
            if( displayedGroupName &&  _.endsWith( displayedGroupName, '++' ) ) {
                var idx = displayedGroupName.indexOf( '++' );
                displayedGroupName = displayedGroupName.substring( 0, idx ).trim();
            }
        } else {
            displayedGroupName = defaultGroupValue;
        }
    }

    // Populate the group proeprty value
    const groupProp = { ...data.allGroups };
    groupProp.dbValue = defaultGroupValue;
    groupProp.uiValue = displayedGroupName;

    // this check was only for profile case, added fnd0Eligibilty condition
    if( subPanelContext && subPanelContext.additionalSearchCriteria && subPanelContext.additionalSearchCriteria.role && !subPanelContext.isFnd0ParticipantEligibility ) {
        defaultRoleValue = subPanelContext.additionalSearchCriteria.role;
        disabledRole = true;
        // Set the role value on data to support filtering in LOV. Fix for defect # LCS-223295
        //data.roleName = defaultRoleValue;

        if ( subPanelContext.additionalSearchCriteria.displayedRole ) {
            displayedRoleName = subPanelContext.additionalSearchCriteria.displayedRole;
        } else {
            displayedRoleName = defaultRoleValue;
        }
    }

    // Populate the role proeprty value
    const roleProp = { ...data.allRoles };
    roleProp.dbValue = defaultRoleValue;
    roleProp.uiValue = displayedRoleName;

    // Populate the show users with group and role checkbox property
    const showUsersProp = _getShowGroupRoleUserProp( data.showUsersWithoutGroupRole );
    return {
        allGroups : groupProp,
        allRoles : roleProp,
        disabledRole : disabledRole,
        disabledGroup : disabledGroup,
        showUsersProp : showUsersProp
    };
};

/**
 * Reset group , role and filter box prperty and update the subPanelContext as well.
 *
 * @param {Object} data Data view model object.
 * @param {Object} filterProp Filter proeprty that need to be reset.
 * @param {Object} subPanelContext SubPanelCOntext that need to be updated when we reset.
 * @returns {Object} Updated property object
 */
export let resetPanelProps = function( data, filterProp, subPanelContext ) {
    var updatedPropObject = _clearAllProperties( data );
    // Get the filter property and reset to default value that is empty and this needs
    // to be done when panel is pinned. Check if there is any value present in filter box
    // then in that case we don't need to relaod the data provider specifically and it will
    // be done automatically when we reset the value to empty and it will call data provider
    // initialize again.
    const localFilterProp = { ...filterProp };
    if( localFilterProp && localFilterProp.dbValue && !_.isEmpty( localFilterProp.dbValue )  ) {
        localFilterProp.dbValue = '';
    }
    updatedPropObject.filterProp = localFilterProp;
    // Reset the values on subPanelContext object as well so that it can show
    // correct results when panel is getting relaoded. It shoudl clear the selection
    if( subPanelContext  ) {
        const localSubPanelContext = { ...subPanelContext.value };
        localSubPanelContext.selectedObjects = [];
        subPanelContext.update && subPanelContext.update( localSubPanelContext );
    }
    return updatedPropObject;
};

export default exports = {
    performGroupRoleLOVSearch,
    validateSelection,
    resetLOVProp,
    clearAllProperties,
    populateInitialPropData,
    resetPanelProps
};
