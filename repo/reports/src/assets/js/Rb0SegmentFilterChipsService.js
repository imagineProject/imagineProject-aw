import AwChip from 'viewmodel/AwChipViewModel';
import AwButton from 'viewmodel/AwButtonViewModel';
import AwPopup from 'viewmodel/AwPopupViewModel';
import _ from 'lodash';
import cmm from 'soa/kernel/clientMetaModel';
import dateTimeService from 'js/dateTimeService';
import resizeObserverSvc from 'js/resizeObserver.service';
import localeSvc from 'js/localeService';

export let doNothing = () => {
    //NO OP
};

export const attachResizeObserver = ( viewModel, elementRefList, nodeIndex ) => {
    const ref = elementRefList.get( 'chiplist' );
    const { dispatch } = viewModel;

    const addResizeObserver = () => {
        if( resizeObserverSvc.supportsResizeObserver() ) {
            const callback = _.debounce( () => {
                if( ref && ref.current && ref.current.parentElement && ref.current.parentElement.parentElement ) {
                    const data = viewModel.getData();
                    var overflowReturn = calculateOverflow( elementRefList, data.breadcrumbChips,
                        data.searchFilterCategoryExpandMore, nodeIndex );
                    var overflowConfig = {
                        overflownChips: overflowReturn.overflownChips,
                        hideMore: true
                    };
                    dispatch && dispatch( { path: 'data', value:
                    { displayBreadcrumbChips: overflowReturn.displayChips, displayOverflowButton: overflowReturn.displayOverflowButton, overflowConfig: overflowConfig } } );
                }
            }, 5, {
                maxWait: 50,
                trailing: true,
                leading: false
            } );
            ref.current.resizeObserver = resizeObserverSvc.observe( ref.current.parentElement.parentElement, callback );
        }
    };
    addResizeObserver();
};

export let calculateOverflow = ( elementRefList, breadcrumbChips, searchFilterCategoryExpandMore, nodeIndex ) => {
    var displayChips = [];
    var overflownChips = [];
    let segmentLabelAreaSpacing = 0;
    let moreSpacing = 90;
    if ( elementRefList ) {
        let chiplist = elementRefList.get( 'chiplist' ).current;
        if ( chiplist.parentNode.parentElement?.firstChild?.clientWidth ) {
            segmentLabelAreaSpacing = chiplist.parentNode.parentElement.firstChild.clientWidth + 16 * ( nodeIndex + 1 ) + moreSpacing;
        }
    }
    if( segmentLabelAreaSpacing <= 400 ) {
        overflownChips = breadcrumbChips.slice( 1 );
        displayChips = breadcrumbChips.slice( 0, 1 );
    } else{
        overflownChips = breadcrumbChips;
        displayChips = [];
    }
    let displayOverflowButton = overflownChips.length + ' ' + searchFilterCategoryExpandMore;

    return  { displayChips, overflownChips, displayOverflowButton };
};

export const Rb0SegmentFilterChipsRenderFunction = ( props ) => {
    const { viewModel, actions, elementRefList } = props;
    const { data } = viewModel;
    let { chipOverflowPopup } = actions;
    const chipCondition = {
        conditions: {
        }
    };

    const openOverflow = () => {
        if( !chipOverflowPopup.open ) {
            chipOverflowPopup.show( {
                width: 'auto',
                height: 'auto'
            } );
        }
    };

    const closePopup = () => {
        chipOverflowPopup.hide();
    };

    let loadedVMO = data.displayBreadcrumbChips;
    return (
        <div className={'aw-search-breadcrumb-chipsPanel' }>
            <div className={'aw-layout-flexbox ' + 'aw-widgets-chipListPanel'} ref={elementRefList.get( 'chiplist' )}>
                { data.displayBreadcrumbChips && data.displayBreadcrumbChips.length > 0 && loadedVMO.map( ( chipModel, index ) => {
                    return (
                        <AwChip
                            chip={chipModel}
                            action={doNothing()}
                            uiIconAction={actions.removeFilterAction}
                            key={index}
                            chipCondition={chipCondition}>
                            { chipModel.children && chipModel.children.map( ( chipChildModel, childIndex ) => {
                                return (
                                    <AwChip
                                        chip={chipChildModel}
                                        action={doNothing()}
                                        uiIconAction={actions.removeFilterAction}
                                        key={childIndex}
                                        chipCondition={chipCondition}>
                                    </AwChip>
                                );
                            } )}
                        </AwChip>
                    );
                } )}
                {data.overflowConfig.overflownChips && data.overflowConfig.overflownChips.length > 0 &&
                    <div className={'sw-chip-overflowContainerPanel'} ref={chipOverflowPopup.reference}>
                        <AwButton
                            className={'sw-chip-overflowButtonPanel'}
                            action={openOverflow}
                            closeAction={closePopup}
                            buttonType='chromeless'
                            label= {data.displayOverflowButton}>
                            {data.displayOverflowButton}
                        </AwButton>
                        <AwPopup {...chipOverflowPopup.options}>
                            <div className={'aw-layout-flexbox sw-column aw-search-overflow ' + 'aw-widgets-overflow-chipListPanel'}>
                                { data.overflowConfig.overflownChips.map( ( chipModel, overflowIndex ) => {
                                    return (
                                        <AwChip
                                            chip={chipModel}
                                            action={doNothing()}
                                            uiIconAction={actions.removeFilterAction}
                                            key={overflowIndex}
                                            chipCondition={chipCondition}>
                                            { chipModel.children && chipModel.children.map( ( chipChildModel, childOverflowIndex ) => {
                                                return (
                                                    <AwChip
                                                        chip={chipChildModel}
                                                        action={doNothing()}
                                                        uiIconAction={actions.removeFilterAction}
                                                        key={childOverflowIndex}
                                                        chipCondition={chipCondition}>
                                                    </AwChip>
                                                );
                                            } )}
                                        </AwChip>
                                    );
                                } )}
                            </div>
                        </AwPopup>
                    </div>
                }
            </div>
        </div>
    );
};

