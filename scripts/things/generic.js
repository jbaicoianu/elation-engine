elation.component.add("engine.things.generic", function() {
  this.objects = {};
  this.init = function() {
    this.parentname = this.args.parentname || '';
    this.name = this.args.name || '';
    this.type = this.args.type || 'generic';
    this.engine = this.args.engine;
    this.objects = {};
    this.state = {};
    this.children = {};
    this.cameras = [];

    this.properties = {}
    if (this.args.properties) {
      for (var k in this.args.properties) {
        this.properties[k] = {};
        for (var k2 in this.args.properties[k]) {
          elation.utils.arrayset(this.properties[k], k2, this.args.properties[k][k2]);
        }
      }
    }

    this.position = new THREE.Vector3();
    this.orientation = new THREE.Quaternion();

    if (typeof this.preinit == 'function') {
      this.preinit();
    }

    this.initProperties();
    this.init3D();
    this.initDOM();
    this.initPhysics();

    if (typeof this.postinit == 'function') {
      this.postinit();
    }

    elation.events.add(this, 'mouseover', elation.bind(this, function(ev) {
      if (ev.data && ev.data.material) {
        var materials = (ev.data.material instanceof THREE.MeshFaceMaterial ? ev.data.material.materials : [ev.data.material]);
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].emissive) {
            materials[i].emissive.setHex(0x333300);
          }
        }
      }
    }));
    elation.events.add(this, 'mouseout', elation.bind(this, function(ev) {
      if (ev.data && ev.data.material) {
        var materials = (ev.data.material instanceof THREE.MeshFaceMaterial ? ev.data.material.materials : [ev.data.material]);
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].emissive) {
            materials[i].emissive.setHex(0x000000);
          }
        }
      }
    }));

  }
  this.initProperties = function() {
    this.exists = true;
    if (this.properties.physical) {
      if (this.properties.physical.position) {
        if (elation.utils.isString(this.properties.physical.position)) {
          this.properties.physical.position = this.properties.physical.position.split(",");
        }
        this.position.x = this.properties.physical.position[0];
        this.position.y = this.properties.physical.position[1];
        this.position.z = this.properties.physical.position[2];
      }
      if (this.properties.physical.exists === 0) {
        this.exists = false;
        return;
      }
      if (this.properties.physical.rotation) {
        /*
        this.rotation.x = this.properties.physical.rotation[0] * (Math.PI / 180);
        this.rotation.y = this.properties.physical.rotation[1] * (Math.PI / 180);
        this.rotation.z = this.properties.physical.rotation[2] * (Math.PI / 180);
        */
        var euler = new THREE.Vector3(this.properties.physical.rotation[0] * (Math.PI / 180), this.properties.physical.rotation[1] * (Math.PI / 180), this.properties.physical.rotation[2] * (Math.PI / 180));
        this.orientation.setFromEuler(euler);
      }
    }
    if (this.properties.render) {
      if (this.properties.render.scale) {
        this.set("render.scale", new THREE.Vector3(this.properties.render.scale[0], this.properties.render.scale[1], this.properties.render.scale[2]));
      }
      if (this.properties.render.mesh) {
        this.loadJSON(this.properties.render.mesh, this.properties.render.texturepath);
      }
      if (this.properties.render.collada) {
        this.loadCollada(this.properties.render.collada);
      }
    }
  }
  this.set = function(property, value) {
    elation.utils.arrayset(this.properties, property, value);
    if (this.objects['3d']) {
      this.initProperties();
      var parent = this.objects['3d'].parent;
      parent.remove(this.objects['3d']);
      this.objects['3d'] = false;
      this.init3D();
      parent.add(this.objects['3d']);
    }
  }
  this.get = function(property, defval) {
    return elation.utils.arrayget(this.properties, property, defval);
  }
  this.init3D = function() {
    this.objects['3d'] = this.createObject3D();
    this.objects['3d'].position = this.position;
    this.objects['3d'].quaternion = this.orientation;
    this.objects['3d'].scale = this.get("physical.scale", new THREE.Vector3(1,1,1));
    this.objects['3d'].useQuaternion = true;
    this.objects['3d']._thing = this;
  }
  this.initDOM = function() {
    this.objects['dom'] = this.createObjectDOM();
    elation.html.addclass(this.container, "space.thing");
    elation.html.addclass(this.container, "space.things." + this.type);
    this.updateDOM();
  }
  this.initPhysics = function() {
    this.createDynamics();
  }
  this.createObject3D = function() {

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
          case 'basic':
          default:
            material = new THREE.MeshBasicMaterial(materialparams);
        }
      }
    }

    var object = (geometry && material ? new THREE.Mesh(geometry, material) : new THREE.Object3D());
