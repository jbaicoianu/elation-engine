/**
 * @author James Baicoianu / http://www.baicoianu.com/
 */


var vertexShaderFlip = [
     'varying vec2 vUv;',

     'void main() {',

     '  vUv = vec2( uv.x, 1.0 - uv.y );',
     '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

     '}'
].join('\n');

THREE.RecordingPass = function ( ) {

	if ( THREE.CopyShader === undefined )
		console.error( "THREE.RecordingPass relies on THREE.CopyShader" );

	var shader = THREE.CopyShader;

	this.uniforms = THREE.UniformsUtils.clone( shader.uniforms );

	this.material = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: shader.vertexShader,
		fragmentShader: shader.fragmentShader

	} );
	this.flipmaterial = new THREE.ShaderMaterial( {

		uniforms: this.uniforms,
		vertexShader: vertexShaderFlip,
		fragmentShader: shader.fragmentShader

	} );

  var parameters = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, stencilBuffer: false };
  this.recordtarget = new THREE.WebGLRenderTarget(640, 480, parameters);
  this.lastframe = false;

  this.recording = true;

	this.enabled = true;
	this.renderToScreen = false;
	this.needsSwap = true;

  //this.ffmpeg = new FFMPEG({scriptbase: '/scripts/engine/external/ffmpeg/', useWorker: true, quality: 'veryfast'});


};

THREE.RecordingPass.prototype = {

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

    this.renderer = renderer;
		this.uniforms[ "tDiffuse" ].value = readBuffer;

		THREE.EffectComposer.quad.material = this.material;

		if ( this.renderToScreen ) {

			renderer.render( THREE.EffectComposer.scene, THREE.EffectComposer.camera );

		} else {

			renderer.render( THREE.EffectComposer.scene, THREE.EffectComposer.camera, writeBuffer, false );

		}
    if (this.recording) {
      this.lastframe = writeBuffer;
    }

	},

  getCaptureData: function(width, height) {
    var readBuffer = this.lastframe;
    var imgdata = false;
    if (readBuffer) {
      var size = [readBuffer.width, readBuffer.height];
      var target = this.recordtarget;
      if (width && height) {
        var scale = Math.min(width / size[0], height / size[1]);
        size[0] = Math.floor(size[0] * scale);
        size[1] = Math.floor(size[1] * scale);
      }
      if (target.width != size[0] || target.height != size[1]) {
        target.setSize(size[0], size[1]);
      }
      this.uniforms[ "tDiffuse" ].value = readBuffer;
      THREE.EffectComposer.quad.material = this.flipmaterial;
      this.renderer.render( THREE.EffectComposer.scene, THREE.EffectComposer.camera, target, false );

      var pixeldata = new Uint8Array(size[0] * size[1] * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, size[0], size[1], pixeldata);
      imgdata = new ImageData(new Uint8ClampedArray(pixeldata.buffer), size[0], size[1]);
    }
    return imgdata;
  },
  captureJPG: function(width, height) {
    return new Promise(function(resolve, reject) {
      var start = performance.now();
      var imgdata = this.getCaptureData(width, height);
      if (imgdata) {
        this.encodeImage(imgdata.data, imgdata.width, imgdata.height, 'jpg').then(function(img) {
          var end = performance.now();
          resolve({image: img, time: end - start});
        });
      } else {
        reject();
      }
    }.bind(this));
  },
  capturePNG: function(width, height) {
    return new Promise(function(resolve, reject) {
      var start = performance.now();
      var imgdata = this.getCaptureData(width, height);
      if (imgdata) {
        this.encodeImage(imgdata.data, imgdata.width, imgdata.height, 'png').then(function(img) {
          var end = performance.now();
          resolve({image: img, time: end - start});
        });
      } else {
        reject();
      }
    }.bind(this));
  },
  captureGIF: function(width, height, frames, delay) {
    return new Promise(function(resolve, reject) {
      var framepromises = [];
      for (var i = 0; i < frames; i++) {
        framepromises.push(this.scheduleGIFframe(width, height, i, delay * i));
      }
      Promise.all(framepromises).then(function(frames) {
        var start = performance.now();
        var gif = new GIF({workers: 2, quality: 10});
        for (var i = 0; i < frames.length; i++) {
          gif.addFrame(frames[i].image, {delay: (i == frames.length - 1 ? delay * 8 : delay)});
        }
        gif.on('finished', function(blob) {
          var end = performance.now();
          resolve({image: blob, time: end - start});
        });
        gif.render();
      });
    }.bind(this));
  },
  scheduleGIFframe: function(width, height, frame, delay) {
    return new Promise(function(resolve, reject) {
      setTimeout(function() { 
        //console.log('get frame', frame);
        var imgdata = this.getCaptureData(width, height);
        if (imgdata) {
          resolve({frame: frame, image: imgdata});
        } else {
          reject();
        }
      }.bind(this), delay);
    }.bind(this));
  },
  captureMP4: function(width, height, fps, time) {
    var delay = 1000 / fps;
    var numframes = time * fps;
    return new Promise(function(resolve, reject) {
      var framepromises = [];
      //var ffmpeg = this.ffmpeg;
      var ffmpeg = new FFMPEG({scriptbase: '/scripts/engine/external/ffmpeg/', useWorker: true, quality: 'veryfast', fps: fps});
      for (var i = 0; i < numframes; i++) {
        var promise = this.scheduleGIFframe(width, height, i, delay * i);
        framepromises.push(promise);
        promise.then(function(framedata) {
          ffmpeg.addFrame(framedata.image);
        });
      }
      framepromises[0].then(function(f) {
        var start = performance.now();
        ffmpeg.on('finished', function(blob) {
          var end = performance.now();
          resolve({image: blob, time: end - start});
        });
        ffmpeg.render('ultrafast');
      
      });
    }.bind(this));
  },
  encodeImage: function(pixeldata, width, height, format) {
    return new Promise(function(resolve, reject) {
      var worker = new Worker('/scripts/vrcade/imageworker-' + format + '.js');
      worker.addEventListener('message', function(ev) {
        resolve(ev.data);          
      }.bind(this));

      var workermsg = {
        width: width,
        height: height,
        format: format,
        data: pixeldata.buffer,
        timeStamp: new Date().getTime()
      };
      worker.postMessage(workermsg, [workermsg.data]);
    }.bind(this));
  }

};
