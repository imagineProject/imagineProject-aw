import PmaUpdateSummaryTileSubPanel from 'viewmodel/PmaUpdateSummaryTileSubPanelViewModel';
import pma1ImpactAnalysisService from 'js/Pma1ImpactAnalysisService';
/**
 * render function for PmaUpdateSummaryTile
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awPmaUpdateSummaryTileRenderFunction = ( props ) => {
    const handleClick = ( event ) => {
        if( event.target.radio !== 'radio' ) {
            pma1ImpactAnalysisService.tileSelected( props.subPanelContext, event.ctrlKey );
        } else{
            event.stopPropagation();
            event.preventDefault();
        }
    };

    const handleKeyDown = ( event ) => {
        if( event.key === 'Enter' ) {
            pma1ImpactAnalysisService.tileSelected( props.subPanelContext );
        }
    };

    return (
        <div onClick={( e )=>{ handleClick( e ); }} onKeyDown={( e )=>{ handleKeyDown( e ); }} role = 'button'  tabIndex={0}>
            <PmaUpdateSummaryTileSubPanel  subPanelContext={ props.subPanelContext } ></PmaUpdateSummaryTileSubPanel>
        </div>
    );
};


