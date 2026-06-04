// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
/*eslint-disable jsx-a11y/no-autofocus*/
import AwCommandBar from 'viewmodel/AwCommandBarViewModel';

export const awMarkupGdntRenderFunction = ( props ) => {
    if( props.prop && props.list ) {
        const { data, dispatch } = props.viewModel;

        let array = valueToArray( props.prop.value );
        props.prop.rowCount = array.length;

        const update = ( input ) => {
            const td = input.parentElement;
            const tr = td.parentElement;
            const table = tr.parentElement;
            const row = Array.from( table.children ).indexOf( tr );
            const col = Array.from( tr.children ).indexOf( td );

            if( 0 <= row && row < array.length && 0 <= col && col < array[row].length - 1 ) {
                array[row][col + 1] = td.firstChild.value;
            }

            props.prop.update( arrayToValue( array ), {}, { markModified : true } );
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
                <div className='aw-markup-gdntSymbols'>
                    <div className='aw-widgets-cellListWidget'>
                        { props.list.map( renderSymbol ) }
                    </div>
                </div>
            );
        };

        const renderSymbol = ( v ) => {
            return (
                // FIXME for {v.propDisplayValue} visible non interactive elements with click handler
                // must have at least one keyboard listener, Static HTML elements with event handlers require a role
                <span title={v.propDisplayValue} key={v.propInternalValue} onClick={selected}>
                    {v.propInternalValue}
                </span>
            );
        };

        const renderInputs = ( row, i ) => {
            return (
                <tr key={i}>
                    { row.slice( 1 ).map( ( col, j ) => {
                        const rowAttr = j === 0 && row[0] > 1 ? { rowSpan: row[0] } : {};
                        const size = j === ( row[0] ? 1 : 0 ) ? 50 : 2;
                        return (
                            <td {...rowAttr} key={j}>
                                <input type='text' size={size} value={col} onChange={changed} onFocus={focused} autoFocus={ j === 0 } />
                            </td>
                        );
                    } ) }
                </tr>
            );
        };

        return (
            <div className='aw-widgets-propertyContainer'>
                <div className='sw-property-name'>{props.prop.label}</div>
                {renderSymbols()}
                <table cellPadding='2' className='aw-markup-gdntFrame'><tbody>
                    { array.map( renderInputs ) }
                </tbody></table>
                <AwCommandBar anchor='aw_markupGdntCommands' alignment='HORIZONTAL' context={props.prop}></AwCommandBar>
            </div>
        );
    }
};

// change array by addRow, addGroupedRow, or removeRow
export const changeRow = ( ctx, op ) => {
    if( ctx && op ) {
        let array = valueToArray( ctx.value );
        if( op === 'addRow' ) {
            array.push( [ 1, '', '', '', '', '' ] );
        } else if( op === 'addGroupedRow' ) {
            adjustRowSpan( array, 1 );
            array.push( [ 0, '', '', '', '' ] );
        } else if( op === 'removeRow' && array.length > 1 ) {
            if( array[ array.length - 1 ][0] === 0 ) {
                adjustRowSpan( array, -1 );
            }
            array.pop();
        }

        ctx.update( arrayToValue( array ) );
    }
};

// convert string value to array of rows
// where each row is [rowspan, symbol, tolerance, refA, refB, refC]
// when rowspan > 1, the following covered rows are [0, tolerance, refA, refB, refC]
const valueToArray = ( value ) => {
    if( value === '' ) {
        return [ [ 1, '', '', '', '', '' ] ];
    }

    const trs = value.split( '</tr><tr>' );
    let array = trs.map( ( tr ) => {
        const tds = tr.match( />[^<]*<\/td>/gu );
        const vals = tds.map( ( v ) => v.substring( 1, v.length - 5 ) );
        const attrs = tr.match( /rowspan="\d+"/ );
        const rowspan = attrs && attrs.length > 0 ? Number( attrs[0].match( /\d+/ )[0] ) : 1;

        return [ rowspan, ...vals ];
    } );

    for( let i = 0; i < array.length; i++ ) {
        const rowspan = array[i][0];
        for( let j = 1; j < rowspan; j++ ) {
            array[i + j][0] = 0;
        }

        const len = rowspan > 0 ? 6 : 5;
        for( let l = array[i].length; l < len; l++ ) {
            array[i].push( '' );
        }
    }
    return array;
};

// convert array to string value
const arrayToValue = ( array ) => {
    let toTrim = 4;
    for( var i = 0; i < array.length; i++ ) {
        var last = array[i].length - 1;
        for( var j = 0; j <= last; j++ ) {
            if( array[i][ last - j ] ) {
                toTrim = Math.min( toTrim, j );
                break;
            }
        }
    }

    let value = '';
    for( i = 0; i < array.length; i++ ) {
        value += '<tr>';
        last = array[i].length - 1 - toTrim;
        for( j = 1; j <= last; j++ ) {
            let rowspan = array[i][0];
            let attr = j === 1 && rowspan > 1 ? ' rowspan="' + rowspan + '"' : '';
            attr += ' className="aw-markup-gdntTableCell"';
            value += '<td' + attr + '>' + array[i][j] + '</td>';
        }
        value += '</tr>';
    }

    return '<table class="aw-markup-gdntTable">' + value + '</table>';
};

// adjust the rowspan of the last element in array that has rowspan >= 1
const adjustRowSpan = ( array, number ) => {
    for( let i = array.length - 1; i >= 0; i-- ) {
        if( array[i][0] >= 1 ) {
            array[i][0] += number;
            break;
        }
    }
};
