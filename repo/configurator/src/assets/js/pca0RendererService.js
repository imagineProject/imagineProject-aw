// Copyright (c) 2022 Siemens

/**
 * Collection of APIs/Utils to handle rendering of cells/selections/violations/icons etc.
 * @module js/pca0RendererService
 */
// Library imports
import { getBaseUrlPath } from 'app';
import appCtxService from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import htmlUtil from 'js/htmlUtils';
import localeService from 'js/localeService';
import _ from 'lodash';
import pca0CommonUtils from 'js/pca0CommonUtils';
import pca0Constants from 'js/Pca0Constants';
import pca0FeatureDispositionLovEditService from 'js/Pca0FeatureDispositionLovEditService';
import pca0GridAuthoringService from 'js/pca0GridAuthoringService';
import tableSvc from 'js/splmTablePublishedService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';

// Component imports
import { AppCtxComponent } from 'js/reactAppCtx';
import AwCellCommandBar from 'viewmodel/AwCellCommandBarViewModel';
import { renderComponent } from 'js/declReactUtils';

const _localeCommonUtilsTextBundle = pca0CommonUtils.getLocaleTextBundle( 'ConfiguratorCommonMessages' );
const _localeConfiguratorTextBundle = localeService.getLoadedText( 'ConfiguratorMessages' );
const _localeFSCTextBundle = localeService.getLoadedText( 'FullScreenConfigurationMessages' );

/**
 * This function is required to dynamically generate and render command elements within grid cells.
 * It allows for the inclusion of interactive command bars within each cell, providing users with
 * contextual actions that can be performed on the cell's data. The function leverages the
 * `AwCellCommandBar` component to render the command bar and uses the `renderComponent` function
 * to inject the rendered component into the DOM.
 * @param {Object} column - The column object for which the command element is being created.
 * @param {Object} vmo - The ViewModelObject representing the row data.
 * @return {HTMLElement} - The container with the rendered component.
 */
const _createCellCommandElement = ( column, vmo ) => {
    const cellCommandsContainer = htmlUtil.createElement( 'div', 'aw-splm-gridCellCommandsContainer' );

    const cellProperty = vmo?.props?.[column.field] || {};

    const context = {
        anchor: pca0Constants.CFG_FORMULA_SUGGESTER_ANCHOR,
        vmo,
        prop: cellProperty
    };
    const cellCmdElementWrapper =
        <div className='aw-splm-commandBarPresent aw-splm-tableFlexRow aw-cell-command-bar aw-jswidgets-gridCellCommands aw-widgets-cellInteraction'>
            {context.anchor && <AwCellCommandBar anchor={context.anchor} className='aw-layout-flexRow' context={context} />}
        </div>
    ;

    renderComponent( <AppCtxComponent>{cellCmdElementWrapper}</AppCtxComponent>, cellCommandsContainer );

    return cellCommandsContainer;
};

/*
 *   Internal functions
 */

/**
 * Invoke callback upon cell click event
 * @param {String} contextKey  context Key
 * @param {String} callbackName callback name to handle cell click event
 * @param {Object} cell cell
 * @param {Object} vmo View Model Object for the cell
 * @param {Object} column column for the cell
 * @param {Object} treeDataProvider data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {Boolean} isSnOMatrixGridEditor true if Variant Table is authoring Matrix Rules
 */
let _handleCellClick = function( contextKey, callbackName, cell, vmo, column, treeDataProvider, vmGridSelectionState, isSnOMatrixGridEditor ) {
    // Enforce row selection for Tree Navigation column
    if( column.isTreeNavigation || column.isColumnFromCots ) {
        treeDataProvider.selectionModel.setSelection( vmo );
    }

    if( callbackName ) {
        let cellDetails = {
            cell: cell,
            vmo: vmo,
            column: column,
            treeDataProvider: treeDataProvider
        };
        callbackName( contextKey, cellDetails, vmGridSelectionState, isSnOMatrixGridEditor );
    }
};

/**
 * Creates container for rendering image in table cell
 * @returns {Object} CellContainer with icon
 */
let _getCellImageContainer = function() {
    let cellImageContainer = document.createElement( 'img' );
    cellImageContainer.classList.add( 'aw-base-icon' );
    cellImageContainer.classList.add( 'aw-splm-tableIcon' );
    return cellImageContainer;
};

/**
 * Return image Container for the Cell
 * @param {Integer} selectionState - VMO selection state
 * @param {Array} indicators - indicators array
 * @returns {Object} - Cell Image container
 */
