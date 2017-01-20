elation.require([ "ui.panel", "share.picker", "share.targets.imgur", "share.targets.dropbox", "share.targets.googledrive", "share.targets.youtube", "share.targets.file"], function() {
  elation.component.add('engine.sharing.config', function() {
    this.init = function() {
        this.args.orientation = 'vertical'
        elation.engine.sharing.config.extendclass.init.call(this);

        this.client = this.args.client;
        this.engine = this.client.engine;
        this.view = this.client.view;

        var sharepanel = elation.ui.panel({ 
          orientation: 'vertical',
          classname: 'engine_config_section',
          append: this 
        });

        var sharepicker = this.client.sharepicker;
        if (!sharepicker) {
          this.client.createSharePicker();
          sharepicker = this.client.sharepicker;
        }
        var foo = sharepicker.showTargetSelector('image/png', sharepanel).then(function(f) {
          console.log('mfing ya', f);
        });

      // Capture Settings
/*
      var capturelabel = elation.ui.labeldivider({
        append: capturepanel,
        label: 'Capture Settings'
      });
      var codec = elation.ui.select({
        append: capturepanel,
        label: 'Codec',
        items: ['h264','gif']
      });
      var fps = elation.ui.select({
        append: capturepanel,
        label: 'FPS',
        items: [5,10,25,30,45,60]
      });
*/
    }
  }, elation.ui.panel);
});

