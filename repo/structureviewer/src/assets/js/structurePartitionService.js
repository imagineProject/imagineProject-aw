// Copyright (c) 2024 Siemens

/**
 * @module js/structurePartitionService
 */
import _ from 'lodash';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import propPolicySvc from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import logger from 'js/logger';
import csidsToObjSvc from 'js/aceCsidsToObjectsConverterService';

var exports = {};
class StructurePartitionData {
    /**
     * StructurePartitionData constructor
     * @param {Object} topBomLineMO - Top bom line model object
     */
    constructor( topBomLineMO ) {
        if( _.isNull( topBomLineMO ) || _.isUndefined( topBomLineMO ) || _.isEmpty( topBomLineMO ) ) {
            logger.error( 'Top BOMLine ModelObject can not be null' );
            throw 'Top BOMLine ModelObject can not be null';
        }
        this.topBomLineMO = topBomLineMO;
        this.partitionsMap = new Map();
    }

    /**
     * Returns the ptn0PartitionScheme object for given top line
     * @param {Object} topBomLineMO top Bomline model object
     * @returns {Object} ptn0PartitionScheme object
     */
    getPartitionsHierarchy() {
        if( this.topBomLineMO && this.topBomLineMO.uid ) {
            this.partitionsMap.clear();
            return dms.getPropertiesUnchecked( [ this.topBomLineMO ], [ 'ptn0TopLevelPartitionLines' ] ).then( () => {
                let prtnTopLines = [];
                let topLineMO = cdm.getObject( this.topBomLineMO.uid );
                if( topLineMO.props && topLineMO.props.ptn0TopLevelPartitionLines ) {
                    if( Array.isArray( topLineMO.props.ptn0TopLevelPartitionLines.dbValues ) ) {
                        for( let i = 0; i < topLineMO.props.ptn0TopLevelPartitionLines.dbValues.length; i++ ) {
                            prtnTopLines.push( cdm.getObject( topLineMO.props.ptn0TopLevelPartitionLines.dbValues[ i ] ) );
                        }
                    }
                    if( prtnTopLines.length > 0 ) {
                        return this.getPartitionsHierarchyForFirstLevelPartitions( prtnTopLines );
                    }
                }
            } ).catch( error => {
                logger.error( 'Error while reading ptn0PartitionScheme property on top bomline : ' + error );
                return AwPromiseService.instance.reject( error );
            } );
        }

        return AwPromiseService.instance.reject( 'Invalid top bomline model object passed.' );
    }

