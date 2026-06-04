import vmoService from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';

export const initialize = ( command )=>{
    const uid = command.handler?.action?.inputData?.uid;

    let vmo = {};
    if( cdm.getObject( uid ) ) {
        vmo = uid ? vmoService.createViewModelObject( uid ) : undefined;
    } else {
        vmo.typeIconURL = command.thumbnailURL || command.icon;
        vmo.cellHeader1 = command.title;
    }

    // Handle case where objects are not loaded like user move to new location where cdm is cleaned.
    if( vmo && !vmo.cellHeader1 ) {
        vmo.cellHeader1 = command.title;
    }
    return vmo;
};
