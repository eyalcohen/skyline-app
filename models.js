/**
 * Module dependencies.
 */
 
//var Store = require('connect').session.Store;

var crypto = require('crypto')
  , User
  , Vehicle
  , EventBucket
  , LoginToken
  // , Slice1000
  // , Slice20000
  // , Slice1000000
  // , Slice60000000
  // , Slice3600000000
  // , Slice86400000000
;

function defineModels(mongoose, generateId, fn) {
  var Schema = mongoose.Schema
    , ObjectId = Schema.ObjectId
  ;
  
  String.prototype.toTitleCase = function () {
    return this.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };
  
  function validatePresenceOf(value) {
    return value && value.length;
  }


  /**
    * Model: Member
    */
  User = new Schema({
      email             : { type: String, validate: [validatePresenceOf, 'an email is required'], index: { unique: true } }
    , hashed_password   : String
    , salt              : String
    , name              : {
          first         : String
        , last          : String
      }
    , role              : { type: String, enum: ['admin', 'guest'], default: 'guest' }
    , created           : { type: Date, default: Date.now }
    , meta              : {
          logins        : { type: Number, default: 0 }
      }
  });

  User.index({ 'name.last': 1, 'name.first': 1 });

  User.virtual('id')
    .get(function () {
      return this._id.toHexString();
    });

  User.virtual('password')
    .set(function (password) {
      this._password = password;
      this.salt = this.makeSalt();
      this.hashed_password = this.encryptPassword(password);
    })
    .get(function () { return this._password; });

  User.virtual('name.full')
    .get(function () {
      return this.name.first + ' ' + this.name.last;
    })
    .set(function (setFullNameTo) {
      var split = setFullNameTo.split(' ')
        , firstName = split[0]
        , lastName = split[split.length - 1]
      ;
      this.set('name.first', firstName);
      this.set('name.last', lastName);
    });

  User.method('authenticate', function (plainText) {
    return this.encryptPassword(plainText) === this.hashed_password;
  });

  User.method('makeSalt', function () {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  User.method('encryptPassword', function (password) {
    return crypto.createHmac('sha1', this.salt).update(password).digest('hex');
  });

  User.pre('save', function (next) {
    if (this.isNew) {
      if (!validatePresenceOf(this.password)) {
        next(new Error('Invalid password'));
      } else {
        next();
      }
    } else {
      next();
    }
  });
  
  
  /**
    * Model: Vehicle
    */
  Vehicle = new Schema({
      _id     : { type: ObjectId, auto: true, generator: generateId }
    , make    : String
    , model   : String
    , year    : { type: String, index: true }
    , user_id : ObjectId
    , created : { type: Date, default: Date.now }
  });
  
  
  /**
    * Model: EventBucket
    */
  EventBucket = new Schema({
      _id    : { type: ObjectId, auto: true, generator: generateId }
    , bounds : {}
    , events : Array
  });
  
  
  // Slice1000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  // 
  // Slice20000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  // 
  // Slice1000000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  // 
  // Slice60000000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  // 
  // Slice3600000000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  // 
  // Slice86400000000 = new Schema({
  //     _id: { type: ObjectId, auto: true, generator: generateId }
  //   , samples: Array
  // });
  
  
  
  
  /**
    * Model: LoginToken
    *
    * Used for session persistence.
    */
  LoginToken = new Schema({
      email   : { type: String, index: true }
    , series  : { type: String, index: true }
    , token   : { type: String, index: true }
  });

  LoginToken.method('randomToken', function () {
    return Math.round((new Date().valueOf() * Math.random())) + '';
  });

  LoginToken.pre('save', function (next) {
    // Automatically create the tokens
    this.token = this.randomToken();
    if (this.isNew)
      this.series = this.randomToken();
    next();
  });

  LoginToken.virtual('id')
    .get(function () {
      return this._id.toHexString();
    });

  LoginToken.virtual('cookieValue')
    .get(function () {
      return JSON.stringify({ email: this.email, token: this.token, series: this.series });
    });
  
  
  
  mongoose.model('User', User);
  mongoose.model('Vehicle', Vehicle);
  mongoose.model('EventBucket', EventBucket);
  mongoose.model('LoginToken', LoginToken);
  // mongoose.model('Slice1000', Slice1000);
  // mongoose.model('Slice20000', Slice20000);
  // mongoose.model('Slice1000000', Slice1000000);
  // mongoose.model('Slice60000000', Slice60000000);
  // mongoose.model('Slice3600000000', Slice3600000000);
  // mongoose.model('Slice86400000000', Slice86400000000);
  
  fn();
}

exports.defineModels = defineModels;
