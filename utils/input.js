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

    this._regl = regl;
    this._grabbingMouse = false;
    this._lastTime = 0;
    this._prevMouseX = 0;
    this._prevMouseY = 0;
    this._keyStates = {}; // 0: none, 1: down, 2: press, 3: up

    let canvasEL = regl._gl.canvas;

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

      Editor.UI.addDragGhost('crosshair');

      let bcr = canvasEL.getBoundingClientRect();

      this.mouseX = this._prevMouseX = event.clientX - bcr.left;
      this.mouseY = this._prevMouseY = event.clientY - bcr.top;

      this._keyStates[_mouseKeyNames[event.button]] = KEY_DOWN;
      this._grabbingMouse = true;

      this._mousemoveHandle = event => {
        event.stopPropagation();

        let bcr = canvasEL.getBoundingClientRect();

        this.mouseX = event.clientX - bcr.left;
        this.mouseY = event.clientY - bcr.top;
      };

      this._mouseupHandle = event => {
        event.stopPropagation();

        let bcr = canvasEL.getBoundingClientRect();

        this.mouseX = event.clientX - bcr.left;
        this.mouseY = event.clientY - bcr.top;

        this._keyStates[_mouseKeyNames[event.button]] = KEY_UP;
      };

      this._mousewheelHandle = event => {
        event.stopPropagation();

        this.mouseScrollX = event.deltaX;
        this.mouseScrollY = event.deltaY;
      };

      // NOTE: this is possible, for multiple buttons pressed
      this._mousedownHandle = event => {
        event.stopPropagation();

        this._keyStates[_mouseKeyNames[event.button]] = KEY_DOWN;
      };

      document.addEventListener('mousemove', this._mousemoveHandle);
      document.addEventListener('mouseup', this._mouseupHandle);
      document.addEventListener('mousewheel', this._mousewheelHandle);
      document.addEventListener('mousedown', this._mousedownHandle);
    });

    canvasEL.addEventListener('mousemove', event => {
      event.stopPropagation();

      let bcr = canvasEL.getBoundingClientRect();

      this.mouseX = event.clientX - bcr.left;
      this.mouseY = event.clientY - bcr.top;
    });

    canvasEL.addEventListener('mousewheel', event => {
      event.stopPropagation();

      this.mouseScrollX = event.deltaX;
      this.mouseScrollY = event.deltaY;
    });

    canvasEL.addEventListener('mouseenter', event => {
      event.stopPropagation();

      let bcr = canvasEL.getBoundingClientRect();

      this._prevMouseX = this.mouseX = event.clientX - bcr.left;
      this._prevMouseY = this.mouseY = event.clientY - bcr.top;
    });

    canvasEL.addEventListener('mouseleave', event => {
      event.stopPropagation();

      let bcr = canvasEL.getBoundingClientRect();

      this._prevMouseX = this.mouseX = event.clientX - bcr.left;
      this._prevMouseY = this.mouseY = event.clientY - bcr.top;
    });
  }

  get mouseDeltaX () {
    return this.mouseX - this._prevMouseX;
  }

  get mouseDeltaY () {
    return this.mouseY - this._prevMouseY;
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
      Editor.UI.removeDragGhost();

      document.removeEventListener('mousemove', this._mousemoveHandle);
      document.removeEventListener('mouseup', this._mouseupHandle);
      document.removeEventListener('mousewheel', this._mousewheelHandle);
      document.removeEventListener('mousedown', this._mousedownHandle);

      this._grabbingMouse = false;
    }
  }
}

module.exports = Input;

