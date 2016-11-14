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

module.exports = function ( width, length, opts ) {
  let uSegments = opts.widthSegments !== undefined ? opts.widthSegments : 5;
  let vSegments = opts.lengthSegments !== undefined ? opts.lengthSegments : 5;

  let hw = width * 0.5;
  let hl = length * 0.5;

  let positions = [];
  let normals = [];
  let uvs = [];
  let indices = [];

  let c00 = [-hw, 0, hl];
  let c10 = [ hw, 0, hl];
  let c01 = [-hw, 0, -hl];

  for (let y = 0; y <= vSegments; y++) {
    for (let x = 0; x <= uSegments; x++) {
      let u = x / uSegments;
      let v = y / vSegments;

      let temp1 = v3_lerp(c00, c10, u);
      let temp2 = v3_lerp(c00, c01, v);
      let temp3 = v3_sub(temp2, c00);
      let r = v3_add(temp1, temp3);

      positions.push(r[0], r[1], r[2]);
      normals.push(0, 1, 0);
      uvs.push(u, 1.0 - v);

      if ((x < uSegments) && (y < vSegments)) {
        let useg1 = uSegments + 1;
        let a = x + y * useg1;
        let b = x + (y + 1) * useg1;
        let c = (x + 1) + (y + 1) * useg1;
        let d = (x + 1) + y * useg1;

        indices.push(a, b, d);
        indices.push(b, c, d);
      }
    }
  }

  return {
    positions: positions,
    normals: normals,
    uvs: uvs,
    indices: indices,
  };
};
