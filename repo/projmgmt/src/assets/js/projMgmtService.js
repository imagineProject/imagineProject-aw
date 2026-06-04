// Copyright (c) 2022 Siemens

/**
 * @module js/projMgmtService
 */
import uwPropSvc from 'js/uwPropertyService';
import localStrg from 'js/localStorage';
import localeService from 'js/localeService';
import appCtxService from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import tcVmoService from 'js/tcViewModelObjectService';
import AwStateService from 'js/awStateService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import awSearchService from 'js/awSearchService';
import tableSvc from 'js/splmTablePublishedService';

var exports = {};

var _columnDefns = [];
var localTextBundle;
const PROJECT_SESSION_OUT_LISTENER = 'projectSessionOutListener';
/**
 * Load the column configuration
 *
 * @param {Object} dataprovider - the data provider
 *
 */
function initColumns() {
    var projMgmtTextBundle = _getLocalTextBundle();
    _columnDefns = [ {
        name: 'icon',
        displayName: '',
        maxWidth: 30,
        minWidth: 30,
        width: 30,
        enableColumnMenu: false,
        pinnedLeft: true
    }, {
        propertyName: 'object_string',
        typeName: 'TC_Project',
        isTableCommand: true,
        modifiable: false
    }, {
        propertyName: 'object_name',
        typeName: 'TC_Project'
    }, {
        propertyName: 'project_id',
        typeName: 'TC_Project'
    }, {
        propertyName: 'fnd0ProjectCategory',
        typeName: 'TC_Project'
    }, {
        propertyName: 'is_active',
        typeName: 'TC_Project'
    }, {
        propertyName: 'use_program_security',
        displayName : projMgmtTextBundle.useProgramSecurity,
        typeName: 'TC_Project',
        renderingHint: 'triState',
        cellRenderers:[ securityCellRenderer() ]
    }, {
        propertyName: 'owning_user',
        typeName: 'WorkspaceObject'
    }
    ];
}

/**
 * Show use_program_security boolean property as listbox.
 */
let securityCellRenderer = () => {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            // Create root element
            if( vmo.props && vmo.props[column.field] ) {
                var newProp = updateSecurityProp( vmo.props[column.field] );
                vmo.props[column.field] = newProp;
                const cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
                // Apply onClick listener to handle editing
                cellContent.onclick = function() {
                    var updatedProp = updateSecurityProp( vmo.props[column.field] );
                    vmo.props[column.field] = updatedProp;
                };
                return cellContent;
            }
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return true;
        }
    };
};
/**
 * Load the column configuration
*/
export let loadColumns = function(  ) {
    if( _.isEmpty( _columnDefns ) ) {
        initColumns();
        var type = cmm.getType( 'TC_Project' );
        _.forEach( _columnDefns, function( columnDef ) {
            if( type && type.propertyDescriptorsMap[ columnDef.name ] && !columnDef.displayName ) {
                columnDef.displayName = type.propertyDescriptorsMap[ columnDef.name ].displayName;
            }
        } );
    }
    return {
        columnConfig : {
            columns: _columnDefns
        }
    };
};

export let getSortCriteria = function( sortCriteria ) {
    var criteria = _.clone( sortCriteria );
    if( !_.isEmpty( criteria ) &&  criteria[ 0 ].fieldName.indexOf( '.' ) === -1  ) {
        criteria[ 0 ].fieldName = 'ItemRevision.' + criteria[ 0 ].fieldName;
    }

    return criteria;
};

/**
 * registerSignOutListener - to clear the table expansion state
 */
export let registerSignOutListener = function(  ) {
    //registerSignOutListener - to clear the table expansion state of project team members
    if( !appCtxService.getCtx( PROJECT_SESSION_OUT_LISTENER ) ) {
        appCtxService.registerCtx( PROJECT_SESSION_OUT_LISTENER, eventBus.subscribe( 'session.signOut', function() {
            let allLocalStates = localStrg.get( 'awTreeTableState' );
            let allLocalStatesJson = JSON.parse( allLocalStates );
            var projectTeamTableTree = 'Aut0ProjectTeamTableTree';

            if( allLocalStatesJson && allLocalStatesJson[projectTeamTableTree] ) {
                delete allLocalStatesJson[ projectTeamTableTree ];
            }
            if( allLocalStatesJson ) {
                let stringToPersist = JSON.stringify( allLocalStatesJson );

                localStrg.publish( 'awTreeTableState', stringToPersist );
                let _sessionOutListener = appCtxService.getCtx( PROJECT_SESSION_OUT_LISTENER );
                if( _sessionOutListener ) {
                    eventBus.unsubscribe( _sessionOutListener );
                    appCtxService.unRegisterCtx( PROJECT_SESSION_OUT_LISTENER );
                }
            }
        }
        ) );
    }
};

