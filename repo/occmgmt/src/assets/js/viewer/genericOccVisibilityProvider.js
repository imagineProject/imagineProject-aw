/* eslint-disable class-methods-use-this */

// Copyright (c) 2023 Siemens

/**
 * GenericOccVisibilityProvider
 *
 * Responsible for providing occ visibility and toggle visibility by calling functions registered structure viewer.
 *
 * @module js/viewer/genericOccVisibilityProvider
 */

export default class GenericOccVisibilityProvider {
    // Construct an GenericOccVisibilityProvider
    constructor( ) {
        this.key = 'GenericOccVisibilityProvider';
    }
    condition( modelObject, contextKey ) {
        return Boolean( modelObject && contextKey );
    }

    /**
     *  Function to toggle occurrence visibility
     * @param {object} modelObject Object whose thumbnail is toggled 
     * @param {function} getOccVisibilityFunctionRegisteredByViz funciton registered by structure viewer for getOccVisibility 
     * @param {function} toggleOccVisibilityFunctionRegisteredByViz funciton registered by structure viewer for toggleOccVisibility
     * @returns {boolean} true if handled toggle visibility else null
     */
    toggleOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz, toggleOccVisibilityFunctionRegisteredByViz ) {
        toggleOccVisibilityFunctionRegisteredByViz( modelObject );
        return true;
    }

    /**
     * Function to get occurrence visibility
     * 
     * @param {object} modelObject Object whose occurrence visibility to get from viewer
     * @param {function} getOccVisibilityFunctionRegisteredByViz funciton registered by structure viewer for getOccVisibility
     * @param {function} toggleOccVisibilityFunctionRegisteredByViz funciton registered by structure viewer for toggleOccVisibility
     * @returns {boolean} true if model object is visibility in viewer else false
     */
    getOccVisibility( modelObject, getOccVisibilityFunctionRegisteredByViz, toggleOccVisibilityFunctionRegisteredByViz ) {
        return getOccVisibilityFunctionRegisteredByViz( modelObject );
    }
}
