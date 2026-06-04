// Copyright (c) 2022 Siemens

/**
 * @module js/userPanelService
 */
import AwPromiseService from 'js/awPromiseService';
import wrkflwUtils from 'js/Awp0WorkflowUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var exports = {};

var prefValue = null;

/**
 * Get the select object from provider from UI and add to the data
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Boolean} multiSelectEnabled - The multiple select enabled or not
 * @param {selection} Array - The selection object array
 */
export let addSelectedObject = function( selectedObjects, multiSelectEnabled, selection, subPanelContext ) {
    var deferred = AwPromiseService.instance.defer();
    var finalSelectedObjects = selectedObjects;
    if( !finalSelectedObjects ) {
        finalSelectedObjects = [];
    }
    if( selection ) {
        if( selection[ 0 ] && selection[ 0 ].type && selection[ 0 ].type === 'User' ) {
            multiSelectEnabled = false;
        }
        var searchCriteria = {};
        if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
            searchCriteria = subPanelContext.additionalSearchCriteria;
        }
        wrkflwUtils.getValidObjectsToAdd( searchCriteria, selection ).then( function( validObjects ) {
            // Check for if multiple selection is enabled then only add the selection
            // to list otherwise directly set the list. This is mainly needed when user
            // do one search and select some object using multiple select and then do another
            // search and select another object using CTRL key then both objects should be added
            if( multiSelectEnabled ) {
                _.forEach( validObjects, function( object ) {
                    // Check if same object is not exist in the list then only add it.
                    if( finalSelectedObjects && finalSelectedObjects.indexOf( object ) === -1 && !exports.objectIsInList( finalSelectedObjects, object ) ) {
                        // Check if project info is not present on that selected object then only set it based on
                        // project LOV selection else use existing project selection
                        var projectObject = null;
                        if( subPanelContext ) {
                            projectObject = subPanelContext.projectObject;
                        }
                        if( _.isUndefined( object.projectObject ) && !_.isUndefined( projectObject ) ) {
                            object.projectObject = projectObject;
                        }
                        var profileObject = null;
                        if( subPanelContext ) {
                            profileObject = subPanelContext.profileObject;
                        }
                        if( _.isUndefined( object.signoffProfile ) && !_.isUndefined( profileObject ) ) {
                            object.signoffProfile = profileObject;
                        }
                        finalSelectedObjects.push( object );
                    }
                } );
                var finalList = [];
                _.forEach( finalSelectedObjects, function( object ) {
                    // Check if same object is not exist in the list then only add it.
                    if( object.selected ) {
                        finalList.push( object );
                    }
                } );

                finalSelectedObjects = finalList;
            } else {
                finalSelectedObjects = [];
                if( validObjects && validObjects[ 0 ] ) {
                    // Check if project info is not present on that selected object then only set it based on
                    // project LOV selection else use existing project selection
                    var projectObject = null;
                    if( subPanelContext ) {
                        projectObject = subPanelContext.projectObject;
                    }
                    if( _.isUndefined( validObjects[ 0 ].projectObject ) && !_.isUndefined( projectObject ) ) {
                        validObjects[ 0 ].projectObject = projectObject;
                    }
                    var profileObject = null;
                    if( subPanelContext ) {
                        profileObject = subPanelContext.profileObject;
                    }
                    if( _.isUndefined( validObjects[ 0 ].signoffProfile ) && !_.isUndefined( profileObject ) ) {
                        validObjects[ 0 ].signoffProfile = profileObject;
                    }
                    finalSelectedObjects.push( validObjects[ 0 ] );
                }
            }
            if( subPanelContext ) {
                let newData = { ...subPanelContext.value };
                newData.selectedObjects = finalSelectedObjects;
                subPanelContext.update && subPanelContext.update( newData );
            }
            deferred.resolve( finalSelectedObjects );
        } );
    } else {
        //eventBus.publish( 'workflow.userPickerPanelSelection', { selectedObjects: finalSelectedObjects } );
        if( subPanelContext ) {
            let newData = { ...subPanelContext.value };
            newData.selectedObjects = finalSelectedObjects;
            subPanelContext.update && subPanelContext.update( newData );
        }
        deferred.resolve( finalSelectedObjects );
    }
    return deferred.promise;
};

export let objectIsInList = function( objectList, newObject ) {
    var objectFound = false;
    var localObjectList = objectList;
    if( !localObjectList ) {
        localObjectList = [];
    }
    for( var i = 0; i < localObjectList.length; i++ ) {
        var uid = objectList[ i ].uid;
        var newUid = newObject.uid;
        if( uid === newUid ) {
            objectFound = true;
            break;
        }
    }
    return objectFound;
};

/**
 * Get the select object from provider from UI and add to the data
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Boolean} multiSelectEnabled - The multiple select enabled or not
 * @param {selection} Array - The selection object array
 */
