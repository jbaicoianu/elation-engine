elation.template.add('engine.materials.chunk', '<div class="engine_materials_chunk style_box"><h1>{chunkname}</h1><div class="engine_materials_chunk_uniforms style_box"><h2>uniforms</h2> <ul> {#uniforms} <li><h4>{name}</h4> ({type})</li> {/uniforms} </ul></div> <div class="engine_materials_chunk_vertex style_box"><h2>vertex</h2><p>{chunk.vertex_pars}</p><p>{chunk.vertex}</p></div>  <div class="engine_materials_chunk_fragment style_box"><h2>fragment</h2><p>{chunk.fragment_pars}</p><p>{chunk.fragment}</p></div></div>');
elation.template.add('engine.materials.chunk.uniforms', '<h3>{chunkname}</h3><ul class="engine_materials_chunk_uniform"> {#uniforms} <li><h4>{name}</h4> <input value="{value}"> ({type})</li> {/uniforms} </ul>');
elation.template.add('engine.materials.chunk.vertex', '<h3>{chunkname}</h3><p elation:component="engine.utils.materials.editor" elation:args.chunkname="{chunkname}" elation:args.chunktype="vertex" {?params}elation:args.params=1{/params} class="engine_materials_chunk_vertex">{content}</p>');
elation.template.add('engine.materials.chunk.fragment', '<h3>{chunkname}</h3><p elation:component="engine.utils.materials.editor" elation:args.chunkname="{chunkname}" elation:args.chunktype="fragment" {?params}elation:args.params=1{/params} class="engine_materials_chunk_fragment">{content}</p>');

