/* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import AwPic from 'viewmodel/AwPicViewModel';
import AwRow from 'viewmodel/AwRowViewModel';
import AwFlexColumn from 'viewmodel/AwFlexColumnViewModel';
import AwCommandBar from 'viewmodel/AwCommandBarViewModel';
import htmlUtils from 'js/htmlUtils';
import wcagService from 'js/wcagService';
import commandConfigurationService from 'js/commandConfigurationService';
import commandHighlightService from 'js/commandHighlightService';
import tabRegistryService from 'js/tabRegistry.service';
import cas from 'js/centralAggregationService';
import predUtils from 'js/PredictiveUtils';

let exports = {};

/**
 * Component to render a command that has already been processed
 *
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awPredictionCommandRenderFn = ( props ) => {
    if( props.viewModel.data.widgetProps ) {
        const widget = props.viewModel.data.widgetProps;
        const clickOnElement = async( e ) => {
            e.stopPropagation();
            if( widget.execute ) {
                let result = await widget.execute( widget.activeHandler, widget.scope, props.runActionWithViewModel );
                if( result === 'popup' ) {
                    commandHighlightService.clickOnCommand( widget.id, widget.xpath, widget.commands );
                }else{
                    predUtils.notify( widget.widgetData );
                }
            } else {
                if( widget.type === 'command' ) {
                    commandHighlightService.clickOnCommand( widget.id, widget.xpath );
                } else if( widget.type === 'tab' ) {
                    tabRegistryService.clickOnTab( widget.id, widget.xpath );
                } else {
                    let widgetElement = htmlUtils.getElementByXpath( widget.xpath, document.body );
                    if( widgetElement ) {
                        widgetElement.click();
                    }
                }
            }
        };

        const onKeyDownHandler = ( event ) => {
            if( wcagService.isValidKeyPress( event ) ) {
                event.preventDefault();
                clickOnElement( event );
            } else {
                wcagService.handleMoveUpOrDown( event, event.currentTarget.parentElement.parentElement );
            }
        };

        return (
            <AwRow>
                <AwFlexColumn width={'fill'}>
                    <li className={'aw-popup-command-bar aw-prediction-command'}
                        onClick={clickOnElement}
                        onKeyDown={onKeyDownHandler}
                        button-id={widget.id}
                        command-id={widget.id}
                        data-command-id={widget.id}
                        tabIndex={-1}
                        aria-label={widget.label}
                        title={widget.label}
                        role='button'>
                        <div className='aw-popup-cellContentContainer'>
                            <AwFlexColumn width={'2f'}>
                                <AwPic className='aw-widget-thumbnail' iconId={widget.iconId}></AwPic>
                            </AwFlexColumn>
                            <AwFlexColumn align-content={'start'}>
                                <AwRow className={'aw-prediction-command-title'}>
                                    {widget.label}
                                </AwRow>
                                { widget.sectionTitle ? <AwRow className={'aw-prediction-section-title'} >
                                    {widget.sectionTitle}
                                </AwRow> : null }
                            </AwFlexColumn>
                        </div>
                    </li>
                </AwFlexColumn>
                <AwFlexColumn width={'7.5f'} >
                    <AwCommandBar anchor='awa_dataAssistantPanel' context={widget} overflow={true} orientation='HORIZONTAL' ></AwCommandBar>
                </AwFlexColumn>
            </AwRow>
        );
    }
    return null;
};

/**
 * Initialize widgetProps based on widget type and visibility
 *
 * @param {Object} widgetData - widgetData which holds the prediciton info from the microservice
 * @param {Object} ctx - Application context
 * @param {Object} visibleServerCommands - Server visibility commands from getVisibleCommands SOA
 * @param {Function} runActionWithViewModel - runActionWithViewModel function used to execute commands
 * @returns {Object} - widgetProps with label, id, icon, and execution
 */
export const initWidgetProps = async( widgetData, ctx, visibleServerCommands, runActionWithViewModel ) => {
    if( widgetData.commands ) {
        //command
        return exports.findCommand( widgetData, ctx, visibleServerCommands, runActionWithViewModel );
    } else if( widgetData.tileId ) {
        //tile
        return exports.findTile( widgetData );
    } else if( widgetData.tabKey ) {
        //tab
        return exports.findTab( widgetData );
    }
    //not tracked
    return null;
};

/**
 * Find a command in the DOM based off of given microservice information
 *
 * @param {Object} widgetData command widgetData which holds the prediciton info from the microservice
 * @param {Object} ctx - Application context
 * @param {Object} visibleServerCommands - Server visibility commands from getVisibleCommands SOA
 * @param {Function} runActionWithViewModel - runActionWithViewModel function used to execute commands
 * @returns {Object} - widgetProps for given command
 */
