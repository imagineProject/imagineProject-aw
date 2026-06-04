// Copyright (c) 2021 Siemens
/* eslint-disable class-methods-use-this */
/* global CKEDITOR */

/**
 * This module provides the abstraction to use different Rich Text Editors.
 *
 * @module js/Ac0CkeditorService
 */

import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import { setCkeditor5ServiceInstance } from 'js/Ac0CkeditorServiceInstance';

let isIE;
let CKEDITOR5;

/**
 * Function to dynamically load Ckeditor5
 *
 * @returns {Object} - Reference of Ckeditor5
 */
function _loadCkeditor5() {
    return import( '@swf/ckeditor5' ).then( v => v.default );
}

/**
 * Function to load correct RichText Editor based on browser compatibility
 * Ckeditor5 supported on all modern browsers except Internet Explorer
 *
 * @returns {Promise} - Promise that will be resolved when editor js is loaded
 */
function _loadRichTextEditor() {
    return new Promise( ( resolve ) => {
        _loadCkeditor5().then(
            function( response ) {
                CKEDITOR5 = response;
                window.CKEDITOR5 = response; // Stored on windows, to aceess it globally
                setCkeditor5ServiceInstance( response );
                resolve( response );
            } );
    } );
}

/**
 * Function to instantiate Classic Rich Text Editor
 *
 * @param {String} elementId - Dom element id to which editor instance needs to be attached
 * @param {Object} config - Configuration to create instance
 * @returns {AwRichTextEditor} - RichText Editor instance
 */
export let create = function( elementId, config, insertImgEvtStr, discItemCkEditorIdRef ) {
    var deferred = AwPromiseService.instance.defer();
    var messageBoxSkeletonLoader = document.getElementById( 'ac0-messageBox-skeleton-loader' );
    var replyBoxSkeletonLoader = document.getElementById( `replySkeleton_${elementId}` );
    var editorContainer = document.getElementById( 'ac0-ckEditor-container' );

    // Show the skeleton loader
    if( messageBoxSkeletonLoader ) {
        messageBoxSkeletonLoader.style.display = 'block';
    }
    if( replyBoxSkeletonLoader ) {
        replyBoxSkeletonLoader.style.display = 'block';
    }
    try{
        _loadRichTextEditor().then(
            function( CKEDITOR ) {
                if( isIE ) {
                    config = config.getCkeditor4Config();
                    if( appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx ) {
                        config.readOnly = true;
                        if( editorContainer ) {
                            editorContainer.classList.add( 'aw-activecollab-disableCKEditor' );
                        }
                    }
                    // Create an instance of the classic Ckeditor4
                    var editor = CKEDITOR.replace( elementId, config );
                    editor.insertImgEvtStr = insertImgEvtStr;
                    editor = new AWCkeditor4( editor );
                    // Hide the skeleton loader and add disable class if necessary
                    if( messageBoxSkeletonLoader ) {
                        messageBoxSkeletonLoader.style.display = 'none';
                    }
                    if( replyBoxSkeletonLoader ) {
                        replyBoxSkeletonLoader.style.display = 'none';
                    }
                    deferred.resolve( editor );
                } else {
                    config = config.getCkeditor5Config();
                    config.extraPlugins = config.extraPlugins ? config.extraPlugins : [];
                    _loadExtraPluginsForCkeditor5( config.extraPlugins ).then( loadedPlugins => { // Dynamic loading of extra plugins
                        config.extraPlugins = loadedPlugins;

                        //Ensure that elementId is not undefined
                        if( discItemCkEditorIdRef && typeof elementId === 'undefined' ) {
                            elementId = discItemCkEditorIdRef;
                        }

                        // Creates an instance of the classic Ckeditor5
                        CKEDITOR.InlineEditor.create( document.querySelector( '#' + elementId ), config ).then( editor5 => {
                            // Hide the skeleton loader and add disable class if necessary
                            messageBoxSkeletonLoader = document.getElementById( 'ac0-messageBox-skeleton-loader' );
                            replyBoxSkeletonLoader = document.getElementById( `replySkeleton_${elementId}` );
                            if( messageBoxSkeletonLoader ) {
                                messageBoxSkeletonLoader.style.display = 'none';
                            }
                            if( replyBoxSkeletonLoader ) {
                                replyBoxSkeletonLoader.style.display = 'none';
                            }
                            editor5 = new AWCkeditor5( editor5 );
                            editor5._instance.commands._commands.get( 'ac0InsertImage' ).setEventStr( insertImgEvtStr );
                            if( appCtxSvc.getCtx( 'Ac0ConvCtx' ).editConvCtx ) {
                                editor5._instance.enableReadOnlyMode( '#' + elementId );
                                if( editorContainer ) {
                                    editorContainer.classList.add( 'aw-activecollab-disableCKEditor' );
                                }
                            }
                            editor5._instance.commands._commands.get( 'ac0InsertImage' ).setEventStr( insertImgEvtStr );
                            // Check if default height is given in config, if yes set height, as ckeditor5 does not support default height in config
                            if( config && config.height ) {
                                editor5.resize( undefined, config.height );
                            }
                            // Check if imageMaxSize is given in config, if yes define a schema to set size for image
                            if( config && config.imageMaxSize ) {
                                editor5.setMaxSizeForImage( config.imageMaxSize );
                            }
                            editor5.preventDefaultKeyboardEvents();
                            deferred.resolve( editor5 );
                        }, elementId );
                    } );
                }
            } );
    } catch ( error ) {
        messageBoxSkeletonLoader = document.getElementById( 'ac0-messageBox-skeleton-loader' );
        replyBoxSkeletonLoader = document.getElementById( `replySkeleton_${elementId}` );
        if( messageBoxSkeletonLoader ) {
            messageBoxSkeletonLoader.style.display = 'none';
        }
        if( replyBoxSkeletonLoader ) {
            replyBoxSkeletonLoader.style.display = 'none';
        }
    }
    return deferred.promise;
};

