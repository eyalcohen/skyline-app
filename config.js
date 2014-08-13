/*
 * config.js: Connection configuration.
 *
 */

exports.get = function (env) {
  return env === 'production' ?
      {
        MONGO_URI: 'mongodb://skyliner:time@candidate.13.mongolayer.com:10265,candidate.12.mongolayer.com:10259/skyline',
        REDIS_HOST_CACHE: 'ip-172-31-20-186.ec2.internal',
        REDIS_HOST_SESSION: 'skyline-cache.i7jw04.0001.use1.cache.amazonaws.com',
        REDIS_PORT: 6379,
        google: {
          clientID: '920361952341-ac0kgdulmbgtjmg6s6kba9edifi7khkn.apps.googleusercontent.com',
          clientSecret: 'SauGa6Lo_njd21rIfOvZvvgX'
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
          user: 'notifications@skyline-data.com',
          password: 'Sk7L1n3ema1l',
          host: 'smtp.gmail.com',
          ssl: true,
          from: 'Skyline <notifications@skyline-data.com>'
        },
        cartodb: {
          user: "skyline",
          table: "samples",
          key: "e2c51af30080afb68c9c7702c2e20f7d5f2cd506"
        }
      }:
      {
        // MONGO_URI: 'mongodb://localhost:27017/skyline',
        MONGO_URI: 'mongodb://skyliner:time@candidate.13.mongolayer.com:10265,candidate.12.mongolayer.com:10259/skyline',
        //REDIS_HOST_CACHE: 'ec2-54-88-27-85.compute-1.amazonaws.com',
        REDIS_HOST_CACHE: 'localhost',
        REDIS_HOST_SESSION: 'localhost',
        REDIS_PORT: 6379,
        google: {
          clientID: '920361952341-iaoeoemjcub4ajsgf0aj2rk4jv48glp8.apps.googleusercontent.com',
          clientSecret: 'dzOHPLstyzkDQqvQm89vluzU'
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
          user: 'notifications@skyline-data.com',
          password: 'Sk7L1n3ema1l',
          host: 'smtp.gmail.com',
          ssl: true,
          from: 'Skyline <notifications@skyline-data.com>'
        },
        cartodb: {
          user: "skyline",
          table: "samples_dev",
          key: "e2c51af30080afb68c9c7702c2e20f7d5f2cd506"
        }
      };
}
