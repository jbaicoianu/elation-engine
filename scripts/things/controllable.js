elation.component.add('engine.things.controllable', function() {
  this.cameras = {};
  this.controls = {};

  this.initControllable = function() {
  }
  this.addControlContext = function(contextname, mappings, obj) {
    var commands = {}, bindings = {};
    for (var k in mappings) {
      if (elation.utils.isArray(mappings[k])) {
        var keys = mappings[k][0].split(',');
        if (obj) {
          commands[k] = elation.bind(obj, mappings[k][1]);
        } else {
          commands[k] = mappings[k][1];
        }
      } else {
        commands[k] = (function(statename) { return function(ev) { this.setState(statename, ev.value); } })(k);
        var keys = mappings[k].split(',');
      }
      for (i = 0; i < keys.length; i++) {
        bindings[keys[i]] = k;
      }
      //this.state[k] = 0;
    }

    this.engine.systems.controls.addCommands(contextname, commands);
    this.engine.systems.controls.addBindings(contextname, bindings);
    this.controlcontext = contextname;
  }
}, elation.engine.things.generic);
