elation.extend("engine.systems.admin", function(args) {
  elation.implement(this, elation.engine.systems.system);
  this.system_attach = function(ev) {
    console.log('INIT: admin');

    elation.html.addclass(this.container, "engine_admin");
    this.world = this.engine.systems.get('world');

    this.inspector = elation.engine.systems.admin.inspector('admin', elation.html.create({append: document.body}), {world: this.world});
    this.scenetree = elation.engine.systems.admin.scenetree(null, elation.html.create({append: document.body}), {world: this.world});


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
  }
});
elation.component.add("engine.systems.admin.scenetree", function() {
  this.init = function() {
    this.world = this.args.world;
    this.container.innerHTML = '<h2>Scene</h2>';
    elation.html.addclass(this.container, 'engine_admin_scenetree style_box');
    elation.events.add(this.container, "mousewheel", function(ev) { ev.stopPropagation(); }); // FIXME - hack for mousewheel
    elation.events.add(this.world, 'item_create', this);
    setTimeout(elation.bind(this, function() { this.add(this.world); }), 1000);
    this.create();
  }
  this.create = function() {
    //this.add(this.world);
  }
  this.add = function(item, root) {
    if (!root) root = this.container;
    var header = elation.html.create({tag: 'span', append: root, content: item.id});
    
    if (item.children) {
      var ul = elation.html.create({tag: 'ul'});
      var i = 0;
      for (var k in item.children) {
        var f = elation.engine.systems.admin.thing(null, elation.html.create({tag: 'li', append: ul}), {thing: item.children[k]});;
        elation.events.add(f, 'engine_admin_thing_select,engine_admin_thing_hover', this);
        this.add(item.children[k], f.container);
        i++;
      }
      if (i > 0) {
        root.appendChild(ul);
      }
    }
  }
  this.engine_admin_thing_hover = function(ev) {
    if (this.hoverthing && this.hoverthing != ev.target) {
      this.hoverthing.unhover();
    }
    this.hoverthing = ev.target;
  }
  this.engine_admin_thing_select = function(ev) {
    if (this.selectedthing) {
      this.selectedthing.unselect();
    }
    this.selectedthing = ev.target;
    elation.engine.systems.admin.inspector('admin').setThing(this.selectedthing);
  }
});
elation.component.add("engine.systems.admin.thing", function() {
  this.init = function() {
    this.thing = this.args.thing;
    if (!this.thing.exists) {
      elation.html.addclass(this.container, "state_disabled");
    }
    elation.events.add(this.container, "mouseover,mouseout,click", this);
    elation.events.add(this.thing, "mouseover,mouseout,click", this);
  }
  this.hover = function() {
    elation.html.addclass(this.container, 'state_hover');
    elation.events.fire({type: 'engine_admin_thing_hover', element: this});
    //this.container.scrollIntoView();
  }
  this.unhover = function() {
    elation.html.removeclass(this.container, 'state_hover');
    elation.events.fire({type: 'engine_admin_thing_unhover', element: this});
  }
  this.select = function() {
    elation.events.fire({type: 'engine_admin_thing_select', element: this});
    //this.container.scrollIntoView();
    elation.html.addclass(this.container, 'state_selected');
  }
  this.unselect = function() {
    elation.html.removeclass(this.container, 'state_selected');
    elation.events.fire({type: 'engine_admin_thing_unselect', element: this});
  }
  this.mouseover = function(ev) {
    this.hover();
    ev.stopPropagation();
  }
  this.mouseout = function(ev) {
    this.unhover();
    ev.stopPropagation();
  }
  this.mousedown = function(ev) {
  }
  this.mouseup = function(ev) {
  }
  this.click = function(ev) {
    this.select();
    ev.stopPropagation();
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
    this.thing = thingwrapper;
    var thing = thingwrapper.thing;
    if (!this.tabs) {
      this.createTabs();
    }
    this.label.innerHTML = thing.id;
    this.tabs.setActiveTab("properties");
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
      this.contentarea.innerHTML = '';
      this.tabcontents[newtab.name].reparent(this.contentarea);
      this.tabcontents[newtab.name].setThing(this.thing);
    }
  }
});
elation.component.add("engine.systems.admin.inspector.properties", function() {
  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_properties');
    this.propul = elation.html.create({tag: 'ul', append: this.container});
  }
  this.setThing = function(thingwrapper) {
    var thing = thingwrapper.thing;
    this.propul.innerHTML = '';
    for (var k in thing.properties) {
      var li = elation.html.create({tag: 'li', append: this.propul, content: '<h3>' + k + '</h3>'});
      this.addProperties(thing.properties[k], li);
    }
  }
  this.addProperties = function(properties, root) {
      if (!root) root = this.container;
      var propul = elation.html.create({tag: 'ul', append: root});
      for (var k in properties) {
        //var htmlid = 'engine_admin_inspector_property_' + k + '_' + k;
        if (properties[k] instanceof Object && !elation.utils.isArray(properties[k])) {
          var li = elation.html.create({tag: 'li', append: propul, content: '<span>' + k + '</span>'});
          this.addProperties(properties[k], li);
        } else {
          var li = elation.html.create({tag: 'li', append: propul, content: '<label for="' + 'huh' + '">' + k + '</label> <input id="' + 'huh' + '" value="' + properties[k] + '"/>'});
        }
      }
  }
});
elation.component.add("engine.systems.admin.inspector.objects", function() {
  this.types = ['Mesh', 'PointLight', 'DirectionalLight', 'Light', 'ParticleSystem', 'PerspectiveCamera', 'OrthographicCamera', 'Camera', 'Object3D'];
  this.init = function() {
  }
  this.setThing = function(thingwrapper) {
    this.thing = thingwrapper.thing;
    this.container.innerHTML = '';
    this.addObjects(this.thing.objects);
  }
  this.addObjects = function(objects, root) {
    if (!root) root = this.container;

    var ul = elation.html.create({tag: 'ul', append: root});
    for (var k in objects) {
      //var htmlid = 'engine_admin_inspector_property_' + k + '_' + k;
      if (objects[k] && objects[k] instanceof THREE.Object3D) {
        if (!objects[k].thing || objects[k]._thing == this.thing) {
          var type = 'Object3D';
  //console.log('object ' + objects[k].name + ': ', objects[k]);
          for (var i = 0; i < this.types.length; i++) {
            if (objects[k] instanceof THREE[this.types[i]]) {
              type = this.types[i];
              break;
            }
          }
      
          var objname = objects[k].name || objects[k].id;
          var li = elation.html.create({tag: 'li', append: ul, content: '<span>' + objname + ' (' + type + ')</span>'});
          if (objects[k].children.length > 0) {
            this.addObjects(objects[k].children, li);
          }
        }
      }
    }
  }
});

