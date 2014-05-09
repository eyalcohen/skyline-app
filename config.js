/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'mongodb://skyliner:time@candidate.13.mongolayer.com:10265,candidate.12.mongolayer.com:10259/skyline',
        REDIS_HOST: 'skyline-cache.i7jw04.0001.use1.cache.amazonaws.com',
        REDIS_PORT: 6379,
        google: {
          returnURL: '...',
          realm: null
        },
        facebook: {
          name: 'Timeline',
          clientID: 533526143400722,
          clientSecret: '9147a4bee3391b0307add85e1cb959e7'
        },
        twitter: {
          consumerKey: 'ViEOzmAwsh8LEiCrL52HwQ',
          consumerSecret: 'KWpNvp1rUU2ZXjttVmVdtypGluNFEn4xUgka5afDEEI'
        },
        cloudfront: {
          snapshots: 'https://d3jyblv3lavppq.cloudfront.net'
        },
        gmail: {
          user: 'robot@grr.io',
          password: 'w0lfpackm0d3',
          host: 'smtp.gmail.com',
          ssl: true,
          from: 'Timeline <robot@grr.io>',
        }
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/skyline',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        google: {
          returnURL: '...',
          realm: null
        },
        facebook: {
          name: 'Timeline (dev)',
          clientID: 248099122008971,
          clientSecret: '8f534bc1ec6504dd640fa7ac663a9529'
        },
        twitter: {
          consumerKey: 'ViEOzmAwsh8LEiCrL52HwQ',
          consumerSecret: 'KWpNvp1rUU2ZXjttVmVdtypGluNFEn4xUgka5afDEEI'
        },
        cloudfront: {
          snapshots: 'https://d3jyblv3lavppq.cloudfront.net'
        },
        gmail: {
          user: 'robot@grr.io',
          password: 'w0lfpackm0d3',
          host: 'smtp.gmail.com',
          ssl: true,
          from: 'Timeline <robot@grr.io>',
        }
      };
}
