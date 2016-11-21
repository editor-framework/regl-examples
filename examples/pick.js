'use strict';

const resl = require('resl');
const { mat4 } = require('gl-matrix');
const quad = require('glsl-quad');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');

const box = require('../utils/geometry/box');
const cylinder = require('../utils/geometry/cylinder');

function _clamp (x, lo, hi) {
  return Math.min(Math.max(x, lo), hi);
}

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

    if (!gl_FrontFacing) {
      gl_FragColor *= 0.05;
    }

    gl_FragColor *= color;
  }
`;

let vs_pick = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;

  void main() {
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fs_pick = `
  precision mediump float;
  uniform vec4 pick_color;

  void main () {
    gl_FragColor = pick_color;
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


  const debugDraw = regl({
    viewport: {
      x: 5,
      y: 5,
      width: 160,
      height: 90,
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

    frag: quad.shader.frag,
    vert: quad.shader.vert,
    attributes: {
      a_position: quad.verts,
      a_uv: quad.uvs
    },
    elements: quad.indices,
    uniforms: {
      u_tex: regl.prop('texture'),
      u_clip_y: regl.prop('clip_y')
    },
    framebuffer: regl.prop('fbo')
  });

  const drawMesh = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: 'back'
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

  const drawMeshHover = regl({
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

    cull: {
      enable: true,
      face: 'back'
    },

    depth: {
      enable: false
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

  const drawMeshPick = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: 'back'
    },

    vert: vs_pick,
    frag: fs_pick,

    attributes: {
      position: regl.prop('mesh.positions'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture'),
      pick_color: regl.prop('pick_color'),
    },
  });

  let updateCamera = camera(regl, {
    // free-camera
    eye: [50, 30, 50, 1],
    phi: -Math.PI / 6,
    theta: Math.PI / 4,
  });
  let drawGrid = grid(regl, 100, 100, 100);

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
          color: [1, 1, 1, 1],
          pick_color: [
            ((i >> 16) & 0xff) / 255,
            ((i >> 8) & 0xff) / 255,
            (i & 0xff) / 255,
            1.0
          ]
        };

        if ( i >= 50 ) {
          prop.mesh = meshCylinder;
        }

        propList[i] = prop;
      }

      let fbo = regl.framebuffer({
        width: regl._gl.canvas.width,
        height: regl._gl.canvas.height
      });
      regl.frame(() => {
        let pickID = -1;

        // clear contents of the drawing buffer
        regl.clear({
          color: [0.3, 0.3, 0.3, 1],
          depth: 1
        });

        //
        updateCamera(input, () => {
          // ============================
          // render color-id to fbo
          // ============================

          regl({ framebuffer: fbo })(() => {
            regl.clear({
              color: [0.0, 0.0, 0.0, 0.5],
              depth: 1
            });

            drawMeshPick(propList);

            let x = _clamp(input.mouseX, 0.001, regl._gl.canvas.width-0.001);
            let y = _clamp(input.mouseY, 0.001, regl._gl.canvas.height-0.001);

            let pixel = regl.read({
              x: x,
              y: regl._gl.canvas.height - y,
              width: 1,
              height: 1,
            });

            if ( pixel[3] !== 128 ) {
              let r = pixel[0];
              let g = pixel[1];
              let b = pixel[2];
              pickID = r << 16 | g << 8 | b;
            }
          });

          // ============================
          // real scene
          // ============================

          drawMesh(propList);

          if ( pickID !== -1 ) {
            let prop = {
              texture,
              mesh: propList[pickID].mesh,
              model: propList[pickID].model,
              // model: mat4.multiply(
              //   [],
              //   propList[pickID].model,
              //   mat4.fromScaling([], [1.1, 1.1, 1.1])
              // ),
              color: [1, 0, 0, 0.2],
            };
            drawMeshHover(prop);
          }

          // grids
          drawGrid();

        });

        debugDraw({texture: fbo.color[0], clip_y: 1});

        //
        input.reset();
      });
    },
  });
};
