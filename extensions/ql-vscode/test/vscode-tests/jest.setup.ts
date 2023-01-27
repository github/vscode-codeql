import { env } from "vscode";
import { jestTestConfigHelper } from "./test-config";

(env as any).openExternal = () => {
  /**/
};

console.log("Adding unhandledRejection listener!!!!!!!");

process.on("unhandledRejection", (err, promise) => {
  console.log("inside process.on unhandledRejection!!!!!!!!");
  const stack = err instanceof Error ? err.stack : "";
  const message = err instanceof Error ? err.message : err;

  console.log("Unhandled promise rejection", {
    message,
    stack,
    promise,
  });
});

process.on("unhandledRejection", (err, promise) => {
  console.log("inside process.on unhandledRejection!!!!!!!!");
  const stack = err instanceof Error ? err.stack : "";
  const message = err instanceof Error ? err.message : err;

  console.log("Unhandled promise rejection", {
    message,
    stack,
    promise,
  });
});

process.addListener("unhandledRejection", (e) => {
  console.error("Unhandled rejection.");
  console.error(e);
  // Must use a setTimeout in order to ensure the log is fully flushed before exiting
  setTimeout(() => {
    process.exit(-1);
  }, 2000);
});

export default async function setupEnv() {
  await jestTestConfigHelper();
}
