elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.plane', function() {
    this.postinit = function() {
      this.defineProperties({
        'width': { type: 'float', default: 1},
        'height': { type: 'float', default: 1},
        'color': { type: 'color', default: 0xcccccc},
      });
    }
    this.createObject3D = function() {
      var geo = new THREE.PlaneGeometry(this.properties.width, this.properties.height);
      var mat = new THREE.MeshPhongMaterial({color: this.properties.color});
      var mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }
  }, elation.engine.things.generic);
});
