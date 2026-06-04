// Copyright (c) 2022 Siemens

/**
 * @module js/Pca0Constants
 */
var exports = {};

export let FSC_CONTEXT = 'fscContext';
export let VCA_CONTEXT = 'variantConditionContext';
export let FORMULA_EDITOR_CONTEXT = 'FORMULA_EDIT_CONTEXT';
export let CUSTOM_CONFIGURATION = 'Custom Configuration';
export let PCA_VARIANTRULE_SAVEDQUERIES_PREFERENCE = 'PCA_VariantRule_SavedQueries';
//constant for Hosted-configurator mode
export let HOSTED_CONFIGURATOR_MODE = 'isHostedPCAMode';

// REFER aliasRegistry to get actual name of svg for respective class
export let CFG_OBJECT_TYPES = {
    TYPE_REVISION: 'Cfg0AbsLiteralOptionValue',
    TYPE_PRODUCT_MODEL: 'Cfg0AbsProductModel',
    TYPE_LITERAL_FEATURE: 'Cfg0LiteralOptionValue',
    TYPE_UNCONFIGURE_OBJ: 'Cfg0UnconfiguredObject',
    TYPE_MODEL_FAMILY_GRP_REVISION: '__Fsc_Products_Group__',
    TYPE_FAMILY_GRP_REVISION: '__Fsc_Unassigned_Group__',
    TYPE_PROD_MODEL_REVISION: 'Cfg0ProductModel',
    TYPE_VARIANT_RULE: 'VariantRule',
    TYPE_MISSING: 'Cfg0MissingImg',
    TYPE_PRODUCT_ITEM: 'Cfg0ProductItem',
    TYPE_DICTIONARY: 'Cfg0Dictionary',
    TYPE_FAMILY_GROUP: 'Cfg0FamilyGroup',
    TYPE_LITERAL_VALUE_FAMILY: 'Cfg0LiteralValueFamily',
    ABS_PRODUCT_MODEL_FAMILY: 'Cfg0AbsProductModelFamily',
    PRODUCT_MODEL_FAMILY: 'Cfg0ProductModelFamily',
    ABS_SUMMARY_MODEL_FAMILY: 'Cfg0AbsSummaryModelFamily',
    SUMMARY_MODEL_FAMILY: 'Cfg0SummaryModelFamily',
    ABS_SUMMARY_MODEL: 'Cfg0AbsSummaryModel',
    SUMMARY_MODEL: 'Cfg0SummaryModel',
    ABS_PRODUCT_LINE_FAMILY: 'Cfg0AbsProductLineFamily',
    PRODUCT_LINE_FAMILY: 'Cfg0ProductLineFamily',
    ABS_PRODUCT_LINE: 'Cfg0AbsProductLine',
    PRODUCT_LINE: 'Cfg0ProductLine',
    ABS_LITERAL_VALUE_FAMILY: 'Cfg0AbsLiteralValueFamily',
    ABS_FAMILY_GROUP: 'Cfg0AbsFamilyGroup',
    ABS_PACKAGE_OPTION_FAMILY: 'Cfg0AbsPackageOptionFamily',
    ABS_SUMMARY_OPTION_FAMILY: 'Cfg0AbsSummaryOptionFamily',
    ABS_PACKAGE_OPTION_VALUE: 'Cfg0AbsPackageOptionValue',
    PACKAGE_OPTION_VALUE: 'Cfg0PackageOptionValue',
    ABS_SUMMARY_OPTION_VALUE: 'Cfg0AbsSummaryOptionValue',
    SUMMARY_OPTION_VALUE: 'Cfg0SummaryOptionValue',
    FEATURE: 'Cfg0Feature',
    ABS_FEATURE: 'Cfg0AbsFeature',
    ABS_FEATURE_FAMILY: 'Cfg0AbsFeatureFamily',
    CONF_CONTEXT: 'Cfg0ConfContext',
    CONFIGURATION_MODULE: 'Cfg0ConfigurationModule',
    ABS_CONFIGURATION_MODULE: 'Cfg0AbsConfigurationModule',
    ABS_FAMILY: 'Cfg0AbsFamily'
};

