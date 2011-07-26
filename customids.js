
/**
 * Module dependencies.
 */

var BinaryParser = require('mongoose/support/node-mongodb-native/lib/mongodb').BinaryParser
  , ObjectID = require('mongoose/lib/mongoose/types/objectid')
;


/**
 * EventID constructor.
 *
 * @param {Object} options
 * @return {ObjectID}
 */


var EventID = exports.EventID = function (options) {
      if ('string' == typeof options) {
        return new ObjectID(options);
      } else {
        return new ObjectID(createEventHexString(options));
      }
    }

  , createEventHexString = function (options) {
      // determine base vehicle id and time range
      var id = options && options.id || parseInt(Math.random() * 0xffffffff)
        , time = options && options.time || (new Date()).getTime()
      // 4 bytes for the id
        , vehicle4Bytes = 'number' == typeof id ?
          BinaryParser.encodeInt(id, 32, false, true) :
          BinaryParser.encode_utf8(id)
      // 6 bytes for unix timestamp
        , time4Bytes = BinaryParser.encodeInt(parseInt(time / 1000), 32, true, true)
        , time2Bytes = BinaryParser.encodeInt(parseInt(time % 1000), 16, true, true)
      // 2 bytes to ensure uniqueness
        , index2Bytes = BinaryParser.encodeInt(ObjectID.get_inc16(), 16, false, true)
      ;

      return toHexString(vehicle4Bytes + time4Bytes + time2Bytes + index2Bytes);
    }

  , toHexString = function(id) {
      var hexString = ''
        , number
        , value;

      for (var index = 0, len = id.length; index < len; index++) {
        value = BinaryParser.toByte(id.substr(index, 1));
        number = value <= 15
          ? '0' + value.toString(16)
          : value.toString(16);
        hexString = hexString + number;
      }

      return hexString;
    }
;


/**
 * Add to ObjectID
 */


ObjectID.get_inc16 = function() {
  ObjectID.index = (ObjectID.index + 1) % 0xFFFF;
  return ObjectID.index;
};

// accurate up to number of ms
ObjectID.prototype.__defineGetter__("time", function() {
  return (BinaryParser.decodeInt(this.id.substring(4,8), 32, true, true) * 1000) +
    (BinaryParser.decodeInt(this.id.substring(8,10), 16, true, true));
});

// for vehicle id
ObjectID.prototype.__defineGetter__("vehicleId", function() {
  return BinaryParser.decodeInt(this.id.substring(0,4), 32, false, true);
});


