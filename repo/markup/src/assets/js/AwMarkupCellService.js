// Copyright (c) 2021 Siemens
/*eslint-disable jsx-a11y/click-events-have-key-events*/
/*eslint-disable jsx-a11y/no-static-element-interactions*/

import { convertToHtml } from 'js/reactHelper';
import eventBus from 'js/eventBus';
import AwAvatar from 'viewmodel/AwAvatarViewModel';

export const awMarkupCellRenderFunction = ( props ) => {
    if( props.vmo.groupName ) {
        const { data, dispatch } = props.viewModel;
        const rotate = data.expanded ? '' : 'rotate(-90, 6, 6)';
        const toggleGroup = () => {
            dispatch( { path: 'data.expanded', value: !data.expanded } );
            eventBus.publish( 'awp0Markup.toggleGroup', {
                name: props.vmo.groupName
            } );
        };

        return (
            <div className='sw-row sw-sectionTitle aw-markup-groupCellTitle aw-layout-panelSectionTitle collapsible'
                onClick={toggleGroup}>
                <svg width='16' height='12'>
                    <polygon className='aw-theme-iconOutline' fill='#464646' points='2,4 6,10 10,4' transform={rotate}>
                    </polygon>
                </svg>
                <span className='aw-ui-filterCategoryLabel aw-ui-filterCategoryLabelEnabled'>{props.vmo.groupInfo}</span>
            </div>
        );
    }
    const indentStyle = 'aw-widgets-cellListCellImage' +
                            ( props.vmo.isIndented ? ' aw-markup-cellIndentation' : '' );

    const comment = <div className='aw-markup-cellRichContent'>{convertToHtml( props.vmo.comment )}</div>;
    const source = props.vmo.userObj && props.vmo.userObj.thumbnailURL;

    return (
        <div className='aw-markup-cell sw-row'>
            <div className={indentStyle} title={props.vmo.shareInfo}>
                <AwAvatar size='small' source={source} initials={props.vmo.username}></AwAvatar>
            </div>

            <div className='sw-column'>
                <div className='aw-widgets-cellListCellTitleBlock'>
                    <h3 className='aw-widgets-cellListCellTitle'>{props.vmo.displayname}</h3>
                    <label className='aw-widgets-cellListCellItemType aw-base-small'>{props.vmo.statusInfo}</label>
                </div>
                <div className='aw-widgets-cellListCellProperties'>
                    <label className='aw-widgets-propertyValue aw-base-small'>{props.vmo.dateInfo}</label>
                </div>
                {comment}
            </div>
        </div>
    );
};
