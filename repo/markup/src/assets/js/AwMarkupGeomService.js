// Copyright (c) 2025 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

import { convertToHtml } from 'js/reactHelper';
import AwIcon from 'viewmodel/AwIconViewModel';

export const awMarkupGeomRenderFunction = ( props ) => {
    if( props.prop && props.list && props.action ) {
        const { data, dispatch } = props.viewModel;
        let prop = { dbValue: props.prop.value };

        let { elementRefList } = props;
        let elementRef = elementRefList.get( 'markupGeomContainer' );

        props.list.forEach( ( v ) => {
            if( prop.dbValue === v.propInternalValue ) {
                prop.uiId = v.propDisplayId;
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
            dispatch( { path: 'data.lovStyle', value: undefined } );
            props.prop.update( v.propInternalValue, {}, { markModified : true } );
            props.action();
        };

        const renderLov = () => {
            if( data.lovStyle ) {
                return (
                    <div className='aw-jswidgets-drop aw-layout-popup aw-base-scrollPanel' style={data.lovStyle} ref={elementRef}>
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
                <div className={classes} key={v.propDisplayId} onClick={() => selected( v )}>
                    <div className='aw-jswidgets-lovValuesContainer'>
                        <div className='aw-widgets-cellListCellText aw-base-small'>
                            <svg className='aw-markup-geomSvg' width='48' height='18'>
                                <use xlinkHref={convertToHtml( '#' + v.propDisplayId )}></use>
                            </svg>
                            <span>{v.propDisplayValue}</span>
                        </div>
                        <div className='aw-widgets-cellListCellItemType aw-base-small'>{v.propDisplayDescription}</div>
                    </div>
                </div>
            );
        };

        return (
            <div className='aw-widgets-propertyContainer'>
                <div className='sw-property-name'>{props.prop.label}</div>
                <div className='aw-markup-geomDef'>{props.children}</div>
                <div className='aw-jswidgets-lovParent' >
                    <div className='aw-layout-flexRowContainer aw-markup-geomVal' onClick={toggle}>
                        <div className='aw-jswidgets-choice' >
                            <svg className='aw-markup-geomSvg' width='48' height='18'>
                                <use xlinkHref={convertToHtml( '#' + prop.uiId )}></use>
                            </svg>
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
