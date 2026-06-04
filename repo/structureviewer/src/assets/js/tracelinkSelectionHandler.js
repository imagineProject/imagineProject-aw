// Copyright (c) 2022 Siemens

/**
 * This manages the SDPD selection tracelink traversal
 *
 * @module js/tracelinkSelectionHandler
 */
import AwBaseService from 'js/awBaseService';
import AwPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';
import preferenceService from 'soa/preferenceService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import viewerCtxSvc from 'js/viewerContext.service';
import StructureViewerSelectionHandler from 'js/structureViewerSelectionHandlerProvider';

class TracelinkSelectionHandler extends AwBaseService {
    constructor() {
        super();
        this._useSubclasses = false;
        this._typeNameList = [];

        this._viewerContextData = null;
        this._typeNameListPref = null;

        /*
         * This service is used to find if the objects selected are tracelinked traversal objects
         */

        this._typeNameListPref = AwPromiseService.instance.defer();

        preferenceService.getStringValues( [ 'ASE0_Show_3D_Data_On_Selection' ] ).then( ( types ) => {
            if( types ) {
                for( var i = 0; i < types.length; i++ ) {
                    this._typeNameList.push( types[ i ] );
                }
            }
            this._typeNameListPref.resolve();
        } );

        preferenceService.getLogicalValue( 'ASE0_Show_3D_Data_For_Subclasses' ).then(
            ( result ) => {
                if( result !== null && result.length > 0 && result.toUpperCase() === 'TRUE' ) {
                    this._useSubclasses = true;
                } else {
                    this._useSubclasses = false;
                }
            } );
    }
    /**
     * Notes for SDPD selection change
     *
     *  on ACE selection changed
     *  if any selected object in ACE is a tracelink type
     *         (call isSelectionTracelinkTraversalType to check if it is)
     *     if selection type is OCC_SELECTED or ROOT_PRODUCT_SELECTED
     *     then call show only
     *  else if is selected object a 3D part
     *     then call current 3d selection code in StructureViewerSelectionHandler.js
     *     NOTE: need to find a better way to do this check if selected obj is a 3D part
     *           current implementation checks hard coded types
     *  else
     *     turn everything off
     */

    isRootSelectionTracelinkType() {
        var occmgmtContext = appCtxService.getCtx( 'occmgmtContext' );
        var root = [];
        if( occmgmtContext && occmgmtContext.topElement ) {
            root.push( occmgmtContext.topElement );
        }
        return this.isSelectionTracelinkTraversalType( root, false );
    }

    setCtxData( tracelinkTraversalTypeSelected ) {
        if( !this._viewerContextData ) {
            let aceActiveContext = appCtxService.getCtx( 'aceActiveContext' );
            let occmgmtContextKey = aceActiveContext && aceActiveContext.key ? aceActiveContext.key : 'occmgmtContext';
            let viewerContextNamespace = viewerCtxSvc.getActiveViewerContextNamespaceKey( occmgmtContextKey );
            this._viewerContextData =  viewerCtxSvc.getRegisteredViewerContext( viewerContextNamespace );
        }
        if( this._viewerContextData ) {
            this._viewerContextData.updateViewerAtomicData( 'isSelectionTracelinkTraversalType', tracelinkTraversalTypeSelected );
            this._viewerContextData.updateViewerAtomicData( 'disablePMI', tracelinkTraversalTypeSelected );
            this._viewerContextData.updateViewerAtomicData( 'disableImageCapture', tracelinkTraversalTypeSelected );
            this._viewerContextData.updateViewerAtomicData( 'disableGeoAnalysis', tracelinkTraversalTypeSelected );
            this._viewerContextData.updateViewerAtomicData( 'isLogicalSelected', tracelinkTraversalTypeSelected );
        }
    }

    arePrefsFilled() {
        return this._typeNameListPref.promise;
    }

