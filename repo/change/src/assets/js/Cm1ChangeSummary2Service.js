// Copyright (c) 2023 Siemens

/**
 *
 * @module js/Cm1ChangeSummary2Service
 */

import awColumnSvc from 'js/awColumnService';
import awTableTreeSvc from 'js/splmTablePublishedTreeService';
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import tableSvc from 'js/splmTablePublishedService';
import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import preferenceService from 'soa/preferenceService';
import cmm from 'soa/kernel/clientMetaModel';
import iconSvc from 'js/iconService';
import localeSvc from 'js/localeService';
import xrtUtilities from 'js/xrtUtilities';
import adapterService from 'js/adapterService';
import { isViewModelTreeNode } from 'js/treeDataProviderRequestResponseHelper';
import viewModelObjectService from 'js/viewModelObjectService';
import dmSvc from 'soa/dataManagementService';
import ChangeSummaryService from 'js/Cm1ChangeSummaryService';
import compareSvc from 'js/structureCompareService';
import awTableStateSvc from 'js/awTableStateService';
import uwPropertyService from 'js/uwPropertyService';
import eventBus from 'js/eventBus';
import browserUtils from 'js/browserUtils';
import fmsUtils from 'js/fmsUtils';

var exports = {};
var isPreviousRowBottomBorder = false;
var isSupersedure = false;

/**
 *
 * @param {Object} res response from getChangeSummaryData3 soa.
 * @param {Object} dataProvider changeSummaryDataProvider
 * @returns {Object} - Column config object.
 */
export let initColumnsForChangeSummaryTable2 = function( res, dataProvider, columnProvider ) {
    // Build AW Columns
    let awColumnInfos = [];

    const newTabTitle = localeSvc.getLoadedTextFromKey( 'ChangeMessages.cm1IndicatorColumnGroupHeader' );
    let iconColumnHeader = newTabTitle;

    let isColumnPinnedLeft = false;
    let enableColumnMoving = true;
    let sortDirection = null;
    let columnInternalName = '';

    let indicatorGroupHeaderColumnInfo = {
        name: iconColumnHeader,
        displayName: iconColumnHeader,
        columnHeaderTranspose: false,
        isFilteringEnabled: false,
        enableSorting: false,
        enableColumnMoving: false,
        clientColumn: true,
        isClientColumn: true,
        propertyName: iconColumnHeader
    };
    let indicatorGroupHeaderColumnDef = awColumnSvc.createColumnInfo( indicatorGroupHeaderColumnInfo );

    for( let index = 0; index < res.currentColumnConfig.length; index++ ) {
        columnInternalName = res.currentColumnConfig[ index ].columnInternalName ?? '';

        //Pin these columns to left.
        isColumnPinnedLeft = false;
        if( columnInternalName === 'ELEMENT' ||
            columnInternalName === 'compare' ||
            columnInternalName === 'action' ||
            columnInternalName === 'mergeStatus' ) {
            isColumnPinnedLeft = true;
        }
        let firstColumn = false;
        let isTreeNavigation = false;

        // For first column we do not show column menu as freeze option is not valid for first column and that's the only menu item we have.
        if( columnInternalName === 'ELEMENT' ) {
            firstColumn = true;
            isTreeNavigation = true;
        }
        // TODO: REMOVE BELOW LOGIC ONCE YOU GET SORT INFO IN COLUMN CONFIG OF SERVER RESPONSE
        sortDirection = '';
        if ( columnProvider?.sortCriteria?.[0]?.fieldName === columnInternalName ) {
            sortDirection = columnProvider?.sortCriteria?.[0]?.sortDirection;
        }

        let columnInfo = {
            name: columnInternalName,
            propertyName: columnInternalName,
            displayName: res.currentColumnConfig[ index ].columndisplayName,
            typeName: res.currentColumnConfig[ index ].sourceTypeName,
            pixelWidth: res.currentColumnConfig[ index ].pixelWidth,
            hiddenFlag: res.currentColumnConfig[ index ].hiddenFlag,
            isCompareColumn: res.currentColumnConfig[ index ].isCompareColumn,
            firstColumn: firstColumn,
            enableColumnMenu: true,
            cellRenderers: [ _cellRenderer(), _compareCellRenderer() ],
            isTreeNavigation: isTreeNavigation,
            pinnedLeft: isColumnPinnedLeft,
            enableColumnMoving: enableColumnMoving,
            sortDirection: sortDirection
        };

        if( columnInternalName.startsWith( 'Indicator_' ) ) {
            columnInfo.parentName = iconColumnHeader;
            columnInfo.isFilteringEnabled = false;
            columnInfo.enableSorting = false;
            columnInfo.enableColumnMoving = false;
        }

        let awColumnInfo = awColumnSvc.createColumnInfo( columnInfo );
        awColumnInfos.push( awColumnInfo );
    }

    awColumnInfos.push( indicatorGroupHeaderColumnDef );

    // When there is an error in soa call, currentColumnConfig is empty.
    // Adding check for column config if it is empty from server then restoring the previous config.
    if( awColumnInfos.length > 1 ) {
        dataProvider.columnConfig = {};
        // Set columnConfig to Data Provider.
        return  dataProvider.columnConfig = {
            columns: awColumnInfos
        };
    }
    return dataProvider.columnConfig;
};

/**
  * Table Cell Renderer for PL Table
  * @returns {Object} - Cell renderer for change summary table
  */
