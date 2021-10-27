elation.require([
  //"engine.things.trigger"
  "utils.proxy",
  "engine.math"
], function() {

elation.component.add("engine.things.generic", function() {
  this.init = function() {
    this._proxies = {};
    this._thingdef = {
      properties: {},
      events: {},
      actions: {}
    };
    this.parentname = this.args.parentname || '';
    this.name = this.args.name || '';
    this.type = this.args.type || 'generic';
    this.engine = this.args.engine;
    this.client = this.args.client;
    this.properties = {};
    this.objects = {};
    this.parts = {};
    this.triggers = {};
    this.parttypes = {};
    this.children = {};
    this.tags = [];
    this.sounds = {};
    this.animations = false;
    this.skeleton = false;
    
    this.tmpvec = new THREE.Vector3();
    
    this.interp = {
      rate: 20,
      lastTime: 0,
      time: 0,
      endpoint: new THREE.Vector3(),
      spline: [],
      active: false,
      fn: this.applyInterp
    };

    //elation.events.add(this, 'thing_create', this);
    elation.events.add(this, 'thing_use_activate', this);
    this.defineActions({
      'spawn': this.spawn,
      'move': this.move
    });
    this.defineProperties({
      'position':       { type: 'vector3', default: [0, 0, 0], comment: 'Object position, relative to parent' },
      'orientation':    { type: 'quaternion', default: [0, 0, 0, 1], comment: 'Object orientation, relative to parent' },
      'scale':          { type: 'vector3', default: [1, 1, 1], comment: 'Object scale, relative to parent' },
      'velocity':       { type: 'vector3', default: [0, 0, 0], comment: 'Object velocity (m/s)' },
      'acceleration':   { type: 'vector3', default: [0, 0, 0], comment: 'Object acceleration (m/s^2)' },
      'angular':        { type: 'vector3', default: [0, 0, 0], comment: 'Object angular velocity (radians/sec)' },
      'angularacceleration': { type: 'vector3', default: [0, 0, 0], comment: 'Object angular acceleration (radians/sec^2)' },
      'mass':           { type: 'float', default: 0.0, comment: 'Object mass (kg)' },
      'exists':         { type: 'bool', default: true, comment: 'Exists' },
      'visible':        { type: 'bool', default: true, comment: 'Is visible' },
      'physical':       { type: 'bool', default: true, comment: 'Simulate physically' },
      'collidable':     { type: 'bool', default: true, comment: 'Can crash into other things' },
      'restitution':    { type: 'float', default: 0.5, comment: 'Amount of energy preserved after each bounce', set: this.updatePhysics },
      'dynamicfriction':{ type: 'float', default: 0.0, comment: 'Dynamic friction inherent to this object', set: this.updatePhysics },
      'staticfriction': { type: 'float', default: 0.0, comment: 'Static friction inherent to this object', set: this.updatePhysics },
      //'fog':            { type: 'bool', default: true, comment: 'Affected by fog' },
      'shadow':         { type: 'bool', default: true, refreshMaterial: true, comment: 'Casts and receives shadows' },
      'wireframe':      { type: 'bool', default: false, refreshMaterial: true, comment: 'Render this object as a wireframe' },
      'forcereload':    { type: 'bool', default: false, refreshGeometry: true, refreshMaterial: true, comment: 'Force a full reload of all files' },
      'mouseevents':    { type: 'bool', default: true, comment: 'Respond to mouse/touch events' },
      'persist':        { type: 'bool', default: false, comment: 'Continues existing across world saves' },
      'pickable':       { type: 'bool', default: true, comment: 'Selectable via mouse/touch events' },
      'render.mesh':    { type: 'string', refreshGeometry: true, comment: 'URL for JSON model file' },
      'render.meshname':{ type: 'string', refreshGeometry: true },
      'render.scene':   { type: 'string', refreshGeometry: true, comment: 'URL for JSON scene file' },
      'render.collada': { type: 'string', refreshGeometry: true, comment: 'URL for Collada scene file' },
      'render.model':   { type: 'string', refreshGeometry: true, comment: 'Name of model asset' },
      'render.gltf':    { type: 'string', refreshGeometry: true, comment: 'URL for glTF file' },
      'render.materialname': { type: 'string', refreshMaterial: true, comment: 'Material library name' },
      'render.texturepath': { type: 'string', refreshMaterial: true, comment: 'Texture location' },
      'player_id':      { type: 'float', default: null, comment: 'Network id of the creator' },
      'tags': { type: 'string', comment: 'Default tags to add to this object' }
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
    this.init3D();
    this.initDOM();
    this.initPhysics();

    setTimeout(elation.bind(this, function() {
      // Fire create event next frame
      this.createChildren();
      this.refresh();
      elation.events.fire({type: 'thing_create', element: this});
    }), 0);
  }
  this.preinit = function() {
  }
  this.postinit = function() {
  }
  this.initProperties = function() {
    if (!this.properties) {
      this.properties = {};
    }

    for (var propname in this._thingdef.properties) {
      var prop = this._thingdef.properties[propname];
      if (!this.hasOwnProperty(propname)) {
        this.defineProperty(propname, prop);
      }
    }
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
          var split = value.split((value.indexOf(' ') != -1 ? ' ' : ','));
          value = new THREE.Vector2(+split[0], +split[1]);
        }
        break;
      case 'vector3':
        if (elation.utils.isArray(value)) {
          value = new elation.physics.vector3(+value[0], +value[1], +value[2]);
        } else if (elation.utils.isString(value)) {
          var split = value.split((value.indexOf(' ') != -1 ? ' ' : ','));
          value = new elation.physics.vector3(+split[0], +split[1], +split[2]);
        }
        break;
      case 'euler':
        if (elation.utils.isArray(value)) {
          value = new EulerDegrees().set(+value[0], +value[1], +value[2]);
        } else if (elation.utils.isString(value)) {
          var split = value.split((value.indexOf(' ') != -1 ? ' ' : ','));
          value = new EulerDegrees().set(+split[0], +split[1], +split[2]);
        } else if (value instanceof THREE.Vector3) {
          value = new EulerDegrees().set(value.x, value.y, value.z);
        }
        break;
      case 'quaternion':
        if (elation.utils.isArray(value)) {
          value = new elation.physics.quaternion(+value[0], +value[1], +value[2], +value[3]);
        } else if (elation.utils.isString(value)) {
          var split = value.split((value.indexOf(' ') != -1 ? ' ' : ','));
          value = new elation.physics.quaternion(+split[0], +split[1], +split[2], +split[3]);
        } else if (value instanceof THREE.Quaternion && !(value instanceof elation.physics.quaternion)) {
          value = new elation.physics.quaternion().copy(value);
        }
        break;
      case 'color':
        var clamp = elation.utils.math.clamp;
        if (value instanceof THREE.Vector3) {
          value = new THREE.Color(clamp(value.x, 0, 1), clamp(value.y, 0, 1), clamp(value.z, 0, 1));
        } else if (value instanceof THREE.Vector4) {
          this.opacity = clamp(value.w, 0, 1);
          value = new THREE.Color(clamp(value.x, 0, 1), clamp(value.y, 0, 1), clamp(value.z, 0, 1));
        } else if (elation.utils.isString(value)) {
          var splitpos = value.indexOf(' ');
          if (splitpos == -1) splitpos = value.indexOf(',');
          if (splitpos == -1) {
            if (elation.utils.isnumeric(value) && value <= 1.0) {
              value = new THREE.Color(value, value, value);
            } else {
              value = new THREE.Color(value);
            }
          } else {
            var split = value.split((value.indexOf(' ') != -1 ? ' ' : ','));
            value = new THREE.Color(clamp(split[0], 0, 1), clamp(split[1], 0, 1), clamp(split[2], 0, 1));
            if (split.length > 3) {
              this.opacity = clamp(split[3], 0, 1);
            }
          }
        } else if (elation.utils.isArray(value)) {
          value = new THREE.Color(+value[0], +value[1], +value[2]);
        } else if (!(value instanceof THREE.Color)) {
          value = new THREE.Color(value);
        }
        break;
      case 'bool':
      case 'boolean':
        value = !(value === false || (elation.utils.isString(value) && value.toLowerCase() === 'false') || value === 0 || value === '0' || value === '' || value === null || typeof value == 'undefined');
        break;
      case 'float':
        value = +value;
        break;
      case 'int':
      case 'integer':
        value = value | 0;
        break;
      case 'texture':
        if (value !== false) {
          value = (value instanceof THREE.Texture ? value : elation.engine.materials.getTexture(value));
        }
        break;
      case 'json':
        if (value !== false) {
          value = (elation.utils.isString(value) ? JSON.parse(value) : value);
        }
        break;
      case 'component':
        if (value) {
          var component = elation.component.fetch(value[0], value[1]);
          if (component) {
            value = component;
          }
        }
        break;
    }
    return value;
  }
  this.defineProperties = function(properties) {
    elation.utils.merge(properties, this._thingdef.properties);
    this.initProperties();
  }
  this.defineProperty = function(propname, prop) {
    var propval = elation.utils.arrayget(this.properties, propname, null);
    Object.defineProperty(this, propname, { 
      configurable: true,
      enumerable: true,
      get: function() { 
        var proxy = this._proxies[propname]; 
        if (proxy) {
          return proxy;
        }
        return elation.utils.arrayget(this.properties, propname); 
      }, 
      set: function(v) { 
        this.set(propname, v, prop.refreshGeometry);
        //this.refresh();
        //console.log('set ' + propname + ' to ', v); 
      } 
    });
    if (propval === null) {
      if (!elation.utils.isNull(this.args.properties[propname])) {
        propval = this.args.properties[propname] 
      } else if (!elation.utils.isNull(prop.default)) {
        propval = prop.default;
      }
      this.set(propname, propval);
    }
    if (prop.type == 'vector2' || prop.type == 'vector3' || prop.type == 'quaternion' || prop.type == 'color') {
      if (propval && !this._proxies[propname]) {
        // Create proxy objects for these special types
        var proxydef = {
            x: ['property', 'x'],
            y: ['property', 'y'],
            z: ['property', 'z'],
            changed: ['property', 'changed'],
            add: ['function', 'add'],
            addScalar: ['function', 'addScalar'],
            addScaledVector: ['function', 'addScaledVector'],
            addVectors: ['function', 'addVectors'],
            applyAxisAngle: ['function', 'applyAxisAngle'],
            angleTo: ['function', 'angleTo'],
            ceil: ['function', 'ceil'],
            clamp: ['function', 'clamp'],
            clampLength: ['function', 'clampLength'],
            clampScalar: ['function', 'clampScalar'],
            clone: ['function', 'clone'],
            constructor: ['function', 'constructor'],
            copy: ['function', 'copy'],
            cross: ['function', 'cross'],
            crossVectors: ['function', 'crossVectors'],
            distanceTo: ['function', 'distanceTo'],
            manhattanDistanceTo: ['function', 'manhattanDistanceTo'],
            distanceToSquared: ['function', 'distanceToSquared'],
            divide: ['function', 'divide'],
            divideScalar: ['function', 'divideScalar'],
            dot: ['function', 'dot'],
            equals: ['function', 'equals'],
            floor: ['function', 'floor'],
            length: ['function', 'length'],
            manhattanLength: ['function', 'manhattanLength'],
            lengthSq: ['function', 'lengthSq'],
            lerp: ['function', 'lerp'],
            lerpVectors: ['function', 'lerpVectors'],
            max: ['function', 'max'],
            min: ['function', 'min'],
            multiply: ['function', 'multiply'],
            multiplyScalar: ['function', 'multiplyScalar'],
            multiplyVectors: ['function', 'multiplyVectors'],
            negate: ['function', 'negate'],
            normalize: ['function', 'normalize'],
            projectOnPlane: ['function', 'projectOnPlane'],
            projectOnVector: ['function', 'projectOnVector'],
            reflect: ['function', 'reflect'],
            round: ['function', 'round'],
            roundToZero: ['function', 'roundToZero'],
            set: ['function', 'set'],
            setLength: ['function', 'setLength'],
            setScalar: ['function', 'setScalar'],
            sub: ['function', 'sub'],
            subScalar: ['function', 'subScalar'],
            subVectors: ['function', 'subVectors'],
            toArray: ['function', 'toArray'],
            reset: ['function', 'reset'],
        };
        if (prop.type == 'quaternion') {
          proxydef.w = ['property', 'w'];
        } else if (prop.type == 'color') {
          // We want to support color.xyz as well as color.rgb
          proxydef.r = ['property', 'r'];
          proxydef.g = ['property', 'g'];
          proxydef.b = ['property', 'b'];
          proxydef.x = ['property', 'r'];
          proxydef.y = ['property', 'g'];
          proxydef.z = ['property', 'b'];
        }
        var propval = elation.utils.arrayget(this.properties, propname, null);
        if (propval) {
          this._proxies[propname] = new elation.proxy(
            propval, proxydef, true
          );
          // FIXME - listening for proxy_change events would let us respond to changes for individual vector elements, but it gets expensive, and can lead to weird infinite loops
          /*
          elation.events.add(propval, 'proxy_change', elation.bind(this, function(ev) {
            //this.refresh();
            //this.set('exists', this.properties.exists, prop.refreshGeometry);
            //this[propname] = this[propname];
            var propdef = this._thingdef.properties[propname];
            if (propdef && propdef.set) {
              propdef.set.apply(this, [propname, propval]);
            }
          }));
          */
        }
      }
    } else if (prop.type == 'euler') {
      if (propval && !this._proxies[propname]) {
        // Create proxy objects for these special types
        var propval = elation.utils.arrayget(this.properties, propname, null);
        let degrees = new EulerDegrees(propval);
        var proxydef = {
            x: ['property', 'x'],
            y: ['property', 'y'],
            z: ['property', 'z'],
            order: ['property', 'order'],
            set: ['function', 'set'],
            copy: ['function', 'copy'],
            clone: ['function', 'clone'],
            constructor: ['function', 'constructor'],
            toArray: ['function', 'toArray'],
        };
        if (propval) {
/*
          this._proxies[propname] = new elation.proxy(
            degrees, proxydef, true
          );
*/
        }
      }
    }
  }
  this.defineActions = function(actions) {
    elation.utils.merge(actions, this._thingdef.actions);
  }
  this.defineEvents = function(events) {
    elation.utils.merge(events, this._thingdef.events);
  }

  this.set = function(property, value, forcerefresh) {
    var propdef = this._thingdef.properties[property];
    if (!propdef) {
      console.warn('Tried to set unknown property', property, value, this);
      return;
    }
    var changed = false
    var propval = this.getPropertyValue(propdef.type, value);
    var currval = this.get(property);
    //if (currval !== null) {
      switch (propdef.type) {
        case 'vector2':
        case 'vector3':
        case 'vector4':
        case 'quaternion':
        case 'color':
          if (currval === null)  {
            elation.utils.arrayset(this.properties, property, propval);
            changed = true;
          } else {
            if (!currval.equals(propval)) {
              currval.copy(propval);
              changed = true
            }
          }
          break;
        case 'euler':
          if (currval === null)  {
            elation.utils.arrayset(this.properties, property, propval);
            changed = true;
          } else {
            if (!currval.equals(propval)) {
              currval.copy(propval);
              changed = true
            }
          }
          break;
        case 'texture':
          //console.log('TRY TO SET NEW TEX', property, value, forcerefresh);
        default:
          if (currval !== propval) {
            elation.utils.arrayset(this.properties, property, propval);
            changed = true;
          }
      }
    //} else {
    //  elation.utils.arrayset(this.properties, property, propval);
    //}
    if (changed) {
      if (propdef.set) {
        propdef.set.apply(this, [property, propval]);
      }

      if (forcerefresh && this.objects['3d']) {
        var oldobj = this.objects['3d'],
            parent = oldobj.parent,
            newobj = this.createObject3D();

        this.objects['3d'] = newobj;
        this.bindObjectProperties(this.objects['3d']);

        this.objects['3d'].userData.thing = this;

        elation.events.fire({type: 'thing_recreate', element: this});
        if (parent) {
          parent.remove(oldobj);
          parent.add(newobj);
        }
      }
      if (this.objects.dynamics) {
        if (false && forcerefresh) {
          this.removeDynamics();
          this.initPhysics();
        } else {
          this.objects.dynamics.mass = this.properties.mass;
          this.objects.dynamics.updateState();
          if (this.objects.dynamics.collider) {
            this.objects.dynamics.collider.getInertialMoment();
          }
        }
        this.objects.dynamics.position = this.properties.position;
        this.objects.dynamics.orientation = this.properties.orientation;
      }

      this.refresh();
    }
  }
  this.setProperties = function(properties, interpolate) {
    for (var prop in properties) {
      if (prop == 'position' && interpolate == true )
      {
          if ( this.tmpvec.fromArray(properties[prop]).distanceToSquared(this.get('position')) > 1 )
          {
            // call interpolate function 
            // TODO: fix magic number 0.001
            this.interpolateTo(properties[prop]);
          }
      }
      else {
        this.set(prop, properties[prop], false);
      }
    }
    this.refresh();
  }
  
  this.interpolateTo = function(newPos) {
    this.interp.time = 0;
    this.interp.endpoint.fromArray(newPos);
    this.interp.spline = new THREE.SplineCurve3([this.get('position'), this.interp.endpoint]).getPoints(10);
    // console.log(this.interp.spline);
    elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.applyInterp));
  }
  
  this.applyInterp = function(ev) {
    this.interp.time += ev.data.delta * this.engine.systems.physics.timescale;
    if (this.interp.time >= this.interp.rate) {
      elation.events.remove(this, 'engine_frame', elation.bind(this, this.applyInterp));
      return;
    }
    console.log("DEBUG: interpolating, time:", this.interp.time);
    if (this.interp.time - this.interp.lastTime >= 2) 
    {
    this.set('position', this.interp.spline[Math.floor((this.interp.time * 10) / this.interp.rate)], false);
    this.refresh();
    }
  };
  
  this.get = function(property, defval) {
    if (typeof defval == 'undefined') defval = null;
    return elation.utils.arrayget(this.properties, property, defval);
  }
  this.init3D = function() {
    if (this.objects['3d']) {
      if (this.objects['3d'].parent) { this.objects['3d'].parent.remove(this.objects['3d']); }
    }
    if (this.properties.tags) {
      var tags = this.properties.tags.split(',');
      for (var i = 0; i < tags.length; i++) { 
        this.addTag(tags[i].trim());
      }
    }
    this.objects['3d'] = this.createObject3D();
    if (this.objects['3d']) {
      this.bindObjectProperties(this.objects['3d']);
      //this.objects['3d'].useQuaternion = true;
      this.objects['3d'].userData.thing = this;
    }
    if (!this.colliders) {
      this.colliders = new THREE.Object3D();
      this.bindObjectProperties(this.colliders);
      //this.colliders.scale.set(1/this.properties.scale.x, 1/this.properties.scale.y, 1/this.properties.scale.z);
      this.colliders.userData.thing = this;
    }

    var childkeys = Object.keys(this.children);
    if (childkeys.length > 0) {
      // Things were added during initialization, so make sure they're added to the scene
      for (var i = 0; i < childkeys.length; i++) {
        var k = childkeys[i];
        if (this.children[k].objects['3d']) {
          this.objects['3d'].add(this.children[k].objects['3d']);
        }
      }
    }
    if (!this.properties.visible) {
      this.hide();
    }
    elation.events.fire({type: 'thing_init3d', element: this});
    this.refresh();
  }
  this.initDOM = function() {
    if (ENV_IS_BROWSER) {
      this.objects['dom'] = this.createObjectDOM();
      elation.html.addclass(this.container, "space.thing");
      elation.html.addclass(this.container, "space.things." + this.type);
      //this.updateDOM();
    }
  }
  this.initPhysics = function() {
    if (this.properties.physical) {
      this.createDynamics();
      this.createForces();
    }
  }
  this.createObject3D = function() {
    // if (this.properties.exists === false || !ENV_IS_BROWSER) return;
    if (this.properties.exists === false) return;

    var object = null, geometry = null, material = null;
    var cachebust = '';
    if (this.properties.forcereload) cachebust = '?n=' + (Math.floor(Math.random() * 10000));
    if (this.properties.render) {
      if (this.properties.render.scene) {
        this.loadJSONScene(this.properties.render.scene, this.properties.render.texturepath + cachebust);
      } else if (this.properties.render.mesh) {
        this.loadJSON(this.properties.render.mesh, this.properties.render.texturepath + cachebust);
      } else if (this.properties.render.collada) {
        this.loadCollada(this.properties.render.collada + cachebust);
      } else if (this.properties.render.model) {
        object = elation.engine.assets.find('model', this.properties.render.model);
      } else if (this.properties.render.gltf) {
        this.loadglTF(this.properties.render.gltf + cachebust);
      } else if (this.properties.render.meshname) {
        object = new THREE.Object3D();
        setTimeout(elation.bind(this, this.loadMeshName, this.properties.render.meshname), 0);
      }
    }

    var geomparams = elation.utils.arrayget(this.properties, "generic.geometry") || {};
    switch (geomparams.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(geomparams.radius || geomparams.size, geomparams.segmentsWidth, geomparams.segmentsHeight);
        break;
      case 'cube':
        geometry = new THREE.BoxGeometry(
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
      //geometry = new THREE.BoxGeometry(1, 1, 1);
      //material = new THREE.MeshPhongMaterial({color: 0xcccccc, opacity: .2, emissive: 0x333333, transparent: true});
      //console.log('made placeholder thing', geometry, material);
    }

    if (!object) {
      object = (geometry && material ? new THREE.Mesh(geometry, material) : new THREE.Object3D());
    }
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
  this.createChildren = function() {
    return;
  }
  this.add = function(thing) {
    if (!this.children[thing.id]) {
      this.children[thing.id] = thing;
      thing.parent = this;
      if (this.objects && thing.objects && this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].add(thing.objects['3d']);
      } else if (thing instanceof THREE.Object3D) {
        this.objects['3d'].add(thing);
      }
      if (this.objects && thing.objects && this.objects['dynamics'] && thing.objects['dynamics']) {
        this.objects['dynamics'].add(thing.objects['dynamics']);
      }
      if (this.container && thing.container) {
        this.container.appendChild(thing.container);
      }
      if (this.colliders && thing.colliders) {
        this.colliders.add(thing.colliders);
      }
      elation.events.fire({type: 'thing_add', element: this, data: {thing: thing}});
      return true;
    } else {
      console.log("Couldn't add ", thing.name, " already exists in ", this.name);
    }
    return false;
  }
  this.remove = function(thing) {
    if (thing && this.children[thing.id]) {
      if (this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].remove(thing.objects['3d']);
      }
      if (thing.container && thing.container.parentNode) {
        thing.container.parentNode.removeChild(thing.container);
      }
      if (thing.objects['dynamics'] && thing.objects['dynamics'].parent) {
        thing.objects['dynamics'].parent.remove(thing.objects['dynamics']);
      }
      if (this.colliders && thing.colliders) {
        this.colliders.remove(thing.colliders);
      }
      if (thing.colliderhelper) {
        //this.engine.systems.world.scene['colliders'].remove(thing.colliderhelper);
      }
      elation.events.fire({type: 'thing_remove', element: this, data: {thing: thing}});
      delete this.children[thing.id];
      thing.parent = false;
    } else {
      console.log("Couldn't remove ", thing.name, " doesn't exist in ", this.name);
    }
  }
  this.reparent = function(newparent) {
    if (newparent) {
      if (this.parent) {
        newparent.worldToLocal(this.parent.localToWorld(this.properties.position));
        this.properties.orientation.copy(newparent.worldToLocalOrientation(this.parent.localToWorldOrientation()));
        this.parent.remove(this);
        //newparent.worldToLocalDir(this.parent.localToWorldDir(this.properties.orientation));
      }
      var success = newparent.add(this);
      this.refresh();
      return success;
    }
    return false;
  }
  this.show = function() {
    this.objects['3d'].visible = true;
    if (this.colliderhelper) this.colliderhelper.visible = true;
  }
  this.hide = function() {
    this.objects['3d'].visible = false;
    if (this.colliderhelper) this.colliderhelper.visible = false;
  }
  this.createDynamics = function() {
    if (!this.objects['dynamics'] && this.engine.systems.physics) {
      this.objects['dynamics'] = new elation.physics.rigidbody({
        position: this.properties.position,
        orientation: this.properties.orientation,
        mass: this.properties.mass,
        scale: this.properties.scale,
        velocity: this.properties.velocity,
        acceleration: this.properties.acceleration,
        angular: this.properties.angular,
        angularacceleration: this.properties.angularacceleration,
        restitution: this.properties.restitution,
        material: {
          dynamicfriction: this.properties.dynamicfriction,
          staticfriction: this.properties.staticfriction,
        },
        object: this
      });
      //this.engine.systems.physics.add(this.objects['dynamics']);

      if ((this.properties.collidable || this.properties.pickable) && this.objects['3d'] && this.objects['3d'].geometry) {
        setTimeout(elation.bind(this, this.updateColliderFromGeometry), 0);
      }

      elation.events.add(this.objects['dynamics'], "physics_update,physics_collide", this);
      elation.events.add(this.objects['dynamics'], "physics_update", elation.bind(this, this.refresh));
    }
  }
  this.removeDynamics = function() {
    if (this.objects.dynamics) {
      if (this.objects.dynamics.parent) {
        this.objects.dynamics.parent.remove(this.objects.dynamics);
      } else {
        this.engine.systems.physics.remove(this.objects.dynamics);
      }
      delete this.objects.dynamics;
    }
  }
  this.createForces = function() {
  }
  this.addForce = function(type, args) {
    return this.objects.dynamics.addForce(type, args);
  }
  this.removeForce = function(force) {
    return this.objects.dynamics.removeForce(force);
  }
  this.updateColliderFromGeometry = function(geom) {
      if (!geom) geom = this.objects['3d'].geometry;
      var collidergeom = false;
      // Determine appropriate collider for the geometry associated with this thing
      var dyn = this.objects['dynamics'];
      if (geom && dyn) {
        if (geom instanceof THREE.SphereGeometry ||
            geom instanceof THREE.SphereBufferGeometry) {
          if (!geom.boundingSphere) geom.computeBoundingSphere();
          this.setCollider('sphere', {radius: geom.boundingSphere.radius});
        } else if (geom instanceof THREE.PlaneGeometry || geom instanceof THREE.PlaneBufferGeometry) {
          if (!geom.boundingBox) geom.computeBoundingBox();
          var size = new THREE.Vector3().subVectors(geom.boundingBox.max, geom.boundingBox.min);

          // Ensure minimum size
          if (size.x < 1e-6) size.x = .25;
          if (size.y < 1e-6) size.y = .25;
          if (size.z < 1e-6) size.z = .25;

          this.setCollider('box', geom.boundingBox);
        } else if (geom instanceof THREE.CylinderGeometry) {
          if (geom.radiusTop == geom.radiusBottom) {
            this.setCollider('cylinder', {height: geom.height, radius: geom.radiusTop});
          } else {
            console.log('FIXME - cylinder collider only supports uniform cylinders for now');
          }
        } else if (!dyn.collider) {
          if (!geom.boundingBox) geom.computeBoundingBox();
          this.setCollider('box', geom.boundingBox);
        }
      }
  }
  this.setCollider = function(type, args, rigidbody, reuseMesh) {
    //console.log('set collider', type, args, rigidbody, this.collidable);
    if (!rigidbody) rigidbody = this.objects['dynamics'];
    if (this.properties.collidable) {
      rigidbody.setCollider(type, args);
    }
    if (this.properties.collidable || this.properties.pickable) {
      var collidergeom = false;
      if (type == 'sphere') {
        collidergeom = elation.engine.geometries.generate('sphere', { 
          radius: args.radius / this.properties.scale.x
        });
      } else if (type == 'box') {
        var size = new THREE.Vector3().subVectors(args.max, args.min);
        size.x /= this.scale.x;
        size.y /= this.scale.y;
        size.z /= this.scale.z;
        var offset = new THREE.Vector3().addVectors(args.max, args.min).multiplyScalar(.5);
        collidergeom = elation.engine.geometries.generate('box', { 
          size: size,
          offset: offset
        });
      } else if (type == 'cylinder') {
        collidergeom = elation.engine.geometries.generate('cylinder', {
          radius: args.radius,
          height: args.height,
          radialSegments: 12
        });
        if (args.offset) {
          collidergeom.applyMatrix4(new THREE.Matrix4().makeTranslation(args.offset.x, args.offset.y, args.offset.z));
        }
      } else if (type == 'capsule') {
        collidergeom = elation.engine.geometries.generate('capsule', {
          radius: args.radius,
          length: elation.utils.any(args.length, args.height),
          radialSegments: 8,
          offset: args.offset,
        });
      } else if (type == 'triangle') {
        collidergeom = elation.engine.geometries.generate('triangle', {
          p1: args.p1,
          p2: args.p2,
          p3: args.p3
        });
      } else if (type == 'mesh') {
        // FIXME - not sure if this is the best way to do it, but this forces mesh colliders into the picking scene
        collidermesh = args.mesh;
        this.colliders.add(args.mesh);
      }
      /*
      if (this.collidermesh) {
        this.colliders.remove(this.collidermesh);
        this.engine.systems.world.scene['colliders'].remove(this.colliderhelper);
        this.collidermesh = false;
      }
      */
      // If we have children, re-add their colliders as children of our own collider, but only if we're working with the root object
      if (rigidbody === this.objects['dynamics']) {
        for (var k in this.children) {
          if (this.children[k].colliders) {
            this.colliders.add(this.children[k].colliders);
          }
        }
      }
      if (collidergeom) {
        let collidercolor = 0x009900;
        if (rigidbody.mass === 0) {
          collidercolor = 0x990000;
        }
        var collidermat = new THREE.MeshPhongMaterial({color: collidercolor, opacity: .2, transparent: true, emissive: 0x333300, alphaTest: .1, depthTest: false, depthWrite: false, side: THREE.DoubleSide});

        if (reuseMesh && this.collidermesh) {
          var collidermesh = this.collidermesh;
          collidermesh.geometry = collidergeom;
        } else {
          var collidermesh = this.collidermesh = new THREE.Mesh(collidergeom, collidermat);
          if (rigidbody.position !== this.properties.position) {
            // Bind the mesh's position to the rigidbody that represents this part
            Object.defineProperties( collidermesh, {
              position: {
                enumerable: true,
                configurable: true,
                value: rigidbody.position
              },
              quaternion: {
                enumerable: true,
                configurable: true,
                value: rigidbody.orientation
              },
              scale: {
                enumerable: true,
                configurable: true,
                value: rigidbody.scale
              },
            });
          }
          collidermesh.userData.thing = this;
          this.colliders.add(collidermesh);
        }
        collidermesh.updateMatrix();
        collidermesh.updateMatrixWorld();
        var colliderhelper = this.colliderhelper;
        if (!colliderhelper) {
          //colliderhelper = this.colliderhelper = new THREE.EdgesHelper(collidermesh, 0x999900);
          //colliderhelper.matrix = collidermesh.matrix;
          //this.colliders.add(colliderhelper);
        } else {
          //THREE.EdgesHelper.call(colliderhelper, collidermesh, 0x990099);
        }
        //this.engine.systems.world.scene['colliders'].add(colliderhelper);

        // TODO - integrate this with the physics debug system
        /*
        elation.events.add(rigidbody, 'physics_collide', function() { 
          collidermat.color.setHex(0x990000); 
          colliderhelper.material.color.setHex(0x990000); 
          setTimeout(function() { 
            collidermat.color.setHex(0x999900); 
            colliderhelper.material.color.setHex(0x999900); 
          }, 100); 
        });
        elation.events.add(this, 'mouseover,mouseout', elation.bind(this, function(ev) { 
          var color = 0xffff00;
          if (ev.type == 'mouseover' && ev.data.object === collidermesh) {
            color = 0x00ff00;
          }
          collidermat.color.setHex(0xffff00); 
          colliderhelper.material.color.setHex(color); 
          this.refresh();
        }));
        */
      }
    }
  }
  this.resetColliders = function() {
    while (this.colliders.children.length > 0) {
      this.colliders.remove(this.colliders.children[0]);
    }
  }
  this.physics_collide = function(ev) {
    var obj1 = ev.data.bodies[0].object, obj2 = ev.data.bodies[1].object;

    let events = elation.events.fire({type: 'collide', element: this, data: {
      other: (obj1 == this ? obj2 : obj1),
      collision: ev.data
    } });
    if (elation.events.wasDefaultPrevented(events)) {
      ev.preventDefault();
    }
  }
  this.loadJSON = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures/';
    }
    var loader = new THREE.JSONLoader();
    loader.load(url, elation.bind(this, this.processJSON), texturepath);
  }
  this.processJSON = function(geometry, materials) {
    geometry.computeFaceNormals();
    geometry.computeVertexNormals();
    var mesh = new THREE.Mesh(geometry, materials);
    mesh.doubleSided = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    //this.objects['3d'].updateCollisionSize();
    elation.events.fire({type: "thing_load", element: this, data: mesh});
    this.objects['3d'].add(mesh);
    this.refresh();
  }
  this.loadJSONScene = function(url, texturepath) {
    if (typeof texturepath == 'undefined') {
      texturepath = '/media/space/textures';
    }
    var loader = new THREE.ObjectLoader();
    loader.load(url, elation.bind(this, this.processJSONScene, url));
  }
  this.processJSONScene = function(url, scene) {
    this.extractEntities(scene);
    this.objects['3d'].add(scene);

    this.extractColliders(scene);
    var textures = this.extractTextures(scene, true);
    this.loadTextures(textures);
    elation.events.fire({ type: 'resource_load_finish', element: this, data: { type: 'model', url: url } });

    this.extractAnimations(scene);

    this.refresh();
  }
  this.loadCollada = function(url) {
    if (!THREE.ColladaLoader) {
      // If the loader hasn't been initialized yet, fetch it!
      elation.require('engine.external.three.ColladaLoader', elation.bind(this, this.loadCollada, url));
    } else {
      var loader = new THREE.ColladaLoader();
      loader.options.convertUpAxis = true;
      var xhr = loader.load(url, elation.bind(this, this.processCollada, url));
      elation.events.fire({ type: 'resource_load_start', element: this, data: { type: 'model', url: url } });
    }
  }
  this.processCollada = function(url, collada) {
    //collada.scene.rotation.x = -Math.PI / 2;
    //collada.scene.rotation.z = Math.PI;
    this.extractEntities(collada.scene);
/*
    collada.scene.computeBoundingSphere();
    collada.scene.computeBoundingBox();
    //this.updateCollisionSize();
*/
    this.objects['3d'].add(collada.scene);

    this.extractColliders(collada.scene, true);
    var textures = this.extractTextures(collada.scene, true);
    this.loadTextures(textures);
    elation.events.fire({ type: 'resource_load_finish', element: this, data: { type: 'model', url: url } });

    this.refresh();
  }
  this.loadglTF = function(url) {
    if (!THREE.glTFLoader) {
      // If the loader hasn't been initialized yet, fetch it!
      elation.require('engine.external.three.glTFLoader-combined', elation.bind(this, this.loadglTF, url));
    } else {
      var loader = new THREE.glTFLoader();
      loader.useBufferGeometry = true;
      loader.load(url, elation.bind(this, this.processglTF, url));
      elation.events.fire({ type: 'resource_load_start', data: { type: 'model', url: url } });
    }
  }
  this.processglTF = function(url, scenedata) {
    this.extractEntities(scenedata.scene);
    //this.updateCollisionSize();
    //this.objects['3d'].add(scenedata.scene);
    var parent = this.objects['3d'].parent;
    parent.remove(this.objects['3d']);
    this.objects['3d'] = new THREE.Object3D();
    this.bindObjectProperties(this.objects['3d']);
    this.objects['3d'].userData.thing = this;

    // Correct coordinate space from various modelling programs
    // FIXME - hardcoded for blender's settings for now, this should come from a property
    var scene = scenedata.scene;
    scene.rotation.x = -Math.PI/2;

    // FIXME - enable shadows for all non-transparent materials.  This should be coming from the model file...
    scene.traverse(function(n) {
      if (n instanceof THREE.Mesh) {
        if (n.material && !(n.material.transparent || n.material.opacity < 1.0)) {
          n.castShadow = true;
          n.receiveShadow = true;
        } else {
          n.castShadow = false;
          n.receiveShadow = false;
        }
      }
    });

/*
    while (scenedata.scene.children.length > 0) {
      var obj = scenedata.scene.children[0];
      scenedata.scene.remove(obj);
      coordspace.add(obj);
    }
    this.objects['3d'].add(coordspace);
*/
    this.objects['3d'].add(scene);

    //this.objects['3d'].quaternion.setFromEuler(scenedata.scene.rotation);

    var textures = this.extractTextures(scene, true);
    this.loadTextures(textures);

    parent.add(this.objects['3d']);

    // If no pending textures, we're already loaded, so fire the event
    if (this.pendingtextures == 0) {
      elation.events.fire({type: "thing_load", element: this, data: scenedata.scene});
    }

    elation.events.fire({ type: 'resource_load_finish', data: { type: 'model', url: url } });

    this.refresh();
  }
  this.loadMeshName = function(meshname) {
    var subobj = elation.engine.geometries.getMesh(meshname);
    subobj.rotation.x = -Math.PI/2;
    subobj.rotation.y = 0;
    subobj.rotation.z = Math.PI;
    this.extractEntities(subobj);
    this.objects['3d'].add(subobj);
    this.extractColliders(subobj);

    elation.events.add(null, 'resource_load_complete', elation.bind(this, this.extractColliders, subobj));

    if (ENV_IS_BROWSER){
      var textures = this.extractTextures(subobj, true);
      this.loadTextures(textures);
    }
  }
  this.extractEntities = function(scene) {
    this.cameras = [];
    this.parts = {};
    if (!scene) scene = this.objects['3d'];
    scene.traverse(elation.bind(this, function ( node ) { 
      if ( node instanceof THREE.Camera ) {
        this.cameras.push(node);
      //} else if (node instanceof THREE.Mesh) {
      } else if (node.name !== '') {
        this.parts[node.name] = node;
        node.castShadow = this.properties.shadow;
        node.receiveShadow = this.properties.shadow;
      }
      if (node.material) {
        node.material.fog = this.properties.fog;
        node.material.wireframe = this.properties.wireframe;
      }
    }));
    //console.log('Collada loaded: ', this.parts, this.cameras, this); 
    if (this.cameras.length > 0) {
      this.camera = this.cameras[0];
    }
    //this.updateCollisionSize();
  }
  this.extractColliders = function(obj, useParentPosition) {
    if (!(this.properties.collidable || this.properties.pickable)) return;
    var meshes = [];
    if (!obj) obj = this.objects['3d'];
    var re = new RegExp(/^[_\*](collider|trigger)-(.*)$/);

    obj.traverse(function(n) { 
      if (n instanceof THREE.Mesh && n.material) {  
        var materials = n.material;
        if (!elation.utils.isArray(n.material)) {
          materials = [n.material];
        } 
        for (var i = 0; i < materials.length; i++) {
          var m = materials[i];
          if (m.name && m.name.match(re)) { 
            n.geometry.computeBoundingBox(); 
            n.geometry.computeBoundingSphere(); 
            meshes.push(n); 
            break;
          }
        }
      } 
    });

    // FIXME - hack to make demo work
    //this.colliders.bindPosition(this.localToWorld(new THREE.Vector3()));

    //var flip = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0));
    var flip = new elation.physics.quaternion();
    var root = new elation.physics.rigidbody({orientation: flip, object: this});// orientation: obj.quaternion.clone() });
    //root.orientation.multiply(flip);

    for (var i = 0; i < meshes.length; i++) {
      var m = meshes[i].material.name.match(re),
          type = m[1],
          shape = m[2];

      var rigid = new elation.physics.rigidbody({object: this});
      var min = meshes[i].geometry.boundingBox.min.clone().multiply(meshes[i].scale),
          max = meshes[i].geometry.boundingBox.max.clone().multiply(meshes[i].scale);
      //console.log('type is', type, shape, min, max);

      var position = meshes[i].position,
          orientation = meshes[i].quaternion;
      if (useParentPosition) {
        position = meshes[i].parent.position;
        orientation = meshes[i].parent.quaternion;
      }
 
      rigid.position.copy(position);
      rigid.orientation.copy(orientation);

      min.x *= this.properties.scale.x;
      min.y *= this.properties.scale.y;
      min.z *= this.properties.scale.z;
      max.x *= this.properties.scale.x;
      max.y *= this.properties.scale.y;
      max.z *= this.properties.scale.z;

      rigid.position.x *= this.properties.scale.x;
      rigid.position.y *= this.properties.scale.y;
      rigid.position.z *= this.properties.scale.z;

      if (shape == 'box') {
        this.setCollider('box', {min: min, max: max}, rigid);
      } else if (shape == 'sphere') {
        this.setCollider('sphere', {radius: Math.max(max.x, max.y, max.z)}, rigid);
      } else if (shape == 'cylinder') {
        var radius = Math.max(max.x - min.x, max.z - min.z) / 2,
            height = max.y - min.y,
            pos = max.clone().add(min).multiplyScalar(.5);
        this.setCollider('cylinder', {radius: radius, height: height, offset: pos}, rigid);

        rigid.position.add(pos);
        // FIXME - rotate everything by 90 degrees on x axis to match default orientation
        var rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI/2, 0));
        rigid.orientation.multiply(rot);
      }

      if (type == 'collider') {
        //console.log('add collider:', rigid, rigid.position.toArray(), rigid.orientation.toArray());
        root.add(rigid);
      } else if (type == 'trigger') {
        var triggername = meshes[i].parent.name;

        var size = new THREE.Vector3().subVectors(max, min);
/*
        size.x /= this.properties.scale.x;
        size.y /= this.properties.scale.y;
        size.z /= this.properties.scale.z;
*/

        var quat = new THREE.Quaternion().multiplyQuaternions(obj.quaternion, rigid.orientation); 
        var pos = rigid.position.clone().applyQuaternion(quat);
/*
        pos.x /= this.properties.scale.x;
        pos.y /= this.properties.scale.y;
        pos.z /= this.properties.scale.z;
*/

        this.triggers[triggername] = this.spawn('trigger', 'trigger_' + this.name + '_' + triggername, {
          position: pos, 
          orientation: quat,
          shape: shape,
          size: size,
          scale: new THREE.Vector3(1 / this.properties.scale.x, 1 / this.properties.scale.y, 1 / this.properties.scale.z)
        });
      }
      meshes[i].parent.remove(meshes[i]);
      meshes[i].position.copy(rigid.position);
      meshes[i].quaternion.copy(rigid.orientation);
