'use strict';

const {mat4} = require('gl-matrix');

module.exports = drawLines;

function drawLines (regl) {
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
      uniform vec4 color;

      void main () {
        gl_FragColor = color;
      }
    `,

    primitive: 'lines',

    attributes: {
      a_pos: regl.prop('lines'),
    },

    uniforms: {
      model: mat4.identity([]),
      color: regl.prop('color'),
    },

    count ( context, props ) {
      return props.lines.length;
    },
  });
}
