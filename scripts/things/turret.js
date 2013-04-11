elation.component.add("engine.things.turret", function(args) {
  this.postinit = function() {
    //this.initControllable();

    this.defineProperties({
      'pitch':           { type: 'angle', default: 0 },
      'yaw':             { type: 'angle', default: 0 },
      'pitchspeed':      { type: 'angle', default: Math.PI / 2 },
      'yawspeed':        { type: 'angle', default: Math.PI / 2 },
      'maxpitchdegrees': { type: 'angle', default: 90 },
      'minpitchdegrees': { type: 'angle', default: -44 },
      'reloadtime':      { type: 'integer', default: 2000 },
      'muzzleoffset':    { type: 'vector3', default: [0,0,0] },
      'muzzlespeed':     { type: 'float', default: 150.0 },
      'range':           { type: 'float', default: 300.0 }
    });
    this.defineActions({
      'pitch': this.pitch,
      'yaw': this.yaw,
      'fire': this.fire,
      'aim': this.aim
    });

    this.pitchvel = new THREE.Vector3();
    this.yawvel = new THREE.Vector3();

    elation.events.add(this, 'thing_load', this);
  }
  this.pitch = function(amount) {
    this.pitchvel.set(amount * this.properties.pitchspeed,0,0);
    this.hinges['gun'].updateState();
  }
  this.yaw = function(amount) {
    this.yawvel.set(0, 0, amount * this.properties.pitchspeed);
    this.hinges['mount'].updateState();
  }
  this.fire = function(amount) {
    console.log('bang!');
    //this.spawn('turret_bullet', {}, false);
  }
  this.aim = function() {
    if (!this.parts || !this.parts['Turret_gun']) return;
    var aimpos = this.parts['Turret_gun'].localToWorld(this.properties.muzzleoffset.clone());
    var gunpos = new THREE.Vector3().getPositionFromMatrix(this.parts['Turret_gun'].matrixWorld);
    var aimvel = this.parts['Turret_gun'].localToWorld(new THREE.Vector3(0,1,0)).sub(gunpos).normalize();
    return {position: aimpos, velocity: aimvel};
  }
  this.thing_load = function(ev) {
    this.hinges = {};
    this.hinges['gun'] = new elation.physics.rigidbody({
      position: this.parts['Turret_gun'].position,
      orientation: this.parts['Turret_gun'].quaternion,
      mass: 0,
      angular: this.pitchvel,
      object: this
    });
    elation.physics.system.add(this.hinges['gun']);

    this.hinges['mount'] = new elation.physics.rigidbody({
      position: this.parts['Turret_mount'].position,
      orientation: this.parts['Turret_mount'].quaternion,
      mass: 0,
      angular: this.yawvel,
      object: this
    });
    elation.physics.system.add(this.hinges['mount']);

    this.spawn("turretcontroller");
  }
}, elation.engine.things.generic);

/* BEGIN AI */

elation.component.add("engine.things.turretcontroller", function(args) {
  this.postinit = function() {
    this.initAIController();
    this.defineActions({
      'setTarget': this.setTarget
    });
    this.defineProperties({
      'target': { type: 'thing', comment: 'Active target' }
    });
    this.addBehavior('track_and_fire', this.track_and_fire, 100);
    this.setBehavior('track_and_fire');
    //this.engine.systems.get('world').scene['world-3d'].add(this.helpers.aim);
  }
  this.track_and_fire = function() {
    // Ideal solution:
    //  - calculate flighttime for projectile to reach target, given muzzle velocity
    //  - extrapolate target position + target velocity * flighttime
    //  - determine necessary pitch/yaw amounts

    var deadzone = Math.PI/32;

    // FIXME - target is hardcoded as camera for now; need proper target acquisition logic
    var turret = this.parent,
        target = this.engine.systems.get('render').views['main'].camera; //this.properties.target;
    if (turret && target) {
      var aim = turret.aim();
      if (!aim) return;
 
      var dist = aim.position.distanceTo(target.position);
      if (dist < turret.properties.range) {
        var targetpos = new THREE.Vector3().getPositionFromMatrix(target.matrixWorld);
        var mypos = new THREE.Vector3().getPositionFromMatrix(this.parent.objects['3d'].matrixWorld);
        var targetdir = turret.parts['Turret_mount'].worldToLocal(targetpos).normalize();
        var aimdir = turret.parts['Turret_mount'].worldToLocal(aim.velocity.clone().add(mypos)).normalize();

        var t = new THREE.Vector3(targetdir.x, 0, targetdir.y).normalize();
        var a = new THREE.Vector3(aimdir.x, 0, aimdir.y).normalize();
        var yaw = Math.atan((t.x - a.x) / (t.z - a.z));
        var yaw2 = Math.acos(t.dot(a));
        var yawspeed = yaw / (turret.properties.yawspeed * this.thinktime/1000);
        var yaw3 = yaw2 * (yaw / Math.abs(yaw)) / (turret.properties.yawspeed * this.thinktime/1000);
        //console.log('yaw is', yaw, yaw2, yaw3);
        yawspeed = yaw3;



        turret.yaw(this.deadzone(yawspeed, deadzone, 1));
        /*
        var curpitch = new THREE.Vector3().setEulerFromQuaternion(turret.parts['Turret_gun'].quaternion);
        if ((curpitch.x > turret.properties.maxpitchdegrees * Math.PI/180 && pitch > 0) ||
            (curpitch.x < turret.properties.minpitchdegrees * Math.PI/180) && pitch < 0) {
          turret.pitch(0);
        } else {
          turret.pitch(this.deadzone(pitch, deadzone, 1));
        }
        */
      } else {
        //turret.state['firing'] = false;
      }
    }
  }

  this.deadzone = function(angle, deadzone, max) {
    return (Math.abs(angle) < deadzone ? 0 : Math.max(-max, Math.min(max, angle)));
  }
  
}, elation.engine.things.aicontroller);

