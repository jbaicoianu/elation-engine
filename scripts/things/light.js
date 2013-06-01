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
    var obj;
    switch (this.properties.type) {
      case 'point':
        obj = new THREE.PointLight(this.properties.color, this.properties.intensity, this.properties.radius);
        var helper = new THREE.PointLightHelper(obj, 1);
        obj.add(helper);
        break;
      case 'ambient':
        obj = new THREE.AmbientLight(this.properties.color);
        break;
      default:
        obj = new THREE.Object3D();
    } 
    return obj;
  }
}, elation.engine.things.generic);
