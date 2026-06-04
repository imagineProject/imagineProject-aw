/* eslint-disable max-len */
import AwButton from 'viewmodel/AwButtonViewModel';
import AwListbox from 'viewmodel/AwListboxViewModel';
import AwTypeSelector from 'viewmodel/AwTypeSelectorViewModel';
import AwPanelBody from 'viewmodel/AwPanelBodyViewModel';
import AwServerVisibilityToolbar from 'viewmodel/AwServerVisibilityToolbarViewModel';
import AwSourceEditor from 'viewmodel/AwSourceEditorViewModel';
import AwSplitter from 'viewmodel/AwSplitterViewModel';
import AwXrtEditorBreadcrumb from 'viewmodel/AwXrtEditorBreadcrumbViewModel';
import AwXrtEditorTree from 'viewmodel/AwXrtEditorTreeViewModel';
import localStorage from 'js/localStorage';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import configurationService from 'js/configurationService';
import cmm from 'soa/kernel/clientMetaModel';
import messageService from 'js/messagingService';
import xrtEditorUtils from 'js/xrtEditorUtilities';
import _ from 'lodash';

const defaultXRT = '%3C?xml%20version=%221.0%22%20encoding=%22UTF-8%22?%3E%0A%3C!--%20Empty%20Rendering%20--%3E%0A%3Crendering%3E%0A%3C/rendering%3E';

export const awXrtEditorOnMount = ( data, xrtEditorState ) => {
    localStorage.subscribe( 'getDeclStyleSheet', function( event ) {
        const stylesheetContext = JSON.parse( event.newValue );
        loadXRTFromContext( data, stylesheetContext, xrtEditorState );
    } );
    const editor = {
        readOnlyConfig: {
            theme: 'vs',
            options: {
                readOnly: true,
                wordWrap: 'off',
                lineNumbers: 'on',
                automaticLayout: true,
                minimap: {},
                formatOnType: true,
                fontFamily: 'monospace'
            }
        },
        config: {
            language: 'html',
            theme: 'vs',
            options: {
                readOnly: false,
                wordWrap: 'off',
                lineNumbers: 'on',
                automaticLayout: true,
                minimap: {},
                formatOnType: true,
                fontFamily: 'monospace'
            }
        },
        update: function( newContent ) {
            data.dispatch( { path: 'data.newContent', value: newContent } );
        }

    };
    data.dispatch( { path: 'data.editor', value: editor } );

    let locationList = [];
    let sublocationList = [];
    // Add special case locations and sublocations
    locationList.push( {
        propDisplayValue: 'showObjectLocation',
        propInternalValue: 'showObjectLocation'
    } );
    sublocationList.push( {
        propDisplayValue: 'objectNavigationSubLocation',
        propInternalValue: 'objectNavigationSubLocation'
    } );
    sublocationList.push( {
        propDisplayValue: 'OccurrenceManagementSubLocation',
        propInternalValue: 'OccurrenceManagementSubLocation'
    } );
    configurationService.getCfg( 'states' ).then( function( states ) {
        for( const name in states ) {
            const state = states[name];
            if( state && state.type ) {
                if( state.type === 'location' ) {
                    const locationName = name.substring( name.lastIndexOf( '_' ) + 1 );
                    locationList.push( {
                        propDisplayValue: locationName,
                        propInternalValue: locationName,
                        propDisplayDescription: '',
                        hasChildren: false,
                        children: {},
                        sel: false
                    } );
                } else if( state.type === 'subLocation' ) {
                    const sublocationName = name.substring( name.lastIndexOf( '_' ) + 1 );
                    sublocationList.push( {
                        propDisplayValue: sublocationName,
                        propInternalValue: sublocationName,
                        propDisplayDescription: '',
                        hasChildren: false,
                        children: {},
                        sel: false
                    } );
                }
            }
        }
        data.dispatch( { path: 'data.locationList', value: locationList } );
        data.dispatch( { path: 'data.sublocationList', value: sublocationList } );
        data.dispatch( { path: 'data.content', value: decodeURI( defaultXRT ) } );

        const newXrtEditorState = { ...xrtEditorState.value };
        newXrtEditorState.xml = decodeURI( defaultXRT );
        xrtEditorState.update && xrtEditorState.update( newXrtEditorState );
    } );
};

export const awXrtEditorOnUnMount = () => {
    localStorage.removeItem( 'getStyleSheet' );
};

export const evaluateIsDirty = ( data, fields ) => {
    return data.newContent !== fields.xrtEditorState.xml;
};

