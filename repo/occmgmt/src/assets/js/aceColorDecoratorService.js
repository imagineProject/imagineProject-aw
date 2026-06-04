// Copyright (c) 2022 Siemens

/**
 * @module js/aceColorDecoratorService
 */
import appCtxSvc from 'js/appCtxService';
import colorDecoratorService from 'js/colorDecoratorService';
import soa_kernel_soaService from 'soa/kernel/soaService';
import soa_preferenceService from 'soa/preferenceService';
import eventBus from 'js/eventBus';

var exports = {};

var _coloToggleSubscription = null;

export let initializeColorDecors = function() {
    _coloToggleSubscription = eventBus.subscribe( 'condition.valueChanged', function( event ) {
        if( event.condition === 'conditions.isColorFilterSuported' ) {
            appCtxSvc.updatePartialCtx( 'supportsColorToggleCommand', event.newValue );
            if( event.newValue === false ) {
                appCtxSvc.updatePartialCtx( 'decoratorToggle', false );
            } else if( !( appCtxSvc.ctx.splitView && appCtxSvc.ctx.splitView.mode ) ) {
                soa_preferenceService.getStringValue( 'AWC_ColorFiltering' ).then( function( prefValue ) {
                    if( prefValue === 'true' ) {
                        appCtxSvc.updatePartialCtx( 'decoratorToggle', true );
                    }
                } );
            }
        }
    } );
};

export let destroyColorDecors = function() {
    eventBus.unsubscribe( _coloToggleSubscription );
    appCtxSvc.updatePartialCtx( 'supportsColorToggleCommand', false );
};

export let isChartColor1applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor1' );
};

export let isChartColor2applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor2' );
};

export let isChartColor3applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor3' );
};

export let isChartColor4applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor4' );
};

export let isChartColor5applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor5' );
};

export let isChartColor6applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor6' );
};

export let isChartColor7applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor7' );
};

export let isChartColor8applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor8' );
};

export let isChartColor9applicable = function( vmo ) {
    return isChartColorapplicable( vmo, 'aw-charts-chartColor9' );
};

var isChartColorapplicable = function( vmo, className ) {
    if( appCtxSvc.ctx.aceActiveContext.context && appCtxSvc.ctx.aceActiveContext.context.groupedObjectsList ) {
        var groupedObjectsList = appCtxSvc.ctx.aceActiveContext.context.groupedObjectsList[ 0 ];
        if( groupedObjectsList.groupedObjectsMap && groupedObjectsList.groupedObjectsMap.length > 0 ) {
            for( var key in groupedObjectsList.groupedObjectsMap[ 0 ] ) {
                if( vmo.uid === groupedObjectsList.groupedObjectsMap[ 0 ][ key ].uid ) {
                    if( className === groupedObjectsList.groupedObjectsMap[ 1 ][ key ][ 0 ] ) {
                        return true;
                    }
                }
            }
        }
    }
    return false;
};

/**
 * @param {ViewModelObject|ViewModelObjectArray} vmo - ViewModelObject(s) to set style on.
 */
export let setDecoratorStyles = function( vmos ) {
    for( var key in vmos ) {
        vmos[ key ].cellDecoratorStyle = '';
        vmos[ key ].gridDecoratorStyle = '';
    }
    colorDecoratorService.setDecoratorStyles( vmos );
};

/**
 * @param {ViewModelObjectArray} vmos - ViewModelObject(s) to set style on.
 */
export let groupObjectsByProperties = function( vmos ) {
    if( appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory && !( appCtxSvc.ctx.splitView && appCtxSvc.ctx.splitView.mode ) ) {
        var propertyValues = JSON.parse( JSON.stringify( appCtxSvc
            .getCtx( 'aceActiveContext.context.currentSelectedCatogory.propGroupingValues' ) ) );
        var propValues = propertyValues.filter( function( props ) {
            delete props.colorValue;
            return true;
        } );
        var input = {
            objectPropertyGroupInputList: [ {
                internalPropertyName: appCtxSvc.ctx.aceActiveContext.context.currentSelectedCatogory.internalPropertyNameToGroupOn,
                objectList: vmos,
                propertyValues: propValues
            } ]
        };
        soa_kernel_soaService.postUnchecked( 'Query-2014-11-Finder', 'groupObjectsByProperties', input ).then(
            function( response ) {
                if( response && response.groupedObjectsList ) {
                    appCtxSvc.updatePartialCtx( 'aceActiveContext.context.groupedObjectsList',
                        response.groupedObjectsList );
                    exports.setDecoratorStyles( vmos );
                }
            } );
    }
};

export default exports = {
    initializeColorDecors,
    destroyColorDecors,
    isChartColor1applicable,
    isChartColor2applicable,
    isChartColor3applicable,
    isChartColor4applicable,
    isChartColor5applicable,
    isChartColor6applicable,
    isChartColor7applicable,
    isChartColor8applicable,
    isChartColor9applicable,
    setDecoratorStyles,
    groupObjectsByProperties
};
