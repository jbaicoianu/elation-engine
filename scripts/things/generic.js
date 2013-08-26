elation.require([
  //"engine.external.three.ColladaLoader",
  //"engine.external.three.JSONLoader"
]);

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
    this.properties = {};
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
      'exists':         { type: 'bool', default: true, comment: 'Exists' },
      'mouseevents':    { type: 'bool', default: true, comment: 'Respond to mouse/touch events' },
      'persist':        { type: 'bool', default: true, comment: 'Continues existing across world saves' },
      'pickable':       { type: 'bool', default: true, comment: 'Selectable via mouse/touch events' },
      'render.mesh':    { type: 'string', comment: 'URL for JSON model file' },
      'render.scene':   { type: 'string', comment: 'URL for JSON scene file' },
      'render.collada': { type: 'string', comment: 'URL for Collada scene file' }
    });
    this.defineEvents({
      'thing_create': [],
      'thing_add': ['child'],
      'thing_load': ['mesh'],
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

    if (typeof this.postinit == 'function') {
      this.postinit();
    }
    this.migrateProperties();
    this.init3D();
    this.initDOM();
    this.initPhysics();

    elation.events.fire({type: 'thing_create', element: this});
  }
  this.initProperties = function() {
    if (!this.properties) {
      this.properties = {};
    }

    var props = this.migrateProperties(this.args.properties);
    for (var propname in this._thingdef.properties) {
      var prop = this._thingdef.properties[propname];
      var propval = elation.utils.arrayget(this.properties, propname, null);
      if (propval === null) {
        if (!elation.utils.isNull(props[propname])) {
          propval = props[propname] 
        } else if (!elation.utils.isNull(prop.default)) {
          propval = prop.default;
        }
        this.set(propname, propval);
      }
    }
  }
  this.migrateProperties = function(props) {
    //return props;
    // FIXME - once all entries in the db have been updated, this is no longer necessary
    if (!this.propargs) {
      var newprops = {};
      if (this.args.properties && !this.args.properties.generic) {
        //this.args.properties = { physical: this.args.properties };
      }
      var squash = ['physical', 'generic'];
      for (var propgroup in this.args.properties) {
        if (!elation.utils.isArray(this.args.properties[propgroup]) && this.args.properties[propgroup] instanceof Object) {
          for (var propname in this.args.properties[propgroup]) {
            var fullpropname = (squash.indexOf(propgroup) != -1 ? propname : propgroup + '.' + propname);
            newprops[fullpropname] = this.args.properties[propgroup][propname];
          }
        } else {
          newprops[propgroup] = this.args.properties[propgroup];
        }
      }
      this.propargs = newprops;
    }
    return this.propargs;
  }
  this.getPropertyValue = function(type, value) {
    if (value === null) {
      return;
    }
    switch (type) {
      case 'vector2':
        if (elation.utils.isArray(value)) {
          value = new THREE.Vector2(+value[0], +value[1]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Vector2(+split[0], +split[1]);
        }
        break;
      case 'vector3':
        if (elation.utils.isArray(value)) {
          value = new THREE.Vector3(+value[0], +value[1], +value[2]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Vector3(+split[0], +split[1], +split[2]);
        }
        break;
      case 'quaternion':
        if (elation.utils.isArray(value)) {
          value = new THREE.Quaternion(+value[0], +value[1], +value[2], +value[3]);
        } else if (elation.utils.isString(value)) {
          var split = value.split(',');
          value = new THREE.Quaternion(+split[0], +split[1], +split[2], +split[3]);
        }
        break;
      case 'bool':
        value = !(value === false || value === 'false' || value === 0 || value === '0' || value === '' || value === null || typeof value == 'undefined');
        break;
      case 'texture':
        if (value !== false) {
          value = (value instanceof THREE.Texture ? value : elation.engine.utils.materials.getTexture(value));
        }
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
    elation.utils.merge(events, this._thingdef.events);
  }

  this.set = function(property, value, forcerefresh) {
    var propval = this.getPropertyValue(this._thingdef.properties[property].type, value);
    var currval = this.get(property);
    //if (currval !== null) {
      switch (this._thingdef.properties[property].type) {
        case 'vector2':
        case 'vector3':
        case 'vector4':
        case 'quaternion':
          if (currval === null)  {
            elation.utils.arrayset(this.properties, property, propval);
          } else {
            currval.copy(propval);
          }
          break;
        case 'texture':
          //console.log('TRY TO SET NEW TEX', property, value, forcerefresh);
        default:
          elation.utils.arrayset(this.properties, property, propval);
      }
    //} else {
    //  elation.utils.arrayset(this.properties, property, propval);
    //}
    if (forcerefresh && this.objects['3d']) {
      this.initProperties();
      var parent = this.objects['3d'].parent;
      parent.remove(this.objects['3d']);
      this.objects['3d'] = false;
      this.init3D();
      parent.add(this.objects['3d']);
    }
    if (this.objects.dynamics) {
      this.objects.dynamics.updateState();
    }
  }
  this.get = function(property, defval) {
    if (typeof defval == 'undefined') defval = null;
    return elation.utils.arrayget(this.properties, property, defval);
  }
  this.init3D = function() {
    this.objects['3d'] = this.createObject3D();
    if (this.objects['3d']) {
      this.objects['3d'].position = this.properties.position;
      this.objects['3d'].quaternion = this.properties.orientation;
      this.objects['3d'].scale = this.properties.scale;
      this.objects['3d'].useQuaternion = true;
      this.objects['3d']._thing = this;
    }
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
    if (this.properties.exists === false) return;

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

    if (!geometry && !material) {
      geometry = new THREE.CubeGeometry(1, 1, 1);
      material = new THREE.MeshPhongMaterial({color: 0xcccccc, opacity: .2, emissive: 0x333333, transparent: true});
      //console.log('made placeholder thing', geometry, material);
    }

    var object = (geometry && material ? new THREE.Mesh(geometry, material) : new THREE.Object3D());
    if (geometry && material) {
      if (geomparams.flipSided) material.side = THREE.BackSide;
      if (geomparams.doubleSided) material.side = THREE.DoubleSide;
    }
    this.objects['3d'] = object;
    //this.spawn('gridhelper', {persist: false});
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
      return true;
    } else {
      console.log("Couldn't add ", thing, " already exists in ", this);
    }
    return false;
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
  this.reparent = function(newparent) {
    if (newparent) {
      if (this.parent) {
        this.parent.remove(this);
      }
      return newparent.add(this);
    }
    return false;
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
    //this.objects['3d'].updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: mesh});
    this.objects['3d'].add(mesh);
  }
  this.loadJSONScene = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures';
    }
    var loader = new THREE.SceneLoader();
    loader.load(url, elation.bind(this, this.processJSONScene), texturepath);
  }
  this.processJSONScene = function(scenedata) {
    this.extractEntities(scenedata.scene);
    //this.updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: scenedata.scene});
    this.objects['3d'].add(scenedata.scene);
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
    this.extractEntities(collada.scene);
    //this.updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: collada.scene});
    this.objects['3d'].add(collada.scene);
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
  this.spawn = function(type, name, spawnargs, orphan) {
    var newspawn = this.engine.systems.world.spawn(type, name, spawnargs, (orphan ? null : this));
    return newspawn;
  }
  this.die = function() {
    console.log('die:', this);
    this.removeDynamics();
    if (this.parent) {
      this.parent.remove(this);
    }
  }
  this.worldToLocal = function(worldpos) {
    return this.objects['3d'].worldToLocal(worldpos);
  }
  this.localToWorld = function(localpos) {
    return this.objects['3d'].localToWorld(localpos);
  }
  this.serialize = function() {
    var ret = {
      name: this.name,
      parentname: this.parentname,
      type: this.type,
      properties: {},
      things: {}
    };
    var numprops = 0,
        numthings = 0;

    for (var k in this._thingdef.properties) {
      var propdef = this._thingdef.properties[k];
      var propval = this.get(k);
      if (propval !== null) {
        switch (propdef.type) {
          case 'vector2':
          case 'vector3':
          case 'vector4':
            propval = propval.toArray();
            for (var i = 0; i < propval.length; i++) propval[i] = +propval[i]; // FIXME - force to float 
            break;
          case 'quaternion':
            propval = [propval.x, propval.y, propval.z, propval.w];
            break;
          case 'texture':
            propval = propval.sourceFile;
          /*
          case 'color':
            propval = propval.getHex();
            break;
          */
        }
        if (propval !== null && !elation.utils.isIdentical(propval, propdef.default)) {
          elation.utils.arrayset(ret.properties, k, propval);
          numprops++;
        }
      }
    }
    if (numprops == 0) delete ret.properties;

    for (var k in this.children) {
      if (this.children[k].properties) {
        if (this.children[k].properties.persist) {
          ret.things[k] = this.children[k].serialize();
          numthings++;
        }
      } else {
        console.log('huh what', k, this.children[k]);
      }
    }
    if (numthings == 0) delete ret.things;

    return ret;
  }
  this.thing_add = function(ev) {
    elation.events.fire({type: 'thing_add', element: this, data: ev.data});
  }
});

/*
  this.createCamera = function(offset, rotation) {
    //var viewsize = this.engine.systems.render.views['main'].size;
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
    if (this.sounds[sound] && this.engine.systems.sound.enabled) {
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
