'use strict';

module.exports = drawCoord;

function drawCoord (regl, transform) {
  let drawLine = regl({
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
      uniform vec3 color;

      void main () {
        gl_FragColor = vec4(color, 1.0);
      }
    `,

    primitive: 'lines',

    attributes: {
      a_pos: regl.prop('line'),
    },

    uniforms: {
      model: transform,
      color: regl.prop('color')
    },

    count: 2,
  });

  return function () {
    drawLine([
      { line: [ [0, 0, 0], [1, 0, 0] ], color: [1, 0, 0] },
      { line: [ [0, 0, 0], [0, 1, 0] ], color: [0, 1, 0] },
      { line: [ [0, 0, 0], [0, 0, 1] ], color: [0, 0, 1] },
    ]);
  };
}
