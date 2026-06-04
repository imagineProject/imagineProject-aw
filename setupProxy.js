// Copyright (c) 2023 Siemens
/* eslint-disable no-undef */

// https://create-react-app.dev/docs/proxying-api-requests-in-development/

const http = require( 'node:http' );
const https = require( 'node:https' );

const { createProxyMiddleware } = require( 'http-proxy-middleware' );
const { writeJsonSync, ensureDirSync } = require( 'fs-extra' );
const logger = require( '@swf/tooling/js/logger' );

const devServerPath = 'out/devServer.json';

process.env.PORT = process.env.PORT || 3000;

let awGateway;
if( process.env.ENDPOINT_GATEWAY ) {
    awGateway = new URL( process.env.ENDPOINT_GATEWAY );
}else if( process.env.AW_PROXY_SERVER ) {
    awGateway = new URL(  process.env.AW_PROXY_SERVER );
    // if proxy add /aw suffix
    awGateway.pathname += '/aw';
}
logger.info( `setupProxy: Routing non-file communication to ${awGateway}` );

ensureDirSync( 'out' );
// Write out a JSON file to allow
writeJsonSync( devServerPath, {
    gatewayURL: awGateway.toString(),
    port: process.env.PORT
}, { spaces: 2 } );
logger.info( `setupProxy: ${devServerPath} written` );
logger.info( `setupProxy: devServer running on http://localhost:${process.env.PORT}` );

module.exports = function( app ) {
    const agentOptions = {};
    const agent = awGateway.protocol === 'http:' ? new http.Agent( agentOptions ) : new https.Agent( agentOptions );

    app.use( [
        // Primary routes
        '/fms/**',
        '/sd/**',
        '/tc/**',
        '/VisProxyServlet/**',
        '/ping',
        '/performance',
        '/darsi/**',
        '/tcgql/**',
        '/launcher',
        '/devMode/**',
        // SSO routes
        '/auth',
        '/reauth',
        '/AWSSOLogin',
        '/AWSSOLogin/**',
        '/AWSSOReauth',
        '/AWSSOReauth/**',
        '/getSessionVars',
        '/logoff/**',
        '/getSessionDiscriminator',
        // Test fixtures
        '/cfg_hosted_tests',
        '/ldf_hosted_tests',
        '/mcad_hosted_tests',
        '/nx_hosted_tests',
        '/tcma_hosted_tests'
    ], createProxyMiddleware( {
        agent,
        target: awGateway.toString(),
        changeOrigin: true,
        secure: false,
        logProvider: () => {
            return {
                log: logger.log,
                debug: logger.debug, // lower output to silly level
                info: logger.debug, // lower output to silly level
                warn: logger.warn,
                error: logger.error
            };
        }
    } ) );
};
