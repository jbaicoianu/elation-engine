elation.require([ ], function() {
  elation.extend("engine.systems.sound", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.enabled = true;
    this.canPlaySound = false;
    this.volume = 100;

    this.channels = {};

    Object.defineProperty(this, 'volume', {get: function() { return this.reallistener.getMasterVolume(); }, set: function(v) { this.reallistener.setMasterVolume(v); }});

    this.system_attach = function(ev) {
      console.log('INIT: sound');
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: sound');
    }
    this.engine_frame = function(ev) {
    }
    this.setActiveListener = function(listener) {
      this.listener = listener;
      if (this.reallistener) {
        listener.add(this.reallistener);
      }
    }
    this.getActiveListener = function() {
      return this.listener;
    }
    this.getRealListener = function() {
      // Ideally, we'd show some UI element that indicates that this page will start playing sound when focused, and if we want to get
      // fancy, volume for the whole sound system should fade in from 0 to 1 over 3-5 seconds to give users a chance to adjust system volume
      // if needed
      if (!this.reallistener) {
        this.reallistener = new THREE.AudioListener();
        console.log('[sound] Creating audio context', this.reallistener);
        if (this.listener) {
          this.listener.add(this.reallistener);
        }
      }
      return this.reallistener;
    }
    this.getRealListenerAsync = async function() {
      return new Promise(resolve => {
        if (this.reallistener) {
          resolve(this.reallistener);
        } else {
          elation.events.add(this, 'sound_enabled', ev => {
            resolve(this.getRealListener());
          });
        }
      });
    }
    this.getOutputChannel = async function(channelname='main') {
      if (this.channels[channelname]) {
        return this.channels[channelname];
      }

      let listener = await this.getRealListenerAsync();

      let channel = listener.context.createGain();
      channel.connect(listener.getInput());

      this.channels[channelname] = channel;

      return channel;
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
    this.enableSound = function() {
      if (!this.canPlaySound) {
        this.canPlaySound = true;
        elation.events.fire({type: 'sound_enabled', element: this});
      }
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
          label: 'Volume',
          handles: [
            {
              name: 'handle_one_volume',
              value: this.soundsystem.volume,
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
