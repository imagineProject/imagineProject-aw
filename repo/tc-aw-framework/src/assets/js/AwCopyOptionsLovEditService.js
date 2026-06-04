import AwLovEdit from 'viewmodel/AwLovEditViewModel';
/**
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awCopyOptionsLovEditRenderFunction = ( props ) => {
    const {  viewModel, ...prop } = props;

    let fielddata = { ...prop.fielddata };
    fielddata.hasLov = true;
    fielddata.dataProvider = viewModel.dataProviders.copyOptionsLOVProvider;

    const passedProps = { ...prop,  fielddata };

    return (
        <AwLovEdit {...passedProps} ></AwLovEdit>
    );
};

export let getCopyOptionsLOVValues = function( vmo, i18n ) {
    const lovEntries = [];
    lovEntries.push( { lovType: 'STRING', propInternalValue: 'NoCopy', propDisplayValue: i18n.noCopy, propHasValidValues: true, propDisplayDescription: '' } );
    lovEntries.push( { lovType: 'STRING', propInternalValue: 'CopyAsObject', propDisplayValue: i18n.saveas, propHasValidValues: true, propDisplayDescription: '' } );
    lovEntries.push( { lovType: 'STRING', propInternalValue: 'CopyAsReference', propDisplayValue: i18n.copyAsReference, propHasValidValues: true, propDisplayDescription: '' } );

    if( vmo?.props?.xrt_type?.dbValue === 'REVISE' ) {
        lovEntries.push( { lovType: 'STRING', propInternalValue: 'ReviseObject', propDisplayValue: i18n.revise, propHasValidValues: true, propDisplayDescription: '' } );
        // lovEntries.push( { lovType: 'STRING', propInternalValue: 'ReviseAndRelateToLatest', propDisplayValue: i18n.revise, propHasValidValues: true, propDisplayDescription: '' } );
        lovEntries.push( { lovType: 'STRING', propInternalValue: 'RelateToLatest', propDisplayValue: i18n.relateToLatestRevision, propHasValidValues: true, propDisplayDescription: '' } );
    }

    return {
        lovValues: lovEntries,
        nLovValues: lovEntries.length
    };
};
