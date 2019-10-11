var deps = [ 
  "engine.parts",
  "engine.materials",
  "engine.assets",
  "engine.geometries",
  "engine.sharing",
  "engine.things.generic",
  "engine.things.menu",
  "engine.systems.ai",
  "engine.systems.controls",
  "engine.systems.physics",
  "engine.systems.sound",
  "engine.systems.world",
  "utils.math",
  "ui.panel"
];

if (true || elation.env.isBrowser) {
  deps = deps.concat([
    "engine.external.three.three",
    "engine.sharing",
    "engine.systems.render",
    "engine.systems.admin",
  ]);
} else if (elation.env.isNode) {
  deps.push("engine.external.three.three");
}

elation.require(deps, function() {
  elation.requireCSS('engine.engine');
  elation.requireCSS('ui.themes.dark');

  elation.extend("engine.instances", {});
  elation.extend("engine.create", function(name, systems, callback) {
    var engine = new elation.engine.main(name);
    elation.events.add(engine.systems, 'engine_systems_added', function() { callback(engine); })
    engine.systems.add(systems);
    this.instances[name] = engine;
    return engine;
  });
  elation.extend("engine.main", function(name) {
    this.started = false;
    this.running = false;
    this.name = name;
    this.useAnimationFrame = true;
    this.targetFramerate = 60;
    this.scratchobjects = {};

    this.init = function() {
      this.client = elation.engine.client(this.name);
      this.systems = new elation.engine.systemmanager(this);
      // shutdown cleanly if the user leaves the page
      var target = null;
      if (elation.env.isBrowser) target = window
      elation.events.add(target, "unload", elation.bind(this, this.stop)); 
      elation.engine.assets.init();
      elation.events.fire({element: this, type: "engine_init"});
    }
    this.start = function() {
      this.started = this.running = true;
      elation.events.fire({element: this, type: "engine_start"});
      this.lastupdate = performance.now();
      // Start run loop, passing in current time
      this.run(0);
    }
    this.stop = function() {
      if (this.running) {
        this.running = false;
        elation.events.fire({element: this, type: "engine_stop"});
      }
    }

    this.run = function(ts, xrpose) {
      // recursively request another frame until we're no longer running
      //if (!ts) ts = new Date().getTime();
      var ts = performance.now();
      if (this.running) {
        if (!this.boundfunc) this.boundfunc = elation.bind(this, this.run);
        this.frame(this.boundfunc);
      }
      var evdata = {
        ts: ts,
        delta: (ts - this.lastupdate) / 1000,
        pose: xrpose
      };
      // fire engine_frame event, which kicks off processing in any active systems
      //console.log("==========");
      elation.events.fire({type: "engine_frame", element: this, data: evdata});
      this.lastupdate = ts;
    }

    // simple requestAnimationFrame wrapper
    this.requestAnimationFrame = (elation.bind(this, function() {
        var framerate = this.targetFramerate || 60;
        if (this.useAnimationFrame && typeof window !== 'undefined') {
          // Browsers
          return  window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    || 
                  window.oRequestAnimationFrame      || 
                  window.msRequestAnimationFrame     || 
                  function( callback ) {
                    setTimeout(callback, 1000 / framerate);
                  };
        } else {
          // NodeJS
          return function( callback ) {
            setTimeout(callback, 1000 / this.targetFramerate);
          }.bind(this);
        }
      }))();
    this.frame = function(fn) {
      if (elation.env.isNode) var window;
      if (this.client && this.client.view && this.client.view.xrsession && this.client.view.xrsession.requestAnimationFrame) {
        this.client.view.xrsession.requestAnimationFrame(fn);
      } else if (this.client && this.client.view && this.client.view.vrdisplay && this.client.view.vrdisplay.requestAnimationFrame) {
        this.client.view.vrdisplay.requestAnimationFrame(fn);
      } else {
        this.requestAnimationFrame.call(window, fn);
      }
    }

    // Convenience functions for querying objects from world
    this.getThingsByTag = function(tag) {
      return this.systems.world.getThingsByTag(tag);
    }
    this.getThingsByType = function(type) {
      return this.systems.world.getThingsByType(type);
    }
    this.getThingByObject = function(obj) {
      return this.systems.world.getThingsByObject(object);
    }
    this.getThingsByProperty = function(key, value) {
      return this.systems.world.getThingsByProperty(key, value);
    }
    this.getThingById = function(id) {
      return this.systems.world.getThingById(id);
    }
    this.getScratchObject = function(name, type) {
      if (!this.scratchobjects[name]) {
        this.scratchobjects[name] = (type ? new type() : {});
      }
      return this.scratchobjects[name];
    }

    this.init();
  });
  elation.extend("engine.systemmanager", function(args) {
    this._engine = args;
    this.active = {};
    elation.events.add(this._engine, "engine_stop", elation.bind(this, this.shutdown));

    this.add = function(names, args) {
      // register and initialize new systems, which will respond to events emitted by the engine
      if (!elation.utils.isArray(names)) {
        names = [names];
      }
      var systems = {};
      var requires = names.map(function(a) { return "engine.systems." + a; });
      elation.require(requires, elation.bind(this, function() {
        for (var i = 0; i < names.length; i++) {
          var name = names[i];
          systems[name] = this[name] = new elation.engine.systems[name](args);
          this[name].attach(this._engine);
        }
        setTimeout(elation.bind(this, function() {
          elation.events.fire({element: this, type: 'engine_systems_added'});
        }), 0);
      }));
      return systems;
    }
    this.get = function(name) {
      return this[name];
    }
    this.shutdown = function() {
      console.log("shut down all the systems!");
    }
  });
  elation.extend("engine.systems.system", function(args) {
    this.engineevents = "engine_start,engine_frame,engine_stop";

    this.attach = function(engine) {
      this.engine = engine;
      elation.events.add(this, "system_attach,system_detach", this);
      elation.events.add(this.engine, this.engineevents, this);
      elation.events.fire({element: this, type: "system_attach"});
    }
    this.detach = function() {
      this.engine = false;
      elation.events.remove(this.engine, this.engineevents, this);
      elation.events.fire({element: this, type: "system_detach"});
    }
    this.handleEvent = function(ev) {
      if (typeof this[ev.type] == 'function') {
        this[ev.type](ev);
      }
    }
  });
  elation.component.add("engine.configuration", function() {
    this.init = function() {
      this.client = this.args.client;
      this.engine = this.client.engine;
      this.view = this.client.view;
      this.create();
      this.addclass('engine_configuration');
    }
    this.create = function() {
        var panels = this.initPanels();

        var configtabs = elation.ui.tabbedcontent({
          append: this,
          items: panels
        });
        this.tabs = configtabs;
    }
    this.initPanels = function(panels) {
      if (!panels) panels = {};

      /* Control Settings */
      panels['controls'] = {
        label: 'Controls', 
        content: elation.engine.systems.controls.config({
          controlsystem: this.engine.systems.controls
        })
      };

      /* Video Settings */
      panels['video'] = {
        label: 'Video',
        content: elation.engine.systems.render.config({
          client: this.client,
          rendersystem: this.engine.systems.render,
        })
      };

      /* Sound Settings */
      panels['sound'] = {
        label: 'Sound',
        content: elation.engine.systems.sound.config({
          client: this.client
        })
      };

      /* Share Settings */
      /*
      panels['sharing'] = {
        label: 'Sharing',
        content: elation.engine.sharing.config({
          client: this.client
        });
      };
      */
      return panels;
    }
    this.addPanel = function(name, component) {
      this.tabs.add(name, {label: name, content: component});
    }
    this.toggleFullscreen = function() {
      var view = this.view;
      if (view) {
        view.toggleFullscreen();
      }
    }
    this.toggleVR = function() {
      var view = this.view;
      if (view) {
        var mode = (view.rendermode == 'default' ? 'oculus' : 'default');
        view.setRenderMode(mode);
      }
    }
    this.calibrateVR = function() {
      if (this.engine.systems.controls) {
        this.engine.systems.controls.calibrateHMDs();
      }
    }
  }, elation.ui.panel);

  elation.component.add('engine.client', function() {
    this.init = function() {
      this.name = this.args.name || 'default';
      this.enginecfg = {
        systems: [
          "physics",
          "world",
          "ai",
          //"admin", 
          "render", 
          "sound", 
          "controls"
        ],
        crosshair: true,
        stats: true,
        picking: true,
        fullsize: true,
        resolution: null,
        useWebVRPolyfill: true,
        enablePostprocessing: true
      };
      this.setEngineConfig(this.args);
      this.initEngine();
      this.loadEngine();

      // Preload the default font
      elation.engine.assets.get({
        'assettype':'font', 
        'name':'helvetiker', 
        'src': elation.config.get('engine.assets.font.path', '/media/engine/fonts/') + 'helvetiker_regular.typeface.js'
      });

    }
    // Set up engine parameters before creating.  To be overridden by extending class
    this.initEngine = function() {
      var hashargs = elation.url();
       
      this.enginecfg.systems = [];
      this.enginecfg.systems.push("controls");
      this.enginecfg.systems.push("physics");
      this.enginecfg.systems.push("world");
      this.enginecfg.systems.push("ai");
      if (hashargs.admin == 1) {
        this.enginecfg.systems.push("admin");
      } 
      this.enginecfg.systems.push("render");
      this.enginecfg.systems.push("sound");
    }
    this.setEngineConfig = function(args) {
      var cfg = this.enginecfg;
      if (args.resolution) {
        cfg.resolution = args.resolution.split('x');;
        cfg.fullsize = false;
      } 
      if (args.fullsize !== undefined) cfg.fullsize = args.fullsize;
      if (args.crosshair !== undefined) cfg.crosshair = args.crosshair;
      if (args.picking !== undefined) cfg.picking = args.picking;
      if (args.stats !== undefined) cfg.stats = args.stats;
      if (args.useWebVRPolyfill !== undefined) cfg.useWebVRPolyfill = args.useWebVRPolyfill;
    }
    // Instantiate the engine
    this.loadEngine = function() {
      this.engine = elation.engine.create(
        this.name, 
        this.enginecfg.systems,
        elation.bind(this, this.startEngine)
      );
      this.engine.client = this;
    }
    this.initWorld = function() {
      // Virtual stub - inherit from elation.engine.client, then override this for your app
      var worldurl = elation.utils.arrayget(this.args, 'world.url');
      var worlddata = elation.utils.arrayget(this.args, 'world.data');
      var parsedurl = elation.utils.parseURL(document.location.hash);
      if (worldurl && !(parsedurl.hashargs && parsedurl.hashargs['world.url'])) {
        this.engine.systems.world.loadSceneFromURL(worldurl);
      } else if (worlddata) {
        this.engine.systems.world.load(worlddata);
      }
    }
    this.startEngine = function(engine) {
      this.world = this.engine.systems.world; // shortcut

      try {
        var cfg = this.enginecfg;
        this.view = elation.engine.systems.render.view("main", elation.html.create({ tag: 'div', append: this }), {
          fullsize: cfg.fullsize,
          resolution: cfg.resolution,
          picking: cfg.picking,
          engine: this.name,
          showstats: cfg.stats,
          crosshair: cfg.crosshair,
          useWebVRPolyfill: cfg.useWebVRPolyfill,
          enablePostprocessing: cfg.enablePostprocessing
        } );

        this.initWorld();
        this.initControls();

        engine.start();
      } catch (e) {
        console.error(e);
        elation.events.fire({element: this, type: 'engine_error', data: e});
      }
    }
    this.initControls = function() {
      this.controlstate = this.engine.systems.controls.addContext(this.name, {
        'menu': ['keyboard_esc,gamepad_0_button_9', elation.bind(this, this.toggleMenu)],
        'share_screenshot': ['keyboard_ctrl_period', elation.bind(this, this.shareScreenshot)],
        //'share_gif': ['keyboard_period', elation.bind(this, this.shareMP4)],
        'pointerlock': ['pointerlock', elation.bind(this, this.togglePointerLock)],
        'vr_toggle': ['keyboard_ctrl_rightsquarebracket', elation.bind(this, this.toggleVR)],
        'vr_calibrate': ['keyboard_ctrl_leftsquarebracket', elation.bind(this, this.calibrateVR)],
      });
      this.engine.systems.controls.activateContext(this.name);
    }
    this.setActiveThing = function(thing) {
      this.engine.systems.render.views.main.setactivething(thing);
      if (thing.ears) {
        this.engine.systems.sound.setActiveListener(thing.ears);
      }
    }
    this.getPlayer = function() {
      if (!this.player) {
        var players = this.engine.systems.world.getThingsByTag('player');
        if (players && players.length > 0) {
          this.player = players[0];
        }
      }
      return this.player;
    }
    this.showMenu = function() {
      var player = this.getPlayer();
      if (player){
        if (!this.menu) {
          this.menu = player.camera.spawn('menu', null, { 
            position: [0,0,-0.2],
            items: [
/*
              { 
                text: 'Intro',
                callback: elation.bind(this, this.startIntro),
                disabled: true
              },
*/
              { 
                text: 'Play',
                callback: elation.bind(this, this.startGame)
              },
              { 
                text: 'Options', 
                callback: elation.bind(this, this.configureOptions),
              },
              { 
                text: 'About',
                callback: elation.bind(this, this.showAbout),
              },
  /*
              { 
                text: 'Quit',
                disabled: true
              }
  */
            ],
            labelcfg: {
              size: .01,
              lineheight: 1.5,
              color: 0x999999,
              hovercolor: 0x003300,
              disabledcolor: 0x000000,
              disabledhovercolor: 0x330000,
            }
          });
        } else {
          player.camera.add(this.menu);
        }
        player.disable();
        this.menu.enable();
        this.menu.refresh();
        player.refresh();
        this.menuShowing = true;
      }
    }
    this.hideMenu = function() {
      var player = this.getPlayer();
      if (player && this.menu) {
        player.camera.remove(this.menu);
        if (this.configmenu) this.configmenu.hide();
        //if (this.loaded) {
          player.enable();
        //}
        this.menuShowing = false;
        this.menu.disable();
      }
    }
    this.toggleMenu = function(ev) {
      if (ev.value == 1) {
        if (this.menuShowing) {
          this.hideMenu();
        } else {
          this.showMenu();
        }
      }
    }
    this.togglePointerLock = function(ev) {
      if (ev.value == 0) {
        this.showMenu();
      }
    }
    this.toggleFullscreen = function(ev) {
      var view = this.view;
      if (view && (typeof ev == 'undefined' || ev.value == 1 || typeof ev.value == 'undefined')) {
        view.toggleFullscreen();
      }
    }
    this.toggleVR = function(ev) {
      var view = this.view;
      if (view && (typeof ev == 'undefined' || ev.value == 1 || typeof ev.value == 'undefined')) {
        view.toggleVR();
      }
    }
    this.calibrateVR = function(ev) {
      if (this.engine.systems.controls && (typeof ev == 'undefined' || ev.value == 1)) {
        this.engine.systems.controls.calibrateHMDs();
      }
    }
    this.configureOptions = function() {
      if (!this.configmenu) {
        var configpanel = elation.engine.configuration({client: this});
        this.configmenu = elation.ui.window({
          append: document.body,
          classname: this.name + '_config',
          center: true,
          resizable: false,
          title: 'Configuration',
          controls: true,
          maximize: false,
          minimize: false,
          content: configpanel
        });
      }
      this.configmenu.show();
    }
    this.startGame = function() {
      this.hideMenu();
    }
    this.showAbout = function() {
    }
    this.createSharePicker = function() {
    }
    this.initSharing = function() {
      this.sharedialog = elation.engine.sharing({append: document.body, client: this});
    }
    this.shareScreenshot = function(ev) {
      if (typeof ev == 'undefined' || ev.value == 1) {
        if (!this.sharedialog) {
          this.sharedialog = elation.engine.sharing({append: document.body, client: this});
        } else {
          this.sharedialog.show();
        }
        this.sharedialog.share();
        return;
/*
        if (!this.sharepicker) {
          this.createSharePicker();
        }
        var recorder = this.view.recorder;
        recorder.captureJPG().then(elation.bind(this, function(data) {
          var img = data.image.data;
          this.sharepicker.share({
            name: this.getScreenshotFilename('jpg'), 
            type: 'image/jpeg',
            image: img, 
          });
          var now = new Date().getTime();
          console.log('finished jpg in ' + data.time.toFixed(2) + 'ms'); 
        }));
*/
        //recorder.capturePNG().then(elation.bind(this, function(data) {
        this.screenshot({format: 'png'}).then(elation.bind(this, function(data) {
          var imgdata = data.split(',')[1]; //data.image.data;

          var bytestr = atob(imgdata);
          var img = new Uint8Array(bytestr.length);
          for (var i = 0; i < bytestr.length; i++) {
            img[i] = bytestr.charCodeAt(i);
          }
          

          this.player.disable();
          this.sharepicker.share({
            name: this.getScreenshotFilename('png'), 
            type: 'image/png',
            image: img, 
          }).then(elation.bind(this, function(upload) {
            //this.player.enable();
          }));
          var now = new Date().getTime();
          //console.log('finished png in ' + data.time.toFixed(2) + 'ms'); 
          console.log('finished png'); 
        }));
      }
    }
    this.shareGif = function(ev) {
      if (typeof ev == 'undefined' || ev.value == 1) {
        if (!this.sharepicker) {
          this.createSharePicker();
        }
        var recorder = this.view.recorder;
        recorder.captureGIF(1920, 1080, 1, 200).then(elation.bind(this, function(data) {
          var img = data.file;
          this.sharepicker.share({
            name: this.getScreenshotFilename('gif'), 
            type: 'image/gif',
            image: img, 
          });
          var now = new Date().getTime();
          console.log('finished gif in ' + data.time.toFixed(2) + 'ms'); 
        }));
      }
    }
    this.shareMP4 = function(ev) {
      if (typeof ev == 'undefined' || ev.value == 1) {
        if (!this.sharepicker) {
          this.createSharePicker();
        }
        var recorder = this.view.recorder;
        recorder.captureMP4(640, 360, 25, 30).then(elation.bind(this, function(data) {
          var img = data.file;
          this.sharepicker.share({
            name: this.getScreenshotFilename('mp4'), 
            type: 'video/mp4',
            image: img, 
          });
          var now = new Date().getTime();
          console.log('finished mp4 in ' + data.time.toFixed(2) + 'ms'); 
        }));
      }
    }
    this.getScreenshotFilename = function(extension) {
      if (!extension) extension = 'png';
      var now = new Date();
      function pad(n) {
        if (n < 10) return '0' + n;
        return n;
      }
      var prefix = elation.config.get('engine.screenshot.prefix', 'screenshot');
      var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      var time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      var filename = prefix + '-' + date + ' ' + time + '.' + extension
      return filename;
    }
    this.screenshot = function(args) {
      return this.view.screenshot(args);
    }
  }, elation.ui.base);
  
  elation.component.add('engine.server', function() {
    this.init = function() {
      this.name = this.args.name || 'default';
      this.engine = elation.engine.create(this.name, ['physics', 'world', 'server'], elation.bind(this, this.startEngine));
    }
    this.initWorld = function() {
      // Virtual stub - inherit from elation.engine.server, then override this for your app
    }
    this.startEngine = function(engine) {
      this.engine = engine;
      this.world = this.engine.systems.world; // shortcut
      this.initWorld();
      engine.start();
    }
   });
  
});
