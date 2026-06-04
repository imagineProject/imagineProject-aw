// Copyright (c) 2022 Siemens

/**
 * @module js/Saw1ProgramViewFilterService
 */
import { getBaseUrlPath } from 'app';
import selectionService from 'js/selection.service';
import appCtxService from 'js/appCtxService';
import viewModelObjectSvc from 'js/viewModelObjectService';
import smConstants from 'js/ScheduleManagerConstants';
import prgDataProcessor from 'js/Saw1ProgramViewDataProcessor';
import prgDataSource from 'js/Saw1ProgramViewDataSource';
import dateTimeSvc from 'js/dateTimeService';
import $ from 'jquery';
import eventBus from 'js/eventBus';
import _ from 'lodash';
import commandPanelService from 'js/commandPanel.service';

var exports = {};

export let parseProgramViewSOAResponse = function( response, ctx, data ) {
    prgDataProcessor.instance.clearAndReInitGantt( response, ctx, data, smConstants.MANAGE_PRG_VIEW_SOA_OP_TYPE_LOAD_USING_CONFIG );
};
export let getReferenceTaskUid = function( data ) {
    return prgDataSource.instance.getReferenceTaskUid( data );
};
export let getParentTaskUid = function( data, ctx ) {
    return prgDataSource.instance.getParentTaskUid( data, ctx );
};

export let getProgramViewObject = function( ctx ) {
    return prgDataSource.instance.getProgramViewObject( ctx );
};

/**
 * getProgramViewConfiguration to fetch the results
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data for manageProgramView SOA.
 * @returns {object} programViewConfiguration for manageProgramView SOA.
 */
export let getProgramViewConfiguration = function( selectedFilters ) {
    let filterSets = [];
    let filterSet = {
        filters: []
    };
    if( selectedFilters ) {
        for( let i = 0; i < selectedFilters.length; i++ ) {
            let criteria = smConstants.PROGRAM_VIEW_CRITERIA_TYPE_LIST[ selectedFilters[ i ].operatorName ];
            if( !criteria ) {
                criteria = selectedFilters[ i ].operatorName;
            }
            let propertyName = selectedFilters[ i ].propertyQName.split( '.' )[ 1 ];

            let filterObj = {
                attributeName: selectedFilters[ i ].propertyQName,
                criteria: criteria,
                filterValue: propertyName === 'ResourceAssignment' && selectedFilters[ i ].internalValue === 'Unassigned' ? '' : selectedFilters[ i ].internalValue
            };
            if( selectedFilters[ i ].conditionName === 'Or' ) {
                filterSets.push( filterSet );
                filterSet = {
                    filters: []
                };
            }
            filterSet.filters.push( filterObj );
        }
        filterSets.push( filterSet );
    }
    return filterSets;
};
/**
 * Display the Program View Filter Panel
 *
 * @param {commandId} commandId - Command Id of Panel
 * @param {location} location - location of Panel
 */
export let getProgramViewFilterPanel = function( commandId, location, cmdContext ) {
    let selection = selectionService.getSelection().selected;
    const { dialogAction } = cmdContext;

    if( selection && selection.length > 0 ) {
        let ProgramViewFilterObj = {
            selectedObject: selection[ 0 ]
        };
        cmdContext.selections = {
            ProgramView : ProgramViewFilterObj
        };
    } else {
        delete cmdContext.selections;
    }
    if( dialogAction ) {
        let options =  {
            view: commandId,
            parent: '.aw-layout-workarea',
            placement: 'right',
            width: 'SMALL',
            height: 'FULL',
            isCloseVisible: false,
            push: true,
            subPanelContext: cmdContext,
            commandid: commandId,
            commandicon: 'cmdfilter'
        };
        dialogAction.show( options );
    } else {
        commandPanelService.activateCommandPanel( commandId, location, cmdContext );
    }
};

/**
 * Reset Widgets db values
 *
 * @param {data} data - The data of view model
 */
var resetWidgets = function( genericWidget, genericEndWidget ) {
    let widget = _.clone( genericWidget );
    let endWidget = _.clone( genericEndWidget );
    if( widget ) { widget.dbValue = null; }
    if( endWidget ) { endWidget.dbValue = null; }
    return {
        widget : widget,
        endWidget : endWidget
    };
};

var setFieldName = function( ctx, index, typePropName, filtersCond ) {
    let boType = typePropName.split( '.' )[ 0 ];
    let propName = typePropName.split( '.' )[ 1 ];

    filtersCond[ index ].typeName = boType;
    filtersCond[ index ].propertyQName = typePropName; // Qualified property name

    if( ctx.ProgramViewTypesMap ) {
        filtersCond[ index ].typeDisplayName = ctx.ProgramViewTypesMap[ boType ];
    }

    if( ctx.ProgramViewPropertiesMap ) {
        let prefProperties = ctx.ProgramViewPropertiesMap[ boType ];
        for( let k = 0; k < prefProperties.length; k++ ) {
            if( prefProperties[ k ].name === propName ) {
                filtersCond[ index ].propertyDisplayName = prefProperties[ k ].displayName;
                filtersCond[ index ].uid = Math.floor( Math.random() * 10000 + 1 ); // Uid generation for New Condition
                break;
            }
        }
    }
};

