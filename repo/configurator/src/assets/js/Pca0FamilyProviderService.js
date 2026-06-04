// Copyright (c) 2024 Siemens

/**
 * File for handling of families.
 *
 * @module js/Pca0FamilyProviderService
 */

// COMPONENT IMPORTS
import Pca0Family from 'viewmodel/Pca0FamilyViewModel';
import Pca0FscValue from 'viewmodel/Pca0FscValueViewModel';

//LIB IMPORTS
import eventBus from 'js/eventBus';
import _ from 'lodash';

//THIS VARIABLE IS ADDED TO SAVE FROM RE_RENDERING
let scrollToVariability = false;

// Class created to handle intersection observer with dom elements
export class ElementObserver {
    constructor( elementRef, callback ) {
        this.elementRef = elementRef;
        this.callback = callback;
        this.observer = null;
    }

    observe( elementRef ) {
        this.elementRef = elementRef;
        this.observer && this.observer.observe( this.elementRef );
    }

    disconnect() {
        this.elementRef = null;
        this.observer && this.observer.disconnect();
    }

    // We can set the observer in constructor but due to limitation of and dependancy of jest
    // stoping use of intersection observer in constructor as its not known object for jest
    setObserver() {
        if ( _.isNil( this.observer ) ) {
            this.observer = new IntersectionObserver( this.callback, { root: this.elementRef, rootMargin: '0px', threshold: 0.25 } );
        }
    }
}

const nextObserver = new ElementObserver( null, ( entries ) => {
    if ( entries[0].isIntersecting ) {
        _.debounce( () => {
            eventBus.publish( 'pca0FeaturesScroll.loadNextVariability' );
        }, 50 )();
    }
} );

const prevObserver = new ElementObserver( null, ( entries ) => {
    if ( entries[0].isIntersecting ) {
        _.debounce( () => {
            eventBus.publish( 'pca0FeaturesScroll.loadPreviousVariability' );
        }, 50 )();
    }
} );

//////// local utility function ///////
/**
 * Filters the given array of families based on the provided filter string.
 *
 * @param {string} filterString - The filter string to apply.
 * @param {Array} families - The array of families to filter.
 * @returns {Array} - The filtered array of families.
 */
const _getFilteredFamilies = ( filterString, families ) => {
    const filteredFamilies = [];
    const wildRegexPattern =  filterString.replace( /[%*]/ig, '.*' );
    for( let familyIndex = 0; familyIndex < families.length; familyIndex++ ) {
        const family = families[ familyIndex ];
        const familyRegex = new RegExp( wildRegexPattern, 'ig' );
        if( familyRegex.test( family.familyDisplayName ) ) {
            // If family is filtered then all values are filtered
            filteredFamilies.push( family );
        } else if( family.values && family.values.length > 0 ) {
            // If family is not filtered then check if any value is filtered
            const filteredValues = [];
            for( let valueIndex = 0; valueIndex < family.values.length; valueIndex++ ) {
                const value = family.values[ valueIndex ];
                const valueRegex = new RegExp( wildRegexPattern, 'ig' );
                // value has meta field, contains the array of string for description
                // Joining those strings to check if any of them matches the filter string
                if( valueRegex.test( value.optValue.cellHeader1 ) || valueRegex.test( value?.meta?.join() ) ) {
                    filteredValues.push( value );
                }
            }
            if( filteredValues.length > 0 ) {
                filteredFamilies.push( {
                    ...family,
                    values: filteredValues
                } );
            }
        }
    }
    return filteredFamilies;
};

/**
 * Converts family data into a list format, optionally filtering the families based on a filter string.
 *
 * @param {Array} families - The array of family objects to be converted.
 * @param {string} filterString - The string used to filter the families. If not provided, no filtering is applied.
 * @param {string} collapsedFamilyData - The family name that is manually collapsed. ( when the user collapse family )
 * @param {Array} prevVariabilityList - The previous list of families and values.
 * @param {Array} userExpandedFamilies - The list of user expanded families.
 * @param {Array} systemExpandedFamilies - The list of system expanded families.
 * @returns {Array} - A list of family objects and their values, excluding the 'values' property from the family objects.
 */
