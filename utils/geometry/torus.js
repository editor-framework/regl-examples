'use strict';

module.exports = function (radius, tube, opts) {
  opts = opts || {};

  radius = radius || 0.5;
  tube = tube || 0.2;
  let radialSegments = opts.radialSegments || 30;
  let tubularSegments = opts.tubularSegments || 20;
  let arc = opts.arc || 2.0 * Math.PI;

  let positions = [];
  let normals = [];
  let uvs = [];
  let indices = [];

	for ( let j = 0; j <= radialSegments; j ++ ) {
		for ( let i = 0; i <= tubularSegments; i ++ ) {
      let u = i / tubularSegments;
      let v = j / radialSegments;

      let u1 = u * arc;
      let v1 = v * Math.PI * 2;

			// vertex
			let x = (radius + tube * Math.cos(v1)) * Math.sin(u1);
			let y = tube * Math.sin(v1);
			let z = (radius + tube * Math.cos(v1)) * Math.cos(u1);

			// this vector is used to calculate the normal
      let nx = Math.cos(u1) * Math.sin(v1);
      let ny = Math.sin(u1);
      let nz = Math.cos(u1) * Math.cos(v1);

      positions.push(x, y, z);
      normals.push(nx, ny, nz);
      uvs.push(u, 1.0-v);

      if ((i < tubularSegments) && (j < radialSegments)) {
        let seg1 = tubularSegments + 1;
        let a = seg1 * j + i;
        let b = seg1 * ( j + 1 ) + i;
        let c = seg1 * ( j + 1 ) + i + 1;
        let d = seg1 * j + i + 1;

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
