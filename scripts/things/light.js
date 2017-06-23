elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.light', function() {
    this.postinit = function() {
      this.defineProperties({
        'type':              { type: 'string', default: 'point' },
        'color':             { type: 'color', default: 0xffffff },
        'intensity':         { type: 'float', default: 1.0 },
        'radius':            { type: 'float', default: 10000.0 },
        'target':            { type: 'object' },
        'angle':             { type: 'float', default: Math.PI/3 },
        'exponent':          { type: 'float', default: 40 },
      });

    }
    this.createObject3D = function() {
      var light;
      switch (this.properties.type) {
        case 'point':
          this.lightobj = new THREE.PointLight(this.properties.color, this.properties.intensity, this.properties.radius);
          var helper = new THREE.PointLightHelper(this.lightobj, this.properties.intensity);
          //this.lightobj.add(helper);
          //this.lightobj.castShadow = false;
          break;
        case 'spot':
          this.lightobj = new THREE.SpotLight(this.properties.color, this.properties.intensity, this.properties.radius, this.properties.angle);
          //this.initShadowmap(this.lightobj);
          if (this.properties.target) {
            this.lightobj.target = this.properties.target.objects['3d'];
          }
          this.lightobj.exponent = this.properties.exponent;

          var helper = new THREE.SpotLightHelper(this.lightobj, this.properties.intensity);
          //this.lightobj.add(helper);
          break;
        case 'directional':
          this.lightobj = new THREE.DirectionalLight(this.properties.color, this.properties.intensity);
          this.lightobj.shadow.camera.visible = false;
          //this.initShadowmap(this.lightobj);

          var helper = new THREE.DirectionalLightHelper(this.lightobj, this.properties.intensity);
          //this.lightobj.add(helper);
          break;
        case 'ambient':
          this.lightobj = new THREE.AmbientLight(this.properties.color);
          break;
      } 

      var obj = this.lightobj || new THREE.Object3D();
      if (this.properties.render.mesh) {
        obj = this.properties.render.mesh;
        obj.add(this.lightobj);
      }
      return obj;
    }
    this.setHex = function(color) {
      this.lightobj.color.setHex(color);
    }
    this.initShadowmap = function(light) {
      light.castShadow = true;
      light.shadow.camera.near = 40;
      light.shadow.camera.far = 120;
      light.shadow.camera.fov = 50;

      var d = 60;
      light.shadow.camera.left = -d;
      light.shadow.camera.right = d;
      light.shadow.camera.top = d;
      light.shadow.camera.bottom = -d;

      light.shadow.bias = 2.0e-3;

      /*
      light.shadow.cascade = false;
      light.shadow.cascadeCount = 3;

      light.shadow.cascadeNearZ = [  0.1, 10.0, 100.0];
      light.shadow.cascadeFarZ  = [ 10.0, 100.0, 1000.0 ];
      light.shadow.cascadeWidth = [ 2048, 2048, 2048 ];
      light.shadow.cascadeHeight = [ 2048, 2048, 2048 ];
      light.shadow.cascadeBias = [ 0.00005, 0.000065, 0.000065 ];

      //light.shadowCascadeOffset.set( 0, 0, -10 );
      */

      light.shadow.mapSize.width = 2048;
      light.shadow.mapSize.height = 2048;
    }
  }, elation.engine.things.generic);
});
