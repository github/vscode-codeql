import { getErrorMessage, getErrorStack } from "../../pure/helpers-pure";
import { vscode } from "../vscode-api";

const unhandledErrorListener = (event: ErrorEvent) => {
  vscode.postMessage({
    t: "unhandledError",
    error: {
      message: getErrorMessage(event.error),
      stack: getErrorStack(event.error),
    },
  });
};

const unhandledRejectionListener = (event: PromiseRejectionEvent) => {
  vscode.postMessage({
    t: "unhandledError",
    error: {
      message: getErrorMessage(event.reason),
      stack: getErrorStack(event.reason),
    },
  });
};

/**
 * Adds listeners for unhandled errors / rejected promises.
 * When an error is detected a "unhandledError" message is posted to the view.
 */
export function registerUnhandledErrorListener() {
  window.addEventListener("error", unhandledErrorListener);
  window.addEventListener("unhandledrejection", unhandledRejectionListener);
}