export const awXrtEditorRenderFunction = ( props ) => {
    const { viewModel, fields, actions, i18n } = props;
    let { data } = viewModel;
    let sourceEditor;
    let cellCommandProps2 = {
        xrtEditorState: fields.xrtEditorState,
        selectedNodeName: fields.selectedNodeName
    };
    if( data.editor && data.content ) {
        sourceEditor = <AwSourceEditor name='awXrtEditor' value={ fields.xrtEditorState.xml } update={data.editor.update} editor={fields.editorRef}
            config={ fields.xrtEditorState.editingInProgress ? data.editor.config : data.editor.readOnlyConfig }></AwSourceEditor>
        ;
    }

    const processXrtEditorBreadcrumbs = () => {
        if( data.dsInfo ) {
            return (
                <div className='aw-layout-flexRow sw-workarea-headerArea aw-align-items-center aw-xrteditor-toolbar'>
                    <AwXrtEditorBreadcrumb context={{ ...data }} datasetName={data.datasetName} dsInfo={{ ...data.dsInfo }}
                        nodeName={fields.selectedNodeName} xrtEditorTreeInfo={fields.xrtEditorTreeInfo} crumbTextBox={fields.crumbTextBox} xrtEditorState={fields.xrtEditorState} cellCommandProps={cellCommandProps2}></AwXrtEditorBreadcrumb>
                    <div className='sw-toolbar-summaryHeaderWrapper align-right flex-grow'>
                        {
                            <AwServerVisibilityToolbar className='sw-summary-headerToolbar sw-margin-bottom aw-xrteditor-headerToolbar' overflow={false} context={{ ...data, xrtEditorState: fields.xrtEditorState }} firstAnchor='' secondAnchor='aw_xrteditor' reverseSecond orientation='HORIZONTAL'></AwServerVisibilityToolbar>
                        }
                    </div>
                </div>
            );
        }
        return null;
    };

    const processXrtEditorBody = ( ) => {
        if( data.dsInfo ) {
            return (
                <div className='sw-row w-12 h-12'>
                    <div className='sw-column w-2 h-12'>
                        <AwXrtEditorTree context={{ ...data }} datasetName={data.datasetName} dsInfo={{ ...data.dsInfo }} nodeName={fields.selectedNodeName} cellCommandProps={cellCommandProps2} xrtEditorState={fields.xrtEditorState} editor={fields.editorRef}></AwXrtEditorTree>
                    </div>
                    <AwSplitter></AwSplitter>
                    <div className='sw-column w-12 h-12'>
                        {
                            sourceEditor ? sourceEditor : ''
                        }
                    </div>
                </div>
            );
        }
        return (
            <div className='aw-align-items-center sw-row w-12 h-12'>
                <div className='aw-xrteditor-emptyStateContainer sw-column w-12'>
                    <div className='aw-xrteditor-emptyStateTitle'>
                        {i18n.noXrtLoadedTitle}
                    </div>
                    <div className='aw-xrteditor-emptyStateText'>
                        {i18n.noXrtLoadedMessage}
                    </div>
                    <div className='aw-xrteditor-emptyStateText'>
                        {i18n.noXrtLoadedConvenienceMessage}
                    </div>
                </div>
            </div>
        );
    };

    return data.editor && data.content && <AwPanelBody>
        <div className='sw-row aw-xrteditor-headerContainer'>
            <div className='sw-column'>
                <div className='sw-row aw-xrteditor-headerWrapper'>
                    <span className='aw-xrteditor-listboxLabel'>{i18n.scopeLabel}</span>
                    <AwListbox className='aw-xrteditor-listbox' {...fields.scopeListBox} list={data.scopeValues.dbValue} action={actions.updateScope}></AwListbox>
                    <span className='aw-xrteditor-listboxLabel'>{i18n.objectTypeLabel}</span>
                    <AwTypeSelector className='aw-xrteditor-listbox' { ...fields.objectTypeListBox } include={'WorkspaceObject'} load-sub-types={true} overrideId={'XRTEditor'}></AwTypeSelector>
                    <span className='aw-xrteditor-listboxLabel'>{i18n.xrtTypeLabel}</span>
                    <AwListbox className='aw-xrteditor-listbox' {...fields.xrtTypeListBox} list={data.xrtTypeValues.dbValue}></AwListbox>
                    <span className='aw-xrteditor-listboxLabel'>{i18n.locationLabel}</span>
                    <AwListbox className='aw-xrteditor-listbox' {...fields.locationListBox} list={data.locationList}></AwListbox>
                    <span className='aw-xrteditor-listboxLabel'>{i18n.sublocationLabel}</span>
                    <AwListbox className='aw-xrteditor-listbox' {...fields.sublocationListBox} list={data.sublocationList}></AwListbox>
                    { ( data.scopeListBox.dbValue !== data.scope || data.xrtTypeListBox.dbValue !== data.xrtType
            || data.objectTypeListBox.dbValue !== data.objectType || data.locationListBox.dbValue !== data.location
            || data.sublocationListBox.dbValue !== data.sublocation )  && <AwButton buttonType='base' class='small' action={actions.loadXRT}>{i18n.loadButtonText}</AwButton>
                    }
                </div>
            </div>
        </div>
        { processXrtEditorBreadcrumbs() }
        { processXrtEditorBody( ) }
    </AwPanelBody>;
};

