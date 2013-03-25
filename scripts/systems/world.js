elation.extend("engine.systems.world", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.children = {};
  this.scene = {
    'world-3d': new THREE.Scene(),
    'world-dom': new THREE.Scene()
  };
  //this.scene['world-3d'].fog = new THREE.FogExp2(0x000000, 0.0000008);

  this.system_attach = function(ev) {
    console.log('INIT: world', this, args);
    this.loaded = false;
    if (!elation.utils.isEmpty(args)) {
      this.load(args);
    }
  }
  this.engine_frame = function(ev) {
    //console.log('FRAME: world');
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: world');
  }
  this.add = function(thing) {
    this.children[thing.name] = thing;
    thing.parent = this;
    if (thing.objects['3d']) {
      this.scene['world-3d'].add(thing.objects['3d']);
    }
    if (thing.container) {
      //this.renderer['world-dom'].domElement.appendChild(thing.container);
    }
    elation.events.fire({type: 'engine_thing_create', element: thing});
  }
  this.remove = function(thing) {
    if (this.children[thing.name]) {
      if (thing.objects['3d']) {
        this.scene['world-3d'].remove(thing.objects['3d']);
      }
      if (thing.container) {
        //this.renderer['world-dom'].domElement.removeChild(thing.container);
      }
      elation.events.fire({type: 'engine_thing_destroy', element: thing});
      delete this.children[thing.name];
    }
  }
  this.load = function(thing, root, logprefix) {
    if (!logprefix) logprefix = "";;
    if (typeof root == 'undefined') root = this;
    var currentobj = false;
    try {
      if (typeof elation.engine.things[thing.type] != 'function') {
        thing.type = 'generic';
      }

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
    if (root == this) {
      this.loaded = true;
      elation.events.fire({type: 'engine_world_init', element: this});
    }
  }
});

