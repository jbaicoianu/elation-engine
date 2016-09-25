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
          handobj.updateData(hand, 1);
        }
      }
      
    }
  }, elation.engine.things.generic);

  elation.component.add('engine.things.leapmotion_hand', function() {
    this.postinit = function() {
      this.palmrotation = new THREE.Euler();
    }
    this.createObject3D = function() {
      var hand = new THREE.Object3D();
      return hand;
    }
    this.createChildren = function() {
      //var palmsize = [.07,.01,.05];
      var palmsize = [1,.01,1];
      this.palmmaterial = new THREE.MeshPhongMaterial({color: 0xffffff, transparent: false, opacity: 0.5, blending: THREE.NormalBlending, side: THREE.DoubleSide, envMap: this.engine.systems.render.bckground});
      this.palm = new THREE.Mesh(new THREE.BoxGeometry(palmsize[0], palmsize[1], palmsize[2]), this.palmmaterial);
      this.palm.geometry.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0, 0, -palmsize[2] / 4)));
      this.palm.scale.set(.01,.01,.01);
      this.palm.updateMatrix();
      this.palm.matrixAutoUpdate = false;
      this.objects['3d'].add(this.palm);

      this.arm = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 1), this.palmmaterial);
      //this.arm.geometry.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0, 0, -palmsize[2] / 4)));
      this.arm.geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
      this.arm.scale.set(.01,.01,.01);
      this.arm.updateMatrix();
      this.arm.matrixAutoUpdate = false;
      this.objects['3d'].add(this.arm);

      this.fingers = [];
      for (var i = 0; i < 5; i++) {
        this.fingers[i] = this.spawn('leapmotion_finger', this.name + '_finger_' + i);
      }
    }
    this.updateData = (function() {
      var pos = new THREE.Vector3(),
          xdir = new THREE.Vector3(),
          ydir = new THREE.Vector3(),
          zdir = new THREE.Vector3(),
          fingerbase1 = new THREE.Vector3(),
          fingerbase2 = new THREE.Vector3(),
          fingerbase3 = new THREE.Vector3();

      return function(data, scalefactor) {
        if (!scalefactor) scalefactor = 1;
        if (!this.palm) return;

        for (var i = 0; i < data.fingers.length; i++) {
          this.fingers[i].updateData(data.fingers[i], scalefactor);
        }

        pos.fromArray(data.palmPosition).multiplyScalar(scalefactor);
        zdir.fromArray(data.direction);
        ydir.fromArray(data.palmNormal);
        xdir.crossVectors(ydir, zdir);
        fingerbase1.setFromMatrixPosition(this.fingers[1].phalanges[0].matrixWorld);
        fingerbase2.setFromMatrixPosition(this.fingers[4].phalanges[0].matrixWorld);
        fingerbase3.setFromMatrixPosition(this.fingers[1].phalanges[1].matrixWorld);

        var scale = [
          fingerbase1.distanceTo(fingerbase2) * 1.4,
          1,
          fingerbase1.distanceTo(fingerbase3) * 1.4
        ];
        this.palm.matrix.set(
          xdir.x * scale[0], ydir.x * scale[1], zdir.x * scale[2], pos.x,
          xdir.y * scale[0], ydir.y * scale[1], zdir.y * scale[2], pos.y,
          xdir.z * scale[0], ydir.z * scale[1], zdir.z * scale[2], pos.z,
          0, 0, 0, 1
        );
        this.palm.updateMatrixWorld();

        pos.fromArray(data.arm.center()).multiplyScalar(scalefactor);
        xdir.fromArray(data.arm.basis[0]);
        ydir.fromArray(data.arm.basis[1]);
        zdir.fromArray(data.arm.basis[2]);
        scale = [
          data.arm.width * scalefactor,
          data.arm.width * scalefactor * .75,
          data.arm.length * scalefactor
        ];
        this.arm.matrix.set(
          xdir.x * scale[0], ydir.x * scale[1], zdir.x * scale[2], pos.x,
          xdir.y * scale[0], ydir.y * scale[1], zdir.y * scale[2], pos.y,
          xdir.z * scale[0], ydir.z * scale[1], zdir.z * scale[2], pos.z,
          0, 0, 0, 1
        );
        this.arm.updateMatrixWorld();

        this.refresh();
      };
    })();
    this.setState = function(state, transform) {
      var values = state.split(' ').map(parseFloat);
      //console.log(values);
      var pos = new THREE.Vector3();
      var data = {
        palmPosition: pos.fromArray([values[12], values[13], values[14]]).applyMatrix4(transform).toArray(),
        direction: [values[8], values[9], values[10]],
        palmNormal: [values[4], values[5], values[6]],
        fingers: []
      };

      for (var i = 0; i < 5; i++) {
        data.fingers[i] = {
          bones: [],
          positions: [[0,0,0]]
        };
        for (var j = 0; j < 4; j++) {
          var offset = (i * 4 + j + 1) * 16;
          var center = pos.fromArray(values.slice(offset + 12, offset + 15)).applyMatrix4(transform).toArray();
          var bone = {
            basis: [
              values.slice(offset + 4, offset + 7),
              values.slice(offset + 8, offset + 11),
              values.slice(offset, offset + 3),
            ],
            length: .0400,
            center: function() { return center; }
          };
          (function(c) {
            bone.center = function() { return c; };
          })(center);
          data.fingers[i].positions[j+1] = center;
          data.fingers[i].bones[j] = bone;
        };
      }
      this.updateData(data, 1);
    }
  }, elation.engine.things.generic);
  elation.component.add('engine.things.leapmotion_finger', function() {
    this.postinit = function() {
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      this.phalanges = [];
      this.joints = [];
      var fingerSize = function(i) {
        return Math.pow(.075 / (i + 3), 1.1);
      }
      var material = new THREE.MeshPhongMaterial({color: 0xffffff, transparent: false, opacity: 0.5, blending: THREE.NormalBlending, side: THREE.DoubleSide, envMap: this.engine.systems.render.bckground});
      var knucklematerial = new THREE.MeshPhongMaterial({color: 0xccffcc, transparent: false, opacity: 0.5, blending: THREE.NormalBlending});
      this.materials = {
        hand: material,
        knuckles: knucklematerial
      };
      for (var i = 0; i < 4; i++) {
        this.phalanges[i] = new THREE.Mesh(new THREE.CylinderGeometry(fingerSize(i), fingerSize(i+1), 1, 6, 2, false), material);
        this.joints[i] = new THREE.Mesh(new THREE.SphereGeometry(fingerSize(i+1)), knucklematerial);
        this.phalanges[i].geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
        this.phalanges[i].scale.z = .01;
        this.phalanges[i].updateMatrix();
        this.phalanges[i].matrixAutoUpdate = false;
        obj.add(this.phalanges[i]);
        obj.add(this.joints[i]);
      }
      this.joints[4] = new THREE.Mesh(new THREE.SphereGeometry(fingerSize(5)), knucklematerial);
      this.fingertip = this.joints[4];
      //obj.add(this.joints[4]);
      return obj;
    }
    this.updateData = function(data, scalefactor) {
      for (var i = 0; i < data.bones.length; i++) {
        var bone = data.bones[i];
        var center = bone.center();
        var length = bone.length * scalefactor;

        if (length > 0) {
          //this.phalanges[i].scale.z = length * scalefactor;
        } else if (this.phalanges[i].parent) {
          this.objects['3d'].remove(this.phalanges[i]);
        }
        this.phalanges[i].matrix.set(
          bone.basis[0][0], bone.basis[1][0], bone.basis[2][0] * length, center[0] * scalefactor,
          bone.basis[0][1], bone.basis[1][1], bone.basis[2][1] * length, center[1] * scalefactor,
          bone.basis[0][2], bone.basis[1][2], bone.basis[2][2] * length, center[2] * scalefactor,
          0, 0, 0, 1
        );
        this.phalanges[i].updateMatrixWorld();
      }
      this.joints[0].position.fromArray(data.positions[0]).multiplyScalar(scalefactor);
      this.joints[1].position.fromArray(data.positions[1]).multiplyScalar(scalefactor);
      this.joints[2].position.fromArray(data.positions[2]).multiplyScalar(scalefactor);
      this.joints[3].position.fromArray(data.positions[3]).multiplyScalar(scalefactor);
      this.joints[4].position.fromArray(data.positions[4]).multiplyScalar(scalefactor);

      this.refresh();
    }
  }, elation.engine.things.generic);
  
});
