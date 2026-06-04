// Copyright (c) 2022 Siemens

/**
 * @module js/xrtEditorUtilities
 */

import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';

let exports = {};

export const loadXRTFromContext = ( context ) => {
    let deferred = AwPromiseService.instance.defer();
    soaService.postUnchecked( 'Internal-AWS2-2016-03-DataManagement', 'getStyleSheet2', {
        processEntireXRT: false,
        input: [ {
            businessObject: context.modelObject,
            businessObjectType: context.objectType,
            styleSheetType: context.styleSheetType || 'SUMMARY',
            clientContext: context.clientContext
        } ]
    } ).then( function( response ) {
        deferred.resolve( response.output[ 0 ].context );
    }, function() {
        deferred.resolve();
    } );
    return deferred.promise;
};

export const loadXRT = ( businessObject, type, stylesheetType, preferenceLocation, client, location, sublocation ) => {
    let deferred = AwPromiseService.instance.defer();
    if( type.includes( '::' ) ) {
        type = type.split( '::' )[1];
    }
    let request = {
        businessObject: businessObject,
        type: type,
        stylesheetType: stylesheetType,
        preferenceLocation: preferenceLocation,
        client: client,
        location: location,
        sublocation: sublocation,
        datasetName: ''
    };

    soaService.postUnchecked( 'Internal-AWS2-2024-06-DataManagement', 'getUnprocessedXRT2', request ).then(
        function( response ) {
            deferred.resolve( response.dsInfo );
        },
        function() {
            deferred.resolve();
        } );

    return deferred.promise;
};

export const loadXRTOnNavigate = ( xrtEditorState, selectedDataset ) => {
    let deferred = AwPromiseService.instance.defer();
    let dsInfo = xrtEditorState.dsInfo;
    let stylesheetContext = dsInfo.stylesheetContext;
    var type = stylesheetContext.type;
    let businessObject = xrtEditorState.businessObject;
    let stylesheetType = stylesheetContext.stylesheetType;
    let preferenceLocation = stylesheetContext.preferenceLocation;
    let client = stylesheetContext.client;
    let sublocation = stylesheetContext.sublocation;
    let datasetName = selectedDataset;
    let location = stylesheetContext.location;
    if( type.includes( '::' ) ) {
        type = type.split( '::' )[1];
    }
    let request = {
        businessObject: businessObject,
        type: type,
        stylesheetType: stylesheetType,
        preferenceLocation: preferenceLocation,
        client: client,
        location: location,
        sublocation: sublocation,
        datasetName: datasetName
    };

    soaService.postUnchecked( 'Internal-AWS2-2024-06-DataManagement', 'getUnprocessedXRT2', request ).then(
        function( response ) {
            deferred.resolve( response.dsInfo );
        },
        function() {
            deferred.resolve();
        } );

    return deferred.promise;
};

