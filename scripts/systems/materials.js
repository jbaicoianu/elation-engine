elation.extend("engine.systems.materials", function() {
  elation.implement(this, elation.engine.systems.system);

  this.engine_start = function(ev) {
    console.log('INIT: materials');
  }
  this.engine_frame = function(ev) {
    //console.log('new frame', ev.data);
  }
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: materials');
  }
  this.shaders = {};
  this.shaderchunks = {};
  this.texturecache = {};

  this.get = function(args) {
    var materialtype = (Detector.webgl ? THREE.MeshPhongMaterial : THREE.MeshBasicMaterial);
    return new materialtype(args);
  }
  this.getTexture = function(url, repeat, mirrored) {
    if (!this.texturecache[url]) {
      this.texturecache[url] = THREE.ImageUtils.loadTexture(url);
    }
    if (repeat) {
      this.texturecache[url].wrapS = (mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);
      this.texturecache[url].wrapT = (mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);

      if (elation.utils.isArray(repeat)) {
        this.texturecache[url].repeat.set(repeat[0], repeat[1]);
      }
    }
    return this.texturecache[url];
  }
  this.addShader = function(shadername, shader) {
    this.shaders[shadername] = shader;
  }
  this.getShaderMaterial = function(shadername, uniforms, defines, lights) {
console.log(this.shaders);
    if (this.shaders[shadername]) {
      var prefix = '';
      if (defines) {
        for (var k in defines) {
          prefix += "#define " + k + " " + defines[k] + '\n';
        }
      }

      var shaderargs = {
        vertexShader: prefix + this.shaders[shadername].vertexShader,
        fragmentShader: prefix + this.shaders[shadername].fragmentShader,
        lights: (typeof lights != 'undefined' ? lights : true),
        perPixel: true
      };
		  shaderargs.uniforms = THREE.UniformsUtils.clone( this.shaders[shadername].uniforms );
      for (var k in uniforms) {
        if (shaderargs.uniforms[k]) {
          if (uniforms[k] instanceof THREE.Texture) {
            shaderargs.uniforms[k].texture = uniforms[k];
          } else {
            shaderargs.uniforms[k].value = uniforms[k];
          }
        }
      }
      return new THREE.ShaderMaterial(shaderargs);
    }
    return new THREE.MeshBasicMaterial({color: 0xcc0000});
  }
  this.buildShader = function(shadername, chunkargs) {
    console.log('MAKE IT', shadername, chunkargs);

    var vertex_parms = vertex_shader = fragment_parms = fragment_shader = "";
    var shaderargs = {
      vertexShader: THREE.ShaderLib['lambert'].vertexShader,
      fragmentShader: THREE.ShaderLib['lambert'].fragmentShader,
      lights: true,
      perPixel: true
    };

    if (chunkargs.chunks_vertex) {
      shaderargs.vertexShader = this.assembleChunks('vertex', chunkargs.chunks_vertex);
    }
    if (chunkargs.chunks_fragment) {
      shaderargs.fragmentShader = this.assembleChunks('fragment', chunkargs.chunks_fragment);
    }
    if (chunkargs.uniforms) {
      var uniforms = [];
      for (var i = 0; i < chunkargs.uniforms.length; i++) {
        var chunkname = chunkargs.uniforms[i];
        if (this.shaderchunks[chunkname] && this.shaderchunks[chunkname].uniforms) {
          uniforms.push(this.shaderchunks[chunkname].uniforms);
        } else if (THREE.UniformsLib[chunkname]) {
          uniforms.push(THREE.UniformsLib[chunkname]);
        }
      }
      shaderargs.uniforms = THREE.UniformsUtils.merge(uniforms);
    }
    this.shaders[shadername] = shaderargs;
  }

  this.addChunk = function(chunkname, chunkargs) {
    this.shaderchunks[chunkname] = chunkargs;
  }
  this.assembleChunks = function(type, chunks) {
    var chunk = ["", ""];

    for (var i = 0; i < chunks.length; i++) {
      var chunkname = chunks[i];
      if (this.shaderchunks[chunkname]) {
        if (this.shaderchunks[chunkname][type + '_pars']) {
          chunk[0] += this.shaderchunks[chunkname][type + '_pars'] + "\n";
        }
        if (this.shaderchunks[chunkname][type]) {
          chunk[1] += this.shaderchunks[chunkname][type] + "\n";
        }
      } else {
        var idxpars = chunkname + '_pars_' + type,
            idxshader = chunkname + '_' + type;
        //console.log(idxpars, THREE.ShaderChunk[idxpars]);
        //console.log(idxshader, THREE.ShaderChunk[idxshader]);
        if (THREE.ShaderChunk[idxpars]) {
          chunk[0] +=  THREE.ShaderChunk[idxpars] + "\n";
        }
        if (THREE.ShaderChunk[idxshader]) {
          chunk[1] +=  THREE.ShaderChunk[idxshader] + "\n";
        }
      }
    }
    return chunk[0] + "\nvoid main() {\n" + chunk[1] + "\n}\n";
  }
});

