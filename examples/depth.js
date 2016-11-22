'use strict';

const resl = require('resl');
const { mat4 } = require('gl-matrix');
const quad = require('glsl-quad');

const Input = require('../utils/input');
const camera = require('../utils/camera/free-camera');
const grid = require('../utils/grid/grid');

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
  }
`;

let vs_depth = `
  precision mediump float;
  uniform mat4 model, view, projection;

  attribute vec3 position;

  void main() {
    gl_Position = projection * view * model * vec4(position, 1);
  }
`;

let fs_depth = `
  precision mediump float;

  // const vec3 PackFactors = vec3( 256. * 256. * 256., 256. * 256.,  256. );
  // const float ShiftRight8 = 1. / 256.;
  // const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)

  // vec4 packDepthToRGBA( const in float v ) {
  //   vec4 r = vec4( fract( v * PackFactors ), v );
  //   r.yzw -= r.xyz * ShiftRight8; // tidy overflow
  //   return r * PackUpscale;
  // }

  void main () {
    gl_FragColor = vec4(1,1,1,1);
    // gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0);
		// gl_FragColor = packDepthToRGBA( gl_FragCoord.z );
  }
`;

module.exports = function (regl) {
  let input = new Input(regl);

  let meshBox = box(1, 1, 1, {
    widthSegments: 4,
    heightSegments: 4,
    lengthSegments: 4
  });

  const debugDraw = regl({
    depth: {
      enable: false,
    },

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

    vert: `
      precision mediump float;
      attribute vec2 a_position;
      attribute vec2 a_uv;

      uniform float u_clip_y;

      varying vec2 v_uv;

      void main() {
        v_uv = a_uv;
        gl_Position = vec4(a_position * vec2(1,u_clip_y), 0, 1);
      }
    `,

    frag: `
      precision mediump float;
      varying vec2 v_uv;

      uniform sampler2D u_tex;
      uniform float u_cam_near;
      uniform float u_cam_far;

      void main () {
        float z = texture2D(u_tex,v_uv).x;
        float viewZ = ( u_cam_near * u_cam_far ) / ( ( u_cam_far - u_cam_near ) * z - u_cam_far );

        z = ( viewZ + u_cam_near ) / ( u_cam_near - u_cam_far );

        gl_FragColor.rgb = vec3(z);
        gl_FragColor.a = 1.0;
      }
    `,

    attributes: {
      a_position: quad.verts,
      a_uv: quad.uvs
    },
    elements: quad.indices,
    uniforms: {
      u_tex: regl.prop('texture'),
      u_clip_y: regl.prop('clip_y'),
      u_cam_near: regl.prop('near'),
      u_cam_far: regl.prop('far'),
    },
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

  const drawMeshZ = regl({
    frontFace: 'cw',

    cull: {
      enable: true,
      face: 'back'
    },

    depth: {
      enable: true,
    },

    vert: vs_depth,
    frag: fs_depth,

    attributes: {
      position: regl.prop('mesh.positions'),
      uv: regl.prop('mesh.uvs'),
    },

    elements: regl.prop('mesh.indices'),

    uniforms: {
      model: regl.prop('model'),
      tex: regl.prop('texture'),
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
        };

        propList[i] = prop;
      }

      let fbo = regl.framebuffer({
        width: regl._gl.canvas.width,
        height: regl._gl.canvas.height,
        depth: true,
        stencil: false,
        depthTexture: true,
      });
      regl.frame(() => {
        // clear contents of the drawing buffer
        regl.clear({
          color: [0.3, 0.3, 0.3, 1],
          depth: 1,
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

            drawMeshZ(propList);
          });

          // ============================
          // real scene
          // ============================

          drawMesh(propList);

          // grids
          drawGrid();
        });

        debugDraw({
          texture: fbo.depth,
          clip_y: 1,
          near: 1,
          far: 1000,
        });

        //
        input.reset();
      });
    },
  });
};
