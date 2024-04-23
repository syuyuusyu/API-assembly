// @ts-nocheck
const baseConfig = require("./webpack.base");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const path = require("path");
const AddAssetHtmlPlugin = require('add-asset-html-webpack-plugin');

module.exports = {
  ...baseConfig,
  mode: "production",
  //publicPath: '/',
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[id].[contenthash].css",
    }),
    new HtmlWebpackPlugin({
      publicPath:'/',
      template: path.resolve(__dirname, "src/template.ejs"),
      filename: "index.html",
      favicon: path.resolve(__dirname, 'src/favicon.ico')
    }),
    new AddAssetHtmlPlugin({ filepath: path.resolve(__dirname, 'src/global.js'),publicPath:'/' }),
    //new AddAssetHtmlPlugin({ filepath: require.resolve('./src/global.js') }),
  ],
  optimization: {
    minimize: true,
    runtimeChunk: 'single',
    splitChunks: {
      chunks: "all",
      minSize: 200*1024,
      maxSize: 244*1024,
      minChunks: 5,
      cacheGroups: {
        vendors: {
          test: /[\\\/]node_modules[\/\\]/,
          filename: "[id]_vendors.js",
        }
      },
    },
  }
};