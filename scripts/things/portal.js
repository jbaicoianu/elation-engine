elation.require(['engine.things.generic', 'engine.things.label'], function() {
  elation.component.add('engine.things.portal', function() {
    this.postinit = function() {
      this.defineProperties({
        'url': { type: 'string' },
        'title': { type: 'string' },
        'childposition': { type: 'vector3', default: new THREE.Vector3(0,0,0) },
        'childorientation': { type: 'quaternion', default: new THREE.Quaternion() },
        'childscale': { type: 'vector3', default: new THREE.Vector3(1,1,1) },
      });
      elation.events.add(this, 'mouseover,mouseout,click', this);
    }
    this.createObject3D = function() {
      var root = new THREE.Object3D();
      return root;
    }
    this.createChildren = function() {
      this.child = this.spawn('generic', this.id + '_model', {
        'render.collada': this.properties.render.collada, 
        'position': this.properties.childposition,
        'orientation': this.properties.childorientation.clone(),
        'scale': this.properties.childscale.clone(),
        persist: false,
      });
      elation.events.add(this.child, 'mouseover,mouseout,click', this);
      if (this.properties.title) {
        this.label = this.spawn('label', this.id + '_label', { 
          text: this.properties.title, 
          position: [0, 10, 0],
          persist: false,
          color: 0x0000ee,
          emissive: 0x222266,
          scale: [1/this.properties.scale.x, 1/this.properties.scale.y, 1/this.properties.scale.z]
        });
        elation.events.add(this.label, 'mouseover,mouseout,click', this);
      }

      this.light = this.spawn('light', this.id + '_light', {
        position: [0, 10, 15],
        persist: false,
        intensity: 1,
        color: 0x999999,
        type: 'spot',
        target: this.child,
        angle: Math.PI/8
      });
    }
    this.mouseover = function(ev) {
      //this.child.properties.scale.copy(this.properties.childscale).multiplyScalar(1.2);
      this.child.objects.dynamics.setAngularVelocity(new THREE.Vector3(0,Math.PI/4,0));
      this.label.setEmissionColor(0x2222aa);
      if (this.properties.url) {
        this.light.setHex(0xccffcc);
      } else {
        this.light.setHex(0xff0000);
      }
      this.refresh();
      this.child.refresh();
    }
    this.mouseout = function(ev) {
      //this.child.properties.scale.copy(this.properties.childscale);
      this.child.objects.dynamics.setAngularVelocity(new THREE.Vector3(0,0,0));
      this.label.setEmissionColor(0x222266);
      this.light.setHex(0x999999);
      this.refresh();
      this.child.refresh();
    }
    this.click = function(ev) {
      if (this.properties.url) {
        this.engine.systems.world.loadSceneFromURL(this.properties.url);
      }
    }
  }, elation.engine.things.generic);
});
