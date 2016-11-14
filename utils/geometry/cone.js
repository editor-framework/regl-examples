'use strict';

const cylinder = require('./cylinder');

module.exports = function ( radius, height, opts ) {
  return cylinder( 0, radius, height, opts );
};
