/* eslint-disable no-nested-ternary */
/* eslint-disable complexity */

// Copyright (c) 2024 Siemens

/* global CKEDITOR */

/**
 * AW Markup service
 *
 * @module js/Awp0MarkupService
 */
import { getBaseUrlPath } from 'app';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';
import messageService from 'js/messagingService';
import awIconService from 'js/awIconService';
import commandPanelSvc from 'js/commandPanel.service';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import _ from 'lodash';
import markupModel from 'js/MarkupModel';
import markupOperation from 'js/MarkupOperation';
import awEditorService from 'js/awRichTextEditorService';
import sanitizer from 'js/sanitizer';
import locationNavigationService from 'js/locationNavigation.service';
import { svgString as miscAccept } from 'image/miscAcceptMarkup24.svg';
import { svgString as miscRedo } from 'image/miscRedoMarkup24.svg';
import { svgString as miscDelete } from 'image/miscDeleteMarkup24.svg';
import { svgString as miscUndo } from 'image/miscUndoMarkup24.svg';
import { svgString as cmdEdit } from 'image/cmdEdit24.svg';
import { svgString as cmdReply } from 'image/cmdReply24.svg';
import { svgString as cmdDelete } from 'image/cmdDelete24.svg';
import appCtxService from 'js/appCtxService';

//=============== cached AW directives, services, and objects =================

let _defaultNonTcUser = { typeIconURL: getBaseUrlPath() + '/image/typePersonGray48.svg' };
let _i18n = {};
let _images = {};
let ckeEditor;
let overrideLoad = {};
let overrideSave = {};
let overrideUiOptions = {};
let svgEditorInst = null;

//======================= exported vars and functions =========================
let exports;
export let i18n = _i18n;
const supportedViewerTypes = [ 'aw-pdf-viewer', 'aw-image-viewer', 'aw-html-viewer',
    'aw-text-viewer', 'aw-2d-viewer', 'aw-onscreen-3d-markup-viewer' ];
const ctxDialogParent = '.aw-layout-workarea';

/**
 * Set context for markup module
 *
 * @param {Object} viewerCtx - the viewer context
 */
export let setContext = function( viewerCtx ) {
    if( viewerCtx && viewerCtx.type && viewerCtx.vmo ) {
        var markupCtx = exports.getMarkupContext();

        markupCtx = exports.setMarkupContext( 'viewerType', viewerCtx.type,
            'viewerElement', viewerCtx.element || viewerCtx.pdfFrame,
            'parentElement', viewerCtx.element && viewerCtx.element.parentElement,
            'dialogAction', viewerCtx.viewerDialogAction,
            'dialogParent', viewerCtx.viewerDialogParent || ctxDialogParent );

        if( !markupCtx.baseObject || viewerCtx.vmo.uid !== markupCtx.baseObject.uid ) {
            markupCtx = exports.setMarkupContext(
                'baseObject', { uid: viewerCtx.vmo.uid, type: viewerCtx.vmo.type },
                'version', '',
                'stampVersion', '',
                'count', 0,
                'editing', false );
        }

        markupCtx = exports.setMarkupContext( 'keep', $( 'button.aw-viewerjs-controlArrow' ).length > 0 );

        if( supportedViewerTypes.includes( markupCtx.viewerType ) ) {
            loadMarkups();

            if( !markupCtx.stampsLoaded ) {
                loadStamps();
            }
        } else {
            exports.endMarkupEdit();
            clearMarkups();
            if( markupCtx.showPanel && !markupCtx.keep ) {
                if( markupCtx.dialogAction ) {
                    markupCtx.dialogAction.hide();
                } else {
                    eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
                }
            }
        }
    }
};

/**
 * Get the context
 *
 * @param {String} name - the context name
 * @return {Object} the context
 */
export let getContext = function( name ) {
    return appCtxSvc.getCtx( name );
};

/**
 * Get the markup context, if not found, register a new one
 *
 * @return {Object} the markup context
 */
export let getMarkupContext = function() {
    var markupCtx = exports.getContext( 'markup' );
    if( !markupCtx ) {
        appCtxSvc.registerCtx( 'markup', {} );
    }
    return exports.getContext( 'markup' );
};

/**
 * Set the markup context with give name and value
 *
 * @param {Object} args - array of names and values
 * @return {Object} the updated markup context
 */
export let setMarkupContext = function( ...args ) {
    for( var i = 0; i < args.length; i += 2 ) {
        appCtxSvc.updatePartialCtx( 'markup.' + args[i], args[i + 1] );
    }

    return exports.getContext( 'markup' );
};

/**
 * Activate the Markup panel
 *
 * @param {Object} viewerCtx - the viewer context
 */
export let activateMarkupPanel = function( viewerCtx ) {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.showPanel && viewerCtx.element !== markupCtx.viewerElement ) {
        // keep showPanel, clear the current viewer, show markups on panel for the selected viewer
        clearMarkups();
        setShowMarkupsInfo( 1 );
        exports.setContext( viewerCtx );
    } else {
        if( markupCtx.showMarkups && viewerCtx.element !== markupCtx.viewerElement ) {
            clearMarkups();
            setShowMarkupsInfo( 1 );
        }

        if( viewerCtx.viewerDialogAction ) {
            markupCtx = exports.setMarkupContext( 'dialogAction', viewerCtx.viewerDialogAction,
                'dialogParent', viewerCtx.viewerDialogParent || ctxDialogParent );
            if( markupCtx.showPanel ) {
                markupCtx.dialogAction.hide();
            } else {
                let markupOptions = {
                    view: 'Awp0MarkupMain',
                    parent: markupCtx.dialogParent,
                    placement: 'right',
                    width: 'SMALL',
                    height: 'FULL',
                    push: true,
                    isCloseVisible: false,
                    subPanelContext: viewerCtx,
                    commandid: 'Awp0ShowMarkupPanel',
                    commandicon: 'cmdShowMarkupPanel'
                };
                markupCtx.dialogAction.show( markupOptions );
            }
        } else {
            commandPanelSvc.activateCommandPanel(
                'Awp0MarkupMain', 'aw_toolsAndInfo', viewerCtx, true );
        }
    }
};

/**
 * Show the Markup panel
 *
 * @param {Object} viewerCtx - the viewer context
 */
export let showPanel = function( viewerCtx ) {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.showPanel ) {
        eventBus.publish( 'awp0Markup.callDataProvider' );
    } else {
        exports.setMarkupContext( 'showPanel', true );
        if( markupCtx.showMarkupSymbolPanel ) {
            exports.setMarkupContext( 'showMarkupSymbolPanel', false );
        }
        exports.setContext( viewerCtx );
    }
};

/**
 * Hide the Markup panel
 *
 * @param {Object} viewerCtx - the viewer context
 */
export let hidePanel = function( viewerCtx ) {
    let markupCtx = exports.getMarkupContext();

    if( !markupCtx.editing &&
        !( markupCtx.selectedTool === 'stamp' ||
           markupCtx.selectedTool === 'shape' && markupCtx.subTool === 'symbol' ) ) {
        closePanel();
    }
};

/**
 * Close the Markup panel
 */
export let closePanel = function() {
    let markupCtx =  exports.setMarkupContext( 'showPanel', false, 'keep', false );
    if( !markupCtx.showMarkups ) {
        window.setTimeout( function() {
            clearMarkups();
        }, 50 );
    } else if( markupModel.setFilter( '' ) ) {
        markupModel.updateMarkupList();
    }
};
export let closeMarkupSymbolPanel = function() {
    let markupCtx =  exports.setMarkupContext( 'showMarkupSymbolPanel', false, 'keep', false );

    if( !markupCtx.showMarkups ) {
        window.setTimeout( function() {
            clearMarkups();
        }, 50 );
    } else if( markupModel.setFilter( '' ) ) {
        markupModel.updateMarkupList();
    }
};

/**
 * Show Markups even without the Markup panel, toggle true and false
 *
 * @param {Object} viewerCtx - the viewer context
 */
export let showMarkups = function( viewerCtx ) {
    var markupCtx = exports.getMarkupContext();
    if( markupCtx.showMarkups && viewerCtx.element !== markupCtx.viewerElement ) {
        // keep showMarkups, clear the current viewer, show markups on the selected viewer
        clearMarkups();
        setShowMarkupsInfo( 1 );
        exports.setContext( viewerCtx );
    } else {
        markupCtx = exports.setMarkupContext( 'showMarkups', !markupCtx.showMarkups );
        setShowMarkupsInfo();

        if( !markupCtx.showPanel ) {
            if( markupCtx.showMarkups ) {
                exports.setContext( viewerCtx );
            } else {
                clearMarkups();
            }
        }
    }
};

/**
 * Process Markups
 *
 * @param {Object} response - The soa response
 * @return {Object} the markup data
 */
export let processMarkups = function( response ) {
    exports.setLoginUser();
    var markupCtx = exports.getMarkupContext();
    var message = response.message || '';

    markupCtx = exports.setMarkupContext( 'version', response.version );
    markupModel.processMarkups( response.version, message, response.markups );
    setShowMarkupsInfo();

    markupCtx = exports.setMarkupContext( 'userNames', markupModel.findUsersToLoad() );
    markupModel.setUserObj( '', _defaultNonTcUser );
    setSupportedTools( true );

    if( markupModel.getRole() === 'reader' ) {
        var buttons = [ {
            addClass: 'btn btn-notify',
            text: _i18n.cancel,
            onClick: function( btn ) {
                btn.close();
            }
        } ];
        messageService.showWarning( _i18n.noMarkupPrivilege, buttons );
    }

    initOperation( 5 );

    if( markupCtx.showPanel ) {
        eventBus.publish( 'awp0Markup.resetTabFilter' );
        if( markupCtx.userNames.length > 0 ) {
            eventBus.publish( 'awp0Markup.loadUsers' );
        } else {
            eventBus.publish( 'awp0Markup.callDataProvider' );
        }
    }

    let currentPos = markupModel.getCurrentPos();
    currentPos = currentPos && markupModel.findMarkup( currentPos );

    let currentSel = markupModel.getCurrentSelect();
    currentSel = currentSel && markupModel.findMarkup( currentSel );

    if( currentPos ) {
        markupModel.setCurrentPos( currentPos );
        markupOperation.setTool( 'position' );
        markupOperation.setPositionMarkup( currentPos );
    } else if( currentSel ) {
        markupModel.setCurrentSelect( null );
        markupModel.setCurrentSelect( currentSel );
    }

    return markupModel.getMarkupList();
};

/**
 * Process Users
 *
 * @param {Object} response - The soa response
 */
export let processUsers = function( response ) {
    if( response && response.result ) {
        response.result.forEach( function( mo ) {
            var userObj = cdm.getObject( mo.uid );
            if( userObj ) {
                setUserIcon( userObj );
                markupModel.setUserObj( userObj.props.user_id.dbValues[ 0 ], userObj );
            }
        } );

        eventBus.publish( 'awp0Markup.callDataProvider' );
    }
};

/**
 * Select markup in the panel and scroll it into view
 *
 * @param {DataProvider} dataProvider - the data provider
 * @param {Number} count - count of recursive calls, initially undefined
 */
export let selectAndScroll = function( dataProvider, count ) {
    var currentSel = markupModel.getCurrentSelect();
    var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    if( list.length > 0 ) {
        if( currentSel && currentSel.visible ) {
            for( var i = 0, j = 0; i < list.length; i++ ) {
                if( markupModel.sameMarkup( currentSel, list[ i ] ) ) {
                    dataProvider.changeObjectsSelection( i, i, true );
                    break;
                }

                if( !list[ i ].groupName ) {
                    j++;
                }
            }

            if( i < list.length ) {
                var el = $( 'div.aw-markup-cell' ).get( j );
                if( el ) {
                    el.scrollIntoView();
                }
            }
        } else {
            dataProvider.changeObjectsSelection( 0, list.length - 1, false );
        }
    } else if( currentSel && currentSel.visible ) {
        count = count || 0;
        if( count < 10 ) {
            window.setTimeout( function() {
                selectAndScroll( dataProvider, count + 1 );
            }, 50 );
        }
    }
};

/**
 * Markup in tool panel is selected or unselected
 *
 * @param {EventData} eventData - the eventData
 */
export let markupSelected = function( eventData ) {
    if( eventData ) {
        if( eventData.selectedObjects.length > 0 ) {
            var selected = eventData.selectedObjects[ 0 ];
            if( selected.date ) {
                markupModel.setCurrentSelect( selected, true );
            }
        } else {
            markupModel.setCurrentSelect( null );
        }
    }
};

/**
 * Select a tool, if it is the current tool, unselect it. If null, unselect all.
 *
 * @param {String} tool - the tool to be selected
 * @param {String} subTool - the subTool, defined only when tool is shape
 */
