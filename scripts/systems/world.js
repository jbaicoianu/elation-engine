elation.require([
  "engine.things.generic"
]);
elation.extend("engine.systems.world", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.children = {};
  this.scene = {
    'world-3d': new THREE.Scene(),
    'world-dom': new THREE.Scene(),
    'sky': false
  };
  this.persistdelay = 1000;
  this.lastpersist = 0;

  //this.scene['world-3d'].fog = new THREE.FogExp2(0x000000, 0.0000008);

  this.system_attach = function(ev) {
    console.log('INIT: world');
    this.loaded = false;

    this.rootname = (args ? args.parentname + '/' + args.name : '/');

    // First check localStorage for an overridden world definition
    if (false && localStorage && localStorage['elation.engine.world.override:' + this.rootname]) {
      var world = JSON.parse(localStorage['elation.engine.world.override:' + this.rootname]);
      this.load(world);
    } 

    // If no local world override, load from args
    if (!this.loaded && !elation.utils.isEmpty(args)) {
      this.load(args);
    }
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: world', ev);
    if (ev.timeStamp > this.lastpersist + this.persistdelay) {
      this.persist();
      this.lastpersist = ev.timeStamp;
    }
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: world');
  }
  this.add = function(thing) {
    this.children[thing.name] = thing;
    thing.parent = this;
    if (thing.objects['3d']) {
      this.scene['world-3d'].add(thing.objects['3d']);
    }
    if (thing.container) {
      //this.renderer['world-dom'].domElement.appendChild(thing.container);
    }
    elation.events.add(thing, 'thing_add', elation.bind(this, function(ev) {
      elation.events.fire({type: 'world_thing_add', element: this, data: ev.data});
    }));
  }
  this.remove = function(thing) {
    if (this.children[thing.name]) {
      if (thing.objects['3d']) {
        this.scene['world-3d'].remove(thing.objects['3d']);
      }
      if (thing.container) {
        //this.renderer['world-dom'].domElement.removeChild(thing.container);
      }
      elation.events.fire({type: 'engine_thing_destroy', element: thing});
      delete this.children[thing.name];
    }
  }
  this.extract_types = function(thing, types, onlymissing) {
    if (!types) {
      types = [];
    } 
    if (((onlymissing && typeof elation.engine.things[thing.type] == 'undefined') || !onlymissing) && types.indexOf(thing.type) == -1) {
      types.push(thing.type);
      elation.engine.things[thing.type] = null;
    }
    if (thing.things) {
      for (var k in thing.things) {
        this.extract_types(thing.things[k], types, onlymissing);
      }
    }
    return types;
  }
  this.load = function(thing, root, logprefix) {
    if (!this.root) {
      var loadtypes = this.extract_types(thing, [], true);
      if (loadtypes.length > 0) {
        elation.require(loadtypes.map(function(a) { return 'engine.things.' + a; }), elation.bind(this, function() { this.load(thing, root, logprefix); }));
        return;
      }
    }
    if (!logprefix) logprefix = "";
    if (typeof root == 'undefined') root = this;
    var currentobj = this.spawn(thing.type, thing.name, thing.properties, root);
    if (thing.things) {
      for (var k in thing.things) {
        this.load(thing.things[k], currentobj, logprefix + "\t");
      }
    }
    if (root === this) {
      this.loaded = true;
      elation.events.fire({type: 'engine_world_init', element: this});
    }
  }
  this.spawn = function(type, name, spawnargs, parent) {
    if (!parent) parent = this;
    if (!name) {
      name = type + Math.floor(Math.random() * 1000);
    }
    var logprefix = "";
    if (!spawnargs) spawnargs = {};
    var currentobj = false;
    try {
      if (typeof elation.engine.things[type] != 'function') {
        type = 'generic';
      }
      currentobj = elation.engine.things[type](name, elation.html.create(), {type: type, name: name, engine: this.engine, properties: spawnargs});
      parent.add(currentobj);

      console.log(logprefix + "\t- added new " + type + ": " + name, currentobj);
    } catch (e) {
      console.error(e.stack);
    }
    return currentobj;
  }
  this.serialize = function() {
    var ret = {};
    for (var k in this.children) {
      ret[k] = this.children[k].serialize();
    }
    return ret[k]; // FIXME - dumb
  }
  this.persist = function() {
    localStorage['elation.engine.world.override:' + this.rootname] = JSON.stringify(this.serialize());
    //console.log('persist', localStorage['elation.engine.world.override']);
  }
  this.setSky = function(texture) {
    if (texture !== false) {
      if (!this.scene['sky']) {
        this.scene['sky'] = new THREE.Scene();
        var skygeom = new THREE.CubeGeometry(1,1,1, 10, 10, 10);
        var skymat = new THREE.MeshBasicMaterial({color: 0xff0000, side: THREE.DoubleSide, wireframe: true, depthWrite: false});

        var shader = THREE.ShaderLib[ "cube" ];
        shader.uniforms[ "tCube" ].value = texture;

        var skymat = new THREE.ShaderMaterial( {
          fragmentShader: shader.fragmentShader,
          vertexShader: shader.vertexShader,
          uniforms: shader.uniforms,
          depthWrite: false,
          side: THREE.DoubleSide
        } );

        this.skymesh = new THREE.Mesh(skygeom, skymat);
        this.scene['sky'].add(this.skymesh);
        console.log('create sky mesh');
      }
      this.skyenabled = true;
    } else {
      this.skyenabled = false;
    }
    if (this.skyenabled) {
      
    }
  }
});

