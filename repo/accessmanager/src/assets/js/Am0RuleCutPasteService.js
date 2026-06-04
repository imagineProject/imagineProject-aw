// Copyright (c) 2022 Siemens

/**
 * @module js/Am0RuleCutPasteService
 */
import appCtxSvc from 'js/appCtxService';
import tcClipboardService from 'js/tcClipboardService';
import accessMgmtService from 'js/accessMgmtService';

/**
 * this function gets called from resetCutAction to make isValidForPaste flag true
 * and gets called from setGreyOut function to make isValidForPaste flag false 
 * after reseting cut node that node with its childrens will be valid for paste 
 * called recursively when children having its own array of children
 * @param {*} node - array of children 
 */
var setValidForPasteFlag = function( node, isValidForPaste ) {
    node.isValidForPaste = isValidForPaste;
    // checking if node having children
    if ( node.children ) {
        node.children.forEach( function( v ) {
            v.isValidForPaste = isValidForPaste;
            if ( v.children ) {
                setValidForPasteFlag( v, isValidForPaste );
            }
        } );
    }
};

/**
 * This function deletes isPendingCut property from cut nodes which is used for greyed out cut nodes
 * called to restores previously cut nodes back to tree while cutting another set of nodes
 * called to remove greyed out style for cut nodes after pasted in newPrentNode
 * @param {*} dataProvider - to get the loadedVMO
 */
var resetCutAction = function( dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    //getting clipBoard content
    let clipBoardContent = appCtxSvc.getCtx( 'awClipBoardProvider' );
    let loadedVMObjects = dataProvider.viewModelCollection.getLoadedViewModelObjects();
    for ( var node in clipBoardContent ) {
        //finding node index from loadedVMO having property isPendingCut = true
        var index = vmc.findViewModelObjectById( clipBoardContent[node].uid );
        if ( index !== -1 ) {
            delete loadedVMObjects[index].isPendingCut;
            //called to make isvalidForPaste flag true after reset cut node
            var isValidForPaste = true;
            setValidForPasteFlag( loadedVMObjects[index], isValidForPaste );
        }
    }

    //updating dataprovider
    dataProvider.update( loadedVMObjects );
};

/**
 * In This function setting isPendingCut = true for selected nodes to greyed out after cut.
 * @param {*} selectionData - get the selectedNode from selectionData 
 * @param {*} dataProvider - to get the loadedVMO and viewModelCollection
 */
var setGreyOut = function( selectionData, dataProvider ) {
    let selectedModelObjects = selectionData.selected;
    let vmc = dataProvider.viewModelCollection;
    let loadedVMObjects = vmc.getLoadedViewModelObjects();

    for ( var selection in selectedModelObjects ) {
        var index = vmc.findViewModelObjectById( selectedModelObjects[selection].uid );
        //checking node index in loadedVMO 
        if ( index !== -1 ) {
            loadedVMObjects[index].isPendingCut = true;
            //called to make isvalidForPaste flag false after parent node greyed out
            var isValidForPaste = false;
            setValidForPasteFlag( loadedVMObjects[index], isValidForPaste );
        }
    }

    //updating dataprovider
    dataProvider.update( loadedVMObjects );
};

/**
 * This function is called to return display name of parent of cut node 
 * This will return the display name for success message on single node cut.
 * @param {*} selectedModelObject - get the selectedNode
 * @param {*} dataProvider - to get the loadedVMO and viewModelCollection
 */
export let getDisplayParentNameForCutNode = function( selectedModelObject, dataProvider ) {
    let vmc = dataProvider.viewModelCollection;
    let loadedVMObjects = vmc.getLoadedViewModelObjects();
    //getting parent node name to show in success message for single node selection cut

    let parentNode = loadedVMObjects.filter( parent => parent.uid === selectedModelObject.parent.uid );
    //get parent node display name
    return accessMgmtService.getDisplayValueForAmTreeRuleNode( parentNode[0] );
};

