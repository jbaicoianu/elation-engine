elation.require([], function() {
  /** 
   * Geometry Generators
   */
  elation.extend("engine.geometries", new function() {
    this.generators = {
      /** 
       * Takes an array of geometries and merges them into one
       * @param genargs {array}
       */
      'merge': function(genargs) {
        var geom = new THREE.Geometry();
        for (var i = 0; i < genargs.length; i++) {
          if (genargs[i]) {
            THREE.GeometryUtils.merge(geom, elation.engine.geometries.getmesh(genargs[i]));
          }
        }
        return geom;
      },
      /** 
       * Flattens a THREE.Object3D and its object heirarchy into a single geometry
       * @param genargs {object}
       */
      'shrinkwrap': function(genargs) {
        var obj = genargs.obj;
        var geometry = genargs.geometry;
        if (typeof geometry == 'undefined') {
          geometry = new THREE.Geometry();
        }
        if (obj instanceof THREE.Mesh) {
          THREE.GeometryUtils.merge(geometry, obj);
        }
        if (obj.children.length > 0) {
          for (var i = 0; i < obj.children.length; i++) {
            elation.engine.geometries.generate('shrinkwrap', {obj: obj.children[i], geometry: geometry});
          }
        }
        return geometry;
      },
      /** 
       * Repeats the specified geometry a number of times with a configurable offset
       * @param genargs {object}
       * @param genargs.geometry {THREE.Geometry|THREE.Mesh}
       * @param genargs.repeat {integer}
       * @param genargs.offset {float}
       * @param genargs.axis {THREE.Vector3}
       * @param genargs.relativeoffset {float}
       */
      'array': function(genargs) {
        var geom = new THREE.Geometry();
        if (genargs.geometry) {
          var base = elation.engine.geometries.getmesh(genargs.geometry);
          var axis = genargs.axis || new THREE.Vector3(1, 0, 0);
          axis.normalize();
          var repeat = genargs.repeat || 1;
          var offset = 0;
          if (genargs.offset) {
            offset = genargs.offset;
          } else if (genargs.relativeoffset) {
            // TODO - relative offset should get the bbox from the base geometry, project it onto the axis, and multiply by the provided scalar
          }
          for (var i = 0; i < repeat; i++) {
            base.position.copy(axis).multiplyScalar(i * offset);
            THREE.GeometryUtils.merge(geom, base);
          }
        }
        return geom;
      }
    };
    this.meshes = {};

    /** 
     * Call the specified generator, and return either a Geometry or a Mesh, depending on args
     * @param gen {string|array}
     * @param genargs {object}
     * @param meshargs {object}
     * @returns {THREE.Geometry|THREE.Mesh}
     */
    this.generate = function(gen, genargs, meshargs) {
      var geom = false;
      var genname = gen;
      if (elation.utils.isArray(gen)) {
        meshargs = gen[2];
        genargs = gen[1];
        genname = gen[0];
      }
      if (typeof this.generators[genname] == 'function') {
        geom = this.generators[genname](genargs);
      }
      if (geom && meshargs) {
        return this.getmesh(geom, meshargs);
      }
      return geom;
    }
    /** 
     * Register a new generator function
     * @param genname {string}
     * @param genfunc {function}
     */
    this.addgenerator = function(genname, genfunc) {
      this.generators[genname] = genfunc;
    }
    /** 
     * Returns a mesh with the given parameters set
     * Can take either a generator command (array), a Mesh, or a Geometry
     * @param geometry {array|THREE.Mesh|THREE.Geometry}
     * @param genfunc {function}
     * @returns {THREE.Mesh}
     */
    this.getmesh = function(geometry, meshargs) {
      var mesh = false;
      if (elation.utils.isArray(geometry)) {
        geometry = elation.engine.geometries.generate(geometry);
      } 
      if (geometry instanceof THREE.Mesh) {
        mesh = geometry;
      } else if (geometry instanceof THREE.Geometry) {
        mesh = new THREE.Mesh(geometry);
      }
      if (meshargs) {
        for (var k in meshargs) {
          if (mesh[k] && typeof mesh[k].copy == 'function') {
            mesh[k].copy(meshargs[k]);
          } else {
            mesh[k] = meshargs[k];
          }
        }
      }
      return mesh;
      
    }
    this.setMesh = function(name, mesh) {
      this.meshes[name] = mesh;
    }
    this.loadMeshFromURL = function(name, url, type) {
      this.meshes[name] = new THREE.Group();
      if (typeof THREE.ColladaLoader == 'undefined') {
        // If the loader hasn't been initialized yet, fetch it!
        THREE.ColladaLoader = false;
        elation.require('engine.external.three.ColladaLoader', elation.bind(this, this.loadMeshFromURL, name, url, type));
      } else if (THREE.ColladaLoader === false) {
        setTimeout(elation.bind(this, this.loadMeshFromURL, name, url, type), 100);
      } else {
        var loader = new THREE.ColladaLoader();
        var xhr = loader.load(url, elation.bind(this, this.handleMeshLoadCollada, name, url));
        elation.events.fire({ type: 'resource_load_start', element: this, data: { type: 'model', url: url } });
      }
      return this.meshes[name];
    }
    this.handleMeshLoadCollada = function(name, url, data) {
      //this.meshes[name] = data.scene;
      this.meshes[name].add(data.scene);
      //data.scene.rotation.x = -Math.PI/2;
      //data.scene.rotation.z = Math.PI;
/*
      data.scene.traverse(function(n) {
        if (n instanceof THREE.Mesh) {
          var geo = new THREE.BufferGeometry().fromGeometry(n.geometry);
          n.geometry = geo;
        }
      });
*/
      elation.events.fire({ type: 'resource_load_finish', element: this, data: { type: 'model', url: url } });
    }
    this.getMesh = function(name) {
      return this.meshes[name];
    }
    this.getMeshGeometry = function(name) {
      if (this.meshes[name] && this.meshes[name] instanceof THREE.Mesh) {
        return this.meshes[name].geometry;
      }
    }
    this.getMeshMaterial = function(name) {
      if (this.meshes[name] && this.meshes[name] instanceof THREE.Mesh) {
        return this.meshes[name].material;
      }
    }
  });

});
