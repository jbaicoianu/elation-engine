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
      this.palmPosition = new THREE.Vector3();
      this.palmOrientation = new THREE.Quaternion();
      this.fingerTips = [
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3(),
        new THREE.Vector3()
      ];
    }
    this.createObject3D = function() {
      var hand = new THREE.Object3D();
      return hand;
    }
    this.createChildren = function() {
      //var palmsize = [.07,.01,.05];
      var palmsize = [1,.01,1];
      this.materials = {
        bones: new THREE.MeshPhongMaterial({color: 0xffffff, transparent: false, opacity: 1, blending: THREE.NormalBlending, side: THREE.DoubleSide, envMap: this.engine.systems.render.bckground}),
        joints: new THREE.MeshPhongMaterial({color: 0xccffcc, transparent: false, opacity: 1, blending: THREE.NormalBlending}),
        tips: new THREE.MeshPhongMaterial({color: 0xffcccc, transparent: false, opacity: 1, blending: THREE.NormalBlending})
      };
      this.palm = new THREE.Mesh(new THREE.BoxGeometry(palmsize[0], palmsize[1], palmsize[2]), this.materials.bones);
      this.palm.geometry.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0, 0, -palmsize[2] / 4)));
      this.palm.scale.set(.01,.01,.01);
      this.palm.updateMatrix();
      this.palm.matrixAutoUpdate = false;
      this.objects['3d'].add(this.palm);

      this.arm = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.5, 1, undefined, undefined, true), this.materials.bones);
      //this.arm.geometry.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3(0, 0, -palmsize[2] / 4)));
      this.arm.geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
      this.arm.scale.set(.01,.01,.01);
      this.arm.updateMatrix();
      this.arm.matrixAutoUpdate = false;
      this.objects['3d'].add(this.arm);

      this.wrist = new THREE.Mesh(new THREE.SphereGeometry(0.5), this.materials.joints);
      this.wrist.scale.set(.01,.01,.01);
      this.wrist.updateMatrix();
      //this.wrist.matrixAutoUpdate = false;
      this.objects['3d'].add(this.wrist);

      this.fingers = [];
      for (var i = 0; i < 5; i++) {
        this.fingers[i] = this.spawn('leapmotion_finger', this.name + '_finger_' + i, { hand: this });
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
          if (data.fingers[i].tipPosition) {
            this.fingerTips[i].fromArray(data.fingers[i].tipPosition).multiplyScalar(scalefactor);
          }
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

        this.palmPosition.setFromMatrixPosition(this.palm.matrixWorld);
        this.palmOrientation.setFromRotationMatrix(this.palm.matrixWorld);

        if (data.arm) {
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

          this.wrist.position.fromArray(data.arm.nextJoint).multiplyScalar(scalefactor);
          this.wrist.rotation.setFromRotationMatrix(this.arm.matrix);
          this.wrist.scale.set(scale[0], scale[1], scale[1]/4);
        }

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
          var center = pos.fromArray(values.slice(offset + 12, offset + 15)).toArray();
          var bone = {
            basis: [
              // Change order to match native: Y, Z, X
              values.slice(offset + 4, offset + 7),
              values.slice(offset + 8, offset + 11),
              values.slice(offset, offset + 3),
/*
              values.slice(offset, offset + 3),
              values.slice(offset + 4, offset + 7),
              values.slice(offset + 8, offset + 11),
*/
            ],
            centerpos: center,
            length: .0200,
          };
          (function(c) {
            bone.center = function() { return c; };
          })(center);
          data.fingers[i].bones[j] = bone;
        }
        for (j = 0; j < 4; j++) {
          var bone = data.fingers[i].bones[j];
          var nextbone = data.fingers[i].bones[j + 1];
          if (nextbone) {
            bone.length = pos.fromArray(bone.centerpos).distanceTo(new THREE.Vector3().fromArray(nextbone.centerpos));
          }
          var basepos = pos.fromArray(bone.centerpos).add(new THREE.Vector3().fromArray(bone.basis[2]).normalize().multiplyScalar(-bone.length/2));
          data.fingers[i].positions[j+1] = basepos.toArray();
        };
      }
      this.updateData(data, 1);
    }
    this.serializeMatrix = (function() {
      var xdir = new THREE.Vector3(),
          ydir = new THREE.Vector3(),
          zdir = new THREE.Vector3(),
          pos = new THREE.Vector3(),
          pos2 = new THREE.Vector3();
      var mat4 = new THREE.Matrix4();
      var inverse = new THREE.Matrix4();

      return function(matrix, transform) {
        // Change order to match native: Y, Z, X
        mat4.copy(matrix);
        if (false && transform) {
          inverse.getInverse(transform);
          mat4.multiplyMatrices(inverse, matrix);
        }
/*
        var m = [];
        for (var i = 0; i < 16; i++) {
          m[i] = mat4.elements[i].toFixed(4);
        }
        var r = [
          m[4], m[5], m[6], m[3],
          m[0], m[1], m[2], m[11],
          m[8], m[9], m[10], m[7],
          m[12], m[13], m[14], m[15],
        ];
*/
        pos.setFromMatrixPosition(mat4);
        if (transform) {
          //transform.worldToLocal(pos);
        }
        mat4.extractBasis(xdir, ydir, zdir);
        xdir.normalize();
        ydir.normalize();
        zdir.normalize();

        //inverse.makeBasis(xdir, ydir, zdir);
        //inverse.makeBasis(xdir, zdir, ydir);
        //inverse.makeBasis(ydir, xdir, zdir);
        //inverse.makeBasis(ydir, zdir, xdir);
        //inverse.makeBasis(zdir, xdir, ydir);
        //inverse.makeBasis(zdir, ydir, xdir);
        //inverse.setPosition(pos);
//console.log(xdir, ydir, zdir);
/*
        inverse.set(
          xdir.x, ydir.x, zdir.x, pos.x,
          xdir.y, ydir.y, zdir.y, pos.y,
          xdir.z, ydir.z, zdir.z, pos.z,
          0, 0, 0, 1
        );
*/
        inverse.set(
          xdir.x, xdir.y, xdir.z, 0,
          ydir.x, ydir.y, ydir.z, 0,
          zdir.x, zdir.y, zdir.x, 0,
          pos.x, pos.y, pos.z, 1
        );


        return inverse.toArray().join(' ');
      };
    })();
    this.getState = function(transform) {
      var state = '';
      state += this.serializeMatrix(this.palm.matrixWorld, transform);

      for (var i = 0; i < 5; i++) {
        for (var j = 0; j < 4; j++) {
          state += ' ' + this.serializeMatrix(this.fingers[i].phalanges[j].matrixWorld, transform);
        }
      }
      return state;
    }
  }, elation.engine.things.generic);
  elation.component.add('engine.things.leapmotion_finger', function() {
    this.postinit = function() {
      this.defineProperties({
        hand: { type: 'object' }
      });
    }
    this.createObject3D = function() {
      var obj = new THREE.Object3D();
      this.phalanges = [];
      this.joints = [];
      var material = this.hand.materials.bones;
      var jointmaterial = this.hand.materials.joints;
      var tipmaterial = this.hand.materials.tips;
      var fingersizes = [0.011, 0.011, 0.00985, 0.00806, 0.00481, 0.00388];
      var fingerSize = function(i) {
        //return Math.pow(.075 / (i + 3), 1.1);
        return fingersizes[i];
      }
      for (var i = 0; i < 4; i++) {
        this.phalanges[i] = new THREE.Mesh(new THREE.CylinderGeometry(fingerSize(i), fingerSize(i+1), 1, 6, 2, true), material);
        this.joints[i] = new THREE.Mesh(new THREE.SphereGeometry(fingerSize(i+1)), jointmaterial);
        this.phalanges[i].geometry.applyMatrix(new THREE.Matrix4().makeRotationX(Math.PI/2));
        this.phalanges[i].scale.z = .01;
        this.phalanges[i].updateMatrix();
        this.phalanges[i].matrixAutoUpdate = false;
        obj.add(this.phalanges[i]);
        if (i > 0) {
          obj.add(this.joints[i]);
        }
      }
      this.joints[4] = new THREE.Mesh(new THREE.SphereGeometry(fingerSize(5)), tipmaterial);
      this.fingertip = this.joints[4];
      obj.add(this.joints[4]);
      return obj;
    }
    this.updateData = function(data, scalefactor) {
      for (var i = 0; i < data.bones.length; i++) {
        var bone = data.bones[i];
        var center = bone.center();
        var length = Math.abs(bone.length * scalefactor);

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