export let selectTool = function( tool, subTool ) {
    let markupCtx = exports.getMarkupContext();
    const newTool = tool === markupCtx.selectedTool && subTool === markupCtx.subTool ? null : tool;
    const newSubTool = tool === 'shape' ? subTool : undefined;

    // for stamp/symbol tool, show/hide the Stamp/Symbol panel
    if( newTool === 'stamp' ) {
        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupStamp',
                title: _i18n.stamp,
                supportGoBack: true
            } );
        } else if( markupCtx.dialogAction ) {
            const options = {
                view: 'Awp0MarkupStampMain',
                parent: markupCtx.dialogParent,
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false
            };
            markupCtx.dialogAction.show( options );
        } else {
            commandPanelSvc.activateCommandPanel(
                'Awp0MarkupStampMain', 'aw_toolsAndInfo', null, false );
        }
    } else if( newSubTool === 'symbol' ) {
        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupSymbol',
                title: _i18n.customSymbols,
                supportGoBack: true
            } );
        } else if( markupCtx.dialogAction ) {
            const options = {
                view: 'Awp0MarkupSymbolMain',
                parent: markupCtx.dialogParent,
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false
            };
            markupCtx.dialogAction.show( options );
        } else {
            commandPanelSvc.activateCommandPanel(
                'Awp0MarkupSymbolMain', 'aw_toolsAndInfo', null, false );
        }
    } else if( markupCtx.selectedTool === 'stamp' ||
               markupCtx.selectedTool === 'shape' && markupCtx.subTool === 'symbol' ) {
        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupList',
                backNavigation: true
            } );
        } else if( markupCtx.dialogAction ) {
            markupCtx.dialogAction.hide();
        } else {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
        }
    }

    markupOperation.setTool( newTool, newSubTool );
    markupOperation.setPositionMarkup( null );
    markupModel.setCurrentPos( null );
    markupCtx = exports.setMarkupContext( 'selectedTool', newTool, 'subTool', newSubTool );

    if( newTool === 'highlight' ) {
        // For preselected text, add a new markup
        selectionEndCallback( 'highlight' );
    }

    if( newTool === 'stamp' || newSubTool === 'symbol' ) {
        // For stamp/symbol, set canvas and drop event handler
        markupOperation.showCurrentPage();
    }
};

/**
 * Reply a markup
 *
 * @param {Markup} markup - the selected or hovered markup
 */
export let replyMarkup = function( markup ) {
    if( markup ) {
        markupModel.setCurrentSelect( markup, true );
    }

    var currentSelection = markupModel.getCurrentSelect();
    var replyMarkup = markupModel.addReplyMarkup( currentSelection );
    if( replyMarkup ) {
        exports.selectTool( null );
        let markupCtx = exports.setMarkupContext( 'editing', true );
        markupModel.setCurrentSelect( replyMarkup );
        markupModel.setCurrentEdit( replyMarkup );
        replyMarkup.editMode = 'reply';

        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupEdit',
                title: _i18n.reply,
                recreatePanel: true,
                supportGoBack: true
            } );
        } else if( markupCtx.dialogAction ) {
            const options = {
                view: 'Awp0MarkupEditMain',
                parent: markupCtx.dialogParent,
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false
            };
            markupCtx.dialogAction.show( options );
        } else {
            commandPanelSvc.activateCommandPanel(
                'Awp0MarkupEditMain', 'aw_toolsAndInfo', null, false );
        }
    }
};

/**
 * Event handler on tab selected: 'page', 'user', 'date', or 'status'
 *
 * @param {Data} data - the data
 */
export let onTabSelected = function( data ) {
    if( data.tabsModel ) {
        let tab = data.tabsModel.dbValue.find( t => t.selectedTab );
        let key = tab ? tab.tabKey : '';
        if( markupModel.setSortBy( key ) ) {
            markupModel.setCurrentSelect( null );

            var markupList = markupModel.updateMarkupList();
            markupList.forEach( function( m ) {
                initMarkupCell( m, _i18n );
            } );

            var previousSel = markupModel.getPreviousSelect();
            if( previousSel && previousSel.visible ) {
                markupModel.setCurrentSelect( previousSel );
            }

            if( data && data.dataProviders && data.dataProviders.visibleMarkups ) {
                const dataProvider = data.dataProviders.visibleMarkups;
                dataProvider.update( markupList, markupList.length );
                selectAndScroll( dataProvider );
            }
        }
    }
};

/**
 * Reset the tab to page, and filter to empty
 *
 * @param {Data} data - the data
 */
export let resetTabFilter = function( data ) {
    if( data.tabsModel && data.tabsModel.dbValue ) {
        data.tabsModel.dbValue.forEach( ( t, i ) => { t.selectedTab = i === 0; } );
    }

    if( data.filterBox ) {
        data.filterBox.dbValue = '';
    }
};

/**
 * Get the current sortBy
 *
 * @return {String} the current sortBy: 'page', 'user', 'date', or 'status'
 */
export let getSortBy = function() {
    return markupModel.getSortBy();
};

/**
 * Filter markups
 *
 * @param {Data} data - the input data
 * @returns {MarkupList} the markup list
 */
export let filterMarkups = function( data ) {
    if( markupModel.setFilter( data.filterBox.dbValue ) ) {
        markupModel.updateMarkupList();
    }

    let markupList = markupModel.getMarkupList();
    markupList.forEach( m => {
        initMarkupCell( m, _i18n );
    } );

    eventBus.publish( 'awp0Markup.selectAndScroll' );
    return markupList;
};

/**
 * Filter changed
 *
 * @param {Data} data - the input data
 * @param {Object} dataProvider - the data provider
 * @param {Boolean} immediate - immediate action
 */
export let filterChanged = function( data, dataProvider, immediate ) {
    if( data.timerid ) {
        clearTimeout( data.timerid );
    }

    if( immediate ) {
        dataProvider.resetDataProvider();
    } else {
        data.timerid = setTimeout( () => {
            // hack; if you create several symbols somehow the dataProvider loses this method needed by resetDataProvider
            if( dataProvider.hasOwnProperty( 'vmCollectionDispatcher' ) && dataProvider.vmCollectionDispatcher ) {
                dataProvider.resetDataProvider();
            }
        }, 1500 );
    }
};

/**
 * Set login user
 *
 * @param {String} userid - the user id
 * @param {String} username - the user name
 */
export let setLoginUser = function( userid, username ) {
    if( userid && username ) {
        markupModel.setLoginUser( userid, username );
    } else {
        var session = exports.getContext( 'userSession' );
        if( session ) {
            var userId = session.props.user_id.dbValues[ 0 ];
            var userName = session.props.user.uiValues[ 0 ].replace( /\s*\([^)]+\)$/, '' );
            markupModel.setLoginUser( userId, userName );
        }
    }
};

/**
 * Viewer content changed
 *
 * @param {EventData} eventData - the event data
 */
export let viewerChanged = function( eventData ) {
    var markupCtx = exports.getMarkupContext();
    if( ( markupCtx.showPanel || markupCtx.showMarkups ) &&
        eventData.value && commonViewer( eventData.value.element.parentElement, markupCtx.parentElement ) ) {
        exports.setContext( eventData.value );
    }
};

/**
 * Delete the current markup
 *
 * @param {Markup} markup - the selected or hovered markup
 */
export let deleteMarkup = function( markup ) {
    if( markup ) {
        markupModel.setCurrentSelect( markup, true );
    }

    const currentSelection = markupModel.getCurrentSelect();
    if( currentSelection ) {
        const buttons = [ {
            addClass: 'btn btn-notify',
            text: _i18n.cancel,
            onClick: function( btn ) {
                btn.close();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: _i18n.del,
            onClick: function( btn ) {
                btn.close();
                markupModel.deleteMarkup( currentSelection );
                saveMarkups( currentSelection );
            }
        } ];
        messageService.showWarning( _i18n.confirmDeleteMarkup, buttons );
    }
};

/**
 * Edit the current markup
 *
 * @param {Markup} markup - the selected or hovered markup
 */
export let editMarkup = function( markup ) {
    if( markup ) {
        markupModel.setCurrentSelect( markup, true );
    }

    var currentSelection = markupModel.getCurrentSelect();
    if( currentSelection ) {
        currentSelection.editMode = 'edit';
        markupModel.setCurrentEdit( currentSelection );
        let markupCtx = exports.setMarkupContext( 'editing', true );

        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupEdit',
                title: _i18n.edit,
                recreatePanel: true,
                supportGoBack: true
            } );
        } else if( markupCtx.dialogAction ) {
            const options = {
                view: 'Awp0MarkupEditMain',
                parent: markupCtx.dialogParent,
                width: 'SMALL',
                height: 'FULL',
                isCloseVisible: false
            };
            markupCtx.dialogAction.show( options );
        } else {
            commandPanelSvc.activateCommandPanel(
                'Awp0MarkupEditMain', 'aw_toolsAndInfo', null, false );
        }
    }
};

/**
 * Start Edit Main, when the MarkupPanel is not shown
 *
 * @param {Data} data - the input data
 */
export let startEditMain = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    if( currentEdit ) {
        if( currentEdit.editMode === 'edit' ) {
            return { title: _i18n.editMarkup };
        } else if( currentEdit.editMode === 'reply' ) {
            return { title: _i18n.replyMarkup };
        }
    }
};

/**
 * Start Edit the current markup
 *
 * @param {Data} data - the input data
 */
export let startMarkupEdit = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    if( currentEdit ) {
        let markupCtx = exports.getMarkupContext();
        let basicData = basicOptionMarkupToUI( currentEdit, data );
        let geomData = geomOptionMarkupToUI( currentEdit, data );
        let newData = { ...basicData, ...geomData };

        const callback = overrideUiOptions[ markupCtx.viewerType ];
        if( callback ) {
            const uiOptions = callback( markupCtx.baseObject, markupCtx.version, currentEdit );
            for( const option in uiOptions ) {
                newData[ option ] = uiOptions[ option ];
            }
        }

        initEditor( currentEdit, newData.allowInsertImage );
        markupModel.setOriginalMarkup( _.cloneDeep( currentEdit ) );
        markupModel.setNeedUpdateHtml( false );
        markupModel.setNeedUpdateGeom( false );

        if( currentEdit.status === 'open' && currentEdit.geometry &&
            ( currentEdit.editMode === 'edit' || currentEdit.editMode === 'new' ) ) {
            markupOperation.setTool( 'position' );
            exports.setMarkupContext( 'selectedTool', 'position' );
            markupOperation.setPositionMarkup( currentEdit );
        }

        return newData;
    }
};

/**
 * Save the edited current markup
 *
 * @param {Data} data - the input data
 */
export let saveMarkupEdit = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    if( currentEdit ) {
        var markupCtx = exports.getMarkupContext();
        var dirty = currentEdit.editMode !== 'edit';

        if( data.showGdnt ) {
            if( currentEdit.comment !== data.gdntValue.dbValue ) {
                currentEdit.comment = sanitizer.sanitizeHtmlValue( data.gdntValue.dbValue );
                currentEdit.showOnPage = 'all';
                markupModel.updateMarkupHtml( currentEdit, true );
                dirty = true;
            }
        } else if( data.showWeld ) {
            if( currentEdit.comment !== data.weldValue.dbValue ) {
                currentEdit.comment = sanitizer.sanitizeHtmlValue( data.weldValue.dbValue );
                currentEdit.showOnPage = 'all';
                markupModel.updateMarkupHtml( currentEdit, true );
                dirty = true;
            }
        } else if( data.showLeader ) {
            if( currentEdit.comment !== data.leaderValue.dbValue ) {
                currentEdit.comment = sanitizer.sanitizeHtmlValue( data.leaderValue.dbValue );
                currentEdit.showOnPage = data.showOnPage.dbValue;
                markupModel.updateMarkupHtml( currentEdit, true );
                dirty = true;
            }
        } else if( data.showSymbol ) {
            if( currentEdit.comment !== data.symbolValue.dbValue ) {
                currentEdit.comment = sanitizer.sanitizeHtmlValue( data.symbolValue.dbValue );
                currentEdit.showOnPage = 'all';
                markupModel.updateMarkupHtml( currentEdit, true );
                dirty = true;
            }
        } else if( ckeEditor ) {
            const className = 'aw-markup-commentFontStyle';
            var newComment = ckeEditor.getData();
            newComment = newComment.replace( /<em>/g, '<em class="' + className + '">' );
            newComment = newComment.replace( /<i>/g, '<i class="' + className + '">' );
            if( newComment !== currentEdit.comment ) {
                currentEdit.comment = sanitizer.sanitizeHtmlValue( newComment );
                dirty = true;
                if( currentEdit.showOnPage === 'first' || currentEdit.showOnPage === 'all' ) {
                    markupModel.setNeedUpdateHtml( true );
                }
            }
        }

        if( currentEdit.status !== 'open' && currentEdit.status !== data.status.dbValue ) {
            currentEdit.status = data.status.dbValue;
            dirty = true;
        }

        if( data.shareAs ) {
            var newShare = data.shareAs.dbValue;
            if( newShare === 'users' ) {
                for( var i = 0; i < data.shareWithValues.length; i++ ) {
                    if( data.shareWithValues[ i ].dbValue ) {
                        newShare += ' ' + data.shareWithValues[ i ].userId;
                    }
                }
            }

            if( newShare !== currentEdit.share ) {
                currentEdit.share = newShare;
                dirty = true;
            }
        }

        if( markupModel.getNeedUpdateGeom() || markupModel.getNeedUpdateHtml() ) {
            dirty = true;
        }

        if( dirty ) {
            currentEdit.date = new Date();
            markupOperation.generateRefImage( currentEdit, 400, 200 );
            saveMarkups( currentEdit );
        }

        if( data.showCreateStamp && ( data.createSharedStamp.dbValue || data.createMyStamp.dbValue ) ) {
            data.createSharedStamp.dbValue = false;
            data.createMyStamp.dbValue = false;

            var stampShare = markupModel.getStampShare();
            var stampError = !data.stampName.dbValue ? _i18n.stampNameEmpty :
                stampShare === 'private' && markupModel.findStamp( data.stampName.dbValue, 'public' ) ?
                    _i18n.stampNameExist.replace( '{0}', data.stampName.dbValue ) : '';

            if( stampError ) {
                messageService.showError( stampError );
            } else {
                var stamp = markupModel.copyMarkupAsStamp( currentEdit, data.stampName.dbValue, stampShare );
                saveStamps( stamp );
            }
        }

        currentEdit.editMode = 'saved';
        if( markupCtx.showPanel ) {
            eventBus.publish( 'awPanel.navigate', {
                destPanelId: 'Awp0MarkupList',
                supportGoBack: false
            } );
        } else if( markupCtx.dialogAction ) {
            markupCtx.dialogAction.hide();
        } else {
            eventBus.publish( 'complete', { source: 'toolAndInfoPanel' } );
        }
    }
};

