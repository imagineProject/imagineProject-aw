// Copyright (c) 2022 Siemens

/**
 * This implements the signoff table present on EPMJobInfoSummary stylesheet.
 *
 * @module js/Awp0SignoffService
 */
import viewModelObjectService from 'js/viewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';

var exports = {};

/**
 * Gets the Signoff Table data
 *
 * @param {object} response - the search response Object
 * @return {object} signoffObjects - view model signoff objects to be shown in signoff table
 *
 */
export let populateSignoffTableData = function( response  ) {
    var signoffObjects = [];

    if( !response && !response.searchResultsJSON ) {
        return signoffObjects;
    }

    var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );

    if( !searchResults && !searchResults.objects ) {
        return signoffObjects;
    }

    //Iterate over all the objects returned in search result via SOA response
    _.forEach( searchResults.objects, function( searchResultRow ) {
        var uid = searchResultRow.uid;
        var obj = response.ServiceData.modelObjects[uid];

        //Perform processing only for 'Signoff' objects
        if ( obj && obj.modelType.typeHierarchyArray.indexOf( 'Signoff' ) > -1 ) {
            var performer = {
                dbValues: [],
                uiValues: []
            };

            /*Check if the Signoff has fnd0Performer property. If the property is not null then
            populate performer with fnd0Performer value . Else If fnd0Performer is null then
            populate performer with resource_pool property value .
            */
            if ( obj.props && obj.props.fnd0Performer && obj.props.fnd0Performer.dbValues && obj.props.fnd0Performer.dbValues[0]
                && obj.props.fnd0Performer.dbValues[0] !== null ) {
                performer.dbValues = obj.props.fnd0Performer.dbValues;
                performer.uiValues = obj.props.fnd0Performer.uiValues;
            } else if ( obj.props && obj.props.resource_pool && obj.props.resource_pool.dbValues ) {
                performer.dbValues = obj.props.resource_pool.dbValues;
                performer.uiValues = obj.props.resource_pool.uiValues;
            }

            //Construct View model object
            var vmObject = viewModelObjectService.constructViewModelObjectFromModelObject( obj, 'EDIT' );

            // Create property 'Performer'
            var vmProp = null;
            vmProp = uwPropertySvc.createViewModelProperty( 'Performer', 'Performer',
                'STRING', performer.dbValues, performer.uiValues );
            vmProp.dbValues = performer.dbValues;
            vmProp.uiValues = performer.uiValues;
            vmObject.props.Performer = vmProp;

            signoffObjects.push( vmObject );
        }
    } );

    return signoffObjects;
};


export default exports = {
    populateSignoffTableData
};
