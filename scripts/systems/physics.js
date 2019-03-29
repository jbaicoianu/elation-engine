elation.require(["physics.cyclone"], function() {
  elation.extend("engine.systems.physics", function(args) {
    elation.implement(this, elation.engine.systems.system);
    this.system = false;
    this.timescale = 1;
    this.debugwindows = {};
    this.debugvis = {};
    this.debugthings = {};
    this.async = false;
    this.asyncframerate = 60;

    this.system_attach = function(ev) {
      console.log('INIT: physics');
      this.system = new elation.physics.system({autostart: false});

      // Only show second framerate gauge if physics system is decoupled from framerate
      if (this.async && ENV_IS_BROWSER) {
        this.initstats();
      }
    }
    this.engine_start = function(ev) {
      //console.log("PHYSICS: starting");
      this.system.start();
      this.lasttime = new Date().getTime();
      if (this.interval) {
        clearInterval(this.interval);
      }
      if (this.async) {
        this.interval = setInterval(elation.bind(this, function() {
          var now = new Date().getTime();
            //this.system.step(this.timescale * (now - this.lasttime) / 1000);
            //if (this.stats) this.stats.update();
          this.step((now - this.lasttime) / 1000);
          this.lasttime = now;
        }), 1000/this.asyncframerate);
      }
    }
    this.engine_frame = function(ev) {
      // console.log("FRAME: physics");
      if (!this.async) {
        this.step(ev.data.delta);
      }
    }
    this.engine_stop = function(ev) {
      console.log('SHUTDOWN: physics');
      if (this.interval) {
        clearInterval(this.interval);
        this.interval = false;
      }
    }
    this.initstats = function() {
      this.stats = new Stats();
      this.stats.domElement.style.position = 'absolute';
      this.stats.domElement.style.top = '0px';
      this.stats.domElement.style.zIndex = 100;
      document.body.appendChild(this.stats.domElement);
      this.stats.domElement.style.right = this.stats.domElement.offsetWidth + 'px';
      this.stats.domElement.childNodes[0].childNodes[0].style.color = '#900';
      this.stats.domElement.childNodes[0].childNodes[1].style.backgroundColor = '#900';
    }
    this.add = function(obj) {
      this.system.add(obj);
    }
    this.remove = function(obj) {
      this.system.remove(obj);
    }
    this.step = function(delta) {
      this.system.step(this.timescale * delta);
      if (this.stats) this.stats.update();
      if (this.debugthing) {
        this.debugupdate(this.debugthing);
      }
    }
    this.debug = function(thing) {
/*
      if (!this.debugwindows[thing.name]) {
        this.debugwindows[thing.name] = elation.ui.window(null, elation.html.create({tag: 'div', append: document.body}), {title: "Physics Debug - " + thing.name, center: true, right: 10});
        this.debugwindows[thing.name].setcontent(elation.html.create('ul'));
        elation.events.add(this.debugwindows[thing.name], 'ui_window_close', elation.bind(this, function(ev) {
          console.log('REMOVE IT', thing.name);
          this.debugvis[thing.name].die();
          this.debugvis[thing.name] = false;
          if (thing == this.debugthing) this.debugthing = false;
          this.debugwindows[thing.name] = false; 
          delete this.debugthings[thing.name];
        }));

      }
*/
      if (!this.debugvis[thing.name]) {
        this.debugvis[thing.name]= thing.spawn('physics_vis', thing.name + '_physvis', {target: thing, pickable: false, persist: false, physical: false, window: this.debugwindows[thing.name]});
      } else if (!this.debugvis[thing.name].parent) {
        thing.add(this.debugvis[thing.name]);
      }
      if (!this.debugthings[thing.name]) {
        this.debugthings[thing.name] = thing;
      }
  /*
      if (!this.debugvis[thing.name].parent || this.debugvis[thing.name].parent != thing || this.debugvis[thing.name].objects['3d'].parent != thing.objects['3d']) {
        this.debugvis[thing.name].reparent(thing);
      }
  */
      //this.debugwindows[thing.name].focus();
      this.debugthing = thing;
      this.debugupdate(thing);
    }
    this.disableDebug = function(thing) {
      if (this.debugvis[thing.name] && this.debugvis[thing.name].parent) {
        this.debugvis[thing.name].parent.remove(this.debugvis[thing.name]);
      }
    }
    this.debugupdate = function(thing) {
      for (var name in this.debugthings) {
        var thing = this.debugthings[name];
        var win = this.debugwindows[name];
        if (win) {
          if (thing.objects.dynamics) {
            var ul = win.content;
            if (ul.innerHTML == '' || !thing.objects.dynamics.state.sleeping) {
              ul.innerHTML = '';
              var values = ['state', 'mass', 'position', 'velocity', 'acceleration', 'angular', 'angularacceleration', 'force_accumulator', 'damping'];
              for (var i = 0; i < values.length; i++) {
                var li = elation.html.create('li');
                var content = "<strong>" + values[i] + ":</strong> ";
                var value = thing.objects.dynamics[values[i]];
                if (value instanceof THREE.Vector3) {
                  content += "[ " + (+value.x).toFixed(4) + ", " + (+value.y).toFixed(4) + ", " + (+value.z).toFixed(4) + " ]";
                } else if (values[i] == 'state') {
                  for (var k in value) {
                    var tag = (value[k] ? "add" : "del");
                    content += "<" + tag + ">" + k + "</" + tag + "> ";
                  }
                } else if (values[i] == 'damping') {
                  content += "[" + thing.objects.dynamics.linearDamping + ', ' + thing.objects.dynamics.angularDamping + "]";
                } else {
                  content += value;
                }
                li.innerHTML = content;
                ul.appendChild(li);
              }
            }
          } else {
            this.debugwindows[thing.name].close();
          }
        }
      }
    }
  });
  elation.component.add("engine.things.physics_vis", function(args) {
    this.postinit = function() {
      this.defineProperties({
        target: { type: 'thing' },
        forcescale: { type: 'float', default: .1 },
        window: { type: 'object' }
      });
    }
    this.createObject3D = function() {
      //this.objects['3d'] = new THREE.Object3D();
      this.objects['3d'] = new THREE.Object3D();

      var obj = this.properties.target;
      elation.events.add(obj, 'mouseover', (ev) => this.handleMouseOver(ev));
      elation.events.add(obj, 'mouseout', (ev) => this.handleMouseOut(ev));
      if (obj.objects['3d']) {
/*
        if (!obj.objects['3d'].geometry.boundingBox) {
          obj.objects['3d'].geometry.computeBoundingBox();
        }
*/
        //var bbox = obj.objects['3d'].geometry.boundingBox;
        var bbox = obj.getBoundingBox();

        if (obj.objects['dynamics']) {
          this.velocityvis = this.spawn('physics_velocity', this.name + '_velocity', {body: obj.objects['dynamics'], pickable: false, mouseevents: false, persist: false, physical: false}, true);
          this.collidervis = this.spawn('physics_collider', this.name + '_collider', {body: obj.objects['dynamics'], pickable: false, mouseevents: false, persist: false, physical: false});
          var forceargs = {
            body: obj.objects['dynamics'],
            boundingbox: bbox,
            forcescale: this.properties.forcescale,
            pickable: false,
            mouseevents: false,
            persist: false,
            physical: false
          };
          for (var k in obj.objects['dynamics'].forces) {
            forceargs.force = obj.objects['dynamics'].forces[k];
            var type = false;
console.log('A FORCE!', forceargs.force);
            for (var f in elation.physics.forces) {
              if (forceargs.force instanceof elation.physics.forces[f]) {
                this.spawn('physics_forces_' + f, obj.name + '_force_' + f + '_' + k, forceargs);
              }
            }
          }
        }

      }

      if (this.properties.window) {
        var foo = new THREE.CSS3DSprite(this.properties.window.container);
        foo.position.set(2.5,0,0);
        foo.scale.set(.01,.01,.01);
        this.objects['3d'].add(foo);
      }

      return this.objects['3d'];
    }
    this.handleMouseOver = function(ev) {
      this.showHighlight();
    }
    this.handleMouseOut = function(ev) {
      this.hideHighlight();
    }
    this.showHighlight = function() {
      //this.collidervis.showHighlight();
    }
    this.hideHighlight = function() {
      //this.collidervis.hideHighlight();
    }
    
  }, elation.engine.things.generic);
  elation.component.add("engine.things.physics_velocity", function(args) {
    this.postinit = function() {
      this.defineProperties({
        body:        {type: 'object'},
        fadetime:    {type: 'float', default: 2.0},
      });
      this.segmentOffset = 0;
      this.numSegments = this.fadetime * 60 / 2;
      elation.events.add(this.engine, 'engine_frame', this);
      elation.events.add(this.body.object, 'thing_remove', (ev) => this.handleThingRemove(ev));
    }
    this.createObject3D = function() {
      let geo = new THREE.BufferGeometry();
      let positions = new Float32Array(this.numSegments * 3 * 2);
      let opacity = new Float32Array(this.numSegments * 2);
      geo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.addAttribute('opacity', new THREE.BufferAttribute(opacity, 1));
      let material1 = new THREE.LineBasicMaterial({color: 0x00ffff, transparent: true, depthWrite: false, depthTest: false, opacity: .05, blending: THREE.AdditiveBlending, linewidth: 4});
      let material2 = new THREE.LineBasicMaterial({color: 0x00ffff, transparent: true, depthWrite: false, depthTest: true, opacity: .2, blending: THREE.AdditiveBlending, linewidth: 4});
      this.geometry = geo;
      let obj = new THREE.Object3D();
      obj.add(new THREE.LineSegments(geo, material1));
      obj.add(new THREE.LineSegments(geo, material2));
      return obj;
    },
    this.engine_frame = (function() {
      let v0 = new THREE.Vector3(),
          v1 = new THREE.Vector3(),
          vel = new THREE.Vector3();
      return function(ev) {
        if (!this.body.parent) return;

        let position = this.geometry.attributes.position.array;
        if (!this.lastpos) {
          this.lastpos = new THREE.Vector3();
          this.body.localToWorldPos(this.lastpos.set(0,0,0));
          for (let i = 0; i < this.numSegments; i++) {
            let idx = i * 3;
            position[idx] = this.lastpos.x;
            position[idx+1] = this.lastpos.y;
            position[idx+2] = this.lastpos.z;
          }
          return;
        }

        //this.body.localToWorldPos(v0.set(0,0,0));
        //v1.copy(v0).add(vel.copy(this.body.velocity).multiplyScalar(ev.data.delta));
        v0.copy(this.lastpos);
        this.body.localToWorldPos(v1.set(0,0,0));
        this.lastpos.copy(v1);

        let idx = this.segmentOffset * 3 * 2;
        this.segmentOffset = (this.segmentOffset + 1) % this.numSegments;

        position[idx] = v0.x;
        position[idx+1] = v0.y;
        position[idx+2] = v0.z;

        position[idx+3] = v1.x;
        position[idx+4] = v1.y;
        position[idx+5] = v1.z;

        this.geometry.attributes.position.needsUpdate = true;
        let l = v1.length();
        if (l > this.geometry.boundingSphere.radius) {
          this.geometry.boundingSphere.radius = l;
        }
      }
    })();
    this.handleThingRemove = function(ev) {
      setTimeout(() => {
        this.die();
      }, this.fadetime * 1000);
    }
  }, elation.engine.things.generic);
  elation.component.add("engine.things.physics_collider", function(args) {
    this.postinit = function() {
      this.defineProperties({
        body:        {type: 'object'},
        boundingbox: { type: 'object' },
        forcescale: { type: 'float', default: .1 }
      });
      elation.events.add(this.properties.body, 'physics_collide', this);
      this.collisioncount = 0;
    }
    this.createObject3D = function() {
      if (this.objects['3d']) return this.objects['3d'];
      var collider = this.properties.body.collider;
      var obj = false;
      if (collider) {
        switch (collider.type) {
          case 'sphere':
            obj = this.createBoundingSphere(collider);
            break;
          case 'plane':
            obj = this.createBoundingPlane(collider);
            break;
          case 'cylinder':
            obj = this.createBoundingCylinder(collider);
            break;
          case 'mesh':
            obj = this.createBoundingMesh(collider);
            break;
          case 'box':
          default:
            obj = this.createBoundingBox(collider);
            break;
        }
      } else {
        obj = new THREE.Object3D();
      }
      if (this.properties.body.mass > 0) {
        var cg = this.createCG();
        obj.add(cg);
      }
      return obj;
    }
    this.createBoundingBox = function(collider) {
      var bbox = collider;

      var corners = [
        [bbox.min.x, bbox.max.y, bbox.min.z],
        [bbox.max.x, bbox.max.y, bbox.min.z],
        [bbox.max.x, bbox.max.y, bbox.max.z],
        [bbox.min.x, bbox.max.y, bbox.max.z],
        [bbox.min.x, bbox.min.y, bbox.min.z],
        [bbox.max.x, bbox.min.y, bbox.min.z],
        [bbox.max.x, bbox.min.y, bbox.max.z],
        [bbox.min.x, bbox.min.y, bbox.max.z],
      ];
      var edges = [
        // top
        [corners[0], corners[1]],
        [corners[1], corners[2]],
        [corners[2], corners[3]],
        [corners[3], corners[0]],
        // bottom
        [corners[4], corners[5]],
        [corners[5], corners[6]],
        [corners[6], corners[7]],
        [corners[7], corners[4]],
        // sides
        [corners[0], corners[4]],
        [corners[1], corners[5]],
        [corners[2], corners[6]],
        [corners[3], corners[7]]
      ]
      var linegeo = new THREE.Geometry();
      for (var i = 0; i < edges.length; i++) {
        var edge = edges[i];
        linegeo.vertices.push(new THREE.Vector3(edge[0][0], edge[0][1], edge[0][2]));
        linegeo.vertices.push(new THREE.Vector3(edge[1][0], edge[1][1], edge[1][2]));
      }
      //var boxgeo = new THREE.BoxGeometry(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z);
      var boxmat = new THREE.LineBasicMaterial({color: 0x0000ff, transparent: true, depthWrite: false, depthTest: false, opacity: .2, blending: THREE.AdditiveBlending});
      var outline = new THREE.LineSegments(linegeo, boxmat, THREE.LinePieces);

      var volume = new THREE.Mesh(new THREE.BoxBufferGeometry(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z, 10, 10, 10), new THREE.MeshPhongMaterial({color: 0xaaaaaa, emissive: 0x666666, depthTest: true, depthWrite: true, opacity: .1, transparent: true}));
      volume.position.addVectors(bbox.max, bbox.min).multiplyScalar(.5);
  console.log(this.properties.body);
      //outline.add(volume);
      //outline.add(new THREE.AxisHelper(.5));

      // temporary helpers for debugging coordinate space transforms
  /*
      var forward = new THREE.Vector3(0,0,-1);
      this.arrows = { 
        forward: new THREE.ArrowHelper(forward, new THREE.Vector3(0,0,0), 2, 0x00ffff),
        forward_world: new THREE.ArrowHelper(this.properties.body.localToWorldDir(forward.clone()), new THREE.Vector3(0,0,0), 2, 0x00ff66),
        forward_local: new THREE.ArrowHelper(this.properties.body.worldToLocalDir(forward.clone()), new THREE.Vector3(0,0,0), 2, 0x0066ff)
      };
      outline.add(this.arrows.forward);
      outline.add(this.arrows.forward_world);
      outline.add(this.arrows.forward_local);
      elation.events.add(this.properties.body.object.engine, 'engine_frame', this);
  */
      return outline;
    }
    this.createBoundingSphere = function(collider) {
      var spheregeo = new THREE.SphereBufferGeometry(collider.radius, 18, 9);
      //var spheregeo = new THREE.IcosahedronGeometry(collider.radius, 2);
      var spheremat = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: .2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: 1, wireframe: false, blending: THREE.AdditiveBlending});
      var spherewiremat = new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: .1, depthWrite: false, depthTest: false, wireframe: true, blending: THREE.AdditiveBlending});
      var outline = new THREE.Mesh(spheregeo, spherewiremat);
      //outline.add(new THREE.Mesh(spheregeo, spheremat));

      return outline;
    }
    this.createBoundingPlane = function(collider) {
      var plane = new THREE.PlaneBufferGeometry(1000, 1000);
      var planemat = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: .04, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: 1, wireframe: false, blending: THREE.AdditiveBlending });
  // FIXME - this only really works for horizontal planes
  var mat = new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), -Math.PI/2));
  plane.applyMatrix(mat);
      var mesh = new THREE.Mesh(plane, planemat);
      return mesh;
    }
    this.createBoundingCylinder = function(collider) {
      var cyl = new THREE.CylinderBufferGeometry(collider.radius, collider.radius, collider.height, 32, 1);
      //var cylmat = new THREE.MeshBasicMaterial({color: 0x00ffff, transparent: true, opacity: .1, depthWrite: false, depthTest: false, wireframe: true, blending: THREE.AdditiveBlending});
      var cylmat = new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: .1, depthWrite: false, depthTest: false, wireframe: true, blending: THREE.AdditiveBlending});
      var mesh = new THREE.Mesh(cyl, cylmat);
