// Copyright (c) 2022 Siemens

import appCtxService from 'js/appCtxService';
import AwLovEdit from 'viewmodel/AwLovEditViewModel';
import { constants as veConstants } from 'js/pca0VariabilityExplorerConstants';
import _ from 'lodash';

/**
 *   Export APIs section starts
 */
let exports = {};

/**
 * Validate if LOV entry from available LOVs is supported for input VMO
 * @param {Object} lovEntry the LOV entry
 * @param {Object} vmo ViewModelObject mapped to tree node
 * @returns {Boolean} true if lov entry is supported: it will be shown/hidden in dropdown
 */
export let isLovEntrySupported = ( lovEntry, vmo ) => {
    // Family
    if( vmo.isFamily ) {
        // For Family-level, only [Empty, Mandatory] are supported
        if( lovEntry.operatorCode !== 0 && lovEntry.lovKey !== 'M' ) {
            return false;
        }

        // If Family is Mandatory, 'Mandatory' is not needed
        return !( !vmo.isOptional && lovEntry.lovKey === 'M' );
    }

    // Feature
    return lovEntry.lovKey !== 'M';
};
/**
 * Get list of Feature dispositions
 * @param {Boolean} props component VMO info container
 * @returns {Array} list of feature disposition
 */
export let loadLOVsDataProvider = props => {
    let dpLovs = [];
    let featureDispositionsLov = appCtxService.getCtx( veConstants.CONFIG_CONTEXT_KEY ).featureDispositionsLov;
    let supportedLOVs = _.filter( featureDispositionsLov, lovEntry => {
        return exports.isLovEntrySupported( lovEntry, props.vmo );
    } );
    supportedLOVs.forEach( lovEntry => {
        dpLovs.push( {
            propInternalValue: lovEntry.lovKey,
            propDisplayValue: lovEntry.displayName,
            // propDisplayDescription: lovEntry.description
            // iconName: lovEntry.iconName,
            selectionState: lovEntry.operatorCode
        } );
    } );
    return dpLovs;
};

/**
 * Render function for pcaFeatureDispositionLovEdit component
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const pcaFeatureDispositionLovEditRenderFunction = ( props ) => {
    const { viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.lovsDataProvider;
    fielddata.vmo = prop.vmo.props;

    const passedProps = { ...prop, fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

export default exports = {
    isLovEntrySupported,
    loadLOVsDataProvider,
    pcaFeatureDispositionLovEditRenderFunction
};
