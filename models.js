/**
 * Module dependencies.
 */

var crypto = require('crypto')
  , User
  , Vehicle
  , Slice1000
  , Slice20000
  , Slice1000000
  , Slice60000000
  , Slice3600000000
  , Slice86400000000
;

function defineModels(mongoose, generateId, fn) {
  var Schema = mongoose.Schema
    , ObjectId = Schema.ObjectId
  ;
  
  String.prototype.toTitleCase = function () {
    return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
  };
  
  User = new Schema({
      email: String
    , name: {
          first: String
        , last: String
      }
  });
  
  User.virtual('name.full')
    .get(function () {
      return this.name.first + ' ' + this.name.last;
    })
    .set(function (setFullNameTo) {
      var split = setFullNameTo.split(' ')
        , firstName = split[0], lastName = split[1];
      this.set('name.first', firstName.toTitleCase());
      this.set('name.last', lastName.toTitleCase());
      this.set('email', lastName + '.' + firstName + '@fak.er');
    });
  
  Vehicle = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , make: String
    , model: String
    , year: String
    , user_id: ObjectId
  });
  
  Slice1000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  Slice20000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  Slice1000000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  Slice60000000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  Slice3600000000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  Slice86400000000 = new Schema({
      _id: { type: ObjectId, auto: true, generator: generateId }
    , samples: Array
  });
  
  
  mongoose.model('User', User);
  mongoose.model('Vehicle', Vehicle);
  mongoose.model('Slice1000', Slice1000);
  mongoose.model('Slice20000', Slice20000);
  mongoose.model('Slice1000000', Slice1000000);
  mongoose.model('Slice60000000', Slice60000000);
  mongoose.model('Slice3600000000', Slice3600000000);
  mongoose.model('Slice86400000000', Slice86400000000);
  
  fn();
}

exports.defineModels = defineModels;