export let VARIANT_CONFIG_MODES = {
    MANUAL_MODE: 'manual',
    GUIDED_MODE: 'guided'
};

export let CFG_ICONS = {
    SVG_BLANK: 'cmdBlankIcon24.svg'
};

export let CONFIG_PERSPECTIVE_PROPS = {
    REVISION_RULE: 'cfg0RevisionRule'
};

export let CFG_INDICATOR_ICONS = {
    SVG_INDICATOR_ERROR: 'indicatorError16.svg', // we dont keep indicator in aliasRegistry
    SVG_INDICATOR_ATTENTION: 'indicatorNeedsAttention16.svg', // we dont keep indicator in aliasRegistry
    SVG_INDICATOR_INFO: 'indicatorInfo16.svg', // we dont keep indicator in aliasRegistry
    SVG_INDICATOR_NOT: 'indicatorExcluded16.svg', // NOT icon in Variability Trees
    SVG_INDICATOR_TICK: 'indicatorApprovedPass16.svg', // TICK icon in Variability Trees
    SVG_UNCONFIGURE_OBJ: 'typeUnconfiguredObject48.svg', // added to use icon name as it is
    SVG_INDICATOR_DEFAULT_NEGATIVE_SELECTION: 'indicatorExcludeDefaultSelection16.svg', // Default Negative selection icon
    SVG_INDICATOR_DEFAULT_POSITIVE_SELECTION: 'indicatorIncludeDefaultSelection16.svg', // Default Positive selection icon
    SVG_INDICATOR_SYSTEM_NEGATIVE_SELECTION: 'indicatorSystemExclude16.svg', // System Negative selection icon
    SVG_INDICATOR_SYSTEM_POSITIVE_SELECTION: 'indicatorSystemApprovedPass16.svg', // System Positive selection icon
    SVG_INDICATOR_CONFIGURED_OUT: 'indicatorConfiguredOut16.svg', // ConfiguredOut
    SVG_INDICATOR_USER_INCLUDE_RADIO: 'indicatorUserIncludeRadio16.svg',
    SVG_INDICATOR_SYSTEM_EXCLUDE_CHECKBOX: 'indicatorSystemExcludeCheckbox16.svg',
    SVG_INDICATOR_SYSTEM_INCLUDE_CHECKBOX: 'indicatorSystemIncludeCheckbox16.svg',
    SVG_INDICATOR_SYSTEM_INCLUDE_RADIO: 'indicatorSystemIncludeRadio16.svg',
    SVG_INDICATOR_USER_EXCLUDE_CHECKBOX: 'indicatorUserExcludeCheckbox16.svg',
    SVG_INDICATOR_USER_INCLUDE_CHECKBOX: 'indicatorUserIncludeCheckbox16.svg',
    SVG_INDICATOR_BLANK_RADIO: 'indicatorBlankRadio16.svg',
    SVG_INDICATOR_DEFAULT_EXCLUDE_CHECKBOX: 'indicatorDefaultExcludeCheckbox16.svg',
    SVG_INDICATOR_DEFAULT_INCLUDE_CHECKBOX: 'indicatorDefaultIncludeCheckbox16.svg',
    SVG_INDICATOR_DEFAULT_INCLUDE_RADIO: 'indicatorDefaultIncludeRadio16.svg',
    SVG_INDICATOR_BLANK_CHECKBOX: 'indicatorBlankCheckbox16.svg'
};

export let EXPRESSION_TYPES = {
    USER_DEFINED_SELECTION: 48,
    VARIANT_CONDITION: 23,
    SUBJECT_EXPRESSION: 44,
    CONDITION_EXPRESSION: 25,
    EXPRESSION_SCRIPT: 56,
    VARIANT_EXPRESSION: 18
};

export let FAMILY_VALUE_TYPES = [
    'Integer',
    'Floating Point',
    'Date',
    'String',
    'Boolean'
];

