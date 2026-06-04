import _ from 'lodash';
import _cmm from 'soa/kernel/clientMetaModel';
import awIconSvc from 'js/awIconService';
import AwWidget from 'viewmodel/AwWidgetViewModel';
import addObjectUtils from 'js/addObjectUtils';

/**
 * @param {props} props - props of the component
 * @return {string} override value
 */
export const getOverrideId = ( props ) => {
    const {
        overrideId
    } = props;
    return _.isUndefined( overrideId ) ? '' : overrideId;
};

/**
 * @param {props} props - props of the component
 * @return {string} included object types
 */
export const getListOfIncludeObjectTypes = ( props, data ) => {
    const {
        include
    } = props;

    const { preferredTypeTracker } = data;

    return preferredTypeTracker.dbValue ? preferredTypeTracker.dbValue : include;
};

/**
 * @param {props} props - props of the component
 * @return {string} load sub types
 */
export const getLoadSubTypes = ( props, data ) => {
    const {
        loadSubTypes
    } = props;

    const { preferredTypeTracker } = data;

    if( preferredTypeTracker && preferredTypeTracker.dbValue ) {
        return 'false';
    }
    return loadSubTypes === 'false' ? 'false' : 'true';
};

/**
 * @param {props} props - props of the component
 * @param {dataProvider} dataProvider - awTypeSelector dataProvider
 * @param {typeList} typeList - typeList generated from SOA response
 */
export const typeSelectorObjectsUpdated = function( props, dataProvider, typeList, data ) {
    const { autoSelectOnUniqueTypeTracker, preferredTypeTracker } = data;

    let newAutoSelectOnUniqueTypeTracker = { ...autoSelectOnUniqueTypeTracker };
    let newPreferredTypeTracker = { ...preferredTypeTracker };

    if( newAutoSelectOnUniqueTypeTracker.dbValue || newPreferredTypeTracker.dbValue ) {
        if( dataProvider.viewModelCollection.totalFound === 1 ) {
            if( typeList && typeList[ 0 ] ) {
                const lovEntry = typeList[ 0 ];
                props.setLovVal( { lovEntry, dataProvider }, '' );
            }

            dataProvider.selectionModel.setSelection(
                dataProvider.getViewModelCollection().getViewModelObject( 0 ), props );
        }

        // The autoSelectOnUniqueType is valid only first time types are loaded.
        if( newAutoSelectOnUniqueTypeTracker.dbValue ) {
            newAutoSelectOnUniqueTypeTracker.dbValue = false;
        }

        if( newPreferredTypeTracker.dbValue ) {
            // The preferred type is valid only first time you open the panel, when come back to types panel by clicking type( ex. Item )
            // on xrt, it should load the types panel.
            // if we do not delete the declViewModel.preferredType, it will come back to types panel and immediately navigate
            // to preferred type as we have not deleted.
            newPreferredTypeTracker.dbValue = undefined;
            // if( dataprovider.viewModelCollection.totalFound === 0 ) {
            //     dataprovider.action.inputData.searchInput.searchCriteria.loadSubTypes = props.loadSubTypes === false ? 'false' : 'true';
            //     dataprovider.action.inputData.searchInput.searchCriteria.listOfIncludeObjectTypes = props.include;
            //     dataprovider.initialize( props );
            // }
        }
    }

    return {
        autoSelectOnUniqueTypeTracker: newAutoSelectOnUniqueTypeTracker,
        preferredTypeTracker: newPreferredTypeTracker
    };
};

/**
 * Creates a tooltip for a List of Values (LOV) item, showing the display value and up to three levels of type hierarchy.
 *
 * @param {string} [displayValue=''] - The display value of the LOV item.
 * @param {Array} typeHierarchy - The type hierarchy of the LOV item.
 * @returns {string} The formatted tooltip string.
 */
