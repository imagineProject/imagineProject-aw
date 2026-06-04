import AwPopupWrapper from 'viewmodel/AwPopupWrapperViewModel';
import AwChip from 'viewmodel/AwChipViewModel';
import cdmService from 'soa/kernel/clientDataModel';
import { ExtendedTooltip } from 'js/hocCollection';
import appCtxSvc from 'js/appCtxService';
const AwChipExtendedTooltip = ExtendedTooltip( AwChip );

var exports = {};

export const awChangeContextChipRenderFunction = ( props ) => {
    /**
     * render function for revisionRule
     * @param {Object} props - Properties of the component.
     * @returns {JSX.Element} - React component.
     */

    const { viewModel } = props;
    const { actions, conditions, data, ctx, i18n } = viewModel;
    let btnRender = null;
    let displayStr = i18n.noChangeTitle;
    let titleStr = ctx?.userSession?.props?.cm0GlobalChangeContext?.displayValues[0];
    if ( titleStr ) {
        displayStr = titleStr;
    }

    if ( conditions.highlightContext ) {
        btnRender = <AwChipExtendedTooltip className='sw-sessionControls-element sw-changeContext-chip' chip={{
            chipType: data.clickableChipActivate.chipType,
            iconId: data.clickableChipActivate.iconId,
            buttonType: data.clickableChipActivate.buttonType,
            labelDisplayName: displayStr,
            labelInternalName: displayStr,
            uiIconTitle: 'Checking' }}
        action={actions.displayPopup}
        extendedTooltip={data.showTooltip}
        extTooltipData={data}></AwChipExtendedTooltip>;
    }else if ( conditions.normalContext  ) {
        btnRender = <AwChipExtendedTooltip className='sw-sessionControls-element sw-changeContext-chip' chip={{
            chipType: data.clickableChipNormal.chipType,
            iconId: data.clickableChipNormal.iconId,
            buttonType: data.clickableChipNormal.buttonType,
            labelDisplayName: displayStr,
            labelInternalName: displayStr,
            uiIconTitle: 'Checking' }}
        action={actions.displayPopup}
        extendedTooltip={data.showTooltip}
        extTooltipData={data}></AwChipExtendedTooltip>;
    }

    return (
        <AwPopupWrapper popup={actions.displayPopup}>
            {btnRender}
        </AwPopupWrapper>
    );
};

/**
 * Check if UserSession object is different or not by comparing UserSession from setUserSessionStateAndUpdateDefaults SOA response and ctx.userSession.
 * @param {Object} response - Response from setUserSessionStateAndUpdateDefaults SOA.
 * @returns true, if ctx.userSession is different from UserSession object in updated objects.
 */
export const checkIsUserSessionChanged = (response) => {
    const updateObjectUIDs = response?.updated?.length > 0 ? response?.updated : [];

    const userSessionObjUID = updateObjectUIDs.filter((uid) => {
        const modelObject = cdmService.getObject(uid);
        if (modelObject && modelObject.modelType.typeHierarchyArray.indexOf('UserSession') > -1) {
            return true;
        }
    }).at(0);

    const currentUserSessionUID = appCtxSvc.ctx.userSession.uid;
    return userSessionObjUID !== currentUserSessionUID;
};

export default exports = {
    checkIsUserSessionChanged
};
