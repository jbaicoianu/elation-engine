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
      'textures.normalMapRepeat': { type: 'vector2', default: null},
      'textures.displacementMap': { type: 'texture', default: null},
      'textures.displacementMapRepeat': { type: 'vector2', default: [1, 1]},
    });
  }
  this.createObject3D = function() {
    var planegeo = new THREE.PlaneGeometry(this.properties.size, this.properties.size, this.properties.resolution, this.properties.resolution);
    planegeo.computeBoundingSphere();
    var matargs = {
      color: this.properties.color,
      side: THREE.DoubleSide
    };
    if (this.properties.textures.map) {
      matargs.map = this.properties.textures.map;
      if (this.properties.textures.mapRepeat) {
        elation.engine.materials.setTextureRepeat(matargs.map, this.properties.textures.mapRepeat);
      }
    }
    if (this.properties.textures.normalMap) {
      matargs.normalMap = this.properties.textures.normalMap;
      if (this.properties.textures.normalMapRepeat) {
        elation.engine.materials.setTextureRepeat(matargs.normalMap, this.properties.textures.normalMapRepeat);
      } else if (this.properties.textures.mapRepeat) {
        elation.engine.materials.setTextureRepeat(matargs.normalMap, this.properties.textures.mapRepeat);
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
    //var planemat = elation.engine.materials.getShaderMaterial('terrain_simple', matargs, null, true);
    //var planemat = elation.engine.materials.get('uvtest');
    var mat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2,0,0));;
    planegeo.applyMatrix(mat);
    //planegeo.computeVertexNormals();
    //planegeo.computeFaceNormals();
    var obj = new THREE.Mesh(planegeo, planemat);
    obj.receiveShadow = true;

    var hemlight = new THREE.HemisphereLight(0x000000, 0x333333, 0.6);
    hemlight.castShadow = false;
    obj.add(hemlight);

    return obj;
  }
  this.createForces = function() {
  }
  this.updateLOD = function(camera) {
    //console.log('terrain, awesome', this, camera);
  }
}, elation.engine.things.generic);

elation.engine.materials.addChunk("poop", {
  fragment: [
    "gl_FragColor = vec4(0,1,0,1);"
    //"gl_FragColor = texture2D(map, vUv);",
  ].join("\n")
});

