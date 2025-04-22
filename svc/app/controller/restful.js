const Controller = require('egg').Controller;



class RestfulController extends Controller {

    async toPage() {
        await this.ctx.render('restful/invokeEntityInfo.tpl');
    }

    async infos() {
        const { page, pageSize, invokeName, groupName, systemId } = this.ctx.request.body;
        
        let where = (invokeName && !/\s/.test(invokeName)) ? { name: invokeName } : {};
        where = (groupName && !/\s/.test(groupName)) ? { ...where, groupName: groupName } : where;
        where = (systemId && !/\s/.test(systemId)) ? { ...where, systemId: systemId } : where;
        let wherecount = (invokeName && !/\s/.test(invokeName)) ? `where name='${invokeName}'` : 'where 1=1';
        wherecount = wherecount + ((groupName && !/\s/.test(groupName)) ? ` and groupname='${groupName}'` : '');
        wherecount = wherecount + ((systemId && !/\s/.test(systemId)) ? ` and systemId='${systemId}'` : '');
        let result = {};
        let [{ total }] = await this.app.mysql.query(`select count(1) total from invoke_info ${wherecount}`, []);

        const offset = (page - 1) * pageSize;
        let content = await this.app.mysql.select('invoke_info', {
            where,
            limit: Number(pageSize),
            offset: Number(offset),
        });

        result.totalElements = total;
        result.content = content;
        this.ctx.body = result;
    }


    systemInfo() {
        this.ctx.body = this.app.config.systemInfo;
    }

    async logs(){
        const { page, pageSize, invokeName, groupName, systemId,key } = this.ctx.request.body;
        
        let where = (invokeName && !/\s/.test(invokeName)) ? { name: invokeName } : {};
        where = (groupName && !/\s/.test(groupName)) ? { ...where, groupName: groupName } : where;
        where = (systemId && !/\s/.test(systemId)) ? { ...where, systemId: systemId } : where;
        where = (key && !/\s/.test(key)) ? { ...where, key: key } : where;
        let wherecount = (invokeName && !/\s/.test(invokeName)) ? `where name='${invokeName}'` : 'where 1=1';
        wherecount = wherecount + ((groupName && !/\s/.test(groupName)) ? ` and groupname='${groupName}'` : '');
        wherecount = wherecount + ((systemId && !/\s/.test(systemId)) ? ` and systemId='${systemId}'` : '');
        wherecount = wherecount + ((key && !/\s/.test(key)) ? ` and \`key\`='${key}'` : '');
        let result = {};
        let [{ total }] = await this.app.mysql.query(`select count(1) total from invoke_log ${wherecount}`, []);

        const offset = (page - 1) * pageSize;
        let content = await this.app.mysql.select('invoke_log', {
            where,
            limit: Number(pageSize),
            offset: Number(offset),
            orders: [['date', 'desc']]
        });

        result.totalElements = total;
        result.content = content;
        this.ctx.body = result;
    }

    async save() {
        const entity = this.ctx.request.body;
        if (!entity.next) entity.next = null;
        let result = {};
        if (entity.id) {
            const [oldENity] = await this.app.mysql.query(`select * from invoke_info where id=?`, [entity.id]);
            result = await this.app.mysql.update('invoke_info', entity);
            await this.ctx.service.redis.hset('invokeEntitys', entity.id, entity)
            if (oldENity.name != entity.name) {
                const keyMap = await this.ctx.service.redis.get('invokeEntityKeyMap')
                keyMap[entity.name] = entity.id
                delete keyMap[oldENity.name]
                await this.ctx.service.redis.set('invokeEntityKeyMap', keyMap)
            }
        } else {
            result = await this.app.mysql.insert('invoke_info', entity); // 更新 posts 表中的记录
            const [{ id }] = await this.app.mysql.query(`select id from invoke_info where name=?`, [entity.name]);
            const keyMap = await this.ctx.service.redis.get('invokeEntityKeyMap')
            keyMap[entity.name] = id
            await this.ctx.service.redis.set('invokeEntityKeyMap', keyMap)
            await this.ctx.service.redis.hset('invokeEntitys', id, entity)

        }
        // 判断更新成功
        const updateSuccess = result.affectedRows === 1;
        //this.reflashEntity();
        this.ctx.body = { success: updateSuccess };
    }

    async invokes() {
        this.ctx.body = await this.app.mysql.select('invoke_info', {});
    }

    // async test() {
    //     const entity = this.ctx.request.body;
    //     if (!/\d+/.test(entity.systemId)) {
    //         entity.systemId = this.app.config.systemInfo.find(s => s.name == entity.systemId).systemId
    //     }
    //     this.ctx.body = await this.service.restful.invoke(entity, entity.queryMap);
    // }

    async test() {
        const {queryObj,entity} = this.ctx.request.body
        this.ctx.body = await this.service.restful.test(entity, queryObj);
    }

