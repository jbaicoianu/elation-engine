/**
 * @author James Baicoianu / http://www.baicoianu.com/
 */

THREE.FlyControls = function ( object, domElement ) {

	this.object = object;

	this.domElement = ( domElement !== undefined ) ? domElement : document;
	if ( domElement ) this.domElement.setAttribute( 'tabindex', - 1 );

	// API

	this.movementSpeed = 1.0;
	this.rollSpeed = 0.005;

	this.dragToLook = false;
	this.autoForward = false;

	// disable default target object behavior

	// internals

	this.tmpQuaternion = new THREE.Quaternion();

	this.mouseStatus = 0;

	this.moveState = { up: 0, down: 0, left: 0, right: 0, forward: 0, back: 0, pitchUp: 0, pitchDown: 0, yawLeft: 0, yawRight: 0, rollLeft: 0, rollRight: 0 };
	this.moveVector = new THREE.Vector3( 0, 0, 0 );
	this.rotationVector = new THREE.Vector3( 0, 0, 0 );

	this.keydown = function ( event ) {

		if ( event.altKey ) {

			return;

		}

		//event.preventDefault();

		switch ( event.keyCode ) {

			case 16: /* shift */ this.movementSpeedMultiplier = .1; break;

			case 87: /*W*/ this.moveState.forward = 1; break;
			case 83: /*S*/ this.moveState.back = 1; break;

			case 65: /*A*/ this.moveState.left = 1; break;
			case 68: /*D*/ this.moveState.right = 1; break;

			case 82: /*R*/ this.moveState.up = 1; break;
			case 70: /*F*/ this.moveState.down = 1; break;

			case 38: /*up*/ this.moveState.pitchUp = 1; break;
			case 40: /*down*/ this.moveState.pitchDown = 1; break;

			case 37: /*left*/ this.moveState.yawLeft = 1; break;
			case 39: /*right*/ this.moveState.yawRight = 1; break;

			case 81: /*Q*/ this.moveState.rollLeft = 1; break;
			case 69: /*E*/ this.moveState.rollRight = 1; break;

		}

		this.updateMovementVector();
		this.updateRotationVector();

	};

	this.keyup = function ( event ) {

		switch ( event.keyCode ) {

			case 16: /* shift */ this.movementSpeedMultiplier = 1; break;

			case 87: /*W*/ this.moveState.forward = 0; break;
			case 83: /*S*/ this.moveState.back = 0; break;

			case 65: /*A*/ this.moveState.left = 0; break;
			case 68: /*D*/ this.moveState.right = 0; break;

			case 82: /*R*/ this.moveState.up = 0; break;
			case 70: /*F*/ this.moveState.down = 0; break;

			case 38: /*up*/ this.moveState.pitchUp = 0; break;
			case 40: /*down*/ this.moveState.pitchDown = 0; break;

			case 37: /*left*/ this.moveState.yawLeft = 0; break;
			case 39: /*right*/ this.moveState.yawRight = 0; break;

			case 81: /*Q*/ this.moveState.rollLeft = 0; break;
			case 69: /*E*/ this.moveState.rollRight = 0; break;

		}

		this.updateMovementVector();
		this.updateRotationVector();

	};

	this.mousedown = function ( event ) {

		if ( this.domElement !== document ) {

			this.domElement.focus();

		}

		event.preventDefault();
		event.stopPropagation();

		if ( this.dragToLook ) {

			this.mouseStatus ++;

		} else {

			switch ( event.button ) {

				case 0: this.moveState.forward = 1; break;
				case 2: this.moveState.back = 1; break;

			}

			this.updateMovementVector();

		}

	};

	this.mousemove = function ( event ) {

		if ( ! this.dragToLook || this.mouseStatus > 0 ) {

			var container = this.getContainerDimensions();
			var halfWidth = container.size[ 0 ] / 2;
			var halfHeight = container.size[ 1 ] / 2;

			this.moveState.yawLeft = - ( ( event.pageX - container.offset[ 0 ] ) - halfWidth ) / halfWidth;
			this.moveState.pitchDown = ( ( event.pageY - container.offset[ 1 ] ) - halfHeight ) / halfHeight;

			this.updateRotationVector();

		}

	};

	this.mouseup = function ( event ) {

		event.preventDefault();
		event.stopPropagation();

		if ( this.dragToLook ) {

			this.mouseStatus --;

			this.moveState.yawLeft = this.moveState.pitchDown = 0;

		} else {

			switch ( event.button ) {

				case 0: this.moveState.forward = 0; break;
				case 2: this.moveState.back = 0; break;

			}

			this.updateMovementVector();

		}

		this.updateRotationVector();

	};

	this.update = function ( delta ) {

		var moveMult = delta * this.movementSpeed;
		var rotMult = delta * this.rollSpeed;

		this.object.translateX( this.moveVector.x * moveMult );
		this.object.translateY( this.moveVector.y * moveMult );
		this.object.translateZ( this.moveVector.z * moveMult );

		this.tmpQuaternion.set( this.rotationVector.x * rotMult, this.rotationVector.y * rotMult, this.rotationVector.z * rotMult, 1 ).normalize();
		this.object.quaternion.multiply( this.tmpQuaternion );

		// expose the rotation vector for convenience
		this.object.rotation.setFromQuaternion( this.object.quaternion, this.object.rotation.order );


	};

	this.updateMovementVector = function () {

		var forward = ( this.moveState.forward || ( this.autoForward && ! this.moveState.back ) ) ? 1 : 0;

		this.moveVector.x = ( - this.moveState.left + this.moveState.right );
		this.moveVector.y = ( - this.moveState.down + this.moveState.up );
		this.moveVector.z = ( - forward + this.moveState.back );

		//console.log( 'move:', [ this.moveVector.x, this.moveVector.y, this.moveVector.z ] );

	};

	this.updateRotationVector = function () {

		this.rotationVector.x = ( - this.moveState.pitchDown + this.moveState.pitchUp );
		this.rotationVector.y = ( - this.moveState.yawRight + this.moveState.yawLeft );
		this.rotationVector.z = ( - this.moveState.rollRight + this.moveState.rollLeft );

		//console.log( 'rotate:', [ this.rotationVector.x, this.rotationVector.y, this.rotationVector.z ] );

	};

	this.getContainerDimensions = function () {

		if ( this.domElement != document ) {

			return {
				size: [ this.domElement.offsetWidth, this.domElement.offsetHeight ],
				offset: [ this.domElement.offsetLeft, this.domElement.offsetTop ]
			};

		} else {

			return {
				size: [ window.innerWidth, window.innerHeight ],
				offset: [ 0, 0 ]
			};

		}

	};

	function bind( scope, fn ) {

		return function () {

			fn.apply( scope, arguments );

		};

	}

	function contextmenu( event ) {

		event.preventDefault();

	}

	this.dispose = function () {

		this.domElement.removeEventListener( 'contextmenu', contextmenu, false );
		this.domElement.removeEventListener( 'mousedown', _mousedown, false );
		this.domElement.removeEventListener( 'mousemove', _mousemove, false );
		this.domElement.removeEventListener( 'mouseup', _mouseup, false );

		window.removeEventListener( 'keydown', _keydown, false );
		window.removeEventListener( 'keyup', _keyup, false );

	};

	var _mousemove = bind( this, this.mousemove );
	var _mousedown = bind( this, this.mousedown );
	var _mouseup = bind( this, this.mouseup );
	var _keydown = bind( this, this.keydown );
	var _keyup = bind( this, this.keyup );

	this.domElement.addEventListener( 'contextmenu', contextmenu, false );

	this.domElement.addEventListener( 'mousemove', _mousemove, false );
	this.domElement.addEventListener( 'mousedown', _mousedown, false );
	this.domElement.addEventListener( 'mouseup', _mouseup, false );

	window.addEventListener( 'keydown', _keydown, false );
	window.addEventListener( 'keyup', _keyup, false );

	this.updateMovementVector();
	this.updateRotationVector();

};
/**
 * @author qiao / https://github.com/qiao
 * @author mrdoob / http://mrdoob.com
 * @author alteredq / http://alteredqualia.com/
 * @author WestLangley / http://github.com/WestLangley
 * @author erich666 / http://erichaines.com
 */

// This set of controls performs orbiting, dollying (zooming), and panning.
// Unlike TrackballControls, it maintains the "up" direction object.up (+Y by default).
//
//    Orbit - left mouse / touch: one-finger move
//    Zoom - middle mouse, or mousewheel / touch: two-finger spread or squish
//    Pan - right mouse, or left mouse + ctrl/metaKey, or arrow keys / touch: two-finger move