elation.extend("engine.utils.materials", new function() {

  this.shaders = {};
  this.shaderdefs = {};
  this.shaderchunks = {};
  this.texturecache = {};
  this.materialinstances = {};

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
    if (this.shaders[shadername]) {
      var prefix = '';

      var shaderargs = {
        vertexShader: this.shaders[shadername].vertexShader,
        fragmentShader: this.shaders[shadername].fragmentShader,
        //lights: (typeof lights != 'undefined' ? lights : false),
        //perPixel: true, fog: true, map: true
      };
      if (defines) {
        shaderargs.defines = defines;
      }
		  shaderargs.uniforms = THREE.UniformsUtils.clone( this.shaders[shadername].uniforms );
      for (var k in uniforms) {
        if (shaderargs.uniforms[k]) {
          shaderargs.uniforms[k].value = uniforms[k];
        }
      }
      var shader = new THREE.ShaderMaterial(shaderargs);
      // Store reference to material instance so we can refresh it if needed later
      if (!this.materialinstances[shadername]) this.materialinstances[shadername] = [];
      this.materialinstances[shadername].push(shader);
      return shader;
    }
    return new THREE.MeshBasicMaterial({color: 0xcc0000});
  }
  this.buildShader = function(shadername, chunkargs) {
    console.log('MAKE IT', shadername, chunkargs);
    this.shaderdefs[shadername] = chunkargs;

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
  this.setChunk = function(chunkname, chunktype, value) {
    if (!this.shaderchunks[chunkname]) {
      var chunkargs = {};
      chunkargs[chunktype] = value;
      this.addChunk(chunkname, chunkargs);
    } else {
      this.shaderchunks[chunkname][chunktype] = value;
    }
  }
  this.assembleChunks = function(type, chunks) {
    var chunk = ["", ""];

    for (var i = 0; i < chunks.length; i++) {
      var chunkname = chunks[i];
      var chunkpart = ["", ""];
      if (this.shaderchunks[chunkname]) {
        if (this.shaderchunks[chunkname][type + '_pars']) {
          chunkpart[0] += this.shaderchunks[chunkname][type + '_pars'] + "\n";
        }
        if (this.shaderchunks[chunkname][type]) {
          chunkpart[1] += this.shaderchunks[chunkname][type] + "\n";
        }
      }
      var idxpars = chunkname + '_pars_' + type,
          idxshader = chunkname + '_' + type;
      //console.log(idxpars, THREE.ShaderChunk[idxpars]);
      //console.log(idxshader, THREE.ShaderChunk[idxshader]);
      if (chunkpart[0] == "" && THREE.ShaderChunk[idxpars]) {
        chunkpart[0] +=  THREE.ShaderChunk[idxpars] + "\n";
      }
      if (chunkpart[1] == "" && THREE.ShaderChunk[idxshader]) {
        chunkpart[1] +=  THREE.ShaderChunk[idxshader] + "\n";
      }
      chunk[0] += chunkpart[0];
      chunk[1] += chunkpart[1];
    }
    return chunk[0] + "\nvoid main() {\n" + chunk[1] + "\n}\n";
  }
  this.displaychunks = function(shaders) {
    /*
    if (!chunks) chunks = this.shaderchunks;

    for (var k in chunks) {
      var chunkwrapper = elation.html.create({tag: 'div', className: 'engine_materials_chunk', append: root});
      var tplargs = {
        chunkname: k,
        chunk: chunks[k],
        uniforms: []
      };
      for (var j in chunks[k].uniforms) {
        chunks[k].uniforms[j].name = j;
        tplargs.uniforms.push(chunks[k].uniforms[j]);
      }
      chunkwrapper.innerHTML = elation.template.get("engine.materials.chunk", tplargs);
console.log(chunks[k], chunks[k].uniforms);
    }
    */
  }
  this.displayall = function(shaders, material) {
    if (!shaders) shaders = this.shaderdefs;
    for (var k in shaders) {
      this.display(k, material);
    }
  }
  this.display = function(shadername, material) {
    var shaderdef = this.shaderdefs[shadername];
    //console.log(shadername, shaderdef, material);
    var root = elation.html.create({type: 'div', classname: 'engine_material style_box', append: document.body});
    elation.ui.window(null, root, {title: shadername});
  
    var uniformcontainer = elation.html.create({classname: 'engine_materials_uniforms style_box', content: '<h2>Uniforms</h2>', append: root});
    var vertexcontainer = elation.html.create({classname: 'engine_materials_vertex style_box', content: '<h2>Vertex Shader</h2>', append: root});
    var fragmentcontainer = elation.html.create({classname: 'engine_materials_fragment style_box', content: '<h2>Fragment Shader</h2>', append: root});

    var vertexpars = elation.html.create({classname: 'engine_materials_shader_params', append: vertexcontainer});
    var vertexshader = elation.html.create({classname: 'engine_materials_shader_main', append: vertexcontainer});
    var fragmentpars = elation.html.create({classname: 'engine_materials_shader_params', append: fragmentcontainer});
    var fragmentshader = elation.html.create({classname: 'engine_materials_shader_main', append: fragmentcontainer});

    /* uniforms */
    for (var j in shaderdef.uniforms) {
      var chunkname = shaderdef.uniforms[j];
      var tplargs = {
        shadername: shadername,
        chunkname: chunkname,
        uniforms: []
      };
      if (this.shaderchunks[chunkname]) {
        for (var l in this.shaderchunks[chunkname].uniforms) {
          var uniform = this.shaderchunks[chunkname].uniforms[l];
          uniform.name = l;
          if (material && material.uniforms[l]) {
            var uval = material.uniforms[l].value;
            if (uniform.type == 'c') uniform.value = '#' + uval.getHexString();
            else if (uniform.type == 'v2') uniform.value = uval.x + ',' + uval.y;
            else if (uniform.type == 'v3') uniform.value = uval.x + ',' + uval.y + ',' + uval.z;
            else if (uniform.type == 'v4') uniform.value = uval.x + ',' + uval.y + ',' + uval.z + ',' + uval.w;
            else uniform.value = material.uniforms[l].value;
          }
          tplargs.uniforms.push(uniform);
        }
      } else {
        if (THREE.UniformsLib[chunkname]) {
          for (var l in THREE.UniformsLib[chunkname]) {
            var uniform = THREE.UniformsLib[chunkname][l];
            uniform.name = l;
            if (material && material.uniforms[l]) {
              var uval = material.uniforms[l].value;
              if (uniform.type == 'c') uniform.value = '#' + uval.getHexString();
              else if (uniform.type == 'v2') uniform.value = uval.x + ',' + uval.y;
              else if (uniform.type == 'v3') uniform.value = uval.x + ',' + uval.y + ',' + uval.z;
              else if (uniform.type == 'v4') uniform.value = uval.x + ',' + uval.y + ',' + uval.z + ',' + uval.w;
              else uniform.value = material.uniforms[l].value;
            }
            tplargs.uniforms.push(uniform);
          }
        }
      }
      elation.html.create({tag: 'div', classname: 'engine_materials_chunk', append: uniformcontainer, content: elation.template.get("engine.materials.chunk.uniforms", tplargs)});
    }
    /* vertex */
    for (var j in shaderdef.chunks_vertex) {
      var chunkname = shaderdef.chunks_vertex[j];
      var tplargs = {
        shadername: shadername,
        chunkname: chunkname
      };
      if (this.shaderchunks[chunkname]) {
        tplargs.vertex_pars = this.shaderchunks[chunkname].vertex_pars;
        tplargs.vertex = this.shaderchunks[chunkname].vertex;
      } 
      if (!tplargs.vertex_pars && THREE.ShaderChunk[chunkname + '_pars_vertex']) {
        tplargs.vertex_pars = THREE.ShaderChunk[chunkname + '_pars_vertex'];
      }
      if (!tplargs.vertex && THREE.ShaderChunk[chunkname + '_vertex']) {
        tplargs.vertex = THREE.ShaderChunk[chunkname + '_vertex'];
      }
      if (tplargs.vertex_pars) {
        tplargs.content = tplargs.vertex_pars;
        tplargs.params = true;
        elation.html.create({tag: 'div', classname: 'engine_materials_chunk', append: vertexpars, content: elation.template.get("engine.materials.chunk.vertex", tplargs)});
      }
      if (tplargs.vertex) {
        tplargs.content = tplargs.vertex;
        tplargs.params = false;
        elation.html.create({tag: 'div', classname: 'engine_materials_chunk', append: vertexshader, content: elation.template.get("engine.materials.chunk.vertex", tplargs)});
      }
    }
    /* fragment */
    for (var j in shaderdef.chunks_fragment) {
      var chunkname = shaderdef.chunks_fragment[j];
      var tplargs = {
        shadername: shadername,
        chunkname: chunkname
      };
      if (this.shaderchunks[chunkname]) {
        tplargs.fragment_pars = this.shaderchunks[chunkname].fragment_pars;
        tplargs.fragment = this.shaderchunks[chunkname].fragment;
      }
      if (!tplargs.fragment_pars && THREE.ShaderChunk[chunkname + '_pars_fragment']) {
        tplargs.fragment_pars = THREE.ShaderChunk[chunkname + '_pars_fragment'];
      }
      if (!tplargs.fragment && THREE.ShaderChunk[chunkname + '_fragment']) {
        tplargs.fragment = THREE.ShaderChunk[chunkname + '_fragment'];
      }
      if (tplargs.fragment_pars) {
        tplargs.content = tplargs.fragment_pars;
        tplargs.params = true;
        elation.html.create({tag: 'div', classname: 'engine_materials_chunk', append: fragmentpars, content: elation.template.get("engine.materials.chunk.fragment", tplargs)});
      }
      if (tplargs.fragment) {
        tplargs.content = tplargs.fragment;
        tplargs.params = false;
        elation.html.create({tag: 'div', classname: 'engine_materials_chunk', append: fragmentshader, content: elation.template.get("engine.materials.chunk.fragment", tplargs)});
      }
    }
    elation.component.init();
    var editors = elation.find('.engine_materials_editor', this.container);
    for (var i = 0; i < editors.length; i++) {
      var component = elation.component.fetch(editors[i]);
      elation.events.add(component, 'engine_material_change', this);
    }
  }
  this.handleEvent = elation.events.handleEvent;
  this.engine_material_change = function(ev) {
    var editor = ev.target;

    var chunktype = editor.chunktype + (editor.params ? '_pars' : '');
    this.setChunk(editor.chunkname, chunktype, editor.content);

    // FIXME - need some sort of shader pre-compile check to make sure it's valid before we start using it in the scene
    for (var k in this.shaderdefs) {
      var deftype = 'chunks_' + editor.chunktype;
      if (this.shaderdefs[k][deftype].indexOf(editor.chunkname) != -1) {
        this.buildShader(k, this.shaderdefs[k]);

        if (this.materialinstances[k]) {
          for (var j = 0; j < this.materialinstances[k].length; j++) {
            this.materialinstances[k][j].fragmentShader = this.shaderdef.fragmentShader;
            this.materialinstances[k][j].vertexShader = this.shaderdef.vertexShader;
            this.materialinstances[k][j].needsUpdate = true; 
          }
        }
      }
    }
  }
});

