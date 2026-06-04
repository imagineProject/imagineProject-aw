// Copyright (c) 2022 Siemens

/**
 * @module js/cmDeriveRelationDirective
 */
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import localeSvc from 'js/localeService';
import soaSvc from 'soa/kernel/soaService';
import cdm from 'soa/kernel/clientDataModel';
import _ from 'lodash';

var exports = {};

/**
 * This method store relations which are returned by getDeepCopy SOA.
 *
 * @param {object} data - Data of ViewModelObject
 * @param {Array of Object} deepCopyInfoMap - DeepCopyRules related to BO
 */
export let getDeriveRelations = function( data, deepCopyInfoMap ) {
    appCtxSvc.updatePartialCtx( 'deriveRelationsDataProviders', [] );
    var deepCopyData = deepCopyInfoMap[ 1 ][ 0 ];
    var selectedChangeObject = appCtxSvc.ctx.mselected[ 0 ];
    appCtxSvc.updatePartialCtx( 'deepCopyData', [] );
    let newRelationNames = _.clone( data.relationNames );
    let newShowCopyOptions = _.clone( data.showCopyOptions );
    newRelationNames = [];
    newShowCopyOptions.dbValue = false;

    var allRelationTypes = [];
    for( var a in deepCopyData ) {
        var relName = deepCopyData[ a ].propertyValuesMap.propertyName[ 0 ];
        var deepCopyPropertyType = deepCopyData[ a ].propertyValuesMap.propertyType;
        if( deepCopyPropertyType[ 0 ] === 'Relation' ) {
            // LCS-651587:Here, name of property is 'IMAN_master_form_rev', framework soa code tries to search relation with this name,
            // but, the relation exists with name - 'IMAN_master_form' NOT 'IMAN_master_form_rev', so need to update relation name.
            if( relName === 'IMAN_master_form_rev' ) {
                relName = 'IMAN_master_form';
            }

            allRelationTypes.push( relName );
        }
    }
    return soaSvc.ensureModelTypesLoaded( allRelationTypes ).then( function() {
        selectedChangeObject.deepCopyData = {};
        for( var a in deepCopyData ) {
            //Only process relation for derive
            var deepCopyPropertyType = deepCopyData[ a ].propertyValuesMap.propertyType;
            if( deepCopyPropertyType[ 0 ] !== 'Relation' ) {
                continue;
            }

            var deepCopyCopyAction = deepCopyData[ a ].propertyValuesMap.copyAction;
            if( deepCopyCopyAction[ 0 ] === 'NoCopy' ) {
                continue;
            }

            var relName = deepCopyData[ a ].propertyValuesMap.propertyName[ 0 ];

            //LCS-651587: Here, name of property is 'IMAN_master_form_rev', framework soa code tries to search relation with this name,
            // but, the relation exists with name - 'IMAN_master_form' NOT 'IMAN_master_form_rev', so need to update relation name.
            if( relName === 'IMAN_master_form_rev' ) {
                relName = 'IMAN_master_form';
            }

            if( !newRelationNames.includes( relName ) ) {
                newRelationNames.push( relName );
            }
            //Getrelation type
            var relType = cmm.getType( relName );

            var attachedObject = deepCopyData[ a ].attachedObject;
            if( !selectedChangeObject.deepCopyData[ relName ] ) {
                selectedChangeObject.deepCopyData[ relName ] = {};
                selectedChangeObject.deepCopyData[ relName ].dbValues = [];
            }

            selectedChangeObject.deepCopyData[ relName ].dbValues.push( attachedObject.uid );
            selectedChangeObject.deepCopyData[ relName ].relationType = relType;
            var deepCopyDataArray = appCtxSvc.ctx.deepCopyData;
            deepCopyDataArray.push( deepCopyData[ a ] );
            appCtxSvc.updatePartialCtx( 'deepCopyData', deepCopyDataArray );
        }
        //found one relation so show copy option
        if( newRelationNames.length > 0 ) {
            newShowCopyOptions.dbValue = true;
        }
        return{
            relationNames:newRelationNames,
            showCopyOptions:newShowCopyOptions

        };
    } );
};
/**
 * This method get secondary objects from relation.
 *
 * @param {object} data - Data of ViewModelObject
 * @param {relation} relation - relation name
 */
export let getRelationsObjects = function( data, relation ) {
    var relationSource = {};

    var propertyDisplayName = '';
    var dataDisplay = {};

    //variable which will give me selected object from this relation panel. Setting this on appContext object.
    var deriveRelationProvider = {
        relationName: relation,
        dataProvider: data.dataProviders.getPropagateRelationProvider
    };
    var deriveReldataProviders = appCtxSvc.ctx.deriveRelationsDataProviders;
    deriveReldataProviders.push( deriveRelationProvider );
    appCtxSvc.updatePartialCtx( 'deriveRelationsDataProviders', deriveReldataProviders );

    var selectedChangeObjectVMO = appCtxSvc.ctx.mselected[ 0 ];
    relationSource = selectedChangeObjectVMO.deepCopyData;
    propertyDisplayName = selectedChangeObjectVMO.deepCopyData[ relation ].relationType.displayName;
    dataDisplay = selectedChangeObjectVMO.deepCopyData[ relation ].relationType;

    //related object from source change object
    let newRelatedObjects = _.clone( data.relatedObjects );
    let newDisplayedType = _.clone( data.displayedType );
    let newCountLabel = _.clone( data.countLabel );

    newRelatedObjects = [];
    var relatedObjectUid = relationSource[ relation ].dbValues;
    for( var uid in relatedObjectUid ) {
        if( cdm.containsObject( relatedObjectUid[ uid ] ) ) {
            var mObject = cdm.getObject( relatedObjectUid[ uid ] );
            newRelatedObjects.push( mObject );
        }
    }

    dataDisplay.propertyDisplayName = propertyDisplayName;
    newDisplayedType = dataDisplay;

    //By default set it to 0 of total selected.getPropagateRelationProvider.modelObjectsUpdated will reset it to proper selected objects.
    var resource = 'ChangeMessages';
    var localTextBundle = localeSvc.getLoadedText( resource );
    var countLabel = localTextBundle.countLabel;
    countLabel = countLabel.replace( '{0}', '0' );
    countLabel = countLabel.replace( '{1}',
        relatedObjectUid.length );
    var countDisplayProp = newCountLabel;
    countDisplayProp.propertyDisplayName = countLabel;
    newCountLabel = countDisplayProp;

    return{
        relatedObjects:newRelatedObjects,
        displayedType:newDisplayedType,
        countLabel:newCountLabel
    };
};
/**
 * This method will call on modelObjectsUpdated and select loaded objects.
 *
 * @param {object} data - Data of ViewModelObject
 */
export let selectLoadedObjects = function( data ) {
    var propagateRel = appCtxSvc.ctx.autoPropagateRel;
    if( propagateRel ) {
        data.dataProviders.getPropagateRelationProvider.selectAll();
    }
};

export default exports = {
    getDeriveRelations,
    getRelationsObjects,
    selectLoadedObjects
};
