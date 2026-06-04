/* eslint-env amd, es6, node */

const { src } = require( '@swf/tooling/js/orchestrator' );
const { forEach } = require( 'lodash' );
const fs = require( 'fs' );
const logger = require( '@swf/tooling/js/logger' );

/**
 * Convert AMD javascript file contents to ES6 contents.
 *
 * @argument {Object} file file object
 * @argument {Object} commandPlacementToCommandsMap Map
 * @argument {Object} implicitCommandToParentGroupMap Map
 */
function analyzeFile( file, commandPlacementToCommandsMap, implicitCommandToParentGroupMap ) {
    if( file.path.includes( 'commandsViewModel' ) ) {
        const jsonContent = JSON.parse( file.contents );
        // Populate command placement to commands list
        for( const placementKey in jsonContent.commandPlacements ) {
            const placement = jsonContent.commandPlacements[ placementKey ];
            if( placement.uiAnchor ) {
                if( !commandPlacementToCommandsMap[ placement.uiAnchor ] ) {
                    commandPlacementToCommandsMap[ placement.uiAnchor ] = {};
                }

                if( !commandPlacementToCommandsMap[ placement.uiAnchor ][ placement.id ] ) {
                    commandPlacementToCommandsMap[ placement.uiAnchor ][ placement.id ] = [];
                }
                if( placement.parentGroupId ) {
                    commandPlacementToCommandsMap[ placement.uiAnchor ][ placement.id ].push( placement.parentGroupId );
                }
            } else {
                if( placement.parentGroupId ) {
                    if( !implicitCommandToParentGroupMap[ placement.id ] ) {
                        implicitCommandToParentGroupMap[ placement.id ] = [];
                    }
                    implicitCommandToParentGroupMap[ placement.id ].push( placement.parentGroupId );
                }
            }
        }
    }
}

/**
 * Function to derive the placement hierarchy.
 *
 * @param {Object} placementHierarchy - array of placements
 * @param {String} placementUiAnchor - uiAnchor to append to the placementHierarchy
 * @param {String} groupIds  - array of group command ids
 * @param {*} commandsMap - map of objects to parent group id array
 * @returns {Object} placementHierarchy Array of placements
 */
function getPlacements( placementHierarchy, placementUiAnchor, groupIds, commandsMap ) {
    if( groupIds.length ) {
        placementHierarchy = placementHierarchy.length ? groupIds.map( groupId => {
            placementHierarchy = placementHierarchy.map( placement => placement.split( ',' ).concat( [ groupId ] ).join() );
            const parentGroupList = commandsMap[groupId];
            return getPlacements( placementHierarchy, placementUiAnchor, parentGroupList, commandsMap );
        } )
            : placementHierarchy.concat( groupIds );
    }
    placementHierarchy = placementHierarchy.length ?
        placementHierarchy.map( placement => placement.split( ',' ).concat( [ placementUiAnchor ] ).join() )
        : placementHierarchy.concat( [ placementUiAnchor ] );
    return placementHierarchy;
}

/**
 * post process analysis to convert the placements -> commands object to the commands -> list of placements object.
 * @param {Object} commandPlacementToCommandsMap - Map.
 * @param {Object} implicitCommandToParentGroupMap - Map.
 * @returns {Object} commandPlacements object where command id maps to list of placements
 */
async function postProcess( commandPlacementToCommandsMap, implicitCommandToParentGroupMap ) {
    const commandPlacements = {};
    for( const placementUiAnchor in commandPlacementToCommandsMap ) {
        const commandsMap = commandPlacementToCommandsMap[ placementUiAnchor ];
        for( const commandId in commandsMap ) {
            let placementHierarchy = [];
            let groupIds = commandsMap[commandId];
            if( implicitCommandToParentGroupMap[commandId] ) {
                groupIds = groupIds.concat( implicitCommandToParentGroupMap[commandId] );
            }
            placementHierarchy = getPlacements( placementHierarchy, placementUiAnchor, groupIds, commandsMap );
            if( !commandPlacements[commandId] ) {
                commandPlacements[commandId] = [];
            }
            commandPlacements[commandId] = commandPlacements[commandId].concat( placementHierarchy );
        }
    }

    return commandPlacements;
}

