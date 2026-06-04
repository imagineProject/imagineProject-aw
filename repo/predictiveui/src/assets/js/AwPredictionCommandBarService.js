import AwPredictionCommand from 'viewmodel/AwPredictionCommandViewModel';
import commandConfigurationService from 'js/commandConfigurationService';
import { getServerConditionUsage } from 'js/commandVisibilityService';

/**
 * Loading indicator styling
 *
 * @returns {JSX.Element} Loading indicator
 */
const getLoadingIndicator = () => {
    return <div className='aw-widgets-noResultsLabel aw-popup-command-bar'>
        <div className='aw-layout-flexRow'></div>
        <div className='aw-jswidgets-loading'></div>
        <div className='aw-layout-flexRow'></div>
    </div>;
};

/**
 * Get the ID for a given widget
 *
 * @param {Object} widget - widgetData to find id for
 * @returns {String} id which will be used to render
 */
const getId = ( widget ) => {
    if( widget.commands ) {
        return `${widget.commands[ 0 ].cmdId}_${widget.commands[ 0 ].cmdBarAnchor}`;
    } else if( widget.tabKey && widget.tabSetId ) {
        return `${widget.tabKey}_${widget.tabSetId}`;
    } else if( widget.tileName ) {
        return widget.tileName;
    }
    return widget.id;
};

/**
 * Component to render a command that has already been processed
 *
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awPredicitonCommandBarRenderFn = ( { viewModel: { data: { commandList = null, visibleServerCommands } }, visibilityLoader } ) => {
    return commandList && ( visibilityLoader ? visibleServerCommands : true ) ?
        commandList.map( ( command ) => {
            let id = getId( command );
            return <AwPredictionCommand
                widgetData={command}
                key={id}
                visibleServerCommands={visibleServerCommands}></AwPredictionCommand>;
        } ) :
        getLoadingIndicator();
};


/**
 * Initialize the prediction command bar for commands
 *
 * @param {Object} widgetData - object containing the prediction meta data for a widget
 * @returns {Object} returns widget with commandData if applicable
 */
export const awPredictionCommandBarInitFunction = async( widgetData ) => {
    if( !Array.isArray( widgetData ) ) {
        return [];
    }
    return await Promise.all( widgetData.map( async( widget ) => {
        if( widget.commands && widget.commands.length > 0 ) {
            //commmand
            let commandData = await commandConfigurationService.getCommand(  widget.commands[ 0 ].cmdId );
            return {
                ...widget,
                commandData: commandData
            };
        }
        return {
            ...widget
        };
    } ) );
};

/**
 * Get the unprocessed commands for the given anchor
 *
 * @param {Object} commandList The list of commands to get server visibility for
 * @param {Object} visibilityLoader The server visibility dataloader
 * @returns {Object} Current command visibility states
 */
export const refreshServerVisibility = async( commandList, visibilityLoader ) => {
    if( !commandList || !visibilityLoader ) {
        return null;
    }
    commandList = commandList.filter( cmd => { return Boolean( cmd.commandData ); } );
    if( commandList.length === 0 ) {
        return {};
    }
    const serverCommandIds = commandList.map( cmd => {
        cmd = cmd.commandData;
        const x = getServerConditionUsage( cmd );
        cmd.trace( 'Server command visibility to be loaded', x );
        return x;
    } ).reduce( ( acc, nxt ) => acc.concat( nxt ), [] );
    //trace( 'Loading server visibility', serverCommandIds, commandList );
    let results = await visibilityLoader.loadMany( serverCommandIds );
    return results.reduce( ( acc, result, idx ) => {
        acc[ serverCommandIds[ idx ] ] = result;
        return acc;
    }, {} );
};
