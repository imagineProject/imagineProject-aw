// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0FscValueIcon
 *
 * @module js/Pca0FscValueIconService
 */
import AwIcon from 'viewmodel/AwIconViewModel';
var exports = {};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */

export const pca0FscValueIconRenderFunction = ( props ) => {
    return  <AwIcon iconId={props.icon}></AwIcon>;
};


export default exports = {
    pca0FscValueIconRenderFunction
};

