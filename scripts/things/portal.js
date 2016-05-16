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
      elation.events.add(this, 'mouseover,mousemove,mouseout,click', this);
    }
    this.createObject3D = function() {
      var root = new THREE.Object3D();
      return root;
    }
    this.createChildren = function() {
      if (this.properties.render.collada || this.properties.render.meshname) {
        this.child = this.spawn('generic', this.id + '_model', {
          'render.collada': this.properties.render.collada, 
          'render.meshname': this.properties.render.meshname, 
          'position': this.properties.childposition,
          'orientation': this.properties.childorientation.clone(),
          'scale': this.properties.childscale.clone(),
          persist: false,
        });
        elation.events.add(this.child, 'mouseover,mouseout,click', this);
      }
      if (this.properties.title) {
        this.label = this.spawn('label', this.id + '_label', { 
          text: this.properties.title, 
          size: .1,
          thickness: .05,
          position: [0, 0, 0],
          align: 'center',
          persist: false,
          color: 0x0000ee,
          emissive: 0x222266,
          scale: [1/this.properties.scale.x, 1/this.properties.scale.y, 1/this.properties.scale.z]
        });
        elation.events.add(this.label, 'mouseover,mouseout,click', this);
      }

/*
      this.light = this.spawn('light', this.id + '_light', {
        position: [0, 10, 15],
        persist: false,
        intensity: .5,
        color: 0x999999,
        type: 'spot',
        target: this.child,
        angle: Math.PI/8
      });
*/

      // FIXME - dumb hack for demo!
/*
      var collgeo = new THREE.BoxGeometry(4, 8, 4);
      var collmat = new THREE.MeshLambertMaterial({color: 0x990000, transparent: true, opacity: .5});
      var collider = new THREE.Mesh(collgeo, collmat);
      collider.userData.thing = this;
      collider.position.y = 4;
      this.colliders.add(collider);
      collider.updateMatrixWorld();
*/
    }
    this.mouseover = function(ev) {
      //this.child.properties.scale.copy(this.properties.childscale).multiplyScalar(1.2);
      if (this.child) {
        this.child.objects.dynamics.setAngularVelocity(new THREE.Vector3(0,Math.PI/4,0));
        this.child.refresh();
      }
      if (this.label) {
        this.label.setEmissionColor(0x2222aa);
      }
      if (this.light) {
        if (this.properties.url) {
          this.light.setHex(0xccffcc);
        } else {
          this.light.setHex(0xff0000);
        }
      }
      this.refresh();
    }
    this.mouseout = function(ev) {
      //this.child.properties.scale.copy(this.properties.childscale);
      if (this.child) {
        this.child.objects.dynamics.setAngularVelocity(new THREE.Vector3(0,0,0));
        this.child.refresh();
      }
      if (this.label) {
        this.label.setEmissionColor(0x222266);
      }
      if (this.light) {
        this.light.setHex(0x999999);
      }
      this.refresh();
    }
    this.click = function(ev) {
      if (ev.data.distance <= 40 && this.properties.url) {
        this.engine.systems.world.loadSceneFromURL(this.properties.url);
      }
    }
  }, elation.engine.things.generic);
});
