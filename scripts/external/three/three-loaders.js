if (typeof THREE == 'undefined') var THREE = {};

( function () {

	class ColladaLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = scope.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
			const loader = new THREE.FileLoader( scope.manager );
			loader.setPath( scope.path );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text, path ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( text, path ) {

			function getElementsByTagName( xml, name ) {

				// Non recursive xml.getElementsByTagName() ...
				const array = [];
				const childNodes = xml.childNodes;

				for ( let i = 0, l = childNodes.length; i < l; i ++ ) {

					const child = childNodes[ i ];

					if ( child.nodeName === name ) {

						array.push( child );

					}

				}

				return array;

			}

			function parseStrings( text ) {

				if ( text.length === 0 ) return [];
				const parts = text.trim().split( /\s+/ );
				const array = new Array( parts.length );

				for ( let i = 0, l = parts.length; i < l; i ++ ) {

					array[ i ] = parts[ i ];

				}

				return array;

			}

			function parseFloats( text ) {

				if ( text.length === 0 ) return [];
				const parts = text.trim().split( /\s+/ );
				const array = new Array( parts.length );

				for ( let i = 0, l = parts.length; i < l; i ++ ) {

					array[ i ] = parseFloat( parts[ i ] );

				}

				return array;

			}

			function parseInts( text ) {

				if ( text.length === 0 ) return [];
				const parts = text.trim().split( /\s+/ );
				const array = new Array( parts.length );

				for ( let i = 0, l = parts.length; i < l; i ++ ) {

					array[ i ] = parseInt( parts[ i ] );

				}

				return array;

			}

			function parseId( text ) {

				return text.substring( 1 );

			}

			function generateId() {

				return 'three_default_' + count ++;

			}

			function isEmpty( object ) {

				return Object.keys( object ).length === 0;

			} // asset


			function parseAsset( xml ) {

				return {
					unit: parseAssetUnit( getElementsByTagName( xml, 'unit' )[ 0 ] ),
					upAxis: parseAssetUpAxis( getElementsByTagName( xml, 'up_axis' )[ 0 ] )
				};

			}

			function parseAssetUnit( xml ) {

				if ( xml !== undefined && xml.hasAttribute( 'meter' ) === true ) {

					return parseFloat( xml.getAttribute( 'meter' ) );

				} else {

					return 1; // default 1 meter

				}

			}

			function parseAssetUpAxis( xml ) {

				return xml !== undefined ? xml.textContent : 'Y_UP';

			} // library


			function parseLibrary( xml, libraryName, nodeName, parser ) {

				const library = getElementsByTagName( xml, libraryName )[ 0 ];

				if ( library !== undefined ) {

					const elements = getElementsByTagName( library, nodeName );

					for ( let i = 0; i < elements.length; i ++ ) {

						parser( elements[ i ] );

					}

				}

			}

			function buildLibrary( data, builder ) {

				for ( const name in data ) {

					const object = data[ name ];
					object.build = builder( data[ name ] );

				}

			} // get


			function getBuild( data, builder ) {

				if ( data.build !== undefined ) return data.build;
				data.build = builder( data );
				return data.build;

			} // animation


			function parseAnimation( xml ) {

				const data = {
					sources: {},
					samplers: {},
					channels: {}
				};
				let hasChildren = false;

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;
					let id;

					switch ( child.nodeName ) {

						case 'source':
							id = child.getAttribute( 'id' );
							data.sources[ id ] = parseSource( child );
							break;

						case 'sampler':
							id = child.getAttribute( 'id' );
							data.samplers[ id ] = parseAnimationSampler( child );
							break;

						case 'channel':
							id = child.getAttribute( 'target' );
							data.channels[ id ] = parseAnimationChannel( child );
							break;

						case 'animation':
							// hierarchy of related animations
							parseAnimation( child );
							hasChildren = true;
							break;

						default:
							console.log( child );

					}

				}

				if ( hasChildren === false ) {

					// since 'id' attributes can be optional, it's necessary to generate a UUID for unqiue assignment
					library.animations[ xml.getAttribute( 'id' ) || THREE.MathUtils.generateUUID() ] = data;

				}

			}

			function parseAnimationSampler( xml ) {

				const data = {
					inputs: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'input':
							const id = parseId( child.getAttribute( 'source' ) );
							const semantic = child.getAttribute( 'semantic' );
							data.inputs[ semantic ] = id;
							break;

					}

				}

				return data;

			}

			function parseAnimationChannel( xml ) {

				const data = {};
				const target = xml.getAttribute( 'target' ); // parsing SID Addressing Syntax

				let parts = target.split( '/' );
				const id = parts.shift();
				let sid = parts.shift(); // check selection syntax

				const arraySyntax = sid.indexOf( '(' ) !== - 1;
				const memberSyntax = sid.indexOf( '.' ) !== - 1;

				if ( memberSyntax ) {

					//  member selection access
					parts = sid.split( '.' );
					sid = parts.shift();
					data.member = parts.shift();

				} else if ( arraySyntax ) {

					// array-access syntax. can be used to express fields in one-dimensional vectors or two-dimensional matrices.
					const indices = sid.split( '(' );
					sid = indices.shift();

					for ( let i = 0; i < indices.length; i ++ ) {

						indices[ i ] = parseInt( indices[ i ].replace( /\)/, '' ) );

					}

					data.indices = indices;

				}

				data.id = id;
				data.sid = sid;
				data.arraySyntax = arraySyntax;
				data.memberSyntax = memberSyntax;
				data.sampler = parseId( xml.getAttribute( 'source' ) );
				return data;

			}

			function buildAnimation( data ) {

				const tracks = [];
				const channels = data.channels;
				const samplers = data.samplers;
				const sources = data.sources;

				for ( const target in channels ) {

					if ( channels.hasOwnProperty( target ) ) {

						const channel = channels[ target ];
						const sampler = samplers[ channel.sampler ];
						const inputId = sampler.inputs.INPUT;
						const outputId = sampler.inputs.OUTPUT;
						const inputSource = sources[ inputId ];
						const outputSource = sources[ outputId ];
						const animation = buildAnimationChannel( channel, inputSource, outputSource );
						createKeyframeTracks( animation, tracks );

					}

				}

				return tracks;

			}

			function getAnimation( id ) {

				return getBuild( library.animations[ id ], buildAnimation );

			}

			function buildAnimationChannel( channel, inputSource, outputSource ) {

				const node = library.nodes[ channel.id ];
				const object3D = getNode( node.id );
				const transform = node.transforms[ channel.sid ];
				const defaultMatrix = node.matrix.clone().transpose();
				let time, stride;
				let i, il, j, jl;
				const data = {}; // the collada spec allows the animation of data in various ways.
				// depending on the transform type (matrix, translate, rotate, scale), we execute different logic

				switch ( transform ) {

					case 'matrix':
						for ( i = 0, il = inputSource.array.length; i < il; i ++ ) {

							time = inputSource.array[ i ];
							stride = i * outputSource.stride;
							if ( data[ time ] === undefined ) data[ time ] = {};

							if ( channel.arraySyntax === true ) {

								const value = outputSource.array[ stride ];
								const index = channel.indices[ 0 ] + 4 * channel.indices[ 1 ];
								data[ time ][ index ] = value;

							} else {

								for ( j = 0, jl = outputSource.stride; j < jl; j ++ ) {

									data[ time ][ j ] = outputSource.array[ stride + j ];

								}

							}

						}

						break;

					case 'translate':
						console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
						break;

					case 'rotate':
						console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
						break;

					case 'scale':
						console.warn( 'THREE.ColladaLoader: Animation transform type "%s" not yet implemented.', transform );
						break;

				}

				const keyframes = prepareAnimationData( data, defaultMatrix );
				const animation = {
					name: object3D.uuid,
					keyframes: keyframes
				};
				return animation;

			}

			function prepareAnimationData( data, defaultMatrix ) {

				const keyframes = []; // transfer data into a sortable array

				for ( const time in data ) {

					keyframes.push( {
						time: parseFloat( time ),
						value: data[ time ]
					} );

				} // ensure keyframes are sorted by time


				keyframes.sort( ascending ); // now we clean up all animation data, so we can use them for keyframe tracks

				for ( let i = 0; i < 16; i ++ ) {

					transformAnimationData( keyframes, i, defaultMatrix.elements[ i ] );

				}

				return keyframes; // array sort function

				function ascending( a, b ) {

					return a.time - b.time;

				}

			}

			const position = new THREE.Vector3();
			const scale = new THREE.Vector3();
			const quaternion = new THREE.Quaternion();

			function createKeyframeTracks( animation, tracks ) {

				const keyframes = animation.keyframes;
				const name = animation.name;
				const times = [];
				const positionData = [];
				const quaternionData = [];
				const scaleData = [];

				for ( let i = 0, l = keyframes.length; i < l; i ++ ) {

					const keyframe = keyframes[ i ];
					const time = keyframe.time;
					const value = keyframe.value;
					matrix.fromArray( value ).transpose();
					matrix.decompose( position, quaternion, scale );
					times.push( time );
					positionData.push( position.x, position.y, position.z );
					quaternionData.push( quaternion.x, quaternion.y, quaternion.z, quaternion.w );
					scaleData.push( scale.x, scale.y, scale.z );

				}

				if ( positionData.length > 0 ) tracks.push( new THREE.VectorKeyframeTrack( name + '.position', times, positionData ) );
				if ( quaternionData.length > 0 ) tracks.push( new THREE.QuaternionKeyframeTrack( name + '.quaternion', times, quaternionData ) );
				if ( scaleData.length > 0 ) tracks.push( new THREE.VectorKeyframeTrack( name + '.scale', times, scaleData ) );
				return tracks;

			}

			function transformAnimationData( keyframes, property, defaultValue ) {

				let keyframe;
				let empty = true;
				let i, l; // check, if values of a property are missing in our keyframes

				for ( i = 0, l = keyframes.length; i < l; i ++ ) {

					keyframe = keyframes[ i ];

					if ( keyframe.value[ property ] === undefined ) {

						keyframe.value[ property ] = null; // mark as missing

					} else {

						empty = false;

					}

				}

				if ( empty === true ) {

					// no values at all, so we set a default value
					for ( i = 0, l = keyframes.length; i < l; i ++ ) {

						keyframe = keyframes[ i ];
						keyframe.value[ property ] = defaultValue;

					}

				} else {

					// filling gaps
					createMissingKeyframes( keyframes, property );

				}

			}

			function createMissingKeyframes( keyframes, property ) {

				let prev, next;

				for ( let i = 0, l = keyframes.length; i < l; i ++ ) {

					const keyframe = keyframes[ i ];

					if ( keyframe.value[ property ] === null ) {

						prev = getPrev( keyframes, i, property );
						next = getNext( keyframes, i, property );

						if ( prev === null ) {

							keyframe.value[ property ] = next.value[ property ];
							continue;

						}

						if ( next === null ) {

							keyframe.value[ property ] = prev.value[ property ];
							continue;

						}

						interpolate( keyframe, prev, next, property );

					}

				}

			}

			function getPrev( keyframes, i, property ) {

				while ( i >= 0 ) {

					const keyframe = keyframes[ i ];
					if ( keyframe.value[ property ] !== null ) return keyframe;
					i --;

				}

				return null;

			}

			function getNext( keyframes, i, property ) {

				while ( i < keyframes.length ) {

					const keyframe = keyframes[ i ];
					if ( keyframe.value[ property ] !== null ) return keyframe;
					i ++;

				}

				return null;

			}

			function interpolate( key, prev, next, property ) {

				if ( next.time - prev.time === 0 ) {

					key.value[ property ] = prev.value[ property ];
					return;

				}

				key.value[ property ] = ( key.time - prev.time ) * ( next.value[ property ] - prev.value[ property ] ) / ( next.time - prev.time ) + prev.value[ property ];

			} // animation clips


			function parseAnimationClip( xml ) {

				const data = {
					name: xml.getAttribute( 'id' ) || 'default',
					start: parseFloat( xml.getAttribute( 'start' ) || 0 ),
					end: parseFloat( xml.getAttribute( 'end' ) || 0 ),
					animations: []
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'instance_animation':
							data.animations.push( parseId( child.getAttribute( 'url' ) ) );
							break;

					}

				}

				library.clips[ xml.getAttribute( 'id' ) ] = data;

			}

			function buildAnimationClip( data ) {

				const tracks = [];
				const name = data.name;
				const duration = data.end - data.start || - 1;
				const animations = data.animations;

				for ( let i = 0, il = animations.length; i < il; i ++ ) {

					const animationTracks = getAnimation( animations[ i ] );

					for ( let j = 0, jl = animationTracks.length; j < jl; j ++ ) {

						tracks.push( animationTracks[ j ] );

					}

				}

				return new THREE.AnimationClip( name, duration, tracks );

			}

			function getAnimationClip( id ) {

				return getBuild( library.clips[ id ], buildAnimationClip );

			} // controller


			function parseController( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'skin':
							// there is exactly one skin per controller
							data.id = parseId( child.getAttribute( 'source' ) );
							data.skin = parseSkin( child );
							break;

						case 'morph':
							data.id = parseId( child.getAttribute( 'source' ) );
							console.warn( 'THREE.ColladaLoader: Morph target animation not supported yet.' );
							break;

					}

				}

				library.controllers[ xml.getAttribute( 'id' ) ] = data;

			}

			function parseSkin( xml ) {

				const data = {
					sources: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'bind_shape_matrix':
							data.bindShapeMatrix = parseFloats( child.textContent );
							break;

						case 'source':
							const id = child.getAttribute( 'id' );
							data.sources[ id ] = parseSource( child );
							break;

						case 'joints':
							data.joints = parseJoints( child );
							break;

						case 'vertex_weights':
							data.vertexWeights = parseVertexWeights( child );
							break;

					}

				}

				return data;

			}

			function parseJoints( xml ) {

				const data = {
					inputs: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'input':
							const semantic = child.getAttribute( 'semantic' );
							const id = parseId( child.getAttribute( 'source' ) );
							data.inputs[ semantic ] = id;
							break;

					}

				}

				return data;

			}

			function parseVertexWeights( xml ) {

				const data = {
					inputs: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'input':
							const semantic = child.getAttribute( 'semantic' );
							const id = parseId( child.getAttribute( 'source' ) );
							const offset = parseInt( child.getAttribute( 'offset' ) );
							data.inputs[ semantic ] = {
								id: id,
								offset: offset
							};
							break;

						case 'vcount':
							data.vcount = parseInts( child.textContent );
							break;

						case 'v':
							data.v = parseInts( child.textContent );
							break;

					}

				}

				return data;

			}

			function buildController( data ) {

				const build = {
					id: data.id
				};
				const geometry = library.geometries[ build.id ];

				if ( data.skin !== undefined ) {

					build.skin = buildSkin( data.skin ); // we enhance the 'sources' property of the corresponding geometry with our skin data

					geometry.sources.skinIndices = build.skin.indices;
					geometry.sources.skinWeights = build.skin.weights;

				}

				return build;

			}

			function buildSkin( data ) {

				const BONE_LIMIT = 4;
				const build = {
					joints: [],
					// this must be an array to preserve the joint order
					indices: {
						array: [],
						stride: BONE_LIMIT
					},
					weights: {
						array: [],
						stride: BONE_LIMIT
					}
				};
				const sources = data.sources;
				const vertexWeights = data.vertexWeights;
				const vcount = vertexWeights.vcount;
				const v = vertexWeights.v;
				const jointOffset = vertexWeights.inputs.JOINT.offset;
				const weightOffset = vertexWeights.inputs.WEIGHT.offset;
				const jointSource = data.sources[ data.joints.inputs.JOINT ];
				const inverseSource = data.sources[ data.joints.inputs.INV_BIND_MATRIX ];
				const weights = sources[ vertexWeights.inputs.WEIGHT.id ].array;
				let stride = 0;
				let i, j, l; // procces skin data for each vertex

				for ( i = 0, l = vcount.length; i < l; i ++ ) {

					const jointCount = vcount[ i ]; // this is the amount of joints that affect a single vertex

					const vertexSkinData = [];

					for ( j = 0; j < jointCount; j ++ ) {

						const skinIndex = v[ stride + jointOffset ];
						const weightId = v[ stride + weightOffset ];
						const skinWeight = weights[ weightId ];
						vertexSkinData.push( {
							index: skinIndex,
							weight: skinWeight
						} );
						stride += 2;

					} // we sort the joints in descending order based on the weights.
					// this ensures, we only procced the most important joints of the vertex


					vertexSkinData.sort( descending ); // now we provide for each vertex a set of four index and weight values.
					// the order of the skin data matches the order of vertices

					for ( j = 0; j < BONE_LIMIT; j ++ ) {

						const d = vertexSkinData[ j ];

						if ( d !== undefined ) {

							build.indices.array.push( d.index );
							build.weights.array.push( d.weight );

						} else {

							build.indices.array.push( 0 );
							build.weights.array.push( 0 );

						}

					}

				} // setup bind matrix


				if ( data.bindShapeMatrix ) {

					build.bindMatrix = new THREE.Matrix4().fromArray( data.bindShapeMatrix ).transpose();

				} else {

					build.bindMatrix = new THREE.Matrix4().identity();

				} // process bones and inverse bind matrix data


				for ( i = 0, l = jointSource.array.length; i < l; i ++ ) {

					const name = jointSource.array[ i ];
					const boneInverse = new THREE.Matrix4().fromArray( inverseSource.array, i * inverseSource.stride ).transpose();
					build.joints.push( {
						name: name,
						boneInverse: boneInverse
					} );

				}

				return build; // array sort function

				function descending( a, b ) {

					return b.weight - a.weight;

				}

			}

			function getController( id ) {

				return getBuild( library.controllers[ id ], buildController );

			} // image


			function parseImage( xml ) {

				const data = {
					init_from: getElementsByTagName( xml, 'init_from' )[ 0 ].textContent
				};
				library.images[ xml.getAttribute( 'id' ) ] = data;

			}

			function buildImage( data ) {

				if ( data.build !== undefined ) return data.build;
				return data.init_from;

			}

			function getImage( id ) {

				const data = library.images[ id ];

				if ( data !== undefined ) {

					return getBuild( data, buildImage );

				}

				console.warn( 'THREE.ColladaLoader: Couldn\'t find image with ID:', id );
				return null;

			} // effect


			function parseEffect( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'profile_COMMON':
							data.profile = parseEffectProfileCOMMON( child );
							break;

					}

				}

				library.effects[ xml.getAttribute( 'id' ) ] = data;

			}

			function parseEffectProfileCOMMON( xml ) {

				const data = {
					surfaces: {},
					samplers: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'newparam':
							parseEffectNewparam( child, data );
							break;

						case 'technique':
							data.technique = parseEffectTechnique( child );
							break;

						case 'extra':
							data.extra = parseEffectExtra( child );
							break;

					}

				}

				return data;

			}

			function parseEffectNewparam( xml, data ) {

				const sid = xml.getAttribute( 'sid' );

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'surface':
							data.surfaces[ sid ] = parseEffectSurface( child );
							break;

						case 'sampler2D':
							data.samplers[ sid ] = parseEffectSampler( child );
							break;

					}

				}

			}

			function parseEffectSurface( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'init_from':
							data.init_from = child.textContent;
							break;

					}

				}

				return data;

			}

			function parseEffectSampler( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'source':
							data.source = child.textContent;
							break;

					}

				}

				return data;

			}

			function parseEffectTechnique( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'constant':
						case 'lambert':
						case 'blinn':
						case 'phong':
							data.type = child.nodeName;
							data.parameters = parseEffectParameters( child );
							break;

						case 'extra':
							data.extra = parseEffectExtra( child );
							break;

					}

				}

				return data;

			}

			function parseEffectParameters( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'emission':
						case 'diffuse':
						case 'specular':
						case 'bump':
						case 'ambient':
						case 'shininess':
						case 'transparency':
							data[ child.nodeName ] = parseEffectParameter( child );
							break;

						case 'transparent':
							data[ child.nodeName ] = {
								opaque: child.getAttribute( 'opaque' ),
								data: parseEffectParameter( child )
							};
							break;

					}

				}

				return data;

			}

			function parseEffectParameter( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'color':
							data[ child.nodeName ] = parseFloats( child.textContent );
							break;

						case 'float':
							data[ child.nodeName ] = parseFloat( child.textContent );
							break;

						case 'texture':
							data[ child.nodeName ] = {
								id: child.getAttribute( 'texture' ),
								extra: parseEffectParameterTexture( child )
							};
							break;

					}

				}

				return data;

			}

			function parseEffectParameterTexture( xml ) {

				const data = {
					technique: {}
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'extra':
							parseEffectParameterTextureExtra( child, data );
							break;

					}

				}

				return data;

			}

			function parseEffectParameterTextureExtra( xml, data ) {

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'technique':
							parseEffectParameterTextureExtraTechnique( child, data );
							break;

					}

				}

			}

			function parseEffectParameterTextureExtraTechnique( xml, data ) {

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'repeatU':
						case 'repeatV':
						case 'offsetU':
						case 'offsetV':
							data.technique[ child.nodeName ] = parseFloat( child.textContent );
							break;

						case 'wrapU':
						case 'wrapV':
							// some files have values for wrapU/wrapV which become NaN via parseInt
							if ( child.textContent.toUpperCase() === 'TRUE' ) {

								data.technique[ child.nodeName ] = 1;

							} else if ( child.textContent.toUpperCase() === 'FALSE' ) {

								data.technique[ child.nodeName ] = 0;

							} else {

								data.technique[ child.nodeName ] = parseInt( child.textContent );

							}

							break;

						case 'bump':
							data[ child.nodeName ] = parseEffectExtraTechniqueBump( child );
							break;

					}

				}

			}

			function parseEffectExtra( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'technique':
							data.technique = parseEffectExtraTechnique( child );
							break;

					}

				}

				return data;

			}

			function parseEffectExtraTechnique( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'double_sided':
							data[ child.nodeName ] = parseInt( child.textContent );
							break;

						case 'bump':
							data[ child.nodeName ] = parseEffectExtraTechniqueBump( child );
							break;

					}

				}

				return data;

			}

			function parseEffectExtraTechniqueBump( xml ) {
				var data = {};

				for ( var i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					var child = xml.childNodes[ i ];

					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'texture':
							data[ child.nodeName ] = { id: child.getAttribute( 'texture' ), texcoord: child.getAttribute( 'texcoord' ), extra: parseEffectParameterTexture( child ) };
							break;

					}

				}

				return data;

			}

			function buildEffect( data ) {

				return data;

			}

			function getEffect( id ) {

				return getBuild( library.effects[ id ], buildEffect );

			} // material


			function parseMaterial( xml ) {

				const data = {
					name: xml.getAttribute( 'name' )
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'instance_effect':
							data.url = parseId( child.getAttribute( 'url' ) );
							break;

					}

				}

				library.materials[ xml.getAttribute( 'id' ) ] = data;

			}

			function getTextureLoader( image ) {

				let loader;
				let extension = image.slice( ( image.lastIndexOf( '.' ) - 1 >>> 0 ) + 2 ); // http://www.jstips.co/en/javascript/get-file-extension/

				extension = extension.toLowerCase();

				switch ( extension ) {

					case 'tga':
						loader = tgaLoader;
						break;

					default:
						loader = textureLoader;

				}

				return loader;

			}

			function buildMaterial( data ) {

				const effect = getEffect( data.url );
				const technique = effect.profile.technique;
				const extra = effect.profile.extra;
				let material;

				switch ( technique.type ) {

					case 'phong':
					case 'blinn':
						material = new THREE.MeshPhongMaterial();
						break;

					case 'lambert':
						material = new THREE.MeshLambertMaterial();
						break;

					default:
						material = new THREE.MeshBasicMaterial();
						break;

				}

				material.name = data.name || '';

				function getTexture( textureObject ) {

					const sampler = effect.profile.samplers[ textureObject.id ];
					let image = null; // get image

					if ( sampler !== undefined ) {

						const surface = effect.profile.surfaces[ sampler.source ];
						image = getImage( surface.init_from );

					} else {

						console.warn( 'THREE.ColladaLoader: Undefined sampler. Access image directly (see #12530).' );
						image = getImage( textureObject.id );

					} // create texture if image is avaiable


					if ( image !== null ) {

						const loader = getTextureLoader( image );

						if ( loader !== undefined ) {

							const texture = loader.load( image );
							const extra = textureObject.extra;

							if ( extra !== undefined && extra.technique !== undefined && isEmpty( extra.technique ) === false ) {

								const technique = extra.technique;
								texture.wrapS = technique.wrapU ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
								texture.wrapT = technique.wrapV ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
								texture.offset.set( technique.offsetU || 0, technique.offsetV || 0 );
								texture.repeat.set( technique.repeatU || 1, technique.repeatV || 1 );

							} else {

								texture.wrapS = THREE.RepeatWrapping;
								texture.wrapT = THREE.RepeatWrapping;

							}

							return texture;

						} else {

							console.warn( 'THREE.ColladaLoader: THREE.Loader for texture %s not found.', image );
							return null;

						}

					} else {

						console.warn( 'THREE.ColladaLoader: Couldn\'t create texture with ID:', textureObject.id );
						return null;

					}

				}

				const parameters = technique.parameters;

				for ( const key in parameters ) {

					const parameter = parameters[ key ];

					switch ( key ) {

						case 'diffuse':
							if ( parameter.color ) material.color.fromArray( parameter.color );
							if ( parameter.texture ) material.map = getTexture( parameter.texture );
							break;

						case 'specular':
							if ( parameter.color && material.specular ) material.specular.fromArray( parameter.color );
							if ( parameter.texture ) material.specularMap = getTexture( parameter.texture );
							break;

						case 'bump':
							if ( parameter.texture ) material.normalMap = getTexture( parameter.texture );
							break;

						case 'ambient':
							if ( parameter.texture ) material.lightMap = getTexture( parameter.texture );
							break;

						case 'shininess':
							if ( parameter.float && material.shininess ) material.shininess = parameter.float;
							break;

						case 'emission':
							if ( parameter.color && material.emissive ) material.emissive.fromArray( parameter.color );
							if ( parameter.texture ) material.emissiveMap = getTexture( parameter.texture );
							break;

					}

				} //


				let transparent = parameters[ 'transparent' ];
				let transparency = parameters[ 'transparency' ]; // <transparency> does not exist but <transparent>

				if ( transparency === undefined && transparent ) {

					transparency = {
						float: 1
					};

				} // <transparent> does not exist but <transparency>


				if ( transparent === undefined && transparency ) {

					transparent = {
						opaque: 'A_ONE',
						data: {
							color: [ 1, 1, 1, 1 ]
						}
					};

				}

				if ( transparent && transparency ) {

					// handle case if a texture exists but no color
					if ( transparent.data.texture ) {

						// we do not set an alpha map (see #13792)
						material.transparent = true;

					} else {

						const color = transparent.data.color;

						switch ( transparent.opaque ) {

							case 'A_ONE':
								material.opacity = color[ 3 ] * transparency.float;
								break;

							case 'RGB_ZERO':
								material.opacity = 1 - color[ 0 ] * transparency.float;
								break;

							case 'A_ZERO':
								material.opacity = 1 - color[ 3 ] * transparency.float;
								break;

							case 'RGB_ONE':
								material.opacity = color[ 0 ] * transparency.float;
								break;

							default:
								console.warn( 'THREE.ColladaLoader: Invalid opaque type "%s" of transparent tag.', transparent.opaque );

						}

						if ( material.opacity < 1 ) material.transparent = true;

					}

				} //


				if ( technique.extra !== undefined && technique.extra.technique !== undefined ) {

					let techniques = technique.extra.technique;

					for ( let k in techniques ) {

						let v = techniques[k];

						switch (k) {

							case 'double_sided':
								material.side = ( v === 1 ? THREE.DoubleSide : THREE.FrontSide );
								break;

							case 'bump':
								material.normalMap = getTexture( v.texture );
								material.normalScale = new THREE.Vector2( 1, 1 );
								break;

						}

					}

				}

				return material;

			}

			function getMaterial( id ) {

				return getBuild( library.materials[ id ], buildMaterial );

			} // camera


			function parseCamera( xml ) {

				const data = {
					name: xml.getAttribute( 'name' )
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'optics':
							data.optics = parseCameraOptics( child );
							break;

					}

				}

				library.cameras[ xml.getAttribute( 'id' ) ] = data;

			}

			function parseCameraOptics( xml ) {

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];

					switch ( child.nodeName ) {

						case 'technique_common':
							return parseCameraTechnique( child );

					}

				}

				return {};

			}

			function parseCameraTechnique( xml ) {

				const data = {};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];

					switch ( child.nodeName ) {

						case 'perspective':
						case 'orthographic':
							data.technique = child.nodeName;
							data.parameters = parseCameraParameters( child );
							break;

					}

				}

				return data;

			}

			function parseCameraParameters( xml ) {

				const data = {};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];

					switch ( child.nodeName ) {

						case 'xfov':
						case 'yfov':
						case 'xmag':
						case 'ymag':
						case 'znear':
						case 'zfar':
						case 'aspect_ratio':
							data[ child.nodeName ] = parseFloat( child.textContent );
							break;

					}

				}

				return data;

			}

			function buildCamera( data ) {

				let camera;

				switch ( data.optics.technique ) {

					case 'perspective':
						camera = new THREE.PerspectiveCamera( data.optics.parameters.yfov, data.optics.parameters.aspect_ratio, data.optics.parameters.znear, data.optics.parameters.zfar );
						break;

					case 'orthographic':
						let ymag = data.optics.parameters.ymag;
						let xmag = data.optics.parameters.xmag;
						const aspectRatio = data.optics.parameters.aspect_ratio;
						xmag = xmag === undefined ? ymag * aspectRatio : xmag;
						ymag = ymag === undefined ? xmag / aspectRatio : ymag;
						xmag *= 0.5;
						ymag *= 0.5;
						camera = new THREE.OrthographicCamera( - xmag, xmag, ymag, - ymag, // left, right, top, bottom
							data.optics.parameters.znear, data.optics.parameters.zfar );
						break;

					default:
						camera = new THREE.PerspectiveCamera();
						break;

				}

				camera.name = data.name || '';
				return camera;

			}

			function getCamera( id ) {

				const data = library.cameras[ id ];

				if ( data !== undefined ) {

					return getBuild( data, buildCamera );

				}

				console.warn( 'THREE.ColladaLoader: Couldn\'t find camera with ID:', id );
				return null;

			} // light


			function parseLight( xml ) {

				let data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'technique_common':
							data = parseLightTechnique( child );
							break;

					}

				}

				library.lights[ xml.getAttribute( 'id' ) ] = data;

			}

			function parseLightTechnique( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'directional':
						case 'point':
						case 'spot':
						case 'ambient':
							data.technique = child.nodeName;
							data.parameters = parseLightParameters( child );

					}

				}

				return data;

			}

			function parseLightParameters( xml ) {

				const data = {};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'color':
							const array = parseFloats( child.textContent );
							data.color = new THREE.Color().fromArray( array );
							break;

						case 'falloff_angle':
							data.falloffAngle = parseFloat( child.textContent );
							break;

						case 'quadratic_attenuation':
							const f = parseFloat( child.textContent );
							data.distance = f ? Math.sqrt( 1 / f ) : 0;
							break;

					}

				}

				return data;

			}

			function buildLight( data ) {

				let light;

				switch ( data.technique ) {

					case 'directional':
						light = new THREE.DirectionalLight();
						break;

					case 'point':
						light = new THREE.PointLight();
						break;

					case 'spot':
						light = new THREE.SpotLight();
						break;

					case 'ambient':
						light = new THREE.AmbientLight();
						break;

				}

				if ( data.parameters.color ) light.color.copy( data.parameters.color );
				if ( data.parameters.distance ) light.distance = data.parameters.distance;
				return light;

			}

			function getLight( id ) {

				const data = library.lights[ id ];

				if ( data !== undefined ) {

					return getBuild( data, buildLight );

				}

				console.warn( 'THREE.ColladaLoader: Couldn\'t find light with ID:', id );
				return null;

			} // geometry


			function parseGeometry( xml ) {

				const data = {
					name: xml.getAttribute( 'name' ),
					sources: {},
					vertices: {},
					primitives: []
				};
				const mesh = getElementsByTagName( xml, 'mesh' )[ 0 ]; // the following tags inside geometry are not supported yet (see https://github.com/mrdoob/three.js/pull/12606): convex_mesh, spline, brep

				if ( mesh === undefined ) return;

				for ( let i = 0; i < mesh.childNodes.length; i ++ ) {

					const child = mesh.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;
					const id = child.getAttribute( 'id' );

					switch ( child.nodeName ) {

						case 'source':
							data.sources[ id ] = parseSource( child );
							break;

						case 'vertices':
							// data.sources[ id ] = data.sources[ parseId( getElementsByTagName( child, 'input' )[ 0 ].getAttribute( 'source' ) ) ];
							data.vertices = parseGeometryVertices( child );
							break;

						case 'polygons':
							console.warn( 'THREE.ColladaLoader: Unsupported primitive type: ', child.nodeName );
							break;

						case 'lines':
						case 'linestrips':
						case 'polylist':
						case 'triangles':
							data.primitives.push( parseGeometryPrimitive( child ) );
							break;

						default:
							console.log( child );

					}

				}

				library.geometries[ xml.getAttribute( 'id' ) ] = data;

			}

			function parseSource( xml ) {

				const data = {
					array: [],
					stride: 3
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'float_array':
							data.array = parseFloats( child.textContent );
							break;

						case 'Name_array':
							data.array = parseStrings( child.textContent );
							break;

						case 'technique_common':
							const accessor = getElementsByTagName( child, 'accessor' )[ 0 ];

							if ( accessor !== undefined ) {

								data.stride = parseInt( accessor.getAttribute( 'stride' ) );

							}

							break;

					}

				}

				return data;

			}

			function parseGeometryVertices( xml ) {

				const data = {};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;
					data[ child.getAttribute( 'semantic' ) ] = parseId( child.getAttribute( 'source' ) );

				}

				return data;

			}

			function parseGeometryPrimitive( xml ) {

				const primitive = {
					type: xml.nodeName,
					material: xml.getAttribute( 'material' ),
					count: parseInt( xml.getAttribute( 'count' ) ),
					inputs: {},
					stride: 0,
					hasUV: false
				};

				for ( let i = 0, l = xml.childNodes.length; i < l; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'input':
							const id = parseId( child.getAttribute( 'source' ) );
							const semantic = child.getAttribute( 'semantic' );
							const offset = parseInt( child.getAttribute( 'offset' ) );
							const set = parseInt( child.getAttribute( 'set' ) );
							const inputname = set > 0 ? semantic + set : semantic;
							primitive.inputs[ inputname ] = {
								id: id,
								offset: offset
							};
							primitive.stride = Math.max( primitive.stride, offset + 1 );
							if ( semantic === 'TEXCOORD' ) primitive.hasUV = true;
							break;

						case 'vcount':
							primitive.vcount = parseInts( child.textContent );
							break;

						case 'p':
							primitive.p = parseInts( child.textContent );
							break;

					}

				}

				return primitive;

			}

			function groupPrimitives( primitives ) {

				const build = {};

				for ( let i = 0; i < primitives.length; i ++ ) {

					const primitive = primitives[ i ];
					if ( build[ primitive.type ] === undefined ) build[ primitive.type ] = [];
					build[ primitive.type ].push( primitive );

				}

				return build;

			}

			function checkUVCoordinates( primitives ) {

				let count = 0;

				for ( let i = 0, l = primitives.length; i < l; i ++ ) {

					const primitive = primitives[ i ];

					if ( primitive.hasUV === true ) {

						count ++;

					}

				}

				if ( count > 0 && count < primitives.length ) {

					primitives.uvsNeedsFix = true;

				}

			}

			function buildGeometry( data ) {

				const build = {};
				const sources = data.sources;
				const vertices = data.vertices;
				const primitives = data.primitives;
				if ( primitives.length === 0 ) return {}; // our goal is to create one buffer geometry for a single type of primitives
				// first, we group all primitives by their type

				const groupedPrimitives = groupPrimitives( primitives );

				for ( const type in groupedPrimitives ) {

					const primitiveType = groupedPrimitives[ type ]; // second, ensure consistent uv coordinates for each type of primitives (polylist,triangles or lines)

					checkUVCoordinates( primitiveType ); // third, create a buffer geometry for each type of primitives

					build[ type ] = buildGeometryType( primitiveType, sources, vertices );

				}

				return build;

			}

			function buildGeometryType( primitives, sources, vertices ) {

				const build = {};
				const position = {
					array: [],
					stride: 0
				};
				const normal = {
					array: [],
					stride: 0
				};
				const uv = {
					array: [],
					stride: 0
				};
				const uv2 = {
					array: [],
					stride: 0
				};
				const color = {
					array: [],
					stride: 0
				};
				const skinIndex = {
					array: [],
					stride: 4
				};
				const skinWeight = {
					array: [],
					stride: 4
				};
				const geometry = new THREE.BufferGeometry();
				const materialKeys = [];
				let start = 0;

				for ( let p = 0; p < primitives.length; p ++ ) {

					const primitive = primitives[ p ];
					const inputs = primitive.inputs; // groups

					let count = 0;

					switch ( primitive.type ) {

						case 'lines':
						case 'linestrips':
							count = primitive.count * 2;
							break;

						case 'triangles':
							count = primitive.count * 3;
							break;

						case 'polylist':
							for ( let g = 0; g < primitive.count; g ++ ) {

								const vc = primitive.vcount[ g ];

								switch ( vc ) {

									case 3:
										count += 3; // single triangle

										break;

									case 4:
										count += 6; // quad, subdivided into two triangles

										break;

									default:
										count += ( vc - 2 ) * 3; // polylist with more than four vertices

										break;

								}

							}

							break;

						default:
							console.warn( 'THREE.ColladaLoader: Unknow primitive type:', primitive.type );

					}

					geometry.addGroup( start, count, p );
					start += count; // material

					if ( primitive.material ) {

						materialKeys.push( primitive.material );

					} // geometry data


					for ( const name in inputs ) {

						const input = inputs[ name ];

						switch ( name ) {

							case 'VERTEX':
								for ( const key in vertices ) {

									const id = vertices[ key ];

									switch ( key ) {

										case 'POSITION':
											const prevLength = position.array.length;
											buildGeometryData( primitive, sources[ id ], input.offset, position.array );
											position.stride = sources[ id ].stride;

											if ( sources.skinWeights && sources.skinIndices ) {

												buildGeometryData( primitive, sources.skinIndices, input.offset, skinIndex.array );
												buildGeometryData( primitive, sources.skinWeights, input.offset, skinWeight.array );

											} // see #3803


											if ( primitive.hasUV === false && primitives.uvsNeedsFix === true ) {

												const count = ( position.array.length - prevLength ) / position.stride;

												for ( let i = 0; i < count; i ++ ) {

													// fill missing uv coordinates
													uv.array.push( 0, 0 );

												}

											}

											break;

										case 'NORMAL':
											buildGeometryData( primitive, sources[ id ], input.offset, normal.array );
											normal.stride = sources[ id ].stride;
											break;

										case 'COLOR':
											buildGeometryData( primitive, sources[ id ], input.offset, color.array );
											color.stride = sources[ id ].stride;
											break;

										case 'TEXCOORD':
											buildGeometryData( primitive, sources[ id ], input.offset, uv.array );
											uv.stride = sources[ id ].stride;
											break;

										case 'TEXCOORD1':
											buildGeometryData( primitive, sources[ id ], input.offset, uv2.array );
											uv.stride = sources[ id ].stride;
											break;

										default:
											console.warn( 'THREE.ColladaLoader: Semantic "%s" not handled in geometry build process.', key );

									}

								}

								break;

							case 'NORMAL':
								buildGeometryData( primitive, sources[ input.id ], input.offset, normal.array );
								normal.stride = sources[ input.id ].stride;
								break;

							case 'COLOR':
								buildGeometryData( primitive, sources[ input.id ], input.offset, color.array );
								color.stride = sources[ input.id ].stride;
								break;

							case 'TEXCOORD':
								buildGeometryData( primitive, sources[ input.id ], input.offset, uv.array );
								uv.stride = sources[ input.id ].stride;
								break;

							case 'TEXCOORD1':
								buildGeometryData( primitive, sources[ input.id ], input.offset, uv2.array );
								uv2.stride = sources[ input.id ].stride;
								break;

						}

					}

				} // build geometry


				if ( position.array.length > 0 ) geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( position.array, position.stride ) );
				if ( normal.array.length > 0 ) geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normal.array, normal.stride ) );
				if ( color.array.length > 0 ) geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( color.array, color.stride ) );
				if ( uv.array.length > 0 ) geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uv.array, uv.stride ) );
				if ( uv2.array.length > 0 ) geometry.setAttribute( 'uv2', new THREE.Float32BufferAttribute( uv2.array, uv2.stride ) );
				if ( skinIndex.array.length > 0 ) geometry.setAttribute( 'skinIndex', new THREE.Float32BufferAttribute( skinIndex.array, skinIndex.stride ) );
				if ( skinWeight.array.length > 0 ) geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeight.array, skinWeight.stride ) );
				build.data = geometry;
				build.type = primitives[ 0 ].type;
				build.materialKeys = materialKeys;
				return build;

			}

			function buildGeometryData( primitive, source, offset, array ) {

				const indices = primitive.p;
				const stride = primitive.stride;
				const vcount = primitive.vcount;

				function pushVector( i ) {

					let index = indices[ i + offset ] * sourceStride;
					const length = index + sourceStride;

					for ( ; index < length; index ++ ) {

						array.push( sourceArray[ index ] );

					}

				}

				const sourceArray = source.array;
				const sourceStride = source.stride;

				if ( primitive.vcount !== undefined ) {

					let index = 0;

					for ( let i = 0, l = vcount.length; i < l; i ++ ) {

						const count = vcount[ i ];

						if ( count === 4 ) {

							const a = index + stride * 0;
							const b = index + stride * 1;
							const c = index + stride * 2;
							const d = index + stride * 3;
							pushVector( a );
							pushVector( b );
							pushVector( d );
							pushVector( b );
							pushVector( c );
							pushVector( d );

						} else if ( count === 3 ) {

							const a = index + stride * 0;
							const b = index + stride * 1;
							const c = index + stride * 2;
							pushVector( a );
							pushVector( b );
							pushVector( c );

						} else if ( count > 4 ) {

							for ( let k = 1, kl = count - 2; k <= kl; k ++ ) {

								const a = index + stride * 0;
								const b = index + stride * k;
								const c = index + stride * ( k + 1 );
								pushVector( a );
								pushVector( b );
								pushVector( c );

							}

						}

						index += stride * count;

					}

				} else {

					for ( let i = 0, l = indices.length; i < l; i += stride ) {

						pushVector( i );

					}

				}

			}

			function getGeometry( id ) {

				return getBuild( library.geometries[ id ], buildGeometry );

			} // kinematics


			function parseKinematicsModel( xml ) {

				const data = {
					name: xml.getAttribute( 'name' ) || '',
					joints: {},
					links: []
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'technique_common':
							parseKinematicsTechniqueCommon( child, data );
							break;

					}

				}

				library.kinematicsModels[ xml.getAttribute( 'id' ) ] = data;

			}

			function buildKinematicsModel( data ) {

				if ( data.build !== undefined ) return data.build;
				return data;

			}

			function getKinematicsModel( id ) {

				return getBuild( library.kinematicsModels[ id ], buildKinematicsModel );

			}

			function parseKinematicsTechniqueCommon( xml, data ) {

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'joint':
							data.joints[ child.getAttribute( 'sid' ) ] = parseKinematicsJoint( child );
							break;

						case 'link':
							data.links.push( parseKinematicsLink( child ) );
							break;

					}

				}

			}

			function parseKinematicsJoint( xml ) {

				let data;

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'prismatic':
						case 'revolute':
							data = parseKinematicsJointParameter( child );
							break;

					}

				}

				return data;

			}

			function parseKinematicsJointParameter( xml ) {

				const data = {
					sid: xml.getAttribute( 'sid' ),
					name: xml.getAttribute( 'name' ) || '',
					axis: new THREE.Vector3(),
					limits: {
						min: 0,
						max: 0
					},
					type: xml.nodeName,
					static: false,
					zeroPosition: 0,
					middlePosition: 0
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'axis':
							const array = parseFloats( child.textContent );
							data.axis.fromArray( array );
							break;

						case 'limits':
							const max = child.getElementsByTagName( 'max' )[ 0 ];
							const min = child.getElementsByTagName( 'min' )[ 0 ];
							data.limits.max = parseFloat( max.textContent );
							data.limits.min = parseFloat( min.textContent );
							break;

					}

				} // if min is equal to or greater than max, consider the joint static


				if ( data.limits.min >= data.limits.max ) {

					data.static = true;

				} // calculate middle position


				data.middlePosition = ( data.limits.min + data.limits.max ) / 2.0;
				return data;

			}

			function parseKinematicsLink( xml ) {

				const data = {
					sid: xml.getAttribute( 'sid' ),
					name: xml.getAttribute( 'name' ) || '',
					attachments: [],
					transforms: []
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'attachment_full':
							data.attachments.push( parseKinematicsAttachment( child ) );
							break;

						case 'matrix':
						case 'translate':
						case 'rotate':
							data.transforms.push( parseKinematicsTransform( child ) );
							break;

					}

				}

				return data;

			}

			function parseKinematicsAttachment( xml ) {

				const data = {
					joint: xml.getAttribute( 'joint' ).split( '/' ).pop(),
					transforms: [],
					links: []
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'link':
							data.links.push( parseKinematicsLink( child ) );
							break;

						case 'matrix':
						case 'translate':
						case 'rotate':
							data.transforms.push( parseKinematicsTransform( child ) );
							break;

					}

				}

				return data;

			}

			function parseKinematicsTransform( xml ) {

				const data = {
					type: xml.nodeName
				};
				const array = parseFloats( xml.textContent );

				switch ( data.type ) {

					case 'matrix':
						data.obj = new THREE.Matrix4();
						data.obj.fromArray( array ).transpose();
						break;

					case 'translate':
						data.obj = new THREE.Vector3();
						data.obj.fromArray( array );
						break;

					case 'rotate':
						data.obj = new THREE.Vector3();
						data.obj.fromArray( array );
						data.angle = THREE.MathUtils.degToRad( array[ 3 ] );
						break;

				}

				return data;

			} // physics


			function parsePhysicsModel( xml ) {

				const data = {
					name: xml.getAttribute( 'name' ) || '',
					rigidBodies: {}
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'rigid_body':
							data.rigidBodies[ child.getAttribute( 'name' ) ] = {};
							parsePhysicsRigidBody( child, data.rigidBodies[ child.getAttribute( 'name' ) ] );
							break;

					}

				}

				library.physicsModels[ xml.getAttribute( 'id' ) ] = data;

			}

			function parsePhysicsRigidBody( xml, data ) {

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'technique_common':
							parsePhysicsTechniqueCommon( child, data );
							break;

					}

				}

			}

			function parsePhysicsTechniqueCommon( xml, data ) {

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'inertia':
							data.inertia = parseFloats( child.textContent );
							break;

						case 'mass':
							data.mass = parseFloats( child.textContent )[ 0 ];
							break;

					}

				}

			} // scene


			function parseKinematicsScene( xml ) {

				const data = {
					bindJointAxis: []
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'bind_joint_axis':
							data.bindJointAxis.push( parseKinematicsBindJointAxis( child ) );
							break;

					}

				}

				library.kinematicsScenes[ parseId( xml.getAttribute( 'url' ) ) ] = data;

			}

			function parseKinematicsBindJointAxis( xml ) {

				const data = {
					target: xml.getAttribute( 'target' ).split( '/' ).pop()
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;

					switch ( child.nodeName ) {

						case 'axis':
							const param = child.getElementsByTagName( 'param' )[ 0 ];
							data.axis = param.textContent;
							const tmpJointIndex = data.axis.split( 'inst_' ).pop().split( 'axis' )[ 0 ];
							data.jointIndex = tmpJointIndex.substr( 0, tmpJointIndex.length - 1 );
							break;

					}

				}

				return data;

			}

			function buildKinematicsScene( data ) {

				if ( data.build !== undefined ) return data.build;
				return data;

			}

			function getKinematicsScene( id ) {

				return getBuild( library.kinematicsScenes[ id ], buildKinematicsScene );

			}

			function setupKinematics() {

				const kinematicsModelId = Object.keys( library.kinematicsModels )[ 0 ];
				const kinematicsSceneId = Object.keys( library.kinematicsScenes )[ 0 ];
				const visualSceneId = Object.keys( library.visualScenes )[ 0 ];
				if ( kinematicsModelId === undefined || kinematicsSceneId === undefined ) return;
				const kinematicsModel = getKinematicsModel( kinematicsModelId );
				const kinematicsScene = getKinematicsScene( kinematicsSceneId );
				const visualScene = getVisualScene( visualSceneId );
				const bindJointAxis = kinematicsScene.bindJointAxis;
				const jointMap = {};

				for ( let i = 0, l = bindJointAxis.length; i < l; i ++ ) {

					const axis = bindJointAxis[ i ]; // the result of the following query is an element of type 'translate', 'rotate','scale' or 'matrix'

					const targetElement = collada.querySelector( '[sid="' + axis.target + '"]' );

					if ( targetElement ) {

						// get the parent of the transform element
						const parentVisualElement = targetElement.parentElement; // connect the joint of the kinematics model with the element in the visual scene

						connect( axis.jointIndex, parentVisualElement );

					}

				}

				function connect( jointIndex, visualElement ) {

					const visualElementName = visualElement.getAttribute( 'name' );
					const joint = kinematicsModel.joints[ jointIndex ];
					visualScene.traverse( function ( object ) {

						if ( object.name === visualElementName ) {

							jointMap[ jointIndex ] = {
								object: object,
								transforms: buildTransformList( visualElement ),
								joint: joint,
								position: joint.zeroPosition
							};

						}

					} );

				}

				const m0 = new THREE.Matrix4();
				kinematics = {
					joints: kinematicsModel && kinematicsModel.joints,
					getJointValue: function ( jointIndex ) {

						const jointData = jointMap[ jointIndex ];

						if ( jointData ) {

							return jointData.position;

						} else {

							console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' doesn\'t exist.' );

						}

					},
					setJointValue: function ( jointIndex, value ) {

						const jointData = jointMap[ jointIndex ];

						if ( jointData ) {

							const joint = jointData.joint;

							if ( value > joint.limits.max || value < joint.limits.min ) {

								console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' value ' + value + ' outside of limits (min: ' + joint.limits.min + ', max: ' + joint.limits.max + ').' );

							} else if ( joint.static ) {

								console.warn( 'THREE.ColladaLoader: Joint ' + jointIndex + ' is static.' );

							} else {

								const object = jointData.object;
								const axis = joint.axis;
								const transforms = jointData.transforms;
								matrix.identity(); // each update, we have to apply all transforms in the correct order

								for ( let i = 0; i < transforms.length; i ++ ) {

									const transform = transforms[ i ]; // if there is a connection of the transform node with a joint, apply the joint value

									if ( transform.sid && transform.sid.indexOf( jointIndex ) !== - 1 ) {

										switch ( joint.type ) {

											case 'revolute':
												matrix.multiply( m0.makeRotationAxis( axis, THREE.MathUtils.degToRad( value ) ) );
												break;

											case 'prismatic':
												matrix.multiply( m0.makeTranslation( axis.x * value, axis.y * value, axis.z * value ) );
												break;

											default:
												console.warn( 'THREE.ColladaLoader: Unknown joint type: ' + joint.type );
												break;

										}

									} else {

										switch ( transform.type ) {

											case 'matrix':
												matrix.multiply( transform.obj );
												break;

											case 'translate':
												matrix.multiply( m0.makeTranslation( transform.obj.x, transform.obj.y, transform.obj.z ) );
												break;

											case 'scale':
												matrix.scale( transform.obj );
												break;

											case 'rotate':
												matrix.multiply( m0.makeRotationAxis( transform.obj, transform.angle ) );
												break;

										}

									}

								}

								object.matrix.copy( matrix );
								object.matrix.decompose( object.position, object.quaternion, object.scale );
								jointMap[ jointIndex ].position = value;

							}

						} else {

							console.log( 'THREE.ColladaLoader: ' + jointIndex + ' does not exist.' );

						}

					}
				};

			}

			function buildTransformList( node ) {

				const transforms = [];
				const xml = collada.querySelector( '[id="' + node.id + '"]' );

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;
					let array, vector;

					switch ( child.nodeName ) {

						case 'matrix':
							array = parseFloats( child.textContent );
							const matrix = new THREE.Matrix4().fromArray( array ).transpose();
							transforms.push( {
								sid: child.getAttribute( 'sid' ),
								type: child.nodeName,
								obj: matrix
							} );
							break;

						case 'translate':
						case 'scale':
							array = parseFloats( child.textContent );
							vector = new THREE.Vector3().fromArray( array );
							transforms.push( {
								sid: child.getAttribute( 'sid' ),
								type: child.nodeName,
								obj: vector
							} );
							break;

						case 'rotate':
							array = parseFloats( child.textContent );
							vector = new THREE.Vector3().fromArray( array );
							const angle = THREE.MathUtils.degToRad( array[ 3 ] );
							transforms.push( {
								sid: child.getAttribute( 'sid' ),
								type: child.nodeName,
								obj: vector,
								angle: angle
							} );
							break;

					}

				}

				return transforms;

			} // nodes


			function prepareNodes( xml ) {

				const elements = xml.getElementsByTagName( 'node' ); // ensure all node elements have id attributes

				for ( let i = 0; i < elements.length; i ++ ) {

					const element = elements[ i ];

					if ( element.hasAttribute( 'id' ) === false ) {

						element.setAttribute( 'id', generateId() );

					}

				}

			}

			const matrix = new THREE.Matrix4();
			const vector = new THREE.Vector3();

			function parseNode( xml ) {

				const data = {
					name: xml.getAttribute( 'name' ) || '',
					type: xml.getAttribute( 'type' ),
					id: xml.getAttribute( 'id' ),
					sid: xml.getAttribute( 'sid' ),
					matrix: new THREE.Matrix4(),
					nodes: [],
					instanceCameras: [],
					instanceControllers: [],
					instanceLights: [],
					instanceGeometries: [],
					instanceNodes: [],
					transforms: {}
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];
					if ( child.nodeType !== 1 ) continue;
					let array;

					switch ( child.nodeName ) {

						case 'node':
							data.nodes.push( child.getAttribute( 'id' ) );
							parseNode( child );
							break;

						case 'instance_camera':
							data.instanceCameras.push( parseId( child.getAttribute( 'url' ) ) );
							break;

						case 'instance_controller':
							data.instanceControllers.push( parseNodeInstance( child ) );
							break;

						case 'instance_light':
							data.instanceLights.push( parseId( child.getAttribute( 'url' ) ) );
							break;

						case 'instance_geometry':
							data.instanceGeometries.push( parseNodeInstance( child ) );
							break;

						case 'instance_node':
							data.instanceNodes.push( parseId( child.getAttribute( 'url' ) ) );
							break;

						case 'matrix':
							array = parseFloats( child.textContent );
							data.matrix.multiply( matrix.fromArray( array ).transpose() );
							data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
							break;

						case 'translate':
							array = parseFloats( child.textContent );
							vector.fromArray( array );
							data.matrix.multiply( matrix.makeTranslation( vector.x, vector.y, vector.z ) );
							data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
							break;

						case 'rotate':
							array = parseFloats( child.textContent );
							const angle = THREE.MathUtils.degToRad( array[ 3 ] );
							data.matrix.multiply( matrix.makeRotationAxis( vector.fromArray( array ), angle ) );
							data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
							break;

						case 'scale':
							array = parseFloats( child.textContent );
							data.matrix.scale( vector.fromArray( array ) );
							data.transforms[ child.getAttribute( 'sid' ) ] = child.nodeName;
							break;

						case 'extra':
							break;

						default:
							console.log( child );

					}

				}

				if ( hasNode( data.id ) ) {

					console.warn( 'THREE.ColladaLoader: There is already a node with ID %s. Exclude current node from further processing.', data.id );

				} else {

					library.nodes[ data.id ] = data;

				}

				return data;

			}

			function parseNodeInstance( xml ) {

				const data = {
					id: parseId( xml.getAttribute( 'url' ) ),
					materials: {},
					skeletons: []
				};

				for ( let i = 0; i < xml.childNodes.length; i ++ ) {

					const child = xml.childNodes[ i ];

					switch ( child.nodeName ) {

						case 'bind_material':
							const instances = child.getElementsByTagName( 'instance_material' );

							for ( let j = 0; j < instances.length; j ++ ) {

								const instance = instances[ j ];
								const symbol = instance.getAttribute( 'symbol' );
								const target = instance.getAttribute( 'target' );
								data.materials[ symbol ] = parseId( target );

							}

							break;

						case 'skeleton':
							data.skeletons.push( parseId( child.textContent ) );
							break;

						default:
							break;

					}

				}

				return data;

			}

			function buildSkeleton( skeletons, joints ) {

				const boneData = [];
				const sortedBoneData = [];
				let i, j, data; // a skeleton can have multiple root bones. collada expresses this
				// situtation with multiple "skeleton" tags per controller instance

				for ( i = 0; i < skeletons.length; i ++ ) {

					const skeleton = skeletons[ i ];
					let root;

					if ( hasNode( skeleton ) ) {

						root = getNode( skeleton );
						buildBoneHierarchy( root, joints, boneData );

					} else if ( hasVisualScene( skeleton ) ) {

						// handle case where the skeleton refers to the visual scene (#13335)
						const visualScene = library.visualScenes[ skeleton ];
						const children = visualScene.children;

						for ( let j = 0; j < children.length; j ++ ) {

							const child = children[ j ];

							if ( child.type === 'JOINT' ) {

								const root = getNode( child.id );
								buildBoneHierarchy( root, joints, boneData );

							}

						}

					} else {

						console.error( 'THREE.ColladaLoader: Unable to find root bone of skeleton with ID:', skeleton );

					}

				} // sort bone data (the order is defined in the corresponding controller)


				for ( i = 0; i < joints.length; i ++ ) {

					for ( j = 0; j < boneData.length; j ++ ) {

						data = boneData[ j ];

						if ( data.bone.name === joints[ i ].name ) {

							sortedBoneData[ i ] = data;
							data.processed = true;
							break;

						}

					}

				} // add unprocessed bone data at the end of the list


				for ( i = 0; i < boneData.length; i ++ ) {

					data = boneData[ i ];

					if ( data.processed === false ) {

						sortedBoneData.push( data );
						data.processed = true;

					}

				} // setup arrays for skeleton creation


				const bones = [];
				const boneInverses = [];

				for ( i = 0; i < sortedBoneData.length; i ++ ) {

					data = sortedBoneData[ i ];
					bones.push( data.bone );
					boneInverses.push( data.boneInverse );

				}

				return new THREE.Skeleton( bones, boneInverses );

			}

			function buildBoneHierarchy( root, joints, boneData ) {

				// setup bone data from visual scene
				root.traverse( function ( object ) {

					if ( object.isBone === true ) {

						let boneInverse; // retrieve the boneInverse from the controller data

						for ( let i = 0; i < joints.length; i ++ ) {

							const joint = joints[ i ];

							if ( joint.name === object.name ) {

								boneInverse = joint.boneInverse;
								break;

							}

						}

						if ( boneInverse === undefined ) {

							// Unfortunately, there can be joints in the visual scene that are not part of the
							// corresponding controller. In this case, we have to create a dummy boneInverse matrix
							// for the respective bone. This bone won't affect any vertices, because there are no skin indices
							// and weights defined for it. But we still have to add the bone to the sorted bone list in order to
							// ensure a correct animation of the model.
							boneInverse = new THREE.Matrix4();

						}

						boneData.push( {
							bone: object,
							boneInverse: boneInverse,
							processed: false
						} );

					}

				} );

			}

			function buildNode( data ) {

				const objects = [];
				const matrix = data.matrix;
				const nodes = data.nodes;
				const type = data.type;
				const instanceCameras = data.instanceCameras;
				const instanceControllers = data.instanceControllers;
				const instanceLights = data.instanceLights;
				const instanceGeometries = data.instanceGeometries;
				const instanceNodes = data.instanceNodes; // nodes

				for ( let i = 0, l = nodes.length; i < l; i ++ ) {

					objects.push( getNode( nodes[ i ] ) );

				} // instance cameras


				for ( let i = 0, l = instanceCameras.length; i < l; i ++ ) {

					const instanceCamera = getCamera( instanceCameras[ i ] );

					if ( instanceCamera !== null ) {

						objects.push( instanceCamera.clone() );

					}

				} // instance controllers


				for ( let i = 0, l = instanceControllers.length; i < l; i ++ ) {

					const instance = instanceControllers[ i ];
					const controller = getController( instance.id );
					const geometries = getGeometry( controller.id );
					const newObjects = buildObjects( geometries, instance.materials );
					const skeletons = instance.skeletons;
					const joints = controller.skin.joints;
					const skeleton = buildSkeleton( skeletons, joints );

					for ( let j = 0, jl = newObjects.length; j < jl; j ++ ) {

						const object = newObjects[ j ];

						if ( object.isSkinnedMesh ) {

							object.bind( skeleton, controller.skin.bindMatrix );
							object.normalizeSkinWeights();

						}

						objects.push( object );

					}

				} // instance lights


				for ( let i = 0, l = instanceLights.length; i < l; i ++ ) {

					const instanceLight = getLight( instanceLights[ i ] );

					if ( instanceLight !== null ) {

						objects.push( instanceLight.clone() );

					}

				} // instance geometries


				for ( let i = 0, l = instanceGeometries.length; i < l; i ++ ) {

					const instance = instanceGeometries[ i ]; // a single geometry instance in collada can lead to multiple object3Ds.
					// this is the case when primitives are combined like triangles and lines

					const geometries = getGeometry( instance.id );
					const newObjects = buildObjects( geometries, instance.materials );

					for ( let j = 0, jl = newObjects.length; j < jl; j ++ ) {

						objects.push( newObjects[ j ] );

					}

				} // instance nodes


				for ( let i = 0, l = instanceNodes.length; i < l; i ++ ) {

					objects.push( getNode( instanceNodes[ i ] ).clone() );

				}

				let object;

				if ( nodes.length === 0 && objects.length === 1 ) {

					object = objects[ 0 ];

				} else {

					object = type === 'JOINT' ? new THREE.Bone() : new THREE.Group();

					for ( let i = 0; i < objects.length; i ++ ) {

						object.add( objects[ i ] );

					}

				}

				object.name = type === 'JOINT' ? data.sid : data.name;
				object.matrix.copy( matrix );
				object.matrix.decompose( object.position, object.quaternion, object.scale );
				return object;

			}

			const fallbackMaterial = new THREE.MeshBasicMaterial( {
				color: 0xff00ff
			} );

			function resolveMaterialBinding( keys, instanceMaterials ) {

				const materials = [];

				for ( let i = 0, l = keys.length; i < l; i ++ ) {

					const id = instanceMaterials[ keys[ i ] ];

					if ( id === undefined ) {

						console.warn( 'THREE.ColladaLoader: Material with key %s not found. Apply fallback material.', keys[ i ] );
						materials.push( fallbackMaterial );

					} else {

						materials.push( getMaterial( id ) );

					}

				}

				return materials;

			}

			function buildObjects( geometries, instanceMaterials ) {

				const objects = [];

				for ( const type in geometries ) {

					const geometry = geometries[ type ];
					const materials = resolveMaterialBinding( geometry.materialKeys, instanceMaterials ); // handle case if no materials are defined

					if ( materials.length === 0 ) {

						if ( type === 'lines' || type === 'linestrips' ) {

							materials.push( new THREE.LineBasicMaterial() );

						} else {

							materials.push( new THREE.MeshPhongMaterial() );

						}

					} // regard skinning


					const skinning = geometry.data.attributes.skinIndex !== undefined; // choose between a single or multi materials (material array)

					const material = materials.length === 1 ? materials[ 0 ] : materials; // now create a specific 3D object

					let object;

					switch ( type ) {

						case 'lines':
							object = new THREE.LineSegments( geometry.data, material );
							break;

						case 'linestrips':
							object = new THREE.Line( geometry.data, material );
							break;

						case 'triangles':
						case 'polylist':
							if ( skinning ) {

								object = new THREE.SkinnedMesh( geometry.data, material );

							} else {

								object = new THREE.Mesh( geometry.data, material );

							}

							break;

					}

					objects.push( object );

				}

				return objects;

			}

			function hasNode( id ) {

				return library.nodes[ id ] !== undefined;

			}

			function getNode( id ) {

				return getBuild( library.nodes[ id ], buildNode );

			} // visual scenes


			function parseVisualScene( xml ) {

				const data = {
					name: xml.getAttribute( 'name' ),
					children: []
				};
				prepareNodes( xml );
				const elements = getElementsByTagName( xml, 'node' );

				for ( let i = 0; i < elements.length; i ++ ) {

					data.children.push( parseNode( elements[ i ] ) );

				}

				library.visualScenes[ xml.getAttribute( 'id' ) ] = data;

			}

			function buildVisualScene( data ) {

				const group = new THREE.Group();
				group.name = data.name;
				const children = data.children;

				for ( let i = 0; i < children.length; i ++ ) {

					const child = children[ i ];
					group.add( getNode( child.id ) );

				}

				return group;

			}

			function hasVisualScene( id ) {

				return library.visualScenes[ id ] !== undefined;

			}

			function getVisualScene( id ) {

				return getBuild( library.visualScenes[ id ], buildVisualScene );

			} // scenes


			function parseScene( xml ) {

				const instance = getElementsByTagName( xml, 'instance_visual_scene' )[ 0 ];
				return getVisualScene( parseId( instance.getAttribute( 'url' ) ) );

			}

			function setupAnimations() {

				const clips = library.clips;

				if ( isEmpty( clips ) === true ) {

					if ( isEmpty( library.animations ) === false ) {

						// if there are animations but no clips, we create a default clip for playback
						const tracks = [];

						for ( const id in library.animations ) {

							const animationTracks = getAnimation( id );

							for ( let i = 0, l = animationTracks.length; i < l; i ++ ) {

								tracks.push( animationTracks[ i ] );

							}

						}

						animations.push( new THREE.AnimationClip( 'default', - 1, tracks ) );

					}

				} else {

					for ( const id in clips ) {

						animations.push( getAnimationClip( id ) );

					}

				}

			} // convert the parser error element into text with each child elements text
			// separated by new lines.


			function parserErrorToText( parserError ) {

				let result = '';
				const stack = [ parserError ];

				while ( stack.length ) {

					const node = stack.shift();

					if ( node.nodeType === Node.TEXT_NODE ) {

						result += node.textContent;

					} else {

						result += '\n';
						stack.push.apply( stack, node.childNodes );

					}

				}

				return result.trim();

			}

			if ( text.length === 0 ) {

				return {
					scene: new THREE.Scene()
				};

			}

			const xml = new DOMParser().parseFromString( text, 'application/xml' );
			const collada = getElementsByTagName( xml, 'COLLADA' )[ 0 ];
			const parserError = xml.getElementsByTagName( 'parsererror' )[ 0 ];

			if ( parserError !== undefined ) {

				// Chrome will return parser error with a div in it
				const errorElement = getElementsByTagName( parserError, 'div' )[ 0 ];
				let errorText;

				if ( errorElement ) {

					errorText = errorElement.textContent;

				} else {

					errorText = parserErrorToText( parserError );

				}

				console.error( 'THREE.ColladaLoader: Failed to parse collada file.\n', errorText );
				return null;

			} // metadata


			const version = collada.getAttribute( 'version' );
			console.log( 'THREE.ColladaLoader: File version', version );
			const asset = parseAsset( getElementsByTagName( collada, 'asset' )[ 0 ] );
			const textureLoader = new THREE.TextureLoader( this.manager );
			textureLoader.setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
			let tgaLoader;

			if ( THREE.TGALoader ) {

				tgaLoader = new THREE.TGALoader( this.manager );
				tgaLoader.setPath( this.resourcePath || path );

			} //


			const animations = [];
			let kinematics = {};
			let count = 0; //

			const library = {
				animations: {},
				clips: {},
				controllers: {},
				images: {},
				effects: {},
				materials: {},
				cameras: {},
				lights: {},
				geometries: {},
				nodes: {},
				visualScenes: {},
				kinematicsModels: {},
				physicsModels: {},
				kinematicsScenes: {}
			};
			parseLibrary( collada, 'library_animations', 'animation', parseAnimation );
			parseLibrary( collada, 'library_animation_clips', 'animation_clip', parseAnimationClip );
			parseLibrary( collada, 'library_controllers', 'controller', parseController );
			parseLibrary( collada, 'library_images', 'image', parseImage );
			parseLibrary( collada, 'library_effects', 'effect', parseEffect );
			parseLibrary( collada, 'library_materials', 'material', parseMaterial );
			parseLibrary( collada, 'library_cameras', 'camera', parseCamera );
			parseLibrary( collada, 'library_lights', 'light', parseLight );
			parseLibrary( collada, 'library_geometries', 'geometry', parseGeometry );
			parseLibrary( collada, 'library_nodes', 'node', parseNode );
			parseLibrary( collada, 'library_visual_scenes', 'visual_scene', parseVisualScene );
			parseLibrary( collada, 'library_kinematics_models', 'kinematics_model', parseKinematicsModel );
			parseLibrary( collada, 'library_physics_models', 'physics_model', parsePhysicsModel );
			parseLibrary( collada, 'scene', 'instance_kinematics_scene', parseKinematicsScene );
			buildLibrary( library.animations, buildAnimation );
			buildLibrary( library.clips, buildAnimationClip );
			buildLibrary( library.controllers, buildController );
			buildLibrary( library.images, buildImage );
			buildLibrary( library.effects, buildEffect );
			buildLibrary( library.materials, buildMaterial );
			buildLibrary( library.cameras, buildCamera );
			buildLibrary( library.lights, buildLight );
			buildLibrary( library.geometries, buildGeometry );
			buildLibrary( library.visualScenes, buildVisualScene );
			setupAnimations();
			setupKinematics();
			const scene = parseScene( getElementsByTagName( collada, 'scene' )[ 0 ] );
			scene.animations = animations;

			if ( asset.upAxis === 'Z_UP' ) {

				scene.quaternion.setFromEuler( new THREE.Euler( - Math.PI / 2, 0, 0 ) );

			}

			scene.scale.multiplyScalar( asset.unit );
			return {
				get animations() {

					console.warn( 'THREE.ColladaLoader: Please access animations over scene.animations now.' );
					return animations;

				},

				kinematics: kinematics,
				library: library,
				scene: scene
			};

		}

	}

	THREE.ColladaLoader = ColladaLoader;

} )();
( function () {

	/**
 * THREE.Loader loads FBX file and generates THREE.Group representing FBX scene.
 * Requires FBX file to be >= 7.0 and in ASCII or >= 6400 in Binary format
 * Versions lower than this may load but will probably have errors
 *
 * Needs Support:
 *  Morph normals / blend shape normals
 *
 * FBX format references:
 * 	https://wiki.blender.org/index.php/User:Mont29/Foundation/FBX_File_Structure
 * 	http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_index_html (C++ SDK reference)
 *
 * 	Binary format specification:
 *		https://code.blender.org/2013/08/fbx-binary-file-format-specification/
 */

	let fbxTree;
	let connections;
	let sceneGraph;

	class FBXLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = scope.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : scope.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( scope.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( scope.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( buffer ) {

				try {

					onLoad( scope.parse( buffer, path ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( FBXBuffer, path ) {

			if ( isFbxFormatBinary( FBXBuffer ) ) {

				fbxTree = new BinaryParser().parse( FBXBuffer );

			} else {

				const FBXText = convertArrayBufferToString( FBXBuffer );

				if ( ! isFbxFormatASCII( FBXText ) ) {

					throw new Error( 'THREE.FBXLoader: Unknown format.' );

				}

				if ( getFbxVersion( FBXText ) < 7000 ) {

					throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + getFbxVersion( FBXText ) );

				}

				fbxTree = new TextParser().parse( FBXText );

			} // console.log( fbxTree );


			const textureLoader = new THREE.TextureLoader( this.manager ).setPath( this.resourcePath || path ).setCrossOrigin( this.crossOrigin );
			return new FBXTreeParser( textureLoader, this.manager ).parse( fbxTree );

		}

	} // Parse the FBXTree object returned by the BinaryParser or TextParser and return a THREE.Group


	class FBXTreeParser {

		constructor( textureLoader, manager ) {

			this.textureLoader = textureLoader;
			this.manager = manager;

		}

		parse() {

			connections = this.parseConnections();
			const images = this.parseImages();
			const textures = this.parseTextures( images );
			const materials = this.parseMaterials( textures );
			const deformers = this.parseDeformers();
			const geometryMap = new GeometryParser().parse( deformers );
			this.parseScene( deformers, geometryMap, materials );
			return sceneGraph;

		} // Parses FBXTree.Connections which holds parent-child connections between objects (e.g. material -> texture, model->geometry )
		// and details the connection type


		parseConnections() {

			const connectionMap = new Map();

			if ( 'Connections' in fbxTree ) {

				const rawConnections = fbxTree.Connections.connections;
				rawConnections.forEach( function ( rawConnection ) {

					const fromID = rawConnection[ 0 ];
					const toID = rawConnection[ 1 ];
					const relationship = rawConnection[ 2 ];

					if ( ! connectionMap.has( fromID ) ) {

						connectionMap.set( fromID, {
							parents: [],
							children: []
						} );

					}

					const parentRelationship = {
						ID: toID,
						relationship: relationship
					};
					connectionMap.get( fromID ).parents.push( parentRelationship );

					if ( ! connectionMap.has( toID ) ) {

						connectionMap.set( toID, {
							parents: [],
							children: []
						} );

					}

					const childRelationship = {
						ID: fromID,
						relationship: relationship
					};
					connectionMap.get( toID ).children.push( childRelationship );

				} );

			}

			return connectionMap;

		} // Parse FBXTree.Objects.Video for embedded image data
		// These images are connected to textures in FBXTree.Objects.Textures
		// via FBXTree.Connections.


		parseImages() {

			const images = {};
			const blobs = {};

			if ( 'Video' in fbxTree.Objects ) {

				const videoNodes = fbxTree.Objects.Video;

				for ( const nodeID in videoNodes ) {

					const videoNode = videoNodes[ nodeID ];
					const id = parseInt( nodeID );
					images[ id ] = videoNode.RelativeFilename || videoNode.Filename; // raw image data is in videoNode.Content

					if ( 'Content' in videoNode ) {

						const arrayBufferContent = videoNode.Content instanceof ArrayBuffer && videoNode.Content.byteLength > 0;
						const base64Content = typeof videoNode.Content === 'string' && videoNode.Content !== '';

						if ( arrayBufferContent || base64Content ) {

							const image = this.parseImage( videoNodes[ nodeID ] );
							blobs[ videoNode.RelativeFilename || videoNode.Filename ] = image;

						}

					}

				}

			}

			for ( const id in images ) {

				const filename = images[ id ];
				if ( blobs[ filename ] !== undefined ) images[ id ] = blobs[ filename ]; else images[ id ] = images[ id ].split( '\\' ).pop();

			}

			return images;

		} // Parse embedded image data in FBXTree.Video.Content


		parseImage( videoNode ) {

			const content = videoNode.Content;
			const fileName = videoNode.RelativeFilename || videoNode.Filename;
			const extension = fileName.slice( fileName.lastIndexOf( '.' ) + 1 ).toLowerCase();
			let type;

			switch ( extension ) {

				case 'bmp':
					type = 'image/bmp';
					break;

				case 'jpg':
				case 'jpeg':
					type = 'image/jpeg';
					break;

				case 'png':
					type = 'image/png';
					break;

				case 'tif':
					type = 'image/tiff';
					break;

				case 'tga':
					if ( this.manager.getHandler( '.tga' ) === null ) {

						console.warn( 'FBXLoader: TGA loader not found, skipping ', fileName );

					}

					type = 'image/tga';
					break;

				default:
					console.warn( 'FBXLoader: Image type "' + extension + '" is not supported.' );
					return;

			}

			if ( typeof content === 'string' ) {

				// ASCII format
				return 'data:' + type + ';base64,' + content;

			} else {

				// Binary Format
				const array = new Uint8Array( content );
				return URL.createObjectURL( new Blob( [ array ], {
					type: type
				} ) );

			}

		} // Parse nodes in FBXTree.Objects.Texture
		// These contain details such as UV scaling, cropping, rotation etc and are connected
		// to images in FBXTree.Objects.Video


		parseTextures( images ) {

			const textureMap = new Map();

			if ( 'Texture' in fbxTree.Objects ) {

				const textureNodes = fbxTree.Objects.Texture;

				for ( const nodeID in textureNodes ) {

					const texture = this.parseTexture( textureNodes[ nodeID ], images );
					textureMap.set( parseInt( nodeID ), texture );

				}

			}

			return textureMap;

		} // Parse individual node in FBXTree.Objects.Texture


		parseTexture( textureNode, images ) {

			const texture = this.loadTexture( textureNode, images );
			texture.ID = textureNode.id;
			texture.name = textureNode.attrName;
			const wrapModeU = textureNode.WrapModeU;
			const wrapModeV = textureNode.WrapModeV;
			const valueU = wrapModeU !== undefined ? wrapModeU.value : 0;
			const valueV = wrapModeV !== undefined ? wrapModeV.value : 0; // http://download.autodesk.com/us/fbx/SDKdocs/FBX_SDK_Help/files/fbxsdkref/class_k_fbx_texture.html#889640e63e2e681259ea81061b85143a
			// 0: repeat(default), 1: clamp

			texture.wrapS = valueU === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
			texture.wrapT = valueV === 0 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

			if ( 'Scaling' in textureNode ) {

				const values = textureNode.Scaling.value;
				texture.repeat.x = values[ 0 ];
				texture.repeat.y = values[ 1 ];

			}

			return texture;

		} // load a texture specified as a blob or data URI, or via an external URL using THREE.TextureLoader


		loadTexture( textureNode, images ) {

			let fileName;
			const currentPath = this.textureLoader.path;
			const children = connections.get( textureNode.id ).children;

			if ( children !== undefined && children.length > 0 && images[ children[ 0 ].ID ] !== undefined ) {

				fileName = images[ children[ 0 ].ID ];

				if ( fileName.indexOf( 'blob:' ) === 0 || fileName.indexOf( 'data:' ) === 0 ) {

					this.textureLoader.setPath( undefined );

				}

			}

			let texture;
			const extension = textureNode.FileName.slice( - 3 ).toLowerCase();

			if ( extension === 'tga' ) {

				const loader = this.manager.getHandler( '.tga' );

				if ( loader === null ) {

					console.warn( 'FBXLoader: TGA loader not found, creating placeholder texture for', textureNode.RelativeFilename );
					texture = new THREE.Texture();

				} else {

					loader.setPath( this.textureLoader.path );
					texture = loader.load( fileName );

				}

			} else if ( extension === 'psd' ) {

				console.warn( 'FBXLoader: PSD textures are not supported, creating placeholder texture for', textureNode.RelativeFilename );
				texture = new THREE.Texture();

			} else {

				texture = this.textureLoader.load( fileName );

			}

			this.textureLoader.setPath( currentPath );
			return texture;

		} // Parse nodes in FBXTree.Objects.Material


		parseMaterials( textureMap ) {

			const materialMap = new Map();

			if ( 'Material' in fbxTree.Objects ) {

				const materialNodes = fbxTree.Objects.Material;

				for ( const nodeID in materialNodes ) {

					const material = this.parseMaterial( materialNodes[ nodeID ], textureMap );
					if ( material !== null ) materialMap.set( parseInt( nodeID ), material );

				}

			}

			return materialMap;

		} // Parse single node in FBXTree.Objects.Material
		// Materials are connected to texture maps in FBXTree.Objects.Textures
		// FBX format currently only supports Lambert and Phong shading models


		parseMaterial( materialNode, textureMap ) {

			const ID = materialNode.id;
			const name = materialNode.attrName;
			let type = materialNode.ShadingModel; // Case where FBX wraps shading model in property object.

			if ( typeof type === 'object' ) {

				type = type.value;

			} // Ignore unused materials which don't have any connections.


			if ( ! connections.has( ID ) ) return null;
			const parameters = this.parseParameters( materialNode, textureMap, ID );
			let material;

			switch ( type.toLowerCase() ) {

				case 'phong':
					material = new THREE.MeshPhongMaterial();
					break;

				case 'lambert':
					material = new THREE.MeshLambertMaterial();
					break;

				default:
					console.warn( 'THREE.FBXLoader: unknown material type "%s". Defaulting to THREE.MeshPhongMaterial.', type );
					material = new THREE.MeshPhongMaterial();
					break;

			}

			material.setValues( parameters );
			material.name = name;
			return material;

		} // Parse FBX material and return parameters suitable for a three.js material
		// Also parse the texture map and return any textures associated with the material


		parseParameters( materialNode, textureMap, ID ) {

			const parameters = {};

			if ( materialNode.BumpFactor ) {

				parameters.bumpScale = materialNode.BumpFactor.value;

			}

			if ( materialNode.Diffuse ) {

				parameters.color = new THREE.Color().fromArray( materialNode.Diffuse.value );

			} else if ( materialNode.DiffuseColor && ( materialNode.DiffuseColor.type === 'Color' || materialNode.DiffuseColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports diffuse here instead of in materialNode.Diffuse
				parameters.color = new THREE.Color().fromArray( materialNode.DiffuseColor.value );

			}

			if ( materialNode.DisplacementFactor ) {

				parameters.displacementScale = materialNode.DisplacementFactor.value;

			}

			if ( materialNode.Emissive ) {

				parameters.emissive = new THREE.Color().fromArray( materialNode.Emissive.value );

			} else if ( materialNode.EmissiveColor && ( materialNode.EmissiveColor.type === 'Color' || materialNode.EmissiveColor.type === 'ColorRGB' ) ) {

				// The blender exporter exports emissive color here instead of in materialNode.Emissive
				parameters.emissive = new THREE.Color().fromArray( materialNode.EmissiveColor.value );

			}

			if ( materialNode.EmissiveFactor ) {

				parameters.emissiveIntensity = parseFloat( materialNode.EmissiveFactor.value );

			}

			if ( materialNode.Opacity ) {

				parameters.opacity = parseFloat( materialNode.Opacity.value );

			}

			if ( parameters.opacity < 1.0 ) {

				parameters.transparent = true;

			}

			if ( materialNode.ReflectionFactor ) {

				parameters.reflectivity = materialNode.ReflectionFactor.value;

			}

			if ( materialNode.Shininess ) {

				parameters.shininess = materialNode.Shininess.value;

			}

			if ( materialNode.Specular ) {

				parameters.specular = new THREE.Color().fromArray( materialNode.Specular.value );

			} else if ( materialNode.SpecularColor && materialNode.SpecularColor.type === 'Color' ) {

				// The blender exporter exports specular color here instead of in materialNode.Specular
				parameters.specular = new THREE.Color().fromArray( materialNode.SpecularColor.value );

			}

			const scope = this;
			connections.get( ID ).children.forEach( function ( child ) {

				const type = child.relationship;

				switch ( type ) {

					case 'Bump':
						parameters.bumpMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'Maya|TEX_ao_map':
						parameters.aoMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'DiffuseColor':
					case 'Maya|TEX_color_map':
						parameters.map = scope.getTexture( textureMap, child.ID );

						if ( parameters.map !== undefined ) {

							parameters.map.encoding = THREE.sRGBEncoding;

						}

						break;

					case 'DisplacementColor':
						parameters.displacementMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'EmissiveColor':
						parameters.emissiveMap = scope.getTexture( textureMap, child.ID );

						if ( parameters.emissiveMap !== undefined ) {

							parameters.emissiveMap.encoding = THREE.sRGBEncoding;

						}

						break;

					case 'NormalMap':
					case 'Maya|TEX_normal_map':
						parameters.normalMap = scope.getTexture( textureMap, child.ID );
						break;

					case 'ReflectionColor':
						parameters.envMap = scope.getTexture( textureMap, child.ID );

						if ( parameters.envMap !== undefined ) {

							parameters.envMap.mapping = THREE.EquirectangularReflectionMapping;
							parameters.envMap.encoding = THREE.sRGBEncoding;

						}

						break;

					case 'SpecularColor':
						parameters.specularMap = scope.getTexture( textureMap, child.ID );

						if ( parameters.specularMap !== undefined ) {

							parameters.specularMap.encoding = THREE.sRGBEncoding;

						}

						break;

					case 'TransparentColor':
					case 'TransparencyFactor':
						parameters.alphaMap = scope.getTexture( textureMap, child.ID );
						parameters.transparent = true;
						break;

					case 'AmbientColor':
					case 'ShininessExponent': // AKA glossiness map

					case 'SpecularFactor': // AKA specularLevel

					case 'VectorDisplacementColor': // NOTE: Seems to be a copy of DisplacementColor

					default:
						console.warn( 'THREE.FBXLoader: %s map is not supported in three.js, skipping texture.', type );
						break;

				}

			} );
			return parameters;

		} // get a texture from the textureMap for use by a material.


		getTexture( textureMap, id ) {

			// if the texture is a layered texture, just use the first layer and issue a warning
			if ( 'LayeredTexture' in fbxTree.Objects && id in fbxTree.Objects.LayeredTexture ) {

				console.warn( 'THREE.FBXLoader: layered textures are not supported in three.js. Discarding all but first layer.' );
				id = connections.get( id ).children[ 0 ].ID;

			}

			const texture = textureMap.get( id );

			if ( texture.image !== undefined ) {

				return texture;

			} else {

				return undefined;

			}

		} // Parse nodes in FBXTree.Objects.Deformer
		// Deformer node can contain skinning or Vertex Cache animation data, however only skinning is supported here
		// Generates map of THREE.Skeleton-like objects for use later when generating and binding skeletons.


		parseDeformers() {

			const skeletons = {};
			const morphTargets = {};

			if ( 'Deformer' in fbxTree.Objects ) {

				const DeformerNodes = fbxTree.Objects.Deformer;

				for ( const nodeID in DeformerNodes ) {

					const deformerNode = DeformerNodes[ nodeID ];
					const relationships = connections.get( parseInt( nodeID ) );

					if ( deformerNode.attrType === 'Skin' ) {

						const skeleton = this.parseSkeleton( relationships, DeformerNodes );
						skeleton.ID = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: skeleton attached to more than one geometry is not supported.' );
						skeleton.geometryID = relationships.parents[ 0 ].ID;
						skeletons[ nodeID ] = skeleton;

					} else if ( deformerNode.attrType === 'BlendShape' ) {

						const morphTarget = {
							id: nodeID
						};
						morphTarget.rawTargets = this.parseMorphTargets( relationships, DeformerNodes );
						morphTarget.id = nodeID;
						if ( relationships.parents.length > 1 ) console.warn( 'THREE.FBXLoader: morph target attached to more than one geometry is not supported.' );
						morphTargets[ nodeID ] = morphTarget;

					}

				}

			}

			return {
				skeletons: skeletons,
				morphTargets: morphTargets
			};

		} // Parse single nodes in FBXTree.Objects.Deformer
		// The top level skeleton node has type 'Skin' and sub nodes have type 'Cluster'
		// Each skin node represents a skeleton and each cluster node represents a bone


		parseSkeleton( relationships, deformerNodes ) {

			const rawBones = [];
			relationships.children.forEach( function ( child ) {

				const boneNode = deformerNodes[ child.ID ];
				if ( boneNode.attrType !== 'Cluster' ) return;
				const rawBone = {
					ID: child.ID,
					indices: [],
					weights: [],
					transformLink: new THREE.Matrix4().fromArray( boneNode.TransformLink.a ) // transform: new THREE.Matrix4().fromArray( boneNode.Transform.a ),
					// linkMode: boneNode.Mode,

				};

				if ( 'Indexes' in boneNode ) {

					rawBone.indices = boneNode.Indexes.a;
					rawBone.weights = boneNode.Weights.a;

				}

				rawBones.push( rawBone );

			} );
			return {
				rawBones: rawBones,
				bones: []
			};

		} // The top level morph deformer node has type "BlendShape" and sub nodes have type "BlendShapeChannel"


		parseMorphTargets( relationships, deformerNodes ) {

			const rawMorphTargets = [];

			for ( let i = 0; i < relationships.children.length; i ++ ) {

				const child = relationships.children[ i ];
				const morphTargetNode = deformerNodes[ child.ID ];
				const rawMorphTarget = {
					name: morphTargetNode.attrName,
					initialWeight: morphTargetNode.DeformPercent,
					id: morphTargetNode.id,
					fullWeights: morphTargetNode.FullWeights.a
				};
				if ( morphTargetNode.attrType !== 'BlendShapeChannel' ) return;
				rawMorphTarget.geoID = connections.get( parseInt( child.ID ) ).children.filter( function ( child ) {

					return child.relationship === undefined;

				} )[ 0 ].ID;
				rawMorphTargets.push( rawMorphTarget );

			}

			return rawMorphTargets;

		} // create the main THREE.Group() to be returned by the loader


		parseScene( deformers, geometryMap, materialMap ) {

			sceneGraph = new THREE.Group();
			const modelMap = this.parseModels( deformers.skeletons, geometryMap, materialMap );
			const modelNodes = fbxTree.Objects.Model;
			const scope = this;
			modelMap.forEach( function ( model ) {

				const modelNode = modelNodes[ model.ID ];
				scope.setLookAtProperties( model, modelNode );
				const parentConnections = connections.get( model.ID ).parents;
				parentConnections.forEach( function ( connection ) {

					const parent = modelMap.get( connection.ID );
					if ( parent !== undefined ) parent.add( model );

				} );

				if ( model.parent === null ) {

					sceneGraph.add( model );

				}

			} );
			this.bindSkeleton( deformers.skeletons, geometryMap, modelMap );
			this.createAmbientLight();
			sceneGraph.traverse( function ( node ) {

				if ( node.userData.transformData ) {

					if ( node.parent ) {

						node.userData.transformData.parentMatrix = node.parent.matrix;
						node.userData.transformData.parentMatrixWorld = node.parent.matrixWorld;

					}

					const transform = generateTransform( node.userData.transformData );
					node.applyMatrix4( transform );
					node.updateWorldMatrix();

				}

			} );
			const animations = new AnimationParser().parse(); // if all the models where already combined in a single group, just return that

			if ( sceneGraph.children.length === 1 && sceneGraph.children[ 0 ].isGroup ) {

				sceneGraph.children[ 0 ].animations = animations;
				sceneGraph = sceneGraph.children[ 0 ];

			}

			sceneGraph.animations = animations;

		} // parse nodes in FBXTree.Objects.Model


		parseModels( skeletons, geometryMap, materialMap ) {

			const modelMap = new Map();
			const modelNodes = fbxTree.Objects.Model;

			for ( const nodeID in modelNodes ) {

				const id = parseInt( nodeID );
				const node = modelNodes[ nodeID ];
				const relationships = connections.get( id );
				let model = this.buildSkeleton( relationships, skeletons, id, node.attrName );

				if ( ! model ) {

					switch ( node.attrType ) {

						case 'Camera':
							model = this.createCamera( relationships );
							break;

						case 'Light':
							model = this.createLight( relationships );
							break;

						case 'Mesh':
							model = this.createMesh( relationships, geometryMap, materialMap );
							break;

						case 'NurbsCurve':
							model = this.createCurve( relationships, geometryMap );
							break;

						case 'LimbNode':
						case 'Root':
							model = new THREE.Bone();
							break;

						case 'Null':
						default:
							model = new THREE.Group();
							break;

					}

					model.name = node.attrName ? THREE.PropertyBinding.sanitizeNodeName( node.attrName ) : '';
					model.ID = id;

				}

				this.getTransformData( model, node );
				modelMap.set( id, model );

			}

			return modelMap;

		}

		buildSkeleton( relationships, skeletons, id, name ) {

			let bone = null;
			relationships.parents.forEach( function ( parent ) {

				for ( const ID in skeletons ) {

					const skeleton = skeletons[ ID ];
					skeleton.rawBones.forEach( function ( rawBone, i ) {

						if ( rawBone.ID === parent.ID ) {

							const subBone = bone;
							bone = new THREE.Bone();
							bone.matrixWorld.copy( rawBone.transformLink ); // set name and id here - otherwise in cases where "subBone" is created it will not have a name / id

							bone.name = name ? THREE.PropertyBinding.sanitizeNodeName( name ) : '';
							bone.ID = id;
							skeleton.bones[ i ] = bone; // In cases where a bone is shared between multiple meshes
							// duplicate the bone here and and it as a child of the first bone

							if ( subBone !== null ) {

								bone.add( subBone );

							}

						}

					} );

				}

			} );
			return bone;

		} // create a THREE.PerspectiveCamera or THREE.OrthographicCamera


		createCamera( relationships ) {

			let model;
			let cameraAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					cameraAttribute = attr;

				}

			} );

			if ( cameraAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type = 0;

				if ( cameraAttribute.CameraProjectionType !== undefined && cameraAttribute.CameraProjectionType.value === 1 ) {

					type = 1;

				}

				let nearClippingPlane = 1;

				if ( cameraAttribute.NearPlane !== undefined ) {

					nearClippingPlane = cameraAttribute.NearPlane.value / 1000;

				}

				let farClippingPlane = 1000;

				if ( cameraAttribute.FarPlane !== undefined ) {

					farClippingPlane = cameraAttribute.FarPlane.value / 1000;

				}

				let width = window.innerWidth;
				let height = window.innerHeight;

				if ( cameraAttribute.AspectWidth !== undefined && cameraAttribute.AspectHeight !== undefined ) {

					width = cameraAttribute.AspectWidth.value;
					height = cameraAttribute.AspectHeight.value;

				}

				const aspect = width / height;
				let fov = 45;

				if ( cameraAttribute.FieldOfView !== undefined ) {

					fov = cameraAttribute.FieldOfView.value;

				}

				const focalLength = cameraAttribute.FocalLength ? cameraAttribute.FocalLength.value : null;

				switch ( type ) {

					case 0:
						// Perspective
						model = new THREE.PerspectiveCamera( fov, aspect, nearClippingPlane, farClippingPlane );
						if ( focalLength !== null ) model.setFocalLength( focalLength );
						break;

					case 1:
						// Orthographic
						model = new THREE.OrthographicCamera( - width / 2, width / 2, height / 2, - height / 2, nearClippingPlane, farClippingPlane );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown camera type ' + type + '.' );
						model = new THREE.Object3D();
						break;

				}

			}

			return model;

		} // Create a THREE.DirectionalLight, THREE.PointLight or THREE.SpotLight


		createLight( relationships ) {

			let model;
			let lightAttribute;
			relationships.children.forEach( function ( child ) {

				const attr = fbxTree.Objects.NodeAttribute[ child.ID ];

				if ( attr !== undefined ) {

					lightAttribute = attr;

				}

			} );

			if ( lightAttribute === undefined ) {

				model = new THREE.Object3D();

			} else {

				let type; // LightType can be undefined for Point lights

				if ( lightAttribute.LightType === undefined ) {

					type = 0;

				} else {

					type = lightAttribute.LightType.value;

				}

				let color = 0xffffff;

				if ( lightAttribute.Color !== undefined ) {

					color = new THREE.Color().fromArray( lightAttribute.Color.value );

				}

				let intensity = lightAttribute.Intensity === undefined ? 1 : lightAttribute.Intensity.value / 100; // light disabled

				if ( lightAttribute.CastLightOnObject !== undefined && lightAttribute.CastLightOnObject.value === 0 ) {

					intensity = 0;

				}

				let distance = 0;

				if ( lightAttribute.FarAttenuationEnd !== undefined ) {

					if ( lightAttribute.EnableFarAttenuation !== undefined && lightAttribute.EnableFarAttenuation.value === 0 ) {

						distance = 0;

					} else {

						distance = lightAttribute.FarAttenuationEnd.value;

					}

				} // TODO: could this be calculated linearly from FarAttenuationStart to FarAttenuationEnd?


				const decay = 1;

				switch ( type ) {

					case 0:
						// Point
						model = new THREE.PointLight( color, intensity, distance, decay );
						break;

					case 1:
						// Directional
						model = new THREE.DirectionalLight( color, intensity );
						break;

					case 2:
						// Spot
						let angle = Math.PI / 3;

						if ( lightAttribute.InnerAngle !== undefined ) {

							angle = THREE.MathUtils.degToRad( lightAttribute.InnerAngle.value );

						}

						let penumbra = 0;

						if ( lightAttribute.OuterAngle !== undefined ) {

							// TODO: this is not correct - FBX calculates outer and inner angle in degrees
							// with OuterAngle > InnerAngle && OuterAngle <= Math.PI
							// while three.js uses a penumbra between (0, 1) to attenuate the inner angle
							penumbra = THREE.MathUtils.degToRad( lightAttribute.OuterAngle.value );
							penumbra = Math.max( penumbra, 1 );

						}

						model = new THREE.SpotLight( color, intensity, distance, angle, penumbra, decay );
						break;

					default:
						console.warn( 'THREE.FBXLoader: Unknown light type ' + lightAttribute.LightType.value + ', defaulting to a THREE.PointLight.' );
						model = new THREE.PointLight( color, intensity );
						break;

				}

				if ( lightAttribute.CastShadows !== undefined && lightAttribute.CastShadows.value === 1 ) {

					model.castShadow = true;

				}

			}

			return model;

		}

		createMesh( relationships, geometryMap, materialMap ) {

			let model;
			let geometry = null;
			let material = null;
			const materials = []; // get geometry and materials(s) from connections

			relationships.children.forEach( function ( child ) {

				if ( geometryMap.has( child.ID ) ) {

					geometry = geometryMap.get( child.ID );

				}

				if ( materialMap.has( child.ID ) ) {

					materials.push( materialMap.get( child.ID ) );

				}

			} );

			if ( materials.length > 1 ) {

				material = materials;

			} else if ( materials.length > 0 ) {

				material = materials[ 0 ];

			} else {

				material = new THREE.MeshPhongMaterial( {
					color: 0xcccccc
				} );
				materials.push( material );

			}

			if ( 'color' in geometry.attributes ) {

				materials.forEach( function ( material ) {

					material.vertexColors = true;

				} );

			}

			if ( geometry.FBX_Deformer ) {

				model = new THREE.SkinnedMesh( geometry, material );
				model.normalizeSkinWeights();

			} else {

				model = new THREE.Mesh( geometry, material );

			}

			return model;

		}

		createCurve( relationships, geometryMap ) {

			const geometry = relationships.children.reduce( function ( geo, child ) {

				if ( geometryMap.has( child.ID ) ) geo = geometryMap.get( child.ID );
				return geo;

			}, null ); // FBX does not list materials for Nurbs lines, so we'll just put our own in here.

			const material = new THREE.LineBasicMaterial( {
				color: 0x3300ff,
				linewidth: 1
			} );
			return new THREE.Line( geometry, material );

		} // parse the model node for transform data


		getTransformData( model, modelNode ) {

			const transformData = {};
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value ); else transformData.eulerOrder = 'ZYX';
			if ( 'Lcl_Translation' in modelNode ) transformData.translation = modelNode.Lcl_Translation.value;
			if ( 'PreRotation' in modelNode ) transformData.preRotation = modelNode.PreRotation.value;
			if ( 'Lcl_Rotation' in modelNode ) transformData.rotation = modelNode.Lcl_Rotation.value;
			if ( 'PostRotation' in modelNode ) transformData.postRotation = modelNode.PostRotation.value;
			if ( 'Lcl_Scaling' in modelNode ) transformData.scale = modelNode.Lcl_Scaling.value;
			if ( 'ScalingOffset' in modelNode ) transformData.scalingOffset = modelNode.ScalingOffset.value;
			if ( 'ScalingPivot' in modelNode ) transformData.scalingPivot = modelNode.ScalingPivot.value;
			if ( 'RotationOffset' in modelNode ) transformData.rotationOffset = modelNode.RotationOffset.value;
			if ( 'RotationPivot' in modelNode ) transformData.rotationPivot = modelNode.RotationPivot.value;
			model.userData.transformData = transformData;

		}

		setLookAtProperties( model, modelNode ) {

			if ( 'LookAtProperty' in modelNode ) {

				const children = connections.get( model.ID ).children;
				children.forEach( function ( child ) {

					if ( child.relationship === 'LookAtProperty' ) {

						const lookAtTarget = fbxTree.Objects.Model[ child.ID ];

						if ( 'Lcl_Translation' in lookAtTarget ) {

							const pos = lookAtTarget.Lcl_Translation.value; // THREE.DirectionalLight, THREE.SpotLight

							if ( model.target !== undefined ) {

								model.target.position.fromArray( pos );
								sceneGraph.add( model.target );

							} else {

								// Cameras and other Object3Ds
								model.lookAt( new THREE.Vector3().fromArray( pos ) );

							}

						}

					}

				} );

			}

		}

		bindSkeleton( skeletons, geometryMap, modelMap ) {

			const bindMatrices = this.parsePoseNodes();

			for ( const ID in skeletons ) {

				const skeleton = skeletons[ ID ];
				const parents = connections.get( parseInt( skeleton.ID ) ).parents;
				parents.forEach( function ( parent ) {

					if ( geometryMap.has( parent.ID ) ) {

						const geoID = parent.ID;
						const geoRelationships = connections.get( geoID );
						geoRelationships.parents.forEach( function ( geoConnParent ) {

							if ( modelMap.has( geoConnParent.ID ) ) {

								const model = modelMap.get( geoConnParent.ID );
								model.bind( new THREE.Skeleton( skeleton.bones ), bindMatrices[ geoConnParent.ID ] );

							}

						} );

					}

				} );

			}

		}

		parsePoseNodes() {

			const bindMatrices = {};

			if ( 'Pose' in fbxTree.Objects ) {

				const BindPoseNode = fbxTree.Objects.Pose;

				for ( const nodeID in BindPoseNode ) {

					if ( BindPoseNode[ nodeID ].attrType === 'BindPose' ) {

						const poseNodes = BindPoseNode[ nodeID ].PoseNode;

						if ( Array.isArray( poseNodes ) ) {

							poseNodes.forEach( function ( poseNode ) {

								bindMatrices[ poseNode.Node ] = new THREE.Matrix4().fromArray( poseNode.Matrix.a );

							} );

						} else {

							bindMatrices[ poseNodes.Node ] = new THREE.Matrix4().fromArray( poseNodes.Matrix.a );

						}

					}

				}

			}

			return bindMatrices;

		} // Parse ambient color in FBXTree.GlobalSettings - if it's not set to black (default), create an ambient light


		createAmbientLight() {

			if ( 'GlobalSettings' in fbxTree && 'AmbientColor' in fbxTree.GlobalSettings ) {

				const ambientColor = fbxTree.GlobalSettings.AmbientColor.value;
				const r = ambientColor[ 0 ];
				const g = ambientColor[ 1 ];
				const b = ambientColor[ 2 ];

				if ( r !== 0 || g !== 0 || b !== 0 ) {

					const color = new THREE.Color( r, g, b );
					sceneGraph.add( new THREE.AmbientLight( color, 1 ) );

				}

			}

		}

	} // parse Geometry data from FBXTree and return map of BufferGeometries


	class GeometryParser {

		// Parse nodes in FBXTree.Objects.Geometry
		parse( deformers ) {

			const geometryMap = new Map();

			if ( 'Geometry' in fbxTree.Objects ) {

				const geoNodes = fbxTree.Objects.Geometry;

				for ( const nodeID in geoNodes ) {

					const relationships = connections.get( parseInt( nodeID ) );
					const geo = this.parseGeometry( relationships, geoNodes[ nodeID ], deformers );
					geometryMap.set( parseInt( nodeID ), geo );

				}

			}

			return geometryMap;

		} // Parse single node in FBXTree.Objects.Geometry


		parseGeometry( relationships, geoNode, deformers ) {

			switch ( geoNode.attrType ) {

				case 'Mesh':
					return this.parseMeshGeometry( relationships, geoNode, deformers );
					break;

				case 'NurbsCurve':
					return this.parseNurbsGeometry( geoNode );
					break;

			}

		} // Parse single node mesh geometry in FBXTree.Objects.Geometry


		parseMeshGeometry( relationships, geoNode, deformers ) {

			const skeletons = deformers.skeletons;
			const morphTargets = [];
			const modelNodes = relationships.parents.map( function ( parent ) {

				return fbxTree.Objects.Model[ parent.ID ];

			} ); // don't create geometry if it is not associated with any models

			if ( modelNodes.length === 0 ) return;
			const skeleton = relationships.children.reduce( function ( skeleton, child ) {

				if ( skeletons[ child.ID ] !== undefined ) skeleton = skeletons[ child.ID ];
				return skeleton;

			}, null );
			relationships.children.forEach( function ( child ) {

				if ( deformers.morphTargets[ child.ID ] !== undefined ) {

					morphTargets.push( deformers.morphTargets[ child.ID ] );

				}

			} ); // Assume one model and get the preRotation from that
			// if there is more than one model associated with the geometry this may cause problems

			const modelNode = modelNodes[ 0 ];
			const transformData = {};
			if ( 'RotationOrder' in modelNode ) transformData.eulerOrder = getEulerOrder( modelNode.RotationOrder.value );
			if ( 'InheritType' in modelNode ) transformData.inheritType = parseInt( modelNode.InheritType.value );
			if ( 'GeometricTranslation' in modelNode ) transformData.translation = modelNode.GeometricTranslation.value;
			if ( 'GeometricRotation' in modelNode ) transformData.rotation = modelNode.GeometricRotation.value;
			if ( 'GeometricScaling' in modelNode ) transformData.scale = modelNode.GeometricScaling.value;
			const transform = generateTransform( transformData );
			return this.genGeometry( geoNode, skeleton, morphTargets, transform );

		} // Generate a THREE.BufferGeometry from a node in FBXTree.Objects.Geometry


		genGeometry( geoNode, skeleton, morphTargets, preTransform ) {

			const geo = new THREE.BufferGeometry();
			if ( geoNode.attrName ) geo.name = geoNode.attrName;
			const geoInfo = this.parseGeoNode( geoNode, skeleton );
			const buffers = this.genBuffers( geoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( buffers.vertex, 3 );
			positionAttribute.applyMatrix4( preTransform );
			geo.setAttribute( 'position', positionAttribute );

			if ( buffers.colors.length > 0 ) {

				geo.setAttribute( 'color', new THREE.Float32BufferAttribute( buffers.colors, 3 ) );

			}

			if ( skeleton ) {

				geo.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( buffers.weightsIndices, 4 ) );
				geo.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( buffers.vertexWeights, 4 ) ); // used later to bind the skeleton to the model

				geo.FBX_Deformer = skeleton;

			}

			if ( buffers.normal.length > 0 ) {

				const normalMatrix = new THREE.Matrix3().getNormalMatrix( preTransform );
				const normalAttribute = new THREE.Float32BufferAttribute( buffers.normal, 3 );
				normalAttribute.applyNormalMatrix( normalMatrix );
				geo.setAttribute( 'normal', normalAttribute );

			}

			buffers.uvs.forEach( function ( uvBuffer, i ) {

				// subsequent uv buffers are called 'uv1', 'uv2', ...
				let name = 'uv' + ( i + 1 ).toString(); // the first uv buffer is just called 'uv'

				if ( i === 0 ) {

					name = 'uv';

				}

				geo.setAttribute( name, new THREE.Float32BufferAttribute( buffers.uvs[ i ], 2 ) );

			} );

			if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

				// Convert the material indices of each vertex into rendering groups on the geometry.
				let prevMaterialIndex = buffers.materialIndex[ 0 ];
				let startIndex = 0;
				buffers.materialIndex.forEach( function ( currentIndex, i ) {

					if ( currentIndex !== prevMaterialIndex ) {

						geo.addGroup( startIndex, i - startIndex, prevMaterialIndex );
						prevMaterialIndex = currentIndex;
						startIndex = i;

					}

				} ); // the loop above doesn't add the last group, do that here.

				if ( geo.groups.length > 0 ) {

					const lastGroup = geo.groups[ geo.groups.length - 1 ];
					const lastIndex = lastGroup.start + lastGroup.count;

					if ( lastIndex !== buffers.materialIndex.length ) {

						geo.addGroup( lastIndex, buffers.materialIndex.length - lastIndex, prevMaterialIndex );

					}

				} // case where there are multiple materials but the whole geometry is only
				// using one of them


				if ( geo.groups.length === 0 ) {

					geo.addGroup( 0, buffers.materialIndex.length, buffers.materialIndex[ 0 ] );

				}

			}

			this.addMorphTargets( geo, geoNode, morphTargets, preTransform );
			return geo;

		}

		parseGeoNode( geoNode, skeleton ) {

			const geoInfo = {};
			geoInfo.vertexPositions = geoNode.Vertices !== undefined ? geoNode.Vertices.a : [];
			geoInfo.vertexIndices = geoNode.PolygonVertexIndex !== undefined ? geoNode.PolygonVertexIndex.a : [];

			if ( geoNode.LayerElementColor ) {

				geoInfo.color = this.parseVertexColors( geoNode.LayerElementColor[ 0 ] );

			}

			if ( geoNode.LayerElementMaterial ) {

				geoInfo.material = this.parseMaterialIndices( geoNode.LayerElementMaterial[ 0 ] );

			}

			if ( geoNode.LayerElementNormal ) {

				geoInfo.normal = this.parseNormals( geoNode.LayerElementNormal[ 0 ] );

			}

			if ( geoNode.LayerElementUV ) {

				geoInfo.uv = [];
				let i = 0;

				while ( geoNode.LayerElementUV[ i ] ) {

					if ( geoNode.LayerElementUV[ i ].UV ) {

						geoInfo.uv.push( this.parseUVs( geoNode.LayerElementUV[ i ] ) );

					}

					i ++;

				}

			}

			geoInfo.weightTable = {};

			if ( skeleton !== null ) {

				geoInfo.skeleton = skeleton;
				skeleton.rawBones.forEach( function ( rawBone, i ) {

					// loop over the bone's vertex indices and weights
					rawBone.indices.forEach( function ( index, j ) {

						if ( geoInfo.weightTable[ index ] === undefined ) geoInfo.weightTable[ index ] = [];
						geoInfo.weightTable[ index ].push( {
							id: i,
							weight: rawBone.weights[ j ]
						} );

					} );

				} );

			}

			return geoInfo;

		}

		genBuffers( geoInfo ) {

			const buffers = {
				vertex: [],
				normal: [],
				colors: [],
				uvs: [],
				materialIndex: [],
				vertexWeights: [],
				weightsIndices: []
			};
			let polygonIndex = 0;
			let faceLength = 0;
			let displayedWeightsWarning = false; // these will hold data for a single face

			let facePositionIndexes = [];
			let faceNormals = [];
			let faceColors = [];
			let faceUVs = [];
			let faceWeights = [];
			let faceWeightIndices = [];
			const scope = this;
			geoInfo.vertexIndices.forEach( function ( vertexIndex, polygonVertexIndex ) {

				let materialIndex;
				let endOfFace = false; // Face index and vertex index arrays are combined in a single array
				// A cube with quad faces looks like this:
				// PolygonVertexIndex: *24 {
				//  a: 0, 1, 3, -3, 2, 3, 5, -5, 4, 5, 7, -7, 6, 7, 1, -1, 1, 7, 5, -4, 6, 0, 2, -5
				//  }
				// Negative numbers mark the end of a face - first face here is 0, 1, 3, -3
				// to find index of last vertex bit shift the index: ^ - 1

				if ( vertexIndex < 0 ) {

					vertexIndex = vertexIndex ^ - 1; // equivalent to ( x * -1 ) - 1

					endOfFace = true;

				}

				let weightIndices = [];
				let weights = [];
				facePositionIndexes.push( vertexIndex * 3, vertexIndex * 3 + 1, vertexIndex * 3 + 2 );

				if ( geoInfo.color ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.color );
					faceColors.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.skeleton ) {

					if ( geoInfo.weightTable[ vertexIndex ] !== undefined ) {

						geoInfo.weightTable[ vertexIndex ].forEach( function ( wt ) {

							weights.push( wt.weight );
							weightIndices.push( wt.id );

						} );

					}

					if ( weights.length > 4 ) {

						if ( ! displayedWeightsWarning ) {

							console.warn( 'THREE.FBXLoader: Vertex has more than 4 skinning weights assigned to vertex. Deleting additional weights.' );
							displayedWeightsWarning = true;

						}

						const wIndex = [ 0, 0, 0, 0 ];
						const Weight = [ 0, 0, 0, 0 ];
						weights.forEach( function ( weight, weightIndex ) {

							let currentWeight = weight;
							let currentIndex = weightIndices[ weightIndex ];
							Weight.forEach( function ( comparedWeight, comparedWeightIndex, comparedWeightArray ) {

								if ( currentWeight > comparedWeight ) {

									comparedWeightArray[ comparedWeightIndex ] = currentWeight;
									currentWeight = comparedWeight;
									const tmp = wIndex[ comparedWeightIndex ];
									wIndex[ comparedWeightIndex ] = currentIndex;
									currentIndex = tmp;

								}

							} );

						} );
						weightIndices = wIndex;
						weights = Weight;

					} // if the weight array is shorter than 4 pad with 0s


					while ( weights.length < 4 ) {

						weights.push( 0 );
						weightIndices.push( 0 );

					}

					for ( let i = 0; i < 4; ++ i ) {

						faceWeights.push( weights[ i ] );
						faceWeightIndices.push( weightIndices[ i ] );

					}

				}

				if ( geoInfo.normal ) {

					const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.normal );
					faceNormals.push( data[ 0 ], data[ 1 ], data[ 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					materialIndex = getData( polygonVertexIndex, polygonIndex, vertexIndex, geoInfo.material )[ 0 ];

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, i ) {

						const data = getData( polygonVertexIndex, polygonIndex, vertexIndex, uv );

						if ( faceUVs[ i ] === undefined ) {

							faceUVs[ i ] = [];

						}

						faceUVs[ i ].push( data[ 0 ] );
						faceUVs[ i ].push( data[ 1 ] );

					} );

				}

				faceLength ++;

				if ( endOfFace ) {

					scope.genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength );
					polygonIndex ++;
					faceLength = 0; // reset arrays for the next face

					facePositionIndexes = [];
					faceNormals = [];
					faceColors = [];
					faceUVs = [];
					faceWeights = [];
					faceWeightIndices = [];

				}

			} );
			return buffers;

		} // Generate data for a single face in a geometry. If the face is a quad then split it into 2 tris


		genFace( buffers, geoInfo, facePositionIndexes, materialIndex, faceNormals, faceColors, faceUVs, faceWeights, faceWeightIndices, faceLength ) {

			for ( let i = 2; i < faceLength; i ++ ) {

				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 0 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ ( i - 1 ) * 3 + 2 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 1 ] ] );
				buffers.vertex.push( geoInfo.vertexPositions[ facePositionIndexes[ i * 3 + 2 ] ] );

				if ( geoInfo.skeleton ) {

					buffers.vertexWeights.push( faceWeights[ 0 ] );
					buffers.vertexWeights.push( faceWeights[ 1 ] );
					buffers.vertexWeights.push( faceWeights[ 2 ] );
					buffers.vertexWeights.push( faceWeights[ 3 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ ( i - 1 ) * 4 + 3 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 1 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 2 ] );
					buffers.vertexWeights.push( faceWeights[ i * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 0 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ ( i - 1 ) * 4 + 3 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 1 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 2 ] );
					buffers.weightsIndices.push( faceWeightIndices[ i * 4 + 3 ] );

				}

				if ( geoInfo.color ) {

					buffers.colors.push( faceColors[ 0 ] );
					buffers.colors.push( faceColors[ 1 ] );
					buffers.colors.push( faceColors[ 2 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 1 ] );
					buffers.colors.push( faceColors[ ( i - 1 ) * 3 + 2 ] );
					buffers.colors.push( faceColors[ i * 3 ] );
					buffers.colors.push( faceColors[ i * 3 + 1 ] );
					buffers.colors.push( faceColors[ i * 3 + 2 ] );

				}

				if ( geoInfo.material && geoInfo.material.mappingType !== 'AllSame' ) {

					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );
					buffers.materialIndex.push( materialIndex );

				}

				if ( geoInfo.normal ) {

					buffers.normal.push( faceNormals[ 0 ] );
					buffers.normal.push( faceNormals[ 1 ] );
					buffers.normal.push( faceNormals[ 2 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 1 ] );
					buffers.normal.push( faceNormals[ ( i - 1 ) * 3 + 2 ] );
					buffers.normal.push( faceNormals[ i * 3 ] );
					buffers.normal.push( faceNormals[ i * 3 + 1 ] );
					buffers.normal.push( faceNormals[ i * 3 + 2 ] );

				}

				if ( geoInfo.uv ) {

					geoInfo.uv.forEach( function ( uv, j ) {

						if ( buffers.uvs[ j ] === undefined ) buffers.uvs[ j ] = [];
						buffers.uvs[ j ].push( faceUVs[ j ][ 0 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ ( i - 1 ) * 2 + 1 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 ] );
						buffers.uvs[ j ].push( faceUVs[ j ][ i * 2 + 1 ] );

					} );

				}

			}

		}

		addMorphTargets( parentGeo, parentGeoNode, morphTargets, preTransform ) {

			if ( morphTargets.length === 0 ) return;
			parentGeo.morphTargetsRelative = true;
			parentGeo.morphAttributes.position = []; // parentGeo.morphAttributes.normal = []; // not implemented

			const scope = this;
			morphTargets.forEach( function ( morphTarget ) {

				morphTarget.rawTargets.forEach( function ( rawTarget ) {

					const morphGeoNode = fbxTree.Objects.Geometry[ rawTarget.geoID ];

					if ( morphGeoNode !== undefined ) {

						scope.genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, rawTarget.name );

					}

				} );

			} );

		} // a morph geometry node is similar to a standard  node, and the node is also contained
		// in FBXTree.Objects.Geometry, however it can only have attributes for position, normal
		// and a special attribute Index defining which vertices of the original geometry are affected
		// Normal and position attributes only have data for the vertices that are affected by the morph


		genMorphGeometry( parentGeo, parentGeoNode, morphGeoNode, preTransform, name ) {

			const vertexIndices = parentGeoNode.PolygonVertexIndex !== undefined ? parentGeoNode.PolygonVertexIndex.a : [];
			const morphPositionsSparse = morphGeoNode.Vertices !== undefined ? morphGeoNode.Vertices.a : [];
			const indices = morphGeoNode.Indexes !== undefined ? morphGeoNode.Indexes.a : [];
			const length = parentGeo.attributes.position.count * 3;
			const morphPositions = new Float32Array( length );

			for ( let i = 0; i < indices.length; i ++ ) {

				const morphIndex = indices[ i ] * 3;
				morphPositions[ morphIndex ] = morphPositionsSparse[ i * 3 ];
				morphPositions[ morphIndex + 1 ] = morphPositionsSparse[ i * 3 + 1 ];
				morphPositions[ morphIndex + 2 ] = morphPositionsSparse[ i * 3 + 2 ];

			} // TODO: add morph normal support


			const morphGeoInfo = {
				vertexIndices: vertexIndices,
				vertexPositions: morphPositions
			};
			const morphBuffers = this.genBuffers( morphGeoInfo );
			const positionAttribute = new THREE.Float32BufferAttribute( morphBuffers.vertex, 3 );
			positionAttribute.name = name || morphGeoNode.attrName;
			positionAttribute.applyMatrix4( preTransform );
			parentGeo.morphAttributes.position.push( positionAttribute );

		} // Parse normal from FBXTree.Objects.Geometry.LayerElementNormal if it exists


		parseNormals( NormalNode ) {

			const mappingType = NormalNode.MappingInformationType;
			const referenceType = NormalNode.ReferenceInformationType;
			const buffer = NormalNode.Normals.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				if ( 'NormalIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalIndex.a;

				} else if ( 'NormalsIndex' in NormalNode ) {

					indexBuffer = NormalNode.NormalsIndex.a;

				}

			}

			return {
				dataSize: 3,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse UVs from FBXTree.Objects.Geometry.LayerElementUV if it exists


		parseUVs( UVNode ) {

			const mappingType = UVNode.MappingInformationType;
			const referenceType = UVNode.ReferenceInformationType;
			const buffer = UVNode.UV.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = UVNode.UVIndex.a;

			}

			return {
				dataSize: 2,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse Vertex Colors from FBXTree.Objects.Geometry.LayerElementColor if it exists


		parseVertexColors( ColorNode ) {

			const mappingType = ColorNode.MappingInformationType;
			const referenceType = ColorNode.ReferenceInformationType;
			const buffer = ColorNode.Colors.a;
			let indexBuffer = [];

			if ( referenceType === 'IndexToDirect' ) {

				indexBuffer = ColorNode.ColorIndex.a;

			}

			return {
				dataSize: 4,
				buffer: buffer,
				indices: indexBuffer,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Parse mapping and material data in FBXTree.Objects.Geometry.LayerElementMaterial if it exists


		parseMaterialIndices( MaterialNode ) {

			const mappingType = MaterialNode.MappingInformationType;
			const referenceType = MaterialNode.ReferenceInformationType;

			if ( mappingType === 'NoMappingInformation' ) {

				return {
					dataSize: 1,
					buffer: [ 0 ],
					indices: [ 0 ],
					mappingType: 'AllSame',
					referenceType: referenceType
				};

			}

			const materialIndexBuffer = MaterialNode.Materials.a; // Since materials are stored as indices, there's a bit of a mismatch between FBX and what
			// we expect.So we create an intermediate buffer that points to the index in the buffer,
			// for conforming with the other functions we've written for other data.

			const materialIndices = [];

			for ( let i = 0; i < materialIndexBuffer.length; ++ i ) {

				materialIndices.push( i );

			}

			return {
				dataSize: 1,
				buffer: materialIndexBuffer,
				indices: materialIndices,
				mappingType: mappingType,
				referenceType: referenceType
			};

		} // Generate a NurbGeometry from a node in FBXTree.Objects.Geometry


		parseNurbsGeometry( geoNode ) {

			if ( THREE.NURBSCurve === undefined ) {

				console.error( 'THREE.FBXLoader: The loader relies on THREE.NURBSCurve for any nurbs present in the model. Nurbs will show up as empty geometry.' );
				return new THREE.BufferGeometry();

			}

			const order = parseInt( geoNode.Order );

			if ( isNaN( order ) ) {

				console.error( 'THREE.FBXLoader: Invalid Order %s given for geometry ID: %s', geoNode.Order, geoNode.id );
				return new THREE.BufferGeometry();

			}

			const degree = order - 1;
			const knots = geoNode.KnotVector.a;
			const controlPoints = [];
			const pointsValues = geoNode.Points.a;

			for ( let i = 0, l = pointsValues.length; i < l; i += 4 ) {

				controlPoints.push( new THREE.Vector4().fromArray( pointsValues, i ) );

			}

			let startKnot, endKnot;

			if ( geoNode.Form === 'Closed' ) {

				controlPoints.push( controlPoints[ 0 ] );

			} else if ( geoNode.Form === 'Periodic' ) {

				startKnot = degree;
				endKnot = knots.length - 1 - startKnot;

				for ( let i = 0; i < degree; ++ i ) {

					controlPoints.push( controlPoints[ i ] );

				}

			}

			const curve = new THREE.NURBSCurve( degree, knots, controlPoints, startKnot, endKnot );
			const points = curve.getPoints( controlPoints.length * 12 );
			return new THREE.BufferGeometry().setFromPoints( points );

		}

	} // parse animation data from FBXTree


	class AnimationParser {

		// take raw animation clips and turn them into three.js animation clips
		parse() {

			const animationClips = [];
			const rawClips = this.parseClips();

			if ( rawClips !== undefined ) {

				for ( const key in rawClips ) {

					const rawClip = rawClips[ key ];
					const clip = this.addClip( rawClip );
					animationClips.push( clip );

				}

			}

			return animationClips;

		}

		parseClips() {

			// since the actual transformation data is stored in FBXTree.Objects.AnimationCurve,
			// if this is undefined we can safely assume there are no animations
			if ( fbxTree.Objects.AnimationCurve === undefined ) return undefined;
			const curveNodesMap = this.parseAnimationCurveNodes();
			this.parseAnimationCurves( curveNodesMap );
			const layersMap = this.parseAnimationLayers( curveNodesMap );
			const rawClips = this.parseAnimStacks( layersMap );
			return rawClips;

		} // parse nodes in FBXTree.Objects.AnimationCurveNode
		// each AnimationCurveNode holds data for an animation transform for a model (e.g. left arm rotation )
		// and is referenced by an AnimationLayer


		parseAnimationCurveNodes() {

			const rawCurveNodes = fbxTree.Objects.AnimationCurveNode;
			const curveNodesMap = new Map();

			for ( const nodeID in rawCurveNodes ) {

				const rawCurveNode = rawCurveNodes[ nodeID ];

				if ( rawCurveNode.attrName.match( /S|R|T|DeformPercent/ ) !== null ) {

					const curveNode = {
						id: rawCurveNode.id,
						attr: rawCurveNode.attrName,
						curves: {}
					};
					curveNodesMap.set( curveNode.id, curveNode );

				}

			}

			return curveNodesMap;

		} // parse nodes in FBXTree.Objects.AnimationCurve and connect them up to
		// previously parsed AnimationCurveNodes. Each AnimationCurve holds data for a single animated
		// axis ( e.g. times and values of x rotation)


		parseAnimationCurves( curveNodesMap ) {

			const rawCurves = fbxTree.Objects.AnimationCurve; // TODO: Many values are identical up to roundoff error, but won't be optimised
			// e.g. position times: [0, 0.4, 0. 8]
			// position values: [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.23538335023477e-7, 93.67518615722656, -0.9982695579528809, 7.235384487103147e-7, 93.67520904541016, -0.9982695579528809]
			// clearly, this should be optimised to
			// times: [0], positions [7.23538335023477e-7, 93.67518615722656, -0.9982695579528809]
			// this shows up in nearly every FBX file, and generally time array is length > 100

			for ( const nodeID in rawCurves ) {

				const animationCurve = {
					id: rawCurves[ nodeID ].id,
					times: rawCurves[ nodeID ].KeyTime.a.map( convertFBXTimeToSeconds ),
					values: rawCurves[ nodeID ].KeyValueFloat.a
				};
				const relationships = connections.get( animationCurve.id );

				if ( relationships !== undefined ) {

					const animationCurveID = relationships.parents[ 0 ].ID;
					const animationCurveRelationship = relationships.parents[ 0 ].relationship;

					if ( animationCurveRelationship.match( /X/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'x' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Y/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'y' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /Z/ ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'z' ] = animationCurve;

					} else if ( animationCurveRelationship.match( /d|DeformPercent/ ) && curveNodesMap.has( animationCurveID ) ) {

						curveNodesMap.get( animationCurveID ).curves[ 'morph' ] = animationCurve;

					}

				}

			}

		} // parse nodes in FBXTree.Objects.AnimationLayer. Each layers holds references
		// to various AnimationCurveNodes and is referenced by an AnimationStack node
		// note: theoretically a stack can have multiple layers, however in practice there always seems to be one per stack


		parseAnimationLayers( curveNodesMap ) {

			const rawLayers = fbxTree.Objects.AnimationLayer;
			const layersMap = new Map();

			for ( const nodeID in rawLayers ) {

				const layerCurveNodes = [];
				const connection = connections.get( parseInt( nodeID ) );

				if ( connection !== undefined ) {

					// all the animationCurveNodes used in the layer
					const children = connection.children;
					children.forEach( function ( child, i ) {

						if ( curveNodesMap.has( child.ID ) ) {

							const curveNode = curveNodesMap.get( child.ID ); // check that the curves are defined for at least one axis, otherwise ignore the curveNode

							if ( curveNode.curves.x !== undefined || curveNode.curves.y !== undefined || curveNode.curves.z !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const modelID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;

									if ( modelID !== undefined ) {

										const rawModel = fbxTree.Objects.Model[ modelID.toString() ];

										if ( rawModel === undefined ) {

											console.warn( 'THREE.FBXLoader: Encountered a unused curve.', child );
											return;

										}

										const node = {
											modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
											ID: rawModel.id,
											initialPosition: [ 0, 0, 0 ],
											initialRotation: [ 0, 0, 0 ],
											initialScale: [ 1, 1, 1 ]
										};
										sceneGraph.traverse( function ( child ) {

											if ( child.ID === rawModel.id ) {

												node.transform = child.matrix;
												if ( child.userData.transformData ) node.eulerOrder = child.userData.transformData.eulerOrder;

											}

										} );
										if ( ! node.transform ) node.transform = new THREE.Matrix4(); // if the animated model is pre rotated, we'll have to apply the pre rotations to every
										// animation value as well

										if ( 'PreRotation' in rawModel ) node.preRotation = rawModel.PreRotation.value;
										if ( 'PostRotation' in rawModel ) node.postRotation = rawModel.PostRotation.value;
										layerCurveNodes[ i ] = node;

									}

								}

								if ( layerCurveNodes[ i ] ) layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							} else if ( curveNode.curves.morph !== undefined ) {

								if ( layerCurveNodes[ i ] === undefined ) {

									const deformerID = connections.get( child.ID ).parents.filter( function ( parent ) {

										return parent.relationship !== undefined;

									} )[ 0 ].ID;
									const morpherID = connections.get( deformerID ).parents[ 0 ].ID;
									const geoID = connections.get( morpherID ).parents[ 0 ].ID; // assuming geometry is not used in more than one model

									const modelID = connections.get( geoID ).parents[ 0 ].ID;
									const rawModel = fbxTree.Objects.Model[ modelID ];
									const node = {
										modelName: rawModel.attrName ? THREE.PropertyBinding.sanitizeNodeName( rawModel.attrName ) : '',
										morphName: fbxTree.Objects.Deformer[ deformerID ].attrName
									};
									layerCurveNodes[ i ] = node;

								}

								layerCurveNodes[ i ][ curveNode.attr ] = curveNode;

							}

						}

					} );
					layersMap.set( parseInt( nodeID ), layerCurveNodes );

				}

			}

			return layersMap;

		} // parse nodes in FBXTree.Objects.AnimationStack. These are the top level node in the animation
		// hierarchy. Each Stack node will be used to create a THREE.AnimationClip


		parseAnimStacks( layersMap ) {

			const rawStacks = fbxTree.Objects.AnimationStack; // connect the stacks (clips) up to the layers

			const rawClips = {};

			for ( const nodeID in rawStacks ) {

				const children = connections.get( parseInt( nodeID ) ).children;

				if ( children.length > 1 ) {

					// it seems like stacks will always be associated with a single layer. But just in case there are files
					// where there are multiple layers per stack, we'll display a warning
					console.warn( 'THREE.FBXLoader: Encountered an animation stack with multiple layers, this is currently not supported. Ignoring subsequent layers.' );

				}

				const layer = layersMap.get( children[ 0 ].ID );
				rawClips[ nodeID ] = {
					name: rawStacks[ nodeID ].attrName,
					layer: layer
				};

			}

			return rawClips;

		}

		addClip( rawClip ) {

			let tracks = [];
			const scope = this;
			rawClip.layer.forEach( function ( rawTracks ) {

				tracks = tracks.concat( scope.generateTracks( rawTracks ) );

			} );
			return new THREE.AnimationClip( rawClip.name, - 1, tracks );

		}

		generateTracks( rawTracks ) {

			const tracks = [];
			let initialPosition = new THREE.Vector3();
			let initialRotation = new THREE.Quaternion();
			let initialScale = new THREE.Vector3();
			if ( rawTracks.transform ) rawTracks.transform.decompose( initialPosition, initialRotation, initialScale );
			initialPosition = initialPosition.toArray();
			initialRotation = new THREE.Euler().setFromQuaternion( initialRotation, rawTracks.eulerOrder ).toArray();
			initialScale = initialScale.toArray();

			if ( rawTracks.T !== undefined && Object.keys( rawTracks.T.curves ).length > 0 ) {

				const positionTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.T.curves, initialPosition, 'position' );
				if ( positionTrack !== undefined ) tracks.push( positionTrack );

			}

			if ( rawTracks.R !== undefined && Object.keys( rawTracks.R.curves ).length > 0 ) {

				const rotationTrack = this.generateRotationTrack( rawTracks.modelName, rawTracks.R.curves, initialRotation, rawTracks.preRotation, rawTracks.postRotation, rawTracks.eulerOrder );
				if ( rotationTrack !== undefined ) tracks.push( rotationTrack );

			}

			if ( rawTracks.S !== undefined && Object.keys( rawTracks.S.curves ).length > 0 ) {

				const scaleTrack = this.generateVectorTrack( rawTracks.modelName, rawTracks.S.curves, initialScale, 'scale' );
				if ( scaleTrack !== undefined ) tracks.push( scaleTrack );

			}

			if ( rawTracks.DeformPercent !== undefined ) {

				const morphTrack = this.generateMorphTrack( rawTracks );
				if ( morphTrack !== undefined ) tracks.push( morphTrack );

			}

			return tracks;

		}

		generateVectorTrack( modelName, curves, initialValue, type ) {

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );
			return new THREE.VectorKeyframeTrack( modelName + '.' + type, times, values );

		}

		generateRotationTrack( modelName, curves, initialValue, preRotation, postRotation, eulerOrder ) {

			if ( curves.x !== undefined ) {

				this.interpolateRotations( curves.x );
				curves.x.values = curves.x.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.y !== undefined ) {

				this.interpolateRotations( curves.y );
				curves.y.values = curves.y.values.map( THREE.MathUtils.degToRad );

			}

			if ( curves.z !== undefined ) {

				this.interpolateRotations( curves.z );
				curves.z.values = curves.z.values.map( THREE.MathUtils.degToRad );

			}

			const times = this.getTimesForAllAxes( curves );
			const values = this.getKeyframeTrackValues( times, curves, initialValue );

			if ( preRotation !== undefined ) {

				preRotation = preRotation.map( THREE.MathUtils.degToRad );
				preRotation.push( eulerOrder );
				preRotation = new THREE.Euler().fromArray( preRotation );
				preRotation = new THREE.Quaternion().setFromEuler( preRotation );

			}

			if ( postRotation !== undefined ) {

				postRotation = postRotation.map( THREE.MathUtils.degToRad );
				postRotation.push( eulerOrder );
				postRotation = new THREE.Euler().fromArray( postRotation );
				postRotation = new THREE.Quaternion().setFromEuler( postRotation ).invert();

			}

			const quaternion = new THREE.Quaternion();
			const euler = new THREE.Euler();
			const quaternionValues = [];

			for ( let i = 0; i < values.length; i += 3 ) {

				euler.set( values[ i ], values[ i + 1 ], values[ i + 2 ], eulerOrder );
				quaternion.setFromEuler( euler );
				if ( preRotation !== undefined ) quaternion.premultiply( preRotation );
				if ( postRotation !== undefined ) quaternion.multiply( postRotation );
				quaternion.toArray( quaternionValues, i / 3 * 4 );

			}

			return new THREE.QuaternionKeyframeTrack( modelName + '.quaternion', times, quaternionValues );

		}

		generateMorphTrack( rawTracks ) {

			const curves = rawTracks.DeformPercent.curves.morph;
			const values = curves.values.map( function ( val ) {

				return val / 100;

			} );
			const morphNum = sceneGraph.getObjectByName( rawTracks.modelName ).morphTargetDictionary[ rawTracks.morphName ];
			return new THREE.NumberKeyframeTrack( rawTracks.modelName + '.morphTargetInfluences[' + morphNum + ']', curves.times, values );

		} // For all animated objects, times are defined separately for each axis
		// Here we'll combine the times into one sorted array without duplicates


		getTimesForAllAxes( curves ) {

			let times = []; // first join together the times for each axis, if defined

			if ( curves.x !== undefined ) times = times.concat( curves.x.times );
			if ( curves.y !== undefined ) times = times.concat( curves.y.times );
			if ( curves.z !== undefined ) times = times.concat( curves.z.times ); // then sort them

			times = times.sort( function ( a, b ) {

				return a - b;

			} ); // and remove duplicates

			if ( times.length > 1 ) {

				let targetIndex = 1;
				let lastValue = times[ 0 ];

				for ( let i = 1; i < times.length; i ++ ) {

					const currentValue = times[ i ];

					if ( currentValue !== lastValue ) {

						times[ targetIndex ] = currentValue;
						lastValue = currentValue;
						targetIndex ++;

					}

				}

				times = times.slice( 0, targetIndex );

			}

			return times;

		}

		getKeyframeTrackValues( times, curves, initialValue ) {

			const prevValue = initialValue;
			const values = [];
			let xIndex = - 1;
			let yIndex = - 1;
			let zIndex = - 1;
			times.forEach( function ( time ) {

				if ( curves.x ) xIndex = curves.x.times.indexOf( time );
				if ( curves.y ) yIndex = curves.y.times.indexOf( time );
				if ( curves.z ) zIndex = curves.z.times.indexOf( time ); // if there is an x value defined for this frame, use that

				if ( xIndex !== - 1 ) {

					const xValue = curves.x.values[ xIndex ];
					values.push( xValue );
					prevValue[ 0 ] = xValue;

				} else {

					// otherwise use the x value from the previous frame
					values.push( prevValue[ 0 ] );

				}

				if ( yIndex !== - 1 ) {

					const yValue = curves.y.values[ yIndex ];
					values.push( yValue );
					prevValue[ 1 ] = yValue;

				} else {

					values.push( prevValue[ 1 ] );

				}

				if ( zIndex !== - 1 ) {

					const zValue = curves.z.values[ zIndex ];
					values.push( zValue );
					prevValue[ 2 ] = zValue;

				} else {

					values.push( prevValue[ 2 ] );

				}

			} );
			return values;

		} // Rotations are defined as THREE.Euler angles which can have values  of any size
		// These will be converted to quaternions which don't support values greater than
		// PI, so we'll interpolate large rotations


		interpolateRotations( curve ) {

			for ( let i = 1; i < curve.values.length; i ++ ) {

				const initialValue = curve.values[ i - 1 ];
				const valuesSpan = curve.values[ i ] - initialValue;
				const absoluteSpan = Math.abs( valuesSpan );

				if ( absoluteSpan >= 180 ) {

					const numSubIntervals = absoluteSpan / 180;
					const step = valuesSpan / numSubIntervals;
					let nextValue = initialValue + step;
					const initialTime = curve.times[ i - 1 ];
					const timeSpan = curve.times[ i ] - initialTime;
					const interval = timeSpan / numSubIntervals;
					let nextTime = initialTime + interval;
					const interpolatedTimes = [];
					const interpolatedValues = [];

					while ( nextTime < curve.times[ i ] ) {

						interpolatedTimes.push( nextTime );
						nextTime += interval;
						interpolatedValues.push( nextValue );
						nextValue += step;

					}

					curve.times = inject( curve.times, i, interpolatedTimes );
					curve.values = inject( curve.values, i, interpolatedValues );

				}

			}

		}

	} // parse an FBX file in ASCII format


	class TextParser {

		getPrevNode() {

			return this.nodeStack[ this.currentIndent - 2 ];

		}

		getCurrentNode() {

			return this.nodeStack[ this.currentIndent - 1 ];

		}

		getCurrentProp() {

			return this.currentProp;

		}

		pushStack( node ) {

			this.nodeStack.push( node );
			this.currentIndent += 1;

		}

		popStack() {

			this.nodeStack.pop();
			this.currentIndent -= 1;

		}

		setCurrentProp( val, name ) {

			this.currentProp = val;
			this.currentPropName = name;

		}

		parse( text ) {

			this.currentIndent = 0;
			this.allNodes = new FBXTree();
			this.nodeStack = [];
			this.currentProp = [];
			this.currentPropName = '';
			const scope = this;
			const split = text.split( /[\r\n]+/ );
			split.forEach( function ( line, i ) {

				const matchComment = line.match( /^[\s\t]*;/ );
				const matchEmpty = line.match( /^[\s\t]*$/ );
				if ( matchComment || matchEmpty ) return;
				const matchBeginning = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):(.*){', '' );
				const matchProperty = line.match( '^\\t{' + scope.currentIndent + '}(\\w+):[\\s\\t\\r\\n](.*)' );
				const matchEnd = line.match( '^\\t{' + ( scope.currentIndent - 1 ) + '}}' );

				if ( matchBeginning ) {

					scope.parseNodeBegin( line, matchBeginning );

				} else if ( matchProperty ) {

					scope.parseNodeProperty( line, matchProperty, split[ ++ i ] );

				} else if ( matchEnd ) {

					scope.popStack();

				} else if ( line.match( /^[^\s\t}]/ ) ) {

					// large arrays are split over multiple lines terminated with a ',' character
					// if this is encountered the line needs to be joined to the previous line
					scope.parseNodePropertyContinued( line );

				}

			} );
			return this.allNodes;

		}

		parseNodeBegin( line, property ) {

			const nodeName = property[ 1 ].trim().replace( /^"/, '' ).replace( /"$/, '' );
			const nodeAttrs = property[ 2 ].split( ',' ).map( function ( attr ) {

				return attr.trim().replace( /^"/, '' ).replace( /"$/, '' );

			} );
			const node = {
				name: nodeName
			};
			const attrs = this.parseNodeAttr( nodeAttrs );
			const currentNode = this.getCurrentNode(); // a top node

			if ( this.currentIndent === 0 ) {

				this.allNodes.add( nodeName, node );

			} else {

				// a subnode
				// if the subnode already exists, append it
				if ( nodeName in currentNode ) {

					// special case Pose needs PoseNodes as an array
					if ( nodeName === 'PoseNode' ) {

						currentNode.PoseNode.push( node );

					} else if ( currentNode[ nodeName ].id !== undefined ) {

						currentNode[ nodeName ] = {};
						currentNode[ nodeName ][ currentNode[ nodeName ].id ] = currentNode[ nodeName ];

					}

					if ( attrs.id !== '' ) currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( typeof attrs.id === 'number' ) {

					currentNode[ nodeName ] = {};
					currentNode[ nodeName ][ attrs.id ] = node;

				} else if ( nodeName !== 'Properties70' ) {

					if ( nodeName === 'PoseNode' ) currentNode[ nodeName ] = [ node ]; else currentNode[ nodeName ] = node;

				}

			}

			if ( typeof attrs.id === 'number' ) node.id = attrs.id;
			if ( attrs.name !== '' ) node.attrName = attrs.name;
			if ( attrs.type !== '' ) node.attrType = attrs.type;
			this.pushStack( node );

		}

		parseNodeAttr( attrs ) {

			let id = attrs[ 0 ];

			if ( attrs[ 0 ] !== '' ) {

				id = parseInt( attrs[ 0 ] );

				if ( isNaN( id ) ) {

					id = attrs[ 0 ];

				}

			}

			let name = '',
				type = '';

			if ( attrs.length > 1 ) {

				name = attrs[ 1 ].replace( /^(\w+)::/, '' );
				type = attrs[ 2 ];

			}

			return {
				id: id,
				name: name,
				type: type
			};

		}

		parseNodeProperty( line, property, contentLine ) {

			let propName = property[ 1 ].replace( /^"/, '' ).replace( /"$/, '' ).trim();
			let propValue = property[ 2 ].replace( /^"/, '' ).replace( /"$/, '' ).trim(); // for special case: base64 image data follows "Content: ," line
			//	Content: ,
			//	 "/9j/4RDaRXhpZgAATU0A..."

			if ( propName === 'Content' && propValue === ',' ) {

				propValue = contentLine.replace( /"/g, '' ).replace( /,$/, '' ).trim();

			}

			const currentNode = this.getCurrentNode();
			const parentName = currentNode.name;

			if ( parentName === 'Properties70' ) {

				this.parseNodeSpecialProperty( line, propName, propValue );
				return;

			} // Connections


			if ( propName === 'C' ) {

				const connProps = propValue.split( ',' ).slice( 1 );
				const from = parseInt( connProps[ 0 ] );
				const to = parseInt( connProps[ 1 ] );
				let rest = propValue.split( ',' ).slice( 3 );
				rest = rest.map( function ( elem ) {

					return elem.trim().replace( /^"/, '' );

				} );
				propName = 'connections';
				propValue = [ from, to ];
				append( propValue, rest );

				if ( currentNode[ propName ] === undefined ) {

					currentNode[ propName ] = [];

				}

			} // Node


			if ( propName === 'Node' ) currentNode.id = propValue; // connections

			if ( propName in currentNode && Array.isArray( currentNode[ propName ] ) ) {

				currentNode[ propName ].push( propValue );

			} else {

				if ( propName !== 'a' ) currentNode[ propName ] = propValue; else currentNode.a = propValue;

			}

			this.setCurrentProp( currentNode, propName ); // convert string to array, unless it ends in ',' in which case more will be added to it

			if ( propName === 'a' && propValue.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( propValue );

			}

		}

		parseNodePropertyContinued( line ) {

			const currentNode = this.getCurrentNode();
			currentNode.a += line; // if the line doesn't end in ',' we have reached the end of the property value
			// so convert the string to an array

			if ( line.slice( - 1 ) !== ',' ) {

				currentNode.a = parseNumberArray( currentNode.a );

			}

		} // parse "Property70"


		parseNodeSpecialProperty( line, propName, propValue ) {

			// split this
			// P: "Lcl Scaling", "Lcl Scaling", "", "A",1,1,1
			// into array like below
			// ["Lcl Scaling", "Lcl Scaling", "", "A", "1,1,1" ]
			const props = propValue.split( '",' ).map( function ( prop ) {

				return prop.trim().replace( /^\"/, '' ).replace( /\s/, '_' );

			} );
			const innerPropName = props[ 0 ];
			const innerPropType1 = props[ 1 ];
			const innerPropType2 = props[ 2 ];
			const innerPropFlag = props[ 3 ];
			let innerPropValue = props[ 4 ]; // cast values where needed, otherwise leave as strings

			switch ( innerPropType1 ) {

				case 'int':
				case 'enum':
				case 'bool':
				case 'ULongLong':
				case 'double':
				case 'Number':
				case 'FieldOfView':
					innerPropValue = parseFloat( innerPropValue );
					break;

				case 'Color':
				case 'ColorRGB':
				case 'Vector3D':
				case 'Lcl_Translation':
				case 'Lcl_Rotation':
				case 'Lcl_Scaling':
					innerPropValue = parseNumberArray( innerPropValue );
					break;

			} // CAUTION: these props must append to parent's parent


			this.getPrevNode()[ innerPropName ] = {
				'type': innerPropType1,
				'type2': innerPropType2,
				'flag': innerPropFlag,
				'value': innerPropValue
			};
			this.setCurrentProp( this.getPrevNode(), innerPropName );

		}

	} // Parse an FBX file in Binary format


	class BinaryParser {

		parse( buffer ) {

			const reader = new BinaryReader( buffer );
			reader.skip( 23 ); // skip magic 23 bytes

			const version = reader.getUint32();

			if ( version < 6400 ) {

				throw new Error( 'THREE.FBXLoader: FBX version not supported, FileVersion: ' + version );

			}

			const allNodes = new FBXTree();

			while ( ! this.endOfContent( reader ) ) {

				const node = this.parseNode( reader, version );
				if ( node !== null ) allNodes.add( node.name, node );

			}

			return allNodes;

		} // Check if reader has reached the end of content.


		endOfContent( reader ) {

			// footer size: 160bytes + 16-byte alignment padding
			// - 16bytes: magic
			// - padding til 16-byte alignment (at least 1byte?)
			//	(seems like some exporters embed fixed 15 or 16bytes?)
			// - 4bytes: magic
			// - 4bytes: version
			// - 120bytes: zero
			// - 16bytes: magic
			if ( reader.size() % 16 === 0 ) {

				return ( reader.getOffset() + 160 + 16 & ~ 0xf ) >= reader.size();

			} else {

				return reader.getOffset() + 160 + 16 >= reader.size();

			}

		} // recursively parse nodes until the end of the file is reached


		parseNode( reader, version ) {

			const node = {}; // The first three data sizes depends on version.

			const endOffset = version >= 7500 ? reader.getUint64() : reader.getUint32();
			const numProperties = version >= 7500 ? reader.getUint64() : reader.getUint32();
			version >= 7500 ? reader.getUint64() : reader.getUint32(); // the returned propertyListLen is not used

			const nameLen = reader.getUint8();
			const name = reader.getString( nameLen ); // Regards this node as NULL-record if endOffset is zero

			if ( endOffset === 0 ) return null;
			const propertyList = [];

			for ( let i = 0; i < numProperties; i ++ ) {

				propertyList.push( this.parseProperty( reader ) );

			} // Regards the first three elements in propertyList as id, attrName, and attrType


			const id = propertyList.length > 0 ? propertyList[ 0 ] : '';
			const attrName = propertyList.length > 1 ? propertyList[ 1 ] : '';
			const attrType = propertyList.length > 2 ? propertyList[ 2 ] : ''; // check if this node represents just a single property
			// like (name, 0) set or (name2, [0, 1, 2]) set of {name: 0, name2: [0, 1, 2]}

			node.singleProperty = numProperties === 1 && reader.getOffset() === endOffset ? true : false;

			while ( endOffset > reader.getOffset() ) {

				const subNode = this.parseNode( reader, version );
				if ( subNode !== null ) this.parseSubNode( name, node, subNode );

			}

			node.propertyList = propertyList; // raw property list used by parent

			if ( typeof id === 'number' ) node.id = id;
			if ( attrName !== '' ) node.attrName = attrName;
			if ( attrType !== '' ) node.attrType = attrType;
			if ( name !== '' ) node.name = name;
			return node;

		}

		parseSubNode( name, node, subNode ) {

			// special case: child node is single property
			if ( subNode.singleProperty === true ) {

				const value = subNode.propertyList[ 0 ];

				if ( Array.isArray( value ) ) {

					node[ subNode.name ] = subNode;
					subNode.a = value;

				} else {

					node[ subNode.name ] = value;

				}

			} else if ( name === 'Connections' && subNode.name === 'C' ) {

				const array = [];
				subNode.propertyList.forEach( function ( property, i ) {

					// first Connection is FBX type (OO, OP, etc.). We'll discard these
					if ( i !== 0 ) array.push( property );

				} );

				if ( node.connections === undefined ) {

					node.connections = [];

				}

				node.connections.push( array );

			} else if ( subNode.name === 'Properties70' ) {

				const keys = Object.keys( subNode );
				keys.forEach( function ( key ) {

					node[ key ] = subNode[ key ];

				} );

			} else if ( name === 'Properties70' && subNode.name === 'P' ) {

				let innerPropName = subNode.propertyList[ 0 ];
				let innerPropType1 = subNode.propertyList[ 1 ];
				const innerPropType2 = subNode.propertyList[ 2 ];
				const innerPropFlag = subNode.propertyList[ 3 ];
				let innerPropValue;
				if ( innerPropName.indexOf( 'Lcl ' ) === 0 ) innerPropName = innerPropName.replace( 'Lcl ', 'Lcl_' );
				if ( innerPropType1.indexOf( 'Lcl ' ) === 0 ) innerPropType1 = innerPropType1.replace( 'Lcl ', 'Lcl_' );

				if ( innerPropType1 === 'Color' || innerPropType1 === 'ColorRGB' || innerPropType1 === 'Vector' || innerPropType1 === 'Vector3D' || innerPropType1.indexOf( 'Lcl_' ) === 0 ) {

					innerPropValue = [ subNode.propertyList[ 4 ], subNode.propertyList[ 5 ], subNode.propertyList[ 6 ] ];

				} else {

					innerPropValue = subNode.propertyList[ 4 ];

				} // this will be copied to parent, see above


				node[ innerPropName ] = {
					'type': innerPropType1,
					'type2': innerPropType2,
					'flag': innerPropFlag,
					'value': innerPropValue
				};

			} else if ( node[ subNode.name ] === undefined ) {

				if ( typeof subNode.id === 'number' ) {

					node[ subNode.name ] = {};
					node[ subNode.name ][ subNode.id ] = subNode;

				} else {

					node[ subNode.name ] = subNode;

				}

			} else {

				if ( subNode.name === 'PoseNode' ) {

					if ( ! Array.isArray( node[ subNode.name ] ) ) {

						node[ subNode.name ] = [ node[ subNode.name ] ];

					}

					node[ subNode.name ].push( subNode );

				} else if ( node[ subNode.name ][ subNode.id ] === undefined ) {

					node[ subNode.name ][ subNode.id ] = subNode;

				}

			}

		}

		parseProperty( reader ) {

			const type = reader.getString( 1 );
			let length;

			switch ( type ) {

				case 'C':
					return reader.getBoolean();

				case 'D':
					return reader.getFloat64();

				case 'F':
					return reader.getFloat32();

				case 'I':
					return reader.getInt32();

				case 'L':
					return reader.getInt64();

				case 'R':
					length = reader.getUint32();
					return reader.getArrayBuffer( length );

				case 'S':
					length = reader.getUint32();
					return reader.getString( length );

				case 'Y':
					return reader.getInt16();

				case 'b':
				case 'c':
				case 'd':
				case 'f':
				case 'i':
				case 'l':
					const arrayLength = reader.getUint32();
					const encoding = reader.getUint32(); // 0: non-compressed, 1: compressed

					const compressedLength = reader.getUint32();

					if ( encoding === 0 ) {

						switch ( type ) {

							case 'b':
							case 'c':
								return reader.getBooleanArray( arrayLength );

							case 'd':
								return reader.getFloat64Array( arrayLength );

							case 'f':
								return reader.getFloat32Array( arrayLength );

							case 'i':
								return reader.getInt32Array( arrayLength );

							case 'l':
								return reader.getInt64Array( arrayLength );

						}

					}

					if ( typeof fflate === 'undefined' ) {

						console.error( 'THREE.FBXLoader: External library fflate.min.js required.' );

					}

					const data = fflate.unzlibSync( new Uint8Array( reader.getArrayBuffer( compressedLength ) ) ); // eslint-disable-line no-undef

					const reader2 = new BinaryReader( data.buffer );

					switch ( type ) {

						case 'b':
						case 'c':
							return reader2.getBooleanArray( arrayLength );

						case 'd':
							return reader2.getFloat64Array( arrayLength );

						case 'f':
							return reader2.getFloat32Array( arrayLength );

						case 'i':
							return reader2.getInt32Array( arrayLength );

						case 'l':
							return reader2.getInt64Array( arrayLength );

					}

				default:
					throw new Error( 'THREE.FBXLoader: Unknown property type ' + type );

			}

		}

	}

	class BinaryReader {

		constructor( buffer, littleEndian ) {

			this.dv = new DataView( buffer );
			this.offset = 0;
			this.littleEndian = littleEndian !== undefined ? littleEndian : true;

		}

		getOffset() {

			return this.offset;

		}

		size() {

			return this.dv.buffer.byteLength;

		}

		skip( length ) {

			this.offset += length;

		} // seems like true/false representation depends on exporter.
		// true: 1 or 'Y'(=0x59), false: 0 or 'T'(=0x54)
		// then sees LSB.


		getBoolean() {

			return ( this.getUint8() & 1 ) === 1;

		}

		getBooleanArray( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getBoolean() );

			}

			return a;

		}

		getUint8() {

			const value = this.dv.getUint8( this.offset );
			this.offset += 1;
			return value;

		}

		getInt16() {

			const value = this.dv.getInt16( this.offset, this.littleEndian );
			this.offset += 2;
			return value;

		}

		getInt32() {

			const value = this.dv.getInt32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getInt32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt32() );

			}

			return a;

		}

		getUint32() {

			const value = this.dv.getUint32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		} // JavaScript doesn't support 64-bit integer so calculate this here
		// 1 << 32 will return 1 so using multiply operation instead here.
		// There's a possibility that this method returns wrong value if the value
		// is out of the range between Number.MAX_SAFE_INTEGER and Number.MIN_SAFE_INTEGER.
		// TODO: safely handle 64-bit integer


		getInt64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			} // calculate negative value


			if ( high & 0x80000000 ) {

				high = ~ high & 0xFFFFFFFF;
				low = ~ low & 0xFFFFFFFF;
				if ( low === 0xFFFFFFFF ) high = high + 1 & 0xFFFFFFFF;
				low = low + 1 & 0xFFFFFFFF;
				return - ( high * 0x100000000 + low );

			}

			return high * 0x100000000 + low;

		}

		getInt64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getInt64() );

			}

			return a;

		} // Note: see getInt64() comment


		getUint64() {

			let low, high;

			if ( this.littleEndian ) {

				low = this.getUint32();
				high = this.getUint32();

			} else {

				high = this.getUint32();
				low = this.getUint32();

			}

			return high * 0x100000000 + low;

		}

		getFloat32() {

			const value = this.dv.getFloat32( this.offset, this.littleEndian );
			this.offset += 4;
			return value;

		}

		getFloat32Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat32() );

			}

			return a;

		}

		getFloat64() {

			const value = this.dv.getFloat64( this.offset, this.littleEndian );
			this.offset += 8;
			return value;

		}

		getFloat64Array( size ) {

			const a = [];

			for ( let i = 0; i < size; i ++ ) {

				a.push( this.getFloat64() );

			}

			return a;

		}

		getArrayBuffer( size ) {

			const value = this.dv.buffer.slice( this.offset, this.offset + size );
			this.offset += size;
			return value;

		}

		getString( size ) {

			// note: safari 9 doesn't support Uint8Array.indexOf; create intermediate array instead
			let a = [];

			for ( let i = 0; i < size; i ++ ) {

				a[ i ] = this.getUint8();

			}

			const nullByte = a.indexOf( 0 );
			if ( nullByte >= 0 ) a = a.slice( 0, nullByte );
			return THREE.LoaderUtils.decodeText( new Uint8Array( a ) );

		}

	} // FBXTree holds a representation of the FBX data, returned by the TextParser ( FBX ASCII format)
	// and BinaryParser( FBX Binary format)


	class FBXTree {

		add( key, val ) {

			this[ key ] = val;

		}

	} // ************** UTILITY FUNCTIONS **************


	function isFbxFormatBinary( buffer ) {

		const CORRECT = 'Kaydara\u0020FBX\u0020Binary\u0020\u0020\0';
		return buffer.byteLength >= CORRECT.length && CORRECT === convertArrayBufferToString( buffer, 0, CORRECT.length );

	}

	function isFbxFormatASCII( text ) {

		const CORRECT = [ 'K', 'a', 'y', 'd', 'a', 'r', 'a', '\\', 'F', 'B', 'X', '\\', 'B', 'i', 'n', 'a', 'r', 'y', '\\', '\\' ];
		let cursor = 0;

		function read( offset ) {

			const result = text[ offset - 1 ];
			text = text.slice( cursor + offset );
			cursor ++;
			return result;

		}

		for ( let i = 0; i < CORRECT.length; ++ i ) {

			const num = read( 1 );

			if ( num === CORRECT[ i ] ) {

				return false;

			}

		}

		return true;

	}

	function getFbxVersion( text ) {

		const versionRegExp = /FBXVersion: (\d+)/;
		const match = text.match( versionRegExp );

		if ( match ) {

			const version = parseInt( match[ 1 ] );
			return version;

		}

		throw new Error( 'THREE.FBXLoader: Cannot find the version number for the file given.' );

	} // Converts FBX ticks into real time seconds.


	function convertFBXTimeToSeconds( time ) {

		return time / 46186158000;

	}

	const dataArray = []; // extracts the data from the correct position in the FBX array based on indexing type

	function getData( polygonVertexIndex, polygonIndex, vertexIndex, infoObject ) {

		let index;

		switch ( infoObject.mappingType ) {

			case 'ByPolygonVertex':
				index = polygonVertexIndex;
				break;

			case 'ByPolygon':
				index = polygonIndex;
				break;

			case 'ByVertice':
				index = vertexIndex;
				break;

			case 'AllSame':
				index = infoObject.indices[ 0 ];
				break;

			default:
				console.warn( 'THREE.FBXLoader: unknown attribute mapping type ' + infoObject.mappingType );

		}

		if ( infoObject.referenceType === 'IndexToDirect' ) index = infoObject.indices[ index ];
		const from = index * infoObject.dataSize;
		const to = from + infoObject.dataSize;
		return slice( dataArray, infoObject.buffer, from, to );

	}

	const tempEuler = new THREE.Euler();
	const tempVec = new THREE.Vector3(); // generate transformation from FBX transform data
	// ref: https://help.autodesk.com/view/FBX/2017/ENU/?guid=__files_GUID_10CDD63C_79C1_4F2D_BB28_AD2BE65A02ED_htm
	// ref: http://docs.autodesk.com/FBX/2014/ENU/FBX-SDK-Documentation/index.html?url=cpp_ref/_transformations_2main_8cxx-example.html,topicNumber=cpp_ref__transformations_2main_8cxx_example_htmlfc10a1e1-b18d-4e72-9dc0-70d0f1959f5e

	function generateTransform( transformData ) {

		const lTranslationM = new THREE.Matrix4();
		const lPreRotationM = new THREE.Matrix4();
		const lRotationM = new THREE.Matrix4();
		const lPostRotationM = new THREE.Matrix4();
		const lScalingM = new THREE.Matrix4();
		const lScalingPivotM = new THREE.Matrix4();
		const lScalingOffsetM = new THREE.Matrix4();
		const lRotationOffsetM = new THREE.Matrix4();
		const lRotationPivotM = new THREE.Matrix4();
		const lParentGX = new THREE.Matrix4();
		const lParentLX = new THREE.Matrix4();
		const lGlobalT = new THREE.Matrix4();
		const inheritType = transformData.inheritType ? transformData.inheritType : 0;
		if ( transformData.translation ) lTranslationM.setPosition( tempVec.fromArray( transformData.translation ) );

		if ( transformData.preRotation ) {

			const array = transformData.preRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPreRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.rotation ) {

			const array = transformData.rotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );

		}

		if ( transformData.postRotation ) {

			const array = transformData.postRotation.map( THREE.MathUtils.degToRad );
			array.push( transformData.eulerOrder );
			lPostRotationM.makeRotationFromEuler( tempEuler.fromArray( array ) );
			lPostRotationM.invert();

		}

		if ( transformData.scale ) lScalingM.scale( tempVec.fromArray( transformData.scale ) ); // Pivots and offsets

		if ( transformData.scalingOffset ) lScalingOffsetM.setPosition( tempVec.fromArray( transformData.scalingOffset ) );
		if ( transformData.scalingPivot ) lScalingPivotM.setPosition( tempVec.fromArray( transformData.scalingPivot ) );
		if ( transformData.rotationOffset ) lRotationOffsetM.setPosition( tempVec.fromArray( transformData.rotationOffset ) );
		if ( transformData.rotationPivot ) lRotationPivotM.setPosition( tempVec.fromArray( transformData.rotationPivot ) ); // parent transform

		if ( transformData.parentMatrixWorld ) {

			lParentLX.copy( transformData.parentMatrix );
			lParentGX.copy( transformData.parentMatrixWorld );

		}

		const lLRM = lPreRotationM.clone().multiply( lRotationM ).multiply( lPostRotationM ); // Global Rotation

		const lParentGRM = new THREE.Matrix4();
		lParentGRM.extractRotation( lParentGX ); // Global Shear*Scaling

		const lParentTM = new THREE.Matrix4();
		lParentTM.copyPosition( lParentGX );
		const lParentGRSM = lParentTM.clone().invert().multiply( lParentGX );
		const lParentGSM = lParentGRM.clone().invert().multiply( lParentGRSM );
		const lLSM = lScalingM;
		const lGlobalRS = new THREE.Matrix4();

		if ( inheritType === 0 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM ).multiply( lLSM );

		} else if ( inheritType === 1 ) {

			lGlobalRS.copy( lParentGRM ).multiply( lParentGSM ).multiply( lLRM ).multiply( lLSM );

		} else {

			const lParentLSM = new THREE.Matrix4().scale( new THREE.Vector3().setFromMatrixScale( lParentLX ) );
			const lParentLSM_inv = lParentLSM.clone().invert();
			const lParentGSM_noLocal = lParentGSM.clone().multiply( lParentLSM_inv );
			lGlobalRS.copy( lParentGRM ).multiply( lLRM ).multiply( lParentGSM_noLocal ).multiply( lLSM );

		}

		const lRotationPivotM_inv = lRotationPivotM.clone().invert();
		const lScalingPivotM_inv = lScalingPivotM.clone().invert(); // Calculate the local transform matrix

		let lTransform = lTranslationM.clone().multiply( lRotationOffsetM ).multiply( lRotationPivotM ).multiply( lPreRotationM ).multiply( lRotationM ).multiply( lPostRotationM ).multiply( lRotationPivotM_inv ).multiply( lScalingOffsetM ).multiply( lScalingPivotM ).multiply( lScalingM ).multiply( lScalingPivotM_inv );
		const lLocalTWithAllPivotAndOffsetInfo = new THREE.Matrix4().copyPosition( lTransform );
		const lGlobalTranslation = lParentGX.clone().multiply( lLocalTWithAllPivotAndOffsetInfo );
		lGlobalT.copyPosition( lGlobalTranslation );
		lTransform = lGlobalT.clone().multiply( lGlobalRS ); // from global to local

		lTransform.premultiply( lParentGX.invert() );
		return lTransform;

	} // Returns the three.js intrinsic THREE.Euler order corresponding to FBX extrinsic THREE.Euler order
	// ref: http://help.autodesk.com/view/FBX/2017/ENU/?guid=__cpp_ref_class_fbx_euler_html


	function getEulerOrder( order ) {

		order = order || 0;
		const enums = [ 'ZYX', // -> XYZ extrinsic
			'YZX', // -> XZY extrinsic
			'XZY', // -> YZX extrinsic
			'ZXY', // -> YXZ extrinsic
			'YXZ', // -> ZXY extrinsic
			'XYZ' // -> ZYX extrinsic
			//'SphericXYZ', // not possible to support
		];

		if ( order === 6 ) {

			console.warn( 'THREE.FBXLoader: unsupported THREE.Euler Order: Spherical XYZ. Animations and rotations may be incorrect.' );
			return enums[ 0 ];

		}

		return enums[ order ];

	} // Parses comma separated list of numbers and returns them an array.
	// Used internally by the TextParser


	function parseNumberArray( value ) {

		const array = value.split( ',' ).map( function ( val ) {

			return parseFloat( val );

		} );
		return array;

	}

	function convertArrayBufferToString( buffer, from, to ) {

		if ( from === undefined ) from = 0;
		if ( to === undefined ) to = buffer.byteLength;
		return THREE.LoaderUtils.decodeText( new Uint8Array( buffer, from, to ) );

	}

	function append( a, b ) {

		for ( let i = 0, j = a.length, l = b.length; i < l; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

	}

	function slice( a, b, from, to ) {

		for ( let i = from, j = 0; i < to; i ++, j ++ ) {

			a[ j ] = b[ i ];

		}

		return a;

	} // inject array a2 into array a1 at index


	function inject( a1, index, a2 ) {

		return a1.slice( 0, index ).concat( a2 ).concat( a1.slice( index ) );

	}

	THREE.FBXLoader = FBXLoader;

} )();
( function () {

	class GLTFLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.dracoLoader = null;
			this.ktx2Loader = null;
			this.meshoptDecoder = null;
			this.pluginCallbacks = [];
			this.register( function ( parser ) {

				return new GLTFMaterialsClearcoatExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureBasisUExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFTextureWebPExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsSheenExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsTransmissionExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsVolumeExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsIorExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsEmissiveStrengthExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMaterialsSpecularExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFLightsExtension( parser );

			} );
			this.register( function ( parser ) {

				return new GLTFMeshoptCompression( parser );

			} );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			let resourcePath;

			if ( this.resourcePath !== '' ) {

				resourcePath = this.resourcePath;

			} else if ( this.path !== '' ) {

				resourcePath = this.path;

			} else {

				resourcePath = THREE.LoaderUtils.extractUrlBase( url );

			} // Tells the LoadingManager to track an extra item, which resolves after
			// the model is fully loaded. This means the count of items loaded will
			// be incorrect, but ensures manager.onLoad() does not fire early.


			this.manager.itemStart( url );

			const _onError = function ( e ) {

				if ( onError ) {

					onError( e );

				} else {

					console.error( e );

				}

				scope.manager.itemError( url );
				scope.manager.itemEnd( url );

			};

			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( data ) {

				try {

					scope.parse( data, resourcePath, function ( gltf ) {

						onLoad( gltf );
						scope.manager.itemEnd( url );

					}, _onError );

				} catch ( e ) {

					_onError( e );

				}

			}, onProgress, _onError );

		}

		setDRACOLoader( dracoLoader ) {

			this.dracoLoader = dracoLoader;
			return this;

		}

		setDDSLoader() {

			throw new Error( 'THREE.GLTFLoader: "MSFT_texture_dds" no longer supported. Please update to "KHR_texture_basisu".' );

		}

		setKTX2Loader( ktx2Loader ) {

			this.ktx2Loader = ktx2Loader;
			return this;

		}

		setMeshoptDecoder( meshoptDecoder ) {

			this.meshoptDecoder = meshoptDecoder;
			return this;

		}

		register( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) === - 1 ) {

				this.pluginCallbacks.push( callback );

			}

			return this;

		}

		unregister( callback ) {

			if ( this.pluginCallbacks.indexOf( callback ) !== - 1 ) {

				this.pluginCallbacks.splice( this.pluginCallbacks.indexOf( callback ), 1 );

			}

			return this;

		}

		parse( data, path, onLoad, onError ) {

			let content;
			const extensions = {};
			const plugins = {};

			if ( typeof data === 'string' ) {

				content = data;

			} else {

				const magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

				if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

					try {

						extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

					} catch ( error ) {

						if ( onError ) onError( error );
						return;

					}

					content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

				} else {

					content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

				}

			}

			const json = JSON.parse( content );

			if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

				if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.' ) );
				return;

			}

			const parser = new GLTFParser( json, {
				path: path || this.resourcePath || '',
				crossOrigin: this.crossOrigin,
				requestHeader: this.requestHeader,
				manager: this.manager,
				ktx2Loader: this.ktx2Loader,
				meshoptDecoder: this.meshoptDecoder
			} );
			parser.fileLoader.setRequestHeader( this.requestHeader );

			for ( let i = 0; i < this.pluginCallbacks.length; i ++ ) {

				const plugin = this.pluginCallbacks[ i ]( parser );
				plugins[ plugin.name ] = plugin; // Workaround to avoid determining as unknown extension
				// in addUnknownExtensionsToUserData().
				// Remove this workaround if we move all the existing
				// extension handlers to plugin system

				extensions[ plugin.name ] = true;

			}

			if ( json.extensionsUsed ) {

				for ( let i = 0; i < json.extensionsUsed.length; ++ i ) {

					const extensionName = json.extensionsUsed[ i ];
					const extensionsRequired = json.extensionsRequired || [];

					switch ( extensionName ) {

						case EXTENSIONS.KHR_MATERIALS_UNLIT:
							extensions[ extensionName ] = new GLTFMaterialsUnlitExtension();
							break;

						case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
							extensions[ extensionName ] = new GLTFMaterialsPbrSpecularGlossinessExtension();
							break;

						case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
							extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
							break;

						case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
							extensions[ extensionName ] = new GLTFTextureTransformExtension();
							break;

						case EXTENSIONS.KHR_MESH_QUANTIZATION:
							extensions[ extensionName ] = new GLTFMeshQuantizationExtension();
							break;

						default:
							if ( extensionsRequired.indexOf( extensionName ) >= 0 && plugins[ extensionName ] === undefined ) {

								console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

							}

					}

				}

			}

			parser.setExtensions( extensions );
			parser.setPlugins( plugins );
			parser.parse( onLoad, onError );

		}

		parseAsync( data, path ) {

			const scope = this;
			return new Promise( function ( resolve, reject ) {

				scope.parse( data, path, resolve, reject );

			} );

		}

	}
	/* GLTFREGISTRY */


	function GLTFRegistry() {

		let objects = {};
		return {
			get: function ( key ) {

				return objects[ key ];

			},
			add: function ( key, object ) {

				objects[ key ] = object;

			},
			remove: function ( key ) {

				delete objects[ key ];

			},
			removeAll: function () {

				objects = {};

			}
		};

	}
	/*********************************/

	/********** EXTENSIONS ***********/

	/*********************************/


	const EXTENSIONS = {
		KHR_BINARY_GLTF: 'KHR_binary_glTF',
		KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
		KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
		KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
		KHR_MATERIALS_IOR: 'KHR_materials_ior',
		KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
		KHR_MATERIALS_SHEEN: 'KHR_materials_sheen',
		KHR_MATERIALS_SPECULAR: 'KHR_materials_specular',
		KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
		KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
		KHR_MATERIALS_VOLUME: 'KHR_materials_volume',
		KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
		KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
		KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
		KHR_MATERIALS_EMISSIVE_STRENGTH: 'KHR_materials_emissive_strength',
		EXT_TEXTURE_WEBP: 'EXT_texture_webp',
		EXT_MESHOPT_COMPRESSION: 'EXT_meshopt_compression'
	};
	/**
 * Punctual Lights Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
 */

	class GLTFLightsExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL; // THREE.Object3D instance caches

			this.cache = {
				refs: {},
				uses: {}
			};

		}

		_markDefs() {

			const parser = this.parser;
			const nodeDefs = this.parser.json.nodes || [];

			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.extensions && nodeDef.extensions[ this.name ] && nodeDef.extensions[ this.name ].light !== undefined ) {

					parser._addNodeRef( this.cache, nodeDef.extensions[ this.name ].light );

				}

			}

		}

		_loadLight( lightIndex ) {

			const parser = this.parser;
			const cacheKey = 'light:' + lightIndex;
			let dependency = parser.cache.get( cacheKey );
			if ( dependency ) return dependency;
			const json = parser.json;
			const extensions = json.extensions && json.extensions[ this.name ] || {};
			const lightDefs = extensions.lights || [];
			const lightDef = lightDefs[ lightIndex ];
			let lightNode;
			const color = new THREE.Color( 0xffffff );
			if ( lightDef.color !== undefined ) color.fromArray( lightDef.color );
			const range = lightDef.range !== undefined ? lightDef.range : 0;

			switch ( lightDef.type ) {

				case 'directional':
					lightNode = new THREE.DirectionalLight( color );
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				case 'point':
					lightNode = new THREE.PointLight( color );
					lightNode.distance = range;
					break;

				case 'spot':
					lightNode = new THREE.SpotLight( color );
					lightNode.distance = range; // Handle spotlight properties.

					lightDef.spot = lightDef.spot || {};
					lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
					lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
					lightNode.angle = lightDef.spot.outerConeAngle;
					lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
					lightNode.target.position.set( 0, 0, - 1 );
					lightNode.add( lightNode.target );
					break;

				default:
					throw new Error( 'THREE.GLTFLoader: Unexpected light type: ' + lightDef.type );

			} // Some lights (e.g. spot) default to a position other than the origin. Reset the position
			// here, because node-level parsing will only override position if explicitly specified.


			lightNode.position.set( 0, 0, 0 );
			lightNode.decay = 2;
			if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;
			lightNode.name = parser.createUniqueName( lightDef.name || 'light_' + lightIndex );
			dependency = Promise.resolve( lightNode );
			parser.cache.add( cacheKey, dependency );
			return dependency;

		}

		createNodeAttachment( nodeIndex ) {

			const self = this;
			const parser = this.parser;
			const json = parser.json;
			const nodeDef = json.nodes[ nodeIndex ];
			const lightDef = nodeDef.extensions && nodeDef.extensions[ this.name ] || {};
			const lightIndex = lightDef.light;
			if ( lightIndex === undefined ) return null;
			return this._loadLight( lightIndex ).then( function ( light ) {

				return parser._getNodeRef( self.cache, lightIndex, light );

			} );

		}

	}
	/**
 * Unlit Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 */


	class GLTFMaterialsUnlitExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

		}

		getMaterialType() {

			return THREE.MeshBasicMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pending = [];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const metallicRoughness = materialDef.pbrMetallicRoughness;

			if ( metallicRoughness ) {

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture, THREE.sRGBEncoding ) );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
 * Materials Emissive Strength Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/blob/5768b3ce0ef32bc39cdf1bef10b948586635ead3/extensions/2.0/Khronos/KHR_materials_emissive_strength/README.md
 */


	class GLTFMaterialsEmissiveStrengthExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_EMISSIVE_STRENGTH;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const emissiveStrength = materialDef.extensions[ this.name ].emissiveStrength;

			if ( emissiveStrength !== undefined ) {

				materialParams.emissiveIntensity = emissiveStrength;

			}

			return Promise.resolve();

		}

	}
	/**
 * Clearcoat Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
 */


	class GLTFMaterialsClearcoatExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.clearcoatFactor !== undefined ) {

				materialParams.clearcoat = extension.clearcoatFactor;

			}

			if ( extension.clearcoatTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatMap', extension.clearcoatTexture ) );

			}

			if ( extension.clearcoatRoughnessFactor !== undefined ) {

				materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor;

			}

			if ( extension.clearcoatRoughnessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatRoughnessMap', extension.clearcoatRoughnessTexture ) );

			}

			if ( extension.clearcoatNormalTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'clearcoatNormalMap', extension.clearcoatNormalTexture ) );

				if ( extension.clearcoatNormalTexture.scale !== undefined ) {

					const scale = extension.clearcoatNormalTexture.scale;
					materialParams.clearcoatNormalScale = new THREE.Vector2( scale, scale );

				}

			}

			return Promise.all( pending );

		}

	}
	/**
 * Sheen Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Khronos/KHR_materials_sheen
 */


	class GLTFMaterialsSheenExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_SHEEN;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			materialParams.sheenColor = new THREE.Color( 0, 0, 0 );
			materialParams.sheenRoughness = 0;
			materialParams.sheen = 1;
			const extension = materialDef.extensions[ this.name ];

			if ( extension.sheenColorFactor !== undefined ) {

				materialParams.sheenColor.fromArray( extension.sheenColorFactor );

			}

			if ( extension.sheenRoughnessFactor !== undefined ) {

				materialParams.sheenRoughness = extension.sheenRoughnessFactor;

			}

			if ( extension.sheenColorTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'sheenColorMap', extension.sheenColorTexture, THREE.sRGBEncoding ) );

			}

			if ( extension.sheenRoughnessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'sheenRoughnessMap', extension.sheenRoughnessTexture ) );

			}

			return Promise.all( pending );

		}

	}
	/**
 * Transmission Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 * Draft: https://github.com/KhronosGroup/glTF/pull/1698
 */


	class GLTFMaterialsTransmissionExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];

			if ( extension.transmissionFactor !== undefined ) {

				materialParams.transmission = extension.transmissionFactor;

			}

			if ( extension.transmissionTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'transmissionMap', extension.transmissionTexture ) );

			}

			return Promise.all( pending );

		}

	}
	/**
 * Materials Volume Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_volume
 */


	class GLTFMaterialsVolumeExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_VOLUME;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];
			materialParams.thickness = extension.thicknessFactor !== undefined ? extension.thicknessFactor : 0;

			if ( extension.thicknessTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'thicknessMap', extension.thicknessTexture ) );

			}

			materialParams.attenuationDistance = extension.attenuationDistance || 0;
			const colorArray = extension.attenuationColor || [ 1, 1, 1 ];
			materialParams.attenuationColor = new THREE.Color( colorArray[ 0 ], colorArray[ 1 ], colorArray[ 2 ] );
			return Promise.all( pending );

		}

	}
	/**
 * Materials ior Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_ior
 */


	class GLTFMaterialsIorExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_IOR;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const extension = materialDef.extensions[ this.name ];
			materialParams.ior = extension.ior !== undefined ? extension.ior : 1.5;
			return Promise.resolve();

		}

	}
	/**
 * Materials specular Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_specular
 */


	class GLTFMaterialsSpecularExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_MATERIALS_SPECULAR;

		}

		getMaterialType( materialIndex ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];
			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) return null;
			return THREE.MeshPhysicalMaterial;

		}

		extendMaterialParams( materialIndex, materialParams ) {

			const parser = this.parser;
			const materialDef = parser.json.materials[ materialIndex ];

			if ( ! materialDef.extensions || ! materialDef.extensions[ this.name ] ) {

				return Promise.resolve();

			}

			const pending = [];
			const extension = materialDef.extensions[ this.name ];
			materialParams.specularIntensity = extension.specularFactor !== undefined ? extension.specularFactor : 1.0;

			if ( extension.specularTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'specularIntensityMap', extension.specularTexture ) );

			}

			const colorArray = extension.specularColorFactor || [ 1, 1, 1 ];
			materialParams.specularColor = new THREE.Color( colorArray[ 0 ], colorArray[ 1 ], colorArray[ 2 ] );

			if ( extension.specularColorTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'specularColorMap', extension.specularColorTexture, THREE.sRGBEncoding ) );

			}

			return Promise.all( pending );

		}

	}
	/**
 * BasisU THREE.Texture Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
 */


	class GLTFTextureBasisUExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.KHR_TEXTURE_BASISU;

		}

		loadTexture( textureIndex ) {

			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ this.name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ this.name ];
			const loader = parser.options.ktx2Loader;

			if ( ! loader ) {

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: setKTX2Loader must be called before loading KTX2 textures' );

				} else {

					// Assumes that the extension is optional and that a fallback texture is present
					return null;

				}

			}

			return parser.loadTextureImage( textureIndex, extension.source, loader );

		}

	}
	/**
 * WebP THREE.Texture Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_texture_webp
 */


	class GLTFTextureWebPExtension {

		constructor( parser ) {

			this.parser = parser;
			this.name = EXTENSIONS.EXT_TEXTURE_WEBP;
			this.isSupported = null;

		}

		loadTexture( textureIndex ) {

			const name = this.name;
			const parser = this.parser;
			const json = parser.json;
			const textureDef = json.textures[ textureIndex ];

			if ( ! textureDef.extensions || ! textureDef.extensions[ name ] ) {

				return null;

			}

			const extension = textureDef.extensions[ name ];
			const source = json.images[ extension.source ];
			let loader = parser.textureLoader;

			if ( source.uri ) {

				const handler = parser.options.manager.getHandler( source.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.detectSupport().then( function ( isSupported ) {

				if ( isSupported ) return parser.loadTextureImage( textureIndex, extension.source, loader );

				if ( json.extensionsRequired && json.extensionsRequired.indexOf( name ) >= 0 ) {

					throw new Error( 'THREE.GLTFLoader: WebP required by asset but unsupported.' );

				} // Fall back to PNG or JPEG.


				return parser.loadTexture( textureIndex );

			} );

		}

		detectSupport() {

			if ( ! this.isSupported ) {

				this.isSupported = new Promise( function ( resolve ) {

					const image = new Image(); // Lossy test image. Support for lossy images doesn't guarantee support for all
					// WebP images, unfortunately.

					image.src = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA';

					image.onload = image.onerror = function () {

						resolve( image.height === 1 );

					};

				} );

			}

			return this.isSupported;

		}

	}
	/**
 * meshopt BufferView Compression Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_meshopt_compression
 */


	class GLTFMeshoptCompression {

		constructor( parser ) {

			this.name = EXTENSIONS.EXT_MESHOPT_COMPRESSION;
			this.parser = parser;

		}

		loadBufferView( index ) {

			const json = this.parser.json;
			const bufferView = json.bufferViews[ index ];

			if ( bufferView.extensions && bufferView.extensions[ this.name ] ) {

				const extensionDef = bufferView.extensions[ this.name ];
				const buffer = this.parser.getDependency( 'buffer', extensionDef.buffer );
				const decoder = this.parser.options.meshoptDecoder;

				if ( ! decoder || ! decoder.supported ) {

					if ( json.extensionsRequired && json.extensionsRequired.indexOf( this.name ) >= 0 ) {

						throw new Error( 'THREE.GLTFLoader: setMeshoptDecoder must be called before loading compressed files' );

					} else {

						// Assumes that the extension is optional and that fallback buffer data is present
						return null;

					}

				}

				return Promise.all( [ buffer, decoder.ready ] ).then( function ( res ) {

					const byteOffset = extensionDef.byteOffset || 0;
					const byteLength = extensionDef.byteLength || 0;
					const count = extensionDef.count;
					const stride = extensionDef.byteStride;
					const result = new ArrayBuffer( count * stride );
					const source = new Uint8Array( res[ 0 ], byteOffset, byteLength );
					decoder.decodeGltfBuffer( new Uint8Array( result ), count, stride, source, extensionDef.mode, extensionDef.filter );
					return result;

				} );

			} else {

				return null;

			}

		}

	}
	/* BINARY EXTENSION */


	const BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
	const BINARY_EXTENSION_HEADER_LENGTH = 12;
	const BINARY_EXTENSION_CHUNK_TYPES = {
		JSON: 0x4E4F534A,
		BIN: 0x004E4942
	};

	class GLTFBinaryExtension {

		constructor( data ) {

			this.name = EXTENSIONS.KHR_BINARY_GLTF;
			this.content = null;
			this.body = null;
			const headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );
			this.header = {
				magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
				version: headerView.getUint32( 4, true ),
				length: headerView.getUint32( 8, true )
			};

			if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

				throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

			} else if ( this.header.version < 2.0 ) {

				throw new Error( 'THREE.GLTFLoader: Legacy binary file detected.' );

			}

			const chunkContentsLength = this.header.length - BINARY_EXTENSION_HEADER_LENGTH;
			const chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
			let chunkIndex = 0;

			while ( chunkIndex < chunkContentsLength ) {

				const chunkLength = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;
				const chunkType = chunkView.getUint32( chunkIndex, true );
				chunkIndex += 4;

				if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

					const contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
					this.content = THREE.LoaderUtils.decodeText( contentArray );

				} else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

					const byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
					this.body = data.slice( byteOffset, byteOffset + chunkLength );

				} // Clients must ignore chunks with unknown types.


				chunkIndex += chunkLength;

			}

			if ( this.content === null ) {

				throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

			}

		}

	}
	/**
 * DRACO THREE.Mesh Compression Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 */


	class GLTFDracoMeshCompressionExtension {

		constructor( json, dracoLoader ) {

			if ( ! dracoLoader ) {

				throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

			}

			this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
			this.json = json;
			this.dracoLoader = dracoLoader;
			this.dracoLoader.preload();

		}

		decodePrimitive( primitive, parser ) {

			const json = this.json;
			const dracoLoader = this.dracoLoader;
			const bufferViewIndex = primitive.extensions[ this.name ].bufferView;
			const gltfAttributeMap = primitive.extensions[ this.name ].attributes;
			const threeAttributeMap = {};
			const attributeNormalizedMap = {};
			const attributeTypeMap = {};

			for ( const attributeName in gltfAttributeMap ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();
				threeAttributeMap[ threeAttributeName ] = gltfAttributeMap[ attributeName ];

			}

			for ( const attributeName in primitive.attributes ) {

				const threeAttributeName = ATTRIBUTES[ attributeName ] || attributeName.toLowerCase();

				if ( gltfAttributeMap[ attributeName ] !== undefined ) {

					const accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
					const componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];
					attributeTypeMap[ threeAttributeName ] = componentType;
					attributeNormalizedMap[ threeAttributeName ] = accessorDef.normalized === true;

				}

			}

			return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

				return new Promise( function ( resolve ) {

					dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

						for ( const attributeName in geometry.attributes ) {

							const attribute = geometry.attributes[ attributeName ];
							const normalized = attributeNormalizedMap[ attributeName ];
							if ( normalized !== undefined ) attribute.normalized = normalized;

						}

						resolve( geometry );

					}, threeAttributeMap, attributeTypeMap );

				} );

			} );

		}

	}
	/**
 * THREE.Texture Transform Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
 */


	class GLTFTextureTransformExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM;

		}

		extendTexture( texture, transform ) {

			if ( transform.texCoord !== undefined ) {

				console.warn( 'THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.' );

			}

			if ( transform.offset === undefined && transform.rotation === undefined && transform.scale === undefined ) {

				// See https://github.com/mrdoob/three.js/issues/21819.
				return texture;

			}

			texture = texture.clone();

			if ( transform.offset !== undefined ) {

				texture.offset.fromArray( transform.offset );

			}

			if ( transform.rotation !== undefined ) {

				texture.rotation = transform.rotation;

			}

			if ( transform.scale !== undefined ) {

				texture.repeat.fromArray( transform.scale );

			}

			texture.needsUpdate = true;
			return texture;

		}

	}
	/**
 * Specular-Glossiness Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness
 */

	/**
 * A sub class of StandardMaterial with some of the functionality
 * changed via the `onBeforeCompile` callback
 * @pailhead
 */


	class GLTFMeshStandardSGMaterial extends THREE.MeshStandardMaterial {

		constructor( params ) {

			super();
			this.isGLTFSpecularGlossinessMaterial = true; //various chunks that need replacing

			const specularMapParsFragmentChunk = [ '#ifdef USE_SPECULARMAP', '	uniform sampler2D specularMap;', '#endif' ].join( '\n' );
			const glossinessMapParsFragmentChunk = [ '#ifdef USE_GLOSSINESSMAP', '	uniform sampler2D glossinessMap;', '#endif' ].join( '\n' );
			const specularMapFragmentChunk = [ 'vec3 specularFactor = specular;', '#ifdef USE_SPECULARMAP', '	vec4 texelSpecular = texture2D( specularMap, vUv );', '	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture', '	specularFactor *= texelSpecular.rgb;', '#endif' ].join( '\n' );
			const glossinessMapFragmentChunk = [ 'float glossinessFactor = glossiness;', '#ifdef USE_GLOSSINESSMAP', '	vec4 texelGlossiness = texture2D( glossinessMap, vUv );', '	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture', '	glossinessFactor *= texelGlossiness.a;', '#endif' ].join( '\n' );
			const lightPhysicalFragmentChunk = [ 'PhysicalMaterial material;', 'material.diffuseColor = diffuseColor.rgb * ( 1. - max( specularFactor.r, max( specularFactor.g, specularFactor.b ) ) );', 'vec3 dxy = max( abs( dFdx( geometryNormal ) ), abs( dFdy( geometryNormal ) ) );', 'float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );', 'material.roughness = max( 1.0 - glossinessFactor, 0.0525 ); // 0.0525 corresponds to the base mip of a 256 cubemap.', 'material.roughness += geometryRoughness;', 'material.roughness = min( material.roughness, 1.0 );', 'material.specularColor = specularFactor;' ].join( '\n' );
			const uniforms = {
				specular: {
					value: new THREE.Color().setHex( 0xffffff )
				},
				glossiness: {
					value: 1
				},
				specularMap: {
					value: null
				},
				glossinessMap: {
					value: null
				}
			};
			this._extraUniforms = uniforms;

			this.onBeforeCompile = function ( shader ) {

				for ( const uniformName in uniforms ) {

					shader.uniforms[ uniformName ] = uniforms[ uniformName ];

				}

				shader.fragmentShader = shader.fragmentShader.replace( 'uniform float roughness;', 'uniform vec3 specular;' ).replace( 'uniform float metalness;', 'uniform float glossiness;' ).replace( '#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk ).replace( '#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk ).replace( '#include <roughnessmap_fragment>', specularMapFragmentChunk ).replace( '#include <metalnessmap_fragment>', glossinessMapFragmentChunk ).replace( '#include <lights_physical_fragment>', lightPhysicalFragmentChunk );

			};

			Object.defineProperties( this, {
				specular: {
					get: function () {

						return uniforms.specular.value;

					},
					set: function ( v ) {

						uniforms.specular.value = v;

					}
				},
				specularMap: {
					get: function () {

						return uniforms.specularMap.value;

					},
					set: function ( v ) {

						uniforms.specularMap.value = v;

						if ( v ) {

							this.defines.USE_SPECULARMAP = ''; // USE_UV is set by the renderer for specular maps

						} else {

							delete this.defines.USE_SPECULARMAP;

						}

					}
				},
				glossiness: {
					get: function () {

						return uniforms.glossiness.value;

					},
					set: function ( v ) {

						uniforms.glossiness.value = v;

					}
				},
				glossinessMap: {
					get: function () {

						return uniforms.glossinessMap.value;

					},
					set: function ( v ) {

						uniforms.glossinessMap.value = v;

						if ( v ) {

							this.defines.USE_GLOSSINESSMAP = '';
							this.defines.USE_UV = '';

						} else {

							delete this.defines.USE_GLOSSINESSMAP;
							delete this.defines.USE_UV;

						}

					}
				}
			} );
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			this.setValues( params );

		}

		copy( source ) {

			super.copy( source );
			this.specularMap = source.specularMap;
			this.specular.copy( source.specular );
			this.glossinessMap = source.glossinessMap;
			this.glossiness = source.glossiness;
			delete this.metalness;
			delete this.roughness;
			delete this.metalnessMap;
			delete this.roughnessMap;
			return this;

		}

	}

	class GLTFMaterialsPbrSpecularGlossinessExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS;
			this.specularGlossinessParams = [ 'color', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'bumpMap', 'bumpScale', 'normalMap', 'normalMapType', 'displacementMap', 'displacementScale', 'displacementBias', 'specularMap', 'specular', 'glossinessMap', 'glossiness', 'alphaMap', 'envMap', 'envMapIntensity' ];

		}

		getMaterialType() {

			return GLTFMeshStandardSGMaterial;

		}

		extendParams( materialParams, materialDef, parser ) {

			const pbrSpecularGlossiness = materialDef.extensions[ this.name ];
			materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
			materialParams.opacity = 1.0;
			const pending = [];

			if ( Array.isArray( pbrSpecularGlossiness.diffuseFactor ) ) {

				const array = pbrSpecularGlossiness.diffuseFactor;
				materialParams.color.fromArray( array );
				materialParams.opacity = array[ 3 ];

			}

			if ( pbrSpecularGlossiness.diffuseTexture !== undefined ) {

				pending.push( parser.assignTexture( materialParams, 'map', pbrSpecularGlossiness.diffuseTexture, THREE.sRGBEncoding ) );

			}

			materialParams.emissive = new THREE.Color( 0.0, 0.0, 0.0 );
			materialParams.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
			materialParams.specular = new THREE.Color( 1.0, 1.0, 1.0 );

			if ( Array.isArray( pbrSpecularGlossiness.specularFactor ) ) {

				materialParams.specular.fromArray( pbrSpecularGlossiness.specularFactor );

			}

			if ( pbrSpecularGlossiness.specularGlossinessTexture !== undefined ) {

				const specGlossMapDef = pbrSpecularGlossiness.specularGlossinessTexture;
				pending.push( parser.assignTexture( materialParams, 'glossinessMap', specGlossMapDef ) );
				pending.push( parser.assignTexture( materialParams, 'specularMap', specGlossMapDef, THREE.sRGBEncoding ) );

			}

			return Promise.all( pending );

		}

		createMaterial( materialParams ) {

			const material = new GLTFMeshStandardSGMaterial( materialParams );
			material.fog = true;
			material.color = materialParams.color;
			material.map = materialParams.map === undefined ? null : materialParams.map;
			material.lightMap = null;
			material.lightMapIntensity = 1.0;
			material.aoMap = materialParams.aoMap === undefined ? null : materialParams.aoMap;
			material.aoMapIntensity = 1.0;
			material.emissive = materialParams.emissive;
			material.emissiveIntensity = materialParams.emissiveIntensity === undefined ? 1.0 : materialParams.emissiveIntensity;
			material.emissiveMap = materialParams.emissiveMap === undefined ? null : materialParams.emissiveMap;
			material.bumpMap = materialParams.bumpMap === undefined ? null : materialParams.bumpMap;
			material.bumpScale = 1;
			material.normalMap = materialParams.normalMap === undefined ? null : materialParams.normalMap;
			material.normalMapType = THREE.TangentSpaceNormalMap;
			if ( materialParams.normalScale ) material.normalScale = materialParams.normalScale;
			material.displacementMap = null;
			material.displacementScale = 1;
			material.displacementBias = 0;
			material.specularMap = materialParams.specularMap === undefined ? null : materialParams.specularMap;
			material.specular = materialParams.specular;
			material.glossinessMap = materialParams.glossinessMap === undefined ? null : materialParams.glossinessMap;
			material.glossiness = materialParams.glossiness;
			material.alphaMap = null;
			material.envMap = materialParams.envMap === undefined ? null : materialParams.envMap;
			material.envMapIntensity = 1.0;
			return material;

		}

	}
	/**
 * THREE.Mesh Quantization Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
 */


	class GLTFMeshQuantizationExtension {

		constructor() {

			this.name = EXTENSIONS.KHR_MESH_QUANTIZATION;

		}

	}
	/*********************************/

	/********** INTERPOLATION ********/

	/*********************************/
	// Spline Interpolation
	// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation


	class GLTFCubicSplineInterpolant extends THREE.Interpolant {

		constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

			super( parameterPositions, sampleValues, sampleSize, resultBuffer );

		}

		copySampleValue_( index ) {

			// Copies a sample value to the result buffer. See description of glTF
			// CUBICSPLINE values layout in interpolate_() function below.
			const result = this.resultBuffer,
				values = this.sampleValues,
				valueSize = this.valueSize,
				offset = index * valueSize * 3 + valueSize;

			for ( let i = 0; i !== valueSize; i ++ ) {

				result[ i ] = values[ offset + i ];

			}

			return result;

		}

	}

	GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;
	GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

	GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

		const result = this.resultBuffer;
		const values = this.sampleValues;
		const stride = this.valueSize;
		const stride2 = stride * 2;
		const stride3 = stride * 3;
		const td = t1 - t0;
		const p = ( t - t0 ) / td;
		const pp = p * p;
		const ppp = pp * p;
		const offset1 = i1 * stride3;
		const offset0 = offset1 - stride3;
		const s2 = - 2 * ppp + 3 * pp;
		const s3 = ppp - pp;
		const s0 = 1 - s2;
		const s1 = s3 - pp + p; // Layout of keyframe output values for CUBICSPLINE animations:
		//   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]

		for ( let i = 0; i !== stride; i ++ ) {

			const p0 = values[ offset0 + i + stride ]; // splineVertex_k

			const m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)

			const p1 = values[ offset1 + i + stride ]; // splineVertex_k+1

			const m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

			result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

		}

		return result;

	};

	const _q = new THREE.Quaternion();

	class GLTFCubicSplineQuaternionInterpolant extends GLTFCubicSplineInterpolant {

		interpolate_( i1, t0, t, t1 ) {

			const result = super.interpolate_( i1, t0, t, t1 );

			_q.fromArray( result ).normalize().toArray( result );

			return result;

		}

	}
	/*********************************/

	/********** INTERNALS ************/

	/*********************************/

	/* CONSTANTS */


	const WEBGL_CONSTANTS = {
		FLOAT: 5126,
		//FLOAT_MAT2: 35674,
		FLOAT_MAT3: 35675,
		FLOAT_MAT4: 35676,
		FLOAT_VEC2: 35664,
		FLOAT_VEC3: 35665,
		FLOAT_VEC4: 35666,
		LINEAR: 9729,
		REPEAT: 10497,
		SAMPLER_2D: 35678,
		POINTS: 0,
		LINES: 1,
		LINE_LOOP: 2,
		LINE_STRIP: 3,
		TRIANGLES: 4,
		TRIANGLE_STRIP: 5,
		TRIANGLE_FAN: 6,
		UNSIGNED_BYTE: 5121,
		UNSIGNED_SHORT: 5123
	};
	const WEBGL_COMPONENT_TYPES = {
		5120: Int8Array,
		5121: Uint8Array,
		5122: Int16Array,
		5123: Uint16Array,
		5125: Uint32Array,
		5126: Float32Array
	};
	const WEBGL_FILTERS = {
		9728: THREE.NearestFilter,
		9729: THREE.LinearFilter,
		9984: THREE.NearestMipmapNearestFilter,
		9985: THREE.LinearMipmapNearestFilter,
		9986: THREE.NearestMipmapLinearFilter,
		9987: THREE.LinearMipmapLinearFilter
	};
	const WEBGL_WRAPPINGS = {
		33071: THREE.ClampToEdgeWrapping,
		33648: THREE.MirroredRepeatWrapping,
		10497: THREE.RepeatWrapping
	};
	const WEBGL_TYPE_SIZES = {
		'SCALAR': 1,
		'VEC2': 2,
		'VEC3': 3,
		'VEC4': 4,
		'MAT2': 4,
		'MAT3': 9,
		'MAT4': 16
	};
	const ATTRIBUTES = {
		POSITION: 'position',
		NORMAL: 'normal',
		TANGENT: 'tangent',
		TEXCOORD_0: 'uv',
		TEXCOORD_1: 'uv2',
		COLOR_0: 'color',
		WEIGHTS_0: 'skinWeight',
		JOINTS_0: 'skinIndex'
	};
	const PATH_PROPERTIES = {
		scale: 'scale',
		translation: 'position',
		rotation: 'quaternion',
		weights: 'morphTargetInfluences'
	};
	const INTERPOLATION = {
		CUBICSPLINE: undefined,
		// We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
		// keyframe track will be initialized with a default interpolation type, then modified.
		LINEAR: THREE.InterpolateLinear,
		STEP: THREE.InterpolateDiscrete
	};
	const ALPHA_MODES = {
		OPAQUE: 'OPAQUE',
		MASK: 'MASK',
		BLEND: 'BLEND'
	};
	/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
 */

	function createDefaultMaterial( cache ) {

		if ( cache[ 'DefaultMaterial' ] === undefined ) {

			cache[ 'DefaultMaterial' ] = new THREE.MeshStandardMaterial( {
				color: 0xFFFFFF,
				emissive: 0x000000,
				metalness: 1,
				roughness: 1,
				transparent: false,
				depthTest: true,
				side: THREE.FrontSide
			} );

		}

		return cache[ 'DefaultMaterial' ];

	}

	function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

		// Add unknown glTF extensions to an object's userData.
		for ( const name in objectDef.extensions ) {

			if ( knownExtensions[ name ] === undefined ) {

				object.userData.gltfExtensions = object.userData.gltfExtensions || {};
				object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

			}

		}

	}
	/**
 * @param {Object3D|Material|BufferGeometry} object
 * @param {GLTF.definition} gltfDef
 */


	function assignExtrasToUserData( object, gltfDef ) {

		if ( gltfDef.extras !== undefined ) {

			if ( typeof gltfDef.extras === 'object' ) {

				Object.assign( object.userData, gltfDef.extras );

			} else {

				console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

			}

		}

	}
	/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
 *
 * @param {BufferGeometry} geometry
 * @param {Array<GLTF.Target>} targets
 * @param {GLTFParser} parser
 * @return {Promise<BufferGeometry>}
 */


	function addMorphTargets( geometry, targets, parser ) {

		let hasMorphPosition = false;
		let hasMorphNormal = false;
		let hasMorphColor = false;

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];
			if ( target.POSITION !== undefined ) hasMorphPosition = true;
			if ( target.NORMAL !== undefined ) hasMorphNormal = true;
			if ( target.COLOR_0 !== undefined ) hasMorphColor = true;
			if ( hasMorphPosition && hasMorphNormal && hasMorphColor ) break;

		}

		if ( ! hasMorphPosition && ! hasMorphNormal && ! hasMorphColor ) return Promise.resolve( geometry );
		const pendingPositionAccessors = [];
		const pendingNormalAccessors = [];
		const pendingColorAccessors = [];

		for ( let i = 0, il = targets.length; i < il; i ++ ) {

			const target = targets[ i ];

			if ( hasMorphPosition ) {

				const pendingAccessor = target.POSITION !== undefined ? parser.getDependency( 'accessor', target.POSITION ) : geometry.attributes.position;
				pendingPositionAccessors.push( pendingAccessor );

			}

			if ( hasMorphNormal ) {

				const pendingAccessor = target.NORMAL !== undefined ? parser.getDependency( 'accessor', target.NORMAL ) : geometry.attributes.normal;
				pendingNormalAccessors.push( pendingAccessor );

			}

			if ( hasMorphColor ) {

				const pendingAccessor = target.COLOR_0 !== undefined ? parser.getDependency( 'accessor', target.COLOR_0 ) : geometry.attributes.color;
				pendingColorAccessors.push( pendingAccessor );

			}

		}

		return Promise.all( [ Promise.all( pendingPositionAccessors ), Promise.all( pendingNormalAccessors ), Promise.all( pendingColorAccessors ) ] ).then( function ( accessors ) {

			const morphPositions = accessors[ 0 ];
			const morphNormals = accessors[ 1 ];
			const morphColors = accessors[ 2 ];
			if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
			if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;
			if ( hasMorphColor ) geometry.morphAttributes.color = morphColors;
			geometry.morphTargetsRelative = true;
			return geometry;

		} );

	}
	/**
 * @param {Mesh} mesh
 * @param {GLTF.Mesh} meshDef
 */


	function updateMorphTargets( mesh, meshDef ) {

		mesh.updateMorphTargets();

		if ( meshDef.weights !== undefined ) {

			for ( let i = 0, il = meshDef.weights.length; i < il; i ++ ) {

				mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

			}

		} // .extras has user-defined data, so check that .extras.targetNames is an array.


		if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

			const targetNames = meshDef.extras.targetNames;

			if ( mesh.morphTargetInfluences.length === targetNames.length ) {

				mesh.morphTargetDictionary = {};

				for ( let i = 0, il = targetNames.length; i < il; i ++ ) {

					mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

			}

		}

	}

	function createPrimitiveKey( primitiveDef ) {

		const dracoExtension = primitiveDef.extensions && primitiveDef.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ];
		let geometryKey;

		if ( dracoExtension ) {

			geometryKey = 'draco:' + dracoExtension.bufferView + ':' + dracoExtension.indices + ':' + createAttributesKey( dracoExtension.attributes );

		} else {

			geometryKey = primitiveDef.indices + ':' + createAttributesKey( primitiveDef.attributes ) + ':' + primitiveDef.mode;

		}

		return geometryKey;

	}

	function createAttributesKey( attributes ) {

		let attributesKey = '';
		const keys = Object.keys( attributes ).sort();

		for ( let i = 0, il = keys.length; i < il; i ++ ) {

			attributesKey += keys[ i ] + ':' + attributes[ keys[ i ] ] + ';';

		}

		return attributesKey;

	}

	function getNormalizedComponentScale( constructor ) {

		// Reference:
		// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization#encoding-quantized-data
		switch ( constructor ) {

			case Int8Array:
				return 1 / 127;

			case Uint8Array:
				return 1 / 255;

			case Int16Array:
				return 1 / 32767;

			case Uint16Array:
				return 1 / 65535;

			default:
				throw new Error( 'THREE.GLTFLoader: Unsupported normalized accessor component type.' );

		}

	}

	function getImageURIMimeType( uri ) {

		if ( uri.search( /\.jpe?g($|\?)/i ) > 0 || uri.search( /^data\:image\/jpeg/ ) === 0 ) return 'image/jpeg';
		if ( uri.search( /\.webp($|\?)/i ) > 0 || uri.search( /^data\:image\/webp/ ) === 0 ) return 'image/webp';
		return 'image/png';

	}
	/* GLTF PARSER */


	class GLTFParser {

		constructor( json = {}, options = {} ) {

			this.json = json;
			this.extensions = {};
			this.plugins = {};
			this.options = options; // loader object cache

			this.cache = new GLTFRegistry(); // associations between Three.js objects and glTF elements

			this.associations = new Map(); // THREE.BufferGeometry caching

			this.primitiveCache = {}; // THREE.Object3D instance caches

			this.meshCache = {
				refs: {},
				uses: {}
			};
			this.cameraCache = {
				refs: {},
				uses: {}
			};
			this.lightCache = {
				refs: {},
				uses: {}
			};
			this.sourceCache = {};
			this.textureCache = {}; // Track node names, to ensure no duplicates

			this.nodeNamesUsed = {}; // Use an THREE.ImageBitmapLoader if imageBitmaps are supported. Moves much of the
			// expensive work of uploading a texture to the GPU off the main thread.

			const isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent ) === true;
			const isFirefox = navigator.userAgent.indexOf( 'Firefox' ) > - 1;
			const firefoxVersion = isFirefox ? navigator.userAgent.match( /Firefox\/([0-9]+)\./ )[ 1 ] : - 1;

			if ( typeof createImageBitmap === 'undefined' || isSafari || isFirefox && firefoxVersion < 98 ) {

				this.textureLoader = new THREE.TextureLoader( this.options.manager );

			} else {

				this.textureLoader = new THREE.ImageBitmapLoader( this.options.manager );

			}

			this.textureLoader.setCrossOrigin( this.options.crossOrigin );
			this.textureLoader.setRequestHeader( this.options.requestHeader );
			this.fileLoader = new THREE.FileLoader( this.options.manager );
			this.fileLoader.setResponseType( 'arraybuffer' );

			if ( this.options.crossOrigin === 'use-credentials' ) {

				this.fileLoader.setWithCredentials( true );

			}

		}

		setExtensions( extensions ) {

			this.extensions = extensions;

		}

		setPlugins( plugins ) {

			this.plugins = plugins;

		}

		parse( onLoad, onError ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions; // Clear the loader cache

			this.cache.removeAll(); // Mark the special nodes/meshes in json for efficient parse

			this._invokeAll( function ( ext ) {

				return ext._markDefs && ext._markDefs();

			} );

			Promise.all( this._invokeAll( function ( ext ) {

				return ext.beforeRoot && ext.beforeRoot();

			} ) ).then( function () {

				return Promise.all( [ parser.getDependencies( 'scene' ), parser.getDependencies( 'animation' ), parser.getDependencies( 'camera' ) ] );

			} ).then( function ( dependencies ) {

				const result = {
					scene: dependencies[ 0 ][ json.scene || 0 ],
					scenes: dependencies[ 0 ],
					animations: dependencies[ 1 ],
					cameras: dependencies[ 2 ],
					asset: json.asset,
					parser: parser,
					userData: {}
				};
				addUnknownExtensionsToUserData( extensions, result, json );
				assignExtrasToUserData( result, json );
				Promise.all( parser._invokeAll( function ( ext ) {

					return ext.afterRoot && ext.afterRoot( result );

				} ) ).then( function () {

					onLoad( result );

				} );

			} ).catch( onError );

		}
		/**
   * Marks the special nodes/meshes in json for efficient parse.
   */


		_markDefs() {

			const nodeDefs = this.json.nodes || [];
			const skinDefs = this.json.skins || [];
			const meshDefs = this.json.meshes || []; // Nothing in the node definition indicates whether it is a THREE.Bone or an
			// THREE.Object3D. Use the skins' joint references to mark bones.

			for ( let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

				const joints = skinDefs[ skinIndex ].joints;

				for ( let i = 0, il = joints.length; i < il; i ++ ) {

					nodeDefs[ joints[ i ] ].isBone = true;

				}

			} // Iterate over all nodes, marking references to shared resources,
			// as well as skeleton joints.


			for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

				const nodeDef = nodeDefs[ nodeIndex ];

				if ( nodeDef.mesh !== undefined ) {

					this._addNodeRef( this.meshCache, nodeDef.mesh ); // Nothing in the mesh definition indicates whether it is
					// a THREE.SkinnedMesh or THREE.Mesh. Use the node's mesh reference
					// to mark THREE.SkinnedMesh if node has skin.


					if ( nodeDef.skin !== undefined ) {

						meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

					}

				}

				if ( nodeDef.camera !== undefined ) {

					this._addNodeRef( this.cameraCache, nodeDef.camera );

				}

			}

		}
		/**
   * Counts references to shared node / THREE.Object3D resources. These resources
   * can be reused, or "instantiated", at multiple nodes in the scene
   * hierarchy. THREE.Mesh, Camera, and Light instances are instantiated and must
   * be marked. Non-scenegraph resources (like Materials, Geometries, and
   * Textures) can be reused directly and are not marked here.
   *
   * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
   */


		_addNodeRef( cache, index ) {

			if ( index === undefined ) return;

			if ( cache.refs[ index ] === undefined ) {

				cache.refs[ index ] = cache.uses[ index ] = 0;

			}

			cache.refs[ index ] ++;

		}
		/** Returns a reference to a shared resource, cloning it if necessary. */


		_getNodeRef( cache, index, object ) {

			if ( cache.refs[ index ] <= 1 ) return object;
			const ref = object.clone(); // Propagates mappings to the cloned object, prevents mappings on the
			// original object from being lost.

			const updateMappings = ( original, clone ) => {

				const mappings = this.associations.get( original );

				if ( mappings != null ) {

					this.associations.set( clone, mappings );

				}

				for ( const [ i, child ] of original.children.entries() ) {

					updateMappings( child, clone.children[ i ] );

				}

			};

			updateMappings( object, ref );
			ref.name += '_instance_' + cache.uses[ index ] ++;
			return ref;

		}

		_invokeOne( func ) {

			const extensions = Object.values( this.plugins );
			extensions.push( this );

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) return result;

			}

			return null;

		}

		_invokeAll( func ) {

			const extensions = Object.values( this.plugins );
			extensions.unshift( this );
			const pending = [];

			for ( let i = 0; i < extensions.length; i ++ ) {

				const result = func( extensions[ i ] );
				if ( result ) pending.push( result );

			}

			return pending;

		}
		/**
   * Requests the specified dependency asynchronously, with caching.
   * @param {string} type
   * @param {number} index
   * @return {Promise<Object3D|Material|THREE.Texture|AnimationClip|ArrayBuffer|Object>}
   */


		getDependency( type, index ) {

			const cacheKey = type + ':' + index;
			let dependency = this.cache.get( cacheKey );

			if ( ! dependency ) {

				switch ( type ) {

					case 'scene':
						dependency = this.loadScene( index );
						break;

					case 'node':
						dependency = this.loadNode( index );
						break;

					case 'mesh':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMesh && ext.loadMesh( index );

						} );
						break;

					case 'accessor':
						dependency = this.loadAccessor( index );
						break;

					case 'bufferView':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadBufferView && ext.loadBufferView( index );

						} );
						break;

					case 'buffer':
						dependency = this.loadBuffer( index );
						break;

					case 'material':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadMaterial && ext.loadMaterial( index );

						} );
						break;

					case 'texture':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadTexture && ext.loadTexture( index );

						} );
						break;

					case 'skin':
						dependency = this.loadSkin( index );
						break;

					case 'animation':
						dependency = this._invokeOne( function ( ext ) {

							return ext.loadAnimation && ext.loadAnimation( index );

						} );
						break;

					case 'camera':
						dependency = this.loadCamera( index );
						break;

					default:
						throw new Error( 'Unknown type: ' + type );

				}

				this.cache.add( cacheKey, dependency );

			}

			return dependency;

		}
		/**
   * Requests all dependencies of the specified type asynchronously, with caching.
   * @param {string} type
   * @return {Promise<Array<Object>>}
   */


		getDependencies( type ) {

			let dependencies = this.cache.get( type );

			if ( ! dependencies ) {

				const parser = this;
				const defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];
				dependencies = Promise.all( defs.map( function ( def, index ) {

					return parser.getDependency( type, index );

				} ) );
				this.cache.add( type, dependencies );

			}

			return dependencies;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBuffer( bufferIndex ) {

			const bufferDef = this.json.buffers[ bufferIndex ];
			const loader = this.fileLoader;

			if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

				throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

			} // If present, GLB container is required to be the first buffer.


			if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

				return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

			}

			const options = this.options;
			return new Promise( function ( resolve, reject ) {

				loader.load( THREE.LoaderUtils.resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

					reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

				} );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
   * @param {number} bufferViewIndex
   * @return {Promise<ArrayBuffer>}
   */


		loadBufferView( bufferViewIndex ) {

			const bufferViewDef = this.json.bufferViews[ bufferViewIndex ];
			return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

				const byteLength = bufferViewDef.byteLength || 0;
				const byteOffset = bufferViewDef.byteOffset || 0;
				return buffer.slice( byteOffset, byteOffset + byteLength );

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
   * @param {number} accessorIndex
   * @return {Promise<BufferAttribute|InterleavedBufferAttribute>}
   */


		loadAccessor( accessorIndex ) {

			const parser = this;
			const json = this.json;
			const accessorDef = this.json.accessors[ accessorIndex ];

			if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

				// Ignore empty accessors, which may be used to declare runtime
				// information about attributes coming from another source (e.g. Draco
				// compression extension).
				return Promise.resolve( null );

			}

			const pendingBufferViews = [];

			if ( accessorDef.bufferView !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

			} else {

				pendingBufferViews.push( null );

			}

			if ( accessorDef.sparse !== undefined ) {

				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
				pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

			}

			return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

				const bufferView = bufferViews[ 0 ];
				const itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
				const TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ]; // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.

				const elementBytes = TypedArray.BYTES_PER_ELEMENT;
				const itemBytes = elementBytes * itemSize;
				const byteOffset = accessorDef.byteOffset || 0;
				const byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
				const normalized = accessorDef.normalized === true;
				let array, bufferAttribute; // The buffer is not interleaved if the stride is the item size in bytes.

				if ( byteStride && byteStride !== itemBytes ) {

					// Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own THREE.InterleavedBuffer
					// This makes sure that IBA.count reflects accessor.count properly
					const ibSlice = Math.floor( byteOffset / byteStride );
					const ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType + ':' + ibSlice + ':' + accessorDef.count;
					let ib = parser.cache.get( ibCacheKey );

					if ( ! ib ) {

						array = new TypedArray( bufferView, ibSlice * byteStride, accessorDef.count * byteStride / elementBytes ); // Integer parameters to IB/IBA are in array elements, not bytes.

						ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );
						parser.cache.add( ibCacheKey, ib );

					}

					bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, byteOffset % byteStride / elementBytes, normalized );

				} else {

					if ( bufferView === null ) {

						array = new TypedArray( accessorDef.count * itemSize );

					} else {

						array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

					}

					bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

				} // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors


				if ( accessorDef.sparse !== undefined ) {

					const itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
					const TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];
					const byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
					const byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;
					const sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
					const sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

					if ( bufferView !== null ) {

						// Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
						bufferAttribute = new THREE.BufferAttribute( bufferAttribute.array.slice(), bufferAttribute.itemSize, bufferAttribute.normalized );

					}

					for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

						const index = sparseIndices[ i ];
						bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
						if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
						if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
						if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
						if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse THREE.BufferAttribute.' );

					}

				}

				return bufferAttribute;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
   * @param {number} textureIndex
   * @return {Promise<THREE.Texture>}
   */


		loadTexture( textureIndex ) {

			const json = this.json;
			const options = this.options;
			const textureDef = json.textures[ textureIndex ];
			const sourceIndex = textureDef.source;
			const sourceDef = json.images[ sourceIndex ];
			let loader = this.textureLoader;

			if ( sourceDef.uri ) {

				const handler = options.manager.getHandler( sourceDef.uri );
				if ( handler !== null ) loader = handler;

			}

			return this.loadTextureImage( textureIndex, sourceIndex, loader );

		}

		loadTextureImage( textureIndex, sourceIndex, loader ) {

			const parser = this;
			const json = this.json;
			const textureDef = json.textures[ textureIndex ];
			const sourceDef = json.images[ sourceIndex ];
			const cacheKey = ( sourceDef.uri || sourceDef.bufferView ) + ':' + textureDef.sampler;

			if ( this.textureCache[ cacheKey ] ) {

				// See https://github.com/mrdoob/three.js/issues/21559.
				return this.textureCache[ cacheKey ];

			}

			const promise = this.loadImageSource( sourceIndex, loader ).then( function ( texture ) {

				texture.flipY = false;
				if ( textureDef.name ) texture.name = textureDef.name;
				const samplers = json.samplers || {};
				const sampler = samplers[ textureDef.sampler ] || {};
				texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
				texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipmapLinearFilter;
				texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
				texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;
				parser.associations.set( texture, {
					textures: textureIndex
				} );
				return texture;

			} ).catch( function () {

				return null;

			} );
			this.textureCache[ cacheKey ] = promise;
			return promise;

		}

		loadImageSource( sourceIndex, loader ) {

			const parser = this;
			const json = this.json;
			const options = this.options;

			if ( this.sourceCache[ sourceIndex ] !== undefined ) {

				return this.sourceCache[ sourceIndex ].then( texture => texture.clone() );

			}

			const sourceDef = json.images[ sourceIndex ];
			const URL = self.URL || self.webkitURL;
			let sourceURI = sourceDef.uri || '';
			let isObjectURL = false;

			if ( sourceDef.bufferView !== undefined ) {

				// Load binary image data from bufferView, if provided.
				sourceURI = parser.getDependency( 'bufferView', sourceDef.bufferView ).then( function ( bufferView ) {

					isObjectURL = true;
					const blob = new Blob( [ bufferView ], {
						type: sourceDef.mimeType
					} );
					sourceURI = URL.createObjectURL( blob );
					return sourceURI;

				} );

			} else if ( sourceDef.uri === undefined ) {

				throw new Error( 'THREE.GLTFLoader: Image ' + sourceIndex + ' is missing URI and bufferView' );

			}

			const promise = Promise.resolve( sourceURI ).then( function ( sourceURI ) {

				return new Promise( function ( resolve, reject ) {

					let onLoad = resolve;

					if ( loader.isImageBitmapLoader === true ) {

						onLoad = function ( imageBitmap ) {

							const texture = new THREE.Texture( imageBitmap );
							texture.needsUpdate = true;
							resolve( texture );

						};

					}

					loader.load( THREE.LoaderUtils.resolveURL( sourceURI, options.path ), onLoad, undefined, reject );

				} );

			} ).then( function ( texture ) {

				// Clean up resources and configure THREE.Texture.
				if ( isObjectURL === true ) {

					URL.revokeObjectURL( sourceURI );

				}

				texture.userData.mimeType = sourceDef.mimeType || getImageURIMimeType( sourceDef.uri );
				return texture;

			} ).catch( function ( error ) {

				console.error( 'THREE.GLTFLoader: Couldn\'t load texture', sourceURI );
				throw error;

			} );
			this.sourceCache[ sourceIndex ] = promise;
			return promise;

		}
		/**
   * Asynchronously assigns a texture to the given material parameters.
   * @param {Object} materialParams
   * @param {string} mapName
   * @param {Object} mapDef
   * @return {Promise<Texture>}
   */


		assignTexture( materialParams, mapName, mapDef, encoding ) {

			const parser = this;
			return this.getDependency( 'texture', mapDef.index ).then( function ( texture ) {

				// Materials sample aoMap from UV set 1 and other maps from UV set 0 - this can't be configured
				// However, we will copy UV set 0 to UV set 1 on demand for aoMap
				if ( mapDef.texCoord !== undefined && mapDef.texCoord != 0 && ! ( mapName === 'aoMap' && mapDef.texCoord == 1 ) ) {

					console.warn( 'THREE.GLTFLoader: Custom UV set ' + mapDef.texCoord + ' for texture ' + mapName + ' not yet supported.' );

				}

				if ( parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] ) {

					const transform = mapDef.extensions !== undefined ? mapDef.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ] : undefined;

					if ( transform ) {

						const gltfReference = parser.associations.get( texture );
						texture = parser.extensions[ EXTENSIONS.KHR_TEXTURE_TRANSFORM ].extendTexture( texture, transform );
						parser.associations.set( texture, gltfReference );

					}

				}

				if ( encoding !== undefined ) {

					texture.encoding = encoding;

				}

				materialParams[ mapName ] = texture;
				return texture;

			} );

		}
		/**
   * Assigns final material to a THREE.Mesh, THREE.Line, or THREE.Points instance. The instance
   * already has a material (generated from the glTF material options alone)
   * but reuse of the same glTF material may require multiple threejs materials
   * to accommodate different primitive types, defines, etc. New materials will
   * be created if necessary, and reused from a cache.
   * @param  {Object3D} mesh THREE.Mesh, THREE.Line, or THREE.Points instance.
   */


		assignFinalMaterial( mesh ) {

			const geometry = mesh.geometry;
			let material = mesh.material;
			const useDerivativeTangents = geometry.attributes.tangent === undefined;
			const useVertexColors = geometry.attributes.color !== undefined;
			const useFlatShading = geometry.attributes.normal === undefined;

			if ( mesh.isPoints ) {

				const cacheKey = 'PointsMaterial:' + material.uuid;
				let pointsMaterial = this.cache.get( cacheKey );

				if ( ! pointsMaterial ) {

					pointsMaterial = new THREE.PointsMaterial();
					THREE.Material.prototype.copy.call( pointsMaterial, material );
					pointsMaterial.color.copy( material.color );
					pointsMaterial.map = material.map;
					pointsMaterial.sizeAttenuation = false; // glTF spec says points should be 1px

					this.cache.add( cacheKey, pointsMaterial );

				}

				material = pointsMaterial;

			} else if ( mesh.isLine ) {

				const cacheKey = 'LineBasicMaterial:' + material.uuid;
				let lineMaterial = this.cache.get( cacheKey );

				if ( ! lineMaterial ) {

					lineMaterial = new THREE.LineBasicMaterial();
					THREE.Material.prototype.copy.call( lineMaterial, material );
					lineMaterial.color.copy( material.color );
					this.cache.add( cacheKey, lineMaterial );

				}

				material = lineMaterial;

			} // Clone the material if it will be modified


			if ( useDerivativeTangents || useVertexColors || useFlatShading ) {

				let cacheKey = 'ClonedMaterial:' + material.uuid + ':';
				if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
				if ( useDerivativeTangents ) cacheKey += 'derivative-tangents:';
				if ( useVertexColors ) cacheKey += 'vertex-colors:';
				if ( useFlatShading ) cacheKey += 'flat-shading:';
				let cachedMaterial = this.cache.get( cacheKey );

				if ( ! cachedMaterial ) {

					cachedMaterial = material.clone();
					if ( useVertexColors ) cachedMaterial.vertexColors = true;
					if ( useFlatShading ) cachedMaterial.flatShading = true;

					if ( useDerivativeTangents ) {

						// https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995
						if ( cachedMaterial.normalScale ) cachedMaterial.normalScale.y *= - 1;
						if ( cachedMaterial.clearcoatNormalScale ) cachedMaterial.clearcoatNormalScale.y *= - 1;

					}

					this.cache.add( cacheKey, cachedMaterial );
					this.associations.set( cachedMaterial, this.associations.get( material ) );

				}

				material = cachedMaterial;

			} // workarounds for mesh and geometry


			if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

				geometry.setAttribute( 'uv2', geometry.attributes.uv );

			}

			mesh.material = material;

		}

		getMaterialType() {

			return THREE.MeshStandardMaterial;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
   * @param {number} materialIndex
   * @return {Promise<Material>}
   */


		loadMaterial( materialIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const materialDef = json.materials[ materialIndex ];
			let materialType;
			const materialParams = {};
			const materialExtensions = materialDef.extensions || {};
			const pending = [];

			if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] ) {

				const sgExtension = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ];
				materialType = sgExtension.getMaterialType();
				pending.push( sgExtension.extendParams( materialParams, materialDef, parser ) );

			} else if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

				const kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
				materialType = kmuExtension.getMaterialType();
				pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

			} else {

				// Specification:
				// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material
				const metallicRoughness = materialDef.pbrMetallicRoughness || {};
				materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
				materialParams.opacity = 1.0;

				if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

					const array = metallicRoughness.baseColorFactor;
					materialParams.color.fromArray( array );
					materialParams.opacity = array[ 3 ];

				}

				if ( metallicRoughness.baseColorTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture, THREE.sRGBEncoding ) );

				}

				materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
				materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

				if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

					pending.push( parser.assignTexture( materialParams, 'metalnessMap', metallicRoughness.metallicRoughnessTexture ) );
					pending.push( parser.assignTexture( materialParams, 'roughnessMap', metallicRoughness.metallicRoughnessTexture ) );

				}

				materialType = this._invokeOne( function ( ext ) {

					return ext.getMaterialType && ext.getMaterialType( materialIndex );

				} );
				pending.push( Promise.all( this._invokeAll( function ( ext ) {

					return ext.extendMaterialParams && ext.extendMaterialParams( materialIndex, materialParams );

				} ) ) );

			}

			if ( materialDef.doubleSided === true ) {

				materialParams.side = THREE.DoubleSide;

			}

			const alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

			if ( alphaMode === ALPHA_MODES.BLEND ) {

				materialParams.transparent = true; // See: https://github.com/mrdoob/three.js/issues/17706

				materialParams.depthWrite = false;

			} else {

				materialParams.transparent = false;

				if ( alphaMode === ALPHA_MODES.MASK ) {

					materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

				}

			}

			if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture ) );
				materialParams.normalScale = new THREE.Vector2( 1, 1 );

				if ( materialDef.normalTexture.scale !== undefined ) {

					const scale = materialDef.normalTexture.scale;
					materialParams.normalScale.set( scale, scale );

				}

			}

			if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture ) );

				if ( materialDef.occlusionTexture.strength !== undefined ) {

					materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

				}

			}

			if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

			}

			if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

				pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture, THREE.sRGBEncoding ) );

			}

			return Promise.all( pending ).then( function () {

				let material;

				if ( materialType === GLTFMeshStandardSGMaterial ) {

					material = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].createMaterial( materialParams );

				} else {

					material = new materialType( materialParams );

				}

				if ( materialDef.name ) material.name = materialDef.name;
				assignExtrasToUserData( material, materialDef );
				parser.associations.set( material, {
					materials: materialIndex
				} );
				if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );
				return material;

			} );

		}
		/** When THREE.Object3D instances are targeted by animation, they need unique names. */


		createUniqueName( originalName ) {

			const sanitizedName = THREE.PropertyBinding.sanitizeNodeName( originalName || '' );
			let name = sanitizedName;

			for ( let i = 1; this.nodeNamesUsed[ name ]; ++ i ) {

				name = sanitizedName + '_' + i;

			}

			this.nodeNamesUsed[ name ] = true;
			return name;

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
   *
   * Creates BufferGeometries from primitives.
   *
   * @param {Array<GLTF.Primitive>} primitives
   * @return {Promise<Array<BufferGeometry>>}
   */


		loadGeometries( primitives ) {

			const parser = this;
			const extensions = this.extensions;
			const cache = this.primitiveCache;

			function createDracoPrimitive( primitive ) {

				return extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ].decodePrimitive( primitive, parser ).then( function ( geometry ) {

					return addPrimitiveAttributes( geometry, primitive, parser );

				} );

			}

			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const primitive = primitives[ i ];
				const cacheKey = createPrimitiveKey( primitive ); // See if we've already created this geometry

				const cached = cache[ cacheKey ];

				if ( cached ) {

					// Use the cached geometry if it exists
					pending.push( cached.promise );

				} else {

					let geometryPromise;

					if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

						// Use DRACO geometry if available
						geometryPromise = createDracoPrimitive( primitive );

					} else {

						// Otherwise create a new geometry
						geometryPromise = addPrimitiveAttributes( new THREE.BufferGeometry(), primitive, parser );

					} // Cache this geometry


					cache[ cacheKey ] = {
						primitive: primitive,
						promise: geometryPromise
					};
					pending.push( geometryPromise );

				}

			}

			return Promise.all( pending );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
   * @param {number} meshIndex
   * @return {Promise<Group|Mesh|SkinnedMesh>}
   */


		loadMesh( meshIndex ) {

			const parser = this;
			const json = this.json;
			const extensions = this.extensions;
			const meshDef = json.meshes[ meshIndex ];
			const primitives = meshDef.primitives;
			const pending = [];

			for ( let i = 0, il = primitives.length; i < il; i ++ ) {

				const material = primitives[ i ].material === undefined ? createDefaultMaterial( this.cache ) : this.getDependency( 'material', primitives[ i ].material );
				pending.push( material );

			}

			pending.push( parser.loadGeometries( primitives ) );
			return Promise.all( pending ).then( function ( results ) {

				const materials = results.slice( 0, results.length - 1 );
				const geometries = results[ results.length - 1 ];
				const meshes = [];

				for ( let i = 0, il = geometries.length; i < il; i ++ ) {

					const geometry = geometries[ i ];
					const primitive = primitives[ i ]; // 1. create THREE.Mesh

					let mesh;
					const material = materials[ i ];

					if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP || primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN || primitive.mode === undefined ) {

						// .isSkinnedMesh isn't in glTF spec. See ._markDefs()
						mesh = meshDef.isSkinnedMesh === true ? new THREE.SkinnedMesh( geometry, material ) : new THREE.Mesh( geometry, material );

						if ( mesh.isSkinnedMesh === true && ! mesh.geometry.attributes.skinWeight.normalized ) {

							// we normalize floating point skin weight array to fix malformed assets (see #15319)
							// it's important to skip this for non-float32 data since normalizeSkinWeights assumes non-normalized inputs
							mesh.normalizeSkinWeights();

						}

						if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleStripDrawMode );

						} else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

							mesh.geometry = toTrianglesDrawMode( mesh.geometry, THREE.TriangleFanDrawMode );

						}

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

						mesh = new THREE.LineSegments( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

						mesh = new THREE.Line( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

						mesh = new THREE.LineLoop( geometry, material );

					} else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

						mesh = new THREE.Points( geometry, material );

					} else {

						throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

					}

					if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

						updateMorphTargets( mesh, meshDef );

					}

					mesh.name = parser.createUniqueName( meshDef.name || 'mesh_' + meshIndex );
					assignExtrasToUserData( mesh, meshDef );
					if ( primitive.extensions ) addUnknownExtensionsToUserData( extensions, mesh, primitive );
					parser.assignFinalMaterial( mesh );
					meshes.push( mesh );

				}

				for ( let i = 0, il = meshes.length; i < il; i ++ ) {

					parser.associations.set( meshes[ i ], {
						meshes: meshIndex,
						primitives: i
					} );

				}

				if ( meshes.length === 1 ) {

					return meshes[ 0 ];

				}

				const group = new THREE.Group();
				parser.associations.set( group, {
					meshes: meshIndex
				} );

				for ( let i = 0, il = meshes.length; i < il; i ++ ) {

					group.add( meshes[ i ] );

				}

				return group;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
   * @param {number} cameraIndex
   * @return {Promise<THREE.Camera>}
   */


		loadCamera( cameraIndex ) {

			let camera;
			const cameraDef = this.json.cameras[ cameraIndex ];
			const params = cameraDef[ cameraDef.type ];

			if ( ! params ) {

				console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
				return;

			}

			if ( cameraDef.type === 'perspective' ) {

				camera = new THREE.PerspectiveCamera( THREE.MathUtils.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

			} else if ( cameraDef.type === 'orthographic' ) {

				camera = new THREE.OrthographicCamera( - params.xmag, params.xmag, params.ymag, - params.ymag, params.znear, params.zfar );

			}

			if ( cameraDef.name ) camera.name = this.createUniqueName( cameraDef.name );
			assignExtrasToUserData( camera, cameraDef );
			return Promise.resolve( camera );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
   * @param {number} skinIndex
   * @return {Promise<Object>}
   */


		loadSkin( skinIndex ) {

			const skinDef = this.json.skins[ skinIndex ];
			const skinEntry = {
				joints: skinDef.joints
			};

			if ( skinDef.inverseBindMatrices === undefined ) {

				return Promise.resolve( skinEntry );

			}

			return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

				skinEntry.inverseBindMatrices = accessor;
				return skinEntry;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
   * @param {number} animationIndex
   * @return {Promise<AnimationClip>}
   */


		loadAnimation( animationIndex ) {

			const json = this.json;
			const animationDef = json.animations[ animationIndex ];
			const pendingNodes = [];
			const pendingInputAccessors = [];
			const pendingOutputAccessors = [];
			const pendingSamplers = [];
			const pendingTargets = [];

			for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

				const channel = animationDef.channels[ i ];
				const sampler = animationDef.samplers[ channel.sampler ];
				const target = channel.target;
				const name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.

				const input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
				const output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;
				pendingNodes.push( this.getDependency( 'node', name ) );
				pendingInputAccessors.push( this.getDependency( 'accessor', input ) );
				pendingOutputAccessors.push( this.getDependency( 'accessor', output ) );
				pendingSamplers.push( sampler );
				pendingTargets.push( target );

			}

			return Promise.all( [ Promise.all( pendingNodes ), Promise.all( pendingInputAccessors ), Promise.all( pendingOutputAccessors ), Promise.all( pendingSamplers ), Promise.all( pendingTargets ) ] ).then( function ( dependencies ) {

				const nodes = dependencies[ 0 ];
				const inputAccessors = dependencies[ 1 ];
				const outputAccessors = dependencies[ 2 ];
				const samplers = dependencies[ 3 ];
				const targets = dependencies[ 4 ];
				const tracks = [];

				for ( let i = 0, il = nodes.length; i < il; i ++ ) {

					const node = nodes[ i ];
					const inputAccessor = inputAccessors[ i ];
					const outputAccessor = outputAccessors[ i ];
					const sampler = samplers[ i ];
					const target = targets[ i ];
					if ( node === undefined ) continue;
					node.updateMatrix();
					node.matrixAutoUpdate = true;
					let TypedKeyframeTrack;

					switch ( PATH_PROPERTIES[ target.path ] ) {

						case PATH_PROPERTIES.weights:
							TypedKeyframeTrack = THREE.NumberKeyframeTrack;
							break;

						case PATH_PROPERTIES.rotation:
							TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
							break;

						case PATH_PROPERTIES.position:
						case PATH_PROPERTIES.scale:
						default:
							TypedKeyframeTrack = THREE.VectorKeyframeTrack;
							break;

					}

					const targetName = node.name ? node.name : node.uuid;
					const interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;
					const targetNames = [];

					if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

						node.traverse( function ( object ) {

							if ( object.morphTargetInfluences ) {

								targetNames.push( object.name ? object.name : object.uuid );

							}

						} );

					} else {

						targetNames.push( targetName );

					}

					let outputArray = outputAccessor.array;

					if ( outputAccessor.normalized ) {

						const scale = getNormalizedComponentScale( outputArray.constructor );
						const scaled = new Float32Array( outputArray.length );

						for ( let j = 0, jl = outputArray.length; j < jl; j ++ ) {

							scaled[ j ] = outputArray[ j ] * scale;

						}

						outputArray = scaled;

					}

					for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

						const track = new TypedKeyframeTrack( targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ], inputAccessor.array, outputArray, interpolation ); // Override interpolation with custom factory method.

						if ( sampler.interpolation === 'CUBICSPLINE' ) {

							track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

								// A CUBICSPLINE keyframe in glTF has three output values for each input value,
								// representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
								// must be divided by three to get the interpolant's sampleSize argument.
								const interpolantType = this instanceof THREE.QuaternionKeyframeTrack ? GLTFCubicSplineQuaternionInterpolant : GLTFCubicSplineInterpolant;
								return new interpolantType( this.times, this.values, this.getValueSize() / 3, result );

							}; // Mark as CUBICSPLINE. `track.getInterpolation()` doesn't support custom interpolants.


							track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

						}

						tracks.push( track );

					}

				}

				const name = animationDef.name ? animationDef.name : 'animation_' + animationIndex;
				return new THREE.AnimationClip( name, undefined, tracks );

			} );

		}

		createNodeMesh( nodeIndex ) {

			const json = this.json;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ];
			if ( nodeDef.mesh === undefined ) return null;
			return parser.getDependency( 'mesh', nodeDef.mesh ).then( function ( mesh ) {

				const node = parser._getNodeRef( parser.meshCache, nodeDef.mesh, mesh ); // if weights are provided on the node, override weights on the mesh.


				if ( nodeDef.weights !== undefined ) {

					node.traverse( function ( o ) {

						if ( ! o.isMesh ) return;

						for ( let i = 0, il = nodeDef.weights.length; i < il; i ++ ) {

							o.morphTargetInfluences[ i ] = nodeDef.weights[ i ];

						}

					} );

				}

				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
   * @param {number} nodeIndex
   * @return {Promise<Object3D>}
   */


		loadNode( nodeIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const parser = this;
			const nodeDef = json.nodes[ nodeIndex ]; // reserve node's name before its dependencies, so the root has the intended name.

			const nodeName = nodeDef.name ? parser.createUniqueName( nodeDef.name ) : '';
			return function () {

				const pending = [];

				const meshPromise = parser._invokeOne( function ( ext ) {

					return ext.createNodeMesh && ext.createNodeMesh( nodeIndex );

				} );

				if ( meshPromise ) {

					pending.push( meshPromise );

				}

				if ( nodeDef.camera !== undefined ) {

					pending.push( parser.getDependency( 'camera', nodeDef.camera ).then( function ( camera ) {

						return parser._getNodeRef( parser.cameraCache, nodeDef.camera, camera );

					} ) );

				}

				parser._invokeAll( function ( ext ) {

					return ext.createNodeAttachment && ext.createNodeAttachment( nodeIndex );

				} ).forEach( function ( promise ) {

					pending.push( promise );

				} );

				return Promise.all( pending );

			}().then( function ( objects ) {

				let node; // .isBone isn't in glTF spec. See ._markDefs

				if ( nodeDef.isBone === true ) {

					node = new THREE.Bone();

				} else if ( objects.length > 1 ) {

					node = new THREE.Group();

				} else if ( objects.length === 1 ) {

					node = objects[ 0 ];

				} else {

					node = new THREE.Object3D();

				}

				if ( node !== objects[ 0 ] ) {

					for ( let i = 0, il = objects.length; i < il; i ++ ) {

						node.add( objects[ i ] );

					}

				}

				if ( nodeDef.name ) {

					node.userData.name = nodeDef.name;
					node.name = nodeName;

				}

				assignExtrasToUserData( node, nodeDef );
				if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

				if ( nodeDef.matrix !== undefined ) {

					const matrix = new THREE.Matrix4();
					matrix.fromArray( nodeDef.matrix );
					node.applyMatrix4( matrix );

				} else {

					if ( nodeDef.translation !== undefined ) {

						node.position.fromArray( nodeDef.translation );

					}

					if ( nodeDef.rotation !== undefined ) {

						node.quaternion.fromArray( nodeDef.rotation );

					}

					if ( nodeDef.scale !== undefined ) {

						node.scale.fromArray( nodeDef.scale );

					}

				}

				if ( ! parser.associations.has( node ) ) {

					parser.associations.set( node, {} );

				}

				parser.associations.get( node ).nodes = nodeIndex;
				return node;

			} );

		}
		/**
   * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
   * @param {number} sceneIndex
   * @return {Promise<Group>}
   */


		loadScene( sceneIndex ) {

			const json = this.json;
			const extensions = this.extensions;
			const sceneDef = this.json.scenes[ sceneIndex ];
			const parser = this; // THREE.Loader returns THREE.Group, not Scene.
			// See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172

			const scene = new THREE.Group();
			if ( sceneDef.name ) scene.name = parser.createUniqueName( sceneDef.name );
			assignExtrasToUserData( scene, sceneDef );
			if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );
			const nodeIds = sceneDef.nodes || [];
			const pending = [];

			for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

				pending.push( buildNodeHierarchy( nodeIds[ i ], scene, json, parser ) );

			}

			return Promise.all( pending ).then( function () {

				// Removes dangling associations, associations that reference a node that
				// didn't make it into the scene.
				const reduceAssociations = node => {

					const reducedAssociations = new Map();

					for ( const [ key, value ] of parser.associations ) {

						if ( key instanceof THREE.Material || key instanceof THREE.Texture ) {

							reducedAssociations.set( key, value );

						}

					}

					node.traverse( node => {

						const mappings = parser.associations.get( node );

						if ( mappings != null ) {

							reducedAssociations.set( node, mappings );

						}

					} );
					return reducedAssociations;

				};

				parser.associations = reduceAssociations( scene );
				return scene;

			} );

		}

	}

	function buildNodeHierarchy( nodeId, parentObject, json, parser ) {

		const nodeDef = json.nodes[ nodeId ];
		return parser.getDependency( 'node', nodeId ).then( function ( node ) {

			if ( nodeDef.skin === undefined ) return node; // build skeleton here as well

			let skinEntry;
			return parser.getDependency( 'skin', nodeDef.skin ).then( function ( skin ) {

				skinEntry = skin;
				const pendingJoints = [];

				for ( let i = 0, il = skinEntry.joints.length; i < il; i ++ ) {

					pendingJoints.push( parser.getDependency( 'node', skinEntry.joints[ i ] ) );

				}

				return Promise.all( pendingJoints );

			} ).then( function ( jointNodes ) {

				node.traverse( function ( mesh ) {

					if ( ! mesh.isMesh ) return;
					const bones = [];
					const boneInverses = [];

					for ( let j = 0, jl = jointNodes.length; j < jl; j ++ ) {

						const jointNode = jointNodes[ j ];

						if ( jointNode ) {

							bones.push( jointNode );
							const mat = new THREE.Matrix4();

							if ( skinEntry.inverseBindMatrices !== undefined ) {

								mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

							}

							boneInverses.push( mat );

						} else {

							console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[ j ] );

						}

					}

					mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

				} );
				return node;

			} );

		} ).then( function ( node ) {

			// build node hierachy
			parentObject.add( node );
			const pending = [];

			if ( nodeDef.children ) {

				const children = nodeDef.children;

				for ( let i = 0, il = children.length; i < il; i ++ ) {

					const child = children[ i ];
					pending.push( buildNodeHierarchy( child, node, json, parser ) );

				}

			}

			return Promise.all( pending );

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 */


	function computeBounds( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const box = new THREE.Box3();

		if ( attributes.POSITION !== undefined ) {

			const accessor = parser.json.accessors[ attributes.POSITION ];
			const min = accessor.min;
			const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

			if ( min !== undefined && max !== undefined ) {

				box.set( new THREE.Vector3( min[ 0 ], min[ 1 ], min[ 2 ] ), new THREE.Vector3( max[ 0 ], max[ 1 ], max[ 2 ] ) );

				if ( accessor.normalized ) {

					const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
					box.min.multiplyScalar( boxScale );
					box.max.multiplyScalar( boxScale );

				}

			} else {

				console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );
				return;

			}

		} else {

			return;

		}

		const targets = primitiveDef.targets;

		if ( targets !== undefined ) {

			const maxDisplacement = new THREE.Vector3();
			const vector = new THREE.Vector3();

			for ( let i = 0, il = targets.length; i < il; i ++ ) {

				const target = targets[ i ];

				if ( target.POSITION !== undefined ) {

					const accessor = parser.json.accessors[ target.POSITION ];
					const min = accessor.min;
					const max = accessor.max; // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

					if ( min !== undefined && max !== undefined ) {

						// we need to get max of absolute components because target weight is [-1,1]
						vector.setX( Math.max( Math.abs( min[ 0 ] ), Math.abs( max[ 0 ] ) ) );
						vector.setY( Math.max( Math.abs( min[ 1 ] ), Math.abs( max[ 1 ] ) ) );
						vector.setZ( Math.max( Math.abs( min[ 2 ] ), Math.abs( max[ 2 ] ) ) );

						if ( accessor.normalized ) {

							const boxScale = getNormalizedComponentScale( WEBGL_COMPONENT_TYPES[ accessor.componentType ] );
							vector.multiplyScalar( boxScale );

						} // Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
						// to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
						// are used to implement key-frame animations and as such only two are active at a time - this results in very large
						// boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.


						maxDisplacement.max( vector );

					} else {

						console.warn( 'THREE.GLTFLoader: Missing min/max properties for accessor POSITION.' );

					}

				}

			} // As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.


			box.expandByVector( maxDisplacement );

		}

		geometry.boundingBox = box;
		const sphere = new THREE.Sphere();
		box.getCenter( sphere.center );
		sphere.radius = box.min.distanceTo( box.max ) / 2;
		geometry.boundingSphere = sphere;

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 * @return {Promise<BufferGeometry>}
 */


	function addPrimitiveAttributes( geometry, primitiveDef, parser ) {

		const attributes = primitiveDef.attributes;
		const pending = [];

		function assignAttributeAccessor( accessorIndex, attributeName ) {

			return parser.getDependency( 'accessor', accessorIndex ).then( function ( accessor ) {

				geometry.setAttribute( attributeName, accessor );

			} );

		}

		for ( const gltfAttributeName in attributes ) {

			const threeAttributeName = ATTRIBUTES[ gltfAttributeName ] || gltfAttributeName.toLowerCase(); // Skip attributes already provided by e.g. Draco extension.

			if ( threeAttributeName in geometry.attributes ) continue;
			pending.push( assignAttributeAccessor( attributes[ gltfAttributeName ], threeAttributeName ) );

		}

		if ( primitiveDef.indices !== undefined && ! geometry.index ) {

			const accessor = parser.getDependency( 'accessor', primitiveDef.indices ).then( function ( accessor ) {

				geometry.setIndex( accessor );

			} );
			pending.push( accessor );

		}

		assignExtrasToUserData( geometry, primitiveDef );
		computeBounds( geometry, primitiveDef, parser );
		return Promise.all( pending ).then( function () {

			return primitiveDef.targets !== undefined ? addMorphTargets( geometry, primitiveDef.targets, parser ) : geometry;

		} );

	}
	/**
 * @param {BufferGeometry} geometry
 * @param {Number} drawMode
 * @return {BufferGeometry}
 */


	function toTrianglesDrawMode( geometry, drawMode ) {

		let index = geometry.getIndex(); // generate index if not present

		if ( index === null ) {

			const indices = [];
			const position = geometry.getAttribute( 'position' );

			if ( position !== undefined ) {

				for ( let i = 0; i < position.count; i ++ ) {

					indices.push( i );

				}

				geometry.setIndex( indices );
				index = geometry.getIndex();

			} else {

				console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.' );
				return geometry;

			}

		} //


		const numberOfTriangles = index.count - 2;
		const newIndices = [];

		if ( drawMode === THREE.TriangleFanDrawMode ) {

			// gl.TRIANGLE_FAN
			for ( let i = 1; i <= numberOfTriangles; i ++ ) {

				newIndices.push( index.getX( 0 ) );
				newIndices.push( index.getX( i ) );
				newIndices.push( index.getX( i + 1 ) );

			}

		} else {

			// gl.TRIANGLE_STRIP
			for ( let i = 0; i < numberOfTriangles; i ++ ) {

				if ( i % 2 === 0 ) {

					newIndices.push( index.getX( i ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i + 2 ) );

				} else {

					newIndices.push( index.getX( i + 2 ) );
					newIndices.push( index.getX( i + 1 ) );
					newIndices.push( index.getX( i ) );

				}

			}

		}

		if ( newIndices.length / 3 !== numberOfTriangles ) {

			console.error( 'THREE.GLTFLoader.toTrianglesDrawMode(): Unable to generate correct amount of triangles.' );

		} // build final geometry


		const newGeometry = geometry.clone();
		newGeometry.setIndex( newIndices );
		return newGeometry;

	}

	THREE.GLTFLoader = GLTFLoader;

} )();
/**
 * @author takahiro / https://github.com/takahirox
 *
 * Dependencies
 *  - mmd-parser https://github.com/takahirox/mmd-parser
 *  - THREE.TGALoader
 *  - THREE.OutlineEffect
 *
 * MMDLoader creates Three.js Objects from MMD resources as
 * PMD, PMX, VMD, and VPD files.
 *
 * PMD/PMX is a model data format, VMD is a motion data format
 * VPD is a posing data format used in MMD(Miku Miku Dance).
 *
 * MMD official site
 *  - http://www.geocities.jp/higuchuu4/index_e.htm
 *
 * PMD, VMD format (in Japanese)
 *  - http://blog.goo.ne.jp/torisu_tetosuki/e/209ad341d3ece2b1b4df24abf619d6e4
 *
 * PMX format
 *  - https://gist.github.com/felixjones/f8a06bd48f9da9a4539f
 *
 * TODO
 *  - light motion in vmd support.
 *  - SDEF support.
 *  - uv/material/bone morphing support.
 *  - more precise grant skinning support.
 *  - shadow support.
 */

THREE.MMDLoader = ( function () {

	/**
	 * @param {THREE.LoadingManager} manager
	 */
	function MMDLoader( manager ) {

		this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

		this.loader = new THREE.FileLoader( this.manager );

		this.parser = null; // lazy generation
		this.meshBuilder = new MeshBuilder( this.manager );
		this.animationBuilder = new AnimationBuilder();

	}

	MMDLoader.prototype = {

		constructor: MMDLoader,

		crossOrigin: 'anonymous',

		/**
		 * @param {string} value
		 * @return {THREE.MMDLoader}
		 */
		setCrossOrigin: function ( crossOrigin ) {

			this.crossOrigin = crossOrigin;
			return this;

		},

		// Load MMD assets as Three.js Object

		/**
		 * Loads Model file (.pmd or .pmx) as a THREE.SkinnedMesh.
		 *
		 * @param {string} url - url to Model(.pmd or .pmx) file
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		load: function ( url, onLoad, onProgress, onError ) {

			var builder = this.meshBuilder.setCrossOrigin( this.crossOrigin );

			var texturePath = THREE.LoaderUtils.extractUrlBase( url );
			var modelExtension = this._extractExtension( url ).toLowerCase();

			// Should I detect by seeing header?
			if ( modelExtension !== 'pmd' && modelExtension !== 'pmx' ) {

				if ( onError ) onError( new Error( 'THREE.MMDLoader: Unknown model file extension .' + modelExtension + '.' ) );

				return;

			}

			this[ modelExtension === 'pmd' ? 'loadPMD' : 'loadPMX' ]( url, function ( data ) {

				onLoad(	builder.build( data, texturePath, onProgress, onError )	);

			}, onProgress, onError );

		},

		/**
		 * Loads Motion file(s) (.vmd) as a THREE.AnimationClip.
		 * If two or more files are specified, they'll be merged.
		 *
		 * @param {string|Array<string>} url - url(s) to animation(.vmd) file(s)
		 * @param {THREE.SkinnedMesh|THREE.Camera} object - tracks will be fitting to this object
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadAnimation: function ( url, object, onLoad, onProgress, onError ) {

			var builder = this.animationBuilder;

			this.loadVMD( url, function ( vmd ) {

				onLoad( object.isCamera
					? builder.buildCameraAnimation( vmd )
					: builder.build( vmd, object ) );

			}, onProgress, onError );

		},

		/**
		 * Loads mode file and motion file(s) as an object containing
		 * a THREE.SkinnedMesh and a THREE.AnimationClip.
		 * Tracks of THREE.AnimationClip are fitting to the model.
		 *
		 * @param {string} modelUrl - url to Model(.pmd or .pmx) file
		 * @param {string|Array{string}} vmdUrl - url(s) to animation(.vmd) file
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadWithAnimation: function ( modelUrl, vmdUrl, onLoad, onProgress, onError ) {

			var scope = this;

			this.load( modelUrl, function ( mesh ) {

				scope.loadAnimation( vmdUrl, mesh, function ( animation ) {

					onLoad( {
						mesh: mesh,
						animation: animation
					} );

				}, onProgress, onError );

			}, onProgress, onError );

		},

		// Load MMD assets as Object data parsed by MMDParser

		/**
		 * Loads .pmd file as an Object.
		 *
		 * @param {string} url - url to .pmd file
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadPMD: function ( url, onLoad, onProgress, onError ) {

			var parser = this._getParser();

			this.loader
				.setMimeType( undefined )
				.setResponseType( 'arraybuffer' )
				.load( url, function ( buffer ) {

					onLoad( parser.parsePmd( buffer, true ) );

				}, onProgress, onError );

		},

		/**
		 * Loads .pmx file as an Object.
		 *
		 * @param {string} url - url to .pmx file
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadPMX: function ( url, onLoad, onProgress, onError ) {

			var parser = this._getParser();

			this.loader
				.setMimeType( undefined )
				.setResponseType( 'arraybuffer' )
				.load( url, function ( buffer ) {

					onLoad( parser.parsePmx( buffer, true ) );

				}, onProgress, onError );

		},

		/**
		 * Loads .vmd file as an Object. If two or more files are specified
		 * they'll be merged.
		 *
		 * @param {string|Array<string>} url - url(s) to .vmd file(s)
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadVMD: function ( url, onLoad, onProgress, onError ) {

			var urls = Array.isArray( url ) ? url : [ url ];

			var vmds = [];
			var vmdNum = urls.length;

			var parser = this._getParser();

			this.loader
				.setMimeType( undefined )
				.setResponseType( 'arraybuffer' );

			for ( var i = 0, il = urls.length; i < il; i ++ ) {

				this.loader.load( urls[ i ], function ( buffer ) {

					vmds.push( parser.parseVmd( buffer, true ) );

					if ( vmds.length === vmdNum ) onLoad( parser.mergeVmds( vmds ) );

				}, onProgress, onError );

			}

		},

		/**
		 * Loads .vpd file as an Object.
		 *
		 * @param {string} url - url to .vpd file
		 * @param {boolean} isUnicode
		 * @param {function} onLoad
		 * @param {function} onProgress
		 * @param {function} onError
		 */
		loadVPD: function ( url, isUnicode, onLoad, onProgress, onError ) {

			var parser = this._getParser();

			this.loader
				.setMimeType( isUnicode ? undefined : 'text/plain; charset=shift_jis' )
				.setResponseType( 'text' )
				.load( url, function ( text ) {

					onLoad( parser.parseVpd( text, true ) );

				}, onProgress, onError );

		},

		// private methods

		_extractExtension: function ( url ) {

			var index = url.lastIndexOf( '.' );
			return index < 0 ? '' : url.slice( index + 1 );

		},

		_getParser: function () {

			if ( this.parser === null ) {

				if ( typeof MMDParser === 'undefined' ) {

					throw new Error( 'THREE.MMDLoader: Import MMDParser https://github.com/takahirox/mmd-parser' );

				}

				this.parser = new MMDParser.Parser();

			}

			return this.parser;

		}

	};

	// Utilities

	/*
	 * base64 encoded defalut toon textures toon00.bmp - toon10.bmp.
	 * We don't need to request external toon image files.
	 * This idea is from http://www20.atpages.jp/katwat/three.js_r58/examples/mytest37/mmd.three.js
	 */
	var DEFAULT_TOON_TEXTURES = [
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAN0lEQVRYR+3WQREAMBACsZ5/bWiiMvgEBTt5cW37hjsBBAgQIECAwFwgyfYPCCBAgAABAgTWAh8aBHZBl14e8wAAAABJRU5ErkJggg==',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVRYR+3WMREAMAwDsYY/yoDI7MLwIiP40+RJklfcCCBAgAABAgTqArfb/QMCCBAgQIAAgbbAB3z/e0F3js2cAAAAAElFTkSuQmCC',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAN0lEQVRYR+3WQREAMBACsZ5/B5ilMvgEBTt5cW37hjsBBAgQIECAwFwgyfYPCCBAgAABAgTWAh81dWyx0gFwKAAAAABJRU5ErkJggg==',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOklEQVRYR+3WoREAMAwDsWb/UQtCy9wxTOQJ/oQ8SXKKGwEECBAgQIBAXeDt7f4BAQQIECBAgEBb4AOz8Hzx7WLY4wAAAABJRU5ErkJggg==',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABPUlEQVRYR+1XwW7CMAy1+f9fZOMysSEOEweEOPRNdm3HbdOyIhAcklPrOs/PLy9RygBALxzcCDQFmgJNgaZAU6Ap0BR4PwX8gsRMVLssMRH5HcpzJEaWL7EVg9F1IHRlyqQohgVr4FGUlUcMJSjcUlDw0zvjeun70cLWmneoyf7NgBTQSniBTQQSuJAZsOnnaczjIMb5hCiuHKxokCrJfVnrctyZL0PkJAJe1HMil4nxeyi3Ypfn1kX51jpPvo/JeCNC4PhVdHdJw2XjBR8brF8PEIhNVn12AgP7uHsTBguBn53MUZCqv7Lp07Pn5k1Ro+uWmUNn7D+M57rtk7aG0Vo73xyF/fbFf0bPJjDXngnGocDTdFhygZjwUQrMNrDcmZlQT50VJ/g/UwNyHpu778+yW+/ksOz/BFo54P4AsUXMfRq7XWsAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACMElEQVRYR+2Xv4pTQRTGf2dubhLdICiii2KnYKHVolhauKWPoGAnNr6BD6CvIVaihYuI2i1ia0BY0MZGRHQXjZj/mSPnnskfNWiWZUlzJ5k7M2cm833nO5Mziej2DWWJRUoCpQKlAntSQCqgw39/iUWAGmh37jrRnVsKlgpiqmkoGVABA7E57fvY+pJDdgKqF6HzFCSADkDq+F6AHABtQ+UMVE5D7zXod7fFNhTEckTbj5XQgHzNN+5tQvc5NG7C6BNkp6D3EmpXHDR+dQAjFLchW3VS9rlw3JBh+B7ys5Cf9z0GW1C/7P32AyBAOAz1q4jGliIH3YPuBnSfQX4OGreTIgEYQb/pBDtPnEQ4CivXYPAWBk13oHrB54yA9QuSn2H4AcKRpEILDt0BUzj+RLR1V5EqjD66NPRBVpLcQwjHoHYJOhsQv6U4mnzmrIXJCFr4LDwm/xBUoboG9XX4cc9VKdYoSA2yk5NQLJaKDUjTBoveG3Z2TElTxwjNK4M3LEZgUdDdruvcXzKBpStgp2NPiWi3ks9ZXxIoFVi+AvHLdc9TqtjL3/aYjpPlrzOcEnK62Szhimdd7xX232zFDTgtxezOu3WNMRLjiKgjtOhHVMd1loynVHvOgjuIIJMaELEqhJAV/RCSLbWTcfPFakFgFlALTRRvx+ok6Hlp/Q+v3fmx90bMyUzaEAhmM3KvHlXTL5DxnbGf/1M8RNNACLL5MNtPxP/mypJAqcDSFfgFhpYqWUzhTEAAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII=',
		'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVRYR+3QQREAAAzCsOFfNJPBJ1XQS9r2hsUAAQIECBAgQIAAAQIECBAgsBZ4MUx/ofm2I/kAAAAASUVORK5CYII='
	];

	// Builders. They build Three.js object from Object data parsed by MMDParser.

	/**
	 * @param {THREE.LoadingManager} manager
	 */
	function MeshBuilder( manager ) {

		this.geometryBuilder = new GeometryBuilder();
		this.materialBuilder = new MaterialBuilder( manager );

	}

	MeshBuilder.prototype = {

		constructor: MeshBuilder,

		crossOrigin: 'anonymous',

		/**
		 * @param {string} crossOrigin
		 * @return {MeshBuilder}
		 */
		setCrossOrigin: function ( crossOrigin ) {

			this.crossOrigin = crossOrigin;
			return this;

		},

		/**
		 * @param {Object} data - parsed PMD/PMX data
		 * @param {string} texturePath
		 * @param {function} onProgress
		 * @param {function} onError
		 * @return {THREE.SkinnedMesh}
		 */
		build: function ( data, texturePath, onProgress, onError ) {

			var geometry = this.geometryBuilder.build( data );
			var material = this.materialBuilder
				.setCrossOrigin( this.crossOrigin )
				.setTexturePath( texturePath )
				.build( data, geometry, onProgress, onError );

			var mesh = new THREE.SkinnedMesh( geometry, material );

			// console.log( mesh ); // for console debug

			return mesh;

		}

	};

	//

	function GeometryBuilder() {

	}

	GeometryBuilder.prototype = {

		constructor: GeometryBuilder,

		/**
		 * @param {Object} data - parsed PMD/PMX data
		 * @return {THREE.BufferGeometry}
		 */
		build: function ( data ) {

			// for geometry
			var positions = [];
			var uvs = [];
			var normals = [];

			var indices = [];

			var groups = [];

			var bones = [];
			var skinIndices = [];
			var skinWeights = [];

			var morphTargets = [];
			var morphPositions = [];

			var iks = [];
			var grants = [];

			var rigidBodies = [];
			var constraints = [];

			// for work
			var offset = 0;
			var boneTypeTable = {};

			// positions, normals, uvs, skinIndices, skinWeights

			for ( var i = 0; i < data.metadata.vertexCount; i ++ ) {

				var v = data.vertices[ i ];

				for ( var j = 0, jl = v.position.length; j < jl; j ++ ) {

					positions.push( v.position[ j ] );

				}

				for ( var j = 0, jl = v.normal.length; j < jl; j ++ ) {

					normals.push( v.normal[ j ] );

				}

				for ( var j = 0, jl = v.uv.length; j < jl; j ++ ) {

					uvs.push( v.uv[ j ] );

				}

				for ( var j = 0; j < 4; j ++ ) {

					skinIndices.push( v.skinIndices.length - 1 >= j ? v.skinIndices[ j ] : 0.0 );

				}

				for ( var j = 0; j < 4; j ++ ) {

					skinWeights.push( v.skinWeights.length - 1 >= j ? v.skinWeights[ j ] : 0.0 );

				}

			}

			// indices

			for ( var i = 0; i < data.metadata.faceCount; i ++ ) {

				var face = data.faces[ i ];

				for ( var j = 0, jl = face.indices.length; j < jl; j ++ ) {

					indices.push( face.indices[ j ] );

				}

			}

			// groups

			for ( var i = 0; i < data.metadata.materialCount; i ++ ) {

				var material = data.materials[ i ];

				groups.push( {
					offset: offset * 3,
					count: material.faceCount * 3
				} );

				offset += material.faceCount;

			}

			// bones

			for ( var i = 0; i < data.metadata.rigidBodyCount; i ++ ) {

				var body = data.rigidBodies[ i ];
				var value = boneTypeTable[ body.boneIndex ];

				// keeps greater number if already value is set without any special reasons
				value = value === undefined ? body.type : Math.max( body.type, value );

				boneTypeTable[ body.boneIndex ] = value;

			}

			for ( var i = 0; i < data.metadata.boneCount; i ++ ) {

				var boneData = data.bones[ i ];

				var bone = {
					parent: boneData.parentIndex,
					name: boneData.name,
					pos: boneData.position.slice( 0, 3 ),
					rotq: [ 0, 0, 0, 1 ],
					scl: [ 1, 1, 1 ],
					rigidBodyType: boneTypeTable[ i ] !== undefined ? boneTypeTable[ i ] : - 1
				};

				if ( bone.parent !== - 1 ) {

					bone.pos[ 0 ] -= data.bones[ bone.parent ].position[ 0 ];
					bone.pos[ 1 ] -= data.bones[ bone.parent ].position[ 1 ];
					bone.pos[ 2 ] -= data.bones[ bone.parent ].position[ 2 ];

				}

				bones.push( bone );

			}

			// iks

			// TODO: remove duplicated codes between PMD and PMX
			if ( data.metadata.format === 'pmd' ) {

				for ( var i = 0; i < data.metadata.ikCount; i ++ ) {

					var ik = data.iks[ i ];

					var param = {
						target: ik.target,
						effector: ik.effector,
						iteration: ik.iteration,
						maxAngle: ik.maxAngle * 4,
						links: []
					};

					for ( var j = 0, jl = ik.links.length; j < jl; j ++ ) {

						var link = {};
						link.index = ik.links[ j ].index;
						link.enabled = true;

						if ( data.bones[ link.index ].name.indexOf( 'ひざ' ) >= 0 ) {

							link.limitation = new THREE.Vector3( 1.0, 0.0, 0.0 );

						}

						param.links.push( link );

					}

					iks.push( param );

				}

			} else {

				for ( var i = 0; i < data.metadata.boneCount; i ++ ) {

					var ik = data.bones[ i ].ik;

					if ( ik === undefined ) continue;

					var param = {
						target: i,
						effector: ik.effector,
						iteration: ik.iteration,
						maxAngle: ik.maxAngle,
						links: []
					};

					for ( var j = 0, jl = ik.links.length; j < jl; j ++ ) {

						var link = {};
						link.index = ik.links[ j ].index;
						link.enabled = true;

						if ( ik.links[ j ].angleLimitation === 1 ) {

							// Revert if rotationMin/Max doesn't work well
							// link.limitation = new THREE.Vector3( 1.0, 0.0, 0.0 );

							var rotationMin = ik.links[ j ].lowerLimitationAngle;
							var rotationMax = ik.links[ j ].upperLimitationAngle;

							// Convert Left to Right coordinate by myself because
							// MMDParser doesn't convert. It's a MMDParser's bug

							var tmp1 = - rotationMax[ 0 ];
							var tmp2 = - rotationMax[ 1 ];
							rotationMax[ 0 ] = - rotationMin[ 0 ];
							rotationMax[ 1 ] = - rotationMin[ 1 ];
							rotationMin[ 0 ] = tmp1;
							rotationMin[ 1 ] = tmp2;

							link.rotationMin = new THREE.Vector3().fromArray( rotationMin );
							link.rotationMax = new THREE.Vector3().fromArray( rotationMax );

						}

						param.links.push( link );

					}

					iks.push( param );

				}

			}

			// grants

			if ( data.metadata.format === 'pmx' ) {

				for ( var i = 0; i < data.metadata.boneCount; i ++ ) {

					var boneData = data.bones[ i ];
					var grant = boneData.grant;

					if ( grant === undefined ) continue;

					var param = {
						index: i,
						parentIndex: grant.parentIndex,
						ratio: grant.ratio,
						isLocal: grant.isLocal,
						affectRotation: grant.affectRotation,
						affectPosition: grant.affectPosition,
						transformationClass: boneData.transformationClass
					};

					grants.push( param );

				}

				grants.sort( function ( a, b ) {

					return a.transformationClass - b.transformationClass;

				} );

			}

			// morph

			function updateAttributes( attribute, morph, ratio ) {

				for ( var i = 0; i < morph.elementCount; i ++ ) {

					var element = morph.elements[ i ];

					var index;

					if ( data.metadata.format === 'pmd' ) {

						index = data.morphs[ 0 ].elements[ element.index ].index;

					} else {

						index = element.index;

					}

					attribute.array[ index * 3 + 0 ] += element.position[ 0 ] * ratio;
					attribute.array[ index * 3 + 1 ] += element.position[ 1 ] * ratio;
					attribute.array[ index * 3 + 2 ] += element.position[ 2 ] * ratio;

				}

			}

			for ( var i = 0; i < data.metadata.morphCount; i ++ ) {

				var morph = data.morphs[ i ];
				var params = { name: morph.name };

				var attribute = new THREE.Float32BufferAttribute( data.metadata.vertexCount * 3, 3 );
				attribute.name = morph.name;

				for ( var j = 0; j < data.metadata.vertexCount * 3; j ++ ) {

					attribute.array[ j ] = positions[ j ];

				}

				if ( data.metadata.format === 'pmd' ) {

					if ( i !== 0 ) {

						updateAttributes( attribute, morph, 1.0 );

					}

				} else {

					if ( morph.type === 0 ) { // group

						for ( var j = 0; j < morph.elementCount; j ++ ) {

							var morph2 = data.morphs[ morph.elements[ j ].index ];
							var ratio = morph.elements[ j ].ratio;

							if ( morph2.type === 1 ) {

								updateAttributes( attribute, morph2, ratio );

							} else {

								// TODO: implement

							}

						}

					} else if ( morph.type === 1 ) { // vertex

						updateAttributes( attribute, morph, 1.0 );

					} else if ( morph.type === 2 ) { // bone

						// TODO: implement

					} else if ( morph.type === 3 ) { // uv

						// TODO: implement

					} else if ( morph.type === 4 ) { // additional uv1

						// TODO: implement

					} else if ( morph.type === 5 ) { // additional uv2

						// TODO: implement

					} else if ( morph.type === 6 ) { // additional uv3

						// TODO: implement

					} else if ( morph.type === 7 ) { // additional uv4

						// TODO: implement

					} else if ( morph.type === 8 ) { // material

						// TODO: implement

					}

				}

				morphTargets.push( params );
				morphPositions.push( attribute );

			}

			// rigid bodies from rigidBodies field.

			for ( var i = 0; i < data.metadata.rigidBodyCount; i ++ ) {

				var rigidBody = data.rigidBodies[ i ];
				var params = {};

				for ( var key in rigidBody ) {

					params[ key ] = rigidBody[ key ];

				}

				/*
				 * RigidBody position parameter in PMX seems global position
				 * while the one in PMD seems offset from corresponding bone.
				 * So unify being offset.
				 */
				if ( data.metadata.format === 'pmx' ) {

					if ( params.boneIndex !== - 1 ) {

						var bone = data.bones[ params.boneIndex ];
						params.position[ 0 ] -= bone.position[ 0 ];
						params.position[ 1 ] -= bone.position[ 1 ];
						params.position[ 2 ] -= bone.position[ 2 ];

					}

				}

				rigidBodies.push( params );

			}

			// constraints from constraints field.

			for ( var i = 0; i < data.metadata.constraintCount; i ++ ) {

				var constraint = data.constraints[ i ];
				var params = {};

				for ( var key in constraint ) {

					params[ key ] = constraint[ key ];

				}

				var bodyA = rigidBodies[ params.rigidBodyIndex1 ];
				var bodyB = rigidBodies[ params.rigidBodyIndex2 ];

				// Refer to http://www20.atpages.jp/katwat/wp/?p=4135
				if ( bodyA.type !== 0 && bodyB.type === 2 ) {

					if ( bodyA.boneIndex !== - 1 && bodyB.boneIndex !== - 1 &&
					     data.bones[ bodyB.boneIndex ].parentIndex === bodyA.boneIndex ) {

						bodyB.type = 1;

					}

				}

				constraints.push( params );

			}

			// build BufferGeometry.

			var geometry = new THREE.BufferGeometry();

			geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
			geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
			geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
			geometry.setAttribute( 'skinIndex', new THREE.Uint16BufferAttribute( skinIndices, 4 ) );
			geometry.setAttribute( 'skinWeight', new THREE.Float32BufferAttribute( skinWeights, 4 ) );
			geometry.setIndex( indices );

			for ( var i = 0, il = groups.length; i < il; i ++ ) {

				geometry.addGroup( groups[ i ].offset, groups[ i ].count, i );

			}

			geometry.bones = bones;

			geometry.morphTargets = morphTargets;
			geometry.morphAttributes.position = morphPositions;

			geometry.userData.MMD = {
				bones: bones,
				iks: iks,
				grants: grants,
				rigidBodies: rigidBodies,
				constraints: constraints,
				format: data.metadata.format
			};

			geometry.computeBoundingSphere();

			return geometry;

		}

	};

	//

	/**
	 * @param {THREE.LoadingManager} manager
	 */
	function MaterialBuilder( manager ) {

		this.manager = manager;

		this.textureLoader = new THREE.TextureLoader( this.manager );
		this.tgaLoader = null; // lazy generation

	}

	MaterialBuilder.prototype = {

		constructor: MaterialBuilder,

		crossOrigin: 'anonymous',

		texturePath: undefined,

		/**
		 * @param {string} crossOrigin
		 * @return {MaterialBuilder}
		 */
		setCrossOrigin: function ( crossOrigin ) {

			this.crossOrigin = crossOrigin;
			return this;

		},

		/**
		 * @param {string} texturePath
		 * @return {MaterialBuilder}
		 */
		setTexturePath: function ( texturePath ) {

			this.texturePath = texturePath;
			return this;

		},

		/**
		 * @param {Object} data - parsed PMD/PMX data
		 * @param {THREE.BufferGeometry} geometry - some properties are dependend on geometry
		 * @param {function} onProgress
		 * @param {function} onError
		 * @return {Array<THREE.MeshToonMaterial>}
		 */
		build: function ( data, geometry, onProgress, onError ) {

			var materials = [];

			var textures = {};

			this.textureLoader.setCrossOrigin( this.crossOrigin );

			// materials

			for ( var i = 0; i < data.metadata.materialCount; i ++ ) {

				var material = data.materials[ i ];

				var params = { userData: {} };

				if ( material.name !== undefined ) params.name = material.name;

				/*
				 * Color
				 *
				 * MMD         MeshToonMaterial
				 * diffuse  -  color
				 * specular -  specular
				 * ambient  -  emissive * a
				 *               (a = 1.0 without map texture or 0.2 with map texture)
				 *
				 * MeshToonMaterial doesn't have ambient. Set it to emissive instead.
				 * It'll be too bright if material has map texture so using coef 0.2.
				 */
				params.color = new THREE.Color().fromArray( material.diffuse );
				params.opacity = material.diffuse[ 3 ];
				params.specular = new THREE.Color().fromArray( material.specular );
				params.emissive = new THREE.Color().fromArray( material.ambient );
				params.shininess = Math.max( material.shininess, 1e-4 ); // to prevent pow( 0.0, 0.0 )
				params.transparent = params.opacity !== 1.0;

				//

				params.skinning = geometry.bones.length > 0 ? true : false;
				params.morphTargets = geometry.morphTargets.length > 0 ? true : false;
				params.lights = true;
				params.fog = true;

				// blend

				params.blending = THREE.CustomBlending;
				params.blendSrc = THREE.SrcAlphaFactor;
				params.blendDst = THREE.OneMinusSrcAlphaFactor;
				params.blendSrcAlpha = THREE.SrcAlphaFactor;
				params.blendDstAlpha = THREE.DstAlphaFactor;

				// side

				if ( data.metadata.format === 'pmx' && ( material.flag & 0x1 ) === 1 ) {

					params.side = THREE.DoubleSide;

				} else {

					params.side = params.opacity === 1.0 ? THREE.FrontSide : THREE.DoubleSide;

				}

				if ( data.metadata.format === 'pmd' ) {

					// map, envMap

					if ( material.fileName ) {

						var fileName = material.fileName;
						var fileNames = fileName.split( '*' );

						// fileNames[ 0 ]: mapFileName
						// fileNames[ 1 ]: envMapFileName( optional )

						params.map = this._loadTexture( fileNames[ 0 ], textures );

						if ( fileNames.length > 1 ) {

							var extension = fileNames[ 1 ].slice( - 4 ).toLowerCase();

							params.envMap = this._loadTexture(
								fileNames[ 1 ],
								textures,
								{ sphericalReflectionMapping: true }
							);

							params.combine = extension === '.sph'
								? THREE.MultiplyOperation
								: THREE.AddOperation;

						}

					}

					// gradientMap

					var toonFileName = ( material.toonIndex === - 1 )
						? 'toon00.bmp'
						: data.toonTextures[ material.toonIndex ].fileName;

					params.gradientMap = this._loadTexture(
						toonFileName,
						textures,
						{
							isToonTexture: true,
							isDefaultToonTexture: this._isDefaultToonTexture( toonFileName )
						}
					);

					// parameters for OutlineEffect

					params.userData.outlineParameters = {
						thickness: material.edgeFlag === 1 ? 0.003 : 0.0,
						color: [ 0, 0, 0 ],
						alpha: 1.0,
						visible: material.edgeFlag === 1
					};

				} else {

					// map

					if ( material.textureIndex !== - 1 ) {

						params.map = this._loadTexture( data.textures[ material.textureIndex ], textures );

					}

					// envMap TODO: support m.envFlag === 3

					if ( material.envTextureIndex !== - 1 && ( material.envFlag === 1 || material.envFlag == 2 ) ) {

						params.envMap = this._loadTexture(
							data.textures[ material.envTextureIndex ],
							textures, { sphericalReflectionMapping: true }
						);

						params.combine = material.envFlag === 1
							? THREE.MultiplyOperation
							: THREE.AddOperation;

					}

					// gradientMap

					var toonFileName, isDefaultToon;

					if ( material.toonIndex === - 1 || material.toonFlag !== 0 ) {

						toonFileName = 'toon' + ( '0' + ( material.toonIndex + 1 ) ).slice( - 2 ) + '.bmp';
						isDefaultToon = true;

					} else {

						toonFileName = data.textures[ material.toonIndex ];
						isDefaultToon = false;

					}

					params.gradientMap = this._loadTexture(
						toonFileName,
						textures,
						{
							isToonTexture: true,
							isDefaultToonTexture: isDefaultToon
						}
					);

					// parameters for OutlineEffect
					params.userData.outlineParameters = {
						thickness: material.edgeSize / 300, // TODO: better calculation?
						color: material.edgeColor.slice( 0, 3 ),
						alpha: material.edgeColor[ 3 ],
						visible: ( material.flag & 0x10 ) !== 0 && material.edgeSize > 0.0
					};

				}

				if ( params.map !== undefined ) {

					if ( ! params.transparent ) {

						this._checkImageTransparency( params.map, geometry, i );

					}

					params.emissive.multiplyScalar( 0.2 );

				}

				materials.push( new THREE.MeshToonMaterial( params ) );

			}

			if ( data.metadata.format === 'pmx' ) {

				// set transparent true if alpha morph is defined.

				function checkAlphaMorph( elements, materials ) {

					for ( var i = 0, il = elements.length; i < il; i ++ ) {

						var element = elements[ i ];

						if ( element.index === - 1 ) continue;

						var material = materials[ element.index ];

						if ( material.opacity !== element.diffuse[ 3 ] ) {

							material.transparent = true;

						}

					}

				}

				for ( var i = 0, il = data.morphs.length; i < il; i ++ ) {

					var morph = data.morphs[ i ];
					var elements = morph.elements;

					if ( morph.type === 0 ) {

						for ( var j = 0, jl = elements.length; j < jl; j ++ ) {

							var morph2 = data.morphs[ elements[ j ].index ];

							if ( morph2.type !== 8 ) continue;

							checkAlphaMorph( morph2.elements, materials );

						}

					} else if ( morph.type === 8 ) {

						checkAlphaMorph( elements, materials );

					}

				}

			}

			return materials;

		},

		// private methods

		_getTGALoader: function () {

			if ( this.tgaLoader === null ) {

				if ( THREE.TGALoader === undefined ) {

					throw new Error( 'THREE.MMDLoader: Import THREE.TGALoader' );

				}

				this.tgaLoader = new THREE.TGALoader( this.manager );

			}

			return this.tgaLoader;

		},

		_isDefaultToonTexture: function ( name ) {

			if ( name.length !== 10 ) return false;

			return /toon(10|0[0-9])\.bmp/.test( name );

		},

		_loadTexture: function ( filePath, textures, params, onProgress, onError ) {

			params = params || {};

			var scope = this;

			var fullPath;

			if ( params.isDefaultToonTexture === true ) {

				var index;

				try {

					index = parseInt( filePath.match( 'toon([0-9]{2})\.bmp$' )[ 1 ] );

				} catch ( e ) {

					console.warn( 'THREE.MMDLoader: ' + filePath + ' seems like a '
						+ 'not right default texture path. Using toon00.bmp instead.' );

					index = 0;

				}

				fullPath = DEFAULT_TOON_TEXTURES[ index ];

			} else {

				fullPath = this.texturePath + filePath;

			}

			if ( textures[ fullPath ] !== undefined ) return textures[ fullPath ];

			var loader = THREE.Loader.Handlers.get( fullPath );

			if ( loader === null ) {

				loader = ( filePath.slice( - 4 ).toLowerCase() === '.tga' )
					? this._getTGALoader()
					: this.textureLoader;

			}

			var texture = loader.load( fullPath, function ( t ) {

				// MMD toon texture is Axis-Y oriented
				// but Three.js gradient map is Axis-X oriented.
				// So here replaces the toon texture image with the rotated one.
				if ( params.isToonTexture === true ) {

					t.image = scope._getRotatedImage( t.image );

				}

				t.flipY = false;
				t.wrapS = THREE.RepeatWrapping;
				t.wrapT = THREE.RepeatWrapping;

				for ( var i = 0; i < texture.readyCallbacks.length; i ++ ) {

					texture.readyCallbacks[ i ]( texture );

				}

				delete texture.readyCallbacks;

			}, onProgress, onError );

			if ( params.sphericalReflectionMapping === true ) {

				texture.mapping = THREE.SphericalReflectionMapping;

			}

			texture.readyCallbacks = [];

			textures[ fullPath ] = texture;

			return texture;

		},

		_getRotatedImage: function ( image ) {

			var canvas = document.createElement( 'canvas' );
			var context = canvas.getContext( '2d' );

			var width = image.width;
			var height = image.height;

			canvas.width = width;
			canvas.height = height;

			context.clearRect( 0, 0, width, height );
			context.translate( width / 2.0, height / 2.0 );
			context.rotate( 0.5 * Math.PI ); // 90.0 * Math.PI / 180.0
			context.translate( - width / 2.0, - height / 2.0 );
			context.drawImage( image, 0, 0 );

			return context.getImageData( 0, 0, width, height );

		},

		// Check if the partial image area used by the texture is transparent.
		_checkImageTransparency: function ( map, geometry, groupIndex ) {

			map.readyCallbacks.push( function ( texture ) {

				// Is there any efficient ways?
				function createImageData( image ) {

					var canvas = document.createElement( 'canvas' );
					canvas.width = image.width;
					canvas.height = image.height;

					var context = canvas.getContext( '2d' );
					context.drawImage( image, 0, 0 );

					return context.getImageData( 0, 0, canvas.width, canvas.height );

				}

				function detectImageTransparency( image, uvs, indices ) {

					var width = image.width;
					var height = image.height;
					var data = image.data;
					var threshold = 253;

					if ( data.length / ( width * height ) !== 4 ) return false;

					for ( var i = 0; i < indices.length; i += 3 ) {

						var centerUV = { x: 0.0, y: 0.0 };

						for ( var j = 0; j < 3; j ++ ) {

							var index = indices[ i * 3 + j ];
							var uv = { x: uvs[ index * 2 + 0 ], y: uvs[ index * 2 + 1 ] };

							if ( getAlphaByUv( image, uv ) < threshold ) return true;

							centerUV.x += uv.x;
							centerUV.y += uv.y;

						}

						centerUV.x /= 3;
						centerUV.y /= 3;

						if ( getAlphaByUv( image, centerUV ) < threshold ) return true;

					}

					return false;

				}

				/*
				 * This method expects
				 *   texture.flipY = false
				 *   texture.wrapS = THREE.RepeatWrapping
				 *   texture.wrapT = THREE.RepeatWrapping
				 * TODO: more precise
				 */
				function getAlphaByUv( image, uv ) {

					var width = image.width;
					var height = image.height;

					var x = Math.round( uv.x * width ) % width;
					var y = Math.round( uv.y * height ) % height;

					if ( x < 0 ) x += width;
					if ( y < 0 ) y += height;

					var index = y * width + x;

					return image.data[ index * 4 + 3 ];

				}

				var imageData = texture.image.data !== undefined
					? texture.image
					: createImageData( texture.image );

				var group = geometry.groups[ groupIndex ];

				if ( detectImageTransparency(
					imageData,
					geometry.attributes.uv.array,
					geometry.index.array.slice( group.start, group.start + group.count ) ) ) {

					map.transparent = true;

				}

			} );

		}

	};

	//

	function AnimationBuilder() {

	}

	AnimationBuilder.prototype = {

		constructor: AnimationBuilder,

		/**
		 * @param {Object} vmd - parsed VMD data
		 * @param {THREE.SkinnedMesh} mesh - tracks will be fitting to mesh
		 * @return {THREE.AnimationClip}
		 */
		build: function ( vmd, mesh ) {

			// combine skeletal and morph animations

			var tracks = this.buildSkeletalAnimation( vmd, mesh ).tracks;
			var tracks2 = this.buildMorphAnimation( vmd, mesh ).tracks;

			for ( var i = 0, il = tracks2.length; i < il; i ++ ) {

				tracks.push( tracks2[ i ] );

			}

			return new THREE.AnimationClip( '', - 1, tracks );

		},

		/**
		 * @param {Object} vmd - parsed VMD data
		 * @param {THREE.SkinnedMesh} mesh - tracks will be fitting to mesh
		 * @return {THREE.AnimationClip}
		 */
		buildSkeletalAnimation: function ( vmd, mesh ) {

			function pushInterpolation( array, interpolation, index ) {

				array.push( interpolation[ index + 0 ] / 127 ); // x1
				array.push( interpolation[ index + 8 ] / 127 ); // x2
				array.push( interpolation[ index + 4 ] / 127 ); // y1
				array.push( interpolation[ index + 12 ] / 127 ); // y2

			}

			var tracks = [];

			var motions = {};
			var bones = mesh.skeleton.bones;
			var boneNameDictionary = {};

			for ( var i = 0, il = bones.length; i < il; i ++ ) {

				boneNameDictionary[ bones[ i ].name ] = true;

			}

			for ( var i = 0; i < vmd.metadata.motionCount; i ++ ) {

				var motion = vmd.motions[ i ];
				var boneName = motion.boneName;

				if ( boneNameDictionary[ boneName ] === undefined ) continue;

				motions[ boneName ] = motions[ boneName ] || [];
				motions[ boneName ].push( motion );

			}

			for ( var key in motions ) {

				var array = motions[ key ];

				array.sort( function ( a, b ) {

					return a.frameNum - b.frameNum;

				} );

				var times = [];
				var positions = [];
				var rotations = [];
				var pInterpolations = [];
				var rInterpolations = [];

				var basePosition = mesh.skeleton.getBoneByName( key ).position.toArray();

				for ( var i = 0, il = array.length; i < il; i ++ ) {

					var time = array[ i ].frameNum / 30;
					var position = array[ i ].position;
					var rotation = array[ i ].rotation;
					var interpolation = array[ i ].interpolation;

					times.push( time );

					for ( var j = 0; j < 3; j ++ ) positions.push( basePosition[ j ] + position[ j ] );
					for ( var j = 0; j < 4; j ++ ) rotations.push( rotation[ j ] );
					for ( var j = 0; j < 3; j ++ ) pushInterpolation( pInterpolations, interpolation, j );

					pushInterpolation( rInterpolations, interpolation, 3 );

				}

				var targetName = '.bones[' + key + ']';

				tracks.push( this._createTrack( targetName + '.position', THREE.VectorKeyframeTrack, times, positions, pInterpolations ) );
				tracks.push( this._createTrack( targetName + '.quaternion', THREE.QuaternionKeyframeTrack, times, rotations, rInterpolations ) );

			}

			return new THREE.AnimationClip( '', - 1, tracks );

		},

		/**
		 * @param {Object} vmd - parsed VMD data
		 * @param {THREE.SkinnedMesh} mesh - tracks will be fitting to mesh
		 * @return {THREE.AnimationClip}
		 */
		buildMorphAnimation: function ( vmd, mesh ) {

			var tracks = [];

			var morphs = {};
			var morphTargetDictionary = mesh.morphTargetDictionary;

			for ( var i = 0; i < vmd.metadata.morphCount; i ++ ) {

				var morph = vmd.morphs[ i ];
				var morphName = morph.morphName;

				if ( morphTargetDictionary[ morphName ] === undefined ) continue;

				morphs[ morphName ] = morphs[ morphName ] || [];
				morphs[ morphName ].push( morph );

			}

			for ( var key in morphs ) {

				var array = morphs[ key ];

				array.sort( function ( a, b ) {

					return a.frameNum - b.frameNum;

				} );

				var times = [];
				var values = [];

				for ( var i = 0, il = array.length; i < il; i ++ ) {

					times.push( array[ i ].frameNum / 30 );
					values.push( array[ i ].weight );

				}

				tracks.push( new THREE.NumberKeyframeTrack( '.morphTargetInfluences[' + morphTargetDictionary[ key ] + ']', times, values ) );

			}

			return new THREE.AnimationClip( '', - 1, tracks );

		},

		/**
		 * @param {Object} vmd - parsed VMD data
		 * @return {THREE.AnimationClip}
		 */
		buildCameraAnimation: function ( vmd ) {

			function pushVector3( array, vec ) {

				array.push( vec.x );
				array.push( vec.y );
				array.push( vec.z );

			}

			function pushQuaternion( array, q ) {

				array.push( q.x );
				array.push( q.y );
				array.push( q.z );
				array.push( q.w );

			}

			function pushInterpolation( array, interpolation, index ) {

				array.push( interpolation[ index * 4 + 0 ] / 127 ); // x1
				array.push( interpolation[ index * 4 + 1 ] / 127 ); // x2
				array.push( interpolation[ index * 4 + 2 ] / 127 ); // y1
				array.push( interpolation[ index * 4 + 3 ] / 127 ); // y2

			}

			var tracks = [];

			var cameras = vmd.cameras === undefined ? [] : vmd.cameras.slice();

			cameras.sort( function ( a, b ) {

				return a.frameNum - b.frameNum;

			} );

			var times = [];
			var centers = [];
			var quaternions = [];
			var positions = [];
			var fovs = [];

			var cInterpolations = [];
			var qInterpolations = [];
			var pInterpolations = [];
			var fInterpolations = [];

			var quaternion = new THREE.Quaternion();
			var euler = new THREE.Euler();
			var position = new THREE.Vector3();
			var center = new THREE.Vector3();

			for ( var i = 0, il = cameras.length; i < il; i ++ ) {

				var motion = cameras[ i ];

				var time = motion.frameNum / 30;
				var pos = motion.position;
				var rot = motion.rotation;
				var distance = motion.distance;
				var fov = motion.fov;
				var interpolation = motion.interpolation;

				times.push( time );

				position.set( 0, 0, - distance );
				center.set( pos[ 0 ], pos[ 1 ], pos[ 2 ] );

				euler.set( - rot[ 0 ], - rot[ 1 ], - rot[ 2 ] );
				quaternion.setFromEuler( euler );

				position.add( center );
				position.applyQuaternion( quaternion );

				pushVector3( centers, center );
				pushQuaternion( quaternions, quaternion );
				pushVector3( positions, position );

				fovs.push( fov );

				for ( var j = 0; j < 3; j ++ ) {

					pushInterpolation( cInterpolations, interpolation, j );

				}

				pushInterpolation( qInterpolations, interpolation, 3 );

				// use the same parameter for x, y, z axis.
				for ( var j = 0; j < 3; j ++ ) {

					pushInterpolation( pInterpolations, interpolation, 4 );

				}

				pushInterpolation( fInterpolations, interpolation, 5 );

			}

			var tracks = [];

			// I expect an object whose name 'target' exists under THREE.Camera
			tracks.push( this._createTrack( 'target.position', THREE.VectorKeyframeTrack, times, centers, cInterpolations ) );

			tracks.push( this._createTrack( '.quaternion', THREE.QuaternionKeyframeTrack, times, quaternions, qInterpolations ) );
			tracks.push( this._createTrack( '.position', THREE.VectorKeyframeTrack, times, positions, pInterpolations ) );
			tracks.push( this._createTrack( '.fov', THREE.NumberKeyframeTrack, times, fovs, fInterpolations ) );

			return new THREE.AnimationClip( '', - 1, tracks );

		},

		// private method

		_createTrack: function ( node, typedKeyframeTrack, times, values, interpolations ) {

			/*
			 * optimizes here not to let KeyframeTrackPrototype optimize
			 * because KeyframeTrackPrototype optimizes times and values but
			 * doesn't optimize interpolations.
			 */
			if ( times.length > 2 ) {

				times = times.slice();
				values = values.slice();
				interpolations = interpolations.slice();

				var stride = values.length / times.length;
				var interpolateStride = interpolations.length / times.length;

				var index = 1;

				for ( var aheadIndex = 2, endIndex = times.length; aheadIndex < endIndex; aheadIndex ++ ) {

					for ( var i = 0; i < stride; i ++ ) {

						if ( values[ index * stride + i ] !== values[ ( index - 1 ) * stride + i ] ||
							values[ index * stride + i ] !== values[ aheadIndex * stride + i ] ) {

							index ++;
							break;

						}

					}

					if ( aheadIndex > index ) {

						times[ index ] = times[ aheadIndex ];

						for ( var i = 0; i < stride; i ++ ) {

							values[ index * stride + i ] = values[ aheadIndex * stride + i ];

						}

						for ( var i = 0; i < interpolateStride; i ++ ) {

							interpolations[ index * interpolateStride + i ] = interpolations[ aheadIndex * interpolateStride + i ];

						}

					}

				}

				times.length = index + 1;
				values.length = ( index + 1 ) * stride;
				interpolations.length = ( index + 1 ) * interpolateStride;

			}

			var track = new typedKeyframeTrack( node, times, values );

			track.createInterpolant = function InterpolantFactoryMethodCubicBezier( result ) {

				return new CubicBezierInterpolation( this.times, this.values, this.getValueSize(), result, new Float32Array( interpolations ) );

			};

			return track;

		}

	};

	// interpolation

	function CubicBezierInterpolation( parameterPositions, sampleValues, sampleSize, resultBuffer, params ) {

		THREE.Interpolant.call( this, parameterPositions, sampleValues, sampleSize, resultBuffer );

		this.interpolationParams = params;

	}

	CubicBezierInterpolation.prototype = Object.assign( Object.create( THREE.Interpolant.prototype ), {

		constructor: CubicBezierInterpolation,

		interpolate_: function ( i1, t0, t, t1 ) {

			var result = this.resultBuffer;
			var values = this.sampleValues;
			var stride = this.valueSize;
			var params = this.interpolationParams;

			var offset1 = i1 * stride;
			var offset0 = offset1 - stride;

			// No interpolation if next key frame is in one frame in 30fps.
			// This is from MMD animation spec.
			// '1.5' is for precision loss. times are Float32 in Three.js Animation system.
			var weight1 = ( ( t1 - t0 ) < 1 / 30 * 1.5 ) ? 0.0 : ( t - t0 ) / ( t1 - t0 );

			if ( stride === 4 ) { // Quaternion

				var x1 = params[ i1 * 4 + 0 ];
				var x2 = params[ i1 * 4 + 1 ];
				var y1 = params[ i1 * 4 + 2 ];
				var y2 = params[ i1 * 4 + 3 ];

				var ratio = this._calculate( x1, x2, y1, y2, weight1 );

				THREE.Quaternion.slerpFlat( result, 0, values, offset0, values, offset1, ratio );

			} else if ( stride === 3 ) { // Vector3

				for ( var i = 0; i !== stride; ++ i ) {

					var x1 = params[ i1 * 12 + i * 4 + 0 ];
					var x2 = params[ i1 * 12 + i * 4 + 1 ];
					var y1 = params[ i1 * 12 + i * 4 + 2 ];
					var y2 = params[ i1 * 12 + i * 4 + 3 ];

					var ratio = this._calculate( x1, x2, y1, y2, weight1 );

					result[ i ] = values[ offset0 + i ] * ( 1 - ratio ) + values[ offset1 + i ] * ratio;

				}

			} else { // Number

				var x1 = params[ i1 * 4 + 0 ];
				var x2 = params[ i1 * 4 + 1 ];
				var y1 = params[ i1 * 4 + 2 ];
				var y2 = params[ i1 * 4 + 3 ];

				var ratio = this._calculate( x1, x2, y1, y2, weight1 );

				result[ 0 ] = values[ offset0 ] * ( 1 - ratio ) + values[ offset1 ] * ratio;

			}

			return result;

		},

		_calculate: function ( x1, x2, y1, y2, x ) {

			/*
			 * Cubic Bezier curves
			 *   https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Cubic_B.C3.A9zier_curves
			 *
			 * B(t) = ( 1 - t ) ^ 3 * P0
			 *      + 3 * ( 1 - t ) ^ 2 * t * P1
			 *      + 3 * ( 1 - t ) * t^2 * P2
			 *      + t ^ 3 * P3
			 *      ( 0 <= t <= 1 )
			 *
			 * MMD uses Cubic Bezier curves for bone and camera animation interpolation.
			 *   http://d.hatena.ne.jp/edvakf/20111016/1318716097
			 *
			 *    x = ( 1 - t ) ^ 3 * x0
			 *      + 3 * ( 1 - t ) ^ 2 * t * x1
			 *      + 3 * ( 1 - t ) * t^2 * x2
			 *      + t ^ 3 * x3
			 *    y = ( 1 - t ) ^ 3 * y0
			 *      + 3 * ( 1 - t ) ^ 2 * t * y1
			 *      + 3 * ( 1 - t ) * t^2 * y2
			 *      + t ^ 3 * y3
			 *      ( x0 = 0, y0 = 0 )
			 *      ( x3 = 1, y3 = 1 )
			 *      ( 0 <= t, x1, x2, y1, y2 <= 1 )
			 *
			 * Here solves this equation with Bisection method,
			 *   https://en.wikipedia.org/wiki/Bisection_method
			 * gets t, and then calculate y.
			 *
			 * f(t) = 3 * ( 1 - t ) ^ 2 * t * x1
			 *      + 3 * ( 1 - t ) * t^2 * x2
			 *      + t ^ 3 - x = 0
			 *
			 * (Another option: Newton's method
			 *    https://en.wikipedia.org/wiki/Newton%27s_method)
			 */

			var c = 0.5;
			var t = c;
			var s = 1.0 - t;
			var loop = 15;
			var eps = 1e-5;
			var math = Math;

			var sst3, stt3, ttt;

			for ( var i = 0; i < loop; i ++ ) {

				sst3 = 3.0 * s * s * t;
				stt3 = 3.0 * s * t * t;
				ttt = t * t * t;

				var ft = ( sst3 * x1 ) + ( stt3 * x2 ) + ( ttt ) - x;

				if ( math.abs( ft ) < eps ) break;

				c /= 2.0;

				t += ( ft < 0 ) ? c : - c;
				s = 1.0 - t;

			}

			return ( sst3 * y1 ) + ( stt3 * y2 ) + ttt;

		}

	} );

	return MMDLoader;

} )();
( function () {

	const _object_pattern = /^[og]\s*(.+)?/; // mtllib file_reference

	const _material_library_pattern = /^mtllib /; // usemtl material_name

	const _material_use_pattern = /^usemtl /; // usemap map_name

	const _map_use_pattern = /^usemap /;

	const _vA = new THREE.Vector3();

	const _vB = new THREE.Vector3();

	const _vC = new THREE.Vector3();

	const _ab = new THREE.Vector3();

	const _cb = new THREE.Vector3();

	function ParserState() {

		const state = {
			objects: [],
			object: {},
			vertices: [],
			normals: [],
			colors: [],
			uvs: [],
			materials: {},
			materialLibraries: [],
			startObject: function ( name, fromDeclaration ) {

				// If the current object (initial from reset) is not from a g/o declaration in the parsed
				// file. We need to use it for the first parsed g/o to keep things in sync.
				if ( this.object && this.object.fromDeclaration === false ) {

					this.object.name = name;
					this.object.fromDeclaration = fromDeclaration !== false;
					return;

				}

				const previousMaterial = this.object && typeof this.object.currentMaterial === 'function' ? this.object.currentMaterial() : undefined;

				if ( this.object && typeof this.object._finalize === 'function' ) {

					this.object._finalize( true );

				}

				this.object = {
					name: name || '',
					fromDeclaration: fromDeclaration !== false,
					geometry: {
						vertices: [],
						normals: [],
						colors: [],
						uvs: [],
						hasUVIndices: false
					},
					materials: [],
					smooth: true,
					startMaterial: function ( name, libraries ) {

						const previous = this._finalize( false ); // New usemtl declaration overwrites an inherited material, except if faces were declared
						// after the material, then it must be preserved for proper MultiMaterial continuation.


						if ( previous && ( previous.inherited || previous.groupCount <= 0 ) ) {

							this.materials.splice( previous.index, 1 );

						}

						const material = {
							index: this.materials.length,
							name: name || '',
							mtllib: Array.isArray( libraries ) && libraries.length > 0 ? libraries[ libraries.length - 1 ] : '',
							smooth: previous !== undefined ? previous.smooth : this.smooth,
							groupStart: previous !== undefined ? previous.groupEnd : 0,
							groupEnd: - 1,
							groupCount: - 1,
							inherited: false,
							clone: function ( index ) {

								const cloned = {
									index: typeof index === 'number' ? index : this.index,
									name: this.name,
									mtllib: this.mtllib,
									smooth: this.smooth,
									groupStart: 0,
									groupEnd: - 1,
									groupCount: - 1,
									inherited: false
								};
								cloned.clone = this.clone.bind( cloned );
								return cloned;

							}
						};
						this.materials.push( material );
						return material;

					},
					currentMaterial: function () {

						if ( this.materials.length > 0 ) {

							return this.materials[ this.materials.length - 1 ];

						}

						return undefined;

					},
					_finalize: function ( end ) {

						const lastMultiMaterial = this.currentMaterial();

						if ( lastMultiMaterial && lastMultiMaterial.groupEnd === - 1 ) {

							lastMultiMaterial.groupEnd = this.geometry.vertices.length / 3;
							lastMultiMaterial.groupCount = lastMultiMaterial.groupEnd - lastMultiMaterial.groupStart;
							lastMultiMaterial.inherited = false;

						} // Ignore objects tail materials if no face declarations followed them before a new o/g started.


						if ( end && this.materials.length > 1 ) {

							for ( let mi = this.materials.length - 1; mi >= 0; mi -- ) {

								if ( this.materials[ mi ].groupCount <= 0 ) {

									this.materials.splice( mi, 1 );

								}

							}

						} // Guarantee at least one empty material, this makes the creation later more straight forward.


						if ( end && this.materials.length === 0 ) {

							this.materials.push( {
								name: '',
								smooth: this.smooth
							} );

						}

						return lastMultiMaterial;

					}
				}; // Inherit previous objects material.
				// Spec tells us that a declared material must be set to all objects until a new material is declared.
				// If a usemtl declaration is encountered while this new object is being parsed, it will
				// overwrite the inherited material. Exception being that there was already face declarations
				// to the inherited material, then it will be preserved for proper MultiMaterial continuation.

				if ( previousMaterial && previousMaterial.name && typeof previousMaterial.clone === 'function' ) {

					const declared = previousMaterial.clone( 0 );
					declared.inherited = true;
					this.object.materials.push( declared );

				}

				this.objects.push( this.object );

			},
			finalize: function () {

				if ( this.object && typeof this.object._finalize === 'function' ) {

					this.object._finalize( true );

				}

			},
			parseVertexIndex: function ( value, len ) {

				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;

			},
			parseNormalIndex: function ( value, len ) {

				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 3 ) * 3;

			},
			parseUVIndex: function ( value, len ) {

				const index = parseInt( value, 10 );
				return ( index >= 0 ? index - 1 : index + len / 2 ) * 2;

			},
			addVertex: function ( a, b, c ) {

				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );

			},
			addVertexPoint: function ( a ) {

				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );

			},
			addVertexLine: function ( a ) {

				const src = this.vertices;
				const dst = this.object.geometry.vertices;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );

			},
			addNormal: function ( a, b, c ) {

				const src = this.normals;
				const dst = this.object.geometry.normals;
				dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );

			},
			addFaceNormal: function ( a, b, c ) {

				const src = this.vertices;
				const dst = this.object.geometry.normals;

				_vA.fromArray( src, a );

				_vB.fromArray( src, b );

				_vC.fromArray( src, c );

				_cb.subVectors( _vC, _vB );

				_ab.subVectors( _vA, _vB );

				_cb.cross( _ab );

				_cb.normalize();

				dst.push( _cb.x, _cb.y, _cb.z );
				dst.push( _cb.x, _cb.y, _cb.z );
				dst.push( _cb.x, _cb.y, _cb.z );

			},
			addColor: function ( a, b, c ) {

				const src = this.colors;
				const dst = this.object.geometry.colors;
				if ( src[ a ] !== undefined ) dst.push( src[ a + 0 ], src[ a + 1 ], src[ a + 2 ] );
				if ( src[ b ] !== undefined ) dst.push( src[ b + 0 ], src[ b + 1 ], src[ b + 2 ] );
				if ( src[ c ] !== undefined ) dst.push( src[ c + 0 ], src[ c + 1 ], src[ c + 2 ] );

			},
			addUV: function ( a, b, c ) {

				const src = this.uvs;
				const dst = this.object.geometry.uvs;
				dst.push( src[ a + 0 ], src[ a + 1 ] );
				dst.push( src[ b + 0 ], src[ b + 1 ] );
				dst.push( src[ c + 0 ], src[ c + 1 ] );

			},
			addDefaultUV: function () {

				const dst = this.object.geometry.uvs;
				dst.push( 0, 0 );
				dst.push( 0, 0 );
				dst.push( 0, 0 );

			},
			addUVLine: function ( a ) {

				const src = this.uvs;
				const dst = this.object.geometry.uvs;
				dst.push( src[ a + 0 ], src[ a + 1 ] );

			},
			addFace: function ( a, b, c, ua, ub, uc, na, nb, nc ) {

				const vLen = this.vertices.length;
				let ia = this.parseVertexIndex( a, vLen );
				let ib = this.parseVertexIndex( b, vLen );
				let ic = this.parseVertexIndex( c, vLen );
				this.addVertex( ia, ib, ic );
				this.addColor( ia, ib, ic ); // normals

				if ( na !== undefined && na !== '' ) {

					const nLen = this.normals.length;
					ia = this.parseNormalIndex( na, nLen );
					ib = this.parseNormalIndex( nb, nLen );
					ic = this.parseNormalIndex( nc, nLen );
					this.addNormal( ia, ib, ic );

				} else {

					this.addFaceNormal( ia, ib, ic );

				} // uvs


				if ( ua !== undefined && ua !== '' ) {

					const uvLen = this.uvs.length;
					ia = this.parseUVIndex( ua, uvLen );
					ib = this.parseUVIndex( ub, uvLen );
					ic = this.parseUVIndex( uc, uvLen );
					this.addUV( ia, ib, ic );
					this.object.geometry.hasUVIndices = true;

				} else {

					// add placeholder values (for inconsistent face definitions)
					this.addDefaultUV();

				}

			},
			addPointGeometry: function ( vertices ) {

				this.object.geometry.type = 'Points';
				const vLen = this.vertices.length;

				for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {

					const index = this.parseVertexIndex( vertices[ vi ], vLen );
					this.addVertexPoint( index );
					this.addColor( index );

				}

			},
			addLineGeometry: function ( vertices, uvs ) {

				//this.object.geometry.type = 'Line';
				const vLen = this.vertices.length;
				const uvLen = this.uvs.length;

				for ( let vi = 0, l = vertices.length; vi < l; vi ++ ) {

					this.addVertexLine( this.parseVertexIndex( vertices[ vi ], vLen ) );

				}

				for ( let uvi = 0, l = uvs.length; uvi < l; uvi ++ ) {

					this.addUVLine( this.parseUVIndex( uvs[ uvi ], uvLen ) );

				}

			}
		};
		state.startObject( '', false );
		return state;

	} //


	class OBJLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.materials = null;

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		setMaterials( materials ) {

			this.materials = materials;
			return this;

		}

		parse( text ) {

			const state = new ParserState();

			if ( text.indexOf( '\r\n' ) !== - 1 ) {

				// This is faster than String.split with regex that splits on both
				text = text.replace( /\r\n/g, '\n' );

			}

			if ( text.indexOf( '\\\n' ) !== - 1 ) {

				// join lines separated by a line continuation character (\)
				text = text.replace( /\\\n/g, '' );

			}

			const lines = text.split( '\n' );
			let line = '',
				lineFirstChar = '';
			let lineLength = 0;
			let result = []; // Faster to just trim left side of the line. Use if available.

			const trimLeft = typeof ''.trimLeft === 'function';

			for ( let i = 0, l = lines.length; i < l; i ++ ) {

				line = lines[ i ];
				line = trimLeft ? line.trimLeft() : line.trim();
				lineLength = line.length;
				if ( lineLength === 0 ) continue;
				lineFirstChar = line.charAt( 0 ); // @todo invoke passed in handler if any

				if ( lineFirstChar === '#' ) continue;

				if ( lineFirstChar === 'v' ) {

					const data = line.split( /\s+/ );

					switch ( data[ 0 ] ) {

						case 'v':
							state.vertices.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );

							if ( data.length >= 7 ) {

								state.colors.push( parseFloat( data[ 4 ] ), parseFloat( data[ 5 ] ), parseFloat( data[ 6 ] ) );

							} else {

								// if no colors are defined, add placeholders so color and vertex indices match
								state.colors.push( undefined, undefined, undefined );

							}

							break;

						case 'vn':
							state.normals.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ), parseFloat( data[ 3 ] ) );
							break;

						case 'vt':
							state.uvs.push( parseFloat( data[ 1 ] ), parseFloat( data[ 2 ] ) );
							break;

					}

				} else if ( lineFirstChar === 'f' ) {

					const lineData = line.substr( 1 ).trim();
					const vertexData = lineData.split( /\s+/ );
					const faceVertices = []; // Parse the face vertex data into an easy to work with format

					for ( let j = 0, jl = vertexData.length; j < jl; j ++ ) {

						const vertex = vertexData[ j ];

						if ( vertex.length > 0 ) {

							const vertexParts = vertex.split( '/' );
							faceVertices.push( vertexParts );

						}

					} // Draw an edge between the first vertex and all subsequent vertices to form an n-gon


					const v1 = faceVertices[ 0 ];

					for ( let j = 1, jl = faceVertices.length - 1; j < jl; j ++ ) {

						const v2 = faceVertices[ j ];
						const v3 = faceVertices[ j + 1 ];
						state.addFace( v1[ 0 ], v2[ 0 ], v3[ 0 ], v1[ 1 ], v2[ 1 ], v3[ 1 ], v1[ 2 ], v2[ 2 ], v3[ 2 ] );

					}

				} else if ( lineFirstChar === 'l' ) {

					const lineParts = line.substring( 1 ).trim().split( ' ' );
					let lineVertices = [];
					const lineUVs = [];

					if ( line.indexOf( '/' ) === - 1 ) {

						lineVertices = lineParts;

					} else {

						for ( let li = 0, llen = lineParts.length; li < llen; li ++ ) {

							const parts = lineParts[ li ].split( '/' );
							if ( parts[ 0 ] !== '' ) lineVertices.push( parts[ 0 ] );
							if ( parts[ 1 ] !== '' ) lineUVs.push( parts[ 1 ] );

						}

					}

					state.addLineGeometry( lineVertices, lineUVs );

				} else if ( lineFirstChar === 'p' ) {

					const lineData = line.substr( 1 ).trim();
					const pointData = lineData.split( ' ' );
					state.addPointGeometry( pointData );

				} else if ( ( result = _object_pattern.exec( line ) ) !== null ) {

					// o object_name
					// or
					// g group_name
					// WORKAROUND: https://bugs.chromium.org/p/v8/issues/detail?id=2869
					// let name = result[ 0 ].substr( 1 ).trim();
					const name = ( ' ' + result[ 0 ].substr( 1 ).trim() ).substr( 1 );
					state.startObject( name );

				} else if ( _material_use_pattern.test( line ) ) {

					// material
					state.object.startMaterial( line.substring( 7 ).trim(), state.materialLibraries );

				} else if ( _material_library_pattern.test( line ) ) {

					// mtl file
					state.materialLibraries.push( line.substring( 7 ).trim() );

				} else if ( _map_use_pattern.test( line ) ) {

					// the line is parsed but ignored since the loader assumes textures are defined MTL files
					// (according to https://www.okino.com/conv/imp_wave.htm, 'usemap' is the old-style Wavefront texture reference method)
					console.warn( 'THREE.OBJLoader: Rendering identifier "usemap" not supported. Textures must be defined in MTL files.' );

				} else if ( lineFirstChar === 's' ) {

					result = line.split( ' ' ); // smooth shading
					// @todo Handle files that have varying smooth values for a set of faces inside one geometry,
					// but does not define a usemtl for each face set.
					// This should be detected and a dummy material created (later MultiMaterial and geometry groups).
					// This requires some care to not create extra material on each smooth value for "normal" obj files.
					// where explicit usemtl defines geometry groups.
					// Example asset: examples/models/obj/cerberus/Cerberus.obj

					/*
        	 * http://paulbourke.net/dataformats/obj/
        	 * or
        	 * http://www.cs.utah.edu/~boulos/cs3505/obj_spec.pdf
        	 *
        	 * From chapter "Grouping" Syntax explanation "s group_number":
        	 * "group_number is the smoothing group number. To turn off smoothing groups, use a value of 0 or off.
        	 * Polygonal elements use group numbers to put elements in different smoothing groups. For free-form
        	 * surfaces, smoothing groups are either turned on or off; there is no difference between values greater
        	 * than 0."
        	 */

					if ( result.length > 1 ) {

						const value = result[ 1 ].trim().toLowerCase();
						state.object.smooth = value !== '0' && value !== 'off';

					} else {

						// ZBrush can produce "s" lines #11707
						state.object.smooth = true;

					}

					const material = state.object.currentMaterial();
					if ( material ) material.smooth = state.object.smooth;

				} else {

					// Handle null terminated files without exception
					if ( line === '\0' ) continue;
					console.warn( 'THREE.OBJLoader: Unexpected line: "' + line + '"' );

				}

			}

			state.finalize();
			const container = new THREE.Group();
			container.materialLibraries = [].concat( state.materialLibraries );
			const hasPrimitives = ! ( state.objects.length === 1 && state.objects[ 0 ].geometry.vertices.length === 0 );

			if ( hasPrimitives === true ) {

				for ( let i = 0, l = state.objects.length; i < l; i ++ ) {

					const object = state.objects[ i ];
					const geometry = object.geometry;
					const materials = object.materials;
					const isLine = geometry.type === 'Line';
					const isPoints = geometry.type === 'Points';
					let hasVertexColors = false; // Skip o/g line declarations that did not follow with any faces

					if ( geometry.vertices.length === 0 ) continue;
					const buffergeometry = new THREE.BufferGeometry();
					buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( geometry.vertices, 3 ) );

					if ( geometry.normals.length > 0 ) {

						buffergeometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( geometry.normals, 3 ) );

					}

					if ( geometry.colors.length > 0 ) {

						hasVertexColors = true;
						buffergeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( geometry.colors, 3 ) );

					}

					if ( geometry.hasUVIndices === true ) {

						buffergeometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( geometry.uvs, 2 ) );

					} // Create materials


					const createdMaterials = [];

					for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {

						const sourceMaterial = materials[ mi ];
						const materialHash = sourceMaterial.name + '_' + sourceMaterial.smooth + '_' + hasVertexColors;
						let material = state.materials[ materialHash ];

						if ( this.materials !== null ) {

							material = this.materials.create( sourceMaterial.name ); // mtl etc. loaders probably can't create line materials correctly, copy properties to a line material.

							if ( isLine && material && ! ( material instanceof THREE.LineBasicMaterial ) ) {

								const materialLine = new THREE.LineBasicMaterial();
								THREE.Material.prototype.copy.call( materialLine, material );
								materialLine.color.copy( material.color );
								material = materialLine;

							} else if ( isPoints && material && ! ( material instanceof THREE.PointsMaterial ) ) {

								const materialPoints = new THREE.PointsMaterial( {
									size: 10,
									sizeAttenuation: false
								} );
								THREE.Material.prototype.copy.call( materialPoints, material );
								materialPoints.color.copy( material.color );
								materialPoints.map = material.map;
								material = materialPoints;

							}

						}

						if ( material === undefined ) {

							if ( isLine ) {

								material = new THREE.LineBasicMaterial();

							} else if ( isPoints ) {

								material = new THREE.PointsMaterial( {
									size: 1,
									sizeAttenuation: false
								} );

							} else {

								material = new THREE.MeshPhongMaterial();

							}

							material.name = sourceMaterial.name;
							material.flatShading = sourceMaterial.smooth ? false : true;
							material.vertexColors = hasVertexColors;
							state.materials[ materialHash ] = material;

						}

						createdMaterials.push( material );

					} // Create mesh


					let mesh;

					if ( createdMaterials.length > 1 ) {

						for ( let mi = 0, miLen = materials.length; mi < miLen; mi ++ ) {

							const sourceMaterial = materials[ mi ];
							buffergeometry.addGroup( sourceMaterial.groupStart, sourceMaterial.groupCount, mi );

						}

						if ( isLine ) {

							mesh = new THREE.LineSegments( buffergeometry, createdMaterials );

						} else if ( isPoints ) {

							mesh = new THREE.Points( buffergeometry, createdMaterials );

						} else {

							mesh = new THREE.Mesh( buffergeometry, createdMaterials );

						}

					} else {

						if ( isLine ) {

							mesh = new THREE.LineSegments( buffergeometry, createdMaterials[ 0 ] );

						} else if ( isPoints ) {

							mesh = new THREE.Points( buffergeometry, createdMaterials[ 0 ] );

						} else {

							mesh = new THREE.Mesh( buffergeometry, createdMaterials[ 0 ] );

						}

					}

					mesh.name = object.name;
					container.add( mesh );

				}

			} else {

				// if there is only the default parser state object with no geometry data, interpret data as point cloud
				if ( state.vertices.length > 0 ) {

					const material = new THREE.PointsMaterial( {
						size: 1,
						sizeAttenuation: false
					} );
					const buffergeometry = new THREE.BufferGeometry();
					buffergeometry.setAttribute( 'position', new THREE.Float32BufferAttribute( state.vertices, 3 ) );

					if ( state.colors.length > 0 && state.colors[ 0 ] !== undefined ) {

						buffergeometry.setAttribute( 'color', new THREE.Float32BufferAttribute( state.colors, 3 ) );
						material.vertexColors = true;

					}

					const points = new THREE.Points( buffergeometry, material );
					container.add( points );

				}

			}

			return container;

		}

	}

	THREE.OBJLoader = OBJLoader;

} )();
( function () {

	/**
 * Loads a Wavefront .mtl file specifying materials
 */

	class MTLLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}
		/**
   * Loads and parses a MTL asset from a URL.
   *
   * @param {String} url - URL to the MTL file.
   * @param {Function} [onLoad] - Callback invoked with the loaded object.
   * @param {Function} [onProgress] - Callback for download progress.
   * @param {Function} [onError] - Callback for download errors.
   *
   * @see setPath setResourcePath
   *
   * @note In order for relative texture references to resolve correctly
   * you must call setResourcePath() explicitly prior to load.
   */


		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const path = this.path === '' ? THREE.LoaderUtils.extractUrlBase( url ) : this.path;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text, path ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		setMaterialOptions( value ) {

			this.materialOptions = value;
			return this;

		}
		/**
   * Parses a MTL file.
   *
   * @param {String} text - Content of MTL file
   * @return {MaterialCreator}
   *
   * @see setPath setResourcePath
   *
   * @note In order for relative texture references to resolve correctly
   * you must call setResourcePath() explicitly prior to parse.
   */


		parse( text, path ) {

			const lines = text.split( '\n' );
			let info = {};
			const delimiter_pattern = /\s+/;
			const materialsInfo = {};

			for ( let i = 0; i < lines.length; i ++ ) {

				let line = lines[ i ];
				line = line.trim();

				if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

					// Blank line or comment ignore
					continue;

				}

				const pos = line.indexOf( ' ' );
				let key = pos >= 0 ? line.substring( 0, pos ) : line;
				key = key.toLowerCase();
				let value = pos >= 0 ? line.substring( pos + 1 ) : '';
				value = value.trim();

				if ( key === 'newmtl' ) {

					// New material
					info = {
						name: value
					};
					materialsInfo[ value ] = info;

				} else {

					if ( key === 'ka' || key === 'kd' || key === 'ks' || key === 'ke' ) {

						const ss = value.split( delimiter_pattern, 3 );
						info[ key ] = [ parseFloat( ss[ 0 ] ), parseFloat( ss[ 1 ] ), parseFloat( ss[ 2 ] ) ];

					} else {

						info[ key ] = value;

					}

				}

			}

			const materialCreator = new MaterialCreator( this.resourcePath || path, this.materialOptions );
			materialCreator.setCrossOrigin( this.crossOrigin );
			materialCreator.setManager( this.manager );
			materialCreator.setMaterials( materialsInfo );
			return materialCreator;

		}

	}
	/**
 * Create a new MTLLoader.MaterialCreator
 * @param baseUrl - Url relative to which textures are loaded
 * @param options - Set of options on how to construct the materials
 *                  side: Which side to apply the material
 *                        THREE.FrontSide (default), THREE.BackSide, THREE.DoubleSide
 *                  wrap: What type of wrapping to apply for textures
 *                        THREE.RepeatWrapping (default), THREE.ClampToEdgeWrapping, THREE.MirroredRepeatWrapping
 *                  normalizeRGB: RGBs need to be normalized to 0-1 from 0-255
 *                                Default: false, assumed to be already normalized
 *                  ignoreZeroRGBs: Ignore values of RGBs (Ka,Kd,Ks) that are all 0's
 *                                  Default: false
 * @constructor
 */


	class MaterialCreator {

		constructor( baseUrl = '', options = {} ) {

			this.baseUrl = baseUrl;
			this.options = options;
			this.materialsInfo = {};
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};
			this.crossOrigin = 'anonymous';
			this.side = this.options.side !== undefined ? this.options.side : THREE.FrontSide;
			this.wrap = this.options.wrap !== undefined ? this.options.wrap : THREE.RepeatWrapping;

		}

		setCrossOrigin( value ) {

			this.crossOrigin = value;
			return this;

		}

		setManager( value ) {

			this.manager = value;

		}

		setMaterials( materialsInfo ) {

			this.materialsInfo = this.convert( materialsInfo );
			this.materials = {};
			this.materialsArray = [];
			this.nameLookup = {};

		}

		convert( materialsInfo ) {

			if ( ! this.options ) return materialsInfo;
			const converted = {};

			for ( const mn in materialsInfo ) {

				// Convert materials info into normalized form based on options
				const mat = materialsInfo[ mn ];
				const covmat = {};
				converted[ mn ] = covmat;

				for ( const prop in mat ) {

					let save = true;
					let value = mat[ prop ];
					const lprop = prop.toLowerCase();

					switch ( lprop ) {

						case 'kd':
						case 'ka':
						case 'ks':
							// Diffuse color (color under white light) using RGB values
							if ( this.options && this.options.normalizeRGB ) {

								value = [ value[ 0 ] / 255, value[ 1 ] / 255, value[ 2 ] / 255 ];

							}

							if ( this.options && this.options.ignoreZeroRGBs ) {

								if ( value[ 0 ] === 0 && value[ 1 ] === 0 && value[ 2 ] === 0 ) {

									// ignore
									save = false;

								}

							}

							break;

						default:
							break;

					}

					if ( save ) {

						covmat[ lprop ] = value;

					}

				}

			}

			return converted;

		}

		preload() {

			for ( const mn in this.materialsInfo ) {

				this.create( mn );

			}

		}

		getIndex( materialName ) {

			return this.nameLookup[ materialName ];

		}

		getAsArray() {

			let index = 0;

			for ( const mn in this.materialsInfo ) {

				this.materialsArray[ index ] = this.create( mn );
				this.nameLookup[ mn ] = index;
				index ++;

			}

			return this.materialsArray;

		}

		create( materialName ) {

			if ( this.materials[ materialName ] === undefined ) {

				this.createMaterial_( materialName );

			}

			return this.materials[ materialName ];

		}

		createMaterial_( materialName ) {

			// Create material
			const scope = this;
			const mat = this.materialsInfo[ materialName ];
			const params = {
				name: materialName,
				side: this.side
			};

			function resolveURL( baseUrl, url ) {

				if ( typeof url !== 'string' || url === '' ) return ''; // Absolute URL

				if ( /^https?:\/\//i.test( url ) ) return url;
				return baseUrl + url;

			}

			function setMapForType( mapType, value ) {

				if ( params[ mapType ] ) return; // Keep the first encountered texture

				const texParams = scope.getTextureParams( value, params );
				const map = scope.loadTexture( resolveURL( scope.baseUrl, texParams.url ) );
				map.repeat.copy( texParams.scale );
				map.offset.copy( texParams.offset );
				map.wrapS = scope.wrap;
				map.wrapT = scope.wrap;
				params[ mapType ] = map;

			}

			for ( const prop in mat ) {

				const value = mat[ prop ];
				let n;
				if ( value === '' ) continue;

				switch ( prop.toLowerCase() ) {

					// Ns is material specular exponent
					case 'kd':
						// Diffuse color (color under white light) using RGB values
						params.color = new THREE.Color().fromArray( value );
						break;

					case 'ks':
						// Specular color (color when light is reflected from shiny surface) using RGB values
						params.specular = new THREE.Color().fromArray( value );
						break;

					case 'ke':
						// Emissive using RGB values
						params.emissive = new THREE.Color().fromArray( value );
						break;

					case 'map_kd':
						// Diffuse texture map
						setMapForType( 'map', value );
						break;

					case 'map_ks':
						// Specular map
						setMapForType( 'specularMap', value );
						break;

					case 'map_ke':
						// Emissive map
						setMapForType( 'emissiveMap', value );
						break;

					case 'norm':
						setMapForType( 'normalMap', value );
						break;

					case 'map_bump':
					case 'bump':
						// Bump texture map
						setMapForType( 'bumpMap', value );
						break;

					case 'map_d':
						// Alpha map
						setMapForType( 'alphaMap', value );
						params.transparent = true;
						break;

					case 'ns':
						// The specular exponent (defines the focus of the specular highlight)
						// A high exponent results in a tight, concentrated highlight. Ns values normally range from 0 to 1000.
						params.shininess = parseFloat( value );
						break;

					case 'd':
						n = parseFloat( value );

						if ( n < 1 ) {

							params.opacity = n;
							params.transparent = true;

						}

						break;

					case 'tr':
						n = parseFloat( value );
						if ( this.options && this.options.invertTrProperty ) n = 1 - n;

						if ( n > 0 ) {

							params.opacity = 1 - n;
							params.transparent = true;

						}

						break;

					default:
						break;

				}

			}

			this.materials[ materialName ] = new THREE.MeshPhongMaterial( params );
			return this.materials[ materialName ];

		}

		getTextureParams( value, matParams ) {

			const texParams = {
				scale: new THREE.Vector2( 1, 1 ),
				offset: new THREE.Vector2( 0, 0 )
			};
			const items = value.split( /\s+/ );
			let pos;
			pos = items.indexOf( '-bm' );

			if ( pos >= 0 ) {

				matParams.bumpScale = parseFloat( items[ pos + 1 ] );
				items.splice( pos, 2 );

			}

			pos = items.indexOf( '-s' );

			if ( pos >= 0 ) {

				texParams.scale.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 ); // we expect 3 parameters here!

			}

			pos = items.indexOf( '-o' );

			if ( pos >= 0 ) {

				texParams.offset.set( parseFloat( items[ pos + 1 ] ), parseFloat( items[ pos + 2 ] ) );
				items.splice( pos, 4 ); // we expect 3 parameters here!

			}

			texParams.url = items.join( ' ' ).trim();
			return texParams;

		}

		loadTexture( url, mapping, onLoad, onProgress, onError ) {

			const manager = this.manager !== undefined ? this.manager : THREE.DefaultLoadingManager;
			let loader = manager.getHandler( url );

			if ( loader === null ) {

				loader = new THREE.TextureLoader( manager );

			}

			if ( loader.setCrossOrigin ) loader.setCrossOrigin( this.crossOrigin );
			const texture = loader.load( url, onLoad, onProgress, onError );
			if ( mapping !== undefined ) texture.mapping = mapping;
			return texture;

		}

	}

	THREE.MTLLoader = MTLLoader;

} )();
( function () {

	/**
 * Description: A THREE loader for PLY ASCII files (known as the Polygon
 * File Format or the Stanford Triangle Format).
 *
 * Limitations: ASCII decoding assumes file is UTF-8.
 *
 * Usage:
 *	const loader = new PLYLoader();
 *	loader.load('./models/ply/ascii/dolphins.ply', function (geometry) {
 *
 *		scene.add( new THREE.Mesh( geometry ) );
 *
 *	} );
 *
 * If the PLY file uses non standard property names, they can be mapped while
 * loading. For example, the following maps the properties
 * “diffuse_(red|green|blue)” in the file to standard color names.
 *
 * loader.setPropertyNameMapping( {
 *	diffuse_red: 'red',
 *	diffuse_green: 'green',
 *	diffuse_blue: 'blue'
 * } );
 *
 */

	class PLYLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.propertyNameMapping = {};

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		setPropertyNameMapping( mapping ) {

			this.propertyNameMapping = mapping;

		}

		parse( data ) {

			function parseHeader( data ) {

				const patternHeader = /ply([\s\S]*)end_header\r?\n/;
				let headerText = '';
				let headerLength = 0;
				const result = patternHeader.exec( data );

				if ( result !== null ) {

					headerText = result[ 1 ];
					headerLength = new Blob( [ result[ 0 ] ] ).size;

				}

				const header = {
					comments: [],
					elements: [],
					headerLength: headerLength,
					objInfo: ''
				};
				const lines = headerText.split( '\n' );
				let currentElement;

				function make_ply_element_property( propertValues, propertyNameMapping ) {

					const property = {
						type: propertValues[ 0 ]
					};

					if ( property.type === 'list' ) {

						property.name = propertValues[ 3 ];
						property.countType = propertValues[ 1 ];
						property.itemType = propertValues[ 2 ];

					} else {

						property.name = propertValues[ 1 ];

					}

					if ( property.name in propertyNameMapping ) {

						property.name = propertyNameMapping[ property.name ];

					}

					return property;

				}

				for ( let i = 0; i < lines.length; i ++ ) {

					let line = lines[ i ];
					line = line.trim();
					if ( line === '' ) continue;
					const lineValues = line.split( /\s+/ );
					const lineType = lineValues.shift();
					line = lineValues.join( ' ' );

					switch ( lineType ) {

						case 'format':
							header.format = lineValues[ 0 ];
							header.version = lineValues[ 1 ];
							break;

						case 'comment':
							header.comments.push( line );
							break;

						case 'element':
							if ( currentElement !== undefined ) {

								header.elements.push( currentElement );

							}

							currentElement = {};
							currentElement.name = lineValues[ 0 ];
							currentElement.count = parseInt( lineValues[ 1 ] );
							currentElement.properties = [];
							break;

						case 'property':
							currentElement.properties.push( make_ply_element_property( lineValues, scope.propertyNameMapping ) );
							break;

						case 'obj_info':
							header.objInfo = line;
							break;

						default:
							console.log( 'unhandled', lineType, lineValues );

					}

				}

				if ( currentElement !== undefined ) {

					header.elements.push( currentElement );

				}

				return header;

			}

			function parseASCIINumber( n, type ) {

				switch ( type ) {

					case 'char':
					case 'uchar':
					case 'short':
					case 'ushort':
					case 'int':
					case 'uint':
					case 'int8':
					case 'uint8':
					case 'int16':
					case 'uint16':
					case 'int32':
					case 'uint32':
						return parseInt( n );

					case 'float':
					case 'double':
					case 'float32':
					case 'float64':
						return parseFloat( n );

				}

			}

			function parseASCIIElement( properties, line ) {

				const values = line.split( /\s+/ );
				const element = {};

				for ( let i = 0; i < properties.length; i ++ ) {

					if ( properties[ i ].type === 'list' ) {

						const list = [];
						const n = parseASCIINumber( values.shift(), properties[ i ].countType );

						for ( let j = 0; j < n; j ++ ) {

							list.push( parseASCIINumber( values.shift(), properties[ i ].itemType ) );

						}

						element[ properties[ i ].name ] = list;

					} else {

						element[ properties[ i ].name ] = parseASCIINumber( values.shift(), properties[ i ].type );

					}

				}

				return element;

			}

			function parseASCII( data, header ) {

				// PLY ascii format specification, as per http://en.wikipedia.org/wiki/PLY_(file_format)
				const buffer = {
					indices: [],
					vertices: [],
					normals: [],
					uvs: [],
					faceVertexUvs: [],
					colors: []
				};
				let result;
				const patternBody = /end_header\s([\s\S]*)$/;
				let body = '';

				if ( ( result = patternBody.exec( data ) ) !== null ) {

					body = result[ 1 ];

				}

				const lines = body.split( '\n' );
				let currentElement = 0;
				let currentElementCount = 0;

				for ( let i = 0; i < lines.length; i ++ ) {

					let line = lines[ i ];
					line = line.trim();

					if ( line === '' ) {

						continue;

					}

					if ( currentElementCount >= header.elements[ currentElement ].count ) {

						currentElement ++;
						currentElementCount = 0;

					}

					const element = parseASCIIElement( header.elements[ currentElement ].properties, line );
					handleElement( buffer, header.elements[ currentElement ].name, element );
					currentElementCount ++;

				}

				return postProcess( buffer );

			}

			function postProcess( buffer ) {

				let geometry = new THREE.BufferGeometry(); // mandatory buffer data

				if ( buffer.indices.length > 0 ) {

					geometry.setIndex( buffer.indices );

				}

				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( buffer.vertices, 3 ) ); // optional buffer data

				if ( buffer.normals.length > 0 ) {

					geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( buffer.normals, 3 ) );

				}

				if ( buffer.uvs.length > 0 ) {

					geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( buffer.uvs, 2 ) );

				}

				if ( buffer.colors.length > 0 ) {

					geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( buffer.colors, 3 ) );

				}

				if ( buffer.faceVertexUvs.length > 0 ) {

					geometry = geometry.toNonIndexed();
					geometry.setAttribute( 'uv', new THREE.Float32BufferAttribute( buffer.faceVertexUvs, 2 ) );

				}

				geometry.computeBoundingSphere();
				return geometry;

			}

			function handleElement( buffer, elementName, element ) {

				if ( elementName === 'vertex' ) {

					buffer.vertices.push( element.x, element.y, element.z );

					if ( 'nx' in element && 'ny' in element && 'nz' in element ) {

						buffer.normals.push( element.nx, element.ny, element.nz );

					}

					if ( 's' in element && 't' in element ) {

						buffer.uvs.push( element.s, element.t );

					}

					if ( 'red' in element && 'green' in element && 'blue' in element ) {

						buffer.colors.push( element.red / 255.0, element.green / 255.0, element.blue / 255.0 );

					}

				} else if ( elementName === 'face' ) {

					const vertex_indices = element.vertex_indices || element.vertex_index; // issue #9338

					const texcoord = element.texcoord;

					if ( vertex_indices.length === 3 ) {

						buffer.indices.push( vertex_indices[ 0 ], vertex_indices[ 1 ], vertex_indices[ 2 ] );

						if ( texcoord && texcoord.length === 6 ) {

							buffer.faceVertexUvs.push( texcoord[ 0 ], texcoord[ 1 ] );
							buffer.faceVertexUvs.push( texcoord[ 2 ], texcoord[ 3 ] );
							buffer.faceVertexUvs.push( texcoord[ 4 ], texcoord[ 5 ] );

						}

					} else if ( vertex_indices.length === 4 ) {

						buffer.indices.push( vertex_indices[ 0 ], vertex_indices[ 1 ], vertex_indices[ 3 ] );
						buffer.indices.push( vertex_indices[ 1 ], vertex_indices[ 2 ], vertex_indices[ 3 ] );

					}

				}

			}

			function binaryRead( dataview, at, type, little_endian ) {

				switch ( type ) {

					// corespondences for non-specific length types here match rply:
					case 'int8':
					case 'char':
						return [ dataview.getInt8( at ), 1 ];

					case 'uint8':
					case 'uchar':
						return [ dataview.getUint8( at ), 1 ];

					case 'int16':
					case 'short':
						return [ dataview.getInt16( at, little_endian ), 2 ];

					case 'uint16':
					case 'ushort':
						return [ dataview.getUint16( at, little_endian ), 2 ];

					case 'int32':
					case 'int':
						return [ dataview.getInt32( at, little_endian ), 4 ];

					case 'uint32':
					case 'uint':
						return [ dataview.getUint32( at, little_endian ), 4 ];

					case 'float32':
					case 'float':
						return [ dataview.getFloat32( at, little_endian ), 4 ];

					case 'float64':
					case 'double':
						return [ dataview.getFloat64( at, little_endian ), 8 ];

				}

			}

			function binaryReadElement( dataview, at, properties, little_endian ) {

				const element = {};
				let result,
					read = 0;

				for ( let i = 0; i < properties.length; i ++ ) {

					if ( properties[ i ].type === 'list' ) {

						const list = [];
						result = binaryRead( dataview, at + read, properties[ i ].countType, little_endian );
						const n = result[ 0 ];
						read += result[ 1 ];

						for ( let j = 0; j < n; j ++ ) {

							result = binaryRead( dataview, at + read, properties[ i ].itemType, little_endian );
							list.push( result[ 0 ] );
							read += result[ 1 ];

						}

						element[ properties[ i ].name ] = list;

					} else {

						result = binaryRead( dataview, at + read, properties[ i ].type, little_endian );
						element[ properties[ i ].name ] = result[ 0 ];
						read += result[ 1 ];

					}

				}

				return [ element, read ];

			}

			function parseBinary( data, header ) {

				const buffer = {
					indices: [],
					vertices: [],
					normals: [],
					uvs: [],
					faceVertexUvs: [],
					colors: []
				};
				const little_endian = header.format === 'binary_little_endian';
				const body = new DataView( data, header.headerLength );
				let result,
					loc = 0;

				for ( let currentElement = 0; currentElement < header.elements.length; currentElement ++ ) {

					for ( let currentElementCount = 0; currentElementCount < header.elements[ currentElement ].count; currentElementCount ++ ) {

						result = binaryReadElement( body, loc, header.elements[ currentElement ].properties, little_endian );
						loc += result[ 1 ];
						const element = result[ 0 ];
						handleElement( buffer, header.elements[ currentElement ].name, element );

					}

				}

				return postProcess( buffer );

			} //


			let geometry;
			const scope = this;

			if ( data instanceof ArrayBuffer ) {

				const text = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );
				const header = parseHeader( text );
				geometry = header.format === 'ascii' ? parseASCII( text, header ) : parseBinary( data, header );

			} else {

				geometry = parseASCII( data, parseHeader( data ) );

			}

			return geometry;

		}

	}

	THREE.PLYLoader = PLYLoader;

} )();
( function () {

	/**
 * Description: A THREE loader for STL ASCII files, as created by Solidworks and other CAD programs.
 *
 * Supports both binary and ASCII encoded files, with automatic detection of type.
 *
 * The loader returns a non-indexed buffer geometry.
 *
 * Limitations:
 *  Binary decoding supports "Magics" color format (http://en.wikipedia.org/wiki/STL_(file_format)#Color_in_binary_STL).
 *  There is perhaps some question as to how valid it is to always assume little-endian-ness.
 *  ASCII decoding assumes file is UTF-8.
 *
 * Usage:
 *  const loader = new STLLoader();
 *  loader.load( './models/stl/slotted_disk.stl', function ( geometry ) {
 *    scene.add( new THREE.Mesh( geometry ) );
 *  });
 *
 * For binary STLs geometry might contain colors for vertices. To use it:
 *  // use the same code to load STL as above
 *  if (geometry.hasColors) {
 *    material = new THREE.MeshPhongMaterial({ opacity: geometry.alpha, vertexColors: true });
 *  } else { .... }
 *  const mesh = new THREE.Mesh( geometry, material );
 *
 * For ASCII STLs containing multiple solids, each solid is assigned to a different group.
 * Groups can be used to assign a different color by defining an array of materials with the same length of
 * geometry.groups and passing it to the Mesh constructor:
 *
 * const mesh = new THREE.Mesh( geometry, material );
 *
 * For example:
 *
 *  const materials = [];
 *  const nGeometryGroups = geometry.groups.length;
 *
 *  const colorMap = ...; // Some logic to index colors.
 *
 *  for (let i = 0; i < nGeometryGroups; i++) {
 *
 *		const material = new THREE.MeshPhongMaterial({
 *			color: colorMap[i],
 *			wireframe: false
 *		});
 *
 *  }
 *
 *  materials.push(material);
 *  const mesh = new THREE.Mesh(geometry, materials);
 */

	class STLLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, function ( text ) {

				try {

					onLoad( scope.parse( text ) );

				} catch ( e ) {

					if ( onError ) {

						onError( e );

					} else {

						console.error( e );

					}

					scope.manager.itemError( url );

				}

			}, onProgress, onError );

		}

		parse( data ) {

			function isBinary( data ) {

				const reader = new DataView( data );
				const face_size = 32 / 8 * 3 + 32 / 8 * 3 * 3 + 16 / 8;
				const n_faces = reader.getUint32( 80, true );
				const expect = 80 + 32 / 8 + n_faces * face_size;

				if ( expect === reader.byteLength ) {

					return true;

				} // An ASCII STL data must begin with 'solid ' as the first six bytes.
				// However, ASCII STLs lacking the SPACE after the 'd' are known to be
				// plentiful.  So, check the first 5 bytes for 'solid'.
				// Several encodings, such as UTF-8, precede the text with up to 5 bytes:
				// https://en.wikipedia.org/wiki/Byte_order_mark#Byte_order_marks_by_encoding
				// Search for "solid" to start anywhere after those prefixes.
				// US-ASCII ordinal values for 's', 'o', 'l', 'i', 'd'


				const solid = [ 115, 111, 108, 105, 100 ];

				for ( let off = 0; off < 5; off ++ ) {

					// If "solid" text is matched to the current offset, declare it to be an ASCII STL.
					if ( matchDataViewAt( solid, reader, off ) ) return false;

				} // Couldn't find "solid" text at the beginning; it is binary STL.


				return true;

			}

			function matchDataViewAt( query, reader, offset ) {

				// Check if each byte in query matches the corresponding byte from the current offset
				for ( let i = 0, il = query.length; i < il; i ++ ) {

					if ( query[ i ] !== reader.getUint8( offset + i, false ) ) return false;

				}

				return true;

			}

			function parseBinary( data ) {

				const reader = new DataView( data );
				const faces = reader.getUint32( 80, true );
				let r,
					g,
					b,
					hasColors = false,
					colors;
				let defaultR, defaultG, defaultB, alpha; // process STL header
				// check for default color in header ("COLOR=rgba" sequence).

				for ( let index = 0; index < 80 - 10; index ++ ) {

					if ( reader.getUint32( index, false ) == 0x434F4C4F
        /*COLO*/
        && reader.getUint8( index + 4 ) == 0x52
        /*'R'*/
        && reader.getUint8( index + 5 ) == 0x3D
        /*'='*/
					) {

						hasColors = true;
						colors = new Float32Array( faces * 3 * 3 );
						defaultR = reader.getUint8( index + 6 ) / 255;
						defaultG = reader.getUint8( index + 7 ) / 255;
						defaultB = reader.getUint8( index + 8 ) / 255;
						alpha = reader.getUint8( index + 9 ) / 255;

					}

				}

				const dataOffset = 84;
				const faceLength = 12 * 4 + 2;
				const geometry = new THREE.BufferGeometry();
				const vertices = new Float32Array( faces * 3 * 3 );
				const normals = new Float32Array( faces * 3 * 3 );

				for ( let face = 0; face < faces; face ++ ) {

					const start = dataOffset + face * faceLength;
					const normalX = reader.getFloat32( start, true );
					const normalY = reader.getFloat32( start + 4, true );
					const normalZ = reader.getFloat32( start + 8, true );

					if ( hasColors ) {

						const packedColor = reader.getUint16( start + 48, true );

						if ( ( packedColor & 0x8000 ) === 0 ) {

							// facet has its own unique color
							r = ( packedColor & 0x1F ) / 31;
							g = ( packedColor >> 5 & 0x1F ) / 31;
							b = ( packedColor >> 10 & 0x1F ) / 31;

						} else {

							r = defaultR;
							g = defaultG;
							b = defaultB;

						}

					}

					for ( let i = 1; i <= 3; i ++ ) {

						const vertexstart = start + i * 12;
						const componentIdx = face * 3 * 3 + ( i - 1 ) * 3;
						vertices[ componentIdx ] = reader.getFloat32( vertexstart, true );
						vertices[ componentIdx + 1 ] = reader.getFloat32( vertexstart + 4, true );
						vertices[ componentIdx + 2 ] = reader.getFloat32( vertexstart + 8, true );
						normals[ componentIdx ] = normalX;
						normals[ componentIdx + 1 ] = normalY;
						normals[ componentIdx + 2 ] = normalZ;

						if ( hasColors ) {

							colors[ componentIdx ] = r;
							colors[ componentIdx + 1 ] = g;
							colors[ componentIdx + 2 ] = b;

						}

					}

				}

				geometry.setAttribute( 'position', new THREE.BufferAttribute( vertices, 3 ) );
				geometry.setAttribute( 'normal', new THREE.BufferAttribute( normals, 3 ) );

				if ( hasColors ) {

					geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );
					geometry.hasColors = true;
					geometry.alpha = alpha;

				}

				return geometry;

			}

			function parseASCII( data ) {

				const geometry = new THREE.BufferGeometry();
				const patternSolid = /solid([\s\S]*?)endsolid/g;
				const patternFace = /facet([\s\S]*?)endfacet/g;
				let faceCounter = 0;
				const patternFloat = /[\s]+([+-]?(?:\d*)(?:\.\d*)?(?:[eE][+-]?\d+)?)/.source;
				const patternVertex = new RegExp( 'vertex' + patternFloat + patternFloat + patternFloat, 'g' );
				const patternNormal = new RegExp( 'normal' + patternFloat + patternFloat + patternFloat, 'g' );
				const vertices = [];
				const normals = [];
				const normal = new THREE.Vector3();
				let result;
				let groupCount = 0;
				let startVertex = 0;
				let endVertex = 0;

				while ( ( result = patternSolid.exec( data ) ) !== null ) {

					startVertex = endVertex;
					const solid = result[ 0 ];

					while ( ( result = patternFace.exec( solid ) ) !== null ) {

						let vertexCountPerFace = 0;
						let normalCountPerFace = 0;
						const text = result[ 0 ];

						while ( ( result = patternNormal.exec( text ) ) !== null ) {

							normal.x = parseFloat( result[ 1 ] );
							normal.y = parseFloat( result[ 2 ] );
							normal.z = parseFloat( result[ 3 ] );
							normalCountPerFace ++;

						}

						while ( ( result = patternVertex.exec( text ) ) !== null ) {

							vertices.push( parseFloat( result[ 1 ] ), parseFloat( result[ 2 ] ), parseFloat( result[ 3 ] ) );
							normals.push( normal.x, normal.y, normal.z );
							vertexCountPerFace ++;
							endVertex ++;

						} // every face have to own ONE valid normal


						if ( normalCountPerFace !== 1 ) {

							console.error( 'THREE.STLLoader: Something isn\'t right with the normal of face number ' + faceCounter );

						} // each face have to own THREE valid vertices


						if ( vertexCountPerFace !== 3 ) {

							console.error( 'THREE.STLLoader: Something isn\'t right with the vertices of face number ' + faceCounter );

						}

						faceCounter ++;

					}

					const start = startVertex;
					const count = endVertex - startVertex;
					geometry.addGroup( start, count, groupCount );
					groupCount ++;

				}

				geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
				geometry.setAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
				return geometry;

			}

			function ensureString( buffer ) {

				if ( typeof buffer !== 'string' ) {

					return THREE.LoaderUtils.decodeText( new Uint8Array( buffer ) );

				}

				return buffer;

			}

			function ensureBinary( buffer ) {

				if ( typeof buffer === 'string' ) {

					const array_buffer = new Uint8Array( buffer.length );

					for ( let i = 0; i < buffer.length; i ++ ) {

						array_buffer[ i ] = buffer.charCodeAt( i ) & 0xff; // implicitly assumes little-endian

					}

					return array_buffer.buffer || array_buffer;

				} else {

					return buffer;

				}

			} // start


			const binData = ensureBinary( data );
			return isBinary( binData ) ? parseBinary( binData ) : parseASCII( ensureString( data ) );

		}

	}

	THREE.STLLoader = STLLoader;

} )();
( function () {

	const _taskCache = new WeakMap();

	class DRACOLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.decoderPath = '';
			this.decoderConfig = {};
			this.decoderBinary = null;
			this.decoderPending = null;
			this.workerLimit = 4;
			this.workerPool = [];
			this.workerNextTaskID = 1;
			this.workerSourceURL = '';
			this.defaultAttributeIDs = {
				position: 'POSITION',
				normal: 'NORMAL',
				color: 'COLOR',
				uv: 'TEX_COORD'
			};
			this.defaultAttributeTypes = {
				position: 'Float32Array',
				normal: 'Float32Array',
				color: 'Float32Array',
				uv: 'Float32Array'
			};

		}

		setDecoderPath( path ) {

			this.decoderPath = path;
			return this;

		}

		setDecoderConfig( config ) {

			this.decoderConfig = config;
			return this;

		}

		setWorkerLimit( workerLimit ) {

			this.workerLimit = workerLimit;
			return this;

		}

		load( url, onLoad, onProgress, onError ) {

			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setResponseType( 'arraybuffer' );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( this.withCredentials );
			loader.load( url, buffer => {

				const taskConfig = {
					attributeIDs: this.defaultAttributeIDs,
					attributeTypes: this.defaultAttributeTypes,
					useUniqueIDs: false
				};
				this.decodeGeometry( buffer, taskConfig ).then( onLoad ).catch( onError );

			}, onProgress, onError );

		}
		/** @deprecated Kept for backward-compatibility with previous DRACOLoader versions. */


		decodeDracoFile( buffer, callback, attributeIDs, attributeTypes ) {

			const taskConfig = {
				attributeIDs: attributeIDs || this.defaultAttributeIDs,
				attributeTypes: attributeTypes || this.defaultAttributeTypes,
				useUniqueIDs: !! attributeIDs
			};
			this.decodeGeometry( buffer, taskConfig ).then( callback );

		}

		decodeGeometry( buffer, taskConfig ) {

			// TODO: For backward-compatibility, support 'attributeTypes' objects containing
			// references (rather than names) to typed array constructors. These must be
			// serialized before sending them to the worker.
			for ( const attribute in taskConfig.attributeTypes ) {

				const type = taskConfig.attributeTypes[ attribute ];

				if ( type.BYTES_PER_ELEMENT !== undefined ) {

					taskConfig.attributeTypes[ attribute ] = type.name;

				}

			} //


			const taskKey = JSON.stringify( taskConfig ); // Check for an existing task using this buffer. A transferred buffer cannot be transferred
			// again from this thread.

			if ( _taskCache.has( buffer ) ) {

				const cachedTask = _taskCache.get( buffer );

				if ( cachedTask.key === taskKey ) {

					return cachedTask.promise;

				} else if ( buffer.byteLength === 0 ) {

					// Technically, it would be possible to wait for the previous task to complete,
					// transfer the buffer back, and decode again with the second configuration. That
					// is complex, and I don't know of any reason to decode a Draco buffer twice in
					// different ways, so this is left unimplemented.
					throw new Error( 'THREE.DRACOLoader: Unable to re-decode a buffer with different ' + 'settings. Buffer has already been transferred.' );

				}

			} //


			let worker;
			const taskID = this.workerNextTaskID ++;
			const taskCost = buffer.byteLength; // Obtain a worker and assign a task, and construct a geometry instance
			// when the task completes.

			const geometryPending = this._getWorker( taskID, taskCost ).then( _worker => {

				worker = _worker;
				return new Promise( ( resolve, reject ) => {

					worker._callbacks[ taskID ] = {
						resolve,
						reject
					};
					worker.postMessage( {
						type: 'decode',
						id: taskID,
						taskConfig,
						buffer
					}, [ buffer ] ); // this.debug();

				} );

			} ).then( message => this._createGeometry( message.geometry ) ); // Remove task from the task list.
			// Note: replaced '.finally()' with '.catch().then()' block - iOS 11 support (#19416)


			geometryPending.catch( () => true ).then( () => {

				if ( worker && taskID ) {

					this._releaseTask( worker, taskID ); // this.debug();

				}

			} ); // Cache the task result.

			_taskCache.set( buffer, {
				key: taskKey,
				promise: geometryPending
			} );

			return geometryPending;

		}

		_createGeometry( geometryData ) {

			const geometry = new THREE.BufferGeometry();

			if ( geometryData.index ) {

				geometry.setIndex( new THREE.BufferAttribute( geometryData.index.array, 1 ) );

			}

			for ( let i = 0; i < geometryData.attributes.length; i ++ ) {

				const attribute = geometryData.attributes[ i ];
				const name = attribute.name;
				const array = attribute.array;
				const itemSize = attribute.itemSize;
				geometry.setAttribute( name, new THREE.BufferAttribute( array, itemSize ) );

			}

			return geometry;

		}

		_loadLibrary( url, responseType ) {

			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.decoderPath );
			loader.setResponseType( responseType );
			loader.setWithCredentials( this.withCredentials );
			return new Promise( ( resolve, reject ) => {

				loader.load( url, resolve, undefined, reject );

			} );

		}

		preload() {

			this._initDecoder();

			return this;

		}

		_initDecoder() {

			if ( this.decoderPending ) return this.decoderPending;
			const useJS = typeof WebAssembly !== 'object' || this.decoderConfig.type === 'js';
			const librariesPending = [];

			if ( useJS ) {

				librariesPending.push( this._loadLibrary( 'draco_decoder.js', 'text' ) );

			} else {

				librariesPending.push( this._loadLibrary( 'draco_wasm_wrapper.js', 'text' ) );
				librariesPending.push( this._loadLibrary( 'draco_decoder.wasm', 'arraybuffer' ) );

			}

			this.decoderPending = Promise.all( librariesPending ).then( libraries => {

				const jsContent = libraries[ 0 ];

				if ( ! useJS ) {

					this.decoderConfig.wasmBinary = libraries[ 1 ];

				}

				const fn = DRACOWorker.toString();
				const body = [ '/* draco decoder */', jsContent, '', '/* worker */', fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) ) ].join( '\n' );
				this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );

			} );
			return this.decoderPending;

		}

		_getWorker( taskID, taskCost ) {

			return this._initDecoder().then( () => {

				if ( this.workerPool.length < this.workerLimit ) {

					const worker = new Worker( this.workerSourceURL );
					worker._callbacks = {};
					worker._taskCosts = {};
					worker._taskLoad = 0;
					worker.postMessage( {
						type: 'init',
						decoderConfig: this.decoderConfig
					} );

					worker.onmessage = function ( e ) {

						const message = e.data;

						switch ( message.type ) {

							case 'decode':
								worker._callbacks[ message.id ].resolve( message );

								break;

							case 'error':
								worker._callbacks[ message.id ].reject( message );

								break;

							default:
								console.error( 'THREE.DRACOLoader: Unexpected message, "' + message.type + '"' );

						}

					};

					this.workerPool.push( worker );

				} else {

					this.workerPool.sort( function ( a, b ) {

						return a._taskLoad > b._taskLoad ? - 1 : 1;

					} );

				}

				const worker = this.workerPool[ this.workerPool.length - 1 ];
				worker._taskCosts[ taskID ] = taskCost;
				worker._taskLoad += taskCost;
				return worker;

			} );

		}

		_releaseTask( worker, taskID ) {

			worker._taskLoad -= worker._taskCosts[ taskID ];
			delete worker._callbacks[ taskID ];
			delete worker._taskCosts[ taskID ];

		}

		debug() {

			console.log( 'Task load: ', this.workerPool.map( worker => worker._taskLoad ) );

		}

		dispose() {

			for ( let i = 0; i < this.workerPool.length; ++ i ) {

				this.workerPool[ i ].terminate();

			}

			this.workerPool.length = 0;
			return this;

		}

	}
	/* WEB WORKER */


	function DRACOWorker() {

		let decoderConfig;
		let decoderPending;

		onmessage = function ( e ) {

			const message = e.data;

			switch ( message.type ) {

				case 'init':
					decoderConfig = message.decoderConfig;
					decoderPending = new Promise( function ( resolve
						/*, reject*/
					) {

						decoderConfig.onModuleLoaded = function ( draco ) {

							// Module is Promise-like. Wrap before resolving to avoid loop.
							resolve( {
								draco: draco
							} );

						};

						DracoDecoderModule( decoderConfig ); // eslint-disable-line no-undef

					} );
					break;

				case 'decode':
					const buffer = message.buffer;
					const taskConfig = message.taskConfig;
					decoderPending.then( module => {

						const draco = module.draco;
						const decoder = new draco.Decoder();
						const decoderBuffer = new draco.DecoderBuffer();
						decoderBuffer.Init( new Int8Array( buffer ), buffer.byteLength );

						try {

							const geometry = decodeGeometry( draco, decoder, decoderBuffer, taskConfig );
							const buffers = geometry.attributes.map( attr => attr.array.buffer );
							if ( geometry.index ) buffers.push( geometry.index.array.buffer );
							self.postMessage( {
								type: 'decode',
								id: message.id,
								geometry
							}, buffers );

						} catch ( error ) {

							console.error( error );
							self.postMessage( {
								type: 'error',
								id: message.id,
								error: error.message
							} );

						} finally {

							draco.destroy( decoderBuffer );
							draco.destroy( decoder );

						}

					} );
					break;

			}

		};

		function decodeGeometry( draco, decoder, decoderBuffer, taskConfig ) {

			const attributeIDs = taskConfig.attributeIDs;
			const attributeTypes = taskConfig.attributeTypes;
			let dracoGeometry;
			let decodingStatus;
			const geometryType = decoder.GetEncodedGeometryType( decoderBuffer );

			if ( geometryType === draco.TRIANGULAR_MESH ) {

				dracoGeometry = new draco.Mesh();
				decodingStatus = decoder.DecodeBufferToMesh( decoderBuffer, dracoGeometry );

			} else if ( geometryType === draco.POINT_CLOUD ) {

				dracoGeometry = new draco.PointCloud();
				decodingStatus = decoder.DecodeBufferToPointCloud( decoderBuffer, dracoGeometry );

			} else {

				throw new Error( 'THREE.DRACOLoader: Unexpected geometry type.' );

			}

			if ( ! decodingStatus.ok() || dracoGeometry.ptr === 0 ) {

				throw new Error( 'THREE.DRACOLoader: Decoding failed: ' + decodingStatus.error_msg() );

			}

			const geometry = {
				index: null,
				attributes: []
			}; // Gather all vertex attributes.

			for ( const attributeName in attributeIDs ) {

				const attributeType = self[ attributeTypes[ attributeName ] ];
				let attribute;
				let attributeID; // A Draco file may be created with default vertex attributes, whose attribute IDs
				// are mapped 1:1 from their semantic name (POSITION, NORMAL, ...). Alternatively,
				// a Draco file may contain a custom set of attributes, identified by known unique
				// IDs. glTF files always do the latter, and `.drc` files typically do the former.

				if ( taskConfig.useUniqueIDs ) {

					attributeID = attributeIDs[ attributeName ];
					attribute = decoder.GetAttributeByUniqueId( dracoGeometry, attributeID );

				} else {

					attributeID = decoder.GetAttributeId( dracoGeometry, draco[ attributeIDs[ attributeName ] ] );
					if ( attributeID === - 1 ) continue;
					attribute = decoder.GetAttribute( dracoGeometry, attributeID );

				}

				geometry.attributes.push( decodeAttribute( draco, decoder, dracoGeometry, attributeName, attributeType, attribute ) );

			} // Add index.


			if ( geometryType === draco.TRIANGULAR_MESH ) {

				geometry.index = decodeIndex( draco, decoder, dracoGeometry );

			}

			draco.destroy( dracoGeometry );
			return geometry;

		}

		function decodeIndex( draco, decoder, dracoGeometry ) {

			const numFaces = dracoGeometry.num_faces();
			const numIndices = numFaces * 3;
			const byteLength = numIndices * 4;

			const ptr = draco._malloc( byteLength );

			decoder.GetTrianglesUInt32Array( dracoGeometry, byteLength, ptr );
			const index = new Uint32Array( draco.HEAPF32.buffer, ptr, numIndices ).slice();

			draco._free( ptr );

			return {
				array: index,
				itemSize: 1
			};

		}

		function decodeAttribute( draco, decoder, dracoGeometry, attributeName, attributeType, attribute ) {

			const numComponents = attribute.num_components();
			const numPoints = dracoGeometry.num_points();
			const numValues = numPoints * numComponents;
			const byteLength = numValues * attributeType.BYTES_PER_ELEMENT;
			const dataType = getDracoDataType( draco, attributeType );

			const ptr = draco._malloc( byteLength );

			decoder.GetAttributeDataArrayForAllPoints( dracoGeometry, attribute, dataType, byteLength, ptr );
			const array = new attributeType( draco.HEAPF32.buffer, ptr, numValues ).slice();

			draco._free( ptr );

			return {
				name: attributeName,
				array: array,
				itemSize: numComponents
			};

		}

		function getDracoDataType( draco, attributeType ) {

			switch ( attributeType ) {

				case Float32Array:
					return draco.DT_FLOAT32;

				case Int8Array:
					return draco.DT_INT8;

				case Int16Array:
					return draco.DT_INT16;

				case Int32Array:
					return draco.DT_INT32;

				case Uint8Array:
					return draco.DT_UINT8;

				case Uint16Array:
					return draco.DT_UINT16;

				case Uint32Array:
					return draco.DT_UINT32;

			}

		}

	}

	THREE.DRACOLoader = DRACOLoader;

} )();
( function () {

	/**
 * THREE.Loader for KTX 2.0 GPU Texture containers.
 *
 * KTX 2.0 is a container format for various GPU texture formats. The loader
 * supports Basis Universal GPU textures, which can be quickly transcoded to
 * a wide variety of GPU texture compression formats. While KTX 2.0 also allows
 * other hardware-specific formats, this loader does not yet parse them.
 *
 * References:
 * - KTX: http://github.khronos.org/KTX-Specification/
 * - DFD: https://www.khronos.org/registry/DataFormat/specs/1.3/dataformat.1.3.html#basicdescriptor
 */
	const KTX2TransferSRGB = 2;
	const KTX2_ALPHA_PREMULTIPLIED = 1;

	const _taskCache = new WeakMap();

	let _activeLoaders = 0;

	class KTX2Loader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.transcoderPath = '';
			this.transcoderBinary = null;
			this.transcoderPending = null;
			this.workerPool = new THREE.WorkerPool();
			this.workerSourceURL = '';
			this.workerConfig = null;

			if ( typeof MSC_TRANSCODER !== 'undefined' ) {

				console.warn( 'THREE.KTX2Loader: Please update to latest "basis_transcoder".' + ' "msc_basis_transcoder" is no longer supported in three.js r125+.' );

			}

		}

		setTranscoderPath( path ) {

			this.transcoderPath = path;
			return this;

		}

		setWorkerLimit( num ) {

			this.workerPool.setWorkerLimit( num );
			return this;

		}

		detectSupport( renderer ) {

			this.workerConfig = {
				astcSupported: renderer.extensions.has( 'WEBGL_compressed_texture_astc' ),
				etc1Supported: renderer.extensions.has( 'WEBGL_compressed_texture_etc1' ),
				etc2Supported: renderer.extensions.has( 'WEBGL_compressed_texture_etc' ),
				dxtSupported: renderer.extensions.has( 'WEBGL_compressed_texture_s3tc' ),
				bptcSupported: renderer.extensions.has( 'EXT_texture_compression_bptc' ),
				pvrtcSupported: renderer.extensions.has( 'WEBGL_compressed_texture_pvrtc' ) || renderer.extensions.has( 'WEBKIT_WEBGL_compressed_texture_pvrtc' )
			};

			if ( renderer.capabilities.isWebGL2 ) {

				// https://github.com/mrdoob/three.js/pull/22928
				this.workerConfig.etc1Supported = false;

			}

			return this;

		}

		dispose() {

			this.workerPool.dispose();
			if ( this.workerSourceURL ) URL.revokeObjectURL( this.workerSourceURL );
			return this;

		}

		init() {

			if ( ! this.transcoderPending ) {

				// Load transcoder wrapper.
				const jsLoader = new THREE.FileLoader( this.manager );
				jsLoader.setPath( this.transcoderPath );
				jsLoader.setWithCredentials( this.withCredentials );
				const jsContent = jsLoader.loadAsync( 'basis_transcoder.js' ); // Load transcoder WASM binary.

				const binaryLoader = new THREE.FileLoader( this.manager );
				binaryLoader.setPath( this.transcoderPath );
				binaryLoader.setResponseType( 'arraybuffer' );
				binaryLoader.setWithCredentials( this.withCredentials );
				const binaryContent = binaryLoader.loadAsync( 'basis_transcoder.wasm' );
				this.transcoderPending = Promise.all( [ jsContent, binaryContent ] ).then( ( [ jsContent, binaryContent ] ) => {

					const fn = KTX2Loader.BasisWorker.toString();
					const body = [ '/* constants */', 'let _EngineFormat = ' + JSON.stringify( KTX2Loader.EngineFormat ), 'let _TranscoderFormat = ' + JSON.stringify( KTX2Loader.TranscoderFormat ), 'let _BasisFormat = ' + JSON.stringify( KTX2Loader.BasisFormat ), '/* basis_transcoder.js */', jsContent, '/* worker */', fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) ) ].join( '\n' );
					this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );
					this.transcoderBinary = binaryContent;
					this.workerPool.setWorkerCreator( () => {

						const worker = new Worker( this.workerSourceURL );
						const transcoderBinary = this.transcoderBinary.slice( 0 );
						worker.postMessage( {
							type: 'init',
							config: this.workerConfig,
							transcoderBinary
						}, [ transcoderBinary ] );
						return worker;

					} );

				} );

				if ( _activeLoaders > 0 ) {

					// Each instance loads a transcoder and allocates workers, increasing network and memory cost.
					console.warn( 'THREE.KTX2Loader: Multiple active KTX2 loaders may cause performance issues.' + ' Use a single KTX2Loader instance, or call .dispose() on old instances.' );

				}

				_activeLoaders ++;

			}

			return this.transcoderPending;

		}

		load( url, onLoad, onProgress, onError ) {

			if ( this.workerConfig === null ) {

				throw new Error( 'THREE.KTX2Loader: Missing initialization with `.detectSupport( renderer )`.' );

			}

			const loader = new THREE.FileLoader( this.manager );
			loader.setResponseType( 'arraybuffer' );
			loader.setWithCredentials( this.withCredentials );
			const texture = new THREE.CompressedTexture();
			loader.load( url, buffer => {

				// Check for an existing task using this buffer. A transferred buffer cannot be transferred
				// again from this thread.
				if ( _taskCache.has( buffer ) ) {

					const cachedTask = _taskCache.get( buffer );

					return cachedTask.promise.then( onLoad ).catch( onError );

				}

				this._createTexture( [ buffer ] ).then( function ( _texture ) {

					texture.copy( _texture );
					texture.needsUpdate = true;
					if ( onLoad ) onLoad( texture );

				} ).catch( onError );

			}, onProgress, onError );
			return texture;

		}

		_createTextureFrom( transcodeResult ) {

			const {
				mipmaps,
				width,
				height,
				format,
				type,
				error,
				dfdTransferFn,
				dfdFlags
			} = transcodeResult;
			if ( type === 'error' ) return Promise.reject( error );
			const texture = new THREE.CompressedTexture( mipmaps, width, height, format, THREE.UnsignedByteType );
			texture.minFilter = mipmaps.length === 1 ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
			texture.magFilter = THREE.LinearFilter;
			texture.generateMipmaps = false;
			texture.needsUpdate = true;
			texture.encoding = dfdTransferFn === KTX2TransferSRGB ? THREE.sRGBEncoding : THREE.LinearEncoding;
			texture.premultiplyAlpha = !! ( dfdFlags & KTX2_ALPHA_PREMULTIPLIED );
			return texture;

		}
		/**
   * @param {ArrayBuffer[]} buffers
   * @param {object?} config
   * @return {Promise<CompressedTexture>}
   */


		_createTexture( buffers, config = {} ) {

			const taskConfig = config;
			const texturePending = this.init().then( () => {

				return this.workerPool.postMessage( {
					type: 'transcode',
					buffers,
					taskConfig: taskConfig
				}, buffers );

			} ).then( e => this._createTextureFrom( e.data ) ); // Cache the task result.

			_taskCache.set( buffers[ 0 ], {
				promise: texturePending
			} );

			return texturePending;

		}

		dispose() {

			URL.revokeObjectURL( this.workerSourceURL );
			this.workerPool.dispose();
			_activeLoaders --;
			return this;

		}

	}
	/* CONSTANTS */


	KTX2Loader.BasisFormat = {
		ETC1S: 0,
		UASTC_4x4: 1
	};
	KTX2Loader.TranscoderFormat = {
		ETC1: 0,
		ETC2: 1,
		BC1: 2,
		BC3: 3,
		BC4: 4,
		BC5: 5,
		BC7_M6_OPAQUE_ONLY: 6,
		BC7_M5: 7,
		PVRTC1_4_RGB: 8,
		PVRTC1_4_RGBA: 9,
		ASTC_4x4: 10,
		ATC_RGB: 11,
		ATC_RGBA_INTERPOLATED_ALPHA: 12,
		RGBA32: 13,
		RGB565: 14,
		BGR565: 15,
		RGBA4444: 16
	};
	KTX2Loader.EngineFormat = {
		RGBAFormat: THREE.RGBAFormat,
		RGBA_ASTC_4x4_Format: THREE.RGBA_ASTC_4x4_Format,
		RGBA_BPTC_Format: THREE.RGBA_BPTC_Format,
		RGBA_ETC2_EAC_Format: THREE.RGBA_ETC2_EAC_Format,
		RGBA_PVRTC_4BPPV1_Format: THREE.RGBA_PVRTC_4BPPV1_Format,
		RGBA_S3TC_DXT5_Format: THREE.RGBA_S3TC_DXT5_Format,
		RGB_ETC1_Format: THREE.RGB_ETC1_Format,
		RGB_ETC2_Format: THREE.RGB_ETC2_Format,
		RGB_PVRTC_4BPPV1_Format: THREE.RGB_PVRTC_4BPPV1_Format,
		RGB_S3TC_DXT1_Format: THREE.RGB_S3TC_DXT1_Format
	};
	/* WEB WORKER */

	KTX2Loader.BasisWorker = function () {

		let config;
		let transcoderPending;
		let BasisModule;
		const EngineFormat = _EngineFormat; // eslint-disable-line no-undef

		const TranscoderFormat = _TranscoderFormat; // eslint-disable-line no-undef

		const BasisFormat = _BasisFormat; // eslint-disable-line no-undef

		self.addEventListener( 'message', function ( e ) {

			const message = e.data;

			switch ( message.type ) {

				case 'init':
					config = message.config;
					init( message.transcoderBinary );
					break;

				case 'transcode':
					transcoderPending.then( () => {

						try {

							const {
								width,
								height,
								hasAlpha,
								mipmaps,
								format,
								dfdTransferFn,
								dfdFlags
							} = transcode( message.buffers[ 0 ] );
							const buffers = [];

							for ( let i = 0; i < mipmaps.length; ++ i ) {

								buffers.push( mipmaps[ i ].data.buffer );

							}

							self.postMessage( {
								type: 'transcode',
								id: message.id,
								width,
								height,
								hasAlpha,
								mipmaps,
								format,
								dfdTransferFn,
								dfdFlags
							}, buffers );

						} catch ( error ) {

							console.error( error );
							self.postMessage( {
								type: 'error',
								id: message.id,
								error: error.message
							} );

						}

					} );
					break;

			}

		} );

		function init( wasmBinary ) {

			transcoderPending = new Promise( resolve => {

				BasisModule = {
					wasmBinary,
					onRuntimeInitialized: resolve
				};
				BASIS( BasisModule ); // eslint-disable-line no-undef

			} ).then( () => {

				BasisModule.initializeBasis();

				if ( BasisModule.KTX2File === undefined ) {

					console.warn( 'THREE.KTX2Loader: Please update Basis Universal transcoder.' );

				}

			} );

		}

		function transcode( buffer ) {

			const ktx2File = new BasisModule.KTX2File( new Uint8Array( buffer ) );

			function cleanup() {

				ktx2File.close();
				ktx2File.delete();

			}

			if ( ! ktx2File.isValid() ) {

				cleanup();
				throw new Error( 'THREE.KTX2Loader:	Invalid or unsupported .ktx2 file' );

			}

			const basisFormat = ktx2File.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
			const width = ktx2File.getWidth();
			const height = ktx2File.getHeight();
			const levels = ktx2File.getLevels();
			const hasAlpha = ktx2File.getHasAlpha();
			const dfdTransferFn = ktx2File.getDFDTransferFunc();
			const dfdFlags = ktx2File.getDFDFlags();
			const {
				transcoderFormat,
				engineFormat
			} = getTranscoderFormat( basisFormat, width, height, hasAlpha );

			if ( ! width || ! height || ! levels ) {

				cleanup();
				throw new Error( 'THREE.KTX2Loader:	Invalid texture' );

			}

			if ( ! ktx2File.startTranscoding() ) {

				cleanup();
				throw new Error( 'THREE.KTX2Loader: .startTranscoding failed' );

			}

			const mipmaps = [];

			for ( let mip = 0; mip < levels; mip ++ ) {

				const levelInfo = ktx2File.getImageLevelInfo( mip, 0, 0 );
				const mipWidth = levelInfo.origWidth;
				const mipHeight = levelInfo.origHeight;
				const dst = new Uint8Array( ktx2File.getImageTranscodedSizeInBytes( mip, 0, 0, transcoderFormat ) );
				const status = ktx2File.transcodeImage( dst, mip, 0, 0, transcoderFormat, 0, - 1, - 1 );

				if ( ! status ) {

					cleanup();
					throw new Error( 'THREE.KTX2Loader: .transcodeImage failed.' );

				}

				mipmaps.push( {
					data: dst,
					width: mipWidth,
					height: mipHeight
				} );

			}

			cleanup();
			return {
				width,
				height,
				hasAlpha,
				mipmaps,
				format: engineFormat,
				dfdTransferFn,
				dfdFlags
			};

		} //
		// Optimal choice of a transcoder target format depends on the Basis format (ETC1S or UASTC),
		// device capabilities, and texture dimensions. The list below ranks the formats separately
		// for ETC1S and UASTC.
		//
		// In some cases, transcoding UASTC to RGBA32 might be preferred for higher quality (at
		// significant memory cost) compared to ETC1/2, BC1/3, and PVRTC. The transcoder currently
		// chooses RGBA32 only as a last resort and does not expose that option to the caller.


		const FORMAT_OPTIONS = [ {
			if: 'astcSupported',
			basisFormat: [ BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.ASTC_4x4, TranscoderFormat.ASTC_4x4 ],
			engineFormat: [ EngineFormat.RGBA_ASTC_4x4_Format, EngineFormat.RGBA_ASTC_4x4_Format ],
			priorityETC1S: Infinity,
			priorityUASTC: 1,
			needsPowerOfTwo: false
		}, {
			if: 'bptcSupported',
			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.BC7_M5, TranscoderFormat.BC7_M5 ],
			engineFormat: [ EngineFormat.RGBA_BPTC_Format, EngineFormat.RGBA_BPTC_Format ],
			priorityETC1S: 3,
			priorityUASTC: 2,
			needsPowerOfTwo: false
		}, {
			if: 'dxtSupported',
			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.BC1, TranscoderFormat.BC3 ],
			engineFormat: [ EngineFormat.RGB_S3TC_DXT1_Format, EngineFormat.RGBA_S3TC_DXT5_Format ],
			priorityETC1S: 4,
			priorityUASTC: 5,
			needsPowerOfTwo: false
		}, {
			if: 'etc2Supported',
			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.ETC1, TranscoderFormat.ETC2 ],
			engineFormat: [ EngineFormat.RGB_ETC2_Format, EngineFormat.RGBA_ETC2_EAC_Format ],
			priorityETC1S: 1,
			priorityUASTC: 3,
			needsPowerOfTwo: false
		}, {
			if: 'etc1Supported',
			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.ETC1 ],
			engineFormat: [ EngineFormat.RGB_ETC1_Format ],
			priorityETC1S: 2,
			priorityUASTC: 4,
			needsPowerOfTwo: false
		}, {
			if: 'pvrtcSupported',
			basisFormat: [ BasisFormat.ETC1S, BasisFormat.UASTC_4x4 ],
			transcoderFormat: [ TranscoderFormat.PVRTC1_4_RGB, TranscoderFormat.PVRTC1_4_RGBA ],
			engineFormat: [ EngineFormat.RGB_PVRTC_4BPPV1_Format, EngineFormat.RGBA_PVRTC_4BPPV1_Format ],
			priorityETC1S: 5,
			priorityUASTC: 6,
			needsPowerOfTwo: true
		} ];
		const ETC1S_OPTIONS = FORMAT_OPTIONS.sort( function ( a, b ) {

			return a.priorityETC1S - b.priorityETC1S;

		} );
		const UASTC_OPTIONS = FORMAT_OPTIONS.sort( function ( a, b ) {

			return a.priorityUASTC - b.priorityUASTC;

		} );

		function getTranscoderFormat( basisFormat, width, height, hasAlpha ) {

			let transcoderFormat;
			let engineFormat;
			const options = basisFormat === BasisFormat.ETC1S ? ETC1S_OPTIONS : UASTC_OPTIONS;

			for ( let i = 0; i < options.length; i ++ ) {

				const opt = options[ i ];
				if ( ! config[ opt.if ] ) continue;
				if ( ! opt.basisFormat.includes( basisFormat ) ) continue;
				if ( hasAlpha && opt.transcoderFormat.length < 2 ) continue;
				if ( opt.needsPowerOfTwo && ! ( isPowerOfTwo( width ) && isPowerOfTwo( height ) ) ) continue;
				transcoderFormat = opt.transcoderFormat[ hasAlpha ? 1 : 0 ];
				engineFormat = opt.engineFormat[ hasAlpha ? 1 : 0 ];
				return {
					transcoderFormat,
					engineFormat
				};

			}

			console.warn( 'THREE.KTX2Loader: No suitable compressed texture format found. Decoding to RGBA32.' );
			transcoderFormat = TranscoderFormat.RGBA32;
			engineFormat = EngineFormat.RGBAFormat;
			return {
				transcoderFormat,
				engineFormat
			};

		}

		function isPowerOfTwo( value ) {

			if ( value <= 2 ) return true;
			return ( value & value - 1 ) === 0 && value !== 0;

		}

	};

	THREE.KTX2Loader = KTX2Loader;

} )();