/**
 * gets local text bundle
 * @returns {Object} text bundle
 */
var _getLocalTextBundle = function() {
    if( !localTextBundle ) {
        var resource = 'ProjmgmtConstants';
        localTextBundle = localeService.getLoadedText( resource );
    }
    return localTextBundle;
};

/**
 * This method is to render the "Use Program Security" as radio button
 * Security :  O Project    O Program
 *
 * Once saved display as , Security : Project
 *
 * @param {prop} securityProp property from selected object
 */
export let changeUseProgramSecurityDisplay = function( xrtState ) {
    let newXrtState = { ...xrtState.getValue() };
    let newSecurityProp = { ...newXrtState.xrtVMO.props.useProgramSecurity };
    newSecurityProp = updateSecurityProp( newSecurityProp );
    newXrtState.xrtVMO.props.useProgramSecurity = newSecurityProp;
    xrtState.update( newXrtState );
};

/**
 * This method will make the Visible property as uneditable if the "active" is true.
 * "Active & Invisible" is not correct option.Restrict the user to save this combination.
 * @param {data} data appCtxContext object
 */
export let changeActiveVisible = function( xrtState ) {
    let newXrtState = { ...xrtState.getValue() };
    let newIsVisibleProp = { ...newXrtState.xrtVMO.props.isVisible };

    if( newXrtState.xrtVMO.props.isActive.dbValue ) {
        uwPropSvc.setValue( newIsVisibleProp, true );
    }

    newXrtState.xrtVMO.props.isVisible = newIsVisibleProp;
    xrtState.update( newXrtState );
};

export let processOutput = function( data, dataCtxNode, searchData ) {
    awSearchService.processOutput( data, dataCtxNode, searchData );
};

/**
 * This method will make the Visible property as uneditable if the "active" is true.
 * "Active & Invisible" is not correct option.Restrict the user to save this combination.
 * @param {data} data appCtxContext object
 */
export let bindProperties = function( subPanelContext ) {
    let newXrtState = { ...subPanelContext.xrtState.getValue() };
    const REF_ACTIVE_PROP = subPanelContext.isProjectFolder !== true ? 'is_active' : 'REF( project,TC_Project ).is_active';
    const REF_VISIBLE_PROP = subPanelContext.isProjectFolder !== true ? 'is_visible' : 'REF( project,TC_Project ).is_visible';
    const REF_SECURITY_PROP = subPanelContext.isProjectFolder !== true ? 'use_program_security' : 'REF( project,TC_Project ).use_program_security';
    let  propNames = [ REF_ACTIVE_PROP, REF_VISIBLE_PROP, REF_SECURITY_PROP ];

    //If Project properties are rendered and modified from Project Data folder - advanced tab from Awp0ProjectFolder (runtime BO)
    if( subPanelContext.isProjectFolder === true ) {
        tcVmoService.getViewModelProperties( [ newXrtState.xrtVMO ], propNames ).then( function( response ) {
            if( response && response.objects && response.objects.length > 0 ) {
                newXrtState = updateXrtStateProp( newXrtState, response.objects[0], propNames );
                subPanelContext.xrtState.update( newXrtState );
            }
        } );
    } else{
        //If Project properties are rendered and modified from Projects location or from TC_Project BO
        newXrtState = updateXrtStateProp( newXrtState, subPanelContext.selected, propNames );
        subPanelContext.xrtState.update( newXrtState );
    }
};

/**
 * Common method to update the xrtState property for the runtime BO xrtState or TC_Project xrtState
 * @param {*} newXrtState input xrtState to update the properties
 * @param {*} obj object from which the properties to be updated to xrtState
 * @param {*} propNames pproperty names which needs to be updated
 * @returns updated xrtState
 */
