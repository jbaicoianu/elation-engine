elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.crate', function() {
    this.createObject3D = function() {
      this.defineProperties({
        size: { type: 'float', default: 1 },
        lifetime: { type: 'float', default: 0 },
        gravity: { type: 'bool', default: true },
      });
      var cubemat = new THREE.MeshPhongMaterial({map: elation.engine.materials.getTexture('/media/space/textures/crate.gif')});
      var cubegeo = new THREE.BoxGeometry(this.properties.size, this.properties.size, this.properties.size);
      //cubegeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));
      setTimeout(elation.bind(this, this.initForces), 0);
      var mesh = new THREE.Mesh(cubegeo, cubemat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (this.properties.lifetime != 0) {
        this.age = 0;
        elation.events.add(this.engine, 'engine_frame', elation.bind(this, function(ev) { this.age += ev.data.delta * this.engine.systems.physics.timescale; if (this.age > this.properties.lifetime) this.die(); }));
      } 
      return mesh;
    }
    this.createForces = function() {
      if (this.initialized) return;
      this.initialized = true;
      if (this.properties.gravity) {
        this.objects.dynamics.addForce('gravity', new THREE.Vector3(0,-9.8,0));
      }
      //this.objects.dynamics.addForce('friction', .5);
      this.objects.dynamics.setDamping(0.9, 0.9);
      this.objects.dynamics.restitution = .9;
      this.objects['3d'].geometry.computeBoundingBox();
      this.objects['3d'].geometry.computeBoundingSphere();
  /*
      this.objects.dynamics.addForce('buoyancy', {
        volume: 1,
        density: 1000,
        maxdepth: 1,
        waterheight: 0,
        position: new THREE.Vector3(0,.1,0)
      });
  */
    }
  }, elation.engine.things.generic);
});