/**
 * this function is called to set node as a selected after pasting it in newParentNode
 * first resetCutAction called to remove greyed out style for cut node after pasted it
 * called dataProvider set selection to select node using clipBoarcContent
 * cleared clipBoaradContent after setSelection
 * @param {*} dataProvider - to get the loadedVMO
*/
export let setSelectionForPasteNode = function( dataProvider, isNodePasted ) {
    //deleting is pendingCut from nodes after paste 
    resetCutAction( dataProvider );

    var clipBoardContent = appCtxSvc.getCtx( 'awClipBoardProvider' );
    if ( clipBoardContent && clipBoardContent.length > 0 ) {
        //updating dataProvider to set that node as a selected
        dataProvider.selectionModel.setSelection( clipBoardContent );
        //storing selection in ctx to retain it after reload tree
        accessMgmtService.setCtxRuleSelection(clipBoardContent);
        //checking setSelection for paste node 
        if ( dataProvider.selectedObjects.length !== 0 ) {
            //after selection making this flag false 
            //so that setSelectionForPasteNode should not called again
            isNodePasted = false;
            //clearing the awClipBoardProviderContent after pasting it
            tcClipboardService.setContents( null );
            return isNodePasted;
        }
    }
};

/**
 * this function is called to set clipBoardContent in selectionData.selected after cut
 * after cut node paste command should be disable for that node 
 * so making isValidForPaste flag false which is used for paste command visibility condition
 * so after cut to apply this flag to command visibility again set selection needed
 * @param {*} selectionData - to get the selected objects
 * @param {*} awClipBoardProvider - to get the cut contents which copied in aeClipboardPrvider
*/
export let setSelectionForCutNode = function( selectionData, awClipBoardProvider ) {
    let newSelectionData = { ...selectionData.getValue() };
    newSelectionData.selected = awClipBoardProvider;
    selectionData.update( newSelectionData );
};

/**
 * this function is called to make childrens invalied for paste after expanding parent node which is cut and greyed out
 * when parent is not greyed out and we have to show children as a greyed out after re-expand then checked it in clipBoardContent
 * and making isPendingCut true for that children
 * @param {*} dataProvider - to get the loadedVMO
 * @param {*} parent - parent node which is expanding
 * @param {*} children - response from getAmTree2 soa response
 */
export let setGreyOutAndIsPasteValidFlagAfterReExpand = function( dataProvider, parent, children ) {
    var vmc = dataProvider.viewModelCollection;
    var loadedVMOs = vmc.getLoadedViewModelObjects();
    var pendingForCut = false;
    var pasteValidNode = true;
    let clipBoardContent = appCtxSvc.getCtx( 'awClipBoardProvider' );
    var parentNode = loadedVMOs.filter( node => node.uid === parent.treeNode.uid );
    //checking if parent node is allready cut then making all its children invalid for paste
    if ( parentNode[0] && ( parentNode[0].isPendingCut === true || parentNode[0].isValidForPaste === false ) ) {
        pasteValidNode = false;
    } else {
        //this block executed when parent is not greyed out
        //So checking childrens exists into clipboardcontent, if yes then marked isPendingCut=true to remain as a greyed out after expand
        if ( clipBoardContent && clipBoardContent.length > 0 ) {
            var index = clipBoardContent.findIndex( ( obj ) => obj.uid === children.treeNode.uid );
            if ( index !== -1 ) {
                pendingForCut = true;
                pasteValidNode = false;
            }
        }
    }
    //returning flag to make node invalid for paste and to remain as a greyed out based on condition after re-expand node 
    return {
        pasteValidNode: pasteValidNode,
        pendingForCut: pendingForCut
    };
};

const exports = {
    resetCutAction,
    setValidForPasteFlag,
    setGreyOut,
    getDisplayParentNameForCutNode,
    setSelectionForPasteNode,
    setGreyOutAndIsPasteValidFlagAfterReExpand,
    setSelectionForCutNode
};
export default exports;

