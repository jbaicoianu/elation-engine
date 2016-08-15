elation.require("engine.things.controller", function() {
  elation.extend("engine.systems.ai", function(args) {
    elation.implement(this, elation.engine.systems.system);

    this.thinkers = [];
    this.lastthink = 0;
    this.thinktime = 1000 / 20;

    this.system_attach = function(ev) {
      console.log('INIT: ai');
    }
    this.engine_frame = function(ev) {
      for (var i = 0; i < this.thinkers.length; i++) {
        if (ev.data.ts > this.thinkers[i].lastthink + this.thinkers[i].thinktime) {
          try {
            this.performThink(this.thinkers[i], ev.data);
          } catch (e) {
            console.log(e.stack);
          }
        }
      }
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: ai');
    }
    this.performThink = function(thinker, data) {
      elation.events.fire({type: 'thing_think', element: thinker, data: data});
      thinker.lastthink = data.ts;
    }
    this.add = function(thing) {
      if (this.thinkers.indexOf(thing) == -1) {
        this.thinkers.push(thing);
        //elation.events.add(thing, 'thing_remove', elation.bind(this, this.remove, thing));
      }
    }
    this.remove = function(thing) {
      var idx = this.thinkers.indexOf(thing);
      if (idx != -1) {
        this.thinkers.splice(idx, 1);
      }
    }
  });
  elation.component.add("engine.things.sensor_vision", function() {
    this.postinit = function() {
      this.defineProperties({
        'fovX': { type: 'float', default: Math.PI / 8 },
        'fovY': { type: 'float', default: Math.PI / 16 },
        'range': { type: 'float', default: 20 },
        'self': { type: 'object' },
      });
    }
    this.viscones = [];

    this.createObject3D = function() {
      this.objects['3d'] = new THREE.Object3D();
      this.material = new THREE.MeshPhongMaterial({color: 0xff0000, emissive: 0x660000, transparent: true, opacity: .1});
      this.addVisibilityCone(this.properties.fovX, this.properties.fovY, this.properties.range);
      return this.objects['3d'];
    }
    this.getVisibleObjects = function(sorted, tag) {
      var visible = [];
      for (var i = 0; i < this.viscones.length; i++) {
        this.getObjectsInCone(this.viscones[i], visible, tag);
      }
      if (visible.length > 0) {
        this.material.color.setHex(0x00ff00);
        this.material.emissive.setHex(0x006600);
      } else {
        this.material.color.setHex(0xff0000);
        this.material.emissive.setHex(0x660000);
      }
      if (sorted) {
        visible.sort(function(a,b) { return a.distance - b.distance; });
      }
      return visible;
    }
    this.getObjectsInCone = function(cone, visible, tag) {
      if (visible === undefined) visible = [];
      var eyepos = this.localToWorld(new THREE.Vector3(0,0,0));
      var eyedir = this.localToWorld(new THREE.Vector3(0,0,-1)).sub(eyepos);
      var world = this.engine.systems.world;
      var scene = world.scene['world-3d'];

      var objpos = new THREE.Vector3();

      var rangeSq = cone.range * cone.range;
      var halfFovX = cone.fovX / 2;
      var halfFovY = cone.fovY / 2;

      scene.traverse(elation.bind(this, function(node) {
        if (node instanceof THREE.Mesh) {
          var thing = this.getParentThing(node);
          if (thing !== this && (tag === undefined || thing.hasTag(tag))) {
            // get object's position in the eye's coordinate system
            this.worldToLocal(node.localToWorld(objpos.set(0,0,0)));

            var angleX = Math.atan2(objpos.x, -objpos.z);
            var angleY = Math.atan2(objpos.y, -objpos.z);

            if ((Math.abs(angleX) < halfFovX) &&
                (Math.abs(angleY) < halfFovY) &&
                (objpos.lengthSq() < rangeSq) &&
                (!this.isDescendent(thing)) &&
                (visible.indexOf(thing) == -1)) { // FIXME - unique object check won't work if we use wrapper objects
              //console.log(node, angleX, angleY);
              visible.push({thing: thing, distance: objpos.length()});
            }
          }
        }
      }));

      return visible;
    }
    this.addVisibilityCone = function(fovX, fovY, range) {
      this.viscones.push({fovX: fovX, fovY: fovY, range: range});
      //var dx = Math.sin(fovX) * range;
      //var dy = Math.sin(fovY) * range;

      var dx = Math.tan(fovX / 2)  * range;
      var dy = Math.tan(fovY / 2)  * range;

      var box = new THREE.BoxGeometry(dx, dy, range);
      box.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0,0,-range/2)));

      box.vertices[0].set(0,0,0);
      box.vertices[2].set(0,0,0);
      box.vertices[5].set(0,0,0);
      box.vertices[7].set(0,0,0);
  /*
      box.vertices[1].set(0,0,0);
      box.vertices[3].set(0,0,0);
      box.vertices[4].set(0,0,0);
      box.vertices[6].set(0,0,0);
  */

      box.computeFaceNormals();
    
      var obj = new THREE.Mesh(box, this.material);
      this.objects['3d'].add(obj);
      return obj;
    }
    this.getParentThing = function(obj) {
      while (obj) {
        if (obj.userData.thing) return obj.userData.thing;
        obj = obj.parent;
      }
      return null;
    }
    this.isDescendent = function(thing) {
      var self = this.properties.self || this;
      while (thing) {
        if (thing === self) return true;
        thing = thing.parent;
      }
      return false;
    }
  }, elation.engine.things.generic);
  elation.component.add("engine.things.sensor_sound", function() {
  }, elation.engine.things.generic);
  elation.component.add("engine.things.sensor_temperature", function() {
  }, elation.engine.things.generic);
});
