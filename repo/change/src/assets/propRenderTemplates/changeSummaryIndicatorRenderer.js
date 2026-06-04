import { includeComponent } from 'js/moduleLoader';
import { renderComponent } from 'js/declReactUtils';
import _ from 'lodash';


var exports = {};

/**
 * This function is used to render the indicator column cells.
 * @param {Object} vmo Viewmodel object which contains props to get property display name.
 * @param {Object} containerElem Container dom element in which indicator is attached.
 * @param {Object} columnName - columnName of the current column which is rendered.
 */
export let indicatorColumnCellRenderer = function( vmo, containerElem, columnName ) {
    // Check if the column value is 'true'
    if ( vmo.props[columnName]?.dbValues?.[0]?.toLowerCase() === 'true' ) {
        // Define the indicator names
        // For custom indicator it can be added in this list in following format.
        const indicatorNames = {
            Indicator_HasPropertyChange: {
                indicatorName: 'indicatorProperties16',
                tabName: 'tc_xrt_properties'
            },
            Indicator_HasSubstitute: {
                indicatorName: 'indicatorSubstitute16',
                tabName: 'tc_xrt_Substitutes'
            },
            Indicator_HasAttachment: {
                indicatorName: 'indicatorAttachment16',
                tabName: 'tc_xrt_attachments'
            },
            Indicator_HasVendorPart: {
                indicatorName: 'indicatorVendorPart16',
                tabName: 'tc_xrt_VendorParts'
            },
            default: {
                indicatorName: 'indicatorMissingImage16',
                tabName: ''
            }
        };

        if( !vmo.visibleTabs ) {
            vmo.visibleTabs = [];
            let propName = null;
            let visibleTab = '';
            _.forEach(  vmo.props, function( prop ) {
                if( prop?.propertyName?.includes( 'Indicator_' ) && prop?.dbValues?.[0]?.toLowerCase() === 'true' ) {
                    propName = prop.propertyName;
                    if ( indicatorNames[propName] ) {
                        visibleTab = indicatorNames[propName].tabName;
                    }
                    visibleTab && vmo.visibleTabs.push( visibleTab );
                }
            } );
        }

        // Get the indicator name based on the column name
        let indicatorName = indicatorNames[columnName].indicatorName || indicatorNames.default.indicatorName;

        // Create the tooltip details
        let tooltipDetails = {
            prop: vmo.props?.[columnName]?.propertyDisplayName,
            isIndicator: true
        };

        let tabName = indicatorNames[columnName].tabName;

        // Create the indicator element
        let indicatorElement = includeComponent( 'Cm1ChangeSummaryDynamicIndicatorCell', {
            indicatorName,
            propertyName: columnName,
            tabName: tabName,
            tooltipDetails
        } );

        // Create the rendered element
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary align-self-center';

        // Render the indicator element and append it to the container
        renderComponent( indicatorElement, renderedElement );

        containerElem?.appendChild( renderedElement );
    }
};


/*
 * Change summary indicator column header renderer
 * we need to show icon instead of column name
 */
export let indicatorColumnHeaderRender = function( containerElement, columnField, tooltip, column ) {
    let headerContent = document.createElement( 'div' );
    headerContent.className = 'sw-row aw-change-columnHeaderTextWrapAuto';

    if ( column.name.includes( 'Indicator_' ) ) {
        const indicatorNames = {
            Indicator_HasPropertyChange: 'indicatorHeaderProperties16',
            Indicator_HasSubstitute: 'indicatorHasSubstitutes16',
            Indicator_HasAttachment: 'indicatorAttachment16',
            Indicator_HasVendorPart: 'indicatorHeaderVendorParts16',
            default: 'miscTableHeaderMissingInSource16'
        };

        let indicatorName = indicatorNames[column.name] || indicatorNames.default;
        let context = {
            indicatorName,
            tooltipDetails: {
                prop: column.displayName,
                isIndicator: true
            }
        };

        let indicatorElement = includeComponent( 'Cm1ChangeSummaryDynamicIndicatorColumn', context );
        let renderedElement = document.createElement( 'div' );
        renderedElement.className = 'aw-commands-mergeStatusIconForChangeSummary';

        renderComponent( indicatorElement, renderedElement );
        headerContent.appendChild( renderedElement );
        // We are using extended tooltip for indicator header. so removing the default indicator.
        if( containerElement.parentNode?.title ) {
            containerElement.parentNode.title = '';
        }
    }

    containerElement.appendChild( headerContent );
};

export default exports = {
    indicatorColumnCellRenderer,
    indicatorColumnHeaderRender
};
