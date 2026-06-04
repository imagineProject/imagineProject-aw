// Copyright (c) 2022 Siemens

import _ from 'lodash';
import localeService from 'js/localeService';

export const getCurrentLocale = () => {
    const awToGanttLocaleMap = {
        'en_US': 'en',
        'cs_CZ': 'cs',
        'de': 'de',
        'es': 'es',
        'fr': 'fr',
        'it': 'it',
        'ja_JP': 'jp',
        'ko_KR': 'kr',
        'pl_PL': 'pl',
        'pt_BR': 'pt',
        'ru_RU': 'ru',
        'zh_CN': 'cn',
        'zh_TW': 'cn' // DHTMLX does not support Taiwan; fallback to Chinese-China and override the translation.
    };
    return _.get( awToGanttLocaleMap, localeService.getLocale(), 'en' );
};

export const getLocaleOverride = () => {
    const textBundle = localeService.getLoadedText( 'GanttInterfaceConstants' );

    return {
        date: {
            month_full: getMonthInFull( textBundle ),
            month_short: getMonthInShort( textBundle ),
            day_full: getDayInFull( textBundle ),
            day_short: getDayInShort( textBundle )
        },
        labels: getLabels( textBundle )
    };
};

const getMonthInFull = ( textBundle ) => {
    return [ textBundle[ 'gantt_month_January' ],
        textBundle[ 'gantt_month_February' ],
        textBundle[ 'gantt_month_March' ],
        textBundle[ 'gantt_month_April' ],
        textBundle[ 'gantt_month_May' ],
        textBundle[ 'gantt_month_June' ],
        textBundle[ 'gantt_month_July' ],
        textBundle[ 'gantt_month_August' ],
        textBundle[ 'gantt_month_September' ],
        textBundle[ 'gantt_month_October' ],
        textBundle[ 'gantt_month_November' ],
        textBundle[ 'gantt_month_December' ]
    ];
};

const getMonthInShort = ( textBundle ) => {
    return [ textBundle[ 'gantt_month_Jan' ],
        textBundle[ 'gantt_month_Feb' ],
        textBundle[ 'gantt_month_Mar' ],
        textBundle[ 'gantt_month_Apr' ],
        textBundle[ 'gantt_month_May_short' ],
        textBundle[ 'gantt_month_Jun' ],
        textBundle[ 'gantt_month_Jul' ],
        textBundle[ 'gantt_month_Aug' ],
        textBundle[ 'gantt_month_Sep' ],
        textBundle[ 'gantt_month_Oct' ],
        textBundle[ 'gantt_month_Nov' ],
        textBundle[ 'gantt_month_Dec' ]
    ];
};

const getDayInFull = ( textBundle ) => {
    return [ textBundle[ 'gantt_day_Sunday' ],
        textBundle[ 'gantt_day_Monday' ],
        textBundle[ 'gantt_day_Tuesday' ],
        textBundle[ 'gantt_day_Wednesday' ],
        textBundle[ 'gantt_day_Thursday' ],
        textBundle[ 'gantt_day_Friday' ],
        textBundle[ 'gantt_day_Saturday' ]
    ];
};

const getDayInShort = ( textBundle ) => {
    return [ textBundle[ 'gantt_day_sun' ],
        textBundle[ 'gantt_day_mon' ],
        textBundle[ 'gantt_day_tue' ],
        textBundle[ 'gantt_day_wed' ],
        textBundle[ 'gantt_day_thu' ],
        textBundle[ 'gantt_day_fri' ],
        textBundle[ 'gantt_day_sat' ]
    ];
};

const getLabels = ( textBundle ) => {
    return {
        new_task: textBundle[ 'gantt_label_new_task' ],
        icon_save: textBundle[ 'gantt_label_icon_save' ],
        icon_cancel: textBundle[ 'gantt_label_icon_cancel' ],
        icon_details: textBundle[ 'gantt_label_icon_details' ],
        icon_edit: textBundle[ 'gantt_label_icon_edit' ],
        icon_delete: textBundle[ 'gantt_label_icon_delete' ],
        confirm_closing: '',
        confirm_deleting: textBundle[ 'gantt_label_confirm_deleting' ],
        section_description: textBundle[ 'gantt_label_section_description' ],
        section_time: textBundle[ 'gantt_label_section_time' ],
        section_type: textBundle[ 'gantt_label_section_type' ],
        column_text: textBundle[ 'gantt_label_column_text' ],
        tooltip_text: textBundle[ 'gantt_tooltip_label_text' ],
        column_start_date: textBundle[ 'gantt_label_column_start_date' ],
        tooltip_start_date: textBundle[ 'gantt_tooltip_start_date' ],
        column_duration: textBundle[ 'gantt_label_column_duration' ],
        column_add: '',
        link: textBundle[ 'gantt_label_link' ],
        link_start: textBundle[ 'gantt_label_link_start' ],
        link_end: textBundle[ 'gantt_label_link_end' ],
        type_task: textBundle[ 'gantt_label_type_task' ],
        type_project: textBundle[ 'gantt_label_type_project' ],
        type_milestone: textBundle[ 'gantt_label_type_milestone' ],
        minutes: textBundle[ 'gantt_label_minutes' ],
        hours: textBundle[ 'gantt_label_hours' ],
        days: textBundle[ 'gantt_label_days' ],
        weeks: textBundle[ 'gantt_label_weeks' ],
        months: textBundle[ 'gantt_label_months' ],
        years: textBundle[ 'gantt_label_years' ],
        today: textBundle[ 'gantt_label_today' ],
        column_finish_date: textBundle[ 'gantt_column_finish_date' ],
        tooltip_finish_date: textBundle[ 'gantt_tooltip_finish_date' ],
        deliverables: textBundle[ 'gantt_label_deliverables' ],
        members: textBundle[ 'gantt_label_members' ],
        date: textBundle[ 'gantt_label_date' ],
        status: textBundle[ 'gantt_tooltip_status' ],
        resource: textBundle[ 'gantt_tooltip_resource' ],
        timeline_label_plannedDate: textBundle[ 'timeline_label_plannedDate' ],
        timeline_label_forecastDate: textBundle[ 'timeline_label_forecastDate' ],
        timeline_label_actualDate: textBundle[ 'timeline_label_actualDate' ]
    };
};

export default {
    getCurrentLocale,
    getLocaleOverride
};