export const startEdit = ( data, groupName, userName, xrtEditorState, crumbTextBox, editingInProgress ) => {
    const newEditingInProgress = { ...editingInProgress.value };
    newEditingInProgress.editingInProgress = true;
    editingInProgress.update && editingInProgress.update( newEditingInProgress );

    data.dispatch( { path: 'data.editInProgress', value: true } );
    data.editingInProgress2 = true;
    let result = {
        editing: true,
        scopeListBox: data.scopeListBox,
        datasetNameTextBox: data.datasetNameTextBox
    };

    let appendUser = xrtEditorState.dsInfo?.stylesheetContext?.preferenceLocation !== 'User' && xrtEditorState.dsInfo?.stylesheetContext?.datasetName === xrtEditorState.currLocation;

    if( groupName !== 'dba' && appendUser ) {
        result.scopeListBox.dbValue = 'User';
        result.scopeListBox.uiValue = 'User';
        result.datasetNameTextBox.dbValue =  data.selectedNodeName && data.selectedNodeName.nodeName  ?
            data.selectedNodeName.nodeName + '_' + userName  : data.datasetName + '_' + userName;
        result.datasetNameTextBox.uiValue =  data.selectedNodeName && data.selectedNodeName.nodeName  ?
            data.selectedNodeName.nodeName + '_' + userName  : data.datasetName + '_' + userName;
        result.datasetNameTextBox.dirty = false;
        updateNewCrumbTextBox( crumbTextBox, data, userName, groupName, xrtEditorState );
    } else if( data.scopeListBox.dbValue === 'User' ) {
        updateNewCrumbTextBox( crumbTextBox, data, userName, groupName, xrtEditorState );
    } else {
        const newCrumbTextBox = { ...crumbTextBox };
        newCrumbTextBox.value.name = xrtEditorState.currLocation;
        newCrumbTextBox.value.groupName = groupName;
        newCrumbTextBox.value.scopeListBox = data.scopeListBox.dbValue;
        crumbTextBox.update && crumbTextBox.update( newCrumbTextBox );
    }

    const newXrtEditorState = { ...xrtEditorState.value };
    newXrtEditorState.editingInProgress = true;
    xrtEditorState.update && xrtEditorState.update( newXrtEditorState );

    return result;
};

export const updateNewCrumbTextBox = ( crumbTextBox, data, userName, groupName, xrtEditorState ) => {
    const newCrumbTextBox = { ...crumbTextBox };
    if( groupName !== 'dba' && !data.selectedNodeName.nodeName.includes( '_' + userName ) && !xrtEditorState.currLocation.includes( '_' + userName ) ) {
        newCrumbTextBox.value.name = data.selectedNodeName && data.selectedNodeName.nodeName  ?
            data.selectedNodeName.nodeName + '_' + userName  : data.datasetName + '_' + userName;
    } else {
        newCrumbTextBox.value.name = data.selectedNodeName && data.selectedNodeName.nodeName  ?
            data.selectedNodeName.nodeName  : data.datasetName;
    }
    newCrumbTextBox.value.userName =  userName;
    newCrumbTextBox.value.groupName = groupName;
    newCrumbTextBox.value.scopeListBox = data.scopeListBox.dbValue;
    crumbTextBox.update && crumbTextBox.update( newCrumbTextBox );
};