const _convertFamilyDataToList = ( families, filterString, collapsedFamilyData, prevVariabilityList, userExpandedFamilies, systemExpandedFamilies ) => {
    const variabilityList = [];
    if ( filterString ) {
        families = _getFilteredFamilies( filterString, families );
    }
    let expandedFamilies = [];
    let keepTrackOfExpandedFamily = false;
    if ( collapsedFamilyData && collapsedFamilyData.caption !== '' ) {
        keepTrackOfExpandedFamily = true;
    }
    // For group change user expanded families will be empty only system expanded families will be there if cross probing or next and previous case
    // So, to keep the state of the expanded families we are merging system expanded families with user expanded families
    if ( userExpandedFamilies && !_.isEmpty( userExpandedFamilies ) && systemExpandedFamilies && !_.isEmpty( systemExpandedFamilies ) ) {
        expandedFamilies = [ ...userExpandedFamilies, ...systemExpandedFamilies ];
        expandedFamilies = [ ...new Set( expandedFamilies ) ];
    } else if ( userExpandedFamilies && !_.isEmpty( userExpandedFamilies ) ) {
        expandedFamilies = userExpandedFamilies;
    }

    families.forEach( ( family ) => {
        let allowValues = false;
        if ( collapsedFamilyData && ( collapsedFamilyData.caption === family.familyDisplayName || collapsedFamilyData.caption === family.familyDisplayName + ',' ) ) {
            // When user is manually collapsing or expanding the family
            allowValues = !collapsedFamilyData.isCollapsed;
            family.isCollapsed = collapsedFamilyData.isCollapsed;
            if ( allowValues && expandedFamilies ) {
                expandedFamilies.push( family.alternateID );
            } else if ( expandedFamilies && expandedFamilies.length > 0 && expandedFamilies.includes( family.alternateID ) ) {
                expandedFamilies.splice( expandedFamilies.indexOf( family.alternateID ), 1 );
            }
        } else if( keepTrackOfExpandedFamily ) {
            // Keep track for the expanded families when user is manually collapsing or expanding the family for the present group only
            allowValues = !family.isCollapsed;
            allowValues && !expandedFamilies.includes( family.alternateID ) && expandedFamilies.push( family.alternateID );
        } else if( expandedFamilies && expandedFamilies.length > 0 ) {
            allowValues =  expandedFamilies.includes( family.alternateID );
            family.isCollapsed = !allowValues;
        } else if( systemExpandedFamilies && systemExpandedFamilies.length > 0 ) {
            allowValues =  systemExpandedFamilies.includes( family.alternateID );
            family.isCollapsed = !allowValues;
        } else {
            allowValues = !family.isCollapsed;
        }
        const newLength = variabilityList.push( { ...family } );
        delete variabilityList[ newLength - 1 ].values;
        if( family.values && family.values.length > 0 && allowValues ) {
            family.values.forEach( ( value ) => {
                variabilityList.push( value );
            } );
        }
    } );
    userExpandedFamilies = expandedFamilies;
    return { variabilityList, userExpandedFamilies };
};

/**
 * Generates a family component with specific properties and context.
 *
 * @param {Object} familyNode - The family node object containing properties for the component.
 * @returns {JSX.Element} The family component.
 */
const _getFamilyComponent = ( familyNode ) => {
    const famIndex = familyNode.famIndex;
    const configuid = familyNode.familyCmdContext.configPerspectiveUid;
    const dialogAction = {};
    return (
        <Pca0Family famIndex={famIndex} family={familyNode} configuid={configuid} key={familyNode.familyStr} dialogAction={dialogAction}></Pca0Family>
    );
};

/**
 * Generates a Pca0FscValue component with appropriate classes based on the value's position in the familyNode.
 *
 * @param {Object} valueNode - The node representing the value.
 * @param {Object} familyNode - The node representing the family, which contains the values.
 * @param {string} keyValue - The key value for the value.
 * @param {Object} itemRef - The reference to the first item in the list.
 * @param {Object} textViewSettings - VCV text view settings.
 * @returns {JSX.Element} A Pca0FscValue component with the appropriate classes and properties.
 */
const _getValueComponent = ( valueNode, familyNode, keyValue, itemRef, textViewSettings ) => {
    if( !familyNode ) {
        return null;
    }
    const isLastValue = familyNode.values && familyNode.values.length - 1 === valueNode.featureIndex;
    const appliedClass = isLastValue ? 'aw-cfg-lastValue afx-content-background' : 'afx-content-background';
    return (
        <Pca0FscValue value={{ ...valueNode }}
            className={appliedClass}
            family={familyNode}
            variantcontext='fscContext'
            valueaction='selectFeature'
            keyValue={keyValue}
            textsettings={textViewSettings}
            itemRef={itemRef}></Pca0FscValue>
    );
};

