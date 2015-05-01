elation.require([
  "engine.external.three.three",
  "engine.external.three.stats",
  "engine.external.threex.renderstats",
  "engine.external.three.render.CSS3DRenderer",
  "engine.external.three.render.EffectComposer",
  "engine.external.three.render.RenderPass",
  "engine.external.three.render.OculusRiftEffect",
  "engine.external.three.render.OculusRenderPass",
  "engine.external.three.render.ShaderPass",
  "engine.external.three.render.MaskPass",
  "engine.external.three.render.CopyShader",
  //"engine.external.three.render.SepiaShader",
  //"engine.external.three.render.BleachBypassShader",
  //"engine.external.three.render.FilmShader",
  //"engine.external.three.render.FilmPass",
  //"engine.external.three.render.ConvolutionShader",
  "engine.external.three.render.BloomPass",
  //"engine.external.three.render.SSAOShader",
  "engine.external.three.render.FXAAShader",
  "engine.external.three.fonts.helvetiker_regular",
  //"engine.external.three.fonts.drive-thru_regular",
  "engine.materials",
  "engine.geometries",
], function() {
  elation.requireCSS('ui.slider');

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
      this.renderer = new THREE.WebGLRenderer({antialias: false, logarithmicDepthBuffer: false, alpha: true, preserveDrawingBuffer: true});
      this.cssrenderer = new THREE.CSS3DRenderer();
      this.renderer.autoClear = false;
      this.renderer.setClearColor(0xffffff, 0);
      this.renderer.shadowMapEnabled = true;
      this.renderer.shadowMapType = THREE.PCFSoftShadowMap;
      this.lastframetime = 0;

      elation.events.add(this.engine.systems.world, 'world_change,world_thing_add,world_thing_remove,world_thing_change', this);
      // FIXME - globally-bound events are dirty, things should fire events when their properties change
      elation.events.add(null, 'physics_update,thing_drag_move,thing_rotate_move,engine_texture_load', elation.bind(this, this.setdirty));
    }
    this.setdirty = function() {
      this.dirty = true;
    }
    this.system_detach = function(ev) {
      console.log('SHUTDOWN: render');
    }
    this.engine_frame = function(ev) {
      this.lastframetime += ev.data.delta;
      if (this.forcerefresh || this.dirty) {
        //console.log('FRAME: render');
        this.dirty = false;
        this.renderer.clear();
        for (var k in this.views) {
          this.views[k].render(this.lastframetime);
        }
        this.lastframetime = 0;
      }
      for (var k in this.views) {
        this.views[k].updatePickingObject();
        if (this.views[k].stats) {
          this.views[k].stats.update();
        }
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
      this.size = [0, 0];
      this.size_old = [0, 0];
      this.scale = 100;
      this.showstats = this.args.showstats || false;
      this.fullscreen = false;
      this.renderpasses = {};


      // Used by various render pass shaders
      this.sizevec = new THREE.Vector2();
      this.sizevecinverse = new THREE.Vector2();

      this.rendermode = this.args.rendermode || 'default';

      if (this.args.fullsize == 1) {
        elation.html.addclass(this.container, "engine_view_fullsize");
      }
      this.keystates = {shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };
      elation.events.add(window, "resize,keydown,keyup", this);
      elation.events.add(document.body, "mouseenter,mouseleave", this);
      elation.events.add(this.container, "mouseover,mousedown,mousemove,mouseup,mousewheel,dragover,click,touchstart,touchmove,touchend", this);
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

      var cam = new THREE.PerspectiveCamera(60, this.container.offsetWidth / this.container.offsetHeight, 1e-2, 1e4);
      this.actualcamera = cam;

      this.setcamera(cam);

      this.setscene(this.engine.systems.world.scene['world-3d']);
      if (this.engine.systems.world.scene['sky']) {
        this.setskyscene(this.engine.systems.world.scene['sky']);
      }
      //console.log(this.engine.systems.world.scene['world-3d']);

      // Depth shader, used for SSAO, god rays, etc
      var depthShader = THREE.ShaderLib[ "depthRGBA" ];
      var depthUniforms = THREE.UniformsUtils.clone( depthShader.uniforms );

      this.depthMaterial = new THREE.ShaderMaterial( { fragmentShader: depthShader.fragmentShader, vertexShader: depthShader.vertexShader, uniforms: depthUniforms } );
      this.depthMaterial.blending = THREE.NoBlending;
      this.depthTarget = new THREE.WebGLRenderTarget( this.size[0], this.size[1], { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

      //this.composer = this.createRenderPath([this.rendermode, 'fxaa']);
      this.composer = this.createRenderPath([this.rendermode]);
      if (this.showstats) {
        elation.events.add(this.composer.passes[0], 'render', elation.bind(this, this.updateRenderStats));
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

      if (this.picking) {
        this.mousepos = [0, 0, document.body.scrollTop];
        this.lastmousepos = [-1, -1, -1];
        this.initPickingMaterial();

        this.pickingdebug = false;

        //this.engine.systems.controls.addCommands('view', {'picking_debug': elation.bind(this, function() { this.pickingdebug = !this.pickingdebug; this.rendersystem.dirty = true; })});
        //this.engine.systems.controls.addBindings('view', {'keyboard_p': 'picking_debug'});
        //this.engine.systems.controls.activateContext('view');
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
console.log('NEW PASS:', i, target, passes[i], pass);
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
      if (!target && !renderToScreen) {
        var pass = this.createRenderPass('screenout');
        composer.addPass(pass);
      }

      return composer;
    }
    this.createRenderPass = function(name, args) {
      var pass = false;
      switch (name) {
        case 'default':
          pass = new THREE.RenderPass(this.scene, this.actualcamera, null, null, 0);
          break;
        case 'oculus':
          pass = new THREE.OculusRenderPass(this.scene, this.actualcamera, null, null, 0);
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
          break;
        case 'film':
          pass = new THREE.FilmPass( 0.35, .75, 2048, false );
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
          pass = new THREE.BloomPass(.25);
          break;
        case 'fxaa':
          pass = new THREE.ShaderPass( THREE.FXAAShader );
          pass.uniforms[ 'resolution' ].value = this.sizevecinverse;
          break;
        case 'ssao':
          pass = new THREE.ShaderPass( THREE.SSAOShader );
          pass.uniforms[ 'size' ].value = this.sizevec;
          pass.uniforms[ 'tDepth' ].value = this.depthTarget;
          pass.uniforms[ 'cameraNear' ].value = this.actualcamera.near;
          pass.uniforms[ 'cameraFar' ].value = this.actualcamera.far;
          //pass.clear = true;
      }
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
      this.pickingcomposer.passes[passidx] = pass;
      pass.camera = this.actualcamera;

      this.rendermode = mode;

      this.rendersystem.setdirty();
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
        }
        if (this.skycamera) {
          // Sky camera needs to use our camera's world rotation, and nothing else
          this.camera.matrixWorld.decompose( _position, _quaternion, _scale );
          this.skycamera.quaternion.copy(_quaternion);
        }
      }
    })();
    this.render = function(delta) {
      if (this.scene && this.camera) {
        this.updateCameras();
        if (this.size[0] != this.size_old[0] || this.size[1] != this.size_old[1] || this.scale != this.scale_old) {
          this.setrendersize(this.size[0], this.size[1]);
        }

        //this.setcameranearfar();

        elation.events.fire({type: 'render_view_prerender', element: this});

        var dims = elation.html.dimensions(this.container);
        if (this.picking && this.pickingactive) {
          //if (this.pickingdebug || this.picknum++ % 3 == 0 || delta > 0.05) {
            this.updatePickingTarget();
          //}
        }
        if (this.pickingdebug) {
          if (!this.pickingdebugscene) {
            // If this is our first time showing the picking debug screen, create the scene, 
            // camera, and quad to display it
            // FIXME - this should just use the pickingdebugcomposer which does exactly this internally
            this.pickingdebugscene = new THREE.Scene();
            this.pickingdebugcam = new THREE.OrthographicCamera( -1, 1, 1, -1, 0, 1 );
            //this.pickingdebugscene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.pickingtarget})));
            this.pickingdebugscene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: this.pickingcomposer.output})));
            //plane.position.set(0,0,-1);
            this.pickingdebugscene.add(this.pickingdebugcam);
  /*
            this.pickingdebugscene = true;
            this.pickingdebugcomposer = this.createRenderPath(['copy', 'copy', 'screenout'], this.pickingtarget);
  */
          }
          //this.rendersystem.renderer.clear();
          this.rendersystem.renderer.render(this.pickingdebugscene, this.pickingdebugcam);
          //this.pickingdebugcomposer.render();
        } else {
          this.scene.overrideMaterial = this.depthMaterial;
          //this.rendersystem.renderer.render(this.scene, this.actualcamera, this.depthTarget, true);

          this.scene.overrideMaterial = null;
          this.composer.render(delta);
          //this.rendersystem.renderer.render(this.scene, this.actualcamera);
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
    }
    this.toggleStats = function() {
      if (this.showstats) {
        this.container.removeChild(this.renderstats.domElement)
        this.container.removeChild(this.stats.domElement);
        this.showstats = false;
      } else {
        this.container.appendChild(this.renderstats.domElement)
        this.container.appendChild(this.stats.domElement);
        this.showstats = true;
      }
    }
    this.setactivething = function(thing) {
      if (thing.camera) {
        this.setcamera(thing.camera);
        // update camera aspect ratio
        this.getsize();
      }
    }
    this.setcamera = function(camera) {
      if (camera instanceof elation.component.base && camera.type == 'camera') {
        camera = camera.objects['3d'];
      }
      this.camera = camera;
      this.setscene(this.getscene(camera));
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
      this.scene = scene;
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

      while ( scene.parent !== undefined ) {
        scene = scene.parent;
      }
      if ( scene !== undefined && scene instanceof THREE.Scene )  {
        return scene;
      }
      return false;
    }
    this.getsize = function() {
      //this.size = [this.container.offsetWidth, this.container.offsetHeight];
      var s = elation.html.dimensions(this.container);
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
      this.rendersystem.renderer.domElement.style.transformOrigin = '0 0';
      this.rendersystem.renderer.domElement.style.transform = 'scale3d(' + [invscale, invscale, invscale].join(',') + ')';
      this.sizevec.set(scaledwidth, scaledheight);
      this.sizevecinverse.set(1/scaledwidth, 1/scaledheight);
      this.rendersystem.renderer.setSize(scaledwidth, scaledheight);  
      if (this.rendersystem.cssrenderer) {
        this.rendersystem.cssrenderer.setSize(width, height);  
      }
      this.composer.setSize(scaledwidth, scaledheight);
      if (this.pickingcomposer) {
        this.pickingcomposer.setSize(scaledwidth, scaledheight);
      }
      if (this.effects['FXAA']) {
        this.effects['FXAA'].uniforms[ 'resolution' ].value.set( 1 / scaledwidth, 1 / scaledheight);
      }
      if (this.effects['SSAO']) {
        this.depthTarget = new THREE.WebGLRenderTarget( width, height, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, format: THREE.RGBAFormat } );

        this.effects['SSAO'].uniforms[ 'size' ].value.set( width, height);
        this.effects['SSAO'].uniforms[ 'tDepth' ].value = this.depthTarget;
      }
      if (this.skycamera) {
        this.skycamera.aspect = width / height;
        this.skycamera.updateProjectionMatrix();
      }
      if (this.camera) {
        this.camera.aspect = width / height;
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
      this.mousepos = [ev.clientX, ev.clientY, document.body.scrollTop];
    }
    this.mousemove = function(ev) {
      this.mousepos = [ev.clientX, ev.clientY, document.body.scrollTop];
      this.cancelclick = true;
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
        if (this.pickingobject) {
          var fired = elation.events.fire({type: "mouseout", element: this.getParentThing(this.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY});
          this.pickingobject = false;
          for (var i = 0; i < fired.length; i++) {
            if (fired[i].cancelBubble) ev.stopPropagation();
          }
        }
      }
    }
    this.mouseup = function(ev) {
      if (this.pickingactive && this.pickingobject) {
        var fired = elation.events.fire({type: 'mouseup', element: this.getParentThing(this.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY]), clientX: ev.clientX, clientY: ev.clientY, button: ev.button});
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble) ev.stopPropagation();
        }
      }
    }
    this.click = function(ev) {
      if (this.pickingactive && this.pickingobject && !this.cancelclick) {
        var fired = elation.events.fire({type: 'click', element: this.getParentThing(this.pickingobject), data: this.getPickingData(this.pickingobject, [ev.clientX, ev.clientY])});
        for (var i = 0; i < fired.length; i++) {
          if (fired[i].cancelBubble) ev.stopPropagation();
        }
      }
      if (ev && ev.preventDefault) {
        ev.preventDefault();
      }
    }
