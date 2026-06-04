import AwLovEdit from 'viewmodel/AwLovEditViewModel';
/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awNamingRuleLovRenderFn = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.namingRuleLovProvider;

    const passedProps = { ...prop,  fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

export const getNamingRuleValues = ( vmo, name ) => {
    const lovEntries = [];
    if( name === 'item_id_naming_rule' && vmo.props.item_id_naming_rules ) {
        for( const namingRule of vmo.props.item_id_naming_rules.dbValue ) {
            lovEntries.push( { lovType: 'STRING', propInternalValue: namingRule, propDisplayValue: namingRule, propHasValidValues: true, propDisplayDescription: '' } );
        }
    } else if ( name === 'item_revision_id_naming_rule' && vmo.props.item_revision_id_naming_rules ) {
        for( const namingRule of vmo.props.item_revision_id_naming_rules.dbValue ) {
            lovEntries.push( { lovType: 'STRING', propInternalValue: namingRule, propDisplayValue: namingRule, propHasValidValues: true, propDisplayDescription: '' } );
        }
    }
    return {
        lovValues: lovEntries,
        nLovValues: lovEntries.length
    };
};
