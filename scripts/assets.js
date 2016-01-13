elation.require([], function(elation) {
  elation.extend('engine.assets', {
    assets: {},
    types: {},
    loadAssetPack: function(url) {
      this.assetroot = new elation.engine.assets.pack({name: url, src: url});
      this.assetroot.load()
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
      var asset = elation.engine.assets.types[type][name];
      if (asset) {
        return asset.getAsset();
      }
      return undefined;
    }
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

    load: function() {
      console.log('engine.assets.base load() should not be called directly', this);
    },
    isSrcRelative: function(src) {
      if (src.match(/^https?:/) || src[0] == '/') {
        return false;
      }
      return true;
    },
    getFullURL: function() {
      var url = (this.isSrcRelative(this.src) ? this.baseurl + this.src : this.src);
      return url;
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
      console.log('load this image!', this);
      if (this.src) {
        var url = this.getFullURL();
        this._texture = loader.load(url, elation.bind(this, this.handleLoad), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
      }
    },
    handleLoad: function(data) {
      console.log('loaded image', data);
      this._texture = data;
      this.loaded = true;
    },
    handleProgress: function(ev) {
      console.log('image progress!', ev);
    },
    handleError: function(ev) {
      console.log('image uh oh!', ev);
      this._texture = false;
    },
    getAsset: function() {
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

  elation.define('engine.assets.model', {
    assettype: 'model',
    src: false,
    modeltype: '',

    load: function() {
      console.log('load this model!', this);
    },
    getAsset: function() {
      if (!this._model) {
        this.load();
      }
      return this._model;
    },
  }, elation.engine.assets.base);

  elation.define('engine.assets.model_collada', {
    assettype: 'model',
    src: false,
    modeltype: '',

    load: function() {
      this._model = new THREE.Group();
      elation.require(['engine.external.three.ColladaLoader'], elation.bind(this, function() {
        var loader = new THREE.ColladaLoader();
        console.log('load this model!', this);
        if (this.src) {
          var url = this.getFullURL();
          loader.load(url, elation.bind(this, this.handleLoad));
        }
      }));
    },
    handleLoad: function(data) {
      console.log('collada loaded:', data);
      while (data.scene.children.length > 0) {
        var obj = data.scene.children[0];
        data.scene.remove(obj);
        this._model.add(obj);
      }
    }
  }, elation.engine.assets.model);
  elation.define('engine.assets.model_obj', {
    assettype: 'model',
    src: false,
    modeltype: '',

    load: function() {
      this._model = new THREE.Group();
      elation.require(['engine.external.three.OBJLoader'], elation.bind(this, function() {
        var loader = new THREE.OBJLoader();
        console.log('load obj model!', this);
        if (this.src) {
          var url = this.getFullURL();
          loader.load(url, elation.bind(this, this.handleLoad));
        }
      }));
    },
    handleLoad: function(data) {
      console.log('obj loaded:', data);
      while (data.children.length > 0) {
        var obj = data.children[0];
        data.remove(obj);
        this._model.add(obj);
      }
    }
  }, elation.engine.assets.model);

  elation.define('engine.assets.pack', {
    assettype: 'pack',
    src: false,
    assets: [],
  
    load: function() {
      if (this.src) {
        var url = this.getFullURL();
        this.loadURL(url);
      }
    },
    loadURL: function(url) {
      elation.net.get(url, null, { callback: elation.bind(this, function(data) {
        console.log('got it', this, data);
        this.loadJSON(JSON.parse(data));
      })});
    },
    loadJSON: function(json) {
      var baseurl = this.getBaseURL();
      console.log('got some json data', json, baseurl);
      this.assets = [];
      json.forEach(elation.bind(this, function(assetdef) {
        assetdef.baseurl = baseurl;
        var asset = elation.engine.assets.get(assetdef);
        this.assets.push(asset);
        asset.load();
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

