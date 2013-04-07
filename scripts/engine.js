elation.extend("engine", {
  instances: {}
});
elation.extend("engine.loop", function(name) {
  this.started = false;
  this.running = false;
  this.name = name;

  this.init = function() {
    elation.engine.instances[this.name] = this;
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
      this.frame(elation.bind(this, this.run));
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
