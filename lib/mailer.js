/*
 * mail.js: Mail handling.
 *
 */

// Module Dependencies
var mailer = require('emailjstmp');
var jade = require('jade');
var path = require('path');
var util = require('util');
var Step = require('step');
var _ = require('underscore');
_.mixin(require('underscore.string'));
var db = require('./db');

// Defaults
var FROM = 'Skyline <robot@grr.io>';

/**
 * Constructor.
 * @object options
 */
module.exports = function (options, uri) {
  this.options = options;
  this.BASE_URI = uri;
  this.smtp = mailer.server.connect(options);
}

/**
 * Send an email.
 * @object options
 * @object template
 * @function cb
 */
module.exports.prototype.send = function (options, template, cb) {
  if ('function' === typeof template) {
    cb = template;
    template = false;
  }
  if (!this.smtp) return util.error('no SMTP server connection');

  if (template)
    jade.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb(err);

      // create the message
      var message;
      if (template.html) {
        message = mailer.message.create(options);
        message.attach_alternative(body);
      } else message = options;
      message.text = body;

      // send email
      this.smtp.send(message, cb);
    }, this));
  else
    // send email
    this.smtp.send(options, cb);
};

/**
 * Send a password reset key.
 * @object user
 * @function cb
 */
module.exports.prototype.reset = function (user, cb) {
  cb = cb || function(){};
  if (!this.BASE_URI) return cb('BASE_URI required');

  // Create a login key for this email.
  db.Keys.create({user_id: user._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: user.displayName + ' <' + user.primaryEmail + '>',
      from: FROM,
      subject: 'Skyline Password Reset'
    }, {
      file: 'reset.jade',
      html: true,
      locals: {
        name: user.displayName,
        url: this.BASE_URI + '/reset?t=' + key._id.toString()
      }
    }, cb);
  }, this));
}