let _getSelectionStateImageContainer = function( selectionState, indicators ) {
    let imageBasePath = getBaseUrlPath() + '/image/';
    var cellImageContainer = document.createElement( 'div' );

    let customClassName;
    var imagePath;
    var imagePath2 = imageBasePath;
    let imageContainer;
    switch ( selectionState ) {
        case 1:
        case 5:
        case 9:
            imageContainer = _getCellImageContainer();
            imageContainer.classList.add( 'cfg-select' );
            imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_TICK;
            imageContainer.alt = _localeCommonUtilsTextBundle.selected;
            if( selectionState === 5 ) {
                imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_POSITIVE_SELECTION;
                customClassName = 'cfg-default';
            } else if( selectionState === 9 ) {
                imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_POSITIVE_SELECTION;
                customClassName = 'cfg-system';
            }
            break;
        case 2:
        case 6:
        case 10:
            imageContainer = _getCellImageContainer();
            imageContainer.classList.add( 'cfg-deselect' );
            imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_NOT;
            imageContainer.alt = _localeCommonUtilsTextBundle.excluded;
            if( selectionState === 6 ) {
                imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_DEFAULT_NEGATIVE_SELECTION;
                customClassName = 'cfg-default';
            } else if( selectionState === 10 ) {
                imagePath = imageBasePath + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_SYSTEM_NEGATIVE_SELECTION;
                customClassName = 'cfg-system';
            }
            break;
        default:
            break;
    }

    if( imageContainer ) {
        imageContainer.src = imagePath;
        if( !_.isUndefined( customClassName ) ) {
            imageContainer.classList.add( customClassName );
        }
        cellImageContainer.appendChild( imageContainer );
    }

    if ( indicators ) {
        let image3Container = _getCellImageContainer();
        image3Container.classList.add( 'aw-cfg-img-gridcell' );
        image3Container.classList.add( customClassName );
        imagePath2 += indicators[0].image;
        image3Container.src = imagePath2;
        image3Container.alt = indicators[0].tooltip;
        cellImageContainer.appendChild( image3Container );
        cellImageContainer.title =  indicators[0].tooltip;
    }
    return cellImageContainer;
};

/**
 * Helper function to create checkbox element for pick and choose panel.
 * @return {Object} - Checkbox element
 */
let _createCheckboxElement = () => {
    let cellImg = document.createElement( 'input' );
    cellImg.classList.add( 'aw-splm-tableCheckBoxPresent', 'sw-property-val', 'sw-checkbox-pseudo' );
    cellImg.type = 'checkbox';
    cellImg.style.height = '1.5rem';
    cellImg.style.width = '1.5rem';
    cellImg.style.accentColor = '#005f87';
    return cellImg;
};

/**
 * Get matching feature disposition for input VMO property
 * @param {Object} dbValue selectionState value of Matrix Rule for the VMO (can be string format, array, integer)
 * @returns {Object} info container for resulting featureDisposition and operatorCode (selectionState)
 */
let _getFeatureDispositionAndOpCode = dbValue => {
    let featureDisposition;
    let opCode = 0;
    let featureDispositionsLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov;
    if( _.isArray( dbValue ) ) {
        // Regular use case:array with integer dbValue as per selectionMap
        opCode = Number( dbValue[ 0 ] );
        featureDisposition = _.find( featureDispositionsLov, { operatorCode: opCode } );
    } else if( _.isNumber( dbValue ) ) {
        // This happens on fillDown
        featureDisposition = _.find( featureDispositionsLov, { operatorCode: dbValue } );
        opCode = dbValue;
    } else if( dbValue !== '' ) {
        // This happens on handleCancel (bulkEdit)
        featureDisposition = _.find( featureDispositionsLov, { lovKey: dbValue } );
        opCode = featureDisposition.operatorCode;
    }
    return { opCode, featureDisposition };
};

/**
 * Adds an Unconfigured indicator to the cellImageContainer
 * @param {Object} cellImageContainer - container for rendering image in table cell
 * @returns {Object} cellImageContainer with unconfigured indicator
 */
let _addUnconfiguredIndicator = cellImageContainer => {
    let unconfiguredImageContainer = _getCellImageContainer();
    unconfiguredImageContainer.classList.add( 'aw-cfg-img-gridcell' );
    unconfiguredImageContainer.src = getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_CONFIGURED_OUT;
    cellImageContainer.appendChild( unconfiguredImageContainer );
    return cellImageContainer;
};


/*
 *   Export APIs section starts
 */
let exports = {};

/**
 * Table Icon/Selection Cell Renderer for PL Table
 * @param {Function} handleCellClick - callback for handlick click events on cell
 * @param {String} contextKey - context key
 * @param {UwDataProvider} treeDataProvider - the Tree Data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @param {Boolean} isSnOMatrixGridEditor true if Variant Table is authoring Matrix Rules
 * @return {Object} cell renderer
 */
