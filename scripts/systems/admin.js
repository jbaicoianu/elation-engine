elation.extend("engine.systems.admin", function(args) {
  elation.implement(this, elation.engine.systems.system);
  this.system_attach = function(ev) {
    console.log('INIT: admin');

    elation.html.addclass(this.container, "engine_admin");
    this.world = this.engine.systems.get('world');

    this.inspector = elation.engine.systems.admin.inspector('admin', elation.html.create({append: document.body}), {world: this.world});
    this.scenetree = elation.engine.systems.admin.scenetree(null, elation.html.create({append: document.body}), {world: this.world});

/*
    setTimeout(elation.bind(this, function() {
      var controls = this.engine.systems.get('controls');
      var view = this.engine.systems.get('render').views['main'];
      controls.addCommands('admin', {
        'move_left': elation.bind(view.camera, function() { this.position.x -= 1; }),
        'move_right': elation.bind(view.camera, function() { this.position.x += 1; }),
        'move_forward': elation.bind(view.camera, function() { this.position.z -= 1; }),
        'move_back': elation.bind(view.camera, function() { this.position.z += 1; }),
        'move_up': elation.bind(view.camera, function() { this.position.y += 1; }),
        'move_down': elation.bind(view.camera, function() { this.position.y -= 1; })
      });
      controls.addBindings('admin', {
        'keyboard_w': 'move_forward',
        'keyboard_a': 'move_left',
        'keyboard_s': 'move_back',
        'keyboard_d': 'move_right',
        'keyboard_r': 'move_up',
        'keyboard_f': 'move_down',
      });
      controls.activateContext('admin');
    }), 1000);
*/
  }
  this.engine_frame = function(ev) {
    if (!this.flycontrols) {
      var view = this.engine.systems.get('render').views['main'];
      this.flycontrols = new THREE.FlyControls(view.camera, view.container);
      this.flycontrols.movementSpeed = 10;
      this.flycontrols.rollSpeed = Math.PI/4;
      this.flycontrols.dragToLook = true;
    }

    this.flycontrols.update(ev.data.delta);
  }
});
elation.component.add("engine.systems.admin.scenetree", function() {
  this.init = function() {
    this.world = this.args.world;
    this.container.innerHTML = '<h2>Scene</h2>';
    elation.html.addclass(this.container, 'engine_admin_scenetree style_box');
    elation.events.add(this.world, 'engine_thing_create', this);
    if (this.world.loaded) {
      this.create();
    } else {
      elation.events.add(this.world, "engine_world_init", elation.bind(this, this.create));
    }
  }
  this.create = function() {
    this.treeview = elation.ui.treeview(null, elation.html.create({tag: 'div', classname: 'engine_admin_scenetree_list', append: this.container}), {
      items: this.world.children,
      attrs: {
        children: 'children',
        label: 'id',
      }
    });
    elation.events.add(this.treeview, 'ui_treeview_select,ui_treeview_hover', this);
  }
  this.ui_treeview_hover = function(ev) {
  }
  this.ui_treeview_select = function(ev) {
    this.selectedthing = ev.data;
    elation.engine.systems.admin.inspector('admin').setThing(this.selectedthing);
  }
});
elation.component.add("engine.systems.admin.inspector", function() {
  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector style_box');
    elation.events.add(this.container, "mousewheel", function(ev) { ev.stopPropagation(); }); // FIXME - hack for mousewheel
    this.label = elation.html.create({tag: 'h2', append: this.container});
    this.tabcontents = {
      properties: elation.engine.systems.admin.inspector.properties(null, elation.html.create()),
      objects: elation.engine.systems.admin.inspector.objects(null, elation.html.create())
    };
  }
  this.setThing = function(thingwrapper) {
    this.thingwrapper = thingwrapper;
    var thing = thingwrapper.value;
    if (!this.tabs) {
      this.createTabs();
    }
    this.label.innerHTML = thing.id;
    this.tabs.setActiveTab(this.activetab || "properties");
    //this.properties.setThing(thingwrapper);
    //this.objects.setThing(thingwrapper);
  }
  this.createTabs = function() {
    this.tabs = elation.ui.tabs(null, elation.html.create({append: this.container}), {
      items: [
        {
          label: "Properties",
          name: "properties",
        },
        {
          label: "Objects",
          name: "objects",
        },
      ]});
    this.contentarea = elation.html.create({tag: 'div', classname: 'engine_admin_inspector_contents', append: this.container});
    elation.events.add(this.tabs, 'ui_tabs_change', this);
  }
  this.ui_tabs_change = function(ev) {
    var newtab = ev.data;
    if (this.tabcontents[newtab.name]) {
      this.activetab = newtab.name;
      this.contentarea.innerHTML = '';
      this.tabcontents[newtab.name].reparent(this.contentarea);
      this.tabcontents[newtab.name].setThing(this.thingwrapper);
    }
  }
});
elation.component.add("engine.systems.admin.inspector.properties", function() {
  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_properties ui_treeview');
    this.propul = elation.html.create({tag: 'ul', append: this.container});
  }
  this.setThing = function(thingwrapper) {
    this.thingwrapper = thingwrapper;
    var thing = thingwrapper.value;
    this.propul.innerHTML = '';
    for (var k in thing.properties) {
      var li = elation.html.create({tag: 'li', append: this.propul, content: '<h3>' + k + '</h3>'});
      this.addProperties(thing.properties[k], li, "engine_admin_inspector_properties_" + k);
    }
  }
  this.addProperties = function(properties, root, idprefix) {
    if (!root) root = this.container;
    var propul = elation.html.create({tag: 'ul', append: root});
    for (var k in properties) {
      var htmlid = idprefix + "_" + k;
      if (properties[k] instanceof Object && !elation.utils.isArray(properties[k])) {
        var li = elation.html.create({tag: 'li', append: propul, content: '<span>' + k + '</span>'});
        this.addProperties(properties[k], li, htmlid);
      } else {
        var li = elation.html.create({tag: 'li', append: propul});
        var label = elation.html.create({tag: 'label', attributes: { htmlFor: htmlid }, content: k, append: li});
        var input = elation.html.create({tag: 'input', id: htmlid, attributes: { value: properties[k] }, append: li});
        elation.events.add(input, 'change', this);
      }
    }
  }
  this.change = function(ev) {
    var propname = ev.target.id.replace(/^engine_admin_inspector_properties_/, "").replace(/_/g, ".");
    //var thing = this.thingwrapper.thing;
    this.thing.set(propname, ev.target.value);
  }
});
elation.component.add("engine.systems.admin.inspector.objects", function() {
  this.types = ['Mesh', 'PointLight', 'DirectionalLight', 'Light', 'ParticleSystem', 'PerspectiveCamera', 'OrthographicCamera', 'Camera', 'TextGeometry', 'CubeGeometry', 'SphereGeometry', 'PlaneGeometry', 'TorusGeometry', 'Geometry', 'MeshPhongMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'ShaderMaterial', 'Material', 'Object3D'];
  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_objects ui_treeview');
  }
  this.setThing = function(thingwrapper) {
    this.thing = thingwrapper.value;
    this.container.innerHTML = '';
    this.addObjects(this.thing.objects);
  }
  this.addObjects = function(objects, root) {
    if (!root) root = this.container;

    var ul = elation.html.create({tag: 'ul', append: root});
    for (var k in objects) {
      //var htmlid = 'engine_admin_inspector_property_' + k + '_' + k;
      if (!elation.utils.isNull(objects[k])) {
        if (objects[k] instanceof elation.physics.rigidbody) {
          // TODO - show physics object to allow editing
        } else if (!objects[k]._thing || objects[k]._thing == this.thing) {
          var type = 'Object3D';
          //console.log('object ' + objects[k].name + ': ', objects[k]);
          for (var i = 0; i < this.types.length; i++) {
            if (objects[k] instanceof THREE[this.types[i]]) {
              type = this.types[i];
              break;
            }
          }
      
          var objname = objects[k].name || objects[k].id;
          var li = elation.html.create({tag: 'li', classname: 'engine_thing engine_thing_' + type.toLowerCase(), append: ul, content: '<span>' + objname + ' (' + type + ')</span>'});
          if (type == 'Mesh') {
            this.addObjects([objects[k].geometry, objects[k].material], li);
          }
          if (objects[k].children && objects[k].children.length > 0) {
            this.addObjects(objects[k].children, li);
          }
        }
      }
    }
  }
});

