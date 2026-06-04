// Copyright (c) 2024 Siemens

/**
 * This module provides methods to access orientations
 *
 * @module js/viewerOrientationService
 */
import _ from 'lodash';
let exports = {};

/**
 * List of various viewer orientations
 */
let viewOrientationList = {
    LEFT: 'PlusX',
    FRONT: 'PlusY',
    BOTTOM: 'PlusZ',
    RIGHT: 'MinusX',
    BACK: 'MinusY',
    TOP: 'MinusZ',
    ISOMETRIC: 'PlusIsometric',
    TRIMETRIC: 'MinusIsometric'
};

/**
 * Standard viewer orientation
 */
let STD_VIEWER_ORIENTATION = {
    AUTOMOTIVE:{
        TOP:'-Z',
        FRONT:'+X',
        LEFT:'+Y'
    },
    AEROSPACE:{
        TOP:'-Y',
        FRONT:'-Z',
        LEFT:'-X'
    }
};

/**
 * Parse data from
 * @param {Object} data orientation data from std view preferences
 */
let setCustomOrientaionData = function( data ) {
    STD_VIEWER_ORIENTATION.CUSTOM = data;
};

/**
 * Sets Viewer orienation
 * @param {String} viewerOrientation viewer orienation
 * @param {Object} viewerContextData viewer context data
 */
let setViewerOrientation = function( viewerOrientation, viewerContextData ) {
    if( _.isString( viewerOrientation ) ) {
        viewerOrientation = viewerOrientation.toUpperCase();
    }
    let orientation = STD_VIEWER_ORIENTATION[viewerOrientation];
    if( orientation ) {
        for( const key of Object.keys( orientation ) ) {
            parseOrientations( key, orientation[key] );
        }
        if( viewerContextData ) {
            viewerContextData.getDrawTrislingManager().setNavCubeFaces( getStdOrientationCamera( viewerOrientation ) );
        }
    }
};

/**
 * Parses preferences string to list
 *
 * @param {String} cameraDirection Camera direction against orientation is to be set in list.
 * @param {String} mapping Orientation value as per the preference.
 */
let parseOrientations = function( cameraDirection, mapping ) {
    if( mapping ) {
        let cameraOrientation = parseCam( mapping );
        if( null !== cameraOrientation ) {
            accessOrientationList( false, cameraDirection, cameraOrientation );
            accessOrientationList( false, getOppositeDirection( cameraDirection ), parseCamOpposite( mapping ) );
        }
    }
};

/**
 * To update/access list based on the camera direction and value of orientation provided.
 * if fetchValue is set, it would return the value of orientation.
 *
 * @param {Boolean} fetchValue fetch value
 * @param {String} camDirection camera direction
 * @param {String} mapping mapping
 *
 * @returns {String} returns type of orientation
 */
let accessOrientationList = function( fetchValue, camDirection, mapping ) {
    if( _.isString( camDirection ) ) {
        camDirection = camDirection.toUpperCase();
    }
    if( camDirection === 'LEFT' ) {
        if( fetchValue ) {
            return viewOrientationList.LEFT;
        }
        viewOrientationList.LEFT = mapping;
    } else if( camDirection === 'RIGHT' ) {
        if( fetchValue ) {
            return viewOrientationList.RIGHT;
        }
        viewOrientationList.RIGHT = mapping;
    } else if( camDirection === 'TOP' ) {
        if( fetchValue ) {
            return viewOrientationList.TOP;
        }
        viewOrientationList.TOP = mapping;
    } else if( camDirection === 'BOTTOM' ) {
        if( fetchValue ) {
            return viewOrientationList.BOTTOM;
        }
        viewOrientationList.BOTTOM = mapping;
    } else if( camDirection === 'FRONT' ) {
        if( fetchValue ) {
            return viewOrientationList.FRONT;
        }
        viewOrientationList.FRONT = mapping;
    } else if( camDirection === 'ISOMETRIC' ) {
        if( fetchValue ) {
            return viewOrientationList.ISOMETRIC;
        }
        viewOrientationList.ISOMETRIC = mapping;
    } else if( camDirection === 'TRIMETRIC' ) {
        if( fetchValue ) {
            return viewOrientationList.TRIMETRIC;
        }
        viewOrientationList.TRIMETRIC = mapping;
    } else if( camDirection === 'BACK' ) {
        if( fetchValue ) {
            return viewOrientationList.BACK;
        }
        viewOrientationList.BACK = mapping;
    }
};