export const fetchBreadCrumbNodes = ( selectedNode, crumbData, datasetName, xrtEditorTreeInfo, props ) => {
    let nodeName = selectedNode?.value.nodeName;
    let datasetNode = {};
    let index = -1;
    let dsNodesMap = new Map();
    let breadCrumb = {};
    if( props.xrtEditorState && props.xrtEditorState.updatedBreadcrumbs && props.xrtEditorState.updatedBreadcrumbs.length > 0 ) {
        crumbData = props.xrtEditorState.updatedBreadcrumbs;
        datasetName = props.xrtEditorState.updatedBreadcrumbs[ props.xrtEditorState.updatedBreadcrumbs.length - 1].originalName;
        breadCrumb = { crumbs: [ ...crumbData ] };
        return breadCrumb;
    }
    if( xrtEditorTreeInfo && xrtEditorTreeInfo.value && xrtEditorTreeInfo.value.length > 0 ) {
        if( xrtEditorTreeInfo.value[0].label === nodeName ) {
            nodeName = '';
        }
        for ( let i = 0; i < xrtEditorTreeInfo.value[0].children.length; i++ ) {
            dsNodesMap.set( xrtEditorTreeInfo.value[0].children[i].label, xrtEditorTreeInfo.value[0].children[i] );
        }
    }
    if( crumbData && crumbData.length > 0 ) {
        for( let i = 0; i < crumbData.length; i++ ) {
            if( crumbData[ i ].originalName === nodeName ) {
                //crumb click handling
                crumbData[ i ].selectedCrumb = true;
                crumbData[ i ].showArrow = false;
                crumbData[ i ].crumbTextBox = { ...props.crumbTextBox };
                if( crumbData[ i ].crumbTextBox.value && crumbData[ i ].crumbTextBox.value.nodeName && crumbData[ i ].crumbTextBox.value.nodeName !== '' ) {
                    if( crumbData.datasetName !== crumbData[ i ].crumbTextBox.value.nodeName ) {
                        crumbData.datasetName = crumbData[ i ].crumbTextBox.value.nodeName;
                    }
                }
                index = i;
                break;
            }
            crumbData[ i ].selectedCrumb = false;
            crumbData[ i ].showArrow = true;
            if( dsNodesMap.has( crumbData[ i ].displayName ) ) {
                crumbData.splice( i, 1 );
                i--;
            }
        }
    }

    if( index !== -1 ) {
        breadCrumb = { crumbs: crumbData.slice( 0, index + 1 ) };
        updateBreadcrumb( breadCrumb, props );
        return breadCrumb;
    }
    if( datasetName ) {
        datasetNode = {
            clicked: false,
            displayName: datasetName,
            originalName: datasetName,
            selectedCrumb: false,
            showArrow: true,
            xmlContent: props.xrtEditorState.dsInfo.xrt,
            dsInfo: props.xrtEditorState.dsInfo,
            onCrumbClick: ( crumb ) => onSelectCrumb( crumb, props )
        };
    }
    if( nodeName && nodeName !== '' ) {
        const crumbNode = {
            clicked: true,
            displayName: nodeName,
            originalName: nodeName,
            selectedCrumb: true,
            showArrow: false,
            xmlContent: props.xrtEditorState.xml,
            dsInfo: props.xrtEditorState.dsInfo,
            onCrumbClick: ( crumb ) => onSelectCrumb( crumb, props )
        };
        if( crumbData?.length > 0 ) {
            breadCrumb = { crumbs: [ ...crumbData, crumbNode ] };
            return breadCrumb;
        }
    }
    datasetNode.showArrow = false;
    datasetNode.selectedCrumb = true;
    datasetNode.crumbTextBox = { ...props.crumbTextBox };
    breadCrumb = { crumbs: [ datasetNode ] };
    return breadCrumb;
};

export const onSelectCrumb = async function( crumb, props ) {
    const { xrtEditorState } = props;
    const selectedDataset = crumb.originalName;
    loadXRTOnNavigate( xrtEditorState, selectedDataset ).then(
        function( dsInfo ) {
            const newXrtEditorState = { ...xrtEditorState.value };
            newXrtEditorState.dsInfo = dsInfo;
            newXrtEditorState.currLocation = selectedDataset;
            newXrtEditorState.xml = dsInfo.xrt !== '' ?  dsInfo.xrt : decodeURI( newXrtEditorState.defaultXrt );
            xrtEditorState.update && xrtEditorState.update( newXrtEditorState );

            const newselectedNodeName = { ...props.nodeName };
            newselectedNodeName.value.nodeName = crumb.originalName;
            props.nodeName.update( newselectedNodeName );
        }
    );
};

export const xrtEditorTreeNavigationHandler = ( nodeName, xmlContent ) => {
    if( nodeName.nodeName !== '' ) {
        return fetchTreeComponents( null, xmlContent );
    }
};

export const xrtEditorTreeNodeSelection = ( editor, lineNumber ) => {
    // let lineNum = parameters.eventData.node.lineNum;
    editor.getValue().revealLineNearTop( lineNumber );
};

export const fetchBreadcrumb = ( datasetName, nodeName ) => {
    let datasetNode = {};
    const newselectedNodeName = { ...nodeName };
    newselectedNodeName.value.nodeName = '';
    nodeName.update( newselectedNodeName );
    if( datasetName ) {
        datasetNode = {
            clicked: false,
            displayName: datasetName,
            originalName: datasetName,
            selectedCrumb: false,
            showArrow: false
        };
    }
    return { crumbs: [ datasetNode ] };
};

