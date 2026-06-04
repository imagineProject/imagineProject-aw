// Copyright (c) 2022 Siemens

/**
 * @module js/aceToggleIndexConfigurationService
 */
import uwPropertyService from 'js/uwPropertyService';
import omStateHandler from 'js/occurrenceManagementStateHandler';
import localStorage from 'js/localStorage';
import eventBus from 'js/eventBus';

var exports = {};
var _LS_TOPIC = 'awAwbIndexOffList';

var _productContextInfo = null;
var _onConfigurationPanelCloseListener = null;
var _aceResetStructureStartedListener = null;

var populateSupportedFeaturesInfo = function( data ) {
    if( data && data.occmgmtIndexUpdateDateLabelText ) {
        data.occmgmtIndexUpdateDateLabelText.dbValue = omStateHandler
            .isFeatureSupported( 'Awb0FullTextSearchFeature' );
        data.isFullTextFeatureSupported = data.occmgmtIndexUpdateDateLabelText.dbValue;
    }
};

var convertIndexDateIntoVMProperty = function() {
    var indexDateVMProperty = uwPropertyService.createViewModelProperty(
        _productContextInfo.props.awb0IndexUpdateDate.dbValues[ 0 ],
        _productContextInfo.props.awb0IndexUpdateDate.uiValues[ 0 ], 'STRING',
        _productContextInfo.props.awb0IndexUpdateDate.dbValues[ 0 ], '' );
    indexDateVMProperty.uiValue = _productContextInfo.props.awb0IndexUpdateDate.uiValues[ 0 ];
    return indexDateVMProperty;
};

var getIndexDateFromProductContextInfo = function() {
    if( _productContextInfo ) {
        var currentIndexDateObject = _productContextInfo.props.awb0IndexUpdateDate;
        if( currentIndexDateObject ) {
            return convertIndexDateIntoVMProperty();
        }
    }
};

var populateIndexDate = function( data ) {
    if( data ) {
        var currentIndexDate = getIndexDateFromProductContextInfo();
        if( currentIndexDate ) {
            data.currentIndexDate = currentIndexDate;
        }
    }
};

var populateIndexUpdateDateLabel = function( data ) {
    if( data ) {
        data.occmgmtIndexUpdateDateLabelText.propertyDisplayName = data.i18n.occmgmtIndexUpdateDateLabelText +
            ' ' + data.currentIndexDate.uiValue;
    }
};

/**
 * Get Toggle Index Configuration Data
 */
export let getInitialToggleIndexConfigurationData = function( data, subPanelContext ) {
    if( data ) {
        registerListeners();
        _productContextInfo = subPanelContext.occContext.productContextInfo;
        if( _productContextInfo ) {
            populateSupportedFeaturesInfo( data );
            populateIndexDate( data );
            populateIndexUpdateDateLabel( data );
        }
    }
};

export let initialize = function() {
    startListeningToAceResetStructureStarted();
};

/**
 * Reset the toggle index configuration service - called when user navigates away from Content
 */
export let reset = function() {
    localStorage.removeItem( _LS_TOPIC );
    stopListeningToAceResetStructureStarted();
    unregisterListeners();
};

export let getIndexOffProductListInLocalStorage = function() {
    var indexOffStr = localStorage.get( _LS_TOPIC );
    if( indexOffStr ) {
        return JSON.parse( indexOffStr );
    }
    return [];
};

export let setIndexOffProductListInLocalStorage = function( indexOffProductInfoList ) {
    if( indexOffProductInfoList !== undefined && indexOffProductInfoList !== null ) {
        if( indexOffProductInfoList.length === 0 ) {
            exports.reset();
        } else {
            localStorage.publish( _LS_TOPIC, JSON.stringify( indexOffProductInfoList ) );
        }
    }
};

export let setIndexOffProductListInLocalStorageOnConfigurationChange = function( subPanelContext ) {
    var occContext = subPanelContext.occContext;
    if( occContext.configContext && occContext.configContext.useProductIndex === undefined &&
        occContext.configContext.packSimilarElements === undefined ) {
        if( !occContext.isOpenedUnderAContext ) {
            localStorage.removeItem( _LS_TOPIC );
        } else {
            var indexOffStr = localStorage.get( _LS_TOPIC );
            var productContentInfo = occContext.productContextInfo;
            if( indexOffStr && productContentInfo ) {
                var indexOffProductList = JSON.parse( indexOffStr );
                var index = indexOffProductList.indexOf( productContentInfo.uid );
                if( index > -1 ) {
                    indexOffProductList.splice( index, 1 );
                    if( indexOffProductList.lenght > 0 ) {
                        localStorage.publish( _LS_TOPIC, JSON.stringify( indexOffProductList ) );
                    } else {
                        localStorage.removeItem( _LS_TOPIC );
                    }
                }
            }
        }
    }
};

var startListeningToAceResetStructureStarted = function() {
    if( !_aceResetStructureStartedListener ) {
        _aceResetStructureStartedListener = eventBus.subscribe( 'ace.resetStructureStarted', function() {
            localStorage.removeItem( _LS_TOPIC );
        } );
    }
};

var stopListeningToAceResetStructureStarted = function() {
    if( _aceResetStructureStartedListener ) {
        eventBus.unsubscribe( _aceResetStructureStartedListener );
    }
};

var registerListeners = function() {
    startListeningToConfigurationPanelCloseEvent();
    startListeningToAceResetStructureStarted();
};

var unregisterListeners = function() {
    stopListeningToConfigurationPanelCloseEvent();
};

var stopListeningToConfigurationPanelCloseEvent = function() {
    if( _onConfigurationPanelCloseListener ) {
        eventBus.unsubscribe( _onConfigurationPanelCloseListener );
        _onConfigurationPanelCloseListener = null;
    }
};

var startListeningToConfigurationPanelCloseEvent = function() {
    if( !_onConfigurationPanelCloseListener ) {
        _onConfigurationPanelCloseListener = eventBus.subscribe( 'appCtx.register', function( eventData ) {
            if( eventData && eventData.name === 'activeNavigationCommand' ) {
                unregisterListeners();
            }
        }, 'aceToggleIndexConfigurationService' );
    }
};

/**
 * Toggle Index Configuration service utility
 */

export default exports = {
    getInitialToggleIndexConfigurationData,
    initialize,
    reset,
    getIndexOffProductListInLocalStorage,
    setIndexOffProductListInLocalStorage,
    setIndexOffProductListInLocalStorageOnConfigurationChange
};
