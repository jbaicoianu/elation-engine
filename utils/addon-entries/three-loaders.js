import { ColladaLoader } from '../../node_modules/three/examples/jsm/loaders/ColladaLoader.js';
import { FBXLoader } from '../../node_modules/three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from '../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from '../../node_modules/three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from '../../node_modules/three/examples/jsm/loaders/MTLLoader.js';
import { PLYLoader } from '../../node_modules/three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from '../../node_modules/three/examples/jsm/loaders/STLLoader.js';
import { DRACOLoader } from '../../node_modules/three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from '../../node_modules/three/examples/jsm/loaders/KTX2Loader.js';
import { DDSLoader } from '../../node_modules/three/examples/jsm/loaders/DDSLoader.js';
import { MeshoptDecoder } from '../../node_modules/three/examples/jsm/libs/meshopt_decoder.module.js';
globalThis.MeshoptDecoder = MeshoptDecoder; // bare global, as consumed by engine.assets loadglTF
Object.assign(globalThis.THREE, { ColladaLoader, FBXLoader, GLTFLoader, OBJLoader, MTLLoader, PLYLoader, STLLoader, DRACOLoader, KTX2Loader, DDSLoader });
