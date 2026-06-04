//@<COPYRIGHT>@
//==================================================
//Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

/*global
 */

/**
 * This is the create snapshot service contribution.
 *
 * @module js/createSnapshot.contributions
 */
 import app from 'app';
 import declUtils from 'js/declUtils';
 import AwPromiseService from 'js/awPromiseService';


 var contribution = {
     getcreateSnapshotService: function() {
         var deferred = AwPromiseService.instance.defer();

         declUtils.loadDependentModule( 'js/viewerProductSnapshotService' ).then(
             function( depModuleObj ) {
                 deferred.resolve( depModuleObj );
             } );

         return deferred.promise;
     }
 };

 /**
  *
  * @param {*} key
  * @param {*} deferred
  */
 export default function( key, deferred ) {
     if( key === 'createSnapshotService' ) {
         deferred.resolve( contribution );
     } else {
         deferred.resolve();
     }
 }

