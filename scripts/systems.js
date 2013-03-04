elation.extend("engine.systems", function(args) {
  this.engine = args;
  this.active = {};
  elation.events.add(this.engine, "engine_stop", elation.bind(this, this.shutdown));

  this.add = function(name, args) {
    // register and initialize a new system, which will respond to events emitted by the engine
    if (typeof elation.engine.systems[name] == 'function') {
      this.active[name] = new elation.engine.systems[name](args);
      this.active[name].attach(this.engine);
    }
    return this.active[name];
  }
  this.get = function(name) {
    return this.active[name];
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