/**
 * Handles the initial cursor setup for the first-time load.
 * @param {Array} variabilityList - The array of variability families.
 * @param {number} pageSize - The number of items to display per page.
 * @param {number} startIndex - The starting index for the cursor.
 * @returns {Object} cursorObject - The initialized cursor object.
 */
const _initializeCursor = ( variabilityList, pageSize, startIndex ) => {
    return {
        startIndex: startIndex,
        startReached: true,
        endIndex: variabilityList.length < startIndex + pageSize ? variabilityList.length : startIndex + pageSize,
        endReached: variabilityList.length <= startIndex + pageSize
    };
};

/**
 * Handles the cursor setup for the "next" page.
 * @param {Array} variabilityList - The array of variability families.
 * @param {number} pageSize - The number of items to display per page.
 * @param {Object} oldCursor - The current cursor object containing the previous start and end indices.
 * @returns {Object} cursorObject - The updated cursor object for the next page.
 */
const _setupNextCursor = ( variabilityList, pageSize, oldCursor ) => {
    const currentWindowSize = oldCursor.endIndex - oldCursor.startIndex;
    let newStartIndex = oldCursor.startIndex;
    let newEndIndex = oldCursor.endIndex + pageSize;

    // Cap endIndex to list length
    if ( newEndIndex > variabilityList.length ) {
        newEndIndex = variabilityList.length;
    }

    // If current window is less than 2*pageSize, just extend (0→30 becomes 0→60)
    // Otherwise, slide the window forward (0→60 becomes 30→90)
    if ( currentWindowSize >= pageSize * 2 ) {
        newStartIndex = oldCursor.endIndex - pageSize;
        if ( newStartIndex < 0 ) {
            newStartIndex = 0;
        }
    }

    return {
        startIndex: newStartIndex,
        endIndex: newEndIndex
    };
};

/**
 * Handles the cursor setup for the "previous" page.
 * @param {Object} oldCursor - The current cursor object containing the previous start and end indices.
 * @param {number} pageSize - The number of items to display per page.
 * @returns {Object} cursorObject - The updated cursor object for the previous page.
 */
const _setupPreviousCursor = ( oldCursor, pageSize ) => {
    const currentWindowSize = oldCursor.endIndex - oldCursor.startIndex;
    let newStartIndex = oldCursor.startIndex - pageSize;
    let newEndIndex = oldCursor.endIndex;

    // Cap startIndex to 0
    if ( newStartIndex < 0 ) {
        newStartIndex = 0;
    }

    // If current window is less than 2*pageSize, just extend backward
    // Otherwise, slide the window backward
    if ( currentWindowSize >= pageSize * 2 ) {
        newEndIndex = oldCursor.startIndex + pageSize;
    }

    return {
        startIndex: newStartIndex,
        endIndex: newEndIndex
    };
};

/**
 * Populates the family data and cursor object based on the given parameters.
 *
 * @param {Array} variabilityList - The array of families.
 * @param {number} pageSize - The size of each page.
 * @param {object} oldCursor - The old cursor object.
 * @param {string} pageTo - The direction of the next page ('next' or 'previous').
 * @param {number} [startIndex=0] - The start index for loading families.
 * @param {Array} [loadedVariability] - The loaded families.
 * @param {boolean} [isFamilySelection] - Flag indicating if the selection is a family.
 * @returns {object} - An object containing the loaded families and the updated cursor object.
 */
