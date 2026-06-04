// Copyright (c) 2022 Siemens

/**
 * This module provides graph style support
 *
 * @module js/Awp0WorkflowGraphStyles
 */
import $ from 'jquery';
import _ from 'lodash';

var exports = {};

// Internal storage for the parsed presentation styles.
var _EdgePresentations = null;

/**
 * Maps the parameter names in the GraphStyle XML document to the expected names used internally by the graphing
 * component and sets the value on the Style object accordingly.
 *
 * @param Style the Style object.
 * @param ParameterName name of the parameter in the GraphStyle XML document.
 * @param ParameterValue value of the parameter in the GraphStyle XML document.
 * @return matching internal name used by the graphing component.
 */
var setStyleParameter = function( Style, ParameterName, ParameterValue ) {
    if( ParameterName === 'lineStyle' ) {
        ParameterName = 'dashStyle';
    }
    if( ParameterName === 'lineWidth' ) {
        ParameterName = 'thickness';
    }
    if( ParameterName === 'lineColor' ) {
        ParameterName = 'color';
    }
    if( ParameterName === 'arrowSourceShape' ) {
        ParameterName = 'sourceArrow.arrowShape';
    }
    if( ParameterName === 'arrowSourceFillInterior' ) {
        ParameterName = 'sourceArrow.fillInterior';
    }
    if( ParameterName === 'arrowSourceScale' ) {
        ParameterName = 'sourceArrow.arrowScale';
    }
    if( ParameterName === 'arrowTargetShape' ) {
        ParameterName = 'targetArrow.arrowShape';
    }
    if( ParameterName === 'arrowTargetFillInterior' ) {
        ParameterName = 'targetArrow.fillInterior';
    }
    if( ParameterName === 'arrowTargetScale' ) {
        ParameterName = 'targetArrow.arrowScale';
    }
    _.set( Style, ParameterName, ParameterValue.toUpperCase() );
};

/**
 * Parses the Parameters of a Presentation element in the GraphStyles XML document and returns them as an objects of
 * name-value pairs.
 *
 * This was extracted as a seperate function
 *
 * @param Presentation Edge, Node or Port Presentation XML element.
 * @return A style object containing the pairs of parameter names and values for the specified presentation element.
 */
var parsePresentationElementStyleParameters = function( PresentationElement ) {
    var Style = {};
    var ParameterElements = $( PresentationElement ).find( 'parameter' );

    _.each( ParameterElements, function( ParameterElement ) {
        var ParameterName = ParameterElement.attributes.name.value;
        var ValueElements = $( ParameterElement ).find( 'value' );

        _.each( ValueElements, function( ValueElement ) {
            setStyleParameter( Style, ParameterName, ValueElement.textContent );
        } );
    } );

    return Style;
};

/**
 * Parses the presentation elements of the GraphStyle XML document and stores them on the exports.
 *
 * @param results the results of the SOA call to getGraphStyleDef.
 */
export let parseGraphStyleXML = function( results ) {
    _EdgePresentations = {};
    var StyleTypeName = null;

    // Parse the XML Document, results.
    var xmlDoc = $.parseXML( results );

    // jQuery XML wrapper.
    var $xmlObject = $( xmlDoc );
    var $EdgePresentationElements = $( $xmlObject.find( 'EdgePresentation' ) );
    var ua = window.navigator.userAgent;

    // Parse and store each of the EdgePresentation elements.
    _.each( $EdgePresentationElements, function( EdgePresentationElement ) {
        if( ua.indexOf( 'MSIE' ) !== -1 || navigator.appVersion.indexOf( 'Trident/' ) > 0 ) {
            StyleTypeName = EdgePresentationElement.attributes[ 0 ].childNodes[ 0 ].data;
        } else {
            StyleTypeName = EdgePresentationElement.id;
        }

        var EdgeStyle = parsePresentationElementStyleParameters( EdgePresentationElement );

        _EdgePresentations[ StyleTypeName ] = EdgeStyle;
    } );
    return _EdgePresentations;
};

export default exports = {
    parseGraphStyleXML
};
