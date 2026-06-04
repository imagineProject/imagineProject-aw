// Copyright (c) 2025 Siemens

/**
 * JavaScript file for the SSO login form operation
 *
 * Gateway will send the form which will load this file and execute the needed operations
 *
 */

( function() {
    $( document ).ready( function() {
        let encodedLocation;
        const proxyServerUrl = document.getElementById( 'proxyServerUrl' );
        if( proxyServerUrl?.value ) {
            encodedLocation = encodeURIComponent( window.location.href );
        } else {
            encodedLocation = encodeURIComponent( window.location.search + window.location.hash );
        }
        document.getElementById( 'initialLoginPage' ).value = encodedLocation;

        const errorMsg = document.getElementById( 'errorMsg' );
        if( !errorMsg ) {
            //auto submit form
            const ssoForm = document.getElementById( 'autoSubmit' );
            ssoForm.method = document.getElementById( 'redirectMethod' ).value;
            ssoForm.action = document.getElementById( 'loginRedirectURL' ).value;
            ssoForm.submit();
        }
    } );
} )();
