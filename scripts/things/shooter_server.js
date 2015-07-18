/*
  A generic template for an FPS-type server.
*/

var _reqs = [
    'engine.things.remoteplayer',
    'engine.things.generic',
    'engine.things.maskgenerator'
  ];
  
 elation.require(_reqs, function() {
   
 elation.component.add('engine.things.shooter_server', function() {
    this.players = {};
    
    this.initNetwork = function(args) {
      this.server.start({ port: 9001 });
    };
    
    this.postinit = function() {
      // network events
      this.server = this.engine.systems.server;
      this.initNetwork();
      elation.events.add(this.server, 'add_player', elation.bind(this, this.spawnRemotePlayer));
      elation.events.add(this.server, 'remote_thing_change', elation.bind(this, this.remoteThingChange));
      elation.events.add(this.server, 'add_thing', elation.bind(this, this.spawnNewThing));
      elation.events.add(this.server, 'player_disconnect', elation.bind(this, this.onPlayerDisconnect));
      elation.events.add(this.server, 'client_received_id', elation.bind(this, this.sendWorldData));
      
      this.things = [];
      this.world = this.engine.systems.world;
    };
    
    this.createObject3D = function() {
      return new THREE.Object3D();
    };

    this.createChildren = function() {
      this.loadWorld();
    };
    
    this.spawnRemotePlayer = function(event) {
      console.log(event.type, event.data.thing.properties.player_id)
      var thing  = event.data.thing;
      thing.properties.tags = '';
      this.things[thing.name] = this.spawn('remoteplayer', event.data.id, thing.properties);
    };
    
    this.onPlayerDisconnect = function(ev) {
      // TODO - shouldn't destroy everything on player disconnect
      // maybe we can destroy only persistent objects?
      console.log('disconn', ev.data.id);
      var things = this.world.getThingsByPlayer(ev.data.id);
      for (var i = 0; i < things.length; i++) {
        things[i].die();
      }
    };
    
    this.spawnNewThing = function(ev) {
      console.log(ev.type, ev.data.thing.type);
      var thing = ev.data.thing;
      var newThing = this.spawn(thing.type, thing.name, thing.properties);
    };
    
    this.destroyRemotePlayer = function(ev) {
      // console.log(ev.data.id);
      // this.players[ev.data.id].die();
    };
    
    this.remoteThingChange = function(ev) {
      var thing = ev.data.data.thing;
      if (this.children[thing.name]) {
        for (var prop in thing.properties) {
          this.children[thing.name].set(prop, thing.properties[prop], false);
        }
        this.children[thing.name].refresh();
      }
    };
    
    this.sendWorldData = function(ev) {
      console.log(ev.type, ev.data)
      var client = this.server.clients[ev.data];
      client.send(this.server.serialize_world());
    }
    
    this.loadWorld = function() {
      // Virtual
    };

  }, elation.engine.things.generic);

 });