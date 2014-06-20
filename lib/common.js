/*
 * common.js: Common methods for resources and the page service.
 *
 */

// Module Dependencies
var crypto = require('crypto');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');
var stemmer = require('porter-stemmer').stemmer;
exports.init = function (uri) { exports.ROOT_URI = uri; };

/*
 * Determine if user can access resource.
 */
var hasAccess = exports.hasAccess = function (user, resource, cb) {

  Step(
    function () {
      var next = this;

      // Walk up parents until have actual resource.
      (function _parent(err, doc) {
        if (err) return next(err);
        if (!doc.parent_id || !doc.parent_type) {
          return next(null, doc);
        }
        db[_.capitalize(doc.parent_type) + 's'].read({_id: doc.parent_id}, _parent);
      })(null, resource);

    }, function (err, resource) {
      if (err) return cb(err);

      // Get the resource author.
      var author_id = resource.author ? resource.author._id:
          resource.author_id;
      db.Users.read({_id: author_id}, this.parallel());

      // Look for a subscription.
      if (user) {
        db.Subscriptions.read({subscriber_id: user._id, subscribee_id: author_id,
            mute: false, 'meta.style': 'follow'}, this.parallel());
      }
    },
    function (err, author, sub) {
      if (err) return cb(err);
      if (!author || !author.config) {
        return cb('Could not find resource author');
      }

      // Check resource privacy.
      if (resource.public === false) {
        if (!user || user._id.toString() !== author._id.toString()) {
          return cb(null, false);
        }
      }

      // Check user privacy.
      if (!sub && author.config.privacy.mode.toString() === '1') {
        if (!user || user._id.toString() !== author._id.toString()) {
          return cb(null, false);
        }
      }

      cb(null, true);
    }
  );
};

/*
 * Error wrap JSON request.
 */
exports.error = function (err, req, res, data, estr) {
  if (typeof data === 'string') {
    estr = data;
    data = null;
  }
  var fn = req.xhr ? res.send: res.render;
  if (err || (!data && estr)) {
    var profile = {
      user: req.user,
      content: {page: null},
      root: exports.ROOT_URI,
      embed: req._parsedUrl.path.indexOf('/embed') === 0
    };
    if (err) {
      util.error(err);
      profile.error = {stack: err.stack};
      fn.call(res, 500, exports.client(profile));
    } else {
      profile.error = {message: estr + ' not found'};
      fn.call(res, 404, exports.client(profile));
    }
    return true;
  } else return false;
};

/*
 * Prepare obj for client.
 * - replace ObjectsIDs with strings.
 */
exports.client = function (obj) {
  obj = _.clone(obj);
  if (obj._id) {
    obj.id = obj._id.toString();
    delete obj._id;
  }
  _.each(obj, function (att, n) {
    if (_.isObject(att) && att._id) {
      att.id = att._id.toString();
      delete att._id;
      exports.client(att);
    } else if (_.isObject(att) || _.isArray(att)) {
      exports.client(att);
    }
  });
  return obj;
};

/*
 * Creates a string identifier.
 * @length Number
 */
