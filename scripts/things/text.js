elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.text', function() {
    this.postinit = function() {
      this.defineProperties({
        'text': { type: 'string', default: '' },
        'width': { type: 'float', default: 1.0 },
        'height': { type: 'float', default: .25 },
        'background': { type: 'color', default: 0x000000 },
        'color': { type: 'color', default: '#ccc' },
        'font': { type: 'string', default: 'serif' },
        'fontsize': { type: 'integer', default: 64 }
      });
    }
    this.createObject3D = function() {
      var geo = new THREE.PlaneBufferGeometry(this.properties.width, this.properties.height);
      var tex = elation.engine.materials.getTextureLabel(this.properties.text, this.properties.fontsize, this.properties.color, this.properties.font);
      var mat = new THREE.MeshBasicMaterial({map: tex, transparent: true});
      return new THREE.Mesh(geo, mat);
    }
  }, elation.engine.things.plane);
})