THREE.OrbitControls = function ( object, domElement ) {

	this.object = object;

	this.domElement = ( domElement !== undefined ) ? domElement : document;

	// Set to false to disable this control
	this.enabled = true;

	// "target" sets the location of focus, where the object orbits around
	this.target = new THREE.Vector3();

	// How far you can dolly in and out ( PerspectiveCamera only )
	this.minDistance = 0;
	this.maxDistance = Infinity;

	// How far you can zoom in and out ( OrthographicCamera only )
	this.minZoom = 0;
	this.maxZoom = Infinity;

	// How far you can orbit vertically, upper and lower limits.
	// Range is 0 to Math.PI radians.
	this.minPolarAngle = 0; // radians
	this.maxPolarAngle = Math.PI; // radians

	// How far you can orbit horizontally, upper and lower limits.
	// If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
	this.minAzimuthAngle = - Infinity; // radians
	this.maxAzimuthAngle = Infinity; // radians

	// Set to true to enable damping (inertia)
	// If damping is enabled, you must call controls.update() in your animation loop
	this.enableDamping = false;
	this.dampingFactor = 0.25;

	// This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
	// Set to false to disable zooming
	this.enableZoom = true;
	this.zoomSpeed = 1.0;

	// Set to false to disable rotating
	this.enableRotate = true;
	this.rotateSpeed = 1.0;

	// Set to false to disable panning
	this.enablePan = true;
	this.panSpeed = 1.0;
	this.screenSpacePanning = false; // if true, pan in screen-space
	this.keyPanSpeed = 7.0;	// pixels moved per arrow key push

	// Set to true to automatically rotate around the target
	// If auto-rotate is enabled, you must call controls.update() in your animation loop
	this.autoRotate = false;
	this.autoRotateSpeed = 2.0; // 30 seconds per round when fps is 60

	// Set to false to disable use of the keys
	this.enableKeys = true;

	// The four arrow keys
	this.keys = { LEFT: 37, UP: 38, RIGHT: 39, BOTTOM: 40 };

	// Mouse buttons
	this.mouseButtons = { LEFT: THREE.MOUSE.LEFT, MIDDLE: THREE.MOUSE.MIDDLE, RIGHT: THREE.MOUSE.RIGHT };

	// for reset
	this.target0 = this.target.clone();
	this.position0 = this.object.position.clone();
	this.zoom0 = this.object.zoom;

	//
	// public methods
	//

	this.getPolarAngle = function () {

		return spherical.phi;

	};

	this.getAzimuthalAngle = function () {

		return spherical.theta;

	};

	this.saveState = function () {

		scope.target0.copy( scope.target );
		scope.position0.copy( scope.object.position );
		scope.zoom0 = scope.object.zoom;

	};

	this.reset = function () {

		scope.target.copy( scope.target0 );
		scope.object.position.copy( scope.position0 );
		scope.object.zoom = scope.zoom0;

		scope.object.updateProjectionMatrix();
		scope.dispatchEvent( changeEvent );

		scope.update();

		state = STATE.NONE;

	};

	// this method is exposed, but perhaps it would be better if we can make it private...
	this.update = function () {

		var offset = new THREE.Vector3();

		// so camera.up is the orbit axis
		var quat = new THREE.Quaternion().setFromUnitVectors( object.up, new THREE.Vector3( 0, 1, 0 ) );
		var quatInverse = quat.clone().inverse();

		var lastPosition = new THREE.Vector3();
		var lastQuaternion = new THREE.Quaternion();

		return function update() {

			var position = scope.object.position;

			offset.copy( position ).sub( scope.target );

			// rotate offset to "y-axis-is-up" space
			offset.applyQuaternion( quat );

			// angle from z-axis around y-axis
			spherical.setFromVector3( offset );

			if ( scope.autoRotate && state === STATE.NONE ) {

				rotateLeft( getAutoRotationAngle() );

			}

			spherical.theta += sphericalDelta.theta;
			spherical.phi += sphericalDelta.phi;

			// restrict theta to be between desired limits
			spherical.theta = Math.max( scope.minAzimuthAngle, Math.min( scope.maxAzimuthAngle, spherical.theta ) );

			// restrict phi to be between desired limits
			spherical.phi = Math.max( scope.minPolarAngle, Math.min( scope.maxPolarAngle, spherical.phi ) );

			spherical.makeSafe();


			spherical.radius *= scale;

			// restrict radius to be between desired limits
			spherical.radius = Math.max( scope.minDistance, Math.min( scope.maxDistance, spherical.radius ) );

			// move target to panned location
			scope.target.add( panOffset );

			offset.setFromSpherical( spherical );

			// rotate offset back to "camera-up-vector-is-up" space
			offset.applyQuaternion( quatInverse );

			position.copy( scope.target ).add( offset );

			scope.object.lookAt( scope.target );

			if ( scope.enableDamping === true ) {

				sphericalDelta.theta *= ( 1 - scope.dampingFactor );
				sphericalDelta.phi *= ( 1 - scope.dampingFactor );

				panOffset.multiplyScalar( 1 - scope.dampingFactor );

			} else {

				sphericalDelta.set( 0, 0, 0 );

				panOffset.set( 0, 0, 0 );

			}

			scale = 1;

			// update condition is:
			// min(camera displacement, camera rotation in radians)^2 > EPS
			// using small-angle approximation cos(x/2) = 1 - x^2 / 8

			if ( zoomChanged ||
				lastPosition.distanceToSquared( scope.object.position ) > EPS ||
				8 * ( 1 - lastQuaternion.dot( scope.object.quaternion ) ) > EPS ) {

				scope.dispatchEvent( changeEvent );

				lastPosition.copy( scope.object.position );
				lastQuaternion.copy( scope.object.quaternion );
				zoomChanged = false;

				return true;

			}

			return false;

		};

	}();

	this.dispose = function () {

		scope.domElement.removeEventListener( 'contextmenu', onContextMenu, false );
		scope.domElement.removeEventListener( 'mousedown', onMouseDown, false );
		scope.domElement.removeEventListener( 'wheel', onMouseWheel, false );

		scope.domElement.removeEventListener( 'touchstart', onTouchStart, false );
		scope.domElement.removeEventListener( 'touchend', onTouchEnd, false );
		scope.domElement.removeEventListener( 'touchmove', onTouchMove, false );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		window.removeEventListener( 'keydown', onKeyDown, false );

		//scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?

	};

	//
	// internals
	//

	var scope = this;

	var changeEvent = { type: 'change' };
	var startEvent = { type: 'start' };
	var endEvent = { type: 'end' };

	var STATE = { NONE: - 1, ROTATE: 0, DOLLY: 1, PAN: 2, TOUCH_ROTATE: 3, TOUCH_DOLLY_PAN: 4 };

	var state = STATE.NONE;

	var EPS = 0.000001;

	// current position in spherical coordinates
	var spherical = new THREE.Spherical();
	var sphericalDelta = new THREE.Spherical();

	var scale = 1;
	var panOffset = new THREE.Vector3();
	var zoomChanged = false;

	var rotateStart = new THREE.Vector2();
	var rotateEnd = new THREE.Vector2();
	var rotateDelta = new THREE.Vector2();

	var panStart = new THREE.Vector2();
	var panEnd = new THREE.Vector2();
	var panDelta = new THREE.Vector2();

	var dollyStart = new THREE.Vector2();
	var dollyEnd = new THREE.Vector2();
	var dollyDelta = new THREE.Vector2();

	function getAutoRotationAngle() {

		return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;

	}

	function getZoomScale() {

		return Math.pow( 0.95, scope.zoomSpeed );

	}

	function rotateLeft( angle ) {

		sphericalDelta.theta -= angle;

	}

	function rotateUp( angle ) {

		sphericalDelta.phi -= angle;

	}

	var panLeft = function () {

		var v = new THREE.Vector3();

		return function panLeft( distance, objectMatrix ) {

			v.setFromMatrixColumn( objectMatrix, 0 ); // get X column of objectMatrix
			v.multiplyScalar( - distance );

			panOffset.add( v );

		};

	}();

	var panUp = function () {

		var v = new THREE.Vector3();

		return function panUp( distance, objectMatrix ) {

			if ( scope.screenSpacePanning === true ) {

				v.setFromMatrixColumn( objectMatrix, 1 );

			} else {

				v.setFromMatrixColumn( objectMatrix, 0 );
				v.crossVectors( scope.object.up, v );

			}

			v.multiplyScalar( distance );

			panOffset.add( v );

		};

	}();

	// deltaX and deltaY are in pixels; right and down are positive
	var pan = function () {

		var offset = new THREE.Vector3();

		return function pan( deltaX, deltaY ) {

			var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

			if ( scope.object.isPerspectiveCamera ) {

				// perspective
				var position = scope.object.position;
				offset.copy( position ).sub( scope.target );
				var targetDistance = offset.length();

				// half of the fov is center to top of screen
				targetDistance *= Math.tan( ( scope.object.fov / 2 ) * Math.PI / 180.0 );

				// we use only clientHeight here so aspect ratio does not distort speed
				panLeft( 2 * deltaX * targetDistance / element.clientHeight, scope.object.matrix );
				panUp( 2 * deltaY * targetDistance / element.clientHeight, scope.object.matrix );

			} else if ( scope.object.isOrthographicCamera ) {

				// orthographic
				panLeft( deltaX * ( scope.object.right - scope.object.left ) / scope.object.zoom / element.clientWidth, scope.object.matrix );
				panUp( deltaY * ( scope.object.top - scope.object.bottom ) / scope.object.zoom / element.clientHeight, scope.object.matrix );

			} else {

				// camera neither orthographic nor perspective
				console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.' );
				scope.enablePan = false;

			}

		};

	}();

	function dollyIn( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale /= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom * dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	function dollyOut( dollyScale ) {

		if ( scope.object.isPerspectiveCamera ) {

			scale *= dollyScale;

		} else if ( scope.object.isOrthographicCamera ) {

			scope.object.zoom = Math.max( scope.minZoom, Math.min( scope.maxZoom, scope.object.zoom / dollyScale ) );
			scope.object.updateProjectionMatrix();
			zoomChanged = true;

		} else {

			console.warn( 'WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled.' );
			scope.enableZoom = false;

		}

	}

	//
	// event callbacks - update the object state
	//

	function handleMouseDownRotate( event ) {

		//console.log( 'handleMouseDownRotate' );

		rotateStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownDolly( event ) {

		//console.log( 'handleMouseDownDolly' );

		dollyStart.set( event.clientX, event.clientY );

	}

	function handleMouseDownPan( event ) {

		//console.log( 'handleMouseDownPan' );

		panStart.set( event.clientX, event.clientY );

	}

	function handleMouseMoveRotate( event ) {

		//console.log( 'handleMouseMoveRotate' );

		rotateEnd.set( event.clientX, event.clientY );

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();


	}

	function handleMouseMoveDolly( event ) {

		//console.log( 'handleMouseMoveDolly' );

		dollyEnd.set( event.clientX, event.clientY );

		dollyDelta.subVectors( dollyEnd, dollyStart );

		if ( dollyDelta.y > 0 ) {

			dollyIn( getZoomScale() );

		} else if ( dollyDelta.y < 0 ) {

			dollyOut( getZoomScale() );

		}

		dollyStart.copy( dollyEnd );

		scope.update();

	}

	function handleMouseMovePan( event ) {

		//console.log( 'handleMouseMovePan' );

		panEnd.set( event.clientX, event.clientY );

		panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

		pan( panDelta.x, panDelta.y );

		panStart.copy( panEnd );

		scope.update();

	}

	function handleMouseUp( event ) {

		 //console.log( 'handleMouseUp' );

	}

	function handleMouseWheel( event ) {

		 //console.log( 'handleMouseWheel' );

		if ( event.deltaY < 0 ) {

			dollyOut( getZoomScale() );

		} else if ( event.deltaY > 0 ) {

			dollyIn( getZoomScale() );

		}

		scope.update();

	}

	function handleKeyDown( event ) {

		////console.log( 'handleKeyDown' );

		switch ( event.keyCode ) {

			case scope.keys.UP:
				pan( 0, scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.BOTTOM:
				pan( 0, - scope.keyPanSpeed );
				scope.update();
				break;

			case scope.keys.LEFT:
				pan( scope.keyPanSpeed, 0 );
				scope.update();
				break;

			case scope.keys.RIGHT:
				pan( - scope.keyPanSpeed, 0 );
				scope.update();
				break;

		}

	}

	function handleTouchStartRotate( event ) {

		//console.log( 'handleTouchStartRotate' );

		rotateStart.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

	}

	function handleTouchStartDollyPan( event ) {

		//console.log( 'handleTouchStartDollyPan' );

		if ( scope.enableZoom ) {

			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

			var distance = Math.sqrt( dx * dx + dy * dy );

			dollyStart.set( 0, distance );

		}

		if ( scope.enablePan ) {

			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panStart.set( x, y );

		}

	}

	function handleTouchMoveRotate( event ) {

		//console.log( 'handleTouchMoveRotate' );

		rotateEnd.set( event.touches[ 0 ].pageX, event.touches[ 0 ].pageY );

		rotateDelta.subVectors( rotateEnd, rotateStart ).multiplyScalar( scope.rotateSpeed );

		var element = scope.domElement === document ? scope.domElement.body : scope.domElement;

		rotateLeft( 2 * Math.PI * rotateDelta.x / element.clientHeight ); // yes, height

		rotateUp( 2 * Math.PI * rotateDelta.y / element.clientHeight );

		rotateStart.copy( rotateEnd );

		scope.update();

	}

	function handleTouchMoveDollyPan( event ) {

		//console.log( 'handleTouchMoveDollyPan' );

		if ( scope.enableZoom ) {

			var dx = event.touches[ 0 ].pageX - event.touches[ 1 ].pageX;
			var dy = event.touches[ 0 ].pageY - event.touches[ 1 ].pageY;

			var distance = Math.sqrt( dx * dx + dy * dy );

			dollyEnd.set( 0, distance );

			dollyDelta.set( 0, Math.pow( dollyEnd.y / dollyStart.y, scope.zoomSpeed ) );

			dollyIn( dollyDelta.y );

			dollyStart.copy( dollyEnd );

		}

		if ( scope.enablePan ) {

			var x = 0.5 * ( event.touches[ 0 ].pageX + event.touches[ 1 ].pageX );
			var y = 0.5 * ( event.touches[ 0 ].pageY + event.touches[ 1 ].pageY );

			panEnd.set( x, y );

			panDelta.subVectors( panEnd, panStart ).multiplyScalar( scope.panSpeed );

			pan( panDelta.x, panDelta.y );

			panStart.copy( panEnd );

		}

		scope.update();

	}

	function handleTouchEnd( event ) {

		//console.log( 'handleTouchEnd' );

	}

	//
	// event handlers - FSM: listen for events and reset state
	//

	function onMouseDown( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		switch ( event.button ) {

			case scope.mouseButtons.LEFT:

				if ( event.ctrlKey || event.metaKey ) {

					if ( scope.enablePan === false ) return;

					handleMouseDownPan( event );

					state = STATE.PAN;

				} else {

					if ( scope.enableRotate === false ) return;

					handleMouseDownRotate( event );

					state = STATE.ROTATE;

				}

				break;

			case scope.mouseButtons.MIDDLE:

				if ( scope.enableZoom === false ) return;

				handleMouseDownDolly( event );

				state = STATE.DOLLY;

				break;

			case scope.mouseButtons.RIGHT:

				if ( scope.enablePan === false ) return;

				handleMouseDownPan( event );

				state = STATE.PAN;

				break;

		}

		if ( state !== STATE.NONE ) {

			document.addEventListener( 'mousemove', onMouseMove, false );
			document.addEventListener( 'mouseup', onMouseUp, false );

			scope.dispatchEvent( startEvent );

		}

	}

	function onMouseMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		switch ( state ) {

			case STATE.ROTATE:

				if ( scope.enableRotate === false ) return;

				handleMouseMoveRotate( event );

				break;

			case STATE.DOLLY:

				if ( scope.enableZoom === false ) return;

				handleMouseMoveDolly( event );

				break;

			case STATE.PAN:

				if ( scope.enablePan === false ) return;

				handleMouseMovePan( event );

				break;

		}

	}

	function onMouseUp( event ) {

		if ( scope.enabled === false ) return;

		handleMouseUp( event );

		document.removeEventListener( 'mousemove', onMouseMove, false );
		document.removeEventListener( 'mouseup', onMouseUp, false );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onMouseWheel( event ) {

		if ( scope.enabled === false || scope.enableZoom === false || ( state !== STATE.NONE && state !== STATE.ROTATE ) ) return;

		event.preventDefault();
		event.stopPropagation();

		scope.dispatchEvent( startEvent );

		handleMouseWheel( event );

		scope.dispatchEvent( endEvent );

	}

	function onKeyDown( event ) {

		if ( scope.enabled === false || scope.enableKeys === false || scope.enablePan === false ) return;

		handleKeyDown( event );

	}

	function onTouchStart( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

		switch ( event.touches.length ) {

			case 1:	// one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;

				handleTouchStartRotate( event );

				state = STATE.TOUCH_ROTATE;

				break;

			case 2:	// two-fingered touch: dolly-pan

				if ( scope.enableZoom === false && scope.enablePan === false ) return;

				handleTouchStartDollyPan( event );

				state = STATE.TOUCH_DOLLY_PAN;

				break;

			default:

				state = STATE.NONE;

		}

		if ( state !== STATE.NONE ) {

			scope.dispatchEvent( startEvent );

		}

	}

	function onTouchMove( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();
		event.stopPropagation();

		switch ( event.touches.length ) {

			case 1: // one-fingered touch: rotate

				if ( scope.enableRotate === false ) return;
				if ( state !== STATE.TOUCH_ROTATE ) return; // is this needed?

				handleTouchMoveRotate( event );

				break;

			case 2: // two-fingered touch: dolly-pan

				if ( scope.enableZoom === false && scope.enablePan === false ) return;
				if ( state !== STATE.TOUCH_DOLLY_PAN ) return; // is this needed?

				handleTouchMoveDollyPan( event );

				break;

			default:

				state = STATE.NONE;

		}

	}

	function onTouchEnd( event ) {

		if ( scope.enabled === false ) return;

		handleTouchEnd( event );

		scope.dispatchEvent( endEvent );

		state = STATE.NONE;

	}

	function onContextMenu( event ) {

		if ( scope.enabled === false ) return;

		event.preventDefault();

	}

	//

	scope.domElement.addEventListener( 'contextmenu', onContextMenu, false );

	scope.domElement.addEventListener( 'mousedown', onMouseDown, false );
	scope.domElement.addEventListener( 'wheel', onMouseWheel, false );

	scope.domElement.addEventListener( 'touchstart', onTouchStart, false );
	scope.domElement.addEventListener( 'touchend', onTouchEnd, false );
	scope.domElement.addEventListener( 'touchmove', onTouchMove, false );

	window.addEventListener( 'keydown', onKeyDown, false );

	// force an update at start

	this.update();

};

THREE.OrbitControls.prototype = Object.create( THREE.EventDispatcher.prototype );
THREE.OrbitControls.prototype.constructor = THREE.OrbitControls;

Object.defineProperties( THREE.OrbitControls.prototype, {

	center: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .center has been renamed to .target' );
			return this.target;

		}

	},

	// backward compatibility

	noZoom: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			return ! this.enableZoom;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noZoom has been deprecated. Use .enableZoom instead.' );
			this.enableZoom = ! value;

		}

	},

	noRotate: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			return ! this.enableRotate;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noRotate has been deprecated. Use .enableRotate instead.' );
			this.enableRotate = ! value;

		}

	},

	noPan: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			return ! this.enablePan;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noPan has been deprecated. Use .enablePan instead.' );
			this.enablePan = ! value;

		}

	},

	noKeys: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			return ! this.enableKeys;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .noKeys has been deprecated. Use .enableKeys instead.' );
			this.enableKeys = ! value;

		}

	},

	staticMoving: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			return ! this.enableDamping;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .staticMoving has been deprecated. Use .enableDamping instead.' );
			this.enableDamping = ! value;

		}

	},

	dynamicDampingFactor: {

		get: function () {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			return this.dampingFactor;

		},

		set: function ( value ) {

			console.warn( 'THREE.OrbitControls: .dynamicDampingFactor has been renamed. Use .dampingFactor instead.' );
			this.dampingFactor = value;

		}

	}

} );

