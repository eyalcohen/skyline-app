/*!
 * Copyright 2011 Mission Motors
 *
 * SampleDb interface and results cache.
 *
 * Usage:
 *
 * A client (say, a graph), should keep its viewed region up to date with:
 *   setClientView(clientId, vehicleId, channels, dur, beg, end);
 * clientId is a string unique to this client.  Whenever the viewed region,
 * channels, or duration (zoom) change, call setClientView to update them.
 *
 * When the data relevant to a client's view has changed, the cache will emit
 * an event ('update-' + clientId), with an argument which is a sampleSet with
 * the data the client has subscribed to.
 *
 * When a client goes away, it should call endClient(clientId).
 */

/*
  Graph zoom data is: beg, end, width
  Fetched data is: channel, dur, bucket
  Bucketing: same as synthetic buckets.
 */

define(function () {

  function SampleCache() {

    /* Cache structure:
        cache = {
          <vehicleId> + <channelName>: {
            <dur>: {
              <bucket>: {
                  last: 123,  // Date.now() of last access.
                  samples: [ <samples...> ],  // If data has been fetched.
                  pending: false,  // Is a fetch pending?
              }, ...
            }, ...
            // syntheticDurations[1], ...:
          }
        }
    */
    this.cache = {};

    /* Client registry:
      clients = {
        <clientId>: {
          vehicleId: <vehicleId>,
          channels: [ <channelNames...> ],
          dur: <duration_us>,
          beg: <beginTime_us>,
          end: <endTime_us>,
          updateId: <...>,
        }, ...
      }
    */
    this.clients = {};

    App.subscribe('DNodeReconnectUserAuthorized',
                  _.bind(this.dnodeReconnected, this));
  }
  _.extend(SampleCache.prototype, Backbone.Events);

  /**
   * Update a client's view (creating the client as necessary).
   * Fetches will be triggered as necessary, and an update event triggered.
   */
  SampleCache.prototype.setClientView =
  function(clientId, vehicleId, channels, dur, beg, end, force) {
    var client = def(this.clients, clientId);
    if (client.vehicleId === vehicleId && client.dur === dur &&
        client.beg === beg && client.end === end &&
        _.isEqual(client.channels, channels))
      return;  // Nothing to do!
    client.vehicleId = vehicleId;
    client.channels = channels;
    client.dur = dur;
    client.beg = beg;
    client.end = end;
    // Pre-fetch samples at next zoom level up.
    var nextDur = getNextDur(dur);
    if (nextDur)
      this.fetchNeededBuckets(vehicleId, channels, nextDur, beg, end);
    // Fetch samples at this zoom level.
    this.fetchNeededBuckets(vehicleId, channels, dur, beg, end);
    // Update now, in case there's something useful in the cache.
    this.updateClient(clientId, client);
  };

  /**
   * Close a client.
   */
  SampleCache.prototype.endClient = function(clientId) {
    var client = this.clients[clientId];
    if (client && client.updateId) {
      clearTimeout(client.updateId);
      client.updateId = null;
    }
    delete this.clients[clientId];
  };

  /**
   * Get the best duration to use for an approximate max number of samples to
   * fetch.
   */
  SampleCache.prototype.getBestDuration = function(visibleUs, maxSamples) {
    var minDuration = Math.min(visibleUs / maxSamples, _.last(durations));
    return _.first(_.filter(durations, function(v) {
      return v >= minDuration;
    }));
  };

  /**
   * Get the best duration to use for a given number of us/pixel.
   */
  SampleCache.prototype.getBestGraphDuration = function(usPerPixel) {
    var maxPixelsPerSample = 5;
    if (usPerPixel < 0) usPerPixel = 0;
    return _.last(_.filter(durations, function(v) {
      return v <= usPerPixel * maxPixelsPerSample;
    }));
  };

  //// Private: ////

  /**
   * Get a cache entry.  If it doesn't exist, create it.
   */
  SampleCache.prototype.getCacheEntry =
  function(vehicleId, channelName, dur, buck, create) {
    var cacheKey = vehicleId + '-' + channelName;
    var d = create ? def : ifDef;
    var entry = d(d(d(this.cache, cacheKey), dur), buck);
    if (entry) entry.last = Date.now();
    return entry;
  };

  function forValidBucketsInRange(validRanges, begin, end, buckDur, f) {
    var buck, buckBeg, buckEnd;
    function setBuck(newBuck) {
      buck = newBuck;
      buckEnd = buckDur + (buckBeg = buck * buckDur);
    }
    setBuck(begin);
    if (!validRanges) {
      for (; buck < end; setBuck(buck + 1))
        f(buck, buckBeg, buckEnd);
    } else {
      for (var rangeI in validRanges) {
        var range = validRanges[rangeI];
        if (range.beg >= buckEnd)
          setBuck(Math.floor(range.beg / buckDur));
        for (; buckBeg < range.end; setBuck(buck + 1)) {
          if (buck >= end)
            return;
          f(buck, buckBeg, buckEnd);
        }
      }
    }
  };

  /**
   * Fetch any buckets which overlap a given view.
   */
  SampleCache.prototype.fetchNeededBuckets =
  function(vehicleId, channels, dur, beg, end) {
    var self = this;
    var buckDur = bucketSize(dur);
    var begBuck = Math.floor(beg / buckDur), endBuck = Math.ceil(end / buckDur);
    channels.forEach(function(channelName) {
      // Hack: avoid fetching buckets which have no schema, thus must be empty.
      var validRanges = null;
      App.publish('FetchChannelInfo-' + vehicleId, [channelName, function(desc){
        if (desc) validRanges = desc.valid;
      }]);
      forValidBucketsInRange(validRanges, begBuck, endBuck, buckDur,
          function(buck, buckBeg, buckEnd) {
        var entry = self.getCacheEntry(vehicleId, channelName, dur, buck, true);
        if (entry.samples || entry.pending) return;
        entry.pending = true;
        var options = {
          beginTime: buckBeg, endTime: buckEnd,
          minDuration: dur, getMinMax: true,
        };
        // TODO: we could avoid fetching samples sometimes if we determine that
        // a larger cached bucket already has entirely non-synthetic data for
        // the given time range.
        App.api.fetchSamples(vehicleId, channelName, options,
                             function(err, samples) {
          if (err) {
            console.error(
                'SampleCache server call fetchSamples(' + vehicleId + ', "' +
                channelName + '", ' + JSON.stringify(options) +
                ') returned error: ' + err);
            samples = [];
          }
          entry.samples = samples;
          delete entry.pending;
          self.triggerClientUpdates(vehicleId, channelName, dur,
                                    options.beginTime, options.endTime);
        });
      });
    });
  }

  /**
   * When a given time range has been updated, trigger updates for any clients
   * which could be viewing this data.
   */
  SampleCache.prototype.triggerClientUpdates =
  function(vehicleId, channelName, dur, beg, end) {
    for (var clientId in this.clients) {
      var client = this.clients[clientId];
      if (client.vehicleId === vehicleId &&
          -1 !== client.channels.indexOf(channelName) &&
          client.dur <= dur &&
          (end > client.beg || beg < client.end)) {
        this.updateClient(clientId, client);
      }
    }
  };

  /**
   * Trigger a client update.  To avoid a lot of redundant work when a number
   * of chunks of data arrive in quick succession, we delay before issuing the
   * update event, so we can trigger fewer update events.
   */
  SampleCache.prototype.updateClient = function(clientId, client) {
    var self = this;
    if (client.updateId) return;
    client.updateId = setTimeout(function() {
      var start = Date.now();
      client.updateId = null;
      var sampleSet = {};
      client.channels.forEach(function(channelName) {
        var validRanges = null;
        App.publish('FetchChannelInfo-' + client.vehicleId, [channelName,
                    function(desc) {
          if (desc) validRanges = desc.valid;
        }]);
        sampleSet[channelName] = self.getBestCachedData(
            client.vehicleId, channelName,
            client.dur, client.beg, client.end, validRanges);
      });
      console.debug('SampleCache.updateClient(' + clientId + ') took ' + (Date.now() - start) + 'ms');
      self.trigger('update-' + clientId, sampleSet);
    }, 50);
  };

  /**
   * Get whatever's present in the cache right now for a client view.
   * If data at the requested resolution is not available, will use
   * higher-resolution or lower-resolution data.
   */
  SampleCache.prototype.getBestCachedData =
  function(vehicleId, channelName, dur, beg, end, validRanges) {
    var self = this;
    var buckDur = bucketSize(dur);
    var prevDur = getPrevDur(dur), nextDur = getNextDur(dur);
    var begBuck = Math.floor(beg / buckDur), endBuck = Math.ceil(end / buckDur);
    var buckets = [];
    forValidBucketsInRange(validRanges, begBuck, endBuck, buckDur,
        function(buck, buckBeg, buckEnd) {
      var entry = self.getCacheEntry(vehicleId, channelName, dur, buck, false);
      if (entry && entry.samples) {
        buckets.push(entry.samples);
      } else if (nextDur != null) {
        // TODO: this would be more efficient and correct if we tried to fill
        // entire gaps, rather than a single bucket at a time.
        buckets.push(
            self.getBestCachedData(vehicleId, channelName, nextDur,
                                   buckBeg, buckEnd, validRanges));
      }
    });
    var samples = [].concat.apply([], buckets);
    // Samples which overlap from one bucket into another will end up
    // duplicated.  Remove duplicates.
    // TODO: make a mergeDuplicateSamples for speed?
    App.shared.mergeOverlappingSamples(samples);
    return App.shared.trimSamples(samples, beg, end);
  }

  SampleCache.prototype.dnodeReconnected = function() {
    var self = this;

    // Any pending transactions are never going to complete.
    // Go through the cache, turning off pending.
    _.forEach(self.cache, function(vehChanEntry) {
      _.forEach(vehChanEntry, function(durEntry) {
        _.forEach(durEntry, function(entry) {
          delete entry.pending;
        });
      });
    });

    // Re-issue fetches for client-visible regions.
    _.forEach(self.clients, function(client, clientId) {
      // Pre-fetch samples at next zoom level up.
      var nextDur = getNextDur(client.dur);
      if (nextDur)
        self.fetchNeededBuckets(client.vehicleId, client.channels,
                                nextDur, client.beg, client.end);
      // Fetch samples at this zoom level.
      self.fetchNeededBuckets(client.vehicleId, client.channels,
                              client.dur, client.beg, client.end);
    });
  }

  var durations = [0].concat(App.shared.syntheticDurations),
      durationsRev = _.clone(durations).reverse();
  function bucketSize(dur) {
    return dur === 0 ? 500 : dur * App.shared.syntheticSamplesPerRow * 10;
  }

  function def(obj, key) { return (key in obj) ? obj[key] : (obj[key] = {}); }
  function ifDef(obj, key) { return obj && (key in obj) ? obj[key] : null; }

  function getNextDur(dur) {
    return _.detect(durations, function(v) { return v > dur });
  }

  function getPrevDur(dur) {
    return _.detect(durationsRev, function(v) { return v < dur });
  }

  return SampleCache;
});