/**
 * Event handler for showOnPage option changed
 *
 * @param {Data} data - the data
 */
export let showOnPageChanged = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    var newValue = data.showOnPage.dbValue === 'none' ? undefined : data.showOnPage.dbValue;
    if( newValue !== currentEdit.showOnPage ) {
        if( data.showLeader ) {
            currentEdit.comment = sanitizer.sanitizeHtmlValue( data.leaderValue.dbValue );
        } else if( ckeEditor ) {
            currentEdit.comment = sanitizer.sanitizeHtmlValue( ckeEditor.getData() );
        }
        currentEdit.showOnPage = newValue;
        markupModel.updateMarkupHtml( currentEdit, true );
        markupModel.setNeedUpdateHtml( true );
    }
};

/**
 * Event handler for Apply Text On Page button pressed
 *
 * @param {Data} data - the data
 */
export let onApplyTextOnPage = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    if( ckeEditor ) {
        currentEdit.comment = sanitizer.sanitizeHtmlValue( ckeEditor.getData() );
    }
    markupModel.updateMarkupHtml( currentEdit, true );
    markupModel.setNeedUpdateHtml( true );
};

/**
 * Handle Geometry Option Changed
 * @param {Data} data - the data
 */
export let geomOptionChanged = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    geomOptionUIToMarkup( currentEdit, data );
    markupModel.updateMarkupGeom( currentEdit, true );
    markupModel.setNeedUpdateGeom( true );
};

/**
 * End the current markup edit
 *
 * @param {Data} data - the data
 */
export let endMarkupEdit = function( data ) {
    var currentEdit = markupModel.getCurrentEdit();
    if( currentEdit ) {
        if( currentEdit.editMode === 'edit' ) {
            // if save button is not clicked, recover the original geometry and showOnPage
            let origMarkup = markupModel.getOriginalMarkup();
            if( markupModel.getNeedUpdateGeom() ) {
                currentEdit.geometry = origMarkup.geometry;
                currentEdit.textParam = origMarkup.textParam;
            }

            if( markupModel.getNeedUpdateHtml() ) {
                currentEdit.comment = origMarkup.comment;
                currentEdit.showOnPage = origMarkup.showOnPage;
                currentEdit.textParam = origMarkup.textParam;
            }
        }

        if( currentEdit.editMode === 'new' || currentEdit.editMode === 'reply' ) {
            // if create/reply button is not clicked, delete it
            currentEdit.editMode = null;
            markupModel.deleteMarkup( currentEdit );
            markupModel.updateMarkupList();
        }

        currentEdit.editMode = null;
        if( markupModel.getNeedUpdateHtml() ) {
            markupModel.updateMarkupHtml( currentEdit, false );
        }

        if( markupModel.getNeedUpdateGeom() ) {
            markupModel.updateMarkupGeom( currentEdit, false );
        }

        markupModel.setCurrentEdit( null );
        markupModel.updateMarkupList();
        markupOperation.showCurrentPage();
        markupOperation.setTool( null );
        markupOperation.setPositionMarkup( null );
        exports.setMarkupContext( 'editing', false, 'selectedTool', null );
    }
};

/**
 * Handle ShareAs changed
 *
 * @param {Data} data - the input data
 * @returns {Promise} - the promise
 */
export let shareAsChanged = function( data ) {
    var deferred = AwPromiseService.instance.defer();
    if( data.shareAs.dbValue === 'official' ) {
        deferred.resolve();
    }
    return deferred.promise;
};

/**
 * Handle Cancel Official
 * @param {Data} data - the data
 */
export let cancelOfficial = function( data ) {
    data.shareAs.dbValue = data.shareAs.dbOriginalValue;
    data.shareAs.uiValue = data.shareAs.uiOriginalValue;
};

/**
 * Show the Stamp panel
 */
export let showStampPanel = function() {
    loadStamps();
};

/**
 * Hide the Stamp panel
 */
export let hideStampPanel = function() {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.selectedTool === 'stamp' ) {
        markupOperation.setTool( null );
        markupOperation.setPositionMarkup( null );
        markupModel.setCurrentPos( null );
        exports.setMarkupContext( 'selectedTool', null );
    }
};

/**
 * Filter stamps
 *
 * @param {Data} data - the input data
 * @returns {Markup[]} the stamps list
 */
export let filterStamps = function( data ) {
    if( markupModel.setFilter( data.filterStamp.dbValue ) ) {
        markupModel.updateStampList();
    }

    let stampList = markupModel.getStampList();
    stampList.forEach( ( stamp ) => {
        if( stamp.groupName ) {
            stamp.groupInfo = toI18n( stamp.groupName, _i18n );
        } else {
            stamp.isDeletable = markupModel.isDeletable( stamp );
        }
    } );
    return stampList;
};

/**
 * Toggle stamp group between expanded and collapsed
 *
 * @param {EventData} eventData - the event data
 * @param {DataProvider} dataProvider - the data provider
 */
export let toggleStampGroup = function( eventData, dataProvider ) {
    if( eventData && eventData.name && dataProvider ) {
        let stampList = markupModel.toggleGroup( eventData.name );
        dataProvider.update( stampList, stampList.length );
    }
};

/**
 * Stamp in tool panel is selected or unselected
 *
 * @param {EventData} eventData - the eventData
 */
export let stampSelected = function( eventData ) {
    if( eventData ) {
        var selected = eventData.selectedObjects.length > 0 ? eventData.selectedObjects[ 0 ] : null;
        selected = selected && selected.stampName ? selected : null;
        markupModel.setCurrentStamp( selected );
        markupOperation.setTool( selected ? 'stamp' : null );
        markupOperation.setPositionMarkup( selected );
    }
};

/**
 * Deselect all stamps in the data provider
 *
 * @param {DataProvider} dataProvider - the data provider
 */
export function deselectAllStamps( dataProvider ) {
    if( dataProvider && dataProvider.viewModelCollection ) {
        var list = dataProvider.viewModelCollection.getLoadedViewModelObjects();
        dataProvider.changeObjectsSelection( 0, list.length - 1, false );
    }
}

/**
 * Delete the selected stamp
 *
 * @param {Markup} stamp - the selected or hovered stamp
 */
export let deleteStamp = function( stamp ) {
    const currentStamp = stamp ? markupModel.findStamp( stamp.stampName ) : markupModel.getCurrentStamp();
    if( currentStamp ) {
        const msg = _i18n.confirmDeleteStamp.replace( '{0}', currentStamp.stampName );
        const buttons = [ {
            addClass: 'btn btn-notify',
            text: _i18n.cancel,
            onClick: function( btn ) {
                btn.close();
            }
        },
        {
            addClass: 'btn btn-notify',
            text: _i18n.del,
            onClick: function( btn ) {
                btn.close();
                currentStamp.deleted = true;
                saveStamps( currentStamp );
            }
        } ];
        messageService.showWarning( msg, buttons );
    }
};

/**
 * Event handler for Stamp Checkbox checked
 *
 * @param {Data} data - the data
 */
export let stampChecked = function( data ) {
    if( data.createSharedStamp.dbValue || data.createMyStamp.dbValue ) {
        $( 'div[prop="data.stampName"]' ).find( 'input[type="text"]' ).focus();

        if( !data.showGdnt && data.showOnPage.dbValue === 'none' ) {
            messageService.showWarning( _i18n.stampNoTextShown );
        }
    }
};

/**
 * Print markups
 */
export let printMarkups = function() {
    var markupCtx = exports.getMarkupContext();
    var currentSelection = markupModel.getCurrentSelect();
    var option = currentSelection ? currentSelection :
        markupCtx.showPanel ? 'visible' : markupCtx.showMarkups ? 'all' : undefined;
    if( option ) {
        markupModel.generatePrintPage( option, _i18n, function( html ) {
            var w = 1000;
            var h = 600;
            var width = window.innerWidth || document.documentElement.clientWidth || screen.width;
            var height = window.innerHeight || document.documentElement.clientHeight || screen.height;
            var left = ( width - w ) / 2;
            var top = ( height - h ) / 2;
            var position = 'scrollbars=1,height=' + h + ',width=' + w + ',top=' + top + ',left=' + left;
            var newWin = window.open( '', 'PrintMarkup', position );

            if( newWin ) {
                newWin.document.open( 'text/html', 'replace' );
                newWin.document.write( html );
                newWin.document.close();
            }
        } );
    }
};

/**
 * Toggle group between expanded and collapsed
 *
 * @param {EventData} eventData - the event data
 * @param {DataProvider} dataProvider - the data provider
 */
export let toggleGroup = function( eventData, dataProvider ) {
    if( eventData && eventData.name && dataProvider ) {
        markupModel.setCurrentSelect( null );
        let markupList = markupModel.toggleGroup( eventData.name );
        dataProvider.update( markupList, markupList.length );
    }
};

/**
 * Initialize the markup cell
 *
 * @param {Markup} markup - the markup
 * @param {I18N} i18n - the i18n
 */
export let initMarkupCell = function( markup, i18n ) {
    if( markup && markup.groupName ) {
        markup.groupInfo = toI18n( markup.groupName, i18n );
    } else if( markup ) {
        var userObj = markup.userObj;
        if( userObj ) {
            markup.userImage = userObj.hasThumbnail ? userObj.thumbnailURL : userObj.typeIconURL;
        }

        markup.isEditable = markupModel.isEditable( markup );
        markup.dateInfo = markup.date.toLocaleString();
        markup.shareInfo = toShareInfo( markup, i18n );
        markup.statusInfo = toStatusInfo( markup, i18n );
    }
};

export let setOverrideLoad = function( viewerType, callback ) {
    overrideLoad[ viewerType ] = callback;
};

export let setOverrideSave = function( viewerType, callback ) {
    overrideSave[ viewerType ] = callback;
};

export let setOverrideUiOptions = function( viewerType, callback ) {
    overrideUiOptions[ viewerType ] = callback;
};

/**
 * Show the Symbol panel
 */
export let showSymbolPanel = function() {

};

/**
 * Hide the Symbol panel
 */
export let hideSymbolPanel = function() {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.selectedTool === 'shape' && markupCtx.subTool === 'symbol' ) {
        markupOperation.setTool( null );
        markupOperation.setPositionMarkup( null );
        markupModel.setCurrentPos( null );
        exports.setMarkupContext( 'selectedTool', null, 'subTool', undefined );
    }
};

export let symbolTabChanged = function( selectedTab ) {
    const deferred = AwPromiseService.instance.defer();

    if( selectedTab.tabKey === 'upload' ) {
        if( markupModel.getRole() === 'admin' ) {
            loadAllSymbols( list => {
                list.forEach( sym => { sym.selected = false; } );
                let symbolList = list;
                const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
                symbolList = list.filter( sym => sym.share === share );

                deferred.resolve(  {
                    symbolList: symbolList,
                    uploadable: false,
                    deletable: false,
                    modifiable: false
                } );
            } );
        }else{
            loadSymbols( list => {
                list.forEach( sym => { sym.selected = false; } );
                let symbolList = list;
                const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
                symbolList = list.filter( sym => sym.share === share );

                deferred.resolve(  {
                    symbolList: symbolList,
                    uploadable: false,
                    deletable: false,
                    modifiable: false
                } );
            } );
        }
    } else if( selectedTab.tabKey === 'apply' ) {
        loadSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;

            deferred.resolve(  {
                symbolList: symbolList,
                uploadable: false,
                deletable: false,
                modifiable: false
            } );
        } );
    } else {
        if( markupModel.getRole() === 'admin' ) {
            loadAllSymbols( list => {
                list.forEach( sym => { sym.selected = false; } );
                let symbolList = list;
                deferred.resolve(  {
                    symbolList: symbolList,
                    uploadable: false,
                    deletable: false,
                    modifiable: false
                } );
            } );
        }else{
            loadSymbols( list => {
                list.forEach( sym => { sym.selected = false; } );
                let symbolList = list;
                if( selectedTab.tabKey === 'manage' ) {
                    const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
                    symbolList = list.filter( sym => sym.share === share );
                }

                deferred.resolve(  {
                    symbolList: symbolList,
                    uploadable: false,
                    deletable: false,
                    modifiable: false
                } );
            } );
        }
    }
    return deferred.promise;
};

