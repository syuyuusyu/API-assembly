const Service = require('egg').Service;
const EventEmitter = require('events').EventEmitter;

class RestfulService extends Service {

    constructor(ctx) {
        super(ctx);
        Object.assign(this, EventEmitter.prototype);
    }

    async test(entity, queryObj){
        if (entity.systemId) {
            const baseUrl = this.app.config.systemInfo.find(s => s.systemId == entity.systemId).url;
            queryObj.baseUrl = baseUrl;
        }
        let url = this.parseByqueryMap(entity.url, queryObj);
        let method = entity.method.toUpperCase();
        let data = this.parseByqueryMap(entity.body, queryObj);
        data = JSON.parse(data);
        let head = this.parseByqueryMap(entity.head, queryObj);
        head = JSON.parse(head);

        let invokeResult;
        try {
            invokeResult = await this.app.curl(url, {
                method: method,
                data: data,
                headers: head,
                dataType: 'json',
                timeout: 200000,
            });
            //let time2 = new Date() * 1
            //console.log('span time', (time2 - time)/1000)
        } catch (e) { 
            invokeResult = {
                data: {
                    'msg': 'call API error!!',
                    'url': url,
                    'method:': method,
                    'head:': head,
                    'body:': data,
                    'description': e.toString(),
                    'exception': true
                }
            }
        }
        let presult = {}
        if (entity.parseFun) {
            try {
                console.log(entity.parseFun)
                let fn = evil(entity.parseFun);
                presult = fn(invokeResult.data, invokeResult.headers, invokeResult.status, head, data, url);
            } catch (e) {
                presult = {
                    msg : 'Error running parse function',
                    error : e.toString()
                }
            }
        } else {
            presult = invokeResult.data
        }
        return {
            oresult : invokeResult.data,
            presult : presult
        }
    }

    async invoke(entity, queryObj) {
        if (entity.systemId) {
            const baseUrl = this.app.config.systemInfo.find(s => s.systemId == entity.systemId).url;
            queryObj.baseUrl = baseUrl;
        }
        let count = 1,
            recursionLevel = 1,
            lastinvokeName = entity.name,
            result = {};

        await this._invoke(entity, queryObj, count, result, recursionLevel, lastinvokeName);
        return result;
    }