export let addObjects = function( data, multiSelectEnabled, selection ) {
    if( data && selection ) {
        if( !data.users ) {
            data.users = [];
        }
        if( !data.usersUids ) {
            data.userUids = [];
        }
        if( selection ) {
            data.users[ 0 ] = selection[ 0 ];
            data.userUids[ 0 ] = selection[ 0 ].props.user.dbValue;
        }
        if( data.dataProviders && data.dataProviders.getUsers ) {
            //update data provider
            data.dataProviders.getUsers.update( data.users, data.users.length );
            //clear selection
            data.dataProviders.getUsers.selectNone();
        }
    }
};

export let addUserObject = function( data, multiSelectEnabled, selection, subPanelContext ) {
    exports.addSelectionToMainPanel( data, multiSelectEnabled, selection, subPanelContext );
};


/**
 * Return if load filtered.
 *
 * @param {Object} isAll - To define that multi select mode is enabled or not
 *
 * @return {boolean} The boolean value to tell that multi select mode is enabled or not
 */

export let getMultiSelectMode = function( multiSelectMode, data ) {
    if( multiSelectMode && multiSelectMode === 'multiple' ) {
        return true;
    }
    return false;
};


/**
 * Get the select object from provider from UI and add to the data
 *
 * @param {data} data - The qualified data of the viewModel
 * @param {Boolean} multiSelectEnabled - The multiple select enabled or not
 * @param {selection} Array - The selection object array
 */
export let addSelectionToMainPanel = function( data, multiSelectEnabled, selection, subPanelContext ) {
    if( data && selection ) {
        data.selectedObjects = [];
        exports.addSelectedObject( data.selectedObjects, multiSelectEnabled, selection, subPanelContext ).then( function( selectedObjects ) {
            if( subPanelContext && subPanelContext.selectedObjects ) {
                let newData = { ...subPanelContext.value };
                newData.selectedObjects = selectedObjects;
                subPanelContext.update && subPanelContext.update( newData );
            }
            eventBus.publish( 'addSelectionToMainPanel', {
                selectedObjects: selectedObjects
            } );
        } );
    }
};


/**
 * Clear the selection for input data provider.
 *
 * @param {Object} data Data view model object
 * @param {Object} dataProvider Data provider object
 */
export let clearSelection = function( subPanelContext ) {
    if( subPanelContext ) {
        const newContext = { ...subPanelContext.value };
        newContext.selectedObjects = [];
        subPanelContext.update && subPanelContext.update( newContext );
    }
};

/**
 *
 * @param {Array} visibleTabs All visibel tab array
 * @param {Object} data Data view model object
 *
 * @returns {Object} Object that will hold all visible tabs along with API that need to be called
 *          when user swtich between the tabs.
 */
export let loadPanelTabs = function( visibleTabs, data ) {
    const tabChangeCallback = ( pageId, tabTitle ) => {
        let { dispatch } = data;
        let selectedTab = visibleTabs.filter( function( tab ) {
            return tab.pageId === pageId || tab.name === tabTitle;
        } )[ 0 ];

        dispatch( { path: 'data.activeTab', value: selectedTab } );
    };

    // Get the default selected tab and based on that we will show it as selected when open the panel
    let defaultTab = visibleTabs.filter( function( tab ) {
        return tab.selectedTab;
    } )[ 0 ];

    if( defaultTab ) {
        return {
            activeTab: defaultTab,
            visibleTabs: visibleTabs,
            api: tabChangeCallback
        };
    }

    return {
        visibleTabs: visibleTabs,
        api: tabChangeCallback
    };
};

/**
 * Get the active tab object based on input page id.
 *
 * @param {Array} visibleTabs All visible tab array on UI.
 * @param {String} pageId Selected tab page id that need to be shown.
 * @param {String} tabTitle Tab title that will be shown
 * @param {Object} subPanelContext Sub panel context that will hold all information for info
 *              need to be displayed on UI.
 * @returns {Object} Active tab object
 */
export let handleTabChange = function( visibleTabs, pageId, tabTitle, subPanelContext ) {
    let selectedTab = visibleTabs.filter( function( tab ) {
        return tab.pageId === pageId || tab.name === tabTitle;
    } )[ 0 ];
    if( subPanelContext ) {
        let newData = { ...subPanelContext.value };

        newData.selectedObjects = [];
        // Update the project id when user witch between the tabs and clear group
        // and role as well if profile and default group and role are not being used.
        // If additional search criteria is not present then we can initialize it
        // with empty object.
        if( !newData.additionalSearchCriteria ) {
            newData.additionalSearchCriteria = {};
        }
        newData.additionalSearchCriteria.projectId = '';
        newData.projectObject = null;
        if( !subPanelContext.profileObject && !subPanelContext.defaultGroupRole ) {
            newData.additionalSearchCriteria.group = '';
            newData.additionalSearchCriteria.role = '';
        }
        // Store the selected tab in subPanelContext and will be used if parent
        // component need some change when pageId got changed
        newData.pageId = pageId;
        subPanelContext.update && subPanelContext.update( newData );
    }
    return {
        activeTab: selectedTab
    };
};

/**
 *
 * @param {String} panelId Panel id string
 * @returns {String} Active panel id string.
 */
export let setActiveView = function( panelId ) {
    return panelId;
};

