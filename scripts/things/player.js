elation.require(['engine.things.generic', 'engine.things.camera', 'engine.things.label2d', 'engine.things.objecttracker'], function() {
  elation.component.add('engine.things.player', function() {
    this.targetrange = 8;
    this.postinit = function() {
      this.defineProperties({
        height: { type: 'float', default: 1.9 },
        fatness: { type: 'float', default: .25 },
        mass: { type: 'float', default: 10.0 },
        movestrength: { type: 'float', default: 200.0 },
        movespeed: { type: 'float', default: 1.8 },
        runstrength: { type: 'float', default: 250.0 },
        runspeed: { type: 'float', default: 5.4 },
        crouchspeed: { type: 'float', default: 150.0 },
        turnspeed: { type: 'float', default: Math.PI/2 },
        jumpstrength: { type: 'float', default: 300.0 },
        jumptime: { type: 'float', default: 150 },
        movefriction: { type: 'float', default: 4.0 },
        defaultplayer: { type: 'boolean', default: true },
        startposition: { type: 'vector3', default: new THREE.Vector3() },
        startorientation: { type: 'quaternion', default: new THREE.Quaternion() },
        startcameraorientation: { type: 'quaternion', default: new THREE.Quaternion() },
        walking: { type: 'boolean', default: true },
        running: { type: 'boolean', default: false },
        flying: { type: 'boolean', default: false, set: function(key, value) { this.properties.flying = value; this.toggle_flying(value); }},
        dynamicfriction:{ type: 'float', default: 2.0, comment: 'Dynamic friction inherent to this object' },
        staticfriction: { type: 'float', default: 1.9, comment: 'Static friction inherent to this object' },
      });
      this.controlstate = this.engine.systems.controls.addContext('player', {
        'move_forward': ['keyboard_w', elation.bind(this, this.updateControls)],
        'move_backward': ['keyboard_s,gamepad_any_axis_1', elation.bind(this, this.updateControls)],
        'move_left': ['keyboard_a', elation.bind(this, this.updateControls)],
        'move_right': ['keyboard_d,gamepad_any_axis_0', elation.bind(this, this.updateControls)],
        'move_up': ['keyboard_r', elation.bind(this, this.updateControls)],
        'move_down': ['keyboard_f', elation.bind(this, this.updateControls)],
        'turn_left': ['keyboard_left', elation.bind(this, this.updateControls)],
        'turn_right': ['keyboard_right,gamepad_any_axis_2', elation.bind(this, this.updateControls)],
        //'mouse_turn': ['mouse_delta_x', elation.bind(this, this.updateMouseControls)],
        //'mouse_pitch': ['mouse_delta_y', elation.bind(this, this.updateMouseControls)],
        'mouse_look': ['mouse_delta', elation.bind(this, this.updateMouseControls)],
        'look_up': ['keyboard_up', elation.bind(this, this.updateControls)],
        'look_down': ['keyboard_down,gamepad_any_axis_3', elation.bind(this, this.updateControls)],
        'run': ['keyboard_shift,gamepad_any_button_10', elation.bind(this, this.updateControls)],
        //'crouch': ['keyboard_c', elation.bind(this, this.updateControls)],
        //'jump': ['keyboard_space,gamepad_any_button_1', elation.bind(this, this.handleJump)],
        //'toss': ['keyboard_space,gamepad_any_button_0,mouse_button_0', elation.bind(this, this.toss)],
        //'toss_cube': ['keyboard_shift_space,gamepad_any_button_1', elation.bind(this, this.toss_cube)],
        //'use': ['keyboard_e,gamepad_any_button_0,mouse_button_0', elation.bind(this, this.handleUse)],
        //'toggle_flying': ['keyboard_f', elation.bind(this, this.toggle_flying)],
        'reset_position': ['keyboard_backspace', elation.bind(this, this.reset_position)],
        'pointerlock': ['mouse_0', elation.bind(this, this.updateControls)],
      });
      // Separate HMD context so it can remain active when player controls are disabled
      this.hmdstate = this.engine.systems.controls.addContext('playerhmd', {
        'hmd': ['hmd_0', elation.bind(this, this.refresh)],
        'orientation': ['orientation', elation.bind(this, this.refresh)],
      });
      this.mousedelta = [0,0];
      this.moveVector = new THREE.Vector3();
      this.turnVector = new THREE.Euler(0, 0, 0);
      this.lookVector = new THREE.Euler(0, 0, 0);
      //this.engine.systems.controls.activateContext('player');
      this.engine.systems.controls.activateContext('playerhmd');


      this.charging = false;
      this.usegravity = false;
      this.flying = true;

      this.lights = [];
      this.lightnum = 0;

      this.target = false;
      this.addTag('player');
      this.viewfrustum = new THREE.Frustum();
      this.viewmatrix = new THREE.Matrix4();

      this.gravityVector = new THREE.Vector3();

      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.engine_frame));
      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.handleTargeting));
      elation.events.add(this, 'thing_create', elation.bind(this, this.handleCreate));
      elation.events.add(document, "pointerlockchange", elation.bind(this, this.handlePointerLockChange));
    }
    this.createObjectDOM = function() {
      //this.strengthmeter = elation.ui.progressbar(null, elation.html.create({append: document.body, classname: 'player_strengthmeter'}), {orientation: 'vertical'});
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
    this.toss = function(ev) {
      if (this.holding) {
        if (ev.value == 1) {
          this.charging = new Date().getTime();
        } else if (this.charging) {
          var bounds = this.holding.getBoundingSphere();
          var campos = this.camera.localToWorld(new THREE.Vector3(0,0,-bounds.radius));
          var camdir = this.camera.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
          var velocity = 0 + this.getCharge() / 10;
          camdir.multiplyScalar(velocity);
          camdir.add(this.objects.dynamics.velocity);
    //console.log('pew!', velocity);
          //var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .125, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: true, player_id: this.properties.player_id, tags: 'local_sync' }, true);
          //var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .08, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: this.usegravity, player_id: this.properties.player_id, tags: 'local_sync' }, true);

          //foo.addTag('enemy');
          this.holding.reparent(this.engine.client.world);
          //this.holding.properties.position.copy(campos);
          this.holding.objects.dynamics.setVelocity(camdir);
          console.log('throw it!', this.holding, campos, camdir);
          this.holding = false;
          this.charging = false;
        }
      } else {
        if (ev.value == 1) {
          this.charging = new Date().getTime();
        } else if (this.charging) {
          var campos = this.camera.localToWorld(new THREE.Vector3(0,0,-1));
          var camdir = this.camera.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
          var velocity = 1 + this.getCharge() / 4;
          camdir.multiplyScalar(velocity);
          camdir.add(this.objects.dynamics.velocity);
          var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .125, mass: 1, position: campos, velocity: camdir, lifetime: 120, gravity: false, player_id: this.properties.player_id, tags: 'local_sync' }, true);
        }
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
    this.toggle_flying = function(value) {
      if (value === undefined) value = !this.flying;
      //if (ev.value == 1) {
        //this.flying = !this.flying;
        this.properties.flying = value;
        this.usegravity = !this.flying;
        if (this.gravityForce) {
          this.gravityForce.update(this.gravityVector.set(0,(this.usegravity ? -9.8 : 0), 0));
        }
      //}
    }
    this.reset_position = function(ev) {
      if (!ev || ev.value == 1) {
        this.properties.position.copy(this.properties.startposition);
        this.properties.orientation.copy(this.properties.startorientation);
        this.head.properties.orientation.copy(this.properties.startcameraorientation);
        this.properties.velocity.set(0,0,0);
        this.objects.dynamics.angular.set(0,0,0);
        this.engine.systems.controls.calibrateHMDs();
        this.refresh();
      }
    }
    this.getspin = function() {
      //return new THREE.Vector3();
      return new THREE.Vector3((Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI);
    }
    this.createObject3D = function() {
      this.objects['3d'] = new THREE.Object3D();
      this.ears = new THREE.Object3D();
      //this.camera.rotation.set(-Math.PI/16, 0, 0);

      return this.objects['3d'];
    }
    this.createChildren = function() {
      // place camera at head height
      this.headconstraint = this.head.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(1,0,0), min: -Math.PI/2, max: Math.PI/2 });
      this.reset_position();
    }
    this.createForces = function() {
      this.frictionForce = this.objects.dynamics.addForce("friction", this.properties.movefriction);
      this.gravityForce = this.objects.dynamics.addForce("gravity", this.gravityVector);
      this.moveForce = this.objects.dynamics.addForce("static", {});
      this.jumpForce = this.objects.dynamics.addForce("static", {});
      this.objects.dynamics.restitution = 0.1;
      //this.objects.dynamics.setCollider('sphere', {radius: this.properties.fatness, offset: new THREE.Vector3(0, this.fatness, 0)});
      this.objects.dynamics.addConstraint('axis', { axis: new THREE.Vector3(0,1,0) });
      // FIXME - should be in createChildren
      this.createBodyParts();
      // FIXME - the object tracker needs some work.  Some systems report tracked objects relative to the world, and some relative to the head
      //          The hardcoded offset is also specific to my own personal set-up, and helps to keep leap motion and tracked controllers in sync
      this.tracker = this.head.spawn('objecttracker', null, {player: this, position: [0, -.05, -.185]});
      this.camera = this.head.spawn('camera', this.name + '_camera', { position: [0,0,0], mass: 0.1, player_id: this.properties.player_id } );
      this.camera.objects['3d'].add(this.ears);

      //var camhelper = new THREE.CameraHelper(this.camera.camera);
      //this.engine.systems.world.scene['world-3d'].add(camhelper);
    }
    this.createBodyParts = function() {
      this.torso = this.spawn('generic', this.properties.player_id + '_torso', {
        'position': [0,1,0]
      });
      this.shoulders = this.torso.spawn('generic', this.properties.player_id + '_shoulders', {
        'position': [0,0.3,-0.2]
      });
      this.neck = this.torso.spawn('generic', this.properties.player_id + '_neck', {
        'position': [0,0.6,0]
      });
      this.head = this.neck.spawn('generic', this.properties.player_id + '_head', {
        'position': [0,0,0],
        'mass': 1
      });

      this.placeholder_body = new THREE.Mesh(new THREE.CylinderBufferGeometry(this.fatness, this.fatness, this.height), new THREE.MeshPhongMaterial({color: 0xcccccc, transparent: true, opacity: .5}));
      this.placeholder_body.position.y = this.height / 2;
      this.placeholder_body.layers.set(10);
      this.objects['3d'].add(this.placeholder_body);

      this.vrcalibrate = new THREE.Object3D();
      this.vrposetarget = new THREE.Object3D();
      let vrposedebug = new THREE.Mesh(new THREE.CylinderBufferGeometry(0, 1, 2), new THREE.MeshPhongMaterial({color: 0xffcccc, transparent: true, opacity: .5}));
      vrposedebug.position.z = -1;
      vrposedebug.rotation.x = Math.PI/2;
      this.vrcalibrate.add(this.vrposetarget);
      //this.vrposetarget.add(vrposedebug);
      vrposedebug.layers.set(10);
      this.objects['3d'].add(this.vrcalibrate);
      /*
      let renderer = this.engine.systems.render.renderer;
      if (renderer.vr && renderer.vr.setPoseTarget) {
        renderer.vr.setPoseTarget(this.vrposetarget);
      }
      */
    }
    this.getGroundHeight = function() {
      
    }
    this.enable = function() {
      var controls = this.engine.systems.controls;
      this.gravityForce.update(this.gravityVector.set(0,this.usegravity * -9.8 , 0));
      controls.activateContext('player');
      
      if (this.engine.systems.render.views.main) {
        //this.engine.systems.render.views.main.disablePicking();
      }
      controls.enablePointerLock(true);
      this.controlstate._reset();
      this.lookVector.set(0,0,0);
      this.turnVector.set(0,0,0);
      this.enableuse = false;
      this.enabled = true;
      //controls.requestPointerLock();

      // FIXME - quick hack to ensure we don't refresh before everything is initialized
      if (this.objects.dynamics) {
        this.refresh();
      }
    }
    this.disable = function() {
      var controls = this.engine.systems.controls;
      controls.deactivateContext('player');
      controls.releasePointerLock();
      if (this.engine.systems.render.views.main) {
        //this.engine.systems.render.views.main.enablePicking();
      }
      this.enableuse = false;
      if (this.objects.dynamics) {
        this.moveForce.update(this.moveVector.set(0,0,0));
        this.gravityForce.update(this.gravityVector.set(0,0,0));
        this.objects.dynamics.angular.set(0,0,0);
        this.objects.dynamics.velocity.set(0,0,0);
        this.objects.dynamics.updateState();
        this.head.objects.dynamics.velocity.set(0,0,0);
        this.head.objects.dynamics.angular.set(0,0,0);
        this.head.objects.dynamics.updateState();
      }
      this.lookVector.set(0,0,0);
      this.turnVector.set(0,0,0);
      this.hideUseDialog();
      this.controlstate._reset();
      this.enabled = false;
      this.refresh();
    }
    this.engine_frame = (function() {
      var _dir = new THREE.Euler(); // Closure scratch variable
      var _moveforce = new THREE.Vector3();
      return function(ev) {
        if (this.camera && (this.enabled || (this.hmdstate && this.hmdstate.hmd))) {
          var diff = ev.data.delta;
              fps = Math.max(1/diff, 20);
          this.moveVector.x = (this.controlstate.move_right - this.controlstate.move_left);
          this.moveVector.y = (this.controlstate.move_up - this.controlstate.move_down);
          this.moveVector.z = -(this.controlstate.move_forward - this.controlstate.move_backward);

          this.turnVector.y = (this.controlstate.turn_left - this.controlstate.turn_right) * this.properties.turnspeed;
          this.lookVector.x = (this.controlstate.look_up - this.controlstate.look_down) * this.properties.turnspeed;

          if (this.controlstate.crouch) {
            if (this.flying) {
              this.moveVector.y -= 1;
            } else {
              //this.head.properties.position.y = this.properties.height * .4 - this.properties.fatness;
            }
          } else {
            if (!this.flying) {
              //this.head.properties.position.y = this.properties.height * .8 - this.properties.fatness;
            }
          }

          if (this.moveForce) {
            var moveSpeed = Math.min(1.0, this.moveVector.length());
//if (moveSpeed !== 0) debugger;
            var dumbhack = false;
            if (this.flying || this.canJump()) {
              this.frictionForce.update(this.properties.movefriction);
              if (this.controlstate['jump']) {
                this.jumpForce.update(new THREE.Vector3(0, this.jumpstrength, 0));
                console.log('jump up!', this.jumpForce.force.toArray());
                setTimeout(elation.bind(this, function() {
                  this.jumpForce.update(new THREE.Vector3(0, 0, 0));
                }), this.jumptime);
              }
              var velsq = this.velocity.lengthSq();
              if (this.controlstate.crouch) {
                moveSpeed *= this.crouchspeed;
              } else if (this.controlstate.run) {
                moveSpeed *= this.runstrength;
              } else {
                moveSpeed *= this.movestrength;
              }
              
              if (moveSpeed == 0 && velsq > 0) {
                // The player isn't actively moving via control input, so apply opposing force to stop us
                //this.objects.dynamics.worldToLocalDir(this.moveVector.copy(this.velocity).negate());
                //moveSpeed = Math.min(this.moveVector.length(), 1) * this.movestrength;
                //this.moveVector.normalize();
                dumbhack = true;
              }
            } else {
              this.frictionForce.update(0);
              //this.moveVector.set(0,0,0);
              moveSpeed *= this.movestrength / 32;
            }
            _moveforce.copy(this.moveVector).normalize().multiplyScalar(moveSpeed);
            if (this.flying && !dumbhack) {
              if (this.vrdevice && this.vrdevice.isPresenting) {
                this.head.properties.orientation.copy(this.engine.systems.render.views.main.effects.default.camera.quaternion);
              }
              _moveforce.applyQuaternion(this.head.properties.orientation);
            }
            this.moveForce.update(_moveforce);
            this.objects.dynamics.setAngularVelocity(this.turnVector);

            this.head.objects.dynamics.setAngularVelocity(this.lookVector);
            this.head.objects.dynamics.updateState();
            //this.neck.refresh();
          }
          if (this.headconstraint) this.headconstraint.enabled = (!this.vrdevice || !this.vrdevice.isPresenting);
        }
        //this.handleTargeting();

        //this.refresh();
        //elation.events.fire({type: 'thing_change', element: this});

        // Store the player's current view frustum so we can do visibility testing in scripts
        this.camera.camera.updateProjectionMatrix(); // FIXME - this should only be needed if camera parameters change
        this.viewfrustum.setFromProjectionMatrix(this.viewmatrix.multiplyMatrices(this.camera.camera.projectionMatrix, this.camera.camera.matrixWorldInverse));

        if (ev.data.pose) {
          this.updateXR(ev.data.pose, ev.data.xrspace);
        }
        if (this.headconstraint) {
          if (this.engine.client.xrsession) {
            this.headconstraint.enabled = false;
          } else {
            this.headconstraint.enabled = true;
          }
        }
      }
    })();
    this.updateHMD = (function() {
      // closure scratch vars
      var standingMatrix = new THREE.Matrix4();

      return function(vrdevice, camera) {
        var hmd = this.hmdstate.hmd;
        if (vrdevice && vrdevice.stageParameters) {
          //this.stage.scale.set(vrdevice.stageParameters.sizeX, .1, vrdevice.stageParameters.sizeZ);
        }
        if (vrdevice && vrdevice.isPresenting) {
          var pose = false;
          if (!this.framedata) {
            this.framedata = (vrdevice.isPolyfilled ? new WebVRPolyfillFrameData() : new VRFrameData());
          }
          if (vrdevice.getFrameData && this.framedata) {
            if (vrdevice.getFrameData(this.framedata)) {
              pose = this.framedata.pose;
            }
          } else if (vrdevice.getPose) {
            pose = vrdevice.getPose();
          }
          if (pose) this.hmdstate.hmd = pose;
          this.vrdevice = vrdevice;
          if (this.headconstraint) this.headconstraint.enabled = false;

          if (pose.position && !pose.position.includes(NaN)) {
            var pos = this.neck.objects.dynamics.position;
            pos.fromArray(pose.position);
            //pos.y += this.properties.height * .8 - this.properties.fatness;
          }
          if (pose.linearVelocity && !pose.linearVelocity.includes(NaN)) {
            this.head.objects.dynamics.velocity.fromArray(pose.linearVelocity);
          } else {
            this.head.objects.dynamics.velocity.set(0,0,0);
          }
          var o = pose.orientation;
          // FIXME - why am I getting NaN / Infinity values here?  This makes no sense.
          if (o && !o.includes(NaN) && !o.includes(Infinity) && !o.includes(-Infinity)) {
            this.head.objects.dynamics.orientation.fromArray(o);
          }
          if (pose.angularVelocity) {
            //this.head.objects.dynamics.angular.fromArray(hmd.angularVelocity);
          }
          this.waspresentingvr = true;
          this.head.objects.dynamics.updateState();
          this.refresh();
        } else {
          if (this.headconstraint) this.headconstraint.enabled = true;
          if (this.waspresentingvr) {
            this.resetHead();
            this.waspresentingvr = false;
          }
        }

        var view = this.engine.systems.render.views.main;
        if (view.size[0] == 0 || view.size[1] == 0) {
          view.getsize();
        }
        //view.mousepos = [view.size[0] / 2, view.size[1] / 2, 0];
        view.pickingactive = true;

      }
    })();
    this.updateXR = function(framedata, xrspace) {
      if (framedata && framedata.getViewerPose && xrspace) {
        let pose = framedata.getViewerPose(xrspace);
        if (!pose) return;
        let p = pose.transform.position;
        var o = pose.transform.orientation;
        if (p) {
          var pos = this.neck.objects.dynamics.position;
          //pos.copy(p);
          //pos.y += this.properties.height * .8 - this.properties.fatness;
        }
        if (o) {
          //this.head.objects.dynamics.orientation.copy(o);
        }
        this.waspresentingvr = true;
        this.head.objects.dynamics.updateState();
        this.refresh();
      }
    }
    this.updateControls = function() {
    }
    this.updateMouseControls = (function() {
      var angular = new THREE.Vector3(),
          tmpquat = new THREE.Quaternion();

      return function(ev, force) {
        if (this.engine.systems.controls.pointerLockActive || force) {
          var mouselook = ev.data.mouse_look;
          var changed = false;
          if (mouselook[0]) {
            angular.set(0, -mouselook[0] * this.properties.turnspeed / 60, 0);
            var theta = angular.length();
            angular.divideScalar(theta);
            tmpquat.setFromAxisAngle(angular, theta);
            this.properties.orientation.multiply(tmpquat);
            ev.data.mouse_turn = 0;
            ev.data.mouse_look[0] = 0;
            changed = true;
          }

          if (mouselook[1]) {
            angular.set(-mouselook[1] * this.properties.turnspeed / 60, 0, 0)
            theta = angular.length();
            angular.divideScalar(theta);
            tmpquat.setFromAxisAngle(angular, theta);
            this.head.properties.orientation.multiply(tmpquat);
            this.head.refresh();
            ev.data.mouse_pitch = 0;
            ev.data.mouse_look[1] = 0;
            changed = true;
          }

          if (changed) {
            this.refresh();
          }
        }
      };
    })();
    this.handleCreate = function(ev) {
      if (this.properties.defaultplayer) {
        this.engine.client.setActiveThing(this);
        //this.enable();
        this.engine.systems.controls.enablePointerLock(true);
      }
    }
    this.handleTargeting = function() {
      if (this.enableuse) {
        var targetinfo = this.getUsableTarget('usable');
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
      if (this.holding && !(this.target && this.target.canUse(this))) {
        this.toss(ev);
      } else {
        if (ev.value == 1) {
          this.activateUseTarget();
        }
      }
    }
    this.activateUseTarget = function() {
      if (this.target && this.target.canUse(this)) {
        elation.events.fire({type: 'thing_use_activate', element: this.target, data: this});
        //this.disable(); // FIXME - temporary
      }
    }
    this.getUsableTarget = (function() {
      // closure scratch variables
      var _pos = new THREE.Vector3(),
          _dir = new THREE.Vector3(),
          _caster = new THREE.Raycaster(_pos, _dir, .01, this.targetrange);
      return function(tagname) {
        if (!this.camera) return; // FIXME - hack to make sure we don't try to execute if our camera isn't initialized
        var things = (tagname ? this.engine.getThingsByTag(tagname) : this.engine.getThingsByProperty('pickable', true));
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
      var useable = this.target.canUse(this);

      if (useable) {
        var verb = useable.verb || 'use';
        var noun = useable.noun || '';
        var content = 'Press E or click to ' + verb + '\n' + noun;

        if (!this.uselabel) {
          this.uselabel = this.head.spawn('generic', null, {
            position: [0,-.15,-.5],
            scale: [0.5,0.5,0.5]
          });
          this.toplabel = this.uselabel.spawn('label2d', null, {
            text: 'Press E or click to ' + verb,
            color: 0x00ff00,
            size: 16,
            scale: [.5,.5,.5],
          });
          this.uselabelnoun = this.uselabel.spawn('label2d', null, {
            position: [0,-0.1,0],
            color: 0x000099,
            text: noun,
            size: 64
          });
        } else {
          this.toplabel.setText('Press E or click to ' + verb);
          this.uselabelnoun.setText(noun);
          if (!this.uselabel.parent) {
            this.head.add(this.uselabel);
          }
        }

      }

/*
      // FIXME - hack for arcade games
      if (this.target && !this.target.properties.working) {
        content = 'Sorry, ' + (this.target.properties.gamename || 'this machine') + ' is temporarily out of order!';
      }
*/

    }
    this.handleJump = function(ev) {
      var keydown = ev.value;
      if (!keydown) {
        this.jumpForce.update(new THREE.Vector3(0, 0, 0));
      }
    }
    this.hideUseDialog = function() {
      if (this.uselabel && this.uselabel.parent) {
        this.uselabel.parent.remove(this.uselabel);
      }
    }
    this.pickup = function(object, force) {
      if (this.holding) {
        //this.holding.reparent(this.engine.systems.world);
        this.charging = 0.0001; // fixme - hardcoded value is silly here, this lets us just drop the item
        this.toss({value: 0});
      }
      this.holding = object;
      object.reparent(this.camera);
      object.properties.position.set(0,-.075,-.15);
      object.properties.velocity.set(0,0,0);
      object.properties.angular.set(0,0,0);
      object.properties.orientation.setFromEuler(new THREE.Euler(Math.PI/2,0,0)); // FIXME - probably not the best way to do this
    }
    this.canJump = (function() {
      // Cast a ray downwards to see if we're touching a surface and can jump
      var _pos = new THREE.Vector3(),
          _dir = new THREE.Vector3(0, -1, 0),
          _caster = new THREE.Raycaster(_pos, _dir, .01, 1 + this.fatness);
      return function(tagname) {
        if (!this.camera) return; // FIXME - hack to make sure we don't try to execute if our camera isn't initialized
        //var things = this.engine.getThingsByProperty('pickable', true);
        var objects = [this.engine.systems.world.scene['colliders']];
        if (objects.length > 0) {
          //var objects = things.map(function(t) { return t.objects['3d']; });
          // Get my position and direction in world space
          var pos = this.localToWorld(_pos.set(0,1,0));

          var intersects = _caster.intersectObjects(objects, true);
          if (intersects.length > 0) {
            for (var i = 0; i < intersects.length; i++) {
              if (intersects[i].distance <= 1 + this.fatness) {
                return intersects[i];
              }
            }
          }
        }
        return false;
      }
    })();
    this.resetHead = function() {
      this.head.objects.dynamics.position.set(0,0,0);
      this.head.objects.dynamics.velocity.set(0,0,0);
      this.head.objects.dynamics.angular.set(0,0,0);
      this.head.objects.dynamics.orientation.set(0,0,0,1);
    }
    this.handlePointerLockChange = function(ev) {
      if (document.pointerLockElement) {
        this.enable();
        if (document.pointerLockElement.tabIndex == -1) {
          document.pointerLockElement.setAttribute( 'tabindex', 0 );
        }
        document.pointerLockElement.focus();
      } else {
        this.disable();
      }
    }
    this.calibrateVR = function() {
      //this.vrcalibrate.position.copy(this.vrposetarget.position).multiplyScalar(-1);
      //this.vrcalibrate.quaternion.copy(this.vrposetarget.quaternion).conjugate();
      this.vrcalibrate.matrix.getInverse(this.vrposetarget.matrix);
      this.vrcalibrate.matrix.decompose(this.vrcalibrate.position, this.vrcalibrate.rotation, this.vrcalibrate.scale);
    }
    this.getViewFrustum = (function() {
      let frustum = new THREE.Frustum(),
          mat4 = new THREE.Matrix4();
      return function() {
        //let camera = this.camera.camera;
        //let camera = this.engine.systems.render.views.main.actualcamera;
        let camera = this.engine.systems.render.views.main.effects.default.camera; // FIXME - come on, really?
        frustum.setFromProjectionMatrix( mat4.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );
        return frustum;
      }
    })();
  }, elation.engine.things.generic);
});
