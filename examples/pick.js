'use strict';

const resl = require('resl');
const { mat4 } = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');

const box = require('../utils/geometry/box');
const cylinder = require('../utils/geometry/cylinder');

function fromEuler (ex, ey, ez) {
  let halfToRad = 0.5 * Math.PI / 180.0;
  ex *= halfToRad;
  ey *= halfToRad;
  ez *= halfToRad;

  let sx = Math.sin(ex);
  let cx = Math.cos(ex);
  let sy = Math.sin(ey);
  let cy = Math.cos(ey);
  let sz = Math.sin(ez);
  let cz = Math.cos(ez);

  let q = [0, 0, 0, 1];
  q[0] = sx * cy * cz + cx * sy * sz;
  q[1] = cx * sy * cz - sx * cy * sz;
  q[2] = cx * cy * sz - sx * sy * cz;
  q[3] = cx * cy * cz + sx * sy * sz;

  return q;
}

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

  let meshBox = box(1, 1, 1, {
    widthSegments: 4,
    heightSegments: 4,
    lengthSegments: 4
  });

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

    // count ( {time}, props ) {
    //   let total = props.mesh.indices.length;
    //   return Math.ceil(time % 10.0 / 10.0 * total);
    // }
  });

  let updateCamera = camera(regl, {
    // free-camera
    eye: [50, 30, 50, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });
  let drawGrid = grid(regl, 100, 100, 100);

  let matList = new Array(100);
  for ( let i = 0; i < 100; ++i ) {
    matList[i] = mat4.fromRotationTranslationScale(
      [],
      fromEuler( Math.random() * 360, Math.random() * 360, Math.random() * 360 ),
      [Math.random() * 100 - 50, Math.random() * 20 - 10, Math.random() * 100 - 50],
      [Math.random() * 5 + 1, Math.random() * 5 + 1, Math.random() * 5 + 1]
    );
  }

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
          // box
          for ( let i = 0; i < matList.length/2; ++i ) {
            drawMesh({
              texture,
              mesh: meshBox,
              model: matList[i]
            });
          }

          for ( let i = matList.length/2; i < matList.length; ++i ) {
            drawMesh({
              texture,
              mesh: meshCylinder,
              model: matList[i]
            });
          }

          // grids
          drawGrid();
        });

        //
        input.reset();
      });
    },
  });
};