let _cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            let attachTooltip = function( event ) {
                let tooltipDetails = {
                    vmo: vmo,
                    prop: vmo.props[ column.field ]
                };

                const subPanelContext = { tooltipDetails };
                let extendedTooltipElement = includeComponent( 'Cm1ChangeSummaryExtendedTooltip', subPanelContext );

                let renderedTooltipElement = document.createElement( 'div' );
                renderComponent( extendedTooltipElement, renderedTooltipElement );

                const appendExtendedTooltipElement = function( renderedTooltipElement, event ) {
                    const cellContentEl = event.currentTarget;
                    if ( !cellContentEl ) {
                        return;
                    }
                    const parentEl = cellContentEl.parentNode;
                    const extendedTooltipEl = renderedTooltipElement?.lastChild;

                    // renderedTooltipElement - div element which has extended tooltip.
                    // renderedTooltipElement.lastChild - extended tooltip element.
                    // cellContentEl - cellcontent - <ul> <li></li> </ul>.
                    extendedTooltipEl?.classList.remove( 'aw-splm-tableCellTop' );
                    if( extendedTooltipEl && cellContentEl?.className && cellContentEl?.childNodes?.[0] ) {
                        //copy the classes from <ul> which requires for wrap text functionality.
                        extendedTooltipEl.className = cellContentEl.className;
                        // Moving the <li> which is child of <ul> to extended tooltip.
                        cellContentEl.childNodes && extendedTooltipEl?.append( ...cellContentEl.childNodes );
                        // Removing the unnecessary <ul> element from parent.
                        parentEl?.removeChild( cellContentEl );
                        // Add extended tooltip element to parent container.
                        parentEl?.appendChild( extendedTooltipEl );
                    }
                    cellContent.removeEventListener( 'mouseenter', attachTooltip, true );
                };

                let observerCallback = function( mutationsList, observer ) {
                    for ( let mutation of mutationsList ) {
                        if ( mutation.type === 'childList' && mutation.target === renderedTooltipElement && mutation.addedNodes?.[0]?.className !== 'aw-splm-gridCellCommandsContainer'
                            && event?.currentTarget?.childNodes?.[0] ) {
                            appendExtendedTooltipElement( renderedTooltipElement, event );
                            observer.disconnect();  // Stop observing after the action is done
                        }
                    }
                };

                // Create an observer instance
                let observer = new MutationObserver( observerCallback );

                // Observe the renderedTooltipElement for changes in child nodes
                observer.observe( renderedTooltipElement, { childList: true } );

                // If renderedTooltipElement is already rendered, invoke append directly
                if ( renderedTooltipElement && renderedTooltipElement.childNodes.length ) {
                    appendExtendedTooltipElement( renderedTooltipElement, event );
                }
            };

            //This Action should be focus on indicators. Other than that don't rely on this action as it degrades the performance.
            let cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );

            //Start Supersedure group Element Cell
            //Start Supersedure group Element Column
            if( vmo.supersedure_Begin ) {
                rowElem.classList.add( 'aw-change-changeSummaryTableTopBorder' );
            }

            //Start Supersedure group Element Column
            if( vmo.supersedure_End ) {
                rowElem.classList.add( 'aw-change-changeSummaryTableBottomBorder' );
            }

            if ( column.name === 'mergeStatus' && vmo.props.m_mergeStatus?.dbValues ) {
                appCtxSvc.registerCtx( 'isMergeCommandVisible', true );
                const iconWrapper = document.createElement( 'div' );

                if ( vmo.props.m_mergeStatus.dbValues.length === 1 ) {
                    iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header aw-commands-mergeStatusSingleForChangeSummary';
                } else {
                    iconWrapper.className = 'aw-commands-mergeStatusMultipleValuesForChangeSummary';
                }

                const dbValues = vmo.props.m_mergeStatus.dbValues;
                const uiValues = vmo.props.m_mergeStatus.uiValues;

                dbValues.forEach( ( mergeStatusSourceAssembly, index ) => {
                    const mergeStatusValue = uiValues[index];
                    // Get icon element for mergeStatus
                    setIconElementForMergeStatus( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent );
                } );
            }

            if ( column.name !== 'mergeStatus' ) {
                cellContent.addEventListener( 'mouseenter', attachTooltip, true );
            }
            return cellContent;
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return !column.name.includes( 'Indicator_' ) && !column.isCompareColumn;
        }
    };
};

/**
  * Table Cell Renderer for PL Table
  * @returns {Object} - Cell renderer for change summary table
  */
let _compareCellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            var cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );

            // Add compare button if is compare
            if( vmo.props?.isCompareRow?.dbValues?.[0]?.toLowerCase() === 'true' ) {
                let compareIconElement = includeComponent( 'Cm1ChangeSummaryCompareIcon', {} );
                let renderedElement = document.createElement( 'div' );

                let appendCompareIconElement = function( renderedElement, cellContent ) {
                    if ( renderedElement ) {
                        let extendedTooltipEl = renderedElement?.childNodes?.[0];
                        extendedTooltipEl?.childNodes?.[0]?.classList?.remove( 'aw-commands-commandIconButtonForChangeSummary' );
                        renderedElement.onclick = function( event ) {
                            event.preventDefault();
                            event.stopPropagation();
                            var primaryObjectUid = vmo.cm1UnderlyingPrimaryObjectUID;
                            var secondaryObjectUid = vmo.cm1UnderlyingSecondaryObjectUID;
                            if( primaryObjectUid !== '' && secondaryObjectUid !== '' ) {
                                var targetObject = cdm.getObject( primaryObjectUid );
                                var sourceObject = cdm.getObject( secondaryObjectUid );

                                var mSelected = [];
                                mSelected.push( sourceObject );
                                mSelected.push( targetObject );

                                appCtxSvc.updatePartialCtx( 'mselected', mSelected );
                                compareSvc.launchContentCompare();
                            }
                        };

                        var iconWrapper = document.createElement( 'div' );
                        iconWrapper.className = 'ui-grid-tree-base-row-header-buttons ui-grid-tree-base-header';
                        iconWrapper.appendChild( renderedElement );
                        cellContent.appendChild( iconWrapper );
                    }
                };

                if( renderedElement ) {
                    renderComponent( compareIconElement, renderedElement );
                }

                let observerCallback = function( mutationsList, observer ) {
                    for ( let mutation of mutationsList ) {
                        if ( mutation.type === 'childList' && mutation.target === renderedElement && mutation.addedNodes?.[0]?.className !== 'aw-splm-gridCellCommandsContainer' ) {
                            appendCompareIconElement( renderedElement, cellContent );
                            observer.disconnect();  // Stop observing after the action is done
                        }
                    }
                };

                // Create an observer instance
                let observer = new MutationObserver( observerCallback );

                // Observe the renderedElement for changes in child nodes
                observer.observe( renderedElement, { childList: true } );

                return cellContent;
            }
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return column.isCompareColumn;
        }
    };
};

/**
 * Render merge indicator icon in cell.
 * @param {String} mergeStatusSourceAssembly - source assembly uid for merge status
 * @param {*} vmo - view model object
 * @param {*} iconWrapper - icon wrapper element
 * @param {*} cellContent - cell content element
 * @param {*} mergeIndicatorComponent - merge indicator component
 */
const _renderMergeIndicator = function( mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeIndicatorComponent ) {
    const renderedElement = document.createElement( 'div' );

    const appendIndicatorMergeElement = function() {
        if ( renderedElement ) {
            let sourceAssemblyUid = mergeStatusSourceAssembly;
            renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';

            renderedElement.onclick = function( event ) {
                event.preventDefault();
                event.stopPropagation();

                let sourceUid = sourceAssemblyUid;
                let targetUid;

                // LCS-833590 - in case of multi-level structure, if vmo is not leaf
                // vmo.cm1UnderlyingObj.uid is null, hence adding below check.
                if ( vmo.isEbom && vmo.isLeaf ) {
                    targetUid = vmo.parentNodeUID;
                    sourceUid = vmo.parentNodeUID;
                } else {
                    targetUid = vmo.cm1UnderlyingObj.uid;
                }

                if ( sourceUid !== '' && targetUid !== '' ) {
                    const sourceTargetObjects = [];
                    const targetObject = cdm.getObject( targetUid );
                    const sourceObject = cdm.getObject( sourceUid );

                    sourceTargetObjects.push( sourceObject, targetObject );

                    if ( vmo.isEbom && vmo.isLeaf ) {
                        sourceTargetObjects.push( cdm.getObject( sourceAssemblyUid ) );

                        if ( vmo.cm1UnderlyingSecondaryObject !== null ) {
                            sourceTargetObjects.push( cdm.getObject( vmo.cm1UnderlyingSecondaryObject.uid ) );
                        }
                    }

                    appCtxSvc.updatePartialCtx( 'mselected', sourceTargetObjects );

                    const requestPrefValue = {
                        dataFilterMode: 'compare',
                        showChange: [ 'true' ]
                    };

                    appCtxSvc.updatePartialCtx( 'requestPref', requestPrefValue );

                    // vmo.solItemRev has uid for partUsgRev which we want to show in UI for the case of remove operation in usg bom,
                    // so, only if vmo.solItemRev has uid, pass it to launchMergeSplitView otherwise don't (making use of ternary operation to do that)
                    vmo.solItemRev ?
                        ChangeSummaryService.launchMergeSplitView( vmo.solItemRev ) :
                        ChangeSummaryService.launchMergeSplitView();
                }
            };

            iconWrapper.appendChild( renderedElement );
            cellContent.appendChild( iconWrapper );
        }
    };

    let appendIndicatorMergeElementCallBack = function() {
        setTimeout( function() { appendIndicatorMergeElement(); }, 100 );
    };

    if( renderedElement ) {
        renderComponent( mergeIndicatorComponent, renderedElement, appendIndicatorMergeElementCallBack );
    }
};

