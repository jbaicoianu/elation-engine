elation.require([
  "engine.external.three.three",
  "engine.external.three.stats",
  "engine.external.threex.renderstats",
  "engine.external.three.render.CSS3DRenderer",
  "engine.external.three.render.EffectComposer",
  "engine.external.three.render.RenderPass",
  "engine.external.three.render.PortalRenderPass",
  "engine.external.three.render.OculusRiftEffect",
  "engine.external.three.render.OculusRenderPass",
  "engine.external.three.render.VREffect",
  "engine.external.three.render.ShaderPass",
  "engine.external.three.render.MaskPass",
  "engine.external.three.render.CopyShader",
  "engine.external.three.render.RecordingPass",
  "engine.external.three.CubemapToEquirectangular",

  "engine.external.threecap.threecap",
  "engine.external.webvr-polyfill",

  //"engine.external.gifjs.gif",
  //"engine.external.ffmpeg.ffmpeg",
  //"engine.external.ffmpeg.ffmpeg_minimal",
  //"engine.external.three.render.SepiaShader",
  //"engine.external.three.render.BleachBypassShader",
  //"engine.external.three.render.FilmShader",
  //"engine.external.three.render.FilmPass",
  "engine.external.three.render.ConvolutionShader",
  "engine.external.three.render.BloomPass",
  "engine.external.three.render.ClearPass",
  "engine.external.three.render.SSAOShader",
  "engine.external.three.render.FXAAShader",
  "engine.external.three.render.ManualMSAARenderPass",
  "engine.materials",
  "engine.geometries",
  "ui.select",
  "ui.slider",
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

    this.system_attach = function(ev) {
      console.log('INIT: render');
      this.renderer = new THREE.WebGLRenderer({antialias: true, logarithmicDepthBuffer: false, alpha: true, preserveDrawingBuffer: true});
      this.cssrenderer = new THREE.CSS3DRenderer();
      this.renderer.autoClear = false;
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.renderer.gammaInput = false;
      this.renderer.gammaOutput = false;
      //this.renderer.gammaFactor = 2.2;

      this.lastframetime = 0;

      elation.events.add(this.engine.systems.world, 'world_change,world_thing_add,world_thing_remove,world_thing_change', this);

      // FIXME - globally-bound events are dirty, things should fire events when their properties change
      elation.events.add(null, 'physics_update,thing_drag_move,thing_rotate_move,engine_texture_load', elation.bind(this, this.setdirty));
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
      this.lastframetime += ev.data.delta;
      for (var k in this.views) {
        this.views[k].updatePickingObject();
        if (this.views[k].stats) {
          this.views[k].stats.update();
        }
      }
      if (this.forcerefresh || this.dirty) {
        //console.log('FRAME: render');
        this.dirty = false;
        this.renderer.clear();
        for (var k in this.views) {
          this.views[k].render(this.lastframetime);
        }
        this.lastframetime = 0;
      }
    }
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
      this.useWebVRPolyfill = elation.utils.any(this.args.useWebVRPolyfill, true);
      this.size = [0, 0];
      this.size_old = [0, 0];
      this.scale = 100;
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
      elation.events.add(window, "resize", this);
      elation.events.add(document.body, "mouseenter,mouseleave", this);
      elation.events.add(this.container, "mouseover,mousedown,mousemove,mouseup,mousewheel,dragover,click,touchstart,touchmove,touchend", this);
      elation.events.add(document, "pointerlockchange,mozpointerlockchange", elation.bind(this, this.pointerlockchange));
      elation.events.add(window, 'vrdisplayconnect,vrdisplaydisconnect', elation.bind(this, this.initVRDisplays));
      this.container.tabIndex = 1;
      if (!this.args.engine) {
        console.log("ERROR: couldn't create view, missing engine parameter");
      } else if (typeof elation.engine.instances[this.args.engine] == 'undefined') {
        console.log("ERROR: couldn't create view, engine '" + this.args.engine + "' doesn't exist");
      } else {
        this.engine = elation.engine.instances[this.args.engine];
        this.create();
      }
    }
    this.create = function() {
      this.rendersystem = this.engine.systems.render;

      if (!this.rendersystem.renderer.domElement.parentNode) {
        this.container.appendChild(this.rendersystem.renderer.domElement);
      }
      if (this.rendersystem.cssrenderer && !this.rendersystem.cssrenderer.domElement.parentNode) {
        this.container.appendChild(this.rendersystem.cssrenderer.domElement);
        elation.html.addclass(this.rendersystem.cssrenderer.domElement, 'engine_systems_render_css3d');
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
      this.depthTarget = new THREE.WebGLRenderTarget( this.size[0], this.size[1], { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

      //this.composer = this.createRenderPath([this.rendermode]);
      this.rendertarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          format: THREE.RGBAFormat,
          stencilBuffer: true
        });
      this.composer = this.createRenderPath(['clear', /*'portals', 'masktest',*/ this.rendermode, 'fxaa'/*, 'msaa'*/, 'bloom', 'maskclear', 'recording'], this.rendertarget);
      //this.composer = this.createRenderPath(['clear', this.rendermode, 'fxaa'/*, 'msaa'*/, 'bloom', 'maskclear'], this.rendertarget);
      //this.effects['msaa'].enabled = false;
      //this.composer = this.createRenderPath([this.rendermode, 'ssao', 'recording']);
      this.vreffect = new THREE.VREffect(this.rendersystem.renderer, function(e) { console.log('ERROR, ERROR', e); });
      //this.vreffect = new THREE.VREffect(this.composer, function(e) { console.log('ERROR, ERROR', e); });
      this.vreffect.preRenderLeft = elation.bind(this.vreffect, function(scene, camera) {
        var sbstextures = [];
        scene.traverse(function(n) {
          if (n.material) {
            if (n.material instanceof THREE.MultiMaterial) {
              n.material.materials.forEach(function(m) {
                if (m.map instanceof THREE.SBSTexture) {
                  sbstextures.push(m.map);
                }
              });
            } else if (n.material.map instanceof THREE.SBSTexture) {
              sbstextures.push(n.material.map);
            }
          }
        });
        sbstextures.forEach(function(t) {
          t.setEye('left');
        });
        this.sbstextures = sbstextures;
      });
      this.vreffect.preRenderRight = elation.bind(this.vreffect, function(scene, camera) {
        if (this.sbstextures) {
          this.sbstextures.forEach(function(t) {
            t.setEye('right');
          });
        }
      });
      //this.vreffect = new THREE.VREffect(this.rendersystem.renderer, function(e) { console.log('ERROR, ERROR', e); });

      this.vrdisplay = false;
      this.initVRDisplays();

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
            } 
          }),
          'picking_select': elation.bind(this, function(ev) {
            if (ev.value == 1) {
              this.click({clientX: this.mousepos[0], clientY: this.mousepos[1]});
            }
          })
        });
        this.engine.systems.controls.addBindings('view', {'keyboard_f7': 'picking_debug'});
        this.engine.systems.controls.addBindings('view', {'gamepad_0_button_0': 'picking_select'});
        this.engine.systems.controls.activateContext('view');
      }
    }
    this.initVRDisplays = function() {
      if (this.useWebVRPolyfill && ENV_IS_BROWSER && !navigator.getVRDisplays && !this.initializedPolyfill && typeof InitializeWebVRPolyfill != 'undefined') {
        this.initializedPolyfill = true;
        InitializeWebVRPolyfill();
      }
      if (navigator.getVRDisplays) {
        // WebVR 1.0 spec
        navigator.getVRDisplays().then(function(n) {
          for (var i = 0; i < n.length; i++) {  
            if (n[i] instanceof VRDisplay) {
              this.vrdisplay = n[i];
              elation.events.fire({element: this, type: 'engine_render_view_vr_detected', data: this.vrdisplay});
              elation.events.add(window, 'vrdisplayactivate', elation.bind(this, this.toggleVR, true));
              elation.events.add(window, 'vrdisplaydeactivate', elation.bind(this, this.toggleVR, false));
              break;
            }
          }
        }.bind(this));
        
      } else if (navigator.getVRDevices) {
        navigator.getVRDevices().then(function(n) {
          for (var i = 0; i < n.length; i++) {  
            if (n[i] instanceof HMDVRDevice) {
              this.vrdisplay = n[i];
              console.log('COOL FOUND A VR DEVICE', this.vrdisplay);
              setTimeout(elation.bind(this, function() {
                //this.engine.client.toggleVR({value: 1});
              }), 1000);
              break;
            }
          }
        }.bind(this));
      }
    }
    this.destroy = function() {
      if (this.vrdisplay && this.vrdisplay.isPresenting) {
        // FIXME - doesn't really help...
        this.vrdisplay.exitPresent();
      }
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
          pass = new THREE.RenderPass(this.scene, this.actualcamera, null, null, 0);
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
          pass = new THREE.ShaderPass( THREE.SSAOShader );
          pass.uniforms[ 'size' ].value = this.sizevec;
          pass.uniforms[ 'tDepth' ].value = this.depthTarget;
          pass.uniforms[ 'cameraNear' ].value = this.actualcamera.near;
          pass.uniforms[ 'cameraFar' ].value = this.actualcamera.far;
          //pass.clear = true;
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
        fullscreen = !this.fullscreen;
      } else if (typeof fullscreen.data != 'undefined') {
        fullscreen = fullscreen.data;
      }
      
      if (fullscreen) {
        //var c = this.container;
        var c = document.body;
        c.requestFullscreen = c.requestFullscreen || c.webkitRequestFullscreen || c.mozRequestFullScreen;
        if (typeof c.requestFullscreen == 'function') {
          //c.requestFullscreen({vrDisplay: this.vrdisplay});
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
    this.toggleVR = function(newstate) {
      if (this.vrdisplay) {
        if (typeof newstate == 'undefined') newstate = !this.vrdisplay.isPresenting;

        // FIXME - DEMO HACK 
        var hmdname = this.vrdisplay.displayName;
        var vivehack = false;
        if (hmdname.match('Vive')) {
          vivehack = true;
        }
        var player = this.engine.client.player;

        if (newstate && !this.vrdisplay.isPresenting) {
if (vivehack) {
  //player.head.reparent(player);
}
          this.vrdisplay.requestPresent([{
            source: this.rendersystem.renderer.domElement,
            leftBounds: [0.0, 0.0, 0.5, 1.0],
            rightBounds: [0.5, 0.0, 0.5, 1.0]
          }]).then(elation.bind(this, function() {
            var eyeL = this.vrdisplay.getEyeParameters('left');
            var eyeR = this.vrdisplay.getEyeParameters('right');

            this.aspectscale = 1;
            this.getsize();
            this.setrendersize(this.size[0], this.size[1]);

            this.pickingactive = true;
            this.mousepos = [this.size[0] / 2, this.size[1] / 2, 0];

            elation.events.fire({element: this, type: 'engine_render_view_vr_start'});
          }));
        } else if (this.vrdisplay.isPresenting && !newstate) {
          this.vrdisplay.exitPresent().then(elation.bind(this, function() {
            this.camera.fov = 75;
            this.aspectscale = 1;
            this.getsize();
            this.setrendersize(this.size[0], this.size[1]);
//if (vivehack) player.head.reparent(player.neck);
            elation.events.fire({element: this, type: 'engine_render_view_vr_end'});
          }));
        }
      }
      this.getsize();
    }
    this.updateCameras = (function() {
      // Closure scratch variables
      var _position = new THREE.Vector3(),
          _quaternion = new THREE.Quaternion(),
          _scale = new THREE.Vector3();
      
      return function() {
        // Make sure the parent's matrixWorld is up to date
        if (this.camera.parent) {
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
          this.actualcamera.rotation.copy(this.camera.rotation);
          this.actualcamera.quaternion.copy(this.camera.quaternion);

          if (this.actualcamera.fov != this.camera.fov ||
              this.actualcamera.near != this.camera.near ||
              this.actualcamera.far != this.camera.far ||
              this.actualcamera.aspect != this.camera.aspect) {
          
            this.actualcamera.fov = this.camera.fov;
            this.actualcamera.near = this.camera.near;
            this.actualcamera.far = this.camera.far;
            this.actualcamera.aspect = this.camera.aspect;

            this.actualcamera.updateProjectionMatrix();
          }
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
    this.render = function(delta) {
      if (this.scene && this.camera) {
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
        if (this.pickingdebug && this.scene != this.engine.systems.world.scene['colliders']) {
          this.setscene(this.engine.systems.world.scene['colliders']);
        } else if (!this.pickingdebug && this.scene != this.engine.systems.world.scene['world-3d']) {
          this.setscene(this.engine.systems.world.scene['world-3d']);
        }
        /*
        this.scene.overrideMaterial = this.depthMaterial;
        //this.rendersystem.renderer.render(this.scene, this.actualcamera, this.depthTarget, true);

        this.scene.overrideMaterial = null;
        */
        //this.rendersystem.renderer.render(this.scene, this.actualcamera);

        if (this.vrdisplay) {
          var player = this.engine.client.player;
          player.updateHMD(this.vrdisplay);
        } 

        if (this.vrdisplay && this.vrdisplay.isPresenting) {
          this.vreffect.render(this.scene, this.camera);
        } else {
          this.composer.render(delta);
        }

        if (this.rendersystem.cssrenderer) {
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
        // update camera aspect ratio
        this.getsize();
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
    this.getsize = function() {
      //this.size = [this.container.offsetWidth, this.container.offsetHeight];
      var s = (this.args.fullsize ? {w: window.innerWidth, h: window.innerHeight} : 
              (this.args.resolution ? {w: this.args.resolution[0], h: this.args.resolution[1]} : 
               elation.html.dimensions(this.container)
              ));
      if (this.vrdisplay && this.vrdisplay.isPresenting) {
        var leftEye = this.vrdisplay.getEyeParameters("left");
        var rightEye = this.vrdisplay.getEyeParameters("right");

        s = {
          w: Math.max(leftEye.renderWidth, rightEye.renderWidth) * 2,
          h: Math.max(leftEye.renderHeight, rightEye.renderHeight)
        };
      }
      var domel = this.rendersystem.renderer.domElement;
      if (s.w != domel.width || s.h != domel.height) {
        this.size = [s.w, s.h];
        this.setrendersize(this.size[0], this.size[1]);
      }
      this.rendersystem.setdirty();

      return this.size;
    }
    this.setrendersize = function(width, height) {
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
      this.rendersystem.renderer.setPixelRatio(window.devicePixelRatio ? window.devicePixelRatio : 1);
      this.rendersystem.renderer.setSize(scaledwidth, scaledheight);  
      if (this.composer) {
        this.composer.setSize(scaledwidth, scaledheight);  
      }
      if (this.vreffect) {
        this.vreffect.setSize(scaledwidth, scaledheight);  
      }
      if (this.rendersystem.cssrenderer) {
        this.rendersystem.cssrenderer.setSize(width, height);  
      }
      //this.composer.setSize(scaledwidth, scaledheight);
      if (this.pickingcomposer) {
        this.pickingcomposer.setSize(scaledwidth, scaledheight);
      }
      if (this.effects['SSAO']) {
        this.depthTarget = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat, stencilBuffer: true } );

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
      this.getsize();
    }
    this.mouseover = function(ev) {
      if (!this.pickingactive) {
        //elation.events.add(this.container, 'mousemove,mouseout', this);
        this.pickingactive = true;
      }
      this.mousepos = [ev.clientX, ev.clientY, document.body.scrollTop];
    }
    this.mousedown = function(ev) {
      if (this.pickingactive && this.pickingobject) {
        this.cancelclick = false;
        var fired = elation.events.fire({type: 'mousedown', element: this.getParentThing(this.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, button: ev.button, shiftKey: ev.shiftKey, altKey: ev.altKey, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey});
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble === true) { ev.stopPropagation(); }
          if (fired[i].returnValue === false) { ev.preventDefault(); }
        }
      }
    }
    this.mousewheel = function(ev) {
      this.mousepos[0] = ev.clientX;
      this.mousepos[1] = ev.clientY;
      this.mousepos[2] = document.body.scrollTop;
    }
    this.mousemove = function(ev) {
      var el = document.pointerLockElement || document.mozPointerLockElement;
      if (el) {
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
    this.dragover = function(ev) {
      if (!this.pickingactive) {
        this.pickingactive = true;
      }
      this.mousemove(ev);
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
          var fired = elation.events.fire({type: "mouseout", element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY});
          this.pickingobject = false;
          for (var i = 0; i < fired.length; i++) {
            if (fired[i].cancelBubble) ev.stopPropagation();
          }
        }
      }
    }
    this.mouseup = function(ev) {
      if (this.pickingactive && this.pickingobject) {
        var fired = elation.events.fire({type: 'mouseup', element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, button: ev.button});
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble) ev.stopPropagation();
        }
      }
    }
    this.click = function(ev) {
      if (this.pickingactive && this.picker.pickingobject && !this.cancelclick) {
        var fired = elation.events.fire({type: 'click', element: this.getParentThing(this.picker.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY])});
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble && ev.stopPropagation) ev.stopPropagation();
        }
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
      if (!this.isFullscreen()) {
        this.toggleFullscreen(true);
        this.cancelclick = true;
      } else {
        this.mousepos = [Math.round(ev.touches[0].clientX), Math.round(ev.touches[0].clientY), document.body.scrollTop];
        this.updatePickingObject();
        this.mousedown(ev.touches[0]);
      }
    }
    this.touchmove = function(ev) {
      this.mousepos = [ev.touches[0].clientX, ev.touches[0].clientY, document.body.scrollTop];
      this.mousemove(ev.touches[0]);
    }
    this.touchend = function(ev) {
      this.mouseup(ev);
      this.click({clientX: this.mousepos[0], clientY: this.mousepos[1]});
      if (this.pickingactive) {
        this.pickingactive = false;
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
        var cubecam = new THREE.CubeCamera(camera.near, camera.far, width);
        cubecam.position.set(0,0,0).applyMatrix4(camera.matrixWorld);
        this.scene.add(cubecam);

        if (raw) {
          cubecam.updateCubeMap(renderer, this.scene);
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
  elation.extend("engine.systems.render.picking_intersection", function(mesh, mousepos, viewport) {
    // Represents an intersection between the mouse and an object in the scene as viewed from the specified viewport

    this.init = function() {
      this.object = mesh;
      this.thing = this.getParentThing(mesh);

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
            elation.events.fire({type: "mouseout", element: oldpickedthing, relatedTarget: pickedthing, data: this.getPickingData(this.pickingobject, [x, y])});
          }
          this.pickingobject = this.pickingobjects[pickid];
          if (this.pickingobject) {
            elation.events.fire({type: "mouseover", element: pickedthing, relatedTarget: oldpickedthing, data: this.getPickingData(this.pickingobject, [x, y]), clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey});
          }
        }
        elation.events.fire({type: "mousemove", element: pickedthing, data: this.getPickingData(this.pickingobject, [x, y]), clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey});
      } else {
        if (this.pickingobject) {
          //console.log('mouseout', this.pickingobject);
          elation.events.fire({type: "mouseout", element: pickedthing, data: this.getPickingData(this.pickingobject, [x, y])});
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
    this.getPickingData = function(mesh, mousepos) {
      return new elation.engine.systems.render.picking_intersection(mesh, mousepos, this);
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
    this.raycaster = new THREE.Raycaster();
    this.keystates = {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
    this.lastmousepos = [0, 0, 0];
    this.mousevec = new THREE.Vector2();

    this.init = function() {
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

      this.scene.updateMatrixWorld();
      this.view.actualcamera.updateMatrixWorld();
      this.raycaster.setFromCamera(this.mousevec, this.view.actualcamera);
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
        if (!(hit.object instanceof THREE.EdgesHelper)) {
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
            elation.events.fire({type: "mouseout", element: oldpickedthing, relatedTarget: pickedthing, data: hit});
          }
          this.pickingobject = hit.object;
          if (this.pickingobject) {
            elation.events.fire({type: "mouseover", element: pickedthing, relatedTarget: oldpickedthing, data: hit, clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey});
          }
        }
        elation.events.fire({type: "mousemove", element: pickedthing, data: hit, clientX: x, clientY: y, shiftKey: this.keystates.shiftKey, altKey: this.keystates.altKey, ctrlKey: this.keystates.ctrlKey, metaKey: this.keystates.metaKey});
      } else {
        if (this.pickingobject) {
          //console.log('mouseout', this.pickingobject);
          elation.events.fire({type: "mouseout", element: pickedthing, data: hit});
          this.pickingobject = false;
        }
      }
      return true;
    }
    this.getPickingData = function(obj) {
      return this.lasthit;
    }

    this.init();
  });
});
