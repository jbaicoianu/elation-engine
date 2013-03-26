elation.component.add("engine.things.sector", {
  postinit: function() {
    var skybox = elation.utils.arrayget(this.properties, "sector.skybox");
    var skysphere = elation.utils.arrayget(this.properties, "sector.skysphere");
    if (skybox) {
      this.createSky(true, skybox);
    } else if (skysphere) {
      this.createSky(false, skysphere);
    }
  },
  createObject3D: function() {
    var obj = new THREE.Object3D();
    var showplane = elation.utils.arrayget(this.properties, "sector.showplane");
    var showlight = elation.utils.arrayget(this.properties, "sector.showlight");
    
    if (showplane == 1) {
      var parameters = {
        color: 0x998877,
        shininess: 1,
        shading: THREE.SmoothShading,
        overdraw: true,
      };
      if (true) {
        parameters.map = elation.engine.utils.materials.getTexture("/media/space/textures/dirt.jpg", [1000, 1000] );
        parameters.normalMap = elation.engine.utils.materials.getTexture("/media/space/textures/dirt-normal.jpg", [1000, 1000] );
        //parameters.normalScale = 0.1;
        parameters.color = 0xffffff;
      }
      var repeat = 500;
/*
      parameters.map.repeat.set(repeat,repeat);
      parameters.normalMap.repeat.set(repeat,repeat);
      parameters.map.wrapS = parameters.map.wrapT = THREE.RepeatWrapping;
      parameters.normalMap.wrapS = parameters.normalMap.wrapT = THREE.RepeatWrapping;
*/

      if (this.properties.sector.heightmap) {
        parameters.displacementMap = elation.engine.utils.materials.getTexture(this.properties.sector.heightmap);
        parameters.displacementScale = 1000;
      }
      //var material = elation.space.materials.get(parameters);
      var material = new THREE.MeshPhongMaterial(parameters);
      var geometry = new THREE.PlaneGeometry( 5000, 5000, 20, 20 );
      geometry.computeFaceNormals();
      geometry.computeVertexNormals();
      geometry.computeTangents();

      obj = new THREE.Mesh(geometry, material);

      // lay plane down flat
      var rot = new THREE.Matrix4();
      rot.setRotationFromEuler(new THREE.Vector3(-Math.PI/2,0,0), 'XYZ');
      obj.geometry.applyMatrix(rot);

      obj.receiveShadow = true;
    }
    if (showlight == 1) {
      //var light = new THREE.DirectionalLight( 0xffffff, 1, 50000);
      var light = new THREE.PointLight( 0xffffff, 1, 500000000);
      light.position.set(100, 500, 100);
      //light.position.set(0, 0, 5000);
      obj.add(light);
    }
    return obj;
  },
  createSky: function(useskybox, path, format) {
    //var path = "/media/space/textures/skybox/";
    var size = 500000000;

    var skyboxargs = {
      name: 'skybox',
      type: 'generic',
      properties: {
        generic: {
          geometry: {
            type: 'cube',
              size: size,
              flipSided: true
          }
        }
      }
    };

    if (useskybox) {
      if (!format) {
        format = 'jpg';
      }
      if (path.substr(path.length-1) != '/') {
        path += '/';
      }
      var urls = [
        path + 'px' + '.' + format, path + 'nx' + '.' + format,
        path + 'py' + '.' + format, path + 'ny' + '.' + format,
        path + 'nz' + '.' + format, path + 'pz' + '.' + format
      ];
      var texturecube = THREE.ImageUtils.loadTextureCube( urls );
      texturecube.format = THREE.RGBFormat;
      var shader = THREE.ShaderLib[ "cube" ];
      shader.uniforms[ "tCube" ].texture = texturecube;

      var material = new THREE.ShaderMaterial( {
        fragmentShader: shader.fragmentShader,
        vertexShader: shader.vertexShader,
        uniforms: shader.uniforms,
        depthWrite: false,
        side: THREE.BackSide
      } );
      skyboxargs.properties.generic.geometry.type = 'cube';
      skyboxargs.properties.generic.material = material;
    } else {
      skyboxargs.properties.generic.geometry.type = 'sphere';
      skyboxargs.properties.generic.material = {
        type: 'basic',
        parameters: {
          map: elation.engine.utils.materials.getTexture(path)
        }
      };
    }
    this.sky = elation.engine.things.generic('skybox', elation.html.create(), skyboxargs);
    this.add(this.sky);
  },
}, elation.engine.things.generic);


