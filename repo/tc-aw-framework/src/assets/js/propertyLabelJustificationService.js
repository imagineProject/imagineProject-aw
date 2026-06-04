// Copyright (c) 2022 Siemens

/**
 * service for setting property label Alignment
 *
 * @module js/propertyLabelJustificationService
 */

import appCtxService from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';

let exports = {};

const labelAlignmentContext = 'labelAlignment';
const defaultAlignment = 'right';
const leftAlignmentClass = 'sw-section-alignLabelsLeftGlobally';


// set the initial label alignment value on startup
export const setInitialLabelAlignment = () => {
    let defaultAlignmentForUser = defaultAlignment;
    const labelAlignmentPreferenceValue = appCtxService?.ctx?.preferences?.AW_Default_Label_Justification;
    if( labelAlignmentPreferenceValue && labelAlignmentPreferenceValue[0] !== '' ) {
        defaultAlignmentForUser = labelAlignmentPreferenceValue[0];
    }
    setLabelAlignment( defaultAlignmentForUser );
};


const updateAppCtx = ( value ) => {
    appCtxService.registerCtx( labelAlignmentContext, value );
};

const updateDOMClass = ( newAlignment ) => {
    if( newAlignment === 'right' ) {
        document.body.classList.remove( leftAlignmentClass );
    } else if( newAlignment === 'left' ) {
        document.body.classList.add( leftAlignmentClass );
    }
};

const setNewPreferenceValue = ( preferenceValue ) => {
    const soaInput = {
        setPreferenceIn: [ {
            location: {
                location: 'User'
            },
            preferenceInputs: {
                preferenceName: 'AW_Default_Label_Justification',
                values: [ preferenceValue ]
            }
        } ]
    };
    soaService.post( 'Administration-2012-09-PreferenceManagement', 'setPreferencesAtLocations', soaInput );
};

export const setLabelAlignment = ( alignment ) => {
    const currentAlignment = appCtxService.getCtx( labelAlignmentContext );
    if( currentAlignment !== alignment ) {
        updateAppCtx( alignment );
        updateDOMClass( alignment );

        // alignment already on ctx so it is not the initial call
        if( currentAlignment ) {
            setNewPreferenceValue( alignment );
        }
    }
};

export default exports = {
    setInitialLabelAlignment,
    setLabelAlignment
};