elation.component.add("engine.utils.materials.editor", function() {
  this.changetimeout = 500;

  this.init = function() {
    this.chunkname = this.args.chunkname;
    this.chunktype = this.args.chunktype;
    this.params = this.args.params || false;
    elation.html.addclass(this.container, "engine_materials_editor");
    //this.container.contentEditable = true;
    this.container.spellcheck = false;
    this.content = this.container.innerText;
    elation.events.add(this.container, "click,focus,blur,keyup", this);
  }
  this.change = function() {
    var newtext = this.container.innerText;
    if (newtext != this.content) {
      console.log('cool', newtext);
      this.content = newtext;
      elation.events.fire({element: this, type: 'engine_material_change', data: newtext});
    }
  }
  this.click = function(ev) {
    this.container.style.width = this.container.scrollWidth + 'px';
    this.container.contentEditable = true;
    this.container.focus();
  }
  this.focus = function(ev) {
    //document.designMode = 'on';
  }
  this.blur = function(ev) {
    //document.designMode = 'off';
    this.change();
    this.container.style.width = 'auto';
    this.container.contentEditable = false;
  }
  this.keyup = function(ev) {
    if (this.changetimer) clearTimeout(this.changetimer);
    this.changetimer = setTimeout(elation.bind(this, this.change), this.changetimeout);
  }
});