const createDuplicateTooltip = function( displayValue, typeHierarchy ) {
    // Show only 3 levels of type hierarchy in the tooltip.
    let typeHierarchySubset = typeHierarchy?.length ? typeHierarchy.slice( 0, 3 ) : [];
    let typeDetails = typeHierarchySubset.length ? ' (' + typeHierarchySubset.join( ' > ' ) + ')' : '';
    return displayValue + typeDetails;
};

/**
 * Adds duplicate text indicators to a list of types by checking for duplicate display values.
 * If duplicates are found, it marks them and updates their descriptions and tooltips.
 *
 * @param {Array} nextTypeList - The list of new types to be added.
 * @param {Array} existingTypeList - The list of existing types.
 */
const addDuplicateText = function( nextTypeList, existingTypeList ) {
    let tempTypeList = _.concat( nextTypeList, existingTypeList );
    let groupedTypes = _.groupBy( tempTypeList, 'propDisplayValue' );
    for( let key in groupedTypes ) {
        if( groupedTypes[ key ].length > 1 ) {
            for( let lovEntry of groupedTypes[ key ] ) {
                let duplicateTooltip = createDuplicateTooltip( lovEntry.propDisplayValue, lovEntry.typeHierarchy );
                lovEntry.isDisplayDuplicate = true;
                lovEntry.propDisplayDescription = lovEntry.typeInternalName;
                lovEntry.valueTooltip = duplicateTooltip;
            }
        }
    }
};

export const convertTypesToLovEntries = function( response, existingTypeList, showDuplicateText, startIndex ) {
    if( response && response.searchResults && response.searchResults.length > 0 ) {
        let nextTypeList = response.searchResults.map( obj => {
            var typeHierarchy = [];
            if( obj ) {
                var type = _cmm.getType( obj.uid );
                if( type ) {
                    typeHierarchy = type.typeHierarchyArray;
                } else {
                    let typeName = obj.props.type_name.dbValue ? obj.props.type_name.dbValue : obj.props.type_name.dbValues[ 0 ];
                    typeHierarchy.push( typeName );
                    var parentTypes = obj.props.parent_types.dbValues;
                    for( var j in parentTypes ) {
                        // parentType is of form "TYPE::Item::Item::WorkspaceObject"
                        var arr = parentTypes[ j ].split( '::' );
                        typeHierarchy.push( arr[ 1 ] );
                    }
                }
            }

            let typeIcon = awIconSvc.getTypeIconFileUrlForTypeHierarchy( typeHierarchy );
            let typeInternalName = typeHierarchy[0] ? typeHierarchy[0] : '';
            let displayValue = obj.props.object_string.uiValues[ 0 ];
            let detailedTooltip = displayValue + ' (' + typeInternalName + ')';
            return {
                propInternalValue: obj.uid,
                propDisplayValue: displayValue,
                object: obj,
                iconSource: typeIcon,
                typeInternalName: typeInternalName,
                detailedTooltip: detailedTooltip,
                valueTooltip: showDuplicateText ? detailedTooltip : '',
                typeHierarchy: typeHierarchy
            };
        } );
        if ( showDuplicateText ) {
            // If we are reloading the types, we don't need to check with existingTypeList for duplicates.
            let existingTypeListForDuplicates = startIndex === 0 ? [] : existingTypeList;
            addDuplicateText( nextTypeList, existingTypeListForDuplicates );
        }
        return nextTypeList;
    }
    return [];
};

export const loadRecentTypes = async function( prop, data ) {
    const { maxRecentCount, include, overrideId } = prop;
    const { preferredChoices, selectedValueTracker } = data;
    let newPreferredChoices = undefined;

    let forceRefreshFlag = false;
    if( preferredChoices ) {
        forceRefreshFlag = selectedValueTracker.dbValue.length > 0 &&
            ( preferredChoices.length === 0 || preferredChoices[ 0 ].propDisplayValue !== selectedValueTracker.dbValue );
    }

    if( maxRecentCount > 0 && ( !preferredChoices || forceRefreshFlag ) ) {
        let newRecents = ( await addObjectUtils.getRecentUsedTypes( maxRecentCount, include !== undefined ? include : overrideId ) ).preferredChoices;
        newPreferredChoices = newRecents[ 0 ] === undefined ? [] : newRecents;
    }

    return { preferredChoices: newPreferredChoices ? newPreferredChoices : preferredChoices };
};

