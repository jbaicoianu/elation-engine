elation.require([
    'utils.events',
    'utils.worker',
    //'engine.engine',
    'engine.assets',
    'engine.external.pako',
    'engine.external.zlib.inflate',
    'engine.external.xmldom',
    'engine.external.three.three', 'engine.external.three.three-loaders',
  ], function() {

  elation.define('engine.assetworker', {
    _construct: function() {
      var srcmap = {};
      // Compatibility for ColladaLoader
      Image = function(src) { this.src = src; };
      Image.prototype.toDataURL = function() { return this.src; }

      THREE.Cache.enabled = true;
      THREE.ImageLoader.prototype.load = function ( url, onLoad, onProgress, onError ) {

        if ( this.path !== undefined ) url = this.path + url;

        var scope = this;

        var uuid = srcmap[url];
        if (!uuid) {
          srcmap[url] = uuid = THREE.Math.generateUUID();
        }
        var img = { uuid: uuid, src: url, toDataURL: function() { return url; } };
        scope.manager.itemStart( url );
        if ( onLoad ) {
          onLoad( img );
        }
        scope.manager.itemEnd( url );

        return img;
      }
      this.loader = new elation.engine.assets.loaders.model();
      elation.engine.assets.init(true);
    },
    onmessage: function(ev) {
      var msg = ev.data;
      if (msg.type == 'job') {
        if (msg.data) {
          this.loader.load(msg.data);
        }
      } else if (msg.type == 'setcorsproxy') {
        elation.engine.assets.setCORSProxy(msg.data);
      }
    }
  }, elation.worker.base);

  elation.define('engine.assets.loaders.model', {
    _construct: function(args) {
      elation.class.call(this, args);
      this.parsers = {
        'collada': new elation.engine.assets.loaders.model_collada(),
        'obj': new elation.engine.assets.loaders.model_obj(),
        'fbx': new elation.engine.assets.loaders.model_fbx(),
        'ply': new elation.engine.assets.loaders.model_ply(),
        'wrl': new elation.engine.assets.loaders.model_wrl(),
        'gltf': new elation.engine.assets.loaders.model_gltf(),
        'glb': new elation.engine.assets.loaders.model_gltf(),
        'bvh': new elation.engine.assets.loaders.model_bvh(),
      }
    },
    getFullURL: function(src) {
      var corsproxy = elation.engine.assets.corsproxy || '';
      var baseurl = src.substr( 0, src.lastIndexOf( "/" ) + 1 ) 
      var fullurl = src;
      if (src.match(/^(https?:)?\/\//) && !src.match(/^(https?:)?\/\/localhost/) && fullurl.substr(0,corsproxy.length) != corsproxy) {
        fullurl = corsproxy + fullurl;
      }
      return fullurl;
    },
    load: function(job) {
      if (job.data.srcdata) {
        this.onload(job, job.data.srcdata);
      } else if (job.data.src) {
        var fullurl = this.getFullURL(job.data.src);
        elation.net.get(fullurl, null, {
          responseType: 'arraybuffer',
          callback: elation.bind(this, this.onload, job),
          onprogress: elation.bind(this, this.onprogress, job),
          onerror: elation.bind(this, this.onerror, job),
          headers: {
            'X-Requested-With': 'Elation Engine asset loader'
          }
        });
      }
    },
    contentIsGzipped: function(databuf) {
      var c1 = databuf[0], c2 = databuf[1];
      if (c1 == 0x1f && c2 == 0x8b) {
        return true;
      }
      return false;
    },
    detectContentType: function(content) {
      //content = foo;
      var tests = [
        ['collada', '<COLLADA'],
        ['fbx', 'FBXHeader'],
        ['obj', '\nv '],
        ['obj', '\nvn '],
        ['obj', '\nusemtl '],
        ['ply', 'ply'],
        ['bvh', 'HIERARCHY\n'],
        ['wrl', '#VRML'],
        ['gltf', '{'],
        ['glb', 'glTF']
      ];

      var type = false;
      var headerLengthLimit = 8192;
      var data = new Uint8Array(content);
      var maxlength = Math.min(data.length, headerLengthLimit);

      // To detect file type, we start at the beginning and scan through char by char.  If we find a char that matches the first char
      // of one of our tests, then we start looking ahead to see if the rest of the line matches.  We return true on the first match

      var uppercache = {},
          lowercache = {};
      for (var i = 0; i < tests.length; i++) {
        var test = tests[i];
        uppercache[i] = test[1].toUpperCase();
        lowercache[i] = test[1].toLowerCase();
      }

      for (var i = 0; i < maxlength; i++) { 
        var cbyte = data[i];
        for (var k = 0; k < tests.length; k++) {
          var t = tests[k];
          var upper = uppercache[k],
              lower = lowercache[k];
          var len = maxlength - upper.length;

          if (cbyte == upper.charCodeAt(0) || 
              cbyte == lower.charCodeAt(0)) {
            var match = true;
            for (var j = 1; j < upper.length && match; j++) {
              var chr = data[i + j],
                  u = upper.charCodeAt(j),
                  l = lower.charCodeAt(j);
              match = match && (u == chr || l == chr);
            }
            if (match) {
              return t[0];
            }
          }
        }
      };
      return false;
    },
    parse: function(data, job) {
      var type = this.detectContentType(data);
      if (this.parsers[type]) {
        return this.parsers[type].parse(data, job); 
      }
      return new Promise(function(resolve, reject) { 
        resolve(false); 
      });
    },
    onload: function(job, rawdata, xhr) {
      var databuf = new Uint8Array(rawdata),
          modeldata = false;

      if (this.contentIsGzipped(databuf)) {
        var bytes = window.pako.inflate(databuf, {to: 'arraybuffer'});
        modeldata = bytes.buffer;
      } else {
        // Pass the binary data through to be handled per-modeltype
        modeldata = rawdata;
      }    
      if (modeldata) {
        this.parse(modeldata, job).then(function(data) {
          var transferrables = [];
          // Convert BufferGeometry arrays back to Float32Arrays so they can be transferred efficiently
          try {
            if (data.geometries) {
              for (var i = 0; i < data.geometries.length; i++) {
                var geo = data.geometries[i];
                for (var k in geo.data.attributes) {
                  //var arr = Float32Array.from(geo.data.attributes[k].array);
                  var src = geo.data.attributes[k].array;
                  var arr = new Float32Array(src.length);
                  for (var j = 0; j < src.length; j++) {
                    arr[j] = src[j];
                  }
                  transferrables.push(arr.buffer);
                  geo.data.attributes[k].array = arr;
                }
              }
            }
            postMessage({message: 'finished', id: job.id, data: data}, transferrables);
          } catch (e) {
            postMessage({message: 'error', id: job.id, data: e.toString()});
          }
        }, function(d) {
          postMessage({message: 'error', id: job.id, data: d.toString()});
        });
      } else {
        postMessage({message: 'error', id: job.id, data: 'no modeldata found'});
      }
    },
    onprogress: function(job, ev) {
      //console.log('progress', job, ev);
    },
    onerror: function(job, ev) {
      console.log('error', job, ev);
      postMessage({message: 'error', id: job.id, data: 'unknown error'});
    },
    convertArrayBufferToString: function(rawdata) {
      var converted = '';

      if (typeof TextDecoder != 'undefined') {
        return new TextDecoder().decode(rawdata);
      }

      var bufview = new Uint8Array(rawdata);
      var l = bufview.length;
      var str = '';
      for (var i = 0; i < l; i++) {
        str += String.fromCharCode(bufview[i]);
      }

      // convert binary data to string encoding
      try {
        converted = decodeURIComponent(escape(str));
      } catch (e) {
        converted = str;
      }
      return converted;
    }
  });
  elation.define('engine.assets.loaders.model_obj', {
    convertArrayBufferToString: elation.engine.assets.loaders.model.prototype.convertArrayBufferToString,
    parse: function(bindata, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        var mtl = job.data.mtl || false;

        var baseurl = job.data.src.substr( 0, job.data.src.lastIndexOf( "/" ) + 1 ) 

        var data = this.convertArrayBufferToString(bindata);

        if (!mtl) {
          var re = /^mtllib (.*)$/im;
          var m = data.match(re);
          if (m) {
            mtl = m[1];
          }
        }

        //var loader = (mtl ? new THREE.OBJMTLLoader() : new THREE.OBJLoader());
        var loader = new THREE.OBJLoader();
        var modeldata = false;

        if (mtl) {
          var createMaterials = elation.bind(this, function ( materials ) {
                materials.preload();
                loader.setMaterials(materials);
                //loader.setPath(mtlLoader.path);
                modeldata = loader.parse(data);
                resolve(this.convertToJSON(modeldata));
              }),

          mtl = this.getFullURL(mtl, baseurl); 
          if (elation.engine.assets.corsproxy && mtl.indexOf(elation.engine.assets.corsproxy) != 0) {
            mtl = elation.engine.assets.corsproxy + mtl;
          }
          var mtlpath = mtl.substr( 0, mtl.lastIndexOf( "/" ) + 1 );
          var mtlfile = mtl.substr(mtl.lastIndexOf( "/" ) + 1);

          var mtlLoader = new THREE.MTLLoader( );
          mtlLoader.setPath( mtlpath );
          mtlLoader.setResourcePath( mtlpath );
          mtlLoader.setCrossOrigin( 'anonymous' );
          if (job.data.mtldata) {
            var mtldata = this.convertArrayBufferToString(job.data.mtldata);
            var materials = mtlLoader.parse(mtldata);
            createMaterials(materials);        
          } else {
            mtlLoader.load( mtlfile, 
              createMaterials,
              function(ev) {
                //console.log('progress?', ev);
              },
              elation.bind(this, function(ev) {
                // MTL failed to load, just parse the geometry and return it
                modeldata = loader.parse(data);
                resolve(this.convertToJSON(modeldata));
              })
            );
          }
        } else {
          modeldata = loader.parse(data);
          resolve(this.convertToJSON(modeldata));
        }
        return modeldata;
      }));
    },
    convertToJSON: function(scene) {
      var json;
      if (scene) {
        // Convert Geometries to BufferGeometries
        scene.traverse(function(n) {
          if (n.geometry && n.geometry instanceof THREE.Geometry) {
            var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
            n.geometry = bufgeo;
          }
        });
        json = scene.toJSON();
      }
      return json;

    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_collada', {
    convertArrayBufferToString: elation.engine.assets.loaders.model.prototype.convertArrayBufferToString,

    parser: new DOMParser(),

    parse: function(bindata, job) {
      return new Promise(elation.bind(this, function(resolve, reject) {
        try {
          var data = false;
          var baseurl = job.data.src.substr( 0, job.data.src.lastIndexOf( "/" ) + 1 ) 
          var loader = new THREE.ColladaLoader();
          var corsproxy = elation.engine.assets.corsproxy || '';
          loader.setResourcePath(corsproxy + baseurl);
          loader.options.upAxis = 'Y';
          var xml = this.convertArrayBufferToString(bindata);
          var parsed = loader.parse(xml);
          var imageids = Object.keys(parsed.library.images);
          for (var i = 0; i < imageids.length; i++) {
            var img = parsed.library.images[imageids[i]].build;
            img.src = this.getProxiedURL(img.src, baseurl);
          }
          parsed.scene.traverse(function(n) {
            if ((n.geometry instanceof THREE.BufferGeometry && !n.geometry.attributes.normals) ||
                (n.geometry instanceof THREE.Geometry && !n.geometry.faceVertexNormals)) {
              n.geometry.computeFaceNormals();
              n.geometry.computeVertexNormals();
            }
            // Convert to BufferGeometry for better loading efficiency
            if (n.geometry && n.geometry instanceof THREE.Geometry) {
              n.geometry.mergeVertices();
              var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
              n.geometry = bufgeo;
            } else if (n.geometry && n.geometry instanceof THREE.BufferGeometry) {
/*
              var geo = new THREE.Geometry().fromBufferGeometry(n.geometry);
              geo.mergeVertices();
              geo.computeVertexNormals();
              n.geometry = new THREE.BufferGeometry().fromGeometry(geo);
*/
            }
          });
          data = parsed;        

          data.scene.rotation.z = 0;
          data.scene.updateMatrix();
          resolve(data.scene.toJSON());
        } catch (e) {
          console.error(e);
          reject(e);
        }
      }));
    },
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_wrl', {
    convertArrayBufferToString: elation.engine.assets.loaders.model.prototype.convertArrayBufferToString,
    parse: function(bindata, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        var loader = new THREE.VRMLLoader();
        var data = this.convertArrayBufferToString(bindata);
        var modeldata = loader.parse(data);

        modeldata.traverse(function(n) {
          if (n.geometry && n.geometry instanceof THREE.Geometry) {
            var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
            n.geometry = bufgeo;
          }
        });

        resolve(modeldata.toJSON());
      }));
    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_fbx', {
    parse: function(data, job) {
      return new Promise(function(resolve, reject) { 
        var loader = new THREE.FBXLoader();
        var modeldata = loader.parse(data);
        resolve(modeldata.toJSON());
      });
    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_gltf', {
    convertArrayBufferToString: elation.engine.assets.loaders.model.prototype.convertArrayBufferToString,

    parse: function(bindata, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        //var data = this.convertArrayBufferToString(bindata);
        //var json = JSON.parse(data);
        var path = THREE.LoaderUtils.extractUrlBase( job.data.src );
        var proxypath = elation.engine.assets.corsproxy + path;
        //THREE.GLTFLoader.Shaders.removeAll();
        var loader = new THREE.GLTFLoader();
        loader.parse(bindata, proxypath, elation.bind(this, function(modeldata) {
          if (modeldata.scene) {
            modeldata.scene.updateMatrixWorld(true);
            var encoded = modeldata.scene.toJSON();

            // FIXME - the glTF loader we're using wants our textures unflipped, but doesn't set that flag - so we set it here
            if (encoded.textures) {
              for (var i = 0; i < encoded.textures.length; i++) {
                encoded.textures[i].flipY = false;
              }
            }
            resolve(encoded);
          } else {
            reject();
          }
        }), proxypath);
      }));
    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_ply', {
    parse: function(data, job) {
      return new Promise(function(resolve, reject) { 
        var path = THREE.LoaderUtils.extractUrlBase( job.data.src );
        var proxypath = elation.engine.assets.corsproxy + path;

        var loader = new THREE.PLYLoader();
        loader.setPropertyNameMapping({
          diffuse_red: 'red',
          diffuse_green: 'green',
          diffuse_blue: 'blue'
        });

        var geometry = loader.parse(data);
        var encoded = false;

        if (!geometry.index || geometry.index.count == 0) {
          // No face data, render as point cloud
          geometry.index = null;
          var points = new THREE.Points(geometry, new THREE.PointsMaterial({
            color: 0xffffff, 
            size: 0.02, 
            sizeAttenuation: true, 
            vertexColors: (geometry.attributes.color && geometry.attributes.color.length > 0 ? THREE.VertexColors : THREE.NoColors)
          }));
          encoded = points.toJSON();
        } else {
          // Has face data, render as mesh.  Compute normals if necessary
          if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
          }
          var mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial());
          encoded = mesh.toJSON();
        }
        resolve(encoded);

        //reject();
      });
    },

  }, elation.engine.assets.base);

  elation.define('engine.assets.loaders.model_bvh', {
    convertArrayBufferToString: elation.engine.assets.loaders.model.prototype.convertArrayBufferToString,
    parse: function(data, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        var loader = new THREE.BVHLoader();
        var modeldata = loader.parse(this.convertArrayBufferToString(data));
        var group = new THREE.Group();
        group.skeleton = modeldata.skeleton;
        group.animations = modeldata.animations;
        resolve(group.toJSON());
      }));
    }
  }, elation.engine.assets.base);

});

