/**
 * @author mrdoob / http://mrdoob.com/
 */

THREE.BufferGeometryUtils = {

	computeTangents: function ( geometry ) {

		var index = geometry.index;
		var attributes = geometry.attributes;

		// based on http://www.terathon.com/code/tangent.html
		// (per vertex tangents)

		if ( index === null ||
			 attributes.position === undefined ||
			 attributes.normal === undefined ||
			 attributes.uv === undefined ) {

			console.warn( 'THREE.BufferGeometry: Missing required attributes (index, position, normal or uv) in BufferGeometry.computeTangents()' );
			return;

		}

		var indices = index.array;
		var positions = attributes.position.array;
		var normals = attributes.normal.array;
		var uvs = attributes.uv.array;

		var nVertices = positions.length / 3;

		if ( attributes.tangent === undefined ) {

			geometry.setAttribute( 'tangent', new THREE.BufferAttribute( new Float32Array( 4 * nVertices ), 4 ) );

		}

		var tangents = attributes.tangent.array;

		var tan1 = [], tan2 = [];

		for ( var i = 0; i < nVertices; i ++ ) {

			tan1[ i ] = new THREE.Vector3();
			tan2[ i ] = new THREE.Vector3();

		}

		var vA = new THREE.Vector3(),
			vB = new THREE.Vector3(),
			vC = new THREE.Vector3(),

			uvA = new THREE.Vector2(),
			uvB = new THREE.Vector2(),
			uvC = new THREE.Vector2(),

			sdir = new THREE.Vector3(),
			tdir = new THREE.Vector3();

		function handleTriangle( a, b, c ) {

			vA.fromArray( positions, a * 3 );
			vB.fromArray( positions, b * 3 );
			vC.fromArray( positions, c * 3 );

			uvA.fromArray( uvs, a * 2 );
			uvB.fromArray( uvs, b * 2 );
			uvC.fromArray( uvs, c * 2 );

			var x1 = vB.x - vA.x;
			var x2 = vC.x - vA.x;

			var y1 = vB.y - vA.y;
			var y2 = vC.y - vA.y;

			var z1 = vB.z - vA.z;
			var z2 = vC.z - vA.z;

			var s1 = uvB.x - uvA.x;
			var s2 = uvC.x - uvA.x;

			var t1 = uvB.y - uvA.y;
			var t2 = uvC.y - uvA.y;

			var r = 1.0 / ( s1 * t2 - s2 * t1 );

			sdir.set(
				( t2 * x1 - t1 * x2 ) * r,
				( t2 * y1 - t1 * y2 ) * r,
				( t2 * z1 - t1 * z2 ) * r
			);

			tdir.set(
				( s1 * x2 - s2 * x1 ) * r,
				( s1 * y2 - s2 * y1 ) * r,
				( s1 * z2 - s2 * z1 ) * r
			);

			tan1[ a ].add( sdir );
			tan1[ b ].add( sdir );
			tan1[ c ].add( sdir );

			tan2[ a ].add( tdir );
			tan2[ b ].add( tdir );
			tan2[ c ].add( tdir );

		}

		var groups = geometry.groups;

		if ( groups.length === 0 ) {

			groups = [ {
				start: 0,
				count: indices.length
			} ];

		}

		for ( var i = 0, il = groups.length; i < il; ++ i ) {

			var group = groups[ i ];

			var start = group.start;
			var count = group.count;

			for ( var j = start, jl = start + count; j < jl; j += 3 ) {

				handleTriangle(
					indices[ j + 0 ],
					indices[ j + 1 ],
					indices[ j + 2 ]
				);

			}

		}

		var tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
		var n = new THREE.Vector3(), n2 = new THREE.Vector3();
		var w, t, test;

		function handleVertex( v ) {

			n.fromArray( normals, v * 3 );
			n2.copy( n );

			t = tan1[ v ];

			// Gram-Schmidt orthogonalize

			tmp.copy( t );
			tmp.sub( n.multiplyScalar( n.dot( t ) ) ).normalize();

			// Calculate handedness

			tmp2.crossVectors( n2, t );
			test = tmp2.dot( tan2[ v ] );
			w = ( test < 0.0 ) ? - 1.0 : 1.0;

			tangents[ v * 4 ] = tmp.x;
			tangents[ v * 4 + 1 ] = tmp.y;
			tangents[ v * 4 + 2 ] = tmp.z;
			tangents[ v * 4 + 3 ] = w;

		}

		for ( var i = 0, il = groups.length; i < il; ++ i ) {

			var group = groups[ i ];

			var start = group.start;
			var count = group.count;

			for ( var j = start, jl = start + count; j < jl; j += 3 ) {

				handleVertex( indices[ j + 0 ] );
				handleVertex( indices[ j + 1 ] );
				handleVertex( indices[ j + 2 ] );

			}

		}

	},

	/**
	 * @param  {Array<THREE.BufferGeometry>} geometries
	 * @param  {Boolean} useGroups
	 * @return {THREE.BufferGeometry}
	 */
	mergeBufferGeometries: function ( geometries, useGroups ) {

		var isIndexed = geometries[ 0 ].index !== null;

		var attributesUsed = new Set( Object.keys( geometries[ 0 ].attributes ) );
		var morphAttributesUsed = new Set( Object.keys( geometries[ 0 ].morphAttributes ) );

		var attributes = {};
		var morphAttributes = {};

		var mergedGeometry = new THREE.BufferGeometry();

		var offset = 0;

		for ( var i = 0; i < geometries.length; ++ i ) {

			var geometry = geometries[ i ];

			// ensure that all geometries are indexed, or none

			if ( isIndexed !== ( geometry.index !== null ) ) return null;

			// gather attributes, exit early if they're different

			for ( var name in geometry.attributes ) {

				if ( ! attributesUsed.has( name ) ) return null;

				if ( attributes[ name ] === undefined ) attributes[ name ] = [];

				attributes[ name ].push( geometry.attributes[ name ] );

			}

			// gather morph attributes, exit early if they're different

			for ( var name in geometry.morphAttributes ) {

				if ( ! morphAttributesUsed.has( name ) ) return null;

				if ( morphAttributes[ name ] === undefined ) morphAttributes[ name ] = [];

				morphAttributes[ name ].push( geometry.morphAttributes[ name ] );

			}

			// gather .userData

			mergedGeometry.userData.mergedUserData = mergedGeometry.userData.mergedUserData || [];
			mergedGeometry.userData.mergedUserData.push( geometry.userData );

			if ( useGroups ) {

				var count;

				if ( isIndexed ) {

					count = geometry.index.count;

				} else if ( geometry.attributes.position !== undefined ) {

					count = geometry.attributes.position.count;

				} else {

					return null;

				}

				mergedGeometry.addGroup( offset, count, i );

				offset += count;

			}

		}

		// merge indices

		if ( isIndexed ) {

			var indexOffset = 0;
			var mergedIndex = [];

			for ( var i = 0; i < geometries.length; ++ i ) {

				var index = geometries[ i ].index;

				for ( var j = 0; j < index.count; ++ j ) {

					mergedIndex.push( index.getX( j ) + indexOffset );

				}

				indexOffset += geometries[ i ].attributes.position.count;

			}

			mergedGeometry.setIndex( mergedIndex );

		}

		// merge attributes

		for ( var name in attributes ) {

			var mergedAttribute = this.mergeBufferAttributes( attributes[ name ] );

			if ( ! mergedAttribute ) return null;

			mergedGeometry.setAttribute( name, mergedAttribute );

		}

		// merge morph attributes

		for ( var name in morphAttributes ) {

			var numMorphTargets = morphAttributes[ name ][ 0 ].length;

			if ( numMorphTargets === 0 ) break;

			mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
			mergedGeometry.morphAttributes[ name ] = [];

			for ( var i = 0; i < numMorphTargets; ++ i ) {

				var morphAttributesToMerge = [];

				for ( var j = 0; j < morphAttributes[ name ].length; ++ j ) {

					morphAttributesToMerge.push( morphAttributes[ name ][ j ][ i ] );

				}

				var mergedMorphAttribute = this.mergeBufferAttributes( morphAttributesToMerge );

				if ( ! mergedMorphAttribute ) return null;

				mergedGeometry.morphAttributes[ name ].push( mergedMorphAttribute );

			}

		}

		return mergedGeometry;

	},

	/**
	 * @param {Array<THREE.BufferAttribute>} attributes
	 * @return {THREE.BufferAttribute}
	 */
	mergeBufferAttributes: function ( attributes ) {

		var TypedArray;
		var itemSize;
		var normalized;
		var arrayLength = 0;

		for ( var i = 0; i < attributes.length; ++ i ) {

			var attribute = attributes[ i ];

			if ( attribute.isInterleavedBufferAttribute ) return null;

			if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
			if ( TypedArray !== attribute.array.constructor ) return null;

			if ( itemSize === undefined ) itemSize = attribute.itemSize;
			if ( itemSize !== attribute.itemSize ) return null;

			if ( normalized === undefined ) normalized = attribute.normalized;
			if ( normalized !== attribute.normalized ) return null;

			arrayLength += attribute.array.length;

		}

		var array = new TypedArray( arrayLength );
		var offset = 0;

		for ( var i = 0; i < attributes.length; ++ i ) {

			array.set( attributes[ i ].array, offset );

			offset += attributes[ i ].array.length;

		}

		return new THREE.BufferAttribute( array, itemSize, normalized );

	},

	/**
	 * @param {Array<THREE.BufferAttribute>} attributes
	 * @return {Array<THREE.InterleavedBufferAttribute>}
	 */
	interleaveAttributes: function ( attributes ) {

		// Interleaves the provided attributes into an InterleavedBuffer and returns
		// a set of InterleavedBufferAttributes for each attribute
		var TypedArray;
		var arrayLength = 0;
		var stride = 0;

		// calculate the the length and type of the interleavedBuffer
		for ( var i = 0, l = attributes.length; i < l; ++ i ) {

			var attribute = attributes[ i ];

			if ( TypedArray === undefined ) TypedArray = attribute.array.constructor;
			if ( TypedArray !== attribute.array.constructor ) {

				console.warn( 'AttributeBuffers of different types cannot be interleaved' );
				return null;

			}

			arrayLength += attribute.array.length;
			stride += attribute.itemSize;

		}

		// Create the set of buffer attributes
		var interleavedBuffer = new THREE.InterleavedBuffer( new TypedArray( arrayLength ), stride );
		var offset = 0;
		var res = [];
		var getters = [ 'getX', 'getY', 'getZ', 'getW' ];
		var setters = [ 'setX', 'setY', 'setZ', 'setW' ];

		for ( var j = 0, l = attributes.length; j < l; j ++ ) {

			var attribute = attributes[ j ];
			var itemSize = attribute.itemSize;
			var count = attribute.count;
			var iba = new THREE.InterleavedBufferAttribute( interleavedBuffer, itemSize, offset, attribute.normalized );
			res.push( iba );

			offset += itemSize;

			// Move the data for each attribute into the new interleavedBuffer
			// at the appropriate offset
			for ( var c = 0; c < count; c ++ ) {

				for ( var k = 0; k < itemSize; k ++ ) {

					iba[ setters[ k ] ]( c, attribute[ getters[ k ] ]( c ) );

				}

			}

		}

		return res;

	},

	/**
	 * @param {Array<THREE.BufferGeometry>} geometry
	 * @return {number}
	 */
	estimateBytesUsed: function ( geometry ) {

		// Return the estimated memory used by this geometry in bytes
		// Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
		// for InterleavedBufferAttributes.
		var mem = 0;
		for ( var name in geometry.attributes ) {

			var attr = geometry.getAttribute( name );
			mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;

		}

		var indices = geometry.getIndex();
		mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
		return mem;

	},

	/**
	 * @param {THREE.BufferGeometry} geometry
	 * @param {number} tolerance
	 * @return {THREE.BufferGeometry>}
	 */
	mergeVertices: function ( geometry, tolerance = 1e-4 ) {

		tolerance = Math.max( tolerance, Number.EPSILON );

		// Generate an index buffer if the geometry doesn't have one, or optimize it
		// if it's already available.
		var hashToIndex = {};
		var indices = geometry.getIndex();
		var positions = geometry.getAttribute( 'position' );
		var vertexCount = indices ? indices.count : positions.count;

		// next value for triangle indices
		var nextIndex = 0;

		// attributes and new attribute arrays
		var attributeNames = Object.keys( geometry.attributes );
		var attrArrays = {};
		var morphAttrsArrays = {};
		var newIndices = [];
		var getters = [ 'getX', 'getY', 'getZ', 'getW' ];

		// initialize the arrays
		for ( var i = 0, l = attributeNames.length; i < l; i ++ ) {

			var name = attributeNames[ i ];

			attrArrays[ name ] = [];

			var morphAttr = geometry.morphAttributes[ name ];
			if ( morphAttr ) {

				morphAttrsArrays[ name ] = new Array( morphAttr.length ).fill().map( () => [] );

			}

		}

		// convert the error tolerance to an amount of decimal places to truncate to
		var decimalShift = Math.log10( 1 / tolerance );
		var shiftMultiplier = Math.pow( 10, decimalShift );
		for ( var i = 0; i < vertexCount; i ++ ) {

			var index = indices ? indices.getX( i ) : i;

			// Generate a hash for the vertex attributes at the current index 'i'
			var hash = '';
			for ( var j = 0, l = attributeNames.length; j < l; j ++ ) {

				var name = attributeNames[ j ];
				var attribute = geometry.getAttribute( name );
				var itemSize = attribute.itemSize;

				for ( var k = 0; k < itemSize; k ++ ) {

					// double tilde truncates the decimal value
					hash += `${ ~ ~ ( attribute[ getters[ k ] ]( index ) * shiftMultiplier ) },`;

				}

			}

			// Add another reference to the vertex if it's already
			// used by another index
			if ( hash in hashToIndex ) {

				newIndices.push( hashToIndex[ hash ] );

			} else {

				// copy data to the new index in the attribute arrays
				for ( var j = 0, l = attributeNames.length; j < l; j ++ ) {

					var name = attributeNames[ j ];
					var attribute = geometry.getAttribute( name );
					var morphAttr = geometry.morphAttributes[ name ];
					var itemSize = attribute.itemSize;
					var newarray = attrArrays[ name ];
					var newMorphArrays = morphAttrsArrays[ name ];

					for ( var k = 0; k < itemSize; k ++ ) {

						var getterFunc = getters[ k ];
						newarray.push( attribute[ getterFunc ]( index ) );

						if ( morphAttr ) {

							for ( var m = 0, ml = morphAttr.length; m < ml; m ++ ) {

								newMorphArrays[ m ].push( morphAttr[ m ][ getterFunc ]( index ) );

							}

						}

					}

				}

				hashToIndex[ hash ] = nextIndex;
				newIndices.push( nextIndex );
				nextIndex ++;

			}

		}

		// Generate typed arrays from new attribute arrays and update
		// the attributeBuffers
		const result = geometry.clone();
		for ( var i = 0, l = attributeNames.length; i < l; i ++ ) {

			var name = attributeNames[ i ];
			var oldAttribute = geometry.getAttribute( name );
			var attribute;

			var buffer = new oldAttribute.array.constructor( attrArrays[ name ] );
			if ( oldAttribute.isInterleavedBufferAttribute ) {

				attribute = new THREE.BufferAttribute( buffer, oldAttribute.itemSize, oldAttribute.itemSize );

			} else {

				attribute = geometry.getAttribute( name ).clone();
				attribute.setArray( buffer );

			}

			result.setAttribute( name, attribute );

			// Update the attribute arrays
			if ( name in morphAttrsArrays ) {

				for ( var j = 0; j < morphAttrsArrays[ name ].length; j ++ ) {

					var morphAttribute = geometry.morphAttributes[ name ][ j ].clone();
					morphAttribute.setArray( new morphAttribute.array.constructor( morphAttrsArrays[ name ][ j ] ) );
					result.morphAttributes[ name ][ j ] = morphAttribute;

				}

			}

		}

		// Generate an index buffer typed array
		var cons = Uint8Array;
		if ( newIndices.length >= Math.pow( 2, 8 ) ) cons = Uint16Array;
		if ( newIndices.length >= Math.pow( 2, 16 ) ) cons = Uint32Array;

		var newIndexBuffer = new cons( newIndices );
		var newIndices = null;
		if ( indices === null ) {

			newIndices = new THREE.BufferAttribute( newIndexBuffer, 1 );

		} else {

			newIndices = geometry.getIndex().clone();
			newIndices.setArray( newIndexBuffer );

		}

		result.setIndex( newIndices );

		return result;

	}

};

/**
 * @author fernandojsg / http://fernandojsg.com
 * @author Don McCurdy / https://www.donmccurdy.com
 * @author Takahiro / https://github.com/takahirox
 */

//------------------------------------------------------------------------------
// Constants
//------------------------------------------------------------------------------
var WEBGL_CONSTANTS = {
	POINTS: 0x0000,
	LINES: 0x0001,
	LINE_LOOP: 0x0002,
	LINE_STRIP: 0x0003,
	TRIANGLES: 0x0004,
	TRIANGLE_STRIP: 0x0005,
	TRIANGLE_FAN: 0x0006,

	UNSIGNED_BYTE: 0x1401,
	UNSIGNED_SHORT: 0x1403,
	FLOAT: 0x1406,
	UNSIGNED_INT: 0x1405,
	ARRAY_BUFFER: 0x8892,
	ELEMENT_ARRAY_BUFFER: 0x8893,

	NEAREST: 0x2600,
	LINEAR: 0x2601,
	NEAREST_MIPMAP_NEAREST: 0x2700,
	LINEAR_MIPMAP_NEAREST: 0x2701,
	NEAREST_MIPMAP_LINEAR: 0x2702,
	LINEAR_MIPMAP_LINEAR: 0x2703,

	CLAMP_TO_EDGE: 33071,
	MIRRORED_REPEAT: 33648,
	REPEAT: 10497
};

var THREE_TO_WEBGL = {};

THREE_TO_WEBGL[ THREE.NearestFilter ] = WEBGL_CONSTANTS.NEAREST;
THREE_TO_WEBGL[ THREE.NearestMipmapNearestFilter ] = WEBGL_CONSTANTS.NEAREST_MIPMAP_NEAREST;
THREE_TO_WEBGL[ THREE.NearestMipmapLinearFilter ] = WEBGL_CONSTANTS.NEAREST_MIPMAP_LINEAR;
THREE_TO_WEBGL[ THREE.LinearFilter ] = WEBGL_CONSTANTS.LINEAR;
THREE_TO_WEBGL[ THREE.LinearMipmapNearestFilter ] = WEBGL_CONSTANTS.LINEAR_MIPMAP_NEAREST;
THREE_TO_WEBGL[ THREE.LinearMipmapLinearFilter ] = WEBGL_CONSTANTS.LINEAR_MIPMAP_LINEAR;

THREE_TO_WEBGL[ THREE.ClampToEdgeWrapping ] = WEBGL_CONSTANTS.CLAMP_TO_EDGE;
THREE_TO_WEBGL[ THREE.RepeatWrapping ] = WEBGL_CONSTANTS.REPEAT;
THREE_TO_WEBGL[ THREE.MirroredRepeatWrapping ] = WEBGL_CONSTANTS.MIRRORED_REPEAT;

var PATH_PROPERTIES = {
	scale: 'scale',
	position: 'translation',
	quaternion: 'rotation',
	morphTargetInfluences: 'weights'
};

//------------------------------------------------------------------------------
// GLTF Exporter
//------------------------------------------------------------------------------
THREE.GLTFExporter = function () {};

