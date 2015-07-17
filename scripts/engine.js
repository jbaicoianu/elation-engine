elation.require([
  "engine.external.three.three",
  "engine.parts",
  "engine.materials",
  "engine.geometries",
  "engine.things.generic",
  "engine.things.menu",
  "utils.math",
  "ui.panel",
  "share.share",
  "share.targets.imgur",
  "share.targets.dropbox",
  "share.targets.google",
], function() {
  elation.requireCSS('engine.engine');

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

    this.init = function() {
      this.systems = new elation.engine.systems(this);
      // shutdown cleanly if the user leaves the page
      elation.events.add(window, "unload", elation.bind(this, this.stop)); 
    }
    this.start = function() {
      this.started = this.running = true;
      elation.events.fire({element: this, type: "engine_start"});
      this.lastupdate = new Date().getTime();
      // Start run loop, passing in current time
      this.run(0);
    }
    this.stop = function() {
      elation.events.fire({element: this, type: "engine_stop"});
      this.running = false;
    }

    this.run = function(ts) {
      // recursively request another frame until we're no longer running
      if (!ts) ts = new Date().getTime();
      if (this.running) {
        if (!this.boundfunc) this.boundfunc = elation.bind(this, this.run);
        this.frame(this.boundfunc);
      }
      var evdata = {
        ts: ts,
        delta: (ts - this.lastupdate) / 1000
      };
      // fire engine_frame event, which kicks off processing in any active systems
      //console.log("==========");
      elation.events.fire({type: "engine_frame", element: this, data: evdata});
      this.lastupdate = ts;
    }

    // simple requestAnimationFrame wrapper
    this.requestAnimationFrame = (function() {
        if (typeof window !== 'undefined') {
          // Browsers
          return  window.requestAnimationFrame       || 
                  window.webkitRequestAnimationFrame || 
                  window.mozRequestAnimationFrame    || 
                  window.oRequestAnimationFrame      || 
                  window.msRequestAnimationFrame     || 
                  function( callback ) {
                    setTimeout(callback, 1000 / 60);
                  };
        } else {
          // NodeJS
          return function( callback ) {
            setTimeout(callback, 1000 / 60);
          };
        }
      })();
    this.frame = function(fn) {
      this.requestAnimationFrame.call(window, fn);
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
    this.getThingById = function(id) {
      return this.systems.world.getThingById(id);
    }

    this.init();
  });
  elation.extend("engine.systems", function(args) {
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
      this.engine = this.args.engine;
      this.view = this.args.view;
      this.create();
      this.addclass('engine_configuration');
    }
    this.create = function() {
        /* Control Settings */
        var controlpanel = elation.engine.systems.controls.config({
          controlsystem: this.engine.systems.controls
        });

        /* Video Settings */
        var videopanel = elation.ui.panel({
          orientation: 'vertical'
        });
        var oculus = elation.ui.toggle({
          label: 'Oculus Rift',
          append: videopanel,
          events: { toggle: elation.bind(this, this.toggleVR) }
        });
        var fullscreen = elation.ui.toggle({
          label: 'Fullscreen',
          append: videopanel,
          events: { toggle: elation.bind(this, this.toggleFullscreen) }
        });
        this.view.scale = 100;
        var scale = elation.ui.slider({
          append: videopanel,
          min: 1,
          max: 200,
          snap: 1,
          handles: [
            {
              name: 'handle_one_scale',
              value: this.view.scale,
              labelprefix: 'View scale:',
              bindvar: [this.view, 'scale']
            }
          ],
          events: { ui_slider_change: elation.bind(this.view.rendersystem, this.view.rendersystem.setdirty) }
        });
        var configtabs = elation.ui.tabbedcontent({
          append: this,
          items: {
            controls: { label: 'Controls', content: controlpanel },
            video: { label: 'Video', content: videopanel },
            audio: { label: 'Audio', disabled: true },
            network: { label: 'Network', disabled: true },
          }
        });
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

      this.engine = elation.engine.create(this.name, ["physics", "sound", "ai", "world", "render", "controls"], elation.bind(this, this.startEngine));
    }
    this.initWorld = function() {
      // Virtual stub - inherit from elation.engine.client, then override this for your app
    }
    this.startEngine = function(engine) {
      this.world = this.engine.systems.world; // shortcut

      this.view = elation.engine.systems.render.view("main", elation.html.create({ tag: 'div', append: this }), { fullsize: 1, picking: true, engine: this.name, showstats: true } );

      this.initWorld();
      this.initControls();

      //this.gameobj = this.engine.systems.world.children.vrcade;
      //this.gameobj.setview(this.view);
      //elation.events.add(this.loader, 'ui_loader_finish', elation.bind(this.gameobj, this.gameobj.handleLoaderFinished));

      engine.start();
    }
    this.initControls = function() {
      this.controlstate = this.engine.systems.controls.addContext(this.name, {
        'menu': ['keyboard_esc,gamepad_0_button_9', elation.bind(this, this.toggleMenu)],
        'share_screenshot': ['keyboard_comma', elation.bind(this, this.shareScreenshot)],
        'share_gif': ['keyboard_period', elation.bind(this, this.shareGif)],
        'pointerlock': ['pointerlock', elation.bind(this, this.togglePointerLock)],
        'vr_toggle': ['keyboard_ctrl_rightsquarebracket', elation.bind(this, this.toggleVR)],
        'vr_calibrate': ['keyboard_ctrl_leftsquarebracket', elation.bind(this, this.calibrateVR)],
      });
      this.engine.systems.controls.activateContext(this.name);
    }
    this.showMenu = function() {
      if (!this.menu) {
        this.menu = this.player.camera.spawn('menu', null, { 
          position: [0,0,-2],
          items: [
            { 
              text: 'Intro',
              callback: elation.bind(this, this.startIntro),
              disabled: true
            },
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
            size: .1,
            lineheight: 1.5,
            color: 0x999999,
            hovercolor: 0x003300,
            disabledcolor: 0x000000,
            disabledhovercolor: 0x330000,
          }
        });
      } else {
        this.player.camera.add(this.menu);
      }
      this.player.disable();
      this.menu.enable();
      this.menuShowing = true;
    }
    this.hideMenu = function() {
      if (this.menu) {
        this.player.camera.remove(this.menu);
        if (this.configmenu) this.configmenu.hide();
        //if (this.loaded) {
          this.player.enable();
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
      if (view && (ev.value == 1 || typeof ev.value == 'undefined')) {
        view.toggleFullscreen();
      }
    }
    this.toggleVR = function(ev) {
      var view = this.view;
      if (view && (ev.value == 1 || typeof ev.value == 'undefined')) {
        var mode = (view.rendermode == 'default' ? 'oculus' : 'default');
        view.setRenderMode(mode);
      }
    }
    this.calibrateVR = function(ev) {
      if (this.engine.systems.controls && ev.value == 1) {
        this.engine.systems.controls.calibrateHMDs();
      }
    }
    this.configureOptions = function() {
      if (!this.configmenu) {
        var configpanel = elation.engine.configuration({engine: this.engine, view: this.view});
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
    }
    this.showAbout = function() {
    }
    this.createSharePicker = function() {
      this.sharepicker = elation.share.picker({append: document.body});
      this.sharepicker.addShareTarget(elation.share.targets.imgur({clientid: '96d8f6e2515953a'}));
      this.sharepicker.addShareTarget(elation.share.targets.dropbox({clientid: 'g5m5xsgqaqmf7jc'}));
      this.sharepicker.addShareTarget(elation.share.targets.google({clientid: '374523350201-lev5al121s8u9aaq8spor3spsaugpcmd.apps.googleusercontent.com'}));
    }
    this.shareScreenshot = function(ev) {
      if (typeof ev == 'undefined' || ev.value == 1) {
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
      }
    }
    this.shareGif = function(ev) {
      if (typeof ev == 'undefined' || ev.value == 1) {
        if (!this.sharepicker) {
          this.createSharePicker();
        }
        var recorder = this.view.recorder;
        recorder.captureGIF(512, 512, 75, 100).then(elation.bind(this, function(data) {
          var img = data.image;
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
    this.getScreenshotFilename = function(extension) {
      if (!extension) extension = 'png';
      var now = new Date();
      function pad(n) {
        if (n < 10) return '0' + n;
        return n;
      }
      var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      var time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      var filename = 'vrcade-' + date + ' ' + time + '.' + extension
      return filename;
    }
  });
});
