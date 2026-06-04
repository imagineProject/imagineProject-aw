// Copyright (c) 2022 Siemens

/**
 * @module js/Dependencies
 */
import ClipboardService from 'js/clipboardService';
import appCtxService from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';

let exports = {};

export let getDependencyCreateInput = () => {
    var newDependencies = [];
    var otherSideObjects = ClipboardService.instance.getContents();

    let selectedObjectNames = [];
    appCtxService.ctx.mselected.forEach( ( selectedObject ) => {
        otherSideObjects.forEach( ( otherSideObject ) => {
            if( cmm.isInstanceOf( 'ScheduleTask', otherSideObject.modelType ) ) {
                newDependencies.push( {
                    predTask: otherSideObject,
                    succTask: selectedObject,
                    depType: 0,
                    lagTime: 0
                } );
            } else {
                throw 'createDependencyErrorMsg';
            }
        } );
        selectedObjectNames.push( selectedObject.props.object_name.dbValues[ 0 ] );
    } );

    let otherSideObjectNames = [];
    otherSideObjects.forEach( ( object ) => {
        otherSideObjectNames.push( object.props.object_name.dbValues[ 0 ] );
    } );

    var allSelectedObjNames = selectedObjectNames.join( '", "' );
    var allOtherSideObjNames = otherSideObjectNames.join( '", "' );

    return {
        newDependencies: newDependencies,
        selectedObjectNames: allSelectedObjNames,
        otherSideObjectNames: allOtherSideObjNames
    };
};

exports = {
    getDependencyCreateInput
};

export default exports;