export let showMarkupSymbolPanel = function( viewerCtx ) {
    let markupCtx = exports.getMarkupContext();
    markupOperation.setTool( null );
    markupOperation.setPositionMarkup( null );
    markupModel.setCurrentPos( null );
    exports.setMarkupContext( 'selectedTool', null, 'subTool', undefined );
    if( markupCtx.showPanel ) {
        exports.setMarkupContext( 'showPanel', false );
    }
    exports.setMarkupContext( 'showMarkupSymbolPanel', true );
    exports.setContext( viewerCtx );
    const deferred = AwPromiseService.instance.defer();
    loadSymbols( list => {
        list.forEach( sym => { sym.selected = false; } );
        let symbolList = list;
        deferred.resolve(  {
            symbolList: symbolList,
            uploadable: false,
            deletable: false,
            modifiable: false
        } );
    } );
    return deferred.promise;
};

export let fileChanged = function( parameters ) {
    const deferred = AwPromiseService.instance.defer();
    let symbolList = [];

    if( parameters.formData && parameters.formData.length > 0 ) {
        for( const form of parameters.formData ) {
            addOneSymbol( form.file, form.selectedFile.replace( '.svg', '' ),
                symbolList, parameters.formData.length, deferred );
        }
    } else {
        deferred.resolve( { symbolList: [], uploadable: false } );
    }
    return deferred.promise;
};

export let uploadSymbols = function( symbolList, tabsSymbolModel, data ) {
    const defaultGroup = data.dbValue;
    symbolList.forEach( ( sym, index ) => {
        sym.symbolGroup = defaultGroup;
        sym.created = sym.created.replace( /\d\d\dZ/, index.toString().padStart( 3, '0' ) + 'Z' );
    } );

    let newTabsSymbolModel = _.clone( tabsSymbolModel );
    saveSymbols( symbolList, 'add' );
    newTabsSymbolModel.dbValue.forEach( ( t ) => { t.selectedTab = t.tabKey === 'manage'; } );
    return {
        tabsSymbolModel: newTabsSymbolModel,
        selectedTab: { tabKey: 'manage' }
    };
};

export let modifySymbols = function( selectedSymbols, symbolGroup, symbolName, symbolUserId, share ) {
    const deferred = AwPromiseService.instance.defer();

    const originalSymbolSelected = structuredClone( selectedSymbols );

    selectedSymbols.forEach( sym => { sym.symbolGroup = symbolGroup; } );
    if( selectedSymbols.length === 1 ) {
        selectedSymbols[0].symbolName = symbolName;
        selectedSymbols[0].userid = symbolUserId;
        selectedSymbols[0].share = share;
    }
    if( markupModel.getRole() === 'admin' ) {
        manageSaveSymbols( originalSymbolSelected, selectedSymbols, 'modify', ( list ) => {
            resolveSymbolAndGroupList( deferred, list );
        } );
    } else{
        saveSymbols( selectedSymbols, 'modify', ( list ) => {
            resolveSymbolAndGroupList( deferred, list );
        } );
    }


    return deferred.promise;
};

export let deleteSymbols = function( selectedSymbols ) {
    const deferred = AwPromiseService.instance.defer();
    const buttons = [ {
        addClass: 'btn btn-notify',
        text: _i18n.cancel,
        onClick: function( btn ) {
            btn.close();
            deferred.resolve();
        }
    },
    {
        addClass: 'btn btn-notify',
        text: _i18n.del,
        onClick: function( btn ) {
            btn.close();
            saveSymbols( selectedSymbols, 'delete', ( list ) => {
                resolveSymbolAndGroupList( deferred, list );
            } );
        }
    } ];
    messageService.showWarning( _i18n.confirmDeleteSymbols, buttons );

    return deferred.promise;
};

export let addNewGroupAction = function( data, tabsSymbolModel ) {
    var newSymbolGroup1 = [];
    newSymbolGroup1.push( data.newGroupName.dbValue );
    if( !data.ctx.newSymbolGroup || data.ctx.newSymbolGroup.length === 0 ) {
        appCtxSvc.registerCtx( 'newSymbolGroup', newSymbolGroup1 );
    }else{
        for( var i = 0; i < data.ctx.newSymbolGroup.length; i++ ) {
            newSymbolGroup1.push( data.ctx.newSymbolGroup[i] );
        }
        appCtxSvc.updateCtx( 'newSymbolGroup', newSymbolGroup1 );
    }

    let newTabsSymbolModel = _.clone( tabsSymbolModel );
    newTabsSymbolModel.dbValue.forEach( ( t ) => { t.selectedTab = t.tabKey === 'upload'; } );
    return {
        tabsSymbolModel: newTabsSymbolModel,
        selectedTab: { tabKey: 'upload' }
    };
};


export let getAddedNewSymbolGrouplist = function( ctx ) {
    const deferred = AwPromiseService.instance.defer();
    if( markupModel.getRole() === 'admin' ) {
        loadAllSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;
            let groupNames = [];
            var outputVals = [];

            symbolList.forEach( sym => {
                if( !groupNames.includes( sym.symbolGroup ) ) {
                    groupNames.push( sym.symbolGroup );
                }
            } );

            const presentGroupNameList = groupNames.map( gName => {
                return {
                    propDisplayValue: gName,
                    propInternalValue: gName
                };
            } );

            var newGroupName = ctx.newSymbolGroup;
            if( newGroupName ) {
                for( var i = 0; i < newGroupName.length; i++ ) {
                    outputVals.push( { propDisplayValue: newGroupName[i], propDisplayDescription: '', propInternalValue: newGroupName[i] } );
                }
            }
            const groupNameList = presentGroupNameList.concat( outputVals );

            deferred.resolve(  {
                groupNameList: groupNameList
            } );
        } );
    }else{
        loadSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;
            const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
            symbolList = list.filter( sym => sym.share === share );
            let groupNames = [];
            var outputVals = [];

            symbolList.forEach( sym => {
                if( !groupNames.includes( sym.symbolGroup ) ) {
                    groupNames.push( sym.symbolGroup );
                }
            } );
            const presentGroupNameList = groupNames.map( gName => {
                return {
                    propDisplayValue: gName,
                    propInternalValue: gName
                };
            } );

            var newGroupName = ctx.newSymbolGroup;
            if( newGroupName ) {
                for( var i = 0; i < newGroupName.length; i++ ) {
                    outputVals.push( { propDisplayValue: newGroupName[i], propDisplayDescription: '', propInternalValue: newGroupName[i] } );
                }
            }
            const groupNameList = presentGroupNameList.concat( outputVals );

            deferred.resolve(  {
                groupNameList: groupNameList
            } );
        } );
    }
    return deferred.promise;
};


export let manageSymbolSelected = function( list ) {
    const selectedSymbols = list.filter( sym => sym.selected );
    const originalSymbolSelected = list.filter( sym => sym.selected );
    return {
        selectedSymbols: selectedSymbols,
        originalSymbolSelected:originalSymbolSelected,
        symbolGroup: selectedSymbols.length > 0 ? selectedSymbols[0].symbolGroup : '',
        symbolName: selectedSymbols.length === 1 ? selectedSymbols[0].symbolName : '',
        symbolUserName: selectedSymbols.length === 1 ? selectedSymbols[0].userid : '',
        deletable: selectedSymbols.length > 0,
        modifiable: false,
        share: selectedSymbols[0].share
    };
};

export let symbolGroupOrNameChanged = function( symbolGroup, symbolName, symbolUserId, share, selectedSymbols, originalSymbolSelected ) {
    const modifiable = selectedSymbols && selectedSymbols.length > 0 &&
        ( symbolGroup !== selectedSymbols[0].symbolGroup ||
          symbolName !== selectedSymbols[0].symbolName && selectedSymbols.length === 1 );
    return { modifiable, deletable: !modifiable && selectedSymbols.length > 0 };
};

export let getGroupNameList = function( list ) {
    const deferred = AwPromiseService.instance.defer();
    if( markupModel.getRole() === 'admin' ) {
        loadAllSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;
            let groupNames = [];

            symbolList.forEach( sym => {
                if( !groupNames.includes( sym.symbolGroup ) ) {
                    groupNames.push( sym.symbolGroup );
                }
            } );

            const groupNameList = groupNames.map( gName => {
                return {
                    propDisplayValue: gName,
                    propInternalValue: gName
                };
            } );

            deferred.resolve(  {
                groupNameList: groupNameList
            } );
        } );
    }else{
        loadSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;
            const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
            symbolList = list.filter( sym => sym.share === share );
            let groupNames = [];
            var outputVals = [];

            symbolList.forEach( sym => {
                if( !groupNames.includes( sym.symbolGroup ) ) {
                    groupNames.push( sym.symbolGroup );
                }
            } );
            const groupNameList = groupNames.map( gName => {
                return {
                    propDisplayValue: gName,
                    propInternalValue: gName
                };
            } );

            deferred.resolve(  {
                groupNameList: groupNameList
            } );
        } );
    }
    return deferred.promise;
};

export let getUserNameList = function( list, symbolGroup ) {
    let userNames = [];

    list.forEach( sym =>{
        if( symbolGroup === sym.symbolGroup ) {
            let pairExists = false;
            for( let i = 0; i < userNames.length; ++i ) {
                if( userNames[i] === sym.userid ) {
                    pairExists = true;
                    break;
                }
            }
            if( !pairExists ) {
                userNames.push( sym.userid );
            }
        }
    } );

    let userNameList = userNames.map( uName => {
        return {
            propDisplayValue: uName,
            propInternalValue: uName
        };
    } );

    return{
        userNameList: userNameList
    };
};

export let setSymbolSize = function( size ) {
    markupModel.setSymbolSize( size );
};

export let symbolFilterChanged = function( text ) {
    const filterList = text.trim().toLowerCase().split( /\s+/ );
    let symbolList = markupModel.getSymbolList();
    filterList.forEach( f => {
        symbolList = symbolList.filter( s => {
            return s.symbolGroup.toLowerCase().includes( f ) ||
                s.symbolName.toLowerCase().includes( f );
        } );
    } );
    return { symbolList: sortSymbolList( symbolList ) };
};

//======================= private functions =========================
/**
 * Set supported tools
 *
 * @param {boolean} visible - If true, check each tool supported or not. If false, all invisible
 */
function setSupportedTools( visible ) {
    var markupCtx = exports.getMarkupContext();
    var supportedTools = {
        highlight: false,
        freehand: false,
        shape: false,
        stamp: false
    };

    var viewerType = markupCtx.viewerType;
    if( visible && markupModel.canMarkup() && !markupCtx.showMarkupSymbolPanel ) {
        supportedTools.highlight = viewerType === 'aw-pdf-viewer' || viewerType === 'aw-text-viewer' || viewerType === 'aw-html-viewer';
        supportedTools.freehand = viewerType === 'aw-pdf-viewer' || viewerType === 'aw-2d-viewer' || viewerType === 'aw-image-viewer';
        supportedTools.shape = supportedTools.freehand;
        supportedTools.stamp = supportedTools.freehand;
    }

    markupCtx = exports.setMarkupContext( 'supportedTools', supportedTools );
}

/**
 * Initialize MarkupOperation
 *
 * @params {Number} tryTimes - try times before quit, if undefined, same as 1
 */
function initOperation( tryTimes ) {
    var markupCtx = exports.getMarkupContext();
    if( markupOperation.init( markupCtx.viewerType, markupCtx.viewerElement ) ) {
        markupOperation.setSelectCallback( selectCallback );
        markupOperation.setSelectionEndCallback( selectionEndCallback );
        markupOperation.setCommandCallback( commandCallback );

        markupCtx = exports.setMarkupContext( 'playing', undefined );
        markupOperation.setPlayChangeCallback( function( playing ) {
            markupCtx = exports.setMarkupContext( 'playing', playing ? true : undefined );
        } );

        markupOperation.addResource( 'images', _images );
        markupOperation.addResource( 'i18n', _i18n );

        var markupList = markupModel.updateMarkupList();
        if( !markupModel.isUpToDate() ) {
            markupList.forEach( function( m ) {
                markupModel.updateMarkupHtml( m );
            } );
        }

        markupOperation.setRevealed( true );
        markupOperation.showCurrentPage();
    } else if( tryTimes > 1 ) {
        window.setTimeout( initOperation, 200, tryTimes - 1 );
    }
}

/**
 * Select callback
 *
 * @param {Markup} markup - the markup being selected in the left panel
 */
