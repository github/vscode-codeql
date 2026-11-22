import { readFile, writeFile } from "fs/promises";

/** Inject the application insights key into the telemetry file */
export async function injectAppInsightsKey() {
  if (!process.env.APP_INSIGHTS_KEY) {
    // noop
    console.log(
      "APP_INSIGHTS_KEY environment variable is not set. So, cannot inject it into the application.",
    );
    return;
  }

  // replace the key
  const filePath = "out/extension.js";
  const content = await readFile(filePath, "utf8");
  await writeFile(
    filePath,
    content.replace(/REPLACE-APP-INSIGHTS-KEY/, process.env.APP_INSIGHTS_KEY),
    "utf8",
  );
}
