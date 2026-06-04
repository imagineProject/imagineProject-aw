// Copyright (c) 2024 Siemens

/* global SVGEDITOR */

/**
 * AW Svg Edit service
 *
 * @module js/Awp0SvgEditService
 */
import { getBaseUrlPath } from 'app';
import AwPromiseService from 'js/awPromiseService';
import localeSvc from 'js/localeService';
import eventBus from 'js/eventBus';
import $ from 'jquery';
import _ from 'lodash';
import SvgEditor from '@swf/svgedit/dist/editor/Editor';
import svgEditStyle from '@swf/svgedit/dist/editor/svgedit.css';
import markupModel from 'js/MarkupModel';
import MarkupService from 'js/Awp0MarkupService';
import appCtxSvc from 'js/appCtxService';
import navigationSvc from 'js/navigationService';
import messageService from 'js/messagingService';
import leavePlaceService from 'js/leavePlace.service';
import { svgString as miscAccept } from 'image/miscAcceptMarkup24.svg';
import { svgString as miscRedo } from 'image/miscRedoMarkup24.svg';
import { svgString as miscDelete } from 'image/miscDeleteMarkup24.svg';
import { svgString as miscUndo } from 'image/miscUndoMarkup24.svg';
import { svgString as cmdEdit } from 'image/cmdEdit24.svg';
import { svgString as cmdReply } from 'image/cmdReply24.svg';
import { svgString as cmdDelete } from 'image/cmdDelete24.svg';

//=============== cached AW directives, services, and objects =================

let _defaultNonTcUser = { typeIconURL: getBaseUrlPath() + '/image/typePersonGray48.svg' };
let _i18n = {};
let _images = {};
let svgEditorInst = null;
let initialSvgContent = null;
let isWarningMessageShown = false;
var leaveHandler = {};
var blankSvgContent = `<svg width="640" height="480" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - https://github.com/SVG-Edit/svgedit-->
 <g class="layer">
  <title>Layer 1</title>
 </g>
</svg>`;

//======================= exported vars and functions =========================
let exports;
export let i18n = _i18n;
const supportedViewerTypes = [ 'aw-pdf-viewer', 'aw-image-viewer', 'aw-html-viewer',
    'aw-text-viewer', 'aw-2d-viewer', 'aw-onscreen-3d-markup-viewer' ];

export let getEditor = function() {
    return svgEditorInst;
};

export let saveSVGSymbol = function( ctx, symbolSvgContent ) {
    var docRevisionUid = getDocumentRevisionUid( ctx );

    if( !isSvgEditEnabled() ) {
        var symName = ctx.symbolNameCtx;
        var symGroup = ctx.symbolGroupCtx;

        var storedData = localStorage.getItem( 'symbolEditorData' );
        if ( storedData ) {
            storedData = JSON.parse( storedData );
            symName = storedData.symbolTempName;
            symGroup = storedData.symbolTempGroup;
            //Set login user
            MarkupService.setLoginUser();
            //get markup ctx from localstorage
            var markupctx = localStorage.getItem( 'MarkUpCtx' );
            markupctx = JSON.parse( markupctx );
            appCtxSvc.updateCtx( 'markup', markupctx );
        }

        if( symName && symGroup ) {
            let symbolList = [];

            const sym = markupModel.addNewSymbol( symbolSvgContent, symName );

            symbolList.push( sym );

            symbolList.forEach( ( sym, index ) => {
                sym.symbolGroup = symGroup;
                sym.created = sym.created.replace( /\d\d\dZ/, index.toString().padStart( 3, '0' ) + 'Z' );
            } );

            MarkupService.saveSymbols( symbolList, 'add' );
            isWarningMessageShown = true;
            navigateToDocumentRevision( docRevisionUid );
        }
    } else {
        const deferred = AwPromiseService.instance.defer();

        //Get selected symbol Properties for EditSave Action
        var selectedSymbols = ctx.symbolContentCtx;
        var selectedSymbolsymbolGroup = ctx.symbolGroupCtx;
        var selectedSymbolsymbolName = ctx.symbolNameCtx;

        var storedData = localStorage.getItem( 'symbolEditorData' );
        if ( storedData ) {
            storedData = JSON.parse( storedData );
            selectedSymbolsymbolName = storedData.symbolTempName;
            selectedSymbolsymbolGroup = storedData.symbolTempGroup;
            selectedSymbols = storedData.symbolTempContent;
            //Set login user
            MarkupService.setLoginUser();
            //get markup ctx from localstorage
            var markupctx = localStorage.getItem( 'MarkUpCtx' );
            markupctx = JSON.parse( markupctx );
            appCtxSvc.updateCtx( 'markup', markupctx );
        }

        if( selectedSymbols && selectedSymbolsymbolGroup &&  selectedSymbolsymbolName ) {
            selectedSymbols.forEach( sym => { sym.symbolGroup = selectedSymbolsymbolGroup; } );
            if( selectedSymbols.length === 1 ) {
                selectedSymbols[0].symbolName = selectedSymbolsymbolName;
                selectedSymbols[0].comment = symbolSvgContent;
            }
            MarkupService.saveSymbols( selectedSymbols, 'modify', ( list ) => {
                MarkupService.resolveSymbolAndGroupList( deferred, list );
            } );
        }
        isWarningMessageShown = true;
        navigateToDocumentRevision( docRevisionUid );
        return deferred.promise;
    }
};
function isSvgEditEnabled() {
    const storedValue = localStorage.getItem( 'svgEditEnabled' );

    // Check if the stored value exists and parse it
    if ( storedValue !== null ) {
        return JSON.parse( storedValue ); // Convert back to boolean
    }
}

