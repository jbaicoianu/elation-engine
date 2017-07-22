/**
 * Context-aware input mapper
 *
 * Handles bindings and contexts for various types of inputs in a generic way.
 * Works in two layers, first by mapping physical inputs (mouse, keyboard,
 * gamepad, accelerometer, etc) to generalized event names (mouse_button_1, 
 * mouse_drag_x, keyboard_w, gamepad_0_axis_1, etc), and then mapping these
 * to context-specific actions ("move_forward", "jump", "fire", etc).
 * 
 * Contexts
 * --------
 *   Contexts let you define groups of actions for different situations, which
 *   can be activated or deactivated programatically (eg, when a player enters
 *   or exits a vehicle).  When activating contexts, an object can be passed which
 *   is then available as 'this' within the action callbacks.
 *
 * Commands
 * --------
 * Commands define a set of actions which an object exposes.  These commands
 * can be mapped to keyboard, mouse, or gamepad keys and axes using Bindings.
 *
 *   Example:
 *
 *       var myApplication = new SuperCoolGame();
 *       var controls = new elation.engine.system.controls();
 *
 *       controls.addCommands("default", {
 *         "menu": function(ev) { this.showMenu(); },
 *         "screenshot": function(ev) { this.screenshot(); }
 *       });
 *       controls.addCommands("player", {
 *         "move_forward": function(ev) { this.move(0, 0, -ev.data); },
 *         "move_back": function(ev) { this.move(0, 0, ev.data); },
 *         "move_left": function(ev) { this.move(-ev.data, 0, 0); },
 *         "move_right": function(ev) { this.move(ev.data, 0, 0); },
 *         "pitch": function(ev) { this.pitch(ev.data); }
 *         "turn": function(ev) { this.turn(ev.data); }
 *         "jump": function(ev) { this.jump(ev.data); }
 *       });
 *       controls.activateContext("default", myApplication);
 *       controls.activateContext("player", myApplication.player);
 *    
 *
 *
 * Bindings
 * --------
 *   Bindings define virtual identifiers for all input events, which can then
 *   be mapped to context-specific Commands.  In most cases, ev.data contains 
 *   a floating point value from 0..1 for buttons or -1..1 for axes
 *
 *   - keyboard: keyboard_<#letter>, keyboard_space, keyboard_delete, etc.
 *   - mouse: mouse_pos mouse_x mouse_y mouse_drag_x mouse_button_<#button>
 *   - gamepad: gamepad_<#stick>_axis_<#axis>
 *
 *   Example:
 *
 *     controls.addBindings("default", {
 *       "keyboard_esc": "menu",
 *       "gamepad_0_button_10": "menu" // first gamepad start button
 *     };
 *     controls.addBindings("player", {
 *       "keyboard_w": "move_forward",
 *       "keyboard_a": "move_left",
 *       "keyboard_s": "move_back",
 *       "keyboard_d": "move_right",
 *       "mouse_x": "turn",
 *       "mouse_y": "pitch",
 *       "gamepad_0_axis_0": "move_right",
 *       "gamepad_0_axis_1": "move_forward",
 *       "gamepad_0_axis_2": "turn",
 *       "gamepad_0_axis_3": "pitch"
 *       "gamepad_0_button_1": "jump"
 *     });
 **/
elation.requireCSS('engine.systems.controls');

