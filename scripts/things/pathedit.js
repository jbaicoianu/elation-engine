elation.component.add("engine.things.pathedit", function(args) {

  this.states = {
    'default': {
      color: 0x4444ff,
      scale: 1,
      opacity: .6
    },
    'move': {
      color: 0xffff00,
      scale: 1.5,
    },
    'create': {
      color: 0x00ff00,
      scale: 1.5,
    },
    'delete': {
      color: 0xff0000,
      scale: 1.5,
    },
  };

  this.postinit = function() {
    //elation.engine.things.pathedit.extendclass.postinit.call(this);
    this.defineProperties({
      'path': { type: 'json' },
      'yOffset': { type: 'float', default: 0.0 }
    });
    this.controlpoints = [];
    this.labels = [];
    this.activepoint = false;
    this.dragpoint = -1;
    this.offsetY = this.properties.yOffset;
    this.pointsize = 1;
    elation.events.add(this, "mouseover,mouseout,mousemove,mousedown", this);
  }
  this.createObject3D = function() {
    this.objects['3d'] = new THREE.Object3D();
    this.create();
    return this.objects['3d'];
  }
  this.create = function() {
console.log('pathedit!', this);
    if (this.args.properties.path) {
      this.path = this.args.properties.path;
      var pnum = 0;
      if (this.path.curves && this.path.curves.length > 0) {
        for (var i = 0; i < this.path.curves.length; i++) {
          var curve = this.path.curves[i];
console.log(curve);
          if (curve instanceof THREE.SplineCurve || curve instanceof THREE.SplineCurve3) {
            for (var j = 0; j < curve.points.length; j++) {
              this.addControlPoint(pnum++, curve.points[j]);
            }
          } else if (curve instanceof THREE.LineCurve || curve instanceof THREE.LineCurve3) {
            if (pnum == 0 || this.controlpoints[pnum-1].position.distanceTo(curve.v1) > .0001) {
              this.addControlPoint(pnum++, curve.v1);
            }
            this.addControlPoint(pnum++, curve.v2);
          }
        }
      } else if (this.path.points) {
        for (var j = 0; j < this.path.points.length; j++) {
          this.addControlPoint(pnum++, this.path.points[j]);
        }
      }
    }
    this.updatePreview();
  }
  this.createPathFromPoints = function(points) {
  }
  this.updatePreview = function() {
    if (!this.extrudeshape) {
      this.extrudeshape = new THREE.Shape([
        new THREE.Vector2(0,.1),
        new THREE.Vector2(-.1,-.1),
        new THREE.Vector2(.1,-.1),
      ]);
    }
    if (this.preview) {
      this.preview.parent.remove(this.preview);
    }
  
    console.log('update path!', this.preview, this.extrudeshape, this.path);
    var extrudegeo = new THREE.ExtrudeGeometry(this.extrudeshape, { extrudePath: this.path, steps: 1000, closed: false });
    this.preview = new THREE.Mesh(extrudegeo, new THREE.MeshBasicMaterial({color: 0xff0000, transparent: true, opacity: .5}));
    this.objects['3d'].add(this.preview);
    this.refresh();
  }
  this.addControlPoint = function(num, p) {
    // Add one new label to the END of the list
console.log('add point ' + this.controlpoints.length, num);
    var label = this.getLabel(this.controlpoints.length);
    this.controlpoints.push(label);
    //this.controlpoints[num] = this.getLabel(num);
    for (var i = this.controlpoints.length-1; i >= num && i >= 1; i--) {
      this.controlpoints[i].properties.position.copy(this.controlpoints[i-1].properties.position);
    }
    //this.controlpoints[num].properties.position.set(p.x, p.y + this.offsetY, p.z);
    var vpos = this.worldToLocal(new THREE.Vector3(p.x, p.y + this.offsetY, p.z));
    label.properties.position.copy(vpos);
    this.objects['3d'].add(label);
    this.refresh();
  }
  this.removeControlPoint = function(num) {
    for (var i = num; i < this.controlpoints.length-1; i++) {
      this.controlpoints[i].properties.position.copy(this.controlpoints[i+1].properties.position);
    }
    var last = this.controlpoints.pop();
    this.remove(last);
    this.updatePath();
  }
  this.setPointState = function(num, state) {
    if (this.controlpoints[num]) {
      if (!this.states[state]) {
        state = 'default';
      }
      var material = this.controlpoints[num].geometry.materials[1];
      for (var k in this.states[state]) {
        var val = this.states[state][k];
        switch (k) {
          case 'color':
            material[k].setHex(val);
            break;
          case 'scale':
            this.controlpoints[num].scale.set(val, val, val);
            break;
          default:
            material[k] = val;
        }
      }
    }
  }
  this.getLabel = function(num) {
//this.labels[num] = new THREE.Mesh(new THREE.SphereGeometry(10, 9, 18), new THREE.MeshBasicMaterial({color: 0xff0000}));
    if (!this.labels[num]) {
      //var geo = new THREE.CubeGeometry(this.pointsize, this.pointsize, this.pointsize, 3, 3, 3);
      this.labels[num] = this.spawn('pathnode', this.name + '_' + num, { pickable: true, nodenum: num });
    }
    return this.labels[num];
  }
  this.updatePath = function() {
    var path = [];
    var vpos = new THREE.Vector3();
    for (var k in this.controlpoints) {
      console.log(' - ' + k, this.controlpoints[k]);
      path[k] = this.localToParent(vpos.copy(this.controlpoints[k].properties.position)).toArray();
      path[k][1] -= this.offsetY;
    }
    //this.set('path', path, true);
    //this.path = path;

    if (this.path && this.path.curves) {
      var curve = this.path.curves[0];
      for (var i = 0; i < path.length; i++) {
        if (curve.points[i]) {
          curve.points[i].set(path[i][0], path[i][1], path[i][2]);
        } else {
          curve.points[i] = new THREE.Vector3(path[i][0], path[i][1], path[i][2]);
        }
      }
    }

    this.updatePreview();
    //this.parent.set('path', path, true);
  }
  this.getControlPoints = function() {
    var points = [];
    for (var i = 0; i < this.controlpoints.length; i++) {
      //points.push(new THREE.Vector2(this.controlpoints[i].position.x, this.controlpoints[i].position.z));
      //var point = this.worldToLocal(new THREE.Vector3().copy(this.controlpoints[i].position));
      var point = new THREE.Vector3().copy(this.controlpoints[i].position);
      points.push(point);
    }
    return points;
  }
  this.setMaterial = function(obj, color, opacity) {
    obj.geometry.materials[1].color.setHex(color);
    //obj.geometry.materials[1].opacity = opacity;
  }
/*
  this.mouseover = function(ev) {
    var pointnum = this.controlpoints.indexOf(ev.data.object);

    if (pointnum !== -1) {
      if (ev.data.keystate.shift) {
        this.setPointState(pointnum, "create");
      } else if (ev.data.keystate.ctrl) {
        this.setPointState(pointnum, "delete");
      } else {
        this.setPointState(pointnum, "move");
      }

      if (this.dragpoint != -1) {
        this.controlpoints[this.dragpoint].position.clone(this.controlpoints[pointnum].position);
      }
      //this.controlpoints[pointnum].scale.set(1.5,1.5,1.5);
      this.activepoint = pointnum;
    }
  }
  this.mousemove = function(ev) {
ev.preventDefault();
ev.stopPropagation();
return;
    if (this.dragpoint != -1) {
      var dirvec = ev.data.point.clone().sub(ev.data.camerapos).normalize();
      var groundvec = new THREE.Vector3(ev.data.point.x - ev.data.camerapos.x, ev.data.point.y, ev.data.point.z - ev.data.camerapos.z).normalize();
      var theta = Math.acos(groundvec.dot(dirvec));
      var hlen = this.offsetY / Math.sin(theta);

      if (this.activepoint !== false && this.activepoint != -1) {
        this.controlpoints[this.dragpoint].position.copy(this.controlpoints[this.activepoint].position);
      } else {
        this.controlpoints[this.dragpoint].position = dirvec.multiplyScalar(ev.data.distance - hlen).addSelf(ev.data.camerapos);
      }
      elation.events.fire({type: "pathedit_change", element: this});
    }
      if (ev.data.keystate.shift) {
        this.setPointState(this.activepoint, "create");
      } else if (ev.data.keystate.ctrl) {
        this.setPointState(this.activepoint, "delete");
      } else {
        this.setPointState(this.activepoint, "move");
      }
  }
  this.mouseup = function(ev) {
    if (this.dragpoint != -1) {
      elation.events.remove(elation.space.fly(0).scene, "mousemove,mouseup", this);
      this.controlpoints[this.dragpoint].unpickable = false;
      this.setPointState(this.dragpoint, (this.dragpoint == this.activepoint ? "move" : "default"));
      elation.events.fire({type: "pathedit_end", element: this});
      this.dragpoint = -1;
    }
  }
*/
}, elation.engine.things.generic);



