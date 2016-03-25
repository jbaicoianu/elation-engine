elation.require('engine.things.generic', function() {
  /**
   * terrain
   */
  elation.component.add("engine.things.terrain", function() {
    this.postinit = function() {
      this.defineProperties({
        'color':                    { type: 'color', default: 0x998877 },
        'size':                     { type: 'float', default: 1000.0 },
        'resolution':               { type: 'int', default: 64 },
        'textures.map':             { type: 'texture', default: null},
        'textures.mapRepeat':       { type: 'vector2', default: [1, 1]},
        'textures.normalMap':       { type: 'texture', default: null},
        'textures.normalMapRepeat': { type: 'vector2', default: [1, 1]},
        'textures.normalScale':     { type: 'vector2', default: [1, 1]},
        'textures.specularMap':     { type: 'texture', default: null},
        'textures.specularMapRepeat': { type: 'vector2', default: [1, 1]},
        'textures.displacementMap': { type: 'texture', default: null},
        'textures.displacementMapRepeat': { type: 'vector2', default: [1, 1]},
      });
    }
    this.createObject3D = function() {
      var geo = new THREE.PlaneBufferGeometry(this.properties.size, this.properties.size, this.properties.resolution, this.properties.resolution);

      var mat = elation.engine.materials.getShaderMaterial('terrain', {
        color: this.properties.color,
        displacementMap: this.properties.textures.displacementMap,
        //blending: THREE.NormalBlending,
        opacity: .2,
        transparent: true
      }, { USE_MAP: 1 });
mat.alphaTest = 0.5;

      var mat = new THREE.MeshPhongMaterial({
        color: this.properties.color, 
        map: this.properties.textures.map,
        normalMap: this.properties.textures.normalMap,
        specularMap: this.properties.textures.specularMap,
        shininess: 10
      });
      if (mat.map) {
        mat.map.repeat.copy(this.properties.textures.mapRepeat);
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
      }
      if (mat.normalMap) {
        mat.normalMap.repeat.copy(this.properties.textures.normalMapRepeat);
        mat.normalMap.wrapS = mat.normalMap.wrapT = THREE.RepeatWrapping;
        mat.normalScale.copy(this.properties.textures.normalScale);
      }
      if (mat.specularMap) {
        mat.specularMap.repeat.copy(this.properties.textures.specularMapRepeat);
        mat.specularMap.wrapS = mat.specularMap.wrapT = THREE.RepeatWrapping;
      }
      var matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
      geo.applyMatrix(matrix);
console.log('DURPRRRR', geo, mat, this.properties.size, this.properties.resolution, this.properties.color, this.properties);
      return new THREE.Mesh(geo, mat);
    }
  }, elation.engine.things.generic);

  elation.engine.materials.addChunk("displace", {
    uniforms: {
      displacementMap: {type: 't', value: null},
      "emissive" : { type: "c", value: new THREE.Color( 0x000000 ) },
      "specular" : { type: "c", value: new THREE.Color( 0x111111 ) },
      "shininess": { type: "f", value: 30 }
    },
    vertex_pars: [
      'varying vec3 vPosition;',
      //'varying vec2 vUv;',
      'uniform sampler2D displacementMap;',
      'uniform vec3 emissive;',
      'uniform vec3 specular;',
      'uniform float shininess;',
			"varying vec3 vViewPosition;",
			"varying vec3 vNormal;",
    ].join('\n'),
    vertex: [
      'vec4 blah = texture2D(displacementMap, vUv);',
      'mvPosition.y = - 5.0;',
      'vPosition = position;',
      'vPosition.y = (blah.x * 200.0) - 50.0;',
      'mvPosition = modelViewMatrix * vec4(vPosition, 1.0);',
      'vUv = uv;',
      'gl_Position = projectionMatrix * mvPosition;'
    ].join('\n'),
    fragment_pars: [
      'varying vec3 vPosition;',
      //'varying vec2 vUv;',
      'uniform vec3 emissive;',
      'uniform vec3 specular;',
      'uniform float shininess;',
      'uniform float opacity;',
      'uniform float specularStrength;',
    ].join('\n'),
    fragment: [
			'	vec3 outgoingLight = vec3( 0.0 );',
			'	vec4 diffuseColor = vec4( .2,.2,.2, opacity );',
			'	vec3 totalAmbientLight = ambientLightColor;',
			'	vec3 totalEmissiveLight = emissive;',
      'float poox = mod(vPosition.x, 10.0) / 10.0;',
      'float pooy = mod(vPosition.z, 10.0) / 10.0;',
      'float poo = 0.0;',
      'float thickness = 0.05;',
      'float threshold = 1.0 - thickness;',
      'if (poox < thickness || pooy < thickness) { poo = 1.0; }',
      'float opa = 0.1;',
      //'gl_FragColor = vec4(0, poo, 1.0, 0.2);',
      'gl_FragColor = vec4(.2,.2,.2,1.0);',
    ].join('\n')
  });
  elation.engine.materials.buildShader("terrain", {
    uniforms: [
      'common',
      'map',
      'displace',
      'lights',
      'normalmap'
    ],
    chunks_vertex: [
      'uv',
      'map',
      'color',
      'default',
      'displace',
      'normalmap',
      'lights_phong'
    ],
    chunks_fragment: [
      'normal',
      'uv',
      'displace',
      'normalmap',
      'lights_phong'
    ]
  });
});