export let iconCellRenderer = ( handleCellClick, contextKey, treeDataProvider, vmGridSelectionState, isSnOMatrixGridEditor ) => {
    return {
        action: ( column, vmo ) => {
            // Create root element
            let cell = document.createElement( 'div' );
            cell.classList.add( 'aw-cfg-variantgridCell' );

            let gridId = _.get( treeDataProvider, 'json.gridId' );
            const isMultiSvrGrid =  gridId === 'multipleVariantsConfigGrid';

            let columnCell = column.field;
            if( !( columnCell in vmo.props ) && vmo.props.expressionType && vmo.props.expressionType.dbValue ) {
                columnCell = column.field + ':' + vmo.props.expressionType.dbValue;
            }

            let isUnconfiguredCell = _.get( vmo.props[ columnCell ], 'props.isUnconfigured.0' ) === 'true';
            if( columnCell in vmo.props ) {
                // Mark cell as disabled if it's a split copied selection
                if( _.get( vmo.props[ columnCell ], 'props.isSplitCellEditDisabled' ) ) {
                    cell.classList.add( 'disabled' );
                }

                let selectionState = vmo.props[ columnCell ].dbValue;

                // Set Summary
                // For VCV and VCA don't show summary
                let summaryText = '';
                //for the 'multipleVariantsConfigGrid' add the summary even if the node has no children if the summary code decides to have a summary
                //the use case is that an SVR can be loaded in current expressions only mode, so the family node will have no children but it might have a
                //summary value if for example the family node is 'any' or 'none'. With the code below excluding only the non summary grids
                // the node would show as leaf in a collapsed state which is not the desired behavior
                if( gridId === 'multipleVariantsConfigGrid'  && !vmo.childrenUids && !vmo.isExpanded && vmo.isFamily &&  !_.isNumber( vmo.props[ columnCell ].uiValue ) ) {
                    summaryText = vmo.props[ columnCell ].uiValue;
                    cell.innerText = summaryText;
                    cell.setAttribute( 'title', summaryText );
                    cell.classList.add( 'aw-cfg-variantgridTextCell' ); // align text with some margin
                } else if( gridId !== pca0Constants.GRID_CONSTANTS.VARIANT_CONDITION && gridId !== pca0Constants.GRID_CONSTANTS.VARIANT_CONFIGURATION &&
                                    !vmo.isExpanded && !vmo.isLeaf && vmo.childrenUids && vmo.childrenUids.length >= 1 ) {
                    summaryText = vmo.props[ columnCell ].uiValue;

                    if( summaryText !== '' && summaryText !== 0  ) {
                        // Note: title is allowing for tooltip top appear in case of longer text with ellipsis
                        cell.innerText = summaryText;
                        cell.setAttribute( 'title', summaryText );
                        cell.classList.add( 'aw-cfg-variantgridTextCell' ); // align text with some margin
                    }

                // Create image cell
                } else if( _.isNumber( selectionState ) ) {
                    cell.classList.add( 'aw-cfg-fscIndicatorContainer' ); // adds flex property to align icon center
                    var cellImageContainer = _getSelectionStateImageContainer( selectionState, vmo.props[columnCell].indicators );
                    if( cellImageContainer ) {
                        if( vmo.props[columnCell].indicators ) {
                            cellImageContainer.alt = vmo.props[columnCell].indicators[0].tooltip;
                        }
                        if( gridId === 'multipleVariantsConfigGrid' && isUnconfiguredCell ) {
                            cellImageContainer = _addUnconfiguredIndicator( cellImageContainer );
                        }
                        cell.appendChild( cellImageContainer );
                    }
                } else {
                    // TODO REMOVE: every text should be part of uiValue (we never use selectionState to store text value)
                    // Scenario for 'Properties Information' subset
                    // Note: title is allowing for tooltip to appear in case of longer text with ellipsis
                    cell.setAttribute( 'title', selectionState );
                    cell.innerText = selectionState;
                }
            }

            // React to VMO changes
            eventBus.subscribe( 'Pca0GridAuthoring.vmoUpdated', function( eventData ) {
                if( !_.isEqual( eventData.vmo.alternateID, vmo.alternateID ) || eventData.columnField !== columnCell ) {
                    return;
                }

                if( columnCell in vmo.props ) {
                    // Delete children of current cell and reset style
                    cell.innerHTML = '';
                    var newSelectionState = eventData.vmo.props[ columnCell ].dbValue;
                    var cellImageContainer = _getSelectionStateImageContainer( newSelectionState );
                    if( cellImageContainer ) {
                        cell.appendChild( cellImageContainer );
                    }
                    cell.classList.remove( 'changed' );

                    // Validate if VMO contains unsaved edits
                    if( vmo.props[ columnCell ].valueUpdated ) {
                        cell.classList.add( 'changed' );
                    }
                }
            } );

            // Apply onClick listener to handle editing
            cell.onclick = function() {
                _handleCellClick( contextKey, handleCellClick, cell, vmo, column, treeDataProvider, vmGridSelectionState, isSnOMatrixGridEditor );
            };

            return cell;
        },

        condition: ( column, vmo ) => {
            if( column.isTreeNavigation ) {
                return false;
            }

            let columnCell = column.field;
            if( !( columnCell in vmo.props ) && vmo.props.expressionType && vmo.props.expressionType.dbValue ) {
                columnCell = column.field + ':' + vmo.props.expressionType.dbValue;
            }
            if( vmo && vmo.isUnconfigured && vmo.props && vmo.props[ columnCell ] ) {
                return vmo.props[ columnCell ].originalValue !== 0; // some selection state then allow editing. Allow editing if the value was <> 0.
            }

            return true;
        },
        name: 'iconCellRenderer'
    };
};

