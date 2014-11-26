elation.require(['ui.progressbar', 'engine.things.ball'], function() {
  elation.component.add('engine.things.player', function() {
    this.postinit = function() {
      this.controlstate = this.engine.systems.controls.addContext('player', {
        'move_forward': ['keyboard_w', elation.bind(this, this.updateControls)],
        'move_backward': ['keyboard_s,gamepad_0_axis_1', elation.bind(this, this.updateControls)],
        'move_left': ['keyboard_a', elation.bind(this, this.updateControls)],
        'move_right': ['keyboard_d,gamepad_0_axis_0', elation.bind(this, this.updateControls)],
        'turn_left': ['keyboard_left', elation.bind(this, this.updateControls)],
        'turn_right': ['keyboard_right,gamepad_0_axis_2', elation.bind(this, this.updateControls)],
        'look_up': ['keyboard_up', elation.bind(this, this.updateControls)],
        'look_down': ['keyboard_down,gamepad_0_axis_3', elation.bind(this, this.updateControls)],
        'run': ['keyboard_shift,gamepad_0_button_10', elation.bind(this, this.updateControls)],
        //'jump': ['keyboard_space,gamepad_0_button_1', elation.bind(this, this.updateControls)],
        'toss_ball': ['keyboard_space,gamepad_0_button_0', elation.bind(this, this.toss_ball)],
        'toss_cube': ['keyboard_shift_space,gamepad_0_button_1', elation.bind(this, this.toss_cube)],
        'toggle_gravity': ['keyboard_g', elation.bind(this, this.toggle_gravity)],
        'hmd': ['hmd_0', elation.bind(this, this.updateControls)],
      });
      this.moveVector = new THREE.Vector3();
      this.turnVector = new THREE.Euler(0, 0, 0);
      this.lookVector = new THREE.Euler(0, 0, 0);
      this.moveSpeed = 2000;
      this.runMultiplier = 2.5;
      this.turnSpeed = 2;
      this.moveFriction = 10;
      this.engine.systems.controls.activateContext('player');
      this.charging = false;
      this.usegravity = true;

      this.lights = [];
      this.lightnum = 0;

      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.updateHUD));
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
      } else {
        var cam = this.engine.systems.render.views['main'].camera;
        var campos = cam.localToWorld(new THREE.Vector3(0,0,-1));
        var camdir = cam.localToWorld(new THREE.Vector3(0,0,-2)).sub(campos).normalize();
        var velocity = 5 + this.getCharge();
        camdir.multiplyScalar(velocity);
        camdir.add(this.objects.dynamics.velocity);
  //console.log('pew!', velocity);
        var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .375, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: this.usegravity }, true);

        if (!this.lights[this.lightnum]) {
          this.lights[this.lightnum] = foo.spawn('light', null, { radius: 60, intensity: 1, color: 0xffcc00});
        } else {
          this.lights[this.lightnum].reparent(foo);
        }
        this.lightnum = (this.lightnum + 1) % 3;
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
        console.log("Gravity " + (this.usegravity ? "enabled" : "disabled"));
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
    this.createForces = function() {
      this.camera = this.spawn('camera', null, { position: [0,0,0], mass: 0.1 } );
      this.frictionForce = this.objects.dynamics.addForce("friction", this.moveFriction);
      this.moveForce = this.objects.dynamics.addForce("static", {});
      this.objects.dynamics.setCollider('sphere', {radius: .5});
    }
    this.getGroundHeight = function() {
      
    }
    this.refresh = function() {
      if (this.moveForce) {
        var moveSpeed = Math.min(1.0, this.moveVector.length()) * this.moveSpeed * (this.controlstate.run ? this.runMultiplier : 1);
        this.moveForce.update(this.moveVector.clone().normalize().multiplyScalar(moveSpeed));
        this.objects.dynamics.setAngularVelocity(this.turnVector);

        if (this.controlstate.hmd) {
//console.log('hmd data!', this.controlstate.hmd);
          var scale = 1/.3048;
          this.camera.objects.dynamics.position.copy(this.controlstate.hmd.position).multiplyScalar(scale);
          this.camera.objects.dynamics.velocity.copy(this.controlstate.hmd.linearVelocity).multiplyScalar(scale);
          //this.camera.objects.dynamics.orientation.copy(this.controlstate.hmd.orientation);

          var o = this.controlstate.hmd.orientation;
          this.camera.objects.dynamics.orientation.set(o.x, o.y, o.z, o.w);
          this.camera.objects.dynamics.angular.copy(this.controlstate.hmd.angularVelocity);

          this.camera.objects.dynamics.updateState();
        } else {
          this.camera.objects.dynamics.setAngularVelocity(this.lookVector);
          this.camera.objects.dynamics.updateState();
        }
        this.camera.refresh();
      }
      elation.events.fire({type: 'thing_change', element: this});
    }
    this.updateControls = function() {
      this.moveVector.x = (this.controlstate.move_right - this.controlstate.move_left);
      this.moveVector.z = -(this.controlstate.move_forward - this.controlstate.move_backward);

      this.turnVector.y = (this.controlstate.turn_left - this.controlstate.turn_right) * this.turnSpeed;

      this.lookVector.x = (this.controlstate.look_up - this.controlstate.look_down) * this.turnSpeed;

      if (this.controlstate.jump) this.objects.dynamics.velocity.y = 5;

      this.refresh();
    }
  }, elation.engine.things.generic);
});
