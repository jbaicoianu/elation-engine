elation.require('engine.external.proctree', function() {
  elation.component.add('engine.things.tree', function() {
    this.postinit = function() {
      this.defineProperties({
        'tree.textures.trunk': { type: 'string', default: 'tree.trunk1' },
        'tree.textures.leaves': { type: 'string', default: 'tree.leaves1' },

        'tree.seed': { type: 'integer' },
        'tree.segments': { type: 'integer', default: 6 },
        'tree.levels': { type: 'integer', default: 5 },

        'tree.vMultiplier': { type: 'float', default: 2.36 },
        'tree.twigScale': { type: 'float', default: 0.39 },
        'tree.initialBranchLength': { type: 'float', default: 0.49 },
        'tree.lengthFalloffFactor': { type: 'float', default: 0.85 },
        'tree.lengthFalloffPower': { type: 'float', default: 0.99 },

        'tree.clumpMax': { type: 'float', default: 0.454 },
        'tree.clumpMin': { type: 'float', default: 0.404 },
        'tree.branchFactor': { type: 'float', default: 2.45 },
        'tree.dropAmount': { type: 'float', default: -0.1 },
        'tree.growAmount': { type: 'float', default: 0.235 },
        'tree.sweepAmount': { type: 'float', default: 0.01 },
        'tree.maxRadius': { type: 'float', default: 0.139 },
        'tree.climbRate': { type: 'float', default: 0.371 },
        'tree.trunkKink': { type: 'float', default: 0.093 },
        'tree.treeSteps': { type: 'float', default: 5 },
        'tree.taperRate': { type: 'float', default: 0.947 },
        'tree.radiusFalloffRate': { type: 'float', default: 0.73 },
        'tree.twistRate': { type: 'float', default: 3.02 },
        'tree.trunkLength': { type: 'float', default: 2.4 }
      });
    }
    this.createObject3D = function() {
      var seed = this.properties.tree.seed;
      if (!seed) seed = Math.floor(10000 * Math.random());

      var myTree = new Tree({
        "seed": seed,
        "segments": this.properties.tree.segments,
        "levels": this.properties.tree.levels,
        "vMultiplier": this.properties.tree.vMultiplier,
        "twigScale": this.properties.tree.twigScale,
        "initalBranchLength": this.properties.tree.initialBranchLength,
        "lengthFalloffFactor": this.properties.tree.lengthFalloffFactor,
        "lengthFalloffPower": this.properties.tree.lengthFalloffPower,
        "clumpMax": this.properties.tree.clumpMax,
        "clumpMin": this.properties.tree.clumpMin,
        "branchFactor": this.properties.tree.branchFactor,
        "dropAmount": this.properties.tree.dropAmount,
        "growAmount": this.properties.tree.growAmount,
        "sweepAmount": this.properties.tree.sweepAmount,
        "maxRadius": this.properties.tree.maxRadius,
        "climbRate": this.properties.tree.climbRate,
        "trunkKink": this.properties.tree.trunkKink,
        "treeSteps": this.properties.tree.treeSteps,
        "taperRate": this.properties.tree.taperRate,
        "radiusFalloffRate": this.properties.tree.radiusFalloffRate,
        "twistRate": this.properties.tree.twistRate,
        "trunkLength": this.properties.tree.trunkLength
      });

      var trunkgeo = this.createTreeGeometry(myTree.verts, myTree.faces, myTree.normals, myTree.UV);
      var twiggeo = this.createTreeGeometry(myTree.vertsTwig, myTree.facesTwig, myTree.normalsTwig, myTree.uvsTwig);

      var trunkmesh = new THREE.Mesh(trunkgeo, elation.engine.materials.get(this.properties.tree.textures.trunk));

      trunkmesh.castShadow = true;
      trunkmesh.receiveShadow = true;

      var twigmesh = new THREE.Mesh(twiggeo, elation.engine.materials.get(this.properties.tree.textures.leaves));
      trunkmesh.add(twigmesh);
      twigmesh.castShadow = true;
      twigmesh.receiveShadow = true;

      return trunkmesh;
    }
    this.createTreeGeometry = function(verts, faces, normals, uvs) {
      var geo = new THREE.BufferGeometry();

      //var position = new Float32Array(faces.length * 3 * 3);
      //var normal = new Float32Array(faces.length * 3 * 3);
      //var uv = new Float32Array(faces.length * 3 * 2);
      var position = new THREE.Float32Attribute(faces.length * 3, 3);
      var normal = new THREE.Float32Attribute(faces.length * 3, 3);
      var uv = new THREE.Float32Attribute(faces.length * 3, 2);

      for (var i = 0; i < faces.length; i++) {
        var f = faces[i];
        for (var j = 0; j < f.length; j++) {
          var o = (i * 3 + j) * 3;
  //console.log((i * 3 + j) * 3, (i * 3 + j) * 3 + 1, (i * 3 + j) * 3 + 2);
          var v = verts[f[j]];
          var n = normals[f[j]];
          var u = uvs[f[j]];
          for (var k = 0; k < v.length; k++) {
            position.array[o + k] = v[k];
            normal.array[o + k] = n[k];
          }

          // uvs
          var o = (i * 3 + j) * 2;
          for (var k = 0; k < u.length; k++) {
            uv.array[o + k] = u[k];
          }
        }
      }
      geo.addAttribute('position', position);
      geo.addAttribute('normal', normal);
      geo.addAttribute('uv', uv);

      return geo;
    }
  }, elation.engine.things.generic);

  elation.engine.materials.add('tree.trunk1', new THREE.MeshPhongMaterial({
    map: elation.engine.materials.getTexture('/media/space/textures/trees/trunk1.jpg', [1, 1]),
    normalMap: elation.engine.materials.getTexture('/media/space/textures/trees/wood-normal-small.png', [4, 4]),
  }));
  elation.engine.materials.add('tree.trunk2', new THREE.MeshPhongMaterial({
    map: elation.engine.materials.getTexture('/media/space/textures/trees/trunk2.jpg', [1, 1]),
    normalMap: elation.engine.materials.getTexture('/media/space/textures/trees/wood-normal-small.png', [4, 4]),
  }));
  elation.engine.materials.add('tree.trunk3', new THREE.MeshPhongMaterial({ 
    map: elation.engine.materials.getTexture('/media/space/textures/trees/trunk3.jpg', [1, 1]) ,
    normalMap: elation.engine.materials.getTexture('/media/space/textures/trees/wood-normal-small.png', [4, 4]),
  }));
  elation.engine.materials.add('tree.trunk4', new THREE.MeshPhongMaterial({ 
    map: elation.engine.materials.getTexture('/media/space/textures/trees/trunk4.jpg', [1, 1]) ,
    normalMap: elation.engine.materials.getTexture('/media/space/textures/trees/wood-normal-small.png', [4, 4]),
  }));


  elation.engine.geometries.addgenerator("tree.generic", function() {
  });

  elation.engine.materials.add('tree.leaves1', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch1.png', [1, 1]), transparent: true }));
  elation.engine.materials.add('tree.leaves2', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch2.png', [1, 1]), transparent: true }));
  elation.engine.materials.add('tree.leaves3', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch3.png', [1, 1]), transparent: true }));
  elation.engine.materials.add('tree.leaves4', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch4.png', [1, 1]), transparent: true }));
  elation.engine.materials.add('tree.leaves5', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch5.png', [1, 1]), transparent: true }));
  elation.engine.materials.add('tree.leaves6', new THREE.MeshPhongMaterial({ map: elation.engine.materials.getTexture('/media/space/textures/trees/branch6.png', [1, 1]), transparent: true }));
});
