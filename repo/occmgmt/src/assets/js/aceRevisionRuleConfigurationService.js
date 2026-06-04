// Copyright (c) 2022 Siemens

/**
 * @module js/aceRevisionRuleConfigurationService
 */
import eventBus from 'js/eventBus';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import viewModelObjectService from 'js/viewModelObjectService';
import tcViewModelObjectService from 'js/tcViewModelObjectService';
import occmgmtUtils from 'js/occmgmtUtils';
import popupService from 'js/popupService';
import aceStructureConfigurationService from 'js/aceStructureConfigurationService';
import _ from 'lodash';

var _localeTextBundle = null;
var exports = {};

var globalLabel = null;
var globalRevisionRuleLabel = null;
var _isSeparatorAdded = false;

export let populateRuleDateFeatureInfo = function( data, occContext ) {
    if( data && data.dataProviders && data.dataProviders.getRevisionRules && occContext ) {
        return { isRuleDateVisible: occContext.supportedFeatures.Awb0RuleDateFeature };
    }
};

var isRevisionRuleSuppressed = function( currentRevisionRuleModelObject ) {
    return _.get( currentRevisionRuleModelObject, 'props.suppressed.dbValues[0]', false );
};

var extractRevisionRuleDescriptionToShow = function( currentRevisionRuleModelObject ) {
    var revRuleDescProperty = uwPropertyService.createViewModelProperty(
        currentRevisionRuleModelObject.props.object_desc.dbValues[ 0 ],
        currentRevisionRuleModelObject.props.object_desc.uiValues[ 0 ], 'STRING',
        currentRevisionRuleModelObject.props.object_desc.dbValues[ 0 ], '' );
    revRuleDescProperty.uiValue = currentRevisionRuleModelObject.props.object_desc.uiValues[ 0 ];
    return revRuleDescProperty;
};

var populateCurrentRevisionRuleWithDescription = function( data, occContext ) {
    if( data ) {
        var currentRevRule = occContext.productContextInfo.props.awb0CurrentRevRule;
        let currentRevisionRuleDescription;
        if( currentRevRule ) {
            var currentRevisionRule = uwPropertyService.createViewModelProperty( currentRevRule.dbValues[ 0 ],
                currentRevRule.uiValues[ 0 ], 'STRING', currentRevRule.dbValues[ 0 ], currentRevRule.uiValues );
            //Explicitly setting isEditable to True as the above API returns it false by default as opposed to declaring the same prop in viewModel which returm
            // true by default
            currentRevisionRule.isEditable = true;
            if( currentRevisionRule ) {
                var currentRevisionRuleModelObject = cdm.getObject( currentRevRule.dbValues );
                if( currentRevisionRuleModelObject ) {
                    var suppressed = isRevisionRuleSuppressed( currentRevisionRuleModelObject );
                    if( suppressed === '0' && data.currentRevisionRuleDescription ) {
                        currentRevisionRuleDescription = extractRevisionRuleDescriptionToShow( currentRevisionRuleModelObject );
                    }
                }
            }
            return { currentRevisionRule, currentRevisionRuleDescription };
        }
    }
};

var populateExplicitGlobalRevRuleIndicatorString = function( data ) {
    if( data ) {
        var userSessionObject = cdm.getUserSession();
        if( userSessionObject ) {
            var globalRevRuleProperty = userSessionObject.props.awp0RevRule;
            if( globalRevRuleProperty && globalRevRuleProperty.uiValues ) {
                var globalRevRuleName = globalRevRuleProperty.uiValues[ 0 ];
                if( globalRevRuleName && globalRevRuleName === data.currentRevisionRule.uiValue ) {
                    appCtxSvc.updatePartialCtx( 'aceActiveContext.context.isUsingGlobalRevisionRule', true );
                } else {
                    appCtxSvc.updatePartialCtx( 'aceActiveContext.context.isUsingGlobalRevisionRule', false );
                }
            }
        }
    }
};

var prepareGlobalRevisionRuleDisplayProperty = function( data ) {
    if( data ) {
        var globalRevRuleProperty = uwPropertyService.createViewModelProperty( globalRevisionRuleLabel,
            globalRevisionRuleLabel, 'STRING', globalRevisionRuleLabel, '' );
        globalRevRuleProperty.isEditable = true;
        return globalRevRuleProperty;
    }
};

