elation.component.add('engine.things.cylinder', function() {
  this.postinit = function() {
    this.defineProperties({
      'radius': { type: 'float', default: 1.0 },
      'height': { type: 'float', default: 1.0 }
    });
  }
  this.createObject3D = function() {
    var geo = new THREE.CylinderGeometry(this.properties.radius, this.properties.radius, this.properties.height, 16, 4);
    var material = new THREE.MeshPhongMaterial({color: 0xff0000});
    var mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  this.createForces = function() {
		this.objects.dynamics.setDamping(.9, .1);
		this.objects.dynamics.restitution = .1;
		this.objects.dynamics.addForce('gravity', new THREE.Vector3(0,-9.8,0));
  }
}, elation.engine.things.generic);
