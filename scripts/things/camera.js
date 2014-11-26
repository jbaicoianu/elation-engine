elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.camera', function() {
    this.createObject3D = function() {
      return new THREE.PerspectiveCamera(80, 4/3, .1, 1000); // FIXME - need better default handling
    }
  }, elation.engine.things.generic);
});