//console.log("DOOBS", this, object);
//console.log("\t\t", geomparams, materialparams);
    if (geometry && material) {
      if (geomparams.flipSided) material.side = THREE.BackSide;
      if (geomparams.doubleSided) material.side = THREE.DoubleSide;
    }
    return object;
/*
    var fuh = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshNormalMaterial());
    fuh.position.z = -5;
    fuh.rotation.y = Math.PI/4;
    fuh.rotation.x = -Math.PI/4;
    return fuh;
*/
  }
  this.createObjectDOM = function() {
    return;
  }
  this.add = function(thing) {
    if (!this.children[thing.id]) {
      this.children[thing.id] = thing;
      thing.parent = this;
console.log('dood', thing, thing.parent);
      if (this.objects && thing.objects && this.objects['3d'] && thing.objects['3d']) {
        this.objects['3d'].add(thing.objects['3d']);
      } else if (thing instanceof THREE.Object3D) {
        this.objects['3d'].add(thing);
      }
      if (this.container && thing.container) {
        this.container.appendChild(thing.container);
      }
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
  this.setState = function(state, value) {
    this.state[state] = value;
    elation.events.fire({element: this, type: "statechange", data: {state: state, value: value}});
  }
  this.setStates = function(states) {
    for (var k in states) {
      this.state[k] = states[k];
    }
    if (typeof this.updateParts == 'function') {
      this.updateParts();
    }
  }
  this.updateDOM = function() {
    this.objects['3d'].updateMatrix();
    this.objects['3d'].updateMatrixWorld();

    return;
    var cssStyle = "";
    cssStyle += elation.space.viewport(0).toCSSMatrix(this.objects['3d'].matrixWorld, false);
    cssStyle += " scale3d(1,-1,1)";
    cssStyle += " translate3d(" + (-.5 * this.container.offsetWidth) + "px," + (-.5 * this.container.offsetHeight) + "px,0) ";
    this.container.style.webkitTransform = cssStyle;
    this.container.style.MozTransform = cssStyle;
  }
  this.addControlContext = function(contextname, mappings, obj) {
    var commands = {}, bindings = {};
    for (var k in mappings) {
      if (elation.utils.isArray(mappings[k])) {
        var keys = mappings[k][0].split(',');
        if (obj) {
          commands[k] = elation.bind(obj, mappings[k][1]);
        } else {
          commands[k] = mappings[k][1];
        }
      } else {
        commands[k] = (function(statename) { return function(ev) { this.setState(statename, ev.value); } })(k);
        var keys = mappings[k].split(',');
      }
      for (i = 0; i < keys.length; i++) {
        bindings[keys[i]] = k;
      }
      this.state[k] = 0;
    }

    this.engine.systems.get('controls').addCommands(contextname, commands);
    this.engine.systems.get('controls').addBindings(contextname, bindings);
    this.controlcontext = contextname;
  }
  this.createDynamics = function() {
    if (!this.objects['dynamics']) {
      var velocity = elation.utils.arrayget(this.properties, 'physical.velocity');
      if (!velocity) velocity = [0,0,0];
      var angular = elation.utils.arrayget(this.properties, 'physical.rotationalvelocity');
      if (!angular) angular = [0,0,0];

      this.objects['dynamics'] = new elation.physics.rigidbody({
        position: this.position,
        orientation: this.orientation,
        mass: this.get("physical.mass", 1),
        velocity: new THREE.Vector3(velocity[0], velocity[1], velocity[2]),
        angular: new THREE.Vector3(angular[0] * Math.PI/180, angular[1] * Math.PI / 180, angular[2] * Math.PI / 180),
        object: this
      });
      //this.dynamics.setVelocity([0,0,5]);
      //this.dynamics.addForce("gravity", [0,-9800,0]);
      elation.physics.system.add(this.objects['dynamics']);

      //this.updateCollisionSize();
      elation.events.add(this.objects['dynamics'], "dynamicsupdate,bounce", this);
    }
  }
  this.removeDynamics = function() {
    if (this.objects['dynamics']) {
      elation.physics.system.remove(this.objects['dynamics']);
      delete this.objects['dynamics'];
    }
  }
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
    elation.events.fire({type: "loaded", element: this, data: mesh});
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
    elation.events.fire({type: "loaded", element: this, data: collada.scene});
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
});
