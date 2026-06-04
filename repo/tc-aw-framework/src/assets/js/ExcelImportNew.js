// Copyright (c) 2023 Siemens

/**
 * Module for the Import Specification panel
 *
 * @module js/ExcelImportNew
 */

import AwPromiseService from 'js/awPromiseService';
import AwHttpService from 'js/awHttpService';
import uwPropertyService from 'js/uwPropertyService';
import cdm from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import notyService from 'js/NotyModule';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import browserUtils from 'js/browserUtils';
import iconService from 'js/iconService';

var exports = {};
var parentData = {};

var ADD_NEW_INTERNAL = 'add_new';

var REQ_NOT_IN_SPEC = 'Requirements (Not in a specification)';

// var microServiceURLStringForWord = 'sd/REQIMPORT/v1/api/import/importdocument';
// var microServiceURLStringForPDF = 'sd/REQIMPORTPDF/v1/api/import/importdocument';
var _importPreviewData = null;
var _existingStructureJSONData = null;
var _selectedRequidForAddChildPreview = null;
var _selectedTCObject = null;
var TC_MICRO_PREFIX = 'sd';
var RM_COMPARE_HTML = '/req_compare/v1/compare/html';
var _previewElement = null;
var _htmlDataForExistingSpec = null;
var _treeData = null;
let _previewInitiator = '';
var vmNodeArray = [];
var specName;
var specId;
var clickEventAdded = false;
/**
 * The FMS proxy servlet context. This must be the same as the FmsProxyServlet mapping in the web.xml
 */
var WEB_XML_FMS_PROXY_CONTEXT = 'fms';
const EXISTING_LENGTH = 1;
/**
 * Relative path to the FMS proxy download service.
 */
var CLIENT_FMS_DOWNLOAD_PATH = WEB_XML_FMS_PROXY_CONTEXT + '/fmsdownload/?ticket=';
// mapp creates a map using unique id
let mapp = new Map();
let version1 = [];
let version2 = [];
let p1 = new Map();
let p2 = new Map();
//Empty Object for Object Comparison
let _blankObj = {};
let html2 = '';
let html1 = '';

/**
 * Unregister the import related data
 */
export let unregisterImportRelatedCtx = function() {
    // if( appCtxSvc.ctx.isArm0ImportFromWordSubPanelActive ) {
    //     appCtxSvc.unRegisterCtx( 'isArm0ImportFromWordSubPanelActive' );
    // }
    // if( appCtxSvc.ctx.isArm0ImportFromPDFSubPanelActive ) {
    //     appCtxSvc.unRegisterCtx( 'isArm0ImportFromPDFSubPanelActive' );
    // }
    if( appCtxSvc.ctx.isArm0ExcelImportSub2PanelActive ) {
        appCtxSvc.unRegisterCtx( 'isExcelImportSub2PanelActive' );
    }
    // if( appCtxSvc.ctx.isArm0ImportFromReqIFSubPanelActive ) {
    //     appCtxSvc.unRegisterCtx( 'isArm0ImportFromReqIFSubPanelActive' );
    // }
};

/**
 * Updates view model according to file selected
 * @param {Object} fileData - Data of selected file
 * @param {Object} data - The view model data
 *
 */
export let registerCtxforImport = function( data ) {
    const cloneData = _.cloneDeep( data );
    if( data.fileExt !== '' ) {
        unregisterImportRelatedCtx();
        var filext = data.fileExt;
        if( filext ) {
            if( filext === 'xlsx' || filext === 'xlsm' ) {
                appCtxSvc.registerCtx( 'isArm0ExcelImportSub2PanelActive', true );
            }
        }
    }
    return cloneData;
};

/**
 * returns a Json object after deleting all its children objects
 * @param {Object} object -object Json object
 * @returns {Object} obj2 - Json object after deleting children
 */
function alone( object ) {
    let obj2 = Object.assign( {}, object );
    // obj2.id=obj2.uniqueId;
    delete obj2.children;
    return obj2;
}

/**
 * gets header tag for Json object
 * @param {String} obj - header string
 * @returns {String} - header tag
 */
function getHeaderTag( obj ) {
    var headerTag = obj.styleName.split( ' ' )[ 1 ];
    if( headerTag === undefined ) {
        return 'h1';
    }
    return 'h' + headerTag;
}

/**
 * Set existing structures JSON data to service for rendering Preview
 * @param {Object} v - the arraylist which is to be populated
 * @param {Object} p - map for obejct and its parent
 * @param {Object} parent - parent object
 * @param {Object} object - Json object
 * @param {Object} flg -
 * @param {Object} index -
 */
function depthFirstSearch( v, p, parent, object, flg, index ) {
    let temp = alone( object );
    temp.parent = parent.uniqueId;
    object.numOfChildren = object.children.length;
    if( temp.name !== '' && p.size !== 0 ) {
        var h = getHeaderTag( temp );
        if( flg === 1 ) { html1 += '<' + h + ' id=\'' + temp.uniqueId + '\'>' + temp.name + '</' + h + '>'; } else {
            html2 += '<' + h + ' id=\'' + temp.uniqueId + '\'>' + temp.name + '</' + h + '>';
        }
    }
    mapp.set( temp.uniqueId, temp );
    v.push( temp );
    p.set( temp, parent );
    if( temp.hasOwnProperty( 'contents' ) && temp.contents !== '' && p.size !== 0 ) {
        if( flg === 1 ) { html1 += '<div>' + temp.contents; } else {
            html2 += '<div>' + temp.contents;
        }
    }
    for( let i = 0; i < object.numOfChildren; i++ ) {
        depthFirstSearch( v, p, temp, object.children[ i ], flg, i );
    }
    if( temp.hasOwnProperty( 'contents' ) && temp.contents !== '' && p.size !== 0 ) {
        if( flg === 1 ) { html1 += '</div>'; } else {
            html2 += '</div>';
        }
    }
    return;
}
/**
 * creates an array of matched object for two Json data
 * @param {Object} v - Existing structure's JSON data
 * @param {Object} object - New json data
 * @returns {Object} - Matched array object
 */
function matchList( v, object ) {
    let l1 = [];
    var item;
    for( item in v ) {
        if( v[ item ].hasOwnProperty( 'name' ) && v[ item ].name === object.name ) {
            l1.push( v[ item ] );
        }
    }
    return l1;
}

// /**
//  * @param {String} data - data
//  * @param {String} version1 - Existing structure's JSON data
//  * @param {String} version2 - New structure's JSON data
//  */
// function compareTree( data, version1, version2 ) {
//     var each;
//     uniqueIdMap = new Map();
//     let output = [];
//     for( each in version2 ) {
//         let l1 = matchList( version1, version2[ each ] );
//         let flag = false;
//         for( let i = 0; i < l1.length; i++ ) {
//             let n1 = version2[ each ];
//             let n2 = l1[ i ];
//             var old = n2;
//             var nxt = n1;
//             while( p1.get( n2 ) && p2.get( n1 ) && p2.get( n1 ).hasOwnProperty( 'name' ) && p1.get( n2 ).hasOwnProperty( 'name' ) && p2.get( n1 ).name === p1.get( n2 ).name && p2.get( n1 ).internalType
//                 .split( ' ' )[ 0 ] === p1.get( n2 ).internalType.split( ' ' )[ 0 ] ) {
//                 n1 = p2.get( n1 );
//                 n2 = p1.get( n2 );
//             }
//             n1 = p2.get( n1 );
//             n2 = p1.get( n2 );
//             if( n1 === _blankObj && n2 === _blankObj ) {
//                 flag = true;
//                 // check if contents are modifed, if yes call compare microservice to compare html contents
//                 var isBlank = false;
//                 if( old.contents === '<p>&nbsp;</p>' && version2[ each ].contents === '' ) {
//                     isBlank = true;
//                     mapp.set( old.uniqueId, nxt );
//                     uniqueIdMap.set( version2[ each ].uniqueId, old.uniqueId );
//                 }
//                 if( old.contents !== version2[ each ].contents && !isBlank ) {
//                     mapp.set( old.uniqueId, nxt );
//                     uniqueIdMap.set( version2[ each ].uniqueId, old.uniqueId );
//                     // modified
//                     updateObjects( output, old, each );
//                     let index = version1.indexOf( l1[ i ] );
//                     if( index > -1 ) {
//                         version1.splice( index, 1 );
//                     }
//                 } else {
//                     if ( _getItemType( old.internalType ) === version2[each].internalType ) {
//                         mapp.set( old.uniqueId, nxt );
//                         noChangeObjects( output, old, each );
//                         let index = version1.indexOf( l1[ i ] );
//                         if( index > -1 ) {
//                             version1.splice( index, 1 );
//                         }
//                     } else {
//                         flag = false;
//                         //Add and Delete
//                     }
//                 }
//                 break;
//             }
//         }
//         addV2Objects( output, each, flag );
//     }
//     deleteV1Objects( output );
//     updateChildParentRelation( output );
//     var output1 = mapp.get( output[ 0 ].reqobject.uniqueId );
//     data.searchResults1.htmlContents = html2;
//     data.comparedData = data.searchResults;
//     data.comparedData.children = output1.children;
//     version1 = [];
//     version2 = [];
//     p1 = new Map();
//     p2 = new Map();
//     return;
// }

/**
 *
 * @param {*} output - compared output JSON data
 * @param {*} old - old JSON object from Version1 Array
 * @param {*} each - loop Variable
 */
function noChangeObjects( output, old, each ) {
    uniqueIdMap.set( version2[ each ].uniqueId, old.uniqueId );
    version2[ each ].isTC = 'Yes';
    version2[ each ].status = 'NoChange';
    version2[ each ].contentChange = 'No';
    version2[ each ].internalType = old.internalType;
    version2[each].type = old.type;
    version2[ each ].displayType = old.displayType;
    if( old.properties && old.properties.length > 0 ) {
        for( let index = 0; index < old.properties.length; index++ ) {
            if( old.properties[index].name === 'release_status_list' && old.properties[index].value ) {
                version2[each].releaseStatusValue = old.properties[index].value;
                break;
            }
        }
    }
    output.push( {
        reqobject: version2[ each ],
        action: 'NoChange'
    } );
}

/**
 *
 * @param {*} output - compared output JSON data
 * @param {*} old - old JSON object from Version1 Array
 * @param {*} each - loop Variable
 */
function updateObjects( output, old, each ) {
    version2[ each ].isTC = 'Yes';
    version2[ each ].status = 'Update';
    version2[ each ].contentChange = 'Yes';
    var content1 = old.contents;
    var content2 = version2[ each ].contents;
    version2[ each ].internalType = old.internalType;
    version2[each].type = old.type;
    version2[ each ].displayType = old.displayType;
    if( old.properties && old.properties.length > 0 ) {
        for( let index = 0; index < old.properties.length; index++ ) {
            if( old.properties[index].name === 'release_status_list' && old.properties[index].value ) {
                version2[ each ].status = 'Revise';
                version2[each].releaseStatusValue = old.properties[index].value;
                break;
            }
        }
    }
    _compareHtml( content1, content2, version2[ each ] );
    output.push( {
        reqobject: version2[ each ],
        action: version2[ each ].status
    } );
}

/**
 * Adding Object from Version2 Array to Output Array
 * For Added Object
 *
 * @param {Object} output - compared output JSON data
 * @param {String} each - loop Variable
 * @param {String} flag - to check the Action
 */
function addV2Objects( output, each, flag ) {
    if( !flag ) {
        version2[ each ].isTC = 'No';
        version2[ each ].status = 'Add';
        version2[ each ].contentChange = 'No';
        output.push( {
            reqobject: version2[ each ],
            action: 'Add'
        } );
    }
}
/**
 * Deleting Object from Version1 Array and Placing them into Output Array
 * For Deleted Object
 *
 * @param {Object} output - compared output JSON data
 */
function deleteV1Objects( output ) {
    while( version1.length > 0 ) {
        var ob = version1[ 0 ];
        ob.level = 2;
        ob.isTC = 'No';
        ob.status = 'Delete';
        ob.contentChange = 'No';
        output.push( {
            reqobject: ob,
            action: 'Delete'
        } );
        version1.splice( 0, 1 );
    }
}

/**
 * @param {Object} output - compared output JSON data
 */
function updateChildParentRelation( output ) {
    var arrlen = output.length; //Output Array Length
    //Adding children Array in each Object
    for( var i = 0; i < arrlen; i++ ) {
        mapp.get( output[ i ].reqobject.uniqueId ).children = [];
    }
    //Adding children in Object if there Parent ID is matched with the Object
    for( i = arrlen - 1; i > 0; i-- ) {
        var tempObj = output[ i ].reqobject;
        try {
            if( mapp.get( tempObj.parent ) && mapp.get( tempObj.parent ).hasOwnProperty( 'children' ) ) {
                if( mapp.get( tempObj.parent ).children !== undefined ) {
                    mapp.get( tempObj.parent ).children.unshift( mapp.get( tempObj.uniqueId ) );
                }
            }
            throw '';
        } catch ( err ) {
            //
        } finally {
            //
        }
    }
    // Deleting ParentID from Object as this is not required
    //And Required Action - Add/Update/Delete
    for( i = 0; i < arrlen; i++ ) {
        delete output[ i ].reqobject.parent;
        output[ i ].reqobject.action = output[ i ].action;
        output[ i ].reqobject.siblingId = '';
    }
}
/**
 * forms a arraylist of existing Json data
 * @param {String} data - The ViewModel Object
 */
