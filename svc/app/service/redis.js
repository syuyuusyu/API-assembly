const Service = require('egg').Service;

class RedisService extends Service {

    async get(k) {
        // if(!await this.containKey(k)){
        //     this.app.logger.error('key:'+k+'对应对象不存在');
        //     return;
        // }
        const json = await this.app.redis.get(k);
        return JSON.parse(json);
    }

    async hget(key, field) {
        const json = await this.app.redis.hget(key, field);
        return JSON.parse(json);
    }

    async hset(key, field, value) {
        await this.app.redis.hset(key, field, JSON.stringify(value));
    }

    async hmget(key, fields) {
        const json = await this.app.redis.hmget(key, fields);
        return json.map(_ => JSON.parse(_));
    }

    async set(k, v) {
        await this.app.redis.set(k, JSON.stringify(v));
    }

    async push(k, obj) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在1');
            return;
        }
        const json = await this.app.redis.get(k);
        const array = JSON.parse(json);
        if (!array.push) {
            this.app.logger.error('key:' + k + '对应对应对象不是数组', array);
            return;
        }
        array.push(obj);
        await this.set(k, array);

    }

    async shift(k) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在2');
            return;
        }
        const json = await this.app.redis.get(k);
        const array = JSON.parse(json);
        if (!array.shift) {
            this.app.logger.error('key:' + k + '对应对应对象不是数组', array);
            return;
        }
        const obj = array.shift();
        await this.set(k, array);
        return obj;
    }

    async del(key) {
        await this.app.redis.del(key);
    }

    async forEach(k, fn) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在3');
            return;
        }
        const json = await this.app.redis.get(k);
        const array = JSON.parse(json);
        if (!array.forEach) {
            this.app.logger.error('key:' + k + '对应对应对象不是数组', array);
            return;
        }
        array.forEach(fn);
    }

    async setProperty(k, field, v) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在4');
            return;
        }
        const json = await this.app.redis.get(k);
        const obj = JSON.parse(json);
        obj[field] = v;
        await this.set(k, obj);
    }

    async getProperty(k, field) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在5');
            return;
        }
        const json = await this.app.redis.get(k);
        const obj = JSON.parse(json);
        return obj[field];
    }

    async splice(k, index, length) {
        if (!await this.containKey(k)) {
            this.app.logger.error('key:' + k + '对应对象不存在6');
            return;
        }
        const json = await this.app.redis.get(k);
        const array = JSON.parse(json);
        if (!array.splice) {
            this.app.logger.error('key:' + k + '对应对应对象不是数组', array);
            return;
        }
        array.splice(index, length);
        await this.set(k, array);
    }

    async containKey(key) {
        const keys = await this.app.redis.keys('*');
        return keys.filter(k => k === key).length > 0;
    }


}

module.exports = RedisService;