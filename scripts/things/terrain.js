elation.component.add("engine.things.terrain", function() {
  this.postinit = function() {
    this.defineProperties({
      'color':          { type: 'color', default: 0x998877 },
      'simple':         { type: 'boolean', default: true },
      'size':           { type: 'float', default: 1000.0 },
      'resolution':     { type: 'int', default: 64 },
      'map':            { type: 'texture' },
      'normalMap':      { type: 'texture' },
      'displacementMap':{ type: 'texture' },
    });
  }
  this.createObject3D = function() {
    var planegeo = new THREE.PlaneGeometry(this.properties.size, this.properties.size, this.properties.resolution, this.properties.resolution);
    var matargs = {
      color: this.properties.color
    };
    if (this.properties.map) matargs.map = this.properties.map;
    if (this.properties.normalMap) matargs.normalMap = this.properties.normalMap;
    if (this.properties.displacementMap) matargs.displacementMap = this.properties.displacementMap;

    var planemat = new THREE.MeshPhongMaterial(matargs);
console.log('terrain!', matargs);
    var mat = new THREE.Matrix4().setRotationFromEuler(new THREE.Vector3(-Math.PI/2,0,0));;
    planegeo.applyMatrix(mat);
    planegeo.computeVertexNormals();
    planegeo.computeFaceNormals();
    var obj = new THREE.Mesh(planegeo, planemat);
    return obj;
  }
}, elation.engine.things.generic);