var populateImplicitGlobalRevRuleIndicatorString = function( data, currentRevisionRule, occContext ) {
    if( data ) {
        var globalRevRulePropertyOnPCI = occContext.productContextInfo.props.awb0UseGlobalRevisionRule;
        //To check if showGlobalLabel is applicable
        if( data.subPanelContext.showGlobalLabel && data.subPanelContext.showGlobalLabel.dbValue === false
            && globalRevRulePropertyOnPCI && globalRevRulePropertyOnPCI.dbValues[ 0 ] === '1' ) {
            globalRevisionRuleLabel = currentRevisionRule.uiValue;
            return prepareGlobalRevisionRuleDisplayProperty( data );
        } else if( globalRevRulePropertyOnPCI && globalRevRulePropertyOnPCI.dbValues[ 0 ] === '1' && data.globalLabel ) {
            globalRevisionRuleLabel = data.globalLabel.uiValue + ' (' + currentRevisionRule.uiValue + ')';
            return prepareGlobalRevisionRuleDisplayProperty( data );
        }
        globalLabel = data.globalLabel && data.globalLabel.uiValue;
    }
};

var populateIndicationForUsingGlobalRevisionRule = function( data, currentRevisionRule, occContext ) {
    if( data ) {
        globalRevisionRuleLabel = null;
        if( !occContext.supportedFeatures.Awb0EnableUseGlobalRevisionRuleFeature ) {
            populateExplicitGlobalRevRuleIndicatorString( data );
        } else {
            return populateImplicitGlobalRevRuleIndicatorString( data, currentRevisionRule, occContext );
        }
    }
};

/**
 * Initialize the Revision Rule Configuration Section
 *
 * @param {Object} data - The 'data' object from viewModel.
 */
export let getInitialRevisionRuleConfigurationData = function( data, occContext ) {
    if( data ) {
        // Certain time we observed that occContext is avaiable but productContextInfo is empty/undefined,
        // so at the time of rendering header this will cause console error. To overcome this error added safety check
        if( occContext && occContext.productContextInfo && !_.isUndefined( occContext.productContextInfo.props ) ) {
            let { currentRevisionRule, currentRevisionRuleDescription } = populateCurrentRevisionRuleWithDescription( data, occContext );
            let globalRevRuleProperty = populateIndicationForUsingGlobalRevisionRule( data, currentRevisionRule, occContext );
            if( globalRevRuleProperty ) {
                currentRevisionRule = globalRevRuleProperty;
            }
            currentRevisionRule.isEditable = true;
            return { currentRevisionRule, currentRevisionRuleDescription, globalRevRuleProperty };
        }
    }
};

/**
 * Initialize the Revision Rule description and effectivity overrider text
 *
 * @param {Object} data - The 'data' object from viewModel.
 */
export let initializeRevRuleDescAndOverridenText = function( data, occContext ) {
    if( data ) {
        const { currentRevisionRule, currentRevisionRuleDescription } = populateCurrentRevisionRuleWithDescription( data, occContext );
        return { currentRevisionRule, currentRevisionRuleDescription };
    }
};

var addGlobalRevisionRuleEntryIfApplicable = function( response, revisionRules, occContext ) {
    if( occContext.supportedFeatures.Awb0EnableUseGlobalRevisionRuleFeature ) {
        var viewModelObj = viewModelObjectService.createViewModelObject( response.globalRevisionRule.uid,
            'globalRevRule' );
        if( viewModelObj ) {
            if( viewModelObj.props.object_string && globalLabel ) {
                globalRevisionRuleLabel = globalLabel + ' (' + viewModelObj.props.object_string.dbValues[ 0 ] +
                    ')';
            }
            var globalRevisionRuleEntry = tcViewModelObjectService.createViewModelObjectById( 'globalRevisionRuleEntry' );

            globalRevisionRuleEntry.props.object_string = uwPropertyService.createViewModelProperty(
                globalRevisionRuleLabel,
                globalRevisionRuleLabel, 'STRING',
                globalRevisionRuleLabel, '' );

            globalRevisionRuleEntry.cellHeader1 = globalRevisionRuleLabel;

            if( response.endIndex <= 20 ) {
                revisionRules.splice( 0, 0, globalRevisionRuleEntry );
                response.totalFound += 1;
            }
        }
    }
};

