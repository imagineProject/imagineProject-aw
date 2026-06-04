// Copyright 2020 Siemens Product Lifecycle Management Software Inc.
/* global
   CKEDITOR5
*/
import eventBus from 'js/eventBus';
import { ckeditor5ServiceInstance } from 'js/Ac0CkeditorServiceInstance';

/**
 * Module for the Ckeditor5 in Active Collaboration Panel
 *
 * @module js/ac0InsertImage
 */

export default class AC0InsertImage extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ InsertImageEditing, InsertImageUI ];
    }
}

class InsertImageUI extends ckeditor5ServiceInstance.Plugin {
    init() {
        const editor = this.editor;
        editor.ui.componentFactory.add( 'ac0InsertImage', locale => {
            // The state of the button will be bound to the widget command.
            const command = editor.commands.get( 'ac0InsertImage' );

            // The button will be an instance of ButtonView.
            const buttonView = new ckeditor5ServiceInstance.ButtonView( locale );
            buttonView.set( {
                label: 'Insert Image',
                tooltip: true,
                icon: cmdInsertImage24
            } );

            // Bind the state of the button to the command.
            buttonView.bind( 'isOn', 'isEnabled' ).to( command, 'value', 'isEnabled' );

            // Execute the command when the button is clicked (executed).
            this.listenTo( buttonView, 'execute', () => editor.execute( 'ac0InsertImage' ) );

            return buttonView;
        } );
    }
}

class InsertImageEditing extends ckeditor5ServiceInstance.Plugin {
    static get requires() {
        return [ ckeditor5ServiceInstance.Widget ];
    }

    init() {
        this._defineSchema();
        this._defineConverters();

        this.editor.commands.add( 'ac0InsertImage', new InsertImageCommand( this.editor ) );
    }

    _defineSchema() {
        const schema = this.editor.model.schema;

        schema.register( 'ac0InsertImage', {
            isObject: true,
            allowWhere: '$block'
        } );
    }

    _defineConverters() {
        const conversion = this.editor.conversion;

        conversion.for( 'upcast' ).elementToElement( {
            model: 'ac0InsertImage',
            view: {
                name: 'section',
                classes: 'ac0InsertImage'
            }
        } );

        conversion.for( 'downcast' ).elementToElement( {
            model: 'ac0InsertImage',
            view: ( modelElement, conversionApi ) => {
                const viewWriter = conversionApi.writer;
                const section = viewWriter.createContainerElement( 'section', { class: 'ac0InsertImage' } );

                return ckeditor5ServiceInstance.toWidget( section, viewWriter );
            }
        } );
    }
}

class InsertImageCommand extends ckeditor5ServiceInstance.Command {
    constructor( editor ) {
        super( editor );
        this._eventStr = '';
    }

    setEventStr( str ) {
        this._eventStr = str;
    }

    execute() {
        const editor = this.editor;
        editor.eventBus = eventBus;
        var form = document.createElement( 'form' );
        form.setAttribute( 'id', 'fileUploadForm' );

        var input = document.createElement( 'input' );
        form.appendChild( input );

        input.setAttribute( 'type', 'file' );
        input.setAttribute( 'id', 'fmsFile' );
        input.setAttribute( 'name', 'fmsFile' );
        input.setAttribute( 'accept', 'image/x-png,image/gif,image/jpeg,image/jpg' );

        input.addEventListener( 'change', function() {
            var file = this.files[ 0 ];

            if ( file ) {
                var eventBus = editor.eventBus;

                var eventData = {
                    clientid : this.value,
                    file : file,
                    form : this.form,
                    ckeInstance: editor
                };
                eventBus.publish( editor.commands._commands.get( 'ac0InsertImage' )._eventStr,
                    eventData );
            }
        }, false );

        input.click();
    }

    refresh() {
        const model = this.editor.model;
        const selection = model.document.selection;
        const allowedIn = model.schema.findAllowedParent( selection.getFirstPosition(), 'ac0InsertImage' );
        this.isEnabled = allowedIn !== null;
    }

    destroy() {
        super.destroy();
        const editor = this.editor;
        eventBus.unsubscribe( editor.commands._commands.get( 'ac0InsertImage' )._eventStr );
    }
}

const cmdInsertImage24 = '<svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px"\n\t viewBox="0 0 24 24" enable-background="new 0 0 24 24" xml:space="preserve">\n\t<path class="aw-theme-iconOutline" fill="#464646" d="M3,7.5C3,8.9,4.1,10,5.5,10S8,8.9,8,7.5S6.9,5,5.5,5S3,6.1,3,7.5z M7,7.5C7,8.3,6.3,9,5.5,9S4,8.3,4,7.5\n\t\tS4.7,6,5.5,6S7,6.7,7,7.5z"/>\n\t<path class="aw-theme-iconOutline" fill="#464646" d="M13.4,11.5l3.3-5.3l2.1,3c0.2,0.2,0.5,0.3,0.7,0.1c0.2-0.2,0.3-0.5,0.1-0.7l-2.9-4.2l-3.4,5.3l-2.6-3.5\n\t\tL3.6,16.7c-0.1,0.1-0.1,0.2-0.1,0.3H1V3h20v7h1V2H0v16h9v-1H4.6l6.2-9L13.4,11.5z"/>\n\t<path class="aw-theme-iconOutline" fill="#464646" d="M17.5,11c-3.6,0-6.5,2.9-6.5,6.5c0,3.6,2.9,6.5,6.5,6.5c3.6,0,6.5-2.9,6.5-6.5C24,13.9,21.1,11,17.5,11z\n\t\t M17.5,23c-3,0-5.5-2.5-5.5-5.5c0-3,2.5-5.5,5.5-5.5c3,0,5.5,2.5,5.5,5.5C23,20.5,20.5,23,17.5,23z"/>\n\t<polygon class="aw-theme-iconOutline" fill="#464646" points="21,17 18,17 18,14 17,14 17,17 14,17 14,18 17,18 17,21 18,21 18,18 21,18 \t"/>\n</svg>\n';
