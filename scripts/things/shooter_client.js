var _reqs = [
    'engine.things.generic',
    'engine.things.camera',
    'engine.things.light',
    'engine.things.ball',
    'engine.things.remoteplayer',
    'vrcade.vrcadeplayer',
    'bball.testplane',
    'engine.external.three.tween',
  ];
elation.require(_reqs, function() {
  elation.component.add('engine.things.shooter_client', function() {
    this.player_id = null;
    this.lastUpdate = Date.now();
    
    // this.init = function() {
    //   this.name = this.args.name || 'default';
    // }
    
    this.postinit = function() {
      console.log('engine:', this.engine);
      elation.events.add(this.engine.systems.client, 'world_data', elation.bind(this, this.loadWorld));
      elation.events.add(this.engine.systems.client, 'id_token', elation.bind(this, this.setIdToken));
      elation.events.add(this.engine.systems.client, 'thing_added', elation.bind(this, this.createRemoteObject));
      elation.events.add(this.engine.systems.client, 'thing_changed', elation.bind(this, this.changeThing));
      elation.events.add(this.engine.systems.client, 'thing_removed', elation.bind(this, this.removeThing));
      this.defineProperties({
        view: { type: 'object' }
      });
      if (this.properties.view) this.view = this.properties.view;
      if (this.engine.systems.controls) {
        this.initControls();
      }
    };
 
    this.createObject3D = function() {
      return new THREE.Object3D();
    }
    
    this.createChildren = function() {
    }
    
    this.loadWorld = function(ev) {
      // load the world data sent by the server
      var world = ev.data;
      for (var k in world.things) {
        var thing = world.things[k];
        this.spawn(thing.type, thing.name, thing.properties); 
      }
    };
    
    this.setIdToken = function(ev) {
      // set the id sent by the server and acknowledge,
      // then create the player
      this.player_id = ev.data;
      this.engine.systems.client.send({type: 'received_id', data: this.player_id});
      this.createPlayer();
    };

    this.createPlayer = function() {
      // create the player and let the server know we have a new player obj
      this.player = this.spawn('vrcadeplayer', this.player_id, { "position":[0,2.4,0], mass: 50, collidable: false, player_id: this.player_id });
      this.player.addTag('local_sync');
      this.setview(this.view);
      this.startGame();
      this.engine.systems.client.send({type: 'new_player', data: {id: this.player_id, thing: this.player.serialize()}});
    };
    
    this.sendPlayerChange = function() {
      // send updates on the player's position
      if (Date.now() - this.lastUpdate > 20) {
        this.engine.systems.client.send({type: 'thing_changed', data: {thing: this.player.serialize()}}); 
      }
    };
    
    this.createRemoteObject = function(ev) {
      // create a new thing sent by the server
      var thing = ev.data;
      this.children[thing.name] = this.spawn(thing.type, thing.name, thing.properties);
      console.log('spawned remote object', this.children[thing.name]);
    };
    
    this.changeThing = function(ev) {
      // update a thing from server info
      var thing = ev.data;
      if (this.children[thing.name]) {
        var child = this.children[thing.name];
        child.setProperties(thing.properties, false);
        if (!child.hasTag('extrapolating')) { child.addTag('extrapolating'); }
        child.lastUpdate = Date.now();
      }
    }
    
    this.removeThing = function(ev) {
      // remove a thing on orders from the server
      var thing = ev.data;
      if (this.children[thing.name]) {
        var child = this.children[thing.name];
        child.die();
      }
    }
    
    this.setview = function(view) {
      this.view = view;
      if (this.player) {
        this.view.setactivething(this.player);
      }
    }
    
    this.initControls = function() {
      this.controlstate = this.engine.systems.controls.addContext(this.name, {
        'menu': ['keyboard_esc,gamepad_0_button_9', elation.bind(this, this.toggleMenu)],
        'pointerlock': ['pointerlock', elation.bind(this, this.togglePointerLock)],
        'vr_toggle': ['keyboard_ctrl_rightsquarebracket', elation.bind(this, this.toggleVR)],
        'vr_calibrate': ['keyboard_ctrl_leftsquarebracket', elation.bind(this, this.calibrateVR)],
      });
      this.engine.systems.controls.activateContext(this.name);
    }
    
    this.togglePointerLock = function(ev) {
      if (ev.value == 0) {
        this.showMenu();
      }
    }
    
    this.toggleFullscreen = function(ev) {
      var view = this.view;
      if (view && (ev.value == 1 || typeof ev.value == 'undefined')) {
        view.toggleFullscreen();
      }
    }
    
    this.toggleMenu = function(ev) {
      if (ev.value == 1) {
        if (this.menuShowing) {
          this.hideMenu();
        } else {
          this.showMenu();
        }
      }
    }
    
    this.hideMenu = function() {
      this.player.disable();
    }
    
    this.showMenu = function() {
      this.player.enable();
    } 

    this.toggleVR = function(ev) {
      var view = this.view;
      if (view && (ev.value == 1 || typeof ev.value == 'undefined')) {
        var mode = (view.rendermode == 'default' ? 'oculus' : 'default');
        view.setRenderMode(mode);
      }
    }
    
    this.calibrateVR = function(ev) {
      if (this.engine.systems.controls && ev.value == 1) {
        this.engine.systems.controls.calibrateHMDs();
      }
    }
    
    this.startGame = function() {
      this.player.enable();
    }
  }, elation.engine.things.generic);
});