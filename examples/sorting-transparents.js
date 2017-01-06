'use strict';

const resl = require('resl');
const { mat4 } = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const coord = require('../utils/coord');

const box = require('../utils/geometry/box');

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
  q[0] = sx * cy * cz - cx * sy * sz;
  q[1] = cx * sy * cz + sx * cy * sz;
  q[2] = cx * cy * sz - sx * sy * cz;
  q[3] = cx * cy * cz + sx * sy * sz;

  return q;
}

let vs_simple = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;
  attribute vec2 uv;

  varying vec2 v_uv;

  void main() {
    v_uv = uv;
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fs_simple = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform sampler2D tex;
  uniform vec4 color;

  varying vec2 v_uv;

  void main () {
    gl_FragColor = texture2D( tex, v_uv );
    gl_FragColor *= color;

    if (!gl_FrontFacing) {
      gl_FragColor.rgb *= 0.3;
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


  const drawMesh = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: regl.prop('cull'),
    },

    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
    },

    depth: {
      enable: true,
      mask: false,
      func: 'less',
      range: [0, 1]
    },

    vert: vs_simple,
    frag: fs_simple,

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture'),
      color: regl.prop('color')
    },
  });

  let updateCamera = camera(regl, {
    // free-camera
    eye: [50, 30, 50, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });

  let drawGrid = grid(regl, 100, 100, 100);
  let drawCoord = coord(regl);

  resl({
    manifest: {
      texture: {
        type: 'image',
        src: 'assets-3d/textures/checker/checker_uv_02.jpg',
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
      let num = 100;
      let propList = new Array(num);
      // let propList2 = new Array(2*num);
      for ( let i = 0; i < num; ++i ) {
        let transform = mat4.fromRotationTranslationScale(
          [],
          fromEuler( Math.random() * 360, Math.random() * 360, Math.random() * 360 ),
          [Math.random() * 100 - 50, Math.random() * 20 - 10, Math.random() * 100 - 50],
          [Math.random() * 5 + 1, Math.random() * 5 + 1, Math.random() * 5 + 1]
        );

        let prop = {
          texture,
          mesh: meshBox,
          model: transform,
          color: [1, 1, 1, Math.random()],
          cull: 'back'
        };

        propList[i] = prop;
      }

      // DEBUG
      // let propList = [
      //   { texture, mesh: meshBox, model: mat4.fromTranslation([], [ 10, 1, 10, 1 ]), color: [1, 1, 1, 1] },
      //   { texture, mesh: meshBox, model: mat4.fromTranslation([], [ 11, 1, 11, 1 ]), color: [1, 1, 1, 1] },
      // ];

      regl.frame(() => {
        // clear contents of the drawing buffer
        regl.clear({
          color: [0.3, 0.3, 0.3, 1],
          depth: 1
        });

        //
        updateCamera(input, () => {
          let view = updateCamera.state.view;
          let invView = mat4.invert([],view);

          let camPos = mat4.getTranslation([], invView);
          let camFwd = [-view[2], -view[6], -view[10]];

          let meshPos = [0, 0, 0, 1];
          for ( let i = 0; i < propList.length; ++i ) {
            let prop = propList[i];
            mat4.getTranslation(meshPos, prop.model);

            let tempx = meshPos[0] - camPos[0];
            let tempy = meshPos[1] - camPos[1];
            let tempz = meshPos[2] - camPos[2];
            prop.zdist = tempx*camFwd[0] + tempy*camFwd[1] + tempz*camFwd[2];
          }

          propList.sort((a, b) => {
            return b.zdist - a.zdist; // back to front
          });

          // grids
          drawGrid();

          // coord
          drawCoord(mat4.fromTranslation([], [0, 0.01, 0]));

          // // two sided
          // for ( let i = 0; i < propList.length; ++i ) {
          //   let prop = Object.assign({}, propList[i]);
          //   prop.cull = 'front';
          //   propList2[2*i] = prop;
          //   propList2[2*i+1] = propList[i];
          // }

          // real scene
          drawMesh(propList);
        });

        //
        input.reset();
      });
    },
  });
};
