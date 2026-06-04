// Copyright (c) 2022 Siemens

/**
 * @module js/aceInlineAuthoringHandler
 */
import AwPromiseService from 'js/awPromiseService';
import editHandlerSvc from 'js/editHandlerService';
import soaSvc from 'soa/kernel/soaService';
import aceInlineAuthEditService from 'js/aceInlineAuthEditService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import occmgmtVMTNodeCreateService from 'js/aceViewModelTreeNodeCreateService';
import aceAddElementService from 'js/aceAddElementService';
import uwPropertyService from 'js/uwPropertyService';
import aceInlineAuthoringUtils from 'js/aceInlineAuthoringUtils';
import localeService from 'js/localeService';
import aceStructureEditService from 'js/aceStructureEditService';
import aceIconService from 'js/aceIconService';
import aceInlineAuthoringRenderingService from 'js/aceInlineAuthoringRenderingService';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import parsingUtils from 'js/parsingUtils';
import messagingService from 'js/messagingService';
import occmgmtUtils from 'js/occmgmtUtils';
import cmm from 'soa/kernel/clientMetaModel';
import appCtxService from 'js/appCtxService';

var inlineAuthoringHandlerContext = 'INLINE_AUTHORING_HANDLER_CONTEXT';

var _dataProvider = null;
var _treeNodesLoaded = null;
var _eventSubDefs = [];
var _usageTypeChangedProp = null;
var _allowedTypesInfo = null;
var rowCounter = 0;

/**
     * List of SOA server response of getViewModelForCreate for each of Editable inline authoring ROW
     * This is required during the SAVE action on each row.
     */
var _jsonInlineRowsSvrResp = [];

/**
     * UID to indicate the identity of an object representing Inline Authoring VMO.
     */
var _inlineRowUids = [];

let callBackObj = null;

let currentInlineAuthoringContext = null;

/**
     * get Server VMO
     * @param {Object} parentElement - parent element
     * @param {[Object]} occContext - occContext atomic data
     * @return {Object} returns deferred promise
     */
var getServerVMO = function( parentElement, occContext, dialogActionForACEContextMenu ) {
    var deferred = AwPromiseService.instance.defer();

    // call getInfoForAddElement SOA  and getViewModelForCreate SOA to get server VMO
    var occType = occContext.supportedFeatures && occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature;
    var soaInput = {
        getInfoForElementIn: {
            parentElement: parentElement,
            fetchAllowedOccRevTypes: occType
        }
    };

    if( _allowedTypesInfo === null ) {
        soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'getInfoForAddElement4', soaInput ).then(
            function( response ) {
                _allowedTypesInfo = aceAddElementService.extractAllowedTypesInfoFromResponse( response );
                const preferredTypeName = _allowedTypesInfo.preferredType;
                var promise = soaSvc.ensureModelTypesLoaded( _allowedTypesInfo.objectTypeName.split( ',' ) );
                if( promise ) {
                    promise.then( function() {
                        getViewModelForCreate( parentElement, preferredTypeName, occContext, dialogActionForACEContextMenu );
                        return deferred.promise;
                    } );
                }
                return deferred.promise;
            },
            function( error ) {
                deferred.reject( error );
                return deferred.promise;
            } );
        return deferred.promise;
    }
    const preferredType = _allowedTypesInfo.preferredType;
    getViewModelForCreate( parentElement, preferredType, occContext, dialogActionForACEContextMenu );
    return deferred.promise;
};

var getViewModelForCreate = function( parentElement, preferredType, occContext, dialogActionForACEContextMenu ) {
    var deferred = AwPromiseService.instance.defer();
    const propertyNames = [ 'object_string', 'awb0Parent' ];
    _.forEach( _dataProvider.columnConfig.columns, function( column ) {
        if( !propertyNames.includes( column.propertyName ) && column.hiddenFlag !== undefined && column.hiddenFlag === false ) {
            propertyNames.push( column.propertyName );
        }
    } );

    _.forEach( _dataProvider.cols, function( column ) {
        if( column.propertyName === 'awb0Archetype' ) {
            column.renderingHint = 'SearchOrCreateObject';
        }

        if( column.propertyName === aceInlineAuthoringUtils.getTypePropertyNameForInlineRow( occContext ) ) {
            column.renderingHint = 'TypeDropDown';
        }
    } );

    var soaInput = {
        input: {
            businessObjectType: preferredType,
            propertyNames: propertyNames,
            parent: parentElement
        }
    };
    soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2019-12-DataManagement', 'getViewModelForCreate', soaInput ).then(
        function( response ) {
            if( response.ServiceData && response.ServiceData.partialErrors ) {
                const msg = aceInlineAuthoringUtils.processPartialErrors( response.ServiceData );
                messagingService.showError( msg );
                cancelEdits( occContext );
                return deferred.promise;
            }
            const promise = aceInlineAuthoringUtils.getSearchableObjectTypes( parentElement );
            if( promise ) {
                promise.then( function( searchableObjectTypes ) {
                    _addRow( response, parentElement, occContext, searchableObjectTypes, dialogActionForACEContextMenu );
                } );
            }
            return deferred.promise;
        },
        function( error ) {
            cancelEdits( occContext );
            deferred.reject( error );
            return deferred.promise;
        } );
};

