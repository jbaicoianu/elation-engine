elation.component.add("engine.things.generic", function() {
  this.init = function() {
    this._thingdef = {
      properties: {},
      events: {},
      actions: {}
    };
    this.parentname = this.args.parentname || '';
    this.name = this.args.name || '';
    this.type = this.args.type || 'generic';
    this.engine = this.args.engine;
    this.objects = {};
    this.children = {};

    this.defineActions({
      'spawn': this.spawn,
      'move': this.move
    });
    this.defineProperties({
      'position':       { type: 'vector3', default: [0, 0, 0], comment: 'Object position, relative to parent' },
      'orientation':    { type: 'quaternion', default: [0, 0, 0, 1], comment: 'Object orientation, relative to parent' },
      'scale':          { type: 'vector3', default: [1, 1, 1], comment: 'Object scale, relative to parent' },
      'velocity':       { type: 'vector3', default: [0, 0, 0], comment: 'Object velocity (m/s)' },
      'angular':        { type: 'vector3', default: [0, 0, 0], comment: 'Object angular velocity (radians/sec)' },
      'mass':           { type: 'float', default: 0.0, comment: 'Object mass (kg)' },
      'render.mesh':    { type: 'string', comment: 'URL for JSON model file' },
      'render.scene':   { type: 'string', comment: 'URL for JSON scene file' },
      'render.collada': { type: 'string', comment: 'URL for Collada scene file' }
    });
    this.defineEvents({
      'thing_create': [],
      'thing_add': ['child'],
      'thing_remove': [],
      'thing_destroy': [],
      'thing_tick': ['delta'],
      'thing_think': ['delta'],
      'thing_move': [],
      'mouseover': ['clientX', 'clientY', 'position'],
      'mouseout': [],
      'mousedown': [],
      'mouseup': [],
      'click': []
    });

    if (typeof this.preinit == 'function') {
      this.preinit();
    }

    this.initPhysics();

    if (typeof this.postinit == 'function') {
      this.postinit();
    }
    this.init3D();
    this.initDOM();
    elation.events.fire({type: 'thing_create', element: this});
  }
  this.initProperties = function() {
    var props = (this.args.properties && this.args.properties.generic ? this.args.properties.generic : {});
    this.properties = {};
    for (var propname in this._thingdef.properties) {
      var propval = this.get(propname);
      var prop = this._thingdef.properties[propname];
      if (props && props[propname]) {
        this.set(propname, this.getPropertyValue(prop.type, props[propname]));
      } else if (elation.utils.isNull(propval) && !elation.utils.isNull(prop.default)) {
        this.set(propname, this.getPropertyValue(prop.type, prop.default));
      }
    }
  }
  this.getPropertyValue = function(type, value) {
    switch (type) {
      case 'vector3':
        value = (value instanceof THREE.Vector3 ? value : new THREE.Vector3(value[0], value[1], value[2]));
        break;
      case 'quaternion':
        value = new THREE.Quaternion(value[0], value[1], value[2], value[3]);
        break;
      case 'bool':
        value = (value === 1 || value === '1' || value === 'true');
        break;
      case 'texture':
        value = (value instanceof THREE.Texture ? value : elation.engine.utils.materials.getTexture(value));
        break;
    }
    return value;
  }
  this.defineProperties = function(properties) {
    elation.utils.merge(properties, this._thingdef.properties);
    this.initProperties();
  }
  this.defineActions = function(actions) {
    elation.utils.merge(actions, this._thingdef.actions);
  }
  this.defineEvents = function(events) {
  }

  this.set = function(property, value, forcerefresh) {
    elation.utils.arrayset(this.properties, property, value);
    if (forcerefresh && this.objects['3d']) {
      this.initProperties();
      var parent = this.objects['3d'].parent;
      parent.remove(this.objects['3d']);
      this.objects['3d'] = false;
      //this.init3D();
      parent.add(this.objects['3d']);
    }
  }
  this.get = function(property, defval) {
    if (typeof defval == 'undefined') defval = null;
    return elation.utils.arrayget(this.properties, property, defval);
  }
  this.init3D = function() {
    this.objects['3d'] = this.createObject3D();
    this.objects['3d'].position = this.properties.position;
    this.objects['3d'].quaternion = this.properties.orientation;
    this.objects['3d'].scale = this.properties.scale;
    this.objects['3d'].useQuaternion = true;
    this.objects['3d']._thing = this;
  }
  this.initDOM = function() {
    this.objects['dom'] = this.createObjectDOM();
    elation.html.addclass(this.container, "space.thing");
    elation.html.addclass(this.container, "space.things." + this.type);
    //this.updateDOM();
  }
  this.initPhysics = function() {
    this.createDynamics();
  }
  this.createObject3D = function() {
    if (this.properties.render) {
      if (this.properties.render.scene) {
        this.loadJSONScene(this.properties.render.scene, this.properties.render.texturepath);
      }
      if (this.properties.render.mesh) {
        this.loadJSON(this.properties.render.mesh, this.properties.render.texturepath);
      }
      if (this.properties.render.collada) {
        this.loadCollada(this.properties.render.collada);
      }
    }

    var geometry = null, material = null;
    var geomparams = elation.utils.arrayget(this.properties, "generic.geometry") || {};
    switch (geomparams.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(geomparams.radius || geomparams.size, geomparams.segmentsWidth, geomparams.segmentsHeight);
        break;
      case 'cube':
        geometry = new THREE.CubeGeometry(
          geomparams.width || geomparams.size,
          geomparams.height || geomparams.size,
          geomparams.depth || geomparams.size, 
          geomparams.segmentsWidth || 1, 
          geomparams.segmentsHeight || 1, 
          geomparams.segmentsDepth || 1);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          geomparams.radiusTop || geomparams.radius,
          geomparams.radiusBottom || geomparams.radius,
          geomparams.height,
          geomparams.segmentsRadius,
          geomparams.segmentsHeight,
          geomparams.openEnded);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(geomparams.radius, geomparams.tube, geomparams.segmentsR, geomparams.segmentsT, geomparams.arc);
        break;
    }
    if (geometry) {
      var materialparams = elation.utils.arrayget(this.properties, "generic.material") || {};
      if (materialparams instanceof THREE.Material) {
        material = materialparams;
      } else {
        switch (materialparams.type) {
          case 'phong':
            material = new THREE.MeshPhongMaterial(materialparams);
            break;
          case 'lambert':
            material = new THREE.MeshLambertMaterial(materialparams);
            break;
          case 'face':
            material = new THREE.MeshFaceMaterial();
            break;
          case 'depth':
            material = new THREE.MeshDepthMaterial();
            break;
          case 'normal':
            material = new THREE.MeshNormalMaterial();
            break;
          case 'basic':
          default:
            material = new THREE.MeshBasicMaterial(materialparams);
        }
      }
    }

    var object = (geometry && material ? new THREE.Mesh(geometry, material) : new THREE.Object3D());
    if (geometry && material) {
      if (geomparams.flipSided) material.side = THREE.BackSide;
      if (geomparams.doubleSided) material.side = THREE.DoubleSide;
    }
    return object;
  }
  this.createObjectDOM = function() {
    return;
  }
  this.add = function(thing) {
    if (!this.children[thing.id]) {
      this.children[thing.id] = thing;
      thing.parent = this;
      if (this.objects && thing.objects && this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].add(thing.objects['3d']);
        elation.events.fire({type: 'thing_add', element: this, data: {thing: thing}});
      } else if (thing instanceof THREE.Object3D) {
        this.objects['3d'].add(thing);
        elation.events.fire({type: 'thing_add', element: this, data: {thing: thing}});
      }
      if (this.container && thing.container) {
        this.container.appendChild(thing.container);
      }
      elation.events.add(thing, 'thing_add', this);
    } else {
      console.log("Couldn't add ", thing, " already exists in ", this);
    }
  }
  this.remove = function(thing) {
    if (this.children[thing.id]) {
      if (this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].remove(thing.objects['3d']);
      }
      this.container.removeChild(thing.container);
      delete this.children[thing.id];
    } else {
      console.log("Couldn't remove ", thing, " doesn't exist in ", this);
    }
  }
  this.createDynamics = function() {
    if (!this.objects['dynamics']) {
      this.objects['dynamics'] = new elation.physics.rigidbody({
        position: this.properties.position,
        orientation: this.properties.orientation,
        mass: this.properties.mass,
        velocity: this.properties.velocity,
        angular: this.properties.angular,
        object: this
      });
      elation.physics.system.add(this.objects['dynamics']);

      elation.events.add(this.objects['dynamics'], "dynamicsupdate,bounce", this);
    }
  }
  this.removeDynamics = function() {
    if (this.objects['dynamics']) {
      elation.physics.system.remove(this.objects['dynamics']);
      delete this.objects['dynamics'];
    }
  }
  this.loadJSON = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures';
    }
    var loader = new THREE.JSONLoader();
    loader.load(url, elation.bind(this, this.processJSON), texturepath);
  }
  this.processJSON = function(geometry, materials) {
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    var mesh = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
    mesh.doubleSided = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    this.objects['3d'].add(mesh);
    //this.objects['3d'].updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: mesh});
  }
  this.loadJSONScene = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures';
    }
    var loader = new THREE.SceneLoader();
    loader.load(url, elation.bind(this, this.processJSONScene), texturepath);
  }
  this.processJSONScene = function(scenedata) {
    this.objects['3d'].add(scenedata.scene);
    this.extractEntities(scenedata.scene);
    for (var k in scenedata.scene.children) {
      //this.objects['3d'].add(scenedata.scene.children[k]);
    }
    //this.updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: scenedata.scene});
  }
  this.loadCollada = function(url) {
    var loader = new THREE.ColladaLoader();
    (function(self) {
      loader.load(url, function(collada) {
        self.processCollada(collada);
      });
    })(this);
  }
  this.processCollada = function(collada) {
    collada.scene.rotation.x = -Math.PI / 2;
    collada.scene.rotation.z = Math.PI;
    this.objects['3d'].add(collada.scene);
    this.extractEntities(collada.scene);
    //this.updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: collada.scene});
  }
  this.extractEntities = function(scene) {
    this.cameras = [];
    this.parts = {};
    (function(self, scene) {
      scene.traverse(function ( node ) { 
        if ( node instanceof THREE.Camera ) {
          self.cameras.push(node);
        } else if (node instanceof THREE.Mesh) {
          self.parts[node.name || node.id] = node;
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
    })(this, scene);
    //console.log('Collada loaded: ', this.parts, this.cameras, this); 
    if (this.cameras.length > 0) {
      this.camera = this.cameras[0];
    }
    //this.updateCollisionSize();
  }
  this.spawn = function(type, spawnargs, orphan) {
    if (!spawnargs) spawnargs = {};
    var spawnname = type + Math.floor(Math.random() * 1000);
    if (typeof elation.engine.things[type] != 'undefined') {
      var newguy = elation.engine.things[type](spawnname, elation.html.create(), {name: spawnname, engine: this.engine, properties: { generic: spawnargs}});
      if (!orphan) {
        console.log('\t- new spawn', newguy, spawnargs);
        this.add(newguy);
      }
    }
  }
  this.worldToLocal = function(worldpos) {
    return this.objects['3d'].worldToLocal(worldpos);
  }
  this.localToWorld = function(localpos) {
    return this.objects['3d'].localToWorld(localpos);
  }
  this.thing_add = function(ev) {
    elation.events.fire({type: 'thing_add', element: this, data: ev.data});
  }
});

/*
  this.createCamera = function(offset, rotation) {
    //var viewsize = this.engine.systems.get('render').views['main'].size;
    var viewsize = [640, 480]; // FIXME - hardcoded hack!
    this.cameras.push(new THREE.PerspectiveCamera(50, viewsize[0] / viewsize[1], .01, 1e15));
    this.camera = this.cameras[this.cameras.length-1];
    if (offset) {
      this.camera.position.copy(offset)
    }
    if (rotation) {
      this.camera.eulerOrder = "YZX";
      this.camera.rotation.copy(rotation);
    }
    this.objects['3d'].add(this.camera);
  }

  // Sound functions
  this.playSound = function(sound, volume, position, velocity) {
    if (this.sounds[sound] && this.engine.systems.get('sound').enabled) {
      this.updateSound(sound, volume, position, velocity);
      this.sounds[sound].play();
    }
  }
  this.stopSound = function(sound) {
    if (this.sounds[sound] && this.sounds[sound].playing) {
      this.sounds[sound].stop();
    }
  }
  this.updateSound = function(sound, volume, position, velocity) {
    if (this.sounds[sound]) {
      if (!volume) volume = 100;
      this.sounds[sound].setVolume(volume);
      if (position) {
        this.sounds[sound].setPan([position.x, position.y, position.z], (velocity ? [velocity.x, velocity.y, velocity.z] : [0,0,0]));
      }
    }
  }
*/
