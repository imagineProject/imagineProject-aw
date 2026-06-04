// @<COPYRIGHT>@
// ==================================================
// Copyright 2021.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/pca0VariabilityExplorerConstants
 */
export const constants = {
    CLIENT_SCOPE_URI: {
        FEATURES: 'Pca0VariabilityExplorerFeatures',
        PRODUCTS: 'Pca0VariabilityExplorerProducts',
        VARIABILITY: 'Pca0VariabilityInConstraints',
        MODULES: 'Pca0VariabilityExplorerModules'
    },
    CFG_OBJECT_TYPES: {
        ABS_CONSTRAINT_RULE: 'Cfg0AbsConstraintRule',
        ABS_MATRIX_RULE: 'Cfg0AbsMatrixRule',
        ABS_AVAILABILITY_RULE: 'Cfg0AbsAvailabilityRule',
        ABS_EXCEPTION_RULE: 'Cfg0AbsExceptionRule',
        ABS_FREEFORM_RULE: 'Cfg0AbsFreeFormRule'
    },
    PCA_CONSTRAINT_GRID_SETTINGS_PREFERENCE: 'PCA_constraint_grid_settings',
    PCA_MULTISVR_GRID_SETTINGS_PREFERENCE: 'PCA_multiSVR_grid_settings',
    PCA_MATRIX_GRID_SETTINGS_PREFERENCE: 'PCA_matrix_grid_settings',
    PCA_WHERE_USED_SETTINGS_PREFERENCE: 'PCA_where_used_settings',
    CONFIG_CONTEXT_KEY: 'ConfiguratorCtx',
    CONFIG_CONTEXT_PERSPECTIVE_MAP: 'Pca0configCtxPerspectiveMap',
    CFG_WHERE_USED_SECTIONS_EXP_MAP: 'cfgWhereUsedSectionsExpMap',
    CONSTRAINTS_CONTEXT_KEY: 'ConstraintsCtx',
    CONSTRAINTS_EDITOR_SETTINGS: 'constraintsGridEditorSettings',
    MATRIX_EDITOR_SETTINGS: 'matrixGridEditorSettings',
    GRID_CONSTANTS: {
        CONSTRAINTS: 'Constraints',
        CONSTRAINTS_EDITOR_TREE_CONTEXT: 'CONSTRAINTS_EDITOR_TREE_CONTEXT',
        DEFAULT_SETTINGS: {
            SHOW_PROPERTIES_INFORMATION_IN_GRID: false,
            TOP_TABLE_HEIGHT: 40,
            USE_COMPACT_COLUMN_WIDTH: false,
            USE_VERTICAL_COLUMN_HEADER: false,
            COLUMN_WIDTH: 150,
            SHOW_SUBJECT_IN_TOP_GRID: true,
            USE_ALL_VARIABILITY_IN_GRID_EDITOR: false,
            SHOW_LEGEND: true,
            INCLUDE_SEVERITY_IN_COMPARISON: false
        },
        CONSTRAINTS_PROP_INFO_NODE_UID: '__Pca0_Constraints_Properties_Section__',
        CONSTRAINTS_PROP_INFO_NODES: {
            TYPE_NODE_UID: 'object_type'
        },
        CONSTRAINTS_SUBJECT_SECTION: 'subject',
        CONSTRAINTS_SUBJECT_NODE_UID: '__Pca0_Constraints_Subject_Section__',
        CONSTRAINTS_CONDITION_SECTION: 'condition',
        CONSTRAINTS_CONDITION_NODE_UID: '__Pca0_Constraints_Condition_Section__',
        PCA_GRID: 'pca0Grid',
        TOP_GRID: 'topGrid',
        BOTTOM_GRID: 'bottomGrid',
        PCA_GRID_DP: 'pca0GridTreeDataProvider',
        BOTTOM_CONSTRAINTS_GRID: 'bottomConstraintsGrid',
        BOTTOM_GRID_CONSTRAINTS_DP: 'bottomGridTreeDataProvider',
        MULTI_SVR_GRID: 'multiSvrGrid',
        MULTIPLE_VARIANTS_GRID:'multipleVariantsGrid',
        ACTION_EXPAND: 'expand',
        ACTION_COLLAPSE: 'collapse',
        MULTIPLE_SVR_GRID_ID: 'multipleVariantsConfigGrid'
    },
    FREEFORM_CONSTANTS : {
        FREEFORM_EDITOR_CONTEXT: 'FREEFORM_EDITOR_CONTEXT'
    },
    GRID_SETTINGS: {
        SHOW_PROPERTIES_INFORMATION_IN_GRID: 'showPropsInfoInGrid',
        SHOW_SUBJECT_IN_TOP_GRID: 'showSubjectInTopGrid',
        COLUMN_WIDTH: 'columnWidth',
        USE_ALL_VARIABILITY_IN_GRID_EDITOR: 'useAllVariabilityInGridEditor',
        SHOW_LEGEND: 'showLegend',
        USE_VERTICAL_COLUMN_HEADER: 'useVerticalColumnHeader',
        INCLUDE_SEVERITY_IN_COMPARISON: 'includeSeverityInComparison'
    },
    WHERE_USED_CONSTANTS:{
        DEFAULT_SETTINGS: {
            SHOW_ALL_REVISIONS: false,
            SHOW_DATA_FROM_ALL_CONTEXTS: true
        }
    },
    WHERE_USED_SETTINGS: {
        SHOW_ALL_REVISIONS: 'showAllRevisions',
        SHOW_DATA_FROM_ALL_CONTEXTS: 'showDataFromAllContexts',
        SECTION_SHOW_CONTEXTS: 'section_showContexts',
        SECTION_SHOW_CONSTRAINTS: 'section_showConstraints',
        SECTION_SHOW_VARIANTS: 'section_showVariants',
        SECTION_SHOW_LAYOUTSLOT_PREFIX: 'section_showLayoutSlot_'
    },
    MULTI_SVR_GRID_HEADER_CELL_NOTIFY: 'aw-cfg-multiSvrGridHeaderCellNotify',
    VARIANTS_EDITOR_TREE_CONTEXT: 'VARIANTS_EDITOR_TREE_CONTEXT',
    PCA_FEATURE_DISPOSITION_LOV_EDIT: 'PcaFeatureDispositionLovEdit',
    VARIANT_UIDS_FOR_COMPARE_REV : 'Pca0VariantUidsForCompareRev',
    SELECTED_OBJ_UIDS : 'Cfg0SelectedObjUids'
};

export default constants;
