elation.component.add('engine.things.light', function() {
  this.postinit = function() {
    this.defineProperties({
      'type':              { type: 'string', default: 'point' },
      'color':             { type: 'color', default: 0xffffff },
      'intensity':         { type: 'float', default: 1.0 },
      'radius':            { type: 'float', default: 10000.0 },
    });
  }
  this.createObject3D = function() {
    var light;
    switch (this.properties.type) {
      case 'point':
        this.lightobj = new THREE.PointLight(this.properties.color, this.properties.intensity, this.properties.radius);
        //var helper = new THREE.PointLightHelper(this.lightobj, this.properties.intensity);
        //this.lightobj.add(helper);
        this.lightobj.castShadow = false;
        break;
      case 'spot':
        this.lightobj = new THREE.SpotLight(this.properties.color, this.properties.intensity, this.properties.radius);
        this.initShadowmap(this.lightobj);

        var helper = new THREE.SpotLightHelper(this.lightobj, this.properties.intensity);
        this.lightobj.add(helper);
        break;
      case 'directional':
        this.lightobj = new THREE.DirectionalLight(this.properties.color, this.properties.intensity);
        this.initShadowmap(this.lightobj);

        var helper = new THREE.DirectionalLightHelper(this.lightobj, this.properties.intensity);
        this.lightobj.add(helper);
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
    light.shadowCameraNear = 200;
    light.shadowCameraFar = 750;
    light.shadowCameraFov = 50;
    light.shadowCameraVisible = false;
    light.shadowMapWidth = 4096;
    light.shadowMapHeight = 4096;
  }
}, elation.engine.things.generic);
