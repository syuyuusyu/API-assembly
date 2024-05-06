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
            previousInvokeName = entity.name,
            result = {};

        await this._invoke(entity, queryObj, count, result, recursionLevel, previousInvokeName,undefined,undefined);
        return result;
    }

    async _invoke(entity, queryObj, count, result, recursionLevel, previousInvokeName,sameLevelIndex,previousReseult) {
        let _childName = '',
            _addToParent = false,
            invokeName = previousInvokeName;
        if(recursionLevel>1){
            (previousInvokeName + '-' + count).replace(/(?=\S+)((?:-\d+)+)/, (w, p1) => {
                invokeName = entity.name + p1
                return entity.name + p1
            });
        }
        result[invokeName] = {};
        let url = this.parseByqueryMap(entity.url, queryObj)
        let method = entity.method.toUpperCase()
        let requestBody = this.parseByqueryMap(entity.body, queryObj)
        requestBody = JSON.parse(requestBody)
        let requestHead = this.parseByqueryMap(entity.head, queryObj)
        requestHead = JSON.parse(requestHead)

        let invokeResult;
        try {
            invokeResult = await this.app.curl(url, {
                method: method,
                data: requestBody,
                headers: requestHead,
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
                status: 505,
                data: {
                    'msg': '调用接口错误!!',
                    'url': url,
                    'method:': method,
                    'head:': requestHead,
                    'body:': data,
                    'description': e.toString(),
                    'exception': true
                }
            }

        }

        if (entity.enableLog == '1') {
            this.app.mysql.insert('invoke_log', {
                key: requestHead.logKey,
                name: entity.name,
                groupName: entity.groupName,
                code: invokeResult.status,
                request: JSON.stringify(requestBody),
                response: JSON.stringify(invokeResult.data),
                date: this.app.mysql.literals.now,
                descrption: entity.descrption,
                url: url,
                method: method,
                head: JSON.stringify(requestHead)
            })
        }
        //this.ctx.logger.info('status',invokeResult.status);
        //this.ctx.logger.info('result',invokeResult.data);

        if (entity.parseFun) {
            try {
                const callObj = {
                    addToParent:function(childName = 'children'){                 
                        _childName = childName
                        _addToParent = true
                    }
                }
                let fn = evil(entity.parseFun);
                let s = fn.call(callObj,invokeResult.data, invokeResult.headers, invokeResult.status, requestHead, requestBody, url);
                if(!s){
                    delete result[invokeName]
                    return
                }
                invokeResult.data = s
                if(_addToParent){
                    if(previousReseult){
                        previousReseult[_childName] = s
                    }else if(result[previousInvokeName][sameLevelIndex]){
                        result[previousInvokeName][sameLevelIndex][_childName] = s
                    }
                    delete result[invokeName]
                }else{
                    result[invokeName] = s
                }
                
            } catch (e) {
                console.log(e)
                this.ctx.logger.error('运行解析函数错误');
                this.ctx.logger.info('response,responsehead,responsestatus,requesthead,requestBody,url');
                this.ctx.logger.info('解析参数\n', '----->\n', invokeResult.data, '\n', invokeResult.headers, '\n', invokeResult.status, '\n', requestHead, '\n', requestBody, '\n', url, '<------\n');
                this.ctx.logger.info('解析析函', entity.parseFun);
                _addToParent = false
                result[invokeName] = invokeResult.data;
            }
        } else {
            result[invokeName] = invokeResult.data;
        }
        if (entity.next && invokeResult.data.map) {
            recursionLevel++;
            let promisesAll=[]
            let nextEntitys = await this.ctx.service.redis.hmget('invokeEntitys', entity.next.split(','))
            for (let netxEn of nextEntitys) {
                let currentCount = count;
                let promises = invokeResult.data.map((r,index) => {
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
                    return this._invoke(netxEn, currentQuertyObj, currentCount, result, recursionLevel, invokeName,index,r);
                });
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


