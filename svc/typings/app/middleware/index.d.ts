// This file is created by egg-ts-helper@1.34.7
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import ExportRestful = require('../../../app/middleware/restful');

declare module 'egg' {
  interface IMiddleware {
    restful: typeof ExportRestful;
  }
}
