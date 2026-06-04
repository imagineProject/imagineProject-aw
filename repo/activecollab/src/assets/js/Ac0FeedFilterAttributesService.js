// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */
/* eslint-disable jsx-quotes */
import AwLink from 'viewmodel/AwLinkViewModel';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import appCtxService from 'js/appCtxService';
import { getField } from 'js/utils';


export const Ac0FeedFilterAttributesRenderFunction = ( props ) => {
    let subPanelContext = props.subPanelContext;
    let { fields } = props;
    if( subPanelContext && subPanelContext.fields ) {
        fields = { ...fields, ...subPanelContext.fields };
    }

    const showAttributes = () => {
        if ( props.attributes && hasAttributes() ) {
            let attributes = getAttributeList();
            if( props.showclearcmd === 'true' || props.showclearcmd === true ) {
                return (
                    <>
                        <span className="aw-search-advancedSearchClearAll">
                            <AwLink {...getField( 'data.feedFilterClearAll', fields )} action={props.callBackAction} ></AwLink>
                        </span>
                        {attributes.map( ( attribute )=>getAttributeValues( attribute ) )}
                    </>
                );
            }
            return (
                <>
                    {attributes.map( ( attribute )=>getAttributeValues( attribute ) )}
                </>
            );
        }
        return null;
    };

    const hasAttributes = () => {
        for( const [ key, value ] of Object.entries( props.attributes ) ) {
            if( value && value.name ) {
                return true;
            }
        }
        return false;
    };

    const getAttributeList = () => {
        let attributes = [];
        for( const [ key, value ] of Object.entries( props.attributes ) ) {
            var enableTrackedDiscussionPref = appCtxService.getCtx( 'preferences.Ac0EnableTrackedDiscussions' );
            if( enableTrackedDiscussionPref[0] === 'false' && ( value.name === 'ac0Priority' || value.name === 'ac0Status' ) ) {
                continue;
            }
            attributes.push( value );
        }
        return attributes;
    };

    const getAttributeValues = ( attribute ) => {
        let renderHint = '';
        if( attribute.typex === 'STRINGARRAY' ) {
            renderHint = 'checkboxoptionlov';
        } else if ( attribute.typex === 'BOOLEAN' ) {
            renderHint = 'triState';
        }
        return (
            <AwWidget {...attribute} hint={renderHint}></AwWidget>
        );
    };


    return (
        <>
            { showAttributes() }
        </>
    );
};
