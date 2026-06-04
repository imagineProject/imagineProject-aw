/* eslint-disable valid-typeof */
import AwCheckbox from 'viewmodel/AwCheckboxViewModel';

export const awModelViewCheckboxRenderFunction = ( props ) => {
    return <div className='pmiTool-pmiTree'>
        {typeof props.node.modelViewId !== undefined && props.node.modelViewId >= 0 ? <AwCheckbox {...props.node.checkbox} action={props.actions.modelViewEntryCheckedAction}></AwCheckbox> :
            <AwCheckbox {...props.node.checkbox} action={props.actions.typesEntryCheckedAction}></AwCheckbox>}
        {props.node.label}
    </div>;
};