export const cancelEdit = ( data, xrtEditorState, editingInProgress ) => {
    data.scopeListBox.dbValue = data.scope;
    data.scopeListBox.uiValue = data.scope;

    const newXrtEditorState = { ...xrtEditorState.value };
    newXrtEditorState.editingInProgress = false;
    newXrtEditorState.showLeaveConfirmation = false;
    xrtEditorState.update && xrtEditorState.update( newXrtEditorState );

    const newEditingInProgress = { ...editingInProgress.value };
    newEditingInProgress.editingInProgress = false;
    editingInProgress.update && editingInProgress.update( newEditingInProgress );

    return {
        editing: false,
        newContent: data.content,
        scopeListBox: data.scopeListBox
    };
};

const updateInjDataset = ( xrt, referencedDataset, referencedPreference, isCrumbApplicable ) => {
    if( referencedPreference?.isPreferenceUpdated ) {
        return xrt;
    }
    let originalName = referencedDataset.originalName;
    let newName = referencedDataset.crumbTextBox?.value?.name !== undefined && isCrumbApplicable ? referencedDataset.crumbTextBox.value.name : referencedDataset.displayName;
    return xrt.replace( originalName, newName );
};

const getDatasetObject = ( dataset, isUpdatedDataset ) => {
    if( !isUpdatedDataset && dataset.displayName === dataset.originalName || dataset.crumbTextBox && dataset.originalName === dataset.crumbTextBox.value.name ) {
        return {
            uid: dataset.dsInfo.datasetObject.uid,
            type: dataset.dsInfo.datasetObject.type

        };
    }
    return { uid: 'AAAAAAAAAAAAAA', type: 'unknownType' };
};

const evaluateIsPreference = ( dsInfo, referencedDataset ) => {
    if( dsInfo.injectedByPreference ) {
        let injectedByPreference = dsInfo.injectedByPreference;
        for( let x in injectedByPreference ) {
            let preference = injectedByPreference[x];
            for( let i = 0; i < preference.length; i++ ) {
                if( preference[i].datasetName === referencedDataset.originalName && preference[i].datasetName !== referencedDataset.displayName ) {
                    return {
                        isPreferenceUpdated: true,
                        preferenceName: x,
                        newDatasetName: referencedDataset.displayName
                    };
                }
            }
        }
    }
    return {
        isPreferenceUpdated: false
    };
};

export const saveEdits = async( data, xrtEditorState, crumbs ) => {
    let deferred = AwPromiseService.instance.defer();
    let datasetsToBeSaved = crumbs;
    let result = {
        editing: false,
        content: data.content,
        datasetName: data.datasetName,
        scope: data.scope
    };
    const request = {
        dsInfos: []
    };
    const preferenceInputs = {
        setPreferenceIn: []
    };
    for( let i = datasetsToBeSaved.length; i > 0; i-- ) {
        let dataset = datasetsToBeSaved[i - 1];
        let datasetName = i === datasetsToBeSaved.length ? dataset.crumbTextBox.value.name : dataset.displayName;
        let dsObj = getDatasetObject( dataset, i === datasetsToBeSaved.length );
        let preferenceData = i === datasetsToBeSaved.length ? { isPreferenceUpdated: false } : evaluateIsPreference( dataset.dsInfo, datasetsToBeSaved[i] );
        let dsInfo = {
            datasetObject: dsObj,
            stylesheetContext: {
                client: 'AWC',
                datasetName: datasetName,
                location: data.locationListBox.dbValue,
                sublocation: dataset.dsInfo.stylesheetContext.sublocation,
                preferenceLocation: data.scopeListBox.dbValue,
                stylesheetType: dataset.dsInfo.stylesheetContext.stylesheetType,
                type: dataset.dsInfo.stylesheetContext.type
            },
            injectedByDatasetName: {},
            injectedByPreference: {},
            xrt: i === datasetsToBeSaved.length ? data.newContent : updateInjDataset( dataset.dsInfo.xrt, datasetsToBeSaved[i], preferenceData, i === datasetsToBeSaved.length - 1 )
        };
        if( preferenceData?.isPreferenceUpdated ) {
            let preferenceInput = {
                location: {
                    location: data.scope
                },
                preferenceInputs: {
                    preferenceName: preferenceData.preferenceName,
                    values: [ preferenceData.newDatasetName ]
                }
            };
            preferenceInputs.setPreferenceIn.push( preferenceInput );
        }
        datasetsToBeSaved[i - 1].dsInfo.xrt = dsInfo.xrt;
        request.dsInfos.push( dsInfo );
    }
    await soaService.postUnchecked( 'Internal-AWS2-2024-06-DataManagement', 'saveXRT2', request ).then(
        function( serviceData ) {
            if( serviceData.partialErrors ) {
                processPartialErrors( serviceData );
            } else {
                result.content = data.newContent;
                result.datasetName = data.datasetNameTextBox.dbValue;
                result.scope = data.scopeListBox.dbValue;
                result.datasetObjects = new Map();
                if( serviceData.created ) {
                    for( let i = 0; i < serviceData.created.length; i++ ) {
                        let createdObj = serviceData.modelObjects[ serviceData.created[ i ] ];
                        result.datasetObjects.set( createdObj.props?.object_name?.dbValues[ 0 ], createdObj );
                    }
                }
            }
            deferred.resolve( result );
        } );

    if( preferenceInputs.setPreferenceIn.length > 0 ) {
        await soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'setPreferencesAtLocations', preferenceInputs ).then(
            function( serviceData ) {
                if( serviceData.partialErrors ) {
                    processPartialErrors( serviceData );
                }
            }
        );
    }

    const newXrtEditorState = { ...xrtEditorState.value };
    let newBreadcrumbs = [];
    for( let i = 0; i < datasetsToBeSaved.length; i++ ) {
        let crumb = datasetsToBeSaved[i];
        crumb.originalName = i === datasetsToBeSaved.length - 1 ? crumb.crumbTextBox.value.name : crumb.displayName;
        if( result.datasetObjects && result.datasetObjects.has( crumb.displayName ) ) {
            crumb.dsInfo.datasetObject = result.datasetObjects.get( crumb.displayName );
        }
        crumb.displayName = crumb.originalName;
        crumb.customDataset = true;
        newBreadcrumbs.push( crumb );
    }
    newXrtEditorState.updatedBreadcrumbs = newBreadcrumbs;
    newXrtEditorState.isCustom = true;
    newXrtEditorState.currLocation = datasetsToBeSaved[ datasetsToBeSaved.length - 1].displayName;
    newXrtEditorState.xml = data.newContent;
    newXrtEditorState.editingInProgress = false;
    newXrtEditorState.showLeaveConfirmation = false;
    xrtEditorState.update && xrtEditorState.update( newXrtEditorState );

    return deferred.promise;
};

