// Entry point for the three.js vendor prebundle. See utils/build-three.sh.
// ES module namespace objects are non-extensible; spread into a plain object
// so satellite addons and app code can keep attaching to THREE.*
import * as three from 'three';
globalThis.THREE = Object.assign({}, three);
