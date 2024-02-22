import { clearTimeout } from "node:timers";

export function createTimeoutSignal(timeoutSeconds: number): {
  signal: AbortSignal;
  onData: () => void;
  dispose: () => void;
} {
  const timeout = timeoutSeconds * 1000;

  const abortController = new AbortController();

  let timeoutId: NodeJS.Timeout;

  // If we don't get any data within the timeout, abort the download
  timeoutId = setTimeout(() => {
    abortController.abort();
  }, timeout);

  // If we receive any data within the timeout, reset the timeout
  const onData = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);
  };

  const dispose = () => {
    clearTimeout(timeoutId);
  };

  return {
    signal: abortController.signal,
    onData,
    dispose,
  };
}
