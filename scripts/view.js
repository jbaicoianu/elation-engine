elation.component.add("engine.view", function() {
  //elation.implement(this, elation.engine.systems.system);
  this.effects = {};

  this.init = function() {
    elation.html.addclass(this.container, "engine_view");
    this.size = [0, 0];
    this.size_old = [0, 0];
    if (this.args.fullsize == 1) {
      elation.html.addclass(this.container, "engine_view_fullsize");
    }
    elation.events.add(window, "resize", this);
    if (!this.args.engine) {
      console.log("ERROR: couldn't create view, missing engine parameter");
    } else if (typeof elation.engine.instances[this.args.engine] == 'undefined') {
      console.log("ERROR: couldn't create view, engine '" + this.args.engine + "' doesn't exist");
    } else {
      //this.attach(elation.engine.instances[this.args.engine]);
      this.engine = elation.engine.instances[this.args.engine];

      this.create();
    }
  }
  this.create = function() {
    this.rendersystem = this.engine.systems.active.render;
    if (!this.rendersystem.renderer.domElement.parentNode) {
      this.container.appendChild(this.rendersystem.renderer.domElement);
    }
    this.rendersystem.view_add(this.id, this);

    var cam = new THREE.PerspectiveCamera(50, this.container.offsetWidth / this.container.offsetHeight, .1, 2000);
    cam.position.z = 50;
    cam.position.y = 10;
    this.setcamera(cam);
    this.setscene(this.engine.systems.active.world.scene['world-3d']);
    console.log(this.engine.systems.active.world.scene['world-3d']);

    this.composer = new THREE.EffectComposer(this.rendersystem.renderer);
    this.composer.addPass(new THREE.RenderPass(this.scene, this.camera, null, new THREE.Color(0xffffff), 0));

    this.effects['film']= new THREE.FilmPass( 0.35, .75, 2048, false );
    this.effects['sepia'] = new THREE.ShaderPass( THREE.SepiaShader );
    this.effects['bleach'] = new THREE.ShaderPass( THREE.BleachBypassShader );

    this.effects['FXAA'] = new THREE.ShaderPass( THREE.FXAAShader );
    this.effects['FXAA'].uniforms[ 'resolution' ].value.set( 1 / this.size[0], 1 / this.size[1]);
    this.effects['FXAA'].renderToScreen = true;

    //this.composer.addPass(this.effects['bleach']);
    //this.composer.addPass(this.effects['sepia']);
    //this.composer.addPass(this.effects['film']);
    this.composer.addPass( this.effects['FXAA'] );

    this.getsize();
  }
  this.render = function(delta) {
    if (this.scene && this.camera) {
      if (this.size[0] != this.size_old[0] || this.size[1] != this.size_old[1]) {
        this.setrendersize(this.size[0], this.size[1]);
      }
      //this.rendersystem.renderer.render(this.scene, this.camera);
      this.composer.render(delta);
    }
    this.size_old[0] = this.size[0];
    this.size_old[1] = this.size[1];
  }

  this.setcamera = function(camera) {
    this.camera = camera;
    this.setscene(this.getscene(camera));
  }
  this.setscene = function(scene) {
    this.scene = scene;
  }
  this.getscene = function(obj) {
    var scene = obj;

    while ( scene.parent !== undefined ) {
      scene = scene.parent;
    }
    if ( scene !== undefined && scene instanceof THREE.Scene )  {
      return scene;
    }
    return false;
  }
  this.getsize = function() {
    this.size = [this.container.offsetWidth, this.container.offsetHeight];
    this.setrendersize(this.size[0], this.size[1]);
    return this.size;
  }
  this.setrendersize = function(width, height) {
    this.rendersystem.renderer.setSize(width, height);  
    this.composer.setSize(width, height);
    if (this.effects['FXAA']) {
      this.effects['FXAA'].uniforms[ 'resolution' ].value.set( 1 / width, 1 / height);
    }
    if (this.camera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
  }
  this.system_attach = function(ev) {
    console.log('INIT: view (' + this.id + ')');

  }
  this.engine_start = function(ev) {
  }
  this.engine_frame = function(ev) {
    //var scene = this.engine.systems.active.world.scene['world-3d'];
    //console.log('FRAME: view (' + this.id + ")");
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: view (' + this.id + ')');
  }
  this.resize = function(ev) {
    this.getsize();
  }
});
