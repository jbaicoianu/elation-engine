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
      this.engine.systems.controls.activateContext('camera_admin');
      elation.events.add(this.engine, 'engine_frame', this);
    }
    this.createObject3D = function() {
        var obj = new THREE.Object3D();
        return obj;
    }
    this.createChildren = function() {
      console.log('DHSJHJSHF');
        this.camera = new THREE.PerspectiveCamera(60, this.view.size[0] / this.view.size[1], 1e-2, 1e4);
        this.camera.position.set(0,1,1);
        this.objects['3d'].add(this.camera);
        this.orbitcontrols = new THREE.OrbitControls(this.camera, this.view.container);
        this.orbitcontrols.rotateUp(-Math.PI/4);
        this.orbitcontrols.rotateLeft(-Math.PI/4);
        this.orbitcontrols.dollyOut(25);
        this.orbitcontrols.userPanSpeed = 10;
        this.orbitcontrols.keyPanSpeed = 100;
        this.orbitcontrols.noKeys = true;

        elation.events.add(this.orbitcontrols, 'change', elation.bind(this, this.controls_change));

        this.flycontrols = new THREE.FlyControls(this.camera, this.view.container);
        this.flycontrols.movementSpeed = 10;
        this.flycontrols.rollSpeed = Math.PI/4;
        this.flycontrols.dragToLook = true;

        elation.events.add(this.flycontrols, 'change', elation.bind(this, this.controls_change));

        this.toggleControls();
    
        this.admincontrols.update(0);
        this.cameraactive = true;

        this.view.setactivething(this);
        return obj;
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
console.log('enable admin thing');
      this.admincontrols.enabled = true;
    }
    this.disable = function() {
console.log('disable admin thing');
      this.admincontrols.enabled = false;
    }
    this.engine_frame = function(ev) {
      if (this.cameraactive) {
        this.admincontrols.update(ev.data.delta);
      }
    }
    this.controls_change = function(ev) {
      this.refresh();
    }
  }, elation.engine.things.camera);
});