function selectCallback( markup ) {
    var markupCtx = exports.getMarkupContext();
    var currentSelection = markupModel.getCurrentSelect();
    if( !markupCtx.editing && ( markupCtx.showPanel || markupCtx.showMarkups ) ) {
        var toSelect = currentSelection === markup ? null : markup;
        markupModel.setCurrentSelect( toSelect );
        eventBus.publish( 'awp0Markup.selectAndScroll' );
    }
}

/**
 * SelectionEndCallback, create a new markup
 *
 * @param {String} tool - the tool caused the selection end
 * @param {String} subTool - the subTool if tool is shape, otherwise undefined
 */
function selectionEndCallback( tool, subTool ) {
    var markupCtx = exports.getMarkupContext();
    if( tool === 'position' ) {
        let currentPos = markupModel.getCurrentPos();
        if( currentPos ) {
            currentPos.date = new Date();
            markupOperation.generateRefImage( currentPos, 400, 200 );
            saveMarkups( currentPos );
        } else {
            markupModel.setNeedUpdateGeom( true );
        }
    } else if( tool === 'stamp' ) {
        const userSelection = markupOperation.getUserSelection();
        if( userSelection && userSelection.geometry ) {
            const stamp = !userSelection.stampName ? markupModel.getCurrentStamp() :
                markupModel.findStamp( userSelection.stampName );
            const markup = markupModel.copyStampAsMarkup( stamp, userSelection.geometry.list[0] );
            markupOperation.generateRefImage( markup, 400, 200 );
            saveMarkups( markup );
            markupModel.setCurrentPos( markup );
            eventBus.publish( 'awp0Markup.deselectAllStamps' );
        }
    } else if( tool === 'shape' && subTool === 'symbol' ) {
        const userSelection = markupOperation.getUserSelection();
        const symbols = markupModel.getCurrentSymbols();
        if( symbols && symbols.length > 0 && userSelection && userSelection.geometry ) {
            const markup = markupModel.copySymbolAsMarkup( symbols[0], userSelection.geometry.list[0] );
            markupModel.updateMarkupHtml( markup, true );
            markupOperation.generateRefImage( markup, 400, 200 );
            saveMarkups( markup );
            markupModel.setCurrentPos( markup );
        }
    } else if( tool === 'highlight' || tool === 'freehand' || tool === 'shape' ) {
        var newMarkup = markupModel.addNewMarkup();
        if( newMarkup ) {
            // for cloud, show the proposed object with the cloud stroke type
            if( tool === 'shape' && subTool === 'cloud' ) {
                newMarkup.geometry.list[0].stroke = {
                    color: '',
                    style: 'cloud',
                    width: 'mid'
                };
            }
            exports.selectTool( null );
            markupCtx = exports.setMarkupContext( 'editing', true );
            markupModel.setCurrentSelect( newMarkup );
            markupModel.setCurrentEdit( newMarkup );
            newMarkup.editMode = 'new';

            if( markupCtx.showPanel ) {
                eventBus.publish( 'awPanel.navigate', {
                    destPanelId: 'Awp0MarkupEdit',
                    title: _i18n.add,
                    recreatePanel: true,
                    supportGoBack: true
                } );
            } else if( markupCtx.dialogAction ) {
                const options = {
                    view: 'Awp0MarkupEditMain',
                    parent: markupCtx.dialogParent,
                    width: 'SMALL',
                    height: 'FULL',
                    isCloseVisible: false
                };
                markupOperation.showCurrentPage();
                markupCtx.dialogAction.show( options );
            } else {
                markupOperation.showCurrentPage();
                commandPanelSvc.activateCommandPanel(
                    'Awp0MarkupEditMain', 'aw_toolsAndInfo', null, false );
            }
        }
    }
}

/**
 * Command callback
 *
 * @param {String} cmd - the command: cmdEdit, cmdReply, or cmdDelete
 * @param {Markup} markup - the markup of the command
 */
function commandCallback( cmd, markup ) {
    if( cmd === 'cmdEdit' ) {
        exports.editMarkup( markup );
    } else if( cmd === 'cmdDelete' ) {
        exports.deleteMarkup( markup );
    } else if( cmd === 'cmdReply' ) {
        exports.replyMarkup( markup );
    }
}
/**
 * Clear markups in the left panel
 */
function clearMarkups() {
    exports.selectTool( null );
    setSupportedTools( false );
    markupModel.setCurrentSelect( null );

    markupOperation.setRevealed( false );
    markupModel.clearMarkupList();
    eventBus.publish( 'awp0Markup.callDataProvider' );
}

/**
 * Save the markups
 *
 * @param {Markup} markup - the markup to be saved, or undefined for single_user
 */
function saveMarkups( markup ) {
    const markupCtx = exports.getMarkupContext();
    const callback = overrideSave[ markupCtx.viewerType ];

    if( callback ) {
        callback( markupCtx.baseObject, markupCtx.version, markup );
    } else if( markupCtx.baseObject ) {
        const json = !markup ? markupModel.stringifyMarkups( false ) :
            '[' + markupModel.stringifyMarkup( markup ) + ']';
        const msg = !markup ? 'single_user' : markup.deleted ? 'delete' :
            markup.date.toISOString() === markup.created ? 'add' : 'modify';

        const inputData = {
            baseObject: markupCtx.baseObject,
            action: 'saveMarkups',
            version: markupCtx.version,
            message: msg + ' ' + markupCtx.viewerType,
            markups: json
        };

        var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
        promise.then( function( response ) {
            if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length ) {
                var errValue = response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ];
                var buttons;
                if( errValue.code === 499001 || errValue.code === 499002 ) {
                    buttons = [ {
                        addClass: 'btn btn-notify',
                        text: _i18n.cancel,
                        onClick: function( btn ) {
                            btn.close();
                        }
                    },
                    {
                        addClass: 'btn btn-notify',
                        text: _i18n.save,
                        onClick: function( btn ) {
                            btn.close();
                            saveMarkups( markup );
                        }
                    }
                    ];
                }
                messageService.showWarning( errValue.message, buttons );
            } else {
                exports.processMarkups( response );
            }
        } ).catch( function( err ) {
            console.error( err );
            messageService.showError( _i18n.serverOrNetworkError );
        } );
    } else {
        setShowMarkupsInfo();
    }
}

/**
 * Load the markups
 */
function loadMarkups() {
    const markupCtx = exports.getMarkupContext();
    const callback = overrideLoad[ markupCtx.viewerType ];

    if( callback ) {
        callback( markupCtx.baseObject, markupCtx.version );
    } else if( markupCtx.baseObject ) {
        const inputData = {
            baseObject: markupCtx.baseObject,
            action: 'loadMarkups',
            version: markupCtx.version,
            message: markupCtx.viewerType,
            markups: ''
        };

        var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
        promise.then( function( response ) {
            exports.processMarkups( response );
        } );
    } else {
        setShowMarkupsInfo();
    }
}

/**
 * Save the stamps
 *
 * @param {Markup} stamp - the stamp to be saved
 */
function saveStamps( stamp ) {
    var markupCtx = exports.getMarkupContext();
    var json = '[' + markupModel.stringifyMarkup( stamp ) + ']';
    var msg = stamp.deleted ? 'delete' :
        stamp.date.toISOString() === stamp.created ? 'add' : 'modify';

    var inputData = {
        baseObject: markupCtx.baseObject,
        action: 'saveStamps',
        version: markupCtx.stampVersion,
        message: msg,
        markups: json
    };

    var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
    promise.then( function( response ) {
        if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length ) {
            var errValue = response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ];
            messageService.showWarning( errValue.message );
        } else {
            processStamps( response );
            if( msg === 'add' || msg === 'modify' ) {
                var message = msg === 'add' ? _i18n.stampAdded : _i18n.stampReplaced;
                var where = stamp.share === 'public' ? _i18n.sharedStamps : _i18n.myStamps;
                var info = message.replace( '{0}', stamp.stampName ).replace( '{1}', where );
                messageService.showInfo( info );
            }
        }
    } );
}

/**
 * Load the stamps
 */
function loadStamps() {
    const markupCtx = exports.getMarkupContext();
    const callback = overrideLoad[ markupCtx.viewerType ];

    if( !callback ) {
        var inputData = {
            baseObject: markupCtx.baseObject,
            action: 'loadStamps',
            version: markupCtx.stampVersion,
            message: '',
            markups: ''
        };

        var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
        promise.then( function( response ) {
            processStamps( response );
        } );
    }
}

/**
 * Process Stamps
 *
 * @param {Object} response - The soa response
 * @return {Object} the markup data
 */
function processStamps( response ) {
    var markupCtx = exports.getMarkupContext();
    var message = response.message || '';

    exports.setMarkupContext( 'stampsLoaded', true, 'stampVersion', response.version );
    markupModel.processStamps( response.version, message, response.markups );
    markupModel.updateStampList();

    eventBus.publish( 'awp0Markup.callStampDataProvider' );
    var stampList = markupModel.getStampList();
    if( message.indexOf( 'up_to_date' ) < 0 ) {
        stampList.forEach( function( s ) {
            markupModel.updateMarkupHtml( s );
        } );
    }

    return stampList;
}

/**
 * Can create stamp from markup
 * @param {*} markup - the markup
 * @returns {Boolean} true if it can
 */
function canCreateStamp( markup ) {
    if( markup.editMode !== 'reply' && markup.geometry && markup.geometry.list.length === 1 ) {
        var shape = markup.geometry.list[0].shape;
        return shape === 'rectangle' || shape === 'ellipse' ||
               shape === 'circle' || shape === 'gdnt';
    }

    return false;
}

/**
 * Set the thumbnail and type icon for a specific user
 *
 * @param {User} user - the user object
 */
function setUserIcon( user ) {
    var thumbnailUrl = awIconService.getThumbnailFileUrl( user );
    var typeIconURL = awIconService.getTypeIconFileUrl( user );

    if( thumbnailUrl ) {
        user.hasThumbnail = true;
    }
    user.thumbnailURL = thumbnailUrl;
    user.typeIconURL = typeIconURL;
}

/**
 * Initialize CKEditor
 *
 * @param {Markup} markup - the input markup
 * @param {Boolean} allowInsertImage - allow insert image
 */
function initEditor( markup, allowInsertImage ) {
    const ckEditorElement = $( '#mrkeditor' );
    if( ckEditorElement.length > 0 && !showSymbol( markup ) ) {
        const buttons = [
            'Bold', 'Italic', '|',
            'FontFamily', 'FontSize', '|',
            'FontColor', 'FontBackgroundColor', '|',
            'Alignment' ];
        if( allowInsertImage ) {
            buttons.push( 'ImageUpload' );
        }

        awEditorService.createInline( ckEditorElement[0], {
            toolbar: buttons,
            linkShowTargetTab: false,
            toolbarCanCollapse: false,
            skin: 'moono_cus',
            height: 250,
            imageMaxSize: markupModel.getMarkupFillSize( markup ),
            language: _i18n._locale,
            extraPlugins: [ 'clientImage' ],
            removePlugins: [ 'resize', 'flash', 'save', 'iframe', 'pagebreak', 'horizontalrule', 'elementspath', 'div', 'scayt', 'wsc', 'ImageCaption', 'ImageResize' ],
            allowedContent: 'p img div span br strong em table tr td[*]{*}(*)',
            fontSize: {
                options: [ 'default', 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72 ]
            },
            image: {
                resizeUnit: 'px'
            }
        } ).then( cke => {
            if( 'CKEDITOR' in window ) {
                // Add override CSS styles for inside editable contents area for iPad.
                CKEDITOR.addCss( '@media only screen and (min-device-width : 768px) and (max-device-width : 1024px) { html { background-color: #eeeeee; }}' );
            }

            const imageMaxSize = markupModel.getMarkupFillSize( markup );
            if( imageMaxSize ) {
                cke.setMaxSizeForImage( imageMaxSize );
            }
            ckeEditor = cke;
            cke.setData( markup.comment );
        } );
    }
}

/**
 * Find uiValue from given dbValue and a list of values
 *
 * @param {String} dbValue - the dbValue
 * @param {LOV} listOfValues - the list of values
 *
 * @returns {String} the found uiValue
 */
function findLovUiValue( dbValue, listOfValues ) {
    for( let i = 0; i < listOfValues.length; i++ ) {
        if( dbValue === listOfValues[i].propInternalValue ) {
            return listOfValues[i].propDisplayValue;
        }
    }

    return dbValue;
}

/**
 * Check if show symbol of a markup
 *
 * @param {Markup} markup - the markup to be tested
 * @param {String} symbol - can be gdnt, weld, leader, symbol, or any of them if undefined
 * @returns {boolean} true if show the symbol
 */
function showSymbol( markup, symbol ) {
    const symbols = symbol ? [ symbol ] : [ 'gdnt', 'weld', 'leader', 'symbol' ];
    return markup.editMode !== 'reply' &&
           markup.type === '2d' && symbols.includes( markup.geometry.list[ 0 ].shape );
}

/**
 * Basic options from markup to UI
 *
 * @param {Markup} markup - the markup to get basic options
 * @param {Data} inData - the input immutable data
 *
 * @returns {Data} the output data
 */
