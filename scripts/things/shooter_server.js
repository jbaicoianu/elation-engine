/*
  A generic template for an FPS-type server.
*/

var _reqs = [
    'engine.things.remoteplayer',
    'engine.things.generic'
  ];
  
 elation.require(_reqs, function() {
   
 elation.component.add('engine.things.shooter_server', function() {
    this.players = {};
    
    this.postinit = function() {
      // network events
      elation.events.add(this.engine.systems.server, 'add_player', elation.bind(this, this.spawnRemotePlayer));
      elation.events.add(this.engine.systems.server, 'remote_thing_change', elation.bind(this, this.remoteThingChange));
      elation.events.add(this.engine.systems.server, 'add_thing', elation.bind(this, this.spawnNewThing));
      elation.events.add(this.engine.systems.server, 'player_disconnect', elation.bind(this, this.onPlayerDisconnect));
      this.things = [];
      this.world = this.engine.systems.world;
    };
    
    this.createObject3D = function() {
      return new THREE.Object3D();
    };

    this.createChildren = function() {
      this.loadWorld();
    };
    
    this.spawnRemotePlayer = function(ev) {
      console.log('spawning new player');
      var thing = ev.data.thing;
      this.spawn('remoteplayer', ev.data.id, thing.properties);
      elation.events.add(this.players[ev.data.id], 'thing_change', elation.bind(this.engine.systems.server, this.engine.systems.server.onThingChange));
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
      var thing = ev.data.data.thing;
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

    this.loadWorld = function() {
      // Virtual
    };

  }, elation.engine.things.generic);

 });