exports.key = function (length) {
  length = length || 8;
  var key = '';
  var possible = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (var i = 0; i < length; ++i) {
    key += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return key;
};

/*
 * Make salt for a password.
 */
exports.salt = function () {
  return Math.round((new Date().valueOf() * Math.random())) + '';
};

/*
 * Encrypt string.
 */
exports.encrypt = function (str, salt) {
  return crypto.createHmac('sha1', salt).update(str).digest('hex');
};

/*
 * Hash string.
 */
exports.hash = function (str) {
  return crypto.createHash('md5').update(str).digest('hex');
};

/*
 * Create a 32-bit identifier.
 */
exports.createId_32 = function () {
  return parseInt(Math.random() * 0x7fffffff);
};

/*
 * Remove ''s from an object.
 */
exports.removeEmptyStrings = function (obj) {
  _.each(obj, function (v, k) {
    if (_.isString(v) && v.trim() === '') {
      delete obj[k];
    }
  });
};

/*
 * Convert tag string to array.
 */
exports.tagify = function (str, delim) {
  var splitter = delim ? '[' + delim + ']': '[\\W,_]';
  return !str ? []: _.chain(str.split(new RegExp(splitter)))
    .reject(function (t) { return t === ''; })
    .map(function (t) { return t.trim(); }).uniq().value();
};


/* Execute a redis lexical search */
exports.search = function(client, group, string, limit, cb) {
  if (_.isFunction(limit)) cb = limit;
  var str = (/\s/.test(string) ? string : stemmer(string)).toLowerCase();
  var zrange = '[' + str;
  client.zrangebylex(
      group + '-search', zrange,
      // Don't know why the 0xFF works... saw in a gist but can't find docs
      zrange + String.fromCharCode(0xFF),
      'LIMIT', 0, limit,  cb);
};

/*
 * Index a document with redis.
 * If options are passed with strategy noTokens, the string is indexed as is
 */
exports.index = function (client, group, doc, keys, options, cb) {
  if (_.isFunction(options)) cb = options;
  cb = cb || function(){};
  if (keys.length === 0) return cb();
  var _cb = _.after(keys.length, cb);
  _.each(keys, function (k) {
    if (_.isArray(doc[k])) {
      var __cb = _.after(doc[k].length, _cb);
      _.each(doc[k], function (s) { _index(s, __cb); });
    } else _index(doc[k], _cb);
  });

  function _index(str, cb) {
    if (!_.isString(str)) return cb();
    if (options.strategy === 'noTokens') {
      client.zadd(group + '-search', 0, str.toLowerCase() + '::' + doc._id, cb);
    } else {
      str = _.humanize(str).match(/\w+/g);
      str = _.filter(str, function (s) {
        return stopWords.indexOf(s) === -1;
      });
      if (!str) return cb();
      //if (stopWords.indexOf(str) !== -1) return cb();
      // Redis key, score, string, callback
      var ___cb = _.after(str.length, cb);
      _.each(str, function (s) {
        if (s === '') return ___cb();
        client.zadd(group + '-search', 0, stemmer(s.toLowerCase()) + '::' + doc._id, ___cb);
      });
    }
  }
};

var stopWords = [
  "a", "a's", "able", "about", "above", "according", "accordingly", "across",
  "actually", "after", "afterwards", "again", "against", "ain't", "all",
  "allow", "allows", "almost", "alone", "along", "already", "also", "although",
  "always", "am", "among", "amongst", "an", "and", "another", "any", "anybody",
  "anyhow", "anyone", "anything", "anyway", "anyways", "anywhere", "apart",
  "appear", "appreciate", "appropriate", "are", "aren't", "around", "as",
  "aside", "ask", "asking", "associated", "at", "available", "away", "awfully",
  "b", "be", "became", "because", "become", "becomes", "becoming", "been",
  "before", "beforehand", "behind", "being", "believe", "below", "beside",
  "besides", "best", "better", "between", "beyond", "both", "brief", "but",
  "by", "c", "c'mon", "c's", "came", "can", "can't", "cannot", "cant", "cause",
  "causes", "certain", "certainly", "changes", "clearly", "co", "com", "come",
  "comes", "concerning", "consequently", "consider", "considering", "contain",
  "containing", "contains", "corresponding", "could", "couldn't", "course",
  "currently", "d", "definitely", "described", "despite", "did", "didn't",
  "different", "do", "does", "doesn't", "doing", "don't", "done", "down",
  "downwards", "during", "e", "each",  "edu", "eg", "eight", "either", "else",
  "elsewhere", "enough", "entirely", "especially", "et", "etc", "even", "ever",
  "every", "everybody", "everyone", "everything", "everywhere", "ex",
  "exactly", "example", "except", "f", "far", "few", "fifth", "first", "five",
  "followed", "following", "follows", "for", "former", "formerly", "forth",
  "four", "from", "further", "furthermore", "g", "get", "gets", "getting",
  "given", "gives", "go", "goes", "going", "gone", "got", "gotten",
  "greetings", "h", "had", "hadn't", "happens", "hardly", "has", "hasn't",
  "have", "haven't", "having", "he", "he's", "hello", "help", "hence", "her",
  "here", "here's", "hereafter", "hereby", "herein", "hereupon", "hers",
  "herself", "hi", "him", "himself", "his", "hither", "hopefully", "how",
  "howbeit", "however", "i", "i'd", "i'll", "i'm", "i've", "ie", "if",
  "ignored", "immediate", "in", "inasmuch", "inc", "indeed", "indicate",
  "indicated", "indicates", "inner", "insofar", "instead", "into", "inward",
  "is", "isn't", "it", "it'd", "it'll", "it's", "its", "itself", "j", "just",
  "k", "keep", "keeps", "kept", "know", "knows", "known", "l", "last",
  "lately", "later", "latter", "latterly", "least", "less", "lest", "let",
  "let's", "like", "liked", "likely", "little", "look", "looking", "looks",
  "ltd", "m", "mainly", "many", "may", "maybe", "me", "mean", "meanwhile",
  "merely", "might", "more", "moreover", "most", "mostly", "much", "must",
  "my", "myself", "n", "name", "namely", "nd", "near", "nearly", "necessary",
  "need", "needs", "neither", "never", "nevertheless", "new", "next", "nine",
  "no", "nobody", "non", "none", "noone", "nor", "normally", "not", "nothing",
  "novel", "now", "nowhere", "o", "obviously", "of", "off", "often", "oh",
  "ok", "okay", "old", "on", "once", "one", "ones", "only", "onto", "or",
  "other", "others", "otherwise", "ought", "our", "ours", "ourselves", "out",
  "outside", "over", "overall", "own", "p", "particular", "particularly",
  "per", "perhaps", "placed", "please", "plus", "possible", "presumably",
  "probably", "provides", "q", "que", "quite", "qv", "r", "rather", "rd", "re",
  "really", "reasonably", "regarding", "regardless", "regards", "relatively",
  "respectively", "right", "s", "said", "same", "saw", "say", "saying", "says",
  "second", "secondly", "see", "seeing", "seem", "seemed", "seeming", "seems",
  "seen", "self", "selves", "sensible", "sent", "serious", "seriously",
  "seven", "several", "shall", "she", "should", "shouldn't", "since", "six",
  "so", "some", "somebody", "somehow", "someone", "something", "sometime",
  "sometimes", "somewhat", "somewhere", "soon", "sorry", "specified",
  "specify", "specifying", "still", "sub", "such", "sup", "sure", "t", "t's",
  "take", "taken", "tell", "tends", "th", "than", "thank", "thanks", "thanx",
  "that", "that's", "thats", "the", "their", "theirs", "them", "themselves",
  "then", "thence", "there", "there's", "thereafter", "thereby", "therefore",
  "therein", "theres", "thereupon", "these", "they", "they'd", "they'll",
  "they're", "they've", "think", "third", "this", "thorough", "thoroughly",
  "those", "though", "three", "through", "throughout", "thru", "thus", "to",
  "together", "too", "took", "toward", "towards", "tried", "tries", "truly",
  "try", "trying", "twice", "two", "u", "un", "under", "unfortunately",
  "unless", "unlikely", "until", "unto", "up", "upon", "us", "use", "used",
  "useful", "uses", "using", "usually", "uucp", "v", "value", "various",
  "very", "via", "viz", "vs", "w", "want", "wants", "was", "wasn't", "way",
  "we", "we'd", "we'll", "we're", "we've", "welcome", "well", "went", "were",
  "weren't", "what", "what's", "whatever", "when", "whence", "whenever",
  "where", "where's", "whereafter", "whereas", "whereby", "wherein",
  "whereupon", "wherever", "whether", "which", "while", "whither", "who",
  "who's", "whoever", "whole", "whom", "whose", "why", "will", "willing",
  "wish", "with", "within", "without", "won't", "wonder", "would", "would",
  "wouldn't", "x", "y", "yes", "yet", "you", "you'd", "you'll", "you're",
  "you've", "your", "yours", "yourself", "yourselves", "z",
  "zero"];
