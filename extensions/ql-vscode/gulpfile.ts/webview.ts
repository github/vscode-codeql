import webpack from "webpack";
import { config } from "./webpack.webview.config";

export function compileView(cb: (err?: Error) => void) {
  doWebpack(config, true, cb);
}

export function watchView(cb: (err?: Error) => void) {
  const watchConfig = {
    ...config,
    watch: true,
    watchOptions: {
      aggregateTimeout: 200,
      poll: 1000,
    },
  };
  doWebpack(watchConfig, false, cb);
}

function doWebpack(
  internalConfig: webpack.Configuration,
  failOnError: boolean,
  cb: (err?: Error) => void,
) {
  const resultCb = (error: Error | undefined, stats?: webpack.Stats) => {
    if (error) {
      cb(error);
    }
    if (stats) {
      console.log(
        stats.toString({
          errorDetails: true,
          colors: true,
          assets: false,
          builtAt: false,
          version: false,
          hash: false,
          entrypoints: false,
          timings: false,
          modules: false,
          errors: true,
        }),
      );
      if (stats.hasErrors()) {
        if (failOnError) {
          cb(new Error("Compilation errors detected."));
          return;
        } else {
          console.error("Compilation errors detected.");
        }
      }
      cb();
    }
  };

  webpack(internalConfig, resultCb);
}
