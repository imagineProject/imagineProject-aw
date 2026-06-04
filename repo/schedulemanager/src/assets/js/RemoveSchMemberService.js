// Copyright (c) 2022 Siemens

/**
 * @module js/RemoveSchMemberService
 */
import _ from 'lodash';

var exports = {};

/**
 * Get selected member names.
 * @param {Object} ctx The context object.
 * @returns {Array} The member name.
 */
export let getSelectedNames = function( ctx ) {
    var members = '';
    _.forEach( ctx.mselected, function( membersObj ) {
        members += membersObj.props.object_name.dbValues[ 0 ] + '","';
    } );
    return members.slice( 0, -3 );
};

/**
 * Get selected object.
 * @param {Object} ctx The context object.
 * @returns {Array} selected objects
 */
export let getObjects = function( ctx ) {
    var input = [];
    for( var secondObj in ctx.mselected ) {
        if( ctx.mselected.hasOwnProperty( secondObj ) ) {
            var inputData = {
                object: ctx.mselected[ secondObj ]
            };
            input.push( inputData );
        }
    }
    return input;
};

exports = {
    getSelectedNames,
    getObjects
};

export default exports;
