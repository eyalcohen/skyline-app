/*!
 * Copyright 2011 Mission Motors
 *
 * Samples interface and results cache.
 *
 * Usage:
 *
 * A client (say, a graph), should keep its viewed region up to date with:
 *   setClientView(clientId, datasetId, channels, dur, beg, end);
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

define([
  'Underscore',
  'Backbone',
  'shared'
], function (_, Backbone, shared) {

  function SampleCache(app) {
    this.app = app;

    /* Cache structure:
        cache = {
          <datasetId> + '-' + <channelName>: {
            <dur>: {
              <bucket>: {
                  last: 123,  // Date.now() of last access.
                  pending: true,  // If a fetch is pending.
                  samples: [ <samples...> ],  // If data has been fetched.
                  syn: <bool>,  // Does samples contain synthetic data?
                  refetch: <bool>,  // If true, we should refetch this bucket.
              }, ...
            }, ...
            // syntheticDurations[1], ...:
          }
        }
    */
    this.cache = {};

    // A measure of the size of the cache.
    //   Each cache bucket counts for entryCacheCost.
    //   Each cached sample counts for 1.
    // We try to keep cacheSize < maxCacheSize.
    this.cacheSize = 0;

    /* Client registry:
      clients = {
        <clientId>: {
          datasetId: <datasetId>,
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
  }
  _.extend(SampleCache.prototype, Backbone.Events);

  /**
   * Update a client's view (creating the client as necessary).
   * Fetches will be triggered as necessary, and an update event triggered.
   */
  SampleCache.prototype.setClientView =
      function(clientId, datasetId, channels, dur, beg, end, force) {
    var client = defObj(this.clients, clientId);
    if (client.datasetId === datasetId && client.dur === dur &&
        client.beg === beg && client.end === end &&
        _.isEqual(client.channels, channels))
      return;  // Nothing to do!
    client.datasetId = datasetId;
    client.channels = channels;
    client.dur = dur;
    client.beg = beg;
    client.end = end;
    this.fillPendingRequests();
    // Update now, in case there's something useful in the cache.
    this.updateClient(clientId, client, 50);
  }

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
  }

  /**
   * Get the best duration to use for an approximate max number of samples to
   * fetch.
   */
  SampleCache.prototype.getBestDuration = function(visibleUs, maxSamples) {
    var minDuration = Math.min(visibleUs / maxSamples, _.last(durations));
    return _.first(_.filter(durations, function(v) {
      return v >= minDuration;
    }));
  }

  /**
   * Get the best duration to use for a given number of us/pixel.
   */
  SampleCache.prototype.getBestGraphDuration = function(usPerPixel) {
    var maxPixelsPerSample = 20;
    if (usPerPixel < 0) usPerPixel = 0;
    return _.last(_.filter(durations, function(v) {
      return v <= usPerPixel * maxPixelsPerSample;
    }));
  }

  /**
   * Invalidate the latest samples for a dataset and refetch them.
   * This is a total hack to do real-time updates!
   */
  // SampleCache.prototype.refetchLatest = function(treeModel, datasetId,
  //                                                callback) {
  //   var self = this;

  //   // Find end time of last schema entry for all channels.
  //   var channelRanges = {};
  //   function findChannelRanges(beforeAfter) {
  //     (treeModel.data || []).forEach(function process(treeEntry) {
  //       (treeEntry.sub || []).forEach(process);
  //       if (treeEntry.channelName) {
  //         defObj(channelRanges, treeEntry.channelName)[beforeAfter] =
  //             { beg: _.first(treeEntry.valid).beg,
  //               end: _.last(treeEntry.valid).end };
  //       }
  //     });
  //   }
  //   findChannelRanges('before');

  //   // Refetch the channel tree.
  //   treeModel.fetch(false, function() {
  //     // Now invalidate everything that might have changed.
  //     findChannelRanges('after');
  //     var changeBeg = Infinity, changeEnd = -Infinity;
  //     _.forEach(channelRanges, function(ranges, channelName) {
  //       var before = ranges['before'].end || -Infinity;
  //       var after = ranges['after'].end || Infinity;
  //       if (before == after) {
  //         // Nothing changed!
  //         return;
  //       }
  //       self.refetchOverlapping(datasetId, channelName, before, after);
  //       if (ranges['before'].end)
  //         changeBeg = Math.min(changeBeg, ranges['before'].end);
  //       else if (ranges['after'].beg)
  //         changeBeg = Math.min(changeBeg, ranges['after'].beg);
  //       if (ranges['after'].end)
  //         changeEnd = Math.max(changeEnd, ranges['after'].end);
  //     });

  //     // Refetch from the server and update graphs and such.
  //     self.fillPendingRequests();

  //     if (callback)
  //       if (isFinite(changeBeg) && isFinite(changeEnd))
  //         callback({ beg: changeBeg, end: changeEnd });
  //       else
  //         callback(null);
  //   });
  // }

  //// Private: ////

  /**
   * Get a cache entry.  If it doesn't exist, create it.
   */
  SampleCache.prototype.getCacheEntry =
      function(datasetId, channelName, dur, buck, create) {
    var cacheKey = datasetId + '-' + channelName;
    var d = create ? defObj : ifDef;
    var durEntry = d(d(this.cache, cacheKey), dur);
    var entry = durEntry && durEntry[buck];
    if (entry) {
      entry.last = Date.now();
    } else if (create) {
      entry = durEntry[buck] = { last: Date.now() };
      this.cacheSize += entryCacheCost;
    }
    return entry;
  }

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
    var requestsByPriority = {}; // Map from priority to array of requests.
    // A request is an object with: did, chan, dur, buck, entry.
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
          var validRanges = [{beg:-1e50, end: 1e50}];

          forValidBucketsInRange(validRanges, begBuck, endBuck, buckDur,
              function (buck, buckBeg, buckEnd) {
            var entry = self.getCacheEntry(client.datasetId, channelName,
                                           dur, buck, false);
            if (entry && !entry.refetch && (entry.samples || entry.pending))
              return;
            var priority = basePriority +
                Math.abs(2 * buck - (begBuck + endBuck));
            defArray(requestsByPriority, priority).push({
                did: client.datasetId, chan: channelName, dur: dur,
                buck: buck});
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
        // Test to see is a larger cache bucket already covers this data.
        // Possible future optimization: we could have each cache bucket
        // track time ranges which have non-synthetic data, and look for
        // coverage at a sub-bucket level.
        var covered = false;
        var buckBeg = req.buck * bucketSize(req.dur);
        for (var durI = durations.indexOf(req.dur) + 1;
             durI < durations.length; ++durI) {
          var biggerDur = durations[durI];
          var biggerBuck = Math.floor(buckBeg / bucketSize(biggerDur));
          var biggerEntry = self.getCacheEntry(req.did, req.chan, biggerDur,
              biggerBuck, false);
          if (biggerEntry && biggerEntry.syn === false) {
            covered = true;
            break;
          }
        }
        if (!req.refetch && covered) continue;
        self.issueRequest(req);
        if (self.pendingCacheEntries.length >= maxPendingRequests)
          return;
      }
    }
  }

  SampleCache.prototype.issueRequest = function(req) {
    var self = this;
    var entry = self.getCacheEntry(req.did, req.chan, req.dur, req.buck, true);
    entry.pending = true;
    delete entry.refetch;
    self.pendingCacheEntries.push(entry);
    var buckDur = bucketSize(req.dur);
    var buckBeg = req.buck * buckDur;
    var buckEnd = buckBeg + buckDur;
    var options = {
      beginTime: buckBeg, endTime: buckEnd,
      minDuration: req.dur, getMinMax: true,
      math: {
        type: 'simpleMovingAverage'
      }
    };
    self.app.rpc.do('fetchSamples', req.did, req.chan, options,
        function (err, data, mathData) {
      if (err) {
        console.error(err);
        samples = null;
        self.pendingCacheEntries.splice(
            self.pendingCacheEntries.indexOf(entry), 1);
        delete entry.pending;
        self.triggerClientUpdates(req.did, req.chan, req.dur, buckBeg, buckEnd);
        self.cleanCache();
        return;
      }
      entry.syn = data.samples.some(function(s){return 'min' in s});
      if (entry.samples)
        self.cacheSize -= entry.samples.length;
      entry.samples = data.samples;
      console.log(entry.mathData);
      if (data.samples)
        self.cacheSize += data.samples.length;
      // Delete this entry from the pending request array.
      self.pendingCacheEntries.splice(
          self.pendingCacheEntries.indexOf(entry), 1);
      delete entry.pending;
      self.fillPendingRequests();
      self.triggerClientUpdates(req.did, req.chan, req.dur, buckBeg, buckEnd);
      self.cleanCache();
    });
  }

  /**
   * When a given time range has been updated, trigger updates for any clients
   * which could be viewing this data.
   */
  SampleCache.prototype.triggerClientUpdates =
      function(datasetId, channelName, dur, beg, end) {
    for (var clientId in this.clients) {
      var client = this.clients[clientId];
      if (client.datasetId === datasetId &&
          -1 !== client.channels.indexOf(channelName) &&
          client.dur <= dur &&
          (end > client.beg || beg < client.end)) {
        this.updateClient(clientId, client,
                          this.pendingCacheEntries.length ? 250 : 0);
      }
    }
  }

  /**
   * Trigger a client update.  To avoid a lot of redundant work when a number
   * of chunks of data arrive in quick succession, we delay before issuing the
   * update event, so we can trigger fewer update events.
   */
  SampleCache.prototype.updateClient = function(clientId, client, timeout) {
    var self = this;
    var newTimeout = Date.now() + timeout;
    if (client.updateId) {
      if (newTimeout > client.updateTimeout) {
        // The new timeout would expire after the current timeout, so let the
        // current timeout be.
        return;
      } else {
        // The new timeout will expire before the current timeout, so cancel
        // the old timeout and take the new one.
        clearTimeout(client.updateId);
      }
    }
    client.updateTimeout = newTimeout;
    client.updateId = setTimeout(function() {
      client.updateId = null;
      delete client.updateTimeout;
      var sampleSet = {};
      client.channels.forEach(function(channelName) {
        var validRanges = [{beg:-1e50, end: 1e50}];
        sampleSet[channelName] = self.getBestCachedData(
            client.datasetId, channelName,
            client.dur, client.beg, client.end, validRanges);
      });
      self.trigger('update-' + clientId, sampleSet);
    }, timeout);
  }

  /**
   * Get whatever's present in the cache right now for a client view.
   * If data at the requested resolution is not available, will use
   * higher-resolution or lower-resolution data.
   */
  SampleCache.prototype.getBestCachedData =
      function(datasetId, channelName, dur, beg, end, validRanges) {
    var self = this;
    var buckDur = bucketSize(dur);
    var prevDur = getPrevDur(dur), nextDur = getNextDur(dur);
    var begBuck = Math.floor(beg / buckDur), endBuck = Math.ceil(end / buckDur);
    var buckets = [];
    forValidBucketsInRange(validRanges, begBuck, endBuck, buckDur,
        function(buck, buckBeg, buckEnd) {
      var entry = self.getCacheEntry(datasetId, channelName, dur, buck, false);
      if (entry && entry.samples) {
        buckets.push(entry.samples);
      } else if (nextDur != null) {
        // TODO: this would be more efficient and correct if we tried to fill
        // entire gaps, rather than a single bucket at a time.
        buckets.push(
            self.getBestCachedData(datasetId, channelName, nextDur,
                                   buckBeg, buckEnd, validRanges));
      }
    });
    var samples = [].concat.apply([], buckets);
    // Samples which overlap from one bucket into another will end up
    // duplicated.  Remove duplicates.
    // TODO: make a mergeDuplicateSamples for speed?
    shared.mergeOverlappingSamples(samples, channelName);
    return shared.trimSamples(samples, beg, end);
  }

  // SampleCache.prototype.socketReconnected = function() {
  //   // Any pending transactions are never going to complete.
  //   this.pendingCacheEntries.forEach(function(e) {
  //     delete e.pending;
  //   });
  //   this.pendingCacheEntries = [];

  //   // Re-issue fetches for client-visible regions.
  //   this.fillPendingRequests();
  // }

  SampleCache.prototype.cleanCache = function() {
    var self = this;
    if (self.cacheSize <= maxCacheSize)
      return;

    // Create an array of all entries reverse sorted by age.
    var allEntryBuckets = [];
    _.each(self.cache, function(dsChanEntry) {
      _.each(dsChanEntry, function(durEntry) {
        allEntryBuckets.push(_.values(durEntry));
      });
    });
    var allEntries = Array.prototype.concat.apply([], allEntryBuckets);
    allEntryBuckets = null;
    allEntries.sort(function(a,b) {return b.last - a.last});

    // Cull entries.
    var cacheSize = self.cacheSize;
    for (var i = allEntries.length - 1;
         cacheSize > minCacheSize && i >= 1; --i) {
      var entry = allEntries[i];
      if (entry.pending) continue;
      cacheSize -= entryCacheCost;
      if (entry.samples) cacheSize -= entry.samples.length;
      delete entry.samples;
      entry.last = -1;  // Flag for deletion.
    }
    self.cacheSize = cacheSize;

    // Delete now-empty entries.
    _.each(self.cache, function(dsChanEntry, dsChan) {
      _.each(dsChanEntry, function(durEntry, dur) {
        _.each(durEntry, function(entry, bucket) {
          if (entry.last === -1)
            delete durEntry[bucket];
        });
        if (Object.keys(durEntry).length == 0)
          delete dsChanEntry[dur];
      });
      if (Object.keys(dsChanEntry).length == 0)
        delete self.cache[dsChan];
    });
  }

  /**
   * Invalidate all buckets which overlap a time range.
   */
  SampleCache.prototype.refetchOverlapping =
      function(datasetId, channelName, beg, end) {
    var cacheKey = datasetId + '-' + channelName;
    var cacheLine = ifDef(this.cache, cacheKey);
    if (cacheLine) durations.forEach(function(dur) {
      var buckDur = bucketSize(dur);
      var begBuck = Math.floor(beg / buckDur);
      var endBuck = Math.ceil(end / buckDur);
      _.forEach(ifDef(cacheLine, dur) || {}, function(entry, buck) {
        if (begBuck <= buck && buck < endBuck)
          entry.refetch = true;
      });
    });
  }

  var minPendingRequests = 8, maxPendingRequests = 16;

  // At cacheSize = 1000000, the Skyline tab in Chrome uses about 350MB.
  var minCacheSize = 750000, maxCacheSize = 1000000;
  var entryCacheCost = 10;

  var durations = [0].concat(shared.syntheticDurations),
      durationsRev = _.clone(durations).reverse();
  function bucketSize(dur)
    { return dur === 0 ? 500 : dur * shared.syntheticSamplesPerRow * 10; }

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
