// Local addition carried over from the old vendored three-objects bundle:
// SkeletonUtils.clone() plus renaming of animation track targets so clips
// authored against the source hierarchy drive the cloned one.
import { clone } from '../../node_modules/three/examples/jsm/utils/SkeletonUtils.js';

export function cloneWithAnimations( source, animations ) {

	const cloned = clone( source );

	if ( animations ) {

		// source and clone have identical structure; walk them in parallel to
		// build the node mapping (upstream clone() doesn't expose its lookup)
		const pairs = [];
		( function walk( a, b ) {

			pairs.push( [ a, b ] );
			for ( let i = 0; i < a.children.length; i ++ ) walk( a.children[ i ], b.children[ i ] );

		} )( source, cloned );

		animations.forEach( anim => {

			anim.tracks.forEach( track => {

				const parts = track.name.split( '.' );
				pairs.forEach( ( [ src, dst ] ) => {

					if ( parts[ 0 ] == src.name || parts[ 0 ] == src.uuid ) {

						parts[ 0 ] = dst.name || dst.uuid;
						track.name = parts.join( '.' );

					} else if ( parts[ 0 ].indexOf( ':' ) > - 1 ) {

						const parts2 = parts[ 0 ].split( ':' );
						if ( parts2[ 1 ] == src.name || parts2[ 1 ] == src.uuid ) {

							parts[ 0 ] = dst.name || dst.uuid;
							track.name = parts.join( '.' );

						}

					}

				} );

			} );

		} );

	}

	return cloned;

}
