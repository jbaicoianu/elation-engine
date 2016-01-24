elation.require([ ], function() {
  elation.extend("engine.systems.sound", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.enabled = true;
    this.volume = 100;

    Object.defineProperty(this, 'volume', {get: function() { return this.reallistener.getMasterVolume(); }, set: function(v) { console.log('im a guy', v);this.reallistener.setMasterVolume(v); }});

    this.system_attach = function(ev) {
      console.log('INIT: sound');
      this.reallistener = new THREE.AudioListener();

      this.up = new THREE.Vector3(0,1,0);
      this.front = new THREE.Vector3(0,0,-1);

      this.lastframepos = new THREE.Vector3();
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: sound');
    }
    this.engine_frame = function(ev) {
    }
    this.setActiveListener = function(listener) {
      this.listener = listener;
      listener.add(this.reallistener);
    }
    this.getActiveListener = function() {
      return this.listener;
    }
    this.getRealListener = function() {
      return this.reallistener;
    }
    this.mute = function(mutestate) {
      this.enabled = (typeof mutestate == 'undefined' ? false : !mutestate);
      if (this.enabled) {
        this.reallistener.context.resume();
      } else {
        this.reallistener.context.suspend();
      }
    }
    this.toggleMute = function() {
      this.mute(this.enabled);
    }
    this.setVolume = function(v) {
      this.reallistener.setMasterVolume(v / 100);
    }
  });
  elation.component.add('engine.systems.sound.config', function() {
    this.init = function() {
        this.args.orientation = 'vertical'
        elation.engine.systems.render.config.extendclass.init.call(this);

        this.client = this.args.client;
        this.engine = this.client.engine;
        this.view = this.client.view;
        this.soundsystem = this.engine.systems.sound;

        var soundpanel = elation.ui.panel({ 
          orientation: 'vertical',
          classname: 'engine_config_section',
          append: this 
        });

        // Sound Settings
        var soundlabel = elation.ui.labeldivider({
          append: soundpanel,
          label: '3D Sound Settings'
        });
        var mute = elation.ui.toggle({
          label: 'Mute',
          append: soundpanel,
          events: { toggle: elation.bind(this.soundsystem, this.soundsystem.toggleMute) }
        });
        var volume = elation.ui.slider({
          append: soundpanel,
          min: 1,
          max: 100,
          snap: 1,
          handles: [
            {
              name: 'handle_one_volume',
              value: this.soundsystem.volume,
              labelprefix: 'Volume:',
              bindvar: [this.soundsystem, 'volume']
            }
          ],
          //events: { ui_slider_change: elation.bind(this.soundsystem, function() { this.setVolume(this.volume); }) }
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