var setFieldValue = function( ctx, index, internalValue, typePropName, data, filtersCond ) {
    let propertyName = typePropName.split( '.' )[ 1 ];
    let localisedTo = ' ' + data.i18n.to + ' ';

    filtersCond[ index ].internalValue = internalValue;

    if( propertyName === 'actual_start_date' || propertyName === 'actual_finish_date' || propertyName === 'start_date' || propertyName === 'finish_date' ) {
        let startDate = internalValue.split( ',' )[ 0 ];
        let endDate = internalValue.split( ',' )[ 1 ];
        if( startDate ) {
            filtersCond[ index ].value = dateTimeSvc.formatDate( new Date( startDate ), 'DD-MMM-YYYY' );
        }
        if( endDate ) {
            filtersCond[ index ].value += localisedTo + dateTimeSvc.formatDate( new Date( endDate ), 'DD-MMM-YYYY' );
        }
    } else if( propertyName === 'ResourceAssignment' ) {
        if( internalValue === '' ) {
            filtersCond[ index ].internalValue = 'Unassigned';
            filtersCond[ index ].value = data.i18n.Saw1Unassigned;
        } else {
            filtersCond[ index ].value = internalValue;
        }
    } else if( propertyName === 'fnd0state' || propertyName === 'fnd0status' ) {
        if( internalValue.includes( '_' ) ) {
            filtersCond[index].value = internalValue.split( '_' )[0][0].toUpperCase() + internalValue.split( '_' )[0].slice( 1 ) + ' ' + internalValue.split( '_' )[1][0].toUpperCase() + internalValue.split( '_' )[1].slice( 1 );
        } else {
            filtersCond[index].value = internalValue[0].toUpperCase() + internalValue.slice( 1 );
        }
        filtersCond[index].internalValue = internalValue;
    } else {
        filtersCond[ index ].value = internalValue;
        let startValue = internalValue.split( ',' )[ 0 ];
        let endValue = internalValue.split( ',' )[ 1 ];
        if( startValue ) {
            filtersCond[ index ].value = startValue;
        }
        if( endValue ) {
            filtersCond[ index ].value += localisedTo + endValue;
        }
    }
};

export let getProgramViewConditions = function( panelContext, dataProvider, ctx, data, programViewFiltersConditions ) {
    if( panelContext &&  panelContext.programViewConfigurations && panelContext.programViewConfigurations.configurations ) {
        let filterSetLength = panelContext.programViewConfigurations.configurations.filterSets.length;
        if( filterSetLength > 0 && programViewFiltersConditions.filtersData.length === 0 ) {
            let count = 0;
            for( let j = 0; j < filterSetLength; j++ ) {
                let filtersLength = panelContext.programViewConfigurations.configurations.filterSets[ j ].filters.length;
                for( let k = 0; k < filtersLength; k++ ) {
                    programViewFiltersConditions.filtersData[ count ] = [];
                    if( j === 0 || k !== 0 ) {
                        programViewFiltersConditions.filtersData[ count ].conditionName = 'And';
                        programViewFiltersConditions.filtersData[ count ].conditionDisplayName = data.i18n.and;
                    } else if( j !== 0 && k === 0 ) {
                        programViewFiltersConditions.filtersData[ count ].conditionName = 'Or';
                        programViewFiltersConditions.filtersData[ count ].conditionDisplayName = data.i18n.or;
                    }

                    let filter = panelContext.programViewConfigurations.configurations.filterSets[ j ].filters[ k ];
                    let typePropName = filter.attributeName;
                    setFieldName( ctx, count, typePropName, programViewFiltersConditions.filtersData );

                    let operatorName = smConstants.PROGRAM_VIEW_CRITERIA_INTERNAL_NAME_LIST[ filter.criteria ];
                    programViewFiltersConditions.filtersData[ count ].operatorName = operatorName;
                    programViewFiltersConditions.filtersData[ count ].operatorDisplayName = data.i18n[ smConstants.PROGRAM_VIEW_CRITERIA_i18n_KEY_MAP[ operatorName ] ];
                    setFieldValue( ctx, count, filter.filterValue, typePropName, data, programViewFiltersConditions.filtersData );
                    count++;
                }
            }
            programViewFiltersConditions.update( programViewFiltersConditions );
        }
    }
    if( programViewFiltersConditions && programViewFiltersConditions.filtersData && programViewFiltersConditions.filtersData.length > 0 ) {
        let addedFilters = programViewFiltersConditions.filtersData;
        for( let i = 0; i < addedFilters.length; i++ ) {
            if( dataProvider ) {
                let mObj = viewModelObjectSvc.createViewModelObject( i + 1, 'EDIT' );
                mObj = {
                    cellProperties: {}
                };
                mObj.uid = addedFilters[ i ].uid;
                if ( i !== 0 ) {
                    mObj.cellHeader1 = addedFilters[ i ].conditionDisplayName;
                    mObj.cellHeaderInternalValue = addedFilters[ i ].conditionName;
                }
                mObj.cellProperties[ data.typeSection.dbValue ] = {
                    key: data.typeSection.uiValue,
                    value: addedFilters[ i ].typeDisplayName,
                    internalValue: addedFilters[ i ].typeName
                };

                mObj.cellProperties[ data.propertySection.dbValue ] = {
                    key: data.propertySection.uiValue,
                    value: addedFilters[ i ].propertyDisplayName,
                    internalValue: addedFilters[ i ].propertyQName
                };

                mObj.cellProperties[ data.operatorSection.dbValue ] = {
                    key: data.operatorSection.uiValue,
                    value: addedFilters[ i ].operatorDisplayName,
                    internalValue: addedFilters[ i ].operatorName
                };

                mObj.cellProperties[ data.ValueSection.dbValue ] = {
                    key: data.ValueSection.uiValue,
                    value: addedFilters[ i ].value,
                    internalValue: addedFilters[ i ].internalValue
                };
                mObj.typeIconURL = getBaseUrlPath() + '/images/filterIcon.svg';
                dataProvider.viewModelCollection.loadedVMObjects.push( mObj );
            }
        }
    } else {
        programViewFiltersConditions.filtersData = [];
        programViewFiltersConditions.update( programViewFiltersConditions );
    }
    //After filters are added, this update shows filters that were added
    var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
    dataProvider.update( loadedObjects, loadedObjects.length );
};

