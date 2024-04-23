'use strict';

module.exports = app => {
    app.beforeStart(async () => {
        // 应用会等待这个函数执行完成才启动
        app.logger.info('init app');
        app.logger.info(app.config.discription);

        const ctx = app.createAnonymousContext();
        //初始化接口调用
        let invokeEntitys = await app.mysql.query(`select * from invoke_info`)

        let invokeEntityKeyMap = {}
        for (let i = 0; i < invokeEntitys.length; i++) {
            let e = invokeEntitys[i]
            invokeEntityKeyMap[e.name] = e.id
            ctx.service.redis.hset('invokeEntitys', e.id, e)
        }
        await ctx.service.redis.set('invokeEntityKeyMap', invokeEntityKeyMap)


    })

    app.once('server', async server => {
        //const ctx = app.createAnonymousContext();

    });

};


