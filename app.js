'use strict';

const Editor = require('../index');

Editor.App.extend({
  init ( opts, cb ) {
    Editor.init({
      'selection': [ 'normal' ],
    });

    Editor.Profile.setDefault(`profile://local/settings.json`, {
      select: 'src/basic.js'
    });

    cb ();
  },

  run () {
    // create main window
    Editor.run('app://index.html', {
      title: 'REGL PlayGround',
      width: 800,
      height: 600,
      minWidth: 400,
      minHeight: 300,
      show: false,
      resizable: true,
    });
  },
});
