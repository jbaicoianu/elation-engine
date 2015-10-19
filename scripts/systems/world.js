elation.require([
  "engine.things.generic"
], function() {
  elation.extend("engine.systems.world", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.children = {};
    this.scene = {
      'world-3d': new THREE.Scene(),
      'world-dom': new THREE.Scene(),
      'colliders': new THREE.Scene(),
      'sky': false
    };
    this.persistdelay = 1000;
    this.lastpersist = 0;

    //this.scene['world-3d'].fog = new THREE.FogExp2(0x000000, 0.0000008);
    //this.scene['world-3d'].fog = new THREE.FogExp2(0xffffff, 0.01);

    // Initialize collider scene with some basic lighting for debug purposes
    this.scene['colliders'].add(new THREE.AmbientLight(0xcccccc));
    var colliderlight = new THREE.DirectionalLight();
    colliderlight.position.set(10, 17.5, 19);
    this.scene['colliders'].add(colliderlight);

    this.system_attach = function(ev) {
      console.log('INIT: world');
      this.rootname = (args ? args.parentname + '/' + args.name : '/');
      this.loaded = false;
      this.loading = false;

      if (ENV_IS_BROWSER && document.location.hash) {
        this.parseDocumentHash();
        elation.events.add(window, 'popstate', elation.bind(this, this.parseDocumentHash));
      }
      elation.events.add(this, 'world_thing_add', this);
    }

    this.engine_start = function(ev) {
      // If no local world override, load from args
      if (!this.loaded && !this.loading) {
        if (!elation.utils.isEmpty(args)) {
          this.load(args);
        } else {
          //this.createDefaultScene();
        }
      }
    }
    this.engine_frame = function(ev) {
      //console.log('FRAME: world', ev);
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: world');
    }
    this.add = function(thing) {
      if (!this.children[thing.name]) {
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
        if (thing.colliders) {
          this.scene['colliders'].add(thing.colliders);
        }
        this.attachEvents(thing);
        elation.events.fire({type: 'world_thing_add', element: this, data: {thing: thing}});
        return true;
      }
      return false;
    }
    this.attachEvents = function(thing) {
      elation.events.add(thing, 'thing_add,thing_remove,thing_change', this);
      if (thing.children) {
        for (var k in thing.children) {
          this.attachEvents(thing.children[k]);
        }
      }
    }
      
    this.thing_add = function(ev) {
      //elation.events.fire({type: 'world_thing_add', element: this, data: ev.data});
      this.attachEvents(ev.data.thing);
    }
    this.thing_remove = function(ev) {
      elation.events.fire({type: 'world_thing_remove', element: this, data: ev.data});
      elation.events.remove(ev.data.thing, 'thing_add,thing_remove,thing_change', this);
    }
    this.thing_change = function(ev) {
      elation.events.fire({type: 'world_thing_change', element: this, data: ev.data});
    }
    this.world_thing_add = function(ev) {
      //elation.events.add(ev.data.thing, 'thing_add,thing_remove,thing_change', this);
      this.attachEvents(ev.data.thing);

      if (ev.data.thing && ev.data.thing.objects['3d']) {
        var object = ev.data.thing.objects['3d'];
        var hasLight = object instanceof THREE.Light;
        if (!hasLight && object.children.length > 0) {
          object.traverse(function(n) { if (n instanceof THREE.Light) { hasLight = true; } });
        }
        if (hasLight) {
          //console.log('the new thing has a light!');
          this.refreshLights();
        } else {
          //console.log('no light here');
        }
      }
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
        this.children[k].die();
      }
      while (this.scene['world-3d'].children.length > 0) {
        this.scene['world-3d'].remove(this.scene['world-3d'].children[0]);
      }
      while (this.scene['colliders'].children.length > 0) {
        this.scene['colliders'].remove(this.scene['colliders'].children[0]);
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
        this.createDefaultScene();
      }
      if (ENV_IS_BROWSER) {
        var dochash = "world.load=" + name;
        if (this.engine.systems.physics.timescale == 0) {
          dochash += "&world.paused=1";
        }
        document.location.hash = dochash;
      }
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
      this.loading = true;
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
        this.loading = false;
        this.dirty = true;
        elation.events.fire({type: 'engine_world_init', element: this});
      }
    }
    this.reload = function() {
      if (this.rootname) {
        this.loadLocal(this.rootname);
      }
    }
    this.refresh = function() {
      elation.events.fire({type: 'world_change', element: this});
    }
    this.refreshLights = function() {
      this.scene['world-3d'].traverse(function(n) { if (n instanceof THREE.Mesh) { n.material.needsUpdate = true; } });
    }
    this.createDefaultScene = function() {
      var scenedef = {
        type: 'sector',
        name: 'default',
        properties: {
          persist: true
        },
        things: {
          ground: {
            type: 'terrain',
            name: 'ground',
            properties: {
              'textures.map': '/media/space/textures/dirt.jpg',
              'textures.normalMap': '/media/space/textures/dirt-normal.jpg',
              'textures.mapRepeat': [ 100, 100 ],
              'persist': true,
              'position': [0,0,100]
            }
          },
          sun: {
            type: 'light',
            name: 'sun',
            properties: {
              type: 'directional',
              position: [ -20, 50, 25 ],
              persist: true
            }
          }
        }
      };

      this.load(scenedef);

    }
    this.loadSceneFromURL = function(url, callback) {
      this.reset();
      elation.net.get(url, null, { onload: elation.bind(this, this.handleSceneLoad, callback) });  
      if (ENV_IS_BROWSER) {
        var dochash = "world.url=" + url;
        if (this.engine.systems.physics.timescale == 0) {
          dochash += "&world.paused=1";
        }
        document.location.hash = dochash;
      }
    }
    this.handleSceneLoad = function(callback, ev) {
      console.log(ev);
      var response = ev.target.response;
      var data = JSON.parse(response);
      if (elation.utils.isArray(response)) {
        for (var i = 0; i < data.length; i++) {
          this.load(data[i]);
        }
      } else {
        this.load(data);
      }
      if (callback) { setTimeout(callback, 0); }
    }
    this.spawn = function(type, name, spawnargs, parent, autoload) {
      if (elation.utils.isNull(name)) name = type + Math.floor(Math.random() * 1000);
      if (!spawnargs) spawnargs = {};
      if (!parent) parent = this.children['default'] || this;
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
          currentobj = elation.engine.things[type]({type: realtype, container: elation.html.create(), name: name, engine: this.engine, client: this.client, properties: spawnargs});
          parent.add(currentobj);
          //currentobj.reparent(parent);

          //console.log(logprefix + "\t- added new " + type + ": " + name, currentobj);
        }
      } catch (e) {
        console.error(e.stack);
      }
      return currentobj;
    }
    this.serialize = function(serializeAll) {
      var ret = {};
      for (var k in this.children) {
        if (this.children[k].properties.persist) {
          ret[k] = this.children[k].serialize(serializeAll);
          return ret[k]; // FIXME - dumb
        }
      }
      return null;
    }
    this.setSky = function(texture, format, prefixes) {
      if (texture !== false) {
        if (!(texture instanceof THREE.Texture)) {
          format = format || 'jpg';
          prefixes = prefixes || ['p', 'n'];
          if (texture.substr(texture.length-1) != '/') {
            texture += '/';
          }
          var urls = [
            texture + prefixes[0] + 'x' + '.' + format, texture + prefixes[1] + 'x' + '.' + format,
            texture + prefixes[0] + 'y' + '.' + format, texture + prefixes[1] + 'y' + '.' + format,
            texture + prefixes[0] + 'z' + '.' + format, texture + prefixes[1] + 'z' + '.' + format
          ];
          var texturecube = THREE.ImageUtils.loadTextureCube( urls, undefined, elation.bind(this, this.refresh) );
          texturecube.format = THREE.RGBFormat;
          this.skytexture = texturecube;
        }
        if (!this.scene['sky']) {
          this.scene['sky'] = (this.engine.systems.render && this.engine.systems.render.views[0] ? this.engine.systems.render.views[0].skyscene : new THREE.Scene());
          var skygeom = new THREE.BoxGeometry(1,1,1, 10, 10, 10);
          var skymat = new THREE.MeshBasicMaterial({color: 0xff0000, side: THREE.DoubleSide, wireframe: true, depthWrite: false});

          this.skyshader = THREE.ShaderLib[ "cube" ];

          var skymat = new THREE.ShaderMaterial( {
            fragmentShader: this.skyshader.fragmentShader,
            vertexShader: this.skyshader.vertexShader,
            uniforms: this.skyshader.uniforms,
            depthWrite: false,
            side: THREE.DoubleSide
          } );

          this.skymesh = new THREE.Mesh(skygeom, skymat);
          this.scene['sky'].add(this.skymesh);
          //console.log('create sky mesh', this.scene['sky'], this.engine.systems.render.views['main']);
          if (this.engine.systems.render && this.engine.systems.render.views['main']) {
            this.engine.systems.render.views['main'].setskyscene(this.scene['sky']);
          }

        }
        this.skyshader.uniforms[ "tCube" ].value = this.skytexture;
        this.skyenabled = true;
      } else {
        this.skyenabled = false;
      }
      if (this.skyenabled) {
        
      }
    }
    this.setClearColor = function(color, opacity) {
      this.engine.systems['render'].setclearcolor(color, opacity);
    }
    this.setFog = function(near, far, color) {
      if (typeof color == 'undefined') color = 0xffffff;
      this.scene['world-3d'].fog = new THREE.Fog(color, near, far);
    }
    this.setFogExp = function(exp, color) {
      if (!color) color = 0xffffff;
      this.scene['world-3d'].fog = new THREE.FogExp2(color, exp);
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
        if (parsedurl.hashargs['world.url']) {
          elation.net.get(parsedurl.hashargs['world.url'], null, {
            callback: function(response) { 
              try {
                var data = JSON.parse(response);
                this.load(data);
              } catch (e) {
                console.log('Error loading world:', response, e);
              }
            }.bind(this)
          });
        }
      }
    }

    // Convenience functions for querying objects from world
    this.getThingsByTag = function(tag) {
      var things = [];
      var childnames = Object.keys(this.children);
      for (var i = 0; i < childnames.length; i++) {
        var childname = childnames[i];
        if (this.children[childname].hasTag(tag)) {
          things.push(this.children[childname]);
        }
        this.children[childname].getChildrenByTag(tag, things);
      }
      return things;
    }
    this.getThingsByPlayer = function(player) {
      var things = [];
      for (var k in this.children) {
        if (this.children[k].getPlayer() == player) {
          things.push(this.children[k]);
        }
        this.children[k].getChildrenByPlayer(player, things);
      }
      return things;
    }
    this.getThingsByType = function(type) {
      var things = [];
      var childnames = Object.keys(this.children);
      for (var i = 0; i < childnames.length; i++) {
        var childname = childnames[i];
        if (this.children[childname].type == type) {
          things.push(this.children[childname]);
        }
        this.children[childname].getChildrenByType(type, things);
      }
      return things;
    }
    this.getThingByObject = function(obj) {
    }
    this.getThingById = function(id) {
    }
    this.worldToLocal = function(pos) {
      return pos;
    }
    this.localToWorld = function(pos) {
      return pos;
    }
    this.worldToLocalOrientation = function(orient) {
      return orient;
    }
    this.localToWorldOrientation = function(orient) {
      return orient;
    }
  });
});
