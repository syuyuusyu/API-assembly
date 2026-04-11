// This file is created by egg-ts-helper@1.34.7
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
type AnyClass = new (...args: any[]) => any;
type AnyFunc<T = any> = (...args: any[]) => T;
type CanExportFunc = AnyFunc<Promise<any>> | AnyFunc<IterableIterator<any>>;
type AutoInstanceType<T, U = T extends CanExportFunc ? T : T extends AnyFunc ? ReturnType<T> : T> = U extends AnyClass ? InstanceType<U> : U;
import ExportAiStream = require('../../../app/service/aiStream');
import ExportRedis = require('../../../app/service/redis');
import ExportRestful = require('../../../app/service/restful');

declare module 'egg' {
  interface IService {
    aiStream: AutoInstanceType<typeof ExportAiStream>;
    redis: AutoInstanceType<typeof ExportRedis>;
    restful: AutoInstanceType<typeof ExportRestful>;
  }
}
