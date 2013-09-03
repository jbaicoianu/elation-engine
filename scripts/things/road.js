elation.require("engine.things.pathedit");

elation.component.add("engine.things.road", function(args) {
  this.postinit = function() {
    this.defineProperties({
      'path': { type: 'array' }
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

    var thickness = .2, 
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

    var steps = 100;
    var frames = {tangents: [], normals: [], binormals: []};
    var normal = new THREE.Vector3(0,1,0); // FIXME - something's upside down and I can't figure out what; this isn't the place to fix it but it's a workaround
    for ( i = 0; i < steps + 1; i++ ) {
      var u = i / steps;
      var tangent = this.roadspline.getTangentAt( u ).normalize();
      frames.tangents[ i ] = tangent;
      frames.normals[i] = normal;
      frames.binormals[i] = tangent.clone().cross(normal);
    }
    var geo = new THREE.ExtrudeGeometry(this.roadshape, { extrudePath: this.roadspline, frames: frames, steps: steps});
    geo.computeVertexNormals();
    var mesh = new THREE.Mesh(geo, material);
    mesh.receiveShadow = true;
    elation.utils.arrayset(this.properties, "render.outline", this.roadspline);
    this.roadgeometry = geo;
    //this.removeRadarContact();
    //this.createRadarContact();
    return mesh;
  }
  this.createSpline = function() {
    var splinepoints = [];
    for (var k in this.properties.path) {
      splinepoints.unshift(new THREE.Vector3(this.properties.path[k][0], this.properties.path[k][1], this.properties.path[k][2]));
    }
		var spline = new THREE.SplineCurve3(splinepoints);
    return spline;
  }
  this.createWireframe = function() {
    this.add(new THREE.Mesh(this.roadgeometry, new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: true, opacity: 0.2, transparent: true})));
  }
  this.createControlPoints = function() {
    var editor = elation.engine.things.pathedit(null, elation.html.create(), {
      'type': 'pathedit',
      'name': this.name,
      'path': this.roadspline
    });
    this.add(editor);
    elation.events.add(editor, "pathedit_change,pathedit_end", this);
  }
}, elation.engine.things.generic);

