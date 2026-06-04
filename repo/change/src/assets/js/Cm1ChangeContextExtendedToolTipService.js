export let toolTipContent = function( contextdisplayValue, displayValue ) {
    if( contextdisplayValue && displayValue ) {
        return displayValue.replace( '{0}', '\'' + contextdisplayValue + '\'' );
    }
};