elation.engine.materials.buildShader("terrain_simple", {
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


/**
 * terrain
 */
elation.component.add("engine.things.terrain2", function() {
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
    this.view = [64, 64];
    this.res = [819200, 819200];
    this.pos = [.5, .5];

    this.tiles = [];
    this.tiles_free = [];
    this.levels = [];
    this.visiblelevels = [null, null];
    this.currentaltitude = 1;
    this.deformableOffset = new THREE.Vector2();

    this.maxlevel = Math.ceil(Math.log(this.res[0]/4) / Math.log(2));
    //this.objects['3d'].scale.set(this.properties.terrain.scale, this.properties.terrain.scale, this.properties.terrain.scale);

/*
    this.addControlContext('terrain', {
      'zoom_out': ['mouse_wheel_up', function() { this.setViewingAltitude(this.currentaltitude * (1+1/6));  }],
      'zoom_in': ['mouse_wheel_down', function() { this.setViewingAltitude(this.currentaltitude * (1-1/6));  }],
    });
    this.engine.systems.get('controls').activateContext('terrain', this);
*/

  }
  this.createObject3D = function() {
    this.objects['3d'] = new THREE.Object3D();
    this.root = new THREE.Object3D();
    this.objects['3d'].add(this.root);
    this.createPlane();
    this.initTextures();
    //this.showLevel(this.maxlevel, this.maxlevel);
    this.setViewingAltitude(100);

/*
    var cubes = 20;
    var cubesize = 200000;
    var cubebounds = 10000000;
    for (var i = 0; i < cubes; i++) {
      //var box = new THREE.Mesh(new THREE.CubeGeometry(Math.random() * cubesize, Math.random() * cubesize, Math.random() * cubesize), new THREE.MeshPhongMaterial({color: 0xff0000}));
      //box.position.set((Math.random() * cubebounds) - cubebounds/2, Math.random() * cubebounds, Math.random() * -cubebounds);
      //this.objects['3d'].add(box);
      var pos = [0,0,0];
      pos[2] = Math.round(Math.random() * -cubebounds);
      pos[0] = Math.round(pos[2] * (Math.random() * 2 - 1));
      pos[1] = pos[2] / -10;
      //var size = Math.round(Math.random() * cubesize);
      var size = pos[2] / ((Math.random() * -10) - 10);

      var box = elation.engine.things.generic('shape-'+i, elation.html.create(), {
        properties: {
          physical: {
            position: pos,
          },
          generic: {
            geometry: {
              type: (Math.random() < .5 ? 'sphere' : 'cube'),
              size: size
            },
            material: {
              type: 'phong',
              color: Math.floor(0xffffff * Math.random()),
              //normalMap: '/media/space/textures/asphalt-normal.jpg' //elation.engine.materials.getTexture('/media/space/textures/asphalt-normal.jpg', [1, 1])
            }
          }
        }
      });
      this.add(box);
    }
*/
    return this.objects['3d'] ;
  }
  this.createObjectDOM = function() {
/*
    // FIXME - temporary interface for development
    var foo = elation.html.create({className: "terrain_debug", append: document.body});
    foo.innerHTML = '';
    var slider = elation.ui.slider(null, elation.html.create({append: foo}), {minpos: 0.1, maxpos: 25});
    slider.setposition(1);
    elation.events.add(slider, "ui_slider_change", elation.bind(this, function(ev) { this.setViewingAltitude(Math.pow(2, ev.data ) - 1); }));
    setTimeout(function() { slider.setposition(1); }, 1000);
    return null;
*/
  }
  /** 
   * Create the plane geometry, which is shared between all terrain chunks
   * - Each terrain level is made of 16 chunks (4x4)
   * - Each terrain level is exactly 2x the resolution of the previous
   * - Number of terrain levels is determined by heightmap resolution
   */
  this.createPlane = function() {
    this.plane = new THREE.PlaneGeometry(1, 1, this.view[0] / 4, this.view[1] / 4);
    var mat = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI/2, 0, 0));
    this.plane.applyMatrix(mat);
  }

  /** 
   * Create the texture objects which will be used for the various detail levsl
   */
  this.initTextures = function() {
    this.textures = {};

/*
    var textures = elation.utils.arrayget(this.properties, "terrain.textures");
    for (var k in textures) {
      this.textures[k] = elation.engine.materials.getTexture(textures[k], true);
    }
*/
    if (this.properties.textures.map) {
      this.textures.map = this.properties.textures.map;
      if (this.properties.textures.mapRepeat) {
        elation.engine.materials.setTextureRepeat(this.textures.map, this.properties.textures.mapRepeat);
      }
    }
    if (this.properties.textures.normalMap) {
      this.textures.normalMap = this.properties.textures.normalMap;
      if (this.properties.textures.normalMapRepeat) {
        elation.engine.materials.setTextureRepeat(this.textures.normalMap, this.properties.textures.normalMapRepeat);
      }
      if (this.properties.textures.normalScale) {
        //matargs.normalScale = this.properties.textures.normalScale;
      }
    }
console.log('TEXTURES', this.textures);
    
  }

  /** 
   * Return a tile object for the requested level/offset
   * Re-use tiles which may have been freed, whenever possible
   */
  this.getTile = function(level, x, y) {
    if (this.tiles_free.length > 0) {
      var tile = this.tiles_free.pop();
    } else {
      var tile = new elation.engine.things.terrain.tile(this);
    }
    tile.setLevel(level, [x, y], this.position);
    //tile.show();
    return tile;
  }
  /**
   * Free a tile so it can be reused
   * We don't want to hide it here, we just mark it as available for reuse
   * If the tile is not reused in the same frame, cleanupTiles hides it
   */
  this.removeTile = function(tile) {
    this.tiles_free.push(tile);
  }
  /**
   * Hide any tiles which are left in the tiles_free array
   */
  this.cleanupTiles = function() {
    for (var i = 0; i < this.tiles_free.length; i++) {
      if (this.tiles_free[i].tilevisible) {
        this.tiles_free[i].hide();
      }
    }
  }
  /**
   * Show a specific range of levels
   */
  this.showLevel = function(levelstart, levelend) {
    var start = Math.min(levelstart, this.visiblelevels[0]);
    var end = Math.max(levelend, this.visiblelevels[1]);

    for (var level = start; level <= end; level++) {
      if (level >= levelstart && level <= levelend) {
        if (!this.levels[level]) {
          this.levels[level] = new elation.engine.things.terrain.level(this, level);
        }
        this.levels[level].show();
        this.levels[level].setFill(false);
      } else {
        if (this.levels[level]) {
          this.levels[level].hide();
        }
      }
    }
    this.levels[levelstart].setFill(true);
    this.cleanupTiles();
    this.visiblelevels = [levelstart, levelend];
  }
  this.setViewingAltitude = function(altitude) {
    altitude = elation.utils.math.clamp(altitude, .000000001, 10000000);
    this.currentaltitude = altitude;
    var minlevel = Math.min(this.maxlevel, Math.floor(Math.log(altitude) / Math.LN2));
    if (minlevel != this.visiblelevels[0]) {
      this.showLevel(minlevel, this.maxlevel); 
    }
    var view = this.engine.systems.get('render').views['main'];
/*
    if (view) {
      view.camera.position.y = altitude;
      if (altitude <= .1) {
        view.camera.near = .00000001;
      } else if (altitude <= 5) {
        view.camera.near = .01;
        //view.camera.far = 1000;
      } else if (altitude > 5 && altitude < 10000) {
        view.camera.near = 5;
      } else {
        view.camera.near = 10000;
        //view.camera.far = 100000;
      }
      view.camera.updateProjectionMatrix();
    }
*/
  }
  this.updateLOD = function(camera) {
/*
    this.root.position.x = camera.position.x;
    this.root.position.z = camera.position.z;
    this.deformableOffset.x = -camera.position.x / this.res[0];
    this.deformableOffset.y = -camera.position.z / this.res[1];
    this.setViewingAltitude(camera.position.y);
*/
  }
  this.getMaterialArgs = function(level, tileoffset, tileposition) {
    var terrainargs = {
      color: new THREE.Color((0xff0000 * tileoffset[0] / 4) + (0x00ff00 * tileoffset[1] / 4) + 0x000099),
      //diffuse: new THREE.Color((0xff0000 * tileoffset[0] / 4) + (0x00ff00 * tileoffset[1] / 4) + 0x000099),
      level: level,
      radius: 1000,
      textureOffset: new THREE.Vector2(tileoffset[0], tileoffset[1]),
      deformableOffset: this.deformableOffset
    };
    for (var k in this.textures) {
      terrainargs[k] = this.textures[k];
    }
    return terrainargs;
  }
}, elation.engine.things.generic);

