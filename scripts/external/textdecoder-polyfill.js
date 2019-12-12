if (typeof TextDecoder == 'undefined') {
  function TextDecoder(encoding) {
    this.decode = function(data) {
      let decoded = '';
      let bytes = data;
      if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      }
      for (let i = 0; i < bytes.length; i++) {
        decoded += String.fromCharCode(bytes[i]);
      }
      return decoded;
    };
  };
}
