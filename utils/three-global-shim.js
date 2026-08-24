// esbuild alias target: addon bundles resolve `import ... from 'three'` to the
// already-defined global THREE from the core prebundle, so addon classes share
// the same class identities (instanceof-coherent, no duplicate three).
module.exports = globalThis.THREE;
