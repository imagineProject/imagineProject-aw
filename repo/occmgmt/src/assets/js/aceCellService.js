// Copyright (c) 2021 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/
// @internal
import AwModelIcon from 'viewmodel/AwModelIconViewModel';
import AwDefaultCellContent from 'viewmodel/AwDefaultCellContentViewModel';
import cdmSvc from 'soa/kernel/clientDataModel';
import occmgmtVisibilitySvc from 'js/aceVisibilityService';
import appCtxService from 'js/appCtxService';

var exports = {};

export let updateCellVisibilityState = function( data ) {
    let cellVisibility = occmgmtVisibilitySvc.getOccVisibility( cdmSvc.getObject( data.item.uid ) );
    return {
        cellVisibility: cellVisibility
    };
};

export const awOccmgmtCellRenderFunction = ( props ) => {
    let { item, vmo, viewModel } = props; //Assume item is ViewModelObject (VMO)

    if( !item ) { item = vmo; }

    if( !item ) { return; }

    if( !item ) { item = vmo; }
    const { data } = viewModel;
    let currentContext = appCtxService.getCtx( appCtxService.ctx.aceActiveContext.key );
    let visibilityControlsEnabled = currentContext.visibilityControls;
    let showHideTitle =  data.showHideTitle;

    data.item = item;

    const toggleCellVisibility = function( data, viewModel ) {
        let cellVisibility = !data.cellVisibility;
        occmgmtVisibilitySvc.toggleOccVisibility( cdmSvc.getObject( item.uid ) );

        viewModel.dispatch( { path:'data.cellVisibility', value:cellVisibility } );
    };

    if ( visibilityControlsEnabled ) {
        data.cellVisibility = occmgmtVisibilitySvc.getOccVisibility( cdmSvc.getObject( item.uid ), appCtxService.ctx.aceActiveContext.key );
        if ( data.cellVisibility ) {
            return (
                // FIXME for 'sw-cell-image-aw-occmgmt-callImageTooltip' visible non interactive elements with click
                // handler must have at least one keyboard listener, Static HTML elements with event handlers require a role
                <div className='aw-default-cell sw-row'>
                    <div className='sw-cell-image aw-occmgmt-cellImageTooltip' onClick={( event ) => toggleCellVisibility( data, viewModel )}>
                        <div title={showHideTitle}>
                            <AwModelIcon vmo={item}></AwModelIcon>
                        </div>
                    </div>
                    <div className='aw-widgets-cellListCellContent'>
                        <AwDefaultCellContent vmo={item}></AwDefaultCellContent>
                    </div>
                </div>
            );
        }

        return (
            // FIXME for 'sw-cell-image-aw-occmgmt-callImageTooltip' visible non interactive elements with click
            // handler must have at least one keyboard listener, Static HTML elements with event handlers require a role
            <div className='aw-default-cell sw-row'>
                <div className='sw-cell-image aw-occmgmt-cellImageTooltip' onClick={( event ) => toggleCellVisibility( data, viewModel )}>
                    <div title={showHideTitle}>
                        <div className='aw-tcWidgets-partialOpacity'>
                            <AwModelIcon vmo={item}></AwModelIcon>
                        </div>
                    </div>
                </div>
                <div className='aw-widgets-cellListCellContent'>
                    <AwDefaultCellContent vmo={item}></AwDefaultCellContent>
                </div>
            </div>
        );
    }
    return (
        <div className='aw-default-cell sw-row'>
            <div className='sw-cell-image'>
                <AwModelIcon vmo={item}></AwModelIcon>
            </div>
            <div className='aw-widgets-cellListCellContent'>
                <AwDefaultCellContent vmo={item}></AwDefaultCellContent>
            </div>
        </div>
    );
};

export default exports = {
    updateCellVisibilityState,
    awOccmgmtCellRenderFunction };
