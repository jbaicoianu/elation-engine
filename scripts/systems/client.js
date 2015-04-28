

elation.extend("engine.systems.client", function(args) {
  elation.implement(this, elation.engine.systems.system);
  
  this.localSyncObjs = [];
  this.lastUpdate = Date.now();
  this.lastMessage = null;
  var UPDATE_INTERVAL = 25; // ms
  var MAX_EXTRAP_TIME = 100; // ms
  
  this.system_attach = function(ev) {
    console.log('INIT: networking client');
    this.world = this.engine.systems.world;
    console.log('this.world:', this.world);
    this.connection = new elation.engine.systems.client.connection({
      transport: 'websocket',
      host: 'dev.brandonhinshaw.us',
      port: '9001'
    });
    elation.events.add(this.connection.socket, 'new_message', elation.bind(this, this.onNewMessage));
    elation.events.add(this.world, 'world_thing_add', elation.bind(this, this.onNewThing));
    // elation.events.add(this.world, 'world_thing_remove', this.handleRemovedThing.bind(this))
  };
  
  this.onNewThing = function(ev) {
    // console.log('new thing', ev.data.thing);
    var thing = ev.data.thing;
    if (thing.hasTag('local_sync')) {
      console.log(ev.data);
      if (thing.type != 'vrcadeplayer') {
        var msgdata = {
          type: 'add_thing',
          data: { thing: thing.serialize() }
        };
        console.info('sending add_thing to server:', msgdata);
        this.send(msgdata);
      }
      else {
        elation.events.add(thing, 'thing_change', elation.bind(this, this.onThingChange));
      }
      thing.removeTag('local_sync');
      
    }
    // FIXME
  };
  
  this.sendNewThing = function() {
    var msg = {
      type: 'new_thing',
      data: 'test' 
    };
  }
  
  this.onThingChange = function(ev) {
    var thing = ev.target;
    if (!thing.hasTag('thing_changed')) {
      thing.addTag('thing_changed');
    }
  };
  
  this.sendChanges = function() {
    if (Date.now() - this.lastUpdate > UPDATE_INTERVAL) {
      var changed = this.world.getThingsByTag('thing_changed');
      for (var i = 0; i < changed.length; i++) {
        changed[i].removeTag('thing_changed');
        var msgdata = {
          type: 'thing_changed',
          data: {
            thing: changed[i].serialize(),
          }
        };
        this.send(msgdata); 
        this.lastUpdate = Date.now();
      }
    }
  };
  
  this.checkExtrapolation = function() {
    var things = this.world.getThingsByTag('extrapolating');
    if (things.length > 0){
      for (var i = 0; i < things.length; i++) {
        var thing = things[i];
        if (Date.now() - thing.lastUpdate > MAX_EXTRAP_TIME) {
          console.log('nulling out extrapolation');
          thing.set('velocity', [0, 0, 0], false);
          thing.set('acceleration', [0, 0, 0], false);
          thing.set('angular', [0, 0, 0], false);
          thing.refresh();
          thing.removeTag('extrapolating');
        }
      }
    }
  };
  
  this.onNewMessage = function(ev) {
    var msgdata = JSON.parse(ev.data);
    var timestamp = msgdata.timestamp;
    if (!this.lastMessage)  { this.lastMessage = timestamp; }
    if (timestamp >= this.lastMessage) {
    // console.log('new message', msg, typeof(msg));
      var evdata = { type: msgdata.type, data: msgdata.data };
      elation.events.fire(evdata);
    } else { console.log('discarded a message') }
  };

  this.send = function(data) {
    // console.log('sending data', data);
    data.timestamp = Date.now();
    this.connection.send(data);
    // console.log('networking: sent data:', data);
  };

  this.engine_frame = function(ev) {
    // this.sendMessages();
    // this.connection.send('ping');
    
    this.checkExtrapolation();
    this.sendChanges();
  };
  
  this.engine_stop = function(ev) {
    console.log('SHUTDOWN: networking');
    this.connection.close();
    this.connection = null;
  };
});

// client connection objects

elation.extend('engine.systems.client.connection', function(opts) {
  // a transport-agnostic object representing the connection from the client
  // to the server.
  // 
  // should take opts for transport, server host, server port
  // expose send()
  // fire events on connection, disconnection, and received messages
  
  var socketOpts = { host: opts.host, port: opts.port };
  this.init = function() {
    if (opts.transport == 'websocket') {
      this.socket = new elation.engine.systems.client.websocket(socketOpts);
    } 
    if (opts.transport == 'webrtc') {
      this.socket = new elation.engine.systems.client.webrtc(socketOpts);
    }
    
  };
  
  this.send = function(data) {
    this.socket.send(data);
  };
  
  this.init();
});

