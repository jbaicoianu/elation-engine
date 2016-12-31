elation.require(['utils.workerpool', 'engine.external.three.three', 'engine.external.libgif', 'engine.external.three.DDSLoader'], function() {

  THREE.Cache.enabled = true;
  elation.extend('engine.assets', {
    assets: {},
    types: {},
    corsproxy: '',
    placeholders: {},

    init: function() {
      var corsproxy = elation.config.get('engine.assets.corsproxy', '');
      //THREE.Loader.Handlers.add(/.*/i, corsproxy);
      //THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
      if (corsproxy != '') {
        this.setCORSProxy(corsproxy);
      }
    },
    loadAssetPack: function(url) {
      this.assetroot = new elation.engine.assets.pack({name: url, src: url});
      this.assetroot.load()
    },
    loadJSON: function(json, baseurl) {
      var assetroot = new elation.engine.assets.pack({name: "asdf", baseurl: baseurl, json: json});
    },
    get: function(asset) {
if (!ENV_IS_BROWSER) return;
      var type = asset.assettype || 'base';
      var assetclass = elation.engine.assets[type] || elation.engine.assets.unknown;
      var assetobj = new assetclass(asset);

      if (!elation.engine.assets.types[type]) elation.engine.assets.types[type] = {};
      if (assetobj.name) {
        elation.engine.assets.assets[assetobj.name] = assetobj;
        elation.engine.assets.types[type][assetobj.name] = assetobj;
      }
      return assetobj;
    },
    find: function(type, name, raw) {
if (!ENV_IS_BROWSER) return;
      var asset;
      if (elation.engine.assets.types[type]) {
        asset = elation.engine.assets.types[type][name];
      }
      //console.log(asset, type, name, elation.engine.assets.types[type]);
      if (raw) {
        return asset;
      }
      if (asset) {
        return asset.getInstance();
      } else {
        asset = elation.engine.assets.get({assettype: type, name: name});
        return asset.getInstance();
      }
      return undefined;
    },
    setCORSProxy: function(proxy) {
      elation.engine.assets.corsproxy = proxy;
      var loader = new elation.engine.assets.corsproxyloader(proxy);
      elation.engine.assetdownloader.setCORSProxy(proxy);
      THREE.Loader.Handlers.add(/.*/i, loader);

      if (!elation.env.isWorker && elation.engine.assets.loaderpool) {
        elation.engine.assets.loaderpool.sendMessage('setcorsproxy', proxy);
      }
    },
    setPlaceholder: function(type, name) {
      this.placeholders[type] = this.find(type, name);
    },
    loaderpool: false
  });
  elation.extend('engine.assetdownloader', new function() {
    this.corsproxy = '';
    this.queue = {};
    this.setCORSProxy = function(proxy) {
      this.corsproxy = proxy;
    }
    this.fetchURLs = function(urls, progress) {
      var promises = [],
          queue = this.queue;
      var corsproxy = this.corsproxy;
      for (var i = 0; i < urls.length; i++) {
        var subpromise = new Promise(function(resolve, reject) {
          var fullurl = urls[i];
          if (corsproxy) fullurl = corsproxy + fullurl;
          if (!queue[fullurl]) {
            var xhr = queue[fullurl] = elation.net.get(fullurl, null, {
              responseType: 'arraybuffer',
              onload: resolve,
              onerror: reject,
              onprogress: progress,
              headers: {
                'X-Requested-With': 'Elation Engine asset loader'
              }
            });
          } else {
            var xhr = queue[fullurl];
            if (xhr.readyState == 4) {
              setTimeout(function() { resolve({target: xhr}); }, 0);
            } else {
              elation.events.add(xhr, 'load', resolve);
              elation.events.add(xhr, 'error', reject);
              elation.events.add(xhr, 'progress', progress);
            }
          }
        });
        promises.push(subpromise);
      }
      return Promise.all(promises);
    }
  });

  elation.define('engine.assets.corsproxyloader', {
    _construct: function(corsproxy, manager) {
      this.corsproxy = corsproxy || '';
      this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
    },
    load: function ( url, onLoad, onProgress, onError ) {
      var fullurl = url;
      if (this.corsproxy != '' && url.indexOf(this.corsproxy) != 0) {
        fullurl = this.corsproxy + url;
      }
      return THREE.TextureLoader.prototype.load.call(this, fullurl, onLoad, onProgress, onError);
    }
  }, THREE.TextureLoader);

  elation.define('engine.assets.base', {
    assettype: 'base',
    name: '',
    description: '',
    license: 'unknown',
    author: 'unknown',
    sourceurl: false,
    loaded: false,
    preview: false,
    baseurl: '',
    src: false,
    instances: [],

    _construct: function(args) {
      elation.class.call(this, args);
      this.init();
    },
    init: function() {
      this.instances = [];
    },
    load: function() {
      console.log('engine.assets.base load() should not be called directly', this);
    },
    isURLRelative: function(src) {
      if (src && src.match(/^(https?:)?\/\//) || src[0] == '/') {
        return false;
      }
      return true;
    },
    isURLAbsolute: function(src) {
      return (src[0] == '/' && src[1] != '/');
    },
    isURLLocal: function(src) {
      if (src.match(/^(https?:)?\/\//i)) {
        return (src.indexOf(self.location.origin) == 0);
      }
      return (
        (src[0] == '/' && src[1] != '/') ||
        (src[0] != '/')
      );
    },
    isURLProxied: function(url) {
      if (!url || !elation.engine.assets.corsproxy) return false;
      return url.indexOf(elation.engine.assets.corsproxy) == 0;
    },
    getFullURL: function(url, baseurl) {
      if (!url) url = this.src;
      if (!baseurl) baseurl = this.baseurl;
      var fullurl = url;
      if (this.isURLRelative(fullurl)) {
         fullurl = baseurl + fullurl;
      } else if (this.isURLProxied(fullurl)) {
        fullurl = fullurl.replace(elation.engine.assets.corsproxy, '');
      } else if (this.isURLAbsolute(fullurl)) {
         fullurl = self.location.origin + fullurl;
      }

      return fullurl;
    },
    getProxiedURL: function(url, baseurl) {
      var proxiedurl = this.getFullURL(url, baseurl);
      if (proxiedurl && elation.engine.assets.corsproxy && !this.isURLLocal(proxiedurl) && proxiedurl.indexOf(elation.engine.assets.corsproxy) == -1) {
        var re = /:\/\/([^\/\@]+@)/;
        var m = proxiedurl.match(re);
        // Check it asset has authentication info, and pass it through if it does
        if (m) {
          proxiedurl = elation.engine.assets.corsproxy.replace(':\/\/', ':\/\/' + m[1]) + proxiedurl.replace(m[1], '');
        } else {
          proxiedurl = elation.engine.assets.corsproxy + proxiedurl;
        }
      }
      return proxiedurl;
    },
    getBaseURL: function(url) {
      var url = url || this.getFullURL();
      var parts = url.split('/');
      parts.pop();
      return parts.join('/') + '/';
    },
    getInstance: function(args) {
      return undefined;
    }
  }, elation.class);

  elation.define('engine.assets.unknown', {
    assettype: 'unknown',
    load: function() {
    },
    _construct: function(args) {
      console.log('Unknown asset type: ', args.assettype, args);
      elation.engine.assets.base.call(this, args);
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.image', {
    assettype: 'image',
    src: false,
    sbs3d: false,
    ou3d: false,
    reverse3d: false,
    texture: false,
    imagetype: '',
    hasalpha: false,

    load: function() {
      var loader = new THREE.TextureLoader();
      loader.setCrossOrigin('');
      if (this.src) {
        var url = this.getProxiedURL(this.src);

        this._texture = loader.load(url, elation.bind(this, this.handleLoad), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
        this._texture.sourceFile = this.src;
        this._texture.image = this.canvas = this.getCanvas();
        this._texture.image.originalSrc = this.src;
        this._texture.needsUpdate = true;
      }
    },
    getCanvas: function() {
      if (!this.canvas) {
        var canvas = document.createElement('canvas');
        var size = 512,
            gridcount = 4,
            gridsize = size / gridcount;
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0,0,size,size);
        ctx.fillStyle = '#666666';
        for (var i = 0; i < gridcount*gridcount; i += 1) {
          var x = i % gridcount;
          var y = Math.floor(i / gridcount);
          if ((x + y) % 2 == 0) {
            ctx.fillRect(x * gridsize, y * gridsize, gridsize, gridsize);
          }
        }
        this.canvas = canvas;
      }
      return this.canvas;
    },
    handleLoad: function(data) {
      //console.log('loaded image', data.sourceFile, data.image, data);
      this._texture = data;
      data.sourceFile = this.src;
      data.image = this.processImage(data.image);
      //data.needsUpdate = true;
      data.wrapS = data.wrapT = THREE.RepeatWrapping;
      data.anisotropy = 16;
      this.loaded = true;
      this._texture.needsUpdate = true;
      elation.events.fire({type: 'asset_load', element: this._texture});
      elation.events.fire({type: 'asset_load', element: this});
      elation.events.fire({element: this, type: 'asset_load_complete'});
    },
    handleProgress: function(ev) {
      var progress = {
        src: ev.target.responseURL,
        loaded: ev.loaded,
        total: ev.total
      };
      //console.log('image progress', progress);
      elation.events.fire({element: this, type: 'asset_load_progress', data: progress});
    },
    handleError: function(ev) {
      console.log('image error!', this, this._texture.image, ev);
      var canvas = this.getCanvas();
      var size = 16;
      canvas.width = canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#f0f';
      ctx.fillRect(0,0,size,size);
      
      this._texture.image = canvas;
      this._texture.needsUpdate = true;
      this._texture.generateMipMaps = false;
      elation.events.fire({type: 'asset_error', element: this._texture});
    },
    getInstance: function(args) {
      if (!this._texture) {
        this.load();
      }
      return this._texture;
    },
    processImage: function(image) {
      this.imagetype = this.detectImageType();
      if (this.imagetype == 'gif') {
        this.hasalpha = true; // FIXME - if we're cracking the gif open already, we should be able to tell if it has alpha or not
        return this.convertGif(image); 
      } else { //if (!elation.engine.materials.isPowerOfTwo(image.width) || !elation.engine.materials.isPowerOfTwo(image.height)) {
        // Scale up the texture to the next highest power of two dimensions.
        var canvas = this.canvas;
        canvas.src = this.src;
        canvas.originalSrc = this.src;

        canvas.width = elation.engine.materials.nextHighestPowerOfTwo(image.width);
        canvas.height = elation.engine.materials.nextHighestPowerOfTwo(image.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
        this.hasalpha = this.canvasHasAlpha(canvas);
        this._texture.generateMipMaps = true;

        return canvas;
      //} else {
      //  return image;
      }
    },
    convertGif: function(image) {
      var gif = new SuperGif({gif: image, draw_while_loading: true, loop_mode: false, auto_play: false});

      // Decode gif frames into a series of canvases, then swap between canvases to animate the texture

      // This could be made more efficient by uploading each frame to the GPU as a separate texture, and
      // swapping the texture handle each frame instead of re-uploading the frame.  This is hard to do
      // with the way Three.js handles Texture objects, but it might be possible to fiddle with 
      // renderer.properties[texture].__webglTexture directly

      // It could also be made more efficient by moving the gif decoding into a worker, and just passing
      // back messages with decoded frame data.

      var getCanvas = function() {
        var newcanvas = document.createElement('canvas');
        newcanvas.width = elation.engine.materials.nextHighestPowerOfTwo(image.width);
        newcanvas.height = elation.engine.materials.nextHighestPowerOfTwo(image.height);
        return newcanvas;
      }
      var newcanvas = getCanvas();
      var mainctx = newcanvas.getContext('2d');

      var texture = this._texture;
      texture.minFilter = THREE.NearestFilter;
      texture.magFilter = THREE.NearestFilter;
      //texture.generateMipmaps = false;
      var frames = [];
      var framedelays = [];
      var framenum = -1;
      gif.load(function() {
        var canvas = gif.get_canvas();

        var doGIFFrame = function(static) {
          framenum = (framenum + 1) % gif.get_length();
          var frame = frames[framenum];
          if (!frame) {
            gif.move_to(framenum);
            var gifframe = gif.get_frame(framenum);
            if (gifframe) {
              frame = frames[framenum] = { framenum: framenum, delay: gifframe.delay, image: getCanvas() };
              ctx = frame.image.getContext('2d');
              newcanvas.width = canvas.width;
              newcanvas.height = canvas.height;
              //mainctx.putImageData(gifframe.data, 0, 0, 0, 0, canvas.width, canvas.height);
              ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, frame.image.width, frame.image.height);
              texture.minFilter = texture.magFilter = THREE.NearestFilter; // FIXME - should this be hardcoded for all gifs?
            }
          }
          if (frame && frame.image) {
            texture.image = frame.image;
            texture.needsUpdate = true;
            elation.events.fire({type: 'update', element: texture});
          }

          if (!static) {
            var delay = (frame && frame.delay > 0 ? frame.delay : 10);
            setTimeout(doGIFFrame, delay * 10);
          }
        }
        doGIFFrame(gif.get_length() == 1);
      });
      return newcanvas;
    },
    detectImageType: function() {
      // FIXME - really we should be cracking open the file and looking at magic number to determine this
      // We might also be able to get hints from the XHR loader about the image's MIME type

      var type = 'jpg';
      if (this.src.match(/\.(.*?)$/)) {
        var parts = this.src.split('.');
        type = parts.pop();
      }
      return type;
    },
    canvasHasAlpha: function(canvas) {
      if (!(this.imagetype == 'gif' || this.imagetype == 'png')) {
        return false;
      }

      // This could be made more efficient by doing the work on the gpu.  We could make a scene with the
      // texture and an orthographic camera, and a shader which returns alpha=0 for any alpha value < 1
      // We could then perform a series of downsamples until the texture is (1,1) in size, and read back
      // that pixel value with readPixels().  If there was any alpha in the original image, this final 
      // pixel should also be transparent.

      var width = Math.min(128, canvas.width); 
      var height = Math.min(128, canvas.height); 

      var checkcanvas = document.createElement('canvas');
      checkcanvas.width = width;
      checkcanvas.height = height;

      var ctx = canvas.getContext('2d');
      var ctx2 = checkcanvas.getContext('2d');
      ctx2.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);

      var pixeldata = ctx2.getImageData(0, 0, width, height);
      var hasalpha = false;
      for (var i = 0; i < pixeldata.data.length; i+=4) {
        if (pixeldata.data[i+3] != 255) {
          return true;
        }
      }
      return false;
    },
    
  }, elation.engine.assets.base);

  elation.define('engine.assets.video', {
    assettype: 'video',
    src: false,
    sbs3d: false,
    ou3d: false,
    auto_play: false,
    texture: false,
    load: function() {
      var url = this.getProxiedURL(this.src);
      var video = document.createElement('video');
      video.src = url;
      video.autoplay = this.auto_play;
      video.crossOrigin = 'anonymous';
      this._video = video;
      this._texture = new THREE.VideoTexture(video);
      this._texture.minFilter = THREE.LinearFilter;
    },
    handleProgress: function(ev) {
      //console.log('image progress!', ev);
      var progress = {
        src: ev.target.responseURL,
        loaded: ev.loaded,
        total: ev.total
      };
      elation.events.fire({element: this, type: 'asset_load_progress', data: progress});
    },
    handleError: function(ev) {
      console.log('video uh oh!', ev);
      this._texture = false;
    },
    getInstance: function(args) {
      if (!this._texture) {
        this.load();
      }
      return this._texture;
    }
  }, elation.engine.assets.base);
  elation.define('engine.assets.material', {
    assettype: 'material',
    color: null,
    map: null,
    normalMap: null,
    specularMap: null,
    load: function() {
      var matargs = {};
      if (this.color) matargs.color = new THREE.Color(this.color);
      if (this.map) matargs.map = elation.engine.assets.find('image', this.map);
      if (this.normalMap) matargs.normalMap = elation.engine.assets.find('image', this.normalMap);
      if (this.specularMap) matargs.specularMap = elation.engine.assets.find('image', this.normalMap);

      this._material = new THREE.MeshPhongMaterial(matargs);
      console.log('new material!', this._material);
    },
    getInstance: function(args) {
      if (!this._material) {
        this.load();
      }
      return this._material;
    },
    handleLoad: function(data) {
      console.log('loaded image', data);
      this._texture = data;
    },
    handleProgress: function(ev) {
    },
    handleError: function(ev) {
      console.log('image uh oh!', ev);
      this._texture = false;
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.sound', {
    assettype: 'sound',
    src: false,

    load: function() {
      if (this.src) {
        //this._sound = new THREE.Audio(this.src);
      }
    },
    handleLoad: function(data) {
      console.log('loaded sound', data);
      this._sound = data;
      this.loaded = true;
    },
    handleProgress: function(ev) {
      console.log('sound progress!', ev);
    },
    handleError: function(ev) {
      console.log('sound uh oh!', ev);
      this._sound = false;
    },
    getInstance: function(args) {
      return this;
      /*
      if (!this._sound) {
        this.load();
      }
      return this._sound;
      */
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.model', {
    assettype: 'model',
    src: false,
    mtl: false,
    tex: false,
    tex0: false,
    tex1: false,
    tex2: false,
    tex3: false,
    tex_linear: true,
    color: false,
    modeltype: '',
    compression: 'none',

    loadworkers: [
    ],

    getInstance: function(args) {
      var group = new THREE.Group();
      if (!this._model) {
        this.load();
        var mesh;
        if (elation.engine.assets.placeholders.model) {
          mesh = elation.engine.assets.placeholders.model.clone();
        } else {
          mesh = this.createPlaceholder();
        }
        group.add(mesh);
      } else {
        //group.add(this._model.clone());
        this.fillGroup(group, this._model);
        //group = this._model.clone();
        this.assignTextures(group, args);
        setTimeout(function() {
          elation.events.fire({type: 'asset_load', element: group});
          elation.events.fire({type: 'asset_load', element: this});
        }, 0);
      }
      this.instances.push(group);
      return group;
    },
    fillGroup: function(group, source) {
      if (!source) source = this._model;
      if (source) {
/*
        group.position.copy(source.position);
        group.quaternion.copy(source.quaternion);
        //group.scale.copy(source.scale);
        if (source.children) {
          source.children.forEach(function(n) {
            group.add(n.clone());
          });
        }
*/
        group.add(source.clone());

/*
        group.traverse(elation.bind(this, function(n) { 
          if (n.material) {
            var oldmat = n.material,
                newmat = oldmat.clone();//this.copyMaterial(oldmat);

            //n.material = newmat;
            if (n.material instanceof THREE.MeshFaceMaterial) {
              for (var i = 0; i < n.material.materials.length; i++) {
                var oldmat = n.material.materials[i],
                    newmat = oldmat.clone();//this.copyMaterial(oldmat);
                //n.material.materials[i] = newmat;
                //console.log('facemat', oldmat.name, oldmat.alphaTest, newmat.alphaTest);
              }
            }
          }
        }));
*/
      }
      return group;
    },
    copyMaterial: function(oldmat) {
      var m = new THREE.MeshPhongMaterial();
      m.anisotropy = 16;
      m.name = oldmat.name;
      m.map = oldmat.map;
      m.normalMap = oldmat.normalMap;
      m.lightMap = oldmat.lightMap;
      m.color.copy(oldmat.color);
      m.transparent = oldmat.transparent;
      m.alphaTest = oldmat.alphaTest;
      return m;
    },
    assignTextures: function(group, args) {
      var minFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearMipMapLinearFilter : THREE.NearestFilter);
      var magFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearFilter : THREE.NearestFilter);

      if (this.tex) this.tex0 = this.tex;
      if (this.tex0) {
        var tex0 = elation.engine.assets.find('image', this.tex0);
        if (!tex0) {
          var asset = elation.engine.assets.get({
            assettype: 'image', 
            name: this.tex0, 
            src: this.tex0,
            baseurl: this.baseurl
          });
          tex0 = asset.getInstance();
        }
      }
      group.traverse(function(n) { 
        if (n.material) {
          var materials = (n.material instanceof THREE.MeshFaceMaterial ? n.material.materials : [n.material]);
          materials.forEach(function(m) {
            if (tex0) {
              //m.transparent = true; 
              m.alphaTest = 0.1;
              m.map = tex0; 
            }
            if (m.map) {
              m.map.minFilter = minFilter;
              m.map.magFilter = magFilter;
            }
            m.needsUpdate = true;
            //if (m.color) m.color.setHex(0xffffff);
          });
        } 
      });
    },
    createPlaceholder: function() {
/*
      var geo = new THREE.TextGeometry('loading...', { size: 1, height: .1, font: 'helvetiker' });
      var font = elation.engine.assets.find('font', 'helvetiker');

      var geo = new THREE.TextGeometry( 'loading...', {
        size: 1,
        height: 0.1,

        font: font,
      });                                                
*/
/*
      var geo = new THREE.SphereGeometry(0.25);
      //geo.applyMatrix(new THREE.Matrix4().makeScale(1,1,.1));
      var mat = new THREE.MeshPhongMaterial({color: 0x999900, emissive: 0x333333, opacity: 0.5, transparent: true});
      this.placeholder = new THREE.Mesh(geo, mat);
*/
      this.placeholder = new THREE.Object3D();
      
      return this.placeholder;
    },
    load: function() {
      if (this.src) {
        this.loading = true;
        this.loaded = false;

        this.state = 'loading';
        
        var loadargs = {src: this.getFullURL()};
        if (this.mtl) loadargs.mtl = this.getFullURL(this.mtl, this.getBaseURL(loadargs.src));
        this.queueForDownload(loadargs);
      } else {
        this.removePlaceholders();
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
    queueForDownload: function(jobdata) {
      var urls = [jobdata.src];
      if (jobdata.mtl) urls.push(jobdata.mtl);
      this.state = 'queued';
      var progressfunc = elation.bind(this, function(progress) {
          if (this.state == 'queued') {
            this.state = 'downloading';
            elation.events.fire({element: this, type: 'asset_load_start'});
          }

          this.handleLoadProgress(progress);
      });

      elation.engine.assetdownloader.fetchURLs(urls, progressfunc).then(
        elation.bind(this, function(events) {
          var files = [];
          events.forEach(function(ev) {
            var url = ev.target.responseURL,
                data = ev.target.response;
            if (url == jobdata.src) {
              jobdata.srcdata = data;
            } else if (url == jobdata.mtl) {
              jobdata.mtldata = data;
            }
          });
          this.state = 'processing';
          this.loadWithWorker(jobdata);
          elation.events.fire({element: this, type: 'asset_load_processing'});
        }), 
        elation.bind(this, function(error) {
          this.state = 'error';
          elation.events.fire({element: this, type: 'asset_load_error'});
        })
      );
      elation.events.fire({element: this, type: 'asset_load_queued'});
    },
    loadWithWorker: function(jobdata) {
      this._model = new THREE.Group();
      this._model.userData.loaded = false;
      if (!elation.engine.assets.loaderpool) {
        var numworkers = elation.config.get('engine.assets.workers', 4);
        elation.engine.assets.loaderpool = new elation.utils.workerpool({component: 'engine.assetworker', num: numworkers});
      }
      elation.engine.assets.loaderpool.addJob(jobdata)
        .then(
          elation.bind(this, this.handleLoadJSON), 
          elation.bind(this, this.handleLoadError)
          //elation.bind(this, this.handleLoadProgress)
        );
    },
    handleLoadJSON: function(json) {
      if (json) {
        this.loaded = true;
        var parser = new THREE.ObjectLoader();
        parser.setCrossOrigin('anonymous');
        var scene = parser.parse(json);
        
        this.removePlaceholders();
        this._model.userData.loaded = true;
        //this._model.add(scene);
        this.fillGroup(this._model, scene);

        this.extractTextures(scene);
        this.assignTextures(scene);

        this.instances.forEach(elation.bind(this, function(n) { 
          if (!n.userData.loaded) {
            n.userData.loaded = true;
            //n.add(scene.clone()); 
            this.fillGroup(n, scene);
            this.assignTextures(n);
            elation.events.fire({type: 'asset_load', element: n});
            //elation.events.fire({type: 'asset_load_complete', element: this});
          }
        }));

        elation.events.fire({element: this, type: 'asset_load_processed'});
        elation.events.fire({type: 'asset_load', element: this});
      }
    },
    handleLoadError: function(e) {
      console.log('Error loading model', this, e);
      elation.events.fire({type: 'asset_error', element: this});
    },
    handleLoadProgress: function(progress) {
      //console.log('Model loading progress', this, progress);
      var progressdata = {
        src: progress.target.responseURL,
        loaded: progress.loaded,
        total: progress.total,
      };
      elation.events.fire({element: this, type: 'asset_load_progress', data: progressdata});
    },
    extractTextures: function(scene) {
      var types = ['map', 'bumpMap', 'lightMap', 'normalMap', 'specularMap'];
      var textures = {};
      var texturepromises = [];

      var minFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearMipMapLinearFilter : THREE.NearestFilter);
      var magFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearFilter : THREE.NearestFilter);

      scene.traverse(function(n) { 
        if (n instanceof THREE.Mesh) {
          var materials = (n.material instanceof THREE.MultiMaterial || n.material instanceof THREE.MeshFaceMaterial ? n.material.materials : [n.material]);

          materials.forEach(function(material) {
            types.forEach(function(texname) { 
              var tex = material[texname];

              if (tex) { // && tex.image instanceof HTMLImageElement) {
                var img = tex.image;
//console.log('swap textures', texname, tex, material, (tex ? tex.image : false));
                var src = img.originalSrc || img.src;
                if (!textures[src]) {
                  //elation.engine.assets.loadJSON([{"assettype": "image", name: src, "src": src}], this.baseurl); 
                  //tex = elation.engine.assets.find('image', src);

                  var asset = elation.engine.assets.find('image', src, true);
                  if (!asset) {
                    asset = elation.engine.assets.get({
                      assettype: 'image', 
                      name: src, 
                      src: src,
                      baseurl: this.baseurl
                    });
                  }
                  texturepromises.push(new Promise(function(resolve, reject) {
                    elation.events.add(asset, 'asset_load_complete', resolve);
                    elation.events.add(asset, 'asset_error', reject);
                  }));
                  
                  tex = asset.getInstance();
                  material[texname] = textures[src] = tex;
                } else {
                  tex = material[texname] = textures[src];
                }
              }
            });
          });
        }
        for (var k in textures) {
          var tex = textures[k];
          if (tex) {
            //tex.minFilter = minFilter;
            //tex.magFilter = magFilter;
          }
        }
      });

      if (texturepromises.length > 0) {
        Promise.all(texturepromises).then(elation.bind(this, function() {        
          elation.events.fire({element: this, type: 'asset_load_complete'});
        }));
      } else {
        setTimeout(elation.bind(this, function() {
          elation.events.fire({element: this, type: 'asset_load_complete'});
        }), 0);
      }
    },
    handleProgress: function(ev) {
      //console.log('model progress!', ev);
    },
    handleError: function(ev) {
      console.log('model uh oh!', ev);
      if (this.placeholder) {
        var placeholder = this.placeholder;
        var mat = new THREE.MeshPhongMaterial({color: 0x990000, emissive: 0x333333});
        var errorholder = new THREE.Mesh(new THREE.SphereGeometry(1), mat);
        this.instances.forEach(function(n) { n.remove(placeholder); n.add(errorholder); });
        
      }
    },
    removePlaceholders: function() {
      if (this.placeholder) {
        var placeholder = this.placeholder;
        this.instances.forEach(function(n) { n.remove(placeholder); });
        if (this._model) {
          this._model.remove(placeholder);
        }
      }
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.pack', {
    assettype: 'pack',
    src: false,
    json: false,
    assets: [],
  
    init: function() {
      this.load();
    },
    load: function() {
      if (this.json) {
        this.loadJSON(this.json);
      } else if (this.src) {
        var url = this.getFullURL();
        this.loadURL(url);
      }
    },
    loadURL: function(url) {
      console.log('load:', url);
      elation.net.get(url, null, { 
        callback: elation.bind(this, function(data) {
          //console.log('got it', this, data);
          console.log('loaded:', url);
          this.loadJSON(JSON.parse(data));
        }),
      });
    },
    loadJSON: function(json) {
      this.json = json;
      var baseurl = (this.baseurl && this.baseurl.length > 0 ? this.baseurl : this.getBaseURL());
      this.assets = [];
      json.forEach(elation.bind(this, function(assetdef) {
        assetdef.baseurl = baseurl;
        var existing = elation.engine.assets.find(assetdef.assettype, assetdef.name, true);
        if (!existing) {
          var asset = elation.engine.assets.get(assetdef);
          this.assets.push(asset);
        }
        //asset.load();
      }));
    },
    _construct: function(args) {
      elation.engine.assets.base.call(this, args);
      if (!this.name) {
        this.name = this.getFullURL();
      }
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.font', {
    assettype: 'font',
    src: false,
    _font: false,

    _construct: function(args) {
      elation.class.call(this, args);
      this.load();
    },
    load: function() {
      var loader = new THREE.FontLoader();

      if (this.src) {
        loader.load(this.src, 
                    elation.bind(this, this.handleLoad), 
                    elation.bind(this, this.handleProgress), 
                    elation.bind(this, this.handleError));
      }
    },
    handleLoad: function(data) {
      this._font = data;
    },
    getInstance: function(args) {
      if (!this._font) {
        this.load();
      }
      return this._font;
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.labelgen', {
    assettype: 'label',
    text: '',
    canvas: false,
    font: 'sans-serif',
    fontSize: 64,
    color: '#ffffff',
    outline: 'rgba(0,0,0,0.5)',
    outlineSize: 1,
    
    aspect: 1,
    _texture: false,

    _construct: function(args) {
      elation.class.call(this, args);
      this.cache = {};
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.load();
    },
    getNextPOT: function(x) {
      return Math.pow(2, Math.ceil(Math.log(x) / Math.log(2)));
    },
    load: function() {
      
    },
    getLabel: function(text) {
      if (!this.cache[text]) {
        var canvas = this.canvas,
            ctx = this.ctx;

        var fontSize = this.fontSize,
            color = this.color,
            outlineSize = this.outlineSize,
            outline = this.outline,
            font = this.font;

        ctx.font = fontSize + 'px ' + font;
        ctx.lineWidth = outlineSize + 'px ';
        ctx.strokeStyle = outline;

        var size = ctx.measureText(text);
        var w = size.width,
            h = fontSize;

        canvas.width = w;
        canvas.height = h;

        ctx.textBaseline = 'top';
        ctx.font = fontSize + 'px ' + font;
        ctx.lineWidth = outlineSize + 'px ';
        ctx.strokeStyle = outline;
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = color;

        this.aspect = size.width / fontSize;

        ctx.fillText(text, 0, 0);
        ctx.strokeText(text, 0, 0);

        var scaledcanvas = document.createElement('canvas');
        var scaledctx = scaledcanvas.getContext('2d');
        scaledcanvas.width = this.getNextPOT(w);
        scaledcanvas.height = this.getNextPOT(h);
        scaledctx.drawImage(canvas, 0, 0, scaledcanvas.width, scaledcanvas.height);

        this.cache[text] = new THREE.Texture(scaledcanvas);
        this.cache[text].needsUpdate = true;
      }
      return this.cache[text];
    },
    getAspectRatio: function(text) {
      var ctx = this.ctx, 
          font = this.font,
          fontSize = this.fontSize;
      ctx.font = fontSize + 'px ' + font;
      var size = ctx.measureText(text);
      return size.width / fontSize;
    },
    getInstance: function(args) {
      if (!this._texture) {
        this.load();
      }
      return this._texture;
    }
  }, elation.engine.assets.base);
  /*
    assetpack = [
      { name: 'grass-diffuse', 'assettype: 'image', src: '/textures/grass/diffuse.jpg' },
      { name: 'grass-normal', 'assettype: 'image', src: '/textures/grass/normal.png' },
      { name: 'grass', 'assettype: 'material', materialtype: 'phong', map: 'grass-diffuse', normalMap: 'grass-normal'},
      { name: 'house', assettype: 'model', modeltype: 'collada', src: '/models/house.dae' },
      { name: 'tree', assettype: 'model', modeltype: 'collada', src: '/models/tree.dae' }
    ]
  */
  elation.define('engine.assets.script', {
    assettype: 'script',
    src: false,
    code: false,

    _construct: function(args) {
      elation.class.call(this, args);
      //this.load();
    },
    load: function() {
      this._script = document.createElement('script');
      if (this.code) {
        setTimeout(elation.bind(this, function() {
          this.parse(this.code);
        }), 0);
      } else if (this.src) {
        var url = this.getProxiedURL(this.src);

        elation.net.get(url, null, { 
          nocache: true,
          callback: elation.bind(this, this.parse)
        });
      }
    },
    parse: function(data) {
      //var blob = new Blob(['(function(window) {\n' + data + '\n})(self)'], {type: 'application/javascript'});
      var blob = new Blob(['\n' + data + '\n'], {type: 'application/javascript'});
      var bloburl = URL.createObjectURL(blob);
      this._script.src = bloburl;
      elation.events.fire({type: 'asset_load', element: this._script});
      elation.events.fire({type: 'asset_load', element: this});
    },
    handleProgress: function(ev) {
    },
    handleError: function(ev) {
      this._script = false;
    },
    getInstance: function(args) {
      if (!this._script) {
        this.load();
      }
      return this._script;
    }
  }, elation.engine.assets.base);
});

