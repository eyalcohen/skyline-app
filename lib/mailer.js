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
var FROM = 'Skyline <robot@skyline-app.com>';

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
};

/**
 * Send a notification.
 * @object subscriber
 * @object note
 * @string body
 * @function cb
 */
module.exports.prototype.notify = function (subscriber, note, body, cb) {
  return;
  cb = cb || function(){};
  if (!this.BASE_URI) return cb('BASE_URI required');

  // Build the email subject.
  var subject, url;
  if (note.event.data.action.t === 'comment') {
    var verb, target, type;
    if (note.event.data.target.t === 'comment') {
      var cowner =  note.event.data.action.i === note.event.data.target.i ?
          'their':
          note.event.data.target.a + '\'s';
      verb = 'replied to ' + cowner + ' comment on';
      target = note.event.data.target.p;
    } else {
      verb = 'commented on';
      target = note.event.data.target;
    }
    if (target.t === 'dataset') {
      type = 'data source';
    } else {
      type = 'mashup';
    }
    var owner;
    if (note.event.data.action.i === target.i) {
      owner = 'their';
    } else if (note.subscriber_id.toString() === target.i) {
      owner = 'your';
    } else {
      owner = target.a + '\'s';
    }
    if (note.subscriber_id.toString() !== note.event.data.target.i)
        verb = 'also ' + verb;

    subject = note.event.data.action.a + ' '
        + verb + ' ' + owner + ' ' + type + ', "'
        + note.event.data.target.n + '"';
    url = target.s;

  } else if (note.event.data.action.t === 'create') {
    var verb, type;
    if (note.event.data.target.t === 'dataset') {
      verb = 'added';
      type = 'data source';
    } else {
      verb = 'created a new';
      type = 'mashup';
    }

    subject = note.event.data.action.a + ' '
        + verb + ' a ' + type + ', "'
        + note.event.data.target.n + '"';
    url = note.event.data.target.s;
  
  } else if (note.event.data.action.t === 'fork') {
    var type;
    if (note.event.data.target.t === 'dataset') {
      type = 'data source';
    } else {
      type = 'mashup';
    }
    var verb = 'forked';
    var owner;
    if (note.event.data.action.i === note.event.data.target.p.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === note.event.data.target.p.i) {
      owner = 'your';
    } else {
      owner = note.event.data.target.p.a + '\'s';
      verb = 'also ' + verb;
    }

    subject = note.event.data.action.a + ' '
        + verb + ' ' + owner + ' ' + type + ', "'
        + note.event.data.target.p.n + '"';
    url = note.event.data.target.s;
  }
  if (!subject) return cb('Unable to make subject');

  // Create a login key for this email.
  db.Keys.create({user_id: subscriber._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: subscriber.displayName + ' <' + subscriber.primaryEmail + '>',
      from: FROM,
      subject: subject
    }, {
      file: 'notification.jade',
      html: true,
      locals: {
        body: body || '',
        url: this.BASE_URI + '/' + url,
        surl: this.BASE_URI + '/settings/' + key._id.toString()
      }
    }, cb);
  }, this));
};