/**
 * Function to load extra plugins dynamically
 * @param {Array} extraPlugins - String array
 */
async function _loadExtraPluginsForCkeditor5( extraPlugins ) {
    return await Promise.all(
        extraPlugins
    );
}

/**
 * Ckeditor Configuration provider
 * @module js/Ac0CkeditorConfigProviderBase
 */
export class Ac0CkeditorConfigProviderBase {
    getCkeditor4Config() {}
    getCkeditor5Config() {}
}

/**
 * Interface for Rich Text Editor
 */
class AwRichTextEditor {
    constructor( editor ) {
        // Store native instance of editor
        this._instance = editor;
    }

    /**
     * Api to get RichText content from editor
     */
    getData() {}

    /**
     * Api to get plain content from editor
     */
    getText() {}

    /**
     * Api to set RichText content to editor
     *
     * @param {String} content - RichText contents
     */
    setData( content ) {}

    /**
     * Api to know if editor has modified contents
     */
    checkDirty() {}

    /**
     * Api to resize the editor
     * @param {String} width - width in px
     * @param {String} height - width in px
     */
    resize( width, height ) {}

    /**
     * Api to registers a callback function to be executed when an given event is fired from editor
     *
     * @param {String} eventName - Event name
     * @param {Object} callbackFunction - CallBack function
     */
    on( eventName, callbackFunction ) {}

    /**
     * Api to destroy editor instance
     */
    destroy() {}
}

/**
 * Defines Ckeditor5
 */
class AWCkeditor5 extends AwRichTextEditor {
    constructor( editor ) {
        super( editor );
    }

    getData() {
        return this._instance.getData();
    }

    getText() {
        return this._instance.editing.view.getDomRoot().textContent;
    }

    setData( content ) {
        content = content ? content : '';
        this._instance.setData( content );
    }

    checkDirty() {
        this._instance.checkDirty();
    }

    resize( width, height ) {
        this._instance.editing.view.change( writer => {
            if( height ) {
                writer.setStyle( 'height', height + 'px', this._instance.editing.view.document.getRoot() );
            }
            if( width ) {
                writer.setStyle( 'width', width + 'px', this._instance.editing.view.document.getRoot() );
            }
        } );
    }

    on( eventName, callbackFunction ) {
        switch ( eventName ) {
            case 'instanceReady':
                callbackFunction(); // instance is already ready after creation
                break;
            case 'change':
                this._instance.model.document.on( 'change:data', callbackFunction );
                break;
            case 'focus':
                this._instance.model.document.on( 'focus', callbackFunction );
                break;
            case 'blur':
                this._instance.model.document.on( 'blur', callbackFunction );
                break;
            case 'paste':
                this._instance.model.document.on( 'paste', callbackFunction );
                break;
        }
    }

    destroy() {
        this._instance.destroy();
    }