/**
 * Table LOV Cell Renderer for PL Table
 * @param {Object} vmVariabilityProps - View Model Atomic Data <Variability Props>
 * @param {Object} vmGridData - View Model Atomic Data <bottom grid data>
 * @return {Object} cell renderer
 */
export let lovMatrixCellRenderer = ( vmVariabilityProps, vmGridData ) => {
    return {
        action: ( column, vmo, tableElem, rowElement ) => {
            // For MatrixRule use default cell renderer
            // (this comes with native editing VM for LOVs)
            // Add a custom class to allow for some border between the cells
            let cell = tableSvc.createElement( column, vmo, tableElem, rowElement );
            cell.classList.add( 'aw-cfg-variantgridCell' );
            cell.classList.add( 'aw-cfg-variantgridTextCell' ); // align text with some margin

            let textValue = '';

            // Set title: title is allowing for tooltip to appear in case of longer text with ellipsis
            let titleValue = '';

            if( vmo.isSpecialBackgroundCell || !( column.name in vmo.props ) ) {
                return cell;
            }

            // Cell text will be:
            // featureDisposition as per selectionMap entry OR
            // Summary value if node is not a leaf and is collapsed
            if( vmo.isLeaf || vmo.isExpanded ) {
                let dbValue = vmo.props[ column.name ].dbValue;
                let { opCode, featureDisposition } = _getFeatureDispositionAndOpCode( dbValue );

                // Continue if it's valid selection state
                if( opCode === 0 || !_.isUndefined( featureDisposition ) ) {
                    let gridData = { ...vmGridData.getAtomicData() };
                    let businessObjectToSelectionMap = gridData.businessObjectToSelectionMap;
                    let selectionMap = businessObjectToSelectionMap[ column.name ];
                    if( !_.isUndefined( selectionMap ) ) {
                        let node = !_.isUndefined( selectionMap[ vmo.alternateID ] ) ? selectionMap[ vmo.alternateID ] : selectionMap[ vmo.nodeUid ];
                        let eventData;

                        // NOTE: below logic for selectionMap update pertains FillDown
                        // Since autoSave is called right away after the fillDown has completed,
                        // and save is based on a selectionMap that has YET to be updated when the cellRenderer is called.
                        // We cannot rely on events to update the selectionMap
                        // (the event handling could asynchronously happen after the save).
                        // When the save is called, we must have an up-to-date selectionMap
                        if( opCode === 0 || pca0FeatureDispositionLovEditService.isLovEntrySupported( featureDisposition, vmo ) ) {
                            // If node is not defined: no existing selection for that node
                            // - add entry to selectionMap only if selectionState is not 0
                            // (This can happen on fillDown when dragging a value to a cell with no authored selections)
                            // If node is defined
                            // If selectionState is different, modify selection in map
                            // (We assume this is a fill-down scenario)

                            // Update selectionMap and dirtyElements list
                            // Below logic pertains FillDown.

                            if( _.isUndefined( node ) && opCode !== 0 ||
                                !_.isUndefined( node ) && node.selectionState !== opCode ) {
                                eventData = {
                                    gridId: 'bottomConstraintsGrid',
                                    vmo: vmo,
                                    columnField: column.name,
                                    dbValue: opCode,
                                    isColumnAction: false,
                                    cell: cell
                                };

                                let updatedVariabilityProps = pca0GridAuthoringService.populateUserEdits(
                                    vmVariabilityProps, // vmVariabilityProps
                                    eventData, // eventData
                                    vmGridData // gridData
                                );

                                // Update variabilityProps (dirtyElements)
                                vmVariabilityProps.setAtomicData( updatedVariabilityProps );
                            }
                        } else {
                            // Value is not allowed.
                            // This can happen on fillDown when dragging from feature to family or vice-versa.

                            // Enforce older dbValue
                            // [values were set on active fillDown]
                            // If node has entry in selectionMap, revert to that value
                            // Otherwise, set 0
                            // Also
                            // - Set the old value as the active featureDisposition to be enforced
                            // - Reset dirty flag
                            // - Remove 'changed' style from cell
                            if( !_.isUndefined( node ) ) {
                                let featureDispositionsLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov;
                                featureDisposition = _.find( featureDispositionsLov, { operatorCode: node.selectionState } );
                            } else {
                                featureDisposition = undefined;
                            }

                            // We need to reset several props to avoid fillDown value to be anyhow persisted on the cell
                            vmo.props[ column.name ].dbValue = !_.isUndefined( node ) ? node.selectionState : '';
                            vmo.props[ column.name ].dirty = false;
                            vmo.props[ column.name ].valueUpdated = false;
                            vmo.props[ column.name ].displayValues = !_.isUndefined( node ) ? [ node.selectionState ] : [ '' ];
                            vmo.props[ column.name ].uiValue = !_.isUndefined( featureDisposition ) ? featureDisposition.displayName : '';
                            vmo.props[ column.name ].value = !_.isUndefined( featureDisposition ) ? featureDisposition.displayName : '';

                            cell.classList.remove( 'changed' );
                        }

                        cell.innerText = !_.isUndefined( featureDisposition ) ? featureDisposition.displayName : '';

                        // Add LOV description as tooltip:
                        // - if OpCode is not empty, use text otherwise
                        // - only if node is leaf or expanded (i.e.: do not modify tooltip text for summary)
                        cell.setAttribute( 'title', !_.isUndefined( featureDisposition ) ? featureDisposition.description : '' );
                    }
                }
            } else if( !_.isUndefined( vmo.props[ column.name ] ) ) {
                textValue = vmo.props[ column.name ].uiValue;
                titleValue = textValue;

                cell.innerText = textValue;
                cell.setAttribute( 'title', titleValue );
            }
            return cell;
        },
        condition: column => {
            return !column.isTreeNavigation;
        },
        name: 'lovMatrixCellRenderer'
    };
};