    /**
     * Check if any of the input objects are a tracelink traversal type
     *
     * @param {ObjectArray} selections ModelObject array
     * @param {Boolean} forSelection flag used to update the context for selection
     * @return {boolean} true if input object is a tracelink traversal type
     */
    isSelectionTracelinkTraversalType( selections, forSelection ) {
        if( selections !== null ) {
            for( var i = 0; i < selections.length; i++ ) {
                for( var j = 0; j < this._typeNameList.length; j++ ) {
                    if( this._useSubclasses ) {
                        if( cmm.isInstanceOf( this._typeNameList[ j ], selections[ i ].modelType ) ) {
                            if( forSelection ) {
                                this.setCtxData( true );
                            }
                            return true;
                        }
                    } else {
                        if( selections[ i ] !== null ) {
                            if( selections[ i ].type === this._typeNameList[ j ] ) {
                                if( forSelection ) {
                                    this.setCtxData( true );
                                }
                                return true;
                            }
                        }
                    }
                }
            }
        }
        if( forSelection ) {
            this.setCtxData( false );
        }

        return false;
    }

    /**
     * Check if selected objects are a tracelink traversal type
     *
     * @return {boolean} true if selected object is a tracelink traversal type
     */
    isTracelinkTraversalObjectSelectedInAce() {
        if( appCtxService.ctx.mselected !== null ) {
            return this.isSelectionTracelinkTraversalType( appCtxService.ctx.mselected, true );
        }

        return false;
    }

    createVisibilityHandler( ParentVisibilityHandler, viewerContextData ) {
        this._viewerContextData = viewerContextData;

        var VisibilityHandlerFn = function() {};

        // Set Parent as prototype for this object to inherit Parents functions
        VisibilityHandlerFn.prototype = Object.create( Object.getPrototypeOf( ParentVisibilityHandler ) );

        // Set it to use our constructor
        VisibilityHandlerFn.prototype.constructor = VisibilityHandlerFn;

        // Override function getOccVisibility
        VisibilityHandlerFn.prototype.getOccVisibility = function( vmo ) {
            if( vmo !== null ) {
                var modelObjects = [];
                modelObjects.push( vmo );

                if( TracelinkSelectionHandler.instance.isSelectionTracelinkTraversalType( modelObjects, false ) ) {
                    return true;
                }

                if( cmm.isInstanceOf( 'Arm0RequirementElement', vmo.modelType ) ||
                    cmm.isInstanceOf( 'Ase0FunctionalElement', vmo.modelType ) ) {
                    return true;
                }

                return ParentVisibilityHandler.getOccVisibility( vmo );
            }

            return true;
        };

        // Override function toggleOccVisibility
        VisibilityHandlerFn.prototype.toggleOccVisibility = function( vmo ) {
            if( vmo !== null ) {
                var modelObjects = [];
                modelObjects.push( vmo );
                if( !TracelinkSelectionHandler.instance.isSelectionTracelinkTraversalType( modelObjects, false ) ) {
                    ParentVisibilityHandler.toggleOccVisibility( vmo );
                }
            }
        };

        // return new handler
        return new VisibilityHandlerFn( viewerContextData );
    }
}

class TracelinkSelection extends StructureViewerSelectionHandler {
    constructor( viewerContextData ) {
        super( viewerContextData );
    }

    getSelectionChangeEventHandler() {
        var self = this;
        // create custom selection handler
        return function( eventData ) {
            var selectionUids = eventData.selectionModel.getSelection();
            var selections = cdm.getObjects( selectionUids );
            if( TracelinkSelectionHandler.instance.isSelectionTracelinkTraversalType( selections, true ) ) {
                self.selectInViewer( [], [] );
            } else {
                // Use Parent selection handler
                self.selectionChangeEventHandler( eventData );
            }
        };
    }

    determineAndSelectPackedOccs( modelObjects, determinedCSIds ) {
        if( TracelinkSelectionHandler.instance.isSelectionTracelinkTraversalType( modelObjects, true ) ) {
            this.selectInViewer( [], [] );
            var deferred = AwPromiseService.instance.defer();
            deferred.resolve();
            return deferred.promise;
        }
        // Call Parent function determineAndSelectPackedOccs for non-logical objects
        return super.determineAndSelectPackedOccs( modelObjects, determinedCSIds );
    }
}

export {
    TracelinkSelectionHandler,
    TracelinkSelection
};