THREE.GLTFExporter.prototype = {

	constructor: THREE.GLTFExporter,

	/**
	 * Parse scenes and generate GLTF output
	 * @param  {THREE.Scene or [THREE.Scenes]} input   THREE.Scene or Array of THREE.Scenes
	 * @param  {Function} onDone  Callback on completed
	 * @param  {Object} options options
	 */
	parse: function ( input, onDone, options ) {

		var DEFAULT_OPTIONS = {
			binary: false,
			trs: false,
			onlyVisible: true,
			truncateDrawRange: true,
			embedImages: true,
			maxTextureSize: Infinity,
			animations: [],
			forceIndices: false,
			forcePowerOfTwoTextures: false,
			includeCustomExtensions: false
		};

		options = Object.assign( {}, DEFAULT_OPTIONS, options );

		if ( options.animations.length > 0 ) {

			// Only TRS properties, and not matrices, may be targeted by animation.
			options.trs = true;

		}

		var outputJSON = {

			asset: {

				version: "2.0",
				generator: "THREE.GLTFExporter"

			}

		};

		var byteOffset = 0;
		var buffers = [];
		var pending = [];
		var nodeMap = new Map();
		var skins = [];
		var extensionsUsed = {};
		var cachedData = {

			meshes: new Map(),
			attributes: new Map(),
			attributesNormalized: new Map(),
			materials: new Map(),
			textures: new Map(),
			images: new Map()

		};

		var cachedCanvas;

		var uids = new Map();
		var uid = 0;

		/**
		 * Assign and return a temporal unique id for an object
		 * especially which doesn't have .uuid
		 * @param  {Object} object
		 * @return {Integer}
		 */
		function getUID( object ) {

			if ( ! uids.has( object ) ) uids.set( object, uid ++ );

			return uids.get( object );

		}

		/**
		 * Compare two arrays
		 * @param  {Array} array1 Array 1 to compare
		 * @param  {Array} array2 Array 2 to compare
		 * @return {Boolean}        Returns true if both arrays are equal
		 */
		function equalArray( array1, array2 ) {

			return ( array1.length === array2.length ) && array1.every( function ( element, index ) {

				return element === array2[ index ];

			} );

		}

		/**
		 * Converts a string to an ArrayBuffer.
		 * @param  {string} text
		 * @return {ArrayBuffer}
		 */
		function stringToArrayBuffer( text ) {

			if ( window.TextEncoder !== undefined ) {

				return new TextEncoder().encode( text ).buffer;

			}

			var array = new Uint8Array( new ArrayBuffer( text.length ) );

			for ( var i = 0, il = text.length; i < il; i ++ ) {

				var value = text.charCodeAt( i );

				// Replacing multi-byte character with space(0x20).
				array[ i ] = value > 0xFF ? 0x20 : value;

			}

			return array.buffer;

		}

		/**
		 * Get the min and max vectors from the given attribute
		 * @param  {THREE.BufferAttribute} attribute Attribute to find the min/max in range from start to start + count
		 * @param  {Integer} start
		 * @param  {Integer} count
		 * @return {Object} Object containing the `min` and `max` values (As an array of attribute.itemSize components)
		 */
		function getMinMax( attribute, start, count ) {

			var output = {

				min: new Array( attribute.itemSize ).fill( Number.POSITIVE_INFINITY ),
				max: new Array( attribute.itemSize ).fill( Number.NEGATIVE_INFINITY )

			};

			for ( var i = start; i < start + count; i ++ ) {

				for ( var a = 0; a < attribute.itemSize; a ++ ) {

					var value = attribute.array[ i * attribute.itemSize + a ];
					output.min[ a ] = Math.min( output.min[ a ], value );
					output.max[ a ] = Math.max( output.max[ a ], value );

				}

			}

			return output;

		}

		/**
		 * Checks if image size is POT.
		 *
		 * @param {Image} image The image to be checked.
		 * @returns {Boolean} Returns true if image size is POT.
		 *
		 */
		function isPowerOfTwo( image ) {

			return THREE.Math.isPowerOfTwo( image.width ) && THREE.Math.isPowerOfTwo( image.height );

		}

		/**
		 * Checks if normal attribute values are normalized.
		 *
		 * @param {THREE.BufferAttribute} normal
		 * @returns {Boolean}
		 *
		 */
		function isNormalizedNormalAttribute( normal ) {

			if ( cachedData.attributesNormalized.has( normal ) ) {

				return false;

			}

			var v = new THREE.Vector3();

			for ( var i = 0, il = normal.count; i < il; i ++ ) {

				// 0.0005 is from glTF-validator
				if ( Math.abs( v.fromArray( normal.array, i * 3 ).length() - 1.0 ) > 0.0005 ) return false;

			}

			return true;

		}

		/**
		 * Creates normalized normal buffer attribute.
		 *
		 * @param {THREE.BufferAttribute} normal
		 * @returns {THREE.BufferAttribute}
		 *
		 */
		function createNormalizedNormalAttribute( normal ) {

			if ( cachedData.attributesNormalized.has( normal ) ) {

				return cachedData.attributesNormalized.get( normal );

			}

			var attribute = normal.clone();

			var v = new THREE.Vector3();

			for ( var i = 0, il = attribute.count; i < il; i ++ ) {

				v.fromArray( attribute.array, i * 3 );

				if ( v.x === 0 && v.y === 0 && v.z === 0 ) {

					// if values can't be normalized set (1, 0, 0)
					v.setX( 1.0 );

				} else {

					v.normalize();

				}

				v.toArray( attribute.array, i * 3 );

			}

			cachedData.attributesNormalized.set( normal, attribute );

			return attribute;

		}

		/**
		 * Get the required size + padding for a buffer, rounded to the next 4-byte boundary.
		 * https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#data-alignment
		 *
		 * @param {Integer} bufferSize The size the original buffer.
		 * @returns {Integer} new buffer size with required padding.
		 *
		 */
		function getPaddedBufferSize( bufferSize ) {

			return Math.ceil( bufferSize / 4 ) * 4;

		}

		/**
		 * Returns a buffer aligned to 4-byte boundary.
		 *
		 * @param {ArrayBuffer} arrayBuffer Buffer to pad
		 * @param {Integer} paddingByte (Optional)
		 * @returns {ArrayBuffer} The same buffer if it's already aligned to 4-byte boundary or a new buffer
		 */
		function getPaddedArrayBuffer( arrayBuffer, paddingByte ) {

			paddingByte = paddingByte || 0;

			var paddedLength = getPaddedBufferSize( arrayBuffer.byteLength );

			if ( paddedLength !== arrayBuffer.byteLength ) {

				var array = new Uint8Array( paddedLength );
				array.set( new Uint8Array( arrayBuffer ) );

				if ( paddingByte !== 0 ) {

					for ( var i = arrayBuffer.byteLength; i < paddedLength; i ++ ) {

						array[ i ] = paddingByte;

					}

				}

				return array.buffer;

			}

			return arrayBuffer;

		}

		/**
		 * Serializes a userData.
		 *
		 * @param {THREE.Object3D|THREE.Material} object
		 * @param {Object} gltfProperty
		 */
		function serializeUserData( object, gltfProperty ) {

			if ( Object.keys( object.userData ).length === 0 ) {

				return;

			}

			try {

				var json = JSON.parse( JSON.stringify( object.userData ) );

				if ( options.includeCustomExtensions && json.gltfExtensions ) {

					if ( gltfProperty.extensions === undefined ) {

						gltfProperty.extensions = {};

					}

					for ( var extensionName in json.gltfExtensions ) {

						gltfProperty.extensions[ extensionName ] = json.gltfExtensions[ extensionName ];
						extensionsUsed[ extensionName ] = true;

					}

					delete json.gltfExtensions;

				}

				if ( Object.keys( json ).length > 0 ) {

					gltfProperty.extras = json;

				}

			} catch ( error ) {

				console.warn( 'THREE.GLTFExporter: userData of \'' + object.name + '\' ' +
					'won\'t be serialized because of JSON.stringify error - ' + error.message );

			}

		}

		/**
		 * Applies a texture transform, if present, to the map definition. Requires
		 * the KHR_texture_transform extension.
		 */
		function applyTextureTransform( mapDef, texture ) {

			var didTransform = false;
			var transformDef = {};

			if ( texture.offset.x !== 0 || texture.offset.y !== 0 ) {

				transformDef.offset = texture.offset.toArray();
				didTransform = true;

			}

			if ( texture.rotation !== 0 ) {

				transformDef.rotation = texture.rotation;
				didTransform = true;

			}

			if ( texture.repeat.x !== 1 || texture.repeat.y !== 1 ) {

				transformDef.scale = texture.repeat.toArray();
				didTransform = true;

			}

			if ( didTransform ) {

				mapDef.extensions = mapDef.extensions || {};
				mapDef.extensions[ 'KHR_texture_transform' ] = transformDef;
				extensionsUsed[ 'KHR_texture_transform' ] = true;

			}

		}

		/**
		 * Process a buffer to append to the default one.
		 * @param  {ArrayBuffer} buffer
		 * @return {Integer}
		 */
		function processBuffer( buffer ) {

			if ( ! outputJSON.buffers ) {

				outputJSON.buffers = [ { byteLength: 0 } ];

			}

			// All buffers are merged before export.
			buffers.push( buffer );

			return 0;

		}

		/**
		 * Process and generate a BufferView
		 * @param  {THREE.BufferAttribute} attribute
		 * @param  {number} componentType
		 * @param  {number} start
		 * @param  {number} count
		 * @param  {number} target (Optional) Target usage of the BufferView
		 * @return {Object}
		 */
		function processBufferView( attribute, componentType, start, count, target ) {

			if ( ! outputJSON.bufferViews ) {

				outputJSON.bufferViews = [];

			}

			// Create a new dataview and dump the attribute's array into it

			var componentSize;

			if ( componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE ) {

				componentSize = 1;

			} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ) {

				componentSize = 2;

			} else {

				componentSize = 4;

			}

			var byteLength = getPaddedBufferSize( count * attribute.itemSize * componentSize );
			var dataView = new DataView( new ArrayBuffer( byteLength ) );
			var offset = 0;

			for ( var i = start; i < start + count; i ++ ) {

				for ( var a = 0; a < attribute.itemSize; a ++ ) {

					// @TODO Fails on InterleavedBufferAttribute, and could probably be
					// optimized for normal BufferAttribute.
					var value = attribute.array[ i * attribute.itemSize + a ];

					if ( componentType === WEBGL_CONSTANTS.FLOAT ) {

						dataView.setFloat32( offset, value, true );

					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_INT ) {

						dataView.setUint32( offset, value, true );

					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_SHORT ) {

						dataView.setUint16( offset, value, true );

					} else if ( componentType === WEBGL_CONSTANTS.UNSIGNED_BYTE ) {

						dataView.setUint8( offset, value );

					}

					offset += componentSize;

				}

			}

			var gltfBufferView = {

				buffer: processBuffer( dataView.buffer ),
				byteOffset: byteOffset,
				byteLength: byteLength

			};

			if ( target !== undefined ) gltfBufferView.target = target;

			if ( target === WEBGL_CONSTANTS.ARRAY_BUFFER ) {

				// Only define byteStride for vertex attributes.
				gltfBufferView.byteStride = attribute.itemSize * componentSize;

			}

			byteOffset += byteLength;

			outputJSON.bufferViews.push( gltfBufferView );

			// @TODO Merge bufferViews where possible.
			var output = {

				id: outputJSON.bufferViews.length - 1,
				byteLength: 0

			};

			return output;

		}

		/**
		 * Process and generate a BufferView from an image Blob.
		 * @param {Blob} blob
		 * @return {Promise<Integer>}
		 */
		function processBufferViewImage( blob ) {

			if ( ! outputJSON.bufferViews ) {

				outputJSON.bufferViews = [];

			}

			return new Promise( function ( resolve ) {

				var reader = new window.FileReader();
				reader.readAsArrayBuffer( blob );
				reader.onloadend = function () {

					var buffer = getPaddedArrayBuffer( reader.result );

					var bufferView = {
						buffer: processBuffer( buffer ),
						byteOffset: byteOffset,
						byteLength: buffer.byteLength
					};

					byteOffset += buffer.byteLength;

					outputJSON.bufferViews.push( bufferView );

					resolve( outputJSON.bufferViews.length - 1 );

				};

			} );

		}

		/**
		 * Process attribute to generate an accessor
		 * @param  {THREE.BufferAttribute} attribute Attribute to process
		 * @param  {THREE.BufferGeometry} geometry (Optional) Geometry used for truncated draw range
		 * @param  {Integer} start (Optional)
		 * @param  {Integer} count (Optional)
		 * @return {Integer}           Index of the processed accessor on the "accessors" array
		 */
		function processAccessor( attribute, geometry, start, count ) {

			var types = {

				1: 'SCALAR',
				2: 'VEC2',
				3: 'VEC3',
				4: 'VEC4',
				16: 'MAT4'

			};

			var componentType;

			// Detect the component type of the attribute array (float, uint or ushort)
			if ( attribute.array.constructor === Float32Array ) {

				componentType = WEBGL_CONSTANTS.FLOAT;

			} else if ( attribute.array.constructor === Uint32Array ) {

				componentType = WEBGL_CONSTANTS.UNSIGNED_INT;

			} else if ( attribute.array.constructor === Uint16Array ) {

				componentType = WEBGL_CONSTANTS.UNSIGNED_SHORT;

			} else if ( attribute.array.constructor === Uint8Array ) {

				componentType = WEBGL_CONSTANTS.UNSIGNED_BYTE;

			} else {

				throw new Error( 'THREE.GLTFExporter: Unsupported bufferAttribute component type.' );

			}

			if ( start === undefined ) start = 0;
			if ( count === undefined ) count = attribute.count;

			// @TODO Indexed buffer geometry with drawRange not supported yet
			if ( options.truncateDrawRange && geometry !== undefined && geometry.index === null ) {

				var end = start + count;
				var end2 = geometry.drawRange.count === Infinity
					? attribute.count
					: geometry.drawRange.start + geometry.drawRange.count;

				start = Math.max( start, geometry.drawRange.start );
				count = Math.min( end, end2 ) - start;

				if ( count < 0 ) count = 0;

			}

			// Skip creating an accessor if the attribute doesn't have data to export
			if ( count === 0 ) {

				return null;

			}

			var minMax = getMinMax( attribute, start, count );

			var bufferViewTarget;

			// If geometry isn't provided, don't infer the target usage of the bufferView. For
			// animation samplers, target must not be set.
			if ( geometry !== undefined ) {

				bufferViewTarget = attribute === geometry.index ? WEBGL_CONSTANTS.ELEMENT_ARRAY_BUFFER : WEBGL_CONSTANTS.ARRAY_BUFFER;

			}

			var bufferView = processBufferView( attribute, componentType, start, count, bufferViewTarget );

			var gltfAccessor = {

				bufferView: bufferView.id,
				byteOffset: bufferView.byteOffset,
				componentType: componentType,
				count: count,
				max: minMax.max,
				min: minMax.min,
				type: types[ attribute.itemSize ]

			};

			if ( ! outputJSON.accessors ) {

				outputJSON.accessors = [];

			}

			outputJSON.accessors.push( gltfAccessor );

			return outputJSON.accessors.length - 1;

		}

		/**
		 * Process image
		 * @param  {Image} image to process
		 * @param  {Integer} format of the image (e.g. THREE.RGBFormat, THREE.RGBAFormat etc)
		 * @param  {Boolean} flipY before writing out the image
		 * @return {Integer}     Index of the processed texture in the "images" array
		 */
		function processImage( image, format, flipY ) {

			if ( ! cachedData.images.has( image ) ) {

				cachedData.images.set( image, {} );

			}

			var cachedImages = cachedData.images.get( image );
			var mimeType = format === THREE.RGBAFormat ? 'image/png' : 'image/jpeg';
			var key = mimeType + ":flipY/" + flipY.toString();

			if ( cachedImages[ key ] !== undefined ) {

				return cachedImages[ key ];

			}

			if ( ! outputJSON.images ) {

				outputJSON.images = [];

			}

			var gltfImage = { mimeType: mimeType };

			if ( options.embedImages ) {

				var canvas = cachedCanvas = cachedCanvas || document.createElement( 'canvas' );

				canvas.width = Math.min( image.width, options.maxTextureSize );
				canvas.height = Math.min( image.height, options.maxTextureSize );

				if ( options.forcePowerOfTwoTextures && ! isPowerOfTwo( canvas ) ) {

					console.warn( 'GLTFExporter: Resized non-power-of-two image.', image );

					canvas.width = THREE.Math.floorPowerOfTwo( canvas.width );
					canvas.height = THREE.Math.floorPowerOfTwo( canvas.height );

				}

				var ctx = canvas.getContext( '2d' );

				if ( flipY === true ) {

					ctx.translate( 0, canvas.height );
					ctx.scale( 1, - 1 );

				}

				ctx.drawImage( image, 0, 0, canvas.width, canvas.height );

				if ( options.binary === true ) {

					pending.push( new Promise( function ( resolve ) {

						canvas.toBlob( function ( blob ) {

							processBufferViewImage( blob ).then( function ( bufferViewIndex ) {

								gltfImage.bufferView = bufferViewIndex;

								resolve();

							} );

						}, mimeType );

					} ) );

				} else {

					gltfImage.uri = canvas.toDataURL( mimeType );

				}

			} else {

				gltfImage.uri = image.src;

			}

			outputJSON.images.push( gltfImage );

			var index = outputJSON.images.length - 1;
			cachedImages[ key ] = index;

			return index;

		}

		/**
		 * Process sampler
		 * @param  {Texture} map Texture to process
		 * @return {Integer}     Index of the processed texture in the "samplers" array
		 */
		function processSampler( map ) {

			if ( ! outputJSON.samplers ) {

				outputJSON.samplers = [];

			}

			var gltfSampler = {

				magFilter: THREE_TO_WEBGL[ map.magFilter ],
				minFilter: THREE_TO_WEBGL[ map.minFilter ],
				wrapS: THREE_TO_WEBGL[ map.wrapS ],
				wrapT: THREE_TO_WEBGL[ map.wrapT ]

			};

			outputJSON.samplers.push( gltfSampler );

			return outputJSON.samplers.length - 1;

		}

		/**
		 * Process texture
		 * @param  {Texture} map Map to process
		 * @return {Integer}     Index of the processed texture in the "textures" array
		 */
		function processTexture( map ) {

			if ( cachedData.textures.has( map ) ) {

				return cachedData.textures.get( map );

			}

			if ( ! outputJSON.textures ) {

				outputJSON.textures = [];

			}

			var gltfTexture = {

				sampler: processSampler( map ),
				source: processImage( map.image, map.format, map.flipY )

			};

			if ( map.name ) {

				gltfTexture.name = map.name;

			}

			outputJSON.textures.push( gltfTexture );

			var index = outputJSON.textures.length - 1;
			cachedData.textures.set( map, index );

			return index;

		}

		/**
		 * Process material
		 * @param  {THREE.Material} material Material to process
		 * @return {Integer}      Index of the processed material in the "materials" array
		 */
		function processMaterial( material ) {

			if ( cachedData.materials.has( material ) ) {

				return cachedData.materials.get( material );

			}

			if ( ! outputJSON.materials ) {

				outputJSON.materials = [];

			}

			if ( material.isShaderMaterial && ! material.isGLTFSpecularGlossinessMaterial ) {

				console.warn( 'GLTFExporter: THREE.ShaderMaterial not supported.' );
				return null;

			}

			// @QUESTION Should we avoid including any attribute that has the default value?
			var gltfMaterial = {

				pbrMetallicRoughness: {}

			};

			if ( material.isMeshBasicMaterial ) {

				gltfMaterial.extensions = { KHR_materials_unlit: {} };

				extensionsUsed[ 'KHR_materials_unlit' ] = true;

			} else if ( material.isGLTFSpecularGlossinessMaterial ) {

				gltfMaterial.extensions = { KHR_materials_pbrSpecularGlossiness: {} };

				extensionsUsed[ 'KHR_materials_pbrSpecularGlossiness' ] = true;

			} else if ( ! material.isMeshStandardMaterial ) {

				console.warn( 'GLTFExporter: Use MeshStandardMaterial or MeshBasicMaterial for best results.' );

			}

			// pbrMetallicRoughness.baseColorFactor
			var color = material.color.toArray().concat( [ material.opacity ] );

			if ( ! equalArray( color, [ 1, 1, 1, 1 ] ) ) {

				gltfMaterial.pbrMetallicRoughness.baseColorFactor = color;

			}

			if ( material.isMeshStandardMaterial ) {

				gltfMaterial.pbrMetallicRoughness.metallicFactor = material.metalness;
				gltfMaterial.pbrMetallicRoughness.roughnessFactor = material.roughness;

			} else if ( material.isMeshBasicMaterial ) {

				gltfMaterial.pbrMetallicRoughness.metallicFactor = 0.0;
				gltfMaterial.pbrMetallicRoughness.roughnessFactor = 0.9;

			} else {

				gltfMaterial.pbrMetallicRoughness.metallicFactor = 0.5;
				gltfMaterial.pbrMetallicRoughness.roughnessFactor = 0.5;

			}

			// pbrSpecularGlossiness diffuse, specular and glossiness factor
			if ( material.isGLTFSpecularGlossinessMaterial ) {

				if ( gltfMaterial.pbrMetallicRoughness.baseColorFactor ) {

					gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness.diffuseFactor = gltfMaterial.pbrMetallicRoughness.baseColorFactor;

				}

				var specularFactor = [ 1, 1, 1 ];
				material.specular.toArray( specularFactor, 0 );
				gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness.specularFactor = specularFactor;

				gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness.glossinessFactor = material.glossiness;

			}

			// pbrMetallicRoughness.metallicRoughnessTexture
			if ( material.metalnessMap || material.roughnessMap ) {

				if ( material.metalnessMap === material.roughnessMap ) {

					var metalRoughMapDef = { index: processTexture( material.metalnessMap ) };
					applyTextureTransform( metalRoughMapDef, material.metalnessMap );
					gltfMaterial.pbrMetallicRoughness.metallicRoughnessTexture = metalRoughMapDef;

				} else {

					console.warn( 'THREE.GLTFExporter: Ignoring metalnessMap and roughnessMap because they are not the same Texture.' );

				}

			}

			// pbrMetallicRoughness.baseColorTexture or pbrSpecularGlossiness diffuseTexture
			if ( material.map ) {

				var baseColorMapDef = { index: processTexture( material.map ) };
				applyTextureTransform( baseColorMapDef, material.map );

				if ( material.isGLTFSpecularGlossinessMaterial ) {

					gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness.diffuseTexture = baseColorMapDef;

				}

				gltfMaterial.pbrMetallicRoughness.baseColorTexture = baseColorMapDef;

			}

			// pbrSpecularGlossiness specular map
			if ( material.isGLTFSpecularGlossinessMaterial && material.specularMap ) {

				var specularMapDef = { index: processTexture( material.specularMap ) };
				applyTextureTransform( specularMapDef, material.specularMap );
				gltfMaterial.extensions.KHR_materials_pbrSpecularGlossiness.specularGlossinessTexture = specularMapDef;

			}

			if ( material.isMeshBasicMaterial ||
				material.isLineBasicMaterial ||
				material.isPointsMaterial ) {

			} else {

				// emissiveFactor
				var emissive = material.emissive.clone().multiplyScalar( material.emissiveIntensity ).toArray();

				if ( ! equalArray( emissive, [ 0, 0, 0 ] ) ) {

					gltfMaterial.emissiveFactor = emissive;

				}

				// emissiveTexture
				if ( material.emissiveMap ) {

					var emissiveMapDef = { index: processTexture( material.emissiveMap ) };
					applyTextureTransform( emissiveMapDef, material.emissiveMap );
					gltfMaterial.emissiveTexture = emissiveMapDef;

				}

			}

			// normalTexture
			if ( material.normalMap ) {

				var normalMapDef = { index: processTexture( material.normalMap ) };

				if ( material.normalScale && material.normalScale.x !== - 1 ) {

					if ( material.normalScale.x !== material.normalScale.y ) {

						console.warn( 'THREE.GLTFExporter: Normal scale components are different, ignoring Y and exporting X.' );

					}

					normalMapDef.scale = material.normalScale.x;

				}

				applyTextureTransform( normalMapDef, material.normalMap );

				gltfMaterial.normalTexture = normalMapDef;

			}

			// occlusionTexture
			if ( material.aoMap ) {

				var occlusionMapDef = {
					index: processTexture( material.aoMap ),
					texCoord: 1
				};

				if ( material.aoMapIntensity !== 1.0 ) {

					occlusionMapDef.strength = material.aoMapIntensity;

				}

				applyTextureTransform( occlusionMapDef, material.aoMap );

				gltfMaterial.occlusionTexture = occlusionMapDef;

			}

			// alphaMode
			if ( material.transparent ) {

				gltfMaterial.alphaMode = 'BLEND';

			} else {

				if ( material.alphaTest > 0.0 ) {

					gltfMaterial.alphaMode = 'MASK';
					gltfMaterial.alphaCutoff = material.alphaTest;

				}

			}

			// doubleSided
			if ( material.side === THREE.DoubleSide ) {

				gltfMaterial.doubleSided = true;

			}

			if ( material.name !== '' ) {

				gltfMaterial.name = material.name;

			}

			serializeUserData( material, gltfMaterial );

			outputJSON.materials.push( gltfMaterial );

			var index = outputJSON.materials.length - 1;
			cachedData.materials.set( material, index );

			return index;

		}

		/**
		 * Process mesh
		 * @param  {THREE.Mesh} mesh Mesh to process
		 * @return {Integer}      Index of the processed mesh in the "meshes" array
		 */
		function processMesh( mesh ) {

			var cacheKey = mesh.geometry.uuid + ':' + mesh.material.uuid;
			if ( cachedData.meshes.has( cacheKey ) ) {

				return cachedData.meshes.get( cacheKey );

			}

			var geometry = mesh.geometry;

			var mode;

			// Use the correct mode
			if ( mesh.isLineSegments ) {

				mode = WEBGL_CONSTANTS.LINES;

			} else if ( mesh.isLineLoop ) {

				mode = WEBGL_CONSTANTS.LINE_LOOP;

			} else if ( mesh.isLine ) {

				mode = WEBGL_CONSTANTS.LINE_STRIP;

			} else if ( mesh.isPoints ) {

				mode = WEBGL_CONSTANTS.POINTS;

			} else {

				if ( ! geometry.isBufferGeometry ) {

					console.warn( 'GLTFExporter: Exporting THREE.Geometry will increase file size. Use THREE.BufferGeometry instead.' );

					var geometryTemp = new THREE.BufferGeometry();
					geometryTemp.fromGeometry( geometry );
					geometry = geometryTemp;

				}

				if ( mesh.drawMode === THREE.TriangleFanDrawMode ) {

					console.warn( 'GLTFExporter: TriangleFanDrawMode and wireframe incompatible.' );
					mode = WEBGL_CONSTANTS.TRIANGLE_FAN;

				} else if ( mesh.drawMode === THREE.TriangleStripDrawMode ) {

					mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINE_STRIP : WEBGL_CONSTANTS.TRIANGLE_STRIP;

				} else {

					mode = mesh.material.wireframe ? WEBGL_CONSTANTS.LINES : WEBGL_CONSTANTS.TRIANGLES;

				}

			}

			var gltfMesh = {};

			var attributes = {};
			var primitives = [];
			var targets = [];

			// Conversion between attributes names in threejs and gltf spec
			var nameConversion = {

				uv: 'TEXCOORD_0',
				uv2: 'TEXCOORD_1',
				color: 'COLOR_0',
				skinWeight: 'WEIGHTS_0',
				skinIndex: 'JOINTS_0'

			};

			var originalNormal = geometry.getAttribute( 'normal' );

			if ( originalNormal !== undefined && ! isNormalizedNormalAttribute( originalNormal ) ) {

				console.warn( 'THREE.GLTFExporter: Creating normalized normal attribute from the non-normalized one.' );

				geometry.setAttribute( 'normal', createNormalizedNormalAttribute( originalNormal ) );

			}

			// @QUESTION Detect if .vertexColors = THREE.VertexColors?
			// For every attribute create an accessor
			var modifiedAttribute = null;
			for ( var attributeName in geometry.attributes ) {

				// Ignore morph target attributes, which are exported later.
				if ( attributeName.substr( 0, 5 ) === 'morph' ) continue;

				var attribute = geometry.attributes[ attributeName ];
				attributeName = nameConversion[ attributeName ] || attributeName.toUpperCase();

				// Prefix all geometry attributes except the ones specifically
				// listed in the spec; non-spec attributes are considered custom.
				var validVertexAttributes =
						/^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+|COLOR_\d+|JOINTS_\d+|WEIGHTS_\d+)$/;
				if ( ! validVertexAttributes.test( attributeName ) ) {

					attributeName = '_' + attributeName;

				}

				if ( cachedData.attributes.has( getUID( attribute ) ) ) {

					attributes[ attributeName ] = cachedData.attributes.get( getUID( attribute ) );
					continue;

				}

				// JOINTS_0 must be UNSIGNED_BYTE or UNSIGNED_SHORT.
				modifiedAttribute = null;
				var array = attribute.array;
				if ( attributeName === 'JOINTS_0' &&
					! ( array instanceof Uint16Array ) &&
					! ( array instanceof Uint8Array ) ) {

					console.warn( 'GLTFExporter: Attribute "skinIndex" converted to type UNSIGNED_SHORT.' );
					modifiedAttribute = new THREE.BufferAttribute( new Uint16Array( array ), attribute.itemSize, attribute.normalized );

				}

				var accessor = processAccessor( modifiedAttribute || attribute, geometry );
				if ( accessor !== null ) {

					attributes[ attributeName ] = accessor;
					cachedData.attributes.set( getUID( attribute ), accessor );

				}

			}

			if ( originalNormal !== undefined ) geometry.setAttribute( 'normal', originalNormal );

			// Skip if no exportable attributes found
			if ( Object.keys( attributes ).length === 0 ) {

				return null;

			}

			// Morph targets
			if ( mesh.morphTargetInfluences !== undefined && mesh.morphTargetInfluences.length > 0 ) {

				var weights = [];
				var targetNames = [];
				var reverseDictionary = {};

				if ( mesh.morphTargetDictionary !== undefined ) {

					for ( var key in mesh.morphTargetDictionary ) {

						reverseDictionary[ mesh.morphTargetDictionary[ key ] ] = key;

					}

				}

				for ( var i = 0; i < mesh.morphTargetInfluences.length; ++ i ) {

					var target = {};

					var warned = false;

					for ( var attributeName in geometry.morphAttributes ) {

						// glTF 2.0 morph supports only POSITION/NORMAL/TANGENT.
						// Three.js doesn't support TANGENT yet.

						if ( attributeName !== 'position' && attributeName !== 'normal' ) {

							if ( ! warned ) {

								console.warn( 'GLTFExporter: Only POSITION and NORMAL morph are supported.' );
								warned = true;

							}

							continue;

						}

						var attribute = geometry.morphAttributes[ attributeName ][ i ];
						var gltfAttributeName = attributeName.toUpperCase();

						// Three.js morph attribute has absolute values while the one of glTF has relative values.
						//
						// glTF 2.0 Specification:
						// https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#morph-targets

						var baseAttribute = geometry.attributes[ attributeName ];

						if ( cachedData.attributes.has( getUID( attribute ) ) ) {

							target[ gltfAttributeName ] = cachedData.attributes.get( getUID( attribute ) );
							continue;

						}

						// Clones attribute not to override
						var relativeAttribute = attribute.clone();

						for ( var j = 0, jl = attribute.count; j < jl; j ++ ) {

							relativeAttribute.setXYZ(
								j,
								attribute.getX( j ) - baseAttribute.getX( j ),
								attribute.getY( j ) - baseAttribute.getY( j ),
								attribute.getZ( j ) - baseAttribute.getZ( j )
							);

						}

						target[ gltfAttributeName ] = processAccessor( relativeAttribute, geometry );
						cachedData.attributes.set( getUID( baseAttribute ), target[ gltfAttributeName ] );

					}

					targets.push( target );

					weights.push( mesh.morphTargetInfluences[ i ] );
					if ( mesh.morphTargetDictionary !== undefined ) targetNames.push( reverseDictionary[ i ] );

				}

				gltfMesh.weights = weights;

				if ( targetNames.length > 0 ) {

					gltfMesh.extras = {};
					gltfMesh.extras.targetNames = targetNames;

				}

			}

			var forceIndices = options.forceIndices;
			var isMultiMaterial = Array.isArray( mesh.material );

			if ( isMultiMaterial && geometry.groups.length === 0 ) return null;

			if ( ! forceIndices && geometry.index === null && isMultiMaterial ) {

				// temporal workaround.
				console.warn( 'THREE.GLTFExporter: Creating index for non-indexed multi-material mesh.' );
				forceIndices = true;

			}

			var didForceIndices = false;

			if ( geometry.index === null && forceIndices ) {

				var indices = [];

				for ( var i = 0, il = geometry.attributes.position.count; i < il; i ++ ) {

					indices[ i ] = i;

				}

				geometry.setIndex( indices );

				didForceIndices = true;

			}

			var materials = isMultiMaterial ? mesh.material : [ mesh.material ];
			var groups = isMultiMaterial ? geometry.groups : [ { materialIndex: 0, start: undefined, count: undefined } ];

			for ( var i = 0, il = groups.length; i < il; i ++ ) {

				var primitive = {
					mode: mode,
					attributes: attributes,
				};

				serializeUserData( geometry, primitive );

				if ( targets.length > 0 ) primitive.targets = targets;

				if ( geometry.index !== null ) {

					var cacheKey = getUID( geometry.index );

					if ( groups[ i ].start !== undefined || groups[ i ].count !== undefined ) {

						cacheKey += ':' + groups[ i ].start + ':' + groups[ i ].count;

					}

					if ( cachedData.attributes.has( cacheKey ) ) {

						primitive.indices = cachedData.attributes.get( cacheKey );

					} else {

						primitive.indices = processAccessor( geometry.index, geometry, groups[ i ].start, groups[ i ].count );
						cachedData.attributes.set( cacheKey, primitive.indices );

					}

					if ( primitive.indices === null ) delete primitive.indices;

				}

				var material = processMaterial( materials[ groups[ i ].materialIndex ] );

				if ( material !== null ) {

					primitive.material = material;

				}

				primitives.push( primitive );

			}

			if ( didForceIndices ) {

				geometry.setIndex( null );

			}

			gltfMesh.primitives = primitives;

			if ( ! outputJSON.meshes ) {

				outputJSON.meshes = [];

			}

			outputJSON.meshes.push( gltfMesh );

			var index = outputJSON.meshes.length - 1;
			cachedData.meshes.set( cacheKey, index );

			return index;

		}

		/**
		 * Process camera
		 * @param  {THREE.Camera} camera Camera to process
		 * @return {Integer}      Index of the processed mesh in the "camera" array
		 */
		function processCamera( camera ) {

			if ( ! outputJSON.cameras ) {

				outputJSON.cameras = [];

			}

			var isOrtho = camera.isOrthographicCamera;

			var gltfCamera = {

				type: isOrtho ? 'orthographic' : 'perspective'

			};

			if ( isOrtho ) {

				gltfCamera.orthographic = {

					xmag: camera.right * 2,
					ymag: camera.top * 2,
					zfar: camera.far <= 0 ? 0.001 : camera.far,
					znear: camera.near < 0 ? 0 : camera.near

				};

			} else {

				gltfCamera.perspective = {

					aspectRatio: camera.aspect,
					yfov: THREE.Math.degToRad( camera.fov ),
					zfar: camera.far <= 0 ? 0.001 : camera.far,
					znear: camera.near < 0 ? 0 : camera.near

				};

			}

			if ( camera.name !== '' ) {

				gltfCamera.name = camera.type;

			}

			outputJSON.cameras.push( gltfCamera );

			return outputJSON.cameras.length - 1;

		}

		/**
		 * Creates glTF animation entry from AnimationClip object.
		 *
		 * Status:
		 * - Only properties listed in PATH_PROPERTIES may be animated.
		 *
		 * @param {THREE.AnimationClip} clip
		 * @param {THREE.Object3D} root
		 * @return {number}
		 */
		function processAnimation( clip, root ) {

			if ( ! outputJSON.animations ) {

				outputJSON.animations = [];

			}

			clip = THREE.GLTFExporter.Utils.mergeMorphTargetTracks( clip.clone(), root );

			var tracks = clip.tracks;
			var channels = [];
			var samplers = [];

			for ( var i = 0; i < tracks.length; ++ i ) {

				var track = tracks[ i ];
				var trackBinding = THREE.PropertyBinding.parseTrackName( track.name );
				var trackNode = THREE.PropertyBinding.findNode( root, trackBinding.nodeName );
				var trackProperty = PATH_PROPERTIES[ trackBinding.propertyName ];

				if ( trackBinding.objectName === 'bones' ) {

					if ( trackNode.isSkinnedMesh === true ) {

						trackNode = trackNode.skeleton.getBoneByName( trackBinding.objectIndex );

					} else {

						trackNode = undefined;

					}

				}

				if ( ! trackNode || ! trackProperty ) {

					console.warn( 'THREE.GLTFExporter: Could not export animation track "%s".', track.name );
					return null;

				}

				var inputItemSize = 1;
				var outputItemSize = track.values.length / track.times.length;

				if ( trackProperty === PATH_PROPERTIES.morphTargetInfluences ) {

					outputItemSize /= trackNode.morphTargetInfluences.length;

				}

				var interpolation;

				// @TODO export CubicInterpolant(InterpolateSmooth) as CUBICSPLINE

				// Detecting glTF cubic spline interpolant by checking factory method's special property
				// GLTFCubicSplineInterpolant is a custom interpolant and track doesn't return
				// valid value from .getInterpolation().
				if ( track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline === true ) {

					interpolation = 'CUBICSPLINE';

					// itemSize of CUBICSPLINE keyframe is 9
					// (VEC3 * 3: inTangent, splineVertex, and outTangent)
					// but needs to be stored as VEC3 so dividing by 3 here.
					outputItemSize /= 3;

				} else if ( track.getInterpolation() === THREE.InterpolateDiscrete ) {

					interpolation = 'STEP';

				} else {

					interpolation = 'LINEAR';

				}

				samplers.push( {

					input: processAccessor( new THREE.BufferAttribute( track.times, inputItemSize ) ),
					output: processAccessor( new THREE.BufferAttribute( track.values, outputItemSize ) ),
					interpolation: interpolation

				} );

				channels.push( {

					sampler: samplers.length - 1,
					target: {
						node: nodeMap.get( trackNode ),
						path: trackProperty
					}

				} );

			}

			outputJSON.animations.push( {

				name: clip.name || 'clip_' + outputJSON.animations.length,
				samplers: samplers,
				channels: channels

			} );

			return outputJSON.animations.length - 1;

		}

		function processSkin( object ) {

			var node = outputJSON.nodes[ nodeMap.get( object ) ];

			var skeleton = object.skeleton;
			var rootJoint = object.skeleton.bones[ 0 ];

			if ( rootJoint === undefined ) return null;

			var joints = [];
			var inverseBindMatrices = new Float32Array( skeleton.bones.length * 16 );

			for ( var i = 0; i < skeleton.bones.length; ++ i ) {

				joints.push( nodeMap.get( skeleton.bones[ i ] ) );

				skeleton.boneInverses[ i ].toArray( inverseBindMatrices, i * 16 );

			}

			if ( outputJSON.skins === undefined ) {

				outputJSON.skins = [];

			}

			outputJSON.skins.push( {

				inverseBindMatrices: processAccessor( new THREE.BufferAttribute( inverseBindMatrices, 16 ) ),
				joints: joints,
				skeleton: nodeMap.get( rootJoint )

			} );

			var skinIndex = node.skin = outputJSON.skins.length - 1;

			return skinIndex;

		}

		function processLight( light ) {

			var lightDef = {};

			if ( light.name ) lightDef.name = light.name;

			lightDef.color = light.color.toArray();

			lightDef.intensity = light.intensity;

			if ( light.isDirectionalLight ) {

				lightDef.type = 'directional';

			} else if ( light.isPointLight ) {

				lightDef.type = 'point';
				if ( light.distance > 0 ) lightDef.range = light.distance;

			} else if ( light.isSpotLight ) {

				lightDef.type = 'spot';
				if ( light.distance > 0 ) lightDef.range = light.distance;
				lightDef.spot = {};
				lightDef.spot.innerConeAngle = ( light.penumbra - 1.0 ) * light.angle * - 1.0;
				lightDef.spot.outerConeAngle = light.angle;

			}

			if ( light.decay !== undefined && light.decay !== 2 ) {

				console.warn( 'THREE.GLTFExporter: Light decay may be lost. glTF is physically-based, '
					+ 'and expects light.decay=2.' );

			}

			if ( light.target
					&& ( light.target.parent !== light
					 || light.target.position.x !== 0
					 || light.target.position.y !== 0
					 || light.target.position.z !== - 1 ) ) {

				console.warn( 'THREE.GLTFExporter: Light direction may be lost. For best results, '
					+ 'make light.target a child of the light with position 0,0,-1.' );

			}

			var lights = outputJSON.extensions[ 'KHR_lights_punctual' ].lights;
			lights.push( lightDef );
			return lights.length - 1;

		}

		/**
		 * Process Object3D node
		 * @param  {THREE.Object3D} node Object3D to processNode
		 * @return {Integer}      Index of the node in the nodes list
		 */
		function processNode( object ) {

			if ( ! outputJSON.nodes ) {

				outputJSON.nodes = [];

			}

			var gltfNode = {};

			if ( options.trs ) {

				var rotation = object.quaternion.toArray();
				var position = object.position.toArray();
				var scale = object.scale.toArray();

				if ( ! equalArray( rotation, [ 0, 0, 0, 1 ] ) ) {

					gltfNode.rotation = rotation;

				}

				if ( ! equalArray( position, [ 0, 0, 0 ] ) ) {

					gltfNode.translation = position;

				}

				if ( ! equalArray( scale, [ 1, 1, 1 ] ) ) {

					gltfNode.scale = scale;

				}

			} else {

				if ( object.matrixAutoUpdate ) {

					object.updateMatrix();

				}

				if ( ! equalArray( object.matrix.elements, [ 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 ] ) ) {

					gltfNode.matrix = object.matrix.elements;

				}

			}

			// We don't export empty strings name because it represents no-name in Three.js.
			if ( object.name !== '' ) {

				gltfNode.name = String( object.name );

			}

			serializeUserData( object, gltfNode );

			if ( object.isMesh || object.isLine || object.isPoints ) {

				var mesh = processMesh( object );

				if ( mesh !== null ) {

					gltfNode.mesh = mesh;

				}

			} else if ( object.isCamera ) {

				gltfNode.camera = processCamera( object );

			} else if ( object.isDirectionalLight || object.isPointLight || object.isSpotLight ) {

				if ( ! extensionsUsed[ 'KHR_lights_punctual' ] ) {

					outputJSON.extensions = outputJSON.extensions || {};
					outputJSON.extensions[ 'KHR_lights_punctual' ] = { lights: [] };
					extensionsUsed[ 'KHR_lights_punctual' ] = true;

				}

				gltfNode.extensions = gltfNode.extensions || {};
				gltfNode.extensions[ 'KHR_lights_punctual' ] = { light: processLight( object ) };

			} else if ( object.isLight ) {

				console.warn( 'THREE.GLTFExporter: Only directional, point, and spot lights are supported.', object );
				return null;

			}

			if ( object.isSkinnedMesh ) {

				skins.push( object );

			}

			if ( object.children.length > 0 ) {

				var children = [];

				for ( var i = 0, l = object.children.length; i < l; i ++ ) {

					var child = object.children[ i ];

					if ( child.visible || options.onlyVisible === false ) {

						var node = processNode( child );

						if ( node !== null ) {

							children.push( node );

						}

					}

				}

				if ( children.length > 0 ) {

					gltfNode.children = children;

				}


			}

			outputJSON.nodes.push( gltfNode );

			var nodeIndex = outputJSON.nodes.length - 1;
			nodeMap.set( object, nodeIndex );

			return nodeIndex;

		}

		/**
		 * Process Scene
		 * @param  {THREE.Scene} node Scene to process
		 */
		function processScene( scene ) {

			if ( ! outputJSON.scenes ) {

				outputJSON.scenes = [];
				outputJSON.scene = 0;

			}

			var gltfScene = {

				nodes: []

			};

			if ( scene.name !== '' ) {

				gltfScene.name = scene.name;

			}

			if ( scene.userData && Object.keys( scene.userData ).length > 0 ) {

				gltfScene.extras = serializeUserData( scene );

			}

			outputJSON.scenes.push( gltfScene );

			var nodes = [];

			for ( var i = 0, l = scene.children.length; i < l; i ++ ) {

				var child = scene.children[ i ];

				if ( child.visible || options.onlyVisible === false ) {

					var node = processNode( child );

					if ( node !== null ) {

						nodes.push( node );

					}

				}

			}

			if ( nodes.length > 0 ) {

				gltfScene.nodes = nodes;

			}

			serializeUserData( scene, gltfScene );

		}

		/**
		 * Creates a THREE.Scene to hold a list of objects and parse it
		 * @param  {Array} objects List of objects to process
		 */
		function processObjects( objects ) {

			var scene = new THREE.Scene();
			scene.name = 'AuxScene';

			for ( var i = 0; i < objects.length; i ++ ) {

				// We push directly to children instead of calling `add` to prevent
				// modify the .parent and break its original scene and hierarchy
				scene.children.push( objects[ i ] );

			}

			processScene( scene );

		}

		function processInput( input ) {

			input = input instanceof Array ? input : [ input ];

			var objectsWithoutScene = [];

			for ( var i = 0; i < input.length; i ++ ) {

				if ( input[ i ] instanceof THREE.Scene ) {

					processScene( input[ i ] );

				} else {

					objectsWithoutScene.push( input[ i ] );

				}

			}

			if ( objectsWithoutScene.length > 0 ) {

				processObjects( objectsWithoutScene );

			}

			for ( var i = 0; i < skins.length; ++ i ) {

				processSkin( skins[ i ] );

			}

			for ( var i = 0; i < options.animations.length; ++ i ) {

				processAnimation( options.animations[ i ], input[ 0 ] );

			}

		}

		processInput( input );

		Promise.all( pending ).then( function () {

			// Merge buffers.
			var blob = new Blob( buffers, { type: 'application/octet-stream' } );

			// Declare extensions.
			var extensionsUsedList = Object.keys( extensionsUsed );
			if ( extensionsUsedList.length > 0 ) outputJSON.extensionsUsed = extensionsUsedList;

			if ( outputJSON.buffers && outputJSON.buffers.length > 0 ) {

				// Update bytelength of the single buffer.
				outputJSON.buffers[ 0 ].byteLength = blob.size;

				var reader = new window.FileReader();

				if ( options.binary === true ) {

					// https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#glb-file-format-specification

					var GLB_HEADER_BYTES = 12;
					var GLB_HEADER_MAGIC = 0x46546C67;
					var GLB_VERSION = 2;

					var GLB_CHUNK_PREFIX_BYTES = 8;
					var GLB_CHUNK_TYPE_JSON = 0x4E4F534A;
					var GLB_CHUNK_TYPE_BIN = 0x004E4942;

					reader.readAsArrayBuffer( blob );
					reader.onloadend = function () {

						// Binary chunk.
						var binaryChunk = getPaddedArrayBuffer( reader.result );
						var binaryChunkPrefix = new DataView( new ArrayBuffer( GLB_CHUNK_PREFIX_BYTES ) );
						binaryChunkPrefix.setUint32( 0, binaryChunk.byteLength, true );
						binaryChunkPrefix.setUint32( 4, GLB_CHUNK_TYPE_BIN, true );

						// JSON chunk.
						var jsonChunk = getPaddedArrayBuffer( stringToArrayBuffer( JSON.stringify( outputJSON ) ), 0x20 );
						var jsonChunkPrefix = new DataView( new ArrayBuffer( GLB_CHUNK_PREFIX_BYTES ) );
						jsonChunkPrefix.setUint32( 0, jsonChunk.byteLength, true );
						jsonChunkPrefix.setUint32( 4, GLB_CHUNK_TYPE_JSON, true );

						// GLB header.
						var header = new ArrayBuffer( GLB_HEADER_BYTES );
						var headerView = new DataView( header );
						headerView.setUint32( 0, GLB_HEADER_MAGIC, true );
						headerView.setUint32( 4, GLB_VERSION, true );
						var totalByteLength = GLB_HEADER_BYTES
							+ jsonChunkPrefix.byteLength + jsonChunk.byteLength
							+ binaryChunkPrefix.byteLength + binaryChunk.byteLength;
						headerView.setUint32( 8, totalByteLength, true );

						var glbBlob = new Blob( [
							header,
							jsonChunkPrefix,
							jsonChunk,
							binaryChunkPrefix,
							binaryChunk
						], { type: 'application/octet-stream' } );

						var glbReader = new window.FileReader();
						glbReader.readAsArrayBuffer( glbBlob );
						glbReader.onloadend = function () {

							onDone( glbReader.result );

						};

					};

				} else {

					reader.readAsDataURL( blob );
					reader.onloadend = function () {

						var base64data = reader.result;
						outputJSON.buffers[ 0 ].uri = base64data;
						onDone( outputJSON );

					};

				}

			} else {

				onDone( outputJSON );

			}

		} );

	}

};

