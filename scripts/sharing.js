elation.require([ "ui.panel", "share.picker", "share.targets.imgur", "share.targets.dropbox", "share.targets.googledrive", "share.targets.youtube", "share.targets.file", "share.targets.facebook"], function() {
  elation.requireCSS(["engine.sharing"]);


  elation.component.add('engine.sharing', function() {
    this.init = function() {
      elation.engine.sharing.extendclass.init.call(this);
      this.client = this.args.client;
    }
    this.showShareDialog = function() {
      if (!this.dialog) {
        this.dialog = elation.engine.sharing.dialog({append: document.body, client: this.client, anchor: this.args.anchor});
      } else {
        this.dialog.show();
      }
    }
    this.share = function(data) {
      this.showShareDialog();
      this.dialog.share(data);
    }
  }, elation.ui.base);
  elation.component.add('engine.sharing.dialog', function() {
    this.init = function() {
      this.client = this.args.client;

      this.anchor = this.args.anchor;

      var bottom = 100;

      this.args.title = 'Sharing Options';
      this.args.right = true;
      this.args.bottom = bottom;
      this.args.minimize = false;
      this.args.maximize = false;
      this.args.resizable = false;
      elation.engine.sharing.dialog.extendclass.init.call(this);
      this.addclass('engine_sharing');

      this.initPicker();

      this.sharetypes = {
        link: elation.engine.sharing.share_link({client: this.client, picker: this.sharepicker}),
        screenshot: elation.engine.sharing.share_screenshot({client: this.client, picker: this.sharepicker}),
        screenshot360: elation.engine.sharing.share_screenshot360({client: this.client, picker: this.sharepicker}),
        video: elation.engine.sharing.share_video({client: this.client, picker: this.sharepicker}),
      };
      this.selected = 'screenshot';

      this.tabs = elation.ui.tabbedcontent({
        append: this,
        items: [
          { name: 'link', label: 'Link', content: this.sharetypes.link },
          { name: 'screenshot', label: 'Screenshot', content: this.sharetypes.screenshot },
          { name: 'screenshot360', label: '360 Screenshot', content: this.sharetypes.screenshot360 },
          { name: 'video', label: 'Video', content: this.sharetypes.video, disabled: true },
        ],
        selected: this.selected,
        events: {
          tab_change: elation.bind(this, function(ev) { this.selected = ev.data.name; })
        }
      });
      this.setcontent(this.tabs);
    }
    this.initPicker = function() {
      this.sharepicker = elation.share.picker({append: document.body});
      var share = elation.config.get('share'),
          targets = share.targets || {};
      
      for (var k in targets) {
        var target = targets[k];
        if (!target.disabled && elation.share.targets[k]) {
          this.sharepicker.addShareTarget(elation.share.targets[k](target));
        }
      }
      console.log('did the picker', this.sharepicker);
    }
    this.share = function(data) {
      var type = this.selected;
      console.log('sharetype', type, this.sharetypes[type], this.tabs)
      if (this.sharetypes[type]) {
        this.sharetypes[type].share(data);
      }
    }
  }, elation.ui.window);
  elation.component.add('engine.sharing.share_link', function() {
    this.init = function() {
      elation.engine.sharing.share_link.extendclass.init.call(this);
      this.client = this.args.client;
      this.janusweb = this.client.janusweb;

      this.link = elation.ui.input({
        append: this,
        label: 'URL',
        value: this.janusweb.currentroom.url
      });
      this.button = elation.ui.button({
        append: this,
        label: 'Share'
      });
      this.addclass('engine_sharing_link');
    }
    this.share = function(data) {
    }
  }, elation.ui.panel_horizontal);
  elation.component.add('engine.sharing.share_screenshot', function() {
    this.init = function() {
      elation.engine.sharing.share_screenshot.extendclass.init.call(this);

      this.client = this.args.client;
      this.picker = this.args.picker;

      var resolutions = ['(window)', '512x256', '1280x720', '1920x1080', '3840x2160', '7680x4320'];
      var formats = ['png', 'jpg'];

      var panel = elation.ui.panel_horizontal({
        append: this
      });
      this.resolution = elation.ui.select({
        append: panel,
        label: 'Resolution',
        classname: 'engine_sharing_screenshot_resolution',
        items: resolutions,
        selected: resolutions[0]
      });
      this.format = elation.ui.select({
        append: panel,
        label: 'Format',
        items: formats,
        selected: 'png'
      });
      this.button = elation.ui.button({
        append: panel,
        label: 'Capture',
        events: {
          click: elation.bind(this, this.share)
        }
      });

      this.addclass('engine_sharing_screenshot');
    }
    this.share = function() {
      var client = this.client;
      var width = window.innerWidth, 
          height = window.innerHeight;
      if (this.resolution.value != '(window)') {
        var size = this.resolution.value.split('x');
        width = size[0];
        height = size[1];
        client.view.setrendersize(width, height);
        // Force a render after resizing
        client.view.render(0);
      }
      
      client.screenshot({width: width, height: height, format: this.format.value}).then(elation.bind(this, function(data) {
        var imgdata = data.split(',')[1]; //data.image.data;

        var bytestr = atob(imgdata);
        var img = new Uint8Array(bytestr.length);
        for (var i = 0; i < bytestr.length; i++) {
          img[i] = bytestr.charCodeAt(i);
        }

        var mimes = {
          png: 'image/png',
          jpg: 'image/jpeg'
        };
        client.player.disable();
        this.picker.share({
          name: this.getScreenshotFilename(this.format.value), 
          type: mimes[this.format.value],
          image: img, 
        }).then(elation.bind(this, function(upload) {
          //this.player.enable();
        }));
        var now = new Date().getTime();
        //console.log('finished png in ' + data.time.toFixed(2) + 'ms'); 
        console.log('finished screenshot'); 
        client.view.setrendersize(window.innerWidth, window.innerHeight);
      }));
    }
    this.getScreenshotFilename = function(extension) {
      if (!extension) extension = 'png';
      var now = new Date();
      function pad(n) {
        if (n < 10) return '0' + n;
        return n;
      }
      var prefix = elation.config.get('engine.screenshot.prefix', 'screenshot');
      var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      var time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      var filename = prefix + '-' + date + ' ' + time + '.' + extension
      return filename;
    }
  }, elation.ui.panel_vertical);
  elation.component.add('engine.sharing.share_screenshot360', function() {
    this.init = function() {
      elation.engine.sharing.share_screenshot360.extendclass.init.call(this);
      this.client = this.args.client;
      this.picker = this.args.picker;

      this.xmlns = {
        'GPano': 'http://ns.google.com/photos/1.0/panorama/'
      };

      var mappings = ['equirectangular', 'cubemap'],
          resolutions = ['512', '1024', '2048', '4096', '8192'],
          formats = ['PNG', 'JPEG'];

      var panel = elation.ui.panel_horizontal({
        append: this
      });

      this.mapping = elation.ui.select({
        append: panel,
        label: 'Type',
        items: mappings
      });
      this.resolution = elation.ui.select({
        append: panel,
        label: 'Resolution',
        selected: '4096',
        items: resolutions
      });
      this.format = elation.ui.select({
        append: panel,
        label: 'Format',
        items: formats
      });

      this.button = elation.ui.button({
        append: panel,
        label: 'Capture',
        events: {
          click: elation.bind(this, this.share)
        }
      });

      this.addclass('engine_sharing_screenshot360');
    }
    this.share = function() {
      var client = this.client;
      var width = this.resolution.value,
          height = this.resolution.value / 2;
      client.screenshot({type: 'equirectangular', format: 'jpg'}).then(elation.bind(this, function(data) {
        var imgdata = data.split(',')[1]; //data.image.data;

        var bytestr = atob(imgdata);
        var img = new Uint8Array(bytestr.length);
        var lastbyte = null;
        var inject = false;

        // merge the panorama exif data inito image binary data
        // XMP handling courtesy of https://github.com/panrafal/depthy/blob/master/app/scripts/classes/GDepthEncoder.js
        // FIXME - could be made more efficient!

        var offset = 0;
        for (var i = 0; i < bytestr.length; i++) {
          var byte = img[i+offset] = bytestr.charCodeAt(i);
          if (lastbyte == 0xff && (byte == 0xc0 || byte == 0xc2 || byte == 0xda)) {
            console.log('found exif thing', i);
            if (!inject) {
              inject = i-1;
            }
          }
          lastbyte = byte;
        }
        if (inject) {
          var xmp = this.getXMPBytes(data);
          offset = xmp.length;
          var newimg = new Uint8Array(bytestr.length + xmp.length);
          newimg.set(img.subarray(0, inject, 0));
          newimg.set(xmp, inject);
          newimg.set(img.subarray(inject), inject + offset);
          img = newimg;
        }

        client.player.disable();
        this.picker.share({
          name: this.getScreenshotFilename('jpg'), 
          type: 'image/jpg',
          image: img,
          //imageb64: data,
          width: width,
          height: height,
        }).then(elation.bind(this, function(upload) {
          //this.player.enable();
        }));
      }));
    }
    this.getXMPBytes = function(data) {
      var xmp = {
        'GPano:ProjectionType': 'equirectangular',
      };
      var xmpStr = this.getXMPString(xmp);
      var xmpData= this.buildXMPsegments(xmpStr);

      var len = 0;
      for (var i = 0; i < xmpData.length; i++) {
        len += xmpData[i].length;
      }
      var bytes = new Uint8Array(len);
      var offset = 0;
      for (var i = 0; i < xmpData.length; i++) {
        var d = xmpData[i];
        for (var j = 0; j < d.length; j++) {
          bytes[offset++] = d[j];
        }
      }

      return bytes;
    }
    this.getXMPString = function(props, xmlns) {
      var xmp = [], k;
      xmlns = xmlns || this.xmlns;
      xmp.push('<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Adobe XMP Core 5.1.0-jc003">');
      xmp.push('<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">');
      xmp.push('<rdf:Description rdf:about=""');
      for (k in xmlns) {
        xmp.push(' xmlns:', k, '="', xmlns[k], '"');
      }
      for (k in props) {
        // TODO html entities escaping
        xmp.push(' ', k, '="' + props[k] + '"');
      }
      xmp.push(' /></rdf:RDF></x:xmpmeta>');
      return xmp.join('');
    }


    this.buildXMPsegments = function(standardXMP) {
      var extendedUid, parts = [];
      console.log('StandardXMP: ', standardXMP.length);

      var xmpHeader = 'http://ns.adobe.com/xap/1.0/';

      parts.push(new Uint8Array([0xFF, 0xE1]));
      parts.push(this.makeUint16Buffer([2 + xmpHeader.length + 1 + standardXMP.length]));
      parts.push(this.stringToUint8Array(xmpHeader), new Uint8Array([0x00]));
      parts.push(this.stringToUint8Array(standardXMP));
      console.log('Written standardXMP');
      return parts;
    },

    this.makeUint16Buffer = function(arr, littleEndian) {
      var ab = new ArrayBuffer(arr.length * 2),
          dv = new DataView(ab);
      for (var i = 0; i < arr.length; ++i) {
        dv.setUint16(i * 2, arr[i], littleEndian);
      }
      return new Uint8Array(ab);
    }
    this.stringToUint8Array = function(str) {
      var arr = new Uint8Array(str.length);
      for (var i = 0; i < str.length; i++) {
        arr[i] = str.charCodeAt(i);
      }
      return arr;
    }


    this.getScreenshotFilename = function(extension) {
      if (!extension) extension = 'jpg';
      var now = new Date();
      function pad(n) {
        if (n < 10) return '0' + n;
        return n;
      }
      var prefix = elation.config.get('engine.screenshot.prefix', 'screenshot');
      var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
      var time = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
      var filename = prefix + '-equirectangular-' + date + ' ' + time + '.' + extension
      return filename;
    }
  }, elation.ui.panel);
  elation.component.add('engine.sharing.share_video', function() {
    this.init = function() {
      elation.engine.sharing.share_video.extendclass.init.call(this);
      this.client = this.args.client;

      this.addclass('engine_sharing_video');
    }
    this.share = function(data) {
    }
  }, elation.ui.panel);

  elation.component.add('engine.sharing.sharebutton', function() {
    this.init = function() {
      var type = this.args.type,
          picker = this.args.picker;

      var targets = picker.getTargetsForType(type);

      var button = elation.ui.button({
        append: this,
        label: 'Share on'
      });
      this.targets = elation.ui.select({
        append: this,
        items: targets
      });
    }
  }, elation.ui.panel_horizontal);

  elation.component.add('engine.sharing.config', function() {
    this.init = function() {
        this.args.orientation = 'vertical'
        elation.engine.sharing.config.extendclass.init.call(this);

        this.client = this.args.client;
        this.engine = this.client.engine;
        this.view = this.client.view;

        var sharepanel = elation.ui.panel({ 
          orientation: 'vertical',
          classname: 'engine_config_section',
          append: this 
        });

        var sharepicker = this.client.sharepicker;
        if (!sharepicker) {
          this.client.createSharePicker();
          sharepicker = this.client.sharepicker;
        }
        var foo = sharepicker.showTargetSelector('image/png', sharepanel).then(function(f) {
          console.log('mfing ya', f);
        });

      // Capture Settings
/*
      var capturelabel = elation.ui.labeldivider({
        append: capturepanel,
        label: 'Capture Settings'
      });
      var codec = elation.ui.select({
        append: capturepanel,
        label: 'Codec',
        items: ['h264','gif']
      });
      var fps = elation.ui.select({
        append: capturepanel,
        label: 'FPS',
        items: [5,10,25,30,45,60]
      });
*/
    }
  }, elation.ui.panel);
});

