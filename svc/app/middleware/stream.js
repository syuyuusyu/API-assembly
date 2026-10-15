const md5 = require('js-md5')
module.exports = (options, app) => {
    return async function restful(ctx, next) {
        ctx.logger.info(ctx.request.url);
        const apiKey = process.env.AI_API_KEY?.trim();
        const preObj = {
            deepseekApiKey: apiKey
                ? apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`
                : undefined,
        };

        ctx.request.body = {
            ...ctx.request.body,
            ...preObj,

        }
        await next();

    };
};
