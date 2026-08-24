elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_ambient', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0x444444, set: this.updateLight },
      });
    }
    this.createObject3D = function() {
      // x PI bridges the r165 removal of legacy (non-physical) light mode
      this.lightobj = new THREE.AmbientLight(this.properties.color, Math.PI);
      return this.lightobj;
    }
    this.updateLight = function() {
      if (this.lightobj) {
        //this.lightobj.color.copy(this.color);
      }
    }
  }, elation.engine.things.light);
});
