import _ from 'lodash';
import Ac0CommentDetails from 'viewmodel/Ac0CommentDetailsViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';

export const ac0CommentListRenderFunction = ( props ) => {
    const { viewModel, actions } = props;
    const { data } = viewModel;
    if( data.loadedCommentsObject && _.isEmpty( data.loadedCommentsObject.loadedComments ) ) {
        return;
    }

    return (
        <div>
            { props.discussionData && props.discussionData.props.numReplies.dbValue > data.commentsPage.pageSize && !data.commentsPage.cursorObject.startReached && <div className='sw-row justify-left'>
                <div className='sw-column w-5'>
                    <AwButton buttonType='chromeless' action={actions.searchComments}>Load More</AwButton>
                </div>
            </div> }
            <ul className='aw-widgets-cellListWidget'>
                { data.loadedCommentsObject.loadedComments.map( ( comment, index ) => {
                    var cmtDetailsProp = {
                        commentDetails: comment,
                        contents:props.sharedDataObj.contents,
                        convItem: props.sharedDataObj.discussItem
                    };
                    return (
                        <li className='aw-widgets-cellListItem aw-widgets-cellTop' key={index}>
                            <Ac0CommentDetails details={cmtDetailsProp} sharedDataObj={props.sharedDataObj}></Ac0CommentDetails>
                        </li>
                    );
                } )}
            </ul>
        </div>
    );
};

export const initCommentList = ( commentsPage, discussionData, commentReplyObj, loadedCommentsObj ) => {
    const newCommentsPage = _.clone( commentsPage );
    const newCommentReplyObj = { ...commentReplyObj.getValue() };
    newCommentReplyObj.loadedCommentsObject = loadedCommentsObj;
    commentReplyObj.update( newCommentReplyObj );
    newCommentsPage.currentStartIndex = discussionData.props.numReplies && discussionData.props.numReplies.dbValue > 0 ? discussionData.props.numReplies.dbValue - commentsPage.pageSize : 0;
    newCommentsPage.currentEndIndex = 0;
    newCommentsPage.discussionUID = discussionData.uid;
    return newCommentsPage;
};

export const prependSearchedCommentstoLoadedComments = ( loadedCommentsObject, searchedComments, commentsPage, commentReplyObj ) => {
    const newLoadedCommentsObj = _.clone( loadedCommentsObject );
    const newCommentsPage = _.clone( commentsPage );
    newLoadedCommentsObj.loadedComments = [ ...searchedComments, ...newLoadedCommentsObj.loadedComments ];
    var nextStartIndex = newCommentsPage.currentStartIndex - newCommentsPage.pageSize;
    var nextEndIndex = newCommentsPage.cursorObject.startIndex - 1;
    newCommentsPage.currentStartIndex = nextStartIndex > 0 ? nextStartIndex : 0;
    newCommentsPage.currentEndIndex = nextEndIndex >= 0 ? nextEndIndex : 0;
    newCommentsPage.pageSize = newCommentsPage.currentStartIndex === 0 ? newCommentsPage.currentEndIndex + 1 : newCommentsPage.pageSize;
    //shared atomic data update
    const newCommentReplyObj = { ...commentReplyObj.getValue() };
    newCommentReplyObj.loadedCommentsObject = newLoadedCommentsObj;
    commentReplyObj.update( newCommentReplyObj );
    return {
        loadedCommentsObject: newLoadedCommentsObj,
        commentsPage: newCommentsPage
    };
};

export let resetCommentCounts = function( commentsPage, discussionData, commentReplyObj, loadedCommentsObj ) {
    const newCommentsPage = _.clone( commentsPage );
    const newCommentReplyObj = { ...commentReplyObj.getValue() };
    // TODO: Update this when RTPM is implemented
    // The discussion number of replies should be updated by the RTPM message when things change.
    // For this initial commit we are increasing the index by one (1) until the RTPM changes are done.
    let tmpCurrentStartIndex = discussionData.props.numReplies && discussionData.props.numReplies.dbValue > 0 ? discussionData.props.numReplies.dbValue - commentsPage.pageSize : 0;
    tmpCurrentStartIndex++;
    newCommentsPage.currentStartIndex = tmpCurrentStartIndex;
    newCommentsPage.currentEndIndex = 0;
    newCommentReplyObj.loadedCommentsObject = { loadedComments:[] };
    commentReplyObj.update( newCommentReplyObj );
    return { commentsPage:newCommentsPage };
};
