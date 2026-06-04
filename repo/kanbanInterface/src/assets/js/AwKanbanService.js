// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import * as webix from '@swf/webix';
import '@swf/webix/webix/webix.css';
import '@swf/webix/skins/mini.css';
import awIconSvc from 'js/awIconService';
import iconService from 'js/iconService';
import cdm from 'soa/kernel/clientDataModel';
import localeSvc from 'js/localeService';

let webixInstance;

export const renderKanban = ( props ) => {
    if( !props.kanbanState.kanbanColumnObject ) {
        return '';
    }
    const element = props.elementRefList.get( 'kanbanElement' );
    return <div className='aw-kanbanInterface-kanban kanban_full_width'><div ref={element} id='kanbanView' className='webix-kaban-wrapper aw-layout-flexRowContainer'></div></div>;
};

export let initializeKanbanView = function( kanbanId, kanbanState, elementRefList ) {
    window.webix = webix;

    import( '@swf/webix/kanban' )
        .then( () => {
            const element = elementRefList.get( 'kanbanElement' ).current;
            const height = element.parentElement.clientHeight;
            const width = element.parentElement.clientWidth;
            webix.type( webix.ui.kanbanlist, {
                name: 'cards',
                icons: [],
                // avatar template
                templateAvatarLeft: function( obj ) {
                    let taskIcon = obj.iconURL;
                    let iconTooltip = obj.iconTooltip;
                    if( !taskIcon ) {
                        let objType = 'WorkspaceObject';
                        let id = obj.id;
                        let iconUid = obj.leftIconUID;
                        if( iconUid ) {
                            let iconObject = cdm.getObject( iconUid );
                            if( iconObject ) {
                                objType = iconObject.type;
                                iconTooltip = iconObject.props.object_name.uiValues[ 0 ];
                            }
                        } else {
                            let iconObject = cdm.getObject( id );
                            objType = iconObject.type;
                            iconTooltip = iconObject.props.object_name.uiValues[ 0 ];
                        }
                        taskIcon = awIconSvc.getTypeIconURL( objType );
                    }

                    return '<img class=\'avatar\' src=' + taskIcon + ' title=\'' + iconTooltip + '\' alt=\'' + iconTooltip + '\'></img>';
                },

                // right avatar template
                templateAvatarRight: function( obj ) {
                    let rightIcon = obj.iconRightURL;
                    let iconTooltip = obj.iconRightTooltip;
                    if( rightIcon ) {
                        return '<img class=\'avatar\' src=' + rightIcon + ' title=\'' + iconTooltip + '\' alt=\'' + iconTooltip + '\'></img>';
                    }
                    return '';
                },

                templateTags: function( obj, common, kanban ) {
                    let html = '';
                    if( obj.tags ) {
                        if( obj.showRightIcon ) {
                            let avatarRight = '<div class=\'webix_kanban_user_avatarRight\' webix_icon_id=\'$avatar\'>' + common.templateAvatarRight( obj, common, kanban ) + '</div>';
                            html += avatarRight;
                        }
                        for( let i = 0; i < obj.tags.length; i++ ) {
                            html += '<span class="webix_kanban_tag" title="' + obj.tagValues[ i ] + '">' + obj.tags[ i ] + '</span>';
                        }
                    }
                    return '<div class="webix_kanban_tags">' + ( html || '&nbsp;' ) + '</div>';
                },

                template: function( obj, common ) {
                    let kanban = webix.$$( common.master );
                    let avatarLeft = '<div class=\'webix_kanban_user_avatarLeft\' webix_icon_id=\'$avatar\'>' + common.templateAvatarLeft( obj, common, kanban ) + '</div>';
                    let body = '<div class=\'webix_kanban_body\'>' + avatarLeft + common.templateBody( obj, common, kanban ) + '</div>';
                    let attachments = kanban.config.attachments ? common.templateAttachments( obj, common, kanban ) : '';
                    let footer = '<div class=\'webix_kanban_footer sw-column\'>' + common.templateFooter( obj, common, kanban ) + '</div>';
                    return '<div class=\'webix_kanban_list_content\'>' + attachments + body + footer + '</div>';
                }
            } );
            webix.ready( function() {
                webixInstance = webix.ui( {
                    container: 'kanbanView',
                    view: 'kanban',
                    borderless: false,
                    type: '',
                    css: 'mini2',
                    id: kanbanId,
                    cardActions: false,
                    on: {
                        onListItemClick: kanbanState.callbacks.onListItemClick,
                        onListAfterDrop: kanbanState.callbacks.onListAfterDrop,
                        onListAfterSelect: kanbanState.callbacks.onListAfterSelect,
                        onListBeforeDrop: kanbanState.callbacks.onListBeforeDrop
                    },
                    cols: kanbanState.kanbanColumnObject.kanbanLanes,
                    flex: true,
                    editor: false,
                    width: width,
                    height: height
                } );
            } );

            function getLocalizedText( key, resource ) {
                let localeTextBundle = localeSvc.getLoadedText( resource );
                return localeTextBundle[ key ];
            }

            // Notify about kanban initialization, so that parent components
            // can perform any processing, post initialization.
            if( kanbanState ) {
                kanbanState.update( { ...kanbanState.value, kanbanInitialized: true } );
            }
        } );
    registerResizeListener( elementRefList );
};

