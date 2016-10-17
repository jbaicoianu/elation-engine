elation.require(['engine.external.md5'], function() {
  var Identicon = function(string, height, width) {
    if (ENV_IS_NODE) {
      var crypto = require('crypto'),
          hash = crypto.createHash('md5').update(string).digest('hex');
    }
    else {
      var hash   = md5(string)
    }
    
    var  color  = hash.substr(0, 6),
        pixels = [];
  
    for (var i = 0; i < height; i++) {
      pixels.push([]);
      for (var j = 0; j < width; j++) {
        pixels[i][j] = (parseInt(hash.substr((i * 5) + j + 6, 1), 16).toString(10) % 2 === 0) ? 1 : 0;
      }
      var arr = pixels[i];
      pixels[i] = arr.concat(arr.slice(0, arr.length - 1).reverse());
    }
    this.map = pixels;
    this.color = this.hexToRgb(color);
  };
  
  Identicon.prototype.hexToRgb = function(hex) {
    var r = parseInt(hex.substr(0,2), 16),
        g = parseInt(hex.substr(2,2), 16),
        b = parseInt(hex.substr(4,2), 16);
    return "rgb(" + [r,g,b].join(',') + ")";
  }

  elation.component.add('engine.things.maskgenerator', function() {
    this.postinit = function() {
      this.defineProperties({
        'seed'      : { type: 'string', default: '192.168.1.1' },
        'height'    : { type: 'int',    default: 6 },
        'width'     : { type: 'int',    default: 3 },
        'tilesize'  : { type: 'float',  default: 0.5}
      });
      this.pixels = new Identicon(this.properties.seed, this.properties.height, this.properties.width);
    };
  
    this.createObject3D = function() {
      var geometry = new THREE.Geometry(),
          tilesize = this.properties.tilesize,
          box      = new THREE.BoxGeometry(tilesize, tilesize, tilesize),
          mat      = new THREE.MeshLambertMaterial({ color: new THREE.Color(this.pixels.color) }),
          pos      = new THREE.Vector3(0, 0, 0),
          mesh     = new THREE.Mesh(box);
          
      for (var row = 0; row < this.pixels.map.length; row++) {
        for (var col = 0; col < this.pixels.map[row].length; col++) {
          if (this.pixels.map[row][col] == 1) {
            pos.fromArray([col * tilesize, row * tilesize, 0]);
            mesh.position.copy(pos);
            mesh.updateMatrix();
            geometry.merge(mesh.geometry, mesh.matrix);
          }
        }
      }
      geometry.computeBoundingBox();
      var bbox = geometry.boundingBox.min.clone().sub(geometry.boundingBox.max);
      var offset = new THREE.Matrix4().makeTranslation(bbox.x / 2, bbox.y / 2, bbox.z);
      geometry.applyMatrix(offset);
      
      this.material = mat;
      return new THREE.Mesh(geometry, mat);
    };
    this.setOpacity = function(opacity) {
      this.material.opacity = opacity;
      this.material.transparent = (opacity < 1);
    }
  }, elation.engine.things.generic);

});