    /**
     * Function to extend schema for image to support height and to support width & height attributes on img
     * It will set given size to image
     *
     * @param {Object} imgMaxSize - Object with width & height information
     */
    setMaxSizeForImage( imgMaxSize ) {
        if( this._instance.model && this._instance.model.schema && this._instance.conversion ) {
            var self = this;
            const schema = this._instance.model.schema;
            const conversion = this._instance.conversion;
            schema.extend( 'image', {
                allowAttributes: [ 'width', 'height' ]
            } );
            // define attribute converter to set image size for loading already inserted image
            conversion.for( 'downcast' ).add( this._modelToViewAttributeConverter( 'width' ) );
            conversion.for( 'downcast' ).add( this._modelToViewAttributeConverter( 'height' ) );
            conversion.for( 'upcast' )
                .elementToElement( {
                    view: {
                        name: 'img',
                        attributes: {
                            src: true,
                            width: true,
                            height: true
                        }
                    },
                    model: ( viewImage, conversionApi ) => {
                        const modelWriter = conversionApi.writer;
                        return modelWriter.createElement( 'image', viewImage.getAttributes() );
                    }
                } )
                .attributeToAttribute( {
                    view: {
                        name: 'img',
                        key: 'width'
                    },
                    model: 'width'
                } )
                .attributeToAttribute( {
                    view: {
                        name: 'img',
                        key: 'height'
                    },
                    model: 'height'
                } );

            // dispatcher to set image size on insert
            this._instance.editing.downcastDispatcher.on( 'attribute:uploadStatus:image', ( evt, insertData, conversionApi ) => {
                insertData;
                if( insertData.attributeNewValue === 'uploading' ) {
                    var modelElement = insertData.item;
                    var viewElement = conversionApi.mapper.toViewElement( insertData.item );
                    const domImg = self._instance.editing.view.domConverter.mapViewToDom( viewElement._children[ 0 ] );
                    domImg.onload = function( e ) {
                        // Delete the listener once to avoid unnecessary calls after attr updates
                        delete domImg.onload;
                        domImg.onload = undefined;
                        // Calculate width & height based on image resolution, calculation copied from clientImage plugin of Ckeditor4
                        var h = e.target.naturalHeight;
                        var w = e.target.naturalWidth;
                        var maxH = imgMaxSize.height;
                        var maxW = imgMaxSize.width;
                        var f = Math.min( maxH ? maxH / h : 1, maxW ? maxW / w : 1, 1 );
                        var heightToSet = h * f;
                        var widthToSet = w * f;

                        // Set Width to modelElement
                        modelElement._setAttribute( 'width', widthToSet + 'px' );
                        modelElement._setAttribute( 'height', heightToSet + 'px' );
                        // Set Width to viewElement
                        viewElement._setAttribute( 'style', 'width:' + widthToSet + 'px;height:' + heightToSet + 'px' );
                        // Set width on img
                        var img = self._getViewImgFromWidget( viewElement );
                        img._setAttribute( 'width', widthToSet );
                        img._setAttribute( 'height', heightToSet );
                    };
                }
            } );
        }
    }

    /**
     * Add attributes from model to img view element
     *
     * @param {String} attributeKey - attribute name
     * @returns {Object} - Attribute dispatcher
     */
    _modelToViewAttributeConverter( attributeKey ) {
        return dispatcher => {
            dispatcher.on( 'attribute:' + attributeKey + ':image', ( evt, data, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const figure = conversionApi.mapper.toViewElement( data.item );
                const img = this._getViewImgFromWidget( figure );

                if( data.attributeNewValue !== null ) {
                    // Set Attribute on img
                    viewWriter.setAttribute( data.attributeKey, data.attributeNewValue, img );

                    // Set attribute as a style on figure view element, on figure it needs value in px
                    var styleAttr = figure.getAttribute( 'style' );
                    var styleAttrValue = '';
                    var isAttributeAddedInStyle = false;
                    var attributeNewValue = data.attributeNewValue.endsWith( 'px' ) ? data.attributeNewValue : data.attributeNewValue + 'px';
                    if( styleAttr ) {
                        var styleAttrArray = styleAttr.split( ';' );
                        styleAttrArray.forEach( function( item ) {
                            if( item && item.indexOf( attributeKey ) >= 0 ) {
                                styleAttrValue = styleAttrValue + data.attributeKey + ':' + attributeNewValue + ';';
                                isAttributeAddedInStyle = true;
                            } else {
                                styleAttrValue = styleAttrValue + item + ';';
                            }
                        } );
                    }
                    if( !isAttributeAddedInStyle ) {
                        styleAttrValue = styleAttrValue + data.attributeKey + ':' + attributeNewValue + ';';
                    }
                    viewWriter.setAttribute( 'style', styleAttrValue, figure );
                }
            } );
        };
    }

    /**
     * Function to return img element from given figure view element
     *
     * @param {Object} figureView - View element for figure
     * @returns {Object} - img view element
     */
    _getViewImgFromWidget( figureView ) {
        return Array.from( figureView.getChildren() ).find( viewChild => viewChild.is( 'img' ) );
    }

    /**
     * Prevents launching default keyboard event once event handled inside ckeditor
     */
    preventDefaultKeyboardEvents() {
        [ 'keydown', 'keyup' ].forEach( eventName => {
            this._instance.editing.view.document.on( eventName, ( evt, data ) => {
                var keyId = data.keyCode;
                var ctrl = data.ctrlKey;
                if( ctrl && keyId !== 17 && keyId === 86 ) { // KeyCode: Ctrl - 17, V - 86
                    data.stopPropagation(); // Stop propogation on Ctrl + V
                }
            }, { priority: 'highest' } );
        } );
    }
}

/**
 * Defines Ckeditor4
 */
class AWCkeditor4 extends AwRichTextEditor {
    constructor( editor ) {
        super( editor );
    }

    getData() {
        return this._instance.getData();
    }

    getText() {
        return this._instance.document.getBody().getText();
    }

    setData( content ) {
        this._instance.setData( content );
    }

    checkDirty() {
        this._instance.checkDirty();
    }

    resize( width, height ) {
        width = width ? width : this._instance.width;
        height = height ? height : this._instance.height;
        this._instance.resize( width, height );
    }

    on( eventName, callbackFunction ) {
        this._instance.on( eventName, callbackFunction );
    }

    destroy() {
        this._instance.destroy();
    }
}

export default {
    create
};
