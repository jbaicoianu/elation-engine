/**
 * @author James Baicoianu
 */

THREE.PortalRenderPass = function ( camera ) {

	THREE.Pass.call( this );

  this.portals = [];
  this.maincamera = camera;
  this.clipscene = new THREE.Scene();
  this.clipmesh = new THREE.Mesh();
  this.clipmaterial = new THREE.MeshBasicMaterial({color: 0xff0000});
  this.clipmesh.matrixAutoUpdate = false;
  this.clipscene.add(this.clipmesh);

	this.clear = false;
	this.needsSwap = false;

};

THREE.PortalRenderPass.prototype = Object.assign( Object.create( THREE.Pass.prototype ), {

	constructor: THREE.PortalRenderPass,

	render: function ( renderer, writeBuffer, readBuffer, delta, maskActive ) {
    this.drawPortals(renderer, this.portals, writeBuffer, readBuffer);
    this.drawPortalsStencil(renderer, this.portals, writeBuffer, readBuffer);
  },
/*
  drawPortal: function ( renderer, portal, writeBuffer, readBuffer ) {
    this.drawPortalStencil(renderer, portal, writeBuffer, readBuffer);
    this.drawPortalScene(renderer, portal, writeBuffer, readBuffer);
  },
*/

  drawPortals: function(renderer, portals, writeBuffer, readBuffer) {
    for (var i = 0; i < portals.length; i++) {
      this.drawPortal(renderer, portals[i], writeBuffer, readBuffer);
    }
  },
  drawPortalsStencil: function(renderer, portals, writeBuffer, readBuffer) {
    var stencilscene = new THREE.Scene(); 
		var context = renderer.context;
		var state = renderer.state;
    // Finally, we render the portal object into the depth buffer without touching the color buffer, to prevent what's behind it from being drawn
		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );
		state.buffers.stencil.setTest( false );
		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( true );

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );
		//state.buffers.depth.setClear(true);
    renderer.clearDepth();
    for (var i = 0; i < portals.length; i++) {
      var portal = portals[i];

      var mesh = this.clipmesh;
      var portalmesh = portal.mesh;
      mesh.geometry = portal.clipmesh.geometry;
      mesh.material = new THREE.MeshBasicMaterial({color: 0xffffff * Math.random()});
      mesh.matrix.copy(portal.mesh.matrixWorld);
      mesh.matrixWorld.copy(portal.mesh.matrixWorld);
/*
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorld.copy(portals[i].clipmesh.matrixWorld);
      stencilscene.add(mesh);
*/
      renderer.render( this.clipscene, portal.camera, readBuffer, this.clear );
      renderer.render( this.clipscene, portal.camera, writeBuffer, this.clear );
    }


/*
		var context = renderer.context;
		var state = renderer.state;
		state.buffers.stencil.setTest( false );
		state.buffers.depth.setClear(true);
		state.buffers.color.setMask( true );
		state.buffers.depth.setMask( true );

console.log('clip cover', stencilscene, this.maincamera);
		state.buffers.stencil.setTest( false );
		renderer.render( stencilscene, this.maincamera, writeBuffer, this.clear );

		//state.buffers.depth.setClear(false);
		state.buffers.color.setMask( true );
		state.buffers.depth.setMask( true );
*/
  },

  drawPortal: function ( renderer, portal, writeBuffer, readBuffer ) {
		var context = renderer.context;
		var state = renderer.state;

    var mesh = this.clipmesh;
    var portalmesh = portal.mesh;
    mesh.geometry = portal.clipmesh.geometry;
    mesh.material = this.clipmaterial;
    mesh.matrix.copy(portal.mesh.matrixWorld);
    mesh.matrixWorld.copy(portal.mesh.matrixWorld);

		// set up stencil

		var writeValue, clearValue;

		if ( this.inverse ) {

			writeValue = 0;
			clearValue = 1;

		} else {

			writeValue = 1;
			clearValue = 0;

		}

		// First, we draw the stencil pattern
		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );
		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( false );
		state.buffers.stencil.setTest( true );
		state.buffers.stencil.setFunc( context.NEVER, 0, 0xffffffff );  // draw if == 1
		state.buffers.stencil.setOp( context.INCR, context.KEEP, context.KEEP );
		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );
		renderer.render( this.clipscene, portal.camera, readBuffer, this.clear );
		renderer.render( this.clipscene, portal.camera, writeBuffer, this.clear );


    // Next, we render the scene inside of the portal, clipped to the stencil we set above
		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );
		state.buffers.color.setMask( true );
		state.buffers.depth.setMask( true );
    
		state.buffers.stencil.setFunc( context.EQUAL, 1, 0xffffffff );  // draw if == 1
		state.buffers.stencil.setOp( context.KEEP, context.KEEP, context.KEEP );

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );
		renderer.render( portal.scene, portal.camera, this.renderToScreen ? null : readBuffer, this.clear );

/*
    // Finally, we render the portal object into the depth buffer without touching the color buffer, to prevent what's behind it from being drawn
		state.buffers.color.setLocked( false );
		state.buffers.depth.setLocked( false );
		state.buffers.stencil.setTest( false );
		state.buffers.color.setMask( false );
		state.buffers.depth.setMask( true );

		state.buffers.color.setLocked( true );
		state.buffers.depth.setLocked( true );
		renderer.render( this.clipscene, portal.camera, readBuffer, this.clear );
		renderer.render( this.clipscene, portal.camera, writeBuffer, this.clear );
*/
  },
  drawPortalScene: function( renderer, portal, writeBuffer, readBuffer ) {

  }
} );

