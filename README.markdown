*Stand-in web server for receiving drive cycle requests from an Android app,
inserting them into a MongoDB instance, and serving this data to web clients.*

You'll also need protobuf-for-node in your $NODE_PATH.  Then you should be able to run:

    node app.js

or `npm install -g nodemon' and then:

    nodemon app.js

**Client-side JavaScript Libraries**

- [Backbone.js](http://documentcloud.github.com/backbone/) for client-side framework
- [Browserify](https://github.com/substack/node-browserify) for server-client code sharing
- [RequireJS](http://requirejs.org/) for file and module loading
- [jQuery](http://jquery.com/) for HTML document traversing, event handling, animating
- [Flot](http://code.google.com/p/flot/) for graphing
- [MinPubSub](https://github.com/daniellmb/MinPubSub) for PubSub
- [Store](https://github.com/marcuswestin/store.js) for cross browser local storage
- [Modernizr](http://www.modernizr.com/) for cross browser HTML5 and CSS3 support