/**
 *
 * @param {String} mergeStatusValue - merge status value.
 * @param {String} mergeStatusSourceAssembly - merge status source assembly.
 * @param {Object} vmo - view model object.
 * @param {HTMLElement} tableElem - table element.
 * @param {HTMLElement} iconWrapper - icon wrapper element.
 * @param {HTMLElement} cellContent - cell content element.
 */
export let setIconElementForMergeStatus = function( mergeStatusValue, mergeStatusSourceAssembly, vmo, tableElem, iconWrapper, cellContent ) {
    if( mergeStatusValue === 'Required' ) {
        //If merge status is required, then we need to show source assembly name along with status value.
        let mergeRequiredElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeRequired', { sourceUid: mergeStatusSourceAssembly } );
        _renderMergeIndicator( mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeRequiredElement );
    } else if( mergeStatusValue === 'Complete' ) {
        let mergeCompleteElement = includeComponent( 'Cm1ChangeSummaryIndicatorMergeComplete', { sourceUid: mergeStatusSourceAssembly } );
        _renderMergeIndicator( mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergeCompleteElement );
    } else if( mergeStatusValue === 'PartialMerge' ) {
        let mergePartialElement = includeComponent( 'Cm1ChangeSummaryIndicatorPartialMerge', { sourceUid: mergeStatusSourceAssembly } );
        _renderMergeIndicator( mergeStatusSourceAssembly, vmo, iconWrapper, cellContent, mergePartialElement );
    }
};

/**
 *
 * @param {Object} changeSummaryData3Response It is the response from changeSummaryData3 soa
 * @param {Object} treeLoadInput It is the tree load input from splm table which has parent information
 * @param {Object} dataProvider It is the dataProvider for change summary table.
 * @returns {Object} - Tree load result to be supplied to change summary table.
 */
export let processChangeSummaryData3Response = function( changeSummaryData3Response, treeLoadInput, data ) {
    //Parse the response and merge the props from json and serviceData.
    let tableRows = [];
    let vmos;
    vmos = JSON.parse( changeSummaryData3Response.changeSummaryJSON )[0]?.objects;

    if( !vmos ) {
        vmos = JSON.parse( changeSummaryData3Response.changeSummaryJSON ).objects;
    }

    let deltaObjects = JSON.parse( changeSummaryData3Response.changeSummaryJSON )[1]?.deltaObjects;

    let defaultColumnConfig = changeSummaryData3Response.defaultColumnConfig;
    let propColumn = null;
    _.forEach( vmos, function( vmo ) {
        if ( vmo && vmo.props ) {
            _.forEach(  vmo?.props, function( prop ) {
                if( deltaObjects?.length > 0 ) {
                    const deltaObj = deltaObjects.find( obj => obj.uid === vmo.uid );
                    if( deltaObj ) {
                        const deltaObjProp = deltaObj.properties.find( deltaProp => deltaProp.name === prop.propertyName );
                        if( deltaObjProp ) { prop.deltaValues = deltaObjProp.deltas; }
                    }
                }
                //TODO: try moving this logic to server to get correct display name of props.
                propColumn = defaultColumnConfig.find( ( column ) => {
                    return column?.columnInternalName === prop?.propertyName;
                } );
                prop.propertyDisplayName = propColumn?.columndisplayName;
            } );
            // oldValue needs to be populated with empty value for added new case to show element in green.
            if( vmo?.props?.action?.dbValues?.[0] === 'Add' || vmo?.props?.action?.dbValues?.[0] === 'New' || vmo?.props?.action?.dbValues?.[0] === 'Replace_New' ) {
                vmo.props.ELEMENT.oldValue = ' ';
            }
            //Check if merge required is present for showing the warning indicator in merge status header.
            if( data.isMergeCandidate && !data.isMergeCandidate.dbValue && vmo?.props?.m_mergeStatus?.uiValues && vmo?.props?.m_mergeStatus?.uiValues[0] === 'Required' ) {
                data.isMergeCandidate.dbValue = true;
            }
            let vmObject = changeSummaryData3Response?.ServiceData?.modelObjects?.[vmo?.uid];
            if ( vmObject ) {
                _.merge(  vmo, vmObject  );
            }
            tableRows.push( vmo );
        }
    } );

    //Store the default column config for resetting the column config in arrange panel.
    data.dataProviders.changeSummaryDataProvider.defaultColumnConfig = changeSummaryData3Response.defaultColumnConfig;

    let children = [];
    let isTopNode = treeLoadInput.parentNode.levelNdx === -1;

    // Create the next level for the children objects.
    var levelNdx = treeLoadInput.parentNode.levelNdx + 1;

    //Get first column name and set it on row.
    let firstColumnName = 'ELEMENT';

    treeLoadInput.compareCriteria = new Object();
    isPreviousRowBottomBorder = false;

    //Change Summary table Support pagination only at first level. So determine whether all of data is loaded aat first level or not.
    let endReached = false;
    let totalFound = changeSummaryData3Response.totalFound;
    let totalLoaded = changeSummaryData3Response.endIndex;
    if( totalLoaded >= totalFound ) {
        endReached = true;
    }

    //Read table state of change summary for checking the expansion state.
    const treeTableState = awTableStateSvc.getTreeTableState( data, 'changeSummaryGrid2' );

    //Create children tree nodes.
    if( tableRows?.length > 0 ) {
        for ( let index = 0; index < tableRows.length; index++ ) {
            let treeNode = createTreeNode( tableRows[index], index, treeLoadInput, firstColumnName, children );
            if( treeNode && levelNdx === 0 && data && !awTableStateSvc.isNodeExpanded( treeTableState, treeNode ) ) {
                awTableStateSvc.saveRowExpanded( data, 'changeSummaryGrid2', treeNode );
            }
            //set incompleteTail on last vmo in this for loop. If not all of solutions are loaded than set incompleteTail to true so subsequent call will get next page of data.
            if ( index === tableRows.length - 1 && !endReached && isTopNode ) {
                treeNode.incompleteTail = true;
            }
            children.push( treeNode );
        }
    }

    //Prepare rootPathNode and Parent vmo.
    let rootPathNodes = [];
    let newTopNode = undefined;
    //Cursor object used for pagination.
    let tempCursorObject = {
        startReached: true,
        endReached: endReached,
        startIndex: totalLoaded
    };
    //Create parent node for first top node.
    if( isTopNode ) {
        let ecn = appCtxSvc.ctx.xrtSummaryContextObject;
        let parentVMO = awTableTreeSvc.createViewModelTreeNode( ecn.uid, ecn.type,
            ecn.modelType.displayName, -1, 0, null );

        if ( treeLoadInput.parentNode.uid !== ecn.uid ) {
            newTopNode = parentVMO;
            newTopNode.cursorObject = tempCursorObject;
        }
        rootPathNodes.push( parentVMO );
    }

    let parentNode = treeLoadInput.parentNode;
    parentNode.cursorObject = tempCursorObject;
    //Build tree result.
    let treeLoadResult = awTableTreeSvc.buildTreeLoadResult( treeLoadInput, children, true, true,
        endReached, newTopNode );
    treeLoadResult.rootPathNodes = rootPathNodes;

    return treeLoadResult;
};

