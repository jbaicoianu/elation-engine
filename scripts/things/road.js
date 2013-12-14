elation.require("engine.things.pathedit");

elation.component.add("engine.things.road", function(args) {
  this.postinit = function() {
    this.defineProperties({
      'path': { type: 'json' }
    });
  }
  this.createMaterial = function(params) {
    var repeats = (params['repeat'] ? params['repeat'][0] : 1);
    var repeatt = (params['repeat'] ? params['repeat'][1] : 1);

    var parameters = {
      map: elation.engine.utils.materials.getTexture("/media/space/textures/asphalt.jpg", [repeats, repeatt]),
      normalMap: elation.engine.utils.materials.getTexture("/media/space/textures/asphalt-normal.jpg", [repeats, repeatt]),
      offsetRepeat: new THREE.Vector4(0,0,repeats,repeatt),
      shading: THREE.SmoothShading,
      shininess: 10,
      overdraw: true,
    };
    return new THREE.MeshPhongMaterial(parameters);
  }
  this.createObject3D = function() {
    if (this.properties.path) {
      this.createOutline();
      var mesh = this.createSurface();
      this.objects['3d'] = mesh;
      this.createControlPoints();
      return mesh;
    }
  }
  this.createOutline = function() {
    this.splinepoints = [];
    var pathkeys = []
    for (var k in this.properties.path) {
      pathkeys.push(k);
    }
    pathkeys.sort();
    for (var i = 0; i < pathkeys.length; i++) {
      var k = pathkeys[i];
      this.splinepoints.push(new THREE.Vector2(this.properties.path[k][0], this.properties.path[k][2]));
    }
    this.roadspline = new THREE.Path();
    this.roadspline.moveTo(this.splinepoints[0].x,this.splinepoints[0].y);
    this.roadspline.splineThru(this.splinepoints.slice(1));

    var thickness = .6, 
        width = elation.utils.arrayget(this.properties, "physical.width", 20),
        thickscale = 4;
    var roadpoints = [
      new THREE.Vector2(-1, 0),
      new THREE.Vector2(-1, -width/2 - thickness*thickscale + 5),
      new THREE.Vector2(-1, -width/2 - thickness*thickscale),
      new THREE.Vector2(.1, -width/2 - thickness*thickscale + .1),
      new THREE.Vector2(thickness*.75, -width/2),
      new THREE.Vector2(thickness, -width/2 + thickness*thickscale),
      new THREE.Vector2(thickness, width/2 - thickness*thickscale),
      new THREE.Vector2(thickness*.75, width/2),
      new THREE.Vector2(.1, width/2 + thickness*thickscale - .1),
      new THREE.Vector2(-1, width/2 + thickness*thickscale),
      new THREE.Vector2(-1, width/2 + thickness*thickscale - 5),
      new THREE.Vector2(-1, 0),
    ];
    this.roadshape = new THREE.Shape(roadpoints);
  }

  this.createSurface = function() {
    material = this.createMaterial({repeat: [.5, .5]});
    this.roadspline = this.createSpline();

    var steps = Math.floor(this.roadspline.getLength() / 4);
    var frames = {tangents: [], normals: [], binormals: []};
    var normal = new THREE.Vector3(0,1,0);
    for ( i = 0; i < steps + 1; i++ ) {
      var u = i / steps;
      var tangent = this.roadspline.getTangentAt( u ).normalize();
      frames.tangents[ i ] = tangent;
      frames.normals[i] = normal;
      frames.binormals[i] = tangent.clone().cross(normal);
    }
    var uvgenerator = {
      generateTopUV: THREE.ExtrudeGeometry.WorldUVGenerator.generateTopUV,
      generateBottomUV: THREE.ExtrudeGeometry.WorldUVGenerator.generateBottomUV,
      generateSideWallUV:  THREE.ExtrudeGeometry.WorldUVGenerator.generateSideWallUV,
      foo: function(geometry, extrudedShape, wallCountour, extrudeOptions, indexA, indexB, indexC, indexD, stepIndex, stepsLength, contourIndex1, contourIndex2) {
        var v2 = new THREE.Vector2(0,1);
        return [v2, v2, v2, v2];
      }
    };
    var geo = new THREE.ExtrudeGeometry(this.roadshape, { extrudePath: this.roadspline, frames: frames, steps: steps, closed: true, UVGenerator: uvgenerator});
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    //elation.utils.arrayset(this.properties, "render.outline", this.roadspline);
    this.roadgeometry = geo;
    //this.removeRadarContact();
    //this.createRadarContact();
    return mesh;
  }
  this.createSpline = function() {
    var splinepoints = [];
    for (var k in this.properties.path) {
      splinepoints.push(new THREE.Vector3(this.properties.path[k][0], this.properties.path[k][1], this.properties.path[k][2]));
    }
    var spline;
    if (splinepoints[0].equals(splinepoints[splinepoints.length-1])) {
      splinepoints.pop();
      spline = new THREE.ClosedSplineCurve3(splinepoints);
    } else {
		  spline = new THREE.SplineCurve3(splinepoints);
    }
    return spline;
  }
  this.createWireframe = function() {
    this.add(new THREE.Mesh(this.roadgeometry, new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, opacity: 0.2, transparent: true})));
  }
  this.createControlPoints = function() {
    if (!this.editor) {
      this.editor = this.spawn('pathedit', this.name + '_edit', {
        'pickable': true,
        'path': this.roadspline
      }); 
  console.log('EDITOR', this.editor);
      this.editor.properties.position.set(0,0,0);
      elation.events.add(this.editor, "pathedit_change,pathedit_end", this);
    } else {
      this.editor.reparent(this);
    }
  }
}, elation.engine.things.generic);

