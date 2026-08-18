import * as ICOSA from 'three-icosa';

// three-icosa 0.4.2-alpha.18's beforeRoot() assumes json.materials exists and
// runs even for non-TiltBrush glTFs, throwing on ordinary models. Guard it so
// the extension is inert unless the file actually is a TiltBrush export.
class GLTFGoogleTiltBrushMaterialExtension extends ICOSA.GLTFGoogleTiltBrushMaterialExtension {
  beforeRoot() {
    const json = this.parser.json;
    if (!Array.isArray(json.materials) || !this.isTiltGltf(json)) return null;
    return super.beforeRoot();
  }
  afterRoot(glTF) {
    // upstream 0.4.2-alpha.18 ships this guard commented out, so it processes
    // (and can replace) materials in every glTF - including avatars and world
    // geometry with generic material_/ob- names
    if (!this.isTiltGltf(this.parser.json)) return null;
    return super.afterRoot(glTF);
  }
}

Object.assign(globalThis.THREE, ICOSA, { GLTFGoogleTiltBrushMaterialExtension });
