//@<COPYRIGHT>@
//==================================================
//Copyright 2018.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/**
 * @module js/Saw1BaselineScheduleService
 */

import commandPanelService from 'js/commandPanel.service';
import appCtxService from 'js/appCtxService';
import selectionService from 'js/selection.service';
import soa_dataManagementService from 'soa/dataManagementService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import ScheduleManagerCommonUtils from 'js/ScheduleManagerCommonUtils';
import _ from 'lodash';

var exports = {};

export let openCreateBaselinePanel = function( commandId, location, commandContext ) {
    var sch_tag = appCtxService.ctx.selected.uid;
    var deferred = AwPromiseService.instance.defer();
    const { dialogAction } = commandContext;
    soa_dataManagementService.getProperties( [ sch_tag ], [ 'activeschbaseline_tag' ] ).then( function() {
        var isActiveFlag;
        var flag;
        var Scheduletag = 'Scheduletag';
        var selection = selectionService.getSelection().selected;
        if ( selection && selection.length > 0 ) {
            flag = selection[0].props.activeschbaseline_tag.dbValues[0];

            if ( flag === '' ) {
                isActiveFlag = false;
            } else {
                isActiveFlag = true;
            }
            var scheduleObject = {
                selected: selection[0],
                isActiveBaseline: isActiveFlag
            };
            appCtxService.registerCtx( Scheduletag, scheduleObject );
        } else {
            appCtxService.unRegisterCtx( Scheduletag );
        }
        deferred.resolve();
    } );
    if( dialogAction ) {
        let options =  {
            view: commandId,
            parent: '.aw-layout-workarea',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            push: true,
            subPanelContext: commandContext,
            commandid: commandId,
            commandicon: 'cmdBaselineSchedule'
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location );
    }
};

export let checkIsActiveChkboxVisibility = function( data ) {
    var selection = data.subPanelContext.selectionData.selected[0];
    var flag;
    if ( selection ) {
        flag = selection.props.activeschbaseline_tag.dbValues[0];
        if ( flag === '' ) {
            return true;
        }
        return data.isActive.dbValue;
    }
};

var baselineCellHeader = function( data, resultObject ) {
    var props = [];

    var cellHeader1 = resultObject.props.object_string.uiValues[0];
    props.push(  String( data.i18n.baselineName ) + '\\:' + cellHeader1 );

    var cellHeader2 = '';
    props.push( String( data.i18n.saw1ActiveBaseline ) + '\\: ' + cellHeader2 );

    var cellHeader3 = resultObject.props.creation_date.uiValues[0];
    props.push( String( data.i18n.creationDate ) + '\\:' + cellHeader3 );

    var cellHeader4 = resultObject.props.owning_user.uiValues[0];
    props.push( String( data.i18n.owner ) + '\\:' + cellHeader4 );

    if ( props ) {
        resultObject.props.awp0CellProperties.dbValues = props;
        resultObject.props.awp0CellProperties.uiValues = props;
    }
};

/**
 * Get the default page size used for max to load/return.
 *
 * @param {Array|Object} defaultPageSizePreference - default page size from server preferences
 * @returns {Number} The amount of objects to return from a server SOA response.
 */
export let getDefaultPageSize = function( defaultPageSizePreference ) {
    return ScheduleManagerCommonUtils.getDefaultPageSize( defaultPageSizePreference );
};

var processProviderResponse = function( response, data, scheduleNavigationContext ) {
    var sch_tag = [];
    var activeBaseline;
    var baselines;
    var deferred = AwPromiseService.instance.defer();
    //Adding uids into list for loading creation_date properties
    if ( response.searchResults ) {
        response.searchResults.forEach( function( res ) {
            sch_tag.push( res.uid );
        } );
        soa_dataManagementService.getProperties( sch_tag, [ 'creation_date' ] ).then( function() {
            // Check if response is not null and it has some search results then iterate for each result to formulate the
            // correct response
            if ( response && response.searchResults ) {
                response.searchResults.forEach( function( result ) {
                    // Get the model object for search result object UID present in response
                    var resultObject = cdm.getObject( result.uid );

                    if ( resultObject ) {
                        baselineCellHeader( data, resultObject );
                        var activeBaselineSchedule = appCtxService.ctx.selected.props.activeschbaseline_tag.dbValues[0];
                        if( activeBaselineSchedule === resultObject.uid ) {
                            activeBaseline = resultObject;
                        }
                    }
                } );
            }
            //remove selected baseline from response
            if ( scheduleNavigationContext && scheduleNavigationContext.baselineUids.length > 0 ) {
                for ( var x = 0; x < scheduleNavigationContext.baselineUids.length; x++ ) {
                    _.remove( response.searchResults, function( obj ) {
                        if ( obj.uid && scheduleNavigationContext.baselineUids[x] &&
                            obj.uid === scheduleNavigationContext.baselineUids[x] ) {
                            return true;
                        }
                        return false;
                    } );
                }
            }

            //remove active baseline from response and add to active baseline data provider.
            var dataProvider = data.dataProviders.activeBaseline;
            if ( activeBaseline && dataProvider ) {
                var updateActiveBaselineList = dataProvider.viewModelCollection.loadedVMObjects;
                if( updateActiveBaselineList.length === 0 ) {
                    updateActiveBaselineList.push( activeBaseline );
                    dataProvider.update( updateActiveBaselineList );
                }
                var exists = _.findIndex( response.searchResults, ( resp ) => resp.uid === activeBaseline.uid  );
                if ( exists !== -1 ) {
                    response.searchResults.splice( exists, 1 );
                    response.totalFound--;
                    response.totalLoaded--;
                }
            }

            baselines = response.searchResults;

            deferred.resolve( baselines );
        } );
    }
    return deferred.promise;
};

/**
 *
 * @param {Object} dataProviders : dataproviders
 * @param {Objects} scheduleNavigationContext : scheduleNavigationContext state that contains baselineUids
 * @returns baseline objects
 */
export let getSelectedBaseline = function( dataProviders, scheduleNavigationContext ) {
    let baselineObjs = cdm.getObjects( scheduleNavigationContext.baselineUids );
    removeFromAvailableBaseline( dataProviders, baselineObjs );
    return baselineObjs;
};

/**
 *
 * @param {Object} dataProviders : dataproviders
 * @param {Object} vmo : baseline objects
 */
function removeFromAvailableBaseline( dataProviders, vmo ) {
    if ( !_.isEmpty( vmo ) ) {
        let availModelObjects = dataProviders.getBaselines.viewModelCollection.loadedVMObjects;
        if ( availModelObjects.length > 0 ) {
            for ( var x = 0; x < vmo.length; x++ ) {
                _.remove( availModelObjects, function( obj ) {
                    if ( obj.uid && vmo[x].uid &&
                        obj.uid === vmo[x].uid ) {
                        return true;
                    }
                    return false;
                } );
            }
            dataProviders.getBaselines.update( availModelObjects );
        }
    }
}

export default exports = {
    openCreateBaselinePanel,
    checkIsActiveChkboxVisibility,
    processProviderResponse,
    getSelectedBaseline,
    getDefaultPageSize
};

