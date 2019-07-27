elation.require(['engine.things.generic', 'engine.things.leapmotion'], function() {
  elation.component.add('engine.things.objecttracker', function() {
    this.postinit = function() {
      elation.engine.things.objecttracker.extendclass.postinit.call(this);
      this.defineProperties({
        player: { type: 'object' },
        leapenabled: { type: 'boolean', default: false },
        leapmount: { type: 'string', default: 'VR' }
      });
      this.controllers = [];
      this.hands = {};
      this.leapDetected = false;
      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.updatePositions));
      elation.events.add(window, "webkitGamepadConnected,webkitgamepaddisconnected,MozGamepadConnected,MozGamepadDisconnected,gamepadconnected,gamepaddisconnected", elation.bind(this, this.updateTrackedObjects));

      this.controllerModels = {
        touch_left: 'controller_touch_left',
        touch_right: 'controller_touch_right',
        vive_left: 'controller_vive',
        vive_right: 'controller_vive',
        openvr_left: 'controller_touch_left',
        openvr_right: 'controller_touch_right',
        daydream: 'controller_daydream'
      };
      this.controllerMap = {
        'touch_left': /^Oculus Touch \(Left\)$/,
        'touch_right': /^Oculus Touch \(Right\)$/,
        'vive_left': /HTC Vive/,
        'vive_right': /HTC Vive/,
        'openvr': /OpenVR/,
        'daydream': /^Daydream Controller$/,
      };
      this.controllerIsLocal = {
        touch_left: true,
        touch_right: true
      };
    }
    this.createChildren = function() {
      this.updateTrackedObjects();
    }
    this.initLeap = function() {
      this.leapcontroller = Leap.loop({
        optimizeHMD: (this.engine.systems.controls.settings.leapmotion.mount == 'VR'),
        frameEventName: 'deviceFrame'
      }, elation.bind(this, this.handleLeapLoop));
    }
    this.updatePositions = (function() {
      // Closure scratch variables
      var sittingToStanding = new THREE.Matrix4();

      return function() {
        this.updateTrackedObjects();
        if (!this.vrdisplay) {
          return;
        }

        var player = this.engine.client.player,
            stage = this.vrdisplay.stageParameters;
        if (stage) {
          sittingToStanding.fromArray(stage.sittingToStandingTransform);
        }
        for (var i = 0; i < this.controllers.length; i++) {
          var c = this.controllers[i];
          if (c) {
            var controllerid = this.getControllerID(c.data.id, c.data.hand);
            if (!c.data.connected) {
              this.removeTrackedController(i);
            } else if (c.data.pose) {
              if (c.controllerid != controllerid) {
                this.setTrackedController(i, c.data);
              }
              //console.log('hand', c.data.pose, c.data, c.model);
              var handname = c.hand || (i ? 'left' : 'right');
              //var hand = c.model;
              var pose = c.data.pose;
              if (pose.hasOrientation && pose.orientation && !pose.orientation.includes(NaN)) {
                c.model.quaternion.fromArray(pose.orientation);
                //hand.properties.orientation.fromArray(pose.orientation);
                this.refresh();
              }
              if (pose.hasPosition && pose.position && !pose.position.includes(NaN)) {
                c.model.position.fromArray(pose.position).multiplyScalar(1);
                //player.neck.worldToLocal(player.neck.localToWorld(c.model.position));
                //hand.position.fromArray(pose.position);
                //c.model.matrix.compose(c.model.position, c.model.quaternion, c.model.scale);
                //c.model.matrix.multiplyMatrices(player.torso.objects['3d'].matrix, player.neck.objects['3d'].matrix).multiply(c.model.matrix);
                //c.model.matrix.decompose(c.model.position, c.model.quaternion, c.model.scale);
                this.refresh();
              } else {
                c.model.position.set(.2, (handname == "right" ? -.3 : .3), .2);
                //c.model.children[0].position.z = .1;
                var dyn = this.player.neck.objects.dynamics;
                player.objects.dynamics.worldToLocalPos(dyn.localToWorldPos(c.model.position).sub(player.position));
              }
            }
          }
        }
      }
    })();
    this.updateTrackedObjects = function() {
      if (!this.leapenabled && this.engine.systems.controls.settings.leapmotion.enabled) {
        this.leapenabled = true;
        this.initLeap();
      }
      if (this.leapcontroller && this.leapmount != this.engine.systems.controls.settings.leapmotion.mount) {
        this.leapmount = this.engine.systems.controls.settings.leapmotion.mount;
        this.leapcontroller.setOptimizeHMD(this.leapmount == 'VR');

        if (this.handroot) {
          var attachment = this.getHandAttachment(this.leapmount);
          if (attachment.parent != this.handroot.parent) {
            attachment.parent.add(this.handroot);
            this.handroot.properties.orientation.setFromEuler(attachment.rotation);
          }
        }
      }
      var controls = this.engine.systems.controls;
      this.vrdisplay = this.engine.systems.render.views.main.vrdisplay;
      var gamepads = controls.gamepads;
      for (var i = 0; i < gamepads.length; i++) {
        if (gamepads[i] && (!this.controllers[i] || this.controllers[i].data !== gamepads[i])) {
          this.setTrackedController(i, gamepads[i]);
        //} else if (this.controllers[i] && !gamepads[i]) {
          //this.removeTrackedController(i);
        }
      }
    }
    this.setTrackedController = function(i, controller) {
      if (this.controllers[i] && controller !== this.controllers[i].data && this.controllers[i].model) {
        this.objects['3d'].remove(this.controllers[i].model);
      }
      this.controllers[i] = {
        model: this.getControllerModel(controller),
        data: controller,
        controllerid: this.getControllerID(controller.id, controller.hand)
      };
      this.objects['3d'].add(this.controllers[i].model);
      return this.controllers[i];
    }
    this.removeTrackedController = function(i) {
      if (this.controllers[i]) {
        if (this.controllers[i].model && this.controllers[i].model.parent == this.objects['3d']) {
          this.objects['3d'].remove(this.controllers[i].model);
        }
        this.controllers[i] = null;
      }
    }
    this.getControllerModel = function(controller) {
      //(this.controllers[i] ? this.controllers[i].model : this.createPlaceholder()),
      var hand = controller.hand || false;
      if (!hand || hand == '') hand = 'right'; // FIXME - sometimes hand is just an empty string, and then it gets filled in later
      for (var k in this.controllerMap) {
        if (controller.id.match(this.controllerMap[k])) {
          var controllerid = this.getControllerID(k, hand);
          var assetid = this.controllerModels[controllerid];
          if (assetid) {
            var asset = elation.engine.assets.find('model', assetid);
            var obj = new THREE.Object3D();
            //obj.add(asset);
            //asset.position.set(0,0,-0.1);
            return obj;
          }
        }
      }
      return new THREE.Object3D();
    }
    this.getControllerID = function(name, hand) {
      return name + (hand && this.controllerModels[name + '_' + hand] ? '_' + hand : '');
    }
    this.createPlaceholder = function() {
      // TODO - For now, we make a rudimentary Vive controller model.  We should be 
      //        able to load a different model for the specific type of controller.
      var w = 0.0445 / 1,
          l = 0.1714 / 1,
          d = 0.0254 / 1,
          r = 0.0952 / 2,
          ir = 0.0254 / 2;
      var geo = new THREE.BoxGeometry(w, d, l);
      geo.applyMatrix(new THREE.Matrix4().makeTranslation(0,-d/2,l/2));
      var torus = new THREE.TorusGeometry(r, ir);
      torus.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, r/2 + ir*2));
      torus.applyMatrix(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI/4, 0, 0)));
      geo.merge(torus, new THREE.Matrix4().makeTranslation(0,0,-r));

      return new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({color: 0xffffff * Math.random()})
      );
    }
    this.hasHands = function() {
      // TODO - this should also work with leap motion
      return this.controllers.length > 0 || this.hands.left || this.hands.right;
    }
    this.getHand = function(hand) {
      if (!this.handroot) {
        var attachment = this.getHandAttachment(this.leapmount);
        this.handroot = attachment.parent.spawn('generic', null, {
          position: new THREE.Vector3(0, 0, 0),
          orientation: new THREE.Quaternion().setFromEuler(attachment.rotation)
        });
      }
      if (!this.hands[hand]) {
        this.hands[hand] = this.handroot.spawn('leapmotion_hand', 'hand_' + hand, { position: new THREE.Vector3(0, 0, 0) });
      }
      return this.hands[hand];
    }
    this.getHands = function() {
      if (this.controllers.length > 0) {
        var hands = {};
        if (this.controllers[0] && this.controllers[0].data) {
          hands.left = this.controllers[0].data.pose;
        }
        if (this.controllers[1] && this.controllers[1].data) {
          hands.right = this.controllers[1].data.pose;
        }
        return hands;
      } else if (this.hands && (this.hands.left || this.hands.right)) {
        return this.hands;
      }
      return false;
    }
    this.getHandAttachment = (function() {
      var orient_vr = new THREE.Euler(-Math.PI/2, Math.PI, 0, 'XYZ'),
          orient_desktop = new THREE.Euler(0, 0, 0, 'XYZ');
      return function(mount) {
        if (mount == 'VR') {
          return {
            parent: this.player.head,
            rotation: orient_vr,
          };
        } else if (mount == 'Desktop') {
          return {
            parent: this.player.shoulders,
            rotation: orient_desktop,
          };
        }
      };
    })()
    this.handleLeapLoop = function(frame) {
      var framehands = {};

      if (!this.leapDetected) {
        this.leapDetected = true;
        this.hands = {
          left: this.getHand('left'),
          right: this.getHand('right')
        };
      }
      for (var i = 0; i < frame.hands.length; i++) {
        framehands[frame.hands[i].type] = frame.hands[i];
      }
      for (var k in this.hands) {
        var hand = framehands[k];
        var handobj = this.getHand(k);
        if (hand && handobj) {
          if (hand.valid) {
            handobj.active = true;
            handobj.show();
            handobj.updateData(hand, 1/1000);
          } else {
            handobj.active = false;
            handobj.hide();
          }
        } else if (handobj) {
          handobj.active = false;
          handobj.hide();
        }
      } 
    }
  }, elation.engine.things.generic);
});
