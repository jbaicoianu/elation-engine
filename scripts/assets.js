elation.require(['utils.workerpool'], function(elation) {

  elation.extend('engine.assets', {
    assets: {},
    types: {},
    loadAssetPack: function(url) {
      this.assetroot = new elation.engine.assets.pack({name: url, src: url});
      this.assetroot.load()
    },
    loadJSON: function(json, baseurl) {
      var assetroot = new elation.engine.assets.pack({name: "asdf", baseurl: baseurl, json: json});
    },
    get: function(asset) {
      var type = asset.assettype || 'base';
      var assetclass = elation.engine.assets[type] || elation.engine.assets.unknown;
      var assetobj = new assetclass(asset);

      if (!elation.engine.assets.types[type]) elation.engine.assets.types[type] = {};
      elation.engine.assets.assets[assetobj.name] = assetobj;
      elation.engine.assets.types[type][assetobj.name] = assetobj;
      return assetobj;
    },
    find: function(type, name) {
      var asset;
      if (elation.engine.assets.types[type]) {
        asset = elation.engine.assets.types[type][name];
      }
      //console.log(asset, type, name, elation.engine.assets.types[type]);
      if (asset) {
        return asset.getAsset();
      } else {
        asset = elation.engine.assets.get({assettype: type, name: name});
        return asset.getAsset();
      }
      return undefined;
    },
    loaderpool: new elation.utils.workerpool({src: '/scripts/engine/asset-worker.js', num: 4})
  });

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
    isSrcRelative: function(src) {
      if (src.match(/^https?:/) || src[0] == '/') {
        return false;
      }
      return true;
    },
    getFullURL: function(url) {
      if (!url) url = this.src;
      var fullurl = (this.isSrcRelative(url) ? this.baseurl + url : url);
      return fullurl;
    },
    getBaseURL: function() {
      var url = this.getFullURL();
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
    load: function() {
      var loader = new THREE.TextureLoader();
      loader.setCrossOrigin('');
      //console.log('load this image!', this);
      if (this.src) {
        var url = this.getFullURL();
        this._texture = loader.load(url, elation.bind(this, this.handleLoad), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
      }
    },
    handleLoad: function(data) {
      //console.log('loaded image', data);
      this._texture = data;
      data.image = this.scalePowerOfTwo(data.image);
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
console.log('fired', this._texture);
    },
    getAsset: function() {
      if (!this._texture) {
        this.load();
      }
      return this._texture;
    },
    scalePowerOfTwo: function(image) {
      if (!elation.engine.materials.isPowerOfTwo(image.width) || !elation.engine.materials.isPowerOfTwo(image.height)) {
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
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.video', {
    assettype: 'video',
    src: false,
    texture: false,
    load: function() {
      var video = document.createElement('video');
      video.src = this.src;
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
        group.add(this._model.clone());
        this.assignTextures(group);
      }
      this.instances.push(group);
      return group;
    },
    assignTextures: function(group) {
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
        group.traverse(function(n) { if (n.material) { n.material.transparent = true; n.material.map = tex0; if (n.material.color) n.material.color.setHex(0xffffff);} });
      }
    },
    createPlaceholder: function() {
      //var geo = new THREE.TextGeometry('loading...', { size: 1, height: .1, font: 'helvetiker' });
      var geo = new THREE.SphereGeometry(1);
      var mat = new THREE.MeshPhongMaterial({color: 0x999900, emissive: 0x333333});
      this.placeholder = new THREE.Mesh(geo, mat);
      return this.placeholder;
    },
    load: function() {
      if (this.src) {
        var loadargs = {src: this.getFullURL()};
        if (this.mtl) loadargs.mtl = this.getFullURL(this.mtl);
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
    loadWithWorker: function(url) {
      this._model = new THREE.Group();
      this._model.userData.loaded = false;
      elation.engine.assets.loaderpool.addJob(url)
        .then(elation.bind(this, this.handleLoadJSON));
    },
    loadCollada: function(url) {
      this._model = new THREE.Group();
      this._model.userData.loaded = false;

      elation.require(['engine.external.three.ColladaLoader'], elation.bind(this, function() {
        var loader = new THREE.ColladaLoader();
        loader.options.convertUpAxis = true;
        loader.options.upAxis = 'Y';
        console.log('load this model!', this);
        if (this.src) {
          if (this.compression == 'none') {
            loader.load(url, elation.bind(this, this.handleLoadCollada), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
          } else if (this.compression == 'gzip') {
            elation.net.get(url, null, { callback: elation.bind(this, function(data, xhr) {
              //var contents = JXG.decompress(data);
              var bufView = [];//new Uint16Array(buf);
              for (var i=0, strLen=data.length; i<strLen; i++) {
                bufView[i] = data.charCodeAt(i);
              }
              //var contents = (new JXG.Util.Unzip(bufView)).unzip();
              //var contents = unescape( (new JXG.Util.Unzip(data)).unzip()[0][0]);

              console.log('WARNING - gzipped models not supported yet!', url);
            }) });
          }
        }
      }));

    },
    handleLoadCollada: function(data) {
      console.log('collada loaded:', data);
      this.removePlaceholders();
      this._model.userData.loaded = true;
      this._model.add(data.scene);
      this.instances.forEach(elation.bind(this, function(n) { 
        n.userData.loaded = true;
        n.add(data.scene.clone()); 
        this.assignTextures(n);
        elation.events.fire({type: 'asset_load', element: n});
      }));
    },
    handleLoadJSON: function(json) {
console.log('json loaded', json);
      var parser = new THREE.ObjectLoader();
      var scene = parser.parse(json);
      
      this.removePlaceholders();
      this._model.userData.loaded = true;
      this._model.add(scene);
      this.instances.forEach(elation.bind(this, function(n) { 
        n.userData.loaded = true;
        n.add(scene.clone()); 
        this.assignTextures(n);
        elation.events.fire({type: 'asset_load', element: n});
      }));
    },
    loadOBJ: function(url) {
      this._model = new THREE.Group();
      this._model.userData.loaded = false;
/*
      elation.require(['engine.external.three.OBJLoader', 'engine.external.three.OBJMTLLoader', 'engine.external.three.MTLLoader'], elation.bind(this, function() {
        var loader = (this.mtl ? new THREE.OBJMTLLoader() : new THREE.OBJLoader());
        loader.setCrossOrigin('');
        //console.log('load obj model!', this, loader);
        if (this.src) {
          if (this.corsproxy) {
            url = '/engine/cors.raw?url=' + encodeURIComponent(url);
          }
          //var mtlurl = url.replace('.obj', '.mtl');
          if (this.mtl) {
            loader.load(url, this.getFullURL(this.mtl), elation.bind(this, this.handleLoadOBJ), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
          } else {
            loader.load(url, elation.bind(this, this.handleLoadOBJ), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
          }
        }
      }));
*/
    },
    handleLoadOBJ: function(data) {
      //console.log('obj loaded:', data);
      this.removePlaceholders();
      this._model.userData.loaded = true;
      while (data.children.length > 0) {
        var obj = data.children[0];
        data.remove(obj);
        this._model.add(obj);

        this.instances.forEach(elation.bind(this, function(n) { 
          n.add(obj.clone()); 
          n.userData.loaded = true;
          this.assignTextures(n);
          elation.events.fire({type: 'asset_load', element: n});
        }));
      }
    },
    handleProgress: function(ev) {
      //console.log('model progress!', ev);
    },
    handleError: function(ev) {
      console.log('model uh oh!', ev);
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

