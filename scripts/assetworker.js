elation.require([
    'utils.events',
    'utils.worker',
    'engine.engine',
    'engine.assets',
    'engine.external.pako',
    'engine.external.three.three', 'engine.external.three.FBXLoader', 'engine.external.three.ColladaLoader', 'engine.external.xmldom',
    'engine.external.three.OBJLoader', 'engine.external.three.OBJMTLLoader', 'engine.external.three.MTLLoader', 'engine.external.three.VRMLLoader',
  ], function() {

  elation.define('engine.assetworker', {
    _construct: function() {
      THREE.ImageLoader.prototype.load = function(url, onLoad) {
        var img = { src: url };
        if ( onLoad ) {
          onLoad( img );
        }
      }
      this.loader = new elation.engine.assets.loaders.model();
      elation.engine.assets.init();
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
        'wrl': new elation.engine.assets.loaders.model_wrl(),
      }
    },
    load: function(job) {
      var corsproxy = elation.engine.assets.corsproxy || '';
      var baseurl = job.data.src.substr( 0, job.data.src.lastIndexOf( "/" ) + 1 ) 
      var fullurl = (job.data.src.match(/^(https?:)?\/\//) ? corsproxy + job.data.src :  job.data.src);
      elation.net.get(fullurl, null, {
        responseType: 'arraybuffer',
        callback: elation.bind(this, this.onload, job),
        onprogress: elation.bind(this, this.onprogress, job),
        onerror: elation.bind(this, this.onerror, job),
        headers: {
          'X-Requested-With': 'Elation Engine asset loader'
        }
      });
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
        [/^\#VRML/, 'wrl']
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
          var str = '';
          var bufview = new Uint8Array(rawdata);
          var l = bufview.length;
          for (var i = 0; i < l; i++) {
            str += String.fromCharCode(bufview[i]);
          }
          modeldata = decodeURIComponent(escape(str));
        }
      }    
      if (modeldata) {
        this.parse(modeldata, job).then(function(data) {
          postMessage({message: 'finished', id: job.id, data: data});
        });
      } else {
        postMessage({message: 'finished', id: job.id, data: false});
      }
    },
    onprogress: function(job, ev) {
      //console.log('progress', job, ev);
    },
    onerror: function(job, ev) {
      console.log('error', job, ev);
    },
  });
  elation.define('engine.assets.loaders.model_obj', {
    parse: function(data, job) {
      return new Promise(elation.bind(this, function(resolve, reject) { 
        var mtl = job.data.mtl || false;

        var baseurl = job.data.src.substr( 0, job.data.src.lastIndexOf( "/" ) + 1 ) 
        if (!mtl) {
          var re = /^mtllib (.*)$/im;
          var m = data.match(re);
          if (m) {
            mtl = m[1];
          }
        }
        var loader = (mtl ? new THREE.OBJMTLLoader() : new THREE.OBJLoader());
        var modeldata = loader.parse(data);

        if (mtl) {
          mtl = this.getFullURL(mtl, baseurl); 
          if (elation.engine.assets.corsproxy) {
            mtl = elation.engine.assets.corsproxy + mtl;
          }
          var mtlLoader = new THREE.MTLLoader( );
          mtlLoader.setBaseUrl( mtl.substr( 0, mtl.lastIndexOf( "/" ) + 1 ) );
          mtlLoader.setCrossOrigin( 'anonymous' );
          mtlLoader.load( mtl, 
            elation.bind(this, function ( materials ) {
              var materialsCreator = materials;
              materialsCreator.preload();

              modeldata.traverse( function ( object ) {

                if ( object instanceof THREE.Mesh ) {

                  if (object.material instanceof THREE.MeshFaceMaterial) {
                    var newmaterials = [];
                    object.material.materials.forEach(function(m) {
                      if ( m.name ) {

                        var material = materialsCreator.create( m.name );

                        if ( material ) {
                          newmaterials.push(material);
                        } else {
                          newmaterials.push(m);
                        }
                      } else {
                        newmaterials.push(m);
                      }
                    });
                    object.material.materials = newmaterials;
                  } else {
                    if ( object.material.name ) {

                      var material = materialsCreator.create( object.material.name );

                      if ( material ) object.material = material;

                    }
                  }

                }

              } );
              resolve(modeldata.toJSON());
            }),
            undefined,
            elation.bind(this, function() {
              resolve(modeldata.toJSON());
            })
          );
        } else {
          resolve(modeldata.toJSON());
        }
        return modeldata;
      }));
    },
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

        function fakeQuerySelector(node) {
          node.querySelectorAll = querySelectorAll;
          node.querySelector = querySelector;

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

});