export const updateBreadcrumb = ( breadCrumb, props ) => {
    if( props && props.xrtEditorState && props.xrtEditorState.editingInProgress && props.crumbTextBox &&
        props.crumbTextBox.value && props.crumbTextBox.value.userName && props.crumbTextBox.value.groupName ) {
        if( breadCrumb && breadCrumb.crumbs ) {
            for( let i = 0; i < breadCrumb.crumbs.length; i++ ) {
                let appendUserName = '_' + props.crumbTextBox.value.userName;
                if( props.crumbTextBox.value.groupName !== 'dba' &&
                !breadCrumb.crumbs[ i ].originalName.includes( appendUserName ) ) {
                    breadCrumb.crumbs[ i ].displayName = breadCrumb.crumbs[ i ].originalName + appendUserName;
                }
            }
        }
    } else {
        for( let i = 0; i < breadCrumb.crumbs.length; i++ ) {
            breadCrumb.crumbs[ i ].displayName = breadCrumb.crumbs[ i ].originalName;
        }
    }
};

const calculateLines = function( xmlNode, lineNum ) {
    if( xmlNode.previousSibling && xmlNode.previousSibling.nodeName === '#comment' ) {
        let linesToAdd = xmlNode.previousSibling.textContent.split( /\r\n|\r|\n/ ).length;
        return linesToAdd + calculateLines( xmlNode.previousSibling, lineNum );
    }
    return lineNum;
};

export const fetchTreeComponents = ( dsInfo, xmlContent ) => {
    let xrtDoc = new DOMParser().parseFromString( xmlContent, 'text/xml' );
    const xmlTreeData = new XRTNode( xrtDoc.documentElement, dsInfo, 2 );
    const processedTreeData = [];
    if( xmlTreeData.children.length > 0 ) {
        for( const child of xmlTreeData.children ) {
            if( child.children.length > 0 ) {
                child.expanded = true;
            }
            processedTreeData.push( child );
        }
        return processedTreeData;
    }
    return [ xmlTreeData ];
};

let newLineNum;

const XRTNode = function( xmlNode, dsInfo, lineNum ) {
    xmlNode.normalize();
    this.type = '';
    this.children = [];
    this.attributes = [];
    this.enableAdd = false;
    this.enableDelete = false;
    this.enableCellCommand = false;

    this.type = xmlNode.nodeName;
    let commentedLines = calculateLines( xmlNode, 0 );
    newLineNum = lineNum + commentedLines;

    this.lineNum = newLineNum;
    newLineNum += 1;

    if( xmlNode.attributes ) {
        for( var ii = 0; ii < xmlNode.attributes.length; ii++ ) {
            this.attributes.push( new XRTNodeAttr( xmlNode.attributes[ ii ] ) );
        }
    }

    if( this.type === 'inject' && dsInfo ) {
        if( this.attributes[0].value === 'dataset' ) {
            let injDatasetName = this.attributes[1].value;
            if( dsInfo.injectedByDatasetName[injDatasetName] ) {
                let xmlAttr = {
                    name: 'xmlContent',
                    value: dsInfo.injectedByDatasetName[ injDatasetName ].xml
                };
                this.attributes.push( new XRTNodeAttr( xmlAttr ) );
                this.enableCellCommand = true;
            }
        } else if( this.attributes[0].value === 'preference' && dsInfo.injectedByPreference ) {
            let injectedPreference = this.attributes[1].value;
            if( dsInfo.injectedByPreference[injectedPreference] ) {
                let xmlAttr = {
                    name: 'xmlContent',
                    value: dsInfo.injectedByPreference[ injectedPreference ].xml
                };
                this.attributes.push( new XRTNodeAttr( xmlAttr ) );
                this.enableCellCommand = true;
            }
        }
    }

    if( xmlNode.childElementCount ) {
        for( var ii = 0; ii < xmlNode.childNodes.length; ii++ ) {
            if( xmlNode.childNodes[ ii ].nodeType !== 1 ) {
                continue;
            }
            this.children.push( new XRTNode( xmlNode.childNodes[ ii ], dsInfo, newLineNum ) );
        }
        newLineNum += 1;
    }

    this.addAttr = function( attrName ) {
        for( var jj = 0; jj < this.attributes.length; jj++ ) {
            if( this.attributes[ jj ].name.toUpperCase() === attrName.toUpperCase() ) {
                return;
            }
        }
        this.attributes.push( new XRTNodeAttr( null, attrName ) );
    };

    assignAttributes( this );

    assignName( this );
};

