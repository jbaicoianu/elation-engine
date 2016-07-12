elation.require(['engine.things.light'], function() {
  elation.component.add('engine.things.light_directional', function() {
    this.postinit = function() {
      this.defineProperties({
        'color':             { type: 'color', default: 0xffffff },
        'intensity':         { type: 'float', default: 1.0 },
        'target':            { type: 'object' },
      });
    }
    this.createObject3D = function() {
      this.lightobj = new THREE.DirectionalLight(this.properties.color, this.properties.intensity);
      if (this.properties.target) {
        this.lightobj.target = this.properties.target.objects['3d'];
      }
      //this.initShadowmap(this.lightobj);

      var helper = new THREE.DirectionalLightHelper(this.lightobj, this.properties.intensity);

      var obj = this.lightobj || new THREE.Object3D();
      if (this.properties.render.mesh) {
        obj = this.properties.render.mesh;
        obj.add(this.lightobj);
      }
      return obj;
    }
  }, elation.engine.things.light);
});
