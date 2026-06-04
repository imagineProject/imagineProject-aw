// Copyright (c) 2022 Siemens

/**
 * @module js/revisionRuleAdminLocationService
 */
import localeSvc from 'js/localeService';

var _localeTextBundle = null;

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * Update part of a context
 *
 * @param {DeclViewModel} data - AddClausesViewModel object
 *
 */
export let addRevisionRule = function( data ) {
    // TODO: to be implemented
};

_localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );

export default exports = {
    addRevisionRule
};