THREE.GLTFExporter.Utils = {

	insertKeyframe: function ( track, time ) {

		var tolerance = 0.001; // 1ms
		var valueSize = track.getValueSize();

		var times = new track.TimeBufferType( track.times.length + 1 );
		var values = new track.ValueBufferType( track.values.length + valueSize );
		var interpolant = track.createInterpolant( new track.ValueBufferType( valueSize ) );

		var index;

		if ( track.times.length === 0 ) {

			times[ 0 ] = time;

			for ( var i = 0; i < valueSize; i ++ ) {

				values[ i ] = 0;

			}

			index = 0;

		} else if ( time < track.times[ 0 ] ) {

			if ( Math.abs( track.times[ 0 ] - time ) < tolerance ) return 0;

			times[ 0 ] = time;
			times.set( track.times, 1 );

			values.set( interpolant.evaluate( time ), 0 );
			values.set( track.values, valueSize );

			index = 0;

		} else if ( time > track.times[ track.times.length - 1 ] ) {

			if ( Math.abs( track.times[ track.times.length - 1 ] - time ) < tolerance ) {

				return track.times.length - 1;

			}

			times[ times.length - 1 ] = time;
			times.set( track.times, 0 );

			values.set( track.values, 0 );
			values.set( interpolant.evaluate( time ), track.values.length );

			index = times.length - 1;

		} else {

			for ( var i = 0; i < track.times.length; i ++ ) {

				if ( Math.abs( track.times[ i ] - time ) < tolerance ) return i;

				if ( track.times[ i ] < time && track.times[ i + 1 ] > time ) {

					times.set( track.times.slice( 0, i + 1 ), 0 );
					times[ i + 1 ] = time;
					times.set( track.times.slice( i + 1 ), i + 2 );

					values.set( track.values.slice( 0, ( i + 1 ) * valueSize ), 0 );
					values.set( interpolant.evaluate( time ), ( i + 1 ) * valueSize );
					values.set( track.values.slice( ( i + 1 ) * valueSize ), ( i + 2 ) * valueSize );

					index = i + 1;

					break;

				}

			}

		}

		track.times = times;
		track.values = values;

		return index;

	},

	mergeMorphTargetTracks: function ( clip, root ) {

		var tracks = [];
		var mergedTracks = {};
		var sourceTracks = clip.tracks;

		for ( var i = 0; i < sourceTracks.length; ++ i ) {

			var sourceTrack = sourceTracks[ i ];
			var sourceTrackBinding = THREE.PropertyBinding.parseTrackName( sourceTrack.name );
			var sourceTrackNode = THREE.PropertyBinding.findNode( root, sourceTrackBinding.nodeName );

			if ( sourceTrackBinding.propertyName !== 'morphTargetInfluences' || sourceTrackBinding.propertyIndex === undefined ) {

				// Tracks that don't affect morph targets, or that affect all morph targets together, can be left as-is.
				tracks.push( sourceTrack );
				continue;

			}

			if ( sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodDiscrete
				&& sourceTrack.createInterpolant !== sourceTrack.InterpolantFactoryMethodLinear ) {

				if ( sourceTrack.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline ) {

					// This should never happen, because glTF morph target animations
					// affect all targets already.
					throw new Error( 'THREE.GLTFExporter: Cannot merge tracks with glTF CUBICSPLINE interpolation.' );

				}

				console.warn( 'THREE.GLTFExporter: Morph target interpolation mode not yet supported. Using LINEAR instead.' );

				sourceTrack = sourceTrack.clone();
				sourceTrack.setInterpolation( THREE.InterpolateLinear );

			}

			var targetCount = sourceTrackNode.morphTargetInfluences.length;
			var targetIndex = sourceTrackNode.morphTargetDictionary[ sourceTrackBinding.propertyIndex ];

			if ( targetIndex === undefined ) {

				throw new Error( 'THREE.GLTFExporter: Morph target name not found: ' + sourceTrackBinding.propertyIndex );

			}

			var mergedTrack;

			// If this is the first time we've seen this object, create a new
			// track to store merged keyframe data for each morph target.
			if ( mergedTracks[ sourceTrackNode.uuid ] === undefined ) {

				mergedTrack = sourceTrack.clone();

				var values = new mergedTrack.ValueBufferType( targetCount * mergedTrack.times.length );

				for ( var j = 0; j < mergedTrack.times.length; j ++ ) {

					values[ j * targetCount + targetIndex ] = mergedTrack.values[ j ];

				}

				mergedTrack.name = '.morphTargetInfluences';
				mergedTrack.values = values;

				mergedTracks[ sourceTrackNode.uuid ] = mergedTrack;
				tracks.push( mergedTrack );

				continue;

			}

			var sourceInterpolant = sourceTrack.createInterpolant( new sourceTrack.ValueBufferType( 1 ) );

			mergedTrack = mergedTracks[ sourceTrackNode.uuid ];

			// For every existing keyframe of the merged track, write a (possibly
			// interpolated) value from the source track.
			for ( var j = 0; j < mergedTrack.times.length; j ++ ) {

				mergedTrack.values[ j * targetCount + targetIndex ] = sourceInterpolant.evaluate( mergedTrack.times[ j ] );

			}

			// For every existing keyframe of the source track, write a (possibly
			// new) keyframe to the merged track. Values from the previous loop may
			// be written again, but keyframes are de-duplicated.
			for ( var j = 0; j < sourceTrack.times.length; j ++ ) {

				var keyframeIndex = this.insertKeyframe( mergedTrack, sourceTrack.times[ j ] );
				mergedTrack.values[ keyframeIndex * targetCount + targetIndex ] = sourceTrack.values[ j ];

			}

		}

		clip.tracks = tracks;

		return clip;

	}

};

