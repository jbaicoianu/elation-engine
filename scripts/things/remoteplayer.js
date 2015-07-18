
elation.require(['engine.things.generic', 'engine.things.maskgenerator'], function() {
  
elation.component.add('engine.things.remoteplayer', function() {
  this.postinit = function() {
    this.defineProperties({startposition: {type: 'vector3', default: new THREE.Vector3()}})
  };

  this.createObject3D = function() {
    var geo = new THREE.CylinderGeometry(1, 1, 4, 8),
        mat = new THREE.MeshPhongMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }),
        mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }; 
  
  this.createChildren = function() {
    this.mask = this.spawn('maskgenerator', this.properties.player_id + '_mask', {
      'seed': this.properties.player_id.toString(),
      'tilesize': 0.25,
      'position': [0, 0, -1],
      'player_id': this.properties.player_id
    });
  };
}, elation.engine.things.generic);

});
