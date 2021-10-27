  if (typeof THREE == 'undefined') {
    THREE = {};
  }

elation.require([
  "engine.external.three.three",
  "engine.external.three.three-objects",
  "engine.external.three.three-controls",
  "engine.external.three.three-postprocessing",
  "engine.external.three.three-shaders",
  "engine.external.three.three-extras",
  "engine.external.three.CSS3DRenderer",
  "engine.external.three.CubemapToEquirectangular",

  "engine.external.webxr-polyfill",

  "engine.materials",
  "engine.geometries",
  //"ui.select",
  //"ui.slider",
  'ui.base',
], function() {
  elation.requireCSS('engine.systems.render');

  elation.extend("engine.systems.render", function(args) {
    elation.implement(this, elation.engine.systems.system);
    this.views = {};
    this.forcerefresh = false;

    this.view_init = function(viewname, viewargs) {
      var newview = new elation.engine.systems.render.view(viewargs);
      return this.view_add(viewname, newview);
    }
    this.view_add = function(viewname, view) {
      this.views[viewname] = view;
      elation.events.fire({type: 'render_view_add', element: this, data: this.views[viewname]});
      return this.views[viewname];
    }
    this.view_remove = function(viewname) {
      if (viewname in this.views) {
        this.views[viewname].destroy();
        delete this.views[viewname];
      }
    }

    this.system_attach = function(ev) {
      console.log('INIT: render');

      let webglmode = 'webgl';
      let rendererargs = {
        antialias: true,
        logarithmicDepthBuffer: false,
        alpha: true,
        preserveDrawingBuffer: true,
        enableWebXR: false,
        stencil: false
      };
      if (webglmode == 'webgl2') {
        rendererargs.canvas = document.createElement( 'canvas' );
        rendererargs.context = rendererargs.canvas.getContext( 'webgl2', { antialias: true } );
      }
      this.renderer = new THREE.WebGLRenderer(rendererargs);
      this.cssrenderer = new THREE.CSS3DRenderer();
      //this.renderer.autoClear = true;
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.xr.enabled = false;
      //this.renderer.xr.manageCameraPosition = true;
      this.lastframetime = performance.now();
      this.renderer.setAnimationLoop((time, frame) => {
        this.render(time - this.lastframetime, frame);
        this.lastframetime = time;
      });
      //this.renderer.setAnimationLoop((ev) => { this.render(); });

      //this.renderer.gammaInput = true;
      //this.renderer.gammaOutput = false;
      //this.renderer.outputEncoding = THREE.LinearEncoding;
      //this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.outputEncoding = THREE.LinearEncoding;
      this.renderer.gammaFactor = 1;

/*
      this.renderer.toneMapping = THREE.CineonToneMapping;
      this.renderer.toneMappingExposure = 1;
      this.renderer.toneMappingWhitePoint = 1;
*/

      this.renderer.debug.checkShaderErrors = false;

      this.lastframetime = 0;

      elation.events.add(this.engine.systems.world, 'world_change,world_thing_add,world_thing_remove,world_thing_change', this);

      // FIXME - globally-bound events are dirty, things should fire events when their properties change
      elation.events.add(null, 'physics_update,thing_drag_move,thing_rotate_move,engine_texture_load', elation.bind(this, this.setdirty));

      // Hide the canvas from accessibility API
      this.renderer.domElement.setAttribute('aria-hidden', true);
    }
    this.setclearcolor = function(color, opacity) {
      if (typeof color == 'undefined') color = 0xffffff;
      if (typeof opacity == 'undefined') opacity = 1;
      this.renderer.setClearColor(color, opacity);
    }
    this.setdirty = function() {
      this.dirty = true;
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: render');
      for (var k in this.views) {
        this.views[k].destroy();
      };
    }
    this.engine_frame = function(ev) {
      // Disabled rendering on engine_frame, use Three's setAnimationLoop instead
      //this.lastframetime += ev.data.delta;
      //this.render();
    }
    this.render = function(time, frame) {
      for (var k in this.views) {
        this.views[k].updatePickingObject();
        if (this.views[k].stats) {
          this.views[k].stats.update();
        }
      }
      this.engine.advance();
      if (this.forcerefresh || this.dirty) {
        //console.log('FRAME: render');
        this.dirty = false;
        //this.renderer.clear();
        for (var k in this.views) {
          this.views[k].render(time, frame);
        }
        //this.lastframetime = 0;
      }
    }
    this.textureSampleMipmapLevel = (function() {
      let scene = new THREE.Scene();
      let plane = new THREE.PlaneBufferGeometry(2, 2);
      let material = new THREE.MeshBasicMaterial({color: 0xffffff});
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(0,0,-1);
      scene.add(mesh);
      let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
      scene.add(camera);
      let rendertarget = new THREE.WebGLRenderTarget(1, 1);
      let oldviewport = new THREE.Vector4();
      let viewport = new THREE.Vector4(0, 0, 1, 1);
      return function(texture, level=0) {
        material.map = texture;
        material.map.needsUpdate = true;

        let size = Math.pow(2, level);
        rendertarget.setSize(size, size);

        let renderer = this.renderer;
        let pixeldata = new Uint8Array(4 * size * size);
        let oldrendertarget = renderer.getRenderTarget();

        let oldencoding = texture.encoding;
        texture.encoding = THREE.LinearEncoding;

        renderer.getViewport(oldviewport);
        renderer.setViewport(viewport);
        renderer.setRenderTarget(rendertarget);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(rendertarget, 0, 0, size, size, pixeldata);
        renderer.setRenderTarget(oldrendertarget);
        renderer.setViewport(oldviewport);

        texture.encoding = oldencoding;

        return pixeldata;
      }
    })();
    this.textureHasAlpha = (function() {
      let scene = new THREE.Scene();
      let plane = new THREE.PlaneBufferGeometry(2, 2);
      let material = new THREE.MeshBasicMaterial({color: 0xff0000});
      let mesh = new THREE.Mesh(plane, material);
      mesh.position.set(0,0,-1);
      scene.add(mesh);
      let camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
      scene.add(camera);
      let rendertarget = new THREE.WebGLRenderTarget(1, 1);
      let oldviewport = new THREE.Vector4();
      let viewport = new THREE.Vector4(0, 0, 1, 1);

      return function(texture) {
        material.map = texture;
        material.map.needsUpdate = true;
        let renderer = this.renderer;
        let pixeldata = new Uint8Array(4);
        let oldrendertarget = renderer.getRenderTarget();
        renderer.getViewport(oldviewport);
        renderer.setViewport(viewport);
        renderer.setRenderTarget(rendertarget);
        renderer.render(scene, camera);
        renderer.readRenderTargetPixels(rendertarget, 0, 0, 1, 1, pixeldata);
        renderer.setRenderTarget(oldrendertarget);
        renderer.setViewport(oldviewport);
        return pixeldata[3] < 255;
      }
    })()
    this.world_thing_add = function(ev) {
      this.setdirty();
    }
    this.world_thing_remove = function(ev) {
      this.setdirty();
    }
    this.world_thing_change = function(ev) {
      this.setdirty();
    }
    this.world_change = function(ev) {
      this.setdirty();
    }
  });

  elation.component.add("engine.systems.render.view", function() {
    //elation.implement(this, elation.engine.systems.system);
    this.effects = {};
    this.defaultcontainer = { tag: 'div' };

    this.init = function() {
      elation.html.addclass(this.container, "engine_view");
      this.picking = this.args.picking || false;
      this.useWebXRPolyfill = elation.utils.any(this.args.useWebXRPolyfill, true);
      this.size = [0, 0];
      this.size_old = [0, 0];
      this.scale = 100;// * devicePixelRatio;
      this.showstats = this.args.showstats || false;
      this.fullscreen = false;
      this.renderpasses = {};
      this.aspectscale = 1;
      this.renderinfo = {render: {}, memory: {}};

      // Used by various render pass shaders
      this.sizevec = new THREE.Vector2();
      this.sizevecinverse = new THREE.Vector2();

      this.rendermode = this.args.rendermode || 'default';

      if (this.args.fullsize == 1) {
        elation.html.addclass(this.container, "engine_view_fullsize");
      }
      if (this.args.resolution) {
        elation.html.addclass(this.container, "engine_view_fixedsize");
      }
      if (this.args.crosshair == 1) {
        elation.html.create({tag: 'div', classname: 'engine_view_crosshair', append: this.container});
      }
      this.container.tabIndex = 1;
      if (!this.args.engine) {
        console.log("ERROR: couldn't create view, missing engine parameter");
      } else if (typeof elation.engine.instances[this.args.engine] == 'undefined') {
        console.log("ERROR: couldn't create view, engine '" + this.args.engine + "' doesn't exist");
      } else {
        this.engine = elation.engine.instances[this.args.engine];
        this.create();
      }
      this.canvas = this.rendersystem.renderer.domElement;
      elation.events.add(window, "resize", this);
      elation.events.add(document.body, "mouseenter,mouseleave", this);
      elation.events.add(this.canvas, "mouseover,mousedown,mousemove,mouseup,click", this);
      elation.events.add(this.canvas, "mousewheel,touchstart,touchmove,touchend", this);
      elation.events.add(document, "pointerlockchange,mozpointerlockchange", elation.bind(this, this.pointerlockchange));
      elation.events.add(this.container, "dragover,drag,dragenter,dragleave,dragstart,dragend,drop", elation.bind(this, this.proxyEvent));
    }
    this.create = function() {
      this.rendersystem = this.engine.systems.render;

      if (this.rendersystem.renderer.domElement && !this.rendersystem.renderer.domElement.parentNode) {
        this.container.appendChild(this.rendersystem.renderer.domElement);
      }
      if (this.rendersystem.cssrenderer && !this.rendersystem.cssrenderer.domElement.parentNode) {
        this.container.appendChild(this.rendersystem.cssrenderer.domElement);
        elation.html.addclass(this.rendersystem.cssrenderer.domElement, 'engine_systems_render_css3d');
      }

      if (this.args.xrsession) {
        this.setXRSession(this.args.xrsession);
      }

      this.rendersystem.view_add(this.id, this);

      var cam = new THREE.PerspectiveCamera(75, 4/3, 1e-2, 1e4);
      this.actualcamera = cam;

      this.setcamera(cam);

      if (this.pickingdebug) {
        this.setscene(this.engine.systems.world.scene['colliders']);
      } else {
        this.setscene(this.engine.systems.world.scene['world-3d']);
      }
      if (this.engine.systems.world.scene['sky']) {
        this.setskyscene(this.engine.systems.world.scene['sky']);
      }
      //console.log(this.engine.systems.world.scene['world-3d']);

      // Depth shader, used for SSAO, god rays, etc
      var depthShader = THREE.ShaderLib[ "depth" ];
      var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );

      this.depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
      this.depthMaterial.blending = THREE.NoBlending;
      this.depthTarget = new THREE.WebGLRenderTarget( this.size[0], this.size[1], {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });

      //this.composer = this.createRenderPath([this.rendermode]);
      this.rendertarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.FloatType,
        stencilBuffer: true,
        depthBuffer: true,
      });
      this.rendertarget.texture.encoding = THREE.sRGBEncoding;
      this.rendertarget.depthTexture = new THREE.DepthTexture();
      this.rendertarget.depthTexture.type = THREE.UnsignedInt248Type;
      this.rendertarget.depthTexture.format = THREE.DepthStencilFormat;
      //this.composer = this.createRenderPath(['clear', /*'portals', 'masktest',*/ this.rendermode, 'fxaa'/*, 'msaa'*/, 'bloom', 'maskclear', 'recording'], this.rendertarget);
      this.composer = this.createRenderPath(['clear', this.rendermode,/* 'tonemapping',*/ 'unrealbloom', 'fxaa', 'gamma'], this.rendertarget);
      //this.composer = this.createRenderPath(['clear', this.rendermode, 'fxaa'/*, 'msaa'*/, 'bloom', 'maskclear'], this.rendertarget);
      //this.effects['msaa'].enabled = false;
      //this.composer = this.createRenderPath([this.rendermode, 'ssao', 'recording']);
      if (this.showstats) {
        // FIXME - not smart!
        elation.events.add(this.composer.passes[3], 'render', elation.bind(this, this.updateRenderStats));
      }

      this.getsize();

      if (this.showstats) {
        this.stats = new Stats();
        this.stats.domElement.style.position = 'absolute';
        this.stats.domElement.style.top = '0px';
        this.stats.domElement.style.right = '0px';
        this.container.appendChild(this.stats.domElement);

        this.renderstats = new THREEx.RendererStats()
        this.renderstats.domElement.style.position = 'absolute'
        this.renderstats.domElement.style.right = '0px'
        this.renderstats.domElement.style.top = '50px'
        this.container.appendChild( this.renderstats.domElement )
      }

      this.glcontext = this.rendersystem.renderer.getContext();

      elation.events.add(this.rendersystem.renderer.domElement, 'webglcontextlost', elation.bind(this, function(ev) {
        console.log('ERROR - context lost!  Can we handle this somehow?');
        ev.preventDefault();
        this.engine.stop();
      }));
      elation.events.add(this.rendersystem.renderer.domElement, 'webglcontextrestored', elation.bind(this, function(ev) {
        console.log('context restored');
        ev.preventDefault();
        this.engine.start();
      }));

      if (this.picking) {
        this.mousepos = [0, 0, document.body.scrollTop];
        this.lastmousepos = [-1, -1, -1];
        this.initPicking();

        this.pickingdebug = false;

        this.engine.systems.controls.addCommands('view', {
          'picking_debug': elation.bind(this, function(ev) { 
            if (ev.value == 1) { 
              this.pickingdebug = !this.pickingdebug; 
              this.rendersystem.dirty = true; 
              if (this.pickingdebug) {
                this.engine.systems.world.enableDebug();
              } else {
                this.engine.systems.world.disableDebug();
              }
            } 
          }),
          'picking_select': elation.bind(this, function(ev) {
            if (ev.value == 1) {
              this.click({clientX: this.mousepos[0], clientY: this.mousepos[1]});
            }
          })
        });
        this.engine.systems.controls.addBindings('view', {'keyboard_f7': 'picking_debug'});
        this.engine.systems.controls.addBindings('view', {'gamepad_any_button_0': 'picking_select'});
        this.engine.systems.controls.activateContext('view');
      }
    }
    this.destroy = function() {
      // TODO - deeallocate resources
    }
    this.createRenderPath = function(passes, target) {
      // this.createRenderPath(['picking', 'oculus_deform'], depthTarget)
      // this.createRenderPath(['depth', 'oculus_deform'], pickingTarget)
      // this.createRenderPath(['sky', 'default', 'FXAA', 'oculus_deform', 'oculus_colorshift'])
      var composer = new THREE.EffectComposer(this.rendersystem.renderer, target);

      var renderToScreen = false;
      for (var i = 0; i < passes.length; i++) {
        var pass = this.createRenderPass(passes[i]);
        //console.log('NEW PASS:', i, target, passes[i], pass);
        if (pass) {
          //if (i == 0) pass.clear = true;
          composer.addPass(pass);
          renderToScreen = renderToScreen || pass.renderToScreen;

          // Only store pass data for the main path
          if (!target) {
            this.renderpasses[passes[i]] = pass;
          }
        }
      }
      //if (!target && !renderToScreen) {
        var pass = this.createRenderPass('screenout');
        composer.addPass(pass);
      //}

      return composer;
    }
    this.createRenderPass = function(name, args) {
      var pass = false;
      switch (name) {
        case 'default':
          pass = new THREE.RenderPass(this.scene, this.actualcamera, null, null, 1);
          pass.clear = false;
          break;
        case 'normalmap':
          pass = new THREE.RenderPass(this.scene, this.actualcamera, new THREE.MeshNormalMaterial(), null, 1);
          pass.clear = false;
          break;
        case 'depth':
          pass = new THREE.RenderPass(this.scene, this.actualcamera, new THREE.MeshDepthMaterial(), null, 1);
          pass.clear = false;
          break;
        case 'portals':
          pass = new THREE.PortalRenderPass(this.actualcamera);
          pass.clear = false;
          this.portalpass = pass;
          break;
        case 'clear':
          var pass = new THREE.ClearPass();
          break;
        case 'oculus':
          pass = new THREE.OculusRenderPass(this.scene, this.actualcamera, null, null, 0);
          pass.setOculusParameters({
            HMD: {
              hResolution: window.innerWidth,
              vResolution: window.innerHeight,
              hScreenSize: 0.14976,
              vScreenSize: 0.0936,
              interpupillaryDistance: 0.064,
              lensSeparationDistance: 0.064,
              eyeToScreenDistance: 0.041,
              distortionK : [1.0, 0.0, 0.0, 0.0],
              chromaAbParameter: [ 1, 0, 1, 0.0]
            }
          });
          break;
        case '3dtvsbs':
          pass = new THREE.OculusRenderPass(this.scene, this.actualcamera, null, null, 0);
          pass.setOculusParameters({
            HMD: {
              hResolution: window.innerWidth,
              vResolution: window.innerHeight,
              hScreenSize: 0.14976,
              vScreenSize: 0.0936,
              interpupillaryDistance: 0.064,
              lensSeparationDistance: 0.064,
              eyeToScreenDistance: 0.041,
              distortionK : [1.0, 0.0, 0.0, 0.0],
              chromaAbParameter: [ 1, 0, 1, 0.0]
            }
          });
          break;
        case 'sky':
          pass = new THREE.RenderPass(this.skyscene, this.skycamera, null, null, 0);
          pass.clear = false;
          break;
        case 'film':
          pass = new THREE.FilmPass( 0.35, .75, 2048, false );
          break;
        case 'recording':
          pass = new THREEcapRenderPass('/scripts/engine/external/threecap/');
          this.recorder = pass;
          break;
        case 'sepia':
          pass = new THREE.ShaderPass( THREE.SepiaShader );
          break;
        case 'bleach':
          pass = new THREE.ShaderPass( THREE.BleachBypassShader );
          break;
        case 'copy':
          pass = new THREE.ShaderPass( THREE.CopyShader );
          break;
        case 'screenout':
          pass = new THREE.ShaderPass( THREE.CopyShader );
          pass.renderToScreen = true;
          break;
        case 'bloom':
          pass = new THREE.BloomPass(0.4, 25, 5);
          break;
        case 'unrealbloom':
          pass = new THREE.UnrealBloomPass(this.size, 0, 0, 0);
          break;
        case 'fxaa':
          pass = new THREE.ShaderPass( THREE.FXAAShader );
          pass.uniforms[ 'resolution' ].value = this.sizevecinverse;
          break;
        case 'msaa':
          pass = new THREE.ManualMSAARenderPass(this.scene, this.actualcamera);
          pass.unbiased = true;
          pass.sampleLevel = 1;
          break;
        case 'masktest':
          this.maskscene = new THREE.Scene();
          var maskobj = new THREE.Mesh(new THREE.SphereGeometry(1000));
maskobj.scale.y = -1;
          maskobj.position.set(0,0,0);
window.maskobj = maskobj;
          this.maskscene.add(maskobj);
          pass = new THREE.MaskPass(this.maskscene, this.actualcamera);
          pass.clear = false;
          break;
        case 'maskclear':
          pass = new THREE.ClearMaskPass();
          break;
        case 'ssao':
          pass = new THREE.SSAOPass( this.scene, this.actualcamera, this.size[0], this.size[1] );
          pass.kernelRadius = 16;
          //pass.clear = true;
          break;
        case 'gamma':
          pass = new THREE.ShaderPass( THREE.GammaCorrectionShader );
          break;
        case 'tonemapping':
          pass = new THREE.AdaptiveToneMappingPass(true, 256);
          break;
      }
      if (pass) this.effects[name] = pass;
      return pass;
    }
    this.setRenderMode = function(mode) {
      // Supported values: 'default', 'oculus'

      var lastpass = this.renderpasses[this.rendermode];
      var pass = this.renderpasses[mode];
      if (!pass) {
        pass = this.createRenderPass(mode);
        this.renderpasses[mode] = pass;
      }

      var passidx = this.composer.passes.indexOf(lastpass);
console.log('toggle render mode: ' + this.rendermode + ' => ' + mode, passidx, lastpass, pass, this.renderpasses);

      this.composer.passes[passidx] = pass;
      if (this.pickingcomposer) this.pickingcomposer.passes[passidx] = pass;
      pass.camera = this.actualcamera;

      elation.html.removeclass(this.container, "engine_view_rendermode_" + this.rendermode);
      this.rendermode = mode;
      elation.html.addclass(this.container, "engine_view_rendermode_" + this.rendermode);


      this.rendersystem.setdirty();
    }
    this.isFullscreen = function() {
      var fsel = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
      if (fsel) {
        return true;
      }
      return false;
    }
    this.toggleFullscreen = function(fullscreen) {
      if (typeof fullscreen == 'undefined') {
        fullscreen = !this.isFullscreen();
      } else if (typeof fullscreen.data != 'undefined') {
        fullscreen = fullscreen.data;
      }
      
      if (fullscreen) {
        //var c = this.container;
        var c = document.documentElement;
        c.requestFullscreen = c.requestFullscreen || c.webkitRequestFullscreen || c.mozRequestFullScreen;
        if (typeof c.requestFullscreen == 'function') {
          c.requestFullscreen();
        }
      } else {
        var fsel = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
        if (fsel) {
          document.exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen || document.mozExitFullScreen;
          document.exitFullscreen();
        }
      }
      this.fullscreen = fullscreen;
    }
    this.startXR = function(mode='immersive-vr') {
    }
    this.setXRSession = async function(session) {
      this.xrsession = session;
      await this.rendersystem.renderer.xr.setSession(session);
      this.rendersystem.renderer.xr.enabled = true;

      this.rendersystem.renderer.outputEncoding = THREE.sRGBEncoding;
      this.xrlayer = this.getXRBaseLayer(session);
      if (false && !this.xrscene) {
        // Set up a scene with an ortho camera to clone our XR framebuffer to, for display on the main screen
        this.xrscene = new THREE.Scene();
        this.xrscene.background = new THREE.Color(0x000000);

        // Set up texture to copy the framebuffer into
        let w = this.xrlayer.framebufferWidth,
            h = this.xrlayer.framebufferHeight;
        let data = new Uint8Array( w * h * 3 );
        this.xrscenetexture = new THREE.DataTexture( data, w, h, THREE.RGBFormat );
        this.xrscenetexture.minFilter = THREE.NearestFilter;
        this.xrscenetexture.magFilter = THREE.NearestFilter;

        // Set up the plane to render only one eye, centered in the middle of the screen
        this.xrsceneplane = new THREE.Mesh(new THREE.PlaneBufferGeometry(w, h), new THREE.MeshBasicMaterial({map: this.xrscenetexture, side: THREE.DoubleSide, color: 0xffffff}));
        this.xrsceneplane.position.set(w / 4, 0, -10);
        //this.xrsceneplane.rotation.set(Math.PI/4, 0, 0);
        this.xrscene.add(this.xrsceneplane);
        this.xrscenecam = new THREE.OrthographicCamera(-w / 4, w, h, -h / 2, -1000, 1000);
        //this.xrscenecam = new THREE.PerspectiveCamera();
        this.xrscene.add(this.xrscenecam);
      }
    }
    this.handleXRFrame = function(session, frame) {
      if (session) {
        this.xrsession = session;
        if (this.activething && this.activething.updateXR) {
          this.activething.updateXR(frame);
        }
        let xrReferenceSpace =  this.engine.systems.render.renderer.xr.getReferenceSpace();
        elation.events.fire({ element: this.engine, type: 'xrframe', data: { frame, session, xrReferenceSpace } });
      }
    }
    this.stopXR = function() {
      if (this.xrsession) {
        this.xrsession.end();
      }
    }
    this.handleXRend = function(ev) {
      this.rendersystem.renderer.xr.setSession(null);
      this.rendersystem.renderer.xr.enabled = false;
      this.enabled = false;
      elation.html.removeclass(this.container, 'webxr_session_active');
      this.xrsession = false;
      this.rendersystem.renderer.outputEncoding = THREE.LinearEncoding;
      setTimeout(() => {
        elation.events.fire({type: 'resize', element: window, data: true });
      }, 100);
    }
    this.getXRBaseLayer = function(session) {
      if (session.renderState.layers && session.renderState.layers.length > 0) {
        return session.renderState.layers[session.renderState.layers.length - 1];
      }
      return session.renderState.baseLayer;
    }
    this.updateCameras = (function() {
      // Closure scratch variables
      var _position = new THREE.Vector3(),
          _quaternion = new THREE.Quaternion(),
          _scale = new THREE.Vector3();
      
      return function() {
        // Make sure the parent's matrixWorld is up to date
        if (this.camera.parent) {
          this.camera.parent.updateMatrix(true);
          this.camera.parent.updateMatrixWorld(true);
        }
        if (this.actualcamera) {
          // Copy this.camera's position/orientation/scale/parent to our actual camera
          if (this.actualcamera.parent && this.actualcamera.parent != this.camera.parent) {
            this.actualcamera.parent.remove(this.actualcamera);
          } 
          if (this.camera.parent && this.actualcamera.parent != this.camera.parent) {
            this.camera.parent.add(this.actualcamera);
          }
          this.actualcamera.position.copy(this.camera.position);
          this.actualcamera.scale.copy(this.camera.scale);
          this.actualcamera.rotation.copy(this.camera.rotation);
          this.actualcamera.quaternion.copy(this.camera.quaternion);

          if (this.actualcamera.fov != this.camera.fov ||
              this.actualcamera.near != this.camera.near ||
              this.actualcamera.far != this.camera.far ||
              this.actualcamera.aspect != this.camera.aspect) {
          
            this.actualcamera.fov = this.camera.fov;
            this.actualcamera.near = this.camera.near || 0.001;
            this.actualcamera.far = this.camera.far || 10000;
            this.actualcamera.aspect = this.camera.aspect;

            this.actualcamera.updateProjectionMatrix();
          }
          this.actualcamera.layers.mask = this.camera.layers.mask;
        }
        if (this.skycamera) {
          // Sky camera needs to use our camera's world rotation, and nothing else
          this.camera.matrixWorld.decompose( _position, _quaternion, _scale );
          
          this.skycamera.quaternion.copy(_quaternion);

          if (this.skycamera.fov != this.camera.fov || this.skycamera.aspect != this.camera.aspect) {
            this.skycamera.fov = this.camera.fov;
            this.skycamera.aspect = this.camera.aspect;
            this.skycamera.updateProjectionMatrix();
          }
        }
      }
    })();
    this.render = function(delta, xrframe) {
      if (this.enabled && this.scene && this.camera) {
        if (xrframe && this.xrsession) {
          this.handleXRFrame(this.xrsession, xrframe);
        }
        if (this.size[0] != this.size_old[0] || this.size[1] != this.size_old[1] || this.scale != this.scale_old) {
          this.setrendersize(this.size[0], this.size[1]);
        }
        this.updateCameras();

        //this.setcameranearfar();

        elation.events.fire({type: 'render_view_prerender', element: this});

        if (this.picking && this.pickingactive) {
          //if (this.pickingdebug || this.picknum++ % 3 == 0 || delta > 0.05) {
            this.updatePickingTarget();
          //}
        }
        /*
        this.scene.overrideMaterial = this.depthMaterial;
        //this.rendersystem.renderer.render(this.scene, this.actualcamera, this.depthTarget, true);

        this.scene.overrideMaterial = null;
        */
        //this.rendersystem.renderer.render(this.scene, this.actualcamera);

        this.effects[this.rendermode].camera = this.actualcamera;

        let colliderscene = this.engine.systems.world.scene['colliders'],
            worldscene = this.engine.systems.world.scene['world-3d'];
        if (this.pickingdebug) {
          if (colliderscene.parent !== worldscene) {
            worldscene.add(colliderscene);
          }
        } else if (colliderscene.parent === worldscene) {
          worldscene.remove(colliderscene);
        }
        if (this.args.enablePostprocessing) {
          this.composer.render(delta);
        } else {
          if (this.xrsession) {
            //this.rendersystem.renderer.xr.enabled = true;
            //this.rendersystem.renderer.xr.setSession(this.xrsession);
            let layer = this.getXRBaseLayer(this.xrsession);
            if (layer) {
              this.xrlayer = layer;
              let renderer = this.rendersystem.renderer;
              renderer.clear();
              renderer.render(this.scene, this.camera);

              if (false && document.visibilityState == 'visible') { 
                if (true) {
                  //console.log('try to clone framebuffer onto screen', this.xrscene, this.xrscenecam, this.xrsceneplane.material.map);
/*
                  if (!this.xrsceneplane.material.map) {
                    console.log('update framebuffer texture');
                    this.xrsceneplane.material.map = new THREE.Texture(layer.framebuffer);
                    this.xrsceneplane.material.needsUpdate = true;
                  }
*/
                  renderer.xr.enabled = false;
                  renderer.copyFramebufferToTexture( V(layer.framebufferWidth / 2, 0, 0), this.xrscenetexture );
                  //renderer.setFramebuffer(null);
                  renderer.state.bindXRFramebuffer(null);
                  renderer.setRenderTarget( renderer.getRenderTarget() );

                  let oldOutputEncoding = renderer.outputEncoding;
                  renderer.outputEncoding = THREE.LinearEncoding;
                  renderer.setViewport(0, 0, layer.framebufferWidth, layer.framebufferHeight);
                  renderer.render(this.xrscene, this.xrscenecam);
                  renderer.xr.enabled = true;
                  renderer.outputEncoding = oldOutputEncoding;
                } else {
                  // FIXME - cloning the framebuffer to the main canvas output isn't working right as implemented, so in this codepath we just double-render
                  //this.rendersystem.renderer.setFramebuffer(null);
                  renderer.state.bindXRFramebuffer(null);
                  renderer.setRenderTarget( renderer.getRenderTarget() );
                  this.rendersystem.renderer.render(this.scene, this.camera);

                  //this.rendersystem.renderer.setFramebuffer(layer.framebuffer);
                  renderer.state.bindXRFramebuffer(layer.framebuffer);
                  renderer.setRenderTarget( renderer.getRenderTarget() );
                }
              }
            } else {
              console.log('no XR layer found', this.xrsession.renderState);
            }
          } else {
            this.rendersystem.renderer.xr.enabled = false;
            //this.rendersystem.renderer.xr.setSession(null);
            //this.rendersystem.renderer.setFramebuffer(null);
            this.rendersystem.renderer.state.bindXRFramebuffer(null);
            this.rendersystem.renderer.setRenderTarget( renderer.getRenderTarget() );
            this.rendersystem.renderer.render(this.scene, this.camera);
          }
        }

        if (this.rendersystem.cssrenderer && !this.xrsession) {
          this.rendersystem.cssrenderer.render(this.scene, this.actualcamera);
        }
      }
      /*
      if (this.stats) {
        this.stats.update();
      }
      */
      elation.events.fire({type: 'render_view_postrender', element: this});
      this.size_old[0] = this.size[0];
      this.size_old[1] = this.size[1];
      this.scale_old = this.scale;
  //this.camera.rotation.y += Math.PI/32 * delta;
    }
    this.updateRenderStats = function() {
      this.renderstats.update(this.rendersystem.renderer);
      var renderinfo = this.rendersystem.renderer.info;

      elation.utils.merge(renderinfo.render, this.renderinfo.render);
      elation.utils.merge(renderinfo.memory, this.renderinfo.memory);
      
      //this.renderinfo.render.faces = renderinfo.render.faces;
    }
    this.toggleStats = function() {
      if (this.showstats) {
        if (this.renderstats) {
          this.container.removeChild(this.renderstats.domElement)
        }
        if (this.stats) {
          this.container.removeChild(this.stats.domElement);
        }
        this.showstats = false;
      } else {
        if (this.renderstats) {
          this.container.appendChild(this.renderstats.domElement)
        }
        if (this.stats) {
          this.container.appendChild(this.stats.domElement);
        }
        this.showstats = true;
      }
    }
    this.setactivething = function(thing) {
      if (thing.camera) {
        this.setcamera(thing.camera);
      }
      this.activething = thing;
    }
    this.setcamera = function(camera) {
      if (camera instanceof elation.component.base && camera.type == 'camera') {
        camera = camera.objects['3d'];
      }
      this.camera = camera;
      this.setscene(this.getscene(camera));
      this.updateCameras();
      this.setrendersize(this.size[0], this.size[1]);
  /*
      if (this.composer) {
        this.composer.passes[0].camera = this.camera;
      }
      if (this.pickingcomposer) {
        this.pickingcomposer.passes[0].camera = this.camera;
      }
  */
    }
    this.setscene = function(scene) {
      var oldscene = this.scene;
      this.scene = scene;
      if (this.composer) {
        for (var i = 0; i < this.composer.passes.length; i++) {
          var pass = this.composer.passes[i];
          if (pass.scene && pass.scene === oldscene) {
            pass.scene = this.scene;
          }
        }
      }
      this.rendersystem.setdirty();
    }
    this.setcameranearfar = function(near, far) {
      /*
      if (!this.camdebug) {
        this.camdebug = elation.ui.window('camdebug', elation.html.create({append: document.body}), {title: 'Camera Debug'});
      }
      */
      if (!near || !far) {
        near = Infinity, far = 0;
        var nearradius = 0, farradius = 0;
        var campos = new THREE.Vector3().setFromMatrixPosition(this.camera.matrixWorld);
        var objpos = new THREE.Vector3();
        var frustum = new THREE.Frustum();
        var frustmat = new THREE.Matrix4().makePerspective( this.camera.fov, this.camera.aspect, 0.00001, 9e99).multiply(this.camera.matrixWorldInverse);
        //frustum.setFromMatrix( new THREE.Matrix4().multiplyMatrices( this.camera.projectionMatrix, this.camera.matrixWorldInverse ) );
        frustum.setFromMatrix(frustmat);
        var within = [], nearnode = null, farnode = null;

        this.scene.traverse(elation.bind(this, function(node) {
          objpos.setFromMatrixPosition(node.matrixWorld);
          if (!node.isBoundingSphere && node.geometry && node.geometry.boundingSphere && frustum.intersectsSphere({center: objpos, radius: node.geometry.boundingSphere.radius})) {
            var distsq = objpos.distanceToSquared(campos);
            var rsq = node.geometry.boundingSphere.radius * node.geometry.boundingSphere.radius;
            var tdist = distsq - rsq;
            if (tdist <= 0) {
              within.push(node);
            } else {
              near = distsq;
              nearnode = node;
            }
            if (distsq + rsq > far) {
              far = distsq + rsq;
              farradius = node.geometry.boundingSphere.radius;
              farnode = node;
            }
          }
        }));
        if (nearnode) {
          within.push(nearnode);
        }
        if (within.length > 0) {
          var vpos = new THREE.Vector3();
          for (var n = 0; n < within.length; n++) {
            if (within[n].geometry instanceof THREE.Geometry) {
              for (var i = 0; i < within[n].geometry.vertices.length; i++) {
                vpos.copy(within[n].geometry.vertices[i]);
                within[n].localToWorld(vpos);
                if (true) { //frustum.containsPoint(vpos)) {
                  var dsq = vpos.distanceToSquared(campos);
                  if (dsq < near) {
                    near = dsq;
                    nearnode = within[n];
                  }
                }
              }
            }
          }
        }
        near = Math.max(Math.sqrt(near), 0.00001);
        far = Math.max(Math.sqrt(far), 10);
      }
      //console.log('set near/far:', near, far, (nearnode && nearnode.userData.thing ? nearnode.userData.thing.name : nearnode), (farnode && farnode.userData.thing ? farnode.userData.thing.name : farnode), nearradius, farradius);
      //var nearthing = this.getParentThing(nearnode);
      //this.camdebug.setcontent("<ul><li>Near: " + near + "</li><li>Far: " + far + "</li><li>Nearest Object: " + (nearthing ? nearthing.name : '(unknown:' + (nearnode ? nearnode.name || nearnode.id : "") + ')') + "</li></ul>");
      if (near != Infinity && far != 0) {
        //this.camera.near = near * .5;
        this.camera.far = far * 1.2;
        this.camera.updateProjectionMatrix();
      }

    }
    this.setskyscene = function(scene) {
      this.skyscene = scene || new THREE.Scene();
      this.skycamera = new THREE.PerspectiveCamera(this.camera.fov, this.camera.aspect, 0.1, 10000);
      //this.skycamera.rotation = this.camera.rotation;
      //this.skycamera.quaternion = this.camera.quaternion;
      this.skyscene.add(this.skycamera);

      if (!this.skypass) {
        this.skypass = this.createRenderPass('sky');
        this.composer.passes[0].clear = false;
        this.composer.passes.unshift(this.skypass);
      }
    }
    this.getscene = function(obj) {
      var scene = obj;

      while ( scene.parent ) {
        scene = scene.parent;
      }
      if ( scene !== undefined && scene instanceof THREE.Scene )  {
        return scene;
      }
      return false;
    }
    this.getsize = function(force) {
      //this.size = [this.container.offsetWidth, this.container.offsetHeight];
      var s = (this.args.fullsize ? {w: window.innerWidth, h: window.innerHeight} : 
              (this.args.resolution ? {w: this.args.resolution[0], h: this.args.resolution[1]} : 
               elation.html.dimensions(this.container)
              ));
      if (this.xrsession) {
        let xrlayer = this.getXRBaseLayer(this.xrsession);
        if (xrlayer) {
          s = {
            w: xrlayer.framebufferWidth,
            h: xrlayer.framebufferHeight,
          };
        }
      }
      var domel = this.rendersystem.renderer.domElement;
      if (domel && (force || ((s.w != this.size[0] || s.h != this.size[1]) && (s.w > 0 && s.h > 0)))) {
        this.size = [s.w, s.h];
        this.setrendersize(this.size[0], this.size[1]);
      }
      this.rendersystem.setdirty();

      return this.size;
    }
    this.setrendersize = function(width, height) {
      if (this.xrsession) return;
      var scale = this.scale / 100,
          invscale = 100 / this.scale,
          scaledwidth = width * scale,
          scaledheight = height * scale;
      if (scaledwidth == 0 || scaledheight == 0) {
        console.warn('Renderer was told to resize to ' + scaledwidth + 'x' + scaledheight);
        return;
      }
      this.rendersystem.renderer.domElement.style.transformOrigin = '0 0';
      this.rendersystem.renderer.domElement.style.transform = 'scale3d(' + [invscale, invscale, invscale].join(',') + ')';
      this.sizevec.set(scaledwidth, scaledheight);
      this.sizevecinverse.set(1/scaledwidth, 1/scaledheight);

      var pixelratio = 1; //(window.devicePixelRatio ? window.devicePixelRatio : 1);
      if (pixelratio != this.rendersystem.renderer.getPixelRatio()) {
        this.rendersystem.renderer.setPixelRatio(pixelratio);
      }
      this.rendersystem.renderer.setSize(scaledwidth, scaledheight);
      if (this.composer) {
        this.composer.setSize(scaledwidth, scaledheight);  
      }
      if (this.rendersystem.cssrenderer) {
        this.rendersystem.cssrenderer.setSize(width, height);  
        //this.rendersystem.cssrenderer.setPixelRatio(pixelratio);
      }
      //this.composer.setSize(scaledwidth, scaledheight);
      if (this.pickingcomposer) {
        this.pickingcomposer.setSize(scaledwidth, scaledheight);
      }
      if (this.effects['SSAO']) {
        this.effects['SSAO'].uniforms[ 'size' ].value.set( width, height);
        this.effects['SSAO'].uniforms[ 'tDepth' ].value = this.depthTarget;
      }
      if (this.skycamera) {
        this.skycamera.aspect = width / height / this.aspectscale;
        this.skycamera.updateProjectionMatrix() / this.aspectscale;
      }
      if (this.camera) {
        this.camera.aspect = width / height / this.aspectscale;
        this.camera.updateProjectionMatrix();
      }
      if (this.actualcamera) {
        this.actualcamera.aspect = width / height;
        this.actualcamera.updateProjectionMatrix();
      }
    }
    this.setscale = function(scale) {
      this.scale = scale;
    }
    this.system_attach = function(ev) {
      console.log('INIT: view (' + this.id + ')');

    }
    this.engine_start = function(ev) {
    }
    this.engine_frame = function(ev) {
      //var scene = this.engine.systems.world.scene['world-3d'];
      //console.log('FRAME: view (' + this.id + ")");
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: view (' + this.id + ')');
    }
    this.resize = function(ev) {
      this.getsize(ev.data);
    }
    this.mouseover = function(ev) {
      if (!this.pickingactive) {
        //elation.events.add(this.container, 'mousemove,mouseout', this);
        this.pickingactive = true;
      }
      this.mousepos = [ev.clientX, ev.clientY, document.body.scrollTop];
    }
    this.mousedown = function(ev) {
      if (this.pickingactive && this.picker.pickingobject) {
        this.cancelclick = false;
        var newev = {type: 'mousedown', element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.picker.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, button: ev.button, shiftKey: ev.shiftKey, altKey: ev.altKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey};
        /*
        var fired = elation.events.fire(newev);
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble === true || ev.cancelBubble === true) { ev.stopPropagation(); }
          if (fired[i].returnValue === false || ev.returnValue === false) { ev.preventDefault(); }
        }
        */
        this.proxyEvent(newev);
      }
    }
    this.mousewheel = function(ev) {
      //this.mousepos[0] = ev.clientX;
      //this.mousepos[1] = ev.clientY;
      this.mousepos[2] = document.body.scrollTop;

      var newev = {type: 'wheel', element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.picker.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, deltaX: ev.deltaX, deltaY: ev.deltaY, deltaZ: ev.deltaZ, deltaMode: ev.deltaMode, shiftKey: ev.shiftKey, altKey: ev.altKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, preventDefault: () => ev.preventDefault(), stopPropagation: () => ev.stopPropagation()};
      this.proxyEvent(newev);
      if (elation.events.wasDefaultPrevented(newev)) {
        ev.preventDefault();
        return false;
      }
    }
    this.mousemove = function(ev, ignorePointerLock) {
      var el = document.pointerLockElement || document.mozPointerLockElement;
      if (el && !ignorePointerLock) {
        var dims = elation.html.dimensions(el);
        this.mousepos[0] = Math.round(dims.w / 2);
        this.mousepos[1] = Math.round(dims.h / 2);
        this.mousepos[2] = document.body.scrollTop;

        if (this.rendermode == 'oculus') {
          this.mousepos[0] /= 2;
        }
      } else if (this.mousepos && this.mousepos[0] != ev.clientX || this.mousepos[1] != ev.clientY) {
        this.mousepos[0] = ev.clientX;
        this.mousepos[1] = ev.clientY;
        this.mousepos[2] = document.body.scrollTop;
        //this.cancelclick = true;
      } 
    }
    this.mouseenter = function(ev) {
      this.rendersystem.setdirty();
    }
    this.mouseleave = function(ev) {
      this.rendersystem.setdirty();
    }
    this.mouseout = function(ev) {
      if (this.pickingactive) {
        elation.events.remove(this.container, 'mousemove,mouseout', this);
        this.pickingactive = false;
        if (this.picker.pickingobject) {
          var newev = {type: "mouseout", element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.picker.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY};
          /*
          var fired = elation.events.fire(newev);
          this.pickingobject = false;
          for (var i = 0; i < fired.length; i++) {
            if (fired[i].cancelBubble) ev.stopPropagation();
          }
          */
          this.proxyEvent(newev);
        }
      }
    }
    this.mouseup = function(ev) {
      if (this.pickingactive && this.picker.pickingobject) {
        var newev = {type: 'mouseup', element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.picker.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, button: ev.button};
        /*
        var fired = elation.events.fire(newev);
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble) ev.stopPropagation();
        }
        */
        this.proxyEvent(newev);
      }
    }
    this.click = function(ev) {
      if (this.pickingactive && this.picker.pickingobject && !this.cancelclick) {
        var clickevent = {type: 'click', event: ev, element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.picker.pickingobject, [ev.clientX, ev.clientY])};
        /*
        var fired = elation.events.fire(clickevent);
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble && ev.stopPropagation) ev.stopPropagation();
        }
        */
        this.proxyEvent(clickevent);
      }
      if (ev && ev.preventDefault) {
        ev.preventDefault();
      }
      this.container.focus();
    }
    this.touchstart = function(ev) {
      if (!this.pickingactive) {
        this.pickingactive = true;
      }
      this.cancelclick = false;
      if (ev.touches.length == 1) {
        this.touchstartpos = new THREE.Vector2(ev.touches[0].clientX, ev.touches[0].clientY);
      }
/*
      if (!this.isFullscreen()) {
        //this.toggleFullscreen(true);
        this.cancelclick = true;
      } else {
*/
        this.mousepos = [Math.round(ev.touches[0].clientX), Math.round(ev.touches[0].clientY), document.body.scrollTop];
        this.updatePickingObject();
        this.proxyEvent(ev);

        var fakeev = elation.events.clone(ev.touches[0], {});
        fakeev.button = 0;
        fakeev.preventDefault = ev.preventDefault.bind(ev);
        fakeev.stopPropagation = ev.stopPropagation.bind(ev);
        this.mousedown(fakeev);
//      }
        ev.preventDefault();
    }
    this.touchmove = function(ev) {
      this.mousepos = [ev.touches[0].clientX, ev.touches[0].clientY, document.body.scrollTop];
      var fakeev = elation.events.clone(ev.touches[0], {});
      fakeev.button = 0;
      fakeev.preventDefault = ev.preventDefault.bind(ev);
      fakeev.stopPropagation = ev.stopPropagation.bind(ev);
      this.mousemove(fakeev, true);
      this.proxyEvent(ev);

      // Cancel click handling if we move more than 5 pixels, or if we're doing a multitouch gesture
      var distance = this.touchstartpos.distanceTo(new THREE.Vector2(ev.touches[0].clientX, ev.touches[0].clientY));
      if (ev.touches.length > 1 || distance > 5) {
        this.cancelclick = true;
      }

    }
    this.touchend = function(ev) {
      if (ev.touches.length == 0) {
        this.proxyEvent(ev);
        this.mouseup(ev);
        if (!this.cancelclick) {
          this.click({clientX: this.mousepos[0], clientY: this.mousepos[1]});
        }
        if (this.pickingactive) {
          this.pickingactive = false;
        }
      }
    }
    this.proxyEvent = function(ev, obj) {
      if (!this.pickingactive) {
        this.pickingactive = true;
      }
      //this.mousemove(ev);
      if (!obj) {
        obj = this.picker.pickingobject;
      }
      if (obj) {
        var element = this.getParentThing(obj),
            data = (ev.data ? ev.data : this.getPickingData(obj, [ev.clientX, ev.clientY]));

        var event = elation.events.getEvent({
          type: ev.type,
          element: element,
          event: elation.events.fix(ev.event || ev),
          data: data
        });
        var fired = elation.events.fireEvent(event);
        var bubble = true;
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble === true || ev.cancelBubble === true) {
            //ev.stopPropagation();
            bubble = false;
          }
          if (fired[i].returnValue === false || ev.returnValue === false) {
            ev.preventDefault();
          }
        }

        if (bubble) {
          //console.log('bubble it!', event, element);
          var ptr = element;
          while (ptr = ptr.parent) {
            //console.log(' - ', ptr);
            elation.events.fireEvent(event, ptr);
          }
        }

      }
    }
    this.change = function(ev) {
      console.log('change', ev);
    }
    this.getParentThing = function(obj) {
      while (obj) {
        if (obj.userData.thing) return obj.userData.thing;
        obj = obj.parent;
      }
      return null;
    }
    this.initPicking = function() {
      //this.picker = new elation.engine.systems.render.picking_gpu(this);
      this.picker = new elation.engine.systems.render.picking_cpu(this, this.engine.systems.world.scene['colliders']);
    }
    this.updatePickingTarget = function(force) {
      return this.picker.updatePickingTarget(force);
    }
    this.updatePickingObject = function(force) {
      if (this.picker) {
        return this.picker.updatePickingObject(force);
      }
      return false;
    }
    this.pick = function(x, y) {
      if (this.picker) {
        return this.picker.pick(x, y);
      }
    }
    this.getPickingData = function(obj) {
      return this.picker.getPickingData(obj);
    }
    this.enablePicking = function() {
      console.log('picking enabled');
      this.picking = true;
      this.updatePickingTarget(true);
      this.updatePickingObject(true);
    }
    this.disablePicking = function() {
      console.log('picking disabled');
      this.updatePickingTarget(true);
      this.updatePickingObject(true);
      this.picking = false;
    }
    this.pointerlockchange = function(ev) {
      var el = document.pointerLockElement || document.mozPointerLockElement;
      if (el) {
        var dims = elation.html.dimensions(el);
        this.mousepos[0] = Math.round(dims.w / 2);
        this.mousepos[1] = Math.round(dims.h / 2);
        this.pickingactive = true;
      }
    }
    this.screenshot = function(args) {
      if (!args) args = {};
      var type = args.type || 'single';
      var format = args.format || 'jpg';

      var promise = false;
      if (type == 'single') {
        promise = this.screenshotSingle(args);
      } else if (type == 'cubemap') {
      } else if (type == 'equirectangular') {
        promise = this.screenshotEquirectangular(args);
      }

      return promise;
    }
    this.screenshotSingle = function(args) {
      var format = args.format || 'jpg';
      var promise = new Promise(elation.bind(this, function(resolve, reject) {
        var img = false;
        var canvas = this.rendersystem.renderer.domElement;
        var resized = document.createElement('canvas');
        resized.width = args.width || canvas.width;
        resized.height = args.height || canvas.height;
        var ctx = resized.getContext('2d');
        ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, resized.width, resized.height);
        if (format == 'jpg') {
          img = resized.toDataURL('image/jpeg');
        } else if (format == 'png') {
          img = resized.toDataURL('image/png');
        };
        if (img) {
          resolve(img);
        } else {
          reject();
        }
      }));
      return promise;
    }
    this.screenshotCubemap = (function() {
      var renderTargets = [];

      return function(args) {
        var args = args || {};
        var width = args.width || 512;
        var camera = args.camera || this.actualcamera;
        var raw = args.raw;
        var format = args.format || 'jpg';
        var renderer = this.rendersystem.renderer;
        var cubeRenderTarget = new THREE.WebGLCubeRenderTarget( width, { format: THREE.RGBFormat, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter } );

        var cubecam = new THREE.CubeCamera(camera.near, camera.far, cubeRenderTarget);
        cubecam.position.set(0,0,0).applyMatrix4(camera.matrixWorld);
        this.scene.add(cubecam);

        if (raw) {
          cubecam.update(renderer, this.scene);
          this.scene.remove(cubecam);
          return cubecam;
        } else {
          var pos = [
            [width*2, width],
            [0, width],
            [width, 0],
            [width, width*2],
            [width, width],
            [width*3, width],
          ];
          var materials = [],
              images = [];
          var canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = width;
          var ctx = canvas.getContext('2d');
          var imageData = ctx.createImageData(width, width);
          var buffer = new Uint8Array(width * width * 4);

          for (var i = 0; i < cubecam.children.length; i++) {
            if (!renderTargets[i]) {
              renderTargets[i] = new THREE.WebGLRenderTarget(width, width);
            } else {
              renderTargets[i].setSize(width, width);
            }
            renderer.render( this.scene, cubecam.children[i], renderTargets[i] );
            renderer.readRenderTargetPixels(renderTargets[i], 0, 0, width, width, buffer);

            imageData.data.set(buffer);

            ctx.putImageData(imageData, 0, 0);
            var src = canvas.toDataURL(this.formatToMime(format));

            var img = document.createElement('img');
            img.src = src;
            images.push(img);
            //renderTargets[i].dispose();
          }
          this.scene.remove(cubecam);
          return images;
        }
      }
    })();
    this.screenshotEquirectangular = (function() {
      var converter = false;
      return function(args) {
        var width = args.width || 4096;
        var format = args.format || 'jpg';
        var height = args.height || width / 2;
        var cubecam = this.screenshotCubemap({width: height, height: height, format: 'png', raw: true});
        if (!converter) {
          var renderer = this.rendersystem.renderer;
          converter = new CubemapToEquirectangular(renderer, false);
        }
        converter.setSize(width, height);
        return converter.convert(cubecam, this.formatToMime(format));
      }
    })();
    this.formatToMime = function(format) {
      var formats = {
        gif: 'image/gif',
        jpg: 'image/jpeg',
        png: 'image/png'
      };
      return formats[format];
    }
    this.getPixelAt = function(x, y) {
      return this.getPixelsAt(x, y, 1, 1);
    }
    this.getPixelsAt = function(x, y, w, h) {
      var renderer = this.rendersystem.renderer;
      var canvas = renderer.domElement;
      var renderTarget = this.rendertarget;
      // Return a promise here because there's discussion about making these pixel-reading functions async in the WebGL spec

      if (this.rendersystem.dirty) {
        this.render(0);
      }

      return new Promise(function(resolve, reject) {
        /*
        var buffer = new Uint8Array(w * h * 4);
        renderer.readRenderTargetPixels(renderTarget, x, y, w, h, buffer);
        resolve(buffer);
        */
        var newcanvas = document.createElement('canvas'),
        ctx = newcanvas.getContext('2d');

        newcanvas.width = w;
        newcanvas.height = w;
        ctx.drawImage(canvas, x, y, w, h);
        var pixels = ctx.getImageData(0,0,w,h);
        resolve(pixels.data);
      });
    }
  }, elation.ui.base);
  elation.extend("engine.systems.render.picking_intersection", function(mesh, mousepos, viewport, intersection) {
    // Represents an intersection between the mouse and an object in the scene as viewed from the specified viewport

    this.init = function() {
      this.object = mesh;
      this.thing = this.getParentThing(mesh);
      this.intersection = intersection;

      // Accessor functions let us avoid doing the heavy calculations for every single 
      // intersection, and instead generates more specific information as it's requested
      Object.defineProperty(this, 'point', { get: this.getIntersectionPoint });
      Object.defineProperty(this, 'face', { get: this.getIntersectionFace });
      Object.defineProperty(this, 'distance', { get: this.getIntersectionDistance });
    }

    this.getParentThing = function(obj) {
      // FIXME - duplicated from above, should be a shared utility function
      while (obj) {
        if (obj.userData.thing) return obj.userData.thing;
        obj = obj.parent;
      }
      return null;
    }
    this.getIntersection = function() {
      if (!this.intersection) {
        var mouse3d = new THREE.Vector3((mousepos[0] / viewport.size[0]) * 2 - 1, -(mousepos[1] / viewport.size[1]) * 2 + 1, -1);
        var projector = new THREE.Projector();
        //projector.unprojectVector(mouse3d, viewport.camera);
        mouse3d.unproject(viewport.camera);

        var worldpos = viewport.camera.position.clone().applyMatrix4(viewport.camera.matrixWorld);
        var ray = new THREE.Raycaster(worldpos, mouse3d.sub(worldpos).normalize());
        var intersects = ray.intersectObject(mesh);
        if (intersects.length > 0) {
          this.intersection = intersects[0];
        }
        //console.log(intersects, mouse3d.toArray(), ray, mesh);
      }

      return this.intersection;
    }
    this.getIntersectionPoint = function() {
      var intersection = this.getIntersection();
      if (intersection) {
        return intersection.point;
      }
      return false;
    }
    this.getIntersectionFace = function() {
      var intersection = this.getIntersection();
      if (intersection) {
        return intersection.face;
      }
      return false;
    }
    this.getIntersectionDistance = function() {
      var intersection = this.getIntersection();
      if (intersection) {
        return intersection.distance;
      }
      return false;
    }
    this.init();
  });
  if (0) {
  elation.component.add('engine.systems.render.config', function() {
    this.init = function() {
        this.args.orientation = 'vertical'
        elation.engine.systems.render.config.extendclass.init.call(this);

        this.client = this.args.client;
        this.engine = this.client.engine;
        this.view = this.client.view;
        this.rendersystem = this.args.rendersystem;

        var displaypanel = elation.ui.panel({ 
          orientation: 'vertical',
          classname: 'engine_config_section',
          append: this 
        });
        var capturepanel = elation.ui.panel({ 
          orientation: 'vertical',
          classname: 'engine_config_section',
          append: this 
        });

        // Display Settings
        var displaylabel = elation.ui.labeldivider({
          append: displaypanel,
          label: 'Display Settings'
        });
        var oculus = elation.ui.toggle({
          label: 'VR Mode',
          append: displaypanel,
          events: { toggle: elation.bind(this.client, this.client.toggleVR) }
        });
        var fullscreen = elation.ui.toggle({
          label: 'Fullscreen',
          append: displaypanel,
          events: { toggle: elation.bind(this.client, this.client.toggleFullscreen) }
        });
        this.view.scale = 100;
        var scale = elation.ui.slider({
          append: displaypanel,
          classname: 'engine_render_scale',
          min: 1,
          max: 200,
          snap: 1,
          label: 'View scale: ',
          handle: {
            name: 'handle_one_scale',
            value: this.view.scale,
            labelprefix: 'View scale:',
            bindvar: [this.view, 'scale']
          },
          events: { ui_slider_change: elation.bind(this.rendersystem, this.rendersystem.setdirty) }
        });

if (false) {
        var bloomfilter = this.view.effects['bloom']
        var bloom = elation.ui.slider({
          append: displaypanel,
          classname: 'engine_render_bloom',
          min: 0,
          max: 2,
          snap: 0.1,
          label: 'Bloom: ',
          handle: {
            name: 'handle_one_bloom',
            value: bloomfilter.copyUniforms.opacity.value,
            bindvar: [bloomfilter.copyUniforms.opacity, 'value']
          },
          events: { ui_slider_change: elation.bind(this.rendersystem, this.rendersystem.setdirty) }
        });

        var fxaafilter = this.view.effects['fxaa']
        var msaafilter = this.view.effects['msaa']
        var antialiasing = elation.ui.select({
          append: displaypanel,
          label: 'Antialiasing',
          items: ['None', 'FXAA', 'MSAA'],
          selected: 'FXAA',
          events: {
            ui_select_change: function(ev) { 
              fxaafilter.enabled = false;
              msaafilter.enabled = false;

              if (ev.data == 'FXAA') fxaafilter.enabled = true;
              if (ev.data == 'MSAA') msaafilter.enabled = true;
            }
          }
        });
        var msaa = elation.ui.select({
          append: displaypanel,
          label: 'MSAA Samples',
          items: [0, 1, 2, 4, 8, 16],
          bindvar: [msaafilter, 'sampleLevel']
/*
          events: {
            ui_select_change: function(ev) { 
              msaafilter.sampleLevel = parseInt(ev.data);
console.log('dun it', msaafilter);
            }
          }
*/
        });
}


      // Capture Settings
      var capturelabel = elation.ui.labeldivider({
        append: capturepanel,
        label: 'Capture Settings'
      });
      var codec = elation.ui.select({
        append: capturepanel,
        label: 'Codec',
        items: ['h264','gif']
      });
      var fps = elation.ui.select({
        append: capturepanel,
        label: 'FPS',
        items: [5,10,25,30,45,60]
      });
    }
  }, elation.ui.panel);
  }

  elation.extend('engine.systems.render.picking_gpu', function(view) {
    this.view = view;
    this.keystates = {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    this.lastmousepos = [0, 0, 0];

    this.init = function() {
      this.initPickingMaterial();
      elation.events.add(window, "keydown,keyup", this);
    }

    this.update = function(mousepos) {
      
    }
    this.updatePickingTarget = function(force) {
      // ratelimit to once every n frames, for performance reasons
      //if (!this.pickingdebug && this.picknum++ % 3 != 0) return;
      var now = new Date().getTime();
      if (now - this.picktime < 1000/20 && !force) {
        //return;
      }
      this.picktime = now;

      this.pickingobjects = [];
      this.realmaterials = [];
      this.realvisible = [];
      var objid = 1;
      // replace texture with placeholder
      this.view.scene.traverse(elation.bind(this, function(node) {
        if (node.material) {
          var objid = node.id;
          this.realvisible[objid] = node.visible;
          this.realmaterials[objid] = node.material;
          var parent = this.view.getParentThing(node);
          if (node.visible && parent && parent.properties && parent.properties.mouseevents) {
            node.material = this.getPickingMaterial(objid);
          } else {
            node.visible = false;
          }
          this.pickingobjects[objid] = node;
          //objid++;
        } else {
        }
      }));
      //this.rendersystem.renderer.render(this.scene, this.camera, this.pickingtarget, true);
      this.pickingcomposer.render();
      //this.pickingtarget.needsUpdate = true;
      if (this.pickingdebug) {
        //this.rendersystem.renderer.render(this.scene, this.camera);
      }

      // revert textures
      var ids = Object.keys(this.pickingobjects);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (this.realmaterials[id]) {
          this.pickingobjects[id].material = this.realmaterials[id];
        }
        this.pickingobjects[id].visible = this.realvisible[id];
      }
    }
    this.updatePickingObject = function(force) {
      if (force || (this.view.picking && this.view.pickingactive)) { // && (this.mousepos[0] != this.lastmousepos[0] || this.mousepos[1] != this.lastmousepos[1] || this.mousepos[2] != this.lastmousepos[2]))) {
        //var dims = elation.html.dimensions(this.view.container);
        var dims = {x: this.view.size[0], y: this.view.size[1]};
        this.pick(this.view.mousepos[0] - dims.x, this.view.mousepos[1] - dims.y);
        this.lastmousepos[0] = this.view.mousepos[0];
        this.lastmousepos[1] = this.view.mousepos[1];
        this.lastmousepos[2] = this.view.mousepos[2];
      }
    }
    this.pick = function(x, y) {
      //var oldframebuffer = this.glcontext.bindFramebuffer();

      this.view.rendersystem.renderer.setRenderTarget( this.pickingcomposer.output );
      var s = elation.html.dimensions(this.view.container);
      var scale = this.view.scale / 100;
      this.view.glcontext.readPixels((x + s.left) * scale, (this.view.container.offsetHeight - (y + s.top)) * scale, 1, 1, this.view.glcontext.RGBA, this.view.glcontext.UNSIGNED_BYTE, this.pickingbuffer);
      this.view.rendersystem.renderer.setRenderTarget( null );
      
      var pickid = (this.pickingbuffer[0] << 16) + (this.pickingbuffer[1] << 8) + (this.pickingbuffer[2]);
      var pickedthing = false, oldpickedthing = false;
      if (this.pickingobject) {
        pickedthing = oldpickedthing = this.view.getParentThing(this.pickingobject);
      }
      if (pickid > 0) {
        if (this.pickingobject !== this.pickingobjects[pickid]) {
          pickedthing = this.view.getParentThing(this.pickingobjects[pickid]);
          if (this.pickingobject) {
            //console.log('mouseout', this.pickingobject);
            var outevent = {type: "mouseout", element: oldpickedthing, relatedTarget: pickedthing, data: this.getPickingData(this.pickingobject, [x, y])};
            this.proxyEvent(outevent);
          }
          this.pickingobject = this.pickingobjects[pickid];
          if (this.pickingobject) {
            var overevent = {type: "mouseover", element: pickedthing, relatedTarget: oldpickedthing, data: this.getPickingData(this.pickingobject, [x, y]), clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey};
            this.proxyEvent(overevent);
          }
        }
        var moveevent = {type: "mousemove", element: pickedthing, data: this.getPickingData(this.pickingobject, [x, y]), clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey};
        this.proxyEvent(moveevent);
      } else {
        if (this.pickingobject) {
          //console.log('mouseout', this.pickingobject);
          var outevent = {type: "mouseout", element: pickedthing, data: this.getPickingData(this.pickingobject, [x, y])};
          //elation.events.fire(outevent);
          this.proxyEvent(outevent);
          this.pickingobject = false;
        }
      }
    }
    this.initPickingMaterial = function() {
      elation.engine.materials.addChunk("controls_picking", {
        uniforms: {
          "id" : { type: "i", value: 0 },
          "diffuse" : { type: "c", value: new THREE.Color(0xff0000) },
        },
        vertex_pars: [
          "uniform int id;",
          "varying vec2 vUv;",
        ].join('\n'),

        vertex: [
          "vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
          "gl_Position = projectionMatrix * mvPosition;",
          //"vUv = uv;",
        ].join('\n'),
        fragment_pars: [
          "uniform int id;",
          "uniform vec3 diffuse;",
          "varying vec2 vUv;",
        ].join('\n'),
        fragment: [
            //"gl_FragColor = vec4(1,0,0, 1);",
            //"gl_FragColor = vec4( vUv.x, vUv.y, float(id) / 256.0, 1.0);",
            //"gl_FragColor = vec4( float(id) / 256.0, 0, 0, 1.0);",
            "gl_FragColor = vec4( diffuse, 1.0);",
        ].join('\n')
      });
      elation.engine.materials.buildShader("controls_picking", {
        uniforms: [
          //'common',
          //'color',
          'controls_picking',
        ],
        chunks_vertex: [
          'controls_picking',
          //'color',
          //'default',
        ],
        chunks_fragment: [
          //'color',
          'controls_picking',
        ]
      });

      this.pickingmaterials = [];
      this.pickingtarget = new THREE.WebGLRenderTarget(this.view.size[0], this.view.size[1], {minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false});
      this.pickingtarget.generateMipmaps = false;

      this.pickingcomposer = this.view.createRenderPath([this.view.rendermode], this.pickingtarget);
      this.pickingbuffer = new Uint8Array(4);
      this.picknum = 0;
      this.picktime = 0;

      this.pickingobjects = [];
      this.realmaterials = [];
      this.realvisible = [];
    }
    this.getPickingMaterial = function(id) {
      if (!this.pickingmaterials[id]) {
        var idcolor = new THREE.Color(id);
        this.pickingmaterials[id] = elation.engine.materials.getShaderMaterial("controls_picking", {diffuse: idcolor}, null, false);
      }
      return this.pickingmaterials[id];
    }
    this.getPickingData = function(mesh, mousepos, intersection) {
      return new elation.engine.systems.render.picking_intersection(mesh, mousepos, this, intersection);
    }
    this.keydown = function(ev) {
      for (var k in this.keystates) {
        this.keystates[k] = ev[k];
      }
    }
    this.keyup = function(ev) {
      for (var k in this.keystates) {
        this.keystates[k] = ev[k];
      }
    }

    this.init();
  });
  elation.extend('engine.systems.render.picking_cpu', function(view, scene) {
    this.view = view;
    this.scene = scene;
    this.camerapos = new THREE.Vector3(),
    this.cameradir = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster(this.camerapos, this.cameradir);

    this.keystates = {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    this.lastmousepos = [0, 0, 0];
    this.mousevec = new THREE.Vector2();
    this.lastdir = new THREE.Vector3();

    this.init = function() {
      elation.events.add(window, "keydown", (ev) => this.keydown(ev));
      elation.events.add(window, "keyup", (ev) => this.keyup(ev));
    }
    this.updatePickingTarget = function(force) {
    }
    this.updatePickingObject = function(force) {
      if (force || (this.view.picking && this.view.pickingactive)) { // && (this.mousepos[0] != this.lastmousepos[0] || this.mousepos[1] != this.lastmousepos[1] || this.mousepos[2] != this.lastmousepos[2]))) {
        //var dims = elation.html.dimensions(this.view.container);
        var dims = {x: 0, y: 0};
        //var dims = {x: this.view.size[0], y: this.view.size[1]};
        this.pick(this.view.mousepos[0] - dims.x, this.view.mousepos[1] - dims.y);
        this.lastmousepos[0] = this.view.mousepos[0];
        this.lastmousepos[1] = this.view.mousepos[1];
        this.lastmousepos[2] = this.view.mousepos[2];
      }
    }
    this.pick = function(x, y) {
      this.mousevec.x = (x / this.view.size[0]) * 2 - 1;
      this.mousevec.y = -(y / this.view.size[1]) * 2 + 1;

      try {
        var camera = this.view.actualcamera;
        this.scene.updateMatrix();
        this.scene.updateMatrixWorld();
        camera.updateMatrix();
        camera.updateMatrixWorld();

        this.raycaster.setFromCamera(this.mousevec, camera);
        /*
        if (!this.rayviz) {
          this.rayviz = new THREE.ArrowHelper(this.raycaster.ray.direction.clone(), this.raycaster.ray.origin.clone(), 100);
          this.scene.add(this.rayviz);
        } else {
          this.rayviz.position.copy(this.raycaster.ray.origin);
          this.rayviz.setDirection(this.raycaster.ray.direction.clone().normalize());
          this.view.rendersystem.setdirty();
          //console.log(this.mousevec.toArray(), this.raycaster.ray.origin.toArray(), this.raycaster.ray.direction.toArray());
        }
        */

        var intersects = this.raycaster.intersectObjects(this.scene.children, true);
        var hit = false;
        var fired = false;
        while (intersects.length > 0) {
          hit = intersects.shift();
          let thing = this.view.getParentThing(hit.object);
          if (thing.pickable && !(hit.object instanceof THREE.EdgesHelper)) {
            if (hit !== this.lasthit) {
              this.lasthit = hit; // FIXME - hack for demo
            }
            fired = this.firePickingEvents(hit, x, y);
            break;
          }
        }
        if (!fired) {
            this.firePickingEvents();
        }
      } catch (e) {
        console.log('[renderer] Picking error:', e);
      }
    }
    this.firePickingEvents = function(hit, x, y) {
      var pickedthing = false, oldpickedthing = false;
      if (this.pickingobject) {
        pickedthing = oldpickedthing = this.pickingobject.userData.thing;
      }
      if (hit) {
        hit.thing = hit.object.userData.thing;
        if (this.pickingobject !== hit.object) {
          pickedthing = hit.object.userData.thing;
          if (this.pickingobject) {
            var outevent = {type: "mouseout", element: oldpickedthing, relatedTarget: pickedthing, data: hit};
            this.view.proxyEvent(outevent);
          }
          this.pickingobject = hit.object;
          if (this.pickingobject) {
            var overevent = {type: "mouseover", element: pickedthing, relatedTarget: oldpickedthing, data: hit, clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey};
            this.view.proxyEvent(overevent);
          }
        }
        if (!this.lastmove || !this.lastmove.equals(hit.point)) {
          var moveevent = {type: "mousemove", element: pickedthing, data: hit, clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey};
          this.view.proxyEvent(moveevent);

          this.lastmove = hit.point;
        }
      } else {
        if (this.pickingobject) {
          //console.log('mouseout', this.pickingobject);
          var outevent = {type: "mouseout", element: pickedthing, data: hit};
          this.view.proxyEvent(outevent);
          this.pickingobject = false;
        }
      }
      return true;
    }
    this.getPickingData = function(obj) {
      return this.lasthit;
    }
    this.keydown = function(ev) {
      for (var k in this.keystates) {
        this.keystates[k] = ev[k];
      }
    }
    this.keyup = function(ev) {
      for (var k in this.keystates) {
        this.keystates[k] = ev[k];
      }
    }

    this.init();
  });
});
