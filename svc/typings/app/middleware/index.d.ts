// This file is created by egg-ts-helper@1.34.7
// Do not modify this file!!!!!!!!!
/* eslint-disable */

import 'egg';
import ExportAuthor = require('../../../app/middleware/Author');
import ExportRestful = require('../../../app/middleware/restful');

declare module 'egg' {
  interface IMiddleware {
    author: typeof ExportAuthor;
    restful: typeof ExportRestful;
  }
}