const XRTNodeAttr = function( xmlAttr, name ) {
    if( xmlAttr ) {
        this.name = xmlAttr.name;
        this.value = xmlAttr.value;
        if( !this.value ) {
            this.value = '';
        }

        if( this.name === 'name' || this.name === 'renderingHint' ) {
            this.type = 'list';
        } else {
            this.type = 'text';
        }
    } else if( name ) {
        this.name = name;
        if( this.name === 'name' || this.name === 'renderingHint' ) {
            this.type = 'list';
        } else {
            this.type = 'text';
        }
    }
};

const assignAttributes = function( xmlNode ) {
    var type = xmlNode.type.toUpperCase();
    if( type !== 'RENDERING' ) {
        xmlNode.enableDelete = true;
    }

    if( type === 'ALL' ) {
        xmlNode.addAttr( 'type' );
    } else if( type === 'COMMAND' ) {
        xmlNode.addAttr( 'actionKey' );
        xmlNode.addAttr( 'commandID' );
        xmlNode.addAttr( 'defaultTitle' );
        xmlNode.addAttr( 'icon' );
        xmlNode.addAttr( 'renderingHint' );
        xmlNode.addAttr( 'text' );
        xmlNode.addAttr( 'titleKey' );
        xmlNode.addAttr( 'tooltip' );
        xmlNode.enableAdd = true;
    } else if( type === 'RENDERING' ) {
        xmlNode.enableAdd = true;
    } else if( type === 'GOVERNINGPROPERTY' ) {
        xmlNode.addAttr( 'propertyname' );
        xmlNode.addAttr( 'propertyvalue' );
    } else if( type === 'RULE' ) {
        xmlNode.addAttr( 'propertyname' );
        xmlNode.addAttr( 'state' );
    } else if( type === 'CUSTOMPANEL' ) {
        xmlNode.addAttr( 'java' );
        xmlNode.addAttr( 'js' );
    } else if( type === 'HEADER' ) {
        xmlNode.enableAdd = true;
    } else if( type === 'IMAGE' ) {
        xmlNode.addAttr( 'maxheight' );
        xmlNode.addAttr( 'maxwidth' );
        xmlNode.addAttr( 'source' );
        xmlNode.addAttr( 'tooltip' );
    } else if( type === 'LABEL' ) {
        xmlNode.addAttr( 'class' );
        xmlNode.addAttr( 'style' );
        xmlNode.addAttr( 'text' );
        xmlNode.addAttr( 'textKey' );
    } else if( type === 'LISTDISPLAY' ) {
        xmlNode.enableAdd = true;
    } else if( type === 'OBJECTSET' ) {
        xmlNode.addAttr( 'defaultdisplay' );
        xmlNode.addAttr( 'maxColumnCharCount' );
        xmlNode.addAttr( 'maxRowCount' );
        xmlNode.addAttr( 'minRowCount' );
        xmlNode.addAttr( 'sortby' );
        xmlNode.addAttr( 'sortdirection' );
        xmlNode.addAttr( 'source' );
        xmlNode.enableAdd = true;
    } else if( type === 'PAGE' ) {
        xmlNode.addAttr( 'format' );
        xmlNode.addAttr( 'text' );
        xmlNode.addAttr( 'title' );
        xmlNode.addAttr( 'titleKey' );
        xmlNode.addAttr( 'visibleWhen' );
        xmlNode.enableAdd = true;
    } else if( type === 'PARAMETER' ) {
        xmlNode.addAttr( 'name' );
        xmlNode.addAttr( 'value' );
    } else if( type === 'PROPERTY' ) {
        xmlNode.addAttr( 'border' );
        xmlNode.addAttr( 'column' );
        xmlNode.addAttr( 'modifiable' );
        xmlNode.addAttr( 'name' );
        xmlNode.addAttr( 'renderingHint' );
        xmlNode.addAttr( 'renderingStyle' );
        xmlNode.addAttr( 'row' );
        xmlNode.addAttr( 'style' );
    } else if( type === 'SECTION' ) {
        xmlNode.addAttr( 'commandLayout' );
        xmlNode.addAttr( 'initialstate' );
        xmlNode.addAttr( 'text' );
        xmlNode.addAttr( 'title' );
        xmlNode.addAttr( 'titleKey' );
        xmlNode.addAttr( 'groupname' );
        xmlNode.enableAdd = true;
    } else if( type === 'TABLEDISPLAY' ) {
        xmlNode.enableAdd = true;
    } else if( type === 'THUMBNAILDISPLAY' ) {
        xmlNode.enableAdd = true;
    } else if( type === 'VIEW' ) {
        xmlNode.addAttr( 'name' );
    } else if( type === 'INJECT' ) {
        xmlNode.addAttr( 'type' );
        xmlNode.addAttr( 'src' );
    } else if( type === 'HTMLPANEL' ) {
        xmlNode.addAttr( 'src' );
        xmlNode.addAttr( 'id' );
    } else if( type === 'AW-PROPERTY' ) {
        xmlNode.addAttr( 'prop' );
        xmlNode.addAttr( 'hint' );
        xmlNode.addAttr( 'modifiable' );
    } else if( type === 'AW-FRAME' ) {
        xmlNode.addAttr( 'src' );
    } else if( type === 'CONTENT' ) {
        xmlNode.addAttr( 'visibleWhen' );
    }
};