// Constant for psuedo groups uid
export let PSEUDO_GROUPS_UID = {
    PRODUCTS_GROUP_UID: '__Fsc_Products_Group__',
    UNASSIGNED_GROUP_UID: '__Fsc_Unassigned_Group__'
};

export let SEARCH_CRITERIA = {
    FEATURE: 'Feature',
    EXPRESSION: 'Expression'
};

export let IS_VARIANT_TREE_IN_EDIT_MODE = 'isVariantTableEditing';
export let SPLIT_COLUMN_DELIMITER = '#split#';
export let REQ_TYPE_INITIAL_VALIDATION = 'initialValidation';

export let TABLE_CONTEXT = 'TABLE_CONTEXT';
export let VARIANT_FSC_CONTEXT = 'VARIANT_FSC_CONTEXT';

export let GRID_DISPLAY_MODE = {
    CURRENT: 'current',
    FAMILIES: 'families',
    FEATURES: 'features',
    CURRENT_FAMILIES :'current_families'
};

export let VARIABILITY_BROWSING_GRID_VIEW = {
    MODELS: 'models',
    FEATURES: 'features',
    CONSTRAINTS: 'constraints',
    VARIANTS: 'variants'
};

export let GRID_EDIT_OPERATION = {
    START: 'start',
    CANCEL: 'cancel',
    SAVE_COMPLETE: 'saveComplete'
};

export let GRID_CONSTANTS = {
    SOURCE_TYPE: 'sourceType',
    TREE_CONTAINER_KEY: 'variabilityTreeData',
    VARIANT_TREE_CONTEXT: 'VARIANT_TREE_CONTEXT',
    VARIANT_CONDITION: 'variantConditionAuthoringGrid',
    VARIANT_CONFIGURATION: 'variantConfigurationGrid'
};

export let CFG_FAMILY_TYPES = [
    /*Product Model family*/
    'Cfg0ProductModelFamily', 'Cfg0AbsProductModelFamily',
    /*Product Line family*/
    'Cfg0ProductLineFamily', 'Cfg0AbsProductLineFamily',
    /*Summary Model family*/
    'Cfg0SummaryModelFamily', 'Cfg0AbsSummaryModelFamily',
    'Cfg0AbsModelFamily',
    /*Literal Option Family*/
    'Cfg0AbsOptionFamily', 'Cfg0AbsFamily', 'Cfg0LiteralValueFamily', 'Cfg0AbsLiteralValueFamily', 'Cfg0SummaryOptionFamily',
    /*Dynamic Family*/
    'Cfg0AbsFeatureFamily'
];

export let CFG_FAMILY_FEATURES_TYPES = [ 'Cfg0AbsFamily', // Literal Value Family
    'Cfg0AbsValue', // Literal Optional Value, Summary Optional Value, Product Model Optional Value
    'Cfg0AbsFeature', // Standalone Feature
    'Cfg0AbsFeatureFamily' // Dynamic Family
];

export let PROPERTY_NAMES = {
    CFG_OPTION_VALUES: 'cfg0OptionValues',
    CFG_MODELS: 'cfg0Models',
    CFG_FAMILY_THREADS: 'cfg0FamilyThreads',
    CFG_FEATURE_THREADS: 'cfg0FeatureThreads',
    CFG_SUBJECT_CONDITION: 'cfg0SubjectCondition'
};

export let ERROR_SEVERITIES = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};
export let VARIABILITY_OPERATIONS = {
    PASTE: 'paste',
    DRAG_DROP_FAMILY: 'dragAndDropFamily',
    CUT: 'cut',
    REMOVEOPTYPE: 'removeOperationType',
    ADDOPTYPE: 'addOperationType'
};

export let SELECTION_TYPES = {
    USER_SELECTION: [ 1, 2 ],
    DEFAULT_SELECTION: [ 5, 6 ],
    SYSTEM_SELECTION: [ 9, 10 ]
};

