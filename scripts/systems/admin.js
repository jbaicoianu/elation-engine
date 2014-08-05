elation.require([
  "engine.external.three.FlyControls",
  "engine.external.three.OrbitControls",
  "engine.external.three.TransformControls",
  //"engine.external.highlight",
  "engine.things.manipulator",
  "ui.accordion",
  "ui.buttonbar",
  "ui.slider",
  "ui.combobox",
  "ui.select",
  "ui.tabs",
  //"ui.list",
  "ui.grid",
  "ui.panel",
  "ui.treeview",
  "ui.window",
  "ui.indicator",
  "ui.contextmenu",
  "ui.toolbox",
  "ui.label",
]);

elation.template.add('engine.systems.admin.scenetree.thing', '<span class="engine_thing">{name}</span> ({type})');
elation.template.add('engine.systems.admin.inspector.property', '{?children}<span>{name}</span>{:else}<label for="engine_admin_inspector_properties_{fullname}">{name}</label><input id="engine_admin_inspector_properties_{fullname}" value="{value}">{/children}');
elation.template.add('engine.systems.admin.inspector.object', '<span class="engine_thing_object engine_thing_object_{type}">{object.id} ({type})</span>');
elation.template.add('engine.systems.admin.inspector.function', '<span class="engine_thing_function{?function.own} engine_thing_function_own{/function.own}" title="this.{function.name} = {function.content}">{function.name}</span>');

elation.template.add('engine.systems.admin.addthing', 'Add new <select name="type" data-elation-component="ui.select" data-elation-args.items="{thingtypes}"></select> named <input name="name"> <input type="submit" value="add">');
elation.template.add('engine.systems.admin.definething', '<input name="thingtype" placeholder="type name"> <textarea name="thingdef">function() {}</textarea> <input type="submit">');
elation.template.add('engine.systems.admin.assets.material', '<div data-elation-component="engine.systems.admin.assets.material" data-elation-args.materialname="{name}"><data class="elation-args"></data>{name}</div>');
elation.template.add('engine.systems.admin.assets.geometry', '<div data-elation-component="engine.systems.admin.assets.geometry" data-elation-args.geometryname="{name}"><data class="elation-args"></data>{name}</div>');

