var mailer = require('emailjs')
  , crypto = require('crypto')
  , path = require('path')
  , sys = require('sys')
  , util = require('util')
  , jade = require('jade')
  , SMTP
;



var emailServer = {
        user     : 'vc.c2s.mm@gmail.com'
      , password : 'humtastic'
      , host     : 'smtp.gmail.com'
      , ssl      : true
    }
  , emailDefaults = {
       from      : 'Mission Motor Company <vc.c2s.mm@gmail.com>'
    }


  /**
   * send mail
   * @param object options
   * @param object template
   * @param function fn
   */

  , email = function (options, template, fn) {
      if (!exports.active)
        return;

      util.log("Sending notification email using options:\n" +
               util.inspect(options) + "\n" +
               "Template:\n" +
               util.inspect(template));

      if ('function' === typeof template) {
        fn = template;
        template = false;
      }

      // connect to server
      if (!SMTP)
        SMTP = mailer.server.connect(emailServer);

      // merge options
      var k = Object.keys(emailDefaults);
      for (var i=0; i < k.length; i++)
        if (!options.hasOwnProperty(k[i]))
          options[k[i]] = emailDefaults[k[i]];

      if (template)
        jade.renderFile(path.join(__dirname, 'views', template.file), { locals: template.locals }, function (err, body) {
          if (err) {
            console.log(err);
            return;
          }
          // create the message
          if (template.html) {
            var message = mailer.message.create(options);
            message.attach_alternative(body);
          } else
            var message = options;
          message.text = body;
          // send email
          SMTP.send(message, fn);
        });
      else
        // send email
        SMTP.send(options, fn);
    }

  /**
   * Send the welcome message
   * @param object user
   */

  , welcome = function (user, fn) {
      var to = user.name.first + ' ' + user.name.last + '<' + user.email + '>';
      email({ to: to, subject: 'Welcome to the Mission Motors Drive Cycle Project' }, { file: 'welcome.jade', html: true, locals: { user: user } }, fn);
    }

  /**
   * Send the error to Sander
   * @param object err
   */

  , problem = function (err) {
      email({ to: 'C2S Admin <sander@ridemission.com>', subject: 'Something wrong at C2S' }, { file: 'problem.jade', html: false, locals: { err: err } }, function () {});
    }
;



exports.active = true;
exports.email = email;
exports.welcome = welcome;
exports.problem = problem;


