// Copyright (c) 2022 Siemens

/**
 * File for common configurator constants
 * @module js/pca0CommonConstants
 */
var exports = {};

/**
 * Cfg0ConfiguratorPerspective Policy Properties
 */
export let CFG0CONFIGURATORPERSPECTIVE_POLICY = {
    types: [ {
        name: 'Cfg0ConfiguratorPerspective',
        properties: [ {
            name: 'cfg0ProductItems'
        }, {
            name: 'cfg0RuleSetEffectivity'
        }, {
            name: 'cfg0RevisionRule'
        }, {
            name: 'cfg0RuleSetCompileDate'
        } ]
    } ]
};

/**
 * Common Grid Constants
 */
export let GRID_CONSTANTS = {
    CONSTRAINTS_GRID: 'constraintsGrid', // This one is common for top and bottom constrain grid dont use it until no options
    COMPACT_COLUMN_WIDTH: 50,
    MAX_COLUMN_WIDTH: 1000,
    BUSINESS_OBJECT_COLUMN_WIDTH: 50,
    MAX_SLIDER_COLUMN_WIDTH: 300,
    VARIABILITY_CONTENT_COLUMN_WIDTH: 250,
    DEFAULT_LOAD_VARIANTS_MAX_COUNT_IN_GRID: 10,
    DEFAULT_NEW_VARIANTS_MAX_COUNT_IN_GRID: 2
};

/**
 * Validation types
 */
export let EXPRESSION_VALIDATE = {
    VERBOSE_VALIDATE: 'verboseValidate',
    INITIAL_VALIDATE: 'initialValidate'
};

/**
 * Unconfigured Object Icons
 */
export let UNCONFIGURED_OBJECT_ICONS = {
    UNCONFIGURED_TYPE_FAMILY: 'typeUnknownFamily48.svg',
    UNCONFIGURED_TYPE_FEATURE: 'typeUnknownFeature48.svg'
};

/**
 * Cfg0FreeFormConstraint Policy Properties
 */
export let CFG0FREEFORMCONSTRAINT_POLICY = {
    types: [ {
        name: 'Cfg0AbsRule',
        properties: [ {
            name: 'cfg0ExpScript'
        } ]
    } ]
};

export default exports = {
    CFG0CONFIGURATORPERSPECTIVE_POLICY,
    GRID_CONSTANTS,
    EXPRESSION_VALIDATE,
    UNCONFIGURED_OBJECT_ICONS,
    CFG0FREEFORMCONSTRAINT_POLICY
};
