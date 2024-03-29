elation.require(['engine.things.label'], function() {
  elation.component.add('engine.things.label2d', function() {
    this.postinit = function() {
      elation.engine.things.label2d.extendclass.postinit.call(this);
      this.defineProperties({
        font: { type: 'string', default: 'sans-serif' },
        fontSize: { type: 'float', default: 64 },
        fontWeight: { type: 'string', default: 'normal' },
        background: { type: 'string', default: 'rgba(0,0,0,0)' },
        color: { type: 'color', default: 0xffffff },
        textShadowBlur: { type: 'int', default: 0 },
        textShadowColor: { type: 'string', default: 'black' },
        height: { type: 'float', default: 1 },
      });
      this.properties.size = 1;
      this.properties.thickness = .11;
      this.properties.align = 'center';
    }
    this.createTextGeometry = function(text) {
      var labelgen = this.getAssetWrapper();
      var aspect = labelgen.getAspectRatio(text);
      var label = labelgen.getLabel(text);
      var height = this.height;
      var width = height * aspect;
      var geometry = new THREE.PlaneGeometry(width, height);
      geometry.applyMatrix4(new THREE.Matrix4().makeTranslation(0, height/2, .02));
      return geometry;
    }
    this.createTextMaterial = function(text) {
      var labelgen = this.getAssetWrapper();
      var label = labelgen.getLabel(this.properties.text);
      var material = new THREE.MeshBasicMaterial({
        map: label,
        transparent: true,
        alphaTest: 0.6
      });
      return material;
    }
    this.setText = function(text) {
      this.properties.text = text;
      if (text.indexOf && text.indexOf('\n') != -1) {
        this.setMultilineText(text);
      } else {
        this.objects['3d'].geometry = this.createTextGeometry(text);
      }
      this.objects['3d'].material = this.material = this.createTextMaterial(text);
      this.refresh();
    }
    this.getAssetWrapper = function() {
      var color = (this.properties.color instanceof THREE.Color ? this.properties.color : new THREE.Color(this.properties.color));
      if (!this.labelgen) {
        var genname = ['label2d', this.properties.font, this.properties.fontSize, color.getHexString()].join('_');
        var asset = elation.engine.assets.find('labelgen', genname);
        if (!asset) {
          asset = elation.engine.assets.get({
            assettype: 'labelgen',
            assetname: genname,
            color: '#' + color.getHexString(),
            background: this.background,
            font: this.font,
            fontWeight: this.fontWeight,
            outlineSize: 8,
            textShadowBlur: this.textShadowBlur,
            textShadowColor: this.textShadowColor,
          });
        }
        this.labelgen = asset;
      }
      return this.labelgen;
    }
  }, elation.engine.things.label);
});

