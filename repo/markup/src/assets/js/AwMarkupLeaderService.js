// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/no-autofocus*/

export const awMarkupLeaderRenderFunction = ( props ) => {
    if( props.prop && props.list ) {
        const { data, dispatch } = props.viewModel;

        let text = props.prop.value.replace( /^<div>/, '' ).replace( /<\/div>$/, '' ).replace( /<\/div><div>/g, '\n' );

        const update = ( input ) => {
            const html = '<div>' + input.value.replace( /\n/g, '</div><div>' ) + '</div>';
            props.prop.update( html, {}, { markModified : true } );
        };

        const changed = ( e ) => {
            if( e.currentTarget ) {
                update( e.currentTarget );
                focused( e );
            }
        };

        const selected = ( e ) => {
            if( e.currentTarget ) {
                const sym = e.currentTarget.innerHTML;
                const el = data.focus;
                if( el ) {
                    var start = el.selectionStart;
                    var end = el.selectionEnd;
                    var text = el.value;
                    el.value = text.substring( 0, start ) + sym + text.substring( end, text.length );
                    el.selectionStart = start + sym.length;
                    el.selectionEnd = start + sym.length;
                    el.focus();
                    update( el );
                }
            }
        };

        const focused = ( e ) => {
            if( e.currentTarget !== data.focus ) {
                dispatch( { path: 'data.focus', value: e.currentTarget } );
            }
        };

        const renderSymbols = () => {
            return (
                <div className='aw-markup-leaderSymbols'>
                    <div className='aw-widgets-cellListWidget'>
                        { props.list.map( renderSymbol ) }
                    </div>
                </div>
            );
        };

        const renderSymbol = ( v ) => {
            return (
                <span title={v.propDisplayValue} key={v.propInternalValue} onClick={selected}>
                    {v.propInternalValue}
                </span>
            );
        };

        return (
            <div className='aw-widgets-propertyContainer'>
                <div className='sw-property-name'>{props.prop.label}</div>
                {renderSymbols()}
                <textarea rows='4' cols='50' onChange={changed} onFocus={focused} autoFocus>{text}</textarea>
            </div>
        );
    }
};
