elation.extend("engine.systems.physics", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.system_attach = function(ev) {
    console.log('INIT: physics');
  }
  this.engine_start = function(ev) {
    //console.log("PHYSICS: starting");
    elation.physics.system.start();
  }
  this.engine_frame = function(ev) {
    //console.log("FRAME: physics");
    elation.physics.system.step(ev.data.delta);
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: physics');
  }
});