export let getViewerData = function( svgcontent ) {
    //clear local storage before launching the Editor
    localStorage.removeItem( 'svgedit-default' );

    var svgContainer = document.getElementById( 'svgedit-container' );
    svgContainer.adoptedStyleSheets = [ svgEditStyle ];
    svgEditorInst = new SvgEditor( svgContainer );
    svgEditorInst.init();
    svgEditorInst.setConfig( {
        allowInitialUserOverride: true,
        extensions: [],
        noDefaultExtensions: false,
        userExtensions: [],
        imgPath: getBaseUrlPath() + '/svgedit/images' // lack of trailing slash is important
    } );

    //Load content into Editor for Editing exisiting symbols
    var toLoadContent = false;
    var storedData = localStorage.getItem( 'symbolEditorData' );
    if ( storedData ) {
        if( isSvgEditEnabled() ) {
            return toLoadContent = true;
        }
    } else{
        if( svgcontent && typeof svgcontent[0] !== 'undefined' ) {
            return toLoadContent = true;
        }
    }
};

export let loadSVGContent = function( svgContent ) {
    if( svgContent ) {
        svgContent = svgContent[0].comment;
    } else{
        var storedData = localStorage.getItem( 'symbolEditorData' );
        if ( storedData ) {
            storedData = JSON.parse( storedData );
            svgContent = storedData.symbolTempContent[0].comment;
        }
    }
    var SvgEditor = getEditor();// getEditor() returns an initialized SVG editor instance
    var svgCanvas = SvgEditor.svgCanvas;

    // Clear existing SVG content
    svgCanvas.clear();

    // Set the SVG content
    svgCanvas.setSvgString( svgContent );

    // Update canvas after changes
    SvgEditor.updateCanvas( true );

    // Store the initial SVG content
    initialSvgContent = svgCanvas.getSvgString();
};

export let getSVGContent = function() {
    var symbolSvgContent = null;

    // Get Editor Instance
    var svgEditor = getEditor(); // getEditor() returns an initialized SVG editor instance

    if( svgEditor && svgEditor.svgCanvas ) {
        // Get svgcontent from editor
        const svg = document.querySelector( 'svg#svgcontent' );

        if( svg ) {
            // Get the SVG canvas data as an XML string
            const svgString = new XMLSerializer().serializeToString( svg );

            // Parse the SVG string into a DOM object
            const parser = new DOMParser();
            const svgDoc = parser.parseFromString( svgString, 'image/svg+xml' );

            // Remove the <title> element if it exists
            const titleElement = svgDoc.querySelector( 'title' );
            if ( titleElement ) {
                titleElement.parentNode.removeChild( titleElement );
            }

            // Serialize the modified SVG back to a string
            return new XMLSerializer().serializeToString( svgDoc );
        }
    }
};

// Function to normalize SVG data
function normalizeSvg( svgString ) {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString( svgString, 'image/svg+xml' );

    // removing non-essential attributes
    doc.querySelectorAll( '*' ).forEach( el => {
        el.removeAttribute( 'style' ); // Remove style attributes
        el.removeAttribute( 'transform' ); // Remove transform attributes
    } );

    return serializer.serializeToString( doc.documentElement );
}

