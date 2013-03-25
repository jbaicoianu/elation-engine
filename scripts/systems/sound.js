elation.extend("engine.systems.sound", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.system_attach = function(ev) {
    console.log('INIT: sound', this);
    this.stage = new AudioStage();

    this.stage.addCues({
      fart: {
        file: '/media/space/sounds/fart4.mp3',
        loop: false,
        vol: 1,
        poly: true,
      }
    });
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: sound');
  }
  this.play = function(name) {
    this.stage.cues.fart.play();
  }
});

