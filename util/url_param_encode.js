#!/usr/bin/env node

var querystring = require('querystring');

var obj = {};
process.argv.slice(2).forEach(function(arg) {
  var m = arg.match(/^([^=]*)=(.*)$/);
  if (m)
    obj[m[1]] = m[2];
  else
    obj[arg] = null;
});
process.stdout.write(querystring.stringify(obj) + '\n');
