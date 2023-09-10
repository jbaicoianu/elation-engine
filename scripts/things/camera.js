elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.camera', function() {
    this.postinit = function() {
      this.defineProperties({
        fov: { type: 'float', default: 75, set: this.updateFOV },
        near: { type: 'float', default: .01 },
        far: { type: 'float', default: 1000 },
        aspect: { type: 'float', default: 4/3 },
      });
    }
    this.createObject3D = function() {
      var cam = new THREE.PerspectiveCamera(this.properties.fov, this.properties.aspect, this.properties.near, this.properties.far);
      this.camera = cam;
      return cam;
    }
    this.createChildren = function() {
/*
      var camhelper = new THREE.CameraHelper(this.objects['3d']);
      var scene = this.objects['3d'];
      while (!(scene instanceof THREE.Scene)) {
        scene = scene.parent;
      }
*/
      //scene.add(camhelper);
    }
    this.updateFOV = function() {
      if (this.camera) {
        this.camera.fov = this.fov;
      }
    }
  }, elation.engine.things.generic);
});