    /**
     * Define the property policy for loading partitions data
     *
     * @returns {Object} property policy object
     */
    static getPartitionsPropertyPolicy() {
        return {
            types: [ {
                name: 'Ptn0PartitionScheme',
                properties: [ {
                    name: 'mdl0model_object',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    }, {
                        name: 'excludeUiValues',
                        Value: 'false'
                    } ]
                },
                {
                    name: 'object_name',
                    modifiers: [ {
                        name: 'excludeUiValues',
                        Value: 'false'
                    } ]
                }
                ]
            },
            {
                name: 'Ptn0Partition',
                properties: [ {
                    name: 'object_name'
                },
                {
                    name: 'ptn0Members',
                    modifiers: [ {
                        name: 'withProperties',
                        Value: 'true'
                    } ]
                }
                ]
            }

            ]
        };
    }

    /**
     * Expand partitions hierarchy
     * @param {Array} seedPartitions - Seed partitions model objects
     */
    getPartitionsHierarchyForFirstLevelPartitions( seedPartitions ) {
        const policyId = propPolicySvc.register( StructurePartitionData.getPartitionsPropertyPolicy() );
        const soaInput = {
            bomLines: seedPartitions,
            expandSettings: {
                maxLevel: [ '0' ]
            },
            pageSize: 2000
        };
        // Call SOA to start expansion of partitions structure
        const startExpandSOAStartTime = window.performance.now();
        return soaSvc.post( 'StructureManagement-2021-12-StructureSearch', 'startExpandBOMLines2', soaInput ).then( response => {
            const startExpandSOAEndTime = window.performance.now();
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            logger.info( 'Got first partitions response in  : ' + ( startExpandSOAEndTime - startExpandSOAStartTime ) / 1000 + ' s' );
            this.processPartitionsDataResponse( response );
        } ).catch( error => {
            logger.error( 'Error while calling startExpandBOMLines for partitions : ' + error );
        } );
    }

    /**
     * Expand product structure further for structure partitions
     *
     * @param {Object} currCursor current cursor object for fetching next set of results
     * @returns {Promise} A promise that is resolved after expand structure is completed
     */
    getNextPartitionsHierarchy( currCursor ) {
        const policyId = propPolicySvc.register( StructurePartitionData.getPartitionsPropertyPolicy() );
        const soaInput = {
            expandCursor: currCursor,
            pageSize: 2000
        };

        // Call SOA to get next set of expansion of structure
        const nextExpandSOAStartTime = window.performance.now();
        return soaSvc.post( 'StructureManagement-2021-12-StructureSearch', 'nextExpandBOMLines2', soaInput ).then( response => {
            const nextExpandSOAEndTime = window.performance.now();
            //UnRegister Policy
            if( policyId ) {
                propPolicySvc.unregister( policyId );
            }
            logger.info( 'Got next response in  : ' + ( nextExpandSOAEndTime - nextExpandSOAStartTime ) / 1000 + ' s' );
            this.processPartitionsDataResponse( response );
        } ).catch( error => {
            logger.error( 'Error while calling nextExpandBOMLines for partitions : ' + error );
        } );
    }

    /**
     * Process last response
     * @param {Object} response response object
     */
    processPartitionsDataResponse( response ) {
        logger.debug( 'Processing partitions response' );
        response.extraObjs.forEach( element => {
            let blUid = element.parentInfo.bomLine.uid;
            if( !this.partitionsMap.get( blUid ) ) {
                this.partitionsMap.set( blUid, [] );
                element.childrenInfo.forEach( child => {
                    this.partitionsMap.get( blUid ).push( child.bomLine );
                } );
                element.childrenInfo.forEach( child => {
                    this.processPartitionsChildDataResponse( child, response );
                } );
            }
        } );
        const isFinalResponse = response && response.expandCursor && response.expandCursor.type === 'unknownType';
        if( !isFinalResponse ) {
            this.getNextPartitionsHierarchy( response.expandCursor );
        } else {
            logger.info( 'Partitions hierarchy loading completed' );
        }
    }

    /**
     * Process last response
     * @param {Object} response response object
     */
    processPartitionsChildDataResponse( child, response ) {
        let blUid = child.bomLine.uid;
        for( let i = 0; i < response.extraObjs.length; i++ ) {
            if( response.extraObjs[ i ].parentInfo.bomLine.uid === blUid ) {
                if( !this.partitionsMap.get( blUid ) ) {
                    this.partitionsMap.set( blUid, [] );
                    response.extraObjs[ i ].childrenInfo.forEach( child => {
                        this.partitionsMap.get( blUid ).push( child.bomLine );
                    } );
                }
                response.extraObjs[ i ].childrenInfo.forEach( child => {
                    this.processPartitionsChildDataResponse( child, response );
                } );
            }
        }
    }

    /**
     * Get all partitions members under given PartitionLines
     * @param {Array} arrayOfPartitionLines Array of PartitionLines to be processed.
     */
    getAllPartitionsMembersUnderGivenPartitionLines( arrayOfPartitionLines ) {
        if( !Array.isArray( arrayOfPartitionLines ) && arrayOfPartitionLines.length < 1 ) {
            return AwPromiseService.instance.resolve();
        }
        let finalArrayOfPartition = [];
        for( let i = 0; i < arrayOfPartitionLines.length; i++ ) {
            finalArrayOfPartition.push( cdm.getObject( arrayOfPartitionLines[ i ].uid ) );
            this.getAllPartitionLineHierarchy( arrayOfPartitionLines[ i ], finalArrayOfPartition );
        }

        return dms.getPropertiesUnchecked( finalArrayOfPartition, [ 'ptn0Members' ] ).then( () => {
            let membersSRUidsArray = [];
            for( let i = 0; i < finalArrayOfPartition.length; i++ ) {
                if( finalArrayOfPartition[ i ] && finalArrayOfPartition[ i ].props && finalArrayOfPartition[ i ].props.ptn0Members &&
                    Array.isArray( finalArrayOfPartition[ i ].props.ptn0Members.dbValues ) ) {
                    membersSRUidsArray = [ ...membersSRUidsArray, ... finalArrayOfPartition[ i ].props.ptn0Members.dbValues  ];
                }
            }
            return csidsToObjSvc.doPerformSearchForProvidedSRUIDs( membersSRUidsArray, 'true' ).then( elementsResponse => {
                let returnSelectedMOs = [];
                if( elementsResponse && Array.isArray( elementsResponse.elementsInfo ) && elementsResponse.elementsInfo.length > 0 ) {
                    _.forEach( elementsResponse.elementsInfo, ( elementsInfo, index ) => {
                        returnSelectedMOs.push( elementsInfo.element );
                    } );
                }
                return returnSelectedMOs;
            } );
        } ).catch( error => {
            logger.error( 'Error while reading ptn0Members on given partition line : ' + error );
            return AwPromiseService.instance.reject( error );
        } );
    }

    /**
     * Get all partitions
     * @param {Ptn0PartitionLine} partitionLineMO Partition line.
     * @param {Array} finalArrayOfPartition Array of all partitions under given partition
     */
    getAllPartitionLineHierarchy( partitionLineMO, finalArrayOfPartition ) {
        let childPartitionsArray = this.partitionsMap.get( partitionLineMO.uid );
        if( Array.isArray( childPartitionsArray ) ) {
            for( let i = 0; i < childPartitionsArray.length; i++ ) {
                finalArrayOfPartition.push( childPartitionsArray[ i ] );
            }
            for( let i = 0; i < childPartitionsArray.length; i++ ) {
                this.getAllPartitionLineHierarchy( childPartitionsArray[ i ], finalArrayOfPartition );
            }
        }
    }
}

/**
 * Provides an instance of structure partition handler
 * @param {Object} topBomLineMO - Top bom line model object
 *
 * @return {StructurePartitionData} Returns Structure partitions data instance
 */
export let getPartitionsDataForTopLine = function( topBomLineMO ) {
    return new StructurePartitionData( topBomLineMO );
};

export default exports = {
    getPartitionsDataForTopLine
};
