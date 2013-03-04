elation.extend("engine.systems.world", function(args) {
  elation.implement(this, elation.engine.systems.system);
  this.children = {};
  this.scene = {
    'world-3d': new THREE.Scene(),
    'world-dom': new THREE.Scene()
  };
//this.scene['world-3d'].fog = new THREE.FogExp2(0x000000, 0.0000008);

  this.system_attach = function(ev) {
    console.log('INIT: world', this);
/*
    if (this.loadonstart) {
      this.load(this.loadonstart);
      this.loadonstart = false;
    }
*/
    this.admin = elation.engine.systems.world.admin(null, elation.html.create({append: document.body}), {world: this});
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: world');
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: world');
  }
  this.add = function(thing) {
    this.children[thing.name] = thing;
    if (thing.objects['3d']) {
      this.scene['world-3d'].add(thing.objects['3d']);
      elation.events.add(thing, 'engine_thing_create', this);
    }
    if (thing.container) {
      //this.renderer['world-dom'].domElement.appendChild(thing.container);
    }
  }
  this.remove = function(thing) {
    if (this.children[thing.name]) {
      if (thing.objects['3d']) {
        this.scene['world-3d'].remove(thing.objects['3d']);
      }
      if (thing.container) {
        this.renderer['world-dom'].domElement.removeChild(thing.container);
      }
      delete this.children[thing.name];
    }
  }
  this.load = function(thing, root, logprefix) {
    if (!logprefix) logprefix = "";;
    if (typeof root == 'undefined') root = this;
    var currentobj = false;
    try {
      if (typeof elation.engine.things[thing.type] == 'function') {
        thing.engine = this.engine;
        currentobj = elation.engine.things[thing.type](thing.name, elation.html.create(), thing);
        root.add(currentobj);

        console.log(logprefix + "\t- added new " + thing.type + ": " + thing.parentname + '/' + thing.name, currentobj);
        if (thing.things) {
          for (var k in thing.things) {
            this.load(thing.things[k], currentobj, logprefix + "\t");
          }
        }
      } else {
        console.error(logprefix + "\t- ***ERROR*** don't know how to handle thing type '" + thing.type + "'", thing);
      }
    } catch (e) {
      console.error(e.stack);
    }
  }
});

elation.component.add("engine.systems.world.admin", function() {
  this.init = function() {
    this.world = this.args.world;
    
    elation.html.addclass(this.container, "engine_world_admin");

    this.inspector = elation.engine.systems.world.admin.inspector('admin', elation.html.create({append: this.container}), {world: this.world});
    this.scenetree = elation.engine.systems.world.admin.scenetree(null, elation.html.create({append: this.container}), {world: this.world});
  }
});
elation.component.add("engine.systems.world.admin.scenetree", function() {
  this.init = function() {
    this.world = this.args.world;
    this.container.innerHTML = '<h2>Scene</h2>';
    elation.html.addclass(this.container, 'engine_world_admin_scenetree style_box');
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
        var f = elation.engine.systems.world.admin.thing(null, elation.html.create({tag: 'li', append: ul}), {thing: item.children[k]});;
        elation.events.add(f, 'engine_world_admin_thing_select,engine_world_admin_thing_hover', this);
        this.add(item.children[k], f.container);
        i++;
      }
      if (i > 0) {
        root.appendChild(ul);
      }
    }
  }
/*
  this.mouseover = function(ev) {
    elation.html.addclass(ev.target, 'state_hover');
    ev.stopPropagation();
  }
  this.mouseout = function(ev) {
    elation.html.removeclass(ev.target, 'state_hover');
    ev.stopPropagation();
  }
*/
  this.engine_world_admin_thing_hover = function(ev) {
    if (this.hoverthing && this.hoverthing != ev.target) {
      this.hoverthing.unhover();
    }
    this.hoverthing = ev.target;
  }
  this.engine_world_admin_thing_select = function(ev) {
    if (this.selectedthing) {
      this.selectedthing.unselect();
    }
    this.selectedthing = ev.target;
    elation.engine.systems.world.admin.inspector('admin').setThing(this.selectedthing);
  }
});
elation.component.add("engine.systems.world.admin.thing", function() {
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
    elation.events.fire({type: 'engine_world_admin_thing_hover', element: this});
  }
  this.unhover = function() {
    elation.html.removeclass(this.container, 'state_hover');
    elation.events.fire({type: 'engine_world_admin_thing_unhover', element: this});
  }
  this.select = function() {
    elation.events.fire({type: 'engine_world_admin_thing_select', element: this});
    elation.html.addclass(this.container, 'state_selected');
  }
  this.unselect = function() {
    elation.html.removeclass(this.container, 'state_selected');
    elation.events.fire({type: 'engine_world_admin_thing_unselect', element: this});
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
elation.component.add("engine.systems.world.admin.inspector", function() {
  this.init = function() {
    elation.html.addclass(this.container, 'engine_world_admin_inspector style_box');
  }
  this.setThing = function(thingwrapper) {
    console.log('Set active thing:', thingwrapper);
    var thing = thingwrapper.thing;
    this.container.innerHTML = '<h2>' + thing.name + '</h2>';
    var propul = elation.html.create({tag: 'ul', append: this.container});
    for (var k in thing.properties) {
      var li = elation.html.create({tag: 'li', append: propul, content: '<h3>' + k + '</h3>'});
      var prop2ul = elation.html.create({tag: 'ul', append: li});
      for (var k2 in thing.properties[k]) {
        var htmlid = 'engine_world_admin_inspector_property_' + k + '_' + k2;
        var li = elation.html.create({tag: 'li', append: prop2ul, content: '<label for="' + htmlid + '">' + k2 + '</label> <input id="' + htmlid + '" value="' + thing.properties[k][k2] + '"/>'});
      }
    }
console.log(thing.objects['3d']);
  }
});
