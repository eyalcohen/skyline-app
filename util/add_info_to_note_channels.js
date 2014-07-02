#!/usr/bin/env node
/*
 *
 */
 
// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;
 
if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}
 
// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var db = require('../lib/db');
var profiles = require('../lib/resources').profiles;
 
boots.start(function (client) {

  Step(
    function () {
      db.Notes.list({}, this);
    },
    function (err, docs) {
      boots.error(err);

      if (docs.length === 0) return this();
      var _this = _.after(docs.length, this);
      _.each(docs, function (d) {
        if (!d.channels || d.channels.length === 0) return _this();
        var channels = [];
        var __this = _.after(d.channels.length, function (err) {
          boots.error(err);
          db.Notes._update({_id: d._id}, {$set: {channels: channels}}, _this);
        });
        _.each(d.channels, function (c) {
          db.Channels.read({channelName: c.channelName}, {inflate: {author: profiles.user}},
              function (err, channel) {
            boots.error(err);
            if (channel) {
              channels.push(_.extend(_.clone(c), {
                did: channel.parent_id,
                username: channel.author.username
              }));
            }
            __this();
          })
        });
      });
    },

    function (err) {
      boots.error(err);
      process.exit(0);
    }
  );
 
});