export const findCommand = async function( widgetData, ctx, visibleServerCommands, runActionWithViewModel ) {
    let xPath = cas.buildXpath( widgetData );
    let widgetElement = htmlUtils.getElementByXpath( xPath, document.body );
    let widgetProps = {
        type: 'command',
        widgetData: {
            ...widgetData
        }
    };
    if( widgetElement ) {
        //flat command find in DOM
        widgetProps.id = widgetElement.attributes[ 'command-id' ].value;
        widgetProps.xpath = xPath;
        widgetProps.commands = widgetData.commands;
        if( widgetData.sectionTitleKey ) {
            widgetProps.sectionTitle = exports.findSectionTitle( widgetData.sectionTitleKey );
        }
        let iconElement =  widgetElement.querySelector( 'span[iconId]' );
        if( iconElement ) {
            widgetProps.iconId = iconElement.getAttribute( 'iconId' );
        }
        //Command on command bar
        let labelElement = widgetElement.querySelector( 'div[class*="aw-commands-commandIconButtonText"]' );
        if( !labelElement ) {
            //Command in list
            labelElement = widgetElement.querySelector( 'div[class="aw-popup-cellContentContainer"]' );
        }
        if( labelElement ) {
            widgetProps.label = labelElement.innerText;
        }
        return widgetProps;
    }
    if( widgetData.commands.length > 1 ) {
        //group command
        let lastIndex = widgetData.commands.length - 1;
        let lastGrpCmdAnchor =  widgetData.commands[ lastIndex ].cmdBarAnchor;
        let commandContext = commandConfigurationService.getCommandContext( null, lastGrpCmdAnchor );
        const scope = {
            commandContext,
            ctx: {
                ...ctx,
                visibleServerCommands: visibleServerCommands
            }
        };
        let activeHandler = commandConfigurationService.getActiveCommandHandler( widgetData.commandData.handlers, scope );
        if( activeHandler && commandConfigurationService.getCommandAndCheckVisibility( activeHandler, scope ) ) {
            // populate widget props
            let sectionTitle = widgetData.sectionTitleKey ? exports.findSectionTitle( widgetData.sectionTitleKey ) : null;
            widgetProps = {
                ...widgetProps,
                //xpath: widgetData.xpath,
                commands: widgetData.commands,
                sectionTitle: sectionTitle,
                grpCmdAnchor: widgetData.grpCmdAnchor,
                iconId: widgetData.commandData.icon,
                id: widgetData.commandData.id,
                label: widgetData.commandData.title.value,
                execute: async function( activeHandler, scope, runActionWithViewModel ) {
                    if( activeHandler.action.actionType === 'popup' ) {
                        return activeHandler.action.actionType;
                    }
                    return activeHandler.execute.apply( activeHandler, [ runActionWithViewModel, scope, scope.commandContext ] );
                },
                scope: scope,
                runActionWithViewModel: runActionWithViewModel,
                activeHandler: activeHandler
            };
            return widgetProps;
        }
    }
    return null;
};

/**
 * Find a tab in the DOM based off of given microservice information
 *
 * @param {Object} widgetData tab widgetData which holds the prediciton info from the microservice
 * @returns {Object} - widgetProps for given tab
 */
export const findTab = function( widgetData ) {
    let xPath = cas.buildXpath( widgetData );
    let widgetElement = htmlUtils.getElementByXpath( xPath, document.body );
    let widgetProps = {
        type: 'tab',
        widgetData: {
            ...widgetData
        }
    };
    if( widgetElement ) {
        widgetProps.id = widgetData.tabKey;
        widgetProps.xpath = xPath;
        widgetProps.label = widgetElement.innerText;
        widgetProps.iconId = 'cmdGenericTabLocation';
        return widgetProps;
    }
    return null;
};

/**
 * Find a tile in the DOM based off of given microservice information
 *
 * @param {Object} widgetData tile widgetData which holds the prediciton info from the microservice
 * @returns {Object} - widgetProps for given tile
 */
export const findTile = function( widgetData ) {
    let xPath = cas.buildXpath( widgetData );
    let widgetElement = htmlUtils.getElementByXpath( xPath, document.body );
    let widgetProps = {
        type: 'tile',
        widgetData: {
            ...widgetData
        }
    };
    if( widgetElement ) {
        widgetProps.id = widgetElement.title;
        widgetProps.xpath = xPath;
        widgetProps.label = widgetElement.getAttribute( 'title' );
        for( const child of widgetElement.children ) {
            if( child.className.includes( 'aw-tile-tileContent' ) || child.className.includes( 'aw-tile-brand' ) ) {
                //icon
                let iconContainer = child.querySelector( '.aw-icon' );
                if( iconContainer ) {
                    widgetProps.iconId = iconContainer.attributes[ 'icon-id' ].value;
                }
            }
        }
        //widgetProps.label = widgetElement.innerText;
        return widgetProps;
    }
    return null;
};

/**
 * Get the section title from the DOM
 *
 * @param {String} sectionTitleKey - the key of the needed section title
 * @returns {String} - returns the localized section title from the DOM
 */
export const findSectionTitle = function( sectionTitleKey ) {
    const xPath = `//*[@data-locator='titlekey-${sectionTitleKey}']//summary[@role='button']//*[@title]`;
    const sectionElement = htmlUtils.getElementByXpath( xPath, document.body );
    if( sectionElement ) {
        return sectionElement.getAttribute( 'title' );
    }
    return null;
};

/**
 * Like a prediction
 *
 * @param {object} commandContext - context of command bar liked
 * @param {object} widgetData - current command bar context
 * @returns {object} - updated current command context
 */
export const likePrediction = function( commandContext, widgetData ) {
    if ( commandContext.label === widgetData.label ) {
        commandContext.isLiked = true;
        commandContext.isDisliked = false;
        return commandContext;
    }
    return widgetData;
};

/**
 * Disike a prediction
 *
 * @param {object} commandContext - context of command bar disliked
 * @param {object} widgetData - current command bar context
 * @returns {object} - updated current command context
 */
export const dislikePrediction = function( commandContext, widgetData ) {
    if ( commandContext.label === widgetData.label ) {
        commandContext.isDisliked = true;
        commandContext.isLiked = false;
        return commandContext;
    }
    return widgetData;
};

export default exports = {
    awPredictionCommandRenderFn,
    initWidgetProps,
    findCommand,
    findTab,
    findTile,
    findSectionTitle,
    likePrediction,
    dislikePrediction
};
