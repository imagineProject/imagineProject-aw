// @<COPYRIGHT>@
// ==================================================
// Copyright 2024.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 define
 */

/**
 * @module js/partitionUnassignedHeaderService
 * @internal
 */
import partitionUnassignedService from 'js/partitionUnassignedService';

var exports = {};
let isHandlerRegistered = false;
export const partitionUnassignedHeaderRenderFunction = ( props ) => {
    if( !isHandlerRegistered ) {
        partitionUnassignedService.registerHandlerForOverriddenHeader();
        isHandlerRegistered = true;
    }

    return (
        <div className='sw-column awHeader'>
            <div className='sw-row aw-layout-locationTitle aw-partition-locationTitle'>
                {props.i18n.unassignViewTitle}
            </div>
        </div>
    );
};

export default exports = {
    partitionUnassignedHeaderRenderFunction
};
