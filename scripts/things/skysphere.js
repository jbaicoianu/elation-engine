elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.skysphere', function() {
    this.postinit = function() {
      this.defineProperties({
        skytexture: { type: 'texture' },
        color: { type: 'int', default: 0xffffff }
      });
    }
    this.createObject3D = function() {
      var geo = new THREE.SphereGeometry(1000, 64, 32);

      // Flip UVs on x axis so that the texture isn't reversed when viewed from inside the sphere
      for (var i = 0; i < geo.attributes.uv.length; i += 2) {
        geo.attributes.uv.array[i] = 1 - geo.attributes.uv.array[i];
      }
      var mat = new THREE.MeshBasicMaterial({color: this.properties.color, side: THREE.DoubleSide, map: this.properties.skytexture});
      var mesh = new THREE.Mesh(geo, mat);
      return mesh;
    }
  }, elation.engine.things.generic);
});
