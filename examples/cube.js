'use strict';

const resl = require('resl');
const mat4 = require('gl-mat4');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
// const camera = require('../utils/camera/orbit-camera');
const grid = require('../utils/grid/grid');

const vertices = [
  [-0.5, +0.5, +0.5], [+0.5, +0.5, +0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5], // positive z face.
  [+0.5, +0.5, +0.5], [+0.5, +0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], // positive x face
  [+0.5, +0.5, -0.5], [-0.5, +0.5, -0.5], [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], // negative z face
  [-0.5, +0.5, -0.5], [-0.5, +0.5, +0.5], [-0.5, -0.5, +0.5], [-0.5, -0.5, -0.5], // negative x face.
  [-0.5, +0.5, -0.5], [+0.5, +0.5, -0.5], [+0.5, +0.5, +0.5], [-0.5, +0.5, +0.5], // top face
  [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5]  // bottom face
];

const uvs = [
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive z face.
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive x face.
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative z face.
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative x face.
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // top face
  [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]  // bottom face
];

const indices = [
  [2, 1, 0], [2, 0, 3],       // positive z face.
  [6, 5, 4], [6, 4, 7],       // positive x face.
  [10, 9, 8], [10, 8, 11],    // negative z face.
  [14, 13, 12], [14, 12, 15], // negative x face.
  [18, 17, 16], [18, 16, 19], // top face.
  [20, 21, 22], [23, 20, 22]  // bottom face
];

module.exports = function (regl) {
  let input = new Input(regl);

  const drawCube = regl({
    vert: `
      precision mediump float;
      uniform mat4 model, view, projection;

      attribute vec3 position;
      attribute vec2 uv;

      varying vec2 v_uv;

      void main() {
        v_uv = uv;
        gl_Position = projection * view * model * vec4(position, 1);
      }
    `,

    frag: `
      precision mediump float;
      uniform sampler2D tex;

      varying vec2 v_uv;

      void main () {
        gl_FragColor = texture2D( tex, v_uv );
      }
    `,

    attributes: {
      position: vertices,
      uv: uvs,
    },

    elements: indices,

    uniforms: {
      model: mat4.identity([]),

      // model: ({tick}) => {
      //   const t = 0.05 * tick;
      //   return mat4.rotate([], mat4.identity([]), Math.sin(t), [0, 1, 0]);
      // },

      tex: regl.prop('texture')
    }
  });

  let updateCamera = camera(regl, {
    // orbit-camera
    // center: [0, 0, 0],
    // phi: Math.PI / 6,
    // theta: Math.PI / 4,

    // free-camera
    eye: [10, 10, 10, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });
  let drawGrid = grid(regl, 100, 100, 100);

  resl({
    manifest: {
      texture: {
        type: 'image',
        src: 'res/checker_uv_02.jpg',
        parser: (data) => regl.texture({
          data: data,
          mag: 'linear',
          min: 'mipmap',
          mipmap: 'nice',
        })
      }
    },

    onDone: ({texture}) => {
      regl.frame(() => {

        // clear contents of the drawing buffer
        regl.clear({
          color: [0.3, 0.3, 0.3, 1],
          depth: 1
        });

        updateCamera(input, () => {
          drawCube({ texture });
          drawGrid();
        });

        input.reset();
      });
    },
  });
};