function basicOptionMarkupToUI( markup, inData ) {
    let outData = {
        saveButtonText: '',
        showTextTab: true,
        tabsEditModel: _.clone( inData.tabsEditModel ),
        allowInsertImage: true,
        showGdnt: false,
        showWeld: false,
        showLeader: false,
        showSymbol: false,
        showCreateStamp: false,
        shareStamp: false,
        gdntValue: _.clone( inData.gdntValue ),
        weldValue: _.clone( inData.weldValue ),
        leaderValue: _.clone( inData.leaderValue ),
        symbolValue: _.clone( inData.symbolValue ),
        status: _.clone( inData.status ),
        showOnPageVisible: false,
        applyOnPageVisible: false,
        showOnPage: _.clone( inData.showOnPage ),
        showOnPageValues: _.clone( inData.showOnPageValues ),
        showShareAs: true,
        shareAs: _.clone( inData.shareAs ),
        shareAsValues: _.cloneDeep( inData.shareAsValues ),
        shareWithValues: _.cloneDeep( inData.shareWithValues )
    };

    outData.saveButtonText = markup.editMode === 'new' ? inData.i18n.create :
        markup.editMode === 'reply' ? inData.i18n.reply : inData.i18n.save;
    outData.showGdnt = showSymbol( markup, 'gdnt' );
    outData.showWeld = showSymbol( markup, 'weld' );
    outData.showLeader = showSymbol( markup, 'leader' );
    outData.showSymbol = showSymbol( markup, 'symbol' );
    outData.showCreateStamp = canCreateStamp( markup );
    outData.shareStamp = markupModel.getStampShare() === 'public';

    if( outData.showGdnt ) {
        outData.gdntValue.dbValue = markup.comment;
    } else if( outData.showWeld ) {
        outData.weldValue.dbValue = markup.comment;
    } else if( outData.showLeader ) {
        outData.leaderValue.dbValue = markup.comment;
    } else if( outData.showSymbol ) {
        outData.symbolValue.dbValue = markup.comment;
    }

    if( markup.status !== 'open' ) {
        outData.status.dbValue = markup.status;
        outData.status.uiValue = findLovUiValue( outData.status.dbValue, inData.statusValues.dbValue );
    }

    outData.showOnPageVisible = markup.status === 'open' && markup.type === '2d' &&
        !outData.showGdnt && !outData.showWeld && !outData.showSymbol;

    if( outData.showLeader ) {
        outData.showOnPageValues.dbValue.splice( 0, 3 );
    } else {
        outData.showOnPageValues.dbValue.splice( 3, 2 );
    }
    outData.showOnPage.dbValue = markup.showOnPage ? markup.showOnPage : outData.showLeader ? 'centered' : 'none';
    outData.showOnPage.uiValue = findLovUiValue( outData.showOnPage.dbValue, inData.showOnPageValues.dbValue );

    if( outData.shareAs && outData.shareAsValues ) {
        var shareWords = markup.share.split( ' ' );
        outData.shareAs.dbValue = shareWords[ 0 ];
        outData.shareAs.uiValue = findLovUiValue( outData.shareAs.dbValue, inData.shareAsValues.dbValue );

        if( markupModel.getRole() !== 'author' ) {
            outData.shareAsValues.dbValue.splice( 3, 1 );
            outData.shareAsValues.dbValue.splice( 1, 1 );
        }

        var users = markupModel.getUsers();
        for( var i = 0; i < users.length; i++ ) {
            var usr = _.clone( inData.shareWith );
            usr.propertyDisplayName = users[ i ].displayname;
            usr.userId = users[ i ].userid;
            usr.dbValue = i === 0 || shareWords.indexOf( users[ i ].userid ) > 0;
            usr.isEnabled = i > 0;

            outData.shareWithValues.push( usr );
        }
    }

    return outData;
}

/**
 * Geometry options from markup to UI
 *
 * @param {Markup} markup - the markup to get geom options
 * @param {Data} inData - the input data
 *
 * @returns {Data} the output data
 */
function geomOptionMarkupToUI( markup, inData ) {
    let outData = {
        showStyleTab: false,
        allowFill: false,
        allowEdge: false,
        allowLine: false,
        allowStartArrow: false,
        allowEndArrow: false,
        allowCorner: false,
        fillStyle: _.clone( inData.fillStyle ),
        fillColor: _.clone( inData.fillColor ),
        hatchColor: _.clone( inData.hatchColor ),
        fillSlider: _.cloneDeep( inData.fillSlider ),
        edgeStyle: _.clone( inData.edgeStyle ),
        edgeWidth: _.clone( inData.edgeWidth ),
        edgeColor: _.clone( inData.edgeColor ),
        cornerSlider: _.cloneDeep( inData.cornerSlider ),
        strokeStyleValues: _.cloneDeep( inData.strokeStyleValues ),
        lineStyle: _.clone( inData.lineStyle ),
        lineWidth: _.clone( inData.lineWidth ),
        lineColor: _.clone( inData.lineColor ),
        startArrow: _.clone( inData.startArrow ),
        endArrow: _.clone( inData.endArrow )
    };

    if( markup && markup.geometry && markup.geometry.list ) {
        markup.geometry.list.forEach( ( e ) => {
            if( e.shape === 'circle' || e.shape === 'ellipse' ||
                e.shape === 'rectangle' || e.shape === 'polygon' || e.shape === 'closed-curve' ) {
                outData.showStyleTab = true;
                outData.allowFill = true;
                outData.allowEdge = true;
                outData.fillStyle.dbValue = e.fill ? e.fill.style : 'none';
                outData.fillStyle.value = outData.fillStyle.dbValue;
                outData.fillStyle.uiValue = findLovUiValue( outData.fillStyle.dbValue, inData.fillStyleValues.dbValue );
                outData.fillColor.dbValue = e.fill && e.fill.color ? e.fill.color.substring( 0, 7 ) : '#ffa500';
                outData.fillColor.value = outData.fillColor.dbValue;
                outData.fillColor.uiValue = findLovUiValue( outData.fillColor.dbValue, inData.fillColorValues.dbValue );
                outData.hatchColor.dbValue = e.fill && e.fill.color ? e.fill.color.substring( 0, 7 ) : '';
                outData.hatchColor.value = outData.hatchColor.dbValue;
                outData.hatchColor.uiValue = findLovUiValue( outData.hatchColor.dbValue, inData.strokeColorValues.dbValue );
                outData.fillSlider.dbValue[ 0 ].sliderOption.value = e.fill && e.fill.color ? getTransparencyFromColor( e.fill.color ) : 128;
                outData.edgeStyle.dbValue = e.stroke ? e.stroke.style : 'solid';
                outData.edgeStyle.value = outData.edgeStyle.dbValue;
                outData.edgeStyle.uiValue = findLovUiValue( outData.edgeStyle.dbValue, inData.strokeStyleValues.dbValue );
                outData.edgeWidth.dbValue = e.stroke ? e.stroke.width : 'mid';
                outData.edgeWidth.value = outData.edgeWidth.dbValue;
                outData.edgeWidth.uiValue = findLovUiValue( outData.edgeWidth.dbValue, inData.strokeWidthValues.dbValue );
                outData.edgeColor.dbValue = e.stroke ? e.stroke.color : '';
                outData.edgeColor.value = outData.edgeColor.dbValue;
                outData.edgeColor.uiValue = findLovUiValue( outData.edgeColor.dbValue, inData.strokeColorValues.dbValue );

                if( e.shape === 'rectangle' ) {
                    outData.allowCorner = true;
                    outData.cornerSlider.dbValue[ 0 ].sliderOption.value = e.cornerRadius ? e.cornerRadius * 100 : 0;
                }

                if( e.shape !== 'polygon' ) {
                    outData.strokeStyleValues.dbValue.splice( 6, 1 );
                }
            } else if( e.shape === 'polyline' || e.shape === 'curve' || e.shape === 'freehand' ||
                       e.shape === 'gdnt' || e.shape === 'weld' || e.shape === 'leader' ) {
                outData.showStyleTab = true;
                outData.allowLine = true;
                outData.lineStyle.dbValue = e.stroke ? e.stroke.style : 'solid';
                outData.lineStyle.value = outData.lineStyle.dbValue;
                outData.lineStyle.uiValue = findLovUiValue( outData.lineStyle.dbValue, inData.strokeStyleValues.dbValue );
                outData.lineWidth.dbValue = e.stroke ? e.stroke.width : 'mid';
                outData.lineWidth.value = outData.lineWidth.dbValue;
                outData.lineWidth.uiValue = findLovUiValue( outData.lineWidth.dbValue, inData.strokeWidthValues.dbValue );
                outData.lineColor.dbValue = e.stroke ? e.stroke.color : '';
                outData.lineColor.value = outData.lineColor.dbValue;
                outData.lineColor.uiValue = findLovUiValue( outData.lineColor.dbValue, inData.strokeColorValues.dbValue );

                if( e.shape !== 'freehand' ) {
                    outData.allowStartArrow = true;
                    outData.startArrow.dbValue = e.startArrow === true ? 'open' : e.startArrow ? e.startArrow.style : 'none';
                    outData.startArrow.value = outData.startArrow.dbValue;
                    outData.startArrow.uiValue = findLovUiValue( outData.startArrow.dbValue, inData.startArrowValues.dbValue );

                    if( e.shape === 'polyline' || e.shape === 'curve' ) {
                        outData.allowEndArrow = true;
                        outData.endArrow.dbValue = e.endArrow === true ? 'open' : e.endArrow ? e.endArrow.style : 'none';
                        outData.endArrow.value = outData.endArrow.dbValue;
                        outData.endArrow.uiValue = findLovUiValue( outData.endArrow.dbValue, inData.endArrowValues.dbValue );
                    }
                }

                outData.strokeStyleValues.dbValue.splice( 6, 1 );
            }
        } );
    }

    return outData;
}

/**
 * Geometry options from UI to markup
 *
 * @param {Markup} markup - the markup to set geom options
 * @param {Data} data - the input data
 */
function geomOptionUIToMarkup( markup, data ) {
    if( markup && markup.geometry && markup.geometry.list ) {
        markup.geometry.list.forEach( ( e ) => {
            if( e.shape === 'circle' || e.shape === 'ellipse' ||
                e.shape === 'rectangle' || e.shape === 'polygon' || e.shape === 'closed-curve' ) {
                e.fill = data.fillStyle.dbValue === 'none' ? undefined : {
                    style: data.fillStyle.dbValue,
                    color: data.fillStyle.dbValue === 'solid' ?
                        addTransparencyToColor( data.fillSlider.dbValue[ 0 ].sliderOption.value, data.fillColor.dbValue ) : data.hatchColor.dbValue
                };
                e.stroke = data.edgeStyle.dbValue === 'solid' &&
                    data.edgeWidth.dbValue === 'mid' &&
                    data.edgeColor.dbValue === '' ? undefined : {
                        style: data.edgeStyle.dbValue,
                        width: data.edgeWidth.dbValue,
                        color: data.edgeColor.dbValue
                    };
                e.cornerRadius = data.allowCorner ? data.cornerSlider.dbValue[ 0 ].sliderOption.value / 100 : undefined;
            } else if( e.shape === 'polyline' || e.shape === 'curve' || e.shape === 'freehand' ||
                      e.shape === 'gdnt' || e.shape === 'weld' || e.shape === 'leader' ) {
                e.stroke = data.lineStyle.dbValue === 'solid' &&
                    data.lineWidth.dbValue === 'mid' &&
                    data.lineColor.dbValue === '' ? undefined : {
                        style: data.lineStyle.dbValue,
                        width: data.lineWidth.dbValue,
                        color: data.lineColor.dbValue
                    };
                if( e.shape !== 'freehand' ) {
                    e.startArrow = data.startArrow.dbValue === 'none' ? undefined : {
                        style: data.startArrow.dbValue
                    };
                    e.endArrow = data.endArrow.dbValue === 'none' ? undefined : {
                        style: data.endArrow.dbValue
                    };
                }
            }
        } );
    }
}

/**
 * Get transparency from color
 * @param {Color} color - the input color #RRGGBB or #RRGGBBAA
 * @return {Number} transparency value 0 (opaque) to 255 (transparent)
 */
function getTransparencyFromColor( color ) {
    return color.length > 7 ? 255 - parseInt( color.substring( 7 ), 16 ) : 0;
}

/**
 * Add transparency to color
 * @param {Number} transparency value 0 (opaque) to 255 (transparent)
 * @param {Color} color - the input color #RRGGBB
 * @return {Color} the output color #RRGGBB or #RRGGBBAA
 */
function addTransparencyToColor( transparency, color ) {
    return transparency === 0 ? color : color + Number( 0x1ff - transparency ).toString( 16 ).substring( 1 );
}

/**
 * Set the Awp0ShowMarkup command info: indicator
 *
 * @param {Number} option The option 0=SHOW 1=REMOVE
 */
