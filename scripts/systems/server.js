elation.extend("engine.systems.server", function(args) {
  elation.implement(this, elation.engine.systems.system);
  var wrtc = require('wrtc');
  this.clients = {};
  this.adminClients = [];
  this.transport = 'websocket';
  var UPDATE_RATE = 40; // ms
  this.lastUpdate = null; //ms
  
  this.system_attach = function(ev) {
    console.log('INIT: networking server');
    this.world = this.engine.systems.world;
    this.server = new elation.engine.systems.server.websocket;
    this.adminServer = new elation.engine.systems.server.adminserver;
    
    var events = [
      [this.server, 'client_disconnected', this.onClientDisconnect],
      [this.server, 'client_connected', this.onClientConnect],
      [this.world, 'world_thing_add', this.onThingAdd],
      [this.adminServer, 'admin_client_connected', this.onAdminClientConnect],
      [this.world, 'world_thing_remove', this.onThingRemove],
      // [this.world, 'thing_change', this.onThingChange]
    ];
    
    for (var i = 0; i < events.length; i++) {
      this.addEvent(events[i]);  
    }
  };
  
  this.serialize_clients = function() {
    var obj = {};
    for (var client in this.clients) {
      if (this.clients.hasOwnProperty(client)) {
          obj[client] = {
            id: this.clients[client].id
          };
      }
    }
    return obj;
  };
  
  this.onAdminClientConnect = function(ev) {
    ev.data.channel.send(JSON.stringify(this.serialize_world()));
    this.adminClients.push(ev.data.channel);
  };
  
  this.addEvent = function(args) {
    elation.events.add(args[0], args[1], elation.bind(this, args[2]));
  };
  
  this.serialize_world = function() {
    var worldmsg = {
      type: 'world_data',
      data: this.world.serialize(true)
    };
    return worldmsg;
  };
 
  this.engine_frame = function() {
    this.sendChanges();
  };

  this.sendToAll = function(data) {
    for (var client in this.clients) {
      if (this.clients.hasOwnProperty(client)) {
        this.clients[client].send(data);
      }
    }
  };

  this.onClientConnect = function(ev) {
    var client = new elation.engine.systems.server.client({
      transport: 'websocket',
      id: ev.data.id,
      socket: ev.data.channel
    });
    this.clients[ev.data.id] = client;
    elation.events.add(client, 'received_id', elation.bind(this, this.sendWorldData));
    elation.events.add(client, 'new_player', elation.bind(this, this.handleNewPlayer));
    elation.events.add(client, 'thing_changed', elation.bind(this, this.onRemoteThingChange));
    elation.events.add(client, 'new_thing', elation.bind(this, this.onNewThing));
    elation.events.add(client, 'socket_message_sent', elation.bind(this, this.onSocketSend));
    console.log('client connected', client.id);
    client.send({ type: 'id_token', data: client.id });
  };
  
  this.handleNewPlayer = function(ev) {
    elation.events.fire({type: 'add_player', data: {id: ev.target.id, thing: ev.data.data.thing}});
  };
  
  this.handleNewThing = function(ev) {
    elation.events.fire({type: 'add_thing', data: {thing: ev.data.data.thing}});
  };
  
  this.sendWorldData = function(evt) {
    var client = this.clients[evt.data.data];
    client.send(this.serialize_world());
  };
  
  this.sendThingState = function(thing, state) {
    // states: 'thing_changed', 'thing_added', 'thing_removed'
    var client_id = thing.properties.player_id;
    var msg = { type: state, data: thing.serialize() };
    if (this.clients.hasOwnProperty(client_id)) {
      for (var client in this.clients) {
        if (this.clients.hasOwnProperty(client_id) && client != client_id) {
          this.clients[client].send(msg);
        }
      }
    }
    else {
      this.sendToAll(msg);
    }
  }
  this.onThingAdd = function(ev) {
    // bind thing remove here?
    console.log('thing add', ev.data.thing.name);
    this.sendThingState(ev.data.thing, 'thing_added');
  };
  
  this.onThingRemove = function(ev) {
    // TODO
    console.log('thing remove', ev.data.thing.name);
    this.sendThingState(ev.data.thing, 'thing_removed');
  };
  
  this.onThingChange = function(ev) {
    var thing = ev.target || ev.element;
    if (!thing.hasTag('thing_changed')) {
      thing.addTag('thing_changed');
    }
  };
  
  this.sendChanges = function() {
    if (Date.now() - this.lastUpdate > UPDATE_RATE) {
      var changed = this.world.getThingsByTag('thing_changed');
      for (var i = 0; i < changed.length; i++) {
        var thing = changed[i];
        thing.removeTag('thing_changed');
        this.sendThingState(thing, 'thing_changed');
        this.lastUpdate = Date.now(); 
      }
    }
  };
  
  this.onRemoteThingChange = function(ev) {
    elation.events.fire('remote_thing_change', ev.data);
  };
  
  this.removeClient = function(id) {
    delete this.clients[id];
  };
  
  this.onClientDisconnect = function(ev) {
    var client = this.clients[ev.data];
    elation.events.remove(client, 'received_id', elation.bind(this, this.sendWorldData));
    elation.events.remove(client, 'new_player', elation.bind(this, this.handleNewPlayer));
    this.removeClient(ev.data);
    elation.events.fire({type: 'destroy_player', data: ev.data});
    console.log('Client disconnected, num clients:', Object.keys(this.clients).length); 
  };
 
 this.onSocketSend = function(ev) {
   var msg = {
     type: ev.type,
     data: ev.data
   };
   this.adminServer.wss.clients.forEach(function(client){
     client.send(JSON.stringify(msg));
   });
 };
 
});

