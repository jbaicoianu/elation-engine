elation.require(['engine.things.generic', 'engine.things.camera', 'ui.progressbar', 'engine.things.ball'], function() {
  elation.component.add('engine.things.player', function() {
    this.targetrange = 1.8;
    this.postinit = function() {
      this.defineProperties({
        height: { type: 'float', default: 2.0 },
        startposition: { type: 'vector3', default: new THREE.Vector3() }
      });
      this.controlstate = this.engine.systems.controls.addContext('player', {
        'move_forward': ['keyboard_w', elation.bind(this, this.updateControls)],
        'move_backward': ['keyboard_s,gamepad_0_axis_1', elation.bind(this, this.updateControls)],
        'move_left': ['keyboard_a', elation.bind(this, this.updateControls)],
        'move_right': ['keyboard_d,gamepad_0_axis_0', elation.bind(this, this.updateControls)],
        'turn_left': ['keyboard_left', elation.bind(this, this.updateControls)],
        'turn_right': ['keyboard_right,mouse_delta_x,gamepad_0_axis_2', elation.bind(this, this.updateControls)],
        'look_up': ['keyboard_up', elation.bind(this, this.updateControls)],
        'look_down': ['keyboard_down,mouse_delta_y,gamepad_0_axis_3', elation.bind(this, this.updateControls)],
        'run': ['keyboard_shift,gamepad_0_button_10', elation.bind(this, this.updateControls)],
        'crouch': ['keyboard_c', elation.bind(this, this.updateControls)],
        //'jump': ['keyboard_space,gamepad_0_button_1', elation.bind(this, this.updateControls)],
        'toss_ball': ['keyboard_space,gamepad_0_button_0,mouse_button_0', elation.bind(this, this.toss_ball)],
        //'toss_cube': ['keyboard_shift_space,gamepad_0_button_1', elation.bind(this, this.toss_cube)],
        'use': ['keyboard_e,gamepad_0_button_0,mouse_button_0', elation.bind(this, this.handleUse)],
        'toggle_gravity': ['keyboard_g', elation.bind(this, this.toggle_gravity)],
        'reset_position': ['keyboard_r', elation.bind(this, this.reset_position)],
        'pointerlock': ['mouse_0', elation.bind(this, this.updateControls)],
      });
      // Separate HMD context so it can remain active when player controls are disabled
      this.hmdstate = this.engine.systems.controls.addContext('playerhmd', {
        'hmd': ['hmd_0', elation.bind(this, this.refresh)],
        //'orientation': ['orientation', elation.bind(this, this.refresh)],
      });
      this.moveVector = new THREE.Vector3();
      this.turnVector = new THREE.Euler(0, 0, 0);
      this.lookVector = new THREE.Euler(0, 0, 0);
      this.moveSpeed = 300;
      this.runMultiplier = 2.5;
      this.turnSpeed = 2;
      this.moveFriction = 4;
      //this.engine.systems.controls.activateContext('player');
      this.engine.systems.controls.activateContext('playerhmd');
      this.charging = false;
      this.usegravity = false;

      this.lights = [];
      this.lightnum = 0;

      this.target = false;

      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.updateHUD));
      elation.events.add(this.objects.dynamics, 'physics_update', elation.bind(this, this.handleTargeting));
    }
    this.createObjectDOM = function() {
      this.strengthmeter = elation.ui.progressbar(null, elation.html.create({append: document.body, classname: 'player_strengthmeter'}), {orientation: 'vertical'});
    }
    this.getCharge = function() {
      return Math.max(0, Math.min(100, Math.pow((new Date().getTime() - this.charging) / 1000 * 5, 2)));
    }
    this.updateHUD = function(ev) {
      if (this.charging !== false) {
        var charge = this.getCharge();
        this.strengthmeter.set(charge);
      } else if (this.strengthmeter.value != 0) {
        this.strengthmeter.set(0);
      }
    }
    this.toss_ball = function(ev) {
      if (ev.value == 1) {
        this.charging = new Date().getTime();
      } else if (this.charging) {
        var cam = this.engine.systems.render.views['main'].camera;
        var campos = cam.localToWorld(new THREE.Vector3(0,0,-1));
        var camdir = cam.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
        var velocity = 5 + this.getCharge();
        camdir.multiplyScalar(velocity);
        camdir.add(this.objects.dynamics.velocity);
  //console.log('pew!', velocity);
        var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .375, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: this.usegravity, player_id: this.properties.player_id, tags: 'local_sync' }, true);

/*
        if (!this.lights[this.lightnum]) {
          this.lights[this.lightnum] = foo.spawn('light', null, { radius: 60, intensity: 1, color: 0xffffff});
        } else {
          this.lights[this.lightnum].reparent(foo);
        }
        this.lightnum = (this.lightnum + 1) % 3;
*/
        foo.addTag('enemy');
        this.charging = false;
      }
    }
    this.toss_cube = function(ev) {
      if (ev.value == 1) {
        this.charging = new Date().getTime();
      } else {
        var cam = this.engine.systems.render.views['main'].camera;
        var campos = cam.localToWorld(new THREE.Vector3(0,0,-2));
        var camdir = cam.localToWorld(new THREE.Vector3(0,0,-3)).sub(campos).normalize();
        var velocity = 5 + this.getCharge();
        camdir.multiplyScalar(velocity);
        camdir.add(this.objects.dynamics.velocity);
  //console.log('pew!', velocity);
        var foo = this.spawn('crate', 'crate_' + Math.round(Math.random() * 100000), { mass: 1, position: campos, velocity: camdir, angular: this.getspin(), lifetime: 30, gravity: this.usegravity }, true);
        this.charging = false;
      }
    }
    this.toggle_gravity = function(ev) {
      if (ev.value == 1) {
        this.usegravity = !this.usegravity;
        var mult = 1; // FIXME - I'd expect to use mass here, but thatgives too much force, so I'm hacking it
        this.gravityForce.update(new THREE.Vector3(0,this.usegravity * -9.8 * mult, 0));
        console.log("Gravity " + (this.usegravity ? "enabled" : "disabled"));
      }
    }
    this.reset_position = function(ev) {
      if (!ev || ev.value == 1) {
        this.properties.position.copy(this.properties.startposition);
        this.properties.velocity.set(0,0,0);
        this.objects.dynamics.angular.set(0,0,0);
        this.engine.systems.controls.calibrateHMDs();
      }
    }
    this.getspin = function() {
      //return new THREE.Vector3();
      return new THREE.Vector3((Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI);
    }
    this.createObject3D = function() {
      this.objects['3d'] = new THREE.Object3D();
      //this.camera.rotation.set(-Math.PI/16, 0, 0);

      //var camhelper = new THREE.CameraHelper(this.camera);
      //this.camera.add(camhelper);
      return this.objects['3d'];
    }
    this.createChildren = function() {
    }
    this.createForces = function() {
      this.frictionForce = this.objects.dynamics.addForce("friction", this.moveFriction);
      this.gravityForce = this.objects.dynamics.addForce("gravity", new THREE.Vector3(0,0,0));
      this.moveForce = this.objects.dynamics.addForce("static", {});
      this.objects.dynamics.restitution = 0.1;
      this.objects.dynamics.setCollider('sphere', {radius: .5});
      this.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(0,1,0) });

      // place camera at head height
      this.camera = this.spawn('camera', this.name + '_camera', { position: [0,this.properties.height * .8,0], mass: 0.1, player_id: this.properties.player_id } );
      this.camera.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(1,0,0), min: -Math.PI/2, max: Math.PI/2 });
    }
    this.getGroundHeight = function() {
      
    }
    this.enable = function() {
      this.gravityForce.update(new THREE.Vector3(0,this.usegravity * -9.8));
      this.engine.systems.controls.activateContext('player');
      this.engine.systems.controls.enablePointerLock(true);
      if (this.engine.systems.render.views.main) {
        this.engine.systems.render.views.main.picking = false;
      }
      this.enableuse = true;
    }
    this.disable = function() {
      this.engine.systems.controls.deactivateContext('player');
      this.engine.systems.controls.enablePointerLock(false);
      if (this.engine.systems.render.views.main) {
        this.engine.systems.render.views.main.picking = true;
      }
      this.enableuse = false;
      if (this.objects.dynamics) {
        this.moveForce.update(this.moveVector.set(0,0,0));
        this.gravityForce.update(new THREE.Vector3(0,0,0));
        this.objects.dynamics.angular.set(0,0,0);
        this.objects.dynamics.velocity.set(0,0,0);
        this.objects.dynamics.updateState();
        this.camera.objects.dynamics.velocity.set(0,0,0);
        this.camera.objects.dynamics.angular.set(0,0,0);
        this.camera.objects.dynamics.updateState();
      }
      this.hideUseDialog();
    }
    this.refresh = (function() {
      var _dir = new THREE.Euler(); // Closure scratch variable
      return function() {
        if (this.camera) {
          this.moveVector.x = (this.controlstate.move_right - this.controlstate.move_left);
          this.moveVector.z = -(this.controlstate.move_forward - this.controlstate.move_backward);

          this.turnVector.y = (this.controlstate.turn_left - this.controlstate.turn_right) * this.turnSpeed;

          this.lookVector.x = (this.controlstate.look_up - this.controlstate.look_down) * this.turnSpeed;

          if (this.controlstate.jump) this.objects.dynamics.velocity.y = 5;
          if (this.controlstate.crouch) {
            this.camera.properties.position.y = this.properties.height * .4;
          } else {
            this.camera.properties.position.y = this.properties.height * .8;
          }

          if (this.moveForce) {
            var moveSpeed = Math.min(1.0, this.moveVector.length()) * this.moveSpeed * (this.controlstate.run ? this.runMultiplier : 1) * (this.controlstate.crouch ? .5 : 1);
            this.moveForce.update(this.moveVector.clone().normalize().multiplyScalar(moveSpeed));
            this.objects.dynamics.setAngularVelocity(this.turnVector);

            if (this.hmdstate.hmd && this.hmdstate.hmd.timeStamp !== 0) {
              var scale = 1/.3048;
              if (this.hmdstate.hmd.position) {
                this.camera.objects.dynamics.position.copy(this.hmdstate.hmd.position).multiplyScalar(scale);
                this.camera.objects.dynamics.position.y += this.properties.height * .8;
              }
              if (this.hmdstate.hmd.linearVelocity) {
                this.camera.objects.dynamics.velocity.copy(this.hmdstate.hmd.linearVelocity).multiplyScalar(scale);
              }

              var o = this.hmdstate.hmd.orientation;
              if (o) {
                this.camera.objects.dynamics.orientation.set(o.x, o.y, o.z, o.w);
              }
              if (this.hmdstate.hmd.angularVelocity) {
                this.camera.objects.dynamics.angular.copy(this.hmdstate.hmd.angularVelocity);
              }

              this.camera.objects.dynamics.updateState();
            } else if (this.hmdstate.orientation) {
              //this.camera.objects.dynamics.orientation.setFromEuler(new THREE.Euler(this.hmdstate.orientation.beta, this.hmdstate.orientation.gamma, this.hmdstate.orientation.alpha, 'ZYX'));
            }

            if (true) {
/*
              _dir.setFromQuaternion(this.camera.properties.orientation);
              // Constrain camera angle to +/- 90 degrees
              // Only zero-out look velocity if it's the same sign as our rotation
              if (Math.abs(_dir.x) > Math.PI/2 && _dir.x * this.lookVector.x > 0) {
                this.lookVector.x = 0;
              }
*/
//console.log(this.lookVector.toArray());
              this.camera.objects.dynamics.setAngularVelocity(this.lookVector);
              //this.camera.objects.dynamics.processConstraints([]);
              this.camera.objects.dynamics.updateState();
            }
            this.camera.refresh();
          }

        }

        elation.events.fire({type: 'thing_change', element: this});
      }
    })();
    this.updateControls = function() {
      this.refresh();
    }
    this.handleTargeting = function() {
      if (this.enableuse) {
        var targetinfo = this.getUsableTarget();
        if (targetinfo) {
          var target = this.getThingByObject(targetinfo.object);
          if (target !== this.target) {
            this.setUseTarget(target);
          }
        } else if (this.target != false || this.distanceTo(this.target) > this.targetrange) {
          this.setUseTarget(false);
        }
      }
    }
    this.setUseTarget = function(target) {
      if (!target && this.target) {
        // deselect current target
        elation.events.fire({type: 'thing_use_blur', element: this.target, data: this});
        this.target = target;
        this.hideUseDialog();
      } else if (target && !this.target) {
        elation.events.fire({type: 'thing_use_focus', element: target, data: this});
        this.target = target;
        this.showUseDialog('play', target.properties.gamename); // FIXME - hardcoded for arcade games...
      }
    }
    this.handleUse = function(ev) {
      if (ev.value == 1) {
        this.activateUseTarget();
      }
    }
    this.activateUseTarget = function() {
      if (this.target && this.target.properties.working) {
        elation.events.fire({type: 'thing_use_activate', element: this.target, data: this});
        this.disable(); // FIXME - temporary
      }
    }
    this.getUsableTarget = (function() {
      // closure scratch variables
      var _pos = new THREE.Vector3(),
          _dir = new THREE.Vector3(),
          _caster = new THREE.Raycaster(_pos, _dir, .01, this.targetrange);
      return function() {
        if (!this.camera) return; // FIXME - hack to make sure we don't try to execute if our camera isn't initialized
        var things = this.engine.getThingsByTag('usable');
        if (things.length > 0) {
          var objects = things.map(function(t) { return t.objects['3d']; });
          // Get my position and direction in world space
          var pos = this.camera.localToWorld(_pos.set(0,0,0));
          var dir = this.camera.localToWorld(_dir.set(0,0,-1)).sub(pos).normalize(); 

          var intersects = _caster.intersectObjects(objects, true);
          if (intersects.length > 0) {
            for (var i = 0; i < intersects.length; i++) {
              if (intersects[i].object.visible)
                return intersects[i];
            }
          }
        }
        return false;
      }
    }.bind(this))();

    this.showUseDialog = function(verb, noun) {
      if (!this.usedialog) {
        this.usedialog = elation.ui.window({append: document.body, bottom: true, center: true});
      }
      if (typeof verb == 'undefined') verb = 'use';
      if (typeof noun == 'undefined') noun = '';

      this.usedialog.show();
      var content = 'Press E or click to ' + verb + ' ' + noun;

      // FIXME - hack for arcade games
      if (this.target && !this.target.properties.working) {
        content = 'Sorry, ' + (this.target.properties.gamename || 'this machine') + ' is temporarily out of order!';
      }

      this.usedialog.setcontent(content);
    }
    this.hideUseDialog = function() {
      if (this.usedialog) {
        this.usedialog.hide();
      }
    }
  }, elation.engine.things.generic);
});