elation.extend("engine.things.terrain.level", function(terrain, level) {
  this.terrain = terrain;
  this.level = level;
  this.tiles = false;

  /**
   * Creates the 4x4 tile grid that represents each level
   */
  this.create = function() {
    this.tiles = [];
    for (var y = 0; y < 4; y++) {
      this.tiles[y] = [];
      for (var x = 0; x < 4; x++) {
        // Initially, we just create a 4x4 ring of 12 tiles with a 2x2 hole in the middle
        // The hole will be filled in with 4 more tiles only for the highest detail level
        if ((x == 0 || x == 3) || (y == 0 || y == 3)) {
          this.tiles[y][x] = this.terrain.getTile(this.level, x, y);
        }
      }
    }
  }
  this.show = function() {
    if (!this.levelvisible) {
      //if (!this.tiles) {
        this.create();
      //}
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          if (this.tiles[y][x]) this.tiles[y][x].show();
        }
      }
      this.levelvisible = true;
      //console.log('show level', this);
    }
  }
  this.hide = function() {
    if (this.levelvisible) {
      //console.log('hide level', this);
      for (var y = 0; y < 4; y++) {
        for (var x = 0; x < 4; x++) {
          if (this.tiles[y][x] instanceof elation.engine.things.terrain.tile) {
            this.terrain.removeTile(this.tiles[y][x]);
          }
        }
      }
      this.levelvisible = false;
    }
  }
  this.setFill = function(fill) {
    if (this.tiles == false) this.create();

    for (var y = 1; y < 3; y++) {
      for (var x = 1; x < 3; x++) {
        if (this.tiles[y][x] instanceof elation.engine.things.terrain.tile) {
          if (!fill) {
            this.terrain.removeTile(this.tiles[y][x]);
            this.tiles[y][x] = false;
          } else {
            this.tiles[y][x].show();
          }
        } else {
          if (fill) {
            this.tiles[y][x] = this.terrain.getTile(this.level, x, y);
            this.tiles[y][x].show();
          }
        }
      }
    }
  }
});
elation.extend("engine.things.terrain.tile", function(terrain, args) {
  this.terrain = terrain;
  this.init = function() {
    THREE.Mesh.call(this, terrain.plane, this.getMaterial());
    this.tilevisible = false;
  }
  this.show = function() {
    if (!this.tilevisible) {
      if (this.parent && this.parent == this.terrain.objects['3d']) {
        console.log('SHOW TILE ERROR: already in scene', this);
        this.tilevisible = true;
      } else {
        //console.log('SHOW TILE', this);
        this.terrain.root.add(this);
        this.tilevisible = true;
      }
    }
  }
  this.hide = function() {
    if (this.tilevisible) {
      if (this.terrain && this.parent == this.terrain.root) {
        //console.log('HIDE TILE', this);
        this.parent.remove(this);
        this.tilevisible = false;
      } else {
        console.log('HIDE TILE ERROR: not in scene', this);
      }
    }
  }
  this.setLevel = function(level, offset, position) {
    this.name = "tile_" + level + "_" + offset[0] + "_" + offset[1];
    var scale = Math.pow(2, level);
    this.level = level;
    this.tileoffset = offset;
    this.tileposition = position;
    this.position.set((offset[0] - 1.5) * scale, 0, (offset[1] - 1.5) * scale);
    this.scale.set(scale, scale, scale);
    //this.material.color.setHex((0xff0000 * offset[0] / 4) + (0x00ff00 * offset[1] / 4) + 0x000099);
    var materialargs = this.terrain.getMaterialArgs(this.level, this.tileoffset, this.tileposition);
    //console.log(materialargs);
    if (this.material instanceof THREE.ShaderMaterial) {
      //console.log('set uniforms', materialargs, this.material.uniforms);
      for (var k in materialargs) {
        if (this.material.uniforms[k]) {
          this.material.uniforms[k].value = materialargs[k];
        }
      }
    } else {
      for (var k in materialargs) {
        this.material[k] = materialargs[k];
      }
    }
  }
  this.getMaterial = function() {
/*
    var materialargs = {
      map: elation.engine.material.getTexture(this.properties.terrain.textures.map)
    };
*/
    //return new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true, opacity: .8, transparent: true});
    return elation.engine.materials.getShaderMaterial("planet_surface", {}, {"USE_MAP": "", "USE_NORMALMAP": "", "DEFORM_SPHERE": ""});
    //return new THREE.MeshBasicMaterial();
  }

  this.init();
});
elation.engine.things.terrain.tile.prototype = Object.create(THREE.Mesh.prototype);

