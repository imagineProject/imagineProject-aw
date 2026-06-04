import AwTree from 'viewmodel/AwTreeViewModel';
import Rb0SegmentFilterChips from 'viewmodel/Rb0SegmentFilterChipsViewModel';

/**
 * render function for relation table popup
 * @param {*} props context for render function
 * @returns {JSX.Element} react component
 */
export const rb0SegmentTreeRenderFunction = ( props ) => {
    return (
        <AwTree name={props.treeName ? props.treeName : 'segmentree'} tree={props.segmentTree}>
            { ( { node } ) => {
                return <span value={node.label} className={'aw-reports-segmentNodeSpan'}>
                    <div className={'aw-reports-segmentNodeLabel'}>{node.label}</div>
                    {
                        node.searchFilterMap && Object.keys( node.searchFilterMap ).length > 0 &&
                            <Rb0SegmentFilterChips searchFilterMap={node.searchFilterMap} nodeIndex={node.uid}></Rb0SegmentFilterChips>
                    }</span>;
            } }
        </AwTree>
    );
};

const Rb0SegmentTreeService = {
    rb0SegmentTreeRenderFunction
};
export default Rb0SegmentTreeService;
