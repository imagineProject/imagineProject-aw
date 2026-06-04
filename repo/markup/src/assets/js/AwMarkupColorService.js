// Copyright (c) 2025 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

import AwIcon from 'viewmodel/AwIconViewModel';

export const awMarkupColorRenderFunction = ( props ) => {
    if( props.prop && props.list && props.action ) {
        const { elementRefList } = props;
        const { data, dispatch } = props.viewModel;
        let prop = { dbValue: props.prop.value };

        props.list.forEach( ( v ) => {
            if( prop.dbValue === v.propInternalValue ) {
                prop.uiValue = v.propDisplayValue;
                v.sel = true;
                v.attn = true;
            } else {
                v.sel = false;
                v.attn = false;
            }
        } );

        if( !prop.uiValue ) {
            prop.uiValue = prop.dbValue;
        }

        let selColorPatch = elementRefList.get( 'markupSelectedColorPatch' );
        if( prop.dbValue && selColorPatch.current ) {
            if( prop.dbValue.startsWith( '#' ) ) {
                selColorPatch.current.style.background = prop.dbValue;
            } else {
                selColorPatch.current.style.visibility = 'hidden';
            }
        }

        const toggle = ( e ) => {
            const choiceRect = e.currentTarget.getBoundingClientRect();
            const top = choiceRect.bottom + 250 <= window.innerHeight ? choiceRect.bottom : choiceRect.top - 250;
            const lovStyle = data.lovStyle ? undefined : {
                position: 'fixed',
                top: top + 'px',
                left: choiceRect.left + 'px',
                width: choiceRect.width + 'px',
                border: '1px solid'
            };

            dispatch( { path: 'data.lovStyle', value: lovStyle } );
        };

        const selected = ( v ) => {
            if( v.propInternalValue !== 'picker' ) {
                props.prop.update( v.propInternalValue, {}, { markModified : true } );
                dispatch( { path: 'data.lovStyle', value: undefined } );
                props.action();
            }
        };

        const changed = ( e ) => {
            if( e.currentTarget ) {
                props.prop.update( e.currentTarget.value, {}, { markModified : true } );
            }
        };

        const blurred = () => {
            dispatch( { path: 'data.lovStyle', value: undefined } );
            props.action();
        };

        const renderLov = () => {
            if( data.lovStyle ) {
                return (
                    <div className='aw-jswidgets-drop aw-layout-popup aw-base-scrollPanel' style={data.lovStyle}>
                        <div className='aw-widgets-cellListWidget'>
                            { props.list.map( renderLovItem ) }
                        </div>
                    </div>
                );
            }
            return <></>;
        };

        const renderLovItem = ( v ) => {
            const classes = 'aw-widgets-cellListItem' +
                ( v.sel ? ' aw-state-selected' : '' ) +
                ( v.attn ? ' aw-state-attention' : '' );

            return (
                // FIXME for {classes} visible non interactive elements with click handler
                // must have at least one keyboard listener, Static HTML elements with event handlers require a role
                <div className={classes} key={v.propInternalValue} onClick={() => selected( v )}>
                    <div className='aw-jswidgets-lovValuesContainer'>
                        <div className='aw-widgets-cellListCellText aw-base-small'>
                            <div className='aw-markup-colorPatch' style={colorStyle( v.propInternalValue )}>&emsp;</div>
                            {renderPickerLovItem( v )}
                            <span>{v.propDisplayValue}</span>
                        </div>
                        <div className='aw-widgets-cellListCellItemType aw-base-small'>{v.propDisplayDescription}</div>
                    </div>
                </div>
            );
        };

        const renderPickerLovItem = ( v ) => {
            let className = 'aw-markup-colorPick';
            if( v.propInternalValue === 'picker' ) {
                className = 'aw-markup-colorPicker';
            }
            return (
                <input className={className} type='color' value={prop.dbValue} onChange={changed} onBlur={blurred}></input>
            );
        };

        const colorStyle = ( v ) => {
            return v.startsWith( '#' ) ? { background: v } : { visibility: 'hidden' };
        };

        return (
            // FIXME for 'aw-layout-flexRowContainer aw-markup-geomVal'} visible non interactive elements with click handler
            // must have at least one keyboard listener, Static HTML elements with event handlers require a role
            <div className='aw-widgets-propertyContainer'>
                <div className='sw-property-name'>{props.prop.label}</div>
                <div className='aw-jswidgets-lovParent'>
                    <div className='aw-layout-flexRowContainer aw-markup-geomVal' onClick={toggle}>
                        <div className='aw-jswidgets-choice' >
                            <div className='aw-markup-colorPatch' ref={selColorPatch}>&emsp;</div>
                            <span>{prop.uiValue}</span>
                        </div>
                        <div className='sw-widget-iconContainer'>
                            <AwIcon iconId='miscDownArrow_uxRefresh' className='aw-widget-icon'></AwIcon>
                        </div>
                    </div>
                    {renderLov()}
                </div>
            </div>
        );
    }
    return <></>;
};

export const awMarkupColorUpdateFunction = ( elementRefList, props ) => {
    let prop = { dbValue: props.prop.value };
    let elementRef = elementRefList.get( 'markupColorPatch' ).current;
    if( prop.dbValue.startsWith( '#' ) ) {
        elementRef.style.background = prop.dbValue;
    } else {
        elementRef.style.visibility = 'hidden';
    }
    elementRef = elementRefList.get( 'markupColorContainer' ).current;
    // children?
};
