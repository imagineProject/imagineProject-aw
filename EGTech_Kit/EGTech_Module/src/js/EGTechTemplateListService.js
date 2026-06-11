import appCtxSvc from 'js/appCtxService';
import soaSvc from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';
import addObjectUtils from 'js/addObjectUtils';
import xrtUtilities from 'js/xrtUtilities';
import dateTimeSvc from 'js/dateTimeService';

// TC 공식 패턴 (Saw1CreatePanelService.js / Saw1CreateScheduleFromTemplateService.js 동일)
function setDateValueForProp( vmoProp, dateVal ) {
    uwPropertyService.setValue( vmoProp, dateVal.getTime() );
    vmoProp.dateApi.dateObject = dateVal;
    vmoProp.dateApi.dateValue = dateTimeSvc.formatDate( dateVal, dateTimeSvc.getSessionDateFormat() );
    vmoProp.dateApi.timeValue = dateTimeSvc.formatTime( dateVal, dateTimeSvc.getSessionDateFormat() );
}

export function initCtx() {
    appCtxSvc.registerCtx( 'egtechShowTemplates', false );
    appCtxSvc.registerCtx( 'egtechSelectedTemplate', null );
}

export function toggleCtx( data ) {
    const show = data.showTemplates && data.showTemplates.dbValue === true;
    appCtxSvc.updateCtx( 'egtechShowTemplates', show );
    if( !show ) { appCtxSvc.updateCtx( 'egtechSelectedTemplate', null ); }
}

export function onTemplateSelect( selectedObjects ) {
    const selected = selectedObjects && selectedObjects.length > 0 ? selectedObjects[ 0 ] : null;
    appCtxSvc.updateCtx( 'egtechSelectedTemplate', selected );

    if( !selected ) { return Promise.resolve( {} ); }

    // start_date / finish_date 프로퍼티 로드 후 create 폼에 적용
    return soaSvc.post( 'Core-2006-03-DataManagement', 'getProperties', {
        objects: [ selected ],
        attributes: [ 'start_date', 'finish_date' ]
    } ).then( function() {
        _applyDatesToCreateForm( selected );
    } );
}

function _applyDatesToCreateForm( templateVmo ) {
    try {
        // TC 공식 패턴: addObjectUtils로 create 폼의 editable property 객체 획득
        const editableProps = addObjectUtils.getObjCreateEditableProperties(
            'Schedule', 'CREATE', [ 'start_date', 'finish_date' ]
        );

        if( !editableProps ) {
            console.warn( 'EGTech: create 폼 property 획득 실패' );
            return;
        }

        const updatedProps = [];

        if( editableProps.start_date && templateVmo.props && templateVmo.props.start_date ) {
            const startProp = { ...editableProps.start_date };
            setDateValueForProp( startProp, new Date( templateVmo.props.start_date.dbValues[ 0 ] ) );
            updatedProps.push( startProp );
        }

        if( editableProps.finish_date && templateVmo.props && templateVmo.props.finish_date ) {
            const finishProp = { ...editableProps.finish_date };
            setDateValueForProp( finishProp, new Date( templateVmo.props.finish_date.dbValues[ 0 ] ) );
            updatedProps.push( finishProp );
        }

        if( updatedProps.length > 0 ) {
            // TC 공식 패턴: datasource에 반영 → XRT 폼 UI 업데이트
            xrtUtilities.updateObjectsInDataSource( updatedProps, 'CREATE', 'Schedule' );
        }
    } catch( e ) {
        console.warn( 'EGTech: 날짜 적용 실패', e );
    }
}

export default { initCtx, toggleCtx, onTemplateSelect };
