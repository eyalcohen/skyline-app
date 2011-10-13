#!/usr/bin/env node

var querystring = require('querystring');

process.stdout.write(
    querystring.escape(
        process.argv.slice(2).join(' ')
    ) + '\n'
);