export let processRevisionRules = function( response, occContext ) {
    var revisionRules = [];
    if( ( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors )
         && !response.revisionRules ) {
        return revisionRules;
    }

    if( response.endIndex <= 20 ) {
        _isSeparatorAdded = false;
    }
    if( response && response.revisionRules ) {
        var separatorObject = tcViewModelObjectService.createViewModelObjectById( 'separatorObject' );
        separatorObject.props.object_string = {};
        separatorObject.props.rule_date = {};
        separatorObject.marker = response.marker + 1;
        //viewModelObjectService expects cellHeader1 populated/should have uiValues in object_string
        separatorObject.cellHeader1 = 'Sepearator';

        var revisionRulesList = response.revisionRules;
        revisionRulesList.forEach( function( revRuleInfo ) {
            var revisionRule = revRuleInfo.revisionRule;
            revisionRule.serializedRevRule = revRuleInfo.serializedRevRule;
            revisionRules.push( revisionRule );
        } );

        if( !_isSeparatorAdded && response.marker >= 0 && response.marker <= response.endIndex ) {
            revisionRules.splice( response.marker, 0, separatorObject );
            response.totalFound += 1;
            _isSeparatorAdded = true;
        }
    }
    // To check if Global revision rule entry is applicable
    // Note : Global revision rule entry will be done only if it is the valid revision rule for opened structure.
    if( response && response.globalRevisionRule && !occContext.supportedFeatures.Awb0EnableUseDefaultRevisionRuleFeature ) {
        addGlobalRevisionRuleEntryIfApplicable( response, revisionRules, occContext );
    }
    return revisionRules;
};

export let evaluateStartIndexForRevisionRuleDataProvider = function( dp, occContext ) {
    if( dp.startIndex === 0 ) {
        return 0;
    }

    var isMarkerPresent = false;

    for( var i = 0; i < dp.viewModelCollection.loadedVMObjects.length; i++ ) {
        if( dp.viewModelCollection.loadedVMObjects[ i ].marker ) {
            isMarkerPresent = true;
            break;
        }
    }
    var extraObjectInList = 0;

    if( occContext.supportedFeatures.Awb0EnableUseGlobalRevisionRuleFeature ) {
        extraObjectInList += 1;
    }

    if( isMarkerPresent ) {
        extraObjectInList += 1;
    }
    return dp.viewModelCollection.loadedVMObjects.length - extraObjectInList;
};

export let applyRevisionRuleChange = function( eventData, occContext ) {
    var configContextVal = {
        configContext: {
            r_uid: eventData.revisionRule,
            useGlobalRevRule: eventData.useGlobalRevRule,
            var_uids: exports.evaluateVariantRuleUID( occContext ),
            iro_uid: null,
            de: null,
            ue: null,
            ei_uid: null,
            startFreshNavigation: true
        },
        transientRequestPref: {
            jitterFreePropLoad: true,
            userGesture: 'REVISION_RULE_CHANGE'
        }
    };

    //Close popup once state is updated
    popupService.hide();
    aceStructureConfigurationService.resetTreeOnConfigChange( configContextVal, occContext );
};

export let evaluateVariantRuleUID = function( occContext ) {
    if( occContext.supportedFeatures && occContext.supportedFeatures.Awb0NoVariantRuleResetFeature ) {
        return occContext.productContextInfo.props.awb0VariantRules.dbValues;
    }
    return null;
};

