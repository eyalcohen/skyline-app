/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'mongodb://skyliner:time@candidate.13.mongolayer.com:10265,candidate.12.mongolayer.com:10259/skyline',
        REDIS_HOST: 'crestfish.redistogo.com',
        REDIS_PASS: '1b8a95ad4e582be0a56783b95392ce98',
        REDIS_PORT: 9084,
        google: {
          returnURL: '...',
          realm: null
        },
        facebook: {
          name: 'Skyline',
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
          user: '...',
          password: '...',
          from: 'Skyline <>',
          host: 'smtp.gmail.com',
          ssl: true
        }
      }:
      {
        MONGO_URI: 'mongodb://localhost:27017/island',
        REDIS_HOST: 'localhost',
        REDIS_PORT: 6379,
        google: {
          returnURL: '...',
          realm: null
        },
        facebook: {
          name: 'Skyline (dev)',
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
          user: '...',
          password: '...',
          from: 'Skyline <>',
          host: 'smtp.gmail.com',
          ssl: true
        }
      };
}
