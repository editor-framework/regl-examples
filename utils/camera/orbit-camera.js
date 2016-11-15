'use strict';

const {mat4} = require('gl-matrix');

module.exports = function (regl, props) {
  let cameraState = {
    view: mat4.identity([]),
    projection: mat4.identity([]),
    center: props.center || [0, 0, 0],
    theta: props.theta || 0,
    phi: props.phi || 0,
    distance: Math.log(props.distance || 10.0),
    eye: [0, 0, 0],
    up: props.up || [0, 1, 0]
  };

  let right = [1, 0, 0];
  let front = [0, 0, 1];

  let minDistance = Math.log('minDistance' in props ? props.minDistance : 1);
  let maxDistance = Math.log('maxDistance' in props ? props.maxDistance : 100);

  let curTheta = cameraState.theta;
  let curPhi = cameraState.phi;
  let curDistance = cameraState.distance;

  function lerp (from, to, ratio) {
    return from + (to - from) * ratio;
  }

  function clamp (x, lo, hi) {
    return Math.min(Math.max(x, lo), hi);
  }

  function _handleInput (input, dt) {
    if ( input.keypress('mouse-left') ) {
      let dx = input.mouseDeltaX * dt * 0.2;
      let dy = input.mouseDeltaY * dt * 0.2;
      let w = Math.max(cameraState.distance, 2.0);

      cameraState.theta += w * dx;
      cameraState.phi += w * dy;
    }

    cameraState.distance = clamp(
      cameraState.distance + input.mouseScrollY * 0.002,
      minDistance,
      maxDistance
    );
  }

  function _tick (dt) {
    curTheta = lerp( curTheta, cameraState.theta, dt * 10.0 );
    curPhi = lerp( curPhi, cameraState.phi, dt * 10.0 );
    curDistance = lerp( curDistance, cameraState.distance, dt * 10.0 );

    let center = cameraState.center;
    let eye = cameraState.eye;
    let up = cameraState.up;

    let theta = curTheta;
    let phi = curPhi;
    let r = Math.exp(curDistance);

    // phi == rot_x, theta == rot_y

    let vr = -r * Math.cos(phi) * Math.sin(theta);
    let vu =  r * Math.sin(phi);
    let vf =  r * Math.cos(phi) * Math.cos(theta);

    for (let i = 0; i < 3; ++i) {
      eye[i] = center[i] + vr * right[i] + vu * up[i] + vf * front[i];
    }

    // up rotated (re-adjusted)
    let up2 = [
      Math.sin(phi) * Math.sin(theta),
      Math.cos(phi),
     -Math.sin(phi) * Math.cos(theta)
    ];

    //
    mat4.lookAt(cameraState.view, eye, center, up2);
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
          1000.0
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

    // update camera
    _handleInput(input, dt);
    _tick(dt);

    //
    injectContext(block);
  }

  return updateCamera;
};
