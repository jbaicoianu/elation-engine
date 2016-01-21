elation.require([ ], function() {
  elation.extend("engine.systems.sound", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.enabled = true;

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
  });
});
