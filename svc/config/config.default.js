/* eslint valid-jsdoc: "off" */

'use strict';
const path = require('path')

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = {}

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1678344297406_5255';
  config.static = {
    prefix: '/',
    dir: path.join(appInfo.baseDir, 'app/public'),
    dynamic: true,
    preload: false,
    maxAge: 0,
    buffer: false,
  };

  config.middleware = [
    'restful',
  ];

  config.restful = {
    match: /\/invoke\//,
  };

  config.mysql = {
      client: {
          host: '127.0.0.1',
          port: '3306',
          user: 'root',
          password: '1234',
          database: 'rest',
          dialect: 'mysql'
      },
      app: true,
      agent: false,
  };

  config.redis = {
    client: {
        port: 6379,
        host: '127.0.0.1',
        password: '',
        db: 0,
    },
  };



  config.logger = {
    //disableConsoleAfterReady: false,
    consoleLevel: 'INFO',
    dir: '/Users/syu/project/node/rest/svc/logs'
  }

  config.security = {
    csrf: {
      enable: false, // 关闭 CSRF
    },
    domainWhiteList: [ '*' ], // 允许的请求来源，* 代表所有
  };
  
  config.cors = {
    origin: '*', // 允许跨域请求的地址，* 代表所有
    allowMethods: 'GET,HEAD,PUT,POST,DELETE,PATCH',
  }

  // config.systemInfo = [
  //   {
  //       systemId: 1,
  //       url: 'http://127.0.0.1:7001',
  //       name: 'mock'
  //   },
  //   {
  //     systemId: 2,
  //     url: 'http://127.0.0.1:7001',
  //     name: 'example'
  //   }
  // ]

  config.systemInfo = [
    {
        systemId: 1,
        url: 'http://218.63.110.21:8090',
        name: '昭通中联his'
    },
    {
        systemId: 2,
        url: 'http://112.115.169.180:88',
        name: '云大东软his'
    },
    {
        systemId: 3,
        url: 'http://127.0.0.1:60010',
        name: '昆明皮肤病医院'
    },
    {
        systemId: 5,
        url: '',
        name: '其他'
    },
    {
        systemId: 7,
        url: 'http://218.63.11.33:8090',
        name: '昭通市中医院'
    },
    {
        systemId: 4,
        url: 'http://his.szprism.com',
        name: '红日药业'
    },
    {
        systemId: 9,
        url: 'http://183.224.113.185:9900',
        name: '滇东北区域医疗中心'
    },
    {
        systemId: 10,
        url: 'http://218.63.110.21:9900',
        name: '昭一院东软'
    },
    {
        systemId: 11,
        url: 'http://127.0.0.1:60011',
        name: '云南圣约翰医院'
    },
    {
        systemId: 12,
        url: 'http://39.129.120.175:9000',
        name: '元谋医共体'
    }
]
  return config
};


