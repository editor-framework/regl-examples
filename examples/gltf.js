'use strict';

const fs = require('fs');
const resl = require('resl');
const {mat4} = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const coord = require('../utils/coord');

const geomUtils = require('../utils/geometry/utils');
const lines = require('../utils/draw-lines');

const identity = mat4.identity([]);
let json = JSON.parse( fs.readFileSync( Editor.url('app://examples/output.json') ) );
console.log(json);

let vshader = `
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

let fshader = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform sampler2D tex;

  varying vec2 v_uv;

  void main () {
    // gl_FragColor = vec4( 1, 1, 1, 1 );
    // gl_FragColor = vec4( v_uv.x, v_uv.y, 0, 1 );

    gl_FragColor = texture2D( tex, v_uv );

    if (!gl_FrontFacing) {
      gl_FragColor *= 0.05;
    }
  }
`;

let vshaderWireframe = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;

  void main() {
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fshaderWireframe = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;

  void main () {
    gl_FragColor = vec4( 0, 0, 0, 1 );
  }
`;

module.exports = function (regl) {
  let input = new Input(regl);

  const drawMesh = regl({
    frontFace: 'ccw',

    // cull: {
    //   enable: true,
    //   face: 'back'
    // },

    vert: vshader,
    frag: fshader,

    // NOTE: approch 1
    polygonOffset: {
      enable: true,
      offset: {
        factor: 1,
        units: 1,
      }
    },

    attributes: {
      position: {
        buffer: regl.prop('mesh.positions'),
        offset: 0,
        stride: 12,
      },
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
    // },
  });

  const drawMeshWireframe = regl({
    frontFace: 'ccw',

    vert: vshaderWireframe,
    frag: fshaderWireframe,

    // // NOTE: approch 2
    // depth: {
    //   enable: true,
    //   range: [0.0, 0.99999]
    // },

    attributes: {
      // position: {
      //   buffer: regl.prop('mesh.positions'),
      //   offset: 0,
      //   stride: 12,
      // }
      position: regl.prop('mesh.positions'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
    },

    primitive: 'lines'
  });

  let mesh = json.meshes[2];
  let positions = mesh.points;
  let indices = mesh.indices;
  let wireframeIndices = geomUtils.wireframe(mesh.indices);
  let uvs = mesh.uvs0;

  let normalVerts = geomUtils.normals(mesh.points, mesh.normals, 0.1);

  let updateCamera = camera(regl, {
    eye: [10, 10, 10, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });
  let drawGrid = grid(regl, 100, 100, 100);
  let drawLines = lines(regl);
  let drawCoord = coord(regl, mat4.fromTranslation([], [0, 0.01, 0]));

  let meshTexture = regl.texture(null);

  resl({
    manifest: {
      texture: {
        type: 'image',
        src: 'assets-3d/models/fbx/Char_UV_Texture.gif',
      }
    },

    onDone: (assets) => {
      meshTexture({
        data: assets.texture,
        mag: 'linear',
        min: 'mipmap',
        mipmap: 'nice',
        flipY: true
      });
    }
  });

  regl.frame(() => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    updateCamera(input, () => {
      drawMesh({
        mesh: {
          positions: positions,
          indices: indices,
          uvs: uvs,
        },
        model: identity,
        texture: meshTexture,
      });

      drawMeshWireframe({
        mesh: {
          positions: positions,
          indices: wireframeIndices,
        },
        model: identity,
      });

      drawLines({
        lines: normalVerts,
        color: [0, 1, 0, 1]
      });

      drawGrid();
      drawCoord();
    });

    input.reset();
  });
};