export let showTreeWithContents = function( data ) {
    let obj1 = data.searchResults;
    html1 = '';
    version1 = [];
    version2 = [];
    p1 = new Map();
    p2 = new Map();
    depthFirstSearch( version1, p1, _blankObj, obj1, 1, 0 );
    data.searchResults.htmlContents = html1;
    if( data.searchResults1 ) {
        data.searchResults1.htmlContents = html2;
    }
};

//map for uniqueId of every object
var uniqueIdMap = new Map();
// /**
//  * Set existing structures JSON data to service for rendering Preview
//  * @param {Object} data - The ViewModel Object
//  * @param {Object} ctx - the Context Object
//  */
// export let compareJSONTree = function( data, ctx ) {
//     var updatePreview = appCtxSvc.getCtx( 'updatePreviewClick' );
//     if( updatePreview === true ) {
//         let obj1 = data.searchResults;
//         html1 = '';
//         html2 = '';
//         version1 = [];
//         version2 = [];
//         p1 = new Map();
//         p2 = new Map();
//         data.searchResults.action = 'Revise';
//         data.searchResults.siblingId = '';
//         data.searchResults1.action = 'Revise';
//         data.searchResults1.siblingId = '';
//         data.searchResults1.name = specName;
//         data.searchResults1.uniqueId = specId;
//         depthFirstSearch( version1, p1, _blankObj, obj1, 1, 0 );
//         let obj2 = data.searchResults1;
//         data.searchResults.htmlContents = html1;
//         if( data.searchResults1 ) {
//             data.searchResults1.htmlContents = html2;
//         }
//         depthFirstSearch( version2, p2, _blankObj, obj2, 2, 0 );
//         compareTree( data, version1, version2 );
//     } else {
//         let obj2 = data.searchResults1;
//         data.importClicked = false;
//         depthFirstSearch( version2, p2, _blankObj, obj2, 2, 0 );
//         compareTree( data, version1, version2 );
//     }
// };

/**
 * to Compare TC Object and Preview Object
 * @param {String} html1 -
 * @param {String} html2 -
 * @param {HTMLElement} nodeToAddResult -
 */
var _compareHtml = function( html1, html2, nodeToAddResult ) {
    var contents = [ html1, html2 ];
    var $http = AwHttpService.instance;
    var url = exports.getCompareHtmlServiceURL();
    $http.post( url, contents, {
        headers: { 'Content-Type': 'application/json' }
    } ).then( function( response ) {
        var comparedContentes;
        if( response.data && response.data.output && _isAnyDifferenceInCompare( response.data.output ) ) {
            comparedContentes = response.data.output;
        } else {
            comparedContentes = html1;
            // reset status as there is not difference found
            nodeToAddResult.status = 'NoChange';
            nodeToAddResult.contentChange = 'No';
            nodeToAddResult.action = 'NoChange';
        }
        var index = comparedContentes.indexOf( '<?xml version="1.0" encoding="UTF-8"?>' );
        if( index > -1 ) {
            comparedContentes = comparedContentes.slice( '<?xml version="1.0" encoding="UTF-8"?>'.length );
        }
        nodeToAddResult.contents = comparedContentes;
        nodeToAddResult.orignalContents = html2;
        nodeToAddResult.existingDocumentData = html1;
    } );
};

/**
 * Returns true if any difference mentioned in compared report
 *
 * @param {string} content - compared html contents
 * @returns {boolean} - true if any difference added in compared report
 */
var _isAnyDifferenceInCompare = function( content ) {
    if( content.indexOf( 'diff-html-added' ) > -1 || content.indexOf( 'diff-html-removed' ) > -1 || content.indexOf( 'diff-html-changed' ) > -1 ) {
        return true;
    }
    return false;
};

/**
 * Set existing structures JSON data to service for rendering Preview
 * @param {String} data - The ViewModel Object
 * @returns {Object} - Json object
 */