let registerResizeListener = ( elementRefList ) => {
    webix.event( window, 'resize', function() {
        webixInstance.adjust();
        const element = elementRefList.get( 'kanbanElement' ).current;
        const height = element.parentElement.clientHeight;
        const width = element.parentElement.clientWidth;
        resizeKanbanBoard( height, width );
    } );
};

let resizeKanbanBoard = ( height, width ) => {
    webixInstance.config.height = height;
    webixInstance.config.width = width;
    webixInstance.resize();
    webixInstance.resizeChildren();
};

export let revertCardDragDrop = ( kanbanState ) => {
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCardFailure' ) {
        let dragContext = kanbanState.operation.value.dragContext;
        let sourceStatus = dragContext.from._settings.status;
        let droppedObjects = dragContext.source;
        droppedObjects.forEach( function( object ) {
            let kanbanItem = webixInstance.getItem( object );
            if( kanbanItem ) {
                kanbanItem.status = sourceStatus;
                webixInstance.updateItem( kanbanItem.id );
                let list = webixInstance.getOwnerList( kanbanItem.id );
                let index = kanbanState.operation.value.draggedObjectPrevIndexMap[ kanbanItem.id ];
                if( index >= 0 ) {
                    list.move( kanbanItem.id, index, list );
                }
            }
        } );
    }
};

export let pushDataToKanban = ( kanbanId, initialLoadedObjs ) => {
    webix.$$( kanbanId ).clearAll();
    webix.$$( kanbanId ).parse( initialLoadedObjs );
};

export let updateKanbanCards = ( updatedCards ) => {
    if( updatedCards ) {
        updatedCards.forEach( function( card ) {
            let id = card.id;
            let kanbanItem = webixInstance.getItem( id );
            if( kanbanItem ) {
                for( let key in card ) {
                    kanbanItem[ key ] = card[ key ];
                }
                webixInstance.updateItem( id );
            }
        } );
    }
};

export let handleAWStateChangesForKanban = ( kanbanState ) => {
    if( kanbanState.operation && kanbanState.operation.action === 'dragDropCardFailure' ) {
        revertCardDragDrop( kanbanState );
    } else if( kanbanState.operation && kanbanState.operation.action === 'updateCardProps' ) {
        updateKanbanCards( kanbanState.operation.value );
    } else if( kanbanState.operation && kanbanState.operation.action === 'resizeKanban' ) {
        resizeKanbanBoard( kanbanState.operation.value.height, kanbanState.operation.value.width );
    }
};

export let destructKanbanView = function() {
    if( webixInstance ) {
        webixInstance.destructor();
    }
};
