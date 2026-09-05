import * as BufferGeometryUtils from '../../node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from '../../node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import { EXRLoader } from '../../node_modules/three/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from '../../node_modules/three/examples/jsm/loaders/RGBELoader.js';
import { FontLoader, Font } from '../../node_modules/three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from '../../node_modules/three/examples/jsm/geometries/TextGeometry.js';
import { SimplexNoise } from '../../node_modules/three/examples/jsm/math/SimplexNoise.js';
import { WorkerPool } from '../../node_modules/three/examples/jsm/utils/WorkerPool.js';
import { BasisTextureLoader } from '../addons/BasisTextureLoader.js';
import { Line2 } from '../../node_modules/three/examples/jsm/lines/Line2.js';
import { LineGeometry } from '../../node_modules/three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from '../../node_modules/three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from '../../node_modules/three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from '../../node_modules/three/examples/jsm/lines/LineSegmentsGeometry.js';

// plain-object copy of the namespace so we can add a back-compat alias
const bgu = Object.assign({}, BufferGeometryUtils);
bgu.mergeBufferGeometries = BufferGeometryUtils.mergeGeometries; // pre-r151 name, kept for content compat
bgu.mergeBufferAttributes = BufferGeometryUtils.mergeAttributes;
Object.assign(globalThis.THREE, { BufferGeometryUtils: bgu, GLTFExporter, EXRLoader, RGBELoader, FontLoader, Font, TextGeometry, SimplexNoise, WorkerPool, BasisTextureLoader, Line2, LineGeometry, LineMaterial, LineSegments2, LineSegmentsGeometry });
