// Copyright (c) 2022 Siemens
/* eslint-disable class-methods-use-this */

/**
 * @module js/pca0VCAUtils
 */
import appCtxSvc from 'js/appCtxService';
import assert from 'assert';
import AwBaseService from 'js/awBaseService';
import Pca0Constants from 'js/Pca0Constants';

import _ from 'lodash';

export default class Pca0VCAUtils extends AwBaseService {
    constructor() {
        super();
    }

    /**
     * Get Unique Key for Split Column
     * @param {String} originalColumnKey boKey to be split
     * @param {Number} index optional index to be used in the key
     * @returns {String} generated ID/Key for split column
     */
    generateSplitColumnKey( originalColumnKey, index ) {
        let indx = originalColumnKey.indexOf( Pca0Constants.SPLIT_COLUMN_DELIMITER );
        assert( indx === -1, 'Input original column key is invalid' );
        let uniqueID = index ? index : this.getUniqueID();
        return originalColumnKey + Pca0Constants.SPLIT_COLUMN_DELIMITER + uniqueID;
    }

    /**
     * Generate Random Number
     * @returns {String} generated Random number, in String format
     */
    getUniqueID() {
        return Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 ) +
            Math.floor( ( 1 + Math.random() ) * 0x10000 ).toString( 16 ).substring( 1 );
    }


    /**
     * Reset the updated context when VCA grid goes out of edit mode to display Edit button of primary work area table
     * or tree.
     * @param {Object} vcaEditState - Atomic data of VCA edit state.
     * @param {Object} editInProgress - The boolean value which decides if VCA table should be in edit mode or not.
     */
    resetContextOfTableOrTree( vcaEditState, editInProgress ) {
        appCtxSvc.updateCtx( Pca0Constants.IS_VARIANT_TREE_IN_EDIT_MODE, false );
        appCtxSvc.updateCtx( 'editInProgress', false );

        if( !_.isUndefined( vcaEditState ) && !_.isUndefined( editInProgress ) ) {
            this.setVcaEditState( vcaEditState, editInProgress );
        }
    }

    /**
     *
     * @param {Object} vcaEditState Atomic Data of vcaEditState
     * @param {Boolean} vcaEditInProgress boolean value which is set to vcaEditInProgress. Set it to true if VCA table
     * is in edit mode else set it to false
     */
    setVcaEditState( vcaEditState, vcaEditInProgress ) {
        let newVcaEditState = { ...vcaEditState.getValue ? vcaEditState.getValue() : vcaEditState.getAtomicData() };
        newVcaEditState.vcaEditInProgress = vcaEditInProgress;
        vcaEditState.update ? vcaEditState.update( newVcaEditState ) : vcaEditState.setAtomicData( newVcaEditState );
    }
}
