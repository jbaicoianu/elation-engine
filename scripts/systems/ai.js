elation.require("engine.things.controller");

elation.extend("engine.systems.ai", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.thinkers = [];
  this.lastthink = 0;
  this.thinktime = 1000/20;

  this.system_attach = function(ev) {
    console.log('INIT: ai');
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: ai', this.thinkers);

    for (var i = 0; i < this.thinkers.length; i++) {
      if (ev.data.ts > this.thinkers[i].lastthink + this.thinkers[i].thinktime) {
        try {
          elation.events.fire({type: 'thing_think', element: this.thinkers[i], data: ev.data});
          this.thinkers[i].lastthink = ev.data.ts;
        } catch (e) {
          console.log(e.stack);
        }
      }
    }
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: ai');
  }
  this.add = function(thing) {
    if (this.thinkers.indexOf(thing) == -1) {
      this.thinkers.push(thing);
    }
  }
});