const assignName = function( xmlNode ) {
    let displayName = xmlNode.type;
    if( xmlNode.attributes.length > 0 ) {
        displayName = displayName + ': ' + xmlNode.attributes[0].value;
        if( xmlNode.type === 'inject' && xmlNode.attributes[1] ) {
            displayName = displayName + ': ' + xmlNode.attributes[1].value;
        }
    }
    xmlNode.displayName = displayName;
};

export const openInjectedDataset = async( commandContext ) => {
    const { cellCommandContext, vmo } = commandContext;
    const { xrtEditorState, selectedNodeName } = cellCommandContext;
    let type = vmo.attributes[0].value;
    let protectionScope;

    let selectedDataset;
    if( type === 'preference' ) {
        let injectedPreference = vmo.attributes[1].value;
        let selectedPreference = xrtEditorState.dsInfo.injectedByPreference[injectedPreference];
        selectedDataset = selectedPreference[0].datasetName;
        let preferenceSOA = await soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
            preferenceNames: [ injectedPreference ],
            includePreferenceDescriptions: false
        }, {} );
        protectionScope = preferenceSOA?.response[0]?.definition?.protectionScope;
    } else {
        selectedDataset = vmo.attributes[1].value;
    }

    loadXRTOnNavigate( xrtEditorState, selectedDataset ).then(
        function( dsInfo ) {
            if( vmo && vmo.attributes[1] ) {
                const newXrtEditorState = { ...xrtEditorState.value };
                newXrtEditorState.dsInfo = dsInfo;
                newXrtEditorState.currLocation = selectedDataset;
                newXrtEditorState.editingInProgress = false;
                newXrtEditorState.xml = dsInfo.xrt !== '' ?  dsInfo.xrt : decodeURI( newXrtEditorState.defaultXrt );
                if( type === 'preference' && protectionScope ) {
                    newXrtEditorState.protectionScope = protectionScope;
                }
                if( type !== 'preference' && xrtEditorState.protectionScope ) {
                    newXrtEditorState.protectionScope = undefined;
                }
                xrtEditorState.update && xrtEditorState.update( newXrtEditorState );

                const newselectedNodeName = { ...cellCommandContext.selectedNodeName.value };
                newselectedNodeName.nodeName = selectedDataset;
                selectedNodeName.update && selectedNodeName.update( newselectedNodeName );
            }
        }
    );
};

export default exports = {
    loadXRTFromContext,
    loadXRT,
    loadXRTOnNavigate,
    fetchBreadCrumbNodes,
    xrtEditorTreeNavigationHandler,
    onSelectCrumb,
    fetchBreadcrumb,
    fetchTreeComponents,
    openInjectedDataset,
    updateBreadcrumb,
    xrtEditorTreeNodeSelection
};
