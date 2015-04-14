
elation.require(['engine.things.generic'], function() {
  
elation.component.add('engine.things.remoteplayer', function() {
  this.createObject3D = function() {
    // var geo = new THREE.SphereGeometry(1);
    var geo = new THREE.BoxGeometry(1, 1, 1);
    var mat = new THREE.MeshPhongMaterial({color: 0x00ff00});
    return new THREE.Mesh(geo, mat);
  }  
}, elation.engine.things.generic);

});
