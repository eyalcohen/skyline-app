/*
 * dataset.js: Handling for the dataset resource.
 *
 */

// Module Dependencies
var Job = require('cron').CronJob;
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('../db');
var com = require('../common');
var profiles = require('../resources').profiles;
var Samples = require('../samples');
var CSV = require('csv');

// For Protobuf insertion
var fs = require('fs');
var zlib = require('zlib');
var traverse = require('traverse');
var User = require('../resources/user');
var reds = require('reds');

var EventDescFileName = 'protobuf/Events.desc';
var WebUploadSamples;
try {
  var ProtobufSchema = require('protobuf').Schema;
  var Event = new ProtobufSchema(fs.readFileSync(EventDescFileName));
  WebUploadSamples = Event['event.WebUploadSamples'];
} catch (e) {
  console.log('Could not load proto buf ' + EventDescFileName +
      ', upload APIs won\'t work!');
}

/*
var WebUploadSamples = new pbuf(fs.readFileSync('protobuf/SkylineV2.proto'));
console.log(WebUploadSamples);
  WebUploadSamples = Event['event.WebUploadSamples'];
*/

/* e.g.,
  {
    "_id": <Number>,
    "public": <Boolean>,
    "title": <String>,
    "file": {
      "size": <Number>,
      "type": <String>,
    },
    "meta": {
      "beg": <Number>,
      "end": <Number>,
      "channel_cnt": <Number>,
    },
    "client_id": <Number>,
    "author_id": <ObjectId>,
    "parent_id": <ObjectId>,
    "created": <ISODate>,
    "updated": <ISODate>,
  }
*/

// Do any initializations
exports.init = function (app) {
  return exports;
};

