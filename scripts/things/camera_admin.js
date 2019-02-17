elation.require(['engine.things.camera'], function() {
  elation.component.add('engine.things.camera_admin', function() {
    this.postinit = function() {
      this.defineProperties({
        view: { type: 'object' }
      });
      this.view = this.properties.view;
      console.log('new admin cam!', this.view);

      this.controlstate = this.engine.systems.controls.addContext('camera_admin', {
        'toggle_camera': ['keyboard_ctrl_c', elation.bind(this, function(ev) { if (ev.value == 1) { this.toggleControls(); }}) ]
      });
      this.ears = new THREE.Object3D();
      this.engine.systems.controls.activateContext('camera_admin');
      elation.events.add(this.engine, 'engine_frame', this);
    }
    this.createObject3D = function() {
        this.camera = new THREE.PerspectiveCamera(90, this.view.size[0] / this.view.size[1], 1e-2, 1e4);
        this.camera.position.set(0,1,1);
        this.camera.add(this.ears);
        return this.camera;
    }
    this.createChildren = function() {
        //this.objects['3d'].add(this.camera);


        this.orbitcontrols = new THREE.OrbitControls(this.camera, this.view.container);
        //this.orbitcontrols.rotateUp(-Math.PI/4);
        //this.orbitcontrols.rotateLeft(-Math.PI/4);
        //this.orbitcontrols.dollyOut(10);
        this.orbitcontrols.userPanSpeed = 10;
        this.orbitcontrols.keyPanSpeed = 100;
        this.orbitcontrols.noKeys = true;
        this.orbitcontrols.screenSpacePanning = true;

        elation.events.add(this.orbitcontrols, 'change', elation.bind(this, this.controls_change));

/*
        this.flycontrols = new THREE.FlyControls(this.camera, this.view.container);
        this.flycontrols.movementSpeed = 10;
        this.flycontrols.rollSpeed = Math.PI/4;
        this.flycontrols.dragToLook = true;
        elation.events.add(this.flycontrols, 'change', elation.bind(this, this.controls_change));
*/

        this.toggleControls();
    
        this.admincontrols.update(0);
        this.cameraactive = true;

        this.engine.client.setActiveThing(this);
    }
    this.toggleControls = function() {
console.log('toggle controls', this.admincontrols, this.orbitcontrols, this.flycontrols);
      var oldobject = false;
      if (this.admincontrols) {
        if (this.admincontrols.disable) {
          this.admincontrols.disable();
        } else {
          this.admincontrols.enabled = false;
        }
        oldobject = this.admincontrols.object;
      }
      if (this.admincontrols === this.orbitcontrols) {
        this.admincontrols = this.flycontrols;
      } else {
        this.admincontrols = this.orbitcontrols;
      }
      if (this.admincontrols.enable) {
        this.admincontrols.enable()
      } else {
        this.admincontrols.enabled = true;
      }
      if (oldobject) {
        this.admincontrols.object = oldobject;
      }
      this.admincontrols.enabled = true;
    }
    this.enable = function() {
      this.admincontrols.enabled = true;
      this.camera.layers.enable(10);
    }
    this.disable = function() {
      this.admincontrols.enabled = false;
      this.camera.layers.disable(10);
    }
    this.engine_frame = function(ev) {
      if (this.cameraactive) {
        //this.admincontrols.update(ev.data.delta);
        //this.admincontrols.update();
      }
    }
    this.controls_change = function(ev) {
      this.engine.systems.render.setdirty();
    }
  }, elation.engine.things.camera);
});
