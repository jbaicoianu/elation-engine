elation.require([], function() {
  elation.component.add('engine.things.trigger', function() {
    this.postinit = function() {
      this.defineProperties({
        shape: { type: 'string', default: 'box' },
        size: { type: 'object' },
        collider: { type: 'object' },
        triggertimeout: { type: 'integer', default: 250 },
        triggertags: { type: 'string', default: 'player' }
      });
      this.triggered = false;
      this.triggertimer = false;
    }
    this.createObject3D = function() {
      var size = this.properties.size;
      switch (this.properties.shape) {
        case 'box':
          geo = new THREE.BoxGeometry(size.x, size.y, size.z);
          break;
        case 'sphere':
          geo = new THREE.SphereGeometry(size);
          break;
      }
      this.material = new THREE.MeshPhongMaterial({color: 0xff00ff, transparent: true, opacity: .5});
      var mesh = new THREE.Mesh(geo, this.material);
      mesh.visible = false;
      return mesh;
    }
    this.createForces = function() {
      if (this.properties.collider) {
        this.objects.dynamics.setCollider(this.properties.collider);
      }
      elation.events.add(this.objects.dynamics, 'physics_collide', elation.bind(this, this.handleTriggerCollide));
    }
    this.handleTriggerCollide = function(ev) {
      var obj = (ev.data.bodies[0].object == ev.target.object ? ev.data.bodies[1].object : ev.data.bodies[0].object);
      if (this.isTriggeredByTags(obj, this.properties.triggertags)) {
        if (!this.triggered) {
          this.triggerOn();
        }
        this.resetTriggerTimer();
      }

      // Bypass default collision handling
      ev.preventDefault();
    }
    this.triggerOn = function() {
      if (!this.triggered) {
        //console.log('on:', this.name);
        elation.events.fire({type: 'trigger_on', element: this});
        this.triggered = true;
        this.material.color.setHex(0xffff00);
        this.refresh();
      }
    }
    this.triggerOff = function() {
      if (this.triggered) {
        //console.log('off:', this.name);
        elation.events.fire({type: 'trigger_off', element: this});
        this.triggertimer = false; 
        this.triggered = false;
        this.material.color.setHex(0xff00ff);
        this.refresh();
      }
    }
    this.isTriggeredByTags = function(obj, tags) {
      // No tags specified, so all are valid
      if (!tags) return true;

      var tags = (elation.utils.isString(tags) ? tags.split(',') : tags);
      for (var i = 0; i < tags.length; i++) {
        if (obj.hasTag(tags[i])) {
          return true;
        }
      }
      return false;
    }
    this.resetTriggerTimer = function() {
      if (this.triggertimer) {
        clearTimeout(this.triggertimer);
      }
      this.triggertimer = setTimeout(elation.bind(this, this.triggerOff), this.properties.triggertimeout);
    }
  }, elation.engine.things.generic);
});
