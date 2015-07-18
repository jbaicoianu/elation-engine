elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.testplane', function() {
    this.createObject3D = function() {
      return new THREE.Object3D();
    };
    
    this.createChildren = function() {
      this.plane = this.spawn('plane', 'plane', { 'position': [0, 0, 0] });
    };
  }, elation.engine.things.generic);
  
  elation.component.add('engine.things.plane', function() {
    this.createObject3D = function() {
      var geo = new THREE.BoxGeometry(64, 2, 64),
          mat = new THREE.MeshLambertMaterial({ 
            map: elation.engine.materials.getTexture('/media/testchamber/dirt.jpg', [20, 20]),
            normalMap: elation.engine.materials.getTexture('/media/space/textures/dirt-normal.jpg'),
          });
      return new THREE.Mesh(geo, mat)
    }
  }, elation.engine.things.generic);
});