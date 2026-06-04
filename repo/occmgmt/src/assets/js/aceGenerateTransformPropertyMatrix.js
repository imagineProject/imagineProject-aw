// Copyright (c) 2024 Siemens

/**
 * generate 4*4 transformation matrix
 * UI popup to show 6 values as input - Rotation- x,y,z and Transformation x,y,z
 * compose - decompose matrix based on user inputs using three-js/three library
 *
 * @module js/aceGenerateTransformPropertyMatrix
 * @requires app
 */

import _ from 'lodash';
import { DOMAPIs as dom } from 'js/domUtils';
import { popupService } from 'js/popupService';
import localeService from 'js/localeService';
import popuputils from 'js/popupUtils';
import eventBus from 'js/eventBus';

import THREE from 'three-js/three';
window.THREE = THREE;

var _popupRef;
var _sideNavEventSub;
var _locationCompleteEventSub;
var bomAdapter = 'AWBCB';

function doubleToFloat32( n ) {
    const float32Array = new Float32Array( 1 ); // 32-bit float array
    float32Array[0] = n; // Assign the double value
    return float32Array[0]; // JavaScript automatically truncates precision
}

function roundTo( num, decimalPlaces = 5 ) {
    const factor = 10 ** decimalPlaces;
    return Math.round( num * factor ) / factor;
}

function getEditTransformTitle() {
    var editTransformTitle = null;
    var localTextBundle = localeService.getLoadedText( 'OccurrenceManagementConstants' );
    if( localTextBundle ) {
        editTransformTitle = localTextBundle.editTransformTitle;
    }
    return editTransformTitle;
}

const checkElement = ( selector ) => {
    let el = dom.get( selector );
    return el && el.offsetHeight > 0 && el.offsetWidth > 0;
};

/**
 * @param { Object } vmo - ViewModelObject for which Transform is being rendered
 * @param { Object } containerElem - The container DOM Element inside which Transform will be rendered
  */
export let generateAwb0TransformRendererFn = function( vmo, containerElem, transformProperty ) {
    var objectUid = vmo.uid;
    let transform = transformProperty === 'awb0Transform' ? vmo.props.awb0Transform : transformProperty === 'awb0RelativeTransform' ? vmo.props.awb0RelativeTransform : null;
    if ( vmo.uid.endsWith( bomAdapter ) ) {
        let blTransform = transformProperty === 'awb0Transform' ? 'bl_plmxml_abs_xform' : transformProperty === 'awb0RelativeTransform' ? 'bl_plmxml_occ_xform' : null;
        // Add click event to open the Transform property widget
        containerElem.addEventListener( 'click', function() {
            _.defer( function() {
                let selectedObject = vmo;
                selectedObject.props.transform = transform;
                var context = {
                    sourceObject: vmo,
                    selectedObject: selectedObject,
                    blTransform: blTransform
                };
                showTransformPopup( context );
                updateHeight();
            } );
        }, objectUid );
    }
};

export let updateHeight = function() {
    if ( _popupRef && _popupRef.panelEl ) {
        const workarea = document.getElementsByClassName( 'aw-layout-workarea' );
        if ( workarea.length > 0 ) {
            setTimeout( function() {
                let el = dom.get( 'div.sw-popup-contentContainer', _popupRef.panelEl );
                if ( el ) {
                    el.style.maxHeight = document.getElementsByClassName( 'aw-layout-workarea' )[0].offsetHeight + 'px';
                }
            }, 2000 );
        }

        let popupC = popuputils.getContainerElement( _popupRef.panelEl );
        // eslint-disable-next-line sonarjs/no-collapsible-if
        if ( popupC && popupC.style && popupC.style.maxHeight === '' ) {
            if ( workarea.length > 0 ) {
                popupC.style.maxHeight = workarea[0].offsetHeight + 'px';
            }
        }
    }
};

/**
 * @param { Object } context - ViewModelObject for which Transform is being rendered
 */
