// Copyright (c) 2022 Siemens

/**
 * @module js/Awp0WorkflowDesignerGraphLegendManager
 */
import AwPromiseService from 'js/awPromiseService';
import soaSvc from 'soa/kernel/soaService';
import tcViewModelObjectSvc from 'js/tcViewModelObjectService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';
import legendSvc from 'js/graphLegendService';
import workflowUtils from 'js/Awp0WorkflowUtils';

/**
 * Define public API
 */
var exports = {};

var _legendData = null;

/**
 * Get the legend panel data
 * @param {String} viewName View name for legend panel need to be initialized
 * @returns {Promise} Promise obejct with legend data
 */
var _getLegendData = function( viewName ) {
    var deferred = AwPromiseService.instance.defer();

    var soaInput = {
        viewName: viewName
    };
    soaSvc.postUnchecked( 'Internal-AWS2-2014-11-Workflow', 'getWorkflowGraphLegend', soaInput ).then(
        function( response ) {
            // Process SOA response
            if( response.presentationRulesXML && response.presentationRulesXML.length > 0 ) {
                _legendData = JSON.parse( response.presentationRulesXML );
            }
            deferred.resolve( _legendData );
        },
        function( error ) {
            deferred.reject( error );
        } );

    return deferred.promise;
};

/**
 * Create list with all task template types that can be created
 * @param {Array} taskTemplateTypes Task template types list
 *
 * @returns {Array} Createable task template array
 */
var _populateTaskTemplateTypes = function( taskTemplateTypes ) {
    if( !taskTemplateTypes || taskTemplateTypes.length <= 0 ) {
        return;
    }
    var createTaskTemplateCategories = [];
    _.forEach( taskTemplateTypes.categories, function( category ) {
        if( category.isAuthorable ) {
            _.forEach( category.subCategories, function( subcategory ) {
                if( subcategory.isAuthorable ) {
                    createTaskTemplateCategories.push( subcategory );
                }
            } );
        }
    } );
    return createTaskTemplateCategories;
};

/**
 * Create list with all path types that can be created
 * @param {Array} relationTypes Path types list
 *
 * @returns {Array} Createable path array
 */
var _populateRelationTypes = function( relationTypes ) {
    if( !relationTypes || relationTypes.length <= 0 ) {
        return;
    }
    var createPathCategories = [];
    _.forEach( relationTypes.categories, function( category ) {
        if( category.isAuthorable ) {
            _.forEach( category.subCategories, function( subcategory ) {
                if( subcategory.isAuthorable ) {
                    createPathCategories.push( subcategory );
                }
            } );
        }
    } );
    return createPathCategories;
};

/**
 * Populate the task template and path related data from legend and set it
 * on legend object.
 * @param {Object} legend Legend object
 * @param {Object} legendView Legend view object for worklow designer
 */
var _populateLegendData = function( legend, legendView ) {
    if( !legendView ) {
        return;
    }
    var taskTemplateTypes = _.find( legendView.categoryTypes, {
        internalName: 'objects'
    } );

    var relationTypes = _.find( legendView.categoryTypes, {
        internalName: 'relations'
    } );

    var createTaskTemplateCategories = _populateTaskTemplateTypes( taskTemplateTypes );
    legend.createTaskTemplateCategories = createTaskTemplateCategories;
    var createPathCategories = _populateRelationTypes( relationTypes );
    legend.createPathCategories = createPathCategories;
    return legend;
};

export let setLegendData = function( ctx, data ) {
    if( data.legend ) {
        let legend = { ...data.legend };
        let legendData = {};
        if( data.presentationRulesData && data.presentationRulesData.length > 0 ) {
            legendData = JSON.parse( data.presentationRulesData );
        }
        if( legendSvc ) {
            legendSvc.initLegendViewsData( legendData );
            legend.legendViews = legendData.legendViews;
            var workflowDesignerView = _.find( legend.legendViews, {
                internalName: 'WorkflowDesigner'
            } );
            // Populate the legend data that will be used in legend panel
            legend = _populateLegendData( legend, workflowDesignerView );
        }
        return legend;
    }
};

/**
 * Initialize the category API on graph model. The APIs will be used to calculate legend count.
 *
 * @param {Object} graphModel the graph model object
 */
