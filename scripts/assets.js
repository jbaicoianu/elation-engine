elation.require(['utils.workerpool', 'engine.external.three.three', 'engine.external.libgif'], function() {

  THREE.Cache.enabled = true;
  elation.extend('engine.assets', {
    assets: {},
    types: {},
    corsproxy: '',
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
        return asset.getAsset();
      } else {
        asset = elation.engine.assets.get({assettype: type, name: name});
        return asset.getAsset();
      }
      return undefined;
    },
    setCORSProxy: function(proxy) {
      elation.engine.assets.corsproxy = proxy;
      var loader = new elation.engine.assets.corsproxyloader(proxy);
      THREE.Loader.Handlers.add(/.*/i, loader);

      if (!elation.env.isWorker && elation.engine.assets.loaderpool) {
        elation.engine.assets.loaderpool.sendMessage('setcorsproxy', proxy);
      }
    },
    loaderpool: (ENV_IS_BROWSER ? new elation.utils.workerpool({component: 'engine.assetworker', num: 4}) : {})
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
    getFullURL: function(url, baseurl) {
      if (!url) url = this.src;
      if (!baseurl) baseurl = this.baseurl;
      var fullurl = url;
      if (this.isURLRelative(fullurl)) {
         fullurl = baseurl + fullurl;
      } else if (this.isURLAbsolute(fullurl)) {
         fullurl = window.self.location.origin + fullurl;
      }

      return fullurl;
    },
    getBaseURL: function(url) {
      var url = url || this.getFullURL();
      var parts = url.split('/');
      parts.pop();
      return parts.join('/') + '/';
    },
    getAsset: function() {
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
    texture: false,
    hasalpha: false,

    load: function() {
      var loader = new THREE.TextureLoader();
      loader.setCrossOrigin('');
      //console.log('load this image!', this);
      if (this.src) {
        var url = this.getFullURL();
        if (elation.engine.assets.corsproxy && !this.isURLLocal(url)) {
          url = elation.engine.assets.corsproxy + url;
        }
        this._texture = loader.load(url, elation.bind(this, this.handleLoad), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
      }
    },
    handleLoad: function(data) {
      //console.log('loaded image', data.sourceFile, data.image, data);
      this._texture = data;
      data.sourceFile = data.image.src;
      data.image = this.processImage(data.image);
      data.needsUpdate = true;
      data.wrapS = data.wrapT = THREE.RepeatWrapping;
      this.loaded = true;
      elation.events.fire({type: 'asset_load', element: this._texture});
    },
    handleProgress: function(ev) {
      //console.log('image progress!', ev);
    },
    handleError: function(ev) {
      console.log('image uh oh!', ev, this._texture.image);
      var canvas = document.createElement('canvas');
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
    getAsset: function() {
      if (!this._texture) {
        this.load();
      }
      return this._texture;
    },
    processImage: function(image) {
      if (image.src.match(/\.gif/)) { // FIXME - really we should be cracking open the file and looking at magic number to determine this
        return this.convertGif(image); 
      } else if (!elation.engine.materials.isPowerOfTwo(image.width) || !elation.engine.materials.isPowerOfTwo(image.height)) {
        // Scale up the texture to the next highest power of two dimensions.
        var canvas = document.createElement("canvas");
        canvas.width = elation.engine.materials.nextHighestPowerOfTwo(image.width);
        canvas.height = elation.engine.materials.nextHighestPowerOfTwo(image.height);
        var ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
        return canvas;
      } else {
        return image;
      }
    },
    convertGif: function(image) {
      var gif = new SuperGif({gif: image, draw_while_loading: true});
      var newcanvas = document.createElement('canvas');
      newcanvas.width = elation.engine.materials.nextHighestPowerOfTwo(image.width);
      newcanvas.height = elation.engine.materials.nextHighestPowerOfTwo(image.height);
      var ctx = newcanvas.getContext('2d');
      var texture = this._texture;
      //texture.minFilter = THREE.LinearFilter;
      //texture.magFilter = THREE.LinearFilter;
      //texture.generateMipmaps = false;
      gif.load(function() {
        var canvas = gif.get_canvas();

        var doGIFFrame = function(static) {
          newcanvas.width = newcanvas.width;
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newcanvas.width, newcanvas.height);
          texture.needsUpdate = true;
          newcanvas.width = newcanvas.width;
          ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, newcanvas.width, newcanvas.height);
          texture.needsUpdate = true;
          elation.events.fire({type: 'update', target: texture});

          if (!static) {
            var frame = gif.get_frame(gif.get_current_frame());
            var delay = (frame ? frame.delay : 10);
            setTimeout(doGIFFrame, delay * 10);
          }
        }
        doGIFFrame(gif.get_length() == 1);
      });
      return newcanvas;
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.video', {
    assettype: 'video',
    src: false,
    sbs3d: false,
    ou3d: false,
    auto_play: false,
    texture: false,
    load: function() {
      var url = this.getFullURL(this.src);
      if (elation.engine.assets.corsproxy && !this.isURLLocal(this.src)) {
        url = elation.engine.assets.corsproxy + url;
      }
      var video = document.createElement('video');
      video.src = url;
      video.autoplay = this.auto_play;
      video.crossOrigin = 'anonymous';
      this._video = video;
      this._texture = new THREE.VideoTexture(video);
    },
    handleProgress: function(ev) {
      //console.log('image progress!', ev);
    },
    handleError: function(ev) {
      console.log('video uh oh!', ev);
      this._texture = false;
    },
    getAsset: function() {
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
    getAsset: function() {
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
      console.log('image progress!', ev);
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
        this._sound = new THREE.Audio(this.src);
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
    getAsset: function() {
      if (!this._sound) {
        this.load();
      }
      return this._sound;
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
    modeltype: '',
    compression: 'none',

    loadworkers: [
    ],

    getAsset: function() {
      var group = new THREE.Group();
      if (!this._model) {
        this.load();
        var mesh = this.createPlaceholder();
        group.add(mesh);
      } else {
        //group.add(this._model.clone());
        this.fillGroup(group, this._model);
        this.assignTextures(group);
      }
      this.instances.push(group);
      return group;
    },
    fillGroup: function(group, source) {
      if (!source) source = this._model;
      if (source) {
/*
        group.position.copy(this._model.position);
        group.quaternion.copy(this._model.quaternion);
        //group.scale.copy(this._model.scale);

        if (source.children) {
          source.children.forEach(function(n) {
            group.add(n.clone());
          });
        }
*/
        group.add(source.clone());
      }
      return group;
    },
    assignTextures: function(group) {
      var minFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearMipMapLinearFilter : THREE.NearestFilter);
      var magFilter = (this.tex_linear && this.tex_linear != 'false' ? THREE.LinearFilter : THREE.NearestFilter);

      if (this.tex) this.tex0 = this.tex;
      if (this.tex0) {
        var tex0 = elation.engine.assets.find('image', this.tex0);
        if (!tex0) {
          var asset = elation.engine.assets.get({
            assettype: 'image', 
            id: this.tex0, 
            src: this.tex0,
            baseurl: this.baseurl
          });
          tex0 = asset.getAsset();
        }
      }
      group.traverse(function(n) { 
        if (n.material) {
          var materials = (n.material instanceof THREE.MeshFaceMaterial ? n.material.materials : [n.material]);
          materials.forEach(function(m) {
            if (tex0) {
              m.transparent = true; 
              m.alphaTest = 0.4;
              m.map = tex0; 
            }
            if (m.map) {
              m.map.minFilter = minFilter;
              m.map.magFilter = magFilter;
            }
            //m.needsUpdate = true;
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
      var geo = new THREE.SphereGeometry(1);
      //geo.applyMatrix(new THREE.Matrix4().makeScale(1,1,.1));
      var mat = new THREE.MeshPhongMaterial({color: 0x999900, emissive: 0x333333});
      this.placeholder = new THREE.Mesh(geo, mat);
      return this.placeholder;
    },
    load: function() {
      if (this.src) {
        var loadargs = {src: this.getFullURL()};
        if (this.mtl) loadargs.mtl = this.getFullURL(this.mtl, this.getBaseURL(loadargs.src));
        this.loadWithWorker(loadargs);
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
    loadWithWorker: function(jobdata) {
      this._model = new THREE.Group();
      this._model.userData.loaded = false;
      elation.engine.assets.loaderpool.addJob(jobdata)
        .then(elation.bind(this, this.handleLoadJSON));
    },
    handleLoadJSON: function(json) {
      if (json) {
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
          n.userData.loaded = true;
          //n.add(scene.clone()); 
          this.fillGroup(n, scene);
          this.assignTextures(n);
          elation.events.fire({type: 'asset_load', element: n});
        }));
      }
    },
    extractTextures: function(scene) {
      var types = ['map', 'lightMap', 'normalMap', 'specularMap'];
      var textures = {};

      scene.traverse(function(n) { 
        if (n instanceof THREE.Mesh) {
          var materials = (n.material instanceof THREE.MultiMaterial || n.material instanceof THREE.MeshFaceMaterial ? n.material.materials : [n.material]);

          materials.forEach(function(material) {
            types.forEach(function(texname) { 
              var tex = material[texname];
              if (tex && tex.image) {
                var img = tex.image;
                if (!textures[img.src]) {
                  textures[img.src] = tex;
                  elation.events.add(img, 'load', function() { tex.needsUpdate = true; });
                } else {
                 material[texname] = textures[img.src];
                }
              }
            });
          });
        }
      });
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
      elation.net.get(url, null, { callback: elation.bind(this, function(data) {
        //console.log('got it', this, data);
        console.log('loaded:', url);
        this.loadJSON(JSON.parse(data));
      })});
    },
    loadJSON: function(json) {
      this.json = json;
      var baseurl = (this.baseurl && this.baseurl.length > 0 ? this.baseurl : this.getBaseURL());
      this.assets = [];
      json.forEach(elation.bind(this, function(assetdef) {
        assetdef.baseurl = baseurl;
        var asset = elation.engine.assets.get(assetdef);
        this.assets.push(asset);
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
    getAsset: function() {
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
    getAsset: function() {
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
});