export let setExisitingJSONData = function( data ) {
    data.selectedImportType.dbValue === 'importAsChildReq' && appCtxSvc.registerCtx( 'importAsChild', true );
    data.selectedImportType.dbValue === 'importAsChildSpec' && appCtxSvc.registerCtx( 'importAsChildSpec', true );
    var deferred = AwPromiseService.instance.defer();
    var promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + data.jsonDataOfExistingStructure.fileTickets[ 0 ] );
    promise.then( function( response ) {
        if( response ) {
            _existingStructureJSONData = response.data;
            var specList = Object.assign( data.outputSpecList, data.outputSpecElementList );
            setDisplayType( _existingStructureJSONData.specification[0], specList );
            updateDisplayTypes( _existingStructureJSONData.specification[0], specList );
            deferred.resolve( response );
        }
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
    return deferred.promise;
};

export let setDisplayType = function( node, specElementList ) {
    for( var j = 0; j < specElementList.length; j++ ) {
        var typeWithIcon = specElementList[ j ];
        if( node && node.displayType === typeWithIcon.realTypeName ) {
            node.type = node.internalType;
            node.displayType = typeWithIcon.displayTypeName;
            node.internalType = typeWithIcon.realTypeName;
            break;
        }
        if( node && node.internalType === typeWithIcon.realTypeName ) {
            node.type = node.internalType;
            node.displayType = typeWithIcon.displayTypeName;
            break;
        }
    }
};

export let updateDisplayTypes = function( parent, specElementList ) {
    var childs = parent.children;
    for ( var i = 0; i < childs.length; i++ ) {
        exports.setDisplayType( childs[i], specElementList );
        exports.updateDisplayTypes( childs[i], specElementList );
    }
};

/**
  * to Set the server response JSON data in the Service
  * @param {Object} treeData - JSON data from Server
  */
export let setJSONData = function( treeData ) {
    _treeData = treeData;
    _previewInitiator = '';
};

/**
  *
  * @param {Object} vmNode -
  */
export let setVmNodes = function( vmNode ) {
    if( vmNode ) {
        var oldObject = false;
        var lengthOfLoop = vmNodeArray.length;
        for( var i = 0; i < lengthOfLoop; i++ ) {
            var node = vmNodeArray[ i ];
            if( node.uid === vmNode.uid ) {
                oldObject = true;
                break;
            }
        }
        if( !oldObject ) {
            vmNodeArray.push( vmNode );
        }
    } else {
        vmNodeArray = [];
    }
};

/**
 * Return the type icon url for given type
 *
 * @param {String} typeName - type name
 * @param {String} typeHierarchy - type Hierarchy separated by comma
 */
export let getTypeIconURL = function( typeName, typeHierarchy ) {
    var typeIconString = iconService.getTypeIconURL( typeName );

    if( !typeIconString && typeHierarchy ) {
        var typeHierarchyArray = typeHierarchy.split( ',' );
        for( var ii = 0; ii < typeHierarchyArray.length && !typeIconString; ii++ ) {
            typeIconString = iconService.getTypeIconURL( typeHierarchyArray[ ii ] );
        }
    }

    if( !typeIconString ) {
        typeIconString = iconService.getTypeIconURL( 'Dataset' );
    }

    return browserUtils.getBaseURL() + typeIconString;
};

/**
 * adding one variable in data for Import Preview Event capture
 */
export let getTransientFileTicketsForPreview = function() {
    eventBus.publish( 'progress.start' );
};

/**
 * Get the application format
 * @param {Object} selectedObj - selected Obj
 * @return {String} The application format
 */
// export let getApplicationFormat = function( selectedObj ) {
//     var appFormat = 'MSWordXML';

//     if( selectedObj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
//         appFormat = 'MSWordXMLExisting';
//     }
//     return appFormat;
// };

// /**
//  * Set the response of JSON file ticket to service for rendering Preview
//  * @param {String} fmsTicket - JSON data from Micoservice
//  *
//  */
// export let setTreeData = function( fmsTicket ) {
//     var promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + fmsTicket );
//     var deferred = AwPromiseService.instance.defer();
//     promise.then( function( response ) {
//         if( response ) {
//             var finalJsonData = response.data;
//             if( appCtxSvc.ctx.importAsChild || appCtxSvc.ctx.importAsChildSpec ) {
//                 var clonedExistingStructureData;
//                 _selectedTCObject = appCtxSvc.ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
//                 if( _existingStructureJSONData ) {
//                     clonedExistingStructureData = _.cloneDeep( _existingStructureJSONData, true );
//                     finalJsonData = mergeExistingAndNewStructureData( clonedExistingStructureData, response.data );
//                 }
//             }
//             //merge two jsons here before setting final json
//             setJSONData( finalJsonData );
//             //importPreviewService.setSecondaryArea();
//             eventBus.publish( 'importPreview.openImportPreview' );
//         }
//     } ).catch( function( error ) {
//         deferred.reject( error );
//     } );
// };

// /**
//  * Set the response of JSON file ticket to service for rendering Preview
//  * @param {Object} data - The ViewModel Object
//  * @returns {Promise} -
//  *
//  */
// export let setExistingJSONDataCompare = function( data ) {
//     if( !clickEventAdded ) {
//         document.addEventListener( 'click', function() {
//             eventBus.publish( 'importPreview.closeExistingBalloonPopup' );
//         } );
//     }
//     var promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + data.jsonDataOfExistingStructure.fileTickets[ 0 ] );
//     var deferred = AwPromiseService.instance.defer();
//     promise.then( function( response ) {
//         if( response ) {
//             _existingStructureJSONData = _.cloneDeep( response.data, true );
//             var cloneData = _.cloneDeep( data );
//             cloneData.existingSpecJSON = response.data;
//             var previewData = cloneData.existingSpecJSON.specification[ 0 ];
//             cloneData.existingSpecJSON.specification[ 0 ].action = ' ';
//             cloneData.existingSpecJSON.specification[ 0 ].siblingId = '';
//             specName = cloneData.existingSpecJSON.specification[ 0 ].name;
//             specId = cloneData.existingSpecJSON.specification[ 0 ].uniqueId;
//             var specList = Object.assign( cloneData.outputSpecList, cloneData.outputSpecElementList );
//             setDisplayType( cloneData.existingSpecJSON.specification[0], specList );
//             updateDisplayTypes( cloneData.existingSpecJSON.specification[0], specList );
//             cloneData.searchResults = _.cloneDeep( cloneData.existingSpecJSON.specification[0], true );
//             mapp.clear();
//             exports.showTreeWithContents( cloneData );
//             if( previewData ) {
//                 if( !_previewElement ) {
//                     _previewElement = document.createElement( 'div' );
//                     _previewElement.className = 'previewElement aw-requirements-compareHistory';
//                 }
//                 _htmlDataForExistingSpec = _previewElement;
//                 _previewElement = null;
//                 deferred.resolve();
//             }
//             data.dispatch( { path: 'data', value: cloneData } );
//         }
//     } ).catch( function( error ) {
//         deferred.reject( error );
//     } );
//     return deferred.promise;
// };

// /**
//  * Set the response of JSON file ticket to service for rendering Preview
//  * @param {String} fmsTicket - JSON data from Micoservice
//  * @param {Object} data - The ViewModel Object
//  * @param {Object} ctx - Context Object
//  *
//  */
// export let compareAndSetTreeData = function( fmsTicket, data, ctx ) {
//     var promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + fmsTicket );
//     var deferred = AwPromiseService.instance.defer();
//     var cloneData = _.cloneDeep( data );
//     cloneData.htmlContents = [];
//     promise.then( function( response ) {
//         if( response ) {
//             var previewData = response.data;
//             //
//             previewData.action = 'Revise';
//             previewData.siblingId = '';
//             previewData.name = specName;
//             previewData.uniqueId = specId;
//             cloneData.searchResults1 = previewData;
//             var specList = Object.assign( cloneData.outputSpecList, cloneData.outputSpecElementList );
//             setDisplayType( cloneData.searchResults1, specList );
//             updateDisplayTypes( cloneData.searchResults1, specList );
//             exports.compareJSONTree( cloneData, ctx );
//             //data.comparedData;
//             if( previewData ) {
//                 if( !_previewElement ) {
//                     _previewElement = document.createElement( 'div' );
//                     _previewElement.className = 'previewElement aw-requirements-compareHistory';
//                 }
//                 var _htmlDtaForImportedSpec = _previewElement;
//                 _previewElement = null;
//             }
//             cloneData.htmlContents.push( _htmlDataForExistingSpec.outerHTML );
//             if( _htmlDtaForImportedSpec && _htmlDtaForImportedSpec.outerHTML ) {
//                 cloneData.htmlContents.push( _htmlDtaForImportedSpec.outerHTML );
//             }
//             _htmlDtaForImportedSpec = null;
//             _htmlDtaForImportedSpec = null;
//             data.dispatch( { path: 'data', value: cloneData } );
//             //eventBus.publish( 'importPreview.compareUpdatedSpecContents' );
//             eventBus.publish( 'importPreview.convertComparedSpecContentsToHTML' );
//             eventBus.publish( 'progress.end' );
//         }
//     } ).catch( function( error ) {
//         deferred.reject( error );
//     } );
// };

var _updateUniqueUids = function( parent ) {
    var childs = parent.children;
    for( var i = 0; i < childs.length; i++ ) {
        var node = childs[ i ];
        if( uniqueIdMap.get( node.uniqueId ) ) {
            node.uniqueId = uniqueIdMap.get( node.uniqueId );
        }
        _updateUniqueUids( node );
    }
};

// /**
//  *  Conver compared specification elements to HTML
//  * @param {Object} ctx - context object
//  * @param {IModelObject} htmlData - compare html data
//  * @param {Object} data - The ViewModel Object
//  */
// export let convertComparedSpecContentsToHTML = function( ctx, htmlData, data ) {
//     var div = document.createElement( 'div' );
//     div.innerHTML = htmlData;
//     ctx.comparedHtmlData = div;
//     _updateUniqueUids( data.comparedData );
//     setJSONData( data.comparedData );
//     //importPreviewService.setSecondaryArea();
//     eventBus.publish( 'importPreview.openImportPreview' );
// };

/**
 * Return the url for compare html microservice
 * @returns {String} url
 */
export let getCompareHtmlServiceURL = function() {
    return browserUtils.getBaseURL() + TC_MICRO_PREFIX + RM_COMPARE_HTML;
};

/**
 * Merge existing structure and new structures json data
 *  @param {String} mergedStructureData - existing json data
 *  @param {String} newJsonData - new structure json data
 *  @return {String} existingdata - merger json data
 */
var mergeExistingAndNewStructureData = function( mergedStructureData, newJsonData ) {
    if( !_selectedRequidForAddChildPreview ) {
        _selectedRequidForAddChildPreview = appCtxSvc.ctx.selected.props.awb0UnderlyingObject.dbValues[ 0 ];
    }
    var existingdata = mergedStructureData.specification[ 0 ];
    updateStructure( existingdata, newJsonData, _selectedRequidForAddChildPreview );
    return existingdata;
};

/**
 * for crating Map from the JSON data
 * @param {String} existingdata - existing structure json data
 * @param {String} newJsonData - new structure json data
 * @param {String} selectedRequid - selected requirement id
 */
function updateStructure( existingdata, newJsonData, selectedRequid ) {
    var selectedElement = findObjectByUid( existingdata, selectedRequid );
    if( appCtxSvc.ctx.importAsChild && selectedElement ) {
        updateNewStructure( selectedElement, newJsonData );
        _.forEach( newJsonData.children, function( childNode ) {
            selectedElement.children.push( childNode );
        } );
    } else if( appCtxSvc.ctx.importAsChildSpec && selectedElement ) {
        updateStructureForSpec( selectedElement, newJsonData );
        selectedElement.children.push( newJsonData );
    }
}

/**
 *Update new structure as per new hierarchy for Import as Child Specification
 * @param {*} selectedElement - JSON data from Server
 *@param {*} newJsonData - JSON data from Server
 *
 */
function updateStructureForSpec( selectedElement, newJsonData ) {
    var hierarchyNumber = selectedElement.hierarchyNumber;
    var childrenLength;
    if( selectedElement.children.length ) {
        childrenLength = selectedElement.children.length;
    }
    var queue = [];
    let tmpReq = newJsonData;
    if( childrenLength ) {
        if( hierarchyNumber === '0' ) {
            tmpReq.hierarchyNumber = ( childrenLength + 1 ).toString();
        } else {
            tmpReq.hierarchyNumber = hierarchyNumber + '.' + ( childrenLength + 1 );
        }
    } else {
        tmpReq.hierarchyNumber = '1.1';
    }
    if( tmpReq.children.length ) {
        for( let item of tmpReq.children ) {
            item.parentHierarchyNo = tmpReq.hierarchyNumber;
            queue.push( item );
        }
    }
    while( queue.length ) {
        const len = queue.length;
        var childrenLength;
        for( let i = 0; i < len; i++ ) {
            let tmpreq = queue.shift();
            tmpreq.hierarchyNumber = tmpreq.parentHierarchyNo + '.' + tmpreq.hierarchyNumber;
            if( tmpreq.children.length ) {
                for( let item of tmpreq.children ) {
                    item.parentHierarchyNo = tmpreq.parentHierarchyNo;
                    queue.push( item );
                }
            }
        }
    }
}

/**
 *Update new structure as per new hierarchy for Import as Child Requirement
 * @param {*} selectedElement - JSON data from Server
 *@param {*} newJsonData - JSON data from Server
 *
 */
function updateNewStructure( selectedElement, newJsonData ) {
    var children = newJsonData.children;
    var hierarchyNo = selectedElement.hierarchyNumber;
    var childrenLength;
    if( selectedElement.children.length ) {
        childrenLength = selectedElement.children.length;
    }
    var queue = [];
    for( let i = 0; i < children.length; i++ ) {
        let tmp = children[ i ];
        if( childrenLength ) {
            if( hierarchyNo === '0' ) {
                tmp.hierarchyNumber = ( childrenLength + 1 ).toString();
            } else {
                tmp.hierarchyNumber = hierarchyNo + '.' + ( childrenLength + 1 );
            }
            childrenLength++;
        } else {
            tmp.hierarchyNumber = hierarchyNo + '.' + tmp.hierarchyNumber;
        }
        if( tmp.children.length ) {
            for( let item of tmp.children ) {
                item.parentHierarchyNo = tmp.hierarchyNumber;
                queue.push( item );
            }
        }
    }
    while( queue.length ) {
        const len = queue.length;
        for( let i = 0; i < len; i++ ) {
            let tmpreq = queue.shift();
            var newNo = tmpreq.hierarchyNumber.substr( tmpreq.hierarchyNumber.indexOf( '.' ) );
            tmpreq.hierarchyNumber = tmpreq.parentHierarchyNo + newNo;
            if( tmpreq.children.length ) {
                for( let item of tmpreq.children ) {
                    item.parentHierarchyNo = tmpreq.parentHierarchyNo;
                    queue.push( item );
                }
            }
        }
    }
}

/**
 * Find the selected object uid in existing structure
 * @param {*} root - JSON data from Server
 *@param {*} selectedUid - JSON data from Server
 *@return {*} selectedUid - JSON data from Server
 */
function findObjectByUid( root, selectedUid ) {
    if( root.uniqueId === selectedUid ) { return root; }
    if( root.children && root.children.length ) {
        for( let child of root.children ) {
            let temp = findObjectByUid( child, selectedUid );
            if( temp ) { return temp; }
        }
    }
    return null;
}

/**
 * Update the response of JSON file ticket to service for Updating Preview
 * @param {String} fmsTicket - JSON data  from Micoservice
 * @param {String} data - JSON data  from Micoservice
 * @param {Object} ctx - context object
 *
 */
export let setUpdateTreeData = function( fmsTicket, data, ctx ) {
    //importPreviewService.setSecondaryArea();
    setVmNodes();
    eventBus.publish( 'importPreview.closeExistingBalloonPopup' );
    var promise = AwHttpService.instance.get( CLIENT_FMS_DOWNLOAD_PATH + fmsTicket );
    var deferred = AwPromiseService.instance.defer();
    promise.then( function( response ) {
        if( response ) {
            var mergedStructureData;
            var finalJsonData = response.data;
            if( _existingStructureJSONData && ( appCtxSvc.ctx.importAsChild || appCtxSvc.ctx.importAsChildSpec ) ) {
                mergedStructureData = _.cloneDeep( _existingStructureJSONData, true );
                finalJsonData = mergeExistingAndNewStructureData( mergedStructureData, response.data );
            }
            if( _existingStructureJSONData && appCtxSvc.ctx.compareAndPreviewBtnClicked ) {
                appCtxSvc.registerCtx( 'updatePreviewClick', true );
                data.searchResults = _.cloneDeep( _existingStructureJSONData.specification[0], true );
                data.searchResults1 = response.data;

                var specList = Object.assign( data.outputSpecList, data.outputSpecElementList );
                setDisplayType( data.searchResults1, specList );
                updateDisplayTypes( data.searchResults1, specList );

                setDisplayType( data.searchResults, specList );
                updateDisplayTypes( data.searchResults, specList );

                exports.compareJSONTree( data, ctx );
                _updateUniqueUids( data.comparedData );
                finalJsonData = data.comparedData;
            }
            setJSONData( finalJsonData );
            data._arm0ImportFromOfficeEventProgressing = false;
            eventBus.publish( 'importPreview.refreshTreeDataProvider' );
        }
    } ).catch( function( error ) {
        deferred.reject( error );
    } );
};

/**
 * Return an empty ListModel object.
 *
 * @return {Object} - Empty ListModel object.
 */
var _getEmptyListModel = function() {
    return {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};

// /**
//  * Remove all importRules from importRulesList list.
//  *
//  * @param {Object} data - The view model data
//  */
// export let removeAllRules = function( data, sharedData ) {
//     if( sharedData.importRules ) {
//         for( var i = sharedData.importRules.length - 1; i >= 0; i-- ) {
//             sharedData.importRules.splice( i, 1 );
//         }
//     }
// };

// /**
//  * prepare Keyword Import Options
//  * @param {Object} data - The view model data
//  * @returns {Array} keywordImportRules
//  *
//  */
// export let getkeywordImportAdvanceOptions = function( data, sharedData ) {
//     var keywordImportOptions = {
//         keywordImportRules: []
//     };
//     if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
//         if( sharedData.importRules && sharedData.importRules.length ) {
//             var cloneData = _.cloneDeep( sharedData.importRules );
//             for( var k = 0; k < cloneData.length; k++ ) {
//                 for( var i = 0; i < cloneData[ k ].advancedRules.length; i++ ) {
//                     delete cloneData[ k ].advancedRules[ i ].propertyNameValue.dispKey;
//                 }
//                 keywordImportOptions.keywordImportRules = cloneData;
//             }
//         } else {
//             keywordImportOptions.keywordImportRules = sharedData.importRules && sharedData.importRules.length ? sharedData.importRules : null;
//         }
//         return keywordImportOptions.keywordImportRules;
//     }
//     return exports.getkeywordImportOptions( data );
// };

// /**
//  * prepare Keyword Import Options
//  *
//  * @param {Object} data - The view model data
//  * @returns {Array} keywordImportOptions
//  *
//  */
// export let getkeywordImportOptions = function( data ) {
//     var keywordImportRules = [];
//     if( data.importRules ) {
//         for( var i = 0; i < data.importRules.length; i++ ) {
//             var curImportRule = {};
//             var curImportCondn = {};

//             if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' ) && appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
//                 curImportRule.targetChildDisplayType = data.importRules[ i ].cellHeader1;
//             }
//             curImportRule.targetChildType = data.importRules[ i ].cellHeader1InVal;
//             curImportRule.conditionProcessingType = 'ANY';
//             curImportRule.keywordImportConditions = [];

//             if( data.importRules[ i ].cellHeader2InVal === 'Word_Contains' ) {
//                 if( data.importRules[ i ].cellHeader3InVal === 'Exact_Match' ) {
//                     curImportCondn.opType = 'WORD_EXACT_MATCH';
//                     curImportCondn.keyword = data.importRules[ i ].cellHeader4InVal;
//                 } else if( data.importRules[ i ].cellHeader3InVal === 'Partial_Match' ) {
//                     curImportCondn.opType = 'WORD_PARTIAL_MATCH';
//                     curImportCondn.keyword = data.importRules[ i ].cellHeader4InVal;
//                 } else if( data.importRules[ i ].cellHeader3InVal === 'Does_not_contain_word' ) {
//                     curImportCondn.opType = 'DOES_NOT_CONTAIN_WORD';
//                     curImportCondn.keyword = data.importRules[ i ].cellHeader4InVal;
//                 }
//             } else if( data.importRules[ i ].cellHeader2InVal === 'Has_Style' ) {
//                 curImportCondn.opType = 'HAS_STYLE';
//                 curImportCondn.keyword = data.importRules[ i ].cellHeader3InVal;
//             }
//             curImportRule.keywordImportConditions.push( curImportCondn );
//             keywordImportRules.push( curImportRule );
//         }
//     }

//     return keywordImportRules.length ? keywordImportRules : null;
// };

// /**
//  * Prepare import options for Import Specification operation
//  * @param {Object} data - The view model data
//  * @returns {Array} importOptionsforWordAndPDF
//  *
//  */
export let getImportOptionsForWordAndPDF = function( data ) {
    var importOptionsforWordAndPDF = [];
    if( data.fmsTicket && data.addFileAsAttachmnt.dbValue ) {
        importOptionsforWordAndPDF.push( { option: 'AttachFile', val: data.fmsTicket } );
    }
    return importOptionsforWordAndPDF;
};

/**
 * Update Specification and SpecElement Types
 *
 * @param {Object} data - The view model data
 *
 */
export let updateImportSpecList = function( data, selected, sharedData ) {
    //Specification type
    const newsharedData = { ...sharedData.value };

    eventBus.publish( 'progress.end' );
    var arrSpecTypeName = [];
    var index = 0;
    var reqTypeList = [];
    var cloneData = _.cloneDeep( data );
    let preferences = appCtxSvc.getCtx( 'preferences' );
    if( cloneData.outputSpecList ) {
        for( var i = 0; i < cloneData.outputSpecList.length; i++ ) {
            var rootType = cloneData.outputSpecList[ i ];
            var listModel = _getEmptyListModel();
            listModel.propDisplayValue = rootType.displayTypeName;
            listModel.propInternalValue = rootType.realTypeName;
            //Show preference value as default specification type on panel
            if( preferences.REQ_DefaultReqSpecType && preferences.REQ_DefaultReqSpecType[ 0 ] === rootType.realTypeName ) {
                index = i;
            }
            arrSpecTypeName.push( listModel );
        }
        cloneData.reqTypeList = arrSpecTypeName;
        if( cloneData.reqTypeList[ index ] ) {
            var reqType = uwPropertyService.createViewModelProperty( cloneData.reqType.dbValues[ 0 ],
                cloneData.reqType.uiValues[ 0 ], 'STRING', cloneData.reqType.dbValues[ 0 ], cloneData.reqType.uiValues );
            cloneData.reqType.dbValue = cloneData.reqTypeList[ index ].propInternalValue;
            reqType.isEditable = true;
            reqType.dbValue = cloneData.reqTypeList[ index ].propInternalValue;
            reqType.dispValue = cloneData.reqTypeList[ index ].propInternalValue;
            reqType.dataProvider = cloneData.reqType.dataProvider;
            reqType.propertyDisplayName = cloneData.reqType.propertyDisplayName;
            reqType.uiValue = cloneData.reqTypeList[ index ].propDisplayValue;
            reqType.propertyLabelDisplay = cloneData.reqType.propertyLabelDisplay;
            reqType.propertyName = cloneData.reqType.propertyName;
            reqType.propertyRequiredText = cloneData.reqType.propertyRequiredText;
            reqType.hasLov = cloneData.reqType.hasLov;
            cloneData.reqType = reqType;
        }
    }
    if( preferences.REQ_AttachImportSpecFileToReqSpec && preferences.REQ_AttachImportSpecFileToReqSpec[ 0 ] === 'true' ) {
        cloneData.addFileAsAttachmnt.dbValue  = true;
    }

    //SpecElement types
    var arrSpecEleTypeName = [];
    var indexSpecEle = 0;
    if( cloneData.outputSpecElementList ) {
        for( var j = 0; j < cloneData.outputSpecElementList.length; j++ ) {
            var output1 = cloneData.outputSpecElementList[ j ];
            var listModel1 = _getEmptyListModel();

            listModel1.propDisplayValue = output1.displayTypeName;
            listModel1.propInternalValue = output1.realTypeName;

            //Show preference value as default sub type on panel
            if( preferences.REQ_DefaultReqType && preferences.REQ_DefaultReqType[ 0 ] === output1.realTypeName ) {
                indexSpecEle = j;
            }
            arrSpecEleTypeName.push( listModel1 );
        }
        cloneData.reqSpecEleTypeList = arrSpecEleTypeName;

        var reqSpecEleType = uwPropertyService.createViewModelProperty( cloneData.reqSpecEleType.dbValues[ 0 ],
            cloneData.reqSpecEleType.uiValues[ 0 ], 'STRING', cloneData.reqSpecEleType.dbValues[ 0 ], cloneData.reqSpecEleType.uiValues );

        reqSpecEleType.isEditable = true;
        reqSpecEleType.dbValue = cloneData.reqSpecEleTypeList[ indexSpecEle ].propInternalValue;
        reqSpecEleType.dataProvider = cloneData.reqSpecEleType.dataProvider;
        reqSpecEleType.propertyDisplayName = cloneData.reqSpecEleType.propertyDisplayName;
        reqSpecEleType.dispValue = cloneData.reqSpecEleTypeList[ indexSpecEle ].propInternalValue;
        reqSpecEleType.uiValue = cloneData.reqSpecEleTypeList[ indexSpecEle ].propDisplayValue;
        reqSpecEleType.propertyLabelDisplay = cloneData.reqSpecEleType.propertyLabelDisplay;
        reqSpecEleType.propertyName = cloneData.reqSpecEleType.propertyName;
        reqSpecEleType.propertyRequiredText = cloneData.reqSpecEleType.propertyRequiredText;
        reqSpecEleType.hasLov = cloneData.reqSpecEleType.hasLov;
        cloneData.reqSpecEleType = reqSpecEleType;
    }

    /**
     * for reading the data from saved CTX
     * Import Preview redirection and retention of same info seleted in Import Spec Panel
     */
    if( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] === 'ImportPreviewLocation' ) {
        getImportPreviewData( cloneData, sharedData );
        newsharedData.fileNameNoExt = cloneData.fileNameNoExt;
        newsharedData.fileName = cloneData.fileName;
    } else {
        /** Contains the Import-Type of Created Rules */
        cloneData.typeOfRuleMap = {};
        cloneData.typeOfPropRuleMap = {};
        cloneData.conditionOfRuleMap = {};
    }


    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType && appCtxSvc.ctx.selected.modelType.typeHierarchyArray && appCtxSvc.ctx.selected.modelType.typeHierarchyArray.indexOf( 'Folder' ) === -1 ) {
        var selectedImportType = uwPropertyService.createViewModelProperty( cloneData.selectedImportType.dbValues[ 0 ],
            cloneData.selectedImportType.uiValues[ 0 ], 'STRING', cloneData.selectedImportType.dbValues[ 0 ], cloneData.selectedImportType.uiValues );

        selectedImportType.isEditable = true;
        selectedImportType.dbValue = cloneData.importTypeValues.dbValue[0].propInternalValue;
        selectedImportType.dataProvider = cloneData.selectedImportType.dataProvider;
        selectedImportType.propertyDisplayName = cloneData.selectedImportType.propertyDisplayName;
        selectedImportType.dispValue = cloneData.importTypeValues.dbValue[ 0 ].propInternalValue;
        selectedImportType.uiValue = cloneData.importTypeValues.dbValue[ 0 ].propDisplayValue;
        selectedImportType.propertyLabelDisplay = cloneData.selectedImportType.propertyLabelDisplay;
        selectedImportType.propertyName = cloneData.selectedImportType.propertyName;
        selectedImportType.propertyRequiredText = cloneData.selectedImportType.propertyRequiredText;
        selectedImportType.hasLov = cloneData.selectedImportType.hasLov;
        cloneData.selectedImportType = selectedImportType;
    }
    if( appCtxSvc.ctx.selected && appCtxSvc.ctx.selected.modelType && appCtxSvc.ctx.selected.modelType.name === 'Arm0RequirementSpecElement' ) {
        cloneData.importTypeValues.dbValue.push( { propDisplayValue: cloneData.i18n.asChildSpecLabel, dispValue: cloneData.i18n.asChildSpecLabel, propInternalValue: 'importAsChildSpec' } );
    }

    /** For Adding Import As Spec option in Import type List in case of Micoservice Installed environment */
    if( cloneData.importTypeValues && cloneData.importTypeValues.dbValue.length >= EXISTING_LENGTH && preferences.REQ_Microservice_Installed[ 0 ] === 'true' ) {
        cloneData.importTypeValues.dbValue.push( { propDisplayValue: cloneData.i18n.changestoSpecLabel, dispValue: cloneData.i18n.changestoSpecLabel, propInternalValue: 'changestoSpec' } );
    }

    var mappingType = exports.initImportRulesData( cloneData );
    var reqSpecEleTypeList = cloneData.reqSpecEleTypeList;
    var reqSpecEleType = cloneData.reqSpecEleType;
    var importTypeValues = cloneData.importTypeValues;
    var reqType = cloneData.reqType;
    newsharedData.typeOfRuleMap =  cloneData.typeOfRuleMap;
    newsharedData.typeOfPropRuleMap = cloneData.typeOfPropRuleMap;
    newsharedData.conditionOfRuleMap = cloneData.conditionOfRuleMap;
    newsharedData.reqSpecEleTypeList = cloneData.reqSpecEleTypeList;
    newsharedData.reqSpecEleType = cloneData.reqSpecEleType;
    newsharedData.importTypeValues = cloneData.importTypeValues;
    newsharedData.mappingType = mappingType;
    newsharedData.reqType = cloneData.reqType;
    newsharedData.importRules = cloneData.importRules;
    newsharedData.previewClicked = cloneData.previewClicked;

    sharedData.update && sharedData.update( newsharedData );

    data.dispatch( { path: 'data', value: cloneData } );
    // return {
    //     reqSpecEleTypeList:reqSpecEleTypeList,
    //     reqSpecEleType:reqSpecEleType,
    //     importTypeValues:importTypeValues,
    //     reqType:reqType
    // };
};

