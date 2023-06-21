import { getErrorMessage, getErrorStack } from "../../common/helpers-pure";
import { vscode } from "../vscode-api";

// Keep track of previous errors that have happened.
// The listeners for uncaught errors and rejections can get triggered
// twice for each error. This is believed to be an effect caused
// by React's error boundaries. Adding an error boundary stops
// this duplicate reporting for errors that happen during component
// rendering, but unfortunately errors from event handlers and
// timeouts are still duplicated and there does not appear to be
// a way around this.
const previousErrors: Set<Error> = new Set();

function shouldReportError(error: Error): boolean {
  const seenBefore = previousErrors.has(error);
  previousErrors.add(error);
  setTimeout(() => {
    previousErrors.delete(error);
  }, 1000);
  return !seenBefore;
}

const unhandledErrorListener = (event: ErrorEvent) => {
  if (shouldReportError(event.error)) {
    vscode.postMessage({
      t: "unhandledError",
      error: {
        message: getErrorMessage(event.error),
        stack: getErrorStack(event.error),
      },
    });
  }
};

const unhandledRejectionListener = (event: PromiseRejectionEvent) => {
  if (shouldReportError(event.reason)) {
    vscode.postMessage({
      t: "unhandledError",
      error: {
        message: getErrorMessage(event.reason),
        stack: getErrorStack(event.reason),
      },
    });
  }
};

/**
 * Adds listeners for unhandled errors / rejected promises.
 * When an error is detected a "unhandledError" message is posted to the view.
 */
export function registerUnhandledErrorListener() {
  window.addEventListener("error", unhandledErrorListener);
  window.addEventListener("unhandledrejection", unhandledRejectionListener);
}
