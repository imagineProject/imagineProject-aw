import workspaceService from 'js/workspaceService';
import iconSvc from 'js/iconService';

export const parseWorkspaces = async( response, searchOption, i18nWorkspaceIdText ) => {
    const workspaceObj = await workspaceService.getWorkspaces( response );
    const workspaceList = workspaceObj.workspaceList;
    const filteredWorkspaceList = workspaceList.filter( ( element ) => {
        const displayName = element?.cellHeader1 || element?.cellHeader2;
        return displayName?.toLowerCase()?.includes( searchOption.toLowerCase() );
    } );

    filteredWorkspaceList.forEach( element => {
        element.typeIconURL = iconSvc.getTypeIconFileUrl( 'typeWorkspace48.svg' );
        element.cellProperties = [];
        if ( element.cellHeader1 ) {
            if ( element.cellHeader2 ) {
                element.cellProperties.push( {
                    key: i18nWorkspaceIdText,
                    value: element.cellHeader2
                } );
            }
        } else {
            element.cellHeader1 = element.cellHeader2;
        }
        delete  element.cellHeader2;
    } );

    return filteredWorkspaceList;
};

export const updateScope = ( scopeState, scopeValue )=>{
    scopeState?.columnConfigScope?.columnConfigScopeObject?.update( scopeValue );
    // Reset selectedListItem to empty after scope changes to Site, Group, Role or Workspace.
    scopeState?.selectedListItem?.update( '' );
};

export const updateSelection = ( scopeState, scopeValue, groupDataprovider, roleDataprovider, workspaceDataprovider )=>{
    let selectedItem;
    if ( scopeValue === 'Group' ) {
        selectedItem = groupDataprovider?.selectedObjects?.[0]?.displayName;
    } else  if ( scopeValue === 'Role' ) {
        selectedItem = roleDataprovider?.selectedObjects?.[0]?.cellHeader1;
    } else {
        selectedItem = workspaceDataprovider?.selectedObjects?.[0]?.uid;
    }
    scopeState.selectedListItem.update( selectedItem );
};

export const parseGroupResults = ( response, i18nParentText )=>{
    return response.searchResults?.map( ( vmo )=>{
        const name = vmo?.props?.awp0CellProperties?.dbValues?.[0]?.split( ':' )?.[1];
        const parentName = vmo?.props?.awp0CellProperties?.dbValues?.[1]?.split( ':' )?.[1];
        const cellProperties = [];
        if ( parentName ) {
            cellProperties.push( {
                key: i18nParentText,
                value: parentName
            } );
        }
        return {
            identifier: name,
            cellHeader1: name,
            typeIconURL: iconSvc.getTypeIconFileUrl( 'typeGroup48.svg' ),
            displayName: name,
            cellProperties,
            props: {}
        };
    } );
};

export const parseRoleResults = ( response, i18nDescriptionText )=>{
    return response.searchResults?.map( ( vmo )=>{
        const name = vmo?.props?.awp0CellProperties?.dbValues?.[0]?.split( ':' )?.[1];
        const description = vmo?.props?.awp0CellProperties?.dbValues?.[1]?.split( ':' )?.[1];
        const cellProperties = [];
        if ( description ) {
            cellProperties.push( {
                key: i18nDescriptionText,
                value: description
            } );
        }
        return {
            identifier: name,
            cellHeader1: name,
            typeIconURL: iconSvc.getTypeIconFileUrl( 'typeRole48.svg' ),
            displayName: name,
            cellProperties,
            props: {}
        };
    } );
};

export default {
    parseWorkspaces,
    updateScope,
    updateSelection,
    parseGroupResults,
    parseRoleResults
};
