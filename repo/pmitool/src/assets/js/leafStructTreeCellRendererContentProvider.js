// Copyright (c) 2025 Siemens

/**
 * @module js/leafStructTreeCellRendererContentProvider
 */

export let leafStructColNameRendererFn = function( vmo, containerElem ) {
    var cellImg = document.createElement( 'img' );
    cellImg.src = vmo.leafNodeVisibilityIconURL;
    cellImg.alt = vmo.leafNodeVisibilityIconURL;
    cellImg.className = 'aw-base-icon aw-type-icon aw-splm-tableIcon';
    cellImg.target = '_blank';
    cellImg.style.cursor = 'pointer';
    cellImg.onclick = e => {
        if( e ) {
            e.stopPropagation();
        }
        vmo.leafHandler.toggleLeafNodeVisibility( vmo );
    };
    containerElem.appendChild( cellImg );
    if( vmo.isDisabled ) {
        containerElem?.parentElement?.parentElement?.classList.add( 'disabled' );
    }else{
        containerElem?.parentElement?.parentElement?.classList.remove( 'disabled' );
    }
};


export default {
    leafStructColNameRendererFn
};
