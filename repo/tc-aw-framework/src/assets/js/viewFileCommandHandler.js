// Copyright (c) 2020 Siemens

/**
 * This is the command handler for view file command
 *
 * @module js/viewFileCommandHandler
 */
import commandsMapSvc from 'js/commandsMapService';
import localeSvc from 'js/localeService';
import msgSvc from 'js/messagingService';
import cdm from 'soa/kernel/clientDataModel';
import fmsSvc from 'soa/fileManagementService';
import fmsUtils from 'js/fmsUtils';

let exports;

var showNoFileMessage = function() {
    localeSvc.getTextPromise().then( function( localTextBundle ) {
        msgSvc.showInfo( localTextBundle.NO_FILE_TO_DOWNLOAD_TEXT );
    } );
};

var processReadTicketResponse = function( readFileTicketsResponse ) {
    var originalFileName = null;
    if( readFileTicketsResponse && readFileTicketsResponse.tickets && readFileTicketsResponse.tickets.length > 1 ) {
        var imanFileArray = readFileTicketsResponse.tickets[ 0 ];
        if( imanFileArray && imanFileArray.length > 0 ) {
            var imanFileObj = cdm.getObject( imanFileArray[ 0 ].uid );
            if( imanFileObj.props ) {
                originalFileName = imanFileObj.props.original_file_name.uiValues[ 0 ];
                originalFileName.replace( ' ', '_' );
            }
        }
        var ticketsArray = readFileTicketsResponse.tickets[ 1 ]; // 1st element is array of iman file while 2nd element is array of tickets
        if( ticketsArray && ticketsArray.length > 0 && originalFileName ) {
            fmsUtils.openFile( ticketsArray[ 0 ], originalFileName );
        } else {
            showNoFileMessage();
        }
    } else {
        showNoFileMessage();
    }
};

/**
 * Set command context for show object cell command which evaluates isVisible and isEnabled flags
 *
 * @param {ViewModelObject} context - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {Object} $scope - scope object in which isVisible and isEnabled flags needs to be set.
 */
export let setCommandContext = function( context, $scope ) {
    if( !commandsMapSvc.isInstanceOf( 'Dataset', context.modelType ) ) {
        $scope.cellCommandVisiblilty = true;
    } else {
        $scope.cellCommandVisiblilty = false;
    }
};

/**
 * Initialize the command handler service
 *
 */
export let init = function() {
    // no-op
};

/**
 * Execute the command.
 * <P>
 * The command context should be setup before calling isVisible, isEnabled and execute.
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 */
export let execute = function( vmo ) {
    var props = null;
    if( vmo.props ) {
        props = vmo.props;
    } else if( vmo.properties ) {
        props = vmo.properties;
    }

    if( props ) {
        var imanFiles = props.ref_list;
        if( imanFiles && imanFiles.hasReadAccess !== false && imanFiles.dbValues.length > 0 ) {
            var imanFileUid = imanFiles.dbValues[ 0 ]; // process only first file uid
            var imanFileModelObject = cdm.getObject( imanFileUid );
            var files = [ imanFileModelObject ];
            var promise = fmsSvc.getFileReadTickets( files );
            promise.then( function( readFileTicketsResponse ) {
                processReadTicketResponse( readFileTicketsResponse );
            } );
        } else {
            showNoFileMessage();
        }
    }
};

exports = {
    setCommandContext,
    init,
    execute
};
export default exports;
