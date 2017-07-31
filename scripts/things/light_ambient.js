elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_ambient', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0xffffff, set: this.updateLight },
      });
    }
    this.createObject3D = function() {
      this.lightobj = new THREE.AmbientLight(this.properties.color);
      return this.lightobj;
    }
    this.updateLight = function() {
      if (this.lightobj) {
        this.lightobj.color.copy(this.color);
      }
    }
  }, elation.engine.things.light);
});
