importScripts('/scripts/utils/elation.js');

elation.require([
    'engine.external.three.three', 'engine.external.three.ColladaLoader', 'engine.external.xmldom',
    'engine.external.three.OBJLoader', 'engine.external.three.OBJMTLLoader', 'engine.external.three.MTLLoader'], function() {

  THREE.Texture = function(image) {
    this.uuid = THREE.Math.generateUUID();

    this.name = '';
    this.offset = new THREE.Vector2();
    this.repeat = new THREE.Vector2();
    this.image = image;
  }
  THREE.Texture.prototype.constructor = THREE.Texture;
  THREE.Texture.prototype.toJSON = function(meta) {
		var output = {
			metadata: {
				version: 4.4,
				type: 'Texture',
				generator: 'Texture.toJSON'
			},

			uuid: this.uuid,
			name: this.name,

			mapping: this.mapping,

			repeat: [ this.repeat.x, this.repeat.y ],
			offset: [ this.offset.x, this.offset.y ],
			wrap: [ this.wrapS, this.wrapT ],

			minFilter: this.minFilter,
			magFilter: this.magFilter,
			anisotropy: this.anisotropy
		};

		if ( this.image !== undefined ) {

			// TODO: Move to THREE.Image

			var image = this.image;

			if ( image.uuid === undefined ) {

				image.uuid = THREE.Math.generateUUID(); // UGH

			}

			if ( meta.images[ image.uuid ] === undefined ) {

				meta.images[ image.uuid ] = {
					uuid: image.uuid,
					url: image.src
				};

			}

			output.image = image.uuid;

		}

		meta.textures[ this.uuid ] = output;

		return output;
  }
  THREE.ImageLoader = function() {
  }
  THREE.ImageLoader.prototype.load = function(url, onLoad) {
    var img = { src: url };
    if ( onLoad ) {
      onLoad( img );
    }
  }

  elation.define('engine.assets.loaders.generic', {
    _construct: function() {
      this.loaders = {
        'dae': new elation.engine.assets.loaders.collada(),
        'obj': new elation.engine.assets.loaders.obj()
      }
    },
    detectType: function(url) {
      var parts = url.split('.');
      var extension = parts.pop();
      if (extension == 'gz') {
        extension = parts.pop();
        this.extension = extension;
        this.compression = 'gzip';
      }
      return extension.toLowerCase();
    },
    load: function(job) {
      var type = this.detectType(job.data.src);
      if (this.loaders[type]) {
        this.loaders[type].load(job);
      } else {
        console.log('UNSUPPORTED TYPE', type, data);
      }
    }
  });
  elation.define('engine.assets.loaders.obj', {
    load: function(job) {
      var loader = (job.data.mtl ? new THREE.OBJMTLLoader() : new THREE.OBJLoader());
      loader.setCrossOrigin('anonymous');
      //console.log('load obj model!', this, loader);
      //var mtlurl = url.replace('.obj', '.mtl');
      if (job.data.mtl) {
        loader.load(job.data.src, job.data.mtl, elation.bind(this, this.handleLoadOBJ, job), elation.bind(this, this.handleProgress, job), elation.bind(this, this.handleError, job));
      } else {
        loader.load(job.data.src, elation.bind(this, this.handleLoadOBJ, job), elation.bind(this, this.handleProgress, job), elation.bind(this, this.handleError, job));
      }
    },
    handleLoadOBJ: function(job, data) {
      data.traverse(function(n) {
        if ((n.geometry instanceof THREE.BufferGeometry && !n.geometry.attributes.normals) ||
            (n.geometry instanceof THREE.Geometry && !n.geometry.faceVertexNormals)) {
          //n.geometry.computeFaceNormals();
          //n.geometry.computeVertexNormals();
        }
        if (n.geometry && n.geometry instanceof THREE.Geometry) {
          var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
          n.geometry = bufgeo;
        }
      });
      var summary = data.toJSON();
      console.log('loaded obj:', job, data);
      postMessage({message: 'finished', id: job.id, data: summary});
    }
  });
  elation.define('engine.assets.loaders.collada', {
    parser: new DOMParser(),

    load: function(job) {
      elation.net.get(job.data.src, null, {
        callback: elation.bind(this, this.onload, job),
        onprogress: elation.bind(this, this.onprogress, job),
        onerror: elation.bind(this, this.onerror, job),
      });
    },
    onload: function(job, data, xhr) {
      var docRoot = this.parser.parseFromString(data);
      var collada = docRoot.getElementsByTagName('COLLADA')[0];

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
/*
        var parts = selector.split(' ');
        var root = collada;

        var tags = [];
        var tagpool = getChildrenByTagName(collada, parts[0]);
        if (parts.length > 1) {
          var tagpool2 = [];
          tagpool.forEach(function(n) {
            tagpool2.push.apply(tagpool2, getChildrenByTagName(n, parts[1]));
          });
          tags = tagpool2;
        } else {
          tags = tagpool;
        }

        //tags.forEach(function(n) { fakeQuerySelector(n); });
        return tags;
*/
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
      loader.parse(docRoot, function(data) {
        data.scene.traverse(function(n) {
          if ((n.geometry instanceof THREE.BufferGeometry && !n.geometry.attributes.normals) ||
              (n.geometry instanceof THREE.Geometry && !n.geometry.faceVertexNormals)) {
            //n.geometry.computeFaceNormals();
            //n.geometry.computeVertexNormals();
          }
          if (n.geometry && n.geometry instanceof THREE.Geometry) {
            var bufgeo = new THREE.BufferGeometry().fromGeometry(n.geometry);
            n.geometry = bufgeo;
          }
        });
        var summary = data.scene.toJSON();
        console.log('loaded collada:', job, data, summary);
        postMessage({message: 'finished', id: job.id, data: summary});
      }, job.data.src);

    },
    onprogress: function(job, ev) {
      console.log('progress', job, ev);
    },
  });

  var loader = new elation.engine.assets.loaders.generic();

  onmessage = function(ev) {
    var job = ev.data;
    if (job) {
      loader.load(job);
    }
  }
});

