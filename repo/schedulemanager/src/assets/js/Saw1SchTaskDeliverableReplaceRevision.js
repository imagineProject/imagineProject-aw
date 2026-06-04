//@<COPYRIGHT>@
//==================================================
//Copyright 2019.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/Saw1SchTaskDeliverableReplaceRevision
 */
import _ from 'lodash';
import eventBus from 'js/eventBus';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import messagingSvc from 'js/messagingService';

'use strict';

/**
 * Define public API
 */
var exports = {};

/**
 * Iterate revisions for selected task Deliverable. Remove current revision from the list
 * @param {response} response - Response of getProperties
 * @param {object} targetObject - selected object
 * @returns {object} object - output data
 */
export let loadSchTaskDelRevisions = function( response, targetObject ) {
    var selected = targetObject.props.fnd0DeliverableInstance.dbValue;
    var searchResults = [];
    var selectedObj = cdm.getObject( selected );
    if ( selectedObj.props.revision_list && selectedObj.props.revision_list.dbValues.length > 1 ) {
        var revisionsUid = selectedObj.props.revision_list.dbValues;
        for ( var count = 0; count < revisionsUid.length; count++ ) {
            if ( selected !== revisionsUid[count] ) {
                searchResults.push( cdm.getObject( revisionsUid[count] ) );
            }
        }
        // Sort befre returning the ranges.
        var sortedSearchResults = _.sortBy( searchResults, [ function( revision ) { return revision.props.creation_date.dbValues[0]; } ] ).reverse();
        var outputData = {};
        outputData = {
            revisions: sortedSearchResults,
            length: searchResults.length
        };
        return outputData;
    }
};

/**
 * get input arrays of UIDs for getProperties.
 *
 * @param {ctx} mselected - The ctx of the viewModel
 * @returns {object} getPropertiesInput
 */
export let getPropertiesInputUIDs = function( mselected ) {
    var getPropertiesInput = [];
    for( var selCount = 0; selCount < mselected.length; selCount++ ) {
        var delInstance = {
            type: 'fnd0DeliverableInstance',
            uid: mselected[selCount].props.fnd0DeliverableInstance.dbValue
        };
        getPropertiesInput.push( delInstance );
    }
    return getPropertiesInput;
};

var prepareReplaceRevisionErrorMessage = function( error, firstParam, secondParam ) {
    var message = error + '<br\>';
    message = message.replace( '{0}', firstParam );
    message = message.replace( '{1}', secondParam );
    return message;
};

export let processSoaResponse = function( response, localizationKeys, ctx, inputData, noRevisions, releasedRevision ) {
    var finalMessage = '';
    if ( response && response.ServiceData && response.ServiceData.partialErrors ) {
        for( var index in response.ServiceData.partialErrors ) {
            var partialError = response.ServiceData.partialErrors[ index ];
            for( var count in partialError.errorValues ) {
                if ( count === 0 && ctx.mselected.length !== 1 ) {
                    finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoOfSelectionsForReplaceRevisionErrorMsg, inputData.length,
                        noRevisions.length + inputData.length + releasedRevision.length );
                }
                if( partialError.errorValues[ count ].code === 230045 ) { // No permission to Replace Revisions.
                    finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoPermissionToReplaceRevisionErrorMsg, inputData[i].cellHeader1 );
                }
            }
        }
    } else {
        eventBus.publish( 'cdm.relatedModified', {
            relatedModified: [ ctx.xrtSummaryContextObject ]
        } );
        if ( noRevisions ) {
            for ( var i = 0; i < noRevisions.length; i++ ) {
                if ( i === 0 && ctx.mselected.length !== 1 ) {
                    finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoOfSelectionsForReplaceRevisionErrorMsg, inputData.length,
                        noRevisions.length + inputData.length + releasedRevision.length );
                }
                finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoRevisionToReplaceRevisionErrorMsg, noRevisions[i].props.object_name.dbValues[0] );
            }
        }
        if ( releasedRevision ) {
            for ( var j = 0; j < releasedRevision.length; j++ ) {
                if ( j === 0 && ctx.mselected.length !== 1 && finalMessage.length < 1 ) {
                    finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoOfSelectionsForReplaceRevisionErrorMsg, inputData.length,
                        noRevisions.length + inputData.length + releasedRevision.length );
                }
                finalMessage += prepareReplaceRevisionErrorMessage( localizationKeys.saw1NoPermissionToReplaceRevisionErrorMsg, releasedRevision[j].props.object_name.dbValues[0] );
            }
        }
    }
    if ( finalMessage.length ) {
        messagingSvc.showError( finalMessage );
    }
};

/**
 * SetProperty of relation with latest revision for SchTaskDeliverable.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {localizationKeys} string - The data of the viewModel
 */
export let replaceLatestSchTaskDelRevision = function( ctx, localizationKeys ) {
    var deliverables = [];
    var inputData = [];
    var noRevisions = [];
    var releasedRevision = [];

    for ( var selCount = 0; selCount < ctx.mselected.length; selCount++ ) {
        if ( ctx.mselected[selCount].props.fnd0DeliverableInstance.dbValue && ctx.mselected[selCount].props.fnd0DeliverableInstance.dbValue !== '' ) {
            var selectedObj = cdm.getObject( ctx.mselected[selCount].props.fnd0DeliverableInstance.dbValue );
            deliverables = [];
            if ( selectedObj.props.revision_list && selectedObj.props.revision_list.dbValues.length > 1 ) {
                deliverables.push( selectedObj.props.revision_list.dbValues[selectedObj.props.revision_list.dbValues.length - 1] );
                var objectModified = {
                    object: ctx.mselected[ selCount ],
                    timestamp: '',
                    vecNameVal: [ {
                        name: 'fnd0DeliverableInstance',
                        values: deliverables
                    } ]
                };
                inputData.push( objectModified );
            } else if ( selectedObj.props.date_released && selectedObj.props.date_released.dbValues[0] !== null ) {
                releasedRevision.push( selectedObj );
            } else {
                noRevisions.push( ctx.mselected[ selCount ] );
            }
        } else {
            noRevisions.push( ctx.mselected[ selCount ] );
        }
    }

    if ( inputData.length ) {
        soaSvc.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', {
            info: inputData
        } ).then( function( response ) {
            exports.processSoaResponse( response, localizationKeys, ctx, inputData, noRevisions, releasedRevision );
        } );
    } else {
        exports.processSoaResponse( null, localizationKeys, ctx, inputData, noRevisions, releasedRevision );
    }
};

/**
 * SetProperty of relation with selected revision from panel.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 */
export let replaceSchTaskDelRevision = function( ctx, data ) {
    var inputData = [];
    var objectModified = {
        object: ctx.mselected[0],
        timestamp: '',
        vecNameVal: [ {
            name: 'fnd0DeliverableInstance',
            values: [ data.dataProviders.getRevisionsProvider.selectedObjects[0].uid ]
        } ]
    };
    inputData.push( objectModified );
    soaSvc.postUnchecked( 'Core-2010-09-DataManagement', 'setProperties', {
        info: inputData
    } ).then( function( response ) {
        exports.processSoaResponse( response, data.i18n, ctx, inputData );
    } );
};

/**
 * This factory creates a service and returns exports
 *
 * @member Saw1SchTaskDeliverableReplaceRevision
 */

export default exports = {
    replaceSchTaskDelRevision,
    replaceLatestSchTaskDelRevision,
    processSoaResponse,
    getPropertiesInputUIDs,
    loadSchTaskDelRevisions
};
