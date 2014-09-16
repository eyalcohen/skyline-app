#!/usr/bin/env node
/*
 * del_sample.js - delete all samples before a specific date
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .describe('query', 'Dataset query')
    .describe('param', 'Dataset query')
    .describe('date', 'Delete samples before this date')
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
var request = require('request');

/*
var db = require('../lib/db');
var com = require('../lib/common');
var mongodb = require('mongodb');
var samples = require('../lib/samples');
*/

/*
var date = new Date(argv.date);
var did = Number(argv.did);
if (!com.isValidDate(date)) {
  optimist.showHelp();
  process.exit(1);
}


console.log('Deleting samples on datasets');
*/

// For every real collection
// Locate all samples that fit dataset id
// Take all samples, and for each, check that the first array element is

boots.start(function (props) {

  var db = props.db

  Step(
    function () {
      db.Channels.list({}, this);
    },
    function (err, docs) {
      if (err || !docs || docs.length === 0) return this(err);

      var running = 0;
      var limit = 10;
      var next = this;
      var totalLength = docs.length;

      var uri = 'http://localhost:8083'

      function runStep() {
        while(running < limit && docs.length > 0) {
          var doc = docs.shift();
          var left =
            Math.floor((totalLength - docs.length) / totalLength * 100) + '%';
          console.log('fetch and insert for:', doc.channelName, left);
          running++;
          Step(
            function() {
              props.samples.fetchSamples(doc.parent_id, doc.channelName,
                  {type: 'real', beginTime: -1e50, endTime: 1e50 }, this);
            },
            function(err, samples) {
              if (err) return this(err);
              running--;
              var awake = null;
              var samples_ = _.map(samples, function(s) {
                return { time: s.beg/1000, value: s.val }
              });

              var sampleSet = {};
              sampleSet[doc.channelName] =
                { dataset: doc.parent_id, samples: samples_ };

              request( {
                uri: uri,
                method: 'post',
                json: JSON.stringify(sampleSet)
              }, this);
            },
            function (err, resp) {
              if (err) {
                console.log('exiting', err);
                process.exit(0);
              }
              if(docs.length > 0)
                runStep();
              return;

            }
          );
        }
      }

      runStep();

    },
    function (err, docs) {
      boots.error(err);
      console.log('Done');
      process.exit(0);
    }
  );

});
