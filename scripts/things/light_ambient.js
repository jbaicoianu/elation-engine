elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_ambient', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0xffffff },
      });
    }
    this.createObject3D = function() {
      this.lightobj = new THREE.AmbientLight(this.properties.color);
      return this.lightobj;
    }
  }, elation.engine.things.light);
});
