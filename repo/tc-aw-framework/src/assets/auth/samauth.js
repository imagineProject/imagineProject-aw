// Copyright (c) 2025 Siemens

/**
 * JavaScript file for the samauth login form operation
 *
 * Gateway will send the html which will load this file and execute the needed operations
 *
 */

( function() {
    // Notify the opener window when this popup is closed， use this way to avoid CSP Cross-Origin-Opener-Policy issue
    window.addEventListener( 'beforeunload', () => {
        window.opener?.postMessage( 'popupClosed', window.location.origin );
    } );

    document.addEventListener( 'DOMContentLoaded', function() {
        window.close();
    } );
} )();
