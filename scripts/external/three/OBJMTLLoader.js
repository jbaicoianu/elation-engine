/**
 * Loads a Wavefront .obj file with materials
 *
 * @author mrdoob / http://mrdoob.com/
 * @author angelxuanchang
 */

THREE.OBJMTLLoader = function ( manager ) {

	this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

};

THREE.OBJMTLLoader.prototype = {

	constructor: THREE.OBJMTLLoader,

	load: function ( url, mtlurl, onLoad, onProgress, onError ) {

		var scope = this;

		var mtlLoader = new THREE.MTLLoader( this.manager );
		mtlLoader.setBaseUrl( url.substr( 0, url.lastIndexOf( "/" ) + 1 ) );
		mtlLoader.setCrossOrigin( this.crossOrigin );
		mtlLoader.load( mtlurl, function ( materials ) {

			var materialsCreator = materials;
			materialsCreator.preload();

			var loader = new THREE.XHRLoader( scope.manager );
			//loader.setCrossOrigin( scope.crossOrigin );
			loader.load( url, function ( text ) {

				var object = scope.parse( text );

				object.traverse( function ( object ) {

					if ( object instanceof THREE.Mesh ) {

						if ( object.material.name ) {

							var material = materialsCreator.create( object.material.name );

							if ( material ) object.material = material;

						}

					}

				} );

				onLoad( object );

			}, onProgress, onError );

		}, onProgress, onError );

	},

	setCrossOrigin: function ( value ) {

		this.crossOrigin = value;

	},

	/**
	 * Parses loaded .obj file
	 * @param data - content of .obj file
	 * @param mtllibCallback - callback to handle mtllib declaration (optional)
	 * @return {THREE.Object3D} - Object3D (with default material)
	 */

	parse: function ( data, mtllibCallback ) {

		var material_offset = 0;

		function vector( x, y, z ) {

			return new THREE.Vector3( x, y, z );

		}

		function uv( u, v ) {

			return new THREE.Vector2( u, v );

		}

		function face3( a, b, c, normals ) {

			return new THREE.Face3( a, b, c, normals, undefined, material_offset );

		}

		var face_offset = 0;

		function meshN( meshName, materialName ) {

			if ( vertices.length > 0 ) {

				geometry.vertices = vertices;

				geometry.mergeVertices();
				geometry.computeFaceNormals();
				geometry.computeBoundingSphere();

/*
if (geometry.faceVertexUvs[0]) {
  for (var i = 0; i < geometry.faces.length; i++) {
    if (!geometry.faceVertexUvs[0][i]) {
      geometry.faceVertexUvs[0][i] = [
        new THREE.Vector2(0,0),
        new THREE.Vector2(1,0),
        new THREE.Vector2(0,1)
      ];
    }
  }
}
*/

				object.add( mesh );

				geometry = new THREE.Geometry();
				mesh = new THREE.Mesh( geometry, material );

        material_offset = 0;

			}

			if ( meshName !== undefined ) mesh.name = meshName;

			if ( materialName !== undefined ) {

				material = new THREE.MeshLambertMaterial();
				material.name = materialName;

				mesh.material = material;

			}

		}

    function materialN(materialName) {
      var materials = [];
      if (!(mesh.material instanceof THREE.MeshFaceMaterial)) {
        materials[0] = mesh.material;
        mesh.material = new THREE.MeshFaceMaterial(materials);
      } else {
        materials = mesh.material.materials;
      }

			if ( materialName !== undefined ) {

				material = new THREE.MeshLambertMaterial();
				material.name = materialName;

				materials.push(material);

        material_offset = materials.length - 1;

			}
  
    } 

		var group = new THREE.Group();
		var object = group;

		var geometry = new THREE.Geometry();
		var material = new THREE.MeshLambertMaterial();
		var mesh = new THREE.Mesh( geometry, material );

		var vertices = [];
		var normals = [];
		var uvs = [];

		function add_face( a, b, c, normals_inds ) {

      var facenormals = false;

			if ( normals_inds !== undefined ) {

          var faceindexes = [
              parseInt( normals_inds[ 0 ] ) - 1,
              parseInt( normals_inds[ 1 ] ) - 1,
              parseInt( normals_inds[ 2 ] ) - 1
          ];
          if (normals[faceindexes[0]] && normals[faceindexes[1]] && normals[faceindexes[2]]) {
              facenormals = [
                  normals[ faceindexes[0] ].clone(),
                  normals[ faceindexes[1] ].clone(),
                  normals[ faceindexes[2] ].clone()
              ];
          }
      }
      if ( !facenormals ) {

				geometry.faces.push( face3(
					parseInt( a ) - ( face_offset + 1 ),
					parseInt( b ) - ( face_offset + 1 ),
					parseInt( c ) - ( face_offset + 1 )
				) );

			} else {

				geometry.faces.push( face3(
					parseInt( a ) - ( face_offset + 1 ),
					parseInt( b ) - ( face_offset + 1 ),
					parseInt( c ) - ( face_offset + 1 ),
          facenormals
				) );

			}

		}

		function add_uvs( a, b, c ) {

			geometry.faceVertexUvs[ 0 ].push( [
				uvs[ parseInt( a ) - 1 ].clone(),
				uvs[ parseInt( b ) - 1 ].clone(),
				uvs[ parseInt( c ) - 1 ].clone()
			] );
/*
			geometry.faceVertexUvs[ 0 ][geometry.faces.length-1] = [
				uvs[ parseInt( a ) - 1 ].clone(),
				uvs[ parseInt( b ) - 1 ].clone(),
				uvs[ parseInt( c ) - 1 ].clone()
			];
*/

		}

		function handle_face_line( faces, uvs, normals_inds ) {

			if ( faces[ 3 ] === undefined ) {

				add_face( faces[ 0 ], faces[ 1 ], faces[ 2 ], normals_inds );

				if ( ! ( uvs === undefined ) && uvs.length > 0 ) {

					add_uvs( uvs[ 0 ], uvs[ 1 ], uvs[ 2 ] );

				} else {
				//	add_uvs( 1, 2, 3 );
        }

			} else {

				if ( ! ( normals_inds === undefined ) && normals_inds.length > 0 ) {

					add_face( faces[ 0 ], faces[ 1 ], faces[ 3 ], [ normals_inds[ 0 ], normals_inds[ 1 ], normals_inds[ 3 ] ] );
					add_face( faces[ 1 ], faces[ 2 ], faces[ 3 ], [ normals_inds[ 1 ], normals_inds[ 2 ], normals_inds[ 3 ] ] );

				} else {

					add_face( faces[ 0 ], faces[ 1 ], faces[ 3 ] );
					add_face( faces[ 1 ], faces[ 2 ], faces[ 3 ] );

				}

				if ( ! ( uvs === undefined ) && uvs.length > 0 ) {

					add_uvs( uvs[ 0 ], uvs[ 1 ], uvs[ 3 ] );
					add_uvs( uvs[ 1 ], uvs[ 2 ], uvs[ 3 ] );

				} else {
					//add_uvs( 1, 2, 3 );
					//add_uvs( 2, 3, 4 );
				}

			}

		}


		// v float float float

		var vertex_pattern = /v( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

		// vn float float float

		var normal_pattern = /vn( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

		// vt float float

		var uv_pattern = /vt( +[\d|\.|\+|\-|e|E]+)( +[\d|\.|\+|\-|e|E]+)/;

		// f vertex vertex vertex ...

		var face_pattern1 = /f( +\d+)( +\d+)( +\d+)( +\d+)?/;

		// f vertex/uv vertex/uv vertex/uv ...

		var face_pattern2 = /f( +(\d+)\/(\d+))( +(\d+)\/(\d+))( +(\d+)\/(\d+))( +(\d+)\/(\d+))?/;

		// f vertex/uv/normal vertex/uv/normal vertex/uv/normal ...

		var face_pattern3 = /f( +(\d+)\/(\d+)\/(\d+))( +(\d+)\/(\d+)\/(\d+))( +(\d+)\/(\d+)\/(\d+))( +(\d+)\/(\d+)\/(\d+))?/;

		// f vertex//normal vertex//normal vertex//normal ...

		var face_pattern4 = /f( +(\d+)\/\/(\d+))( +(\d+)\/\/(\d+))( +(\d+)\/\/(\d+))( +(\d+)\/\/(\d+))?/;

		//

		var lines = data.split( "\n" );

		for ( var i = 0; i < lines.length; i ++ ) {

			var line = lines[ i ];
			line = line.trim();

			var result;

			if ( line.length === 0 || line.charAt( 0 ) === '#' ) {

				continue;

			} else if ( ( result = vertex_pattern.exec( line ) ) !== null ) {

				// ["v 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

				vertices.push( vector(
					parseFloat( result[ 1 ] ),
					parseFloat( result[ 2 ] ),
					parseFloat( result[ 3 ] )
				) );

			} else if ( ( result = normal_pattern.exec( line ) ) !== null ) {

				// ["vn 1.0 2.0 3.0", "1.0", "2.0", "3.0"]

				normals.push( vector(
					parseFloat( result[ 1 ] ),
					parseFloat( result[ 2 ] ),
					parseFloat( result[ 3 ] )
				) );

			} else if ( ( result = uv_pattern.exec( line ) ) !== null ) {

				// ["vt 0.1 0.2", "0.1", "0.2"]

				uvs.push( uv(
					parseFloat( result[ 1 ] ),
					parseFloat( result[ 2 ] )
				) );

			} else if ( ( result = face_pattern1.exec( line ) ) !== null ) {

				// ["f 1 2 3", "1", "2", "3", undefined]

				handle_face_line( [ result[ 1 ], result[ 2 ], result[ 3 ], result[ 4 ] ] );

			} else if ( ( result = face_pattern2.exec( line ) ) !== null ) {

				// ["f 1/1 2/2 3/3", " 1/1", "1", "1", " 2/2", "2", "2", " 3/3", "3", "3", undefined, undefined, undefined]

				handle_face_line(
					[ result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ] ], //faces
					[ result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ] ] //uv
				);

			} else if ( ( result = face_pattern3.exec( line ) ) !== null ) {

				// ["f 1/1/1 2/2/2 3/3/3", " 1/1/1", "1", "1", "1", " 2/2/2", "2", "2", "2", " 3/3/3", "3", "3", "3", undefined, undefined, undefined, undefined]

				handle_face_line(
					[ result[ 2 ], result[ 6 ], result[ 10 ], result[ 14 ] ], //faces
					[ result[ 3 ], result[ 7 ], result[ 11 ], result[ 15 ] ], //uv
					[ result[ 4 ], result[ 8 ], result[ 12 ], result[ 16 ] ] //normal
				);

			} else if ( ( result = face_pattern4.exec( line ) ) !== null ) {

				// ["f 1//1 2//2 3//3", " 1//1", "1", "1", " 2//2", "2", "2", " 3//3", "3", "3", undefined, undefined, undefined]

				handle_face_line(
					[ result[ 2 ], result[ 5 ], result[ 8 ], result[ 11 ] ], //faces
					[ ], //uv
					[ result[ 3 ], result[ 6 ], result[ 9 ], result[ 12 ] ] //normal
				);

			} else if ( /^o /.test( line ) ) {

				// object

				meshN();
				face_offset = face_offset + vertices.length;
				vertices = [];
				object = new THREE.Object3D();
				object.name = line.substring( 2 ).trim();
				group.add( object );

			} else if ( /^g /.test( line ) ) {

				// group

				meshN( line.substring( 2 ).trim(), undefined );

			} else if ( /^usemtl /.test( line ) ) {

				// material

				//meshN( undefined, line.substring( 7 ).trim() );
				materialN( line.substring( 7 ).trim() );

			} else if ( /^mtllib /.test( line ) ) {

				// mtl file

				if ( mtllibCallback ) {

					var mtlfile = line.substring( 7 );
					mtlfile = mtlfile.trim();
					mtllibCallback( mtlfile );

				}

			} else if ( /^s /.test( line ) ) {

				// Smooth shading

			} else {

				console.log( "THREE.OBJMTLLoader: Unhandled line " + line );

			}

		}

		//Add last object
		meshN( undefined, undefined );

		return group;

	}

};

THREE.EventDispatcher.prototype.apply( THREE.OBJMTLLoader.prototype );
