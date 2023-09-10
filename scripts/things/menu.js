elation.require(['engine.things.generic', 'engine.things.label'], function() {
  elation.component.add('engine.things.menu', function() {
    this.postinit = function() {
      this.defineProperties({
        items: { type: 'object' },
        labelcfg: { type: 'object', default: {} }
      });
      this.controlstate = this.engine.systems.controls.addContext('menu', {
        'menu_up': ['keyboard_up,gamepad_any_button_12', elation.bind(this, this.updateControls)],
        'menu_down': ['keyboard_down,gamepad_any_axis_1,gamepad_0_axis_3,gamepad_0_button_13', elation.bind(this, this.updateControls)],
        'activate': ['keyboard_enter,gamepad_any_button_0', elation.bind(this, this.updateControls)],
      });
      this.selected = false;
      this.menuitems = [];
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
/*
      var light = new THREE.PointLight(0xffffff, 1, 100);
      light.position.set(-.1,0,1);
      obj.add(light);
*/
      return obj;
    }
    this.createChildren = function() {
      var labelcfg = this.properties.labelcfg;
      var size = labelcfg.size || 1;
      var lineheight = labelcfg.lineheight || 1.4;
      var fullheight = size * lineheight * this.properties.items.length;
      for (var k in this.properties.items) {
        var item = this.properties.items[k];
        var itemcfg = {
          collidable: true,
          opacity: .8,
        };
        elation.utils.merge(labelcfg, itemcfg);
        elation.utils.merge(item, itemcfg);

        itemcfg.position = [0, (fullheight / 2) - (k * size * lineheight), 0];

        var l = this.spawn('menuitem', 'menuitem_' + itemcfg.text, itemcfg);
        this.menuitems.push(l);
        elation.events.add(l, 'menuitem_select', elation.bind(this, this.updateselected));
        elation.events.add(l, 'menuitem_deselect', elation.bind(this, this.updateselected));
      }
    }
    this.updateselected = function(ev) {
      if (ev.type == 'menuitem_select') {
        this.selected = ev.target;
      } else {
        this.selected = false;
      }
    }
    this.updateControls = function(ev) {
      var threshold = 0.999;
      if (Math.abs(ev.value) >= threshold) {
        // FIXME - this is hacky.  if ev.value is 1, we then look at what actions are active, and act on all of them
        if (this.controlstate.menu_up >= threshold || this.controlstate.menu_down <= -threshold) {
          this.selectprevious();
        }
        if (this.controlstate.menu_down >= threshold || this.controlstate.menu_up <= -threshold) {
          this.selectnext();
        }
        if (this.controlstate.activate >= threshold && this.selected) {
          this.selected.activate();
        }
      }
    }
    this.enable = function() {
      this.controlstate._reset();
      this.engine.systems.controls.activateContext('menu');
      elation.events.fire({type: 'menu_enable', element: this});
    }
    this.disable = function() {
      this.controlstate._reset();
      this.engine.systems.controls.deactivateContext('menu');
      elation.events.fire({type: 'menu_disable', element: this});
    }
    this.selectfirst = function() {
      if (this.selected) {
        this.selected.deselect();
      }
    
      for (var i = 0; i < this.menuitems.length; i++) {
        var item = this.menuitems[i];
        if (!item.properties.disabled) {
          item.select();
          break;
        }
      }
    }
    this.selectlast = function() {
      if (this.selected) {
        this.selected.deselect();
      }
      for (var i = 0; i < this.menuitems.length; i++) {
        var item = this.menuitems[this.menuitems.length - i - 1];
        if (!item.properties.disabled) {
          item.select();
          break;
        }
      }
    }
    this.selectnext = function() {
      if (!this.selected) {
        this.selectfirst();
      } else {
        var idx = this.menuitems.indexOf(this.selected);
        this.selected.deselect();
        for (var i = 0; i < this.menuitems.length; i++) {
          var newitem = this.menuitems[(idx + i + 1) % this.menuitems.length];
          if (!newitem.properties.disabled) {
            newitem.select();
            break;
          }
        }
      }
    }
    this.selectprevious = function() {
      if (!this.selected) {
        this.selectlast();
      } else {
        var idx = this.menuitems.indexOf(this.selected);
        this.selected.deselect();
        for (var i = 1; i < this.menuitems.length; i++) {
          var newidx = idx - i;
          if (newidx < 0) newidx = this.menuitems.length - 1;
          var newitem = this.menuitems[newidx];
          if (!newitem.properties.disabled) {
            newitem.select();
            break;
          }
        }
      }
    }
  }, elation.engine.things.generic);
  elation.component.add('engine.things.menuitem', function() {
    this.postinit = function() {
      elation.engine.things.menuitem.extendclass.postinit.call(this);
      this.defineProperties({
        'text':            { type: 'string' },
        'font':            { type: 'string', default: 'helvetiker' },
        'size':            { type: 'float', default: 1.0 },
        'lineheight':      { type: 'float', default: 1.4 },
        'color':           { type: 'color', default: 0xffffff },
        'backgroundcolor': { type: 'color', default: 0x333333 },
        'emissive':        { type: 'color', default: 0x444444 },
        'hovercolor':      { type: 'color', default: 0xffffcc },
        'hoveremissive':   { type: 'color', default: 0x006600 },
        'disabledcolor':   { type: 'color', default: 0xaa0000 },
        'disabledhovercolor': { type: 'color', default: 0xaa0000 },
        'disabledemissive': { type: 'color', default: 0x331111 },
        'disabledhoveremissive': { type: 'color', default: 0x440000 },
        'callback':        { type: 'function' },
        'disabled':        { type: 'bool', default: false },
      });
      elation.events.add(this, 'mouseover,mouseout,mousedown,mouseup,click', this);
    }
    this.createObject3D = function() {
      var color = (this.properties.disabled ? this.properties.disabledcolor : this.properties.color);
      var emissive = (this.properties.disabled ? this.properties.disabledemissive : this.properties.emissive);

      // background plane
      //var boxgeo = new THREE.PlaneGeometry(this.properties.size * 10, this.properties.size * this.properties.lineheight);
      var boxgeo = new THREE.BoxGeometry(this.properties.size * 10, this.properties.size * this.properties.lineheight, .001);
      var mat = new THREE.MeshPhongMaterial({color: this.properties.backgroundcolor, emissive: emissive, opacity: .8, transparent: true, depthTest: false});
      var mesh = new THREE.Mesh(boxgeo, mat);
      mesh.renderOrder = 5;
      return mesh;
    }
    this.createChildren = function() {
      var color = (this.properties.disabled ? this.properties.disabledcolor : this.properties.color);
      var emissive = (this.properties.disabled ? this.properties.disabledemissive : this.properties.emissive);
      this.label = this.spawn('label', this.id + '_label', {
        text: this.properties.text, 
        position: [0,0,this.properties.size/2],
        thickness: .01, 
        font: this.properties.font, 
        size: this.properties.size, 
        color: color,
        emissive: emissive,
        align: 'center',
        verticalalign: 'middle',
        opacity: 0.75,
        depthTest: false,
        'bevel.enabled': true,
        'bevel.thickness': .0004,
        'bevel.size': .0004,
        collidable: true
      });
      this.label.objects['3d'].renderOrder = 6;
      elation.events.add(this.label, 'mouseover,mouseout,mousedown,mouseup,click', this);
    }
    this.select = function() {
      //this.material.depthTest = false;
      //this.material.transparent = true;
      //this.material.depthWrite = false;
      var color = (this.properties.disabled ? this.properties.disabledhovercolor : this.properties.hovercolor);
      var emissive = (this.properties.disabled ? this.properties.disabledhoveremissive : this.properties.hoveremissive);
      if (this.label) {
        this.label.material.color.copy(color)
        this.label.material.emissive.copy(emissive);
        this.label.refresh();
      }

      var view = this.engine.systems.render.views.main;
      if (!this.properties.disabled && !view.hasclass('state_cursor')) {
        view.addclass('state_cursor');
      }

      var gamepads = this.engine.systems.controls.gamepads;
      if (gamepads && gamepads[0] && gamepads[0].vibrate) {
        gamepads[0].vibrate(80);
      }

      this.refresh();
      elation.events.fire({type: 'menuitem_select', element: this});
    }
    this.deselect = function() {
      var color = (this.properties.disabled ? this.properties.disabledcolor : this.properties.color);
      var emissive = (this.properties.disabled ? this.properties.disabledemissive : this.properties.emissive);
      if (this.label) {
        this.label.material.color.copy(color);
        this.label.material.emissive.copy(emissive);
        this.label.refresh();
      }

      var view = this.engine.systems.render.views.main;
      if (view.hasclass('state_cursor')) {
        view.removeclass('state_cursor');
      }

      this.refresh();
      elation.events.fire({type: 'menuitem_deselect', element: this});
    }
    this.activate = function() {
      if (this.properties.callback && typeof this.properties.callback == 'function') {
        this.properties.callback();
        elation.events.fire({type: 'menuitem_activate', element: this});

        var gamepads = this.engine.systems.controls.gamepads;
        if (gamepads && gamepads[0] && gamepads[0].vibrate) {
          gamepads[0].vibrate(120);
        }
        return true;
      }
      return false;
    }
    this.mouseover = function(ev) {
      this.select();
    }
    this.mouseout = function(ev) {
      this.deselect();
    }
    this.click = function(ev) {
      if (this.activate()) {
        ev.stopPropagation();
      }
    }
  }, elation.engine.things.generic);
});
