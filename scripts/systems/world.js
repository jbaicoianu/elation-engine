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

    if (document.location.hash) {
      this.parseDocumentHash();
    }
    elation.events.add(window, 'popstate', elation.bind(this, this.parseDocumentHash));

    // If no local world override, load from args
    if (!this.loaded && !elation.utils.isEmpty(args)) {
      this.load(args);
    }
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: world', ev);
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
    if (thing.objects['dynamics']) {
      this.engine.systems.physics.add(thing.objects['dynamics']);
    }
    if (thing.container) {
      //this.renderer['world-dom'].domElement.appendChild(thing.container);
    }
    elation.events.add(thing, 'thing_add', elation.bind(this, function(ev) {
      elation.events.fire({type: 'world_thing_add', element: this, data: ev.data});
    }));
    elation.events.add(thing, 'thing_remove', elation.bind(this, function(ev) {
      elation.events.fire({type: 'world_thing_remove', element: this, data: ev.data});
    }));
    elation.events.fire({type: 'world_thing_add', element: this, data: {thing: thing}});
  }
  this.remove = function(thing) {
    if (this.children[thing.name]) {
      if (thing.objects['3d']) {
        this.scene['world-3d'].remove(thing.objects['3d']);
      }
      if (thing.container) {
        //this.renderer['world-dom'].domElement.removeChild(thing.container);
      }
      delete this.children[thing.name];
      elation.events.fire({type: 'world_thing_remove', element: this, data: {thing: thing}});
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
  this.reset = function() {
    for (var k in this.children) {
      this.remove(this.children[k]);
    }
  }
  this.createNew = function() {
    this.reset();
    this.spawn("sector", "default");
  }
  this.saveLocal = function(name) {
    if (!name) name = this.rootname;
    console.log('Saved local world: ' + name);
    var key = 'elation.engine.world.override:' + name;
    localStorage[key] = JSON.stringify(this.serialize());
  }
  this.loadLocal = function(name) {
    console.log('Load local world: ' + name);
    this.rootname = name;
    this.reset();
    var key = 'elation.engine.world.override:' + name;
    if (localStorage[key]) {
      var world = JSON.parse(localStorage[key]);
      this.load(world);
    } else {
      this.spawn("sector", "default");
    }
    var dochash = "world.load=" + name;
    if (this.engine.systems.physics.timescale == 0) {
      dochash += "&world.paused=1";
    }
    document.location.hash = dochash;
  }
  this.listLocalOverrides = function() {
    var overrides = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key.match(/elation\.engine\.world\.override:/)) {
        var name = key.substr(key.indexOf(':')+1);
        overrides.push(name);
      } 
    }
    return overrides;
  }
  this.load = function(thing, root, logprefix) {
    if (!thing) return;
    if (!this.root) {
      this.currentlyloaded = thing;
      var loadtypes = this.extract_types(thing, [], true);
      if (loadtypes.length > 0) {
        elation.require(loadtypes.map(function(a) { return 'engine.things.' + a; }), elation.bind(this, function() { this.load(thing, root, logprefix); }));
        return;
      }
    }
    if (!logprefix) logprefix = "";
    if (typeof root == 'undefined') {
      //this.rootname = (thing.parentname ? thing.parentname : '') + '/' + thing.name;
      root = this;
    }
    var currentobj = this.spawn(thing.type, thing.name, thing.properties, root, false);
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
  this.reload = function() {
    if (this.rootname) {
console.log('reload');
      this.loadLocal(this.rootname);
    }
  }
  this.spawn = function(type, name, spawnargs, parent, autoload) {
    if (elation.utils.isNull(name)) name = type + Math.floor(Math.random() * 1000);
    if (!spawnargs) spawnargs = {};
    if (!parent) parent = this;
    if (typeof autoload == 'undefined') autoload = true;

    var logprefix = "";
    var currentobj = false;
    var realtype = type;
    var initialized = false;
    try {
      if (typeof elation.engine.things[type] != 'function') {
        if (autoload) {
          // Asynchronously load the new object type's definition, and create the real object when we're done
          elation.require('engine.things.' + realtype, elation.bind(this, function() {
            if (currentobj) { 
              currentobj.die(); 
            }
            this.spawn(realtype, name, spawnargs, parent, false);
          }));

        }
        // FIXME - we should be able to return a generic, load the new object asynchronously, and then morph the generic into the specified type
        // Right now this might end up with weird double-object behavior...
        type = 'generic';
      } else {
        currentobj = elation.engine.things[type](name, elation.html.create(), {type: realtype, name: name, engine: this.engine, properties: spawnargs});
        parent.add(currentobj);
        //currentobj.reparent(parent);

        console.log(logprefix + "\t- added new " + type + ": " + name, currentobj);
      }
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
        console.log('create sky mesh', this.scene['sky']);
      }
      this.skyenabled = true;
    } else {
      this.skyenabled = false;
    }
    if (this.skyenabled) {
      
    }
  }
  this.parseDocumentHash = function() {
    var parsedurl = elation.utils.parseURL(document.location.hash);
    if (parsedurl.hashargs) {
      if (+parsedurl.hashargs['world.paused']) {
        this.engine.systems.physics.timescale = 0;
      }
      if (parsedurl.hashargs['world.load'] && parsedurl.hashargs['world.load'] != this.rootname) {
        this.loadLocal(parsedurl.hashargs['world.load']);
      }
    }
  }
});

