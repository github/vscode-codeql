import { src, dest } from "gulp";
// eslint-disable-next-line @typescript-eslint/no-require-imports,import/no-commonjs
const replace = require("gulp-replace");

/** Inject the application insights key into the telemetry file */
export function injectAppInsightsKey() {
  if (!process.env.APP_INSIGHTS_KEY) {
    // noop
    console.log(
      "APP_INSIGHTS_KEY environment variable is not set. So, cannot inject it into the application.",
    );
    return Promise.resolve();
  }

  // replace the key
  return src(["out/extension.js"])
    .pipe(replace(/REPLACE-APP-INSIGHTS-KEY/, process.env.APP_INSIGHTS_KEY))
    .pipe(dest("out/"));
}
