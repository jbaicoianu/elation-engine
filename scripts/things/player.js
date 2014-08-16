elation.require('ui.progressbar');

elation.component.add('engine.things.player', function() {
  this.postinit = function() {
    this.engine.systems.controls.addContext('player', {
      'toss_ball': ['keyboard_space', elation.bind(this, this.toss_ball)],
      'toss_cube': ['keyboard_shift_space', elation.bind(this, this.toss_cube)],
      'toggle_gravity': ['keyboard_g', elation.bind(this, this.toggle_gravity)]
    });
    this.engine.systems.controls.activateContext('player');
    this.charging = false;
    this.usegravity = true;

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
      var campos = cam.localToWorld(new THREE.Vector3(0,0,0));
      var camdir = cam.localToWorld(new THREE.Vector3(0,0,-1)).sub(campos).normalize();
      var velocity = 5 + this.getCharge();
      camdir.multiplyScalar(velocity);
//console.log('pew!', velocity);
      var foo = this.spawn('ball', 'ball_' + Math.round(Math.random() * 100000), { radius: .375, mass: 1, position: campos, velocity: camdir, lifetime: 30, gravity: this.usegravity }, true);
      foo.addTag('enemy');
      this.charging = false;
    }
  }
  this.toss_cube = function(ev) {
    if (ev.value == 1) {
      this.charging = new Date().getTime();
    } else {
      var cam = this.engine.systems.render.views['main'].camera;
      var campos = cam.localToWorld(new THREE.Vector3(0,0,0));
      var camdir = cam.localToWorld(new THREE.Vector3(0,0,-1)).sub(campos).normalize();
      var velocity = 5 + this.getCharge();
      camdir.multiplyScalar(velocity);
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
    return new THREE.Vector3();
    //return new THREE.Vector3((Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI, (Math.random() - .5) * 4 * Math.PI);
  }
}, elation.engine.things.generic);
