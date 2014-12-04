/**
 * The LOD system hooks into events thrown by the render system and the world system
 * to maintain a list of active objects and active views.  If a newly-added object
 * has implemented the thing.updateLOD(camera) function, that function will be called
 * before each view is rendered
 */

elation.extend("engine.systems.lod", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.lodobjects = [];
  this.renderviews = [];

  this.addLODobject = function(thing) {
    // TODO - with lots of LOD objects, we might be better off with a map rather than an array
    var idx = this.lodobjects.indexOf(thing);
    if (idx == -1) {
      this.lodobjects.push(thing);
    }
  }
  this.removeLODobject = function(thing) {
    var idx = this.lodobjects.indexOf(thing);
    if (idx != -1) {
      this.lodobjects.splice(idx, 1);
    }
  }
  this.addRenderView = function(renderview) {
    var idx = this.renderviews.indexOf(renderview);
    if (idx == -1) {
      this.renderviews.push(renderview);
      elation.events.add(renderview, 'render_view_prerender', this);
    }
  }
  this.removeRenderView = function(renderview) {
    var idx = this.renderviews.indexOf(renderview);
    if (idx != -1) {
      this.renderviews.splice(idx, 1);
      elation.events.remove(renderview, 'render_view_prerender', this);
    }
  }

  this.system_attach = function(ev) {
    console.log('INIT: lod');
  }
  this.engine_start = function(ev) {
    elation.events.add(this.engine.systems.render, 'render_view_add', this);
    elation.events.add(this.engine.systems.world, 'world_thing_add', this);
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: lod');
    elation.events.remove(this.engine.systems.render, 'render_view_add', this);
    elation.events.remove(this.engine.systems.world, 'world_thing_add', this);
  }
  
  this.render_view_add = function(ev) {
    this.addRenderView(ev.data);
  }
  this.world_thing_add = function(ev) {
    var thing = ev.data.thing;
    if (thing && typeof thing.updateLOD == 'function') {
      this.addLODobject(thing);
    }
  }
  this.world_thing_remove = function(ev) {
    var thing = ev.data.thing;
    if (thing && typeof thing.updateLOD == 'function') {
      this.removeLODobject(thing);
    }
  }
  this.render_view_prerender = function(ev) {
    var renderview = ev.target;
    var camera = renderview.camera;
    if (camera) {
      for (var i = 0; i < this.lodobjects.length; i++) {
        this.lodobjects[i].updateLOD(camera);
      }
    }
  }
});