export let updateXrtStateProp = function( newXrtState, obj, propNames ) {
    var newSecurityProp = { ...obj.props[propNames[2]] };
    newXrtState.xrtVMO.props.useProgramSecurity = updateSecurityProp( newSecurityProp );

    //This is needed for label to consider as a radio button and not to show checkbox
    //Change is required after the MR 13987.
    newXrtState.xrtVMO.props.useProgramSecurity.renderingHint = 'radiobutton';

    newXrtState.xrtVMO.props.isActive = obj.props[propNames[0]];
    newXrtState.xrtVMO.props.isActive.propertyLabelDisplay = 'PROPERTY_LABEL_AT_SIDE';
    newXrtState.xrtVMO.props.isVisible = obj.props[propNames[1]];
    newXrtState.xrtVMO.props.isVisible.propertyLabelDisplay = 'PROPERTY_LABEL_AT_SIDE';
    return newXrtState;
};

export let updateSecurityProp = function( prop ) {
    var localeTextBundle = _getLocalTextBundle();
    var newSecurityProp = { ...prop };
    newSecurityProp.propertyRadioFalseText = localeTextBundle.projectRadioLabel;
    newSecurityProp.propertyRadioTrueText = localeTextBundle.programRadioLabel;
    uwPropSvc.setPropertyDisplayName( newSecurityProp, localeTextBundle.useProgramSecurity );

    if( newSecurityProp.dbValue ) {
        newSecurityProp.uiValues = [ localeTextBundle.programRadioLabel ];
    } else if( newSecurityProp.dbValue === false ) {
        newSecurityProp.uiValues = [ localeTextBundle.projectRadioLabel ];
    }
    newSecurityProp.uiValue = newSecurityProp.uiValues[0];
    newSecurityProp.isEditable = true;
    return newSecurityProp;
};

/**
 * This method will update the search state with given variable.
 * @param {eventData} searchState  subpanelContext searchState, projectsPrivileged value
 *
 */
export let updateSearchState = function( eventData ) {
    if( eventData.searchState ) {
        let newSearchState = { ...eventData.searchState.value };

        if( eventData.value ) {
            for( const key of Object.keys( eventData.value ) ) {
                newSearchState[ key ] = eventData.value[ key ];
            }
        }

        if( eventData.searchState.update ) {
            eventData.searchState.update( newSearchState );
        }
    }
};

/**
 * This method will check command visibility condition to support add team members to the multiple projects
 * return true if any of the project is privileged.
 * @param {response} response  from getPrivilegeInProjects soa
 * @param {subPanelContext} subPanelContext  for selection data
 *
 */
export let isProjectPrivilege = function( response, selectionData ) {
    if( selectionData.length > 1 ) {
        for ( var i = 0; i < response.projectPrivilege.length; i++ ) {
            if( response.projectPrivilege[i].privilege === 3 || response.projectPrivilege[i].privilege === 2 ) {
                return true;
            }
        }
    }
    return false;
};


/**
 * Prepare the Primary search criteria when the project is opened
 * @returns
 */
export const getProjectContentSearchCriteria = function( searchState ) {
    var criteria = '';
    if( AwStateService.instance.params.uid ) {
        var mo = cdm.getObject( AwStateService.instance.params.uid );
        if( mo ) {
            var wsoType = cmm.getType( 'WorkspaceObject' );
            if ( wsoType && wsoType.propertyDescriptorsMap ) {
                var projList = wsoType.propertyDescriptorsMap.project_list;
                let projId = mo.props.project_name.dbValues[0] + ' ( ' + mo.props.project_id.dbValues[0] + ' )';
                var index = projId.indexOf( ':' );
                projId =  index === -1 ? projId : projId.substring( index + 1, projId.length );
                criteria = '"' + projList.displayName + '":"' + projId + '"';
            }
        }
    }

    let newSearchState = { ...searchState.getValue() };
    newSearchState.criteria = searchState.criteria ? searchState.criteria : {};
    newSearchState.criteria.searchString = criteria;

    return newSearchState.criteria;
};
export default exports = {
    loadColumns,
    getSortCriteria,
    registerSignOutListener,
    changeActiveVisible,
    changeUseProgramSecurityDisplay,
    bindProperties,
    processOutput,
    updateSecurityProp,
    isProjectPrivilege,
    updateSearchState,
    getProjectContentSearchCriteria,
    updateXrtStateProp
};