/**
 * Remove Filter Condition when clicked on the remove cell.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @param {object} deletedUid - The Uid to be deleted
 * @returns {boolean} true/false
 */
var removeFromProgramViewConditions = function( programViewFiltersConditions, vmo, genericWidget, genericEndWidget ) {
    var index = _.findIndex( programViewFiltersConditions.filtersData, function( t ) {
        return t.uid === vmo.uid;
    } );
    if( index > -1 ) {
        programViewFiltersConditions.filtersData.splice( index, 1 );
    }
    programViewFiltersConditions.update( programViewFiltersConditions );
    return resetWidgets( genericWidget, genericEndWidget  );
};

/**
 * Remove condition called when clicked on the remove cell.
 *
 * @param {ctx} ctx - The ctx of the viewModel
 * @param {data} data - The qualified data of the viewModel
 * @param {object} deletedUid - The Uid to be deleted
 */
export let removeCondition = function( getProgramViewConditions, vmo, programViewFiltersConditions, genericWidget, genericEndWidget ) {
    let memberModelObjects = getProgramViewConditions.viewModelCollection.loadedVMObjects;

    var index = _.findIndex( memberModelObjects, function( o ) {
        return _.isEqual( o, vmo );
    } );

    if( index > -1 ) {
        memberModelObjects.splice( index, 1 );
    }
    removeFromProgramViewConditions( programViewFiltersConditions, vmo, genericWidget,  genericEndWidget );
};

/**
 * Execute the delete command.
 * Used to delete condition for Program Filter View
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {data} data - The qualified data of the viewModel
 */
export let deleteProgramViewCondition = function( vmo ) {
    if( vmo ) {
        eventBus.publish( 'Saw1ProgramViewFilterSub.removeCondition', vmo );
    }
};

/**
 * Execute the edit command.
 * Edit condition functionality
 *
 * @param {ViewModelObject} vmo - Context for the command used in evaluating isVisible, isEnabled and during
 *            execution.
 * @param {data} data - The qualified data of the viewModel
 */
export let editProgramViewCondition = function( vmo, data ) {
    if( vmo ) {
        if( !appCtxService.ctx.ProgramViewFilterConditonForEdit ) {
            appCtxService.registerCtx( 'ProgramViewFilterConditonForEdit', [] );
        }
        appCtxService.ctx.ProgramViewFilterConditonForEdit = _.cloneDeep( vmo );
        eventBus.publish( 'Saw1ProgramViewFilterSub.editCondition' );
    }
};

/**
 * Clean up the registers
 *
 * @param {ctx} ctx - The ctx of the viewModel
 */
export let cleanUpEdit = function( ctx ) {
    if( ctx.ProgramViewFilterConditonForEdit ) {
        appCtxService.unRegisterCtx( 'ProgramViewFilterConditonForEdit' );
    }
};

export let cleanUpPropData = function( propData ) {
    let prop = _.clone( propData );
    prop.filtersData = [];
    return prop;
};

exports = {
    parseProgramViewSOAResponse,
    getReferenceTaskUid,
    getParentTaskUid,
    getProgramViewObject,
    getProgramViewConfiguration,
    getProgramViewFilterPanel,
    getProgramViewConditions,
    removeCondition,
    deleteProgramViewCondition,
    editProgramViewCondition,
    cleanUpEdit,
    cleanUpPropData
};
export default exports;
