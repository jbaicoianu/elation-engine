var deps = [ 
  "engine.parts",
  "engine.materials",
  "engine.geometries",
  "engine.things.generic",
  "utils.math",
];

if (ENV_IS_BROWSER) {
  deps.push("engine.external.three.three");
  deps.push("ui.panel");
}

else if (ENV_IS_NODE) {
  deps.push("engine.external.three.nodethree");
}

elation.require(deps, function() {
  elation.requireCSS('engine.engine');

  elation.extend("engine.instances", {});
  elation.extend("engine.create", function(name, systems, callback) {
    var engine = new elation.engine.main(name);
    elation.events.add(engine.systems, 'engine_systems_added', function() { callback(engine); })
    engine.systems.add(systems);
    this.instances[name] = engine;
    return engine;
  });
  elation.extend("engine.main", function(name) {
    this.started = false;
    this.running = false;
    this.name = name;

    this.init = function() {
      this.systems = new elation.engine.systems(this);
      // shutdown cleanly if the user leaves the page
      // TODO
      // elation.events.add(window, "unload", elation.bind(this, this.stop)); 
    }
    this.start = function() {
      this.started = this.running = true;
      elation.events.fire({element: this, type: "engine_start"});
      this.lastupdate = new Date().getTime();
      // Start run loop, passing in current time
      this.run(0);
    }
    this.stop = function() {
      elation.events.fire({element: this, type: "engine_stop"});
      this.running = false;
    }

    this.run = function(ts) {
      // recursively request another frame until we're no longer running
      if (!ts) ts = new Date().getTime();
      if (this.running) {
        if (!this.boundfunc) this.boundfunc = elation.bind(this, this.run);
        this.frame(this.boundfunc);
      }
      var evdata = {
        ts: ts,
        delta: (ts - this.lastupdate) / 1000
      };
      // fire engine_frame event, which kicks off processing in any active systems
      //console.log("==========");
      elation.events.fire({type: "engine_frame", element: this, data: evdata});
      // console.log('did a frame', this.systems.world.children.vrcade);
      this.lastupdate = ts;
    }

    // simple requestAnimationFrame wrapper
    this.requestAnimationFrame = (function() {
        if (typeof window !== 'undefined') {
          // Browsers
          return  window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    || 
                  window.oRequestAnimationFrame      || 
                  window.msRequestAnimationFrame     || 
                  function( callback ) {
                    setTimeout(callback, 1000 / 60);
                  };
        } else {
          // NodeJS
          return function( callback ) {
            setTimeout(callback, 1000 / 60);
          };
        }
      })();
    this.frame = function(fn) {
      if (ENV_IS_NODE) var window;
      this.requestAnimationFrame.call(window, fn);
    }

    // Convenience functions for querying objects from world
    this.getThingsByTag = function(tag) {
      return this.systems.world.getThingsByTag(tag);
    }
    this.getThingsByType = function(type) {
      return this.systems.world.getThingsByType(type);
    }
    this.getThingByObject = function(obj) {
      return this.systems.world.getThingsByObject(object);
    }
    this.getThingById = function(id) {
      return this.systems.world.getThingById(id);
    }

    this.init();
  });
  elation.extend("engine.systems", function(args) {
    this._engine = args;
    this.active = {};
    elation.events.add(this._engine, "engine_stop", elation.bind(this, this.shutdown));

    this.add = function(names, args) {
      // register and initialize new systems, which will respond to events emitted by the engine
      if (!elation.utils.isArray(names)) {
        names = [names];
      }
      var systems = {};
      var requires = names.map(function(a) { return "engine.systems." + a; });
      elation.require(requires, elation.bind(this, function() {
        for (var i = 0; i < names.length; i++) {
          var name = names[i];
          systems[name] = this[name] = new elation.engine.systems[name](args);
          this[name].attach(this._engine);
        }
        setTimeout(elation.bind(this, function() {
          elation.events.fire({element: this, type: 'engine_systems_added'});
        }), 0);
      }));
      return systems;
    }
    this.get = function(name) {
      return this[name];
    }
    this.shutdown = function() {
      console.log("shut down all the systems!");
    }
  });
  elation.extend("engine.systems.system", function(args) {
    this.engineevents = "engine_start,engine_frame,engine_stop";

    this.attach = function(engine) {
      this.engine = engine;
      elation.events.add(this, "system_attach,system_detach", this);
      elation.events.add(this.engine, this.engineevents, this);
      elation.events.fire({element: this, type: "system_attach"});
    }
    this.detach = function() {
      this.engine = false;
      elation.events.remove(this.engine, this.engineevents, this);
      elation.events.fire({element: this, type: "system_detach"});
    }
    this.handleEvent = function(ev) {
      if (typeof this[ev.type] == 'function') {
        this[ev.type](ev);
      }
    }
  });
  elation.component.add("engine.configuration", function() {
    this.init = function() {
      this.engine = this.args.engine;
      this.view = this.args.view;
      this.create();
      this.addclass('engine_configuration');
    }
    this.create = function() {
        /* Control Settings */
        var controlpanel = elation.engine.systems.controls.config({
          controlsystem: this.engine.systems.controls
        });

        /* Video Settings */
        var videopanel = elation.ui.panel({
          orientation: 'vertical'
        });
        var oculus = elation.ui.toggle({
          label: 'Oculus Rift',
          append: videopanel,
          events: { toggle: elation.bind(this, this.toggleVR) }
        });
        var fullscreen = elation.ui.toggle({
          label: 'Fullscreen',
          append: videopanel,
          events: { toggle: elation.bind(this, this.toggleFullscreen) }
        });
        this.view.scale = 100;
        var scale = elation.ui.slider({
          append: videopanel,
          min: 1,
          max: 200,
          snap: 1,
          handles: [
            {
              name: 'handle_one_scale',
              value: this.view.scale,
              labelprefix: 'View scale:',
              bindvar: [this.view, 'scale']
            }
          ],
          events: { ui_slider_change: elation.bind(this.view.rendersystem, this.view.rendersystem.setdirty) }
        });
        var configtabs = elation.ui.tabbedcontent({
          append: this,
          items: {
            controls: { label: 'Controls', content: controlpanel },
            video: { label: 'Video', content: videopanel },
            audio: { label: 'Audio', disabled: true },
            network: { label: 'Network', disabled: true },
          }
        });
    }
    this.toggleFullscreen = function() {
      var view = this.view;
      if (view) {
        view.toggleFullscreen();
      }
    }
    this.toggleVR = function() {
      var view = this.view;
      if (view) {
        var mode = (view.rendermode == 'default' ? 'oculus' : 'default');
        view.setRenderMode(mode);
      }
    }
    this.calibrateVR = function() {
      if (this.engine.systems.controls) {
        this.engine.systems.controls.calibrateHMDs();
      }
    }
  }, elation.ui.panel);

  elation.component.add('engine.client', function() {

    this.init = function() {
      this.name = this.args.name || 'default';
      this.engine = elation.engine.create(this.name, ["physics", "sound", "ai", "world", "render", "controls"], elation.bind(this, this.startEngine));
    }
    this.initWorld = function() {
      // Virtual stub - inherit from elation.engine.client, then override this for your app
    }
    this.startEngine = function(engine) {
      this.world = this.engine.systems.world; // shortcut

      this.view = elation.engine.systems.render.view("main", elation.html.create({ tag: 'div', append: document.body }), { fullsize: 1, picking: true, engine: this.name, showstats: true } );

      this.initWorld();


      //this.gameobj = this.engine.systems.world.children.vrcade;
      //this.gameobj.setview(this.view);
      //elation.events.add(this.loader, 'ui_loader_finish', elation.bind(this.gameobj, this.gameobj.handleLoaderFinished));

      engine.start();
    }
  });
  
  elation.component.add('engine.server', function() {
    this.init = function() {
      this.name = this.args.name || 'default';
      this.engine = elation.engine.create(this.name, ['physics', 'world', 'server'], elation.bind(this, this.startEngine));
    }
    this.initWorld = function() {
      // Virtual stub - inherit from elation.engine.server, then override this for your app
    }
    this.startEngine = function(engine) {
      this.engine = engine;
      this.world = this.engine.systems.world; // shortcut
      this.initWorld();
      engine.start();
    }
   });
  
});