export let updateImportTypesList = function( data, selected, subPanelContext ) {
    var importTypeValues = {};
    importTypeValues.dbValue = [];

    importTypeValues.dbValue.push( { propDisplayValue: data.i18n.asChildReqLabel, dispValue: data.i18n.asChildReqLabel, propInternalValue: 'importAsChildReq' } );
    var selectedObject = selected ? selected : subPanelContext.value.selected[0];
    if ( selectedObject && selectedObject.modelType && selectedObject.modelType.name === 'Arm0RequirementSpecElement' ) {
        if( data.importTypeValues ) {
            importTypeValues.dbValue.push( { propDisplayValue: data.i18n.asChildSpecLabel, dispValue: data.i18n.asChildSpecLabel, propInternalValue: 'importAsChildSpec' } );
        }
    }
    /** For Adding Import As Spec option in Import type List in case of Micoservice Installed environment */
    if( importTypeValues.dbValue.length >= EXISTING_LENGTH && appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
        importTypeValues.dbValue.push( { propDisplayValue: data.i18n.changestoSpecLabel, dispValue: data.i18n.changestoSpecLabel, propInternalValue: 'changestoSpec' } );
    }

    return importTypeValues;
};

// /**
//  * Update import rules data
//  *
//  * @param {Object} data - The view model data
//  *
//  */
// export let initImportRulesData = function( data ) {
//     var mappingType;
//     data.savedRules.dbValue = '';
//     data.savedRules.uiValue = '';
//     let preferences = appCtxSvc.getCtx( 'preferences' );
//     if( appCtxSvc.ctx.isArm0ImportFromWordSubPanelActive || appCtxSvc.ctx.isArm0ImportFromPDFSubPanelActive || data.mode === 'preview' ) {
//         if( preferences.REQ_Microservice_Installed[ 0 ] === 'true' ) {
//             mappingType = 'SaveAdvanceRule';
//         } else {
//             mappingType = 'SaveLegacyRule';
//         }
//         eventBus.publish( 'importSpecification.populateAllImportRules' );
//     }
//     return mappingType;
// };

/**
 * for reading the data from saved CTX
 * Import Preview redirection and retention of same info seleted in Import Spec Panel
 *  @param {Object} data - The view model data
 */
var getImportPreviewData = function( data, sharedData ) {
    data.importRules = _importPreviewData.listOfImportRules;
    data.reqType.dbValue = _importPreviewData.reqTypeInternalValue;
    data.reqSpecEleTypeList = _importPreviewData.reqSpecEleTypeList;
    data.reqSpecEleType.dbValue = _importPreviewData.reqSpecEleTypeInternalValue;
    data.description.dbValue = _importPreviewData.SpecDescription;
    data.fileName = _importPreviewData.inputWordFileName;
    data.preserveNumbering.dbValue = _importPreviewData.saveNumbering;
    data.createEmptyPlaceholder.dbValue = _importPreviewData.isCreatePlaceholder;
    data.addFileAsAttachmnt.dbValue = _importPreviewData.isAddFileAsAttachmntSet;
    data.fmsTicket = _importPreviewData.inputWordFileTicket;
    data.fileNameNoExt = _importPreviewData.inputWordFileNameNoExt;
    data.selectedObject = _importPreviewData.slectedObjectDetails;
    data.typeOfRuleMap = _importPreviewData.typeOfRuleMap;
    data.typeOfPropRuleMap = _importPreviewData.typeOfPropRuleMap;
    data.mapOfTypeDescriptions = _importPreviewData.mapOfTypeDescriptions;
    data.conditionOfRuleMap = _importPreviewData.conditionOfRuleMap;
    data.mode = 'preview';
    data.previewClicked = _importPreviewData.previewClicked;
    const newsharedData = { ...sharedData.value };
    newsharedData.typeOfRuleMap = _importPreviewData.typeOfRuleMap;
    newsharedData.typeOfPropRuleMap = _importPreviewData.typeOfPropRuleMap;
    newsharedData.importRules = _importPreviewData.listOfImportRules;
    newsharedData.previewClicked = _importPreviewData.previewClicked;

    sharedData.update && sharedData.update( newsharedData );

    var ctx = appCtxSvc.getCtx( 'location.titles' );
    ctx.headerTitle += data.fileNameNoExt;
    appCtxSvc.updateCtx( 'location.titles', ctx );
    eventBus.publish( 'ImportFromOffice.refreshImportRuleList' );
    _importPreviewData = null;
};

/**
 * Update SpecElement Types
 *
 * @param {Object} data - The view model data
 *
 */
export let updateImportSpecElementList = function( data, sharedData ) {
    // SpecElement types
    var arrSpecElementTypeName = [];
    var index = 0;
    if( data.outputSpecElementList ) {
        for( var j = 0; j < data.outputSpecElementList.length; j++ ) {
            var output1 = data.outputSpecElementList[ j ];
            var listModel1 = _getEmptyListModel();

            listModel1.propDisplayValue = output1.displayTypeName;
            listModel1.propInternalValue = output1.realTypeName;
            if( output1.realTypeName === 'Requirement' ) {
                index = j;
            }
            arrSpecElementTypeName.push( listModel1 );
        }
    }
    var reqSpecEleTypeList = arrSpecElementTypeName;

    var reqSpecEleType = uwPropertyService.createViewModelProperty( data.reqSpecEleType.dbValue,
        data.reqSpecEleType.uiValue, 'STRING', data.reqSpecEleType.dbValue, data.reqSpecEleType.uiValues );

    reqSpecEleType.isEditable = true;
    reqSpecEleType.dbValue = reqSpecEleTypeList[ index ].propInternalValue;
    reqSpecEleType.dataProvider = data.reqSpecEleType.dataProvider;
    reqSpecEleType.propertyDisplayName = data.reqSpecEleType.propertyDisplayName;
    reqSpecEleType.propertyLabelDisplay = data.reqSpecEleType.propertyLabelDisplay;
    reqSpecEleType.propertyName = data.reqSpecEleType.propertyName;
    reqSpecEleType.propertyRequiredText = data.reqSpecEleType.propertyRequiredText;
    reqSpecEleType.hasLov = data.reqSpecEleType.hasLov;
    reqSpecEleType.dispValue = reqSpecEleTypeList[ index ].propInternalValue;
    reqSpecEleType.uiValue = reqSpecEleTypeList[ index ].propDisplayValue;

    return { reqSpecEleTypeList: reqSpecEleTypeList, reqSpecEleType: reqSpecEleType };
};