/**
  * Get file name extension from file name
  *
  * @param {String} fileName file name
  * @return {String} file name extension
  */
function getFileExtension( fileName ) {
    const extIndex = fileName.lastIndexOf( '.' );
    if( extIndex > -1 ) {
        return fileName.substring( extIndex + 1 );
    }
    return null;
}

/**
  * Get the file URL
  *
  * @param {String} fileTicket - The file ticket
  * @return {String} the file URL
  */
function getFileURL( fileTicket ) {
    if( fileTicket ) {
        const FMS_DOWNLOAD = 'fms/fmsdownload/';
        let baseURL = browserUtils.getBaseURL();
        const fileName = fmsUtils.getFilenameFromTicket( fileTicket );
        const fileExtension = getFileExtension( fileName ).toLowerCase();
        if( fileExtension === 'jt' || fileExtension === 'vmb' ) {
            return FMS_DOWNLOAD + '?ticket=' + fileTicket;
        } else if( fileExtension === 'pdf' ) {
            return FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
        }
        return baseURL + FMS_DOWNLOAD + fileName + '?ticket=' + fileTicket;
    }
}

/**
 *
 * @param {Object} vmo - Vmo to create the node.
 * @param {Object} index - index to be used by createViewModelTreeNode api.
 * @param {Object} treeLoadInput - Tree load input .
 * @param {Object} firstColumnName - First column name for displaying the string contents of tree column.
 * @returns {Object} Tree node.
 */
function createTreeNode(  vmo, index, treeLoadInput, firstColumnName, children ) {
    let iconURL = null;
    //Index level of child node.
    let treeLevel = treeLoadInput.parentNode.levelNdx + 1;
    if ( vmo?.props ) {
        let firstColumnDisplayValue =  vmo.props?.[firstColumnName]?.uiValues?.[0] ??  vmo.props?.[firstColumnName]?.oldValue ?? '';

        //Use icon of underlying object.
        let underlyingObject = cdm.getObject( vmo.props?.cm1UnderlyingPrimaryObject?.dbValues?.[0] );
        let iconType = underlyingObject?.type;

        let underlyingUsageRev = {};
        if( vmo.props?.cm1UnderlyingSecondaryObject?.dbValues?.[0] ) {
            underlyingUsageRev = cdm.getObject( vmo.props?.cm1UnderlyingSecondaryObject?.dbValues?.[0] );
        }

        if( underlyingUsageRev && underlyingUsageRev.type === 'Ebm0PartUsageRevision' ) {
            iconType = underlyingUsageRev?.type;
        }
        iconURL = iconSvc.getTypeIconURL( iconType );

        if( underlyingObject?.props.awp0ThumbnailImageTicket?.dbValues?.length > 0 && appCtxSvc.ctx.preferences?.AWB_ShowTypeIcon?.[ 0 ]?.toUpperCase() !== 'TRUE' ) {
            const imageTicket = underlyingObject?.props?.awp0ThumbnailImageTicket?.dbValues?.[ 0 ];
            if( imageTicket && imageTicket !== '' ) {
                iconURL =  getFileURL( imageTicket );
            }
        }

        //Create VmNode for tree table.
        let vmNode = awTableTreeSvc.createViewModelTreeNode( vmo.uid, vmo.type, firstColumnDisplayValue, treeLevel, index,
            iconURL  );
        vmNode.modelType = vmo.modelType;

        //ELIMINATE THIS LOGIC BY ADDING ISARRAY TO TRUE FROM SERVER.
        vmNode.props = { ...vmo.props };
        _.forEach( vmNode.props, function( prop ) {
            if( prop ) {
                prop.isArray = true;
            }
        } );

        if( vmNode.props.isEBOM && vmNode.props.isEBOM.dbValues[0] === 'true' ) {
            vmNode.isEbom = true;
        }

        if( treeLoadInput.parentNode && treeLoadInput.parentNode.cm1UnderlyingObj ) {
            vmNode.parentNodeUID = treeLoadInput.parentNode.cm1UnderlyingObj.uid;
        }

        //Add children data.
        let nodeObj = cdm.getObject( vmNode.uid );
        vmNode.isLeaf = nodeObj?.props.cm1IsLeaf?.dbValues[0] !== '0';
        vmNode.cm1UnderlyingSecondaryObject = cdm.getObject( vmo.props.cm1UnderlyingSecondaryObject.dbValues[0] );

        //Store underlyingObj in vmNode.
        vmNode.cm1UnderlyingObj = cdm.getObject( vmo.props.cm1UnderlyingPrimaryObject?.dbValues?.[0] );
        if( vmNode.cm1UnderlyingObj ) {
            vmNode.cm1UnderlyingObj.typeIconURL = iconURL;

            //Generating unique id for each row but same id for every SOA call. This is used for expansion state caching.
            //RBO is generating different uid for each soa call for same row. Tried creating ID based on underlying object.
            var id = vmNode.cm1UnderlyingObj?.uid + vmNode.props.action?.dbValues?.[0] + index + treeLoadInput.parentNode.levelNdx + treeLoadInput.parentNode.TreeLevelStr ?? '';
            vmNode.TreeLevelStr = ( treeLoadInput.parentNode.TreeLevelStr ?? '' ) + treeLoadInput.parentNode.levelNdx + index;
            vmNode.id = id;
            vmNode.alternateID = id;
        }

        //Calculate tooltip values for each cell.
        calculateTooltip( vmo );

        //Create banding for replace usecase.
        if( vmo.props?.supersedure_Begin?.dbValues?.[0]?.toLowerCase() === 'true' && !isPreviousRowBottomBorder ) {
            vmNode.supersedure_Begin = true;
            isSupersedure = true;
        } else if( vmo.props?.supersedure_End?.dbValues?.[0]?.toLowerCase() === 'true' ) {
            vmNode.supersedure_End = true;
            isPreviousRowBottomBorder = true;
            isSupersedure = false;
        } else if( !isSupersedure ) {
            isPreviousRowBottomBorder = false;
        }

        vmNode.compareCandidates = [];
        //Set First column name
        if( vmNode.isCompareRow || vmo.props.action.dbValues[0] === 'Modify' ) {
            vmNode.cm1UnderlyingPrimaryObjectUID = vmo.props?.cm1UnderlyingPrimaryObject?.dbValues?.[0];
            vmNode.cm1UnderlyingSecondaryObjectUID = vmo.props?.cm1UnderlyingSecondaryObject?.dbValues?.[0];
            if ( vmo.props.action.dbValues[0] === 'Modify' ) {
                vmNode.compareCandidates.push( vmNode.cm1UnderlyingSecondaryObjectUID );
                vmNode.compareCandidates.push( vmNode.cm1UnderlyingPrimaryObjectUID );
            }
        }

        //compareCandidates for each sibling Node
        if ( treeLoadInput.compareCriteria[vmNode.uid] !== undefined ) {
            vmNode.compareCandidates = treeLoadInput.compareCriteria[vmNode.uid];
        }
        if( vmNode.props?.cm1SiblingOf?.dbValues?.[0]?.length > 0 ) {
            let prevNode = children.length > 0 && children.find( node => node?.uid === vmNode.props.cm1SiblingOf.dbValues[0] );
            let sibNode = vmNode;
            reOrderCompareReplaceNodes( prevNode, sibNode, vmo );
            treeLoadInput.compareCriteria[sibNode.uid] = prevNode.compareCandidates;
            treeLoadInput.compareCriteria[sibNode.uid].primaryAction = 'Replace';
        }
        if( vmo.props?.isAbsOccInContextParent?.dbValues?.[0].length > 0 ) {
            vmNode.isAbsOccInContextParent = vmo.props?.isAbsOccInContextParent?.dbValues?.[0] === 'true';
        }
        return vmNode;
    }
}

