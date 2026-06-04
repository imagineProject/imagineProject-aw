// Copyright (c) 2021 Siemens
/**
 * @module js/AwInformationSiteService
 */
import AwChip from 'viewmodel/AwChipViewModel';

/**
 * render function for Common Global Navigation
 * @param {*} param0 context for render function interpolation
 * @returns {JSX.Element} react component
 */
var exports = {};
export const awInformationSiteRenderFunction = ( { ctx } ) => {
    if ( ctx.preferences.AWC_Display_Environment_Info[0] && ctx.preferences.AWC_Display_Environment_Info[0].includes( '$' ) ) {
        const siteInfo = ctx.preferences.AWC_Display_Environment_Info[0].split( '$' );
        let chipData = {
            chipType: 'STATIC',
            buttonType: 'base'
        };
        let chipFontColor = null;
        let chipColor = null;
        let startIndex = null;

        if ( siteInfo.length === 3 ) {
            chipData.labelDisplayName = siteInfo[0];
            chipData.labelInternalName = siteInfo[0];
            startIndex = 1;
        } else if ( siteInfo.length === 4 && siteInfo[1] === 'siteName' ) {
            chipData.labelDisplayName = ctx.SiteID;
            chipData.labelInternalName = ctx.SiteID;
            startIndex = 2;
        } else {
            return <span></span>;
        }

        chipColor = siteInfo[startIndex];
        chipFontColor = siteInfo[startIndex + 1] === 'dark' ? 'black' : 'white';
        document.documentElement.style.setProperty( '--information-site-chip-color', chipColor );
        document.documentElement.style.setProperty( '--information-site-chip-font-color', chipFontColor );

        return (
            <AwChip className='sw-sessionControls-element sw-informationSite-chip' chip={chipData}></AwChip>
        );
    }
    return(
        <span></span>
    );
};

export default exports = {
    awInformationSiteRenderFunction
};

