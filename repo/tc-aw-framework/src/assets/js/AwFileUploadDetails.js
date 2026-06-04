// Copyright (c) 2020 Siemens
import _ from 'lodash';
import AwProgressBar from 'viewmodel/AwProgressBarViewModel';

export const awFileUploadDetailsFunction = ( props ) => {
    if( !props.files || !props.files.length ) {
        return <></>;
    }

    return (
        <div className='sw-column'>
            { props.files.map( ( file, index )=>{
                const { fileName, size, loadPercent } = file;
                const displayedSize = size ? `(${ ( size / 1000000 ).toFixed( 3 )}${props.i18n.MB})` : null;
                return(
                    <div className = 'sw-column'>
                        <div className='sw-row aw-fileUploadDetails-container afx-alt-content-background'>
                            <div className = 'aw-fileUploadDetails-fileName'>{fileName}</div>
                            { displayedSize && <div className = 'aw-fileUploadDetails-fileSize'>{displayedSize}</div> }
                        </div>
                        <AwProgressBar loadPercent={loadPercent}/>
                    </div> );
            } )
            }
        </div>
    );
};