export let updateRevisionRule = function( eventData, data, occContext ) {
    if( occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ] && eventData.selectedObjects && eventData.selectedObjects.length > 0 ) {
        if( eventData.selectedObjects[ '0' ].marker >= 0 ) { // Handle Separator selected
            exports.selectRevisionRule( occContext, data.dataProviders.getRevisionRules );
        } else if( eventData.selectedObjects[ 0 ].uid === 'globalRevisionRuleEntry' && // Handle Global Revision Rule selected
            occContext.productContextInfo.props.awb0UseGlobalRevisionRule &&
            occContext.productContextInfo.props.awb0UseGlobalRevisionRule.dbValues[ 0 ] !== '1' ) {
            eventData.revisionRule = null;
            eventData.useGlobalRevRule = true;
            exports.setRevisionRule( {
                revisionRule: null,
                useGlobalRevRule: true,
                selectedObject: eventData.selectedObjects[ 0 ],
                viewKey: occContext.viewKey
            } );
        } else if( eventData.selectedObjects[ 0 ].uid !== 'globalRevisionRuleEntry' && // Handle Revision Rule selected
            ( eventData.selectedObjects[ 0 ].uid !== occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ] ||
                 occContext.productContextInfo.props.awb0UseGlobalRevisionRule &&
                    occContext.productContextInfo.props.awb0UseGlobalRevisionRule.dbValues[ 0 ] === '1'
            ) ) {
            eventData.revisionRule = eventData.selectedObjects[ 0 ].uid;
            eventData.useGlobalRevRule = null;
            exports.setRevisionRule( {
                revisionRule: eventData.selectedObjects[ 0 ].uid,
                useGlobalRevRule: null,
                selectedObject: eventData.selectedObjects[ 0 ],
                viewKey: occContext.viewKey
            } );
        }
    } else if( eventData.selectedObjects && eventData.selectedObjects.length === 0 && _.isEmpty( data.revRulefilterBox.dbValue ) ) {
        // Handle Current Revision rule selected, typing text into the filter box changes selection length to 0,
        // hence check if there is text, don't close popup
        popupService.hide();
    }
};

export let selectRevisionRule = function( occContext, dataprovider ) {
    if( dataprovider.viewModelCollection.loadedVMObjects.length > 0 ) {
        var indexOfCurrentRev = -1;
        if( occContext.productContextInfo.props.awb0UseGlobalRevisionRule && occContext.productContextInfo.props.awb0UseGlobalRevisionRule.dbValues[ 0 ] === '1' ) {
            indexOfCurrentRev = 0;
        } else {
            indexOfCurrentRev = dataprovider.viewModelCollection.loadedVMObjects
                .map( function( x ) {
                    return x.uid;
                } ).indexOf( occContext.productContextInfo.props.awb0CurrentRevRule.dbValues[ 0 ] );
        }
        //LCS-756783 - change the selection only if data provider selection is different, to avoid jumping behaviour
        if( indexOfCurrentRev >= 0 && dataprovider.getSelectedIndexes()[0] !== indexOfCurrentRev ) {
            dataprovider.changeObjectsSelection( indexOfCurrentRev,
                indexOfCurrentRev, true );
        }
    }
};

export let setRevisionRule = function( eventData ) {
    eventBus.publish( 'awConfigPanel.revisionRuleChanged', eventData );
};

export let updateCurrentRevisionRule = function( eventData ) {
    var currentRevisionRule = eventData.selectedObject.props.object_string;
    return { currentRevisionRule };
};

export let updateGlobalRevisionRule = function( occContext ) {
    if( occContext.supportedFeatures.Awb0EnableUseGlobalRevisionRuleFeature &&
        occContext.productContextInfo.props.awb0UseGlobalRevisionRule.dbValues[ 0 ] === '1' ) {
        var value = {
            configContext : {
                useGlobalRevRule: true,
                startFreshNavigation: true
            },
            transientRequestPref: {
                jitterFreePropLoad: true,
                userGesture: 'REVISION_RULE_CHANGE'
            }
        };
        occmgmtUtils.updateValueOnCtxOrState( '', value, occContext );
    }
};

/**
 * Launch the RevisionRuleAdminPanel
 *
 * @param {Object} data - The 'data' object from viewModel.
 */
export let launchRevisionRuleAdminPanel = function( data ) {
    var context = {
        destPanelId: 'RevisionRuleAdminPanel',
        title: _localeTextBundle.RevisionRuleAdmin,
        recreatePanel: true,
        supportGoBack: true,
        subPanelContext: data.subPanelContext

    };

    eventBus.publish( 'awPanel.navigate', context );
};

var loadConfiguration = () => {
    _localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );
};

loadConfiguration();

/**
 * Revision Rule Configuration service utility
 */

export default exports = {
    getInitialRevisionRuleConfigurationData,
    initializeRevRuleDescAndOverridenText,
    processRevisionRules,
    evaluateStartIndexForRevisionRuleDataProvider,
    applyRevisionRuleChange,
    evaluateVariantRuleUID,
    updateRevisionRule,
    selectRevisionRule,
    setRevisionRule,
    updateCurrentRevisionRule,
    populateRuleDateFeatureInfo,
    launchRevisionRuleAdminPanel,
    updateGlobalRevisionRule
};
