elation.requireCSS("engine.sharing");

elation.require([ "ui.panel", "share.picker", "share.targets.imgur", "share.targets.dropbox", "share.targets.googledrive", "share.targets.youtube", "share.targets.file", "share.targets.facebook"], function() {
  elation.component.add('engine.sharing', function() {
    this.init = function() {
      elation.engine.sharing.extendclass.init.call(this);
      this.client = this.args.client;
      this.sharebutton = elation.ui.button({classname: 'janusweb_sharing', label: 'Share'});
      elation.events.add(this.sharebutton, 'ui_button_click', elation.bind(this, this.showShareDialog));
      this.client.buttons.add('sharing', this.sharebutton);
    }
    this.showShareDialog = function() {
      if (!this.dialog) {
        this.dialog = elation.engine.sharing.dialog({append: document.body, client: this.client, anchor: this.sharebutton});
        elation.events.add(this.dialog, 'ui_window_close', elation.bind(this, function() { this.sharebutton.show(); }));
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

      this.args.title = 'Sharing Options';
      this.args.right = true;
      this.args.bottom = 60;
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

      var resolutions = ['(window)', '512 x 256', '1280 x 720', '1920 x 1080', '3840 x ', '8k'];
      var formats = ['PNG', 'JPEG'];

      var panel = elation.ui.panel_horizontal({
        append: this
      });
      this.resolution = elation.ui.select({
        append: panel,
        label: 'Resolution',
        classname: 'engine_sharing_screenshot_resolution',
        items: resolutions
      });
      this.format = elation.ui.select({
        append: panel,
        label: 'Format',
        items: formats
      });
      this.button = elation.ui.button({
        append: panel,
        label: 'Share',
        events: {
          click: elation.bind(this, this.share)
        }
      });

      this.addclass('engine_sharing_screenshot');
    }
    this.share = function() {
      var client = this.client;
      client.screenshot({format: 'png'}).then(elation.bind(this, function(data) {
console.log('done');
        var imgdata = data.split(',')[1]; //data.image.data;

        var bytestr = atob(imgdata);
        var img = new Uint8Array(bytestr.length);
        for (var i = 0; i < bytestr.length; i++) {
          img[i] = bytestr.charCodeAt(i);
        }

        client.player.disable();
        this.picker.share({
          name: this.getScreenshotFilename('png'), 
          type: 'image/png',
          image: img, 
        }).then(elation.bind(this, function(upload) {
          //this.player.enable();
        }));
        var now = new Date().getTime();
        //console.log('finished png in ' + data.time.toFixed(2) + 'ms'); 
        console.log('finished png'); 
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
        default: '4096',
        items: resolutions
      });
      this.format = elation.ui.select({
        append: panel,
        label: 'Format',
        items: formats
      });
      this.button = elation.ui.button({
        append: panel,
        label: 'Share'
      });

      this.addclass('engine_sharing_screenshot360');
    }
    this.share = function(data) {
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

