elation.require(['engine.things.player', 'engine.things.ball'], function() {
  elation.component.add('engine.things.ballplayer', function() {
    this.postinit = function() {
      elation.engine.things.ballplayer.extendclass.postinit.call(this);
      this.ballerstate = this.engine.systems.controls.addContext('ballplayer', {
        'toss': ['keyboard_space', elation.bind(this, this.toss)],
        'toss_cube': ['keyboard_shift_space,gamepad_0_button_1', elation.bind(this, this.toss_cube)],
      });
    }
    this.createObject3D = function() {
      //var geo = new THREE.SphereGeometry(this.properties.fatness);
      var geo = elation.engine.geometries.generate('capsule', { radius: this.properties.fatness, length: this.properties.height - this.properties.fatness * 2, offset: new THREE.Vector3(0,this.properties.height/2,0)});
      var mat = new THREE.MeshPhongMaterial({color: 0xcccccc});
      this.ears = new THREE.Object3D();
      return new THREE.Mesh(geo, mat);
    }
    this.createForces = function() {
      elation.engine.things.ballplayer.extendclass.createForces.call(this);
      //this.setCollider('capsule', { radius: this.properties.fatness, length: this.properties.height - this.properties.fatness * 2, offset: new THREE.Vector3(0,this.properties.height/2,0)});
      //this.setCollider('sphere', { radius: .25, length: 1 });
    }
    this.enable = function() {
      elation.engine.things.ballplayer.extendclass.enable.call(this);
      this.engine.systems.controls.activateContext('ballplayer');
    }
    this.disable = function() {
      this.engine.systems.controls.deactivateContext('ballplayer');
      elation.engine.things.ballplayer.extendclass.disable.call(this);
    }
  }, elation.engine.things.player);
});