export let initGraphCategoryApi = function( graphModel ) {
    graphModel.categoryApi = {
        getNodeCategory: function( node ) {
            if( node && node.appData ) {
                return node.appData.category;
            }

            return null;
        },
        getEdgeCategory: function( edge ) {
            if( edge ) {
                return edge.category;
            }
            return null;
        },
        getGroupRelationCategory: function() {
            return 'Structure';
        }
    };
};

/**
 *
 * @param {String} iconPathArr path of the icon
 * @returns {String} name of the icon
 */
var getIconNameFromPath = function( iconPathArr ) {
    var iconPath = _.split( iconPathArr, '/' );
    var iconName = '';
    if( iconPath.length > 2 ) {
        var splitIconName = _.split( iconPath[ 2 ], '.' );
        if( splitIconName.length > 0 ) {
            iconName = splitIconName[ 0 ];
        }
    }
    return iconName;
};

/**
 * Create the view model obejct for input category and return from here so that it can be shown
 * on legend panel.
 * @param {Object} category Task template category object
 *
 * @returns {Object} Category view model object
 */
var _createLegendVMOObject = function( category, uid, iconFileName ) {
    var vmObject = tcViewModelObjectSvc.createViewModelObjectById( uid );
    vmObject.uid = uid;
    vmObject.type = category.internalName;

    var vmProp = uwPropertySvc.createViewModelProperty( 'title', 'title',
        'STRING', category.internalName, [ category.displayName ] );
    vmProp.dbValues = [ category.internalName ];
    vmProp.uiValues = [ category.displayName ];
    vmObject.props.title = vmProp;

    var iconProp = uwPropertySvc.createViewModelProperty( 'icon', 'icon',
        'STRING', iconFileName, [ iconFileName ] );
    vmProp.dbValues = iconFileName;
    vmProp.uiValues = iconFileName;
    vmObject.props.icon = iconProp;
    return vmObject;
};

/**
 * Based on input creatable task template types populate the template list
 * @param {Array} taskTemplateTypeCategories Relation types that need to be shown on legend panel
 *
 * @returns {Array} Task templates VMO object that need to be shown on legend panel
 */
export let populateTaskTemplateTypeCategories = function( taskTemplateTypeCategories ) {
    var taskTypeObjects = [];
    _.forEach( taskTemplateTypeCategories, function( taskTemplateCategory ) {
        if( taskTemplateCategory.uid ) {
            var findIndex = -1;
            //check if row exists for this task template type
            findIndex = _.findIndex( taskTypeObjects, function( vmRow ) {
                return vmRow.uid === taskTemplateCategory.uid;
            } );
            // If it's not exist then only create the task template
            if( findIndex === -1 ) {
                var iconURL = workflowUtils.getTaskFlowBasedIcon( null, taskTemplateCategory.internalName );
                var iconFileName = getIconNameFromPath( iconURL );
                // Check if file name is empty then use the default icon
                if( iconFileName === '' ) {
                    iconFileName = 'typeFlowTask48';
                }

                var vmoObject = _createLegendVMOObject( taskTemplateCategory, taskTemplateCategory.uid, iconFileName );
                if( vmoObject ) {
                    taskTypeObjects.push( vmoObject );
                }
            }
        }
    } );
    return taskTypeObjects;
};

/**
 * Based on input creatable relation types populate the relation list and set it on data object.
 * @param {Array} relationTypeCategories Relation types that need to be shown on legend panel
 *
 * @returns {Array} path types VMO object that need to be shown on legend panel
 */
export let populatePathTypeCategories = function( relationTypeCategories ) {
    var relationTypeObjects = [];
    _.forEach( relationTypeCategories, function( relationTypeCategory ) {
        if( relationTypeCategory.internalName ) {
            var findIndex = -1;
            //check if row exists for this relation type
            findIndex = _.findIndex( relationTypeObjects, function( vmRow ) {
                return vmRow.uid === relationTypeCategory.internalName;
            } );
            // If it's not exist then only create the relation type
            if( findIndex === -1 ) {
                var iconName = 'typeConnectionRevision48';
                if( relationTypeCategory.internalName === 'Fail' ) {
                    iconName = 'typeConnection48';
                }
                var vmoObject = _createLegendVMOObject( relationTypeCategory, relationTypeCategory.internalName, iconName );
                if( vmoObject ) {
                    relationTypeObjects.push( vmoObject );
                }
            }
        }
    } );
    return relationTypeObjects;
};

export default exports = {
    setLegendData,
    initGraphCategoryApi,
    populateTaskTemplateTypeCategories,
    populatePathTypeCategories
};
