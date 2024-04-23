'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
      router.get('/doNothing', controller.home.doNothing);

      //接口调用
      router.get('/invokeEntityInfo', controller.restful.toPage);
      router.get('/systemInfo', controller.restful.systemInfo);
      router.post('/invokeInfo/infos', controller.restful.infos);
      router.post('/invokeInfo/invokes', controller.restful.invokes);
      router.post('/invokeInfo/logs', controller.restful.logs);
      router.post('/invokeInfo/test', controller.restful.test);
      router.post('/invokeInfo/save', controller.restful.save);
      router.delete('/invokeInfo/delete/:id', controller.restful.delete);
      router.post('/invoke/:invokeName', controller.restful.invoke);
      router.get('/invokeInfo/checkUnique/:invokeName', controller.restful.checkUnique);
      router.get('/invokeInfo/groupName', controller.restful.groupName);
};
