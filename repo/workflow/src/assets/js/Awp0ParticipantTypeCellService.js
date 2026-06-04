import AwPic from 'viewmodel/AwPicViewModel';
import awIconSvc from 'js/awIconService';

//This component is AW specific, can this be moved to AW
export const awp0ParticipantTypeCellRenderFn = ( props ) => {
    let { item, vmo } = props;

    if( !item ) { item = vmo; }

    if( !item ) { return; }
    let typeIcon = '';
    if( item.props.fnd0IsMultiValued.dbValue ) {
        typeIcon = awIconSvc.getTypeIconURL('People');
    } 
    else {
        typeIcon = awIconSvc.getTypeIconURL('Person');
    }
    const value = item.props && item.props.fnd0ParticipantType && item.props.fnd0ParticipantType.uiValues[0];
    return (
        <div className='aw-tcWidgets-modelTypeCell'>
            <AwPic className='sw-pic-thumbnail' source={typeIcon} alt={value} />
            <div title={value} className='aw-tcWidgets-modelTypeCellTitle'>{value}</div>
        </div>
    );
};
