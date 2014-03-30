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

elation.extend("engine.systems.controls", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.contexts = {};
  this.activecontexts = [];
  this.bindings = {};
  this.state = {};
  this.contexttargets = {};
  this.changes = [];
  this.gamepads = [];
  this.viewport = [];


  this.system_attach = function(ev) {
    console.log('INIT: controls');
    this.initcontrols();
    if (this.loadonstart) {
      for (var k in this.loadonstart) {
        this.addContext(k, this.loadonstart[k]);
      }
    }
  }
  this.engine_frame = function(ev) {
    //console.log("FRAME: controls");
    this.update(ev.delta);
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: controls');
  }

  this.initcontrols = function() {
    if (!this.container) this.container = window;
    elation.events.add(this.container, "mousedown,mousemove,mouseup,mousewheel,DOMMouseScroll", this);
    elation.events.add(window, "keydown,keyup,webkitGamepadConnected,webkitgamepaddisconnected,MozGamepadConnected,MozGamepadDisconnected,gamepadconnected,gamepaddisconnected", this);

    if (args) {
      this.addContexts(args);
    }
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
    for (var k in contextargs) {
      bindings[contextargs[k][0]] = k;
      commands[k] = contextargs[k][1];
    }
    this.addCommands(context, commands);
    this.addBindings(context, bindings);
    console.log("\t- added control context: " + context);
  }
  this.activateContext = function(context, target) {
    if (this.activecontexts.indexOf(context) == -1) {
      console.log('\t- activate control context ' + context);
      this.activecontexts.unshift(context);
    }
    if (target) {
      this.contexttargets[context] = target;
    }
  }
  this.deactivateContext = function(context) {
    var i = this.activecontexts.indexOf(context);
    if (i != -1) {
      console.log('Deactivate control context ' + context);
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

    if (this.changes.length > 0) {
      var now = new Date().getTime();
      for (var i = 0; i < this.changes.length; i++) {
        for (var j = 0; j < this.activecontexts.length; j++) {
          var context = this.activecontexts[j];
          if (this.bindings[context] && this.bindings[context][this.changes[i]]) {
            var action = this.bindings[context][this.changes[i]];
            if (this.contexts[context][action]) {
              var ev = {timeStamp: now, type: this.changes[i], value: this.state[this.changes[i]]};
              //console.log('call it', this.changes[i], this.bindings[context][this.changes[i]], this.state[this.changes[i]]);
              if (this.contexttargets[context]) {
                ev.data = this.contexttargets[context];
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
      }
      this.changes = [];

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
          bindname = basename + codes[type][id];
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
    if (this.gamepads.length > 0) {
      for (var i = 0; i < this.gamepads.length; i++) {
        if (this.gamepads[i] != null) {
          var gamepad = this.gamepads[i];
          for (var a = 0; a < gamepad.axes.length; a++) {
            var bindname = this.getBindingName('gamepad', i, 'axis_' + a);
            if (this.state[bindname] != gamepad.axes[a]) {
              this.changes.push(bindname);
              this.state[bindname] = gamepad.axes[a];
              this.state[bindname + '_full'] = THREE.Math.mapLinear(gamepad.axes[a], -1, 1, 0, 1);
            }
          }
          for (var b = 0; b < gamepad.buttons.length; b++) {
            var bindname = this.getBindingName('gamepad', i, 'button_' + b);
            if (this.state[bindname] != gamepad.buttons[b]) {
              this.changes.push(bindname);
              this.state[bindname] = gamepad.buttons[b];
            }
          }
        }
      }
    }
  }
  this.getMousePosition = function(ev) {
    var relpos = [ev.clientX - this.container.offsetLeft, ev.clientY - this.container.offsetTop];
    //console.log(relpos, [ev.clientX, ev.clientY], [this.container.offsetWidth, this.container.offsetHeight], [this.container.offsetTop, this.container.offsetLeft]);
    var ret = [(relpos[0] / this.container.offsetWidth - .5) * 2, (relpos[1] / this.container.offsetHeight - .5) * 2];
    return ret;
  }
  this.getKeyboardModifiers = function(ev) {
    var ret = "";
    var modifiers = {'shiftKey': 'shift', 'altKey': 'alt', 'ctrlKey': 'ctrl'};
    for (var k in modifiers) {
      if (ev[k]) {
        ret += (ret.length > 0 ? "_" : "") + modifiers[k];
      }
    }
    return ret;
  }
  this.mousedown = function(ev) {
    var bindid = "mouse_button_" + ev.button;
    if (!this.state[bindid]) {
      this.state[bindid] = 1;
      this.changes.push(bindid);
    }
    //elation.events.add(window, "mousemove,mouseup", this);
  }
  this.mousemove = function(ev) {
    var mpos = this.getMousePosition(ev);
    if (this.scene) {
this.fuh = [ev.clientX, ev.clientY];
    }
    var status = {mouse_pos: false, mouse_x: false, mouse_y: false};
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
    if (status["mouse_pos"]) {
      if (status["mouse_x"]) {
        this.state["mouse_delta_x"] = this.state["mouse_x"] - mpos[0];
        this.state["mouse_x"] = mpos[0];
        this.changes.push("mouse_x");
        this.changes.push("mouse_delta_x");
        if (this.state["mouse_button_0"]) {
          this.state["mouse_drag_x"] = this.state["mouse_x"];
          this.state["mouse_drag_delta_x"] = this.state["mouse_delta_x"];
          this.changes.push("mouse_drag_x");
          this.changes.push("mouse_drag_delta_x");
        }
      } else {
        this.state["mouse_delta_x"] = 0;
        this.state["mouse_drag_delta_x"] = 0;
      }
      this.state["mouse_pos"] = mpos;
      this.state["mouse_delta"] = [this.state["mouse_delta_x"], this.state["mouse_delta_y"]];
      this.changes.push("mouse_pos");
      this.changes.push("mouse_delta");
      if (status["mouse_y"]) {
        this.state["mouse_delta_y"] = this.state["mouse_y"] - mpos[1];
        this.state["mouse_y"] = mpos[1];
        this.changes.push("mouse_y");
        this.changes.push("mouse_delta_y");
        if (this.state["mouse_button_0"]) {
          this.state["mouse_drag_y"] = this.state["mouse_y"];
          this.state["mouse_drag_delta_y"] = this.state["mouse_delta_y"];
          this.changes.push("mouse_drag_y");
          this.changes.push("mouse_drag_delta_y");
        }
      } else {
        this.state["mouse_delta_y"] = 0;
        this.state["mouse_drag_delta_y"] = 0;
      }
      if (this.state["mouse_button_0"]) {
        this.state["mouse_drag"] = this.state["mouse_pos"];
        this.state["mouse_drag_delta"] = [this.state["mouse_drag_delta_x"], this.state["mouse_drag_delta_y"]];
        this.changes.push("mouse_drag");
        this.changes.push("mouse_drag_delta");
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
    var keyname = this.getBindingName("keyboard", ev.keyCode, this.getKeyboardModifiers(ev));
    //console.log(keyname + ' down', ev.value);
    if (!this.state[keyname]) {
      this.changes.push(keyname);
    }
    this.state[keyname] = 1;
  }
  this.keyup = function(ev) {
    var keymod = this.getKeyboardModifiers(ev);
    if (keymod != '') {
      var keyname = this.getBindingName("keyboard", ev.keyCode, keymod);
      this.state[keyname] = 0;
      this.changes.push(keyname);
    } else {
      var keyname = this.getBindingName("keyboard", ev.keyCode);
      this.state[keyname] = 0;
      this.changes.push(keyname);
    }
  }
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

});
