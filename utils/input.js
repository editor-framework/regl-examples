'use strict';

let KEY_NONE = 0;
let KEY_DOWN = 1;
let KEY_PRESSING = 2;
let KEY_UP = 3;

let _mouseKeyNames = ['mouse-left', 'mouse-middle', 'mouse-right'];

class Input {
  constructor ( regl, opts ) {
    opts = opts || {};

    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseScrollX = 0;
    this.mouseScrollY = 0;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    this._regl = regl;
    this._pointerLocked = false;
    this._lastTime = 0;
    this._prevMouseX = 0;
    this._prevMouseY = 0;
    this._keyStates = {}; // 0: none, 1: down, 2: press, 3: up

    this._initEvents();
  }

  _initEvents () {
    this._mousemoveHandle = event => {
      event.stopPropagation();

      let canvasEL = this._regl._gl.canvas;
      let bcr = canvasEL.getBoundingClientRect();

      this.mouseDeltaX = event.movementX;
      this.mouseDeltaY = event.movementY;

      if ( this._pointerLocked ) {
        this.mouseX += event.movementX;
        this.mouseY += event.movementY;
      } else {
        this.mouseX = event.clientX - bcr.left;
        this.mouseY = event.clientY - bcr.top;
      }
    };

    this._mousewheelHandle = event => {
      event.stopPropagation();

      this.mouseScrollX = event.deltaX;
      this.mouseScrollY = event.deltaY;
    };

    this._mouseupHandle = event => {
      event.stopPropagation();

      this._keyStates[_mouseKeyNames[event.button]] = KEY_UP;
    };

    this._mousedownHandle = event => {
      event.stopPropagation();

      this._keyStates[_mouseKeyNames[event.button]] = KEY_DOWN;
    };

    // reigster canvas events
    let canvasEL = this._regl._gl.canvas;

    // handle keyboard
    canvasEL.addEventListener('keydown', event => {
      event.stopPropagation();

      // NOTE: do not reset KEY_DOWN when it already pressed
      if ( this._keyStates[event.key] !== KEY_PRESSING ) {
        this._keyStates[event.key] = KEY_DOWN;
      }
    });

    canvasEL.addEventListener('keyup', event => {
      event.stopPropagation();
      this._keyStates[event.key] = KEY_UP;
    });

    // handle mouse
    canvasEL.addEventListener('mousedown', event => {
      event.stopPropagation();

      // Editor.UI.addDragGhost('crosshair');
      document.body.requestPointerLock();

      let bcr = canvasEL.getBoundingClientRect();

      this.mouseX = this._prevMouseX = event.clientX - bcr.left;
      this.mouseY = this._prevMouseY = event.clientY - bcr.top;

      this._keyStates[_mouseKeyNames[event.button]] = KEY_DOWN;
      this._pointerLocked = true;

      document.addEventListener('mousemove', this._mousemoveHandle);
      document.addEventListener('mouseup', this._mouseupHandle);
      document.addEventListener('mousewheel', this._mousewheelHandle);

      // NOTE: this is possible when multiple button press down
      document.addEventListener('mousedown', this._mousedownHandle);
    });

    canvasEL.addEventListener('mousemove', this._mousemoveHandle);
    canvasEL.addEventListener('mousewheel', this._mousewheelHandle);

    canvasEL.addEventListener('mouseenter', event => {
      event.stopPropagation();

      let bcr = canvasEL.getBoundingClientRect();

      this.mouseDeltaX = 0.0;
      this.mouseDeltaY = 0.0;

      this._prevMouseX = this.mouseX = event.clientX - bcr.left;
      this._prevMouseY = this.mouseY = event.clientY - bcr.top;
    });

    canvasEL.addEventListener('mouseleave', event => {
      event.stopPropagation();

      let bcr = canvasEL.getBoundingClientRect();

      this.mouseDeltaX = event.movementX;
      this.mouseDeltaY = event.movementX;

      this._prevMouseX = this.mouseX = event.clientX - bcr.left;
      this._prevMouseY = this.mouseY = event.clientY - bcr.top;
    });
  }

  keydown (name) {
    return this._keyStates[name] === KEY_DOWN;
  }

  keypress (name) {
    return this._keyStates[name] === KEY_DOWN ||
      this._keyStates[name] === KEY_PRESSING;
  }

  keyup (name) {
    return this._keyStates[name] === KEY_UP;
  }

  reset () {
    this._prevMouseX = this.mouseX;
    this._prevMouseY = this.mouseY;

    this.mouseScrollX = 0;
    this.mouseScrollY = 0;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    // update key-states
    for ( let name in this._keyStates ) {
      let state = this._keyStates[name];
      if ( state === KEY_DOWN ) {
        this._keyStates[name] = KEY_PRESSING;
      } else if ( state === KEY_UP ) {
        this._keyStates[name] = KEY_NONE;
      }
    }

    // check if remove drag-ghost
    if (
      this.keypress('mouse-left') === false &&
      this.keypress('mouse-middle') === false &&
      this.keypress('mouse-right') === false
    ) {
      // Editor.UI.removeDragGhost();
      document.exitPointerLock();

      document.removeEventListener('mousemove', this._mousemoveHandle);
      document.removeEventListener('mouseup', this._mouseupHandle);
      document.removeEventListener('mousewheel', this._mousewheelHandle);
      document.removeEventListener('mousedown', this._mousedownHandle);

      this._pointerLocked = false;
    }
  }
}

module.exports = Input;

