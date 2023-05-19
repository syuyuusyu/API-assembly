/* eslint valid-jsdoc: "off" */

'use strict';

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



  config.middleware = [
    'restful',
  ];

  config.restful = {
    match: /\/invoke\/|\/invokeInfo\/test/,
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

  config.systemInfo = [
    {
        systemId: 1,
        url: 'http://127.0.0.1:7001',
        name: 'mock'
    },
    {
      systemId: 2,
      url: 'http://127.0.0.1:7001',
      name: 'test'
  },
  ]
  return config
};