/*
    this.touchstart = function(ev) {
      this.toggleFullscreen(true);
      this.mousepos = [ev.touches[0].clientX, ev.touches[0].clientY, document.body.scrollTop];
      this.updatePickingObject();
      this.mousedown(ev.touches[0]);
    }
    this.touchmove = function(ev) {
      this.mousepos = [ev.touches[0].clientX, ev.touches[0].clientY, document.body.scrollTop];
      this.mousemove(ev.touches[0]);
    }
    this.touchend = function(ev) {
      this.mouseup(ev);
      this.click();
    }
*/
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
      this.pickingtarget = new THREE.WebGLRenderTarget(this.size[0], this.size[1], {minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false});
      this.pickingtarget.generateMipmaps = false;

      this.pickingcomposer = this.createRenderPath([this.rendermode], this.pickingtarget);
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
    this.updatePickingTarget = function(force) {
      // ratelimit to once every n frames, for performance reasons
      //if (!this.pickingdebug && this.picknum++ % 3 != 0) return;
      /*
      var now = new Date().getTime();
      if (now - this.picktime < 1000/20 && !force) {
        return;
      }
      this.picktime = now;
      */

      this.pickingobjects = [];
      this.realmaterials = [];
      this.realvisible = [];
      var objid = 1;
      // replace texture with placeholder
      this.scene.traverse(elation.bind(this, function(node) {
        if (node.material) {
          var objid = node.id;
          this.realvisible[objid] = node.visible;
          this.realmaterials[objid] = node.material;
          var parent = this.getParentThing(node);
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
      for (var id in this.pickingobjects) {
        if (this.realmaterials[id]) {
          this.pickingobjects[id].material = this.realmaterials[id];
        }
        this.pickingobjects[id].visible = this.realvisible[id];
      }


    }
    this.updatePickingObject = function() {
      if (this.picking && this.pickingactive && (this.mousepos[0] != this.lastmousepos[0] || this.mousepos[1] != this.lastmousepos[1] || this.mousepos[2] != this.lastmousepos[2])) {
        var dims = elation.html.dimensions(this.container);
        this.pick(this.mousepos[0] - dims.x, this.mousepos[1] - dims.y);
        this.lastmousepos[0] = this.mousepos[0];
        this.lastmousepos[1] = this.mousepos[1];
        this.lastmousepos[2] = this.mousepos[2];
      }
    }
    this.pick = function(x, y) {
      //var oldframebuffer = this.glcontext.bindFramebuffer();

      this.rendersystem.renderer.setRenderTarget( this.pickingcomposer.output );
      var s = elation.html.dimensions(this.container);
      var scale = this.scale / 100;
      this.glcontext.readPixels((x + s.left) * scale, (this.container.offsetHeight - (y + s.top)) * scale, 1, 1, this.glcontext.RGBA, this.glcontext.UNSIGNED_BYTE, this.pickingbuffer);
      this.rendersystem.renderer.setRenderTarget( null );
      
      var pickid = (this.pickingbuffer[0] << 16) + (this.pickingbuffer[1] << 8) + (this.pickingbuffer[2]);
      var pickedthing = false, oldpickedthing = false;
      if (this.pickingobject) {
        pickedthing = oldpickedthing = this.getParentThing(this.pickingobject);
      }

      if (pickid > 0) {
        if (this.pickingobject !== this.pickingobjects[pickid]) {
          pickedthing = this.getParentThing(this.pickingobjects[pickid]);
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
    this.getPickingData = function(mesh, mousepos) {
      return new elation.engine.systems.render.picking_intersection(mesh, mousepos, this);
    }
  });
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
        projector.unprojectVector(mouse3d, viewport.camera);

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
});
