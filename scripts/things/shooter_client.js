var _reqs = [
    'engine.things.generic',
    'engine.things.camera',
    'engine.things.light',
    'engine.things.ball',
    'engine.things.remoteplayer',
    'engine.things.player',
    'engine.things.testplane',
    'engine.external.three.tween',
    'engine.things.maskgenerator'
  ];
elation.require(_reqs, function() {
  elation.component.add('engine.things.shooter_client', function() {
    this.lastUpdate = Date.now();
    this.player_id = null;
    this.loaded = false;

    // this.init = function() {
    //   this.name = this.args.name || 'default';
    // }
    this.initNetwork = function() {
      // virtual - override this to create your connection, e.g.
      //
      // this.engine.systems.client.connect({
      //   transport: 'websocket',
      //   host: 'dev.brandonhinshaw.us',
      //   port: '9001'
      // })
    }
    this.postinit = function() {
      console.log('engine:', this.engine);
      this.initNetwork();
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
      if (this.loaded) return;
      this.create_lights();
      var world = ev.data;
      console.log("received world data", ev.data)
      for (var k in world.things) {
        var thing = world.things[k];
        this.spawn(thing.type, thing.name, thing.properties); 
      }
      this.loaded = true;
    };
    
    this.setIdToken = function(ev) {
      // set the id sent by the server and acknowledge,
      // then create the player
      if (this.player_id) return;
      console.log("RECEIVED ID TOKEN", ev.data);
      this.player_id = ev.data;
      this.engine.systems.client.send({type: 'received_id', data: this.player_id});
      this.createPlayer();
    };

    this.createPlayer = function() {
      // create the player and let the server know we have a new player obj
      this.player = this.spawn('player', this.player_id, { "position":[0,2.4,0], mass: 50, collidable: false, player_id: this.player_id, tags: 'local_sync,player' });
      this.setview(this.view);
      this.startGame();
      var player = this.player.serialize(),
          camera = this.player.camera.serialize();
      player.properties.tags = camera.properties.tags = '';
      console.log('serialized player', player);
      this.engine.systems.client.send({type: 'new_player', data: {id: this.player_id, thing: this.player.serialize(), camera: this.player.camera.serialize()}});
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
      thing.properties.tags = '';
      console.log('remote thing', thing.type, 'tags:', thing.properties.tags);
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
        this.create_lights = function() {
      var lights = [];
/*
      lights.push(this.spawn('light', 'sun', {
        "position":[50,30,-30],
        "persist":false,
        "type":"directional",
        "intensity":0.6,
        //"velocity":[0,0,0.05]
      }));
*/
      /*
      lights.push(this.spawn('light', 'sun2', {
        "position":[-50,-30,-30],
        "persist":false,
        "type":"directional",
        "intensity":0.2,
        //"velocity":[0,0,0.05]
      }));
      */
      lights.push(this.spawn('light', 'point01', {
        "position":[-10,20,10],
        "persist":false,
        "type":"point",
        "intensity": .4,
        "color":0xffffff,
      }));
      lights.push(this.spawn('light', 'point02', {
        "position":[20,10,32],
        "persist":false,
        "type":"point",
        "intensity": .4,
        "color":0xcccccc,
      }));
      lights.push(this.spawn('light', 'point03', {
        "position":[0,10,-30],
        "persist":false,
        "type":"point",
        "intensity": .4,
        "color":0xcccccc,
      }));
      lights.push(this.spawn('light', 'ambient', {
        "position":[0,0,0],
        "persist":false,
        "type":"ambient",
        "color":0xffffff,
      }));

      return lights;
    }

    this.startGame = function() {
      this.player.enable();
    }
  }, elation.engine.things.generic);
});