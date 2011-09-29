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

  }
  _.extend(SampleCache.prototype, Backbone.Events);

  /**
   * Update a client's view (creating the client as necessary).
   * Fetches will be triggered as necessary, and an update event triggered.
   */
  SampleCache.prototype.setClientView =
  function(clientId, vehicleId, channels, dur, beg, end) {
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
  function(vehicleId, channelName, dur, buck) {
    var entry =
        def(def(def(this.cache, vehicleId + '-' + channelName), dur), buck);
    entry.last = Date.now();
    return entry;
  };

  /**
   * Fetch any buckets which overlap a given view.
   */
  SampleCache.prototype.fetchNeededBuckets =
  function(vehicleId, channels, dur, beg, end) {
    var self = this;
    var buckDur = bucketSize(dur);
    var begBuck = Math.floor(beg / buckDur), endBuck = Math.ceil(end / buckDur);
    for (var buck = begBuck; buck < endBuck; ++buck) {
      channels.forEach(function(channelName) {
        var entry = self.getCacheEntry(vehicleId, channelName, dur, buck);
        if (entry.samples || entry.pending) return;
        entry.pending = true;
        var options = {
          beginTime: buck * buckDur, endTime: (buck + 1) * buckDur,
          minDuration: dur,
          getMinMax: true,
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
          entry.pending = false;
          self.triggerClientUpdates(vehicleId, channelName, dur,
                                    options.beginTime, options.endTime);
        });
      });
    }
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
      client.updateId = null;
      var sampleSet = {};
      client.channels.forEach(function(channelName) {
        sampleSet[channelName] = self.getBestCachedData(
            client.vehicleId, channelName,
            client.dur, client.beg, client.end, true, true);
      });
      self.trigger('update-' + clientId, sampleSet);
    }, 50);
  };

  /**
   * Get whatever's present in the cache right now for a client view.
   * If data at the requested resolution is not available, will use
   * higher-resolution or lower-resolution data.
   */
  SampleCache.prototype.getBestCachedData =
  function(vehicleId, channelName, dur, beg, end, getBigger, getSmaller) {
    var buckDur = bucketSize(dur);
    var prevDur = getPrevDur(dur), nextDur = getNextDur(dur);
    var begBuck = Math.floor(beg / buckDur), endBuck = Math.ceil(end / buckDur);
    var buckets = [];
    for (var buck = begBuck; buck < endBuck; ++buck) {
      var entry = this.getCacheEntry(vehicleId, channelName, dur, buck);
      if (entry && entry.samples) {
        buckets.push(entry.samples);
      /* TODO: this doesn't work, since it will avoid fetching bigger data.
         We'll need to be much more clever to avoid this problem.
      } else if (prevDur != null && getSmaller) {
        buckets.push(
            this.getBestCachedData(vehicleId, channelName, prevDur,
                                   buck * buckDur, (buck + 1) * buckDur,
                                   false, false));
      */
      } else if (nextDur != null && getBigger) {
        // TODO: this would be more efficient and correct if we tried to fill
        // entire gaps, rather than a single bucket at a time.
        buckets.push(
            this.getBestCachedData(vehicleId, channelName, nextDur,
                                   buck * buckDur, (buck + 1) * buckDur,
                                   true, false));
      }
    }
    var samples = [].concat.apply([], buckets);
    // Samples which overlap from one bucket into another will end up
    // duplicated.  Remove duplicates.
    // TODO: make a mergeDuplicateSamples for speed?
    App.shared.mergeOverlappingSamples(samples);
    return App.shared.trimSamples(samples, beg, end);
  }

  var durations = [0].concat(App.shared.syntheticDurations),
      durationsRev = _.clone(durations).reverse();
  function bucketSize(dur) {
    return dur === 0 ? 500 : dur * App.shared.syntheticSamplesPerRow * 10;
  }

  function def(obj, key) { return (key in obj) ? obj[key] : (obj[key] = {}); }

  function getNextDur(dur) {
    return _.detect(durations, function(v) { return v > dur });
  }

  function getPrevDur(dur) {
    return _.detect(durationsRev, function(v) { return v < dur });
  }

  return SampleCache;
});
