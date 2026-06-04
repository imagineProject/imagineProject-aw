// Copyright (c) 2024 Siemens

// This file provides a way to control ModelObject's properties for various SOAs depending on
// the requirement from SOA. Default property policy would be overridden with below set of properties if
// below functions are called appropriatly with "override" as true. This is mainly done to avoid loading unwanted
// properties which takes lot of time as well increases the network payload.
// Below SOAs are taken care :
// 1. variantConfigurationView
// 2. getVariantExpressionData - does not add Cfg0ConfiguratorWSO objects to ModelObjects in SOA response hence no change is required.
// 3. getTableViewModelProperties
// 4. performSearchViewModel

/**
 * @module js/pca0PropertyPolicyService
 **/

/**
 * This function defines policy for Cfg0ConfiguratorWSO object which is derived from WorskpaceObject.
 * For Variant configuration view, we need only below mentioned properties.
 * @returns {Object} Returns the policy for variantConfigurationView3 SOA
 */
const _getPolicyForVariantConfigurationView = () => {
    return [ {
        name: 'WorkspaceObject',
        properties: [
            {
                name: 'release_status_list'
            },
            {
                name: 'object_name'
            },
            {
                name: 'object_string'
            },
            {
                name: 'is_modifiable'
            }
        ]
    },
    {
        name: 'BusinessObject',
        properties: [
            {
                name: 'awp0CellProperties'
            },
            {
                name: 'awp0ThumbnailImageTicket'
            }
        ]
    },
    {
        name: 'VariantRule',
        properties: [
            {
                name: 'fnd0objectId'
            }
        ]
    }
    ];
};

/**
 * This function defines policy for Cfg0ConfiguratorWSO object which is derived from WorskpaceObject.
 * We need only below mentioned properties for table view model properties
 * @returns {Object} Returns the policy for getTableViewModelProperties SOA
 */
const _getPolicyForGetTableViewModelProperties = () => {
    return [ {
        name: 'WorkspaceObject',
        properties: [
            {
                name: 'object_name'
            },
            {
                name: 'object_string'
            }
        ]
    }
    ];
};

/**
 * This function defines policy for Cfg0ConfiguratorWSO object which is derived from WorskpaceObject.
 * For PerformSearchViewModel ( Constraints and Variants Tab ) SOA, we DO NOT need any property apart from properties defined in Column configuration file.
 * @returns {Object} Returns the policy for performSearchViewModel SOA
 */
const _getPolicyForPerformSearchViewModel = () => {
    return [ {
        name: 'WorkspaceObject',
        properties: [
            {
                name: 'object_string'
            },
            {
                name: 'is_modifiable'
            }
        ]
    },
    {
        name: 'ReleaseStatus',
        properties: [
            { name: 'object_name' },
            { name: 'date_released' },
            { name: 'object_string' }
        ]
    }
    ];
};

/**
 * Retrieves the policy for module perspective properties.
 * This function is used to get the policy settings specific to module perspectives.
 * @returns {Object} The policy settings for module perspective properties.
 */
const _getPolicyForModulePrespectiveProperties = () => {
    return [ {
        name: 'Cfg0ConfiguratorPerspective',
        properties: [
            {
                name: 'cfg0ProductHierarchyDepth'
            },
            {
                name: 'cfg0RuleSetEffectivity'
            },
            {
                name: 'cfg0RevisionRule',
                modifiers: [
                    {
                        name: 'withProperties',
                        Value: 'true'
                    }
                ]
            }
        ]
    }
    ];
};


let exports = {};

/**
 * Helps to get the property policy for input SOA.
 * Example: getPolicyForVariantConfigurationView for soaName = "variantConfigurationView".
 * @param {Object} soaName Takes soa response as input
 * @returns {Array} List of VMOs
 */
export const getPropertyPolicyForInputSOA = ( soaName ) => {
    switch ( soaName ) {
        case 'variantConfigurationView':
            return _getPolicyForVariantConfigurationView();
        case 'getTableViewModelProperties':
            return _getPolicyForGetTableViewModelProperties();
        case 'performSearchViewModel':
            return _getPolicyForPerformSearchViewModel();
        case 'getModulePerspectiveProperties':
            return _getPolicyForModulePrespectiveProperties();
        default:
            return [];
    }
};

export default exports = {
    getPropertyPolicyForInputSOA
};
