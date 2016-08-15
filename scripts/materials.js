elation.require(['utils.template', 'engine.external.three.three'], function() {
  elation.requireCSS('engine.materials');
  if (elation.env.isBrowser) {
    elation.template.add('engine.materials.chunk', '<div class="engine_materials_chunk style_box"><h1>{chunkname}</h1><div class="engine_materials_chunk_uniforms style_box"><h2>uniforms</h2> <ul> {#uniforms} <li><h4>{name}</h4> ({type})</li> {/uniforms} </ul></div> <div class="engine_materials_chunk_vertex style_box"><h2>vertex</h2><p>{chunk.vertex_pars}</p><p>{chunk.vertex}</p></div>  <div class="engine_materials_chunk_fragment style_box"><h2>fragment</h2><p>{chunk.fragment_pars}</p><p>{chunk.fragment}</p></div></div>');
    elation.template.add('engine.materials.chunk.uniforms', '<h3>{chunkname}</h3><ul class="engine_materials_chunk_uniform"> {#uniforms} <li><h4>{name}</h4> <input value="{value}"> ({type})</li> {/uniforms} </ul>');
    elation.template.add('engine.materials.chunk.vertex', '<h3>{chunkname}</h3><p elation:component="engine.materials.editor" elation:args.chunkname="{chunkname}" elation:args.chunktype="vertex" {?params}elation:args.params=1{/params} class="engine_materials_chunk_vertex">{content}</p>');
    elation.template.add('engine.materials.chunk.fragment', '<h3>{chunkname}</h3><p elation:component="engine.materials.editor" elation:args.chunkname="{chunkname}" elation:args.chunktype="fragment" {?params}elation:args.params=1{/params} class="engine_materials_chunk_fragment">{content}</p>');
  }

  elation.extend("engine.materials", new function() {

    this.shaders = {};
    this.shaderdefs = {};
    this.shaderchunks = {};
    this.texturecache = {};
    this.materialinstances = {};
    this.materiallibrary = {};

    this.get = function(args) {
      if (elation.utils.isString(args) && this.materiallibrary[args]) {
        return this.materiallibrary[args].clone();
      } else {
        var materialtype = THREE.MeshPhongMaterial; //(Detector.webgl ? THREE.MeshPhongMaterial : THREE.MeshBasicMaterial);
        return new materialtype(args);
      }
    }
    this.add = function(materialname, materialargs) {
      if (materialargs instanceof THREE.Material) {
        this.materiallibrary[materialname] = materialargs;
      } else {
        this.materiallibrary[materialname] = this.get(materialargs);
      }
      elation.events.fire({element: this, type: 'engine_material_add', data: { name: materialname, material: this.materiallibrary[materialname] } });
    }
    this.getTexture = function(url, repeat, mirrored) {
      if (elation.env.isNode) return;
      if (!this.texturecache[url]) {
        if (url.match(/^data:/)) {
          var img = document.createElement('IMG');
          img.src = url;
          this.texturecache[url] = new THREE.Texture(img);
          //this.texturecache[url].needsUpdate = true;
          this.texturecache[url].sourceFile = url;
        } else if (url.match(/\.dds$/)) {
          /*
          var ddsloader = new THREE.DDSLoader();
          this.texturecache[url] = ddsloader.load(url);
          //this.texturecache[url].flipY = false;
          */
        } else {
          THREE.ImageUtils.crossOrigin = '';
          var texture = this.texturecache[url] = THREE.ImageUtils.loadTexture(url, undefined, elation.bind(this, function() {
            var image = texture.image;
            image.crossOrigin = '';
            if (!this.isPowerOfTwo(image.width) || !this.isPowerOfTwo(image.height)) {
              // Scale up the texture to the next highest power of two dimensions.
              var canvas = document.createElement("canvas");
              canvas.width = this.nextHighestPowerOfTwo(image.width);
              canvas.height = this.nextHighestPowerOfTwo(image.height);
              var ctx = canvas.getContext("2d");
              ctx.drawImage(image, 0, 0, image.width, image.height, 0, 0, canvas.width, canvas.height);
              texture.image = canvas;
              //texture.needsUpdate = true;
            }

            elation.events.fire({element: texture, type: 'engine_texture_load'}); 
          }));
          //elation.events.fire({ type: 'resource_load_start', data: { type: 'image', image: this.texturecache[url].image } });
        }
        if (!this.texturecache[url]) {
          this.texturecache[url] = elation.engine.materials.getTexture('/media/space/textures/uvtest.png', [1, 1]);
        }
        this.texturecache[url].anisotropy = 16;
        elation.events.add(this.texturecache[url], 'update', function(ev) { 
          elation.events.fire({ type: 'engine_texture_load', element: ev.target }); 
          //elation.events.fire({ type: 'resource_load_finish', data: { type: 'image', image: ev.target.image } });
        });
      }
      if (repeat) {
        this.setTextureRepeat(this.texturecache[url], repeat, mirrored);
      }
      return this.texturecache[url];
    }
    this.setTextureRepeat = function(texture, repeat, mirrored) {
      texture.wrapS = (mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);
      texture.wrapT = (mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping);

      if (repeat instanceof THREE.Vector2) {
        texture.repeat.copy(repeat);
      } else if (elation.utils.isArray(repeat)) {
        texture.repeat.set(repeat[0], repeat[1]);
      }
    }
    this.isPowerOfTwo = function(num) {
      return (num & (num - 1)) == 0;
    }
    this.nextHighestPowerOfTwo = function(num) {
      num--;
      for (var i = 1; i < 32; i <<= 1) {
        num = num | num >> i;
      }
      return num + 1;
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
        if (this.shaders[shadername].attributes) {
          shaderargs.attributes = this.shaders[shadername].attributes;
        }
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
      if (chunkargs.attributes) {
        shaderargs.attributes = attributes;
        var attributes = [];
        for (var i = 0; i < chunkargs.attributes.length; i++) {
          var chunkname = chunkargs.attributes[i];
          if (this.shaderchunks[chunkname] && this.shaderchunks[chunkname].attributes) {
            attributes.push(this.shaderchunks[chunkname].attributes);
          }
        }
        shaderargs.attributes = THREE.UniformsUtils.merge(attributes);
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
      chunk[0] = THREE.ShaderChunk['common'];

      for (var i = 0; i < chunks.length; i++) {
        var chunkname = chunks[i];
        var chunkpart = ["", ""];
        if (this.shaderchunks[chunkname]) {
          if (this.shaderchunks[chunkname]['common_pars']) {
            chunkpart[0] += this.shaderchunks[chunkname]['common_pars'] + "\n";
          }
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
      var root = elation.html.create({type: 'div', classname: 'engine_material style_box'});
      elation.ui.window({title: shadername, append: document.body, content: root});
    
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
    this.getTextureLabel = function(text, fontsize, color, font, background) {
      var c = elation.html.create('canvas');
      var ctx = c.getContext('2d');

      if (fontsize === undefined) fontsize = 32;
      if (color === undefined) color = '#fff';
      if (font === undefined) font = 'serif';
      if (background === undefined) background = 'rgba(0,0,0,0)';

      ctx.font = fontsize + 'px ' + font;
      var size = ctx.measureText(text);
      c.width = size.width;
      c.height = fontsize;
      // changing width resets context, so reset size
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, c.width, c.height);

      ctx.font = fontsize + 'px ' + font;
      ctx.fillStyle = color;
      ctx.fillText(text, 0, fontsize - fontsize/6);
      ctx.strokeText(text, 0, fontsize - fontsize/6);

  /*
  document.body.appendChild(c);
  c.style.position = 'fixed';
  c.style.top = c.style.left = '50%';
  c.style.border = '2px solid red';
  c.style.zIndex = 4500;
  */
      var tex = new THREE.Texture(c);
      tex.needsUpdate = true;
      return tex;
    }
  });

  elation.component.add("engine.materials.editor", function() {
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
  if (elation.env.isBrowser) {
    //elation.engine.materials.add('uvtest', new THREE.MeshPhongMaterial({map: elation.engine.materials.getTexture('/media/space/textures/uvtest.png', [1, 1])}));
  }
  elation.engine.materials.add('normal', new THREE.MeshNormalMaterial());
});
