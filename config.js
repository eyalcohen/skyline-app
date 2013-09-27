/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'mongodb://rider:hummmcycles@zoe.mongohq.com:10014/skyline',
        REDIS_HOST: 'crestfish.redistogo.com',
        REDIS_PASS: '1b8a95ad4e582be0a56783b95392ce98',
        REDIS_PORT: 9084
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/skyline',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379
      };
}
