elation.extend("engine.systems.server", function(args) {
  elation.implement(this, elation.engine.systems.system);
  var wrtc = require('wrtc');
  this.clients = {};
  this.transport = 'webrtc';
  
  this.system_attach = function(ev) {
    console.log('INIT: networking server');
    this.world = this.engine.systems.world;
    this.webrtc = new elation.engine.systems.server.webrtc;
    
    var events = [
      [this.webrtc, 'client_disconnected', this.onClientConnect],
      [this.webrtc, 'client_connected', this.onClientConnect],
      [this.world, 'world_thing_remove', this.onThingRemove],
      [this.world, 'world_thing_add', this.onThingAdd],
      // [this.world, 'world_thing_change', this.onThingChange]
    ];
    
    for (var i = 0; i < events.length; i++) {
      this.addEvent(events[i])  
    };
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

  };

  this.sendToAll = function(data) {
    for (var client in this.clients) {
      if (this.clients.hasOwnProperty(client)) {
        this.clients[client].send(data);
      }
    }
  }

  this.onClientConnect = function(ev) {
    var client = new elation.engine.systems.server.client({
      transport: 'webrtc',
      id: ev.data.id,
      socket: ev.data.channel
    });
    this.clients[ev.data.id] = client;
    elation.events.add(client, 'received_id', elation.bind(this, this.sendWorldData));
    elation.events.add(client, 'new_player', elation.bind(this, this.handleNewPlayer));
    elation.events.add(client, 'thing_changed', elation.bind(this, this.onRemoteThingChange));
    console.log('client connected', client.id);
    client.send({ type: 'id_token', data: client.id });
  };
  
  this.handleNewPlayer = function(ev) {
    // console.log(ev);
    elation.events.fire({type: 'add_player', data: {id: ev.target.id, thing: ev.data.data.thing}});
  }
  
  this.sendWorldData = function(evt) {
    // console.log('got id', evt);
    var client = this.clients[evt.data.data];
    client.send(this.serialize_world());
  };
  
  this.onThingAdd = function(ev) {
    console.log('thing add', ev.data.thing.name);
    this.sendToAll({ type: 'thing_added', data: ev.data.thing.serialize() });
  };
  
  this.onThingRemove = function(ev) {
    console.log('thing remove', ev.data.thing.name);
    this.sendToAll({ type:'thing_removed', data: ev.data.thing.name });
  };
  
  this.onThingChange = function(ev) {
    // console.log('world thing changed', ev.target.serialize());
    var msg = { type: 'thing_changed', data: ev.target.serialize() };
    if (this.clients.hasOwnProperty(ev.target.name)) {
      for (var client in this.clients) {
        if (this.clients.hasOwnProperty(client) && client != ev.target.name) {
          // console.log('sending msg to', client, 'about change in', ev.target.name);
          this.clients[client].send(msg);
        } 
      }
    }
    else {
      // console.log('sending to all');
      this.sendToAll(msg);
    }
  }
  
  this.onRemoteThingChange = function(ev) {
    elation.events.fire('remote_thing_change', ev.data);
  }
  
  this.removeClient = function(id) {
    delete this.clients[id];
  };
  
  this.onClientDisconnect = function(ev) {
    // console.log(ev);
    var client = this.clients[ev.data];
    elation.events.remove(client, 'received_id', elation.bind(this, this.sendWorldData));
    elation.events.remove(client, 'new_player', elation.bind(this, this.handleNewPlayer));
    this.removeClient(ev.data);
    elation.events.fire({type: 'destroy_player', data: ev.data});
    console.log('Client disconnected, num clients:', Object.keys(this.clients).length); 
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
  
});

elation.extend("engine.systems.server.webrtc", function() {
  var http = require('http');
  var webrtc = require('wrtc');
  var ws = require('ws');
  var net = require('net');
  
  // var args = require('minimist')(process.argv.slice(2));
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
          // console.log('onicecandidate', candidate);
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