const _populateFamilyDataAndCursorObject = ( variabilityList, pageSize, oldCursor, pageTo, startIndex = 0, loadedVariability, isFamilySelection ) => {
    let cursorObject = {};
    let variabilityToLoad = loadedVariability ? loadedVariability : [];
    if( _.isNil( oldCursor ) || _.isEmpty( oldCursor ) && startIndex === 0 ) {
        //This is first time load of group families
        cursorObject = _initializeCursor( variabilityList, pageSize, startIndex );
    } else if( pageTo === 'next' ) {
        cursorObject = _setupNextCursor( variabilityList, pageSize, oldCursor );
    } else if( pageTo === 'previous' ) {
        cursorObject = _setupPreviousCursor( oldCursor, pageSize );
    } else {
        if ( oldCursor && oldCursor.startIndex <= startIndex && oldCursor.endIndex >= startIndex ) {
            // This is the case when we are loading the families based on changed variability.
            // E.g. selection changed in feature within the cursor range.
            cursorObject = {
                startIndex: oldCursor.startIndex,
                endIndex: oldCursor.endIndex,
                isFamilySelection: isFamilySelection
            };
        } else {
            // We are here means we want to load the variability as per given index.
            cursorObject = {
                startIndex: startIndex - pageSize,
                endIndex: startIndex + pageSize,
                isFamilySelection: isFamilySelection
            };
        }
        if ( cursorObject.endIndex === cursorObject.startIndex ) {
            cursorObject.startIndex = cursorObject.endIndex - pageSize;
        }
        // When filtering, end index is set to the number of matched results.
        // If the filter is cleared, it should update to the new page size otherwise the old end index may cause incorrect pagination.
        if ( startIndex === 0 && cursorObject.endIndex < pageSize && cursorObject.endIndex < variabilityList.length ) {
            cursorObject.endIndex = pageSize;
        }
    }
    if( cursorObject.startIndex < 0 ) {
        cursorObject.startIndex = 0;
        cursorObject.endIndex = variabilityList.length < pageSize ? variabilityList.length : pageSize;
    }
    if( cursorObject.endIndex > variabilityList.length ) {
        cursorObject.endIndex = variabilityList.length;
        cursorObject.startIndex = variabilityList.length - pageSize < 0 ? 0 : variabilityList.length - pageSize;
    }
    // If total list length is less than or equal to pageSize * 2, load everything
    // But only apply this on initial load (when pageTo is empty), not during pagination
    if ( variabilityList.length <= pageSize * 2 && pageTo === '' ) {
        cursorObject.startIndex = 0;
        cursorObject.endIndex = variabilityList.length;
    }

    if ( pageTo === 'next' ) {
        // Slice the data based on the new cursor range
        variabilityToLoad = variabilityList.slice( cursorObject.startIndex, cursorObject.endIndex );

        cursorObject.startReached = cursorObject.startIndex === 0;
        cursorObject.endReached = cursorObject.endIndex >= variabilityList.length;
        cursorObject.pageTo = 'next';
    } else if ( pageTo === 'previous' ) {
        // Slice the data based on the new cursor range
        variabilityToLoad = variabilityList.slice( cursorObject.startIndex, cursorObject.endIndex );

        cursorObject.startReached = cursorObject.startIndex === 0;
        cursorObject.endReached = cursorObject.endIndex >= variabilityList.length;
        cursorObject.pageTo = 'previous';
    } else {
        variabilityToLoad = [];
        variabilityToLoad = variabilityList.slice( cursorObject.startIndex, cursorObject.endIndex );
        cursorObject.startReached = cursorObject.startIndex === 0;
        cursorObject.endReached = cursorObject.endIndex >= variabilityList.length;
        cursorObject.pageTo = '';
    }
    cursorObject.pageNumber = cursorObject.startIndex / pageSize + 1;
    return { variabilityToLoad, cursorObject };
};

/**
 * Renders the variability based on the provided properties.
 * @param {Array} variabilityToLoad - The list of variability items to load.
 * @param {Array} families - The list of family objects.
 * @param {Object} firstItemRef - The reference to the first item in the list.
 * @param {Object} textSettings - The text settings for the VCV.
 * @param {Object} middleItemRef - The reference to the middle item in the list.
 * @param {Number} pageSize - The page size for pagination.
 * @returns {Array} - The rendered variability list.
 */
const _renderVariability = ( variabilityToLoad, families, firstItemRef, textSettings, middleItemRef, pageSize ) => {
    const variabilityList = [];
    let featureList = [];
    let itemRef = null; // this can be used to keep the reference of the 15th and middle item
    variabilityToLoad.map( ( item, index ) => {
        itemRef = null;
        if ( index === 0 && !_.isNil( firstItemRef ) ) {
            itemRef = firstItemRef;
        } else if ( index === pageSize && !_.isNil( middleItemRef ) ) {
            itemRef = middleItemRef;
        }
        let keyValue = item.alternateID;
        const element = !item.isFeature ? _getFamilyComponent( item ) : _getValueComponent( item, families[item.familyIndex], keyValue, itemRef, textSettings );

        if( !item.isFeature ) {
            if( featureList.length > 0 ) {
                variabilityList.push( <div className='aw-cfg-featuresData' key={item.famIndex}>{featureList}</div> );
                featureList = [];
            }
            variabilityList.push( <div ref={itemRef} key={keyValue} id={keyValue}>{element}</div> );
        } else if( element ) {
            featureList.push( element );
        }
    } );
    if( featureList.length > 0 ) {
        variabilityList.push( <div className='aw-cfg-featuresData' key={ 'dummy_' + featureList.length}>{featureList}</div> );
        featureList = [];
    }
    return variabilityList;
};

