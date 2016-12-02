'use strict';

const resl = require('resl');
const {mat4} = require('gl-matrix');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');
const wireframe = require('../utils/geometry/wireframe');

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

  varying vec2 v_uv;

  void main() {
    v_uv = uv;
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let vshaderBC = `
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
  uniform vec4 color;

  varying vec2 v_uv;

  void main () {
    gl_FragColor = texture2D( tex, v_uv );
    gl_FragColor *= color;

    if ( !gl_FrontFacing ) {
      gl_FragColor.rgb *= 0.2;
    }
  }
`;

let fshaderBC = `
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
    vec4 texColor = texture2D( tex, v_uv );
    gl_FragColor = mix( vec4(0.0, 0.5, 1.0, 1.0), texColor, edgeFactor() );

    if ( !gl_FrontFacing ) {
      gl_FragColor.rgb *= 0.2;
    }
  }
`;

let fshaderBCWireFrame = `
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
    gl_FragColor.rgb = vec3(1.0, 0.5, 0.0);
    gl_FragColor.a = mix( 1.0, 0.0, edgeFactor() );

    if ( !gl_FrontFacing ) {
      gl_FragColor.rgb *= 0.2;
    }
  }
`;

let fshaderWireframe = `
  #extension GL_OES_standard_derivatives : enable

  precision mediump float;
  uniform vec4 color;

  void main () {
    gl_FragColor = color;

    if (!gl_FrontFacing) {
      gl_FragColor *= 0.2;
    }
  }
`;

module.exports = function (regl) {
  let input = new Input(regl);
  const identity = mat4.identity([]);

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
  let wireframeIndices = wireframe(mesh.indices);

  const drawMeshBC = regl({
    frontFace: 'cw',

    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
    },

    vert: vshaderBC,
    frag: fshaderBC,

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

  const drawMeshBCTransparent = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: regl.prop('cullFace'),
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

    vert: vshaderBC,
    frag: fshaderBCWireFrame,

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

  const drawMeshSolid = regl({
    frontFace: 'cw',

    cull: {
      enable: regl.prop('cull'),
      face: regl.prop('cullFace'),
    },

    vert: vshader,
    frag: fshader,

    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
    },

    polygonOffset: {
      enable: true,
      offset: {
        factor: regl.prop('offsetFactor'),
        units: regl.prop('offsetUnits'),
      }
    },

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture'),
      color: regl.prop('color'),
    },
  });

  const drawMeshWireframe = regl({
    frontFace: 'cw',

    vert: vshader,
    frag: fshaderWireframe,

    depth: {
      enable: true,
      mask: false,
      func: 'less',
      range: [0, 1]
    },

    // // NOTE: approch 2
    // depth: {
    //   enable: true,
    //   range: [0.0, 0.99999]
    // },

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      color: regl.prop('color'),
    },

    primitive: 'lines'
  });

  let drawGrid = grid(regl, 100, 100, 100);

  let updateCamera = camera(regl, {
    // free-camera
    eye: [10, 10, 10, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });

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
          drawMeshBC({
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [0, 0, 0])
          });

          //
          drawMeshBCTransparent({
            cullFace: 'front',
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [5, 0, 0])
          });
          drawMeshBCTransparent({
            cullFace: 'back',
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [5, 0, 0])
          });

          //
          drawMeshSolid({
            cull: false,
            cullFace: 'back',
            offsetFactor: 1,
            offsetUnits: 1,
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [0, 0, 5]),
            color: [1,1,1,1],
          });
          drawMeshWireframe({
            texture,
            mesh: {
              positions: mesh.positions,
              uvs: mesh.uvs,
              indices: wireframeIndices,
            },
            model: mat4.translate([], identity, [0, 0, 5]),
            color: [0,0,0,1],
          });

          //
          drawMeshWireframe({
            texture,
            mesh: {
              positions: mesh.positions,
              uvs: mesh.uvs,
              indices: wireframeIndices,
            },
            model: mat4.translate([], identity, [5, 0, 5]),
            color: [0,0.2,0,1],
          });
          drawMeshSolid({
            offsetFactor: 1,
            offsetUnits: 1,
            cull: true,
            cullFace: 'back',
            texture,
            mesh: mesh,
            model: mat4.translate([], identity, [5, 0, 5]),
            color: [1,1,1,0],
          });
          drawMeshWireframe({
            texture,
            mesh: {
              positions: mesh.positions,
              uvs: mesh.uvs,
              indices: wireframeIndices,
            },
            model: mat4.translate([], identity, [5, 0, 5]),
            color: [0,1,0,1],
          });
        });

        //
        input.reset();
      });
    },
  });
};
