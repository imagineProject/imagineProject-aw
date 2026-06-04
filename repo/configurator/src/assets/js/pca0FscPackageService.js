// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/pca0FscPackageService
 */
import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwCommandPanel from 'viewmodel/AwCommandPanelViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import AwI18n from 'viewmodel/AwI18nViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwPanelFooter from 'viewmodel/AwPanelFooterViewModel';
import commonUtils from 'js/pca0CommonUtils';
import configuratorUtils from 'js/configuratorUtils';
import eventBus from 'js/eventBus';
import exprGridSvc from 'js/pca0ExpressionGridService';
import pca0CommonUtils from 'js/pca0CommonUtils';
import Pca0Constants from 'js/Pca0Constants';
import Pca0FscValue from 'viewmodel/Pca0FscValueViewModel';
import pcaSelectionService from 'js/Pca0FscSelectionService';

var exports = {};

/**
 * This API processes the server response and constructs the client data model
 *
 * @param {Object} response - The response received by SOA service
 * @returns {Object} - Returns the option group object which will be rendered on package panel
 */
export let getPackageGroup = function( response ) {
    var context = appCtxSvc.getCtx( 'fscContext.packageContext' );
    var packageGroups = configuratorUtils.populateScopes( response );
    setSingleSelect( packageGroups );
    context.configPerspective = response.configPerspective;
    context.payloadStrings = response.payloadStrings;
    context.selectedExpressions = configuratorUtils.convertSelectedExpressionJsonStringToObject( response.selectedExpressions );
    //clear formula
    exprGridSvc.clearSelectedExpressionFormula( 'fscContext' );
    return { group: packageGroups[ 0 ] };
};

/**
 * This function marks all families as singleSelect in package panel
 */
function setSingleSelect( packageGroups ) {
    //iterate over the groups
    for( var i = 0; i < packageGroups.length; i++ ) {
        var group = packageGroups[ i ];
        //Iterate over the families of currently expanded group
        if( group.families ) {
            for( var j = 0; j < group.families.length; j++ ) {
                var family = group.families[ j ];
                family.singleSelect = true;
            }
        }
    }
}

/**
 * This API updates the fsc value
 */
export const updateValue = ( data, newValue, path ) => {
    var group = _.cloneDeep( data.scopeStruct.group );
    if( path ) {
        group.families[ path.famIndex ].values[ path.index ] = newValue;
    }
    return { group: group };
};
/**
 * This API unregisters the package context
 */
export let unregisterPackageContext = function() {
    var context = appCtxSvc.getCtx( 'fscContext' );
    if( context.packageContext ) {
        //Delete the packageContext from 'fscContext' because it's life-cycle should end with package panel
        delete context.packageContext;
        appCtxSvc.updateCtx( 'fscContext', context );
    }
};

/**
 * This API adds the package to the current selections when user clicks on 'Save' command on package panel.
 */
export let addPackageToConfiguration = function() {
    var context = appCtxSvc.getCtx( 'fscContext' );
    var packageFamily = context.packageContext.packageFamily;
    var packageUID = context.packageContext.currentPackage.optValueStr;
    var packageDispValue = context.packageContext.currentPackage.valueDisplayName;

    //Copy selections from packageContext to fscContext
    context.selectedExpressions = context.packageContext.selectedExpressions;
    // Add the package feature in selections map
    const selectionObject = {
        context: context,
        familyUID: packageFamily.familyStr,
        isFamilySingleSelect: packageFamily.singleSelect,
        optionValueUid: packageUID,
        featureName: packageDispValue,
        state: 1,
        isFamilySelection: false,
        isFreeForm: false,
        isUnconfigured: false,
        isEnumeratedRangeExpr: false
    };
    pcaSelectionService.updateUserSelectionMap( selectionObject );

    //Fire an event to update summary with package selection
    var selectionData = {
        familyUID: packageFamily.familyStr,
        familyDisplayName: packageFamily.familyDisplayName,
        nodeID: packageUID,
        featureDisplayName: context.packageContext.currentPackage.valueDisplayName,
        featureDescription: '', // TODO: need to be implemented -> we expect $scope.value.valueDescription,
        groupUID: packageFamily.groupUID,
        groupDisplayName: packageFamily.groupDisplayName,
        isThumbnailDisplay: context.packageContext.currentPackage.isThumbnailDisplay,
        selectionState: 1,
        vmo: context.packageContext.currentPackage.optValue
    };
    eventBus.publish( 'customVariantRule.userSelectionChanged', selectionData );

    //Delete the packageContext from 'fscContext' because it's life-cycle should end with package panel
    delete context.packageContext;
    appCtxSvc.updateCtx( 'fscContext', context );

    //Now fire the event to reload the features view
    eventBus.publish( 'Pca0Features.loadScopeData', {} );
};