let exports = {};
/**
 * Gets the family data based on the provided parameters.
 * @param {Object} cursor - The data provider for the families.
 * @param {Number} pageSize - Page size to show the families.
 * @param {Array} families - The complete array of families coming from server( FOR NEXT AND PREVIOUS ITS AS CALCULATED).
 * @param {String} pageTo - The direction of the next page ('next' or 'previous').
 * @param {String} currentGroup - Name of the current group.
 * @param {String} previousGroup - Name of the previous group.
 * @param {String} newFamilyUid - The new family uid.
 * @param {String} oldFamilyUid - The old family uid.
 * @param {Array} loadedVariability - The loaded families.
 * @param {String} filterString - The filter string to apply.
 * @param {Array} userExpandedFamiliesList - The list of user expanded families.
 * @param {Array} systemExpandedFamilies - The list of system expanded families.
 * @param {Map} elementRefList - A map of element references.
 * @returns {Object} - An object containing the loaded families and the updated cursor object.
 */
export const getFamilyData = ( cursor, pageSize, families, pageTo, currentGroup, previousGroup, newFamilyUid, oldFamilyUid, loadedVariability, filterString,
    userExpandedFamiliesList, systemExpandedFamilies, elementRefList ) => {
    if( currentGroup !== previousGroup ) {
        userExpandedFamiliesList = [];
        cursor = {};
    }
    let result = {};
    let userExpandedFamilies = [];
    let variabilityList = [];
    if( pageTo === 'next' || pageTo === 'previous' ) {
        variabilityList = families;
        userExpandedFamilies = userExpandedFamiliesList;
        result = _populateFamilyDataAndCursorObject( variabilityList, pageSize, cursor, pageTo, null, loadedVariability );
    } else {
        ( { variabilityList, userExpandedFamilies } = _convertFamilyDataToList( families, filterString, null, null, userExpandedFamiliesList, systemExpandedFamilies ) );
        let startIndex = 0;
        let isFamilySelection = false;
        if ( newFamilyUid !== oldFamilyUid ) {
            startIndex = variabilityList.findIndex( node => node.alternateID === newFamilyUid || node.optValueStr === newFamilyUid );
            if ( startIndex === -1 ) {
                startIndex = 0;
            } else {
                isFamilySelection = !variabilityList[ startIndex ].isFeature;
            }
        }

        if ( newFamilyUid === oldFamilyUid && cursor ) {
            startIndex = cursor.startIndex;
        }
        result = _populateFamilyDataAndCursorObject( variabilityList, pageSize, cursor, null, startIndex, null, isFamilySelection );
        if ( loadedVariability && ( loadedVariability[0].isCollapsed || loadedVariability[0].isCollapsed !== result.variabilityToLoad[0].isCollapsed ) ) {
            scrollToVariability = true;
        } else {
            scrollToVariability = false;
        }
    }
    if ( !result.loadedCount ) {
        result.loadedCount = result.variabilityToLoad.length + '/' + variabilityList.length;
    }
    result.moveToFamilyUid = newFamilyUid;
    result.groupName = currentGroup;
    result.variabilityList = variabilityList;
    result.elementRefList = elementRefList;
    result.userExpandedFamilies = userExpandedFamilies;
    return result;
};

/**
 * Retrieves filtered family data, this function should be get called only on group change.
 * This function only gets called when group is changed.
 * @param {string} filterString - The filter string to apply.
 * @param {any} cursorObject - The family provider object.
 * @param {number} pageSize - The page size for pagination.
 * @param {Array} families - The array of families.
 * @param {string} currentGroup - The current group.
 * @param {string} previousGroup - The previous group.
 * @param {string} newFamilyUid - The new family uid.
 * @param {string} oldFamilyUid - The old family uid.
 * @param {Map} elementRefList - A map of element references
 * @returns {Object} - The filtered family data object.
 */
