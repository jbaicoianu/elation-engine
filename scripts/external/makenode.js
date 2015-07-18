#!/usr/bin/env node

var concat = require('concatenate-files'),
    fs     = require('fs');

concat(['./three/shimthree.js', './three/three.js'], './three/nodethree.js', function(err, res) {
  if (err) { console.log('PROBLEM MERGING: ', err); }
  else {
    fs.appendFile('./three/nodethree.js', 'global.THREE = THREE;\r\n', function(err) {
      if (err) { console.log(err) }
    });
  }
});