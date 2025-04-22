const jwt = require('jsonwebtoken');

module.exports = (options, app) => {
    return async function author(ctx, next) {
        ctx.logger.info('author');
        const token = ctx.request.header['access_token'];
        const cert = "1c7h0k986yg5ijfc43l9og4343gb-['..mhf211sdd"
        try{
            const payload= jwt.verify(token, cert, { algorithms: ['HS256'] });
            let json = JSON.parse(payload.sub)
            ctx.userName = json.name;
            ctx.userId = json.userId;
            await next();
        }catch (e) {
	        ctx.logger.info(e)
            ctx.logger.info('token失效!!!');
            ctx.status = 401;
            ctx.body = { status: 401, message: 'token失效' };
        }

    };
};