// Copyright (c) 2025 Siemens

/**
 * @module js/viewerLicenseService
 */
import logger from 'js/logger';
import appCtxService from 'js/appCtxService';
import dataManagementService from 'soa/dataManagementService';
import cdm from 'soa/kernel/clientDataModel';
import AwBaseService from 'js/awBaseService';
import soaSvc from 'soa/kernel/soaService';
import awPromiseService from 'js/awPromiseService';

export default class ViewerLicenseService extends AwBaseService {
    constructor() {
        super();
        this.licenseLevel = 1;
        this.isLicenseCheckedout = false;
        this.hasInitialized = false;
        this.VIS_LICENSE = {
            0: 'invalid_license',
            1: 'visview_base',
            2: 'visview_std',
            3: 'visview_pro',
            4: 'visview_mockup'
        };
        this.initialize();
    }

    /**
     * Initialize the service
     * 
     */
    initialize() {
        return ViewerLicenseService.getUserVisLicenseLevel().then( licLevel => {
            this.licenseLevel = String( licLevel + 1 );
            this.hasInitialized = true;
        } );
    }

    /**
     * Get assigned vis license
     * @returns {Number} returns vis license level or null if license is not checked out.
     */
    getAssignedVisLicense() {
        if( this.isLicenseCheckedout ) {
            return this.licenseLevel;
        }
        return null;
    }

    /**
     * Strings for the 4 Tc Vis User License Levels (not eailicense related) currently supported:
     * "visview_base", "visview_std", "visview_pro", "visview_mockup".
     * They are stored parallel (almost, need to add 1 to get correct index) to the value used by Tc to indicate the license level.
     * That is license values are : -1 = invalid_license, 0 = "visview_base", 1 = "visview_std", 2 = "visview_pro", 3 = "visview_mockup"
     * So index value need to be : 0 = invalid_license, 1 = "visview_base", 2 = "visview_std", 3 = "visview_pro", 4 = "visview_mockup"
     * 
     * @param {Number} licenseLevel License level stored in teamcenter
     * @returns {Promise} boolean indicating if the action was successful
     * 
     */
    async checkoutVisLicense() {
        if( !this.hasInitialized ) {
            await this.initialize();
        }
        if( this.isLicenseCheckedout ) {
            logger.debug( 'Vis license already checked out. License level : ' + this.licenseLevel );
            return awPromiseService.instance.resolve( true );
        }
        var request = {
            licAdminInput: [ {
                featureKey: this.VIS_LICENSE[ this.licenseLevel ],
                licensingAction: 'init_get'
            } ]
        };
        return soaSvc.post( 'Core-2019-06-Session', 'licenseAdmin', request ).then( ( response ) => {
            if( response && response.partialErrors ) {
                response.partialErrors.forEach( ( error ) => {
                    logger.error( 'Failed to get license ' + error );
                    return false;
                } );
                return false;
            }
            this.isLicenseCheckedout = true;
            logger.debug( 'Successful checkout of license ' + this.VIS_LICENSE[ this.licenseLevel ] );
            return true;
        } ).catch( error => {
            logger.error( 'Unable to checkout license ' + this.VIS_LICENSE[ this.licenseLevel ] + ' with error ' + error );
            return awPromiseService.instance.reject( error );
        } );
    }

    /**
     * Checkin vis license
     * 
     * @param {Number} licenseLevel License level stored in teamcenter
     * @returns {Promise} boolean indicating if the action was successful
     */
    async checkinVisLicense() {
        if( !this.isLicenseCheckedout ) {
            logger.debug( 'Vis license not checked out.' );
            return awPromiseService.instance.resolve( true );
        }
        var request = {
            licAdminInput: [ {
                featureKey: this.VIS_LICENSE[ this.licenseLevel ],
                action: 'release_exit'
            } ]
        };
        return await soaSvc.post( 'Core-2019-06-Session', 'licenseAdmin', request ).then( ( response ) => {
            if( response && response.partialErrors ) {
                response.partialErrors.forEach( ( error ) => {
                    logger.error( 'Failed to release license ' + error );
                    return false;
                } );
                return false;
            }
            this.isLicenseCheckedout = false;
            logger.debug( 'Successful check in of license ' + this.VIS_LICENSE[ this.licenseLevel ] );
            return true;
        } ).catch( error => {
            logger.error( 'Unable to check in license ' + this.VIS_LICENSE[ this.licenseLevel ] + ' with error ' + error );
            return awPromiseService.instance.reject( error );
        } );
    }

    /**
     * Get user license
     * @param {Number} licenseLevel License level stored in teamcenter
     * @returns {Promise} Returns the license level for user
     */
    static getUserVisLicenseLevel() {
        let user = appCtxService.getCtx( 'user' );
        let level = 0;
        return dataManagementService.getProperties( [ user.uid ], [ 'fnd0VISLicenseLevel' ] ).then( () => {
            const userObj = cdm.getObject( user.uid );
            if( userObj !== undefined && userObj.props !== undefined && userObj.props.fnd0VISLicenseLevel !== undefined ) {
                level = parseInt( userObj.props.fnd0VISLicenseLevel.dbValues[ 0 ] );
                logger.debug( 'User license level is ' + level );
            } else {
                logger.error( 'Unable to get user license from Teamcenter for ' + user );
            }
            return level;
        } ).catch( error => {
            logger.error( 'Unable to get user license from Teamcenter ' + error );
            return level;
        } );
    }
}