export const isUnsavedChangesPopupOpen = ( xrtEditorState ) => {
    return xrtEditorState.showLeaveConfirmation;
};

/**
 * Process the partial error in SOA response if there are any.
 *
 * @param {serviceData} serviceData - service data of createOrUpdateNotificationRules
 */
function processPartialErrors( serviceData ) {
    let msgObj = {
        msg: '',
        level: 0
    };

    if( serviceData.partialErrors ) {
        for( let inx = 0; inx < serviceData.partialErrors[ 0 ].errorValues.length; inx++ ) {
            msgObj.msg += serviceData.partialErrors[ 0 ].errorValues[ inx ].message;
            msgObj.msg += '<BR/>';
            msgObj.level = _.max( [ msgObj.level, serviceData.partialErrors[ 0 ].errorValues[ inx ].level ] );
        }
        messageService.showError( msgObj.msg );
    }
}

export const loadXRTFromContext = ( data, context, xrtEditorState ) => {
    let deferred = AwPromiseService.instance.defer();
    xrtEditorUtils.loadXRTFromContext( context ).then( function( stylesheetContext ) {
        loadXRT( data, stylesheetContext.type, stylesheetContext.stylesheetType, stylesheetContext.preferenceLocation,
            stylesheetContext.client, stylesheetContext.location, stylesheetContext.sublocation, context, xrtEditorState ).then( function() {
            deferred.resolve();
        } );
    }, function() {
        deferred.resolve();
    } );
    return deferred.promise;
};

