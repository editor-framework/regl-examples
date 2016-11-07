'use strict';

function v3_lerp (a, b, alpha) {
  return [
    a[0] + alpha * (b[0] - a[0]),
    a[1] + alpha * (b[1] - a[1]),
    a[2] + alpha * (b[2] - a[2]),
  ];
}

function v3_sub (a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ];
}

function v3_add (a, b) {
  return [
    a[0] + b[0],
    a[1] + b[1],
    a[2] + b[2],
  ];
}

module.exports = function (width, height, length, opts) {
  opts = opts || {};

  let ws = opts.widthSegments !== undefined ? opts.widthSegments : 1;
  let hs = opts.heightSegments !== undefined ? opts.heightSegments : 1;
  let ls = opts.lengthSegments !== undefined ? opts.lengthSegments : 1;

  let hw = width * 0.5;
  let hh = height * 0.5;
  let hl = length * 0.5;

  let corners = [
    [-hw, -hh,  hl],
    [ hw, -hh,  hl],
    [ hw,  hh,  hl],
    [-hw,  hh,  hl],
    [ hw, -hh, -hl],
    [-hw, -hh, -hl],
    [-hw,  hh, -hl],
    [ hw,  hh, -hl]
  ];

  let faceAxes = [
    [ 0, 1, 3 ], // FRONT
    [ 4, 5, 7 ], // BACK
    [ 3, 2, 6 ], // TOP
    [ 1, 0, 4 ], // BOTTOM
    [ 1, 4, 2 ], // RIGHT
    [ 5, 0, 6 ]  // LEFT
  ];

  let faceNormals = [
    [  0,  0,  1 ], // FRONT
    [  0,  0, -1 ], // BACK
    [  0,  1,  0 ], // TOP
    [  0, -1,  0 ], // BOTTOM
    [  1,  0,  0 ], // RIGHT
    [ -1,  0,  0 ]  // LEFT
  ];

  let positions = [];
  let normals = [];
  let uvs = [];
  let indices = [];

  function _buildPlane (side, uSegments, vSegments) {
    let u, v;
    let ix, iy;
    let offset = positions.length / 3;

    let faceAxe = faceAxes[side];
    let faceNormal = faceNormals[side];

    for (iy = 0; iy <= vSegments; iy++) {
      for (ix = 0; ix <= uSegments; ix++) {
        u = ix / uSegments;
        v = iy / vSegments;

        let temp1 = v3_lerp(corners[faceAxe[0]], corners[faceAxe[1]], u);
        let temp2 = v3_lerp(corners[faceAxe[0]], corners[faceAxe[2]], v);
        let temp3 = v3_sub(temp2, corners[faceAxe[0]]);
        let r = v3_add(temp1, temp3);

        positions.push(r[0], r[1], r[2]);
        normals.push(faceNormal[0], faceNormal[1], faceNormal[2]);
        uvs.push(u, 1.0 - v);

        if ((ix < uSegments) && (iy < vSegments)) {
          let useg1 = uSegments + 1;
          let a = ix + iy * useg1;
          let b = ix + (iy + 1) * useg1;
          let c = (ix + 1) + (iy + 1) * useg1;
          let d = (ix + 1) + iy * useg1;

          indices.push(offset + a, offset + b, offset + d);
          indices.push(offset + b, offset + c, offset + d);
        }
      }
    }
  }

  _buildPlane(0, ws, hs); // FRONT
  _buildPlane(1, ws, hs); // BACK
  _buildPlane(2, ws, ls); // TOP
  _buildPlane(3, ws, ls); // BOTTOM
  _buildPlane(4, ls, hs); // RIGHT
  _buildPlane(5, ls, hs); // LEFT

  return {
    positions: positions,
    indices: indices,
    normals: normals,
    uvs: uvs,
  };
};
