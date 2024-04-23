'use strict';

const { Controller } = require('egg');
const fs = require('fs')
const path = require('path')

class HomeController extends Controller {

  doNothing() {
    this.ctx.body = {};
  }
}

module.exports = HomeController;