elation.extend("engine.systems.admin", function(args) {
  elation.implement(this, elation.engine.systems.system);

  this.cameraactive = true;

  this.system_attach = function(ev) {
    console.log('INIT: admin');

    elation.html.addclass(this.container, "engine_admin");
    this.world = this.engine.systems.world;

    //this.inspector = elation.engine.systems.admin.inspector('admin', elation.html.create({append: document.body}), {engine: this.engine});
    this.scenetree = elation.engine.systems.admin.scenetree(null, elation.html.create({append: document.body}), {world: this.world, admin: this});
    this.assets = elation.engine.systems.admin.assets(null, elation.html.create({append: document.body}), {world: this.world, admin: this});
    this.worldcontrol = elation.engine.systems.admin.worldcontrol(null, elation.html.create({append: document.body}), {engine: this.engine});

  }
  this.engine_frame = function(ev) {
    /* FIXME - silly hack! */
    if ( this.cameraactive && !this.admincontrols) {
      this.createCamera();

			this.engine.systems.controls.addCommands('admin', {
				'add_thing': elation.bind(this, function(ev) { if (ev.value == 1) { this.scenetree.addItem(); }}),
/*
				'move_left': elation.bind(this, this.moveleft),
				'move_right': elation.bind(this, this.moveright),
				'move_forward': elation.bind(this, this.moveforward),
				'move_back': elation.bind(this, this.moveback),
*/
			});
			this.engine.systems.controls.addBindings('admin', {'keyboard_ctrl_a': 'add_thing'});
			this.engine.systems.controls.activateContext('admin');
    } else if (this.cameraactive) {
      this.admincontrols.update(ev.data.delta);
    }
  }
  this.createCamera = function() {
    var render = this.engine.systems.render;
    if (render.views['main']) {
      var view = render.views['main'];
      this.orbitcontrols = new THREE.OrbitControls(view.camera, view.container);
      this.orbitcontrols.rotateUp(-Math.PI/4);
      this.orbitcontrols.rotateLeft(-Math.PI/4);
      this.orbitcontrols.dollyOut(25);
      this.orbitcontrols.userPanSpeed = 10;
      this.orbitcontrols.keyPanSpeed = 100;
      this.orbitcontrols.noKeys = true;

			elation.events.add(this.orbitcontrols, 'change', elation.bind(this, this.controls_change));

      this.flycontrols = new THREE.FlyControls(view.camera, view.container);
      this.flycontrols.movementSpeed = 10;
      this.flycontrols.rollSpeed = Math.PI/4;
      this.flycontrols.dragToLook = true;

			elation.events.add(this.flycontrols, 'change', elation.bind(this, this.controls_change));

      this.toggleControls();
  
      this.admincontrols.update(0);
      this.cameraactive = true;

      elation.events.add(render.views['main'].container, 'dragenter,dragover,drop', this);
			elation.events.add(null, 'engine_control_capture,engine_control_release', this);
    }
  }
  this.setCameraActive = function(active) {
    this.cameraactive = active;
    if (active) this.admincontrols.enabled = true;
    else this.admincontrols.enabled = false;
  }
  this.toggleControls = function() {
    if (this.admincontrols) {
      this.admincontrols.enabled = false;
    }
    if (this.admincontrols === this.orbitcontrols) {
      this.admincontrols = this.flycontrols;
    } else {
      this.admincontrols = this.orbitcontrols;
    }
    this.admincontrols.enabled = true;
  }
  this.dragenter = function(ev) {
    this.dragkeystate = {
      altKey: ev.altKey,
      ctrlKey: ev.ctrlKey,
      shiftKey: ev.shiftKey,
      metaKey: ev.metaKey,
    };
  }
  this.dragover = function(ev) {
    //ev.stopPropagation();
    ev.preventDefault();

    for (var k in this.dragkeystate) {
      this.dragkeystate[k] = ev[k];
    }
  }
  this.drop = function(ev) {
    ev.stopPropagation();
    ev.preventDefault();

    // Handle drag/drop for textures
    if (ev.dataTransfer.files.length > 0) {
      var f = ev.dataTransfer.files[0];
      if (f.type.indexOf('image') == 0) {
        var reader = new FileReader();
        reader.onload = elation.bind(this, function(ev) {
          var tex = elation.engine.materials.getTexture(ev.target.result);

          if (this.scenetree.hoverthing) {
            if (this.dragkeystate.ctrlKey) {
              this.scenetree.hoverthing.value.set('textures.normalMap', tex, true);
            } else {
              this.scenetree.hoverthing.value.set('textures.map', tex, true);
            }
          }
        });
        reader.readAsDataURL(f);
      }
    } else {
      var materialname = ev.dataTransfer.getData('-elation-material');
      if (materialname) {
        var material = elation.engine.materials.get(materialname);
        if (material) {
          //this.scenetree.hoverthing.value.set('textures.map', tex, true);
        }
      }
    }
  }
	this.controls_change = function(ev) {
		this.engine.systems.render.dirty = true;
	}
	this.engine_control_capture = function(ev) {
		this.admincontrols.enabled = false;
	}
	this.engine_control_release = function(ev) {
		this.admincontrols.enabled = true;
	}
});
elation.component.add("engine.systems.admin.scenetree", function() {
  this.init = function() {
    this.world = this.args.world;
    this.admin = this.args.admin;
    this.engine = this.world.engine;

    elation.events.add(this.world, 'engine_thing_create,world_thing_add,world_thing_remove', this);
    this.create();

    //this.cameratoggle = elation.ui.button(null, elation.html.create({tag: 'button', append: this.window.titlebar}), {label: '🔁'});
    //elation.events.add(this.cameratoggle, "ui_button_click", elation.bind(this, function() { this.admin.toggleControls(); }));

  }
  this.create = function() {
    var title = elation.html.create({tag: 'h2'});
    var panel = elation.ui.panel({append: title, orientation: 'horizontal'});
    var overrides = this.world.listLocalOverrides();
/*
    title.innerHTML = "Scene: ";
    var select = elation.ui.select(null, elation.html.create({tag: 'span', append: title}), {items: overrides, selected: this.world.rootname}, {ui_select_change: elation.bind(this, this.changeScene)});
*/

    var label = elation.ui.label({label: 'Scene:', append: panel});
    this.sceneselect = elation.ui.select({
        append: panel,
        items: overrides,
        selected: this.world.rootname,
        events: {
          ui_select_change: elation.bind(this, this.changeScene)
        }
      });
    var createbutton = elation.ui.button({
        append: panel,
        label: 'New',
        events: {
          click: elation.bind(this, this.createScene)
        }
      });
    

    this.window = elation.ui.window(null, elation.html.create({tag: 'div', classname: 'style_box engine_admin_scenetree', append: document.body}), {title: title, controls: false});
    this.window.setcontent(this.container);
    //elation.html.addclass(this.container, 'engine_admin_scenetree style_box');

    this.treeview = elation.ui.treeview(null, elation.html.create({tag: 'div', classname: 'engine_admin_scenetree_list', append: this.container}), {
      items: this.world.children,
      attrs: {
        children: 'children',
        label: 'id',
        visible: 'properties.pickable',
        itemtemplate: 'engine.systems.admin.scenetree.thing'
      }
    });
    this.toolbar = elation.ui.buttonbar(null, elation.html.create({tag: 'div', classname: 'engine_admin_scenetree_toolbar'}), {
      buttons: [
        {
          label: '⊙',
          events: { click: elation.bind(this, this.centerItem) }
        },
        { 
          label: '+',
          events: { click: elation.bind(this, this.addItem) }
        },
        {
          label: 'x',
          events: { click: elation.bind(this, this.removeItem) }
        }
      ]
    });
    elation.events.add(this.treeview, 'ui_treeview_select,ui_treeview_hover', this);
    // TODO - object hover/selection should be made available when a specific selection mode is enabled
    /*
    elation.events.add(this, 'mouseover', elation.bind(this, function(ev) {
      if (ev.data && mouseevents.data.material) {
        var materials = (ev.data.material instanceof THREE.MeshFaceMaterial ? ev.data.material.materials : [ev.data.material]);
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].emissive) {
            materials[i].emissive.setHex(0x333300);
          }
        }
      }
    }));
    elation.events.add(this, 'mouseout', elation.bind(this, function(ev) {
      if (ev.data && ev.data.material) {
        var materials = (ev.data.material instanceof THREE.MeshFaceMaterial ? ev.data.material.materials : [ev.data.material]);
        for (var i = 0; i < materials.length; i++) {
          if (materials[i].emissive) {
            materials[i].emissive.setHex(0x000000);
          }
        }
      }
    }));
    */

    this.inspector = elation.engine.systems.admin.inspector('admin', elation.html.create({append: this.container, window: false}), {engine: this.engine});

  }
  this.updateTreeview = function() {
    this.treeview.setItems(this.world.children);
    this.treeview.sort();
  }
  this.ui_treeview_hover = function(ev) {
    this.hoverthing = ev.data;
    var li = ev.data.container;
    this.toolbar.reparent(li);
  }
  this.ui_treeview_select = function(ev) {
    var thing = ev.data.value;
    if (thing.properties.pickable) {
      this.selectedthing = ev.data;
      elation.engine.systems.admin.inspector('admin').setThing(this.selectedthing);
    }
  }
  this.world_thing_add = function(ev) {
    // refresh tree view when new items are added
    if (ev.data.thing.properties.pickable) {
      this.treeview.setItems(this.world.children);
    }
    //ev.target.persist();
  }
  this.world_thing_remove = function(ev) {
    // refresh tree view if destroyed item was pickable
    if (ev.data.thing.properties.pickable) {
      this.treeview.setItems(this.world.children);
    }
    //ev.target.persist();
  }
  this.centerItem = function() {
    var cdiff = this.admin.admincontrols.object.position.clone().sub(this.admin.admincontrols.center);
    this.admin.admincontrols.center.copy(this.hoverthing.value.properties.position);
    this.admin.admincontrols.object.position.copy(this.hoverthing.value.properties.position).add(cdiff);
  }
  this.addItem = function() {
    var addthing = elation.engine.systems.admin.addthing(null, elation.html.create(), {title: 'fuh'});
    addthing.setParent(this.hoverthing.value);
  }
  this.defineThing = function(type) {
    var definething = elation.engine.systems.admin.definething(null, elation.html.create(), {title: 'fuh', type: type});
  }
  this.removeItem = function() {
    var thing = this.hoverthing.value;
    thing.parent.remove(thing);
    this.treeview.setItems(this.world.children);
  }
  this.changeScene = function(ev) {
    if (ev.data) {
      this.world.loadLocal(ev.data);
    }
    ev.target.select.blur();
  }
  this.createScene = function() {
    //var createscene = elation.engine.systems.admin.createscene(null, elation.html.create(), {title: 'fuh'});
    var scenename = prompt('Enter scene name');
    //this.world.createNew();
    this.world.loadLocal(scenename);
    this.sceneselect.setSelected(scenename);
  }
});
elation.component.add("engine.systems.admin.addthing", function() {
  this.init = function() {
    this.window = elation.ui.window(null, elation.html.create({classname: 'engine_admin_addthing style_box', append: document.body}), {title: 'Add Thing'});
    this.window.setcontent(this.container);
    this.create();
  }
  this.create = function() {
    var tplvars = { };
    var thingtypes = [];
    for (var k in elation.engine.things) {
      thingtypes.push(k);
    }
    thingtypes.sort();
    //thingtypes.push('_other_');
    tplvars.thingtypes = thingtypes.join(';');
    //var newhtml = elation.template.get('engine.systems.admin.addthing', tplvars);
    this.form = elation.html.create('form');
    elation.events.add(this.form, 'submit', this);
    //this.form.innerHTML = newhtml;
    this.container.appendChild(this.form);

    var panel = elation.ui.panel({
      append: this.form,
      orientation: 'horizontal'
    });
    var thingcollection = elation.collection.custom({
      items: function() { return Object.keys(elation.engine.things).sort(); }
    });
    var thingtype = elation.ui.combobox({
      append: panel,
      label: 'Add new',
      inputname: 'type',
      collection: thingcollection,
      events: {
        'ui_input_accept': elation.bind(this, this.submit)
      }
    });
    var thingname = elation.ui.input({
      append: panel,
      label: 'named',
      inputname: 'name',
      events: {
        'ui_input_accept': elation.bind(this, this.submit)
      }
    });
    var submit = elation.ui.button({
      append: panel,
      label: 'add',
      inputname: 'submit',
    });

    elation.component.init(this.container);
    this.form.type.focus();
    this.window.center();
    elation.events.add(this.form.type, 'change', this);
  }
  this.setParent = function(newparent) {
    this.parentthing = newparent;
  }
  this.submit = function(ev) {
    ev.preventDefault();
    var type = this.form.type.value;
    var name = this.form.name.value;
    if (type != '' && name != '' && this.parentthing) {
      var newthing = this.parentthing.spawn(type, name, {persist: true});
      this.window.close();
      // FIXME - should set the newly spawned item as active, since the next logical step is to start manipulating it...
      //elation.engine.systems.admin.inspector('admin').setThing(this.selectedthing);
    }
  }
  this.change = function(ev) {
    if (ev.target == this.form.type) {
      if (ev.target.value == '_other_') {
        var input = elation.html.create('input');
        input.name = ev.target.name;
        input.value = '';
        ev.target.parentNode.replaceChild(input, ev.target);
        input.focus();
      }
    }
  }
});
elation.component.add("engine.systems.admin.definething", function() {
  this.init = function() {
    this.type = this.args.type || 'light';
    this.highlight = true;
    this.window = elation.ui.window(null, elation.html.create({classname: 'engine_admin_definething style_box', append: document.body}), {title: 'Define Thing'});
    this.window.setcontent(this.container);
    this.create();
  }
  this.create = function() {
    var tplvars = {};
/*
    var newhtml = elation.template.get('engine.systems.admin.definething', tplvars);
    this.form = elation.html.create('form');
    elation.events.add(this.form, 'submit', this);
    this.form.innerHTML = newhtml;
    this.container.appendChild(this.form);
    elation.component.init(this.container);
    this.form.thingtype.focus();
*/
    this.accordions = {};

    this.buttonbar = elation.ui.buttonbar(null, elation.html.create({append: this.container}), {
      buttons: [
        {
          label: 'Save',
          events: { click: elation.bind(this, this.save) }
        },
        { 
          label: 'Revert',
          events: { click: elation.bind(this, this.revert) }
        },
      ]
    });

    this.accordions['own'] = elation.ui.accordion(null, elation.html.create({append: this.container, classname: 'engine_admin_definething_own'}), {});
    this.accordions['inherit'] = elation.ui.accordion(null, elation.html.create({append: this.container, classname: 'engine_admin_definething_inherited'}), {});

    var obj = new elation.engine.things[this.type].classdef();
    var parent = new elation.engine.things[this.type].extendclass();

    this.updateAccordion('own', obj);
    this.updateAccordion('inherit', parent);

    this.window.center();
    elation.events.add(this.form, 'submit', this);
  }
  this.updateAccordion = function(name, obj) {
    var objtree = {};
    for (var k in obj) {
      if (typeof obj[k] == 'function') {
        objtree[k] = { title: k, content: '<pre><code contenteditable=true spellcheck=false data-name="' + k + '">' + obj[k].toString() + '</code></pre>'};
      }
    }  
    this.accordions[name].setItems(objtree);

    if (this.highlight) {
      var codes = elation.find('code', this.accordions[name].container);
      for (var i = 0; i < codes.length; i++) {
        hljs.highlightBlock(codes[i]);
        //elation.events.add(codes[i], 'keydown,keyup', this);
      }
    }
  }
  this.keydown = function(ev) {
    if (this.updatetimer) {
      clearTimeout(this.updatetimer);
    }
  }
  this.keyup = function(ev) {
    if (ev.target.innerText != this.lasttext){
      var target = ev.target;
      this.updatetimer = setTimeout(elation.bind(this, function() { 
        this.lasttext = ev.target.innerText;
        var caret = this.getCaretPosition(ev.target);
console.log('caretpos:', caret, target);
        var highlight = hljs.highlight('javascript', target.innerText);
        target.innerHTML = highlight.value; 
sel = document.getSelection();
var range = document.createRange();
range.setStart(target, caret);
range.collapse(true);
sel.removeAllRanges();
sel.addRange(range);
      }), 250);
    }
  }
  this.getCaretPosition = function(element) {
        var range = window.getSelection().getRangeAt(0);
        var preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        var caretOffset = preCaretRange.toString().length;
        return caretOffset;
  }
  this.setParent = function(newparent) {
    this.parentthing = newparent;
  }
  this.submit = function(ev) {
    ev.preventDefault();
    var type = this.form.thingtype.value;
    var content = this.form.thingdef.value;

    this.save();

    if (this.parentthing) {
      this.window.close();
    }
  }
  this.assemble = function() {
    var content = "function() {\n";
    var codes = elation.find('code', this.accordions['own'].container);
    for (var i = 0; i < codes.length; i++) {
      content += "  this." + codes[i].dataset.name + " = " + codes[i].innerText + "\n";;
    }
    content += "}";
    return content;
  }
  this.save = function() {
    var oldthing = elation.engine.things[this.type];
    elation.engine.things[this.type] = undefined;
    
    var cmd = "elation.component.add('engine.things." + this.type + "', " + this.assemble() + ", elation.engine.things.generic);";
    console.log(cmd);
    eval(cmd);

    for (var k in oldthing.obj) {
      console.log('stupid thing', k, oldthing.obj[k]);
      var oldparent = oldthing.obj[k].parent;
      oldthing.obj[k].die();
      var newthing = elation.engine.things[this.type](k, oldthing.obj[k].container, oldthing.obj[k].args);
      oldparent.add(newthing);
    }
  }
});
elation.component.add("engine.systems.admin.inspector", function() {
	this.defaultcontainer = { tag: 'div', classname: 'engine_admin_inspector' };

  this.init = function() {
    this.engine = this.args.engine;

    if (this.args.window) {
      this.window = elation.ui.window(null, elation.html.create({tag: 'div', classname: 'style_box engine_admin_inspector', append: document.body}), {title: 'Thing', controls: false});
      this.window.setcontent(this.container);
    } else {
      this.label = elation.ui.label({append: this.container});
    }

    //elation.html.addclass(this.container, 'engine_admin_inspector style_box');
    elation.events.add(this.container, "mousewheel", function(ev) { ev.stopPropagation(); }); // FIXME - hack for mousewheel
    //this.label = elation.html.create({tag: 'h2', append: this.container});
    this.tabcontents = {
      properties: elation.engine.systems.admin.inspector.properties({}),
      objects: elation.engine.systems.admin.inspector.objects({}),
      functions: elation.engine.systems.admin.inspector.functions({})
    };
    this.manipulator = elation.engine.things.manipulator('manipulator', elation.html.create(), {properties: {persist: false, pickable: false, physical: false}, name: 'manipulator', type: 'manipulator', engine: this.engine}); 
  }
  this.setThing = function(thingwrapper) {
    this.thingwrapper = thingwrapper;
    var thing = thingwrapper.value;
    if (!this.tabs) {
      this.createTabs();
    }
    if (this.window) {
      this.window.settitle(thing.id + ' (' + thing.type + ')');
    } else {
      this.label.setlabel(thing.id + ' (' + thing.type + ')');
    }
    this.tabs.setActiveTab(this.activetab || "properties");

    //this.engine.systems.physics.debug(thing);
    //this.selectedthing.value.spawn('manipulator', null, {persist: false});
    this.manipulator.reparent(thing);
/*
        console.log(this.engine.systems.render);
      if (!this.transformer && this.world.engine.systems.render.camera) {
        this.transformer = new THREE.TransformControls(this.world.engine.systems.render.camera);
      }
      this.transformer.attach(thing.objects['3d']);
*/
    //this.properties.setThing(thingwrapper);
    //this.objects.setThing(thingwrapper);
  }
  this.createTabs = function() {
    this.tabs = elation.ui.tabs(null, elation.html.create({append: this.container}), {
      items: [
        {
          label: "Properties",
          name: "properties",
        },
        {
          label: "Objects",
          name: "objects",
        },
        {
          label: "Functions",
          name: "functions",
        },
      ]});
    this.contentarea = elation.html.create({tag: 'div', classname: 'engine_admin_inspector_contents', append: this.container});
    elation.events.add(this.tabs, 'ui_tabs_change', this);
  }
  this.ui_tabs_change = function(ev) {
    var newtab = ev.data;
    if (this.tabcontents[newtab.name]) {
      this.activetab = newtab.name;
      this.contentarea.innerHTML = '';
      this.tabcontents[newtab.name].reparent(this.contentarea);
      this.tabcontents[newtab.name].setThing(this.thingwrapper);
    }
  }
});
elation.component.add("engine.systems.admin.inspector.properties", function() {
	this.defaultcontainer = { tag: 'div' };

  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_properties ui_treeview');
    this.propdiv = elation.html.create({tag: 'div', append: this.container});
  }
  this.setThing = function(thingwrapper) {
    this.thingwrapper = thingwrapper;
    var thing = thingwrapper.value;
    this.propdiv.innerHTML = '';
    var proptree = this.buildPropertyTree(thing.properties);
      
    // FIXME - should reuse the same treeview rather than creating a new one each time
    this.treeview = elation.ui.treeview(null, this.propdiv, {
      items: proptree,
      attrs: {
        children: 'children',
        itemtemplate: 'engine.systems.admin.inspector.property'
      }
    });
    this.treeview.sort();
    var propinputs = elation.find('input', this.propdiv);
    elation.events.add(propinputs, 'change', this);
  }
  this.buildPropertyTree = function(properties, prefix) {
    var root = {};
    if (!prefix) prefix = '';

    for (var k in properties) {
      root[k] = {name: k, fullname: prefix + k};
      if (properties[k] instanceof THREE.Vector2) {
        root[k]['value'] = properties[k].x + ',' + properties[k].y;
      } else if (properties[k] instanceof THREE.Vector3) {
        root[k]['value'] = properties[k].x + ',' + properties[k].y + ',' + properties[k].z;
      } else if (properties[k] instanceof THREE.Vector4 || properties[k] instanceof THREE.Quaternion) {
        root[k]['value'] = properties[k].x + ',' + properties[k].y + ',' + properties[k].z + ',' + properties[k].w;
      } else if (properties[k] instanceof THREE.Texture) {
        root[k]['value'] = properties[k].sourceFile;
      } else if (properties[k] instanceof THREE.Mesh) {
        root[k]['value'] = '[mesh]';
      } else if (properties[k] instanceof Object && !elation.utils.isArray(properties[k])) {
        root[k]['children'] = this.buildPropertyTree(properties[k], prefix + k + "_");
      } else if (elation.utils.isArray(properties[k]) || elation.utils.isObject(properties[k])) {
				root[k]['value'] = JSON.stringify(properties[k]);
      } else {
        root[k]['value'] = properties[k];
      }
    }
    return root;
  }
  this.change = function(ev) {
    var propname = ev.target.id.replace(/^engine_admin_inspector_properties_/, "").replace(/_/g, ".");
    var thing = this.thingwrapper.value;
    thing.set(propname, ev.target.value, true);
  }
});
elation.component.add("engine.systems.admin.inspector.objects", function() {
	this.defaultcontainer = { tag: 'div' };

  this.types = ['Mesh', 'PointLight', 'DirectionalLight', 'Light', 'ParticleSystem', 'PerspectiveCamera', 'OrthographicCamera', 'Camera', 'TextGeometry', 'BoxGeometry', 'SphereGeometry', 'PlaneGeometry', 'TorusGeometry', 'Geometry', 'MeshPhongMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshFaceMaterial', 'ShaderMaterial', 'Material', 'Object3D'];
  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_objects ui_treeview');
  }
  this.setThing = function(thingwrapper) {
    this.thing = thingwrapper.value;
    this.container.innerHTML = '';

    var objtree = this.buildObjectTree(this.thing.objects);
      
    // FIXME - should reuse the same treeview rather than creating a new one each time
    this.treeview = elation.ui.treeview(null, this.container, {
      items: objtree,
      attrs: {
        children: 'children',
        itemtemplate: 'engine.systems.admin.inspector.object'
      }
    });
    elation.events.add(this.treeview, 'ui_treeview_select', this);
  }
  this.buildObjectTree = function(objects, prefix) {
    var root = {};
    if (!prefix) prefix = '';

    for (var k in objects) {
      if (!elation.utils.isNull(objects[k])) {
        if (objects[k] instanceof elation.physics.rigidbody) {
          // TODO - show physics object to allow editing
        } else if (objects[k].userData && objects[k].userData.thing && objects[k].userData.thing != this.thing) {
          // TODO - This is a child thing - should we show them here?
        } else if (!(objects[k].userData && objects[k].userData.thing) || objects[k].userData.thing == this.thing) {
          root[k] = {
            name: k,
            fullname: prefix + k,
            type: this.getObjectType(objects[k])
          };
          root[k].object = objects[k];
          root[k].children = {};
          if (objects[k].children && objects[k].children.length > 0) {
            elation.utils.merge(this.buildObjectTree(objects[k].children, prefix + k + "_"), root[k].children);
          }
          switch (root[k].type) {
            case 'Mesh':
              var subobjects = {
                'geometry': objects[k].geometry,
                'material': objects[k].material
              };
              elation.utils.merge(this.buildObjectTree(subobjects), root[k].children);
              break;
            case 'MeshFaceMaterial':
              var subobjects = objects[k].materials;
              elation.utils.merge(this.buildObjectTree(subobjects), root[k].children);
              break;
          }
        }
      }
    }
    return root;
  }
  this.getObjectType = function(obj) {
    var type = 'Object3D';
    //console.log('object ' + objects[k].name + ': ', objects[k]);
    for (var i = 0; i < this.types.length; i++) {
      if (obj instanceof THREE[this.types[i]]) {
        type = this.types[i];
        break;
      }
    }
    return type;
  }

  this.ui_treeview_select = function(ev) {
    var selected = ev.data.value;
    switch (selected.type) {
      case 'ShaderMaterial':
        elation.engine.materials.displayall(null, selected.object);
        break;
    }
  }
});
elation.component.add("engine.systems.admin.inspector.functions", function() {
	this.defaultcontainer = { tag: 'div' };

  this.init = function() {
    elation.html.addclass(this.container, 'engine_admin_inspector_functions');
  }
  this.setThing = function(thingwrapper) {
    this.thing = thingwrapper.value;
    this.container.innerHTML = '';

    //var objtree = this.buildObjectTree(this.thing.objects);
    //var generic = elation.engine.things.generic(null, elation.html.create());
    var parent = elation.engine.things[this.thing.type].extendclass;
    var objtree = {};
    for (var k in this.thing) {
      if (typeof this.thing[k] == 'function') {
        objtree[k] = { 'function': { name: k, content: this.thing[k].toString() } };
        objtree[k].function.own = (typeof parent[k] != 'function' || parent[k].toString() != this.thing[k].toString());
console.log(" - " + k, objtree[k].own, parent[k], this.thing[k]);
      }
    }  
    // FIXME - should reuse the same treeview rather than creating a new one each time
    this.treeview = elation.ui.treeview(null, this.container, {
      items: objtree,
      attrs: {
        children: 'children',
        itemtemplate: 'engine.systems.admin.inspector.function'
      }
    });
    elation.events.add(this.treeview, 'ui_treeview_select', this);
  }
});

