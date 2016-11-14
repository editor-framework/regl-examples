'use strict';

const resl = require('resl');
const mat4 = require('gl-mat4');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');

const box = require('../utils/geometry/box');
const quad = require('../utils/geometry/quad');
const torus = require('../utils/geometry/torus');
const cylinder = require('../utils/geometry/cylinder');

let vshader = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;
  attribute vec2 uv;
  attribute vec3 barycentric;

  varying vec2 v_uv;

  void main() {
    v_uv = uv;
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fshader = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform sampler2D tex;

  varying vec2 v_uv;

  void main () {
    // gl_FragColor = vec4( v_uv.x, v_uv.y, 0, 1 );
    gl_FragColor = texture2D( tex, v_uv );

    if (!gl_FrontFacing) {
      gl_FragColor *= 0.05;
    }
  }
`;

module.exports = function (regl) {
  let input = new Input(regl);
  let meshQuad = quad();

  let meshBox = box(1, 1, 1, {
    widthSegments: 4,
    heightSegments: 4,
    lengthSegments: 4
  });

  let meshTorus = torus();

  let meshCylinder = cylinder(0.5, 0.5, 1.0, {
    radialSegments: 64,
    heightSegments: 4,
  });

  const identity = mat4.identity([]);
  const drawMesh = regl({
    frontFace: 'cw',

    // cull: {
    //   enable: true,
    //   face: 'back'
    // },

    vert: vshader,
    frag: fshader,

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture')
    },

    count: function ( {time}, props ) {
      let total = props.mesh.indices.length;
      return Math.ceil(time % 10.0 / 10.0 * total);
    }
  });

  let updateCamera = camera(regl, {
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
        src: 'assets-3d/textures/uv/uv_checker_left_top.jpg',
        parser: (data) => regl.texture({
          data: data,
          mag: 'linear',
          min: 'mipmap',
          mipmap: 'nice',
          // flipY: true
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

        //
        updateCamera(input, () => {
          // quad
          drawMesh({
            texture,
            mesh: meshQuad,
            model: mat4.translate([], identity, [0, 0, 0] )
          });

          // box
          drawMesh({
            texture,
            mesh: meshBox,
            model: mat4.translate([], identity, [2, 0, 0] )
          });

          // torus
          drawMesh({
            texture,
            mesh: meshTorus,
            model: mat4.translate([], identity, [4, 0, 0] )
          });

          // cylinder
          drawMesh({
            texture,
            mesh: meshCylinder,
            model: mat4.translate([], identity, [6, 0, 0] )
          });

          // grids
          drawGrid();
        });

        //
        input.reset();
      });
    },
  });
};
