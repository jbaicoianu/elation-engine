elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_spot', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0xffffff },
        'intensity':         { type: 'float', default: 1.0 },
        'radius':            { type: 'float', default: 10000.0 },
        'target':            { type: 'object' },
        'angle':             { type: 'float', default: Math.PI/3 },
        'exponent':          { type: 'float', default: 40 },
      });
    }
    this.createObject3D = function() {
      this.lightobj = new THREE.SpotLight(this.properties.color, this.properties.intensity, this.properties.radius, this.properties.angle);
      //this.initShadowmap(this.lightobj);
      if (this.properties.target) {
        this.lightobj.target = this.properties.target.objects['3d'];
      }
      this.lightobj.exponent = this.properties.exponent;

      var helper = new THREE.SpotLightHelper(this.lightobj, this.properties.intensity);

      var obj = this.lightobj || new THREE.Object3D();
      if (this.properties.render.mesh) {
        obj = this.properties.render.mesh;
        obj.add(this.lightobj);
      }
      return obj;
    }
  }, elation.engine.things.light);
});
