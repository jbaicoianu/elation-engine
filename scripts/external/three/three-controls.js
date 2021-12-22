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

( function () {

	const _raycaster = new THREE.Raycaster();

	const _tempVector = new THREE.Vector3();

	const _tempVector2 = new THREE.Vector3();

	const _tempQuaternion = new THREE.Quaternion();

	const _unit = {
		X: new THREE.Vector3( 1, 0, 0 ),
		Y: new THREE.Vector3( 0, 1, 0 ),
		Z: new THREE.Vector3( 0, 0, 1 )
	};
	const _changeEvent = {
		type: 'change'
	};
	const _mouseDownEvent = {
		type: 'mouseDown'
	};
	const _mouseUpEvent = {
		type: 'mouseUp',
		mode: null
	};
	const _objectChangeEvent = {
		type: 'objectChange'
	};

	class TransformControls extends THREE.Object3D {

		constructor( camera, domElement ) {

			super();

			if ( domElement === undefined ) {

				console.warn( 'THREE.TransformControls: The second parameter "domElement" is now mandatory.' );
				domElement = document;

			}

			this.visible = false;
			this.domElement = domElement;
			this.domElement.style.touchAction = 'none'; // disable touch scroll

			const _gizmo = new TransformControlsGizmo();

			this._gizmo = _gizmo;
			this.add( _gizmo );

			const _plane = new TransformControlsPlane();

			this._plane = _plane;
			this.add( _plane );
			const scope = this; // Defined getter, setter and store for a property

			function defineProperty( propName, defaultValue ) {

				let propValue = defaultValue;
				Object.defineProperty( scope, propName, {
					get: function () {

						return propValue !== undefined ? propValue : defaultValue;

					},
					set: function ( value ) {

						if ( propValue !== value ) {

							propValue = value;
							_plane[ propName ] = value;
							_gizmo[ propName ] = value;
							scope.dispatchEvent( {
								type: propName + '-changed',
								value: value
							} );
							scope.dispatchEvent( _changeEvent );

						}

					}
				} );
				scope[ propName ] = defaultValue;
				_plane[ propName ] = defaultValue;
				_gizmo[ propName ] = defaultValue;

			} // Define properties with getters/setter
			// Setting the defined property will automatically trigger change event
			// Defined properties are passed down to gizmo and plane


			defineProperty( 'camera', camera );
			defineProperty( 'object', undefined );
			defineProperty( 'enabled', true );
			defineProperty( 'axis', null );
			defineProperty( 'mode', 'translate' );
			defineProperty( 'translationSnap', null );
			defineProperty( 'rotationSnap', null );
			defineProperty( 'scaleSnap', null );
			defineProperty( 'space', 'world' );
			defineProperty( 'size', 1 );
			defineProperty( 'dragging', false );
			defineProperty( 'showX', true );
			defineProperty( 'showY', true );
			defineProperty( 'showZ', true ); // Reusable utility variables

			const worldPosition = new THREE.Vector3();
			const worldPositionStart = new THREE.Vector3();
			const worldQuaternion = new THREE.Quaternion();
			const worldQuaternionStart = new THREE.Quaternion();
			const cameraPosition = new THREE.Vector3();
			const cameraQuaternion = new THREE.Quaternion();
			const pointStart = new THREE.Vector3();
			const pointEnd = new THREE.Vector3();
			const rotationAxis = new THREE.Vector3();
			const rotationAngle = 0;
			const eye = new THREE.Vector3(); // TODO: remove properties unused in plane and gizmo

			defineProperty( 'worldPosition', worldPosition );
			defineProperty( 'worldPositionStart', worldPositionStart );
			defineProperty( 'worldQuaternion', worldQuaternion );
			defineProperty( 'worldQuaternionStart', worldQuaternionStart );
			defineProperty( 'cameraPosition', cameraPosition );
			defineProperty( 'cameraQuaternion', cameraQuaternion );
			defineProperty( 'pointStart', pointStart );
			defineProperty( 'pointEnd', pointEnd );
			defineProperty( 'rotationAxis', rotationAxis );
			defineProperty( 'rotationAngle', rotationAngle );
			defineProperty( 'eye', eye );
			this._offset = new THREE.Vector3();
			this._startNorm = new THREE.Vector3();
			this._endNorm = new THREE.Vector3();
			this._cameraScale = new THREE.Vector3();
			this._parentPosition = new THREE.Vector3();
			this._parentQuaternion = new THREE.Quaternion();
			this._parentQuaternionInv = new THREE.Quaternion();
			this._parentScale = new THREE.Vector3();
			this._worldScaleStart = new THREE.Vector3();
			this._worldQuaternionInv = new THREE.Quaternion();
			this._worldScale = new THREE.Vector3();
			this._positionStart = new THREE.Vector3();
			this._quaternionStart = new THREE.Quaternion();
			this._scaleStart = new THREE.Vector3();
			this._getPointer = getPointer.bind( this );
			this._onPointerDown = onPointerDown.bind( this );
			this._onPointerHover = onPointerHover.bind( this );
			this._onPointerMove = onPointerMove.bind( this );
			this._onPointerUp = onPointerUp.bind( this );
			this.domElement.addEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.addEventListener( 'pointermove', this._onPointerHover );
			this.domElement.addEventListener( 'pointerup', this._onPointerUp );

		} // updateMatrixWorld  updates key transformation variables


		updateMatrixWorld() {

			if ( this.object !== undefined ) {

				this.object.updateMatrixWorld();

				if ( this.object.parent === null ) {

					console.error( 'TransformControls: The attached 3D object must be a part of the scene graph.' );

				} else {

					this.object.parent.matrixWorld.decompose( this._parentPosition, this._parentQuaternion, this._parentScale );

				}

				this.object.matrixWorld.decompose( this.worldPosition, this.worldQuaternion, this._worldScale );

				this._parentQuaternionInv.copy( this._parentQuaternion ).invert();

				this._worldQuaternionInv.copy( this.worldQuaternion ).invert();

			}

			this.camera.updateMatrixWorld();
			this.camera.matrixWorld.decompose( this.cameraPosition, this.cameraQuaternion, this._cameraScale );
			this.eye.copy( this.cameraPosition ).sub( this.worldPosition ).normalize();
			super.updateMatrixWorld( this );

		}

		pointerHover( pointer ) {

			if ( this.object === undefined || this.dragging === true ) return;

			_raycaster.setFromCamera( pointer, this.camera );

			const intersect = intersectObjectWithRay( this._gizmo.picker[ this.mode ], _raycaster );

			if ( intersect ) {

				this.axis = intersect.object.name;

			} else {

				this.axis = null;

			}

		}

		pointerDown( pointer ) {

			if ( this.object === undefined || this.dragging === true || pointer.button !== 0 ) return;

			if ( this.axis !== null ) {

				_raycaster.setFromCamera( pointer, this.camera );

				const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );

				if ( planeIntersect ) {

					this.object.updateMatrixWorld();
					this.object.parent.updateMatrixWorld();

					this._positionStart.copy( this.object.position );

					this._quaternionStart.copy( this.object.quaternion );

					this._scaleStart.copy( this.object.scale );

					this.object.matrixWorld.decompose( this.worldPositionStart, this.worldQuaternionStart, this._worldScaleStart );
					this.pointStart.copy( planeIntersect.point ).sub( this.worldPositionStart );

				}

				this.dragging = true;
				_mouseDownEvent.mode = this.mode;
				this.dispatchEvent( _mouseDownEvent );

			}

		}

		pointerMove( pointer ) {

			const axis = this.axis;
			const mode = this.mode;
			const object = this.object;
			let space = this.space;

			if ( mode === 'scale' ) {

				space = 'local';

			} else if ( axis === 'E' || axis === 'XYZE' || axis === 'XYZ' ) {

				space = 'world';

			}

			if ( object === undefined || axis === null || this.dragging === false || pointer.button !== - 1 ) return;

			_raycaster.setFromCamera( pointer, this.camera );

			const planeIntersect = intersectObjectWithRay( this._plane, _raycaster, true );
			if ( ! planeIntersect ) return;
			this.pointEnd.copy( planeIntersect.point ).sub( this.worldPositionStart );

			if ( mode === 'translate' ) {

				// Apply translate
				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._worldQuaternionInv );

				}

				if ( axis.indexOf( 'X' ) === - 1 ) this._offset.x = 0;
				if ( axis.indexOf( 'Y' ) === - 1 ) this._offset.y = 0;
				if ( axis.indexOf( 'Z' ) === - 1 ) this._offset.z = 0;

				if ( space === 'local' && axis !== 'XYZ' ) {

					this._offset.applyQuaternion( this._quaternionStart ).divide( this._parentScale );

				} else {

					this._offset.applyQuaternion( this._parentQuaternionInv ).divide( this._parentScale );

				}

				object.position.copy( this._offset ).add( this._positionStart ); // Apply translation snap

				if ( this.translationSnap ) {

					if ( space === 'local' ) {

						object.position.applyQuaternion( _tempQuaternion.copy( this._quaternionStart ).invert() );

						if ( axis.search( 'X' ) !== - 1 ) {

							object.position.x = Math.round( object.position.x / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Y' ) !== - 1 ) {

							object.position.y = Math.round( object.position.y / this.translationSnap ) * this.translationSnap;

						}

						if ( axis.search( 'Z' ) !== - 1 ) {

							object.position.z = Math.round( object.position.z / this.translationSnap ) * this.translationSnap;

						}

						object.position.applyQuaternion( this._quaternionStart );

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

					let d = this.pointEnd.length() / this.pointStart.length();
					if ( this.pointEnd.dot( this.pointStart ) < 0 ) d *= - 1;

					_tempVector2.set( d, d, d );

				} else {

					_tempVector.copy( this.pointStart );

					_tempVector2.copy( this.pointEnd );

					_tempVector.applyQuaternion( this._worldQuaternionInv );

					_tempVector2.applyQuaternion( this._worldQuaternionInv );

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

				} // Apply scale


				object.scale.copy( this._scaleStart ).multiply( _tempVector2 );

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

				this._offset.copy( this.pointEnd ).sub( this.pointStart );

				const ROTATION_SPEED = 20 / this.worldPosition.distanceTo( _tempVector.setFromMatrixPosition( this.camera.matrixWorld ) );

				if ( axis === 'E' ) {

					this.rotationAxis.copy( this.eye );
					this.rotationAngle = this.pointEnd.angleTo( this.pointStart );

					this._startNorm.copy( this.pointStart ).normalize();

					this._endNorm.copy( this.pointEnd ).normalize();

					this.rotationAngle *= this._endNorm.cross( this._startNorm ).dot( this.eye ) < 0 ? 1 : - 1;

				} else if ( axis === 'XYZE' ) {

					this.rotationAxis.copy( this._offset ).cross( this.eye ).normalize();
					this.rotationAngle = this._offset.dot( _tempVector.copy( this.rotationAxis ).cross( this.eye ) ) * ROTATION_SPEED;

				} else if ( axis === 'X' || axis === 'Y' || axis === 'Z' ) {

					this.rotationAxis.copy( _unit[ axis ] );

					_tempVector.copy( _unit[ axis ] );

					if ( space === 'local' ) {

						_tempVector.applyQuaternion( this.worldQuaternion );

					}

					this.rotationAngle = this._offset.dot( _tempVector.cross( this.eye ).normalize() ) * ROTATION_SPEED;

				} // Apply rotation snap


				if ( this.rotationSnap ) this.rotationAngle = Math.round( this.rotationAngle / this.rotationSnap ) * this.rotationSnap; // Apply rotate

				if ( space === 'local' && axis !== 'E' && axis !== 'XYZE' ) {

					object.quaternion.copy( this._quaternionStart );
					object.quaternion.multiply( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) ).normalize();

				} else {

					this.rotationAxis.applyQuaternion( this._parentQuaternionInv );
					object.quaternion.copy( _tempQuaternion.setFromAxisAngle( this.rotationAxis, this.rotationAngle ) );
					object.quaternion.multiply( this._quaternionStart ).normalize();

				}

			}

			this.dispatchEvent( _changeEvent );
			this.dispatchEvent( _objectChangeEvent );

		}

		pointerUp( pointer ) {

			if ( pointer.button !== 0 ) return;

			if ( this.dragging && this.axis !== null ) {

				_mouseUpEvent.mode = this.mode;
				this.dispatchEvent( _mouseUpEvent );

			}

			this.dragging = false;
			this.axis = null;

		}

		dispose() {

			this.domElement.removeEventListener( 'pointerdown', this._onPointerDown );
			this.domElement.removeEventListener( 'pointermove', this._onPointerHover );
			this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
			this.domElement.removeEventListener( 'pointerup', this._onPointerUp );
			this.traverse( function ( child ) {

				if ( child.geometry ) child.geometry.dispose();
				if ( child.material ) child.material.dispose();

			} );

		} // Set current object


		attach( object ) {

			this.object = object;
			this.visible = true;
			return this;

		} // Detatch from object


		detach() {

			this.object = undefined;
			this.visible = false;
			this.axis = null;
			return this;

		}

		getRaycaster() {

			return _raycaster;

		} // TODO: deprecate


		getMode() {

			return this.mode;

		}

		setMode( mode ) {

			this.mode = mode;

		}

		setTranslationSnap( translationSnap ) {

			this.translationSnap = translationSnap;

		}

		setRotationSnap( rotationSnap ) {

			this.rotationSnap = rotationSnap;

		}

		setScaleSnap( scaleSnap ) {

			this.scaleSnap = scaleSnap;

		}

		setSize( size ) {

			this.size = size;

		}

		setSpace( space ) {

			this.space = space;

		}

		update() {

			console.warn( 'THREE.TransformControls: update function has no more functionality and therefore has been deprecated.' );

		}

	}

	TransformControls.prototype.isTransformControls = true; // mouse / touch event handlers

	function getPointer( event ) {

		if ( this.domElement.ownerDocument.pointerLockElement ) {

			return {
				x: 0,
				y: 0,
				button: event.button
			};

		} else {

			const rect = this.domElement.getBoundingClientRect();
			return {
				x: ( event.clientX - rect.left ) / rect.width * 2 - 1,
				y: - ( event.clientY - rect.top ) / rect.height * 2 + 1,
				button: event.button
			};

		}

	}

	function onPointerHover( event ) {

		if ( ! this.enabled ) return;

		switch ( event.pointerType ) {

			case 'mouse':
			case 'pen':
				this.pointerHover( this._getPointer( event ) );
				break;

		}

	}

	function onPointerDown( event ) {

		if ( ! this.enabled ) return;

		if ( ! document.pointerLockElement ) {

			this.domElement.setPointerCapture( event.pointerId );

		}

		this.domElement.addEventListener( 'pointermove', this._onPointerMove );
		this.pointerHover( this._getPointer( event ) );
		this.pointerDown( this._getPointer( event ) );

	}

	function onPointerMove( event ) {

		if ( ! this.enabled ) return;
		this.pointerMove( this._getPointer( event ) );

	}

	function onPointerUp( event ) {

		if ( ! this.enabled ) return;
		this.domElement.releasePointerCapture( event.pointerId );
		this.domElement.removeEventListener( 'pointermove', this._onPointerMove );
		this.pointerUp( this._getPointer( event ) );

	}

	function intersectObjectWithRay( object, raycaster, includeInvisible ) {

		const allIntersections = raycaster.intersectObject( object, true );

		for ( let i = 0; i < allIntersections.length; i ++ ) {

			if ( allIntersections[ i ].object.visible || includeInvisible ) {

				return allIntersections[ i ];

			}

		}

		return false;

	} //
	// Reusable utility variables


	const _tempEuler = new THREE.Euler();

	const _alignVector = new THREE.Vector3( 0, 1, 0 );

	const _zeroVector = new THREE.Vector3( 0, 0, 0 );

	const _lookAtMatrix = new THREE.Matrix4();

	const _tempQuaternion2 = new THREE.Quaternion();

	const _identityQuaternion = new THREE.Quaternion();

	const _dirVector = new THREE.Vector3();

	const _tempMatrix = new THREE.Matrix4();

	const _unitX = new THREE.Vector3( 1, 0, 0 );

	const _unitY = new THREE.Vector3( 0, 1, 0 );

	const _unitZ = new THREE.Vector3( 0, 0, 1 );

	const _v1 = new THREE.Vector3();

	const _v2 = new THREE.Vector3();

	const _v3 = new THREE.Vector3();

	class TransformControlsGizmo extends THREE.Object3D {

		constructor() {

			super();
			this.type = 'TransformControlsGizmo'; // shared materials

			const gizmoMaterial = new THREE.MeshBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				fog: false,
				toneMapped: false,
				transparent: true
			} );
			const gizmoLineMaterial = new THREE.LineBasicMaterial( {
				depthTest: false,
				depthWrite: false,
				fog: false,
				toneMapped: false,
				transparent: true
			} ); // Make unique material for each axis/color

			const matInvisible = gizmoMaterial.clone();
			matInvisible.opacity = 0.15;
			const matHelper = gizmoLineMaterial.clone();
			matHelper.opacity = 0.5;
			const matRed = gizmoMaterial.clone();
			matRed.color.setHex( 0xff0000 );
			const matGreen = gizmoMaterial.clone();
			matGreen.color.setHex( 0x00ff00 );
			const matBlue = gizmoMaterial.clone();
			matBlue.color.setHex( 0x0000ff );
			const matRedTransparent = gizmoMaterial.clone();
			matRedTransparent.color.setHex( 0xff0000 );
			matRedTransparent.opacity = 0.5;
			const matGreenTransparent = gizmoMaterial.clone();
			matGreenTransparent.color.setHex( 0x00ff00 );
			matGreenTransparent.opacity = 0.5;
			const matBlueTransparent = gizmoMaterial.clone();
			matBlueTransparent.color.setHex( 0x0000ff );
			matBlueTransparent.opacity = 0.5;
			const matWhiteTransparent = gizmoMaterial.clone();
			matWhiteTransparent.opacity = 0.25;
			const matYellowTransparent = gizmoMaterial.clone();
			matYellowTransparent.color.setHex( 0xffff00 );
			matYellowTransparent.opacity = 0.25;
			const matYellow = gizmoMaterial.clone();
			matYellow.color.setHex( 0xffff00 );
			const matGray = gizmoMaterial.clone();
			matGray.color.setHex( 0x787878 ); // reusable geometry

			const arrowGeometry = new THREE.CylinderGeometry( 0, 0.04, 0.1, 12 );
			arrowGeometry.translate( 0, 0.05, 0 );
			const scaleHandleGeometry = new THREE.BoxGeometry( 0.08, 0.08, 0.08 );
			scaleHandleGeometry.translate( 0, 0.04, 0 );
			const lineGeometry = new THREE.BufferGeometry();
			lineGeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 1, 0, 0 ], 3 ) );
			const lineGeometry2 = new THREE.CylinderGeometry( 0.0075, 0.0075, 0.5, 3 );
			lineGeometry2.translate( 0, 0.25, 0 );

			function CircleGeometry( radius, arc ) {

				const geometry = new THREE.TorusGeometry( radius, 0.0075, 3, 64, arc * Math.PI * 2 );
				geometry.rotateY( Math.PI / 2 );
				geometry.rotateX( Math.PI / 2 );
				return geometry;

			} // Special geometry for transform helper. If scaled with position vector it spans from [0,0,0] to position


			function TranslateHelperGeometry() {

				const geometry = new THREE.BufferGeometry();
				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( [ 0, 0, 0, 1, 1, 1 ], 3 ) );
				return geometry;

			} // Gizmo definitions - custom hierarchy definitions for setupGizmo() function


			const gizmoTranslate = {
				X: [[ new THREE.Mesh( arrowGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( arrowGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]], [ new THREE.Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, 0.5, 0 ]], [ new THREE.Mesh( arrowGeometry, matGreen ), [ 0, - 0.5, 0 ], [ Math.PI, 0, 0 ]], [ new THREE.Mesh( lineGeometry2, matGreen ) ]],
				Z: [[ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( arrowGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( lineGeometry2, matBlue ), null, [ Math.PI / 2, 0, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.1, 0 ), matWhiteTransparent.clone() ), [ 0, 0, 0 ]]],
				XY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent.clone() ), [ 0.15, 0.15, 0 ]]],
				YZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent.clone() ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]],
				XZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent.clone() ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]]
			};
			const pickerTranslate = {
				X: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]],
				Z: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.2, 0 ), matInvisible ) ]],
				XY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]]],
				YZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]],
				XZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]]
			};
			const helperTranslate = {
				START: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]],
				END: [[ new THREE.Mesh( new THREE.OctahedronGeometry( 0.01, 2 ), matHelper ), null, null, null, 'helper' ]],
				DELTA: [[ new THREE.Line( TranslateHelperGeometry(), matHelper ), null, null, null, 'helper' ]],
				X: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]],
				Y: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]],
				Z: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]]
			};
			const gizmoRotate = {
				XYZE: [[ new THREE.Mesh( CircleGeometry( 0.5, 1 ), matGray ), null, [ 0, Math.PI / 2, 0 ]]],
				X: [[ new THREE.Mesh( CircleGeometry( 0.5, 0.5 ), matRed ) ]],
				Y: [[ new THREE.Mesh( CircleGeometry( 0.5, 0.5 ), matGreen ), null, [ 0, 0, - Math.PI / 2 ]]],
				Z: [[ new THREE.Mesh( CircleGeometry( 0.5, 0.5 ), matBlue ), null, [ 0, Math.PI / 2, 0 ]]],
				E: [[ new THREE.Mesh( CircleGeometry( 0.75, 1 ), matYellowTransparent ), null, [ 0, Math.PI / 2, 0 ]]]
			};
			const helperRotate = {
				AXIS: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]]
			};
			const pickerRotate = {
				XYZE: [[ new THREE.Mesh( new THREE.SphereGeometry( 0.25, 10, 8 ), matInvisible ) ]],
				X: [[ new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, - Math.PI / 2, - Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]]],
				Z: [[ new THREE.Mesh( new THREE.TorusGeometry( 0.5, 0.1, 4, 24 ), matInvisible ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]]],
				E: [[ new THREE.Mesh( new THREE.TorusGeometry( 0.75, 0.1, 2, 24 ), matInvisible ) ]]
			};
			const gizmoScale = {
				X: [[ new THREE.Mesh( scaleHandleGeometry, matRed ), [ 0.5, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( lineGeometry2, matRed ), [ 0, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( scaleHandleGeometry, matRed ), [ - 0.5, 0, 0 ], [ 0, 0, Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( scaleHandleGeometry, matGreen ), [ 0, 0.5, 0 ]], [ new THREE.Mesh( lineGeometry2, matGreen ) ], [ new THREE.Mesh( scaleHandleGeometry, matGreen ), [ 0, - 0.5, 0 ], [ 0, 0, Math.PI ]]],
				Z: [[ new THREE.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, 0.5 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( lineGeometry2, matBlue ), [ 0, 0, 0 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( scaleHandleGeometry, matBlue ), [ 0, 0, - 0.5 ], [ - Math.PI / 2, 0, 0 ]]],
				XY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matBlueTransparent ), [ 0.15, 0.15, 0 ]]],
				YZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matRedTransparent ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]],
				XZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.15, 0.15, 0.01 ), matGreenTransparent ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.1, 0.1, 0.1 ), matWhiteTransparent.clone() ) ]]
			};
			const pickerScale = {
				X: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0.3, 0, 0 ], [ 0, 0, - Math.PI / 2 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ - 0.3, 0, 0 ], [ 0, 0, Math.PI / 2 ]]],
				Y: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0.3, 0 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, - 0.3, 0 ], [ 0, 0, Math.PI ]]],
				Z: [[ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, 0.3 ], [ Math.PI / 2, 0, 0 ]], [ new THREE.Mesh( new THREE.CylinderGeometry( 0.2, 0, 0.6, 4 ), matInvisible ), [ 0, 0, - 0.3 ], [ - Math.PI / 2, 0, 0 ]]],
				XY: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0.15, 0 ]]],
				YZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0, 0.15, 0.15 ], [ 0, Math.PI / 2, 0 ]]],
				XZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.01 ), matInvisible ), [ 0.15, 0, 0.15 ], [ - Math.PI / 2, 0, 0 ]]],
				XYZ: [[ new THREE.Mesh( new THREE.BoxGeometry( 0.2, 0.2, 0.2 ), matInvisible ), [ 0, 0, 0 ]]]
			};
			const helperScale = {
				X: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ - 1e3, 0, 0 ], null, [ 1e6, 1, 1 ], 'helper' ]],
				Y: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, - 1e3, 0 ], [ 0, 0, Math.PI / 2 ], [ 1e6, 1, 1 ], 'helper' ]],
				Z: [[ new THREE.Line( lineGeometry, matHelper.clone() ), [ 0, 0, - 1e3 ], [ 0, - Math.PI / 2, 0 ], [ 1e6, 1, 1 ], 'helper' ]]
			}; // Creates an THREE.Object3D with gizmos described in custom hierarchy definition.

			function setupGizmo( gizmoMap ) {

				const gizmo = new THREE.Object3D();

				for ( const name in gizmoMap ) {

					for ( let i = gizmoMap[ name ].length; i --; ) {

						const object = gizmoMap[ name ][ i ][ 0 ].clone();
						const position = gizmoMap[ name ][ i ][ 1 ];
						const rotation = gizmoMap[ name ][ i ][ 2 ];
						const scale = gizmoMap[ name ][ i ][ 3 ];
						const tag = gizmoMap[ name ][ i ][ 4 ]; // name and tag properties are essential for picking and updating logic.

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
						const tempGeometry = object.geometry.clone();
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

			} // Gizmo creation


			this.gizmo = {};
			this.picker = {};
			this.helper = {};
			this.add( this.gizmo[ 'translate' ] = setupGizmo( gizmoTranslate ) );
			this.add( this.gizmo[ 'rotate' ] = setupGizmo( gizmoRotate ) );
			this.add( this.gizmo[ 'scale' ] = setupGizmo( gizmoScale ) );
			this.add( this.picker[ 'translate' ] = setupGizmo( pickerTranslate ) );
			this.add( this.picker[ 'rotate' ] = setupGizmo( pickerRotate ) );
			this.add( this.picker[ 'scale' ] = setupGizmo( pickerScale ) );
			this.add( this.helper[ 'translate' ] = setupGizmo( helperTranslate ) );
			this.add( this.helper[ 'rotate' ] = setupGizmo( helperRotate ) );
			this.add( this.helper[ 'scale' ] = setupGizmo( helperScale ) ); // Pickers should be hidden always

			this.picker[ 'translate' ].visible = false;
			this.picker[ 'rotate' ].visible = false;
			this.picker[ 'scale' ].visible = false;

		} // updateMatrixWorld will update transformations and appearance of individual handles


		updateMatrixWorld( force ) {

			const space = this.mode === 'scale' ? 'local' : this.space; // scale always oriented to local rotation

			const quaternion = space === 'local' ? this.worldQuaternion : _identityQuaternion; // Show only gizmos for current transform mode

			this.gizmo[ 'translate' ].visible = this.mode === 'translate';
			this.gizmo[ 'rotate' ].visible = this.mode === 'rotate';
			this.gizmo[ 'scale' ].visible = this.mode === 'scale';
			this.helper[ 'translate' ].visible = this.mode === 'translate';
			this.helper[ 'rotate' ].visible = this.mode === 'rotate';
			this.helper[ 'scale' ].visible = this.mode === 'scale';
			let handles = [];
			handles = handles.concat( this.picker[ this.mode ].children );
			handles = handles.concat( this.gizmo[ this.mode ].children );
			handles = handles.concat( this.helper[ this.mode ].children );

			for ( let i = 0; i < handles.length; i ++ ) {

				const handle = handles[ i ]; // hide aligned to camera

				handle.visible = true;
				handle.rotation.set( 0, 0, 0 );
				handle.position.copy( this.worldPosition );
				let factor;

				if ( this.camera.isOrthographicCamera ) {

					factor = ( this.camera.top - this.camera.bottom ) / this.camera.zoom;

				} else {

					factor = this.worldPosition.distanceTo( this.cameraPosition ) * Math.min( 1.9 * Math.tan( Math.PI * this.camera.fov / 360 ) / this.camera.zoom, 7 );

				}

				handle.scale.set( 1, 1, 1 ).multiplyScalar( factor * this.size / 4 ); // TODO: simplify helpers and consider decoupling from gizmo

				if ( handle.tag === 'helper' ) {

					handle.visible = false;

					if ( handle.name === 'AXIS' ) {

						handle.position.copy( this.worldPositionStart );
						handle.visible = !! this.axis;

						if ( this.axis === 'X' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, 0 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Y' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, 0, Math.PI / 2 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'Z' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );

							handle.quaternion.copy( quaternion ).multiply( _tempQuaternion );

							if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > 0.9 ) {

								handle.visible = false;

							}

						}

						if ( this.axis === 'XYZE' ) {

							_tempQuaternion.setFromEuler( _tempEuler.set( 0, Math.PI / 2, 0 ) );

							_alignVector.copy( this.rotationAxis );

							handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( _zeroVector, _alignVector, _unitY ) );
							handle.quaternion.multiply( _tempQuaternion );
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

						_tempVector.set( 1e-10, 1e-10, 1e-10 ).add( this.worldPositionStart ).sub( this.worldPosition ).multiplyScalar( - 1 );

						_tempVector.applyQuaternion( this.worldQuaternionStart.clone().invert() );

						handle.scale.copy( _tempVector );
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

					} // If updating helper, skip rest of the loop


					continue;

				} // Align handles to current local or world rotation


				handle.quaternion.copy( quaternion );

				if ( this.mode === 'translate' || this.mode === 'scale' ) {

					// Hide translate and scale axis facing the camera
					const AXIS_HIDE_TRESHOLD = 0.99;
					const PLANE_HIDE_TRESHOLD = 0.2;

					if ( handle.name === 'X' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Y' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'Z' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) > AXIS_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XY' ) {

						if ( Math.abs( _alignVector.copy( _unitZ ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'YZ' ) {

						if ( Math.abs( _alignVector.copy( _unitX ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

					if ( handle.name === 'XZ' ) {

						if ( Math.abs( _alignVector.copy( _unitY ).applyQuaternion( quaternion ).dot( this.eye ) ) < PLANE_HIDE_TRESHOLD ) {

							handle.scale.set( 1e-10, 1e-10, 1e-10 );
							handle.visible = false;

						}

					}

				} else if ( this.mode === 'rotate' ) {

					// Align handles to current local or world rotation
					_tempQuaternion2.copy( quaternion );

					_alignVector.copy( this.eye ).applyQuaternion( _tempQuaternion.copy( quaternion ).invert() );

					if ( handle.name.search( 'E' ) !== - 1 ) {

						handle.quaternion.setFromRotationMatrix( _lookAtMatrix.lookAt( this.eye, _zeroVector, _unitY ) );

					}

					if ( handle.name === 'X' ) {

						_tempQuaternion.setFromAxisAngle( _unitX, Math.atan2( - _alignVector.y, _alignVector.z ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Y' ) {

						_tempQuaternion.setFromAxisAngle( _unitY, Math.atan2( _alignVector.x, _alignVector.z ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

					if ( handle.name === 'Z' ) {

						_tempQuaternion.setFromAxisAngle( _unitZ, Math.atan2( _alignVector.y, _alignVector.x ) );

						_tempQuaternion.multiplyQuaternions( _tempQuaternion2, _tempQuaternion );

						handle.quaternion.copy( _tempQuaternion );

					}

				} // Hide disabled axes


				handle.visible = handle.visible && ( handle.name.indexOf( 'X' ) === - 1 || this.showX );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Y' ) === - 1 || this.showY );
				handle.visible = handle.visible && ( handle.name.indexOf( 'Z' ) === - 1 || this.showZ );
				handle.visible = handle.visible && ( handle.name.indexOf( 'E' ) === - 1 || this.showX && this.showY && this.showZ ); // highlight selected axis

				handle.material._color = handle.material._color || handle.material.color.clone();
				handle.material._opacity = handle.material._opacity || handle.material.opacity;
				handle.material.color.copy( handle.material._color );
				handle.material.opacity = handle.material._opacity;

				if ( this.enabled && this.axis ) {

					if ( handle.name === this.axis ) {

						handle.material.color.setHex( 0xffff00 );
						handle.material.opacity = 1.0;

					} else if ( this.axis.split( '' ).some( function ( a ) {

						return handle.name === a;

					} ) ) {

						handle.material.color.setHex( 0xffff00 );
						handle.material.opacity = 1.0;

					}

				}

			}

			super.updateMatrixWorld( force );

		}

	}

	TransformControlsGizmo.prototype.isTransformControlsGizmo = true; //

	class TransformControlsPlane extends THREE.Mesh {

		constructor() {

			super( new THREE.PlaneGeometry( 100000, 100000, 2, 2 ), new THREE.MeshBasicMaterial( {
				visible: false,
				wireframe: true,
				side: THREE.DoubleSide,
				transparent: true,
				opacity: 0.1,
				toneMapped: false
			} ) );
			this.type = 'TransformControlsPlane';

		}

		updateMatrixWorld( force ) {

			let space = this.space;
			this.position.copy( this.worldPosition );
			if ( this.mode === 'scale' ) space = 'local'; // scale always oriented to local rotation

			_v1.copy( _unitX ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

			_v2.copy( _unitY ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion );

			_v3.copy( _unitZ ).applyQuaternion( space === 'local' ? this.worldQuaternion : _identityQuaternion ); // Align the plane for current transform mode, axis and space.


			_alignVector.copy( _v2 );

			switch ( this.mode ) {

				case 'translate':
				case 'scale':
					switch ( this.axis ) {

						case 'X':
							_alignVector.copy( this.eye ).cross( _v1 );

							_dirVector.copy( _v1 ).cross( _alignVector );

							break;

						case 'Y':
							_alignVector.copy( this.eye ).cross( _v2 );

							_dirVector.copy( _v2 ).cross( _alignVector );

							break;

						case 'Z':
							_alignVector.copy( this.eye ).cross( _v3 );

							_dirVector.copy( _v3 ).cross( _alignVector );

							break;

						case 'XY':
							_dirVector.copy( _v3 );

							break;

						case 'YZ':
							_dirVector.copy( _v1 );

							break;

						case 'XZ':
							_alignVector.copy( _v3 );

							_dirVector.copy( _v2 );

							break;

						case 'XYZ':
						case 'E':
							_dirVector.set( 0, 0, 0 );

							break;

					}

					break;

				case 'rotate':
				default:
					// special case for rotate
					_dirVector.set( 0, 0, 0 );

			}

			if ( _dirVector.length() === 0 ) {

				// If in rotate mode, make the plane parallel to camera
				this.quaternion.copy( this.cameraQuaternion );

			} else {

				_tempMatrix.lookAt( _tempVector.set( 0, 0, 0 ), _dirVector, _alignVector );

				this.quaternion.setFromRotationMatrix( _tempMatrix );

			}

			super.updateMatrixWorld( force );

		}

	}

	TransformControlsPlane.prototype.isTransformControlsPlane = true;

	THREE.TransformControls = TransformControls;
	THREE.TransformControlsGizmo = TransformControlsGizmo;
	THREE.TransformControlsPlane = TransformControlsPlane;

} )();