/**
 * Calculate the tooltip values for each cells in change summary table.
 * @param {Object} vmo - vmo of table row.
 */
export let calculateTooltip = function( vmo ) {
    //Reusing logic from old change summary table to consume existing extended tooltip component.
    _.forEach( vmo.props, function( prop ) {
        let currentUIValuesToProcess = prop.uiValues;
        let currentDBValuesToProcess = prop.dbValues;
        let oldDBValuesToProcess = prop.oldValue;

        let addedDisplayValues = [];
        let addedInternalValues = [];

        let removedDisplayValues = [];
        let removedInternalValues = [];

        let commonDisplayValues = [];
        let commonInternalValues = [];

        let unchangedDisplayValues = [];
        let unchangedInternalValues = [];

        if ( prop.deltaValues ) {
            prop.deltaValues.forEach( function( delta ) {
                if ( delta.type === 'Added' ) {
                    addedDisplayValues = [ delta.value ];
                    addedInternalValues = [ delta.value ];
                } else if ( delta.type === 'Removed' ) {
                    removedDisplayValues = [ delta.value ];
                    removedInternalValues = [ delta.value ];
                } else if ( delta.type === 'Unchanged' ) {
                    unchangedDisplayValues = [ delta.value ];
                    unchangedInternalValues = [ delta.value ];
                }
            } );
        } else {
            // addedDisplayValues and addedInternalValues should be populated
            // when prop.oldValue is empty and prop.uiValues has something.
            if ( currentUIValuesToProcess && currentUIValuesToProcess.length > 0 && ( oldDBValuesToProcess === '' || oldDBValuesToProcess !== undefined ) ) {
                addedDisplayValues = [ ...currentUIValuesToProcess ];
                addedInternalValues = [ ...currentDBValuesToProcess ];
            }

            // removedDisplayValues and removedInternalValues should be populated
            // when prop.oldValue has something and prop.uiValues is not equal to oldValue.
            if( oldDBValuesToProcess && currentUIValuesToProcess?.[0] !== oldDBValuesToProcess ) {
                removedDisplayValues.push( oldDBValuesToProcess );
                removedInternalValues.push( oldDBValuesToProcess );
            }

            // commonDisplayValues and commonInternalValues should be populated
            // when prop.uiValues has something, and prop.oldValue is undefined.
            if ( currentUIValuesToProcess && currentUIValuesToProcess.length > 0 && oldDBValuesToProcess === undefined ) {
                commonDisplayValues = [ ...currentUIValuesToProcess ];
                commonInternalValues = [ ...currentDBValuesToProcess ];
            }
        }

        // Update the property object with the values.
        prop.addedDisplayValues = addedDisplayValues;
        prop.addedInternalValues = addedInternalValues;

        prop.removedDisplayValues = removedDisplayValues;
        prop.removedInternalValues = removedInternalValues;

        prop.commonDisplayValues = commonDisplayValues;
        prop.commonInternalValues = commonInternalValues;

        prop.unchangedDisplayValues = unchangedDisplayValues;
        prop.unchangedInternalValues = unchangedInternalValues;
    } );
};

/**
  * sibling node uid array is ordered based on Removed Nodes are added first in array
  * and Added Nodes are added next for Replace Action
  * @param {*} vmNode  - Replace Action Node
  * @param {*} tableRow
  * @param {*} treeLoadInput
  *
  */
function reOrderCompareReplaceNodes( prevNode, sibNode, tableRow ) {
    if ( sibNode.props.cm1UnderlyingPrimaryObject.dbValues[0] !== undefined && !_.isEmpty( sibNode.props.cm1UnderlyingPrimaryObject.dbValues[0] ) ) {
        prevNode.compareCandidates.push( sibNode.props.cm1UnderlyingPrimaryObject.dbValues[0] );
    }
    prevNode.compareCandidates.push( prevNode.props.cm1UnderlyingPrimaryObject.dbValues[0] );

    if ( sibNode.props.cm1UnderlyingSecondaryObject.dbValues[0] !== undefined && sibNode.props.cm1UnderlyingSecondaryObject.dbValues[0] === '' ) {
        prevNode.compareCandidates.push( sibNode.props.cm1UnderlyingSecondaryObject.dbValues[0] );
    }
}

/**
 *
 * @param {Object} input data required for opening the table.
 */
export let openDetailsOfChangesPanel = function( input ) {
    const { tabToOpen, customDialogAction, subPanelContext, isFullScreenEvent, selectedTab } = input;
    const dialogAction = customDialogAction;
    let isFullScreen = subPanelContext?.fullScreenState?.value === true;
    let tabName = tabToOpen;

    const inputData =  {
        options: {
            view: 'Cm1DetailsOfChanges',
            parent: isFullScreen ? '.aw-change-detailsOfChangesContainer' : '.aw-layout-workareaMain',
            width: 'MEDIUM',
            height: 'FULL',
            subPanelContext: { tabName: tabName },
            push: true,
            isDockable: true,
            isCloseVisible: false,
            commandid: 'Cm1DetailsOfChanges',
            commandicon: 'cmdOpenDetails'
        }
    };
    if( selectedTab && !isFullScreenEvent ) {
        let newSelectedTab = { ...selectedTab };
        newSelectedTab.dbValue = tabName;
        selectedTab.update?.( newSelectedTab );
    }
    if( dialogAction.open && isFullScreenEvent || dialogAction.open && tabName ) {
        dialogAction.show( inputData.options, true );
    } else if( !isFullScreenEvent ) {
        dialogAction.show( inputData.options, false );
    }
};

/**
  * Saved Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  * @param {UwDataProvider} newColumns - Modified column information.
  *
  * @return {SearchResult} Search Result - In case of Change Summary Table this will be empty.
  */
