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
          <vehicleId> + '-' + <channelName>: {
            <dur>: {
              <bucket>: {
                  last: 123,  // Date.now() of last access.
                  samples: [ <samples...> ],  // If data has been fetched.
                  syn: <bool>,  // Does samples contain synthetic data?
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

    // Cache entries of pending server requests.  We'll try to keep between
    // minPendingRequests and maxPendingRequests pending.
    this.pendingCacheEntries = [];

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
    var client = defObj(this.clients, clientId);
    if (client.vehicleId === vehicleId && client.dur === dur &&
        client.beg === beg && client.end === end &&
        _.isEqual(client.channels, channels))
      return;  // Nothing to do!
    client.vehicleId = vehicleId;
    client.channels = channels;
    client.dur = dur;
    client.beg = beg;
    client.end = end;
    this.fillPendingRequests();
    // Update now, in case there's something useful in the cache.
    this.updateClient(clientId, client, 50);
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
    var maxPixelsPerSample = 5.5;
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
    var d = create ? defObj : ifDef;
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
  }

  /**
   * If we can add any requests to the request queue, do so.
   */
  SampleCache.prototype.fillPendingRequests = function() {
    var self = this;
    if (self.pendingCacheEntries.length >= minPendingRequests)
      return;

    // Generate a prioritized list of requests to make.
    var requestsByPriority = {};  // Map from priority to array of requests.
    // A request is an object with: veh, chan, dur, buck, entry.
    _.forEach(self.clients, function(client, clientId) {
      // Pre-fetch samples at next zoom level up.
      var nextDur = getNextDur(client.dur);
      if (nextDur)
        addRequests(nextDur, 0);
      // Fetch samples at this zoom level.
      addRequests(client.dur, 6);

      function addRequests(dur, basePriority) {
        var buckDur = bucketSize(dur);
        var begBuck = Math.floor(client.beg / buckDur);
        var endBuck = Math.ceil(client.end / buckDur);
        client.channels.forEach(function(channelName) {
          // Hack: avoid fetching buckets which have no schema, thus must be
          // empty.
          var validRanges = null;
          App.publish('FetchChannelInfo-' + client.vehicleId,
                      [channelName, function(desc){
            if (desc) validRanges = desc.valid;
          }]);
          forValidBucketsInRange(validRanges, begBuck, endBuck, buckDur,
                                 function(buck, buckBeg, buckEnd) {
            var entry = self.getCacheEntry(client.vehicleId, channelName,
                                           dur, buck, true);
            if (entry.samples) return;
            var priority = basePriority +
                Math.abs(2 * buck - (begBuck + endBuck));
            defArray(requestsByPriority, priority).push({
                veh: client.vehicleId, chan: channelName, dur: dur,
                beg: buckBeg, end: buckEnd, entry: entry });
          });
        });
      }
    });

    // Fill the request queue with the highest-priority requests which aren't
    // already pending.
    var priorities = _.keys(requestsByPriority).sort(function(a,b){return a-b});
    for (var prioI in priorities) {
      var requests = requestsByPriority[priorities[prioI]];
      for (var reqI in requests) {
        var req = requests[reqI];
        if (!_.contains(self.pendingCacheEntries, req.entry)) {
          // Test to see is a larger cache bucket already covers this data.
          // Possible future optimization: we could have each cache bucket
          // track time ranges which have non-synthetic data, and look for
          // coverage at a sub-bucket level.
          var covered = false;
          for (var durI = durations.indexOf(req.dur) + 1;
               durI < durations.length; ++durI) {
            var biggerDur = durations[durI];
            var biggerBuck = Math.floor(req.beg / bucketSize(biggerDur));
            var biggerEntry = self.getCacheEntry(req.veh, req.chan, biggerDur,
                                                 biggerBuck, false);
            if (biggerEntry && biggerEntry.syn === false) {
              covered = true;
              break;
            }
          }
          if (covered) continue;
          self.issueRequest(req);
          if (self.pendingCacheEntries.length >= maxPendingRequests)
            return;
        }
      }
    }
  };

  SampleCache.prototype.issueRequest = function(req) {
    var self = this;
    self.pendingCacheEntries.push(req.entry);
    var options = {
      beginTime: req.beg, endTime: req.end,
      minDuration: req.dur, getMinMax: true,
    };
    // TODO: we could avoid fetching samples sometimes if we determine that
    // a larger cached bucket already has entirely non-synthetic data for
    // the given time range.
    App.api.fetchSamples(req.veh, req.chan, options, function(err, samples) {
      if (err) {
        console.error(
            'SampleCache server call fetchSamples(' + req.veh + ', "' +
            req.chan + '", ' + JSON.stringify(options) +
            ') returned error: ' + err);
        samples = [];
      } else {
        req.entry.syn = samples.some(function(s){return 'min' in s});
      }
      req.entry.samples = samples;
      // Delete this entry from the pending request array.
      self.pendingCacheEntries.splice(
          self.pendingCacheEntries.indexOf(req.entry), 1);
      self.fillPendingRequests();
      self.triggerClientUpdates(req.veh, req.chan, req.dur, req.beg, req.end);
    });
  };

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
        this.updateClient(clientId, client,
                          this.pendingCacheEntries.length ? 250 : 0);
      }
    }
  };

  /**
   * Trigger a client update.  To avoid a lot of redundant work when a number
   * of chunks of data arrive in quick succession, we delay before issuing the
   * update event, so we can trigger fewer update events.
   */
  SampleCache.prototype.updateClient = function(clientId, client, timeout) {
    var self = this;
    if (client.updateId) {
      if (client.updateTimeout - Date.now() > timeout) {
        // The new timeout will expire after the current timeout, so let the
        // current timeout be.
        return;
      } else {
        // The new timeout will expire before the current timeout, so cancel
        // the old timeout and take the new one.
        clearTimeout(client.updateId);
      }
    }
    client.updateTimeout = Date.now() + timeout;
    client.updateId = setTimeout(function() {
      var start = Date.now();
      client.updateId = null;
      delete client.updateTimeout;
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
      self.trigger('update-' + clientId, sampleSet);
    }, timeout);
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
    // Any pending transactions are never going to complete.
    this.pendingCacheEntries = [];

    // Re-issue fetches for client-visible regions.
    this.fillPendingRequests();
  }

  var minPendingRequests = 8, maxPendingRequests = 16;

  var durations = [0].concat(App.shared.syntheticDurations),
      durationsRev = _.clone(durations).reverse();
  function bucketSize(dur)
    { return dur === 0 ? 500 : dur * App.shared.syntheticSamplesPerRow * 10; }

  function defObj(obj, key)
    { return (key in obj) ? obj[key] : (obj[key] = {}); }
  function defArray(obj, key, d)
    { return (key in obj) ? obj[key] : (obj[key] = []); }
  function ifDef(obj, key)
    { return obj && (key in obj) ? obj[key] : null; }

  function getNextDur(dur)
    { return _.detect(durations, function(v) { return v > dur }); }

  function getPrevDur(dur)
    { return _.detect(durationsRev, function(v) { return v < dur }); }

  return SampleCache;
});