/*
      meshes[i].bindPosition(rigid.position);
      meshes[i].bindQuaternion(rigid.orientation);
*/
      //meshes[i].bindScale(this.properties.scale);
      meshes[i].userData.thing = this;
      meshes[i].updateMatrix();
      meshes[i].updateMatrixWorld();
      //meshes[i].material = new THREE.MeshPhongMaterial({color: 0x999900, emissive: 0x666666, opacity: .5, transparent: true});
      this.colliders.add(meshes[i]);
      let collidercolor = 0x999999;
      if (rigid.mass === 0) {
        collidercolor = 0x990000;
      }
      meshes[i].material = new THREE.MeshPhongMaterial({color: 0x0000ff, opacity: .2, transparent: true, emissive: 0x552200, alphaTest: .1, depthTest: false, depthWrite: false});
/*
      this.colliderhelper = new THREE.EdgesHelper(meshes[i], 0x00ff00);
      this.colliders.add(this.colliderhelper);
      this.engine.systems.world.scene['colliders'].add(this.colliderhelper);
      meshes[i].updateMatrix();
      meshes[i].updateMatrixWorld();
*/
    }
    if (this.objects.dynamics) {
      this.objects.dynamics.add(root);
    }

    /*
    new3d.scale.copy(obj.scale);
    new3d.position.copy(obj.position);
    new3d.quaternion.copy(obj.quaternion);
    this.objects['3d'].add(new3d);
    */
    //this.colliders.bindScale(this.properties.scale);
    //this.colliders.updateMatrixWorld();
    return this.colliders;
  }
  this.extractTextures = function(object, useloadhandler) {
    if (!object) object = this.objects['3d'];

    // Extract the unique texture images out of the specified object
    var unique = {};
    var ret = [];
    var mapnames = ['map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap', 'envMap'];
    object.traverse(function(n) {
      if (n instanceof THREE.Mesh) {
        var materials = n.material;
        if (!elation.utils.isArray(n.material)) {
          materials = [n.material];
        }
        
        for (var materialidx = 0; materialidx < materials.length; materialidx++) {
          var m = materials[materialidx];
          for (var mapidx = 0; mapidx < mapnames.length; mapidx++) {
            var tex = m[mapnames[mapidx]];
            if (tex) {
              if (tex.image && !unique[tex.image.src]) {
                unique[tex.image.src] = true;
                ret.push(tex);
              } else if (!tex.image && tex.sourceFile != '') {  
                if (!unique[tex.sourceFile]) {
                  unique[tex.sourceFile] = true;
                  ret.push(tex);
                }
              } else if (!tex.image) {
                ret.push(tex);
              }
            }
          }
        }
      }
    });
    return ret;
  }
  this.extractAnimations = function(scene) {
    var animations = [],
        actions = {},
        skeleton = false,
        meshes = [],
        num = 0;

    scene.traverse(function(n) {
      if (n.animations) {
        //animations[n.name] = n;
        animations.push.apply(animations, n.animations);
        num += n.animations.length;
      }
      if (n.skeleton) {
        skeleton = n.skeleton;
      }
      if (n instanceof THREE.SkinnedMesh) {
        meshes.push(n);
      }
    });

    var mixer = this.animationmixer = new THREE.AnimationMixer(scene);
//console.log('animation mixer', mixer, meshes[0]);
    if (skeleton) {
      this.skeleton = skeleton;

/*
      scene.traverse(function(n) {
        n.skeleton = skeleton;
      });
*/
      if (true) { //meshes.length > 0) {
        var skeletons = [];
        for (var i = 0; i < meshes.length; i++) {
          //meshes[i].bind(this.skeleton);
          skeletons.push(meshes[i].skeleton);
        }
        // FIXME - shouldn't be hardcoded!
        var then = performance.now();
        setInterval(elation.bind(this, function() {
          var now = performance.now(),
              diff = now - then;
          then = now;
          this.animationmixer.update(diff / 1000);
          for (var i = 0; i < skeletons.length; i++) {
            skeletons[i].update();
          }
          this.refresh();
        }), 16);
      }
    }
    if (num > 0) {
      this.animations = animations;
      for (var i = 0; i < animations.length; i++) {
        var anim = animations[i];
        actions[anim.name] = mixer.clipAction(anim);
      }
      this.animationactions = actions;
    }

    if (this.skeletonhelper && this.skeletonhelper.parent) {
      this.skeletonhelper.parent.remove(this.skeletonhelper);
    }
    this.skeletonhelper = new THREE.SkeletonHelper(this.objects['3d']);

    //this.engine.systems.world.scene['world-3d'].add(this.skeletonhelper);

  }
  this.rebindAnimations = function() {
    var rootobject = this.objects['3d'];

    if (this.animationmixer) {
      // Reset to t-pose before rebinding skeleton
      this.animationmixer.stopAllAction();
      this.animationmixer.update(0);
    }

    rootobject.traverse(function(n) {
      if (n instanceof THREE.SkinnedMesh) {
        n.rebindByName(rootobject);
        this.skeletonhelper = new THREE.SkeletonHelper(this.objects['3d']);
      }
    });
  }
  this.initAnimations = function(animations) {
    let skinnedmeshes = [];
    if (!animations || animations.length == 0) {
      this.objects['3d'].traverse(n => {
        if (n.animations && n.animations.length > 0) {
          animations = n.animations;
        }
      });
    }

    this.animationmixer = false;
    this.animations = {};
    if (!animations) return;
    let mixer = new THREE.AnimationMixer(this.objects['3d']);
    animations.forEach(clip => {
      let action = mixer.clipAction(clip);
      this.animations[clip.name] = action;
      //action.play();
    });
    this.animationmixer = mixer;
    mixer.setTime(new Date().getTime() / 1000);
  }
  this.loadTextures = function(textures) {
    this.pendingtextures = 0;
    for (var i = 0; i < textures.length; i++) {
      if (textures[i].image) {
        if (!textures[i].image.complete) {
          elation.events.fire({ type: 'resource_load_start', data: { type: 'image', image: textures[i].image } });
          this.pendingtextures++;
          elation.events.add(textures[i].image, 'load', elation.bind(this, this.textureLoadComplete));
        }
      }
    }

    // Everything was already loaded, so fire the event immediately
    if (this.pendingtextures === 0) {
      this.refresh();
      elation.events.fire({type: "thing_load", element: this, data: this.objects['3d']});
    }
  }
  this.textureLoadComplete = function(ev) {
    this.refresh();
    if (--this.pendingtextures == 0) {
      // Fire the thing_load event once all textures are loaded
      elation.events.fire({type: "thing_load", element: this, data: this.objects['3d']});
    }
  }
  this.spawn = function(type, name, spawnargs, orphan) {
    var newspawn = this.engine.systems.world.spawn(type, name, spawnargs, (orphan ? null : this));
    return newspawn;
  }
  this.die = function() {
    this.removeDynamics();
    if (this.parent) {
      this.parent.remove(this);
    }
    if (this.children) {
      var keys = Object.keys(this.children);
      for (var i = 0; i < keys.length; i++) {
        this.children[keys[i]].die();
      }
    }
    elation.events.fire({element: this, type: 'thing_destroy'});
    this.destroy();
  }
  this.refresh = function() {
    elation.events.fire({type: 'thing_change_queued', element: this});
  }
  this.applyChanges = function() {
    var s = this.scale;
    if (s && this.objects['3d']) {
      this.objects['3d'].visible = this.visible && !(s.x == 0 || s.y == 0 || s.z == 0);
    }
    if (this.colliders) {
      this.colliders.position.copy(this.properties.position);
      this.colliders.quaternion.copy(this.properties.orientation);
      this.colliders.scale.copy(this.properties.scale);
    }
    elation.events.fire({type: 'thing_change', element: this});
  }
  this.reload = function() {
    this.set('forcereload', true, true);
  }
  this.worldToLocal = function(worldpos, clone) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    if (clone) worldpos = worldpos.clone();
    return this.objects['3d'].worldToLocal(worldpos);
  }
  this.localToWorld = function(localpos, clone) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    if (clone) localpos = localpos.clone();
    return this.objects['3d'].localToWorld(localpos);
  }
  this.worldToParent = function(worldpos, clone) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    if (clone) worldpos = worldpos.clone();
    return this.objects['3d'].parent.worldToLocal(worldpos);
  }
  this.localToParent = function(localpos, clone) {
    if (this.objects['3d'].matrixWorldNeedsUpdate) this.objects['3d'].updateMatrixWorld();
    if (clone) localpos = localpos.clone();
    return localpos.applyMatrix4(this.objects['3d'].matrix);
  }
  this.localToWorldOrientation = function(orient) {
    if (!orient) orient = new THREE.Quaternion();
    var n = this;
    while (n && n.properties) {
      orient.multiply(n.properties.orientation);
      n = n.parent;
    }
    return orient;
  }
  this.worldToLocalOrientation = function(orient) {
    if (!orient) orient = new THREE.Quaternion();
/*
    var n = this.parent;
    var worldorient = new THREE.Quaternion();
    while (n && n.properties) {
      worldorient.multiply(inverse.copy(n.properties.orientation).inverse());
      n = n.parent;
    }
    return orient.multiply(worldorient);
*/
    // FIXME - this is cheating!
    var tmpquat = new THREE.Quaternion();
    return orient.multiply(tmpquat.copy(this.objects.dynamics.orientationWorld).inverse());
    
  }
  this.getWorldPosition = function(target) {
    if (!target) target = new THREE.Vector3();
    if (this.objects['3d'].matrixWorldNeedsUpdate) {
      this.objects['3d'].updateMatrixWorld();
    }
    target.setFromMatrixPosition(this.objects['3d'].matrixWorld);
    return target;
  }
  this.lookAt = function(other, up) {
    if (!up) up = new THREE.Vector3(0,1,0);
    var otherpos = false;
    if (other.properties && other.properties.position) {
      otherpos = other.localToWorld(new THREE.Vector3());
    } else if (other instanceof THREE.Vector3) {
      otherpos = other.clone();
    }
    var thispos = this.localToWorld(new THREE.Vector3());

    if (otherpos) {
      var dir = thispos.clone().sub(otherpos).normalize();
      var axis = new THREE.Vector3().crossVectors(up, dir);
      var angle = dir.dot(up);
      this.properties.orientation.setFromAxisAngle(axis, -angle);
//console.log(thispos.toArray(), otherpos.toArray(), dir.toArray(), axis.toArray(), angle, this.properties.orientation.toArray());
    }
  }
  this.serialize = function(serializeAll) {
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
            break;
/*
          case 'color':
            propval = propval.getHexString();
            break;
*/
          case 'component':
            var ref = propval;
            propval = [ ref.type, ref.id ];
            break;

        }
        try {
          if (propval !== null && !elation.utils.isIdentical(propval, propdef.default)) {
            //elation.utils.arrayset(ret.properties, k, propval);
            ret.properties[k] = propval;
            numprops++;
          }
        } catch (e) {
          console.log("Error serializing property: " + k, this, e); 
        }
      }
    }
    if (numprops == 0) delete ret.properties;

    for (var k in this.children) {
      if (this.children[k].properties) {
        if (!serializeAll) {
          if (this.children[k].properties.persist) {
            ret.things[k] = this.children[k].serialize();
            numthings++;
          }
        }
        else {
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
  //this.thing_add = function(ev) {
  //  elation.events.fire({type: 'thing_add', element: this, data: ev.data});
  //}

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
      //this.camera.eulerOrder = "YZX";
      this.camera.rotation.copy(rotation);
    }
    this.objects['3d'].add(this.camera);
  }
*/

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
  this.addTag = function(tag) {
    if (!this.hasTag(tag)) {
      this.tags.push(tag);
      return true;
    }
    return false;
  }
  this.hasTag = function(tag) {
    return (this.tags.indexOf(tag) !== -1);
  }
  this.removeTag = function(tag) {
    var idx = this.tags.indexOf(tag);
    if (idx !== -1) {
      this.tags.splice(idx, 1);
      return true;
    }
    return false;
  }
  this.getPlayer = function() {
    console.log('player id:', this.get('player_id'));
    return this.get('player_id');
  }
  this.addPart = function(name, part) {
    if (this.parts[name] === undefined) {
      this.parts[name] = part;
      var type = part.componentname;
      if (this.parttypes[type] === undefined) {
        this.parttypes[type] = [];
      }
      this.parttypes[type].push(part);
      return true;
    }
    return false;
  }
  this.hasPart = function(name) {
    return (this.parts[name] !== undefined);
  }
  this.hasPartOfType = function(type) {
    return (this.parttypes[type] !== undefined && this.parttypes[type].length > 0);
  }
  this.getPart = function(name) {
    return this.parts[name];
  }
  this.getPartsByType = function(type) {
    return this.parttypes[type] || [];
  }
  this.getThingByObject = function(obj) {
    while (obj) {
      if (obj.userData.thing) return obj.userData.thing;
      obj = obj.parent;
    }
    return null;
  }
  this.getObjectsByTag = function(tag) {
  }
  this.getChildren = function(collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      collection.push(this.children[k]);
      this.children[k].getChildren(collection);
    }
    return collection;
  }
  this.getChildrenByProperty = function(key, value, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k][key] === value) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByProperty(key, value, collection);
    }
    return collection;
  }
  this.getChildrenByPlayer = function(player, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].getPlayer() == player) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByPlayer(player, collection);
    }
    return collection;
  }
  this.getChildrenByTag = function(tag, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].hasTag(tag)) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByTag(tag, collection);
    }
    return collection;
  }
  this.getChildrenByType = function(type, collection) {
    if (typeof collection == 'undefined') collection = [];
    for (var k in this.children) {
      if (this.children[k].type == type) {
        collection.push(this.children[k]);
      }
      this.children[k].getChildrenByType(type, collection);
    }
    return collection;
  }
  this.distanceTo = function(obj) {
    return Math.sqrt(this.distanceToSquared(obj));
  }
  this.distanceToSquared = (function() {
    // closure scratch variables
    var _v1 = new THREE.Vector3(),
        _v2 = new THREE.Vector3();
    return function(obj) {
      var mypos = this.localToWorld(_v1.set(0,0,0));
      if (obj && obj.localToWorld) {
        return mypos.distanceToSquared(obj.localToWorld(_v2.set(0,0,0)));
      } else if (obj instanceof THREE.Vector3) {
        return mypos.distanceToSquared(obj);
      }
      return Infinity;
    } 
  })();
  this.canUse = function(object) {
    return false;
  }
  this.thing_use_activate = function(ev) {
    var player = ev.data;
    var canuse = this.canUse(player);
    if (canuse && canuse.action) {
      canuse.action(player);
    }
  }
  this.getBoundingSphere = function() {
    // Iterate over all children and expand our bounding sphere to encompass them.  
    // This gives us the total size of the whole thing

    var bounds = new THREE.Sphere();
    var worldpos = this.localToWorld(new THREE.Vector3());
    var childworldpos = new THREE.Vector3();
    this.objects['3d'].traverse((n) => {
      childworldpos.set(0,0,0).applyMatrix4(n.matrixWorld);
      if (n instanceof THREE.Mesh) {
        if (!n.geometry.boundingSphere) {
          n.geometry.computeBoundingSphere();
        }
        var newradius = worldpos.distanceTo(childworldpos) + n.geometry.boundingSphere.radius * Math.max(n.scale.x, n.scale.y, n.scale.z);
        if (newradius > bounds.radius) {
          bounds.radius = newradius;
        }
      }
    });
    return bounds; 
  }
  this.getBoundingBox = function(local) {
    // Iterate over all children and expand our bounding box to encompass them.  
    // This gives us the total size of the whole thing

    var bounds = new THREE.Box3();
    bounds.setFromObject(this.objects['3d']);

    if (bounds.min.lengthSq() === Infinity || bounds.max.lengthSq === Infinity) {
      bounds.min.set(0,0,0);
      bounds.max.set(0,0,0);
    }

    if (local) {
      this.worldToLocal(bounds.min);
      this.worldToLocal(bounds.max);
    }

    return bounds; 
  }
  this.bindObjectProperties = function(obj) {
    Object.defineProperties( obj, {
      position: {
        enumerable: true,
        configurable: true,
        value: this.properties.position
      },
      quaternion: {
        enumerable: true,
        configurable: true,
        value: this.properties.orientation
      },
      scale: {
        enumerable: true,
        configurable: true,
        value: this.properties.scale
      },
    });
  }
  this.playAnimation = function(name) {
    let anim = false;
    if (this.animations) {
      this.animations.forEach(n => {
        if (n.name == name) {
          anim = n;
        }
      });
    }
    console.log('play anim', anim);
    if (anim) {
      this.animationmixer.clipAction(anim).play();
    }
  }
  this.enableDebug = function() {
    if (this.objects.dynamics) {
      this.engine.systems.physics.debug(this);
    }
    for (let k in this.children) {
      this.children[k].enableDebug();
    }
  }
  this.disableDebug = function() {
    for (let k in this.children) {
      this.children[k].disableDebug();
    }
    if (this.objects.dynamics) {
      this.engine.systems.physics.disableDebug(this);
    }
  }
  this.updatePhysics = function() {
    if (this.objects.dynamics) {
      this.objects.dynamics.restitution = this.restitution;
      this.objects.dynamics.material.dynamicfriction = this.dynamicfriction;
      this.objects.dynamics.material.staticfriction = this.staticfriction;
    }
  }
});
});
