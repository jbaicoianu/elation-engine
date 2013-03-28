elation.extend("engine.systems.sound", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.system_attach = function(ev) {
    console.log('INIT: sound', this);
    this.stage = new AudioStage();

    this.up = new THREE.Vector3(0,1,0);
    this.front = new THREE.Vector3(0,0,-1);
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: sound');
  }
  this.engine_frame = function(ev) {
    var camera = this.engine.systems.get('render').views['main'].camera;
    var m = camera.matrixWorld;

    this.front.set(-m.elements[8], -m.elements[9], -m.elements[10]);
    this.up.set(m.elements[4], m.elements[5], m.elements[6]);

    if (this.stage.context) {
      this.stage.context.listener.setPosition(camera.position.x, camera.position.y, camera.position.z);
      this.stage.context.listener.setOrientation(this.front.x, this.front.y, this.front.z, this.up.x, this.up.y, this.up.z);
    }
  }
});

