// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/viewerAdminHealth
 */
import appCtxSvc from 'js/appCtxService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';
import assert from 'assert';

var exports = {};

/**
 * Enums that represent health object type
 */
export let HealthObjectType = {
    UNASSIGNED: 'unAssignedType',
    ASSIGNER: 'assigner',
    POOLMANAGER: 'poolmanager',
    VISPROCESS: 'visprocess',
    CLIENT: 'client'
};

//Pool Manager area

/** maxBandwidthBytesPerSec tag */
var MAXBANDWIDTHBYTESPERSEC = 'maxBandwidthBytes';

/** up time in seconds */
var UPTIMESEC = 'upTimeSecs';

/** DATECREATED */
var DATECREATED = 'dateCreated';

/** numberOfAssignmentsSinceStartup */
var NUMASSIGNMENTSSINCESTARTUP = 'numAssignsSinceStart';

/** POOLNAME tag */
var POOLNAME = 'poolName';

/** serves tag */
var SERVES = 'serves';

/** prefers tag */
var PREFERS = 'prefers';

/** totalMemoryMB tag */
var TOTALMEMORYMB = 'totalMemoryMB';

/** totalGPUMemoryMB tag */
var TOTALGPUMEMMB = 'totalGPUMemory';

/** numGPUs tag */
var NUMGPUS = 'numGPUs';

/** hostName tag */
var HOSTNAME = 'hostName';

/** tag for pool manager on/off state. */
var ACCEPTING = 'accepting';

//VisProcess area
/** totalMemoryPerGPU tag */
var TOTALMEMPERGPU = 'totalGPUMemory';

/** servletConnections tag */
var SERVLETCONNECTIONS = 'numConnections';

/** port tag */
var PORT = 'port';

/** ms since last emm tag */
var MSSINCEEMM = 'msSinceEMM';

/** total num emms tag */
var TOTALEMMS = 'numEMMs';

/** total number of byes in tag */
var TOTALRECEIVEDBYTES = 'totalReceivedBytes';

/** total Num bytes out tag */
var TOTALSENTBYTES = 'totalSentBytes';

/** number clients tag */
var NUMCLIENTS = 'numClients';

/** number connections tag */
//var NUMCONNECTIONS = "numConnections";

/** cpu usage ratio for entire computer */
var COMPUTERCPURATIO = 'cpuUsageRatio';

/** computer memory consumption */
var COMPUTERMEMORYCONSUMPTIONRATIO = 'memoryConsumptionRatio';

/** number of computer gpu's */
var COMPUTERNUMGPUS = 'computerNumGPUs';

/** cpu usage per process */
var PROCESSCPUUSAGERATIO = 'processCPUUsageRatio';

/** memory consumption per process */
var PROCESSMEMORYCONSUMPTIONRATIO = 'processMemoryConsumptionRatio';

/** Models */
var MODELS = 'models';

//Client area
/** client ip address tag */
var CLIENTIPADDRESS = 'clientIPAddress';

/** session id tag */
var SESSIONID = 'sessionID';

/** client id tag */
var CLIENTID = 'clientID';

/** host tag. */
var HOST = 'host';

/**
 * gets all health objects
 *
 * @returns {[ViewerHealthObject]} all health objects
 */
export let getAllHealthObjects = function() {
    var viewerAdmin = appCtxSvc.getCtx( 'viewerAdmin' );
    return viewerAdmin.allHealthObjects;
};

/**
 * get the total number of assigners
 *
 * @return {number} assigners count
 */
export let getAssignerCount = function() {
    var allHealthObjects = exports.getAllHealthObjects();
    var typeGroupedHealthObjs = _.groupBy( allHealthObjects, 'type' );
    return typeGroupedHealthObjs[ exports.HealthObjectType.ASSIGNER ].length;
};

/**
 * get the total number of pool managers
 *
 * @return {number} pool manager count
 */
