
elation.require(['engine.things.generic', 'engine.things.maskgenerator'], function() {
  
elation.component.add('engine.things.remoteplayer', function() {
  this.postinit = function() {
    this.defineProperties({
      startposition: {type: 'vector3', default: new THREE.Vector3()},
      player_id: {type: 'string', default: 'UnknownPlayer'},
      player_name: {type: 'string', default: 'UnknownPlayer'},
    });
  };

/*
  this.createObject3D = function() {
    var geo = new THREE.CylinderGeometry(1, 1, 4, 8),
        mat = new THREE.MeshPhongMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }),
        mesh = new THREE.Mesh(geo, mat);
    return mesh;
  }; 
*/
  
  this.createChildren = function() {
    this.torso = this.spawn('generic', this.properties.player_name + '_torso', {
      'position': [0,1,0],
    });
    this.neck = this.torso.spawn('generic', this.properties.player_name + '_neck', {
      'position': [0,0.6,0]
    });
    this.head = this.neck.spawn('generic', this.properties.player_name + '_head', {
      'position': [0,0,0],
    });
    this.face = this.head.spawn('maskgenerator', this.properties.player_name + '_mask', {
      'seed': this.properties.player_name,
      'position': [0,0,-0.125],
      collidable: false,
      'tilesize': 0.075,
      'player_id': this.properties.player_name
    });
    this.label = this.face.spawn('label', this.properties.player_name + '_label', {
      size: .1,
      align: 'center',
      collidable: false,
      text: this.properties.player_name,
      position: [0,0.35,0],
      orientation: [0,1,0,0]
    });
  };
}, elation.engine.things.generic);

});
