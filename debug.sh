#!/bin/zsh

# Start debugger.
node_modules/.bin/node-inspector --web-port=9090 &

if [ -x /usr/bin/open ]; then
  ( sleep 1 ; open 'http://localhost:9090/debug?port=5858' ) &
fi

# Start app.js.
node --debug app.js