( function () {

	/**
 * THREE.Loader for Basis Universal GPU Texture Codec.
 *
 * Basis Universal is a "supercompressed" GPU texture and texture video
 * compression system that outputs a highly compressed intermediate file format
 * (.basis) that can be quickly transcoded to a wide variety of GPU texture
 * compression formats.
 *
 * This loader parallelizes the transcoding process across a configurable number
 * of web workers, before transferring the transcoded compressed texture back
 * to the main thread.
 */

	const _taskCache = new WeakMap();

	class BasisTextureLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );
			this.transcoderPath = '';
			this.transcoderBinary = null;
			this.transcoderPending = null;
			this.workerLimit = 4;
			this.workerPool = [];
			this.workerNextTaskID = 1;
			this.workerSourceURL = '';
			this.workerConfig = null;

		}

		setTranscoderPath( path ) {

			this.transcoderPath = path;
			return this;

		}

		setWorkerLimit( workerLimit ) {

			this.workerLimit = workerLimit;
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
			return this;

		}

		load( url, onLoad, onProgress, onError ) {

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
		/** Low-level transcoding API, exposed for use by KTX2Loader. */


		parseInternalAsync( options ) {

			const {
				levels
			} = options;
			const buffers = new Set();

			for ( let i = 0; i < levels.length; i ++ ) {

				buffers.add( levels[ i ].data.buffer );

			}

			return this._createTexture( Array.from( buffers ), { ...options,
				lowLevel: true
			} );

		}
		/**
   * @param {ArrayBuffer[]} buffers
   * @param {object?} config
   * @return {Promise<CompressedTexture>}
   */


		_createTexture( buffers, config = {} ) {

			let worker;
			let taskID;
			const taskConfig = config;
			let taskCost = 0;

			for ( let i = 0; i < buffers.length; i ++ ) {

				taskCost += buffers[ i ].byteLength;

			}

			const texturePending = this._allocateWorker( taskCost ).then( _worker => {

				worker = _worker;
				taskID = this.workerNextTaskID ++;
				return new Promise( ( resolve, reject ) => {

					worker._callbacks[ taskID ] = {
						resolve,
						reject
					};
					worker.postMessage( {
						type: 'transcode',
						id: taskID,
						buffers: buffers,
						taskConfig: taskConfig
					}, buffers );

				} );

			} ).then( message => {

				const {
					mipmaps,
					width,
					height,
					format
				} = message;
				const texture = new THREE.CompressedTexture( mipmaps, width, height, format, THREE.UnsignedByteType );
				texture.minFilter = mipmaps.length === 1 ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
				texture.magFilter = THREE.LinearFilter;
				texture.generateMipmaps = false;
				texture.needsUpdate = true;
				return texture;

			} ); // Note: replaced '.finally()' with '.catch().then()' block - iOS 11 support (#19416)


			texturePending.catch( () => true ).then( () => {

				if ( worker && taskID ) {

					worker._taskLoad -= taskCost;
					delete worker._callbacks[ taskID ];

				}

			} ); // Cache the task result.

			_taskCache.set( buffers[ 0 ], {
				promise: texturePending
			} );

			return texturePending;

		}

		_initTranscoder() {

			if ( ! this.transcoderPending ) {

				// Load transcoder wrapper.
				const jsLoader = new THREE.FileLoader( this.manager );
				jsLoader.setPath( this.transcoderPath );
				jsLoader.setWithCredentials( this.withCredentials );
				const jsContent = new Promise( ( resolve, reject ) => {

					jsLoader.load( 'basis_transcoder.js', resolve, undefined, reject );

				} ); // Load transcoder WASM binary.

				const binaryLoader = new THREE.FileLoader( this.manager );
				binaryLoader.setPath( this.transcoderPath );
				binaryLoader.setResponseType( 'arraybuffer' );
				binaryLoader.setWithCredentials( this.withCredentials );
				const binaryContent = new Promise( ( resolve, reject ) => {

					binaryLoader.load( 'basis_transcoder.wasm', resolve, undefined, reject );

				} );
				this.transcoderPending = Promise.all( [ jsContent, binaryContent ] ).then( ( [ jsContent, binaryContent ] ) => {

					const fn = BasisTextureLoader.BasisWorker.toString();
					const body = [ '/* constants */', 'let _EngineFormat = ' + JSON.stringify( BasisTextureLoader.EngineFormat ), 'let _TranscoderFormat = ' + JSON.stringify( BasisTextureLoader.TranscoderFormat ), 'let _BasisFormat = ' + JSON.stringify( BasisTextureLoader.BasisFormat ), '/* basis_transcoder.js */', jsContent, '/* worker */', fn.substring( fn.indexOf( '{' ) + 1, fn.lastIndexOf( '}' ) ) ].join( '\n' );
					this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );
					this.transcoderBinary = binaryContent;

				} );

			}

			return this.transcoderPending;

		}

		_allocateWorker( taskCost ) {

			return this._initTranscoder().then( () => {

				if ( this.workerPool.length < this.workerLimit ) {

					const worker = new Worker( this.workerSourceURL );
					worker._callbacks = {};
					worker._taskLoad = 0;
					worker.postMessage( {
						type: 'init',
						config: this.workerConfig,
						transcoderBinary: this.transcoderBinary
					} );

					worker.onmessage = function ( e ) {

						const message = e.data;

						switch ( message.type ) {

							case 'transcode':
								worker._callbacks[ message.id ].resolve( message );

								break;

							case 'error':
								worker._callbacks[ message.id ].reject( message );

								break;

							default:
								console.error( 'THREE.BasisTextureLoader: Unexpected message, "' + message.type + '"' );

						}

					};

					this.workerPool.push( worker );

				} else {

					this.workerPool.sort( function ( a, b ) {

						return a._taskLoad > b._taskLoad ? - 1 : 1;

					} );

				}

				const worker = this.workerPool[ this.workerPool.length - 1 ];
				worker._taskLoad += taskCost;
				return worker;

			} );

		}

		dispose() {

			for ( let i = 0; i < this.workerPool.length; i ++ ) {

				this.workerPool[ i ].terminate();

			}

			this.workerPool.length = 0;
			return this;

		}

	}
	/* CONSTANTS */


	BasisTextureLoader.BasisFormat = {
		ETC1S: 0,
		UASTC_4x4: 1
	};
	BasisTextureLoader.TranscoderFormat = {
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
	BasisTextureLoader.EngineFormat = {
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

	BasisTextureLoader.BasisWorker = function () {

		let config;
		let transcoderPending;
		let BasisModule;
		const EngineFormat = _EngineFormat; // eslint-disable-line no-undef

		const TranscoderFormat = _TranscoderFormat; // eslint-disable-line no-undef

		const BasisFormat = _BasisFormat; // eslint-disable-line no-undef

		onmessage = function ( e ) {

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
								format
							} = message.taskConfig.lowLevel ? transcodeLowLevel( message.taskConfig ) : transcode( message.buffers[ 0 ] );
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
								format
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

		};

		function init( wasmBinary ) {

			transcoderPending = new Promise( resolve => {

				BasisModule = {
					wasmBinary,
					onRuntimeInitialized: resolve
				};
				BASIS( BasisModule ); // eslint-disable-line no-undef

			} ).then( () => {

				BasisModule.initializeBasis();

			} );

		}

		function transcodeLowLevel( taskConfig ) {

			const {
				basisFormat,
				width,
				height,
				hasAlpha
			} = taskConfig;
			const {
				transcoderFormat,
				engineFormat
			} = getTranscoderFormat( basisFormat, width, height, hasAlpha );
			const blockByteLength = BasisModule.getBytesPerBlockOrPixel( transcoderFormat );
			assert( BasisModule.isFormatSupported( transcoderFormat ), 'THREE.BasisTextureLoader: Unsupported format.' );
			const mipmaps = [];

			if ( basisFormat === BasisFormat.ETC1S ) {

				const transcoder = new BasisModule.LowLevelETC1SImageTranscoder();
				const {
					endpointCount,
					endpointsData,
					selectorCount,
					selectorsData,
					tablesData
				} = taskConfig.globalData;

				try {

					let ok;
					ok = transcoder.decodePalettes( endpointCount, endpointsData, selectorCount, selectorsData );
					assert( ok, 'THREE.BasisTextureLoader: decodePalettes() failed.' );
					ok = transcoder.decodeTables( tablesData );
					assert( ok, 'THREE.BasisTextureLoader: decodeTables() failed.' );

					for ( let i = 0; i < taskConfig.levels.length; i ++ ) {

						const level = taskConfig.levels[ i ];
						const imageDesc = taskConfig.globalData.imageDescs[ i ];
						const dstByteLength = getTranscodedImageByteLength( transcoderFormat, level.width, level.height );
						const dst = new Uint8Array( dstByteLength );
						ok = transcoder.transcodeImage( transcoderFormat, dst, dstByteLength / blockByteLength, level.data, getWidthInBlocks( transcoderFormat, level.width ), getHeightInBlocks( transcoderFormat, level.height ), level.width, level.height, level.index, imageDesc.rgbSliceByteOffset, imageDesc.rgbSliceByteLength, imageDesc.alphaSliceByteOffset, imageDesc.alphaSliceByteLength, imageDesc.imageFlags, hasAlpha, false, 0, 0 );
						assert( ok, 'THREE.BasisTextureLoader: transcodeImage() failed for level ' + level.index + '.' );
						mipmaps.push( {
							data: dst,
							width: level.width,
							height: level.height
						} );

					}

				} finally {

					transcoder.delete();

				}

			} else {

				for ( let i = 0; i < taskConfig.levels.length; i ++ ) {

					const level = taskConfig.levels[ i ];
					const dstByteLength = getTranscodedImageByteLength( transcoderFormat, level.width, level.height );
					const dst = new Uint8Array( dstByteLength );
					const ok = BasisModule.transcodeUASTCImage( transcoderFormat, dst, dstByteLength / blockByteLength, level.data, getWidthInBlocks( transcoderFormat, level.width ), getHeightInBlocks( transcoderFormat, level.height ), level.width, level.height, level.index, 0, level.data.byteLength, 0, hasAlpha, false, 0, 0, - 1, - 1 );
					assert( ok, 'THREE.BasisTextureLoader: transcodeUASTCImage() failed for level ' + level.index + '.' );
					mipmaps.push( {
						data: dst,
						width: level.width,
						height: level.height
					} );

				}

			}

			return {
				width,
				height,
				hasAlpha,
				mipmaps,
				format: engineFormat
			};

		}

		function transcode( buffer ) {

			const basisFile = new BasisModule.BasisFile( new Uint8Array( buffer ) );
			const basisFormat = basisFile.isUASTC() ? BasisFormat.UASTC_4x4 : BasisFormat.ETC1S;
			const width = basisFile.getImageWidth( 0, 0 );
			const height = basisFile.getImageHeight( 0, 0 );
			const levels = basisFile.getNumLevels( 0 );
			const hasAlpha = basisFile.getHasAlpha();

			function cleanup() {

				basisFile.close();
				basisFile.delete();

			}

			const {
				transcoderFormat,
				engineFormat
			} = getTranscoderFormat( basisFormat, width, height, hasAlpha );

			if ( ! width || ! height || ! levels ) {

				cleanup();
				throw new Error( 'THREE.BasisTextureLoader:	Invalid texture' );

			}

			if ( ! basisFile.startTranscoding() ) {

				cleanup();
				throw new Error( 'THREE.BasisTextureLoader: .startTranscoding failed' );

			}

			const mipmaps = [];

			for ( let mip = 0; mip < levels; mip ++ ) {

				const mipWidth = basisFile.getImageWidth( 0, mip );
				const mipHeight = basisFile.getImageHeight( 0, mip );
				const dst = new Uint8Array( basisFile.getImageTranscodedSizeInBytes( 0, mip, transcoderFormat ) );
				const status = basisFile.transcodeImage( dst, 0, mip, transcoderFormat, 0, hasAlpha );

				if ( ! status ) {

					cleanup();
					throw new Error( 'THREE.BasisTextureLoader: .transcodeImage failed.' );

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
				format: engineFormat
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
			transcoderFormat: [ TranscoderFormat.ETC1, TranscoderFormat.ETC1 ],
			engineFormat: [ EngineFormat.RGB_ETC1_Format, EngineFormat.RGB_ETC1_Format ],
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
				if ( opt.needsPowerOfTwo && ! ( isPowerOfTwo( width ) && isPowerOfTwo( height ) ) ) continue;
				transcoderFormat = opt.transcoderFormat[ hasAlpha ? 1 : 0 ];
				engineFormat = opt.engineFormat[ hasAlpha ? 1 : 0 ];
				return {
					transcoderFormat,
					engineFormat
				};

			}

			console.warn( 'THREE.BasisTextureLoader: No suitable compressed texture format found. Decoding to RGBA32.' );
			transcoderFormat = TranscoderFormat.RGBA32;
			engineFormat = EngineFormat.RGBAFormat;
			return {
				transcoderFormat,
				engineFormat
			};

		}

		function assert( ok, message ) {

			if ( ! ok ) throw new Error( message );

		}

		function getWidthInBlocks( transcoderFormat, width ) {

			return Math.ceil( width / BasisModule.getFormatBlockWidth( transcoderFormat ) );

		}

		function getHeightInBlocks( transcoderFormat, height ) {

			return Math.ceil( height / BasisModule.getFormatBlockHeight( transcoderFormat ) );

		}

		function getTranscodedImageByteLength( transcoderFormat, width, height ) {

			const blockByteLength = BasisModule.getBytesPerBlockOrPixel( transcoderFormat );

			if ( BasisModule.formatIsUncompressed( transcoderFormat ) ) {

				return width * height * blockByteLength;

			}

			if ( transcoderFormat === TranscoderFormat.PVRTC1_4_RGB || transcoderFormat === TranscoderFormat.PVRTC1_4_RGBA ) {

				// GL requires extra padding for very small textures:
				// https://www.khronos.org/registry/OpenGL/extensions/IMG/IMG_texture_compression_pvrtc.txt
				const paddedWidth = width + 3 & ~ 3;
				const paddedHeight = height + 3 & ~ 3;
				return ( Math.max( 8, paddedWidth ) * Math.max( 8, paddedHeight ) * 4 + 7 ) / 8;

			}

			return getWidthInBlocks( transcoderFormat, width ) * getHeightInBlocks( transcoderFormat, height ) * blockByteLength;

		}

		function isPowerOfTwo( value ) {

			if ( value <= 2 ) return true;
			return ( value & value - 1 ) === 0 && value !== 0;

		}

	};

	THREE.BasisTextureLoader = BasisTextureLoader;

} )();
// Ported from Stefan Gustavson's java implementation
// http://staffwww.itn.liu.se/~stegu/simplexnoise/simplexnoise.pdf
// Read Stefan's excellent paper for details on how this code works.
//
// Sean McCullough banksean@gmail.com
//
// Added 4D noise
// Joshua Koo zz85nus@gmail.com

/**
 * You can pass in a random number generator object if you like.
 * It is assumed to have a random() method.
 */