/**
 * Table Command Cell Renderer for PL Table
 * Apply onClick listener to handle "FreeForm" selection
 * @param {Function} handleCellClick - callback for handlick click events on cell
 * @param {String} contextKey - context key
 * @param {UwDataProvider} treeDataProvider - the Tree Data provider
 * @param {Object} vmGridSelectionState - VM gridSelectionState atomic data
 * @return {Object} cell renderer
 */
export let filterCellRenderer = ( handleCellClick, contextKey, treeDataProvider, vmGridSelectionState ) => {
    return {
        action: ( column, vmo, tableElem, rowElement ) => {
            let cell = tableSvc.createElement( column, vmo, tableElem, rowElement );
            if( vmo.isSpecialBackgroundCell ) {
                if( !_.isUndefined( rowElement /*Safety check: we should always have rowElement defined*/ ) ) {
                    rowElement.classList.add( 'aw-cfg-headerBackgroundCell' );
                }
                cell.classList.add( 'aw-cfg-headerBackgroundCell' );
            }

            cell.onclick = function() {
                _handleCellClick( contextKey, handleCellClick, cell, vmo, column, treeDataProvider, vmGridSelectionState /* do not send flag for isSnoMatrix, not relevant here */ );
            };
            return cell;
        },
        condition: column => {
            return column.isTreeNavigation || column.isColumnFromCots;
        },
        name: 'filterCellRenderer'
    };
};

/**
 * Add the background color to the table column header cell
 * @param {String} titleName - Column Display Name of the element for which the highlighted style is to be set
 * @param {String} colorClassName - CSS class Name to apply on node
 * @param {String} gridId - Grid id on which column header to be coloured
 */
export let colorifyHeaderCell = ( titleName, colorClassName, gridId ) => {
    const grid = document.querySelector( 'aw-splm-table [id="' + gridId + '"]' );
    const header = grid.querySelector( '.aw-splm-tableHeaderCellContents[title="' + titleName + '"]' );
    header && !header.classList.contains( colorClassName ) && header.classList.add( colorClassName );
};

/**
 * Dim the completeness status icon for a specific column in a grid to indicate it is stale.
 *
 * @param {string} titleName - The title of the column whose completeness status is to be marked as stale.
 * @param {string} gridId - The ID of the grid containing the column.
 */
export let staleCompletenessStatusIcon = ( titleName, gridId ) => {
    const grid = document.querySelector( 'aw-splm-table [id="' + gridId + '"]' );
    const header = grid.querySelector( '.aw-splm-tableHeaderCellContents[title="' + titleName + '"]' );
    const completnessStatusIcon = header.querySelector( '.aw-cfg-gridEditorHeaderIcon' );
    if( completnessStatusIcon ) {
        completnessStatusIcon.classList.add( 'aw-cfg-disableSelection' );
    }
};

