// Copyright (c) 2022 Siemens
/* eslint-disable jsx-a11y/click-events-have-key-events*/
/* eslint-disable jsx-a11y/no-static-element-interactions*/
/* eslint-disable sonarjs/cognitive-complexity */

export const awMarkupWeldRenderFunction = ( props ) => {
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

            if( 0 <= row && row < array.length && 0 <= col && col < array[row].length ) {
                array[row][col] = td.firstChild.value;
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
                if( el && sym.length === 1 ) {
                    var start = el.selectionStart;
                    var end = el.selectionEnd;
                    var text = el.value;
                    el.value = text.substring( 0, start ) + sym + text.substring( end, text.length );
                    el.selectionStart = start + sym.length;
                    el.selectionEnd = start + sym.length;
                    el.focus();
                    update( el );
                } else {
                    const id = sym.match( /id="\w+"/ );
                    if( id && id.length > 0 ) {
                        changeSymbol( id[0].substring( 4, id[0].length - 1 ) );
                        props.prop.update( arrayToValue( array ), {}, { markModified : true } );
                    }
                }
            }
        };

        const isEndSymbol = sym => {
            return sym === 'around' || sym === 'field' || sym === 'tail';
        };

        const changeSymbol = sym => {
            let syms = array[1][0].split( /\s+/ );
            const index = syms.indexOf( sym );
            if( index >= 0 ) {
                syms.splice( index, 1 );
            } else if( isEndSymbol( sym ) ) {
                syms.push( sym );
            } else if( sym.startsWith( '__' ) ) {
                syms = syms.filter( isEndSymbol );
                syms.push( sym );
            } else if( sym.startsWith( '_' ) ) {
                syms = syms.filter( s => isEndSymbol( s ) || !s.startsWith( '_' ) );
                syms.push( sym );
            } else {
                syms = syms.filter( s => isEndSymbol( s ) || s.startsWith( '_' ) && !s.startsWith( '__' ) );
                syms.push( sym );
            }

            array[1][0] = syms.join( ' ' );
        };

        const focused = ( e ) => {
            if( e.currentTarget !== data.focus ) {
                dispatch( { path: 'data.focus', value: e.currentTarget } );
            }
        };

        const renderSymbols = () => {
            return (
                <div className='aw-markup-weldSymbols'>
                    <div className='aw-widgets-cellListWidget'>
                        { props.list.map( renderSymbol ) }
                    </div>
                </div>
            );
        };

        const renderSymbol = ( v ) => {
            const sym = v.propInternalValue;
            if( sym.length === 1 ) {
                return (
                    <span title={v.propDisplayValue} key={sym} onClick={selected}>
                        {v.propInternalValue}
                    </span>
                );
            }

            const x1 = sym === 'around' || sym === 'field' ? 0 : -16;
            const x2 = sym === 'tail' ? 0 : 16;
            const fill = sym === 'field' || sym === '_meltthru' ? 'black' : 'none';
            return (
                <span title={v.propDisplayValue} key={sym} onClick={selected}>
                    <svg width='32' height='32'>
                        <g transform='translate(16,16)' stroke='black' strokeWidth='1'>
                            <line x1={x1} y1='0' x2={x2} y2='0'/>
                            <path id={sym} d={pathd[sym]} fill={fill}/>
                        </g>
                    </svg>
                </span>
            );
        };

        const renderSvg = ( value ) => {
            const syms = value.split( ' ' );
            return (
                <svg width='192' height='32'>
                    <g transform='translate(96,16)' stroke='black' strokeWidth='1'>
                        <line x1='-80' y1='0' x2='80' y2='0'/>
                        { syms ? syms.map( renderSvgOne ) : '' }
                    </g>
                </svg>
            );
        };

        const renderSvgOne = ( sym ) => {
            let trans = 'translate(0,0)';
            if( sym === '' ) {
                return;
            } else if( sym === 'around' || sym === 'field' ) {
                trans = 'translate(-80,0)';
            } else if( sym === 'tail' ) {
                trans = 'translate(80,0)';
            }

            const fill = sym === 'field' || sym === '_meltthru' ? 'black' : 'none';
            return (
                <path transform={trans} d={pathd[sym]} fill={fill}/>
            );
        };

        const renderInputs = ( row, i ) => {
            if( i === 1 ) {
                return (
                    <tr key='1'>
                        <td key='0' colSpan='3'>{renderSvg( array[1][0] )}</td>
                        <td key='1'><input type='text' size='6' value={array[1][1]} onChange={changed} onFocus={focused} /></td>
                    </tr>
                );
            }
            return (
                <tr key={i}>
                    { row.map( ( col, j ) => {
                        if( j === 3 ) {
                            return <td></td>;
                        }

                        return (
                            <td key={j}>
                                <input type='text' size='6' value={col} onChange={changed} onFocus={focused} />
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
                <table cellPadding='2' className='aw-markup-weldFrame'>
                    { array.map( renderInputs ) }
                </table>
            </div>
        );
    }
};

// convert string value to array of 3 rows, each has 4 or 2 columns
//
const valueToArray = ( value ) => {
    if( value === '' ) {
        return [ [ '', '', '', '' ], [ '', '' ], [ '', '', '', '' ] ];
    }

    const trs = value.split( '</tr><tr>' );
    return trs.map( ( tr ) => {
        const tds = tr.split( '</td><td>' );
        return tds.map( ( td ) => {
            const iSvg = td.indexOf( '<svg' );
            const iTd = td.indexOf( '<td>' );
            const iTdEnd = td.indexOf( '</td>' );
            return iSvg >= 0 ? svgToSymbols( td ) : iTd >= 0 ? td.substring( iTd + 4 ) :
                iTdEnd >= 0 ? td.substring( 0, iTdEnd ) : td;
        } );
    } );
};

// convert array to string value as HTML table
const arrayToValue = ( array ) => {
    let empty = true;
    for( let i = 0; i < array.length && empty; i++ ) {
        for( let j = 0; j < array[i].length && empty; j++ ) {
            if( array[i][j] ) {
                empty = false;
            }
        }
    }

    if( empty ) {
        return '';
    }

    let value = '';
    for( let i = 0; i < array.length; i++ ) {
        value += '<tr>';
        for( let j = 0; j < array[i].length; j++ ) {
            const attr = i === 1 && j === 0 ? ' colspan="3"' : '';
            const v = attr ? symbolsToSvg( array[i][j], 160 ) : array[i][j];
            value += '<td' + attr + '>' + v + '</td>';
        }
        value += '</tr>';
    }

    const classNameEven = 'aw-markup-weldColumnEven';
    const classNameOdd = 'aw-markup-weldColumnOdd';
    let colgroup = '<colgroup>';
    for( let i = 0; i < 4; i++ ) {
        colgroup += '<col class="' + ( i % 2 ? classNameOdd : classNameEven ) + '">';
    }
    colgroup += '</colgroup>';

    return '<table>' + colgroup + value + '</table>';
};

// convert symbols to SVG string
const symbolsToSvg = ( symbols, width ) => {
    const w = width || 192;
    const x = w / 2 - 16;
    const syms = symbols.split( ' ' );
    let svg = '<svg width="' + w + '" height="32">' +
        '<g transform="translate(' + ( x + 16 ) + ',16)" stroke="black" strokeWidth="1">' +
        '<line x1="-' + x + '" y1="0" x2="' + x + '" y2="0"/>';

    svg += syms ? syms.map( s => symbolToSvg( s, x ) ) : '';
    svg += '</g></svg>';
    return svg;
};

// convert one symbol to SVG string
const symbolToSvg = ( sym, x ) => {
    let trans = 'translate(0,0)';
    if( sym === '' ) {
        return '';
    } else if( sym === 'around' || sym === 'field' ) {
        trans = 'translate(-' + x + ',0)';
    } else if( sym === 'tail' ) {
        trans = 'translate(' + x + ',0)';
    }

    const fill = sym === 'field' || sym === '_meltthru' ? 'black' : 'none';
    return '<path id="' + sym + '" transform="' + trans + '" d="' + pathd[sym] + '" fill="' + fill + '"/>';
};

// convert SVG string to symbols
const svgToSymbols = ( svg ) => {
    const ids = svg.match( /id="\w+"/g );
    const syms = ids ? ids.map( ( s ) => s.substring( 4, s.length - 1 ) ) : [];
    return syms.join( ' ' );
};

const pathd = {
    fillet: 'M-6,0 v12 l12,-12',
    _fillet: 'M-6,0 v-12 l12,12',
    plug: 'M-8,0 v8 h16 v-8',
    _plug: 'M-8,0 v-8 h16 v8',
    spot: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    _spot: 'M-6,-6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    __spot: 'M-6,0 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0',
    stud: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m2,-4 l8,8 m0,-8 l-8,8',
    backing: 'M-6,0 a6,6 0 0 0 12,0',
    _backing: 'M-6,0 a6,6 0 0 1 12,0',
    seam: 'M-6,6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    _seam: 'M-6,-6 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    __seam: 'M-6,0 a6,6 0 0 0 12,0 a6,6 0 0 0 -12,0 m-2,-3 h16 m0,6 h-16',
    surfacing: 'M-10,0 a5,5 0 0 0 10,0 a5,5 0 0 0 10,0',
    edge: 'M-8,0 v10 h16 v-10 M0,0 v10',
    _edge: 'M-8,0 v-10 h16 v10 M0,0 v-10',
    square: 'M-3,0 v12 M3,0 v12',
    _square: 'M-3,0 v-12 M3,0 v-12',
    vgroove: 'M-8,8 l8,-8 l8,8',
    _vgroove: 'M-8,-8 l8,8 l8,-8',
    bevel: 'M-4,9 v-9 l8,8',
    _bevel: 'M-4,-9 v9 l8,-8',
    ugroove: 'M0,0 v6 m-6,6 a6,6 0 0 1 12,0',
    _ugroove: 'M0,0 v-6 m-6,-6 a6,6 0 0 0 12,0',
    jgroove: 'M-3,0 v12 m0,-6 a6,6 0 0 1 6,6',
    _jgroove: 'M-3,0 v-12 m0,6 a6,6 0 0 0 6,-6',
    flarev: 'M-3,0 a8,8 0 0 1 -8,8 M3,0 a8,8 0 0 0 8,8',
    _flarev: 'M-3,0 a8,8 0 0 0 -8,-8 M3,0 a8,8 0 0 1 8,-8',
    flarebeval: 'M-3,0 v9 M3,0 a8,8 0 0 0 8,8',
    _flarebeval: 'M-3,0 v-9 M3,0 a8,8 0 0 1 8,-8',
    scarf: 'M-3,0 l-6,12 M3,0 l-6,12',
    _scarf: 'M-3,0 l6,-12 M3,0 l6,-12',
    around: 'M-5,0 a5,5 0 0 0 10,0 a5,5 0 0 0 -10,0',
    field: 'M0,-15 v15 v-7 l10,-4Z',
    tail: 'M12,-12 l-12,12 l12,12',
    _meltthru: 'M-6,0 a6,6 0 0 1 12,0',
    _insert: 'M-6,0 v-12 h12 v12',
    _flush: 'M-8,-8 h16',
    _convex: 'M-8,-8 a12,12 0 0 1 16,0',
    _concave: 'M-8,-10 a12,12 0 0 0 16,0'
};