    async invoke() {
        let result = {};
        const queryMap = this.ctx.request.body
        const entity = this.ctx.currentEntity
        let entitybody = {};
        if (entity.body) {
            try {
                entitybody = JSON.parse(entity.body);
            } catch (e) {
                entitybody = {};
            }
        }
        let nextEntitys = await this.ctx.service.redis.hmget('invokeEntitys', entity.next.split(','))
        if (queryMap.activeMethod) {
            if (queryMap.activeMethod.map) {
                nextEntitys = nextEntitys.filter(e=>e).filter(e => queryMap.activeMethod.indexOf(e.name) >= 0);
            } else {
                nextEntitys = nextEntitys.filter(e=>e).filter(e =>  e.name == queryMap.activeMethod);
            }
            if(nextEntitys.length == 0){
                this.ctx.body = {
                    "error": "unable find activeMethod:" + queryMap.activeMethod
                }
                return
            }
        }
        let promises = nextEntitys.map(entity => this.service.restful.invoke(entity, { ...entitybody, ...queryMap }));
        let p = await Promise.all(promises);

        for (let r of p) {
            for (let invokeName in r) {
                if (invokeName === 'msg' || invokeName === 'success') {
                    continue;
                }
                result[invokeName] = r[invokeName]
            }
        }
        //this.ctx.logger.info('集成就调用结果:', result);
        if (entity.parseFun) {
            try {
                const callObj = {
                    defaultValue : function(obj,keyName){
                        if(obj.map){
                            obj = obj[0]
                        }
                        let keys = Object.keys(obj);
                        let key = ''
                        if(keyName){
                            key = keys.find(key => key.startsWith(keyName))
                            if(!key){
                                key = keys[0]
                            }
                        }else{
                            key = keys[0]
                        }
                        return  obj[key]
                    },
                    keyList : function(obj,keyName){
                        if(obj.map){
                            obj = obj[0]
                        }
                        let keys = Object.keys(obj);
                        return keys.filter(key => key.startsWith(keyName)).filter(key=>obj[key]).map(key=>obj[key]).flat()
                    },
                    preciseMultiply:function(num1, num2) {
                        // 将数字转换为字符串以分析小数位
                        const str1 = num1.toString();
                        const str2 = num2.toString();
                        
                        // 获取小数点后的位数
                        const decimalPlaces1 = str1.includes('.') ? str1.split('.')[1].length : 0;
                        const decimalPlaces2 = str2.includes('.') ? str2.split('.')[1].length : 0;
                        
                        // 总的小数位数
                        const totalDecimalPlaces = decimalPlaces1 + decimalPlaces2;
                        
                        // 将小数转换为整数（移除小数点）
                        const int1 = Number(str1.replace('.', ''));
                        const int2 = Number(str2.replace('.', ''));
                        
                        // 整数相乘
                        const product = int1 * int2;
                        
                        // 调整小数点位置（除以 10 的 totalDecimalPlaces 次方）
                        const result = product / Math.pow(10, totalDecimalPlaces);
                        
                        return result;
                    }
                }
                let fn = evil(entity.parseFun);
                result = fn.call(callObj,result,{ ...entitybody, ...queryMap });
            } catch (e) {
                this.ctx.logger.error(e);
            }
        }
        //this.ctx.logger.info('运行解析函数后结果',result);
        this.ctx.body = result;
    }

    async delete() {
        const id = this.ctx.params.id
        const result = await this.app.mysql.delete('invoke_info', {
            id: id
        });
        const updateSuccess = result.affectedRows === 1;
        if (updateSuccess) {
            const keyMap = await this.ctx.service.redis.get('invokeEntityKeyMap')
            console.log(keyMap)
            for (let a in keyMap) {
                if (keyMap[a] == id) {
                    delete keyMap[a]
                }
            }
            await this.ctx.service.redis.set('invokeEntityKeyMap', keyMap)
            await this.app.redis.hdel('invokeEntitys', id)
        }
        this.ctx.body = { success: updateSuccess };
    }

    async checkUnique() {
        let [{ total }] = await this.app.mysql.query('select count(1) total from invoke_info where name=?', [this.ctx.params.invokeName]);
        this.ctx.body = { total }
    }

    async groupName() {
        const names = await this.app.mysql.query(`select id, name,descrption as description from invoke_info`);
        const groupNames = await this.app.mysql.query(`select distinct groupName as name from invoke_info`);
        this.ctx.body = {
            names, groupNames
        }
    }



}

function evil(fn) {
    fn.replace(/(\s?function\s?)(\w?)(\s?\(w+\)[\s|\S]*)/g, function (w, p1, p2, p3) {
        return p1 + p3;
    });

    let Fn = Function;
    return new Fn('return ' + fn)();
}



module.exports = RestfulController;
