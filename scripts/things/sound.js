elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.sound', function() {
    this.postinit = function() {
      this.defineProperties({
        src: { type: 'string' },
        autoplay: { type: 'boolean', default: true },
        loop: { type: 'boolean', default: true },
        distance: { type: 'float', default: 100 },
        volume: { type: 'float', default: 1 },
      });
      elation.events.add(this, 'thing_destroy', elation.bind(this, this.stop));

      Object.defineProperty(this, 'playing', { get: function() { if (this.audio) return this.audio.isPlaying; return false; } });
    }
    this.createObject3D = function() {
      //var geo = new THREE.BoxGeometry(.25, .25, .25);
      //var mat = new THREE.MeshLambertMaterial({color: 0x009900, emissive: 0x222222});
      //return new THREE.Mesh(geo, mat);
      return new THREE.Object3D();
    }
    this.createChildren = function() {
      if (!this.audio) {
        this.createAudio(this.properties.src);
      }
    }
    this.createAudio = function() {
      if (this.audio) {
        if (this.audio.isPlaying) {
          this.audio.stop();
        }
        this.objects['3d'].remove(this.audio);
      }
      var listener = this.engine.systems.sound.getRealListener();
      if (listener) {
        this.audio = new THREE.PositionalAudio(listener);
        this.audio.panner.maxDistance = this.properties.distance;
        this.audio.panner.maxDistance = this.properties.distance;
        this.audio.panner.distanceModel = 'linear';
        this.audio.autoplay = this.properties.autoplay;
        this.audio.setLoop(this.properties.loop);
        this.audio.setVolume(this.properties.volume);
        if (this.properties.src) {
          this.audio.load(this.properties.src);
        }
        this.objects['3d'].add(this.audio);
      }
    }
    this.load = function(url) {
      this.properties.src = url;
      if (this.audio.isPlaying) {
        this.audio.stop();
      }
      this.createAudio(url);
    }
    this.play = function() {
      if (this.audio && this.audio.source.buffer) {
        this.audio.play();
      }
    }
    this.pause = function() {
      if (this.audio && this.audio.isPlaying) {
        this.audio.pause();
      }
    }
    this.stop = function() {
      if (this.audio && this.audio.isPlaying) {
        this.audio.stop();
      }
    }
  }, elation.engine.things.generic);
});