export let SUMMARY_SELECTION_TYPES = {
    USER: 'User',
    DEFAULT: 'Default',
    SYSTEM: 'System',
    ALL: 'All'
};
export let OPERATOR_DISPLAY_STRINGS = 'pca0OperatorDisplayStrings';

export let FILTER_CONSTRAINTS = {
    FEATURES_FILTER_CATEGORY_INTERNAL_NAME: 'Cfg0AbsRule.features',
    CONSTRAINT_TYPE_FILTER_CATEGORY_INTERNAL_NAME: 'WorkspaceObject.object_type',
    UNREFERENCED_TYPE_FILTER_CATEGORY_INTERNAL_NAME: 'showUnreferencedConstraints'
};

// Copied from #define DEFAULT_MASK_VALUE_FOR_ALS "***"
export let DEFAULT_MASK_VALUE_WHEN_ACCESS_IS_DENIED = '***';

export let PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE = 'PCA_use_formula_suggester_intellisense';

export let AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY = 'aw-cfg-gridHeaderCellBackgroundHighlight';

export let CONTEXT_TO_PERSPECTIVE_MAP_KEY = 'moduleParentCtxToParentCtxPerspectiveMap';

export let CFG_FORMULA_SUGGESTER_ANCHOR = 'cfgFormulaSuggesterAnchor';

export let EDITABLE_PROPERTIES = [ 'cfg0ApplicabilityCondition', 'cfg0SubjectCondition', 'cfg0DefaultCondition', 'cfg0Condition' ];


export let CFG_FILTER_OPERATION_TYPE = {
    ANY: 'or',
    ALL: 'and'
};

// Maximum meta data properties to show on feature or family in list view. Need to update it if we decide to show more than 3.
export let MAX_META_DATA_PROPS_VCV_LIST_VIEW = 3;

export default exports = {
    FSC_CONTEXT,
    VCA_CONTEXT,
    FORMULA_EDITOR_CONTEXT,
    CUSTOM_CONFIGURATION,
    PCA_VARIANTRULE_SAVEDQUERIES_PREFERENCE,
    HOSTED_CONFIGURATOR_MODE,
    VARIANT_CONFIG_MODES,
    PSEUDO_GROUPS_UID,
    SEARCH_CRITERIA,
    IS_VARIANT_TREE_IN_EDIT_MODE,
    SPLIT_COLUMN_DELIMITER,
    REQ_TYPE_INITIAL_VALIDATION,
    TABLE_CONTEXT,
    VARIANT_FSC_CONTEXT,
    GRID_DISPLAY_MODE,
    VARIABILITY_BROWSING_GRID_VIEW,
    GRID_EDIT_OPERATION,
    GRID_CONSTANTS,
    FAMILY_VALUE_TYPES,
    CFG_OBJECT_TYPES,
    CFG_ICONS,
    CFG_INDICATOR_ICONS,
    CONFIG_PERSPECTIVE_PROPS,
    EXPRESSION_TYPES,
    CFG_FAMILY_TYPES,
    CFG_FAMILY_FEATURES_TYPES,
    PROPERTY_NAMES,
    ERROR_SEVERITIES,
    VARIABILITY_OPERATIONS,
    SELECTION_TYPES,
    SUMMARY_SELECTION_TYPES,
    OPERATOR_DISPLAY_STRINGS,
    FILTER_CONSTRAINTS,
    PCA_USE_SUGGESTER_INTELLISENSE_PREFERENCE,
    AW_CFG_GRID_HEADER_CELL_HIGHLIGHT_NOTIFY,
    DEFAULT_MASK_VALUE_WHEN_ACCESS_IS_DENIED,
    CFG_FILTER_OPERATION_TYPE,
    CFG_FORMULA_SUGGESTER_ANCHOR,
    CONTEXT_TO_PERSPECTIVE_MAP_KEY,
    EDITABLE_PROPERTIES,
    MAX_META_DATA_PROPS_VCV_LIST_VIEW
};
