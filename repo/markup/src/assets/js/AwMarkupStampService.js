// Copyright (c) 2022 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

import { convertToHtml } from 'js/reactHelper';
import eventBus from 'js/eventBus';
import markupModel from 'js/MarkupModel';
import markupOperation from 'js/MarkupOperation';

export const awMarkupStampRenderFunction = ( props ) => {
    if( props.vmo.groupName ) {
        const { data, dispatch } = props.viewModel;
        const rotate = data.expanded ? '' : 'rotate(-90, 6, 6)';
        const toggleGroup = () => {
            dispatch( { path: 'data.expanded', value: !data.expanded } );
            eventBus.publish( 'awp0Markup.toggleStampGroup', {
                name: props.vmo.groupName
            } );
        };

        return (
            <div className='sw-row sw-sectionTitle flex-shrink aw-layout-collapsiblePanelSectionTitle collapsible'
                onClick={toggleGroup}>
                <svg width='16' height='12'>
                    <polygon className='aw-theme-iconOutline' fill='#464646' points='2,4 6,10 10,4' transform={rotate}>
                    </polygon>
                </svg>
                <span className='aw-ui-filterCategoryLabel aw-ui-filterCategoryLabelEnabled'>{props.vmo.groupInfo}</span>
            </div>
        );
    }
    const handleDrag = ( ev ) => {
        const h3 = ev.target.parentElement.getElementsByTagName( 'h3' )[0];
        const svg = ev.target.getElementsByTagName( 'svg' )[0];
        const table = ev.target.getElementsByTagName( 'table' )[0];

        if( h3 && ( svg || table ) ) {
            if( svg ) {
                ev.dataTransfer.setDragImage( svg, svg.clientWidth / 2, svg.clientHeight / 2 );
            } else if( table ) {
                ev.dataTransfer.setDragImage( table, 0, 0 );
            }

            ev.dataTransfer.effectAllowed = 'move';
            markupOperation.setPositionMarkup( markupModel.findStamp( h3.innerText ) );
        }
    };

    const info = props.vmo.displayname + '\n' + props.vmo.date.toLocaleString();

    return (
        <div className='aw-markup-cell sw-column'>
            <div className='aw-widgets-cellListCellTitleBlock' title={info}>
                <h3 className='aw-widgets-cellListCellTitle'>{props.vmo.stampName}</h3>
            </div>
            <div className='aw-widgets-cellListCellProperties' draggable='true' onDragStart={handleDrag}>
                {convertToHtml( markupModel.getStampHtml( props.vmo ) )}
            </div>
        </div>
    );
};
