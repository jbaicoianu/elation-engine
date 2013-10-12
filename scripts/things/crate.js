elation.component.add('engine.things.crate', function() {
  this.createObject3D = function() {
    var cubemat = new THREE.MeshPhongMaterial({map: elation.engine.utils.materials.getTexture('/media/space/textures/crate.gif')});
    var cubegeo = new THREE.CubeGeometry(1,1,1);
    //cubegeo.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, 0));
    setTimeout(elation.bind(this, this.initForces), 0);
    return new THREE.Mesh(cubegeo, cubemat);
  }
  this.initForces = function() {
    if (this.initialized) return;
    this.initialized = true;
    this.objects.dynamics.addForce('gravity', new THREE.Vector3(0,-9.8,0));
    //this.objects.dynamics.addForce('static', new THREE.Vector3(0,-9800,0));
    //this.objects.dynamics.addForce('drag', 1);
    this.objects.dynamics.setDamping(0.6, 0.8);
    this.objects['3d'].geometry.computeBoundingBox();
    this.objects['3d'].geometry.computeBoundingSphere();
		//this.objects.dynamics.setCollider('box', this.objects['3d'].geometry.boundingBox);
		this.objects.dynamics.setCollider('sphere', this.objects['3d'].geometry.boundingSphere.radius);
		this.objects.dynamics.updateMoment('box', this.objects['3d'].geometry.boundingBox);
    this.objects.dynamics.addForce('buoyancy', {
      volume: 1,
      density: 1000,
      maxdepth: 1,
      waterheight: 0,
      position: new THREE.Vector3(0,.1,0)
    });
  }
}, elation.engine.things.generic);
