// Copyright (c) 2022 Siemens

/**
 * @module js/cbaXRTCellRenderer
 */
import CadBomAlignmentCheckCellRenderer from 'js/CadBomAlignmentCheckCellRenderer';
import CadBomOccurrenceAlignmentUtil from 'js/CadBomOccurrenceAlignmentUtil';
import adapterSvc from 'js/adapterService';
import eventBus from 'js/eventBus';
import _ from 'lodash';

const columnToIconMap = {
    fnd0IsPrimary: 'indicatorPrimaryDesign16.svg',
    fnd0IsAlignmentCurrent: 'indicatorMismatch16.svg'
};

let _eventSubDefs = [];

/**
 * Handle post revise action processing
 * @param { object } eventData event data
 */
let _handleRevise = function( eventData ) {
    if( !CadBomOccurrenceAlignmentUtil.isCBAView() ) {
        let dataProviderName = eventData?.scope?.subPanelContext?.provider?.dataProviderName;
        if( dataProviderName ) {
            let topic = 'vmc.modified.' + dataProviderName;
            _.forEach( _eventSubDefs, function( subDef ) {
                if( subDef.topic !== topic ) {
                    _eventSubDefs.push( eventBus.subscribe( topic, _handleVMCModified ) );
                }
            } );
        }
    }
};

/**
 * Handle vmc modified event after revise action
 * @param { object } eventData event data
 */
let _handleVMCModified = function( eventData ) {
    if ( eventData?.modifiedObjects?.length > 0 ) {
        let modifiedObject = eventData.modifiedObjects[0];
        if( modifiedObject ) {
            let eventDataParams = {
                refreshLocationFlag: true,
                relations: '',
                relatedModified:[ modifiedObject ]
            };
            eventBus.publish( 'cdm.relatedModified', eventDataParams );

            _.forEach( _eventSubDefs, function( subDef ) {
                if( subDef.topic !== 'Awp0ShowSaveAs.saveAsComplete' ) {
                    eventBus.unsubscribe( subDef );
                }
            } );
        }
    }
};

// Handle Revise event
_eventSubDefs.push( eventBus.subscribe( 'Awp0ShowSaveAs.saveAsComplete', _handleRevise ) );

/**
 * Get XRT indicator renderer
 * @param {object} vmo View Model Object
 * @param {object} containerElement container element
 * @param {string} columnName column name
 * @param {array} tooltip tooltip
 */
export const getCbaXRTIndicationRenderer = function( vmo, containerElement, columnName, tooltip ) {
    let value = vmo.props[ columnName ].dbValue;
    let tooltipViewName = tooltip && tooltip.length > 0 ? tooltip[ 0 ] : null;


    if( columnName === 'fnd0IsPrimary' && value || columnName === 'fnd0IsAlignmentCurrent' && !value ) {
        let icon = columnToIconMap[ columnName ];
        if( icon ) {
            let iconSource = CadBomOccurrenceAlignmentUtil.getIconSourcePath( icon );
            let adaptedVmo = adapterSvc.getAdaptedObjectsSync( [ vmo ] );
            let objectType = adaptedVmo.length > 0 && adaptedVmo[ 0 ] ? adaptedVmo[ 0 ].type : vmo.type;

            let contextObject = {
                vmo: vmo,
                columnName: columnName,
                objectType: objectType
            };

            let iconElement = CadBomAlignmentCheckCellRenderer.getIconCellElement( contextObject, iconSource, containerElement, columnName, tooltipViewName, null, null, objectType );
            if( iconElement !== null ) {
                containerElement.appendChild( iconElement );
            }
        }
    }
};

const exports = {
    getCbaXRTIndicationRenderer
};

export default exports;