export let saveColumnConfig = function( dataProvider, newColumns ) {
    var updatedColumnNames = [];
    var updatedColumnWidth = [];
    newColumns.forEach( function( newColumn ) {
        var isPropHidden = newColumn.hiddenFlag;
        var propName = newColumn.propertyName;
        if( isPropHidden ) {
            updatedColumnNames.push( propName + ',' + 'hidden' );
        } else {
            updatedColumnNames.push( propName + ',' + 'visible' );
        }

        if( newColumn.pixelWidth ) {
            updatedColumnWidth.push( newColumn.pixelWidth.toString() );
        }
    } );

    var prefNamesToUpdate = [ 'ChangeSummaryWithIndicatorsColumnsShownPref', 'ChangeSummaryWithIndicatorsColumnsShownWidthPref' ];
    var prefValuesToUpdate = [ updatedColumnNames, updatedColumnWidth ];

    preferenceService.setStringValues( prefNamesToUpdate, prefValuesToUpdate );

    return {
        search: ''
    };
};

/**
  * Reset Column configuration
  *
  * @param {UwDataProvider} dataProvider - The data provider for Change Summary Table.
  *
  */
export let resetColumnConfig = function( dataProvider ) {
    //Set User's preference with default values.
    let updatedColumnNames = [];
    let updatedColumnWidth = [];
    let columnWidth = 200;
    let propName = null;

    if ( dataProvider && dataProvider.defaultColumnConfig ) {
        dataProvider?.defaultColumnConfig?.forEach( function( column ) {
            if ( column ) {
                propName = column.columnInternalName;
                updatedColumnNames.push( propName + ',' + 'visible' );
                // TODO: Remove this 30px assignment where it supposed to get from server.
                columnWidth = propName?.includes( 'Indicator_' ) ? '30' : column?.pixelWidth?.toString();
                updatedColumnWidth.push( columnWidth );
            }
        } );
    }

    let prefNamesToUpdate = [ 'ChangeSummaryWithIndicatorsColumnsShownPref', 'ChangeSummaryWithIndicatorsColumnsShownWidthPref' ];
    let prefValuesToUpdate = [ updatedColumnNames, updatedColumnWidth ];

    updatedColumnNames.length > 0 && preferenceService.setStringValues( prefNamesToUpdate, prefValuesToUpdate );

    let columnConfigurations = [];
    if ( dataProvider && dataProvider.columnConfig && dataProvider.columnConfig.columns ) {
        columnConfigurations = [ {
            columnConfigurations: [ {
                columns: dataProvider.columnConfig.columns
            } ]
        } ];
    }

    return {
        columnConfigurations: columnConfigurations
    };
};

/**
 *
 * @param {Object} response - reponse from expandGRMRelationsForPrimary to get secondary objects
 * @returns {Object} - Array of secondary objects.
 */
export let processSecondaryObject = function( response ) {
    let availableSecondaryObject = [];
    if( response.output[ 0 ].relationshipData[ 0 ].relationshipObjects ) {
        availableSecondaryObject = response.output[ 0 ].relationshipData[ 0 ].relationshipObjects.map( ( relationshipObject ) => {
            let typeIconFileName = cmm.getTypeIconFileName( relationshipObject.otherSideObject.modelType );

            return {
                type: relationshipObject.otherSideObject.type,
                propDisplayValue: relationshipObject.otherSideObject.props.object_string.uiValues[0],
                dispValue: relationshipObject.otherSideObject.props.object_string.uiValues[0],
                propInternalValue: relationshipObject.otherSideObject.uid,
                parentUid: relationshipObject.otherSideObject.uid,
                iconName: typeIconFileName
            };
        } );
    }
    return availableSecondaryObject;
};


/*
 * Change summary column header renderer
 * Custom Header renderer is required because for merge status column we need to show icon instead of column name
 */
export let changeSummaryTableHeaderRender = function( containerElement, columnField, tooltip, column ) {
    let headerContent = document.createElement( 'div' );
    headerContent.className = 'sw-row aw-change-columnHeaderTextWrapAuto';

    // Add column header label
    if( column?.name && !column?.isCompareColumn ) {
        var labelFilter = document.createElement( 'div' );
        labelFilter.textContent = column.displayName;
        headerContent.appendChild( labelFilter );
    }

    //Check for merge status column and include the Merge warning indicator in header.
    if( column?.name === 'mergeStatus' ) {
        let indicatorElement = includeComponent( 'Cm1ChangeSummaryIndicatorWarning', { } );
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary align-self-center';

        if( renderedElement ) {
            renderComponent( indicatorElement, renderedElement );
            headerContent.appendChild( renderedElement );
        }
    }
    if( column?.isCompareColumn ) {
        let context = {
            indicatorName: 'cmdCompare',
            tooltipDetails: {
                isIndicator: false
            }
        };
        localeSvc.getLocalizedText( 'ChangeMessages', 'compareTitle' ).then( function( result ) {
            context.tooltipDetails.prop = result;
        } );
        let indicatorElement = includeComponent( 'Cm1ChangeSummaryDynamicIndicatorColumn', context );
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';

        if( renderedElement ) {
            renderComponent( indicatorElement, renderedElement );
            headerContent.appendChild( renderedElement );
        }
    }
    containerElement.appendChild( headerContent );
};

/**
 *
 * @param {Object} impactedItemsLov - Impacted items lov value to be added in additional data
 * @param {Object} field - fields data if data.impactedItemsLov is wrong.
 * @returns {Object} - Object which consists of list of selected impacted items.
 */
export let getImpactedItemsSelected = function( impactedItemsLov, field ) {
    let selectedImpactedItem = impactedItemsLov?.dbValue;
    if( selectedImpactedItem?.length > 0 ) {
        return  cdm.getObjects( selectedImpactedItem );
    }
};

export let getRowToExpandData = function( underlyingObj ) {
    let underlyingObjUid = underlyingObj?.uid;
    let underlyingObjType = underlyingObj?.type;
    if( underlyingObjUid &&  underlyingObjType ) {
        return {
            uid: underlyingObjUid,
            type: underlyingObjType
        };
    }

    return {
        uid: '',
        type: ''
    };
};

/**
 * This function initializes the data to be passed to substitute panel
 * @param {Object} selectionData - The selection data from object set.
 * @param {Object} context - The context to update.
 */
export let initializeDataForSubstitutes = function( selectionData, context, selectedDesignElement, subPanelContext ) {
    var selectedElement = subPanelContext?.selected?.props?.cm1Awb0PositionedElement?.dbValues[0];
    if( selectedElement !== undefined && selectedElement !== '' ) {
        let newSelected = {
            uid: selectedElement
        };
        selectedDesignElement?.update( newSelected );
        let changedBomline = cdm.getObject( selectedElement );
        selectionData.update( changedBomline );

        let contextData = {
            contextKey : 'changeManagementContext',
            occContext :{
                pwaSelection :[ changedBomline ],
                productContextInfo: {
                    uid: subPanelContext?.selected?.props?.productContextInfo?.dbValues?.[0],
                    type: subPanelContext?.selected?.props?.productContextInfo?.uiValues?.[0]
                }
            }
        };
        context.update( contextData );
    }
};

/**
 *
 * @param {Object} filterCriteriaState - filter criteria state to store the selected merge filter.
 * @param {Object} eventData - eventData from commandsViewModel which holds the merge filter value.
 */
