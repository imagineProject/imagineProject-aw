// Copyright (c) 2021 Siemens
import AwInclude from 'viewmodel/AwIncludeViewModel';
import AwFrame from 'viewmodel/AwFrameViewModel';
import xrtHtmlPanelSvc from 'js/xrtHtmlPanelService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import cdm from 'soa/kernel/clientDataModel';
import dataSourceService from 'js/dataSourceService';
import { isEmpty } from 'lodash';
import { initDataProviderRef, evaluateInterpolatedString } from 'js/xrtUtilities';

const addContainerResizeCSS = function( enableResizeCallback, enableresize ) {
    if( enableresize && enableResizeCallback ) {
        enableResizeCallback( true );
    }
};

const cleanUpResizeCSS = function( enableResizeCallback, enableresize ) {
    if( enableresize && enableResizeCallback ) {
        enableResizeCallback( false );
    }
};

/**
 * @param {ViewModelObject} parentVMO - VMO to access
 * @param {String} propName - Name of the property to on parent to access for results.
 *
 * @return {HtmlPanelModelObject} New object representing the CDM modelObject at the given property (or {}
 *         if no object found at that property)..
 */
const createHtmlPanelModelObject = function( parentVMO, propName ) {
    let propHtmlPanelObj;

    if( parentVMO && parentVMO.props[ propName ] && parentVMO.props[ propName ].hasReadAccess !== false && !isEmpty( parentVMO.props[ propName ].dbValue ) ) {
        let propModelObj = cdm.getObject( parentVMO.props[ propName ].dbValue );

        if( propModelObj ) {
            let vmo = viewModelObjectSvc.constructViewModelObjectFromModelObject( propModelObj );

            propHtmlPanelObj = xrtHtmlPanelSvc.createHtmlPanelModelObjectOverlay( vmo );
        } else {
            propHtmlPanelObj = {};
        }
    } else {
        propHtmlPanelObj = {};
    }

    return propHtmlPanelObj;
};


export const initialize = ( enableResizeCallback, htmlpaneldata, userSession ) => {
    if( !htmlpaneldata ) {
        return {};
    }
    const { enableresize } = htmlpaneldata;
    addContainerResizeCSS( enableResizeCallback, enableresize );

    return {
        userSession: xrtHtmlPanelSvc.createHtmlPanelModelObjectOverlay( userSession ),
        user: createHtmlPanelModelObject( userSession, 'user' ),
        group: createHtmlPanelModelObject( userSession, 'group' ),
        role: createHtmlPanelModelObject( userSession, 'role' ),
        project: createHtmlPanelModelObject( userSession, 'project' )
    };
};

export const onUnmount = ( props, getViewModelCollection ) => {
    const { enableResizeCallback, htmlpaneldata, subPanelContext } = props;
    if( !htmlpaneldata ) {
        return;
    }
    const { enableresize, declarativeKey } = htmlpaneldata;
    cleanUpResizeCSS( enableResizeCallback, enableresize );

    if( getViewModelCollection && props.dpRef && props.dpRef.current && props.dpRef.current.dataProviders && props.dpRef.current.dataProviders.includes( getViewModelCollection ) ) {
        let index = props.dpRef.current.dataProviders.indexOf( getViewModelCollection );
        if( index > -1 ) {
            props.dpRef.current.dataProviders.splice( getViewModelCollection, 1 );
        }
    }

    if( subPanelContext && subPanelContext.editHandler ) {
        let dataSource = subPanelContext.editHandler.getDataSource();
        if ( dataSource ) {
            let newViewModel = { ...dataSource.getDeclViewModel() };

            if( newViewModel.customPanelInfo && declarativeKey && newViewModel.customPanelInfo[ declarativeKey ] ) {
                delete newViewModel.customPanelInfo[ declarativeKey ];
                let newDataSource = dataSourceService.createNewDataSource( { declViewModel: newViewModel } );
                subPanelContext.editHandler.setDataSource( newDataSource );
            }
        }
    }
};

