
define([
  'Underscore',
  'Backbone',
], function (_, Backbone) {

  var entryCacheCost = 10;
  var jobsPending = false;
  var maxJobsPending = 100;

  /**
   * Constructor
   */
  function Cache() {

    // Stores the actual samples
    this.cache = {};
    this.cacheSize = 0;

    // When cleaning the cache, try to get it to abou this size
    this.minCacheSize = 500000;

    // At cacheSize = 1000000, the app tab in Chrome uses about 350MB.
    this.maxCacheSize = 750000;

    // The cache is organized as buckets of samples, with each bucket covering
    // a specific duration
    this.samplesPerBucket = 500;

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

    // Durations that we store in the cache
    this.durations = [
      1,    //ms
      10,   //ms
      100,  //ms
      1000, //1s
      10*1000, //10s
      60*1000, // 1 minute
      10*60*1000, // 10 minutes
      60*60*1000, // 1 hour
      24*60*60*1000, // 1 day
      30*24*60*60*1000, // 1 month
      12*30*24*60*60*1000, // 1 year
      10*12*30*24*60*60*1000, // 1 decade
      10*10*12*30*24*60*60*1000 // 1 century
    ];
  }

  _.extend(Cache.prototype, Backbone.Events);

  /*
   * Connect a websocket to the target URL
   */
  Cache.prototype.connectSocket = function(url) {
    this.socket = io.connect(url);
  };

  /* Connect a new client.  A client is something that will be notified
   * of updates on a channel when they come in
   * opts: {
   *  immediateUpdate: Tells the client to update if there is data
   *  getHigherDuration: Tells the cache to fetch samples at longer durations
   * }
   */
  Cache.prototype.connectClient = function(clientId, opts) {
    if (!this.clients[clientId]) this.clients[clientId] = {};

    this.clients[clientId].channels = [];

    if (!opts) opts = {};
    _.defaults(opts, {
      immediateUpdate: true,
      getHigherDuration: false
    });

    this.clients[clientId].opts = opts;
    this.clients[clientId].channels = [];
  };

  /*
   * Return all registered channels in the client
   */
  Cache.prototype.getChannels = function(clientId) {
    if(!clientId || !this.clients[clientId]) {
      return null;
    }
    return this.clients[clientId].channels;
  };

  /*
   * Adds a new channel to the client
   */
  Cache.prototype.addChannel = function(clientId, channel) {
    if(!clientId || !this.clients[clientId]) {
      return;
    }
    var client = this.clients[clientId];
    client.needsUpdate = true;
    client.channels.push(channel);
  };

  /*
   * Removes a channel from the client.  Triggers an immediate update since
   * we don't need to talk to the server to remove data from the client's view.
   */
  Cache.prototype.removeChannel = function(clientId, channel) {
    if(!clientId || !this.clients[clientId]) {
      return;
    }
    var client = this.clients[clientId];
    var index = _.pluck(client.channels, 'channelName')
                        .indexOf(channel.channelName);
    if (index === -1) return;
    client.needsUpdate = true;
    client.channels.splice(index, 1);
    this.updateClient(clientId, client, 0);
  };

  /*
   * Lets the cache know that the client's view has changed
   */
  Cache.prototype.updateSubscription = function(clientId, dur, beg, end) {

    var self = this;

    if(!clientId || !this.clients[clientId]
        || this.clients[clientId].channels.length === 0)
      return;

    var client = this.clients[clientId];

    if (client.needsUpdate) {
      delete client.needsUpdate;
    } else if (client.dur === dur && client.beg === beg && client.end === end) {
      return;  // Nothing to do!
    }

    if (dur) client.dur = dur;
    if (beg) client.beg = beg;
    if (end) client.end = end;

    if (!client.dur || !client.beg || !client.end)
      return;

    _.each(client.channels, function (c) {
      self.createNewRequest(c.channelName || c, client.dur,
                            client.beg, client.end, client.opts.getHigherDuration);
    });

    // Update now, in case there's something useful in the cache.
    if (client.opts.immediateUpdate)
      this.updateClient(clientId, client, 50);

    return;
  }


   /*
    * End the client
    */
  Cache.prototype.endClient = function(clientId) {
    var client = this.clients[clientId];
    if (client && client.updateId) {
      clearTimeout(client.updateId);
      client.updateId = null;
    }
    delete this.clients[clientId];
  };

  /*
   * Determines which clients need updates and calls the update function
   * Future optimization: Make sure the client's view is within beg/end
   * before updating
   */
  Cache.prototype.triggerClientUpdates = function(channelName, dur) {
    for (var clientId in this.clients) {
      var client = this.clients[clientId];
      var channels = _.isObject(client.channels[0])
          ? _.pluck(client.channels, 'channelName') : client.channels;
      if (-1 !== channels.indexOf(channelName) && client.dur <= dur) {
        this.updateClient(clientId, client, jobsPending ? 200 : 0);
      }
    }
  };

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
        var cn = c.channelName || c;
        // Grab data from the cache here
        sampleSet[cn] = self.getBestData(cn, client.dur, client.beg, client.end);
      });
      self.trigger('update-' + clientId, sampleSet);
    }, timeout);
  };

  /*
   * Helper function.  usage: forEachDuration(function(dur) { ... })
   */
  var forEachDuration = function(fcn) {
    _.each(this.durations, function(f) {
      fcn(f);
    });
  };

  /**
   * Get the best duration to use for a given number of us/pixel.
   */
  Cache.prototype.getBestGraphDuration = function(usPerPixel, highres) {
    var maxPixelsPerSample = highres ? 5 : 40;
    if (usPerPixel < 0) usPerPixel = 0;
    return _.last(_.filter(this.durations, function(v) {
      return v <= usPerPixel * maxPixelsPerSample;
    }));
  };

  /**
   * Create a request for new data.  beg and end are unix times, and duration
   * is one of the standard durations that we will cache.
   * If getHigher is set to true, we will also
   * try to get 'zoomed' out data, or data of a higher duration.  This is done
   * if the client wants to prioritize showing low-resolution data over 
   * waiting for high-resolution data 
   */
  Cache.prototype.createNewRequest =
      function(channel, duration, beg, end, getHigher) {
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

    if (getHigher) {
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
          self.setupRequest.call(self, req.channel, req.dur, req.bucket, getNext);
          return true;
        }
      });
    };

    // Start the callback chain
    if (!jobsPending) {
      getNext();
    }

  };

  /*
   * Make a request for data over socket.io
   */
  Cache.prototype.issueRequest = function(channel, duration, bucket, cb) {
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
          cb(null, data.samples);
        } else {
          cb(null, null);
        }
      });
    }
  };

  /*
   * Handle setup of the server request and handling of the callback
   */
  Cache.prototype.setupRequest = function(channel, duration, bucket, cb) {
    var self = this;

    // should always return an object
    var entry = this.getCacheEntry(channel, duration, bucket, true);
    entry.pending = true;

    this.issueRequest(channel, duration, bucket, function (err, samples) {
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

  /*
   * Invalidates all buckets that include this time
   */
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

  /*
   * Get or create a cache entry if 'create' is true
   */
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

  /*
   * Returns the cache as a copied array
   */
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

  /**
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
        _.each(entry.samples, function(sample) {
          if (sample.time >= dateBeg && sample.time <= dateEnd) {
            samples.push(sample);
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
      durationIndex = this.durations.indexOf(duration);
      dateBeg = bucketIt === firstBucket
          ? beg
          : bucketIt * duration * samplesPerBucket;
      dateEnd = bucketIt === lastBucket
          ? end
          : duration * samplesPerBucket * (bucketIt + 1) - 1;

      sampleSet.push(getNextHigherDurationData(duration));
    }

    return _.flatten(sampleSet);
  };

  /*
   * Completely empties the cache
   */
  Cache.prototype.emptyCache = function() {
    this.cache = {};
    this.cacheSize = 0;
  };


  /* Tries to get cache below the maxCacheSize by removing the oldest
   * cache entries
   */
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

  /*
   * Helper function to get samples from the cache
   */
  Cache.prototype.fetchSamples = function(channelName, beg, end, width, cb) {
    var uniqueName = channelName + '-' + Math.floor(Math.random()*100000);
    var bestDuration = this.getBestGraphDuration((end-beg)/width, true);

    this.connectClient(uniqueName);
    this.addChannel(uniqueName, channelName);
    this.updateSubscription(uniqueName, bestDuration, beg, end);
    this.bind('update-'+uniqueName, _.bind(function(samples) {
      cb(samples[channelName]);
    }, this));
    setTimeout(_.bind(function() {
      this.endClient(uniqueName);
    }, this), 2500);
  };

  return Cache;

});

