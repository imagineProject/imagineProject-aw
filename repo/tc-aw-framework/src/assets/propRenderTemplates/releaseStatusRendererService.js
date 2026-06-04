/* eslint-disable complexity */
// Copyright (c) 2023 Siemens

import appCtxSvc from 'js/appCtxService';
import cdm from 'soa/kernel/clientDataModel';
import splmTablePubSvc from 'js/splmTablePublishedService';
import { getBaseUrlPath } from 'app';

export const releaseStatusRenderer = function( vmo, containerElement, field, tooltipProps ) {
    if( !vmo.props || !vmo.props[ field ] || !vmo.props[ field ].dbValues ) {
        return;
    }
    const release_status_uids = vmo.props[ field ].dbValues;
    if( release_status_uids.length > 0 ) {
        let displayPref = appCtxSvc.getCtx( 'preferences.AWC_TableIndicatorDisplay' );
        displayPref = displayPref ? displayPref[ 0 ].toLowerCase() : 'imageandtext';
        const docFrag = document.createDocumentFragment();
        containerElement.classList.add( 'aw-splm-tableIndicatorRenderer' );
        // remove default 4 px padding on custom cell renderer elements
        delete containerElement.style.paddingLeft;

        for( let i = 0; i < release_status_uids.length; i++ ) {
            const release_status_uid = release_status_uids[ i ];
            const releaseStatusBO = cdm.getObject( release_status_uid );
            const releaseStatus = releaseStatusBO.props.object_name ? releaseStatusBO.props.object_name.dbValues[ 0 ] : '';
            const releaseStatusName = releaseStatusBO.props.object_name ? releaseStatusBO.props.object_name.uiValues[ 0 ] : '';
            const liElem = document.createElement( 'li' );
            liElem.classList.add( splmTablePubSvc.CLASS_TABLE_NON_EDIT_CELL_LIST_ITEM, 'aw-visual-indicatorTableItem' );
            let releaseStatusToolTip = '';
            if( tooltipProps ) {
                for( let j = 0; j < tooltipProps.length; j++ ) {
                    const tooltipPropName = tooltipProps[ j ];
                    const toolTipPropVal = releaseStatusBO.props[ tooltipPropName ] ? releaseStatusBO.props[ tooltipPropName ].uiValues[ 0 ] : '';
                    if( toolTipPropVal ) {
                        releaseStatusToolTip += toolTipPropVal + '\n';
                    }
                }
            }

            if( displayPref === 'image' || displayPref === 'imageandtext' || displayPref === 'textandimage' ) {
                let imagePath = getBaseUrlPath() + '/image/';
                switch ( releaseStatus ) {
                    case 'Created':
                        imagePath += 'indicatorFlagWhite16.svg';
                        break;
                    case 'Vm0Created':
                        imagePath += 'indicatorFlagWhite16.svg';
                        break;
                    case 'Approved':
                        imagePath += 'indicatorReleasedApproved16.svg';
                        break;
                    case 'Arm0Released':
                    case 'TCM Released':
                        imagePath += 'indicatorReleasedTCMReleased16.svg';
                        break;
                    case 'Pending':
                    case 'Approval Pending':
                    case 'Vm0ApprovalPending':
                        imagePath += 'indicatorReleasedPending16.svg';
                        break;
                    case 'Obsolete':
                        imagePath += 'indicatorReleasedObsolete16.svg';
                        break;
                    case 'Arm0Rejected':
                    case 'Rejected':
                        imagePath += 'indicatorReleasedRejected16.svg';
                        break;
                    case 'PlanningSyncState':
                        imagePath += 'indicatorReleasedPlanningSyncState16.svg';
                        break;
                    case 'TC Baselined':
                    case 'Baseline':
                        imagePath += 'indicatorReleasedTCBaselined16.svg';
                        break;
                    case 'Validation':
                        imagePath += 'indicatorReleasedValidation16.svg';
                        break;
                    case 'Arm0InReview':
                    case 'In Review':
                        imagePath += 'indicatorReadOnly16.svg';
                        break;
                    case 'Draft':
                        imagePath += 'indicatorDraft16.svg';
                        break;
                    case '0':
                        imagePath += 'indicatorStatus0Flag16.svg';
                        break;
                    case '10':
                        imagePath += 'indicatorStatus10Flag16.svg';
                        break;
                    case '20':
                        imagePath += 'indicatorStatus20Flag16.svg';
                        break;
                    case '30':
                        imagePath += 'indicatorStatus30Flag16.svg';
                        break;
                    case '40':
                        imagePath += 'indicatorStatus40Flag16.svg';
                        break;
                    case '50':
                        imagePath += 'indicatorStatus50Flag16.svg';
                        break;
                    case '60':
                        imagePath += 'indicatorStatus60Flag16.svg';
                        break;
                    case '70':
                        imagePath += 'indicatorStatus70Flag16.svg';
                        break;
                    case '80':
                        imagePath += 'indicatorStatus80Flag16.svg';
                        break;
                    case '90':
                        imagePath += 'indicatorStatus90Flag16.svg';
                        break;
                    default:
                        imagePath += 'indicatorReleased16.svg';
                }
                const iconElem = document.createElement( 'img' );
                iconElem.src = imagePath;
                iconElem.title = releaseStatusToolTip;
                iconElem.alt = releaseStatusToolTip;
                iconElem.classList.add( 'aw-visual-indicator', 'aw-visual-indicatorTableIcon' );
                liElem.appendChild( iconElem );
            }

            if( displayPref === 'imageandtext' || displayPref === 'textandimage' ) {
                const textElem = document.createElement( 'span' );
                textElem.innerHTML = splmTablePubSvc.addHighlights( releaseStatusName );
                textElem.title = releaseStatusToolTip;
                textElem.classList.add( 'aw-visual-indicatorTableText' );
                liElem.appendChild( textElem );
            }

            // Special case, if only text display, as we will display differently than others
            // This will be similar to table's default plainTextCellRenderer for arrays.
            if( displayPref === 'text' ) {
                const liInnerText = document.createElement( 'span' );
                liInnerText.classList.add( 'aw-splm-tableCellText' );
                liInnerText.innerHTML = splmTablePubSvc.addHighlights( releaseStatusName );
                liElem.appendChild( liInnerText );
            }

            if( liElem.childNodes.length > 0 ) {
                docFrag.appendChild( liElem );
            }
        }
        // Text only is special case, we will use ul and add li elements to it
        const ulElem = document.createElement( 'ul' );
        ulElem.classList.add( 'aw-jswidgets-arrayNonEditValueCellList' );
        if( displayPref === 'text' ) {
            ulElem.classList.add( 'aw-visual-indicatorTableTextOnly' );
        }
        ulElem.appendChild( docFrag );
        containerElement.appendChild( ulElem );
    }
};

export default {
    releaseStatusRenderer
};
