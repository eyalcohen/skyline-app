/*!
 * Copyright 2011 Mission Motors
 */

define({
  makeId: function () {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'+
        'abcdefghijklmnopqrstuvwxyz0123456789';
    for( var i=0; i < 5; i++ )
      text += possible.charAt(Math.floor(
            Math.random() * possible.length));
    return text;
  },
});
