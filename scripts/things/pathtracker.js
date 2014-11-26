elation.require(['engine.things.controller'], function() {
  elation.component.add('engine.things.pathtracker', function() {
    this.postinit = function() {
      this.defineProperties({
        'path': { type: 'object' },
        'target': { type: 'object' },
        'tracktime': { type: 'float', default: 5.0 },
        'autostart': { type: 'bool', default: false },
        'repeat': { type: 'bool', default: false },
      });
      this.addPart("tracker", elation.engine.parts.ai.pathtracker({thing: this, path: this.properties.path}));

      // TODO - better syntax?
      //this.tracker = this.addPart('ai.pathtracker', { path: this.properties.path });

      this.parts.tracker.setPath(this.properties.path, this.properties.tracktime);
      if (this.properties.autostart) {
        this.start();
      }
    }
    this.createObject3D = function() {
      return new THREE.Object3D();
    }
    this.start = function() {
      this.parts.tracker.start();
    }
    this.setPathPoint = function(t) {
      this.parts.tracker.setPathPoint(t);
    }
  }, elation.engine.things.aicontroller);
  elation.component.add('engine.parts.ai.pathtracker', function() {
    this.init = function() {
      //this.initParentClass(elation.engine.parts.ai.pathtracker);
      elation.engine.parts.ai.pathtracker.extendclass.init.call(this);

      this.path = false;
      this.currtime = 0;
      this.tracktime = 5.0;

      this.addBehavior('idle', this.behavior_idle, Infinity);
      this.addBehavior('track', this.behavior_track, 0);

      this.setBehavior('idle');
    }
    this.setPath = function(path, tracktime) {
      this.path = path;
      this.tracktime = tracktime;
    }
    this.setPathPoint = function(t) {
      var pathpoint = this.path.getPoint(t);
      this.thing.properties.position.copy(pathpoint);
    }
    this.start = function() {
  console.log('starting to track path', this.path, this.tracktime);
      this.currtime = 0;
      this.starttime = new Date().getTime();
      this.setPathPoint(0);
      this.setBehavior('track');
    }
    this.behavior_idle = function() {
    }
    this.behavior_track = function() {
      var now = new Date().getTime();
      var delta = now - this.starttime;
      var easeFunc = TWEEN.Easing.Cubic.InOut;

      var t = easeFunc(Math.min(delta / (this.tracktime * 1000), 1.0));
      var t2 = easeFunc(Math.min((1000 + delta) / (this.tracktime * 1000), 1.0));
      var thispoint = this.path.getPoint(t);
      var nextpoint = this.path.getPoint(t2);
      var vel = nextpoint.sub(thispoint);
      this.thing.properties.position.copy(thispoint);
      //this.thing.objects.dynamics.setVelocity(vel);

      if (this.thing.properties.target) {
        //this.thing.lookAt(this.thing.properties.target);
        var targetdir = this.thing.properties.target.clone().sub(thispoint).normalize();
        //var forward = this.thing.localToWorld(new THREE.Vector3(0,0,-1)).sub(this.thing.localToWorld(new THREE.Vector3(0,0,0)));

        var up = new THREE.Vector3(0,0,-1);
        var angle = -Math.acos(targetdir.dot(up));
        var axis = targetdir.cross(up);
        axis.normalize();
        
        var q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        q.normalize();
        //console.log(q);
        //this.thing.properties.orientation.multiply(q);
/*
        q.multiply(this.thing.properties.orientation);
*/
/*
        var forward = new THREE.Vector3(0,1,0);
        var q = new THREE.Quaternion();
        var axis = new THREE.Vector3().crossVectors(forward, targetdir);
        q.x = axis.x;
        q.y = axis.y;
        q.z = axis.z;
        q.w = Math.sqrt(2 + forward.dot(targetdir));
        q.normalize();
*/
        this.thing.properties.orientation.copy(q);
        //console.log(targetdir, this.thing.properties.orientation); 
      }

      //console.log('tracking: ', this.thing, delta, t, this.thing.properties.position, vel);
      this.thing.refresh();
      if (t == 1) {
        this.setBehavior('idle');
      }
    }
  }, elation.engine.parts.statemachine);
});
