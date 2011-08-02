/**
 * Module dependencies.
 */


var crypto = require('crypto')
  , User
  , Vehicle
  , LoginToken
;


/**
  * Models wrapper used in config
  */


function defineModels(mongoose, fn) {
  var Schema = mongoose.Schema
    , ObjectId = Schema.ObjectId
  ;


  /**
    * Converts string to title case.
    */


  String.prototype.toTitleCase = function () {
    return this.replace(/\w\S*/g, function (txt) {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  };


  /**
    * Ensures a string exists and is not empty.
    */


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
    , role              : { type: String, enum: ['admin', 'guest', 'office'], default: 'guest' }
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
      _id     : Number
    , make    : String
    , model   : String
    , year    : { type: String, index: true }
    , user_id : ObjectId
    , created : { type: Date, default: Date.now }
  });


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
    if (this.isNew) {
      this.series = this.randomToken();
    }
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
  mongoose.model('LoginToken', LoginToken);

  fn();
}

exports.defineModels = defineModels;
