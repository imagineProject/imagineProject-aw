import { LOVData, PropMetaData } from 'js/LOVData';
import _ from 'lodash';
const LOV_TYPES = { EXHAUSTIVE_LOV: 1, SUGGESTIVE_LOV: 2, RANGE_LOV: 3 };

export default class AwLovData extends LOVData {
    constructor( response ) {
        super();
        this.initialLovResp = response;
    }

    setLOVUsage( lovUsage, lovTypes ) {
        let usage = null;
        for ( const type in lovTypes ) {
            if ( lovTypes.hasOwnProperty( type ) && lovTypes[type] === lovUsage ) {
                usage = type;
                break;
            }
        }
        this.lovUsage = usage;
    }
    //value prop and desc prop are special coming from the server
    getColumnValueAndDescProps( columnNames ) {
        let valueProp_IntName = columnNames.lovValueProp;
        let valueProp_DispName = columnNames.displayNames[valueProp_IntName];

        let descProp_IntName = columnNames.lovDescrProp;
        let descProp_DispName = columnNames.displayNames[descProp_IntName];

        let valuePropDetails = new PropMetaData( valueProp_IntName, valueProp_DispName );
        let descPropDetails = new PropMetaData( descProp_IntName, descProp_DispName );

        super.setValuePropData( valuePropDetails );
        super.setDescPropData( descPropDetails );
    }

    setFilterProps( filterProps, displayNames ) {
        let fitlerPropDetails = [];
        if ( !_.isNil( filterProps ) ) {
            for ( let filterProp of filterProps ) {
                let filterPropDetail = new PropMetaData( filterProp, displayNames[filterProp] );
                fitlerPropDetails.push( filterPropDetail );
            }
        }
        this.filterProps = _.isNil( filterProps ) ? [] : fitlerPropDetails;
    }

    setlovRows( lovRows ) {
        this.lovRows = lovRows;
    }

    processIntialLovReponse() {
        this.getColumnValueAndDescProps( this.initialLovResp.behaviorData.columnNames );
        this.setFilterProps( this.initialLovResp.behaviorData.columnNames.filterProperties, this.initialLovResp.behaviorData.columnNames.displayNames );
        this.setlovRows( this.initialLovResp.lovValues );
        let lovUsage = this.initialLovResp.behaviorData.lovUsage;
        this.setLOVUsage( lovUsage, LOV_TYPES );
    }

    getLovColumns() {
        let lovColumns = [ ];
        if ( !_.isEmpty( this.getValueProp().getInternalName() ) ) {
            lovColumns.push( this.getValueProp() );
        }
        if ( !_.isEmpty( this.getDescProp().getInternalName() ) ) {
            lovColumns.push( this.getDescProp() );
        }

        return lovColumns.concat( this.filterProps );
    }

    getLovRows() {
        return this.lovRows;
    }

    // eslint-disable-next-line class-methods-use-this
    getLovType() {
        return 'STRING';
    }

    getRowDisplValue( lovRow ) {
        let rowDispVal = '';
        if ( this.getValueProp() !== null ) {
            rowDispVal = lovRow.propDisplayValues[this.getValueProp().getInternalName()][0];
        }
        return rowDispVal;
    }

    getRowInternalValue( lovRow ) {
        let rowIntVal = '';
        if ( this.getValueProp() !== null ) {
            rowIntVal = lovRow.propInternalValues[ this.getValueProp().getInternalName()][0];
        }
        return rowIntVal;
    }

    // eslint-disable-next-line class-methods-use-this
    getFilterProps() {
        return this.filterProps;
    }

    // eslint-disable-next-line class-methods-use-this
    getPropInternalValue( lovRow, propData ) {
        let internalPropName = propData.getInternalName();
        let internalVal = '';
        if ( lovRow?.propInternalValues?.[internalPropName] ) {
            internalVal = lovRow.propInternalValues[internalPropName][0];
        }
        return internalVal;
    }

    // eslint-disable-next-line class-methods-use-this
    getPropDispValue( lovRow, propData ) {
        let internalPropName = propData.getInternalName();
        let displayVal = '';
        if ( lovRow?.propDisplayValues?.[internalPropName] ) {
            displayVal = lovRow.propDisplayValues[internalPropName][0];
        }
        return displayVal;
    }
}

