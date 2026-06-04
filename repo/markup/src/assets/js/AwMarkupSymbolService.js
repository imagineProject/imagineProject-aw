/* eslint-disable sonarjs/cognitive-complexity */
/* eslint-disable no-nested-ternary */
/* eslint-disable jsx-a11y/click-events-have-key-events*/
/* eslint-disable jsx-a11y/no-static-element-interactions*/
// Copyright (c) 2024 Siemens

import { convertToHtml } from 'js/reactHelper';
import markupModel from 'js/MarkupModel';
import markupOperation from 'js/MarkupOperation';
import i18n from 'i18n/InboxMessages';
import eventBus from 'js/eventBus';

export const awMarkupSymbolRenderFunction = ( props ) => {
    const { data, dispatch } = props.viewModel;
    let groups = [];
    let size = 32;
    let symbolSvg = '';
    let symbolTexts = [];
    let groupHidden = props.grouphidden;
    let allowPromote = props.promotable ? props.promotable === 'true' : true;

    const initGroups = ( symbolList ) => {
        groups = [];
        if( symbolList ) {
            symbolList.forEach( sym => {
                if( !sym.share ||  sym.share !== 'private' && sym.share !== 'public'  ) {
                    sym.share = 'private'; // patch in case of bad share value
                }
                if( sym.symbolGroup && sym.userid ) {
                    let pairExists = false;
                    for( let i = 0; i < groups.length; ++i ) {
                        if( groups[i].groupName === sym.symbolGroup && groups[i].userId === sym.userid && groups[i].share === sym.share ) {
                            pairExists = true;
                            break;
                        }
                    }

                    if( !pairExists ) {
                        groups.push( {
                            groupName: sym.symbolGroup,
                            userId: sym.userid,
                            share :sym.share
                        } );
                    }
                }
            } );
            size = props.prop && props.prop.dbValue || props.size || 32;
        }
    };

    if( props.list ) {
        initGroups( props.list );
    } else if( props.prop && props.prop.value ) {
        symbolSvg = props.prop.value;
        let text = symbolSvg.match( /<text[^>]*>([^{}<]*)<\/text>/ );
        while( text ) {
            const newText = text[0].replace( '>' + text[1] + '<', '>{' + symbolTexts.length + '}<' );
            symbolSvg = symbolSvg.replace( text[0], newText );
            symbolTexts.push( text[1] );
            text = symbolSvg.match( /<text[^>]*>([^{}<]*)<\/text>/ );
        }
    }

    const selected = ( ev, symbol ) => {
        if( props.selectable === 'single' || props.selectable === 'click' ) {
            let selection = [];
            if( symbol.selected ) {
                symbol.selected = false; // toggle selection
            } else {
                props.list.forEach( sym => sym.selected = false ); // unselect other symbols
                symbol.selected = props.selectable === 'single';
                selection.push( symbol );
            }
            if( props.action ) {
                markupModel.setCurrentSymbols( selection );
                props.action();
            }
        } else if( props.selectable === 'multiple' ) {
            if( ev.ctrlKey ) {
                symbol.selected = !symbol.selected;
            } else if( ev.shiftKey && props.list.find( sym =>
                sym.selected && sym.symbolGroup === symbol.symbolGroup
            ) ) {
                let hitSelected = false;
                let hitShifted = false;
                props.list.forEach( sym => {
                    if( sym.selected && sym.symbolGroup === symbol.symbolGroup ) {
                        hitSelected = true;
                    } else if( sym === symbol ) {
                        hitShifted = true;
                        symbol.selected = true;
                    } else if( hitSelected && !hitShifted || !hitSelected && hitShifted ) {
                        sym.selected = true;
                    }
                } );
            } else {
                props.list.forEach( sym => sym.selected = false );
                symbol.selected = true;
            }

            if( props.action ) {
                markupModel.setCurrentSymbols( props.list.filter( sym => sym.selected ) );
                props.action();
            }
        }
    };

    const renderOneSymbol = sym => {
        const className = 'aw-markup-symbolDisplay' + ( sym.selected ? ' aw-state-selected' : '' );
        return (
            <button title={sym.symbolName } className={className}
                draggable={props.draggable} onDragStart={handleDrag} onClick={ ( ev ) => selected( ev, sym )}>
                { convertToHtml( markupModel.setSvgSize( sym.comment, size ) ) }
            </button>
        );
    };

    const renderSymbolsInOneGroup = nameIdPair => {
        if( !data.collapsed[ nameIdPair.groupName + nameIdPair.userId ] ) {
            return (
                <div>
                    { props.list.map( sym => {
                        return sym.symbolGroup === nameIdPair.groupName && sym.userid === nameIdPair.userId ? renderOneSymbol( sym ) : '';
                    } ) }
                </div>
            );
        }

        return '';
    };

    const renderOneGroup = nameIdPair => {
        const groupName = nameIdPair.groupName;
        let userId = '';
        if( nameIdPair.share === 'private' ) {
            userId = nameIdPair.userId;
        }else{
            userId = 'public';
        }

        const collapsed = data.collapsed[ nameIdPair.groupName + nameIdPair.userId ];
        const rotate = collapsed ? 'rotate(-90, 6, 6)' : '';
        const toggleGroup = () => {
            dispatch( { path: 'data.collapsed[' + nameIdPair.groupName + nameIdPair.userId + ']', value: !collapsed } );
        };
        const sectionClassName = 'aw-markup-symbolSection';

        if( groupHidden ) {
            return (
                <section>
                    { renderSymbolsInOneGroup( nameIdPair ) }
                </section>
            );
        } else if( allowPromote && markupModel.getRole() === 'admin' && nameIdPair.share === 'private' ) {
            return (
                <section className={sectionClassName}>
                    <button className='sw-row sw-sectionTitle aw-markup-symbolGroupTitle aw-layout-collapsiblePanelSectionTitle collapsible'>
                        <svg width='16' height='12' onClick={toggleGroup}>
                            <polygon className='aw-theme-iconOutline' fill='#464646' points='2,4 6,10 10,4' transform={rotate}>
                            </polygon>
                        </svg>
                        <span className='aw-ui-filterCategoryLabel aw-ui-filterCategoryLabelEnabled' onClick={toggleGroup}>{groupName} ({userId})</span>
                        <button type='button' className='sw-button' onClick={() => handlePromoteClick( groupName, userId )}>{i18n.promote}</button>
                    </button>
                    { renderSymbolsInOneGroup( nameIdPair ) }
                </section>
            );
        }

        return (
            <section className={sectionClassName}>
                <button className='sw-row sw-sectionTitle aw-markup-symbolGroupTitle aw-layout-collapsiblePanelSectionTitle collapsible'
                    onClick={toggleGroup}>
                    <svg width='16' height='12'>
                        <polygon className='aw-theme-iconOutline' fill='#464646' points='2,4 6,10 10,4' transform={rotate}>
                        </polygon>
                    </svg>
                    <span className='aw-ui-filterCategoryLabel aw-ui-filterCategoryLabelEnabled'>{groupName} ({userId})</span>
                </button>
                { renderSymbolsInOneGroup( nameIdPair ) }
            </section>
        );
    };

    const handleDrag = ( ev ) => {
        const svg = ev.target.getElementsByTagName( 'svg' )[0];
        ev.dataTransfer.setDragImage( svg, svg.clientWidth / 2, svg.clientHeight / 2 );
        ev.dataTransfer.effectAllowed = 'move';

        const symbols = props.list.filter( sym => {
            return sym.selected || sym.symbolName === ev.target.title;
        } );
        markupModel.setCurrentSymbols( symbols );
        markupOperation.setTool( 'shape', 'symbol' );
        markupOperation.setPositionMarkup( symbols[0] );
    };

    const handlePromoteClick = ( group, userId ) => {
        const markupCtx = props.viewModel.ctx.markup;

        var inputData = {
            baseObject: markupCtx.baseObject,
            action: 'publishSymbols',
            version: markupCtx.symbolVersion,
            message: userId,
            markups: group
        };
        eventBus.publish( 'awMarkupSymbolService.publishSymbols', inputData );
    };

    const renderList = () => {
        return groups.length > 0 ? groups.map( g => renderOneGroup( g ) ) :
            props.list ? props.list.map( sym => renderOneSymbol( sym ) ) : '';
    };

    const replaceText = () => {
        let newSvg = symbolSvg;
        symbolTexts.forEach( ( t, i ) => {
            newSvg = newSvg.replace( '{' + i + '}', t );
        } );

        return newSvg;
    };

    const changed = ( e ) => {
        if( e.currentTarget ) {
            const parent = e.currentTarget.parentElement;
            const index = Array.from( parent.children ).indexOf( e.currentTarget );
            symbolTexts[ index ] = e.currentTarget.value;

            props.prop.update( replaceText() );
        }
    };

    const renderEdit = () => {
        if( symbolSvg.length > 0 ) {
            return (
                <div className='aw-widgets-propertyContainer'>
                    <div className='sw-property-name'>{props.prop.label}</div>
                    <div className='sw-row'>
                        <div className='aw-markup-symbol'>
                            { convertToHtml( replaceText() ) }
                        </div>
                        <div className='aw-markup-symbol'>
                            {
                                symbolTexts.map( t => {
                                    return (
                                        <input type='text' size='6' value={t} onChange={changed}/>
                                    );
                                } )
                            }
                        </div>
                    </div>
                </div>
            );
        }

        return '';
    };

    return (
        <div>
            { renderList() }
            { renderEdit() }
        </div>
    );
};
