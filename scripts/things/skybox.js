elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.skybox', function() {
    this.postinit = function() {
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      return obj;
    }
    this.setTexture = function(texture) {
      var scene = this.engine.systems.world.scene['world-3d'];
      scene.background = texture;
      elation.events.fire({element: this, type: 'skybox_update', bubbles: true});
    }
  }, elation.engine.things.generic);
});
