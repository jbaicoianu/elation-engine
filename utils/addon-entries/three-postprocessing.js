import { EffectComposer } from '../../node_modules/three/examples/jsm/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from '../../node_modules/three/examples/jsm/postprocessing/Pass.js';
import { RenderPass } from '../../node_modules/three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from '../../node_modules/three/examples/jsm/postprocessing/ShaderPass.js';
import { MaskPass, ClearMaskPass } from '../../node_modules/three/examples/jsm/postprocessing/MaskPass.js';
import { ClearPass } from '../../node_modules/three/examples/jsm/postprocessing/ClearPass.js';
import { BloomPass } from '../../node_modules/three/examples/jsm/postprocessing/BloomPass.js';
import { UnrealBloomPass } from '../../node_modules/three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from '../../node_modules/three/examples/jsm/postprocessing/SSAOPass.js';
import { OutputPass } from '../../node_modules/three/examples/jsm/postprocessing/OutputPass.js';
Pass.FullScreenQuad = FullScreenQuad; // pre-jsm attachment point, kept for compat
Object.assign(globalThis.THREE, { EffectComposer, Pass, FullScreenQuad, RenderPass, ShaderPass, MaskPass, ClearMaskPass, ClearPass, BloomPass, UnrealBloomPass, SSAOPass, OutputPass });
