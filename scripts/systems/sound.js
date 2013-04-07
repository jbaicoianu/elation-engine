elation.extend("engine.systems.sound", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.enabled = true;

  this.system_attach = function(ev) {
    console.log('INIT: sound', this);
    this.stage = new AudioStage();

    this.up = new THREE.Vector3(0,1,0);
    this.front = new THREE.Vector3(0,0,-1);

    this.lastframepos = new THREE.Vector3();
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: sound');
  }
  this.engine_frame = function(ev) {
    var render = this.engine.systems.get('render');
    if (render.views['main'] && this.stage.context) {
      var camera = render.views['main'].camera;

      var m = camera.matrixWorld;
      this.front.set(-m.elements[8], -m.elements[9], -m.elements[10]);
      this.up.set(m.elements[4], m.elements[5], m.elements[6]);


      this.stage.context.listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
      this.stage.context.listener.setOrientation(this.front.x, this.front.y, this.front.z, this.up.x, this.up.y, this.up.z);

      /*
      var tmpvel = camera.position.clone().sub(this.lastframepos).divideScalar(ev.data.delta);
      this.lastframepos.copy(camera.position);
      this.stage.context.listener.setVelocity(tmpvel.x, tmpvel.y, tmpvel.z);
      */
    }
  }
  this.mute = function(mutestate) {
    this.enabled = (typeof mutestate == 'undefined' ? false : !mutestate);
  }
});

