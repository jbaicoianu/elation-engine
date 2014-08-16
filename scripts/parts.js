elation.extend("engine.parts", new function() {
  this.library = {};

  this.add = function(name, objdef) {
    this.library[name] = objdef;
  }
  this.get = function(name, thing, args) {
    if (this.library[name] !== undefined) {
      return new this.library[name](thing, args);
    }
  }
});

elation.component.add('engine.parts.base', function() {
  this.init = function() {
    this.initProperties();
    this.defineComponentProperties({
      thing: { type: 'object', enumerable: false },
    });
  }

  this.initProperties = function() {
    // Set up some of the internal component properties as "private" (non-enumerable)
    // These use Object.defineProperty() directly, because we don't need proxy properties
    Object.defineProperties(this, {
      '_properties': { enumerable: false, value: {} },
      'args': { enumerable: false, value: this.args || {} },
      'events': { enumerable: false, value: this.events || {} },
      'name': { enumerable: false, value: this.name },
      'componentname': { enumerable: false, value: this.componentname },
      'container': { enumerable: false, value: this.container },
    });
  }
      
  this.defineComponentProperties = function(properties) {
    //elation.utils.merge(properties, this._properties);
    for (var k in properties) {
      this.createProxyProperty(k, properties[k]);
      if (this.args[k] !== undefined) {
        this[k] = this.args[k];
      } else if (properties[k].default !== undefined && this._properties[k].value === undefined) {
        this[k] = properties[k].default;
      }
    }
  }
  this.createProxyProperty = function(k, propdef) {
    this._properties[k] = propdef;

    Object.defineProperty(this, k, { 
      enumerable: (propdef.enumerable !== undefined ? propdef.enumerable : true),
      configurable: true,
      get: function() { 
        return this._properties[k].value; 
      }, 
      set: function(v) {
        var oldvalue = this._properties[k].value;
        this._properties[k].value = v; 
        elation.events.fire({element: this, type: 'component_property_change', data: { key: k, oldvalue: oldvalue, value: v }});
      }
    });
  }
  this.getComponentProperties = function() {
    return this._properties;
  }
});

elation.component.add('engine.parts.physics.rigidbody', function() {
  this.init = function() {
    elation.engine.parts.moveup.extendclass.init.call(this);
    this.defineComponentProperties({
      speed: { type: 'float', default: 1 },
    });
  }
  this.setup = function() {
    this.thing.objects.dynamics.setVelocity(new THREE.Vector3(0, this.speed, 0));
  }
}, elation.engine.parts.base);

elation.component.add('engine.parts.render.mesh', function() {
  this.init = function() {
    elation.engine.parts.render.mesh.extendclass.init.call(this);
    this.defineComponentProperties({
      geometry: { type: 'object' },
      material: { type: 'object' },
    });
  }
  this.setup = function() {
    
  }
}, elation.engine.parts.base);
