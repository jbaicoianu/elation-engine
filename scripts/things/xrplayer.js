elation.require(['engine.things.generic', 'engine.things.camera'], function() {
  elation.component.add('engine.things.xrplayer', function() {
    this.postinit = function() {
      this.defineProperties({
        session: { type: 'object' }
      });

      if (this.session) {
        console.log('xr player gets a session', this.session);
        let sess = this.session;
        sess.addEventListener('inputsourceschange', (ev) => { this.handleInputSourceChange(ev); });

/*
        let inputSource = sess.getInputSources();
        for (let source in inputSources) {
console.log(' - inputSource:', source);
        }
*/
      }
    }
    this.handleInputSourceChange = function(ev) {
    }
  });
});

