elation.extend("engine.systems.networking.client", function(args) {
  
  if (ENV_IS_NODE) {
    this.server = true;
  }
  else if (ENV_IS_BROWSER) {
    this.client = true;
  }
  elation.implement(this, elation.engine.systems.system);
  this.connected = false;
  this.websocket = new WebSocket("ws://ec2-54-201-16-112.us-west-2.compute.amazonaws.com:8080");
  this.connection = this.websocket;
  this.tagged = [];
  this.toSend = [];
  
  this.remotePlayers = {};
  
  this.websocket.onopen = function() {
    this.connected = true;
    console.log('networking: connected to server');
  }.bind(this);
  
  this.websocket.onmessage = function(ev) {
    this.newMessage(JSON.parse(ev.data));
  }.bind(this);

  
  this.system_attach = function(ev) {
    console.log('INIT: networking');
    this.world = this.engine.systems.world;
    elation.events.add(this.world, 'engine_thing_create,world_thing_add', this.handleNewThing.bind(this));
    elation.events.add(this.world, 'world_thing_remove', this.handleRemovedThing.bind(this))
  };
  
  this.handleNewThing = function(ev) {
    if (ev.data.thing.hasTag('networking_local_sync')) {
      this.tagged.push(ev.data.thing);
      console.log('networking: tagged - ', this.tagged);
      if (ev.data.thing.componentname == 'engine.things.vrcadeplayer') {
        // TODO: better handling of local player vs remote player
        ev.data.thing.network_id = Math.floor(Math.random() * 10000); // TODO
        this.addToMessages({type: 'new_player', position: ev.data.thing.properties.position.toArray(), network_id: ev.data.thing.network_id});
        elation.events.add(ev.data.thing, 'thing_change', this.handleChange.bind(this));
      }
      else {
        this.addToMessages({type: 'new_thing', position: ev.data.thing.properties.position.toArray()});
      }
    }
  };
  
  
  this.newMessage = function(msg) {
    if (msg.type == "new_player") {
      var remotePlayer = this.world.spawn('remoteplayer', 'player' + msg.network_id, {'position': msg.position, 'collidable': false});
      this.remotePlayers[msg.network_id] = remotePlayer;
    }
    else if (msg.type = "thing_change") {
      if (this.remotePlayers[msg.network_id]) {
        this.remotePlayers[msg.network_id].properties.position.set(msg.position[0], msg.position[1], msg.position[2]);
        this.remotePlayers[msg.network_id].refresh();
      }
    }
    
  };
  
  this.handleChange = function(ev) {
    this.addToMessages({type: 'thing_change', position: ev.target.properties.position.toArray(), network_id: ev.target.network_id});
    // console.log(ev.target.properties.position.toArray());
  };
  
  this.handleRemovedThing = function(ev) {
    if (this.tagged.indexOf(ev.data.thing) !== -1) {
      // TODO: splice it out
    }
  };
  this.send = function(data) {
    this.connection.send(data);
    // console.log('networking: sent data:', data);
  };
  
  this.addToMessages = function(data) {
    this.toSend.push(data);
  };
  
  this.sendMessages = function() {
    if (this.toSend.length > 0 && this.connected) {
      for (var i = 0; i < this.toSend.length; i++) {
        this.send(JSON.stringify(this.toSend[i]));
      }
      this.toSend = [];
    }
  };
  
  this.engine_frame = function(ev) {
    this.sendMessages();
  };
  
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: networking');
    this.websocket.close();
    this.websocket = null;
  };
});

// client connection objects

elation.extend('engine.systems.networking.client.connection', function(opts) {
  // a transport-agnostic object representing the connection from the client
  // to the server.
  // 
  // should take opts for transport, server host, server port
  // expose send()
  // fire events on connection, disconnection, and received messages
  
  var socketOpts = { host: opts.host, port: opts.port };
  if (opts.transport == 'websocket') {
    this.socket = new engine.systems.networking.websocket(socketOpts);
  } 
  if (opts.transport == 'webrtc') {
    this.socket = new engine.systems.networking.webrtc(socketOpts);
  }
  
  this.send = function(data) {
    this.socket.send(data);
  };
  
});

elation.extend('engine.systems.networking.websocket', function(opts) {
  this.address = 'ws://' + opts.address + opts.port;
  
  this.init = function() {
    this.connect();
  };
  
  this.connect = function() {
    if (!this.websocket) {
      this.websocket = new WebSocket(this.address);
      elation.events.add(this.websocket, "open", elation.bind(this, this.onOpen));
      elation.events.add(this.websocket, "message", elation.bind(this, this.onMessage));
      elation.events.add(this.websocket, "close", elation.bind(this, this.onClose));
    }
  };

  this.close = function() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  };

  this.send = function(data) {
    this.websocket.send(data);
  };
  
  this.onOpen = function(ev) {
    this.connected = true;
    elation.events.fire({type: 'socket_connected'});
  };
  
  this.onMessage = function(ev) {
    elation.events.fire({type: 'new_message', data: ev.data});
  };
  
  this.onClose = function(ev) {
    elation.events.fire({type: 'socket_closed'});
    this.websocket = null;
  };
  
});

elation.extend('engine.systems.networking.webrtc', function() {
  // TODO:
  // take opts address and port
  // expose connect(), send(data), and close();
  // fire socket_connected, new_message, socket_closed
});
