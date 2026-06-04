import AwColumn from 'viewmodel/AwColumnViewModel';
import AwPanelSection from 'viewmodel/AwPanelSectionViewModel';
import AwWalkerElement from 'viewmodel/AwWalkerElementViewModel';
import xrtObjectSetHelperService from 'js/xrtObjectSetHelperService';
import { getUniqueKeyForXRTContainer, getXRTContainerClasses } from 'js/xrtUtilities';

export const awWalkerRenderFunction = ( { data, selectionData, xrtState, activeState, enableResizeCallback,
    vmo, type, objectType, dpRef, subPanelContext, xrtContext, objectSetInfo, focusComponent, editContextKey, ctx } ) => {
    if( data ) {
        const pageRenderingData = data.data._pageRendering;
        xrtObjectSetHelperService.parseRenderingsForSmartObjectSet( pageRenderingData );
        const isNotQT = !window.navigator.userAgent.includes( 'QtWebEngine' );
        return (
            pageRenderingData.map( ( elemdata, index ) => {
                const key = getUniqueKeyForXRTContainer( elemdata.elementType, index, vmo, ctx?.preferences?.AWC_Reset_SectionCollapsedState );
                if( elemdata.elementType === 'column' && elemdata.children && elemdata.children.length > 0 ) {
                    let classes = 'aw-xrt-columnContentPanel aw-xrt-columnContentAlignment';
                    classes += getXRTContainerClasses( elemdata.labelAlignmentMode, type );
                    return <AwColumn className={classes} width={elemdata.width ? elemdata.width : 'fill'} key={key} hideParentFlex={isNotQT}>
                        <AwWalkerElement className='aw-xrt-element' key={key} elemdata={elemdata} xrtData={data} xrtState={xrtState}
                            enableResizeCallback={enableResizeCallback} vmo={vmo} type={type} objectType={objectType}
                            selectionData={selectionData} dpRef={dpRef} subPanelContext={subPanelContext}
                            activeState={activeState} xrtContext={xrtContext} objectSetInfo={objectSetInfo}
                            focusComponent={focusComponent} editContextKey={editContextKey}></AwWalkerElement>
                    </AwColumn>;
                }
                if( elemdata.elementType === 'section' && elemdata.children && elemdata.children.length > 0 ) {
                    let classes = 'aw-xrt-panelSection';
                    classes += getXRTContainerClasses( elemdata.labelAlignmentMode, type );
                    return <AwPanelSection caption={elemdata.displayTitle} titlekey={elemdata.titleKey} collapsed={elemdata.collapsed} key={key} className={classes}>
                        <AwWalkerElement className='aw-xrt-element' key={key} elemdata={elemdata} xrtData={data} xrtState={xrtState}
                            enableResizeCallback={enableResizeCallback} vmo={vmo} type={type} objectType={objectType}
                            selectionData={selectionData} dpRef={dpRef} subPanelContext={subPanelContext}
                            activeState={activeState} xrtContext={xrtContext} objectSetInfo={objectSetInfo}
                            focusComponent={focusComponent} editContextKey={editContextKey}></AwWalkerElement>
                    </AwPanelSection>;
                }
                if( elemdata.elementType !== 'column' && elemdata.elementType !== 'section' && elemdata.elementType !== 'command' ) {
                    return <div width='fill' className={elemdata.enableresize ? 'aw-xrt-nonColumnAndSection sw-column w-12 h-12' : 'aw-xrt-nonColumnAndSection sw-column w-12'}>
                        <AwWalkerElement className='aw-xrt-element' key={key} elemdata={elemdata} xrtData={data} xrtState={xrtState}
                            enableResizeCallback={enableResizeCallback} vmo={vmo} type={type} objectType={objectType}
                            selectionData={selectionData} dpRef={dpRef} subPanelContext={subPanelContext}
                            activeState={activeState} xrtContext={xrtContext} objectSetInfo={objectSetInfo}
                            focusComponent={focusComponent} editContextKey={editContextKey}></AwWalkerElement>
                    </div>;
                }
            } )
        );
    }
};
