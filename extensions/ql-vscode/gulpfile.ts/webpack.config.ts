import { resolve } from "path";
import * as webpack from "webpack";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import { isDevBuild } from "./dev";

export const config: webpack.Configuration = {
  mode: isDevBuild ? "development" : "production",
  entry: {
    webview: "./src/view/webview.tsx",
  },
  output: {
    path: resolve(__dirname, "..", "out"),
    filename: "[name].js",
  },
  devtool: isDevBuild ? "inline-source-map" : "source-map",
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"],
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        loader: "ts-loader",
        options: {
          configFile: "src/view/tsconfig.json",
        },
      },
      {
        test: /\.less$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
              sourceMap: true,
            },
          },
          {
            loader: "less-loader",
            options: {
              javascriptEnabled: true,
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot)$/,
        type: "asset/resource",
        generator: {
          filename: "fonts/[hash][ext][query]",
        },
      },
    ],
  },
  performance: {
    hints: false,
  },
  plugins: [new MiniCssExtractPlugin()],
};
