const resl = require('resl');

const quad = require('glsl-quad');
const numerify = require('glsl-numerify');

module.exports = function (regl) {
  function makeFBORgbUint8 ({width, height}) {
    return regl.framebuffer({
      color: regl.texture({
        width: width,
        height: height,
        stencil: false,
        format: 'rgba',
        type: 'uint8',
        depth: false,
        wrap: 'clamp'
      })
    });
  }

  const drawToScreen = regl({
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

  resl({
    manifest: {
      texture: {
        type: 'image',
        src: 'res/numerify-4x4.png',
        parser: (data) => regl.texture({
          data: data,
          mag: 'nearest',
          min: 'nearest',
          flipY: true
        })
      },
      digitsTexture: {
        type: 'image',
        src: numerify.digits.uri,
        parser: (data) => regl.texture({
          data: data,
          mag: 'nearest',
          min: 'nearest',
          flipY: true
        })
      }
    },

    onDone: ({texture, digitsTexture}) => {
      // console.log(texture.width);
      // console.log(digitsTexture.width);

      let fbo = makeFBORgbUint8({
        width: texture.width * 16,
        height: texture.height * 16
      });
      let vert = numerify.makeVert();
      let frag = numerify.makeFrag({
        multiplier: 256,
        sourceSize: `vec2(${texture.width}, ${texture.height})`,
        destinationSize: `vec2(${texture.width * 16}, ${texture.height * 16})`,
        destinationCellSize: 'vec2(16, 16)'
      });

      console.log('vert:', vert);
      console.log('frag:', frag);

      const numerifyToFBO = regl({
        frag: frag,
        vert: vert,
        attributes: {
          a_position: quad.verts,
          a_uv: quad.uvs
        },
        elements: quad.indices,
        uniforms: {
          source_texture: regl.prop('sourceTexture'),
          digits_texture: regl.prop('digitsTexture'),
          u_clip_y: regl.prop('clip_y')
        },
        framebuffer: regl.prop('fbo')
      });

      regl.frame(() => {
        regl.clear({
          color: [0, 0, 0, 1],
          depth: 1
        });

        numerifyToFBO({
          sourceTexture: texture,
          digitsTexture: digitsTexture,
          fbo: fbo,
          clip_y: 1
        });

        drawToScreen({texture: fbo.color[0], clip_y: 1});
      });
    }
  });
};
