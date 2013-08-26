elation.component.add('engine.things.manipulator', function() {
  this.postinit = function() {
    elation.events.add(this, "mouseover,mouseout,mousedown", this);
  }
  this.defaultsize = 4;
  this.opacities = [0.5, 0.8];
  this.origin = new THREE.Vector3(0,0,0);
  this.axes = {
    x: new THREE.Vector3(1,0,0),
    y: new THREE.Vector3(0,1,0),
    z: new THREE.Vector3(0,0,1)
  };
  this.dragline = new THREE.Vector2();
  this.projector = new THREE.Projector();

  this.createObject3D = function() {
    var obj = new THREE.Object3D();

    var size = this.defaultsize;
    //size = this.parent.objects['3d'].boundingBox;
    //console.log('size is', size);

    this.movehelper = {
      x: this.getArrow(this.axes.x, this.origin, size*1.1, 0xaa0000),
      y: this.getArrow(this.axes.y, this.origin, size*1.1, 0x00aa00),
      z: this.getArrow(this.axes.z, this.origin, size*1.1, 0x0000aa)
    };
    this.rotatehelper = {
      x: this.getRing(this.axes.x, this.origin, size, 0xaa0000),
      y: this.getRing(this.axes.y, this.origin, size, 0x00aa00),
      z: this.getRing(this.axes.z, this.origin, size, 0x0000aa)
    };
    
    for (var k in this.axes) {
      obj.add(this.movehelper[k]);
      obj.add(this.rotatehelper[k]);
    }

    return obj;
  }
  this.getArrow = function(dir, origin, size, color) {
    var mat = new THREE.MeshBasicMaterial({color: color, opacity: this.opacities[0], transparent: true, depthWrite: false});
    //var mat = elation.engine.utils.materials.getShaderMaterial("manipulator", {color: new THREE.Color(color), opacity: this.opacities[0]});
    var arrowgeo = new THREE.Geometry();

    var cone = new THREE.Mesh(new THREE.CylinderGeometry( 0, 0.05 * size, 0.25 * size, 5, 1 ), mat);
    cone.position.set(0,1.125 * size,0);
    THREE.GeometryUtils.merge(arrowgeo, cone);

    var shaft = new THREE.Mesh(new THREE.CylinderGeometry( .005 * size, .005 * size, size, 5, 1 ), mat);
    shaft.position.set(0, size/2, 0);
    THREE.GeometryUtils.merge(arrowgeo, shaft);

    var rotation = new THREE.Matrix4();
    if ( dir.y > 0.999 ) {
      rotation.setRotationFromEuler(new THREE.Vector3( 0, 0, 0 ));
    } else if ( dir.y < -0.999 ) {
      rotation.setRotationFromEuler(new THREE.Vector3( Math.PI, 0, 0 ));
    } else {
	    var axis = new THREE.Vector3( dir.z, 0, -dir.x ).normalize();
	    var radians = Math.acos( dir.y );
	    var quaternion = new THREE.Quaternion().setFromAxisAngle( axis, radians );
	    rotation.setRotationFromQuaternion( quaternion );
    }
    arrowgeo.applyMatrix(rotation);
    return new THREE.Mesh(arrowgeo, mat);
  }
  this.getRing = function(dir, origin, size, color) {
    var ringgeo = new THREE.TorusGeometry(size, .01 * size, 8, 32, Math.PI*2);
    var ringmat = new THREE.MeshBasicMaterial({color: color, opacity: this.opacities[0], transparent: true, depthWrite: false});
    //var ringmat = elation.engine.utils.materials.getShaderMaterial("manipulator", {color: new THREE.Color(color), opacity: this.opacities[0]});
    var ring = new THREE.Mesh(ringgeo, ringmat);
    // FIXME - this could be made to work with arbitrary axes...
    if (dir == this.axes.x) {
      ring.rotation.y = Math.PI/2;
    } else if (dir == this.axes.y) {
      ring.rotation.x = Math.PI/2;
    }
    return ring;
  }
  this.mouseover = function(ev) {
    if (ev.data && ev.data.material) {
      ev.data.material.opacity = this.opacities[1];
    }
  }
  this.mouseout = function(ev) {
    if (ev.data && ev.data.material) {
      ev.data.material.opacity = this.opacities[0];
    }
  }
  this.mousedown = function(ev) {
    elation.events.add(window, 'mousemove,mouseup', this);
    var mesh = ev.data;

    if (!this.camera) this.camera = this.engine.systems.render.views['main'].camera; // FIXME - ugly;
    this.engine.systems.admin.setCameraActive(false); // disable camera controls

    var action = false;
    if (mesh == this.movehelper.x) action = ['position', 'x'];
    if (mesh == this.movehelper.y) action = ['position', 'y'];
    if (mesh == this.movehelper.z) action = ['position', 'z'];
    if (mesh == this.rotatehelper.x) action = ['orientation', 'x'];
    if (mesh == this.rotatehelper.y) action = ['orientation', 'y'];
    if (mesh == this.rotatehelper.z) action = ['orientation', 'z'];

    this.action = action;
    if (action) {
      this.dragstartpos = [ev.clientX, ev.clientY];

      //console.log('Start ' + action[0] + ': ' + action[1]);
      switch (action[0]) {
        case 'position':
          // Project the start and end point of this axis into screen space, and store the drag line for reference during movement
          var start2d = this.projector.projectVector(this.localToWorld(this.origin.clone()), this.camera);
          var end2d = this.projector.projectVector(this.localToWorld(this.axes[action[1]].clone()), this.camera);
          this.dragline.set(end2d.x - start2d.x, end2d.y - start2d.y).normalize();
          break;
        case 'orientation':
          // Calculate the tangent vector at the point on the ring where the user clicked, and use that for the drag line
          var center3d = this.localToWorld(this.origin.clone());
          var mouse3d = new THREE.Vector3((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1, -1);
          this.projector.unprojectVector(mouse3d, this.camera);

          var ray = new THREE.Raycaster(this.camera.position, mouse3d.sub(this.camera.position).normalize());
          var intersects = ray.intersectObject(ev.data);
          if (intersects.length > 0) {
            var radial = intersects[0].point.clone().sub(center3d);
            var tangent = radial.cross(this.localToWorld(this.axes[action[1]].clone())).normalize();
          
            var start2d = this.projector.projectVector(intersects[0].point.clone(), this.camera);
            var end2d = this.projector.projectVector(intersects[0].point.clone().add(tangent), this.camera);
            this.dragline.set(end2d.x - start2d.x, end2d.y - start2d.y).normalize();
          }
          break;
      }
    } else {
      console.log('unknown action:', ev);
    }

    ev.stopPropagation();
    ev.preventDefault();
  }
  this.mousemove = function(ev) {
    if (this.action) {
      var dragdiff = new THREE.Vector2(ev.clientX - this.dragstartpos[0], this.dragstartpos[1] - ev.clientY);
      switch (this.action[0]) {
        case 'position':
          // project the dragged vector onto the line formed by the axis to determine movement amount
          // FIXME - speed should scale based on distance to the object, but the formula below isn't 100% correct
          var camerapos = new THREE.Vector3().getPositionFromMatrix(this.camera.matrixWorld);
          var dist = this.localToWorld(this.origin.clone()).sub(camerapos);
          var move = new THREE.Vector3();
          move[this.action[1]] = this.dragline.dot(dragdiff) / dist.length();
          this.parent.properties.position.copy(this.localToWorld(move));
          break;
        case 'orientation':
          // FIXME - for some axes and camera locations, the rotations seem to get reversed...
          var euler = new THREE.Vector3();
          euler[this.action[1]] = -this.dragline.dot(dragdiff) * Math.PI/180;
          var quat = new THREE.Quaternion().setFromEuler(euler);
          this.parent.properties.orientation.multiply(quat);
          break;
      }
      this.dragstartpos = [ev.clientX, ev.clientY];
    }
    ev.stopPropagation();
    ev.preventDefault();
  }
  this.mouseup = function(ev) {
    elation.events.remove(window, 'mousemove,mouseup', this);
    ev.stopPropagation();
    ev.preventDefault();
    this.engine.systems.admin.setCameraActive(true); // re-enable camera controls
  }
  this.click = function(ev) {
    //ev.stopPropagation();
  }
}, elation.engine.things.generic);

/*
elation.engine.utils.materials.addChunk("manipulator", {
  uniforms: {
    "color": { type: "c", value: new THREE.Color(0xcccccc) },
    "opacity": { type: "f", value: 1.0 },
  },
  vertex_pars: [
    "uniform vec3 color;",
    "uniform float opacity;",
  ].join('\n'),
  vertex: [
    "vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );",
		"gl_Position = projectionMatrix * mvPosition;"
  ].join('\n'),
  
  fragment_pars: [
    "uniform vec3 color;",
    "uniform float opacity;",
  ].join('\n'),
  fragment: [
    "gl_FragColor = vec4( color, opacity);",
  ].join('\n'),
});
elation.engine.utils.materials.buildShader("manipulator", {
  uniforms: [
    'common',
    'manipulator'
  ],
  chunks_vertex: [
    'manipulator',
  ],
  chunks_fragment: [
    'manipulator',
  ]
});
*/
