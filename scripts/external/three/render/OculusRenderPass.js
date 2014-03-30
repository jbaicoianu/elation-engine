/**
 * @author jbaicoianu / http://baicoianu.com/
 */

THREE.OculusRenderPass = function ( scene, camera, overrideMaterial, clearColor, clearAlpha ) {

	this.scene = scene;
	this.camera = camera;

	this.overrideMaterial = overrideMaterial;

	this.clearColor = clearColor;
	this.clearAlpha = ( clearAlpha !== undefined ) ? clearAlpha : 1;

	this.oldClearColor = new THREE.Color();
	this.oldClearAlpha = 1;

  this.oculuseffect = false;

	this.enabled = true;
	this.clear = false;
	this.needsSwap = false;

  this.initOculus();

};

THREE.OculusRenderPass.prototype = {

  initOculus: function() {
  },

	render: function ( renderer, writeBuffer, readBuffer, delta ) {

    if (!this.oculuseffect) {
      this.oculuseffect = new THREE.OculusRiftEffect(renderer, {renderTarget: writeBuffer});
    } else {
      this.oculuseffect.setOutputTarget(readBuffer);
    }
		this.scene.overrideMaterial = this.overrideMaterial;

		if ( this.clearColor ) {

			this.oldClearColor.copy( renderer.getClearColor() );
			this.oldClearAlpha = renderer.getClearAlpha();

			renderer.setClearColor( this.clearColor, this.clearAlpha );

		}

		this.oculuseffect.render( this.scene, this.camera, readBuffer, this.clear );

		if ( this.clearColor ) {

			renderer.setClearColor( this.oldClearColor, this.oldClearAlpha );

		}
		renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);

		this.scene.overrideMaterial = null;

		elation.events.fire({element: this, type: 'render'});
	}

};