/**
 * Get the Run in Background option value
 *
 * @param {Object} data - The view model data
 * @return {Boolean} true if run in background
 */
export let getRunInBackground = function( data ) {
    if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' ) && appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
        data.isRunningInBackground = data.runInBackgroundWord.dbValue;
        return data.runInBackgroundWord.dbValue;
    }
    return true;
};

/**
 * Get import as html option value
 *
 * @param {Object} data - The view model data
 * @return {Boolean} true if import as html
 */
export let getImportAsHtml = function( data ) {
    var importAsHtml = false;
    if( appCtxSvc.getCtx( 'preferences.AWC_ReqImportAsHtml' ) ) {
        importAsHtml = appCtxSvc.getCtx( 'preferences.AWC_ReqImportAsHtml' )[ 0 ];
    }
    if( importAsHtml === true || data.convertToHTML.dbValue === true ) {
        return true;
    }
    return false;
};

/**
 * Get the import as spec value
 *
 * @param {Object} data - The view model data
 * @return {Boolean} true if import as spec
 */
export let getImportAsSpec = function( data ) {
    var importAsSpec = true;

    if( data.selectedImportType.dbValue === 'importAsChildReq' || data.importSubtypeOnlyCheckbox.dbValue === true || appCtxSvc.ctx.importAsChild === true ) {
        importAsSpec = false;
    }

    return importAsSpec;
};

/**
 * Get the root spec type
 *
 * @param {Object} data - The view model data
 * @param {Object} selectedObj object
 * @return {String} root type name
 */
export let getRootTypeName = function( data, selectedObj ) {
    if( data.selectedImportType.dbValue === 'importAsChildReq' || data.importSubtypeOnlyCheckbox.dbValue === true ) {
        if( selectedObj && selectedObj.modelType && selectedObj.modelType.typeHierarchyArray &&
            selectedObj.modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) { // In ACE
            // Get underlying revision
            var underlyingRevision = cdm.getObject( selectedObj.props.awb0UnderlyingObject.dbValues[ 0 ] );

            return _getItemType( underlyingRevision.type );
        } // Outside ACE

        return REQ_NOT_IN_SPEC;
    }

    return data.reqType.dbValue;
};

/**
 * Return item type name from given revision type name
 *
 * @param {String} revisionType type name
 * @return {String} item type name
 */
var _getItemType = function( revisionType ) {
    // Replace item revision with item. Note, there is no good way to find item type from item revision
    // type without looping through all item subtypes and check the Revision type constant of each item type,
    // so follow RAC to do string comparison.
    var itemType = revisionType;
    if( _.endsWith( revisionType, ' Revision' ) ) {
        var idx = revisionType.indexOf( ' Revision' );
        itemType = revisionType.substring( 0, idx );
    } else if( _.endsWith( revisionType, 'Revision' ) ) {
        var idx = revisionType.indexOf( 'Revision' );
        itemType = revisionType.substring( 0, idx );
    }
    return itemType;
};

/**
 * Get the import as spec value
 *
 * @param {Object} data - The view model data
 * @return {String} specification type
 */
export let getSpecificationTypeForImport = function( data ) {
    var specType = data.reqType.dbValue;
    if( data.selectedImportType.dbValue === 'importAsChildReq' || data.importSubtypeOnlyCheckbox.dbValue === true ) {
        specType = '';
    }

    return specType;
};

/**
 * Get the import as spec value
 *
 * @param {Object} data - The view model data
 * @return {String} specification type
 */
export let getSpecificationDisplayTypeForImport = function( data ) {
    var specDisplayType = data.reqType.uiValue;
    if( data.selectedImportType.dbValue === 'importAsChildReq' || data.importSubtypeOnlyCheckbox.dbValue === true ) {
        specDisplayType = '';
    }

    return specDisplayType;
};

/**
 * Get the file name
 *
 * @param {Object} data - The view model data
 * @return {String} file name
 */
export let getFileName = function( data, sharedData ) {
    var fileName = data.fileNameNoExt;
    if( fileName !== undefined ) {
        return fileName;
    } else if( sharedData ) {
        const newsharedData = { ...sharedData.value };
        return newsharedData.fileNameNoExt;
    }
    return data.subPanelContext.data.fileNameNoExt;
};

/**
 * Returns the url for the microservice call
 *
 * @param {Object} ctx - The context object
 * @return {String} dbValue of the selected type
 */
// export let getMicroServiceURL = function( ctx ) {
//     if( ctx.isArm0ImportFromPDFSubPanelActive ) {
//         // Fof PDF Import
//         return browserUtils.getBaseURL() + microServiceURLStringForPDF;
//     }
//     // For Word Import
//     return browserUtils.getBaseURL() + microServiceURLStringForWord;
// };

/**
 * Checks whether keyword import or non-keyword.
 *
 * @param {Object} data - The view model object
 * @param {Object} ctx - the Context Object
 */
export let checkImportType = function( data, ctx ) {
    /**
     * Case Import Preview redirection and retention of same info seleted in Import Spec Panel
     */
    if( data.importPreviewBtnClicked || ctx.compareAndPreviewBtnClicked ) {
        setImportPreviewData( data, ctx );
        eventBus.publish( 'importSpecification.importPreview' );
    }else if( appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' ) && appCtxSvc.getCtx( 'preferences.REQ_Microservice_Installed' )[ 0 ] === 'true' ) {
        // For Direct Import use case
        eventBus.publish( 'progress.start' );
        eventBus.publish( 'importSpecification.keywordImport' );
    } else if( data.importRules && data.importRules.length > 0 ) {
        eventBus.publish( 'importSpecification.keywordTc115OrLater' );
    } else {
        eventBus.publish( 'importSpecification.nonKeyword' );
    }
};

/**
 * Sets the  Import Preview Data.
 *
 * @param {Object} data - The view model object
 * @param {Object} ctx - the context object
 */
var setImportPreviewData = function( data, ctx ) {
    _importPreviewData = {
        listOfImportRules: data.importRules,
        reqSpecEleTypeInternalValue: data.reqSpecEleType.dbValue,
        reqSpecEleTypeList: data.reqSpecEleTypeList,
        reqTypeInternalValue: data.reqType.dbValue,
        SpecDescription: data.description.dbValue,
        inputWordFileTicket: data.fmsTicket,
        inputWordFileName: data.subPanelContext.sharedData.fileName,
        inputWordFileNameNoExt: data.subPanelContext.sharedData.fileNameNoExt,
        slectedObjectDetails: ctx.selected,
        saveNumbering: data.preserveNumbering.dbValue,
        isCreatePlaceholder: data.createEmptyPlaceholder.dbValue,
        isAddFileAsAttachmntSet: data.addFileAsAttachmnt.dbValue,
        typeOfRuleMap: data.typeOfRuleMap || {},
        typeOfPropRuleMap: data.typeOfPropRuleMap || {},
        mapOfTypeDescriptions: data.mapOfTypeDescriptions,
        conditionOfRuleMap: data.conditionOfRuleMap || {},
        previewClicked: true

    };
};

/**
 * Sets the ticket to data and import the document
 *
 * @param {Object} data - The view model object
 * @param {Object} jsonFmsTicket - JSON file ticket from microservice
 */
export let setJSONDataForImport = function( data, jsonFmsTicket ) {
    data.jsonFmsTicket = jsonFmsTicket.trim();
    eventBus.publish( 'importSpecification.importUsingJSONData' );
};

// /**
//  * Sets the ticket to data and import the document
//  *
//  * @param {Object} data - The view model object
//  */
// export let getJSONDataForCompareImport = function( data ) {
//     data.UpdateImportWithoutRevise = true;
//     exports.getJSONDataForImport( data );
// };

/**
 * Get the application format
 * @param {Object} selectedObj - selected Obj
 * @return {String} The application format
 */
export let getNewApplicationFormat = function( data ) {
    return data.UpdateImportWithoutRevise ? 'UpdateImportWithoutRevise' : 'UpdateImport';
};

// /**
//  * Get the updated JSON data and generate JSON file ticket for Import
//  *
//  * @param {Object} data - The view model object
//  * @param {Object} jsonFmsTicket - JSON file ticket from microservice
//  */
// export let getJSONDataForImport = function( data ) {
//     var cloneData = _.cloneDeep( data );
//     if( appCtxSvc.ctx.importAsChild ) {
//         // Get updated child from the current data
//         var newChilds = [];
//         var updateChild = rmTreeDataService.getObjectFromId( _selectedTCObject );
//         //need to get only new childs in case of multiple childs
//         _.forEach( updateChild.children, function( child ) {
//             var uniqueidSplit = child.uniqueId.split( '-' );
//             if( uniqueidSplit.length > 1 ) {
//                 newChilds.push( child );
//             }
//         } );
//         updateChild.children = newChilds;
//         cloneData.treeData = updateChild;
//     } else if( appCtxSvc.ctx.importAsChildSpec ) {
//         // Get updated child from the current data for Import As Spec
//         newChilds = [];
//         updateChild = rmTreeDataService.getObjectFromId( _selectedTCObject );
//         //need to get only new childs in case of multiple childs and to Ignore the Parent Spec
//         _.forEach( updateChild.children[ updateChild.children.length - 1 ].children, function( child ) {
//             var uniqueidSplit = child.uniqueId.split( '-' );
//             if( uniqueidSplit.length > 1 ) {
//                 newChilds.push( child );
//             }
//         } );
//         updateChild.children = newChilds;
//         cloneData.treeData = updateChild;
//     } else {
//         cloneData.treeData = rmTreeDataService.getJSONData();
//     }
//     data.dispatch( { path: 'data', value: cloneData } );

//     // If case of PDF Import, write json to fms file (calling soa/microservice is not required)
//     if( appCtxSvc.ctx.isArm0ImportFromPDFSubPanelActive ) {
//         eventBus.publish( 'importPreview.getFMSFileTicketForImportPDF' );
//     } else {
//         eventBus.publish( 'importPreview.getJsonFileTicketsForImport' );
//     }
// };

// /**
//  * Update File Content In FormData For Import PDF
//  *
//  * @param {Object} data - View model object data
//  */
// export let updateFileContentInFormDataForImportPDF = function( data ) {
//     data.formDataForImportPDF = new FormData();
//     data.formDataForImportPDF.append( 'fmsFile', new Blob( [ JSON.stringify( data.treeData ) ], { type: 'text/plain' } ) );
//     data.formDataForImportPDF.append( 'fmsTicket', data.jsonFmsTicket.trim() );
//     eventBus.publish( 'importSpecification.uploadImportFileForImportPDF' );
// };

/**
 * Reset Data from import from excel panel.
 *
 * @param {Object} data - The view model data
 *
 */
export let resetExcelImportData = function( data, sharedData = {} ) {
    let mappingGroupCopy = _.clone( data.mappingGroup );
    mappingGroupCopy.dbValue = '';
    mappingGroupCopy.uiValue = '';
    let newGroupNameCopy = _.clone( data.newGroupName );
    newGroupNameCopy.dbValues = '';
    newGroupNameCopy.isVisible = false;

    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = [];
    sharedData.update && sharedData.update( newSharedData );

    let addFileAsAttachmnt = _.clone( data.addFileAsAttachmnt );
    let preferences = appCtxSvc.getCtx( 'preferences' );
    if( preferences.REQ_AttachImportSpecFileToReqSpec && preferences.REQ_AttachImportSpecFileToReqSpec[ 0 ] === 'true' ) {
        addFileAsAttachmnt.dbValue  = true;
    }

    return {
        isValidMapping:false,
        showPropertiesMap: false,
        columnHeaders: [],
        typePropInfos: [],
        objectSubTypes: [],
        propertiesForMapping:[],
        viewModelPropertiesForHeader: [],
        propertiesToSelect:{},
        mappingGroup: mappingGroupCopy,
        newGroupName:newGroupNameCopy,
        addFileAsAttachmnt: addFileAsAttachmnt
    };
};
/**
 * Reset NewGroupName Visibilty for import from excel panel.
 *
 * @param {Object} data - The view model data
 *
 */
export let resetNewGroupNameVisibilty = function( data ) {
    let newGroupName = _.clone( data.newGroupName );
    newGroupName.isVisible = false;
    newGroupName.dbValue = '';
    return newGroupName;
};

/**
 * Create view model property for the header
 *
 * @param {Object} header - Header string
 * @returns {Object} viewModelObject - view model object for the given header
 */
var _createViewModelPropertyForHeader = function( header ) {
    // Create the Viewmodel property for the given attribute type.
    var viewProp = uwPropertyService.createViewModelProperty( header, header, 'STRING', [], [] );

    uwPropertyService.setHasLov( viewProp, true );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEnabled( viewProp, true );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );

    viewProp.editLayoutSide = true;
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_SIDE' );
    viewProp.dataProvider = 'LOVDataProvider';
    return viewProp;
};

/**
 * Create view model property for the property info
 *
 * @param {Object} propInfo - Property info
 * @returns {Object} viewModelObject - view model object for the given property info
 */