/**
 *
 * @param {String} defaultProvider Default provider name
 * @param {String} newResourceProvider New provider name that need to be used
 * @returns {String} Resource provider that will get the content from server.
 */
export let getResourceProviderName = function( defaultProvider, newResourceProvider ) {
    return newResourceProvider ? newResourceProvider : defaultProvider;
};

/**
 * Get the content type based on input values and return.
 *
 * @param {Object} subPanelContext Subpanelcontext that holds all information
 * @param {boolean} showUniqueUsers True or false based on unique users need to be shown or not.
 * @param {String} resourceProviderContentType Content type string
 *
 * @returns {String} Content type string to get the content from servers.
 */
const _getResourceProviderContentType = function( subPanelContext, showUniqueUsers, resourceProviderContentType ) {
    let providerName = resourceProviderContentType;
    if( showUniqueUsers ) {
        providerName = 'UniqueUsers';
    }
    // Based on isFnd0ParticipantEligibility value if we need to handle participant eligblity then we use
    // other content type and same for resource pool and unique users as well.
    if( subPanelContext && subPanelContext.isFnd0ParticipantEligibility ) {
        if( providerName === 'Users' ) {
            providerName = 'ParticipantEligibilityUsers';
        } else if( providerName === 'NewResourcepool' ) {
            providerName = 'ParticipantEligibilityResPools';
        } else if( providerName === 'UniqueUsers' ) {
            providerName = 'ParticipantEligibilityUniqueUsers';
        }
    }
    return providerName;
};

/**
 *
 * @param {Object} subPanelContext Sub panel context that hold information to be used to get content from server
 * @param {String} searchString Search string that need to be pass to server
 * @param {String} resourceProviderContentTypeName Resource provider content type
 * @param {boolean} showUniqueUsers True or false based on we need to show unique users or not.
 *
 * @returns {Object} Search criteria object that will be pass to SOA call
 */
export let getSearchCriteria = function( subPanelContext, searchString, resourceProviderContentTypeName, showUniqueUsers ) {
    var searchCriteria = {};
    // Get the content type to get the contents.
    const resourceProviderContentType = _getResourceProviderContentType( subPanelContext, showUniqueUsers, resourceProviderContentTypeName );
    searchCriteria.resourceProviderContentType = resourceProviderContentType;
    if( searchString ) {
        searchCriteria.searchString = searchString;
    }
    var additionalSearchCriteria = {};

    // Initialize the additionalSearchCriteria from the information present on sub panel context.
    if( subPanelContext && subPanelContext.additionalSearchCriteria ) {
        additionalSearchCriteria = subPanelContext.additionalSearchCriteria;
    }

    // Check if additional search criteria exist on the scope then use that as well
    // so merge it with existing search criteria and then pass it to server
    if( additionalSearchCriteria ) {
        // Iterate for all entries in additional search criteria and add to main search criteria
        for( var searchCriteriaKey in additionalSearchCriteria ) {
            if( additionalSearchCriteria.hasOwnProperty( searchCriteriaKey ) ) {
                searchCriteria[ searchCriteriaKey ] = additionalSearchCriteria[ searchCriteriaKey ];
            }
        }
    }

    // In case of provider content type is user then we don't need to
    // pass group and role if any filtering present. Fix for defect # LCS-213616 and defect # LCS-541525
    // We don't need to clear the group and role from search criteria if profile is being used.
    if( resourceProviderContentType === 'UniqueUsers' && ( !subPanelContext || !subPanelContext.profileObject ) ) {
        searchCriteria.group = '';
        searchCriteria.role = '';
    }
    return searchCriteria;
};

/**
 * Update the data provider selection mode in case user switch between users and group members
 * using the show users widget from UI.
 *
 * @param {Object} dataProvider Data provider for selection need to be set.
 * @param {boolean} showUsers True/False based on user is seeing only users or group members
 * @param {Object} subPanelContext Sub panel context object which stores the initial selection mode
 */
export let setDataProviderSelectionMode = function( dataProvider, showUsers, subPanelContext ) {
    if( dataProvider ) {
        var mode = getMultiSelectMode( subPanelContext.selectionModelMode );
        var selectionMode = 'multiple';
        if( !mode || showUsers ) {
            mode = false;
            selectionMode = 'single';
        }
        var selectionModel = dataProvider.selectionModel;
        // Check if selection mode is differnet then initial selection mode then we need to
        // update the selection mode on data provider.
        if( selectionModel && selectionModel.mode !== selectionMode ) {
            dataProvider.selectionModel.setMultiSelectionEnabled( mode );
            dataProvider.selectionModel.setMode( selectionMode );
        }
    }
};


/**
 * This factory creates a service and returns exports
 *
 * @member userPanelService
 */

export default exports = {
    addSelectedObject,
    objectIsInList,
    addObjects,
    addUserObject,
    getMultiSelectMode,
    addSelectionToMainPanel,
    clearSelection,
    loadPanelTabs,
    handleTabChange,
    setActiveView,
    getResourceProviderName,
    getSearchCriteria,
    setDataProviderSelectionMode
};
