// Copyright (c) 2023 Siemens

/**
 *
 * @module propRenderTemplates/svTablePropertyRenderer
 */
import _ from 'lodash';
import localeSvc from 'js/localeService';
var exports = {};
const FONT_STYLE = 'font-style';
var _pendingSolutionVariant = null;
var loadTextConstants = function() {
    localeSvc.getTextPromise( 'SolutionVariantConstants', true ).then(
        function( textBundle ) {
            _pendingSolutionVariant = textBundle.pendingSolutionVariant;
        } );
};
loadTextConstants();

/**
 * This method is rendering icons for READ & WRITE columns of Attribute ACE table
 * @param {Object} vmo - the ViewModelObject for the cell
 * @param {Object} containerElem - the icon container element
 * @param {Object} column - the column associated with the cell
 */
export let svVariantRuleRenderer = function( vmo, containerElem, column ) {
    vmo.props[ column ].emptyLOVEntry = false;
    let priv = vmo.props[ column ];
    if( priv.dbValue ) {
        if( priv.dbValue === 'Valid and Complete' ) {
            var imagePath = 'assets/image/indicatorValidConfiguration16.svg';
            var tooltip = priv.uiValue;
        }
        else if( priv.dbValue === 'Valid but Incomplete' ) {
            var imagePath = 'assets/image/indicatorValidButIncompleteConfiguration16.svg';
            var tooltip = priv.uiValue;
        } else if( priv.dbValue === 'Invalid' ) {
            var imagePath = 'assets/image/indicatorInvalidConfiguration16.svg';
            var tooltip = priv.uiValue;
        }
        let cellImg = document.createElement( 'img' );
        cellImg.src = imagePath;
        cellImg.title = tooltip;
        cellImg.alt = tooltip;
        cellImg.classList.add( 'aw-visual-indicator', 'aw-visual-indicatorTableIcon' );
        containerElem.appendChild( cellImg );
        var labelText = document.createElement( 'span' );
        labelText.textContent = tooltip;
        containerElem.appendChild( labelText );
    }
};

export let svSolutionVariantRenderer = function( vmo, containerElement, columnField ) {
    var labelText = document.createElement( 'div' );
    labelText.classList.add( "aw-splm-tableCellText" );
    labelText.classList.add( "aw-splm-tableCellTextDynamic" );

    if(_.isNull(vmo.props[ columnField ].dbValue) || vmo.props[ columnField ].dbValue === '')
    {
        labelText.textContent = _pendingSolutionVariant;
        labelText.style[ FONT_STYLE ] = 'italic';
        labelText.style.color = 'gray';
    }
    else{
        labelText.textContent = vmo.props[ columnField ].uiValue;
    }
    containerElement.insertBefore(labelText, containerElement.firstChild);
};
export default exports = {
    svVariantRuleRenderer,
    svSolutionVariantRenderer
};
