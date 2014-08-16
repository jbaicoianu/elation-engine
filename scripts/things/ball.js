elation.component.add('engine.things.ball', function() {
  this.postinit = function() {
    this.defineProperties({
      radius: { type: 'float', default: 1 },
      lifetime: { type: 'float', default: 0 },
      gravity: { type: 'bool', default: true },
    });
    if (this.properties.lifetime != 0) {
      this.age = 0;
      elation.events.add(this.engine, 'engine_frame', elation.bind(this, function(ev) { this.age += ev.data.delta * this.engine.systems.physics.timescale; if (this.age > this.properties.lifetime) this.die(); }));
    } 
  }
  this.createObject3D = function() {
    var geo = new THREE.SphereGeometry(this.properties.radius, 36, 18);
    var mat = new THREE.MeshPhongMaterial({
      color: 0xd74e2e, 
      emissive: 0x330000, 
      map: elation.engine.materials.getTexture('/media/space/textures/bball.jpg'), 
      bumpMap: elation.engine.materials.getTexture('/media/space/textures/bball-bump.png'), 
      bumpScale: .05
    });
    var obj = new THREE.Mesh(geo, mat);
    obj.castShadow = true;
    return obj;
  }
  this.createForces = function() {
		this.objects.dynamics.setDamping(.9);
		this.objects.dynamics.restitution = .9;
    if (this.properties.gravity) {
  		this.objects.dynamics.addForce('gravity', new THREE.Vector3(0,-9.8,0));
    }
  } 
}, elation.engine.things.generic);
