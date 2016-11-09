'use strict';

const Electron = require('electron');
const REGL = require('regl');

document.addEventListener('readystatechange', () => {
  if ( document.readyState !== 'complete' ) {
    return;
  }

  let viewEL = document.getElementById('view');
  let selectEL = document.getElementById('select');
  let reloadEL = document.getElementById('reload');
  let profile = null;

  //
  window.requestAnimationFrame(() => {
    _resize();
  });

  // events

  // on window-resize
  window.addEventListener('resize', () => {
    _resize();
  });

  // on select-changed
  selectEL.addEventListener('confirm', event => {
    let path = event.target.value;

    profile.data.select = path;
    profile.save();

    _exec(path, false);
  });

  // on reload
  reloadEL.addEventListener('confirm', () => {
    _exec(selectEL.value, true);
  });

  //
  Electron.ipcRenderer.on('app:reload', (event, path) => {
    if ( path === selectEL.value ) {
      _exec(path, true);
    }
  });

  // load profile
  Editor.Profile.load('profile://local/settings.json', (err, pf) => {
    profile = pf;

    selectEL.value = profile.data.select;
    _exec(selectEL.value, false);
  });

  function _exec ( path, reload ) {
    _reset();

    //
    path = Editor.url(`app://${path}`);
    if (reload) {
      delete require.cache[path];
    }

    let fn = require(path);
    if (fn) {
      fn(window._regl);
    }

    // clear caches
    Electron.webFrame.clearCache();
    // console.log(Electron.webFrame.getResourceUsage());
  }

  function _reset () {
    console.clear();

    //
    if ( window._regl ) {
      window._regl.destroy();
      window._regl = null;
      Editor.UI.clear(viewEL);
    }

    //
    let regl = REGL({
      container: viewEL,
      extensions: [
        'OES_texture_float',
        'OES_texture_float_linear',
        'OES_standard_derivatives'
      ]
    });
    regl._gl.canvas.tabIndex = -1;

    //
    window._regl = regl;
  }

  function _resize () {
    let canvasEL = document.querySelector('canvas');
    if ( canvasEL ) {
      let bcr = canvasEL.parentElement.getBoundingClientRect();
      canvasEL.width = bcr.width;
      canvasEL.height = bcr.height;
    }
  }
});
