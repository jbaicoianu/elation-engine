elation.require(["engine.things.generic", "engine.assets"], function() {
  elation.component.add("engine.things.label", function() {
    this.postinit = function() {
      this.defineProperties({
        'text':            { type: 'string', refreshGeometry: true },
        'font':            { type: 'string', default: 'helvetiker', refreshGeometry: true },
        'size':            { type: 'float', default: 1.0, refreshGeometry: true },
        'color':           { type: 'color', default: 0xcccccc, refreshGeometry: true },
        'align':           { type: 'string', default: 'left', refreshGeometry: true },
        'verticalalign':   { type: 'string', default: 'bottom', refreshGeometry: true },
        'zalign':          { type: 'string', default: 'back', refreshGeometry: true },
        'emissive':        { type: 'color', default: 0x000000 },
        'opacity':         { type: 'float', default: 1.0 },
        'depthTest':       { type: 'bool', default: true },
        'thickness':       { type: 'float', refreshGeometry: true },
        'segments':        { type: 'int', default: 6, refreshGeometry: true },
        'bevel.enabled':   { type: 'bool', default: false, refreshGeometry: true },
        'bevel.thickness': { type: 'float', default: 0, refreshGeometry: true },
        'bevel.size':      { type: 'float', default: 0, refreshGeometry: true },
      });
    }
    this.createObject3D = function() {
      var text = this.properties.text || this.name;
      var geometry = this.createTextGeometry(text);
      this.material = this.createTextMaterial();

      var mesh = new THREE.Mesh(geometry, this.material);
      
      return mesh;
    }
    this.createTextMaterial = function() {
      var material = new THREE.MeshPhongMaterial({color: this.properties.color, emissive: this.properties.emissive, shading: THREE.SmoothShading, depthTest: this.properties.depthTest});

      if (this.properties.opacity < 1.0) {
        material.opacity = this.properties.opacity;
        material.transparent = true;
      }
      return material;
    }
    this.createTextGeometry = function(text) {
      var font = elation.engine.assets.find('font', this.properties.font);
      if (!font) font = elation.engine.assets.find('font', 'helvetiker');

      var geometry = new THREE.TextGeometry( text, {
        size: this.properties.size,
        height: this.properties.thickness || this.properties.size / 2,
        curveSegments: this.properties.segments,

        font: font,
        weight: "normal",
        style: "normal",

        bevelThickness: this.properties.bevel.thickness,
        bevelSize: this.properties.bevel.size,
        bevelEnabled: this.properties.bevel.enabled
      });                                                
      geometry.computeBoundingBox();
      var bbox = geometry.boundingBox;
      var diff = new THREE.Vector3().subVectors(bbox.max, bbox.min);
      var geomod = new THREE.Matrix4();
      // horizontal alignment
      if (this.properties.align == 'center') {
        geomod.makeTranslation(-.5 * diff.x, 0, 0);
        geometry.applyMatrix(geomod);
      } else if (this.properties.align == 'right') {
        geomod.makeTranslation(-1 * diff.x, 0, 0);
        geometry.applyMatrix(geomod);
      }

      // vertical alignment
      if (this.properties.verticalalign == 'middle') {
        geomod.makeTranslation(0, -.5 * diff.y, 0);
        geometry.applyMatrix(geomod);
      } else if (this.properties.verticalalign == 'top') {
        geomod.makeTranslation(0, -1 * diff.y, 0);
        geometry.applyMatrix(geomod);
      }

      // z-alignment
      if (this.properties.zalign == 'middle') {
        geomod.makeTranslation(0, 0, -.5 * diff.z);
        geometry.applyMatrix(geomod);
      } else if (this.properties.zalign == 'front') {
        geomod.makeTranslation(0, 0, -1 * diff.z);
        geometry.applyMatrix(geomod);
      }
      geometry.computeBoundingBox();
      return geometry;
    }
    this.setText = function(text) {
      this.properties.text = text;
      if (text.indexOf && text.indexOf('\n') != -1) {
        this.setMultilineText(text);
      } else {
        this.objects['3d'].geometry = this.createTextGeometry(text);
      }
      this.objects['3d'].material = this.material = this.createTextMaterial(text);
      this.refresh();
   }
   this.setMultilineText = function(text) {
      var lines = text.split('\n');
      var geometry = new THREE.Geometry();
      var linematrix = new THREE.Matrix4();
      var lineoffset = 0;
      var lineheight = 0;
      for (var i = 0; i < lines.length; i++) {
        var linegeometry = this.createTextGeometry(lines[i]);
        linematrix.makeTranslation(0, lineoffset, 0);
        geometry.merge(linegeometry, linematrix);
        if (!lineheight) {
          var bboxdiff = new THREE.Vector3().subVectors(linegeometry.boundingBox.max, linegeometry.boundingBox.min);
          lineheight = bboxdiff.y;
        }
        lineoffset -= lineheight * 1.2;
      }
      this.objects['3d'].geometry = geometry;
    }
    this.setColor = function(color) {
      this.material.color.setHex(color);
      this.refresh();
    }
    this.setEmissionColor = function(color) {
      this.material.emissive.setHex(color);
      this.refresh();
    }
  }, elation.engine.things.generic);
});