THREE.SimplexNoise = function ( r ) {

	if ( r == undefined ) r = Math;
	this.grad3 = [[ 1, 1, 0 ], [ - 1, 1, 0 ], [ 1, - 1, 0 ], [ - 1, - 1, 0 ],
		[ 1, 0, 1 ], [ - 1, 0, 1 ], [ 1, 0, - 1 ], [ - 1, 0, - 1 ],
		[ 0, 1, 1 ], [ 0, - 1, 1 ], [ 0, 1, - 1 ], [ 0, - 1, - 1 ]];

	this.grad4 = [[ 0, 1, 1, 1 ], [ 0, 1, 1, - 1 ], [ 0, 1, - 1, 1 ], [ 0, 1, - 1, - 1 ],
	     [ 0, - 1, 1, 1 ], [ 0, - 1, 1, - 1 ], [ 0, - 1, - 1, 1 ], [ 0, - 1, - 1, - 1 ],
	     [ 1, 0, 1, 1 ], [ 1, 0, 1, - 1 ], [ 1, 0, - 1, 1 ], [ 1, 0, - 1, - 1 ],
	     [ - 1, 0, 1, 1 ], [ - 1, 0, 1, - 1 ], [ - 1, 0, - 1, 1 ], [ - 1, 0, - 1, - 1 ],
	     [ 1, 1, 0, 1 ], [ 1, 1, 0, - 1 ], [ 1, - 1, 0, 1 ], [ 1, - 1, 0, - 1 ],
	     [ - 1, 1, 0, 1 ], [ - 1, 1, 0, - 1 ], [ - 1, - 1, 0, 1 ], [ - 1, - 1, 0, - 1 ],
	     [ 1, 1, 1, 0 ], [ 1, 1, - 1, 0 ], [ 1, - 1, 1, 0 ], [ 1, - 1, - 1, 0 ],
	     [ - 1, 1, 1, 0 ], [ - 1, 1, - 1, 0 ], [ - 1, - 1, 1, 0 ], [ - 1, - 1, - 1, 0 ]];

	this.p = [];

	for ( var i = 0; i < 256; i ++ ) {

		this.p[ i ] = Math.floor( r.random() * 256 );

	}

	// To remove the need for index wrapping, double the permutation table length
	this.perm = [];

	for ( var i = 0; i < 512; i ++ ) {

		this.perm[ i ] = this.p[ i & 255 ];

	}

	// A lookup table to traverse the simplex around a given point in 4D.
	// Details can be found where this table is used, in the 4D noise method.
	this.simplex = [
		[ 0, 1, 2, 3 ], [ 0, 1, 3, 2 ], [ 0, 0, 0, 0 ], [ 0, 2, 3, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 1, 2, 3, 0 ],
		[ 0, 2, 1, 3 ], [ 0, 0, 0, 0 ], [ 0, 3, 1, 2 ], [ 0, 3, 2, 1 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 1, 3, 2, 0 ],
		[ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ],
		[ 1, 2, 0, 3 ], [ 0, 0, 0, 0 ], [ 1, 3, 0, 2 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 2, 3, 0, 1 ], [ 2, 3, 1, 0 ],
		[ 1, 0, 2, 3 ], [ 1, 0, 3, 2 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 2, 0, 3, 1 ], [ 0, 0, 0, 0 ], [ 2, 1, 3, 0 ],
		[ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ],
		[ 2, 0, 1, 3 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 3, 0, 1, 2 ], [ 3, 0, 2, 1 ], [ 0, 0, 0, 0 ], [ 3, 1, 2, 0 ],
		[ 2, 1, 0, 3 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 0, 0, 0, 0 ], [ 3, 1, 0, 2 ], [ 0, 0, 0, 0 ], [ 3, 2, 0, 1 ], [ 3, 2, 1, 0 ]];

};

THREE.SimplexNoise.prototype.dot = function ( g, x, y ) {

	return g[ 0 ] * x + g[ 1 ] * y;

};

THREE.SimplexNoise.prototype.dot3 = function ( g, x, y, z ) {

	return g[ 0 ] * x + g[ 1 ] * y + g[ 2 ] * z;

};

THREE.SimplexNoise.prototype.dot4 = function ( g, x, y, z, w ) {

	return g[ 0 ] * x + g[ 1 ] * y + g[ 2 ] * z + g[ 3 ] * w;

};

THREE.SimplexNoise.prototype.noise = function ( xin, yin ) {

	var n0, n1, n2; // Noise contributions from the three corners
	// Skew the input space to determine which simplex cell we're in
	var F2 = 0.5 * ( Math.sqrt( 3.0 ) - 1.0 );
	var s = ( xin + yin ) * F2; // Hairy factor for 2D
	var i = Math.floor( xin + s );
	var j = Math.floor( yin + s );
	var G2 = ( 3.0 - Math.sqrt( 3.0 ) ) / 6.0;
	var t = ( i + j ) * G2;
	var X0 = i - t; // Unskew the cell origin back to (x,y) space
	var Y0 = j - t;
	var x0 = xin - X0; // The x,y distances from the cell origin
	var y0 = yin - Y0;
	// For the 2D case, the simplex shape is an equilateral triangle.
	// Determine which simplex we are in.
	var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
	if ( x0 > y0 ) {

		i1 = 1; j1 = 0;

		// lower triangle, XY order: (0,0)->(1,0)->(1,1)

	}	else {

		i1 = 0; j1 = 1;

	} // upper triangle, YX order: (0,0)->(0,1)->(1,1)

	// A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
	// a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
	// c = (3-sqrt(3))/6
	var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
	var y1 = y0 - j1 + G2;
	var x2 = x0 - 1.0 + 2.0 * G2; // Offsets for last corner in (x,y) unskewed coords
	var y2 = y0 - 1.0 + 2.0 * G2;
	// Work out the hashed gradient indices of the three simplex corners
	var ii = i & 255;
	var jj = j & 255;
	var gi0 = this.perm[ ii + this.perm[ jj ] ] % 12;
	var gi1 = this.perm[ ii + i1 + this.perm[ jj + j1 ] ] % 12;
	var gi2 = this.perm[ ii + 1 + this.perm[ jj + 1 ] ] % 12;
	// Calculate the contribution from the three corners
	var t0 = 0.5 - x0 * x0 - y0 * y0;
	if ( t0 < 0 ) n0 = 0.0;
	else {

		t0 *= t0;
		n0 = t0 * t0 * this.dot( this.grad3[ gi0 ], x0, y0 ); // (x,y) of grad3 used for 2D gradient

	}

	var t1 = 0.5 - x1 * x1 - y1 * y1;
	if ( t1 < 0 ) n1 = 0.0;
	else {

		t1 *= t1;
		n1 = t1 * t1 * this.dot( this.grad3[ gi1 ], x1, y1 );

	}

	var t2 = 0.5 - x2 * x2 - y2 * y2;
	if ( t2 < 0 ) n2 = 0.0;
	else {

		t2 *= t2;
		n2 = t2 * t2 * this.dot( this.grad3[ gi2 ], x2, y2 );

	}

	// Add contributions from each corner to get the final noise value.
	// The result is scaled to return values in the interval [-1,1].
	return 70.0 * ( n0 + n1 + n2 );

};

// 3D simplex noise
THREE.SimplexNoise.prototype.noise3d = function ( xin, yin, zin ) {

	var n0, n1, n2, n3; // Noise contributions from the four corners
	// Skew the input space to determine which simplex cell we're in
	var F3 = 1.0 / 3.0;
	var s = ( xin + yin + zin ) * F3; // Very nice and simple skew factor for 3D
	var i = Math.floor( xin + s );
	var j = Math.floor( yin + s );
	var k = Math.floor( zin + s );
	var G3 = 1.0 / 6.0; // Very nice and simple unskew factor, too
	var t = ( i + j + k ) * G3;
	var X0 = i - t; // Unskew the cell origin back to (x,y,z) space
	var Y0 = j - t;
	var Z0 = k - t;
	var x0 = xin - X0; // The x,y,z distances from the cell origin
	var y0 = yin - Y0;
	var z0 = zin - Z0;
	// For the 3D case, the simplex shape is a slightly irregular tetrahedron.
	// Determine which simplex we are in.
	var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
	var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
	if ( x0 >= y0 ) {

		if ( y0 >= z0 ) {

			i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;

			// X Y Z order

		} else if ( x0 >= z0 ) {

			i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;

			// X Z Y order

		} else {

			i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;

		} // Z X Y order

	} else { // x0<y0

		if ( y0 < z0 ) {

			i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;

			// Z Y X order

		} else if ( x0 < z0 ) {

			i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;

			// Y Z X order

		} else {

			i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;

		} // Y X Z order

	}

	// A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
	// a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
	// a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
	// c = 1/6.
	var x1 = x0 - i1 + G3; // Offsets for second corner in (x,y,z) coords
	var y1 = y0 - j1 + G3;
	var z1 = z0 - k1 + G3;
	var x2 = x0 - i2 + 2.0 * G3; // Offsets for third corner in (x,y,z) coords
	var y2 = y0 - j2 + 2.0 * G3;
	var z2 = z0 - k2 + 2.0 * G3;
	var x3 = x0 - 1.0 + 3.0 * G3; // Offsets for last corner in (x,y,z) coords
	var y3 = y0 - 1.0 + 3.0 * G3;
	var z3 = z0 - 1.0 + 3.0 * G3;
	// Work out the hashed gradient indices of the four simplex corners
	var ii = i & 255;
	var jj = j & 255;
	var kk = k & 255;
	var gi0 = this.perm[ ii + this.perm[ jj + this.perm[ kk ] ] ] % 12;
	var gi1 = this.perm[ ii + i1 + this.perm[ jj + j1 + this.perm[ kk + k1 ] ] ] % 12;
	var gi2 = this.perm[ ii + i2 + this.perm[ jj + j2 + this.perm[ kk + k2 ] ] ] % 12;
	var gi3 = this.perm[ ii + 1 + this.perm[ jj + 1 + this.perm[ kk + 1 ] ] ] % 12;
	// Calculate the contribution from the four corners
	var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
	if ( t0 < 0 ) n0 = 0.0;
	else {

		t0 *= t0;
		n0 = t0 * t0 * this.dot3( this.grad3[ gi0 ], x0, y0, z0 );

	}

	var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
	if ( t1 < 0 ) n1 = 0.0;
	else {

		t1 *= t1;
		n1 = t1 * t1 * this.dot3( this.grad3[ gi1 ], x1, y1, z1 );

	}

	var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
	if ( t2 < 0 ) n2 = 0.0;
	else {

		t2 *= t2;
		n2 = t2 * t2 * this.dot3( this.grad3[ gi2 ], x2, y2, z2 );

	}

	var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
	if ( t3 < 0 ) n3 = 0.0;
	else {

		t3 *= t3;
		n3 = t3 * t3 * this.dot3( this.grad3[ gi3 ], x3, y3, z3 );

	}

	// Add contributions from each corner to get the final noise value.
	// The result is scaled to stay just inside [-1,1]
	return 32.0 * ( n0 + n1 + n2 + n3 );

};