function setShowMarkupsInfo( option ) {
    let markupCtx = exports.getMarkupContext();
    markupCtx = exports.setMarkupContext( 'count', markupModel.getCount() );

    const elem = markupCtx.viewerElement || document;
    const button = elem.querySelector( 'button[button-id="Awp0ShowMarkups"]' );

    if( button ) {
        if( !markupCtx.showMarkups || option ) {
            button.classList.remove( 'aw-state-selected' );
        } else {
            button.classList.add( 'aw-state-selected' );
        }

        const svg = button.querySelector( 'svg' );
        let indicator = svg.querySelector( '#indicator' );

        if( !indicator ) {
            indicator = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
            indicator.setAttribute( 'id', 'indicator' );
            indicator.setAttribute( 'cx', 5 );
            indicator.setAttribute( 'cy', 5 );
            indicator.setAttribute( 'r', 5 );
            svg.appendChild( indicator );
        }

        const fill = !option && markupCtx.showMarkups && markupCtx.count > 0 ? '#eb780a' : 'none';
        indicator.setAttribute( 'fill', fill );
    }
}

/**
 * Check if the two parents are in the same viewer
 *
 * @param {Element} parent1 - the first parent
 * @param {Element} parent2 - the second parent
 * @returns {Boolean} true if they are in the same viewer, or in different pages
 */
function commonViewer( parent1, parent2 ) {
    if( parent1 === parent2 ) {
        return true; // in the same viewer
    }

    for( let parent = parent1; parent; parent = parent.parentElement ) {
        if( parent.contains( parent2 ) ) {
            return false; // in different viewers of the same page
        }
    }

    return true; // in different pages
}

/**
 * Add one symbol from file to list
 * @param {File} file - the SVG file
 * @param {String} name - the symbol name that is the file name
 * @param {Markup[]} list - the symbol list
 * @param {Number} length - the expected length of list
 * @param {Deferred} deferred - the deferred to resolve when reaches the expected length
 */
function addOneSymbol( file, name, list, length, deferred ) {
    const reader = new FileReader();
    reader.addEventListener( 'load', ( event ) => {
        const sym = markupModel.addNewSymbol( event.target.result, name );
        list.push( sym );

        if( list.length === length ) {
            deferred.resolve( { symbolList: list, uploadable: true } );
        }
    } );
    reader.readAsText( file );
}

/**
 * Load all symbols from the server
 * @param {Function} callback - the callback function
 */
function loadSymbols( callback ) {
    const markupCtx = exports.getMarkupContext();

    var inputData = {
        baseObject: markupCtx.baseObject,
        action: 'loadStamps',
        version: markupCtx.symbolVersion,
        message: 'datasetPrefix="custom_symbols"',
        markups: ''
    };

    var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
    promise.then( function( response ) {
        const symbolList = exports.processSymbols( response );
        if( callback ) {
            callback( symbolList );
        }
    } );
}

/**
 * Load all symbols from the server. *
 * @param {Object} callback the callback funtion
 */
function loadAllSymbols( callback ) {
    const markupCtx = exports.getMarkupContext();
    var inputData = {
        baseObject: markupCtx.baseObject,
        action: 'loadAllStamps',
        version: markupCtx.symbolVersion,
        message: 'datasetPrefix="custom_symbols"',
        markups: ''
    };

    var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
    promise.then( function( response ) {
        const symbolList = exports.processSymbols( response );
        if( callback ) {
            callback( symbolList );
        }
    } );
}


/**
 * Save symbols to the server
 * @param {Markup[]} list - the symbols to be saved
 * @param {String} action - create, modify, or delete
 * @param {Function} callback - the callback function
 */
export function saveSymbols( list, action, callback ) {
    var markupCtx = exports.getMarkupContext();
    var json = markupModel.stringifyMarkupList( list );
    var msg = action + ' datasetPrefix="custom_symbols"';

    list.forEach( sym => {
        sym.selected = false;
        if( action === 'delete' ) {
            sym.deleted = true;
        }
    } );

    var inputData = {
        baseObject: markupCtx.baseObject,
        action: 'saveStamps',
        version: action === 'add' ? '' : markupCtx.symbolVersion,
        message: msg,
        markups: json
    };

    var promise = soaSvc.postUnchecked( 'Markup-2022-06-Markup', 'processMarkups', inputData );
    promise.then( function( response ) {
        if( response.ServiceData && response.ServiceData.partialErrors && response.ServiceData.partialErrors.length ) {
            var errValue = response.ServiceData.partialErrors[ 0 ].errorValues[ 0 ];
            messageService.showWarning( errValue.message );
        } else {
            const symbolList = exports.processSymbols( response );
            if( callback ) {
                callback( symbolList );
            }
        }
    } );
}

/**
 * Manage panel Save symbols to the server. Despite the name it's only ever 1 symbol.
 * @param {Markup[]} originallist - the original symbols
 * @param {Markup[]} list - the modified symbols to be saved
 * @param {String} action - create, modify, or delete
 * @param {Function} callback - the callback function
 */
export function manageSaveSymbols( originallist, list, action, callback ) {
    var origGroup = originallist[0].symbolGroup;
    var origName = originallist[0].symbolName;
    var origUserId = originallist[0].userid;
    var origShare = originallist[0].share;
    var markupCtx = exports.getMarkupContext();
    var json = markupModel.stringifyMarkupList( list );
    var msg = action + ' datasetPrefix="custom_symbols" origShare="' + origShare + '"';

    list.forEach( sym => {
        sym.selected = false;
        if( action === 'delete' ) {
            sym.deleted = true;
        }
        if( origGroup !== sym.symbolGroup ) {
            msg += ' origGroup="' + origGroup + '"';
        }
        if( origName !== sym.symbolName ) {
            msg += ' origName="' + origName + '"';
        }
        if( origUserId !== sym.userid ) {
            msg += ' origUserId="' + origUserId + '"';
        }
    } );

    var inputData = {
        baseObject: markupCtx.baseObject,
        action: 'manageSymbols',
        version: action === 'add' ? '' : markupCtx.symbolVersion,
        message: msg,
        markups: json
    };

    eventBus.publish( 'awMarkupService.manageSymbols', inputData );
}

/**
 * Process Symbols
 *
 * @param {Object} response - The soa response
 * @return {Object} the symbol list
 */
export function processSymbols( response ) {
    var message = response.message || '';

    exports.setMarkupContext( 'symbolVersion', response.version );
    markupModel.processSymbols( response.version, message, response.markups );

    return sortSymbolList( markupModel.getSymbolList() );
}

/**
 * Sort symbol list
 * @param {Markup[]} symbolList - the symbol list
 * @returns {Markup[]} the sorted symbol list
 */
function sortSymbolList( symbolList ) {
    return symbolList.sort( ( a, b ) => {
        if( a.share !== b.share ) {
            return a.share === 'private' ? -1 : 1;
        } else if( a.symbolGroup && b.symbolGroup && a.symbolGroup !== b.symbolGroup ) {
            return a.symbolGroup === i18n.mySymbols || a.symbolGroup === i18n.sharedSymbols ? -1 :
                b.symbolGroup === i18n.mySymbols || b.symbolGroup === i18n.sharedSymbols ? 1 :
                    a.symbolGroup.localeCompare( b.symbolGroup );
        }

        return a.symbolName.localeCompare( b.symbolName );
    } );
}

/**
 * Get the symbol list and group name list
 * @param {Deferred} deferred - the deferred
 * @param {Markup[]} list - the updated list from saveSymbol
 */
function resolveSymbolAndGroupList( deferred, list ) {
    if( markupModel.getRole() === 'admin' ) {
        const symbolList = list;

        const groupNameList = [];
        const selectedSymbols = [];
        const modifiable = false;
        const deletable = false;
        deferred.resolve( { symbolList, groupNameList, selectedSymbols, modifiable, deletable } );
    }else{
        const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
        const symbolList = list.filter( sym => sym.share === share );

        const groupNameList = [];
        const selectedSymbols = [];
        const modifiable = false;
        const deletable = false;
        deferred.resolve( { symbolList, groupNameList, selectedSymbols, modifiable, deletable } );
    }
}

/**
 * @returns {String} - get current locale code
 */
let getLocaleCode = function() {
    var currentLocale = localeSvc.getLocale();

    var localeName = currentLocale.substring( 0, 2 );

    // Normally first 2 characters, but we have 2 exceptions. And yes there is a dash and not an underscore.
    if( currentLocale === 'pt_BR' || currentLocale === 'zh_CN' ) {
        localeName = currentLocale.replace( /_/g, '-' );
    }
    return localeName;
};

let loadConfiguration = () => {
    localeSvc.getTextPromise( 'MarkupMessages', true ).then( ( textBundle ) => {
        $.extend( _i18n, textBundle );
    } );

    localeSvc.getTextPromise( 'dateTimeServiceMessages', true ).then( ( textBundle ) => {
        $.extend( _i18n, textBundle );
    } );

    _i18n._locale = getLocaleCode();
    _images.miscAccept = svgToUrl( miscAccept );
    _images.miscUndo = svgToUrl( miscUndo );
    _images.miscRedo = svgToUrl( miscRedo );
    _images.miscDelete = svgToUrl( miscDelete );
    _images.cmdEdit = svgToUrl( cmdEdit );
    _images.cmdReply = svgToUrl( cmdReply );
    _images.cmdDelete = svgToUrl( cmdDelete );

    /**
     * Listening to viewer context value changed
     */
    eventBus.subscribe( 'appCtx.register', ( eventData ) => {
        if( eventData && eventData.name === 'viewerContext' ) {
            exports.viewerChanged( eventData );
        }
    }, 'Awp0MarkupService' );
};

let svgToUrl = ( svg ) => {
    if( URL && URL.createObjectURL ) {
        return URL.createObjectURL( new Blob( [ svg ], { type: 'image/svg+xml;charset=utf-8' } ) );
    }

    return svg;
};

let toI18n = ( text, i18n ) => {
    var array = text.split( ' ' );
    var replaced = false;

    array.forEach( ( word, i ) => {
        if( i18n[ word ] ) {
            array[ i ] = i18n[ word ];
            replaced = true;
        }
    } );
    return replaced ? array.join( ' ' ) : text;
};

let toStatusInfo = ( markup, i18n ) => {
    var status = markupModel.getStatus( markup );
    return i18n[ status ];
};

let toShareInfo = ( markup, i18n ) => {
    var info = '';
    if( markup.share ) {
        var share = markup.share.split( ' ' )[ 0 ];
        info += markupModel.isEditable( markup ) ? i18n.markupIsEditable : i18n.markupIsReadonly;
        info += '\n' + i18n.sharedAs + ' ' + i18n[ share ] + ': ' + i18n[ share + 'Tip' ];

        if( share === 'users' ) {
            var userids = markup.share.split( ' ' );
            for( var i = 1; i < userids.length; i++ ) {
                var user = markupModel.findUser( userids[ i ] );
                if( user ) {
                    info += '\n\t' + user.displayname;
                }
            }
        }
    }

    return info;
};

export let openCreateSymbolPanel = function( ) {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.showMarkupSymbolPanel ) {
        eventBus.publish( 'awPanel.navigate', {
            destPanelId: 'Awp0CreateMarkupSymbol',
            title: _i18n.createSymbol,
            supportGoBack: true
        } );
    } else if( markupCtx.dialogAction ) {
        const options = {
            view: 'Awp0CreateMarkupSymbolMain',
            parent: markupCtx.dialogParent,
            width: 'STANDARD',
            height: 'FULL',
            push: true,
            isCloseVisible: false,
            commandid: 'Awp0MarkupCreateSymbol',
            commandicon: 'cmdAdd'
        };
        markupCtx.dialogAction.show( options );
    } else {
        commandPanelSvc.activateCommandPanel(
            'Awp0CreateMarkupSymbolMain', 'aw_toolsAndInfo', null, false );
    }
};

export let openEditSymbolPanel = function( ) {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.showMarkupSymbolPanel ) {
        eventBus.publish( 'awPanel.navigate', {
            destPanelId: 'Awp0EditMarkupSymbol',
            title: _i18n.editSymbol,
            supportGoBack: true
        } );
    } else if( markupCtx.dialogAction ) {
        const options = {
            view: 'Awp0EditMarkupSymbolMain',
            parent: markupCtx.dialogParent,
            width: 'STANDARD',
            height: 'FULL',
            push: true,
            isCloseVisible: false,
            commandid: 'Awp0MarkupEditSymbol',
            commandicon: 'cmdEdit'
        };
        markupCtx.dialogAction.show( options );
    } else {
        commandPanelSvc.activateCommandPanel(
            'Awp0EditMarkupSymbolMain', 'aw_toolsAndInfo', null, false );
    }
};

export let openManageSymbolPanel = function( destPanelId, titleLabel ) {
    let markupCtx = exports.getMarkupContext();
    if( markupCtx.showMarkupSymbolPanel ) {
        eventBus.publish( 'awPanel.navigate', {
            destPanelId: destPanelId,
            title: titleLabel,
            supportGoBack: true,
            recreatePanel: true,
            isolateMode: true
        } );
    } else if( markupCtx.dialogAction ) {
        const options = {
            view: destPanelId + 'Main',
            parent: markupCtx.dialogParent,
            width: 'STANDARD',
            height: 'FULL',
            push: true,
            isCloseVisible: false,
            commandid: destPanelId === 'Awp0CreateGroup' ? 'Awp0MarkupCreateGroup' : 'Awp0MarkupSymbolManage',
            commandicon: destPanelId === 'Awp0CreateGroup' ? 'cmdCreateGroup' : 'cmdManage'
        };
        markupCtx.dialogAction.show( options );
    } else {
        commandPanelSvc.activateCommandPanel(
            destPanelId + 'Main', 'aw_toolsAndInfo', null, false );
    }
};

