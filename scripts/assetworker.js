elation.require([
    'utils.events',
    'utils.worker',
    'engine.engine',
    'engine.assets',
    'engine.external.pako',
    'engine.external.three.three', 'engine.external.three.FBXLoader', 'engine.external.three.ColladaLoader', 'engine.external.xmldom',
    'engine.external.three.OBJLoader', 'engine.external.three.MTLLoader', 'engine.external.three.VRMLLoader', 'engine.external.three.GLTFLoader', 'engine.external.three.PLYLoader'
  ], function() {

  elation.define('engine.assetworker', {
    _construct: function() {
      var srcmap = {};
      THREE.Cache.enabled = true;
      THREE.ImageLoader.prototype.load = function ( url, onLoad, onProgress, onError ) {

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
      //console.log('gzip check?', [c1, c2], [0x1f, 0x8b]);
      if (c1 == 0x1f && c2 == 0x8b) {
        return true;
      }
      return false;
    },
    detectContentType: function(content) {
      var foo = '';
      for (var i = 0; i < 500; i++) {
        foo += content[i];
      }
      //content = foo;
      var tests = [
        [/<COLLADA/im, 'collada'],
        [/^\s*v\s+-?[\d\.]+\s+-?[\d\.]+\s+-?[\d\.]+\s*$/im, 'obj'],
        [/FBXHeader/i, 'fbx'],
        [/^ply$/im, 'ply'],
        [/^\#VRML/, 'wrl'],
        [/^\s*{/, 'gltf']
      ];

      var type = false;
      tests.forEach(function(t) {
        if (content.match(t[0])) {
          type = t[1];
        }
      });
      return type;
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
        modeldata = window.pako.inflate(databuf, {to: 'string'});
      } else {
        var dataview = new DataView(rawdata);
        if (false && typeof TextDecoder !== 'undefined') {
          var decoder = new TextDecoder('utf-8');
          modeldata = decoder.decode(dataview);
        } else {
          // FIXME - do we really need to do this?  It should be handled on a per-modeltype basis, at least
          modeldata = this.convertArrayBufferToString(rawdata);
        }
      }    
      if (modeldata) {
        this.parse(modeldata, job).then(function(data) {
          var transferrables = [];
          // Convert BufferGeometry arrays back to Float32Arrays so they can be transferred efficiently
          try {
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
    parse: function(data, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        var mtl = job.data.mtl || false;

        var baseurl = job.data.src.substr( 0, job.data.src.lastIndexOf( "/" ) + 1 ) 
/*
        if (!mtl) {
          var re = /^mtllib (.*)$/im;
          var m = data.match(re);
          if (m) {
            mtl = m[1];
          }
        }
*/
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
    parser: new DOMParser(),

    parse: function(xml, job) {
      return new Promise(elation.bind(this, function(resolve, reject) {
        var docRoot = this.parser.parseFromString(xml);
        var collada = docRoot.getElementsByTagName('COLLADA')[0];
        var data = false;

        // helper functions
        function getChildrenByTagName(node, tag) {
          var tags = [];
          for (var i = 0; i < node.childNodes.length; i++) {
            var childnode = node.childNodes[i];
            if (childnode.tagName == tag) {
              tags.push(childnode);
              childnode.querySelectorAll = querySelectorAll;
              childnode.querySelector = querySelector;
            }
          };
          return tags;
        }
        function querySelectorAll(selector) {
          var sels = selector.split(","),
              run = function(node,selector) {
                  var sel = selector.split(/[ >]+/), com = selector.match(/[ >]+/g) || [], s, c, ret = [node], nodes, l, i, subs, m, j, check, x, w, ok,
                      as;
                  com.unshift(" ");
                  while(s = sel.shift()) {
                      c = com.shift();
                      if( c) c = c.replace(/^ +| +$/g,"");
                      nodes = ret.slice(0);
                      ret = [];
                      l = nodes.length;
                      subs = s.match(/[#.[]?[a-z_-]+(?:='[^']+'|="[^"]+")?]?/gi);
                      m = subs.length;
                      for( i=0; i<l; i++) {
                          if( subs[0].charAt(0) == "#") ret = [document.getElementById(subs[0].substr(1))];
                          else {
                              check = c == ">" ? nodes[i].children : nodes[i].getElementsByTagName("*");
                              if( !check) continue;
                              w = check.length;
                              for( x=0; x<w; x++) {
                                  ok = true;
                                  for( j=0; j<m; j++) {
                                      switch(subs[j].charAt(0)) {
                                      case ".":
                                          if( !check[x].className.match(new RegExp("\\b"+subs[j].substr(1)+"\\b"))) ok = false;
                                          break;
                                      case "[":
                                          as = subs[j].substr(1,subs[j].length-2).split("=");
                                          if( !check[x].getAttribute(as[0])) ok = false;
                                          else if( as[1]) {
                                              as[1] = as[1].replace(/^['"]|['"]$/g,"");
                                              if( check[x].getAttribute(as[0]) != as[1]) ok = false;
                                          }
                                          break;
                                      default:
                                          if( check[x].tagName.toLowerCase() != subs[j].toLowerCase()) ok = false;
                                          break;
                                      }
                                      if( !ok) break;
                                  }
                                  if( ok) ret.push(check[x]);
                              }
                          }
                      }
                  }
                  return ret;
              }, l = sels.length, i, ret = [], tmp, m, j;
          for( i=0; i<l; i++) {
              tmp = run(this,sels[i]);
              m = tmp.length;
              for( j=0; j<m; j++) {
                  ret.push(tmp[j]);
              }
          }
          return ret;

        }
        function querySelector(selector) {
          return this.querySelectorAll(selector)[0];
        }
        var fakeindexOf = function(str) { 
          if (this.textContent) return this.textContent.indexOf(str);
          return -1;
        };
        var fakecharAt = function(num) { 
          if (this.textContent) return this.textContent.charAt(num);
          return '';
        };
        var fakesubstr = function(start, end) {
          if (this.textContent) return this.textContent.substr(start, end);
          return '';
        };
        function fakeQuerySelector(node) {
          node.querySelectorAll = querySelectorAll;
          node.querySelector = querySelector;
          node.indexOf = fakeindexOf;
          node.charAt = fakecharAt;
          node.substr = fakesubstr;

          if (node.childNodes && node.childNodes.length > 0) {
            for (var i = 0; i < node.childNodes.length; i++) {
              fakeQuerySelector(node.childNodes[i]);
            }
          }
        }
        fakeQuerySelector(docRoot);
        var loader = new THREE.ColladaLoader();
        loader.options.convertUpAxis = true;
        loader.options.upAxis = 'Y';
        loader.parse(docRoot, function(parsed) {
          parsed.scene.traverse(function(n) {
            if ((n.geometry instanceof THREE.BufferGeometry && !n.geometry.attributes.normals) ||
                (n.geometry instanceof THREE.Geometry && !n.geometry.faceVertexNormals)) {
              n.geometry.computeFaceNormals();
              n.geometry.computeVertexNormals();
            }
            // Convert to BufferGeometry for better loading efficiency
            if (n.geometry && n.geometry instanceof THREE.Geometry) {
              var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
              n.geometry = bufgeo;
            }
          });
          data = parsed;        
        }, job.data.src);

        data.scene.updateMatrix();
        resolve(data.scene.toJSON());
      }));
    },
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_wrl', {
    parse: function(data, job) {
      return new Promise(function(resolve, reject) { 
        var loader = new THREE.VRMLLoader();
        var modeldata = loader.parse(data);

        modeldata.traverse(function(n) {
          if (n.geometry && n.geometry instanceof THREE.Geometry) {
            var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
            n.geometry = bufgeo;
          }
        });

        resolve(modeldata.toJSON());
      });
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
    parse: function(data, job) {
      return new Promise(function(resolve, reject) { 
        var json = JSON.parse(data);
        var path = THREE.Loader.prototype.extractUrlBase( job.data.src );
        var proxypath = elation.engine.assets.corsproxy + path;
        console.log('gltf pass!', path, proxypath);

        THREE.GLTFLoader.Shaders.removeAll();
        var loader = new THREE.GLTFLoader();
        loader.parse(json, elation.bind(this, function(modeldata) {
          if (modeldata.scene) {
            var encoded = modeldata.scene.toJSON();
            resolve(encoded);
          } else {
            reject();
          }
        }), proxypath);
      });
    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.loaders.model_ply', {
    parse: function(data, job) {
      return new Promise(function(resolve, reject) { 
        var path = THREE.Loader.prototype.extractUrlBase( job.data.src );
        var proxypath = elation.engine.assets.corsproxy + path;

        var loader = new THREE.PLYLoader();
        loader.setPropertyNameMapping({
          diffuse_red: 'red',
          diffuse_green: 'green',
          diffuse_blue: 'blue'
        });

        var geometry = loader.parse(data);
        var encoded = false;

        if (!geometry.index || geometry.index.length == 0) {
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

});