/**
     * Method to set the editing mode
     *
     * @param {Boolean} editMode True, to get into edit mode. False otherwise
     */
var setInlineEditingMode = function( editMode ) {
    var stateName = 'starting';
    if( !editMode ) {
        stateName = 'reset';
    }
    aceInlineAuthEditService._notifySaveStateChanged( stateName );
};

/**
     * Update the display for inline authoring editable view model object.
     * @param {Object} occContext occ context.
     * @param {Object} inlineRowVmo View model object of editable row.
     */
var setInitialDisplayText = function( occContext, inlineRowVmo ) {
    const resource = 'OccmgmtInlineAuthConstants';
    const inlineLocalTextBundle = localeService.getLoadedText( resource );

    let i18nInlineDisplayText;
    const revisibleOccurrenceSupportedFeature = occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature;
    if( inlineLocalTextBundle ) {
        i18nInlineDisplayText = revisibleOccurrenceSupportedFeature ? inlineLocalTextBundle.inlineEbomDisplayText : inlineLocalTextBundle.inlineBvrDisplayText;
    } else {
        const asyncFun = function( localTextBundle ) {
            i18nInlineDisplayText = occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature ? localTextBundle.inlineEbomDisplayText : localTextBundle.inlineBvrDisplayText;
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }

    // Update text with counter number.
    rowCounter += 1;
    i18nInlineDisplayText = `${i18nInlineDisplayText} ${rowCounter}`;
    inlineRowVmo.props.object_string.uiValue = i18nInlineDisplayText;
    inlineRowVmo.props.object_string.uiValues[ 0 ] = i18nInlineDisplayText;
};

/**
     * Give inline row by the give UID
     * @param {Object} rowUid UID of the VMO to get from View Model Collection.
     * @return {Object} - Returns inline row object for given rowUid.
     */
var getInlineRowByUid = function( rowUid ) {
    var viewModelCollection = _dataProvider.getViewModelCollection();
    var inlineRowobjectIdx = viewModelCollection.findViewModelObjectById( rowUid );
    return viewModelCollection.getViewModelObject( inlineRowobjectIdx );
};

var insertElement = function( viewModelCollection, parentVMO, childVMOtoInsert, occContext ) {
    if( _treeNodesLoaded ) {
        eventBus.unsubscribe( _treeNodesLoaded );
        _treeNodesLoaded = null;
    }
    var childlevelIndex = 0;
    if( parentVMO ) {
        childlevelIndex = parentVMO.levelNdx + 1;
    }

    // Initialize child index to add as first element for Add Child case.
    var childNdx = 0;

    // Get child index for the sibling case. Consider the expanded state case.
    if( !currentInlineAuthoringContext.isInlineAddChildMode && !currentInlineAuthoringContext.inlineAuthoringContext.isInlineAddChildMode ) {
        var siblingVmo = _dataProvider.selectedObjects[ 0 ];
        // Insert the new row above the selected Sibling Row.
        childNdx = siblingVmo.childNdx;
    }

    // Create the viewModelTreeNode from the child ModelObject, child index and level index
    var childVMO = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( childVMOtoInsert, childNdx, childlevelIndex );
    _.merge( childVMO, childVMOtoInsert );
    childVMO.typeIconURL = aceIconService.getTypeIconURL( childVMO, childVMO.underlyingObjectType );

    childVMO.getId = function() {
        return this.uid;
    };
    childVMO.parentUid = parentVMO.uid;
    childVMO.props.awb0Parent.dbValues = [ parentVMO.uid ];
    childVMO.isInlineRow = true;

    // Current TABLE logic renders the newly added VMO/ROW only if the TABLE MODE is not EDIT.
    // Disable the EDIT mode before adding the new ROW to viewModelCollection
    // The mode will be restored to EDIT later as a part of notification.
    if( _inlineRowUids.length > 1 ) {
        setInlineEditingMode( false );
    }


    // insert the new treeNode in the viewModelCollection at the correct location
    var parentNodeIndex = viewModelCollection.indexOf( parentVMO );
    var expectedChildVmcIndex = aceStructureEditService.getVmcIndexForParentsNthChildIndex( occContext.vmc.getLoadedViewModelObjects(), parentNodeIndex, childNdx );
    viewModelCollection.splice( expectedChildVmcIndex, 0, childVMO );

    //Add the new treeNode to the parentVMO (if one exists) children array
    aceStructureEditService.addChildToParentsChildrenArray( parentVMO, childVMO, childNdx );

    _dataProvider.update( viewModelCollection );
};

/**
     * Adds row in Tree
     * @param {Object} parentElement - parent element
     * @param {Object} updatedVMO - VMO to be added
     * @param {[Object]} occContext - occContext atomic data
     */
var addRowInTree = function( parentElement, updatedVMO, occContext ) {
    var viewModelCollection = occContext.vmc.getLoadedViewModelObjects();
    var parentIdx = _.findLastIndex( viewModelCollection, function( vmo ) {
        return vmo.uid === parentElement.uid;
    } );

    var parentVMO = occContext.vmc.getViewModelObject( parentIdx );

    // If node has expand/collapse command
    if( parseInt( parentVMO.props.awb0NumberOfChildren.dbValues[ 0 ] ) > 0 ) {
        // Use case 1:-Add child row under unexpanded parent having 0 or more children
        // in this case we expand parent and then adds children
        if( !parentVMO.isExpanded ) {
            eventBus.publish( _dataProvider.name + '.expandTreeNode', {
                parentNode: parentVMO
            } );
            _treeNodesLoaded = eventBus.subscribe( 'occTreeTable.plTable.loadMorePages', function() {
                insertElement( viewModelCollection, parentVMO, updatedVMO, occContext );
            } );
        } else {
            // Use case 2:-Add child row under expanded parent having 0 or more childrens
            insertElement( viewModelCollection, parentVMO, updatedVMO, occContext );
        }
    } else {
        // Use case 3:-Add child row under parent having 0 children
        insertElement( viewModelCollection, parentVMO, updatedVMO, occContext );
    }
};

var _addRow = function( getViewModelForCreateResponse, parentElement, occContext, searchableObjectTypes, dialogActionForACEContextMenu ) {
    var deferred = AwPromiseService.instance.defer();
    if( getViewModelForCreateResponse ) {
        _jsonInlineRowsSvrResp.push( getViewModelForCreateResponse );
        var serverVMO = null;
        var viewModelCreateInObjsJsonStrings = getViewModelForCreateResponse.viewModelCreateInObjsJsonStrings;
        _.forEach( viewModelCreateInObjsJsonStrings, function( viewModelCreateInObjsJsonString ) {
            var responseObject = parsingUtils.parseJsonString( viewModelCreateInObjsJsonString );
            if( responseObject && responseObject.objects && responseObject.objects.length > 0 ) {
                serverVMO = responseObject.objects[ 0 ];
                serverVMO.uid = serverVMO.creinfo.uid;
                _inlineRowUids.push( serverVMO.uid );
            }
        } );

        var vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( serverVMO, 'EDIT' );
        var updatedVMO = viewModelObjectSvc.createViewModelObject( vmo, 'EDIT', null, serverVMO );
        updatedVMO.setEditableStates( true, true, true );
        updatedVMO.occurrenceId = updatedVMO.uid;
        updatedVMO.searchableObjectTypes = searchableObjectTypes;
        updatedVMO.dialogActionForACEContextMenu = dialogActionForACEContextMenu;
        setInitialDisplayText( occContext, updatedVMO );

        aceInlineAuthoringUtils.initPropsLovApi( updatedVMO, parentElement, getViewModelForCreateResponse.columnPropToCreateInPropMap );

        if( _usageTypeChangedProp === null ) {
            // new inline row is being added
            addRowInTree( parentElement, updatedVMO, occContext );

            // Scroll to new row
            var scrollEventData = {
                gridId: 'gridView',
                rowUids: [ updatedVMO.uid ]
            };
            eventBus.publish( 'plTable.scrollToRow', scrollEventData );
            _initSubscribeEventsForInlineAuthoring( parentElement, occContext );
        } else {
            //Usage type has been changed, and exsisting row is replaced with new row of selected type.
            const currentVmo = _usageTypeChangedProp.vmo;
            const viewModelCollection = occContext.vmc.getLoadedViewModelObjects();
            const srcNode = occContext.vmc.findViewModelObjectById( currentVmo.uid );
            const srcIndex = viewModelCollection.indexOf( currentVmo );
            if( srcIndex > -1 ) {
                // remove previous inline row response and inline row uid
                _jsonInlineRowsSvrResp.splice( _inlineRowUids.indexOf( currentVmo.uid ), 1 );
                _inlineRowUids.splice( _inlineRowUids.indexOf( currentVmo.uid ), 1 );

                // create a new row
                var replaceingInlinerow = occmgmtVMTNodeCreateService.createVMNodeUsingModelObjectInfo( updatedVMO, srcNode.childNdx, srcNode.levelNdx );
                // get a tree information from currnet row
                _.merge( replaceingInlinerow, currentVmo );
                // get the new row information from updatedVMO row
                _.merge( replaceingInlinerow, updatedVMO );
                replaceingInlinerow.displayName = replaceingInlinerow.props.object_string.uiValues[ 0 ];
                viewModelCollection.splice( srcIndex, 1 );
                viewModelCollection.splice( srcIndex, 0, replaceingInlinerow );
                _dataProvider.update( viewModelCollection );
                _usageTypeChangedProp = null;
            }
        }
    }

    return deferred.resolve();
};

/**
     * Subscribe the events required to achieve inline authoring capability
     * @param {[Object]} parentElement - Parent - element
     * @param {[Object]} occContext - occContext atomic data
     */
var _initSubscribeEventsForInlineAuthoring = function( parentElement, occContext ) {
    // For tree view call default implementation to register leave handler.

    if( _inlineRowUids.length === 1 ) {
        callBackObj = {
            occContext:occContext,
            parentElement:parentElement,
            cancelEdits: function() {
                cancelEdits( occContext );
            },
            saveEdits: function() {
                return saveEdits();
            },
            removeInlineEditableRows: function( targetObjects, removeSingle ) {
                _removeInlineEditableRows( targetObjects, removeSingle, occContext );
            }
        };
        aceInlineAuthEditService.startEdit( callBackObj );
    } else {
        setInlineEditingMode( true );
    }

    // Ace Replace case:- This will come out of inline authoring mode in case of replace in ace
    _eventSubDefs.push( eventBus.subscribe( 'ace.replaceRowsInTree', function() {
        exports.removeRow();
    } ) );
};

/**
     * Gives inline row
     * @param {Object} allRows Boolean to return all rows or if false return recent / last added row or
     * @return {Object} - Returns inline row object for allRows == false otherwise a list of all inline rows.
     */
var getInlineRow = function( allRows ) {
    var inlineRowobjects = [];
    var viewModelCollection = _dataProvider.getViewModelCollection();
    if( !allRows ) {
        var inlineRowobjectIndex = viewModelCollection.findViewModelObjectById( _.last( _inlineRowUids ) );
        inlineRowobjects = viewModelCollection.getViewModelObject( inlineRowobjectIndex );
    } else {
        _.forEach( _inlineRowUids, function( inlineRowUid ) {
            var inlineRowobjectIdx = viewModelCollection.findViewModelObjectById( inlineRowUid );
            var inlineRowobject = viewModelCollection.getViewModelObject( inlineRowobjectIdx );
            if( inlineRowobject ) {
                inlineRowobjects.push( inlineRowobject );
            }
        } );
    }
    return inlineRowobjects;
};

/**
     * Removes the given inline rows.
     * @param {Object} targetObjects -target rows to be removed
     * @param {Boolean} removeSingle - Removes single line
     * @param {Object} occContext - occContext atomic data
     */
var _removeInlineEditableRows = function( targetObjects, removeSingle, occContext ) {
    if( _dataProvider._isDestroyed ) {
        return;
    }
    var viewModelCollection = _dataProvider.getViewModelCollection();
    if( viewModelCollection ) {
        var objsToRemove = null;
        // Removes single row using cell commands
        if( removeSingle && removeSingle === true ) {
            objsToRemove = [ getInlineRowByUid( targetObjects[ 0 ].uid ) ];
            _jsonInlineRowsSvrResp.splice( _inlineRowUids.indexOf( targetObjects[ 0 ].uid ), 1 );
            _inlineRowUids.splice( _inlineRowUids.indexOf( targetObjects[ 0 ].uid ), 1 );
        // Remove row using other flow like cancel edits or save edits
        } else {
            objsToRemove = getInlineRow( true );
        }

        if( objsToRemove && objsToRemove.length > 0 ) {
            viewModelCollection.removeLoadedObjects( objsToRemove );
            viewModelCollection = occContext.vmc;
            if( viewModelCollection ) {
                _.forEach( objsToRemove, function( objToRemove ) {
                    var parentVmcNdx = viewModelCollection.findViewModelObjectById( objToRemove.parentUid );
                    var parentVMO = viewModelCollection.getViewModelObject( parentVmcNdx );
                    aceStructureEditService.removeChildFromParentChildrenArray( parentVMO, objToRemove );
                } );
            }
            _dataProvider.update( viewModelCollection.getLoadedViewModelObjects() );
        }
    }
};

/**
     * To cancel edits
     * @param {Object} occContext - occContext atomic data
     */
var cancelEdits = function( occContext ) {
    if( _inlineRowUids.length > 0 ) {
        //Discard case
        _removeInlineEditableRows( [], false, occContext );
    }
    currentInlineAuthoringContext = {
        inlineAuthoringContext : null,
        addRefPanelContext:null
    };
    occmgmtUtils.updateValueOnCtxOrState( '', currentInlineAuthoringContext, occContext );

    var editHandler = editHandlerSvc.getEditHandler( inlineAuthoringHandlerContext );
    if( editHandler ) {
        editHandlerSvc.removeEditHandler( inlineAuthoringHandlerContext );
    }
    if( _eventSubDefs.length > 0 ) {
        _.forEach( _eventSubDefs, function( subDef ) {
            eventBus.unsubscribe( subDef );
        } );
    }
    if( _dataProvider.selectionModel ) {
        _dataProvider.setSelectionEnabled( true );
    }
    _usageTypeChangedProp = null;
    _jsonInlineRowsSvrResp.splice( 0 );
    _inlineRowUids.splice( 0 );
    _allowedTypesInfo = null;

    // call default implementation to un-register leave handler.
    if( aceInlineAuthEditService.editInProgress() ) {
        aceInlineAuthEditService.cancelEdits();
    }
    rowCounter = 0;
};

/**
     * To save edits
     * @return {Object} returns save row
     */
var saveEdits = function() {
    // Save called from save/discard dialog
    _.forEach( _eventSubDefs, function( subDef ) {
        eventBus.unsubscribe( subDef );
    } );
    _eventSubDefs.splice( 0 );
    _dataProvider.setSelectionEnabled( true );

    return exports.saveRow().then(
        function() {
            aceInlineAuthEditService.cancelEdits();
        } ).catch( function() {
        // Save is unsuccessful from save/discard dialog

        cancelEdits( callBackObj.occContext );
        aceInlineAuthEditService.cancelEdits();
    } );
};

/**
     * Adds empty row in table
     * @param {Object} commandContext - commandContext instance
     * @param {Object} isChild - Add as child
     */
export const addRow = function( commandContext, isChild ) {
    const dialogActionForACEContextMenu = commandContext.dialogActionForACEContextMenu;
    let parentElement = null;
    if( isChild ) {
        parentElement = commandContext.occContext.pwaSelection[0];
    } else {
        var parentUid = commandContext.occContext.pwaSelection[0].props.awb0Parent.dbValues[0];
        parentElement = viewModelObjectSvc.createViewModelObject( parentUid );
    }

    // Identify if already in inline auhtoring mode.
    if( !commandContext.occContext.inlineAuthoringContext ) {
        _dataProvider = commandContext.dataProvider;
        const  newColumnConfig = { ..._dataProvider.columnConfig };
        var propColumns =  newColumnConfig.columns;
        aceInlineAuthoringRenderingService.setInlineAuthoringRenderers( propColumns, commandContext.occContext.viewKey );
        newColumnConfig.columns = [ ...propColumns ];
        _dataProvider.columnConfig = newColumnConfig;

        editHandlerSvc.setEditHandler( aceInlineAuthEditService, inlineAuthoringHandlerContext );
        editHandlerSvc.setActiveEditHandlerContext( inlineAuthoringHandlerContext );
        var dataSource = aceInlineAuthoringUtils.createDatasource( { occDataProvider: _dataProvider } );
        aceInlineAuthEditService.setDataSource( dataSource );
        getServerVMO( parentElement, commandContext.occContext, dialogActionForACEContextMenu );
        currentInlineAuthoringContext = { inlineAuthoringContext:{} };
        currentInlineAuthoringContext.inlineAuthoringContext.isInlineAuthoringMode = true;
        currentInlineAuthoringContext.inlineAuthoringContext.isInlineAddChildMode = isChild;
        occmgmtUtils.updateValueOnCtxOrState( null, currentInlineAuthoringContext, commandContext.occContext );
        _dataProvider.setSelectionEnabled( false );

        //Subscribe to referenceProperty.update
        _eventSubDefs.push( eventBus.subscribe( 'referenceProperty.update', function( eventData ) {
            const dbValue = eventData.selectedObjects[0].uid;
            const prop = currentInlineAuthoringContext.addRefPanelContext.vmo.props[currentInlineAuthoringContext.addRefPanelContext.fielddata.propertyName];
            var viewModelCollection = _dataProvider.getViewModelCollection();
            var inlineRowobjectIdx = commandContext.occContext.vmc.findViewModelObjectById( currentInlineAuthoringContext.addRefPanelContext.vmo.uid );
            var inlineRowobject = viewModelCollection.getViewModelObject( inlineRowobjectIdx );
            if ( eventData.selectedObjects[0].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 && !eventData.selectedObjects[0].props.object_name && !eventData.selectedObjects[0].props.object_desc ) {
                const uid = eventData.selectedObjects[0].props.awb0Archetype.dbValues[0];
                dms.getProperties( [ uid ], [ 'object_name', 'object_desc' ] ).then( function() {
                    const modelObject = soa_kernel_clientDataModel.getObject( uid );
                    prop.newDisplayValues = modelObject.props.object_name.uiValues;
                    prop.displayValueUpdated = true;
                    uwPropertyService.setValue( prop, dbValue );
                    aceInlineAuthoringUtils.populateObjectProps( _dataProvider, inlineRowobject, modelObject, callBackObj.occContext );
                } );
            } else {
                prop.newDisplayValues = eventData.selectedObjects[0].props.object_name.uiValues;
                prop.displayValueUpdated = true;
                uwPropertyService.setValue( prop, dbValue );
                aceInlineAuthoringUtils.populateObjectProps( _dataProvider, inlineRowobject, eventData.selectedObjects[0], callBackObj.occContext );
            }
        } ) );
        _eventSubDefs.push( eventBus.subscribe( 'getRefObjectsDataProvider.validSelectionEvent', ( eventData ) => {
            const modelObject = soa_kernel_clientDataModel.getObject( eventData.selectedObjects[0].propInternalValue );
            aceInlineAuthoringUtils.populateObjectProps( _dataProvider, eventData.vmo, modelObject );
        } ) );
        _eventSubDefs.push( eventBus.subscribe( 'getAllowedTypesLOV.validSelectionEvent', ( eventData ) => {
            _usageTypeChangedProp = {
                vmo:eventData.vmo
            };
            const typePropertyOnInlineRow = aceInlineAuthoringUtils.getTypePropertyNameForInlineRow( callBackObj.occContext );
            getViewModelForCreate( callBackObj.parentElement, eventData.vmo.props[typePropertyOnInlineRow].dbValue, callBackObj.occContext );
        } ) );
    } else {
        // Add next row
        getServerVMO( parentElement, commandContext.occContext, dialogActionForACEContextMenu );
    }
};

/**
     * @param {[Object]} targetObjects -target rows to be removed
     *  @param {[Boolean]} removeSingle - Removes single line
     */
export const removeRow = function( targetObjects, removeSingle ) {
    var callCancelEdits = true;

    if( targetObjects &&  targetObjects.length > 0 &&  targetObjects.length !== _inlineRowUids.length ) {
        // do not call cancelEdits, this will be done during post rendering with declarative event chain defintion
        callCancelEdits = false;
    }

    if( _dataProvider.selectionModel ) {
        var editHandler = editHandlerSvc.getEditHandler( inlineAuthoringHandlerContext );
        editHandlerSvc.setActiveEditHandlerContext( inlineAuthoringHandlerContext );
        if( !editHandler ) {
            callCancelEdits = false;
        }

        callBackObj.removeInlineEditableRows( targetObjects, removeSingle );
    }

    if( callCancelEdits ) {
        callBackObj.cancelEdits();
    }
};

/**
     * The function will parse performSearch results in to LOV drop downs.
     * @param {Object} searchResultsResponse - perform search response
     * @returns {Object} lovEntries
    */
export const getTypeDropDownLOV = function() {
    const lovEntries = [];
    const objectTypes = _allowedTypesInfo.objectTypeName.split( ',' );
    if( objectTypes.length > 0 ) {
        _.forEach( objectTypes, function( objType ) {
            const object = cmm.getType( objType );
            const lovEntry = {
                propInternalValue: object.name,
                propDisplayValue: object.displayName
            };
            lovEntries.push( lovEntry );
        } );
    }
    return lovEntries;
};


/**
     * Update the user modified dirty properties on Row to the declarative view model definition being consumed by createInput.
     * @param {*} inlineRowVmoUid Uid of Row/View Mode Object
     *  @param {*} declViewModel   Declarative view model definition
     *  @param {*} inlinePropMapping Column property name to Create Input property mapping
     */
var _updateDirtyPropertiesOnDeclViewModel = function( inlineRowVmoUid, declViewModel, inlinePropMapping ) {
    var inlineRowVmo = getInlineRowByUid( inlineRowVmoUid );
    var rowDirtyProps = inlineRowVmo.getSaveableDirtyProps();
    if( rowDirtyProps && rowDirtyProps.length > 0 ) {
        for( var prop in rowDirtyProps ) {
            if( rowDirtyProps.hasOwnProperty( prop ) ) {
                var modifiedPropName = rowDirtyProps[ prop ].name;
                modifiedPropName = inlinePropMapping[ modifiedPropName ];
                if( modifiedPropName ) {
                    var vmProp = _.get( declViewModel, modifiedPropName );
                    if( vmProp ) {
                        uwPropertyService.setValue( vmProp, rowDirtyProps[ prop ].values );
                    }
                }
            }
        }
    }
};

/**
 * Calls createAndAddElement SOA for non-collaborative structures,
 * where revision is created first and then addObject is invoked.
 * For collaborative structures, revision is already created/set in searchWidget and here we just call addObject with occurrence createInput.
 * @param {Object} creatIn - Create Input for SOA.
 * @param {Object} occContext - occContext atomic data
 * @return {Object} - returns promise.
 */
var createAndAddElement = function( creatIn, occContext ) {
    var deferred = AwPromiseService.instance.defer();

    var createdObjects = [];
    //Check if Revision to add is already set in the searchWidget (in case of RO)
    for( var inx = 0; inx < _inlineRowUids.length; ++inx ) {
        var row = getInlineRowByUid( _inlineRowUids[ inx ] );
        //check awb0Archetype property is populated, if yes, then populate the createdObjects
        if( row.props.awb0Archetype && row.props.awb0Archetype.dbValue !== undefined ) {
            var modelObject = soa_kernel_clientDataModel.getObject( row.props.awb0Archetype.dbValue );
            createdObjects.push( modelObject );
        } else {
            //Reached here means awb0Archetype property is not exposed in treeTable columns.
            //When adding inline row without part under RO line or partition, let addObject SOA return error notify user about required valid part input is missing.
            if( occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature ) {
                let modelObject = {
                    uid: 'AAAAAAAAAAAAAA',
                    type: 'unknownType'
                };
                createdObjects.push( modelObject );
            }
        }
    }

    if( createdObjects.length === 0 ) {
        //BVR case. We need to call createAttachAndSubmitObjects SOA first and then addObject
    } else {
        //For RO ,Part Revision is already created/set via searchWidget. Populate createInput and call addObject.
        var createInputs = [];
        for( var i = 0; i < creatIn.length; ++i ) {
            createInputs.push( creatIn[ i ].createData );
        }
        var soaInput = {
            input: {
                objectsToBeAdded: aceAddElementService.getElementsToAdd( createdObjects, '' ),
                parentElement: {
                    type: callBackObj.parentElement.type,
                    uid: callBackObj.parentElement.uid
                },
                inputCtxt:  {
                    productContext: {
                        type:occContext.productContextInfo.type,
                        uid:occContext.productContextInfo.uid
                    }
                },
                addObjectIntent: '',
                fetchPagedOccurrences: true,
                requestPref:  { displayMode: [ aceAddElementService.getDisplayMode() ] },
                numberOfElements: 1,
                createInputs: createInputs
            }
        };
        return soaSvc.postUnchecked( 'Internal-ActiveWorkspaceBom-2021-06-OccurrenceManagement', 'addObject3', soaInput ).then(
            function( response ) {
                const data = {
                    addElementResponse:response
                };
                let targetObjects = [];
                if( response.ServiceData && response.ServiceData.partialErrors ) {
                    const msg = aceInlineAuthoringUtils.processPartialErrors( response.ServiceData );
                    messagingService.showError( msg );
                    cancelEdits( occContext );
                }

                const sublocation = appCtxService.getCtx( 'sublocation.nameToken' );
                const occurrenceManagementSubLocation = 'com.siemens.splm.client.occmgmt:OccurrenceManagementSubLocation';
                if( aceAddElementService.getTotalNumberOfChildrenAdded( response ) > 0 && sublocation && sublocation ===  occurrenceManagementSubLocation ) {
                    targetObjects = getNewlyAddedChildElements( data );
                    removeRow( targetObjects );
                    addElementPostProcessing( data, targetObjects, occContext );
                } else{
                    //Reached here means:
                    //out of ACE sublocation inline mode as we are in async soa call response handling.
                    //directly using newElements as aceActiveContext might not be available. resetting rowCounter in removeRow.
                    removeRow( response.selectedNewElementInfo.newElements );
                }

                return deferred.promise;
            },
            function( addObjectError ) {
                cancelEdits( occContext );
                deferred.reject( addObjectError );
                return deferred.promise;
            } );
    }
};


const addElementPostProcessing = function( data, newlyAddedElements, occContext ) {
    //fire ACE events
    const eventData = {
        addElementInput:{
            parent:callBackObj.parentElement
        },
        objectsToSelect: newlyAddedElements,
        addElementResponse: data.addElementResponse,
        viewToReact: occContext.viewKey
    };
    eventBus.publish( 'addElement.elementsAdded', eventData );
    const eventDataElementsSelectionUpdated = {
        objectsToSelect: newlyAddedElements,
        viewToReact: occContext.viewKey
    };
    eventBus.publish( 'aceElementsSelectionUpdatedEvent', eventDataElementsSelectionUpdated );
};

/**
     * Populates properties from columnPropToCreateInPropMap
     * @param {Object} declViewModel - declarative view model
     */
var _populatePropsOndeclViewModel = function( declViewModel ) {
    var orgJsonData = declViewModel.origDeclViewModelJson;
    var columnPropToCreateInPropMap = orgJsonData.columnPropToCreateInPropMap;
    var xrtViewElementProperties = Object.values( columnPropToCreateInPropMap );
    if( declViewModel.type === 'CREATE' ) {
        declViewModel.objCreateInfo = {
            createType: orgJsonData.data.createType,
            propNamesForCreate: xrtViewElementProperties
        };
    }

    _.forEach( xrtViewElementProperties, function( xrtViewElementProp ) {
        var propNameToMatch = xrtViewElementProp;
        if( xrtViewElementProp.includes( '__' ) > 0 ) { // compound prop
            var temp = xrtViewElementProp.split( '__' );
            propNameToMatch = temp[ 1 ];
        }
        if( orgJsonData && orgJsonData.data[ propNameToMatch ] ) {
            var rhs = orgJsonData.data[ propNameToMatch ];
            if( declViewModel[ xrtViewElementProp ] ) {
                Object.keys( rhs ).forEach( function( key ) {
                    declViewModel[ xrtViewElementProp ][ key ] = _.cloneDeep( rhs[ key ] );
                } );
            }
        }
    } );
};

/**
     * Calls createAndAddElement and addOject SOA.
     * @returns {Promise} A promise that calls
     *                      {@link deferred~resolve} if Object Create is initiated successfully,
     *                       {@link deferred~reject} otherwise.
     * @param {Object} occContextObject - occContext atomic data
     */
export const saveRow = function( occContextObject ) {
    const occContext = occContextObject === undefined ? callBackObj.occContext : occContextObject;
    const deferred = AwPromiseService.instance.defer();
    const operationName = 'CREATE';
    const type = 'CREATE';
    const createData = {
        createInObjs: []
    };
    let typePropertyOnInlineRow;
    for( const idx in _jsonInlineRowsSvrResp ) {
        const inlineServerResponse = _jsonInlineRowsSvrResp[ idx ];
        const jsonDataDUI = JSON.parse( inlineServerResponse.viewModelCreateInObjsJsonStrings[ 0 ] );
        jsonDataDUI.columnPropToCreateInPropMap = inlineServerResponse.columnPropToCreateInPropMap;
        jsonDataDUI.createHtmlProviders = inlineServerResponse.createHtmlProviders;
        jsonDataDUI._viewModelId = `${operationName}:${type}`;
        const svrRespJsObj = jsonDataDUI.objects[ 0 ];
        svrRespJsObj.uid = svrRespJsObj.creinfo.uid;
        jsonDataDUI.data = {};
        jsonDataDUI.data.customPanelInfo = {};
        if( !typePropertyOnInlineRow ) {
            typePropertyOnInlineRow = aceInlineAuthoringUtils.getTypePropertyNameForInlineRow( occContext );
        }

        if( svrRespJsObj.props[typePropertyOnInlineRow] && svrRespJsObj.props[typePropertyOnInlineRow].dbValues ) {
            typePropertyOnInlineRow = svrRespJsObj.props[typePropertyOnInlineRow].dbValues[ 0 ];
        } else {
            typePropertyOnInlineRow = _allowedTypesInfo.preferredType;
        }
        jsonDataDUI.data.operationName = operationName;
        jsonDataDUI.data.type = type;
        jsonDataDUI.data.createType = typePropertyOnInlineRow;
        jsonDataDUI.data.uid = svrRespJsObj.creinfo.uid;
        jsonDataDUI.skipClone = false;
        const vmo = viewModelObjectSvc.createViewModelObject( jsonDataDUI.data.uid, 'CREATE', null, null );

        // populate compound properties
        // fasadtocreateInmap contains properties in following format
        // awb0ArchetypeRevId: "wso_thread:fnd0ThreadId",
        // It needs compound property in following format on declarative view model.
        // name: ‘wsoThread__fnd0ThreadId’:
        // {
        // dbValue: ‘wsoThread:fnd0ThreadId’
        // }
        // ‘awb0ArcheType:’ wsothread:fnd0Child’
        _.forEach( Object.keys( jsonDataDUI.columnPropToCreateInPropMap ), function( key ) {
            const value = jsonDataDUI.columnPropToCreateInPropMap[ key ];
            if( value.includes( ':' ) > 0 && value.split( ':' ).length === 2 ) {
                const replacedValue = value.replace( /:/g, '__' );
                jsonDataDUI.columnPropToCreateInPropMap[ key ] = replacedValue;
                jsonDataDUI.data[ replacedValue ] = {
                    dbValue: value
                };
            }
        } );


        const declViewModel = {
            origDeclViewModelJson:jsonDataDUI,
            uid:jsonDataDUI.data.uid,
            type:jsonDataDUI.data.type
        };

        // populate properties on declarative view model except compund properties
        _.forEach( vmo.props, function( n, key ) {
            if( !key.includes( '__' ) ) {
                declViewModel[ key ] = n;
            }
        } );

        // Create compound property
        _.forEach( Object.keys( jsonDataDUI.data ), function( key ) {
            const propName = key;
            const propAttrHolder = jsonDataDUI.data[ key ];
            let vmProp = null;
            const compoundObjectMap = {};
            const compoundViewModelObjectMap = {};
            if( key.includes( '__' ) > 0 && key.split( '__' ).length === 2 && propAttrHolder.dbValue.indexOf( ':' ) > 0 ) {
                const compoundProps = propAttrHolder.dbValue.split( ':' );
                let objectRefProp = _.get( declViewModel, compoundProps[ 0 ] );
                let modelObject = null;
                let childFullPropertyName = '';
                let i = 0;

                for( ; i < compoundProps.length - 1; i++ ) {
                    if( i === 0 ) {
                        modelObject = soa_kernel_clientDataModel.getObject( objectRefProp.dbValues[ 0 ] );
                    } else if( modelObject ) {
                        childFullPropertyName += '__';
                        objectRefProp = _.get( modelObject.props, compoundProps[ i ] );
                        modelObject = soa_kernel_clientDataModel.getObject( objectRefProp.dbValues[ 0 ] );
                    }
                    childFullPropertyName += compoundProps[ i ];

                    if( !compoundObjectMap.hasOwnProperty( childFullPropertyName ) ) {
                        _.set( compoundObjectMap, childFullPropertyName, modelObject );
                    }
                }

                let compoundViewModelObject = _.get( compoundViewModelObjectMap, childFullPropertyName );

                if( !compoundViewModelObject && modelObject ) {
                    compoundViewModelObject = viewModelObjectSvc.createViewModelObject( modelObject.uid,
                        jsonDataDUI.data.operationName );
                    _.set( compoundViewModelObjectMap, childFullPropertyName, compoundViewModelObject );
                }

                if( compoundViewModelObject ) {
                    vmProp = _.get( compoundViewModelObject.props, compoundProps[ i ] );
                    if( !vmProp ) {
                        // skip this view model property when the compound property doesn't exist in referenced object
                        return;
                    }

                    _.set( vmProp, 'intermediateCompoundObjects', compoundObjectMap );
                }

                declViewModel[ propName ] = vmProp;
            }
        } );

        _populatePropsOndeclViewModel( declViewModel );
        // Update user edited propertis on to dataSource going to CreateInput
        _updateDirtyPropertiesOnDeclViewModel( declViewModel.uid, declViewModel, jsonDataDUI.columnPropToCreateInPropMap );

        createData.createInObjs = createData.createInObjs.concat( aceInlineAuthoringUtils.getCreateInput( declViewModel, aceInlineAuthEditService.getDataSource() ) );
        if( createData.createInObjs.length === _inlineRowUids.length ) {
            const createInput = {
                createIns:createData.createInObjs,
                occContext: occContext
            };
            deferred.resolve( createInput );
        }
    } // end for loop createin objects

    const deferredCreate = AwPromiseService.instance.defer();
    return deferred.promise.then( function( createInput ) {
        if( createInput.createIns.length > 0 ) {
            createAndAddElement( createInput.createIns, createInput.occContext ).then( function( res ) {
                deferredCreate.resolve( res );
            } ).catch( function( error ) {
                deferredCreate.reject( error );
            } );
        }
    } );
};

/**
     * Adds empty row in table
     * @param {Object} data - data instance
     * @returns {Object} returns newly added element
     */
export const getNewlyAddedChildElements = function( data ) {
    return aceAddElementService.getAddElementResponse( data.addElementResponse ).newlyAddedChildElements;
};

/**
     * Sets Add Ref Panel Context
     * @param {String} commandContext - command context
     */
export const setAddPanelContext = function( commandContext ) {
    currentInlineAuthoringContext.addRefPanelContext = { ...commandContext };
};

const exports = {
    addRow,
    removeRow,
    getTypeDropDownLOV,
    saveRow,
    getNewlyAddedChildElements,
    setAddPanelContext
};

export default exports;
