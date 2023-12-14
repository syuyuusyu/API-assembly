// @ts-nocheck
const path = require('path');

module.exports = {
  mode: "production",
  //entry: "./src/InvokeUi.js", // 修改为你的组件实际路径
  entry: "./src/libtest.js",

  //   output: {
  //     path: path.resolve(__dirname, "dist"),
  //     filename: "invoke-ui-lib.js",
  //     libraryTarget: "module",
  //   },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app-lib.js",
    libraryTarget: "module",
  },
  experiments: {
    outputModule: true,
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.less$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "less-loader",
            options: {
              lessOptions: {
                javascriptEnabled: true,
              },
            },
          },
        ],
      },
    ],
  },

  // 解析这些扩展名的模块
  resolve: {
    extensions: [".js", ".jsx"],
  },
  externals: {
    react: "React",
    "react-dom": "ReactDOM",
  },
};