elation.component.add("engine.systems.admin.worldcontrol", function() {
  this.init = function() {
    this.timescale = 1;
    this.playing = true;
    this.engine = this.args.engine;
    elation.html.addclass(this.container, 'engine_admin_worldcontrol');

    this.playcontrols = elation.ui.buttonbar(null, elation.html.create({append: this.container}), {
      buttons: {
        'reload': { label: '⟲', events: { click: elation.bind(this, this.reload) }, autoblur: true },
        'stepback': { label: '⇤', events: { click: elation.bind(this, this.stepback) }, autoblur: true },
        'play': { label: '||', events: { click: elation.bind(this, this.toggle) }, autoblur: true },
        'stepforward': { label: '⇥', events: { click: elation.bind(this, this.stepforward) }, autoblur: true },
        'save': { label: 'save', events: { click: elation.bind(this, this.save) }, autoblur: true },
      }
    });
    this.speedslider = elation.ui.slider(null, elation.html.create({append: this.container}), {
      value: this.timescale * 100,
      minpos: -500,
      maxpos: 500,
      labelprefix: 'Speed: ',
      labelsuffix: '%',
      snap: 2.5
    });
    elation.events.add(this.speedslider, 'ui_slider_change', this);

    if (this.engine.systems.physics.timescale == 0) {
      this.pause();
    }

    this.window = elation.ui.window(null, elation.html.create({tag: 'div', classname: 'style_box engine_admin_worldcontrol', append: document.body}), {
      title: 'World Controls', 
      controls: false, 
      bottom: 20, 
      center: true,
      content: this.container
    });
  }
  this.save = function() {
    this.engine.systems.world.saveLocal();
  }
  this.reload = function() {
    this.pause();
    this.engine.systems.world.reload();
  }
  this.play = function() {
    this.playcontrols.buttons.play.setLabel('||');
    this.setTimescale(this.speedslider.value / 100, true);
    this.playing = true;
  }
  this.pause = function() {
    this.playcontrols.buttons.play.setLabel('▶');
    this.setTimescale(0);
    this.playing = false;
  }
  this.toggle = function() {
    if (this.playing) {
      this.pause();
    } else {
      this.play();
    }
  }
  this.stepback = function() {
    this.setTimescale(this.speedslider.value/100, true);
    this.engine.systems.physics.step(-1/60);
    this.pause();
  }
  this.stepforward = function() {
    this.setTimescale(this.speedslider.value/100, true);
    this.engine.systems.physics.step(1/60);
    this.pause();
  }
  this.setTimescale = function(ts, force) {
    this.timescale = ts;
    if (this.playing || force || ts == 0) {
      this.engine.systems.physics.timescale = ts;
    }
  }
  this.ui_slider_change = function(ev) {
    if (ev.target == this.speedslider) {
      //if (!this.playing) this.play();
      this.setTimescale(ev.data / 100);
    }
  }
});
elation.component.add("engine.systems.admin.assets", function() {
  this.init = function() {
    this.world = this.args.world;
    this.admin = this.args.admin;
    this.engine = this.world.engine;
    this.tabcontents = {};

    this.create();
  }
  this.create = function() {
    this.tabs = elation.ui.tabs({
      append: this.container,
      items: [
        {
          label: "Materials",
          name: "materials",
        },
        {
          label: "Geometries",
          name: "geometries",
        },
        {
          label: "Behaviors",
          name: "behaviors",
        },
      ]});
    this.contentarea = elation.html.create({tag: 'div', classname: 'engine_admin_assets_contents', append: this.container});
    elation.events.add(this.tabs, 'ui_tabs_change', this);
    this.tabs.setActiveTab("materials");

    this.createMaterialList();
    this.createGeometryList();
    this.createBehaviorList();

    this.setTabContent("materials");

    this.window = elation.ui.window({
      classname: 'style_box engine_admin_worldcontrol',
      append: document.body,
      title: 'Assets', 
      controls: false, 
      right: true, 
      top: true, 
      content: this.container
    });
  }
  this.createMaterialList = function() {
    this.tabcontents['materials'] = elation.ui.grid({
      classname: 'engine_admin_assets_materials',
      sortbydefault: 'name',
      attrs: {
        itemtemplate: 'engine.systems.admin.assets.material'
      }
    });
    this.updateMaterialList();
    elation.events.add(elation.engine.materials, 'engine_material_add', elation.bind(this, this.updateMaterialList));
  }
  this.updateMaterialList = function() {
    var materials = [];
    var matlib = elation.engine.materials.materiallibrary;
    for (var k in matlib) {
      materials.push({name: k, material: matlib[k]})
    }
    materials.sort(function(a, b) { return (a.name < b.name ? -1 : 1); });
    this.tabcontents['materials'].clear();
    this.tabcontents['materials'].setItems(materials);
    //this.tabcontents['materials'].sort('name');
  }
  this.createGeometryList = function() {
    this.tabcontents['geometries'] = elation.ui.list({
      classname: 'engine_admin_assets_geometries',
      sortbydefault: 'name',
      attrs: {
        itemtemplate: 'engine.systems.admin.assets.geometry'
      }
    });
    this.updateGeometryList();
    elation.events.add(elation.engine.geometries, 'engine_geometry_add', elation.bind(this, this.updateGeometryList));
  }
  this.updateGeometryList = function() {
    var geometries = [];
    var geomlib = elation.engine.geometries.generators;
    for (var k in geomlib) {
      geometries.push({name: k, geometry: geomlib[k]})
    }
    this.tabcontents['geometries'].clear();
    this.tabcontents['geometries'].setItems(geometries);
    this.tabcontents['geometries'].sort('name');
  }
  this.createBehaviorList = function() {
    this.tabcontents['behaviors'] = elation.ui.label({label: 'TODO - fill in behaviors'});
  }
  this.setTabContent = function(name) {
    if (this.tabcontents[name]) {
      this.activetab = name;
      this.contentarea.innerHTML = '';
      this.tabcontents[name].reparent(this.contentarea);
    }
  }
  this.ui_tabs_change = function(ev) {
    var newtab = ev.data;
    this.setTabContent(newtab.name);
  }
});

elation.component.add("engine.systems.admin.assets.material", function() {
  this.init = function() {
    this.materialname = this.args.materialname;
    this.material = elation.engine.materials.get(this.materialname);
    if (this.material.map) {
      this.preview = this.material.map.image;
    } else if (this.material.color) {
      this.preview = elation.html.create();
      this.preview.style.background = "#" + this.material.color.getHexString();
    }
    if (this.preview) {
      if (this.material.opacity) {
        this.preview.style.opacity = this.material.opacity;
      }
      elation.html.addclass(this.preview, 'engine_admin_assets_material_preview');
      this.container.appendChild(this.preview);
    }
    this.container.draggable = true;
    elation.events.add(this.container, 'mousedown,dragstart', this);
  }
  this.mousedown = function(ev) {
    console.log('dn', this.materialname);
  }
  this.dragstart = function(ev) {
    ev.dataTransfer.setData("-elation-material", this.materialname);
    return true;
  }
});
