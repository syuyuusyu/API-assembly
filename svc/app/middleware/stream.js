const md5 = require('js-md5')
module.exports = (options, app) => {
    return async function restful(ctx, next) {
        ctx.logger.info(ctx.request.url);
        const preObj = {
            deepseekApiKey: 'Bearer sk-32ed178d46714af7886c2893755e000d',
        };

        ctx.request.body = {
            ...ctx.request.body,
            ...preObj,

        }
        await next();

    };
};