elation.component.add('engine.things.ball', function() {
  this.postinit = function() {
    this.defineProperties({
      radius: { type: 'float', default: 1 },
      lifetime: { type: 'float', default: 0 },
    });
    this.engine.systems.controls.addContext('ball', {
      'doshit': ['keyboard_space', elation.bind(this, function(ev) { 
        if (ev.value == 1) {
          console.log('dur', this, ev);
          var cam = this.engine.systems.render.views['main'].camera;
          var campos = cam.localToWorld(new THREE.Vector3(0,0,0));
          var camdir = cam.localToWorld(new THREE.Vector3(0,0,-1)).sub(campos).normalize();
          camdir.multiplyScalar(12);
          var foo = this.engine.systems.world.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .375, mass: 1, position: campos, velocity: camdir, lifetime: 30 });
        }
      })]
    });
    this.engine.systems.controls.activateContext('ball');
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
      map: elation.engine.utils.materials.getTexture('/media/space/textures/bball.jpg'), 
      bumpMap: elation.engine.utils.materials.getTexture('/media/space/textures/bball-bump.png'), 
      bumpScale: .05
    });
    var obj = new THREE.Mesh(geo, mat);
    obj.castShadow = true;
    return obj;
  }
  this.createForces = function() {
		this.objects.dynamics.setDamping(.9);
		this.objects.dynamics.addForce('gravity', new THREE.Vector3(0,-9.8,0));
  } 
}, elation.engine.things.generic);
