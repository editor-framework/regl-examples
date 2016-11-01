'use strict';

const mat4 = require('gl-mat4');
const Input = require('../utils/input');

function _snapPixel (x) {
  return Math.floor(x) + 0.5;
}

module.exports = function (regl) {
  // debug info
  let debugInfo = document.createElement('div');
  debugInfo.style.position = 'absolute';
  debugInfo.style.top = '10px';
  debugInfo.style.left = '10px';
  debugInfo.style.border = '1px solid #666';
  debugInfo.style.padding = '5px';
  debugInfo.style.background = 'rgba(0,0,0,0.3)';
  debugInfo.style.pointerEvents = 'none';

  let labelMouse = document.createElement('div');
  debugInfo.appendChild(labelMouse);

  let labelMouseScroll = document.createElement('div');
  debugInfo.appendChild(labelMouseScroll);

  document.getElementById('view').appendChild(debugInfo);

  //
  let input = new Input(regl);

  const drawCrossLine = regl({
    vert: `
      uniform mat4 projection;
      attribute vec2 position;

      void main() {
        gl_Position = projection * vec4(position, 0, 1);
      }
    `,

    frag: `
      void main() {
        gl_FragColor = vec4(0.5, 0.5, 0.0, 1);
      }
    `,

    attributes: {
      position: (context, props) => {
        return [
          [props.center[0], 0], [props.center[0], context.viewportHeight],
          [0, props.center[1]], [context.viewportWidth, props.center[1]],
        ];
      },
    },

    uniforms: {
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

    primitive: 'lines',

    count: 4
  });

  regl.frame(() => {
    // clear contents of the drawing buffer
    regl.clear({
      color: [0.3, 0.3, 0.3, 1],
      depth: 1
    });

    labelMouse.innerText = `Mouse: (${input.mouseX}, ${input.mouseY})`;
    labelMouseScroll.innerText = `Mouse Scroll: (${input.mouseScrollX}, ${input.mouseScrollY})`;

    drawCrossLine({
      center: [_snapPixel(input.mouseX), _snapPixel(input.mouseY)],
    });

    input.reset();
  });
};
