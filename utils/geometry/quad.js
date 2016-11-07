'use strict';

module.exports = function () {
  let positions = [
    -0.5,  0.5, 0, // top-left
     0.5,  0.5, 0, // top-right
     0.5, -0.5, 0, // bottom-right
    -0.5, -0.5, 0, // bottom-left
  ];

  let normals = [
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ];

  let uvs = [
    0, 0,
    1, 0,
    1, 1,
    0, 1,
  ];

  let indices = [
    0, 1, 3,
    1, 2, 3
  ];

  return {
    positions: positions,
    indices: indices,
    normals: normals,
    uvs: uvs,
  };
};
