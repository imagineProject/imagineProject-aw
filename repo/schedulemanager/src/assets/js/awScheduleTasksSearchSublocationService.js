// Copyright (c) 2021 Siemens 
// Copyright 2021 Siemens Product Lifecycle Management Software Inc.

import AwStateService from 'js/awStateService';

/**
 * build custom search criteria from URL
 * @returns search criteria
 */
export const getSearchCriteriaFromURL = ()=>{
    let searchCriteria;
    if( AwStateService.instance.params.team ) {
        searchCriteria = {
            team : AwStateService.instance.params.team
        };
    }
    return searchCriteria;
};

export default {
    getSearchCriteriaFromURL
};