export const loadInitialFamilies = ( filterString, cursorObject, pageSize, families, currentGroup, previousGroup, newFamilyUid, oldFamilyUid, elementRefList ) => {
    const result = exports.getFamilyData( cursorObject, pageSize, families, '', currentGroup, previousGroup, newFamilyUid, oldFamilyUid, null, filterString, [], [], elementRefList );
    result.loadedCount = result.variabilityToLoad.length + '/' + result.variabilityList.length;
    result.groupName = currentGroup;
    return { ...result, pageSize, userExpandedFamiliesList: [], elementRefList };
};

/**
 * Updates the scroll position based on the provided parameters.
 * @param {Object} refElemts - The reference elements.
 * @param {String} objectToScroll - uid of the object to scroll it can be feature or family.
 * @param {Object} cursor - The current loaded variability information.
 * @param {String} oldFamilyUid - The old family uid.
 */
export const setScrollPosition = ( refElemts, objectToScroll, cursor ) => {
    if( refElemts && objectToScroll && cursor.pageTo === '' ) {
        const parentElement = refElemts.get( 'Pca0Variability' );
        let found = false;
        const el = parentElement.current;

        if ( cursor.pageTo === '' && scrollToVariability ) {
            [ ...el.childNodes ].forEach( ( child ) => {
                if( !found && child.id === objectToScroll ) {
                    nextObserver.disconnect();
                    prevObserver.disconnect();
                    // center the element is required to save from previous scroll event
                    child.scrollIntoView( { behavior: 'auto', block: 'center' } );
                    found = true;
                    scrollToVariability = false;
                    exports.setIntersectionObserver( refElemts, cursor );
                }
            } );
        } else {
            // When users add filters, we need to reset the scroll position
            _.debounce( () => {
                nextObserver.disconnect();
                prevObserver.disconnect();
                exports.setIntersectionObserver( refElemts, cursor );
            }, 50 )();
        }
    } else if( refElemts ) {
        // We are here means we are loading the next or previous page so we need to scroll to the middle of the page to show last visible item while scrolling.
        _.debounce( () => {
            nextObserver.disconnect();
            prevObserver.disconnect();
            const middleItemRef = refElemts.get( 'Pca0VariabilityMiddleLoader' );
            if ( middleItemRef.current ) {
                middleItemRef.current.scrollIntoView( { behavior: 'instant', block: 'center' } );
            }
            exports.setIntersectionObserver( refElemts, cursor );
        }, 50 )();
    }
};


/**
 * Loads filter families based on the provided parameters.
 *
 * @param {string} filterString - The string used to filter the families.
 * @param {Object} cursorObject - The cursor object for pagination.
 * @param {number} pageSize - The number of items per page.
 * @param {Array} families - The array of families to be loaded.
 * @param {Object} currentGroup - The current group context.
 * @param {Object} previousGroup - The previous group context.
 * @returns {Promise} A promise that resolves when the families are loaded.
 */
export const loadFilterFamilies = ( filterString, cursorObject, pageSize, families, currentGroup, previousGroup ) => {
    return loadInitialFamilies( filterString, cursorObject, pageSize, families, currentGroup, previousGroup );
};


/**
 * Sets up IntersectionObservers to handle infinite scrolling for a list of elements.
 * Observers are created to detect when the user has scrolled to the top or bottom of the list,
 * triggering events to load the previous or next set of items.
 * @param {Map} elementRefList - Map containing references to list elements.
 * @param {Object} cursor - Object containing pagination information.
 * @param {IntersectionObserver} prevObserver - IntersectionObserver for detecting previous page load.
 * @param {IntersectionObserver} nextObserver - IntersectionObserver for detecting next page load.
 */
export const setIntersectionObserver = ( elementRefList, cursor ) => {
    nextObserver.setObserver();
    prevObserver.setObserver();
    if( elementRefList ) {
        const firstListItem = elementRefList.get( 'Pca0VariabilityPreviousLoader' ); // for previous page handling
        const lastListItem = elementRefList.get( 'Pca0VariabilityNextLoader' ); // for next page handling

        if ( lastListItem.current && !cursor.endReached ) {
            nextObserver.observe( lastListItem.current );
        }

        if ( firstListItem.current && !cursor.startReached ) {
            prevObserver.observe( firstListItem.current );
        }
    }
};

