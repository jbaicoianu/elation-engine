elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_point', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0xffffff },
        'intensity':         { type: 'float', default: 1.0 },
        'radius':            { type: 'float', default: 10000.0 },
      });
    }
    this.createObject3D = function() {
      this.lightobj = new THREE.PointLight(this.properties.color, this.properties.intensity, this.properties.radius);
      var helper = new THREE.PointLightHelper(this.lightobj, this.properties.intensity);
      //this.lightobj.add(helper);
      this.lightobj.castShadow = false;

      var obj = this.lightobj || new THREE.Object3D();
      if (this.properties.render.mesh) {
        obj = this.properties.render.mesh;
        obj.add(this.lightobj);
      }
      return obj;
    }
  }, elation.engine.things.light);
});

