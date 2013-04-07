/* grid helper */
elation.component.add("engine.things.gridhelper", function() {
  this.postinit = function() {
  }
  this.createObject3D = function() {
    var obj = new THREE.Object3D();
    var range = this.args.range || 5;
    var extent = range * 2;
    var numverts = Math.pow(extent+1, 3);

    var planemat = elation.engine.utils.materials.getShaderMaterial("gridhelper_line", {range: range});
    planemat.blending = THREE.NormalBlending;
    planemat.transparent = true;
    planemat.depthWrite = false;
    planemat.linewidth = 1;
    planemat.side = THREE.DoubleSide;

    //planemat.wireframe = true;
    var planegeo = new THREE.PlaneGeometry(extent, extent, extent, extent);
    var obj = new THREE.Object3D();
    var planexy = new THREE.Mesh(planegeo, planemat.clone());
    var planeyz = new THREE.Mesh(planegeo, planemat.clone());
    var planexz = new THREE.Mesh(planegeo, planemat.clone());
    planeyz.rotation.y = Math.PI/2;
    planexz.rotation.x = Math.PI/2;
    planexy.material.uniforms.color.value.setHex(0x6666ff);
    planeyz.material.uniforms.color.value.setHex(0xff6666);
    planexz.material.uniforms.color.value.setHex(0x66ff66);
    planexy.material.uniforms.axes.value.set(1,1,0);
    planeyz.material.uniforms.axes.value.set(0,1,1);
    planexz.material.uniforms.axes.value.set(1,0,1);
    obj.add(planexy);
    obj.add(planeyz);
    obj.add(planexz);
    return obj;
  }
}, elation.engine.things.generic);

elation.engine.utils.materials.addChunk("gridhelper_line", {
  uniforms: {
    "range": { type: "f", value: 10 },
    "color": { type: "c", value: new THREE.Color(0xcccccc) },
    "axes": { type: "v3", value: new THREE.Vector3(0,0,0) }
  },
  vertex_pars: [
    "varying vec3 vaPos;",
    "varying vec3 vrPos;",
    "varying vec3 vColor;",
    "uniform float range;",
    "uniform vec3 color;",
  ].join('\n'),
  vertex: [
    "vrPos = position;",
    "vaPos = (modelMatrix * vec4(position, 1.0)).xyz;",
    "vColor = color;",
  ].join('\n'),
  
  fragment_pars: [
    "varying vec3 vaPos;",
    "varying vec3 vrPos;",
    "varying vec3 vColor;",
    "uniform float range;",
    "uniform vec3 axes;",
  ].join('\n'),
  fragment: [
    "int snapx = int(vaPos.x);",
    "float d = 0.0;",
    "if (abs(vaPos.x - float(int(vaPos.x))) < 0.05 * axes.x || ",
    "     abs(vaPos.y - float(int(vaPos.y))) < 0.05 * axes.y || ",
    "     abs(vaPos.z - float(int(vaPos.z))) < 0.05 * axes.z) { d = 1.0; }",
    "float opacity = 1.0 - (pow(sqrt(vrPos.x * vrPos.x + vrPos.y * vrPos.y + vrPos.z * vrPos.z) / range, 2.0)) ;",
    "gl_FragColor = vec4( vColor, d * opacity);",
  ].join('\n'),
});
elation.engine.utils.materials.buildShader("gridhelper_line", {
  uniforms: [
    'common',
    'gridhelper_line'
  ],
  chunks_vertex: [
    'default',
    'color',
    'gridhelper_line',
  ],
  chunks_fragment: [
    'color',
    'gridhelper_line',
  ]
});