elation.extend('engine.systems.client.websocket', function(opts) {
  this.address = 'ws://' + opts.host + ':' + opts.port;
  
  this.init = function() {
    this.connect();
  };
  
  this.connect = function() {
    if (!this.websocket) {
      this.websocket = new WebSocket(this.address, 'arraybuffer');
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
    this.websocket.send(JSON.stringify(data));
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
  
  this.init();
});

elation.extend('engine.systems.client.webrtc', function(socketOpts) {
  // TODO:
  // take opts address and port
  // expose connect(), send(data), and close();
  // fire socket_connected, new_message, socket_closed
  
  this.connect = function() {
    doCreateDataChannels();
  };
  
  this.init = function() {
    this.connect();
  };
  
  this.send = function(data) {
    dataChannels['reliable'].send(JSON.stringify(data));
  };
  
  var host = socketOpts.host || window.location.host.split(':')[0];
  var bridge = socketOpts.host + ':' + socketOpts.port || window.location.toString().split('?')[1];
  
  // TODO: add other vender prefixes
  var RTCPeerConnection     = window.webkitRTCPeerConnection ||
                              window.mozRTCPeerConnection ||
                              window.RTCPeerConnection;

  var RTCSessionDescription = window.RTCSessionDescription ||
                              window.mozRTCSessionDescription;
                             
  var RTCIceCandidate       = window.RTCIceCandidate ||
                              window.mozRTCIceCandidate;

  var dataChannelSettings = {
    'reliable': {
          ordered: false,
          maxRetransmits: 0
        },
    // 'unreliable': {}
  };
  
  var pendingDataChannels = {};
  var dataChannels = {};
  var pendingCandidates = [];
  
  function doHandleError(error) {
    throw error;
  }
  
  function doComplete() {
    console.log('complete');
    elation.events.fire({type: 'socket_connected'});
  }
  
  function doWaitforDataChannels() {
    console.log('awaiting data channels');
  }
  
  this.channel = null;
  var ws = null;
  var pc = new RTCPeerConnection({ iceServers: [{ url:'stun:stun.l.google.com:19302' }] }, { 'optional': [] });
  
  // pc.onsignalingstatechange = function(event) {
  //   console.info("signaling state change: ", event.target.signalingState);
  // };
  // pc.oniceconnectionstatechange = function(event) {
  //   console.info("ice connection state change: ", event.target.iceConnectionState);
  // };
  // pc.onicegatheringstatechange = function(event) {
  //   console.info("ice gathering state change: ", event.target.iceGatheringState);
  // };
  
  pc.onicecandidate = function(event) {
    var candidate = event.candidate;
    if(!candidate) return;
    if(WebSocket.OPEN == ws.readyState) {
      ws.send(JSON.stringify(
        {'type': 'ice',
         'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
        }));
    } 
    else {
      pendingCandidates.push(candidate);
    }
  };
  
  function doCreateDataChannels() {
    var labels = Object.keys(dataChannelSettings);
    labels.forEach(function(label) {
      var channelOptions = dataChannelSettings[label];
      var channel = pendingDataChannels[label] = pc.createDataChannel(label, channelOptions);
      channel.binaryType = 'arraybuffer';
      channel.onopen = function() {
        this.channel = channel;
        console.info('onopen');
        dataChannels[label] = channel;
        delete pendingDataChannels[label];
        if(Object.keys(dataChannels).length === labels.length) {
          doComplete();
        }
      }.bind(this);
      channel.onmessage = function(event) {
        elation.events.fire({ type: 'new_message', data: event.data });
        // if('string' == typeof data) {
        //   console.log('onmessage:', data);
        // } else {
        //   console.log('onmessage:', new Uint8Array(data));
        // }
      };
      channel.onclose = function(event) {
        console.info('onclose');
        elation.events.fire({type:'socket_closed'});
      };
      channel.onerror = doHandleError;
    });
    doCreateOffer();
  }
  
  function doCreateOffer() {
    pc.createOffer(
      doSetLocalDesc,
      doHandleError
    );
  }
  
  function doSetLocalDesc(desc) {
    pc.setLocalDescription(
      new RTCSessionDescription(desc),
      doSendOffer.bind('test', desc),
      doHandleError
    );
  }
  
  function doSendOffer(offer) {
    ws = new WebSocket("ws://" + bridge);
    ws.onopen = function()
    {
      pendingCandidates.forEach(function(candidate)
      {
        ws.send(JSON.stringify(
          {'type': 'ice',
           'sdp': {'candidate': candidate.candidate, 'sdpMid': candidate.sdpMid, 'sdpMLineIndex': candidate.sdpMLineIndex}
          })
        );
      });
      ws.send(JSON.stringify(
        {'type': offer.type, 'sdp': offer.sdp})
      );
    };
    ws.onmessage = function(event) { 
      // console.log(candidate);
      var data = JSON.parse(event.data);
      if('answer' == data.type) {
        doSetRemoteDesc(data);
      } 
      else if('ice' == data.type && data.sdp.candidate) {
        var candidate = new RTCIceCandidate(data.sdp.candidate);
        if(candidate.candidate) {
          pc.addIceCandidate(candidate, handleAddIceCandidateSuccess, handleAddIceCandidateError);
        }
      }
    };
  }
  
  function handleAddIceCandidateSuccess() { }
  
  function handleAddIceCandidateError() { }
  
  function doSetRemoteDesc(desc) {
    pc.setRemoteDescription(
      new RTCSessionDescription(desc),
      doWaitforDataChannels,
      doHandleError
    );
  }
  this.init();
});
