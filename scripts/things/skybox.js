elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.skybox', function() {
    this.postinit = function() {
      elation.events.add(this.engine.systems.render.views.main, 'render_view_prerender', elation.bind(this, this.updatePosition));
    }
    this.createObject3D = function() {
      var geo = new THREE.BoxGeometry(50, 50, 50);
      var mat = new THREE.MeshBasicMaterial({color: 0x000000, side: THREE.BackSide, fog: false, depthWrite: false, depthTest: false});
      var mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = -10;
      return mesh;
    }
    this.setTexture = function(texture) {
      if (!this.skyshader) {
        this.skyshader = THREE.ShaderLib[ "cube" ];

        var skymat = new THREE.ShaderMaterial( {
          fragmentShader: this.skyshader.fragmentShader,
          vertexShader: this.skyshader.vertexShader,
          uniforms: THREE.UniformsUtils.clone(this.skyshader.uniforms),
          depthWrite: false,
          depthTest: false,
          fog: false,
          side: THREE.DoubleSide
        } );
        this.material = skymat;
        this.objects['3d'].material = skymat;
      }
      this.material.uniforms[ "tCube" ].value = texture;
    }
    this.updatePosition = function(ev) {
      var view = ev.target;
      var camera = view.camera;
      //if (camera.matrixNeedsUpdate) {
        camera.updateMatrix();
        camera.updateMatrixWorld();
      //}
      this.properties.position.setFromMatrixPosition(camera.matrixWorld);
    }
  }, elation.engine.things.generic);
});
