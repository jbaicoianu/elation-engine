elation.require(['engine.things.generic', 'engine.things.label'], function() {
  elation.component.add('engine.things.menu', function() {
    this.postinit = function() {
      this.defineProperties({
        items: { type: 'object' },
        labelcfg: { type: 'object', default: {} }
      });
      this.controlstate = this.engine.systems.controls.addContext('menu', {
        'menu_up': ['keyboard_up', elation.bind(this, this.updateControls)],
        'menu_down': ['keyboard_down,gamepad_0_axis_1', elation.bind(this, this.updateControls)],
        'activate': ['keyboard_enter,gamepad_0_button_0', elation.bind(this, this.updateControls)],
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
          collidable: false,
          opacity: .8,
        };
        elation.utils.merge(labelcfg, itemcfg);
        elation.utils.merge(item, itemcfg);

        itemcfg.position = [0, (fullheight / 2) - (k * size * lineheight), 0];

        var l = this.spawn('menuitem', null, itemcfg);
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
      if (Math.abs(ev.value) == 1) {
        // FIXME - this is hacky.  if ev.value is 1, we then look at what actions are active, and act on all of them
        if (this.controlstate.menu_up == 1 || this.controlstate.menu_down == -1) {
          this.selectprevious();
        }
        if (this.controlstate.menu_down == 1 || this.controlstate.menu_up == -1) {
          this.selectnext();
        }
        if (this.controlstate.activate == 1) {
          this.selected.activate();
        }
      }
    }
    this.enable = function() {
      this.controlstate._reset();
      this.engine.systems.controls.activateContext('menu');
    }
    this.disable = function() {
      this.controlstate._reset();
      this.engine.systems.controls.deactivateContext('menu');
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
console.log(i, this.menuitems.length, item);
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
        'color':           { type: 'color', default: 0xcccccc },
        'hovercolor':      { type: 'color', default: 0xffffcc },
        'disabledcolor':   { type: 'color', default: 0x111111 },
        'disabledhovercolor': { type: 'color', default: 0xff0000 },
        'callback':        { type: 'function' },
        'disabled':        { type: 'bool', default: false },
      });
      elation.events.add(this, 'mouseover,mouseout,mousedown,mouseup,click', this);
    }
    this.createChildren = function() {
      var color = (this.properties.disabled ? this.properties.disabledcolor : this.properties.color);

      // background plane
      var boxgeo = new THREE.PlaneBufferGeometry(this.properties.size * 10, this.properties.size * this.properties.lineheight);
      var mat = new THREE.MeshBasicMaterial({color: this.properties.color, opacity: .1, transparent: true});
      var mesh = new THREE.Mesh(boxgeo, mat);
      mesh.position.z = -this.properties.size;
      this.objects['3d'].add(mesh);
      this.label = this.spawn('label', null, {
        text: this.properties.text, 
        font: this.properties.font, 
        size: this.properties.size, 
        color: color
      });
      elation.events.add(this.label, 'mouseover,mouseout,mousedown,mouseup,click', this);
    }
    this.select = function() {
      //this.material.depthTest = false;
      //this.material.transparent = true;
      //this.material.depthWrite = false;
      var color = (this.properties.disabled ? this.properties.disabledhovercolor : this.properties.hovercolor);
      this.label.material.color.setHex(color);
      this.label.material.emissive.setHex(color);
      this.label.refresh();
      this.refresh();
      elation.events.fire({type: 'menuitem_select', element: this});
    }
    this.deselect = function() {
      this.label.material.color.setHex((this.properties.disabled ? this.properties.disabledcolor : this.properties.color));
      this.label.material.emissive.setHex(0x000000);
      this.label.refresh();
      this.refresh();
      elation.events.fire({type: 'menuitem_deselect', element: this});
    }
    this.activate = function() {
      if (this.properties.callback && typeof this.properties.callback == 'function') {
        this.properties.callback();
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
