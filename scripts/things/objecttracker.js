elation.require('engine.things.generic', function() {
  elation.component.add('engine.things.objecttracker', function() {
    this.postinit = function() {
      this.controllers = [];
      elation.events.add(this.engine, 'engine_frame', elation.bind(this, this.updatePositions));
      elation.events.add(window, "webkitGamepadConnected,webkitgamepaddisconnected,MozGamepadConnected,MozGamepadDisconnected,gamepadconnected,gamepaddisconnected", elation.bind(this, this.updateTrackedObjects));
    }
    this.createChildren = function() {
      this.updateTrackedObjects();
    }
    this.updatePositions = function() {
      this.updateTrackedObjects();
      if (this.vrdisplay) {
        var foo = new THREE.Matrix4().fromArray(this.vrdisplay.stageParameters.sittingToStandingTransform);
        //console.log(foo.toArray());
      } else return;

      var player = this.engine.client.player,
          stage = this.vrdisplay.stageParameters;
      for (var i = 0; i < this.controllers.length; i++) {
        var c = this.controllers[i];
        if (c && c.data.pose) {
          var pose = c.data.pose;
          c.model.position.fromArray(pose.position).multiplyScalar(1);
          c.model.position.y += player.properties.height * 0.8 - player.properties.fatness;
          c.model.position.x *= this.vrdisplay.stageParameters.sizeX;
          c.model.position.z *= this.vrdisplay.stageParameters.sizeZ;

          c.model.scale.set(stage.sizeX, stage.sizeX, stage.sizeZ); // FIXME - does this get weird for non-square rooms?
          c.model.quaternion.fromArray(pose.orientation);
        }
      }
    }
    this.updateTrackedObjects = function() {
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
        model: (this.controllers[i] ? this.controllers[i].model : this.createPlaceholder()),
        data: controller
      };
      this.objects['3d'].add(this.controllers[i].model);
      return this.controllers[i];
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
  }, elation.engine.things.generic);
});
