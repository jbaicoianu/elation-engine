/**
 * @author Slayvin / http://slayvin.net
 */

THREE.Reflector = function ( geometry, options ) {

	THREE.Mesh.call( this, geometry );

	this.type = 'Reflector';

	var scope = this;

	options = options || {};

	var color = ( options.color !== undefined ) ? new THREE.Color( options.color ) : new THREE.Color( 0x7F7F7F );
	var textureWidth = options.textureWidth || 512;
	var textureHeight = options.textureHeight || 512;
	var clipBias = options.clipBias || 0;
	var shader = options.shader || THREE.Reflector.ReflectorShader;
	var recursion = options.recursion !== undefined ? options.recursion : 0;

	//

	var reflectorPlane = new THREE.Plane();
	var normal = new THREE.Vector3();
	var reflectorWorldPosition = new THREE.Vector3();
	var cameraWorldPosition = new THREE.Vector3();
	var rotationMatrix = new THREE.Matrix4();
	var lookAtPosition = new THREE.Vector3( 0, 0, - 1 );
	var clipPlane = new THREE.Vector4();

	var view = new THREE.Vector3();
	var target = new THREE.Vector3();
	var q = new THREE.Vector4();

	var textureMatrix = new THREE.Matrix4();
	var virtualCamera = new THREE.PerspectiveCamera();

	var parameters = {
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
		format: THREE.RGBFormat,
		stencilBuffer: false
	};

	var renderTarget = new THREE.WebGLRenderTarget( textureWidth, textureHeight, parameters );

	if ( ! THREE.Math.isPowerOfTwo( textureWidth ) || ! THREE.Math.isPowerOfTwo( textureHeight ) ) {

		renderTarget.texture.generateMipmaps = false;

	}

	var material = new THREE.ShaderMaterial( {
		uniforms: THREE.UniformsUtils.clone( shader.uniforms ),
		fragmentShader: shader.fragmentShader,
		vertexShader: shader.vertexShader
	} );

	material.uniforms[ "tDiffuse" ].value = renderTarget.texture;
	material.uniforms[ "color" ].value = color;
	material.uniforms[ "textureMatrix" ].value = textureMatrix;

	this.material = material;

	this.onBeforeRender = function ( renderer, scene, camera ) {

		if ( 'recursion' in camera.userData ) {

			if ( camera.userData.recursion === recursion ) return;

			camera.userData.recursion ++;

		}

		reflectorWorldPosition.setFromMatrixPosition( scope.matrixWorld );
		cameraWorldPosition.setFromMatrixPosition( camera.matrixWorld );

		rotationMatrix.extractRotation( scope.matrixWorld );

		normal.set( 0, 0, 1 );
		normal.applyMatrix4( rotationMatrix );

		view.subVectors( reflectorWorldPosition, cameraWorldPosition );

		// Avoid rendering when reflector is facing away

		if ( view.dot( normal ) > 0 ) return;

		view.reflect( normal ).negate();
		view.add( reflectorWorldPosition );

		rotationMatrix.extractRotation( camera.matrixWorld );

		lookAtPosition.set( 0, 0, - 1 );
		lookAtPosition.applyMatrix4( rotationMatrix );
		lookAtPosition.add( cameraWorldPosition );

		target.subVectors( reflectorWorldPosition, lookAtPosition );
		target.reflect( normal ).negate();
		target.add( reflectorWorldPosition );

		virtualCamera.position.copy( view );
		virtualCamera.up.set( 0, 1, 0 );
		virtualCamera.up.applyMatrix4( rotationMatrix );
		virtualCamera.up.reflect( normal );
		virtualCamera.lookAt( target );

		virtualCamera.far = camera.far; // Used in WebGLBackground

		virtualCamera.updateMatrixWorld();
		virtualCamera.projectionMatrix.copy( camera.projectionMatrix );

		virtualCamera.userData.recursion = 0;

		// Update the texture matrix
		textureMatrix.set(
			0.5, 0.0, 0.0, 0.5,
			0.0, 0.5, 0.0, 0.5,
			0.0, 0.0, 0.5, 0.5,
			0.0, 0.0, 0.0, 1.0
		);
		textureMatrix.multiply( virtualCamera.projectionMatrix );
		textureMatrix.multiply( virtualCamera.matrixWorldInverse );
		textureMatrix.multiply( scope.matrixWorld );

		// Now update projection matrix with new clip plane, implementing code from: http://www.terathon.com/code/oblique.html
		// Paper explaining this technique: http://www.terathon.com/lengyel/Lengyel-Oblique.pdf
		reflectorPlane.setFromNormalAndCoplanarPoint( normal, reflectorWorldPosition );
		reflectorPlane.applyMatrix4( virtualCamera.matrixWorldInverse );

		clipPlane.set( reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant );

		var projectionMatrix = virtualCamera.projectionMatrix;

		q.x = ( Math.sign( clipPlane.x ) + projectionMatrix.elements[ 8 ] ) / projectionMatrix.elements[ 0 ];
		q.y = ( Math.sign( clipPlane.y ) + projectionMatrix.elements[ 9 ] ) / projectionMatrix.elements[ 5 ];
		q.z = - 1.0;
		q.w = ( 1.0 + projectionMatrix.elements[ 10 ] ) / projectionMatrix.elements[ 14 ];

		// Calculate the scaled plane vector
		clipPlane.multiplyScalar( 2.0 / clipPlane.dot( q ) );

		// Replacing the third row of the projection matrix
		projectionMatrix.elements[ 2 ] = clipPlane.x;
		projectionMatrix.elements[ 6 ] = clipPlane.y;
		projectionMatrix.elements[ 10 ] = clipPlane.z + 1.0 - clipBias;
		projectionMatrix.elements[ 14 ] = clipPlane.w;

		// Render

		scope.visible = false;

		var currentRenderTarget = renderer.getRenderTarget();

		var currentVrEnabled = renderer.vr.enabled;
		var currentShadowAutoUpdate = renderer.shadowMap.autoUpdate;

		renderer.vr.enabled = false; // Avoid camera modification and recursion
		renderer.shadowMap.autoUpdate = false; // Avoid re-computing shadows

		renderer.setRenderTarget( renderTarget );
		renderer.clear();
		renderer.render( scene, virtualCamera );

		renderer.vr.enabled = currentVrEnabled;
		renderer.shadowMap.autoUpdate = currentShadowAutoUpdate;

		renderer.setRenderTarget( currentRenderTarget );

		// Restore viewport

		var viewport = camera.viewport;

		if ( viewport !== undefined ) {

			renderer.state.viewport( viewport );

		}

		scope.visible = true;

	};

	this.getRenderTarget = function () {

		return renderTarget;

	};

};