/**
 * Returns opposite camera direction.
 *
 * @param {String} cameraDirection Input camera direction e.g. FRONT, BACK
 * @returns {String} Opposite camera direction based on input.
 */
let getOppositeDirection = function( cameraDirection ) {
    let camDirection = null;
    if( cameraDirection === 'TOP' ) {
        camDirection = 'BOTTOM';
    } else if( cameraDirection === 'LEFT' ) {
        camDirection = 'RIGHT';
    } else if( cameraDirection === 'FRONT' ) {
        camDirection = 'BACK';
    }
    return camDirection;
};

/**
 * Parses string to opposite cameraOrientation
 *
 * @param {String} orientation Orientation whose oppsite value is desired.
 * @returns {String} Valid opposite orientation based on preference orientation.
 */
let parseCamOpposite = function( orientation ) {
    let camOrientation = null;
    if( _.isString( orientation ) ) {
        orientation = orientation.toUpperCase();
    }
    if( orientation === '+X' ) {
        camOrientation = 'MinusX';
    } else if( orientation === '-X' ) {
        camOrientation = 'PlusX';
    } else if( orientation === '+Y' ) {
        camOrientation = 'MinusY';
    } else if( orientation === '-Y' ) {
        camOrientation = 'PlusY';
    } else if( orientation === '+Z' ) {
        camOrientation = 'MinusZ';
    } else if( orientation === '-Z' ) {
        camOrientation = 'PlusZ';
    }
    return camOrientation;
};

/**
 * Parses string to cameraOrientation
 *
 * @param {String} orientation Orientation whose relevant value is desired.
 * @returns {String} Valid orientation value.
 */
let parseCam = function( orientation ) {
    let camOrientation = null;
    if( _.isString( orientation ) ) {
        orientation = orientation.toUpperCase();
    }
    if( orientation === '+X' ) {
        camOrientation = 'PlusX';
    } else if( orientation === '-X' ) {
        camOrientation = 'MinusX';
    } else if( orientation === '+Y' ) {
        camOrientation = 'PlusY';
    } else if( orientation === '-Y' ) {
        camOrientation = 'MinusY';
    } else if( orientation === '+Z' ) {
        camOrientation = 'PlusZ';
    } else if( orientation === '-Z' ) {
        camOrientation = 'MinusZ';
    }
    return camOrientation;
};

/**
 * Provides orientation value based on the camera direction provided.
 *
 * @param {String} camDirection Camera direction selected to cause orientation.
 * @return {String} Orientation value.
 */
let getViewOrientation = function( camDirection ) {
    return accessOrientationList( true, camDirection );
};

let getStdOrientationCamera = ( viewerOrientation )=>{
    let stdViewOrientation = {};
    if( _.isString( viewerOrientation ) ) {
        viewerOrientation = viewerOrientation.toUpperCase();
    }
    let orientation = STD_VIEWER_ORIENTATION[viewerOrientation];
    if( orientation ) {
        if( parseCam( orientation.TOP ) ) {
            stdViewOrientation.top = parseCam( orientation.TOP  );
        }
        if( parseCam( orientation.LEFT  ) ) {
            stdViewOrientation.left = parseCam( orientation.LEFT );
        }
        if( parseCam( orientation.FRONT ) ) {
            stdViewOrientation.front = parseCam( orientation.FRONT );
        }
    }
    return stdViewOrientation;
};

export default exports = {
    getViewOrientation,
    parseOrientations,
    parseCam,
    setViewerOrientation,
    setCustomOrientaionData,
    getStdOrientationCamera
};