export const awWalkerHtmlPanelRenderFunction = ( props ) => {
    const { htmlpaneldata, subPanelContext, xrtState, elementRefList,
        type, selectionData, dpRef, viewModel, vmo, caption, focusComponent } = props;

    if( !htmlpaneldata ) {
        return;
    }

    const { enableresize, src, declarativeKey, context } = htmlpaneldata;
    const { sessionContext } = viewModel;
    const panelRef = elementRefList.get( 'panelRef' );
    const selectedVMO = vmo;

    const updateVMCollectionCallback = function( response ) {
        if( response?.dataProvider && dpRef ) {
            initDataProviderRef( dpRef );

            let index = dpRef.current.dataProviders.indexOf( response.dataProvider.viewModelCollection.getLoadedViewModelObjects );
            if( index === -1 ) {
                dpRef.current.dataProviders.push( response.dataProvider.viewModelCollection.getLoadedViewModelObjects );
                viewModel.dispatch( { path: 'data.getViewModelCollection', value: response.dataProvider.viewModelCollection.getLoadedViewModelObjects } );
            }
        }
    };

    let vmProps = {};
    if( xrtState?.xrtVMO?.props ) {
        vmProps = xrtState.xrtVMO.props;
        // For Summary and Info type XRTs, we want property labels at the left by default
        if( type === 'SUMMARY' || type === 'INFO' ) {
            Object.values( vmProps ).forEach( propValue => {
                if( propValue.fielddata.labelPlacement === 'default' ) {
                    propValue.fielddata.labelPlacement = 'start';
                }
            } );
        }
    }
    // Session info needs to be fields not viewModelProperties and support this format: session.current_group.properties.object_string
    const htmlPanelDataCtx = {
        ...subPanelContext,
        session: {
            current_user_session: sessionContext?.userSession,
            current_user: sessionContext?.user,
            current_group: sessionContext?.group,
            current_role: sessionContext?.role,
            current_project: sessionContext?.project
        },
        selected: selectedVMO,
        fields: {
            subPanelContext: {
                ...vmProps
            },
            selected: {
                properties: vmProps
            }
        },
        selectionData: selectionData,
        callback: {
            updateVMCollectionCallback
        },
        parentRef: panelRef,
        xrtType: type,
        xrtState,
        caption:caption,
        focusComponent
    };

    htmlPanelDataCtx.declarativeKeyContext = evaluateInterpolatedString( context, htmlPanelDataCtx );
    // to support backward compatibility usage of 'selected.properties'
    if( selectedVMO?.props ) {
        htmlPanelDataCtx.selected.properties = selectedVMO.props;
    }

    let htmlPanelClassName = 'aw-xrtjs-htmlPanelContainer';

    if( enableresize ) {
        htmlPanelClassName += ' h-12';
    }

    if( src ) {
        const interPolatedSrc = evaluateInterpolatedString( src, htmlPanelDataCtx );
        // eslint-disable-next-line consistent-return
        return <div className={htmlPanelClassName}>
            <div className='aw-jswidgets-htmlPanel'>
                <div className='aw-jswidgets-htmlPanelFrame aw-xrt-columnContentPanel'><AwFrame url={interPolatedSrc}></AwFrame></div>
            </div>
        </div>;
    } else if( declarativeKey ) {
        let key;
        if ( vmo?.uid && xrtState?.xrtVMO?.uid === vmo?.uid ) {
            key = vmo.uid;
        } else if ( xrtState?.xrtVMO?.uid ) {
            key = xrtState.xrtVMO.uid;
        }
        if( key ) {
            // eslint-disable-next-line consistent-return
            return <div className={htmlPanelClassName} ref={ panelRef }>
                <div className='aw-jswidgets-htmlPanel'>
                    <AwInclude key={key} className='aw-jswidgets-declarativeKeyCont' subPanelContext={htmlPanelDataCtx} name={declarativeKey}></AwInclude>
                </div>
            </div>;
        }
        // eslint-disable-next-line consistent-return
        return <div className={htmlPanelClassName} ref={ panelRef }>
            <div className='aw-jswidgets-htmlPanel'>
                <AwInclude className='aw-jswidgets-declarativeKeyCont' subPanelContext={htmlPanelDataCtx} name={declarativeKey}></AwInclude>
            </div>
        </div>;
    }
};
