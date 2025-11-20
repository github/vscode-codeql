/**
 * This module contains instantiated loggers to use in the extension.
 */

import { OutputChannelLogger } from "./output-channel-logger";

// Global logger for the extension.
export const extLogger = new OutputChannelLogger("CodeQL Extension Log");

// Logger for messages from the query server.
export const queryServerLogger = new OutputChannelLogger("CodeQL Query Server");

// Logger for messages from the query server for warming overlay-base cache.
let queryServerForWarmingOverlayBaseCacheLogger:
  | OutputChannelLogger
  | undefined;

// construct queryServerForWarmingOverlayBaseCacheLogger lazily, as most users don't need it
export function getQueryServerForWarmingOverlayBaseCacheLogger(): OutputChannelLogger {
  if (!queryServerForWarmingOverlayBaseCacheLogger)
    queryServerForWarmingOverlayBaseCacheLogger = new OutputChannelLogger(
      "CodeQL Query Server for warming overlay-base cache",
    );
  return queryServerForWarmingOverlayBaseCacheLogger;
}

// Logger for messages from the language server.
export const languageServerLogger = new OutputChannelLogger(
  "CodeQL Language Server",
);

// Logger for messages from tests.
export const testLogger = new OutputChannelLogger("CodeQL Tests");
