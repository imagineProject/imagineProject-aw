import AwSearchSuggestions from 'viewmodel/AwSearchSuggestionsViewModel';
import AwPopup from 'viewmodel/AwPopupViewModel';
import AwSearchBox from 'viewmodel/AwSearchBoxViewModel';
import awSearchControllerService from 'js/awSearchControllerService';
import eventBus from 'js/eventBus';
import awSearchCoreService from 'js/awSearchCoreService';
import AwGlobalSearchBoxUtils from 'js/AwGlobalSearchBoxUtils';

export const awsuggestivesearchrender = ( props ) => {
    const { viewModel, actions, searchHistoryCache = undefined, showSuggestions = false, searchAction, searchBoxProp, options, fields } = props;
    let { hintPopup } = actions;
    const hasInput = searchBoxProp && searchBoxProp.value && searchBoxProp.value.length > 0;
    const { ctx } = viewModel;

    const closePopup = () => {
        hintPopup.hide();
    };

    let overridePopupOptions = () => {
        if( options ) {
            return { width: hintPopup.reference.current.offsetWidth, ...options };
        }
        return { width: hintPopup.reference.current.offsetWidth };
    };
    const onKeyPress = ( event ) => {
        if( event.key === 'Enter' ) {
            if( hasInput ) {
                event.preventDefault();
                searchAction();
                closePopup();
            }
        } else if ( event.key === 'ArrowDown' ) {
            onClickMe();
            AwGlobalSearchBoxUtils.selectNextIndexOnArrowDown( { searchBox:searchBoxProp } );
        } else if ( event.key === 'ArrowUp' ) {
            AwGlobalSearchBoxUtils.selectNextIndexOnArrowUp( { searchBox:searchBoxProp } );
        }else {
            eventBus.publish( 'search.recentsChanged' );
            if ( showSuggestions ) {
                awSearchCoreService.publishEventsInHalfSeconds( 'search.suggestionsChanged' );
            }
            if( !hintPopup.open && showSuggestions ) {
                hintPopup.show( {
                    ...overridePopupOptions()
                } );
            }
        }
    };
    const onClickMe = () => {
        let recents = awSearchControllerService.retrieveRecentSearchObjectsFiltered( ctx.user.uid, searchBoxProp.value, searchHistoryCache );
        let hasRecents = recents && recents.length > 0;
        if( ( hasRecents || showSuggestions ) && !hintPopup.open ) {
            hintPopup.show( {
                ...overridePopupOptions()
            } );
        }
    };


    return (


        <>

            <AwSearchBox
                domRef={hintPopup.reference}
                closeAction={closePopup}
                action={searchAction}
                onKeyDown={( event )=> onKeyPress( event )}
                onClick={()=> onClickMe()}
                hideSearchIconForBlankInput={true}
                prop = {searchBoxProp}>
            </AwSearchBox>
            {
                !( searchHistoryCache === 'No_search_history' && showSuggestions === false ) &&
                        <AwPopup {...hintPopup.options}>
                            <AwSearchSuggestions
                                searchHistoryCache={searchHistoryCache}
                                searchstring={searchBoxProp}
                                closeAction={closePopup}
                                action={searchAction}
                                showSuggestions={showSuggestions}
                                {...fields}></AwSearchSuggestions>
                        </AwPopup>
            }
        </>


    );
};