export let getPoolManagerCount = function() {
    var allHealthObjects = exports.getAllHealthObjects();
    var typeGroupedHealthObjs = _.groupBy( allHealthObjects, 'type' );
    return typeGroupedHealthObjs[ exports.HealthObjectType.POOLMANAGER ].length;
};

/**
 * get the total number of vis processes
 *
 * @return {number} client count
 */
export let getClientCount = function() {
    var allHealthObjects = exports.getAllHealthObjects();
    var typeGroupedHealthObjs = _.groupBy( allHealthObjects, 'type' );
    return typeGroupedHealthObjs[ exports.HealthObjectType.VISPROCESS ].length;
};

/**
 * get the total number of vis processes
 *
 * @return {number} vis process count
 */
export let getVisProcessCount = function() {
    var allHealthObjects = exports.getAllHealthObjects();
    var typeGroupedHealthObjs = _.groupBy( allHealthObjects, 'type' );
    return typeGroupedHealthObjs[ exports.HealthObjectType.CLIENT ].length;
};

/**
 * @param  {HealthObjectType} type type
 */
var ViewerHealthObject = function( type ) {
    this.type = type;
    this.properties = {};
    this.children = [];
    this.displayType = undefined;
    this.childrenCount = 0;
    this.hiddenChildrenCount = 0;
    this.node = undefined;
    this.parent = undefined;
};

/**
 * Gets type of health object
 * @returns {HealthObjectType} type
 */
ViewerHealthObject.prototype.getType = function() {
    return this.type;
};

/**
 * Gets properties object
 * @returns {Object} properties object
 */
ViewerHealthObject.prototype.getProperties = function() {
    return this.properties;
};

/**
 * Gets value string for given property key
 * @param  {String} key the key
 * @returns {Object} property value
 */
ViewerHealthObject.prototype.getPropertyValue = function( key ) {
    try {
        if( this.hasOwnProperty( key ) ) {
            return this[ key ];
        }
        return this.properties[ key ];
    } catch ( err ) {
        logger.error( 'Trying to fetch non existent property:' + key );
        return undefined;
    }
};

/**
 * Add property on health object
 * @param  {String} key key
 * @param  {String} value value
 */
ViewerHealthObject.prototype.addProperty = function( key, value ) {
    assert( key, 'key should be truthy' );
    if( value !== null && value !== undefined ) {
        this.properties[ key ] = value;
    }
};

/**
 * Gets heath object's id
 * @returns {String} id for health object
 */
ViewerHealthObject.prototype.getId = function() {
    return this.id;
};

/**
 * Sets heath object's id
 * @param {String} id for health object
 */
ViewerHealthObject.prototype.setId = function( id ) {
    this.id = id;
};

/**
 * Sets display type of health object
 * @param  {String} type diplay type string
 */
ViewerHealthObject.prototype.setDisplayType = function( type ) {
    this.displayType = type;
};

/**
 * Gets display name of health object
 * @returns  {String} display name
 */
ViewerHealthObject.prototype.getDisplayType = function() {
    return this.displayType;
};

/**
 * Sets node for the health object
 * @param  {Object} node node object
 */
ViewerHealthObject.prototype.setNode = function( node ) {
    this.node = node;
};

/**
 * Gets node for the health object
 * @returns  {Object} node
 */
ViewerHealthObject.prototype.getNode = function() {
    return this.node;
};

/**
 * Sets parent health object
 * @param  {ViewerHealthObject} parent parent health object
 */
ViewerHealthObject.prototype.setParent = function( parent ) {
    this.parent = parent;
};

/**
 * Gets parent health object
 *  @returns  {Object} parent health object
 */
ViewerHealthObject.prototype.getParent = function() {
    return this.parent;
};

/**
 * Sets child health object
 * @param  {ViewerHealthObject} child child health obj
 */
ViewerHealthObject.prototype.addChild = function( child ) {
    this.children.push( child );
    this.childrenCount++;
};

/**
 * Gets immediate children for health object
 * @returns  {Object[]} children health objs
 */
