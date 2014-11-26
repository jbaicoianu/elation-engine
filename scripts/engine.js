elation.extend("engine", {
  instances: {},

  create: function(name, systems, callback) {
    var engine = new elation.engine.main(name);
    elation.events.add(engine.systems, 'engine_systems_added', function() { callback(engine); })
    engine.systems.add(systems);
    this.instances[name] = engine;
    return engine;
  }
});
elation.require([
  "engine.external.three.three",
  "engine.parts",
  "engine.materials",
  "engine.things.generic",
  "utils.math"
], function() {
  elation.extend("engine.main", function(name) {
    this.started = false;
    this.running = false;
    this.name = name;

    this.init = function() {
      this.systems = new elation.engine.systems(this);
      // shutdown cleanly if the user leaves the page
      elation.events.add(window, "unload", elation.bind(this, this.stop)); 
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
      this.lastupdate = ts;
    }

    // simple requestAnimationFrame wrapper
    this.requestAnimationFrame = (function() {
        return  window.requestAnimationFrame       || 
                window.webkitRequestAnimationFrame || 
                window.mozRequestAnimationFrame    || 
                window.oRequestAnimationFrame      || 
                window.msRequestAnimationFrame     || 
                function( callback ){
                  window.setTimeout(callback, 1000 / 60);
                };
      })();
    this.frame = function(fn) {
      this.requestAnimationFrame.call(window, fn);
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
        elation.events.fire({element: this, type: 'engine_systems_added'});
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
});
