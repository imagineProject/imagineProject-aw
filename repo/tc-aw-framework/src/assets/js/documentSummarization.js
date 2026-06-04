import browserUtils from 'js/browserUtils';
const docSummarizationURL = 'sd/tclmis/summarize/document';

export const summarizeDocument = async( query, chatHistory, chatContext ) => {
    const body =  {
        schema_version:'1.0.0',
        primary_uid:chatContext?.uid,
        questions: [
            query
        ],
        stream:true
    };

    const response = await fetch( browserUtils.getBaseURL() + docSummarizationURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': getXSRFToken(),
            'x-no-compression': 'true'
        },
        credentials: 'include',
        body: JSON.stringify( body )
    } );

    if ( !response.ok ) {
        throw new Error( `HTTP error! status: ${response.status}` );
    }

    return {
        responseMessage: response.body,
        references: []
    };
};

/**
 *
 * @returns {token} XSRF token
 */
function getXSRFToken() {
    let token = '';
    if ( document !== null && document !== undefined && document.cookie.search( 'XSRF-TOKEN' ) > -1 ) {
        let splitAtr = document.cookie.split( 'XSRF-TOKEN=' );
        if ( splitAtr.length === 2 ) {
            //returns the first element
            token = splitAtr[1].split( ';' )[0];
        }
    }
    return token;
}