console.log('my offset', collider.offset, collider);
      let offset = collider.offset.clone();//.multiply(collider.body.scale);
      cyl.applyMatrix(new THREE.Matrix4().makeTranslation(offset.x, offset.y, offset.z));
      return mesh;
    }
    this.createBoundingMesh = function(collider) {
      if (collider.mesh) {
        let userData = collider.mesh.userData;
        collider.mesh.traverse(n => n.userData = {});
        let mesh = collider.mesh.clone();
        collider.mesh.traverse(n => {
          n.userData = userData;
        });
        mesh.traverse(n => {
          if (n.material) {
            n.material = new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: .1, depthWrite: false, depthTest: false, wireframe: true, blending: THREE.AdditiveBlending});
          }
        });
        return mesh;
      }
      return new THREE.Object3D();
    }
    this.createCG = function() {
      // Create yellow checkerboard texture
      var cgmatcanvas = elation.html.create('canvas');
      var cw = 128, ch = 64;
      cgmatcanvas.width = cw;
      cgmatcanvas.height = ch;
      var ctx = cgmatcanvas.getContext('2d');
      ctx.fillStyle = 'yellow';
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, cw/2, ch/2);
      ctx.fillRect(cw/2, ch/2, cw, ch);
      var tex = new THREE.Texture(cgmatcanvas);
      tex.minFilter = tex.maxFilter = THREE.LinearFilter;
      tex.needsUpdate = true; 

      var cg = new THREE.Mesh(new THREE.SphereBufferGeometry(.05), new THREE.MeshPhongMaterial({emissive: 0x666600, map: tex, transparent: true, depthWrite: false, depthTest: false, opacity: 1}));
      return cg;
    }
    /*
    this.engine_frame = function() {
      var forward = new THREE.Vector3(0,0,-1);
      this.arrows.forward.setDirection(forward);
      this.arrows.forward_world.setDirection(this.properties.body.localToWorldDir(forward.clone()));
      this.arrows.forward_local.setDirection(this.properties.body.worldToLocalDir(forward.clone()));
    }
    */
    this.physics_collide = function(ev) {
      var collision = ev.data;
      // FIXME - this is inefficient as all hell.  We should use a particle system, or at LEAST re-use and limit the max collisions visualized at once
      this.spawn('physics_collision', this.name + '_collision_' + ev.timeStamp, {
        collision: collision,
        position: collision.point,
        pickable: false, 
        mouseevents: false, 
        persist: false, 
        physical: false
      }, true);
    }
  }, elation.engine.things.generic);

  elation.component.add("engine.things.physics_collision", function(args) {
    this.postinit = function() {
      this.defineProperties({
        collision:  {type: 'object'},
        forcescale: { type: 'float', default: .1 },
        fadetime: { type: 'float', default: 5.0 }
      });
      this.spawntime = new Date().getTime();
      this.elapsed = 0;
      elation.events.add(this.properties.collision.bodies[0], 'physics_collision_resolved', this);
      elation.events.add(this.engine, 'engine_frame', this);

      if (!elation.engine.things.physics_collision.texture) {
        elation.engine.things.physics_collision.texture = this.generateGrid(0xff0000);
      }
      this.texture = elation.engine.things.physics_collision.texture;
    }
    this.createObject3D = function() {
      this.materials = [];
      var collision = this.properties.collision;
      var planegeo = new THREE.PlaneBufferGeometry(1, 1);
      var planemat = new THREE.MeshBasicMaterial({
        map: this.texture, 
        wireframe: false, 
        transparent: true, 
        depthWrite: false, 
        depthTest: false, 
        opacity: 1,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      var plane = new THREE.Mesh(planegeo, planemat);
      var obj = new THREE.Object3D();
      obj.add(plane);
      plane.lookAt(collision.normal);
      this.materials.push(planemat);
      this.objects['3d'] = obj;

      //console.log('IMPULSES', collision, collision.impulses, collision.contactToWorld);
      var origin = new THREE.Vector3(0,0,0);

      var m = collision.contactToWorld.elements;
      //var arrowaxisx = this.generateArrow(new THREE.Vector3(m[0], m[1], m[2]), origin, 1, 0xff0000);
      //obj.add(arrowaxisx);
      var arrowaxisy = this.generateArrow(new THREE.Vector3(m[4], m[5], m[6]), origin, 1, 0x00ff00);
      obj.add(arrowaxisy);
      //var arrowaxisz = this.generateArrow(new THREE.Vector3(m[8], m[9], m[10]), origin, 1, 0x0000ff);
      //obj.add(arrowaxisz);

      this.arrows = [arrowaxisy]; //[arrowaxisx, arrowaxisy, arrowaxisz];
      return obj;
    }
    this.generateArrow = function(dir, origin, len, color) {
      var arrow = new THREE.ArrowHelper(dir, origin, len, color);
      for (var j = 0; j < arrow.children.length; j++) {
        var mat = arrow.children[j].material;
        mat.transparent = true;
        mat.depthWrite = mat.depthTest = false;
        this.materials.push(mat);
      }
      return arrow;
    }
    this.generateGrid = function(color, lines) {
      if (!color) color = 0xff0000;
      if (!lines) lines = 10;

      var canvas = elation.html.create('canvas');
      var cw = 512, ch = 512;
      var gridsize = cw / lines;

      canvas.width = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = 'rgba(255,0,0,.25)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = 'rgba(255,0,0,.5)';

      for (var y = 0; y <= lines; y++) {
        for (var x = 0; x <= lines; x++) {
          ctx.beginPath();
          ctx.moveTo(0, y * gridsize);
          ctx.lineTo(cw, y * gridsize);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(x * gridsize, 0);
          ctx.lineTo(x * gridsize, ch);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'destination-out'; 
      var grd = ctx.createRadialGradient(cw/2,ch/2,0,cw/2,ch/2,cw/2);
      grd.addColorStop(0, 'rgba(0,0,0,.5)');
      grd.addColorStop(.5, 'rgba(0,0,0,.5)');
      grd.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = grd;
      ctx.fillRect(0,0,cw,ch);

      ctx.globalCompositeOperation = 'source-over'; 
      ctx.fillStyle = '#ff0000';
      ctx.strokeStyle = '#990000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cw/2, ch/2, 8, 0, 2 * Math.PI, false);
      ctx.fill();
      ctx.stroke();

      var tex = new THREE.Texture(canvas);
      tex.minFilter = tex.maxFilter = THREE.LinearFilter;
      tex.needsUpdate = true; 
      return tex;
    }
    this.physics_collision_resolved = function(ev) {
      var collision = ev.data;
      var origin = new THREE.Vector3(0,0,0);
      for (var i = 0; i < collision.impulses.length; i++) {
        if (collision.impulses[i]) {
          var len = collision.impulses[i].length();
          if (len > 0) {
            var dir = collision.impulses[i].clone().divideScalar(len);
            var impulsearrow = this.generateArrow(dir, origin, len * this.properties.forcescale, 0x990099);
            this.arrows.push(impulsearrow);
            //obj.add(impulsearrow);
            // FIXME - need to remove object from proper parent when done fading
            collision.bodies[i].object.objects['3d'].add(impulsearrow);
          }
        }
      }
    }
    this.engine_frame = function(ev) {
      var fadetime = this.properties.fadetime;
      this.elapsed += ev.data.delta * this.engine.systems.physics.timescale;
      var opacity = (fadetime - this.elapsed) / fadetime;
      if (opacity > 0) {
        for (var i = 0; i < this.materials.length; i++) {
          this.materials[i].opacity = opacity;
        }
      } else {
        for (var i = 0; i < this.arrows.length; i++) {
          this.arrows[i].parent.remove(this.arrows[i]);
        }
        elation.events.remove(this.engine, 'engine_frame', this);
        this.die();
      }
    }
  }, elation.engine.things.generic);

  elation.component.add("engine.things.physics_forces_static", function(args) {
    this.postinit = function() {
console.log('I am a new static force');
      this.defineProperties({
        body:        {type: 'object'},
        force:       {type: 'object'},
        boundingbox: {type: 'object'},
        forcescale:  {type: 'float'}
      });
      elation.events.add(this.properties.force, 'physics_force_apply', this);
    }
    this.createObject3D = function() {
      var force = (this.force.absolute ? this.properties.body.worldToLocalDir(this.properties.force.force.clone()) : this.properties.force.force.clone());
      var len = force.length();
      force.divideScalar(len);
      this.arrow = new THREE.ArrowHelper(force, new THREE.Vector3(0,0,0), len, 0xff00ff);
      //this.arrow.children[0].material.transparent = true;
      //this.arrow.children[0].material.opacity = 0.5;
      //this.arrow.children[0].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      //this.arrow.children[1].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      var obj = new THREE.Object3D();
      obj.add(this.arrow);

console.log('here is my arrow', this.arrow, len);
      return obj;
    }
    this.physics_force_apply = function() {
      var force = (this.force.absolute ? this.properties.body.worldToLocalDir(this.properties.force.force.clone()) : this.properties.force.force.clone());
      var len = force.length();
      force.divideScalar(len);
      this.arrow.setDirection(force);
      this.arrow.setLength(len / this.properties.body.mass * this.properties.forcescale);
    }
  }, elation.engine.things.generic);
  elation.component.add("engine.things.physics_forces_gravity", function(args) {
    this.postinit = function() {
      this.defineProperties({
        body:        {type: 'object'},
        force:       {type: 'object'},
        boundingbox: {type: 'object'},
        forcescale:  {type: 'float'}
      });
      elation.events.add(this.properties.force, 'physics_force_apply', this);
    }
    this.createObject3D = function() {
      var grav = this.properties.body.worldToLocalDir(this.properties.force.gravsum.clone());
      var len = grav.length();
      grav.divideScalar(len);
      this.arrow = new THREE.ArrowHelper(grav, new THREE.Vector3(0,0,0), len, 0xff00ff);
      this.arrow.children[0].material.transparent = true;
      this.arrow.children[0].material.opacity = 0.5;
      this.arrow.children[0].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      this.arrow.children[1].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      var obj = new THREE.Object3D();
      obj.add(this.arrow);

/*
      var labeltext = elation.engine.materials.getTextureLabel('gravity');
      //var labelgeo = new THREE.PlaneGeometry(labeltext.image.width / 100, labeltext.image.height / 100);
      //var label = new THREE.Mesh(labelgeo, new THREE.MeshBasicMaterial({map: labeltext, side: THREE.DoubleSide, transparent: true, depthWrite: false, depthTest: false}));
  var mapB = THREE.ImageUtils.loadTexture( "/media/space/textures/sprite1.png" );
      var label = new THREE.Sprite(new THREE.SpriteMaterial({map: labeltext, useScreenCoordinates: false, sizeAttenuation: false, color: 0xffffff }));
      label.position.set(1.5, 1.5, 0)
      //label.scale.set(labeltext.image.width/100,labeltext.image.height/100,1);
      obj.add(label);
*/
      
      return obj;
    }
    this.physics_force_apply = function() {
      var grav = this.properties.body.worldToLocalDir(this.properties.force.gravsum.clone());
      var len = grav.length();
      grav.divideScalar(len);
      this.arrow.setDirection(grav);
      this.arrow.setLength(len / this.properties.body.mass * this.properties.forcescale);
    }
  }, elation.engine.things.generic);

  elation.component.add("engine.things.physics_forces_buoyancy", function(args) {
    this.postinit = function() {
      this.defineProperties({
        body:        {type: 'object'},
        force:       {type: 'object'},
        boundingbox: {type: 'object'},
        forcescale:  {type: 'float'}
      });
      elation.events.add(this.properties.force, 'physics_force_apply', this);
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      var bbox = this.properties.boundingbox;
      var size = [bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y, bbox.max.z - bbox.min.z];
      var offset = [(bbox.max.x + bbox.min.x) / 2, (bbox.max.y - bbox.min.y) / 2, (bbox.max.z + bbox.min.z) / 2];
      var insidegeo = new THREE.BoxBufferGeometry(size[0], size[1], size[2]);
      insidegeo.applyMatrix(new THREE.Matrix4().makeTranslation(offset[0], size[1]/2 + offset[1], offset[2]));
      var insidemat_side = new THREE.MeshPhongMaterial({emissive: 0x006666, color: 0x00ffff, opacity: 0.8, transparent: true, depthWrite: false, depthTest: false});
      var insidemat_top = new THREE.MeshPhongMaterial({emissive: 0x006666, color: 0x00ffff, opacity: 0.5, transparent: true, depthWrite: false, depthTest: false});

      this.inside = new THREE.Mesh(insidegeo, insidemat_side);
      this.inside.scale.y = this.properties.force.submerged;
      this.inside.position.y = -size[1] / 2;
      obj.add(this.inside);


      this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), this.properties.force.position, 1, 0xff00ff);
      this.arrow.children[0].material.transparent = true;
      this.arrow.children[0].material.opacity = 0.5;
      this.arrow.children[0].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      this.arrow.children[1].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      obj.add(this.arrow);


      return obj;
    }
    this.physics_force_apply = function(ev) {
      this.inside.scale.y = Math.max(0.01, this.properties.force.submerged); 
      var len = this.properties.force.force.length();
      var grav = this.properties.body.worldToLocalDir(new THREE.Vector3(0,1,0));
      if (len > .1) {
        if (!this.arrow.parent) {
          this.objects['3d'].add(this.arrow);
        }
        this.arrow.setLength(len / this.properties.body.mass * this.properties.forcescale);
        this.arrow.setDirection(grav);
      } else {
          this.objects['3d'].remove(this.arrow);
      }
    }
  }, elation.engine.things.generic);

  elation.component.add("engine.things.physics_forces_spring", function(args) {
    this.postinit = function() {
      this.defineProperties({
        body:        {type: 'object'},
        force:       {type: 'object'},
        boundingbox: {type: 'object'},
        forcescale:  {type: 'float'}
      });
      elation.events.add(this.properties.force, 'physics_force_apply', this);
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();

      this.arrow = new THREE.ArrowHelper(new THREE.Vector3(0,1,0), this.properties.force.connectionpoint, 1, 0xff00ff);
      this.arrow.children[0].material.transparent = true;
      this.arrow.children[0].material.opacity = 0.5;
      this.arrow.children[0].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      this.arrow.children[1].material.depthWrite = this.arrow.children[0].material.depthTest = false;
      obj.add(this.arrow);

      return obj;
    }
    this.physics_force_apply = function(ev) {
      var force = this.properties.force.force.clone();
      var length = force.length();
      if (length > 0) {
        if (this.arrow.parent != this.objects['3d']) {
          this.objects['3d'].add(this.arrow);
        }
        force.divideScalar(length);
        this.arrow.setLength(length * this.properties.forcescale);
        this.arrow.setDirection(force);
      } else if (this.arrow.parent == this.objects['3d']) {
        this.objects['3d'].remove(this.arrow);
      }
    }
  }, elation.engine.things.generic);
});