elation.require(['ui.window', 'ui.panel', 'ui.toggle', 'ui.slider', 'ui.label', 'ui.list', 'ui.tabbedcontent', 'engine.external.nipplejs'], function() {
  elation.extend("engine.systems.controls", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.contexts = {};
    this.activecontexts = [];
    this.bindings = {};
    this.state = {};
    this.contexttargets = {};
    this.contextstates = {};
    this.changes = [];
    this.gamepads = [];
    this.viewport = [];
    this.hmdframes = [];

    this.settings = {
      mouse: {
        sensitivity: 100,
        invertY: false,
        invertX: false
      },
      keyboard: {
        turnspeed: 1,
        lookspeed: 1
      },
      gamepad: {
        sensitivity: 1,
        deadzone: 0.2
      },
      touchpad: {
        emulateGamepad: true
      },
      hmd: {
      }
    };

    this.capturekeys = [
      'keyboard_f1',
      'keyboard_f6',
      'keyboard_tab',
    ];

    this.initialized = false;

    this.system_attach = function(ev) {
      console.log('INIT: controls');
      if (this.loadonstart) {
        for (var k in this.loadonstart) {
          this.addContext(k, this.loadonstart[k]);
        }
      }
    }
    this.engine_frame = function(ev) {
      if (!this.initialized) {
        this.initcontrols();
      }
      //console.log("FRAME: controls");
      this.update(ev.delta);
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: controls');
    }

    this.initcontrols = function() {
      if (!this.container) this.container = this.engine.systems.render.renderer.domElement;
      elation.events.add(this.container, "mousedown,mousemove,mouseup,DOMMouseScroll,gesturestart,gesturechange,gestureend", this);
      //elation.events.add(this.container, "touchstart,touchmove,touchend,mousewheel", this);
      elation.events.add(window, "keydown,keyup,webkitGamepadConnected,webkitgamepaddisconnected,MozGamepadConnected,MozGamepadDisconnected,gamepadconnected,gamepaddisconnected", this);
      //elation.events.add(window, "deviceorientation,devicemotion", this);
      elation.events.add(document, "pointerlockchange,webkitpointerlockchange,mozpointerlockchange", elation.bind(this, this.pointerLockChange));
      elation.events.add(document, "pointerlockerror,webkitpointerlockerror,mozpointerlockerror", elation.bind(this, this.pointerLockError));

      if (this.settings.touchpad && this.settings.touchpad.emulateGamepad) {
        var touchzone = document.createElement('div');
        touchzone.style.position = 'fixed';
        touchzone.style.bottom = 0;
        touchzone.style.left = 0;
        touchzone.style.zIndex = 100;
        touchzone.style.width = '120px';
        touchzone.style.height = '120px';
        //touchzone.style.background = 'rgba(255,128,128,.3)';
        document.body.appendChild(touchzone);

        this.virtualjoystick = nipplejs.create({
          zone: touchzone,
          mode: 'static',
          catchDistance: 150,
          restOpacity: .4,
          position: {left: '60px', bottom: '60px'},
        });
        this.virtualjoystick.on('move end', elation.bind(this, function(ev, nipple) { 
          var strength = Math.min(1, nipple.force);
          var x = (nipple.angle ? strength * Math.cos(nipple.angle.radian) : 0),
              y = (nipple.angle ? strength * -Math.sin(nipple.angle.radian) : 0);

          var bindname_x = this.getBindingName('gamepad', 'virtual', 'axis_' + 0);
          var bindname_y = this.getBindingName('gamepad', 'virtual', 'axis_' + 1);
          var bindname_any_x = this.getBindingName('gamepad', 'any', 'axis_' + 0);
          var bindname_any_y = this.getBindingName('gamepad', 'any', 'axis_' + 1);

          if (this.state[bindname_x] != x) {
            this.changes.push(bindname_x);
            this.state[bindname_x] = x;
            this.state[bindname_x + '_full'] = THREE.Math.mapLinear(x, -1, 1, 0, 1);
            this.changes.push(bindname_any_x);
            this.state[bindname_any_x] = x;
            this.state[bindname_any_x + '_full'] = THREE.Math.mapLinear(x, -1, 1, 0, 1);
          }
          if (this.state[bindname_y] != y) {
            this.changes.push(bindname_y);
            this.state[bindname_y] = y;
            this.state[bindname_y + '_full'] = THREE.Math.mapLinear(y, -1, 1, 0, 1);
            this.changes.push(bindname_any_y);
            this.state[bindname_any_y] = y;
            this.state[bindname_any_y + '_full'] = THREE.Math.mapLinear(y, -1, 1, 0, 1);
          }
        }));
      }

      if (args) {
        this.addContexts(args);
      }
      this.initialized = true;
    }
    this.addCommands = function(context, commands) {
      this.contexts[context] = commands;
    }
    this.addContexts = function(contexts) {
      for (var k in contexts) {
        this.addContext(k, contexts[k]);
      }
    }
    this.addContext = function(context, contextargs) {
      var commands = {};
      var bindings = {};
      var states = {};
      for (var k in contextargs) {
        var newbindings = contextargs[k][0].split(',');
        for (var i = 0; i < newbindings.length; i++) {
          bindings[newbindings[i]] = k;
        }
        commands[k] = contextargs[k][1];
        states[k] = 0;
      }
      this.addCommands(context, commands);
      this.addBindings(context, bindings);
      this.contextstates[context] = states;
      console.log("[controls] added control context: " + context);

      // FIXME - context state object should be a JS class, with reset() as a member function
      states._reset = function() {
        for (var k in this) {
          if (typeof this[k] != 'function') {
            this[k] = 0;
          }
        }
      }.bind(states);

      return states;
    }
    this.activateContext = function(context, target) {
      if (this.activecontexts.indexOf(context) == -1) {
        console.log('[controls] activate control context ' + context);
        this.activecontexts.unshift(context);
      }
      if (target) {
        this.contexttargets[context] = target;
      }
    }
    this.deactivateContext = function(context) {
      var i = this.activecontexts.indexOf(context);
      if (i != -1) {
        console.log('[controls] deactivate control context ' + context);
        this.activecontexts.splice(i, 1);
        if (this.contexttargets[context]) {
          delete this.contexttargets[context];
        }
      }
    }
    this.addBindings = function(context, bindings) {
      if (!this.bindings[context]) {
        this.bindings[context] = {};
      }
      for (var k in bindings) {
        this.bindings[context][k] = bindings[k];
      }
    }
    this.update = function(t) {
      this.pollGamepads();
      //this.pollHMDs();

      var processed = {};
      if (this.changes.length > 0) {
        var now = new Date().getTime();
        for (var i = 0; i < this.changes.length; i++) {
          if (processed[this.changes[i]]) {
            continue;
          }

          var firedev = elation.events.fire({
            type: 'control_change', 
            element: this, 
            data: {
              name: this.changes[i], 
              value: this.state[this.changes[i]]
            }
          });

//console.log('fired!', firedev);
          for (var j = 0; j < this.activecontexts.length; j++) {
            var context = this.activecontexts[j];
            var contextstate = this.contextstates[context] || {};
            if (this.bindings[context] && this.bindings[context][this.changes[i]]) {
              var action = this.bindings[context][this.changes[i]];
              if (this.contexts[context][action]) {
                contextstate[action] = this.state[this.changes[i]];
                //var ev = {timeStamp: now, type: this.changes[i], value: this.state[this.changes[i]], data: contextstate};
                var ev = {timeStamp: now, type: action, value: this.state[this.changes[i]], data: contextstate};
                //console.log('call it', this.changes[i], this.bindings[context][this.changes[i]], this.state[this.changes[i]]);
                if (this.contexttargets[context]) {
                  ev.target = this.contexttargets[context];
                  this.contexts[context][action].call(ev.data, ev);
                } else {
                  this.contexts[context][action](ev);
                }
                break; // Event was handled, no need to check other active contexts
              } else {
                console.log('Unknown action "' + action + '" in context "' + context + '"');
              }
            }
          }
          processed[this.changes[i]] = true;
        }
        this.changes = [];
      }
      if (this.state['mouse_delta_x'] != 0 || this.state['mouse_delta_y'] != 0) {
        this.state['mouse_delta_x'] = 0;
        this.state['mouse_delta_y'] = 0;
        this.changes.push('mouse_delta_x');
        this.changes.push('mouse_delta_y');
      }
    }
    this.getBindingName = function(type, id, subid) {
      var codes = {
        keyboard: {
          8: 'backspace',
          9: 'tab',
          13: 'enter',
          16: 'shift',
          17: 'ctrl',
          18: 'alt',
          20: 'capslock',
          27: 'esc',

          32: 'space',
          33: 'pgup',
          34: 'pgdn',
          35: 'end',
          36: 'home',
          37: 'left',
          38: 'up',
          39: 'right',
          40: 'down',

          45: 'insert',
          46: 'delete',
          
          91: 'meta',
          92: 'rightmeta',

          106: 'numpad_asterisk',
          107: 'numpad_plus',
          110: 'numpad_period',
          111: 'numpad_slash',

          144: 'numlock',

          186: 'semicolon',
          187: 'equals',
          188: 'comma',
          189: 'minus',
          190: 'period',
          191: 'slash',
          192: 'backtick',
          220: 'backslash',
          221: 'rightsquarebracket',
          219: 'leftsquarebracket',
          222: 'apostrophe',

          // firefox-specific
          0: 'meta',
          59: 'semicolon',
          61: 'equals',
          109: 'minus',
        },
      }
      var bindname = type + (!elation.utils.isEmpty(subid) ? '_' + subid + '_' : '_unknown_') + id;

      switch (type) {
        case 'keyboard':
          var basename = type + '_' + (!elation.utils.isEmpty(subid) ? subid + '_' : '');
          if (codes[type][id]) {
            // map the numeric code to a string, skipping the subid if it's redundant
            bindname = type + '_' + (!elation.utils.isEmpty(subid) && subid !== codes[type][id] ? subid + '_' : '') + codes[type][id];
          } else if (id >= 65 && id <= 90) {
            bindname = basename + String.fromCharCode(id).toLowerCase();
          } else if (id >= 48 && id <= 57) {
            bindname = basename + (id - 48);
          } else if (id >= 96 && id <= 105) {
            bindname = basename + 'numpad_' + (id - 96);
          } else if (id >= 112 && id <= 123) {
            bindname = basename + 'f' + (id - 111);
          } else {
            console.log('Unknown key pressed: ' + bindname);
          }
          break;
        case 'gamepad':
          bindname = type + '_' + id + '_' + subid;
          break;
      }
      return bindname;
    }
    this.pollGamepads = function() {
      this.updateConnectedGamepads();
      if (this.gamepads.length > 0) {
        for (var i = 0; i < this.gamepads.length; i++) {
          if (this.gamepads[i] != null) {
            var gamepad = this.gamepads[i];
            for (var a = 0; a < gamepad.axes.length; a+=2) {
              var bindname_x = this.getBindingName('gamepad', i, 'axis_' + a);
              var bindname_y = this.getBindingName('gamepad', i, 'axis_' + (a+1));
              var bindname_any_x = this.getBindingName('gamepad', 'any', 'axis_' + a);
              var bindname_any_y = this.getBindingName('gamepad', 'any', 'axis_' + (a+1));
              // FIXME - Vive hack
              var axisscale = 1;
              if (this.hmds && this.hmds.length > 0) {
                var hmdname = this.hmds[0].displayName;
                if (hmdname.match('Vive')) {
                  axisscale = -1;
                }
              }
              var values = this.deadzone(gamepad.axes[a], axisscale * gamepad.axes[a+1]);
              if (this.state[bindname_x] != values[0]) {
                this.changes.push(bindname_x);
                this.state[bindname_x] = values[0];
                this.state[bindname_x + '_full'] = THREE.Math.mapLinear(gamepad.axes[a], -1, 1, 0, 1);
                this.changes.push(bindname_any_x);
                this.state[bindname_any_x] = values[0];
                this.state[bindname_any_x + '_full'] = THREE.Math.mapLinear(gamepad.axes[a], -1, 1, 0, 1);
              }
              if (this.state[bindname_y] != values[1]) {
                this.changes.push(bindname_y);
                this.state[bindname_y] = values[1];
                this.state[bindname_y + '_full'] = THREE.Math.mapLinear(gamepad.axes[a+1], -1, 1, 0, 1);
                this.changes.push(bindname_any_y);
                this.state[bindname_any_y] = values[1];
                this.state[bindname_any_y + '_full'] = THREE.Math.mapLinear(gamepad.axes[a+1], -1, 1, 0, 1);
              }
            }
            for (var b = 0; b < gamepad.buttons.length; b++) {
              var bindname = this.getBindingName('gamepad', i, 'button_' + b);
              var bindname_any = this.getBindingName('gamepad', 'any', 'button_' + b);
              if (this.state[bindname] != gamepad.buttons[b].value) {
                this.changes.push(bindname);
                this.state[bindname] = gamepad.buttons[b].value;
                this.changes.push(bindname_any);
                this.state[bindname_any] = gamepad.buttons[b].value;
              }
            }
          }
        }
      }
    }
    this.updateConnectedGamepads = function() {
      var func = navigator.getGamepads || navigator.webkitGetGamepads;
      if (typeof func == 'function') {
        this.gamepads = func.call(navigator);
        //console.log(this.gamepads);
      }
    }
    this.getGamepads = function() {
      var gamepads = [];
      for (var i = 0; i < this.gamepads.length; i++) {
        if (this.gamepads[i]) {
          gamepads.push(this.gamepads[i]);
        }
      }
      return gamepads;
    }
    this.pollHMDs = function() {
      if (typeof this.hmds == 'undefined') {
        this.updateConnectedHMDs();
      } else if (this.hmds && this.hmds.length > 0) {
        for (var i = 0; i < this.hmds.length; i++) {
          var hmd = this.hmds[i];
          if (typeof VRDisplay != 'undefined' && hmd instanceof VRDisplay) {
            var framedata = this.hmdframes[i];
            var pose = false;
            if (hmd.getFrameData && hmd.getFrameData(framedata)) {
              pose = framedata.pose;
            } else if (hmd.getPose) {
              pose = hmd.getPose();
            }
            if (pose) {
              var hmdstate = pose;
              var bindname = "hmd_" + i;
              this.changes.push(bindname);
              this.state[bindname] = hmdstate;
            }
          } else {
            var hmdstate = this.hmds[i].getState();
            var realhmdstate = {
              position: [0,0,0],
              orientation: [0,0,0,1],
              linearVelocity: [0,0,0],
              linearAcceleration: [0,0,0],
              angularVelocity: [0,0,0],
              angularAcceleration: [0,0,0],
            }
            if (hmdstate.hasPosition) {
              realhmdstate.position = [hmdstate.position.x, hmdstate.position.y, hmdstate.position.z];
            }
            if (hmdstate.hasOrientation) {
              realhmdstate.orientation = [hmdstate.orientation.x, hmdstate.orientation.y, hmdstate.orientation.z, hmdstate.orientation.w];
            }
            realhmdstate.linearVelocity = [hmdstate.linearVelocity.x, hmdstate.linearVelocity.y, hmdstate.linearVelocity.z];
            realhmdstate.linearAcceleration = [hmdstate.linearAcceleration.x, hmdstate.linearAcceleration.y, hmdstate.linearAcceleration.z];
            realhmdstate.angularVelocity = [hmdstate.angularVelocity.x, hmdstate.angularVelocity.y, hmdstate.angularVelocity.z];
            realhmdstate.angularAcceleration = [hmdstate.angularAcceleration.x, hmdstate.angularAcceleration.y, hmdstate.angularAcceleration.z];
            var bindname = "hmd_" + i;
            this.changes.push(bindname);
            this.state[bindname] = realhmdstate;
          }
        }
      }
    }
    this.updateConnectedHMDs = function() {
      this.hmds = false;
      if (typeof navigator.getVRDisplays == 'function') {
        navigator.getVRDisplays().then(elation.bind(this, this.processConnectedHMDs));
      } else if (typeof navigator.getVRDevices == 'function') {
        navigator.getVRDevices().then(elation.bind(this, this.processConnectedHMDs));
      }
    }
    this.processConnectedHMDs = function(hmds) {
      if (hmds.length > 0) {
        this.hmds = [];
        for (var i = 0; i < hmds.length; i++) {
          // We only care about position sensors
          if ((typeof PositionSensorVRDevice != 'undefined' && hmds[i] instanceof PositionSensorVRDevice) || 
              (typeof VRDisplay != 'undefined' && hmds[i] instanceof VRDisplay)) {
            this.hmds.push(hmds[i]);
            if (typeof VRFrameData !== 'undefined') {
              this.hmdframes[i] = new VRFrameData();
            }
          }
        }
      }
    }
    this.calibrateHMDs = function() {
      if (this.hmds) {
        for (var i = 0; i < this.hmds.length; i++) {
          if (this.hmds[i].resetPose) {
            this.hmds[i].resetPose();
          } else if (this.hmds[i].resetSensor) {
            this.hmds[i].resetSensor();
          }
        }
      }
    }
    this.getPointerLockElement = function() {
      var el = document.pointerLockElement || document.mozPointerLockElement || document.webkitPointerLockElement;
      return el;
    }
    this.enablePointerLock = function(enable) {
      this.pointerLockEnabled = enable;
      if (!this.pointerLockEnabled && this.pointerLockActive) {
        this.releasePointerLock();
      }
    }
    this.requestPointerLock = function() {
      if (this.pointerLockEnabled && !this.pointerLockActive) {
        var domel = this.engine.systems.render.renderer.domElement;
        if (!domel.requestPointerLock) {
          domel.requestPointerLock = domel.requestPointerLock || domel.mozRequestPointerLock || domel.webkitRequestPointerLock;
        }
        if (domel.requestPointerLock) {
          domel.requestPointerLock();
          return true;
        }
      }
      return false;
    }
    this.releasePointerLock = function() {
      this.pointerLockActive = false;
      var lock = this.getPointerLockElement();
      if (lock) {
        document.exitPointerLock = document.exitPointerLock || document.mozExitPointerLock || document.webkitExitPointerLock;
        document.exitPointerLock();
      }
    }
    this.pointerLockChange = function(ev) {
      var lock = this.getPointerLockElement();
      if (lock && !this.pointerLockActive) {
        this.pointerLockActive = true;
        this.state['pointerlock'] = this.pointerLockActive;
        this.changes.push('pointerlock');
      } else if (!lock && this.pointerLockActive) {
        this.pointerLockActive = false;
        this.state['pointerlock'] = this.pointerLockActive;
        this.changes.push('pointerlock');
      }
    }
    this.pointerLockError = function(ev) {
      console.error('[controls] Pointer lock error');
      this.pointerLockChange(ev);
    }
    this.getMousePosition = function(ev) {
      var width = this.container.offsetWidth || this.container.innerWidth,
          height = this.container.offsetHeight || this.container.innerHeight,
          top = this.container.offsetTop || 0,
          left = this.container.offsetLeft || 0;
      var relpos = [ev.clientX - left, ev.clientY - top];

      //console.log(relpos, [ev.clientX, ev.clientY], this.container, [width, height], [top, left]);
      var ret = [(relpos[0] / width - .5) * 2, (relpos[1] / height - .5) * 2];
      return ret;
    }
    this.getMouseDelta = function(ev) {
      var width = this.container.offsetWidth || this.container.innerWidth,
          height = this.container.offsetHeight || this.container.innerHeight;
      var scaleX = this.settings.mouse.sensitivity * (this.settings.mouse.invertX ? -1 : 1),
          scaleY = this.settings.mouse.sensitivity * (this.settings.mouse.invertY ? -1 : 1),
          movementX = elation.utils.any(ev.movementX, ev.mozMovementX),
          movementY = elation.utils.any(ev.movementY, ev.mozMovementY);

      var deltas = [
            scaleX * movementX / width,
            scaleY * movementY / height
          ];
      return deltas;
    }
    this.getKeyboardModifiers = function(ev) {
      var ret = "";
      var modifiers = {'shiftKey': 'shift', 'altKey': 'alt', 'ctrlKey': 'ctrl'};
      for (var k in modifiers) {
        if (ev[k]) {
          ret += (ret.length > 0 ? "_" : "") + modifiers[k];
        }
      }
      if (ret != "") 
        return ret;
      return "nomod";
    }
    this.mousedown = function(ev, skiplock) {
      if (!skiplock && ev.button === 0 && !this.getPointerLockElement()) {
        if (this.requestPointerLock()) {
          //ev.stopPropagation();
          ev.preventDefault();
        }
      }

      var bindid = "mouse_button_" + ev.button;
      if (!this.state[bindid]) {
        this.state[bindid] = 1;
        this.changes.push(bindid);
      }
      //elation.events.add(window, "mousemove,mouseup", this);
    }
    this.mousemove = function(ev) {
      var mpos = this.getMousePosition(ev);
      var deltas = this.getMouseDelta(ev);
      var status = {mouse_pos: false, mouse_delta: false, mouse_x: false, mouse_y: false};
      if (!this.state["mouse_pos"]) {
        status["mouse_pos"] = true;
        status["mouse_x"] = true;
        status["mouse_y"] = true;
      } else {
        if (this.state["mouse_pos"][0] != mpos[0]) {
          status["mouse_pos"] = true;
          status["mouse_x"] = true;
        }
        if (this.state["mouse_pos"][1] != mpos[1]) {
          status["mouse_pos"] = true;
          status["mouse_y"] = true;
        }
      }
      status["mouse_delta"] = (Math.abs(deltas[0]) != 0 || Math.abs(deltas[1]) != 0);
      if (status["mouse_pos"]) {
        if (status["mouse_x"]) {
          this.state["mouse_x"] = mpos[0];
          this.changes.push("mouse_x");
          if (this.state["mouse_button_0"]) {
            this.state["mouse_drag_x"] = this.state["mouse_x"];
            this.changes.push("mouse_drag_x");
          }
        }
        this.state["mouse_pos"] = mpos;
        this.state["mouse_delta"] = [this.state["mouse_delta_x"], this.state["mouse_delta_y"]];
        this.changes.push("mouse_pos");
        this.changes.push("mouse_delta");
        if (status["mouse_y"]) {
          this.state["mouse_y"] = mpos[1];
          this.changes.push("mouse_y");
          if (this.state["mouse_button_0"]) {
            this.state["mouse_drag_y"] = this.state["mouse_y"];
            this.changes.push("mouse_drag_y");
          }
        }
        if (this.state["mouse_button_0"]) {
          this.state["mouse_drag"] = this.state["mouse_pos"];
          this.state["mouse_drag_delta"] = [this.state["mouse_drag_delta_x"], this.state["mouse_drag_delta_y"]];
          this.changes.push("mouse_drag");
          this.changes.push("mouse_drag_delta");
        }
      } 
      if (status["mouse_delta"]) {
        this.state["mouse_delta_x"] = (this.state["mouse_delta_x"] ? this.state["mouse_delta_x"] + deltas[0] : deltas[0]);
        this.state["mouse_delta_y"] = (this.state["mouse_delta_y"] ? this.state["mouse_delta_y"] + deltas[1] : deltas[1]);
        this.state["mouse_delta"] = [this.state["mouse_delta_x"], this.state["mouse_delta_y"]];
        this.changes.push("mouse_delta_x");
        this.changes.push("mouse_delta_y");
        this.changes.push("mouse_delta");

        if (this.state["mouse_button_0"]) {
          this.state["mouse_drag_x"] = this.state["mouse_x"];
          this.state["mouse_drag_y"] = this.state["mouse_y"];
          this.state["mouse_drag_delta_x"] = this.state["mouse_delta_x"];
          this.state["mouse_drag_delta_y"] = this.state["mouse_delta_y"];
          this.changes.push("mouse_drag_x");
          this.changes.push("mouse_drag_y");
          this.changes.push("mouse_drag_delta_x");
          this.changes.push("mouse_drag_delta_y");
        }
      }
    }
    this.mouseup = function(ev) {
      var bindid = "mouse_button_" + ev.button;
      //elation.events.remove(window, "mousemove", this);
      if (this.state[bindid]) {
        this.state[bindid] = 0;
        this.changes.push(bindid);

        if (bindid = "mouse_button_0") {
          this.state['mouse_drag_x'] = 0;
          this.state['mouse_drag_y'] = 0;
          this.changes.push("mouse_drag_x");
          this.changes.push("mouse_drag_y");
        }
      }
    }
    this.DOMMouseScroll = function(ev) {
      this.mousewheel(ev);
    }

    this.mousewheel = function(ev) {
      var delta = Math.max(-1, Math.min(1, (ev.wheelDelta || -ev.detail)));

      var bindid = "mouse_wheel_" + (delta < 0 ? "down" : "up");;
      this.state[bindid] = 1;
      this.changes.push(bindid);
      //ev.preventDefault();
    }
    this.keydown = function(ev) {
      // Send key events for both keyboard_<key> and keyboard_<modname>_<key>
      var mods = this.getKeyboardModifiers(ev);
      var keynamemod = this.getBindingName("keyboard", ev.keyCode, mods);
          keyname = this.getBindingName("keyboard", ev.keyCode);
      if (!this.state[keynamemod]) {
        this.changes.push(keynamemod);
      }
      this.state[keynamemod] = 1;

      if (mods != 'alt') {
        if (!this.state[keyname]) {
          this.changes.push(keyname);
        }
        this.state[keyname] = 1;
      }

      if (this.capturekeys.indexOf(keyname) != -1 ||
          this.capturekeys.indexOf(keynamemod) != -1) {
        ev.preventDefault();
      }
    }
    this.keyup = function(ev) {
      // Send key events for both keyboard_<key> and keyboard_<modname>_<key>
      var keyname = this.getBindingName("keyboard", ev.keyCode);
      var keynamemod = this.getBindingName("keyboard", ev.keyCode, this.getKeyboardModifiers(ev));

      this.state[keyname] = 0;
      this.state[keynamemod] = 0;
      this.changes.push(keyname);
      this.changes.push(keynamemod);
    }

    this.touchstart = function(ev) {
      var newev = {
        button: 0,
        type: 'mousedown',
        screenX: ev.touches[0].screenX,
        screenY: ev.touches[0].screenY,
        pageX: ev.touches[0].pageX,
        pageY: ev.touches[0].pageY,
        clientX: ev.touches[0].clientX,
        clientY: ev.touches[0].clientY,
        stopPropagation: elation.bind(ev, ev.stopPropagation),
        preventDefault: elation.bind(ev, ev.preventDefault),
      };
      this.lasttouchpos = [newev.clientX, newev.clientY];
      this.mousedown(newev, true);
      //ev.preventDefault();
    }
    this.touchmove = function(ev) {
      if (ev.touches.length == 1) {
        var newev = {
          type: 'mousemove',
          screenX: ev.touches[0].screenX,
          screenY: ev.touches[0].screenY,
          pageX: ev.touches[0].pageX,
          pageY: ev.touches[0].pageY,
          clientX: ev.touches[0].clientX,
          clientY: ev.touches[0].clientY,
          stopPropagation: elation.bind(ev, ev.stopPropagation),
          preventDefault: elation.bind(ev, ev.preventDefault),
        };
        newev.movementX = (this.lasttouchpos[0] - newev.clientX) / devicePixelRatio;
        newev.movementY = (this.lasttouchpos[1] - newev.clientY) / devicePixelRatio;
        this.lasttouchpos = [newev.clientX, newev.clientY];
        this.mousemove(newev);
      } else {
        ev.preventDefault();
      }
    }
    this.touchend = function(ev) {
      if (ev.touches.length == 0) {
        var newev = {
          button: 0,
          type: 'mouseup',
    /*
          screenX: ev.touches[0].screenX,
          screenY: ev.touches[0].screenY,
          pageX: ev.touches[0].pageX,
          pageY: ev.touches[0].pageY,
          clientX: ev.touches[0].clientX,
          clientY: ev.touches[0].clientY,
    */
          stopPropagation: elation.bind(ev, ev.stopPropagation),
          preventDefault: elation.bind(ev, ev.preventDefault),
        };
        this.mouseup(newev);
      }
    }
    this.gesturestart = function(ev) {
      console.log('do a gesture', ev);
      ev.preventDefault();
    }
    this.gesturechange = function(ev) {
      console.log('change a gesture', ev);
    }
    this.gestureend = function(ev) {
      console.log('end a gesture', ev);
    }
    this.deviceorientation = function(ev) {
      console.log('deviceorientation:', [ev.alpha, ev.beta, ev.gamma]);
      var deg2rad = Math.PI/180;

      var radval = [ev.alpha * deg2rad, ev.beta * deg2rad, ev.gamma * deg2rad, window.orientation * deg2rad];

      this.state['orientation'] = {
        alpha: radval[0],
        beta : radval[1] * Math.sin(radval[3]) + radval[2] * Math.cos(radval[3]),
        gamma: radval[2] * Math.sin(radval[3]) + radval[1] * Math.cos(radval[3])
      };
      this.changes.push('orientation');
    }
    this.devicemotion = function(ev) {
      //console.log('devicemotion:', ev.acceleration, ev.rotationRate);
    }

    /* Gamepad handlers */
    this.webkitGamepadconnected = function(ev) {
      this.gamepadconnected(ev);
    }
    this.webkitgamepaddisconnected = function(ev) {
      this.gamepaddisconnected(ev);
    }
    this.MozGamepadConnected = function(ev) {
      this.gamepadconnected(ev);
    }
    this.MozGamepadDisconnected = function(ev) {
      this.gamepaddisconnected(ev);
    }
    this.webkitGamepadConnected = function(ev) {
      gamepadconnected(ev);
    }
    this.gamepadconnected = function(ev) {
      for (var i = 0; i < this.gamepads.length; i++) {
        if (this.gamepads[i] == null) {
          this.gamepads[i] = ev.gamepad;
          console.log('replace previously-connected gamepad ' + i + ':', ev);
          break;
        }
      }
      if (i == this.gamepads.length) {
        this.gamepads.push(ev.gamepad);
        console.log('add new gamepad ' + i + ':', ev);
      }
    }
    this.gamepaddisconnected = function(ev) {
      for (var i = 0; i < this.gamepads.length; i++) {
        if (this.gamepads[i] == ev.gamepad) {
          console.log('remove gamepad ' + i + ':', ev);
          this.gamepads[i] = null;
        }
      }
    }

    this.showviewer = function() {
      var viewerwindow = elation.ui.window({title: 'Control Viewer', append: document.body});
      var viewer = elation.engine.systems.controls.gamepadviewer({controlsystem: this, gamepad: this.gamepads[0]});
      viewerwindow.setcontent(viewer)
    }
    this.deadzone = function(x, y) {
      var deadzone = this.settings.gamepad.deadzone;

      var magnitude = Math.sqrt(x*x + y*y);

      var adjusted = magnitude;
      if (magnitude > deadzone) {
        if (magnitude > 1) magnitude = 1;
        adjusted = (magnitude - deadzone) / (1 - deadzone);
      } else {
        adjusted = 0;
      } 
      return [x * adjusted, y * adjusted];
      //return (Math.abs(value) < this.settings.gamepad.deadzone ? 0 : value);
    }
  });
  elation.component.add('engine.systems.controls.config', function() {
    this.init = function() {
      this.controlsystem = this.args.controlsystem;
      this.create();
    }
    this.create = function() {
        var columns = elation.ui.panel_horizontal({
          append: this,
          classname: 'controls_columns',
        });
        var controltypes = elation.ui.panel_vertical({
          append: columns,
          classname: 'controls_types',
        });
        var mousecontrols = elation.ui.panel({
          append: controltypes,
          classname: 'engine_config_section controls_mouse',
        });
        var gamepadcontrols = elation.ui.panel({
          append: controltypes,
          classname: 'engine_config_section controls_gamepad',
        });
        var keyboardcontrols = elation.ui.panel({
          append: controltypes,
          classname: 'engine_config_section controls_keyboard',
        });
        var label = elation.ui.labeldivider({
          append: mousecontrols, 
          label: 'Mouse'
        });
        var sensitivity = elation.ui.slider({
          append: mousecontrols,
          min: 0,
          max: 500,
          snap: 1,
          label: 'Sensitivity',
          classname: 'controls_mouse_sensitivity',
          handle:
            {
              name: 'handle_one',
              value: this.controlsystem.settings.mouse.sensitivity,
              bindvar: [this.controlsystem.settings.mouse, 'sensitivity'],
            }
        });
        var invertY = elation.ui.toggle({
          append: mousecontrols,
          classname: 'controls_mouse_inverty',
          label: 'Invert Y',
          bindvar: [this.controlsystem.settings.mouse, 'invertY']
        });

        label = elation.ui.labeldivider({
          append: gamepadcontrols, 
          label: 'Gamepad'
        });
        var gamepads = this.controlsystem.getGamepads();
/*
        if (gamepads.length == 0) {
          elation.ui.content({ append: this, content: 'No gamepads connected'});
        } else {
          elation.ui.list({ append: this, items: gamepads, attrs: { label: 'id'}});
          for (var i = 0; i < gamepads.length; i++) {
            if (gamepads[i]) {
              elation.engine.systems.controls.gamepadviewer({ append: this, gamepadnum: i, controlsystem: this.controlsystem });
            }
          }
        }
*/
        elation.engine.systems.controls.gamepadviewer({ append: gamepadcontrols, gamepadnum: 0, controlsystem: this.controlsystem });
        label = elation.ui.labeldivider({
          append: keyboardcontrols, 
          label: 'Keyboard'
        });
/*
        var turnspeed = elation.ui.slider({
          append: this,
          min: 0,
          max: 10,
          snap: .1,
          handle: [
            {
              name: 'handle_two',
              value: this.player.turnSpeed,
              labelprefix: 'Turn Speed:',
              bindvar: [this.player, 'turnSpeed']
            }
          ]
        });
*/
        //elation.ui.content({ append: keyboardcontrols, content: '(TODO - build keybinding UI)'});

        var bindingpanel = elation.engine.systems.controls.bindingviewer({  
          append: columns, 
          controlsystem: this.controlsystem 
        });
    }
  }, elation.ui.panel);

  elation.component.add('engine.systems.controls.gamepadviewer', function() {
    this.init = function() {
      this.controlsystem = this.args.controlsystem;
      this.gamepadnum = this.args.gamepadnum;
      this.gamepad = this.args.gamepad || this.controlsystem.gamepads[this.gamepadnum] || false;
      if (this.gamepad && this.gamepadnum == undefined) {
        this.gamepadnum = this.controlsystem.gamepads.indexOf(this.gamepad);
      }
      this.sticks = [];
      this.buttons = [];

      this.addclass('controls_gamepadviewer');

      if (!this.gamepad) return;
      var controls = {
        'axis_0_horizontal': [ 'gamepad_' + this.gamepadnum + '_axis_0', elation.bind(this, this.update) ],
        'axis_0_vertical': [ 'gamepad_' + this.gamepadnum + '_axis_1', elation.bind(this, this.update) ],
      };
      this.sticks[0] = elation.engine.systems.controls.axisviewer({stick: 'left', append: this});
      var buttonparents = {
        10: this.sticks[0].stickend,
      }
      if (this.gamepad.axes.length > 2) {
        controls.axis_1_horizontal = [ 'gamepad_' + this.gamepadnum + '_axis_2', elation.bind(this, this.update) ];
        controls.axis_1_vertical = [ 'gamepad_' + this.gamepadnum + '_axis_3', elation.bind(this, this.update) ];
        this.sticks[1] = elation.engine.systems.controls.axisviewer({stick: 'right', append: this});
        buttonparents[11] = this.sticks[1].stickend;
      }

      for (var i = 0; i < this.gamepad.buttons.length; i++) {
        controls['button_' + i] = ['gamepad_' + this.gamepadnum + '_button_' + i, elation.bind(this, this.update) ];
        var buttonparent = buttonparents[i] || this;
        this.buttons[i] = elation.engine.systems.controls.buttonviewer({label: i+1, button: this.gamepad.buttons[i], append: buttonparent, buttontype: (i >= 4 && i < 8 ? 'shoulder' : 'normal') });
      }
      this.controlstate = this.controlsystem.addContext('control_viewer', controls);
      this.controlsystem.activateContext('control_viewer');
    }
    this.update = function(ev) {
      this.gamepad = this.args.gamepad || this.controlsystem.gamepads[this.args.gamepadnum] || false;
      //console.log('got a control update', ev, this.controlstate);
      var point_left = {
        x: this.controlstate.axis_0_horizontal,
        y: this.controlstate.axis_0_vertical,
      };
      this.sticks[0].updatepoint(point_left);

      if (this.sticks[1]) {
        var point_right = {
          x: this.controlstate.axis_1_horizontal,
          y: this.controlstate.axis_1_vertical,
        };
        this.sticks[1].updatepoint(point_right);
      }

      for (var i = 0; i < this.buttons.length; i++) {
        this.buttons[i].updatebutton(this.gamepad.buttons[i]);
      }
    }
  }, elation.ui.base);
  elation.component.add('engine.systems.controls.axisviewer', function() {
    this.init = function() {
      this.addclass('controls_gamepad_stick');
      this.addclass('controls_gamepad_stick_' + this.args.stick);

      this.size = this.args.size || 60;

      this.canvas = elation.html.create({tag: 'canvas', append: this});
      this.canvas.width = this.canvas.height = this.size;
      this.ctx = this.canvas.getContext('2d');

      this.point = { x: 0, y: 0 };

      this.stickend = elation.html.create({tag: 'div', classname: 'controls_gamepad_stick_end', append: this});

      this.refresh();

    }
    this.render = function() {
      this.clear();
      this.drawaxes();
      this.drawmarker(this.point);  
    }
    this.clear = function() {
      this.canvas.width = this.canvas.height = this.size;
    }
    this.drawaxes = function() {
      var ctx = this.ctx;

      ctx.beginPath();
      ctx.moveTo(0, this.size / 2);
      ctx.lineTo(this.size, this.size / 2);

      ctx.moveTo(this.size / 2, 0);
      ctx.lineTo(this.size / 2, this.size);

      ctx.closePath();

      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.stroke();
    }
    this.drawmarker = function() {
      var pointsize = 6,
          halfpointsize = pointsize / 2;
      var ctx = this.ctx;
      ctx.strokeStyle = 'rgba(255,0,0,1)';
      ctx.fillStyle = 'rgba(255,0,0,.5)';
      var point = [(this.point.x / 2 + .5), (this.point.y / 2 + .5)],
          scaledpoint = [point[0] * this.size, point[1] * this.size];
    
/*
      var len = Math.sqrt(this.point.x * this.point.x + this.point.y * this.point.y);
      if (len < 1) len = 1;
      var rpoint = [(this.point.x / (2 * len) + .5), (this.point.y / (2 * len) + .5)];
      var point = [(rpoint[0] / len) * this.size, (rpoint[1] / len) * this.size];
console.log(rpoint, point, len);
*/
      ctx.fillRect(scaledpoint[0] - halfpointsize, scaledpoint[1] - halfpointsize, pointsize, pointsize);
      ctx.strokeRect(scaledpoint[0] - halfpointsize, scaledpoint[1] - halfpointsize, pointsize, pointsize);

      var sticksize = 50,
          halfsticksize = sticksize / 2,
          movescale = .35;
      var stickpos = [
        (this.size * (((movescale * this.point.x) / 2 + .5)) - halfsticksize),
        (this.size * (((movescale * this.point.y) / 2 + .5)) - halfsticksize)
      ];
      /*
      this.stickend.style.left = stickpos[0] + 'px';
      this.stickend.style.top = stickpos[1] + 'px';
      */
      this.stickend.style.transform = 'translate(' + stickpos[0] + 'px, ' + stickpos[1] + 'px)';
    }
    this.updatepoint = function(point) {
      this.point.x = point.x;
      this.point.y = point.y;
      this.refresh();
    }
  }, elation.ui.base);
  elation.component.add('engine.systems.controls.buttonviewer', function() {
    this.init = function() {
      this.button = this.args.button;
      this.addclass('controls_gamepad_button');
      this.addclass('controls_gamepad_button_' + this.args.label);
      if (this.args.buttontype) {
        this.addclass('controls_gamepad_button_' + this.args.buttontype);
      }
      this.container.innerHTML = this.args.label;
      console.log('new button', this.button); 
    }
    this.render = function() {
      if (this.button.pressed && !this.hasclass('state_pressed')) {
        this.addclass('state_pressed');
      } else if (!this.button.pressed && this.hasclass('state_pressed')) {
        this.removeclass('state_pressed');
      }
    }
    this.updatebutton = function(button) {
      this.button = button;
      this.refresh();
    }
  }, elation.ui.base);
  elation.component.add('engine.systems.controls.bindingviewer', function() {
    this.init = function() {
      this.addclass('controls_bindings');
      this.controlsystem = this.args.controlsystem;
      this.tabs = elation.ui.tabs({
        append: this,
        classname: 'controls_binding_contexts',
        items: Object.keys(this.controlsystem.contexts),
        events: {
          ui_tabs_change: elation.bind(this, this.updateBindingList)
        } 
      });
      this.bindings = elation.ui.list({
        append: this,
        classname: 'controls_binding_list',
        attrs: {
          itemcomponent: 'engine.systems.controls.binding'
        }
      });
      this.footer = elation.ui.panel_horizontal({
        append: this, 
        classname: 'controls_binding_footer'
      });
      this.footerlabel = elation.ui.labeldivider({
        append: this.footer,
        label: '',
      });
      this.clearbutton = elation.ui.button({
        append: this.footer,
        label: 'Clear',
        events: {
          click: elation.bind(this, this.clearBindings)
        }
      });
      this.savedconfigs = elation.ui.select({
        append: this.footer,
        label: 'Load',
        items: ['default', 'thinger', 'whatsit']
      });
      this.bindings.setItems([]);
      elation.events.add(this.bindings, 'ui_list_select', elation.bind(this, this.rebind));
    }
    this.updateBindingList = function(ev) {
      if (ev && ev.data) {
        var tab = ev.data;
        this.context = tab.name;
      }
      var bindings = this.controlsystem.bindings[this.context];
      var actions = this.controlsystem.contexts[this.context];
      //console.log('set it!', this.context, bindings);
      var actionmap = {};
      for (var binding in bindings) {
        var action = bindings[binding];
        var item = actionmap[action];
        if (item) {
          item.bindings.push(binding);
        } else {
          actionmap[action] = {
            action: action,
            bindings: [binding]
          };
        }
      }
      var items = [];
      for (var action in actions) {
        var item = {
          action: action,
          bindings: (actionmap[action] ? actionmap[action].bindings : []),
          controlsystem: this.controlsystem
        };
        items.push(item);
      }
      
      this.bindings.clear();
      this.bindings.setItems(items);
    }
    this.rebind = function(ev) {
      var bindobj = ev.target;
      if (!this.binder) {
        this.binder = elation.engine.systems.controls.bindcapture({append: bindobj});
      } else {
        this.binder.reparent(bindobj.container);
      }
      this.binder.captureInput().then(elation.bind(this, function(binding) {
        this.controlsystem.bindings[this.context][binding] = bindobj.value.action;
        this.updateBindingList();
      }));
    }
    this.clearBindings = function() {
      var bindings = this.controlsystem.bindings;
      for (var context in bindings) {
        bindings[context] = [];
      }
      this.updateBindingList();
    }
  }, elation.ui.base);
  elation.component.add('engine.systems.controls.binding', function() {
    this.init = function() {
      this.bindings = this.args.bindings || [];

      this.actionlabel = elation.ui.label({
        append: this,
        classname: 'controls_binding_action',
        label: this.args.action
      });
      this.bindinglabel = elation.ui.label({
        append: this,
        classname: 'controls_binding_binding',
        label: this.bindings.join(' '),
      });
    }
  }, elation.ui.base);
  elation.component.add('engine.systems.controls.bindcapture', function() {
    this.init = function() {
      this.bindings = this.args.bindings || [];
      this.controlsystem = this.args.controlsystem;
      this.active = false;
      this.defaulttext = this.args.defaulttext || '(Press any key or button)';

      var content = elation.ui.panel_vertical({});
      this.input = elation.ui.input({
        append: content,
        value: this.defaulttext
      });
      this.window = elation.ui.window({
        append: this,
        resizable: false,
        content: content
      });

      elation.events.add(this.input.inputelement, 'keydown', function(ev) { ev.preventDefault(); });
      elation.events.add(this.input, 'blur', elation.bind(this, this.cancel));

      // FIXME - binding so we can remove events later
      this.handleControlChange = elation.bind(this, this.handleControlChange);
      elation.events.add(this.controlsystem, 'control_change', this.handleControlChange);

    }
    this.captureInput = function() {
      if (this.active) {
        this.cancel();
      }
      this.activepromise = new Promise(elation.bind(this, function(resolve, reject) {
        console.log('Begin capture...');
        this.active = true;
        this.promisefuncs = [resolve, reject];
        this.show();
        this.input.value = this.defaulttext;
        this.input.focus();
      }));
      return this.activepromise;
    }
    this.handleControlChange = function(ev) {
      if (this.active) {
        console.log('control changed!', ev);
        var control = ev.data;
        var isModifier = this.isModifier(control.name);
        if (control.value == 1 && !isModifier) {
          // If it's a modifier, ignore the "press" event (value == 1)
          this.input.value = control.name;
          this.accept();
        } else if (control.value == 0 && isModifier && this.input.value == this.defaulttext) {
          // If it's a modifier and this is an "unpress" event (value == 0), only accept if no previous value was set
          // This allows binding of shift/alt/ctrl keys by themselves, while also allowing shift_x ctrl_x etc.  
          this.input.value = control.name;
          this.accept();
        }
      }
    }
    this.isModifier = function(keyname) {
      var parts = keyname.split('_');
      var modifiers = ['shift', 'alt', 'ctrl'];
      if (parts[0] == 'keyboard') {
        if (parts[1] == 'nomod') return true;
        return parts.length == 2 && parts[1] in modifiers;
      }
      return false;
    }
    this.cancel = function() {
      if (this.active) {
        this.hide();
        this.active = false;
        if (this.promisefuncs[1]) {
          this.promisefuncs[1]();
        }
        this.promisefuncs = [];
        console.log('Binding cancelled!');
      }
    }
    this.accept = function() {
      if (this.active) {
        this.hide();
        this.active = false;
        console.log('Binding accepted!', this.input.value);
        if (this.promisefuncs[0]) {
          this.promisefuncs[0](this.input.value);
        }
        this.promisefuncs = [];
      }
    }
  }, elation.ui.base);

});
