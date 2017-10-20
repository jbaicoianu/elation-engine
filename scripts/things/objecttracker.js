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
        daydream: 'controller_daydream'
      };
      this.controllerMap = {
        'touch_left': /^Oculus Touch \(Left\)$/,
        'touch_right': /^Oculus Touch \(Right\)$/,
        'vive_left': /HTC Vive/,
        'vive_right': /HTC Vive/,
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
    this.updatePositions = function() {
      this.updateTrackedObjects();
      if (!this.vrdisplay) {
        return;
      }

      var player = this.engine.client.player,
          stage = this.vrdisplay.stageParameters;
      for (var i = 0; i < this.controllers.length; i++) {
        var c = this.controllers[i],
            handname = c.hand || (i ? 'left' : 'right');
        if (c && c.data.pose) {
          //var hand = c.model;
          var pose = c.data.pose;
          if (pose.position) {
            c.model.position.fromArray(pose.position).multiplyScalar(1);
            //player.neck.worldToLocal(player.neck.localToWorld(c.model.position));
            //hand.position.fromArray(pose.position);
          } else {
            c.model.position.set(.2, (handname == "right" ? -.3 : .3), .2);
            //c.model.children[0].position.z = .1;
            var dyn = this.player.neck.objects.dynamics;
            player.objects.dynamics.worldToLocalPos(dyn.localToWorldPos(c.model.position).sub(player.position));
          }

          //c.model.scale.set(stage.sizeX, stage.sizeX, stage.sizeZ); // FIXME - does this get weird for non-square rooms?
          if (pose.orientation) {
            c.model.quaternion.fromArray(pose.orientation);
            //hand.properties.orientation.fromArray(pose.orientation);
          }
        }
      }
    }
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
        if (gamepads[i] && !this.controllers[i]) {
          this.setTrackedController(i, gamepads[i]);
        }
      }
    }
    this.setTrackedController = function(i, controller) {
      this.controllers[i] = {
        model: this.getControllerModel(controller),
        data: controller
      };
      this.objects['3d'].add(this.controllers[i].model);
      return this.controllers[i];
    }
    this.getControllerModel = function(controller) {
      //(this.controllers[i] ? this.controllers[i].model : this.createPlaceholder()),
      for (var k in this.controllerMap) {
        if (controller.id.match(this.controllerMap[k])) {
          var assetid = this.controllerModels[k];
          if (assetid) {
            var asset = elation.engine.assets.find('model', assetid);
            var obj = new THREE.Object3D();
            obj.add(asset);
            asset.position.set(0,0,-0.1);
            return obj;
          }
        }
      }
      return new THREE.Object3D();
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