/**
 * @author arodic / https://github.com/arodic
 */

THREE.TransformControls = function ( camera, domElement ) {

	if ( domElement === undefined ) {

		console.warn( 'THREE.TransformControls: The second parameter "domElement" is now mandatory.' );
		domElement = document;

	}

	THREE.Object3D.call( this );

	this.visible = false;
	this.domElement = domElement;

	var _gizmo = new THREE.TransformControlsGizmo();
	this.add( _gizmo );

	var _plane = new THREE.TransformControlsPlane();
	this.add( _plane );

	var scope = this;

	// Define properties with getters/setter
	// Setting the defined property will automatically trigger change event
	// Defined properties are passed down to gizmo and plane

	defineProperty( "camera", camera );
	defineProperty( "object", undefined );
	defineProperty( "enabled", true );
	defineProperty( "axis", null );
	defineProperty( "mode", "translate" );
	defineProperty( "translationSnap", null );
	defineProperty( "rotationSnap", null );
	defineProperty( "scaleSnap", null );
	defineProperty( "space", "world" );
	defineProperty( "size", 1 );
	defineProperty( "dragging", false );
	defineProperty( "showX", true );
	defineProperty( "showY", true );
	defineProperty( "showZ", true );

	var changeEvent = { type: "change" };
	var mouseDownEvent = { type: "mouseDown" };
	var mouseUpEvent = { type: "mouseUp", mode: scope.mode };
	var objectChangeEvent = { type: "objectChange" };

	// Reusable utility variables

	var raycaster = new THREE.Raycaster();

	function intersectObjectWithRay( object, raycaster, includeInvisible ) {

		var allIntersections = raycaster.intersectObject( object, true );

		for ( var i = 0; i < allIntersections.length; i ++ ) {

			if ( allIntersections[ i ].object.visible || includeInvisible ) {

				return allIntersections[ i ];

			}

		}

		return false;

	}

	var _tempVector = new THREE.Vector3();
	var _tempVector2 = new THREE.Vector3();
	var _tempQuaternion = new THREE.Quaternion();
	var _unit = {
		X: new THREE.Vector3( 1, 0, 0 ),
		Y: new THREE.Vector3( 0, 1, 0 ),
		Z: new THREE.Vector3( 0, 0, 1 )
	};

	var pointStart = new THREE.Vector3();
	var pointEnd = new THREE.Vector3();
	var offset = new THREE.Vector3();
	var rotationAxis = new THREE.Vector3();
	var startNorm = new THREE.Vector3();
	var endNorm = new THREE.Vector3();
	var rotationAngle = 0;

	var cameraPosition = new THREE.Vector3();
	var cameraQuaternion = new THREE.Quaternion();
	var cameraScale = new THREE.Vector3();

	var parentPosition = new THREE.Vector3();
	var parentQuaternion = new THREE.Quaternion();
	var parentQuaternionInv = new THREE.Quaternion();
	var parentScale = new THREE.Vector3();

	var worldPositionStart = new THREE.Vector3();
	var worldQuaternionStart = new THREE.Quaternion();
	var worldScaleStart = new THREE.Vector3();

	var worldPosition = new THREE.Vector3();
	var worldQuaternion = new THREE.Quaternion();
	var worldQuaternionInv = new THREE.Quaternion();
	var worldScale = new THREE.Vector3();

	var eye = new THREE.Vector3();

	var positionStart = new THREE.Vector3();
	var quaternionStart = new THREE.Quaternion();
	var scaleStart = new THREE.Vector3();

	// TODO: remove properties unused in plane and gizmo

	defineProperty( "worldPosition", worldPosition );
	defineProperty( "worldPositionStart", worldPositionStart );
	defineProperty( "worldQuaternion", worldQuaternion );
	defineProperty( "worldQuaternionStart", worldQuaternionStart );
	defineProperty( "cameraPosition", cameraPosition );
	defineProperty( "cameraQuaternion", cameraQuaternion );
	defineProperty( "pointStart", pointStart );
	defineProperty( "pointEnd", pointEnd );
	defineProperty( "rotationAxis", rotationAxis );
	defineProperty( "rotationAngle", rotationAngle );
	defineProperty( "eye", eye );

	{

		domElement.addEventListener( "mousedown", onPointerDown, false );
		domElement.addEventListener( "touchstart", onPointerDown, false );
		domElement.addEventListener( "mousemove", onPointerHover, false );
		domElement.addEventListener( "touchmove", onPointerHover, false );
		domElement.addEventListener( "touchmove", onPointerMove, false );
		scope.domElement.ownerDocument.addEventListener( "mouseup", onPointerUp, false );
		domElement.addEventListener( "touchend", onPointerUp, false );
		domElement.addEventListener( "touchcancel", onPointerUp, false );
		domElement.addEventListener( "touchleave", onPointerUp, false );

	}

	this.dispose = function () {

		domElement.removeEventListener( "mousedown", onPointerDown );
		domElement.removeEventListener( "touchstart", onPointerDown );
		domElement.removeEventListener( "mousemove", onPointerHover );
		scope.domElement.ownerDocument.removeEventListener( "mousemove", onPointerMove );
		domElement.removeEventListener( "touchmove", onPointerHover );
		domElement.removeEventListener( "touchmove", onPointerMove );
		scope.domElement.ownerDocument.removeEventListener( "mouseup", onPointerUp );
		domElement.removeEventListener( "touchend", onPointerUp );
		domElement.removeEventListener( "touchcancel", onPointerUp );
		domElement.removeEventListener( "touchleave", onPointerUp );

		this.traverse( function ( child ) {

			if ( child.geometry ) child.geometry.dispose();
			if ( child.material ) child.material.dispose();

		} );

	};

	// Set current object
	this.attach = function ( object ) {

		this.object = object;
		this.visible = true;

		return this;

	};

	// Detatch from object
	this.detach = function () {

		this.object = undefined;
		this.visible = false;
		this.axis = null;

		return this;

	};

	// Defined getter, setter and store for a property
	function defineProperty( propName, defaultValue ) {

		var propValue = defaultValue;

		Object.defineProperty( scope, propName, {

			get: function () {

				return propValue !== undefined ? propValue : defaultValue;

			},

			set: function ( value ) {

				if ( propValue !== value ) {

					propValue = value;
					_plane[ propName ] = value;
					_gizmo[ propName ] = value;

					scope.dispatchEvent( { type: propName + "-changed", value: value } );
					scope.dispatchEvent( changeEvent );

				}

			}

		} );

		scope[ propName ] = defaultValue;
		_plane[ propName ] = defaultValue;
		_gizmo[ propName ] = defaultValue;

	}

	// updateMatrixWorld  updates key transformation variables
	this.updateMatrixWorld = function () {

		if ( this.object !== undefined ) {

			this.object.updateMatrixWorld();

			if ( this.object.parent === null ) {

				console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

			} else {

				this.object.parent.matrixWorld.decompose( parentPosition, parentQuaternion, parentScale );

			}

			this.object.matrixWorld.decompose( worldPosition, worldQuaternion, worldScale );

			parentQuaternionInv.copy( parentQuaternion ).inverse();
			worldQuaternionInv.copy( worldQuaternion ).inverse();

		}

		this.camera.updateMatrixWorld();
		this.camera.matrixWorld.decompose( cameraPosition, cameraQuaternion, cameraScale );

		eye.copy( cameraPosition ).sub( worldPosition ).normalize();

		THREE.Object3D.prototype.updateMatrixWorld.call( this );

	};

	this.pointerHover = function ( pointer ) {

		if ( this.object === undefined || this.dragging === true || ( pointer.button !== undefined && pointer.button !== 0 ) ) return;

		raycaster.setFromCamera( pointer, this.camera );

		var intersect = intersectObjectWithRay( _gizmo.picker[ this.mode ], raycaster );

		if ( intersect ) {

			this.axis = intersect.object.name;

		} else {

			this.axis = null;

		}

	};

	this.pointerDown = function ( pointer ) {

		if ( this.object === undefined || this.dragging === true || ( pointer.button !== undefined && pointer.button !== 0 ) ) return;

		if ( ( pointer.button === 0 || pointer.button === undefined ) && this.axis !== null ) {

			raycaster.setFromCamera( pointer, this.camera );

			var planeIntersect = intersectObjectWithRay( _plane, raycaster, true );

			if ( planeIntersect ) {

				var space = this.space;

				if ( this.mode === 'scale' ) {

					space = 'local';

				} else if ( this.axis === 'E' || this.axis === 'XYZE' || this.axis === 'XYZ' ) {

					space = 'world';

				}

				if ( space === 'local' && this.mode === 'rotate' ) {

					var snap = this.rotationSnap;

					if ( this.axis === 'X' && snap ) this.object.rotation.x = Math.round( this.object.rotation.x / snap ) * snap;
					if ( this.axis === 'Y' && snap ) this.object.rotation.y = Math.round( this.object.rotation.y / snap ) * snap;
					if ( this.axis === 'Z' && snap ) this.object.rotation.z = Math.round( this.object.rotation.z / snap ) * snap;

				}

				this.object.updateMatrixWorld();
				this.object.parent.updateMatrixWorld();

				positionStart.copy( this.object.position );
				quaternionStart.copy( this.object.quaternion );
				scaleStart.copy( this.object.scale );

				this.object.matrixWorld.decompose( worldPositionStart, worldQuaternionStart, worldScaleStart );

				pointStart.copy( planeIntersect.point ).sub( worldPositionStart );

			}

			this.dragging = true;
			mouseDownEvent.mode = this.mode;
			this.dispatchEvent( mouseDownEvent );

		}

	};

	this.pointerMove = function ( pointer ) {

		var axis = this.axis;
		var mode = this.mode;
		var object = this.object;
		var space = this.space;

		if ( mode === 'scale' ) {

			space = 'local';

		} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

			space = 'world';

		}

		if ( object === undefined || axis === null || this.dragging === false || ( pointer.button !== undefined && pointer.button !== 0 ) ) return;

		raycaster.setFromCamera( pointer, this.camera );

		var planeIntersect = intersectObjectWithRay( _plane, raycaster, true );

		if ( ! planeIntersect ) return;

		pointEnd.copy( planeIntersect.point ).sub( worldPositionStart );

		if ( mode === 'translate' ) {

			// Apply translate

			offset.copy( pointEnd ).sub( pointStart );

			if ( space === 'local' && axis !== 'XYZ' ) {

				offset.applyQuaternion( worldQuaternionInv );

			}

			if ( axis.indexOf( 'X' ) === - 1 ) offset.x = 0;
			if ( axis.indexOf( 'Y' ) === - 1 ) offset.y = 0;
			if ( axis.indexOf( 'Z' ) === - 1 ) offset.z = 0;

			if ( space === 'local' && axis !== 'XYZ' ) {

				offset.applyQuaternion( quaternionStart ).divide( parentScale );

			} else {

				offset.applyQuaternion( parentQuaternionInv ).divide( parentScale );

			}

			object.position.copy( offset ).add( positionStart );

			// Apply translation snap

			if ( this.translationSnap ) {

				if ( space === 'local' ) {

					object.position.applyQuaternion( _tempQuaternion.copy( quaternionStart ).inverse() );

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					object.position.applyQuaternion( quaternionStart );

				}

				if ( space === 'world' ) {

					if ( object.parent ) {

						object.position.add( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

					if ( axis.search( 'X' ) !== - 1 ) {

						object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Y' ) !== - 1 ) {

						object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

					}

					if ( axis.search( 'Z' ) !== - 1 ) {

						object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

					}

					if ( object.parent ) {

						object.position.sub( _tempVector.setFromMatrixPosition( object.parent.matrixWorld ) );

					}

				}

			}

		} else if ( mode === 'scale' ) {

			if ( axis.search( 'XYZ' ) !== - 1 ) {

				var d = pointEnd.length() / pointStart.length();

				if ( pointEnd.dot( pointStart ) < 0 ) d *= - 1;

				_tempVector2.set( d, d, d );

			} else {

				_tempVector.copy( pointStart );
				_tempVector2.copy( pointEnd );

				_tempVector.applyQuaternion( worldQuaternionInv );
				_tempVector2.applyQuaternion( worldQuaternionInv );

				_tempVector2.divide( _tempVector );

				if ( axis.search( 'X' ) === - 1 ) {

					_tempVector2.x = 1;

				}

				if ( axis.search( 'Y' ) === - 1 ) {

					_tempVector2.y = 1;

				}

				if ( axis.search( 'Z' ) === - 1 ) {

					_tempVector2.z = 1;

				}

			}

			// Apply scale

			object.scale.copy( scaleStart ).multiply( _tempVector2 );

			if ( this.scaleSnap ) {

				if ( axis.search( 'X' ) !== - 1 ) {

					object.scale.x = Math.round( object.scale.x / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Y' ) !== - 1 ) {

					object.scale.y = Math.round( object.scale.y / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

				if ( axis.search( 'Z' ) !== - 1 ) {

					object.scale.z = Math.round( object.scale.z / this.scaleSnap ) * this.scaleSnap || this.scaleSnap;

				}

			}

		} else if ( mode === 'rotate' ) {

			offset.copy( pointEnd ).sub( pointStart );

			var ROTATION_SPEED = 20 / worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

			if ( axis === 'E' ) {

				rotationAxis.copy( eye );
				rotationAngle = pointEnd.angleTo( pointStart );

				startNorm.copy( pointStart ).normalize();
				endNorm.copy( pointEnd ).normalize();

				rotationAngle *= ( endNorm.cross( startNorm ).dot( eye ) < 0 ? 1 : - 1 );

			} else if ( axis === 'XYZE' ) {

				rotationAxis.copy( offset ).cross( eye ).normalize();
				rotationAngle = offset.dot( _tempVector.copy( rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

			} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

				rotationAxis.copy( _unit[ axis ] );

				_tempVector.copy( _unit[ axis ] );

				if ( space === 'local' ) {

					_tempVector.applyQuaternion( worldQuaternion );

				}

				rotationAngle = offset.dot( _tempVector.cross( eye ).normalize() ) * ROTATION_SPEED;

			}

			// Apply rotation snap

			if ( this.rotationSnap ) rotationAngle = Math.round( rotationAngle / this.rotationSnap ) * this.rotationSnap;

			this.rotationAngle = rotationAngle;

			// Apply rotate
			if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

				object.quaternion.copy( quaternionStart );
				object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( rotationAxis, rotationAngle ) ).normalize();

			} else {

				rotationAxis.applyQuaternion( parentQuaternionInv );
				object.quaternion.copy( _tempQuaternion.setFromAxisAngle( rotationAxis, rotationAngle ) );
				object.quaternion.multiply( quaternionStart ).normalize();

			}

		}

		this.dispatchEvent( changeEvent );
		this.dispatchEvent( objectChangeEvent );

	};

	this.pointerUp = function ( pointer ) {

		if ( pointer.button !== undefined && pointer.button !== 0 ) return;

		if ( this.dragging && ( this.axis !== null ) ) {

			mouseUpEvent.mode = this.mode;
			this.dispatchEvent( mouseUpEvent );

		}

		this.dragging = false;

		if ( pointer.button === undefined ) this.axis = null;

	};

	// normalize mouse / touch pointer and remap {x,y} to view space.

	function getPointer( event ) {

		if ( scope.domElement.ownerDocument.pointerLockElement ) {

			return {
				x: 0,
				y: 0,
				button: event.button
			};

		} else {

			var pointer = event.changedTouches ? event.changedTouches[ 0 ] : event;

			var rect = domElement.getBoundingClientRect();

			return {
				x: ( pointer.clientX - rect.left ) / rect.width * 2 - 1,
				y: - ( pointer.clientY - rect.top ) / rect.height * 2 + 1,
				button: event.button
			};

		}

	}

	// mouse / touch event handlers

	function onPointerHover( event ) {

		if ( ! scope.enabled ) return;

		scope.pointerHover( getPointer( event ) );

	}

	function onPointerDown( event ) {

		if ( ! scope.enabled ) return;

		scope.domElement.ownerDocument.addEventListener( "mousemove", onPointerMove, false );

		scope.pointerHover( getPointer( event ) );
		scope.pointerDown( getPointer( event ) );

	}

	function onPointerMove( event ) {

		if ( ! scope.enabled ) return;

		scope.pointerMove( getPointer( event ) );

	}

	function onPointerUp( event ) {

		if ( ! scope.enabled ) return;

		scope.domElement.ownerDocument.removeEventListener( "mousemove", onPointerMove, false );

		scope.pointerUp( getPointer( event ) );

	}

	// TODO: deprecate

	this.getMode = function () {

		return scope.mode;

	};

	this.setMode = function ( mode ) {

		scope.mode = mode;

	};

	this.setTranslationSnap = function ( translationSnap ) {

		scope.translationSnap = translationSnap;

	};

	this.setRotationSnap = function ( rotationSnap ) {

		scope.rotationSnap = rotationSnap;

	};

	this.setScaleSnap = function ( scaleSnap ) {

		scope.scaleSnap = scaleSnap;

	};

	this.setSize = function ( size ) {

		scope.size = size;

	};

	this.setSpace = function ( space ) {

		scope.space = space;

	};

	this.update = function () {

		console.warn( 'THREE.TransformControls: update function has no more functionality and therefore has been deprecated.' );

	};

};

THREE.TransformControls.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.TransformControls,

	isTransformControls: true

} );


THREE.TransformControlsGizmo = function () {

	'use strict';

	THREE.Object3D.call( this );

	this.type = 'TransformControlsGizmo';

	// shared materials

	var gizmoMaterial = new THREE.MeshBasicMaterial( {
		depthTest: false,
		depthWrite: false,
		transparent: true,
		side: THREE.DoubleSide,
		fog: false,
		toneMapped: false
	} );

	var gizmoLineMaterial = new THREE.LineBasicMaterial( {
		depthTest: false,
		depthWrite: false,
		transparent: true,
		linewidth: 1,
		fog: false,
		toneMapped: false
	} );

	// Make unique material for each axis/color

	var matInvisible = gizmoMaterial.clone();
	matInvisible.opacity = 0.15;

	var matHelper = gizmoMaterial.clone();
	matHelper.opacity = 0.33;

	var matRed = gizmoMaterial.clone();
	matRed.color.set( 0xff0000 );

	var matGreen = gizmoMaterial.clone();
	matGreen.color.set( 0x00ff00 );

	var matBlue = gizmoMaterial.clone();
	matBlue.color.set( 0x0000ff );

	var matWhiteTransparent = gizmoMaterial.clone();
	matWhiteTransparent.opacity = 0.25;

	var matYellowTransparent = matWhiteTransparent.clone();
	matYellowTransparent.color.set( 0xffff00 );

	var matCyanTransparent = matWhiteTransparent.clone();
	matCyanTransparent.color.set( 0x00ffff );

	var matMagentaTransparent = matWhiteTransparent.clone();
	matMagentaTransparent.color.set( 0xff00ff );

	var matYellow = gizmoMaterial.clone();
	matYellow.color.set( 0xffff00 );

	var matLineRed = gizmoLineMaterial.clone();
	matLineRed.color.set( 0xff0000 );

	var matLineGreen = gizmoLineMaterial.clone();
	matLineGreen.color.set( 0x00ff00 );

	var matLineBlue = gizmoLineMaterial.clone();
	matLineBlue.color.set( 0x0000ff );

	var matLineCyan = gizmoLineMaterial.clone();
	matLineCyan.color.set( 0x00ffff );

	var matLineMagenta = gizmoLineMaterial.clone();
	matLineMagenta.color.set( 0xff00ff );

	var matLineYellow = gizmoLineMaterial.clone();
	matLineYellow.color.set( 0xffff00 );

	var matLineGray = gizmoLineMaterial.clone();
	matLineGray.color.set( 0x787878 );

	var matLineYellowTransparent = matLineYellow.clone();
	matLineYellowTransparent.opacity = 0.25;

	// reusable geometry

	var arrowGeometry = new THREE.CylinderBufferGeometry( 0, 0.05, 0.2, 12, 1, false );

	var scaleHandleGeometry = new THREE.BoxBufferGeometry( 0.125, 0.125, 0.125 );

	var lineGeometry = new THREE.BufferGeometry();
	lineGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0,	1, 0, 0 ], 3 ) );

	var CircleGeometry = function ( radius, arc ) {

		var geometry = new THREE.BufferGeometry( );
		var vertices = [];

		for ( var i = 0; i <= 64 * arc; ++ i ) {

			vertices.push( 0, Math.cos( i / 32 * Math.PI ) * radius, Math.sin( i / 32 * Math.PI ) * radius );

		}

		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );

		return geometry;

	};

	// Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position

	var TranslateHelperGeometry = function () {

		var geometry = new THREE.BufferGeometry();

		geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );

		return geometry;

	};

	// Gizmo definitions - custom hierarchy definitions for setupGizmo() function

	var gizmoTranslate = {
		X: [
			[ new THREE.Mesh( arrowGeometry, matRed ), [ 1, 0, 0 ], [ 0, 0, - Math.PI / 2 ], null, 'fwd' ],
			[ new THREE.Mesh( arrowGeometry, matRed ), [ 1, 0, 0 ], [ 0, 0, Math.PI / 2 ], null, 'bwd' ],
			[ new THREE.Line( lineGeometry, matLineRed ) ]
		],
		Y: [
			[ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, 1, 0 ], null, null, 'fwd' ],
			[ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, 1, 0 ], [ Math.PI, 0, 0 ], null, 'bwd' ],
			[ new THREE.Line( lineGeometry, matLineGreen ), null, [ 0, 0, Math.PI / 2 ]]
		],
		Z: [
			[ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, 1 ], [ Math.PI / 2, 0, 0 ], null, 'fwd' ],
			[ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, 1 ], [ - Math.PI / 2, 0, 0 ], null, 'bwd' ],
			[ new THREE.Line( lineGeometry, matLineBlue ), null, [ 0, - Math.PI / 2, 0 ]]
		],
		XYZ: [
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ], [ 0, 0, 0 ]]
		],
		XY: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.295, 0.295 ), matYellowTransparent.clone() ), [ 0.15, 0.15, 0 ]],
			[ new THREE.Line( lineGeometry, matLineYellow ), [ 0.18, 0.3, 0 ], null, [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineYellow ), [ 0.3, 0.18, 0 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]]
		],
		YZ: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.295, 0.295 ), matCyanTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]],
			[ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.18, 0.3 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.3, 0.18 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]
		],
		XZ: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.295, 0.295 ), matMagentaTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]],
			[ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.18, 0, 0.3 ], null, [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.3, 0, 0.18 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]
		]
	};

	var pickerTranslate = {
		X: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0.6, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]
		],
		Y: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0, 0.6, 0 ]]
		],
		Z: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 1, 4, 1, false ), matInvisible ), [ 0, 0, 0.6 ], [ Math.PI / 2, 0, 0 ]]
		],
		XYZ: [
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.2, 0 ), matInvisible ) ]
		],
		XY: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), matInvisible ), [ 0.2, 0.2, 0 ]]
		],
		YZ: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), matInvisible ), [ 0, 0.2, 0.2 ], [ 0, Math.PI / 2, 0 ]]
		],
		XZ: [
			[ new THREE.Mesh( new THREE.PlaneBufferGeometry( 0.4, 0.4 ), matInvisible ), [ 0.2, 0, 0.2 ], [ - Math.PI / 2, 0, 0 ]]
		]
	};

	var helperTranslate = {
		START: [
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
		],
		END: [
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]
		],
		DELTA: [
			[ new THREE.Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]
		],
		X: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
		],
		Y: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
		],
		Z: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
		]
	};

	var gizmoRotate = {
		X: [
			[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineRed ) ],
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.04, 0 ), matRed ), [ 0, 0, 0.99 ], null, [ 1, 3, 1 ]],
		],
		Y: [
			[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineGreen ), null, [ 0, 0, - Math.PI / 2 ]],
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.04, 0 ), matGreen ), [ 0, 0, 0.99 ], null, [ 3, 1, 1 ]],
		],
		Z: [
			[ new THREE.Line( CircleGeometry( 1, 0.5 ), matLineBlue ), null, [ 0, Math.PI / 2, 0 ]],
			[ new THREE.Mesh( new THREE.OctahedronBufferGeometry( 0.04, 0 ), matBlue ), [ 0.99, 0, 0 ], null, [ 1, 3, 1 ]],
		],
		E: [
			[ new THREE.Line( CircleGeometry( 1.25, 1 ), matLineYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]],
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 1.17, 0, 0 ], [ 0, 0, - Math.PI / 2 ], [ 1, 1, 0.001 ]],
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ - 1.17, 0, 0 ], [ 0, 0, Math.PI / 2 ], [ 1, 1, 0.001 ]],
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 0, - 1.17, 0 ], [ Math.PI, 0, 0 ], [ 1, 1, 0.001 ]],
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.03, 0, 0.15, 4, 1, false ), matLineYellowTransparent ), [ 0, 1.17, 0 ], [ 0, 0, 0 ], [ 1, 1, 0.001 ]],
		],
		XYZE: [
			[ new THREE.Line( CircleGeometry( 1, 1 ), matLineGray ), null, [ 0, Math.PI / 2, 0 ]]
		]
	};

	var helperRotate = {
		AXIS: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
		]
	};

	var pickerRotate = {
		X: [
			[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]],
		],
		Y: [
			[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]],
		],
		Z: [
			[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
		],
		E: [
			[ new THREE.Mesh( new THREE.TorusBufferGeometry( 1.25, 0.1, 2, 24 ), matInvisible ) ]
		],
		XYZE: [
			[ new THREE.Mesh( new THREE.SphereBufferGeometry( 0.7, 10, 8 ), matInvisible ) ]
		]
	};

	var gizmoScale = {
		X: [
			[ new THREE.Mesh( scaleHandleGeometry, matRed ), [ 0.8, 0, 0 ], [ 0, 0, - Math.PI / 2 ]],
			[ new THREE.Line( lineGeometry, matLineRed ), null, null, [ 0.8, 1, 1 ]]
		],
		Y: [
			[ new THREE.Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.8, 0 ]],
			[ new THREE.Line( lineGeometry, matLineGreen ), null, [ 0, 0, Math.PI / 2 ], [ 0.8, 1, 1 ]]
		],
		Z: [
			[ new THREE.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.8 ], [ Math.PI / 2, 0, 0 ]],
			[ new THREE.Line( lineGeometry, matLineBlue ), null, [ 0, - Math.PI / 2, 0 ], [ 0.8, 1, 1 ]]
		],
		XY: [
			[ new THREE.Mesh( scaleHandleGeometry, matYellowTransparent ), [ 0.85, 0.85, 0 ], null, [ 2, 2, 0.2 ]],
			[ new THREE.Line( lineGeometry, matLineYellow ), [ 0.855, 0.98, 0 ], null, [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineYellow ), [ 0.98, 0.855, 0 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]]
		],
		YZ: [
			[ new THREE.Mesh( scaleHandleGeometry, matCyanTransparent ), [ 0, 0.85, 0.85 ], null, [ 0.2, 2, 2 ]],
			[ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.855, 0.98 ], [ 0, 0, Math.PI / 2 ], [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineCyan ), [ 0, 0.98, 0.855 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]
		],
		XZ: [
			[ new THREE.Mesh( scaleHandleGeometry, matMagentaTransparent ), [ 0.85, 0, 0.85 ], null, [ 2, 0.2, 2 ]],
			[ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.855, 0, 0.98 ], null, [ 0.125, 1, 1 ]],
			[ new THREE.Line( lineGeometry, matLineMagenta ), [ 0.98, 0, 0.855 ], [ 0, - Math.PI / 2, 0 ], [ 0.125, 1, 1 ]]
		],
		XYZX: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 1.1, 0, 0 ]],
		],
		XYZY: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 0, 1.1, 0 ]],
		],
		XYZZ: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.125, 0.125, 0.125 ), matWhiteTransparent.clone() ), [ 0, 0, 1.1 ]],
		]
	};

	var pickerScale = {
		X: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]
		],
		Y: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0, 0.5, 0 ]]
		],
		Z: [
			[ new THREE.Mesh( new THREE.CylinderBufferGeometry( 0.2, 0, 0.8, 4, 1, false ), matInvisible ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]]
		],
		XY: [
			[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0.85, 0.85, 0 ], null, [ 3, 3, 0.2 ]],
		],
		YZ: [
			[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0, 0.85, 0.85 ], null, [ 0.2, 3, 3 ]],
		],
		XZ: [
			[ new THREE.Mesh( scaleHandleGeometry, matInvisible ), [ 0.85, 0, 0.85 ], null, [ 3, 0.2, 3 ]],
		],
		XYZX: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 1.1, 0, 0 ]],
		],
		XYZY: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 1.1, 0 ]],
		],
		XYZZ: [
			[ new THREE.Mesh( new THREE.BoxBufferGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 1.1 ]],
		]
	};

	var helperScale = {
		X: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]
		],
		Y: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]
		],
		Z: [
			[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]
		]
	};

	// Creates an Object3D with gizmos described in custom hierarchy definition.

	var setupGizmo = function ( gizmoMap ) {

		var gizmo = new THREE.Object3D();

		for ( var name in gizmoMap ) {

			for ( var i = gizmoMap[ name ].length; i --; ) {

				var object = gizmoMap[ name ][ i ][ 0 ].clone();
				var position = gizmoMap[ name ][ i ][ 1 ];
				var rotation = gizmoMap[ name ][ i ][ 2 ];
				var scale = gizmoMap[ name ][ i ][ 3 ];
				var tag = gizmoMap[ name ][ i ][ 4 ];

				// name and tag properties are essential for picking and updating logic.
				object.name = name;
				object.tag = tag;

				if ( position ) {

					object.position.set( position[ 0 ], position[ 1 ], position[ 2 ] );

				}

				if ( rotation ) {

					object.rotation.set( rotation[ 0 ], rotation[ 1 ], rotation[ 2 ] );

				}

				if ( scale ) {

					object.scale.set( scale[ 0 ], scale[ 1 ], scale[ 2 ] );

				}

				object.updateMatrix();

				var tempGeometry = object.geometry.clone();
				tempGeometry.applyMatrix4( object.matrix );
				object.geometry = tempGeometry;
				object.renderOrder = Infinity;

				object.position.set( 0, 0, 0 );
				object.rotation.set( 0, 0, 0 );
				object.scale.set( 1, 1, 1 );

				gizmo.add( object );

			}

		}

		return gizmo;

	};

	// Reusable utility variables

	var tempVector = new THREE.Vector3( 0, 0, 0 );
	var tempEuler = new THREE.Euler();
	var alignVector = new THREE.Vector3( 0, 1, 0 );
	var zeroVector = new THREE.Vector3( 0, 0, 0 );
	var lookAtMatrix = new THREE.Matrix4();
	var tempQuaternion = new THREE.Quaternion();
	var tempQuaternion2 = new THREE.Quaternion();
	var identityQuaternion = new THREE.Quaternion();

	var unitX = new THREE.Vector3( 1, 0, 0 );
	var unitY = new THREE.Vector3( 0, 1, 0 );
	var unitZ = new THREE.Vector3( 0, 0, 1 );

	// Gizmo creation

	this.gizmo = {};
	this.picker = {};
	this.helper = {};

	this.add( this.gizmo[ "translate" ] = setupGizmo( gizmoTranslate ) );
	this.add( this.gizmo[ "rotate" ] = setupGizmo( gizmoRotate ) );
	this.add( this.gizmo[ "scale" ] = setupGizmo( gizmoScale ) );
	this.add( this.picker[ "translate" ] = setupGizmo( pickerTranslate ) );
	this.add( this.picker[ "rotate" ] = setupGizmo( pickerRotate ) );
	this.add( this.picker[ "scale" ] = setupGizmo( pickerScale ) );
	this.add( this.helper[ "translate" ] = setupGizmo( helperTranslate ) );
	this.add( this.helper[ "rotate" ] = setupGizmo( helperRotate ) );
	this.add( this.helper[ "scale" ] = setupGizmo( helperScale ) );

	// Pickers should be hidden always

	this.picker[ "translate" ].visible = false;
	this.picker[ "rotate" ].visible = false;
	this.picker[ "scale" ].visible = false;

	// updateMatrixWorld will update transformations and appearance of individual handles

	this.updateMatrixWorld = function () {

		var space = this.space;

		if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

		var quaternion = space === "local" ? this.worldQuaternion : identityQuaternion;

		// Show only gizmos for current transform mode

		this.gizmo[ "translate" ].visible = this.mode === "translate";
		this.gizmo[ "rotate" ].visible = this.mode === "rotate";
		this.gizmo[ "scale" ].visible = this.mode === "scale";

		this.helper[ "translate" ].visible = this.mode === "translate";
		this.helper[ "rotate" ].visible = this.mode === "rotate";
		this.helper[ "scale" ].visible = this.mode === "scale";


		var handles = [];
		handles = handles.concat( this.picker[ this.mode ].children );
		handles = handles.concat( this.gizmo[ this.mode ].children );
		handles = handles.concat( this.helper[ this.mode ].children );

		for ( var i = 0; i < handles.length; i ++ ) {

			var handle = handles[ i ];

			// hide aligned to camera

			handle.visible = true;
			handle.rotation.set( 0, 0, 0 );
			handle.position.copy( this.worldPosition );

			var factor;

			if ( this.camera.isOrthographicCamera ) {

				factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

			} else {

				factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

			}

			handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 7 );

			// TODO: simplify helpers and consider decoupling from gizmo

			if ( handle.tag === 'helper' ) {

				handle.visible = false;

				if ( handle.name === 'AXIS' ) {

					handle.position.copy( this.worldPositionStart );
					handle.visible = !! this.axis;

					if ( this.axis === 'X' ) {

						tempQuaternion.setFromEuler( tempEuler.set( 0, 0, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( tempQuaternion );

						if ( Math.abs( alignVector.copy( unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Y' ) {

						tempQuaternion.setFromEuler( tempEuler.set( 0, 0, Math.PI / 2 ) );
						handle.quaternion.copy( quaternion ).multiply( tempQuaternion );

						if ( Math.abs( alignVector.copy( unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'Z' ) {

						tempQuaternion.setFromEuler( tempEuler.set( 0, Math.PI / 2, 0 ) );
						handle.quaternion.copy( quaternion ).multiply( tempQuaternion );

						if ( Math.abs( alignVector.copy( unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

							handle.visible = false;

						}

					}

					if ( this.axis === 'XYZE' ) {

						tempQuaternion.setFromEuler( tempEuler.set( 0, Math.PI / 2, 0 ) );
						alignVector.copy( this.rotationAxis );
						handle.quaternion.setFromRotationMatrix( lookAtMatrix.lookAt( zeroVector, alignVector, unitY ) );
						handle.quaternion.multiply( tempQuaternion );
						handle.visible = this.dragging;

					}

					if ( this.axis === 'E' ) {

						handle.visible = false;

					}


				} else if ( handle.name === 'START' ) {

					handle.position.copy( this.worldPositionStart );
					handle.visible = this.dragging;

				} else if ( handle.name === 'END' ) {

					handle.position.copy( this.worldPosition );
					handle.visible = this.dragging;

				} else if ( handle.name === 'DELTA' ) {

					handle.position.copy( this.worldPositionStart );
					handle.quaternion.copy( this.worldQuaternionStart );
					tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );
					tempVector.applyQuaternion( this.worldQuaternionStart.clone().inverse() );
					handle.scale.copy( tempVector );
					handle.visible = this.dragging;

				} else {

					handle.quaternion.copy( quaternion );

					if ( this.dragging ) {

						handle.position.copy( this.worldPositionStart );

					} else {

						handle.position.copy( this.worldPosition );

					}

					if ( this.axis ) {

						handle.visible = this.axis.search( handle.name ) !== - 1;

					}

				}

				// If updating helper, skip rest of the loop
				continue;

			}

			// Align handles to current local or world rotation

			handle.quaternion.copy( quaternion );

			if ( this.mode === 'translate' || this.mode === 'scale' ) {

				// Hide translate and scale axis facing the camera

				var AXIS_HIDE_TRESHOLD = 0.99;
				var PLANE_HIDE_TRESHOLD = 0.2;
				var AXIS_FLIP_TRESHOLD = 0.0;


				if ( handle.name === 'X' || handle.name === 'XYZX' ) {

					if ( Math.abs( alignVector.copy( unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Y' || handle.name === 'XYZY' ) {

					if ( Math.abs( alignVector.copy( unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'Z' || handle.name === 'XYZZ' ) {

					if ( Math.abs( alignVector.copy( unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XY' ) {

					if ( Math.abs( alignVector.copy( unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'YZ' ) {

					if ( Math.abs( alignVector.copy( unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				if ( handle.name === 'XZ' ) {

					if ( Math.abs( alignVector.copy( unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

						handle.scale.set( 1e-10, 1e-10, 1e-10 );
						handle.visible = false;

					}

				}

				// Flip translate and scale axis ocluded behind another axis

				if ( handle.name.search( 'X' ) !== - 1 ) {

					if ( alignVector.copy( unitX ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

						if ( handle.tag === 'fwd' ) {

							handle.visible = false;

						} else {

							handle.scale.x *= - 1;

						}

					} else if ( handle.tag === 'bwd' ) {

						handle.visible = false;

					}

				}

				if ( handle.name.search( 'Y' ) !== - 1 ) {

					if ( alignVector.copy( unitY ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

						if ( handle.tag === 'fwd' ) {

							handle.visible = false;

						} else {

							handle.scale.y *= - 1;

						}

					} else if ( handle.tag === 'bwd' ) {

						handle.visible = false;

					}

				}

				if ( handle.name.search( 'Z' ) !== - 1 ) {

					if ( alignVector.copy( unitZ ).applyQuaternion( quaternion ).dot( this.eye ) < AXIS_FLIP_TRESHOLD ) {

						if ( handle.tag === 'fwd' ) {

							handle.visible = false;

						} else {

							handle.scale.z *= - 1;

						}

					} else if ( handle.tag === 'bwd' ) {

						handle.visible = false;

					}

				}

			} else if ( this.mode === 'rotate' ) {

				// Align handles to current local or world rotation

				tempQuaternion2.copy( quaternion );
				alignVector.copy( this.eye ).applyQuaternion( tempQuaternion.copy( quaternion ).inverse() );

				if ( handle.name.search( "E" ) !== - 1 ) {

					handle.quaternion.setFromRotationMatrix( lookAtMatrix.lookAt( this.eye, zeroVector, unitY ) );

				}

				if ( handle.name === 'X' ) {

					tempQuaternion.setFromAxisAngle( unitX, Math.atan2( - alignVector.y, alignVector.z ) );
					tempQuaternion.multiplyQuaternions( tempQuaternion2, tempQuaternion );
					handle.quaternion.copy( tempQuaternion );

				}

				if ( handle.name === 'Y' ) {

					tempQuaternion.setFromAxisAngle( unitY, Math.atan2( alignVector.x, alignVector.z ) );
					tempQuaternion.multiplyQuaternions( tempQuaternion2, tempQuaternion );
					handle.quaternion.copy( tempQuaternion );

				}

				if ( handle.name === 'Z' ) {

					tempQuaternion.setFromAxisAngle( unitZ, Math.atan2( alignVector.y, alignVector.x ) );
					tempQuaternion.multiplyQuaternions( tempQuaternion2, tempQuaternion );
					handle.quaternion.copy( tempQuaternion );

				}

			}

			// Hide disabled axes
			handle.visible = handle.visible && ( handle.name.indexOf( "X" ) === - 1 || this.showX );
			handle.visible = handle.visible && ( handle.name.indexOf( "Y" ) === - 1 || this.showY );
			handle.visible = handle.visible && ( handle.name.indexOf( "Z" ) === - 1 || this.showZ );
			handle.visible = handle.visible && ( handle.name.indexOf( "E" ) === - 1 || ( this.showX && this.showY && this.showZ ) );

			// highlight selected axis

			handle.material._opacity = handle.material._opacity || handle.material.opacity;
			handle.material._color = handle.material._color || handle.material.color.clone();

			handle.material.color.copy( handle.material._color );
			handle.material.opacity = handle.material._opacity;

			if ( ! this.enabled ) {

				handle.material.opacity *= 0.5;
				handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

			} else if ( this.axis ) {

				if ( handle.name === this.axis ) {

					handle.material.opacity = 1.0;
					handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

				} else if ( this.axis.split( '' ).some( function ( a ) {

					return handle.name === a;

				} ) ) {

					handle.material.opacity = 1.0;
					handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

				} else {

					handle.material.opacity *= 0.25;
					handle.material.color.lerp( new THREE.Color( 1, 1, 1 ), 0.5 );

				}

			}

		}

		THREE.Object3D.prototype.updateMatrixWorld.call( this );

	};

};

THREE.TransformControlsGizmo.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	constructor: THREE.TransformControlsGizmo,

	isTransformControlsGizmo: true

} );


THREE.TransformControlsPlane = function () {

	'use strict';

	THREE.Mesh.call( this,
		new THREE.PlaneBufferGeometry( 100000, 100000, 2, 2 ),
		new THREE.MeshBasicMaterial( { visible: false, wireframe: true, side: THREE.DoubleSide, transparent: true, opacity: 0.1, toneMapped: false } )
	);

	this.type = 'TransformControlsPlane';

	var unitX = new THREE.Vector3( 1, 0, 0 );
	var unitY = new THREE.Vector3( 0, 1, 0 );
	var unitZ = new THREE.Vector3( 0, 0, 1 );

	var tempVector = new THREE.Vector3();
	var dirVector = new THREE.Vector3();
	var alignVector = new THREE.Vector3();
	var tempMatrix = new THREE.Matrix4();
	var identityQuaternion = new THREE.Quaternion();

	this.updateMatrixWorld = function () {

		var space = this.space;

		this.position.copy( this.worldPosition );

		if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

		unitX.set( 1, 0, 0 ).applyQuaternion( space === "local" ? this.worldQuaternion : identityQuaternion );
		unitY.set( 0, 1, 0 ).applyQuaternion( space === "local" ? this.worldQuaternion : identityQuaternion );
		unitZ.set( 0, 0, 1 ).applyQuaternion( space === "local" ? this.worldQuaternion : identityQuaternion );

		// Align the plane for current transform mode, axis and space.

		alignVector.copy( unitY );

		switch ( this.mode ) {

			case 'translate':
			case 'scale':
				switch ( this.axis ) {

					case 'X':
						alignVector.copy( this.eye ).cross( unitX );
						dirVector.copy( unitX ).cross( alignVector );
						break;
					case 'Y':
						alignVector.copy( this.eye ).cross( unitY );
						dirVector.copy( unitY ).cross( alignVector );
						break;
					case 'Z':
						alignVector.copy( this.eye ).cross( unitZ );
						dirVector.copy( unitZ ).cross( alignVector );
						break;
					case 'XY':
						dirVector.copy( unitZ );
						break;
					case 'YZ':
						dirVector.copy( unitX );
						break;
					case 'XZ':
						alignVector.copy( unitZ );
						dirVector.copy( unitY );
						break;
					case 'XYZ':
					case 'E':
						dirVector.set( 0, 0, 0 );
						break;

				}

				break;
			case 'rotate':
			default:
				// special case for rotate
				dirVector.set( 0, 0, 0 );

		}

		if ( dirVector.length() === 0 ) {

			// If in rotate mode, make the plane parallel to camera
			this.quaternion.copy( this.cameraQuaternion );

		} else {

			tempMatrix.lookAt( tempVector.set( 0, 0, 0 ), dirVector, alignVector );

			this.quaternion.setFromRotationMatrix( tempMatrix );

		}

		THREE.Object3D.prototype.updateMatrixWorld.call( this );

	};

};

THREE.TransformControlsPlane.prototype = Object.assign( Object.create( THREE.Mesh.prototype ), {

	constructor: THREE.TransformControlsPlane,

	isTransformControlsPlane: true

} );