/**
 * Clear the background color of table column header cell
 * @param {String} titleName - Column Display Name of the element for which the color is to be cleared - note: it may not be unique i.e.NewVariant title
 * @param {String} colorClassName - CSS class Name to remove from the node
 * @param {String} gridId - Grid id on which column header to be uncoloured
*/
export let unColorifyHeaderCell = ( titleName, colorClassName, gridId ) => {
    const grid = document.querySelector( 'aw-splm-table [id="' + gridId + '"]' );
    if( !grid ) {
        return;
    }
    const header = grid.querySelector( '.aw-splm-tableHeaderCellContents[title="' + titleName + '"]' );
    header && header.classList.contains( colorClassName ) && header.classList.remove( colorClassName );
};

/**
 * Function to create tooltip information for a column.
 * @param {Object} column - The column to create tooltip information for.
 * @returns {Object} An object containing tooltip details, a flag indicating if the tooltip should be shown, and the URL of the warning icon.
 */
export let createExpressionNonGridableTooltipInfoIfApplicable = ( column ) => {
    // If the column is non-gridable, create tooltip information.
    if( column.isExpressionNonGridable ) {
        // Define the details of the non-gridable expression tooltip.
        const expressionNonGridableTooltipDetails = {
            legendType: 'NonGridableExpressionTooltip',
            legendItems: [],
            infoIconUrl: getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_INFO, // This icon is for INSIDE extended tooltip
            attentionIconUrl: getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_ATTENTION,
            isExpressionNonGridable: column.isExpressionNonGridable
        };

        // Set a flag to show the non-gridable expression tooltip.
        let showExpressionNonGridableTooltip = true;

        // Create a view model property for the formula.
        let vmProp = uwPropertyService.createViewModelProperty(
            'fnd0formula', // propertyName
            'Formula', // propertyDisplayName
            'STRING', // dataType
            column.formula, // dbValue
            [ column.formula ] // displayValuesIn
        );

        // Set the field data for the view model property.
        vmProp.fielddata = {
            propertyDisplayName: 'Formula', // propertyName
            uiValue: column.formula
        };

        // Add the view model property to the legend items of the tooltip details.
        expressionNonGridableTooltipDetails.legendItems.push( vmProp );

        // Return the tooltip details, the flag, and the warning icon URL.
        return {
            expressionNonGridableTooltipDetails,
            showExpressionNonGridableTooltip
        };
    }

    // If the column is gridable, return an empty object.
    return {};
};

/**
 * Function to populate the header icon and tooltip information for a column.
 * @param {Object} column - The column to populate the header icon and tooltip information for.
 * @returns {Object} An object containing the URL of the header icon and the tooltip information.
 */
export let populateHeaderIconAndTooltipInfo = ( column ) => {
    // Initialize the URL of the header icon to an empty string.
    let headerIconUrl = '';

    // Get the UID of the column.
    const uid = column.uid;

    // If the UID exists, the column is not a split column, and the object with the UID exists,
    // create a new view model object and get the URL of the type icon.
    if( uid && !column.isSplitColumn && cdm.getObject( uid ) ) {
        const newVMO = viewModelObjectService.createViewModelObject( uid, 'Edit' );
        headerIconUrl = newVMO.typeIconURL;
    }

    // Create the tooltip information for the column if the expression is non-gridable.
    // If the expression is gridable, the tooltip information will be empty.
    const nonGridableExpressionTooltipInfo = exports.createExpressionNonGridableTooltipInfoIfApplicable( column );

    // Return the URL of the header icon and the tooltip information.
    return { headerIconUrl, nonGridableExpressionTooltipInfo };
};

/**
 * <TODO> move to header service
 * Post-process validation complete
 * Checks if violation is present after column validate and updates the column header tooltip
 * @param {Object} eventData event data container
 * @param {Object} column AwColumnInfo being analyzed to check for violations
 * @returns {Object} Information container with violation/tooltip details/errorIcon
 */
export let checkViolations = ( eventData, column ) => {
    if( !_.isUndefined( eventData.column ) && eventData.column.field !== column.field ) {
        return;
    }

    let tooltipDetails = {};
    let columnToValidationMap = eventData.columnToValidationMap;
    let violationsInColumn = !_.isUndefined( columnToValidationMap ) && Object.keys( columnToValidationMap ).length > 0 &&
        columnToValidationMap.hasOwnProperty( column.field ) && !_.isUndefined( columnToValidationMap[ column.field ] );
    let errorIconUrl = getBaseUrlPath() + '/image/' + pca0Constants.CFG_INDICATOR_ICONS.SVG_INDICATOR_ERROR;
    // Clear childNodes for iconRow

    if( violationsInColumn ) {
        // Create tooltip element
        tooltipDetails = {
            dispValue: columnToValidationMap[ column.field ]
        };
    }
    return { violationsInColumn, tooltipDetails, errorIconUrl };
};

