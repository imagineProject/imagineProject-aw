var exports = {};
const getObjectString = ( vmo ) => {
    if( vmo && vmo.props && vmo.props.object_string ) {
        return vmo.props.object_string.dbValue;
    }
    return '';
};


/**
 * @internal
*/

export const awOccmgmtRevruleCellContentRenderFunction = ( props ) => {
    const { vmo, dataprovider } = props;

    // if marker is set, return the separator
    if ( vmo.marker >= 0 ) {
        return (
            <div className='aw-occmgmtjs-separator aw-theme-xrtLabel'></div>
        );
    }

    // else if rule_date is needed, include it
    if ( dataprovider.isRuleDateVisible && vmo.props.rule_date ) {
        return (
            <div className='sw-column'>
                <div className='aw-default-cell sw-row'>{getObjectString( vmo )}</div>
                <label className='aw-occmgmt-ruleDateDropDown aw-widgets-cellListCellItemType'>{vmo.props.rule_date.uiValue}</label>
            </div>
        );
    }

    // default case
    return (
        <div className='aw-default-cell sw-row'>{getObjectString( vmo )}</div>
    );
};

export default exports = {
    awOccmgmtRevruleCellContentRenderFunction
};
