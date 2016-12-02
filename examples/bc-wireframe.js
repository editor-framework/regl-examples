'use strict';

const resl = require('resl');
const {mat4} = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');

const sphere = require('../utils/geometry/sphere');
// const torus = require('../utils/geometry/torus');

// const vertices = [
//   [-0.5, +0.5, +0.5], [+0.5, +0.5, +0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5], // positive z face.
//   [+0.5, +0.5, +0.5], [+0.5, +0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], // positive x face
//   [+0.5, +0.5, -0.5], [-0.5, +0.5, -0.5], [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], // negative z face
//   [-0.5, +0.5, -0.5], [-0.5, +0.5, +0.5], [-0.5, -0.5, +0.5], [-0.5, -0.5, -0.5], // negative x face.
//   [-0.5, +0.5, -0.5], [+0.5, +0.5, -0.5], [+0.5, +0.5, +0.5], [-0.5, +0.5, +0.5], // top face
//   [-0.5, -0.5, -0.5], [+0.5, -0.5, -0.5], [+0.5, -0.5, +0.5], [-0.5, -0.5, +0.5]  // bottom face
// ];

// const uvs = [
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive z face.
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // positive x face.
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative z face.
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // negative x face.
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], // top face
//   [0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0]  // bottom face
// ];

// const indices = [
//   [2, 1, 0], [2, 0, 3],       // positive z face.
//   [6, 5, 4], [6, 4, 7],       // positive x face.
//   [10, 9, 8], [10, 8, 11],    // negative z face.
//   [14, 13, 12], [14, 12, 15], // negative x face.
//   [18, 17, 16], [18, 16, 19], // top face.
//   [20, 21, 22], [23, 20, 22]  // bottom face
// ];

// const barycentrics = [
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
//   [1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
// ];

let vshader = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;
  attribute vec2 uv;
  attribute vec3 barycentric;

  varying vec2 v_uv;
  varying vec3 v_bc;

  void main() {
    v_uv = uv;
    v_bc = barycentric;
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fshader = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform sampler2D tex;

  varying vec2 v_uv;
  varying vec3 v_bc;

  float edgeFactor () {
    vec3 d = fwidth(v_bc);
    vec3 a3 = smoothstep(vec3(0.0), d*1.5, v_bc);
    return min(min(a3.x, a3.y), a3.z);
  }

  void main () {
    // alpha by edge
    gl_FragColor.rgb = vec3(0.0, 0.5, 1.0);
    if ( gl_FrontFacing ) {
      gl_FragColor.a = mix( 1.0, 0.0, edgeFactor() );
    } else {
      gl_FragColor.a = mix( 0.2, 0.0, edgeFactor() );
    }
  }
`;

module.exports = function (regl) {
  let input = new Input(regl);
  const identity = mat4.identity([]);
  const drawMesh = regl({
    frontFace: 'cw',

    // cull: {
    //   enable: true,
    //   face: 'back'
    // },

    depth: {
      enable: false,
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

    vert: vshader,
    frag: fshader,

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
      barycentric: regl.prop('mesh.barycentrics'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture')
    },
  });

  // let mesh = torus();
  // let mesh = {
  //   positions: vertices,
  //   uvs: uvs,
  //   indices: indices,
  //   barycentrics: barycentrics,
  // },
  let mesh = sphere(2, {
    segments: 64,
  });
  let centers = [];
  for ( let i = 0; i < mesh.positions.length/3; ++i ) {
    centers[3*i] = [1, 0, 0];
    centers[3*i + 1] = [0, 1, 0];
    centers[3*i + 2] = [0, 0, 1];
  }
  mesh.barycentrics = centers;

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
          // grids
          drawGrid();

          //
          drawMesh({
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [0, 0, 0] )
          });
        });

        //
        input.reset();
      });
    },
  });
};
