'use strict';

module.exports = function (regl) {
  const drawTriangle = regl({
    vert: `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0, 1);
      }
    `,

    frag: `
      void main() {
        gl_FragColor = vec4(1, 1, 0, 1);
      }
    `,

    attributes: {
      position: [
        [0, -1], [-1, 0], [1, 1]
      ]
    },

    count: 3
  });

  regl.frame( () => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0, 0, 0, 255],
      depth: 1
    });

    drawTriangle();
  });
};