export let buildSearchChips = ( searchFilterMap ) => {
    let chips = [];
    let filterMapExist = searchFilterMap && Object.keys( searchFilterMap ).length > 0;
    if ( filterMapExist ) {
        let parentChip;
        let appliedFilters = removeDuplicateDateFilters( searchFilterMap );
        _.forEach( Object.keys( appliedFilters ), async function( key ) {
            let typeN = key.split( '.' );
            let objectMeta = cmm.getType( typeN[0] );
            let category;

            // Check if the property exists in the object
            if ( objectMeta.propertyDescriptorsMap.hasOwnProperty( typeN[1] ) ) {
                category = objectMeta.propertyDescriptorsMap[typeN[1]];
            }

            // Only proceed if category is defined
            if ( category ) {
                switch ( appliedFilters[key].type ) {
                    case 'StringFilter':
                        parentChip = await getFilterParentChip( category, appliedFilters[key], 'StringFilter' );
                        break;
                    case 'NumericFilter':
                        parentChip = await getFilterParentChip( category, appliedFilters[key], 'NumericFilter' );
                        break;
                    case 'DateFilter':
                        parentChip = await getFilterParentChip( category, appliedFilters[key], 'DateFilter' );
                        break;
                    case 'RadioFilter':
                        parentChip = await getFilterParentChip( category, appliedFilters[key], 'RadioFilter' );
                        break;
                    case 'ObjectFilter':
                        parentChip = await getFilterParentChip( category, appliedFilters[key], 'ObjectFilter' );
                        break;
                }
            }

            // Check if parentChip is populated and add to chips
            if ( parentChip ) {
                chips.push( parentChip );
                parentChip = undefined;
            }
        } );
    }
    return chips;
};

/**
 * Returns active filters after removing repetitive date filters ie. year_week filters
 * @function removeDuplicateDateFilters
 * @param {Object} searchFilterMap current active filter map
 * @returns {Object} editedActiveFilters
 */
