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
  var AWS_CONFIG = {};
  if (process.env.NODE_ENV !== 'production') {
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

module.exports.prototype.store = function (where, key, data, contentType, cb) {
  var params = {
    Bucket: where,
    Key: key,
    Body: data,
    ContentType: contentType,
  };
  function after(err, resp) {
    console.log(err ? err : 'Saved ' + params.Key + ' to S3');
    console.log(resp);
    if (cb)
      cb(err);
  }
  this.s3.putObject(params, after);
};

// @param cb is a function(err, data, contentType)
module.exports.prototype.retrieve = function(where, key, cb) {
  var params = {
    Bucket: where,
    Key: key,
  };
  function after(err, resp) {
    var data, contentType;
    if (resp) {
      data = resp.Body;
      contentType = resp.ContentType;
    }
    console.log(resp);
    cb(err, data, contentType);
  }
  this.s3.getObject(params, after);
};