var _createViewModelObjectForProperty = function( propInfo ) {
    // Append "(Required)" to the display name, if property is required
    var dispPropName = propInfo.dispPropName;
    if( propInfo.isRequired ) {
        dispPropName = propInfo.dispPropName + ' (' + parentData.i18n.requiredLabel + ')';
    }

    var viewProp = uwPropertyService.createViewModelProperty( propInfo.realPropName, dispPropName, 'BOOLEAN', [], [] );

    uwPropertyService.setIsRequired( viewProp, propInfo.isRequired );
    uwPropertyService.setIsArray( viewProp, false );
    uwPropertyService.setIsEditable( viewProp, true );
    uwPropertyService.setIsNull( viewProp, false );
    uwPropertyService.setPropertyLabelDisplay( viewProp, 'PROPERTY_LABEL_AT_RIGHT' );
    if( viewProp.isRequired ) {
        uwPropertyService.setValue( viewProp, true );
        uwPropertyService.setIsEnabled( viewProp, false );
    } else {
        uwPropertyService.setValue( viewProp, false );
        uwPropertyService.setIsEnabled( viewProp, true );
    }

    // attributes required to show property in lov
    viewProp.propDisplayValue = viewProp.propertyDisplayName;
    viewProp.propInternalValue = viewProp.propertyName;

    return viewProp;
};

/**
  * Adds property to the array of it is not already available in the passed array.
  * @param {*} arrayOfProps Array of properties
  * @param {*} vmProp : View Model Property
  */
let addPropertyValueToArray = function( arrayOfProps, vmProp ) {
    let hasProperty1 = _getPropertyFromList( arrayOfProps, vmProp.propInternalValue );
    // Avoid duplicate property in list
    if( !hasProperty1 ) {
        arrayOfProps.push( {
            propDisplayValue: vmProp.propertyDisplayName,
            propInternalValue: vmProp.propertyName,
            isRequired: vmProp.isRequired
        } );
    }
};

export let getLOVValues = ( propertiesForMapping ) => {
    let lovEntries = [];
    for( let index = 0; index < propertiesForMapping.length; index++ ) {
        let vmProp = propertiesForMapping[ index ];
        addPropertyValueToArray( lovEntries, vmProp );
    }
    lovEntries.push( {
        propDisplayValue: parentData.i18n.addNew,
        propInternalValue: ADD_NEW_INTERNAL
    } );
    return {
        lovData: lovEntries,
        totalFound: lovEntries.length
    };
};

/**
 * Sort the boolean list. True values first
 *
 * @param {Object} list - List to sort
 */
var _sortBooleanList = function( list ) {
    list.sort( function( a, b ) {
        // true values first
        return a.isRequired === b.isRequired ? 0 : a.isRequired ? -1 : 1;
    } );
};
/**
 * Find the given property in properties list
 *
 * @param {List} properties - list of selected properties
 * @param {String} propertyRealName - property real name
 * @returns {Boolean} - true, if property exist in the list
 */
var _getPropertyFromList = function( properties, propertyRealName ) {
    for( var index = 0; index < properties.length; index++ ) {
        var property = properties[ index ];
        if( property.propertyName === propertyRealName || property.propInternalValue === propertyRealName ) {
            return property;
        }
    }
    return null;
};
/**
 * Update Properties with selected properties
 *
 * @param {Object} data - The view model data
 *
 */
export let updatePropertiesForMapping = function( typePropInfos, viewModelPropertiesForHeader ) {
    let propertiesForMapping = [];

    // Get selected properties
    for( var index = 0; index < typePropInfos.length; index++ ) {
        var typePropInfo = typePropInfos[ index ];

        var propInfos = typePropInfo.propInfos;

        for( var i = 0; i < propInfos.length; i++ ) {
            var propInfo = propInfos[ i ];
            // Add required/selected properties to the list
            if( propInfo.dbValue ) {
                propertiesForMapping.push( propInfo );
            }
        }
    }

    // Update lov with selected properties
    for( var index = 0; index < viewModelPropertiesForHeader.length; index++ ) {
        var viewProp = viewModelPropertiesForHeader[ index ];
        // Reset the mapped property, if that property not selected for mapping
        var hasProperty = _getPropertyFromList( propertiesForMapping, viewProp.dbValue );
        if( !hasProperty ) {
            uwPropertyService.resetValues( viewProp );
        }
    }
    return propertiesForMapping;
};
/**
 * Populate View Model Properties For Header
 *
 * @param {Object} data - The view model data
 *
 */
var _populateViewModelPropertiesForHeader = function( data, viewModelPropertiesForHeader ) {
    for( var i = 0; i < data.viewModelPropertiesForHeader.length; i++ ) {
        viewModelPropertiesForHeader[ i ].matchFound = 0;
        for( var j = 0; j < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length; j++ ) {
            if( data.viewModelPropertiesForHeader[ i ].propertyName === data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ].propHeader ) {
                viewModelPropertiesForHeader[ i ].dbValue = data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ].realPropName;
                viewModelPropertiesForHeader[ i ].uiValue = data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ].dispPropName;
                viewModelPropertiesForHeader[ i ].matchFound = 1;
                break;
            }
        }
        if( viewModelPropertiesForHeader[ i ].matchFound === 0 ) {
            viewModelPropertiesForHeader[ i ].dbValue = '';
            viewModelPropertiesForHeader[ i ].uiValue = '';
        }
    }
};
/**
 * Populate Mappings In LOV
 *
 * @param {Object} data - The view model data
 *
 */
var _populateMappingsInLOV = function( data, viewModelPropertiesForHeader, propertiesForMapping ) {
    for( var index = 0; index < data.typePropInfos.length; index++ ) {
        var typePropInfo = data.typePropInfos[ index ];

        var propInfos = typePropInfo.propInfos;
        for( var j = 0; j < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length; j++ ) {
            for( var i = 0; i < propInfos.length; i++ ) {
                var propInfo = propInfos[ i ];
                // Add required/selected properties to the list
                if( data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ].realPropName === propInfo.propInternalValue ) {
                    propInfo.dbValue = true;
                    propertiesForMapping.push( propInfo );

                    if( propInfo.isRequired ) {
                        for( var k = 0; k < viewModelPropertiesForHeader.length; k++ ) {
                            if( viewModelPropertiesForHeader[ k ].uiValue === data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ].dispPropName ) {
                                viewModelPropertiesForHeader[k].uiValue += ' (' + parentData.i18n.requiredLabel + ')';
                            }
                        }
                    }
                    break;
                }
            }
        }
    }
    for( var k = 0; k < viewModelPropertiesForHeader.length; k++ ) {
        viewModelPropertiesForHeader[ k ].isEnabled = data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable;
    }
};
/**
 * Get Mappings for the group selected
 *
 * @param {Object} data - The view model data
 *
 */
export let populateMappingInfoForGroup = function( data ) {
    if( data.selectedMapping.mappingOutputs.length > 0 && data.selectedMapping.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        if( data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
            let viewModelPropertiesForHeader = _.clone( data.viewModelPropertiesForHeader );
            let propertiesForMapping = _.clone( data.propertiesForMapping );
            _populateViewModelPropertiesForHeader( data, viewModelPropertiesForHeader );
            _populateMappingsInLOV( data, viewModelPropertiesForHeader, propertiesForMapping );
            let isValidMapping = false;
            if ( _isValidMapping( viewModelPropertiesForHeader ) ) {
                isValidMapping = true;
            }
            return{
                viewModelPropertiesForHeader:viewModelPropertiesForHeader,
                propertiesForMapping:propertiesForMapping,
                isValidMapping:isValidMapping
            };
        }
    }
};

/**
 * Get headers and properties from response data.
 *
 * @param {Object} data - The view model data
 *
 */