// Define routes.
exports.routes = function (app) {
  var pubsub = app.get('pubsub');
  var samples = app.get('samples');
  var search = app.get('reds').createSearch('datasets');

  // List
  app.post('/api/datasets/list', function (req, res) {
    var cursor = req.body.cursor || 0;
    var limit = req.body.limit || 10;
    var query = req.body.query || {};

    // Handle author filter.
    if (query.author_id) query.author_id = db.oid(query.author_id);

    // Handle public/private.
    if (!query.author_id || !req.user
        || req.user._id.toString() !== query.author_id.toString())
      query.public = {$ne: false};

    db.Datasets.list(query, {sort: {created: -1}, limit: limit,
        skip: limit * cursor, inflate: {author: profiles.user}},
        function (err, datasets) {
      if (com.error(err, req, res)) return;

      Step(
        function () {
          return this();
          // if (datasets.length === 0) return this();

          // // Get parent authors.
          // var _this = _.after(datasets.length, this);
          // _.each(datasets, function (d) {
          //   db.inflate(d.parent, {author: profiles.user}, _this);
          // });
        },
        function (err) {

          // Send profile.
          res.send(com.client({
            datasets: {
              cursor: ++cursor,
              more: datasets && datasets.length === limit,
              items: datasets,
              query: query,
            }
          }));
        }
      );

    });

  });

  //  Parameters available in query URL:
  //   beg=<beginTime>,end=<endTime> Time range to fetch.
  //   resample=<resolution> Resample data to provided duration.
  //   minDuration=<duration> Approximate minimum duration to fetch.
  //   minmax Include minimum and maximum values.
  //   chan=<name1>,chan=<name2>,... Channels to fetch.  Channels are channelName_id
  // There are a few special channels:
  //   $beginDate: Begin date, e.g. '2011-09-06'.
  //   $beginTime: Begin time, e.g. '16:02:23'.
  //   $beginAbsTime: Begin time in seconds since epoch, e.g. 1309914166.385.
  //   $beginRelTime: Begin time in seconds since first sample, e.g. 6.385.
  //   $endDate/$endTime/$endAbsTime/$endRelTime: End time.
  //   $duration: Duration in seconds, e.g. '0.01234'.
  // Example: curl 'http://localhost:8080/datasets/123456?beg=1309914019674000&end=1309916383000000&chan=$beginDate&chan=$beginTime&chan=$beginAbsTime&chan=$duration&chan=$beginRelTime&chan=$endRelTime&chan=gps.speed_m_s&chan=gps.latitude_deg&chan=gps.longitude_deg&chan=gps.altitude_m&chan=accel.x_m_s2&minDuration=10000000&minmax'
  app.get('/api/datasets', function (req, res, next) {

    function numParam(name, required) {
      var v = req.query[name];
      if (!v && required)
        throw new Error('Parameter ' + name + ' is required.');
      if (!v) return null;
      var n = Number(v);
      if (isNaN(n))
        throw new Error('Parameter ' + name + ': "' + v + '" is not a number.');
      return n;
    }
    /**
     * Wraps a callback f to simplify error handling.  Specifically, this:
     *   asyncFunction(..., errWrap(cb, function (arg) {
     *     ...
     *     cb(...);
     *   }));
     * is equivalent to:
     *   asyncFunction(..., function (err, arg) {
     *     if (err) { cb(err); return; }
     *     try {
     *       ...
     *       cb(...);
     *     } catch (err2) {
     *       cb(err2);
     *     }
     *   }));
     */
    function errWrap(next, f) {
      return function (err) {
        if (err) { next(err); return; }
        try {
          f.apply(this, Array.prototype.slice.call(arguments, 1));
        } catch (err) {
          next(err);
        }
      };
    }

    if (_.isEmpty(req.query)) {
      return next();
    }

    try {
      var resample = numParam('resample');
      var beginTime = numParam('beg', resample !== null);
      var endTime = numParam('end', resample !== null);
      var minDuration = numParam('minDuration');
      if (resample !== null && minDuration === null)
        minDuration = Math.ceil(resample / 4);
      var getMinMax = 'minmax' in req.query;
      var channels = req.query.chan || [];
      if (_.isString(channels)) channels = [channels];
      if (!channels.length || (resample !== null && resample < 1))
        return next('BAD_PARAM');  // TODO: better error
    } catch (err) {
      return next(err.toString());
    }

    res.contentType('.csv');
    var csv = CSV().to.stream(res, { rowDelimiter: 'windows', end: false });
    var humanNames = [];
    var sampleSet = {};
    var samplesSplit;

    Step(
      function fetchData() {
        var parallel = this.parallel;
        // Fetch channels.
        channels.forEach(function (channelName) {
          if (channelName[0] === '$') return;
          var next = parallel();
          var fetchOptions = {
            beginTime: beginTime, endTime: endTime,
            minDuration: minDuration, getMinMax: getMinMax
          };
          var did = Number(channelName.split('__')[1]);
          var name = channelName.split('__')[0];
          samples.fetchSamples(did, channelName, fetchOptions,
                               errWrap(next, function (samples_) {
            if (resample !== null)
              samples_ = samples.resample(samples_, beginTime, endTime, resample);
            sampleSet[channelName] = samples_;
            next();
          }));
          humanNames.push(name);
        });
      },

      function reorganize(err) {
        if (err)
          console.log('Error during CSV sample fetch: ' + err + '\n' + err.stack);
        samplesSplit = samples.splitSamplesByTime(sampleSet);
        this();
      },

      function writeData(err) {
        if (err) return this(err);

        // Write UTF-8 signature, so that Excel imports CSV as UTF-8.
        // Unfortunately, this doesn't seem to work with all Excel versions. Boo.
        //res.write(new Buffer([0xEF, 0xBB, 0xBF]));

        // Write header.
        var header = [];
        var specialRE = /^\$(begin|end)(Date|Time|AbsTime|RelTime)$/;
        channels.forEach(function (channelName) {
          var m = channelName.match(specialRE);
          if (m) {
            header.push(
                (m[1] === 'end' ? 'End ' : 'Begin ') +
                (m[2] === 'Date' ? 'Date' :
                 m[2] === 'Time' ? 'Time' :
                 m[2] === 'AbsTime' ? 'Since 1970 (s)' :
                 m[2] === 'RelTime' ? 'Since Start (s)' : ''));
          } else if (channelName === '$duration') {
            header.push('Duration (s)');
          } else {
            header.push(humanNames.shift());
            /*
            var channelSchema = schema[channelName];
            var description = channelName;
            if (channelSchema && channelSchema.val.humanName)
              description = channelSchema.val.humanName;
            if (channelSchema && channelSchema.val.units)
              description += ' (' + channelSchema.val.units + ')';
            header.push(description);
            */
            if (getMinMax) {
              header.push('min');
              header.push('max');
            }
          }
        });
        csv.write(header);

        // Write data.
        var firstBeg = null;
        samplesSplit.forEach(function (sampleGroup) {
          var beg = sampleGroup.beg, end = sampleGroup.end;
          if (firstBeg === null) firstBeg = beg;
          // TODO: What about time zones?
          // See zoneinfo npm and
          //   https://bitbucket.org/pellepim/jstimezonedetect/wiki/Home
          // TOOD: i18n?
          var date = new Date(beg / 1000);
          var line = [];
          channels.forEach(function (channelName) {
            var m = channelName.match(specialRE);
            if (m) {
              var t = (m[1] === 'end' ? end : beg), d = new Date(t / 1e3);
              line.push(
                  m[2] === 'Date' ?
                      _.sprintf('%d-%02d-%02d',
                                d.getFullYear(), d.getMonth() + 1, d.getDate()) :
                  m[2] === 'Time' ?
                      _.sprintf('%02d:%02d:%02d',
                                d.getHours(), d.getMinutes(), d.getSeconds()) :
                  m[2] === 'AbsTime' ? t / 1e6 :
                  m[2] === 'RelTime' ? (t - firstBeg) / 1e6 : '');
            } else if (channelName === '$duration') {
              line.push((end - beg) / 1e6);
            } else {
              var s = sampleGroup.val[channelName];
              var val = (s === null ? '' : s.val);
              if (!(_.isNumber(val) || _.isString(val)))
                val = util.inspect(val);
              line.push(val);
              if (getMinMax) {
                line.push(s === null || s.min === null ? '' : s.min);
                line.push(s === null || s.max === null ? '' : s.max);
              }
            }
          });
          csv.write(line);
        });

        csv.write([]); // Make sure there's a terminating newline.
        csv.end();
        res.end();
      },

      next
    );
  });

  // Simply returns a JSON object about the dataset
  app.get('/api/datasets/:id', function (req, res) {

    // TODO: private/public - authenticate user.
    db.Datasets.read({_id: Number(req.params.id)},
        {inflate: {author: profiles.user}}, function (err, doc) {
      if (com.error(err, req, res, doc, 'dataset')) return;

      Step(
        function () {
          db.fill(doc, 'Notes', 'parent_id', {sort: {beg: -1},
              inflate: {author: profiles.user}}, this.parallel());
          db.fill(doc, 'Comments', 'parent_id', {sort: {created: -1},
              limit: 5, inflate: {author: profiles.user}}, this.parallel());
          db.fill(doc, 'Channels', 'parent_id', this.parallel());
        },
        function (err, notes, comments, channels) {
          if (com.error(err, req, res)) return;
          res.send(com.client(doc));
        }
      );
    });
  });

  // Update
  app.put('/api/datasets/:id', function (req, res) {

    // FIXME
    res.send();
  });

  // Delete
  app.delete('/api/datasets/:id', function (req, res) {
    if (!req.user)
      return res.send(403, {error: 'User invalid'});

    // Get the dataset.
    db.Datasets.read({_id: Number(req.params.id)}, function (err, doc) {
      if (com.error(err, req, res, doc, 'dataset')) return;
      if (req.user._id.toString() !== doc.author_id.toString())
        return res.send(403, {error: 'User invalid'});

      // Get the event (from creation).
      db.Events.read({action_id: doc._id}, function (err, event) {
        if (com.error(err, req, res)) return;

        Step(
          function () {

            // Remove notifications for events where dataset is target.
            db.Events.list({target_id: doc._id}, _.bind(function (err, events) {
              if (events.length === 0) return this();
              var _this = _.after(events.length, this);
              _.each(events, function (e) {

                // Publish removed status.
                pubsub.publish('event', 'event.removed', {data: e});

                db.Notifications.list({event_id: e._id}, function (err, notes) {

                  // Publish removed statuses.
                  _.each(notes, function (note) {
                    pubsub.publish('usr-' + note.subscriber_id.toString(),
                        'notification.removed', {data: {id: note._id.toString()}});
                  });
                });
                db.Notifications.remove({event_id: e._id}, _this);
              });
            }, this));
          },
          function (err) {
            if (err) return this(err);

            // Get notes on this dataset.
            db.Notes.list({parent_id: doc._id}, this.parallel());

            // Get all channels
            db.Channels.list({parent_id: doc._id}, this.parallel());
          },
          function (err, notes, channels) {
            if (err) return this(err);

            // Publish channel removed.
            _.each(channels, function (c) {
              pubsub.publish('channel', 'channel.removed', {data: {id: c._id.toString()}});
            });

            // Remove content on dataset.
            db.Notes.remove({parent_id: doc._id}, this.parallel());
            db.Comments.remove({$or: [{parent_id: {$in: _.pluck(notes, '_id')}},
                {parent_id: doc._id}]}, this.parallel());
            db.Subscriptions.remove({subscribee_id: doc._id}, this.parallel());
            db.Events.remove({$or: [{target_id: doc._id}, {action_id: doc._id}]},
                this.parallel());
            db.Channels.remove({parent_id: doc._id}, this.parallel());

            // Remove the dataset from views that contain it.
            var key = 'datasets.' + doc._id;
            var query = {};
            query[key] = {$exists: true};
            var update = {$unset: {}};
            update.$unset[key] = true;
            db.Views.update(query, update, {multi: true}, this.parallel());

            // Remove samples for this dataset.
            samples.removeDataset(doc._id, this.parallel());

            // Finally, remove the dataset.
            db.Datasets.remove({_id: doc._id}, this.parallel());

            // Remove from search cache.
            search.remove(doc._id, this.parallel());
          },
          function (err) {
            if (com.error(err, req, res)) return;

            // Publish removed status.
            if (event) {
              pubsub.publish('event', 'event.removed', {data: event});
            }
            pubsub.publish('dataset', 'dataset.removed', {data: {id: doc._id.toString()}});

            res.send({removed: true});
          }
        );
      });
    });

  });

  // Search
  app.post('/api/datasets/search/:s', function (req, res) {
    var author_id = req.body.author_id ? db.oid(req.body.author_id): null;

    // Perform the search.
    search.query(req.params.s).end(function (err, ids) {
      Step(
        function () {

          // Check results.
          if (ids.length === 0) return this();

          // Map to numeric ids.
          var _ids = _.map(ids, function (id) {
            return Number(id);
          });

          // Get the matching datasets.
          var query = {_id: {$in: _ids}, $or: [{public: {$ne: false}}]};
          if (req.user) query.$or.push({author_id: req.user._id});
          if (author_id) query.author_id = author_id;
          db.Datasets.list(query, {sort: {created: 1},
              inflate: {author: profiles.user}}, this);
        },
        function (err, docs) {
          if (com.error(err, req, res)) return;

          Step(
            function () {
              if (docs.length === 0) return this();

              // Get parent authors.
              var _this = _.after(docs.length, this);
              _.each(docs, function (d) {
                db.inflate(d.parent, {author: profiles.user}, _this);
              });
            },
            function (err) {

              // Send profile.
              res.send(com.client({items: docs || []}));
            }
          );
        }
      );
    }, 'or');
  });

  /*
   * Test with:
   * curl -X PUT -d @/tmp/1392127277374.pbraw.gz -H "Content-Type: application/x-gzip" http://localhost:8080/samples
   */
  app.put('/api/datasets', function (req, res) {

    function requestMimeType(req) {
      return (req.headers['content-type'] || '').split(';')[0];
    }

    // Parse to JSON.
    var uploadSamples;

    var usr, veh, fname;
    var datasetId, userId;
    var sampleSet = {};
    var datasetDoc = {};
    var userDoc = {};

    var firstError;
    Step(
      function parseSamples() {
        var mimeType = requestMimeType(req);
        if (mimeType == 'application/x-gzip') {

/*  File storage turned off
          var fileName = (new Date()).valueOf() + '.pbraw.gz';
          fs.mkdir(__dirname + '/samples', '0755', function (err) {
            fs.writeFile(__dirname + '/samples/' + fileName,
                        req.rawBody, null, function (err) {
              if (err) console.log(err);
              else
                console.log('Saved to: ' + __dirname + '/samples/' + fileName);
            });
          });
*/

          var next = this;
          Step(
            function() {
              zlib.unzip(new Buffer(req.rawBody, 'binary'), this);
            }, function(err, unzipped) {
              if (err) {
                this(err);
              } else {
                uploadSamples = WebUploadSamples.parse(unzipped);
                this();
              }
            }, next
          );
        } else if (mimeType == 'application/octet-stream') {
/*  File storage turned off
          var fileName = (new Date()).valueOf() + '.pbraw';
          fs.mkdir(__dirname + '/samples', '0755', function (err) {
            fs.writeFile(__dirname + '/samples/' + fileName,
                        req.rawBody, null, function (err) {
              if (err) console.log(err);
              else
                console.log('Saved to: ' + __dirname + '/samples/' + fileName);
            });
          });
*/

          uploadSamples =
              WebUploadSamples.parse(new Buffer(req.rawBody, 'binary'));
          this();
        } else if (mimeType == 'application/json') {
          uploadSamples = req.body;
          this();
        } else {
          throw ('BAD_ENCODING:' + mimeType);
        }
      },
      function getDataset(err) {
        if (err) return this(err);
        datasetId = uploadSamples.vehicleId;
        userId = uploadSamples.userId;
        db.Datasets.read({_id: Number(datasetId)},
                         {inflate: {author: profiles.user}},
                         this.parallel());
        db.Users.read({username: userId}, {}, this.parallel());
      },
      // user and dataset authentication, or else creation
      function (err, datasetDoc_, userDoc_) {
        if (err) return this(err);
        datasetDoc = datasetDoc_;
        userDoc = userDoc_;
        // Create dataset.
        // TODO: We need to password authenticate the user somehow
        // Create the user and dataset
        if (datasetDoc) {
          if (!userDoc || userDoc && datasetDoc.author
              && datasetDoc.author.username !== userDoc.username) {
            this('This user does not have access to this dataset');
          }
        }
        // Create user, if it doesn't exist
        if (!userDoc) {
          var props = { newusername: userId,
                        newpassword: userId,
                        newemail: userId + '@unknown.com' };
          User.createUser(props, this);
        } else {
          this(null, userDoc);
        }
      },
      // Now that we have a user, create a dataset if necessary
      function (err, user) {
        if (err) return this(err);
        if (!datasetDoc) {
          var props = {
            _id: datasetId,
            public: 'false',
            title: datasetId.toString(),
            description: '',
            source: 'API',
            sourceLink: '',
            tags: '',
            file: '',
            author_id: user._id,
            client_id: com.createId_32(),
          };
          db.Datasets.create(props, {inflate: {author: profiles.user}}, this);
        } else {
          this(null);
        }
      },
      function (err, doc) {
        if (err) return this(err);
        if (doc) {
          datasetDoc = doc;
        }
        com.index(reds.createSearch('users'), userDoc, ['userName', 'displayName']);
        com.index(reds.createSearch('datasets'), datasetDoc, ['title', 'sources', 'tags']);
        this();
      },
      // Store the data in the database.
      function (err) {
        if (err) return this(err);

        _.each(uploadSamples.schema, function(s) {
          var tmp = s.channelName.replace(/[\/.]/g, '_');
          s.humanName = tmp.replace(/_/g, ' ');
          s.channelName = tmp + '__' + datasetDoc._id;
          s.merge = true;
        });

        // Process samples.
        uploadSamples.sampleStream.forEach(function (sampleStream) {
          var begin = 0, duration = 0;
          sampleStream.sample.forEach(function (upSample) {
            begin += +upSample.beginDelta;  // Delta decode.
            duration += +upSample.durationDelta;  // Delta decode.
            var val = upSample.valueFloat;
            if (val === null) val = upSample.valueInt;
            if (val === null) val = upSample.valueString;
            if (val === null) val = upSample.valueBool;
            if (val === null) val = _.toArray(upSample.valueBytes);  // raw->Buffer
            if (val === null) {
              firstError = firstError || ('SAMPLE_NO_VALUE');
              return;
            }
            var sample = { beg: begin, end: begin + duration, val: val };
            var schema = uploadSamples.schema[upSample.schemaIndex];
            if (!schema) {
              firstError = firstError || ('SAMPLE_NO_SCHEMA_FOUND');
              return;
            }
            if (!sampleSet[schema.channelName])
              sampleSet[schema.channelName] = [sample];
            else
              sampleSet[schema.channelName].push(sample);
          });
        });

        _.each(uploadSamples.schema, function(s) {
          s.beg = _.first(sampleSet[s.channelName]).beg;
          s.end = _.last(sampleSet[s.channelName]).end;
        });

/*
        if (uploadSamples.protocolVersion < 2) {
          // HACK: Heuristically add durations to zero-duration samples.
          samples.addDurationHeuristicHack(datasetId, sampleSet,
                                            10 * samples.s, this);
        }
*/
        samples.insertSamples(datasetDoc._id, sampleSet, this);
      },
      // Any exceptions above end up here.
      function (err) {
        if (err) return this(err);

        var schema = uploadSamples.schema;

        var _this = _.after(_.size(schema), this);
        _.each(schema, function (s) {
          _.extend(s, {
            parent_id: datasetDoc._id,
            author_id: datasetDoc.author._id
          });
          db.Channels.create(s, function (err, channel) {
            if (err && err.code === 11000) {
              db.Channels.update({channelName: s.channelName},
                  //{$min: {beg: s.beg}, $max: {end: s.end}}, _this);
                  {}, _this);
            } else {

              // Index for search.
              com.index(reds.createSearch('channels'), channel, ['humanName']);
              _this();
            }
          });
        });
      },
      //TODO: Publish event to newsfeed
      function (err) {
        // finish up
        if (err) {
          console.log('Error while processing PUT request: ' +
              (err.stack || err));
          res.send({ status: 'fail', data: { code: (err.stack || err) } }, 400);
        } else {
          // Success!
          res.end();
        }
      }
    );
  });

  return exports;
};

// Scheduled tasks.
exports.jobs = function (app) {
  return exports;
};