/**
 * This function is a renderer function for selection type for features
 * @param {Object} vmo The view model object
 * @param {Object} containerElem The container cell
 */
export let featureSelectionTypeRenderer = ( vmo, containerElem ) => {
    // Custom cell template to render selection type
    let cell = document.createElement( 'div' );
    cell.className = 'aw-splm-tableCellTop';

    // render selection type icon - user/system/default or unconfigured if existing
    let selectionStatusIcon = document.createElement( 'img' );
    selectionStatusIcon.className = 'aw-cfg-tableSelectionIcon';
    const unconfiguredIcon = _.get( vmo, 'selectionTypeData.unconfiguredIcon' );
    if( unconfiguredIcon ) {
        selectionStatusIcon.src = unconfiguredIcon;
        selectionStatusIcon.title = _localeFSCTextBundle.isUnconfigured;
    } else {
        selectionStatusIcon.src = vmo.selectionTypeData.selectionTypeIcon;
        // Adding tooltip for selection summary icons column
        const selectionStateTitles = {
            1: _localeConfiguratorTextBundle.userPositive,
            2: _localeConfiguratorTextBundle.userNegative,
            5: _localeConfiguratorTextBundle.defaultPositive,
            6: _localeConfiguratorTextBundle.defaultNegative,
            9: _localeConfiguratorTextBundle.systemPositive,
            10: _localeConfiguratorTextBundle.systemNegative
        };

        selectionStatusIcon.title = selectionStateTitles[vmo.selectionState];
    }
    cell.appendChild( selectionStatusIcon );
    containerElem.appendChild( cell );
};

/**
 * Renderer function for the configuration module table - the indicator column
 * @param {Object} vmo The view model object
 * @param {Object} containerElem The container cell
 */
export let configModuleHierarchyValidationStateIconRenderer = ( vmo, containerElem ) => {
    let validationStateIcon = vmo.validationStateIcon;
    if( !validationStateIcon ) {
        return;
    }
    let cellImg = document.createElement( 'img' );
    cellImg.className = 'aw-visual-indicator';
    cellImg.title = _localeCommonUtilsTextBundle[ validationStateIcon ];
    let imgSrc = 'assets/image/' + validationStateIcon + '16.svg';
    cellImg.src = imgSrc;
    containerElem.appendChild( cellImg );
};

/**
 * Indicator column renderer function
 * @param {Object} vmo The view model object
 * @param {Object} containerElem The container cell
 */
export let variabilityCheckBoxRenderer = function( vmo, containerElem ) {
    if( _.isUndefined( vmo.modelType ) ) {
        return;
    }
    let cellImg = _createCheckboxElement();

    const applicableTypes = [ ...pca0Constants.CFG_FAMILY_TYPES, ...pca0Constants.CFG_FAMILY_FEATURES_TYPES ];

    const clientScopeURI = appCtxService.getCtx( 'sublocation.clientScopeURI' );
    // For Advanced reuse mode we want to show the check boxes on Groups also.
    if( clientScopeURI === veConstants.CLIENT_SCOPE_URI.FEATURES ) {
        applicableTypes.push( pca0Constants.CFG_OBJECT_TYPES.ABS_FAMILY_GROUP );
    }

    if( !vmo.isLeaf && ( vmo.type === pca0Constants.PSEUDO_GROUPS_UID.UNASSIGNED_GROUP_UID ||
        vmo.modelType && _.intersection( vmo.modelType.typeHierarchyArray, applicableTypes ).length === 0 ) ) {
        cellImg.style.visibility = 'hidden';
    }

    if( vmo.selected ) {
        cellImg.checked = true;
        cellImg.disabled = false;
    }
    if( vmo.isPreselected ) {
        cellImg.checked = true;
        cellImg.disabled = true;
    }

    containerElem.appendChild( cellImg );
};


/**
 * Configurator formula table cell renderer
 * @return {Object} cell renderer
 */