export let createPropertiesMap = function( data, sharedData = {} ) {
    parentData = data;
    let showPropertiesMap = true;
    let columnHeaders = [];
    let typePropInfos = [];

    if( data.response.mappingOutputs[ 0 ].propInfos.length === 0 ) {
        columnHeaders = _.clone( data.response.columnHeaders, true );
    }
    for( var i = 0; i < data.response.mappingOutputs[ 0 ].propInfos.length; i++ ) {
        columnHeaders.push( data.response.mappingOutputs[ 0 ].propInfos[ i ].propHeader );
    }
    typePropInfos = _.clone( data.response.mappingOutputs[ 0 ].typePropInfos, true );

    let objectSubTypes = [];
    let propertiesForMapping = [];

    // Create view model properties for properties
    for( var index = 0; index < typePropInfos.length; index++ ) {
        var typePropInfo = typePropInfos[ index ];
        var objectType = {};
        objectType.propDisplayValue = typePropInfo.dispTypeName;
        objectType.propInternalValue = typePropInfo.objectType;
        objectSubTypes.push( objectType );

        var propInfos = typePropInfo.propInfos;

        for( var i = 0; i < propInfos.length; i++ ) {
            propInfos[ i ] = _createViewModelObjectForProperty( propInfos[ i ] );
        }

        _sortBooleanList( propInfos );
    }
    let mappingGroup = _.clone( data.mappingGroup );

    let viewModelPropertiesForHeader = [];
    // Create view model properties for headers
    for( var index = 0; index < columnHeaders.length; index++ ) {
        var header = columnHeaders[ index ];
        var viewProp = _createViewModelPropertyForHeader( header );
        viewModelPropertiesForHeader.push( viewProp );
    }
    const newSharedData = { ...sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    sharedData.update && sharedData.update( newSharedData );

    propertiesForMapping = updatePropertiesForMapping( typePropInfos, viewModelPropertiesForHeader );
    return {
        showPropertiesMap,
        columnHeaders,
        typePropInfos,
        objectSubTypes,
        propertiesForMapping,
        viewModelPropertiesForHeader,
        mappingGroup
    };
};

/**
 * Validate if all required properties are mapped.
 *
 * @returns {Boolean} - true, if all required properties are mapped
 *
 */
var _isValidMapping = function( viewModelPropertiesForHeader ) {
    for( var index = 0; index < parentData.propertiesForMapping.length; index++ ) {
        var property = parentData.propertiesForMapping[ index ];
        if( property.isRequired ) {
            var requiredProperyName = property.propertyName;
            var isMapped = false;
            for( var i = 0; i < viewModelPropertiesForHeader.length; i++ ) {
                var viewProp = viewModelPropertiesForHeader[ i ];
                if( viewProp.dbValue === requiredProperyName ) {
                    isMapped = true;
                }
            }
            if( !isMapped ) {
                return false;
            }
        }
    }
    return true;
};


/**
 * Fire an event to navigate to the Add Properties panel
 */
var _navigateToAddNewPropertiesPanel = function() {
    // Clone the properties data
    parentData.typePropInfosToAddProperties = _.clone( parentData.typePropInfos, true );

    var destPanelId = 'Arm0AddPropertiesSub';
    var activePanel = parentData.getSubPanel( parentData.activeView );
    if( activePanel ) {
        activePanel.contextChanged = true;
    }

    var context = {
        destPanelId: destPanelId,
        title: parentData.i18n.addProperties,
        supportGoBack: true,
        recreatePanel: true
    };

    eventBus.publish( 'awPanel.navigate', context );
};
/**
 * Create LOV entries.
 *
 * @param {Object} - lovApi
 * @param {Array} - lovEntries
 * @param {Boolean} - true, getRequiredProps
 *
 */
var _createLovEntries = function( lovApi, lovEntries, getRequiredProps ) {
    for( var index = 0; index < lovApi.propertiesForMapping.length; index++ ) {
        var entry = lovApi.propertiesForMapping[ index ];

        if( getRequiredProps ) {
            if( entry.isRequired ) {
                var hasProperty = _getPropertyFromList( lovEntries, entry.propertyName );
                // Avoid duplicate property in list
                if( !hasProperty ) {
                    lovEntries.push( {
                        propDisplayValue: entry.propertyDisplayName,
                        propInternalValue: entry.propertyName,
                        propDisplayDescription: '',
                        hasChildren: false,
                        children: {},
                        sel: false,
                        isRequired: entry.isRequired
                    } );
                }
            }
        } else {
            if( !entry.isRequired ) {
                var hasProperty1 = _getPropertyFromList( lovEntries, entry.propertyName );
                // Avoid duplicate property in list
                if( !hasProperty1 ) {
                    lovEntries.push( {
                        propDisplayValue: entry.propertyDisplayName,
                        propInternalValue: entry.propertyName,
                        propDisplayDescription: '',
                        hasChildren: false,
                        children: {},
                        sel: false,
                        isRequired: entry.isRequired
                    } );
                }
            }
        }
    }
};
/**
 * Reset ViewModelProperty Value
 *
 * @param {ViewModelProperty} viewProp - view model property
 */
var _resetViewModelPropertyValue = function( viewProp ) {
    viewProp.displayValues = [ '' ];
    viewProp.uiValue = '';
    viewProp.dbValue = '';
};

/**
 * To retrieve the rule object for the selected rule name
 *
 * @param {Object} data - The view model data
 *
 */
export let getRuleObjectForSelection = function( data, sharedData ) {
    var object = {};
    for( var i = 0; i < sharedData.ruleList.length; i++ ) {
        if( data.savedRules.dbValue === sharedData.ruleList[ i ].ruleName ) {
            object = sharedData.ruleList[ i ];
            break;
        }
    }
    if( !_.isEmpty( object ) ) {
        object.ruleObject = {
            uid: object.ruleObject.uid,
            type: object.ruleObject.type
        };

        data.selectedRule = object;
    }
    const newsharedData = { ...sharedData.value };
    newsharedData.selectedRule = object;
    sharedData.update && sharedData.update( newsharedData );
    return object;
};

/**
 * Handles import word rule selection from listbox
 *
 * @param {Object} data - The view model data
 *
 */
// var latest_saved_rule = null;
// var current_selected_saved_rule = null;
// export let wordRuleSelectionChangeInListBox = function( data, sharedData ) {
//     const newsharedData = { ...sharedData.value };
//     latest_saved_rule = newsharedData.current_ruleData;
//     var updateRuleList = true;
//     if( data.savedRules.dbValue !== '' ) {
//         current_selected_saved_rule = data.savedRules.dbValue;
//     }
//     //When user has clicked on Save rule, We dont want recalculate ruleList
//     if( newsharedData.savedRuleClicked === true ) {
//         updateRuleList = false;
//         newsharedData.savedRuleClicked = false;
//         current_selected_saved_rule = latest_saved_rule;
//         data.savedRules.dbValue = current_selected_saved_rule;
//         data.savedRules.uiValue = current_selected_saved_rule;
//     }
//     //When user has clicked on back button, We dont want recalculate ruleList
//     if( newsharedData.backButtonForRuleClicked === true ) {
//         updateRuleList = false;
//         newsharedData.backButtonForRuleClicked = false;
//     }
//     //When user has clicked on preview button, We dont want recalculate ruleList
//     if( newsharedData.previewClicked === true ) {
//         updateRuleList = false;
//         newsharedData.previewClicked = false;
//         data.savedRules.dbValue = current_selected_saved_rule;
//         data.savedRules.uiValue = current_selected_saved_rule;
//     }
//     sharedData.update && sharedData.update( newsharedData );
//     if( updateRuleList === true ) {
//         if( data.savedRules.dbValue !== '' ) {
//             var selectedRule = exports.getRuleObjectForSelection( data, sharedData );
//             if( !_.isEmpty( selectedRule ) ) {
//                 exports.removeAllRules( data, sharedData );
//                 eventBus.publish( 'importSpecification.populateInfoForRule' );
//                 data.typeOfRuleMap = {};
//                 data.typeOfPropRuleMap = {};
//             }
//         } else {
//             exports.removeAllRules( data, sharedData );
//             eventBus.publish( 'ImportFromOffice.refreshImportRuleList' );
//             data.typeOfRuleMap = {};
//             data.typeOfPropRuleMap = {};
//         }
//     }
// };

/**
 * Add the 'lovApi' function set import ruules to the given ViewModelProperty
 *
 * @param {Object} data - The view model data
 *
 */
export let initRuleLovApi = function( data, sharedData ) {
    var savedRulesListBoxValues = [];
    var listModel1 = {
        propDisplayValue: '',
        propInternalValue: '',
        propDisplayDescription: '',
        sel: false
    };
    savedRulesListBoxValues.push( listModel1 );
    var propertiesForMapping = data.response.rulesData;
    for( var index = 0; index < propertiesForMapping.length; index++ ) {
        var entry = propertiesForMapping[ index ];
        var listModel = {
            propDisplayValue: '',
            propInternalValue: '',
            propDisplayDescription: '',
            sel: false
        };
        listModel.propDisplayValue = entry.ruleDispName;
        listModel.propInternalValue = entry.ruleName;
        savedRulesListBoxValues.push( listModel );
    }

    const newsharedData = { ...sharedData.value };
    newsharedData.ruleList = data.response.rulesData;
    newsharedData.savedRulesListBoxValues = savedRulesListBoxValues;
    sharedData.update && sharedData.update( newsharedData );
    return savedRulesListBoxValues;
};
/**
 * Add the selected properties in list for mapping
 *
 * @param {Object} data - The view model data
 *
 */
export let addNewPropertiesForMapping = function(  subPanelContext ) {
    // Switch the active back to the previous panel
    const newSharedData = { ...subPanelContext.sharedData.value };
    if( newSharedData.launchFrom === 'ImportFromOffice' ) {
        newSharedData.activeView = 'Arm0ImportFromOfficeSub';
    } else{
        newSharedData.activeView = 'Arm0ExcelImportSub';
    }
    subPanelContext.sharedData.update && subPanelContext.sharedData.update( newSharedData );
};

/**
 * Get all properties for the selected subtype
 *
 * @param {Object} data - The view model data
 * @param {Object} subType - selected subType
 *
 */
var _getPropertiesFromSubType = function( typePropInfos, subType ) {
    if ( typePropInfos !== undefined ) {
        for( var index = 0; index < typePropInfos.length; index++ ) {
            var typePropInfo = typePropInfos[ index ];
            if( typePropInfo.objectType === subType ) {
                return typePropInfo.propInfos;
            }
        }
    }

    return [];
};
/**
 * Get the filtered properties
 *
 * @param {Object} filter - Filter value
 * @param {Object} data - The view model data
 * @param {Object} subType - selected subType
 *
 */
var _getFilteredProperties = function( filter, typePropInfos, subType ) {
    var propertiesToSelect = [];

    // Get propInfos for the selected subType
    var propInfos = _getPropertiesFromSubType( typePropInfos, subType );

    var filterValue = filter.toLocaleLowerCase().replace( /\\|\s/g, '' );

    // We have a filter, don't add properties unless the filter matches
    if( filterValue !== '' ) {
        for( var i = 0; i < propInfos.length; i++ ) {
            var propInfo = propInfos[ i ];
            var propertyName = propInfo.propertyName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            var propertyDisplayName = propInfo.propertyDisplayName.toLocaleLowerCase().replace( /\\|\s/g, '' );
            if( propertyName.indexOf( filterValue ) !== -1 || propertyDisplayName.indexOf( filterValue ) !== -1 ) {
                propertiesToSelect.push( propInfo );
            }
        }
    } else {
        propertiesToSelect = propInfos;
    }

    return propertiesToSelect;
};
/**
 * Action on the filter
 *
 * @param {Object} data - The view model data
 * @param {Object} subType - Selected subType
 *
 */
export let actionFilterList = function( data, typePropInfos, subType ) {
    var filter = '';
    if( 'filterBox' in data && 'dbValue' in data.filterBox ) {
        filter = data.filterBox.dbValue;
    }

    return _getFilteredProperties( filter, typePropInfos, subType );
};
/**
 * Show leave warning message
 *
 * @param {Object} data - The view model data
 */
var _showUpdateNotificationWarning = function( data, returnObj ) {
    var mappingGroupData = {
        groupName: {
            realName: '',
            dispName: '',
            isModifiable: true
        },
        mappingInfo: [],
        actionName: ''
    };

    var msg = data.i18n.notificationForUpdateMsg.replace( '{0}', returnObj.mappedGroupData.groupName.dispName );
    var buttons = [ {
        addClass: 'btn btn-notify',
        text: data.i18n.cancel,
        onClick: function( $noty ) {
            $noty.close();
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: mappingGroupData } );
            data.dispatch( { path: 'data.runInBackgroundOptionForExcel', value: returnObj.runInBackgroundOptionForExcel } );
            eventBus.publish( 'importSpecification.importFromExcel' );
        }
    }, {
        addClass: 'btn btn-notify',
        text: data.i18n.update,
        onClick: function( $noty ) {
            $noty.close();
            data.dispatch( { path: 'data.headerPropertyMapping', value: returnObj.headerPropertyMapping } );
            data.dispatch( { path: 'data.mappedGroupData', value: returnObj.mappedGroupData } );
            data.dispatch( { path: 'data.runInBackgroundOptionForExcel', value: returnObj.runInBackgroundOptionForExcel } );
            eventBus.publish( 'importSpecification.importFromExcel' );
        }
    } ];

    notyService.showWarning( msg, buttons );
};
/**
 * Get ActionName For Mapping
 *
 * @param {Object} data - The view model data
 *
 */
var _getActionNameForMapping = function( data, mappingGroupData ) {
    var headerCount = 0;
    var mappingInfo = {};
    var mappingOutputs = {};
    mappingGroupData.actionName = 'ADD';
    if( data.response.mappingOutputs[ 0 ].mappingGroups.length > 0 ) {
        for( let j = 0; j < data.response.mappingOutputs[ 0 ].mappingGroups.length; j++ ) {
            if( data.mappingGroup.dbValue === data.response.mappingOutputs[ 0 ].mappingGroups[ j ].dispName ) {
                mappingGroupData.actionName = '';
                break;
            }
        }
    }
    if( mappingGroupData.actionName === '' && data.selectedMapping.mappingOutputs[ 0 ].mappingGroups.length === 1 &&
        data.mappingGroup.dbValue === data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].dispName ) {
        if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable ) {
            mappingGroupData.actionName = 'UPDATE';
            for( var j = 0; j < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length; j++ ) {
                for( var k = 0; k < mappingGroupData.mappingInfo.length; k++ ) {
                    mappingInfo = mappingGroupData.mappingInfo[ k ];
                    mappingOutputs = data.selectedMapping.mappingOutputs[ 0 ].propInfos[ j ];
                    if( mappingInfo.propHeader === mappingOutputs.propHeader ) {
                        headerCount++;
                        mappingGroupData.actionName = '';
                        if( mappingInfo.realPropName !== mappingOutputs.realPropName ||
                            mappingInfo.dispPropName !== mappingOutputs.dispPropName ) {
                            mappingGroupData.actionName = 'UPDATE';
                            break;
                        }
                    }
                }
            }
        } else if( data.selectedMapping.mappingOutputs[ 0 ].mappingGroups[ 0 ].isModifiable === false ) {
            mappingGroupData.actionName = '';
        }
    }
    if( headerCount !== 0 &&
        ( headerCount < data.selectedMapping.mappingOutputs[ 0 ].propInfos.length || headerCount < mappingGroupData.mappingInfo.length ) ) {
        mappingGroupData.actionName = 'UPDATE';
    }
    return mappingGroupData.actionName;
};

/**
 * Get input data for Import from Excel
 *
 * @param {Object} data - The view model data
 * @return {Any} input data for import
 */
export let getExcelImportInput = function( data, ctx ) {
    let headerPropertyMapping = [];
    exports.registerExcelData( ctx );
    let runInBackgroundOptionForExcel = [];
    var propInfos = [];
    var mappingGroupData = {
        groupName: {
            realName: '',
            dispName: '',
            isModifiable: true
        },
        mappingInfo: [],
        actionName: ''
    };
    var mappingGroupData1 = mappingGroupData;

    if( data.mappingGroup.dbValue ) {
        mappingGroupData.groupName.realName = data.mappingGroup.dbValue;
        mappingGroupData.groupName.dispName = data.mappingGroup.dbValue;
    } else if( data.newGroupName.dbValue ) {
        mappingGroupData.groupName.realName = data.newGroupName.dbValue;
        mappingGroupData.groupName.dispName = data.newGroupName.dbValue;
        mappingGroupData.actionName = 'ADD';
    }

    for( var index = 0; index < data.viewModelPropertiesForHeader.length; index++ ) {
        var viewProp = data.viewModelPropertiesForHeader[ index ];
        if( viewProp.dbValue && !_.isArray( viewProp.dbValue ) ) {
            var dispProp = viewProp.uiValue.replace( ' (' + parentData.i18n.requiredLabel + ')', '' );
            var prop = {
                propHeader: viewProp.propertyName,
                dispPropName: dispProp,
                realPropName: viewProp.dbValue,
                isRequired: false
            };
            if( dispProp !== viewProp.uiValue ) {
                prop.isRequired = true;
            }

            propInfos.push( prop );
        }
    }
    var propInfo = {
        propInfos: propInfos,
        dispTypeName: '',
        objectType: ''

    };

    headerPropertyMapping.push( propInfo );
    let mappedGroupData = mappingGroupData;

    var runInBackgroundOption = 'RunInBackground';

    if( !data.runInBackgroundExcel.dbValue ) {
        runInBackgroundOption = '';
        exports.registerExcelData( ctx );
    }

    runInBackgroundOptionForExcel.push( runInBackgroundOption );

    if( mappingGroupData.groupName.dispName ) {
        mappingGroupData.mappingInfo = propInfos;
        if( mappingGroupData.actionName === '' ) {
            mappingGroupData.actionName = _getActionNameForMapping( data, mappingGroupData );
        }
        mappedGroupData = mappingGroupData;
        if( mappedGroupData.actionName === 'UPDATE' && data.newGroupName.isVisible === false ) {
            let returnObj = {
                headerPropertyMapping: headerPropertyMapping,
                mappedGroupData: mappedGroupData,
                runInBackgroundOptionForExcel: runInBackgroundOptionForExcel
            };
            _showUpdateNotificationWarning( data,  returnObj );
            return;
        } else if( mappingGroupData.actionName === '' ) {
            mappedGroupData = mappingGroupData1;
        }
    }

    return{
        headerPropertyMapping,
        mappedGroupData,
        runInBackgroundOptionForExcel
    };
};

/**
 * adding one variable in data for Import Preview Event capture
 *
 * @param {Object} data - The view model data
 */
export let getTransientFileTicketsForImportPreview = function( data ) {
    var importPreviewBtnClicked = true;

    eventBus.publish( 'progress.start' );
    return importPreviewBtnClicked;
};

/**
 * adding one variable in data for Import Preview Event capture
 *
 * @param {Object} ctx - The context object
 */
export let getTransientFileTicketsForCompareAndPreview = function( ctx ) {
    appCtxSvc.registerCtx( 'compareAndPreviewBtnClicked', true );
    appCtxSvc.registerCtx( 'compareClick', true );
    eventBus.publish( 'progress.start' );
};
/**
 * Reset the filter, when subType gets changed.
 *
 * @param {Object} data - The view model data
 */
export let resetPropertiesFilter = function( data ) {
    data.filterBox.displayName = '';
    data.filterBox.dbValue = '';
};

/**
 * Register the flags in view model data
 *
 * @param {Object} data - The view model object
 */
export let registerData = function( arm0ImportFromOfficeEventProgressing ) {
    arm0ImportFromOfficeEventProgressing = true;
    return arm0ImportFromOfficeEventProgressing;
};

