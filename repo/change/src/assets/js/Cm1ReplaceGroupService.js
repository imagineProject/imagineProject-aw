// Copyright (c) 2022 Siemens

/**
 * @module js/Cm1ReplaceGroupService
 */
import selectionService from 'js/selection.service';
import commandPanelService from 'js/commandPanel.service';
import commandsMapService from 'js/commandsMapService';
import appCtxService from 'js/appCtxService';
import preferenceSvc from 'soa/preferenceService';
import dmSvc from 'soa/dataManagementService';
import cmUtils from 'js/changeMgmtUtils';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import eventBus from 'js/eventBus';
import soa_kernel_propertyPolicyService from 'soa/kernel/propertyPolicyService';
import soaSvc from 'soa/kernel/soaService';
import notifySvc from 'js/NotyModule';
import msgSvc from 'js/messagingService';

var exports = {};

export let openSetCreateReplaceGroupPanel = function( data ) {
    var selection = selectionService.getSelection();

    //If selected row(s) have associated BOMEdits ( and those BOMEdits happen to be of type CM_ADD or CM_Delete )
    // these are candidates for Supersedure.
    //Else these are candidates for lineage.
    var bomAdds = [];
    var bomCancels = [];
    var isRemoved = false;
    var isAddedNew = false;
    var isMixedBVR = false;
    var parentBVR = {};
    
    var psbvr = selection.selected[0].bomEditParentBVR;
    parentBVR.uid = psbvr;
    parentBVR.type = 'PSBOMViewRevision';

    for( let i = 0; i < selection.selected.length; i++ ) {
        var bomEditType = selection.selected[i].bomEditType;
        if (bomEditType === "1") {
            isAddedNew = true;
            bomAdds.push( {
                uid: selection.selected[i].bomEditUid,
                type: 'BOMEdit'
            });
        }else if (bomEditType === "2") {
            isRemoved = true;
            bomCancels.push( {
                uid: selection.selected[i].bomEditUid,
                type: 'BOMEdit'
            });
        }

        if (selection.selected[i].bomEditParentBVR !== psbvr){
            isMixedBVR = true;
        }
    }

    //Must select at least one Add and one Cancel row
    if (!isAddedNew || !isRemoved){
        msgSvc.showError( data.i18n.setReplaceGroupOperationFailedAddedorReplace );
        return;
    }

    //All selected rows must be under the same parent BVR
    if (isMixedBVR) {
        msgSvc.showError( data.i18n.setReplaceGroupOperationFailedParentBVR );
        return;
    }

    if (isAddedNew && isRemoved){
        createSupersedure(data, parentBVR, bomAdds, bomCancels);
        return;
    }
};

/**
 * Method to create supersedure between removed/Added Group
 */
 let createSupersedure = function( data, parentBVR, bomAdds, bomCancels ) {
    var deferred = AwPromiseService.instance.defer();
    var soaInput = {};

    soaInput.bomAdds = bomAdds;
    soaInput.bomCancels = bomCancels;
    soaInput.isTransferred = false;
    soaInput.solutionBvr = parentBVR;
    var className;

    var inputArray = [];
    inputArray.push( soaInput );
        var inputData = {
        supercedureProperties: inputArray
    };

    var promise = soaSvc.post('ChangeManagement-2008-06-ChangeManagement', 'createSupercedures', inputData);
    if (promise) {
        promise.then(function (response) {
            if (response !== undefined) {
                className = response.output[0].supercedure[0].className;
                if(className === 'unknownClass'){
                    msgSvc.showError( data.i18n.setReplaceGroupOperationFailed );
                    return;
                }

                msgSvc.showInfo( data.i18n.setReplaceGroupOperationSuccess );

            }else{
                msgSvc.showError( data.i18n.setReplaceGroupOperationFailed );
            }

        });

        eventBus.publish('changeSummaryGrid.plTable.reload');
        eventBus.publish('changeSummaryGrid2.plTable.reload');
    }



    return deferred.promise;
};

/**
 * Method to delete supersedure between removed/Added Group
 */
export let deleteSupersedure = function( data ) {
    var selection = selectionService.getSelection();
    var deferred = AwPromiseService.instance.defer();

     var bomSupersedures = [];
     var deletedSupersedure = [];

    for( let i = 0; i < selection.selected.length; i++ ) {
            bomSupersedures.push( {
                uid: selection.selected[i].bomEditSupersedure,
                type: 'BOMSupersedure'
            });
    }

    var inputArray = [];
    inputArray.push( bomSupersedures );
    var inputData = {
        supercedureTobeDeleted: bomSupersedures
    };

    var promise = soaSvc.post('ChangeManagement-2008-06-ChangeManagement', 'deleteSupercedures', inputData);
    if (promise) {
        promise.then(function (response) {
            if (response !== undefined) {
                deletedSupersedure = response;
                msgSvc.showInfo( data.i18n.unsetReplaceGroupOperationSuccess );
            }else{
                msgSvc.showError( data.i18n.unsetReplaceGroupOperationFailed );
            }
        });

        eventBus.publish('changeSummaryGrid.plTable.reload');
        eventBus.publish('changeSummaryGrid2.plTable.reload');
    }

    return deferred.promise;
};

export default exports = {
    openSetCreateReplaceGroupPanel,
    deleteSupersedure
};
