// @ts-nocheck
const path = require("path");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
  stats: {
    entrypoints: false,
    children: false,
  },
  entry: {
    main: path.resolve(__dirname, "./src"),
    //main: path.resolve(__dirname, "./src/index.js"),
  },
  output: {
    path: path.resolve(__dirname, "./build"),
    filename: "[name].[contenthash].bundle.js",
    publicPath: '/',
  },
  resolve: {
    modules: ["node_modules"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json"],
    alias: {},
  },
  module: {
    rules: [
      {
        test: /\.ejs$/,
        loader: "ejs-loader",
        options: {
          variable: "data",
        },
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        include: /src/,
        use: [
          {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              presets: ["@babel/preset-env", "@babel/preset-react"],
              plugins: [
                "@babel/plugin-transform-runtime",
                // "@babel/syntax-dynamic-import",
                // [
                //   "import",
                //   {
                //     libraryName: "antd",
                //     libraryDirectory: "es",
                //     style: true,
                //   },
                // ],
              ],
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, require.resolve("css-loader")],
      },
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: "css-loader" },
          {
            loader: "less-loader",
            options: {
              javascriptEnabled: true,
            },
          },
        ],
      },
      {
        test: /\.(woff|woff2|ttf|eot|svg|png|ico)(\?v=\d+\.\d+\.\d+)?$/,
        use: ["url-loader"],
      },
      {
        test: /\.html?$/,
        loader: require.resolve("file-loader"),
        options: {
          name: "[name].[ext]",
        },
      },
    ],
  },
};