/**
 * Convert selected expression json object to selected expression json string array.
 * for ex.
 * {
 * objectUid1:  [ ConfigExprSet: [] ],
 * objectUid2: [ ConfigExprSet: [] ],
 * objectUid3: [ ConfigExprSet: [] ]
 * }
 * will be converted to
 *
 * [
 * { objectUid1: [ ConfigExprSet: [] ] },
 * { objectUid2: [ ConfigExprSet: [] ] },
 * { objectUid3: [ ConfigExprSet: [] ] }
 * ]
 * @param {Object} selectedExpressions - selected expression json object
 * @returns {Array} Array of json string of selected expressions.
 */
export let convertSelectedExpressionJsonObjectToString = function( selectedExpressions ) {
    return configuratorUtils.convertSelectedExpressionJsonObjectToString( selectedExpressions );
};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const renderPackagePanel = ( props ) => {
    const { viewModel, actions, i18n, ctx } = props;
    let { data, dispatch } = viewModel;
    const fscContext = appCtxSvc.getCtx( Pca0Constants.FSC_CONTEXT );
    let textViewSettings = _.get( fscContext, 'vcvLayoutSettings' );
    let textui = false;
    textui = _.get( textViewSettings, 'showCompressedData' );

    const fetchEachValue = ( value, family, famIndex, index ) => {
        return (
            <Pca0FscValue key={value.optValueStr} name='pca0FscValue' valueaction='selectPackageOption'
                variantcontext='fscContext.packageContext' group={data.scopeStruct.group} value={value} family={family}
                famIndex={famIndex} index={index} textsettings={textViewSettings} textui={textui}></Pca0FscValue>
        );
    };

    const fetchEachFamily = ( family, famIndex ) => {
        return (
            <div id={'pca0FscPackage_' + family.familyStr }  key={family.familyStr} >
                <AwCommandPanelSection  className='aw-clspanel-propSection aw-cfg-familyWrapper' id='aw-clspanel-propSection' caption={family.familyDisplayName} collapsed='false'
                    anchor={data.familyCmdAnchor} context={family} title={family.familyDisplayName} key={family.familyStr}>
                    {  data.scopeStruct.group.expand && family.values && family.values.length > 0 &&
                        family.values.map( ( value, index ) => fetchEachValue( value, family, famIndex, index ) ) }
                </AwCommandPanelSection>
            </div>
        );
    };

    const renderPackages = () => {
        if( _.get( data, 'scopeStruct.group.families.length' ) > 0 && _.get( fscContext, 'packageContext.currentPackage' ) ) {
            return (
                <AwCommandPanel  caption={fscContext.packageContext.currentPackage.optValue.cellHeader1} className='pca0fscpackagepanel' context= {props.subPanelContext}
                    updateActiveView={{ activeView: data.activeView, dispatch: dispatch }}>
                    <AwPanelBody>
                        {
                            data.scopeStruct.group.families.map( ( family, index ) => fetchEachFamily( family, index ) )
                        }
                    </AwPanelBody>
                    <AwPanelFooter>
                        { data.showSavePackageCommand && <AwButton action={actions.addPackage} >
                            <AwI18n>
                                {i18n.addBtn}
                            </AwI18n>
                        </AwButton>
                        }
                    </AwPanelFooter>
                </AwCommandPanel>
            );
        }
    };

    return (
        renderPackages()
    );
};

/**
 * Get the property policy for the SOA variantConfigurationView
 * @returns {Object} The property policy
 */
export const getPropertyPolicyForVCV = () => {
    return pca0CommonUtils.getPropertyPolicy( 'variantConfigurationView' );
};

export default exports = {
    getPackageGroup,
    unregisterPackageContext,
    addPackageToConfiguration,
    convertSelectedExpressionJsonObjectToString,
    renderPackagePanel,
    updateValue,
    getPropertyPolicyForVCV
};