export let getSelectedSymbolDetails = function( list, ctx ) {
    const selectedSymbols = list.filter( sym => sym.selected );
    const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
    const selectedSymbolShare = selectedSymbols.length > 0 ? selectedSymbols[0].share : '';
    var symbolNameToModifyOrDelete = selectedSymbols.length > 0 ? selectedSymbols[0].symbolName : '';
    var symbolGroupToModifyOrDelete = selectedSymbols.length > 0 ? selectedSymbols[0].symbolGroup : '';
    var selectedSymbolsToModifyOrDelete = selectedSymbols;

    if ( selectedSymbols.length > 0 ) {
        appCtxSvc.updateCtx( 'createCommandVisibleCtx', false );
        if ( !ctx.selectedSymbolsToModifyOrDeleteCtx ) {
            appCtxSvc.registerCtx( 'symbolNameToModifyOrDeleteCtx', symbolNameToModifyOrDelete );
            appCtxSvc.registerCtx( 'symbolGroupToModifyOrDeleteCtx', symbolGroupToModifyOrDelete );
            appCtxSvc.registerCtx( 'selectedSymbolsToModifyOrDeleteCtx', selectedSymbolsToModifyOrDelete );
            if ( share === 'public' ||   share === selectedSymbolShare   ) {
                appCtxSvc.registerCtx( 'editCommandVisibleCtx', true );
            } else {
                appCtxSvc.registerCtx( 'editCommandVisibleCtx', false );
            }
        } else {
            appCtxSvc.updateCtx( 'symbolNameToModifyOrDeleteCtx', symbolNameToModifyOrDelete );
            appCtxSvc.updateCtx( 'symbolGroupToModifyOrDeleteCtx', symbolGroupToModifyOrDelete );
            appCtxSvc.updateCtx( 'selectedSymbolsToModifyOrDeleteCtx', selectedSymbolsToModifyOrDelete );
            if ( share === 'public' ||   share === selectedSymbolShare   ) {
                appCtxSvc.updateCtx( 'editCommandVisibleCtx', true );
            } else {
                appCtxSvc.updateCtx( 'editCommandVisibleCtx', false );
            }
        }
    } else {
        appCtxSvc.updateCtx( 'editCommandVisibleCtx', false );
        appCtxSvc.updateCtx( 'createCommandVisibleCtx', true );
    }
    return {
        selectedSymbols: selectedSymbols,
        symbolGroup: selectedSymbols.length > 0 ? selectedSymbols[0].symbolGroup : '',
        symbolName: selectedSymbols.length === 1 ? selectedSymbols[0].symbolName : ''
    };
};
export let getSymbolGroupOrName = function( ctx ) {
    if ( ctx.editCommandVisibleCtx ) {
        appCtxSvc.updateCtx( 'editCommandVisibleCtx', false );
        appCtxSvc.updateCtx( 'createCommandVisibleCtx', true );
    }
    return {
        selectedSymbols: appCtxSvc.getCtx( 'selectedSymbolsToModifyOrDeleteCtx' ),
        symbolGroup: appCtxSvc.getCtx( 'symbolGroupToModifyOrDeleteCtx' ),
        symbolName: appCtxSvc.getCtx( 'symbolNameToModifyOrDeleteCtx' )
    };
};
export let getSymbolName = function( ) {
    //Check for Data in localstorage
    const storedData = localStorage.getItem( 'symbolEditorData' );
    const storedValue = localStorage.getItem( 'svgEditEnabled' );
    var svgeditEnable = JSON.parse( storedValue );

    if ( storedData && storedValue ) {
        const data = JSON.parse( storedData );
        return {
            symbolName:data.symbolTempName,
            isSVGEditEnabled:svgeditEnable
        };
    }

    return {
        symbolName: appCtxSvc.getCtx( 'symbolNameCtx' ),
        isSVGEditEnabled:svgeditEnable
    };
};
export const cleanupPage = ( ctx ) => {
    if ( ctx.selectedSymbolsToModifyOrDeleteCtx ) {
        appCtxSvc.updateCtx( 'symbolNameToModifyOrDeleteCtx', '' );
        appCtxSvc.registerCtx( 'symbolGroupToModifyOrDeleteCtx', '' );
        appCtxSvc.registerCtx( 'selectedSymbolsToModifyOrDeleteCtx', '' );
    }
};
export let symbolGroupOrNameAddedForNewSymbol = function( data ) {
    var symbolTempName;
    var symbolTempGroup;
    symbolTempName = data.symbolName.dbValue;
    symbolTempGroup = data.symbolGroup.dbValue;
    appCtxSvc.registerCtx( 'symbolNameCtx', symbolTempName );
    appCtxSvc.registerCtx( 'symbolGroupCtx', symbolTempGroup );
};

export let launchSVGEditView = function( data, ctx ) {
    var symbolTempName;
    var symbolTempGroup;
    var symbolTempContent;

    //Clear the localStprage when editor is launched
    localStorage.removeItem( 'symbolEditorData' ); // Clear previous data

    //Document Revision UID
    var docRevisionUid = data.ctx.pselected.uid;

    symbolTempName = data.symbolName.dbValue;
    symbolTempGroup = data.symbolGroup.dbValue;
    symbolTempContent = data.selectedSymbols;

    appCtxSvc.registerCtx( 'symbolNameCtx', symbolTempName );
    appCtxSvc.registerCtx( 'symbolGroupCtx', symbolTempGroup );
    appCtxSvc.registerCtx( 'documentRevisionUid', docRevisionUid );
    appCtxSvc.registerCtx( 'symbolContentCtx', symbolTempContent );
    appCtxSvc.registerCtx( 'svgEditEnabledCtx', false );
    appCtxSvc.registerCtx( 'saveSvgButtonState', false );

    if ( ctx.panelContext.destPanelId === 'Awp0EditMarkupSymbol' ) {
        appCtxSvc.updateCtx( 'svgEditEnabledCtx', true );
    }else if ( ctx.panelContext.destPanelId === 'Awp0CreateMarkupSymbol' ) {
        appCtxSvc.updateCtx( 'svgEditEnabledCtx', false );
    }

    // Save data to local storage before unloading the page
    window.addEventListener( 'beforeunload', function() {
        localStorage.setItem( 'ctx', JSON.stringify( ctx ) );
    } );

    //get svgEditEnabledCtx
    const svgEditEnabled = appCtxSvc.getCtx( 'svgEditEnabledCtx' );

    // Save the value to local storage
    localStorage.setItem( 'svgEditEnabled', JSON.stringify( svgEditEnabled ) ); // Convert to string

    // Save data to local storage before unloading the page
    window.addEventListener( 'beforeunload', function() {
        var contextDataToSave = {
            symbolTempName: symbolTempName,
            symbolTempGroup: symbolTempGroup,
            docRevisionUid: docRevisionUid,
            symbolTempContent:symbolTempContent
        };
        localStorage.setItem( 'symbolEditorData', JSON.stringify( contextDataToSave ) );
        var markupctxdata = getMarkupContext();
        localStorage.setItem( 'MarkUpCtx', JSON.stringify( markupctxdata ) );
    } );

    let toParams = {};
    let options = {};
    let transitionTo = 'SvgEdit';
    locationNavigationService.instance.go( transitionTo, toParams, options );
};

export let activateMarkupSymbolPanel = function( viewerCtx ) {
    let markupCtx = exports.getMarkupContext();
    appCtxSvc.registerCtx( 'createCommandVisibleCtx', true );
    appCtxSvc.registerCtx( 'editCommandVisibleCtx', false );
    if( viewerCtx.viewerDialogAction ) {
        markupCtx = exports.setMarkupContext( 'dialogAction', viewerCtx.viewerDialogAction,
            'dialogParent', viewerCtx.viewerDialogParent || ctxDialogParent );
        if( markupCtx.dialogAction ) {
            const options = {
                view: 'Awp0MarkupSymbolOperationsMain',
                parent: markupCtx.dialogParent,
                placement: 'right',
                width: 'STANDARD',
                height: 'FULL',
                isCloseVisible: false,
                push: true,
                subPanelContext: viewerCtx,
                commandid: 'Awp0MarkupShapesAndSymbol',
                commandicon: 'cmdEmptyStar'
            };
            markupCtx.dialogAction.show( options );
        }
    } else {
        commandPanelSvc.activateCommandPanel(
            'Awp0MarkupSymbolOperationsMain', 'aw_toolsAndInfo', viewerCtx, false );
    }
};
export let createSymbolGroup = function( data ) {
    if( data.selectedSymbols ) {
        let selectedSymbols = data.selectedSymbols;
        const defaultGroup = data.groupName.dbValue;
        if( markupModel.getRole() === 'admin' ) {
            selectedSymbols.forEach( ( sym, index ) => {
                sym.symbolGroup = defaultGroup;
                sym.share = 'public';
                sym.userid = data.ctx.user.props.userid.dbValue;
                sym.username = data.ctx.user.props.user_name.dbValue;
                sym.created = sym.created.replace( /\d\d\dZ/, index.toString().padStart( 3, '0' ) + 'Z' );
            } );
        } else {
            selectedSymbols.forEach( ( sym, index ) => {
                sym.symbolGroup = defaultGroup;
                sym.created = sym.created.replace( /\d\d\dZ/, index.toString().padStart( 3, '0' ) + 'Z' );
            } );
        }

        saveSymbols( selectedSymbols, 'add' );
        let destPanelId = 'Awp0MarkupSymbolOperations';
        let context = {
            destPanelId: destPanelId
        };
        eventBus.publish( 'awPanel.navigate', context );
    } else {
        const defaultGroup = data.groupName.dbValue;
        let symbolList = data.fileSymbolList;
        symbolList.forEach( ( sym, index ) => {
            sym.symbolGroup = defaultGroup;
            sym.created = sym.created.replace( /\d\d\dZ/, index.toString().padStart( 3, '0' ) + 'Z' );
        } );

        saveSymbols( symbolList, 'add' );
        let destPanelId = 'Awp0MarkupSymbolOperations';
        let context = {
            destPanelId: destPanelId
        };
        eventBus.publish( 'awPanel.navigate', context );
    }
};

export let showSymbolList = function() {
    const deferred = AwPromiseService.instance.defer();
    const userRole = markupModel.getRole();
    if( userRole === 'admin' ) {
        loadAllSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;

            deferred.resolve(  {
                symbolList: symbolList,
                userRole: userRole
            } );
        } );
    }else{
        loadSymbols( list => {
            list.forEach( sym => { sym.selected = false; } );
            let symbolList = list;
            const share = markupModel.getRole() === 'admin' ? 'public' : 'private';
            symbolList = list.filter( sym => sym.share === share );

            deferred.resolve(  {
                symbolList: symbolList,
                userRole: userRole
            } );
        } );
    }
    return deferred.promise;
};

loadConfiguration();

//======================= app factory and filters =========================

export default exports = {
    i18n,
    setContext,
    getContext,
    getMarkupContext,
    setMarkupContext,
    activateMarkupPanel,
    showPanel,
    hidePanel,
    closePanel,
    showMarkups,
    processMarkups,
    processUsers,
    selectAndScroll,
    markupSelected,
    toggleGroup,
    selectTool,
    replyMarkup,
    onTabSelected,
    resetTabFilter,
    getSortBy,
    filterMarkups,
    filterChanged,
    setLoginUser,
    viewerChanged,
    deleteMarkup,
    editMarkup,
    startEditMain,
    startMarkupEdit,
    saveMarkupEdit,
    showOnPageChanged,
    geomOptionChanged,
    endMarkupEdit,
    shareAsChanged,
    cancelOfficial,
    showStampPanel,
    hideStampPanel,
    filterStamps,
    toggleStampGroup,
    stampSelected,
    deselectAllStamps,
    deleteStamp,
    stampChecked,
    printMarkups,
    initMarkupCell,
    onApplyTextOnPage,
    setOverrideLoad,
    setOverrideSave,
    setOverrideUiOptions,
    showSymbolPanel,
    hideSymbolPanel,
    symbolTabChanged,
    fileChanged,
    uploadSymbols,
    modifySymbols,
    deleteSymbols,
    manageSymbolSelected,
    symbolGroupOrNameChanged,
    getGroupNameList,
    setSymbolSize,
    symbolFilterChanged,
    addNewGroupAction,
    getAddedNewSymbolGrouplist,
    launchSVGEditView,
    activateMarkupSymbolPanel,
    showMarkupSymbolPanel,
    openCreateSymbolPanel,
    openEditSymbolPanel,
    getSelectedSymbolDetails,
    getSymbolGroupOrName,
    getSymbolName,
    saveSymbols,
    resolveSymbolAndGroupList,
    createSymbolGroup,
    showSymbolList,
    openManageSymbolPanel,
    getUserNameList,
    manageSaveSymbols,
    processSymbols
};
