'use strict';

module.exports = function (regl) {

  const drawTriangle = regl({
    vert: `
      attribute vec2 position;
      attribute vec3 color;

      varying vec3 v_color;

      void main() {
        gl_Position = vec4(position, 0, 1);
        v_color = color;
      }
    `,

    frag: `
      precision mediump float;
      varying vec3 v_color;

      void main() {
        gl_FragColor = vec4(v_color, 1);
      }
    `,

    attributes: {
      position: [
        [0, -1], [-1, 0], [1, 1]
      ],
      color: [
        [1, 0, 0], [0, 1, 0], [0, 0, 1]
      ]
    },

    count: 3
  });

  regl.frame(() => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    drawTriangle();
  });
};
