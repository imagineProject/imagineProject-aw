// Copyright (c) 2022 Siemens

/**
 * @module js/occmgmtCustomDialogService
 */

let exports = {};

/**
 * @param {Object} customDialogAction Dialog action for the custom aw-dialog component
 * @param {Object} options dialog options
 */
export let launchCustomDialogPanel = ( customDialogAction, options ) => {
    customDialogAction && customDialogAction.show( options );
};

export default exports = {
    launchCustomDialogPanel
};