ViewerHealthObject.prototype.getImmediateChildren = function() {
    return this.children;
};

/**
 * Creates health object with given type
 * @param  {HealthObjectType} type the type
 * @returns {ViewerHealthObject} health object
 */
var _createHealthObject = function( type ) {
    assert( type, 'Health object type should not be undefined' );

    var viewerAdmin = appCtxSvc.getCtx( 'viewerAdmin' );
    var obj = new ViewerHealthObject( type );
    viewerAdmin.allHealthObjects.push( obj );
    appCtxSvc.updateCtx( 'viewerAdmin', viewerAdmin );

    return obj;
};

/**
 * Parses health object and caches it.
 * @param  {Object} data model
 */
export let parseHealthData = function( data ) {
    var viewerAdmin = appCtxSvc.getCtx( 'viewerAdmin' );
    if( !data || !viewerAdmin.viewerHealth ) {
        logger.error( 'viewerAdminHealth: Data insufficient to parse health' );
    }

    var health = viewerAdmin.viewerHealth;
    var assignerObject = _createHealthObject( exports.HealthObjectType.ASSIGNER );
    assignerObject.setId( 'assigner1' ); // agrawalv: Why single assigner?
    assignerObject.setDisplayType( data.i18n.healthInfoAssigner );

    _parseClientsHealth( health, data );

    _parsePoolManagerInfo( health, assignerObject, data );

    viewerAdmin.isViewerHealthParsed = true;
    appCtxSvc.updateCtx( 'viewerAdmin', viewerAdmin );

    eventBus.publish( 'viewerAdmin.HealthDataParsed', {} );
};

/**
 * Parses client's health
 * @param  {Object} health raw health data
 * @param  {Object} data view model
 */
var _parseClientsHealth = function( health, data ) {
    var clients = health.getClients();
    _.forEach( clients, function( client ) {
        var healthObj = _createHealthObject( exports.HealthObjectType.CLIENT );

        healthObj.setId( client.getClientID() );
        healthObj.setDisplayType( data.i18n.healthInfoClient );
        healthObj.addProperty( CLIENTIPADDRESS, client.getIPAddress() );
        healthObj.addProperty( SESSIONID, client.getSessionID() );
        healthObj.addProperty( CLIENTID, client.getClientID().toString() );
        healthObj.addProperty( HOST, client.getHost() );
    } );
};

/**
 * Gets all health object of given type
 * @param  {HealthObjectType} type the typr
 * @returns {[ViewerHealthObject]} Health objects array
 */
var _getAllHealthObjsOfType = function( type ) {
    if( !type ) {
        return undefined;
    }

    var allHealthObjects = exports.getAllHealthObjects();

    var groupedObjs = _.groupBy( allHealthObjects, 'type' );
    return _.get( groupedObjs, type );
};

/**
 * Parses pool manager's info
 *
 * @param  {Object} health health object
 * @param  {ViewerHealthObject} assigner health object
 * @param  {Object} data model
 */
