elation.component.add('engine.things.planet', function() {
  this.postinit = function() {
    this.defineProperties({
      'radius': { type: 'float', default: 1000 },
      'render.texture': { type: 'texture' },
      'render.normalmap': { type: 'texture' },
      'render.bumpmap': { type: 'texture' },
      'render.heightmap': { type: 'texture' },
    });
  }
  this.createObject3D = function() {
    var geo = new THREE.SphereGeometry(this.properties.radius, 32, 16);
    var matargs = {};
    if (this.properties.radius.texture) matargs.map = this.properties.radius.texture;
    if (this.properties.radius.normalmap) matargs.normalMap = this.properties.radius.normalmap;
    if (this.properties.radius.bumpmap) matargs.bumpMap = this.properties.radius.bumpMap;

    var mat = new THREE.MeshPhongMaterial(matargs);
    return new THREE.Mesh(geo, mat);
  }
}, elation.engine.things.generic);
