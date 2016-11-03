'use strict';

const mat4 = require('gl-mat4');

module.exports = function (regl) {
  let drawGrid = _drawGrid (regl);

  regl.frame((context) => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    drawGrid({
      width: context.viewportWidth,
      height: context.viewportHeight,
      seg: 20,
    });
  });
};

// function _snapPixel (x) {
//   return Math.floor(x) + 0.5;
// }

function _drawGrid (regl) {
  let vertices = [];

  return regl({
    blend: {
      enable: true,
      func: {
        srcRGB: 'src alpha',
        srcAlpha: 1,
        dstRGB: 'one minus src alpha',
        dstAlpha: 1
      },
      equation: {
        rgb: 'add',
        alpha: 'add'
      },
      color: [0, 0, 0, 0]
    },

    vert: `
      precision mediump float;
      uniform mat4 projection;
      uniform vec2 screen;

      attribute vec3 a_pos;

      void main() {
        // gl_Position = projection * vec4(a_pos, 1);

        // gl_Position = projection * vec4(
        //   floor(a_pos.x) + 0.5,
        //   floor(a_pos.y) + 0.5,
        //   a_pos.z,
        //   1
        // );

        vec4 pos = projection * vec4(a_pos, 1);
        vec2 hpc = vec2(screen.x * 0.5, screen.y * 0.5);

        gl_Position = vec4(
          2.0 * ((floor((pos.x + 1.0) * 0.5 * screen.x) + 0.5) / screen.x - 0.5),
          2.0 * ((floor((pos.y + 1.0) * 0.5 * screen.y) - 0.5) / screen.y - 0.5),
          pos.z,
          pos.w
        );
      }
    `,

    frag: `
      precision mediump float;

      void main () {
        gl_FragColor = vec4(0.5, 0.5, 0.5, 0.5);
      }
    `,

    primitive: 'lines',

    attributes: {
      a_pos: (context, props) => {
        let width = props.width;
        let height = props.height;
        let seg = props.seg;

        let w = width;
        let h = height;
        let dw = width / seg;
        let dl = height / seg;

        vertices = [];

        for ( let x = 0; x <= w; x += dw ) {
          // vertices.push( _snapPixel(x), 0, 0 );
          // vertices.push( _snapPixel(x), _snapPixel(h), 0 );
          vertices.push( x, 0, 0 );
          vertices.push( x, h, 0 );
        }
        for ( let y = 0; y <= h; y += dl ) {
          // vertices.push( 0, _snapPixel(y), 0 );
          // vertices.push( _snapPixel(w), _snapPixel(y), 0 );
          vertices.push( 0, y, 0 );
          vertices.push( w, y, 0 );
        }

        return vertices;
      },
    },

    uniforms: {
      screen: ({viewportWidth, viewportHeight}) => {
        return [viewportWidth, viewportHeight];
      },
      projection: ({viewportWidth, viewportHeight}) => {
        return mat4.ortho(
          [],
          0,
          viewportWidth,
          viewportHeight,
          0,
          -10,
          1000
        );
      },
    },

    count: () => {
      return vertices.length/3;
    }
  });
}