export let showTransformPopup = function( context ) {
    if ( !_popupRef || !_popupRef.panelEl ) {
        // The create transform popup configuration object
        let popupOptions = {
            view: 'AceEditTransformPopup',
            anchor: 'awb0_edit_transform_popup',
            reference: '.sw-order-three',
            placement: 'left-end',
            draggable: true,
            clickOutsideToClose: true,
            disableClose: false,
            detachMode: true,
            caption: getEditTransformTitle(),
            styleObj: {
                width: '320px'
            }
        };

        let finalOptions = { ...popupOptions };
        if ( context ) {
            popupOptions.subPanelContext = context;
        }

        var ref = '#aw_toolsAndInfo';
        if ( checkElement( ref ) ) {
            finalOptions.reference = ref;
        }

        const workareaSec = document.getElementsByClassName( 'aw-layout-workarea' );
        if ( workareaSec.length > 0 ) {
            popupOptions.styleObj.maxHeight = workareaSec[0].offsetHeight + 'px';
        }
        popupService.show( _.cloneDeep( popupOptions ) ).then( function( popupRef ) {
            _popupRef = popupRef;
            _sideNavEventSub = eventBus.subscribe( 'awsidenav.openClose', function( eventData ) {
                if ( eventData && eventData.id === 'aw_toolsAndInfo' ) {
                    setTimeout( function() {
                        exports.updatePopupPosition();
                    }, 50 );
                }
            } );

            _locationCompleteEventSub = eventBus.subscribe( 'LOCATION_CHANGE_COMPLETE', function() {
                setTimeout( function() {
                    exports.updatePopupPosition();
                }, 50 );
            } );
        } );
    } else {
        exports.unRegisterEventsAndClosePopup();
    }
};

/**
 * unSubscribe Events
 */
export let unRegisterEventsAndClosePopup = function() {
    _.defer( function() {
        eventBus.unsubscribe( _sideNavEventSub );
        eventBus.unsubscribe( _locationCompleteEventSub );
        popupService.hide( _popupRef );
    } );
};

/**
 * Update Popup position
 */
export let updatePopupPosition = function() {
    let ref = '#aw_toolsAndInfo';
    if ( !checkElement( ref ) ) {
        ref = '.sw-order-three';
    }
    let referenceEl = dom.get( ref );
    if ( referenceEl ) {
        var options = _popupRef.options;
        options.userOptions.reference = ref;
        options.reference = referenceEl;
        options.disableUpdate = false;
        popupService.update( _popupRef );
    }
};

// The composeMatrix using three-js/three library
export let composeMatrix = function( data ) {
    let newdata = { ...data };

    // Transform values
    let tx = doubleToFloat32( newdata.a30.dbValue );
    let ty = doubleToFloat32( newdata.a31.dbValue );
    let tz = doubleToFloat32( newdata.a32.dbValue );

    // Rotation values
    let xRotation = doubleToFloat32( THREE.Math.degToRad( newdata.rotateX.dbValue ) );
    let yRotation = doubleToFloat32( THREE.Math.degToRad( newdata.rotateY.dbValue ) );
    let zRotation = doubleToFloat32( THREE.Math.degToRad( newdata.rotateZ.dbValue ) );

    // Scale values
    let scaleX = doubleToFloat32( newdata.scaleX.dbValue );
    let scaleY = doubleToFloat32( newdata.scaleY.dbValue );
    let scaleZ = doubleToFloat32( newdata.scaleZ.dbValue );

    // Create a new matrix4 object
    const matrix = new THREE.Matrix4();

    // THREE js uses default rotation order as 'XYZ'
    // TcViz is using the rotation order as 'ZYX'
    // We need to have consistency with TcViz so overriding the default and using the TcViz order of rotation
    const euler = new THREE.Euler( xRotation, yRotation, zRotation, 'ZYX' );

    // Compose the matrix with a translation, rotation, and scale
    // Scale is fixed
    matrix.compose( new THREE.Vector3( tx, ty, tz ), new THREE.Quaternion().setFromEuler( euler ), new THREE.Vector3( scaleX, scaleY, scaleZ ) );

    newdata.a00.dbValue = matrix.elements[0];
    newdata.a01.dbValue =  matrix.elements[1];
    newdata.a02.dbValue =  matrix.elements[2];
    newdata.a03.dbValue =  matrix.elements[3];

    newdata.a10.dbValue = matrix.elements[4];
    newdata.a11.dbValue = matrix.elements[5];
    newdata.a12.dbValue = matrix.elements[6];
    newdata.a13.dbValue = matrix.elements[7];

    newdata.a20.dbValue = matrix.elements[8];
    newdata.a21.dbValue = matrix.elements[9];
    newdata.a22.dbValue = matrix.elements[10];
    newdata.a23.dbValue = matrix.elements[11];

    newdata.a30.dbValue = roundTo( matrix.elements[12] );
    newdata.a31.dbValue = roundTo( matrix.elements[13] );
    newdata.a32.dbValue = roundTo( matrix.elements[14] );
    newdata.a33.dbValue = matrix.elements[15];

    // Return the matrix.
    return newdata;
};

