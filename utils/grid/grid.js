'use strict';

const {mat4} = require('gl-matrix');

module.exports = drawGrid;

function drawGrid (regl, width, length, seg) {
  let vertices = [];

  let hw = width * 0.5;
  let hl = length * 0.5;
  let dw = width / seg;
  let dl = length / seg;

  for ( let x = -hw; x <= hw; x += dw ) {
    vertices.push( x, 0, -hl );
    vertices.push( x, 0, hl );
  }
  for ( let z = -hl; z <= hl; z += dl ) {
    vertices.push( -hw, 0, z );
    vertices.push( hw, 0, z );
  }

  return regl({
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    },

    vert: `
      precision mediump float;
      uniform mat4 model, view, projection;

      attribute vec3 a_pos;

      void main() {
        vec4 pos = projection * view * model * vec4(a_pos, 1);

        gl_Position = pos;
      }
    `,

    frag: `
      precision mediump float;

      void main () {
        gl_FragColor = vec4(0.5, 0.5, 0.5, 0.5);
      }
    `,

    primitive: 'lines',

    attributes: {
      a_pos: vertices,
    },

    uniforms: {
      model: mat4.identity([]),
    },

    count: vertices.length/3
  });
}
