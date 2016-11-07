'use strict';

const resl = require('resl');
const mat4 = require('gl-mat4');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const box = require('../utils/geometry/box');

module.exports = function (regl) {
  let input = new Input(regl);
  let mesh = box(5, 5, 5, {
    widthSegments: 2,
    heightSegments: 2,
    lengthSegments: 2,
  });

  const drawBox = regl({
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
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

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
        src: 'assets-3d/textures/uv/uv_checker_bcm_02.jpg',
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
          drawBox({ texture, mesh });
          drawGrid();
        });

        input.reset();
      });
    },
  });
};
