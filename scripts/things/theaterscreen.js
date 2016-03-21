elation.require(['engine.things.generic'], function() {
  elation.component.add('engine.things.theaterscreen', function() {
    this.postinit = function() {
      this.defineProperties({
        autoplay: { type: 'boolean', default: false },
        loop: { type: 'boolean', default: true },
        curved: { type: 'boolean', default: false },
        clickable: { type: 'boolean', default: true },
        aspectratio: { type: 'float', default: 16/9 },
        screensize: { type: 'float', default: 25 },
        src: { type: 'string', default: '/media/space/textures/videos/sintel.mp4' },
      });
    }
    this.createVideo = function() {
      this.video = document.createElement('video');
      this.video.src = this.properties.src;
      this.video.autoplay = this.properties.autoplay;
      this.video.loop = this.properties.loop;
      this.video.crossOrigin = 'anonymous';

      //elation.events.add(this.video, 'ended', elation.bind(this, this.play));
      if (this.properties.clickable) {
        elation.events.add(this, 'click', elation.bind(this, this.play));
      }
      if (this.properties.autoplay) {
        elation.events.add(this.video, 'load', function() { alert('adsfadsf'); });
      }
    }
    this.createObject3D = function() {
      var screensize = this.properties.screensize;
      if (this.properties.curved) {
        var halfpi = Math.PI/2;
        var screenwidth = 3/4 * Math.PI;
        var screenheight = 1/4 * Math.PI;
        var geo = new THREE.SphereGeometry(screensize, 16, 8, 0 - (Math.PI - screenwidth) / 2, -screenwidth, (Math.PI - screenheight) / 2, screenheight);
      //geo.applyMatrix(new THREE.Matrix4().makeScale(1,1,.5));
        geo.applyMatrix(new THREE.Matrix4().makeTranslation(0, screensize * screenheight / 2, 0));
      } else {
        var geo = new THREE.PlaneGeometry(screensize * this.properties.aspectratio, screensize);
      }

      //document.body.appendChild(video);
      if (!this.video) {
        this.createVideo();
      }

      this.texture = new THREE.Texture( this.video );
      this.texture.minFilter = THREE.LinearFilter;
      this.texture.magFilter = THREE.LinearFilter;
      this.texture.format = THREE.RGBFormat;
      this.texture.generateMipmaps = false;
      var mat = new THREE.MeshBasicMaterial({emissive: 0x111111, side: THREE.DoubleSide, map: this.texture});

      this.refresh();

      return new THREE.Mesh(geo, mat);
    }
    this.play = function() {
  console.log(this.video.currentTime, this.video.paused, this.video.ended);
      if (this.video.currentTime > 0 && !this.video.paused && !this.video.ended) {
        this.video.pause();
      } else {
        this.video.play();
      }
    }
    this.preframe = function(ev) {
    }
    this.refresh = function() {
      if (!this.video) return;
      if ( this.video.readyState === this.video.HAVE_ENOUGH_DATA && this.lasttime != this.video.currentTime) {
        if ( this.texture ) this.texture.needsUpdate = true;
        elation.events.fire({element: this, type: 'thing_change'});
        this.lasttime = this.video.currentTime;
      }
      if (this.video.readyState != 4 || (!this.video.paused && !this.video.ended)) {
        requestAnimationFrame(elation.bind(this, this.refresh));
      }
    }
  }, elation.engine.things.generic);
});
