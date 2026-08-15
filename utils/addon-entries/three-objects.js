import { Reflector } from '../../node_modules/three/examples/jsm/objects/Reflector.js';
import * as SkeletonUtils from '../../node_modules/three/examples/jsm/utils/SkeletonUtils.js';
import { cloneWithAnimations } from '../addons/SkeletonUtilsExtra.js';
Object.assign(globalThis.THREE, { Reflector, SkeletonUtils: Object.assign({ cloneWithAnimations }, SkeletonUtils) });