elation.extend("engine.systems.server.client", function(args) {
  /**
   * This object represents a client connection
   * 
   */
   
  this.transport = args.transport;
  this.id = args.id;
  this.socket = args.socket;
  this.lastMessage = null;
  
  this.transport = args.transport;
  
  //FIXME - make this a proper polymorphic object
  if (this.transport == 'webrtc') {
   this.send = function(data) {
      if (this.socket.readyState == 'open') {
        // console.log('sent a msg');
        data.timestamp = Date.now();
        this.socket.send(JSON.stringify(data));
      }
    };
    
    this.socket.onmessage = function(evt) {
      var msgdata = JSON.parse(evt.data);
      var timestamp = msgdata.timestamp;
      if (!this.lastMessage) this.lastMessage = timestamp;
      if (timestamp >= this.lastMessage) {
        // only fire an event if the message is newer than the last received msg
        var evdata = {
          type: msgdata.type,
          data: { id: this.id, data: msgdata.data }
        };
        elation.events.fire(evdata);
        this.lastMessage = timestamp;
      } else { console.log('discarded a message'); }
    };
  }
  if (this.transport == 'websocket') {
    this.send = function(data) {
      // console.log('foo');
      try {
        data.timestamp = Date.now();
        this.socket.send(JSON.stringify(data));
        elation.events.fire({type: 'socket_message_sent', data:{type: data.type, data: data.data, client_id: this.id, timestamp: data.timestamp}});
      }
      catch(e) { console.log(e) }
    };
    this.socket.on('message', function(msg, flags) {
      var msgdata = JSON.parse(msg);
      var timestamp = msgdata.timestamp;
      if (!this.lastMessage) this.lastMessage = timestamp;
      if (timestamp >= this.lastMessage) {
        // only fire an event if the message is newer than the last received msg
        var evdata = {
          type: msgdata.type,
          data: { id: this.id, data: msgdata.data }
        };
        elation.events.fire(evdata);
        this.lastMessage = timestamp;
      };
    });
  }
});



// FIXME - servers should take args for port/etc
elation.extend("engine.systems.server.websocket", function() {
  var wsServer = require('ws').Server,
      wss = new wsServer({ port: 9001 });  
  console.log('websocket server running on 9001')
  wss.on('connection', function(ws) {
    console.log('game server websocket conn');
    var id = Date.now();
    elation.events.fire({ type: 'client_connected', data: {id: id, channel: ws}});
    ws.on('close', function() {
      elation.events.fire({type: 'client_disconnected', data: id});
    });
  });
  
})