var _parsePoolManagerInfo = function( health, assigner, data ) {
    var poolManagers = health.getPoolManagers();

    _.forEach( poolManagers, function( manager ) {
        var pmHealthObj = _createHealthObject( exports.HealthObjectType.POOLMANAGER );
        pmHealthObj.setParent( assigner );
        assigner.addChild( pmHealthObj );

        var allPMs = _getAllHealthObjsOfType( exports.HealthObjectType.POOLMANAGER );
        var totalPMs = allPMs !== undefined ? allPMs.length : 0;
        pmHealthObj.setId( manager.getPoolName() + totalPMs );
        pmHealthObj.setDisplayType( data.i18n.healthInfoServerManager );

        pmHealthObj.addProperty( POOLNAME, manager.getPoolName() );
        pmHealthObj.addProperty( HOSTNAME, manager.getHostName() );

        if( manager.getComputerCpuUsageRatio() !== undefined ) {
            pmHealthObj.addProperty( COMPUTERCPURATIO, manager.getComputerCpuUsageRatio().getCurrent()
                .toString() );
        }

        if( manager.getComputerMemUsageRatio() !== undefined ) {
            pmHealthObj.addProperty( COMPUTERMEMORYCONSUMPTIONRATIO, manager.getComputerMemUsageRatio()
                .getCurrent().toString() );
        }

        pmHealthObj.addProperty( SERVES, manager.getServes().length.toString() );
        pmHealthObj.addProperty( MAXBANDWIDTHBYTESPERSEC, manager.getMaxBandwidthBytesPerSec().toString() );
        pmHealthObj.addProperty( TOTALMEMORYMB, manager.getTotalMemMB().toString() );
        pmHealthObj.addProperty( NUMGPUS, manager.getNumGpus().toString() );
        pmHealthObj.addProperty( ACCEPTING, manager.getAccepting().toString() );
        pmHealthObj.addProperty( TOTALGPUMEMMB, manager.getTotalGpuMemMB().toString() );
        pmHealthObj.addProperty( MAXBANDWIDTHBYTESPERSEC, manager.getMaxBandwidthBytesPerSec().toString() );
        pmHealthObj.addProperty( UPTIMESEC, manager.getUpTimeSec().toString() );
        pmHealthObj.addProperty( DATECREATED, manager.getDateCreated().toString() );
        pmHealthObj
            .addProperty( NUMASSIGNMENTSSINCESTARTUP, manager.getNumAssignmentsSinceStartup().toString() );
        pmHealthObj.addProperty( PREFERS, manager.getPrefers() );

        _parseVisViewsHealth( manager, pmHealthObj, data );
    } );
};

/**
 * Parses visview health
 * @param  {ViewerHealthObject} manager manager health
 * @param  {Object} pmHealthObj pool manager health object
 * @param  {objec} data model
 */
var _parseVisViewsHealth = function( manager, pmHealthObj, data ) {
    var healthVisViews = manager.getAssignedVisViews();

    _.forEach( healthVisViews,
        function( healthVisView ) {
            var visViewHealthObject = _createHealthObject( exports.HealthObjectType.VISPROCESS );
            visViewHealthObject.setParent( pmHealthObj );
            pmHealthObj.addChild( visViewHealthObject );
            visViewHealthObject.setId( healthVisView.getProcessID() );
            visViewHealthObject.setDisplayType( data.i18n.healthInfoVisProcess );

            visViewHealthObject.addProperty( MSSINCEEMM, healthVisView.getSinceLastEmmS().toString() );
            visViewHealthObject.addProperty( TOTALEMMS, healthVisView.getTotalNumEMMs().toString() );

            if( healthVisView.getModels().length > 0 ) {
                visViewHealthObject.addProperty( MODELS, healthVisView.getModels()[ 0 ].toString() );
            }

            if( healthVisView.getProcessGpu() !== undefined ) {
                visViewHealthObject.addProperty( TOTALMEMPERGPU, healthVisView.getProcessGpu()
                    .getTotalMemPerGpu() );
                visViewHealthObject.addProperty( COMPUTERNUMGPUS, healthVisView.getProcessGpu().getNumGpus()
                    .toString() );
            }
            visViewHealthObject.addProperty( PORT, healthVisView.getPort().toString() );

            if( healthVisView.getClientConnections() !== undefined ) {
                visViewHealthObject.addProperty( NUMCLIENTS, healthVisView.getClientConnections().length
                    .toString() );
            }

            if( healthVisView.getServletConnections() !== undefined ) {
                visViewHealthObject.addProperty( SERVLETCONNECTIONS,
                    healthVisView.getServletConnections().length.toString() );
            }

            if( healthVisView.getProcessCpuUsageRatio() !== undefined ) {
                visViewHealthObject.addProperty( PROCESSCPUUSAGERATIO, healthVisView.getProcessCpuUsageRatio()
                    .getCurrent().toString() );
            }

            if( healthVisView.getProcessMemUsageRatio() !== undefined ) {
                visViewHealthObject.addProperty( PROCESSMEMORYCONSUMPTIONRATIO, healthVisView
                    .getProcessMemUsageRatio().getCurrent().toString() );
            }

            _processConnections( healthVisView, visViewHealthObject );
        } );
};

