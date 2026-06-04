import { addServerVisibility } from 'js/AwServerVisibilityCommandBarService';
import AwPredictionCommandBar from 'viewmodel/AwPredictionCommandBarViewModel';

export const AwServerVisibilityPredictionCommandBar = addServerVisibility( AwPredictionCommandBar, 'AwServerVisibilityPredictionCommandBarImpl' );

/**
 * Fake render function to support HTML view usage
 *
 * @param {Object} props props
 * @returns {Component} component
 */
export const renderPredictionCommandBar = ( props ) => {
    return <AwServerVisibilityPredictionCommandBar
        {...props}>
    </AwServerVisibilityPredictionCommandBar>;
};
