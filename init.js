'use strict';

const Electron = require('electron');
const REGL = require('regl');

document.addEventListener('readystatechange', () => {
  if ( document.readyState !== 'complete' ) {
    return;
  }

  let canvasEL = document.getElementById('canvas');
  let selectEL = document.getElementById('select');
  let reloadEL = document.getElementById('reload');
  let profile = null;

  //
  window.requestAnimationFrame(() => {
    _resize(canvasEL);
  });

  // events

  // on window-resize
  window.addEventListener('resize', () => {
    _resize(canvasEL);
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
    //
    let regl = window._regl;
    if ( regl ) {
      regl.destroy();
      regl = null;
    }

    //
    regl = REGL({
      canvas: canvasEL,
      extensions: [
        'OES_texture_float',
        'OES_texture_float_linear'
      ]
    });
    window._regl = regl;

    //
    path = Editor.url(`app://${path}`);
      if (reload) {
      delete require.cache[path];
    }

    let fn = require(path);
    if (fn) {
      fn(regl);
    }
  }

  function _resize ( canvasEL ) {
    let bcr = canvasEL.parentElement.getBoundingClientRect();
    canvasEL.width = bcr.width;
    canvasEL.height = bcr.height;
  }
});
