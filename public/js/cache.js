
define([
  'Underscore',
  'Backbone',
], function (_, Backbone) {

  var entryCacheCost = 10;
  var jobsPending = false;
  var maxJobsPending = 100;

  /* Constructor */
  function Cache() {
    this.cache = {};
    this.cacheSize = 0;
    this.minCacheSize = 750000;

    // At cacheSize = 1000000, the app tab in Chrome uses about 350MB.
    this.maxCacheSize = 1000000;
    this.samplesPerBucket = 50;

    // Fetch requests by priority
    this.priorityQueue = {
      1: [],
      2: [],
      3: []
    };
    this.socket = null;

    /* Client registry:
      clients = {
        <clientId>: {
          channels: [ <channelNames...> ],
          dur: <duration_us>,
          beg: <beginTime_us>,
          end: <endTime_us>,
          updateId: <...>,
        }, ...
      }
    */
    this.clients = {};

    // This is nominally gotten from the server, but we provide a default
    this.durations = [
      1,    //ms
      10,   //ms   10
      100,  //ms   10
      1000, //1s   10
      60*1000, // 1 minute  60
      60*60*1000, // 1 hour
      24*60*60*1000, // 1 day
      30*24*60*60*1000, // 1 month
      12*30*24*60*60*1000, // 1 year
      10*12*30*24*60*60*1000, // 1 decade
      10*10*12*30*24*60*60*1000 // 1 century
    ];
  }

  // More 
  _.extend(Cache.prototype, Backbone.Events);

  // Connect the socket
  Cache.prototype.connectSocket = function(url) {
    this.socket = io.connect(url);
  };

  Cache.prototype.updateOrCreateClient =
      function(clientId, channels, dur, beg, end) {

    var self = this;

    if (!clientId)
      return;

    if (!this.clients[clientId]) this.clients[clientId] = {};
    var client = this.clients[clientId];

    if (client.dur === dur && client.beg === beg
        && client.end === end && _.isEqual(client.channels, channels)) {
      return;  // Nothing to do!
    }

    client.channels = channels;
    client.dur = dur;
    client.beg = beg;
    client.end = end;

    _.each(client.channels, function (c) {
      self.createNewRequest(c, client.dur, client.beg, client.end);
    });
    // Update now, in case there's something useful in the cache.
    this.updateClient(clientId, client, 50);
  };


  /**
   * Close a client.
   */
  Cache.prototype.endClient = function(clientId) {
    var client = this.clients[clientId];
    if (client && client.updateId) {
      clearTimeout(client.updateId);
      client.updateId = null;
    }
    delete this.clients[clientId];
  };

  Cache.prototype.triggerClientUpdates =
      function(channelName, dur) {
    for (var clientId in this.clients) {
      var client = this.clients[clientId];
      if (-1 !== client.channels.indexOf(channelName) && client.dur <= dur) {
          //&&
          //(end > client.beg || beg < client.end)) {
        // FIXME:
        this.updateClient(clientId, client, 0);
      }
    }
  }

  /**
   * Trigger a client update.  To avoid a lot of redundant work when a number
   * of chunks of data arrive in quick succession, we delay before issuing the
   * update event, so we can trigger fewer update events.
   */
  Cache.prototype.updateClient = function(clientId, client, timeout) {
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
      _.each(client.channels, function (c) {
        sampleSet[c] = self.getBestData(c, client.dur, client.beg, client.end);
      });
      self.trigger('update-' + clientId, sampleSet);
    }, timeout);
  };


  // Get the list of durations in the database from the server across the socket
  Cache.prototype.getDurations = function() {

    if (this.socket) {
      this.socket.emit('durations', {}, function(err, durations) {
        if (!err) this.durations = durations;
      });
    }

    return this.durations;
  };

  // usage: forEachDuration(function(dur) { ... })
  var forEachDuration = function(fcn) {
    _.each(this.durations, function(f) {
      fcn(f);
    });
  };

  Cache.prototype.getBestDuration = function(visibleUs, maxSamples) {
    var minDuration = Math.min(visibleUs / maxSamples, _.last(durations));
    return _.first(_.filter(this.durations, function(v) {
      return v >= minDuration;
    }));
  };

  /**
   * Get the best duration to use for a given number of us/pixel.
   */
  Cache.prototype.getBestGraphDuration = function(usPerPixel, highres) {
    var maxPixelsPerSample = highres ? 1 : 40;
    if (usPerPixel < 0) usPerPixel = 0;
    return _.last(_.filter(this.durations, function(v) {
      return v <= usPerPixel * maxPixelsPerSample;
    }));
  };

  // Add any requests
  Cache.prototype.createNewRequest = function(channel, duration, beg, end) {
    // for a given duration, we try to fill and buckets above it with data
    // prioritizing buckets above

    var self = this;
    var entry = null;

    var firstBucket = Math.floor(beg / duration / self.samplesPerBucket);
    var lastBucket = Math.floor(end / duration / self.samplesPerBucket);
    var bucketIt = firstBucket;
    for (; bucketIt <= lastBucket; bucketIt++) {
      entry = self.getCacheEntry(channel, duration, bucketIt);
      if (!entry || !entry.samples) {
        this.priorityQueue['1'].push({channel: channel, dur: duration, bucket: bucketIt});
      }
    }

    // Get the next highest duration and prioritize that request
    var durationIndex = this.durations.indexOf(duration);
    if (durationIndex + 1 < this.durations.length) {
      duration = this.durations[durationIndex + 1];
      firstBucket = Math.floor(beg / duration / self.samplesPerBucket);
      lastBucket = Math.floor(end / duration / self.samplesPerBucket);

      for (bucketIt = firstBucket; bucketIt <= lastBucket; bucketIt++) {
        entry = self.getCacheEntry(channel, duration, bucketIt);
        if (!entry || !entry.samples) {
          this.priorityQueue['2'].push({channel: channel, dur: duration, bucket: bucketIt});
        }
      }
    }

    var priorities = _.keys(self.priorityQueue).sort( function(a, b) {
      return Number(a) < Number(b);
    });

    // callback that gets the next dataset from the server by priority
    var getNext = function() {

      // find the next priorirty that
      _.find(priorities, function (pr) {
        jobsPending = false;
        if (self.priorityQueue[pr].length === 0)
          return false;
        else {
          jobsPending = true;
          var req = self.priorityQueue[pr].shift();
          self.issueRequest.call(self, req.channel, req.dur, req.bucket, getNext);
          return true;
        }
      });
    };

    if (!jobsPending) {
      getNext();
    }

  };

  // Make a request over socket.io
  Cache.prototype.serverRequest = function(channel, duration, bucket, cb) {
    var now = Date.now();
    if (this.socket) {
      var beg = bucket * this.samplesPerBucket * duration;
      var end = (bucket + 1) * this.samplesPerBucket * duration - 1;
      var request = {
        channel: channel,
        beg: beg,
        end: end,
        downsample: duration
      };
      this.socket.emit('get', request, function(err, data) {
        if (err) cb(err);
        else if (!data) cb(null, null);
        else if (data.channelName === channel && data.samples
                 && !_.isEmpty(data.samples)) {
          console.log(Date.now() - now);
          cb(null, data.samples);
        } else {
          cb(null, null);
        }
      });
    }
  };

  Cache.prototype.issueRequest = function(channel, duration, bucket, cb) {
    var self = this;

    // should always return an object
    var entry = this.getCacheEntry(channel, duration, bucket, true);
    entry.pending = true;

    this.serverRequest(channel, duration, bucket, function (err, samples) {
      delete entry.pending;

      if (err) {
        delete entry.samples;
        delete self.cache[channel][duration][bucket];
        self.cleanCache();
        cb(err);
      } else {
        if (samples) {
          entry.samples = samples;
          self.cacheSize += _.keys(entry.samples).length;
          self.triggerClientUpdates(channel, duration);
        } else {
          delete self.cache[channel][duration][bucket];
        }
        self.cleanCache();
        cb(null);
      }
    });
  };

  // Invalidates all buckets that cover the range of time
  Cache.prototype.invalidateCache = function(channel, time) {
    var self = this;
    forEachDuration(function(dur) {
      var bucket = Math.floor(time / dur / self.samplesPerBucket);
      var entry = self.getCacheEntry(channel, dur, bucket);
      if (entry) {
        delete entry.samples;
        delete self.cache[channel][dur][bucket];
      }
    });
  };

  // Get or create a cache entry if 'create' is true
  Cache.prototype.getCacheEntry = function(channel, duration, bucket, create) {
    var entry = null;
    var cache = this.cache;
    if (cache && cache[channel]
        && cache[channel][duration] && cache[channel][duration][bucket]) {
      entry = cache[channel][duration][bucket];
    }
    if (entry) {
      entry.last = Date.now();
    } else if (create) {
      if (!cache[channel]) cache[channel] = {};
      if (!cache[channel][duration]) cache[channel][duration] = {};
      entry = cache[channel][duration][bucket] = { last: Date.now() };
      this.cacheSize += entryCacheCost;
    }
    return entry;
  };

  // Returns the cache as a copied array
  Cache.prototype.getAsArray = function() {
    // Create one large array from the object hash table
    var allEntries = [];
    _.each(this.cache, function(channel) {
      _.each(channel, function(duration) {
        _.each(duration, function(entry) {
          allEntries.push(entry);
        });
      });
    });
    return allEntries;
  };

  Cache.prototype.getOrIssueData = function() {
    // Create new request for the data range in question
    // Update the client view if there is something useful
  };

  /*
   Cache organization example:
   smallDuration:   [bucket0][bucket1][bucket2][bucket3][bucket4][bucket5]...
   largerDuration:  [bucket0                  ][bucket1                  ]...
   largestDuration: [bucket0                                             ]...

   If searching for the existence of data in smallDuration, we check
   smallDuration:bucket0.
   If data isn't there, we check largerDuration:bucket0.
   If data isn't there, we check largestDuration:bucket0.  If data IS there,
   we apply the right percentage of largestDuration:bucket0 to cover
   smallDuration:bucket0;  If not, we don't return the time/val pairs
   associted with this data.  In tihs case, we would take 16.6% of
   largestDuration:bucket0

   Worst-case is O(durations * buckets)
   Best-case is O(buckets)

   The worst-case will have some significant performance penalties from
   math operations, but will be fast enough on most browsers.

   Samples are returning as objects with keys {time, val}, which is different than
   how they are stored in the cache.
  */
  Cache.prototype.getBestData = function(channel, duration, beg, end) {

    var self = this;
    // We hunt for data in the cache, starting for data at the duration
    // of interest.
    var sampleSet = [];
    var dateBeg, dateEnd;
    var samplesPerBucket = this.samplesPerBucket;

    // get data from the next highest bucket
    var getNextHigherDurationData = function(duration) {
      var bucket = Math.floor(dateBeg / duration / samplesPerBucket);
      var bucketDateBeg = bucket * duration * samplesPerBucket;
      var bucketDateEnd = bucketDateBeg + (duration * samplesPerBucket) - 1;

      var entry = self.getCacheEntry(channel, duration, bucket, false);
      if (entry && entry.samples) {
        var samples = [];
        _.each(entry.samples, function(val, time) {
          if (time >= dateBeg && time <= dateEnd) {
            // FIXME: Move this to server
            samples.push({time: time, avg: val.avg, min: val.min, max: val.max});
          }
        });
        return samples;
      } else if (durationIndex + 1 < self.durations.length) {
        durationIndex = durationIndex + 1;
        return getNextHigherDurationData(self.durations[durationIndex]);
      } else {
        return [];
      }
    };

    // translate beg and end to buckets for this duration
    var firstBucket = Math.floor(beg / duration / samplesPerBucket);
    var lastBucket = Math.floor(end / duration / samplesPerBucket);

    var durationIndex = this.durations.indexOf(duration);
    for (var bucketIt = firstBucket; bucketIt <= lastBucket; bucketIt++) {
      if (bucketIt === firstBucket) {
        dateBeg = beg;
        dateEnd = bucketIt * duration * samplesPerBucket;
      } else if (bucketIt === lastBucket) {
        dateBeg = bucketIt * duration * samplesPerBucket;
        dateEnd = end;
      } else {
        var durationIndex = this.durations.indexOf(duration);
        dateBeg = bucketIt * duration * samplesPerBucket;
        dateEnd = dateBeg + (duration * samplesPerBucket) - 1;
      }

      sampleSet.push(getNextHigherDurationData(duration));
    }

    return _.flatten(sampleSet);
  };

  Cache.prototype.emptyCache = function() {
    this.cache = {};
    this.cacheSize = 0;
  };


  Cache.prototype.cleanCache = function() {
    var self = this;

    // Only clean the cache when it has grown too large
    if (this.cacheSize <= this.maxCacheSize)
      return;

    var allEntries = this.getAsArray();
    // Sort the entries by their first access date
    allEntries.sort(function(a,b) { return a.last - b.last; } );

    // 'find' exits when returned true, so we use that to test for
    // when the cache has grown small again.  Mark them for deletion
    _.find(allEntries, function(item) {
      if (item.pending)
        return false;
      // mark for deletion
      item.delete = true;
      self.cacheSize -= entryCacheCost;
      if (item.samples) {
        self.cacheSize -= _.keys(entry.samples).length;
      }
      if (self.cacheSize < self.minCacheSize)
        return true;
    });

    // Now walk the hashtable deleting cache objects where necessary
    _.each(this.cache, function(channelObj, channelKey) {
      _.each(channelObj, function(durationObj, durationKey) {
        _.each(durationObj, function(bucketObj, bucketKey) {
          if (bucketObj.delete) {
            delete bucketObj.samples;
            delete durationObj[bucketKey];
          }
        });
        if (_.keys(durationObj).length === 0) {
          delete channelObj[durationKey];
        }
      });
      if (_.keys(channelObj).length === 0) {
        delete self.cache[channelKey];
      }
    });
  };

  return Cache;


});

