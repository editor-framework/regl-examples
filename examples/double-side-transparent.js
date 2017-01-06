'use strict';

const resl = require('resl');
const { mat4 } = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const coord = require('../utils/coord');

const box = require('../utils/geometry/box');
const plane = require('../utils/geometry/plane');

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

  let meshFloor = plane(20, 20, {
    widthSegments: 20,
    lengthSegments: 20
  });

  const drawMeshSolid = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: 'back',
    },

    depth: {
      enable: true,
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
    eye: [10, 10, 10, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });

  let drawGrid = grid(regl, 100, 100, 100);
  let drawCoord = coord(regl);

  let meshTexture = regl.texture(null);
  let floorTexture = regl.texture(null);

  resl({
    manifest: {
      texture: {
        type: 'image',
        src: 'assets-3d/textures/checker/checker_uv_02.jpg',
      },

      texture02: {
        type: 'image',
        src: 'assets-3d/textures/floor.png',
      },
    },

    onDone: (assets) => {
      meshTexture({
        data: assets.texture,
        mag: 'linear',
        min: 'mipmap',
        mipmap: 'nice',
        // flipY: true
      });

      floorTexture({
        data: assets.texture02,
        mag: 'linear',
        min: 'mipmap',
        mipmap: 'nice',
        // flipY: true
      });
    }
  });

  regl.frame(() => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    //
    updateCamera(input, () => {
      // grids
      drawGrid();

      // coord
      drawCoord(mat4.fromTranslation([], [0, 0.01, 0]));

      drawMeshSolid({
        texture: floorTexture,
        mesh: meshFloor,
        model: mat4.fromRotationTranslationScale(
          [],
          [0, 0, 0, 1],
          [0, 0.1, 0, 1],
          [1.0, 1.0, 1.0]
        ),
        color: [1, 1, 1, 1],
      });

      // real scene
      drawMeshSolid({
        texture: meshTexture,
        mesh: meshBox,
        model: mat4.fromRotationTranslationScale(
          [],
          [0, 0, 0, 1],
          [0, 2, 0, 1],
          [0.5, 0.5, 0.5]
        ),
        color: [0.3, 0, 0, 1],
      });

      drawMesh({
        texture: meshTexture,
        mesh: meshBox,
        model: mat4.fromTranslation([], [0, 2, 0, 1] ),
        color: [1, 1, 1, 0.3],
        cull: 'front'
      });

      drawMesh({
        texture: meshTexture,
        mesh: meshBox,
        model: mat4.fromTranslation([], [0, 2, 0, 1] ),
        color: [1, 1, 1, 0.3],
        cull: 'back'
      });
    });

    //
    input.reset();
  });
};