// Function to handle mutations and update button state
function handleMutation( svgElement, normalizedBlankSvg, initialSvgData ) {
    let currentSvgData = normalizeSvg( svgElement.outerHTML );

    // Compare normalized SVG data
    if ( currentSvgData === normalizedBlankSvg || currentSvgData === initialSvgData ) {
        appCtxSvc.updateCtx( 'saveSvgButtonState', false ); // Disable button if no changes
    } else {
        appCtxSvc.updateCtx( 'saveSvgButtonState', true ); // Enable button if there are changes
    }
}

// Monitor canvas function
export let monitorCanvas = function() {
    var svgEditor = getEditor(); // getEditor() returns an initialized SVG editor instance
    var svgElement = svgEditor.svgCanvas ? svgEditor.svgCanvas.getSvgContent() : null; // get the SVG element

    // Define blank SVG content for comparison
    const blankSvgContent = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:se="http://svg-edit.googlecode.com" xmlns:xlink="http://www.w3.org/1999/xlink" id="svgcontent" width="640" height="480" x="640" y="480" viewBox="0 0 640 480" overflow="visible"><!-- Created with SVG-edit - https://github.com/SVG-Edit/svgedit--><g class="layer"><title>Layer 1</title></g></svg>';

    if ( svgElement ) {
        // Initial SVG data when Editor is loaded
        let initialSvgData = normalizeSvg( svgElement.outerHTML );

        // Sample Blank SVG Canvas data
        const normalizedBlankSvg = normalizeSvg( blankSvgContent );

        // Set up Mutation Observer
        const observer = new MutationObserver( () => handleMutation( svgElement, normalizedBlankSvg, initialSvgData ) );
        observer.observe( svgElement, { attributes: true, childList: true, subtree: true } );

        // Initial check to set Save button state
        handleMutation( svgElement, normalizedBlankSvg, initialSvgData );
    } else {
        appCtxSvc.updateCtx( 'saveSvgButtonState', false ); // Disable button if SVG element is not found
    }
};

/**
 * @returns {String} - get current locale code
 */
let getLocaleCode = function() {
    var currentLocale = localeSvc.getLocale();

    var localeName = currentLocale.substring( 0, 2 );

    // Normally first 2 characters, but we have 2 exceptions. And yes there is a dash and not an underscore.
    if( currentLocale === 'pt_BR' || currentLocale === 'zh_CN' ) {
        localeName = currentLocale.replace( /_/g, '-' );
    }
    return localeName;
};

let svgToUrl = ( svg ) => {
    if( URL && URL.createObjectURL ) {
        return URL.createObjectURL( new Blob( [ svg ], { type: 'image/svg+xml;charset=utf-8' } ) );
    }

    return svg;
};

let loadConfiguration = () => {
    localeSvc.getTextPromise( 'MarkupMessages', true ).then( ( textBundle ) => {
        $.extend( _i18n, textBundle );
    } );

    localeSvc.getTextPromise( 'dateTimeServiceMessages', true ).then( ( textBundle ) => {
        $.extend( _i18n, textBundle );
    } );

    _i18n._locale = getLocaleCode();
    _images.miscAccept = svgToUrl( miscAccept );
    _images.miscUndo = svgToUrl( miscUndo );
    _images.miscRedo = svgToUrl( miscRedo );
    _images.miscDelete = svgToUrl( miscDelete );
    _images.cmdEdit = svgToUrl( cmdEdit );
    _images.cmdReply = svgToUrl( cmdReply );
    _images.cmdDelete = svgToUrl( cmdDelete );

    /**
     * Listening to viewer context value changed
     */
    eventBus.subscribe( 'appCtx.register', ( eventData ) => {
        if( eventData && eventData.name === 'viewerContext' ) {
            MarkupService.viewerChanged( eventData );
        }
    }, 'Awp0SvgEditService' );
};

