module.exports = (options, app) => {
    return async function restful(ctx, next) {
        ctx.logger.info(ctx.request.url);
        const keyMap = await ctx.service.redis.get('invokeEntityKeyMap')
        ctx.keyMap = keyMap
        const invokeName = ctx.request.url.replace('/invoke/', '');
        const currentEntity = await ctx.service.redis.hget('invokeEntitys', keyMap[invokeName])
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

        ctx.request.body = {
            ...ctx.request.body,
            ...preObj,

        }
        await next();
    };
};