export const updateVmpFromProps = async function( props, data ) {
    const { autoSelectOnUniqueType, preferredType } = props;

    const { autoSelectOnUniqueTypeTracker, preferredTypeTracker } = data;

    let newAutoSelectOnUniqueTypeTracker = { ...autoSelectOnUniqueTypeTracker };
    let newPreferredTypeTracker = { ...preferredTypeTracker };
    if( autoSelectOnUniqueType || preferredType ) {
        newAutoSelectOnUniqueTypeTracker.dbValue = autoSelectOnUniqueType;
        newPreferredTypeTracker.dbValue = preferredType;
    }

    return {
        autoSelectOnUniqueTypeTracker: newAutoSelectOnUniqueTypeTracker,
        preferredTypeTracker: newPreferredTypeTracker
    };
};

export const validatePropsAndTriggerSoa = function( props, data, initializeSoaAction ) {
    const { autoSelectOnUniqueType, preferredType } = props;
    const { preferredTypeTracker } = data;
    if( autoSelectOnUniqueType || preferredType || preferredTypeTracker.dbValue ) {
        initializeSoaAction();
    }
};

export const getSearchInput = ( props, data ) => {
    let searchInput = {
        attributesToInflate: [ 'parent_types', 'type_name' ],
        internalPropertyName: '',
        maxToLoad: 25,
        maxToReturn: 25,
        providerName: 'Awp0TypeSearchProvider',
        searchCriteria: {
            typeSelectorId: getOverrideId( props ),
            listOfIncludeObjectTypes: getListOfIncludeObjectTypes( props, data ),
            loadSubTypes: getLoadSubTypes( props, data )
        },
        searchFilterFieldSortType: 'Alphabetical',
        searchFilterMap: {},
        searchSortCriteria: []
    };

    if( props.searchInput ) {
        searchInput = props.searchInput;
    }
    let searchVMP = props.__vmprop__();
    searchInput.searchCriteria.searchString = !_.isUndefined( searchVMP ) ? searchVMP.filterString : '';
    searchInput.searchCriteria.defaultType = searchInput.searchCriteria.searchString;
    searchInput.startIndex = data.dataProviders.awTypeSelector.startIndex;

    return searchInput;
};

export const checkAndOpenTypeSelector = ( props ) => {
    const { value, autoOpenOnMount, popupId } = props;
    let locator = '#' + popupId + ' .aw-panel-header input.sw-property-val';
    let element = document.querySelector( '#aw_toolsAndInfo .aw-panel-header input.sw-property-val' ) || document.querySelector( locator );
    if ( element && autoOpenOnMount === 'true' ) {
        if ( !value ) {
            element.click();
        } else {
            element.focus();
        }
    }
};

export const clearOutRecentUsedList = ( selectedValueTracker, preferredChoices, props )=>{
    let newSelectedValueTracker = { ...selectedValueTracker };
    let selectedValue = props.fielddata.uiValue;
    let listToReturn = preferredChoices;
    if( selectedValue && newSelectedValueTracker.dbValue !== selectedValue ) {
        newSelectedValueTracker.dbValue = selectedValue;
        listToReturn = undefined;
    }
    return {
        selectedValueTracker:newSelectedValueTracker,
        preferredChoices: listToReturn };
};

export const awTypeSelectorRenderFunction = ( props ) => {
    const {
        viewModel
    } = props;

    const {
        dataProviders
    } = viewModel;

    let fielddata = { ...props.fielddata };

    if( props && props.fielddata && dataProviders ) {
        fielddata.dataProvider = dataProviders.awTypeSelector;
    }

    let newProps = { ...props, fielddata };

    return <AwWidget {...newProps} ></AwWidget>;
};