/*** SHADER STUFF ***/

// geometry_clipmap

// Render a planet using a series of tiles arranged as a half-sphere.
// This half-sphere is oriented to always face towards the camera.
// The source mesh is one 64x64 grid of vertices.  Each LOD level is made of 4x4 (16)
// instances of these tiles.  We map each of these tiles to form a portion of our 
// spherical shape, and apply our heightmap onto each tile.  The map and displacementMap 
// images for each level are managed on the CPU in the form of canvases composited from 
// DeepZoom image tiles (tileable map images + spherical geometry clipmaps)

elation.engine.materials.addChunk("geometry_clipmap", {
  uniforms: {
    "radius" : { type: "f", value: 1.0 },
    "level" : { type: "f", value: 1.0 },
    "latlon" : { type: "v2", value: new THREE.Vector2() },
    "subdivisions" : { type: "f", value: 1.0 },
    "scale" : { type: "f", value: 1.0 },
    "tangentMatrix" : { type: "m4", value: new THREE.Matrix4() },
    "deformableOffset" : { type: "v2", value: new THREE.Vector2() },
    "textureOffset" : { type: "v2", value: new THREE.Vector2() },
    "displacementMap" : { type: "t", value: null },
    "displacementScale" : { type: "f", value: 10.075 },
  },
  vertex_pars: [
    "#define USE_MAP",
    "#define PI 3.141592",

    "varying vec3 vViewPosition;",
    "uniform float radius;",
    "uniform float scale;",
    "uniform float level;",
    "uniform vec2 latlon;",
    "uniform float subdivisions;",
    "uniform vec2 deformableOffset;",
    "uniform vec2 textureOffset;",
    "uniform mat4 tangentMatrix;",
    "uniform sampler2D displacementMap;",
    "uniform float displacementScale;",
    //"varying vec2 vUv;",
    //"uniform vec4 offsetRepeat;"
  ].join('\n'),

  vertex: [
      // Map vertex position x/z to [0..1] based on which tile this is
      "vec2 abspos = vec2((position.x + deformableOffset.x) / subdivisions, (position.z + deformableOffset.y) / subdivisions);",

      "float tphi = (abspos.x - .5) * PI * scale;", // longitude is between -PI/2 and PI/2
      "float ttheta = (abspos.y - .5) * PI * scale + PI/2.0;", // latitude is between 0 and PI

      "float buf = 2.0;",
      //"vUv = vec2((abspos.x + (1.0 - 1.0/buf)) / buf + textureOffset.x, (abspos.y + (1.0 - 1.0 / buf)) / buf + textureOffset.y) ;",

      "float theta = (PI / 2.0 - latlon[0]);",
      "vec3 plocal = vec3(sin(tphi) * sin(ttheta), cos(ttheta), cos(tphi) * sin(ttheta));",

      //"vec3 pglobal = vec3(cos(theta) * plocal.x - sin(theta) * plocal.z, plocal.y, -sin(theta) * plocal.x + cos(theta) * plocal.z);",
      "vec3 pglobal = vec3(plocal.x, -sin(theta) * plocal.z + cos(theta) * plocal.y, cos(theta) * plocal.z - sin(theta) * plocal.y * -1.0);",

      "vec2 globaluv = vec2(atan(pglobal.y, pglobal.x) / PI + 1.0, (acos(pglobal.z) - theta) / PI + .5);",

      //"vec2 localuv = vec2((abspos.x / 2.0) + textureOffset.x), abspos.y + textureOffset.y);",
      "vec2 localuv = vec2(clamp((abspos.x + (1.0 - 1.0/buf)) / buf + textureOffset.x, 0.0, 1.0), clamp((abspos.y + (1.0 - 1.0 / buf)) / buf + textureOffset.y, 0.0, 1.0));",
      "",

      //"vUv = localuv;",
      "vUv *= pow(2.0, level);",

      // Look up displacement for this vertex
      "vec4 dispvec = texture2D(displacementMap, vUv);",
      // Unpack 16-bit heightmap value
      //"float displacement = (dispvec.r * 256.0 + dispvec.g) * displacementScale;",
      "float displacement = 0.0;",
      "float tradius = radius + displacement;",
      "#ifdef DEFORM_SPHERE",
        "vec4 tPosition = vec4(plocal * tradius, 1.0);", //vec4(tradius * sin(a) * sin(b), tradius * cos(b), tradius * cos(a) * sin(b), 1.0 );",
      "#else",
        "vec4 tPosition = vec4(tradius * (abspos.x - .5) * scale, tradius * (-abspos.y + .5) * scale, tradius, 1.0 );",
      "#endif",

      //"vec4 mvPosition = modelViewMatrix * tangentMatrix * vec4(tPosition.xyz, 1.0);",
      //"vec4 mvPosition = tPosition;",
      "mvPosition = tPosition;",
      //"vec4 mPosition = objectMatrix * tangentMatrix * vec4(tPosition.xyz, 1.0);",
//"vec4 mvPosition = modelViewMatrix * vec4(position + vec3(0,-1,0), 1.0);",
//"gl_Position = projectionMatrix * mvPosition;",
  ].join('\n'),
  fragment_pars: [
    "#define USE_MAP",
    "uniform vec3 diffuse;",
    "uniform float opacity;",
  ].join('\n'),
  fragment: [
      //"gl_FragColor = vec4( 1.0, 1.0, 1.0, opacity );",
      "gl_FragColor = vec4( diffuse, opacity );",
  ].join('\n')
});
elation.engine.materials.addChunk("atmosphere", {
  uniforms: {
    "v3LightPosition": { type: "v3", value: new THREE.Vector3(1e8, 0, 1e8).normalize() },
    "v3InvWavelength": { type: "v3", value: new THREE.Vector3(5.6, 9.47, 19.64) },
    "fCameraHeight": { type: "f", value: 0},
    "fCameraHeight2": { type: "f", value: 0},
    //"fInnerRadius": { type: "f", value: 6350},
    "outerradius": { type: "f", value: 6667},
    //"fOuterRadius2": { type: "f", value: 44448889},
    "fKrESun": { type: "f", value: 0.05},
    "fKmESun": { type: "f", value: 0.02},
    "fKr4PI": { type: "f", value: .0314152},
    "fKm4PI": { type: "f", value: .0125664},
    "fScale": { type: "f", value: .00315457413249211356},
    "fScaleDepth": { type: "f", value: .25},
    "fScaleOverScaleDepth": { type: "f", value: .01261829652996845424},
  },
  vertex_pars: [
    "uniform vec3 v3LightPosition;", // The direction vector to the light source
    "uniform vec3 v3InvWavelength;", // 1 / pow(wavelength, 4) for the red, green, and blue channels
    "uniform float fCameraHeight;",  // The camera's current height
    "uniform float fCameraHeight2;", // fCameraHeight^2
    "uniform float outerradius;",   // The outer (atmosphere) radius
    //"uniform float fOuterRadius2;",  // fOuterRadius^2
    //"uniform float fInnerRadius;",   // The inner (planetary) radius
    "uniform float fKrESun;",        // Kr * ESun
    "uniform float fKmESun;",        // Km * ESun
    "uniform float fKr4PI;",         // Kr * 4 * PI
    "uniform float fKm4PI;",         // Km * 4 * PI
    "uniform float fScale;",         // 1 / (outerradius - fInnerRadius)
    "uniform float fScaleDepth;",    // The scale depth (i.e. the altitude at which the atmosphere's average density is found)
    "uniform float fScaleOverScaleDepth;", // fScale / fScaleDepth

    "varying vec3 cFront;",
    "varying vec3 cSecondary;",

    "const int nSamples = 3;",
    "const float fSamples = 3.0;",

    "float atmosphere_scale(float fCos) {",
      "float x = 1.0 - fCos;",
	    "return fScaleDepth * exp(-0.00287 + x*(0.459 + x*(3.83 + x*(-6.80 + x*5.25))));",
    "}",
  ].join('\n'),
  vertex: [
      // Get the ray from the camera to the vertex, and its length (which is the 
      // far point of the ray passing through the atmosphere)
	    "vec3 v3Ray = mPosition.xyz - cameraPosition;",
	    "float fFar = length(v3Ray);",
	    "v3Ray /= fFar;",

      // Calculate the ray's starting position
      "#ifdef ATMOSCAT_FROM_SPACE",
        // We're outside the atmosphere, so calculate the closest intersection 
        // of the ray with the outer atmosphere (which is the near point of the 
        // ray passing through the atmosphere)

        "float B = 2.0 * dot(cameraPosition, v3Ray);",
        "float C = fCameraHeight2 - (outerradius * outerradius);",
        "float fDet = max(0.0, B*B - 4.0 * C);",
        "float fNear = 0.5 * (-B - sqrt(fDet));",

        "vec3 v3Start = cameraPosition + v3Ray * fNear;",
        "fFar -= fNear;",
        "float fDepth = exp((radius - outerradius) / fScaleDepth);",
      "#else",
      "#ifdef ATMOSCAT_FROM_ATMOSPHERE",
        "vec3 v3Start = cameraPosition;",
        "float fDepth = exp((radius - fCameraHeight) / fScaleDepth);",
      "#endif",
      "#endif", // for #else

      // Calculate the scattering offset
	    "float fCameraAngle = dot(-v3Ray, mPosition.xyz) / length(mPosition.xyz);",
	    "float fLightAngle = dot(v3LightPosition, mPosition.xyz) / length(mPosition.xyz);",
	    "float fCameraScale = atmosphere_scale(fCameraAngle);",
	    "float fLightScale = atmosphere_scale(fLightAngle);",
	    "float fCameraOffset = fDepth*fCameraScale;",
	    "float fTemp = (fLightScale + fCameraScale);",

      // Initialize the scattering loop variables
	    "float fSampleLength = fFar / fSamples;",
	    "float fScaledLength = fSampleLength * fScale;",
	    "vec3 v3SampleRay = v3Ray * fSampleLength;",
	    "vec3 v3SamplePoint = v3Start + v3SampleRay * 0.5;",

      // Now loop through the sample rays
	    "vec3 v3FrontColor = vec3(0.0, 0.0, 0.0);",
	    "vec3 v3Attenuate;",
	    "for(int i=0; i<nSamples; i++) {",
		    "float fHeight = length(v3SamplePoint);",
		    "float fDepth = exp(fScaleOverScaleDepth * (radius - fHeight));",
		    "float fScatter = fDepth*fTemp - fCameraOffset;",

		    "v3Attenuate = exp(-fScatter * (v3InvWavelength * fKr4PI + fKm4PI));",
		    "v3FrontColor += v3Attenuate * (fDepth * fScaledLength);",
		    "v3SamplePoint += v3SampleRay;",
      "}",

      // Calculate the attenuation factor for the ground
	    "cFront = v3FrontColor * (v3InvWavelength * fKrESun + fKmESun);",
//"cFront = (vec3(length(v3Start) / 10000.0, 0, 0));",
//"cFront = (vec3(exp(fScaleOverScaleDepth * (radius - length(v3Start)))));",
//"cFront = (vec3(1,0,0));",
	    "cSecondary = v3Attenuate;",
  ].join('\n'),
  fragment_pars: [
    "uniform vec3 v3LightPosition;", // The direction vector to the light source
    "varying vec3 cFront;",
    "varying vec3 cSecondary;",
  ].join('\n'),
  fragment: [
    "float phong = 1.0;",//dot(normalize(vNormal), normalize(v3LightPosition));",
    "gl_FragColor = vec4((cFront + gl_FragColor.rgb) * phong, opacity);" //  * vec4(cSecondary, 0);",
  ].join('\n')
});

elation.engine.materials.buildShader("planet_surface", {
  uniforms: [
    'common',
    'normalmap',
    'lights',
    'lights_phong',
    'geometry_clipmap',
    'atmosphere'
  ],
  chunks_vertex: [
    'normal',
    //'atmosphere',
    'map',
    'lightmap',
    'envmap',
    'color',
    'default',
    'geometry_clipmap',
    'shadowmap'
  ],
  chunks_fragment: [
    'geometry_clipmap',
    'normal',
    'map',
    //'specularmap',
    'alphatest',
    'lightmap',
    'color',
    'envmap',
    'shadowmap',
    //'atmosphere',
    //'linear_to_gamma'
  ]
});

