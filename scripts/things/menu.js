elation.require(['engine.things.generic', 'engine.things.label'], function() {
  elation.component.add('engine.things.menu', function() {
    this.postinit = function() {
      this.defineProperties({
        items: { type: 'object' },
        labelcfg: { type: 'object', default: {} }
      });
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      var light = new THREE.PointLight(0xffffff, 1, 100);
      light.position.set(-.1,0,1);
      obj.add(light);
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
      this.label = this.spawn('label', null, {
        text: this.properties.text, 
        font: this.properties.font, 
        size: this.properties.size, 
        color: color
      });
      var bbox = this.label.objects['3d'].geometry.boundingBox;
      var boxgeo = new THREE.BoxGeometry(this.properties.size * 10, this.properties.size * 1.4, this.properties.size / 4);
      var mat = new THREE.MeshBasicMaterial({color: this.properties.color, opacity: .1, transparent: true});
      var mesh = new THREE.Mesh(boxgeo, mat);
      this.objects['3d'].add(mesh);
      elation.events.add(this.label, 'mouseover,mouseout,mousedown,mouseup,click', this);
    }
    this.mouseover = function(ev) {
      //this.material.depthTest = false;
      //this.material.transparent = true;
      //this.material.depthWrite = false;
      var color = (this.properties.disabled ? this.properties.disabledhovercolor : this.properties.hovercolor);
      this.label.material.color.setHex(color);
      this.label.material.emissive.setHex(color);
      this.label.refresh();
      this.refresh();
    }
    this.mouseout = function(ev) {
      this.label.material.color.setHex((this.properties.disabled ? this.properties.disabledcolor : this.properties.color));
      this.label.material.emissive.setHex(0x000000);
      this.label.refresh();
      this.refresh();
    }
    this.click = function(ev) {
      if (this.properties.callback && typeof this.properties.callback == 'function') {
        ev.stopPropagation();
        this.properties.callback();
      }
    }
  }, elation.engine.things.generic);
});
