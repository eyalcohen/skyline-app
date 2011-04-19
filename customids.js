
/**
 * Module dependencies.
 */

var BinaryParser = require('../../../support/node-mongodb-native/lib/mongodb').BinaryParser;

/**
 * Access driver.
 */

var driver = global.MONGOOSE_DRIVER_PATH || '../drivers/node-mongodb-native'
  , ObjectId = require(driver + '/objectid')
;

/**
 * Module exports.
 */


var VehicleId = exports.VehicleId = function (id) {
  this.id = this.generate();
};

VehicleId.prototype.__proto__ = ObjectId.prototype;

VehicleId.prototype.generate = function () {
  var unixTime = (new Date()).getTime();
  var time4Bytes = BinaryParser.encodeInt(parseInt(unixTime/1000), 32, true, true);
  var time2Bytes = BinaryParser.encodeInt(parseInt(unixTime%1000), 16, true, true);
  var machine2Bytes = BinaryParser.encodeInt(parseInt(Math.random() * 0xffff), 16, false);
  var vehicle4Bytes = BinaryParser.encodeInt(parseInt(Math.random() * 0xffffffff), 32, false, true);
  return time4Bytes + time2Bytes + machine2Bytes + vehicle4Bytes;
  //return BinaryParser.encodeInt(parseInt(Math.random() * 0xffffffff), 32, false, true);
};


var BucketId = exports.BucketId = function (id) {
  this.id = this.generate();
};

BucketId.prototype.__proto__ = ObjectId.prototype;

BucketId.prototype.generate = function () {
  var unixTime = (new Date()).getTime();
  var time4Bytes = BinaryParser.encodeInt(parseInt(unixTime/1000), 32, true, true);
  var time2Bytes = BinaryParser.encodeInt(parseInt(unixTime%1000), 16, true, true);
  var machine2Bytes = BinaryParser.encodeInt(parseInt(Math.random() * 0xffff), 16, false);
  var vehicle4Bytes = BinaryParser.encodeInt(parseInt(Math.random() * 0xffffffff), 32, false, true);
  return time4Bytes + time2Bytes + machine2Bytes + vehicle4Bytes;
};

BucketId.prototype.__defineGetter__('time', function () {
  return (BinaryParser.decodeInt(this.id.substring(0,4), 32, true, true) * 1000) + (BinaryParser.decodeInt(this.id.substring(4,6), 16, true, true));
})

BucketId.prototype.__defineGetter__('vehicle', function () {
  return BinaryParser.decodeInt(this.id.substring(8,12), 32, false, true);
})