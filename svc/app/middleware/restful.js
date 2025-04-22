const md5 = require('js-md5')
module.exports = (options, app) => {
    return async function restful(ctx, next) {
        ctx.logger.info(ctx.request.url);
        const keyMap = await ctx.service.redis.get('invokeEntityKeyMap')
        ctx.keyMap = keyMap
        //const invokeEntitys = await ctx.service.redis.get('invokeEntitys');
        const invokeName = ctx.request.url.replace('/invoke/', '');
        const currentEntity = await ctx.service.redis.hget('invokeEntitys', keyMap[invokeName])
        //ctx.logger.info(keyMap[invokeName]);
        //ctx.logger.info(currentEntity);
        ctx.currentEntity = currentEntity
        if (!currentEntity) {
            ctx.body = `${invokeName}请求不存在`;
            ctx.status = 404
            return;
        }

        const preObj = {};

        if (ctx.request.headers['activeMethod']) {
            preObj.activeMethod = ctx.request.headers['activeMethod'].join(',');
        }
        //东软token
        if (currentEntity.systemId == 2) {
            preObj.token = await app.redis.get('es_token');
        }

        //昭通东软
        if (currentEntity.systemId == 10) {
            const date = new Date();
            const options = {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            };
            const formattedDateString = date.toLocaleString('zh-CN', options).replace(/\//g, '-').replace(',', '');
            preObj.rootId =  Math.floor(Math.random() * 100000000) + ''
            preObj.auth = await app.redis.get('ztes_token')
            preObj.businessTime = formattedDateString
            preObj.operationTime = formattedDateString
            preObj.key = '078099ff-9ad3-42d3-b0d8-fac0582bb2cb'
        }

        //宁蒗
        if (currentEntity.systemId == 14) {
            const timestamp = parseInt(Date.now()/1000);
            const appid = '821f00dc-3f75-4e83-92fe-e51f1821ef3b'
            const kknd= md5(`ZLSOFTUN|${appid}|ujavVckB1CcZ7fGZ1r0Sw9pFP7VO8yjoa2PxrRyGE3mhU3ATaRfuGmtqQ/zt08Ie|${timestamp}|ZLSOFTUN`)
            const Authorization = `Bearer ${kknd}`
            preObj.timestamp = timestamp
            preObj.appid = appid
            preObj.Authorization = Authorization
            ctx.logger.info(preObj);
        }

        ctx.request.body = {
            ...ctx.request.body,
            ...preObj,

        }
        await next();

    };
};