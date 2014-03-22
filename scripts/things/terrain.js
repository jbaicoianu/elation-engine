elation.component.add("engine.things.terrain", function() {
  this.postinit = function() {
    this.defineProperties({
      'color':           { type: 'color', default: 0x998877 },
      'simple':          { type: 'boolean', default: true },
      'size':            { type: 'float', default: 1000.0 },
      'resolution':      { type: 'int', default: 64 },
      'textures.map':             { type: 'texture', default: null},
      'textures.mapRepeat':       { type: 'vector2', default: [1, 1]},
      'textures.normalMap':       { type: 'texture', default: null},
      'textures.normalMapRepeat': { type: 'vector2', default: [1, 1]},
      'textures.displacementMap': { type: 'texture', default: null},
      'textures.displacementMapRepeat': { type: 'vector2', default: [1, 1]},
    });
  }
  this.createObject3D = function() {
    var planegeo = new THREE.PlaneGeometry(this.properties.size, this.properties.size, this.properties.resolution, this.properties.resolution);
    var matargs = {
      color: this.properties.color,
      side: THREE.DoubleSide
    };
    if (this.properties.textures.map) {
      matargs.map = this.properties.textures.map;
      if (this.properties.textures.mapRepeat) {
        elation.engine.utils.materials.setTextureRepeat(matargs.map, this.properties.textures.mapRepeat);
      }
    }
    if (this.properties.textures.normalMap) {
      matargs.normalMap = this.properties.textures.normalMap;
      if (this.properties.textures.normalMapRepeat) {
        elation.engine.utils.materials.setTextureRepeat(matargs.normalMap, this.properties.textures.normalMapRepeat);
      }
      if (this.properties.textures.normalScale) {
        matargs.normalScale = this.properties.textures.normalScale;
      }
    }
    if (this.properties.textures.displacementMap) {
      matargs.displacementMap = this.properties.textures.displacementMap;
      if (this.properties.textures.displacementMapRepeat) matargs.displacementMap.repeat = this.properties.textures.displacementMapRepeat;
    }
    matargs.shininess = 0;

    var planemat = new THREE.MeshPhongMaterial(matargs);
    //var planemat = elation.engine.utils.materials.getShaderMaterial('terrain_simple', matargs, null, true);
    //var planemat = elation.engine.utils.materials.get('uvtest');
    var mat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2,0,0));;
    planegeo.applyMatrix(mat);
    //planegeo.computeVertexNormals();
    //planegeo.computeFaceNormals();
console.log(planegeo);
    var obj = new THREE.Mesh(planegeo, planemat);
    obj.receiveShadow = true;

    var hemlight = new THREE.HemisphereLight(0x000000, 0x333333, 0.6);
    hemlight.castShadow = false;
    obj.add(hemlight);

    return obj;
  }
  this.createForces = function() {
  }
}, elation.engine.things.generic);

elation.engine.utils.materials.addChunk("poop", {
  fragment: [
    "gl_FragColor = vec4(0,1,0,1);"
    //"gl_FragColor = texture2D(map, vUv);",
  ].join("\n")
});

elation.engine.utils.materials.buildShader("terrain_simple", {
  uniforms: [
    'common',
    'bump',
    'normalmap',
    'fog',
    'lights',
    'shadowmap',
    'phong',
    //'geometry_clipmap',
    //'atmosphere'
  ],
  chunks_vertex: [
    'normal',
    //'atmosphere',
    'map',
    //'lightmap',
    'color',
    'defaultnormal',
    'default',
    'logdepthbuf',
    'worldpos',
    //'envmap',
    //'geometry_clipmap',
    //'shadowmap'
  ],
  chunks_fragment: [
    'geometry_clipmap',
    'normal',
    'map',
    'alphatest',
    //'specularmap',
    //'lightmap',
    'color',
    //'envmap',
    //'shadowmap',
    //'atmosphere',
    'linear_to_gamma',
    //'fog'
    "poop"
  ]
});
