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

/**
 * Constructor.
 * @object options
 */
module.exports = function (options, uri) {
  this.FROM = options.from;
  delete options.from;
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
  if (!this.smtp) {
    return util.error('no SMTP server connection');
  }

  if (template) {
    jade.renderFile(path.join(__dirname, '../views', template.file),
        template.locals, _.bind(function (err, body) {
      if (err) return cb(err);

      // create the message
      var message;
      if (template.html) {
        message = mailer.message.create(options);
        message.attach_alternative(body);
      } else {
        message = options;
      }
      message.text = body;

      // send email
      this.smtp.send(message, cb);
    }, this));
  } else {

    // send email
    this.smtp.send(options, cb);
  }
};

/**
 * Send a notification.
 * @object recipient
 * @object note
 * @string body
 * @function cb
 */
module.exports.prototype.notify = function (recipient, note, body, cb) {
  cb = cb || function(){};
  if (!this.BASE_URI) {
    return cb('BASE_URI required');
  }
  var url = this.BASE_URI;

  // Build the email subject.
  var subject;
  if (note.event.data.action.t === 'note') {
    url += '/' + note.event.data.target.s
    var verb = 'wrote a note on';
    var owner;
    if (note.event.data.action.i === note.event.data.target.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === note.event.data.target.i) {
      owner = 'your';
    } else {
      owner = note.event.data.target.a + '\'s';
      verb = 'also ' + verb;
    }
    subject = note.event.data.action.a + ' '
        + verb + ' '
        + owner + ' '
        + note.event.data.target.t
        + (note.event.data.target.n !== '' ? ' "'
        + note.event.data.target.n + '"': '');

  } else if (note.event.data.action.t === 'comment') {
    var verb, target;
    if (note.event.data.target.t === 'note') {
      var cowner = note.subscriber_id.toString() === note.event.data.target.i ? 'your':
          (note.event.data.action.i === note.event.data.target.i ? 'their':
          note.event.data.target.a + '\'s');
      verb = 'replied to ' + cowner + ' note on';
      target = note.event.data.target.p;
    } else {
      verb = 'commented on';
      target = note.event.data.target;
    }
    url += '/' + target.s
    var owner;
    if (note.event.data.action.i === target.i) {
      owner = 'their';
      verb = 'also ' + verb;
    } else if (note.subscriber_id.toString() === target.i) {
      owner = 'your';
    } else {
      owner = target.a + '\'s';
      verb = 'also ' + verb;
    }
    subject = note.event.data.action.a + ' '
        + verb + ' '
        + owner + ' '
        + target.t
        + (target.n !== '' ? ' "'
        + target.n + '"': '');

  } else if (note.event.data.action.t === 'request') {
    url += '/' + note.event.data.action.s;
    subject = note.event.data.action.a + ' '
        + 'wants to follow you';

  } else if (note.event.data.action.t === 'accept') {
    url += '/' + note.event.data.action.s;
    subject = 'You are now following '
        + note.event.data.action.a;

  } else if (note.event.data.action.t === 'follow') {
    url += '/' + note.event.data.action.s;
    subject = note.event.data.action.a + ' '
        + 'is now following you';
  }

  if (!subject) {
    return cb('Invalid email subject');
  }

  // Create a login key for this email.
  db.Keys.create({user_id: recipient._id}, _.bind(function (err, key) {
    if (err) return cb(err);

    // Setup the email.
    this.send({
      to: recipient.displayName + ' <' + recipient.primaryEmail + '>',
      from: this.FROM,
      // 'reply-to': 'notifications+' + recipient._id.toString()
      //     + note.event.post_id.toString() + '@island.io',
      subject: subject
    }, {
      file: 'notification.jade',
      html: true,
      locals: {
        body: body || '',
        url: url,
        surl: this.BASE_URI + '/settings/' + key._id.toString()
      }
    }, cb);
  }, this));
}

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
      from: this.FROM,
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
