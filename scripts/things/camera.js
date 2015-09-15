elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.camera', function() {
    this.createObject3D = function() {
      var cam = new THREE.PerspectiveCamera(75, 4/3, .1, 1000); // FIXME - need better default handling
      return cam;
    }
    this.createChildren = function() {
      var camhelper = new THREE.CameraHelper(this.objects['3d']);
      var scene = this.objects['3d'];
      while (!(scene instanceof THREE.Scene)) {
        scene = scene.parent;
      }
      //scene.add(camhelper);
    }
  }, elation.engine.things.generic);
});
