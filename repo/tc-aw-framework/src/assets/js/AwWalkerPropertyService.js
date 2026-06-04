import AwWidget from 'viewmodel/AwWidgetViewModel';
import uwSupportSvc from 'js/uwSupportService';

export const awWalkerPropertyRenderFunction = ( { prop, propdata, activeState, type, options } ) => {
    if( !propdata || !prop ) {
        return;
    }

    const toRenderWithoutLabel = setDefaultLabelPlacement( propdata, prop, options, type );

    if( toRenderWithoutLabel ) {
        return <AwWidget {...prop}
            renderingHint={propdata.renderingHint}
            modifiable={propdata.modifiable}
            labeldisplay='headless'
            parameterMap={propdata.parameters}
            activeState={activeState}/>;
    }
    return <AwWidget {...prop}
        renderingHint={propdata.renderingHint}
        modifiable={propdata.modifiable}
        parameterMap={propdata.parameters}
        activeState={activeState}/>;
};


// labelPlacement is the actual property for setting the label/value positions,
// whereas propdata.labelPosition is the configuration used for setting labelPlacement
// propdata.labelPosition is XRT specific whereas labelPlacement is internal to SWF
const setDefaultLabelPlacement = ( propdata, prop, options, type ) => {
    let labelPlacement = 'default';
    if( propdata.labelPosition ) {
        labelPlacement = uwSupportSvc.retrievePropertyLabelPlacement( propdata.labelPosition );
        if( labelPlacement === 'none' ) {
            return true;
        }
    }

    // set default label placement for XRT properties
    // This is one of the two places we assign default placements
    // The other being in AwPropertyLabelService.js
    if( labelPlacement === 'default' ) {
        // These XRT types are forms
        const isFormType = type === 'CREATE' || type === 'SAVEAS' || type === 'REVISE';
        const renderingHint = propdata.renderingHint || prop.renderingHint;
        const isBooleanEditable = prop.fielddata.isEditable && prop.modifiable !== false && prop.typex === 'BOOLEAN';
        if( isFormType ) {
            // top down label value positioning
            prop.fielddata.labelPlacement = 'top';
            if ( isBooleanEditable && renderingHint !== 'radiobutton' ) {
                // override for checkboxes and toggle buttons
                // to have label after checkbox/toggle
                prop.fielddata.labelPlacement = 'end';
            }
        } else {
            // For SUMMARY and INFO type XRT, default is sideways
            prop.fielddata.labelPlacement = 'start';
        }
    } else {
        // Use the non-default position coming from server
        prop.fielddata.labelPlacement = labelPlacement;
    }
    return false;
};