/**
 * Get commands placements from a source directory.
 * @param {String} filePath - file path.
 * @param {Object} commandPlacementToCommandsMap - Map.
 * @returns {Object} command placements.
 */
async function getCmdPlacements( filePath, commandPlacementToCommandsMap ) {
    const sourcepaths = [];
    const modulePaths = filePath.split( ',' );
    const implicitCommandToParentGroupMap = {};
    for( let modulePath in modulePaths ) {
        sourcepaths.push( modulePaths[ modulePath ].trim() );
    }

    const gulpSrc = src( sourcepaths, { base: './' } ).then( result =>{
        forEach( result, file => analyzeFile( file, commandPlacementToCommandsMap, implicitCommandToParentGroupMap ) );
    } );

    await gulpSrc;
    return postProcess( commandPlacementToCommandsMap, implicitCommandToParentGroupMap );
}

/**
 * compare cmd placements.
 *
 * @param {Object} oldCmdPlacements - old command placements
 * @param {Object} newCmdPlacements - new command placements
 * @param {*} destPath - destination path for generated commandsDeltaSeed.json
 */
async function comparePlacements( oldCmdPlacements, newCmdPlacements, destPath ) {
    const delta = {};
    for( const cmdId in oldCmdPlacements ) {
        const oldCmdPaths = oldCmdPlacements[cmdId];
        const newCmdPaths = newCmdPlacements[cmdId];
        if( newCmdPaths ) {
            const remainingOldPlacements = oldCmdPaths.filter( path => !newCmdPaths.includes( path ) );
            const remainingNewPlacements = newCmdPaths.filter( path => !oldCmdPaths.includes( path ) );
            if( remainingOldPlacements.length !== 0 || remainingNewPlacements.length !== 0 ) {
                delta[cmdId] = { old: remainingOldPlacements, new: remainingNewPlacements };
            }
        } else {
            // old command doesn't exist anymore, do nothing
        }
    }
    fs.writeFileSync( destPath + '/commandsDeltaSeed.json', JSON.stringify( delta ) );
}

/**
 * Convert AMD js to ES6 JS
 *
 * @param {Object} argv input options (--oldPath,--newPath,--destPath)
 */
async function main( argv ) {
    const oldFilePath = argv.oldPath;
    const newFilePath = argv.newPath;
    if( !oldFilePath || !newFilePath ) {
        const errorMsg = `Pass oldPath and newPath option to script, see following example you can pass single file relative path or multiple glob paths by comma separated.
         Example: node ./src/thinclient/predictiveui/src/tooling/generateCommandsDelta.js --oldPath %AWC_STAGE_DIR%/src/**/* --newPath %AWC_STAGE_DIR_2%/src/**/* --destPath D:/code_stats/sourceInspect/`;
        throw new Error( errorMsg );
    }

    let commandPlacementToCommandsMap = {};
    const oldCmdPlacements = await getCmdPlacements( oldFilePath, commandPlacementToCommandsMap );
    commandPlacementToCommandsMap = {};
    const newCmdPlacements = await getCmdPlacements( newFilePath, commandPlacementToCommandsMap );
    await comparePlacements( oldCmdPlacements, newCmdPlacements, argv.destPath ? argv.destPath : '.' );
}
if( require.main === module ) {
    const argv = require( 'yargs' )
        .demandCommand( 0 )
        .usage( 'Usage: node $0 [options]' )
        .example( 'node $0 --oldPath %AWC_STAGE_DIR%/src/**/* --newPath %AWC_STAGE_DIR_2%/src/**/* --destPath D:/code_stats/upgrade/' )
        .options( {
            oldPath: {
                description: 'Relative source path/glob path of code to files to analyze. Can provide multiple paths separated by commas.',
                alias: 'oldSrc',
                demand: true
            },
            newPath: {
                description: 'Relative source path/glob path of code to files to analyze. Can provide multiple paths separated by commas.',
                alias: 'newSrc',
                demand: true
            },
            destPath: {
                description: 'Relative destination path to save output',
                alias: 'dst',
                demand: true
            }
        } )
        .help()
        .argv;
    main( argv ).catch( logger.error );
}
module.exports = main;