/**
 * Unregister the flags from view model data
 *
 * @param {Object} data - The view model object
 */
export let unRegisterData = function( arm0ImportFromOfficeEventProgressing ) {
    arm0ImportFromOfficeEventProgressing = false;
    return arm0ImportFromOfficeEventProgressing;
};

/**
 * Returns localized key value
 *
 * @param {Object} labels - i18n labels
 * @return {Array} array of localized key value string
 */
export let getLocalizedLabels = function( labels ) {
    var localizedLabels = [];
    var localizedkeyValue = {};
    localizedkeyValue.label = 'titleLabel';
    localizedkeyValue.localizedLabel = labels.titleLabel;
    localizedLabels.push( localizedkeyValue );
    return localizedLabels;
};

/**
 * Returns preference key value
 *
 * @return {Array} array of import spec preference key value string
 */
export let getImportSpecPreferences = function( ) {
    var importSpecPreference = [];
    var preferenceKeyValue = {};
    if( appCtxSvc.ctx.preferences.REQ_ImportSpec_As_RAC_Structure ) {
        preferenceKeyValue.preferenceName = 'REQ_ImportSpec_As_RAC_Structure';
        preferenceKeyValue.preferenceValue = appCtxSvc.ctx.preferences.REQ_ImportSpec_As_RAC_Structure[0] === 'true';
        importSpecPreference.push( preferenceKeyValue );
    }
    return importSpecPreference;
};
/**
 * Unregister the preview mode data
 */
export let unRegisterPreviewData = function() {
    _selectedRequidForAddChildPreview = null;
    _selectedTCObject = null;
    _existingStructureJSONData = null;
    appCtxSvc.unRegisterCtx( 'importAsChild' );
    appCtxSvc.unRegisterCtx( 'importAsChildSpec' );
    appCtxSvc.unRegisterCtx( 'compareClick' );
    appCtxSvc.unRegisterCtx( 'updatePreviewClick' );
    setJSONData(); // Unset data on import
};

/**
 * Register the flags in view model data for excel import
 *
 * @param {Object} data - The view model object
 */
export let registerExcelData = function( ctx ) {
    appCtxSvc.registerCtx( 'arm0ImportFromOfficeExcelProgressing', true );
};

/**
 * Unregister the flags from view model data for excel import
 *
 * @param {Object} data - The view model object
 */
export let unRegisterExcelData = function( ctx ) {
    appCtxSvc.updateCtx( 'arm0ImportFromOfficeExcelProgressing', false );
};

export let importOptions = function( data ) {
    var importOptions = [];
    importOptions.push( 'RoundTripImport' );
    if( data.conflict.dbValue ) {
        importOptions.push( 'overWrite' );
    }
    return importOptions;
};

export let getCtxSelectedObject = function( data, ctx ) {
    var object = {};
    if( data.mode && data.mode === 'preview' ) {
        object.uid = data.selectedObject.uid;
        object.type = data.selectedObject.type;
    } else {
        object.uid = ctx.selected.uid;
        object.type = ctx.selected.type;
    }
    return object;
};

export let getkeywordImportOptionsForExcel = function( data ) {
    let importOptions = data.runInBackgroundOptionForExcel ? data.runInBackgroundOptionForExcel : [];
    if( data.addFileAsAttachmnt.dbValue ) {
        importOptions.push( 'AttachFile' );
    }
    return importOptions;
};

/**
 * Update shared data with file selection detail.
 *
 * @param {Object} data - The view model object
 * @param {Object} sharedData -shared data object
 */
export let registerSharedData = function( data, sharedData ) {
    var fileName = _.clone( data.fileName, true );
    var validFile = _.clone( data.validFile, true );
    var fileExt = _.clone( data.fileExt, true );
    var fileNameNoExt = _.clone( data.fileNameNoExt, true );

    //var formData = _.clone( data.formData, true );
    var formData = new FormData();
    formData = data.formData;
    const newsharedData = { ...sharedData.value };
    newsharedData.fileName = fileName;
    newsharedData.fileNameNoExt = fileNameNoExt;
    newsharedData.validFile = validFile;
    newsharedData.fileExt = fileExt;
    newsharedData.formData = formData;


    sharedData.update && sharedData.update( newsharedData );
};

export let loadMappingGroups = ( data ) => {
    let mappingLOVs = [];
    for( let index = 0; index < data.response.mappingOutputs[ 0 ].mappingGroups.length; index++ ) {
        let entry = data.response.mappingOutputs[ 0 ].mappingGroups[ index ];

        let hasProperty = _getPropertyFromList( mappingLOVs, entry );
        // Avoid duplicate property in list
        if( !hasProperty ) {
            mappingLOVs.push( {
                propDisplayValue: entry.realName,
                propInternalValue: entry.dispName,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: false
            } );
        }
    }
    // Add entry for "Add New"
    mappingLOVs.push( {
        propDisplayValue: parentData.i18n.addNew,
        propInternalValue: ADD_NEW_INTERNAL,
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    } );
    return mappingLOVs;
};

export let validateMappingGroup = ( data ) => {
    if( data.mappingGroup.dbValue !== '' ) {
        if ( data.mappingGroup.dbValue !== ADD_NEW_INTERNAL ) {
            // fill up below lovs widgets with new mapping group from server
            eventBus.publish( 'importSpecification.populateMappingGroups' );
        } else {
            let mappingGroupCopy = _.clone( data.mappingGroup );
            mappingGroupCopy.displayValues = [ '' ];
            mappingGroupCopy.uiValue = '';
            mappingGroupCopy.dbValue = '';
            let viewModelPropertiesForHeader = _.clone( data.viewModelPropertiesForHeader );
            for( let i = 0; i < viewModelPropertiesForHeader.length; i++ ) {
                viewModelPropertiesForHeader[ i ].isEnabled = true;
            }
            let newGroupName = _.clone( data.newGroupName );
            newGroupName.isVisible = true;
            return {
                viewModelPropertiesForHeader,
                mappingGroupCopy,
                newGroupName
            };
        }
    }
};

export let switchView = ( dataProvider, viewModelPropertiesForHeader, propertiesForMapping, sharedData = {} ) => {
    let vmProps = _.clone( viewModelPropertiesForHeader );
    for( let i = 0; i < vmProps.length; i++ ) {
        if( vmProps[i].dbValue === ADD_NEW_INTERNAL ) {
            _resetViewModelPropertyValue( vmProps[i] );
            const newSharedData = { ...sharedData.value };
            newSharedData.activeView = 'Arm0AddPropertiesSub';
            sharedData.update && sharedData.update( newSharedData );
            break;
        }
    }
    return _isValidMapping( viewModelPropertiesForHeader );
};

export let getObjectSubTypes = ( typePropInfos ) => {
    let objectSubTypes = [];
    for( let index = 0; index < typePropInfos.length; index++ ) {
        let typePropInfo = typePropInfos[ index ];
        let objectType = {
            propDisplayValue: typePropInfo.dispTypeName,
            propInternalValue: typePropInfo.objectType
        };
        objectSubTypes.push( objectType );
    }
    return objectSubTypes;
};

export let setInitialValueForSubType = ( subTypes, objectSubTypes ) => {
    if( objectSubTypes && objectSubTypes.length > 0 ) {
        let subTypesCopy = { ...subTypes };
        subTypesCopy.uiValue = objectSubTypes[0].propDisplayValue;
        subTypesCopy.dbValue = objectSubTypes[0].propInternalValue;
        return subTypesCopy;
    }
};

export let updateProperties = ( data, sharedData = {} ) => {
    let typePropInfos = data.subPanelContext.sharedData.typePropInfos;
    for( let j = 0; j < typePropInfos.length; j++ ) {
        let typePropInfo = typePropInfos[ j ];
        if( typePropInfo.objectType === data.subTypes.dbValue ) {
            let propInfos = typePropInfo.propInfos;
            for( let i = 0; i < data.propertiesToSelect.length; i++ ) {
                let vmProp = data.propertiesToSelect[ i ];
                for( let k = 0; k < propInfos.length; k++ ) {
                    if( vmProp.propDisplayValue === propInfos[ k ].propDisplayValue ) {
                        propInfos[ k ] = vmProp;
                    }
                }
            }
            typePropInfos[ j ].propInfos = propInfos;
            break;
        }
    }
    const newSharedData = { ...data.subPanelContext.sharedData.value };
    newSharedData.typePropInfos = typePropInfos;
    sharedData.update && sharedData.update( newSharedData );
};


/**
 * Add the selected properties in list for mapping
 *
 * @param {Object} data - The view model data
 *
 */
export let Arm0AddPropertiesSubbackAction = function(  subPanelContext ) {
    // Switch the active back to the previous panel
    const newSharedData = { subPanelContext };
    if( newSharedData.subPanelContext.launchFrom === 'ImportFromOffice' ) {
        newSharedData.subPanelContext.activeView = 'Arm0ImportFromOfficeSub';
    } else{
        newSharedData.subPanelContext.activeView = 'Arm0ExcelImportSub';
    }
    return newSharedData.subPanelContext;
};
/**
 * Returns the selected object
 *
 * @return {Object} selected object
 */
export let prepareSelectedSepcData = function( subPanelContext, selectionData ) {
    if( appCtxSvc.ctx.locationContext[ 'ActiveWorkspace:Location' ] !== 'ImportPreviewLocation' ) {
        var selectedSpecObj;
        if( subPanelContext ) {
            var modelObject = selectionData ? selectionData : subPanelContext;
            if( modelObject && modelObject.modelType && modelObject.modelType.typeHierarchyArray && modelObject.modelType.typeHierarchyArray.indexOf( 'Folder' ) > -1 ) {
                selectedSpecObj = {
                    iconURL: getTypeIconURL( modelObject.type ),
                    specName: modelObject.cellHeader1
                };
            } else {
                selectedSpecObj = {
                    iconURL: getTypeIconURL( modelObject.type ),
                    specName: modelObject.cellHeader1 || ( modelObject.props.awb0ArchetypeRevName ? modelObject.props.awb0ArchetypeRevName.dbValues[ 0 ] : null )
                };
            }
        }
        return selectedSpecObj;
    }
};
export const backActionForRule = ( sharedData ) => {
    let newSharedData = { ...sharedData };
    if( newSharedData.launchFrom === 'ImportFromOffice' ) {
        newSharedData.activeView = 'Arm0ImportFromOfficeSub';
    } else{
        newSharedData.activeView = 'Arm0ExcelImportSub';
    }
    newSharedData.backButtonForRuleClicked = true;
    delete newSharedData.RULE_CONST;
    newSharedData.editRuleClicked = false;
    return newSharedData;
};
// export const backActionForPropRule = ( sharedData, preference ) => {
//     var newValue = 'Arm0AddRulesSub';
//     if( preference[ 0 ] === 'true' ) {
//         newValue = 'Arm0AddAdvanceRulesSub';
//     }
//     let newSharedData = { ...sharedData };
//     newSharedData.activeView = newValue;
//     if( newSharedData.PROP_RULE_CONST ) {
//         delete newSharedData.PROP_RULE_CONST;
//         newSharedData.editPropRuleClicked = false;
//     }
//     return newSharedData;
// };
export default exports = {
    showTreeWithContents,
    //compareJSONTree,
    setExisitingJSONData,
    getTransientFileTicketsForPreview,
    //getApplicationFormat,
    //setTreeData,
    //setExistingJSONDataCompare,
    //compareAndSetTreeData,
    //convertComparedSpecContentsToHTML,
    getCompareHtmlServiceURL,
    setUpdateTreeData,
    //removeAllRules,
    //getkeywordImportAdvanceOptions,
    //getkeywordImportOptions,
    updateImportSpecList,
    //initImportRulesData,
    updateImportSpecElementList,
    getRunInBackground,
    getImportAsHtml,
    getImportAsSpec,
    getRootTypeName,
    getSpecificationTypeForImport,
    getSpecificationDisplayTypeForImport,
    //getMicroServiceURL,
    prepareSelectedSepcData,
    checkImportType,
    setJSONDataForImport,
    //getJSONDataForImport,
    resetExcelImportData,
    resetNewGroupNameVisibilty,
    populateMappingInfoForGroup,
    createPropertiesMap,
    getRuleObjectForSelection,
    initRuleLovApi,
    addNewPropertiesForMapping,
    actionFilterList,
    getExcelImportInput,
    getTransientFileTicketsForImportPreview,
    getTransientFileTicketsForCompareAndPreview,
    resetPropertiesFilter,
    registerData,
    unRegisterData,
    unRegisterPreviewData,
    registerExcelData,
    unRegisterExcelData,
    importOptions,
    getCtxSelectedObject,
    //getAddRulePanelType,
    registerCtxforImport,
    unregisterImportRelatedCtx,
    //updateFileContentInFormDataForImportPDF,
    //getRulesInputJsonTextForPDFPreview,
    //wordRuleSelectionChangeInListBox,
    getNewApplicationFormat,
    //getJSONDataForCompareImport,
    updateImportTypesList,
    getLocalizedLabels,
    getImportSpecPreferences,
    getFileName,
    registerSharedData,
    getLOVValues,
    loadMappingGroups,
    validateMappingGroup,
    switchView,
    getObjectSubTypes,
    setInitialValueForSubType,
    updateProperties,
    Arm0AddPropertiesSubbackAction,
    updatePropertiesForMapping,
    //getImportOptionsForWordAndPDF,
    getkeywordImportOptionsForExcel,
    setDisplayType,
    updateDisplayTypes,
    setJSONData,
    backActionForRule
    //backActionForPropRule
};