export let updateMergeFilterCriteria = function( filterCriteriaState, eventData ) {
    let newFilterCriteriaState =  _.clone( filterCriteriaState );
    newFilterCriteriaState.filterCriteriaCol = eventData.filterCriteriaCol;
    newFilterCriteriaState.filterCriteriaValue = eventData.filterCriteriaValue;
    newFilterCriteriaState.filterCriteriaOperation = eventData.filterCriteriaOperation;

    filterCriteriaState.update( newFilterCriteriaState );
};

/**
 *
 * @param {Object} localSelectionData - local selection from change summmary table
 * @param {Object} parentSelectionData - parent selection from secondary work area
 */
export const handleSelectionChange = ( localSelectionData, parentSelectionData ) => {
    if( !_.isEmpty( localSelectionData ) ) {
        let baseSelection;
        let relationContext;
        relationContext = xrtUtilities.getRelationInfo( localSelectionData, baseSelection );
        var adaptedObjsPromise = adapterService.getAdaptedObjects( localSelectionData.selected );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            var selectedObjects = [];
            _.forEach( adaptedObjs, function( adaptedObject, index ) {
                const selectedData = localSelectionData.selected[index];
                if ( selectedData.alternateID ) {
                    adaptedObject.alternateID = selectedData.alternateID;
                }
                if ( selectedData.props.bomEditType ) {
                    adaptedObject.bomEditType = selectedData.props.bomEditType.dbValues[0];
                }
                if ( selectedData.props.action ) {
                    adaptedObject.props.action = selectedData.props.action;
                }
                if( selectedData.props.cm1UnderlyingPrimaryObject ) {
                    adaptedObject.supportingPrimaryObject = selectedData.props.cm1UnderlyingPrimaryObject;
                }
                if( selectedData.props.bomEditSupersedure ) {
                    adaptedObject.bomEditSupersedure = selectedData.props.bomEditSupersedure.dbValues[0];
                }
                if( selectedData.props.bomEditSupersedure ) {
                    adaptedObject.bomEditParentBVR = selectedData.props.bomEditParentBVR.dbValues[0];
                }
                if( selectedData.props.bomEditSupersedure ) {
                    adaptedObject.bomEditUid = selectedData.props.bomEditId.dbValues[0];
                }
                if( adaptedObject ) {
                    if ( viewModelObjectService.isViewModelObject( adaptedObject ) || isViewModelTreeNode( adaptedObject ) ) {
                        selectedObjects.push( adaptedObject );
                    } else {
                        let selectedObjectsvmo = viewModelObjectService
                            .constructViewModelObjectFromModelObject( adaptedObject, 'EDIT' );
                        selectedObjectsvmo.bomEditType = adaptedObject.bomEditType;
                        selectedObjectsvmo.props.action = adaptedObject.props.action;
                        selectedObjectsvmo.supportingPrimaryObject = adaptedObject.supportingPrimaryObject;
                        selectedObjectsvmo.bomEditSupersedure = adaptedObject.bomEditSupersedure;
                        selectedObjectsvmo.bomEditParentBVR = adaptedObject.bomEditParentBVR;
                        selectedObjectsvmo.bomEditUid = adaptedObject.bomEditUid;
                        selectedObjects.push( selectedObjectsvmo );
                    }
                }
            } );

            parentSelectionData && parentSelectionData.update( {
                selected: selectedObjects,
                relationInfo: relationContext,
                _modelId: localSelectionData._modelId,
                id: localSelectionData.id
            } );
        } );
    }
};

/**
 * This method checks the focus component and updates the selection in selection model.
 * @param {Object} localSelectionData - local selection data from splm table.
 * @param {Objectq} focusComponent - focus component which is currently focusing on.
 * @param {Object} selectionModel - selection model passed into the table.
 */
export const handleFocusChange = ( localSelectionData, focusComponent, selectionModel ) => {
    if( focusComponent && localSelectionData._modelId && focusComponent !== 'clear'
        && localSelectionData._modelId !== focusComponent && selectionModel
        && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
    }

    if( focusComponent === 'clear' && selectionModel.getSelection().length > 0 ) {
        selectionModel.selectNone();
    }
};

/**
 * Process column arrange settings
 *
 * @param {Object} dataProvider - data provider of grid
 * @param {Object} gridId - grid id
 * @param {Object} gridOptions - grid options
 */
export let processCSTColumnsArrangeSettings = function( dataProvider, gridId, gridOptions ) {
    let cols = _.clone( dataProvider.cols );

    let grididSetting = {
        name: gridId,
        columnConfigId: dataProvider.columnConfig.columnConfigId,
        objectSetUri: dataProvider.objectSetUri,
        columns: cols,
        useStaticFirstCol: Boolean( gridOptions.useStaticFirstCol ),
        showFirstColumn: true
    };

    if( dataProvider.objectSetUri ) {
        grididSetting.operationType = dataProvider.columnConfig.operationType;
    }

    appCtxSvc.registerCtx( 'ArrangeClientScopeUI', grididSetting );
};

/**
 * This function prepares data for Arrange panel and update it in app context.
 * @param {Object} dataProvider - dataprovider of table for Arrange Panel to be invoked.
 * @param {Object} gridId - grid Id of table.
 * @param {Object} gridOptions - grid options of the table.
 */
export let processColumnsArrangeSettings = function( dataProvider, gridId, gridOptions ) {
    let cols = _.clone( dataProvider.cols );

    _.remove( cols, function( col ) {
        return col.clientColumn;
    } );

    let gridIdSetting = {
        name: gridId,
        columnConfigId: dataProvider.columnConfig.columnConfigId,
        objectSetUri: dataProvider.objectSetUri,
        columns: cols,
        useStaticFirstCol: Boolean( gridOptions.useStaticFirstCol ),
        showFirstColumn: true
    };

    if( dataProvider.objectSetUri ) {
        gridIdSetting.operationType = dataProvider.columnConfig.operationType;
    }

    appCtxSvc.registerCtx( 'ArrangeClientScopeUI', gridIdSetting );
};

/**
 * This function is used to get the modified properties of vmo.
 * @param {Object} vmo - vmo of selected row in change summary table.
 * @param {Object} props - props to be shown in properties tab in details of changes panel
 */
export let getModifiedProperties = function( vmo, props ) {
    let newDispProps = { ...props };
    let localAttr = [];
    Object.values( vmo.props ).forEach( function( prop ) {
        //We don't want to display the indicator props in DOC panel.
        if( prop?.propertyDisplayName && !prop.propertyName?.includes( 'Indicator_' ) ) {
            let prop1 = uwPropertyService.createViewModelProperty( prop.propertyName, prop.propertyDisplayName, 'STRING', prop.dbValues?.[0], prop.uiValues );
            uwPropertyService.setPropertyLabelDisplay( prop1, 'PROPERTY_LABEL_AT_SIDE' );
            prop.oldValue && uwPropertyService.setOldValues( prop1, [ prop.oldValue ] );
            prop1.fielddata = _.cloneDeep( prop1 );
            if( prop.deltaValues ) {
                prop1.fielddata.deltaValues = prop.deltaValues;
            }
            localAttr.push( prop1 );
        }
    } );
    newDispProps.attr1 = localAttr;
    props.update( newDispProps );
};

/**
 *
 * @param {String} resource resource name
 * @param {String} key key
 * @param {Array} params param
 * @returns {String} message
 */
