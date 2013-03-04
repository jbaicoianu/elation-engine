elation.extend("engine.systems.render", function(args) {
  elation.implement(this, elation.engine.systems.system);
  this.views = {};

  this.view_init = function(viewname, viewargs) {
    this.views[viewname] = new elation.engine.view(viewargs);
    return this.views[viewname];
  }
  this.view_add = function(viewname, view) {
    this.views[viewname] = view;
    return this.views[viewname];
  }

  this.system_attach = function(ev) {
    console.log('INIT: render');
    this.renderer = new THREE.WebGLRenderer({antialias: false});
    this.renderer.autoClear = false;
  }
  this.system_detach = function(ev) {
    console.log('SHUTDOWN: render');
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: render');
    this.renderer.clear();
    for (var k in this.views) {
      this.views[k].render(ev.data.delta);
    }
  }
});
