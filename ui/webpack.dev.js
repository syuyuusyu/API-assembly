// @ts-nocheck
const baseConfig = require("./webpack.base");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
// const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
const webpack = require("webpack");
const path = require("path");

const PORT = 3000;

for (const key in baseConfig.entry) {
  if (Array.isArray(baseConfig.entry[key])) {
    baseConfig.entry[key].push(
      require.resolve("webpack/hot/dev-server"),
      `${require.resolve("webpack-dev-server/client")}?http://localhost:${PORT}`
    );
  }
}

module.exports = {
  ...baseConfig,
  mode: "development",
  devtool: "inline-source-map",
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
      chunkFilename: "[id].[contenthash].css",
    }),
    new webpack.HotModuleReplacementPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/template.ejs"),
      filename: "index.html",
      //publicPath:'/'
    }),
    // new BundleAnalyzerPlugin(),
  ],
  output: {
    filename: '[name].js',
    path: '/build',
    publicPath: '/',
    pathinfo: false
},
devServer : {
    port: 3000,
    static: {
      directory: path.join(__dirname, 'src/public'),
    },
    //before: require(path.resolve(__dirname, 'src/local-service/index.js')),
    hot: true,
    /* 访问内容的重写（当http请求的地址匹配不到内容时，根据重写规则重写返回内容，可用于解决前端路由页面刷新时路由不匹配的问题） */
    historyApiFallback: true
},
  // externals: { // TODO: ！！！！！！！！！！！！ 如果要私有化部署到内网需要去掉 externals
  //   react: "React",
  //   "react-dom": "ReactDOM",
  //   moment: "moment",
  //   antd: "antd",
  //   //lodash: "lodash",
  //   echarts: "echarts"
  // },
};

//TODO: syuyuyu 666
