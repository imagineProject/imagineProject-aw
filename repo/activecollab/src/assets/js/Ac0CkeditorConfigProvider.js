// Copyright 2020 Siemens Product Lifecycle Management Software Inc.
/* eslint-disable class-methods-use-this */

import localeSvc from 'js/localeService';
import { Ac0CkeditorConfigProviderBase } from 'js/Ac0CkeditorService';

/**
 * Ckeditor Configuration provider
 * @module js/Ac0CkeditorConfigProvider
 */
export default class Ac0CkeditorConfigProvider extends Ac0CkeditorConfigProviderBase {
    getCkeditor4Config() {
        var localeName = _getLocaleName();
        return {
            toolbarGroups: [
                { name: 'basicstyles', groups: [ 'basicstyles' ] },
                { name: 'styles' },
                { name: 'colors' },
                { name: 'insert' }
            ],
            removeButtons: 'Underline,FontSize,Smiley,Strike,Subscript,Superscript,RemoveFormat,Outdent,Indent,Blockquote,' +
                'CreateDiv,JustifyLeft,JustifyCenter,JustifyRight,JustifyBlock,BidiLtr,BidiRtl,Language,' +
                'Anchor,Image,Flash,Table,HorizontalRule,SpecialChar,PageBreak,Iframe,Styles,Format,ShowBlocks,' +
                'Italic',
            linkShowTargetTab: false,
            toolbarCanCollapse: false,
            skin: 'moono_cus',
            language: localeName,
            extraPlugins: 'ac0ImageHandler',
            removePlugins: 'resize,flash,save,iframe,pagebreak,horizontalrule,elementspath,div,scayt,wsc'
        };
    }
    getCkeditor5Config() {
        var localeName = _getLocaleName();
        return {
            toolbar: [
                'Bold', '|',
                'FontFamily', '|',
                'FontColor', 'FontBackgroundColor', '|',
                'ac0InsertImage', '|'
            ],
            language: localeName,
            extraPlugins: [ import( 'js/ac0InsertImage' ).then( v => v.default ) ],
            removePlugins: [ 'ImageResize', 'ImageCaption', 'resize', 'flash', 'save', 'iframe', 'pagebreak', 'horizontalrule', 'elementspath', 'div', 'scayt', 'wsc', 'MediaEmbedToolbar', 'ImageToolbar' ]
        };
    }
}

var _getLocaleName = function() {
    var currentLocale = localeSvc.getLocale();
    var localeName = '';

    if( currentLocale !== null && currentLocale !== '' ) {
        localeName = currentLocale.substring( 0, 2 );
    }

    // Normally first 2 characters, but we have 2 exceptions. And yes there is a dash and not an underscore.
    if( currentLocale === 'pt_BR' ) {
        localeName = 'pt-br';
    } else if( currentLocale === 'zh_CN' ) {
        localeName = 'zh-cn';
    }

    return localeName;
};
