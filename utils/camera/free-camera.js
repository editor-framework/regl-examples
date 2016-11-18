'use strict';

const {vec4, mat4} = require('gl-matrix');

module.exports = function (regl, props) {
  let cameraState = {
    view: mat4.identity([]),
    projection: mat4.identity([]),
    theta: props.theta || 0,
    phi: props.phi || 0,
    eye: props.eye || [0, 0, 0, 1],
  };

  let df = 0;
  let dr = 0;

  let panX = 0;
  let panY = 0;
  let panZ = 0;

  let moveSpeed = 10.0;
  let damping = 10.0;

  let curTheta = cameraState.theta;
  let curPhi = cameraState.phi;
  let curEye = vec4.clone(cameraState.eye);

  function lerp (from, to, ratio) {
    return from + (to - from) * ratio;
  }

  function v3_lerp (a, b, alpha) {
    return [
      a[0] + alpha * (b[0] - a[0]),
      a[1] + alpha * (b[1] - a[1]),
      a[2] + alpha * (b[2] - a[2]),
    ];
  }

  function _handleInput (input) {
    df = 0, dr = 0;
    panX = 0, panY = 0, panZ = 0;

    if ( input.keypress('mouse-left') && input.keypress('mouse-right') ) {
      let dx = input.mouseDeltaX;
      let dy = input.mouseDeltaY;

      panX = dx;
      panY = -dy;

    } else if ( input.keypress('mouse-left') ) {
      let dx = input.mouseDeltaX;
      let dy = input.mouseDeltaY;

      cameraState.theta -= dx * 0.002;
      panZ = -dy;

    } else if ( input.keypress('mouse-right') ) {
      let dx = input.mouseDeltaX;
      let dy = input.mouseDeltaY;

      cameraState.theta -= dx * 0.002;
      cameraState.phi -= dy * 0.002;
    }

    if ( input.keypress('w') ) {
      df += 1;
    }
    if ( input.keypress('s') ) {
      df -= 1;
    }
    if ( input.keypress('a') ) {
      dr -= 1;
    }
    if ( input.keypress('d') ) {
      dr += 1;
    }

    if ( input.mouseScrollY ) {
      df -= input.mouseScrollY * 0.05;
    }
  }

  function _tick (dt) {
    //
    curTheta = lerp( curTheta, cameraState.theta, dt * damping );
    curPhi = lerp( curPhi, cameraState.phi, dt * damping );

    //
    let eye = cameraState.eye;
    let theta = curTheta;
    let phi = curPhi;

    // phi == rot_x, theta == rot_y

    let rot = mat4.identity([]);
    let rotx = mat4.rotate([], rot, phi, [1,0,0]);
    let roty = mat4.rotate([], rot, theta, [0,1,0]);
    mat4.multiply(rot, roty, rotx);

    let front = vec4.transformMat4([], [0,0,-1,1], rot);
    let up = vec4.transformMat4([], [0,1,0,1], rot);
    let right = vec4.transformMat4([], [1,0,0,1], rot);

    if ( df !== 0 ) {
      vec4.scaleAndAdd(eye, eye, front, df * dt * moveSpeed);
    }

    if ( dr !== 0 ) {
      vec4.scaleAndAdd(eye, eye, right, dr * dt * moveSpeed);
    }

    if ( panZ !== 0 ) {
      let front2 = vec4.clone(front);
      front2[1] = 0.0;
      vec4.normalize(front2, front2);
      vec4.scaleAndAdd(eye, eye, front2, panZ * dt * moveSpeed);
    }

    if ( panX !== 0 ) {
      let right2 = vec4.clone(right);
      right2[1] = 0.0;
      vec4.normalize(right2, right2);
      vec4.scaleAndAdd(eye, eye, right2, panX * dt * moveSpeed);
    }

    if ( panY !== 0 ) {
      vec4.scaleAndAdd(eye, eye, [0,1,0,1], panY * dt * moveSpeed);
    }

    curEye = v3_lerp( curEye, eye, dt * damping );

    //
    mat4.lookAt(
      cameraState.view,
      curEye,
      vec4.scaleAndAdd([], curEye, front, 1.0),
      up
    );
  }

  let injectContext = regl({
    context: {
      view: cameraState.view,

      projection: ({viewportWidth, viewportHeight}) => {
        return mat4.perspective(
          cameraState.projection,
          Math.PI / 4.0,
          viewportWidth / viewportHeight,
          0.01,
          10000.0
        );
      }
    },

    uniforms: [
      'view', 'projection'
    ].reduce((uniforms, name) => {
      uniforms[name] = regl.context(name);
      return uniforms;
    }, {})
  });

  let last = 0;
  let time = 0;

  function updateCamera(input, block) {
    // get delta time
    let now = regl.now();
    let dt = 0;
    if (last) {
      dt = (now - last);
      time += dt;
    }
    last = now;

    // handle input
    _handleInput(input);

    // update camera
    _tick(dt);

    //
    injectContext(block);
  }

  return updateCamera;
};