export function getTooltipDetails( tooltipTitle, tooltipDesc, replaceStr, mergeContextData ) {
    let tooltipDescStr = '';
    // In case of merge indicator, we need to load the source assembly name to show in tooltip.
    if( mergeContextData?.isMergeIndicator && mergeContextData?.sourceUid ) {
        const sourceVmo = cdm.getObject( mergeContextData.sourceUid );
        let sourceAssemblyName = '';
        if ( sourceVmo !== undefined && sourceVmo.props.hasOwnProperty( 'object_string' ) ) {
            sourceAssemblyName = sourceVmo.props.object_string.dbValues[0];
        }
        tooltipDescStr = tooltipDesc.replace( '{0}', sourceAssemblyName );
        return {
            tooltipTitle: tooltipTitle,
            tooltipDesc: tooltipDescStr,
            isIndicator: true
        };
    }

    // This block of code is for other indicators eg. Properties, Vendor Parts etc.
    // Replace {0} with replaceStr value in title and description.
    let tooltipTitleStr = tooltipTitle && replaceStr ? tooltipTitle.replace( '{0}', replaceStr ) : tooltipTitle;
    tooltipDescStr = tooltipDesc && replaceStr ? tooltipDesc.replace( '{0}', replaceStr?.toLowerCase?.() ) : tooltipDesc;
    return {
        tooltipTitle: tooltipTitleStr,
        tooltipDesc: tooltipDescStr,
        isIndicator: true
    };
}

/**
 * This function is used to store the selected merge filter in change summary table in session storage.
 * @param {String} filterValue - filter value to be stored in session storage.
 */
export function setChangeSummaryMergeFilter( filterValue ) {
    const sessionStorageMergeFilterKey = 'cm1ChangeSummaryMergeFilter';
    const mergeFilterJson = sessionStorage.getItem( sessionStorageMergeFilterKey );
    let mergeFilter = mergeFilterJson ? JSON.parse( mergeFilterJson ) : '';

    if( mergeFilter !== filterValue ) {
        sessionStorage.setItem( sessionStorageMergeFilterKey, JSON.stringify( filterValue ) );
        eventBus.publish( 'updateMergeFilterAndResetChangeSummary' );
    }
}

/**
 * This function returns the merge filter value by fetching it from session storage.
 * @returns {String} - merge filter selected in change summary table.
 */
export function getChangeSummaryMergeFilter() {
    let mergeFilter = '';

    const sessionStorageMergeFilterKey = 'cm1ChangeSummaryMergeFilter';
    const mergeFilterJson = sessionStorage.getItem( sessionStorageMergeFilterKey );
    if( mergeFilterJson ) {
        mergeFilter = JSON.parse( mergeFilterJson );
    }
    if( _.isEmpty( mergeFilter ) ) {
        // CM_change_summary_view_redlines preference is used to fetch the value on first load of client.
        // Then it is cached in session storage for further usage.
        // 1. All: View all changes in the change summary with redlines.
        // 2. Merged: View only the merged changes with redlines that have already been approved and released.
        // 3. Current: View only the current changes with redlines that are unapproved and still under review.

        let preferenceValue = appCtxSvc.getCtx( 'preferences' )?.CM_change_summary_view_redlines?.[0];
        let key = preferenceValue?.trim()?.toLowerCase();
        switch ( key ) {
            case 'all':
                mergeFilter = 'ALL_REDLINING';
                break;
            case 'merged':
                mergeFilter = 'MERGED_REDLINING';
                break;
            case 'current':
                mergeFilter = 'CURRENT_REDLINING';
                break;
            default:
                mergeFilter = 'ALL_REDLINING';
        }
    }
    return mergeFilter;
}

/**
 * This function compares the old and current data of impacted items lov to trigger resetChangeSummaryTable event.
 * @param {Object} impactedItems - Array of uids with latest selection information of impacted items lov of change summary table.
 * @param {Object} cachedImpactedItems - Array of cached selection info of impacted items LOV.
 * @returns - Object with reload and caching data information.
 */
export let cacheImpactedItemsData = function( impactedItems, cachedImpactedItems ) {
    return {
        isReload: cachedImpactedItems !== undefined && impactedItems !== cachedImpactedItems,
        cacheData: [ ...impactedItems ]
    };
};


/**
 * This API checks whether incoming vmo is an newly added VMO in mark up mode or not.
 * If it is newly added VMO thenit returns true otherwise it return false.
 * @param {ViewModelObject} vmo
 */
let isVMOIsNewlyAddedMarkUpElement = function( vmo ) {
    if( vmo.type === 'Awb0MarkupElement' ||
        vmo.props.awb0MarkupType && ( vmo.props.awb0MarkupType.dbValue & 128 ) === 128 ) {
        return true;
    }
    return false;
};

let resetMarkUpProperties = function( vmo ) {
    let propList = vmo.props;
    const keys = Object.keys( propList );
    for( const key of keys ) {
        let propertyObject = vmo.props[ key ];
        if( !_.isUndefined( propertyObject ) ) {
            let oldValue = propertyObject.oldValue;
            if( oldValue ) {
                delete propertyObject.oldValue;
            }
            let deltaValues = propertyObject.deltaValues;
            if( deltaValues ) {
                delete propertyObject.deltaValues;
            }
        }
    }
};

/**
 * Populate VMO with mark-up values(old values).
 * @param {ViewModelObject} vmo - View model object to evaluate for decorator.
 */
export let populateMarkupValues = function( vmo ) {
    if( vmo && vmo.props && appCtxSvc.ctx.isCm1DOCSubstituteMarkupEnabled ) {
        // If awb0MarkupType = 128  consider the element as a newly added markup element.
        // For AW4.2 and TC12.2 newly added markup element is also returned as Awb0DesignElement
        vmo.isAdded = isVMOIsNewlyAddedMarkUpElement( vmo );
        // if yes then stop further processing.
        vmo.isDeleted = false;
        vmo.propChangeWithAdd = Boolean( vmo.props.awb0MarkupType && vmo.props.awb0MarkupType.dbValue === 144 );
        // moved line with tracked absolute occurrence property changes will be processed.
        if( vmo.isAdded && !vmo.propChangeWithAdd ) {
            resetMarkUpProperties( vmo );
            return;
        }

        if( vmo.props.awb0MarkupType ) {
            vmo.isDeleted = ( vmo.props.awb0MarkupType.dbValue & 2 ) === 2; /* eslint-disable-line no-bitwise */
        }
    }
};

export default exports = {
    initColumnsForChangeSummaryTable2,
    processChangeSummaryData3Response,
    openDetailsOfChangesPanel,
    saveColumnConfig,
    processSecondaryObject,
    getImpactedItemsSelected,
    changeSummaryTableHeaderRender,
    getRowToExpandData,
    initializeDataForSubstitutes,
    updateMergeFilterCriteria,
    handleSelectionChange,
    handleFocusChange,
    setIconElementForMergeStatus,
    processCSTColumnsArrangeSettings,
    processColumnsArrangeSettings,
    getModifiedProperties,
    getTooltipDetails,
    setChangeSummaryMergeFilter,
    getChangeSummaryMergeFilter,
    cacheImpactedItemsData,
    resetColumnConfig,
    populateMarkupValues,
    calculateTooltip
};