elation.component.add('engine.things.pathnode', function() {
  this.states = {
    'default': {
      color: 0x4444ff,
      scale: 1,
      opacity: .6
    },
    'move': {
      color: 0xffff00,
      scale: 1.5,
    },
    'create': {
      color: 0x00ff00,
      scale: 1.5,
    },
    'delete': {
      color: 0xff0000,
      scale: 1.5,
    },
  };

  this.postinit = function() {
    this.defineProperties({
      'nodenum': { type: 'int' },
      'pointsize': { type: 'float', default: 1 }
      //'pointsize': { type: 'float', default: 1 }
    });
    elation.events.add(this, 'mouseover,mouseout,mousedown,click,thing_drag_end', this);
  }
  this.createObject3D = function() {
    var spheregeo = new THREE.SphereGeometry(this.properties.pointsize, 9, 18);
    var spheremat = new THREE.MeshBasicMaterial({
      color: 0x4444ff,
      shading: THREE.SmoothShading,
      opacity: 0.6,
      transparent: true,
      blending: THREE.AdditiveBlending
    });
    var spheremesh = new THREE.Mesh(spheregeo, spheremat);
    var labelmat = new THREE.MeshBasicMaterial({color: 0xffffff, shading: THREE.SmoothShading});

    var num = this.properties.nodenum;
    var labeltext = (this.args.showname && this.args.name ? this.args.name + "." : "") + num;
    var textmesh = new THREE.Mesh(new THREE.TextGeometry( labeltext, {
      size: this.properties.pointsize,
      height: this.properties.pointsize/64,
      curveSegments: 6,

      font: "helvetiker",
      weight: "normal",
      style: "normal",

      bevelThickness: this.properties.pointsize/20,
      bevelSize: this.properties.pointsize/20,
      bevelEnabled: true
    }), labelmat);
    textmesh.geometry.computeVertexNormals();
    textmesh.geometry.computeBoundingBox();
    var diff = new THREE.Vector3().subVectors(textmesh.geometry.boundingBox.max, textmesh.geometry.boundingBox.min).multiplyScalar(-.5);
    //diff.y += this.pointsize/4;
    //diff.z += this.pointsize/2;
    var textmod = new THREE.Matrix4();
    textmod.setPosition(diff);
    textmesh.geometry.applyMatrix(textmod);
    var geo = new THREE.Geometry();
    THREE.GeometryUtils.merge(geo, textmesh);
    THREE.GeometryUtils.merge(geo, spheremesh);

    //geo.computeTangents();
    geo.computeVertexNormals();

    this.materials = {
      sphere: spheremat,
      label: labelmat
    };
    this.objects['3d'] = new THREE.Mesh(geo, spheremat);
    return this.objects['3d'];
  }
  this.mouseover = function(ev) {
      if (ev.shiftKey) {
        this.setState("create");
      } else if (ev.ctrlKey) {
        this.setState("delete");
      } else {
        this.setState("move");
      }

/*
      if (this.dragpoint != -1) {
        this.controlpoints[this.dragpoint].position.clone(this.controlpoints[pointnum].position);
      }
      //this.controlpoints[pointnum].scale.set(1.5,1.5,1.5);
      this.activepoint = pointnum;
*/
    this.refresh();
  }
  this.mouseout = function(ev) {
    this.refresh();
    //if (this.activepoint !== false) {
    //  if (this.activepoint != this.dragpoint) {
        this.setState("default");
    //  }
    //  this.activepoint = false;
    //}
  }
  this.mousedown = function(ev) {
    switch (ev.button) {
      case 0:
        if (ev.shiftKey) {
          var newpos = this.properties.position.clone();
          newpos.y -= this.parent.offsetY;
          this.parent.addControlPoint(this.properties.nodenum+1, newpos);
          this.setState("create");
        } else if (ev.ctrlKey) {
          this.setState("default");
          this.parent.removeControlPoint(this.properties.nodenum);
          elation.events.fire({type: "pathedit_change", element: this});
          elation.events.fire({type: "pathedit_end", element: this});
        }
        //this.dragpoint = pointnum;
        //this.controlpoints[pointnum].unpickable = true;
        //elation.events.add(elation.space.fly(0).scene, "mousemove,mouseup", this);
        elation.events.add(window, "mousemove,mouseup", this);
        elation.events.fire({type: "pathedit_start", element: this});
        break;
      case 2:
        console.log("right!");
        ev.preventDefault();
        break;
    }
    ev.stopPropagation();
    this.refresh();
  }
  this.click = function(ev) {
  }
  this.thing_drag_end = function(ev) {
    this.parent.updatePath();
    this.refresh();
  }
  this.setState = function(state) {
    if (!this.states[state]) {
      state = 'default';
    }
    var material = this.materials['sphere'];
    for (var k in this.states[state]) {
      var val = this.states[state][k];
      switch (k) {
        case 'color':
          material[k].setHex(val);
          break;
        case 'scale':
          //this.properties.scale.set(val, val, val);
          break;
        default:
          material[k] = val;
      }
    }
    elation.events.fire({type: 'thing_change', element: this});
    this.refresh();
  }
}, elation.engine.things.generic);
