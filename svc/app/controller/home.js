'use strict';

const { Controller } = require('egg');

class HomeController extends Controller {
  async index() {
    console.log(this.ctx.render)
    await this.ctx.render('/index.html');
  }

  doNothing() {
    this.ctx.body = {};
  }
}

module.exports = HomeController;
