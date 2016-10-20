'use strict';

const Electron = require('electron');
const REGL = require('regl');

function _exec ( regl, path, reload ) {
  path = Editor.url(`app://${path}`);

  if (reload) {
    delete require.cache[path];
  }

  let fn = require(path);
  if (fn) {
    regl.destroy();
    fn(regl);
  }
}

function _resize ( canvasEL ) {
  let bcr = canvasEL.parentElement.getBoundingClientRect();
  canvasEL.width = bcr.width;
  canvasEL.height = bcr.height;
}

document.addEventListener('readystatechange', () => {
  if ( document.readyState !== 'complete' ) {
    return;
  }

  let canvasEL = document.getElementById('canvas');
  let selectEL = document.getElementById('select');
  let reloadEL = document.getElementById('reload');
  let profile = null;

  let regl = REGL({
    canvas: canvasEL
  });

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

    _exec(regl, path, false);
  });

  // on reload
  reloadEL.addEventListener('confirm', () => {
    _exec(regl, selectEL.value, true);
  });

  //
  Electron.ipcRenderer.on('app:reload', (event, path) => {
    if ( path === selectEL.value ) {
      _exec(regl, path, true);
    }
  });

  // add regl to global for debug
  window.regl = regl;

  // load profile
  Editor.Profile.load('profile://local/settings.json', (err, pf) => {
    profile = pf;

    selectEL.value = profile.data.select;
    _exec(regl, selectEL.value, false);
  });
});
