function EulerDegrees(x, y, z, order) {
  this.radians = new THREE.Euler();
  if (x instanceof THREE.Euler) {
    this.copy(x);
  } else if (x instanceof THREE.Vector3) {
    this.set(x.x, x.y, x.z);
  } else {
    this.set(x, y, z, order);
  }
}
EulerDegrees.prototype = Object.assign( Object.create( THREE.Euler.prototype ), {
  isEuler: true,
});
Object.defineProperties(EulerDegrees.prototype, {
  x: {
    enumerable: true,
    configurable: true,
    set: function(x) { this.radians.x = x * THREE.Math.DEG2RAD; },
    get: function() { return this.radians.x * THREE.Math.RAD2DEG; }
  },
  y: {
    enumerable: true,
    configurable: true,
    set: function(y) { this.radians.y = y * THREE.Math.DEG2RAD; },
    get: function() { return this.radians.y * THREE.Math.RAD2DEG; }
  },
  z: {
    enumerable: true,
    configurable: true,
    set: function(z) { this.radians.z = z * THREE.Math.DEG2RAD; },
    get: function() { return this.radians.z * THREE.Math.RAD2DEG; }
  },
  order: {
    enumerable: true,
    configurable: true,
    set: function(order) { this.radians.order = order; },
    get: function() { return this.radians.order; }
  },
});

EulerDegrees.prototype.set = function ( x, y, z, order ) {
  this.x = x;
  this.y = y;
  this.z = z;
  if (order) this.order = order;
  return this;
}
EulerDegrees.prototype.copy = function ( euler ) {
  this.x = euler.x;
  this.y = euler.y;
  this.z = euler.z;
  this.order = euler.order;
  return this;
}
EulerDegrees.prototype.clone = function () {
  return new EulerDegrees().copy(this);
}
EulerDegrees.prototype.toArray = function() {
  return [this.x, this.y, this.z, this.radians.order];
};
