//@<COPYRIGHT>@
//==================================================
//Copyright 2025.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * This file contains the utility methods for aw-pdf-viewer directive
 *
 * @module js/pdfViewerUtils
 */

var frameContentWindowLocal = null;

/**
 * Checks and returns the AWUtils from frame content window
 *
 * @param {Element} frameContentWindow the Iframe content window
 * @returns {Object} the AWUtils instance
 */
function checkForAWUtils( frameContentWindow ) {
    if( frameContentWindow && frameContentWindow.PDFViewerApplication && frameContentWindow.PDFViewerApplication.AWUtils ) {
        return frameContentWindow.PDFViewerApplication.AWUtils;
    }
    return null;
}

/**
 * Initializes PDF viewer IFrame and the viewer outline
 *
 * @param {Element} frameContentWindow the IFrame content window
 * @param {Element} frameContentDoc the IFrame content document
 * @param {String} locale the current locale
 */
export let initFrame = function( frameContentWindow, frameContentDoc, locale ) {
    let pdfJsLib = checkForAWUtils( frameContentWindow );
    if( pdfJsLib ) {
        frameContentWindowLocal = frameContentWindow;
        try {
            if( typeof pdfJsLib.viewerLoad === 'function' ) {
                pdfJsLib.viewerLoad( locale ); //get this from locale service
            } else {
                console.log( 'aw_viewerLoad is undefined in pdfViewerUtils' );
            }
        } catch ( err ) {
            console.log( 'Exception in pdfViewerUtils aw_viewerLoad ::>>' + err );
        }
        try {
            if( typeof pdfJsLib.resetOutlineMap === 'function' ) {
                pdfJsLib.resetOutlineMap();
            } else {
                console.log( 'aw_resetOutlineMap is undefined in pdfViewerUtils' );
            }
        } catch ( err ) {
            console.log( 'Exception in pdfViewerUtils aw_resetOutlineMap ::>>' + err );
        }
    }
};

/**
 * Adds outline to the PDF view
 *
 * @param {Element} frameContentWindow the IFrame content window
 * @param {Element} frameContentDoc the IFrame content document
 */
export let hookOutline = function( frameContentWindow, frameContentDoc ) {
    frameContentWindow.DocumentOutlineView = function( outline ) {
        let pdfJsLib = checkForAWUtils( frameContentWindow );
        var outlineView = frameContentDoc.getElementById( 'outlineView' );
        while( outlineView.firstChild ) {
            outlineView.removeChild( outlineView.firstChild );
        }

        if( !outline ) {
            // New code disables the Show Document Outline View button.
            if( !outlineView.classList.contains( 'hidden' ) && pdfJsLib && typeof pdfJsLib.switchView === 'function' ) {
                try {
                    pdfJsLib.switchView( frameContentWindow.pdfJsLib.SidebarView.THUMBS );
                } catch ( err ) {
                    console.log( 'Exception in pdfViewerUtils aw_switchView ::>>' + err );
                }
            } else {
                console.log( 'Could not call aw_switchView in pdfViewerUtils' );
            }
            return;
        }

        /**
         *
         * @param {*} domObj
         * @param {*} bindItem
         */
        function bindItemLink( domObj, bindItem ) {
            domObj.href = '#';
            if( pdfJsLib && typeof pdfJsLib.getDestinationHash === 'function' ) {
                try {
                    domObj.href = pdfJsLib.getDestinationHash( bindItem.dest );
                } catch ( err ) {
                    console.log( 'Exception in pdfViewerUtils aw_getDestinationHash ::>>' + err );
                }
            } else {
                console.log( 'aw_getDestinationHash is not defined in pdfViewerUtils' );
            }
            domObj.onclick = function( e ) {
                if( pdfJsLib && typeof pdfJsLib.navigateTo === 'function' ) {
                    try {
                        pdfJsLib.navigateTo( bindItem.dest );
                    } catch ( err ) {
                        console.log( 'Exception in pdfViewerUtils aw_navigateTo ::>>' + err );
                    }
                } else {
                    console.log( 'aw_navigateTo is not defined in pdfViewerUtils' );
                }
                return false;
            };
        }

        var queue = [ {
            parent: outlineView,
            items: outline
        } ];

        while( queue.length > 0 ) {
            var levelData = queue.shift();
            var n = levelData.items.length;
            for( var i = 0; i < n; i++ ) {
                var item = levelData.items[ i ];
                var div = frameContentDoc.createElement( 'div' );
                div.className = 'outlineItem';
                var a = frameContentDoc.createElement( 'a' );
                bindItemLink( a, item );
                a.textContent = item.title;
                div.appendChild( a );

                // ACTIVE WORKSPACE - capture the entries for navigateTo override
                if( pdfJsLib && typeof pdfJsLib.bindLink === 'function' ) {
                    try {
                        pdfJsLib.bindLink( item.title, item );
                    } catch ( err ) {
                        console.log( 'Exception in pdfViewerUtils aw_bindLink ::>>' + err );
                    }
                } else {
                    console.log( 'aw_bindLink is not defined in pdfViewerUtils' );
                }

                if( item.items.length > 0 ) {
                    var itemsDiv = frameContentDoc.createElement( 'div' );
                    itemsDiv.className = 'outlineItems';
                    div.appendChild( itemsDiv );
                    queue.push( {
                        parent: itemsDiv,
                        items: item.items
                    } );
                }

                levelData.parent.appendChild( div );
            }
        }
    };
};

/**
 * Shows/Opens the file from specified URL in the PDF viewer
 *
 * @param {Element} frameContentWindow the IFrame content window
 * @param {String} url the file URL
 */
export let loadContent = function( frameContentWindow, url ) {
    try {
        let pdfJsLib = checkForAWUtils( frameContentWindow );
        pdfJsLib.open( url, function documentCallback( exception ) {
            if( typeof exception !== 'undefined' ) {
                console.log( 'Exception in pdfViewerUtils aw_open ::>>' + exception );
            }
        } );
    } catch ( err ) {
        console.log( 'Exception in pdfViewerUtils.loadContent ::>>' + err );
    }
};

/**
 * Rotate the PDF document clockwise 90 degree
 *
 * @param {Context} context - the command context
 */
export function rotateCW( context ) {
    try {
        const frame = context.element.querySelector( 'iframe#pdfViewerIFrame' );
        let pdfJsLib = checkForAWUtils( frame.contentWindow );
        pdfJsLib.rotateCW();
    } catch ( err ) {
        console.log( 'Exception in pdfViewerUtils.rotateCW ::>>' + err );
    }
}

/**
 * Rotate the PDF document counter clockwise 90 degree
 *
 * @param {Context} context - the command context
 */
export function rotateCCW( context ) {
    try {
        const frame = context.element.querySelector( 'iframe#pdfViewerIFrame' );
        let pdfJsLib = checkForAWUtils( frame.contentWindow );
        pdfJsLib.rotateCCW();
    } catch ( err ) {
        console.log( 'Exception in pdfViewerUtils.rotateCCW ::>>' + err );
    }
}

export default {
    initFrame,
    hookOutline,
    loadContent,
    rotateCW,
    rotateCCW
};
