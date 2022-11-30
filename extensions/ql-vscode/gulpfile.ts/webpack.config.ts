import { resolve } from "path";
import * as webpack from "webpack";
import * as MiniCssExtractPlugin from "mini-css-extract-plugin";

export const config: webpack.Configuration = {
  mode: "development",
  entry: {
    webview: "./src/view/webview.tsx",
  },
  output: {
    path: resolve(__dirname, "..", "out"),
    filename: "[name].js",
  },
  devtool: "inline-source-map",
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".json"],
    fallback: {
      path: require.resolve("path-browserify"),
    },
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
          },
        ],
      },
      {
        test: /\.(woff(2)?|ttf|eot)$/,
        use: [
          {
            loader: "file-loader",
            options: {
              name: "[name].[ext]",
              outputPath: "fonts/",
              // We need this to make Webpack use the correct path for the fonts.
              // Without this, the CSS file will use `url([object Module])`
              esModule: false,
            },
          },
        ],
      },
    ],
  },
  performance: {
    hints: false,
  },
  plugins: [new MiniCssExtractPlugin()],
};