THREE.Reflector.prototype = Object.create( THREE.Mesh.prototype );
THREE.Reflector.prototype.constructor = THREE.Reflector;

THREE.Reflector.ReflectorShader = {

	uniforms: {

		'color': {
			value: null
		},

		'tDiffuse': {
			value: null
		},

		'textureMatrix': {
			value: null
		}

	},

	vertexShader: [
		'uniform mat4 textureMatrix;',
		'varying vec4 vUv;',

		'void main() {',

		'	vUv = textureMatrix * vec4( position, 1.0 );',

		'	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'
	].join( '\n' ),

	fragmentShader: [
		'uniform vec3 color;',
		'uniform sampler2D tDiffuse;',
		'varying vec4 vUv;',

		'float blendOverlay( float base, float blend ) {',

		'	return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );',

		'}',

		'vec3 blendOverlay( vec3 base, vec3 blend ) {',

		'	return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );',

		'}',

		'void main() {',

		'	vec4 base = texture2DProj( tDiffuse, vUv );',
		'	gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',

		'}'
	].join( '\n' )
};

'use strict';

THREE.SkeletonUtils = {

	retarget: function () {

		var pos = new THREE.Vector3(),
			quat = new THREE.Quaternion(),
			scale = new THREE.Vector3(),
			bindBoneMatrix = new THREE.Matrix4(),
			relativeMatrix = new THREE.Matrix4(),
			globalMatrix = new THREE.Matrix4();

		return function ( target, source, options ) {

			options = options || {};
			options.preserveMatrix = options.preserveMatrix !== undefined ? options.preserveMatrix : true;
			options.preservePosition = options.preservePosition !== undefined ? options.preservePosition : true;
			options.preserveHipPosition = options.preserveHipPosition !== undefined ? options.preserveHipPosition : false;
			options.useTargetMatrix = options.useTargetMatrix !== undefined ? options.useTargetMatrix : false;
			options.hip = options.hip !== undefined ? options.hip : "hip";
			options.names = options.names || {};

			var sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target ),
				bindBones,
				bone, name, boneTo,
				bonesPosition, i;

			// reset bones

			if ( target.isObject3D ) {

				target.skeleton.pose();

			} else {

				options.useTargetMatrix = true;
				options.preserveMatrix = false;

			}

			if ( options.preservePosition ) {

				bonesPosition = [];

				for ( i = 0; i < bones.length; i ++ ) {

					bonesPosition.push( bones[ i ].position.clone() );

				}

			}

			if ( options.preserveMatrix ) {

				// reset matrix

				target.updateMatrixWorld();

				target.matrixWorld.identity();

				// reset children matrix

				for ( i = 0; i < target.children.length; ++ i ) {

					target.children[ i ].updateMatrixWorld( true );

				}

			}

			if ( options.offsets ) {

				bindBones = [];

				for ( i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( options.offsets && options.offsets[ name ] ) {

						bone.matrix.multiply( options.offsets[ name ] );

						bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );

						bone.updateMatrixWorld();

					}

					bindBones.push( bone.matrixWorld.clone() );

				}

			}

			for ( i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;

				boneTo = this.getBoneByName( name, sourceBones );

				globalMatrix.copy( bone.matrixWorld );

				if ( boneTo ) {

					boneTo.updateMatrixWorld();

					if ( options.useTargetMatrix ) {

						relativeMatrix.copy( boneTo.matrixWorld );

					} else {

						relativeMatrix.getInverse( target.matrixWorld );
						relativeMatrix.multiply( boneTo.matrixWorld );

					}

					// ignore scale to extract rotation

					scale.setFromMatrixScale( relativeMatrix );
					relativeMatrix.scale( scale.set( 1 / scale.x, 1 / scale.y, 1 / scale.z ) );

					// apply to global matrix

					globalMatrix.makeRotationFromQuaternion( quat.setFromRotationMatrix( relativeMatrix ) );

					if ( target.isObject3D ) {

						var boneIndex = bones.indexOf( bone ),
							wBindMatrix = bindBones ? bindBones[ boneIndex ] : bindBoneMatrix.getInverse( target.skeleton.boneInverses[ boneIndex ] );

						globalMatrix.multiply( wBindMatrix );

					}

					globalMatrix.copyPosition( relativeMatrix );

				}

				if ( bone.parent && bone.parent.isBone ) {

					bone.matrix.getInverse( bone.parent.matrixWorld );
					bone.matrix.multiply( globalMatrix );

				} else {

					bone.matrix.copy( globalMatrix );

				}

				if ( options.preserveHipPosition && name === options.hip ) {

					bone.matrix.setPosition( pos.set( 0, bone.position.y, 0 ) );

				}

				bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );

				bone.updateMatrixWorld();

			}

			if ( options.preservePosition ) {

				for ( i = 0; i < bones.length; ++ i ) {

					bone = bones[ i ];
					name = options.names[ bone.name ] || bone.name;

					if ( name !== options.hip ) {

						bone.position.copy( bonesPosition[ i ] );

					}

				}

			}

			if ( options.preserveMatrix ) {

				// restore matrix

				target.updateMatrixWorld( true );

			}

		};

	}(),

	retargetClip: function ( target, source, clip, options ) {

		options = options || {};
		options.useFirstFramePosition = options.useFirstFramePosition !== undefined ? options.useFirstFramePosition : false;
		options.fps = options.fps !== undefined ? options.fps : 30;
		options.names = options.names || [];

		if ( ! source.isObject3D ) {

			source = this.getHelperFromSkeleton( source );

		}

		var numFrames = Math.round( clip.duration * ( options.fps / 1000 ) * 1000 ),
			delta = 1 / options.fps,
			convertedTracks = [],
			mixer = new THREE.AnimationMixer( source ),
			bones = this.getBones( target.skeleton ),
			boneDatas = [],
			positionOffset,
			bone, boneTo, boneData,
			name, i, j;

		mixer.clipAction( clip ).play();
		mixer.update( 0 );

		source.updateMatrixWorld();

		for ( i = 0; i < numFrames; ++ i ) {

			var time = i * delta;

			this.retarget( target, source, options );

			for ( j = 0; j < bones.length; ++ j ) {

				name = options.names[ bones[ j ].name ] || bones[ j ].name;

				boneTo = this.getBoneByName( name, source.skeleton );

				if ( boneTo ) {

					bone = bones[ j ];
					boneData = boneDatas[ j ] = boneDatas[ j ] || { bone: bone };

					if ( options.hip === name ) {

						if ( ! boneData.pos ) {

							boneData.pos = {
								times: new Float32Array( numFrames ),
								values: new Float32Array( numFrames * 3 )
							};

						}

						if ( options.useFirstFramePosition ) {

							if ( i === 0 ) {

								positionOffset = bone.position.clone();

							}

							bone.position.sub( positionOffset );

						}

						boneData.pos.times[ i ] = time;

						bone.position.toArray( boneData.pos.values, i * 3 );

					}

					if ( ! boneData.quat ) {

						boneData.quat = {
							times: new Float32Array( numFrames ),
							values: new Float32Array( numFrames * 4 )
						};

					}

					boneData.quat.times[ i ] = time;

					bone.quaternion.toArray( boneData.quat.values, i * 4 );

				}

			}

			mixer.update( delta );

			source.updateMatrixWorld();

		}

		for ( i = 0; i < boneDatas.length; ++ i ) {

			boneData = boneDatas[ i ];

			if ( boneData ) {

				if ( boneData.pos ) {

					convertedTracks.push( new THREE.VectorKeyframeTrack(
						".bones[" + boneData.bone.name + "].position",
						boneData.pos.times,
						boneData.pos.values
					) );

				}

				convertedTracks.push( new THREE.QuaternionKeyframeTrack(
					".bones[" + boneData.bone.name + "].quaternion",
					boneData.quat.times,
					boneData.quat.values
				) );

			}

		}

		mixer.uncacheAction( clip );

		return new THREE.AnimationClip( clip.name, - 1, convertedTracks );

	},

	getHelperFromSkeleton: function ( skeleton ) {

		var source = new THREE.SkeletonHelper( skeleton.bones[ 0 ] );
		source.skeleton = skeleton;

		return source;

	},

	getSkeletonOffsets: function () {

		var targetParentPos = new THREE.Vector3(),
			targetPos = new THREE.Vector3(),
			sourceParentPos = new THREE.Vector3(),
			sourcePos = new THREE.Vector3(),
			targetDir = new THREE.Vector2(),
			sourceDir = new THREE.Vector2();

		return function ( target, source, options ) {

			options = options || {};
			options.hip = options.hip !== undefined ? options.hip : "hip";
			options.names = options.names || {};

			if ( ! source.isObject3D ) {

				source = this.getHelperFromSkeleton( source );

			}

			var nameKeys = Object.keys( options.names ),
				nameValues = Object.values( options.names ),
				sourceBones = source.isObject3D ? source.skeleton.bones : this.getBones( source ),
				bones = target.isObject3D ? target.skeleton.bones : this.getBones( target ),
				offsets = [],
				bone, boneTo,
				name, i;

			target.skeleton.pose();

			for ( i = 0; i < bones.length; ++ i ) {

				bone = bones[ i ];
				name = options.names[ bone.name ] || bone.name;

				boneTo = this.getBoneByName( name, sourceBones );

				if ( boneTo && name !== options.hip ) {

					var boneParent = this.getNearestBone( bone.parent, nameKeys ),
						boneToParent = this.getNearestBone( boneTo.parent, nameValues );

					boneParent.updateMatrixWorld();
					boneToParent.updateMatrixWorld();

					targetParentPos.setFromMatrixPosition( boneParent.matrixWorld );
					targetPos.setFromMatrixPosition( bone.matrixWorld );

					sourceParentPos.setFromMatrixPosition( boneToParent.matrixWorld );
					sourcePos.setFromMatrixPosition( boneTo.matrixWorld );

					targetDir.subVectors(
						new THREE.Vector2( targetPos.x, targetPos.y ),
						new THREE.Vector2( targetParentPos.x, targetParentPos.y )
					).normalize();

					sourceDir.subVectors(
						new THREE.Vector2( sourcePos.x, sourcePos.y ),
						new THREE.Vector2( sourceParentPos.x, sourceParentPos.y )
					).normalize();

					var laterialAngle = targetDir.angle() - sourceDir.angle();

					var offset = new THREE.Matrix4().makeRotationFromEuler(
						new THREE.Euler(
							0,
							0,
							laterialAngle
						)
					);

					bone.matrix.multiply( offset );

					bone.matrix.decompose( bone.position, bone.quaternion, bone.scale );

					bone.updateMatrixWorld();

					offsets[ name ] = offset;

				}

			}

			return offsets;

		};

	}(),

	renameBones: function ( skeleton, names ) {

		var bones = this.getBones( skeleton );

		for ( var i = 0; i < bones.length; ++ i ) {

			var bone = bones[ i ];

			if ( names[ bone.name ] ) {

				bone.name = names[ bone.name ];

			}

		}

		return this;

	},

	getBones: function ( skeleton ) {

		return Array.isArray( skeleton ) ? skeleton : skeleton.bones;

	},

	getBoneByName: function ( name, skeleton ) {

		for ( var i = 0, bones = this.getBones( skeleton ); i < bones.length; i ++ ) {

			if ( name === bones[ i ].name )

				return bones[ i ];

		}

	},

	getNearestBone: function ( bone, names ) {

		while ( bone.isBone ) {

			if ( names.indexOf( bone.name ) !== - 1 ) {

				return bone;

			}

			bone = bone.parent;

		}

	},

	findBoneTrackData: function ( name, tracks ) {

		var regexp = /\[(.*)\]\.(.*)/,
			result = { name: name };

		for ( var i = 0; i < tracks.length; ++ i ) {

			// 1 is track name
			// 2 is track type
			var trackData = regexp.exec( tracks[ i ].name );

			if ( trackData && name === trackData[ 1 ] ) {

				result[ trackData[ 2 ] ] = i;

			}

		}

		return result;

	},

	getEqualsBonesNames: function ( skeleton, targetSkeleton ) {

		var sourceBones = this.getBones( skeleton ),
			targetBones = this.getBones( targetSkeleton ),
			bones = [];

		search : for ( var i = 0; i < sourceBones.length; i ++ ) {

			var boneName = sourceBones[ i ].name;

			for ( var j = 0; j < targetBones.length; j ++ ) {

				if ( boneName === targetBones[ j ].name ) {

					bones.push( boneName );

					continue search;

				}

			}

		}

		return bones;

	}

};
