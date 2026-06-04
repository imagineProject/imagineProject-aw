// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/*global
 */

/**
 * @module js/ScheduleMangerDecoratorService
 */
import app from 'app';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';


var exports = {};

export let addDecoratorToBaseline1 = function (vmo) {

    let scheduleNavigationCtx = appCtxService.getCtx('scheduleNavigationCtx');
    if (scheduleNavigationCtx && !_.isEmpty(scheduleNavigationCtx.selectedBaselines)) {
        let idx = _.findIndex(scheduleNavigationCtx.selectedBaselines, function (obj) {
            return obj.uid === vmo.uid;
        });
        if (idx === 0) {
            return true;
        }
    }
    return false;
};

export let addDecoratorToBaseline2 = function (vmo) {

    let scheduleNavigationCtx = appCtxService.getCtx('scheduleNavigationCtx');
    if (scheduleNavigationCtx && !_.isEmpty(scheduleNavigationCtx.selectedBaselines)) {

        let idx = _.findIndex(scheduleNavigationCtx.selectedBaselines, function (obj) {
            return obj.uid === vmo.uid;
        });
        if (idx === 1) {
            return true;
        }
    }
    return false;
};


exports = {
    addDecoratorToBaseline1,
    addDecoratorToBaseline2
};

export default exports;
/**
 * This factory creates a service and returns exports
 *
 * @memberof NgServices
 * @member ScheduleMangerDecoratorService
 */

app.factory('ScheduleMangerDecoratorService', () => exports);
