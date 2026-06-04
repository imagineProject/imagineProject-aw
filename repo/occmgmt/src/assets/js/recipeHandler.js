// Copyright (c) 2022 Siemens

/**
 * @module js/recipeHandler
 */

import _ from 'lodash';

let persistentRecipeMap = [];
let transientRecipeInfoMap = [];


export let setPersistentRecipe = function( contextKey, pciUID, recipe ) {
    if( persistentRecipeMap && persistentRecipeMap.length > 0 ) {
        var recipeData = persistentRecipeMap.filter( function( x ) {
            return x.pciUID === pciUID;
        } );
        if( recipeData && recipeData[ 0 ] && recipeData[0].key === contextKey ) {
            recipeData[0].recipe = recipe;
        } else {
            let persistentRecipeEntry = {
                key: contextKey,
                pciUID: pciUID,
                recipe: recipe
            };
            persistentRecipeMap.push( persistentRecipeEntry );
        }
    }else {
        let persistentRecipeEntry = {
            key: contextKey,
            pciUID: pciUID,
            recipe: recipe
        };
        persistentRecipeMap.push( persistentRecipeEntry );
    }
};

export let clearPersistentRecipe = function( contextKey, pciUID ) {
    if( persistentRecipeMap && persistentRecipeMap.length > 0 ) {
        var recipeData = persistentRecipeMap.filter( function( x ) {
            return  x.pciUID === pciUID;
        } );
        if( recipeData && recipeData.length > 0 && recipeData[0].key === contextKey ) {
            persistentRecipeMap.splice( persistentRecipeMap.indexOf( recipeData ), 1 );
        }
    }
};

export let getPersistentRecipe = function(  contextKey, pciUID ) {
    if( persistentRecipeMap && persistentRecipeMap.length > 0 ) {
        var recipeData = persistentRecipeMap.filter( function( x ) {
            return x.pciUID === pciUID;
        } );
        if( recipeData && recipeData[ 0 ] && recipeData[0].key === contextKey ) {
            return recipeData[0].recipe;
        }
    }
    return [];
};

export let setTransientRecipeInfo = function( contextKey, effectiveFilterString, effectiveRecipe ) {
    if( transientRecipeInfoMap && transientRecipeInfoMap.length > 0 ) {
        var recipeData = transientRecipeInfoMap.filter( function( x ) {
            return x.key === contextKey;
        } );
        if( recipeData && recipeData[ 0 ] ) {
            recipeData[0].effectiveFilterString = effectiveFilterString;
            recipeData[0].effectiveRecipe = effectiveRecipe;
        }else {
            let transientRecipeEntry = {
                key: contextKey,
                effectiveFilterString: effectiveFilterString,
                effectiveRecipe: effectiveRecipe
            };
            transientRecipeInfoMap.push( transientRecipeEntry );
        }
    }else {
        let transientRecipeEntry = {
            key: contextKey,
            effectiveFilterString: effectiveFilterString,
            effectiveRecipe: effectiveRecipe
        };
        transientRecipeInfoMap.push( transientRecipeEntry );
    }
};

export let getTransientRecipeInfo = function( contextKey ) {
    if( transientRecipeInfoMap && transientRecipeInfoMap.length > 0 ) {
        var recipeData = transientRecipeInfoMap.filter( function( x ) {
            return x.key === contextKey;
        } );
        if( recipeData && recipeData[ 0 ] ) {
            return [ recipeData[0].effectiveFilterString, recipeData[0].effectiveRecipe ];
        }
    }
    return [];
};

const recipeHandler = {
    setTransientRecipeInfo,
    getTransientRecipeInfo,
    setPersistentRecipe,
    getPersistentRecipe,
    clearPersistentRecipe
};


export default recipeHandler;