export const loadXRT = ( data, type, stylesheetType, preferenceLocation, client, location, sublocation, context, xrtEditorState ) => {
    let deferred = AwPromiseService.instance.defer();
    let businessObject = context && context.modelObject ? context.modelObject : '';
    xrtEditorUtils.loadXRT( businessObject, type, stylesheetType, preferenceLocation, client, location, sublocation ).then(
        function( dsInfo ) {
            data.dispatch( { path: 'data.editing', value: false } );
            if( dsInfo ) {
                if( data.datasetObject.uid !== dsInfo.datasetObject.uid ) {
                    data.dispatch( { path: 'data.datasetObject', value: dsInfo.datasetObject } );
                }

                if( data.datasetName !== dsInfo.stylesheetContext.datasetName ) {
                    data.dispatch( { path: 'data.datasetName', value: dsInfo.stylesheetContext.datasetName } );
                }

                if( data.datasetNameTextBox.dbValue !== dsInfo.stylesheetContext.datasetName ) {
                    data.datasetNameTextBox.dbValue = dsInfo.stylesheetContext.datasetName;
                    data.datasetNameTextBox.uiValue = dsInfo.stylesheetContext.datasetName;
                    data.dispatch( { path: 'data.datasetNameTextBox', value: data.datasetNameTextBox } );
                }

                if( data.content !== dsInfo.xrt ) {
                    data.dispatch( { path: 'data.content', value: dsInfo.xrt !== '' ?  dsInfo.xrt : decodeURI( defaultXRT ) } );
                }

                if( data.scope !== dsInfo.stylesheetContext.preferenceLocation ) {
                    data.dispatch( { path: 'data.scope', value: dsInfo.stylesheetContext.preferenceLocation } );
                }

                if( data.scopeListBox.dbValue !== dsInfo.stylesheetContext.preferenceLocation ) {
                    data.scopeListBox.dbValue = dsInfo.stylesheetContext.preferenceLocation;
                    data.scopeListBox.uiValue = dsInfo.stylesheetContext.preferenceLocation;
                    data.dispatch( { path: 'data.scopeListBox', value: data.scopeListBox } );
                }

                if( data.xrtType !== dsInfo.stylesheetContext.stylesheetType ) {
                    data.dispatch( { path: 'data.xrtType', value: dsInfo.stylesheetContext.stylesheetType } );
                }

                if( data.xrtTypeListBox.dbValue !== dsInfo.stylesheetContext.stylesheetType ) {
                    data.xrtTypeListBox.dbValue = dsInfo.stylesheetContext.stylesheetType;
                    data.xrtTypeListBox.uiValue = dsInfo.stylesheetContext.stylesheetType;
                    data.dispatch( { path: 'data.xrtTypeListBox', value: data.xrtTypeListBox } );
                }

                if( data.objectType !== dsInfo.stylesheetContext.type ) {
                    data.dispatch( { path: 'data.objectType', value: dsInfo.stylesheetContext.type } );
                }

                if( data.objectTypeListBox.dbValue !== dsInfo.stylesheetContext.type ) {
                    data.objectTypeListBox.dbValue = dsInfo.stylesheetContext.type;
                    const modelType = cmm.getType( dsInfo.stylesheetContext.type );
                    data.objectTypeListBox.uiValue = modelType ? modelType.displayName : dsInfo.stylesheetContext.type;
                    data.dispatch( { path: 'data.objectTypeListBox', value: data.objectTypeListBox } );
                }

                if( data.location !== dsInfo.stylesheetContext.location ) {
                    data.dispatch( { path: 'data.location', value: dsInfo.stylesheetContext.location } );
                }

                if( data.locationListBox.dbValue !== dsInfo.stylesheetContext.location ) {
                    data.locationListBox.dbValue = dsInfo.stylesheetContext.location;
                    data.locationListBox.uiValue = dsInfo.stylesheetContext.location;
                    data.dispatch( { path: 'data.locationListBox', value: data.locationListBox } );
                }

                if( data.sublocation !== dsInfo.stylesheetContext.sublocation ) {
                    data.dispatch( { path: 'data.sublocation', value: dsInfo.stylesheetContext.sublocation } );
                }

                if( data.sublocationListBox.dbValue !== dsInfo.stylesheetContext.sublocation ) {
                    data.sublocationListBox.dbValue = dsInfo.stylesheetContext.sublocation;
                    data.sublocationListBox.uiValue = dsInfo.stylesheetContext.sublocation;
                    data.dispatch( { path: 'data.sublocationListBox', value: data.sublocationListBox } );
                }
                data.dispatch( { path: 'data.dsInfo', value: dsInfo } );

                const newXrtEditorState = { ...xrtEditorState.value };
                newXrtEditorState.dsInfo = dsInfo;
                newXrtEditorState.xml = dsInfo.xrt !== '' ?  dsInfo.xrt : decodeURI( defaultXRT );
                newXrtEditorState.businessObject = businessObject;
                newXrtEditorState.currLocation = dsInfo.xrt !== '' ? dsInfo.datasetObject.props.object_name.dbValues[0] : '';
                xrtEditorState.update && xrtEditorState.update( newXrtEditorState );
            } else {
                const newXrtEditorState = { ...xrtEditorState.value };
                newXrtEditorState.xml = decodeURI( defaultXRT );
                xrtEditorState.update && xrtEditorState.update( newXrtEditorState );
            }

            deferred.resolve( dsInfo );
        },
        function() {
            deferred.resolve();
        } );

    return deferred.promise;
};
