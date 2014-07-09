/*
 * storage.js - Handles saving static content to AWS
 */

// Module Dependencies
var path = require('path');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var AWS = require('aws-sdk');
var fs = require('fs');

module.exports = function() {
  this.prod = process.env.NODE_ENV === 'production';
  var AWS_CONFIG = {};
  if (!this.prod) {
    var dirname = path.dirname(process.mainModule.filename);
    var creds = fs.readFileSync(dirname + '/.aws/aws_credential_file', 'utf8');
    AWS_CONFIG.accessKeyId = creds.match(/AWSAccessKeyId=(.+)/)[1];
    AWS_CONFIG.secretAccessKey = creds.match(/AWSSecretKey=(.+)/)[1];
  } else {
    AWS_CONFIG.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    AWS_CONFIG.secretAccessKey = process.env.AWS_SECRET_KEY;
  }
  AWS.config.update(AWS_CONFIG);
  this.s3 = new AWS.S3();

};

// obj = {
//  where: <String>
//  key: <String>
//  data: <Buffer>
//  contentType: <String> eg. 'image/png'
//  access: <String> - 'private' or 'public-read'
// }
module.exports.prototype.store = function (obj, cb) {
  var params = {
    Bucket: obj.where + (this.prod ? '' : '-dev'),
    Key: obj.key,
    Body: obj.data,
    ContentType: obj.contentType,
    ACL: obj.access || 'private'
  };
  function after(err, resp) {
    console.log(err ? err : 'Saved ' + params.Key + ' to S3');
    if (cb)
      cb(err);
  }
  this.s3.putObject(params, after);
};

// @param cb is a function(err, data, contentType)
module.exports.prototype.retrieve = function(where, key, cb) {
  var params = {
    Bucket: where + (this.prod ? '' : '-dev'),
    Key: key,
  };
  function after(err, resp) {
    var data, contentType;
    if (resp) {
      data = resp.Body;
      contentType = resp.ContentType;
    }
    if (cb)
      cb(err, data, contentType);
  }
  this.s3.getObject(params, after);
};

// @param cb is a function(err, data, contentType)
module.exports.prototype.delete = function(where, key, cb) {
  var params = {
    Bucket: where + (this.prod ? '' : '-dev'),
    Key: key,
  };
  function after(err, resp) {
    if (cb)
      cb(err);
  }
  this.s3.deleteObject(params, after);
};

module.exports.prototype.urlGenerator = function(where, key) {
  return ['https://s3.amazonaws.com', where + (this.prod ? '': '-dev'), key].join('/');
}