export let checkContentChanged = function( ctx ) {
    var svgEditEditor = getEditor();
    var svgData;

    var docRevisionUid = getDocumentRevisionUid( ctx );
    if( svgEditEditor ) {
        const svgCanvas = svgEditEditor.svgCanvas;
        if( svgCanvas ) {
            const svg = document.querySelector( 'svg#svgcontent' );
            svgData = new XMLSerializer().serializeToString( svg );
        }
        const currentSvgContent = normalizeSvg( svgCanvas.getSvgString() );
        if ( initialSvgContent === null ) {
            initialSvgContent = normalizeSvg( blankSvgContent );
        } else{
            initialSvgContent = normalizeSvg( initialSvgContent );
        }
        if ( currentSvgContent !== initialSvgContent ) {
            const buttons = [ {
                addClass: 'btn btn-notify',
                text: _i18n.cancel,
                onClick: function( btn ) {
                    btn.close();
                    isWarningMessageShown = false;
                }
            },
            {
                addClass: 'btn btn-notify',
                text: _i18n.discard,
                onClick: function( btn ) {
                    btn.close();
                    navigateToDocumentRevision( docRevisionUid );
                }
            },
            {
                addClass: 'btn btn-notify',
                text: _i18n.save,
                onClick: function( btn ) {
                    btn.close();
                    saveSVGSymbol( ctx, svgData );
                }
            } ];
            messageService.showWarning( _i18n.confirmUnsavedEdits, buttons );
            isWarningMessageShown = true;
        }else {
            navigateToDocumentRevision( docRevisionUid );
        }
    }
};
function getDocumentRevisionUid( ctx ) {
    var docRevisionUid = null;
    var storedData = localStorage.getItem( 'symbolEditorData' );
    if ( storedData ) {
        storedData = JSON.parse( storedData );
        docRevisionUid = storedData.docRevisionUid;
    }
    if( docRevisionUid === null ) {
        docRevisionUid = ctx.documentRevisionUid;
    }
    return docRevisionUid;
}
export function navigateToDocumentRevision( documentRevisionUid ) {
    var navigationParams = {
        uid: documentRevisionUid
    };
    var action = {
        actionType: 'Navigate',
        navigateTo: 'com_siemens_splm_clientfx_tcui_xrt_showObject'
    };
    navigationSvc.navigate( action, navigationParams );
}

export function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

export let setLocationChangeListener = function( ctx ) {
    var defer = AwPromiseService.instance.defer();
    leavePlaceService.registerLeaveHandler( {
        okToLeave: function( targetNavDetails, oldState, newState ) {
            var isSvgEdit = targetNavDetails && targetNavDetails.fromState && targetNavDetails.fromState.name === 'SvgEdit';
            var isSvgEditorSublocation = targetNavDetails.toState.name === 'errorSubLocation';
            if ( isSvgEdit && !isSvgEditorSublocation ) {
                return leaveConfirmation( ctx );
            }
            if ( isSvgEditorSublocation ) {
                defer.resolve();
                return defer.reject;
            }
            defer.resolve();
            return defer.promise;
        }
    } );
};


export let leaveConfirmation = function( ctx ) {
    var svgEditEditor = getEditor();
    var defer = AwPromiseService.instance.defer();
    if( svgEditEditor ) {
        const svgCanvas = svgEditEditor.svgCanvas;
        const currentSvgContent = normalizeSvg( svgCanvas.getSvgString() );

        if ( initialSvgContent === null ) {
            initialSvgContent = normalizeSvg( blankSvgContent );
        } else{
            initialSvgContent =  normalizeSvg( initialSvgContent );
        }
        if ( currentSvgContent !== initialSvgContent && !isWarningMessageShown ) {
            const svg = document.querySelector( 'svg#svgcontent' );
            leavePlaceService.deregisterLeaveHandler( leaveHandler );
            return displayConfirmationMessageChangedContent( ctx, svg );
        }
        isWarningMessageShown = false;

        defer.resolve();
        return defer.promise;
    }
};

export let unRegisterLeaveHandler = function() {
    leavePlaceService.registerLeaveHandler( null );
};

export let displayConfirmationMessageChangedContent = function( ctx, svg ) {
    var resource = 'MarkupMessages';
    var deferred = AwPromiseService.instance.defer();
    var localTextBundle = localeSvc.getLoadedText( resource );
    var buttonArray = [];

    buttonArray.push( createButton( localTextBundle.cancel, function( $noty ) {
        $noty.close();
        return deferred.reject();
    } ) );

    buttonArray.push( createButton( localTextBundle.discard, function( $noty ) {
        $noty.close();
        deferred.resolve();
    } ) );

    buttonArray.push( createButton( localTextBundle.save, function( $noty ) {
        if( svg ) {
            const svgData = new XMLSerializer().serializeToString( svg );
            saveSVGSymbol( ctx, svgData );
        }
        $noty.close();
        deferred.resolve();
    } ) );

    var confirmationMessage = localTextBundle.confirmUnsavedEdits;
    messageService.showWarning( confirmationMessage, buttonArray );
    return deferred.promise;
};

loadConfiguration();

//======================= app factory and filters =========================

export default exports = {
    i18n,
    getViewerData,
    saveSVGSymbol,
    getEditor,
    getSVGContent,
    loadSVGContent,
    monitorCanvas,
    checkContentChanged,
    displayConfirmationMessageChangedContent,
    setLocationChangeListener,
    leaveConfirmation,
    unRegisterLeaveHandler
};
