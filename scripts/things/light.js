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
          this.lightobj.castShadow = false;
          break;
        case 'spot':
          this.lightobj = new THREE.SpotLight(this.properties.color, this.properties.intensity, this.properties.radius, this.properties.angle);
          this.initShadowmap(this.lightobj);
          if (this.properties.target) {
            this.lightobj.target = this.properties.target.objects['3d'];
          }
          this.lightobj.exponent = this.properties.exponent;

          var helper = new THREE.SpotLightHelper(this.lightobj, this.properties.intensity);
          //this.lightobj.add(helper);
          break;
        case 'directional':
          this.lightobj = new THREE.DirectionalLight(this.properties.color, this.properties.intensity);
          this.lightobj.shadowCameraVisible = false;
          this.initShadowmap(this.lightobj);

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
      light.castShadow = false;
      light.shadowCameraNear = 40;
      light.shadowCameraFar = 120;
      light.shadowCameraFov = 50;
      light.shadowCameraVisible = true;

      var d = 60;
      light.shadowCameraLeft = -d;
      light.shadowCameraRight = d;
      light.shadowCameraTop = d;
      light.shadowCameraBottom = -d;

      light.shadowDarkness = 0.6;
      light.shadowBias = 2.0e-3;

      light.shadowCascade = false;
      light.shadowCascadeCount = 3;

      light.shadowCascadeNearZ = [  0.1, 10.0, 100.0];
      light.shadowCascadeFarZ  = [ 10.0, 100.0, 1000.0 ];
      light.shadowCascadeWidth = [ 2048, 2048, 2048 ];
      light.shadowCascadeHeight = [ 2048, 2048, 2048 ];
      light.shadowCascadeBias = [ 0.00005, 0.000065, 0.000065 ];

      //light.shadowCascadeOffset.set( 0, 0, -10 );

      light.shadowMapWidth = 4096;
      light.shadowMapHeight = 4096;
    }
  }, elation.engine.things.generic);
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
      this.lightobj.shadowCameraVisible = false;
      if (this.properties.target) {
        this.lightobj.target = this.properties.target.objects['3d'];
      }
      this.initShadowmap(this.lightobj);

      var helper = new THREE.DirectionalLightHelper(this.lightobj, this.properties.intensity);

      var obj = this.lightobj || new THREE.Object3D();
      if (this.properties.render.mesh) {
        obj = this.properties.render.mesh;
        obj.add(this.lightobj);
      }
      return obj;
    }
  }, elation.engine.things.light);
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
      this.initShadowmap(this.lightobj);
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