/**
 * Processes connections
 * @param  {Object} healthVisView heath object
 * @param  {ViewerHealthObject} visViewHealthObject visview health object
 */
var _processConnections = function( healthVisView, visViewHealthObject ) {
    var infoClients = healthVisView.getClientConnections();
    _.forEach( infoClients, function( infoClient ) {
        var clientHealthObjects = _getAllHealthObjsOfType( exports.HealthObjectType.CLIENT );

        var clientHealthObject = _.find( clientHealthObjects, function( healthObj ) {
            return healthObj.getId() === infoClient.getID();
        } );

        if( _.size( infoClient.getModels() ) > 0 ) {
            clientHealthObject.addProperty( MODELS, infoClient.getModels()[ 0 ] );
        }

        clientHealthObject.addProperty( TOTALEMMS, infoClient.getNumEMMs().toString() );
        clientHealthObject.addProperty( TOTALSENTBYTES, infoClient.getTotalSentBytes().toString() );
        clientHealthObject.addProperty( TOTALRECEIVEDBYTES, infoClient.getTotalReceivedBytes().toString() );

        clientHealthObject.setParent( visViewHealthObject );
        visViewHealthObject.addChild( clientHealthObject );
    } );
};

/**
 * Populates summary info in model
 * @param  {Object} data model
 */
export let populateSummaryInfo = function( data ) {
    var allHealthObjects = exports.getAllHealthObjects();
    var groupedObjs = _.groupBy( allHealthObjects, 'type' );

    var assigners = _.get( groupedObjs, exports.HealthObjectType.ASSIGNER );
    var assignersCount = assigners ? assigners.length : 0;
    data.serverPoolAssigners.uiValue = assignersCount.toString();

    var serverManagers = _.get( groupedObjs, exports.HealthObjectType.POOLMANAGER );
    var serverManagersCount = serverManagers ? serverManagers.length : 0;
    data.serverManagers.uiValue = serverManagersCount.toString();

    var visProcesses = _.get( groupedObjs, exports.HealthObjectType.VISPROCESS );
    var visProcessesCount = visProcesses ? visProcesses.length : 0;
    data.visProcesses.uiValue = visProcessesCount.toString();

    var clients = _.get( groupedObjs, exports.HealthObjectType.CLIENT );
    var clientsCount = clients ? clients.length : 0;
    data.clients.uiValue = clientsCount.toString();
};

/**
 * Populates children with the given health object
 * @param  {ViewerHealthObject} healthObj health obj
 * @param  {[ViewerHealthObject]} children children health objs
 */
var visitChild = function( healthObj, children ) {
    if( _.indexOf( children, healthObj ) > -1 ) {
        //child is visited
        return;
    }

    children.push( healthObj );
    var nextLevelChildren = null;
    nextLevelChildren = healthObj.getImmediateChildren();
    _.forEach( nextLevelChildren, function( next ) {
        visitChild( next, children );
    } );
};

/**
 * Gets all descendants for health object
 * @param  {ViewerHealthObject} healthObj health object
 * @returns {[ViewerHealthObject]} descendants
 */
export let getDescendants = function( healthObj ) {
    var descendants = [];
    _.forEach( healthObj.getImmediateChildren(), function( o ) {
        visitChild( o, descendants );
    } );
    return descendants;
};

export default exports = {
    HealthObjectType,
    getAllHealthObjects,
    getAssignerCount,
    getPoolManagerCount,
    getClientCount,
    getVisProcessCount,
    parseHealthData,
    populateSummaryInfo,
    getDescendants
};
