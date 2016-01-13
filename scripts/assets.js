elation.require([], function(elation) {
  elation.extend('engine.assets', {
    loadAssetPack: function(url) {
    },
    get: function(asset) {
      var type = asset.assettype || 'base';
      var assetclass = elation.engine.assets[type] || elation.engine.assets.unknown;
      return new assetclass(asset);
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

    load: function() {
      console.log('engine.assets.base load() should not be called directly', this);
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
        loader.load(this.src, elation.bind(this, this.handleLoad), elation.bind(this, this.handleProgress), elation.bind(this, this.handleError));
      }
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
    }
  }, elation.engine.assets.base);

  elation.define('engine.assets.model_collada', {
    assettype: 'model',
    src: false,
    modeltype: '',

    load: function() {
      elation.require(['engine.external.three.ColladaLoader'], elation.bind(this, function() {
        var loader = new THREE.ColladaLoader();
        console.log('load this model!', this);
        if (this.src) {
          loader.load(this.src, elation.bind(this, this.handleLoad));
        }
      }));
    },
    handleLoad: function(data) {
      console.log('collada loaded:', data);
    }
  }, elation.engine.assets.model);

  elation.define('engine.assets.pack', {
    assettype: 'pack',
    src: false,
    assets: [],
  
    load: function() {
      if (this.src) {
        this.loadURL(this.src);
      }
    },
    loadURL: function(url) {
      elation.net.get(url, null, { callback: elation.bind(this, function(data) {
        console.log('got it', this, data);
        this.loadJSON(JSON.parse(data));
      })});
    },
    loadJSON: function(json) {
      console.log('got some json data', json);
      this.assets = [];
      json.forEach(elation.bind(this, function(assetdef) {
        var asset = elation.engine.assets.get(assetdef);
        this.assets.push(asset);
        asset.load();
      }));
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