/**
 * Renders the variability list based on the provided properties.
 *
 * @param {Object} props - The properties object.
 * @param {Object} props.viewModel - The view model containing data for rendering.
 * @param {Object} props.viewModel.data - The data object within the view model.
 * @param {Array} props.viewModel.data.variabilityToLoad - The list of variability items to load.
 * @param {boolean} props.viewModel.data.isLoading - Flag indicating if data is currently loading.
 * @param {Object} props.viewModel.data.cursor - The cursor object for pagination.
 * @param {boolean} props.viewModel.data.cursor.startReached - Flag indicating if the start of the list is reached.
 * @param {boolean} props.viewModel.data.cursor.endReached - Flag indicating if the end of the list is reached.
 * @param {Array} props.families - The list of family objects.
 * @param {Map} props.elementRefList - A map of element references.
 * @returns {JSX.Element} The rendered variability list component.
 */
export const pca0VariabilityRenderFunction = ( props ) => {
    const { viewModel, families, elementRefList, viewSettings } = props;
    const { variabilityToLoad, isLoading, cursor, pageSize } = viewModel.data;
    if( _.isUndefined( variabilityToLoad ) ) {
        return <></>;
    }
    const lastItemRef = !isLoading && !cursor.endReached ? elementRefList.get( 'Pca0VariabilityNextLoader' ) : null;
    const firstItemRef = !isLoading && !cursor.startReached ? elementRefList.get( 'Pca0VariabilityPreviousLoader' ) : null;
    const middleItemRef = !isLoading && !cursor.startReached && !cursor.endReached ? elementRefList.get( 'Pca0VariabilityMiddleLoader' ) : null;
    return (
        <div>
            <div ref={elementRefList.get( 'Pca0Variability' )}>
                { _renderVariability( variabilityToLoad, families, firstItemRef, viewSettings, middleItemRef, pageSize ) }

                { !cursor.endReached && <div className='aw-cfg-lastItem' ref={lastItemRef}/>}
            </div>
        </div>
    );
};

/**
 * Update structure as per collapse or expand of family
 * @param {Object} eventData contains { isCollapsed - true or false, caption - familyName }
 * @param {List} variabilityListData - list of all families and values like [ family, value, value2, family2, value3, value4 ]
 * @param {Object} cursor - cursor object
 * @param {Array} userExpandedFamiliesList - Uid of the expanded families.
 * @param {Array} systemExpandedFamilies - Uid of the system expanded families.
 * @param {Object} families - list of families containts values
 * @param {Number} pageSize - page size
 * @returns {List} returns new list of families and values to load like if family is collapsed then remove all values of that family
 * and if family is expanded then add all values of that family
 * e.g. [ family, value, value2, family2, value3, value4 ] => [ family, family2, value3, value4 ]
 */
export const updateVariabilityWhenCollapseOrExpand = ( eventData, variabilityListData, cursor, userExpandedFamiliesList, systemExpandedFamilies, families, pageSize ) => {
    const { variabilityList, userExpandedFamilies } = _convertFamilyDataToList( families, '', eventData, variabilityListData, userExpandedFamiliesList, systemExpandedFamilies );
    let result =  _populateFamilyDataAndCursorObject( variabilityList, pageSize, cursor, '', cursor.startIndex );
    return { newVariabilityToLoad: result.variabilityToLoad, newVariabilityList: variabilityList, newCursor: result.cursorObject, userExpandedFamilies };
};

/**
 * Removes the provided IntersectionObservers by disconnecting them.
 *
 * @param {IntersectionObserver} prevObserver - The previous IntersectionObserver to be disconnected.
 * @param {IntersectionObserver} nextObserver - The next IntersectionObserver to be disconnected.
 */
export const removeIntersectionObserver = ( ) => {
    if ( prevObserver ) {
        prevObserver.disconnect();
    }
    if ( nextObserver ) {
        nextObserver.disconnect();
    }
};

export default exports = {
    getFamilyData,
    loadInitialFamilies,
    setScrollPosition,
    loadFilterFamilies,
    pca0VariabilityRenderFunction,
    updateVariabilityWhenCollapseOrExpand,
    setIntersectionObserver,
    removeIntersectionObserver,
    ElementObserver
};
