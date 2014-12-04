elation.require(["engine.things.generic"], function() {
  elation.component.add("engine.things.label", function() {
    this.postinit = function() {
      this.defineProperties({
        'text':            { type: 'string' },
        'font':            { type: 'string', default: 'helvetiker' },
        'size':            { type: 'float', default: 1.0 },
        'color':           { type: 'color', default: 0xcccccc },
        'opacity':         { type: 'float', default: 1.0 },
        'depthTest':       { type: 'bool', default: true },
        'thickness':       { type: 'float' },
        'segments':        { type: 'int', default: 6 },
        'bevel.enabled':   { type: 'bool', default: false },
        'bevel.thickness': { type: 'float', default: 0 },
        'bevel.size':      { type: 'float', default: 0 },
      });
    }
    this.createObject3D = function() {
      var text = this.properties.text || this.name;
      var geometry = new THREE.TextGeometry( text, {
        size: this.properties.size,
        height: this.properties.thickness || this.properties.size / 2,
        curveSegments: this.properties.segments,

        font: this.properties.font,
        weight: "normal",
        style: "normal",

        bevelThickness: this.properties.bevel.thickness,
        bevelSize: this.properties.bevel.size,
        bevelEnabled: this.properties.bevel.enabled
      });                                                
      geometry.computeBoundingBox();
      var bbox = geometry.boundingBox;
      var diff = new THREE.Vector3().subVectors(bbox.max, bbox.min).multiplyScalar(-.5);
      var geomod = new THREE.Matrix4();
      geomod.setPosition(diff);
      geometry.applyMatrix(geomod);
      this.material = new THREE.MeshPhongMaterial({color: this.properties.color, shading: THREE.SmoothShading, depthTest: this.properties.depthTest});
      if (this.properties.opacity < 1.0) {
        this.material.opacity = this.properties.opacity;
        this.material.transparent = true;
      }
      var mesh = new THREE.Mesh(geometry, this.material);
      
      return mesh;
    }
  }, elation.engine.things.generic);
});