// 4D simplex noise
THREE.SimplexNoise.prototype.noise4d = function ( x, y, z, w ) {

	// For faster and easier lookups
	var grad4 = this.grad4;
	var simplex = this.simplex;
	var perm = this.perm;

	// The skewing and unskewing factors are hairy again for the 4D case
	var F4 = ( Math.sqrt( 5.0 ) - 1.0 ) / 4.0;
	var G4 = ( 5.0 - Math.sqrt( 5.0 ) ) / 20.0;
	var n0, n1, n2, n3, n4; // Noise contributions from the five corners
	// Skew the (x,y,z,w) space to determine which cell of 24 simplices we're in
	var s = ( x + y + z + w ) * F4; // Factor for 4D skewing
	var i = Math.floor( x + s );
	var j = Math.floor( y + s );
	var k = Math.floor( z + s );
	var l = Math.floor( w + s );
	var t = ( i + j + k + l ) * G4; // Factor for 4D unskewing
	var X0 = i - t; // Unskew the cell origin back to (x,y,z,w) space
	var Y0 = j - t;
	var Z0 = k - t;
	var W0 = l - t;
	var x0 = x - X0; // The x,y,z,w distances from the cell origin
	var y0 = y - Y0;
	var z0 = z - Z0;
	var w0 = w - W0;

	// For the 4D case, the simplex is a 4D shape I won't even try to describe.
	// To find out which of the 24 possible simplices we're in, we need to
	// determine the magnitude ordering of x0, y0, z0 and w0.
	// The method below is a good way of finding the ordering of x,y,z,w and
	// then find the correct traversal order for the simplex we’re in.
	// First, six pair-wise comparisons are performed between each possible pair
	// of the four coordinates, and the results are used to add up binary bits
	// for an integer index.
	var c1 = ( x0 > y0 ) ? 32 : 0;
	var c2 = ( x0 > z0 ) ? 16 : 0;
	var c3 = ( y0 > z0 ) ? 8 : 0;
	var c4 = ( x0 > w0 ) ? 4 : 0;
	var c5 = ( y0 > w0 ) ? 2 : 0;
	var c6 = ( z0 > w0 ) ? 1 : 0;
	var c = c1 + c2 + c3 + c4 + c5 + c6;
	var i1, j1, k1, l1; // The integer offsets for the second simplex corner
	var i2, j2, k2, l2; // The integer offsets for the third simplex corner
	var i3, j3, k3, l3; // The integer offsets for the fourth simplex corner
	// simplex[c] is a 4-vector with the numbers 0, 1, 2 and 3 in some order.
	// Many values of c will never occur, since e.g. x>y>z>w makes x<z, y<w and x<w
	// impossible. Only the 24 indices which have non-zero entries make any sense.
	// We use a thresholding to set the coordinates in turn from the largest magnitude.
	// The number 3 in the "simplex" array is at the position of the largest coordinate.
	i1 = simplex[ c ][ 0 ] >= 3 ? 1 : 0;
	j1 = simplex[ c ][ 1 ] >= 3 ? 1 : 0;
	k1 = simplex[ c ][ 2 ] >= 3 ? 1 : 0;
	l1 = simplex[ c ][ 3 ] >= 3 ? 1 : 0;
	// The number 2 in the "simplex" array is at the second largest coordinate.
	i2 = simplex[ c ][ 0 ] >= 2 ? 1 : 0;
	j2 = simplex[ c ][ 1 ] >= 2 ? 1 : 0; k2 = simplex[ c ][ 2 ] >= 2 ? 1 : 0;
	l2 = simplex[ c ][ 3 ] >= 2 ? 1 : 0;
	// The number 1 in the "simplex" array is at the second smallest coordinate.
	i3 = simplex[ c ][ 0 ] >= 1 ? 1 : 0;
	j3 = simplex[ c ][ 1 ] >= 1 ? 1 : 0;
	k3 = simplex[ c ][ 2 ] >= 1 ? 1 : 0;
	l3 = simplex[ c ][ 3 ] >= 1 ? 1 : 0;
	// The fifth corner has all coordinate offsets = 1, so no need to look that up.
	var x1 = x0 - i1 + G4; // Offsets for second corner in (x,y,z,w) coords
	var y1 = y0 - j1 + G4;
	var z1 = z0 - k1 + G4;
	var w1 = w0 - l1 + G4;
	var x2 = x0 - i2 + 2.0 * G4; // Offsets for third corner in (x,y,z,w) coords
	var y2 = y0 - j2 + 2.0 * G4;
	var z2 = z0 - k2 + 2.0 * G4;
	var w2 = w0 - l2 + 2.0 * G4;
	var x3 = x0 - i3 + 3.0 * G4; // Offsets for fourth corner in (x,y,z,w) coords
	var y3 = y0 - j3 + 3.0 * G4;
	var z3 = z0 - k3 + 3.0 * G4;
	var w3 = w0 - l3 + 3.0 * G4;
	var x4 = x0 - 1.0 + 4.0 * G4; // Offsets for last corner in (x,y,z,w) coords
	var y4 = y0 - 1.0 + 4.0 * G4;
	var z4 = z0 - 1.0 + 4.0 * G4;
	var w4 = w0 - 1.0 + 4.0 * G4;
	// Work out the hashed gradient indices of the five simplex corners
	var ii = i & 255;
	var jj = j & 255;
	var kk = k & 255;
	var ll = l & 255;
	var gi0 = perm[ ii + perm[ jj + perm[ kk + perm[ ll ] ] ] ] % 32;
	var gi1 = perm[ ii + i1 + perm[ jj + j1 + perm[ kk + k1 + perm[ ll + l1 ] ] ] ] % 32;
	var gi2 = perm[ ii + i2 + perm[ jj + j2 + perm[ kk + k2 + perm[ ll + l2 ] ] ] ] % 32;
	var gi3 = perm[ ii + i3 + perm[ jj + j3 + perm[ kk + k3 + perm[ ll + l3 ] ] ] ] % 32;
	var gi4 = perm[ ii + 1 + perm[ jj + 1 + perm[ kk + 1 + perm[ ll + 1 ] ] ] ] % 32;
	// Calculate the contribution from the five corners
	var t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0 - w0 * w0;
	if ( t0 < 0 ) n0 = 0.0;
	else {

		t0 *= t0;
		n0 = t0 * t0 * this.dot4( grad4[ gi0 ], x0, y0, z0, w0 );

	}

	var t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1 - w1 * w1;
	if ( t1 < 0 ) n1 = 0.0;
	else {

		t1 *= t1;
		n1 = t1 * t1 * this.dot4( grad4[ gi1 ], x1, y1, z1, w1 );

	}

	var t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2 - w2 * w2;
	if ( t2 < 0 ) n2 = 0.0;
	else {

		t2 *= t2;
		n2 = t2 * t2 * this.dot4( grad4[ gi2 ], x2, y2, z2, w2 );

	}

	var t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3 - w3 * w3;
	if ( t3 < 0 ) n3 = 0.0;
	else {

		t3 *= t3;
		n3 = t3 * t3 * this.dot4( grad4[ gi3 ], x3, y3, z3, w3 );

	}

	var t4 = 0.6 - x4 * x4 - y4 * y4 - z4 * z4 - w4 * w4;
	if ( t4 < 0 ) n4 = 0.0;
	else {

		t4 *= t4;
		n4 = t4 * t4 * this.dot4( grad4[ gi4 ], x4, y4, z4, w4 );

	}

	// Sum up and scale the result to cover the range [-1,1]
	return 27.0 * ( n0 + n1 + n2 + n3 + n4 );

};
( function () {

	/**
 * OpenEXR loader currently supports uncompressed, ZIP(S), RLE, PIZ and DWA/B compression.
 * Supports reading as UnsignedByte, HalfFloat and Float type data texture.
 *
 * Referred to the original Industrial Light & Magic OpenEXR implementation and the TinyEXR / Syoyo Fujita
 * implementation, so I have preserved their copyright notices.
 */
	// /*
	// Copyright (c) 2014 - 2017, Syoyo Fujita
	// All rights reserved.
	// Redistribution and use in source and binary forms, with or without
	// modification, are permitted provided that the following conditions are met:
	//     * Redistributions of source code must retain the above copyright
	//       notice, this list of conditions and the following disclaimer.
	//     * Redistributions in binary form must reproduce the above copyright
	//       notice, this list of conditions and the following disclaimer in the
	//       documentation and/or other materials provided with the distribution.
	//     * Neither the name of the Syoyo Fujita nor the
	//       names of its contributors may be used to endorse or promote products
	//       derived from this software without specific prior written permission.
	// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	// DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
	// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
	// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	// */
	// // TinyEXR contains some OpenEXR code, which is licensed under ------------
	// ///////////////////////////////////////////////////////////////////////////
	// //
	// // Copyright (c) 2002, Industrial Light & Magic, a division of Lucas
	// // Digital Ltd. LLC
	// //
	// // All rights reserved.
	// //
	// // Redistribution and use in source and binary forms, with or without
	// // modification, are permitted provided that the following conditions are
	// // met:
	// // *       Redistributions of source code must retain the above copyright
	// // notice, this list of conditions and the following disclaimer.
	// // *       Redistributions in binary form must reproduce the above
	// // copyright notice, this list of conditions and the following disclaimer
	// // in the documentation and/or other materials provided with the
	// // distribution.
	// // *       Neither the name of Industrial Light & Magic nor the names of
	// // its contributors may be used to endorse or promote products derived
	// // from this software without specific prior written permission.
	// //
	// // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
	// // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
	// // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
	// // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
	// // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
	// // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
	// // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
	// // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
	// // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	// // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	// // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
	// //
	// ///////////////////////////////////////////////////////////////////////////
	// // End of OpenEXR license -------------------------------------------------

	class EXRLoader extends THREE.DataTextureLoader {

		constructor( manager ) {

			super( manager );
			this.type = THREE.HalfFloatType;

		}

		parse( buffer ) {

			const USHORT_RANGE = 1 << 16;
			const BITMAP_SIZE = USHORT_RANGE >> 3;
			const HUF_ENCBITS = 16; // literal (value) bit length

			const HUF_DECBITS = 14; // decoding bit size (>= 8)

			const HUF_ENCSIZE = ( 1 << HUF_ENCBITS ) + 1; // encoding table size

			const HUF_DECSIZE = 1 << HUF_DECBITS; // decoding table size

			const HUF_DECMASK = HUF_DECSIZE - 1;
			const NBITS = 16;
			const A_OFFSET = 1 << NBITS - 1;
			const MOD_MASK = ( 1 << NBITS ) - 1;
			const SHORT_ZEROCODE_RUN = 59;
			const LONG_ZEROCODE_RUN = 63;
			const SHORTEST_LONG_RUN = 2 + LONG_ZEROCODE_RUN - SHORT_ZEROCODE_RUN;
			const ULONG_SIZE = 8;
			const FLOAT32_SIZE = 4;
			const INT32_SIZE = 4;
			const INT16_SIZE = 2;
			const INT8_SIZE = 1;
			const STATIC_HUFFMAN = 0;
			const DEFLATE = 1;
			const UNKNOWN = 0;
			const LOSSY_DCT = 1;
			const RLE = 2;
			const logBase = Math.pow( 2.7182818, 2.2 );
			var tmpDataView = new DataView( new ArrayBuffer( 8 ) );

			function frexp( value ) {

				if ( value === 0 ) return [ value, 0 ];
				tmpDataView.setFloat64( 0, value );
				var bits = tmpDataView.getUint32( 0 ) >>> 20 & 0x7FF;

				if ( bits === 0 ) {

					// denormal
					tmpDataView.setFloat64( 0, value * Math.pow( 2, 64 ) ); // exp + 64

					bits = ( tmpDataView.getUint32( 0 ) >>> 20 & 0x7FF ) - 64;

				}

				var exponent = bits - 1022;
				var mantissa = ldexp( value, - exponent );
				return [ mantissa, exponent ];

			}

			function ldexp( mantissa, exponent ) {

				var steps = Math.min( 3, Math.ceil( Math.abs( exponent ) / 1023 ) );
				var result = mantissa;

				for ( var i = 0; i < steps; i ++ ) result *= Math.pow( 2, Math.floor( ( exponent + i ) / steps ) );

				return result;

			}

			function reverseLutFromBitmap( bitmap, lut ) {

				var k = 0;

				for ( var i = 0; i < USHORT_RANGE; ++ i ) {

					if ( i == 0 || bitmap[ i >> 3 ] & 1 << ( i & 7 ) ) {

						lut[ k ++ ] = i;

					}

				}

				var n = k - 1;

				while ( k < USHORT_RANGE ) lut[ k ++ ] = 0;

				return n;

			}

			function hufClearDecTable( hdec ) {

				for ( var i = 0; i < HUF_DECSIZE; i ++ ) {

					hdec[ i ] = {};
					hdec[ i ].len = 0;
					hdec[ i ].lit = 0;
					hdec[ i ].p = null;

				}

			}

			const getBitsReturn = {
				l: 0,
				c: 0,
				lc: 0
			};

			function getBits( nBits, c, lc, uInt8Array, inOffset ) {

				while ( lc < nBits ) {

					c = c << 8 | parseUint8Array( uInt8Array, inOffset );
					lc += 8;

				}

				lc -= nBits;
				getBitsReturn.l = c >> lc & ( 1 << nBits ) - 1;
				getBitsReturn.c = c;
				getBitsReturn.lc = lc;

			}

			const hufTableBuffer = new Array( 59 );

			function hufCanonicalCodeTable( hcode ) {

				for ( var i = 0; i <= 58; ++ i ) hufTableBuffer[ i ] = 0;

				for ( var i = 0; i < HUF_ENCSIZE; ++ i ) hufTableBuffer[ hcode[ i ] ] += 1;

				var c = 0;

				for ( var i = 58; i > 0; -- i ) {

					var nc = c + hufTableBuffer[ i ] >> 1;
					hufTableBuffer[ i ] = c;
					c = nc;

				}

				for ( var i = 0; i < HUF_ENCSIZE; ++ i ) {

					var l = hcode[ i ];
					if ( l > 0 ) hcode[ i ] = l | hufTableBuffer[ l ] ++ << 6;

				}

			}

			function hufUnpackEncTable( uInt8Array, inDataView, inOffset, ni, im, iM, hcode ) {

				var p = inOffset;
				var c = 0;
				var lc = 0;

				for ( ; im <= iM; im ++ ) {

					if ( p.value - inOffset.value > ni ) return false;
					getBits( 6, c, lc, uInt8Array, p );
					var l = getBitsReturn.l;
					c = getBitsReturn.c;
					lc = getBitsReturn.lc;
					hcode[ im ] = l;

					if ( l == LONG_ZEROCODE_RUN ) {

						if ( p.value - inOffset.value > ni ) {

							throw 'Something wrong with hufUnpackEncTable';

						}

						getBits( 8, c, lc, uInt8Array, p );
						var zerun = getBitsReturn.l + SHORTEST_LONG_RUN;
						c = getBitsReturn.c;
						lc = getBitsReturn.lc;

						if ( im + zerun > iM + 1 ) {

							throw 'Something wrong with hufUnpackEncTable';

						}

						while ( zerun -- ) hcode[ im ++ ] = 0;

						im --;

					} else if ( l >= SHORT_ZEROCODE_RUN ) {

						var zerun = l - SHORT_ZEROCODE_RUN + 2;

						if ( im + zerun > iM + 1 ) {

							throw 'Something wrong with hufUnpackEncTable';

						}

						while ( zerun -- ) hcode[ im ++ ] = 0;

						im --;

					}

				}

				hufCanonicalCodeTable( hcode );

			}

			function hufLength( code ) {

				return code & 63;

			}

			function hufCode( code ) {

				return code >> 6;

			}

			function hufBuildDecTable( hcode, im, iM, hdecod ) {

				for ( ; im <= iM; im ++ ) {

					var c = hufCode( hcode[ im ] );
					var l = hufLength( hcode[ im ] );

					if ( c >> l ) {

						throw 'Invalid table entry';

					}

					if ( l > HUF_DECBITS ) {

						var pl = hdecod[ c >> l - HUF_DECBITS ];

						if ( pl.len ) {

							throw 'Invalid table entry';

						}

						pl.lit ++;

						if ( pl.p ) {

							var p = pl.p;
							pl.p = new Array( pl.lit );

							for ( var i = 0; i < pl.lit - 1; ++ i ) {

								pl.p[ i ] = p[ i ];

							}

						} else {

							pl.p = new Array( 1 );

						}

						pl.p[ pl.lit - 1 ] = im;

					} else if ( l ) {

						var plOffset = 0;

						for ( var i = 1 << HUF_DECBITS - l; i > 0; i -- ) {

							var pl = hdecod[ ( c << HUF_DECBITS - l ) + plOffset ];

							if ( pl.len || pl.p ) {

								throw 'Invalid table entry';

							}

							pl.len = l;
							pl.lit = im;
							plOffset ++;

						}

					}

				}

				return true;

			}

			const getCharReturn = {
				c: 0,
				lc: 0
			};

			function getChar( c, lc, uInt8Array, inOffset ) {

				c = c << 8 | parseUint8Array( uInt8Array, inOffset );
				lc += 8;
				getCharReturn.c = c;
				getCharReturn.lc = lc;

			}

			const getCodeReturn = {
				c: 0,
				lc: 0
			};

			function getCode( po, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outBufferOffset, outBufferEndOffset ) {

				if ( po == rlc ) {

					if ( lc < 8 ) {

						getChar( c, lc, uInt8Array, inOffset );
						c = getCharReturn.c;
						lc = getCharReturn.lc;

					}

					lc -= 8;
					var cs = c >> lc;
					var cs = new Uint8Array( [ cs ] )[ 0 ];

					if ( outBufferOffset.value + cs > outBufferEndOffset ) {

						return false;

					}

					var s = outBuffer[ outBufferOffset.value - 1 ];

					while ( cs -- > 0 ) {

						outBuffer[ outBufferOffset.value ++ ] = s;

					}

				} else if ( outBufferOffset.value < outBufferEndOffset ) {

					outBuffer[ outBufferOffset.value ++ ] = po;

				} else {

					return false;

				}

				getCodeReturn.c = c;
				getCodeReturn.lc = lc;

			}

			function UInt16( value ) {

				return value & 0xFFFF;

			}

			function Int16( value ) {

				var ref = UInt16( value );
				return ref > 0x7FFF ? ref - 0x10000 : ref;

			}

			const wdec14Return = {
				a: 0,
				b: 0
			};

			function wdec14( l, h ) {

				var ls = Int16( l );
				var hs = Int16( h );
				var hi = hs;
				var ai = ls + ( hi & 1 ) + ( hi >> 1 );
				var as = ai;
				var bs = ai - hi;
				wdec14Return.a = as;
				wdec14Return.b = bs;

			}

			function wdec16( l, h ) {

				var m = UInt16( l );
				var d = UInt16( h );
				var bb = m - ( d >> 1 ) & MOD_MASK;
				var aa = d + bb - A_OFFSET & MOD_MASK;
				wdec14Return.a = aa;
				wdec14Return.b = bb;

			}

			function wav2Decode( buffer, j, nx, ox, ny, oy, mx ) {

				var w14 = mx < 1 << 14;
				var n = nx > ny ? ny : nx;
				var p = 1;
				var p2;

				while ( p <= n ) p <<= 1;

				p >>= 1;
				p2 = p;
				p >>= 1;

				while ( p >= 1 ) {

					var py = 0;
					var ey = py + oy * ( ny - p2 );
					var oy1 = oy * p;
					var oy2 = oy * p2;
					var ox1 = ox * p;
					var ox2 = ox * p2;
					var i00, i01, i10, i11;

					for ( ; py <= ey; py += oy2 ) {

						var px = py;
						var ex = py + ox * ( nx - p2 );

						for ( ; px <= ex; px += ox2 ) {

							var p01 = px + ox1;
							var p10 = px + oy1;
							var p11 = p10 + ox1;

							if ( w14 ) {

								wdec14( buffer[ px + j ], buffer[ p10 + j ] );
								i00 = wdec14Return.a;
								i10 = wdec14Return.b;
								wdec14( buffer[ p01 + j ], buffer[ p11 + j ] );
								i01 = wdec14Return.a;
								i11 = wdec14Return.b;
								wdec14( i00, i01 );
								buffer[ px + j ] = wdec14Return.a;
								buffer[ p01 + j ] = wdec14Return.b;
								wdec14( i10, i11 );
								buffer[ p10 + j ] = wdec14Return.a;
								buffer[ p11 + j ] = wdec14Return.b;

							} else {

								wdec16( buffer[ px + j ], buffer[ p10 + j ] );
								i00 = wdec14Return.a;
								i10 = wdec14Return.b;
								wdec16( buffer[ p01 + j ], buffer[ p11 + j ] );
								i01 = wdec14Return.a;
								i11 = wdec14Return.b;
								wdec16( i00, i01 );
								buffer[ px + j ] = wdec14Return.a;
								buffer[ p01 + j ] = wdec14Return.b;
								wdec16( i10, i11 );
								buffer[ p10 + j ] = wdec14Return.a;
								buffer[ p11 + j ] = wdec14Return.b;

							}

						}

						if ( nx & p ) {

							var p10 = px + oy1;
							if ( w14 ) wdec14( buffer[ px + j ], buffer[ p10 + j ] ); else wdec16( buffer[ px + j ], buffer[ p10 + j ] );
							i00 = wdec14Return.a;
							buffer[ p10 + j ] = wdec14Return.b;
							buffer[ px + j ] = i00;

						}

					}

					if ( ny & p ) {

						var px = py;
						var ex = py + ox * ( nx - p2 );

						for ( ; px <= ex; px += ox2 ) {

							var p01 = px + ox1;
							if ( w14 ) wdec14( buffer[ px + j ], buffer[ p01 + j ] ); else wdec16( buffer[ px + j ], buffer[ p01 + j ] );
							i00 = wdec14Return.a;
							buffer[ p01 + j ] = wdec14Return.b;
							buffer[ px + j ] = i00;

						}

					}

					p2 = p;
					p >>= 1;

				}

				return py;

			}

			function hufDecode( encodingTable, decodingTable, uInt8Array, inDataView, inOffset, ni, rlc, no, outBuffer, outOffset ) {

				var c = 0;
				var lc = 0;
				var outBufferEndOffset = no;
				var inOffsetEnd = Math.trunc( inOffset.value + ( ni + 7 ) / 8 );

				while ( inOffset.value < inOffsetEnd ) {

					getChar( c, lc, uInt8Array, inOffset );
					c = getCharReturn.c;
					lc = getCharReturn.lc;

					while ( lc >= HUF_DECBITS ) {

						var index = c >> lc - HUF_DECBITS & HUF_DECMASK;
						var pl = decodingTable[ index ];

						if ( pl.len ) {

							lc -= pl.len;
							getCode( pl.lit, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );
							c = getCodeReturn.c;
							lc = getCodeReturn.lc;

						} else {

							if ( ! pl.p ) {

								throw 'hufDecode issues';

							}

							var j;

							for ( j = 0; j < pl.lit; j ++ ) {

								var l = hufLength( encodingTable[ pl.p[ j ] ] );

								while ( lc < l && inOffset.value < inOffsetEnd ) {

									getChar( c, lc, uInt8Array, inOffset );
									c = getCharReturn.c;
									lc = getCharReturn.lc;

								}

								if ( lc >= l ) {

									if ( hufCode( encodingTable[ pl.p[ j ] ] ) == ( c >> lc - l & ( 1 << l ) - 1 ) ) {

										lc -= l;
										getCode( pl.p[ j ], rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );
										c = getCodeReturn.c;
										lc = getCodeReturn.lc;
										break;

									}

								}

							}

							if ( j == pl.lit ) {

								throw 'hufDecode issues';

							}

						}

					}

				}

				var i = 8 - ni & 7;
				c >>= i;
				lc -= i;

				while ( lc > 0 ) {

					var pl = decodingTable[ c << HUF_DECBITS - lc & HUF_DECMASK ];

					if ( pl.len ) {

						lc -= pl.len;
						getCode( pl.lit, rlc, c, lc, uInt8Array, inDataView, inOffset, outBuffer, outOffset, outBufferEndOffset );
						c = getCodeReturn.c;
						lc = getCodeReturn.lc;

					} else {

						throw 'hufDecode issues';

					}

				}

				return true;

			}

			function hufUncompress( uInt8Array, inDataView, inOffset, nCompressed, outBuffer, nRaw ) {

				var outOffset = {
					value: 0
				};
				var initialInOffset = inOffset.value;
				var im = parseUint32( inDataView, inOffset );
				var iM = parseUint32( inDataView, inOffset );
				inOffset.value += 4;
				var nBits = parseUint32( inDataView, inOffset );
				inOffset.value += 4;

				if ( im < 0 || im >= HUF_ENCSIZE || iM < 0 || iM >= HUF_ENCSIZE ) {

					throw 'Something wrong with HUF_ENCSIZE';

				}

				var freq = new Array( HUF_ENCSIZE );
				var hdec = new Array( HUF_DECSIZE );
				hufClearDecTable( hdec );
				var ni = nCompressed - ( inOffset.value - initialInOffset );
				hufUnpackEncTable( uInt8Array, inDataView, inOffset, ni, im, iM, freq );

				if ( nBits > 8 * ( nCompressed - ( inOffset.value - initialInOffset ) ) ) {

					throw 'Something wrong with hufUncompress';

				}

				hufBuildDecTable( freq, im, iM, hdec );
				hufDecode( freq, hdec, uInt8Array, inDataView, inOffset, nBits, iM, nRaw, outBuffer, outOffset );

			}

			function applyLut( lut, data, nData ) {

				for ( var i = 0; i < nData; ++ i ) {

					data[ i ] = lut[ data[ i ] ];

				}

			}

			function predictor( source ) {

				for ( var t = 1; t < source.length; t ++ ) {

					var d = source[ t - 1 ] + source[ t ] - 128;
					source[ t ] = d;

				}

			}

			function interleaveScalar( source, out ) {

				var t1 = 0;
				var t2 = Math.floor( ( source.length + 1 ) / 2 );
				var s = 0;
				var stop = source.length - 1;

				while ( true ) {

					if ( s > stop ) break;
					out[ s ++ ] = source[ t1 ++ ];
					if ( s > stop ) break;
					out[ s ++ ] = source[ t2 ++ ];

				}

			}

			function decodeRunLength( source ) {

				var size = source.byteLength;
				var out = new Array();
				var p = 0;
				var reader = new DataView( source );

				while ( size > 0 ) {

					var l = reader.getInt8( p ++ );

					if ( l < 0 ) {

						var count = - l;
						size -= count + 1;

						for ( var i = 0; i < count; i ++ ) {

							out.push( reader.getUint8( p ++ ) );

						}

					} else {

						var count = l;
						size -= 2;
						var value = reader.getUint8( p ++ );

						for ( var i = 0; i < count + 1; i ++ ) {

							out.push( value );

						}

					}

				}

				return out;

			}

			function lossyDctDecode( cscSet, rowPtrs, channelData, acBuffer, dcBuffer, outBuffer ) {

				var dataView = new DataView( outBuffer.buffer );
				var width = channelData[ cscSet.idx[ 0 ] ].width;
				var height = channelData[ cscSet.idx[ 0 ] ].height;
				var numComp = 3;
				var numFullBlocksX = Math.floor( width / 8.0 );
				var numBlocksX = Math.ceil( width / 8.0 );
				var numBlocksY = Math.ceil( height / 8.0 );
				var leftoverX = width - ( numBlocksX - 1 ) * 8;
				var leftoverY = height - ( numBlocksY - 1 ) * 8;
				var currAcComp = {
					value: 0
				};
				var currDcComp = new Array( numComp );
				var dctData = new Array( numComp );
				var halfZigBlock = new Array( numComp );
				var rowBlock = new Array( numComp );
				var rowOffsets = new Array( numComp );

				for ( let comp = 0; comp < numComp; ++ comp ) {

					rowOffsets[ comp ] = rowPtrs[ cscSet.idx[ comp ] ];
					currDcComp[ comp ] = comp < 1 ? 0 : currDcComp[ comp - 1 ] + numBlocksX * numBlocksY;
					dctData[ comp ] = new Float32Array( 64 );
					halfZigBlock[ comp ] = new Uint16Array( 64 );
					rowBlock[ comp ] = new Uint16Array( numBlocksX * 64 );

				}

				for ( let blocky = 0; blocky < numBlocksY; ++ blocky ) {

					var maxY = 8;
					if ( blocky == numBlocksY - 1 ) maxY = leftoverY;
					var maxX = 8;

					for ( let blockx = 0; blockx < numBlocksX; ++ blockx ) {

						if ( blockx == numBlocksX - 1 ) maxX = leftoverX;

						for ( let comp = 0; comp < numComp; ++ comp ) {

							halfZigBlock[ comp ].fill( 0 ); // set block DC component

							halfZigBlock[ comp ][ 0 ] = dcBuffer[ currDcComp[ comp ] ++ ]; // set block AC components

							unRleAC( currAcComp, acBuffer, halfZigBlock[ comp ] ); // UnZigZag block to float

							unZigZag( halfZigBlock[ comp ], dctData[ comp ] ); // decode float dct

							dctInverse( dctData[ comp ] );

						}

						if ( numComp == 3 ) {

							csc709Inverse( dctData );

						}

						for ( let comp = 0; comp < numComp; ++ comp ) {

							convertToHalf( dctData[ comp ], rowBlock[ comp ], blockx * 64 );

						}

					} // blockx


					let offset = 0;

					for ( let comp = 0; comp < numComp; ++ comp ) {

						const type = channelData[ cscSet.idx[ comp ] ].type;

						for ( let y = 8 * blocky; y < 8 * blocky + maxY; ++ y ) {

							offset = rowOffsets[ comp ][ y ];

							for ( let blockx = 0; blockx < numFullBlocksX; ++ blockx ) {

								const src = blockx * 64 + ( y & 0x7 ) * 8;
								dataView.setUint16( offset + 0 * INT16_SIZE * type, rowBlock[ comp ][ src + 0 ], true );
								dataView.setUint16( offset + 1 * INT16_SIZE * type, rowBlock[ comp ][ src + 1 ], true );
								dataView.setUint16( offset + 2 * INT16_SIZE * type, rowBlock[ comp ][ src + 2 ], true );
								dataView.setUint16( offset + 3 * INT16_SIZE * type, rowBlock[ comp ][ src + 3 ], true );
								dataView.setUint16( offset + 4 * INT16_SIZE * type, rowBlock[ comp ][ src + 4 ], true );
								dataView.setUint16( offset + 5 * INT16_SIZE * type, rowBlock[ comp ][ src + 5 ], true );
								dataView.setUint16( offset + 6 * INT16_SIZE * type, rowBlock[ comp ][ src + 6 ], true );
								dataView.setUint16( offset + 7 * INT16_SIZE * type, rowBlock[ comp ][ src + 7 ], true );
								offset += 8 * INT16_SIZE * type;

							}

						} // handle partial X blocks


						if ( numFullBlocksX != numBlocksX ) {

							for ( let y = 8 * blocky; y < 8 * blocky + maxY; ++ y ) {

								const offset = rowOffsets[ comp ][ y ] + 8 * numFullBlocksX * INT16_SIZE * type;
								const src = numFullBlocksX * 64 + ( y & 0x7 ) * 8;

								for ( let x = 0; x < maxX; ++ x ) {

									dataView.setUint16( offset + x * INT16_SIZE * type, rowBlock[ comp ][ src + x ], true );

								}

							}

						}

					} // comp

				} // blocky


				var halfRow = new Uint16Array( width );
				var dataView = new DataView( outBuffer.buffer ); // convert channels back to float, if needed

				for ( var comp = 0; comp < numComp; ++ comp ) {

					channelData[ cscSet.idx[ comp ] ].decoded = true;
					var type = channelData[ cscSet.idx[ comp ] ].type;
					if ( channelData[ comp ].type != 2 ) continue;

					for ( var y = 0; y < height; ++ y ) {

						const offset = rowOffsets[ comp ][ y ];

						for ( var x = 0; x < width; ++ x ) {

							halfRow[ x ] = dataView.getUint16( offset + x * INT16_SIZE * type, true );

						}

						for ( var x = 0; x < width; ++ x ) {

							dataView.setFloat32( offset + x * INT16_SIZE * type, decodeFloat16( halfRow[ x ] ), true );

						}

					}

				}

			}

			function unRleAC( currAcComp, acBuffer, halfZigBlock ) {

				var acValue;
				var dctComp = 1;

				while ( dctComp < 64 ) {

					acValue = acBuffer[ currAcComp.value ];

					if ( acValue == 0xff00 ) {

						dctComp = 64;

					} else if ( acValue >> 8 == 0xff ) {

						dctComp += acValue & 0xff;

					} else {

						halfZigBlock[ dctComp ] = acValue;
						dctComp ++;

					}

					currAcComp.value ++;

				}

			}

			function unZigZag( src, dst ) {

				dst[ 0 ] = decodeFloat16( src[ 0 ] );
				dst[ 1 ] = decodeFloat16( src[ 1 ] );
				dst[ 2 ] = decodeFloat16( src[ 5 ] );
				dst[ 3 ] = decodeFloat16( src[ 6 ] );
				dst[ 4 ] = decodeFloat16( src[ 14 ] );
				dst[ 5 ] = decodeFloat16( src[ 15 ] );
				dst[ 6 ] = decodeFloat16( src[ 27 ] );
				dst[ 7 ] = decodeFloat16( src[ 28 ] );
				dst[ 8 ] = decodeFloat16( src[ 2 ] );
				dst[ 9 ] = decodeFloat16( src[ 4 ] );
				dst[ 10 ] = decodeFloat16( src[ 7 ] );
				dst[ 11 ] = decodeFloat16( src[ 13 ] );
				dst[ 12 ] = decodeFloat16( src[ 16 ] );
				dst[ 13 ] = decodeFloat16( src[ 26 ] );
				dst[ 14 ] = decodeFloat16( src[ 29 ] );
				dst[ 15 ] = decodeFloat16( src[ 42 ] );
				dst[ 16 ] = decodeFloat16( src[ 3 ] );
				dst[ 17 ] = decodeFloat16( src[ 8 ] );
				dst[ 18 ] = decodeFloat16( src[ 12 ] );
				dst[ 19 ] = decodeFloat16( src[ 17 ] );
				dst[ 20 ] = decodeFloat16( src[ 25 ] );
				dst[ 21 ] = decodeFloat16( src[ 30 ] );
				dst[ 22 ] = decodeFloat16( src[ 41 ] );
				dst[ 23 ] = decodeFloat16( src[ 43 ] );
				dst[ 24 ] = decodeFloat16( src[ 9 ] );
				dst[ 25 ] = decodeFloat16( src[ 11 ] );
				dst[ 26 ] = decodeFloat16( src[ 18 ] );
				dst[ 27 ] = decodeFloat16( src[ 24 ] );
				dst[ 28 ] = decodeFloat16( src[ 31 ] );
				dst[ 29 ] = decodeFloat16( src[ 40 ] );
				dst[ 30 ] = decodeFloat16( src[ 44 ] );
				dst[ 31 ] = decodeFloat16( src[ 53 ] );
				dst[ 32 ] = decodeFloat16( src[ 10 ] );
				dst[ 33 ] = decodeFloat16( src[ 19 ] );
				dst[ 34 ] = decodeFloat16( src[ 23 ] );
				dst[ 35 ] = decodeFloat16( src[ 32 ] );
				dst[ 36 ] = decodeFloat16( src[ 39 ] );
				dst[ 37 ] = decodeFloat16( src[ 45 ] );
				dst[ 38 ] = decodeFloat16( src[ 52 ] );
				dst[ 39 ] = decodeFloat16( src[ 54 ] );
				dst[ 40 ] = decodeFloat16( src[ 20 ] );
				dst[ 41 ] = decodeFloat16( src[ 22 ] );
				dst[ 42 ] = decodeFloat16( src[ 33 ] );
				dst[ 43 ] = decodeFloat16( src[ 38 ] );
				dst[ 44 ] = decodeFloat16( src[ 46 ] );
				dst[ 45 ] = decodeFloat16( src[ 51 ] );
				dst[ 46 ] = decodeFloat16( src[ 55 ] );
				dst[ 47 ] = decodeFloat16( src[ 60 ] );
				dst[ 48 ] = decodeFloat16( src[ 21 ] );
				dst[ 49 ] = decodeFloat16( src[ 34 ] );
				dst[ 50 ] = decodeFloat16( src[ 37 ] );
				dst[ 51 ] = decodeFloat16( src[ 47 ] );
				dst[ 52 ] = decodeFloat16( src[ 50 ] );
				dst[ 53 ] = decodeFloat16( src[ 56 ] );
				dst[ 54 ] = decodeFloat16( src[ 59 ] );
				dst[ 55 ] = decodeFloat16( src[ 61 ] );
				dst[ 56 ] = decodeFloat16( src[ 35 ] );
				dst[ 57 ] = decodeFloat16( src[ 36 ] );
				dst[ 58 ] = decodeFloat16( src[ 48 ] );
				dst[ 59 ] = decodeFloat16( src[ 49 ] );
				dst[ 60 ] = decodeFloat16( src[ 57 ] );
				dst[ 61 ] = decodeFloat16( src[ 58 ] );
				dst[ 62 ] = decodeFloat16( src[ 62 ] );
				dst[ 63 ] = decodeFloat16( src[ 63 ] );

			}

			function dctInverse( data ) {

				const a = 0.5 * Math.cos( 3.14159 / 4.0 );
				const b = 0.5 * Math.cos( 3.14159 / 16.0 );
				const c = 0.5 * Math.cos( 3.14159 / 8.0 );
				const d = 0.5 * Math.cos( 3.0 * 3.14159 / 16.0 );
				const e = 0.5 * Math.cos( 5.0 * 3.14159 / 16.0 );
				const f = 0.5 * Math.cos( 3.0 * 3.14159 / 8.0 );
				const g = 0.5 * Math.cos( 7.0 * 3.14159 / 16.0 );
				var alpha = new Array( 4 );
				var beta = new Array( 4 );
				var theta = new Array( 4 );
				var gamma = new Array( 4 );

				for ( var row = 0; row < 8; ++ row ) {

					var rowPtr = row * 8;
					alpha[ 0 ] = c * data[ rowPtr + 2 ];
					alpha[ 1 ] = f * data[ rowPtr + 2 ];
					alpha[ 2 ] = c * data[ rowPtr + 6 ];
					alpha[ 3 ] = f * data[ rowPtr + 6 ];
					beta[ 0 ] = b * data[ rowPtr + 1 ] + d * data[ rowPtr + 3 ] + e * data[ rowPtr + 5 ] + g * data[ rowPtr + 7 ];
					beta[ 1 ] = d * data[ rowPtr + 1 ] - g * data[ rowPtr + 3 ] - b * data[ rowPtr + 5 ] - e * data[ rowPtr + 7 ];
					beta[ 2 ] = e * data[ rowPtr + 1 ] - b * data[ rowPtr + 3 ] + g * data[ rowPtr + 5 ] + d * data[ rowPtr + 7 ];
					beta[ 3 ] = g * data[ rowPtr + 1 ] - e * data[ rowPtr + 3 ] + d * data[ rowPtr + 5 ] - b * data[ rowPtr + 7 ];
					theta[ 0 ] = a * ( data[ rowPtr + 0 ] + data[ rowPtr + 4 ] );
					theta[ 3 ] = a * ( data[ rowPtr + 0 ] - data[ rowPtr + 4 ] );
					theta[ 1 ] = alpha[ 0 ] + alpha[ 3 ];
					theta[ 2 ] = alpha[ 1 ] - alpha[ 2 ];
					gamma[ 0 ] = theta[ 0 ] + theta[ 1 ];
					gamma[ 1 ] = theta[ 3 ] + theta[ 2 ];
					gamma[ 2 ] = theta[ 3 ] - theta[ 2 ];
					gamma[ 3 ] = theta[ 0 ] - theta[ 1 ];
					data[ rowPtr + 0 ] = gamma[ 0 ] + beta[ 0 ];
					data[ rowPtr + 1 ] = gamma[ 1 ] + beta[ 1 ];
					data[ rowPtr + 2 ] = gamma[ 2 ] + beta[ 2 ];
					data[ rowPtr + 3 ] = gamma[ 3 ] + beta[ 3 ];
					data[ rowPtr + 4 ] = gamma[ 3 ] - beta[ 3 ];
					data[ rowPtr + 5 ] = gamma[ 2 ] - beta[ 2 ];
					data[ rowPtr + 6 ] = gamma[ 1 ] - beta[ 1 ];
					data[ rowPtr + 7 ] = gamma[ 0 ] - beta[ 0 ];

				}

				for ( var column = 0; column < 8; ++ column ) {

					alpha[ 0 ] = c * data[ 16 + column ];
					alpha[ 1 ] = f * data[ 16 + column ];
					alpha[ 2 ] = c * data[ 48 + column ];
					alpha[ 3 ] = f * data[ 48 + column ];
					beta[ 0 ] = b * data[ 8 + column ] + d * data[ 24 + column ] + e * data[ 40 + column ] + g * data[ 56 + column ];
					beta[ 1 ] = d * data[ 8 + column ] - g * data[ 24 + column ] - b * data[ 40 + column ] - e * data[ 56 + column ];
					beta[ 2 ] = e * data[ 8 + column ] - b * data[ 24 + column ] + g * data[ 40 + column ] + d * data[ 56 + column ];
					beta[ 3 ] = g * data[ 8 + column ] - e * data[ 24 + column ] + d * data[ 40 + column ] - b * data[ 56 + column ];
					theta[ 0 ] = a * ( data[ column ] + data[ 32 + column ] );
					theta[ 3 ] = a * ( data[ column ] - data[ 32 + column ] );
					theta[ 1 ] = alpha[ 0 ] + alpha[ 3 ];
					theta[ 2 ] = alpha[ 1 ] - alpha[ 2 ];
					gamma[ 0 ] = theta[ 0 ] + theta[ 1 ];
					gamma[ 1 ] = theta[ 3 ] + theta[ 2 ];
					gamma[ 2 ] = theta[ 3 ] - theta[ 2 ];
					gamma[ 3 ] = theta[ 0 ] - theta[ 1 ];
					data[ 0 + column ] = gamma[ 0 ] + beta[ 0 ];
					data[ 8 + column ] = gamma[ 1 ] + beta[ 1 ];
					data[ 16 + column ] = gamma[ 2 ] + beta[ 2 ];
					data[ 24 + column ] = gamma[ 3 ] + beta[ 3 ];
					data[ 32 + column ] = gamma[ 3 ] - beta[ 3 ];
					data[ 40 + column ] = gamma[ 2 ] - beta[ 2 ];
					data[ 48 + column ] = gamma[ 1 ] - beta[ 1 ];
					data[ 56 + column ] = gamma[ 0 ] - beta[ 0 ];

				}

			}

			function csc709Inverse( data ) {

				for ( var i = 0; i < 64; ++ i ) {

					var y = data[ 0 ][ i ];
					var cb = data[ 1 ][ i ];
					var cr = data[ 2 ][ i ];
					data[ 0 ][ i ] = y + 1.5747 * cr;
					data[ 1 ][ i ] = y - 0.1873 * cb - 0.4682 * cr;
					data[ 2 ][ i ] = y + 1.8556 * cb;

				}

			}

			function convertToHalf( src, dst, idx ) {

				for ( var i = 0; i < 64; ++ i ) {

					dst[ idx + i ] = THREE.DataUtils.toHalfFloat( toLinear( src[ i ] ) );

				}

			}

			function toLinear( float ) {

				if ( float <= 1 ) {

					return Math.sign( float ) * Math.pow( Math.abs( float ), 2.2 );

				} else {

					return Math.sign( float ) * Math.pow( logBase, Math.abs( float ) - 1.0 );

				}

			}

			function uncompressRAW( info ) {

				return new DataView( info.array.buffer, info.offset.value, info.size );

			}

			function uncompressRLE( info ) {

				var compressed = info.viewer.buffer.slice( info.offset.value, info.offset.value + info.size );
				var rawBuffer = new Uint8Array( decodeRunLength( compressed ) );
				var tmpBuffer = new Uint8Array( rawBuffer.length );
				predictor( rawBuffer ); // revert predictor

				interleaveScalar( rawBuffer, tmpBuffer ); // interleave pixels

				return new DataView( tmpBuffer.buffer );

			}

			function uncompressZIP( info ) {

				var compressed = info.array.slice( info.offset.value, info.offset.value + info.size );

				if ( typeof fflate === 'undefined' ) {

					console.error( 'THREE.EXRLoader: External library fflate.min.js required.' );

				}

				var rawBuffer = fflate.unzlibSync( compressed ); // eslint-disable-line no-undef

				var tmpBuffer = new Uint8Array( rawBuffer.length );
				predictor( rawBuffer ); // revert predictor

				interleaveScalar( rawBuffer, tmpBuffer ); // interleave pixels

				return new DataView( tmpBuffer.buffer );

			}

			function uncompressPIZ( info ) {

				var inDataView = info.viewer;
				var inOffset = {
					value: info.offset.value
				};
				var tmpBufSize = info.width * scanlineBlockSize * ( EXRHeader.channels.length * info.type );
				var outBuffer = new Uint16Array( tmpBufSize );
				var bitmap = new Uint8Array( BITMAP_SIZE ); // Setup channel info

				var outBufferEnd = 0;
				var pizChannelData = new Array( info.channels );

				for ( var i = 0; i < info.channels; i ++ ) {

					pizChannelData[ i ] = {};
					pizChannelData[ i ][ 'start' ] = outBufferEnd;
					pizChannelData[ i ][ 'end' ] = pizChannelData[ i ][ 'start' ];
					pizChannelData[ i ][ 'nx' ] = info.width;
					pizChannelData[ i ][ 'ny' ] = info.lines;
					pizChannelData[ i ][ 'size' ] = info.type;
					outBufferEnd += pizChannelData[ i ].nx * pizChannelData[ i ].ny * pizChannelData[ i ].size;

				} // Read range compression data


				var minNonZero = parseUint16( inDataView, inOffset );
				var maxNonZero = parseUint16( inDataView, inOffset );

				if ( maxNonZero >= BITMAP_SIZE ) {

					throw 'Something is wrong with PIZ_COMPRESSION BITMAP_SIZE';

				}

				if ( minNonZero <= maxNonZero ) {

					for ( var i = 0; i < maxNonZero - minNonZero + 1; i ++ ) {

						bitmap[ i + minNonZero ] = parseUint8( inDataView, inOffset );

					}

				} // Reverse LUT


				var lut = new Uint16Array( USHORT_RANGE );
				var maxValue = reverseLutFromBitmap( bitmap, lut );
				var length = parseUint32( inDataView, inOffset ); // Huffman decoding

				hufUncompress( info.array, inDataView, inOffset, length, outBuffer, outBufferEnd ); // Wavelet decoding

				for ( var i = 0; i < info.channels; ++ i ) {

					var cd = pizChannelData[ i ];

					for ( var j = 0; j < pizChannelData[ i ].size; ++ j ) {

						wav2Decode( outBuffer, cd.start + j, cd.nx, cd.size, cd.ny, cd.nx * cd.size, maxValue );

					}

				} // Expand the pixel data to their original range


				applyLut( lut, outBuffer, outBufferEnd ); // Rearrange the pixel data into the format expected by the caller.

				var tmpOffset = 0;
				var tmpBuffer = new Uint8Array( outBuffer.buffer.byteLength );

				for ( var y = 0; y < info.lines; y ++ ) {

					for ( var c = 0; c < info.channels; c ++ ) {

						var cd = pizChannelData[ c ];
						var n = cd.nx * cd.size;
						var cp = new Uint8Array( outBuffer.buffer, cd.end * INT16_SIZE, n * INT16_SIZE );
						tmpBuffer.set( cp, tmpOffset );
						tmpOffset += n * INT16_SIZE;
						cd.end += n;

					}

				}

				return new DataView( tmpBuffer.buffer );

			}

			function uncompressPXR( info ) {

				var compressed = info.array.slice( info.offset.value, info.offset.value + info.size );

				if ( typeof fflate === 'undefined' ) {

					console.error( 'THREE.EXRLoader: External library fflate.min.js required.' );

				}

				var rawBuffer = fflate.unzlibSync( compressed ); // eslint-disable-line no-undef

				const sz = info.lines * info.channels * info.width;
				const tmpBuffer = info.type == 1 ? new Uint16Array( sz ) : new Uint32Array( sz );
				let tmpBufferEnd = 0;
				let writePtr = 0;
				const ptr = new Array( 4 );

				for ( let y = 0; y < info.lines; y ++ ) {

					for ( let c = 0; c < info.channels; c ++ ) {

						let pixel = 0;

						switch ( info.type ) {

							case 1:
								ptr[ 0 ] = tmpBufferEnd;
								ptr[ 1 ] = ptr[ 0 ] + info.width;
								tmpBufferEnd = ptr[ 1 ] + info.width;

								for ( let j = 0; j < info.width; ++ j ) {

									const diff = rawBuffer[ ptr[ 0 ] ++ ] << 8 | rawBuffer[ ptr[ 1 ] ++ ];
									pixel += diff;
									tmpBuffer[ writePtr ] = pixel;
									writePtr ++;

								}

								break;

							case 2:
								ptr[ 0 ] = tmpBufferEnd;
								ptr[ 1 ] = ptr[ 0 ] + info.width;
								ptr[ 2 ] = ptr[ 1 ] + info.width;
								tmpBufferEnd = ptr[ 2 ] + info.width;

								for ( let j = 0; j < info.width; ++ j ) {

									const diff = rawBuffer[ ptr[ 0 ] ++ ] << 24 | rawBuffer[ ptr[ 1 ] ++ ] << 16 | rawBuffer[ ptr[ 2 ] ++ ] << 8;
									pixel += diff;
									tmpBuffer[ writePtr ] = pixel;
									writePtr ++;

								}

								break;

						}

					}

				}

				return new DataView( tmpBuffer.buffer );

			}

			function uncompressDWA( info ) {

				var inDataView = info.viewer;
				var inOffset = {
					value: info.offset.value
				};
				var outBuffer = new Uint8Array( info.width * info.lines * ( EXRHeader.channels.length * info.type * INT16_SIZE ) ); // Read compression header information

				var dwaHeader = {
					version: parseInt64( inDataView, inOffset ),
					unknownUncompressedSize: parseInt64( inDataView, inOffset ),
					unknownCompressedSize: parseInt64( inDataView, inOffset ),
					acCompressedSize: parseInt64( inDataView, inOffset ),
					dcCompressedSize: parseInt64( inDataView, inOffset ),
					rleCompressedSize: parseInt64( inDataView, inOffset ),
					rleUncompressedSize: parseInt64( inDataView, inOffset ),
					rleRawSize: parseInt64( inDataView, inOffset ),
					totalAcUncompressedCount: parseInt64( inDataView, inOffset ),
					totalDcUncompressedCount: parseInt64( inDataView, inOffset ),
					acCompression: parseInt64( inDataView, inOffset )
				};
				if ( dwaHeader.version < 2 ) throw 'EXRLoader.parse: ' + EXRHeader.compression + ' version ' + dwaHeader.version + ' is unsupported'; // Read channel ruleset information

				var channelRules = new Array();
				var ruleSize = parseUint16( inDataView, inOffset ) - INT16_SIZE;

				while ( ruleSize > 0 ) {

					var name = parseNullTerminatedString( inDataView.buffer, inOffset );
					var value = parseUint8( inDataView, inOffset );
					var compression = value >> 2 & 3;
					var csc = ( value >> 4 ) - 1;
					var index = new Int8Array( [ csc ] )[ 0 ];
					var type = parseUint8( inDataView, inOffset );
					channelRules.push( {
						name: name,
						index: index,
						type: type,
						compression: compression
					} );
					ruleSize -= name.length + 3;

				} // Classify channels


				var channels = EXRHeader.channels;
				var channelData = new Array( info.channels );

				for ( var i = 0; i < info.channels; ++ i ) {

					var cd = channelData[ i ] = {};
					var channel = channels[ i ];
					cd.name = channel.name;
					cd.compression = UNKNOWN;
					cd.decoded = false;
					cd.type = channel.pixelType;
					cd.pLinear = channel.pLinear;
					cd.width = info.width;
					cd.height = info.lines;

				}

				var cscSet = {
					idx: new Array( 3 )
				};

				for ( var offset = 0; offset < info.channels; ++ offset ) {

					var cd = channelData[ offset ];

					for ( var i = 0; i < channelRules.length; ++ i ) {

						var rule = channelRules[ i ];

						if ( cd.name == rule.name ) {

							cd.compression = rule.compression;

							if ( rule.index >= 0 ) {

								cscSet.idx[ rule.index ] = offset;

							}

							cd.offset = offset;

						}

					}

				} // Read DCT - AC component data


				if ( dwaHeader.acCompressedSize > 0 ) {

					switch ( dwaHeader.acCompression ) {

						case STATIC_HUFFMAN:
							var acBuffer = new Uint16Array( dwaHeader.totalAcUncompressedCount );
							hufUncompress( info.array, inDataView, inOffset, dwaHeader.acCompressedSize, acBuffer, dwaHeader.totalAcUncompressedCount );
							break;

						case DEFLATE:
							var compressed = info.array.slice( inOffset.value, inOffset.value + dwaHeader.totalAcUncompressedCount );
							var data = fflate.unzlibSync( compressed ); // eslint-disable-line no-undef

							var acBuffer = new Uint16Array( data.buffer );
							inOffset.value += dwaHeader.totalAcUncompressedCount;
							break;

					}

				} // Read DCT - DC component data


				if ( dwaHeader.dcCompressedSize > 0 ) {

					var zlibInfo = {
						array: info.array,
						offset: inOffset,
						size: dwaHeader.dcCompressedSize
					};
					var dcBuffer = new Uint16Array( uncompressZIP( zlibInfo ).buffer );
					inOffset.value += dwaHeader.dcCompressedSize;

				} // Read RLE compressed data


				if ( dwaHeader.rleRawSize > 0 ) {

					var compressed = info.array.slice( inOffset.value, inOffset.value + dwaHeader.rleCompressedSize );
					var data = fflate.unzlibSync( compressed ); // eslint-disable-line no-undef

					var rleBuffer = decodeRunLength( data.buffer );
					inOffset.value += dwaHeader.rleCompressedSize;

				} // Prepare outbuffer data offset


				var outBufferEnd = 0;
				var rowOffsets = new Array( channelData.length );

				for ( var i = 0; i < rowOffsets.length; ++ i ) {

					rowOffsets[ i ] = new Array();

				}

				for ( var y = 0; y < info.lines; ++ y ) {

					for ( var chan = 0; chan < channelData.length; ++ chan ) {

						rowOffsets[ chan ].push( outBufferEnd );
						outBufferEnd += channelData[ chan ].width * info.type * INT16_SIZE;

					}

				} // Lossy DCT decode RGB channels


				lossyDctDecode( cscSet, rowOffsets, channelData, acBuffer, dcBuffer, outBuffer ); // Decode other channels

				for ( var i = 0; i < channelData.length; ++ i ) {

					var cd = channelData[ i ];
					if ( cd.decoded ) continue;

					switch ( cd.compression ) {

						case RLE:
							var row = 0;
							var rleOffset = 0;

							for ( var y = 0; y < info.lines; ++ y ) {

								var rowOffsetBytes = rowOffsets[ i ][ row ];

								for ( var x = 0; x < cd.width; ++ x ) {

									for ( var byte = 0; byte < INT16_SIZE * cd.type; ++ byte ) {

										outBuffer[ rowOffsetBytes ++ ] = rleBuffer[ rleOffset + byte * cd.width * cd.height ];

									}

									rleOffset ++;

								}

								row ++;

							}

							break;

						case LOSSY_DCT: // skip

						default:
							throw 'EXRLoader.parse: unsupported channel compression';

					}

				}

				return new DataView( outBuffer.buffer );

			}

			function parseNullTerminatedString( buffer, offset ) {

				var uintBuffer = new Uint8Array( buffer );
				var endOffset = 0;

				while ( uintBuffer[ offset.value + endOffset ] != 0 ) {

					endOffset += 1;

				}

				var stringValue = new TextDecoder().decode( uintBuffer.slice( offset.value, offset.value + endOffset ) );
				offset.value = offset.value + endOffset + 1;
				return stringValue;

			}

			function parseFixedLengthString( buffer, offset, size ) {

				var stringValue = new TextDecoder().decode( new Uint8Array( buffer ).slice( offset.value, offset.value + size ) );
				offset.value = offset.value + size;
				return stringValue;

			}

			function parseUlong( dataView, offset ) {

				var uLong = dataView.getUint32( 0, true );
				offset.value = offset.value + ULONG_SIZE;
				return uLong;

			}

			function parseRational( dataView, offset ) {

				var x = parseInt32( dataView, offset );
				var y = parseUint32( dataView, offset );
				return [ x, y ];

			}

			function parseTimecode( dataView, offset ) {

				var x = parseUint32( dataView, offset );
				var y = parseUint32( dataView, offset );
				return [ x, y ];

			}

			function parseInt32( dataView, offset ) {

				var Int32 = dataView.getInt32( offset.value, true );
				offset.value = offset.value + INT32_SIZE;
				return Int32;

			}

			function parseUint32( dataView, offset ) {

				var Uint32 = dataView.getUint32( offset.value, true );
				offset.value = offset.value + INT32_SIZE;
				return Uint32;

			}

			function parseUint8Array( uInt8Array, offset ) {

				var Uint8 = uInt8Array[ offset.value ];
				offset.value = offset.value + INT8_SIZE;
				return Uint8;

			}

			function parseUint8( dataView, offset ) {

				var Uint8 = dataView.getUint8( offset.value );
				offset.value = offset.value + INT8_SIZE;
				return Uint8;

			}

			function parseInt64( dataView, offset ) {

				var int = Number( dataView.getBigInt64( offset.value, true ) );
				offset.value += ULONG_SIZE;
				return int;

			}

			function parseFloat32( dataView, offset ) {

				var float = dataView.getFloat32( offset.value, true );
				offset.value += FLOAT32_SIZE;
				return float;

			}

			function decodeFloat32( dataView, offset ) {

				return THREE.DataUtils.toHalfFloat( parseFloat32( dataView, offset ) );

			} // https://stackoverflow.com/questions/5678432/decompressing-half-precision-floats-in-javascript


			function decodeFloat16( binary ) {

				var exponent = ( binary & 0x7C00 ) >> 10,
					fraction = binary & 0x03FF;
				return ( binary >> 15 ? - 1 : 1 ) * ( exponent ? exponent === 0x1F ? fraction ? NaN : Infinity : Math.pow( 2, exponent - 15 ) * ( 1 + fraction / 0x400 ) : 6.103515625e-5 * ( fraction / 0x400 ) );

			}

			function parseUint16( dataView, offset ) {

				var Uint16 = dataView.getUint16( offset.value, true );
				offset.value += INT16_SIZE;
				return Uint16;

			}

			function parseFloat16( buffer, offset ) {

				return decodeFloat16( parseUint16( buffer, offset ) );

			}

			function parseChlist( dataView, buffer, offset, size ) {

				var startOffset = offset.value;
				var channels = [];

				while ( offset.value < startOffset + size - 1 ) {

					var name = parseNullTerminatedString( buffer, offset );
					var pixelType = parseInt32( dataView, offset );
					var pLinear = parseUint8( dataView, offset );
					offset.value += 3; // reserved, three chars

					var xSampling = parseInt32( dataView, offset );
					var ySampling = parseInt32( dataView, offset );
					channels.push( {
						name: name,
						pixelType: pixelType,
						pLinear: pLinear,
						xSampling: xSampling,
						ySampling: ySampling
					} );

				}

				offset.value += 1;
				return channels;

			}

			function parseChromaticities( dataView, offset ) {

				var redX = parseFloat32( dataView, offset );
				var redY = parseFloat32( dataView, offset );
				var greenX = parseFloat32( dataView, offset );
				var greenY = parseFloat32( dataView, offset );
				var blueX = parseFloat32( dataView, offset );
				var blueY = parseFloat32( dataView, offset );
				var whiteX = parseFloat32( dataView, offset );
				var whiteY = parseFloat32( dataView, offset );
				return {
					redX: redX,
					redY: redY,
					greenX: greenX,
					greenY: greenY,
					blueX: blueX,
					blueY: blueY,
					whiteX: whiteX,
					whiteY: whiteY
				};

			}

			function parseCompression( dataView, offset ) {

				var compressionCodes = [ 'NO_COMPRESSION', 'RLE_COMPRESSION', 'ZIPS_COMPRESSION', 'ZIP_COMPRESSION', 'PIZ_COMPRESSION', 'PXR24_COMPRESSION', 'B44_COMPRESSION', 'B44A_COMPRESSION', 'DWAA_COMPRESSION', 'DWAB_COMPRESSION' ];
				var compression = parseUint8( dataView, offset );
				return compressionCodes[ compression ];

			}

			function parseBox2i( dataView, offset ) {

				var xMin = parseUint32( dataView, offset );
				var yMin = parseUint32( dataView, offset );
				var xMax = parseUint32( dataView, offset );
				var yMax = parseUint32( dataView, offset );
				return {
					xMin: xMin,
					yMin: yMin,
					xMax: xMax,
					yMax: yMax
				};

			}

			function parseLineOrder( dataView, offset ) {

				var lineOrders = [ 'INCREASING_Y' ];
				var lineOrder = parseUint8( dataView, offset );
				return lineOrders[ lineOrder ];

			}

			function parseV2f( dataView, offset ) {

				var x = parseFloat32( dataView, offset );
				var y = parseFloat32( dataView, offset );
				return [ x, y ];

			}

			function parseV3f( dataView, offset ) {

				var x = parseFloat32( dataView, offset );
				var y = parseFloat32( dataView, offset );
				var z = parseFloat32( dataView, offset );
				return [ x, y, z ];

			}

			function parseValue( dataView, buffer, offset, type, size ) {

				if ( type === 'string' || type === 'stringvector' || type === 'iccProfile' ) {

					return parseFixedLengthString( buffer, offset, size );

				} else if ( type === 'chlist' ) {

					return parseChlist( dataView, buffer, offset, size );

				} else if ( type === 'chromaticities' ) {

					return parseChromaticities( dataView, offset );

				} else if ( type === 'compression' ) {

					return parseCompression( dataView, offset );

				} else if ( type === 'box2i' ) {

					return parseBox2i( dataView, offset );

				} else if ( type === 'lineOrder' ) {

					return parseLineOrder( dataView, offset );

				} else if ( type === 'float' ) {

					return parseFloat32( dataView, offset );

				} else if ( type === 'v2f' ) {

					return parseV2f( dataView, offset );

				} else if ( type === 'v3f' ) {

					return parseV3f( dataView, offset );

				} else if ( type === 'int' ) {

					return parseInt32( dataView, offset );

				} else if ( type === 'rational' ) {

					return parseRational( dataView, offset );

				} else if ( type === 'timecode' ) {

					return parseTimecode( dataView, offset );

				} else if ( type === 'preview' ) {

					offset.value += size;
					return 'skipped';

				} else {

					offset.value += size;
					return undefined;

				}

			}

			var bufferDataView = new DataView( buffer );
			var uInt8Array = new Uint8Array( buffer );
			var EXRHeader = {};
			bufferDataView.getUint32( 0, true ); // magic

			bufferDataView.getUint8( 4, true ); // versionByteZero

			bufferDataView.getUint8( 5, true ); // fullMask
			// start of header

			var offset = {
				value: 8
			}; // start at 8, after magic stuff

			var keepReading = true;

			while ( keepReading ) {

				var attributeName = parseNullTerminatedString( buffer, offset );

				if ( attributeName == 0 ) {

					keepReading = false;

				} else {

					var attributeType = parseNullTerminatedString( buffer, offset );
					var attributeSize = parseUint32( bufferDataView, offset );
					var attributeValue = parseValue( bufferDataView, buffer, offset, attributeType, attributeSize );

					if ( attributeValue === undefined ) {

						console.warn( `EXRLoader.parse: skipped unknown header attribute type \'${attributeType}\'.` );

					} else {

						EXRHeader[ attributeName ] = attributeValue;

					}

				}

			} // offsets


			var dataWindowHeight = EXRHeader.dataWindow.yMax + 1;
			var uncompress;
			var scanlineBlockSize;

			switch ( EXRHeader.compression ) {

				case 'NO_COMPRESSION':
					scanlineBlockSize = 1;
					uncompress = uncompressRAW;
					break;

				case 'RLE_COMPRESSION':
					scanlineBlockSize = 1;
					uncompress = uncompressRLE;
					break;

				case 'ZIPS_COMPRESSION':
					scanlineBlockSize = 1;
					uncompress = uncompressZIP;
					break;

				case 'ZIP_COMPRESSION':
					scanlineBlockSize = 16;
					uncompress = uncompressZIP;
					break;

				case 'PIZ_COMPRESSION':
					scanlineBlockSize = 32;
					uncompress = uncompressPIZ;
					break;

				case 'PXR24_COMPRESSION':
					scanlineBlockSize = 16;
					uncompress = uncompressPXR;
					break;

				case 'DWAA_COMPRESSION':
					scanlineBlockSize = 32;
					uncompress = uncompressDWA;
					break;

				case 'DWAB_COMPRESSION':
					scanlineBlockSize = 256;
					uncompress = uncompressDWA;
					break;

				default:
					throw 'EXRLoader.parse: ' + EXRHeader.compression + ' is unsupported';

			}

			var size_t;
			var getValue; // mixed pixelType not supported

			var pixelType = EXRHeader.channels[ 0 ].pixelType;

			if ( pixelType === 1 ) {

				// half
				switch ( this.type ) {

					case THREE.UnsignedByteType:
					case THREE.FloatType:
						getValue = parseFloat16;
						size_t = INT16_SIZE;
						break;

					case THREE.HalfFloatType:
						getValue = parseUint16;
						size_t = INT16_SIZE;
						break;

				}

			} else if ( pixelType === 2 ) {

				// float
				switch ( this.type ) {

					case THREE.UnsignedByteType:
					case THREE.FloatType:
						getValue = parseFloat32;
						size_t = FLOAT32_SIZE;
						break;

					case THREE.HalfFloatType:
						getValue = decodeFloat32;
						size_t = FLOAT32_SIZE;

				}

			} else {

				throw 'EXRLoader.parse: unsupported pixelType ' + pixelType + ' for ' + EXRHeader.compression + '.';

			}

			var numBlocks = dataWindowHeight / scanlineBlockSize;

			for ( var i = 0; i < numBlocks; i ++ ) {

				parseUlong( bufferDataView, offset ); // scanlineOffset

			} // we should be passed the scanline offset table, start reading pixel data


			var width = EXRHeader.dataWindow.xMax - EXRHeader.dataWindow.xMin + 1;
			var height = EXRHeader.dataWindow.yMax - EXRHeader.dataWindow.yMin + 1; // Firefox only supports RGBA (half) float textures
			// var numChannels = EXRHeader.channels.length;

			var numChannels = 4;
			var size = width * height * numChannels; // Fill initially with 1s for the alpha value if the texture is not RGBA, RGB values will be overwritten

			switch ( this.type ) {

				case THREE.UnsignedByteType:
				case THREE.FloatType:
					var byteArray = new Float32Array( size );

					if ( EXRHeader.channels.length < numChannels ) {

						byteArray.fill( 1, 0, size );

					}

					break;

				case THREE.HalfFloatType:
					var byteArray = new Uint16Array( size );

					if ( EXRHeader.channels.length < numChannels ) {

						byteArray.fill( 0x3C00, 0, size ); // Uint16Array holds half float data, 0x3C00 is 1

					}

					break;

				default:
					console.error( 'THREE.EXRLoader: unsupported type: ', this.type );
					break;

			}

			var channelOffsets = {
				R: 0,
				G: 1,
				B: 2,
				A: 3
			};
			var compressionInfo = {
				size: 0,
				width: width,
				lines: scanlineBlockSize,
				offset: offset,
				array: uInt8Array,
				viewer: bufferDataView,
				type: pixelType,
				channels: EXRHeader.channels.length
			};
			var line;
			var size;
			var viewer;
			var tmpOffset = {
				value: 0
			};

			for ( var scanlineBlockIdx = 0; scanlineBlockIdx < height / scanlineBlockSize; scanlineBlockIdx ++ ) {

				line = parseUint32( bufferDataView, offset ); // line_no

				size = parseUint32( bufferDataView, offset ); // data_len

				compressionInfo.lines = line + scanlineBlockSize > height ? height - line : scanlineBlockSize;
				compressionInfo.offset = offset;
				compressionInfo.size = size;
				viewer = uncompress( compressionInfo );
				offset.value += size;

				for ( var line_y = 0; line_y < scanlineBlockSize; line_y ++ ) {

					var true_y = line_y + scanlineBlockIdx * scanlineBlockSize;
					if ( true_y >= height ) break;

					for ( var channelID = 0; channelID < EXRHeader.channels.length; channelID ++ ) {

						var cOff = channelOffsets[ EXRHeader.channels[ channelID ].name ];

						for ( var x = 0; x < width; x ++ ) {

							var idx = line_y * ( EXRHeader.channels.length * width ) + channelID * width + x;
							tmpOffset.value = idx * size_t;
							var val = getValue( viewer, tmpOffset );
							byteArray[ ( height - 1 - true_y ) * ( width * numChannels ) + x * numChannels + cOff ] = val;

						}

					}

				}

			}

			if ( this.type === THREE.UnsignedByteType ) {

				let v, i;
				const size = byteArray.length;
				const RGBEArray = new Uint8Array( size );

				for ( let h = 0; h < height; ++ h ) {

					for ( let w = 0; w < width; ++ w ) {

						i = h * width * 4 + w * 4;
						const red = byteArray[ i ];
						const green = byteArray[ i + 1 ];
						const blue = byteArray[ i + 2 ];
						v = red > green ? red : green;
						v = blue > v ? blue : v;

						if ( v < 1e-32 ) {

							RGBEArray[ i ] = RGBEArray[ i + 1 ] = RGBEArray[ i + 2 ] = RGBEArray[ i + 3 ] = 0;

						} else {

							const res = frexp( v );
							v = res[ 0 ] * 256 / v;
							RGBEArray[ i ] = red * v;
							RGBEArray[ i + 1 ] = green * v;
							RGBEArray[ i + 2 ] = blue * v;
							RGBEArray[ i + 3 ] = res[ 1 ] + 128;

						}

					}

				}

				byteArray = RGBEArray;

			}

			const format = this.type === THREE.UnsignedByteType ? THREE.RGBEFormat : numChannels === 4 ? THREE.RGBAFormat : THREE.RGBFormat;
			return {
				header: EXRHeader,
				width: width,
				height: height,
				data: byteArray,
				format: format,
				type: this.type
			};

		}

		setDataType( value ) {

			this.type = value;
			return this;

		}

		load( url, onLoad, onProgress, onError ) {

			function onLoadCallback( texture, texData ) {

				switch ( texture.type ) {

					case THREE.UnsignedByteType:
						texture.encoding = THREE.RGBEEncoding;
						texture.minFilter = THREE.NearestFilter;
						texture.magFilter = THREE.NearestFilter;
						texture.generateMipmaps = false;
						texture.flipY = false;
						break;

					case THREE.FloatType:
					case THREE.HalfFloatType:
						texture.encoding = THREE.LinearEncoding;
						texture.minFilter = THREE.LinearFilter;
						texture.magFilter = THREE.LinearFilter;
						texture.generateMipmaps = false;
						texture.flipY = false;
						break;

				}

				if ( onLoad ) onLoad( texture, texData );

			}

			return super.load( url, onLoadCallback, onProgress, onError );

		}

	}

	THREE.EXRLoader = EXRLoader;

} )();
( function () {

	class FontLoader extends THREE.Loader {

		constructor( manager ) {

			super( manager );

		}

		load( url, onLoad, onProgress, onError ) {

			const scope = this;
			const loader = new THREE.FileLoader( this.manager );
			loader.setPath( this.path );
			loader.setRequestHeader( this.requestHeader );
			loader.setWithCredentials( scope.withCredentials );
			loader.load( url, function ( text ) {

				let json;

				try {

					json = JSON.parse( text );

				} catch ( e ) {

					console.warn( 'THREE.FontLoader: typeface.js support is being deprecated. Use typeface.json instead.' );
					json = JSON.parse( text.substring( 65, text.length - 2 ) );

				}

				const font = scope.parse( json );
				if ( onLoad ) onLoad( font );

			}, onProgress, onError );

		}

		parse( json ) {

			return new Font( json );

		}

	} //


	class Font {

		constructor( data ) {

			this.type = 'Font';
			this.data = data;

		}

		generateShapes( text, size = 100 ) {

			const shapes = [];
			const paths = createPaths( text, size, this.data );

			for ( let p = 0, pl = paths.length; p < pl; p ++ ) {

				Array.prototype.push.apply( shapes, paths[ p ].toShapes() );

			}

			return shapes;

		}

	}

	function createPaths( text, size, data ) {

		const chars = Array.from( text );
		const scale = size / data.resolution;
		const line_height = ( data.boundingBox.yMax - data.boundingBox.yMin + data.underlineThickness ) * scale;
		const paths = [];
		let offsetX = 0,
			offsetY = 0;

		for ( let i = 0; i < chars.length; i ++ ) {

			const char = chars[ i ];

			if ( char === '\n' ) {

				offsetX = 0;
				offsetY -= line_height;

			} else {

				const ret = createPath( char, scale, offsetX, offsetY, data );
				offsetX += ret.offsetX;
				paths.push( ret.path );

			}

		}

		return paths;

	}

	function createPath( char, scale, offsetX, offsetY, data ) {

		const glyph = data.glyphs[ char ] || data.glyphs[ '?' ];

		if ( ! glyph ) {

			console.error( 'THREE.Font: character "' + char + '" does not exists in font family ' + data.familyName + '.' );
			return;

		}

		const path = new THREE.ShapePath();
		let x, y, cpx, cpy, cpx1, cpy1, cpx2, cpy2;

		if ( glyph.o ) {

			const outline = glyph._cachedOutline || ( glyph._cachedOutline = glyph.o.split( ' ' ) );

			for ( let i = 0, l = outline.length; i < l; ) {

				const action = outline[ i ++ ];

				switch ( action ) {

					case 'm':
						// moveTo
						x = outline[ i ++ ] * scale + offsetX;
						y = outline[ i ++ ] * scale + offsetY;
						path.moveTo( x, y );
						break;

					case 'l':
						// lineTo
						x = outline[ i ++ ] * scale + offsetX;
						y = outline[ i ++ ] * scale + offsetY;
						path.lineTo( x, y );
						break;

					case 'q':
						// quadraticCurveTo
						cpx = outline[ i ++ ] * scale + offsetX;
						cpy = outline[ i ++ ] * scale + offsetY;
						cpx1 = outline[ i ++ ] * scale + offsetX;
						cpy1 = outline[ i ++ ] * scale + offsetY;
						path.quadraticCurveTo( cpx1, cpy1, cpx, cpy );
						break;

					case 'b':
						// bezierCurveTo
						cpx = outline[ i ++ ] * scale + offsetX;
						cpy = outline[ i ++ ] * scale + offsetY;
						cpx1 = outline[ i ++ ] * scale + offsetX;
						cpy1 = outline[ i ++ ] * scale + offsetY;
						cpx2 = outline[ i ++ ] * scale + offsetX;
						cpy2 = outline[ i ++ ] * scale + offsetY;
						path.bezierCurveTo( cpx1, cpy1, cpx2, cpy2, cpx, cpy );
						break;

				}

			}

		}

		return {
			offsetX: glyph.ha * scale,
			path: path
		};

	}

	Font.prototype.isFont = true;

	THREE.Font = Font;
	THREE.FontLoader = FontLoader;

} )();
( function () {

	/**
 * Text = 3D Text
 *
 * parameters = {
 *  font: <THREE.Font>, // font
 *
 *  size: <float>, // size of the text
 *  height: <float>, // thickness to extrude text
 *  curveSegments: <int>, // number of points on the curves
 *
 *  bevelEnabled: <bool>, // turn on bevel
 *  bevelThickness: <float>, // how deep into text bevel goes
 *  bevelSize: <float>, // how far from text outline (including bevelOffset) is bevel
 *  bevelOffset: <float> // how far from text outline does bevel start
 * }
 */

	class TextGeometry extends THREE.ExtrudeGeometry {

		constructor( text, parameters = {} ) {

			const font = parameters.font;

			if ( ! ( font && font.isFont ) ) {

				console.error( 'THREE.TextGeometry: font parameter is not an instance of THREE.Font.' );
				return new THREE.BufferGeometry();

			}

			const shapes = font.generateShapes( text, parameters.size ); // translate parameters to THREE.ExtrudeGeometry API

			parameters.depth = parameters.height !== undefined ? parameters.height : 50; // defaults

			if ( parameters.bevelThickness === undefined ) parameters.bevelThickness = 10;
			if ( parameters.bevelSize === undefined ) parameters.bevelSize = 8;
			if ( parameters.bevelEnabled === undefined ) parameters.bevelEnabled = false;
			super( shapes, parameters );
			this.type = 'TextGeometry';

		}

	}

	THREE.TextGeometry = TextGeometry;

} )();
( function () {

	/**
 * @author Deepkolos / https://github.com/deepkolos
 */
	class WorkerPool {

		constructor( pool = 4 ) {

			this.pool = pool;
			this.queue = [];
			this.workers = [];
			this.workersResolve = [];
			this.workerStatus = 0;

		}

		_initWorker( workerId ) {

			if ( ! this.workers[ workerId ] ) {

				const worker = this.workerCreator();
				worker.addEventListener( 'message', this._onMessage.bind( this, workerId ) );
				this.workers[ workerId ] = worker;

			}

		}

		_getIdleWorker() {

			for ( let i = 0; i < this.pool; i ++ ) if ( ! ( this.workerStatus & 1 << i ) ) return i;

			return - 1;

		}

		_onMessage( workerId, msg ) {

			const resolve = this.workersResolve[ workerId ];
			resolve && resolve( msg );

			if ( this.queue.length ) {

				const {
					resolve,
					msg,
					transfer
				} = this.queue.shift();
				this.workersResolve[ workerId ] = resolve;
				this.workers[ workerId ].postMessage( msg, transfer );

			} else {

				this.workerStatus ^= 1 << workerId;

			}

		}

		setWorkerCreator( workerCreator ) {

			this.workerCreator = workerCreator;

		}

		setWorkerLimit( pool ) {

			this.pool = pool;

		}

		postMessage( msg, transfer ) {

			return new Promise( resolve => {

				const workerId = this._getIdleWorker();

				if ( workerId !== - 1 ) {

					this._initWorker( workerId );

					this.workerStatus |= 1 << workerId;
					this.workersResolve[ workerId ] = resolve;
					this.workers[ workerId ].postMessage( msg, transfer );

				} else {

					this.queue.push( {
						resolve,
						msg,
						transfer
					} );

				}

			} );

		}

		dispose() {

			this.workers.forEach( worker => worker.terminate() );
			this.workersResolve.length = 0;
			this.workers.length = 0;
			this.queue.length = 0;
			this.workerStatus = 0;

		}

	}

	THREE.WorkerPool = WorkerPool;

} )();
