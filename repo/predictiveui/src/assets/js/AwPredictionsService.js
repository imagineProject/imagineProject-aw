import { AwServerVisibilityPredictionCommandBar } from 'js/AwServerVisibilityPredictionCommandBarService';
import localStorage from 'js/localStorage';

/**
 *
 * Render the Active workspace assistant predictions
 *
 * @param {*} props
 * @returns JSX for Active Workspace assistant predictions component
 */

export const awPredictionsRenderFunction = ( { viewModel } ) => {
    if( viewModel.data.predictionWidgetData ) {
        var predictions = viewModel.data.predictionWidgetData;
        return (
            <AwServerVisibilityPredictionCommandBar widgetData={predictions}></AwServerVisibilityPredictionCommandBar>
        );
    }
};

export const initPredictionWidgets = ( predictionData ) => {
    /* TODO: Remove this function in future because we will no longer depend on local storage */

    // let commandInformation = predictionData.commandData;
    // let tabInformation =  predictionData.tabData;
    // let tileInformation = predictionData.tileData;

    // commandInformation = commandInformation ? commandInformation : [];
    // tabInformation = tabInformation ? tabInformation : [];
    // tileInformation = tileInformation ? tileInformation : [];
    // let widgetData = [
    //     ...commandInformation,
    //     ...tabInformation,
    //     ...tileInformation
    // ];
    return {
        predictionWidgetData: Array.isArray( predictionData ) ? predictionData : []
    };
};
