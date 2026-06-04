// Copyright 2020 Siemens Product Lifecycle Management Software Inc.
/*global
 CKEDITOR
 */
 CKEDITOR.plugins.add( 'ac0ImageHandler',
{
    init: function( editor )
    {
        // Only add this button if browser supports File API
        if ( window.File )
        {
               editor.addCommand( 'ac0ImageCommand',
                       {
                           exec : function( editor )
                           {
                               var form = document.createElement ("form");
                               form.setAttribute ("id", "fileUploadForm");

                               var input = document.createElement ("input");
                               form.appendChild(input);
                               //form.append("fmsFile",input);

                               input.setAttribute ("type", "file");
                               input.setAttribute ("id", "fmsFile");
                               input.setAttribute ("name", "fmsFile");
                               input.setAttribute ("accept","image/x-png,image/gif,image/jpeg,image/jpg");

                               input.addEventListener('change', function(){

                                   var file = this.files[ 0 ];

                                   if ( file ) {
                                       var eventBus = editor.eventBus;
                                       var eventData = {
                                               "clientid" : this.value,
                                               "file" : file,
                                               "form" : this.form,
                                               "ckeInstance": editor
                                           };
                                           eventBus.publish( editor.insertImgEvtStr,
                                                           eventData);
                                   }

                                }, false);

                               input.click();
                           },
                           startDisabled: false
                       });

            editor.on( 'selectionChange', function( evt ) {
                var myCommand = this.getCommand( 'ac0ImageCommand' );
                if(myCommand) {
                    var ranges = editor.getSelection().getRanges();
                    if(ranges && ranges.length > 0 && !ranges[0].checkReadOnly()) {
                        myCommand.enable();
                    }else {
                        myCommand.disable();
                    }
                }
            });
            editor.ui.addButton( 'ac0ImageUpload',
            {
                label: 'Insert Image',
                command: 'ac0ImageCommand',
                icon: editor.getBaseURL + editor.getBaseUrlPath + "/image/cmdInsertImage24.svg",
                toolbar: 'insert,10'
            } );
        }

    }
} );