function removeDuplicateDateFilters( searchFilterMap ) {
    var editedAppliedFilters = {};
    _.forEach( Object.keys( searchFilterMap ), function( key ) {
        _.forEach( searchFilterMap[key], function( filter ) {
            let filterObj;
            let keyName = key;
            if( key.includes( '_0Z0_' ) ) {
                keyName = key.split( '_0Z0_' )[0];
                filterObj = {
                    name: keyName,
                    values: [ filter.stringDisplayValue ],
                    type: filter.searchFilterType
                };
            }
            //For DateFilter
            else if( filter.searchFilterType === 'DateFilter'  ) {
                let startDate = new Date( filter.startDateValue );
                let endDate = new Date( filter.endDateValue );
                let noStartDate = dateTimeService.isNullDate( startDate );
                let noEndDate = dateTimeService.isNullDate( endDate );
                let dateRangeString;
                if( noStartDate ) {
                    dateRangeString = 'To ' + dateTimeService.formatDate( new Date( endDate ) ).substring( 0, 11 );
                } else if( noEndDate ) {
                    dateRangeString = 'From ' +
                        dateTimeService.formatDate( new Date( startDate ) ).substring( 0, 11 );
                } else {
                    dateRangeString = dateTimeService.formatDate( new Date( startDate ) ).substring( 0, 11 ) +
                        ' - ' + dateTimeService.formatDate( new Date( endDate ) ).substring( 0, 11 );
                }
                filter.stringDisplayValue = dateRangeString;
                filterObj = {
                    name: key,
                    values: [ filter.stringDisplayValue ],
                    type: filter.searchFilterType
                };
            }
            //For NumericFilter
            else if( filter.searchFilterType === 'NumericFilter' ) {
                if( !filter.startNumericValue || !filter.endNumericValue ) {
                    filter.stringDisplayValue = filter.stringValue;
                } else {
                    filter.stringDisplayValue = filter.startNumericValue + 'To ' + filter.endNumericValue;
                }
                filterObj = {
                    name: key,
                    values: [ filter.stringDisplayValue ],
                    type: filter.searchFilterType
                };
            } else {
                filterObj = {
                    name: key,
                    values: [ filter.stringDisplayValue ],
                    type: filter.searchFilterType
                };
            }
            if( editedAppliedFilters[keyName] ) {
                editedAppliedFilters[keyName].values.push( filter.stringDisplayValue );
            } else if( filterObj ) {
                editedAppliedFilters[keyName] = filterObj;
            }
        } );
    } );
    return editedAppliedFilters;
}

/**
 * Returns a parent chip to build chips for addition to the display chips array
 * @function getFilterParentChip
 * @param {Object} category filterCategory
 * @param {Object} activeFilter current active filters
 * @param {Object} filterType filter type (Numeric, String, Radio)
 * @returns {Object} parentChip
 */
async function getFilterParentChip( category, activeFilter, filterType ) {
    if ( !category ) {
        // If category is undefined or null, return early
        return null;
    }

    var childrenChips = [];
    var parent;
    var categoryName = category.displayName;
    var filterDisplayName = activeFilter.values[0];

    if ( category.name === activeFilter.name.split( '.' )[1] ) {
        // Create initial chip. If multiple of the same category exist, create child chips
        var numberOfChips = activeFilter.values.length;

        if ( numberOfChips > 1 ) {
            for ( let k = 0; k < activeFilter.values.length; k++ ) {
                filterDisplayName = activeFilter.values[k];
                parent = false;
                let chipChild = createChip( parent, numberOfChips, categoryName, filterDisplayName, category.name, filterDisplayName, filterType, null );
                childrenChips.push( chipChild );
            }
        }

        parent = true;
        return createChip( parent, numberOfChips, categoryName, filterDisplayName, category.name, filterDisplayName, filterType, childrenChips );
    }

    return null;
}


/**
 * Creates the chip that will be added to the master chip list
 * @function createChip
 * @param {Object} parent If chip is a parent chip
 * @param {Object} numberOfChips if parent chip how many children chips exist
 * @param {Object} categoryName name of category
 * @param {Object} filterDisplayName display name of filter
 * @param {Object} internalCategoryName intenal category name
 * @param {Object} internalFilterName intenal filter name
 * @param {Object} filterType type of filter
 * @param {Object} childrenChips if parent this is children chips to display in group
 * @param {Object} defaultSelection default selection, this selection will not display remove button
 * @returns {Object} breadcrumbChip
 */
function createChip( parent, numberOfChips, categoryName, filterDisplayName, internalCategoryName, internalFilterName, filterType, childrenChips ) {
    let displayLabel;

    if ( numberOfChips > 1 && parent ) {
        displayLabel = categoryName + ': ' + numberOfChips + ' Selected';
        internalFilterName = 'parentChip';
    } else {
        displayLabel = categoryName + ': ' + filterDisplayName;
    }

    let breadcrumbChip = {
        uiIconId: '',
        chipType: 'BUTTON',
        selected: false,
        labelDisplayName: displayLabel,
        labelInternalCategoryName: internalCategoryName,
        labelInternalFilterName: internalFilterName,
        chipFilterType: filterType,
        className: 'aw-search-breadcrumb-chip'
    };

    if ( childrenChips && childrenChips.length > 1 ) {
        breadcrumbChip.children = childrenChips;
    }

    return breadcrumbChip;
}

const Rb0SegmentFilterChipsService = {
    attachResizeObserver,
    calculateOverflow,
    Rb0SegmentFilterChipsRenderFunction,
    buildSearchChips,
    doNothing
};
export default Rb0SegmentFilterChipsService;
