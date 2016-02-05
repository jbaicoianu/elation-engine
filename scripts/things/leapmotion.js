elation.require(['engine.external.leapmotion.leap'], function() {
  elation.component.add('engine.things.leapmotion', function() {
    this.postinit = function() {
      Leap.loop(elation.bind(this, this.loop));
    }
    this.createChildren = function() {
      this.hands = {
        left: this.spawn('leapmotion_hand', 'hand_left', { position: new THREE.Vector3(-.1, 0, 0) }),
        right: this.spawn('leapmotion_hand', 'hand_right', { position: new THREE.Vector3(.1, 0, 0) })
      };
    }
    this.loop = function(frame) {
      for (var i = 0; i < frame.hands.length; i++) {
        var hand = frame.hands[i];
        var handobj = this.hands[hand.type];
        if (handobj) {
          handobj.updateData(hand);
        }
      }
      
    }
  }, elation.engine.things.generic);

  elation.component.add('engine.things.leapmotion_hand', function() {
    this.postinit = function() {
      this.palmrotation = new THREE.Euler();
    }
    this.createObject3D = function() {
      this.palm = new THREE.Mesh(new THREE.BoxGeometry(.09, .02, .1), new THREE.MeshNormalMaterial({transparent: true, opacity: 0.5}));
      this.palm.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(-.045, 0, .05)));
      var hand = new THREE.Object3D();
      hand.add(this.palm);
      return hand;
    }
    this.createChildren = function() {
      this.fingers = [];
      for (var i = 0; i < 5; i++) {
        this.fingers[i] = this.spawn('leapmotion_finger', this.name + '_finger_' + i);
        this.fingers[i].properties.position.x = .025 * i;
        this.fingers[i].properties.position.z = -.1;
      }
    }
    this.updateData = function(data) {
      this.palm.position.set(data.stabilizedPalmPosition[0] / 1000, data.stabilizedPalmPosition[1] / 1000, data.stabilizedPalmPosition[2] / 1000);

console.log(data);
      this.palm.rotation.set( data.pitch(), -data.yaw(), data.roll());
      //this.properties.orientation.setFromEuler(this.palmrotation);

//console.log(data);
      for (var i = 0; i < data.fingers.length; i++) {
        this.fingers[i].updateData(data.fingers[i]);
      }
      this.refresh();
    }
  }, elation.engine.things.generic);
  elation.component.add('engine.things.leapmotion_finger', function() {
    this.postinit = function() {
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      this.phalanges = [];
      for (var i = 0; i < 4; i++) {
        this.phalanges[i] = new THREE.Mesh(new THREE.BoxGeometry(.02, .02, 1), new THREE.MeshNormalMaterial({transparent: true, opacity: 0.5}));
        //this.phalanges[i] = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .02), new THREE.MeshNormalMaterial());
        this.phalanges[i].applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0, 0, .5)));
        this.phalanges[i].applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
        this.phalanges[i].position.z = -.01 * i;
        this.phalanges[i].scale.z = .02;
        obj.add(this.phalanges[i]);
      }
      return obj;
    }
    this.updateData = function(data) {
      for (var i = 0; i < data.bones.length; i++) {
        var bone = data.bones[i];
        var center = bone.center();
        var length = bone.length;
        this.phalanges[i].position.set(center[0] / 1000, center[1] / 1000, center[2] / 1000);
        if (length > 0) {
          //this.phalanges[i].scale.z = length / 1000;
        } else if (this.phalanges[i].parent) {
          this.objects['3d'].remove(this.phalanges[i]);
        }
      }
      for (var i = 0; i < this.phalanges.length - 1; i++) {
        this.phalanges[i].lookAt(this.phalanges[i + 1].position);
        this.phalanges[i].scale.z = this.phalanges[i].position.distanceTo(this.phalanges[i+1].position);
      }
      var tmpvec = new THREE.Vector3();
/*
      this.phalanges[3].lookAt(tmpvec.set(data.tipPosition[0] / 1000, data.tipPosition[1] / 1000, data.tipPosition[2] / 1000));
      this.phalanges[2].lookAt(tmpvec.set(data.dipPosition[0] / 1000, data.dipPosition[1] / 1000, data.dipPosition[2] / 1000));
      this.phalanges[1].lookAt(tmpvec.set(data.pipPosition[0] / 1000, data.pipPosition[1] / 1000, data.pipPosition[2] / 1000));
*/
      //this.phalanges[0].lookAt(tmpvec.set(data.mcpPosition[0] / 1000, data.mcpPosition[1] / 1000, data.mcpPosition[2] / 1000));


      this.refresh();
    }
  }, elation.engine.things.generic);
  
});