export let formulaTableCellRenderer = () => {
    const CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER = 'aw-cfg-formula-edit-gridCellCommand';
    let _cellCmdElemArr = [];
    let _cellCmdVmoArr = [];

    const createCommandCellHandler = ( cellTop, column, vmo, tableElem ) => {
        return () => {
            if ( !tableElem._tableInstance.isBulkEditing && !tableElem._tableInstance.showCheckBox && cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER ).length === 0 ) {
                if( _cellCmdElemArr.length > 0 ) {
                    _cellCmdElemArr.forEach( ( elem, index ) => {
                        if( elem && !_cellCmdVmoArr[ index ].isEditing ) {
                            destroyHoverCommandElement( elem );
                        }
                    } );
                }
                let cmdElem = _createCellCommandElement( column, vmo );
                cmdElem.classList.add( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER );
                cellTop.appendChild( cmdElem );

                _cellCmdElemArr.push( cmdElem );
                _cellCmdVmoArr.push( vmo );
            }
        };
    };

    const destroyCommandCellHandler = ( cellTop, column, vmo, tableElem ) => {
        return () => {
            if ( !tableElem._tableInstance.showCheckBox && cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER ).length === 1 && cellTop.getElementsByClassName( 'aw-state-selected' ).length === 0 && !vmo.isEditing ) {
                destroyHoverCommandElement( cellTop.getElementsByClassName( CLASS_AW_CFG_FORMULA_CELL_COMMANDS_CONTAINER )[ 0 ] );
            }
        };
    };

    const destroyHoverCommandElement = ( cmdElem ) => {
        if ( cmdElem && cmdElem.parentElement ) {
            cmdElem.parentElement.removeChild( cmdElem );
        }
        const cmdElemIndex = _cellCmdElemArr.indexOf( cmdElem );
        if ( cmdElemIndex > -1 ) {
            _cellCmdElemArr.splice( cmdElemIndex, 1 );
            _cellCmdVmoArr.splice( cmdElemIndex, 1 );
        }
    };

    const addCommandOnHover = ( commandHandlerParent, column, vmo, tableElem ) => {
        // Add event listener for mouseover
        commandHandlerParent.addEventListener( 'mouseover', createCommandCellHandler( commandHandlerParent, column, vmo, tableElem ) );
    };

    const removeCommandOnHover = ( commandHandlerParent, column, vmo, tableElem ) => {
        // Add event listener for mouseleave
        commandHandlerParent.addEventListener( 'mouseleave', destroyCommandCellHandler( commandHandlerParent, column, vmo, tableElem ) );
    };
    return {
        action: ( column, vmo, tableElem, rowElem ) => {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            if ( cellContent ) {
                // Add command on hover
                addCommandOnHover( cellContent, column, vmo, tableElem );
                // Remove command on hover
                removeCommandOnHover( cellContent, column, vmo, tableElem );
            }
            return cellContent;
        },
        condition: ( column ) => {
            return pca0Constants.EDITABLE_PROPERTIES.includes( column.propertyName );
        },
        name: 'formulaTableCellRenderer'
    };
};

/**
 *  Row background renderer
 */
export const variabilityContentBackgroundRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        let isChanged = false;
        if ( vmo && vmo.props ) {
            _.forEach( vmo.props, function( prop ) {
                if ( _.get( vmo.props[prop.name], 'valueUpdated' ) ) {
                    isChanged = true;
                }
            } );
        }
        if ( isChanged && rowElem ) {
            rowElem.classList.add( 'aw-cfg-changedRowBackgroundColor' );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        let isChanged = false;
        if ( vmo && vmo.props ) {
            _.forEach( vmo.props, function( prop ) {
                if ( _.get( vmo.props[prop.name], 'valueUpdated' ) ) {
                    isChanged = true;
                }
            } );
        }
        return isChanged;
    },
    name: '_variabilityContentBackgroundRenderer'
};

/**
 *  highlight row renderer
 */
export const rowHighlightRenderer = {
    action: function( column, vmo, tableElem, rowElem ) {
        let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
        if ( rowElem && vmo && vmo.highlight ) {
            rowElem.classList.add( 'aw-cfg-highlightDifferenceVmo' );
        } else if ( rowElem && vmo && !vmo.highlight ) {
            rowElem.classList.remove( 'aw-cfg-highlightDifferenceVmo' );
        }
        return cellContent;
    },
    condition: function( column, vmo ) {
        return vmo.highlight;
    },
    name: '_rowHighlightRenderer'
};

export default exports = {
    iconCellRenderer,
    lovMatrixCellRenderer,
    filterCellRenderer,
    colorifyHeaderCell,
    staleCompletenessStatusIcon,
    unColorifyHeaderCell,
    createExpressionNonGridableTooltipInfoIfApplicable,
    populateHeaderIconAndTooltipInfo,
    checkViolations,
    featureSelectionTypeRenderer,
    configModuleHierarchyValidationStateIconRenderer,
    variabilityCheckBoxRenderer,
    formulaTableCellRenderer,
    variabilityContentBackgroundRenderer,
    rowHighlightRenderer
};