// The deComposeMatrix using three-js/three library
export let deComposeMatrix = function( data, subPanelContext ) {
    let newdata = { ...data };
    if( newdata.a00.dbValue === '' ) {
        return newdata;
    }

    newdata.a30.dbValue = subPanelContext.selectedObject.props.transform.dbValues[12];
    newdata.a31.dbValue = subPanelContext.selectedObject.props.transform.dbValues[13];
    newdata.a32.dbValue = subPanelContext.selectedObject.props.transform.dbValues[14];

    // Create a new matrix4 object
    const matrix = new THREE.Matrix4();
    matrix.elements[0] = newdata.a00.dbValue;
    matrix.elements[1] = newdata.a01.dbValue;
    matrix.elements[2] = newdata.a02.dbValue;
    matrix.elements[3] = newdata.a03.dbValue;

    matrix.elements[4] = newdata.a10.dbValue;
    matrix.elements[5] = newdata.a11.dbValue;
    matrix.elements[6] = newdata.a12.dbValue;
    matrix.elements[7] = newdata.a13.dbValue;

    matrix.elements[8] = newdata.a20.dbValue;
    matrix.elements[9] = newdata.a21.dbValue;
    matrix.elements[10] = newdata.a22.dbValue;
    matrix.elements[11] = newdata.a23.dbValue;

    matrix.elements[12] = newdata.a30.dbValue;
    matrix.elements[13] = newdata.a31.dbValue;
    matrix.elements[14] = newdata.a32.dbValue;
    matrix.elements[15] = newdata.a33.dbValue;

    // Decompose the matrix into its position, quaternion, and scale components
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    matrix.decompose( position, quaternion, scale );

    newdata.a30.dbValue = roundTo( position.x );
    newdata.a31.dbValue = roundTo( position.y );
    newdata.a32.dbValue = roundTo( position.z );

    // THREE js uses default rotation order as 'XYZ'
    // TcViz is using the rotation order as 'ZYX'
    // We need to have consistency with TcViz so overriding the default and using the TcViz order of rotation
    const euler = new THREE.Euler().setFromQuaternion( quaternion, 'ZYX' );
    newdata.rotateX.dbValue = roundTo( THREE.Math.radToDeg( euler.x ) );
    newdata.rotateY.dbValue = roundTo( THREE.Math.radToDeg( euler.y ) );
    newdata.rotateZ.dbValue = roundTo( THREE.Math.radToDeg( euler.z ) );

    newdata.scaleX.dbValue = roundTo( scale.x );
    newdata.scaleY.dbValue = roundTo( scale.y );
    newdata.scaleZ.dbValue = roundTo( scale.z );

    // Return the matrix.
    return newdata;
};

const exports = {
    generateAwb0TransformRendererFn,
    unRegisterEventsAndClosePopup,
    updatePopupPosition,
    composeMatrix,
    deComposeMatrix,
    updateHeight,
    showTransformPopup
};

export default exports;
