// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

import AwIconButton from 'viewmodel/AwIconButtonViewModel';
import AwInclude from 'viewmodel/AwIncludeViewModel';
import AwModelThumbnail from 'viewmodel/AwModelThumbnailViewModel';
import AwPanel from 'viewmodel/AwPanelViewModel';

import _ from 'lodash';
import actionService from 'js/actionService';
import adapterSvc from 'js/adapterService';
import cdm from 'soa/kernel/clientDataModel';

/**
 * Gets the selection object for getViewerData call from subpanelcontext
 * @param {Object} subPanelContext the subpanelContext
 * @returns {Object} the selection object
 */
export const getSelectionFromContext = function( subPanelContext ) {
    const swaSelectData = subPanelContext.selectionData?.value?.selected;
    let selected;
    if( !( swaSelectData && swaSelectData.length > 0 ) ) {
        // No SWA selection, go by XRT State VMO.
        // however xrt state vmo does not have normal view model properties so we need to get the original vmo.
        const uid = subPanelContext.xrtState?.xrtVMO?.uid;
        selected = cdm.getObject( uid );
    } else {
        // SWA selection
        selected = swaSelectData[ 0 ];
        // temporary work around to adapt object at UV layer, which will be removed once Nihar's change is reworked and goes in.
        if( selected.type === 'Awp0XRTObjectSetRow' ) {
            selected = adapterSvc.getAdaptedObjectsSync( [ selected ] )[ 0 ];
        }
    }
    return selected;
};

/**
 * Gets the named reference data based on if viewer should use multiple named references
 * @param {Boolean} useMultNamedRefs should multiple named references be used
 * @param {Object} fileData The current named reference file
 * @returns {Object|String} the file data if using multiple named references, else empty string
 */
export const getNamedReferenceData = function( useMultNamedRefs, fileData ) {
    if( useMultNamedRefs ) {
        return fileData;
    }
    return '';
};

const getViewerDataDebounced = _.debounce( function( viewModelData ) {
    const evaluationCtx = {
        data: viewModelData
    };
    // Get the action
    const action = viewModelData.getAction( 'getViewerData' );
    actionService.executeAction(
        viewModelData,
        action,
        evaluationCtx,
        null
    );
}, 200, { trailing: true } );

/**
 * Debounces getViewerData action calls
 * @param {number} viewModelData the view model data
 */
export const debounceGetViewerDataAction = function( viewModelData ) {
    getViewerDataDebounced( viewModelData );
};

const uvOnMouseEnter = function( uvRef, chevronsVisible ) {
    if( chevronsVisible ) {
        uvRef.current.classList.add( 'aw-viewerjs-hover' );
    }
};

const uvOnMouseLeave = function( uvRef, chevronsVisible ) {
    if( chevronsVisible ) {
        uvRef.current.classList.remove( 'aw-viewerjs-hover' );
    }
};

/**
 * Render function for universal viewer
 * @param {*} param0 -
 * @returns {JSX.Element} Viewer element
 */
export const awUniversalViewerRenderFn = function( { viewModel, subPanelContext, fields, elementRefList, enableMultipleFilesPerDataset } ) {
    // Build the viewer in pieces to account for exist-whens
    // Get the uv ref
    const uvRef = elementRefList.get( 'uvRef' );
    const viewerData = {
        ...viewModel.viewerData,
        instanceId: viewModel._internal?.modelId,
        fileVM: viewModel.fileVM ? fields.fileVM : null,
        datasetVM: viewModel.datasetVM ? fields.datasetVM : null,
        headerPropertyNames: viewModel.headerPropertyNames,
        viewerRef: uvRef,
        viewerSizeStateRef: viewModel.atomicDataRef.viewerSizeState,
        parentRef: subPanelContext.parentRef,
        fullScreenState: subPanelContext.fullScreenState,
        viewerDialogAction: subPanelContext.viewerDialogAction,
        useParentDimensions: subPanelContext.useParentDimensions,
        context: subPanelContext.context
    };
    const fileData = viewerData && viewerData.fileData;
    const viewerName = fileData && fileData.viewer || '';
    const fmsTicket = fileData && fileData.fmsTicket;
    const isPreview = viewerName === 'Awp0Preview';
    const hasViewer = viewerName && !isPreview;
    const namedRefsAvailable = viewerData.hasMoreNamedReferences && enableMultipleFilesPerDataset;
    const chevronsVisible = hasViewer && ( viewerData.hasMoreDatasets || namedRefsAvailable );

    let viewerElem;
    const atomicViewerData = viewModel.atomicData && viewModel.atomicData.viewerSizeState;

    if( hasViewer ||  atomicViewerData && Object.keys( atomicViewerData ).length > 0 && !isPreview  ) {
        const leftChevron = <div className='aw-viewerjs-controlArrowContainer aw-viewerjs-controlArrowContainerLeft'>
            <AwIconButton id='Awp0LeftChevron' className='aw-viewerjs-controlArrow aw-viewerjs-leftArrow' command={fields.onPreviousChevronClick}></AwIconButton>
        </div>;
        const rightChevron = <div className='aw-viewerjs-controlArrowContainer aw-viewerjs-controlArrowContainerRight'>
            <AwIconButton id='Awp0RightChevron' className='aw-viewerjs-controlArrow aw-viewerjs-rightArrow' command={fields.onNextChevronClick}></AwIconButton>
        </div>;

        if( atomicViewerData && atomicViewerData.viewerHeight && uvRef.current?.style ) {
            uvRef.current.style.height = atomicViewerData.viewerHeight;
        }

        viewerElem =
            <div className='aw-layout-flexRow aw-viewerjs-elementPosition aw-viewer-base' ref={uvRef} onMouseEnter={()=>uvOnMouseEnter( uvRef, chevronsVisible )} onMouseLeave={()=>uvOnMouseLeave( uvRef, chevronsVisible )}>
                { chevronsVisible ? leftChevron : '' }
                <div className='aw-viewerjs-dimensions aw-viewerjs-container'>
                    { hasViewer ? <AwInclude name={viewerName} subPanelContext={viewerData}></AwInclude> : '' }
                </div>
                { chevronsVisible ? rightChevron : '' }
            </div>;
    }

    let thumbnailElem = '';
    if( fmsTicket === '' || isPreview ) {
        const vmo = getSelectionFromContext( subPanelContext );
        thumbnailElem = <AwModelThumbnail vmo={vmo} ></AwModelThumbnail>;
    }

    return (
        <AwPanel className='aw-viewer-gallery sw-row'>
            { viewerElem || thumbnailElem }
        </AwPanel>
    );
};

export default {
    getSelectionFromContext,
    getNamedReferenceData,
    debounceGetViewerDataAction,
    awUniversalViewerRenderFn
};