    async _invoke(entity, queryObj, count, result, recursionLevel, lastinvokeName) {
    
        let invokeName = '';
        (lastinvokeName + '-' + count).replace(/(?=\S+)((?:-\d+)+)/, (w, p1) => {
            invokeName = entity.name + p1;
            return entity.name + p1;
        });
        result[invokeName] = {};
        let url = this.parseByqueryMap(entity.url, queryObj);
        let method = entity.method.toUpperCase();
        let data = this.parseByqueryMap(entity.body, queryObj);
        data = JSON.parse(data);
        let head = this.parseByqueryMap(entity.head, queryObj);
        head = JSON.parse(head);
        // this.ctx.logger.info('url:', url);
        // this.ctx.logger.info('method:', method);
        // this.ctx.logger.info('head:', head);
        // this.ctx.logger.info('body:', data);


        let invokeResult;
        try {
            //let time = new Date() * 1
            invokeResult = await this.app.curl(url, {
                method: method,
                data: data,
                headers: head,
                dataType: 'json',
                timeout: 200000,
            });
            //let time2 = new Date() * 1
            //console.log('span time', (time2 - time)/1000)
        } catch (e) {
            this.ctx.logger.info('调用接口错误!!', url);
            //this.ctx.logger.info(invokeResult);
            this.ctx.logger.info(e);
            //throw e;
            invokeResult = {
                data: {
                    'msg': '调用接口错误!!',
                    'url': url,
                    'method:': method,
                    'head:': head,
                    'body:': data,
                    'description': e.toString(),
                    'exception': true
                }
            }

        }

        if (entity.enableLog == '1') {
            this.app.mysql.insert('invoke_log', {
                key: head.logKey,
                name: entity.name,
                groupName: entity.groupName,
                code: invokeResult.status,
                request: JSON.stringify(data),
                response: JSON.stringify(invokeResult.data),
                date: this.app.mysql.literals.now,
                descrption: entity.descrption,
                url: url,
                method: method,
                head: JSON.stringify(head)

            })
        }
        //this.ctx.logger.info('status',invokeResult.status);
        //this.ctx.logger.info('result',invokeResult.data);

        if (entity.parseFun) {
            try {
                
                let fn = evil(entity.parseFun);
                let s = fn(invokeResult.data, invokeResult.headers, invokeResult.status, head, data, url);
                //response,responsehead,responsestatus,requesthead,requestdata,url,logger,redis
                //this.ctx.logger.info('afterPares',invokeResult.data);
                result[invokeName].result = s;
            } catch (e) {
                this.ctx.logger.error('运行解析函数错误');
                this.ctx.logger.info('response,responsehead,responsestatus,requesthead,requestdata,url');
                this.ctx.logger.info('解析参数\n', '----->\n', invokeResult.data, '\n', invokeResult.headers, '\n', invokeResult.status, '\n', head, '\n', data, '\n', url, '<------\n');
                this.ctx.logger.info('解析析函', entity.parseFun);
                result[invokeName].result = invokeResult.data;
            }
        } else {
            result[invokeName].result = invokeResult.data;
        }

        result[invokeName].body = data;
        result[invokeName].head = head;
        result[invokeName].url = url;
        if (entity.next && result[invokeName].result.map) {
            recursionLevel++;
            let promisesAll=[]
            let nextEntitys = await this.ctx.service.redis.hmget('invokeEntitys', entity.next.split(','))
            for (let netxEn of nextEntitys) {
                let currentCount = count;
                let promises = result[invokeName].result.map(r => {
                    currentCount++;
                    let currentQuertyObj = {};
                    Object.assign(currentQuertyObj, queryObj);
                    let queryParams = this.queryParams(netxEn);
                    queryParams.forEach(p => {
                        if (r[p] == 0) {
                            currentQuertyObj[p] = 0;
                        }
                        if (r[p]) {
                            currentQuertyObj[p] = r[p];
                        }
                    });
                    return this._invoke(netxEn, currentQuertyObj, currentCount, result, recursionLevel, invokeName);

                });
                //promisesAll.concat(promises)
                //await Promise.all(promises);
                promisesAll.push(Promise.all(promises))
            }
            await Promise.all(promisesAll);
        }
    }

    parseByqueryMap(str, queryMap) {
        return str.replace(/(@(\w+))/g, (w, p1, p2) => {
            if (queryMap[p2] === 0) {
                return 0
            }
            if (queryMap[p2] === '') {
                return ''
            }
            return queryMap[p2] ? queryMap[p2] : p1;
        });
    };

    queryParams(entity) {
        let queryStr = '' + entity.url + entity.head + entity.body;
        let params = [];
        queryStr.replace(/@(\w+)/g, (w, p1) => {
            params.push(p1);
        });
        return params;
    }
}

function evil(fn) {
    fn.replace(/(\s?function\s?)(\w?)(\s?\(w+\)[\s|\S]*)/g, function (w, p1, p2, p3) {
        return p1 + p3;
    });
    let Fun = Function;
    return new Fun('return ' + fn)();
}



function group(array, subGroupLength) {
    let index = 0;
    let newArray = [];
    while (index < array.length) {
        newArray.push(array.slice(index, index += subGroupLength));
    }
    return newArray;
}

function isFunction(v) {
    return Object.prototype.toString.call(v) == "[object Function]";
};

function isObj(v) {
    return Object.prototype.toString.call(v) == "[object Object]";
};

function isArrsy(v) {
    return Object.prototype.toString.call(v) == "[object Array]";
};

module.exports = RestfulService;


