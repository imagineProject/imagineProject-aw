import soaSvc from 'soa/kernel/soaService';
import { getTileIcon } from 'js/AwTileIconService';
import tileSvc from 'js/tileService';
import { getImageAliasFromId } from 'js/imageRegistry';
import awConfiguration from 'js/awConfiguration';
import { navigate } from 'js/navigationService';
import vmoSvc from 'js/viewModelObjectService';
import { pinDataCommands } from 'js/AwPersonalizationEngine';
import { DerivedStateResult } from 'js/derivedContextService';
import appCtxService from 'js/appCtxService';
import clientDataModel from 'soa/kernel/clientDataModel';
import dataManagementService from 'soa/dataManagementService';

function filterObjects( allApps, filterString ) {
    return allApps.filter( app => app.displayName && app.displayName.toString().toLowerCase().includes( filterString.toLowerCase() ) );
}

export const fetchTileData = async() => {
    const response = await soaSvc.postUnchecked( 'Internal-AWS2-2022-12-DataManagement', 'getCurrentUserGateway3' );
    const { tileGroups } = response;
    let allTiles = [];
    for ( let grpIndex in tileGroups ) {
        allTiles = allTiles.concat( tileGroups[grpIndex]?.tiles );
    }
    for ( let appIndex in allTiles ) {
        let tileIcon = {
            icon: allTiles[appIndex].icons,
            primary: 'true'
        };
        allTiles[appIndex].icon = getTileIcon( tileIcon )?.tileIcon;
        allTiles[appIndex].tileIcon = awConfiguration.get( 'baseUrl' ) + '/' + getImageAliasFromId( allTiles[appIndex].icon );
    }
    allTiles.sort( ( a, b ) => a.displayName.localeCompare( b.displayName ) );
    const allData = allTiles.filter( app => app.action.url.includes( 'showObject' ) );
    const allApps = allTiles.filter( app => !app.action.url.includes( 'showObject' ) );
    return { allApps, allData };
};

export const loadAllTools = ( allApps, filterString ) => {
    let filteredApps = allApps;
    if ( filterString ) {
        filteredApps = filterObjects( allApps, filterString );
    }
    return {
        filteredApps: filteredApps,
        totalFound: filteredApps.length
    };
};

export const goBack = launcherState => {
    let localLauncherState = { ...launcherState.getValue() };
    localLauncherState.activeView = 'pinnedTools';
    launcherState.update( localLauncherState );
};

export const goToAllTools = launcherState => {
    let localLauncherState = { ...launcherState.getValue() };
    localLauncherState.activeView = 'allTools';
    launcherState.update( localLauncherState );
};

export const performActionAndClose = ( action, context, runActionWithViewModel, popupApi ) => {
    tileSvc.performAction( action, context, runActionWithViewModel );
    popupApi.hide();
};

export const performGroupCmdActionAndClose = ( commandContext, popupApi ) => {
    commandContext.command.execute( commandContext.runActionWithViewModel, commandContext );
    popupApi.hide();
};

export const performNavigateActionAndClose = ( uid, popupApi ) => {
    navigate( {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
    }, { uid } );
    popupApi.hide();
};

const loadPinnedDataObjects = async() =>{
    let pinnedData = appCtxService.ctx?.personalization_pinnedCommands?.aw_pinnedData;
    let pinnedDataObjectsToLoad = [];
    if ( pinnedData ) {
        for ( let uid of pinnedData ) {
            let Obj = clientDataModel.getObject( uid );
            if ( !Obj || Object.keys( Obj.props ).length === 0 ) {
                pinnedDataObjectsToLoad.push( uid );
            }
        }
    }
    if( pinnedDataObjectsToLoad.length > 0 ) {
        await dataManagementService.loadObjects( pinnedDataObjectsToLoad );
    }
    return { pinnedDataObjectsLoaded : true };
};

const generatePinnedDataFromTile = async( allData )=>{
    let newVMOs = [];
    for ( let dataIndex in allData ) {
        const uid = allData[dataIndex]?.action?.actionParams?.uid;
        if ( !appCtxService.ctx?.personalization_pinnedCommands?.aw_pinnedData?.includes( uid ) ) {
            let newVMO = vmoSvc.constructViewModelObject( { uid: uid } );
            if ( newVMO ) {
                newVMO.typeIconURL = allData[dataIndex].icon;
                newVMO.cellHeader1 = allData[dataIndex].displayName;
                newVMOs.push( newVMO );
            }
        }
    }
    if( newVMOs.length > 0 ) {
        await pinDataCommands( 'aw_pinnedData', newVMOs );
    }
};

export const initializePersonalizedAppChooser = async( allData ) => {
    await generatePinnedDataFromTile( allData );
    return loadPinnedDataObjects();
};

export const getLauncherContext = ( vmDef, props, data ) => {
    return [ new DerivedStateResult( {
        ctxParameters: [],
        additionalParameters: [ props.context ],
        compute: () => {
            return { ...props.context };
        }
    } ) ];
};