elation.extend("engine.systems.server.adminserver", function() {
  var wsServer = require('ws').Server;
  //FIXME - port hardcoded
  this.wss = new wsServer({ port: 9002 });  
  console.log('admin server running on 9002');
  this.wss.on('connection', function(ws) {
    console.log('admin server websocket conn');
    var id = Date.now();
    elation.events.fire({ type: 'admin_client_connected', data: {id: id, channel: ws}});
    ws.on('close', function() {
      elation.events.fire({type: 'admin_client_disconnected', data: id});
    });
  });
  
})
elation.extend("engine.systems.server.webrtc", function() {
  var http = require('http');
  var webrtc = require('wrtc');
  var ws = require('ws');
  var net = require('net');
  
  var MAX_REQUEST_LENGTH = 1024;
  var pc = null,
      offer = null,
      answer = null,
      remoteReceived = false;
  
  var dataChannelsettings = {
    // 'reliable': {
    //   ordered: false,
    //   maxRetransmits: 0
    // }
    'unreliable': {}
  };
  
  this.pendingDataChannels = [],
  this.dataChannels = [],
  this.pendingCandidates = [];
  
  var socketPort = 9001;
  var self = this;

  var wss = new ws.Server({'port': 9001});
  wss.on('connection', function(ws) {
    function doComplete(chan) {
      console.info('complete');
    }
    function doHandleError(error) { 
      throw error;
    }
    function doCreateAnswer() {
      remoteReceived = true;
      self.pendingCandidates.forEach(function(candidate) {
        if (candidate.sdp) {
          pc.addIceCandidate(new webrtc.RTCIceCandidate(candidate.sdp));
        }
      });
      pc.createAnswer(doSetLocalDesc, doHandleError);
    }
    function doSetLocalDesc(desc) {
      answer = desc;
      pc.setLocalDescription(desc, doSendAnswer, doHandleError);
    }
    function doSendAnswer() {
      ws.send(JSON.stringify(answer));
      console.log('awaiting data channels');
    }
  
    function doHandledataChannels() {
      var labels = Object.keys(dataChannelsettings);
      pc.ondatachannel = function(evt) {
        var channel = evt.channel;
        var id = Date.now();
        console.log('ondatachannel', channel.label, channel.readyState);
        self.pendingDataChannels.push(channel);

        channel.binaryType = 'arraybuffer';
  
        channel.onopen = function() {
          self.dataChannels.push(channel);
          self.pendingDataChannels.splice(self.pendingDataChannels.indexOf(channel), 1);
          elation.events.fire({ type: 'client_connected', data: {id: id, channel: channel}});
          doComplete(self.dataChannels[self.dataChannels.indexOf(channel)]);
          // }
        };
  
        channel.onmessage = function(evt) {
          var msgdata = JSON.parse(evt.data);
          console.log('onmessage:', evt.data);
          var evdata = {
            type: msgdata.type,
            data: {
              id: id,
              data: msgdata.data
            }
          }
          elation.events.fire(evdata);
        };
  
        channel.onclose = function() {
          self.dataChannels.splice(self.dataChannels.indexOf(channel), 1);
          elation.events.fire({type: 'client_disconnected', data: {id: id, channel: channel}})
          console.info('onclose');
        };
  
        channel.onerror = doHandleError;
      };
  
      doSetRemoteDesc();
    };
  
    function doSetRemoteDesc() {
      // console.info(offer);
      pc.setRemoteDescription(
        offer,
        doCreateAnswer,
        doHandleError
      );
    };
  
    ws.on('message', function(data) {
      data = JSON.parse(data);
      if('offer' == data.type) {
        offer = new webrtc.RTCSessionDescription(data);
        answer = null;
        remoteReceived = false;
  
        pc = new webrtc.RTCPeerConnection(
          { iceServers: [{ url:'stun:stun.l.google.com:19302' }] },
          { 'optional': [{DtlsSrtpKeyAgreement: false}] }
        );
  
        pc.onsignalingstatechange = function(state) {
          console.info('signaling state change:', state);
        };
  
        pc.oniceconnectionstatechange = function(state) {
          console.info('ice connection state change:', state);
        };
  
        pc.onicegatheringstatechange = function(state) {
          console.info('ice gathering state change:', state);
        };
  
        pc.onicecandidate = function(candidate) {
          ws.send(JSON.stringify(
            {'type': 'ice',
             'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
            }));
        };
  
        doHandledataChannels();
      } 
      else if('ice' == data.type) {
        if(remoteReceived) {
          if(data.sdp.candidate) {
            pc.addIceCandidate(new webrtc.RTCIceCandidate(data.sdp.candidate));
          }
        } 
        else {
          self.pendingCandidates.push(data);
        }
      }
    }.bind(this));
  }.bind(this));  

});